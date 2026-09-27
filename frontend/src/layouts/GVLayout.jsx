import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import teacherAPI from '../services/teacherAPI';
import { useTeacherLockMonitor } from '../hooks/useTeacherLockMonitor';

export default function GVLayout({ children }) {
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
    if (!user || user.role !== 'giao-vien') {
      navigate('/');
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  useEffect(() => {
    if (!currentUser?.email) return;
    const emailKey = currentUser.email.trim().toLowerCase();
    teacherAPI.getAllTeachers({ fresh: true }).then((teachers) => {
      const teacher = teachers.find((t) => t.email?.trim().toLowerCase() === emailKey);
      if (teacher) {
        const merged = { ...currentUser, ...teacher };
        setTeacherInfo(merged);
        setCurrentUser(merged);
        sessionStorage.setItem('currentUser', JSON.stringify(merged));
      } else {
        setTeacherInfo(currentUser);
      }
    }).catch(() => setTeacherInfo(currentUser));
  }, [currentUser?.email]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const showToast = (message, type = 'error') => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), message, type }]);
  };

  const handleLogout = () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user?.email) {
      const heartbeats = JSON.parse(localStorage.getItem('user_heartbeats') || '{}');
      delete heartbeats[user.email];
      localStorage.setItem('user_heartbeats', JSON.stringify(heartbeats));
    }
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
  };

  const submitChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    setPasswordErrors({});
    if (!oldPassword || !newPassword || !confirmPassword) return;
    if (newPassword.length < 6) {
      setPasswordErrors({ newPassword: 'Tối thiểu 6 ký tự' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Không khớp' });
      return;
    }
    const realPassword = teacherInfo?.password || teacherInfo?.pass || '';
    if (oldPassword !== realPassword) {
      setPasswordErrors({ oldPassword: 'Sai mật khẩu' });
      return;
    }
    setSavingPassword(true);
    try {
      const updated = await teacherAPI.updateTeacherPassword(currentUser.email, newPassword);
      const merged = { ...currentUser, ...updated, password: newPassword };
      setCurrentUser(merged);
      setTeacherInfo(merged);
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
      showToast('Đổi mật khẩu thành công!', 'success');
      setShowPasswordModal(false);
    } catch (e) {
      showToast(e.message || 'Lỗi lưu mật khẩu', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!currentUser) return null;

  return (
    <GVShell
      toasts={toasts}
      teacherInfo={teacherInfo}
      currentUser={currentUser}
      showUserDropdown={showUserDropdown}
      setShowUserDropdown={setShowUserDropdown}
      showPasswordModal={showPasswordModal}
      setShowPasswordModal={setShowPasswordModal}
      passwordForm={passwordForm}
      setPasswordForm={setPasswordForm}
      passwordVisibility={passwordVisibility}
      setPasswordVisibility={setPasswordVisibility}
      passwordErrors={passwordErrors}
      savingPassword={savingPassword}
      submitChangePassword={submitChangePassword}
      handleLogout={handleLogout}
      submenuOpen={submenuOpen}
      setSubmenuOpen={setSubmenuOpen}
      showLockModal={showLockModal}
      lockReason={lockReason}
      handleLogoutToLogin={handleLogoutToLogin}
    >
      {children}
    </GVShell>
  );
}

function GVShell({
  children,
  toasts,
  teacherInfo,
  currentUser,
  showUserDropdown,
  setShowUserDropdown,
  showPasswordModal,
  setShowPasswordModal,
  passwordForm,
  setPasswordForm,
  passwordVisibility,
  setPasswordVisibility,
  passwordErrors,
  savingPassword,
  submitChangePassword,
  handleLogout,
  submenuOpen,
  setSubmenuOpen,
  showLockModal,
  lockReason,
  handleLogoutToLogin,
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <style>{`
        .submenu-container { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-in-out; }
        .submenu-container.open { max-height: 300px; }
        .password-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #9ca3af; }
        .tkb-table { width: 100%; border-collapse: collapse; background: white; table-layout: fixed; }
        .tkb-table th, .tkb-table td { border: 1px solid #e2e8f0; height: 180px; vertical-align: top; padding: 8px; position: relative; }
        .tkb-table th { height: auto; background-color: #fff; color: #4f46e5; padding: 15px 5px; font-weight: 700; }
        .tkb-table .ca-hoc-col { width: 80px; background-color: #f8fafc; color: #1e293b; font-weight: 700; vertical-align: middle; text-align: center; height: auto !important; }
        .tkb-cell { background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 20px 20px; }
        .course-card { color: white; padding: 10px; border-radius: 8px; font-size: 12px; margin-bottom: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-left: 4px solid rgba(0,0,0,0.2); transition: transform 0.2s; cursor: pointer; }
        .course-card:hover { transform: translateY(-2px); }
        .course-name { font-weight: 700; display: block; margin-bottom: 2px; text-transform: uppercase; line-height: 1.2; }
        .course-info { font-size: 11px; opacity: 0.95; line-height: 1.4; }
      `}</style>

      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>

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
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">5</span>
          </div>
          <div className="relative">
            <div
              className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserDropdown((v) => !v);
              }}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">GV. {teacherInfo?.name || currentUser.hoTen || 'Giáo viên'}</p>
                <p className="text-xs text-gray-500 font-medium">Đã đăng nhập</p>
              </div>
              <img
                src={teacherInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherInfo?.name || 'GV')}&background=6366f1&color=fff`}
                alt="Avatar"
                className="w-10 h-10 rounded-full shadow-sm object-cover border border-gray-100"
              />
            </div>
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { setShowPasswordModal(true); setShowUserDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <i className="fas fa-key mr-2" /> Đổi mật khẩu
                </button>
                <button type="button" onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <i className="fas fa-sign-out-alt mr-2" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100 sticky top-[73px] h-[calc(100vh-73px)]">
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
                  <i className="fas fa-th-large w-5 text-center" /> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button type="button" onClick={() => setSubmenuOpen((p) => !p)} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book w-5 text-center" />
                    <span>Bài tập & Tài liệu</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuOpen ? 'max-h-32 open' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/gv/assignments"
                        className={({ isActive }) =>
                          `block p-2 text-sm rounded-lg transition ${
                            isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                          }`
                        }
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/gv/documents"
                        className={({ isActive }) =>
                          `block p-2 text-sm rounded-lg transition ${
                            isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                          }`
                        }
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
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-chart-pie w-5 text-center" />
                  <span>Danh sách lớp dạy</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/gv/schedule"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-history w-5 text-center" />
                  <span>Thời khoá biểu</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {showPasswordModal && (
        <PasswordModal
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          passwordVisibility={passwordVisibility}
          setPasswordVisibility={setPasswordVisibility}
          passwordErrors={passwordErrors}
          savingPassword={savingPassword}
          onClose={() => setShowPasswordModal(false)}
          onSubmit={submitChangePassword}
        />
      )}

      {showLockModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
          <div className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 text-center border-4 border-red-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <p className="text-red-600 text-sm mb-8">{lockReason}</p>
            <button type="button" onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">
              QUAY LẠI ĐĂNG NHẬP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3`}>
      <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} />
      <span className="font-bold text-sm">{toast.message}</span>
    </div>
  );
}

function PasswordModal({ passwordForm, setPasswordForm, passwordVisibility, setPasswordVisibility, passwordErrors, savingPassword, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <PasswordModalInner
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          passwordVisibility={passwordVisibility}
          setPasswordVisibility={setPasswordVisibility}
          passwordErrors={passwordErrors}
          savingPassword={savingPassword}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function PasswordModalInner({ passwordForm, setPasswordForm, passwordVisibility, setPasswordVisibility, passwordErrors, savingPassword, onClose, onSubmit }) {
  const fields = ['oldPassword', 'newPassword', 'confirmPassword'];
  const labels = ['Mật khẩu cũ', 'Mật khẩu mới', 'Xác nhận mật khẩu'];
  return (
    <>
      <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
        <h3 className="font-bold">Đổi mật khẩu</h3>
        <button type="button" onClick={onClose} className="text-white"><i className="fas fa-times" /></button>
      </div>
      <div className="p-6 space-y-4">
        {fields.map((field, i) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{labels[i]}</label>
            <div className="relative">
              <input
                type={passwordVisibility[field] ? 'text' : 'password'}
                value={passwordForm[field]}
                onChange={(e) => setPasswordForm((p) => ({ ...p, [field]: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
              />
              <i
                className={`fas ${passwordVisibility[field] ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                onClick={() => setPasswordVisibility((p) => ({ ...p, [field]: !p[field] }))}
              />
            </div>
            {passwordErrors[field] && <p className="text-red-500 text-xs mt-1">{passwordErrors[field]}</p>}
          </div>
        ))}
        <PasswordActions onClose={onClose} onSubmit={onSubmit} savingPassword={savingPassword} />
      </div>
    </>
  );
}

function PasswordActions({ onClose, onSubmit, savingPassword }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium">Hủy</button>
      <button type="button" disabled={savingPassword} onClick={onSubmit} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-60">Cập nhật</button>
    </div>
  );
}
