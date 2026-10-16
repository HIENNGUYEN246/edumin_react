import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import {
  formatStudentCode,
  calculateGpa,
  getGpaClassification,
  DEFAULT_GRADE_WEIGHTS,
} from '../../lib/format.js';
import { useMyEnrollments } from './useEnrollments.js';
import { feedbackApi } from '../../api/feedbackApi.js';

export function StudentDashboardInner() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const { data: enrollData, isLoading: isEnrollLoading } = useMyEnrollments();

  // Safely extract enrollments whether API returns { data: [...] } or direct array
  const enrollments = useMemo(() => {
    if (Array.isArray(enrollData)) return enrollData;
    if (Array.isArray(enrollData?.data)) return enrollData.data;
    return [];
  }, [enrollData]);
  const enrolledCount = enrollments.length;

  const [feedbacks, setFeedbacks] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackQuality, setFeedbackQuality] = useState('Tốt');
  const [feedbackText, setFeedbackText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const studentId = profile?.id ?? user?.studentId ?? user?.id ?? user?._id;

  // Student personal grades & overall GPA stats with full null-safety
  const studentGradebook = useMemo(() => {
    try {
      if (!Array.isArray(enrollments)) return [];
      return enrollments
        .map((enr) => {
          if (!enr) return null;
          const cls = enr?.class || {};
          const classId = cls?.id || enr?.classId || '';
          const courseId = cls?.courseId || '';
          const courseName = cls?.courseName || cls?.name || courseId || classId || 'Học phần';
          const credits = Number(cls?.credits) || 3;
          const teacherName =
            typeof cls?.teacher === 'object'
              ? cls?.teacher?.hoTen || cls?.teacher?.name || 'Chưa phân công'
              : cls?.teacher || 'Chưa phân công';
          const weights =
            cls?.gradeWeights && typeof cls.gradeWeights === 'object'
              ? cls.gradeWeights
              : DEFAULT_GRADE_WEIGHTS;

          const manual = enr?.manualGrades || {};
          const compGrades = {
            attendance: manual?.attendance ?? null,
            homework: manual?.assignment ?? manual?.homework ?? null,
            midterm: manual?.midterm ?? null,
            presentation: manual?.presentation ?? null,
            final: manual?.final ?? null,
          };

          const gpa =
            enr?.finalScore != null && !isNaN(enr.finalScore)
              ? Number(enr.finalScore)
              : calculateGpa(compGrades, weights);
          const classification = getGpaClassification(gpa) || { text: 'Chưa có điểm', tone: 'neutral' };

          let gpa4 = null;
          let letterGrade = '—';
          if (gpa != null && Number.isFinite(gpa)) {
            if (gpa >= 8.5) {
              gpa4 = 4.0;
              letterGrade = 'A';
            } else if (gpa >= 7.0) {
              gpa4 = 3.0;
              letterGrade = 'B';
            } else if (gpa >= 5.5) {
              gpa4 = 2.0;
              letterGrade = 'C';
            } else if (gpa >= 4.0) {
              gpa4 = 1.0;
              letterGrade = 'D';
            } else {
              gpa4 = 0.0;
              letterGrade = 'F';
            }
          }

          const isPassed = gpa != null && Number.isFinite(gpa) ? gpa >= 4.0 : null;

          return {
            enrollmentId: enr?._id || classId,
            classId,
            courseId,
            courseName,
            credits,
            teacherName,
            weights,
            compGrades,
            gpa,
            gpa4,
            letterGrade,
            classification,
            isPassed,
          };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('Lỗi tính bảng điểm sinh viên:', err);
      return [];
    }
  }, [enrollments]);

  const studentGradeStats = useMemo(() => {
    try {
      const safeGradebook = Array.isArray(studentGradebook) ? studentGradebook : [];
      const completedCourses = safeGradebook.filter((g) => g && g.gpa != null && Number.isFinite(g.gpa));
      const totalCredits = safeGradebook.reduce((sum, g) => sum + (Number(g?.credits) || 0), 0);
      const passedCredits = completedCourses.reduce(
        (sum, g) => sum + (g?.isPassed ? Number(g?.credits) || 0 : 0),
        0
      );

      if (completedCourses.length === 0) {
        return {
          gpa10: null,
          gpa4: null,
          totalCredits,
          passedCredits: 0,
          classification: { text: 'Đang học', tone: 'neutral' },
        };
      }

      const totalWeighted10 = completedCourses.reduce((sum, g) => sum + (g.gpa ?? 0) * (Number(g?.credits) || 0), 0);
      const totalCompCredits = completedCourses.reduce((sum, g) => sum + (Number(g?.credits) || 0), 0);
      const gpa10 = totalCompCredits > 0 ? Number((totalWeighted10 / totalCompCredits).toFixed(2)) : null;

      const totalWeighted4 = completedCourses.reduce(
        (sum, g) => sum + (g.gpa4 ?? 0) * (Number(g?.credits) || 0),
        0
      );
      const gpa4 = totalCompCredits > 0 ? Number((totalWeighted4 / totalCompCredits).toFixed(2)) : null;

      return {
        gpa10,
        gpa4,
        totalCredits,
        passedCredits,
        classification: getGpaClassification(gpa10) || { text: 'Chưa có điểm', tone: 'neutral' },
      };
    } catch (err) {
      console.error('Lỗi tính thống kê GPA:', err);
      return {
        gpa10: null,
        gpa4: null,
        totalCredits: 0,
        passedCredits: 0,
        classification: { text: 'Đang học', tone: 'neutral' },
      };
    }
  }, [studentGradebook]);

  const getTeacherTitle = useCallback((name, gender) => {
    const rawName = typeof name === 'object' ? name?.hoTen || name?.name || '' : name || '';
    const cleanName = String(rawName).trim();
    if (!cleanName) return 'Thầy/Cô phụ trách';
    if (/^(thầy|cô)\s+/i.test(cleanName)) return cleanName;
    if (gender === 'Nữ') return `Cô ${cleanName}`;
    if (gender === 'Nam') return `Thầy ${cleanName}`;
    if (/\bthị\b/i.test(cleanName)) return `Cô ${cleanName}`;
    return `Thầy ${cleanName}`;
  }, []);

  const loadFeedbacks = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await feedbackApi.list({ studentId });
      const items = Array.isArray(res) ? res : res?.data || [];
      setFeedbacks(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn('Lỗi tải danh sách phản hồi:', err);
      setFeedbacks([]);
    }
  }, [studentId]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  // Set default selected course
  useEffect(() => {
    if (!selectedCourse && Array.isArray(enrollments) && enrollments.length > 0) {
      const firstClassId = enrollments[0]?.class?.id || enrollments[0]?.classId;
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

    const currentEnr = Array.isArray(enrollments)
      ? enrollments.find((enr) => (enr?.class?.id || enr?.classId) === selectedCourse)
      : null;
    const classObj = currentEnr?.class;

    try {
      setSubmitting(true);
      const teacherName =
        typeof classObj?.teacher === 'object'
          ? classObj?.teacher?.hoTen || classObj?.teacher?.name || 'Giảng viên'
          : classObj?.teacher || 'Giảng viên';

      await feedbackApi.submit({
        studentId,
        studentName: profile?.hoTen || user?.hoTen || 'Sinh viên',
        studentEmail: profile?.email || user?.email || '',
        studentAvatar:
          typeof profile?.avatar === 'string'
            ? profile.avatar
            : profile?.avatar?.url ||
              (typeof user?.avatar === 'string' ? user.avatar : user?.avatar?.url) ||
              '',
        teacherId: classObj?.teacherId || null,
        teacherName,
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

      {/* Profile Card Widget */}
      <ProfileCard
        user={user}
        profile={profile}
        code={
          profile?.id != null
            ? formatStudentCode(profile.id)
            : user?.studentId
            ? formatStudentCode(user.studentId)
            : ''
        }
        fields={[
          { label: 'Lớp sinh hoạt', value: profile?.className || 'Chưa phân lớp' },
          {
            label: 'Khoa',
            value:
              profile?.department ||
              profile?.departmentRef?.name ||
              user?.department ||
              user?.khoa ||
              'Chưa cập nhật',
          },
          { label: 'Hệ đào tạo', value: profile?.education || 'Chính quy' },
          { label: 'Học phần đã đăng ký', value: enrolledCount },
        ]}
      />

      {/* Student Personal Gradebook Widget */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-graduation-cap text-lg" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-800">
                Bảng điểm Cá nhân & Điểm tổng kết học phần
              </h4>
              <p className="text-xs text-gray-400">
                Xem trực tiếp điểm thành phần, điểm tổng kết môn và xếp loại học lực của các môn đang học
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100 flex items-center gap-1.5">
              <i className="fas fa-star text-indigo-500" />
              <span>
                GPA Thang 10:{' '}
                <strong>
                  {studentGradeStats?.gpa10 != null ? studentGradeStats.gpa10.toFixed(2) : '—'}
                </strong>
              </span>
            </span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-100 flex items-center gap-1.5">
              <i className="fas fa-award text-emerald-500" />
              <span>
                GPA Thang 4:{' '}
                <strong>
                  {studentGradeStats?.gpa4 != null ? studentGradeStats.gpa4.toFixed(2) : '—'}
                </strong>
              </span>
            </span>
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-100 flex items-center gap-1.5">
              <i className="fas fa-medal text-amber-500" />
              <span>
                Xếp loại: <strong>{studentGradeStats?.classification?.text || 'Đang học'}</strong>
              </span>
            </span>
            <a
              href="/student/attendance"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <i className="fas fa-calendar-check text-xs" />
              <span>Chi tiết điểm danh & sổ điểm</span>
            </a>
          </div>
        </div>

        {isEnrollLoading ? (
          <div className="py-12 flex justify-center items-center">
            <Spinner label="Đang tải dữ liệu điểm học phần..." />
          </div>
        ) : !Array.isArray(studentGradebook) || studentGradebook.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200">
            <i className="fas fa-book-open text-3xl mb-2 text-gray-300" />
            <p className="font-semibold text-gray-600 text-xs">Bạn chưa đăng ký môn học nào trong học kỳ này</p>
            <a
              href="/student/course-registration"
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              <i className="fas fa-plus" />
              <span>Đăng ký học phần ngay</span>
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[760px] text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3">Môn học & Lớp</th>
                  <th className="px-4 py-3">Giảng viên</th>
                  <th className="px-3 py-3 text-center">Chuyên cần</th>
                  <th className="px-3 py-3 text-center">Bài tập / Quiz</th>
                  <th className="px-3 py-3 text-center">Giữa kỳ</th>
                  <th className="px-3 py-3 text-center">Cuối kỳ</th>
                  <th className="px-3 py-3 text-center">Tổng kết (Thang 10)</th>
                  <th className="px-3 py-3 text-center">Thang 4 / Chữ</th>
                  <th className="px-3 py-3 text-center">Trạng thái & Xếp loại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentGradebook.map((row) => {
                  if (!row) return null;
                  return (
                    <tr key={row?.enrollmentId || row?.classId} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm leading-tight">
                          {row?.courseName || 'Học phần'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                            {row?.classId}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {row?.credits} tín chỉ
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <i className="fas fa-user-tie text-indigo-400 text-xs" />
                          <span>{row?.teacherName || 'Chưa phân công'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center font-medium text-slate-700">
                        {row?.compGrades?.attendance != null ? (
                          <span className="font-semibold text-slate-800">{row.compGrades.attendance}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center font-medium text-slate-700">
                        {row?.compGrades?.homework != null ? (
                          <span className="font-semibold text-slate-800">{row.compGrades.homework}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center font-medium text-slate-700">
                        {row?.compGrades?.midterm != null ? (
                          <span className="font-semibold text-slate-800">{row.compGrades.midterm}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center font-medium text-slate-700">
                        {row?.compGrades?.final != null ? (
                          <span className="font-semibold text-slate-800">{row.compGrades.final}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {row?.gpa != null ? (
                          <span className="inline-block bg-indigo-50 text-indigo-700 font-black px-2.5 py-1 rounded-lg text-xs border border-indigo-200">
                            {row.gpa.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {row?.gpa4 != null ? (
                          <span className="font-bold text-slate-800">
                            {row.gpa4.toFixed(1)}{' '}
                            <span className="text-indigo-600 font-extrabold">({row?.letterGrade})</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {row?.gpa == null ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Đang học
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row?.classification?.tone === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row?.classification?.tone === 'primary'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : row?.classification?.tone === 'warning'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {row?.isPassed ? `Đạt · ${row?.classification?.text || ''}` : 'Học lại'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feedback Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <i className="fas fa-comment-dots text-lg" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-800">Ý kiến đóng góp & Phản hồi Giảng viên</h4>
              <p className="text-xs text-gray-400">
                Gửi góp ý về phương pháp giảng dạy, học liệu và đánh giá chất lượng học phần
              </p>
            </div>
          </div>

          {feedbacks?.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
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
                className="text-indigo-600 hover:underline text-xs font-bold cursor-pointer"
              >
                + Viết phản hồi mới
              </button>
            </div>

            {!Array.isArray(feedbacks) || feedbacks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có góp ý nào</p>
            ) : (
              feedbacks.map((fb) => (
                <div
                  key={fb?._id || fb?.id}
                  className="p-4 bg-gray-50/75 rounded-2xl border border-gray-100 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">
                        {fb?.courseName || fb?.courseId || 'Học phần'}
                      </span>
                      {fb?.regId && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100">
                          Mã lớp: {fb.regId}
                        </span>
                      )}
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500 font-medium">
                        GV: {fb?.teacherName || 'Chưa phân công'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        {fb?.createdAtFormatted ||
                          (fb?.createdAt ? new Date(fb.createdAt).toLocaleDateString('vi-VN') : '')}
                      </span>
                      <div className="flex items-center text-amber-400 text-xs">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <i
                            key={s}
                            className={`fas fa-star ${
                              s <= (Number(fb?.rating) || 0) ? 'text-amber-400' : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 italic leading-relaxed">&quot;{fb?.feedbackText}&quot;</p>

                  {fb?.response ? (
                    <div className="mt-3 p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={
                              fb?.respondedByAvatar ||
                              fb?.teacherAvatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                typeof fb?.respondedByName === 'string'
                                  ? fb.respondedByName
                                  : typeof fb?.teacherName === 'string'
                                  ? fb.teacherName
                                  : 'GV'
                              )}&background=4f46e5&color=fff`
                            }
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-indigo-200 shadow-2xs"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-indigo-900 text-xs">
                              Phản hồi từ{' '}
                              {getTeacherTitle(fb?.respondedByName || fb?.teacherName, fb?.teacherGender)}
                            </span>
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.2 rounded-full">
                              Giảng viên phụ trách
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {fb?.respondedAt || ''}
                        </span>
                      </div>
                      <p className="text-gray-700 pl-9 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-indigo-100/60 font-normal">
                        {fb.response}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic">⏳ Đang chờ Giảng viên xem và phản hồi...</p>
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
                  {!Array.isArray(enrollments) || enrollments.length === 0 ? (
                    <option value="">Chưa đăng ký môn học nào</option>
                  ) : (
                    enrollments.map((enr) => {
                      const c = enr?.class;
                      const classId = c?.id || enr?.classId;
                      const courseName = c?.courseName || c?.courseId || classId;
                      const teacherName = c?.teacher
                        ? ` - GV: ${
                            typeof c.teacher === 'object'
                              ? c.teacher?.hoTen || c.teacher?.name || ''
                              : c.teacher
                          }`
                        : '';
                      return (
                        <option key={enr?._id || classId} value={classId}>
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
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
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
                    className="p-1 text-xl hover:scale-125 transition-transform cursor-pointer"
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
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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

/**
 * Default exported StudentDashboard wrapped in ErrorBoundary for guaranteed runtime crash prevention.
 */
export function StudentDashboard(props) {
  return (
    <ErrorBoundary
      title="Không thể hiển thị Trang Sinh viên"
      message="Đã có sự cố khi xử lý thông tin học tập của sinh viên. Vui lòng thử tải lại trang hoặc kiểm tra kết nối mạng."
    >
      <StudentDashboardInner {...props} />
    </ErrorBoundary>
  );
}

export default StudentDashboard;
