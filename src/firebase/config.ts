// Firebase SDK initialization with auto-detect long polling fallback for mobile devices
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAYHO2GCdvtmPr8lXzsJM1Lf0fCBCzeSBE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'veyra-app-d297a.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'veyra-app-d297a',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'veyra-app-d297a.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '397763809738',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:397763809738:web:7037502e08415a38bdff33',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Initialize Firestore with auto-detect long polling to prevent mobile database closure errors
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const googleProvider = new GoogleAuthProvider();

// Lazy-initialize FCM only in supported environments (not in SW, not in Safari iOS)
export const getMessagingInstance = async () => {
  try {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
};

export default app;
