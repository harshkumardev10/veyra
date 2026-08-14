import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: any;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);

        // Update online status safely without throwing if mobile connection/database is resetting
        setDoc(
          doc(db, 'users', fbUser.uid),
          { isOnline: true, lastSeen: Date.now() },
          { merge: true }
        ).catch((err) => console.warn('Failed to set online status:', err));

        // Listen to user profile doc in real-time with error resilience for mobile devices
        unsubProfile = onSnapshot(
          doc(db, 'users', fbUser.uid),
          (snap) => {
            if (snap.exists()) {
              setUser({ uid: fbUser.uid, ...snap.data() } as UserProfile);
            } else {
              // Fallback user object if profile doc hasn't finished creation
              setUser({
                uid: fbUser.uid,
                email: fbUser.email || '',
                displayName: fbUser.displayName || 'User',
                username: fbUser.email ? fbUser.email.split('@')[0] : 'user',
                photoURL: fbUser.photoURL || '',
                bio: '',
                createdAt: Date.now(),
                isOnline: true,
                lastSeen: Date.now(),
              });
            }
            setLoading(false);
          },
          (err) => {
            console.warn('Profile snapshot error (handling mobile fallback):', err);
            // Fallback so user login is NEVER blocked by DB error
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'User',
              username: fbUser.email ? fbUser.email.split('@')[0] : 'user',
              photoURL: fbUser.photoURL || '',
              bio: '',
              createdAt: Date.now(),
              isOnline: true,
              lastSeen: Date.now(),
            });
            setLoading(false);
          }
        );
      } else {
        if (unsubProfile) unsubProfile();
        setFirebaseUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    // Safely update last seen when app/tab is closed without throwing unhandled rejection
    const handleOffline = () => {
      if (auth.currentUser) {
        setDoc(
          doc(db, 'users', auth.currentUser.uid),
          { isOnline: false, lastSeen: Date.now() },
          { merge: true }
        ).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleOffline);
    window.addEventListener('pagehide', handleOffline);

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      window.removeEventListener('beforeunload', handleOffline);
      window.removeEventListener('pagehide', handleOffline);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
