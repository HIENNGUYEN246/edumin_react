import mongoose from 'mongoose';
import { ROLES } from '../../lib/roles.js';

/**
 * Does the given user have access to a course's private materials?
 * - Admin: always.
 * - Teacher: teaches at least one class of the course.
 * - Student: enrolled in at least one class of the course.
 * @param {object} user  authenticated user (req.user)
 * @param {string} courseId  course.id (string code)
 */
export async function canAccessCourse(user, courseId) {
  if (!user || !courseId) return false;
  if (user.role === ROLES.ADMIN) return true;

  const CourseClass = mongoose.model('CourseClass');

  if (user.role === ROLES.TEACHER) {
    const count = await CourseClass.countDocuments({ courseId, teacherRef: user.teacher });
    return count > 0;
  }

  if (user.role === ROLES.STUDENT) {
    const Enrollment = mongoose.model('Enrollment');
    const classIds = await CourseClass.find({ courseId }).distinct('_id');
    if (!classIds.length) return false;
    const count = await Enrollment.countDocuments({ student: user.student, classRef: { $in: classIds } });
    return count > 0;
  }

  return false;
}

/**
 * The set of course.id codes a student is enrolled in (via any class).
 * Used to scope listings (documents, assignments) to the student's courses.
 * @param {object} user
 * @returns {Promise<string[]>}
 */
export async function enrolledCourseIds(user) {
  if (user?.role !== ROLES.STUDENT) return [];
  const Enrollment = mongoose.model('Enrollment');
  const CourseClass = mongoose.model('CourseClass');

  const classRefs = await Enrollment.find({ student: user.student }).distinct('classRef');
  if (!classRefs.length) return [];
  const courseIds = await CourseClass.find({ _id: { $in: classRefs } }).distinct('courseId');
  return courseIds.filter(Boolean);
}
