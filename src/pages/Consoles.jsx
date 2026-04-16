import { useEffect, useState } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { Plus, Edit2, Trash2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/I18nContext";

export default function Consoles() {
  const { t } = useTranslation();
  const [consoles, setConsoles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionDialog, setSessionDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", type: "PS5", status: "available" });
  const [playerName, setPlayerName] = useState("");
  const [pastPlayers, setPastPlayers] = useState([]);

  const load = async () => {
    const [c, s, p, allSessions] = await Promise.all([
      storageAdapter.entities.Console.list(),
      storageAdapter.entities.Session.filter({ status: "active" }),
      storageAdapter.entities.Pricing.list(),
      storageAdapter.entities.Session.list("-created_date", 200),
    ]);
    setConsoles(c);
    setSessions(s);
    setPricing(p);
    const names = [...new Set(
      allSessions.map((s) => s.player_name).filter((n) => n && n !== "Anonymous")
    )];
    setPastPlayers(names);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", type: "PS5", status: "available" });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, status: c.status });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error(t('consoles.toast.nameRequired'));
    if (editing) {
      await storageAdapter.entities.Console.update(editing.id, form);
    } else {
      await storageAdapter.entities.Console.create(form);
    }
    toast.success(editing ? t('consoles.toast.updated') : t('consoles.toast.added'));
    setDialogOpen(false);
    load();
  };

  const remove = async (id) => {
    const hasActive = sessions.some((s) => s.console_id === id);
    if (hasActive) {
      toast.error(t('consoles.toast.deleteBlocked'));
      return;
    }
    await storageAdapter.entities.Console.delete(id);
    toast.success(t('consoles.toast.removed'));
    load();
  };

  const startSession = async () => {
    const c = sessionDialog;
    await storageAdapter.entities.Console.update(c.id, { status: "occupied" });
    await storageAdapter.entities.Session.create({
      console_id: c.id,
      console_name: c.name,
      console_type: c.type,
      player_name: playerName || "Anonymous",
      start_time: new Date().toISOString(),
      status: "active",
    });
    toast.success(t('consoles.toast.sessionStarted'));
    setSessionDialog(null);
    setPlayerName("");
    load();
  };

  const endSession = async (c) => {
    const active = sessions.find((s) => s.console_id === c.id);
    if (!active) return;
    const durationMin = Math.floor((Date.now() - new Date(active.start_time)) / 60000);
    const rate = pricing.find((p) => p.console_type === c.type);
    const amount = rate ? rate.hourly_rate : 0;
    const charged = parseFloat(amount.toFixed(2));

    await storageAdapter.entities.Session.update(active.id, {
      end_time: new Date().toISOString(),
      duration_minutes: durationMin,
      amount_charged: charged,
      status: "completed",
    });
    await storageAdapter.entities.Console.update(c.id, { status: "available" });

    // Auto-create or update player profile for named players
    const name = active.player_name;
    if (name && name !== "Anonymous") {
      const allPlayers = await storageAdapter.entities.Player.list();
      const existing = allPlayers.find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      const ps5Add = c.type === "PS5" ? 1 : 0;
      const ps4Add = c.type === "PS4" ? 1 : 0;
      if (existing) {
        const newPs5 = (existing.ps5_sessions || 0) + ps5Add;
        const newPs4 = (existing.ps4_sessions || 0) + ps4Add;
        await storageAdapter.entities.Player.update(existing.id, {
          total_sessions: (existing.total_sessions || 0) + 1,
          total_minutes: (existing.total_minutes || 0) + durationMin,
          total_spend: parseFloat(((existing.total_spend || 0) + charged).toFixed(2)),
          ps5_sessions: newPs5,
          ps4_sessions: newPs4,
          favourite_console: newPs5 >= newPs4 ? "PS5" : "PS4",
          last_seen: new Date().toISOString(),
        });
      } else {
        await storageAdapter.entities.Player.create({
          name,
          total_sessions: 1,
          total_minutes: durationMin,
          total_spend: charged,
          ps5_sessions: ps5Add,
          ps4_sessions: ps4Add,
          favourite_console: c.type,
          last_seen: new Date().toISOString(),
        });
      }
    }

    toast.success(t('consoles.toast.sessionEnded').replace('{amount}', charged.toFixed(2)));
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('consoles.title')}</h2>
          <p className="text-game-muted text-sm mt-1">{t('consoles.subtitle').replace('{count}', consoles.length)}</p>
        </div>
        <Button data-tour="add-console" onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
          <Plus className="w-4 h-4" /> {t('consoles.addButton')}
        </Button>
      </div>

      <div data-tour="console-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {consoles.map((c) => {
          const active = sessions.find((s) => s.console_id === c.id);
          const elapsed = active ? Math.floor((Date.now() - new Date(active.start_time)) / 60000) : null;
          return (
            <div key={c.id} className={`rounded-xl border p-5 space-y-4 transition-all ${
              c.status === "available" ? "bg-game-surface border-green-500/20" :
              c.status === "occupied" ? "bg-game-surface border-blue-500/30" :
              "bg-game-surface border-red-500/20"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    c.type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"
                  }`}>{c.type}</span>
                  <h3 className="text-white font-bold text-lg mt-2">{c.name}</h3>
                </div>
                <div data-tour="status-indicators" className={`w-3 h-3 rounded-full mt-1 ${
                  c.status === "available" ? "bg-green-400" :
                  c.status === "occupied" ? "bg-blue-400 animate-pulse" : "bg-red-400"
                }`} />
              </div>

              {active && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-blue-300 text-xs font-medium">{t('consoles.playing').replace('{name}', active.player_name)}</p>
                  <p className="text-white font-bold text-xl mt-1">{elapsed}m</p>
                </div>
              )}

              <div className="flex gap-2">
                {c.status === "available" && (
                  <Button
                    data-tour="start-session"
                    onClick={() => setSessionDialog(c)}
                    className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 gap-1"
                    variant="outline"
                  >
                    <Play className="w-3 h-3" /> {t('consoles.action.start')}
                  </Button>
                )}
                {c.status === "occupied" && (
                  <Button
                    onClick={() => endSession(c)}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 gap-1"
                    variant="outline"
                  >
                    <Square className="w-3 h-3" /> {t('consoles.action.end')}
                  </Button>
                )}
                <Button onClick={() => openEdit(c)} variant="outline" size="icon" className="border-game-border text-game-muted hover:text-white">
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button onClick={() => remove(c.id)} variant="outline" size="icon" className="border-red-500/30 text-red-400 hover:bg-red-600/20">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-game-surface border-game-border text-white">
          <DialogHeader>
            <DialogTitle>{t(editing ? 'consoles.dialog.editTitle' : 'consoles.dialog.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-game-muted text-sm mb-1 block">{t('consoles.dialog.nameLabel')}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('consoles.dialog.namePlaceholder')}
                className="bg-game-bg border-game-border text-white"
              />
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1 block">{t('consoles.dialog.typeLabel')}</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-game-bg border-game-border text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-game-surface border-game-border">
                  <SelectItem value="PS5">PS5</SelectItem>
                  <SelectItem value="PS4">PS4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1 block">{t('consoles.dialog.statusLabel')}</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-game-bg border-game-border text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-game-surface border-game-border">
                  <SelectItem value="available">{t('consoles.status.available')}</SelectItem>
                  <SelectItem value="maintenance">{t('consoles.status.maintenance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
              {t(editing ? 'consoles.dialog.saveEdit' : 'consoles.dialog.saveAdd')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start Session Dialog */}
      <Dialog open={!!sessionDialog} onOpenChange={() => setSessionDialog(null)}>
        <DialogContent className="bg-game-surface border-game-border text-white">
          <DialogHeader>
            <DialogTitle>{t('consoles.session.startTitle').replace('{name}', sessionDialog?.name)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-game-muted text-sm mb-1 block">{t('consoles.session.playerLabel')}</label>
              <Input
                list="past-players"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t('consoles.session.playerPlaceholder')}
                className="bg-game-bg border-game-border text-white"
              />
              <datalist id="past-players">
                {pastPlayers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <Button onClick={startSession} className="w-full bg-green-600 hover:bg-green-500 text-white gap-2">
              <Play className="w-4 h-4" /> {t('consoles.session.startButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
