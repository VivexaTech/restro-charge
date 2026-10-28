"use client";

import React, { useState, useEffect } from "react";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Flame,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderItem, OrderStatus } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function KitchenDisplaySystemPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "rest_vivexa_01";

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch(`/api/orders?restaurantId=${currentRestaurantId}`);
      const data = await res.json();
      const list: OrderItem[] = data.orders || [];
      // KDS focuses on active kitchen tickets: NEW, ACCEPTED, PREPARING
      const kitchenList = list.filter(
        (o) => o.status === "NEW" || o.status === "ACCEPTED" || o.status === "PREPARING"
      );
      setOrders(kitchenList);
    } catch {
      console.error("KDS fetch error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenOrders();
    const interval = setInterval(fetchKitchenOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleKitchenStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          updatedBy: "Kitchen Chef",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (nextStatus === "READY") {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        toast.success("Order plated and notified to floor staff!");
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  return (
    <div className="p-4 sm:p-6 w-full flex-1 flex flex-col bg-slate-950 text-white">
      {/* Top KDS Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white uppercase">
              Kitchen Order Display (KDS)
            </h1>
            <span className="text-xs text-orange-400 font-semibold">
              Live Cooking Station • Vivexa Restro
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-300">
            Active Tickets: {orders.length}
          </span>
        </div>
      </div>

      {/* Large Kitchen Tickets Grid */}
      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500">
          <CheckCircle2 className="h-16 w-16 text-emerald-500/80 mb-3" />
          <h2 className="text-xl font-bold text-slate-200">All Kitchen Orders Cleared</h2>
          <p className="text-xs text-slate-400 mt-1">Stand by for new table QR tickets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.map((ord) => {
            const isCooking = ord.status === "PREPARING";

            return (
              <div
                key={ord.id}
                className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                  isCooking
                    ? "bg-slate-900/90 border-amber-500 shadow-elevated"
                    : "bg-slate-900/70 border-slate-700"
                }`}
              >
                <div>
                  {/* Big Table & Timer Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800 mb-4">
                    <div>
                      <span className="text-2xl font-black font-display text-white tracking-tight block">
                        {ord.tableLabel}
                      </span>
                      <span className="font-mono text-xs text-slate-400 font-bold">
                        {ord.orderNumber}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {timeAgo(ord.createdAt)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                        {ord.status}
                      </span>
                    </div>
                  </div>

                  {/* Items Ticket List */}
                  <div className="space-y-3 py-1">
                    {ord.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800/80"
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className={`h-3 w-3 rounded-full shrink-0 ${
                              item.isVeg ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          <span className="font-bold text-sm text-slate-100 leading-tight">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-lg font-black font-mono text-brand-400 pl-2">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Special preparation instructions */}
                  {ord.customerNotes && (
                    <div className="mt-4 bg-amber-950/40 border border-amber-600/40 p-3 rounded-xl text-xs text-amber-200">
                      <strong className="block text-[10px] uppercase font-bold text-amber-400 mb-0.5">
                        Chef Instruction:
                      </strong>
                      {ord.customerNotes}
                    </div>
                  )}
                </div>

                {/* Big Action Button for Kitchen Cook */}
                <div className="pt-4 border-t border-slate-800 mt-6">
                  {ord.status === "PREPARING" ? (
                    <button
                      onClick={() => handleKitchenStatus(ord.id, "READY")}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg transition"
                    >
                      <Check className="h-5 w-5" />
                      <span>MARK DISH READY</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleKitchenStatus(ord.id, "PREPARING")}
                      className="w-full h-12 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg transition"
                    >
                      <Flame className="h-5 w-5" />
                      <span>START COOKING</span>
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
