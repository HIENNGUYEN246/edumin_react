import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enrollmentsApi } from '../../api/enrollmentsApi.js';
import { classesApi } from '../../api/classesApi.js';

export function useOpenClasses() {
  return useQuery({
    queryKey: ['classes', 'open'],
    queryFn: classesApi.listOpen,
    refetchInterval: 60_000,
  });
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: enrollmentsApi.mine,
    refetchInterval: 60_000,
  });
}

export function useEnrollmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollments', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['classes', 'open'] });
  };
  return {
    enroll: useMutation({ mutationFn: enrollmentsApi.enroll, onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: enrollmentsApi.cancel, onSuccess: invalidate }),
  };
}
