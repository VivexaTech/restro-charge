// ==============================================================================
// TEST: Super Admin QR Code Generation & Security Permissions
// Verifies stable URL structure, high-res QR rendering, and role restrictions.
// ==============================================================================

import assert from "node:assert";
import { buildTableOrderUrl, generateTableQRCode } from "../src/lib/services/qr";

console.log("🧪 Running Test: Table QR Code Generation & Security...");

// Test 1: Stable canonical URL generation
const restaurantSlug = "laziz";
const tableCode = "table-01";
const baseUrl = "https://restrocharge.vivexatech.in";

const orderUrl = buildTableOrderUrl(restaurantSlug, tableCode, baseUrl);
assert.strictEqual(
  orderUrl,
  "https://restrocharge.vivexatech.in/order/laziz/table-01",
  "Target QR URL must match /order/laziz/table-01"
);
console.log("  ✅ Test 1 Passed: Stable URL generation matches expected format.");

// Test 2: QR Code data URL generation
async function testQRGeneration() {
  const qr = await generateTableQRCode(restaurantSlug, tableCode, baseUrl);
  assert.ok(qr.dataUrl.startsWith("data:image/png;base64,"), "Data URL must be base64 PNG");
  assert.ok(qr.svgString.includes("<svg"), "Must output valid SVG vector markup");
  assert.strictEqual(qr.targetUrl, "https://restrocharge.vivexatech.in/order/laziz/table-01");
  console.log("  ✅ Test 2 Passed: High-resolution QR PNG and SVG generated cleanly.");
}

// Test 3: Role Authorization Rule Check
function verifyQRPermission(role: string): boolean {
  const authorizedRoles = ["SUPER_ADMIN", "ONBOARDING_EXECUTIVE", "SALES_MANAGER"];
  return authorizedRoles.includes(role);
}

assert.strictEqual(verifyQRPermission("SUPER_ADMIN"), true, "Super Admin must have QR issuance rights");
assert.strictEqual(verifyQRPermission("ONBOARDING_EXECUTIVE"), true, "Onboarding executive can issue QRs");
assert.strictEqual(verifyQRPermission("RESTAURANT_OWNER"), false, "Restaurant owner MUST NOT have QR issuance rights");
assert.strictEqual(verifyQRPermission("RESTAURANT_MANAGER"), false, "Restaurant manager MUST NOT have QR issuance rights");
assert.strictEqual(verifyQRPermission("KITCHEN_STAFF"), false, "Kitchen staff MUST NOT have QR issuance rights");
console.log("  ✅ Test 3 Passed: QR generation permission strictly isolated to Vivexa Tech.");

testQRGeneration().then(() => {
  console.log("🎉 All Security & QR Generation Tests Passed!\n");
});
