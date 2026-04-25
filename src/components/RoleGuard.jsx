import { useAuth } from '../lib/AuthContext';

/**
 * RoleGuard — renders children only when the current user's role matches.
 * Supports 'owner' (admin) and 'monitor' (staff) roles.
 * For backward compatibility, passing role="admin" also matches role='owner'.
 */
const RoleGuard = ({ role, fallback = null, children }) => {
  const { role: currentRole } = useAuth();
  const allowed =
    currentRole === role ||
    (role === 'admin' && currentRole === 'owner');
  return allowed ? children : fallback;
};

export default RoleGuard;
