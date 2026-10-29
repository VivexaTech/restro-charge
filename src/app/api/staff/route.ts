// ==============================================================================
// RESTROCHARGE - Restaurant Staff Management API Route
// GET /api/staff?restaurantId=... - Lists staff from Cloud Firestore
// POST /api/staff - Securely provisions new staff account via Firebase Admin SDK
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { provisionRestaurantStaff, getRestaurantStaffList } from "@/lib/services/staff-provisioning";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let restaurantId = searchParams.get("restaurantId");

    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isSuper = user.isSuperAdmin || user.role === "SUPER_ADMIN" || user.email === "admin@vivexatech.in";

    // Fallback for missing/empty restaurantId
    if (!restaurantId || !restaurantId.trim()) {
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

    if (!restaurantId) {
      return NextResponse.json({ success: true, staff: [] });
    }

    // 2. Authorize: Must be Super Admin or member of this restaurant
    const isMember = user.restaurantId === restaurantId;
    if (!isSuper && !isMember) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to view staff for this restaurant." },
        { status: 403 }
      );
    }

    // 3. Fetch authoritative staff list from Cloud Firestore
    const staff = await getRestaurantStaffList(restaurantId);
    return NextResponse.json({ success: true, staff });
  } catch (err: any) {
    console.error("[Staff API GET error]:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch staff list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isSuper = user.isSuperAdmin || user.role === "SUPER_ADMIN" || user.email === "admin@vivexatech.in";

    const body = await req.json();
    let { restaurantId, name, email, role, password } = body;

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

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId is required. Please select or create a restaurant venue first." },
        { status: 400 }
      );
    }

    // 2. Authorize creator: Must be Super Admin or Restaurant Owner/Manager of target restaurant
    const isOwnerOrManager =
      user.restaurantId === restaurantId &&
      (user.role === "RESTAURANT_OWNER" || user.role === "RESTAURANT_MANAGER");

    if (!isSuper && !isOwnerOrManager) {
      return NextResponse.json(
        { error: "Access denied. Only Restaurant Owners or Super Admins can add staff members." },
        { status: 403 }
      );
    }

    // 3. Validate inputs
    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Staff full name is required (minimum 2 characters)." }, { status: 400 });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const validRoles = ["RESTAURANT_MANAGER", "ORDER_STAFF", "KITCHEN_STAFF"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role '${role}'. Role must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    // 4. Execute provisioning
    const result = await provisionRestaurantStaff({
      restaurantId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      temporaryPassword: password,
      performedBy: {
        uid: user.uid,
        email: user.email || "admin@restrocharge.in",
        name: user.email?.split("@")[0] || "Administrator",
      },
    });

    if (!result.success) {
      const statusCode = result.status === "PARTIAL_FAILURE" ? 502 : 400;
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.message,
          errorCode: result.errorCode,
          uid: result.uid,
          actionTaken: result.actionTaken,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        actionTaken: result.actionTaken,
        message: result.message,
        staff: result.staff,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[Staff API POST error]:", err);
    return NextResponse.json({ error: err.message || "Failed to create staff account" }, { status: 500 });
  }
}
