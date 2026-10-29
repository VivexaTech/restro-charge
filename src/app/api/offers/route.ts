// ==============================================================================
// RESTROCHARGE - Offers & Discounts API Route
// GET: List restaurant offers (all for admin, active for public/QR)
// POST: Create new day-wise, category, event, or combo offer with authorization
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { isOfferActive } from "@/lib/services/offers-engine";
import { generateId } from "@/lib/utils";
import { RestaurantOffer, OfferType, DiscountMethod, OfferStatus, DayOfWeek } from "@/lib/types";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let restaurantId = searchParams.get("restaurantId");
    const activeOnly = searchParams.get("activeOnly") === "true";

    if (!restaurantId || !restaurantId.trim()) {
      const authUser = await verifyRestaurantAccess(req, "").catch(() => null);
      if (authUser?.user?.restaurantId) {
        restaurantId = authUser.user.restaurantId;
      } else if (authUser?.user?.isSuperAdmin) {
        const all = dataStore.getRestaurants();
        restaurantId = all[0]?.id;
      }
    }

    if (!restaurantId) {
      return NextResponse.json({ offers: [] });
    }

    // Retrieve from memory store, or fallback to Firestore
    let offers = dataStore.getOffers(restaurantId);
    if (offers.length === 0) {
      const dbOffers = await firestoreService.getOffers(restaurantId);
      if (dbOffers.length > 0) {
        dbOffers.forEach((o) => dataStore.saveOfferLocally(o));
        offers = dbOffers;
      }
    }

    if (activeOnly) {
      offers = offers.filter((o) => isOfferActive(o));
    }

    return NextResponse.json({ offers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      restaurantId,
      name,
      description,
      offerType,
      discountMethod = "PERCENTAGE",
      discountValue = 0,
      eligibleItemIds = [],
      eligibleCategoryIds = [],
      comboItems = [],
      comboPrice = 0,
      applicableDays,
      startDate,
      endDate,
      startTime,
      endTime,
      timezone = "Asia/Kolkata",
      priority = 1,
      status = "ACTIVE",
      imageUrl,
    } = body;

    if (!restaurantId || !restaurantId.trim()) {
      const authCheck = await verifyRestaurantAccess(req, "").catch(() => null);
      if (authCheck?.user?.restaurantId) {
        restaurantId = authCheck.user.restaurantId;
      } else if (authCheck?.user?.isSuperAdmin) {
        const all = dataStore.getRestaurants();
        restaurantId = all[0]?.id;
      }
    }

    if (!restaurantId || !name || !offerType) {
      return NextResponse.json(
        { error: "restaurantId, name, and offerType are required fields." },
        { status: 400 }
      );
    }

    // Authorize restaurant access
    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    // Validate type-specific requirements
    if (offerType === "COMBO") {
      if (!Array.isArray(comboItems) || comboItems.length === 0) {
        return NextResponse.json(
          { error: "Combo offers must include at least one menu item." },
          { status: 400 }
        );
      }
      if (Number(comboPrice) <= 0) {
        return NextResponse.json(
          { error: "Combo price must be greater than zero." },
          { status: 400 }
        );
      }
    } else {
      // Regular Item, Category, Day-wise or Event offer
      const hasItems = Array.isArray(eligibleItemIds) && eligibleItemIds.length > 0;
      const hasCategories = Array.isArray(eligibleCategoryIds) && eligibleCategoryIds.length > 0;

      if (!hasItems && !hasCategories) {
        return NextResponse.json(
          { error: "Offer must specify at least one eligible menu item or category." },
          { status: 400 }
        );
      }

      if (Number(discountValue) <= 0) {
        return NextResponse.json(
          { error: "Discount value must be greater than zero." },
          { status: 400 }
        );
      }

      if (discountMethod === "PERCENTAGE" && Number(discountValue) > 100) {
        return NextResponse.json(
          { error: "Percentage discount cannot exceed 100%." },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();
    const newOffer: RestaurantOffer = {
      id: generateId("ofr"),
      restaurantId,
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      offerType: offerType as OfferType,
      discountMethod: discountMethod as DiscountMethod,
      discountValue: Math.max(0, Number(discountValue) || 0),
      eligibleItemIds: Array.isArray(eligibleItemIds) ? eligibleItemIds : [],
      eligibleCategoryIds: Array.isArray(eligibleCategoryIds) ? eligibleCategoryIds : [],
      comboItems: offerType === "COMBO" && Array.isArray(comboItems) ? comboItems : undefined,
      comboPrice: offerType === "COMBO" ? Math.max(0, Number(comboPrice) || 0) : undefined,
      applicableDays: Array.isArray(applicableDays) ? (applicableDays as DayOfWeek[]) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      timezone: timezone || "Asia/Kolkata",
      priority: Math.max(1, Math.min(100, Number(priority) || 1)),
      status: (status as OfferStatus) || "ACTIVE",
      imageUrl: imageUrl || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const saved = dataStore.saveOffer(newOffer);

    return NextResponse.json({ success: true, offer: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
