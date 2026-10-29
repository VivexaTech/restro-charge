// ==============================================================================
// RESTROCHARGE - Vivexa Tech Super Admin Account Provisioning Script
// Secure server-side provisioning via Firebase Admin SDK
// Usage: npx tsx --env-file=.env.local scripts/provision-super-admin.ts [optional-password]
// ==============================================================================

import { adminAuth, adminDb, isFirebaseAdminReady } from "../src/lib/firebase/admin";
import { SUPER_ADMIN_UID } from "../src/lib/auth/server-auth";
import crypto from "crypto";

const TARGET_EMAIL = "admin@vivexatech.in";
const TARGET_DISPLAY_NAME = "Vivexa Tech Super Admin";

async function provisionSuperAdmin() {
  console.log("==================================================================");
  console.log("RestroCharge - Vivexa Tech Super Admin Provisioning Service");
  console.log("==================================================================");

  if (!isFirebaseAdminReady()) {
    console.error("❌ Error: Firebase Admin SDK is not ready.");
    console.error("Please verify FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local");
    process.exit(1);
  }

  const cliPassword = process.argv[2];
  let targetUid = SUPER_ADMIN_UID;
  let userRecord;

  // 1. Check if user exists by email or designated UID
  try {
    userRecord = await adminAuth.getUserByEmail(TARGET_EMAIL);
    targetUid = userRecord.uid;
    console.log(`ℹ️ Existing account found for ${TARGET_EMAIL} (UID: ${targetUid})`);
  } catch (err: any) {
    if (err.code === "auth/user-not-found") {
      try {
        userRecord = await adminAuth.getUser(SUPER_ADMIN_UID);
        targetUid = userRecord.uid;
        console.log(`ℹ️ Account found by designated UID ${SUPER_ADMIN_UID}`);
      } catch (err2: any) {
        if (err2.code === "auth/user-not-found") {
          console.log(`ℹ️ Account does not exist in Firebase Auth. Creating new account...`);
        } else {
          throw err2;
        }
      }
    } else {
      throw err;
    }
  }

  // 2. Create or Update user in Firebase Auth
  const passwordToSet = cliPassword || crypto.randomBytes(12).toString("base64") + "@Rc1";

  if (!userRecord) {
    userRecord = await adminAuth.createUser({
      uid: SUPER_ADMIN_UID,
      email: TARGET_EMAIL,
      displayName: TARGET_DISPLAY_NAME,
      emailVerified: true,
      password: passwordToSet,
    });
    console.log(`✅ Created Firebase Auth account for ${TARGET_EMAIL} with designated UID.`);
    if (!cliPassword) {
      console.log(`🔑 Temporary initial password generated: ${passwordToSet}`);
      console.log(`⚠️ Please sign in and update password immediately.`);
    }
  } else {
    const updatePayload: any = {
      emailVerified: true,
      displayName: TARGET_DISPLAY_NAME,
    };
    if (cliPassword) {
      updatePayload.password = cliPassword;
    }
    userRecord = await adminAuth.updateUser(targetUid, updatePayload);
    console.log(`✅ Firebase Auth user record updated.`);
    if (cliPassword) {
      console.log(`🔑 Password updated successfully.`);
    }
  }

  // 3. Set Firebase Custom Claims for Super Admin
  await adminAuth.setCustomUserClaims(targetUid, {
    role: "SUPER_ADMIN",
    superAdmin: true,
  });
  console.log(`✅ Firebase Custom Claims assigned: { role: "SUPER_ADMIN", superAdmin: true }`);

  // 4. Create/update trusted server-side role record in Firestore
  try {
    await adminDb.collection("users").doc(targetUid).set(
      {
        uid: targetUid,
        email: TARGET_EMAIL,
        displayName: TARGET_DISPLAY_NAME,
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`✅ Firestore user role record persisted in users/${targetUid}`);
  } catch (dbErr: any) {
    console.warn(`⚠️ Firestore user doc write note: ${dbErr.message}`);
  }

  console.log("==================================================================");
  console.log("🎉 Super Admin Provisioning Complete!");
  console.log(`Email: ${TARGET_EMAIL}`);
  console.log(`UID: ${targetUid}`);
  console.log(`Role: SUPER_ADMIN (Enforced by signed token claims & server role)`);
  console.log("==================================================================");
}

provisionSuperAdmin().catch((err) => {
  console.error("❌ Provisioning failed:", err.message || err);
  process.exit(1);
});
