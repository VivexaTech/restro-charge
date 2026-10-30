// ==============================================================================
// RESTROCHARGE - Server-Side Push Notification Service
// Sends push alerts to registered authorized staff via Firebase Cloud Messaging.
// Cleans up stale tokens and enforces privacy (zero customer PII in payloads).
// ==============================================================================

import { adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import adminApp from "@/lib/firebase/admin";
import { OrderItem, RestaurantProfile, PushSubscriptionRecord } from "@/lib/types";

export interface PushDeliveryResult {
  sentCount: number;
  failureCount: number;
  staleTokensRemoved: number;
}

export async function sendOrderPushNotification(
  order: OrderItem,
  restaurant?: RestaurantProfile | null
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = {
    sentCount: 0,
    failureCount: 0,
    staleTokensRemoved: 0,
  };

  if (!isFirebaseAdminReady() || !adminDb) {
    return result;
  }

  try {
    // 1. Fetch active push subscriptions for this restaurant
    const snap = await adminDb
      .collection("pushSubscriptions")
      .where("restaurantId", "==", order.restaurantId)
      .get();

    if (snap.empty) {
      return result;
    }

    const subscriptions: PushSubscriptionRecord[] = [];
    snap.forEach((doc) => {
      subscriptions.push(doc.data() as PushSubscriptionRecord);
    });

    // 2. Filter distinct tokens belonging to authorized staff
    const authorizedRoles = new Set([
      "RESTAURANT_OWNER",
      "RESTAURANT_MANAGER",
      "ORDER_STAFF",
      "KITCHEN_STAFF",
      "SUPER_ADMIN",
    ]);

    const tokenMap = new Map<string, string>(); // token -> subDocId
    subscriptions.forEach((sub) => {
      if (authorizedRoles.has(sub.userRole) && sub.token) {
        tokenMap.set(sub.token, sub.id);
      }
    });

    const tokens = Array.from(tokenMap.keys());
    if (tokens.length === 0) {
      return result;
    }

    // 3. Construct payload strictly without customer PII
    const venueName = restaurant?.name || "Restaurant";
    const title = `🔔 New Order: ${order.orderNumber}`;
    const body = `${order.tableLabel} • ${order.items.length} ${order.items.length === 1 ? "dish" : "dishes"} • ₹${order.billing.finalTotal}`;

    const clickUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/staff`
      : "/staff";

    const messaging = adminApp.messaging();

    // 4. Send multicast push
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        restaurantId: order.restaurantId,
        tableLabel: order.tableLabel,
        venueName,
        url: clickUrl,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/dark-logo.svg",
          badge: "/dark-logo.svg",
          tag: `order-${order.id}`,
          renotify: true,
          requireInteraction: true,
          data: {
            url: clickUrl,
            orderId: order.id,
            restaurantId: order.restaurantId,
          },
        },
        fcmOptions: {
          link: clickUrl,
        },
      },
    });

    result.sentCount = response.successCount;
    result.failureCount = response.failureCount;

    // 5. Remove stale or unregistered tokens
    if (response.failureCount > 0) {
      const staleDocIds: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token" ||
            code === "messaging/invalid-argument"
          ) {
            const token = tokens[idx];
            const docId = tokenMap.get(token);
            if (docId) staleDocIds.push(docId);
          }
        }
      });

      if (staleDocIds.length > 0) {
        const batch = adminDb.batch();
        staleDocIds.forEach((id) => {
          batch.delete(adminDb.collection("pushSubscriptions").doc(id));
        });
        await batch.commit().catch(() => {});
        result.staleTokensRemoved = staleDocIds.length;
      }
    }

    return result;
  } catch (err: any) {
    console.warn("[PushNotificationService] Push delivery warning:", err.message);
    return result;
  }
}
