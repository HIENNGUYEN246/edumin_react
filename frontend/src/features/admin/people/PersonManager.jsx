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

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = usePeople(config.queryKey, config.api, params);
  const mutations = usePeopleMutations(config.queryKey, config.api);
  const { data: deptData } = useDepartments({ limit: 100 });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const departments = deptData?.data || [];

  const openCreate = () => setModal({ mode: 'create', initial: { ...config.emptyForm } });
  const openEdit = (person) =>
    setModal({
      mode: 'edit',
      person,
      initial: {
        ...config.emptyForm,
        ...person,
        departmentId: person.departmentRef?.id || '',
      },
    });

  const handleSubmit = async (form, setErrors) => {
    try {
      if (modal.mode === 'create') {
        await mutations.create.mutateAsync(form);
        toast.success('Đã thêm thành công');
      } else {
        const { email, password, ...rest } = form;
        void email;
        void password;
        await mutations.update.mutateAsync({ id: modal.person._id, ...rest });
        toast.success('Đã cập nhật');
      }
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
      toast.success('Đã xóa');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onAvatar = async (person, file) => {
    if (!file) return;
    try {
      const res = await mutations.uploadAvatar.mutateAsync({ id: person._id, file });
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
      <label className="cursor-pointer inline-block relative group" title="Bấm để đổi ảnh đại diện">
        <Avatar src={person.avatar?.url || person.avatar} name={person.hoTen} size={38} />
        <span className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fas fa-camera text-xs" />
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onAvatar(person, file);
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

      <DataTable columns={columns} rows={rows} isLoading={isLoading} emptyText="Chưa có dữ liệu" />
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
          onAvatar={modal.initial?._id ? (file) => onAvatar(modal.initial, file) : undefined}
          saving={mutations.create.isPending || mutations.update.isPending}
        />
      )}
    </div>
  );
}

export default PersonManager;
