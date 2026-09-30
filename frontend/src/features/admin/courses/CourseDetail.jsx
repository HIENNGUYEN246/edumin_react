import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { formatCurrency } from '../../../lib/format.js';
import { describeSchedules } from '../../../lib/schedule.js';
import { coursesApi } from '../../../api/coursesApi.js';
import { CLASS_STATUSES } from '../../../api/classesApi.js';
import { useCourseClasses, useClassMutations } from '../classes/useClasses.js';
import { ClassStatusBadge } from '../classes/ClassStatusBadge.jsx';
import { ClassFormModal } from '../classes/ClassFormModal.jsx';
import { ClassStudentsModal } from '../classes/ClassStudentsModal.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';

export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const courseQuery = useQuery({ queryKey: ['courses', id, 'detail'], queryFn: () => coursesApi.get(id) });
  const course = courseQuery.data;
  const { data: classData, isLoading: classesLoading } = useCourseClasses(course?.id);
  const { create, update, changeStatus, remove } = useClassMutations();

  const [formModal, setFormModal] = useState(null); // {mode, initial?}
  const [studentsOf, setStudentsOf] = useState(null);

  const classes = classData?.data || [];

  const openCreate = () => setFormModal({ mode: 'create' });
  const openEdit = (cls) =>
    setFormModal({
      mode: 'edit',
      cls,
      initial: {
        id: cls.id,
        courseId: course.id,
        teacherId: cls.teacherId || '',
        room: cls.room || '',
        capacity: cls.capacity || 0,
        schedules: cls.schedules || [],
        studyStart: cls.studyStart || '',
        studyEnd: cls.studyEnd || '',
        status: cls.status || 'Nháp',
      },
    });

  const handleSubmit = async (payload, setErrors) => {
    try {
      if (formModal.mode === 'create') {
        await create.mutateAsync(payload);
        toast.success('Đã thêm lớp');
      } else {
        // Drop the class code from the edit payload; the id below is the Mongo _id.
        const { id: _code, ...changes } = payload;
        void _code;
        await update.mutateAsync({ id: formModal.cls._id, ...changes });
        toast.success('Đã cập nhật lớp');
      }
      setFormModal(null);
    } catch (error) {
      if (error.code === 'DUPLICATE_KEY') setErrors({ id: 'Mã lớp đã tồn tại' });
      else toast.error(error.message, 5000);
    }
  };

  const onChangeStatus = async (cls, status) => {
    try {
      await changeStatus.mutateAsync({ id: cls._id, status });
      toast.success(`Đã chuyển "${cls.id}" sang ${status}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onDelete = async (cls) => {
    const ok = await confirm({
      title: 'Xóa lớp',
      message: `Xóa lớp "${cls.id}"? Các đăng ký của sinh viên trong lớp sẽ bị xóa.`,
      confirmText: 'Xóa',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(cls._id);
      toast.success('Đã xóa lớp');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (courseQuery.isLoading) return <Spinner />;
  if (courseQuery.isError) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
        <p className="text-gray-600">{courseQuery.error.message || 'Không tìm thấy học phần.'}</p>
        <button type="button" onClick={() => navigate('/admin/courses')} className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Quay lại
        </button>
      </div>
    );
  }

  const columns = [
    { key: 'id', header: 'Mã lớp', className: 'font-semibold text-gray-800' },
    {
      key: 'teacher',
      header: 'Giáo viên',
      render: (c) =>
        c.teacher ? (
          <div className="flex items-center gap-2">
            <Avatar src={c.teacherRef?.avatar?.url || c.teacherRef?.avatar} name={c.teacher} size={28} />
            <span className="font-semibold text-gray-800 text-xs">{c.teacher}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs italic">Chưa phân công</span>
        ),
    },
    { key: 'schedules', header: 'Lịch học', render: (c) => <span className="text-xs">{describeSchedules(c.schedules)}</span> },
    { key: 'room', header: 'Phòng' },
    {
      key: 'capacity',
      header: 'Sĩ số',
      render: (c) => (
        <span className={c.capacity > 0 && c.enrolledCount >= c.capacity ? 'text-red-600 font-semibold' : ''}>
          {c.enrolledCount}
          {c.capacity > 0 ? `/${c.capacity}` : ''}
        </span>
      ),
    },
    { key: 'status', header: 'Trạng thái', render: (c) => <ClassStatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-64',
      render: (c) => (
        <div className="flex justify-end items-center gap-2">
          <select
            value={c.status}
            onChange={(e) => onChangeStatus(c, e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            title="Đổi trạng thái"
          >
            {CLASS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setStudentsOf(c)} className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100" title="Sinh viên">
            <i className="fas fa-users" />
          </button>
          <button type="button" onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Sửa">
            <i className="fas fa-pen" />
          </button>
          <button type="button" onClick={() => onDelete(c)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" title="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/admin/courses')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600 mb-4"
      >
        <i className="fas fa-arrow-left" /> Quản lý học phần
      </button>

      {/* Course info */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">{course.id}</p>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{course.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{course.department || 'Chưa xác định khoa'}</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-400">Tín chỉ</p>
              <p className="text-lg font-bold text-gray-800">{course.credits}</p>
            </div>
            <div>
              <p className="text-gray-400">Học phí</p>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(course.fee)}</p>
            </div>
            <div>
              <p className="text-gray-400">Số lớp</p>
              <p className="text-lg font-bold text-gray-800">{classes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Classes */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">Các lớp học phần</h2>
        <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <i className="fas fa-plus mr-1.5" /> Thêm lớp
        </button>
      </div>

      <DataTable columns={columns} rows={classes} isLoading={classesLoading} emptyText="Học phần chưa có lớp nào" />

      {formModal && (
        <ClassFormModal
          open
          mode={formModal.mode}
          courseId={course.id}
          initial={formModal.initial}
          onClose={() => setFormModal(null)}
          onSubmit={handleSubmit}
          saving={create.isPending || update.isPending}
        />
      )}

      {studentsOf && (
        <ClassStudentsModal classId={studentsOf._id} className={studentsOf.id} onClose={() => setStudentsOf(null)} />
      )}
    </div>
  );
}

export default CourseDetail;
