import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { Modal } from '../ui/Modal.jsx';
import { FormField, inputClass } from '../ui/FormField.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { getMaxBirthDate, formatDate } from '../../lib/format.js';
import { TEACHER_EDUCATION_LEVELS } from '../../api/teachersApi.js';
import { STUDENT_EDUCATION_LEVELS } from '../../api/studentsApi.js';

export function EditProfileModal({ open, onClose, user, profile }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    hoTen: '',
    phone: '',
    address: '',
    dob: '',
    gender: 'Nam',
    education: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        hoTen: profile?.hoTen || user?.hoTen || '',
        phone: profile?.phone || '',
        address: profile?.address || '',
        dob: profile?.dob || '',
        gender: profile?.gender || 'Nam',
        education: profile?.education || '',
      });
    }
  }, [open, profile, user]);

  const isStudent = user?.role === 'sinh-vien' || user?.role === 'student';
  const isTeacher = user?.role === 'giao-vien' || user?.role === 'teacher';
  const isSelfService = isTeacher || isStudent;

  const mutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['profile-requests'] });

      const changedKeys = Object.keys(variables || {});
      const fieldLabels = {
        hoTen: 'Họ tên',
        phone: 'SĐT',
        address: 'Địa chỉ',
        dob: 'Ngày sinh',
        gender: 'Giới tính',
        education: isStudent ? 'Hệ đào tạo' : 'Trình độ',
      };
      const changedSummary = changedKeys.map((k) => fieldLabels[k] || k).join(', ');

      window.dispatchEvent(
        new CustomEvent('edumin_profile_request_updated', {
          detail: {
            roleName: isStudent ? 'Sinh viên' : 'Giảng viên',
            name: form.hoTen || user?.hoTen || '',
            changedSummary: changedSummary || 'thông tin cá nhân',
          },
        })
      );

      if (res?.pending) {
        toast.info(res.message || 'Yêu cầu cập nhật thông tin đã được gửi đến Quản trị viên để phê duyệt');
      } else {
        toast.success('Đã cập nhật thông tin thành công');
      }
      onClose?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Lỗi khi gửi yêu cầu cập nhật');
    },
  });

  const maxDob = isStudent
    ? getMaxBirthDate(17)
    : isTeacher
      ? getMaxBirthDate(24)
      : undefined;
  const dobHint = maxDob
    ? `Tối đa: ${formatDate(maxDob)} (${isStudent ? 'từ 17 tuổi trở lên' : 'từ 24 tuổi trở lên'})`
    : undefined;

  const update = (field) => (e) => {
    let value = e.target.value;
    if (field === 'dob' && maxDob && value && value > maxDob) {
      value = maxDob;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.hoTen.trim()) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }
    if (maxDob && form.dob && form.dob > maxDob) {
      toast.error(isStudent ? 'Sinh viên phải từ 17 tuổi trở lên' : 'Giảng viên phải từ 24 tuổi trở lên');
      return;
    }

    if (isSelfService) {
      const original = {
        hoTen: profile?.hoTen || user?.hoTen || '',
        phone: profile?.phone || '',
        address: profile?.address || '',
        dob: profile?.dob || '',
        gender: profile?.gender || 'Nam',
        education: profile?.education || (isStudent ? 'Chính quy' : ''),
      };

      const diff = {};
      for (const [key, val] of Object.entries(form)) {
        if (String(val ?? '').trim() !== String(original[key] ?? '').trim()) {
          diff[key] = val;
        }
      }

      if (Object.keys(diff).length === 0) {
        toast.info('Bạn chưa thay đổi thông tin nào so với hiện tại');
        return;
      }

      mutation.mutate(diff);
      return;
    }

    mutation.mutate(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSelfService ? 'Gửi yêu cầu cập nhật thông tin' : 'Chỉnh sửa thông tin'}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        {isSelfService && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
            <i className="fas fa-shield-alt text-amber-600 mt-0.5 text-sm" />
            <div>
              <p className="font-semibold text-amber-900">Quy trình kiểm duyệt bởi Quản trị viên</p>
              <p className="text-amber-700 mt-0.5">
                Các thông tin bạn cập nhật sẽ được chuyển đến Phòng Đào Tạo phê duyệt. Sau khi được duyệt, thông tin sẽ tự động cập nhật trên hệ thống và bạn sẽ nhận được thông báo.
              </p>
            </div>
          </div>
        )}

        <FormField label="Họ và tên" required>
          <input
            type="text"
            className={inputClass}
            value={form.hoTen}
            onChange={update('hoTen')}
            placeholder="Nhập họ và tên..."
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Số điện thoại">
            <input
              type="text"
              className={inputClass}
              value={form.phone}
              onChange={update('phone')}
              placeholder="VD: 0987654321"
            />
          </FormField>

          <FormField label="Ngày sinh" hint={dobHint}>
            <input
              type="date"
              className={inputClass}
              value={form.dob}
              max={maxDob}
              onChange={update('dob')}
              onBlur={() => {
                if (maxDob && form.dob && form.dob > maxDob) {
                  setForm((prev) => ({ ...prev, dob: maxDob }));
                }
              }}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Giới tính">
            <select
              className={inputClass}
              value={form.gender}
              onChange={update('gender')}
            >
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </FormField>

          <FormField label={user?.role === 'teacher' ? 'Trình độ học vị' : 'Hệ đào tạo'}>
            {user?.role === 'teacher' ? (
              <select
                className={inputClass}
                value={form.education}
                onChange={update('education')}
              >
                <option value="">-- Chọn trình độ học vị --</option>
                {form.education && !TEACHER_EDUCATION_LEVELS.some((opt) => opt.value === form.education) && (
                  <option value={form.education}>{form.education} (Hiện tại)</option>
                )}
                {TEACHER_EDUCATION_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className={inputClass}
                value={form.education || 'Chính quy'}
                onChange={update('education')}
              >
                <option value="">-- Chọn hệ đào tạo --</option>
                {form.education && !STUDENT_EDUCATION_LEVELS.some((opt) => opt.value === form.education) && (
                  <option value={form.education}>{form.education} (Hiện tại)</option>
                )}
                {STUDENT_EDUCATION_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <FormField label="Địa chỉ">
          <input
            type="text"
            className={inputClass}
            value={form.address}
            onChange={update('address')}
            placeholder="Địa chỉ liên hệ..."
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane text-xs" />
                <span>{isSelfService ? 'Gửi yêu cầu' : 'Lưu thay đổi'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EditProfileModal;

