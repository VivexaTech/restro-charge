// ==============================================================================
// TEST: RestroCharge Enhancements Test Suite
// Verifies:
// 1. Location-Restricted Restaurant QR Ordering & Server-Side Geo-Fencing
// 2. Removal of Quick Switch Bar from Public Interface
// 3. Independent Restaurant Websites (Home, Menu, About) & Dynamic XML Sitemaps
// ==============================================================================

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  calculateHaversineDistanceMetres,
  isValidCoordinate,
  isValidRadius,
  verifyCustomerProximity,
  GPS_BOUNDARY_TOLERANCE_METRES,
} from "../src/lib/services/geo";
import { dataStore } from "../src/lib/services/data-store";
import { getSubscriptionAccess } from "../src/lib/services/subscription";
import type { RestaurantLocationSettings, RestaurantProfile } from "../src/lib/types";

console.log("🧪 Running RestroCharge Enhancements Test Suite...\n");

// ------------------------------------------------------------------------------
// FEATURE 1: Geolocation Security & Distance Calculations
// ------------------------------------------------------------------------------
console.log("--- FEATURE 1: LOCATION-RESTRICTED QR ORDERING ---");

// Test 1.1: Haversine distance accuracy
console.log("1.1 Testing Haversine distance calculation...");
// Connaught Place, New Delhi (28.6315, 77.2167) to India Gate (28.6129, 77.2295)
const cpToIndiaGate = calculateHaversineDistanceMetres(28.6315, 77.2167, 28.6129, 77.2295);
// Actual distance is approx 2.4 km (2300 - 2500 metres)
assert.ok(
  cpToIndiaGate >= 2300 && cpToIndiaGate <= 2500,
  `Distance between CP and India Gate should be ~2.4km, got: ${cpToIndiaGate}m`
);

// Zero distance (same coordinate)
const zeroDist = calculateHaversineDistanceMetres(28.6315, 77.2167, 28.6315, 77.2167);
assert.strictEqual(zeroDist, 0, "Distance to self should be 0 metres");

// Close proximity (~30 metres)
const closeDist = calculateHaversineDistanceMetres(28.6315, 77.2167, 28.63175, 77.2167);
assert.ok(closeDist >= 25 && closeDist <= 35, `Close distance should be ~28m, got: ${closeDist}m`);
console.log("   ✅ Test 1.1 Passed: Haversine distance calculation is mathematically verified.");

// Test 1.2: Coordinate & Radius Validation
console.log("\n1.2 Testing Coordinate & Radius boundary validation...");
assert.strictEqual(isValidCoordinate(28.6315, 77.2167), true, "Valid Delhi coordinates");
assert.strictEqual(isValidCoordinate(91.0, 77.2167), false, "Latitude > 90 must fail");
assert.strictEqual(isValidCoordinate(-91.0, 77.2167), false, "Latitude < -90 must fail");
assert.strictEqual(isValidCoordinate(28.6315, 185.0), false, "Longitude > 180 must fail");
assert.strictEqual(isValidCoordinate("28.6315" as any, 77.2167), false, "Non-number lat must fail");
assert.strictEqual(isValidCoordinate(NaN, 77.2167), false, "NaN must fail");

assert.strictEqual(isValidRadius(100), true, "100m radius valid");
assert.strictEqual(isValidRadius(5), false, "Radius < 10m must fail");
assert.strictEqual(isValidRadius(60000), false, "Radius > 50,000m must fail");
console.log("   ✅ Test 1.2 Passed: Coordinate and radius bounds strictly validated.");

// Test 1.3: Proximity Enforcement Scenarios
console.log("\n1.3 Testing Customer Proximity Enforcement Scenarios...");
const configuredVenue: RestaurantLocationSettings = {
  latitude: 28.6315,
  longitude: 77.2167,
  orderingRadiusMetres: 100,
  locationRestrictionEnabled: true,
  isConfigured: true,
  addressSnapshot: "Connaught Place, New Delhi",
};

// Scenario A: Customer within 30m of venue (Inside permitted 100m radius)
const insideCheck = verifyCustomerProximity({
  customerLat: 28.6317,
  customerLon: 77.2167, // ~22m away
  locationSettings: configuredVenue,
});
assert.strictEqual(insideCheck.allowed, true);
assert.strictEqual(insideCheck.reasonCode, "WITHIN_RADIUS");
assert.ok(insideCheck.distanceMetres <= 50);

// Scenario B: Customer 400m away (Outside radius)
const outsideCheck = verifyCustomerProximity({
  customerLat: 28.6355,
  customerLon: 77.2167, // ~440m away
  locationSettings: configuredVenue,
});
assert.strictEqual(outsideCheck.allowed, false);
assert.strictEqual(outsideCheck.reasonCode, "OUTSIDE_RADIUS");
assert.ok(outsideCheck.distanceMetres > 100);

// Scenario C: Customer near boundary within 15m tolerance (e.g. 108m away with 15m tolerance)
const boundaryCheck = verifyCustomerProximity({
  customerLat: 28.6324,
  customerLon: 77.2167, // ~100m away
  locationSettings: configuredVenue,
});
assert.strictEqual(boundaryCheck.allowed, true, "Near boundary within tolerance should be allowed");

// Scenario D: Denied / Missing location coordinates
const deniedCheck = verifyCustomerProximity({
  customerLat: null,
  customerLon: null,
  locationSettings: configuredVenue,
});
assert.strictEqual(deniedCheck.allowed, false);
assert.strictEqual(deniedCheck.reasonCode, "INVALID_COORDINATES");

// Scenario E: Venue location not configured by Vivexa Tech (Must fail safely, no silent ordering)
const unconfiguredVenue: RestaurantLocationSettings = {
  latitude: null,
  longitude: null,
  orderingRadiusMetres: 100,
  locationRestrictionEnabled: true,
  isConfigured: false,
};
const safeFailCheck = verifyCustomerProximity({
  customerLat: 28.6315,
  customerLon: 77.2167,
  locationSettings: unconfiguredVenue,
});
assert.strictEqual(safeFailCheck.allowed, false, "Unconfigured location must fail safely");
assert.strictEqual(safeFailCheck.reasonCode, "NOT_CONFIGURED");

// Scenario F: Location restriction disabled
const disabledVenue: RestaurantLocationSettings = {
  latitude: 28.6315,
  longitude: 77.2167,
  orderingRadiusMetres: 100,
  locationRestrictionEnabled: false,
  isConfigured: true,
};
const disabledCheck = verifyCustomerProximity({
  customerLat: 12.9716, // Anywhere in India
  customerLon: 77.5946,
  locationSettings: disabledVenue,
});
assert.strictEqual(disabledCheck.allowed, true, "Disabled restriction must permit ordering");
assert.strictEqual(disabledCheck.reasonCode, "RESTRICTION_DISABLED");

console.log("   ✅ Test 1.3 Passed: All 6 customer proximity scenarios verified.");

// ------------------------------------------------------------------------------
// FEATURE 2: Quick Switch Bar Removal Verification
// ------------------------------------------------------------------------------
console.log("\n--- FEATURE 2: REMOVE QUICK SWITCH BAR ---");

const navbarFile = fs.readFileSync(path.join(__dirname, "../src/components/public/navbar.tsx"), "utf-8");
assert.ok(!navbarFile.includes("Quick Switch"), "Navbar must not contain 'Quick Switch'");
assert.ok(!navbarFile.includes("Active Persona"), "Navbar must not contain 'Active Persona'");
assert.ok(!navbarFile.includes("VIVEXA TECH SAAS"), "Navbar must not contain dev persona switcher banner");
console.log("   ✅ Test 2.1 Passed: PublicNavbar has no visible Quick Switch or Active Persona bar.");

const loginFile = fs.readFileSync(path.join(__dirname, "../src/app/login/page.tsx"), "utf-8");
assert.ok(!loginFile.includes("Quick Login Persona"), "LoginPage must not display test persona picker buttons");
assert.ok(!loginFile.includes("handlePersonaSelect"), "LoginPage must not have persona simulation handler");
console.log("   ✅ Test 2.2 Passed: LoginPage has no dev persona switching buttons in public interface.");

// ------------------------------------------------------------------------------
// FEATURE 3: Independent Restaurant Websites & XML Sitemaps
// ------------------------------------------------------------------------------
console.log("\n--- FEATURE 3: INDEPENDENT RESTAURANT WEBSITES & SITEMAPS ---");

// Test 3.1: Minimum 3 public pages exist
console.log("3.1 Verifying 3 minimum public pages per restaurant exist in source...");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/[restaurantSlug]/layout.tsx")), "layout.tsx must exist");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/[restaurantSlug]/page.tsx")), "Home page.tsx must exist");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/[restaurantSlug]/menu/page.tsx")), "Menu page.tsx must exist");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/[restaurantSlug]/about/page.tsx")), "About page.tsx must exist");
console.log("   ✅ Test 3.1 Passed: Home, Menu, and About/Contact routes exist.");

// Test 3.2: Dynamic Sitemap Index & Endpoints
console.log("\n3.2 Verifying Dynamic Sitemaps & robots.txt...");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/sitemap.xml/route.ts")), "/sitemap.xml handler exists");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/sitemaps/platform.xml/route.ts")), "/sitemaps/platform.xml handler exists");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/sitemaps/restaurants/[slug]/route.ts")), "/sitemaps/restaurants/[slug] handler exists");
assert.ok(fs.existsSync(path.join(__dirname, "../src/app/robots.txt/route.ts")), "/robots.txt handler exists");

// Test 3.3: Verify Restaurant Data Retrieval for Sitemaps
const publishedRestaurants = dataStore.getPublishedRestaurants();
assert.ok(publishedRestaurants.length >= 1, "At least 1 published demo restaurant exists in data store");
for (const rest of publishedRestaurants) {
  const sub = getSubscriptionAccess(rest.subscription);
  assert.strictEqual(sub.canViewSite, true, `${rest.name} must be eligible for public website`);
  assert.ok(rest.slug, "Restaurant must have slug");
}
console.log(`   ✅ Test 3.3 Passed: ${publishedRestaurants.length} published restaurants verified for sitemap generation.`);

console.log("\n========================================================");
console.log("🏆 ALL RESTROCHARGE ENHANCEMENTS TESTS PASSED 100%!");
console.log("========================================================\n");
process.exit(0);
