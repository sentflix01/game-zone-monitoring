import { useAuth } from '../lib/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/I18nContext';

export default function AdminRoute() {
  const { isAuthenticated, isLoadingAuth, role } = useAuth();
  const { t } = useTranslation();

  if (isLoadingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="loading-spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'admin') {
    toast.error(t('auth.error.accessDenied'));
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
