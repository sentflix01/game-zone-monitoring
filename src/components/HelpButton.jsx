import { HelpCircle } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';
import { tourPages } from '@/i18n/tourSteps';

export default function HelpButton({ currentPath }) {
  const { startPageTour } = useTour();

  const page = tourPages.find((p) => p.path === currentPath);
  if (!page) return null;

  return (
    <button
      onClick={() => startPageTour(page.pageKey)}
      className="fixed bottom-20 right-4 md:bottom-6 z-[9997] w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center transition-colors"
      aria-label="Help — start page tour"
      title="Help"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}
