// ==============================================================================
// RESTROCHARGE - Razorpay Secure Webhook Handler
// Webhook signature verification, idempotency, and subscription reconciliation.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dataStore } from "@/lib/services/data-store";
import { calculateNewSubscriptionDates } from "@/lib/services/subscription";

// In-memory set for processed webhook event IDs to prevent duplicate actions
const processedWebhookEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify cryptographic signature if secret is configured
    if (webhookSecret && !webhookSecret.includes("sample_webhook_secret")) {
      if (!signature) {
        return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
      }

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.event_id || payload.payload?.payment?.entity?.id;

    // Idempotency check: if this event was already processed, respond 200 OK without re-processing
    if (eventId && dataStore.isWebhookEventProcessed(eventId)) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    if (payload.event === "payment.captured" || payload.event === "order.paid") {
      const payment = payload.payload?.payment?.entity;
      const notes = payment?.notes || {};
      const restaurantId = notes.restaurantId;
      const planId = notes.planId;
      const billingCycle = notes.billingCycle || "MONTHLY";

      if (restaurantId && planId) {
        const restaurant = dataStore.getRestaurantById(restaurantId);
        const plan = dataStore.getPlanById(planId);

        if (restaurant && plan) {
          const durationMonths = billingCycle === "ANNUAL" ? 12 : 1;
          const { startDate, expiryDate, gracePeriodEnd } = calculateNewSubscriptionDates(
            restaurant.subscription,
            durationMonths
          );

          restaurant.subscription = {
            planId: plan.id,
            planName: plan.name,
            status: "ACTIVE",
            billingCycle,
            startDate,
            expiryDate,
            gracePeriodEnd,
            autoRenew: false,
            lastPaymentId: payment.id,
            updatedAt: new Date().toISOString(),
          };

          restaurant.published = true;
          dataStore.saveRestaurant(restaurant);

          dataStore.addAuditLog({
            action: "WEBHOOK_SUBSCRIPTION_RENEWAL",
            targetType: "SUBSCRIPTION",
            targetId: restaurant.id,
            performedBy: {
              uid: "system_webhook",
              email: "webhook@razorpay.com",
              name: "Razorpay Webhook Handler",
            },
            details: {
              eventId,
              paymentId: payment.id,
              newExpiryDate: expiryDate,
            },
          });
        }
      }
    }

    if (eventId) {
      dataStore.markWebhookEventProcessed(eventId);
    }

    return NextResponse.json({ received: true, status: "ok" });
  } catch (error: any) {
    console.error("[Razorpay Webhook Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
