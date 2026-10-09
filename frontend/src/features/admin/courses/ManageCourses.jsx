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
import { formatCurrency, DEFAULT_GRADE_WEIGHTS, GRADE_COMPONENTS } from '../../../lib/format.js';
import { readSheet, exportSheet } from '../../../lib/excel.js';
import { useDepartments } from '../departments/useDepartments.js';
import { useCourses, useCourseMutations } from './useCourses.js';
import { coursesApi } from '../../../api/coursesApi.js';

const EMPTY = { id: '', name: '', credits: 0, fee: 0, departmentId: '', gradeWeights: { ...DEFAULT_GRADE_WEIGHTS } };

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
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  useEffect(() => {
    setSelectedIds([]);
    setLastClickedIndex(null);
  }, [page, search]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const departments = deptData?.data || [];

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

  const handleRowCheckboxClick = (e, course, rowIndex) => {
    e.stopPropagation();

    if (e.shiftKey) {
      window.getSelection?.()?.removeAllRanges?.();
    }

    const index = typeof rowIndex === 'number' ? rowIndex : rows.findIndex((r) => r._id === course._id);
    const isCurrentlyChecked = selectedIds.includes(course._id);
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
        setSelectedIds((prev) => (prev.includes(course._id) ? prev : [...prev, course._id]));
      } else {
        setSelectedIds((prev) => prev.filter((id) => id !== course._id));
      }
    }

    setLastClickedIndex(index >= 0 ? index : null);
  };


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
      gradeWeights: course.gradeWeights ? { ...DEFAULT_GRADE_WEIGHTS, ...course.gradeWeights } : { ...DEFAULT_GRADE_WEIGHTS },
    });
    setErrors({});
    setModal({ mode: 'edit', course });
  };

  const totalWeight = useMemo(() => {
    const weights = form.gradeWeights || DEFAULT_GRADE_WEIGHTS;
    return Object.values(weights).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [form.gradeWeights]);

  const handleGradeWeightChange = (key, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setForm((f) => ({
      ...f,
      gradeWeights: {
        ...(f.gradeWeights || DEFAULT_GRADE_WEIGHTS),
        [key]: num,
      },
    }));
    if (errors.gradeWeights) setErrors((prev) => ({ ...prev, gradeWeights: '' }));
  };

  const applyWeightPreset = (preset) => {
    setForm((f) => ({
      ...f,
      gradeWeights: { ...preset },
    }));
    if (errors.gradeWeights) setErrors((prev) => ({ ...prev, gradeWeights: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (modal.mode === 'create' && !form.id.trim()) next.id = 'Mã môn học là bắt buộc';
    if (!form.name.trim()) next.name = 'Tên môn học là bắt buộc';
    if (totalWeight !== 100) {
      next.gradeWeights = `Tổng trọng số các cột điểm phải bằng đúng 100% (hiện tại: ${totalWeight}%)`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      name: form.name.trim(),
      credits: Number(form.credits) || 0,
      fee: Number(form.fee) || 0,
      departmentId: form.departmentId,
      gradeWeights: form.gradeWeights || DEFAULT_GRADE_WEIGHTS,
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
      if (result.failed?.length) {
        const details = result.failed.slice(0, 3).map((item) => `Dòng ${item.row}: ${item.message}`).join(' · ');
        toast.error(`Đã nhập ${result.created} học phần, ${result.failed.length} lỗi. ${details}`, 8000);
      } else {
        toast.success(`Đã nhập ${result.created} học phần`);
      }
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
    render: (c, rowIndex) => (
      <div className="flex items-center justify-center select-none" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.includes(c._id)}
          onChange={() => {}}
          onClick={(e) => handleRowCheckboxClick(e, c, rowIndex)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          aria-label={`Chọn môn học ${c.name}`}
        />
      </div>
    ),
  };

  const baseColumns = [
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
      className: 'text-right w-20',
      render: (c) => (
        <div className="flex justify-end gap-1.5">
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

  const columns = [selectionColumn, ...baseColumns];

  return (
    <div>
      <PageHeader
        title="Quản lý Môn học"
        subtitle="Quản lý danh mục môn học, số tín chỉ, học phí định mức và khoa đào tạo"
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
            />
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

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-indigo-950">
              Đang chọn <strong className="text-indigo-700">{selectedIds.length}</strong> môn học
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
              onClick={onBulkDelete}
              disabled={bulkDelete?.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition"
            >
              <i className="fas fa-trash-alt text-[11px]" />
              <span>{bulkDelete?.isPending ? 'Đang xóa...' : `Xóa ${selectedIds.length} môn học đã chọn`}</span>
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyText="Chưa có môn học nào trong danh mục"
        onRowClick={(c) => navigate(`/admin/courses/${c._id}`)}
        rowClassName={(c) => (selectedIds.includes(c._id) ? 'bg-indigo-50/40' : '')}
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


      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Thêm môn học mới' : 'Sửa thông tin môn học'} size="xl">
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
            <div className="md:col-span-2">
              <FormField label="Khoa">
                <select className={inputClass} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
                  <option value="">Chọn khoa</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="md:col-span-2 bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <i className="fas fa-sliders text-indigo-500" />
                  <span>Cấu hình trọng số điểm mặc định (%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    totalWeight === 100
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    Tổng: {totalWeight}% {totalWeight === 100 ? '✓ Hợp lệ' : '(Cần đúng 100%)'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                <span className="text-slate-500 font-medium">Mẫu nhanh:</span>
                <button
                  type="button"
                  onClick={() => applyWeightPreset({ attendance: 10, homework: 10, midterm: 30, presentation: 0, final: 50 })}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Chuẩn (10-10-30-50)
                </button>
                <button
                  type="button"
                  onClick={() => applyWeightPreset({ attendance: 10, homework: 0, midterm: 40, presentation: 0, final: 50 })}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  3 cột (10-40-50)
                </button>
                <button
                  type="button"
                  onClick={() => applyWeightPreset({ attendance: 10, homework: 10, midterm: 20, presentation: 20, final: 40 })}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Có thuyết trình (10-10-20-20-40)
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {GRADE_COMPONENTS.map((comp) => (
                  <div key={comp.key} className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 truncate" title={comp.label}>
                      {comp.label}
                    </label>
                    <div className="relative">
                      <input
                        aria-label={`Trọng số ${comp.label}`}
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        className="w-full text-center font-bold text-sm text-slate-800 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1.5 px-2 outline-hidden transition"
                        value={form.gradeWeights?.[comp.key] ?? 0}
                        onChange={(e) => handleGradeWeightChange(comp.key, e.target.value)}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">%</span>
                    </div>
                  </div>
                ))}
              </div>

              {errors.gradeWeights && (
                <p className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1">
                  <i className="fas fa-circle-exclamation" /> {errors.gradeWeights}
                </p>
              )}
            </div>

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
