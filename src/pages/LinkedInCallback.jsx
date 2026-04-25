import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebase';
import { toast } from 'sonner';

export default function LinkedInCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const code    = params.get('code');
    const state   = params.get('state');
    const error   = params.get('error');

    if (error) {
      toast.error('LinkedIn sign-in was cancelled.');
      navigate('/login');
      return;
    }

    const savedState = sessionStorage.getItem('linkedin_oauth_state');
    if (!code || state !== savedState) {
      toast.error('Invalid LinkedIn callback. Please try again.');
      navigate('/login');
      return;
    }

    sessionStorage.removeItem('linkedin_oauth_state');

    const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
    const getLinkedInToken = httpsCallable(functions, 'linkedinAuth');

    getLinkedInToken({ code, redirectUri })
      .then(({ data }) => signInWithCustomToken(auth, data.firebaseToken))
      .then(() => navigate('/'))
      .catch((err) => {
        console.error('LinkedIn auth error:', err);
        toast.error('LinkedIn sign-in failed. Please try again.');
        navigate('/login');
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-game-muted text-sm">Completing LinkedIn sign-in…</p>
    </div>
  );
}
