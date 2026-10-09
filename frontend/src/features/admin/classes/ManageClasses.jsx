import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { formatCurrency } from '../../../lib/format.js';
import { departmentsApi } from '../../../api/departmentsApi.js';
import { classesApi } from '../../../api/classesApi.js';
import { useCourses, useCourseMutations } from '../courses/useCourses.js';

export function ManageClasses() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedDept, setSelectedDept] = useState('');

  const params = useMemo(
    () => ({ page, limit: 10, search, department: selectedDept || undefined }),
    [page, search, selectedDept]
  );
  const { data: courseData, isLoading } = useCourses(params);
  const courses = courseData?.data || [];
  const meta = courseData?.meta || { page: 1, pages: 1, total: 0 };
  const { data: departmentData } = useQuery({
    queryKey: ['departments', { limit: 100 }],
    queryFn: () => departmentsApi.list({ limit: 100 }),
  });
  const departments = departmentData?.data || [];
  const { data: classData } = useQuery({
    queryKey: ['classes', { page: 1, limit: 100 }],
    queryFn: () => classesApi.list({ page: 1, limit: 100 }),
  });
  const classRows = useMemo(() => classData?.data || [], [classData]);
  const { remove } = useCourseMutations();

  const stats = useMemo(() => {
    const openCount = classRows.filter((cls) => cls.status === 'Đang mở').length;
    const studyingCount = classRows.filter((cls) => cls.status === 'Đang học').length;
    const totalEnrolled = classRows.reduce((total, cls) => total + (cls.enrolledCount || 0), 0);
    return { total: classData?.meta?.total ?? classRows.length, openCount, studyingCount, totalEnrolled };
  }, [classData, classRows]);

  const onDelete = async (course) => {
    const ok = await confirm({
      title: 'Xóa học phần',
      message: `Bạn có chắc muốn xóa học phần "${course.id} - ${course.name}"? Học phần đang có lớp mở sẽ không thể xóa.`,
      confirmText: 'Xóa học phần',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await remove.mutateAsync(course._id);
      toast.success('Đã xóa học phần');
    } catch (error) {
      toast.error(error.message || 'Không thể xóa học phần');
    }
  };

  const hasActiveFilters = Boolean(searchText || selectedDept);
  const resetFilters = () => {
    setSearchText('');
    setSelectedDept('');
    setPage(1);
  };

  const columns = [
    {
      key: 'id',
      header: 'Mã môn',
      className: 'font-semibold text-gray-800 whitespace-nowrap',
      render: (course) => (
        <span className="inline-flex items-center gap-1.5 font-mono">
          {course.id}
          <i className="fas fa-arrow-up-right-from-square text-[10px] text-gray-300" />
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên môn học',
      className: 'font-bold text-gray-900',
      render: (course) => <span className="truncate max-w-[280px] block" title={course.name}>{course.name}</span>,
    },
    { key: 'credits', header: 'Tín chỉ', className: 'text-center font-semibold' },
    { key: 'fee', header: 'Học phí định mức', render: (course) => formatCurrency(course.fee) },
    {
      key: 'department',
      header: 'Khoa phụ trách',
      render: (course) => course.department
        ? <span className="truncate max-w-[200px] block" title={course.department}>{course.department}</span>
        : <span className="text-gray-400">Chưa xác định</span>,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right w-20',
      render: (course) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => navigate(`/admin/classes/course/${course._id}`)}
            className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center justify-center border border-indigo-200"
            aria-label={`Xem lớp học phần của ${course.name}`}
            title="Xem lớp học phần của môn này"
          >
            <i className="fas fa-chalkboard-user text-xs" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(course)}
            className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center border border-gray-200"
            aria-label={`Xóa học phần ${course.name}`}
            title="Xóa học phần"
          >
            <i className="fas fa-trash-alt text-xs" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Lớp học phần"
        subtitle="Danh sách học phần từ danh mục; chọn một học phần để quản lý các lớp được mở"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-chalkboard-user" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-400 font-medium">Tổng lớp học phần</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-door-open" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-600">{stats.openCount}</div>
            <div className="text-xs text-slate-400 font-medium">Đang mở đăng ký</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-graduation-cap" />
          </div>
          <div>
            <div className="text-xl font-bold text-blue-600">{stats.studyingCount}</div>
            <div className="text-xs text-slate-400 font-medium">Đang giảng dạy</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
            <i className="fas fa-user-check" />
          </div>
          <div>
            <div className="text-xl font-bold text-purple-600">{stats.totalEnrolled}</div>
            <div className="text-xs text-slate-400 font-medium">Lượt SV đăng ký</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[260px] max-w-lg">
          <SearchInput
            className="w-full"
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              setPage(1);
            }}
            placeholder="Tìm theo mã môn hoặc tên môn học..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDept}
            onChange={(event) => {
              setSelectedDept(event.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[220px]"
            title="Lọc theo khoa"
          >
            <option value="">-- Tất cả khoa --</option>
            {departments.map((department) => (
              <option key={department.id} value={department.name}>{department.name}</option>
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

      <DataTable
        columns={columns}
        rows={courses}
        rowKey={(course) => course._id || course.id}
        isLoading={isLoading}
        emptyText="Không có học phần nào phù hợp điều kiện lọc."
      />
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        onPageChange={setPage}
      />
    </div>
  );
}

export default ManageClasses;
