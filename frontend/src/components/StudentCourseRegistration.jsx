import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import studentAPI from '../services/studentAPI';
import apiClient from '../services/api';
import { useStudentLockMonitor } from '../hooks/useStudentLockMonitor';
import {
  fetchOpenRegistrations,
  fetchStudentRegistrations,
  isRegistrationExpired,
  padTeacherID,
  saveStudentRegistrations,
  OPEN_REGISTRATIONS_UPDATED_EVENT,
} from '../utils/registrationUtils';

function padID(id) {
  return `SV-${String(id).padStart(3, '0')}`;
}

export default function StudentCourseRegistration() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [openRegs, setOpenRegs] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [detailReg, setDetailReg] = useState(null);
  const { showLockModal, handleLogoutToLogin } = useStudentLockMonitor(currentUser);

  const syncProfile = useCallback(async () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user?.email) {
      navigate('/');
      return null;
    }
    try {
      const students = await studentAPI.getAllStudents({ fresh: true });
      const profile = students.find((s) => s.email === user.email);
      const merged = profile ? { ...user, ...profile, role: 'sinh-vien' } : user;
      setCurrentUser(merged);
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
      return merged;
    } catch {
      setCurrentUser(user);
      return user;
    }
  }, [navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, allEnrollments] = await Promise.all([
        fetchOpenRegistrations({ fresh: true }),
        fetchStudentRegistrations({ fresh: true }),
      ]);
      setOpenRegs(regs);
      setEnrollments(allEnrollments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncProfile();
    loadData();
    const refresh = () => {
      syncProfile();
      loadData();
    };
    window.addEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, refresh);
    };
  }, [syncProfile, loadData]);

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f9] text-gray-500">
        <div className="text-center">
          <div className="mb-4 text-2xl">Đang tải thông tin sinh viên...</div>
          <p className="text-sm text-gray-400">Vui lòng đợi trong giây lát.</p>
        </div>
      </div>
    );
  }

  const studentDept = (currentUser.department || currentUser.khoa || '').trim().toLowerCase();
  const myEnrollments = enrollments.filter((e) => e.studentId === currentUser.id);
  const availableCourses = openRegs.filter((reg) => (reg.department || '').trim().toLowerCase() === studentDept);

  const registerCourse = async (regId, courseName, isExpired) => {
    if (isExpired) {
      Swal.fire('Lỗi', 'Học phần này hiện không trong thời gian đăng ký!', 'error');
      return;
    }
    const courseData = openRegs.find((r) => r.id === regId);
    if (!courseData) {
      Swal.fire('Lỗi', 'Không tìm thấy thông tin học phần!', 'error');
      return;
    }
    if (myEnrollments.some((e) => e.regId === regId)) return;

    let conflictInfo = null;
    for (const newSched of courseData.schedules || []) {
      for (const enrolledCourse of myEnrollments) {
        for (const oldSched of enrolledCourse.schedules || []) {
          if (newSched.dayId === oldSched.dayId && newSched.shiftId === oldSched.shiftId) {
            conflictInfo = { day: newSched.dayLabel, shift: newSched.shiftLabel, course: enrolledCourse.courseName };
            break;
          }
        }
        if (conflictInfo) break;
      }
      if (conflictInfo) break;
    }

    if (conflictInfo) {
      Swal.fire({
        title: 'Trùng lịch học!',
        html: `Môn <b>${courseName}</b> bị trùng lịch học:<br>
          <div class="mt-2 text-sm text-red-600">
            <b>${conflictInfo.day} - ${conflictInfo.shift}</b><br>
            Đã trùng với môn: <b>${conflictInfo.course}</b>
          </div>`,
        icon: 'warning',
      });
      return;
    }

    const next = [
      ...enrollments,
      {
        regId,
        studentId: Number(currentUser.id),
        courseName: courseData.courseName,
        courseId: courseData.courseId,
        teacher: courseData.teacher,
        teacherId: courseData.teacherId,
        schedules: courseData.schedules,
        studyStart: courseData.studyStart || '',
        studyEnd: courseData.studyEnd || '',
        room: courseData.room,
        enrolledDate: new Date().toLocaleString('vi-VN'),
      },
    ];
    try {
      await saveStudentRegistrations(next);
      setEnrollments(next);
      Swal.fire('Thành công', `Đã đăng ký học phần: ${courseName}`, 'success');
    } catch {
      Swal.fire('Lỗi', 'Không lưu được lên API.', 'error');
    }
  };

  const cancelCourse = (regId, isExpired) => {
    if (isExpired) {
      Swal.fire('Lỗi', 'Hết thời gian đăng ký, bạn không thể tự hủy học phần. Vui lòng liên hệ Phòng đào tạo!', 'error');
      return;
    }
    Swal.fire({
      title: 'Xác nhận hủy?',
      text: 'Bạn muốn hủy đăng ký học phần này?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Hủy đăng ký',
      cancelButtonText: 'Quay lại',
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const next = enrollments.filter((e) => !(e.regId === regId && e.studentId === currentUser.id));
      try {
        await saveStudentRegistrations(next);
        setEnrollments(next);
        Swal.fire('Đã hủy!', 'Học phần đã được huỷ.', 'success');
      } catch {
        Swal.fire('Lỗi', 'Không lưu được lên API.', 'error');
      }
    });
  };

  const displayName = currentUser.hoTen || currentUser.name || 'Sinh Viên';
  const displayAvatar =
    currentUser.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <style>{`
        .status-active { background-color: #dcfce7; color: #166534; }
        .status-expired { background-color: #fee2e2; color: #991b1b; }
        .submenu-container { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-in-out; }
        .submenu-container.open { max-height: 300px; }
      `}</style>

      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg"><i className="fas fa-graduation-cap text-white text-xl" /></div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>
        <SVHeaderUser
          displayName={displayName}
          displayAvatar={displayAvatar}
          currentUser={currentUser}
          padID={padID}
          showUserDropdown={showUserDropdown}
          setShowUserDropdown={setShowUserDropdown}
          handleLogout={handleLogout}
        />
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-white shadow-lg hidden md:block border-r border-gray-100 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Học tập</p>
            <ul className="space-y-1">
              <li>
                <NavLink to="/sv-dashboard" end className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
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
                <NavLink to="/sv/timetable" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-history w-5 text-center" /><span>Thời khoá biểu</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/sv/course-registration" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-layer-group w-5 text-center" /><span>Đăng ký học phần</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Đăng ký học phần</h2>
            <p className="text-sm text-gray-500">
              Danh sách học phần dành cho sinh viên:{' '}
              <span className="font-bold text-indigo-600">{currentUser.department || currentUser.khoa || 'Chưa xác định'}</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <p className="text-center py-20 text-gray-400">Đang tải...</p>
            ) : availableCourses.length === 0 ? (
              <div className="text-center py-20">
                <i className="fas fa-clipboard-list text-6xl text-indigo-100 mb-4" />
                <p className="text-gray-400 font-medium">Hiện không có học phần nào được mở cho khoa của bạn.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="mainTable">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-[11px] uppercase tracking-wider">
                      <th className="px-6 py-4">Mã HP</th>
                      <th className="px-6 py-4">Tên học phần</th>
                      <th className="px-6 py-4">Khoa</th>
                      <th className="px-6 py-4">Giảng viên</th>
                      <th className="px-6 py-4 text-center">Số TC</th>
                      <th className="px-6 py-4">Học phí</th>
                      <th className="px-6 py-4">Thời gian đăng ký</th>
                      <th className="px-6 py-4 text-center">Trạng thái</th>
                      <th className="px-6 py-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {availableCourses.map((course) => {
                      const expired = isRegistrationExpired(course);
                      const isRegistered = myEnrollments.some((e) => e.regId === course.id);
                      return (
                        <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-indigo-600 font-bold">{course.courseId}</td>
                          <td className="px-6 py-4 font-semibold text-gray-800">{course.courseName}</td>
                          <td className="px-6 py-4 text-gray-600">{course.department}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-gray-800 font-medium whitespace-nowrap">{course.teacher}</span>
                              <span className="text-[11px] text-indigo-600 font-bold">{padTeacherID(course.teacherId)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-medium">{course.credits}</td>
                          <td className="px-6 py-4 font-bold text-indigo-600 whitespace-nowrap">
                            {Number(course.fee).toLocaleString()} đ
                          </td>
                          <td className="px-6 py-4 text-[12px] text-gray-500 font-medium">
                            <div className="text-blue-600">Từ: {(course.start || '').replace('T', ' ')}</div>
                            <div className="text-red-600">Đến: {(course.end || '').replace('T', ' ')}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${expired ? 'status-expired' : 'status-active'}`}>
                              {expired ? 'Hết hạn/Chưa mở' : 'Đang mở'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => setDetailReg(course)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <i className="fas fa-eye" />
                              </button>
                              {isRegistered ? (
                                <button type="button" onClick={() => cancelCourse(course.id, expired)} className="px-3 py-1.5 bg-red-100 text-red-600 text-[10px] rounded-lg font-bold hover:bg-red-200 whitespace-nowrap">
                                  Hủy HP
                                </button>
                              ) : (
                                <button type="button" onClick={() => registerCourse(course.id, course.courseName, expired)} className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] rounded-lg shadow-md font-bold hover:bg-indigo-700 whitespace-nowrap">
                                  Đăng ký
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {detailReg && (
        <DetailModal reg={detailReg} onClose={() => setDetailReg(null)} />
      )}

      {showLockModal && (
        <LockOverlay onLogout={handleLogoutToLogin} />
      )}
    </div>
  );
}

function SVHeaderUser({ displayName, displayAvatar, currentUser, padID, showUserDropdown, setShowUserDropdown, handleLogout }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowUserDropdown((v) => !v); }}>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-gray-800">SV. {displayName}</p>
          <p className="text-[10px] text-gray-500 font-medium">MSV: {currentUser.id ? padID(currentUser.id) : 'N/A'}</p>
        </div>
        <img src={displayAvatar} className="w-10 h-10 rounded-full shadow-sm object-cover border border-gray-100" alt="" />
      </div>
      {showUserDropdown && (
        <Dropdown handleLogout={handleLogout} />
      )}
    </div>
  );
}

function Dropdown({ handleLogout }) {
  return (
    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl py-2 z-[100]">
      <button type="button" onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
        <i className="fas fa-sign-out-alt mr-2" /> Đăng xuất
      </button>
    </div>
  );
}

function DetailModal({ reg, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold uppercase tracking-wider">Chi tiết học phần</h3>
            <p className="text-indigo-200 text-[14px] mt-1 font-mono">
              Mã HP: {reg.courseId} <br />
              ĐK: {(reg.start || '').replace('T', ' ')} - {(reg.end || '').replace('T', ' ')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white"><i className="fas fa-times text-2xl" /></button>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tên học phần</p>
              <p className="font-bold text-gray-800">{reg.courseName}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 mt-4">Giảng viên</p>
              <p className="font-bold">{reg.teacher}</p>
              <p className="text-[11px] text-indigo-600 font-bold ml-0">{padTeacherID(reg.teacherId)}</p>
            </div>
            <div className="border-l pl-6">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Số tín chỉ</p>
              <p className="font-bold text-indigo-600">{reg.credits} Tín chỉ</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 mt-4">Học phí</p>
              <p className="font-bold text-emerald-600">{new Intl.NumberFormat('vi-VN').format(reg.fee)} VNĐ</p>
            </div>
          </div>
          <table className="w-full text-sm rounded-xl border border-gray-100 overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Thứ</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Ca học</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Phòng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(reg.schedules || []).map((s, i) => (
                <tr key={i} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-4">
                    <p className="font-bold text-gray-800">{s.dayLabel}</p>
                    <p className="text-[11px] text-indigo-600">{reg.studyStart} → {reg.studyEnd}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold text-xs">{s.shiftLabel}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100">{reg.room}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={onClose} className="w-full mt-8 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">
            ĐÓNG CỬA SỔ
          </button>
        </div>
      </div>
    </div>
  );
}

function LockOverlay({ onLogout }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
      <div className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
        <p className="text-gray-500 text-sm mb-8">Vui lòng liên hệ Phòng đào tạo.</p>
        <button type="button" onClick={onLogout} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">
          QUAY LẠI ĐĂNG NHẬP
        </button>
      </div>
    </div>
  );
}
