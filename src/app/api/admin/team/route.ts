// ==============================================================================
// RESTROCHARGE - Vivexa Tech Internal Team API Route
// GET /api/admin/team - Fetches internal platform administrators & executives
// POST /api/admin/team - Provisions Vivexa internal accounts via Firebase Admin SDK
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";
import {
  provisionVivexaTeamMember,
  getVivexaTeamList,
} from "@/lib/services/staff-provisioning";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const team = await getVivexaTeamList();
    return NextResponse.json({ success: true, team });
  } catch (err: any) {
    console.error("[Team API GET error]:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch team list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const body = await req.json();
    const { name, email, role, password } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Member full name is required (minimum 2 characters)." }, { status: 400 });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const validRoles = ["SUPER_ADMIN", "SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role '${role}'. Role must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const result = await provisionVivexaTeamMember({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      temporaryPassword: password,
      performedBy: {
        uid: authCheck.user?.uid || "admin",
        email: authCheck.user?.email || "admin@vivexatech.in",
        name: "Vivexa Tech Super Admin",
      },
    });

    if (!result.success) {
      const statusCode = result.status === "PARTIAL_FAILURE" ? 502 : 400;
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.message,
          errorCode: result.errorCode,
          uid: result.uid,
          actionTaken: result.actionTaken,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        actionTaken: result.actionTaken,
        message: result.message,
        member: result.staff,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[Team API POST error]:", err);
    return NextResponse.json({ error: err.message || "Failed to add team member" }, { status: 500 });
  }
}
