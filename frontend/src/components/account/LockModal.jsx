import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Shown when the API returns 423 (account locked). Rendered once at the app
 * root so any request across any page can trigger it.
 */
export function LockModal() {
  const { lockInfo, logout } = useAuth();
  return (
    <Modal open={Boolean(lockInfo)} onClose={() => {}} title="Tài khoản bị khóa" size="sm">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mb-4">
          <i className="fas fa-lock" />
        </div>
        <p className="text-gray-600 text-sm leading-6">
          {lockInfo?.message || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ phòng đào tạo.'}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
        >
          Đăng xuất
        </button>
      </div>
    </Modal>
  );
}

export default LockModal;
