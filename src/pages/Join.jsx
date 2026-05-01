import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, Loader2, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const code = searchParams.get('code');

  const [invite, setInvite]       = useState(null);  // { ownerId, ownerName, ownerEmail }
  const [inviteError, setInviteError] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(true);

  const [mode, setMode]           = useState('signup'); // 'signup' | 'login'
  const [email, setEmail]         = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);

  // Load invite details
  useEffect(() => {
    if (!code) {
      setInviteError('Invalid invite link. No code found.');
      setLoadingInvite(false);
      return;
    }
    if (!db) {
      setInviteError('Database not configured.');
      setLoadingInvite(false);
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'invites', code));
        if (!snap.exists()) {
          setInviteError('This invite link is invalid or has expired.');
          return;
        }
        const data = snap.data();
        if (data.used) {
          setInviteError('This invite link has already been used.');
          return;
        }
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
          setInviteError('This invite link has expired.');
          return;
        }
        setInvite(data);
      } catch (err) {
        setInviteError('Failed to load invite. Please try again.');
      } finally {
        setLoadingInvite(false);
      }
    })();
  }, [code]);

  // If already logged in, link them as monitor directly
  useEffect(() => {
    if (!isAuthenticated || !invite || isLoadingAuth) return;
    linkCurrentUserAsMonitor();
  }, [isAuthenticated, invite, isLoadingAuth]);

  async function linkCurrentUserAsMonitor() {
    if (!auth.currentUser || !invite) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      // Write monitor record under owner
      await setDoc(doc(db, 'owners', invite.ownerId, 'users', uid), {
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || auth.currentUser.email || '',
        isExistingOwner: false,
        createdAt: serverTimestamp(),
      });
      // Write userIndex
      await setDoc(doc(db, 'userIndex', uid), {
        ownerId: invite.ownerId,
        email: auth.currentUser.email || '',
        role: 'monitor',
        createdAt: serverTimestamp(),
      });
      // Mark invite as used
      await updateDoc(doc(db, 'invites', code), { used: true, usedBy: uid, usedAt: serverTimestamp() });
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError('Failed to link your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!email.trim() || !password || !displayName.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPwd) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Create account
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: displayName.trim() });

      // Link as monitor
      const uid = credential.user.uid;
      await setDoc(doc(db, 'owners', invite.ownerId, 'users', uid), {
        email: email.trim(),
        displayName: displayName.trim(),
        isExistingOwner: false,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'userIndex', uid), {
        ownerId: invite.ownerId,
        email: email.trim(),
        role: 'monitor',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'invites', code), { used: true, usedBy: uid, usedAt: serverTimestamp() });

      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'That email is already registered. Try signing in instead.' :
        err.code === 'auth/invalid-email' ? 'Invalid email address.' :
        err.code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
        err.message || 'Failed to create account.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // linkCurrentUserAsMonitor will be called by the useEffect above
    } catch (err) {
      const msg =
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Incorrect email or password.' :
        err.code === 'auth/user-not-found' ? 'No account found with this email.' :
        err.message || 'Sign in failed.';
      setError(msg);
      setLoading(false);
    }
  }

  // ── Render ──

  if (loadingInvite) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  );

  if (inviteError) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-game-surface border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-white font-semibold">Invalid Invite</p>
        <p className="text-game-muted text-sm">{inviteError}</p>
        <Button onClick={() => navigate('/login')} variant="outline" className="border-game-border text-white hover:bg-white/10">
          Go to Login
        </Button>
      </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-game-surface border border-green-500/30 rounded-2xl p-6 text-center space-y-3">
        <UserCheck className="w-10 h-10 text-green-400 mx-auto" />
        <p className="text-white font-semibold">You're in!</p>
        <p className="text-game-muted text-sm">
          You've joined <strong className="text-white">{invite?.ownerName || 'the zone'}</strong> as a Monitor.
          Redirecting…
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <UserCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Monitor Invite</h1>
        <p className="text-game-muted text-xs mt-1">
          You've been invited to join{' '}
          <span className="text-white font-medium">{invite?.ownerName || 'a Game Zone'}</span>{' '}
          as a Monitor
        </p>
      </div>

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-5 space-y-4 shadow-xl">

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-game-border">
          <button
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-blue-600 text-white' : 'text-game-muted hover:text-white'}`}
          >
            Create Account
          </button>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-game-muted hover:text-white'}`}
          >
            Sign In
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'signup' ? (
          <form onSubmit={handleSignup} className="space-y-2.5">
            <Input
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setError(''); }}
              placeholder="Your name"
              required
              disabled={loading}
              className="bg-game-bg border-game-border text-white text-sm"
            />
            <Input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="bg-game-bg border-game-border text-white text-sm"
              autoComplete="email"
            />
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Password (min 6 chars)"
                required
                disabled={loading}
                className="bg-game-bg border-game-border text-white text-sm pr-10"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white" tabIndex={-1}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type="password"
              value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setError(''); }}
              placeholder="Confirm password"
              required
              disabled={loading}
              className="bg-game-bg border-game-border text-white text-sm"
              autoComplete="new-password"
            />
            <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</> : 'Create Account & Join'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-2.5">
            <Input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="bg-game-bg border-game-border text-white text-sm"
              autoComplete="email"
            />
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Password"
                required
                disabled={loading}
                className="bg-game-bg border-game-border text-white text-sm pr-10"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white" tabIndex={-1}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in…</> : 'Sign In & Join'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
