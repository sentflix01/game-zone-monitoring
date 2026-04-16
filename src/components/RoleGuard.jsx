import { useAuth } from '../lib/AuthContext';

const RoleGuard = ({ role, fallback = null, children }) => {
  const { role: currentRole } = useAuth();
  return currentRole === role ? children : fallback;
};

export default RoleGuard;
