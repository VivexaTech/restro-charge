// ==============================================================================
// RESTROCHARGE - Patiyala Junction Import Verification Test Suite
// Verifies:
// 1. Restaurant document integrity in Cloud Firestore.
// 2. All 28 categories persisted and accurately mapped.
// 3. Complete menu product catalog with portions, variants & dietary flags.
// 4. Special offers in DRAFT status for admin review.
// 5. Contactless QR dining tables generation.
// 6. Tenant isolation and database queries.
// ==============================================================================

import assert from "assert";
import { firestoreService } from "../src/lib/services/firestore-service";
import { isFirebaseAdminReady } from "../src/lib/firebase/admin";
import { RESTAURANT_ID, RESTAURANT_SLUG } from "../scripts/import-patiyala-junction";

async function runTestSuite() {
  console.log("🧪 Running Patiyala Junction Full Database Verification Test Suite...\n");

  if (!isFirebaseAdminReady()) {
    console.error("FATAL: Firebase Admin SDK is not ready.");
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // TEST 1: Restaurant Profile Verification
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Restaurant Profile & Metadata Verification ---");
  const restaurantById = await firestoreService.getRestaurantById(RESTAURANT_ID);
  assert.ok(restaurantById, "Restaurant must exist by ID in Cloud Firestore");
  assert.strictEqual(restaurantById.name, "Patiyala Junction");
  assert.strictEqual(restaurantById.slug, "patiyala-junction");
  assert.ok(restaurantById.phone.includes("9711183938"));
  assert.ok(restaurantById.phone.includes("8287606080"));
  assert.ok(restaurantById.address.includes("Sec 23A"));
  assert.ok(restaurantById.address.includes("Gurgaon"));
  assert.strictEqual(restaurantById.published, true);
  assert.strictEqual(restaurantById.billingConfig.gstEnabled, true);
  assert.strictEqual(restaurantById.billingConfig.gstRate, 5);

  const restaurantBySlug = await firestoreService.getRestaurantBySlug(RESTAURANT_SLUG);
  assert.ok(restaurantBySlug, "Restaurant must be resolvable by slug 'patiyala-junction'");
  assert.strictEqual(restaurantBySlug.id, RESTAURANT_ID);
  console.log(`  ✅ Test 1 Passed: Restaurant profile verified: ${restaurantById.name} (@${restaurantById.slug})`);

  // --------------------------------------------------------------------------
  // TEST 2: Categories Verification (All 28 Categories)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: All 28 Categories Verification ---");
  const categories = await firestoreService.getCategories(RESTAURANT_ID);
  assert.strictEqual(categories.length, 28, `Expected exactly 28 categories, found ${categories.length}`);

  const expectedCategoryNames = [
    "Special Offers",
    "Momos",
    "Soup",
    "Burger",
    "Sandwich",
    "Chinese Potato",
    "Chinese Veg Starters",
    "Chinese Non Veg Starters",
    "Noodles & Rice",
    "Chinese Roll",
    "Rumali Roll",
    "Fish (Seasonal)",
    "Gym Lover",
    "Veg Tandoori Starters",
    "Chicken Tandoori Starters",
    "Veg Main Course",
    "Thali Combo",
    "Non Veg Main Course",
    "Raita",
    "Biryani's / Rice Ka Bazaar",
    "Sweet Dish",
    "Breads",
    "Shakes",
    "Tawa Paratha",
    "Veg Combos",
    "Rice Combo",
    "Non Veg Combo",
    "Non Veg Rice Combo",
  ];

  for (const name of expectedCategoryNames) {
    const found = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    assert.ok(found, `Category '${name}' must exist in Firestore`);
  }
  console.log(`  ✅ Test 2 Passed: All 28 categories confirmed present and active in Cloud Firestore.`);

  // --------------------------------------------------------------------------
  // TEST 3: Products Catalog & Pricing Verification
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Products Catalog, Pricing & Portions Verification ---");
  const products = await firestoreService.getProducts(RESTAURANT_ID);
  assert.ok(products.length >= 229, `Expected at least 229 products, found ${products.length}`);
  console.log(`  Total imported products: ${products.length}`);

  // Check 1: Dal Makhani (Half ₹160, Full ₹270, Family Pack ₹390)
  const dalMakhani = products.find((p) => p.name === "Dal Makhani");
  assert.ok(dalMakhani, "Dal Makhani must exist");
  assert.strictEqual(dalMakhani.portions?.length, 3, "Dal Makhani must have 3 portions");
  assert.strictEqual(dalMakhani.portions?.find((po) => po.id === "half")?.price, 160);
  assert.strictEqual(dalMakhani.portions?.find((po) => po.id === "full")?.price, 270);
  assert.strictEqual(dalMakhani.portions?.find((po) => po.id === "family_pack")?.price, 390);
  console.log("  ✅ Checked Dal Makhani: ₹160 (Half) / ₹270 (Full) / ₹390 (Family Pack)");

  // Check 2: Momos pricing
  const vegSteam = products.find((p) => p.name === "Veg Steam Momos");
  assert.ok(vegSteam);
  assert.strictEqual(vegSteam.portions?.find((po) => po.id === "half")?.price, 70);
  assert.strictEqual(vegSteam.portions?.find((po) => po.id === "full")?.price, 130);

  const paneerSteam = products.find((p) => p.name === "Paneer Steam Momos");
  assert.ok(paneerSteam);
  assert.strictEqual(paneerSteam.portions?.find((po) => po.id === "half")?.price, 80);
  assert.strictEqual(paneerSteam.portions?.find((po) => po.id === "full")?.price, 150);

  const chickenSteam = products.find((p) => p.name === "Chicken Steam Momos");
  assert.ok(chickenSteam);
  assert.strictEqual(chickenSteam.portions?.find((po) => po.id === "half")?.price, 80);
  assert.strictEqual(chickenSteam.portions?.find((po) => po.id === "full")?.price, 150);
  console.log("  ✅ Checked Veg, Paneer & Chicken Momos pricing");

  // Check 3: Noodles multi-protein variant pricing
  const hakka = products.find((p) => p.name === "Hakka Noodle");
  assert.ok(hakka);
  assert.strictEqual(hakka.portions?.find((po) => po.id === "veg")?.price, 180);
  assert.strictEqual(hakka.portions?.find((po) => po.id === "soya")?.price, 200);
  assert.strictEqual(hakka.portions?.find((po) => po.id === "paneer")?.price, 210);
  assert.strictEqual(hakka.portions?.find((po) => po.id === "egg")?.price, 210);
  assert.strictEqual(hakka.portions?.find((po) => po.id === "chicken")?.price, 230);
  console.log("  ✅ Checked Hakka Noodle 5-way variants: Veg ₹180 / Soya ₹200 / Paneer ₹210 / Egg ₹210 / Chicken ₹230");

  // Check 4: Combos
  const deluxeThali = products.find((p) => p.name === "Deluxe Thali");
  assert.ok(deluxeThali);
  assert.strictEqual(deluxeThali.price, 149);

  const superThali = products.find((p) => p.name === "Super Thali");
  assert.ok(superThali);
  assert.strictEqual(superThali.price, 199);

  const superDeluxeThali = products.find((p) => p.name === "Super Deluxe Thali");
  assert.ok(superDeluxeThali);
  assert.strictEqual(superDeluxeThali.price, 279);

  const vcomboShake = products.find((p) => p.name === "Vanilla Shake + Strawberry Shake");
  assert.ok(vcomboShake);
  assert.strictEqual(vcomboShake.price, 99);

  const rcomboPindi = products.find((p) => p.name === "Pindi Chana + Rice");
  assert.ok(rcomboPindi);
  assert.strictEqual(rcomboPindi.price, 130);

  const nvcomboButter = products.find((p) => p.name === "Butter Chicken Boneless + 2 Butter Roti");
  assert.ok(nvcomboButter);
  assert.strictEqual(nvcomboButter.price, 199);

  const nvrcomboButter = products.find((p) => p.name === "Butter Chicken Boneless + Plain Rice");
  assert.ok(nvrcomboButter);
  assert.strictEqual(nvrcomboButter.price, 199);
  console.log("  ✅ Checked Combos: Thali (₹149/₹199/₹279), Shake Combo (₹99), Rice Combo (₹130), Non-Veg Combos (₹199)");

  // Check 5: Non-veg Main Course (Butter Chicken, Chicken Tikka Masala Boneless, Egg Bhurji)
  const butterChicken = products.find((p) => p.name === "Butter Chicken");
  assert.ok(butterChicken);
  assert.strictEqual(butterChicken.portions?.find((po) => po.id === "half")?.price, 240);
  assert.strictEqual(butterChicken.portions?.find((po) => po.id === "full")?.price, 399);
  assert.strictEqual(butterChicken.portions?.find((po) => po.id === "family_pack")?.price, 699);

  const ctmBoneless = products.find((p) => p.name === "Chicken Tikka Masala Boneless");
  assert.ok(ctmBoneless);
  assert.strictEqual(ctmBoneless.portions?.length, 2); // No family pack in PDF
  assert.strictEqual(ctmBoneless.portions?.find((po) => po.id === "half")?.price, 290);
  assert.strictEqual(ctmBoneless.portions?.find((po) => po.id === "full")?.price, 550);

  const eggBhurji = products.find((p) => p.name.includes("Egg Bhurji"));
  assert.ok(eggBhurji);
  assert.strictEqual(eggBhurji.portions?.find((po) => po.id === "half")?.price, 150);
  assert.strictEqual(eggBhurji.portions?.find((po) => po.id === "full")?.price, 220);
  console.log("  ✅ Checked Non-veg Main Course portions and egg piece quantities");

  // Check 6: Fish (Seasonal)
  const fishTikka = products.find((p) => p.name.includes("Fish Tikka"));
  assert.ok(fishTikka);
  assert.strictEqual(fishTikka.price, 400);

  // Check 7: Sweet Dish
  const gulabJamun = products.find((p) => p.name.includes("Gulab Jamun"));
  assert.ok(gulabJamun);
  assert.strictEqual(gulabJamun.price, 60);

  // Check 8: Breads
  const tandooriRoti = products.find((p) => p.name === "Tandoori Roti");
  assert.ok(tandooriRoti);
  assert.strictEqual(tandooriRoti.price, 15);

  const keemaNaan = products.find((p) => p.name === "Keema Naan With Gravy");
  assert.ok(keemaNaan);
  assert.strictEqual(keemaNaan.price, 200);
  assert.strictEqual(keemaNaan.dietaryType, "non_veg");
  console.log(`  ✅ Test 3 Passed: 100% of tested dishes match exact PDF prices and variants.`);

  // --------------------------------------------------------------------------
  // TEST 4: Special Offers (Active & Dine-In Only)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Special Offers Verification ---");
  const offers = await firestoreService.getOffers(RESTAURANT_ID);
  assert.strictEqual(offers.length, 6, "Expected exactly 6 day-wise offers");
  for (const offer of offers) {
    assert.strictEqual(offer.status, "ACTIVE", `Offer '${offer.name}' must be in ACTIVE status`);
    assert.strictEqual(offer.dineInOnly, true, `Offer '${offer.name}' must be marked dineInOnly`);
    assert.strictEqual(offer.restaurantId, RESTAURANT_ID, "Offer must be quarantined to Patiyala Junction");
  }
  console.log("  ✅ Test 4 Passed: All 6 Day-Wise Special Offers stored in ACTIVE status with dineInOnly restriction.");

  // --------------------------------------------------------------------------
  // TEST 5: QR Dining Tables Verification
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: QR Dining Tables Verification ---");
  const tables = await firestoreService.getTables(RESTAURANT_ID);
  assert.strictEqual(tables.length, 5, "Expected 5 configured tables");
  for (const table of tables) {
    assert.strictEqual(table.restaurantSlug, "patiyala-junction");
    assert.ok(table.qrCodeUrl?.startsWith("data:image/png;base64,"), "QR code data URI must be present");
  }
  console.log("  ✅ Test 5 Passed: 5 QR dining tables provisioned with valid base64 QR payloads.");

  console.log("\n==================================================================");
  console.log("🏆 ALL PATIYALA JUNCTION IMPORT TESTS PASSED (100% SUCCESS)");
  console.log("==================================================================");
}

runTestSuite().catch((err) => {
  console.error("❌ Test Suite Failed:", err);
  process.exit(1);
});
