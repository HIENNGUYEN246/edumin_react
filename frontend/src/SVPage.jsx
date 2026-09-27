import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import apiClient from './services/api';
import studentAPI from './services/studentAPI';
import { useStudentLockMonitor } from './hooks/useStudentLockMonitor';

const SVPage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [submenuStates, setSubmenuStates] = useState({
    'hoc-tap': false
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [feedbackText, setFeedbackText] = useState('');
  const { showLockModal, lockReason, handleLogoutToLogin } = useStudentLockMonitor(currentUser);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user) {
      setCurrentUser(user);
    }
  }, []);

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

  const padID = (id) => {
    return "SV-" + String(id).padStart(3, '0');
  };

  const toggleSubmenu = (menuKey) => {
    setSubmenuStates(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const toggleUserDropdown = (e) => {
    e.stopPropagation();
    setShowUserDropdown(!showUserDropdown);
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
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
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const setFieldError = (field, message) => {
    setPasswordErrors(prev => ({ ...prev, [field]: message }));
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
      setFieldError('newPassword', 'Mật khẩu mới phải có ít nhất 6 ký tự');
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
      studentInfo?.password ||
      studentInfo?.pass ||
      currentUser?.password ||
      currentUser?.pass ||
      '';
    if (oldPassword !== realPassword) {
      setFieldError('oldPassword', 'Mật khẩu cũ không chính xác');
      return;
    }

    setSavingPassword(true);
    try {
      const updatedStudent = await studentAPI.updateStudentPassword(currentUser.email, newPassword);
      const updatedUser = { ...currentUser, ...updatedStudent, password: newPassword, role: 'sinh-vien' };
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setStudentInfo(updatedUser);

      closeChangePasswordModal();
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
    } catch (error) {
      console.error('Không lưu được mật khẩu lên API:', error);
      setFieldError('oldPassword', error.message || 'Không lưu được mật khẩu lên API');
    } finally {
      setSavingPassword(false);
    }
  };

  const submitFeedback = () => {
    if (!feedbackText.trim()) {
      alert('Vui lòng nhập nội dung đóng góp của bạn');
      return;
    }
    alert('Cảm ơn bạn! Phản hồi của bạn đã được ghi nhận vào hệ thống.');
    setFeedbackText('');
  };

  if (!currentUser) return null;

  const profile = studentInfo || currentUser;
  const displayName = profile.name || profile.hoTen || 'Sinh viên';
  const displayAvatar =
    profile.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Notification */}
      <div className={`fixed top-0 left-0 right-0 z-[9999] flex justify-center p-4 pointer-events-none transition-transform duration-500 ${showNotification ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-white border-l-4 border-green-500 shadow-2xl rounded-xl px-6 py-4 flex items-center gap-4 pointer-events-auto min-w-[300px]">
          <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-500">
            <i className="fas fa-check-circle text-xl"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Thành công!</p>
            <p className="text-xs text-gray-500">Mật khẩu của bạn đã được cập nhật thành công.</p>
          </div>
          <button onClick={() => setShowNotification(false)} className="ml-auto text-gray-400 hover:text-gray-600">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl"></i>
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl"></i>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">SV. {displayName}</p>
                <p className="text-[10px] text-gray-500 font-medium">
                  MSV: {profile.id ? padID(profile.id) : 'N/A'}
                </p>
              </div>
              <img
                src={displayAvatar}
                className="w-10 h-10 rounded-full shadow-sm object-cover"
                alt={displayName}
              />
            </div>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]">
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
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100 sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Học tập</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/sv-dashboard"
                  end
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-th-large w-5 text-center"></i> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button onClick={() => toggleSubmenu('hoc-tap')} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book-open w-5 text-center"></i>
                    <span>Học phần</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates['hoc-tap'] ? 'rotate-180' : ''}`}></i>
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuStates['hoc-tap'] ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/sv/documents"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                        Danh sách tài liệu
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/sv/assignments"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/sv/timetable"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-history w-5 text-center"></i>
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
                  <i className="fas fa-layer-group w-5 text-center"></i><span>Đăng ký học phần</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Tiến độ lớp học */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row items-center gap-8 border border-gray-50">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="text-gray-100" strokeWidth="4" stroke="currentColor"></circle>
                    <circle cx="18" cy="18" r="16" fill="none" className="text-indigo-600" strokeWidth="4" strokeDasharray="60, 100" strokeLinecap="round" stroke="currentColor"></circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-indigo-900">60%</div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h4 className="text-xl font-bold text-gray-800">Tiến độ lớp học</h4>
                  <p className="text-sm text-gray-400 mt-1 italic">"Sắp tới hạn nộp bài tập Giải thuật!"</p>
                  <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
                    <span className="bg-green-50 text-green-600 px-4 py-2 rounded-xl text-xs font-bold"><i className="fas fa-check-circle mr-1"></i> 12 Bài đã nộp</span>
                    <span className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-xs font-bold"><i className="fas fa-exclamation-circle mr-1"></i> 2 Bài chưa làm</span>
                  </div>
                </div>
              </div>

              {/* Bài tập & Tài liệu gần đây */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Bài tập & Tài liệu gần đây</h4>
                  <NavLink to="/sv/assignments" className="text-indigo-600 text-xs font-bold hover:underline">Xem tất cả</NavLink>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 border border-gray-50 rounded-3xl hover:bg-gray-50 transition group">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <i className="fas fa-file-pdf text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">Tài liệu: Cấu trúc dữ liệu mảng</p>
                      <p className="text-[10px] text-gray-400 mt-1">GV. Nguyễn Văn A • 2.4 MB</p>
                    </div>
                    <button className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition">XEM</button>
                  </div>
                  <div className="flex items-center gap-4 p-4 border border-gray-50 rounded-3xl hover:bg-gray-50 transition group">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                      <i className="fas fa-edit text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-600">Bài tập: Giải thuật tìm kiếm</p>
                      <p className="text-[10px] text-gray-400 mt-1 italic font-medium">Hết hạn trong: 2 ngày</p>
                    </div>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold shadow-lg shadow-red-100 hover:scale-105 transition">NỘP BÀI</button>
                  </div>
                </div>
              </div>

              {/* Lịch sử giao dịch */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                <h4 className="text-lg font-bold text-gray-800 mb-6 uppercase tracking-wide">Lịch sử giao dịch</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] text-gray-400 uppercase font-bold tracking-widest border-b">
                      <tr>
                        <th className="pb-4">Nội dung thanh toán</th>
                        <th className="pb-4 text-center">Ngày</th>
                        <th className="pb-4 text-right">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr className="border-b border-gray-50">
                        <td className="py-4 font-bold text-gray-700">Học phí kỳ 2 - Khóa K16</td>
                        <td className="py-4 text-center text-gray-400">12/01/2024</td>
                        <td className="py-4 text-right text-green-600 font-bold">- 12.000.000đ</td>
                      </tr>
                      <tr>
                        <td className="py-4 font-bold text-gray-700">Lệ phí thi lại môn C++</td>
                        <td className="py-4 text-center text-gray-400">05/02/2024</td>
                        <td className="py-4 text-right text-green-600 font-bold">- 200.000đ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Feedback Giảng viên */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                    <i className="fas fa-comment-dots"></i>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Feedback Giảng viên</h4>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Nội dung học phần</label>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 rounded-xl border border-gray-100 text-xs font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition">Tốt</button>
                      <button className="flex-1 py-2 rounded-xl border border-gray-100 text-xs font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition">Ổn</button>
                      <button className="flex-1 py-2 rounded-xl border border-gray-100 text-xs font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition">Cần cải thiện</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Chất lượng tài liệu</label>
                    <div className="flex justify-around bg-gray-50 p-2 rounded-2xl">
                      <i className="fas fa-star text-yellow-400 cursor-pointer"></i>
                      <i className="fas fa-star text-yellow-400 cursor-pointer"></i>
                      <i className="fas fa-star text-yellow-400 cursor-pointer"></i>
                      <i className="fas fa-star text-yellow-400 cursor-pointer"></i>
                      <i className="far fa-star text-gray-300 cursor-pointer"></i>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Đóng góp ý kiến</label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full h-24 p-4 bg-gray-50 border-none rounded-2xl text-xs text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
                      placeholder="Viết cảm nghĩ hoặc góp ý của bạn về tiết học hôm nay..."
                    ></textarea>
                  </div>
                  <button onClick={submitFeedback} className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95">
                    Gửi phản hồi ngay
                  </button>
                </div>
              </div>

              {/* Điểm trung bình */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
                <i className="fas fa-quote-right absolute top-4 right-4 text-white/10 text-6xl"></i>
                <h4 className="text-sm font-medium opacity-80 mb-1">Điểm trung bình</h4>
                <p className="text-4xl font-black mb-4">3.8 / 4.0</p>
                <div className="h-1.5 w-full bg-white/20 rounded-full">
                  <div className="h-full bg-white w-[92%] rounded-full shadow-sm"></div>
                </div>
                <p className="text-[10px] mt-4 font-bold uppercase tracking-widest opacity-60">Xếp loại: Xuất sắc</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Password Change Modal */}
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
                <div className="password-container relative">
                  <input
                    type={passwordVisibility.oldPassword ? "text" : "password"}
                    name="oldPassword"
                    value={passwordForm.oldPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.oldPassword ? 'border-red-500' : ''}`}
                    placeholder="Nhập mật khẩu cũ"
                  />
                  <i
                    className={`fas ${passwordVisibility.oldPassword ? 'fa-eye-slash' : 'fa-eye'} toggle-password absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('oldPassword')}
                  ></i>
                </div>
                {passwordErrors.oldPassword && <p className="text-red-500 text-[10px] mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <div className="password-container relative">
                  <input
                    type={passwordVisibility.newPassword ? "text" : "password"}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <i
                    className={`fas ${passwordVisibility.newPassword ? 'fa-eye-slash' : 'fa-eye'} toggle-password absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('newPassword')}
                  ></i>
                </div>
                {passwordErrors.newPassword && <p className="text-red-500 text-[10px] mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <div className="password-container relative">
                  <input
                    type={passwordVisibility.confirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <i
                    className={`fas ${passwordVisibility.confirmPassword ? 'fa-eye-slash' : 'fa-eye'} toggle-password absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                  ></i>
                </div>
                {passwordErrors.confirmPassword && <p className="text-red-500 text-[10px] mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">Hủy</button>
                <button
                  type="button"
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

      {/* Lock Modal */}
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

export default SVPage;