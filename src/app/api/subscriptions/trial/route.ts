// ==============================================================================
// RESTROCHARGE - Super Admin Free Trial Management API
// Dedicated endpoint for granting, extending, and auditing free trials.
// Only authorized Vivexa Tech Super Admin can grant trials.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse || NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { restaurantId, trialDays = 7, reason = "Promotional Onboarding Trial", planId = "plan_pro" } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant ID is required." }, { status: 400 });
    }

    const days = Math.max(1, Math.min(90, Number(trialDays) || 7));
    const restaurant = dataStore.getRestaurantById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const plan = dataStore.getPlanById(planId) || dataStore.getPlans()[0];
    const now = new Date();
    const trialStartDate = now.toISOString();
    const trialEndDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const gracePeriodEnd = new Date(now.getTime() + (days + 3) * 24 * 60 * 60 * 1000).toISOString();

    const previousStatus = restaurant.subscription?.status;

    restaurant.subscription = {
      planId: plan ? plan.id : "plan_pro",
      planName: plan ? plan.name : "Growth & KDS Pro",
      status: "TRIAL",
      billingCycle: "MONTHLY",
      startDate: trialStartDate,
      expiryDate: trialEndDate,
      gracePeriodEnd,
      autoRenew: false,
      updatedAt: trialStartDate,
      trialStartDate,
      trialEndDate,
      isTrial: true,
      trialDays: days,
      grantedBy: authCheck.user?.email || "admin@vivexatech.in",
    };

    // Ensure restaurant can accept orders during trial
    restaurant.published = true;
    if (restaurant.operationalSettings) {
      restaurant.operationalSettings.isAcceptingOrders = true;
    }

    dataStore.saveRestaurant(restaurant);

    // Audit log
    dataStore.addAuditLog({
      action: "GRANT_FREE_TRIAL",
      targetType: "SUBSCRIPTION",
      targetId: restaurant.id,
      performedBy: {
        uid: authCheck.user?.uid || "GDF2eldrzSNR9oltgezCr9MXt0I3",
        email: authCheck.user?.email || "admin@vivexatech.in",
        name: "Vivexa Tech Operations",
      },
      details: {
        restaurantName: restaurant.name,
        trialDays: days,
        trialStartDate,
        trialEndDate,
        previousStatus,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${days}-day free trial granted for ${restaurant.name}.`,
      subscription: restaurant.subscription,
      restaurant,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
