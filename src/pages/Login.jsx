import { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  GoogleAuthProvider, GithubAuthProvider, TwitterAuthProvider,
  OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber,
} from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ─── SVG Brand Icons ─────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);
const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const MicrosoftIcon = () => (
  <svg viewBox="0 0 23 23" width="18" height="18">
    <rect x="1"  y="1"  width="10" height="10" fill="#f25022"/>
    <rect x="12" y="1"  width="10" height="10" fill="#7fba00"/>
    <rect x="1"  y="12" width="10" height="10" fill="#00a4ef"/>
    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
  </svg>
);
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

/* ─── Error messages ─────────────────────────────────────────────────────── */
function errMsg(code) {
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/operation-not-allowed': 'This provider is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.',
    'auth/unauthorized-domain': 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method for this email.',
    'auth/invalid-phone-number': 'Invalid phone number. Use international format: +251911000000',
    'auth/invalid-verification-code': 'Invalid OTP code.',
    'auth/code-expired': 'OTP expired. Request a new one.',
    'auth/popup-closed-by-user': null,
    'auth/popup-blocked': null,
  };
  return map[code] ?? null;
}

/* ─── Popup → redirect fallback ──────────────────────────────────────────── */
async function socialLogin(provider) {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, provider);
    } else {
      throw err;
    }
  }
}

/* ─── Social Button ──────────────────────────────────────────────────────── */
function SocialBtn({ onClick, disabled, loading, icon, label, cls }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 hover:brightness-110 active:scale-[0.98] ${cls}`}>
      <span className="shrink-0 w-5 flex justify-center">{icon}</span>
      <span className="flex-1 text-center text-xs">{loading ? 'Connecting…' : label}</span>
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const [loadingBtn, setLoadingBtn]   = useState(null); // which button is loading
  const [redirecting, setRedirecting] = useState(false);

  // Phone flow
  const [phoneMode, setPhoneMode]             = useState(false);
  const [phone, setPhone]                     = useState('');
  const [otp, setOtp]                         = useState('');
  const [otpSent, setOtpSent]                 = useState(false);
  const [confirmation, setConfirmation]       = useState(null);
  const recaptchaRef = useRef(null);

  // Handle redirect result (when popup was blocked → used redirect)
  useEffect(() => {
    if (!auth?.onAuthStateChanged) return;
    setRedirecting(true);
    getRedirectResult(auth)
      .then(r => { if (r?.user) toast.success('Signed in!'); })
      .catch(e => { if (e.code !== 'auth/no-auth-event') toast.error(errMsg(e.code) || e.message); })
      .finally(() => setRedirecting(false));
  }, []);

  const busy = !!loadingBtn || redirecting;

  if (isLoadingAuth || redirecting) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  if (isAuthenticated) return <Navigate to="/" replace />;

  /* ── Social handler factory ── */
  function social(key, buildProvider) {
    return async () => {
      setLoadingBtn(key);
      try { await socialLogin(buildProvider()); }
      catch (e) { const m = errMsg(e.code) || e.message; if (m) toast.error(m); }
      finally { setLoadingBtn(null); }
    };
  }

  const handleGoogle    = social('google',    () => { const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; });
  const handleGithub    = social('github',    () => { const p = new GithubAuthProvider(); p.addScope('user:email'); return p; });
  const handleTwitter   = social('twitter',   () => new TwitterAuthProvider());
  const handleMicrosoft = social('microsoft', () => new OAuthProvider('microsoft.com'));
  const handleApple     = social('apple',     () => new OAuthProvider('apple.com'));

  /* ── Email / Password ── */
  async function handleEmail(e) {
    e.preventDefault();
    setLoadingBtn('email');
    try {
      if (isRegister) await createUserWithEmailAndPassword(auth, email.trim(), password);
      else            await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      toast.error(errMsg(err.code) || 'Sign in failed.');
      setLoadingBtn(null);
    }
  }

  async function handleForgot() {
    if (!email.trim()) { toast.error('Enter your email first.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); toast.success('Reset email sent!'); }
    catch (e) { toast.error(errMsg(e.code) || 'Failed.'); }
  }

  /* ── Phone / WhatsApp ── */
  function ensureRecaptcha() {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
    }
    return recaptchaRef.current;
  }
  function clearRecaptcha() {
    try { recaptchaRef.current?.clear(); } catch {}
    recaptchaRef.current = null;
  }

  async function sendOTP() {
    if (!phone.trim()) { toast.error('Enter phone number in international format: +251911000000'); return; }
    setLoadingBtn('phone');
    try {
      const result = await signInWithPhoneNumber(auth, phone.trim(), ensureRecaptcha());
      setConfirmation(result); setOtpSent(true);
      toast.success('OTP sent! Check your SMS.');
    } catch (e) {
      clearRecaptcha();
      toast.error(errMsg(e.code) || e.message || 'Failed to send OTP.');
    } finally { setLoadingBtn(null); }
  }

  async function verifyOTP() {
    if (!otp.trim()) { toast.error('Enter the OTP code.'); return; }
    setLoadingBtn('phone');
    try { await confirmation.confirm(otp.trim()); }
    catch (e) { toast.error(errMsg(e.code) || 'Invalid OTP.'); setLoadingBtn(null); }
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30">
          <span className="text-white text-xl font-bold">PS</span>
        </div>
        <h1 className="text-xl font-bold text-white">{phoneMode ? 'Phone Sign In' : 'Sign In'}</h1>
        <p className="text-game-muted text-xs mt-1">Game Zone Monitoring</p>
      </div>

      <div className="w-full max-w-sm bg-game-surface border border-game-border rounded-2xl p-5 space-y-3 shadow-xl">

        {phoneMode ? (
          <div className="space-y-3">
            <button type="button" onClick={() => { setPhoneMode(false); setOtpSent(false); setPhone(''); setOtp(''); clearRecaptcha(); }}
              className="flex items-center gap-2 text-game-muted hover:text-white text-xs transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            {!otpSent ? (
              <>
                <p className="text-game-muted text-xs">International format: <span className="text-white">+251911000000</span></p>
                <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+251 911 000 000" disabled={busy}
                  className="bg-game-bg border-game-border text-white" autoComplete="tel" />
                <Button onClick={sendOTP} disabled={busy} className="w-full bg-green-600 hover:bg-green-500 text-white text-sm">
                  {loadingBtn === 'phone' ? 'Sending…' : 'Send OTP'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-game-muted text-xs">Code sent to <span className="text-white">{phone}</span></p>
                <Input type="text" inputMode="numeric" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value)} placeholder="123456" disabled={busy}
                  className="bg-game-bg border-game-border text-white tracking-widest text-center text-lg" autoComplete="one-time-code" />
                <Button onClick={verifyOTP} disabled={busy} className="w-full bg-green-600 hover:bg-green-500 text-white text-sm">
                  {loadingBtn === 'phone' ? 'Verifying…' : 'Verify OTP'}
                </Button>
                <button type="button" onClick={() => { setOtpSent(false); setOtp(''); clearRecaptcha(); }}
                  className="w-full text-center text-game-muted text-xs hover:text-white">Resend OTP</button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Social buttons — 2 columns */}
            <div className="grid grid-cols-2 gap-2">
              <SocialBtn onClick={handleGoogle}    loading={loadingBtn==='google'}    disabled={busy} icon={<GoogleIcon />}    label="Google"    cls="bg-white/10 border border-white/10 col-span-2" />
              <SocialBtn onClick={handleGithub}    loading={loadingBtn==='github'}    disabled={busy} icon={<GithubIcon />}    label="GitHub"    cls="bg-[#24292e] border border-gray-600" />
              <SocialBtn onClick={handleTwitter}   loading={loadingBtn==='twitter'}   disabled={busy} icon={<TwitterIcon />}   label="Twitter/X" cls="bg-[#000000] border border-gray-700" />
              <SocialBtn onClick={handleMicrosoft} loading={loadingBtn==='microsoft'} disabled={busy} icon={<MicrosoftIcon />} label="Microsoft" cls="bg-[#2f2f2f] border border-gray-600" />
              <SocialBtn onClick={handleApple}     loading={loadingBtn==='apple'}     disabled={busy} icon={<AppleIcon />}     label="Apple"     cls="bg-[#1c1c1e] border border-gray-700" />
              <SocialBtn onClick={() => setPhoneMode(true)} loading={false} disabled={busy} icon={<PhoneIcon />} label="Phone / WA" cls="bg-[#25D366] col-span-2" />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-game-border" />
              <span className="text-game-muted text-xs">or email</span>
              <div className="flex-1 h-px bg-game-border" />
            </div>

            <form onSubmit={handleEmail} className="space-y-2.5">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required disabled={busy}
                className="bg-game-bg border-game-border text-white text-sm" autoComplete="email" />
              <div className="relative">
                <Input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Password"
                  required disabled={busy}
                  className="bg-game-bg border-game-border text-white text-sm pr-10"
                  autoComplete={isRegister ? 'new-password' : 'current-password'} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-game-muted hover:text-white">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm">
                {loadingBtn === 'email' ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="flex justify-between text-xs text-game-muted">
              {!isRegister && (
                <button type="button" onClick={handleForgot} disabled={busy} className="hover:text-white transition-colors">
                  Forgot password?
                </button>
              )}
              <button type="button" onClick={() => setIsRegister(!isRegister)} className="hover:text-white transition-colors ml-auto">
                {isRegister ? 'Sign in instead' : 'Create account'}
              </button>
            </div>
          </>
        )}
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}
