// ==============================================================================
// RESTROCHARGE - Firebase Cloud Messaging Service Worker
// Delivers background push notifications for newly placed restaurant orders.
// Handles notification clicks to bring staff back to the order management screen.
// ==============================================================================

importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "mock-api-key",
  authDomain: "restro-charge.firebaseapp.com",
  projectId: "restro-charge",
  storageBucket: "restro-charge.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};

try {
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const notification = payload.notification || {};

    const title = notification.title || data.title || "🔔 New Order Received";
    const body =
      notification.body ||
      data.body ||
      (data.tableLabel ? `New order placed at ${data.tableLabel}` : "A new table order is awaiting acceptance.");

    const options = {
      body,
      icon: "/dark-logo.svg",
      badge: "/dark-logo.svg",
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
} catch (err) {
  console.warn("[SW] Firebase Messaging init in service worker:", err);
}

// Fallback Web Push event listener
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const data = payload.data || {};
    const notification = payload.notification || {};

    const title = notification.title || data.title || "🔔 New Order Received";
    const body =
      notification.body ||
      data.body ||
      "A customer dining order has been submitted.";

    const options = {
      body,
      icon: "/dark-logo.svg",
      badge: "/dark-logo.svg",
      tag: data.orderId ? `order-${data.orderId}` : "new-order",
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || "/staff",
        orderId: data.orderId,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("🔔 RestroCharge Order Alert", {
        body: text,
        icon: "/dark-logo.svg",
        data: { url: "/staff" },
      })
    );
  }
});

// Handle notification click: focus existing window or open target order tab
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/staff";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
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
