// ==============================================================================
// RESTROCHARGE - Push Notification Token Registry API
// Handles registration, token refresh, and unregistration of browser push subscriptions.
// Strict multi-tenant authorization prevents cross-restaurant push access.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";
import { PushSubscriptionRecord, UserRole } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token: pushToken, restaurantId, deviceType = "desktop" } = body;

    if (!pushToken || typeof pushToken !== "string" || pushToken.length < 10) {
      return NextResponse.json(
        { error: "Invalid registration token" },
        { status: 400 }
      );
    }

    if (!restaurantId || typeof restaurantId !== "string") {
      return NextResponse.json(
        { error: "restaurantId is required" },
        { status: 400 }
      );
    }

    // Tenant isolation verification: caller must be authorized staff/owner for restaurantId
    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json(
        { error: "Push service temporarily unavailable (Admin SDK offline)" },
        { status: 503 }
      );
    }

    const staffUser = authCheck.user!;
    const uid = staffUser.uid;
    const nowIso = new Date().toISOString();

    // Deterministic token doc ID based on uid and token suffix
    const tokenHash = Buffer.from(pushToken.slice(-24)).toString("hex");
    const subId = `sub_${uid}_${tokenHash}`;

    const record: PushSubscriptionRecord = {
      id: subId,
      token: pushToken.trim(),
      userId: uid,
      userEmail: staffUser.email || "",
      userRole: (staffUser.role as UserRole) || "ORDER_STAFF",
      restaurantId,
      deviceType: String(deviceType).slice(0, 30),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await adminDb.collection("pushSubscriptions").doc(subId).set(record, { merge: true });

    return NextResponse.json({
      success: true,
      subscriptionId: subId,
      message: "Browser push token registered successfully.",
    });
  } catch (err: any) {
    console.error("[PushToken API] Registration error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to register push token" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authToken = authHeader.substring(7).trim();

    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json({ success: true });
    }

    const decoded = await adminAuth.verifyIdToken(authToken);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const { token: pushToken, restaurantId } = body;

    const collectionRef = adminDb.collection("pushSubscriptions");
    let query: any = collectionRef.where("userId", "==", uid);

    if (restaurantId) {
      query = query.where("restaurantId", "==", restaurantId);
    }
    if (pushToken) {
      query = query.where("token", "==", pushToken.trim());
    }

    const snap = await query.get();
    const batch = adminDb.batch();
    snap.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      removedCount: snap.size,
      message: "Push subscription successfully unregistered.",
    });
  } catch (err: any) {
    console.error("[PushToken API] Deletion error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to unregister push token" },
      { status: 500 }
    );
  }
}
