import { useEffect, useState, useRef } from "react";
import { storageAdapter } from "@/api/storageAdapter";
import { Plus, Edit2, Trash2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/I18nContext";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/lib/AuthContext";

function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatDurationShort(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m " + s + "s";
  return s + "s";
}

async function sendWelcomeSMS(phone, consoleName) {
  try {
    const apiKey = localStorage.getItem("callmebot_api_key");
    if (!apiKey || !phone) return;
    const msg = encodeURIComponent("Welcome to JONA PlayStation Game Zone! Enjoy your session on " + consoleName + ". \uD83C\uDFAE");
    await fetch("https://api.callmebot.com/whatsapp.php?phone=" + phone + "&text=" + msg + "&apikey=" + apiKey);
  } catch (_) {}
}

export default function Consoles() {
  const { t } = useTranslation();
  const { ownerId } = useAuth();
  const [consoles, setConsoles] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", type: "PS5", status: "available" });
  const [consoleState, setConsoleState] = useState({});
  const tickRef = useRef(null);
  const [startDialog, setStartDialog] = useState(null);
  const [startForm, setStartForm] = useState({ playerName: "", phone: "" });

  const load = async () => {
    if (!ownerId) return;
    try {
      const [c, p] = await Promise.all([
        storageAdapter.entities.Console.list(ownerId),
        storageAdapter.entities.Pricing.list(ownerId),
      ]);
      setConsoles(c);
      setPricing(p);
    } catch (error) {
      console.error("Consoles failed to load:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [ownerId]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setConsoleState((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (next[id].activeStart) {
            const secs = Math.floor((Date.now() - next[id].activeStart) / 1000);
            if (secs !== next[id].activeSecs) {
              next[id] = { ...next[id], activeSecs: secs };
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const getCS = (id) => consoleState[id] || { status: "idle", sessionRows: [], mergedRow: null };

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
    if (!form.name) return toast.error("Console name is required");
    if (editing) {
      await storageAdapter.entities.Console.update(ownerId, editing.id, form);
    } else {
      await storageAdapter.entities.Console.create(ownerId, form);
    }
    toast.success(editing ? "Console updated" : "Console added");
    setDialogOpen(false);
    load();
  };

  const remove = async (id) => {
    const cs = getCS(id);
    if (cs.activeStart) {
      toast.error("Cannot delete a console with an active session");
      return;
    }
    await storageAdapter.entities.Console.delete(ownerId, id);
    toast.success("Console removed");
    load();
  };

  const handleStartClick = (c) => {
    const cs = getCS(c.id);
    if (cs.activeStart) return;

    if (cs.sessionRows && cs.sessionRows.length > 0) {
      const totalPrice = cs.sessionRows.reduce((s, r) => s + r.price, 0);
      const mergedRow = {
        name: cs.sessionRows[0].name,
        games: cs.sessionRows.length,
        totalPrice,
      };
      setConsoleState((prev) => ({
        ...prev,
        [c.id]: { ...getCS(c.id), sessionRows: [], mergedRow, status: "idle" },
      }));
    }

    setStartForm({ playerName: "", phone: "" });
    setStartDialog(c);
  };

  const confirmStart = async () => {
    const c = startDialog;
    if (!startForm.playerName.trim()) return toast.error("Player name is required");

    const name = startForm.playerName.trim();
    const phone = startForm.phone.trim();

    await storageAdapter.entities.Console.update(ownerId, c.id, { status: "occupied" });
    await storageAdapter.entities.Session.create(ownerId, {
      console_id: c.id,
      console_name: c.name,
      console_type: c.type,
      player_name: name,
      player_phone: phone || null,
      start_time: new Date().toISOString(),
      status: "active",
      amount_charged: 0,
      games: [],
    });

    if (phone) sendWelcomeSMS(phone, c.name);

    setConsoleState((prev) => ({
      ...prev,
      [c.id]: {
        ...getCS(c.id),
        status: "active",
        activePlayer: name,
        activePhone: phone,
        activeStart: Date.now(),
        activeSecs: 0,
      },
    }));

    setStartDialog(null);
    toast.success("Session started for " + name);
  };

  // END — flat session price from settings (not time-based)
  const handleEnd = async (c) => {
    const cs = getCS(c.id);
    if (!cs.activeStart) return;

    const secs = Math.floor((Date.now() - cs.activeStart) / 1000);

    // Flat price per session — same regardless of duration
    const rate = pricing.find((p) => p.console_type === c.type);
    const price = rate ? parseFloat((rate.hourly_rate).toFixed(2)) : 0;

    // Wasted time = actual duration - standard game time (in minutes)
    const durationMin = secs / 60;
    const gameTimeMin = rate?.game_time_minutes || 0;
    const wastedMin = gameTimeMin > 0 ? Math.max(0, Math.round(durationMin - gameTimeMin)) : 0;
    // Price per minute = session_price / game_time_minutes
    const pricePerMin = (gameTimeMin > 0 && price > 0) ? price / gameTimeMin : 0;
    const wastedCost = parseFloat((wastedMin * pricePerMin).toFixed(2));

    const newRow = {
      name: cs.activePlayer,
      duration: formatDurationShort(secs),
      durationSecs: secs,
      durationMin: Math.round(durationMin),
      price,
      wastedMin,
      wastedCost,
    };

    const activeSessions = await storageAdapter.entities.Session.filter(ownerId, { status: "active" });
    const active = activeSessions.find((s) => s.console_id === c.id);
    if (active) {
      await storageAdapter.entities.Session.update(ownerId, active.id, {
        end_time: new Date().toISOString(),
        duration_minutes: Math.floor(secs / 60),
        amount_charged: price,
        wasted_minutes: wastedMin,
        wasted_cost: wastedCost,
        status: "completed",
      });
    }
    await storageAdapter.entities.Console.update(ownerId, c.id, { status: "available" });

    setConsoleState((prev) => ({
      ...prev,
      [c.id]: {
        ...getCS(c.id),
        status: "idle",
        activePlayer: null,
        activePhone: null,
        activeStart: null,
        activeSecs: 0,
        sessionRows: [...(cs.sessionRows || []), newRow],
      },
    }));

    toast.success("Session ended — $" + price.toFixed(2));
  };

  const handleAdd = (c) => {
    const cs = getCS(c.id);
    if (cs.activeStart) return;

    const name = cs.sessionRows && cs.sessionRows.length > 0
      ? cs.sessionRows[0].name
      : "Player";

    storageAdapter.entities.Console.update(ownerId, c.id, { status: "occupied" });
    storageAdapter.entities.Session.create(ownerId, {
      console_id: c.id,
      console_name: c.name,
      console_type: c.type,
      player_name: name,
      start_time: new Date().toISOString(),
      status: "active",
      amount_charged: 0,
      games: [],
    });

    setConsoleState((prev) => ({
      ...prev,
      [c.id]: {
        ...getCS(c.id),
        status: "active",
        activePlayer: name,
        activeStart: Date.now(),
        activeSecs: 0,
      },
    }));

    toast.success("New session started for " + name);
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
          <h2 className="text-2xl font-bold text-white">Consoles</h2>
          <p className="text-game-muted text-sm mt-1">{consoles.length} consoles</p>
        </div>
        <RoleGuard role="admin">
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
            <Plus className="w-4 h-4" /> Add Console
          </Button>
        </RoleGuard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {consoles.map((c) => {
          const cs = getCS(c.id);
          const isActive = !!cs.activeStart;
          const hasRows = cs.sessionRows && cs.sessionRows.length > 0;
          const rate = pricing.find((p) => p.console_type === c.type);

          return (
            <div key={c.id} className={"rounded-xl border p-5 space-y-3 transition-all " + (isActive ? "bg-game-surface border-blue-500/30" : "bg-game-surface border-green-500/20")}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={"text-xs font-bold px-2 py-1 rounded-full " + (c.type === "PS5" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300")}>{c.type}</span>
                  <h3 className="text-white font-bold text-lg mt-2">{c.name}</h3>
                  {rate && <p className="text-game-muted text-xs mt-0.5">{rate.hourly_rate} {rate.currency || "ETB"}/session</p>}
                </div>
                <div className={"w-3 h-3 rounded-full mt-1 " + (isActive ? "bg-blue-400 animate-pulse" : "bg-green-400")} />
              </div>

              {isActive && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <p className="text-blue-300 text-xs font-medium mb-1">{cs.activePlayer}</p>
                  <p className="text-white font-mono font-bold text-2xl">{formatDuration(cs.activeSecs || 0)}</p>
                </div>
              )}

              {cs.mergedRow && (
                <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg px-3 py-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="text-gray-300 font-medium truncate">{cs.mergedRow.name}</span>
                    <span className="text-gray-400 text-center">{cs.mergedRow.games} game{cs.mergedRow.games !== 1 ? "s" : ""}</span>
                    <span className="text-yellow-400 font-bold text-right">${cs.mergedRow.totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {hasRows && (
                <div className="space-y-1">
                  {cs.sessionRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-4 gap-1 bg-game-bg border border-game-border rounded-lg px-3 py-2 text-xs">
                      <span className="text-white font-medium truncate">{row.name}</span>
                      <span className="text-game-muted text-center">{row.duration}</span>
                      <span className="text-green-400 font-bold text-center">{rate ? (rate.currency || "ETB") : ""} {row.price.toFixed(2)}</span>
                      <span className={"font-bold text-right " + (row.wastedMin > 0 ? "text-red-400" : "text-game-muted")}>
                        {row.wastedMin > 0 ? "+" + row.wastedMin + "m" : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {!isActive && (
                  <Button
                    onClick={() => handleStartClick(c)}
                    className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 gap-1"
                    variant="outline"
                  >
                    <Play className="w-3 h-3" /> Start
                  </Button>
                )}

                {!isActive && hasRows && (
                  <Button
                    onClick={() => handleAdd(c)}
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 gap-1"
                    variant="outline"
                  >
                    + Add
                  </Button>
                )}

                {isActive && (
                  <Button
                    onClick={() => handleEnd(c)}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 gap-1"
                    variant="outline"
                  >
                    <Square className="w-3 h-3" /> End
                  </Button>
                )}

                <RoleGuard role="admin">
                  <Button onClick={() => openEdit(c)} variant="outline" size="icon" className="border-game-border text-game-muted hover:text-white">
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button onClick={() => remove(c.id)} variant="outline" size="icon" className="border-red-500/30 text-red-400 hover:bg-red-600/20">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </RoleGuard>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Console Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-game-surface border-game-border text-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Console" : "Add Console"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-game-muted text-sm mb-1 block">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. PS5 #1" className="bg-game-bg border-game-border text-white" />
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1 block">Type</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-game-bg border-game-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-game-surface border-game-border">
                  <SelectItem value="PS5">PS5</SelectItem>
                  <SelectItem value="PS4">PS4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1 block">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-game-bg border-game-border text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-game-surface border-game-border">
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
              {editing ? "Save Changes" : "Add Console"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start Session Dialog */}
      <Dialog open={!!startDialog} onOpenChange={(open) => { if (!open) setStartDialog(null); }}>
        <DialogContent className="bg-game-surface border-game-border text-white">
          <DialogHeader>
            <DialogTitle>{"Start Session \u2014 " + (startDialog ? startDialog.name : "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {startDialog && pricing.find((p) => p.console_type === startDialog.type) && (
              <p className="text-game-muted text-xs">
                Session price: <span className="text-white font-semibold">
                  {pricing.find((p) => p.console_type === startDialog.type).hourly_rate}
                  {" "}{pricing.find((p) => p.console_type === startDialog.type).currency || "ETB"}/session
                </span>
              </p>
            )}
            <div>
              <label className="text-game-muted text-sm mb-1 block">Player Name</label>
              <Input
                value={startForm.playerName}
                onChange={(e) => setStartForm({ ...startForm, playerName: e.target.value })}
                placeholder="Enter player name"
                className="bg-game-bg border-game-border text-white"
                autoFocus
              />
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1 block">
                Phone Number <span className="text-game-muted/60">(optional)</span>
              </label>
              <Input
                value={startForm.phone}
                onChange={(e) => setStartForm({ ...startForm, phone: e.target.value })}
                placeholder="+1234567890"
                className="bg-game-bg border-game-border text-white"
              />
            </div>
            <Button onClick={confirmStart} className="w-full bg-green-600 hover:bg-green-500 text-white gap-2">
              <Play className="w-4 h-4" /> Start Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
