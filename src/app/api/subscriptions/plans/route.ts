// ==============================================================================
// RESTROCHARGE - Central Subscription Plans API Route
// Single source of truth for pricing across public site and dashboards.
// Vivexa Tech Super Admin can view, update, and manage plan pricing and limits.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";
import { SubscriptionPlan } from "@/lib/types";

export async function GET() {
  try {
    const plans = dataStore.getPlans();
    return NextResponse.json({ plans });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse || NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, tagline, monthlyPrice, annualPrice, features, limits, isPopular, isActive } = body;

    if (!id || monthlyPrice === undefined) {
      return NextResponse.json(
        { error: "Plan ID and monthly price are required." },
        { status: 400 }
      );
    }

    const existing = dataStore.getPlanById(id);
    if (!existing) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    const updatedPlan: SubscriptionPlan = {
      ...existing,
      name: name || existing.name,
      tagline: tagline || existing.tagline,
      monthlyPrice: Number(monthlyPrice),
      annualPrice: annualPrice !== undefined ? Number(annualPrice) : Number(monthlyPrice) * 10,
      features: Array.isArray(features) ? features : existing.features,
      limits: limits || existing.limits,
      isPopular: isPopular !== undefined ? Boolean(isPopular) : existing.isPopular,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
    };

    dataStore.savePlan(updatedPlan);

    // Audit log
    dataStore.addAuditLog({
      action: "UPDATE_SUBSCRIPTION_PLAN",
      targetType: "SUBSCRIPTION",
      targetId: id,
      performedBy: {
        uid: authCheck.user?.uid || "GDF2eldrzSNR9oltgezCr9MXt0I3",
        email: authCheck.user?.email || "admin@vivexatech.in",
        name: "Vivexa Tech Super Admin",
      },
      details: {
        planId: id,
        newMonthlyPrice: updatedPlan.monthlyPrice,
        newAnnualPrice: updatedPlan.annualPrice,
      },
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
