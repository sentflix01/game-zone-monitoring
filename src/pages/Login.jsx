import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

function getErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Invalid email address.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    case 'auth/popup-closed-by-user': return null;
    case 'auth/popup-blocked': return 'Popup was blocked. Please allow popups.';
    case 'auth/unauthorized-domain': return 'Domain not authorized. Contact support.';
    default: return null;
  }
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22">
      <path fill="#EA4335" d="M6 40h6V22.5L4 17v20c0 1.66 1.34 3 2 3z" />
      <path fill="#34A853" d="M36 40h6c1.66 0 3-1.34 3-3V17l-9 5.5z" />
      <path fill="#4285F4" d="M36 10l-12 7.5L12 10H6l18 11 18-11z" />
      <path fill="#FBBC05" d="M6 17l6 5.5V40h24V22.5L42 17V8L24 19 6 8z" />
      <path fill="#EA4335" d="M6 8v9l6 5.5V10z" />
      <path fill="#34A853" d="M42 8v9l-6 5.5V10z" />
    </svg>
  );
}

export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);

  // Handle redirect result when returning from Google sign-in redirect
  useEffect(() => {
    if (isCapacitor) return; // native uses its own flow
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) navigate('/');
      })
      .catch((err) => {
        // auth/no-auth-event is normal when there's no pending redirect — ignore it
        if (err.code && err.code !== 'auth/no-auth-event' && err.code !== 'auth/popup-closed-by-user') {
          const msg = getErrorMessage(err.code) || 'Gmail sign-in failed.';
          toast.error(msg);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-game-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleEmailPassword(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      navigate('/');
    } catch (err) {
      const msg = getErrorMessage(err.code) || 'Sign in failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGmailLogin() {
    setGmailLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      if (isCapacitor) {
        // Android/iOS — use native Capacitor Google Auth plugin
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        await signInWithCredential(auth, credential);
        navigate('/');
      } else {
        // Web / Electron: popup first (better UX), fallback to redirect if blocked.
        try {
          await signInWithPopup(auth, provider);
          navigate('/');
        } catch (popupErr) {
          if (
            popupErr?.code === 'auth/popup-blocked' ||
            popupErr?.code === 'auth/cancelled-popup-request' ||
            popupErr?.code === 'auth/operation-not-supported-in-this-environment'
          ) {
            await signInWithRedirect(auth, provider);
            // Page reloads; redirect result is handled in useEffect above.
            return;
          }
          throw popupErr;
        }
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        const msg =
          getErrorMessage(err.code) ||
          err?.message ||
          'Gmail sign-in failed. Please use email/password.';
        toast.error(msg);
      }
    } finally {
      // If we triggered redirect, the page will reload; harmless if it doesn't.
      setGmailLoading(false);
    }
  }

  async function handleForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Enter your email first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmed);
      toast.success('Password reset email sent. Check your inbox.');
    } catch (err) {
      const msg = getErrorMessage(err.code) || err?.message || 'Failed to send reset email.';
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
          <span className="text-white text-2xl font-bold">PS</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In</h1>
        <p className="text-game-muted mt-1 text-sm">Sign in to access Game Zone</p>
      </div>

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-6 space-y-5">

        {/* Gmail popup button */}
        <button
          type="button"
          onClick={handleGmailLogin}
          disabled={gmailLoading || loading}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm transition-all disabled:opacity-50 shadow-sm"
        >
          <GmailIcon />
          <span className="flex-1 text-center text-gray-800 font-semibold">
            {gmailLoading ? 'Opening Google...' : 'Continue with Gmail'}
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-game-border" />
          <span className="text-game-muted text-xs">or sign in with email</span>
          <div className="flex-1 h-px bg-game-border" />
        </div>

        <form onSubmit={handleEmailPassword} className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading || gmailLoading}
            className="bg-game-bg border-game-border text-white"
            autoComplete="email"
          />
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              disabled={loading || gmailLoading}
              className="bg-game-bg border-game-border text-white pr-10"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading || gmailLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
          </Button>
        </form>

        {!isRegister && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading || gmailLoading}
            className="w-full text-center text-game-muted text-xs hover:text-white transition-colors disabled:opacity-50"
          >
            Forgot password?
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="w-full text-center text-game-muted text-xs hover:text-white transition-colors"
        >
          {isRegister ? 'Already have an account? Sign in' : 'No account? Create one'}
        </button>
      </div>
    </div>
  );
}
