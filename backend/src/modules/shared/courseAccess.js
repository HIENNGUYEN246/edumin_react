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
  const Course = mongoose.model('Course');

  if (user.role === ROLES.TEACHER) {
    const Teacher = mongoose.model('Teacher');
    const teacher = await Teacher.findById(user.teacher).lean();
    const course = await Course.findOne({ id: courseId }).lean();
    if (!course) return false;

    // Direct check: if teacher is assigned to any class of this course, allow full access
    const teacherFilter = [{ teacherRef: user.teacher }];
    if (user.teacher && mongoose.Types.ObjectId.isValid(user.teacher)) {
      teacherFilter.push({ teacherRef: new mongoose.Types.ObjectId(user.teacher) });
    }
    if (teacher?.hoTen) teacherFilter.push({ teacher: teacher.hoTen });
    if (teacher?.id) teacherFilter.push({ teacherId: teacher.id });
    if (user.hoTen) teacherFilter.push({ teacher: user.hoTen });

    const count = await CourseClass.countDocuments({
      $or: [{ courseId: course.id }, { courseId }],
      $and: [{ $or: teacherFilter }],
    });
    if (count > 0) return true;

    // Fallback to department only if teacher has no classes assigned yet
    const totalTaught = await CourseClass.countDocuments({ $or: teacherFilter });
    if (totalTaught === 0) {
      if (teacher?.department && course.department && teacher.department === course.department) {
        return true;
      }
      if (teacher?.departmentRef && course.departmentRef && String(teacher.departmentRef) === String(course.departmentRef)) {
        return true;
      }
    }

    const allowed = await teacherAccessibleCourseIds(user);
    return allowed.includes(courseId);
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
 * The set of course.id codes a teacher has access to:
 * - Courses they teach at least one class of
 * - Courses belonging to their department / chuyên ngành
 * @param {object} user
 * @returns {Promise<string[]>}
 */
export async function teacherAccessibleCourseIds(user) {
  if (user?.role !== ROLES.TEACHER) return [];
  const Teacher = mongoose.model('Teacher');
  const Course = mongoose.model('Course');
  const CourseClass = mongoose.model('CourseClass');

  const teacher = await Teacher.findById(user.teacher).lean();
  const teacherFilter = [{ teacherRef: user.teacher }];
  if (user.teacher && mongoose.Types.ObjectId.isValid(user.teacher)) {
    teacherFilter.push({ teacherRef: new mongoose.Types.ObjectId(user.teacher) });
  }
  if (teacher?.hoTen) teacherFilter.push({ teacher: teacher.hoTen });
  if (teacher?.id) teacherFilter.push({ teacherId: teacher.id });
  if (user.hoTen) teacherFilter.push({ teacher: user.hoTen });

  // 1. Courses the teacher is assigned to teach
  const taughtCourseIds = await CourseClass.find({ $or: teacherFilter }).distinct('courseId');

  // 2. Courses belonging to their department
  let deptCourseIds = [];
  if (teacher?.departmentRef || teacher?.department) {
    const deptFilter = [];
    if (teacher.departmentRef) deptFilter.push({ departmentRef: teacher.departmentRef });
    if (teacher.department) deptFilter.push({ department: teacher.department });
    deptCourseIds = await Course.find({ $or: deptFilter }).distinct('id');
  }

  // If teacher has assigned classes, strictly return only the courses they teach
  if (taughtCourseIds.length > 0) {
    return Array.from(new Set(taughtCourseIds.filter(Boolean)));
  }

  return Array.from(new Set(deptCourseIds.filter(Boolean)));
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

/**
 * The set of class references and string IDs a student is enrolled in.
 * Used to scope assignments/documents assigned to specific classes.
 * @param {object} user
 * @returns {Promise<{ classRefs: import('mongoose').Types.ObjectId[], classIds: string[] }>}
 */
export async function enrolledClassIds(user) {
  if (user?.role !== ROLES.STUDENT) return { classRefs: [], classIds: [] };
  const Enrollment = mongoose.model('Enrollment');
  const CourseClass = mongoose.model('CourseClass');

  const classRefs = await Enrollment.find({ student: user.student }).distinct('classRef');
  if (!classRefs.length) return { classRefs: [], classIds: [] };
  const classes = await CourseClass.find({ _id: { $in: classRefs } }).select('_id id');
  return {
    classRefs: classes.map((c) => c._id),
    classIds: classes.map((c) => c.id).filter(Boolean),
  };
}
