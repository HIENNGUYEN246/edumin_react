import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { describeSchedules } from '../../../lib/schedule.js';
import { formatDate } from '../../../lib/format.js';
import { coursesApi } from '../../../api/coursesApi.js';
import { departmentsApi } from '../../../api/departmentsApi.js';
import { CLASS_STATUSES } from '../../../api/classesApi.js';
import { useClasses, useClassMutations } from './useClasses.js';
import { ClassStatusBadge } from './ClassStatusBadge.jsx';
import { ClassFormModal } from './ClassFormModal.jsx';
import { ClassStudentsModal } from './ClassStudentsModal.jsx';
import { ScheduleRoomBadge } from '../../../components/schedule/ScheduleBadge.jsx';

export function ManageClasses() {
  const toast = useToast();
  const confirm = useConfirm();

  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  const [formModal, setFormModal] = useState(null); // { mode, cls?, initial? }
  const [studentsOf, setStudentsOf] = useState(null); // { id, name }

  // Query filter options
  const { data: coursesData } = useQuery({
    queryKey: ['courses', { limit: 500 }],
    queryFn: () => coursesApi.list({ limit: 500 }),
  });
  const courses = coursesData?.data || [];

  const { data: deptsData } = useQuery({
    queryKey: ['departments', { limit: 100 }],
    queryFn: () => departmentsApi.list({ limit: 100 }),
  });
  const departments = deptsData?.data || [];

  // Query classes list
  const params = useMemo(
    () => ({
      page,
      limit: 10,
      search: search || undefined,
      courseId: selectedCourse || undefined,
      status: selectedStatus || undefined,
      department: selectedDept || undefined,
    }),
    [page, search, selectedCourse, selectedStatus, selectedDept]
  );

  const { data, isLoading } = useClasses(params);
  const { create, update, changeStatus, remove } = useClassMutations();

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };

  const openCreate = () => setFormModal({ mode: 'create' });

  const openEdit = (cls) =>
    setFormModal({
      mode: 'edit',
      cls,
      initial: {
        id: cls.id,
        courseId: cls.courseId,
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
        toast.success('Đã mở lớp học phần mới');
      } else {
        const { id: _code, ...changes } = payload;
        void _code;
        await update.mutateAsync({ id: formModal.cls._id, ...changes });
        toast.success('Đã cập nhật thông tin lớp học phần');
      }
      setFormModal(null);
    } catch (error) {
      if (error.code === 'DUPLICATE_KEY') setErrors({ id: 'Mã lớp học phần đã tồn tại' });
      else toast.error(error.message, 5000);
    }
  };

  const handleChangeStatus = async (cls, status) => {
    try {
      await changeStatus.mutateAsync({ id: cls._id, status });
      toast.success(`Đã chuyển lớp "${cls.id}" sang trạng thái ${status}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (cls) => {
    const ok = await confirm({
      title: 'Xóa lớp học phần',
      message: `Bạn có chắc muốn xóa lớp "${cls.id} - ${cls.courseName}"? Danh sách đăng ký của sinh viên trong lớp này cũng sẽ bị hủy.`,
      confirmText: 'Xóa lớp',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(cls._id);
      toast.success('Đã xóa lớp học phần');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'Mã lớp HP',
      className: 'font-mono font-bold text-indigo-700 w-32',
      render: (cls) => (
        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
          {cls.id}
        </span>
      ),
    },
    {
      key: 'course',
      header: 'Môn học & Tín chỉ',
      render: (cls) => (
        <div>
          <div className="font-bold text-gray-900 leading-tight">
            {cls.courseName || cls.courseId}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
              {cls.courseId}
            </span>
            <span>•</span>
            <span className="text-indigo-600 font-semibold">{cls.credits} tín chỉ</span>
            {cls.department && (
              <>
                <span>•</span>
                <span className="text-gray-400 truncate max-w-[140px]">{cls.department}</span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Giảng viên phụ trách',
      render: (cls) => {
        const teacher = cls.teacherRef;
        if (!cls.teacher && !teacher) {
          return <span className="text-xs text-gray-400 italic">Chưa phân công</span>;
        }
        return (
          <div className="flex items-center gap-2.5">
            <Avatar src={teacher?.avatar?.url || teacher?.avatar} name={cls.teacher || 'GV'} size={32} />
            <div>
              <div className="font-medium text-xs text-gray-900">{cls.teacher || teacher?.hoTen}</div>
              <div className="text-[11px] text-gray-400">{teacher?.email || ''}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'schedule',
      header: 'Lịch học & Phòng',
      render: (cls) => (
        <ScheduleRoomBadge
          schedules={cls.schedules}
          room={cls.room}
          studyStart={cls.studyStart}
          studyEnd={cls.studyEnd}
        />
      ),
    },
    {
      key: 'enrollment',
      header: 'Sĩ số SV',
      className: 'w-36',
      render: (cls) => {
        const enrolled = cls.enrolledCount || 0;
        const capacity = cls.capacity || 0;
        const percent = capacity > 0 ? Math.min(Math.round((enrolled / capacity) * 100), 100) : 0;
        const isFull = capacity > 0 && enrolled >= capacity;

        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-900">
                {enrolled} <span className="text-gray-400 font-normal">/ {capacity || '∞'}</span>
              </span>
              <button
                type="button"
                onClick={() => setStudentsOf({ id: cls.id, name: `${cls.courseName} (${cls.id})` })}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                title="Xem danh sách sinh viên"
              >
                Xem DSSV
              </button>
            </div>
            {capacity > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isFull ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'dates',
      header: 'Thời gian học',
      render: (cls) => (
        cls.studyStart || cls.studyEnd ? (
          <div className="text-xs text-gray-600">
            <div>Từ: {formatDate(cls.studyStart) || '-'}</div>
            <div>Đến: {formatDate(cls.studyEnd) || '-'}</div>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">Theo học kỳ</span>
        )
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      className: 'text-center w-36',
      render: (cls) => (
        <div className="flex items-center justify-center gap-1.5">
          <ClassStatusBadge status={cls.status} />
          <select
            value={cls.status}
            onChange={(e) => handleChangeStatus(cls, e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            title="Đổi nhanh trạng thái"
          >
            {CLASS_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right w-28',
      render: (cls) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setStudentsOf({ id: cls.id, name: `${cls.courseName} (${cls.id})` })}
            className="w-8 h-8 rounded-lg bg-gray-50 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center text-xs transition border border-gray-200"
            title="Xem danh sách sinh viên đã đăng ký"
          >
            <i className="fas fa-users" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(cls)}
            className="w-8 h-8 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center justify-center text-xs transition border border-gray-200"
            title="Chỉnh sửa lớp học phần"
          >
            <i className="fas fa-pen" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(cls)}
            className="w-8 h-8 rounded-lg bg-gray-50 text-rose-600 hover:bg-rose-50 flex items-center justify-center text-xs transition border border-gray-200"
            title="Xóa lớp học phần"
          >
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Lớp học phần"
        subtitle="Quản lý các lớp học phần mở theo kỳ, phân công giảng viên, xếp phòng, lịch học và theo dõi sĩ số sinh viên"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
              title="Mở thêm một lớp học phần mới cho sinh viên đăng ký"
            >
              <i className="fas fa-plus-circle" />
              <span>Mở lớp học phần mới</span>
            </button>
          </div>
        }
      />

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <SearchInput
            value={searchText}
            onChange={(v) => {
              setSearchText(v);
              setPage(1);
            }}
            placeholder="Tìm theo mã lớp, tên môn học, giảng viên, phòng..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Course filter */}
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả môn học --</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name}
              </option>
            ))}
          </select>

          {/* Department filter */}
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả khoa --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả trạng thái --</option>
            {CLASS_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(cls) => cls._id || cls.id}
          emptyText="Chưa có lớp học phần nào phù hợp điều kiện lọc."
        />
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        pages={meta.pages}
        total={meta.total}
        onPageChange={(p) => setPage(p)}
      />

      {/* Form Modal: Create / Edit Class */}
      {formModal && (
        <ClassFormModal
          open={Boolean(formModal)}
          mode={formModal.mode}
          courseId={formModal.cls?.courseId}
          initial={formModal.initial}
          onClose={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Modal: View Enrolled Students */}
      {studentsOf && (
        <ClassStudentsModal
          classId={studentsOf.id}
          className={studentsOf.name}
          onClose={() => setStudentsOf(null)}
        />
      )}
    </div>
  );
}

export default ManageClasses;
