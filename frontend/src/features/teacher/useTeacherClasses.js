import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../../api/classesApi.js';

export function useMyTeacherClasses() {
  return useQuery({
    queryKey: ['classes', { teacher: 'me' }],
    queryFn: () => classesApi.list({ teacher: 'me', limit: 200 }),
  });
}

export function useClassStudents(classId) {
  return useQuery({
    queryKey: ['classes', classId, 'students'],
    queryFn: () => classesApi.students(classId),
    enabled: Boolean(classId),
  });
}
