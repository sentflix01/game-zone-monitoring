import { useAuth } from '../lib/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/I18nContext';

export default function AdminRoute() {
  const { isAuthenticated, isLoadingAuth, role } = useAuth();
  const { t } = useTranslation();

  if (isLoadingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e' }}>
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Only owners (admins) can access admin routes
  if (role !== 'owner') {
    toast.error(t('auth.error.accessDenied'));
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
