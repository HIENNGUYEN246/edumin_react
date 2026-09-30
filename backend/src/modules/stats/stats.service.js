import { User } from '../auth/user.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { Department } from '../departments/department.model.js';
import { Course } from '../courses/course.model.js';
import { CourseClass } from '../classes/courseClass.model.js';

/** Aggregate counts for the admin dashboard using cheap countDocuments. */
export async function getOverview() {
  const [teachers, students, departments, courses, classes, openClasses, lockedAccounts] = await Promise.all([
    Teacher.estimatedDocumentCount(),
    Student.estimatedDocumentCount(),
    Department.estimatedDocumentCount(),
    Course.estimatedDocumentCount(),
    CourseClass.estimatedDocumentCount(),
    CourseClass.countDocuments({ status: 'Đang mở' }),
    User.countDocuments({ status: 'Locked' }),
  ]);
  return { teachers, students, departments, courses, classes, openClasses, lockedAccounts };
}
