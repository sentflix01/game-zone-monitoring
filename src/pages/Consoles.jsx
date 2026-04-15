import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Consoles() {
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
      base44.entities.Console.list(),
      base44.entities.Session.filter({ status: "active" }),
      base44.entities.Pricing.list(),
      base44.entities.Session.list("-created_date", 200),
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
    if (!form.name) return toast.error("Console name is required");
    if (editing) {
      await base44.entities.Console.update(editing.id, form);
    } else {
      await base44.entities.Console.create(form);
    }
    toast.success(editing ? "Console updated" : "Console added");
    setDialogOpen(false);
    load();
  };

  const remove = async (id) => {
    await base44.entities.Console.delete(id);
    toast.success("Console removed");
    load();
  };

  const startSession = async () => {
    const c = sessionDialog;
    await base44.entities.Console.update(c.id, { status: "occupied" });
    await base44.entities.Session.create({
      console_id: c.id,
      console_name: c.name,
      console_type: c.type,
      player_name: playerName || "Anonymous",
      start_time: new Date().toISOString(),
      status: "active",
    });
    toast.success("Session started!");
    setSessionDialog(null);
    setPlayerName("");
    load();
  };

  const endSession = async (c) => {
    const active = sessions.find((s) => s.console_id === c.id);
    if (!active) return;
    const durationMin = Math.floor((Date.now() - new Date(active.start_time)) / 60000);
    const rate = pricing.find((p) => p.console_type === c.type);
    const amount = rate ? (durationMin / 60) * rate.hourly_rate : 0;
    const charged = parseFloat(amount.toFixed(2));

    await base44.entities.Session.update(active.id, {
      end_time: new Date().toISOString(),
      duration_minutes: durationMin,
      amount_charged: charged,
      status: "completed",
    });
    await base44.entities.Console.update(c.id, { status: "available" });

    // Auto-create or update player profile for named players
    const name = active.player_name;
    if (name && name !== "Anonymous") {
      const allPlayers = await base44.entities.Player.list();
      const existing = allPlayers.find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      const ps5Add = c.type === "PS5" ? 1 : 0;
      const ps4Add = c.type === "PS4" ? 1 : 0;
      if (existing) {
        const newPs5 = (existing.ps5_sessions || 0) + ps5Add;
        const newPs4 = (existing.ps4_sessions || 0) + ps4Add;
        await base44.entities.Player.update(existing.id, {
          total_sessions: (existing.total_sessions || 0) + 1,
          total_minutes: (existing.total_minutes || 0) + durationMin,
          total_spend: parseFloat(((existing.total_spend || 0) + charged).toFixed(2)),
          ps5_sessions: newPs5,
          ps4_sessions: newPs4,
          favourite_console: newPs5 >= newPs4 ? "PS5" : "PS4",
          last_seen: new Date().toISOString(),
        });
      } else {
        await base44.entities.Player.create({
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

    toast.success(`Session ended — ${charged.toFixed(2)} charged`);
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
          <h2 className="text-2xl font-bold text-white">Consoles</h2>
          <p className="text-game-muted text-sm mt-1">Manage your {consoles.length} consoles</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
          <Plus className="w-4 h-4" /> Add Console
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className={`w-3 h-3 rounded-full mt-1 ${
                  c.status === "available" ? "bg-green-400" :
                  c.status === "occupied" ? "bg-blue-400 animate-pulse" : "bg-red-400"
                }`} />
              </div>

              {active && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-blue-300 text-xs font-medium">Playing: {active.player_name}</p>
                  <p className="text-white font-bold text-xl mt-1">{elapsed}m</p>
                </div>
              )}

              <div className="flex gap-2">
                {c.status === "available" && (
                  <Button
                    onClick={() => setSessionDialog(c)}
                    className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 gap-1"
                    variant="outline"
                  >
                    <Play className="w-3 h-3" /> Start
                  </Button>
                )}
                {c.status === "occupied" && (
                  <Button
                    onClick={() => endSession(c)}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 gap-1"
                    variant="outline"
                  >
                    <Square className="w-3 h-3" /> End
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
            <DialogTitle>{editing ? "Edit Console" : "Add Console"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-game-muted text-sm mb-1 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. PS5 #1"
                className="bg-game-bg border-game-border text-white"
              />
            </div>
            <div>
              <label className="text-game-muted text-sm mb-1 block">Type</label>
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
              <label className="text-game-muted text-sm mb-1 block">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-game-bg border-game-border text-white">
                  <SelectValue />
                </SelectTrigger>
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
      <Dialog open={!!sessionDialog} onOpenChange={() => setSessionDialog(null)}>
        <DialogContent className="bg-game-surface border-game-border text-white">
          <DialogHeader>
            <DialogTitle>Start Session — {sessionDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-game-muted text-sm mb-1 block">Player Name (optional)</label>
              <Input
                list="past-players"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. John"
                className="bg-game-bg border-game-border text-white"
              />
              <datalist id="past-players">
                {pastPlayers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <Button onClick={startSession} className="w-full bg-green-600 hover:bg-green-500 text-white gap-2">
              <Play className="w-4 h-4" /> Start Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
