// ==============================================================================
// RESTROCHARGE - Restaurant Admin Account Provisioning Service
// Secure provisioning & recovery flow for Restaurant Owners via Firebase Admin SDK.
// ==============================================================================

import crypto from "crypto";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { RestaurantProfile, RestaurantMembership, UserProfile } from "@/lib/types";

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
  status: "PROVISIONED" | "FAILED" | "PENDING" | "PARTIAL_FAILURE";
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
 * - Creates account only if missing, then issues custom claims and sets Firestore records.
 * - Atomically persists and verifies user profile, restaurant membership, and restaurant record.
 * - Handles partial failures without falsely reporting success.
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
      dataStore.saveRestaurantLocally(fromDb);
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

    restaurant.adminProvisioningStatus = "FAILED";
    restaurant.adminProvisioningError = errorMsg;
    restaurant.updatedAt = nowIso;
    dataStore.saveRestaurantLocally(restaurant);
    try {
      await adminDb.collection("restaurants").doc(restaurant.id).set(
        {
          adminProvisioningStatus: "FAILED",
          adminProvisioningError: errorMsg,
          updatedAt: nowIso,
        },
        { merge: true }
      );
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

    // 5. Batch Firestore Persistence: User Profile, Restaurant Membership, and Restaurant Status
    const membershipId = `memb_${authUser.uid}_${restaurant.id}`;
    const displayNameToSet = adminName || authUser.displayName || restaurant.ownerName || `${restaurant.name} Owner`;

    try {
      const batch = adminDb.batch();

      // 5a. Profile in users/{uid}
      const userRef = adminDb.collection("users").doc(authUser.uid);
      batch.set(
        userRef,
        {
          uid: authUser.uid,
          email: normalizedEmail,
          displayName: displayNameToSet,
          role: "RESTAURANT_OWNER",
          restaurantId: restaurant.id,
          isActive: true,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      // 5b. Membership in restaurantMemberships/{membershipId}
      const membRef = adminDb.collection("restaurantMemberships").doc(membershipId);
      batch.set(
        membRef,
        {
          id: membershipId,
          restaurantId: restaurant.id,
          restaurantSlug: restaurant.slug,
          restaurantName: restaurant.name,
          uid: authUser.uid,
          userId: authUser.uid,
          email: normalizedEmail,
          userEmail: normalizedEmail,
          displayName: displayNameToSet,
          role: "RESTAURANT_OWNER",
          status: "ACTIVE",
          updatedAt: nowIso,
          createdAt: nowIso,
        },
        { merge: true }
      );

      // 5c. Restaurant document update (explicitly clear adminProvisioningError with null)
      const restRef = adminDb.collection("restaurants").doc(restaurant.id);
      batch.set(
        restRef,
        {
          ownerUid: authUser.uid,
          ownerEmail: normalizedEmail,
          ...(adminName ? { ownerName: adminName } : {}),
          adminProvisioningStatus: "PROVISIONED",
          adminProvisioningError: null,
          adminProvisionedAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      // 5d. Audit Log in adminAuditLogs
      const auditLogId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const auditRef = adminDb.collection("adminAuditLogs").doc(auditLogId);
      batch.set(auditRef, {
        id: auditLogId,
        action: "PROVISION_RESTAURANT_ADMIN",
        targetType: "RESTAURANT",
        targetId: restaurant.id,
        performedBy: {
          uid: performedBy?.uid || "super-admin",
          email: performedBy?.email || "admin@vivexatech.in",
          name: performedBy?.name || "Vivexa Tech Super Admin",
        },
        details: {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          adminEmail: normalizedEmail,
          adminUid: authUser.uid,
          actionTaken,
        },
        timestamp: nowIso,
      });

      await batch.commit();
    } catch (dbErr: any) {
      console.error("[Admin Provisioning] Firestore batch persistence failure:", dbErr);
      const partialError = `Authentication account was prepared (${authUser.uid}), but Firestore profile and membership failed to write: ${dbErr.message}`;

      // Update local and remote restaurant record with PARTIAL_FAILURE
      restaurant.ownerUid = authUser.uid;
      restaurant.ownerEmail = normalizedEmail;
      restaurant.adminProvisioningStatus = "PARTIAL_FAILURE";
      restaurant.adminProvisioningError = partialError;
      restaurant.updatedAt = nowIso;
      dataStore.saveRestaurantLocally(restaurant);

      try {
        await adminDb.collection("restaurants").doc(restaurant.id).set(
          {
            ownerUid: authUser.uid,
            ownerEmail: normalizedEmail,
            adminProvisioningStatus: "PARTIAL_FAILURE",
            adminProvisioningError: partialError,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } catch {
        // ignore secondary error
      }

      return {
        success: false,
        status: "PARTIAL_FAILURE",
        actionTaken,
        uid: authUser.uid,
        email: normalizedEmail,
        message: `Firebase Authentication account was established, but Firestore profile and restaurant membership failed to persist (${dbErr.message}). You can safely retry provisioning.`,
        error: partialError,
        errorCode: "FIRESTORE_WRITE_FAILED",
        restaurant,
      };
    }

    // 6. Explicit Verification: Verify all records exist before reporting success
    const [verifiedUserDoc, verifiedMembDoc, verifiedRestDoc] = await Promise.all([
      adminDb.collection("users").doc(authUser.uid).get(),
      adminDb.collection("restaurantMemberships").doc(membershipId).get(),
      adminDb.collection("restaurants").doc(restaurant.id).get(),
    ]);

    if (!verifiedUserDoc.exists || !verifiedMembDoc.exists || !verifiedRestDoc.exists) {
      const verifyError = `Post-provisioning verification failed: Missing ${[
        !verifiedUserDoc.exists && "user profile",
        !verifiedMembDoc.exists && "restaurant membership",
        !verifiedRestDoc.exists && "restaurant document",
      ]
        .filter(Boolean)
        .join(", ")}.`;

      restaurant.adminProvisioningStatus = "PARTIAL_FAILURE";
      restaurant.adminProvisioningError = verifyError;
      restaurant.updatedAt = nowIso;
      dataStore.saveRestaurantLocally(restaurant);

      return {
        success: false,
        status: "PARTIAL_FAILURE",
        actionTaken,
        uid: authUser.uid,
        email: normalizedEmail,
        message: verifyError,
        error: verifyError,
        errorCode: "VERIFICATION_FAILED",
        restaurant,
      };
    }

    // 7. Update in-memory state
    restaurant.ownerUid = authUser.uid;
    restaurant.ownerEmail = normalizedEmail;
    if (adminName) restaurant.ownerName = adminName;
    restaurant.adminProvisioningStatus = "PROVISIONED";
    restaurant.adminProvisioningError = null;
    restaurant.adminProvisionedAt = nowIso;
    restaurant.updatedAt = nowIso;
    dataStore.saveRestaurantLocally(restaurant);

    dataStore.addAuditLog({
      action: "PROVISION_RESTAURANT_ADMIN",
      targetType: "RESTAURANT",
      targetId: restaurant.id,
      performedBy: {
        uid: performedBy?.uid || "super-admin",
        email: performedBy?.email || "admin@vivexatech.in",
        name: performedBy?.name || "Vivexa Tech Super Admin",
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
    let errorMsg = err.message || "Failed to provision Restaurant Admin account";
    if (errorMsg.includes("invalid_grant")) {
      errorMsg =
        "Google OAuth2 authentication failed (invalid_grant: account not found). The configured service account email does not exist in Google Cloud IAM for the active Firebase project.";
    }
    console.error("[Admin Provisioning Error]:", errorMsg);

    // Update restaurant document with FAILED status and error detail
    restaurant.adminProvisioningStatus = "FAILED";
    restaurant.adminProvisioningError = errorMsg;
    restaurant.updatedAt = nowIso;

    dataStore.saveRestaurantLocally(restaurant);
    try {
      await adminDb.collection("restaurants").doc(restaurant.id).set(
        {
          adminProvisioningStatus: "FAILED",
          adminProvisioningError: errorMsg,
          updatedAt: nowIso,
        },
        { merge: true }
      );
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
