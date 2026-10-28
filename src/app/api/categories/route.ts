// ==============================================================================
// RESTROCHARGE - Product Categories API Route
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { generateId } from "@/lib/utils";
import { ProductCategory } from "@/lib/types";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required." }, { status: 400 });
    }
    const categories = dataStore.getCategories(restaurantId);
    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, name, description, sortOrder = 0 } = body;

    if (!restaurantId || !name) {
      return NextResponse.json({ error: "Missing required category fields." }, { status: 400 });
    }

    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const newCategory: ProductCategory = {
      id: generateId("cat"),
      restaurantId,
      name,
      description,
      sortOrder: Number(sortOrder),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    dataStore.saveCategory(newCategory);
    return NextResponse.json({ success: true, category: newCategory }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Category id required" }, { status: 400 });

    const existing = dataStore.getCategories(updates.restaurantId || "").find((c) => c.id === id);
    if (!existing) {
      // Find across all
      const allR = dataStore.getRestaurants();
      let found: ProductCategory | undefined;
      for (const r of allR) {
        const cat = dataStore.getCategories(r.id).find((c) => c.id === id);
        if (cat) {
          found = cat;
          break;
        }
      }
      if (!found) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      const updated = dataStore.saveCategory({ ...found, ...updates });
      return NextResponse.json({ success: true, category: updated });
    }

    const updated = dataStore.saveCategory({ ...existing, ...updates });
    return NextResponse.json({ success: true, category: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    dataStore.deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
