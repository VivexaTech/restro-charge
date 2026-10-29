// ==============================================================================
// RESTROCHARGE - Restaurant Admin Account Provisioning Service
// Secure provisioning & recovery flow for Restaurant Owners via Firebase Admin SDK.
// ==============================================================================

import crypto from "crypto";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { RestaurantProfile } from "@/lib/types";

export interface ProvisionAdminParams {
  restaurantId: string;
  adminEmail: string;
  adminName?: string;
  temporaryPassword?: string;
  performedBy?: {
    uid: string;
    email: string;
    name?: string;
  };
}

export interface ProvisionAdminResult {
  success: boolean;
  status: "PROVISIONED" | "FAILED" | "PENDING";
  actionTaken: "EXISTING_USER_LINKED" | "NEW_USER_CREATED" | "FAILED";
  uid?: string;
  email: string;
  message: string;
  resetLink?: string;
  error?: string;
  errorCode?: string;
  restaurant?: RestaurantProfile;
}

/**
 * Safely provisions or re-provisions a Restaurant Admin account for an existing restaurant.
 * - Does NOT create duplicate restaurants.
 * - Does NOT alter passwords of existing Firebase Auth accounts.
 * - Creates account only if missing, then issues custom claims and sets Firestore record.
 * - Updates restaurant adminProvisioningStatus on the restaurant document.
 */
export async function provisionRestaurantAdmin(
  params: ProvisionAdminParams
): Promise<ProvisionAdminResult> {
  const { restaurantId, adminEmail, adminName, temporaryPassword, performedBy } = params;
  const normalizedEmail = adminEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  // 1. Locate the restaurant (check memory store & Firestore)
  let restaurant = dataStore.getRestaurantById(restaurantId);
  if (!restaurant) {
    const fromDb = await firestoreService.getRestaurantById(restaurantId);
    if (fromDb) {
      restaurant = fromDb;
      dataStore.saveRestaurant(fromDb);
    }
  }

  if (!restaurant) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: `Restaurant with ID '${restaurantId}' was not found. Cannot provision admin for non-existent restaurant.`,
      error: "RESTAURANT_NOT_FOUND",
      errorCode: "NOT_FOUND",
    };
  }

  // 2. Verify Firebase Admin SDK availability
  if (!isFirebaseAdminReady()) {
    const errorMsg =
      "Firebase Admin SDK is not initialized with valid service account credentials. Verify FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.";
    
    // Update restaurant record with failed status
    restaurant.adminProvisioningStatus = "FAILED";
    restaurant.adminProvisioningError = errorMsg;
    restaurant.updatedAt = nowIso;
    dataStore.saveRestaurant(restaurant);
    try {
      await firestoreService.saveRestaurant(restaurant);
    } catch {
      // ignore secondary db error
    }

    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: errorMsg,
      error: errorMsg,
      errorCode: "FIREBASE_ADMIN_NOT_READY",
      restaurant,
    };
  }

  try {
    let authUser: any;
    let actionTaken: "EXISTING_USER_LINKED" | "NEW_USER_CREATED" = "EXISTING_USER_LINKED";
    let message = "";
    let resetLink: string | undefined = undefined;

    // 3. Check if user already exists in Firebase Authentication
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
      actionTaken = "EXISTING_USER_LINKED";
      message = `Existing account found for ${normalizedEmail}. Linked to restaurant without altering existing credentials.`;
    } catch (findErr: any) {
      if (findErr.code === "auth/user-not-found") {
        // User does not exist: create new account with secure random credentials
        actionTaken = "NEW_USER_CREATED";
        const passwordToSet =
          temporaryPassword || crypto.randomBytes(12).toString("base64") + "@Rc1";

        authUser = await adminAuth.createUser({
          email: normalizedEmail,
          displayName: adminName || restaurant.ownerName || `${restaurant.name} Owner`,
          password: passwordToSet,
          emailVerified: false,
        });

        // Try generating a secure one-time password reset link
        try {
          resetLink = await adminAuth.generatePasswordResetLink(normalizedEmail);
        } catch {
          // If custom action handler URL isn't configured, fall back gracefully
        }

        message = `New Restaurant Admin account created for ${normalizedEmail}.`;
      } else {
        throw findErr;
      }
    }

    // 4. Assign Cryptographic Custom Claims for RESTAURANT_OWNER
    await adminAuth.setCustomUserClaims(authUser.uid, {
      role: "RESTAURANT_OWNER",
      restaurantId: restaurant.id,
    });

    // 5. Create or merge user document in Firestore 'users/{uid}'
    try {
      await adminDb
        .collection("users")
        .doc(authUser.uid)
        .set(
          {
            uid: authUser.uid,
            email: normalizedEmail,
            displayName: adminName || authUser.displayName || restaurant.ownerName || `${restaurant.name} Owner`,
            role: "RESTAURANT_OWNER",
            restaurantId: restaurant.id,
            isActive: true,
            updatedAt: nowIso,
          },
          { merge: true }
        );
    } catch (userDbErr: any) {
      console.warn("[Admin Provisioning] Warning syncing users collection:", userDbErr.message);
    }

    // 6. Update the existing Restaurant record with the verified Owner UID & Provisioned status
    restaurant.ownerUid = authUser.uid;
    restaurant.ownerEmail = normalizedEmail;
    if (adminName) restaurant.ownerName = adminName;
    restaurant.adminProvisioningStatus = "PROVISIONED";
    restaurant.adminProvisioningError = undefined;
    restaurant.adminProvisionedAt = nowIso;
    restaurant.updatedAt = nowIso;

    dataStore.saveRestaurant(restaurant);
    try {
      await firestoreService.saveRestaurant(restaurant);
    } catch (restDbErr: any) {
      console.warn("[Admin Provisioning] Warning syncing restaurant document:", restDbErr.message);
    }

    // 7. Record Super Admin Audit Log
    dataStore.addAuditLog({
      action: "PROVISION_RESTAURANT_ADMIN",
      targetType: "RESTAURANT",
      targetId: restaurant.id,
      performedBy: {
        uid: performedBy?.uid || "super-admin",
        email: performedBy?.email || "admin@vivexatech.in",
        name: performedBy?.name || "Super Admin",
      },
      details: {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        adminEmail: normalizedEmail,
        adminUid: authUser.uid,
        actionTaken,
      },
    });

    return {
      success: true,
      status: "PROVISIONED",
      actionTaken,
      uid: authUser.uid,
      email: normalizedEmail,
      message,
      resetLink,
      restaurant,
    };
  } catch (err: any) {
    const errorMsg = err.message || "Failed to provision Restaurant Admin account";
    console.error("[Admin Provisioning Error]:", errorMsg);

    // Update restaurant document with FAILED status and error detail
    restaurant.adminProvisioningStatus = "FAILED";
    restaurant.adminProvisioningError = errorMsg;
    restaurant.updatedAt = nowIso;

    dataStore.saveRestaurant(restaurant);
    try {
      await firestoreService.saveRestaurant(restaurant);
    } catch {
      // ignore secondary error
    }

    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: `Failed to provision Restaurant Admin account: ${errorMsg}`,
      error: errorMsg,
      errorCode: err.code || "PROVISIONING_FAILED",
      restaurant,
    };
  }
}
