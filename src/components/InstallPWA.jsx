import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowBanner(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (installed || !showBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-blue-600 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <span className="font-bold text-sm">PS</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">Install Game Zone</p>
          <p className="text-blue-200 text-xs">Add to your home screen for quick access</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 flex items-center gap-1 bg-white text-blue-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Download className="w-3 h-3" /> Install
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="shrink-0 text-blue-200 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}