// ==============================================================================
// RESTROCHARGE - Secure Order Placement Route Handler
// Validates table association, live prices from DB, calculates bill on backend.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { calculateOrderBill } from "@/lib/services/billing";
import { getSubscriptionAccess } from "@/lib/services/subscription";
import { verifyCustomerProximity } from "@/lib/services/geo";
import { generateId, generateOrderNumber } from "@/lib/utils";
import { OrderItem, OrderItemSnapshot } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantSlug, tableCode, items, customerNotes, customerLocation } = body;

    if (!restaurantSlug || !tableCode || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid order payload. Missing restaurant, table, or items." },
        { status: 400 }
      );
    }

    // 1. Resolve restaurant
    const restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
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

    // 6. Fetch trusted live product prices from database (NEVER trust client submitted prices)
    const validSnapshots: OrderItemSnapshot[] = [];
    for (const item of items) {
      const dbProduct = dataStore.getProductById(item.productId);
      if (!dbProduct || dbProduct.restaurantId !== restaurant.id) {
        return NextResponse.json(
          { error: `Product '${item.name || item.productId}' is not available at this restaurant.` },
          { status: 400 }
        );
      }

      if (!dbProduct.isAvailable) {
        return NextResponse.json(
          { error: `Item '${dbProduct.name}' is currently out of stock.` },
          { status: 400 }
        );
      }

      const quantity = Math.max(1, Math.min(25, Math.floor(item.quantity || 1)));

      // Portion-based price determination
      let unitPrice = dbProduct.price;
      let portionId = item.portionId;
      let portionName = item.portionName;
      let displayName = dbProduct.name;

      if (portionId && dbProduct.portions && dbProduct.portions.length > 0) {
        const foundPortion = dbProduct.portions.find((p) => p.id === portionId);
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
        unitPrice = foundPortion.price;
        portionName = foundPortion.name;
        displayName = `${dbProduct.name} (${foundPortion.name})`;
      } else if (dbProduct.portions && dbProduct.portions.length > 0) {
        // Default to first available portion if client didn't specify portion
        const defaultPortion = dbProduct.portions.find((p) => p.isAvailable) || dbProduct.portions[0];
        unitPrice = defaultPortion.price;
        portionId = defaultPortion.id;
        portionName = defaultPortion.name;
        displayName = `${dbProduct.name} (${defaultPortion.name})`;
      }

      validSnapshots.push({
        productId: dbProduct.id,
        name: displayName,
        price: unitPrice, // Trusted authoritative DB portion price
        quantity,
        isVeg: dbProduct.isVeg,
        dietaryType: dbProduct.dietaryType,
        portionId,
        portionName,
      });
    }

    // 6. Calculate billing breakdown on backend
    const billingBreakdown = calculateOrderBill(validSnapshots, restaurant.billingConfig);

    // 7. Create safe Order entity
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

    // 8. Save order & notify staff in real-time
    dataStore.saveOrder(order);

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.tableLabel,
        billing: order.billing,
        status: order.status,
        createdAt: order.createdAt,
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
    const orders = dataStore.getOrders(restaurantId);
    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
