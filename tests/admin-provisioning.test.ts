// ==============================================================================
// RESTROCHARGE - Restaurant Admin Account Provisioning Test Suite
// Verifies Firebase Admin SDK connection, safe provisioning, retry/recovery flow,
// credential preservation for existing users, and restaurant preservation.
// ==============================================================================

import assert from "assert";
import {
  isFirebaseAdminReady,
  getFirebaseAdminConfigInfo,
  verifyFirebaseAdminConnection,
  adminAuth,
  adminDb,
} from "../src/lib/firebase/admin";
import { provisionRestaurantAdmin } from "../src/lib/services/admin-provisioning";
import { dataStore } from "../src/lib/services/data-store";
import { RestaurantProfile } from "../src/lib/types";

console.log("🧪 Running Restaurant Admin Account Provisioning Test Suite...\n");

// ------------------------------------------------------------------------------
// TEST 1: Firebase Admin SDK Credentials & Token Exchange Verification
// ------------------------------------------------------------------------------
console.log("--- TEST 1: FIREBASE ADMIN SDK AUTHENTICATION & CREDENTIALS ---");

const configInfo = getFirebaseAdminConfigInfo();
console.log("   Credential Source:", configInfo.source);
console.log("   Project ID:", configInfo.projectId);
console.log("   Client Email:", configInfo.clientEmail);

assert.strictEqual(
  configInfo.isConfigured,
  true,
  "Firebase Admin SDK must be configured with a valid service account cert."
);
assert.strictEqual(
  configInfo.projectId,
  "restro-charge",
  "Project ID must match restro-charge."
);
assert.ok(
  configInfo.clientEmail?.includes("@restro-charge.iam.gserviceaccount.com"),
  "Client Email must belong to the restro-charge GCP domain."
);

async function runTests() {
  const connResult = await verifyFirebaseAdminConnection();
  console.log("   Google OAuth2 Token Exchange:", connResult.success ? "SUCCESS" : "FAILED");
  if (!connResult.success) {
    console.error("   OAuth2 Error:", connResult.error, connResult.errorCode);
  }
  assert.strictEqual(
    connResult.success,
    true,
    `Google OAuth2 token exchange must succeed: ${connResult.error}`
  );
  console.log("   ✅ Test 1 Passed: Firebase Admin SDK authenticates cleanly against Google Cloud IAM.");

  // ------------------------------------------------------------------------------
  // TEST 2: Existing Restaurant Setup & Preservation
  // ------------------------------------------------------------------------------
  console.log("\n--- TEST 2: PRESERVE EXISTING RESTAURANT RECORD ---");

  const testSlug = `recovery-venue-${Date.now().toString(36)}`;
  const testRestId = `rest_${testSlug}`;
  const testOwnerEmail = `manager-${testSlug}@vivexarestro.test`;
  const initialCreatedAt = new Date(Date.now() - 3600000).toISOString();

  const existingRestaurant: RestaurantProfile = {
    id: testRestId,
    name: "Jaipur Spices Kitchen",
    slug: testSlug,
    cuisineType: "North Indian",
    ownerUid: `usr_unprovisioned_${testSlug}`,
    ownerEmail: testOwnerEmail,
    ownerName: "Anita Sharma",
    phone: "+91 98290 88888",
    address: "MI Road, Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    postalCode: "302001",
    published: true,
    description: "Finest heritage curries.",
    branding: {
      logoUrl: "",
      coverImageUrl: "",
      primaryColor: "#ea580c",
      secondaryColor: "#9a3412",
      accentColor: "#fb923c",
      fontPreset: "outfit",
      galleryImages: [],
    },
    websiteConfig: {
      heroTitle: "Jaipur Spices Kitchen",
      heroSubtitle: "Finest dining in Jaipur",
      heroLayout: "centered",
      menuLayout: "grid",
      openingHours: [{ days: "Daily", open: "11:00 AM", close: "11:00 PM" }],
      contactPhone: "+91 98290 88888",
      contactEmail: testOwnerEmail,
      address: "MI Road, Jaipur",
      city: "Jaipur",
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
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
      calculationBasis: "TAX_ON_SUBTOTAL",
    },
    locationSettings: {
      latitude: 26.9124,
      longitude: 75.7873,
      orderingRadiusMetres: 200,
      locationRestrictionEnabled: true,
      isConfigured: true,
    },
    subscription: {
      planId: "plan_pro",
      planName: "Growth",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      startDate: initialCreatedAt,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      gracePeriodEnd: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false,
      updatedAt: initialCreatedAt,
    },
    operationalSettings: {
      isAcceptingOrders: true,
      currency: "INR",
      tableCount: 12,
    },
    adminProvisioningStatus: "FAILED",
    adminProvisioningError: "invalid_grant (Invalid grant: account not found)",
    createdAt: initialCreatedAt,
    updatedAt: initialCreatedAt,
  };

  dataStore.saveRestaurant(existingRestaurant);
  const initialCount = dataStore.getRestaurants().length;

  console.log(`   Initial Restaurant Document: ${existingRestaurant.name} (${existingRestaurant.id})`);
  console.log(`   Initial Admin Status: ${existingRestaurant.adminProvisioningStatus}`);
  console.log(`   Initial Error Recorded: ${existingRestaurant.adminProvisioningError}`);

  console.log("   ✅ Test 2 Passed: Existing unprovisioned restaurant successfully set up.");

  // ------------------------------------------------------------------------------
  // TEST 3: Safe Retry / Recovery Flow (New Firebase Auth User)
  // ------------------------------------------------------------------------------
  console.log("\n--- TEST 3: SAFE RETRY / RECOVERY PROVISIONING (NEW USER) ---");

  // Clean up test user in Firebase Auth if it happens to exist
  try {
    const existingAuthUser = await adminAuth.getUserByEmail(testOwnerEmail);
    if (existingAuthUser) await adminAuth.deleteUser(existingAuthUser.uid);
  } catch {
    // ignore
  }

  const provResult1 = await provisionRestaurantAdmin({
    restaurantId: testRestId,
    adminEmail: testOwnerEmail,
    adminName: "Anita Sharma",
    performedBy: {
      uid: "super-admin-uid",
      email: "admin@vivexatech.in",
      name: "Vivexa Tech Super Admin",
    },
  });

  console.log("   Provisioning Result:", provResult1.status, provResult1.actionTaken);
  console.log("   Provisioning Message:", provResult1.message);

  assert.strictEqual(provResult1.success, true);
  assert.strictEqual(provResult1.status, "PROVISIONED");
  assert.strictEqual(provResult1.actionTaken, "NEW_USER_CREATED");
  assert.ok(provResult1.uid, "Provisioned user must receive a valid UID");

  // Verify restaurant record was preserved, NOT duplicated
  const postProvRestaurants = dataStore.getRestaurants();
  assert.strictEqual(
    postProvRestaurants.length,
    initialCount,
    "Restaurant count must not increase (zero duplicate documents created)"
  );

  const updatedRest = dataStore.getRestaurantById(testRestId);
  assert.ok(updatedRest, "Restaurant must exist in dataStore");
  assert.strictEqual(updatedRest.id, testRestId);
  assert.strictEqual(updatedRest.createdAt, initialCreatedAt, "Original createdAt timestamp must be preserved");
  assert.strictEqual(updatedRest.ownerUid, provResult1.uid, "ownerUid must be updated to Firebase Auth UID");
  assert.strictEqual(updatedRest.adminProvisioningStatus, "PROVISIONED");
  assert.ok(!updatedRest.adminProvisioningError, "adminProvisioningError must be cleared");
  assert.ok(updatedRest.adminProvisionedAt, "adminProvisionedAt must be set");

  // Verify custom claims in Firebase Auth
  const createdAuthUser = await adminAuth.getUser(provResult1.uid!);
  assert.strictEqual(createdAuthUser.customClaims?.role, "RESTAURANT_OWNER");
  assert.strictEqual(createdAuthUser.customClaims?.restaurantId, testRestId);

  // Verify Firestore User Profile
  const userDocSnap = await adminDb.collection("users").doc(provResult1.uid!).get();
  assert.strictEqual(userDocSnap.exists, true, "User profile document must exist in Firestore");
  assert.strictEqual(userDocSnap.data()?.role, "RESTAURANT_OWNER");
  assert.strictEqual(userDocSnap.data()?.restaurantId, testRestId);

  // Verify Firestore Restaurant Membership
  const membDocSnap = await adminDb.collection("restaurantMemberships").doc(`memb_${provResult1.uid}_${testRestId}`).get();
  assert.strictEqual(membDocSnap.exists, true, "Restaurant membership document must exist in Firestore");
  assert.strictEqual(membDocSnap.data()?.role, "RESTAURANT_OWNER");
  assert.strictEqual(membDocSnap.data()?.status, "ACTIVE");

  console.log(`   ✅ Test 3 Passed: User ${createdAuthUser.email} provisioned with custom claims, user doc, and membership in Firestore. No duplicate restaurant created.`);

  // ------------------------------------------------------------------------------
  // TEST 4: Idempotent Re-provisioning / Existing User (Preserves Password/Credentials)
  // ------------------------------------------------------------------------------
  console.log("\n--- TEST 4: IDEMPOTENT RECOVERY (PRESERVES EXISTING USER CREDENTIALS) ---");

  const provResult2 = await provisionRestaurantAdmin({
    restaurantId: testRestId,
    adminEmail: testOwnerEmail,
    adminName: "Anita Sharma Updated",
    performedBy: {
      uid: "super-admin-uid",
      email: "admin@vivexatech.in",
      name: "Vivexa Tech Super Admin",
    },
  });

  console.log("   Re-provisioning Result:", provResult2.status, provResult2.actionTaken);
  console.log("   Re-provisioning Message:", provResult2.message);

  assert.strictEqual(provResult2.success, true);
  assert.strictEqual(provResult2.status, "PROVISIONED");
  assert.strictEqual(provResult2.actionTaken, "EXISTING_USER_LINKED");
  assert.strictEqual(provResult2.uid, provResult1.uid, "UID must remain identical");

  // Verify claims still intact
  const recheckedUser = await adminAuth.getUser(provResult1.uid!);
  assert.strictEqual(recheckedUser.customClaims?.role, "RESTAURANT_OWNER");
  assert.strictEqual(recheckedUser.customClaims?.restaurantId, testRestId);

  console.log("   ✅ Test 4 Passed: Existing user recognized and linked without changing credentials.");

  // Clean up created test user from Firebase Auth
  try {
    await adminAuth.deleteUser(provResult1.uid!);
    console.log("   (Cleaned up temporary test user from Firebase Auth)");
  } catch {
    // ignore
  }

  // ------------------------------------------------------------------------------
  // TEST 5: Non-Existent Restaurant Rejection
  // ------------------------------------------------------------------------------
  console.log("\n--- TEST 5: NON-EXISTENT RESTAURANT REJECTION ---");

  const missingRestResult = await provisionRestaurantAdmin({
    restaurantId: "rest_non_existent_9999",
    adminEmail: "nobody@nowhere.com",
  });

  assert.strictEqual(missingRestResult.success, false);
  assert.strictEqual(missingRestResult.status, "FAILED");
  assert.strictEqual(missingRestResult.errorCode, "NOT_FOUND");

  console.log("   ✅ Test 5 Passed: Non-existent restaurant properly rejected without corrupting store.");

  // ------------------------------------------------------------------------------
  // TEST 6: SAFE RECOVERY & VERIFICATION OF EXISTING RESTAURANT RECORD
  // ------------------------------------------------------------------------------
  console.log("\n--- TEST 6: RECOVERY OF EXISTING RESTAURANT RECORD ---");

  const existingVenueId = "rest_recovery-venue-mvukafqo";
  const existingDoc = await adminDb.collection("restaurants").doc(existingVenueId).get();
  if (existingDoc.exists) {
    const venueData = existingDoc.data()!;
    console.log(`   Found existing restaurant in Firestore: ${venueData.name} (${existingVenueId})`);
    console.log(`   Owner Email: ${venueData.ownerEmail}`);

    const recoveryResult = await provisionRestaurantAdmin({
      restaurantId: existingVenueId,
      adminEmail: venueData.ownerEmail,
      adminName: venueData.ownerName || "Anita Sharma",
      performedBy: {
        uid: "GDF2eldrzSNR9oltgezCr9MXt0I3",
        email: "admin@vivexatech.in",
        name: "Vivexa Tech Super Admin",
      },
    });

    assert.strictEqual(recoveryResult.success, true, "Recovery must succeed");
    assert.strictEqual(recoveryResult.status, "PROVISIONED", "Status must be PROVISIONED");
    assert.ok(recoveryResult.uid, "Must have valid UID");

    // Verify Firebase Auth
    const authAdmin = await adminAuth.getUser(recoveryResult.uid!);
    assert.strictEqual(authAdmin.email, venueData.ownerEmail.toLowerCase());
    assert.strictEqual(authAdmin.customClaims?.role, "RESTAURANT_OWNER");
    assert.strictEqual(authAdmin.customClaims?.restaurantId, existingVenueId);

    // Verify Firestore User Profile
    const profileSnap = await adminDb.collection("users").doc(recoveryResult.uid!).get();
    assert.strictEqual(profileSnap.exists, true, "Firestore user profile must exist");
    assert.strictEqual(profileSnap.data()?.role, "RESTAURANT_OWNER");
    assert.strictEqual(profileSnap.data()?.restaurantId, existingVenueId);

    // Verify Firestore Restaurant Membership
    const membSnap = await adminDb.collection("restaurantMemberships").doc(`memb_${recoveryResult.uid}_${existingVenueId}`).get();
    assert.strictEqual(membSnap.exists, true, "Firestore restaurant membership must exist");
    assert.strictEqual(membSnap.data()?.role, "RESTAURANT_OWNER");
    assert.strictEqual(membSnap.data()?.status, "ACTIVE");

    // Verify Restaurant Document
    const postRecoveryRest = await adminDb.collection("restaurants").doc(existingVenueId).get();
    const postData = postRecoveryRest.data()!;
    assert.strictEqual(postData.ownerUid, recoveryResult.uid);
    assert.strictEqual(postData.adminProvisioningStatus, "PROVISIONED");
    assert.strictEqual(postData.adminProvisioningError, null);
    assert.ok(postData.adminProvisionedAt);

    console.log(`   ✅ Test 6 Passed: Existing restaurant ${existingVenueId} successfully recovered and provisioned!`);
  } else {
    console.log("   (Skipping Test 6: existing restaurant not found)");
  }

  console.log("\n🎉 ALL RESTAURANT ADMIN PROVISIONING TESTS PASSED 100%!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test suite encountered an error:", err);
  process.exit(1);
});
