import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { findScheduleConflict, validateSchedules } from '../../lib/schedule.js';
import { ROLES } from '../../lib/roles.js';
import { CourseClass } from './courseClass.model.js';
import { Course } from '../courses/course.model.js';
import { Teacher } from '../teachers/teacher.model.js';

const POPULATE = [
  { path: 'courseRef', select: 'id name credits fee department' },
  { path: 'teacherRef', select: 'id hoTen avatar email phone education department' },
];

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
  }

  if (!validateSchedules(payload.schedules)) {
    throw AppError.badRequest('Lịch học không hợp lệ');
  }

  return {
    courseRef: course._id,
    courseId: course.id,
    courseName: course.name,
    department: course.department || '',
    credits: course.credits,
    fee: course.fee,
    teacherRef: teacher?._id || null,
    teacherId: teacher?.id ?? null,
    teacher: teacher?.hoTen || '',
    room: payload.room || '',
    capacity: Number.isFinite(Number(payload.capacity)) ? Number(payload.capacity) : 0,
    schedules: payload.schedules,
    studyStart: payload.studyStart || '',
    studyEnd: payload.studyEnd || '',
    status: payload.status || 'Nháp',
  };
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
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: '-createdAt' });
  const filter = searchFilter(search, ['id', 'courseName', 'teacher', 'room']);

  // Teachers can scope to their own classes via ?teacher=me.
  if (query.teacher === 'me' && requester?.role === ROLES.TEACHER) {
    const teacher = await Teacher.findById(requester.teacher).lean();
    filter.teacherRef = teacher?._id || null;
  } else if (query.courseId) {
    filter.courseId = query.courseId;
  }
  if (query.status) filter.status = query.status;

  const result = await paginate(CourseClass, { filter, page, limit, skip, sort, populate: POPULATE });
  result.data = await withEnrolledCount(result.data);
  return result;
}

/** All classes of a course (for the admin course-detail page), with counts. */
export async function listClassesByCourse(courseId) {
  const classes = await CourseClass.find({ courseId }).sort({ id: 1 }).populate(POPULATE).lean();
  return { data: await withEnrolledCount(classes) };
}

/**
 * Classes open for registration (for students), with counts.
 * A class is available purely based on its 'Đang mở' status.
 */
export async function listOpenClasses() {
  const classes = await CourseClass.find({ status: 'Đang mở' }).populate(POPULATE).lean();
  return withEnrolledCount(classes);
}

export async function getClass(id) {
  const doc = await CourseClass.findById(id).populate(POPULATE).lean();
  if (!doc) throw AppError.notFound('Không tìm thấy lớp học phần');
  return withEnrolledCount(doc);
}

/** Change only the lifecycle status of a class. */
export async function changeStatus(id, status) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');
  cls.status = status;
  await cls.save();
  return withEnrolledCount(await CourseClass.findById(cls._id).populate(POPULATE).lean());
}

export async function createClass(payload) {
  const exists = await CourseClass.findOne({ id: payload.id });
  if (exists) throw AppError.conflict('Mã lớp đã tồn tại');
  const fields = await buildClassFields(payload);
  await assertNoConflict(fields);
  const created = await CourseClass.create({ id: payload.id, ...fields });
  return withEnrolledCount(await CourseClass.findById(created._id).populate(POPULATE).lean());
}

export async function updateClass(id, payload) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  // Merge existing values so a partial update still passes the conflict check.
  const merged = {
    courseId: payload.courseId || cls.courseId,
    teacherId: payload.teacherId !== undefined ? payload.teacherId : cls.teacherId,
    room: payload.room !== undefined ? payload.room : cls.room,
    capacity: payload.capacity !== undefined ? payload.capacity : cls.capacity,
    schedules: payload.schedules || cls.schedules,
    studyStart: payload.studyStart !== undefined ? payload.studyStart : cls.studyStart,
    studyEnd: payload.studyEnd !== undefined ? payload.studyEnd : cls.studyEnd,
    status: payload.status || cls.status,
  };
  const fields = await buildClassFields(merged);
  await assertNoConflict(fields, cls._id);
  Object.assign(cls, fields);
  await cls.save();
  return withEnrolledCount(await CourseClass.findById(cls._id).populate(POPULATE).lean());
}

/**
 * List students enrolled in a class. Teachers may only view classes they
 * teach; admins may view any.
 */
export async function listClassStudents(classId, requester) {
  const cls = await CourseClass.findById(classId);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  if (requester.role === ROLES.TEACHER) {
    const teacher = await Teacher.findById(requester.teacher);
    if (!teacher || String(cls.teacherRef) !== String(teacher._id)) {
      throw AppError.forbidden('Bạn không phụ trách lớp này');
    }
  }

  const Enrollment = mongoose.model('Enrollment');
  const enrollments = await Enrollment.find({ classRef: cls._id })
    .populate({ path: 'student', select: 'id hoTen email className department avatar' })
    .lean();
  const students = enrollments.map((e) => e.student).filter(Boolean);
  return { class: { ...cls.toObject(), enrolledCount: students.length }, students };
}

export async function deleteClass(id) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (mongoose.modelNames().includes('Enrollment')) {
        await mongoose.model('Enrollment').deleteMany({ classRef: cls._id }, { session });
      }
      await CourseClass.deleteOne({ _id: cls._id }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { success: true };
}
