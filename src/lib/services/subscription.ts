// ==============================================================================
// RESTROCHARGE - Subscription & Grace Period Service
// Developed for Vivexa Tech
// ==============================================================================

import type { SubscriptionInfo, SubscriptionStatus } from "../types";

export const GRACE_PERIOD_DAYS = 3;

export interface SubscriptionAccessCheck {
  canOrder: boolean;
  canViewSite: boolean;
  status: SubscriptionStatus;
  isGracePeriod: boolean;
  daysRemaining: number;
  graceDaysRemaining: number;
  message: string;
}

/**
 * Checks subscription status with strict 3-day grace period enforcement.
 * Business Rule:
 * - Active/Trial: normal access
 * - Expired within 3-day grace period: access permitted with renewal warnings
 * - Expired beyond 3-day grace period: QR ordering & public website disabled!
 * - Suspended: access completely blocked
 */
export function getSubscriptionAccess(
  sub?: SubscriptionInfo | null
): SubscriptionAccessCheck {
  if (!sub) {
    return {
      canOrder: false,
      canViewSite: false,
      status: "EXPIRED",
      isGracePeriod: false,
      daysRemaining: 0,
      graceDaysRemaining: 0,
      message: "No active subscription found. Please contact Vivexa Tech.",
    };
  }

  if (sub.status === "SUSPENDED") {
    return {
      canOrder: false,
      canViewSite: false,
      status: "SUSPENDED",
      isGracePeriod: false,
      daysRemaining: 0,
      graceDaysRemaining: 0,
      message: "This restaurant account has been suspended by administration.",
    };
  }

  const now = new Date().getTime();
  const expiryTime = new Date(sub.expiryDate).getTime();
  const graceEndTime = new Date(sub.gracePeriodEnd).getTime();

  // If currently before expiry date
  if (now <= expiryTime) {
    const daysRemaining = Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));
    return {
      canOrder: true,
      canViewSite: true,
      status: sub.status === "TRIAL" ? "TRIAL" : "ACTIVE",
      isGracePeriod: false,
      daysRemaining,
      graceDaysRemaining: GRACE_PERIOD_DAYS,
      message: "Subscription is active.",
    };
  }

  // Between expiry date and grace period end (within 3 days)
  if (now <= graceEndTime) {
    const graceMsRemaining = graceEndTime - now;
    const graceDaysRemaining = Math.max(1, Math.ceil(graceMsRemaining / (1000 * 60 * 60 * 24)));

    return {
      canOrder: true,
      canViewSite: true,
      status: "GRACE_PERIOD",
      isGracePeriod: true,
      daysRemaining: 0,
      graceDaysRemaining,
      message: `Subscription expired! You are in a ${graceDaysRemaining}-day grace period. Renew immediately to avoid service interruption.`,
    };
  }

  // Beyond grace period - service blocked!
  return {
    canOrder: false,
    canViewSite: false,
    status: "EXPIRED",
    isGracePeriod: false,
    daysRemaining: 0,
    graceDaysRemaining: 0,
    message: "Subscription expired beyond the 3-day grace period. Ordering and public website are temporarily disabled.",
  };
}

/**
 * Calculates new expiry and grace period dates.
 * Per Vivexa business rules:
 * - If still active: extend from current expiry date.
 * - If expired / beyond grace: extend from current activation date (now).
 */
export function calculateNewSubscriptionDates(
  currentSub: SubscriptionInfo | null | undefined,
  durationMonths: number
): { startDate: string; expiryDate: string; gracePeriodEnd: string } {
  const now = new Date();
  let baseDate = now;

  if (currentSub && new Date(currentSub.expiryDate) > now) {
    // Subscription is still active, extend from current expiry date
    baseDate = new Date(currentSub.expiryDate);
  }

  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

  // 3-day grace period after expiry
  const graceEnd = new Date(newExpiry);
  graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

  return {
    startDate: currentSub && new Date(currentSub.expiryDate) > now ? currentSub.startDate : now.toISOString(),
    expiryDate: newExpiry.toISOString(),
    gracePeriodEnd: graceEnd.toISOString(),
  };
}
