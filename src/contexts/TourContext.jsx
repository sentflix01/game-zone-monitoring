import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tourPages } from '@/i18n/tourSteps';
import TourTooltip from '@/components/TourTooltip';
import HelpButton from '@/components/HelpButton';

const STORAGE_KEY = 'tour_completed';

export const TourContext = createContext(null);

export function TourProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState({
    isActive: false,
    currentPageIndex: 0,
    currentStepIndex: 0,
  });

  // Auto-start on first visit (only when inside the app, not on login page)
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY) && location.pathname !== '/login') {
        setState({ isActive: true, currentPageIndex: 0, currentStepIndex: 0 });
      }
    } catch { /* private browsing */ }
  }, []);

  const startTour = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    navigate('/');
    setState({ isActive: true, currentPageIndex: 0, currentStepIndex: 0 });
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

      // Not last step of this page
      if (s.currentStepIndex < page.steps.length - 1) {
        return { ...s, currentStepIndex: s.currentStepIndex + 1 };
      }

      // Last step of last page → finish
      if (s.currentPageIndex >= tourPages.length - 1) {
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* */ }
        return { ...s, isActive: false };
      }

      // Advance to next page
      const nextPageIndex = s.currentPageIndex + 1;
      navigate(tourPages[nextPageIndex].path);
      return { isActive: true, currentPageIndex: nextPageIndex, currentStepIndex: 0 };
    });
  }, [navigate]);

  const prevStep = useCallback(() => {
    setState((s) => {
      // Not first step of this page — go back within page
      if (s.currentStepIndex > 0) {
        return { ...s, currentStepIndex: s.currentStepIndex - 1 };
      }
      // First step of first page — nothing to go back to
      if (s.currentPageIndex === 0) return s;
      // First step of a later page — go to previous page's last step
      const prevPageIndex = s.currentPageIndex - 1;
      const prevPage = tourPages[prevPageIndex];
      navigate(prevPage.path);
      return {
        isActive: true,
        currentPageIndex: prevPageIndex,
        currentStepIndex: prevPage.steps.length - 1,
      };
    });
  }, [navigate]);

  const restartTour = useCallback(() => {
    startTour();
  }, [startTour]);

  const currentPage = tourPages[state.currentPageIndex];
  const currentStep = currentPage?.steps[state.currentStepIndex];
  const totalSteps = currentPage?.steps.length ?? 0;

  return (
    <TourContext.Provider value={{
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
    }}>
      {children}
      <HelpButton currentPath={location.pathname} />
      {state.isActive && currentStep && location.pathname !== '/login' && <TourTooltip />}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
