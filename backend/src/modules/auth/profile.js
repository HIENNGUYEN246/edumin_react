import { ROLES } from '../../lib/roles.js';

/**
 * Load the role-specific profile document for a user, if any.
 * Teacher/Student models are imported lazily so this module has no hard
 * dependency on features that are added in later tasks.
 */
export async function loadProfile(user) {
  if (!user) return null;
  if (user.role === ROLES.TEACHER && user.teacher) {
    const { Teacher } = await import('../teachers/teacher.model.js').catch(() => ({}));
    if (Teacher) return Teacher.findById(user.teacher).populate('departmentRef', 'id name').lean();
  }
  if (user.role === ROLES.STUDENT && user.student) {
    const { Student } = await import('../students/student.model.js').catch(() => ({}));
    if (Student) return Student.findById(user.student).populate('departmentRef', 'id name').lean();
  }
  return null;
}
