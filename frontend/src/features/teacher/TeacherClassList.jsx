import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { useMyTeacherClasses } from './useTeacherClasses.js';
import {
  ScheduleTimeCombinedBadge,
  RoomBadge,
} from '../../components/schedule/ScheduleBadge.jsx';
import { setAiPageContext } from '../../components/ai/EduMinAiAssistant.jsx';
import { ScheduleChangeNotificationModal } from '../../components/notifications/ScheduleChangeNotificationModal.jsx';

/**
 * Helper to compute theoretical and practical period allocation for a course.
 * Separates Theory (LT) and Practice (TH) cleanly.
 */
export function getCoursePeriodsBreakdown(course) {
  const credits = Number(course?.credits) || 3;
  const total = Number(course?.totalPeriods) || (credits * 15);

  // 1. If explicit theory/practice periods exist on course record:
  if (
    course?.theoryPeriods != null &&
    course?.practicePeriods != null &&
    (course.theoryPeriods > 0 || course.practicePeriods > 0)
  ) {
    const lt = Number(course.theoryPeriods) || 0;
    const th = Number(course.practicePeriods) || 0;
    const calcTotal = lt + th || total;
    return {
      total: calcTotal,
      theory: lt,
      practice: th,
      typeLabel: th === 0 ? 'Lý thuyết (LT)' : lt === 0 ? 'Thực hành (TH)' : 'Lý thuyết & Thực hành',
      badgeColor:
        th === 0
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : lt === 0
          ? 'text-blue-700 bg-blue-50 border-blue-200'
          : 'text-indigo-700 bg-indigo-50 border-indigo-200',
    };
  }

  const name = String(course?.courseName || course?.name || '').toLowerCase();
  const id = String(course?.courseId || course?.id || '').toLowerCase();
  const courseType = course?.courseType;

  // 2. Purely Practice course
  if (
    courseType === 'TH' ||
    name.includes('thực hành') ||
    name.includes('lab') ||
    name.includes('đồ án') ||
    name.includes('chuyên đề tốt nghiệp') ||
    id.includes('-th') ||
    id.endsWith('th')
  ) {
    return {
      total,
      theory: 0,
      practice: total,
      typeLabel: 'Thực hành (TH)',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    };
  }

  // 3. Purely Theory course
  if (
    courseType === 'LT' ||
    name.includes('lý thuyết') ||
    name.includes('triết học') ||
    name.includes('tư tưởng') ||
    name.includes('pháp luật') ||
    name.includes('lịch sử đảng')
  ) {
    return {
      total,
      theory: total,
      practice: 0,
      typeLabel: 'Lý thuyết (LT)',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  }

  // 4. Default: Combined Theory & Practice (Standard University Ratio: 2/3 LT, 1/3 TH)
  const theory = Math.round(credits * 10);
  const practice = Math.max(0, total - theory);
  return {
    total,
    theory,
    practice,
    typeLabel: 'Lý thuyết & Thực hành',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  };
}

export function TeacherClassList() {
  const { data, isLoading } = useMyTeacherClasses();
  const classes = data?.data || [];
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [courseDetailModal, setCourseDetailModal] = useState(null);
  const [search, setSearch] = useState('');

  // Sync real-time classes context with EduMin AI Assistant
  useEffect(() => {
    if (classes.length > 0) {
      setAiPageContext({
        page: 'teacher_classes',
        myClasses: classes,
      });
    }
  }, [classes]);

  // Filtered classes by search term
  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.trim().toLowerCase();
    return classes.filter(
      (c) =>
        c.id?.toLowerCase().includes(q) ||
        c.className?.toLowerCase().includes(q) ||
        c.courseName?.toLowerCase().includes(q) ||
        c.courseId?.toLowerCase().includes(q) ||
        c.room?.toLowerCase().includes(q)
    );
  }, [classes, search]);

  const activePeriodsBreakdown = useMemo(() => {
    if (!courseDetailModal) return null;
    return getCoursePeriodsBreakdown(courseDetailModal);
  }, [courseDetailModal]);

  const modalGradeWeights = useMemo(() => {
    const weights = courseDetailModal?.gradeWeights || courseDetailModal?.courseRef?.gradeWeights || {};
    return {
      attendance: weights.attendance ?? 10,
      homework: weights.homework ?? weights.assignments ?? 10,
      midterm: weights.midterm ?? 30,
      final: weights.final ?? 50,
    };
  }, [courseDetailModal]);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Top Header & Toolbar with prominent Call-to-Action */}
      <PageHeader
        title="Lớp học phần"
        subtitle="Danh sách các lớp học phần bạn đang phụ trách giảng dạy"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Call-to-Action: Điều phối & Báo đổi lịch học */}
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold text-xs shadow-sm hover:shadow-md transition active:scale-[0.98] cursor-pointer"
              title="Mở bảng điều phối và phát thông báo đổi phòng / đổi lịch cho sinh viên"
            >
              <i className="fas fa-calendar-days text-sm text-amber-300" />
              <span>Điều phối & Báo đổi lịch</span>
            </button>
          </div>
        }
      />

      {/* Toolbar / Search Filter & Summary Stats */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
            <i className="fas fa-graduation-cap" />
          </span>
          <span className="text-sm font-bold text-slate-800">
            Tổng cộng: <strong className="text-indigo-600">{classes.length}</strong> lớp học phần phụ trách
          </span>
        </div>

        <div className="relative w-full sm:w-80">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã lớp, tên môn học, phòng..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-slate-800"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-16 flex flex-col items-center justify-center gap-3">
          <Spinner />
          <span className="text-xs font-semibold text-slate-500 animate-pulse">
            Đang tải danh sách lớp học phần...
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredClasses.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-16 text-center text-slate-400 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
            <i className="far fa-folder-open text-2xl" />
          </div>
          <p className="text-sm font-bold text-slate-600">
            {search ? 'Không tìm thấy lớp học phần phù hợp với tìm kiếm.' : 'Bạn chưa được phân công lớp học phần nào.'}
          </p>
        </div>
      )}

      {/* Synchronized Card Layout: Each class in a dedicated, spacious rounded-2xl Card */}
      {!isLoading && filteredClasses.length > 0 && (
        <div className="space-y-4">
          {filteredClasses.map((c) => {
            const classTargetId = c.id || c._id;
            const breakdown = getCoursePeriodsBreakdown(c);

            return (
              <section
                key={c._id || c.id}
                className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all duration-200 overflow-hidden"
              >
                {/* 1. Card Top Bar: Badges, Course & Class codes, and Detail trigger button */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border-b border-indigo-100/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-2xs tracking-wide">
                      {c.id}
                    </span>
                    <span className="text-xs font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-100 shadow-2xs font-mono">
                      {c.courseId}
                    </span>
                    {c.className && (
                      <span className="text-xs font-semibold text-slate-700 bg-white/95 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        {c.className}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-indigo-700 bg-white/95 px-2.5 py-1 rounded-lg border border-indigo-100 shadow-2xs">
                      {c.credits || c.courseRef?.credits || 3} Tín chỉ
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border shadow-2xs ${breakdown.badgeColor}`}>
                      {breakdown.typeLabel}
                    </span>
                  </div>

                  {/* Dedicated Course Detail Modal Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setCourseDetailModal(c)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50/80 px-3 py-1.5 rounded-xl border border-indigo-200/80 transition cursor-pointer shadow-2xs active:scale-95"
                    title="Xem chi tiết đề cương, số tiết Lý thuyết, Thực hành và cấu trúc đánh giá"
                  >
                    <i className="fas fa-circle-info text-indigo-500 text-xs" />
                    <span>Chi tiết học phần</span>
                  </button>
                </div>

                {/* 2. Card Main Body */}
                <div className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                  {/* Khu vực Thông tin môn học & Giảng viên */}
                  <div className="space-y-2 flex-1 min-w-[260px]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shrink-0 mt-0.5 border border-indigo-100 shadow-2xs">
                        <i className="fas fa-chalkboard-user" />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setCourseDetailModal(c)}
                          className="text-base font-black text-slate-900 hover:text-indigo-600 transition text-left cursor-pointer flex items-center gap-1.5"
                          title="Bấm để xem chi tiết học phần"
                        >
                          <span>{c.courseName}</span>
                          <i className="fas fa-arrow-up-right-from-square text-[10px] text-slate-400" />
                        </button>

                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-600">
                          {/* Giảng viên */}
                          <div className="flex items-center gap-1.5">
                            <Avatar src={c.teacherRef?.avatar?.url || c.teacherRef?.avatar} name={c.teacher || 'GV'} size={22} />
                            <span className="font-semibold text-slate-800">
                              {c.teacher ? `GV: ${c.teacher}` : 'Chưa phân công'}
                            </span>
                          </div>

                          {/* Khoa */}
                          {(c.department || c.courseRef?.department) && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">
                                Khoa: <strong className="text-slate-700">{c.department || c.courseRef?.department}</strong>
                              </span>
                            </>
                          )}

                          {/* Sĩ số */}
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                            <i className="fas fa-users text-slate-400 text-[11px]" />
                            <span>
                              Sĩ số: <strong className="text-slate-800">{c.enrolledCount || 0}{c.capacity ? `/${c.capacity}` : ''}</strong>
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Khu vực Thời gian học & Phòng học */}
                  <div className="flex flex-wrap items-center gap-5 shrink-0 pt-2 xl:pt-0">
                    {/* Thời gian học */}
                    <div className="min-w-[210px]">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <i className="far fa-clock text-amber-500" />
                        <span>Thời gian học:</span>
                      </div>
                      <ScheduleTimeCombinedBadge schedules={c.schedules} />
                    </div>

                    {/* Phòng học */}
                    <div className="min-w-[140px]">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <i className="fas fa-location-dot text-rose-500" />
                        <span>Phòng học:</span>
                      </div>
                      <RoomBadge room={c.room} studyStart={c.studyStart} studyEnd={c.studyEnd} />
                    </div>
                  </div>

                  {/* Khu vực Cụm nút thao tác cơ bản (Điểm danh, Điểm số, Xem danh sách sinh viên) */}
                  <div className="flex items-center gap-2 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100 shrink-0">
                    <Link
                      to={`/teacher/attendance?classId=${encodeURIComponent(classTargetId)}`}
                      state={{ classId: classTargetId, id: classTargetId, classRef: c._id }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs hover:shadow transition active:scale-[0.98] whitespace-nowrap"
                      aria-label={`Điểm danh lớp ${c.id || c._id}`}
                      title="Điểm danh và theo dõi chuyên cần lớp học phần"
                    >
                      <i className="fa-solid fa-clipboard-user text-[11px]" />
                      <span>Điểm danh</span>
                    </Link>
                    <Link
                      to={`/teacher/classes/${c._id || c.id}/grades`}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs hover:shadow transition active:scale-[0.98] whitespace-nowrap"
                      aria-label={`Danh sách điểm số lớp ${c.id}`}
                      title="Xem và quản lý sổ điểm lớp học phần"
                    >
                      <i className="fas fa-table-list text-[11px]" />
                      <span>Điểm số</span>
                    </Link>
                    <Link
                      to={`/teacher/classes/${c._id || c.id}/students`}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs hover:shadow transition active:scale-[0.98] whitespace-nowrap"
                      aria-label={`Danh sách sinh viên lớp ${c.id}`}
                      title="Danh sách sinh viên lớp học phần"
                    >
                      <i className="fas fa-users text-[11px]" />
                      <span>Sinh viên</span>
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal 1: Thông tin chi tiết học phần (Đồng bộ với popup sinh viên & tách bạch LT/TH) */}
      {courseDetailModal && activePeriodsBreakdown && (
        <Modal
          open={Boolean(courseDetailModal)}
          onClose={() => setCourseDetailModal(null)}
          title={`Thông tin chi tiết học phần: ${courseDetailModal.courseName || courseDetailModal.name}`}
          size="lg"
        >
          <div className="p-6 space-y-5">
            {/* Course Hero Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-purple-50/40 border border-indigo-100">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                    {courseDetailModal.courseId || courseDetailModal.id}
                  </span>
                  <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-2xs">
                    {courseDetailModal.credits || courseDetailModal.courseRef?.credits || 3} Tín chỉ
                  </span>
                  {(courseDetailModal.department || courseDetailModal.courseRef?.department) && (
                    <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      Khoa: {courseDetailModal.department || courseDetailModal.courseRef?.department}
                    </span>
                  )}
                </div>
                <h4 className="text-xl font-black text-slate-900 mt-1">
                  {courseDetailModal.courseName || courseDetailModal.name}
                </h4>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-medium block">Phân loại học phần</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl border shadow-2xs mt-0.5 ${activePeriodsBreakdown.badgeColor}`}>
                  <i className="fas fa-book-bookmark text-[11px]" />
                  <span>{activePeriodsBreakdown.typeLabel}</span>
                </span>
              </div>
            </div>

            {/* Grid of Key Info: Credits & Periods Allocation (Tách bạch rõ LT và TH) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Tổng thời lượng */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                  <i className="fas fa-clock text-indigo-500" />
                  <span>Tổng thời lượng</span>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {activePeriodsBreakdown.total} tiết
                </div>
                <p className="text-[11px] text-slate-400 mt-1">15 tiết chuẩn / tín chỉ</p>
              </div>

              {/* Card 2: Lý thuyết (LT) */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/70 shadow-2xs">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold mb-1">
                  <i className="fas fa-chalkboard-user text-emerald-600" />
                  <span>Lý thuyết (LT)</span>
                </div>
                <div className="text-2xl font-black text-emerald-800">
                  {activePeriodsBreakdown.theory} tiết
                </div>
                <p className="text-[11px] text-emerald-600/80 mt-1">Giảng đường & tương tác kiến thức</p>
              </div>

              {/* Card 3: Thực hành (TH) */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/70 shadow-2xs">
                <div className="flex items-center gap-2 text-blue-700 text-xs font-bold mb-1">
                  <i className="fas fa-laptop-code text-blue-600" />
                  <span>Thực hành (TH)</span>
                </div>
                <div className="text-2xl font-black text-blue-800">
                  {activePeriodsBreakdown.practice} tiết
                </div>
                <p className="text-[11px] text-blue-600/80 mt-1">Thực hành phòng máy & bài tập Lab</p>
              </div>
            </div>

            {/* Prerequisites & Description */}
            <div className="space-y-3 text-xs">
              {/* Điều kiện tiên quyết */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-1 text-xs">
                  <i className="fas fa-link text-indigo-500" />
                  <span>Điều kiện tiên quyết:</span>
                </h5>
                <p className="text-slate-600 leading-relaxed font-medium">
                  {courseDetailModal.prerequisites ||
                    courseDetailModal.courseRef?.prerequisites ||
                    'Không yêu cầu học phần tiên quyết (Sinh viên được phép đăng ký trực tiếp).'}
                </p>
              </div>

              {/* Mô tả tóm tắt */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-1 text-xs">
                  <i className="fas fa-align-left text-indigo-500" />
                  <span>Mô tả tóm tắt học phần:</span>
                </h5>
                <p className="text-slate-600 leading-relaxed">
                  {courseDetailModal.description ||
                    courseDetailModal.courseRef?.description ||
                    `Học phần ${courseDetailModal.courseName || courseDetailModal.name} (${courseDetailModal.courseId || courseDetailModal.id}) trang bị cho sinh viên hệ thống kiến thức toàn diện, nền tảng lý thuyết vững chắc cùng các kỹ năng thực tế cần thiết đáp ứng chuẩn đầu ra của chương trình đào tạo.`}
                </p>
              </div>

              {/* Cấu trúc đánh giá kết quả học phần */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 shadow-2xs">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2 text-xs">
                  <i className="fas fa-chart-pie text-indigo-500" />
                  <span>Cơ cấu đánh giá kết quả học phần:</span>
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                    <span className="text-[11px] text-slate-500 block">Chuyên cần</span>
                    <strong className="text-sm text-slate-900">{modalGradeWeights.attendance}%</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                    <span className="text-[11px] text-slate-500 block">Bài tập / Quiz</span>
                    <strong className="text-sm text-slate-900">{modalGradeWeights.homework}%</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                    <span className="text-[11px] text-slate-500 block">Giữa kỳ</span>
                    <strong className="text-sm text-slate-900">{modalGradeWeights.midterm}%</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                    <span className="text-[11px] text-slate-500 block">Thi cuối kỳ</span>
                    <strong className="text-sm text-slate-900">{modalGradeWeights.final}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Lớp học phần đang phụ trách: <strong className="text-indigo-600 font-mono">{courseDetailModal.id}</strong>
              </span>
              <button
                type="button"
                onClick={() => setCourseDetailModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Điều phối & Thông báo Đổi lịch học (Đã di dời hoàn toàn lên Toolbar) */}
      {isScheduleModalOpen && (
        <ScheduleChangeNotificationModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          defaultClassId=""
          userRole="giao-vien"
        />
      )}
    </div>
  );
}

export default TeacherClassList;
