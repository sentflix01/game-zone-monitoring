import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/I18nContext';
import { auth } from '@/lib/firebase';
import { Mail, Chrome, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMAIL_KEY = 'gamezone_email_signin';

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

function getFirebaseErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Invalid email address.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password.';
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    case 'auth/popup-closed-by-user': return null;
    default: return 'Sign in failed. Please try again.';
  }
}

export default function Login() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [view, setView] = useState('login'); // 'login' | 'sent' | 'confirm'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const isOffline = !navigator.onLine;

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) {
        signInWithEmailLink(auth, saved, window.location.href)
          .then(() => {
            localStorage.removeItem(EMAIL_KEY);
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/');
          })
          .catch((err) => {
            toast.error(getFirebaseErrorMessage(err.code) || 'Sign-in link invalid.');
          });
      } else {
        setView('confirm');
      }
    }
  }, []);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleEmailPassword(e) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      const msg = getFirebaseErrorMessage(err.code);
      if (msg) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectUrl = isElectron
        ? 'https://gamezone-25531.firebaseapp.com/__/auth/action'
        : window.location.href;
      await sendSignInLinkToEmail(auth, email, {
        url: redirectUrl,
        handleCodeInApp: true,
      });
      localStorage.setItem(EMAIL_KEY, email);
      setView('sent');
    } catch (err) {
      const msg = getFirebaseErrorMessage(err.code);
      if (msg) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      navigate('/');
    } catch (err) {
      toast.error(getFirebaseErrorMessage(err.code) || 'Sign-in link invalid.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      if (isElectron) {
        // Electron can't do popups — open Google auth in system browser
        // User signs in on web, Firebase redirects back; they then use email/password
        toast.error('Google sign-in is not supported in the desktop app. Please use email + password.');
        setLoading(false);
        return;
      }
      if (isCapacitor) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      const msg = getFirebaseErrorMessage(err.code);
      if (msg) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">PS</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign In</h1>
        <p className="text-game-muted mt-1 text-sm">Sign in to access Game Zone</p>
      </div>

      {isOffline && (
        <div className="w-full max-w-sm mb-4 bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-sm rounded-lg px-4 py-3 text-center">
          You are offline. Please connect to the internet to sign in.
        </div>
      )}

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-6 space-y-4">
        {view === 'login' && (
          <>
            {/* Email + Password — works on all platforms */}
            <form onSubmit={handleEmailPassword} className="space-y-3">
              <div>
                <label className="block text-sm text-game-muted mb-1">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading || isOffline}
                  className="bg-game-bg border-game-border text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-game-muted mb-1">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading || isOffline}
                    className="bg-game-bg border-game-border text-white pr-10"
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
              <Button
                type="submit"
                disabled={loading || isOffline}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              >
                {loading ? "Please wait..." : (isRegister ? "Create Account" : "Sign In")}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="w-full text-center text-game-muted text-xs hover:text-white transition-colors"
            >
              {isRegister ? "Already have an account? Sign in" : "No account? Create one"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-game-border" />
              <span className="text-game-muted text-xs">or</span>
              <div className="flex-1 h-px bg-game-border" />
            </div>

            {/* Magic link — web only */}
            {!isElectron && (
              <form onSubmit={handleSendLink}>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={loading || isOffline || !email}
                  className="w-full border-game-border text-white hover:bg-game-bg"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Sign-in Link
                </Button>
              </form>
            )}

            {/* Google — all platforms (Electron shows info toast) */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading || isOffline}
              className="w-full border-game-border text-white hover:bg-game-bg"
            >
              <Chrome className="w-4 h-4 mr-2" />
              Continue with Google
              {isElectron && <span className="text-game-muted text-xs ml-1">(web only)</span>}
            </Button>
          </>
        )}

        {view === 'sent' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Check your email</h2>
            <p className="text-game-muted text-sm">We sent a sign-in link to <span className="text-white">{email}</span>. Click it to sign in.</p>
            <Button type="button" variant="ghost" onClick={() => setView('login')} className="w-full text-game-muted hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to sign in
            </Button>
          </div>
        )}

        {view === 'confirm' && (
          <form onSubmit={handleConfirmLink} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Confirm your email</h2>
            <p className="text-game-muted text-sm">Enter the email you used to request the sign-in link.</p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="bg-game-bg border-game-border text-white"
            />
            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
              Confirm & Sign In
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
