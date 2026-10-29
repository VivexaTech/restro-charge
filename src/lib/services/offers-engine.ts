// ==============================================================================
// RESTROCHARGE - Authoritative Offers & Discount Engine
// Multi-Tenant Pricing, Day-Wise, Category, Festival/Event & Combo Calculations.
// Developed by Vivexa Tech. Evaluates strictly on server & in UI consistently.
// ==============================================================================

import {
  RestaurantOffer,
  ProductItem,
  ProductPortion,
  OrderItemSnapshot,
  ComboItemSnapshot,
  DayOfWeek,
} from "../types";

export interface OfferEvaluationDateInfo {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  dayOfWeek: DayOfWeek;
}

export interface EffectiveItemPriceResult {
  regularPrice: number;
  effectivePrice: number;
  discountAmount: number;
  hasOffer: boolean;
  appliedOffer?: RestaurantOffer;
}

export interface ComboValidationResult {
  isValid: boolean;
  error?: string;
  regularTotal: number;
  comboPrice: number;
  discountAmount: number;
  comboItemsSnapshot: ComboItemSnapshot[];
}

export interface OfferEligibilityContext {
  orderType?: "dine_in" | "takeaway" | "delivery";
  tableCode?: string;
  refDate?: Date;
  timeZone?: string;
}

export interface OfferValidationResult {
  isEligible: boolean;
  reason?: string;
  offer?: RestaurantOffer;
  effectivePrice?: number;
  regularPrice?: number;
  discountAmount?: number;
}

/**
 * Resolves current date, time, and day of week in the given IANA timezone (default: Asia/Kolkata).
 */
export function getZonedDateInfo(
  refDate: Date = new Date(),
  timeZone: string = "Asia/Kolkata"
): OfferEvaluationDateInfo {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(refDate);
    let year = "";
    let month = "";
    let day = "";
    let weekday = "";
    let hour = "";
    let minute = "";

    for (const part of parts) {
      if (part.type === "year") year = part.value;
      if (part.type === "month") month = part.value;
      if (part.type === "day") day = part.value;
      if (part.type === "weekday") weekday = part.value.toLowerCase();
      if (part.type === "hour") hour = part.value;
      if (part.type === "minute") minute = part.value;
    }

    // In case hour is '24', normalize to '00'
    if (hour === "24") hour = "00";

    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hour}:${minute}`,
      dayOfWeek: weekday as DayOfWeek,
    };
  } catch (err) {
    // Safe fallback if timezone is invalid
    const iso = refDate.toISOString();
    const days: DayOfWeek[] = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return {
      dateStr: iso.slice(0, 10),
      timeStr: iso.slice(11, 16),
      dayOfWeek: days[refDate.getDay()],
    };
  }
}

/**
 * Determines whether an offer is active and meets schedule/timing criteria.
 */
export function isOfferActive(
  offer: RestaurantOffer,
  dateInfo?: OfferEvaluationDateInfo,
  timeZone: string = "Asia/Kolkata",
  context?: OfferEligibilityContext
): boolean {
  if (offer.status !== "ACTIVE") {
    return false;
  }

  // Dine-in restriction check
  if (offer.dineInOnly && context) {
    if (context.orderType && context.orderType !== "dine_in") {
      return false;
    }
    if (context.tableCode !== undefined && !context.tableCode) {
      return false;
    }
  }

  const current =
    dateInfo || getZonedDateInfo(context?.refDate || new Date(), offer.timezone || timeZone);

  // 1. Date Range Validation
  if (offer.startDate && current.dateStr < offer.startDate) {
    return false;
  }
  if (offer.endDate && current.dateStr > offer.endDate) {
    return false;
  }

  // 2. Day of Week Validation
  if (offer.applicableDays && offer.applicableDays.length > 0) {
    const normalizedDays = offer.applicableDays.map((d) => d.toLowerCase());
    if (!normalizedDays.includes(current.dayOfWeek)) {
      return false;
    }
  }

  // 3. Time Window Validation (HH:mm)
  if (offer.startTime && offer.endTime) {
    if (offer.startTime <= offer.endTime) {
      // Normal daytime window e.g. 11:00 to 23:00
      if (current.timeStr < offer.startTime || current.timeStr > offer.endTime) {
        return false;
      }
    } else {
      // Overnight window e.g. 22:00 to 03:00
      const isAfterStart = current.timeStr >= offer.startTime;
      const isBeforeEnd = current.timeStr <= offer.endTime;
      if (!isAfterStart && !isBeforeEnd) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a specific product satisfies an offer's item or category eligibility.
 */
export function isProductEligibleForOffer(
  product: ProductItem,
  offer: RestaurantOffer
): boolean {
  if (offer.offerType === "COMBO") {
    return false; // Combos are distinct bundled offerings
  }

  // Direct item eligibility
  if (Array.isArray(offer.eligibleItemIds) && offer.eligibleItemIds.includes(product.id)) {
    return true;
  }

  // Whole category eligibility
  if (
    Array.isArray(offer.eligibleCategoryIds) &&
    offer.eligibleCategoryIds.includes(product.categoryId)
  ) {
    // If offer is specifically for veg items, ensure non-veg items are excluded
    if (
      offer.name.toLowerCase().includes("veg") &&
      !product.isVeg &&
      product.dietaryType !== "veg"
    ) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Shared, authoritative server-side & client-side offer validation function.
 * Validates offer existence, tenant isolation, active status, date/time/day schedule,
 * dine-in session restrictions, product and portion eligibility, and computes authoritative pricing.
 */
export function validateOfferEligibility(
  offer: RestaurantOffer | undefined,
  product?: ProductItem,
  portion?: ProductPortion,
  restaurantId?: string,
  context?: OfferEligibilityContext
): OfferValidationResult {
  if (!offer) {
    return { isEligible: false, reason: "Special offer does not exist or has been removed." };
  }

  if (restaurantId && offer.restaurantId !== restaurantId) {
    return {
      isEligible: false,
      reason: `Offer '${offer.name}' does not belong to this restaurant.`,
      offer,
    };
  }

  if (offer.status !== "ACTIVE") {
    return {
      isEligible: false,
      reason: `Offer '${offer.name}' is currently ${offer.status.toLowerCase()} and cannot be ordered.`,
      offer,
    };
  }

  // Timezone & current schedule resolution
  const timeZone = offer.timezone || context?.timeZone || "Asia/Kolkata";
  const refDate = context?.refDate || new Date();
  const dateInfo = getZonedDateInfo(refDate, timeZone);

  // Date range check
  if (offer.startDate && dateInfo.dateStr < offer.startDate) {
    return {
      isEligible: false,
      reason: `Offer '${offer.name}' begins on ${offer.startDate} and is not yet available.`,
      offer,
    };
  }
  if (offer.endDate && dateInfo.dateStr > offer.endDate) {
    return {
      isEligible: false,
      reason: `Offer '${offer.name}' expired on ${offer.endDate}.`,
      offer,
    };
  }

  // Day-of-week check (CRITICAL)
  if (offer.applicableDays && offer.applicableDays.length > 0) {
    const normalizedDays = offer.applicableDays.map((d) => d.toLowerCase());
    if (!normalizedDays.includes(dateInfo.dayOfWeek)) {
      const allowedDaysFormatted = offer.applicableDays
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
        .join(", ");
      const currentDayFormatted =
        dateInfo.dayOfWeek.charAt(0).toUpperCase() + dateInfo.dayOfWeek.slice(1);
      return {
        isEligible: false,
        reason: `Offer '${offer.name}' is only valid on ${allowedDaysFormatted}, but today is ${currentDayFormatted}.`,
        offer,
      };
    }
  }

  // Time window check
  if (offer.startTime && offer.endTime) {
    if (offer.startTime <= offer.endTime) {
      if (dateInfo.timeStr < offer.startTime || dateInfo.timeStr > offer.endTime) {
        return {
          isEligible: false,
          reason: `Offer '${offer.name}' is only valid between ${offer.startTime} and ${offer.endTime}.`,
          offer,
        };
      }
    } else {
      const isAfterStart = dateInfo.timeStr >= offer.startTime;
      const isBeforeEnd = dateInfo.timeStr <= offer.endTime;
      if (!isAfterStart && !isBeforeEnd) {
        return {
          isEligible: false,
          reason: `Offer '${offer.name}' is only valid between ${offer.startTime} and ${offer.endTime}.`,
          offer,
        };
      }
    }
  }

  // Dine-in only check
  if (offer.dineInOnly) {
    if (context?.orderType && context.orderType !== "dine_in") {
      return {
        isEligible: false,
        reason: `Offer '${offer.name}' is valid for dine-in orders only.`,
        offer,
      };
    }
    if (context?.tableCode !== undefined && !context.tableCode) {
      return {
        isEligible: false,
        reason: `Offer '${offer.name}' requires a valid dine-in table session.`,
        offer,
      };
    }
  }

  // Product eligibility (if a product is being ordered under this offer)
  if (product) {
    if (restaurantId && product.restaurantId !== restaurantId) {
      return {
        isEligible: false,
        reason: `Product '${product.name}' does not belong to this restaurant.`,
        offer,
      };
    }

    if (!product.isAvailable) {
      return {
        isEligible: false,
        reason: `Item '${product.name}' is currently sold out.`,
        offer,
      };
    }

    if (!isProductEligibleForOffer(product, offer)) {
      return {
        isEligible: false,
        reason: `Item '${product.name}' is not eligible for '${offer.name}'.`,
        offer,
      };
    }

    if (portion) {
      if (!portion.isAvailable) {
        return {
          isEligible: false,
          reason: `Portion '${portion.name}' for '${product.name}' is out of stock.`,
          offer,
        };
      }
    }

    const regularPrice = portion ? portion.price : product.price;
    const { effectivePrice, discountAmount } = calculateDiscountForOffer(regularPrice, offer);

    return {
      isEligible: true,
      offer,
      regularPrice,
      effectivePrice,
      discountAmount,
    };
  }

  return {
    isEligible: true,
    offer,
  };
}

/**
 * Calculates the discounted price of a single item given a single eligible offer.
 */
export function calculateDiscountForOffer(
  regularPrice: number,
  offer: RestaurantOffer
): { effectivePrice: number; discountAmount: number } {
  if (regularPrice <= 0) {
    return { effectivePrice: 0, discountAmount: 0 };
  }

  let effective = regularPrice;
  let discount = 0;

  switch (offer.discountMethod) {
    case "FIXED_PRICE": {
      const fixedTarget = Math.max(0, offer.discountValue);
      // Fixed price should not make an item more expensive than regular price
      effective = Math.min(regularPrice, fixedTarget);
      discount = Math.max(0, regularPrice - effective);
      break;
    }

    case "PERCENTAGE": {
      const pct = Math.min(100, Math.max(0, offer.discountValue));
      discount = Math.round(regularPrice * (pct / 100) * 100) / 100;
      effective = Math.max(0, Math.round((regularPrice - discount) * 100) / 100);
      break;
    }

    case "FIXED_AMOUNT": {
      discount = Math.min(regularPrice, Math.max(0, offer.discountValue));
      effective = Math.max(0, Math.round((regularPrice - discount) * 100) / 100);
      break;
    }

    default:
      effective = regularPrice;
      discount = 0;
  }

  return {
    effectivePrice: Math.round(effective * 100) / 100,
    discountAmount: Math.round(discount * 100) / 100,
  };
}

/**
 * Evaluates all active offers and resolves the single best effective price for a product.
 * Enforces deterministic conflict resolution:
 * 1. Higher priority wins
 * 2. Higher discount amount wins (lowest customer price)
 * 3. Item-specific offer wins over category-only offer
 * 4. Most recently updated/created offer wins
 */
export function resolveBestOfferForItem(
  product: ProductItem,
  portion: ProductPortion | undefined,
  offers: RestaurantOffer[],
  dateInfo?: OfferEvaluationDateInfo,
  timeZone: string = "Asia/Kolkata",
  context?: OfferEligibilityContext
): EffectiveItemPriceResult {
  const regularPrice = portion ? portion.price : product.price;

  // Filter valid, eligible offers for this product
  const eligibleOffers = offers.filter((offer) => {
    return (
      offer.restaurantId === product.restaurantId &&
      offer.offerType !== "COMBO" &&
      isOfferActive(offer, dateInfo, timeZone, context) &&
      isProductEligibleForOffer(product, offer)
    );
  });

  if (eligibleOffers.length === 0) {
    return {
      regularPrice,
      effectivePrice: regularPrice,
      discountAmount: 0,
      hasOffer: false,
    };
  }

  // Calculate potential discount for each candidate offer
  const evaluated = eligibleOffers.map((offer) => {
    const { effectivePrice, discountAmount } = calculateDiscountForOffer(regularPrice, offer);
    const isDirectItem = Boolean(
      offer.eligibleItemIds && offer.eligibleItemIds.includes(product.id)
    );
    return {
      offer,
      effectivePrice,
      discountAmount,
      isDirectItem,
      priority: offer.priority || 1,
      createdAt: offer.createdAt || "",
    };
  });

  // Sort by priority DESC, discountAmount DESC, isDirectItem DESC, createdAt DESC
  evaluated.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.discountAmount !== a.discountAmount) return b.discountAmount - a.discountAmount;
    if (a.isDirectItem !== b.isDirectItem) return a.isDirectItem ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const best = evaluated[0];

  return {
    regularPrice,
    effectivePrice: best.effectivePrice,
    discountAmount: best.discountAmount,
    hasOffer: best.discountAmount > 0,
    appliedOffer: best.discountAmount > 0 ? best.offer : undefined,
  };
}

/**
 * Validates a Combo Offer against available menu products and computes its pricing breakdown.
 */
export function validateAndEvaluateCombo(
  comboOffer: RestaurantOffer,
  restaurantProducts: ProductItem[],
  dateInfo?: OfferEvaluationDateInfo,
  timeZone: string = "Asia/Kolkata"
): ComboValidationResult {
  if (comboOffer.offerType !== "COMBO") {
    return {
      isValid: false,
      error: `'${comboOffer.name}' is not configured as a combo offer.`,
      regularTotal: 0,
      comboPrice: 0,
      discountAmount: 0,
      comboItemsSnapshot: [],
    };
  }

  if (!isOfferActive(comboOffer, dateInfo, timeZone)) {
    return {
      isValid: false,
      error: `Combo offer '${comboOffer.name}' is currently inactive or expired.`,
      regularTotal: 0,
      comboPrice: 0,
      discountAmount: 0,
      comboItemsSnapshot: [],
    };
  }

  if (!comboOffer.comboItems || comboOffer.comboItems.length === 0) {
    return {
      isValid: false,
      error: `Combo '${comboOffer.name}' has no configured items.`,
      regularTotal: 0,
      comboPrice: 0,
      discountAmount: 0,
      comboItemsSnapshot: [],
    };
  }

  let regularTotal = 0;
  const snapshots: ComboItemSnapshot[] = [];

  for (const config of comboOffer.comboItems) {
    const prod = restaurantProducts.find(
      (p) => p.id === config.productId && p.restaurantId === comboOffer.restaurantId
    );

    if (!prod) {
      return {
        isValid: false,
        error: `A product included in '${comboOffer.name}' is no longer on the menu.`,
        regularTotal: 0,
        comboPrice: 0,
        discountAmount: 0,
        comboItemsSnapshot: [],
      };
    }

    if (!prod.isAvailable) {
      return {
        isValid: false,
        error: `Item '${prod.name}' in combo '${comboOffer.name}' is currently sold out.`,
        regularTotal: 0,
        comboPrice: 0,
        discountAmount: 0,
        comboItemsSnapshot: [],
      };
    }

    let unitPrice = prod.price;
    let portionName: string | undefined;

    if (config.portionId && prod.portions && prod.portions.length > 0) {
      const portion = prod.portions.find((p) => p.id === config.portionId);
      if (!portion) {
        return {
          isValid: false,
          error: `Portion '${config.portionId}' for '${prod.name}' in combo is not valid.`,
          regularTotal: 0,
          comboPrice: 0,
          discountAmount: 0,
          comboItemsSnapshot: [],
        };
      }
      if (!portion.isAvailable) {
        return {
          isValid: false,
          error: `Portion '${portion.name}' for '${prod.name}' in combo is out of stock.`,
          regularTotal: 0,
          comboPrice: 0,
          discountAmount: 0,
          comboItemsSnapshot: [],
        };
      }
      unitPrice = portion.price;
      portionName = portion.name;
    }

    const qty = Math.max(1, config.quantity || 1);
    regularTotal += unitPrice * qty;

    snapshots.push({
      productId: prod.id,
      productName: portionName ? `${prod.name} (${portionName})` : prod.name,
      quantity: qty,
      portionId: config.portionId,
      portionName,
    });
  }

  const comboPrice = Math.max(0, comboOffer.comboPrice ?? 0);
  const discountAmount = Math.max(0, Math.round((regularTotal - comboPrice) * 100) / 100);

  return {
    isValid: true,
    regularTotal: Math.round(regularTotal * 100) / 100,
    comboPrice: Math.round(comboPrice * 100) / 100,
    discountAmount,
    comboItemsSnapshot: snapshots,
  };
}

/**
 * Evaluates an entire list of menu products against active offers,
 * returning augmented products with active offer pricing details for UI rendering.
 */
export function augmentProductsWithOffers(
  products: ProductItem[],
  offers: RestaurantOffer[],
  dateInfo?: OfferEvaluationDateInfo,
  timeZone: string = "Asia/Kolkata"
): Array<
  ProductItem & {
    hasOffer: boolean;
    effectivePrice: number;
    discountAmount: number;
    appliedOfferName?: string;
    appliedOfferType?: string;
  }
> {
  return products.map((prod) => {
    const result = resolveBestOfferForItem(prod, undefined, offers, dateInfo, timeZone);
    return {
      ...prod,
      hasOffer: result.hasOffer,
      effectivePrice: result.effectivePrice,
      discountAmount: result.discountAmount,
      appliedOfferName: result.appliedOffer?.name,
      appliedOfferType: result.appliedOffer?.offerType,
    };
  });
}
