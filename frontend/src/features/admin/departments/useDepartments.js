import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi } from '../../../api/departmentsApi.js';

const KEY = 'departments';

export function useDepartments(params) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => departmentsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useDepartmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({ mutationFn: departmentsApi.create, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, ...payload }) => departmentsApi.update(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: departmentsApi.remove, onSuccess: invalidate });

  return { create, update, remove };
}
