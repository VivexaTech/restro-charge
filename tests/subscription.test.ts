// ==============================================================================
// TEST: Subscription & 3-Day Grace Period Enforcement
// Verifies active access, 3-day grace period behavior, expiry block, and renewal extension.
// ==============================================================================

import assert from "node:assert";
import {
  getSubscriptionAccess,
  calculateNewSubscriptionDates,
  GRACE_PERIOD_DAYS,
} from "../src/lib/services/subscription";
import type { SubscriptionInfo } from "../src/lib/types";

console.log("🧪 Running Test: Subscription & Grace Period Engine...");

const now = new Date();

// Test 1: Active Subscription
const activeSub: SubscriptionInfo = {
  planId: "plan_pro",
  planName: "Growth & KDS Pro",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  expiryDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  gracePeriodEnd: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000).toISOString(),
  autoRenew: false,
  updatedAt: now.toISOString(),
};

const check1 = getSubscriptionAccess(activeSub);
assert.strictEqual(check1.canOrder, true, "Active subscription must allow table ordering");
assert.strictEqual(check1.canViewSite, true, "Active subscription must allow public site viewing");
assert.strictEqual(check1.isGracePeriod, false, "Must not be flagged as grace period while active");
assert.strictEqual(check1.status, "ACTIVE");
console.log("  ✅ Test 1 Passed: Active subscription permits normal operations.");

// Test 2: In 3-Day Grace Period (Expired 1 day ago)
const graceSub: SubscriptionInfo = {
  ...activeSub,
  status: "ACTIVE",
  expiryDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // expired 1 day ago
  gracePeriodEnd: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 grace days left
};

const check2 = getSubscriptionAccess(graceSub);
assert.strictEqual(check2.canOrder, true, "Grace period must allow ordering per business rules");
assert.strictEqual(check2.canViewSite, true, "Grace period must allow site access");
assert.strictEqual(check2.isGracePeriod, true, "Must be flagged as grace period");
assert.strictEqual(check2.status, "GRACE_PERIOD");
console.log("  ✅ Test 2 Passed: 3-day grace period permits ordering with warnings.");

// Test 3: Expired Beyond 3-Day Grace Period (Expired 4 days ago)
const expiredSub: SubscriptionInfo = {
  ...activeSub,
  status: "ACTIVE",
  expiryDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  gracePeriodEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
};

const check3 = getSubscriptionAccess(expiredSub);
assert.strictEqual(check3.canOrder, false, "Expired beyond grace must reject food orders");
assert.strictEqual(check3.canViewSite, false, "Expired beyond grace must take public site offline");
assert.strictEqual(check3.status, "EXPIRED");
console.log("  ✅ Test 3 Passed: Expiry beyond 3-day grace strictly shuts down QR ordering & site.");

// Test 4: Renewal Calculation - If still active, extend from existing expiry date
const existingExpiry = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
const subToRenew: SubscriptionInfo = {
  ...activeSub,
  expiryDate: existingExpiry.toISOString(),
};

const renewalDates = calculateNewSubscriptionDates(subToRenew, 1); // 1 month extension
const expectedExpiry = new Date(existingExpiry);
expectedExpiry.setMonth(expectedExpiry.getMonth() + 1);

assert.strictEqual(
  new Date(renewalDates.expiryDate).getMonth(),
  expectedExpiry.getMonth(),
  "Renewal must extend from existing future expiry date"
);
console.log("  ✅ Test 4 Passed: Active renewals correctly extend from existing expiry date.");

console.log("🎉 All Subscription & Grace Period Tests Passed!\n");
