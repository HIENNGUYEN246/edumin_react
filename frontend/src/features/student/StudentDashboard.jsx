import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { formatStudentCode, formatCurrency, formatDate } from '../../lib/format.js';
import { useMyEnrollments } from './useEnrollments.js';
import { feedbackApi } from '../../api/feedbackApi.js';
import { tuitionApi } from '../../api/tuitionApi.js';

export function StudentDashboard() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const { data: enrollData } = useMyEnrollments();
  const enrollments = enrollData?.data || [];
  const enrolledCount = enrollments.length;

  const [feedbacks, setFeedbacks] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackQuality, setFeedbackQuality] = useState('Tốt');
  const [feedbackText, setFeedbackText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const studentId = profile?.id ?? user?.studentId ?? user?.id;

  const { data: tuitionData } = useQuery({
    queryKey: ['tuition', 'me'],
    queryFn: tuitionApi.myTuition,
  });
  const tuitions = tuitionData?.data || [];
  const totalDue = tuitions.reduce((sum, t) => sum + (t.amountDue || 0), 0);
  const totalPaid = tuitions.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
  const allPaid = tuitions.length > 0 && totalDue === 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const unpaidTuitions = tuitions.filter((t) => t.status !== 'Đã đóng' && (t.amountDue > 0 || !t.status));
  const overdueTuitions = unpaidTuitions.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return !isNaN(d.getTime()) && d < today;
  });
  const hasOverdue = overdueTuitions.length > 0;

  const upcomingTuitions = unpaidTuitions
    .filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return !isNaN(d.getTime()) && d >= today;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const nextDue = upcomingTuitions[0];

  const loadFeedbacks = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await feedbackApi.list({ studentId });
      setFeedbacks(Array.isArray(res) ? res : res?.data || []);
    } catch {
      // Ignore
    }
  }, [studentId]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  // Set default selected course
  useEffect(() => {
    if (!selectedCourse && enrollments.length > 0) {
      const firstClassId = enrollments[0].class?.id || enrollments[0].classId;
      if (firstClassId) {
        setSelectedCourse(firstClassId);
      }
    }
  }, [selectedCourse, enrollments]);

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      toast.error('Vui lòng nhập nội dung góp ý');
      return;
    }

    const currentEnr = enrollments.find(
      (enr) => (enr.class?.id || enr.classId) === selectedCourse
    );
    const classObj = currentEnr?.class;

    try {
      setSubmitting(true);
      await feedbackApi.submit({
        studentId,
        studentName: profile?.hoTen || user?.hoTen || 'Sinh viên',
        studentEmail: profile?.email || user?.email || '',
        studentAvatar: typeof profile?.avatar === 'string' ? profile?.avatar : profile?.avatar?.url || '',
        teacherId: classObj?.teacherId || null,
        teacherName: classObj?.teacher || 'Giảng viên',
        courseId: classObj?.courseId || '',
        courseName: classObj?.courseName || '',
        regId: classObj?.id || selectedCourse,
        rating: feedbackRating,
        courseQuality: feedbackQuality,
        feedbackText: feedbackText.trim(),
        isAnonymous,
      });

      toast.success('Cảm ơn bạn đã gửi ý kiến đóng góp!');
      setFeedbackText('');
      await loadFeedbacks();
      setShowHistory(true);
      window.dispatchEvent(
        new CustomEvent('edumin_feedback_updated', {
          detail: { feedbackText: feedbackText.trim() },
        })
      );
    } catch {
      toast.error('Không thể gửi phản hồi, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" subtitle="Thông tin học tập của bạn" />

      <ProfileCard
        user={user}
        profile={profile}
        code={profile?.id != null ? formatStudentCode(profile.id) : ''}
        fields={[
          { label: 'Lớp sinh hoạt', value: profile?.className || 'Chưa phân lớp' },
          { label: 'Khoa', value: profile?.department },
          { label: 'Hệ đào tạo', value: profile?.education },
          { label: 'Học phần đã đăng ký', value: enrolledCount },
        ]}
      />

      {/* Overdue Tuition Warning */}
      {hasOverdue && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <i className="fas fa-exclamation-triangle text-xl animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-200/80 px-2.5 py-0.5 rounded-full">
                  Cảnh báo quá hạn nộp học phí
                </span>
                <span className="text-xs text-rose-600 font-bold">
                  {overdueTuitions.length} khoản nợ đã quá hạn
                </span>
              </div>
              <h4 className="text-base font-extrabold text-rose-950 mt-1">
                Bạn có khoản học phí quá hạn cần thanh toán ngay!
              </h4>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Học kỳ quá hạn:{' '}
                <strong>
                  {overdueTuitions
                    .map((t) => `${t.semester} (Hạn: ${formatDate(t.dueDate)})`)
                    .join(', ')}
                </strong>
                . Vui lòng thanh toán học phí sớm để tránh bị khóa tài khoản đăng ký tín chỉ và đình chỉ thi.
              </p>
            </div>
          </div>
          <Link
            to="/student/tuition"
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all shrink-0 flex items-center gap-2"
          >
            <i className="fas fa-credit-card text-xs" />
            <span>Nộp học phí ngay</span>
          </Link>
        </div>
      )}

      {/* Upcoming Due Date Reminder */}
      {!hasOverdue && nextDue && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <i className="fas fa-calendar-alt text-base" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <span>Nhắc nhở hạn nộp học phí: {nextDue.semester}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-800">
                  Hạn nộp: {formatDate(nextDue.dueDate)}
                </span>
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Số tiền cần nộp: <strong>{formatCurrency(nextDue.amountDue || nextDue.amount)}</strong>. Vui lòng hoàn tất thanh toán trước hạn chót.
              </div>
            </div>
          </div>
          <Link
            to="/student/tuition"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition shrink-0"
          >
            Xem thông tin nộp
          </Link>
        </div>
      )}

      {/* Tuition / Financial Status Banner */}
      <div
        className={`rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all ${
          hasOverdue
            ? 'bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600'
            : totalDue > 0
            ? 'bg-gradient-to-r from-indigo-700 via-blue-600 to-teal-600'
            : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <i className={`fas ${hasOverdue ? 'fa-exclamation-triangle' : 'fa-wallet'} text-2xl text-white`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-semibold text-white/90">
                Tài chính & Học phí sinh viên
              </span>
              {tuitions.length > 0 && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    allPaid
                      ? 'bg-white/30 text-white'
                      : hasOverdue
                      ? 'bg-rose-200 text-rose-900 font-extrabold'
                      : 'bg-amber-400 text-gray-900'
                  }`}
                >
                  {allPaid
                    ? '✓ Đã hoàn thành'
                    : hasOverdue
                    ? `Quá hạn: ${formatCurrency(totalDue)}`
                    : `Còn nợ: ${formatCurrency(totalDue)}`}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold">
              {tuitions.length === 0
                ? 'Chưa phát sinh học phí học kỳ hiện tại'
                : allPaid
                ? 'Bạn đã hoàn tất học phí tất cả các kỳ!'
                : `Học phí còn phải đóng: ${formatCurrency(totalDue)}`}
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Đã thanh toán: {formatCurrency(totalPaid)} • Xem chi tiết học phí, lịch sử giao dịch và số tài khoản ngân hàng
            </p>
          </div>
        </div>
        <Link
          to="/student/tuition"
          className="px-5 py-2.5 bg-white text-gray-800 hover:bg-gray-100 rounded-xl font-bold text-xs shadow-xs transition-all shrink-0 flex items-center gap-2"
        >
          <span>Chi tiết học phí</span>
          <i className="fas fa-arrow-right text-xs" />
        </Link>
      </div>

      {/* Feedback Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-comment-dots text-lg" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-800">Ý kiến đóng góp & Phản hồi Giảng viên</h4>
              <p className="text-xs text-gray-400">Gửi góp ý về phương pháp giảng dạy, học liệu và đánh giá chất lượng học phần</p>
            </div>
          </div>

          {feedbacks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                showHistory
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              }`}
            >
              <i className="fas fa-history text-xs" />
              <span>Lịch sử góp ý ({feedbacks.length})</span>
            </button>
          )}
        </div>

        {showHistory ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
              <span className="font-bold">Các phản hồi bạn đã gửi:</span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-indigo-600 hover:underline text-xs font-bold"
              >
                + Viết phản hồi mới
              </button>
            </div>

            {feedbacks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có góp ý nào</p>
            ) : (
              feedbacks.map((fb) => (
                <div
                  key={fb._id || fb.id}
                  className="p-4 bg-gray-50/75 rounded-2xl border border-gray-100 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">{fb.courseName || fb.courseId}</span>
                      {fb.regId && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100">
                          Mã lớp: {fb.regId}
                        </span>
                      )}
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500 font-medium">GV: {fb.teacherName || 'Chưa phân công'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        {fb.createdAtFormatted || (fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('vi-VN') : '')}
                      </span>
                      <div className="flex items-center text-amber-400 text-xs">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <i
                            key={s}
                            className={`fas fa-star ${s <= fb.rating ? 'text-amber-400' : 'text-gray-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 italic leading-relaxed">"{fb.feedbackText}"</p>

                  {fb.response ? (
                    <div className="mt-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-700">Phản hồi từ Thầy/Cô:</span>
                        <span className="text-[10px] text-gray-400">
                          {fb.respondedAt ? new Date(fb.respondedAt).toLocaleString('vi-VN') : ''}
                        </span>
                      </div>
                      <p className="text-gray-700">{fb.response}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic">⏳ Đang chờ Giảng viên xem và giải đáp...</p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitFeedback} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Chọn lớp học phần góp ý
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  {enrollments.length === 0 ? (
                    <option value="">Chưa đăng ký môn học nào</option>
                  ) : (
                    enrollments.map((enr) => {
                      const c = enr.class;
                      const classId = c?.id || enr.classId;
                      const courseName = c?.courseName || c?.courseId || classId;
                      const teacherName = c?.teacher ? ` - GV: ${c.teacher}` : '';
                      return (
                        <option key={enr._id || classId} value={classId}>
                          {courseName} ({classId}){teacherName}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Chất lượng giảng dạy
                </label>
                <div className="flex gap-2">
                  {['Tốt', 'Ổn', 'Cần cải thiện'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setFeedbackQuality(q)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                        feedbackQuality === q
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Đánh giá số sao
                </label>
                <span className="text-xs font-bold text-amber-600">
                  {feedbackRating} / 5 sao
                </span>
              </div>
              <div className="flex justify-around bg-gray-50 p-2 rounded-xl border border-gray-100">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-1 text-xl hover:scale-125 transition-transform"
                    title={`${star} sao`}
                  >
                    <i
                      className={`${
                        star <= feedbackRating ? 'fas fa-star text-amber-400' : 'far fa-star text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Nội dung góp ý chi tiết
              </label>
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Viết cảm nghĩ hoặc góp ý của bạn về phương pháp giảng dạy, bài tập, slide bài giảng..."
                className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-400 h-4 w-4"
                />
                <span className="text-xs text-gray-600">Gửi ẩn danh (không hiện tên và ảnh đại diện)</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? 'Đang gửi...' : 'Gửi góp ý'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;

