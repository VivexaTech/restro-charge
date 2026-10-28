// ==============================================================================
// RESTROCHARGE - Product Items API Route
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { generateId } from "@/lib/utils";
import { ProductItem } from "@/lib/types";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required." }, { status: 400 });
    }
    const products = dataStore.getProducts(restaurantId);
    return NextResponse.json({ products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId,
      categoryId,
      name,
      description,
      price,
      isVeg = true,
      dietaryType,
      portions,
      isAvailable = true,
      isFeatured = false,
      imageUrl,
      sortOrder = 0,
    } = body;

    if (!restaurantId || !categoryId || !name || price === undefined) {
      return NextResponse.json({ error: "Missing required product fields." }, { status: 400 });
    }

    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const determinedDietaryType = dietaryType || (isVeg ? "veg" : "non_veg");

    const newProduct: ProductItem = {
      id: generateId("prod"),
      restaurantId,
      categoryId,
      name,
      description: description || "",
      price: Math.max(0, Number(price)),
      isVeg: determinedDietaryType === "veg",
      dietaryType: determinedDietaryType,
      portions: Array.isArray(portions) ? portions : undefined,
      isAvailable: Boolean(isAvailable),
      isFeatured: Boolean(isFeatured),
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
      sortOrder: Number(sortOrder),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dataStore.saveProduct(newProduct);
    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Product id required" }, { status: 400 });

    const existing = dataStore.getProductById(id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = dataStore.saveProduct({
      ...existing,
      ...updates,
      price: updates.price !== undefined ? Math.max(0, Number(updates.price)) : existing.price,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    dataStore.deleteProduct(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
