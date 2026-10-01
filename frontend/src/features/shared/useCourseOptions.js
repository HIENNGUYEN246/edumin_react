import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../../api/classesApi.js';
import { coursesApi } from '../../api/coursesApi.js';
import { enrollmentsApi } from '../../api/enrollmentsApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { ROLES } from '../../app/navConfig.js';

/**
 * Courses relevant to the current user for document/assignment pickers:
 * - Teacher: the distinct courses of classes they teach.
 * - Student: the distinct courses they are enrolled in.
 * - Admin: all courses.
 */
export function useCourseOptions() {
  const { user, profile } = useAuth();
  const isTeacher = user?.role === ROLES.TEACHER;
  const isStudent = user?.role === ROLES.STUDENT;

  const teacherClasses = useQuery({
    queryKey: ['classes', { teacher: 'me' }],
    queryFn: () => classesApi.list({ teacher: 'me', limit: 200 }),
    enabled: isTeacher,
  });

  const myEnrollments = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: enrollmentsApi.mine,
    enabled: isStudent,
  });

  const allCourses = useQuery({
    queryKey: ['courses', { limit: 500 }],
    queryFn: () => coursesApi.list({ limit: 500 }),
    enabled: isTeacher || (!isTeacher && !isStudent),
  });

  // Reduce a list of class-like objects to unique {id, name} course options.
  const uniqueCourses = (items) => {
    const seen = new Map();
    items.forEach((c) => {
      if (c?.courseId && !seen.has(c.courseId)) seen.set(c.courseId, { id: c.courseId, name: c.courseName });
    });
    return [...seen.values()];
  };

  if (isTeacher) {
    const classCourses = uniqueCourses(teacherClasses.data?.data || []);
    const teacherDept = profile?.department || user?.department;
    const deptCourses = teacherDept
      ? (allCourses.data?.data || [])
          .filter((c) => c.department === teacherDept)
          .map((c) => ({ id: c.id, name: c.name }))
      : [];
    const combined = new Map();
    [...classCourses, ...deptCourses].forEach((c) => {
      if (c?.id && !combined.has(c.id)) combined.set(c.id, { id: c.id, name: c.name });
    });
    return { courses: [...combined.values()], isLoading: teacherClasses.isLoading || allCourses.isLoading };
  }
  if (isStudent) {
    const classes = (myEnrollments.data?.data || []).map((e) => e.class).filter(Boolean);
    return { courses: uniqueCourses(classes), isLoading: myEnrollments.isLoading };
  }
  return { courses: allCourses.data?.data || [], isLoading: allCourses.isLoading };
}
