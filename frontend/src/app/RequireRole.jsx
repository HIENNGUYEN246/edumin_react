import { Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { roleHome } from './navConfig.js';

/**
 * Route guard. Waits for the session to resolve, redirects unauthenticated
 * users to login, and sends wrong-role users to their own home. Server-side
 * authorization is still the real enforcement; this is UX routing only.
 */
export function RequireRole({ role, children }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <Spinner label="Đang kiểm tra phiên đăng nhập..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />;

  return children;
}

export default RequireRole;
