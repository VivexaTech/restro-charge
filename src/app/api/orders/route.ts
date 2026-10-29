// ==============================================================================
// RESTROCHARGE - Secure Order Placement Route Handler
// Validates table association, live prices from DB, calculates bill on backend.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { calculateOrderBill } from "@/lib/services/billing";
import { diningSessionService } from "@/lib/services/dining-session-service";
import { getSubscriptionAccess } from "@/lib/services/subscription";
import { verifyCustomerProximity } from "@/lib/services/geo";
import { generateId, generateOrderNumber } from "@/lib/utils";
import { OrderItem, OrderItemSnapshot, ProductItem, ProductPortion } from "@/lib/types";
import { verifyRestaurantAccess, verifySuperAdminPermission } from "@/lib/auth/server-auth";
import {
  resolveBestOfferForItem,
  validateAndEvaluateCombo,
  getZonedDateInfo,
  validateOfferEligibility,
} from "@/lib/services/offers-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantSlug,
      tableCode,
      items,
      customerNotes,
      customerLocation,
      sessionToken,
      idempotencyKey,
    } = body;

    if (!restaurantSlug || !tableCode || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid order payload. Missing restaurant, table, or items." },
        { status: 400 }
      );
    }

    // 1. Resolve restaurant (check memory store & Cloud Firestore)
    let restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
    if (!restaurant) {
      restaurant = await firestoreService.getRestaurantBySlug(restaurantSlug);
      if (restaurant) {
        dataStore.saveRestaurantLocally(restaurant);
      }
    }
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found." },
        { status: 404 }
      );
    }

    // 2. Validate subscription access & 3-day grace period rule
    const subAccess = getSubscriptionAccess(restaurant.subscription);
    if (!subAccess.canOrder) {
      return NextResponse.json(
        {
          error: "Online QR ordering is currently disabled for this restaurant.",
          details: subAccess.message,
        },
        { status: 403 }
      );
    }

    // 3. Validate Restaurant Location & Ordering Proximity (CRITICAL GEOLOCATION SECURITY)
    const isSimulated = Boolean(customerLocation?.isSimulated);
    const isProduction = process.env.NODE_ENV === "production";

    // Strict Production Enforcement: Simulated coordinates CAN NEVER authorize orders in production
    if (isProduction && isSimulated) {
      return NextResponse.json(
        {
          error: "Simulated coordinates are strictly forbidden in production. Physical GPS presence is required.",
          reasonCode: "SIMULATION_FORBIDDEN_IN_PRODUCTION",
          details: "Location simulation is strictly restricted to local development environments.",
        },
        { status: 403 }
      );
    }

    const proximity = verifyCustomerProximity({
      customerLat: customerLocation?.latitude,
      customerLon: customerLocation?.longitude,
      customerAccuracy: customerLocation?.accuracy,
      locationSettings: restaurant.locationSettings,
    });

    if (!proximity.allowed) {
      return NextResponse.json(
        {
          error: proximity.message,
          reasonCode: proximity.reasonCode,
          distanceMetres: proximity.distanceMetres,
          configuredRadiusMetres: proximity.configuredRadiusMetres,
          accuracyMetres: proximity.accuracyMetres,
          details: "Location verification failed. Orders are restricted to verified diners at the restaurant.",
        },
        { status: 403 }
      );
    }

    // 4. Validate operational status
    if (!restaurant.operationalSettings?.isAcceptingOrders) {
      return NextResponse.json(
        { error: "This restaurant is currently not accepting new orders. Please contact staff directly." },
        { status: 400 }
      );
    }

    // 5. Validate Table and ensure it belongs to this restaurant
    const table = dataStore.getTableByCode(restaurant.id, tableCode);
    if (!table || !table.isActive) {
      return NextResponse.json(
        { error: "Invalid or inactive table QR. Please scan a valid table QR code." },
        { status: 400 }
      );
    }

    // 6. Fetch trusted live product prices and active offers from database (NEVER trust client submitted prices)
    let offers = dataStore.getOffers(restaurant.id);
    if (offers.length === 0) {
      const dbOffers = await firestoreService.getOffers(restaurant.id);
      if (dbOffers.length > 0) {
        dbOffers.forEach((o) => dataStore.saveOfferLocally(o));
        offers = dbOffers;
      }
    }

    const timezone = restaurant.locationSettings?.timezone || "Asia/Kolkata";
    const dateInfo = getZonedDateInfo(new Date(), timezone);
    let restaurantProducts = dataStore.getProducts(restaurant.id);
    if (restaurantProducts.length === 0) {
      restaurantProducts = await firestoreService.getProducts(restaurant.id);
      restaurantProducts.forEach((p) => dataStore.saveProduct(p));
    }
    let categories = dataStore.getCategories(restaurant.id);
    if (categories.length === 0) {
      categories = await firestoreService.getCategories(restaurant.id);
      categories.forEach((c) => dataStore.saveCategory(c));
    }

    const dineInContext = {
      orderType: "dine_in" as const,
      tableCode,
      timeZone: timezone,
      refDate: new Date(),
    };

    const validSnapshots: OrderItemSnapshot[] = [];
    for (const item of items) {
      const quantity = Math.max(1, Math.min(25, Math.floor(item.quantity || 1)));

      // 1. REJECT GENERIC OFFER PLACEHOLDERS (Must select specific dish)
      if (
        (item.productId && item.productId.startsWith("prod_pj_offer_")) ||
        item.name?.toLowerCase().includes("special deal - any") ||
        item.name?.toLowerCase().includes("special deal — any")
      ) {
        return NextResponse.json(
          {
            error: "Special offers require choosing a specific dish from the menu. Please select your desired item.",
            code: "OFFER_ITEM_SELECTION_REQUIRED",
          },
          { status: 400 }
        );
      }

      // Check if this is a Combo Item
      if (item.isCombo) {
        const comboOffer = offers.find((o) => o.id === item.productId && o.offerType === "COMBO") ||
          dataStore.getOfferById(item.productId);

        if (!comboOffer || comboOffer.restaurantId !== restaurant.id || comboOffer.offerType !== "COMBO") {
          return NextResponse.json(
            { error: `Combo offer '${item.name || item.productId}' is not available at this restaurant.` },
            { status: 400 }
          );
        }

        const comboEval = validateAndEvaluateCombo(comboOffer, restaurantProducts, dateInfo, timezone);
        if (!comboEval.isValid) {
          return NextResponse.json(
            { error: comboEval.error || `Combo '${comboOffer.name}' is currently unavailable.` },
            { status: 400 }
          );
        }

        const isAllVeg = comboEval.comboItemsSnapshot.every((ci) => {
          const p = restaurantProducts.find((rp) => rp.id === ci.productId);
          return p ? p.isVeg : true;
        });

        validSnapshots.push({
          productId: comboOffer.id,
          name: comboOffer.name,
          price: comboEval.comboPrice,
          regularPrice: comboEval.regularTotal,
          discountAmount: comboEval.discountAmount,
          quantity,
          isVeg: isAllVeg,
          dietaryType: isAllVeg ? "veg" : "non_veg",
          isCombo: true,
          comboItemsSnapshot: comboEval.comboItemsSnapshot,
          appliedOfferId: comboOffer.id,
          appliedOfferName: comboOffer.name,
          appliedOfferType: "COMBO",
          lineTotal: Math.round(comboEval.comboPrice * quantity * 100) / 100,
        });
        continue;
      }

      // Regular Menu Item
      let dbProduct: ProductItem | null | undefined = dataStore.getProductById(item.productId);
      if (!dbProduct) {
        dbProduct = restaurantProducts.find((p) => p.id === item.productId) || null;
        if (dbProduct) dataStore.saveProduct(dbProduct);
      }
      if (!dbProduct || dbProduct.restaurantId !== restaurant.id) {
        return NextResponse.json(
          { error: `Product '${item.name || item.productId}' is not available at this restaurant.` },
          { status: 400 }
        );
      }

      // Block placeholder category items as direct products
      if (dbProduct.categoryId === "cat_pj_special_offers") {
        return NextResponse.json(
          {
            error: "Special offers require selecting an eligible item from the menu. Please choose a specific dish.",
            code: "OFFER_ITEM_SELECTION_REQUIRED",
          },
          { status: 400 }
        );
      }

      if (!dbProduct.isAvailable) {
        return NextResponse.json(
          { error: `Item '${dbProduct.name}' is currently out of stock.` },
          { status: 400 }
        );
      }

      // Portion-based price determination
      let selectedPortion: any = undefined;
      let portionId = item.portionId;
      let portionName = item.portionName;
      let displayName = dbProduct.name;

      if (portionId && dbProduct.portions && dbProduct.portions.length > 0) {
        const foundPortion = dbProduct.portions.find((p: ProductPortion) => p.id === portionId);
        if (!foundPortion) {
          return NextResponse.json(
            { error: `Portion '${portionId}' is not valid for '${dbProduct.name}'.` },
            { status: 400 }
          );
        }
        if (!foundPortion.isAvailable) {
          return NextResponse.json(
            { error: `Portion '${foundPortion.name}' of '${dbProduct.name}' is out of stock.` },
            { status: 400 }
          );
        }
        selectedPortion = foundPortion;
        portionName = foundPortion.name;
        displayName = `${dbProduct.name} (${foundPortion.name})`;
      } else if (dbProduct.portions && dbProduct.portions.length > 0) {
        const defaultPortion = dbProduct.portions.find((p: ProductPortion) => p.isAvailable) || dbProduct.portions[0];
        selectedPortion = defaultPortion;
        portionId = defaultPortion.id;
        portionName = defaultPortion.name;
        displayName = `${dbProduct.name} (${defaultPortion.name})`;
      }

      // Authoritative pricing: validate explicit offer or evaluate active offers & discounts
      let effectivePrice = selectedPortion ? selectedPortion.price : dbProduct.price;
      let regularPrice = effectivePrice;
      let discountAmount = 0;
      let appliedOfferId: string | undefined = undefined;
      let appliedOfferName: string | undefined = undefined;
      let appliedOfferType: any = undefined;

      if (item.appliedOfferId) {
        // Customer submitted an order line claiming a specific promotional offer
        const explicitOffer =
          offers.find((o) => o.id === item.appliedOfferId) ||
          dataStore.getOfferById(item.appliedOfferId);

        if (!explicitOffer) {
          return NextResponse.json(
            {
              error: `The special offer is no longer available. Please remove it from your cart.`,
              code: "OFFER_NOT_FOUND",
              offerId: item.appliedOfferId,
            },
            { status: 400 }
          );
        }

        const offerValidation = validateOfferEligibility(
          explicitOffer,
          dbProduct,
          selectedPortion,
          restaurant.id,
          dineInContext
        );

        if (!offerValidation.isEligible) {
          return NextResponse.json(
            {
              error: offerValidation.reason || `Offer '${explicitOffer.name}' cannot be applied.`,
              code: "OFFER_INELIGIBLE",
              offerId: explicitOffer.id,
              offerName: explicitOffer.name,
            },
            { status: 400 }
          );
        }

        effectivePrice = offerValidation.effectivePrice!;
        regularPrice = offerValidation.regularPrice!;
        discountAmount = offerValidation.discountAmount!;
        appliedOfferId = explicitOffer.id;
        appliedOfferName = explicitOffer.name;
        appliedOfferType = explicitOffer.offerType;
      } else {
        // Automatic best offer evaluation
        const offerPricing = resolveBestOfferForItem(
          dbProduct,
          selectedPortion,
          offers,
          dateInfo,
          timezone,
          dineInContext
        );

        effectivePrice = offerPricing.effectivePrice;
        regularPrice = offerPricing.regularPrice;
        discountAmount = offerPricing.discountAmount;
        appliedOfferId = offerPricing.appliedOffer?.id;
        appliedOfferName = offerPricing.appliedOffer?.name;
        appliedOfferType = offerPricing.appliedOffer?.offerType;
      }

      const category = categories.find((c) => c.id === dbProduct.categoryId);

      validSnapshots.push({
        productId: dbProduct.id,
        name: displayName,
        price: effectivePrice,
        regularPrice,
        discountAmount,
        quantity,
        isVeg: dbProduct.isVeg,
        dietaryType: dbProduct.dietaryType,
        portionId,
        portionName,
        categoryName: category?.name,
        appliedOfferId,
        appliedOfferName,
        appliedOfferType,
        lineTotal: Math.round(effectivePrice * quantity * 100) / 100,
      });
    }

    // 6. Calculate billing breakdown on backend
    const billingBreakdown = calculateOrderBill(validSnapshots, restaurant.billingConfig);

    // 7. Resolve or initiate Customer Dining Session
    const sessionResult = await diningSessionService.getOrCreateSession({
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      tableId: table.id,
      tableCode: table.code || tableCode,
      sessionToken,
      customerLocation,
      locationSettings: restaurant.locationSettings,
      billingConfig: restaurant.billingConfig,
    });

    // 8. Create safe Order entity linked to Dining Session
    const orderId = generateId("ord");
    const orderNumber = generateOrderNumber();
    const nowIso = new Date().toISOString();

    const order: OrderItem = {
      id: orderId,
      orderNumber,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      tableId: table.id,
      tableLabel: table.displayLabel,
      diningSessionId: sessionResult.session.id,
      idempotencyKey,
      items: validSnapshots,
      billing: billingBreakdown,
      status: "NEW",
      statusHistory: [
        {
          status: "NEW",
          timestamp: nowIso,
          updatedBy: isSimulated ? "Customer QR (Dev Test Mode)" : "Customer QR",
          note: isSimulated
            ? "Order verified via Development Location Simulator."
            : "Order submitted via customer QR menu.",
        },
      ],
      customerNotes: typeof customerNotes === "string" ? customerNotes.trim().slice(0, 300) : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 9. Save order & notify staff in real-time
    dataStore.saveOrder(order);

    // 10. Atomically append order to Dining Session and update combined bill
    const updatedSession = await diningSessionService.appendOrderToSession({
      restaurant,
      session: sessionResult.session,
      order,
      idempotencyKey,
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.tableLabel,
        billing: order.billing,
        status: order.status,
        createdAt: order.createdAt,
        diningSession: {
          id: updatedSession.id,
          sessionToken: updatedSession.sessionToken,
          billing: updatedSession.billing,
          items: updatedSession.items,
          ordersSummary: updatedSession.ordersSummary,
          departureTriggered: sessionResult.departureTriggered,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Order API Error]:", error);
    return NextResponse.json(
      { error: "Internal server error while placing order." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId") || undefined;
    const orderId = searchParams.get("orderId") || undefined;

    // 1. Single order lookup (e.g. customer checking status by orderId)
    if (orderId) {
      let order = dataStore.getOrderById(orderId);
      if (!order && restaurantId) {
        try {
          const fromDb = await firestoreService.getOrders(restaurantId);
          order = fromDb.find((o) => o.id === orderId) || null;
        } catch {}
      }
      if (order) {
        return NextResponse.json({ orders: [order] });
      }
      return NextResponse.json({ orders: [] });
    }

    // 2. Tenant restaurant order list (Requires verified staff/owner membership or Super Admin)
    if (restaurantId) {
      const authCheck = await verifyRestaurantAccess(req, restaurantId);
      if (!authCheck.authorized) {
        return authCheck.errorResponse!;
      }

      let orders: OrderItem[] = [];
      try {
        const fromDb = await firestoreService.getOrders(restaurantId);
        if (fromDb && fromDb.length > 0) {
          fromDb.forEach((o) => dataStore.saveOrder(o));
          orders = fromDb;
        }
      } catch (e: any) {
        console.warn("[Orders API] Firestore getOrders warning:", e.message);
      }

      if (orders.length === 0) {
        orders = dataStore.getOrders(restaurantId);
      }

      return NextResponse.json({ orders });
    }

    // 3. Platform-wide order list (Super Admin only)
    const superCheck = await verifySuperAdminPermission(req);
    if (!superCheck.authorized) {
      return superCheck.errorResponse!;
    }

    const allOrders = dataStore.getOrders();
    return NextResponse.json({ orders: allOrders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
