import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const FILE_NAMES = ['service-account.json', 'firebase-adminsdk.json'];

function loadCredentials() {
  // 1) Local file in the project root (development only)
  for (const name of FILE_NAMES) {
    const file = path.join(process.cwd(), name);
    if (existsSync(file)) {
      const json = JSON.parse(readFileSync(file, 'utf8'));
      return {
        projectId: json.project_id as string,
        clientEmail: json.client_email as string,
        privateKey: json.private_key as string,
      };
    }
  }

  // 2) Whole service-account JSON as one base64 string (use this on Vercel)
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return {
      projectId: json.project_id as string,
      clientEmail: json.client_email as string,
      privateKey: json.private_key as string,
    };
  }

  throw new Error(
    'No Firebase Admin credentials. Add firebase-adminsdk.json to the project root, or set FIREBASE_SERVICE_ACCOUNT_BASE64.'
  );
}

function init(): App {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(loadCredentials()) });
}

const app = init();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);