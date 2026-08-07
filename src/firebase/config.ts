// Firebase SDK initialization with explicit production fallback
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
