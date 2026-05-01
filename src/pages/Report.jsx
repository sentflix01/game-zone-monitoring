import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { DollarSign, Clock, Trophy, BarChart2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer
} from "recharts";
import { subDays, format } from "date-fns";
import { useTranslation } from "@/i18n/I18nContext";
import PageSkeleton from "@/components/PageSkeleton";
import { useAuth } from "@/lib/AuthContext";

export default function Report() {
  const { t } = useTranslation();
  const { ownerId } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(!ownerId);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) return;

    const load = async () => {
      try {
        const s = await storageAdapter.entities.Session.list(ownerId, "-created_date", 1000);
        if (cancelled) return;
        setSessions(s);
      } catch (error) {
        console.error("Report failed to load:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [ownerId]);

  const today = new Date().toDateString();
  const todaySessions = sessions.filter(
    (s) => new Date(s.start_time).toDateString() === today && s.status === "completed"
  );

  const totalEarnings = todaySessions.reduce((sum, s) => sum + (s.amount_charged || 0), 0);
  const totalMinutes = todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const usageMap = {};
  todaySessions.forEach((s) => {
    usageMap[s.console_name] = (usageMap[s.console_name] || 0) + 1;
  });
  const sortedConsoles = Object.entries(usageMap).sort((a, b) => b[1] - a[1]);
  const topConsole = sortedConsoles[0];

  const earningsByConsole = {};
  todaySessions.forEach((s) => {
    if (!earningsByConsole[s.console_name]) {
      earningsByConsole[s.console_name] = { sessions: 0, minutes: 0, earnings: 0, type: s.console_type };
    }
    earningsByConsole[s.console_name].sessions += 1;
    earningsByConsole[s.console_name].minutes += s.duration_minutes || 0;
    earningsByConsole[s.console_name].earnings += s.amount_charged || 0;
  });
  const consoleBreakdown = Object.entries(earningsByConsole).sort((a, b) => b[1].earnings - a[1].earnings);

  // 30-day revenue trend
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    return { date: format(d, "MMM d"), dateStr: d.toDateString(), revenue: 0 };
  });
  sessions.filter((s) => s.status === "completed").forEach((s) => {
    const ds = new Date(s.start_time).toDateString();
    const entry = last30Days.find((d) => d.dateStr === ds);
    if (entry) entry.revenue = parseFloat((entry.revenue + (s.amount_charged || 0)).toFixed(2));
  });

  // Hourly PS4 vs PS5
  const hourlyMap = {};
  for (let h = 0; h < 24; h++) hourlyMap[h] = { hour: `${h}:00`, PS5: 0, PS4: 0 };
  sessions.filter((s) => s.status === "completed").forEach((s) => {
    const h = new Date(s.start_time).getHours();
    if (s.console_type === "PS5") hourlyMap[h].PS5 = parseFloat((hourlyMap[h].PS5 + (s.amount_charged || 0)).toFixed(2));
    else if (s.console_type === "PS4") hourlyMap[h].PS4 = parseFloat((hourlyMap[h].PS4 + (s.amount_charged || 0)).toFixed(2));
  });
  const hourlyData = Object.values(hourlyMap).filter((h) => h.PS5 > 0 || h.PS4 > 0);

  // Monthly breakdown
  const monthlyMap = {};
  sessions.filter((s) => s.status === "completed").forEach((s) => {
    const key = format(new Date(s.start_time), "yyyy-MM");
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, revenue: 0, sessions: 0, minutes: 0 };
    monthlyMap[key].revenue = parseFloat((monthlyMap[key].revenue + (s.amount_charged || 0)).toFixed(2));
    monthlyMap[key].sessions += 1;
    monthlyMap[key].minutes += s.duration_minutes || 0;
  });
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

  const downloadCSV = () => {
    const rows = [];

    rows.push([`=== DAILY SUMMARY — ${new Date().toLocaleDateString()} ===`]);
    rows.push(["Total Earnings", "Total Sessions", "Total Minutes", "Most Used Console"]);
    rows.push([`$${totalEarnings.toFixed(2)}`, todaySessions.length, totalMinutes, topConsole ? topConsole[0] : "N/A"]);
    rows.push([]);

    rows.push(["=== CONSOLE BREAKDOWN TODAY ==="]);
    rows.push(["Console", "Type", "Sessions", "Minutes", "Earnings"]);
    consoleBreakdown.forEach(([name, d]) => {
      rows.push([name, d.type, d.sessions, d.minutes, `$${d.earnings.toFixed(2)}`]);
    });
    rows.push([]);

    rows.push(["=== MONTHLY PERFORMANCE ==="]);
    rows.push(["Month", "Sessions", "Total Minutes", "Revenue"]);
    monthlyData.forEach((m) => {
      rows.push([m.month, m.sessions, m.minutes, `$${m.revenue.toFixed(2)}`]);
    });

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-zone-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartTooltipStyle = {
    backgroundColor: "hsl(222 47% 8%)",
    border: "1px solid hsl(222 30% 14%)",
    borderRadius: "8px",
    color: "#fff",
  };

  if (loading) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div data-tour="report-sections" className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('report.title')}</h2>
          <p className="text-game-muted text-sm mt-1">
            {t('report.subtitle').replace('{date}', new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}
          </p>
        </div>
        <div data-tour="export-controls">
          <Button onClick={downloadCSV} className="bg-game-surface border border-game-border text-white hover:bg-white/10 gap-2" variant="outline">
            <Download className="w-4 h-4" /> {t('report.download')}
          </Button>
        </div>
      </div>

      {todaySessions.length === 0 ? (
        <div className="bg-game-surface border border-game-border rounded-xl p-12 text-center">
          <BarChart2 className="w-12 h-12 text-game-muted mx-auto mb-3" />
          <p className="text-white font-medium">{t('report.empty')}</p>
          <p className="text-game-muted text-sm mt-1">{t('report.empty.subtitle')}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-game-surface border border-yellow-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <span className="text-game-muted text-xs font-medium">{t('report.earnings')}</span>
              </div>
              <p className="text-3xl font-bold text-yellow-400">${totalEarnings.toFixed(2)}</p>
              <p className="text-game-muted text-xs mt-1">{todaySessions.length} {t('common.sessions').toLowerCase()}</p>
            </div>
            <div className="bg-game-surface border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-game-muted text-xs font-medium">{t('report.hoursPlayed')}</span>
              </div>
              <p className="text-3xl font-bold text-blue-400">{totalHours}h</p>
              <p className="text-game-muted text-xs mt-1">{totalMinutes} {t('common.minutes').toLowerCase()}</p>
            </div>
            <div className="bg-game-surface border border-purple-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-purple-400" />
                <span className="text-game-muted text-xs font-medium">{t('report.mostUsed')}</span>
              </div>
              {topConsole ? (
                <>
                  <p className="text-xl font-bold text-purple-400 truncate">{topConsole[0]}</p>
                  <p className="text-game-muted text-xs mt-1">{topConsole[1]} {t('common.sessions').toLowerCase()}</p>
                </>
              ) : (
                <p className="text-game-muted text-sm">—</p>
              )}
            </div>
          </div>

          {/* Console breakdown */}
          <div className="bg-game-surface border border-game-border rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">{t('report.breakdown.title')}</h3>
            <div className="space-y-3">
              {consoleBreakdown.map(([name, data]) => {
                const pct = totalEarnings > 0 ? (data.earnings / totalEarnings) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          data.type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"
                        }`}>{data.type}</span>
                        <span className="text-white text-sm font-medium">{name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-green-400 font-semibold text-sm">${data.earnings.toFixed(2)}</span>
                        <span className="text-game-muted text-xs ml-2">{(data.minutes / 60).toFixed(1)}h</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-game-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 30-day revenue trend */}
      <div data-tour="date-range" className="bg-game-surface border border-game-border rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">{t('report.revenue.title')}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={last30Days} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 14%)" />
            <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} interval={4} />
            <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`$${v}`, "Revenue"]} />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly PS4 vs PS5 */}
      {hourlyData.length > 0 && (
        <div className="bg-game-surface border border-game-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">{t('report.hourly.title')}</h3>
          <p className="text-game-muted text-xs mb-4">{t('report.hourly.subtitle')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 14%)" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v, name) => [`$${v}`, name]} />
              <Legend wrapperStyle={{ color: "hsl(215 20% 55%)", fontSize: 12 }} />
              <Bar dataKey="PS5" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="PS4" fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Wasted Time Session List */}
      {(() => {
        const wastedSessions = sessions
          .filter((s) => s.status === "completed" && (s.wasted_minutes || 0) > 0)
          .sort((a, b) => (b.wasted_minutes || 0) - (a.wasted_minutes || 0))
          .slice(0, 50);

        const totalWastedMin = sessions
          .filter((s) => s.status === "completed")
          .reduce((sum, s) => sum + (s.wasted_minutes || 0), 0);
        const totalWastedCost = sessions
          .filter((s) => s.status === "completed")
          .reduce((sum, s) => sum + (s.wasted_cost || 0), 0);

        return (
          <div className="bg-game-surface border border-game-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="text-white font-semibold">Wasted Time Report</h3>
              <div className="flex gap-4 text-xs">
                <span className="text-red-400 font-bold">Total overtime: {totalWastedMin}m</span>
                <span className="text-orange-400 font-bold">Wasted cost: {totalWastedCost.toFixed(2)} ETB</span>
              </div>
            </div>
            <p className="text-game-muted text-xs mb-4">Sessions where actual time exceeded the standard game time setting.</p>
            {wastedSessions.length === 0 ? (
              <p className="text-game-muted text-sm text-center py-6">No overtime sessions recorded yet.</p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-2 px-3 py-1 text-xs text-game-muted font-medium border-b border-game-border">
                  <span>Player</span>
                  <span>Console</span>
                  <span className="text-center">Duration</span>
                  <span className="text-center text-red-400">Overtime</span>
                  <span className="text-right text-orange-400">Wasted Cost</span>
                </div>
                {wastedSessions.map((s) => (
                  <div key={s.id} className="grid grid-cols-5 gap-2 bg-game-bg border border-red-500/10 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white font-medium truncate">{s.player_name || "Anonymous"}</span>
                    <span className="text-game-muted truncate">{s.console_name}</span>
                    <span className="text-game-muted text-center">{s.duration_minutes || 0}m</span>
                    <span className="text-red-400 font-bold text-center">+{s.wasted_minutes}m</span>
                    <span className="text-orange-400 font-bold text-right">{(s.wasted_cost || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
