import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import teacherAPI from '../services/teacherAPI';
import PDLayout from '../layouts/PDLayout';
import { ensureTeacherAccountFields } from '../utils/teacherUtils';

const LOCK_REASONS = [
  'Vi phạm nội quy nhà trường',
  'Tài khoản có dấu hiệu bị xâm nhập',
  'Giảng viên đã nghỉ công tác',
  'Khác',
];

function formatTeacherId(id) {
  return `GV-${String(id).padStart(3, '0')}`;
}

function ManageTeacherAccounts() {
  const location = useLocation();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockTargetId, setLockTargetId] = useState(null);
  const [lockReasonSelect, setLockReasonSelect] = useState(LOCK_REASONS[0]);
  const [lockReasonOther, setLockReasonOther] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      const list = await teacherAPI.getAllTeachers();
      setTeachers(list.map(ensureTeacherAccountFields));
    } catch (error) {
      console.error(error);
      Swal.fire('Lỗi', 'Không tải được tài khoản giáo viên từ API.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadAccounts();
  }, [location.pathname, loadAccounts]);

  const persistTeachers = async (nextTeachers, snapshot) => {
    setTeachers(nextTeachers);
    setSaving(true);
    try {
      await teacherAPI.saveAllTeachers(nextTeachers);
      return true;
    } catch (error) {
      setTeachers(snapshot);
      Swal.fire('Lỗi', error.message || 'Không lưu được lên API', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const filtered = teachers.filter((gv) => {
    const term = searchTerm.toLowerCase();
    const code = formatTeacherId(gv.id).toLowerCase();
    return (
      code.includes(term) ||
      (gv.name && gv.name.toLowerCase().includes(term)) ||
      (gv.email && gv.email.toLowerCase().includes(term))
    );
  });

  const resetPasswordToDefault = (id) => {
    Swal.fire({
      title: 'Khôi phục mật khẩu?',
      text: 'Mật khẩu sẽ được đặt lại về mặc định: 123',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const snapshot = teachers;
      const next = teachers.map((t) => (t.id === id ? { ...t, password: '123' } : t));
      const ok = await persistTeachers(next, snapshot);
      if (ok) {
        Swal.fire({
          title: 'Thành công!',
          text: 'Mật khẩu đã được khôi phục về 123.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  };

  const toggleLock = (id, status) => {
    if (status === 'Locked') {
      const snapshot = teachers;
      const next = teachers.map((t) =>
        t.id === id ? { ...t, status: 'Active', lockReason: '' } : t
      );
      persistTeachers(next, snapshot).then((ok) => {
        if (ok) {
          Swal.fire({
            title: 'Đã mở khóa',
            text: 'Tài khoản đã hoạt động trở lại',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
          });
        }
      });
      return;
    }

    setLockTargetId(id);
    setLockReasonSelect(LOCK_REASONS[0]);
    setLockReasonOther('');
    setShowLockModal(true);
  };

  const confirmLock = async () => {
    const finalReason = lockReasonSelect === 'Khác' ? lockReasonOther.trim() : lockReasonSelect;
    if (lockReasonSelect === 'Khác' && !finalReason) {
      Swal.fire('Lỗi', 'Vui lòng điền lý do cụ thể', 'error');
      return;
    }

    const snapshot = teachers;
    const next = teachers.map((t) =>
      t.id === lockTargetId ? { ...t, status: 'Locked', lockReason: finalReason } : t
    );
    const ok = await persistTeachers(next, snapshot);
    if (ok) {
      setShowLockModal(false);
      Swal.fire({
        title: 'Đã khóa',
        text: 'Tài khoản đã bị khóa thành công.',
        icon: 'warning',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  const openDeleteConfirm = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
    setTimeout(() => setConfirmVisible(true), 10);
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setTimeout(() => {
      setShowConfirm(false);
      setDeleteId(null);
    }, 300);
  };

  const confirmDelete = async () => {
    if (saving) return;
    const snapshot = teachers;
    const next = teachers.filter((t) => t.id !== deleteId);
    closeConfirmModal();
    const ok = await persistTeachers(next, snapshot);
    if (ok) {
      Swal.fire({
        title: 'Đã xóa',
        text: 'Dữ liệu đã được cập nhật!',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  return (
    <PDLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tài khoản giảng viên</h2>
          <p className="text-sm text-gray-500">Quản lý quyền truy cập của giảng viên</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <i className="fas fa-search" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã GV, Tên hoặc Email..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition-all text-sm shadow-sm"
            />
          </div>
          <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full whitespace-nowrap">
            Tổng: <span className="mx-1 font-bold">{filtered.length}</span> GV
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[11px] uppercase font-bold tracking-wider">
                <th className="px-6 py-4">Mã GV</th>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Email (Tài khoản)</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    {teachers.length === 0
                      ? 'Chưa có giáo viên. Hãy thêm ở trang Danh sách giảng viên.'
                      : 'Không tìm thấy tài khoản phù hợp'}
                  </td>
                </tr>
              ) : (
                filtered.map((gv) => (
                  <tr key={gv.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 font-bold text-indigo-600">{formatTeacherId(gv.id)}</td>
                    <td className="px-6 py-4 font-semibold text-gray-700">{gv.name}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{gv.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`${
                          gv.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        } px-3 py-1 rounded-full text-[10px] font-bold uppercase`}
                      >
                        {gv.status === 'Active' ? 'Hoạt động' : 'Bị khóa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => resetPasswordToDefault(gv.id)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                          title="Khôi phục mật khẩu 123"
                        >
                          <i className="fas fa-undo text-xs" />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => toggleLock(gv.id, gv.status)}
                          className={`w-8 h-8 rounded-lg transition-all disabled:opacity-50 ${
                            gv.status === 'Active'
                              ? 'bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white'
                              : 'bg-green-50 text-green-500 hover:bg-green-500 hover:text-white'
                          }`}
                          title="Khóa/Mở"
                        >
                          <i className={`fas ${gv.status === 'Active' ? 'fa-user-lock' : 'fa-user-check'} text-xs`} />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => openDeleteConfirm(gv.id)}
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-700 hover:text-white transition-all disabled:opacity-50"
                          title="Xóa"
                        >
                          <i className="fas fa-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showLockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <i className="fas fa-user-lock text-orange-500" /> Lý do khóa tài khoản
            </h3>
            <p className="text-sm text-gray-500 mb-4">Vui lòng chọn hoặc nhập lý do khóa tài khoản này.</p>
            <div className="space-y-3">
              <select
                value={lockReasonSelect}
                onChange={(e) => setLockReasonSelect(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {LOCK_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'Khác' ? 'Khác...' : r}
                  </option>
                ))}
              </select>
              {lockReasonSelect === 'Khác' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nhập lý do khác</label>
                  <textarea
                    value={lockReasonOther}
                    onChange={(e) => setLockReasonOther(e.target.value)}
                    placeholder="Nhập lý do cụ thể..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 h-24 resize-none"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="flex-1 py-3 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmLock}
                className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-60"
              >
                Xác nhận Khóa
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className={`bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl transform transition-all duration-300 ${
              confirmVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <i className="fas fa-exclamation-triangle text-red-600 text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa?</h3>
              <p className="text-sm text-gray-500 mb-6">Dữ liệu giáo viên và tài khoản sẽ bị xóa vĩnh viễn!</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition disabled:opacity-60"
              >
                {saving ? 'Đang xử lý...' : 'Xóa ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PDLayout>
  );
}

export default ManageTeacherAccounts;
