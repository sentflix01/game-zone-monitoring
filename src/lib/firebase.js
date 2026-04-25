import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

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
let db = null;
let functions = null;

const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
  .filter((k) => !import.meta.env[k]);

if (missing.length === 0) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    // Firestore & Functions
    db = getFirestore(app);
    functions = getFunctions(app);

    if (isCapacitor) {
      try {
        auth = initializeAuth(app, { persistence: browserLocalPersistence });
      } catch (e) {
        auth = getAuth(app);
      }
    } else {
      auth = getAuth(app);
    }
  } catch (err) {
    try {
      const app = getApps()[0];
      auth = getAuth(app);
      db = getFirestore(app);
      functions = getFunctions(app);
    } catch (e) {
      console.error('[firebase] init failed:', e.message);
    }
  }
}

export { auth, db, functions };
