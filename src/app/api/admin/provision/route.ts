// ==============================================================================
// RESTROCHARGE - Super Admin Role Provisioning Endpoint
// Provisions custom user claims and Firestore profile for designated Super Admin.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { SUPER_ADMIN_UID } from "@/lib/auth/server-auth";
import { dataStore } from "@/lib/services/data-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUid = body.targetUid || SUPER_ADMIN_UID;

    // Check Firebase Admin SDK readiness
    if (!isFirebaseAdminReady()) {
      return NextResponse.json(
        {
          success: false,
          error: "FIREBASE_ADMIN_NOT_CONFIGURED",
          message:
            "Firebase Admin SDK credentials are not configured or failed to initialize. Please configure valid FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
          targetUid,
        },
        { status: 503 }
      );
    }

    // 1. Verify user exists in Firebase Authentication
    try {
      const user = await adminAuth.getUser(targetUid);

      // 2. Set Firebase Custom Claims for Super Admin
      await adminAuth.setCustomUserClaims(targetUid, {
        role: "SUPER_ADMIN",
        superAdmin: true,
      });

      // 3. Update Firestore user document
      try {
        await adminDb.collection("users").doc(targetUid).set(
          {
            uid: targetUid,
            email: user.email || "admin@vivexatech.in",
            displayName: user.displayName || "Vivexa Tech Super Admin",
            role: "SUPER_ADMIN",
            isSuperAdmin: true,
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr: any) {
        console.warn("[Provision] Firestore user doc update skipped/failed:", dbErr.message);
      }

      // 4. Record audit log
      dataStore.addAuditLog({
        action: "PROVISION_SUPER_ADMIN",
        targetType: "USER",
        targetId: targetUid,
        performedBy: {
          uid: "system",
          email: "system@vivexatech.in",
          name: "Provisioning Service",
        },
        details: {
          targetUid,
          email: user.email,
          claims: { role: "SUPER_ADMIN", superAdmin: true },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Super Admin role securely provisioned for UID: ${targetUid}`,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          customClaims: { role: "SUPER_ADMIN", superAdmin: true },
        },
      });
    } catch (authErr: any) {
      if (authErr.code === "auth/user-not-found") {
        return NextResponse.json(
          {
            success: false,
            error: "USER_NOT_FOUND",
            message: `User with UID '${targetUid}' was not found in Firebase Authentication. Required action: The user must first register or be created in the Firebase console with this exact UID.`,
            targetUid,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "AUTH_VERIFICATION_ERROR",
          message: authErr.message || "Failed to verify user against Firebase Authentication.",
          targetUid,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Provision API Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
