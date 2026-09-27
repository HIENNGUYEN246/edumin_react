import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, requiredRole }) {
  const user = JSON.parse(sessionStorage.getItem('currentUser'));

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
