import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from './services/api';
import { clearLegacyEntityStorage } from './utils/clearLegacyStorage';

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [usersData, setUsersData] = useState({ users: [], teachersData: [], studentsData: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { authData, initialized } = await apiClient.loadOrInitAuthData();
        setUsersData(authData);

        if (initialized) {
          showToast('Đã khởi tạo tài khoản mẫu và lưu lên API!', 'success');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Không tải được dữ liệu đăng nhập từ API. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const matchEmail = (accountEmail, inputEmail) =>
    accountEmail?.trim().toLowerCase() === inputEmail.trim().toLowerCase();

  const matchAccountPassword = (account, passwordInput) => {
    const accountPassword = account.pass ?? account.password;
    return accountPassword === passwordInput;
  };

  const findProfileByUser = (authData, user) => {
    if (!user || !user.role) return null;
    const emailKey = user.email?.trim().toLowerCase();
    const matcher = (item) =>
      String(item.userId) === String(user._id) ||
      matchEmail(item.email, emailKey || '') ||
      matchEmail(item.email, user.email || '');

    if (user.role === 'giao-vien') {
      return (authData.teachersData || []).find(matcher) || null;
    }

    if (user.role === 'sinh-vien') {
      return (authData.studentsData || []).find(matcher) || null;
    }

    return null;
  };

  const buildSessionUser = (user, profile) => {
    const fallbackName = user.hoTen || user.name || profile?.hoTen || profile?.name || '';
    return {
      ...user,
      ...profile,
      role: user.role || 'dao-tao',
      hoTen: profile?.hoTen || profile?.name || user.hoTen || user.name || fallbackName,
      name: profile?.name || profile?.hoTen || user.name || user.hoTen || fallbackName,
      avatar: profile?.avatar || user.avatar || '',
      userId: user._id,
      _id: user._id,
    };
  };

  const showToast = (message, type = 'error') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 3000)
    );

    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const handleLogin = async (event) => {
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    const emailInput = email.trim();
    const passwordInput = password.trim();

    if (!emailInput || !passwordInput) {
      showToast('Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }

    let authData = usersData;
    try {
      apiClient.clearAuthCache();
      const loaded = await apiClient.loadOrInitAuthData();
      authData = loaded.authData;
      setUsersData(authData);
    } catch (error) {
      console.error('Error refreshing auth data:', error);
      showToast('Không tải được dữ liệu đăng nhập. Vui lòng thử lại.');
      return;
    }

    // --- 1. Kiểm tra Phòng Đào Tạo (Admin) — dùng users từ API ---
    const pdtList = authData.users || [];
    const pdtAccount = pdtList.find(
      (u) => u.role === 'dao-tao' && matchEmail(u.email, emailInput) && matchAccountPassword(u, passwordInput)
    );

    if (pdtAccount) {
      clearLegacyEntityStorage();
      const userWithRole = buildSessionUser(pdtAccount, null);
      sessionStorage.setItem('currentUser', JSON.stringify(userWithRole));
      showToast('Đăng nhập Admin thành công!', 'success');
      setTimeout(() => navigate('/pdt-dashboard'), 1500);
      return;
    }

    // --- 2. Kiểm tra Giáo viên ---
    const teacherUser = pdtList.find(
      (u) => u.role === 'giao-vien' && matchEmail(u.email, emailInput) && matchAccountPassword(u, passwordInput)
    );

    if (teacherUser) {
      const profile = findProfileByUser(authData, teacherUser) || teacherUser;
      const accountStatus = teacherUser.status ?? profile?.status ?? 'Active';
      const lockReason = (teacherUser.lockReason ?? profile?.lockReason ?? '').trim();
      if (accountStatus === 'Locked') {
        showToast(
          lockReason
            ? `Tài khoản giáo viên đã bị khóa. Lý do: ${lockReason}`
            : 'Tài khoản giáo viên này đã bị khóa!'
        );
        return;
      }
      clearLegacyEntityStorage();
      const user = buildSessionUser(teacherUser, profile);
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      showToast('Đăng nhập Giáo viên thành công!', 'success');
      setTimeout(() => navigate('/gv-dashboard'), 1500);
      return;
    }

    const studentUser = pdtList.find(
      (u) => u.role === 'sinh-vien' && matchEmail(u.email, emailInput) && matchAccountPassword(u, passwordInput)
    );

    if (studentUser) {
      const profile = findProfileByUser(authData, studentUser) || studentUser;
      const accountStatus = studentUser.status ?? profile?.status ?? 'Active';
      const lockReason = (studentUser.lockReason ?? profile?.lockReason ?? '').trim();
      if (accountStatus === 'Locked') {
        showToast(
          lockReason
            ? `Tài khoản sinh viên đã bị khóa. Lý do: ${lockReason}`
            : 'Tài khoản sinh viên này đã bị khóa!'
        );
        return;
      }
      clearLegacyEntityStorage();
      const user = buildSessionUser(studentUser, profile);
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      showToast('Đăng nhập Sinh viên thành công!', 'success');
      setTimeout(() => navigate('/sv-dashboard'), 1500);
      return;
    }

    showToast('Email hoặc mật khẩu không chính xác!');
  };

  if (loading) {
    return (
      <div className="relative flex items-center justify-center h-screen overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-slate-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center h-screen overflow-hidden">
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300`}
          >
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} text-lg`} />
            <span className="font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 z-0">
        <img
          src="/loginform/assets/anhnentruong.jpg"
          alt="Background"
          className="w-full h-full object-cover blur-sm scale-105 brightness-90"
        />
      </div>

      <div className="relative z-10 max-w-[960px] bg-white/40 border border-white/30 grid grid-cols-2 items-center gap-16 p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="relative flex flex-shrink-0">
          <img
            src="/loginform/assets/background.svg"
            alt=""
            className="block w-[380px] h-[580px] object-cover rounded-2xl shadow-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/loginform/assets/logodaihoc.svg" alt="Logo" className="w-2/3" />
          </div>
        </div>

        <div className="max-w-80 grid gap-6">
          <div>
            <h1 className="text-5xl font-bold text-slate-800">Login</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative flex items-center">
              <div className="absolute left-1 w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-md z-10">
                <i className="fa-solid fa-envelope-open text-[10px]" />
              </div>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="text"
                placeholder="Email của bạn"
                className="w-80 bg-white/90 border border-slate-200 py-2.5 pl-12 pr-4 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 shadow-sm"
              />
            </div>

            <div className="relative flex items-center w-80">
              <div className="absolute left-1 w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-md z-10">
                <i className="fa-solid fa-lock text-[10px]" />
              </div>
              <input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Mật khẩu của bạn"
                className="w-full bg-white/90 border border-slate-200 py-2.5 pl-12 pr-12 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 w-9 h-9 flex items-center justify-center bg-transparent text-slate-500 hover:text-indigo-600 transition-all active:scale-90"
              >
                <i id="eye-icon" className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-[14px]`} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 w-80 font-bold text-white rounded-full py-3.5 shadow-xl transition-all transform hover:-translate-y-0.5 mt-2"
            >
              Đăng nhập
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
