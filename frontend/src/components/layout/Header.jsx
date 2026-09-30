import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { ROLE_LABEL } from '../../app/navConfig.js';
import { Avatar } from '../ui/Avatar.jsx';
import { ChangePasswordModal } from '../account/ChangePasswordModal.jsx';

export function Header() {
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  const displayName = profile?.hoTen || user?.hoTen || 'Người dùng';
  const avatar = profile?.avatar?.url || profile?.avatar || '';

  return (
    <header className="w-full bg-white shadow-sm z-40 flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <i className="fas fa-graduation-cap text-white text-xl" />
        </div>
        <span className="text-2xl font-bold text-indigo-900 uppercase tracking-tight">EDUMIN</span>
      </div>

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
          <Avatar src={avatar} name={displayName} size={40} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50">
            <button
              type="button"
              onClick={() => {
                setShowPassword(true);
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <i className="fas fa-key mr-2" /> Đổi mật khẩu
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <i className="fas fa-sign-out-alt mr-2" /> Đăng xuất
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal open={showPassword} onClose={() => setShowPassword(false)} />
    </header>
  );
}

export default Header;
