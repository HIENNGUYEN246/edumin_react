import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { setAiPageContext } from '../../components/ai/EduMinAiAssistant.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import {
  formatDate,
  formatCurrency,
  getCurrentDateTimeLocalWithSeconds,
  formatRegistrationDateTime,
  registrationDateTimeInput,
  calculateGpa,
  DEFAULT_GRADE_WEIGHTS,
} from '../../lib/format.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useOpenClasses, useMyEnrollments, useEnrollmentMutations } from './useEnrollments.js';
import {
  ScheduleTimeCombinedBadge,
  ScheduleDaysBadge,
  ScheduleTimeBadge,
  RoomBadge,
  ScheduleRoomBadge,
} from '../../components/schedule/ScheduleBadge.jsx';

export const MAX_CREDITS = 25;

/**
 * Checks whether the student has passed (GPA >= 4.0) all prerequisite courses.
 */
export function checkCoursePrerequisites(prerequisites, passedCourseIds) {
  if (!prerequisites || typeof prerequisites !== 'string') return { satisfied: true };
  const trimmed = prerequisites.trim();
  if (!trimmed) return { satisfied: true };
  const lower = trimmed.toLowerCase();
  if (lower === 'không' || lower === 'không có' || lower === 'none' || lower === 'n/a') {
    return { satisfied: true };
  }

  const tokens = trimmed.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return { satisfied: true };

  const missing = [];
  for (const token of tokens) {
    const idMatch = token.match(/([a-zA-Z]{2,}[0-9]{2,}[a-zA-Z0-9_-]*)/);
    const targetId = idMatch ? idMatch[1] : token;

    const isPassed =
      passedCourseIds.has(targetId) ||
      passedCourseIds.has(targetId.toLowerCase()) ||
      passedCourseIds.has(token) ||
      passedCourseIds.has(token.toLowerCase());

    if (!isPassed) {
      missing.push(token);
    }
  }

  if (missing.length > 0) {
    return {
      satisfied: false,
      missingPrerequisites: missing.join(', '),
      message: `Yêu cầu hoàn thành môn tiên quyết: ${missing.join(', ')} trước khi đăng ký`,
    };
  }

  return { satisfied: true };
}

export const KNOWN_DEPARTMENT_GROUPS = [
  ['cntt', 'công nghệ thông tin', 'khoa công nghệ thông tin', 'it', 'information technology'],
  ['nna', 'ngôn ngữ anh', 'khoa ngôn ngữ anh', 'tiếng anh', 'english'],
  ['cntp', 'công nghiệp thực phẩm', 'khoa công nghiệp thực phẩm', 'thực phẩm', 'food technology'],
  ['hoa', 'hóa học', 'khoa hóa học', 'hóa', 'chemistry'],
  ['xd', 'xây dựng', 'khoa xây dựng', 'civil engineering'],
  ['qtkd', 'quản trị kinh doanh', 'khoa quản trị kinh doanh', 'business administration'],
  ['khcb', 'khoa học cơ bản', 'khoa khoa học cơ bản', 'đại cương', 'khoa đại cương'],
];

export const GENERAL_DEPT_KEYWORDS = [
  'đại cương',
  'khoa đại cương',
  'giáo dục đại cương',
  'khoa học cơ bản',
  'khoa cơ bản',
  'toàn trường',
  'chung',
  'lý luận chính trị',
  'giáo dục thể chất',
  'quốc phòng',
  'general',
];

export function isGeneralEducation(dept) {
  if (!dept) return false;
  const raw = typeof dept === 'object' ? (dept.name || dept.id || '') : String(dept);
  const norm = raw.trim().toLowerCase();
  const stripped = norm.replace(/^khoa\s+/i, '').trim();
  return GENERAL_DEPT_KEYWORDS.some((k) => norm.includes(k) || stripped.includes(k));
}

export function matchDepartment(classDept, userDept) {
  if (!classDept || !userDept) return false;
  // Các học phần đại cương chung luôn mở cho toàn trường sinh viên
  if (isGeneralEducation(classDept)) return true;

  const rawClass = typeof classDept === 'object' ? (classDept.name || classDept.id || '') : String(classDept);
  const rawUser = typeof userDept === 'object' ? (userDept.name || userDept.id || '') : String(userDept);

  const normClass = rawClass.trim().toLowerCase();
  const normUser = rawUser.trim().toLowerCase();
  if (normClass === normUser) return true;

  const cleanClass = normClass.replace(/^khoa\s+/i, '').trim();
  const cleanUser = normUser.replace(/^khoa\s+/i, '').trim();
  if (cleanClass && cleanUser && cleanClass === cleanUser) return true;

  for (const group of KNOWN_DEPARTMENT_GROUPS) {
    const matchClass = group.some((alias) => alias === normClass || alias === cleanClass);
    const matchUser = group.some((alias) => alias === normUser || alias === cleanUser);
    if (matchClass && matchUser) return true;
  }

  return false;
}

/**
 * Kiểm tra xem một lớp học phần có thuộc chuyên ngành/khoa của sinh viên hoặc là môn đại cương chung hay không.
 */
export function isCourseMatchingStudentDepartment(cls, deptCandidates = []) {
  if (!cls) return false;

  // 1. Kiểm tra department từ class hoặc populated courseRef
  const rawClassDept = cls.department || cls.courseRef?.department;

  // 2. Các học phần đại cương chung luôn hợp lệ cho mọi sinh viên toàn trường
  if (rawClassDept && isGeneralEducation(rawClassDept)) return true;
  if (cls.courseId && isGeneralEducation(cls.courseId)) return true;
  if (cls.courseName && isGeneralEducation(cls.courseName)) return true;

  // 3. Nếu sinh viên chưa xác định khoa/chuyên ngành: chỉ cho phép xem/giữ môn đại cương
  if (!deptCandidates || deptCandidates.length === 0) return false;

  // 4. So khớp theo khoa học phần nếu có
  if (rawClassDept) {
    const isMatch = deptCandidates.some((cand) => matchDepartment(rawClassDept, cand));
    if (isMatch) return true;
  }

  // 5. So khớp dự phòng theo tiền tố mã học phần (vd: "CNTT101" -> "cntt", "NNA101" -> "nna")
  const idToTest = cls.courseId || cls.id || '';
  const prefixMatch = idToTest.match(/^[a-zA-Z]+/)?.[0];
  if (prefixMatch) {
    if (isGeneralEducation(prefixMatch)) return true;
    return deptCandidates.some((cand) => matchDepartment(prefixMatch, cand));
  }

  return false;
}

/** Group a flat class list into [{ courseId, courseName, credits, department, prerequisites, description, classes }]. */
function groupByCourse(classes) {
  const map = new Map();
  classes.forEach((cls) => {
    if (!map.has(cls.courseId)) {
      map.set(cls.courseId, {
        courseId: cls.courseId,
        courseName: cls.courseName,
        credits: cls.credits,
        department: cls.department || cls.courseRef?.department || '',
        prerequisites: cls.courseRef?.prerequisites || cls.prerequisites || '',
        description: cls.courseRef?.description || cls.description || '',
        classes: [],
      });
    }
    map.get(cls.courseId).classes.push(cls);
  });
  return [...map.values()];
}

function ClassRow({ cls, state, onEnroll, onCancel, pending, prereqCheck }) {
  const full = cls.capacity > 0 && cls.enrolledCount >= cls.capacity;
  const isTimeLocked =
    cls.status !== 'Đang mở' ||
    Boolean(
      cls.registrationEnd &&
      registrationDateTimeInput(cls.registrationEnd, true) < getCurrentDateTimeLocalWithSeconds()
    );
  const isPrereqBlocked = Boolean(prereqCheck && !prereqCheck.satisfied && !state.enrolledThisClass);
  const disabled = pending || state.enrolledThisClass || state.enrolledOtherInCourse || full || isTimeLocked || isPrereqBlocked;

  let action;
  if (state.enrolledThisClass) {
    action = (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1.5">
          <i className="fas fa-circle-check text-emerald-500" />
          Đã đăng ký
        </span>
        {onCancel && !isTimeLocked && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
            title="Hủy đăng ký lớp này để đổi lớp khác"
          >
            Hủy
          </button>
        )}
      </div>
    );
  } else if (isTimeLocked) {
    action = (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 cursor-not-allowed"
        title="Thời hạn đăng ký đã kết thúc (khóa tự động / chỉ xem)"
      >
        <i className="fas fa-lock text-[10px]" />
        Đã khóa (hết hạn)
      </span>
    );
  } else if (isPrereqBlocked) {
    action = (
      <button
        type="button"
        disabled={true}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 cursor-not-allowed select-none shadow-2xs"
        title={prereqCheck.message}
      >
        <i className="fas fa-lock text-[10px] text-amber-600" />
        <span>Chưa đạt tiên quyết</span>
      </button>
    );
  } else if (state.enrolledOtherInCourse) {
    action = (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-medium border border-slate-200 cursor-not-allowed select-none"
        title="Đã đăng ký lớp khác thuộc học phần này. Vui lòng hủy lớp đã đăng ký trước nếu muốn đổi lớp."
      >
        <i className="fas fa-lock text-[10px] text-slate-400" />
        Đã đăng ký lớp khác
      </span>
    );
  } else if (full) {
    action = (
      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold border border-rose-200">
        <i className="fas fa-users-slash text-[10px]" />
        Đã đầy
      </span>
    );
  } else {
    action = (
      <button
        type="button"
        onClick={() => onEnroll(cls, prereqCheck)}
        disabled={disabled}
        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition shadow-xs cursor-pointer active:scale-95"
      >
        Đăng ký
      </button>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 rounded-2xl border transition-all ${
        state.enrolledThisClass
          ? 'border-2 border-emerald-400 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-400/20'
          : state.enrolledOtherInCourse
          ? 'border-slate-200/90 bg-slate-50/60 opacity-70'
          : isPrereqBlocked
          ? 'border-amber-200 bg-amber-50/30'
          : isTimeLocked
          ? 'border-amber-200/80 bg-amber-50/20'
          : 'border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-xs'
      }`}
    >
      <div className="w-28 shrink-0">
        <span className="font-mono font-bold text-indigo-700 text-xs px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100/80 text-center block shadow-2xs">
          {cls.id}
        </span>
        <span className="mt-1 text-[11px] text-slate-600 text-center block truncate font-medium" title={cls.className || ''}>
          {cls.className || '—'}
        </span>
      </div>
      <div className="text-sm text-slate-700 min-w-[140px] max-w-[170px] flex items-center gap-2">
        <Avatar src={cls.teacherRef?.avatar?.url || cls.teacherRef?.avatar} name={cls.teacher || 'GV'} size={26} />
        <span className="font-semibold text-xs text-slate-800 truncate" title={cls.teacher}>
          {cls.teacher || 'Chưa phân công'}
        </span>
      </div>
      {/* Lịch học (Thứ & Giờ trên 1 hàng ngang cân đối) */}
      <div className="min-w-[210px] shrink-0">
        <ScheduleTimeCombinedBadge schedules={cls.schedules} compact />
      </div>

      {/* Phòng học */}
      <div className="min-w-[100px] shrink-0">
        <RoomBadge room={cls.room} compact />
      </div>
      <span className={`text-xs font-semibold w-16 text-center ${full ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
        {cls.enrolledCount}
        {cls.capacity > 0 ? `/${cls.capacity}` : ''}
      </span>
      <span className="text-xs font-semibold text-slate-700">Học phí: {formatCurrency(cls.fee)}</span>
      <span className="text-xs text-slate-500">
        Đăng ký: {formatRegistrationDateTime(cls.registrationStart)} – {formatRegistrationDateTime(cls.registrationEnd, true)}
      </span>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
          isTimeLocked
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : cls.status === 'Đang mở'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        Trạng thái: {isTimeLocked ? 'Đã hết hạn đăng ký' : (cls.status || 'Đang mở')}
      </span>
      {cls.department && (
        <span className="rounded-full bg-indigo-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
          Khoa: {cls.department}
        </span>
      )}
      <div className="ml-auto">{action}</div>

      {/* Cảnh báo môn tiên quyết nếu chưa hoàn thành */}
      {isPrereqBlocked && (
        <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-800 text-[11px] font-semibold">
          <i className="fas fa-triangle-exclamation text-amber-600 shrink-0" />
          <span>{prereqCheck.message}</span>
        </div>
      )}
    </div>
  );
}

export function StudentCourseRegistration() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const {
    data: openData,
    isLoading: isOpenLoading,
    isPending: isOpenPending,
    isFetching: isOpenFetching,
  } = useOpenClasses();
  const {
    data: mineData,
    isLoading: isMineLoading,
    isPending: isMinePending,
    isFetching: isMineFetching,
  } = useMyEnrollments();
  const { enroll, cancel } = useEnrollmentMutations();

  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all'); // 'all' | 'unregistered' | 'registered'
  const [courseDetailModal, setCourseDetailModal] = useState(null);
  const [expandedCourses, setExpandedCourses] = useState(() => new Set());

  // Prevent race condition: Wait until student context and API requests have loaded
  const isContextLoading =
    Boolean(isAuthLoading) ||
    Boolean((user?.student || user?.studentId) && !profile && (isOpenLoading || isMineLoading || !openData));

  const isRegistrationLoading =
    isContextLoading ||
    isOpenPending ||
    (isOpenLoading && !openData) ||
    isMinePending ||
    (isMineLoading && !mineData);

  const toggleCourseExpanded = (courseId) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const expandAllCourses = () => {
    setExpandedCourses(new Set(rawGroups.map((g) => g.courseId)));
  };

  const collapseAllCourses = () => {
    setExpandedCourses(new Set());
  };

  const studentDept =
    user?.khoa ||
    user?.department ||
    user?.departmentId ||
    user?.major ||
    user?.majorId ||
    user?.chuyenNganh ||
    profile?.department ||
    profile?.departmentId ||
    profile?.departmentRef?.name ||
    profile?.departmentRef?.id ||
    profile?.major ||
    profile?.majorId ||
    profile?.chuyenNganh ||
    '';

  const deptCandidates = useMemo(
    () =>
      [
        user?.khoa,
        user?.department,
        user?.departmentId,
        user?.major,
        user?.majorId,
        user?.chuyenNganh,
        profile?.department,
        profile?.departmentId,
        profile?.departmentRef?.name,
        profile?.departmentRef?.id,
        profile?.major,
        profile?.majorId,
        profile?.chuyenNganh,
        profile?.className,
        user?.className,
      ].filter(Boolean),
    [user, profile]
  );

  const rawEnrollments = useMemo(() => mineData?.data || [], [mineData]);

  // Lọc và loại bỏ môn học lệch chuyên ngành ở danh sách Đã đăng ký (enrolledCourses)
  // Nếu môn nào không thuộc chuyên ngành của sinh viên (và không phải môn đại cương chung), tuyệt đối không cho hiển thị
  const enrolledCourses = useMemo(() => {
    return rawEnrollments.filter((e) => {
      const cls = e.class || {};
      const enrichedCls = {
        ...cls,
        department:
          cls.department ||
          cls.courseRef?.department ||
          openData?.data?.find((c) => c._id === cls._id || c.courseId === cls.courseId)?.department ||
          '',
      };
      return isCourseMatchingStudentDepartment(enrichedCls, deptCandidates);
    });
  }, [rawEnrollments, deptCandidates, openData]);

  // Danh sách các học phần lệch chuyên ngành bị loại bỏ (nếu có tồn tại trong dữ liệu cũ)
  const outOfDeptEnrollments = useMemo(() => {
    if (isRegistrationLoading || deptCandidates.length === 0) return [];
    const validIds = new Set(enrolledCourses.map((e) => e._id));
    return rawEnrollments.filter((e) => !validIds.has(e._id));
  }, [rawEnrollments, enrolledCourses, isRegistrationLoading, deptCandidates]);

  // Đồng bộ enrollments bằng enrolledCourses để cập nhật toàn bộ logic tính toán
  const enrollments = enrolledCourses;

  const enrolledClassIds = useMemo(() => new Set(enrollments.map((e) => e.class?._id)), [enrollments]);
  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.class?.courseId).filter(Boolean)),
    [enrollments]
  );

  // Bảng điểm / Các môn học đã đạt (GPA hoặc Điểm tổng kết >= 4.0 / 10) để kiểm tra điều kiện tiên quyết
  const passedCourseIds = useMemo(() => {
    const passed = new Set();
    rawEnrollments.forEach((e) => {
      const cls = e.class || {};
      const courseId = cls.courseId;
      if (!courseId) return;

      let score = null;
      if (e.finalScore != null && !isNaN(e.finalScore)) {
        score = Number(e.finalScore);
      } else if (e.manualGrades) {
        const mg = e.manualGrades;
        const weights = cls.gradeWeights || DEFAULT_GRADE_WEIGHTS;
        const compGrades = {
          attendance: mg.attendance ?? null,
          homework: mg.assignment ?? mg.homework ?? null,
          midterm: mg.midterm ?? null,
          presentation: mg.presentation ?? null,
          final: mg.final ?? null,
        };
        score = calculateGpa(compGrades, weights);
      }

      if (score != null && Number.isFinite(score) && score >= 4.0) {
        passed.add(courseId.trim());
        passed.add(courseId.trim().toLowerCase());
      }
    });
    return passed;
  }, [rawEnrollments]);

  const totalEnrolledCredits = useMemo(() => {
    return enrollments.reduce((sum, e) => sum + (Number(e.class?.credits) || 0), 0);
  }, [enrollments]);

  const totalTuitionFee = useMemo(() => {
    return enrollments.reduce((sum, e) => sum + (Number(e.class?.fee) || 0), 0);
  }, [enrollments]);

  const creditPercentage = Math.min(100, Math.round((totalEnrolledCredits / MAX_CREDITS) * 100));
  const isAtMaxCredits = totalEnrolledCredits >= MAX_CREDITS;

  useEffect(() => {
    setAiPageContext({
      page: 'student_registration',
      enrolledCourses,
      totalEnrolledCredits,
      totalTuitionFee,
    });
  }, [enrolledCourses, totalEnrolledCredits, totalTuitionFee]);

  // Lọc dữ liệu theo Chuyên ngành: chỉ hiển thị học phần thuộc khoa sinh viên đang học hoặc đại cương chung
  const filteredOpenClasses = useMemo(() => {
    const raw = openData?.data || [];
    return raw.filter((cls) => isCourseMatchingStudentDepartment(cls, deptCandidates));
  }, [openData, deptCandidates]);

  const rawGroups = useMemo(() => groupByCourse(filteredOpenClasses), [filteredOpenClasses]);

  // Apply search query and status filter to courses
  const groups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawGroups.filter((group) => {
      const isRegistered = enrolledCourseIds.has(group.courseId);
      if (courseFilter === 'unregistered' && isRegistered) return false;
      if (courseFilter === 'registered' && !isRegistered) return false;

      if (!q) return true;
      const matchCourseId = group.courseId?.toLowerCase().includes(q);
      const matchCourseName = group.courseName?.toLowerCase().includes(q);
      const matchDept = group.department?.toLowerCase().includes(q);
      const matchClasses = group.classes?.some(
        (c) =>
          c.id?.toLowerCase().includes(q) ||
          c.className?.toLowerCase().includes(q) ||
          c.teacher?.toLowerCase().includes(q)
      );
      return matchCourseId || matchCourseName || matchDept || matchClasses;
    });
  }, [rawGroups, searchQuery, courseFilter, enrolledCourseIds]);

  const doEnroll = async (cls, prereqCheck) => {
    // 0. Prerequisite Check Validation
    if (prereqCheck && !prereqCheck.satisfied) {
      toast.error(prereqCheck.message);
      return;
    }

    // 1. Exclusive Selection Constraint: Only 1 class per course
    if (enrolledCourseIds.has(cls.courseId)) {
      toast.error(
        `Bạn đã đăng ký một lớp của học phần ${cls.courseName || cls.courseId}! Trong cùng một học phần, chỉ được phép chọn tối đa 1 lớp.`
      );
      return;
    }

    // 2. Maximum Credit Limit Validation: Total credits cannot exceed MAX_CREDITS (25)
    const classCredits = Number(cls.credits) || 0;
    const projectedCredits = totalEnrolledCredits + classCredits;
    if (projectedCredits > MAX_CREDITS) {
      toast.error(
        `Không thể đăng ký: Tổng số tín chỉ sau khi đăng ký sẽ là ${projectedCredits} tín chỉ, vượt quá giới hạn tối đa cho phép (${MAX_CREDITS} tín chỉ/học kỳ)!`
      );
      return;
    }

    try {
      await enroll.mutateAsync(cls._id);
      toast.success(`Đã đăng ký ${cls.courseName}`);
    } catch (error) {
      toast.error(error.message, 5000);
    }
  };

  const doCancel = async (enrollment) => {
    const cls = enrollment.class || {};
    const ok = await confirm({
      title: 'Hủy đăng ký lớp học phần',
      message: `Bạn có chắc chắn muốn hủy đăng ký lớp ${cls.id || enrollment.classId} (${cls.courseName || 'học phần'})?`,
      confirmText: 'Xác nhận hủy',
    });
    if (!ok) return;

    try {
      await cancel.mutateAsync(cls._id || enrollment.classId);
      toast.success('Đã hủy đăng ký lớp học phần thành công');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleValidatePlan = () => {
    if (enrollments.length === 0) {
      toast.info('Bạn chưa đăng ký học phần nào. Vui lòng chọn các lớp học phần ở danh sách phía trên.');
      return;
    }
    if (totalEnrolledCredits > MAX_CREDITS) {
      toast.error(
        `Không hợp lệ: Tổng số tín chỉ hiện tại là ${totalEnrolledCredits} TC, vượt quá mức tối đa quy định (${MAX_CREDITS} TC)! Vui lòng hủy bớt học phần.`
      );
      return;
    }
    toast.success(
      `Kế hoạch đăng ký hợp lệ! Đã đăng ký ${enrollments.length} học phần với tổng cộng ${totalEnrolledCredits} tín chỉ.`
    );
  };

  const cancellationLocked = (cls) =>
    cls?.status !== 'Đang mở' ||
    Boolean(
      cls.registrationEnd &&
      registrationDateTimeInput(cls.registrationEnd, true) < getCurrentDateTimeLocalWithSeconds()
    );

  const enrolledColumns = [
    {
      key: 'classId',
      header: 'Mã lớp',
      className: 'w-28 shrink-0',
      render: (e) => (
        <div>
          <span className="font-mono font-bold text-indigo-700 text-xs px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100/80 block text-center shadow-2xs">
            {e.class?.id || e.classId}
          </span>
          {e.class?.className && e.class.className !== (e.class?.id || e.classId) && (
            <span
              className="text-[11px] text-slate-500 font-medium truncate block max-w-[120px] text-center mt-1"
              title={e.class.className}
            >
              {e.class.className}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'courseName',
      header: 'Học phần',
      className: 'min-w-[170px]',
      render: (e) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
              {e.class?.courseId || '—'}
            </span>
            {e.class?.credits != null && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {e.class.credits} TC
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const matchedGroup = rawGroups.find((g) => g.courseId === e.class?.courseId) || {
                courseId: e.class?.courseId,
                courseName: e.class?.courseName,
                credits: e.class?.credits,
                department: e.class?.department,
                classes: [e.class],
              };
              setCourseDetailModal(matchedGroup);
            }}
            className="font-bold text-slate-900 hover:text-indigo-600 transition truncate max-w-[220px] block mt-1 text-left cursor-pointer"
            title="Bấm để xem chi tiết học phần"
          >
            {e.class?.courseName || '—'}
          </button>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Giảng viên',
      className: 'min-w-[130px]',
      render: (e) =>
        e.class?.teacher ? (
          <div className="flex items-center gap-2 max-w-[150px]">
            <Avatar src={e.class?.teacherRef?.avatar?.url || e.class?.teacherRef?.avatar} name={e.class.teacher} size={24} />
            <span className="text-xs font-semibold text-slate-800 truncate" title={e.class.teacher}>{e.class.teacher}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">Chưa phân công</span>
        ),
    },
    {
      key: 'schedules',
      header: 'Thời gian học',
      className: 'min-w-[210px]',
      render: (e) => <ScheduleTimeCombinedBadge schedules={e.class?.schedules} />,
    },
    {
      key: 'room',
      header: 'Phòng học',
      className: 'min-w-[130px]',
      render: (e) => (
        <RoomBadge
          room={e.class?.room}
          studyStart={e.class?.studyStart}
          studyEnd={e.class?.studyEnd}
        />
      ),
    },
    {
      key: 'fee',
      header: 'Học phí',
      className: 'whitespace-nowrap font-bold text-slate-800 text-xs',
      render: (e) => formatCurrency(e.class?.fee),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      className: 'whitespace-nowrap',
      render: (e) => {
        const isLocked = cancellationLocked(e.class);
        return (
          <span
            className={`text-xs font-bold ${
              isLocked
                ? 'text-amber-700'
                : e.class?.status === 'Đang mở'
                  ? 'text-emerald-700'
                  : 'text-slate-500'
            }`}
          >
            {isLocked ? (
              <span className="inline-flex items-center gap-1 font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200">
                <i className="fas fa-lock text-[10px]" />
                Đã khóa (hết hạn)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200">
                <i className="fas fa-circle-check text-[10px]" />
                {e.class?.status || 'Đang mở'}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: 'Thao tác',
      headerClassName: 'text-center sticky right-0 bg-slate-50/95 backdrop-blur-xs shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10 whitespace-nowrap',
      className: 'text-center sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10 w-36 whitespace-nowrap',
      render: (e) => {
        const isLocked = cancellationLocked(e.class);
        if (isLocked) {
          return (
            <span
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold cursor-not-allowed border border-slate-200 whitespace-nowrap"
              title="Thời hạn đăng ký đã kết thúc — đã khóa tính năng hủy (chế độ chỉ xem / read-only)"
            >
              <i className="fas fa-lock text-[10px]" />
              Đã khóa
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => doCancel(e)}
            disabled={cancel.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60 whitespace-nowrap"
            title="Hủy đăng ký lớp học phần này"
          >
            <i className="fas fa-trash-can text-white text-[11px]" />
            <span>Hủy đăng ký</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Department Badge Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Đăng ký học phần" subtitle="Chọn một lớp cho mỗi học phần bạn muốn học" />
        {studentDept && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700 shadow-2xs">
            <i className="fas fa-building-columns text-indigo-500" />
            <span>Khoa: {studentDept}</span>
          </div>
        )}
      </div>

      {/* Sticky Compact Top Status Bar (Số tín chỉ, Học phí, Số môn & Nút kiểm tra) */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm rounded-2xl p-3.5 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Compact Metric Pills */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Tín chỉ */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-slate-500 font-medium">Số tín chỉ:</span>
              {isRegistrationLoading ? (
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              ) : (
                <>
                  <strong className="font-mono text-slate-900">{totalEnrolledCredits} / {MAX_CREDITS} TC</strong>
                  <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden inline-block">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        totalEnrolledCredits >= MAX_CREDITS ? 'bg-indigo-600' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${creditPercentage}%` }}
                    />
                  </div>
                  {totalEnrolledCredits > 0 && totalEnrolledCredits < MAX_CREDITS && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {totalEnrolledCredits} TC đã đăng ký
                    </span>
                  )}
                  {isAtMaxCredits && (
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      Đạt tối đa {MAX_CREDITS} TC
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Học phí */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-slate-500 font-medium">Tổng học phí tạm tính:</span>
              {isRegistrationLoading ? (
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              ) : (
                <strong className="text-indigo-700 font-extrabold">{formatCurrency(totalTuitionFee)}</strong>
              )}
            </div>

            {/* Số môn */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-slate-500 font-medium">Học phần đã chọn:</span>
              {isRegistrationLoading ? (
                <div className="h-4 w-14 bg-slate-200 rounded animate-pulse" />
              ) : (
                <strong className="text-slate-900">{enrollments.length} môn học</strong>
              )}
            </div>
          </div>

          {/* Right: Auto Validation Badge & Rule Tag */}
          <div className="flex items-center gap-2.5">
            {enrollments.length > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold shadow-2xs"
                title={`Kế hoạch đăng ký hợp lệ với ${enrollments.length} môn học (${totalEnrolledCredits} tín chỉ)`}
              >
                <i className="fas fa-check-circle text-emerald-500 text-xs" />
                <span>Kế hoạch hợp lệ ({enrollments.length} môn - {totalEnrolledCredits} TC)</span>
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
              Hạn mức tối đa: {MAX_CREDITS} TC / học kỳ
            </span>
          </div>
        </div>
      </div>

      {/* KHU VỰC 1: Danh sách học phần mở đăng ký (Dạng Accordion thu gọn mặc định) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <i className="fas fa-layer-group text-indigo-600 text-base" />
              <span>Danh sách học phần mở đăng ký</span>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {isRegistrationLoading ? '(Đang tải...)' : `(${groups.length} học phần)`}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm vào tên môn học hoặc nút mở rộng để xem danh sách các lớp học phần đang mở (chọn tối đa 1 lớp / học phần)
            </p>
          </div>

          {/* Search, Filter & Accordion Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Tìm mã môn, tên học phần..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fas fa-xmark" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCourseFilter('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  courseFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({rawGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter('unregistered')}
                className={`px-3 py-1 rounded-lg transition ${
                  courseFilter === 'unregistered'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa chọn
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter('registered')}
                className={`px-3 py-1 rounded-lg transition ${
                  courseFilter === 'registered'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã chọn
              </button>
            </div>

            {/* Quick Expand / Collapse All buttons */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-xl">
              <button
                type="button"
                onClick={expandAllCourses}
                className="text-indigo-600 hover:text-indigo-800 font-semibold transition cursor-pointer"
                title="Mở rộng tất cả các lớp của các học phần"
              >
                Mở rộng tất cả
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={collapseAllCourses}
                className="text-slate-500 hover:text-slate-700 font-semibold transition cursor-pointer"
                title="Thu gọn danh sách lớp của tất cả học phần"
              >
                Thu gọn tất cả
              </button>
            </div>
          </div>
        </div>

        {isRegistrationLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden animate-pulse"
              >
                <div className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-52 bg-slate-200 rounded" />
                      <div className="h-3 w-28 bg-slate-200 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-24 bg-slate-200 rounded-full" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="h-10 bg-slate-50 rounded-xl" />
                  <div className="h-10 bg-slate-50 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-10 text-center text-gray-400 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <i className="fas fa-folder-open text-xl" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {searchQuery || courseFilter !== 'all'
                ? 'Không tìm thấy học phần nào phù hợp với bộ lọc tìm kiếm.'
                : studentDept
                ? `Hiện không có lớp học phần nào đang mở đăng ký cho ${studentDept}.`
                : 'Hiện không có lớp nào đang mở đăng ký.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {groups.map((group) => {
              const registeredInCourse = enrolledCourseIds.has(group.courseId);
              const enrolledClass = enrollments.find((e) => e.class?.courseId === group.courseId)?.class;
              const isExpanded = expandedCourses.has(group.courseId);
              const prereqCheck = checkCoursePrerequisites(group.prerequisites, passedCourseIds);

              return (
                <section
                  key={group.courseId}
                  className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200"
                >
                  {/* Course Header Bar (Accordion trigger & Course summary) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-slate-50 border-b border-indigo-100/70">
                    <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                      {/* Accordion toggle chevron button */}
                      <button
                        type="button"
                        onClick={() => toggleCourseExpanded(group.courseId)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition shadow-2xs cursor-pointer shrink-0"
                        title={isExpanded ? 'Thu gọn danh sách lớp' : 'Bấm để xem danh sách lớp học phần'}
                      >
                        <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                      </button>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-xs bg-indigo-100/90 text-indigo-700 px-2 py-0.5 rounded text-[11px] tracking-wide">
                            {group.courseId} · {group.credits} TÍN CHỈ
                          </span>
                          {group.department && (
                            <span className="text-[11px] font-semibold text-slate-600 bg-white/95 px-2 py-0.5 rounded border border-slate-200/80">
                              Khoa: {group.department}
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-indigo-700 bg-white/95 px-2 py-0.5 rounded border border-indigo-100">
                            {isGeneralEducation(group.department) ? 'Đại cương chung' : 'Chuyên ngành'}
                          </span>
                        </div>

                        {/* Click course title to toggle accordion */}
                        <button
                          type="button"
                          onClick={() => toggleCourseExpanded(group.courseId)}
                          className="text-base font-black text-slate-900 hover:text-indigo-600 transition flex items-center gap-2 group text-left cursor-pointer"
                          title={isExpanded ? 'Bấm để thu gọn danh sách lớp' : 'Bấm để xem các lớp học phần'}
                        >
                          <span>{group.courseName}</span>
                          <span className="text-xs text-slate-400 font-normal group-hover:text-indigo-500">
                            ({group.classes.length} lớp học phần)
                          </span>
                        </button>

                        {/* Cảnh báo môn học chưa hoàn thành điều kiện tiên quyết */}
                        {!prereqCheck.satisfied && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold shadow-2xs">
                            <i className="fas fa-triangle-exclamation text-amber-600 text-xs shrink-0" />
                            <span>{prereqCheck.message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side buttons & status */}
                    <div className="flex items-center gap-2.5">
                      {registeredInCourse && (
                        <span className="text-xs font-bold text-emerald-700 bg-white px-3 py-1 rounded-full border border-emerald-300 shadow-2xs inline-flex items-center gap-1.5">
                          <i className="fas fa-check text-emerald-500 text-xs" />
                          Đã chọn lớp: {enrolledClass?.id || ''}
                        </span>
                      )}

                      {/* Dedicated Course Detail Modal button */}
                      <button
                        type="button"
                        onClick={() => setCourseDetailModal(group)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-200/80 transition cursor-pointer shadow-2xs"
                        title="Xem chi tiết đề cương, số tiết và điều kiện tiên quyết"
                      >
                        <i className="fas fa-circle-info text-indigo-500 text-xs" />
                        <span>Xem chi tiết</span>
                      </button>

                      {/* Accordion toggle button */}
                      <button
                        type="button"
                        onClick={() => toggleCourseExpanded(group.courseId)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <span>{isExpanded ? 'Thu gọn lớp' : `Xem lớp (${group.classes.length})`}</span>
                        <i className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Accordion Content: Scrollable Class List Container (Chỉ hiển thị khi bung ra) */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/30 border-t border-slate-100 transition-all">
                      <div className="max-h-[380px] overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                        {group.classes.map((cls) => {
                          const isEnrolledThis = enrolledClassIds.has(cls._id);
                          const isEnrolledOther = registeredInCourse && !isEnrolledThis;
                          const thisEnrollment = enrollments.find((e) => e.class?._id === cls._id);

                          return (
                            <ClassRow
                              key={cls._id}
                              cls={cls}
                              pending={enroll.isPending}
                              state={{
                                enrolledThisClass: isEnrolledThis,
                                enrolledOtherInCourse: isEnrolledOther,
                              }}
                              prereqCheck={prereqCheck}
                              onEnroll={(c) => doEnroll(c, prereqCheck)}
                              onCancel={thisEnrollment ? () => doCancel(thisEnrollment) : null}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* KHU VỰC 2: Bảng tóm tắt các học phần đã đăng ký thành công */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <i className="fas fa-clipboard-check text-emerald-600 text-base" />
              <span>Học phần đã đăng ký</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {enrolledCourses.length} lớp
            </span>
          </div>
        </div>

        {/* Thông báo và Hủy nhanh nếu phát hiện học phần lệch chuyên ngành trong dữ liệu cũ */}
        {outOfDeptEnrollments.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                <i className="fas fa-filter-circle-xmark text-sm" />
              </div>
              <div>
                <p className="font-bold text-amber-900">
                  Đã tự động loại bỏ {outOfDeptEnrollments.length} môn học lệch chuyên ngành khỏi danh sách:
                </p>
                <p className="text-amber-700 mt-0.5">
                  {outOfDeptEnrollments
                    .map((e) => `${e.class?.id || e.classId} (${e.class?.courseName || e.class?.courseId})`)
                    .join(', ')}{' '}
                  — không thuộc khoa {studentDept || 'của bạn'}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {outOfDeptEnrollments.map((oe) => (
                <button
                  key={oe._id}
                  type="button"
                  onClick={() => doCancel(oe)}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  title={`Hủy bỏ lớp ${oe.class?.id || oe.classId} để làm sạch cơ sở dữ liệu`}
                >
                  <i className="fas fa-trash-can text-[10px]" />
                  <span>Hủy {oe.class?.id || oe.classId}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isRegistrationLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-12 flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-xs font-semibold text-slate-500 animate-pulse">
              Đang tải danh sách học phần đã đăng ký...
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <DataTable
              columns={enrolledColumns}
              rows={enrolledCourses}
              rowKey={(e) => e._id}
              emptyText="Chưa đăng ký học phần nào"
              minWidth="min-w-[850px]"
            />

          {/* Table Summary Footer */}
          {enrollments.length > 0 && (
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  Tổng số học phần: <strong className="text-slate-900">{enrollments.length}</strong> lớp
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1.5">
                  Tổng số tín chỉ: <strong className="text-slate-900">{totalEnrolledCredits}</strong> tín chỉ
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  Tổng học phí: <strong className="text-indigo-700 font-extrabold text-sm">{formatCurrency(totalTuitionFee)}</strong>
                </span>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                Hạn mức tối đa: {MAX_CREDITS} TC / học kỳ
              </span>
            </div>
          )}
        </div>
      )}
    </div>

      {/* Course Detail Information Modal */}
      {courseDetailModal && (
        <Modal
          open={Boolean(courseDetailModal)}
          onClose={() => setCourseDetailModal(null)}
          title={`Thông tin chi tiết học phần: ${courseDetailModal.courseName}`}
          size="lg"
        >
          <div className="p-6 space-y-5">
            {/* Course Hero Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-purple-50/40 border border-indigo-100">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-md">
                    {courseDetailModal.courseId}
                  </span>
                  <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                    {courseDetailModal.credits} Tín chỉ
                  </span>
                  {courseDetailModal.department && (
                    <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      Khoa: {courseDetailModal.department}
                    </span>
                  )}
                </div>
                <h4 className="text-xl font-black text-slate-900 mt-1">
                  {courseDetailModal.courseName}
                </h4>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-medium block">Loại học phần</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100 mt-0.5">
                  <i className="fas fa-book-bookmark text-[10px]" />
                  {isGeneralEducation(courseDetailModal.department) ? 'Đại cương chung' : 'Chuyên ngành'}
                </span>
              </div>
            </div>

            {/* Grid of Key Info: Credits & Periods allocation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                  <i className="fas fa-clock text-indigo-500" />
                  <span>Tổng thời lượng</span>
                </div>
                <div className="text-lg font-black text-slate-900">
                  {courseDetailModal.credits * 15} tiết
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">15 tiết chuẩn / tín chỉ</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                  <i className="fas fa-chalkboard-user text-emerald-500" />
                  <span>Lý thuyết (LT)</span>
                </div>
                <div className="text-lg font-black text-emerald-700">
                  {Math.round(courseDetailModal.credits * 10)} tiết
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Giảng đường & tương tác</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                  <i className="fas fa-laptop-code text-blue-500" />
                  <span>Thực hành (TH)</span>
                </div>
                <div className="text-lg font-black text-blue-700">
                  {Math.max(0, courseDetailModal.credits * 15 - Math.round(courseDetailModal.credits * 10))} tiết
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Bài tập & thảo luận nhóm</p>
              </div>
            </div>

            {/* Prerequisites & Description */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-1 text-xs">
                  <i className="fas fa-link text-indigo-500" />
                  <span>Điều kiện tiên quyết:</span>
                </h5>
                <p className="text-slate-600 leading-relaxed font-medium">
                  {courseDetailModal.prerequisites || 'Không yêu cầu học phần tiên quyết (Sinh viên được phép đăng ký trực tiếp).'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-1 text-xs">
                  <i className="fas fa-align-left text-indigo-500" />
                  <span>Mô tả tóm tắt học phần:</span>
                </h5>
                <p className="text-slate-600 leading-relaxed">
                  {courseDetailModal.description ||
                    `Học phần ${courseDetailModal.courseName} (${courseDetailModal.courseId}) trang bị cho sinh viên hệ thống kiến thức toàn diện, nền tảng lý thuyết vững chắc cùng các kỹ năng thực tế cần thiết đáp ứng chuẩn đầu ra của chương trình đào tạo.`}
                </p>
              </div>

              {/* Grade Distribution weights */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2 text-xs">
                  <i className="fas fa-chart-pie text-indigo-500" />
                  <span>Cơ cấu đánh giá kết quả học phần:</span>
                </h5>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
                    Chuyên cần: <strong>10%</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
                    Bài tập / Quiz: <strong>10%</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
                    Kiểm tra giữa kỳ: <strong>30%</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
                    Thi kết thúc học phần: <strong>50%</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Đang có <strong>{courseDetailModal.classes?.length || 0}</strong> lớp học phần mở đăng ký
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
    </div>
  );
}

export default StudentCourseRegistration;
