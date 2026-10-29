// ==============================================================================
// RESTROCHARGE - Check Restaurant Slug Uniqueness API
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Slug query parameter is required." }, { status: 400 });
    }

    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (cleanSlug.length < 2) {
      return NextResponse.json(
        { available: false, slug: cleanSlug, error: "Slug must be at least 2 characters." },
        { status: 400 }
      );
    }

    // Reserved system routes
    const reservedSlugs = [
      "api",
      "super-admin",
      "dashboard",
      "staff",
      "login",
      "order",
      "restaurants",
      "pricing",
      "about",
      "menu",
      "admin",
      "settings",
      "auth",
    ];

    if (reservedSlugs.includes(cleanSlug)) {
      return NextResponse.json(
        { available: false, slug: cleanSlug, error: "This slug is reserved for system routes." },
        { status: 200 }
      );
    }

    // 1. Check dataStore cache
    const existingInStore = dataStore.getRestaurantBySlug(cleanSlug);
    if (existingInStore) {
      return NextResponse.json({ available: false, slug: cleanSlug }, { status: 200 });
    }

    // 2. Check Firestore
    const existingInDb = await firestoreService.getRestaurantBySlug(cleanSlug);
    if (existingInDb) {
      return NextResponse.json({ available: false, slug: cleanSlug }, { status: 200 });
    }

    return NextResponse.json({ available: true, slug: cleanSlug }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
