import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStudentLockMonitor } from '../hooks/useStudentLockMonitor';
import studentAPI from '../services/studentAPI';
import {
  fetchOpenRegistrations,
  fetchStudentRegistrations,
  getSessionFromShiftId,
  SHIFTS,
  OPEN_REGISTRATIONS_UPDATED_EVENT,
  STUDENT_REGISTRATIONS_UPDATED_EVENT,
} from '../utils/registrationUtils';
import { formatStudentId } from '../utils/studentUtils';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SESSIONS = [
  { id: 'sang', label: 'Sáng' },
  { id: 'chieu', label: 'Chiều' },
  { id: 'toi', label: 'Tối' },
];

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getShiftLabel(shiftId) {
  const shift = SHIFTS.find((s) => s.id === shiftId);
  return shift ? shift.label : '';
}

function padTeacherID(id) {
  if (!id) return 'N/A';
  return `GV-${String(id).padStart(3, '0')}`;
}

export default function StudentSchedule() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [openRegs, setOpenRegs] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const { showLockModal, lockReason, handleLogoutToLogin } = useStudentLockMonitor(currentUser);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user?.email) {
      navigate('/');
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  useEffect(() => {
    if (!currentUser?.email) return;

    const syncProfile = async () => {
      const emailKey = currentUser.email.trim().toLowerCase();
      try {
        const students = await studentAPI.getAllStudents({ fresh: true });
        const student = students.find((s) => s.email?.trim().toLowerCase() === emailKey);
        if (student) {
          const merged = { ...currentUser, ...student, role: 'sinh-vien' };
          setStudentInfo(merged);
          setCurrentUser(merged);
          sessionStorage.setItem('currentUser', JSON.stringify(merged));
        } else {
          setStudentInfo(currentUser);
        }
      } catch (error) {
        console.error('Không tải hồ sơ sinh viên từ API:', error);
        setStudentInfo(currentUser);
      }
    };

    syncProfile();
  }, [currentUser?.email]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, studentRegs] = await Promise.all([
        fetchOpenRegistrations({ fresh: true }),
        fetchStudentRegistrations({ fresh: true }),
      ]);
      setOpenRegs(regs);
      setEnrollments(studentRegs);
    } catch (error) {
      console.error('Lỗi tải dữ liệu thời khóa biểu:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const refresh = () => loadData();
    window.addEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, refresh);
    window.addEventListener(STUDENT_REGISTRATIONS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener(STUDENT_REGISTRATIONS_UPDATED_EVENT, refresh);
    };
  }, [loadData]);

  const padID = (id) => `SV-${String(id).padStart(3, '0')}`;

  const displayUser = studentInfo || currentUser;
  const displayName = displayUser?.name || displayUser?.hoTen || 'Sinh viên';
  const displayAvatar =
    displayUser?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`;

  const myEnrollments = useMemo(() => {
    const raw = enrollments.filter((e) => Number(e.studentId) === Number(displayUser?.id));
    // Enrich each student registration with the matching open registration
    return raw.map((e) => {
      const match = openRegs.find((r) => r.id === e.regId || r.courseId === e.courseId || r.courseId === e.courseId);
      if (!match) return e;
      // merge open registration fields (schedules, studyStart, studyEnd, room, teacher, etc.)
      return { ...match, ...e };
    });
  }, [enrollments, openRegs, displayUser?.id]);

  const weekData = useMemo(() => {
    const startOfWeek = getStartOfWeek(currentViewDate);
    const headers = [];
    const cells = {};

    DAY_KEYS.forEach((key) => {
      SESSIONS.forEach((session) => {
        cells[`${key}-${session.id}`] = [];
      });
    });

    for (let i = 0; i < 7; i += 1) {
      const dateInWeek = new Date(startOfWeek);
      dateInWeek.setDate(startOfWeek.getDate() + i);
      dateInWeek.setHours(0, 0, 0, 0);
      headers.push({ label: DAY_NAMES[i], date: formatDate(dateInWeek) });

      myEnrollments.forEach((course, index) => {
        if (!course || !course.studyStart || !course.studyEnd) return;
        const startDate = new Date(course.studyStart);
        const endDate = new Date(course.studyEnd);
        if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) return;
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        if (dateInWeek >= startDate && dateInWeek <= endDate && Array.isArray(course.schedules)) {
          course.schedules.forEach((schedule) => {
            const checkDayId = i === 6 ? 'CN' : String(i + 2);
            if (schedule.dayId === checkDayId) {
              const sessionGroup = getSessionFromShiftId(schedule.shiftId);
              if (sessionGroup) {
                const key = `${DAY_KEYS[i]}-${sessionGroup}`;
                cells[key].push({
                  course,
                  shiftLabel: getShiftLabel(schedule.shiftId),
                  color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7],
                });
              }
            }
          });
        }
      });
    }

    return { headers, cells };
  }, [currentViewDate, myEnrollments]);

  const navigateWeek = (type) => {
    setCurrentViewDate((prev) => {
      const next = new Date(prev);
      if (type === 'today') return new Date();
      if (type === 'prev') next.setDate(next.getDate() - 7);
      if (type === 'next') next.setDate(next.getDate() + 7);
      return next;
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <style>{`
        .submenu-container { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-in-out; }
        .submenu-container.open { max-height: 300px; }
        .menu-arrow { transition: transform 0.3s ease; }
        .rotate-180 { transform: rotate(180deg); }

        .tkb-table { width: 100%; border-collapse: collapse; background: white; table-layout: fixed; }
        .tkb-table th, .tkb-table td { border: 1px solid #e2e8f0; height: 180px; vertical-align: top; padding: 8px; position: relative; }
        .tkb-table th { height: auto; background-color: #fff; color: #0284c7; padding: 15px 5px; font-weight: 700; }
        .tkb-table .ca-hoc-col { width: 80px; background-color: #fffbeb; color: #1e293b; font-weight: 700; vertical-align: middle; text-align: center; height: auto !important; }
        .tkb-cell { background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 20px 20px; }
        .course-card {
            color: white;
            padding: 10px;
            border-radius: 8px;
            font-size: 12px;
            margin-bottom: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border-left: 4px solid rgba(0,0,0,0.2);
            transition: transform 0.2s;
            cursor: default;
        }
        .course-name { font-weight: 700; display: block; margin-bottom: 2px; text-transform: uppercase; line-height: 1.2; }
        .course-info { font-size: 11px; opacity: 0.95; line-height: 1.4; white-space: nowrap; }
        .course-info i { margin-right: 4px; font-size: 10px; }
        .teacher-id { font-size: 0.9em; margin-left: 14px; display: block; line-height: 1.4; }
      `}</style>
      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl" />
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={() => setShowUserDropdown((prev) => !prev)}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">SV. {displayName}</p>
                <p className="text-[10px] text-gray-500 font-medium">MSV: {displayUser?.id ? padID(displayUser.id) : 'N/A'}</p>
              </div>
              <img src={displayAvatar} className="w-10 h-10 rounded-full shadow-sm object-cover" alt={displayName} />
            </div>
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]">
                <button onClick={handleLogoutToLogin} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <i className="fas fa-sign-out-alt mr-2" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100 sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Học tập</p>
            <ul className="space-y-1">
              <li>
                <NavLink to="/sv-dashboard" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-th-large w-5 text-center" /> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                              <button onClick={() => toggleSubmenu('hoc-tap')} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                                <div className="flex items-center gap-3">
                                  <i className="fas fa-book-open w-5 text-center" />
                                  <span>Học phần</span>
                                </div>
                                <i className="fas fa-chevron-down text-[10px]" />
                              </button>
                              <div className="submenu-container open">
                                <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                                  <li>
                                    <NavLink
                                      to="/sv/documents"
                                      className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    >
                                      Danh sách tài liệu
                                    </NavLink>
                                  </li>
                                  <li>
                                    <NavLink
                                      to="/sv/assignments"
                                      className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    >
                                      Danh sách bài tập
                                    </NavLink>
                                  </li>
                                </ul>
                              </div>
                            </li>
            </ul>
            <ul className="space-y-1 mt-1">
              <li>
                <NavLink to="/sv/timetable" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-history w-5 text-center" /> <span>Thời khoá biểu</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/sv/course-registration" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-layer-group w-5 text-center" /> <span>Đăng ký học phần</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-t-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 mb-0">
            <div>
              <h2 className="text-xl font-bold text-gray-700">Lịch học theo tuần</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <input
                  type="date"
                  value={currentViewDate.toISOString().split('T')[0]}
                  onChange={(e) => setCurrentViewDate(new Date(e.target.value))}
                  className="bg-transparent border-none text-sm focus:ring-0 cursor-pointer"
                />
              </div>
              <button type="button" onClick={() => navigateWeek('today')} className="bg-sky-500 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-sky-600 flex items-center gap-2">
                <i className="fas fa-calendar-check" /> Hiện tại
              </button>
              <button type="button" onClick={() => navigateWeek('prev')} className="bg-sky-500 text-white px-3 py-1.5 rounded text-sm hover:bg-sky-600 flex items-center gap-2">
                <i className="fas fa-chevron-left" /> Trở về
              </button>
              <button type="button" onClick={() => navigateWeek('next')} className="bg-sky-500 text-white px-3 py-1.5 rounded text-sm hover:bg-sky-600 flex items-center gap-2">
                Tiếp <i className="fas fa-chevron-right" />
              </button>
            </div>
          </div>

          <div className="bg-white border-x border-b border-gray-200 overflow-x-auto shadow-sm mt-4">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Đang tải thời khóa biểu...</div>
            ) : myEnrollments.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <i className="fas fa-calendar-times text-5xl mb-4 block" />
                <p className="text-lg font-semibold">Bạn chưa đăng ký học phần nào.</p>
                <p className="text-sm text-gray-400">Hãy vào trang Đăng ký học phần để chọn lịch.</p>
              </div>
            ) : (
              <table className="tkb-table">
                <thead>
                  <tr id="header-days">
                    <th className="ca-hoc-col border-r">Ca học</th>
                    {weekData.headers.map((h) => (
                      <th key={h.label} className="text-center">
                        <div className="text-sky-600">{h.label}</div>
                        <div className="text-sky-600 font-normal text-sm">{h.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SESSIONS.map((session) => (
                    <tr key={session.id}>
                      <td className="ca-hoc-col">{session.label}</td>
                      {DAY_KEYS.map((dayKey) => (
                        <td key={`${dayKey}-${session.id}`} className="tkb-cell align-top p-2">
                          {(weekData.cells[`${dayKey}-${session.id}`] || []).map((item, index) => (
                            <div
                              key={`${item.course.regId}-${index}`}
                              className="course-card"
                              style={{ backgroundColor: item.color }}
                            >
                              <span className="course-name">{item.course.courseName}</span>
                              <div className="course-info">
                                <i className="fas fa-clock"></i>
                                {item.shiftLabel || ''}<br/>
                                <i className="fas fa-map-marker-alt"></i>
                                Phòng: {item.course.room || 'Học Online'}<br/>
                                <i className="fas fa-user-tie"></i>
                                {item.course.teacher || 'Giảng viên'} 
                                <div className="teacher-id">
                                  ({padTeacherID(item.course.teacherId)})
                                </div>
                              </div>
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {showLockModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
          <div className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 text-center border-4 border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-user-lock text-red-500 text-3xl animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <p className="text-gray-500 text-sm mb-4">Tài khoản của bạn đã bị phòng đào tạo tạm khóa. Vui lòng liên hệ quản trị để được hỗ trợ.</p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8">
              <p className="text-red-600 text-xs font-bold uppercase tracking-widest mb-1">Lý do từ phòng đào tạo:</p>
              <p className="text-red-600 font-semibold text-sm">{lockReason || 'Không có thông tin'}</p>
            </div>
            <button type="button" onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
              QUAY VỀ TRANG ĐĂNG NHẬP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
