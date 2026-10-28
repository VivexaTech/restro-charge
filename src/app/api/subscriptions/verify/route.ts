// ==============================================================================
// RESTROCHARGE - Razorpay Subscription Payment Verification
// Cryptographic HMAC SHA256 signature verification & date calculation.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dataStore } from "@/lib/services/data-store";
import { calculateNewSubscriptionDates } from "@/lib/services/subscription";
import { sendEmail } from "@/lib/services/email";
import { generateId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId,
      planId,
      billingCycle = "MONTHLY",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body;

    if (!restaurantId || !planId || !razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json({ error: "Missing required payment fields." }, { status: 400 });
    }

    const restaurant = dataStore.getRestaurantById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const plan = dataStore.getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    // Check idempotency: avoid extending subscription twice for the same payment
    const existingPayment = dataStore.getPaymentByRazorpayPaymentId(razorpayPaymentId);
    if (existingPayment || restaurant.subscription?.lastPaymentId === razorpayPaymentId) {
      return NextResponse.json({
        success: true,
        message: "Payment has already been processed.",
        subscription: restaurant.subscription,
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isLiveKey = keySecret && !keySecret.includes("sample_secret");

    // Cryptographic signature verification if in live mode or signature provided
    if (razorpaySignature) {
      if (keySecret) {
        const generatedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          return NextResponse.json(
            { error: "Payment verification failed. Invalid cryptographic signature." },
            { status: 400 }
          );
        }
      }
    } else if (process.env.NODE_ENV === "production" && isLiveKey) {
      return NextResponse.json(
        { error: "Payment verification failed. Signature is required in production." },
        { status: 400 }
      );
    }

    // Calculate new subscription dates per business rules:
    // If still active, extend from current expiry. If expired, extend from now.
    const durationMonths = billingCycle === "ANNUAL" ? 12 : 1;
    const { startDate, expiryDate, gracePeriodEnd } = calculateNewSubscriptionDates(
      restaurant.subscription,
      durationMonths
    );

    const paymentRecordId = generateId("pay");
    const amount = billingCycle === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;

    // Record verified payment
    dataStore.savePayment({
      id: paymentRecordId,
      restaurantId,
      restaurantName: restaurant.name,
      planId: plan.id,
      planName: plan.name,
      amount,
      currency: "INR",
      paymentType: "RAZORPAY",
      billingCycle,
      status: "SUCCESS",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      createdAt: new Date().toISOString(),
    });

    // Update restaurant subscription status
    restaurant.subscription = {
      planId: plan.id,
      planName: plan.name,
      status: "ACTIVE",
      billingCycle,
      startDate,
      expiryDate,
      gracePeriodEnd,
      autoRenew: false,
      lastPaymentId: razorpayPaymentId,
      updatedAt: new Date().toISOString(),
    };

    // If restaurant was suspended or unpublished due to expiry, restore it!
    restaurant.published = true;
    if (restaurant.operationalSettings) {
      restaurant.operationalSettings.isAcceptingOrders = true;
    }

    dataStore.saveRestaurant(restaurant);

    // Audit log
    dataStore.addAuditLog({
      action: "SUBSCRIPTION_RENEWED_RAZORPAY",
      targetType: "SUBSCRIPTION",
      targetId: restaurant.id,
      performedBy: {
        uid: restaurant.ownerUid || "owner",
        email: restaurant.ownerEmail || "owner",
        name: restaurant.ownerName || "Restaurant Owner",
      },
      details: {
        planName: plan.name,
        billingCycle,
        razorpayOrderId,
        razorpayPaymentId,
        newExpiryDate: expiryDate,
        gracePeriodEnd,
      },
    });

    // Send confirmation email
    await sendEmail({
      to: restaurant.ownerEmail,
      subject: `RestroCharge Subscription Renewed - ${restaurant.name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #ea580c;">Subscription Renewed Successfully</h2>
          <p>Thank you for renewing your RestroCharge subscription for <strong>${restaurant.name}</strong>.</p>
          <p><strong>Plan:</strong> ${plan.name} (${billingCycle})</p>
          <p><strong>New Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString("en-IN")}</p>
          <p><strong>Grace Period Ends:</strong> ${new Date(gracePeriodEnd).toLocaleDateString("en-IN")}</p>
          <p>All QR ordering and digital presence remain fully active.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Subscription renewed successfully.",
      subscription: restaurant.subscription,
    });
  } catch (error: any) {
    console.error("[Verify Payment Error]:", error);
    return NextResponse.json({ error: error.message || "Verification failed." }, { status: 500 });
  }
}
