import { Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { ROLES, roleHome } from './navConfig.js';

function isRoleMatch(expectedRole, userRole) {
  if (!expectedRole || !userRole) return false;
  if (expectedRole === userRole) return true;
  if (expectedRole === ROLES.STUDENT && (userRole === 'student' || userRole === 'sinh-vien')) return true;
  if (expectedRole === ROLES.TEACHER && (userRole === 'teacher' || userRole === 'giao-vien')) return true;
  if (expectedRole === ROLES.ADMIN && (userRole === 'admin' || userRole === 'dao-tao')) return true;
  if (expectedRole === ROLES.ACCOUNTANT && (userRole === 'accountant' || userRole === 'ke-toan')) return true;
  return false;
}

/**
 * Route guard. Waits for the session to resolve, redirects unauthenticated
 * users to login, and sends wrong-role users to their own home. Server-side
 * authorization is still the real enforcement; this is UX routing only.
 */
export function RequireRole({ role, children }) {
  const { isAuthenticated, isLoading, user, lockInfo } = useAuth();

  if (isLoading && !lockInfo && !user) return <Spinner label="Đang kiểm tra phiên đăng nhập..." />;
  // When an account is locked, keep the user on their current screen so the lock modal displays over it.
  if (lockInfo) return children;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && !isRoleMatch(role, user?.role)) return <Navigate to={roleHome(user?.role)} replace />;

  return children;
}

export default RequireRole;
