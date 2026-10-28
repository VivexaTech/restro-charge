// ==============================================================================
// RESTROCHARGE - Table Management Route Handler
// Creation and QR assignment restricted to Vivexa Tech Super Admin.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { generateTableQRCode } from "@/lib/services/qr";
import { generateId, slugify } from "@/lib/utils";
import { TableItem } from "@/lib/types";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required." }, { status: 400 });
    }

    const tables = dataStore.getTables(restaurantId);
    return NextResponse.json({ tables });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Strict authorization: Only Vivexa Tech team can create restaurant tables & assign QR!
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const body = await req.json();
    const {
      restaurantId,
      displayLabel,
      code,
    } = body;

    if (!restaurantId || !displayLabel) {
      return NextResponse.json(
        { error: "restaurantId and displayLabel are required." },
        { status: 400 }
      );
    }

    const restaurant = dataStore.getRestaurantById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const tableCode = slugify(code || displayLabel);
    const tableId = generateId("tbl");

    // Generate QR automatically by Vivexa team
    const qrResult = await generateTableQRCode(restaurant.slug, tableCode);

    const newTable: TableItem = {
      id: tableId,
      restaurantId,
      restaurantSlug: restaurant.slug,
      displayLabel,
      code: tableCode,
      qrCodeUrl: qrResult.dataUrl,
      isActive: true,
      createdAt: new Date().toISOString(),
      generatedBy: "vivexa_admin",
    };

    dataStore.saveTable(newTable);

    dataStore.addAuditLog({
      action: "CREATE_TABLE_WITH_QR",
      targetType: "TABLE_QR",
      targetId: newTable.id,
      performedBy: {
        uid: "vivexa_admin",
        email: "admin@vivexatech.in",
        name: "Vivexa Tech Team",
      },
      details: {
        restaurantId,
        displayLabel,
        code: tableCode,
      },
    });

    return NextResponse.json({ success: true, table: newTable }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
