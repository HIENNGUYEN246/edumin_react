import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '../../api/assignmentsApi.js';

export function useAssignments(courseId) {
  return useQuery({
    queryKey: ['assignments', { courseId }],
    queryFn: () => assignmentsApi.list(courseId ? { courseId } : {}),
  });
}

export function useAssignmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assignments'] });
  return {
    create: useMutation({ mutationFn: assignmentsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => assignmentsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: assignmentsApi.remove, onSuccess: invalidate }),
  };
}

export function useSubmissions(assignmentId) {
  return useQuery({
    queryKey: ['assignments', assignmentId, 'submissions'],
    queryFn: () => assignmentsApi.submissions(assignmentId),
    enabled: Boolean(assignmentId),
  });
}
