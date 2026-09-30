import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../../api/classesApi.js';
import { coursesApi } from '../../api/coursesApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { ROLES } from '../../app/navConfig.js';

/**
 * Courses relevant to the current user for document/assignment pickers:
 * - Teacher: the distinct courses of classes they teach.
 * - Otherwise: all courses.
 */
export function useCourseOptions() {
  const { user } = useAuth();
  const isTeacher = user?.role === ROLES.TEACHER;

  const teacherClasses = useQuery({
    queryKey: ['classes', { teacher: 'me' }],
    queryFn: () => classesApi.list({ teacher: 'me', limit: 200 }),
    enabled: isTeacher,
  });

  const allCourses = useQuery({
    queryKey: ['courses', { limit: 500 }],
    queryFn: () => coursesApi.list({ limit: 500 }),
    enabled: !isTeacher,
  });

  if (isTeacher) {
    const seen = new Map();
    (teacherClasses.data?.data || []).forEach((c) => {
      if (c.courseId && !seen.has(c.courseId)) seen.set(c.courseId, { id: c.courseId, name: c.courseName });
    });
    return { courses: [...seen.values()], isLoading: teacherClasses.isLoading };
  }
  return { courses: allCourses.data?.data || [], isLoading: allCourses.isLoading };
}
