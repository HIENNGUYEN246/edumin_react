import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '../../../api/coursesApi.js';

const KEY = 'courses';

export function useCourses(params) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => coursesApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCourseMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });
  return {
    create: useMutation({ mutationFn: coursesApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => coursesApi.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: coursesApi.remove, onSuccess: invalidate }),
    importRows: useMutation({ mutationFn: coursesApi.importRows, onSuccess: invalidate }),
  };
}
