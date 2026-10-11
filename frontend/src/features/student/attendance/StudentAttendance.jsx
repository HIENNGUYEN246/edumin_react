import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import {
  formatStudentCode,
  calculateGpa,
  getGpaClassification,
  DEFAULT_GRADE_WEIGHTS,
} from '../../../lib/format.js';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { attendanceApi } from '../../../api/attendanceApi.js';
import { enrollmentsApi } from '../../../api/enrollmentsApi.js';
import { assignmentsApi } from '../../../api/assignmentsApi.js';
import {
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  calculateStudentAttendanceStats,
} from '../../../utils/attendanceUtils.js';

/**
 * Smooth SVG Circular Progress Ring for attendance rate
 */
function CircularProgressRing({ rate = 100, size = 112, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(100, Math.max(0, Number(rate) || 0));
  const strokeDashoffset = circumference - (clampedRate / 100) * circumference;

  let strokeColor = '#10B981'; // >= 80% (Emerald)
  let ringBadge = { text: 'Chuyên cần tốt', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' };
  if (clampedRate < 50) {
    strokeColor = '#F43F5E'; // < 50% (Rose)
    ringBadge = { text: 'Nguy cơ cấm thi', bg: 'bg-rose-500/20 text-rose-300 border-rose-400/30' };
  } else if (clampedRate < 80) {
    strokeColor = '#F59E0B'; // 50 - 79% (Amber)
    ringBadge = { text: 'Cần cải thiện', bg: 'bg-amber-500/20 text-amber-300 border-amber-400/30' };
  }

  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className="text-xl font-black text-white leading-none tracking-tight">
            {clampedRate}%
          </span>
          <span className="text-[10px] uppercase font-bold text-indigo-200 mt-0.5 tracking-wider">
            Tiến độ
          </span>
        </div>
      </div>
      <span className={`mt-2 inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${ringBadge.bg}`}>
        {ringBadge.text}
      </span>
    </div>
  );
}

export function StudentAttendance() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filterCourse, setFilterCourse] = useState('all');
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'grades'

  const studentId = profile?.id ?? user?.studentId ?? user?.id;

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const [attRes, enrRes, assignRes] = await Promise.all([
        attendanceApi.getByStudent(studentId),
        enrollmentsApi.mine().catch(() => ({ data: [] })),
        assignmentsApi.list().catch(() => ({ data: [] })),
      ]);
      setAttendances(Array.isArray(attRes) ? attRes : attRes?.data || []);
      setEnrollments(enrRes?.data || []);
      setAssignments(Array.isArray(assignRes) ? assignRes : assignRes?.data || []);
    } catch {
      toast.error('Không thể tải dữ liệu điểm danh và học phần');
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Strict student filtering to prevent cross-student record contamination
  const myAttendances = useMemo(() => {
    if (!studentId) return [];
    return attendances.filter((a) => {
      const aId = a.studentId != null ? String(a.studentId) : null;
      const aRef = a.studentRef
        ? typeof a.studentRef === 'object'
          ? String(a.studentRef._id || a.studentRef.id)
          : String(a.studentRef)
        : null;
      const aEmail = a.studentEmail || (typeof a.studentRef === 'object' ? a.studentRef?.email : null);
      const targetId = String(studentId);
      const targetProfileId = profile?.id != null ? String(profile.id) : null;
      const targetUserId = user?.id != null ? String(user.id) : null;
      const targetEmail = (profile?.email || user?.email || '').toLowerCase();

      // If record contains no identifiable student fields, keep it since getByStudent returned it
      if (!aId && !aRef && !aEmail) return true;

      return (
        (aId && (aId === targetId || aId === targetProfileId)) ||
        (aRef && (aRef === targetId || aRef === targetUserId)) ||
        (targetEmail && aEmail && aEmail.toLowerCase() === targetEmail)
      );
    });
  }, [attendances, studentId, profile, user]);

  // Distinct courses/classes for the filter dropdown
  const courseOptions = useMemo(() => {
    const map = new Map();
    for (const e of enrollments) {
      const classObj = e.class || {};
      const key = classObj.courseId || classObj.id || e.classId;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          classId: classObj.id || e.classId,
          courseId: classObj.courseId || key,
          courseName: classObj.courseName || classObj.name || key,
          credits: classObj.credits,
        });
      }
    }
    for (const a of myAttendances) {
      const key = a.courseId || a.regId || a.courseName;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          classId: a.regId || key,
          courseId: a.courseId || key,
          courseName: a.courseName || a.courseId || key,
        });
      }
    }
    return Array.from(map.values());
  }, [enrollments, myAttendances]);

  // Attendance records filtered by selected course
  const filteredList = useMemo(() => {
    if (filterCourse === 'all') return myAttendances;
    return myAttendances.filter((a) => {
      return (
        a.courseId === filterCourse ||
        a.regId === filterCourse ||
        a.courseName === filterCourse ||
        a.classId === filterCourse ||
        (a.class && (a.class.id === filterCourse || a.class.courseId === filterCourse))
      );
    });
  }, [myAttendances, filterCourse]);

  // Attendance statistics recalculated dynamically for the active filter
  const stats = useMemo(() => {
    return calculateStudentAttendanceStats(filteredList);
  }, [filteredList]);

  // Personal Gradebook: calculate component scores, GPA, and classifications for enrolled classes
  const personalGradebook = useMemo(() => {
    return enrollments.map((e) => {
      const cls = e.class || {};
      const weights = cls.gradeWeights || DEFAULT_GRADE_WEIGHTS;
      const classId = cls.id || e.classId;
      const courseId = cls.courseId;

      // 1. Attendance component score
      const classAttRecords = myAttendances.filter((a) => {
        return (
          a.regId === classId ||
          a.classId === classId ||
          a.courseId === courseId ||
          (a.courseName && cls.courseName && a.courseName.toLowerCase() === cls.courseName.toLowerCase())
        );
      });
      const classAttStats = calculateStudentAttendanceStats(classAttRecords);
      const autoAttScore = classAttStats.total > 0
        ? Number((((classAttStats.present + 0.5 * classAttStats.late) / classAttStats.total) * 10).toFixed(1))
        : (classAttRecords.length > 0 ? 10 : null);
      const attScore = e.manualGrades?.attendance ?? autoAttScore;

      // 2. Homework / Quiz scores
      const courseAssignments = (assignments || []).filter((a) => {
        return a.courseId === courseId || a.className === classId;
      });
      const quizSubmissions = courseAssignments
        .filter((a) => a.mySubmission?.score != null)
        .map((a) => Number(a.mySubmission.score));
      const autoHwScore = quizSubmissions.length > 0
        ? Number((quizSubmissions.reduce((a, b) => a + b, 0) / quizSubmissions.length).toFixed(1))
        : null;
      const hwScore = e.manualGrades?.assignment ?? (e.manualGrades?.homework ?? autoHwScore);

      // 3. Midterm score
      const midtermAssignment = cls.midtermQuizId
        ? courseAssignments.find((a) => String(a._id) === String(cls.midtermQuizId?._id || cls.midtermQuizId))
        : null;
      const autoMidtermScore = midtermAssignment?.mySubmission?.score != null
        ? Number(midtermAssignment.mySubmission.score)
        : null;
      const midtermScore = e.manualGrades?.midterm ?? autoMidtermScore;

      // 4. Final score
      const finalAssignment = cls.finalQuizId
        ? courseAssignments.find((a) => String(a._id) === String(cls.finalQuizId?._id || cls.finalQuizId))
        : null;
      const autoFinalScore = finalAssignment?.mySubmission?.score != null
        ? Number(finalAssignment.mySubmission.score)
        : null;
      const finalScore = e.manualGrades?.final ?? autoFinalScore;

      const presentationScore = e.manualGrades?.presentation ?? null;

      const compGrades = {
        attendance: attScore,
        homework: hwScore,
        midterm: midtermScore,
        presentation: presentationScore,
        final: finalScore,
      };

      const gpa = e.finalScore != null ? Number(e.finalScore) : calculateGpa(compGrades, weights);
      const classification = getGpaClassification(gpa);

      let gpa4 = null;
      let letterGrade = '—';
      if (gpa != null) {
        if (gpa >= 8.5) { gpa4 = 4.0; letterGrade = 'A'; }
        else if (gpa >= 7.0) { gpa4 = 3.0; letterGrade = 'B'; }
        else if (gpa >= 5.5) { gpa4 = 2.0; letterGrade = 'C'; }
        else if (gpa >= 4.0) { gpa4 = 1.0; letterGrade = 'D'; }
        else { gpa4 = 0.0; letterGrade = 'F'; }
      }

      return {
        enrollmentId: e._id,
        classId,
        courseId,
        courseName: cls.courseName || cls.name || courseId,
        credits: Number(cls.credits) || 3,
        teacher: typeof cls.teacher === 'object' ? cls.teacher?.hoTen || cls.teacher?.name : cls.teacher || 'Chưa phân công',
        weights,
        compGrades,
        gpa,
        gpa4,
        letterGrade,
        classification,
        attendanceStats: classAttStats,
      };
    });
  }, [enrollments, myAttendances, assignments]);

  // Overall Cumulative GPA stats
  const overallGpaStats = useMemo(() => {
    const completedCourses = personalGradebook.filter((g) => g.gpa != null);
    const totalCredits = personalGradebook.reduce((sum, c) => sum + c.credits, 0);
    const completedCredits = completedCourses.reduce((sum, c) => sum + (c.gpa >= 4.0 ? c.credits : 0), 0);

    if (completedCourses.length === 0) {
      return {
        gpa10: null,
        gpa4: null,
        totalCredits,
        completedCredits: 0,
        classification: { text: 'Chưa có điểm', tone: 'neutral' },
      };
    }

    const totalWeighted10 = completedCourses.reduce((sum, c) => sum + c.gpa * c.credits, 0);
    const totalCompletedCredits = completedCourses.reduce((sum, c) => sum + c.credits, 0);
    const gpa10 = totalCompletedCredits > 0 ? Number((totalWeighted10 / totalCompletedCredits).toFixed(2)) : null;

    const totalWeighted4 = completedCourses.reduce((sum, c) => sum + (c.gpa4 ?? 0) * c.credits, 0);
    const gpa4 = totalCompletedCredits > 0 ? Number((totalWeighted4 / totalCompletedCredits).toFixed(2)) : null;

    return {
      gpa10,
      gpa4,
      totalCredits,
      completedCredits,
      classification: getGpaClassification(gpa10),
    };
  }, [personalGradebook]);

  // Filtered personal gradebook rows
  const filteredPersonalGradebook = useMemo(() => {
    if (filterCourse === 'all') return personalGradebook;
    return personalGradebook.filter(
      (g) => g.courseId === filterCourse || g.classId === filterCourse || g.courseName === filterCourse
    );
  }, [personalGradebook, filterCourse]);

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Lịch sử Điểm danh & Bảng điểm Cá nhân"
        description="Theo dõi trực quan tỷ lệ chuyên cần, ngày giờ học và bảng điểm thành phần chính thức của Giảng viên"
      />

      {/* Hero Overview Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Student Profile Info */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Avatar
              src={profile?.avatar?.url || profile?.avatar || user?.avatar}
              name={profile?.hoTen || user?.hoTen}
              size={68}
              className="border-2 border-white/20 shrink-0 shadow-lg ring-4 ring-white/10"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                  {profile?.id != null ? formatStudentCode(profile.id) : 'Sinh viên'}
                </span>
                <span className="text-xs text-indigo-200">
                  {profile?.className || 'Lớp sinh hoạt'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {profile?.hoTen || user?.hoTen || 'Sinh viên'}
              </h3>
              <p className="text-xs text-indigo-200 max-w-md">
                {stats.absent >= 3 ? (
                  <span className="text-rose-300 font-bold flex items-center gap-1">
                    <i className="fas fa-triangle-exclamation text-rose-400" />
                    Cảnh báo: Bạn đã vắng {stats.absent} buổi! Chú ý không vượt quá 20% số tiết quy định.
                  </span>
                ) : (
                  'Tình trạng chuyên cần của bạn rất tốt, hãy tiếp tục duy trì nhé!'
                )}
              </p>
            </div>
          </div>

          {/* Center: Circular Progress Ring */}
          <div className="flex items-center justify-center py-2 px-4 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CircularProgressRing rate={stats.rate} />
          </div>

          {/* Attendance Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto text-center">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-indigo-200">Tổng buổi</p>
              <p className="text-xl font-black mt-0.5">{stats.total}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-emerald-300">Có mặt</p>
              <p className="text-xl font-black text-emerald-300 mt-0.5">{stats.present}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-amber-300">Đi muộn</p>
              <p className="text-xl font-black text-amber-300 mt-0.5">{stats.late}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-rose-300">Vắng mặt</p>
              <p className="text-xl font-black text-rose-300 mt-0.5">{stats.absent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher & Course Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-calendar-check" />
            <span>Lịch sử Điểm danh ({filteredList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grades')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'grades'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-graduation-cap text-indigo-600" />
            <span>Bảng điểm Cá nhân ({enrollments.length} môn)</span>
          </button>
        </div>

        {/* Course Filter Dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="student-course-filter" className="text-xs font-bold text-gray-500 whitespace-nowrap uppercase tracking-wider">
            Lọc theo môn:
          </label>
          <select
            id="student-course-filter"
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white shadow-2xs max-w-[280px] truncate"
          >
            <option value="all">Tất cả các môn học</option>
            {courseOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.classId ? `${opt.classId} · ` : ''}{opt.courseName || opt.courseId}
              </option>
            ))}
          </select>
          {filterCourse !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterCourse('all')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
            >
              Xem tất cả
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Attendance History Table */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Spinner />
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <i className="far fa-calendar-check text-4xl mb-3 block text-gray-300" />
              <p className="font-semibold text-gray-600 text-sm">Chưa có lượt điểm danh nào</p>
              <p className="text-xs text-gray-400 mt-1">Thông tin điểm danh từng buổi học sẽ xuất hiện tại đây.</p>
              {filterCourse !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterCourse('all')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <i className="fas fa-rotate-left" />
                  <span>Xem tất cả các môn</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[760px] text-left text-sm text-gray-700">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-5 py-3.5">Học phần & Lớp</th>
                    <th className="px-5 py-3.5">Ngày học</th>
                    <th className="px-5 py-3.5">Ca học</th>
                    <th className="px-5 py-3.5 text-center">Trạng thái</th>
                    <th className="px-5 py-3.5 text-center">Điểm số</th>
                    <th className="px-5 py-3.5">Nhận xét của Giảng viên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredList.map((row) => (
                    <tr key={row._id || row.id} className="hover:bg-indigo-50/20 transition">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-gray-900 leading-tight">{row.courseName || row.courseId}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {row.courseId && (
                            <span className="font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                              {row.courseId}
                            </span>
                          )}
                          {row.regId && (
                            <span className="text-[11px] text-gray-500 font-mono">
                              Lớp: {row.regId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800 whitespace-nowrap">
                        {formatAttendanceDate(row.date)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {row.shiftLabel || getShiftLabel(row.shiftId)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(row.status)}`}>
                          <i className={`fas ${getStatusIcon(row.status)}`} />
                          {row.status}
                        </span>
                        {row.checkInTime && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Giờ vào: {row.checkInTime}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {row.score != null ? (
                          <span className="inline-block bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-lg text-xs border border-emerald-200">
                            {row.score}đ
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.evaluation ? (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-800 italic leading-relaxed">
                              &quot;{row.evaluation}&quot;
                            </p>
                            {row.teacherName && (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                                <Avatar
                                  src={row.teacherAvatar || row.teacherRef?.avatar?.url || row.teacherRef?.avatar}
                                  name={row.teacherName}
                                  size={18}
                                />
                                <span>GV: {row.teacherName}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs italic">Không có nhận xét</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Personal Gradebook (Xem điểm cá nhân - Read-only) */}
      {activeTab === 'grades' && (
        <div className="space-y-4">
          {/* Grade summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                <i className="fas fa-star" />
              </div>
              <div>
                <div className="text-2xl font-black text-indigo-600">
                  {overallGpaStats.gpa10 != null ? overallGpaStats.gpa10.toFixed(2) : '—'}
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase">GPA (Thang 10)</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                <i className="fas fa-award" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-600">
                  {overallGpaStats.gpa4 != null ? overallGpaStats.gpa4.toFixed(2) : '—'}
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase">GPA (Thang 4)</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                <i className="fas fa-medal" />
              </div>
              <div>
                <div className="text-lg font-black text-slate-800">
                  {overallGpaStats.classification.text}
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase">Xếp loại học lực</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center text-lg">
                <i className="fas fa-book-bookmark" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800">
                  {overallGpaStats.completedCredits}/{overallGpaStats.totalCredits} TC
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase">Tín chỉ tích lũy</div>
              </div>
            </div>
          </div>

          {/* Read-only Gradebook Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <i className="fas fa-lock text-indigo-500" />
                <span>Chế độ xem cá nhân (Read-only) · Dữ liệu được Giảng viên và Phòng Đào Tạo cập nhật</span>
              </div>
              <span className="text-xs text-slate-400">
                Hiển thị {filteredPersonalGradebook.length}/{personalGradebook.length} môn học
              </span>
            </div>

            {loading ? (
              <div className="p-16 flex justify-center">
                <Spinner />
              </div>
            ) : filteredPersonalGradebook.length === 0 ? (
              <div className="p-16 text-center text-gray-400">
                <i className="fas fa-folder-open text-4xl mb-3 block text-gray-300" />
                <p className="font-semibold text-gray-600 text-sm">Chưa có kết quả học tập</p>
                <p className="text-xs text-gray-400 mt-1">Bạn chưa đăng ký môn học nào hoặc chưa có dữ liệu điểm.</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[880px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50/90 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-4 py-3.5">Mã HP & Môn học</th>
                      <th className="px-3 py-3.5">Lớp HP</th>
                      <th className="px-2 py-3.5 text-center">Tín chỉ</th>
                      <th className="px-3 py-3.5 text-center">Chuyên cần</th>
                      <th className="px-3 py-3.5 text-center">Bài tập / Quiz</th>
                      <th className="px-3 py-3.5 text-center">Giữa kỳ</th>
                      <th className="px-3 py-3.5 text-center">Cuối kỳ</th>
                      <th className="px-3 py-3.5 text-center bg-indigo-50/40 text-indigo-900 font-extrabold">GPA (10)</th>
                      <th className="px-3 py-3.5 text-center bg-indigo-50/40 text-indigo-900 font-extrabold">Hệ 4 (Chữ)</th>
                      <th className="px-3 py-3.5 text-center">Xếp loại</th>
                      <th className="px-3 py-3.5 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPersonalGradebook.map((row) => {
                      const cg = row.compGrades;
                      const hasGpa = row.gpa != null;
                      const isPassed = hasGpa && row.gpa >= 4.0;

                      return (
                        <tr key={row.enrollmentId || row.classId} className="hover:bg-indigo-50/20 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-gray-900">{row.courseName}</div>
                            <div className="text-[11px] font-mono text-indigo-600">{row.courseId}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">GV: {row.teacher}</div>
                          </td>
                          <td className="px-3 py-3.5 font-mono text-gray-600 whitespace-nowrap">
                            {row.classId}
                          </td>
                          <td className="px-2 py-3.5 text-center font-bold text-gray-700">
                            {row.credits}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {cg.attendance != null ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                {cg.attendance}
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {cg.homework != null ? (
                              <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {cg.homework}
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {cg.midterm != null ? (
                              <span className="text-slate-800">{cg.midterm}</span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {cg.final != null ? (
                              <span className="text-slate-800">{cg.final}</span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center font-black bg-indigo-50/20 whitespace-nowrap">
                            {hasGpa ? (
                              <span className="text-indigo-700 text-sm font-extrabold">{row.gpa.toFixed(2)}</span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center bg-indigo-50/20 whitespace-nowrap font-bold">
                            {hasGpa ? (
                              <span className="text-slate-800">
                                {row.gpa4?.toFixed(1)} ({row.letterGrade})
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {hasGpa ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  row.classification.tone === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : row.classification.tone === 'primary'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : row.classification.tone === 'warning'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {row.classification.text}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {hasGpa ? (
                              isPassed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <i className="fas fa-check text-[9px]" />
                                  Đạt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  <i className="fas fa-xmark text-[9px]" />
                                  Học lại
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Đang học
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
        </div>
      )}
    </div>
  );
}

export default StudentAttendance;
