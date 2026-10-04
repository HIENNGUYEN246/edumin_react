import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { Modal } from '../ui/Modal.jsx';
import { FormField, inputClass } from '../ui/FormField.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';

const EMPTY = { oldPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu thành công');
      setForm(EMPTY);
      setErrors({});
      onClose?.();
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
    <Modal open={open} onClose={onClose} title="Đổi mật khẩu" size="sm">
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
