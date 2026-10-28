// ==============================================================================
// RESTROCHARGE - Firebase Admin SDK Initializer (Server Only)
// Privileged database operations, custom claims, and verification.
// ==============================================================================

import * as admin from "firebase-admin";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (privateKey && privateKey.includes("\\n")) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

let adminApp: admin.app.App;
let isReady = false;

if (!admin.apps.length) {
  const hasValidCert = Boolean(
    projectId &&
    clientEmail &&
    privateKey &&
    privateKey.includes("BEGIN PRIVATE KEY")
  );

  if (hasValidCert) {
    try {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      isReady = true;
    } catch (e: any) {
      console.warn("[Firebase Admin] Certificate initialization failed, falling back to project ID:", e.message);
      adminApp = admin.initializeApp({ projectId: projectId || "restro-charge" });
    }
  } else {
    // Development or fallback initialization
    adminApp = admin.initializeApp({
      projectId: projectId || "restro-charge",
    });
  }
} else {
  adminApp = admin.app();
  isReady = true;
}

export function isFirebaseAdminReady(): boolean {
  return isReady;
}

export const adminDb = adminApp.firestore();
export const adminAuth = adminApp.auth();
export default adminApp;
