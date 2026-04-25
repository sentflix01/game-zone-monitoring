import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { useTranslation } from "@/i18n/I18nContext";
import { Download, TrendingUp, DollarSign, Receipt, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subMonths } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import PageSkeleton from "@/components/PageSkeleton";

const CATEGORY_COLORS = { snacks: "#eab308", repairs: "#ef4444", utilities: "#3b82f6", rent: "#a855f7", salaries: "#22c55e", other: "#6b7280" };
const chartStyle = { backgroundColor: "hsl(222 47% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: "8px", color: "#fff" };

export default function Analytics() {
  const { t } = useTranslation();
  const { ownerId } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) return;

    const load = async () => {
      try {
        const [s, e] = await Promise.all([
          storageAdapter.entities.Session.list(ownerId, "-created_date", 2000),
          storageAdapter.entities.Expense.list(ownerId, "-date"),
        ]);
        if (cancelled) return;
        setSessions(s);
        setExpenses(e);
      } catch (error) {
        console.error("Analytics failed to load:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [ownerId]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const monthSessions = sessions.filter((s) => s.status === "completed" && s.start_time?.startsWith(selectedMonth));
  const monthExpenses = expenses.filter((e) => e.date?.startsWith(selectedMonth));
  const monthEarnings = monthSessions.reduce((s, x) => s + (x.amount_charged || 0), 0);
  const monthExpTotal = monthExpenses.reduce((s, x) => s + (x.amount || 0), 0);
  const netProfit = monthEarnings - monthExpTotal;

  const trend = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i);
    const key = format(d, "yyyy-MM");
    const earn = sessions.filter((s) => s.status === "completed" && s.start_time?.startsWith(key)).reduce((s, x) => s + (x.amount_charged || 0), 0);
    const exp = expenses.filter((e) => e.date?.startsWith(key)).reduce((s, x) => s + (x.amount || 0), 0);
    return { month: format(d, "MMM"), earnings: parseFloat(earn.toFixed(2)), expenses: parseFloat(exp.toFixed(2)), profit: parseFloat((earn - exp).toFixed(2)) };
  });

  const expByCategory = {};
  monthExpenses.forEach((e) => { expByCategory[e.category] = (expByCategory[e.category] || 0) + (e.amount || 0); });
  const expCategories = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]);

  const consoleMap = {};
  monthSessions.forEach((s) => {
    if (!consoleMap[s.console_name]) consoleMap[s.console_name] = { sessions: 0, minutes: 0, type: s.console_type };
    consoleMap[s.console_name].sessions += 1;
    consoleMap[s.console_name].minutes += s.duration_minutes || 0;
  });
  const consoleUtil = Object.entries(consoleMap).sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 8);
  const maxSessions = consoleUtil[0]?.[1].sessions || 1;

  const downloadCSV = () => {
    const rows = [
      [`=== ANALYTICS REPORT — ${selectedMonth} ===`], [],
      ["KPI", "Value"], ["Earnings", monthEarnings.toFixed(2)], ["Expenses", monthExpTotal.toFixed(2)],
      ["Net Profit", netProfit.toFixed(2)], ["Sessions", monthSessions.length], [],
      ["=== EXPENSES BY CATEGORY ==="], ["Category", "Amount"],
      ...expCategories.map(([cat, amt]) => [cat, amt.toFixed(2)]), [],
      ["=== CONSOLE UTILIZATION ==="], ["Console", "Type", "Sessions", "Hours"],
      ...consoleUtil.map(([name, d]) => [name, d.type, d.sessions, (d.minutes / 60).toFixed(1)]), [],
      ["=== 12-MONTH TREND ==="], ["Month", "Earnings", "Expenses", "Profit"],
      ...trend.map((tr) => [tr.month, tr.earnings, tr.expenses, tr.profit]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gamezone-analytics-${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageSkeleton rows={4} />;

  const kpis = [
    { labelKey: 'analytics.kpi.earnings', value: `$${monthEarnings.toFixed(2)}`, color: "text-green-400", border: "border-green-500/20", icon: DollarSign },
    { labelKey: 'analytics.kpi.expenses', value: `$${monthExpTotal.toFixed(2)}`, color: "text-red-400", border: "border-red-500/20", icon: Receipt },
    { labelKey: 'analytics.kpi.netProfit', value: `$${netProfit.toFixed(2)}`, color: netProfit >= 0 ? "text-blue-400" : "text-red-400", border: "border-blue-500/20", icon: TrendingUp },
    { labelKey: 'analytics.kpi.sessions', value: monthSessions.length, color: "text-purple-400", border: "border-purple-500/20", icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('analytics.title')}</h2>
          <p className="text-game-muted text-sm mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div data-tour="date-filter" className="flex items-center gap-3">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-game-surface border border-game-border text-white text-sm rounded-lg px-3 py-2">
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <Button onClick={downloadCSV} variant="outline" className="bg-game-surface border-game-border text-white hover:bg-white/10 gap-2">
            <Download className="w-4 h-4" /> {t('analytics.export')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ labelKey, value, color, border, icon: Icon }) => (
          <div key={labelKey} className={`bg-game-surface border ${border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-game-muted text-xs">{t(labelKey)}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div data-tour="charts" className="space-y-6">
        <div className="bg-game-surface border border-game-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">{t('analytics.trend.title')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 14%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartStyle} />
              <Legend wrapperStyle={{ color: "hsl(215 20% 55%)", fontSize: 12 }} />
              <Line type="monotone" dataKey="earnings" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-game-surface border border-game-border rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">{t('analytics.expByCategory.title')}</h3>
            {expCategories.length === 0 ? <p className="text-game-muted text-sm">{t('analytics.expByCategory.empty')}</p> : (
              <div className="space-y-3">
                {expCategories.map(([cat, amt]) => {
                  const pct = monthExpTotal > 0 ? (amt / monthExpTotal) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between mb-1">
                        <span className="text-white text-sm capitalize">{t(`expenses.category.${cat}`) || cat}</span>
                        <span className="text-game-muted text-sm">${amt.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-game-bg rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] || "#6b7280" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-game-surface border border-game-border rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">{t('analytics.consoleUtil.title')}</h3>
            {consoleUtil.length === 0 ? <p className="text-game-muted text-sm">{t('analytics.consoleUtil.empty')}</p> : (
              <div className="space-y-3">
                {consoleUtil.map(([name, d]) => {
                  const pct = (d.sessions / maxSessions) * 100;
                  return (
                    <div key={name}>
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${d.type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"}`}>{d.type}</span>
                          <span className="text-white text-sm">{name}</span>
                        </div>
                        <span className="text-game-muted text-sm">{t('analytics.consoleUtil.detail').replace('{sessions}', d.sessions).replace('{hours}', (d.minutes / 60).toFixed(1))}</span>
                      </div>
                      <div className="h-1.5 bg-game-bg rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.type === "PS5" ? "#3b82f6" : "#a855f7" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-game-surface border border-game-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">{t('analytics.barChart.title')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 14%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartStyle} />
              <Legend wrapperStyle={{ color: "hsl(215 20% 55%)", fontSize: 12 }} />
              <Bar dataKey="earnings" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
