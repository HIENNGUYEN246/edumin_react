import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';

const EMPTY = { hoTen: '', emailPrefix: '', departmentId: '', password: '', confirmPassword: '' };

export function RegisterForm({ register, inputClass, onSuccess, onBackToLogin }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['registration-options'],
    queryFn: authApi.registrationOptions,
  });
  const departments = data?.departments || [];

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

<<<<<<< HEAD
  const normalizeStudentEmail = (raw) => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (!trimmed.includes('@')) {
      return `${trimmed}@student.edu.vn`;
    }
    const [username] = trimmed.split('@');
    if (!username) return trimmed;
    return `${username}@student.edu.vn`;
  };

  const handleEmailBlur = () => {
    const raw = form.email.trim();
    if (!raw) return;
    const normalized = normalizeStudentEmail(raw);
    if (normalized !== form.email) {
      setForm((f) => ({ ...f, email: normalized }));
    }
  };

  const validate = (emailToCheck) => {
    const next = {};
    if (form.hoTen.trim().length < 2) next.hoTen = 'Vui lòng nhập họ tên đầy đủ';
    const emailVal = emailToCheck || form.email.trim();
    if (!/^[^\s@]+@student\.edu\.vn$/i.test(emailVal)) {
      next.email = 'Email sinh viên bắt buộc phải có đuôi @student.edu.vn';
    }
=======
  const getFullEmail = () => {
    const p = form.emailPrefix.trim().toLowerCase();
    if (!p) return '';
    return p.endsWith('@student.edu.vn') ? p : `${p.replace(/@.*$/, '')}@student.edu.vn`;
  };

  const validate = () => {
    const next = {};
    if (form.hoTen.trim().length < 2) next.hoTen = 'Vui lòng nhập họ tên đầy đủ';
    const email = getFullEmail();
    if (!form.emailPrefix.trim()) next.email = 'Vui lòng nhập tên tài khoản hoặc mã sinh viên';
    else if (!/^[a-zA-Z0-9._-]+@student\.edu\.vn$/.test(email)) next.email = 'Tên tài khoản không hợp lệ (chỉ gồm chữ, số, dấu chấm/gạch)';
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
    if (!form.departmentId) next.departmentId = 'Vui lòng chọn khoa';
    if (form.password.length < 6) next.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Mật khẩu xác nhận không khớp';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    const normalizedEmail = normalizeStudentEmail(form.email);
    if (normalizedEmail !== form.email) {
      setForm((f) => ({ ...f, email: normalizedEmail }));
    }
    if (submitting || !validate(normalizedEmail)) return;
    setSubmitting(true);
    try {
      const email = getFullEmail();
      const result = await register({
        hoTen: form.hoTen.trim(),
<<<<<<< HEAD
        email: normalizedEmail,
=======
        email,
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
        departmentId: form.departmentId,
        password: form.password,
      });
      toast.success('Tạo tài khoản thành công');
      onSuccess(result);
    } catch (error) {
      if (error.status === 409) setErrors((p) => ({ ...p, email: 'Email đã được sử dụng' }));
      else toast.error(error.message || 'Không tạo được tài khoản');
    } finally {
      setSubmitting(false);
    }
  };

  const cls = (field) => `${inputClass} ${errors[field] ? 'border-red-400' : ''}`;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <input value={form.hoTen} onChange={set('hoTen')} placeholder="Họ và tên" className={cls('hoTen')} />
        {errors.hoTen && <p className="text-xs text-red-600 mt-1">{errors.hoTen}</p>}
      </div>
      <div>
<<<<<<< HEAD
        <input
          value={form.email}
          onChange={set('email')}
          onBlur={handleEmailBlur}
          type="email"
          placeholder="Email sinh viên (VD: sv01@student.edu.vn)"
          className={cls('email')}
        />
=======
        <div className={`flex rounded-xl overflow-hidden border bg-white/90 shadow-xs focus-within:ring-2 focus-within:ring-indigo-400 focus-within:bg-white ${errors.email ? 'border-red-400' : 'border-slate-200'}`}>
          <input
            value={form.emailPrefix}
            onChange={(e) => {
              const raw = e.target.value.trim().toLowerCase();
              const clean = raw.endsWith('@student.edu.vn')
                ? raw.slice(0, -'@student.edu.vn'.length)
                : raw.replace(/@.*$/, '');
              setForm((f) => ({ ...f, emailPrefix: clean }));
              setErrors((p) => ({ ...p, email: '' }));
            }}
            placeholder="Mã SV hoặc tên đăng ký"
            className="flex-1 py-2.5 px-4 outline-none text-slate-800 bg-transparent text-sm min-w-0"
          />
          <span className="inline-flex items-center px-3.5 bg-slate-100/90 text-indigo-700 font-bold text-xs border-l border-slate-200 select-none shrink-0 font-mono">
            @student.edu.vn
          </span>
        </div>
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
        {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
      </div>
      <div>
        <select value={form.departmentId} onChange={set('departmentId')} disabled={isLoading} className={cls('departmentId')}>
          <option value="">{isLoading ? 'Đang tải khoa...' : 'Chọn khoa'}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {errors.departmentId && <p className="text-xs text-red-600 mt-1">{errors.departmentId}</p>}
      </div>
      <div>
        <input
          value={form.password}
          onChange={set('password')}
          type={showPassword ? 'text' : 'password'}
          placeholder="Mật khẩu (ít nhất 6 ký tự)"
          className={cls('password')}
        />
        {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
      </div>
      <div>
        <input
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          type={showPassword ? 'text' : 'password'}
          placeholder="Xác nhận mật khẩu"
          className={cls('confirmPassword')}
        />
        {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Hiện mật khẩu
      </label>
      <button
        type="submit"
        disabled={submitting || isLoading}
        className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 disabled:opacity-60 w-full font-bold text-white rounded-xl py-3.5 shadow-xl transition-all"
      >
        {submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản sinh viên'}
      </button>
      <p className="text-center text-sm text-slate-700">
        Đã có tài khoản?{' '}
        <button type="button" onClick={onBackToLogin} className="font-bold text-indigo-700 hover:underline">
          Quay lại đăng nhập
        </button>
      </p>
    </form>
  );
}

export default RegisterForm;
