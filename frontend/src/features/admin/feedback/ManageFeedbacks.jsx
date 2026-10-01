import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { formatStudentCode, formatTeacherCode } from '../../../lib/format.js';
import { feedbackApi } from '../../../api/feedbackApi.js';

export function ManageFeedbacks() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);

  // Filters
  const [filterRating, setFilterRating] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [filterRating, filterStatus, search]);

  // Reply Modal
  const [replyModal, setReplyModal] = useState({
    isOpen: false,
    feedback: null,
    response: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await feedbackApi.list();
      setFeedbacks(Array.isArray(res) ? res : res?.data || []);
    } catch {
      toast.error('Không thể tải danh sách phản hồi');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredList = useMemo(() => {
    return feedbacks.filter((item) => {
      if (filterRating !== 'all' && Number(item.rating) !== Number(filterRating)) {
        return false;
      }
      if (filterStatus === 'replied' && !item.response) {
        return false;
      }
      if (filterStatus === 'pending' && item.response) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const sName = (item.studentName || '').toLowerCase();
        const sCode = item.studentId ? formatStudentCode(item.studentId).toLowerCase() : '';
        const cName = (item.courseName || '').toLowerCase();
        const cCode = (item.courseId || '').toLowerCase();
        const regId = (item.regId || '').toLowerCase();
        const tName = (item.teacherName || '').toLowerCase();
        const text = (item.feedbackText || '').toLowerCase();
        if (
          !sName.includes(q) &&
          !sCode.includes(q) &&
          !cName.includes(q) &&
          !cCode.includes(q) &&
          !regId.includes(q) &&
          !tName.includes(q) &&
          !text.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [feedbacks, filterRating, filterStatus, search]);

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const avg =
      total > 0
        ? (feedbacks.reduce((sum, f) => sum + Number(f.rating || 5), 0) / total).toFixed(1)
        : '5.0';
    const replied = feedbacks.filter((f) => Boolean(f.response)).length;
    const pending = total - replied;
    return { total, avg, replied, pending };
  }, [feedbacks]);

  const handleOpenReply = (item) => {
    setReplyModal({
      isOpen: true,
      feedback: item,
      response: item.response || '',
    });
  };

  const handleSendReply = async () => {
    if (!replyModal.response.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi');
      return;
    }
    try {
      setSaving(true);
      await feedbackApi.respond(replyModal.feedback._id || replyModal.feedback.id, replyModal.response);
      toast.success('Đã gửi phản hồi giải đáp');
      setReplyModal({ isOpen: false, feedback: null, response: '' });
      await loadData();
      window.dispatchEvent(new CustomEvent('edumin_feedback_updated', { detail: { feedbackText: replyModal.response } }));
    } catch {
      toast.error('Lỗi khi gửi phản hồi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Xóa phản hồi',
      message: 'Bạn có chắc chắn muốn xóa phản hồi này khỏi hệ thống?',
      confirmText: 'Xác nhận xóa',
      danger: true,
    });
    if (!ok) return;

    try {
      await feedbackApi.remove(item._id || item.id);
      setSelectedIds((prev) => prev.filter((id) => id !== String(item._id || item.id)));
      toast.success('Đã xóa phản hồi');
      await loadData();
    } catch {
      toast.error('Không thể xóa phản hồi');
    }
  };

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: 'Xóa nhiều phản hồi đã chọn',
      message: `Bạn có chắc chắn muốn xóa ${selectedIds.length} phản hồi đã chọn khỏi hệ thống?`,
      confirmText: `Xóa ${selectedIds.length} phản hồi`,
      danger: true,
    });
    if (!ok) return;

    try {
      if (feedbackApi.bulkDelete) {
        await feedbackApi.bulkDelete(selectedIds);
      } else {
        await Promise.all(selectedIds.map((id) => feedbackApi.remove(id)));
      }
      toast.success(`Đã xóa ${selectedIds.length} phản hồi`);
      setSelectedIds([]);
      await loadData();
    } catch {
      toast.error('Lỗi khi xóa hàng loạt phản hồi');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ý kiến & Phản hồi Sinh viên"
        description="Tổng hợp các đánh giá, góp ý về chất lượng giảng dạy và học phần từ sinh viên"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase">Tổng phản hồi</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-amber-500 uppercase">Điểm đánh giá TB</p>
          <p className="text-2xl font-bold text-amber-500 mt-1 flex items-center gap-1.5">
            <i className="fas fa-star text-lg" />
            {stats.avg}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 uppercase">Đã giải đáp</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.replied}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-indigo-600 uppercase">Chờ xử lý</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.pending}</p>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả mức đánh giá</option>
            <option value="5">⭐⭐⭐⭐⭐ 5 sao</option>
            <option value="4">⭐⭐⭐⭐ 4 sao</option>
            <option value="3">⭐⭐⭐ 3 sao</option>
            <option value="2">⭐⭐ 2 sao</option>
            <option value="1">⭐ 1 sao</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ giải đáp</option>
            <option value="replied">Đã giải đáp</option>
          </select>

          {(filterRating !== 'all' || filterStatus !== 'all' || searchText) && (
            <button
              type="button"
              onClick={() => {
                setFilterRating('all');
                setFilterStatus('all');
                setSearchText('');
              }}
              className="text-xs text-rose-600 font-semibold hover:underline"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Tìm theo sinh viên, môn, GV..."
          />
        </div>
      </div>

      {/* Main Feedback List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 bg-white rounded-2xl border border-gray-100 shadow-xs">
            <Spinner />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-xs">
            <i className="far fa-comments text-4xl mb-3 block text-gray-300" />
            <p className="font-semibold text-gray-600 text-sm">Chưa có phản hồi nào phù hợp</p>
            <p className="text-xs text-gray-400 mt-1">Khi sinh viên gửi góp ý về học phần, nội dung sẽ hiển thị ở đây.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border border-gray-100 rounded-2xl shadow-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 font-semibold">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  checked={
                    filteredList.length > 0 &&
                    filteredList.every((item) => selectedIds.includes(String(item._id || item.id)))
                  }
                  onChange={() => {
                    const allKeys = filteredList.map((item) => String(item._id || item.id));
                    if (allKeys.every((k) => selectedIds.includes(k))) {
                      setSelectedIds((prev) => prev.filter((k) => !allKeys.includes(k)));
                    } else {
                      setSelectedIds((prev) => Array.from(new Set([...prev, ...allKeys])));
                    }
                  }}
                />
                <span>Chọn tất cả ({filteredList.length})</span>
              </label>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    Đã chọn {selectedIds.length} mục
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    type="button"
                    onClick={onBulkDelete}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-xs flex items-center gap-1.5"
                  >
                    <i className="fas fa-trash-alt" />
                    <span>Xóa {selectedIds.length} mục đã chọn</span>
                  </button>
                </div>
              )}
            </div>

            {filteredList.map((item) => {
              const itemId = String(item._id || item.id);
              const isChecked = selectedIds.includes(itemId);
              return (
                <div
                  key={itemId}
                  className={`bg-white p-5 rounded-2xl border ${
                    isChecked ? 'border-indigo-400 bg-indigo-50/20' : 'border-gray-100'
                  } shadow-xs hover:border-indigo-100 transition space-y-3`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer mt-3"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
                          )
                        }
                        title="Chọn phản hồi này"
                      />
                      <img
                        src={
                          item.isAnonymous
                            ? 'https://ui-avatars.com/api/?name=An+Danh&background=6b7280&color=fff'
                            : item.studentAvatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.studentName || 'SV')}&background=6366f1&color=fff`
                        }
                        alt=""
                        className="w-11 h-11 rounded-full object-cover border border-gray-200 mt-0.5"
                      />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900">
                        {item.isAnonymous ? 'Sinh viên ẩn danh' : item.studentName || 'Sinh viên'}
                      </p>
                      {item.isAnonymous ? (
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Ẩn danh
                        </span>
                      ) : (
                        <>
                          {item.studentId != null && (
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                              {formatStudentCode(item.studentId)}
                            </span>
                          )}
                          {item.studentClass && (
                            <span className="text-xs text-gray-500 font-medium">
                              Lớp: <strong className="text-gray-700">{item.studentClass}</strong>
                            </span>
                          )}
                          {item.studentEmail && (
                            <span className="text-xs text-gray-400">
                              ({item.studentEmail})
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Course & Teacher information */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-indigo-700">
                        {item.courseName || item.courseId}
                      </span>
                      {item.regId && (
                        <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded text-[10px] border border-blue-100">
                          Mã lớp: {item.regId}
                        </span>
                      )}
                      <span className="text-gray-300">•</span>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        {item.teacherAvatar && (
                          <img
                            src={item.teacherAvatar}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        )}
                        <span>GV: <strong>{item.teacherName || 'Chưa phân công'}</strong></span>
                        {item.teacherId != null && (
                          <span className="text-[10px] text-gray-400">({formatTeacherCode(item.teacherId)})</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    {item.courseQuality && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          item.courseQuality === 'Tốt'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.courseQuality === 'Ổn'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {item.courseQuality}
                      </span>
                    )}

                    <div className="flex items-center text-amber-400 text-xs gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i
                          key={star}
                          className={`fas fa-star ${star <= item.rating ? 'text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenReply(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        item.response
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                      }`}
                    >
                      <i className="fas fa-reply text-[10px]" />
                      {item.response ? 'Sửa phản hồi' : 'Giải đáp ngay'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Xóa góp ý"
                    >
                      <i className="fas fa-trash text-xs" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Submission timestamp & content */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Thời gian gửi: {item.createdAtFormatted || (item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'Mới đây')}</span>
                  {item.response ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <i className="fas fa-check-circle text-xs" /> Đã giải đáp
                    </span>
                  ) : (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <i className="fas fa-clock text-xs" /> Chờ phản hồi
                    </span>
                  )}
                </div>
                <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-sm text-gray-800 leading-relaxed">
                  "{item.feedbackText}"
                </div>
              </div>

              {item.response && (
                <div className="ml-6 pl-4 border-l-2 border-indigo-500 py-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-700">Phản hồi từ Nhà trường / Giảng viên:</span>
                    <span className="text-[10px] text-gray-400">{item.respondedAt}</span>
                  </div>
                  <p className="text-xs text-gray-600 italic leading-relaxed">{item.response}</p>
                </div>
              )}
            </div>
          );
        })}</>
      )}
    </div>

      {/* Reply Modal */}
      {replyModal.isOpen && (
        <Modal
          open
          onClose={() => setReplyModal({ isOpen: false, feedback: null, response: '' })}
          title="Giải đáp ý kiến sinh viên"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 italic">
              "{replyModal.feedback?.feedbackText}"
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Nội dung trả lời giải đáp
              </label>
              <textarea
                rows={4}
                value={replyModal.response}
                onChange={(e) => setReplyModal((p) => ({ ...p, response: e.target.value }))}
                placeholder="Nhập nội dung giải đáp cho sinh viên..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReplyModal({ isOpen: false, feedback: null, response: '' })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={saving}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Đang gửi...' : 'Gửi phản hồi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ManageFeedbacks;

