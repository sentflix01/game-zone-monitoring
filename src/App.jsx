import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { I18nProvider } from '@/i18n/I18nContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consoles from './pages/Consoles';
import Sessions from './pages/Sessions';
import Settings from './pages/Settings';
import Report from './pages/Report.jsx';
import Players from './pages/Players';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
const Router = (isElectron || isCapacitor) ? HashRouter : BrowserRouter;

// TourProvider must be inside Router (needs useNavigate/useLocation)
// but outside the Routes so it renders on every page
import { TourProvider } from '@/contexts/TourContext';

function AppRoutes() {
  return (
    <TourProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/consoles" element={<Consoles />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/players" element={<Players />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/report" element={<Report />} />
            <Route element={<AdminRoute />}>
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/analytics" element={<Analytics />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </TourProvider>
  );
}

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
