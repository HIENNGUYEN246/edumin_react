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
  MATRIX_STATUS_MAP,
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
  const [filterClass, setFilterClass] = useState('all');
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'grades'
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

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

  const isMongoId = (str) => /^[0-9a-fA-F]{24}$/.test(String(str || ''));

  // Pre-index classes from enrollments & attendances for instant resolution
  const classMap = useMemo(() => {
    const map = new Map();
    for (const e of enrollments) {
      const cls = e.class || {};
      if (cls._id) map.set(String(cls._id), cls);
      if (cls.id) map.set(String(cls.id), cls);
      if (e.classId) map.set(String(e.classId), cls);
    }
    for (const a of attendances) {
      if (a.classRef && typeof a.classRef === 'object') {
        const cls = a.classRef;
        if (cls._id) map.set(String(cls._id), cls);
        if (cls.id) map.set(String(cls.id), cls);
      }
    }
    return map;
  }, [enrollments, attendances]);

  // Distinct course classes for the dropdown filter
  const classOptions = useMemo(() => {
    const map = new Map();
    for (const e of enrollments) {
      const cls = e.class || {};
      const classCode = cls.id || (!isMongoId(e.classId) ? e.classId : '');
      const key = classCode || cls.courseId || e.classId;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          classId: classCode,
          courseId: cls.courseId || '',
          courseName: cls.courseName || cls.name || '',
          className: cls.className || '',
          credits: cls.credits,
        });
      }
    }
    for (const a of myAttendances) {
      const cls =
        (a.classRef && typeof a.classRef === 'object' ? a.classRef : null) ||
        classMap.get(String(a.classId)) ||
        classMap.get(String(a.regId));
      const classCode = cls?.id || (!isMongoId(a.classId) ? a.classId : '') || (!isMongoId(a.regId) ? a.regId : '');
      const key = classCode || a.courseId || a.regId;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          classId: classCode,
          courseId: a.courseId || cls?.courseId || '',
          courseName: a.courseName || cls?.courseName || a.courseId || '',
          className: cls?.className || '',
        });
      }
    }
    return Array.from(map.values());
  }, [enrollments, myAttendances, classMap]);

  // Attendance records filtered by selected class or course
  const filteredList = useMemo(() => {
    if (filterClass === 'all') return myAttendances;
    return myAttendances.filter((a) => {
      const cls =
        (a.classRef && typeof a.classRef === 'object' ? a.classRef : null) ||
        classMap.get(String(a.classId)) ||
        classMap.get(String(a.regId));
      const code = cls?.id || (!isMongoId(a.classId) ? a.classId : '') || (!isMongoId(a.regId) ? a.regId : '');
      const cId = a.courseId || cls?.courseId;
      const cName = a.courseName || cls?.courseName;
      return (
        code === filterClass ||
        a.regId === filterClass ||
        a.classId === filterClass ||
        cId === filterClass ||
        cName === filterClass ||
        (cls && (cls._id === filterClass || cls.id === filterClass))
      );
    });
  }, [myAttendances, filterClass, classMap]);

  // Attendance statistics recalculated dynamically for the active filter
  const stats = useMemo(() => {
    return calculateStudentAttendanceStats(filteredList);
  }, [filteredList]);

  // Group attendance records by Course / Class (Card-based Accordion representation)
  const groupedClasses = useMemo(() => {
    const groupMap = new Map();

    // 1. Seed groups from enrollments so all registered classes are recognized
    for (const e of enrollments) {
      const cls = e.class || {};
      const classCode = cls.id || (!isMongoId(e.classId) ? e.classId : '');
      const courseId = (!isMongoId(cls.courseId) ? cls.courseId : '') || (!isMongoId(e.courseId) ? e.courseId : '') || '';
      const key = classCode || courseId || String(e.classId || e._id);
      if (!key) continue;

      const teacherName = typeof cls.teacher === 'object'
        ? (cls.teacher?.hoTen || cls.teacher?.name || '')
        : (cls.teacher || '');

      groupMap.set(key, {
        key,
        classCode,
        courseId,
        courseName: cls.courseName || cls.name || courseId || 'Học phần',
        className: cls.className || '',
        teacherName,
        teacherAvatar: typeof cls.teacher === 'object' ? (cls.teacher?.avatar?.url || cls.teacher?.avatar) : null,
        credits: Number(cls.credits) || 3,
        records: [],
      });
    }

    // 2. Associate myAttendances to their corresponding group, or create new group
    for (const a of myAttendances) {
      const cls =
        (a.classRef && typeof a.classRef === 'object' ? a.classRef : null) ||
        classMap.get(String(a.classId)) ||
        classMap.get(String(a.regId));

      const recClassCode =
        cls?.id ||
        (!isMongoId(a.classId) ? a.classId : '') ||
        (!isMongoId(a.classCode) ? a.classCode : '') ||
        (!isMongoId(a.regId) ? a.regId : '');

      const recCourseId =
        (!isMongoId(a.courseId) ? a.courseId : '') ||
        (!isMongoId(cls?.courseId) ? cls?.courseId : '') ||
        '';

      const recCourseName =
        a.courseName ||
        cls?.courseName ||
        cls?.name ||
        recCourseId ||
        'Học phần';

      const recTeacherName =
        a.teacherName ||
        (typeof cls?.teacher === 'object' ? (cls.teacher?.hoTen || cls.teacher?.name) : cls?.teacher) ||
        '';

      const recTeacherAvatar =
        a.teacherAvatar ||
        a.teacherRef?.avatar?.url ||
        a.teacherRef?.avatar ||
        (typeof cls?.teacher === 'object' ? (cls.teacher?.avatar?.url || cls.teacher?.avatar) : null);

      // Find matching group
      let matchedGroup = null;
      for (const g of groupMap.values()) {
        if (recClassCode && (g.classCode === recClassCode || g.key === recClassCode)) {
          matchedGroup = g;
          break;
        }
        if (recCourseId && (g.courseId === recCourseId || g.key === recCourseId)) {
          matchedGroup = g;
          break;
        }
        if (recCourseName && g.courseName && g.courseName.toLowerCase() === recCourseName.toLowerCase()) {
          matchedGroup = g;
          break;
        }
        if (cls && (g.key === String(cls._id) || g.key === String(cls.id))) {
          matchedGroup = g;
          break;
        }
      }

      if (!matchedGroup) {
        const key = recClassCode || recCourseId || (!isMongoId(a.regId) ? a.regId : '') || String(a._id || a.id);
        matchedGroup = {
          key,
          classCode: recClassCode,
          courseId: recCourseId,
          courseName: recCourseName,
          className: cls?.className || '',
          teacherName: recTeacherName,
          teacherAvatar: recTeacherAvatar,
          credits: Number(cls?.credits) || 3,
          records: [],
        };
        groupMap.set(key, matchedGroup);
      }

      if (!matchedGroup.teacherName && recTeacherName) {
        matchedGroup.teacherName = recTeacherName;
      }
      if (!matchedGroup.teacherAvatar && recTeacherAvatar) {
        matchedGroup.teacherAvatar = recTeacherAvatar;
      }
      if (!matchedGroup.classCode && recClassCode) {
        matchedGroup.classCode = recClassCode;
      }

      matchedGroup.records.push(a);
    }

    // 3. Compute stats for each group and only retain groups that have records
    return Array.from(groupMap.values())
      .filter((g) => g.records.length > 0)
      .map((g) => {
        // Sort sessions by date descending
        const sortedRecords = [...g.records].sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
        const groupStats = calculateStudentAttendanceStats(sortedRecords);
        return {
          ...g,
          records: sortedRecords,
          stats: groupStats,
        };
      });
  }, [enrollments, myAttendances, classMap]);

  // Displayed groups filtered by the selected class option
  const displayedGroups = useMemo(() => {
    if (filterClass === 'all') return groupedClasses;
    return groupedClasses.filter((g) => {
      return (
        g.key === filterClass ||
        g.classCode === filterClass ||
        g.courseId === filterClass ||
        g.courseName === filterClass
      );
    });
  }, [groupedClasses, filterClass]);

  const toggleExpand = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedKeys(new Set(displayedGroups.map((g) => g.key)));
  }, [displayedGroups]);

  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  // Auto-expand card if user filters to a specific class
  useEffect(() => {
    if (filterClass !== 'all') {
      const targetGroup = displayedGroups.find(
        (g) => g.key === filterClass || g.classCode === filterClass || g.courseId === filterClass || g.courseName === filterClass
      );
      if (targetGroup) {
        setExpandedKeys(new Set([targetGroup.key]));
      }
    }
  }, [filterClass, displayedGroups]);

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
    if (filterClass === 'all') return personalGradebook;
    return personalGradebook.filter(
      (g) => g.courseId === filterClass || g.classId === filterClass || g.courseName === filterClass
    );
  }, [personalGradebook, filterClass]);

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

        {/* Class Filter Dropdown */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="student-class-filter"
            className="text-xs font-bold text-gray-500 whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5"
          >
            <i className="fas fa-filter text-indigo-500 text-xs" />
            <span>Lớp học phần:</span>
          </label>
          <select
            id="student-class-filter"
            aria-label="Lớp học phần (Lọc theo môn)"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white shadow-2xs max-w-[320px] truncate cursor-pointer"
          >
            <option value="all">Tất cả lớp học phần ({classOptions.length})</option>
            {classOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.classId ? `${opt.classId} · ` : ''}{opt.courseName || opt.courseId}{opt.className && opt.className !== opt.classId ? ` (${opt.className})` : ''}
              </option>
            ))}
          </select>
          {filterClass !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterClass('all')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer whitespace-nowrap"
            >
              Xem tất cả
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Attendance History (Card-based Accordion View) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-16 flex justify-center">
              <Spinner />
            </div>
          ) : displayedGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-16 text-center text-gray-400">
              <i className="far fa-calendar-check text-4xl mb-3 block text-gray-300" />
              <p className="font-semibold text-gray-600 text-sm">Chưa có lượt điểm danh nào</p>
              <p className="text-xs text-gray-400 mt-1">Thông tin điểm danh từng buổi học sẽ xuất hiện tại đây.</p>
              {filterClass !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterClass('all')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <i className="fas fa-rotate-left" />
                  <span>Xem tất cả các lớp</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Group View Summary Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-200/80 shadow-2xs">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-bold text-gray-800 flex items-center gap-1.5">
                    <i className="fas fa-layer-group text-indigo-500" />
                    <span>{displayedGroups.length} môn học</span>
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>{filteredList.length} buổi học đã ghi nhận</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                    title="Mở rộng tất cả các môn học"
                  >
                    <i className="fas fa-angles-down text-[11px]" />
                    <span>Mở rộng tất cả</span>
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
                    title="Thu gọn tất cả các môn học"
                  >
                    <i className="fas fa-angles-up text-[11px]" />
                    <span>Thu gọn tất cả</span>
                  </button>
                </div>
              </div>

              {/* Course Cards / Accordion List */}
              <div className="space-y-4">
                {displayedGroups.map((group) => {
                  const isExpanded = expandedKeys.has(group.key);
                  const rate = group.stats.rate;
                  let rateBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  let rateDotClass = 'bg-emerald-500';
                  if (rate < 50) {
                    rateBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                    rateDotClass = 'bg-rose-500';
                  } else if (rate < 80) {
                    rateBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                    rateDotClass = 'bg-amber-500';
                  }

                  return (
                    <div
                      key={group.key}
                      className="bg-white rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                      {/* Card Header (Accordion trigger) */}
                      <div
                        onClick={() => toggleExpand(group.key)}
                        className="p-5 cursor-pointer select-none bg-gradient-to-r from-white via-white to-slate-50/50 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Course & Class Metadata */}
                          <div className="flex items-start gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                              <i className="fas fa-book-open text-base" />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-gray-900 leading-snug">
                                  {group.courseName}
                                </h4>
                                {group.courseId && (
                                  <span className="font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                                    {group.courseId}
                                  </span>
                                )}
                                {group.credits && (
                                  <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                    {group.credits} tín chỉ
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                                {group.classCode && (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                    <i className="fas fa-layer-group text-slate-400 text-[10px]" />
                                    <span>Lớp: {group.classCode}</span>
                                  </span>
                                )}
                                {group.className && group.className !== group.classCode && (
                                  <span className="text-gray-500 font-medium">
                                    ({group.className})
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1.5 text-gray-600 font-medium">
                                  <Avatar
                                    src={group.teacherAvatar}
                                    name={group.teacherName || 'GV'}
                                    size={20}
                                    className="border border-gray-200 shadow-2xs"
                                  />
                                  <span>GV: <strong className="text-gray-800">{group.teacherName || 'Chưa phân công'}</strong></span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Summary Statistics & Expand Action */}
                          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                            {/* Attendance statistics summary */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold border ${rateBadgeClass}`}>
                                <span className={`w-2 h-2 rounded-full ${rateDotClass}`} />
                                <span>{rate}%</span>
                              </span>

                              <div className="inline-flex items-center gap-2 bg-slate-100/80 border border-slate-200/60 px-3 py-1 rounded-xl text-xs">
                                <span className="text-gray-600" title="Tổng số buổi">
                                  <strong className="text-gray-900">{group.stats.total}</strong> buổi
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className="text-emerald-700 font-semibold" title="Có mặt">
                                  <i className="fas fa-check text-[10px] mr-1" />
                                  {group.stats.present}
                                </span>
                                <span className="text-amber-700 font-semibold" title="Đi muộn">
                                  <i className="fas fa-clock text-[10px] mr-1" />
                                  {group.stats.late}
                                </span>
                                <span className="text-rose-700 font-semibold" title="Vắng">
                                  <i className="fas fa-times text-[10px] mr-1" />
                                  {group.stats.absent}
                                </span>
                              </div>
                            </div>

                            {/* Expand / Collapse Button */}
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(group.key);
                              }}
                              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                isExpanded
                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                  : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                              }`}
                            >
                              <span>{isExpanded ? 'Thu gọn' : `Xem chi tiết (${group.records.length} buổi)`}</span>
                              <i className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Body: Inner Table & Read-only Matrix for this specific course */}
                      {isExpanded && (() => {
                        const chronologicalRecords = [...group.records].sort(
                          (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
                        );
                        // Chỉ lấy các buổi thực sự có ghi chú hoặc đánh giá từ Giảng viên để bảng chi tiết gọn gàng
                        const notedRecords = group.records.filter((row) => {
                          const hasEvaluation = Boolean((row.evaluation || row.note || '').trim());
                          const hasScore = row.score != null && row.score !== '';
                          return hasEvaluation || hasScore;
                        });

                        return (
                          <div className="border-t border-gray-100 bg-slate-50/40 p-4 sm:p-5 space-y-4">
                            {/* Mini Summary Toolbar inside Card */}
                            <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-bold text-slate-700 mr-1 flex items-center gap-1.5">
                                  <i className="fas fa-chart-pie text-indigo-500 text-[11px]" />
                                  <span>Thống kê môn:</span>
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 select-none cursor-default">
                                  <i className="fas fa-check text-[10px]" />
                                  Có mặt: <strong>{group.stats.present}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 select-none cursor-default">
                                  <i className="fas fa-clock text-[10px]" />
                                  Đi muộn: <strong>{group.stats.late}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 select-none cursor-default">
                                  <i className="fas fa-envelope-open-text text-[10px]" />
                                  Có phép: <strong>{group.stats.excused}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 select-none cursor-default">
                                  <i className="fas fa-xmark text-[10px]" />
                                  Vắng mặt: <strong>{group.stats.absent}</strong>
                                </span>
                              </div>

                              {/* Progress bar & Read-only indicator */}
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 text-xs min-w-[160px]">
                                  <span className="text-slate-500 text-[11px] font-medium whitespace-nowrap">Chuyên cần:</span>
                                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                    <div
                                      className={`h-full transition-all duration-300 rounded-full ${
                                        rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className="font-extrabold text-slate-800 text-[11px]">{rate}%</span>
                                </div>

                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 select-none cursor-default"
                                  title="Dữ liệu điểm danh do Giảng viên xác nhận và quản lý (Chế độ chỉ xem)"
                                >
                                  <i className="fas fa-lock text-[10px] text-slate-400" />
                                  <span>Chỉ xem</span>
                                </span>
                              </div>
                            </div>

                            {/* Visual Timeline Matrix Grid Strip (Lưới ma trận trực quan các buổi học - Read-only) */}
                            {chronologicalRecords.length > 0 && (
                              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <i className="fas fa-table-cells text-indigo-600 text-xs" />
                                    <span>Ma trận chuyên cần trực quan ({chronologicalRecords.length} buổi học)</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                    <i className="fas fa-circle-info text-[10px]" />
                                    <span>Rê chuột vào từng ô buổi học để xem nhanh thông tin chi tiết</span>
                                  </span>
                                </div>

                                <div className="overflow-x-auto custom-scrollbar pb-1">
                                  <div className="flex items-center gap-2 min-w-max">
                                    {chronologicalRecords.map((row, cIdx) => {
                                      const status = row.status || 'Có mặt';
                                      const meta = MATRIX_STATUS_MAP[status] || MATRIX_STATUS_MAP['Chưa điểm danh'];
                                      const hasNote = Boolean(row.note || row.evaluation || (row.score != null && row.score !== ''));
                                      const formattedDate = formatAttendanceDate(row.date);
                                      const d = row.date ? new Date(`${String(row.date).slice(0, 10)}T12:00:00`) : null;
                                      const dow = d && !isNaN(d.getTime()) ? d.getDay() : null;
                                      const dayLabelText = dow === 0 ? 'CN' : dow != null ? `T${dow + 1}` : '';
                                      const parts = String(row.date || '').slice(5).split('-');
                                      const shortDate = parts.length === 2 ? `${parts[1]}/${parts[0]}` : formattedDate;

                                      return (
                                        <div
                                          key={row._id || row.id || cIdx}
                                          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition-colors select-none cursor-default min-w-[68px] relative group"
                                          title={`Buổi #${cIdx + 1} (${formattedDate}${dayLabelText ? ` - ${dayLabelText}` : ''})\nTrạng thái: ${meta.label}${
                                            row.score != null ? `\nĐiểm số: ${row.score}đ` : ''
                                          }${row.evaluation || row.note ? `\nNhận xét: ${row.evaluation || row.note}` : ''}`}
                                        >
                                          <span className="text-[10px] font-black font-mono text-slate-500">
                                            #{cIdx + 1}
                                          </span>
                                          <span className="text-[10px] font-bold text-slate-700 font-mono mt-0.5">
                                            {shortDate}
                                          </span>
                                          {dayLabelText && (
                                            <span className="text-[9px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1 rounded border border-indigo-100 mt-0.5">
                                              {dayLabelText}
                                            </span>
                                          )}

                                          {/* Status symbol & icon (Read-only / disabled) */}
                                          <div
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs mt-1.5 border shadow-2xs ${meta.color} select-none pointer-events-none`}
                                            aria-disabled="true"
                                          >
                                            <i className={`fas ${meta.icon} text-xs`} />
                                          </div>

                                          {/* Note / Score Indicator */}
                                          {hasNote && (
                                            <span
                                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] shadow-xs"
                                              title={`Có nhận xét / điểm số`}
                                            >
                                              <i className="fas fa-comment text-[7px]" />
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Detailed Attendance Table (Chỉ hiển thị các buổi thực sự có ghi chú / đánh giá từ Giảng viên để giao diện gọn gàng) */}
                            {notedRecords.length === 0 ? (
                              <div className="bg-white rounded-xl border border-dashed border-slate-200/90 p-6 text-center space-y-2">
                                <div className="w-10 h-10 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-2xs">
                                  <i className="fas fa-comment-slash text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-slate-700">
                                    Chưa có ghi chú hoặc nhận xét nào từ Giảng viên
                                  </p>
                                  <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                                    Các buổi học của bạn đang được ghi nhận đầy đủ. Bạn có thể theo dõi nhanh tiến độ và trạng thái chuyên cần ở dải ma trận phía trên.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                                <div className="overflow-x-auto custom-scrollbar">
                                  <table className="w-full min-w-[600px] text-left text-xs text-slate-700">
                                    <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                      <tr>
                                        <th className="px-3.5 py-3 w-16 text-center">Buổi</th>
                                        <th className="px-4 py-3 w-56 sm:w-64 whitespace-nowrap">Thời gian & Ca học</th>
                                        <th className="px-4 py-3">Đánh giá & Ghi chú của Giảng viên</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {notedRecords.map((row, idx) => {
                                        const shiftDisplay = getShiftLabel(row.shiftId, row.shiftLabel);
                                        const formattedDate = formatAttendanceDate(row.date);
                                        const hasEvaluation = Boolean((row.evaluation || row.note || '').trim());
                                        const hasScore = row.score != null && row.score !== '';
                                        const sessionNum = chronologicalRecords.findIndex(
                                          (r) => (r._id && r._id === row._id) || (r.id && r.id === row.id) || r === row
                                        ) + 1;

                                        // Determine day of week label
                                        let dayLabelText = '';
                                        if (row.date) {
                                          const d = new Date(`${String(row.date).slice(0, 10)}T12:00:00`);
                                          if (!isNaN(d.getTime())) {
                                            const dow = d.getDay();
                                            dayLabelText = dow === 0 ? 'CN' : `T${dow + 1}`;
                                          }
                                        }

                                        return (
                                          <tr key={row._id || row.id || idx} className="hover:bg-indigo-50/20 transition">
                                            {/* Cột 1: Buổi */}
                                            <td className="px-3.5 py-3 text-center font-bold text-slate-400 align-top">
                                              <span
                                                className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-600 select-none"
                                                title={`Buổi #${sessionNum > 0 ? sessionNum : idx + 1} trên ma trận chuyên cần`}
                                              >
                                                #{sessionNum > 0 ? sessionNum : idx + 1}
                                              </span>
                                            </td>

                                            {/* Cột 2: Thời gian & Ca học */}
                                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap align-top">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {dayLabelText && (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono select-none">
                                                    {dayLabelText}
                                                  </span>
                                                )}
                                                <span className="font-semibold text-slate-900 text-xs">
                                                  {formattedDate}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-[11px] text-slate-500 font-normal">
                                                  {shiftDisplay}
                                                </span>
                                                {row.checkInTime && row.checkInTime !== 'Đúng giờ' && (
                                                  <>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                      Giờ vào: {row.checkInTime}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </td>

                                            {/* Cột 3: Đánh giá & Ghi chú của Giảng viên (Mở rộng tối đa diện tích) */}
                                            <td className="px-4 py-3 align-top">
                                              <div className="space-y-1.5 max-w-3xl">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  {hasScore && (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-lg text-xs border border-emerald-200 select-none">
                                                      <i className="fas fa-star text-[10px] text-emerald-500" />
                                                      <span>Điểm: <strong>{row.score}đ</strong></span>
                                                    </span>
                                                  )}
                                                  {(row.teacherName || group.teacherName) && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 not-italic">
                                                      <i className="fas fa-user-tie text-[10px] text-slate-400" />
                                                      <span>(GV: {row.teacherName || group.teacherName})</span>
                                                    </span>
                                                  )}
                                                </div>
                                                {hasEvaluation ? (
                                                  <p className="text-xs text-slate-700 leading-relaxed font-normal italic bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                                    &quot;{row.evaluation || row.note}&quot;
                                                  </p>
                                                ) : (
                                                  <p className="text-xs text-slate-400 italic">Không có ghi chú thêm</p>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Read-only Table Footer */}
                                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                  <div className="flex items-center gap-1.5 font-medium">
                                    <i className="fas fa-comment-dots text-indigo-500 text-xs" />
                                    <span>Bảng chi tiết ghi chú & đánh giá từ Giảng viên · Dữ liệu chỉ xem (Read-only)</span>
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-400">
                                    Hiển thị {notedRecords.length} / {group.records.length} buổi học có ghi chú
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </>
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
