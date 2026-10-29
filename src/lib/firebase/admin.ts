// ==============================================================================
// RESTROCHARGE - Firebase Admin SDK Initializer (Server Only)
// Privileged database operations, custom claims, and verification.
// ==============================================================================

import * as admin from "firebase-admin";
import fs from "fs";

interface AdminGlobalCache {
  app?: admin.app.App;
  source?: string;
  hasRealCert?: boolean;
  verifiedEmail?: string;
  verifiedProjectId?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __RESTRO_FIREBASE_ADMIN__: AdminGlobalCache | undefined;
}

const globalCache: AdminGlobalCache = globalThis.__RESTRO_FIREBASE_ADMIN__ || {};
globalThis.__RESTRO_FIREBASE_ADMIN__ = globalCache;

/**
 * Normalizes an RSA private key string by stripping surrounding quotes,
 * resolving escaped newlines, removing carriage returns, and decoding base64 if needed.
 */
function cleanPrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;

  let cleaned = raw.trim();

  // Strip wrapping single or double quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Handle base64 encoding if someone base64-encoded the key
  if (!cleaned.includes("BEGIN PRIVATE KEY") && cleaned.length > 100) {
    try {
      const decoded = Buffer.from(cleaned, "base64").toString("utf8");
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        cleaned = decoded;
      }
    } catch {
      // not base64, proceed with raw
    }
  }

  // Normalize newlines and carriage returns
  cleaned = cleaned.replace(/\\n/g, "\n").replace(/\r/g, "");

  return cleaned;
}

/**
 * Resolves Firebase Admin SDK credentials from all supported sources:
 * 1. Raw JSON string in FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_KEY
 * 2. File path in GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_CREDENTIALS_PATH
 * 3. Individual environment variables (FIREBASE_ADMIN_PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
 */
function resolveCredentials(): {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  source: string;
} {
  // 1. Raw JSON in environment variable
  const jsonEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonEnv) {
    try {
      let jsonString = jsonEnv.trim();
      if (!jsonString.startsWith("{")) {
        try {
          const decoded = Buffer.from(jsonString, "base64").toString("utf8");
          if (decoded.startsWith("{")) {
            jsonString = decoded;
          }
        } catch {
          // not base64
        }
      }
      const parsed = JSON.parse(jsonString);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: cleanPrivateKey(parsed.private_key),
          source: "ENV_SERVICE_ACCOUNT_JSON",
        };
      }
    } catch (e: any) {
      console.warn("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  // 2. File path
  const filePath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_CREDENTIALS_PATH;
  if (filePath && fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(fileContent);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: cleanPrivateKey(parsed.private_key),
          source: `FILE:${filePath}`,
        };
      }
    } catch (e: any) {
      console.warn("[Firebase Admin] Failed to read credentials file:", e.message);
    }
  }

  // 3. Individual environment variables
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "restro-charge";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = cleanPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
      source: "ENV_INDIVIDUAL_VARS",
    };
  }

  return {
    projectId,
    source: "PROJECT_ID_FALLBACK",
  };
}

function initAdminApp(): { app: admin.app.App; hasRealCert: boolean; source: string } {
  const creds = resolveCredentials();
  const hasValidCert = Boolean(
    creds.projectId &&
      creds.clientEmail &&
      creds.privateKey &&
      creds.privateKey.includes("BEGIN PRIVATE KEY")
  );

  // If already initialized in this process/globalCache
  if (admin.apps.length > 0) {
    const existingApp = admin.app();
    // If the existing app already has a valid cert or we don't have new credentials, reuse it
    if (globalCache.hasRealCert || !hasValidCert) {
      return {
        app: existingApp,
        hasRealCert: Boolean(globalCache.hasRealCert),
        source: globalCache.source || "EXISTING_APP",
      };
    }
    // If existing app was a dummy fallback and we now have a valid cert, cleanly reinitialize
    try {
      existingApp.delete();
    } catch {
      // ignore deletion error
    }
  }

  if (hasValidCert) {
    try {
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: creds.projectId!,
          clientEmail: creds.clientEmail!,
          privateKey: creds.privateKey!,
        }),
      });

      globalCache.app = app;
      globalCache.hasRealCert = true;
      globalCache.source = creds.source;
      globalCache.verifiedEmail = creds.clientEmail;
      globalCache.verifiedProjectId = creds.projectId;

      return { app, hasRealCert: true, source: creds.source };
    } catch (e: any) {
      console.warn("[Firebase Admin] Certificate init failed, falling back to projectId:", e.message);
    }
  }

  // Uncredentialed fallback (ADC or local dev)
  const fallbackApp = admin.initializeApp({
    projectId: creds.projectId || "restro-charge",
  });

  globalCache.app = fallbackApp;
  globalCache.hasRealCert = false;
  globalCache.source = "PROJECT_ID_FALLBACK";

  return { app: fallbackApp, hasRealCert: false, source: "PROJECT_ID_FALLBACK" };
}

const { app: adminApp, hasRealCert: isReady, source: credentialSource } = initAdminApp();

export function isFirebaseAdminReady(): boolean {
  return Boolean(globalCache.hasRealCert ?? isReady);
}

export function getFirebaseAdminCredentialSource(): string {
  return globalCache.source || credentialSource;
}

export function getFirebaseAdminConfigInfo(): {
  isConfigured: boolean;
  projectId?: string;
  clientEmail?: string;
  source: string;
} {
  return {
    isConfigured: isFirebaseAdminReady(),
    projectId: globalCache.verifiedProjectId || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: globalCache.verifiedEmail || process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    source: getFirebaseAdminCredentialSource(),
  };
}

/**
 * Tests actual token exchange against Google OAuth2.
 * Returns structured health check without exposing secrets.
 */
export async function verifyFirebaseAdminConnection(): Promise<{
  success: boolean;
  projectId?: string;
  clientEmail?: string;
  error?: string;
  errorCode?: string;
}> {
  const config = getFirebaseAdminConfigInfo();
  if (!config.isConfigured) {
    return {
      success: false,
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      error: "Firebase Admin SDK is not configured with valid service account credentials.",
      errorCode: "NOT_CONFIGURED",
    };
  }

  try {
    // Non-destructive auth verification call
    await adminAuth.listUsers(1);
    return {
      success: true,
      projectId: config.projectId,
      clientEmail: config.clientEmail,
    };
  } catch (err: any) {
    return {
      success: false,
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      error: err.message,
      errorCode: err.code || "AUTH_FAILED",
    };
  }
}

export const adminDb = adminApp.firestore();
export const adminAuth = adminApp.auth();
export default adminApp;
