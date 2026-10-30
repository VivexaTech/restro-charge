"use client";

// ==============================================================================
// RESTROCHARGE - Order Alert & Notification Context
// Provides continuous audible ringing for pending orders, sound selection,
// browser push notification registration, and real-time Firestore synchronization.
// ==============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { OrderItem, NotificationSoundFile } from "@/lib/types";
import {
  audioAlertService,
  DEFAULT_SOUND,
  NOTIFICATION_SOUNDS,
  isValidSoundFile,
} from "@/lib/services/audio-alert-service";
import { firestoreService } from "@/lib/services/firestore-service";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth/client-auth";
import { toast } from "sonner";
import { app } from "@/lib/firebase/client";

interface OrderAlertContextType {
  activeAlertOrders: OrderItem[];
  selectedSound: NotificationSoundFile;
  soundEnabled: boolean;
  isRinging: boolean;
  isAutoplayBlocked: boolean;
  pushPermission: "default" | "granted" | "denied" | "unsupported";
  isPushEnabled: boolean;
  isRegisteringPush: boolean;
  unlockAudio: () => Promise<void>;
  setSelectedSound: (sound: NotificationSoundFile) => Promise<void>;
  toggleSound: (enabled?: boolean) => Promise<void>;
  enablePushNotifications: () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
  previewSound: (sound: NotificationSoundFile) => Promise<void>;
  stopPreview: () => void;
  acceptOrder: (orderId: string) => Promise<boolean>;
}

const OrderAlertContext = createContext<OrderAlertContextType>({
  activeAlertOrders: [],
  selectedSound: DEFAULT_SOUND,
  soundEnabled: true,
  isRinging: false,
  isAutoplayBlocked: false,
  pushPermission: "default",
  isPushEnabled: false,
  isRegisteringPush: false,
  unlockAudio: async () => {},
  setSelectedSound: async () => {},
  toggleSound: async () => {},
  enablePushNotifications: async () => false,
  disablePushNotifications: async () => {},
  previewSound: async () => {},
  stopPreview: () => {},
  acceptOrder: async () => false,
});

export function OrderAlertProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "";

  const [activeAlertOrders, setActiveAlertOrders] = useState<OrderItem[]>([]);
  const [selectedSound, setSelectedSoundState] = useState<NotificationSoundFile>(
    audioAlertService.getSelectedSound()
  );
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(
    audioAlertService.isSoundEnabled()
  );
  const [isRinging, setIsRinging] = useState<boolean>(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<
    "default" | "granted" | "denied" | "unsupported"
  >("default");
  const [isPushEnabled, setIsPushEnabled] = useState<boolean>(false);
  const [isRegisteringPush, setIsRegisteringPush] = useState<boolean>(false);

  // Sync state from audioAlertService
  useEffect(() => {
    const updateFromService = () => {
      setActiveAlertOrders(audioAlertService.getActivePendingOrders());
      setSelectedSoundState(audioAlertService.getSelectedSound());
      setSoundEnabledState(audioAlertService.isSoundEnabled());
      setIsRinging(audioAlertService.isCurrentlyRinging());
      setIsAutoplayBlocked(audioAlertService.isBlocked());
    };

    updateFromService();
    const unsubscribe = audioAlertService.subscribeState(updateFromService);
    return () => unsubscribe();
  }, []);

  // Inspect browser Notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushPermission("unsupported");
    } else {
      setPushPermission(Notification.permission);
      if (Notification.permission === "granted") {
        setIsPushEnabled(true);
      }
    }
  }, []);

  // Load user's saved sound preference from backend
  useEffect(() => {
    if (!user || !user.uid) return;

    let isMounted = true;
    async function loadPreferences() {
      try {
        const res = await authFetch("/api/staff/notification-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.preferences && isMounted) {
            if (isValidSoundFile(data.preferences.orderSound)) {
              audioAlertService.setSelectedSound(data.preferences.orderSound);
              setSelectedSoundState(data.preferences.orderSound);
            }
            if (typeof data.preferences.soundEnabled === "boolean") {
              audioAlertService.setSoundEnabled(data.preferences.soundEnabled);
              setSoundEnabledState(data.preferences.soundEnabled);
            }
            if (typeof data.preferences.browserPushEnabled === "boolean") {
              setIsPushEnabled(data.preferences.browserPushEnabled);
            }
          }
        }
      } catch (err) {
        // Fallback to local defaults
      }
    }

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Real-time Firestore order subscription scoped to restaurant
  useEffect(() => {
    if (!currentRestaurantId) {
      audioAlertService.reconcilePendingOrders([]);
      return;
    }

    // Subscribe to live Firestore orders collection
    const unsubscribe = firestoreService.subscribeOrders(
      currentRestaurantId,
      (incomingOrders) => {
        // Filter for orders needing staff action:
        // status === 'NEW' and created within the last 45 minutes to prevent stale historical orders from ringing
        const cutoffTime = Date.now() - 45 * 60 * 1000;
        const eligibleNewOrders = incomingOrders.filter((ord) => {
          if (ord.status !== "NEW") return false;
          const orderTime = new Date(ord.createdAt).getTime();
          return orderTime >= cutoffTime;
        });

        audioAlertService.reconcilePendingOrders(eligibleNewOrders);
      },
      (error) => {
        console.warn("[OrderAlertContext] Firestore listener error:", error.message);
      }
    );

    return () => {
      unsubscribe();
      audioAlertService.reconcilePendingOrders([]);
    };
  }, [currentRestaurantId]);

  // Unlock audio gesture handler
  const unlockAudio = useCallback(async () => {
    await audioAlertService.unlock();
  }, []);

  // Sound selection with backend persistence
  const setSelectedSound = useCallback(
    async (sound: NotificationSoundFile) => {
      if (!isValidSoundFile(sound)) return;

      audioAlertService.setSelectedSound(sound);
      setSelectedSoundState(sound);

      try {
        await authFetch("/api/staff/notification-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderSound: sound }),
        });
      } catch (err) {
        console.warn("[OrderAlertContext] Failed to persist sound preference:", err);
      }
    },
    []
  );

  // Toggle sound enabled/disabled with persistence
  const toggleSound = useCallback(
    async (enabled?: boolean) => {
      const nextState =
        typeof enabled === "boolean"
          ? enabled
          : !audioAlertService.isSoundEnabled();

      audioAlertService.setSoundEnabled(nextState);
      setSoundEnabledState(nextState);

      try {
        await authFetch("/api/staff/notification-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ soundEnabled: nextState }),
        });
      } catch (err) {
        console.warn("[OrderAlertContext] Failed to persist sound toggle:", err);
      }
    },
    []
  );

  // Sound preview
  const previewSound = useCallback(async (sound: NotificationSoundFile) => {
    await audioAlertService.previewSound(sound);
  }, []);

  const stopPreview = useCallback(() => {
    audioAlertService.stopPreview();
  }, []);

  // Concurrency-safe order acceptance
  const acceptOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      try {
        const res = await authFetch(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "ACCEPTED",
            updatedBy: user?.displayName || user?.email || "Staff Member",
            note: "Order accepted via staff alert stream.",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            toast.error(data.error || "Order was already accepted by another staff member.");
            // Remove from local alert since it's already claimed
            audioAlertService.removeOrderAlert(orderId);
            return false;
          }
          throw new Error(data.error || "Failed to accept order.");
        }

        // Successfully accepted: remove alert
        audioAlertService.removeOrderAlert(orderId);
        toast.success(`Order accepted successfully!`);
        return true;
      } catch (err: any) {
        toast.error(err.message || "Failed to accept order ticket.");
        return false;
      }
    },
    [user]
  );

  // Enable Browser Push Notifications
  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser push notifications are not supported in this browser.");
      return false;
    }

    if (!("serviceWorker" in navigator)) {
      toast.error("Service workers are not supported in this browser environment.");
      return false;
    }

    setIsRegisteringPush(true);
    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        if (permission === "denied") {
          toast.error(
            "Notification permission denied. Please allow notifications in your browser settings to receive new order alerts."
          );
        }
        setIsRegisteringPush(false);
        return false;
      }

      // 2. Register service worker
      const swRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      // 3. Obtain FCM token
      let token: string | null = null;
      try {
        const { getMessaging, getToken } = await import("firebase/messaging");
        const messaging = getMessaging(app);

        const vapidKey =
          process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

        token = await getToken(messaging, {
          serviceWorkerRegistration: swRegistration,
          vapidKey,
        });
      } catch (fcmErr: any) {
        console.warn("[Push Notifications] Direct FCM token retrieval:", fcmErr.message);
      }

      // If token obtained or if testing Web Push
      if (token && currentRestaurantId) {
        // Send token to backend
        const regRes = await authFetch("/api/notifications/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            restaurantId: currentRestaurantId,
            deviceType: navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
          }),
        });

        if (regRes.ok) {
          setIsPushEnabled(true);
          toast.success("Browser push notifications enabled for new orders!");
          setIsRegisteringPush(false);
          return true;
        }
      }

      // Fallback: permission granted even if FCM token configuration is pending
      setIsPushEnabled(true);
      toast.success("Browser notifications enabled!");
      setIsRegisteringPush(false);
      return true;
    } catch (err: any) {
      console.error("[Push Notifications] Registration error:", err);
      toast.error("Failed to enable push notifications: " + (err.message || "Unknown error"));
      setIsRegisteringPush(false);
      return false;
    }
  }, [currentRestaurantId]);

  // Disable Browser Push Notifications
  const disablePushNotifications = useCallback(async () => {
    setIsPushEnabled(false);
    try {
      await authFetch("/api/notifications/push-token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: currentRestaurantId }),
      });
      await authFetch("/api/staff/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browserPushEnabled: false }),
      });
      toast.info("Browser push notifications disabled.");
    } catch {
      // ignore
    }
  }, [currentRestaurantId]);

  return (
    <OrderAlertContext.Provider
      value={{
        activeAlertOrders,
        selectedSound,
        soundEnabled,
        isRinging,
        isAutoplayBlocked,
        pushPermission,
        isPushEnabled,
        isRegisteringPush,
        unlockAudio,
        setSelectedSound,
        toggleSound,
        enablePushNotifications,
        disablePushNotifications,
        previewSound,
        stopPreview,
        acceptOrder,
      }}
    >
      {children}
    </OrderAlertContext.Provider>
  );
}

export function useOrderAlert() {
  return useContext(OrderAlertContext);
}
