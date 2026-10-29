// ==============================================================================
// RESTROCHARGE - Table Management Route Handler
// Creation and QR assignment restricted to Vivexa Tech Super Admin.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { generateTableQRCode } from "@/lib/services/qr";
import { generateId, slugify } from "@/lib/utils";
import { TableItem } from "@/lib/types";
import { verifySuperAdminPermission } from "@/lib/auth/server-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let restaurantId = searchParams.get("restaurantId");

    if (!restaurantId || !restaurantId.trim()) {
      const all = dataStore.getRestaurants();
      if (all.length > 0) {
        restaurantId = all[0].id;
      }
    }

    if (!restaurantId) {
      return NextResponse.json({ tables: [] });
    }

    let tables = dataStore.getTables(restaurantId);
    if (tables.length === 0) {
      try {
        const fromDb = await firestoreService.getTables(restaurantId);
        if (fromDb && fromDb.length > 0) {
          fromDb.forEach((t) => dataStore.saveTable(t));
          tables = fromDb;
        }
      } catch (dbErr: any) {
        console.warn("[Tables API] Firestore getTables error:", dbErr.message);
      }
    }
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
