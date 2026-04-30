import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signInWithCustomToken,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { auth, functions, firebaseReady, missingFirebaseEnvKeys } from '@/lib/firebase';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    'auth/app-not-authorized':                      'This app is not authorized for the current Firebase project. Check API key restrictions and auth domain settings.',
    'auth/invalid-api-key':                          'Firebase API key is invalid. Verify your environment configuration.',
    'auth/configuration-not-found':                  'Firebase authentication configuration is missing. Enable Email/Password sign-in in Firebase Console.',
    'auth/password-does-not-meet-requirements':      'Password does not meet project requirements. Use a stronger password and try again.',
  };
  return map[code] ?? null;
}

function getAuthErrorCode(err) {
  if (!err) return null;
  if (typeof err.code === 'string' && err.code.length > 0) return err.code;
  if (typeof err.message !== 'string') return null;

  const firebaseStyle = err.message.match(/\(auth\/([^)]+)\)/i);
  if (firebaseStyle) return `auth/${firebaseStyle[1].toLowerCase()}`;

  if (err.message.includes('EMAIL_EXISTS')) return 'auth/email-already-in-use';
  if (err.message.includes('WEAK_PASSWORD')) return 'auth/weak-password';
  if (err.message.includes('INVALID_EMAIL')) return 'auth/invalid-email';
  if (err.message.includes('OPERATION_NOT_ALLOWED')) return 'auth/operation-not-allowed';
  if (err.message.includes('setRecaptchaConfig is not a function')) return 'auth/configuration-not-found';

  return null;
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


/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const [identifier, setIdentifier]         = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd]               = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isRegister, setIsRegister]         = useState(false);
  const [loadingBtn, setLoadingBtn]         = useState(false);
  const [error, setError]                   = useState('');

  const busy = loadingBtn || !firebaseReady;
  const firebaseConfigMessage = !firebaseReady
    ? `Authentication is not configured for this deployment. Missing: ${missingFirebaseEnvKeys.join(', ')}.`
    : '';

  if (isLoadingAuth) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-game-muted text-sm">Loading…</p>
      </div>
    </div>
  );

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleLogin(e) {
    e.preventDefault();
    if (!firebaseReady) {
      setError(firebaseConfigMessage || 'Authentication is not configured for this deployment.');
      return;
    }
    if (!identifier.trim() || !password) return;
    setError('');
    setLoadingBtn(true);

    let ownerError = null;
    try {
      if (identifier.includes('@')) {
        await signInWithEmailAndPassword(auth, identifier.trim(), password);
        return; // success
      } else {
        throw new Error('Not an email');
      }
    } catch (err) {
      ownerError = err;
    }

    const isCredentialError = [
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/user-not-found',
    ].includes(ownerError.code);

    if (isCredentialError || ownerError.message === 'Not an email') {
      if (functions) {
        try {
          const monitorSignIn = httpsCallable(functions, 'monitorSignIn');
          const result = await monitorSignIn({ identifier: identifier.trim(), password });
          await signInWithCustomToken(auth, result.data.token);
          return; // success
        } catch (cloudErr) {
          console.error('[Monitor SignIn Fallback Error]', cloudErr);
          setError('Incorrect credentials. Please try again.');
          setLoadingBtn(false);
          return;
        }
      }
      setError('Incorrect credentials. Please try again.');
      setLoadingBtn(false);
      return;
    }

    console.error('[Login Error]', ownerError.code, ownerError.message, ownerError);
    const msg = errMsg(ownerError.code) || 'Sign in failed. Please try again.';
    setError(msg);
    setLoadingBtn(false);
  }

  /* ── Registration ── */
  async function handleRegister(e) {
    e.preventDefault();
    if (!firebaseReady) {
      setError(firebaseConfigMessage || 'Authentication is not configured for this deployment.');
      return;
    }
    if (!identifier.trim() || !password || !confirmPassword) return;
    setError('');
    if (!identifier.includes('@')) {
      setError('An email address is required to create an account.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoadingBtn(true);
    try {
      await createUserWithEmailAndPassword(auth, identifier.trim(), password);
    } catch (err) {
      const code = getAuthErrorCode(err);
      console.error('[Registration Error]', code, err?.message, err);
      const msg = errMsg(code) || 'Registration failed. Please try again.';
      setError(msg);
      setLoadingBtn(false);
    }
  }

  async function handleForgot() {
    if (!firebaseReady) {
      setError(firebaseConfigMessage || 'Authentication is not configured for this deployment.');
      return;
    }
    if (!identifier.trim() || !identifier.includes('@')) {
      setError('Enter your email address first, then click Forgot password.');
      return;
    }
    setError('');
    try {
      await sendPasswordResetEmail(auth, identifier.trim());
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
        <h1 className="text-xl font-bold text-white">{isRegister ? 'Create Account' : 'Sign In'}</h1>
        <p className="text-game-muted text-xs mt-1">Game Zone Monitoring</p>
      </div>

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-5 space-y-4 shadow-xl">

        {/* Inline error banner */}
        <ErrorBanner message={error || firebaseConfigMessage} />


        {/* Email / Password form */}
        <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-2.5">
          <Input
            type={isRegister ? "email" : "text"}
            value={identifier}
            onChange={e => { setIdentifier(e.target.value); setError(''); }}
            placeholder={isRegister ? "you@example.com" : "Email, Username, or Phone"}
            required
            disabled={busy}
            className="bg-game-bg border-game-border text-white text-sm"
            autoComplete={isRegister ? "email" : "username"}
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
            disabled={busy}
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Confirm password — only on sign-up */}
          {isRegister && (
            <div className="relative">
              <Input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Confirm password"
                required
                disabled={busy}
                className="bg-game-bg border-game-border text-white text-sm pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white"
                disabled={busy}
                tabIndex={-1}
              >
                {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            {loadingBtn
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
            onClick={() => { setIsRegister(!isRegister); setError(''); setConfirmPassword(''); setShowConfirmPwd(false); }}
            disabled={busy}
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
