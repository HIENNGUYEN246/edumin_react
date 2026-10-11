import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Shown when the API returns 423 (account locked). Rendered once at the app
 * root so any request across any page can trigger it.
 */
export function LockModal() {
  const { lockInfo, logout } = useAuth();
  return (
    <Modal open={Boolean(lockInfo)} onClose={() => {}} closable={false} title="Tài khoản bị khóa" size="sm">
      <div className="text-center py-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mb-4 shadow-xs">
          <i className="fas fa-lock" />
        </div>
        <h4 className="text-base font-bold text-slate-800 mb-2">Thông báo khóa tài khoản</h4>
        <p className="text-slate-600 text-sm leading-6 px-1">
          {lockInfo?.message || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ phòng đào tạo.'}
        </p>
        <p className="text-xs text-slate-400 mt-3">
          Tài khoản tạm thời không thể tiếp tục thao tác. Vui lòng đăng xuất để quay về trang đăng nhập.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-xs transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <i className="fas fa-sign-out-alt" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </Modal>
  );
}

export default LockModal;
