// ==============================================================================
// RESTROCHARGE - Restaurants API Route Handler
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publishedOnly = searchParams.get("published") === "true";

    const restaurants = publishedOnly
      ? dataStore.getPublishedRestaurants()
      : dataStore.getRestaurants();

    return NextResponse.json({ restaurants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newRest = dataStore.saveRestaurant(body);
    return NextResponse.json({ success: true, restaurant: newRest }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
