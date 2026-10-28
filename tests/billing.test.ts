// ==============================================================================
// TEST: Central Billing & Taxation Calculation Engine
// Verifies backend price enforcement, GST, service charge, and snapshot rules.
// ==============================================================================

import assert from "node:assert";
import { calculateOrderBill } from "../src/lib/services/billing";
import type { BillingConfig, OrderItemSnapshot } from "../src/lib/types";

console.log("🧪 Running Test: Central Billing & Taxation Engine...");

// Test 1: Standard Subtotal + 5% GST (Tax on subtotal)
const items1: OrderItemSnapshot[] = [
  { productId: "p1", name: "Chicken Biryani", price: 360, quantity: 2, isVeg: false },
  { productId: "p2", name: "Mango Lassi", price: 130, quantity: 1, isVeg: true },
];

const config1: BillingConfig = {
  itemOnly: false,
  gstEnabled: true,
  gstRate: 5,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  calculationBasis: "TAX_ON_SUBTOTAL",
};

const result1 = calculateOrderBill(items1, config1);
// Subtotal = (360 * 2) + 130 = 850
// GST = 850 * 0.05 = 42.5
// Total = 892.5
assert.strictEqual(result1.subtotal, 850, "Subtotal must equal 850");
assert.strictEqual(result1.gstAmount, 42.5, "GST 5% must equal 42.5");
assert.strictEqual(result1.finalTotal, 892.5, "Final total must equal 892.5");
console.log("  ✅ Test 1 Passed: Standard GST 5% on subtotal calculated correctly.");

// Test 2: Subtotal + 5% Service Charge + 5% GST on (Subtotal + Service Charge)
const config2: BillingConfig = {
  itemOnly: false,
  gstEnabled: true,
  gstRate: 5,
  serviceChargeEnabled: true,
  serviceChargeRate: 5,
  calculationBasis: "TAX_ON_SUBTOTAL_PLUS_SERVICE",
};

const result2 = calculateOrderBill(items1, config2);
// Subtotal = 850
// Service Charge = 850 * 0.05 = 42.5
// GST = (850 + 42.5) * 0.05 = 892.5 * 0.05 = 44.63 (rounded)
// Total = 850 + 42.5 + 44.63 = 937.13
assert.strictEqual(result2.subtotal, 850, "Subtotal must equal 850");
assert.strictEqual(result2.serviceChargeAmount, 42.5, "Service charge 5% must equal 42.5");
assert.strictEqual(result2.gstAmount, 44.63, "GST on (subtotal + service) must equal 44.63");
assert.strictEqual(result2.finalTotal, 937.13, "Total must equal 937.13");
console.log("  ✅ Test 2 Passed: Compounded GST on Subtotal + Service Charge calculated correctly.");

// Test 3: Item-Only Policy (Zero taxes/service charges enforced by Vivexa Tech)
const config3: BillingConfig = {
  itemOnly: true,
  gstEnabled: true,
  gstRate: 18,
  serviceChargeEnabled: true,
  serviceChargeRate: 10,
  calculationBasis: "TAX_ON_SUBTOTAL",
};

const result3 = calculateOrderBill(items1, config3);
assert.strictEqual(result3.subtotal, 850, "Subtotal must equal 850");
assert.strictEqual(result3.gstAmount, 0, "Item-only mode must zero out GST");
assert.strictEqual(result3.serviceChargeAmount, 0, "Item-only mode must zero out service charge");
assert.strictEqual(result3.finalTotal, 850, "Total must match item subtotal only");
console.log("  ✅ Test 3 Passed: Item-Only policy correctly overrides any extraneous fees.");

// Test 4: Verifies that appliedConfigSnapshot is retained in output
assert.deepStrictEqual(result3.appliedConfigSnapshot, config3, "Snapshot must be saved with bill");
console.log("  ✅ Test 4 Passed: Applied config snapshot correctly captured for historical freeze.");

console.log("🎉 All Billing Engine Tests Passed!\n");
