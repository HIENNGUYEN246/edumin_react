import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { ScheduleRoomBadge } from '../../../components/schedule/ScheduleBadge.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { classesApi } from '../../../api/classesApi.js';
import { departmentsApi } from '../../../api/departmentsApi.js';
import { attendanceApi } from '../../../api/attendanceApi.js';
import { ClassAttendanceDetail } from './ClassAttendanceDetail.jsx';

export function ManageAttendance() {
  const toast = useToast();

  // Active view: null = Class list (Trang chủ); Object = ClassAttendanceDetail
  const [selectedClass, setSelectedClass] = useState(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Data lists
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendances, setAttendances] = useState([]);

  // Filters for class list
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Load classes, departments and overall attendance overview
  const loadOverviewData = useCallback(async () => {
    try {
      setLoading(true);
      const [classRes, deptRes, attList] = await Promise.all([
        classesApi.list({ limit: 200 }).catch(() => ({ data: [] })),
        departmentsApi.list({ limit: 100 }).catch(() => ({ data: [] })),
        attendanceApi.getAll().catch(() => []),
      ]);

      setClasses(classRes?.data || []);
      setDepartments(deptRes?.data || []);
      setAttendances(Array.isArray(attList) ? attList : attList?.data || []);
    } catch {
      toast.error('Không thể tải danh sách lớp học phần');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  // Map attendance stats by class: { [classId]: { total, present, late, excused, absent, rate } }
  const attendanceByClass = useMemo(() => {
    const map = new Map();
    attendances.forEach((att) => {
      const classId = att.regId || att.courseId;
      if (!classId) return;

      if (!map.has(classId)) {
        map.set(classId, { total: 0, present: 0, late: 0, excused: 0, absent: 0 });
      }

      const item = map.get(classId);
      item.total += 1;
      if (att.status === 'Có mặt') item.present += 1;
      else if (att.status === 'Đi muộn') item.late += 1;
      else if (att.status === 'Vắng có phép') item.excused += 1;
      else if (att.status === 'Vắng mặt') item.absent += 1;
    });

    // Compute attendance rate for each
    const computedMap = {};
    map.forEach((stat, classId) => {
      const rate = stat.total > 0 ? Math.round(((stat.present + stat.late * 0.5) / stat.total) * 100) : 100;
      computedMap[classId] = { ...stat, rate };
    });

    return computedMap;
  }, [attendances]);

  // Global School Attendance Statistics
  const globalStats = useMemo(() => {
    const totalClasses = classes.length;
    const totalEnrolled = classes.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
    const totalAttendanceRecords = attendances.length;

    const present = attendances.filter((a) => a.status === 'Có mặt').length;
    const late = attendances.filter((a) => a.status === 'Đi muộn').length;
    const absent = attendances.filter((a) => a.status === 'Vắng mặt' || a.status === 'Vắng có phép').length;
    const avgRate = totalAttendanceRecords > 0
      ? Math.round(((present + late * 0.5) / totalAttendanceRecords) * 100)
      : 100;

    return {
      totalClasses,
      totalEnrolled,
      totalAttendanceRecords,
      avgRate,
      present,
      late,
      absent,
    };
  }, [classes, attendances]);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (filterDepartment !== 'all' && cls.department !== filterDepartment) {
        return false;
      }

      if (filterStatus !== 'all' && cls.status !== filterStatus) {
        return false;
      }

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const code = (cls.id || '').toLowerCase();
        const name = (cls.courseName || '').toLowerCase();
        const teacher = (cls.teacher || '').toLowerCase();
        const room = (cls.room || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !teacher.includes(q) && !room.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [classes, filterDepartment, filterStatus, debouncedSearch]);

  // Paginated rows
  const paginatedClasses = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClasses.slice(start, start + pageSize);
  }, [filteredClasses, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterDepartment, filterStatus, debouncedSearch, pageSize]);

  // Columns for classes data table
  const columns = useMemo(
    () => [
      {
        key: 'id',
        header: 'Lớp học phần',
        className: 'w-36',
        render: (cls) => (
          <div>
            <button
              type="button"
              onClick={() => setSelectedClass(cls)}
              className="font-mono text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition"
              title="Bấm để xem chi tiết điểm danh lớp này"
            >
              {cls.id}
            </button>
            {cls.className && (
              <span className="text-[11px] font-medium text-gray-700 truncate max-w-[150px] block mt-1" title={cls.className}>
                {cls.className}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'courseName',
        header: 'Học phần & Khoa',
        render: (cls) => (
          <div className="max-w-[260px]">
            <div className="flex items-center gap-1.5">
              {cls.courseId && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                  {cls.courseId}
                </span>
              )}
              <p
                onClick={() => setSelectedClass(cls)}
                className="font-bold text-gray-900 text-sm hover:text-indigo-600 cursor-pointer truncate"
                title={cls.courseName}
              >
                {cls.courseName}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {cls.department ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                  {cls.department}
                </span>
              ) : (
                <span className="text-gray-400 text-[11px] italic">Chung</span>
              )}
              {cls.status && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  cls.status === 'Đang mở'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {cls.status}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'teacher',
        header: 'Giảng viên',
        render: (cls) => (
          <div className="max-w-[180px]">
            <p className="font-semibold text-xs text-gray-900 truncate" title={cls.teacher || 'Chưa phân công'}>
              {cls.teacher || <span className="text-gray-400 italic font-normal">Chưa phân công</span>}
            </p>
            {cls.teacherRef?.email && (
              <p className="text-[11px] text-gray-400 truncate" title={cls.teacherRef.email}>
                {cls.teacherRef.email}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'schedules',
        header: 'Lịch học & Phòng',
        className: 'min-w-[200px]',
        render: (cls) => (
          <ScheduleRoomBadge
            schedules={cls.schedules}
            room={cls.room}
            studyStart={cls.studyStart}
            studyEnd={cls.studyEnd}
            compact
          />
        ),
      },
      {
        key: 'enrolled',
        header: 'Sĩ số',
        className: 'text-center w-24',
        render: (cls) => (
          <div className="text-center">
            <span className="font-bold text-gray-900 text-sm">
              {cls.enrolledCount || 0}
            </span>
            <span className="text-xs text-gray-400">/{cls.capacity || '∞'}</span>
            <p className="text-[10px] text-gray-400 font-medium">sinh viên</p>
          </div>
        ),
      },
      {
        key: 'attendanceRate',
        header: 'Tỷ lệ chuyên cần',
        className: 'min-w-[190px]',
        render: (cls) => {
          const stat = attendanceByClass[cls.id];
          if (!stat || stat.total === 0) {
            return (
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                  <i className="far fa-circle text-[9px]" /> Chưa có dữ liệu
                </span>
              </div>
            );
          }

          const isGood = stat.rate >= 80;
          const isMedium = stat.rate >= 70 && stat.rate < 80;

          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold ${isGood ? 'text-emerald-700' : isMedium ? 'text-amber-700' : 'text-rose-700'}`}>
                  {stat.rate}%
                </span>
                <span className="text-[11px] text-gray-400">
                  {stat.present}/{stat.total} lượt
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    isGood ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${stat.rate}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: 'Thao tác',
        className: 'text-right w-40',
        render: (cls) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedClass(cls)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:shadow-xs border border-indigo-200 transition"
              title="Xem danh sách sinh viên và lịch sử điểm danh của lớp này"
            >
              <i className="fas fa-clipboard-user text-xs" />
              <span>Xem chuyên cần</span>
            </button>
          </div>
        ),
      },
    ],
    [attendanceByClass]
  );

  // If a class is selected, render the dedicated Class Attendance Detail view
  if (selectedClass) {
    return (
      <ClassAttendanceDetail
        classItem={selectedClass}
        onBack={() => {
          setSelectedClass(null);
          loadOverviewData();
        }}
      />
    );
  }

  // Otherwise, render Master Class List View
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Điểm danh & Chuyên cần"
        description="Theo dõi tình hình chuyên cần theo từng lớp học phần, kiểm soát lịch sử điểm danh và đánh giá sinh viên trên toàn hệ thống"
      />

      {/* Global Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tổng số lớp HP</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{globalStats.totalClasses}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Sinh viên tham gia</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{globalStats.totalEnrolled}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lượt ghi nhận</p>
          <p className="text-2xl font-black text-slate-700 mt-1">{globalStats.totalAttendanceRecords}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tỷ lệ chuyên cần</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{globalStats.avgRate}%</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Lượt đi muộn</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{globalStats.late}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Lượt vắng học</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{globalStats.absent}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả khoa</option>
            {departments.map((d) => (
              <option key={d._id || d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả trạng thái lớp</option>
            <option value="Đang mở">Lớp đang mở</option>
            <option value="Đã đóng">Lớp đã đóng</option>
            <option value="Nháp">Lớp nháp</option>
          </select>

          {(filterDepartment !== 'all' || filterStatus !== 'all' || searchText) && (
            <button
              type="button"
              onClick={() => {
                setFilterDepartment('all');
                setFilterStatus('all');
                setSearchText('');
              }}
              className="text-xs text-rose-600 font-semibold hover:underline"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        <div className="w-full sm:w-72">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Tìm theo mã lớp, môn, GV..."
          />
        </div>
      </div>

      {/* Class List Table */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-xs flex justify-center">
            <Spinner />
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-xs text-center text-gray-400">
            <i className="far fa-folder-open text-4xl mb-3 block text-gray-300" />
            <p className="font-semibold text-gray-600 text-sm">Không tìm thấy lớp học phần nào</p>
            <p className="text-xs text-gray-400 mt-1">Vui lòng điều chỉnh lại bộ lọc hoặc tạo thêm lớp học phần mới trong hệ thống.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <DataTable
              columns={columns}
              rows={paginatedClasses}
              rowKey={(c) => c._id || c.id}
            />

            <Pagination
              page={page}
              total={filteredClasses.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageAttendance;
