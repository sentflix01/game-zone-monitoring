import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { firestoreClient } from '@/api/firestoreClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { UserPlus, Trash2, UserCog, Eye, EyeOff, Bell, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';

export default function Monitors() {
  const { ownerId } = useAuth();

  const [monitors, setMonitors]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [email, setEmail]               = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Dual-role warning: shown after createMonitor returns alreadyOwner: true
  const [dualRoleWarning, setDualRoleWarning] = useState(null); // { displayName, email }

  // Notifications
  const [notifications, setNotifications] = useState([]);

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

  async function loadNotifications() {
    try {
      const list = await firestoreClient.listNotifications(ownerId);
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  useEffect(() => {
    if (!ownerId) return;
    loadMonitors();
    loadNotifications();
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
    setDualRoleWarning(null);
    try {
      const createMonitor = httpsCallable(functions, 'createMonitor');
      const result = await createMonitor({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });

      if (result.data.alreadyOwner) {
        // Show persistent dual-role warning — don't clear the form yet
        setDualRoleWarning({ displayName: displayName.trim(), email: email.trim() });
      } else {
        toast.success(`Monitor "${displayName}" created successfully.`);
      }

      setEmail('');
      setPassword('');
      setDisplayName('');
      setShowForm(false);
      await loadMonitors();
    } catch (err) {
      const msg =
        err.code === 'functions/already-exists'
          ? 'That email is already registered as a monitor under your zone.'
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

  async function dismissNotification(notif) {
    try {
      await firestoreClient.markNotificationRead(ownerId, notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.read);

  function formatNotifTime(notif) {
    try {
      const ts = notif.createdAt?.toDate?.() || new Date(notif.createdAt);
      return formatDistanceToNow(ts, { addSuffix: true });
    } catch {
      return '';
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCog className="w-6 h-6 text-blue-400" />
          Monitors
          {unreadNotifications.length > 0 && (
            <span className="ml-1 flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium">
              <Bell className="w-3 h-3" /> {unreadNotifications.length}
            </span>
          )}
        </h2>
        <p className="text-game-muted text-sm mt-1">
          Manage staff accounts for your game zone. Monitors can manage consoles and sessions but cannot view financials.
        </p>
      </div>

      {/* Unread notifications panel */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-2">
          {unreadNotifications.map((notif) => (
            <div
              key={notif.id}
              className="flex items-start justify-between gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <Bell className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm">{notif.message}</p>
                  <p className="text-game-muted text-xs mt-0.5">{formatNotifTime(notif)}</p>
                </div>
              </div>
              <button
                onClick={() => dismissNotification(notif)}
                className="text-game-muted hover:text-white transition-colors shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dual-role warning banner */}
      {dualRoleWarning && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-4">
          <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-sm">Dual-Role Monitor Created</p>
            <p className="text-amber-200/80 text-xs mt-1 leading-relaxed">
              <strong>{dualRoleWarning.email}</strong> is already registered as an owner in the system.
              The password you set is their <strong>monitor access password</strong> for your zone only —
              their existing owner password and account are completely unaffected.
              They can change this monitor password from their Settings page at any time.
            </p>
          </div>
          <button
            onClick={() => setDualRoleWarning(null)}
            className="text-amber-400/60 hover:text-amber-300 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add monitor button */}
      {!showForm && (
        <Button
          onClick={() => { setShowForm(true); setDualRoleWarning(null); }}
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
            <label className="text-game-muted text-sm">
              Monitor Password
              <span className="text-game-muted/60 ml-1 text-xs">(they use this to access your zone)</span>
            </label>
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
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">
                  Monitor
                </span>
                {monitor.isExistingOwner && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Also an Owner
                  </span>
                )}
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
