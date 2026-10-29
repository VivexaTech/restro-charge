// ==============================================================================
// RESTROCHARGE - Dining Sessions API Route Handler
// Provides authoritative combined bills and dining session status.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { diningSessionService } from "@/lib/services/dining-session-service";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const restaurantId = searchParams.get("restaurantId");
    const restaurantSlug = searchParams.get("restaurantSlug");
    const tableCode = searchParams.get("tableCode");
    const sessionToken = searchParams.get("sessionToken");

    // Mode 1: Lookup by direct ID
    if (sessionId && restaurantId) {
      const session = await diningSessionService.getSessionById(restaurantId, sessionId);
      if (!session) {
        return NextResponse.json({ error: "Dining session not found." }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    // Mode 2: Resolve by slug, table, and optional sessionToken
    if (restaurantSlug && tableCode) {
      let restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
      if (!restaurant) {
        restaurant = await firestoreService.getRestaurantBySlug(restaurantSlug);
      }
      if (!restaurant) {
        return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
      }

      const table = dataStore.getTableByCode(restaurant.id, tableCode);
      const tableId = table?.id || tableCode;

      const result = await diningSessionService.getOrCreateSession({
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        tableId,
        tableCode,
        sessionToken,
        locationSettings: restaurant.locationSettings,
        billingConfig: restaurant.billingConfig,
      });

      return NextResponse.json({
        session: result.session,
        isNew: result.isNew,
        departureTriggered: result.departureTriggered,
        message: result.message,
      });
    }

    return NextResponse.json(
      { error: "Provide either (restaurantId, sessionId) or (restaurantSlug, tableCode)." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, restaurantId, sessionId, reason } = body;

    if (action === "CLOSE") {
      if (!restaurantId || !sessionId) {
        return NextResponse.json({ error: "restaurantId and sessionId are required to close session." }, { status: 400 });
      }

      const closed = await diningSessionService.closeSession(restaurantId, sessionId, reason || "MANUAL_STAFF_CLOSE");
      if (!closed) {
        return NextResponse.json({ error: "Session not found or already closed." }, { status: 404 });
      }

      return NextResponse.json({ success: true, session: closed });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
