import { useEffect, useRef, useState, useCallback } from 'react';
import { useTour } from '@/contexts/TourContext';
import { useTranslation } from '@/i18n/I18nContext';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';

const TOOLTIP_W = 320;
const TOOLTIP_H = 200; // estimated
const PADDING = 12;

function getRect(selector) {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  } catch {
    return null;
  }
}

function computePosition(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return { top: vh / 2 - TOOLTIP_H / 2, left: vw / 2 - TOOLTIP_W / 2 };
  }

  // Prefer below
  let top = rect.bottom + PADDING;
  let left = rect.left;

  // Not enough space below → place above
  if (top + TOOLTIP_H > vh - PADDING) {
    top = rect.top - TOOLTIP_H - PADDING;
  }

  // Clamp horizontally
  left = Math.max(PADDING, Math.min(left, vw - TOOLTIP_W - PADDING));
  // Clamp vertically
  top = Math.max(PADDING, top);

  return { top, left };
}

export default function TourTooltip() {
  const { currentStep, currentStepIndex, totalSteps, currentPageIndex, nextStep, prevStep, skipTour } = useTour();
  const { t } = useTranslation();
  const tooltipRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [highlight, setHighlight] = useState(null);

  const updatePosition = useCallback(() => {
    if (!currentStep) return;
    const rect = getRect(currentStep.selector);
    setPos(computePosition(rect));
    setHighlight(rect);
  }, [currentStep]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Focus tooltip for keyboard nav
  useEffect(() => {
    tooltipRef.current?.focus();
  }, [currentStep]);

  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); nextStep(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep(); }
    else if (e.key === 'Escape') { e.preventDefault(); skipTour(); }
  }, [nextStep, prevStep, skipTour]);

  if (!currentStep) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  // Import tourPages to get total page count for step indicator
  const title = t(currentStep.titleKey);
  const body = t(currentStep.bodyKey);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] pointer-events-none">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />
        {/* Highlight cutout */}
        {highlight && (
          <div
            className="absolute rounded-lg ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent bg-transparent"
            style={{
              top: highlight.top - 4,
              left: highlight.left - 4,
              width: highlight.width + 8,
              height: highlight.height + 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        tabIndex={-1}
        onKeyDown={handleKey}
        className="fixed z-[9999] w-80 bg-game-surface border border-blue-500/40 rounded-xl shadow-2xl p-5 outline-none"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-blue-400 text-xs font-medium">
            {t('tour.step').replace('{current}', currentStepIndex + 1).replace('{total}', totalSteps)}
          </span>
          <button
            onClick={skipTour}
            className="text-game-muted hover:text-white transition-colors"
            aria-label={t('tour.skip')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-white font-bold text-base mb-2">{title}</h3>
        <p className="text-game-muted text-sm leading-relaxed mb-4">{body}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={skipTour}
            className="text-game-muted text-xs hover:text-white transition-colors"
          >
            {t('tour.skip')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={prevStep}
              disabled={isFirst}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-game-border text-game-muted hover:text-white hover:border-blue-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3 h-3" /> {t('tour.back')}
            </button>
            <button
              onClick={nextStep}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              {isLast ? t('tour.finish') : t('tour.next')} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
