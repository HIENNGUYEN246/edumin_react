import { ROLES } from '../../lib/roles.js';

/**
 * Load the role-specific profile document for a user, if any.
 * Teacher/Student models are imported lazily so this module has no hard
 * dependency on features that are added in later tasks.
 */
export async function loadProfile(user) {
  if (!user) return null;
  const teacherRef = user.teacher || user.teacherId;
  const studentRef = user.student || user.studentId;

  if (user.role === ROLES.TEACHER) {
    const { Teacher } = await import('../teachers/teacher.model.js').catch(() => ({}));
    if (Teacher) {
      let t = teacherRef ? await Teacher.findById(teacherRef).populate('departmentRef', 'id name').lean() : null;
      if (!t && user._id) {
        t = await Teacher.findOne({ userId: user._id }).populate('departmentRef', 'id name').lean();
      }
      return t;
    }
  }
  if (user.role === ROLES.STUDENT) {
    const { Student } = await import('../students/student.model.js').catch(() => ({}));
    if (Student) {
      let s = studentRef ? await Student.findById(studentRef).populate('departmentRef', 'id name').lean() : null;
      if (!s && user._id) {
        s = await Student.findOne({ userId: user._id }).populate('departmentRef', 'id name').lean();
      }
      return s;
    }
  }
  return null;
}
