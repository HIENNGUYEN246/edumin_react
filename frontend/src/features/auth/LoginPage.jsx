import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { roleHome } from '../../app/navConfig.js';
import { RegisterForm } from './RegisterForm.jsx';

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { login, register, isAuthenticated, user } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setShowPassword(false);
  }, [mode]);

  if (isAuthenticated && user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      toast.error('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      navigate(roleHome(result.user.role), { replace: true });
    } catch (error) {
      if (error.status === 401) toast.error('Email hoặc mật khẩu không chính xác');
      else if (error.status === 423) toast.error(error.message || 'Tài khoản đã bị khóa');
      else toast.error(error.message || 'Không thể kết nối tới máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-white/90 border border-slate-200 py-2.5 px-4 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 shadow-sm';

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-auto px-4 py-8">
      <div className="fixed inset-0 z-0">
        <img
          src="/loginform/assets/anhnentruong.jpg"
          alt=""
          className="w-full h-full object-cover blur-sm scale-105 brightness-90"
        />
      </div>

      <div className="relative z-10 w-full max-w-[980px] bg-white/45 border border-white/30 grid md:grid-cols-2 items-center gap-8 md:gap-14 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="relative hidden md:flex">
          <img
            src="/loginform/assets/background.svg"
            alt=""
            className="block w-full h-[590px] object-cover rounded-2xl shadow-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/loginform/assets/logodaihoc.svg" alt="Logo" className="w-2/3" />
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Edumin</p>
            <h1 className="text-4xl font-bold text-slate-800 mt-1">
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký sinh viên'}
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              {mode === 'login' ? 'Truy cập hệ thống quản lý đào tạo' : 'Tạo tài khoản để bắt đầu học tập'}
            </p>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="Email của bạn"
                className={inputClass}
              />
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Mật khẩu"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 text-slate-500 hover:text-indigo-600"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 disabled:opacity-60 w-full font-bold text-white rounded-xl py-3.5 shadow-xl transition-all"
              >
                {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
              <p className="text-center text-sm text-slate-700">
                Bạn là sinh viên chưa có tài khoản?{' '}
                <button type="button" onClick={() => setMode('register')} className="font-bold text-indigo-700 hover:underline">
                  Đăng ký ngay
                </button>
              </p>
            </form>
          ) : (
            <RegisterForm
              register={register}
              inputClass={inputClass}
              onSuccess={(result) => navigate(roleHome(result.user.role), { replace: true })}
              onBackToLogin={() => setMode('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
