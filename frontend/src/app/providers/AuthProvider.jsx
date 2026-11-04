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
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key) || null;
    if (raw) {
      try { sessionStorage.setItem(key, raw); } catch {}
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredJson(key, val) {
  try {
    if (typeof window !== 'undefined') {
      if (val != null) {
        const str = JSON.stringify(val);
        sessionStorage.setItem(key, str);
        try { localStorage.setItem(key, str); } catch {}
      } else {
        sessionStorage.removeItem(key);
        try { localStorage.removeItem(key); } catch {}
      }
    }
  } catch {}
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.get()));
  const [lockInfo, setLockInfo] = useState(() => getStoredJson(LOCK_KEY));
  const [cachedUser, setCachedUser] = useState(() => getStoredJson(USER_KEY));
  const [cachedProfile, setCachedProfile] = useState(() => {
    const storedUser = getStoredJson(USER_KEY);
    if (storedUser?.role === 'admin' || storedUser?.role === 'dao-tao') return null;
    return getStoredJson(PROFILE_KEY);
  });

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
    if (meQuery.data) {
      if (meQuery.data.user) {
        setCachedUser(meQuery.data.user);
        setStoredJson(USER_KEY, meQuery.data.user);
      }
      // Admin không có hồ sơ GV/SV riêng, bắt buộc xóa sạch cachedProfile cũ để tránh hiển thị sai thông tin
      if (meQuery.data.user?.role === 'admin' || meQuery.data.user?.role === 'dao-tao') {
        setCachedProfile(null);
        setStoredJson(PROFILE_KEY, null);
      } else {
        const p = meQuery.data.profile || null;
        setCachedProfile(p);
        setStoredJson(PROFILE_KEY, p);
      }
    }
  }, [meQuery.data]);

  // Wire global http listener to log out or lock the state.
  useEffect(() => {
    setAuthListeners({
      onUnauthorized: () => {
        tokenStore.clear();
        setHasToken(false);
        setLockInfo(null);
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

    if (!result) return Promise.resolve(null);

    const resolvedUser = result.user || result.data?.user || null;
    const resolvedProfile = result.profile || result.data?.profile || null;

    if (resolvedUser) {
      setCachedUser(resolvedUser);
      setStoredJson(USER_KEY, resolvedUser);
    }
    if (resolvedUser?.role === 'admin' || resolvedUser?.role === 'dao-tao') {
      setCachedProfile(null);
      setStoredJson(PROFILE_KEY, null);
    } else {
      setCachedProfile(resolvedProfile);
      setStoredJson(PROFILE_KEY, resolvedProfile);
    }
    queryClient.setQueryData(['auth', 'me'], {
      user: resolvedUser,
      profile: (resolvedUser?.role === 'admin' || resolvedUser?.role === 'dao-tao') ? null : resolvedProfile,
    });
    // Non-blocking background refetch so slow backend /me or cold starts never stall login
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }).catch(() => {});
    return Promise.resolve(result);
  };

  const login = async (email, password) => {
    const result = await authApi.login(email, password);
    await primeSession(result);
    const resolvedUser = result?.user || result?.data?.user || null;
    const resolvedProfile = result?.profile || result?.data?.profile || null;
    return {
      ...(result || {}),
      user: resolvedUser,
      profile: resolvedProfile,
    };
  };

  const loginWithSession = async (session) => {
    if (session?.token) {
      tokenStore.set(session.token);
    } else if (session?.data?.token) {
      tokenStore.set(session.data.token);
    }
    await primeSession(session);
    const resolvedUser = session?.user || session?.data?.user || null;
    const resolvedProfile = session?.profile || session?.data?.profile || null;
    return {
      ...(session || {}),
      user: resolvedUser,
      profile: resolvedProfile,
    };
  };

  const register = async (payload) => {
    const result = await authApi.register(payload);
    await primeSession(result);
    const resolvedUser = result?.user || result?.data?.user || null;
    const resolvedProfile = result?.profile || result?.data?.profile || null;
    return {
      ...(result || {}),
      user: resolvedUser,
      profile: resolvedProfile,
    };
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
        avatar: rawUser.avatar || currentProfile?.avatar || null,
        hoTen: rawUser.hoTen || currentProfile?.hoTen || '',
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
      login: async () => ({ user: null }),
      loginWithSession: async () => ({ user: null }),
      register: async () => ({ user: null }),
      logout: () => {},
      refetch: async () => {},
    };
  }
  return ctx;
}

export default AuthProvider;
