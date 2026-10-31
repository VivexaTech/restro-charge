// ==============================================================================
// RESTROCHARGE - Firebase Client SDK Initializer
// ==============================================================================

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBMwS7CicyMg5iYsdIIDhEpF2wRaKOwTMs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "restro-charge.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "restro-charge",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "restro-charge.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "105115979205",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:105115979205:web:90942d0103c6eb30bbcfac",
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Returns Firebase Messaging instance in browser environments that support Web Push.
 */
export async function getClientMessaging() {
  if (typeof window === "undefined") return null;
  try {
    const { getMessaging, isSupported } = await import("firebase/messaging");
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;
    return getMessaging(app);
  } catch (err) {
    console.warn("[Firebase Client] Messaging init error:", err);
    return null;
  }
}

export { app, auth, db, googleProvider };
