// ==============================================================================
// RESTROCHARGE - Staff Notification Preferences API
// Authoritative backend persistence of order sound selection and notification settings.
// Strictly validates filenames against permitted set; prevents arbitrary URLs or paths.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import {
  ALLOWED_SOUND_FILES,
  DEFAULT_SOUND,
  isValidSoundFile,
} from "@/lib/services/audio-alert-service";
import { StaffNotificationPreferences, NotificationSoundFile } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7).trim();

    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json({
        preferences: {
          orderSound: DEFAULT_SOUND,
          soundEnabled: true,
          browserPushEnabled: false,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const data = userDoc.data();

    const preferences: StaffNotificationPreferences = {
      orderSound:
        data?.notificationPreferences?.orderSound &&
        isValidSoundFile(data.notificationPreferences.orderSound)
          ? data.notificationPreferences.orderSound
          : DEFAULT_SOUND,
      soundEnabled:
        typeof data?.notificationPreferences?.soundEnabled === "boolean"
          ? data.notificationPreferences.soundEnabled
          : true,
      browserPushEnabled:
        typeof data?.notificationPreferences?.browserPushEnabled === "boolean"
          ? data.notificationPreferences.browserPushEnabled
          : false,
      updatedAt:
        data?.notificationPreferences?.updatedAt || new Date().toISOString(),
    };

    return NextResponse.json({ success: true, preferences });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load notification settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7).trim();

    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Firebase Admin SDK not ready" },
        { status: 503 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json();
    const { orderSound, soundEnabled, browserPushEnabled } = body;

    // Strict validation: Never allow arbitrary URLs or unrecognized filenames
    if (orderSound !== undefined && !isValidSoundFile(orderSound)) {
      return NextResponse.json(
        {
          error:
            "Invalid sound file selection. Must be one of the permitted sound choices: /a1.mp3, /a2.mp3, /a3.mp3, /a4.mp4, /a5.mp3.",
          permittedFiles: Array.from(ALLOWED_SOUND_FILES),
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const currentPrefs = userSnap.data()?.notificationPreferences || {};

    const updatedPrefs: StaffNotificationPreferences = {
      orderSound: orderSound !== undefined ? orderSound : currentPrefs.orderSound || DEFAULT_SOUND,
      soundEnabled:
        soundEnabled !== undefined ? Boolean(soundEnabled) : currentPrefs.soundEnabled ?? true,
      browserPushEnabled:
        browserPushEnabled !== undefined
          ? Boolean(browserPushEnabled)
          : currentPrefs.browserPushEnabled ?? false,
      updatedAt: nowIso,
    };

    await userRef.set(
      {
        notificationPreferences: updatedPrefs,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, preferences: updatedPrefs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save notification settings" },
      { status: 500 }
    );
  }
}
