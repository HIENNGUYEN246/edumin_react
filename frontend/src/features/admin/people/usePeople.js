import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Generic list + mutation hooks for a "person" resource (teacher/student).
 * The concrete API object is injected so one hook serves both.
 */
export function usePeople(queryKey, api, params) {
  return useQuery({
    queryKey: [queryKey, params],
    queryFn: () => api.list(params),
    placeholderData: (prev) => prev,
  });
}

export function usePeopleMutations(queryKey, api) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  return {
    create: useMutation({ mutationFn: api.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => api.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess: invalidate }),
    bulkRemove: useMutation({ mutationFn: api.bulkRemove, onSuccess: invalidate }),
    uploadAvatar: useMutation({
      mutationFn: ({ id, file }) => api.uploadAvatar(id, file),
      onSuccess: invalidate,
    }),
    importRows: useMutation({ mutationFn: api.importRows, onSuccess: invalidate }),
  };
}
