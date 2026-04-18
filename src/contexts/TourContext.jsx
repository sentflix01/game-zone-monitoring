import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tourPages } from '@/i18n/tourSteps';
import TourTooltip from '@/components/TourTooltip';
import HelpButton from '@/components/HelpButton';
import { useAuth } from '@/lib/AuthContext';

const STORAGE_KEY = 'tour_completed';

export const TourContext = createContext(null);

export function TourProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const [state, setState] = useState({
    isActive: false,
    currentPageIndex: 0,
    currentStepIndex: 0,
  });

  // Auto-start only when: authenticated, on dashboard, tour not completed
  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return;
    if (location.pathname !== '/') return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const timer = setTimeout(() => {
          setState({ isActive: true, currentPageIndex: 0, currentStepIndex: 0 });
        }, 1500);
        return () => clearTimeout(timer);
      }
    } catch { /* private browsing */ }
  }, [isAuthenticated, isLoadingAuth, location.pathname]);

  const startTour = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    navigate('/');
    setTimeout(() => {
      setState({ isActive: true, currentPageIndex: 0, currentStepIndex: 0 });
    }, 300);
  }, [navigate]);

  const startPageTour = useCallback((pageKey) => {
    const idx = tourPages.findIndex((p) => p.pageKey === pageKey);
    if (idx === -1) return;
    setState({ isActive: true, currentPageIndex: idx, currentStepIndex: 0 });
  }, []);

  const skipTour = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* */ }
    setState((s) => ({ ...s, isActive: false }));
  }, []);

  const nextStep = useCallback(() => {
    setState((s) => {
      const page = tourPages[s.currentPageIndex];
      if (!page) return s;
      if (s.currentStepIndex < page.steps.length - 1) {
        return { ...s, currentStepIndex: s.currentStepIndex + 1 };
      }
      if (s.currentPageIndex >= tourPages.length - 1) {
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* */ }
        return { ...s, isActive: false };
      }
      const nextPageIndex = s.currentPageIndex + 1;
      navigate(tourPages[nextPageIndex].path);
      return { isActive: true, currentPageIndex: nextPageIndex, currentStepIndex: 0 };
    });
  }, [navigate]);

  const prevStep = useCallback(() => {
    setState((s) => {
      if (s.currentStepIndex > 0) return { ...s, currentStepIndex: s.currentStepIndex - 1 };
      if (s.currentPageIndex === 0) return s;
      const prevPageIndex = s.currentPageIndex - 1;
      const prevPage = tourPages[prevPageIndex];
      navigate(prevPage.path);
      return { isActive: true, currentPageIndex: prevPageIndex, currentStepIndex: prevPage.steps.length - 1 };
    });
  }, [navigate]);

  const restartTour = useCallback(() => startTour(), [startTour]);

  const currentPage = tourPages[state.currentPageIndex];
  const currentStep = currentPage?.steps[state.currentStepIndex];
  const totalSteps = currentPage?.steps.length ?? 0;

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isActive: state.isActive,
    currentPageIndex: state.currentPageIndex,
    currentStepIndex: state.currentStepIndex,
    currentStep,
    totalSteps,
    startTour,
    startPageTour,
    nextStep,
    prevStep,
    skipTour,
    restartTour,
  }), [state, currentStep, totalSteps, startTour, startPageTour, nextStep, prevStep, skipTour, restartTour]);

  const showTour = state.isActive && currentStep &&
    location.pathname !== '/login' &&
    isAuthenticated;

  return (
    <TourContext.Provider value={value}>
      {children}
      {isAuthenticated && <HelpButton currentPath={location.pathname} />}
      {showTour && <TourTooltip />}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
