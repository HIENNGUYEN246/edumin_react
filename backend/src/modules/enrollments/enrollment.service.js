import { AppError } from '../../lib/AppError.js';
import { rangesOverlap, slotsClash } from '../../lib/schedule.js';
import { isRegistrationWindowActive, isRegistrationWindowExpired } from '../../lib/dateOnly.js';
import { closeExpiredClasses } from '../classes/courseClass.service.js';
import { ROLES } from '../../lib/roles.js';
import { sendClassAssignedEmail } from '../../lib/mailer.js';
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
  await closeExpiredClasses();
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

export async function enroll(user, classId) {
  await closeExpiredClasses();
  const student = await requireStudent(user);
  const target = await CourseClass.findById(classId);
  if (!target) throw AppError.notFound('Không tìm thấy lớp học phần');

  // A class is open for registration solely based on its status.
  if (target.status !== 'Đang mở') {
    throw AppError.conflict('Lớp hiện không mở đăng ký');
  }
  if (!isRegistrationWindowActive(target)) {
    throw AppError.conflict('Chưa đến thời gian đăng ký lớp học phần');
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

  // Reject if the new class clashes with any already-enrolled class slot.
  const clash = current.some((e) =>
    e.classRef &&
    rangesOverlap(target.studyStart, target.studyEnd, e.classRef.studyStart, e.classRef.studyEnd) &&
    (e.classRef.schedules || []).some((existingSlot) =>
      (target.schedules || []).some((newSlot) => slotsClash(newSlot, existingSlot))
    )
  );
  if (clash) throw AppError.conflict('Học phần bị trùng lịch với lớp đã đăng ký');

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
