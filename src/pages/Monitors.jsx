import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { firestoreClient } from '@/api/firestoreClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { UserPlus, Trash2, UserCog, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Monitors() {
  const { ownerId, user: ownerUser } = useAuth();

  const [monitors, setMonitors]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [email, setEmail]               = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function loadMonitors() {
    try {
      const list = await firestoreClient.listMonitors(ownerId);
      setMonitors(list);
    } catch (err) {
      console.error('Failed to load monitors:', err);
      toast.error('Failed to load monitors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ownerId) loadMonitors();
  }, [ownerId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!email.trim() || !password || !displayName.trim()) {
      toast.error('Fill in all fields.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    try {
      const createMonitor = httpsCallable(functions, 'createMonitor');
      await createMonitor({
        email: email.trim(),
        password,
        displayName: displayName.trim()
      });

      toast.success(`Monitor "${displayName}" created successfully.`);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setShowForm(false);
      await loadMonitors();
    } catch (err) {
      const msg =
        err.code === 'functions/already-exists'
          ? 'That email is already registered.'
          : err.code === 'functions/invalid-argument'
          ? 'Invalid details provided.'
          : err?.message || 'Failed to create monitor.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(monitor) {
    if (!window.confirm(`Remove monitor "${monitor.displayName || monitor.email}"? They will lose access immediately.`)) return;
    try {
      const deleteMonitor = httpsCallable(functions, 'deleteMonitor');
      await deleteMonitor({ monitorUid: monitor.id });
      toast.success('Monitor removed.');
      setMonitors((prev) => prev.filter((m) => m.id !== monitor.id));
    } catch (err) {
      toast.error('Failed to remove monitor.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCog className="w-6 h-6 text-blue-400" />
          Monitors
        </h2>
        <p className="text-game-muted text-sm mt-1">
          Manage staff accounts for your game zone. Monitors can manage consoles and sessions but cannot view financials.
        </p>
      </div>

      {/* Add monitor button */}
      {!showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
        >
          <UserPlus className="w-4 h-4" />
          Add Monitor
        </Button>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-game-surface border border-game-border rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-semibold text-lg">New Monitor Account</h3>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John — Evening Shift"
              className="bg-game-bg border-game-border text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="monitor@example.com"
              className="bg-game-bg border-game-border text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="bg-game-bg border-game-border text-white pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-500 text-white">
              {creating ? 'Creating...' : 'Create Monitor'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowForm(false); setEmail(''); setPassword(''); setDisplayName(''); }}
              className="border-game-border text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Monitor list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="bg-game-surface border border-game-border rounded-2xl p-8 text-center">
            <UserCog className="w-10 h-10 text-game-muted mx-auto mb-3" />
            <p className="text-white font-semibold">No monitors yet</p>
            <p className="text-game-muted text-sm mt-1">Add your first monitor to give staff access to this zone.</p>
          </div>
        ) : (
          monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="bg-game-surface border border-game-border rounded-xl px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <span className="text-purple-300 text-sm font-bold">
                    {(monitor.displayName || monitor.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{monitor.displayName || monitor.email}</p>
                  <p className="text-game-muted text-xs">{monitor.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">Monitor</span>
                <button
                  onClick={() => handleRemove(monitor)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove monitor"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
