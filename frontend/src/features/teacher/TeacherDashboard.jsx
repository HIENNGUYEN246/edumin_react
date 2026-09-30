import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { formatTeacherCode, formatStudentCode } from '../../lib/format.js';
import { useMyTeacherClasses } from './useTeacherClasses.js';
import { feedbackApi } from '../../api/feedbackApi.js';

export function TeacherDashboard() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const { data } = useMyTeacherClasses();
  const classCount = data?.data?.length ?? 0;

  const [feedbacks, setFeedbacks] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [replyModal, setReplyModal] = useState({
    isOpen: false,
    feedback: null,
    response: '',
  });
  const [savingReply, setSavingReply] = useState(false);

  const teacherId = profile?.id ?? user?.teacherId ?? user?.id;

  const loadFeedbacks = useCallback(async () => {
    if (!teacherId) return;
    try {
      setLoadingFeedbacks(true);
      const res = await feedbackApi.list({ teacherId });
      setFeedbacks(Array.isArray(res) ? res : res?.data || []);
    } catch {
      // Ignore
    } finally {
      setLoadingFeedbacks(false);
    }
  }, [teacherId]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  const feedbackStats = useMemo(() => {
    const total = feedbacks.length;
    const avg =
      total > 0
        ? (feedbacks.reduce((sum, f) => sum + Number(f.rating || 5), 0) / total).toFixed(1)
        : '5.0';
    const replied = feedbacks.filter((f) => Boolean(f.response)).length;
    const pending = total - replied;
    return { total, avg, replied, pending };
  }, [feedbacks]);

  const handleOpenReply = (fb) => {
    setReplyModal({
      isOpen: true,
      feedback: fb,
      response: fb.response || '',
    });
  };

  const handleSendReply = async () => {
    if (!replyModal.response.trim()) {
      toast.error('Vui lòng nhập nội dung giải đáp');
      return;
    }

    try {
      setSavingReply(true);
      await feedbackApi.respond(
        replyModal.feedback._id || replyModal.feedback.id,
        replyModal.response
      );
      toast.success('Đã gửi phản hồi cho sinh viên');
      setReplyModal({ isOpen: false, feedback: null, response: '' });
      await loadFeedbacks();
      window.dispatchEvent(
        new CustomEvent('edumin_feedback_updated', {
          detail: { feedbackText: replyModal.response },
        })
      );
    } catch {
      toast.error('Lỗi khi gửi phản hồi, vui lòng thử lại');
    } finally {
      setSavingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" subtitle="Thông tin giảng dạy của bạn" />
      <ProfileCard
        user={user}
        profile={profile}
        code={profile?.id != null ? formatTeacherCode(profile.id) : ''}
        fields={[
          { label: 'Khoa', value: profile?.department },
          { label: 'Số điện thoại', value: profile?.phone },
          { label: 'Trình độ', value: profile?.education },
          { label: 'Số lớp phụ trách', value: classCount },
        ]}
      />

      {/* Student Feedback & Evaluation Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-comment-dots text-lg" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-800">
                Ý kiến & Đánh giá từ Sinh viên
              </h4>
              <p className="text-xs text-gray-400">
                Phản hồi của sinh viên về các lớp học phần bạn đang phụ trách
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-xl text-amber-700 text-xs font-bold border border-amber-100">
              <i className="fas fa-star text-amber-500" />
              <span>{feedbackStats.avg} / 5.0 sao ({feedbackStats.total} góp ý)</span>
            </div>
            {feedbackStats.pending > 0 && (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100">
                {feedbackStats.pending} chưa giải đáp
              </span>
            )}
          </div>
        </div>

        {loadingFeedbacks ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <i className="far fa-comments text-3xl mb-2 text-gray-300" />
            <p className="text-xs font-medium text-gray-500">
              Chưa có ý kiến phản hồi nào từ sinh viên cho các lớp của bạn.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div
                key={fb._id || fb.id}
                className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        fb.isAnonymous
                          ? 'https://ui-avatars.com/api/?name=An+Danh&background=6b7280&color=fff'
                          : fb.studentAvatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(fb.studentName || 'SV')}&background=6366f1&color=fff`
                      }
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">
                          {fb.isAnonymous ? 'Sinh viên ẩn danh' : fb.studentName || 'Sinh viên'}
                        </span>
                        {fb.isAnonymous ? (
                          <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Ẩn danh
                          </span>
                        ) : (
                          <>
                            {fb.studentId != null && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                                {formatStudentCode(fb.studentId)}
                              </span>
                            )}
                            {fb.studentClass && (
                              <span className="text-[11px] text-gray-500">
                                ({fb.studentClass})
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-indigo-600">
                          {fb.courseName || fb.courseId}
                        </span>
                        {fb.regId && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                            Mã lớp: {fb.regId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {fb.courseQuality && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          fb.courseQuality === 'Tốt'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : fb.courseQuality === 'Ổn'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {fb.courseQuality}
                      </span>
                    )}
                    <div className="flex items-center text-amber-400 text-xs">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <i
                          key={s}
                          className={`fas fa-star ${s <= fb.rating ? 'text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReply(fb)}
                      className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                    >
                      <i className="fas fa-reply text-[10px]" />
                      {fb.response ? 'Sửa lời giải đáp' : 'Giải đáp sinh viên'}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-700 italic bg-white p-3 rounded-xl border border-gray-100">
                  "{fb.feedbackText}"
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                  <span>
                    Thời gian gửi: {fb.createdAtFormatted || (fb.createdAt ? new Date(fb.createdAt).toLocaleString('vi-VN') : 'Mới đây')}
                  </span>
                  {fb.response ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <i className="fas fa-check-circle" /> Đã trả lời
                    </span>
                  ) : (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <i className="fas fa-clock" /> Đang đợi giải đáp
                    </span>
                  )}
                </div>

                {fb.response && (
                  <div className="mt-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700">Lời giải đáp của bạn:</span>
                      <span className="text-[10px] text-gray-400">
                        {fb.respondedAt ? new Date(fb.respondedAt).toLocaleString('vi-VN') : ''}
                      </span>
                    </div>
                    <p className="text-gray-700">{fb.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
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
                Nội dung giải đáp cho sinh viên
              </label>
              <textarea
                rows={4}
                value={replyModal.response}
                onChange={(e) => setReplyModal((p) => ({ ...p, response: e.target.value }))}
                placeholder="Nhập nội dung giải đáp, hướng dẫn hoặc tiếp thu ý kiến của sinh viên..."
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
                disabled={savingReply}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {savingReply ? 'Đang gửi...' : 'Gửi giải đáp'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TeacherDashboard;
