import { useEffect, useMemo, useState } from 'react';
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = useDepartments(params);
  const { create, update, remove, bulkRemove } = useDepartmentMutations();

  useEffect(() => {
    setSelectedIds([]);
    setLastClickedIndex(null);
  }, [page, search]);

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

  const allCurrentRowIds = rows.map((r) => r._id);
  const isAllSelected = rows.length > 0 && allCurrentRowIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = rows.length > 0 && allCurrentRowIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  const handleSelectAll = () => {
    setLastClickedIndex(null);
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allCurrentRowIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allCurrentRowIds])));
    }
  };

  const handleRowCheckboxClick = (e, dept, rowIndex) => {
    e.stopPropagation();

    if (e.shiftKey) {
      window.getSelection?.()?.removeAllRanges?.();
    }

    const index = typeof rowIndex === 'number' ? rowIndex : rows.findIndex((r) => r._id === dept._id);
    const isCurrentlyChecked = selectedIds.includes(dept._id);
    const targetChecked = !isCurrentlyChecked;

    if (e.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index && index >= 0) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeRows = rows.slice(start, end + 1);
      const rangeIds = rangeRows.map((r) => r._id);

      if (targetChecked) {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
      } else {
        setSelectedIds((prev) => prev.filter((id) => !rangeIds.includes(id)));
      }
    } else {
      if (targetChecked) {
        setSelectedIds((prev) => (prev.includes(dept._id) ? prev : [...prev, dept._id]));
      } else {
        setSelectedIds((prev) => prev.filter((id) => id !== dept._id));
      }
    }

    setLastClickedIndex(index >= 0 ? index : null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const ok = await confirm({
      title: 'Xóa nhiều khoa đã chọn',
      message: `Bạn có chắc chắn muốn xóa ${count} khoa đã chọn? Giáo viên, sinh viên và học phần thuộc các khoa này sẽ chuyển sang "Chưa xác định".`,
      confirmText: `Xóa ${count} khoa`,
      tone: 'danger',
    });
    if (!ok) return;

    try {
      if (bulkRemove) {
        await bulkRemove.mutateAsync(selectedIds);
      } else {
        await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
      }
      toast.success(`Đã xóa thành công ${count} khoa`);
      setSelectedIds([]);
      setLastClickedIndex(null);
    } catch (error) {
      toast.error(error.message || 'Lỗi khi xóa khoa');
    }
  };

  const onDelete = async (dept) => {
    const ok = await confirm({
      title: 'Xóa khoa',
      message: `Xóa khoa "${dept.name}"? Giáo viên, sinh viên và học phần thuộc khoa sẽ chuyển sang "Chưa xác định".`,
      confirmText: 'Xóa',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(dept._id);
      setSelectedIds((prev) => prev.filter((id) => id !== dept._id));
      toast.success('Đã xóa khoa');
    } catch (error) {
      toast.error(error.message);
    }
  };

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
    render: (dept, rowIndex) => (
      <div className="flex items-center justify-center select-none" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.includes(dept._id)}
          onChange={() => {}}
          onClick={(e) => handleRowCheckboxClick(e, dept, rowIndex)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          aria-label={`Chọn khoa ${dept.name}`}
        />
      </div>
    ),
  };

  const baseColumns = [
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

  const columns = [selectionColumn, ...baseColumns];

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
                setSelectedIds([]);
                setLastClickedIndex(null);
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

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-indigo-950">
              Đang chọn <strong className="text-indigo-700">{selectedIds.length}</strong> khoa
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setLastClickedIndex(null);
              }}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkRemove?.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition"
            >
              <i className="fas fa-trash-alt text-[11px]" />
              <span>{bulkRemove?.isPending ? 'Đang xóa...' : `Xóa ${selectedIds.length} khoa đã chọn`}</span>
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyText="Chưa có khoa nào"
        rowClassName={(dept) => (selectedIds.includes(dept._id) ? 'bg-indigo-50/40' : '')}
      />
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        onPageChange={(p) => {
          setSelectedIds([]);
          setLastClickedIndex(null);
          setPage(p);
        }}
      />


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
