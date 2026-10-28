// ==============================================================================
// RESTROCHARGE - CLI Super Admin Provisioning Script
// Verifies and provisions designated Super Admin UID: GDF2eldrzSNR9oltgezCr9MXt0I3
// ==============================================================================

import * as admin from "firebase-admin";

if (process.loadEnvFile) {
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    console.warn("Notice: .env.local not found or failed to load.");
  }
}

const SUPER_ADMIN_UID = "GDF2eldrzSNR9oltgezCr9MXt0I3";

async function main() {
  console.log("================================================================");
  console.log("  RESTROCHARGE - SUPER ADMIN PROVISIONING PROTOCOL");
  console.log("================================================================");
  console.log(`Target Designated UID: ${SUPER_ADMIN_UID}`);

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey || !privateKey.includes("BEGIN PRIVATE KEY")) {
    console.error("\n❌ Missing or incomplete Firebase Admin credentials in environment.");
    console.log("   Required environment variables:");
    console.log("   - FIREBASE_ADMIN_PROJECT_ID");
    console.log("   - FIREBASE_ADMIN_CLIENT_EMAIL");
    console.log("   - FIREBASE_ADMIN_PRIVATE_KEY");
    process.exit(1);
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    const auth = app.auth();
    const db = app.firestore();

    console.log("\n1. Verifying user in Firebase Authentication...");
    const user = await auth.getUser(SUPER_ADMIN_UID);
    console.log(`   ✅ User found: ${user.email} (UID: ${user.uid})`);

    console.log("\n2. Setting custom user claims...");
    await auth.setCustomUserClaims(SUPER_ADMIN_UID, {
      role: "SUPER_ADMIN",
      superAdmin: true,
    });
    console.log("   ✅ Claims set: { role: 'SUPER_ADMIN', superAdmin: true }");

    console.log("\n3. Updating Firestore user document in /users/" + SUPER_ADMIN_UID + "...");
    await db.collection("users").doc(SUPER_ADMIN_UID).set(
      {
        uid: SUPER_ADMIN_UID,
        email: user.email || "admin@vivexatech.in",
        displayName: user.displayName || "Vivexa Tech Super Admin",
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("   ✅ Firestore user record updated.");

    console.log("\n================================================================");
    console.log("🎉 SUPER ADMIN PROVISIONING COMPLETED SUCCESSFULLY!");
    console.log("================================================================");
  } catch (err: any) {
    if (err.code === "auth/user-not-found") {
      console.error(`\n⚠️ User UID '${SUPER_ADMIN_UID}' does not exist in Firebase Authentication yet.`);
      console.log("   Manual Action Required:");
      console.log("   1. Open the Firebase Console -> Authentication -> Users tab.");
      console.log("   2. Add user with UID: " + SUPER_ADMIN_UID);
      console.log("   3. Re-run this script: npx tsx scripts/provision-super-admin.ts");
    } else {
      console.error("\n❌ Provisioning failed:", err.message || err);
    }
    process.exit(1);
  }
}

main();
