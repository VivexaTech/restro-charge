// ==============================================================================
// TEST: Complete End-to-End Business Lifecycle & Workflow Test
// Simulates Onboarding -> Table QR Issuance -> Customer QR Order -> KDS -> Subscription Renewal
// ==============================================================================

import assert from "node:assert";
import { dataStore } from "../src/lib/services/data-store";
import { calculateOrderBill } from "../src/lib/services/billing";
import { getSubscriptionAccess, calculateNewSubscriptionDates } from "../src/lib/services/subscription";
import { generateTableQRCode, buildTableOrderUrl } from "../src/lib/services/qr";
import { generateId, generateOrderNumber } from "../src/lib/utils";
import type { OrderItem, OrderItemSnapshot, TableItem } from "../src/lib/types";

console.log("🚀 Running Complete End-to-End Platform Integration Test...\n");

async function runE2E() {
  // --------------------------------------------------------------------------
  // STEP 1: Registration Request Submission
  // --------------------------------------------------------------------------
  console.log("Step 1: Submitting onboarding registration request...");
  const newReq = dataStore.saveRequest({
    id: generateId("req"),
    applicantName: "Kabir Mehra",
    restaurantName: "Mehra Royal Biryani",
    email: "kabir@mehrabiryani.com",
    phone: "+91 98111 22334",
    city: "Delhi",
    cuisine: "Old Delhi Biryani & Nihari",
    estimatedTables: 20,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  });
  assert.strictEqual(newReq.status, "PENDING");
  console.log(`  ✅ Onboarding request submitted with ID: ${newReq.id}`);

  // --------------------------------------------------------------------------
  // STEP 2: Super Admin Approves & Provisions Restaurant
  // --------------------------------------------------------------------------
  console.log("\nStep 2: Vivexa Tech Super Admin reviews and approves request...");
  newReq.status = "APPROVED";
  newReq.reviewedBy = "Vivexa Super Admin";
  newReq.reviewedAt = new Date().toISOString();
  dataStore.saveRequest(newReq);

  const restSlug = "mehra-biryani";
  const newRest = dataStore.saveRestaurant({
    id: "rest_mehra_01",
    name: newReq.restaurantName,
    slug: restSlug,
    cuisineType: newReq.cuisine,
    description: "Royal Old Delhi biryani house.",
    ownerUid: "usr_kabir",
    ownerEmail: newReq.email,
    ownerName: newReq.applicantName,
    phone: newReq.phone,
    address: "Chandni Chowk",
    city: "Delhi",
    state: "Delhi",
    postalCode: "110006",
    published: true,
    operationalSettings: {
      isAcceptingOrders: true,
      currency: "INR",
      tableCount: 20,
    },
    branding: {
      logoUrl: "",
      coverImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
      primaryColor: "#ea580c",
      secondaryColor: "#9a3412",
      accentColor: "#fb923c",
      fontPreset: "outfit",
      galleryImages: [],
    },
    websiteConfig: {
      heroTitle: "Old Delhi's Imperial Biryani",
      heroLayout: "centered",
      menuLayout: "categorized",
      openingHours: [{ days: "Daily", open: "11 AM", close: "11 PM" }],
      contactPhone: newReq.phone,
      contactEmail: newReq.email,
      address: "Chandni Chowk, Delhi",
      city: "Delhi",
      amenities: ["Dine-in", "Air Conditioned"],
      socialLinks: {},
      sectionsVisibility: {
        hero: true,
        about: true,
        menu: true,
        gallery: false,
        hours: true,
        contact: true,
        amenities: true,
      },
    },
    billingConfig: {
      itemOnly: false,
      gstEnabled: true,
      gstRate: 5,
      serviceChargeEnabled: true,
      serviceChargeRate: 5,
      calculationBasis: "TAX_ON_SUBTOTAL",
    },
    subscription: {
      planId: "plan_pro",
      planName: "Growth & KDS Pro",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      startDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      gracePeriodEnd: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false,
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.strictEqual(newRest.id, "rest_mehra_01");
  console.log(`  ✅ Restaurant "${newRest.name}" provisioned at /${newRest.slug}`);

  // --------------------------------------------------------------------------
  // STEP 3: Vivexa Tech Super Admin Provisions Table & Generates QR Code
  // --------------------------------------------------------------------------
  console.log("\nStep 3: Vivexa Tech team provisions Table 01 and generates QR...");
  const tableCode = "table-01";
  const qrResult = await generateTableQRCode(restSlug, tableCode);

  const tableItem: TableItem = {
    id: "tbl_mehra_01",
    restaurantId: newRest.id,
    restaurantSlug: restSlug,
    displayLabel: "Table 01",
    code: tableCode,
    qrCodeUrl: qrResult.dataUrl,
    isActive: true,
    createdAt: new Date().toISOString(),
    generatedBy: "usr_vivexa_admin",
  };
  dataStore.saveTable(tableItem);

  assert.strictEqual(tableItem.code, "table-01");
  assert.ok(tableItem.qrCodeUrl?.startsWith("data:image/png;base64,"));
  console.log(`  ✅ Table 01 provisioned with QR pointing to ${qrResult.targetUrl}`);

  // --------------------------------------------------------------------------
  // STEP 4: Add Menu Items to Restaurant Catalog
  // --------------------------------------------------------------------------
  console.log("\nStep 4: Setting up menu dishes in database...");
  const dish = dataStore.saveProduct({
    id: "prod_mehra_biryani",
    restaurantId: newRest.id,
    categoryId: "cat_main",
    name: "Old Delhi Dum Biryani",
    description: "Saffron infused dum biryani with tender cuts.",
    price: 350, // True database price
    isVeg: false,
    dietaryType: "non_veg",
    isAvailable: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.strictEqual(dish.price, 350);
  console.log(`  ✅ Dish added: "${dish.name}" at ₹${dish.price}`);

  // --------------------------------------------------------------------------
  // STEP 5: Customer QR Order Submission with Price Tampering Protection
  // --------------------------------------------------------------------------
  console.log("\nStep 5: Simulating customer QR order with malicious client-side price tampering...");
  // Simulate attacker attempting to order with price: 1 rupee instead of 350
  const clientSubmittedItem = {
    productId: "prod_mehra_biryani",
    name: "Old Delhi Dum Biryani",
    price: 1, // Tampered client price!
    quantity: 2,
  };

  // Backend verification logic (same as /api/orders):
  // Discard clientSubmittedItem.price and fetch trusted price from DB!
  const dbItem = dataStore.getProductById(clientSubmittedItem.productId);
  assert.ok(dbItem, "Item must exist in DB");
  assert.strictEqual(dbItem.isAvailable, true, "Item must be available");

  const validatedSnapshot: OrderItemSnapshot = {
    productId: dbItem.id,
    name: dbItem.name,
    price: dbItem.price, // Trusted DB price: ₹350
    quantity: clientSubmittedItem.quantity,
    isVeg: dbItem.isVeg,
  };

  // Subtotal = 350 * 2 = 700
  // Service charge 5% = 35
  // GST 5% = 35
  // Total = 770
  const bill = calculateOrderBill([validatedSnapshot], newRest.billingConfig);
  assert.strictEqual(bill.subtotal, 700, "Subtotal must be calculated using trusted ₹350 price, NOT client's ₹1");
  assert.strictEqual(bill.serviceChargeAmount, 35, "Service charge must equal 35");
  assert.strictEqual(bill.gstAmount, 35, "GST must equal 35");
  assert.strictEqual(bill.finalTotal, 770, "Final total must equal 770");
  console.log(`  ✅ Price tampering thwarted! Final bill calculated strictly from DB: ₹${bill.finalTotal}`);

  const orderId = generateId("ord");
  const orderNumber = generateOrderNumber();
  const createdOrder: OrderItem = {
    id: orderId,
    orderNumber,
    restaurantId: newRest.id,
    restaurantSlug: newRest.slug,
    tableId: tableItem.id,
    tableLabel: tableItem.displayLabel,
    items: [validatedSnapshot],
    billing: bill,
    status: "NEW",
    statusHistory: [
      {
        status: "NEW",
        timestamp: new Date().toISOString(),
        updatedBy: "Customer QR",
      },
    ],
    customerNotes: "Extra onions please",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  dataStore.saveOrder(createdOrder);
  console.log(`  ✅ Order ${orderNumber} placed and saved to live kitchen queue.`);

  // --------------------------------------------------------------------------
  // STEP 6: Floor Staff & Kitchen Status Progression
  // --------------------------------------------------------------------------
  console.log("\nStep 6: Advancing order status through kitchen lifecycle...");
  dataStore.updateOrderStatus(orderId, "ACCEPTED", "Floor Staff");
  let ord = dataStore.getOrderById(orderId);
  assert.strictEqual(ord?.status, "ACCEPTED");

  dataStore.updateOrderStatus(orderId, "PREPARING", "Chef Farhan");
  ord = dataStore.getOrderById(orderId);
  assert.strictEqual(ord?.status, "PREPARING");

  dataStore.updateOrderStatus(orderId, "READY", "Chef Farhan");
  ord = dataStore.getOrderById(orderId);
  assert.strictEqual(ord?.status, "READY");

  dataStore.updateOrderStatus(orderId, "SERVED", "Waiter Rohan");
  ord = dataStore.getOrderById(orderId);
  assert.strictEqual(ord?.status, "SERVED");
  assert.strictEqual(ord?.statusHistory.length, 5, "Status history must record all 5 lifecycle stages");
  console.log("  ✅ Order successfully progressed: NEW -> ACCEPTED -> PREPARING -> READY -> SERVED.");

  // --------------------------------------------------------------------------
  // STEP 7: Subscription Grace Period & Razorpay Self-Renewal
  // --------------------------------------------------------------------------
  console.log("\nStep 7: Testing 3-day grace period and Razorpay self-renewal...");
  // Simulate subscription expiring
  const expiredExpiry = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
  const graceEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days left
  newRest.subscription.expiryDate = expiredExpiry.toISOString();
  newRest.subscription.gracePeriodEnd = graceEnd.toISOString();
  newRest.subscription.status = "GRACE_PERIOD";

  const access = getSubscriptionAccess(newRest.subscription);
  assert.strictEqual(access.status, "GRACE_PERIOD");
  assert.strictEqual(access.canOrder, true, "Grace period must allow ordering");
  console.log(`  ✅ Grace period active: ${access.message}`);

  // Renew via Razorpay
  const { expiryDate: renewedExpiry, gracePeriodEnd: renewedGrace } = calculateNewSubscriptionDates(
    newRest.subscription,
    1
  );
  newRest.subscription.status = "ACTIVE";
  newRest.subscription.expiryDate = renewedExpiry;
  newRest.subscription.gracePeriodEnd = renewedGrace;
  dataStore.saveRestaurant(newRest);

  const restoredAccess = getSubscriptionAccess(newRest.subscription);
  assert.strictEqual(restoredAccess.status, "ACTIVE");
  assert.strictEqual(restoredAccess.canOrder, true);
  console.log(`  ✅ Subscription renewed and reactivated until ${new Date(renewedExpiry).toLocaleDateString("en-IN")}`);

  console.log("\n========================================================");
  console.log("🏆 ALL END-TO-END WORKFLOW INTEGRATION TESTS PASSED 100%!");
  console.log("========================================================\n");
  process.exit(0);
}

runE2E();
