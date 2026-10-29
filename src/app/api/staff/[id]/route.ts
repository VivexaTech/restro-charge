// ==============================================================================
// RESTROCHARGE - Restaurant Staff Item API Route
// PATCH /api/staff/[id] - Updates staff active status or details in Firestore
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { updateStaffStatus } from "@/lib/services/staff-provisioning";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: staffUid } = params;
    const body = await req.json();
    let { restaurantId, isActive } = body;

    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isSuper = user.isSuperAdmin || user.role === "SUPER_ADMIN" || user.email === "admin@vivexatech.in";

    // Fallback for missing or blank restaurantId
    if (!restaurantId || typeof restaurantId !== "string" || !restaurantId.trim()) {
      if (user.restaurantId) {
        restaurantId = user.restaurantId;
      } else if (isSuper) {
        const all = dataStore.getRestaurants();
        if (all.length > 0) {
          restaurantId = all[0].id;
        } else {
          try {
            const dbR = await firestoreService.getRestaurants();
            if (dbR && dbR.length > 0) restaurantId = dbR[0].id;
          } catch {}
        }
      }
    }

    if (!restaurantId || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "restaurantId and boolean isActive are required." },
        { status: 400 }
      );
    }

    // 2. Authorize: Super Admin or Restaurant Owner
    const isOwner =
      user.restaurantId === restaurantId &&
      (user.role === "RESTAURANT_OWNER" || user.role === "RESTAURANT_MANAGER");

    if (!isSuper && !isOwner) {
      return NextResponse.json(
        { error: "Access denied. Action restricted to Restaurant Administrators." },
        { status: 403 }
      );
    }

    // 3. Update status in Firestore
    const success = await updateStaffStatus(restaurantId, staffUid, isActive);
    if (!success) {
      return NextResponse.json({ error: "Failed to update staff status in database." }, { status: 500 });
    }

    return NextResponse.json({ success: true, isActive });
  } catch (err: any) {
    console.error("[Staff PATCH error]:", err);
    return NextResponse.json({ error: err.message || "Failed to update staff" }, { status: 500 });
  }
}
