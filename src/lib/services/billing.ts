// ==============================================================================
// RESTROCHARGE - Central Billing & Taxation Engine
// Strictly calculates on trusted backend. Never trusts client totals.
// ==============================================================================

import type { BillingConfig, OrderBillingBreakdown, OrderItemSnapshot } from "../types";

export function calculateOrderBill(
  items: OrderItemSnapshot[],
  config?: BillingConfig | null
): OrderBillingBreakdown {
  // Safe default configuration if none specified
  const effectiveConfig: BillingConfig = config || {
    itemOnly: false,
    gstEnabled: true,
    gstRate: 5, // Default 5% restaurant GST in India
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    calculationBasis: "TAX_ON_SUBTOTAL",
  };

  // 1. Calculate raw items subtotal
  const subtotal = items.reduce((acc, item) => {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const price = Math.max(0, item.price || 0);
    return acc + price * qty;
  }, 0);

  // If itemOnly is enforced by Vivexa Tech for this restaurant
  if (effectiveConfig.itemOnly) {
    return {
      subtotal: roundTo2(subtotal),
      gstEnabled: false,
      gstRate: 0,
      gstAmount: 0,
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
      serviceChargeAmount: 0,
      additionalChargesAmount: 0,
      finalTotal: roundTo2(subtotal),
      appliedConfigSnapshot: effectiveConfig,
    };
  }

  // 2. Service Charge Calculation (if enabled)
  let serviceChargeAmount = 0;
  if (effectiveConfig.serviceChargeEnabled && effectiveConfig.serviceChargeRate > 0) {
    serviceChargeAmount = subtotal * (effectiveConfig.serviceChargeRate / 100);
  }

  // 3. Additional fixed/percentage charges
  let additionalChargesAmount = 0;
  if (effectiveConfig.additionalCharges && effectiveConfig.additionalCharges.length > 0) {
    for (const charge of effectiveConfig.additionalCharges) {
      if (charge.type === "PERCENTAGE") {
        additionalChargesAmount += subtotal * (charge.amount / 100);
      } else {
        additionalChargesAmount += charge.amount;
      }
    }
  }

  // 4. GST / Taxes Calculation based on calculation basis
  let gstAmount = 0;
  if (effectiveConfig.gstEnabled && effectiveConfig.gstRate > 0) {
    if (effectiveConfig.calculationBasis === "TAX_ON_SUBTOTAL_PLUS_SERVICE") {
      gstAmount = (subtotal + serviceChargeAmount) * (effectiveConfig.gstRate / 100);
    } else {
      gstAmount = subtotal * (effectiveConfig.gstRate / 100);
    }
  }

  // 5. Final Total
  const finalTotal = subtotal + serviceChargeAmount + additionalChargesAmount + gstAmount;

  return {
    subtotal: roundTo2(subtotal),
    gstEnabled: effectiveConfig.gstEnabled,
    gstRate: effectiveConfig.gstRate,
    gstAmount: roundTo2(gstAmount),
    serviceChargeEnabled: effectiveConfig.serviceChargeEnabled,
    serviceChargeRate: effectiveConfig.serviceChargeRate,
    serviceChargeAmount: roundTo2(serviceChargeAmount),
    additionalChargesAmount: roundTo2(additionalChargesAmount),
    finalTotal: roundTo2(finalTotal),
    appliedConfigSnapshot: effectiveConfig,
  };
}

function roundTo2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
