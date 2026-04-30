import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signInWithCustomToken,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { auth, functions } from '@/lib/firebase';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ─── Google Icon ─────────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

/* ─── Human-readable error messages ─────────────────────────────────────────── */
function errMsg(code) {
  const map = {
    'auth/invalid-email':                            'Invalid email address. Please check and try again.',
    'auth/user-not-found':                           'No account found with this email.',
    'auth/wrong-password':                           'Incorrect password. Please try again.',
    'auth/invalid-credential':                       'Incorrect email or password. Please try again.',
    'auth/email-already-in-use':                     'An account with this email already exists. Try signing in instead.',
    'auth/weak-password':                            'Password must be at least 6 characters.',
    'auth/too-many-requests':                        'Too many failed attempts. Please wait a few minutes and try again.',
    'auth/operation-not-allowed':                    'Google sign-in is not enabled. Contact the administrator.',
    'auth/unauthorized-domain':                      'This domain is not authorized. Add the current domain under Firebase Authentication authorized domains and try again.',
    'auth/network-request-failed':                   'Network error. Check your internet connection and try again.',
    'auth/internal-error':                           'An internal error occurred. Please try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method for this email.',
    'auth/popup-closed-by-user':                     null,
    'auth/popup-blocked':                            null,
    'auth/cancelled-popup-request':                  null,
    'auth/user-disabled':                            'This account has been disabled. Contact the administrator.',
  };
  return map[code] ?? null;
}

/* ─── Inline error banner — only renders when there is an actual error ──── */
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-400 text-sm animate-in fade-in duration-200">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ─── Popup → redirect fallback ──────────────────────────────────────────── */
async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('[googleSignIn] popup failed:', err?.code, err?.message);
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      sessionStorage.setItem('__redirectPending', '1');
      await signInWithRedirect(auth, provider);
    } else {
      throw err;
    }
  }
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [isRegister, setIsRegister]   = useState(false);
  const [loadingBtn, setLoadingBtn]   = useState(null); // 'google' | 'email' | null
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError]             = useState('');   // inline error message

  // Handle redirect result on mount (popup-blocked fallback)
  // Only runs when a redirect was actually pending — avoids spurious errors on fresh loads
  useEffect(() => {
    if (!auth?.onAuthStateChanged) return;
    const pending = sessionStorage.getItem('__redirectPending') === '1';
    if (!pending) return; // no redirect was initiated — skip entirely

    setRedirecting(true);
    getRedirectResult(auth)
      .then(r => { if (r?.user) toast.success('Signed in successfully!'); })
      .catch(e => {
        // Only show errors that are meaningful to the user
        const msg = errMsg(e.code);
        if (msg) setError(msg);
        // Silently ignore internal Firebase codes (no-auth-event, etc.)
      })
      .finally(() => {
        sessionStorage.removeItem('__redirectPending');
        setRedirecting(false);
      });
  }, []);

  const busy = !!loadingBtn || redirecting;

  if (isLoadingAuth || redirecting) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-game-muted text-sm">Signing in…</p>
      </div>
    </div>
  );

  if (isAuthenticated) return <Navigate to="/" replace />;

  /* ── Google ── */
  async function handleGoogle() {
    setError('');
    setLoadingBtn('google');
    try {
      await googleSignIn();
    } catch (e) {
      console.error('[handleGoogle] error:', e);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setLoadingBtn(null);
        return;
      }
      // Always show something — never fail silently
      const msg = errMsg(e.code) || `Sign-in failed (${e.code || 'unknown'}). Please try again. Error: ${e.message || ''}`;
      setError(msg);
    } finally {
      setLoadingBtn(null);
    }
  }

  /* ── Email sign-in (owner path + monitor fallback) ── */
  async function handleEmail(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoadingBtn('email');

    let ownerError = null;
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return; // success — AuthContext handles navigation
    } catch (err) {
      ownerError = err;
    }

    const isCredentialError = [
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/user-not-found',
    ].includes(ownerError.code);

    if (isCredentialError && functions) {
      // Fallback: try monitor sign-in via Cloud Function
      try {
        const monitorSignIn = httpsCallable(functions, 'monitorSignIn');
        const result = await monitorSignIn({ email: email.trim(), password });
        await signInWithCustomToken(auth, result.data.token);
        return; // success — AuthContext handles navigation
      } catch {
        // Both paths failed
        setError('Incorrect email or password. Please try again.');
        setLoadingBtn(null);
        return;
      }
    }

    // Non-credential error (network, disabled account, etc.)
    const msg = errMsg(ownerError.code) || 'Sign in failed. Please try again.';
    setError(msg);
    setLoadingBtn(null);
  }

  /* ── Registration ── */
  async function handleRegister(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoadingBtn('email');
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = errMsg(err.code) || 'Registration failed. Please try again.';
      setError(msg);
      setLoadingBtn(null);
    }
  }

  /* ── Forgot password ── */
  async function handleForgot() {
    if (!email.trim()) {
      setError('Enter your email address first, then click Forgot password.');
      return;
    }
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset email sent! Check your inbox.');
    } catch (e) {
      const msg = errMsg(e.code) || 'Failed to send reset email.';
      setError(msg);
    }
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4 py-10">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30">
          <span className="text-white text-xl font-bold">PS</span>
        </div>
        <h1 className="text-xl font-bold text-white">Sign In</h1>
        <p className="text-game-muted text-xs mt-1">Game Zone Monitoring</p>
      </div>

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-5 space-y-4 shadow-xl">

        {/* Inline error banner */}
        <ErrorBanner message={error} />

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-white/10 border border-white/10 transition-all hover:bg-white/15 hover:border-white/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingBtn === 'google'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <GoogleIcon />
          }
          <span className="text-xs">
            {loadingBtn === 'google' ? 'Opening Google sign-in…' : 'Continue with Google'}
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-game-border" />
          <span className="text-game-muted text-xs">or email</span>
          <div className="flex-1 h-px bg-game-border" />
        </div>

        {/* Email / Password form */}
        <form onSubmit={isRegister ? handleRegister : handleEmail} className="space-y-2.5">
          <Input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="you@example.com"
            required
            disabled={busy}
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
              disabled={busy}
              className="bg-game-bg border-game-border text-white text-sm pr-10"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            {loadingBtn === 'email'
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Please wait…</>
              : isRegister ? 'Create Account' : 'Sign In'
            }
          </Button>
        </form>

        {/* Footer links */}
        <div className="flex justify-between text-xs text-game-muted">
          {!isRegister && (
            <button
              type="button"
              onClick={handleForgot}
              disabled={busy}
              className="hover:text-white transition-colors"
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="hover:text-white transition-colors ml-auto"
          >
            {isRegister ? 'Sign in instead' : 'Create account'}
          </button>
        </div>
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}
