import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { findScheduleConflict, validateSchedules } from '../../lib/schedule.js';
import {
  isRegistrationWindowActive,
  isRegistrationWindowExpired,
  normalizeRegistrationDateTime,
  currentDateTimeString,
  todayDateString,
} from '../../lib/dateOnly.js';
import { ROLES } from '../../lib/roles.js';
import { CourseClass } from './courseClass.model.js';
import { Course } from '../courses/course.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Assignment, Submission } from '../assignments/assignment.model.js';
import { Attendance } from '../attendance/attendance.model.js';
import { GradeAuditLog } from './gradeAuditLog.model.js';
import { sendClassAssignedEmail } from '../../lib/mailer.js';

const POPULATE = [
  { path: 'courseRef', select: 'id name credits fee department' },
  { path: 'teacherRef', select: 'id hoTen avatar email phone education department' },
  { path: 'midtermQuizId', select: '_id id title dueDate questions status' },
  { path: 'finalQuizId', select: '_id id title dueDate questions status' },
];

function isPastDue(assignment, now = new Date()) {
  if (!assignment.dueDate) return false;
  const deadline = new Date(`${assignment.dueDate}T23:59:59`);
  return !Number.isNaN(deadline.valueOf()) && now > deadline;
}

/**
 * Resolve the course and teacher for a class and build the denormalized
 * fields the schedule/enrollment logic reads.
 */
async function buildClassFields(payload) {
  const course = await Course.findOne({ id: payload.courseId });
  if (!course) throw AppError.badRequest('Học phần không tồn tại');

  let teacher = null;
  if (payload.teacherId != null) {
    teacher = await Teacher.findOne({ id: Number(payload.teacherId) });
    if (!teacher) throw AppError.badRequest('Giáo viên không tồn tại');

    // Ensure teacher belongs to the same department as the course
    if (course.department && teacher.department) {
      const courseDept = course.department.trim().toLowerCase();
      const teacherDept = teacher.department.trim().toLowerCase();
      if (courseDept !== teacherDept) {
        throw AppError.badRequest(
          `Giảng viên "${teacher.hoTen}" thuộc khoa "${teacher.department}", không thuộc khoa "${course.department}" của học phần này`
        );
      }
    }
  }

  if (!validateSchedules(payload.schedules)) {
    throw AppError.badRequest('Lịch học không hợp lệ');
  }

  const creditPrice = 500000;
  const autoFee = (course.credits || 0) * creditPrice;
  const fee = (payload.fee !== undefined && payload.fee !== null && payload.fee !== '')
    ? Number(payload.fee)
    : (course.fee != null && course.fee > 0 ? course.fee : autoFee);

  return {
    courseRef: course._id,
    courseId: course.id,
    courseName: course.name,
    className: payload.className?.trim() || '',
    department: course.department || '',
    credits: course.credits,
    fee,
    teacherRef: teacher?._id || null,
    teacherId: teacher?.id ?? null,
    teacher: teacher?.hoTen || '',
    room: payload.room?.trim() || '',
    capacity: Number.isFinite(Number(payload.capacity)) ? Number(payload.capacity) : 0,
    schedules: payload.schedules,
    studyStart: payload.studyStart || '',
    studyEnd: payload.studyEnd || '',
    registrationStart: payload.registrationStart || '',
    registrationEnd: payload.registrationEnd || '',
    gradeWeights: payload.gradeWeights || course.gradeWeights || {
      attendance: 10,
      homework: 10,
      midterm: 30,
      presentation: 0,
      final: 50,
    },
    midtermQuizId: payload.midtermQuizId ? payload.midtermQuizId : null,
    finalQuizId: payload.finalQuizId ? payload.finalQuizId : null,
    status: payload.status || 'Nháp',
  };
}

export async function closeExpiredClasses(now = new Date()) {
  const openClasses = await CourseClass.find({ status: 'Đang mở' }).select('_id registrationStart registrationEnd').lean();
  const expiredIds = openClasses
    .filter((cls) => isRegistrationWindowExpired(cls, now))
    .map((cls) => cls._id);
  if (!expiredIds.length) return 0;
  const result = await CourseClass.updateMany(
    { _id: { $in: expiredIds }, status: 'Đang mở' },
    { $set: { status: 'Đã đóng' } }
  );
  return result.modifiedCount;
}

/** Attach a live enrolledCount to a class object (or array of them). */
async function withEnrolledCount(classes) {
  const list = Array.isArray(classes) ? classes : [classes];
  const Enrollment = mongoose.model('Enrollment');
  const counts = await Enrollment.aggregate([
    { $match: { classRef: { $in: list.map((c) => c._id) } } },
    { $group: { _id: '$classRef', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  const mapped = list.map((c) => ({ ...c, enrolledCount: byId.get(String(c._id)) || 0 }));
  return Array.isArray(classes) ? mapped : mapped[0];
}

/** Reject teacher/room double-booking against every other active class. */
async function assertNoConflict(fields, excludeId) {
  const filter = { status: { $ne: 'Đã hủy' } };
  if (excludeId) filter._id = { $ne: excludeId };
  const others = await CourseClass.find(filter).lean();
  const reason = findScheduleConflict(fields, others);
  if (reason) throw AppError.conflict(reason);
}

export async function listClasses(query, requester) {
  await closeExpiredClasses();
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: '-createdAt' });
  const filter = searchFilter(search, ['id', 'courseName', 'className', 'teacher', 'room']);

  // Teachers can scope to their own classes via ?teacher=me.
  if (query.teacher === 'me' && requester?.role === ROLES.TEACHER) {
    const teacher = await Teacher.findById(requester.teacher).lean();
    filter.teacherRef = teacher?._id || null;
  } else if (query.courseId) {
    filter.courseId = query.courseId;
  }
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = query.department;

  const result = await paginate(CourseClass, { filter, page, limit, skip, sort, populate: POPULATE });
  result.data = await withEnrolledCount(result.data);
  return result;
}

/** Group students by administrative class (className) for the class management overview */
export async function listStudentClassesSummary() {
  const Student = mongoose.model('Student');
  const summary = await Student.aggregate([
    {
      $group: {
        _id: { $ifNull: ['$className', 'Chưa phân lớp'] },
        studentCount: { $sum: 1 },
        departments: { $addToSet: '$department' },
        students: {
          $push: {
            _id: '$_id',
            id: '$id',
            hoTen: '$hoTen',
            email: '$email',
            gender: '$gender',
            dob: '$dob',
            phone: '$phone',
            avatar: '$avatar',
            department: '$department',
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    data: summary.map((g) => ({
      className: g._id === '' ? 'Chưa phân lớp' : g._id,
      studentCount: g.studentCount,
      department: g.departments.filter(Boolean).join(', ') || 'Chung',
      students: g.students,
    })),
  };
}

/** All classes of a course (for the admin course-detail page), with counts. */
export async function listClassesByCourse(courseId) {
  await closeExpiredClasses();
  const classes = await CourseClass.find({ courseId }).sort({ id: 1 }).populate(POPULATE).lean();
  return { data: await withEnrolledCount(classes) };
}

/** Classes currently within their registration window, with enrolled counts. */
export async function listOpenClasses() {
  const now = new Date();
  await closeExpiredClasses(now);
  const classes = await CourseClass.find({ status: 'Đang mở' }).populate(POPULATE).lean();
  return withEnrolledCount(classes.filter((cls) => isRegistrationWindowActive(cls, now)));
}

export async function getClass(id) {
  await closeExpiredClasses();
  const doc = await CourseClass.findById(id).populate(POPULATE).lean();
  if (!doc) throw AppError.notFound('Không tìm thấy lớp học phần');
  return withEnrolledCount(doc);
}

/** Change only the lifecycle status of a class. */
export async function changeStatus(id, status) {
  await closeExpiredClasses();
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');
  if (status === 'Đang mở' && isRegistrationWindowExpired(cls)) {
    throw AppError.conflict('Không thể mở lại lớp vì thời gian đăng ký đã kết thúc');
  }
  cls.status = status;
  await cls.save();
  return withEnrolledCount(await CourseClass.findById(cls._id).populate(POPULATE).lean());
}

export function validate15Weeks(studyStart, studyEnd) {
  if (!studyStart || !studyEnd) return;
  const [sy, sm, sd] = studyStart.split('-').map(Number);
  const [ey, em, ed] = studyEnd.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return;

  const minEndDate = new Date(sy, sm - 1, sd);
  minEndDate.setDate(minEndDate.getDate() + 15 * 7);
  const endDate = new Date(ey, em - 1, ed);

  if (endDate < minEndDate) {
    const formattedMin = `${String(minEndDate.getDate()).padStart(2, '0')}/${String(minEndDate.getMonth() + 1).padStart(2, '0')}/${minEndDate.getFullYear()}`;
    throw AppError.badRequest(
      `Ngày kết thúc học phần bắt buộc phải diễn ra sau ít nhất 15 tuần kể từ ngày bắt đầu (tối thiểu từ ngày ${formattedMin})`
    );
  }
}

export async function generateClassId(courseId) {
  if (!courseId) {
    const total = await CourseClass.countDocuments();
    return `LHP-${String(total + 1).padStart(2, '0')}`;
  }
  const cleanCourseId = String(courseId).trim().toUpperCase();
  const existingClasses = await CourseClass.find({
    $or: [
      { courseId: cleanCourseId },
      { id: { $regex: `^${cleanCourseId}-\\d+`, $options: 'i' } },
    ],
  }).select('id').lean();

  let maxNum = 0;
  const regex = new RegExp(`^${cleanCourseId}-(\\d+)$`, 'i');
  for (const c of existingClasses) {
    const match = c.id?.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  let candidate = `${cleanCourseId}-${String(nextNum).padStart(2, '0')}`;

  let counter = nextNum;
  while (await CourseClass.exists({ id: candidate })) {
    counter += 1;
    candidate = `${cleanCourseId}-${String(counter).padStart(2, '0')}`;
  }
  return candidate;
}

export async function createClass(payload) {
  let classId = payload.id?.trim();
  if (!classId) {
    classId = await generateClassId(payload.courseId);
  }
  const exists = await CourseClass.findOne({ id: classId });
  if (exists) throw AppError.conflict('Mã lớp đã tồn tại');

  if (payload.studyStart && payload.studyEnd) {
    validate15Weeks(payload.studyStart, payload.studyEnd);
  }
  if (payload.studyStart < todayDateString()) {
    throw AppError.badRequest('Ngày bắt đầu học không được ở quá khứ');
  }

  const fields = await buildClassFields({ ...payload, id: classId });
  const isTimeStart = fields.registrationStart.includes('T');
  if (isTimeStart) {
    if (normalizeRegistrationDateTime(fields.registrationStart) < currentDateTimeString()) {
      throw AppError.badRequest('Thời gian bắt đầu đăng ký không được ở quá khứ');
    }
  } else if (fields.registrationStart && fields.registrationStart.slice(0, 10) < todayDateString()) {
    throw AppError.badRequest('Thời gian bắt đầu đăng ký không được ở quá khứ');
  }
  if (fields.registrationEnd <= fields.registrationStart) {
    throw AppError.badRequest('Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký');
  }
  if (fields.studyStart && fields.registrationEnd) {
    if (fields.studyStart.slice(0, 10) <= fields.registrationEnd.slice(0, 10)) {
      throw AppError.badRequest('Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký');
    }
  }
  await assertNoConflict(fields);
  const created = await CourseClass.create({ id: classId, ...fields });
  const result = await withEnrolledCount(await CourseClass.findById(created._id).populate(POPULATE).lean());

  if (result?.teacherRef?.email) {
    sendClassAssignedEmail({
      email: result.teacherRef.email,
      hoTen: result.teacherRef.hoTen || result.teacher,
      role: ROLES.TEACHER,
      classId: result.id,
      className: result.className,
      courseId: result.courseId,
      courseName: result.courseName,
      schedules: result.schedules,
      room: result.room,
    }).catch((err) => console.error('[MAILER ERROR]', err));
  }

  return result;
}

export async function updateClass(id, payload) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');
  const prevTeacherId = cls.teacherId;

  const start = payload.studyStart !== undefined ? payload.studyStart : cls.studyStart;
  const end = payload.studyEnd !== undefined ? payload.studyEnd : cls.studyEnd;
  if (start && end) {
    validate15Weeks(start, end);
  }

  // Merge existing values so a partial update still passes the conflict check.
  const merged = {
    courseId: payload.courseId || cls.courseId,
    className: payload.className !== undefined ? payload.className : cls.className,
    teacherId: payload.teacherId !== undefined ? payload.teacherId : cls.teacherId,
    room: payload.room !== undefined ? payload.room : cls.room,
    capacity: payload.capacity !== undefined ? payload.capacity : cls.capacity,
    fee: payload.fee !== undefined ? payload.fee : cls.fee,
    schedules: payload.schedules || cls.schedules,
    studyStart: payload.studyStart !== undefined ? payload.studyStart : cls.studyStart,
    studyEnd: payload.studyEnd !== undefined ? payload.studyEnd : cls.studyEnd,
    registrationStart: payload.registrationStart !== undefined ? payload.registrationStart : cls.registrationStart,
    registrationEnd: payload.registrationEnd !== undefined ? payload.registrationEnd : cls.registrationEnd,
    gradeWeights: payload.gradeWeights !== undefined ? payload.gradeWeights : cls.gradeWeights,
    midtermQuizId: payload.midtermQuizId !== undefined ? payload.midtermQuizId : cls.midtermQuizId,
    finalQuizId: payload.finalQuizId !== undefined ? payload.finalQuizId : cls.finalQuizId,
    status: payload.status || cls.status,
  };
  if (
    merged.registrationStart &&
    merged.registrationEnd &&
    merged.registrationEnd <= merged.registrationStart
  ) {
    throw AppError.badRequest('Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký');
  }
  if (
    merged.studyStart &&
    merged.registrationEnd &&
    merged.studyStart.slice(0, 10) <= merged.registrationEnd.slice(0, 10)
  ) {
    throw AppError.badRequest('Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký');
  }
  const fields = await buildClassFields(merged);
  await assertNoConflict(fields, cls._id);
  Object.assign(cls, fields);
  await cls.save();
  const updatedResult = await withEnrolledCount(await CourseClass.findById(cls._id).populate(POPULATE).lean());

  if (fields.teacherId && fields.teacherId !== prevTeacherId && updatedResult?.teacherRef?.email) {
    sendClassAssignedEmail({
      email: updatedResult.teacherRef.email,
      hoTen: updatedResult.teacherRef.hoTen || updatedResult.teacher,
      role: ROLES.TEACHER,
      classId: updatedResult.id,
      className: updatedResult.className,
      courseId: updatedResult.courseId,
      courseName: updatedResult.courseName,
      schedules: updatedResult.schedules,
      room: updatedResult.room,
    }).catch((err) => console.error('[MAILER ERROR]', err));
  }

  return updatedResult;
}

export function calculateWeightedGpa(grades, weights) {
  if (!grades) return null;
  const currentWeights = {
    attendance: 10,
    homework: 10,
    midterm: 30,
    presentation: 0,
    final: 50,
    ...weights,
  };
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let hasAnyScore = false;

  for (const key of ['attendance', 'homework', 'midterm', 'presentation', 'final']) {
    const weight = Number(currentWeights[key] ?? 0);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const rawVal = grades[key];
    if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
      const score = Number(rawVal);
      if (!Number.isNaN(score) && Number.isFinite(score)) {
        totalWeightedScore += score * weight;
        totalWeight += weight;
        hasAnyScore = true;
      }
    }
  }

  if (!hasAnyScore || totalWeight <= 0) return null;
  const gpa = totalWeightedScore / totalWeight;
  if (!Number.isFinite(gpa) || Number.isNaN(gpa)) return null;
  return Number(gpa.toFixed(2));
}

/**
 * List students enrolled in a class. Teachers may only view classes they
 * teach; admins may view any.
 */
export async function listClassStudents(classId, requester) {
  const cls = mongoose.isValidObjectId(classId)
    ? await CourseClass.findById(classId).populate(POPULATE)
    : await CourseClass.findOne({ id: classId }).populate(POPULATE);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  if (requester.role === ROLES.TEACHER) {
    const teacher = await Teacher.findById(requester.teacher);
    if (!teacher || String(cls.teacherRef?._id || cls.teacherRef) !== String(teacher._id)) {
      throw AppError.forbidden('Bạn không phụ trách lớp này');
    }
  }

  const enrollments = await Enrollment.find({ classRef: cls._id })
    .populate({ path: 'student', select: 'id hoTen email className department avatar' })
    .lean();
  const students = enrollments.map((enrollment) => enrollment.student).filter(Boolean);

  // 1. Quizzes of this course
  const allCourseQuizzes = await Assignment.find({
    courseId: cls.courseId,
    type: 'quiz',
  }).select('_id id title dueDate questions status createdByRef').sort({ createdAt: -1 }).lean();

  const midtermQuizIdStr = cls.midtermQuizId?._id ? String(cls.midtermQuizId._id) : (cls.midtermQuizId ? String(cls.midtermQuizId) : null);
  const finalQuizIdStr = cls.finalQuizId?._id ? String(cls.finalQuizId._id) : (cls.finalQuizId ? String(cls.finalQuizId) : null);

  const midtermQuiz = midtermQuizIdStr
    ? allCourseQuizzes.find((q) => String(q._id) === midtermQuizIdStr) || await Assignment.findById(midtermQuizIdStr).lean()
    : null;
  const finalQuiz = finalQuizIdStr
    ? allCourseQuizzes.find((q) => String(q._id) === finalQuizIdStr) || await Assignment.findById(finalQuizIdStr).lean()
    : null;

  // Regular homework quizzes: exclude midterm and final linked quizzes
  const excludedQuizIds = new Set([midtermQuizIdStr, finalQuizIdStr].filter(Boolean));

  const teacherRefIdStr = cls.teacherRef?._id ? String(cls.teacherRef._id) : (cls.teacherRef ? String(cls.teacherRef) : null);
  const homeworkQuizAssignments = allCourseQuizzes.filter((q) => {
    if (excludedQuizIds.has(String(q._id))) return false;
    if (teacherRefIdStr && q.createdByRef && String(q.createdByRef) !== teacherRefIdStr) return false;
    return true;
  });

  const homeworkQuizIds = homeworkQuizAssignments.map((a) => a._id);
  const expiredHomeworkQuizIds = homeworkQuizAssignments
    .filter((a) => isPastDue(a))
    .map((a) => String(a._id));

  // Submissions for homework and linked midterm/final quizzes
  const allNeededQuizIds = Array.from(new Set([
    ...homeworkQuizIds.map(String),
    ...(midtermQuiz ? [String(midtermQuiz._id)] : []),
    ...(finalQuiz ? [String(finalQuiz._id)] : []),
  ])).map((id) => new mongoose.Types.ObjectId(id));

  const submissions = allNeededQuizIds.length && students.length
    ? await Submission.find({
        assignmentRef: { $in: allNeededQuizIds },
        student: { $in: students.map((s) => s._id) },
      }).select('student assignmentRef score').lean()
    : [];

  const submissionsByStudentAndQuiz = new Map();
  for (const submission of submissions) {
    const key = `${submission.student}_${submission.assignmentRef}`;
    submissionsByStudentAndQuiz.set(key, submission);
  }

  // 2. Attendance records for this class
  const attendanceRecords = await Attendance.find({
    $or: [{ classRef: cls._id }, { regId: cls.id }],
  }).lean();

  const weights = cls.gradeWeights || { attendance: 10, homework: 10, midterm: 30, presentation: 0, final: 50 };

  const studentsWithGrades = enrollments
    .filter((enrollment) => enrollment.student)
    .map((enrollment) => {
      const student = enrollment.student;
      const sRefStr = String(student._id);
      const sIdNum = Number(student.id);

      // --- Attendance calculation ---
      const studentAttRecords = attendanceRecords.filter((r) =>
        (r.studentRef && String(r.studentRef) === sRefStr) ||
        (r.studentId != null && Number(r.studentId) === sIdNum)
      );

      let present = 0;
      let late = 0;
      let excused = 0;
      let absent = 0;
      for (const r of studentAttRecords) {
        if (r.status === 'Có mặt') present += 1;
        else if (r.status === 'Đi muộn') late += 1;
        else if (r.status === 'Vắng có phép') excused += 1;
        else if (r.status === 'Vắng mặt') absent += 1;
      }
      const totalAtt = studentAttRecords.length;
      const attRate = totalAtt > 0 ? Number((((present + 0.5 * late) / totalAtt) * 100).toFixed(1)) : 100;
      const autoAttendanceScore = totalAtt > 0 ? Number((((present + 0.5 * late) / totalAtt) * 10).toFixed(1)) : null;

      const manualAttendance = enrollment.manualGrades?.attendance ?? null;
      const effectiveAttendance = manualAttendance !== null ? manualAttendance : autoAttendanceScore;

      // --- Homework calculation ---
      const hwScores = [];
      const submittedHwQuizIds = new Set();
      for (const a of homeworkQuizAssignments) {
        const sub = submissionsByStudentAndQuiz.get(`${student._id}_${a._id}`);
        if (sub) {
          submittedHwQuizIds.add(String(a._id));
          if (sub.score != null) hwScores.push(sub.score);
        }
      }
      const missedHwQuizCount = expiredHomeworkQuizIds.filter((id) => !submittedHwQuizIds.has(id)).length;
      const homeworkQuizCount = hwScores.length + missedHwQuizCount;
      const homeworkGrade = homeworkQuizCount
        ? Number((hwScores.reduce((sum, score) => sum + score, 0) / homeworkQuizCount).toFixed(1))
        : null;

      // --- Midterm calculation ---
      let quizMidtermScore = null;
      if (midtermQuiz) {
        const sub = submissionsByStudentAndQuiz.get(`${student._id}_${midtermQuiz._id}`);
        if (sub && sub.score != null) {
          quizMidtermScore = sub.score;
        } else if (isPastDue(midtermQuiz)) {
          quizMidtermScore = 0;
        }
      }
      const manualMidterm = enrollment.manualGrades?.midterm ?? null;
      const effectiveMidterm = manualMidterm !== null ? manualMidterm : quizMidtermScore;

      // --- Final calculation ---
      let quizFinalScore = null;
      if (finalQuiz) {
        const sub = submissionsByStudentAndQuiz.get(`${student._id}_${finalQuiz._id}`);
        if (sub && sub.score != null) {
          quizFinalScore = sub.score;
        } else if (isPastDue(finalQuiz)) {
          quizFinalScore = 0;
        }
      }
      const manualFinal = enrollment.manualGrades?.final ?? null;
      const effectiveFinal = manualFinal !== null ? manualFinal : quizFinalScore;

      const manualPresentation = enrollment.manualGrades?.presentation ?? null;

      const studentGrades = {
        attendance: effectiveAttendance,
        midterm: effectiveMidterm,
        final: effectiveFinal,
        presentation: manualPresentation,
        homework: homeworkGrade,
      };

      const finalScore = calculateWeightedGpa(studentGrades, weights);

      return {
        ...student,
        manualGrades: enrollment.manualGrades || {},
        effectiveGrades: studentGrades,
        attendanceStats: {
          total: totalAtt,
          present,
          late,
          excused,
          absent,
          rate: attRate,
          autoScore: autoAttendanceScore,
          isOverridden: manualAttendance !== null,
        },
        quizMidterm: midtermQuiz ? {
          quizId: String(midtermQuiz._id),
          quizTitle: midtermQuiz.title,
          score: quizMidtermScore,
          isOverridden: manualMidterm !== null,
        } : null,
        quizFinal: finalQuiz ? {
          quizId: String(finalQuiz._id),
          quizTitle: finalQuiz.title,
          score: quizFinalScore,
          isOverridden: manualFinal !== null,
        } : null,
        homeworkGrade,
        homeworkQuizCount,
        homeworkQuizTotal: homeworkQuizAssignments.length,
        finalScore,
      };
    });

  return {
    class: {
      ...cls.toObject(),
      enrolledCount: studentsWithGrades.length,
      midtermQuiz: midtermQuiz ? { _id: midtermQuiz._id, title: midtermQuiz.title } : null,
      finalQuiz: finalQuiz ? { _id: finalQuiz._id, title: finalQuiz.title } : null,
    },
    availableQuizzes: allCourseQuizzes.map((q) => ({
      _id: q._id,
      title: q.title,
      dueDate: q.dueDate,
      questionCount: q.questions?.length || 0,
      status: q.status,
    })),
    students: studentsWithGrades,
  };
}

export async function updateStudentGrades(classId, studentId, grades, requester, reason) {
  const cls = mongoose.isValidObjectId(classId)
    ? await CourseClass.findById(classId)
    : await CourseClass.findOne({ id: classId });
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  if (requester.role === ROLES.TEACHER) {
    if (cls.isGradeLocked) {
      throw AppError.forbidden('Bảng điểm của lớp học phần này đã được Phòng Đào tạo chốt sổ và khóa. Giảng viên không thể chỉnh sửa.');
    }
    const teacher = await Teacher.findById(requester.teacher);
    const teacherRefId = cls.teacherRef?._id ? String(cls.teacherRef._id) : String(cls.teacherRef);
    if (!teacher || teacherRefId !== String(teacher._id)) {
      throw AppError.forbidden('Bạn không phụ trách lớp này');
    }
  } else if (requester.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Bạn không có quyền chỉnh sửa điểm');
  }

  const enrollment = await Enrollment.findOne({ classRef: cls._id, student: studentId });
  if (!enrollment) throw AppError.notFound('Sinh viên không thuộc lớp học phần này');

  if (!enrollment.manualGrades) {
    enrollment.manualGrades = {};
  }

  const COMPONENT_LABELS = {
    attendance: 'Điểm chuyên cần',
    midterm: 'Điểm giữa kỳ',
    assignment: 'Điểm bài tập',
    presentation: 'Điểm thuyết trình',
    practical: 'Điểm thực hành',
    final: 'Điểm cuối kỳ',
  };

  const studentDoc = await Student.findById(studentId).select('id hoTen').lean();
  for (const [key, value] of Object.entries(grades)) {
    const oldScore = enrollment.manualGrades?.[key] ?? null;
    const newScore = value === '' || value === undefined ? null : value;
    if (oldScore !== newScore && (requester.role === ROLES.ADMIN || reason)) {
      await GradeAuditLog.create({
        classRef: cls._id,
        classId: cls.id,
        courseName: cls.courseName || '',
        studentRef: studentId,
        studentId: studentDoc?.id || 0,
        studentName: studentDoc?.hoTen || 'Sinh viên',
        component: key,
        componentLabel: COMPONENT_LABELS[key] || key,
        oldScore,
        newScore,
        reason: reason || (requester.role === ROLES.ADMIN ? 'Phòng Đào tạo điều chỉnh điểm số (phúc khảo / can thiệp)' : 'Giảng viên cập nhật điểm'),
        performedByRef: requester._id,
        performedByName: requester.hoTen || requester.name || requester.email || 'Admin',
        performedByRole: requester.role,
      });
    }
    enrollment.set(`manualGrades.${key}`, value);
  }

  // Calculate effective attendance if manual grade was cleared/null
  let effectiveAttendance = enrollment.manualGrades?.attendance ?? null;
  if (effectiveAttendance === null) {
    const student = await Student.findById(studentId).select('id').lean();
    if (student) {
      const records = await Attendance.find({
        $or: [{ classRef: cls._id }, { regId: cls.id }],
        $and: [
          {
            $or: [
              { studentRef: student._id },
              { studentId: student.id },
            ],
          },
        ],
      }).lean();
      if (records.length > 0) {
        let present = 0;
        let late = 0;
        for (const r of records) {
          if (r.status === 'Có mặt') present += 1;
          else if (r.status === 'Đi muộn') late += 1;
        }
        effectiveAttendance = Number((((present + 0.5 * late) / records.length) * 10).toFixed(1));
      }
    }
  }

  // Calculate effective midterm if manual grade was cleared/null
  let effectiveMidterm = enrollment.manualGrades?.midterm ?? null;
  if (effectiveMidterm === null && cls.midtermQuizId) {
    const sub = await Submission.findOne({
      assignmentRef: cls.midtermQuizId,
      student: studentId,
    }).lean();
    if (sub?.score != null) {
      effectiveMidterm = sub.score;
    } else {
      const quiz = await Assignment.findById(cls.midtermQuizId).lean();
      if (quiz && isPastDue(quiz)) effectiveMidterm = 0;
    }
  }

  // Calculate effective final if manual grade was cleared/null
  let effectiveFinal = enrollment.manualGrades?.final ?? null;
  if (effectiveFinal === null && cls.finalQuizId) {
    const sub = await Submission.findOne({
      assignmentRef: cls.finalQuizId,
      student: studentId,
    }).lean();
    if (sub?.score != null) {
      effectiveFinal = sub.score;
    } else {
      const quiz = await Assignment.findById(cls.finalQuizId).lean();
      if (quiz && isPastDue(quiz)) effectiveFinal = 0;
    }
  }

  // Calculate effective homework from quizzes if not manually entered
  let effectiveHomework = enrollment.manualGrades?.assignment ?? null;
  if (effectiveHomework === null) {
    const allCourseQuizzes = await Assignment.find({
      courseId: cls.courseId,
      type: 'quiz',
    }).select('_id dueDate createdByRef').lean();
    const excluded = new Set([
      cls.midtermQuizId ? String(cls.midtermQuizId) : null,
      cls.finalQuizId ? String(cls.finalQuizId) : null,
    ].filter(Boolean));
    const teacherRefStr = cls.teacherRef?._id ? String(cls.teacherRef._id) : (cls.teacherRef ? String(cls.teacherRef) : null);
    const hwQuizzes = allCourseQuizzes.filter((q) => {
      if (excluded.has(String(q._id))) return false;
      if (teacherRefStr && q.createdByRef && String(q.createdByRef) !== teacherRefStr) return false;
      return true;
    });
    if (hwQuizzes.length > 0) {
      const hwIds = hwQuizzes.map((q) => q._id);
      const subs = await Submission.find({
        assignmentRef: { $in: hwIds },
        student: studentId,
      }).select('score assignmentRef').lean();
      const submittedIds = new Set(subs.map((s) => String(s.assignmentRef)));
      const scores = subs.map((s) => s.score).filter((s) => s != null);
      const missedCount = hwQuizzes.filter((q) => isPastDue(q) && !submittedIds.has(String(q._id))).length;
      const totalCount = scores.length + missedCount;
      if (totalCount > 0) {
        effectiveHomework = Number((scores.reduce((a, b) => a + b, 0) / totalCount).toFixed(1));
      }
    }
  }

  const weights = cls.gradeWeights || { attendance: 10, homework: 10, midterm: 30, presentation: 0, final: 50 };
  const studentGrades = {
    attendance: effectiveAttendance,
    midterm: effectiveMidterm,
    final: effectiveFinal,
    presentation: enrollment.manualGrades?.presentation ?? null,
    homework: effectiveHomework,
  };
  const finalScore = calculateWeightedGpa(studentGrades, weights);
  enrollment.finalScore = finalScore;
  await enrollment.save();
  return {
    manualGrades: enrollment.manualGrades.toObject(),
    effectiveGrades: studentGrades,
    finalScore,
  };
}

export async function updateGradeConfig(classId, config, requester) {
  const cls = mongoose.isValidObjectId(classId)
    ? await CourseClass.findById(classId)
    : await CourseClass.findOne({ id: classId });
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  if (requester.role === ROLES.TEACHER) {
    const teacher = await Teacher.findById(requester.teacher);
    if (!teacher || String(cls.teacherRef) !== String(teacher._id)) {
      throw AppError.forbidden('Bạn không phụ trách lớp này');
    }
  }

  if (config.midtermQuizId !== undefined) {
    if (config.midtermQuizId) {
      const quiz = await Assignment.findById(config.midtermQuizId);
      if (!quiz) throw AppError.badRequest('Bài quiz giữa kỳ không tồn tại');
      if (quiz.type !== 'quiz') throw AppError.badRequest('Bài tập phải là dạng quiz trắc nghiệm');
      cls.midtermQuizId = quiz._id;
    } else {
      cls.midtermQuizId = null;
    }
  }

  if (config.finalQuizId !== undefined) {
    if (config.finalQuizId) {
      const quiz = await Assignment.findById(config.finalQuizId);
      if (!quiz) throw AppError.badRequest('Bài quiz cuối kỳ không tồn tại');
      if (quiz.type !== 'quiz') throw AppError.badRequest('Bài tập phải là dạng quiz trắc nghiệm');
      cls.finalQuizId = quiz._id;
    } else {
      cls.finalQuizId = null;
    }
  }

  if (cls.midtermQuizId && cls.finalQuizId && String(cls.midtermQuizId) === String(cls.finalQuizId)) {
    throw AppError.badRequest('Không thể chọn cùng một bài Quiz cho cả Giữa kỳ và Cuối kỳ');
  }

  await cls.save();
  return {
    success: true,
    midtermQuizId: cls.midtermQuizId,
    finalQuizId: cls.finalQuizId,
  };
}

export async function deleteClass(id) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  if (mongoose.modelNames().includes('Enrollment')) {
    await mongoose.model('Enrollment').deleteMany({ classRef: cls._id });
  }
  await CourseClass.deleteOne({ _id: cls._id });
  return { success: true };
}

export async function toggleGradeLock(classId, { lock } = {}, requester) {
  const cls = mongoose.isValidObjectId(classId)
    ? await CourseClass.findById(classId)
    : await CourseClass.findOne({ id: classId });
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  const newLockState = lock !== undefined ? Boolean(lock) : !cls.isGradeLocked;
  cls.isGradeLocked = newLockState;
  cls.gradeLockedAt = newLockState ? new Date() : null;
  cls.gradeLockedBy = newLockState ? requester._id : null;
  await cls.save();

  return {
    classId: cls.id,
    isGradeLocked: cls.isGradeLocked,
    gradeLockedAt: cls.gradeLockedAt,
    message: cls.isGradeLocked
      ? `Đã chốt sổ và khóa bảng điểm lớp học phần ${cls.id}`
      : `Đã mở khóa bảng điểm lớp học phần ${cls.id}`,
  };
}

export async function lockAllGrades({ lock = true, department } = {}, requester) {
  const filter = {};
  if (department && department !== 'all') {
    filter.department = department;
  }
  const result = await CourseClass.updateMany(filter, {
    $set: {
      isGradeLocked: Boolean(lock),
      gradeLockedAt: lock ? new Date() : null,
      gradeLockedBy: lock ? requester._id : null,
    },
  });

  return {
    modifiedCount: result.modifiedCount,
    isGradeLocked: Boolean(lock),
    message: lock
      ? `Đã chốt sổ và khóa bảng điểm thành công cho ${result.modifiedCount} lớp học phần`
      : `Đã mở khóa bảng điểm thành công cho ${result.modifiedCount} lớp học phần`,
  };
}

export async function getGradeAuditLogs(classId) {
  const filter = {};
  if (classId) {
    const cls = mongoose.isValidObjectId(classId)
      ? await CourseClass.findById(classId).select('_id id')
      : await CourseClass.findOne({ id: classId }).select('_id id');
    if (cls) {
      filter.$or = [{ classRef: cls._id }, { classId: cls.id }];
    }
  }
  const logs = await GradeAuditLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return logs;
}

export async function getAdminGradebookOverview({ department, teacherId, status, search } = {}) {
  const filter = {};
  if (department && department !== 'all') {
    filter.department = department;
  }
  if (teacherId && teacherId !== 'all') {
    if (mongoose.isValidObjectId(teacherId)) {
      filter.teacherRef = teacherId;
    } else {
      filter.teacherId = Number(teacherId);
    }
  }
  if (status === 'locked') {
    filter.isGradeLocked = true;
  } else if (status === 'open') {
    filter.isGradeLocked = { $ne: true };
  }
  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { id: { $regex: s, $options: 'i' } },
      { courseName: { $regex: s, $options: 'i' } },
      { className: { $regex: s, $options: 'i' } },
      { teacher: { $regex: s, $options: 'i' } },
    ];
  }

  const classes = await CourseClass.find(filter).sort({ id: 1 }).lean();
  const classIds = classes.map((c) => c._id);

  // Group enrollments by classRef to compute stats
  const enrollments = await Enrollment.find({ classRef: { $in: classIds } }).select('classRef finalScore manualGrades').lean();
  const enrollmentsByClass = new Map();
  for (const e of enrollments) {
    const k = String(e.classRef);
    if (!enrollmentsByClass.has(k)) enrollmentsByClass.set(k, []);
    enrollmentsByClass.get(k).push(e);
  }

  const overview = classes.map((c) => {
    const classEnrolls = enrollmentsByClass.get(String(c._id)) || [];
    const totalStudents = classEnrolls.length;
    const gradedStudents = classEnrolls.filter((e) => e.finalScore != null).length;
    const scores = classEnrolls.map((e) => e.finalScore).filter((s) => s != null);
    const avgGpa = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;

    return {
      _id: c._id,
      id: c.id,
      courseId: c.courseId,
      courseName: c.courseName,
      className: c.className,
      department: c.department,
      credits: c.credits,
      teacher: c.teacher,
      teacherId: c.teacherId,
      isGradeLocked: Boolean(c.isGradeLocked),
      gradeLockedAt: c.gradeLockedAt,
      totalStudents,
      gradedStudents,
      avgGpa,
      gradeWeights: c.gradeWeights,
      completionRate: totalStudents > 0 ? Number(((gradedStudents / totalStudents) * 100).toFixed(1)) : 0,
    };
  });

  return {
    classes: overview,
    totalClasses: overview.length,
    lockedCount: overview.filter((c) => c.isGradeLocked).length,
    openCount: overview.filter((c) => !c.isGradeLocked).length,
  };
}
