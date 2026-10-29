// ==============================================================================
// RESTROCHARGE - Automated Test Suite: Staff & Team Provisioning and Login
// Verifies:
// 1. Restaurant Staff account creation in Firebase Auth and Cloud Firestore.
// 2. Vivexa Team Staff account creation in Firebase Auth and Cloud Firestore.
// 3. Idempotent re-provisioning without duplicate accounts.
// 4. Client SDK login, ID token retrieval, and membership resolution.
// ==============================================================================

import { adminAuth, adminDb, isFirebaseAdminReady } from "../src/lib/firebase/admin";
import {
  provisionRestaurantStaff,
  provisionVivexaTeamMember,
  getRestaurantStaffList,
  getVivexaTeamList,
} from "../src/lib/services/staff-provisioning";
import { firestoreService } from "../src/lib/services/firestore-service";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth as clientAuth } from "../src/lib/firebase/client";

async function runTestSuite() {
  console.log("🧪 Running Staff & Team Provisioning Test Suite...\n");

  if (!isFirebaseAdminReady()) {
    console.error("FATAL: Firebase Admin SDK is not ready.");
    process.exit(1);
  }

  const restaurants = await firestoreService.getRestaurants();
  const testRest = restaurants.find((r) => r.id === "rest_testing_mvt4cd5t") || restaurants[0];

  const staffEmail = `test_chef_${Date.now()}@restrocharge.test`;
  const staffPass = "StaffTest@123456";
  const teamEmail = `onboarder_${Date.now()}@vivexatech.in`;
  const teamPass = "TeamTest@123456";

  let staffUid = "";
  let teamUid = "";

  try {
    // --- TEST 1: CREATE RESTAURANT STAFF ---
    console.log("--- TEST 1: CREATE RESTAURANT STAFF & FIRESTORE PERSISTENCE ---");
    const staffRes = await provisionRestaurantStaff({
      restaurantId: testRest.id,
      name: "Chef Test Arjun",
      email: staffEmail,
      role: "KITCHEN_STAFF",
      temporaryPassword: staffPass,
      performedBy: { uid: "test_admin", email: "admin@vivexatech.in" },
    });

    if (!staffRes.success || !staffRes.uid) {
      throw new Error(`Test 1 Failed: ${staffRes.message}`);
    }
    staffUid = staffRes.uid;

    const authUser = await adminAuth.getUser(staffUid);
    if (authUser.customClaims?.role !== "KITCHEN_STAFF" || authUser.customClaims?.restaurantId !== testRest.id) {
      throw new Error("Test 1 Failed: Custom claims mismatch!");
    }

    const userDoc = await adminDb.collection("users").doc(staffUid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "KITCHEN_STAFF") {
      throw new Error("Test 1 Failed: users/{uid} record missing or invalid role!");
    }

    const membSnap = await adminDb.collection("restaurantMemberships").where("uid", "==", staffUid).get();
    if (membSnap.empty) {
      throw new Error("Test 1 Failed: restaurantMemberships record missing!");
    }

    const staffSub = await adminDb.collection("restaurants").doc(testRest.id).collection("staff").doc(staffUid).get();
    if (!staffSub.exists) {
      throw new Error("Test 1 Failed: restaurants/{id}/staff/{uid} subcollection record missing!");
    }

    const list = await getRestaurantStaffList(testRest.id);
    if (!list.some((s) => s.uid === staffUid)) {
      throw new Error("Test 1 Failed: Staff member not returned from getRestaurantStaffList!");
    }
    console.log("   ✅ Test 1 Passed: Restaurant Staff created in Auth and persisted across all Firestore collections.");

    // --- TEST 2: CREATE VIVEXA TEAM STAFF ---
    console.log("\n--- TEST 2: CREATE VIVEXA TEAM STAFF & SECURITY CHECK ---");
    const teamRes = await provisionVivexaTeamMember({
      name: "Pooja Team Test",
      email: teamEmail,
      role: "ONBOARDING_EXECUTIVE",
      temporaryPassword: teamPass,
      performedBy: { uid: "test_admin", email: "admin@vivexatech.in" },
    });

    if (!teamRes.success || !teamRes.uid) {
      throw new Error(`Test 2 Failed: ${teamRes.message}`);
    }
    teamUid = teamRes.uid;

    const teamAuth = await adminAuth.getUser(teamUid);
    if (
      teamAuth.customClaims?.role !== "ONBOARDING_EXECUTIVE" ||
      teamAuth.customClaims?.organization !== "VIVEXA_TECH" ||
      teamAuth.customClaims?.superAdmin === true
    ) {
      throw new Error("Test 2 Failed: Vivexa team claims incorrect or leaked Super Admin!");
    }

    const teamDoc = await adminDb.collection("users").doc(teamUid).get();
    if (!teamDoc.exists || teamDoc.data()?.organization !== "VIVEXA_TECH" || teamDoc.data()?.isSuperAdmin === true) {
      throw new Error("Test 2 Failed: Team Firestore doc incorrect!");
    }
    console.log("   ✅ Test 2 Passed: Vivexa Team Staff created, non-superadmin privilege verified.");

    // --- TEST 3: IDEMPOTENT RECOVERY ---
    console.log("\n--- TEST 3: IDEMPOTENT RE-PROVISIONING (NO DUPLICATES) ---");
    const retryRes = await provisionRestaurantStaff({
      restaurantId: testRest.id,
      name: "Chef Test Arjun",
      email: staffEmail,
      role: "KITCHEN_STAFF",
      performedBy: { uid: "test_admin", email: "admin@vivexatech.in" },
    });

    if (!retryRes.success || retryRes.actionTaken !== "EXISTING_USER_LINKED" || retryRes.uid !== staffUid) {
      throw new Error("Test 3 Failed: Idempotent re-provisioning failed!");
    }
    console.log("   ✅ Test 3 Passed: Existing user recognized and safely linked without duplicate creation.");

    // --- TEST 4: CLIENT LOGIN & TOKEN RESOLUTION ---
    console.log("\n--- TEST 4: REAL CLIENT LOGIN & TOKEN VERIFICATION ---");
    const clientCred = await signInWithEmailAndPassword(clientAuth, staffEmail, staffPass);
    const token = await clientCred.user.getIdToken();
    const verified = await adminAuth.verifyIdToken(token);

    if (verified.role !== "KITCHEN_STAFF" || verified.restaurantId !== testRest.id) {
      throw new Error("Test 4 Failed: Token verification claims mismatch!");
    }
    console.log("   ✅ Test 4 Passed: Client successfully signed in, verified token claims and restaurant association.");

    console.log("\n🎉 ALL STAFF & TEAM PROVISIONING TESTS PASSED 100%!");
  } finally {
    // Clean up test users
    if (staffUid) {
      await adminAuth.deleteUser(staffUid).catch(() => {});
      await adminDb.collection("users").doc(staffUid).delete().catch(() => {});
      await adminDb.collection("restaurantMemberships").doc(`memb_${staffUid}_${testRest.id}`).delete().catch(() => {});
      await adminDb.collection("restaurants").doc(testRest.id).collection("staff").doc(staffUid).delete().catch(() => {});
    }
    if (teamUid) {
      await adminAuth.deleteUser(teamUid).catch(() => {});
      await adminDb.collection("users").doc(teamUid).delete().catch(() => {});
    }
  }
}

runTestSuite().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
