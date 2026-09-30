import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '../../../api/classesApi.js';

const KEY = 'classes';

export function useClasses(params) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => classesApi.list(params),
    placeholderData: (prev) => prev,
  });
}

/** All classes of a single course (admin course-detail page). */
export function useCourseClasses(courseId) {
  return useQuery({
    queryKey: [KEY, 'by-course', courseId],
    queryFn: () => classesApi.byCourse(courseId),
    enabled: Boolean(courseId),
  });
}

export function useClassStudents(classId, enabled = true) {
  return useQuery({
    queryKey: [KEY, classId, 'students'],
    queryFn: () => classesApi.students(classId),
    enabled: Boolean(classId) && enabled,
  });
}

export function useClassMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });
  return {
    create: useMutation({ mutationFn: classesApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => classesApi.update(id, payload),
      onSuccess: invalidate,
    }),
    changeStatus: useMutation({
      mutationFn: ({ id, status }) => classesApi.changeStatus(id, status),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: classesApi.remove, onSuccess: invalidate }),
  };
}
