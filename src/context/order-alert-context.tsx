"use client";

// ==============================================================================
// RESTROCHARGE - Order Alert & Notification Context
// Provides continuous audible ringing for pending orders, sound selection,
// browser push notification registration (FCM), foreground FCM push reception,
// PWA install prompt handling, and real-time Firestore synchronization.
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
import { firebaseConfig, getClientMessaging } from "@/lib/firebase/client";

interface OrderAlertContextType {
  activeAlertOrders: OrderItem[];
  selectedSound: NotificationSoundFile;
  soundEnabled: boolean;
  isRinging: boolean;
  isAutoplayBlocked: boolean;
  pushPermission: "default" | "granted" | "denied" | "unsupported";
  isPushEnabled: boolean;
  isRegisteringPush: boolean;
  canInstallPWA: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstallPWA: () => Promise<boolean>;
  unlockAudio: () => Promise<boolean>;
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
  canInstallPWA: false,
  isIOS: false,
  isStandalone: false,
  promptInstallPWA: async () => false,
  unlockAudio: async () => false,
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

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  // 1. Sync state from audioAlertService
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

  // 2. Inspect browser Notification permission & PWA display mode on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Notification permission check
    if (!("Notification" in window)) {
      setPushPermission("unsupported");
    } else {
      setPushPermission(Notification.permission);
      const isAlreadyRegistered =
        localStorage.getItem("restrocharge_fcm_registered") === "true";
      if (Notification.permission === "granted" && isAlreadyRegistered) {
        setIsPushEnabled(true);
      }
    }

    // PWA beforeinstallprompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstallPWA(false);
      setIsStandalone(true);
      toast.success("RestroCharge installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 3. Silent re-registration check if already registered in localStorage
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !currentRestaurantId
    ) {
      return;
    }

    const isAlreadyRegistered =
      localStorage.getItem("restrocharge_fcm_registered") === "true";

    if (Notification.permission === "granted" && isAlreadyRegistered) {
      setIsPushEnabled(true);
      (async () => {
        try {
          const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(
            firebaseConfig.apiKey || ""
          )}&projectId=${encodeURIComponent(
            firebaseConfig.projectId || ""
          )}&messagingSenderId=${encodeURIComponent(
            firebaseConfig.messagingSenderId || ""
          )}&appId=${encodeURIComponent(firebaseConfig.appId || "")}`;

          const swRegistration = await navigator.serviceWorker.register(swUrl, {
            scope: "/",
          });
          await navigator.serviceWorker.ready;

          const messaging = await getClientMessaging();
          if (messaging) {
            const { getToken } = await import("firebase/messaging");
            const vapidKey =
              process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

            const token = await getToken(messaging, {
              serviceWorkerRegistration: swRegistration,
              vapidKey,
            });

            if (token) {
              await authFetch("/api/notifications/push-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token,
                  restaurantId: currentRestaurantId,
                  deviceType: navigator.userAgent.includes("Mobile")
                    ? "mobile"
                    : "desktop",
                }),
              });
            }
          }
        } catch (err) {
          console.warn("[OrderAlertContext] Silent token refresh:", err);
        }
      })();
    }
  }, [currentRestaurantId]);

  // 4. Foreground FCM push listener
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    let unsubscribe: (() => void) | undefined;

    async function initForegroundMessaging() {
      try {
        const messaging = await getClientMessaging();
        if (!messaging) return;

        const { onMessage } = await import("firebase/messaging");
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("[FCM Foreground Message Received]", payload);
          const title =
            payload.notification?.title ||
            payload.data?.title ||
            "New Order Received!";
          const body =
            payload.notification?.body ||
            payload.data?.body ||
            "A new order ticket has arrived.";

          toast.info(title, {
            description: body,
            duration: 6000,
          });

          // Quietly unlock audio context to allow incoming alert chime
          audioAlertService.unlock().catch(() => {});
        });
      } catch (err) {
        console.warn("[FCM] Foreground listener init error:", err);
      }
    }

    initForegroundMessaging();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 5. Load user's saved sound preference from backend
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
              if (
                data.preferences.browserPushEnabled &&
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                setIsPushEnabled(true);
              }
            }
          }
        }
      } catch {
        // Fallback to local defaults
      }
    }

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 6. Real-time Firestore order subscription scoped to restaurant
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
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    return await audioAlertService.unlock();
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
            toast.error(
              data.error || "Order was already accepted by another staff member."
            );
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

  // PWA Install prompt trigger
  const promptInstallPWA = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setCanInstallPWA(false);
      return outcome === "accepted";
    } catch (err) {
      console.warn("[PWA] Prompt error:", err);
      return false;
    }
  }, [deferredPrompt]);

  // Enable Browser Push Notifications (FCM)
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

      // 2. Register service worker with dynamic Firebase configuration query params
      const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(
        firebaseConfig.apiKey || ""
      )}&projectId=${encodeURIComponent(
        firebaseConfig.projectId || ""
      )}&messagingSenderId=${encodeURIComponent(
        firebaseConfig.messagingSenderId || ""
      )}&appId=${encodeURIComponent(firebaseConfig.appId || "")}`;

      const swRegistration = await navigator.serviceWorker.register(swUrl, {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      // 3. Obtain FCM token
      let token: string | null = null;
      try {
        const messaging = await getClientMessaging();
        if (messaging) {
          const { getToken } = await import("firebase/messaging");
          const vapidKey =
            process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

          token = await getToken(messaging, {
            serviceWorkerRegistration: swRegistration,
            vapidKey,
          });
        }
      } catch (fcmErr: any) {
        console.warn("[Push Notifications] Direct FCM token retrieval:", fcmErr.message);
      }

      // 4. Save token to Firestore pushSubscriptions collection via backend API
      if (token && currentRestaurantId) {
        const regRes = await authFetch("/api/notifications/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            restaurantId: currentRestaurantId,
            deviceType: navigator.userAgent.includes("Mobile")
              ? "mobile"
              : "desktop",
          }),
        });

        if (regRes.ok) {
          setIsPushEnabled(true);
          try {
            localStorage.setItem("restrocharge_fcm_registered", "true");
          } catch {}
          toast.success("Order notifications enabled successfully!");
          setIsRegisteringPush(false);
          return true;
        }
      }

      // Fallback: permission granted even if FCM token configuration is pending
      setIsPushEnabled(true);
      try {
        localStorage.setItem("restrocharge_fcm_registered", "true");
      } catch {}
      toast.success("Browser notifications enabled!");
      setIsRegisteringPush(false);
      return true;
    } catch (err: any) {
      console.error("[Push Notifications] Registration error:", err);
      toast.error(
        "Failed to enable push notifications: " + (err.message || "Unknown error")
      );
      setIsRegisteringPush(false);
      return false;
    }
  }, [currentRestaurantId]);

  // Disable Browser Push Notifications
  const disablePushNotifications = useCallback(async () => {
    setIsPushEnabled(false);
    try {
      localStorage.removeItem("restrocharge_fcm_registered");
    } catch {}

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
        canInstallPWA,
        isIOS,
        isStandalone,
        promptInstallPWA,
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
