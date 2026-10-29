// ==============================================================================
// RESTROCHARGE - Offer Details, Update & Lifecycle API Route
// Authoritative update, status toggle, and safe deletion.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { RestaurantOffer, OfferStatus } from "@/lib/types";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";

interface Params {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    let offer = dataStore.getOfferById(id);

    if (!offer) {
      const { searchParams } = new URL(req.url);
      const restaurantId = searchParams.get("restaurantId");
      if (restaurantId) {
        const offers = await firestoreService.getOffers(restaurantId);
        offer = offers.find((o) => o.id === id) || null;
        if (offer) dataStore.saveOfferLocally(offer);
      }
    }

    if (!offer) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    return NextResponse.json({ offer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json();

    let existing = dataStore.getOfferById(id);
    if (!existing && body.restaurantId) {
      const dbOffers = await firestoreService.getOffers(body.restaurantId);
      existing = dbOffers.find((o) => o.id === id) || null;
    }

    if (!existing) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    const restaurantId = existing.restaurantId;
    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const updated: RestaurantOffer = {
      ...existing,
      ...body,
      id: existing.id,
      restaurantId: existing.restaurantId, // Prevent modifying tenant ownership
      updatedAt: new Date().toISOString(),
    };

    const saved = dataStore.saveOffer(updated);

    return NextResponse.json({ success: true, offer: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    let restaurantId = searchParams.get("restaurantId");

    let existing = dataStore.getOfferById(id);
    if (!existing && restaurantId) {
      const dbOffers = await firestoreService.getOffers(restaurantId);
      existing = dbOffers.find((o) => o.id === id) || null;
    }

    if (!existing) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    restaurantId = existing.restaurantId;
    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    // Safe deletion: delete from dataStore and firestore
    dataStore.deleteOffer(restaurantId, id);

    return NextResponse.json({ success: true, message: "Offer deleted successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
