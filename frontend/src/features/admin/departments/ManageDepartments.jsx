import { useMemo, useState } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
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
  const teachers = useMemo(() => teacherData?.data || [], [teacherData]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };

  // Filter teachers belonging to the department being edited (theo đúng chuyên ngành/khoa đó)
  const deptTeachers = useMemo(() => {
    if (!modal?.dept) return [];
    const deptId = modal.dept._id;
    const deptCode = modal.dept.id;
    const deptName = modal.dept.name;

    return teachers.filter((t) => {
      const tRefId = t.departmentRef?._id || t.departmentRef;
      const matchesRef = tRefId && String(tRefId) === String(deptId);
      const matchesName = t.department && (t.department === deptName || t.department === deptCode);
      const isCurrentHead = form.head && String(t._id) === String(form.head);
      return matchesRef || matchesName || isCurrentHead;
    });
  }, [teachers, modal?.dept, form.head]);

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
      render: (d) =>
        d.head?.hoTen ? (
          <div className="flex items-center gap-2.5">
            <Avatar src={d.head.avatar?.url || d.head.avatar} name={d.head.hoTen} size={30} />
            <div>
              <p className="font-semibold text-gray-800 text-xs">{d.head.hoTen}</p>
              <p className="text-[11px] text-gray-400 font-mono">{formatTeacherCode(d.head.id)}</p>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 text-xs italic">Chưa có</span>
        ),
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
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs hover:shadow transition active:scale-[0.98] whitespace-nowrap"
            >
              <i className="fas fa-plus mr-1.5" /> Thêm khoa
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
              <FormField label="Trưởng khoa (chuyên ngành khoa này)">
                <select
                  className={inputClass}
                  value={form.head}
                  onChange={(e) => setForm((f) => ({ ...f, head: e.target.value }))}
                >
                  <option value="">Chưa có / Chưa phân công</option>
                  {deptTeachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.hoTen} ({formatTeacherCode(t.id)}) {t.education ? `— ${t.education}` : ''}
                    </option>
                  ))}
                </select>
                {deptTeachers.length === 0 ? (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5">
                    <i className="fas fa-exclamation-triangle shrink-0" />
                    <span>Khoa chưa có giáo viên nào trực thuộc. Vui lòng phân công giáo viên vào khoa trong <strong>Quản lý giáo viên</strong> trước.</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1">
                    * Chỉ giáo viên thuộc chuyên ngành <strong>{modal.dept?.name}</strong> mới có thể đảm nhận vai trò Trưởng khoa.
                  </p>
                )}
              </FormField>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs hover:shadow disabled:opacity-60 transition active:scale-[0.98]"
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
