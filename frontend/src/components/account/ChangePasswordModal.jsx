import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { tokenStore } from '../../api/http.js';
import { Modal } from '../ui/Modal.jsx';
import { FormField, inputClass } from '../ui/FormField.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';

const EMPTY = { oldPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  let navigate = null;
  try {
    navigate = useNavigate();
  } catch {}

  let logout = null;
  try {
    const auth = useAuth();
    logout = auth?.logout;
  } catch {}

  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars) => authApi.changePassword(vars),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.');
      setForm(EMPTY);
      setErrors({});
      onClose?.();

      // 1. Tự động xóa token/session cũ (clear localStorage & sessionStorage)
      tokenStore.clear();
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.clear();
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
          localStorage.removeItem('authProfile');
          localStorage.removeItem('authLockInfo');
        } catch {}
      }

      // 2. Clear queryClient cache & logout
      try {
        queryClient.clear();
      } catch {}

      if (logout) {
        try {
          logout();
        } catch {}
      }

      // 3. Điều hướng người dùng về trang Login để đăng nhập lại
      if (navigate) {
        navigate('/login', { replace: true });
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
    onError: (error) => {
      // Surface the server message on the old-password field when relevant.
      if (/cũ/.test(error.message)) setErrors({ oldPassword: error.message });
      else toast.error(error.message);
    },
  });

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.oldPassword) next.oldPassword = 'Vui lòng nhập mật khẩu cũ';
    if (form.newPassword.length < 6) next.newPassword = 'Mật khẩu mới phải từ 6 ký tự';
    if (form.newPassword && form.newPassword === form.oldPassword)
      next.newPassword = 'Mật khẩu mới không được trùng mật khẩu cũ';
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = 'Xác nhận mật khẩu không khớp';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate({ oldPassword: form.oldPassword, newPassword: form.newPassword });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đổi mật khẩu"
      icon="fas fa-shield-halved text-indigo-600"
      size="sm"
      zIndex="z-50"
    >
      <form onSubmit={submit} className="space-y-4 pt-1 sm:pt-2">
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 text-xs text-indigo-900 mb-4 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <i className="fas fa-lock text-sm" />
          </div>
          <div className="leading-snug">
            <p className="font-semibold text-slate-800">Cập nhật mật khẩu tài khoản</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Mật khẩu mới tối thiểu 6 ký tự và khác mật khẩu cũ.</p>
          </div>
        </div>

        <FormField label="Mật khẩu cũ" error={errors.oldPassword} required>
          <div className="relative">
            <input
              type={showOldPassword ? 'text' : 'password'}
              className={`${inputClass} pr-10`}
              value={form.oldPassword}
              onChange={update('oldPassword')}
              placeholder="Nhập mật khẩu hiện tại"
              autoComplete="current-password"
            />
            <button
              type="button"
              tabIndex="-1"
              onClick={() => setShowOldPassword((v) => !v)}
              className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              aria-label={showOldPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
            >
              <i className={`fas ${showOldPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
            </button>
          </div>
        </FormField>

        <FormField label="Mật khẩu mới" error={errors.newPassword} required>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              className={`${inputClass} pr-10`}
              value={form.newPassword}
              onChange={update('newPassword')}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
            />
            <button
              type="button"
              tabIndex="-1"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
            >
              <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
            </button>
          </div>
        </FormField>

        <FormField label="Xác nhận mật khẩu mới" error={errors.confirmPassword} required>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              className={`${inputClass} pr-10`}
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
            />
            <button
              type="button"
              tabIndex="-1"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
            >
              <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
            </button>
          </div>
        </FormField>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md shadow-indigo-200 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin text-xs" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <i className="fas fa-check text-xs" />
                <span>Cập nhật</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ChangePasswordModal;
