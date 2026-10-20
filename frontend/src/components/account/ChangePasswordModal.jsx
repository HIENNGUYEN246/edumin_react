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
const PASSWORD_CHANGE_NOTICE_KEY = 'passwordChangeSuccessNotice';
const PASSWORD_CHANGE_NOTICE = 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.';

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

  const mutation = useMutation({
    mutationFn: (vars) => authApi.changePassword(vars),
    onSuccess: () => {
      toast.success(PASSWORD_CHANGE_NOTICE);
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
      sessionStorage.setItem(PASSWORD_CHANGE_NOTICE_KEY, PASSWORD_CHANGE_NOTICE);

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
    <Modal open={open} onClose={onClose} title="Đổi mật khẩu" size="sm" zIndex="z-50">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Mật khẩu cũ" error={errors.oldPassword} required>
          <input type="password" className={inputClass} value={form.oldPassword} onChange={update('oldPassword')} />
        </FormField>
        <FormField label="Mật khẩu mới" error={errors.newPassword} required>
          <input type="password" className={inputClass} value={form.newPassword} onChange={update('newPassword')} />
        </FormField>
        <FormField label="Xác nhận mật khẩu mới" error={errors.confirmPassword} required>
          <input
            type="password"
            className={inputClass}
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
            Hủy
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {mutation.isPending ? 'Đang lưu...' : 'Cập nhật'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ChangePasswordModal;
