import { useMemo, useRef, useState } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { useDepartments } from '../departments/useDepartments.js';
import { usePeople, usePeopleMutations } from './usePeople.js';
import { PersonFormModal } from './PersonFormModal.jsx';
import { readSheet, exportSheet } from '../../../lib/excel.js';

/**
 * Config-driven manager shared by teachers and students.
 * config: { queryKey, api, title, subtitle, formatCode, columns(fmt), fields, emptyForm, exportName }
 */
export function PersonManager({ config }) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);

  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [modal, setModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = usePeople(config.queryKey, config.api, params);
  const mutations = usePeopleMutations(config.queryKey, config.api);
  const { data: deptData } = useDepartments({ limit: 100 });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const departments = deptData?.data || [];
  const tableRows = config.showSerialNumber
    ? rows.map((person, index) => ({ ...person, serialNumber: (meta.page - 1) * params.limit + index + 1 }))
    : rows;

  const allCurrentRowIds = rows.map((r) => r._id);
  const isAllSelected = rows.length > 0 && allCurrentRowIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = rows.length > 0 && allCurrentRowIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allCurrentRowIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allCurrentRowIds])));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const ok = await confirm({
      title: 'Xóa hàng loạt',
      message: `Bạn có chắc chắn muốn xóa ${count} ${config.entityLabel} đã chọn? Tài khoản đăng nhập tương ứng cũng sẽ bị xóa.`,
      confirmText: `Xóa ${count} bản ghi`,
    });
    if (!ok) return;

    try {
      await mutations.bulkRemove.mutateAsync(selectedIds);
      toast.success(`Đã xóa thành công ${count} ${config.entityLabel}`);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message || 'Lỗi khi xóa hàng loạt');
    }
  };

  const openCreate = () => setModal({ mode: 'create', initial: { ...config.emptyForm } });
  const openEdit = (person) =>
    setModal({
      mode: 'edit',
      person,
      initial: {
        ...config.emptyForm,
        ...person,
        departmentId: person.departmentRef?.id || '',
        avatarPreview: person.avatar?.url || '',
      },
    });

  const handleSubmit = async (form, setErrors) => {
    try {
      const avatarFile = form.avatarFile;
      const allowedFields = config.fields.map((field) => field.name);
      if (modal.mode === 'create') allowedFields.push('password');
      const payload = Object.fromEntries(
        allowedFields.filter((key) => Object.hasOwn(form, key)).map((key) => [key, form[key]])
      );
      let person;
      if (modal.mode === 'create') {
        person = await mutations.create.mutateAsync(payload);
      } else {
        const { email, password, ...rest } = payload;
        void email;
        void password;
        person = await mutations.update.mutateAsync({ id: modal.person._id, ...rest });
      }
      if (avatarFile) {
        try {
          await mutations.uploadAvatar.mutateAsync({ id: person._id, file: avatarFile });
        } catch (error) {
          setModal(null);
          toast.error(`Đã lưu hồ sơ nhưng tải ảnh thất bại: ${error.message}`, 5000);
          return;
        }
      }
      toast.success(modal.mode === 'create' ? 'Đã thêm thành công' : 'Đã cập nhật');
      setModal(null);
    } catch (error) {
      if (error.code === 'CONFLICT' || error.code === 'DUPLICATE_KEY') setErrors({ email: error.message });
      else toast.error(error.message);
    }
  };

  const onDelete = async (person) => {
    const ok = await confirm({
      title: 'Xóa',
      message: `Xóa "${person.hoTen}"? Tài khoản đăng nhập cũng sẽ bị xóa.`,
      confirmText: 'Xóa',
    });
    if (!ok) return;
    try {
      await mutations.remove.mutateAsync(person._id);
      setSelectedIds((prev) => prev.filter((id) => id !== person._id));
      toast.success('Đã xóa');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onAvatar = async (person, file) => {
    if (!file) return;
    try {
      await mutations.uploadAvatar.mutateAsync({ id: person._id, file });
      toast.success('Đã cập nhật ảnh đại diện');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const sheetRows = await readSheet(file);
      const result = await mutations.importRows.mutateAsync(sheetRows);
      const failed = result.failed?.length || 0;
      if (failed) {
        const details = result.failed.slice(0, 3).map((item) => `Dòng ${item.row}: ${item.message}`).join(' · ');
        toast.error(`Đã nhập ${result.created} bản ghi, ${failed} lỗi. ${details}`, 8000);
      } else {
        toast.success(`Đã nhập ${result.created} bản ghi`);
      }
    } catch (error) {
      toast.error(error.message || 'Không đọc được tệp Excel');
    }
  };

  const onExport = async () => {
    try {
      const all = await config.api.list({ page: 1, limit: 1000 });
      const exportRows = config.exportRows
        ? config.exportRows(all.data || [])
        : (all.data || []).map((p) => ({
          Ma: config.formatCode(p.id),
          HoTen: p.hoTen,
          Email: p.email,
          Khoa: p.department || '',
          SoDienThoai: p.phone || '',
        }));
      await exportSheet(exportRows, { fileName: config.exportName, sheetName: config.exportSheetName });
    } catch (error) {
      toast.error(error.message || 'Không xuất được Excel');
    }
  };

  const baseColumns = config.columns({
    formatCode: config.formatCode,
    renderAvatar: (person) => (
      <label className="group relative inline-flex cursor-pointer" title="Tải ảnh lên Cloudinary">
        <Avatar src={person.avatar?.url} name={person.hoTen} size={42} />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-indigo-600 text-[9px] text-white">
          <i className="fas fa-camera" />
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            onAvatar(person, file);
          }}
        />
      </label>
    ),
    actions: (person) => (
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => openEdit(person)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" aria-label="Sửa">
          <i className="fas fa-pen" />
        </button>
        <button type="button" onClick={() => onDelete(person)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" aria-label="Xóa">
          <i className="fas fa-trash-alt" />
        </button>
      </div>
    ),
  });

  const selectionColumn = {
    key: 'selection',
    header: (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isSomeSelected;
          }}
          onChange={handleSelectAll}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          title="Chọn tất cả"
          aria-label="Chọn tất cả"
        />
      </div>
    ),
    className: 'w-10 text-center px-2',
    render: (person) => (
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.includes(person._id)}
          onChange={() => handleToggleRow(person._id)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          aria-label={`Chọn ${person.hoTen}`}
        />
      </div>
    ),
  };

  const columns = [selectionColumn, ...baseColumns];

  return (
    <div>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            <SearchInput
              value={searchText}
              onChange={(v) => {
                setSearchText(v);
                setSelectedIds([]);
                setPage(1);
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
              <i className="fas fa-file-import mr-1.5" /> Nhập
            </button>
            <button type="button" onClick={onExport} className="px-3 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700">
              <i className="fas fa-file-export mr-1.5" /> Xuất
            </button>
            <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap">
              <i className="fas fa-plus mr-1.5" /> Thêm
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImport} />
          </>
        }
      />

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-indigo-950">
              Đang chọn <strong className="text-indigo-700">{selectedIds.length}</strong> {config.entityLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={mutations.bulkRemove.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition"
            >
              <i className="fas fa-trash-alt text-[11px]" />
              <span>{mutations.bulkRemove.isPending ? 'Đang xóa...' : `Xóa ${selectedIds.length} đã chọn`}</span>
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={tableRows}
        isLoading={isLoading}
        emptyText="Chưa có dữ liệu"
        rowClassName={(person) => (selectedIds.includes(person._id) ? 'bg-indigo-50/40' : '')}
      />
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        onPageChange={(p) => {
          setSelectedIds([]);
          setPage(p);
        }}
      />

      {modal && (
        <PersonFormModal
          open
          mode={modal.mode}
          title={modal.mode === 'create' ? config.createTitle || `Thêm ${config.entityLabel}` : config.editTitle || `Sửa ${config.entityLabel}`}
          initial={modal.initial}
          fields={config.fields}
          departments={departments}
          profilePanel={config.profilePanel}
          formatCode={config.formatCode}
          entityLabel={config.entityLabel}
          profileCodeLabel={config.profileCodeLabel}
          profileDetailField={config.profileDetailField}
          profileDetailFallback={config.profileDetailFallback}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={mutations.create.isPending || mutations.update.isPending || mutations.uploadAvatar.isPending}
        />
      )}
    </div>
  );
}

export default PersonManager;
