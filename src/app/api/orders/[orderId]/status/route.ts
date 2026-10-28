// ==============================================================================
// RESTROCHARGE - Order Status Lifecycle Route Handler
// Handles transitions: NEW -> ACCEPTED -> PREPARING -> READY -> SERVED / CANCELLED
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { OrderStatus } from "@/lib/types";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const body = await req.json();
    const { status, updatedBy = "Staff", note } = body as {
      status: OrderStatus;
      updatedBy?: string;
      note?: string;
    };

    if (!orderId || !status) {
      return NextResponse.json({ error: "Missing orderId or status." }, { status: 400 });
    }

    const existingOrder = dataStore.getOrderById(orderId);
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Verify restaurant access: only restaurant staff/owner or Super Admin can modify order lifecycle
    const authCheck = await verifyRestaurantAccess(req, existingOrder.restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    // Check valid lifecycle transition
    const allowed = VALID_TRANSITIONS[existingOrder.status];
    if (!allowed || !allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from '${existingOrder.status}' to '${status}'.`,
          allowedTransitions: allowed,
        },
        { status: 400 }
      );
    }

    const updated = dataStore.updateOrderStatus(orderId, status, updatedBy, note);

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update order status" }, { status: 500 });
  }
}
