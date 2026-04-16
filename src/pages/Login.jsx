import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
} from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/I18nContext';
import { auth } from '@/lib/firebase';
import { Phone, Chrome, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function getFirebaseErrorKey(code) {
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'auth.error.invalidPhone';
    case 'auth/invalid-verification-code':
      return 'auth.error.invalidOtp';
    case 'auth/code-expired':
      return 'auth.error.otpExpired';
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

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const isOffline = !navigator.onLine;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSendCode(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err) {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      const key = getFirebaseErrorKey(err.code);
      if (key) toast.error(t(key));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      navigate('/');
    } catch (err) {
      const key = getFirebaseErrorKey(err.code);
      if (key) toast.error(t(key));
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep('phone');
    setOtp('');
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

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">PS</span>
        </div>
        <h1 className="text-2xl font-bold text-white">
          {t('auth.login.title')}
        </h1>
        <p className="text-game-muted mt-1 text-sm">
          {step === 'phone'
            ? t('auth.login.subtitle')
            : t('auth.otp.sentSubtitle').replace('{phone}', phone)}
        </p>
      </div>

      {isOffline && (
        <div className="w-full max-w-sm mb-4 bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-sm rounded-lg px-4 py-3 text-center">
          {t('auth.offline.message')}
        </div>
      )}

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-6">
        {step === 'phone' && (
          <>
            <form onSubmit={handleSendCode} className="space-y-4" data-testid="login-form">
              <div>
                <label className="block text-sm text-game-muted mb-1">
                  {t('auth.login.phoneLabel')}
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('auth.login.phonePlaceholder')}
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
                <Phone className="w-4 h-4 mr-2" />
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

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4" data-testid="otp-form">
            <div>
              <label className="block text-sm text-game-muted mb-1">
                {t('auth.otp.otpLabel')}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder={t('auth.otp.otpPlaceholder')}
                required
                disabled={loading}
                className="bg-game-bg border-game-border text-white placeholder:text-game-muted tracking-widest text-center text-lg"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('auth.otp.verifyButton')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              className="w-full text-game-muted hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('auth.login.backToPhone')}
            </Button>
          </form>
        )}
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}
