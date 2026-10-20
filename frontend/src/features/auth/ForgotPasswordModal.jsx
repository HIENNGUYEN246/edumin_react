import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.jsx';
import { authApi } from '../../api/authApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { roleHome } from '../../app/navConfig.js';

export function ForgotPasswordModal({ open, onClose, onSuccess }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { login, loginWithSession } = useAuth();
  const [recoveryType, setRecoveryType] = useState('password');
  const [hoTen, setHoTen] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResponse, setSuccessResponse] = useState(null);

  const resetState = () => {
    setRecoveryType('password');
    setHoTen('');
    setIdentifier('');
    setEmail('');
    setErrorMessage('');
    setSuccessResponse(null);
    setIsLoading(false);
    setIsLoggingIn(false);
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  const handleImmediateLogin = async () => {
    if (!successResponse || isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      let session = null;
      if (successResponse.token && successResponse.user) {
        session = await loginWithSession(successResponse);
      } else if (successResponse.username) {
        session = await login(successResponse.username, '123');
      }

      const role = session?.user?.role || successResponse.role || 'student';
      toast.success('Đăng nhập thành công!');
      handleClose();
      navigate(roleHome(role), { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Không thể tự động đăng nhập. Vui lòng đăng nhập lại.');
      handleClose();
    } finally {
      setIsLoggingIn(false);
    }
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

    if (!hoTen.trim()) {
      const msg = 'Vui lòng nhập Họ và tên để xác thực danh tính';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (recoveryType === 'password') {
      if (!identifier.trim()) {
        const msg = 'Vui lòng nhập Tên đăng nhập hoặc Mã sinh viên / Mã GV';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
    } else {
      if (!identifier.trim() && !email.trim()) {
        const msg = 'Vui lòng nhập Mã SV / Mã GV, Số điện thoại hoặc Email cá nhân';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload = {
        type: recoveryType,
        hoTen: hoTen.trim(),
        identifier: identifier.trim(),
        email: email.trim(),
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
      icon="fas fa-key text-indigo-600"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 2 lựa chọn Radio Button ở đầu Modal */}
        <div className="space-y-2">
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
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-sm space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <i className="fa-solid fa-circle-check text-emerald-600 text-base mt-0.5 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                {successResponse.role && (
                  <span className="inline-block px-2 py-0.5 text-[11px] font-bold uppercase rounded-md bg-emerald-200/70 text-emerald-800">
                    {String(successResponse.role).toLowerCase().includes('teach') ||
                    String(successResponse.role).toLowerCase() === 'giao-vien'
                      ? 'Giáo viên'
                      : 'Sinh viên'}
                  </span>
                )}
                <div className="font-semibold text-slate-800">{successResponse.message}</div>
              </div>
            </div>

            {successResponse.username && (
              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="text-slate-600 font-medium">Tên đăng nhập / Email:</span>
                <span className="font-bold text-indigo-700 font-mono text-sm select-all">
                  {successResponse.username}
                </span>
              </div>
            )}

            {successResponse.hasEmail && (
              <p className="text-xs text-emerald-700 pl-1">
                <i className="fa-regular fa-envelope mr-1.5" />
                Hệ thống đã gửi email chi tiết thông tin tài khoản tới: <strong>{email || successResponse.emailSentTo}</strong>
              </p>
            )}
            {successResponse.emailSynced && (
              <p className="text-xs text-emerald-700 pl-1 flex items-center gap-1.5">
                <i className="fa-solid fa-arrows-rotate text-emerald-600" />
                <span>Địa chỉ email này đã được tự động đồng bộ vào hệ thống quản lý để nhận thông báo.</span>
              </p>
            )}
            {!successResponse.hasEmail && (
              <p className="text-xs text-emerald-700 pl-1">
                <i className="fa-solid fa-key mr-1.5" />
                Mật khẩu mặc định mới là <strong>123</strong>. Vui lòng đăng nhập và đổi mật khẩu ngay.
              </p>
            )}
          </div>
        )}

        {/* Các trường nhập liệu */}
        {!successResponse && (
          <div className="space-y-3.5">
            {/* Trường Họ và tên (Bắt buộc cho cả 2 trường hợp) */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-hoten"
                className="block text-xs font-semibold text-slate-700"
              >
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-hoten"
                  type="text"
                  value={hoTen}
                  onChange={(e) => setHoTen(e.target.value)}
                  placeholder="Nhập Họ và tên của bạn"
                  className={inputClass}
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="fa-solid fa-user text-xs" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Nhập chính xác họ tên để hệ thống xác thực danh tính.
              </p>
            </div>

            {/* Trường hợp 1: "Tôi quên mật khẩu" */}
            {recoveryType === 'password' && (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-identifier"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tên đăng nhập / Mã SV / Mã GV <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Nhập Mã sinh viên / Tên đăng nhập"
                      className={inputClass}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <i className="fa-solid fa-id-card text-xs" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ví dụ: <code>SV-001</code>, <code>GV-001</code>, <code>1</code> hoặc email tài khoản
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="input-personal-email-optional"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email cá nhân <span className="text-slate-400 font-normal">(Tùy chọn)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-personal-email-optional"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Nhập Email cá nhân đã đăng ký"
                      className={inputClass}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <i className="fa-solid fa-envelope text-xs" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Nếu điền sẽ nhận thêm email sao lưu thông tin và tự động đồng bộ vào hệ thống; nếu bỏ trống, mật khẩu mới sẽ hiển thị trực tiếp trên màn hình.
                  </p>
                </div>
              </>
            )}

            {/* Trường hợp 2: "Tôi quên tên tài khoản" */}
            {recoveryType === 'username' && (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-identifier-username"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mã SV / Mã GV hoặc Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-identifier-username"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Nhập Mã SV / Mã GV hoặc Số điện thoại"
                      className={inputClass}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <i className="fa-solid fa-id-card text-xs" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Hệ thống tự động tra cứu trên cả dữ liệu Giảng viên và Sinh viên.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="input-personal-email-optional-username"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email cá nhân <span className="text-slate-400 font-normal">(Tùy chọn)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-personal-email-optional-username"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Nhập Email cá nhân đã đăng ký"
                      className={inputClass}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <i className="fa-solid fa-envelope text-xs" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Nếu điền sẽ nhận thêm email sao lưu thông tin; nếu bỏ trống, tên đăng nhập sẽ hiển thị trực tiếp ngay trên màn hình.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Nút bấm hành động */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition cursor-pointer"
          >
            Quay lại đăng nhập
          </button>
          {!successResponse ? (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-md transition cursor-pointer"
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
              onClick={handleImmediateLogin}
              disabled={isLoggingIn}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                'Đăng nhập ngay'
              )}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default ForgotPasswordModal;
