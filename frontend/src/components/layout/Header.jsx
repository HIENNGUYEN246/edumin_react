import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { ROLE_LABEL } from '../../app/navConfig.js';
import { Avatar } from '../ui/Avatar.jsx';
import { ChangePasswordModal } from '../account/ChangePasswordModal.jsx';
import NotificationBell from '../NotificationBell.jsx';
import { authApi } from '../../api/authApi.js';

export function Header() {
  const { user, profile, logout } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const menuRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  const displayName = profile?.hoTen || user?.hoTen || 'Người dùng';
  const avatar =
    profile?.avatar?.url ||
    (typeof profile?.avatar === 'string' ? profile?.avatar : '') ||
    user?.avatar?.url ||
    (typeof user?.avatar === 'string' ? user?.avatar : '') ||
    '';

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setUploadingAvatar(true);
      toast.info('Đang tải ảnh đại diện lên...');
      const res = await authApi.updateAvatar(file);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-requests'] });
      if (res?.pending) {
        toast.info(res.message || 'Yêu cầu thay đổi ảnh đại diện đã được gửi đến Quản trị viên để phê duyệt');
      } else {
        toast.success('Đã cập nhật ảnh đại diện');
      }
      window.dispatchEvent(new CustomEvent('edumin_profile_request_updated'));
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật ảnh đại diện');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <header className="w-full bg-white shadow-sm z-40 flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <i className="fas fa-graduation-cap text-white text-xl" />
        </div>
        <span className="text-2xl font-bold text-indigo-900 uppercase tracking-tight">EDUMIN</span>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell currentUser={user} />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="flex items-center gap-3 border-l pl-6 border-gray-200"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-800">{displayName}</p>
              <p className="text-xs text-gray-500">{ROLE_LABEL[user?.role] || ''}</p>
            </div>
            <div className="relative">
              <Avatar src={avatar} name={displayName} size={40} />
              {uploadingAvatar && (
                <span className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white text-xs">
                  <i className="fas fa-spinner fa-spin" />
                </span>
              )}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50">
              <button
                type="button"
                onClick={() => {
                  avatarInputRef.current?.click();
                  setMenuOpen(false);
                }}
                disabled={uploadingAvatar}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center"
              >
                <i className="fas fa-camera mr-2.5 text-indigo-500" />
                <span>Đổi ảnh đại diện</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPassword(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center"
              >
                <i className="fas fa-key mr-2.5 text-amber-500" />
                <span>Đổi mật khẩu</span>
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <i className="fas fa-sign-out-alt mr-2.5 text-red-500" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      <ChangePasswordModal open={showPassword} onClose={() => setShowPassword(false)} />
    </header>
  );
}

export default Header;
