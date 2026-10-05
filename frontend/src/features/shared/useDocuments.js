import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documentsApi.js';

export function useDocuments(courseId) {
  return useQuery({
    queryKey: ['documents', { courseId }],
    queryFn: () => documentsApi.list(courseId ? { courseId } : {}),
  });
}

export function useDocumentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] });
  return {
    create: useMutation({ mutationFn: documentsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...payload }) => documentsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: documentsApi.remove, onSuccess: invalidate }),
  };
}

/** Fetch a signed URL then open it in a new tab. */
export async function downloadDocument(id) {
  const { url } = await documentsApi.download(id);
  window.open(url, '_blank', 'noopener');
}
