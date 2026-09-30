import { AppError } from '../../lib/AppError.js';
import { slotsClash } from '../../lib/schedule.js';
import { Enrollment } from './enrollment.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { Student } from '../students/student.model.js';

async function requireStudent(user) {
  const student = await Student.findById(user.student);
  if (!student) throw AppError.notFound('Không tìm thấy hồ sơ sinh viên');
  return student;
}

/** Classes the student is enrolled in, with the class details attached. */
export async function listMyEnrollments(user) {
  const student = await requireStudent(user);
  const enrollments = await Enrollment.find({ student: student._id })
    .populate({ path: 'classRef' })
    .sort({ createdAt: -1 })
    .lean();
  // Drop enrollments whose class was deleted; expose the class object as `class`.
  return enrollments
    .filter((e) => e.classRef)
    .map((e) => ({ _id: e._id, classId: e.classId, enrolledAt: e.createdAt, class: e.classRef }));
}

function isWithinWindow(courseClass, now = new Date()) {
  const start = new Date(courseClass.start);
  const end = new Date(courseClass.end);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return false;
  return courseClass.status === 'Đang mở' && now >= start && now <= end;
}

export async function enroll(user, classId) {
  const student = await requireStudent(user);
  const target = await CourseClass.findById(classId);
  if (!target) throw AppError.notFound('Không tìm thấy lớp học phần');

  if (!isWithinWindow(target)) {
    throw AppError.conflict('Lớp hiện không trong thời gian đăng ký');
  }

  const existing = await Enrollment.findOne({ student: student._id, classRef: target._id });
  if (existing) throw AppError.conflict('Bạn đã đăng ký lớp học phần này');

  // Reject if the new class clashes with any already-enrolled class slot.
  const current = await Enrollment.find({ student: student._id }).populate('classRef').lean();
  const clash = current.some((e) =>
    (e.classRef?.schedules || []).some((existingSlot) =>
      (target.schedules || []).some((newSlot) => slotsClash(newSlot, existingSlot))
    )
  );
  if (clash) throw AppError.conflict('Học phần bị trùng lịch với lớp đã đăng ký');

  try {
    const created = await Enrollment.create({ student: student._id, classRef: target._id, classId: target.id });
    return { _id: created._id, classId: target.id, enrolledAt: created.createdAt, class: target.toObject() };
  } catch (error) {
    if (error?.code === 11000) throw AppError.conflict('Bạn đã đăng ký lớp học phần này');
    throw error;
  }
}

export async function cancel(user, classId) {
  const student = await requireStudent(user);
  const target = await CourseClass.findById(classId);

  // Allow cleanup even if the class was already removed by an admin.
  if (target) {
    const end = new Date(target.end);
    if (!Number.isNaN(end.valueOf()) && new Date() > end) {
      throw AppError.conflict('Đã hết thời gian tự hủy học phần');
    }
  }

  const deleted = await Enrollment.findOneAndDelete({ student: student._id, classRef: classId });
  if (!deleted) throw AppError.notFound('Đăng ký không tồn tại');
  return { success: true };
}
