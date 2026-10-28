// ==============================================================================
// RESTROCHARGE - Super Admin Manual Subscription Renewal
// Administrative action recorded with full audit trail.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { calculateNewSubscriptionDates } from "@/lib/services/subscription";
import { generateId } from "@/lib/utils";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const body = await req.json();
    const {
      restaurantId,
      planId,
      durationMonths = 1,
      reason,
      authorizedBy = "Vivexa Tech Super Admin",
    } = body;

    if (!restaurantId || !planId || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: restaurantId, planId, and reason are required." },
        { status: 400 }
      );
    }

    const restaurant = dataStore.getRestaurantById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const plan = dataStore.getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    const previousStatus = restaurant.subscription?.status || "UNKNOWN";
    const previousExpiry = restaurant.subscription?.expiryDate || "N/A";

    // Calculate dates
    const { startDate, expiryDate, gracePeriodEnd } = calculateNewSubscriptionDates(
      restaurant.subscription,
      Number(durationMonths)
    );

    restaurant.subscription = {
      planId: plan.id,
      planName: plan.name,
      status: "ACTIVE",
      billingCycle: Number(durationMonths) >= 12 ? "ANNUAL" : "MONTHLY",
      startDate,
      expiryDate,
      gracePeriodEnd,
      autoRenew: false,
      lastPaymentId: `manual_${generateId("adm")}`,
      updatedAt: new Date().toISOString(),
    };

    // Reactivate restaurant if previously inactive
    restaurant.published = true;
    if (restaurant.operationalSettings) {
      restaurant.operationalSettings.isAcceptingOrders = true;
    }

    dataStore.saveRestaurant(restaurant);

    // Record manual payment record
    dataStore.savePayment({
      id: generateId("pay"),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      planId: plan.id,
      planName: plan.name,
      amount: plan.monthlyPrice * durationMonths,
      currency: "INR",
      paymentType: "MANUAL",
      billingCycle: durationMonths >= 12 ? "ANNUAL" : "MONTHLY",
      status: "SUCCESS",
      manualReason: reason,
      authorizedBy,
      createdAt: new Date().toISOString(),
    });

    // Record audit log
    dataStore.addAuditLog({
      action: "MANUAL_SUBSCRIPTION_RENEWAL",
      targetType: "SUBSCRIPTION",
      targetId: restaurant.id,
      performedBy: {
        uid: "vivexa_admin",
        email: "admin@vivexatech.in",
        name: authorizedBy,
      },
      details: {
        previousStatus,
        previousExpiry,
        newStatus: "ACTIVE",
        newExpiry: expiryDate,
        gracePeriodEnd,
        durationMonths,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Restaurant subscription manually renewed by Vivexa Tech.",
      subscription: restaurant.subscription,
    });
  } catch (error: any) {
    console.error("[Manual Renewal Error]:", error);
    return NextResponse.json({ error: error.message || "Manual renewal failed" }, { status: 500 });
  }
}
