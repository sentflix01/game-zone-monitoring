import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import Layout from './components/Layout';
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

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/consoles" element={<Consoles />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/players" element={<Players />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/report" element={<Report />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
