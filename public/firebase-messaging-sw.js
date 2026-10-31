// ==============================================================================
// RESTROCHARGE - Production Firebase Cloud Messaging Service Worker
// Delivers background push notifications for newly placed restaurant orders.
// Handles background wakeups, notification clicks, deduplication, and sound/vibration.
// ==============================================================================

importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

// Read configuration from service worker query parameters or default to production project credentials
const params = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: params.get("apiKey") || "AIzaSyBMwS7CicyMg5iYsdIIDhEpF2wRaKOwTMs",
  authDomain: params.get("authDomain") || "restro-charge.firebaseapp.com",
  projectId: params.get("projectId") || "restro-charge",
  storageBucket: params.get("storageBucket") || "restro-charge.firebasestorage.app",
  messagingSenderId: params.get("messagingSenderId") || "105115979205",
  appId: params.get("appId") || "1:105115979205:web:90942d0103c6eb30bbcfac",
};

let messaging = null;
try {
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  messaging = firebase.messaging();
} catch (err) {
  console.warn("[SW] Firebase compat init warning:", err);
}

// In-memory deduplication set to avoid showing duplicate notifications for the same push message
const seenMessages = new Set();

// Background FCM message handler
if (messaging) {
  messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const notification = payload.notification || {};

    const msgId = payload.fcmMessageId || data.orderId || "";
    if (msgId) {
      if (seenMessages.has(msgId)) return;
      seenMessages.add(msgId);
      if (seenMessages.size > 200) {
        const first = seenMessages.values().next().value;
        if (first) seenMessages.delete(first);
      }
    }

    const venue = data.venueName || data.restaurantName || "Restaurant";
    const orderNumber = data.orderNumber || (data.orderId ? `#${data.orderId.slice(-6)}` : "New Ticket");
    const tableLabel = data.tableLabel || "Table";

    const title = notification.title || data.title || `New Order Received! — ${venue}`;
    const body =
      notification.body ||
      data.body ||
      `Restaurant order ${orderNumber} has been placed. (${tableLabel})`;

    const options = {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.orderId ? `order-${data.orderId}` : "new-order",
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
        url: data.url || "/staff",
        orderId: data.orderId,
        restaurantId: data.restaurantId,
      },
    };

    return self.registration.showNotification(title, options);
  });
}

// Push event handler: guarantees that even when the tab is closed or backgrounded,
// every incoming push event displays a system notification without being dropped.
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const data = payload.data || {};
    const notification = payload.notification || {};

    const msgId = payload.fcmMessageId || data.orderId || "";
    if (msgId) {
      if (seenMessages.has(msgId)) return;
      seenMessages.add(msgId);
      if (seenMessages.size > 200) {
        const first = seenMessages.values().next().value;
        if (first) seenMessages.delete(first);
      }
    }

    const venue = data.venueName || "Restaurant";
    const orderNumber = data.orderNumber || (data.orderId ? `#${data.orderId.slice(-6)}` : "New Ticket");
    const tableLabel = data.tableLabel || "Table";

    const title = notification.title || data.title || `New Order Received! — ${venue}`;
    const body =
      notification.body ||
      data.body ||
      (tableLabel ? `Restaurant order ${orderNumber} placed at ${tableLabel}.` : "A new table order has been placed.");

    const options = {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.orderId ? `order-${data.orderId}` : "new-order",
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
        url: data.url || "/staff",
        orderId: data.orderId,
        restaurantId: data.restaurantId,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Text fallback
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("🔔 New Order Received!", {
        body: text || "A new order has been received at your restaurant.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200, 100, 200, 100, 400],
        requireInteraction: true,
        data: { url: "/staff" },
      })
    );
  }
});

// Notification click: focus existing staff window or open target order tab
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const notifData = (event.notification && event.notification.data) || {};
  const targetUrl = notifData.url || "/staff";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && client.url.includes("/staff") && "focus" in client) {
          if ("postMessage" in client && notifData.orderId) {
            client.postMessage({
              type: "NEW_ORDER_PUSH_CLICK",
              orderId: notifData.orderId,
              restaurantId: notifData.restaurantId,
            });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
