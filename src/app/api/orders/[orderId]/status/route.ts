// ==============================================================================
// RESTROCHARGE - Order Status Lifecycle Route Handler
// Handles transitions: NEW -> ACCEPTED -> PREPARING -> READY -> SERVED / CANCELLED
// Concurrency-safe atomic order acceptance prevents race condition claims across staff.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { OrderStatus, OrderItem } from "@/lib/types";
import { verifyRestaurantAccess } from "@/lib/auth/server-auth";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase/admin";
import { firestoreService } from "@/lib/services/firestore-service";

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

    // 1. Locate order (check memory first, fallback to Firestore if needed)
    let existingOrder = dataStore.getOrderById(orderId);
    let restaurantId = existingOrder?.restaurantId;

    if (!existingOrder && isFirebaseAdminReady() && adminDb) {
      try {
        const querySnap = await adminDb
          .collectionGroup("orders")
          .where("id", "==", orderId)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const doc = querySnap.docs[0];
          existingOrder = doc.data() as OrderItem;
          restaurantId = existingOrder.restaurantId;
          dataStore.saveOrderLocally(existingOrder);
        }
      } catch (e: any) {
        console.warn("[OrderStatus API] collectionGroup search error:", e.message);
      }
    }

    if (!existingOrder || !restaurantId) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // 2. Verify restaurant access: only restaurant staff/owner or Super Admin can modify order lifecycle
    const authCheck = await verifyRestaurantAccess(req, restaurantId);
    if (!authCheck.authorized) {
      return authCheck.errorResponse!;
    }

    const nowIso = new Date().toISOString();
    const staffUser = authCheck.user;
    const acceptedByInfo = {
      uid: staffUser?.uid || "staff",
      name: updatedBy,
      email: staffUser?.email || "",
      at: nowIso,
    };

    // 3. Concurrency-Safe Order Acceptance via Firestore Atomic Transaction
    if (status === "ACCEPTED" && isFirebaseAdminReady() && adminDb) {
      const orderRef = adminDb
        .collection("restaurants")
        .doc(restaurantId)
        .collection("orders")
        .doc(orderId);

      try {
        const updatedOrder = await adminDb.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(orderRef);
          if (!docSnap.exists) {
            throw new Error("ORDER_NOT_FOUND");
          }

          const current = docSnap.data() as OrderItem;
          // Race condition check: Ensure order is still NEW
          if (current.status !== "NEW") {
            const conflictErr: any = new Error("ALREADY_CLAIMED");
            conflictErr.currentStatus = current.status;
            conflictErr.acceptedBy = current.acceptedBy;
            throw conflictErr;
          }

          const newHistory = [
            ...(current.statusHistory || []),
            {
              status: "ACCEPTED" as OrderStatus,
              timestamp: nowIso,
              updatedBy,
              note: note || "Order accepted by staff",
            },
          ];

          const updates: any = {
            status: "ACCEPTED",
            acceptedBy: acceptedByInfo,
            statusHistory: newHistory,
            updatedAt: nowIso,
          };

          transaction.update(orderRef, updates);

          return {
            ...current,
            ...updates,
          } as OrderItem;
        });

        // Sync with local memory store
        dataStore.saveOrderLocally(updatedOrder);

        return NextResponse.json({
          success: true,
          order: updatedOrder,
          message: "Order ticket accepted successfully.",
        });
      } catch (txErr: any) {
        if (txErr.message === "ALREADY_CLAIMED") {
          return NextResponse.json(
            {
              error: "This order has already been accepted or processed by another staff member.",
              code: "ORDER_ALREADY_ACCEPTED",
              currentStatus: txErr.currentStatus,
              acceptedBy: txErr.acceptedBy,
            },
            { status: 409 }
          );
        }
        if (txErr.message === "ORDER_NOT_FOUND") {
          return NextResponse.json({ error: "Order not found." }, { status: 404 });
        }
        console.warn("[OrderStatus API] Acceptance transaction failed, falling back:", txErr.message);
      }
    }

    // 4. Standard Lifecycle Status Transition
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
    if (!updated) {
      return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
    }

    // If accepted through fallback, ensure acceptedBy is recorded
    if (status === "ACCEPTED") {
      updated.acceptedBy = acceptedByInfo;
      dataStore.saveOrderLocally(updated);
      firestoreService.saveOrder(updated).catch(() => {});
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update order status" },
      { status: 500 }
    );
  }
}
