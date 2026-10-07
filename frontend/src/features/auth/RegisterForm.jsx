import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';

const EMPTY = { hoTen: '', email: '', departmentId: '', className: '', password: '', confirmPassword: '' };

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

  const handleEmailBlur = () => {
    const raw = form.email.trim();
    if (!raw) return;
    let updated = raw;
    if (!raw.includes('@')) {
      updated = `${raw}@student.edu.vn`;
    } else if (raw.endsWith('@')) {
      updated = `${raw}student.edu.vn`;
    }
    if (updated !== raw) {
      setForm((f) => ({ ...f, email: updated }));
    }
  };

  const applyStudentDomain = () => {
    const raw = form.email.trim();
    const prefix = raw.includes('@') ? raw.split('@')[0] : raw || 'sinhvien';
    setForm((f) => ({ ...f, email: `${prefix}@student.edu.vn` }));
    setErrors((p) => ({ ...p, email: '' }));
  };

  const validate = () => {
    const next = {};
    if (form.hoTen.trim().length < 2) next.hoTen = 'Vui lòng nhập họ tên đầy đủ';
    if (!/^[^\s@]+@student\.edu\.vn$/i.test(form.email.trim())) {
      next.email = 'Email sinh viên bắt buộc phải có đuôi @student.edu.vn';
    }
    if (!form.departmentId) next.departmentId = 'Vui lòng chọn khoa';
    if (form.password.length < 6) next.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Mật khẩu xác nhận không khớp';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const result = await register({
        hoTen: form.hoTen.trim(),
        email: form.email.trim(),
        departmentId: form.departmentId,
        className: form.className.trim(),
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
        <input
          value={form.email}
          onChange={set('email')}
          onBlur={handleEmailBlur}
          type="email"
          placeholder="Email sinh viên (VD: sv01@student.edu.vn)"
          className={cls('email')}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>Bắt buộc: <strong className="text-indigo-600 font-semibold">@student.edu.vn</strong></span>
          <button
            type="button"
            onClick={applyStudentDomain}
            className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
          >
            + Điền @student.edu.vn
          </button>
        </div>
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
      <input value={form.className} onChange={set('className')} placeholder="Lớp (không bắt buộc)" className={inputClass} />
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
