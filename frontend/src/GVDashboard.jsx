import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import apiClient from './services/api';
import teacherAPI from './services/teacherAPI';
import { useTeacherLockMonitor } from './hooks/useTeacherLockMonitor';

const GVDashboard = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordVisibility, setPasswordVisibility] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [toasts, setToasts] = useState([]);
  const { showLockModal, lockReason, handleLogoutToLogin } = useTeacherLockMonitor(currentUser);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.email) return;
    updateTeacherProfile();
  }, [currentUser?.email]);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserDropdown(false);
    };

    if (showUserDropdown) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showUserDropdown]);

  useEffect(() => {
    if (!currentUser) return;

    const heartbeatTimer = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(heartbeatTimer);
  }, [currentUser]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const updateTeacherProfile = async () => {
    const emailKey = currentUser.email?.trim().toLowerCase();
    if (!emailKey) return;

    const mergeFromAccount = (account) => {
      const merged = { ...currentUser, ...account };
      setTeacherInfo(merged);
      setCurrentUser(merged);
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
    };

    try {
      const teachers = await teacherAPI.getAllTeachers({ fresh: true });
      const teacher = teachers.find((t) => t.email?.trim().toLowerCase() === emailKey);
      if (teacher) {
        mergeFromAccount(teacher);
        return;
      }
    } catch (error) {
      console.error('Không tải hồ sơ giáo viên từ API:', error);
    }

    setTeacherInfo(currentUser);
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const toggleUserDropdown = (e) => {
    e.stopPropagation();
    setShowUserDropdown((prev) => !prev);
  };

  const openChangePasswordModal = () => {
    setShowPasswordModal(true);
    setShowUserDropdown(false);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setPasswordVisibility({ oldPassword: false, newPassword: false, confirmPassword: false });
  };

  const closeChangePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const setFieldError = (field, message) => {
    setPasswordErrors((prev) => ({ ...prev, [field]: message }));
  };

  const submitChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    setPasswordErrors({});

    if (!oldPassword) {
      setFieldError('oldPassword', 'Vui lòng nhập mật khẩu cũ');
      return;
    }
    if (!newPassword) {
      setFieldError('newPassword', 'Vui lòng nhập mật khẩu mới');
      return;
    }
    if (!confirmPassword) {
      setFieldError('confirmPassword', 'Vui lòng xác nhận mật khẩu mới');
      return;
    }
    if (newPassword.length < 6) {
      setFieldError('newPassword', 'Mật khẩu mới phải từ 6 ký tự');
      return;
    }
    if (newPassword === oldPassword) {
      setFieldError('newPassword', 'Mật khẩu mới không được trùng mật khẩu cũ');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError('confirmPassword', 'Xác nhận mật khẩu không khớp');
      return;
    }

    const realPassword =
      teacherInfo?.password ||
      teacherInfo?.pass ||
      currentUser?.password ||
      currentUser?.pass ||
      '';
    if (oldPassword !== realPassword) {
      setFieldError('oldPassword', 'Mật khẩu cũ không chính xác');
      return;
    }

    setSavingPassword(true);
    try {
      const updatedTeacher = await teacherAPI.updateTeacherPassword(currentUser.email, newPassword);

      const updatedUser = { ...currentUser, ...updatedTeacher, password: newPassword };
      setCurrentUser(updatedUser);
      setTeacherInfo(updatedUser);
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

      showToast('Đã cập nhật mật khẩu mới thành công!', 'success');
      setTimeout(() => closeChangePasswordModal(), 500);
    } catch (error) {
      console.error('Không lưu được mật khẩu lên API:', error);
      showToast(error.message || 'Không lưu được mật khẩu lên API. Vui lòng thử lại.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const padID = (id) => `GV-${String(id).padStart(3, '0')}`;

  const sendHeartbeat = () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user || !user.email) return;
    const heartbeats = JSON.parse(localStorage.getItem('user_heartbeats')) || {};
    heartbeats[user.email] = Date.now();
    localStorage.setItem('user_heartbeats', JSON.stringify(heartbeats));
  };

  const handleLogout = () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user && user.email) {
      const heartbeats = JSON.parse(localStorage.getItem('user_heartbeats')) || {};
      delete heartbeats[user.email];
      localStorage.setItem('user_heartbeats', JSON.stringify(heartbeats));
    }
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300`}
          >
            <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} />
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl"></i>
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl"></i>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">5</span>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">GV. {teacherInfo?.name || currentUser.hoTen || 'Giáo viên'}</p>
                <p className="text-xs text-gray-500">Đã đăng nhập</p>
              </div>
              <img
                src={teacherInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherInfo?.name || currentUser.hoTen || 'GV')}&background=6366f1&color=fff`}
                alt="Avatar"
                className="w-10 h-10 rounded-full shadow-sm object-cover"
              />
            </div>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]" onClick={(e) => e.stopPropagation()}>
                <button onClick={openChangePasswordModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <i className="fas fa-key mr-2"></i> Đổi mật khẩu
                </button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <i className="fas fa-sign-out-alt mr-2"></i> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/gv-dashboard"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-th-large w-5 text-center"></i> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button onClick={() => setSubmenuOpen((prev) => !prev)} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book w-5 text-center"></i>
                    <span>Bài tập & Tài liệu</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuOpen ? 'rotate-180' : ''}`}></i>
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuOpen ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/gv/assignments"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/gv/documents"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                        Danh sách tài liệu
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
              <li>
                <NavLink
                  to="/gv/classes"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-chart-pie w-5 text-center"></i>
                  <span>Danh sách lớp dạy</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/gv/schedule"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-history w-5 text-center"></i><span>Thời khoá biểu</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <i className="fas fa-file-signature"></i>
                </div>
                <span className="text-blue-500 text-[10px] font-bold bg-blue-50 px-2 py-1 rounded-lg">+12%</span>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">Bài tập đã giao</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">24</h3>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-orange-50 p-3 rounded-xl text-orange-500">
                  <i className="fas fa-folder-open"></i>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">Tài liệu học tập</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">156</h3>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4">
                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: '50%' }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                  <i className="fas fa-user-edit"></i>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">SV đã nộp bài</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">88%</h3>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4">
                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-red-50 p-3 rounded-xl text-red-500">
                  <i className="fas fa-star"></i>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">Điểm trung bình</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">7.8</h3>
              <p className="text-[9px] text-red-400 mt-4 font-bold">THEO ĐÁNH GIÁ</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-lg font-bold text-gray-700">Bài tập mới nhất</h4>
                  <p className="text-xs text-gray-400">Quản lý và chỉnh sửa thông tin</p>
                </div>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition">
                  <i className="fas fa-plus mr-2"></i> ĐĂNG BÀI
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase">
                    <tr>
                      <th className="p-4 font-semibold">Tên bài tập</th>
                      <th className="p-4 font-semibold text-center">Lớp</th>
                      <th className="p-4 font-semibold text-center">Hạn nộp</th>
                      <th className="p-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50 transition">
                      <td className="p-4">
                        <p className="font-bold text-gray-800">Giải thuật tìm kiếm</p>
                        <p className="text-[10px] text-gray-400"><i className="fas fa-paperclip mr-1"></i>chuong1.pdf</p>
                      </td>
                      <td className="p-4 text-center text-gray-500">CNTT-K15</td>
                      <td className="p-4 text-center">
                        <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-[10px] font-bold">20/02/2026</span>
                      </td>
                      <td className="p-4 text-right space-x-1">
                        <button className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition"><i className="fas fa-edit"></i></button>
                        <button className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition"><i className="fas fa-trash-alt"></i></button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="text-lg font-bold text-gray-700 mb-6">Tiến độ lớp học</h4>
              <div className="flex flex-col items-center py-4">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="text-gray-100" strokeWidth="3" stroke="currentColor"></circle>
                    <circle cx="18" cy="18" r="16" fill="none" className="text-indigo-600" strokeWidth="3" strokeDasharray="75, 100" strokeLinecap="round" stroke="currentColor"></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-indigo-900">75%</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Xong</span>
                  </div>
                </div>
                <div className="w-full mt-8 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-medium text-gray-500 uppercase">Thời gian học</span>
                    <span className="font-bold text-gray-800 text-xs">12/15 TUẦN</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-medium text-gray-500 uppercase">Sĩ số lớp</span>
                    <span className="font-bold text-gray-800 text-xs">45/45 EM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h4 className="text-lg font-bold text-gray-700 mb-6 uppercase tracking-wide">Đánh giá & Tổng kết</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-100 rounded-2xl flex items-center gap-4 hover:border-indigo-300 transition">
                <img src="https://ui-avatars.com/api/?name=SV+1&background=f0f3ff&color=4f46e5" className="w-12 h-12 rounded-xl" alt="SV 1" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">Trần Văn Bình</p>
                  <p className="text-xs text-indigo-500 font-bold">TB: 8.5</p>
                </div>
                <button className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-600 hover:text-white transition">Đánh giá</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Đổi mật khẩu</h3>
              <button onClick={closeChangePasswordModal} className="text-white hover:text-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu cũ</label>
                <div className="relative">
                  <input
                    type={passwordVisibility.oldPassword ? 'text' : 'password'}
                    name="oldPassword"
                    value={passwordForm.oldPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.oldPassword ? 'border-red-500' : ''}`}
                    placeholder="Nhập mật khẩu cũ"
                  />
                  <i
                    className={`fas ${passwordVisibility.oldPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('oldPassword')}
                  ></i>
                </div>
                {passwordErrors.oldPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={passwordVisibility.newPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <i
                    className={`fas ${passwordVisibility.newPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('newPassword')}
                  ></i>
                </div>
                {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <div className="relative">
                  <input
                    type={passwordVisibility.confirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <i
                    className={`fas ${passwordVisibility.confirmPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                  ></i>
                </div>
                {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">Hủy</button>
                <button
                  onClick={submitChangePassword}
                  disabled={savingPassword}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingPassword ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"></div>
          <div className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 text-center border-4 border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-user-lock text-red-500 text-3xl animate-pulse"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <p className="text-gray-500 text-sm mb-4">
              Tài khoản của bạn đã bị phòng đào tạo tạm khóa. Vui lòng liên hệ quản trị để được hỗ trợ.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8">
              <p className="text-red-600 text-xs font-bold uppercase mb-1">Lý do từ phòng đào tạo:</p>
              <p className="text-red-600 font-semibold text-sm">{lockReason}</p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLogoutToLogin}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
              >
                QUAY VỀ TRANG ĐĂNG NHẬP
              </button>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Vui lòng liên hệ hỗ trợ để mở khóa</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GVDashboard;
