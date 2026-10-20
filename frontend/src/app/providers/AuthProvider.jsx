import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi.js';
import { setAuthListeners, tokenStore } from '../../api/http.js';

const AuthContext = createContext(null);

const USER_KEY = 'authUser';
const PROFILE_KEY = 'authProfile';
const LOCK_KEY = 'authLockInfo';

function getStoredJson(key) {
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredJson(key, val) {
  try {
    if (typeof window !== 'undefined') {
      if (val != null) sessionStorage.setItem(key, JSON.stringify(val));
      else sessionStorage.removeItem(key);
    }
  } catch {}
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.get()));
  const [lockInfo, setLockInfo] = useState(() => getStoredJson(LOCK_KEY));
  const [cachedUser, setCachedUser] = useState(() => getStoredJson(USER_KEY));
  const [cachedProfile, setCachedProfile] = useState(() => getStoredJson(PROFILE_KEY));

  // /auth/me is the single source of truth for the session.
  // When active, check every 5s or on window focus. When locked, stop polling.
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: hasToken && !lockInfo ? 5000 : false,
    staleTime: 3000,
  });

  useEffect(() => {
    if (meQuery.data?.user) {
      setCachedUser(meQuery.data.user);
      setStoredJson(USER_KEY, meQuery.data.user);
    }
    if (meQuery.data?.profile) {
      setCachedProfile(meQuery.data.profile);
      setStoredJson(PROFILE_KEY, meQuery.data.profile);
    }
  }, [meQuery.data]);

  useEffect(() => {
    setAuthListeners({
      onUnauthorized: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('edumin:clear-toasts'));
        }
        tokenStore.clear();
        setHasToken(false);
        setCachedUser(null);
        setCachedProfile(null);
        setStoredJson(LOCK_KEY, null);
        setStoredJson(USER_KEY, null);
        setStoredJson(PROFILE_KEY, null);
        queryClient.clear();
      },
      onLocked: (error) => {
        const info = { message: error.message };
        setLockInfo(info);
        setStoredJson(LOCK_KEY, info);
      },
    });
  }, [queryClient]);

  const primeSession = (result) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumin:clear-toasts'));
    }
    queryClient.removeQueries({ queryKey: ['profile-requests'] });
    setHasToken(true);
    setLockInfo(null);
    setStoredJson(LOCK_KEY, null);
    if (result.user) {
      setCachedUser(result.user);
      setStoredJson(USER_KEY, result.user);
    }
    if (result.profile) {
      setCachedProfile(result.profile);
      setStoredJson(PROFILE_KEY, result.profile);
    }
    queryClient.setQueryData(['auth', 'me'], { user: result.user, profile: result.profile });
    // Non-blocking background refetch so slow backend /me or cold starts never stall login
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }).catch(() => {});
    return Promise.resolve(result);
  };

  const login = async (email, password) => {
    const result = await authApi.login(email, password);
    await primeSession(result);
    return result;
  };

  const loginWithSession = async (session) => {
    if (session?.token) {
      tokenStore.set(session.token);
    }
    await primeSession(session);
    return session;
  };

  const register = async (payload) => {
    const result = await authApi.register(payload);
    await primeSession(result);
    return result;
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumin:clear-toasts'));
    }
    authApi.logout();
    setHasToken(false);
    setLockInfo(null);
    setCachedUser(null);
    setCachedProfile(null);
    setStoredJson(LOCK_KEY, null);
    setStoredJson(USER_KEY, null);
    setStoredJson(PROFILE_KEY, null);
    queryClient.clear();
  };

  const rawUser = meQuery.data?.user || cachedUser;
  const currentProfile = meQuery.data?.profile || cachedProfile;
  const userDept =
    rawUser?.khoa ||
    rawUser?.department ||
    currentProfile?.department ||
    currentProfile?.departmentRef?.name ||
    currentProfile?.departmentRef?.id ||
    '';
  const currentUser = rawUser
    ? {
        ...rawUser,
        department: rawUser.department || userDept,
        khoa: rawUser.khoa || userDept,
      }
    : rawUser;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumin:clear-toasts'));
    }
    queryClient.removeQueries({ queryKey: ['profile-requests'] });
  }, [currentUser?._id, queryClient]);

  const value = useMemo(
    () => ({
      user: currentUser,
      profile: currentProfile,
      isLoading: hasToken && meQuery.isLoading && !currentUser,
      isAuthenticated: Boolean(currentUser && (hasToken || lockInfo)),
      lockInfo,
      dismissLock: () => {
        setLockInfo(null);
        setStoredJson(LOCK_KEY, null);
      },
      login,
      loginWithSession,
      register,
      logout,
      refetch: meQuery.refetch,
    }),
    // login/logout are stable enough for this app; deps kept minimal intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meQuery.data, meQuery.isLoading, hasToken, lockInfo, currentUser, currentProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
      lockInfo: null,
      dismissLock: () => {},
      login: async () => {},
      loginWithSession: async () => {},
      register: async () => {},
      logout: () => {},
      refetch: async () => {},
    };
  }
  return ctx;
}

export default AuthProvider;
