// ==============================================================================
// RESTROCHARGE - Staff & Internal Team Provisioning Engine
// Idempotent provisioning for Restaurant Staff and Vivexa Tech Team Members.
// Handles Firebase Authentication, Custom Claims, and Cloud Firestore persistence.
// Protects against partial failure states with safe recovery.
// ==============================================================================

import crypto from "crypto";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { firestoreService } from "@/lib/services/firestore-service";
import { dataStore } from "@/lib/services/data-store";
import { UserProfile, UserRole, RestaurantMembership, RestaurantProfile } from "@/lib/types";

export interface ProvisionStaffParams {
  restaurantId: string;
  name: string;
  email: string;
  role: "RESTAURANT_MANAGER" | "ORDER_STAFF" | "KITCHEN_STAFF";
  temporaryPassword?: string;
  performedBy: {
    uid: string;
    email: string;
    name?: string;
  };
}

export interface ProvisionVivexaTeamParams {
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "SALES_MANAGER" | "ONBOARDING_EXECUTIVE" | "SUPPORT_EXECUTIVE";
  temporaryPassword?: string;
  performedBy: {
    uid: string;
    email: string;
    name?: string;
  };
}

export interface StaffProvisionResult {
  success: boolean;
  status: "PROVISIONED" | "PARTIAL_FAILURE" | "FAILED";
  actionTaken: "EXISTING_USER_LINKED" | "NEW_USER_CREATED" | "FAILED";
  uid?: string;
  email: string;
  message: string;
  staff?: UserProfile;
  error?: string;
  errorCode?: string;
}

/**
 * Safely provisions a Restaurant Staff member (Kitchen Staff, Order Staff, Manager).
 * Ensures Firebase Auth user, Custom Claims, and Firestore documents across:
 * - `users/{uid}`
 * - `restaurantMemberships/memb_{uid}_{restaurantId}`
 * - `restaurants/{restaurantId}/staff/{uid}`
 */
export async function provisionRestaurantStaff(
  params: ProvisionStaffParams
): Promise<StaffProvisionResult> {
  const { restaurantId, name, email, role, temporaryPassword, performedBy } = params;
  const normalizedEmail = (email || "").trim().toLowerCase();
  const trimmedName = (name || "").trim() || normalizedEmail.split("@")[0];
  const nowIso = new Date().toISOString();

  // 1. Validation
  if (!restaurantId) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: "Restaurant ID is required.",
      errorCode: "INVALID_RESTAURANT_ID",
    };
  }

  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: "A valid email address is required.",
      errorCode: "INVALID_EMAIL",
    };
  }

  const validRoles = ["RESTAURANT_MANAGER", "ORDER_STAFF", "KITCHEN_STAFF"];
  if (!validRoles.includes(role)) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: `Role must be one of: ${validRoles.join(", ")}`,
      errorCode: "INVALID_ROLE",
    };
  }

  // 2. Resolve target restaurant
  let restaurant = dataStore.getRestaurantById(restaurantId);
  if (!restaurant) {
    restaurant = await firestoreService.getRestaurantById(restaurantId);
    if (restaurant) {
      dataStore.saveRestaurantLocally(restaurant);
    }
  }

  if (!restaurant) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: `Restaurant with ID '${restaurantId}' was not found.`,
      errorCode: "RESTAURANT_NOT_FOUND",
    };
  }

  // 3. Verify Firebase Admin SDK readiness
  if (!isFirebaseAdminReady()) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: "Firebase Admin SDK is not ready. Verify server service account credentials.",
      errorCode: "FIREBASE_ADMIN_NOT_READY",
    };
  }

  // 4. Locate or create Firebase Authentication user
  let authUser: any;
  let actionTaken: "EXISTING_USER_LINKED" | "NEW_USER_CREATED" = "EXISTING_USER_LINKED";

  try {
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
      actionTaken = "EXISTING_USER_LINKED";
    } catch (findErr: any) {
      if (findErr.code === "auth/user-not-found") {
        actionTaken = "NEW_USER_CREATED";
        const passwordToSet =
          temporaryPassword && temporaryPassword.length >= 6
            ? temporaryPassword
            : crypto.randomBytes(12).toString("base64") + "@Rc1";

        authUser = await adminAuth.createUser({
          email: normalizedEmail,
          displayName: trimmedName,
          password: passwordToSet,
          emailVerified: false,
        });
      } else {
        throw findErr;
      }
    }
  } catch (authErr: any) {
    console.error("[StaffProvisioning] Firebase Auth error:", authErr);
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: authErr.message || "Failed to create Firebase Authentication account.",
      errorCode: authErr.code || "AUTH_ERROR",
    };
  }

  // 5. Assign Custom User Claims
  try {
    await adminAuth.setCustomUserClaims(authUser.uid, {
      role,
      restaurantId: restaurant.id,
    });
  } catch (claimErr: any) {
    console.warn("[StaffProvisioning] Custom claims warning:", claimErr.message);
  }

  // 6. Persist to Cloud Firestore across collections (idempotent writes)
  const staffProfile: UserProfile = {
    uid: authUser.uid,
    email: normalizedEmail,
    displayName: trimmedName,
    role,
    restaurantId: restaurant.id,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const membershipId = `memb_${authUser.uid}_${restaurant.id}`;
  const membershipRecord: RestaurantMembership = {
    id: membershipId,
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    restaurantName: restaurant.name,
    uid: authUser.uid,
    email: normalizedEmail,
    role,
    status: "ACTIVE",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const batch = adminDb.batch();

    // 6a. Document in users/{uid}
    const userRef = adminDb.collection("users").doc(authUser.uid);
    batch.set(
      userRef,
      {
        uid: authUser.uid,
        email: normalizedEmail,
        displayName: trimmedName,
        role,
        restaurantId: restaurant.id,
        isActive: true,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 6b. Document in restaurantMemberships/{membershipId}
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
        displayName: trimmedName,
        role,
        status: "ACTIVE",
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 6c. Subcollection in restaurants/{restaurantId}/staff/{uid}
    const staffRef = adminDb
      .collection("restaurants")
      .doc(restaurant.id)
      .collection("staff")
      .doc(authUser.uid);
    batch.set(
      staffRef,
      {
        uid: authUser.uid,
        email: normalizedEmail,
        displayName: trimmedName,
        role,
        restaurantId: restaurant.id,
        isActive: true,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    await batch.commit();
  } catch (dbErr: any) {
    console.error("[StaffProvisioning] Firestore persistence failure:", dbErr);
    // Report actual partial-failure state
    return {
      success: false,
      status: "PARTIAL_FAILURE",
      actionTaken,
      uid: authUser.uid,
      email: normalizedEmail,
      message: `Firebase Authentication user was prepared, but Firestore records failed to write (${dbErr.message}). You can safely retry.`,
      errorCode: "FIRESTORE_WRITE_FAILED",
      error: dbErr.message,
    };
  }

  // 7. Record Super Admin / Owner Audit Log
  dataStore.addAuditLog({
    action: "PROVISION_STAFF",
    targetType: "USER",
    targetId: authUser.uid,
    performedBy: {
      uid: performedBy.uid,
      email: performedBy.email,
      name: performedBy.name || "Administrator",
    },
    details: {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      email: normalizedEmail,
      role,
      actionTaken,
    },
  });

  return {
    success: true,
    status: "PROVISIONED",
    actionTaken,
    uid: authUser.uid,
    email: normalizedEmail,
    message: `Staff member ${trimmedName} (${role.replace("_", " ")}) successfully provisioned and saved to Firestore.`,
    staff: staffProfile,
  };
}

/**
 * Provisions a Vivexa Tech Internal Team member (Super Admin, Onboarding, Sales, Support).
 */
export async function provisionVivexaTeamMember(
  params: ProvisionVivexaTeamParams
): Promise<StaffProvisionResult> {
  const { name, email, role, temporaryPassword, performedBy } = params;
  const normalizedEmail = (email || "").trim().toLowerCase();
  const trimmedName = (name || "").trim() || normalizedEmail.split("@")[0];
  const nowIso = new Date().toISOString();

  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: "A valid official email address is required.",
      errorCode: "INVALID_EMAIL",
    };
  }

  const validRoles = ["SUPER_ADMIN", "SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"];
  if (!validRoles.includes(role)) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: `Role must be one of: ${validRoles.join(", ")}`,
      errorCode: "INVALID_ROLE",
    };
  }

  if (!isFirebaseAdminReady()) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: "Firebase Admin SDK is not ready.",
      errorCode: "FIREBASE_ADMIN_NOT_READY",
    };
  }

  let authUser: any;
  let actionTaken: "EXISTING_USER_LINKED" | "NEW_USER_CREATED" = "EXISTING_USER_LINKED";

  try {
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
      actionTaken = "EXISTING_USER_LINKED";
    } catch (findErr: any) {
      if (findErr.code === "auth/user-not-found") {
        actionTaken = "NEW_USER_CREATED";
        const passwordToSet =
          temporaryPassword && temporaryPassword.length >= 6
            ? temporaryPassword
            : crypto.randomBytes(12).toString("base64") + "@Rc1";

        authUser = await adminAuth.createUser({
          email: normalizedEmail,
          displayName: trimmedName,
          password: passwordToSet,
          emailVerified: true,
        });
      } else {
        throw findErr;
      }
    }
  } catch (authErr: any) {
    return {
      success: false,
      status: "FAILED",
      actionTaken: "FAILED",
      email: normalizedEmail,
      message: authErr.message || "Failed to create Firebase Authentication account.",
      errorCode: authErr.code || "AUTH_ERROR",
    };
  }

  // Assign Vivexa Team custom claims
  const isSuper = role === "SUPER_ADMIN";
  try {
    await adminAuth.setCustomUserClaims(authUser.uid, {
      role,
      organization: "VIVEXA_TECH",
      superAdmin: isSuper,
    });
  } catch (claimErr: any) {
    console.warn("[VivexaProvisioning] Custom claims warning:", claimErr.message);
  }

  // Persist to users/{uid}
  const memberProfile: UserProfile = {
    uid: authUser.uid,
    email: normalizedEmail,
    displayName: trimmedName,
    role,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await adminDb
      .collection("users")
      .doc(authUser.uid)
      .set(
        {
          uid: authUser.uid,
          email: normalizedEmail,
          displayName: trimmedName,
          role,
          organization: "VIVEXA_TECH",
          isSuperAdmin: isSuper,
          isActive: true,
          updatedAt: nowIso,
        },
        { merge: true }
      );
  } catch (dbErr: any) {
    return {
      success: false,
      status: "PARTIAL_FAILURE",
      actionTaken,
      uid: authUser.uid,
      email: normalizedEmail,
      message: `Firebase Authentication user was prepared, but Firestore profile failed to write (${dbErr.message}). Safe to retry.`,
      errorCode: "FIRESTORE_WRITE_FAILED",
      error: dbErr.message,
    };
  }

  dataStore.addAuditLog({
    action: "PROVISION_VIVEXA_TEAM",
    targetType: "USER",
    targetId: authUser.uid,
    performedBy: {
      uid: performedBy.uid,
      email: performedBy.email,
      name: performedBy.name || "Vivexa Tech Super Admin",
    },
    details: {
      email: normalizedEmail,
      role,
      actionTaken,
    },
  });

  return {
    success: true,
    status: "PROVISIONED",
    actionTaken,
    uid: authUser.uid,
    email: normalizedEmail,
    message: `Vivexa team member ${trimmedName} (${role.replace("_", " ")}) successfully provisioned and saved to Firestore.`,
    staff: memberProfile,
  };
}

/**
 * Fetches all staff members for a restaurant from Cloud Firestore.
 */
export async function getRestaurantStaffList(restaurantId: string): Promise<UserProfile[]> {
  const staffList: UserProfile[] = [];
  if (!isFirebaseAdminReady()) return staffList;

  try {
    // Check restaurants/{restaurantId}/staff
    const subSnap = await adminDb
      .collection("restaurants")
      .doc(restaurantId)
      .collection("staff")
      .get();

    subSnap.forEach((doc) => {
      const data = doc.data();
      staffList.push({
        uid: doc.id,
        email: data.email || "",
        displayName: data.displayName || data.name || "Staff Member",
        role: data.role || "KITCHEN_STAFF",
        restaurantId,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });

    // Also check restaurantMemberships for any staff not in subcollection
    const membSnap = await adminDb
      .collection("restaurantMemberships")
      .where("restaurantId", "==", restaurantId)
      .get();

    membSnap.forEach((doc) => {
      const data = doc.data();
      const uid = data.uid || data.userId || doc.id.replace(`memb_`, "").replace(`_${restaurantId}`, "");
      if (!staffList.some((s) => s.uid === uid) && data.role !== "RESTAURANT_OWNER") {
        staffList.push({
          uid,
          email: data.email || data.userEmail || "",
          displayName: data.displayName || "Staff Member",
          role: data.role,
          restaurantId,
          isActive: data.status !== "DISABLED",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      }
    });
  } catch (err: any) {
    console.error("[StaffProvisioning] getRestaurantStaffList error:", err);
  }

  return staffList;
}

/**
 * Fetches all Vivexa Tech Internal Team members from Cloud Firestore.
 */
export async function getVivexaTeamList(): Promise<UserProfile[]> {
  const teamList: UserProfile[] = [];
  if (!isFirebaseAdminReady()) return teamList;

  try {
    // 1. Query by organization
    const orgSnap = await adminDb
      .collection("users")
      .where("organization", "==", "VIVEXA_TECH")
      .get();

    orgSnap.forEach((doc) => {
      const data = doc.data();
      teamList.push({
        uid: doc.id,
        email: data.email || "",
        displayName: data.displayName || "Team Member",
        role: data.role,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });

    // 2. Query designated Super Admin user explicitly
    const superAdminSnap = await adminDb.collection("users").doc("GDF2eldrzSNR9oltgezCr9MXt0I3").get();
    if (superAdminSnap.exists && !teamList.some((m) => m.uid === superAdminSnap.id)) {
      const data = superAdminSnap.data()!;
      teamList.push({
        uid: superAdminSnap.id,
        email: data.email || "admin@vivexatech.in",
        displayName: data.displayName || "Vivexa Tech Super Admin",
        role: "SUPER_ADMIN",
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    }

    // 3. Fallback query for any user with Vivexa team roles
    const vivexaRoles = ["SUPER_ADMIN", "SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"];
    for (const r of vivexaRoles) {
      const roleSnap = await adminDb.collection("users").where("role", "==", r).get();
      roleSnap.forEach((doc) => {
        if (!teamList.some((m) => m.uid === doc.id)) {
          const data = doc.data();
          teamList.push({
            uid: doc.id,
            email: data.email || "",
            displayName: data.displayName || "Team Member",
            role: data.role,
            isActive: data.isActive !== false,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        }
      });
    }
  } catch (err: any) {
    console.error("[StaffProvisioning] getVivexaTeamList error:", err);
  }

  return teamList;
}

/**
 * Toggles or updates status of a restaurant staff member in Firestore.
 */
export async function updateStaffStatus(
  restaurantId: string,
  uid: string,
  isActive: boolean
): Promise<boolean> {
  if (!isFirebaseAdminReady()) return false;
  const nowIso = new Date().toISOString();

  try {
    const batch = adminDb.batch();

    // 1. Update users/{uid}
    batch.update(adminDb.collection("users").doc(uid), {
      isActive,
      updatedAt: nowIso,
    });

    // 2. Update restaurants/{restaurantId}/staff/{uid}
    batch.update(
      adminDb.collection("restaurants").doc(restaurantId).collection("staff").doc(uid),
      {
        isActive,
        updatedAt: nowIso,
      }
    );

    // 3. Update restaurantMemberships/memb_{uid}_{restaurantId}
    const membRef = adminDb.collection("restaurantMemberships").doc(`memb_${uid}_${restaurantId}`);
    batch.update(membRef, {
      status: isActive ? "ACTIVE" : "DISABLED",
      updatedAt: nowIso,
    });

    await batch.commit();
    return true;
  } catch (err: any) {
    console.error("[StaffProvisioning] updateStaffStatus error:", err);
    return false;
  }
}
