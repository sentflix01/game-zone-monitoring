import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Monitor, Clock, DollarSign, Zap, Download, CheckCircle, TrendingUp, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { subDays } from "date-fns";

const chartStyle = {
  backgroundColor: "hsl(222 47% 8%)",
  border: "1px solid hsl(222 30% 14%)",
  borderRadius: "8px",
  color: "#fff",
};

export default function Dashboard() {
  const [consoles, setConsoles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__installPrompt || null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia("(display-mode: standalone)").matches
  );
  const [installDone, setInstallDone] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); window.__installPrompt = e; setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
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
      base44.entities.Session.list("-created_date", 500),
      base44.entities.Expense.list("-date"),
    ]).then(([c, s, e]) => {
      setConsoles(c);
      setSessions(s);
      setExpenses(e);
      setLoading(false);
    });
  }, []);

  const today = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const todaySessions = sessions.filter((s) => new Date(s.start_time).toDateString() === today);
  const todayEarnings = todaySessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (s.amount_charged || 0), 0);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const availableConsoles = consoles.filter((c) => c.status === "available").length;
  const occupiedConsoles = consoles.filter((c) => c.status === "occupied").length;

  // Expenses
  const todayExpenses = expenses
    .filter((e) => e.date === todayISO)
    .reduce((s, e) => s + (e.amount || 0), 0);
  const monthEarnings = sessions
    .filter((s) => s.status === "completed" && s.start_time?.startsWith(thisMonth))
    .reduce((s, x) => s + (x.amount_charged || 0), 0);
  const monthExpenses = expenses
    .filter((e) => e.date?.startsWith(thisMonth))
    .reduce((s, e) => s + (e.amount || 0), 0);

  // Occupancy chart — PS5 vs PS4 sessions by hour of day (last 7 days)
  const sevenDaysAgo = subDays(new Date(), 7);
  const recentSessions = sessions.filter(
    (s) => s.status === "completed" && new Date(s.start_time) >= sevenDaysAgo
  );
  const hourlyMap = {};
  for (let h = 0; h < 24; h++) hourlyMap[h] = { hour: `${h}:00`, PS5: 0, PS4: 0 };
  recentSessions.forEach((s) => {
    const h = new Date(s.start_time).getHours();
    if (s.console_type === "PS5") hourlyMap[h].PS5 += 1;
    else if (s.console_type === "PS4") hourlyMap[h].PS4 += 1;
  });
  const hourlyData = Object.values(hourlyMap).filter((h) => h.PS5 > 0 || h.PS4 > 0);

  // Peak hour
  const peakHour = hourlyData.reduce(
    (best, h) => (h.PS5 + h.PS4 > (best?.PS5 + best?.PS4 || 0) ? h : best),
    null
  );

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

      {/* Earnings vs Expenses card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today */}
        <div className="bg-game-surface border border-game-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Today's P&L
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-game-muted text-sm">Earnings</span>
              <span className="text-green-400 font-bold">${todayEarnings.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-game-muted text-sm">Expenses</span>
              <span className="text-red-400 font-bold">${todayExpenses.toFixed(2)}</span>
            </div>
            <div className="border-t border-game-border pt-2 flex justify-between">
              <span className="text-white text-sm font-semibold">Net Profit</span>
              <span className={`font-bold ${todayEarnings - todayExpenses >= 0 ? "text-blue-400" : "text-red-400"}`}>
                ${(todayEarnings - todayExpenses).toFixed(2)}
              </span>
            </div>
          </div>
          <Link to="/expenses" className="text-blue-400 text-xs mt-3 block hover:text-blue-300">
            Manage expenses →
          </Link>
        </div>

        {/* This month */}
        <div className="bg-game-surface border border-game-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-purple-400" /> This Month
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-game-muted text-sm">Earnings</span>
              <span className="text-green-400 font-bold">${monthEarnings.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-game-muted text-sm">Expenses</span>
              <span className="text-red-400 font-bold">${monthExpenses.toFixed(2)}</span>
            </div>
            <div className="border-t border-game-border pt-2 flex justify-between">
              <span className="text-white text-sm font-semibold">Net Profit</span>
              <span className={`font-bold ${monthEarnings - monthExpenses >= 0 ? "text-blue-400" : "text-red-400"}`}>
                ${(monthEarnings - monthExpenses).toFixed(2)}
              </span>
            </div>
          </div>
          <Link to="/analytics" className="text-blue-400 text-xs mt-3 block hover:text-blue-300">
            Full analytics →
          </Link>
        </div>
      </div>

      {/* Occupancy chart — last 7 days */}
      {hourlyData.length > 0 && (
        <div className="bg-game-surface border border-game-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="text-white font-semibold">Console Occupancy — Last 7 Days</h3>
            {peakHour && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full font-medium">
                Peak hour: {peakHour.hour} ({peakHour.PS5 + peakHour.PS4} sessions)
              </span>
            )}
          </div>
          <p className="text-game-muted text-xs mb-4">Sessions by hour of day (PS5 vs PS4)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 14%)" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={chartStyle} />
              <Legend wrapperStyle={{ color: "hsl(215 20% 55%)", fontSize: 12 }} />
              <Bar dataKey="PS5" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="PS4" fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

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
              <div key={c.id} className={`rounded-xl border p-4 flex flex-col gap-2 transition-all ${
                c.status === "available" ? "bg-green-400/5 border-green-500/30" :
                c.status === "occupied" ? "bg-blue-400/5 border-blue-500/30" :
                "bg-red-400/5 border-red-500/30"
              }`}>
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
                {elapsed !== null && <p className="text-game-muted text-xs">{elapsed}m playing</p>}
                {c.status === "available" && <p className="text-green-400 text-xs font-medium">Ready</p>}
                {c.status === "maintenance" && <p className="text-red-400 text-xs font-medium">Maintenance</p>}
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
