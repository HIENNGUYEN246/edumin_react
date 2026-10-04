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

  // Calculate quick KPI statistics
  const stats = useMemo(() => {
    const total = meta.total || rows.length;
    let openCount = 0;
    let studyingCount = 0;
    let totalEnrolled = 0;
    rows.forEach((r) => {
      if (r.status === 'Đang mở') openCount++;
      if (r.status === 'Đang học') studyingCount++;
      totalEnrolled += r.enrolledCount || 0;
    });
    return { total, openCount, studyingCount, totalEnrolled };
  }, [meta.total, rows]);

  const hasActiveFilters = Boolean(searchText || selectedCourse || selectedDept || selectedStatus);
  const resetFilters = () => {
    setSearchText('');
    setSelectedCourse('');
    setSelectedDept('');
    setSelectedStatus('');
    setPage(1);
  };

  const STATUS_CONFIG = {
    'Đang mở': {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
      icon: 'fa-lock-open text-emerald-600',
    },
    'Đang học': {
      badge: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
      icon: 'fa-graduation-cap text-blue-600',
    },
    'Đã đóng': {
      badge: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
      icon: 'fa-lock text-amber-600',
    },
    'Đã hủy': {
      badge: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
      icon: 'fa-ban text-rose-600',
    },
    Nháp: {
      badge: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
      icon: 'fa-pen-ruler text-gray-500',
    },
  };

  const columns = [
    {
      key: 'id',
      header: 'Mã lớp HP',
      headerClassName: 'w-28 text-left',
      cellClassName: 'w-28 align-middle',
      render: (cls) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-indigo-50/90 text-indigo-700 text-xs font-mono font-bold border border-indigo-150 shadow-2xs">
          {cls.id}
        </span>
      ),
    },
    {
      key: 'course',
      header: 'Môn học & Tín chỉ',
      headerClassName: 'min-w-[220px] text-left',
      cellClassName: 'min-w-[220px] align-middle',
      render: (cls) => (
        <div className="space-y-1 py-0.5">
          <div className="font-bold text-gray-900 text-sm leading-snug">
            {cls.courseName || cls.courseId}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span className="font-mono text-[11px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
              {cls.courseId}
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/70">
              {cls.credits} tín chỉ
            </span>
            {cls.department && (
              <span className="text-[11px] text-gray-500 truncate max-w-[150px]" title={cls.department}>
                • {cls.department}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Giảng viên phụ trách',
      headerClassName: 'min-w-[190px] text-left',
      cellClassName: 'min-w-[190px] align-middle',
      render: (cls) => {
        const teacher = cls.teacherRef;
        if (!cls.teacher && !teacher) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
              <i className="far fa-user text-amber-500 text-[10px]" />
              <span>Chưa phân công</span>
            </span>
          );
        }
        return (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar src={teacher?.avatar?.url || teacher?.avatar} name={cls.teacher || teacher?.hoTen || 'GV'} size={34} />
            <div className="min-w-0">
              <div className="font-semibold text-xs text-gray-900 truncate">{cls.teacher || teacher?.hoTen}</div>
              <div className="text-[11px] text-gray-400 truncate">{teacher?.email || teacher?.department || ''}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'schedule',
      header: 'Lịch học & Địa điểm',
      headerClassName: 'min-w-[260px] text-left',
      cellClassName: 'min-w-[260px] align-middle',
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
      headerClassName: 'w-36 text-left',
      cellClassName: 'w-36 align-middle',
      render: (cls) => {
        const enrolled = cls.enrolledCount || 0;
        const capacity = cls.capacity || 0;
        const percent = capacity > 0 ? Math.min(Math.round((enrolled / capacity) * 100), 100) : 0;
        const isFull = capacity > 0 && enrolled >= capacity;

        return (
          <div className="space-y-1.5 py-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-900">
                {enrolled} <span className="text-gray-400 font-normal">/ {capacity || '∞'} SV</span>
              </span>
              <button
                type="button"
                onClick={() => setStudentsOf({ id: cls.id, name: `${cls.courseName} (${cls.id})` })}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
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
      key: 'status',
      header: 'Trạng thái',
      headerClassName: 'w-36 text-center',
      cellClassName: 'w-36 text-center align-middle',
      render: (cls) => {
        const config = STATUS_CONFIG[cls.status] || STATUS_CONFIG.Nháp;
        return (
          <div className="relative inline-flex items-center justify-center">
            <select
              value={cls.status}
              onChange={(e) => handleChangeStatus(cls, e.target.value)}
              className={`appearance-none text-xs font-bold pl-7 pr-6 py-1.5 rounded-xl cursor-pointer transition border shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-300 ${config.badge}`}
              title="Nhấp để chuyển trạng thái lớp học phần"
            >
              {CLASS_STATUSES.map((st) => (
                <option key={st} value={st} className="bg-white text-gray-800 font-medium">
                  {st}
                </option>
              ))}
            </select>
            <i className={`fas ${config.icon} absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none`} />
            <i className="fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none opacity-50" />
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'w-28 text-right',
      cellClassName: 'w-28 text-right align-middle',
      render: (cls) => (
        <div className="flex items-center justify-end gap-1.5 py-0.5">
          <button
            type="button"
            onClick={() => setStudentsOf({ id: cls.id, name: `${cls.courseName} (${cls.id})` })}
            className="w-8 h-8 rounded-xl bg-gray-50 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 flex items-center justify-center text-xs transition border border-gray-200/80 shadow-2xs"
            title="Xem danh sách sinh viên đã đăng ký"
          >
            <i className="fas fa-users" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(cls)}
            className="w-8 h-8 rounded-xl bg-gray-50 text-blue-600 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center text-xs transition border border-gray-200/80 shadow-2xs"
            title="Chỉnh sửa lớp học phần"
          >
            <i className="fas fa-pen" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(cls)}
            className="w-8 h-8 rounded-xl bg-gray-50 text-rose-600 hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center text-xs transition border border-gray-200/80 shadow-2xs"
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

      {/* Quick KPI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-chalkboard-user" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-400 font-medium">Tổng lớp học phần</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-door-open" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-600">{stats.openCount}</div>
            <div className="text-xs text-gray-400 font-medium">Đang mở đăng ký</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-graduation-cap" />
          </div>
          <div>
            <div className="text-xl font-bold text-blue-600">{stats.studyingCount}</div>
            <div className="text-xs text-gray-400 font-medium">Đang giảng dạy</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-user-check" />
          </div>
          <div>
            <div className="text-xl font-bold text-purple-600">{stats.totalEnrolled}</div>
            <div className="text-xs text-gray-400 font-medium">Lượt SV đăng ký</div>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
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
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[200px]"
            title="Lọc theo môn học"
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
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[180px]"
            title="Lọc theo khoa"
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
            title="Lọc theo trạng thái"
          >
            <option value="">-- Tất cả trạng thái --</option>
            {CLASS_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/80 transition flex items-center gap-1.5"
              title="Xóa bộ lọc"
            >
              <i className="fas fa-rotate-left text-[11px]" />
              <span>Đặt lại</span>
            </button>
          )}
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
