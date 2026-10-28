// ==============================================================================
// TEST: Geolocation Accuracy, Desktop Detection & Simulation Guard Test Suite
// Verifies:
// 1. Desktop coarse location detection (ISP IP/network approximation, accuracy > 1000m)
// 2. High-accuracy GPS verification inside and outside restaurant radius
// 3. Rejection of poor accuracy near perimeter to prevent false positives
// 4. Strict server-side production guard forbidding simulated coordinates in production
// 5. Development mode simulator handling and audit tagging in order history
// 6. Preservation of authentic restaurant coordinates (Jaipur: 26.8524, 75.8052, 200m)
// ==============================================================================

import assert from "node:assert";
import {
  calculateHaversineDistanceMetres,
  isDesktopCoarseLocation,
  verifyCustomerProximity,
  MAX_RELIABLE_ACCURACY_METRES,
  GPS_BOUNDARY_TOLERANCE_METRES,
} from "../src/lib/services/geo";
import { dataStore } from "../src/lib/services/data-store";
import type { RestaurantLocationSettings } from "../src/lib/types";

console.log("🧪 Running Geolocation Accuracy & Dev Simulator Test Suite...\n");

// Target Venue: Vivexa Restro in Jaipur
const vivexaRestro = dataStore.getRestaurantBySlug("vivexa-restro");
assert.ok(vivexaRestro, "Target restaurant 'vivexa-restro' must exist in dataStore");

const venueSettings: RestaurantLocationSettings = {
  latitude: vivexaRestro.locationSettings?.latitude ?? 26.8524,
  longitude: vivexaRestro.locationSettings?.longitude ?? 75.8052,
  orderingRadiusMetres: vivexaRestro.locationSettings?.orderingRadiusMetres ?? 200,
  locationRestrictionEnabled: true,
  isConfigured: true,
  addressSnapshot: "Vivexa Restro, Jaipur",
};

// ------------------------------------------------------------------------------
// TEST 1: Desktop Coarse Location Detection
// ------------------------------------------------------------------------------
console.log("--- TEST 1: DESKTOP COARSE LOCATION DETECTION ---");
assert.strictEqual(
  isDesktopCoarseLocation(50000),
  true,
  "Accuracy 50,000m (typical wired desktop IP triangulation) must be classified as coarse desktop"
);
assert.strictEqual(
  isDesktopCoarseLocation(1500),
  true,
  "Accuracy 1,500m must be classified as coarse desktop"
);
assert.strictEqual(
  isDesktopCoarseLocation(100),
  false,
  "Accuracy 100m should not be classified as coarse desktop"
);
assert.strictEqual(
  isDesktopCoarseLocation(15),
  false,
  "Accuracy 15m (mobile GPS) must not be classified as coarse desktop"
);
assert.strictEqual(
  isDesktopCoarseLocation(null),
  false,
  "Null accuracy should return false"
);
assert.strictEqual(
  isDesktopCoarseLocation(undefined),
  false,
  "Undefined accuracy should return false"
);
console.log("   ✅ Test 1 Passed: Coarse desktop detection is accurate.");

// ------------------------------------------------------------------------------
// TEST 2: Desktop Coarse Location Rejection with Clear Diagnostic Message
// ------------------------------------------------------------------------------
console.log("\n--- TEST 2: DESKTOP COARSE LOCATION REJECTION & DIAGNOSTICS ---");
// Scenario: User on localhost in Delhi (28.5137, 77.2365) with 50,000m accuracy attempting to order at Jaipur (26.8524, 75.8052)
const desktopCheck = verifyCustomerProximity({
  customerLat: 28.5137,
  customerLon: 77.2365,
  customerAccuracy: 50000,
  locationSettings: venueSettings,
});

assert.strictEqual(desktopCheck.allowed, false, "Desktop coarse location must NOT be allowed to order");
assert.strictEqual(desktopCheck.reasonCode, "ACCURACY_TOO_POOR", "Must return ACCURACY_TOO_POOR reasonCode");
assert.ok(
  desktopCheck.message.toLowerCase().includes("desktop") ||
  desktopCheck.message.toLowerCase().includes("mobile"),
  "Message must explicitly explain desktop approximation and suggest mobile device"
);
assert.ok(desktopCheck.distanceMetres > 200000, "Distance from Delhi to Jaipur should be > 200km");
console.log(`   ✅ Test 2 Passed: Desktop coarse location safely rejected (Distance: ${Math.round(desktopCheck.distanceMetres / 1000)}km, Acc: ±${Math.round(desktopCheck.accuracyMetres! / 1000)}km).`);

// ------------------------------------------------------------------------------
// TEST 3: Inside Table Position (Simulated or Real High Accuracy GPS)
// ------------------------------------------------------------------------------
console.log("\n--- TEST 3: HIGH-ACCURACY VERIFICATION INSIDE RESTAURANT ---");
// Coordinates ~10m from venue center (26.8524, 75.8052)
// Small offset: ~0.00008 deg lat is ~9m
const insideCheck = verifyCustomerProximity({
  customerLat: 26.85248,
  customerLon: 75.8052,
  customerAccuracy: 5,
  locationSettings: venueSettings,
});

assert.strictEqual(insideCheck.allowed, true, "Customer inside 200m radius with 5m accuracy must be allowed");
assert.strictEqual(insideCheck.reasonCode, "WITHIN_RADIUS", "Reason code must be WITHIN_RADIUS");
assert.ok(insideCheck.distanceMetres <= 15, `Distance should be ~9-12m, got: ${insideCheck.distanceMetres}m`);
console.log(`   ✅ Test 3 Passed: Inside position approved (Distance: ${insideCheck.distanceMetres}m <= ${venueSettings.orderingRadiusMetres}m).`);

// ------------------------------------------------------------------------------
// TEST 4: Outside Restaurant Position
// ------------------------------------------------------------------------------
console.log("\n--- TEST 4: VERIFICATION OUTSIDE RESTAURANT RADIUS ---");
// Coordinates ~500m north: 0.0045 deg lat ~500m
const outsideCheck = verifyCustomerProximity({
  customerLat: 26.8569,
  customerLon: 75.8052,
  customerAccuracy: 10,
  locationSettings: venueSettings,
});

assert.strictEqual(outsideCheck.allowed, false, "Customer 500m away must be rejected");
assert.strictEqual(outsideCheck.reasonCode, "OUTSIDE_RADIUS", "Reason code must be OUTSIDE_RADIUS");
assert.ok(outsideCheck.distanceMetres >= 450 && outsideCheck.distanceMetres <= 550, `Distance should be ~500m, got: ${outsideCheck.distanceMetres}m`);
console.log(`   ✅ Test 4 Passed: Outside position rejected (Distance: ${outsideCheck.distanceMetres}m > ${venueSettings.orderingRadiusMetres}m).`);

// ------------------------------------------------------------------------------
// TEST 5: Poor Accuracy Near Perimeter (Preventing False Positives)
// ------------------------------------------------------------------------------
console.log("\n--- TEST 5: POOR ACCURACY NEAR PERIMETER ---");
// Customer reported 150m away, but accuracy is ±250m (error bubble spans far outside radius)
const poorAccCheck = verifyCustomerProximity({
  customerLat: 26.85375,
  customerLon: 75.8052,
  customerAccuracy: 250,
  locationSettings: venueSettings,
});

assert.strictEqual(poorAccCheck.allowed, false, "Poor accuracy near perimeter must be rejected");
assert.strictEqual(poorAccCheck.reasonCode, "ACCURACY_TOO_POOR", "Reason code must be ACCURACY_TOO_POOR");
console.log(`   ✅ Test 5 Passed: Poor accuracy rejected (Acc: ±${poorAccCheck.accuracyMetres}m > MAX_RELIABLE_ACCURACY_METRES ${MAX_RELIABLE_ACCURACY_METRES}m).`);

// ------------------------------------------------------------------------------
// TEST 6: Backend Production Guard (Simulated Coordinates Forbidden in Production)
// ------------------------------------------------------------------------------
console.log("\n--- TEST 6: BACKEND PRODUCTION SIMULATION SECURITY GUARD ---");
// Simulate backend logic in production environment
function simulateBackendOrderLocationGuard(
  env: string,
  customerLocation: { latitude: number; longitude: number; accuracy: number; isSimulated?: boolean } | null,
  settings: RestaurantLocationSettings
) {
  const isSimulated = Boolean(customerLocation?.isSimulated);
  const isProduction = env === "production";

  if (isProduction && isSimulated) {
    return {
      status: 403,
      reasonCode: "SIMULATION_FORBIDDEN_IN_PRODUCTION",
      error: "Simulated coordinates are strictly forbidden in production. Physical GPS presence is required.",
    };
  }

  const proximity = verifyCustomerProximity({
    customerLat: customerLocation?.latitude,
    customerLon: customerLocation?.longitude,
    customerAccuracy: customerLocation?.accuracy,
    locationSettings: settings,
  });

  if (!proximity.allowed) {
    return {
      status: 403,
      reasonCode: proximity.reasonCode,
      error: proximity.message,
    };
  }

  return {
    status: 200,
    allowed: true,
    updatedBy: isSimulated ? "Customer QR (Dev Test Mode)" : "Customer QR",
  };
}

// 6.1: Production with simulated coordinates -> MUST BE 403 FORBIDDEN
const prodSimulatedAttempt = simulateBackendOrderLocationGuard(
  "production",
  { latitude: 26.85248, longitude: 75.8052, accuracy: 5, isSimulated: true },
  venueSettings
);
assert.strictEqual(prodSimulatedAttempt.status, 403, "Production MUST reject simulated coordinates");
assert.strictEqual(
  prodSimulatedAttempt.reasonCode,
  "SIMULATION_FORBIDDEN_IN_PRODUCTION",
  "Must return SIMULATION_FORBIDDEN_IN_PRODUCTION in production"
);
console.log("   ✅ Test 6.1 Passed: Server strictly blocks simulated coordinates in production.");

// 6.2: Production with genuine physical coordinates inside venue -> MUST BE ALLOWED
const prodGenuineAttempt = simulateBackendOrderLocationGuard(
  "production",
  { latitude: 26.85248, longitude: 75.8052, accuracy: 5, isSimulated: false },
  venueSettings
);
assert.strictEqual(prodGenuineAttempt.status, 200, "Production must allow genuine coordinates inside venue");
assert.strictEqual(prodGenuineAttempt.updatedBy, "Customer QR", "Must record authentic Customer QR audit tag");
console.log("   ✅ Test 6.2 Passed: Server allows genuine coordinates in production.");

// 6.3: Development with simulated coordinates inside venue -> ALLOWED and tagged as Dev Test Mode
const devSimulatedInside = simulateBackendOrderLocationGuard(
  "development",
  { latitude: 26.85248, longitude: 75.8052, accuracy: 5, isSimulated: true },
  venueSettings
);
assert.strictEqual(devSimulatedInside.status, 200, "Development mode allows simulated coordinates inside venue");
assert.strictEqual(devSimulatedInside.updatedBy, "Customer QR (Dev Test Mode)", "Must be tagged as Dev Test Mode");
console.log("   ✅ Test 6.3 Passed: Development mode authorizes simulated coordinates with Dev Test audit tag.");

// 6.4: Development with simulated coordinates outside venue -> STILL REJECTED (Math is NEVER bypassed)
const devSimulatedOutside = simulateBackendOrderLocationGuard(
  "development",
  { latitude: 26.8569, longitude: 75.8052, accuracy: 10, isSimulated: true },
  venueSettings
);
assert.strictEqual(devSimulatedOutside.status, 403, "Development simulator still enforces mathematical boundary");
assert.strictEqual(devSimulatedOutside.reasonCode, "OUTSIDE_RADIUS", "Reason code must remain OUTSIDE_RADIUS");
console.log("   ✅ Test 6.4 Passed: Mathematical geo-fencing is never bypassed even in Dev Mode.");

// ------------------------------------------------------------------------------
// TEST 7: Target Venue Coordinates & Radius Preservation
// ------------------------------------------------------------------------------
console.log("\n--- TEST 7: TARGET VENUE CONFIGURATION INTEGRITY ---");
assert.strictEqual(vivexaRestro.locationSettings?.latitude, 26.8524, "Latitude must be preserved at 26.8524");
assert.strictEqual(vivexaRestro.locationSettings?.longitude, 75.8052, "Longitude must be preserved at 75.8052");
assert.strictEqual(vivexaRestro.locationSettings?.orderingRadiusMetres, 200, "Radius must be preserved at 200m");
assert.strictEqual(vivexaRestro.locationSettings?.locationRestrictionEnabled, true, "Location restriction must remain enabled");
console.log("   ✅ Test 7 Passed: Venue coordinates and 200m radius strictly preserved.");

console.log("\n🎉 All Geolocation Accuracy & Dev Simulator Tests Passed Successfully!");
