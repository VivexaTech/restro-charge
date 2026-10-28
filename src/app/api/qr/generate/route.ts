// ==============================================================================
// RESTROCHARGE - QR Code Generation Route (VIVEXA TECH SUPER ADMIN ONLY)
// Strictly forbids generation by restaurant owners or staff.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { generateTableQRCode } from "@/lib/services/qr";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function POST(req: NextRequest) {
  try {
    // 1. Strict Server-Side Authorization: Only Vivexa Tech Team can generate QR codes!
    const authCheck = await verifySuperAdminPermission(req);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const body = await req.json();
    const { restaurantId, tableId } = body;

    if (!restaurantId || !tableId) {
      return NextResponse.json(
        { error: "restaurantId and tableId are required." },
        { status: 400 }
      );
    }

    const restaurant = dataStore.getRestaurantById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const tables = dataStore.getTables(restaurantId);
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      return NextResponse.json({ error: "Table not found." }, { status: 404 });
    }

    // Generate QR Data URL
    const qrResult = await generateTableQRCode(restaurant.slug, table.code);

    // Persist QR Code to Table Record
    table.qrCodeUrl = qrResult.dataUrl;
    dataStore.saveTable(table);

    // Audit Log
    dataStore.addAuditLog({
      action: "GENERATE_TABLE_QR",
      targetType: "TABLE_QR",
      targetId: table.id,
      performedBy: {
        uid: "vivexa_admin",
        email: "admin@vivexatech.in",
        name: "Vivexa Tech Admin",
      },
      details: {
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        tableLabel: table.displayLabel,
        tableCode: table.code,
        targetUrl: qrResult.targetUrl,
      },
    });

    return NextResponse.json({
      success: true,
      qrDataUrl: qrResult.dataUrl,
      svgString: qrResult.svgString,
      targetUrl: qrResult.targetUrl,
      table,
    });
  } catch (error: any) {
    console.error("[QR Generation API Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to generate QR" }, { status: 500 });
  }
}
