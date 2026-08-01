import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import studentAPI from '../services/studentAPI';
import assignmentAPI from '../services/assignmentAPI';
import { fetchOpenRegistrations, fetchStudentRegistrations } from '../utils/registrationUtils';
import { useStudentLockMonitor } from '../hooks/useStudentLockMonitor';

const StudentAssignmentList = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const { showLockModal, handleLogoutToLogin } = useStudentLockMonitor(currentUser);

  useEffect(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.email) return;
      try {
        const [students, regs, allAssignments, openRegs] = await Promise.all([
          studentAPI.getAllStudents({ fresh: true }),
          fetchStudentRegistrations({ fresh: true }),
          assignmentAPI.getAllAssignments({ fresh: true }),
          fetchOpenRegistrations({ fresh: true }),
        ]);
        const matched = students.find((s) => s.email?.trim().toLowerCase() === currentUser.email?.trim().toLowerCase());
        const merged = matched ? { ...currentUser, ...matched, role: 'sinh-vien' } : currentUser;
        setStudentInfo(merged);
        setCurrentUser(merged);
        sessionStorage.setItem('currentUser', JSON.stringify(merged));
        const myRegs = regs.filter((reg) => String(reg.studentId) === String(merged.id));
        const enrichedRegs = myRegs.map((reg) => {
          const match = openRegs.find((o) => o.id === reg.regId || o.courseId === reg.courseId);
          return {
            ...match,
            ...reg,
            courseName: match?.courseName || reg?.courseName || '',
          };
        });
        setEnrollments(enrichedRegs);
        setAssignments(allAssignments || []);
      } catch (error) {
        console.error('Không tải được dữ liệu bài tập sinh viên:', error);
      }
    };
    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const addToast = (message, type = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const myCourses = useMemo(() => {
    const list = [];
    const seen = new Set();
    enrollments.forEach((reg) => {
      if (!seen.has(reg.courseId)) {
        seen.add(reg.courseId);
        list.push(reg);
      }
    });
    return list;
  }, [enrollments]);

  const displayedDocs = useMemo(() => {
    if (!selectedCourseId) return [];
    return assignments.filter((doc) => doc.courseId === selectedCourseId && doc.status === 'Công khai');
  }, [assignments, selectedCourseId]);

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
    if (['jpg', 'png', 'jpeg'].includes(ext)) return 'fa-file-image';
    return 'fa-file-alt';
  };

  const handleDownload = (id) => {
    const doc = assignments.find((item) => item.id === id);
    if (!doc || !doc.content) {
      addToast('Không tìm thấy nội dung file', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Bắt đầu tải xuống...', 'success');
  };

  const toggleUserDropdown = (event) => {
    event.stopPropagation();
    setShowUserDropdown((prev) => !prev);
  };

  useEffect(() => {
    const closeDropdown = () => setShowUserDropdown(false);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    navigate('/');
  };

  const openChangePasswordModal = () => {
    setPasswordErrors({});
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
    setShowUserDropdown(false);
  };

  const closeChangePasswordModal = () => {
    setPasswordErrors({});
    setShowPasswordModal(false);
  };

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const submitChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    const errors = {};
    if (!oldPassword) errors.oldPassword = 'Vui lòng nhập mật khẩu cũ';
    if (!newPassword) errors.newPassword = 'Vui lòng nhập mật khẩu mới';
    if (!confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    if (newPassword && newPassword.length < 6) errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
    if (newPassword && oldPassword && newPassword === oldPassword) errors.newPassword = 'Mật khẩu mới không được trùng mật khẩu cũ';
    if (newPassword && confirmPassword && newPassword !== confirmPassword) errors.confirmPassword = 'Xác nhận mật khẩu không khớp';
    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }

    const savedPassword = studentInfo?.password || currentUser?.password || currentUser?.pass || '';
    if (oldPassword !== savedPassword) {
      setPasswordErrors({ oldPassword: 'Mật khẩu cũ không chính xác' });
      return;
    }

    setSavingPassword(true);
    try {
      const updated = await studentAPI.updateStudentPassword(currentUser.email, newPassword);
      const merged = { ...currentUser, ...updated, password: newPassword };
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
      setCurrentUser(merged);
      setStudentInfo(merged);
      addToast('Cập nhật mật khẩu thành công!', 'success');
      setShowPasswordModal(false);
    } catch (error) {
      console.error(error);
      setPasswordErrors({ oldPassword: error.message || 'Không lưu được mật khẩu lên API' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  const displayName = studentInfo?.hoTen || studentInfo?.name || currentUser.hoTen || 'Sinh viên';
  const displayAvatar = studentInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300`}>
            <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} />
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg"><i className="fas fa-graduation-cap text-white text-xl" /></div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </div>
          <div className="relative" data-user-dropdown>
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">SV. {displayName}</p>
                <p className="text-[10px] text-gray-500 font-medium">MSV: {studentInfo?.id ? `SV-${String(studentInfo.id).padStart(3, '0')}` : 'N/A'}</p>
              </div>
              <img src={displayAvatar} alt="Avatar" className="w-10 h-10 rounded-full shadow-sm object-cover" />
            </div>
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]">
                <button onClick={openChangePasswordModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <i className="fas fa-key mr-2" /> Đổi mật khẩu
                </button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
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
                <NavLink
                  to="/sv-dashboard"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-th-large w-5 text-center" /> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button type="button" className="w-full flex items-center justify-between p-3 text-indigo-600 bg-indigo-50 rounded-lg transition-all">
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
                <NavLink
                  to="/sv/timetable"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-history w-5 text-center" />
                  <span>Thời khoá biểu</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/sv/course-registration"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-layer-group w-5 text-center" />
                  <span>Đăng ký học phần</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Danh sách bài tập</h2>
              <p className="text-sm text-gray-500">Xem và tải bài tập từ các học phần đã đăng ký.</p>
            </div>
            <div className="w-full md:w-auto">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full md:w-72 px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700 shadow-sm transition-all"
              >
                <option value="">-- Chọn học phần --</option>
                {myCourses.map((course) => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.courseId} - {course.courseName || 'Tên học phần chưa rõ'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tên bài tập</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Ngày tạo</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Cập nhật cuối</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Kích thước</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {!selectedCourseId ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">
                        Vui lòng chọn học phần để xem bài tập
                      </td>
                    </tr>
                  ) : displayedDocs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">
                        Chưa có bài tập nào được giao cho học phần này.
                      </td>
                    </tr>
                  ) : (
                    displayedDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition relative">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                              <i className={`fas ${getFileIcon(doc.name)} text-lg`} />
                            </div>
                            <span className="font-bold text-gray-800">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-500">{doc.created || formatDate(doc.createdAt || doc.updatedAt || new Date())}</td>
                        <td className="px-6 py-4 text-center text-gray-500 italic">{doc.modifiedBy || 'Không rõ'}</td>
                        <td className="px-6 py-4 text-center text-gray-600 font-bold">{doc.size || '—'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">{doc.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right relative">
                          <button onClick={() => handleDownload(doc.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] rounded-lg shadow-md font-bold hover:bg-indigo-700">
                            Tải bài tập
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Đổi mật khẩu</h3>
              <button onClick={closeChangePasswordModal} className="text-white hover:text-gray-200">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu cũ</label>
                <input
                  name="oldPassword"
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.oldPassword ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Nhập mật khẩu cũ"
                />
                {passwordErrors.oldPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.newPassword ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Tối thiểu 6 ký tự"
                />
                {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Nhập lại mật khẩu mới"
                />
                {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
                  Hủy
                </button>
                <button onClick={submitChangePassword} disabled={savingPassword} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
                  {savingPassword ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 p-8 text-center border-4 border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-user-lock text-red-500 text-3xl animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <p className="text-red-600 font-semibold text-sm mb-4">Tài khoản của bạn đã bị tạm khóa.</p>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">Vui lòng liên hệ Phòng đào tạo để được hỗ trợ mở khóa tài khoản.</p>
            <button onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
              QUAY LẠI ĐĂNG NHẬP
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAssignmentList;
