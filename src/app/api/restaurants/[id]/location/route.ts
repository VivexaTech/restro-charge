// ==============================================================================
// RESTROCHARGE - Restaurant Location & Ordering Security API Route
// Strictly restricted to authorized Vivexa Tech team members.
// Restaurant owners and staff cannot alter verified coordinates or ordering radius.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";
import { isValidCoordinate, isValidRadius } from "@/lib/services/geo";
import { generateId } from "@/lib/utils";
import { RestaurantLocationSettings, AdminAuditLog } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const restaurant = dataStore.getRestaurantById(id);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    return NextResponse.json({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      locationSettings: restaurant.locationSettings || {
        latitude: null,
        longitude: null,
        orderingRadiusMetres: 100,
        locationRestrictionEnabled: false,
        isConfigured: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 1. Enforce Vivexa Tech Super Admin permission
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return (
        authCheck.errorResponse ||
        NextResponse.json(
          {
            error: "Unauthorized",
            details:
              "Only authorized Vivexa Tech team members can configure restaurant location & ordering radius.",
          },
          { status: 403 }
        )
      );
    }

    // 2. Fetch existing restaurant
    const restaurant = dataStore.getRestaurantById(id);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    // 3. Parse and validate payload
    const body = await req.json();
    const {
      latitude,
      longitude,
      orderingRadiusMetres,
      locationRestrictionEnabled,
      addressSnapshot,
    } = body;

    const radius = Number(orderingRadiusMetres);
    if (!isValidRadius(radius)) {
      return NextResponse.json(
        {
          error: "Invalid ordering radius. Radius must be between 10 and 50,000 metres.",
        },
        { status: 400 }
      );
    }

    const restrictionEnabled = Boolean(locationRestrictionEnabled);

    let lat: number | null = null;
    let lon: number | null = null;
    let isConfigured = false;

    if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
      lat = Number(latitude);
      lon = Number(longitude);

      if (!isValidCoordinate(lat, lon)) {
        return NextResponse.json(
          {
            error:
              "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.",
          },
          { status: 400 }
        );
      }
      isConfigured = true;
    } else if (restrictionEnabled) {
      return NextResponse.json(
        {
          error:
            "Cannot enable location-restricted ordering without configuring valid latitude and longitude coordinates.",
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const updaterUid = authCheck.user?.uid || "GDF2eldrzSNR9oltgezCr9MXt0I3";
    const updaterEmail = authCheck.user?.email || "admin@vivexatech.in";

    const updatedLocationSettings: RestaurantLocationSettings = {
      latitude: lat,
      longitude: lon,
      orderingRadiusMetres: radius,
      locationRestrictionEnabled: restrictionEnabled,
      isConfigured,
      addressSnapshot: addressSnapshot || restaurant.address,
      updatedAt: nowIso,
      updatedBy: updaterUid,
      updatedByName: updaterEmail,
    };

    // 4. Update restaurant record
    const updatedRestaurant = dataStore.saveRestaurant({
      ...restaurant,
      locationSettings: updatedLocationSettings,
      updatedAt: nowIso,
    });

    // 5. Write audit log
    const auditLog: AdminAuditLog = {
      id: generateId("log"),
      action: "UPDATE_LOCATION_SETTINGS",
      targetType: "RESTAURANT",
      targetId: restaurant.id,
      performedBy: {
        uid: updaterUid,
        email: updaterEmail,
        name: "Vivexa Tech Operations",
      },
      details: {
        restaurantSlug: restaurant.slug,
        previousSettings: restaurant.locationSettings || null,
        newSettings: updatedLocationSettings,
      },
      timestamp: nowIso,
    };
    dataStore.addAuditLog(auditLog);

    return NextResponse.json({
      success: true,
      message: "Restaurant location & ordering security updated successfully.",
      locationSettings: updatedRestaurant.locationSettings,
    });
  } catch (err: any) {
    console.error("[Restaurant Location API Error]:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
