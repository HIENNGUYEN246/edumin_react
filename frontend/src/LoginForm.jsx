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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    event?.preventDefault?.();
    if (isSubmitting) return;

    const emailInput = email.trim();
    const passwordInput = password.trim();
    if (!emailInput || !passwordInput) {
      showToast('Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }

    setIsSubmitting(true);
    try {
      // Login now queries one account (and at most one profile) instead of
      // downloading every collection before checking credentials.
      const { user, profile } = await apiClient.login(emailInput, passwordInput);
      const accountStatus = user.status ?? profile?.status ?? 'Active';
      const lockReason = (user.lockReason ?? profile?.lockReason ?? '').trim();

      if (accountStatus === 'Locked') {
        showToast(
          lockReason
            ? `Tài khoản đã bị khóa. Lý do: ${lockReason}`
            : 'Tài khoản này đã bị khóa!'
        );
        return;
      }

      clearLegacyEntityStorage();
      const sessionUser = buildSessionUser(user, profile);
      sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));

      const destinations = {
        'dao-tao': '/pdt-dashboard',
        'giao-vien': '/gv-dashboard',
        'sinh-vien': '/sv-dashboard',
      };
      const roleLabels = {
        'dao-tao': 'Admin',
        'giao-vien': 'Giáo viên',
        'sinh-vien': 'Sinh viên',
      };
      showToast(`Đăng nhập ${roleLabels[user.role] || ''} thành công!`, 'success');
      navigate(destinations[user.role] || '/');
    } catch (error) {
      console.error('Error logging in:', error);
      showToast(
        error.message?.includes('401')
          ? 'Email hoặc mật khẩu không chính xác!'
          : 'Không thể kết nối tới API. Vui lòng thử lại.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60 w-80 font-bold text-white rounded-full py-3.5 shadow-xl transition-all transform hover:-translate-y-0.5 mt-2"
            >
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
