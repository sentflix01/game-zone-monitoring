import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/I18nContext';
import { auth } from '@/lib/firebase';
import { Mail, Chrome, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMAIL_FOR_SIGNIN_KEY = 'gamezone_email_signin';

function getFirebaseErrorKey(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'auth.error.invalidEmail';
    case 'auth/too-many-requests':
      return 'auth.error.tooManyRequests';
    case 'auth/popup-closed-by-user':
      return null;
    case 'auth/network-request-failed':
      return 'auth.error.networkError';
    default:
      return 'auth.error.googleFailed';
  }
}

export default function Login() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isOffline = !navigator.onLine;

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = localStorage.getItem(EMAIL_FOR_SIGNIN_KEY);
      if (savedEmail) {
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(() => {
            localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/');
          })
          .catch((err) => {
            const key = getFirebaseErrorKey(err.code);
            if (key) toast.error(t(key));
            else toast.error(t('auth.error.otpLinkInvalid'));
          });
      } else {
        setView('confirm');
      }
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSendLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.href,
        handleCodeInApp: true,
      });
      localStorage.setItem(EMAIL_FOR_SIGNIN_KEY, email);
      setView('sent');
    } catch (err) {
      const key = getFirebaseErrorKey(err.code);
      if (key) toast.error(t(key));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailLink(auth, confirmEmail, window.location.href);
      navigate('/');
    } catch (err) {
      const key = getFirebaseErrorKey(err.code);
      if (key) toast.error(t(key));
      else toast.error(t('auth.error.otpLinkInvalid'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const isNative = window.Capacitor?.isNativePlatform?.();
      if (isNative) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      const key = getFirebaseErrorKey(err.code);
      if (key) toast.error(t(key));
    } finally {
      setLoading(false);
    }
  }

  function getTitle() {
    if (view === 'sent') return t('auth.otp.sentTitle');
    if (view === 'confirm') return t('auth.otp.confirmTitle');
    return t('auth.login.title');
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">PS</span>
        </div>
        <h1 className="text-2xl font-bold text-white">{getTitle()}</h1>
        {view === 'login' && (
          <p className="text-game-muted mt-1 text-sm">{t('auth.login.subtitle')}</p>
        )}
        {view === 'confirm' && (
          <p className="text-game-muted mt-1 text-sm">{t('auth.otp.confirmSubtitle')}</p>
        )}
      </div>

      {isOffline && (
        <div className="w-full max-w-sm mb-4 bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-sm rounded-lg px-4 py-3 text-center">
          {t('auth.offline.message')}
        </div>
      )}

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-6">
        {view === 'login' && (
          <>
            <form onSubmit={handleSendLink} className="space-y-4">
              <div>
                <label className="block text-sm text-game-muted mb-1">
                  {t('auth.login.emailLabel')}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.login.emailPlaceholder')}
                  required
                  disabled={loading || isOffline}
                  className="bg-game-bg border-game-border text-white placeholder:text-game-muted"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || isOffline}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                {t('auth.otp.sendButton')}
              </Button>
            </form>

            <div className="flex items-center my-5 gap-3">
              <div className="flex-1 h-px bg-game-border" />
              <span className="text-game-muted text-xs">{t('auth.login.orDivider')}</span>
              <div className="flex-1 h-px bg-game-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading || isOffline}
              className="w-full border-game-border text-white hover:bg-game-bg"
            >
              <Chrome className="w-4 h-4 mr-2" />
              {t('auth.login.googleButton')}
            </Button>
          </>
        )}

        {view === 'sent' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-white font-medium">
              {t('auth.otp.sentSubtitle').replace('{email}', email)}
            </p>
            <p className="text-game-muted text-sm">
              {t('auth.otp.sentBody').replace('{email}', email)}
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setView('login')}
              className="text-game-muted hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('auth.login.backToLogin')}
            </Button>
          </div>
        )}

        {view === 'confirm' && (
          <form onSubmit={handleConfirmLink} className="space-y-4">
            <div>
              <label className="block text-sm text-game-muted mb-1">
                {t('auth.otp.confirmEmailLabel')}
              </label>
              <Input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                required
                disabled={loading}
                className="bg-game-bg border-game-border text-white placeholder:text-game-muted"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('auth.otp.confirmButton')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
