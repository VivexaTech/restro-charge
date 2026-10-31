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

// In-memory deduplication set to avoid sending duplicate pushes for the same order
const sentOrderPushes = new Set<string>();

export async function sendOrderPushNotification(
  order: OrderItem,
  restaurant?: RestaurantProfile | null
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = {
    sentCount: 0,
    failureCount: 0,
    staleTokensRemoved: 0,
  };

  if (!order || !order.id || sentOrderPushes.has(order.id)) {
    return result;
  }
  sentOrderPushes.add(order.id);
  if (sentOrderPushes.size > 2000) {
    const firstKey = sentOrderPushes.values().next().value;
    if (firstKey) sentOrderPushes.delete(firstKey);
  }

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
      if (authorizedRoles.has(sub.userRole) && sub.token && sub.isActive !== false) {
        tokenMap.set(sub.token, sub.id);
      }
    });

    const tokens = Array.from(tokenMap.keys());
    if (tokens.length === 0) {
      return result;
    }

    // 3. Construct payload strictly without customer PII (Requirement 6)
    const venueName = restaurant?.name || "Restaurant";
    const title = `New Order Received! — ${venueName}`;
    const body = `Restaurant order #${order.orderNumber} has been placed. (${order.tableLabel} • ${order.items.length} ${order.items.length === 1 ? "dish" : "dishes"} • ₹${order.billing.finalTotal})`;

    const clickUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/staff`
      : "/staff";

    const messaging = adminApp.messaging();

    // 4. Send multicast push with High Urgency & explicit background notification parameters
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        orderId: String(order.id),
        orderNumber: String(order.orderNumber),
        restaurantId: String(order.restaurantId),
        tableLabel: String(order.tableLabel),
        venueName: String(venueName),
        title: String(title),
        body: String(body),
        url: clickUrl,
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400",
        },
        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `order-${order.id}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200, 100, 400],
          actions: [
            {
              action: "open_staff",
              title: "View Ticket",
            },
          ],
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
