// ==============================================================================
// RESTROCHARGE - Geolocation Security & Distance Engine
// Server-authoritative distance calculation and boundary enforcement
// Using standard Haversine spherical distance formula
// ==============================================================================

import { RestaurantLocationSettings } from "@/lib/types";

/**
 * Standard GPS boundary tolerance in metres to accommodate minor device GPS jitter
 * and indoor multipath reflection near the perimeter.
 * Intentionally limited to 15 metres to prevent radius circumvention.
 */
export const GPS_BOUNDARY_TOLERANCE_METRES = 15;

/**
 * Maximum acceptable device GPS accuracy in metres.
 * If the device reports accuracy coarser than this (e.g. 150m cell-tower approximation),
 * access is flagged or rejected when close to the boundary to prevent false positives.
 */
export const MAX_RELIABLE_ACCURACY_METRES = 100;

/**
 * Calculates standard great-circle distance between two coordinates in metres
 * using the Haversine formula on Earth's mean radius (6,371,000 metres).
 */
export function calculateHaversineDistanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth mean radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Validates geographic latitude and longitude bounds.
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Validates permitted ordering radius (10 metres to 50,000 metres).
 */
export function isValidRadius(radius: unknown): boolean {
  if (typeof radius !== "number" || !Number.isFinite(radius)) return false;
  return radius >= 10 && radius <= 50000;
}

export type LocationVerificationCode =
  | "WITHIN_RADIUS"
  | "OUTSIDE_RADIUS"
  | "ACCURACY_TOO_POOR"
  | "RESTRICTION_DISABLED"
  | "NOT_CONFIGURED"
  | "INVALID_COORDINATES"
  | "SIMULATION_FORBIDDEN_IN_PRODUCTION";

export interface LocationVerificationResult {
  allowed: boolean;
  distanceMetres: number;
  configuredRadiusMetres: number;
  accuracyMetres?: number;
  effectiveRadiusMetres: number;
  reasonCode: LocationVerificationCode;
  message: string;
}

/**
 * Detects if reported location has desktop/ISP network approximation (accuracy > 1000m).
 * Typical of wired desktop browsers and laptops without GPS hardware.
 */
export function isDesktopCoarseLocation(accuracy?: number | null): boolean {
  return typeof accuracy === "number" && accuracy > 1000;
}

/**
 * Verifies if customer coordinates satisfy the restaurant's authorized ordering boundary.
 * Authoritative: Restaurant location settings MUST come from trusted server database.
 */
export function verifyCustomerProximity(params: {
  customerLat?: number | null;
  customerLon?: number | null;
  customerAccuracy?: number | null;
  locationSettings?: RestaurantLocationSettings | null;
}): LocationVerificationResult {
  const { customerLat, customerLon, customerAccuracy, locationSettings } = params;

  // Case 1: Location restriction explicitly disabled by Vivexa Tech
  if (!locationSettings || !locationSettings.locationRestrictionEnabled) {
    return {
      allowed: true,
      distanceMetres: 0,
      configuredRadiusMetres: locationSettings?.orderingRadiusMetres || 100,
      effectiveRadiusMetres: locationSettings?.orderingRadiusMetres || 100,
      reasonCode: "RESTRICTION_DISABLED",
      message: "Location restriction is not enforced for this restaurant.",
    };
  }

  // Case 2: Restriction is enabled, but Vivexa Tech has not configured coordinates yet
  if (
    !locationSettings.isConfigured ||
    locationSettings.latitude === null ||
    locationSettings.latitude === undefined ||
    locationSettings.longitude === null ||
    locationSettings.longitude === undefined
  ) {
    return {
      allowed: false,
      distanceMetres: -1,
      configuredRadiusMetres: locationSettings.orderingRadiusMetres,
      effectiveRadiusMetres: locationSettings.orderingRadiusMetres,
      reasonCode: "NOT_CONFIGURED",
      message:
        "Location-restricted ordering has not yet been configured by Vivexa Tech for this restaurant. Please contact restaurant staff.",
    };
  }

  // Case 3: Customer supplied invalid or missing coordinates
  if (
    customerLat === null ||
    customerLat === undefined ||
    customerLon === null ||
    customerLon === undefined ||
    !isValidCoordinate(customerLat, customerLon)
  ) {
    return {
      allowed: false,
      distanceMetres: -1,
      configuredRadiusMetres: locationSettings.orderingRadiusMetres,
      effectiveRadiusMetres: locationSettings.orderingRadiusMetres,
      reasonCode: "INVALID_COORDINATES",
      message:
        "Location permission is required to order from this table. Please allow location access in your browser.",
    };
  }

  // Calculate authoritative distance via Haversine
  const distance = calculateHaversineDistanceMetres(
    customerLat,
    customerLon,
    locationSettings.latitude,
    locationSettings.longitude
  );

  const configuredRadius = locationSettings.orderingRadiusMetres;
  const effectiveRadius = configuredRadius + GPS_BOUNDARY_TOLERANCE_METRES;

  // Check if device accuracy is too poor to reliably confirm presence at this venue
  // If accuracy error circle is larger than the restaurant radius, or if accuracy exceeds 100m near the perimeter
  if (
    typeof customerAccuracy === "number" &&
    customerAccuracy > MAX_RELIABLE_ACCURACY_METRES &&
    (customerAccuracy > configuredRadius || distance > configuredRadius * 0.7)
  ) {
    const isDesktop = customerAccuracy > 1000;
    const formattedAcc = isDesktop
      ? `${Math.round(customerAccuracy / 1000)}km`
      : `${Math.round(customerAccuracy)}m`;

    return {
      allowed: false,
      distanceMetres: distance,
      configuredRadiusMetres: configuredRadius,
      accuracyMetres: customerAccuracy,
      effectiveRadiusMetres: effectiveRadius,
      reasonCode: "ACCURACY_TOO_POOR",
      message: isDesktop
        ? `Your browser provided an approximate desktop location (accuracy ±${formattedAcc}) which is insufficient to confirm table presence. Please open this QR order on a mobile device with GPS enabled.`
        : `Your device location accuracy (±${formattedAcc}) is too coarse for table verification (requires ±${MAX_RELIABLE_ACCURACY_METRES}m). Please enable high-accuracy GPS or connect to restaurant Wi-Fi and retry.`,
    };
  }

  // Case 4: Within permitted radius
  if (distance <= effectiveRadius) {
    return {
      allowed: true,
      distanceMetres: distance,
      configuredRadiusMetres: configuredRadius,
      accuracyMetres: customerAccuracy ?? undefined,
      effectiveRadiusMetres: effectiveRadius,
      reasonCode: "WITHIN_RADIUS",
      message: "You're at the restaurant. You can place your order now.",
    };
  }

  // Case 5: Outside permitted radius
  return {
    allowed: false,
    distanceMetres: distance,
    configuredRadiusMetres: configuredRadius,
    accuracyMetres: customerAccuracy ?? undefined,
    effectiveRadiusMetres: effectiveRadius,
    reasonCode: "OUTSIDE_RADIUS",
    message: `You're outside this restaurant's ordering area (${distance}m away, permitted within ${configuredRadius}m). Please move closer to the restaurant to place your order.`,
  };
}
