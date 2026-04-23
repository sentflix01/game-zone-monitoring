import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

const stub = {
  currentUser: null,
  onAuthStateChanged: (cb) => { setTimeout(() => cb(null), 0); return () => {}; },
  signOut: () => Promise.resolve(),
};

let auth = stub;

const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
  .filter((k) => !import.meta.env[k]);

if (missing.length === 0) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    if (isCapacitor) {
      // On Android WebView, try indexedDB first, fall back to localStorage
      // indexedDB can hang silently in some WebView versions
      try {
        auth = initializeAuth(app, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        });
      } catch (e) {
        auth = getAuth(app);
      }
    } else {
      auth = getAuth(app);
    }
  } catch (err) {
    // If initializeAuth already called, fall back to getAuth
    try {
      const app = getApps()[0];
      auth = getAuth(app);
    } catch (e) {
      console.error('[firebase] init failed:', e.message);
    }
  }
}

export { auth };
