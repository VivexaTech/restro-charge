// ==============================================================================
// RESTROCHARGE - Subscription Self-Renewal Order Route
// Generates Razorpay order for restaurant subscription renewal.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { generateId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, planId, billingCycle = "MONTHLY" } = body;

    if (!restaurantId || !planId) {
      return NextResponse.json({ error: "Missing restaurantId or planId." }, { status: 400 });
    }

    const restaurant = dataStore.getRestaurantById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const plan = dataStore.getPlanById(planId);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Selected plan is unavailable." }, { status: 400 });
    }

    const amount = billingCycle === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
    const currency = "INR";
    const receipt = `rcpt_${Date.now()}_${restaurant.slug}`;

    // Razorpay credentials
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_sample123";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "sample_secret_key";

    let razorpayOrderId = `order_${generateId("rzp")}`;

    // If real Razorpay credentials are provided, call Razorpay API
    if (keyId && keySecret && !keyId.includes("sample") && !keyId.includes("test_sample")) {
      try {
        const Razorpay = (await import("razorpay")).default;
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const rzpOrder = await rzp.orders.create({
          amount: amount * 100, // in paise
          currency,
          receipt,
          notes: {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            planId: plan.id,
            billingCycle,
          },
        });
        razorpayOrderId = rzpOrder.id;
      } catch (err: any) {
        console.warn("[Razorpay Order Creation Fallback]:", err.message);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: razorpayOrderId,
      amount,
      currency,
      keyId,
      restaurantName: restaurant.name,
      planName: plan.name,
      billingCycle,
    });
  } catch (error: any) {
    console.error("[Subscription Renew Order Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate renewal" }, { status: 500 });
  }
}
