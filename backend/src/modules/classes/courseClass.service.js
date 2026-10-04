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

  const fields = await buildClassFields({ ...payload, id: classId });
  await assertNoConflict(fields);
  const created = await CourseClass.create({ id: classId, ...fields });
  return withEnrolledCount(await CourseClass.findById(created._id).populate(POPULATE).lean());
}

export async function updateClass(id, payload) {
  const cls = await CourseClass.findById(id);
  if (!cls) throw AppError.notFound('Không tìm thấy lớp học phần');

  const start = payload.studyStart !== undefined ? payload.studyStart : cls.studyStart;
  const end = payload.studyEnd !== undefined ? payload.studyEnd : cls.studyEnd;
  if (start && end) {
    validate15Weeks(start, end);
  }

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

  if (mongoose.modelNames().includes('Enrollment')) {
    await mongoose.model('Enrollment').deleteMany({ classRef: cls._id });
  }
  await CourseClass.deleteOne({ _id: cls._id });
  return { success: true };
}
