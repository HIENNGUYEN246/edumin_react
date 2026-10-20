import { AppError } from '../../lib/AppError.js';
import { dayLabel, rangesOverlap, shiftLabel, slotsClash } from '../../lib/schedule.js';
import { isRegistrationWindowActive, isRegistrationWindowExpired } from '../../lib/dateOnly.js';
import { closeExpiredClasses } from '../classes/courseClass.service.js';
import { ROLES } from '../../lib/roles.js';
import { sendClassAssignedEmail } from '../../lib/mailer.js';
import { Enrollment } from './enrollment.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { Student } from '../students/student.model.js';
import { buildDepartmentMatcher } from '../../lib/department.js';

async function requireStudent(user) {
  let student = user.student ? await Student.findById(user.student).populate('departmentRef', 'id name') : null;
  if (!student && user._id) {
    student = await Student.findOne({ userId: user._id }).populate('departmentRef', 'id name');
  }
  if (!student) throw AppError.notFound('Không tìm thấy hồ sơ sinh viên');
  return student;
}

/**
 * Validates if the student has completed and passed (score >= 4.0) all prerequisite courses.
 */
export async function checkStudentPrerequisites(studentId, prerequisites) {
  if (!prerequisites || typeof prerequisites !== 'string') return { satisfied: true };
  const trimmed = prerequisites.trim();
  if (!trimmed) return { satisfied: true };
  const lower = trimmed.toLowerCase();
  if (lower === 'không' || lower === 'không có' || lower === 'none' || lower === 'n/a') {
    return { satisfied: true };
  }

  const tokens = trimmed.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return { satisfied: true };

  const enrollments = await Enrollment.find({ student: studentId })
    .populate('classRef')
    .lean();

  const passedCourseIds = new Set();
  for (const enr of enrollments) {
    const cls = enr.classRef;
    if (!cls || !cls.courseId) continue;

    let score = null;
    if (enr.finalScore != null && !isNaN(enr.finalScore)) {
      score = Number(enr.finalScore);
    } else if (enr.manualGrades) {
      const mg = enr.manualGrades;
      const valid = [mg.final, mg.midterm, mg.assignment, mg.attendance].filter(
        (g) => g != null && !isNaN(g)
      );
      if (valid.length > 0) {
        score = valid.reduce((a, b) => a + Number(b), 0) / valid.length;
      }
    }

    if (score != null && Number.isFinite(score) && score >= 4.0) {
      passedCourseIds.add(cls.courseId.trim());
      passedCourseIds.add(cls.courseId.trim().toLowerCase());
    }
  }

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
      missing: missing.join(', '),
      message: `Yêu cầu hoàn thành môn tiên quyết: ${missing.join(', ')} trước khi đăng ký`,
    };
  }

  return { satisfied: true };
}

/** Classes the student is enrolled in, with the class details attached. */
export async function listMyEnrollments(user) {
  await closeExpiredClasses();
  const student = await requireStudent(user);
  const enrollments = await Enrollment.find({ student: student._id })
    .populate({
      path: 'classRef',
      populate: [
        { path: 'courseRef', select: 'id name credits fee department prerequisites description' },
        { path: 'teacherRef', select: 'id hoTen avatar email phone education department' },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();
  // Drop enrollments whose class was deleted; expose the class object as `class`.
  const validEnrollments = enrollments.filter((e) => e.classRef);
  if (validEnrollments.length === 0) return [];

  // Query submissions and assignments for this student to sync quiz/assignment scores
  const { Submission, Assignment } = await import('../assignments/assignment.model.js');
  const courseIds = [...new Set(validEnrollments.map((e) => e.classRef?.courseId || e.classRef?.courseRef?.id).filter(Boolean))];
  const classCodes = [...new Set(validEnrollments.map((e) => e.classId).filter(Boolean))];

  const studentSubmissions = await Submission.find({ student: student._id }).select('assignmentRef score student answers').lean();
  const subMap = new Map();
  for (const sub of studentSubmissions) {
    subMap.set(String(sub.assignmentRef), sub);
  }

  const assignments = await Assignment.find({
    $or: [
      { courseId: { $in: courseIds } },
      { classId: { $in: classCodes } },
    ],
  }).select('_id courseId classId type dueDate').lean();

  return validEnrollments.map((e) => {
    const cls = e.classRef;
    const courseId = cls.courseId || cls.courseRef?.id;
    const classCode = e.classId;

    // Filter assignments matching this course or class
    const courseAssignments = assignments.filter((a) =>
      (a.courseId && a.courseId === courseId) || (a.classId && a.classId === classCode)
    );

    const quizSubmissions = courseAssignments
      .map((a) => subMap.get(String(a._id)))
      .filter((sub) => sub && sub.score != null);

    const autoQuizScore = quizSubmissions.length > 0
      ? Number((quizSubmissions.reduce((sum, s) => sum + s.score, 0) / quizSubmissions.length).toFixed(1))
      : null;

    const manual = e.manualGrades || {};
    const effectiveQuizScore = manual.assignment ?? manual.homework ?? autoQuizScore ?? null;

    const manualGrades = {
      ...manual,
      assignment: effectiveQuizScore,
      homework: effectiveQuizScore,
      quizScore: effectiveQuizScore,
    };

    return {
      _id: e._id,
      classId: e.classId,
      enrolledAt: e.createdAt,
      class: {
        ...cls,
        isGradeLocked: Boolean(cls.isGradeLocked),
      },
      manualGrades,
      quizScore: effectiveQuizScore,
      assignmentScore: effectiveQuizScore,
      homeworkGrade: effectiveQuizScore,
      isGradeLocked: Boolean(cls.isGradeLocked),
      finalScore: e.finalScore,
    };
  });
}

export async function enroll(user, classId) {
  await closeExpiredClasses();
  const student = await requireStudent(user);
  const target = await CourseClass.findById(classId).populate('courseRef');
  if (!target) throw AppError.notFound('Không tìm thấy lớp học phần');

  // A class is open for registration solely based on its status.
  if (target.status !== 'Đang mở') {
    throw AppError.conflict('Lớp hiện không mở đăng ký');
  }
  if (!isRegistrationWindowActive(target)) {
    throw AppError.conflict('Chưa đến thời gian đăng ký lớp học phần');
  }

  // Department check: student can only enroll in classes belonging to their own department
  const studentDept = student.department || user.department || user.khoa || student.departmentRef?.name || student.departmentRef?.id;
  const classDept = target.department || target.courseRef?.department;
  if (studentDept && classDept) {
    const matchDept = await buildDepartmentMatcher(studentDept, student.departmentRef);
    if (!matchDept(classDept)) {
      throw AppError.badRequest('Bạn chỉ có thể đăng ký các lớp học phần thuộc khoa của mình');
    }
  }

  // Prerequisite check: student must have completed and passed prerequisite courses (score >= 4.0)
  const prereq = target.courseRef?.prerequisites || target.prerequisites;
  if (prereq && typeof prereq === 'string' && prereq.trim()) {
    const prereqCheck = await checkStudentPrerequisites(student._id, prereq);
    if (!prereqCheck.satisfied) {
      throw AppError.badRequest(prereqCheck.message);
    }
  }

  const existing = await Enrollment.findOne({ student: student._id, classRef: target._id });
  if (existing) throw AppError.conflict('Bạn đã đăng ký lớp học phần này');

  // Capacity: 0 means unlimited. Reject when the class is full.
  if (target.capacity && target.capacity > 0) {
    const enrolled = await Enrollment.countDocuments({ classRef: target._id });
    if (enrolled >= target.capacity) {
      throw AppError.conflict('Lớp đã đủ sĩ số');
    }
  }

  // One class per course: a student may only take one class of a given course.
  const current = await Enrollment.find({ student: student._id }).populate('classRef').lean();
  const sameCourse = current.find((e) => e.classRef && e.classRef.courseId === target.courseId);
  if (sameCourse) {
    throw AppError.conflict('Bạn đã đăng ký một lớp của học phần này');
  }

  // Credit limit check: maximum 25 credits per semester
  const MAX_CREDITS = 25;
  const currentCredits = current.reduce((sum, e) => sum + (Number(e.classRef?.credits) || 0), 0);
  const targetCredits = Number(target.credits) || 0;
  if (currentCredits + targetCredits > MAX_CREDITS) {
    throw AppError.badRequest(
      `Vượt quá giới hạn tín chỉ tối đa (${MAX_CREDITS} tín chỉ/học kỳ). Hiện tại: ${currentCredits} tín chỉ, lớp này: ${targetCredits} tín chỉ.`
    );
  }

  // Reject if the new class clashes with any already-enrolled class slot.
  const scheduleClash = current
    .filter((enrollment) =>
      enrollment.classRef &&
      rangesOverlap(target.studyStart, target.studyEnd, enrollment.classRef.studyStart, enrollment.classRef.studyEnd)
    )
    .flatMap((enrollment) =>
      (target.schedules || [])
        .map((targetSlot) => ({
          enrollment,
          targetSlot,
          existingSlot: (enrollment.classRef.schedules || []).find((slot) => slotsClash(targetSlot, slot)),
        }))
        .filter((clash) => clash.existingSlot)
    )[0];
  if (scheduleClash) {
    const conflictingClass = scheduleClash.enrollment.classRef;
    const classLabel = conflictingClass.className
      ? `${conflictingClass.id} (${conflictingClass.className})`
      : conflictingClass.id;
    const timeLabel = `${dayLabel(scheduleClash.targetSlot.dayId)}, ${shiftLabel(scheduleClash.targetSlot.shiftId)}`;
    throw AppError.conflict(
      `Học phần bị trùng lịch (${timeLabel}) với lớp học phần đã đăng ký: ${classLabel}.`
    );
  }

  try {
    const created = await Enrollment.create({ student: student._id, classRef: target._id, classId: target.id });

    if (student.email) {
      sendClassAssignedEmail({
        email: student.email,
        hoTen: student.hoTen,
        role: ROLES.STUDENT,
        classId: target.id,
        className: target.className,
        courseId: target.courseId,
        courseName: target.courseName,
        schedules: target.schedules,
        room: target.room,
      }).catch((err) => console.error('[MAILER ERROR]', err));
    }

    return { _id: created._id, classId: target.id, enrolledAt: created.createdAt, class: target.toObject() };
  } catch (error) {
    if (error?.code === 11000) throw AppError.conflict('Bạn đã đăng ký lớp học phần này');
    throw error;
  }
}

export async function cancel(user, classId) {
  const now = new Date();
  await closeExpiredClasses(now);
  const student = await requireStudent(user);
  const target = await CourseClass.findById(classId);

  // Students may self-cancel only while the class is still open. If the class
  // was removed by an admin, still let them clean up the orphan enrollment.
  if (target && (target.status !== 'Đang mở' || isRegistrationWindowExpired(target, now))) {
    throw AppError.conflict('Lớp đã đóng đăng ký, không thể tự hủy');
  }

  const deleted = await Enrollment.findOneAndDelete({ student: student._id, classRef: classId });
  if (!deleted) throw AppError.notFound('Đăng ký không tồn tại');
  return { success: true };
}
