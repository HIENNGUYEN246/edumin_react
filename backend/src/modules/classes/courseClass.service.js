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
  { path: 'teacherRef', select: 'id hoTen' },
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
    schedules: payload.schedules,
    studyStart: payload.studyStart || '',
    studyEnd: payload.studyEnd || '',
    start: payload.start || '',
    end: payload.end || '',
    status: payload.status || 'Đang mở',
  };
}

/** Reject teacher/room double-booking against every other class. */
async function assertNoConflict(fields, excludeId) {
  const filter = excludeId ? { _id: { $ne: excludeId } } : {};
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

  return paginate(CourseClass, { filter, page, limit, skip, sort, populate: POPULATE });
}

/** Open classes currently inside their registration window (for students). */
export async function listOpenClasses() {
  const now = new Date();
  const classes = await CourseClass.find({ status: 'Đang mở' }).populate(POPULATE).lean();
  return classes.filter((c) => {
    const start = new Date(c.start);
    const end = new Date(c.end);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return false;
    return now >= start && now <= end;
  });
}

export async function getClass(id) {
  const doc = await CourseClass.findById(id).populate(POPULATE).lean();
  if (!doc) throw AppError.notFound('Không tìm thấy lớp học phần');
  return doc;
}

export async function createClass(payload) {
  const exists = await CourseClass.findOne({ id: payload.id });
  if (exists) throw AppError.conflict('Mã lớp đã tồn tại');
  const fields = await buildClassFields(payload);
  await assertNoConflict(fields);
  const created = await CourseClass.create({ id: payload.id, ...fields });
  return CourseClass.findById(created._id).populate(POPULATE).lean();
}

export async function updateClass(id, payload) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  // Merge existing values so a partial update still passes the conflict check.
  const merged = {
    courseId: payload.courseId || cls.courseId,
    teacherId: payload.teacherId !== undefined ? payload.teacherId : cls.teacherId,
    room: payload.room !== undefined ? payload.room : cls.room,
    schedules: payload.schedules || cls.schedules,
    studyStart: payload.studyStart !== undefined ? payload.studyStart : cls.studyStart,
    studyEnd: payload.studyEnd !== undefined ? payload.studyEnd : cls.studyEnd,
    start: payload.start !== undefined ? payload.start : cls.start,
    end: payload.end !== undefined ? payload.end : cls.end,
    status: payload.status || cls.status,
  };
  const fields = await buildClassFields(merged);
  await assertNoConflict(fields, cls._id);
  Object.assign(cls, fields);
  await cls.save();
  return CourseClass.findById(cls._id).populate(POPULATE).lean();
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
    .populate({ path: 'student', select: 'id hoTen email className department' })
    .lean();
  return { class: cls.toObject(), students: enrollments.map((e) => e.student).filter(Boolean) };
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
