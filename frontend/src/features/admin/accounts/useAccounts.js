import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../../../api/accountsApi.js';

const KEY = 'accounts';

export function useAccounts(params) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => accountsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useAccountMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });
  return {
    updateStatus: useMutation({
      mutationFn: ({ id, ...payload }) => accountsApi.updateStatus(id, payload),
      onSuccess: invalidate,
    }),
    resetPassword: useMutation({ mutationFn: accountsApi.resetPassword }),
    remove: useMutation({ mutationFn: accountsApi.remove, onSuccess: invalidate }),
    bulkDelete: useMutation({ mutationFn: accountsApi.bulkDelete, onSuccess: invalidate }),
  };
}
