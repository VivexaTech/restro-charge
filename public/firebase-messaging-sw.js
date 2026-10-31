// ==============================================================================
// RESTROCHARGE - Production Firebase Cloud Messaging Service Worker
// Delivers background push notifications for newly placed restaurant orders.
// Handles notification clicks, deduplication, and dynamic client parameterization.
// ==============================================================================

importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

// Read configuration from service worker query parameters or default to active project credentials
const params = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: params.get("apiKey") || "mock-api-key",
  authDomain: params.get("authDomain") || "restro-charge.firebaseapp.com",
  projectId: params.get("projectId") || "restro-charge",
  storageBucket: params.get("storageBucket") || "restro-charge.appspot.com",
  messagingSenderId: params.get("messagingSenderId") || "123456789",
  appId: params.get("appId") || "1:123456789:web:abcdef",
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

// Background FCM message handler
if (messaging) {
  messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const notification = payload.notification || {};

    const venue = data.venueName || data.restaurantName || "Restaurant";
    const orderNumber = data.orderNumber || (data.orderId ? `#${data.orderId.slice(-6)}` : "New Ticket");
    const tableLabel = data.tableLabel || "Table";

    const title = notification.title || `New Order Received! — ${venue}`;
    const body =
      notification.body ||
      `Restaurant order ${orderNumber} has been placed. (${tableLabel})`;

    const options = {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.orderId ? `order-${data.orderId}` : "new-order",
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || "/staff",
        orderId: data.orderId,
        restaurantId: data.restaurantId,
      },
    };

    return self.registration.showNotification(title, options);
  });
}

// Fallback push event handler (deduplicated via tag)
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const data = payload.data || {};
    const notification = payload.notification || {};

    // If handled by FCM SDK (contains notification field that FCM natively shows in some browsers), avoid duplicating
    if (messaging && payload.fcmMessageId && payload.notification) {
      return;
    }

    const venue = data.venueName || "Restaurant";
    const orderNumber = data.orderNumber || "New Ticket";
    const title = notification.title || `New Order Received! — ${venue}`;
    const body =
      notification.body ||
      (data.tableLabel ? `Restaurant order ${orderNumber} placed at ${data.tableLabel}.` : "A new table order has been placed.");

    const options = {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.orderId ? `order-${data.orderId}` : "new-order",
      renotify: true,
      requireInteraction: true,
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
        body: text,
        icon: "/icon-192.png",
        data: { url: "/staff" },
      })
    );
  }
});

// Notification click: focus existing staff window or open target order tab
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/staff";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes("/staff") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
