import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';

export function DefaultRedirect() {
  const { user } = useAuth();

  // Redirect admin users to dashboard, others to projects
  const redirectTo = user?.role === 'admin' ? '/dashboard' : '/projects';

  return <Navigate to={redirectTo} replace />;
}
