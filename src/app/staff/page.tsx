"use client";

// ==============================================================================
// RESTROCHARGE - Active Dining Floor Orders Page
// Real-time table ticket stream for floor waitstaff and managers.
// Integrates with OrderAlertContext for immediate alert stopping upon order acceptance.
// ==============================================================================

import React, { useState, useEffect } from "react";
import {
  Clock,
  ChefHat,
  BellRing,
  Utensils,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderItem, OrderStatus } from "@/lib/types";
import { formatCurrency, formatTime, timeAgo } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useOrderAlert } from "@/context/order-alert-context";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";
import { firestoreService } from "@/lib/services/firestore-service";

export default function StaffFloorOrdersPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "";
  const { acceptOrder } = useOrderAlert();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isAccepting, setIsAccepting] = useState<string | null>(null);

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (!currentRestaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // 1. Initial HTTP fetch
    const fetchOrders = async () => {
      try {
        const res = await authFetch(`/api/orders?restaurantId=${currentRestaurantId}`);
        const data = await res.json();
        if (data.orders) {
          setOrders(data.orders);
        }
      } catch (e) {
        console.warn("[FloorOrders] Initial fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();

    // 2. Real-time Firestore subscription
    const unsubscribe = firestoreService.subscribeOrders(
      currentRestaurantId,
      (liveOrders) => {
        setOrders(liveOrders);
        setLoading(false);
      },
      (err) => {
        console.warn("[FloorOrders] Real-time listener error:", err.message);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentRestaurantId]);

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    if (nextStatus === "ACCEPTED") {
      setIsAccepting(orderId);
      const success = await acceptOrder(orderId);
      setIsAccepting(null);
      if (success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "ACCEPTED" } : o))
        );
      }
      return;
    }

    try {
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          updatedBy: user?.displayName || user?.email || "Floor Staff",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      toast.success(`Order status updated to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Filter orders
  const filtered = orders.filter((o) => {
    if (statusFilter === "active") {
      return (
        o.status === "NEW" ||
        o.status === "ACCEPTED" ||
        o.status === "PREPARING" ||
        o.status === "READY"
      );
    }
    if (statusFilter === "all") return true;
    return o.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold font-display text-white">
            Active Dining Floor Orders
          </h1>
          <p className="text-xs text-slate-400">
            Real-time table order stream for waitstaff and floor managers.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {["active", "NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "all"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider text-[11px] transition ${
                statusFilter === st
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center bg-slate-950/60 rounded-3xl border border-slate-800 text-slate-500">
          <Utensils className="h-10 w-10 mx-auto mb-2 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-300">No matching tickets</h3>
          <p className="text-xs text-slate-500 mt-1">
            Orders placed via table QRs appear here instantly in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((ord) => {
            const isNew = ord.status === "NEW";
            const isReady = ord.status === "READY";

            return (
              <div
                key={ord.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all shadow-md ${
                  isNew
                    ? "bg-slate-900 border-brand-500/80 ring-2 ring-brand-500/30 animate-pulse"
                    : isReady
                    ? "bg-slate-900 border-emerald-500/80 ring-2 ring-emerald-500/30"
                    : "bg-slate-900/90 border-slate-800"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="bg-brand-500 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow">
                        {ord.tableLabel}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {ord.orderNumber}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {timeAgo(ord.createdAt)}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="mb-3 flex items-center justify-between">
                    <Badge
                      variant={
                        isNew
                          ? "default"
                          : ord.status === "PREPARING"
                          ? "warning"
                          : ord.status === "READY"
                          ? "success"
                          : "neutral"
                      }
                      className="font-mono text-[10px] uppercase font-bold"
                    >
                      {ord.status}
                    </Badge>
                    <span className="text-xs font-bold text-white">
                      {formatCurrency(ord.billing.finalTotal)}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 py-2 text-xs">
                    {ord.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-200">
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              item.isVeg ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-brand-400 ml-2">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Customer notes */}
                  {ord.customerNotes && (
                    <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-amber-300">
                      <strong>Note:</strong> {ord.customerNotes}
                    </div>
                  )}

                  {/* Claimed/Accepted information */}
                  {ord.acceptedBy && (
                    <div className="mt-2 text-[10px] text-slate-500 font-mono">
                      Claimed by {ord.acceptedBy.name} at {formatTime(ord.acceptedBy.at)}
                    </div>
                  )}
                </div>

                {/* Status action buttons */}
                <div className="pt-4 border-t border-slate-800 mt-4 space-y-2">
                  {ord.status === "NEW" && (
                    <Button
                      size="sm"
                      disabled={isAccepting === ord.id}
                      onClick={() => handleUpdateStatus(ord.id, "ACCEPTED")}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 shadow"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {isAccepting === ord.id ? "Accepting..." : "Accept Order Ticket"}
                    </Button>
                  )}

                  {ord.status === "ACCEPTED" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "PREPARING")}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                    >
                      <ChefHat className="h-3.5 w-3.5 mr-1.5" />
                      Send to Preparation
                    </Button>
                  )}

                  {ord.status === "PREPARING" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "READY")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      <BellRing className="h-3.5 w-3.5 mr-1.5" />
                      Mark Ready to Serve
                    </Button>
                  )}

                  {ord.status === "READY" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "SERVED")}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Mark Served to Table
                    </Button>
                  )}

                  {ord.status !== "SERVED" && ord.status !== "CANCELLED" && (
                    <button
                      onClick={() => handleUpdateStatus(ord.id, "CANCELLED")}
                      className="w-full text-center text-[10px] text-slate-500 hover:text-red-400 py-1 transition cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
