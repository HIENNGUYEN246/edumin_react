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

export function useClassMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });
  return {
    create: useMutation({ mutationFn: classesApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => classesApi.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: classesApi.remove, onSuccess: invalidate }),
  };
}
