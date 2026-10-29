// ==============================================================================
// RESTROCHARGE - Restaurant Admin Account Retry / Provisioning Route
// POST /api/restaurants/[id]/provision-admin
// Exclusively accessible by Vivexa Tech Super Admin.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";
import { provisionRestaurantAdmin } from "@/lib/services/admin-provisioning";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authorize Super Admin
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Restaurant ID is required in route parameters." },
        { status: 400 }
      );
    }

    // 2. Fetch existing restaurant
    let restaurant = dataStore.getRestaurantById(id);
    if (!restaurant) {
      restaurant = await firestoreService.getRestaurantById(id);
    }

    if (!restaurant) {
      return NextResponse.json(
        {
          error: `Restaurant '${id}' does not exist. Cannot provision an admin account for a non-existent restaurant.`,
        },
        { status: 404 }
      );
    }

    // 3. Parse optional overrides from request body
    const body = await req.json().catch(() => ({}));
    const targetEmail = body.adminEmail?.trim() || restaurant.ownerEmail;
    const targetName = body.adminName?.trim() || restaurant.ownerName;
    const temporaryPassword = body.password?.trim() || undefined;

    if (!targetEmail || !/^\S+@\S+\.\S+$/.test(targetEmail)) {
      return NextResponse.json(
        { error: "A valid email address is required to provision the restaurant admin." },
        { status: 400 }
      );
    }

    // 4. Execute safe provisioning / recovery
    const result = await provisionRestaurantAdmin({
      restaurantId: id,
      adminEmail: targetEmail,
      adminName: targetName,
      temporaryPassword,
      performedBy: {
        uid: authCheck.user?.uid || "super-admin",
        email: authCheck.user?.email || "admin@vivexatech.in",
        name: "Vivexa Tech Super Admin",
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          message: result.message,
          restaurant: result.restaurant,
          adminProvisioning: {
            status: result.status,
            actionTaken: result.actionTaken,
            email: result.email,
            message: result.message,
          },
        },
        { status: result.errorCode === "FIREBASE_ADMIN_NOT_READY" ? 503 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      restaurant: result.restaurant,
      adminProvisioning: {
        status: result.status,
        actionTaken: result.actionTaken,
        uid: result.uid,
        email: result.email,
        message: result.message,
        resetLink: result.resetLink,
      },
    });
  } catch (err: any) {
    console.error("[Provision Admin API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to provision restaurant admin account" },
      { status: 500 }
    );
  }
}
