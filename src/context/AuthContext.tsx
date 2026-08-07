import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
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
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);

        // Update online status
        await setDoc(
          doc(db, 'users', fbUser.uid),
          { isOnline: true, lastSeen: Date.now() },
          { merge: true }
        );

        // Listen to profile changes in real-time
        const unsubProfile = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
          if (snap.exists()) {
            setUser({ uid: fbUser.uid, ...snap.data() } as UserProfile);
          }
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setFirebaseUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    // Mark offline on tab close
    const handleOffline = () => {
      if (auth.currentUser) {
        setDoc(
          doc(db, 'users', auth.currentUser.uid),
          { isOnline: false, lastSeen: Date.now() },
          { merge: true }
        );
      }
    };
    window.addEventListener('beforeunload', handleOffline);

    return () => {
      unsubAuth();
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
