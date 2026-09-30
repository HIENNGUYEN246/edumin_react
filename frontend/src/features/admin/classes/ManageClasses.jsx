import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { SchedulePicker } from '../../../components/schedule/SchedulePicker.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { describeSchedules } from '../../../lib/schedule.js';
import { formatTeacherCode } from '../../../lib/format.js';
import { coursesApi } from '../../../api/coursesApi.js';
import { teachersApi } from '../../../api/teachersApi.js';
import { useClasses, useClassMutations } from './useClasses.js';

const EMPTY = {
  id: '',
  courseId: '',
  teacherId: '',
  room: '',
  schedules: [],
  studyStart: '',
  studyEnd: '',
  start: '',
  end: '',
  status: 'Đang mở',
};

export function ManageClasses() {
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const params = useMemo(() => ({ page, limit: 10, search }), [page, search]);
  const { data, isLoading } = useClasses(params);
  const { create, update, remove } = useClassMutations();
  const { data: courseData } = useQuery({ queryKey: ['courses', { limit: 500 }], queryFn: () => coursesApi.list({ limit: 500 }) });
  const { data: teacherData } = useQuery({ queryKey: ['teachers', { limit: 500 }], queryFn: () => teachersApi.list({ limit: 500 }) });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const courses = courseData?.data || [];
  const teachers = teacherData?.data || [];

  const openCreate = () => {
    setForm(EMPTY);
    setErrors({});
    setModal({ mode: 'create' });
  };
  const openEdit = (cls) => {
    setForm({
      id: cls.id,
      courseId: cls.courseId,
      teacherId: cls.teacherId || '',
      room: cls.room || '',
      schedules: cls.schedules || [],
      studyStart: cls.studyStart || '',
      studyEnd: cls.studyEnd || '',
      start: cls.start || '',
      end: cls.end || '',
      status: cls.status || 'Đang mở',
    });
    setErrors({});
    setModal({ mode: 'edit', cls });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (modal.mode === 'create' && !form.id.trim()) next.id = 'Mã lớp là bắt buộc';
    if (!form.courseId) next.courseId = 'Chọn học phần';
    if (!form.schedules.length) next.schedules = 'Chọn ít nhất một buổi học';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      courseId: form.courseId,
      teacherId: form.teacherId ? Number(form.teacherId) : null,
      room: form.room.trim(),
      schedules: form.schedules,
      studyStart: form.studyStart,
      studyEnd: form.studyEnd,
      start: form.start,
      end: form.end,
      status: form.status,
    };
    try {
      if (modal.mode === 'create') {
        await create.mutateAsync({ id: form.id.trim(), ...payload });
        toast.success('Đã mở lớp học phần');
      } else {
        await update.mutateAsync({ id: modal.cls._id, ...payload });
        toast.success('Đã cập nhật lớp');
      }
      setModal(null);
    } catch (error) {
      if (error.code === 'CONFLICT') toast.error(error.message, 5000);
      else if (error.code === 'DUPLICATE_KEY') setErrors({ id: 'Mã lớp đã tồn tại' });
      else toast.error(error.message);
    }
  };

  const onDelete = async (cls) => {
    const ok = await confirm({ title: 'Xóa lớp', message: `Xóa lớp "${cls.id}"? Các đăng ký của sinh viên sẽ bị xóa.`, confirmText: 'Xóa' });
    if (!ok) return;
    try {
      await remove.mutateAsync(cls._id);
      toast.success('Đã xóa lớp');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'id', header: 'Mã lớp', className: 'font-semibold text-gray-800' },
    { key: 'courseName', header: 'Học phần' },
    { key: 'teacher', header: 'Giáo viên', render: (c) => c.teacher || <span className="text-gray-400">—</span> },
    { key: 'room', header: 'Phòng' },
    { key: 'schedules', header: 'Lịch học', render: (c) => <span className="text-xs">{describeSchedules(c.schedules)}</span> },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (c) => (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.status === 'Đang mở' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'}`}>
          {c.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-24',
      render: (c) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" aria-label="Sửa">
            <i className="fas fa-pen" />
          </button>
          <button type="button" onClick={() => onDelete(c)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" aria-label="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quản lý đăng ký"
        subtitle="Mở lớp học phần, xếp lịch và phòng học"
        actions={
          <>
            <SearchInput value={searchText} onChange={(v) => { setSearchText(v); setPage(1); }} />
            <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
              <i className="fas fa-plus mr-1.5" /> Mở lớp
            </button>
          </>
        }
      />

      <DataTable columns={columns} rows={rows} isLoading={isLoading} emptyText="Chưa có lớp học phần" />
      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onPageChange={setPage} />

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Mở lớp học phần' : 'Sửa lớp học phần'} size="lg">
        {modal && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Mã lớp" error={errors.id} required>
                <input className={inputClass} value={form.id} disabled={modal.mode === 'edit'} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="VD: IT101-01" />
              </FormField>
              <FormField label="Học phần" error={errors.courseId} required>
                <select className={inputClass} value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
                  <option value="">Chọn học phần</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Giáo viên">
                <select className={inputClass} value={form.teacherId} onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}>
                  <option value="">Chưa phân công</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t.id}>{t.hoTen} ({formatTeacherCode(t.id)})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Phòng học">
                <input className={inputClass} value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="VD: A101" />
              </FormField>
              <FormField label="Bắt đầu học">
                <input type="date" className={inputClass} value={form.studyStart} onChange={(e) => setForm((f) => ({ ...f, studyStart: e.target.value }))} />
              </FormField>
              <FormField label="Kết thúc học">
                <input type="date" className={inputClass} value={form.studyEnd} onChange={(e) => setForm((f) => ({ ...f, studyEnd: e.target.value }))} />
              </FormField>
              <FormField label="Mở đăng ký từ">
                <input type="datetime-local" className={inputClass} value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
              </FormField>
              <FormField label="Đóng đăng ký">
                <input type="datetime-local" className={inputClass} value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
              </FormField>
            </div>

            <FormField label="Lịch học" error={errors.schedules} required>
              <SchedulePicker value={form.schedules} onChange={(schedules) => setForm((f) => ({ ...f, schedules }))} />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Hủy</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">Lưu</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ManageClasses;
