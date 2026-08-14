import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db, getMessagingInstance } from '../firebase/config';

const VAPID_KEY = 'BLDaUxQjqxyiHcIWbCBvV1ca10kW2vcb_ql5WVVlxXFr4C8SXkIZiWotGfy-9zd-lUg89AxpO9JNilTbVxYDEBM';

export const useFCM = (uid: string | null) => {
  useEffect(() => {
    if (!uid) return;

    const registerToken = async () => {
      try {
        // Check notification permission
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        // Get messaging instance (returns null if not supported)
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        // Get FCM registration token using VAPID key
        const swReg = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (token) {
          // Save FCM token to Firestore under user's document
          await setDoc(
            doc(db, 'users', uid),
            { fcmToken: token, fcmUpdatedAt: Date.now() },
            { merge: true }
          );
          console.log('[VEYRA FCM] Token registered:', token.slice(0, 20) + '...');
        }
      } catch (err) {
        console.warn('[VEYRA FCM] Token registration failed:', err);
      }
    };

    registerToken();
  }, [uid]);
};
