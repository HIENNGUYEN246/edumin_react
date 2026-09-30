import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { feedbackApi } from '../../../api/feedbackApi.js';

export function ManageFeedbacks() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);

  // Filters
  const [filterRating, setFilterRating] = useState('all');
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);

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
      if (search) {
        const q = search.toLowerCase();
        const sName = (item.studentName || '').toLowerCase();
        const cName = (item.courseName || '').toLowerCase();
        const tName = (item.teacherName || '').toLowerCase();
        const text = (item.feedbackText || '').toLowerCase();
        if (!sName.includes(q) && !cName.includes(q) && !tName.includes(q) && !text.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [feedbacks, filterRating, search]);

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
      toast.success('Đã xóa phản hồi');
      await loadData();
    } catch {
      toast.error('Không thể xóa phản hồi');
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
        <div className="flex items-center gap-3">
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

          {(filterRating !== 'all' || searchText) && (
            <button
              type="button"
              onClick={() => {
                setFilterRating('all');
                setSearchText('');
              }}
              className="text-xs text-rose-600 font-semibold hover:underline"
            >
              Đặt lại
            </button>
          )}
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Tìm theo sinh viên, nội dung..."
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
            <p className="font-semibold text-gray-600 text-sm">Chưa có phản hồi nào</p>
            <p className="text-xs text-gray-400 mt-1">Khi sinh viên gửi góp ý về học phần, nội dung sẽ hiển thị ở đây.</p>
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item._id || item.id}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs hover:border-indigo-100 transition space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      item.isAnonymous
                        ? 'https://ui-avatars.com/api/?name=An+Danh&background=6b7280&color=fff'
                        : item.studentAvatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(item.studentName || 'SV')}&background=6366f1&color=fff`
                    }
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-gray-100"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">
                        {item.isAnonymous ? 'Sinh viên ẩn danh' : item.studentName || 'Sinh viên'}
                      </p>
                      {item.isAnonymous && (
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Ẩn danh
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-600 font-medium">
                      Môn: {item.courseName || item.courseId} • Giảng viên: {item.teacherName || 'Chưa phân công'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center text-amber-400 text-xs gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`fas fa-star ${star <= item.rating ? 'text-amber-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenReply(item)}
                    className="ml-3 px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <i className="fas fa-reply text-[10px]" />
                    {item.response ? 'Sửa phản hồi' : 'Trả lời'}
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

              <div className="bg-gray-50/60 p-3.5 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed">
                "{item.feedbackText}"
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
          ))
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

