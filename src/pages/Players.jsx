import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { useTranslation } from "@/i18n/I18nContext";
import { Trophy, Clock, DollarSign, Monitor, User } from "lucide-react";

export default function Players() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [p, s] = await Promise.all([
          storageAdapter.entities.Player.list("-total_spend"),
          storageAdapter.entities.Session.list("-created_date", 500),
        ]);

        if (cancelled) return;

        setPlayers(p);
        setSessions(s);
      } catch (error) {
        console.error("Players failed to load:", error);
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

  const playerSessions = selected
    ? sessions.filter(
        (s) =>
          s.player_name?.toLowerCase() === selected.name?.toLowerCase() &&
          s.status === "completed"
      )
    : [];

  const medal = (i) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );

  if (players.length === 0)
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('players.title')}</h2>
          <p className="text-game-muted text-sm mt-1">{t('players.subtitle').replace('{count}', players.length)}</p>
        </div>
        <div data-tour="add-player" className="bg-game-surface border border-game-border rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-game-muted mx-auto mb-3" />
          <p className="text-white font-medium">{t('players.empty.title')}</p>
          <p className="text-game-muted text-sm mt-1">{t('players.empty.subtitle')}</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{t('players.title')}</h2>
        <p className="text-game-muted text-sm mt-1">{t('players.subtitle').replace('{count}', players.length)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <div data-tour="player-list" className="space-y-3">
          {players.map((p, i) => {
            const totalSessions = (p.ps5_sessions || 0) + (p.ps4_sessions || 0);
            const ps5Pct =
              totalSessions > 0 ? ((p.ps5_sessions || 0) / totalSessions) * 100 : 0;
            const hrs = ((p.total_minutes || 0) / 60).toFixed(1);
            const isSelected = selected?.id === p.id;

            return (
              <button
                key={p.id}
                onClick={() => setSelected(isSelected ? null : p)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "bg-blue-600/10 border-blue-500/40"
                    : "bg-game-surface border-game-border hover:border-blue-500/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <span className="text-lg w-8 text-center shrink-0">{medal(i)}</span>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold truncate">{p.name}</p>
                      <span className="text-green-400 font-bold text-sm ml-2 shrink-0">
                        ${(p.total_spend || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-game-muted text-xs flex items-center gap-1">
                        <Monitor className="w-3 h-3" />
                        {p.total_sessions || 0} {t('players.stat.totalSessions')}
                      </span>
                      <span className="text-game-muted text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {hrs}h
                      </span>
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          p.favourite_console === "PS5"
                            ? "bg-blue-600/30 text-blue-300"
                            : "bg-purple-600/30 text-purple-300"
                        }`}
                      >
                        {p.favourite_console || "—"}
                      </span>
                    </div>

                    {/* PS4 vs PS5 bar */}
                    {totalSessions > 0 && (
                      <div className="mt-2 h-1.5 bg-game-bg rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${ps5Pct}%` }}
                        />
                        <div
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${100 - ps5Pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Player detail panel */}
        {selected && (
          <div data-tour="player-stats" className="bg-game-surface border border-game-border rounded-xl p-5 space-y-4 h-fit">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{selected.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{selected.name}</h3>
                <p className="text-game-muted text-xs">
                  {t('players.stat.lastSeen').replace('{date}', selected.last_seen ? new Date(selected.last_seen).toLocaleDateString() : '—')}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-game-bg rounded-lg p-3">
                <p className="text-game-muted text-xs mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> {t('players.stat.totalSpend')}</p>
                <p className="text-green-400 font-bold text-xl">${(selected.total_spend || 0).toFixed(2)}</p>
              </div>
              <div className="bg-game-bg rounded-lg p-3">
                <p className="text-game-muted text-xs mb-1 flex items-center gap-1"><Monitor className="w-3 h-3" /> {t('players.stat.totalSessions')}</p>
                <p className="text-white font-bold text-xl">{selected.total_sessions || 0}</p>
              </div>
              <div className="bg-game-bg rounded-lg p-3">
                <p className="text-game-muted text-xs mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {t('players.stat.hoursPlayed')}</p>
                <p className="text-blue-400 font-bold text-xl">{((selected.total_minutes || 0) / 60).toFixed(1)}h</p>
              </div>
              <div className="bg-game-bg rounded-lg p-3">
                <p className="text-game-muted text-xs mb-1 flex items-center gap-1"><Trophy className="w-3 h-3" /> {t('players.stat.favourite')}</p>
                <p className={`font-bold text-xl ${selected.favourite_console === "PS5" ? "text-blue-400" : "text-purple-400"}`}>
                  {selected.favourite_console || "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-game-muted text-xs mb-2">{t('players.breakdown.title')}</p>
              <div className="flex gap-4 text-sm">
                <span className="text-blue-300 font-medium">PS5: {selected.ps5_sessions || 0}</span>
                <span className="text-purple-300 font-medium">PS4: {selected.ps4_sessions || 0}</span>
              </div>
            </div>

            {playerSessions.length > 0 && (
              <div>
                <p className="text-game-muted text-xs mb-2">{t('players.recentSessions')}</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {playerSessions.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-game-bg rounded-lg px-3 py-2">
                      <div>
                        <p className="text-white text-xs font-medium">{s.console_name}</p>
                        <p className="text-game-muted text-xs">{new Date(s.start_time).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 text-xs font-bold">${(s.amount_charged || 0).toFixed(2)}</p>
                        <p className="text-game-muted text-xs">{s.duration_minutes || 0}m</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
