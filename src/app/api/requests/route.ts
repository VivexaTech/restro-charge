// ==============================================================================
// RESTROCHARGE - Restaurant Registration & Onboarding Requests API
// Public submission & Super Admin approval workflow.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { sendEmail, getRegistrationRequestTemplate, getOnboardingApprovedTemplate } from "@/lib/services/email";
import { generateId, slugify } from "@/lib/utils";
import { RestaurantProfile, RestaurantRegistrationRequest } from "@/lib/types";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function GET() {
  try {
    const requests = dataStore.getRequests();
    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicantName, restaurantName, email, phone, city, cuisine, estimatedTables, message } = body;

    if (!applicantName || !restaurantName || !email || !phone || !city) {
      return NextResponse.json({ error: "Please provide all required fields." }, { status: 400 });
    }

    const newRequest: RestaurantRegistrationRequest = {
      id: generateId("req"),
      applicantName,
      restaurantName,
      email,
      phone,
      city,
      cuisine: cuisine || "Multi-Cuisine",
      estimatedTables: Number(estimatedTables) || 10,
      message,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    dataStore.saveRequest(newRequest);

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: `Registration Request Received - ${restaurantName} (RestroCharge)`,
      html: getRegistrationRequestTemplate(applicantName, restaurantName),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your onboarding request has been submitted to Vivexa Tech. Our team will contact you shortly.",
        request: newRequest,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const body = await req.json();
    const { requestId, action, reviewedBy = "Vivexa Super Admin" } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: "Missing requestId or action." }, { status: 400 });
    }

    const requests = dataStore.getRequests();
    const target = requests.find((r) => r.id === requestId);
    if (!target) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    target.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    target.reviewedBy = reviewedBy;
    target.reviewedAt = new Date().toISOString();
    dataStore.saveRequest(target);

    // If approved, create initial restaurant profile
    let createdRestaurant: RestaurantProfile | null = null;
    if (action === "APPROVE") {
      const slug = slugify(target.restaurantName);
      const restId = generateId("rest");
      const now = new Date();
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 30); // 30-day initial period
      const grace = new Date(expiry);
      grace.setDate(grace.getDate() + 3);

      createdRestaurant = {
        id: restId,
        name: target.restaurantName,
        slug,
        cuisineType: target.cuisine,
        description: `Welcome to ${target.restaurantName}, serving fresh authentic cuisine in ${target.city}.`,
        ownerUid: `usr_${Date.now()}`,
        ownerEmail: target.email,
        ownerName: target.applicantName,
        phone: target.phone,
        address: `${target.city} Central`,
        city: target.city,
        state: "State",
        postalCode: "110001",
        published: true,
        operationalSettings: {
          isAcceptingOrders: true,
          currency: "INR",
          tableCount: target.estimatedTables || 10,
        },
        branding: {
          logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&h=200&q=80",
          coverImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
          primaryColor: "#ea580c",
          secondaryColor: "#9a3412",
          accentColor: "#fb923c",
          fontPreset: "outfit",
          galleryImages: [],
        },
        websiteConfig: {
          heroTitle: `Experience Culinary Delights at ${target.restaurantName}`,
          heroSubtitle: "Handcrafted dishes and exceptional hospitality.",
          heroLayout: "centered",
          menuLayout: "categorized",
          aboutText: `${target.restaurantName} brings you the finest culinary delicacies made with high quality ingredients and traditional recipes.`,
          openingHours: [{ days: "Daily", open: "11:00 AM", close: "11:00 PM" }],
          contactPhone: target.phone,
          contactEmail: target.email,
          address: `${target.city} Central`,
          city: target.city,
          amenities: ["Dine-in", "Family Seating", "Air Conditioned"],
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
        subscription: {
          planId: "plan_pro",
          planName: "Growth & KDS Pro",
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          startDate: now.toISOString(),
          expiryDate: expiry.toISOString(),
          gracePeriodEnd: grace.toISOString(),
          autoRenew: false,
          updatedAt: now.toISOString(),
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      dataStore.saveRestaurant(createdRestaurant);

      // Send approval notification email with login and website link
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in"}/login`;
      await sendEmail({
        to: target.email,
        subject: `Your Restaurant is Live on RestroCharge - ${target.restaurantName}`,
        html: getOnboardingApprovedTemplate(target.restaurantName, loginUrl, slug),
      });

      dataStore.addAuditLog({
        action: "APPROVE_ONBOARDING_REQUEST",
        targetType: "RESTAURANT",
        targetId: createdRestaurant.id,
        performedBy: {
          uid: "vivexa_admin",
          email: "admin@vivexatech.in",
          name: reviewedBy,
        },
        details: {
          requestId: target.id,
          restaurantName: target.restaurantName,
          slug,
        },
      });
    }

    return NextResponse.json({
      success: true,
      request: target,
      createdRestaurant,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
