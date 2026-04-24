import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { Clock, DollarSign, Calendar } from "lucide-react";
import { useTranslation } from "@/i18n/I18nContext";

export default function Sessions() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const s = await storageAdapter.entities.Session.list("-created_date", 200);
        if (cancelled) return;
        setSessions(s);
      } catch (error) {
        console.error("Sessions failed to load:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toDateString();
  const filtered = sessions.filter((s) => {
    if (filter === "active") return s.status === "active";
    if (filter === "today") return new Date(s.start_time).toDateString() === today;
    return true;
  });

  const totalEarnings = sessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (s.amount_charged || 0), 0);

  const todayEarnings = sessions
    .filter((s) => s.status === "completed" && new Date(s.start_time).toDateString() === today)
    .reduce((sum, s) => sum + (s.amount_charged || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{t('sessions.title')}</h2>
        <p className="text-game-muted text-sm mt-1">{t('sessions.subtitle')}</p>
      </div>

      {/* Earnings summary */}
      <div data-tour="earnings-summary" className="grid grid-cols-2 gap-4">
        <div className="bg-game-surface border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-yellow-400" />
            <span className="text-game-muted text-xs">{t('sessions.todayEarnings')}</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">${todayEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-game-surface border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-game-muted text-xs">{t('sessions.totalEarnings')}</span>
          </div>
          <p className="text-2xl font-bold text-green-400">${totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div data-tour="filter-tabs" className="flex gap-2">
        {[
          { value: "all", label: t('sessions.filter.all') },
          { value: "active", label: t('sessions.filter.active') },
          { value: "today", label: t('sessions.filter.today') },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-game-surface border border-game-border text-game-muted hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      <div data-tour="sessions-list" className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-game-muted">{t('sessions.empty')}</div>
        )}
        {filtered.map((s) => {
          const elapsed = s.status === "active"
            ? Math.floor((Date.now() - new Date(s.start_time)) / 60000)
            : s.duration_minutes;
          const hrs = Math.floor((elapsed || 0) / 60);
          const mins = (elapsed || 0) % 60;
          const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          return (
            <div
              key={s.id}
              className={`bg-game-surface border rounded-xl px-4 py-3 flex items-center justify-between ${
                s.status === "active" ? "border-blue-500/30" : "border-game-border"
              }`}
            >
              <div className="flex items-center gap-3">
                {s.status === "active" ? (
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-game-muted" />
                )}
                <div>
                  <p className="text-white text-sm font-medium">{s.console_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-game-muted text-xs">{s.player_name || t('common.anonymous')}</span>
                    <span className="text-game-muted text-xs">•</span>
                    <span className={`text-xs font-medium ${s.console_type === "PS5" ? "text-blue-400" : "text-purple-400"}`}>
                      {s.console_type}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3 text-game-muted" />
                  <span className="text-white text-sm font-semibold">{durationStr}</span>
                </div>
                {s.status === "completed" && (
                  <p className="text-green-400 text-sm font-bold mt-0.5">${(s.amount_charged || 0).toFixed(2)}</p>
                )}
                {s.status === "active" && (
                  <span className="text-blue-400 text-xs">{t('common.live')}</span>
                )}
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Calendar className="w-3 h-3 text-game-muted" />
                  <span className="text-game-muted text-xs">{new Date(s.start_time).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
