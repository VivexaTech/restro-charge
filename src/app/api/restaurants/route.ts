// ==============================================================================
// RESTROCHARGE - Restaurants API Route Handler
// Full multi-tenant listing and Super Admin restaurant creation with Firestore persistence.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";
import { RestaurantProfile } from "@/lib/types";
import { provisionRestaurantAdmin } from "@/lib/services/admin-provisioning";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publishedOnly = searchParams.get("published") === "true";

    // 1. Fetch authoritative restaurant list from Cloud Firestore
    let restaurants: RestaurantProfile[] = [];
    try {
      const fromDb = await firestoreService.getRestaurants();
      if (fromDb && fromDb.length > 0) {
        // Sync into dataStore cache so local memory remains consistent
        fromDb.forEach((r) => dataStore.saveRestaurantLocally(r));
        restaurants = fromDb;
      }
    } catch (dbErr: any) {
      console.warn("[Restaurants API] Firestore fetch warning:", dbErr.message);
    }

    // 2. Fall back to dataStore memory cache if Firestore was empty or unreachable
    if (restaurants.length === 0) {
      restaurants = dataStore.getRestaurants();
    }

    if (publishedOnly) {
      restaurants = restaurants.filter((r) => r.published);
    }

    return NextResponse.json({ restaurants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize Super Admin
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const body = await req.json();

    // 2. Validate Required Fields
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const adminEmail = typeof body.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : "";
    const adminName = typeof body.adminName === "string" && body.adminName.trim() ? body.adminName.trim() : (body.ownerName || `${name} Admin`);
    const contactNumber = typeof body.contactNumber === "string" ? body.contactNumber.trim() : (body.phone || "");
    const planId = body.planId || body.subscriptionPlan || "plan_starter";
    const status = body.status || "ACTIVE";

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Restaurant Name is required (minimum 2 characters)." }, { status: 400 });
    }

    // Slug Normalization
    const cleanSlug = (rawSlug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json({ error: "Valid Restaurant Slug is required (minimum 2 alphanumeric characters)." }, { status: 400 });
    }

    if (!adminEmail || !/^\S+@\S+\.\S+$/.test(adminEmail)) {
      return NextResponse.json({ error: "A valid Restaurant Admin Email is required." }, { status: 400 });
    }

    if (!contactNumber || contactNumber.length < 7) {
      return NextResponse.json({ error: "A valid Contact Number is required." }, { status: 400 });
    }

    // 3. Backend Slug Uniqueness Enforcement
    const existingInStore = dataStore.getRestaurantBySlug(cleanSlug);
    if (existingInStore) {
      return NextResponse.json(
        { error: `Restaurant slug '${cleanSlug}' is already in use. Please specify a unique slug.` },
        { status: 409 }
      );
    }

    const existingInDb = await firestoreService.getRestaurantBySlug(cleanSlug);
    if (existingInDb) {
      return NextResponse.json(
        { error: `Restaurant slug '${cleanSlug}' is already registered in the database. Please specify a unique slug.` },
        { status: 409 }
      );
    }

    // 4. Parse Coordinates & Ordering Radius
    let lat: number | null = null;
    let lon: number | null = null;
    if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
      const parsed = parseFloat(body.latitude);
      if (!isNaN(parsed) && parsed >= -90 && parsed <= 90) {
        lat = parsed;
      }
    }
    if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
      const parsed = parseFloat(body.longitude);
      if (!isNaN(parsed) && parsed >= -180 && parsed <= 180) {
        lon = parsed;
      }
    }

    let radius = Number(body.orderingRadiusMetres ?? body.radiusMeters ?? 200);
    if (isNaN(radius) || radius < 10) radius = 200;
    if (radius > 50000) radius = 50000;

    const locationRestrictionEnabled = Boolean(body.locationRestrictionEnabled);
    const isConfigured = lat !== null && lon !== null;

    // 5. Subscription & Trial Dates
    const nowIso = new Date().toISOString();
    const isTrial = body.subscriptionStatus === "TRIAL" || status === "TRIAL";
    const trialDays = Number(body.trialDurationDays || body.trialDuration || 14);

    let trialStartAt: string | undefined = undefined;
    let trialExpiresAt: string | undefined = undefined;
    let expiryDate: string;

    if (isTrial) {
      trialStartAt = nowIso;
      const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      trialExpiresAt = trialEnd.toISOString();
      expiryDate = trialExpiresAt;
    } else {
      const oneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expiryDate = oneMonth.toISOString();
    }

    // 6. Build New Restaurant Document
    const restaurantId = `rest_${cleanSlug.replace(/-/g, "_")}_${Date.now().toString(36)}`;

    const newRestaurant: RestaurantProfile = {
      id: restaurantId,
      name,
      slug: cleanSlug,
      cuisineType: body.cuisine || body.cuisineType || "Multi-Cuisine",
      ownerUid: body.ownerUid || `usr_admin_${cleanSlug}`,
      ownerEmail: adminEmail,
      ownerName: adminName,
      phone: contactNumber,
      address: body.address || body.street || "Main Market",
      city: body.city || "Jaipur",
      state: body.state || "Rajasthan",
      postalCode: body.postalCode || "302001",
      published: body.published ?? true,
      description: body.description || `${name} offers a curated dining experience with online QR ordering.`,
      branding: {
        logoUrl: body.logoUrl || "",
        coverImageUrl: body.coverImageUrl || "",
        primaryColor: body.primaryColor || "#3b82f6",
        secondaryColor: body.secondaryColor || "#1e293b",
        accentColor: body.accentColor || "#f97316",
        fontPreset: body.fontPreset || "inter",
        galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages : [],
      },
      websiteConfig: {
        heroTitle: body.websiteConfig?.heroTitle || `Experience Delicious Food at ${name}`,
        heroSubtitle: body.websiteConfig?.heroSubtitle || "Fresh ingredients, authentic flavors, and seamless contactless ordering.",
        heroLayout: body.websiteConfig?.heroLayout || "centered",
        menuLayout: body.websiteConfig?.menuLayout || "grid",
        aboutText: body.websiteConfig?.aboutText || body.description || `${name} offers a curated dining experience with online QR ordering.`,
        openingHours: Array.isArray(body.openingHours)
          ? body.openingHours
          : [{ days: "Daily", open: "11:00 AM", close: "11:00 PM" }],
        contactPhone: contactNumber,
        contactEmail: adminEmail,
        address: body.address || "Main Market",
        city: body.city || "Jaipur",
        directionsUrl: body.directionsUrl || "",
        amenities: Array.isArray(body.amenities)
          ? body.amenities
          : ["Dine-in", "Contactless QR Ordering", "Air Conditioned"],
        socialLinks: {
          instagram: body.instagram || body.socialLinks?.instagram || "",
          facebook: body.facebook || body.socialLinks?.facebook || "",
          twitter: body.twitter || body.socialLinks?.twitter || "",
        },
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
        itemOnly: body.itemOnly ?? true,
        gstEnabled: body.gstEnabled ?? true,
        gstRate: Number(body.gstRate ?? 5),
        serviceChargeEnabled: body.serviceChargeEnabled ?? false,
        serviceChargeRate: Number(body.serviceChargeRate ?? 0),
        calculationBasis: body.calculationBasis || "TAX_ON_SUBTOTAL",
      },
      locationSettings: {
        latitude: lat,
        longitude: lon,
        orderingRadiusMetres: radius,
        locationRestrictionEnabled,
        isConfigured,
        addressSnapshot: body.addressSnapshot || `${body.address || "Main Street"}, ${body.city || "Jaipur"}`,
      },
      subscription: {
        planId,
        planName: planId === "plan_enterprise" ? "Enterprise" : planId === "plan_pro" ? "Growth" : "Starter",
        status: isTrial ? "TRIAL" : "ACTIVE",
        billingCycle: "MONTHLY",
        startDate: nowIso,
        expiryDate,
        gracePeriodEnd: new Date(new Date(expiryDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        autoRenew: false,
        updatedAt: nowIso,
        isTrial,
        trialDays: isTrial ? trialDays : undefined,
        trialStartDate: isTrial ? trialStartAt : undefined,
        trialEndDate: isTrial ? trialExpiresAt : undefined,
      },
      operationalSettings: {
        isAcceptingOrders: body.qrOrderingEnabled ?? body.isAcceptingOrders ?? true,
        currency: "INR",
        tableCount: Number(body.tableCount || 10),
      },
      adminProvisioningStatus: "PENDING",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 7. Persist to Firestore and in-memory cache
    dataStore.saveRestaurant(newRestaurant);
    try {
      await firestoreService.saveRestaurant(newRestaurant);
    } catch (dbErr: any) {
      console.warn("[Restaurants API] Firestore write warning:", dbErr.message);
    }

    // 8. Provision Restaurant Admin Account (Isolated Operation via admin-provisioning service)
    const provResult = await provisionRestaurantAdmin({
      restaurantId: newRestaurant.id,
      adminEmail,
      adminName,
      temporaryPassword: body.password || body.temporaryPassword,
      performedBy: {
        uid: authCheck.user?.uid || "admin",
        email: authCheck.user?.email || "admin@vivexatech.in",
        name: "Super Admin",
      },
    });

    const finalRestaurant =
      provResult.restaurant ||
      dataStore.getRestaurantById(newRestaurant.id) ||
      newRestaurant;

    // 9. Record Super Admin Audit Log
    dataStore.addAuditLog({
      action: "CREATE_RESTAURANT",
      targetType: "RESTAURANT",
      targetId: newRestaurant.id,
      performedBy: {
        uid: authCheck.user?.uid || "admin",
        email: authCheck.user?.email || "admin@vivexatech.in",
        name: "Super Admin",
      },
      details: {
        name: finalRestaurant.name,
        slug: finalRestaurant.slug,
        adminEmail,
        planId,
        adminProvisioningStatus: provResult.status,
        actionTaken: provResult.actionTaken,
      },
    });

    return NextResponse.json(
      {
        success: true,
        restaurant: finalRestaurant,
        adminProvisioning: {
          status: provResult.status,
          actionTaken: provResult.actionTaken,
          message: provResult.message,
          resetLink: provResult.resetLink,
          error: provResult.error,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[Restaurants API POST Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to create restaurant" }, { status: 500 });
  }
}
