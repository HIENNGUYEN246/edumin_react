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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'replied'
  const [classFilter, setClassFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [replyModal, setReplyModal] = useState({
    isOpen: false,
    feedback: null,
    response: '',
  });
  const [savingReply, setSavingReply] = useState(false);

  const teacherId = profile?.id ?? user?.teacherId ?? user?.id;

  const getTeacherTitle = useCallback(
    (name, gender) => {
      const cleanName = (name || '').trim();
      if (!cleanName) return 'Thầy/Cô phụ trách';
      if (/^(thầy|cô)\s+/i.test(cleanName)) return cleanName;
      if (gender === 'Nữ') return `Cô ${cleanName}`;
      if (gender === 'Nam') return `Thầy ${cleanName}`;
      if (profile?.gender === 'Nữ' && (profile?.hoTen === cleanName || profile?.name === cleanName)) {
        return `Cô ${cleanName}`;
      }
      if (profile?.gender === 'Nam' && (profile?.hoTen === cleanName || profile?.name === cleanName)) {
        return `Thầy ${cleanName}`;
      }
      if (/\bthị\b/i.test(cleanName)) return `Cô ${cleanName}`;
      return `Thầy ${cleanName}`;
    },
    [profile]
  );

  const getTeacherAvatar = useCallback(
    (fb) => {
      if (fb.respondedByAvatar) return fb.respondedByAvatar;
      if (fb.teacherAvatar) return fb.teacherAvatar;
      if (profile?.avatar) {
        return typeof profile.avatar === 'string' ? profile.avatar : profile.avatar?.url;
      }
      const name = fb.respondedByName || fb.teacherName || profile?.hoTen || profile?.name || 'GV';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&bold=true`;
    },
    [profile]
  );

  const getStudentAvatar = useCallback((fb) => {
    if (fb.isAnonymous) {
      return 'https://ui-avatars.com/api/?name=An+Danh&background=64748b&color=fff&bold=true';
    }
    if (fb.studentAvatar) return fb.studentAvatar;
    const name = fb.studentName || 'SV';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&bold=true`;
  }, []);

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

  const feedbackClasses = useMemo(() => {
    const map = new Map();
    feedbacks.forEach((f) => {
      const key = f.regId || f.courseId;
      if (key && !map.has(key)) {
        map.set(key, f.courseName || key);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (statusFilter === 'pending' && Boolean(fb.response)) return false;
      if (statusFilter === 'replied' && !fb.response) return false;

      if (classFilter !== 'all') {
        const matchesClass = fb.regId === classFilter || fb.courseId === classFilter;
        if (!matchesClass) return false;
      }

      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const student = (fb.studentName || '').toLowerCase();
        const course = (fb.courseName || fb.courseId || '').toLowerCase();
        const text = (fb.feedbackText || '').toLowerCase();
        const resp = (fb.response || '').toLowerCase();
        const reg = (fb.regId || '').toLowerCase();
        if (
          !student.includes(q) &&
          !course.includes(q) &&
          !text.includes(q) &&
          !resp.includes(q) &&
          !reg.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [feedbacks, statusFilter, classFilter, searchKeyword]);

  const canTeacherReply = useCallback(
    (fb) => {
      if (user?.role === 'admin') return true;
      if (user?.role !== 'teacher') return false;

      const currentTeacherCode = profile?.id ?? user?.teacherId ?? user?.id;
      const currentTeacherRef = profile?._id ?? user?.teacher;
      const currentTeacherName = (profile?.hoTen || profile?.name || user?.name || '').trim().toLowerCase();

      const fbTeacherCode = fb.teacherId;
      const fbTeacherRef = fb.teacherRef
        ? typeof fb.teacherRef === 'object'
          ? fb.teacherRef._id || fb.teacherRef.id
          : fb.teacherRef
        : null;
      const fbTeacherName = (fb.teacherName || '').trim().toLowerCase();

      if (currentTeacherCode != null && fbTeacherCode != null && String(currentTeacherCode) === String(fbTeacherCode)) {
        return true;
      }
      if (currentTeacherRef && fbTeacherRef && String(currentTeacherRef) === String(fbTeacherRef)) {
        return true;
      }
      if (currentTeacherName && fbTeacherName && currentTeacherName === fbTeacherName) {
        return true;
      }
      return false;
    },
    [user, profile]
  );

  const handleOpenReply = (fb) => {
    if (!canTeacherReply(fb)) {
      toast.error('Chỉ giảng viên phụ trách học phần mới có quyền phản hồi ý kiến này');
      return;
    }
    setReplyModal({
      isOpen: true,
      feedback: fb,
      response: fb.response || '',
    });
  };

  const handleSendReply = async () => {
    if (!replyModal.response.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi');
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
    } catch (err) {
      const msg = err?.response?.data?.error || 'Lỗi khi gửi phản hồi, vui lòng thử lại';
      toast.error(msg);
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-comment-dots text-lg" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-800">
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
                {feedbackStats.pending} chưa phản hồi
              </span>
            )}
          </div>
        </div>

        {/* Smart Filters Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1 border-b border-slate-100">
          {/* Status Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tất cả</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'all'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {feedbackStats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Chưa phản hồi</span>
              {feedbackStats.pending > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-rose-100 text-rose-700">
                  {feedbackStats.pending}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('replied')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'replied'
                  ? 'bg-white text-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Đã phản hồi</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'replied'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {feedbackStats.replied}
              </span>
            </button>
          </div>

          {/* Secondary Controls: Class Filter & Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            {feedbackClasses.length > 1 && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="all">Tất cả lớp học phần</option>
                {feedbackClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 max-w-xs">
              <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Tìm ý kiến, môn học..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
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
        ) : filteredFeedbacks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            {statusFilter === 'pending' ? (
              <>
                <i className="fas fa-check-circle text-3xl text-emerald-500 mb-1" />
                <p className="text-xs font-bold text-slate-700">
                  Tuyệt vời! Bạn đã phản hồi tất cả các ý kiến từ sinh viên.
                </p>
                <p className="text-[11px] text-slate-400">
                  Hiện không còn ý kiến nào đang chờ bạn xử lý.
                </p>
              </>
            ) : statusFilter === 'replied' ? (
              <>
                <i className="fas fa-inbox text-3xl text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-700">
                  Chưa có ý kiến nào được phản hồi trong danh mục này.
                </p>
              </>
            ) : (
              <>
                <i className="fas fa-filter text-3xl text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-700">
                  Không tìm thấy ý kiến nào phù hợp với bộ lọc hiện tại.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setClassFilter('all');
                    setSearchKeyword('');
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  Đặt lại bộ lọc
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeedbacks.map((fb) => {
              const teacherDisplayName = getTeacherTitle(
                fb.respondedByName || fb.teacherName || profile?.hoTen || profile?.name,
                fb.teacherGender || profile?.gender
              );
              const teacherAvatar = getTeacherAvatar(fb);
              const studentAvatar = getStudentAvatar(fb);

              return (
                <div
                  key={fb._id || fb.id}
                  className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all space-y-4"
                >
                  {/* Card Header: Class info, Rating & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {fb.courseName || fb.courseId}
                      </span>
                      {fb.regId && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                          Mã lớp: {fb.regId}
                        </span>
                      )}
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
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center text-amber-400 text-xs">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <i
                            key={s}
                            className={`fas fa-star ${s <= fb.rating ? 'text-amber-400' : 'text-slate-200'}`}
                          />
                        ))}
                      </div>

                      {fb.response ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                          <i className="fas fa-check-circle text-[11px]" />
                          <span>Đã phản hồi</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg border border-rose-200 flex items-center gap-1.5">
                          <i className="fas fa-clock text-[11px]" />
                          <span>Chưa phản hồi</span>
                        </span>
                      )}

                      {canTeacherReply(fb) && (
                        <button
                          type="button"
                          onClick={() => handleOpenReply(fb)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                          <i className={`fas ${fb.response ? 'fa-pen-to-square' : 'fa-reply'} text-[11px]`} />
                          <span>{fb.response ? 'Sửa phản hồi' : 'Phản hồi ngay'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2-Way Chat Bubble Thread */}
                  <div className="space-y-3.5">
                    {/* BUBBLE 1: Student Opinion (Left) */}
                    <div className="flex items-start gap-3 max-w-3xl">
                      <img
                        src={studentAvatar}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0 mt-0.5"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {fb.isAnonymous ? 'Sinh viên ẩn danh' : fb.studentName || 'Sinh viên'}
                          </span>
                          {fb.isAnonymous ? (
                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.2 rounded-full">
                              Ẩn danh
                            </span>
                          ) : (
                            <>
                              {fb.studentId != null && (
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-slate-200">
                                  {formatStudentCode(fb.studentId)}
                                </span>
                              )}
                              {fb.studentClass && (
                                <span className="text-[11px] text-slate-500">
                                  ({fb.studentClass})
                                </span>
                              )}
                            </>
                          )}
                          <span className="text-[10px] text-slate-400">
                            • {fb.createdAtFormatted || (fb.createdAt ? new Date(fb.createdAt).toLocaleString('vi-VN') : 'Mới đây')}
                          </span>
                        </div>

                        {/* Student Chat Bubble */}
                        <div className="p-3.5 bg-slate-50 text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/80 shadow-2xs">
                          <p className="text-xs leading-relaxed italic text-slate-700">
                            &quot;{fb.feedbackText}&quot;
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* BUBBLE 2: Teacher Official Reply (Right / Indented Thread) */}
                    {fb.response ? (
                      <div className="flex items-start justify-end gap-3 pl-8 md:pl-14">
                        <div className="space-y-1 flex-1 max-w-2xl text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <span className="text-[10px] text-slate-400">
                              {fb.respondedAt ? `• ${fb.respondedAt}` : ''}
                            </span>
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.2 rounded-full">
                              Giảng viên phụ trách
                            </span>
                            <span className="font-bold text-indigo-900 text-xs">
                              Phản hồi từ {teacherDisplayName}
                            </span>
                            {(fb.teacherId != null || profile?.id != null) && (
                              <span className="bg-white text-indigo-600 text-[10px] font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                                {formatTeacherCode(fb.teacherId ?? profile?.id)}
                              </span>
                            )}
                          </div>

                          {/* Teacher Chat Bubble */}
                          <div className="p-3.5 bg-indigo-50/90 text-slate-800 rounded-2xl rounded-tr-xs border border-indigo-200/80 shadow-2xs text-left space-y-2">
                            <p className="text-xs leading-relaxed text-slate-800 font-normal">
                              {fb.response}
                            </p>
                            {canTeacherReply(fb) && (
                              <div className="flex justify-end pt-1 border-t border-indigo-100/60">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReply(fb)}
                                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                                >
                                  <i className="fas fa-pen-to-square text-[10px]" />
                                  <span>Chỉnh sửa phản hồi</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <img
                          src={teacherAvatar}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border-2 border-indigo-300 shadow-2xs shrink-0 mt-0.5"
                        />
                      </div>
                    ) : (
                      /* Awaiting Teacher Reply Callout */
                      <div className="ml-12 p-3 bg-amber-50/70 border border-dashed border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-amber-800">
                          <i className="fas fa-comment-dots text-amber-500 text-sm" />
                          <span className="font-medium">
                            Ý kiến này đang chờ {teacherDisplayName} gửi phản hồi hướng dẫn cho sinh viên...
                          </span>
                        </div>
                        {canTeacherReply(fb) && (
                          <button
                            type="button"
                            onClick={() => handleOpenReply(fb)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          >
                            <i className="fas fa-reply text-[10px]" />
                            <span>Phản hồi ngay</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyModal.isOpen && (
        <Modal
          open
          onClose={() => setReplyModal({ isOpen: false, feedback: null, response: '' })}
          title="Phản hồi ý kiến sinh viên"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">
                Ý kiến từ:{' '}
                <span className="text-slate-800 font-bold">
                  {replyModal.feedback?.isAnonymous
                    ? 'Sinh viên ẩn danh'
                    : replyModal.feedback?.studentName || 'Sinh viên'}
                </span>
                {replyModal.feedback?.courseName && (
                  <>
                    {' '}• Lớp:{' '}
                    <span className="text-indigo-600 font-bold">
                      {replyModal.feedback.courseName}
                    </span>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-700 italic">
                &quot;{replyModal.feedback?.feedbackText}&quot;
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nội dung phản hồi từ {getTeacherTitle(profile?.hoTen || profile?.name, profile?.gender)} cho sinh viên
              </label>
              <textarea
                rows={4}
                value={replyModal.response}
                onChange={(e) => setReplyModal((p) => ({ ...p, response: e.target.value }))}
                placeholder="Nhập nội dung phản hồi chính thức, giải thích hoặc dặn dò sinh viên..."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReplyModal({ isOpen: false, feedback: null, response: '' })}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={savingReply}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {savingReply ? 'Đang gửi...' : replyModal.feedback?.response ? 'Cập nhật phản hồi' : 'Gửi phản hồi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TeacherDashboard;
