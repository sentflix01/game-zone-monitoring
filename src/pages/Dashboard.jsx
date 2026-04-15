import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Monitor, Clock, DollarSign, Zap, Download, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [consoles, setConsoles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__installPrompt || null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia("(display-mode: standalone)").matches
  );
  const [installDone, setInstallDone] = useState(false);

  useEffect(() => {
    // Pick up any prompt that fires after mount
    const handler = (e) => { e.preventDefault(); window.__installPrompt = e; setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    // Also grab it if it was already captured before React loaded
    if (window.__installPrompt) setDeferredPrompt(window.__installPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || window.__installPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstallDone(true);
    window.__installPrompt = null;
    setDeferredPrompt(null);
  };

  useEffect(() => {
    Promise.all([
      base44.entities.Console.list(),
      base44.entities.Session.list("-created_date", 100),
    ]).then(([c, s]) => {
      setConsoles(c);
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const today = new Date().toDateString();
  const todaySessions = sessions.filter(
    (s) => new Date(s.start_time).toDateString() === today
  );
  const todayEarnings = todaySessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (s.amount_charged || 0), 0);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const availableConsoles = consoles.filter((c) => c.status === "available").length;
  const occupiedConsoles = consoles.filter((c) => c.status === "occupied").length;

  const stats = [
    { label: "Available", value: availableConsoles, icon: Monitor, color: "text-green-400", bg: "bg-green-400/10 border-green-500/20" },
    { label: "In Use", value: occupiedConsoles, icon: Zap, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-500/20" },
    { label: "Active Sessions", value: activeSessions.length, icon: Clock, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-500/20" },
    { label: "Today's Earnings", value: `$${todayEarnings.toFixed(2)}`, icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-500/20" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-game-muted text-sm mt-1">Live overview of your game zone</p>
      </div>

      {/* Install App Banner */}
      {!isInstalled && (
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">PS</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Install Game Zone on your device</p>
            <p className="text-game-muted text-xs mt-0.5">Works offline · Fast access · Home screen shortcut</p>
          </div>
          {installDone ? (
            <div className="flex items-center gap-1.5 text-green-400 text-sm font-semibold shrink-0">
              <CheckCircle className="w-4 h-4" /> Installed!
            </div>
          ) : deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Install Now
            </button>
          ) : (
            <p className="text-game-muted text-xs shrink-0">Tap ⋯ → "Add to Home Screen" in your browser</p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-game-muted text-xs font-medium">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Console Status Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Console Status</h3>
          <Link to="/consoles" className="text-blue-400 text-sm hover:text-blue-300 transition-colors">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {consoles.map((c) => {
            const activeSession = activeSessions.find((s) => s.console_id === c.id);
            const elapsed = activeSession
              ? Math.floor((Date.now() - new Date(activeSession.start_time)) / 60000)
              : null;
            return (
              <div
                key={c.id}
                className={`rounded-xl border p-4 flex flex-col gap-2 transition-all ${
                  c.status === "available"
                    ? "bg-green-400/5 border-green-500/30"
                    : c.status === "occupied"
                    ? "bg-blue-400/5 border-blue-500/30"
                    : "bg-red-400/5 border-red-500/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    c.type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"
                  }`}>{c.type}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    c.status === "available" ? "bg-green-400" :
                    c.status === "occupied" ? "bg-blue-400 animate-pulse" : "bg-red-400"
                  }`} />
                </div>
                <p className="text-white font-semibold text-sm">{c.name}</p>
                {elapsed !== null && (
                  <p className="text-game-muted text-xs">{elapsed}m playing</p>
                )}
                {c.status === "available" && (
                  <p className="text-green-400 text-xs font-medium">Ready</p>
                )}
                {c.status === "maintenance" && (
                  <p className="text-red-400 text-xs font-medium">Maintenance</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-4">Active Sessions</h3>
          <div className="space-y-2">
            {activeSessions.map((s) => {
              const elapsed = Math.floor((Date.now() - new Date(s.start_time)) / 60000);
              return (
                <div key={s.id} className="bg-game-surface border border-game-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <div>
                      <p className="text-white text-sm font-medium">{s.console_name}</p>
                      <p className="text-game-muted text-xs">{s.player_name || "Anonymous"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 text-sm font-bold">{elapsed}m</p>
                    <p className="text-game-muted text-xs">{s.console_type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}