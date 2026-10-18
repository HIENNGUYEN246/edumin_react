import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import apiClient from '../services/api';
import studentAPI from '../services/studentAPI';
import registrationAPI from '../services/registrationAPI';
import attendanceAPI from '../services/attendanceAPI';
import {
  getTodayDateString,
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  calculateStudentAttendanceStats,
  SHIFT_OPTIONS,
} from '../utils/attendanceUtils';
import NotificationBell from './NotificationBell';

export default function StudentAttendance() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('currentUser')) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [openRegs, setOpenRegs] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [attendances, setAttendances] = useState([]);

  // Check-in form state
  const [selectedRegId, setSelectedRegId] = useState('');
  const [selectedShift, setSelectedShift] = useState('1');
  const [checkInNote, setCheckInNote] = useState('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // Filters for history
  const [filterCourse, setFilterCourse] = useState('all');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const studentIdVal = currentUser?.id ?? currentUser?.studentId ?? '';
  const currentStudentEmail = (currentUser?.email || '').trim().toLowerCase();

  const isMyEnrollment = useCallback(
    (e) => {
      if (!e) return false;
      if (studentIdVal && String(e.studentId) === String(studentIdVal)) return true;
      if (
        currentStudentEmail &&
        (e.email || e.studentEmail) &&
        String(e.email || e.studentEmail).trim().toLowerCase() === currentStudentEmail
      ) {
        return true;
      }
      if (e.studentRef) {
        if (typeof e.studentRef === 'object') {
          if (studentIdVal && String(e.studentRef.id) === String(studentIdVal)) return true;
          if (
            currentStudentEmail &&
            e.studentRef.email &&
            e.studentRef.email.trim().toLowerCase() === currentStudentEmail
          ) {
            return true;
          }
        } else if (currentUser?._id && String(e.studentRef) === String(currentUser._id)) {
          return true;
        }
      }
      return false;
    },
    [studentIdVal, currentStudentEmail, currentUser?._id]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, allEnrollments, allAttendances] = await Promise.all([
        registrationAPI.getOpenRegistrations({ fresh: true }),
        registrationAPI.getStudentRegistrations({ fresh: true }),
        attendanceAPI.getAllAttendances(),
      ]);
      setOpenRegs(regs || []);
      setEnrollments(allEnrollments || []);
      setAttendances(allAttendances || []);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu điểm danh:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadData();
  }, [currentUser, navigate, loadData]);

  // My registered courses/classes
  const myEnrolledClasses = useMemo(() => {
    const list = [];
    const seenRegIds = new Set();

    enrollments.filter(isMyEnrollment).forEach((e) => {
      const matchedOpen = openRegs.find(
        (o) => String(o.id) === String(e.regId) || (e.courseId && String(o.courseId) === String(e.courseId))
      );
      const regId = matchedOpen ? String(matchedOpen.id) : String(e.regId);
      if (seenRegIds.has(regId)) return;
      seenRegIds.add(regId);

      list.push({
        regId,
        courseId: matchedOpen?.courseId || e.courseId || regId,
        courseName: matchedOpen?.courseName || e.courseName || 'Học phần',
        teacher: matchedOpen?.teacher || e.teacher || 'Chưa phân công',
        teacherId: matchedOpen?.teacherId || e.teacherId,
        room: matchedOpen?.room || e.room || '',
        schedules: matchedOpen?.schedules || e.schedules || [],
      });
    });

    return list;
  }, [enrollments, isMyEnrollment, openRegs]);

  // Auto select first enrolled class if not selected
  useEffect(() => {
    if (myEnrolledClasses.length > 0 && !selectedRegId) {
      setSelectedRegId(String(myEnrolledClasses[0].regId));
    }
  }, [myEnrolledClasses, selectedRegId]);

  // My attendance records
  const myAttendanceRecords = useMemo(() => {
    return attendances.filter((r) => {
      if (studentIdVal && String(r.studentId) === String(studentIdVal)) return true;
      if (
        currentStudentEmail &&
        r.studentEmail &&
        String(r.studentEmail).trim().toLowerCase() === currentStudentEmail
      ) {
        return true;
      }
      return false;
    });
  }, [attendances, studentIdVal, currentStudentEmail]);

  // Stats
  const stats = useMemo(() => {
    return calculateStudentAttendanceStats(myAttendanceRecords);
  }, [myAttendanceRecords]);

  // Today check-in status for selected class and shift
  const todayStr = getTodayDateString();
  const todayRecordForSelected = useMemo(() => {
    if (!selectedRegId) return null;
    return myAttendanceRecords.find(
      (r) =>
        String(r.regId) === String(selectedRegId) &&
        r.date === todayStr &&
        String(r.shiftId) === String(selectedShift)
    );
  }, [myAttendanceRecords, selectedRegId, todayStr, selectedShift]);

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (filterCourse === 'all') return myAttendanceRecords;
    return myAttendanceRecords.filter((r) => String(r.regId) === String(filterCourse));
  }, [myAttendanceRecords, filterCourse]);

  // Handle student self check-in
  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!selectedRegId) {
      Swal.fire('Chú ý', 'Vui lòng chọn học phần cần điểm danh!', 'warning');
      return;
    }

    const selectedClass = myEnrolledClasses.find((c) => String(c.regId) === String(selectedRegId));
    if (!selectedClass) {
      Swal.fire('Lỗi', 'Không tìm thấy thông tin học phần đã chọn!', 'error');
      return;
    }

    setSubmittingCheckIn(true);
    try {
      const payload = {
        regId: String(selectedClass.regId),
        courseId: selectedClass.courseId,
        courseName: selectedClass.courseName,
        studentId: Number(studentIdVal),
        studentName: currentUser.hoTen || currentUser.name || 'Sinh viên',
        studentEmail: currentUser.email || '',
        date: todayStr,
        shiftId: selectedShift,
        shiftLabel: getShiftLabel(selectedShift),
        note: checkInNote.trim(),
      };

      const result = await attendanceAPI.checkIn(payload);
      if (result.alreadyCheckedIn) {
        Swal.fire({
          icon: 'info',
          title: 'Đã điểm danh',
          text: 'Bạn đã hoàn tất điểm danh cho buổi học này rồi!',
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Điểm danh thành công!',
          text: `Đã ghi nhận có mặt cho môn ${selectedClass.courseName} (${getShiftLabel(selectedShift)}).`,
          timer: 2500,
          showConfirmButton: false,
        });
      }
      setCheckInNote('');
      await loadData();
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể kết nối đến máy chủ để điểm danh. Vui lòng thử lại!', 'error');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
  };

  const displayName = currentUser?.hoTen || currentUser?.name || 'Sinh Viên';
  const displayAvatar =
    currentUser?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl" />
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>

        <div className="flex items-center gap-6">
          <NotificationBell currentUser={currentUser} customRole="sinh-vien" />

          <div className="relative">
            <div
              className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer"
              onClick={() => setShowUserDropdown((p) => !p)}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">SV. {displayName}</p>
                <p className="text-[10px] text-gray-500 font-medium">MSV: SV-{String(studentIdVal).padStart(3, '0')}</p>
              </div>
              <img src={displayAvatar} className="w-10 h-10 rounded-full shadow-sm object-cover" alt={displayName} />
            </div>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <i className="fas fa-sign-out-alt mr-2" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100 sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Học tập</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/sv-dashboard"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-th-large w-5 text-center" /> <span>Dashboard</span>
                </NavLink>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => setSubmenuOpen((p) => !p)}
                  className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book-open w-5 text-center" />
                    <span>Học phần</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${submenuOpen ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/sv/documents"
                        className={({ isActive }) =>
                          `block p-2 text-sm rounded-lg transition ${
                            isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                          }`
                        }
                      >
                        Danh sách tài liệu
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/sv/assignments"
                        className={({ isActive }) =>
                          `block p-2 text-sm rounded-lg transition ${
                            isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                          }`
                        }
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>

              <li>
                <NavLink
                  to="/sv/attendance"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-clipboard-check w-5 text-center" />
                  <span>Điểm danh học phần</span>
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/sv/timetable"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-history w-5 text-center" />
                  <span>Thời khoá biểu</span>
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/sv/course-registration"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-layer-group w-5 text-center" />
                  <span>Đăng ký học phần</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/sv/attendance"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-user-check w-5 text-center" />
                  <span>Điểm danh học phần</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <i className="fas fa-calendar-check text-indigo-600" />
                Điểm danh & Chuyên cần
              </h1>
              <p className="text-sm text-gray-500">
                Thực hiện điểm danh trực tuyến cho các buổi học hôm nay và xem phản hồi, đánh giá từ giảng viên.
              </p>
            </div>
            <div className="text-xs bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-medium border border-indigo-100 flex items-center gap-2">
              <i className="fas fa-clock" />
              <span>Hôm nay: {formatAttendanceDate(todayStr)}</span>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase">Tổng số buổi</span>
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <i className="fas fa-book" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-xs text-gray-400 mt-1">Buổi đã được ghi nhận</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase">Tỷ lệ chuyên cần</span>
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <i className="fas fa-percent" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold text-emerald-600">{stats.rate}%</div>
              <div className="text-xs text-emerald-500 mt-1">
                {stats.rate >= 80 ? 'Đạt chuẩn dự thi' : 'Cảnh báo nguy cơ cấm thi'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase">Vắng / Đi muộn</span>
                <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <i className="fas fa-exclamation-triangle" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold text-amber-600">
                {stats.late} muộn / {stats.absent} vắng
              </div>
              <div className="text-xs text-gray-400 mt-1">{stats.excused} buổi có phép</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase">Điểm đánh giá TB</span>
                <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <i className="fas fa-star" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold text-purple-600">
                {stats.avgScore !== null ? `${stats.avgScore}/10` : 'Chưa có'}
              </div>
              <div className="text-xs text-gray-400 mt-1">Đánh giá từ giảng viên</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Online Check-in Box */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <i className="fas fa-check-circle text-indigo-600" />
                    Điểm danh hôm nay
                  </h3>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {myEnrolledClasses.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-calendar-times text-4xl text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">Bạn chưa đăng ký học phần nào trong học kỳ này.</p>
                  </div>
                ) : (
                  <form onSubmit={handleCheckIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                        Chọn môn học cần điểm danh
                      </label>
                      <select
                        value={selectedRegId}
                        onChange={(e) => setSelectedRegId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      >
                        {myEnrolledClasses.map((c) => (
                          <option key={c.regId} value={c.regId}>
                            {c.courseId} - {c.courseName} ({c.teacher})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                        Chọn ca học
                      </label>
                      <select
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      >
                        {SHIFT_OPTIONS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                        Ghi chú (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={checkInNote}
                        onChange={(e) => setCheckInNote(e.target.value)}
                        placeholder="Ví dụ: Có mặt đúng giờ..."
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      />
                    </div>

                    {todayRecordForSelected ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                          <i className="fas fa-check-double text-emerald-600" />
                          <span>Đã điểm danh: {todayRecordForSelected.status}</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">
                          Thời gian ghi nhận:{' '}
                          <span className="font-semibold">{todayRecordForSelected.checkInTime || 'Hôm nay'}</span>
                        </p>
                        {todayRecordForSelected.evaluation && (
                          <div className="mt-2 pt-2 border-t border-emerald-200 text-xs text-emerald-800">
                            <strong>Đánh giá của GV:</strong> {todayRecordForSelected.evaluation}
                            {todayRecordForSelected.score !== null && (
                              <span className="ml-2 font-bold bg-white px-2 py-0.5 rounded shadow-sm">
                                {todayRecordForSelected.score}/10
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={submittingCheckIn}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submittingCheckIn ? (
                          <>
                            <i className="fas fa-spinner fa-spin" />
                            Đang xử lý...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-clipboard-check" />
                            Điểm danh ngay
                          </>
                        )}
                      </button>
                    )}
                  </form>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-2">
                <i className="fas fa-info-circle text-indigo-400" />
                <span>Hệ thống tự động lưu trữ trên MongoDB và thông báo cho Giảng viên.</span>
              </div>
            </div>

            {/* Recent Teacher Evaluation & Feedback Card */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <i className="fas fa-award text-amber-500" />
                  Đánh giá gần đây từ Giảng viên
                </h3>
                <span className="text-xs text-gray-400">Ghi nhận học tập & chuyên cần</span>
              </div>

              {myAttendanceRecords.filter((r) => r.evaluation || r.score !== null).length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-comment-dots text-5xl text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Chưa có đánh giá hoặc điểm số nào từ giảng viên.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Giảng viên sẽ ghi nhận và gửi nhận xét sau mỗi buổi học.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {myAttendanceRecords
                    .filter((r) => r.evaluation || r.score !== null)
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item._id || item.id}
                        className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-bold text-indigo-600">{item.courseName}</span>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {formatAttendanceDate(item.date)} - {item.shiftLabel || `Ca ${item.shiftId}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.score !== null && item.score !== undefined && (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold">
                                Điểm: {item.score}/10
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadgeClass(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {item.evaluation && (
                          <div className="mt-2.5 text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-100 flex items-start gap-2">
                            <i className="fas fa-tag text-indigo-500 mt-0.5" />
                            <span className="font-semibold text-gray-800">{item.evaluation}</span>
                          </div>
                        )}

                        {item.note && (
                          <div className="mt-2 text-xs text-indigo-900 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100 flex items-start gap-2">
                            <i className="fas fa-comment-dots text-indigo-500 mt-0.5 shrink-0" />
                            <span className="italic leading-relaxed">"{item.note}"</span>
                          </div>
                        )}

                        {item.teacherName && (
                          <div className="mt-2 text-[11px] text-gray-400 text-right">
                            Người đánh giá: <span className="font-medium text-gray-600">{item.teacherName}</span>
                            {item.evaluatedAt && ` (${item.evaluatedAt})`}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Attendance History Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Lịch sử điểm danh chi tiết</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Tất cả các buổi học đã được điểm danh và đánh giá
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-medium">Lọc theo môn:</span>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Tất cả môn học</option>
                  {myEnrolledClasses.map((c) => (
                    <option key={c.regId} value={c.regId}>
                      {c.courseName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">
                <i className="fas fa-spinner fa-spin text-2xl mb-2" />
                <p className="text-xs">Đang tải dữ liệu...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <i className="fas fa-clipboard-list text-4xl mb-2 text-gray-200" />
                <p className="text-sm">Chưa có bản ghi điểm danh nào phù hợp.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-3.5">Học phần</th>
                      <th className="px-6 py-3.5">Ngày học</th>
                      <th className="px-6 py-3.5">Ca học</th>
                      <th className="px-6 py-3.5">Giờ check-in</th>
                      <th className="px-6 py-3.5 text-center">Trạng thái</th>
                      <th className="px-6 py-3.5 text-center">Điểm số</th>
                      <th className="px-6 py-3.5">Nhận xét từ GV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {filteredHistory.map((item) => (
                      <tr key={item._id || item.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">{item.courseName || 'Học phần'}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{item.courseId}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {formatAttendanceDate(item.date)}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {item.shiftLabel || getShiftLabel(item.shiftId)}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-gray-600">
                          {item.checkInTime || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                              item.status
                            )}`}
                          >
                            <i className={`fas ${getStatusIcon(item.status)} text-[10px]`} />
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.score !== null && item.score !== undefined ? (
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              {item.score}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                          {item.evaluation || item.note ? (
                            <div className="space-y-1">
                              {item.evaluation && (
                                <div className="truncate font-semibold text-gray-800" title={item.evaluation}>
                                  <i className="fas fa-tag text-indigo-500 mr-1.5" />
                                  {item.evaluation}
                                </div>
                              )}
                              {item.note && (
                                <div className="truncate text-gray-600 italic" title={item.note}>
                                  <i className="fas fa-comment-dots text-gray-400 mr-1.5" />
                                  "{item.note}"
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 italic">Chưa có</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
