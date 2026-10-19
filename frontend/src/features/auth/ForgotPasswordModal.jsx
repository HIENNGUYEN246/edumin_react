import { useState } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { authApi } from '../../api/authApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';

export function ForgotPasswordModal({ open, onClose, onSuccess }) {
  const toast = useToast();
  const [recoveryType, setRecoveryType] = useState('password');
  const [userRole, setUserRole] = useState('all');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResponse, setSuccessResponse] = useState(null);

  const resetState = () => {
    setRecoveryType('password');
    setUserRole('all');
    setIdentifier('');
    setEmail('');
    setErrorMessage('');
    setSuccessResponse(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  const handleTypeChange = (newType) => {
    setRecoveryType(newType);
    setErrorMessage('');
    setSuccessResponse(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage('');

    if (recoveryType === 'password') {
      if (!identifier.trim()) {
        const msg =
          userRole === 'teacher'
            ? 'Vui lòng nhập Mã giáo viên hoặc Tên đăng nhập'
            : 'Vui lòng nhập Mã sinh viên hoặc Tên đăng nhập';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
    } else {
      if (!email.trim()) {
        const msg = 'Vui lòng nhập Email cá nhân đã đăng ký';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload =
        recoveryType === 'password'
          ? {
              type: 'password',
              identifier: identifier.trim(),
              ...(userRole !== 'all' ? { role: userRole } : {}),
            }
          : {
              type: 'username',
              email: email.trim(),
              ...(userRole !== 'all' ? { role: userRole } : {}),
            };

      const result = await authApi.forgotPassword(payload);
      setSuccessResponse(result);
      toast.success(result.message);
      onSuccess?.(result);
    } catch (err) {
      const msg = err.message || 'Không thể thực hiện yêu cầu khôi phục';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 text-sm transition';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Khôi phục thông tin tài khoản"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Lựa chọn loại khôi phục: Radio Buttons */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Bạn cần hỗ trợ gì?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
              htmlFor="radio-forgot-password"
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                recoveryType === 'password'
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-semibold shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                id="radio-forgot-password"
                type="radio"
                name="recoveryType"
                value="password"
                checked={recoveryType === 'password'}
                onChange={() => handleTypeChange('password')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-sm">Tôi quên mật khẩu</span>
            </label>

            <label
              htmlFor="radio-forgot-username"
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                recoveryType === 'username'
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-semibold shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                id="radio-forgot-username"
                type="radio"
                name="recoveryType"
                value="username"
                checked={recoveryType === 'username'}
                onChange={() => handleTypeChange('username')}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-sm">Tôi quên tên tài khoản</span>
            </label>
          </div>
        </div>

        {/* Thông báo lỗi inline */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2.5"
          >
            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Thông báo thành công inline */}
        {successResponse && (
          <div
            role="status"
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-sm space-y-2"
          >
            <div className="flex items-start gap-2.5">
              <i className="fa-solid fa-circle-check text-emerald-600 text-base mt-0.5 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                {successResponse.role && (
                  <span className="inline-block px-2 py-0.5 text-[11px] font-bold uppercase rounded-md bg-emerald-200/70 text-emerald-800">
                    {String(successResponse.role).toLowerCase() === 'teacher' || String(successResponse.role).toLowerCase() === 'giao-vien'
                      ? 'Giáo viên'
                      : 'Sinh viên'}
                  </span>
                )}
                <div className="font-semibold">{successResponse.message}</div>
              </div>
            </div>
            {recoveryType === 'username' && (
              <p className="text-xs text-emerald-700 pl-6">
                <i className="fa-regular fa-envelope mr-1.5" />
                Hệ thống đã gửi email thông tin này tới hòm thư cá nhân của bạn.
              </p>
            )}
          </div>
        )}

        {/* Ô nhập liệu theo loại khôi phục */}
        {!successResponse && (
          <div className="space-y-4">
            {/* Lựa chọn phân loại đối tượng: Giáo viên / Sinh viên / Tự động */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-user-role"
                className="block text-xs font-semibold text-slate-700"
              >
                Bạn là:
              </label>
              <div className="relative">
                <select
                  id="select-user-role"
                  aria-label="Bạn là"
                  value={userRole}
                  onChange={(e) => {
                    setUserRole(e.target.value);
                    setErrorMessage('');
                  }}
                  className={`${inputClass} pr-9 cursor-pointer appearance-none bg-white`}
                >
                  <option value="all">Tự động nhận diện (Giáo viên &amp; Sinh viên)</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="student">Sinh viên</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="fa-solid fa-chevron-down text-xs" />
                </div>
              </div>
            </div>

            {recoveryType === 'password' ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="input-identifier"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {userRole === 'teacher'
                    ? 'Mã giảng viên / Tên đăng nhập'
                    : userRole === 'student'
                    ? 'Mã sinh viên / Tên đăng nhập'
                    : 'Mã định danh / Tên đăng nhập'}
                </label>
                <div className="relative">
                  <input
                    id="input-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      userRole === 'teacher'
                        ? 'Nhập Mã giảng viên / Tên đăng nhập'
                        : 'Nhập Mã sinh viên / Tên đăng nhập'
                    }
                    className={inputClass}
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fa-solid fa-id-card text-xs" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {userRole === 'teacher' ? (
                    <>Ví dụ: <code>GV-001</code>, <code>1</code> hoặc <code>email@edu.vn</code></>
                  ) : userRole === 'student' ? (
                    <>Ví dụ: <code>SV-001</code>, <code>1</code> hoặc <code>email@student.edu.vn</code></>
                  ) : (
                    <>Ví dụ: <code>SV-001</code>, <code>GV-001</code>, <code>1</code> hoặc email đăng nhập</>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="input-personal-email"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Email cá nhân
                </label>
                <div className="relative">
                  <input
                    id="input-personal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập Email cá nhân đã đăng ký"
                    className={inputClass}
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fa-solid fa-envelope text-xs" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Hệ thống sẽ quét cơ sở dữ liệu {userRole === 'teacher' ? 'Giáo viên' : userRole === 'student' ? 'Sinh viên' : 'Giáo viên & Sinh viên'} để gửi tên tài khoản và mật khẩu mới vào email này.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Nút bấm hành động */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
          >
            Quay lại đăng nhập
          </button>
          {!successResponse ? (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-md transition"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  Đang xử lý...
                </span>
              ) : (
                'Yêu cầu khôi phục'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition"
            >
              Đăng nhập ngay
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default ForgotPasswordModal;

