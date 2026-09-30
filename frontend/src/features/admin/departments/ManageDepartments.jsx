import { useMemo, useState } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { useQuery } from '@tanstack/react-query';
import { teachersApi } from '../../../api/teachersApi.js';
import { formatTeacherCode } from '../../../lib/format.js';
import { useDepartments, useDepartmentMutations } from './useDepartments.js';

const EMPTY = { id: '', name: '', head: '' };

export function ManageDepartments() {
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [modal, setModal] = useState(null); // null | {mode:'create'|'edit', dept}
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = useDepartments(params);
  const { create, update, remove } = useDepartmentMutations();
  const { data: teacherData } = useQuery({
    queryKey: ['teachers', { limit: 200 }],
    queryFn: () => teachersApi.list({ limit: 200 }),
  });
  const teachers = teacherData?.data || [];

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };

  const openCreate = () => {
    setForm(EMPTY);
    setErrors({});
    setModal({ mode: 'create' });
  };

  const openEdit = (dept) => {
    setForm({ id: dept.id, name: dept.name, head: dept.head?._id || '' });
    setErrors({});
    setModal({ mode: 'edit', dept });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (modal.mode === 'create' && !form.id.trim()) next.id = 'Mã khoa là bắt buộc';
    if (!form.name.trim()) next.name = 'Tên khoa là bắt buộc';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      if (modal.mode === 'create') {
        await create.mutateAsync({ id: form.id.trim(), name: form.name.trim() });
        toast.success('Đã thêm khoa');
      } else {
        await update.mutateAsync({ id: modal.dept._id, name: form.name.trim(), head: form.head || null });
        toast.success('Đã cập nhật khoa');
      }
      setModal(null);
    } catch (error) {
      if (error.code === 'CONFLICT') setErrors({ id: error.message });
      else toast.error(error.message);
    }
  };

  const onDelete = async (dept) => {
    const ok = await confirm({
      title: 'Xóa khoa',
      message: `Xóa khoa "${dept.name}"? Giáo viên, sinh viên và học phần thuộc khoa sẽ chuyển sang "Chưa xác định".`,
      confirmText: 'Xóa',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(dept._id);
      toast.success('Đã xóa khoa');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'id', header: 'Mã khoa', className: 'font-semibold text-gray-800' },
    { key: 'name', header: 'Tên khoa' },
    {
      key: 'head',
      header: 'Trưởng khoa',
      render: (d) => d.head?.hoTen || <span className="text-gray-400">Chưa có</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-28',
      render: (d) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => openEdit(d)}
            className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50"
            aria-label="Sửa"
          >
            <i className="fas fa-pen" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(d)}
            className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50"
            aria-label="Xóa"
          >
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quản lý khoa"
        subtitle="Thêm, sửa và xóa các khoa trong hệ thống"
        actions={
          <>
            <SearchInput
              value={searchText}
              onChange={(v) => {
                setSearchText(v);
                setPage(1);
              }}
              placeholder="Tìm theo mã hoặc tên..."
            />
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap"
            >
              <i className="fas fa-plus mr-2" /> Thêm khoa
            </button>
          </>
        }
      />

      <DataTable columns={columns} rows={rows} isLoading={isLoading} emptyText="Chưa có khoa nào" />
      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onPageChange={setPage} />

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Thêm khoa' : 'Sửa khoa'}
        size="sm"
      >
        {modal && (
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Mã khoa" error={errors.id} required>
              <input
                className={inputClass}
                value={form.id}
                disabled={modal.mode === 'edit'}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="VD: CNTT"
              />
            </FormField>
            <FormField label="Tên khoa" error={errors.name} required>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="VD: Khoa Công nghệ thông tin"
              />
            </FormField>
            {modal.mode === 'edit' && (
              <FormField label="Trưởng khoa">
                <select
                  className={inputClass}
                  value={form.head}
                  onChange={(e) => setForm((f) => ({ ...f, head: e.target.value }))}
                >
                  <option value="">Chưa có</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.hoTen} ({formatTeacherCode(t.id)})
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {create.isPending || update.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ManageDepartments;
