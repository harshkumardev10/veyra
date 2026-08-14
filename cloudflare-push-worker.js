/**
 * VEYRA Push Notification Cloudflare Worker
 *
 * Deploys FREE on Cloudflare Workers (100k req/day free).
 * 
 * SETUP STEPS:
 * 1. Go to https://workers.cloudflare.com - sign up (free)
 * 2. Create a new Worker, paste this entire code
 * 3. Add Environment Variables in Worker Settings:
 *    - FIREBASE_PROJECT_ID = veyra-app-d297a
 *    - FIREBASE_CLIENT_EMAIL = (from Firebase service account JSON)
 *    - FIREBASE_PRIVATE_KEY = (from Firebase service account JSON - the full BEGIN PRIVATE KEY block)
 *    - FIREBASE_API_KEY = AIzaSyAYHO2GCdvtmPr8lXzsJM1Lf0fCBCzeSBE
 * 4. Add a Cron Trigger: every 1 minute - use expression:  star/1 star star star star
 * 5. Done! Worker runs every minute, sends FCM pushes to users
 *
 * HOW TO GET SERVICE ACCOUNT JSON:
 * Firebase Console => Project Settings => Service Accounts => Generate New Private Key
 * Download the JSON and copy clientEmail and privateKey from it.
 */

// Cloudflare Worker entry point
export default {
  // Called by Cron trigger every minute
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processPushQueue(env));
  },

  // Also handle HTTP requests (for testing)
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      ctx.waitUntil(processPushQueue(env));
      return new Response(JSON.stringify({ ok: true, message: 'Push queue processed' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('VEYRA Push Worker', { status: 200 });
  },
};

async function processPushQueue(env) {
  try {
    const projectId = env.FIREBASE_PROJECT_ID;
    const apiKey = env.FIREBASE_API_KEY;

    // Get pending push requests from Firestore pushQueue collection
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pushQueue?key=${apiKey}&pageSize=20&orderBy=createdAt`;
    const queueRes = await fetch(firestoreUrl);
    if (!queueRes.ok) return;

    const queueData = await queueRes.json();
    const docs = queueData.documents || [];

    for (const doc of docs) {
      const fields = doc.fields || {};
      const toUid = fields.toUid?.stringValue;
      const fromName = fields.fromName?.stringValue || 'VEYRA';
      const message = fields.message?.stringValue || 'New message';
      const chatId = fields.chatId?.stringValue || '';
      const createdAt = parseInt(fields.createdAt?.integerValue || '0');
      const docName = doc.name;
      const docId = docName.split('/').pop();

      // Skip if older than 30 seconds (stale)
      if (Date.now() - createdAt > 30000) {
        await deleteFirestoreDoc(projectId, apiKey, 'pushQueue', docId);
        continue;
      }

      if (!toUid) {
        await deleteFirestoreDoc(projectId, apiKey, 'pushQueue', docId);
        continue;
      }

      // Get recipient's FCM token from Firestore
      const userRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${toUid}?key=${apiKey}`
      );
      if (!userRes.ok) {
        await deleteFirestoreDoc(projectId, apiKey, 'pushQueue', docId);
        continue;
      }
      const userData = await userRes.json();
      const fcmToken = userData.fields?.fcmToken?.stringValue;

      if (!fcmToken) {
        await deleteFirestoreDoc(projectId, apiKey, 'pushQueue', docId);
        continue;
      }

      // Send FCM push notification via legacy API (simple, no auth needed for basic messaging)
      // NOTE: To use FCM v1 API with service account auth, see commented section below
      const fcmRes = await sendFCMPush(env, fcmToken, fromName, message, chatId);
      console.log('FCM push sent:', fcmRes.status);

      // Delete processed push request
      await deleteFirestoreDoc(projectId, apiKey, 'pushQueue', docId);
    }
  } catch (err) {
    console.error('Push queue error:', err);
  }
}

async function sendFCMPush(env, token, title, body, chatId) {
  // Get OAuth2 access token using service account
  const accessToken = await getServiceAccountToken(env);

  const projectId = env.FIREBASE_PROJECT_ID;
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const payload = {
    message: {
      token,
      notification: {
        title: `💬 ${title}`,
        body,
      },
      data: {
        chatId: chatId || '',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'veyra_messages',
        },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title: `💬 ${title}`,
          body,
          icon: 'https://harshkumardev10.github.io/veyra/pwa-192x192.png',
          badge: 'https://harshkumardev10.github.io/veyra/pwa-192x192.png',
          vibrate: [200, 100, 200],
        },
      },
    },
  };

  return fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function getServiceAccountToken(env) {
  // Create JWT for Google OAuth2
  const email = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    sub: email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const jwt = await createJWT(payload, privateKey);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function createJWT(payload, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encoder = new TextEncoder();

  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const sigInput = `${headerB64}.${payloadB64}`;

  // Import RSA private key
  const pemBody = privateKeyPem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${sigInput}.${sigB64}`;
}

async function deleteFirestoreDoc(projectId, apiKey, collection, docId) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}?key=${apiKey}`,
    { method: 'DELETE' }
  ).catch(() => {});
}
