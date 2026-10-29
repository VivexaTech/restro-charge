// ==============================================================================
// RESTROCHARGE - Restaurant Profile by ID API Route
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    let restaurant = dataStore.getRestaurantById(id);

    // If not in local dataStore cache, query Cloud Firestore authoritatively
    if (!restaurant) {
      restaurant = await firestoreService.getRestaurantById(id);
      if (restaurant) {
        dataStore.saveRestaurantLocally(restaurant);
      }
    }

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }
    return NextResponse.json({ restaurant });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    let existing = dataStore.getRestaurantById(id);
    if (!existing) {
      existing = await firestoreService.getRestaurantById(id);
    }

    if (!existing) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    // Protect locationSettings from non-admin modification
    if (body.locationSettings !== undefined) {
      const auth = await verifySuperAdminPermission(req);
      if (!auth.authorized) {
        delete body.locationSettings;
      }
    }

    const updated = dataStore.saveRestaurant({
      ...existing,
      ...body,
      id: existing.id, // prevent overwriting ID
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, restaurant: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
