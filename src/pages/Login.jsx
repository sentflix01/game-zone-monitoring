import { useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff, ArrowLeft, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';

/* ─── Brand Icon Components ─────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  );
}

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
    case 'auth/invalid-phone-number': return 'Invalid phone number. Use international format e.g. +251911000000.';
    case 'auth/invalid-verification-code': return 'Invalid OTP code. Please try again.';
    case 'auth/code-expired': return 'OTP code expired. Please request a new one.';
    default: return null;
  }
}

/* ─── Social Button ──────────────────────────────────────────────────────── */
function SocialBtn({ onClick, disabled, loading, icon, label, bgClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-white transition-all duration-200 disabled:opacity-50 hover:brightness-110 active:scale-[0.98] ${bgClass}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-center">{loading ? 'Connecting…' : label}</span>
    </button>
  );
}

/* ─── Main Login Component ───────────────────────────────────────────────── */
export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister]     = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [googleLoading, setGoogleLoading]   = useState(false);
  const [githubLoading, setGithubLoading]   = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  // Phone / WhatsApp state
  const [phoneMode, setPhoneMode]               = useState(false);
  const [phone, setPhone]                       = useState('');
  const [otp, setOtp]                           = useState('');
  const [otpSent, setOtpSent]                   = useState(false);
  const [phoneLoading, setPhoneLoading]         = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaVerifierRef = useRef(null);

  const anyLoading = emailLoading || googleLoading || githubLoading || linkedinLoading || phoneLoading;

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-game-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  /* ── Email / Password ─── */
  async function handleEmailPassword(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setEmailLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      toast.error(getErrorMessage(err.code) || 'Sign in failed. Please try again.');
      setEmailLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { toast.error('Enter your email first.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset email sent. Check your inbox.');
    } catch (err) {
      toast.error(getErrorMessage(err.code) || 'Failed to send reset email.');
    }
  }

  /* ── Google ─── */
  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(getErrorMessage(err.code) || 'Google sign-in failed.');
      }
    } finally { setGoogleLoading(false); }
  }

  /* ── GitHub ─── */
  async function handleGithubLogin() {
    setGithubLoading(true);
    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(getErrorMessage(err.code) || 'GitHub sign-in failed.');
      }
    } finally { setGithubLoading(false); }
  }

  /* ── LinkedIn (OAuth2 redirect) ─── */
  function handleLinkedInLogin() {
    if (!LINKEDIN_CLIENT_ID) {
      toast.error('LinkedIn login is not configured yet. Contact the administrator.');
      return;
    }
    setLinkedinLoading(true);
    const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem('linkedin_oauth_state', state);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state,
    });
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  /* ── Phone / WhatsApp OTP ─── */
  function ensureRecaptcha() {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return recaptchaVerifierRef.current;
  }

  async function handleSendOTP() {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) { toast.error('Enter your phone number in international format, e.g. +251911000000'); return; }
    setPhoneLoading(true);
    try {
      const verifier = ensureRecaptcha();
      const result = await signInWithPhoneNumber(auth, trimmedPhone, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
      toast.success('OTP sent! Check your SMS or WhatsApp.');
    } catch (err) {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      toast.error(getErrorMessage(err.code) || 'Failed to send OTP. Check the phone number and try again.');
    } finally { setPhoneLoading(false); }
  }

  async function handleVerifyOTP() {
    if (!otp.trim()) { toast.error('Enter the OTP code.'); return; }
    setPhoneLoading(true);
    try {
      await confirmationResult.confirm(otp.trim());
    } catch (err) {
      toast.error(getErrorMessage(err.code) || 'OTP verification failed.');
      setPhoneLoading(false);
    }
  }

  /* ── Render ─── */
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
          <span className="text-white text-2xl font-bold">PS</span>
        </div>
        <h1 className="text-2xl font-bold text-white">
          {phoneMode ? 'Phone Sign In' : 'Sign In'}
        </h1>
        <p className="text-game-muted mt-1 text-sm">Sign in to access Game Zone</p>
      </div>

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-6 space-y-4 shadow-xl">

        {phoneMode ? (
          /* ── Phone / WhatsApp flow ── */
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => { setPhoneMode(false); setOtpSent(false); setPhone(''); setOtp(''); }}
              className="flex items-center gap-2 text-game-muted hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </button>

            {!otpSent ? (
              <>
                <p className="text-game-muted text-xs">Enter your WhatsApp / phone number in international format:</p>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 911 000 000"
                  disabled={phoneLoading}
                  className="bg-game-bg border-game-border text-white"
                  autoComplete="tel"
                />
                <Button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={phoneLoading}
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                >
                  {phoneLoading ? 'Sending…' : 'Send OTP'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-game-muted text-xs">Enter the 6-digit code sent to <span className="text-white font-medium">{phone}</span>:</p>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  disabled={phoneLoading}
                  className="bg-game-bg border-game-border text-white tracking-widest text-center text-lg"
                  autoComplete="one-time-code"
                />
                <Button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={phoneLoading}
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                >
                  {phoneLoading ? 'Verifying…' : 'Verify OTP'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); }}
                  className="w-full text-center text-game-muted text-xs hover:text-white transition-colors"
                >
                  Resend OTP
                </button>
              </>
            )}
          </div>
        ) : (
          /* ── Main login flow ── */
          <>
            {/* Social login buttons */}
            <div className="space-y-3">
              <SocialBtn
                onClick={handleGoogleLogin}
                loading={googleLoading}
                disabled={anyLoading}
                icon={<GoogleIcon />}
                label="Continue with Google"
                bgClass="bg-white/10 hover:bg-white/15 border border-white/10"
              />
              <SocialBtn
                onClick={handleGithubLogin}
                loading={githubLoading}
                disabled={anyLoading}
                icon={<GitHubIcon />}
                label="Continue with GitHub"
                bgClass="bg-gray-800 hover:bg-gray-700 border border-gray-600"
              />
              <SocialBtn
                onClick={handleLinkedInLogin}
                loading={linkedinLoading}
                disabled={anyLoading}
                icon={<LinkedInIcon />}
                label="Continue with LinkedIn"
                bgClass="bg-[#0077B5] hover:bg-[#006097]"
              />
              <SocialBtn
                onClick={() => setPhoneMode(true)}
                loading={false}
                disabled={anyLoading}
                icon={<WhatsAppIcon />}
                label="Continue with WhatsApp / Phone"
                bgClass="bg-[#25D366] hover:bg-[#1ebe59]"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-game-border" />
              <span className="text-game-muted text-xs">or sign in with email</span>
              <div className="flex-1 h-px bg-game-border" />
            </div>

            {/* Email / Password form */}
            <form onSubmit={handleEmailPassword} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={anyLoading}
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
                  disabled={anyLoading}
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
                disabled={anyLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              >
                {emailLoading ? 'Please wait…' : (isRegister ? 'Create Account' : 'Sign In')}
              </Button>
            </form>

            {!isRegister && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={anyLoading}
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
          </>
        )}
      </div>

      {/* Invisible reCAPTCHA container for phone auth */}
      <div id="recaptcha-container" />
    </div>
  );
}
