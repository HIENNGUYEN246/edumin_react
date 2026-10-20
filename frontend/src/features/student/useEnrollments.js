import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enrollmentsApi } from '../../api/enrollmentsApi.js';
import { classesApi } from '../../api/classesApi.js';

export function useOpenClasses() {
  return useQuery({
    queryKey: ['classes', 'open'],
    queryFn: classesApi.listOpen,
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
}

export function useMyEnrollments() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleGradeLock = () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'me'] });
    };
    window.addEventListener('edumin_grade_lock_changed', handleGradeLock);
    return () => window.removeEventListener('edumin_grade_lock_changed', handleGradeLock);
  }, [queryClient]);

  return useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: enrollmentsApi.mine,
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
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
