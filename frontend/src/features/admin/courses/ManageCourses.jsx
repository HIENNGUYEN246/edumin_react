import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { formatCurrency } from '../../../lib/format.js';
import { readSheet, exportSheet } from '../../../lib/excel.js';
import { useDepartments } from '../departments/useDepartments.js';
import { useCourses, useCourseMutations } from './useCourses.js';
import { coursesApi } from '../../../api/coursesApi.js';

const EMPTY = { id: '', name: '', credits: 0, fee: 0, departmentId: '' };

export function ManageCourses() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = useCourses(params);
  const { create, update, remove, bulkDelete, importRows } = useCourseMutations();
  const { data: deptData } = useDepartments({ limit: 100 });
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, search]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const departments = deptData?.data || [];

  const openCreate = () => {
    setForm(EMPTY);
    setErrors({});
    setModal({ mode: 'create' });
  };
  const openEdit = (course) => {
    setForm({
      id: course.id,
      name: course.name,
      credits: course.credits,
      fee: course.fee,
      departmentId: course.departmentRef?.id || '',
    });
    setErrors({});
    setModal({ mode: 'edit', course });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (modal.mode === 'create' && !form.id.trim()) next.id = 'Mã môn học là bắt buộc';
    if (!form.name.trim()) next.name = 'Tên môn học là bắt buộc';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      name: form.name.trim(),
      credits: Number(form.credits) || 0,
      fee: Number(form.fee) || 0,
      departmentId: form.departmentId,
    };
    try {
      if (modal.mode === 'create') {
        await create.mutateAsync({ id: form.id.trim(), ...payload });
        toast.success('Đã thêm môn học mới');
      } else {
        await update.mutateAsync({ id: modal.course._id, ...payload });
        toast.success('Đã cập nhật môn học');
      }
      setModal(null);
    } catch (error) {
      if (error.code === 'CONFLICT' || error.code === 'DUPLICATE_KEY') setErrors({ id: error.message });
      else toast.error(error.message);
    }
  };

  const onDelete = async (course) => {
    const ok = await confirm({ title: 'Xóa môn học', message: `Xóa môn học "${course.name}"?`, confirmText: 'Xóa', tone: 'danger' });
    if (!ok) return;
    try {
      await remove.mutateAsync(course._id);
      setSelectedIds((prev) => prev.filter((id) => id !== course._id));
      toast.success('Đã xóa môn học');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: 'Xóa nhiều học phần đã chọn',
      message: `Bạn có chắc muốn xóa ${selectedIds.length} học phần đã chọn? Lưu ý các học phần đang có lớp mở sẽ không thể xóa.`,
      confirmText: `Xóa ${selectedIds.length} học phần`,
      tone: 'danger',
    });
    if (!ok) return;
    try {
      if (bulkDelete) {
        await bulkDelete.mutateAsync(selectedIds);
      } else {
        await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
      }
      toast.success(`Đã xóa ${selectedIds.length} học phần`);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message || 'Lỗi khi xóa học phần');
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const sheetRows = await readSheet(file);
      const result = await importRows.mutateAsync(sheetRows);
      toast.success(`Đã nhập ${result.created} học phần${result.failed?.length ? `, ${result.failed.length} lỗi` : ''}`);
    } catch (error) {
      toast.error(error.message || 'Không đọc được tệp Excel');
    }
  };

  const onExport = async () => {
    try {
      const all = await coursesApi.list({ page: 1, limit: 1000 });
      const exportRows = (all.data || []).map((c) => ({
        Ma: c.id,
        Ten: c.name,
        SoTinChi: c.credits,
        HocPhi: c.fee,
        Khoa: c.department || '',
      }));
      await exportSheet(exportRows, { fileName: 'hoc-phan.xlsx' });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const columns = [
    {
      key: 'id',
      header: 'Mã môn',
      className: 'font-semibold text-indigo-700',
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 font-mono">
          {c.id}
          <i className="fas fa-arrow-up-right-from-square text-[10px] text-gray-300" />
        </span>
      ),
    },
    { key: 'name', header: 'Tên môn học', className: 'font-bold text-gray-900', render: (c) => <span className="truncate max-w-[280px] block" title={c.name}>{c.name}</span> },
    { key: 'credits', header: 'Tín chỉ', className: 'text-center font-semibold' },
    { key: 'fee', header: 'Học phí định mức', render: (c) => formatCurrency(c.fee) },
    { key: 'department', header: 'Khoa phụ trách', render: (c) => c.department ? <span className="truncate max-w-[200px] block" title={c.department}>{c.department}</span> : <span className="text-gray-400">Chưa xác định</span> },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right w-36',
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={stop(() => navigate(`/admin/courses/${c._id}`))}
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 border border-indigo-200"
            title="Xem danh sách lớp học phần của môn này"
          >
            <i className="fas fa-chalkboard-user text-xs" />
            <span>Lớp HP</span>
          </button>
          <button type="button" onClick={stop(() => openEdit(c))} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center justify-center border border-gray-200" aria-label="Sửa" title="Sửa môn học">
            <i className="fas fa-pen text-xs" />
          </button>
          <button type="button" onClick={stop(() => onDelete(c))} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center border border-gray-200" aria-label="Xóa" title="Xóa môn học">
            <i className="fas fa-trash-alt text-xs" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quản lý Môn học"
        subtitle="Quản lý danh mục môn học, số tín chỉ, học phí định mức và khoa đào tạo"
        actions={
          <>
            <SearchInput value={searchText} onChange={(v) => { setSearchText(v); setPage(1); }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs hover:shadow transition active:scale-[0.98]">
              <i className="fas fa-file-import mr-1.5" /> Nhập Excel
            </button>
            <button type="button" onClick={onExport} className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 shadow-xs hover:shadow transition active:scale-[0.98]">
              <i className="fas fa-file-export mr-1.5" /> Xuất Excel
            </button>
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs hover:shadow transition active:scale-[0.98] whitespace-nowrap">
              <i className="fas fa-plus mr-1.5" /> Thêm môn học
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImport} />
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyText="Chưa có môn học nào trong danh mục"
        onRowClick={(c) => navigate(`/admin/courses/${c._id}`)}
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
              <span>Xóa {selectedIds.length} môn học đã chọn</span>
            </button>
          </>
        }
      />
      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onPageChange={setPage} />

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Thêm môn học mới' : 'Sửa thông tin môn học'}>
        {modal && (
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Mã môn học" error={errors.id} required>
              <input className={inputClass} value={form.id} disabled={modal.mode === 'edit'} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="VD: IT101" />
            </FormField>
            <FormField label="Tên môn học" error={errors.name} required>
              <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="VD: Lập trình Web" />
            </FormField>
            <FormField label="Số tín chỉ">
              <input type="number" min="0" className={inputClass} value={form.credits} onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))} />
            </FormField>
            <FormField label="Học phí (VND)">
              <input type="number" min="0" className={inputClass} value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} />
            </FormField>
            <FormField label="Khoa">
              <select className={inputClass} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
                <option value="">Chọn khoa</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FormField>
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Hủy</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">Lưu</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ManageCourses;
