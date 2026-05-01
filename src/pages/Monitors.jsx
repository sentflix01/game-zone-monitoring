import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { firestoreClient } from '@/api/firestoreClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { UserPlus, Trash2, UserCog, Eye, EyeOff, Bell, X, ShieldAlert, Loader2, Link2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import PageSkeleton from '@/components/PageSkeleton';
import { serverTimestamp } from 'firebase/firestore';

export default function Monitors() {
  const { ownerId, user } = useAuth();

  const [monitors, setMonitors]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [email, setEmail]               = useState('');
  const [username, setUsername]         = useState('');
  const [phone, setPhone]               = useState('');
  const [displayName, setDisplayName]       = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [formError, setFormError]           = useState('');
  // Dual-role warning
  const [dualRoleWarning, setDualRoleWarning] = useState(null);

  // Invite link
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteLink, setInviteLink]             = useState('');
  const [showInviteModal, setShowInviteModal]   = useState(false);
  const [linkCopied, setLinkCopied]             = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  async function loadMonitors() {
    if (!ownerId) return;
    try {
      const list = await firestoreClient.listMonitors(ownerId);
      setMonitors(list);
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    if (!ownerId) return;
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

  function resetForm() {
    setEmail('');
    setUsername('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setFormError('');
    setShowForm(false);
    setShowPassword(false);
    setShowConfirmPwd(false);
  }

  function functionUnavailableMessage() {
    return 'Monitor management is currently unavailable. Cloud Functions must be deployed and reachable.';
  }

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async function handleGenerateInvite() {
    if (!ownerId) return;
    setGeneratingInvite(true);
    try {
      const code = generateCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

      await firestoreClient.createInvite(code, {
        ownerId,
        ownerDisplayName: user?.displayName || user?.email || 'Zone Owner',
        ownerEmail: user?.email || '',
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString(),
        used: false,
        usedBy: null,
      });

      const link = `${window.location.origin}/join?code=${code}`;
      setInviteLink(link);
      setShowInviteModal(true);
      setLinkCopied(false);
    } catch (err) {
      console.error('[Monitors] generateInvite error:', err);
      toast.error('Failed to generate invite link. Please try again.');
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast.error('Failed to copy. Please copy the link manually.');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!password || !confirmPassword || !displayName.trim()) {
      setFormError('Display name, password, and password confirmation are required.');
      return;
    }
    if (!email.trim() && !username.trim() && !phone.trim()) {
      setFormError('Please provide at least one identifier: Email, Username, or Phone.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please try again.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    setFormError('');
    setDualRoleWarning(null);

    // ── Try Cloud Function first (deployed environment) ──
    if (functions) {
      try {
        const createMonitorFn = httpsCallable(functions, 'createMonitor', { timeout: 15000 });
        const result = await createMonitorFn({
          email: email.trim(),
          username: username.trim(),
          phone: phone.trim(),
          password,
          displayName: displayName.trim(),
        });

        if (result.data.alreadyOwner) {
          setDualRoleWarning({ displayName: displayName.trim(), email: email.trim() || username.trim() || phone.trim() });
          toast.success(`Monitor "${displayName.trim()}" added (dual-role).`);
        } else {
          toast.success(`Monitor "${displayName.trim()}" created successfully.`);
        }
        resetForm();
        await loadMonitors();
        setCreating(false);
        return;
      } catch (err) {
        const isFunctionMissing =
          err.code === 'functions/not-found' ||
          err.code === 'functions/internal' ||
          err.code === 'functions/unavailable';

        if (!isFunctionMissing) {
          const msg =
            err.code === 'functions/already-exists'
              ? 'This email is already a monitor under your zone.'
              : err.code === 'functions/invalid-argument'
              ? 'Invalid details. Check all fields and try again.'
              : err.message || 'Failed to create monitor.';
          setFormError(msg);
          setCreating(false);
          return;
        }
        // Function missing — fall through to direct creation
      }
    }

    // ── Direct creation fallback (Cloud Functions not deployed) ──
    // Requires email. Uses a secondary Firebase app so the owner stays signed in.
    if (!email.trim()) {
      setFormError('An email address is required to create a monitor account when Cloud Functions are not deployed.');
      setCreating(false);
      return;
    }

    try {
      const { getAuth, createUserWithEmailAndPassword, updateProfile, signOut: signOutAuth } = await import('firebase/auth');
      const { initializeApp, getApps } = await import('firebase/app');

      const primaryApp = getApps()[0];
      const secondaryApp = initializeApp(primaryApp.options, `monitor-creation-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);

      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
        const monitorUid = credential.user.uid;
        await updateProfile(credential.user, { displayName: displayName.trim() });
        await signOutAuth(secondaryAuth);

        await firestoreClient.createMonitorDirect(ownerId, monitorUid, {
          email: email.trim(),
          displayName: displayName.trim(),
          isExistingOwner: false,
        });

        toast.success(`Monitor "${displayName.trim()}" created successfully.`);
        resetForm();
        await loadMonitors();
      } finally {
        try { await secondaryApp.delete(); } catch (_) {}
      }
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use'
          ? 'That email is already registered. Use a different email.'
          : err.code === 'auth/invalid-email'
          ? 'Invalid email address.'
          : err.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : err.message || 'Failed to create monitor.';
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(monitor) {
    if (!window.confirm(`Remove monitor "${monitor.displayName || monitor.email}"? They will lose access immediately.`)) return;

    if (!functions) {
      toast.error(functionUnavailableMessage());
      return;
    }

    try {
      const deleteMonitorFn = httpsCallable(functions, 'deleteMonitor', { timeout: 15000 });
      await deleteMonitorFn({ monitorUid: monitor.id });
      toast.success('Monitor removed.');
      setMonitors((prev) => prev.filter((m) => m.id !== monitor.id));
    } catch (err) {
      const isFunctionMissing =
        err.code === 'functions/not-found' ||
        err.code === 'functions/internal' ||
        err.code === 'functions/unavailable';
      toast.error(isFunctionMissing ? functionUnavailableMessage() : 'Failed to remove monitor.');
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
      {/* Header */}
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

      {/* Unread notifications */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-2">
          {unreadNotifications.map((notif) => (
            <div key={notif.id} className="flex items-start justify-between gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2">
                <Bell className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm">{notif.message}</p>
                  <p className="text-game-muted text-xs mt-0.5">{formatNotifTime(notif)}</p>
                </div>
              </div>
              <button onClick={() => dismissNotification(notif)} className="text-game-muted hover:text-white transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dual-role warning */}
      {dualRoleWarning && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-4">
          <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-sm">Dual-Role Monitor Added</p>
            <p className="text-amber-200/80 text-xs mt-1 leading-relaxed">
              <strong>{dualRoleWarning.email}</strong> is already registered as an owner.
              The password you set is their <strong>monitor access password</strong> for your zone only —
              their owner account is unaffected.
            </p>
          </div>
          <button onClick={() => setDualRoleWarning(null)} className="text-amber-400/60 hover:text-amber-300 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Monitor button */}
      {!showForm && (
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setShowForm(true);
              setDualRoleWarning(null);
              setFormError('');
              // Reset all form fields when opening fresh
              setEmail('');
              setUsername('');
              setPhone('');
              setDisplayName('');
              setPassword('');
              setConfirmPassword('');
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <UserPlus className="w-4 h-4" />
            Add Monitor
          </Button>
          <Button
            onClick={handleGenerateInvite}
            disabled={generatingInvite}
            variant="outline"
            className="flex items-center gap-2 border-game-border text-white hover:bg-white/10"
          >
            {generatingInvite
              ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
              : <><Link2 className="w-4 h-4" />Generate Invite Link</>
            }
          </Button>
        </div>
      )}

      {/* Invite link modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-game-surface border border-game-border rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-400" />
                Invite Link
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-game-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-game-muted text-sm">
              Share this link with your monitor. It expires in <span className="text-white font-medium">48 hours</span> and can only be used once.
            </p>
            <div className="flex items-center gap-2 bg-game-bg border border-game-border rounded-lg px-3 py-2">
              <span className="text-blue-300 text-xs font-mono flex-1 break-all select-all">{inviteLink}</span>
            </div>
            <Button
              onClick={handleCopyLink}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2"
            >
              {linkCopied
                ? <><Check className="w-4 h-4" />Copied!</>
                : <><Copy className="w-4 h-4" />Copy Link</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-game-surface border border-game-border rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-semibold text-lg">New Monitor Account</h3>

          {formError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              <X className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-game-muted text-sm">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setFormError(''); }}
              placeholder="e.g. John — Evening Shift"
              className="bg-game-bg border-game-border text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">
              Email
              <span className="text-red-400 ml-1">*</span>
              <span className="text-game-muted/60 ml-1 text-xs">(required for login)</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
              placeholder="monitor@example.com"
              className="bg-game-bg border-game-border text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">Username <span className="text-game-muted/60">(Optional)</span></label>
            <Input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setFormError(''); }}
              placeholder="monitor_user"
              className="bg-game-bg border-game-border text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">Phone Number <span className="text-game-muted/60">(Optional)</span></label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setFormError(''); }}
              placeholder="+1234567890"
              className="bg-game-bg border-game-border text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-game-muted text-sm">
              Password
              <span className="text-game-muted/60 ml-1 text-xs">(monitor uses this to log in)</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
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

          <div className="space-y-1">
            <label className="text-game-muted text-sm">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFormError(''); }}
                placeholder="Confirm password"
                className="bg-game-bg border-game-border text-white pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white"
              >
                {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-500 text-white">
              {creating
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</>
                : 'Create Monitor'
              }
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={creating}
              className="border-game-border text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Monitor list — shown directly below the Add button */}
      {loading ? (
        <PageSkeleton rows={2} />
      ) : monitors.length === 0 ? (
        <div className="bg-game-surface border border-game-border rounded-2xl p-8 text-center">
          <UserCog className="w-10 h-10 text-game-muted mx-auto mb-3" />
          <p className="text-white font-semibold">No monitors yet</p>
          <p className="text-game-muted text-sm mt-1">Add your first monitor to give staff access to this zone.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="bg-game-surface border border-game-border rounded-xl px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <span className="text-purple-300 font-bold text-sm">
                    {(monitor.displayName || monitor.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{monitor.displayName || '—'}</p>
                  <p className="text-game-muted text-xs">
                    {[monitor.email, monitor.username, monitor.phone].filter(Boolean).join(' • ')}
                  </p>
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
          ))}
        </div>
      )}
    </div>
  );
}
