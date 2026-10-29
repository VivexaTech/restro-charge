// ==============================================================================
// RESTROCHARGE - Identity & Restaurant Membership Resolution API Route
// Authoritative backend resolution of:
// 1. Super Admin
// 2. Vivexa Tech Internal Team Members
// 3. Restaurant Owners
// 4. Restaurant Staff (Kitchen, Order, Managers)
// Ensures strict tenant isolation with zero hardcoded fallbacks to demo restaurants.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { firestoreService } from "@/lib/services/firestore-service";
import { dataStore } from "@/lib/services/data-store";
import { RestaurantProfile, RestaurantMembership, UserRole } from "@/lib/types";

const SUPER_ADMIN_EMAIL = "admin@vivexatech.in";
const SUPER_ADMIN_UID = "GDF2eldrzSNR9oltgezCr9MXt0I3";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    let token = "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Missing Bearer token." }, { status: 401 });
    }

    if (!isFirebaseAdminReady()) {
      return NextResponse.json(
        { error: "Server error: Firebase Admin SDK not configured." },
        { status: 503 }
      );
    }

    // 1. Verify ID token with Firebase Admin
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Unauthorized: Invalid token (${err.message}).` },
        { status: 401 }
      );
    }

    const { uid, email, name } = decodedToken;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const nowIso = new Date().toISOString();

    // 2. Check if Super Admin
    if (normalizedEmail === SUPER_ADMIN_EMAIL || uid === SUPER_ADMIN_UID) {
      let needsRefresh = false;
      if (decodedToken.role !== "SUPER_ADMIN" || decodedToken.superAdmin !== true) {
        await adminAuth.setCustomUserClaims(uid, {
          role: "SUPER_ADMIN",
          superAdmin: true,
          organization: "VIVEXA_TECH",
        });
        needsRefresh = true;
      }

      return NextResponse.json({
        success: true,
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        isVivexaTeam: true,
        restaurantId: null,
        restaurantName: null,
        restaurantSlug: null,
        targetDashboard: "/super-admin",
        requiresTokenRefresh: needsRefresh,
      });
    }

    // 3. Inspect user's document in Firestore 'users/{uid}'
    let userDocData: any = null;
    if (adminDb) {
      try {
        const userDocSnap = await adminDb.collection("users").doc(uid).get();
        if (userDocSnap.exists) {
          userDocData = userDocSnap.data();
        } else if (normalizedEmail) {
          // Fallback search by email in users collection
          const emailUserSnap = await adminDb
            .collection("users")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!emailUserSnap.empty) {
            userDocData = emailUserSnap.docs[0].data();
            // Re-key user document to actual UID if it was keyed differently
            await adminDb.collection("users").doc(uid).set(userDocData, { merge: true });
          }
        }
      } catch (err: any) {
        console.warn("[ResolveMembership] User doc fetch warning:", err.message);
      }
    }

    // 4. Check if Vivexa Tech Internal Team Member
    const vivexaRoles: UserRole[] = ["SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"];
    if (
      userDocData &&
      (userDocData.organization === "VIVEXA_TECH" ||
        vivexaRoles.includes(userDocData.role) ||
        normalizedEmail.endsWith("@vivexatech.in"))
    ) {
      const assignedRole: UserRole = userDocData.role || "ONBOARDING_EXECUTIVE";
      const isSuper = assignedRole === "SUPER_ADMIN";
      let needsRefresh = false;

      if (decodedToken.role !== assignedRole || decodedToken.organization !== "VIVEXA_TECH") {
        await adminAuth.setCustomUserClaims(uid, {
          role: assignedRole,
          organization: "VIVEXA_TECH",
          superAdmin: isSuper,
        });
        needsRefresh = true;
      }

      return NextResponse.json({
        success: true,
        role: assignedRole,
        isSuperAdmin: isSuper,
        isVivexaTeam: true,
        restaurantId: null,
        restaurantName: null,
        restaurantSlug: null,
        targetDashboard: "/super-admin",
        requiresTokenRefresh: needsRefresh,
      });
    }

    // 5. Fetch all restaurants to evaluate ownership and membership
    const allRestaurants: RestaurantProfile[] = await firestoreService.getRestaurants();
    allRestaurants.forEach((r) => dataStore.saveRestaurantLocally(r));

    // 5a. Direct Restaurant Ownership Check
    let matchingRestaurant = allRestaurants.find(
      (r) =>
        (r.ownerUid && r.ownerUid === uid) ||
        (r.ownerEmail && r.ownerEmail.toLowerCase() === normalizedEmail)
    );

    let assignedRole: UserRole | null = matchingRestaurant ? "RESTAURANT_OWNER" : null;

    // 5b. Restaurant Staff Membership Check (restaurantMemberships collection)
    if (!matchingRestaurant && adminDb) {
      try {
        // Query by uid or userId
        let membSnap = await adminDb
          .collection("restaurantMemberships")
          .where("uid", "==", uid)
          .where("status", "==", "ACTIVE")
          .limit(1)
          .get();

        if (membSnap.empty) {
          membSnap = await adminDb
            .collection("restaurantMemberships")
            .where("userId", "==", uid)
            .where("status", "==", "ACTIVE")
            .limit(1)
            .get();
        }

        // Query by email or userEmail if not found by UID
        if (membSnap.empty && normalizedEmail) {
          membSnap = await adminDb
            .collection("restaurantMemberships")
            .where("email", "==", normalizedEmail)
            .where("status", "==", "ACTIVE")
            .limit(1)
            .get();

          if (membSnap.empty) {
            membSnap = await adminDb
              .collection("restaurantMemberships")
              .where("userEmail", "==", normalizedEmail)
              .where("status", "==", "ACTIVE")
              .limit(1)
              .get();
          }

          if (!membSnap.empty) {
            // Link actual authenticated UID to membership
            await membSnap.docs[0].ref.update({
              uid,
              userId: uid,
              updatedAt: nowIso,
            });
          }
        }

        if (!membSnap.empty) {
          const membData = membSnap.docs[0].data() as RestaurantMembership;
          const r = allRestaurants.find((item) => item.id === membData.restaurantId);
          if (r) {
            matchingRestaurant = r;
            assignedRole = membData.role;
          }
        }
      } catch (err: any) {
        console.warn("[ResolveMembership] Error querying restaurantMemberships:", err.message);
      }
    }

    // 5c. Fallback: Check userDocData if it has restaurantId and restaurant role
    if (!matchingRestaurant && userDocData?.restaurantId) {
      const r = allRestaurants.find((item) => item.id === userDocData.restaurantId);
      if (r) {
        matchingRestaurant = r;
        assignedRole = userDocData.role || "KITCHEN_STAFF";
      }
    }

    // 5d. Fallback: Check restaurant staff subcollection
    if (!matchingRestaurant && adminDb) {
      for (const rest of allRestaurants) {
        try {
          const staffSnap = await adminDb
            .collection("restaurants")
            .doc(rest.id)
            .collection("staff")
            .doc(uid)
            .get();

          if (staffSnap.exists) {
            const staffData = staffSnap.data();
            if (staffData?.isActive !== false) {
              matchingRestaurant = rest;
              assignedRole = staffData?.role || "KITCHEN_STAFF";
              break;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // 6. If matching restaurant & role found, enforce sync, claims, and membership
    if (matchingRestaurant && assignedRole) {
      let claimsNeedUpdate = false;

      // Link ownerUid on restaurant if missing
      if (assignedRole === "RESTAURANT_OWNER" && matchingRestaurant.ownerUid !== uid) {
        matchingRestaurant.ownerUid = uid;
        matchingRestaurant.ownerEmail = normalizedEmail;
        matchingRestaurant.updatedAt = nowIso;
        dataStore.saveRestaurantLocally(matchingRestaurant);
        await firestoreService.saveRestaurant(matchingRestaurant);
      }

      // Check if claims match
      if (
        decodedToken.role !== assignedRole ||
        decodedToken.restaurantId !== matchingRestaurant.id
      ) {
        claimsNeedUpdate = true;
        await adminAuth.setCustomUserClaims(uid, {
          role: assignedRole,
          restaurantId: matchingRestaurant.id,
        });
      }

      // Ensure user record in Firestore 'users/{uid}'
      if (adminDb) {
        try {
          await adminDb.collection("users").doc(uid).set(
            {
              uid,
              email: normalizedEmail,
              displayName: name || matchingRestaurant.ownerName || normalizedEmail.split("@")[0],
              role: assignedRole,
              restaurantId: matchingRestaurant.id,
              isActive: true,
              updatedAt: nowIso,
            },
            { merge: true }
          );

          // Ensure membership record exists
          const membershipId = `memb_${uid}_${matchingRestaurant.id}`;
          await adminDb.collection("restaurantMemberships").doc(membershipId).set(
            {
              id: membershipId,
              restaurantId: matchingRestaurant.id,
              restaurantName: matchingRestaurant.name,
              restaurantSlug: matchingRestaurant.slug,
              uid,
              userId: uid,
              email: normalizedEmail,
              userEmail: normalizedEmail,
              role: assignedRole,
              status: "ACTIVE",
              updatedAt: nowIso,
            },
            { merge: true }
          );
        } catch (dbErr: any) {
          console.warn("[ResolveMembership] DB write warning:", dbErr.message);
        }
      }

      const targetDashboard =
        assignedRole === "KITCHEN_STAFF" || assignedRole === "ORDER_STAFF"
          ? "/staff"
          : "/dashboard";

      return NextResponse.json({
        success: true,
        hasMembership: true,
        role: assignedRole,
        restaurantId: matchingRestaurant.id,
        restaurantName: matchingRestaurant.name,
        restaurantSlug: matchingRestaurant.slug,
        targetDashboard,
        requiresTokenRefresh: claimsNeedUpdate,
      });
    }

    // 7. User has NO restaurant membership and is NOT Vivexa team
    return NextResponse.json({
      success: true,
      hasMembership: false,
      role: "CUSTOMER_GUEST",
      restaurantId: null,
      restaurantName: null,
      restaurantSlug: null,
      targetDashboard: "/",
      message: "No active restaurant membership or team assignment found for this account.",
      requiresTokenRefresh: false,
    });
  } catch (error: any) {
    console.error("[ResolveMembership] Internal error:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve membership" }, { status: 500 });
  }
}
