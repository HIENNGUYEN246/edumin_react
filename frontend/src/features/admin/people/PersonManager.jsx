import { useEffect, useMemo, useRef, useState } from 'react';
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

  useEffect(() => {
    setSelectedIds([]);
  }, [page, search]);

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = usePeople(config.queryKey, config.api, params);
  const mutations = usePeopleMutations(config.queryKey, config.api);
  const { data: deptData } = useDepartments({ limit: 100 });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const departments = deptData?.data || [];

  const openCreate = () => setModal({ mode: 'create', initial: { ...config.emptyForm } });
  const openEdit = (person) => {
    const currentDeptId =
      person.departmentRef?.id ||
      departments.find((d) => d.id === person.department || d.name === person.department)?._id ||
      departments.find((d) => d.id === person.department || d.name === person.department)?.id ||
      '';

    setModal({
      mode: 'edit',
      person,
      initial: {
        ...config.emptyForm,
        ...person,
        dob: person.dob || '',
        phone: person.phone || '',
        address: person.address || '',
        className: person.className || '',
        education: person.education || '',
        departmentId: currentDeptId,
      },
    });
  };

  const handleSubmit = async (form, setErrors) => {
    try {
      if (modal.mode === 'create') {
        await mutations.create.mutateAsync(form);
        toast.success('Đã thêm thành công');
      } else {
        const targetId =
          modal?.person?._id ||
          modal?.person?.id ||
          modal?.initial?._id ||
          modal?.initial?.id ||
          form?._id ||
          form?.id;

        // Clean up payload: exclude internal MongoDB fields and email/password
        const {
          _id,
          id,
          userId,
          departmentRef,
          department,
          avatar,
          createdAt,
          updatedAt,
          __v,
          email,
          password,
          ...rest
        } = form;

        // Normalize string fields, converting null or undefined to empty string
        const cleaned = {};
        for (const [k, v] of Object.entries(rest)) {
          cleaned[k] = v === null || v === undefined ? '' : v;
        }

        await mutations.update.mutateAsync({ id: targetId, ...cleaned });
        toast.success('Đã cập nhật');
      }
      setModal(null);
    } catch (error) {
      if (error.code === 'CONFLICT' || error.code === 'DUPLICATE_KEY') {
        setErrors({ email: error.message });
      } else if (error.details && Array.isArray(error.details)) {
        const fieldErrors = {};
        error.details.forEach((d) => {
          if (d.path) fieldErrors[d.path] = d.message;
        });
        setErrors(fieldErrors);
        toast.error(error.message || 'Dữ liệu không hợp lệ');
      } else {
        toast.error(error.message || 'Lỗi khi lưu dữ liệu');
      }
    }
  };

  const onDelete = async (person) => {
    const ok = await confirm({
      title: 'Xóa',
      message: `Xóa "${person.hoTen}"? Tài khoản đăng nhập cũng sẽ bị xóa.`,
      confirmText: 'Xóa',
      tone: 'danger',
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

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: 'Xóa nhiều mục đã chọn',
      message: `Bạn có chắc muốn xóa ${selectedIds.length} ${config.entityLabel} đã chọn? Tài khoản đăng nhập của các mục này cũng sẽ bị xóa.`,
      confirmText: `Xóa ${selectedIds.length} mục`,
      tone: 'danger',
    });
    if (!ok) return;
    try {
      if (mutations.bulkDelete) {
        await mutations.bulkDelete.mutateAsync(selectedIds);
      } else {
        await Promise.all(selectedIds.map((id) => mutations.remove.mutateAsync(id)));
      }
      toast.success(`Đã xóa ${selectedIds.length} ${config.entityLabel}`);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message || 'Lỗi khi xóa nhiều mục');
    }
  };

  const onAvatar = async (person, file) => {
    if (!file) return;
    try {
      const targetId =
        (typeof person === 'string' ? person : null) ||
        person?._id ||
        person?.id ||
        modal?.person?._id ||
        modal?.person?.id ||
        modal?.initial?._id ||
        modal?.initial?.id;
      if (!targetId) {
        toast.error('Không tìm thấy mã định danh để cập nhật ảnh đại diện');
        return;
      }
      const res = await mutations.uploadAvatar.mutateAsync({ id: targetId, file });
      toast.success('Đã cập nhật ảnh đại diện');
      return res;
    } catch (error) {
      toast.error(error.message);
      throw error;
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
      toast.success(`Đã nhập ${result.created} bản ghi${failed ? `, ${failed} lỗi` : ''}`, failed ? 5000 : 3000);
    } catch (error) {
      toast.error(error.message || 'Không đọc được tệp Excel');
    }
  };

  const onExport = async () => {
    try {
      const all = await config.api.list({ page: 1, limit: 1000 });
      const exportRows = (all.data || []).map((p) => ({
        Ma: config.formatCode(p.id),
        HoTen: p.hoTen,
        Email: p.email,
        Khoa: p.department || '',
        SoDienThoai: p.phone || '',
      }));
      await exportSheet(exportRows, { fileName: config.exportName });
    } catch (error) {
      toast.error(error.message || 'Không xuất được Excel');
    }
  };

  const columns = config.columns({
    formatCode: config.formatCode,
    renderAvatar: (person) => (
      <Avatar src={person.avatar?.url || person.avatar} name={person.hoTen} size={38} />
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

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyText="Chưa có dữ liệu"
        selectable
        selectedKeys={selectedIds}
        onSelectKey={(key) =>
          setSelectedIds((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
        }
        onSelectAll={(allKeys) =>
          setSelectedIds((prev) =>
            allKeys.every((k) => prev.includes(k))
              ? prev.filter((k) => !allKeys.includes(k))
              : Array.from(new Set([...prev, ...allKeys]))
          )
        }
        bulkActions={
          <>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-xs flex items-center gap-1.5"
            >
              <i className="fas fa-trash-alt" />
              <span>Xóa {selectedIds.length} mục đã chọn</span>
            </button>
          </>
        }
      />
      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onPageChange={setPage} />

      {modal && (
        <PersonFormModal
          open
          mode={modal.mode}
          title={modal.mode === 'create' ? `Thêm ${config.entityLabel}` : `Sửa ${config.entityLabel}`}
          initial={modal.initial}
          fields={config.fields}
          departments={departments}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={mutations.create.isPending || mutations.update.isPending}
          onAvatar={
            (modal.mode === 'edit' && (modal.person?._id || modal.person?.id || modal.initial?._id || modal.initial?.id))
              ? (file) => onAvatar(modal.person || modal.initial, file)
              : undefined
          }
        />
      )}
    </div>
  );
}

export default PersonManager;
