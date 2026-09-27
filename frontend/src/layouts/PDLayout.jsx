import { useEffect, useState } from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';

function PDLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [submenuStates, setSubmenuStates] = useState({ gv: true, sv: false, hp: false });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user || user.role !== 'dao-tao') {
      navigate('/');
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  useEffect(() => {
    if (
      location.pathname.startsWith('/pdt/manage-teachers') ||
      location.pathname.startsWith('/pdt/teacher-accounts')
    ) {
      setSubmenuStates((prev) => ({ ...prev, gv: true, sv: false }));
    }
    if (
      location.pathname.startsWith('/pdt/manage-students') ||
      location.pathname.startsWith('/pdt/student-accounts')
    ) {
      setSubmenuStates((prev) => ({ ...prev, sv: true, gv: false }));
    }
    if (location.pathname.startsWith('/pdt/manage-departments')) {
      setSubmenuStates((prev) => ({ ...prev, gv: false, sv: false }));
    }
    if (
      location.pathname.startsWith('/pdt/manage-courses') ||
      location.pathname.startsWith('/pdt/course-registrations')
    ) {
      setSubmenuStates((prev) => ({ ...prev, hp: true, gv: false, sv: false }));
    }
  }, [location.pathname]);

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest('[data-user-menu]')) setShowUserDropdown(false);
    };
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  const toggleSubmenu = (menuKey) => {
    setSubmenuStates((prev) => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    navigate('/');
  };

  const closeChangePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
  };

  const submitChangePassword = () => {
    setPasswordErrors({});
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    const errors = {};

    if (!oldPassword) errors.oldPassword = 'Bắt buộc';
    if (!newPassword) errors.newPassword = 'Bắt buộc';
    if (!confirmPassword) errors.confirmPassword = 'Bắt buộc';
    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }

    const adminPass = currentUser.pass ?? currentUser.password;
    if (oldPassword !== adminPass) {
      setPasswordErrors({ oldPassword: 'Sai mật khẩu' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErrors({ newPassword: 'Tối thiểu 6 ký tự' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Không khớp' });
      return;
    }

    const updatedUser = { ...currentUser, pass: newPassword, password: newPassword };
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    alert('Đổi mật khẩu thành công!');
    closeChangePasswordModal();
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl" />
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
              15
            </span>
          </div>
          <div className="relative" data-user-menu>
            <div
              className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserDropdown((v) => !v);
              }}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">{currentUser.hoTen}</p>
                <p className="text-xs text-gray-500">Đã đăng nhập</p>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.hoTen)}&background=6366f1&color=fff`}
                className="w-10 h-10 rounded-full shadow-sm"
                alt="Admin"
              />
            </div>
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setShowUserDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <i className="fas fa-key mr-2" /> Đổi mật khẩu
                </button>
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/pdt-dashboard"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition ${
                      isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-th-large w-5 text-center" />
                  <span>Dashboard</span>
                </NavLink>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => toggleSubmenu('gv')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    submenuStates.gv ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <i className="fas fa-user-tie w-5 text-center" />
                    <span>Giảng viên</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates.gv ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${submenuStates.gv ? 'max-h-[200px]' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/pdt/manage-teachers"
                        className={({ isActive }) =>
                          `block p-2 text-sm transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600'}`
                        }
                      >
                        Danh sách giảng viên
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/pdt/teacher-accounts"
                        className={({ isActive }) =>
                          `block p-2 text-sm transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600'}`
                        }
                      >
                        Tài khoản giảng viên
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => toggleSubmenu('sv')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    submenuStates.sv ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <i className="fas fa-user-graduate w-5 text-center" />
                    <span>Sinh viên</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates.sv ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${submenuStates.sv ? 'max-h-[200px]' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/pdt/manage-students"
                        className={({ isActive }) =>
                          `block p-2 text-sm transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600'}`
                        }
                      >
                        Danh sách sinh viên
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/pdt/student-accounts"
                        className={({ isActive }) =>
                          `block p-2 text-sm transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600'}`
                        }
                      >
                        Tài khoản sinh viên
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>

              <li>
                <NavLink
                  to="/pdt/manage-departments"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600 font-bold'
                        : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fa-solid fa-graduation-cap w-5 text-center" />
                  <span>Khoa</span>
                </NavLink>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => toggleSubmenu('hp')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    submenuStates.hp ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <i className="fas fa-layer-group w-5 text-center" />
                    <span>Học phần</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuStates.hp ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${submenuStates.hp ? 'max-h-[200px]' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/pdt/manage-courses"
                        className={({ isActive }) =>
                          `block p-2 text-sm transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600'}`
                        }
                      >
                        Danh sách học phần
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/pdt/course-registrations"
                        className={({ isActive }) =>
                          `block p-2 text-sm transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600'}`
                        }
                      >
                        Đăng ký học phần
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Đổi mật khẩu</h3>
              <button type="button" onClick={closeChangePasswordModal} className="text-white hover:text-gray-200">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                ['oldPassword', 'Mật khẩu cũ'],
                ['newPassword', 'Mật khẩu mới'],
                ['confirmPassword', 'Xác nhận mật khẩu'],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="password"
                    value={passwordForm[field]}
                    onChange={(e) => {
                      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
                      setPasswordErrors((prev) => ({ ...prev, [field]: '' }));
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                      passwordErrors[field] ? 'border-red-500' : ''
                    }`}
                  />
                  {passwordErrors[field] && <p className="text-red-500 text-xs mt-1">{passwordErrors[field]}</p>}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                  Hủy
                </button>
                <button type="button" onClick={submitChangePassword} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDLayout;
