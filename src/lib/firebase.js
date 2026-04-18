import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check all required vars are present
const missingVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
  .filter((k) => !import.meta.env[k]);

let auth;

if (missingVars.length > 0) {
  console.error('[firebase] Missing env vars:', missingVars.join(', '));
  // Stub — app will show login but auth won't work
  auth = {
    currentUser: null,
    onAuthStateChanged: (cb) => { cb(null); return () => {}; },
    signOut: () => Promise.resolve(),
  };
} else {
  try {
    // Prevent duplicate app initialization
    const app = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];
    auth = getAuth(app);
  } catch (err) {
    console.error('[firebase] init failed:', err.message);
    auth = {
      currentUser: null,
      onAuthStateChanged: (cb) => { cb(null); return () => {}; },
      signOut: () => Promise.resolve(),
    };
  }
}

export { auth };
