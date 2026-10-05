import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { setAuthListeners, tokenStore } from '../../api/http.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.get()));
  const [lockInfo, setLockInfo] = useState(null);

  // /auth/me is the single source of truth for the session. It refetches on
  // window focus and every 60s so lock/role changes surface promptly.
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: hasToken ? 60000 : false,
    staleTime: 30000,
  });

  useEffect(() => {
    setAuthListeners({
      onUnauthorized: () => {
        tokenStore.clear();
        setHasToken(false);
        queryClient.clear();
      },
      onLocked: (error) => setLockInfo({ message: error.message }),
    });
  }, [queryClient]);

  const primeSession = (result) => {
    setHasToken(true);
    setLockInfo(null);
    queryClient.setQueryData(['auth', 'me'], { user: result.user, profile: result.profile });
    return queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  };

  const login = async (email, password) => {
    const result = await authApi.login(email, password);
    await primeSession(result);
    return result;
  };

  const register = async (payload) => {
    const result = await authApi.register(payload);
    await primeSession(result);
    return result;
  };

  const logout = () => {
    authApi.logout();
    setHasToken(false);
    setLockInfo(null);
    queryClient.clear();
  };

  const value = useMemo(
    () => ({
      user: meQuery.data?.user || null,
      profile: meQuery.data?.profile || null,
      isLoading: hasToken && meQuery.isLoading,
      isAuthenticated: Boolean(meQuery.data?.user),
      lockInfo,
      dismissLock: () => setLockInfo(null),
      login,
      register,
      logout,
      refetch: meQuery.refetch,
    }),
    // login/logout are stable enough for this app; deps kept minimal intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meQuery.data, meQuery.isLoading, hasToken, lockInfo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthProvider;
