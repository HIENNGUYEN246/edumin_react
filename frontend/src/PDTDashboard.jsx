import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import teacherAPI from './services/teacherAPI';
import studentAPI from './services/studentAPI';
import registrationAPI from './services/registrationAPI';
import { isRegistrationExpired } from './utils/registrationUtils';

const PDTDashboard = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [submenuStates, setSubmenuStates] = useState({
    gv: false,
    sv: false,
    hp: false
  });
  const [dashboardStats, setDashboardStats] = useState({
    teacherCount: 0,
    studentCount: 0,
    activeCoursesCount: 0,
    revenueTotal: 0,
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    // Kiểm tra đăng nhập
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const [teachers, students, openRegs] = await Promise.all([
          teacherAPI.getAllTeachers({ fresh: true }),
          studentAPI.getAllStudents({ fresh: true }),
          registrationAPI.getOpenRegistrations({ fresh: true }),
        ]);

        const activeRegs = Array.isArray(openRegs)
          ? openRegs.filter((reg) => !isRegistrationExpired(reg) && reg.status !== 'Hết hạn/Chưa mở')
          : [];

        const activeCourseIds = [...new Set(activeRegs.map((reg) => reg.courseId).filter(Boolean))];
        const revenueTotal = activeRegs.reduce((sum, reg) => sum + Number(reg.fee || 0), 0);

        setDashboardStats({
          teacherCount: Array.isArray(teachers) ? teachers.length : 0,
          studentCount: Array.isArray(students) ? students.length : 0,
          activeCoursesCount: activeCourseIds.length,
          revenueTotal,
        });
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
      }
    };

    loadDashboardStats();
  }, []);

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

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    navigate('/');
  };

  const openChangePasswordModal = () => {
    setShowPasswordModal(true);
    setShowUserDropdown(false);
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

  const submitChangePassword = () => {
    const errors = {};
    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    // Reset errors
    setPasswordErrors({});

    // Validation
    if (!oldPassword) errors.oldPassword = 'Vui lòng nhập mật khẩu cũ';
    if (!newPassword) errors.newPassword = 'Vui lòng nhập mật khẩu mới';
    if (!confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu';

    if (Object.keys(errors).length === 0) {
      if (oldPassword !== currentUser.pass) {
        errors.oldPassword = 'Mật khẩu cũ không đúng';
      }

      if (newPassword.length < 6) {
        errors.newPassword = 'Mật khẩu phải ít nhất 6 ký tự trở lên';
      }

      if (newPassword !== confirmPassword) {
        errors.confirmPassword = 'Mật khẩu xác nhận không giống mật khẩu mới';
      }
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    // Update password
    const updatedUser = { ...currentUser, pass: newPassword };
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    alert("Đổi mật khẩu thành công!");
    closeChangePasswordModal();
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
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
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">15</span>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">{currentUser.hoTen || 'Admin Đào Tạo'}</p>
                <p className="text-xs text-gray-500">Đã đăng nhập</p>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.hoTen || 'Admin User')}&background=6366f1&color=fff`}
                className="w-10 h-10 rounded-full shadow-sm"
                alt="Avatar"
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
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <a href="#" className="flex items-center gap-3 p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                  <i className="fas fa-th-large w-5 text-center"></i> <span>Dashboard</span>
                </a>
              </li>

              <li>
                <button onClick={() => toggleSubmenu('gv')} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-user-tie w-5 text-center"></i>
                    <span>Giảng viên</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates.gv ? 'rotate-180' : ''}`}></i>
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuStates.gv ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li><button onClick={() => navigate('/pdt/manage-teachers')} className="block w-full text-left p-2 text-sm text-gray-500 hover:text-indigo-600 transition">Danh sách giảng viên</button></li>
                    <li><button type="button" onClick={() => navigate('/pdt/teacher-accounts')} className="block w-full text-left p-2 text-sm text-gray-500 hover:text-indigo-600 transition">Tài khoản giảng viên</button></li>
                  </ul>
                </div>
              </li>

              <li>
                <button onClick={() => toggleSubmenu('sv')} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-user-graduate w-5 text-center"></i>
                    <span>Sinh viên</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates.sv ? 'rotate-180' : ''}`}></i>
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuStates.sv ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li><button onClick={() => navigate('/pdt/manage-students')} className="block w-full text-left p-2 text-sm text-gray-500 hover:text-indigo-600 transition">Danh sách sinh viên</button></li>
                    <li><button type="button" onClick={() => navigate('/pdt/student-accounts')} className="block w-full text-left p-2 text-sm text-gray-500 hover:text-indigo-600 transition">Tài khoản sinh viên</button></li>
                  </ul>
                </div>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => navigate('/pdt/manage-departments')}
                  className="w-full flex items-center gap-3 p-3 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 rounded-lg transition-all"
                >
                  <i className="fa-solid fa-graduation-cap w-5 text-center"></i>
                  <span>Khoa</span>
                </button>
              </li>

              <li>
                <button onClick={() => toggleSubmenu('hp')} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-book-open w-5 text-center"></i>
                    <span>Học phần</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates.hp ? 'rotate-180' : ''}`}></i>
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuStates.hp ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li><button type="button" onClick={() => navigate('/pdt/manage-courses')} className="block p-2 text-sm text-gray-500 hover:text-indigo-600 transition w-full text-left">Danh sách học phần</button></li>
                    <li><button type="button" onClick={() => navigate('/pdt/course-registrations')} className="block p-2 text-sm text-gray-500 hover:text-indigo-600 transition w-full text-left">Đăng ký học phần</button></li>
                  </ul>
                </div>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-indigo-500 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
              <div className="z-10 relative">
                <p className="text-sm opacity-80 uppercase font-medium">Tổng Giáo Viên</p>
                <h3 className="text-3xl font-bold my-1">{dashboardStats.teacherCount.toLocaleString('vi-VN')}</h3>
                <div className="w-full bg-indigo-400 rounded-full h-1.5 mt-4">
                  <div className="bg-white h-1.5 rounded-full" style={{width: '80%'}}></div>
                </div>
                <p className="text-xs mt-2 italic">80% Đang hoạt động</p>
              </div>
              <i className="fas fa-user-tie absolute -right-4 -bottom-4 text-8xl opacity-10"></i>
            </div>

            <div className="bg-orange-400 p-6 rounded-2xl text-white shadow-lg shadow-orange-100 relative overflow-hidden">
              <div className="z-10 relative">
                <p className="text-sm opacity-80 uppercase font-medium">Sinh Viên Mới</p>
                <h3 className="text-3xl font-bold my-1">{dashboardStats.studentCount.toLocaleString('vi-VN')}</h3>
                <div className="w-full bg-orange-300 rounded-full h-1.5 mt-4">
                  <div className="bg-white h-1.5 rounded-full" style={{width: '50%'}}></div>
                </div>
                <p className="text-xs mt-2 italic">50% Tăng trưởng tháng này</p>
              </div>
              <i className="fas fa-user-graduate absolute -right-4 -bottom-4 text-8xl opacity-10"></i>
            </div>

            <div className="bg-purple-600 p-6 rounded-2xl text-white shadow-lg shadow-purple-200 relative overflow-hidden">
              <div className="z-10 relative">
                <p className="text-sm opacity-80 uppercase font-medium">Lớp học hoạt động</p>
                <h3 className="text-3xl font-bold my-1">{dashboardStats.activeCoursesCount.toLocaleString('vi-VN')}</h3>
                <div className="w-full bg-purple-500 rounded-full h-1.5 mt-4">
                  <div className="bg-white h-1.5 rounded-full" style={{width: '76%'}}></div>
                </div>
                <p className="text-xs mt-2 italic">Dựa trên lớp học đang mở</p>
              </div>
              <i className="fas fa-school absolute -right-4 -bottom-4 text-8xl opacity-10"></i>
            </div>

            <div className="bg-red-500 p-6 rounded-2xl text-white shadow-lg shadow-red-200 relative overflow-hidden">
              <div className="z-10 relative">
                <p className="text-sm opacity-80 uppercase font-medium">Doanh thu học phí</p>
                <h3 className="text-3xl font-bold my-1">{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(dashboardStats.revenueTotal)}đ</h3>
                <div className="w-full bg-red-400 rounded-full h-1.5 mt-4">
                  <div className="bg-white h-1.5 rounded-full" style={{width: '30%'}}></div>
                </div>
                <p className="text-xs mt-2 italic">30% Mục tiêu quý này</p>
              </div>
              <i className="fas fa-dollar-sign absolute -right-4 -bottom-4 text-8xl opacity-10"></i>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-gray-700">Thống kê Sinh viên</h4>
                <i className="fas fa-ellipsis-h text-gray-300"></i>
              </div>
              <div className="h-64 flex items-end justify-around gap-2">
                <div className="w-4 bg-indigo-500 rounded-t-sm" style={{height: '60%'}}></div>
                <div className="w-4 bg-indigo-100 rounded-t-sm" style={{height: '40%'}}></div>
                <div className="w-4 bg-indigo-500 rounded-t-sm" style={{height: '75%'}}></div>
                <div className="w-4 bg-indigo-100 rounded-t-sm" style={{height: '20%'}}></div>
                <div className="w-4 bg-indigo-500 rounded-t-sm" style={{height: '90%'}}></div>
                <div className="w-4 bg-indigo-100 rounded-t-sm" style={{height: '55%'}}></div>
                <div className="w-4 bg-indigo-500 rounded-t-sm" style={{height: '70%'}}></div>
              </div>
              <div className="flex justify-around mt-4 text-[10px] text-gray-400 font-bold uppercase">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
              <h4 className="font-bold text-gray-700 mb-6 text-left">Trạng thái học phí</h4>
              <div className="relative inline-block">
                <div className="w-48 h-48 rounded-full border-[15px] border-indigo-600 border-t-transparent border-r-indigo-100 flex items-center justify-center" style={{transform: 'rotate(45deg)'}}>
                  <div style={{transform: 'rotate(-45deg)'}} className="text-center">
                    <p className="text-xs text-gray-500">Đã thanh toán</p>
                    <p className="text-2xl font-bold text-gray-800">85%</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-600 rounded-full"></span> Xong</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-100 rounded-full"></span> Nợ</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h4 className="font-bold text-gray-700 mb-6">Hiệu quả Khuyến mãi</h4>
              <div className="h-48 relative overflow-hidden flex items-end">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,100 L0,70 C20,40 40,80 60,30 C80,10 100,40 100,40 L100,100 Z" fill="#ebf4ff"></path>
                  <path d="M0,70 C20,40 40,80 60,30 C80,10 100,40 100,40" stroke="#6366f1" strokeWidth="2" fill="none"></path>
                </svg>
              </div>
              <p className="text-xs text-center text-gray-400 mt-4">Theo dõi các đợt ưu đãi khóa học</p>
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
                <input
                  type="password"
                  name="oldPassword"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.oldPassword ? 'border-red-500' : ''}`}
                  placeholder="Nhập mật khẩu cũ"
                />
                {passwordErrors.oldPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                  placeholder="Tối thiểu 6 ký tự"
                />
                {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="Nhập lại mật khẩu mới"
                />
                {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">Hủy</button>
                <button onClick={submitChangePassword} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">Cập nhật</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDTDashboard;