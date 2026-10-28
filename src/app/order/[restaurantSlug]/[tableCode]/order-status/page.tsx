"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  BellRing,
  Utensils,
  ArrowLeft,
  Receipt,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTime } from "@/lib/utils";
import { OrderItem, OrderStatus } from "@/lib/types";

interface Props {
  params: {
    restaurantSlug: string;
    tableCode: string;
  };
}

export default function OrderStatusPage({ params }: Props) {
  const { restaurantSlug, tableCode } = params;
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders`);
      const data = await res.json();
      const found = (data.orders as OrderItem[]).find((o) => o.id === orderId);
      if (found) {
        setOrder(found);
      }
    } catch (err) {
      console.error("Error fetching order status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    // Poll every 5 seconds for status updates
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500">Checking order status...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Order not found</h2>
          <p className="text-xs text-slate-500">
            We couldn&apos;t retrieve the order details. Please verify your table order.
          </p>
          <Link href={`/order/${restaurantSlug}/${tableCode}`}>
            <Button size="sm" className="w-full">
              Back to Menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const steps: { status: OrderStatus; label: string; icon: any }[] = [
    { status: "NEW", label: "Received", icon: Clock },
    { status: "ACCEPTED", label: "Confirmed", icon: CheckCircle2 },
    { status: "PREPARING", label: "In Kitchen", icon: ChefHat },
    { status: "READY", label: "Ready", icon: BellRing },
    { status: "SERVED", label: "Served", icon: Utensils },
  ];

  const currentStepIdx = steps.findIndex((s) => s.status === order.status);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-4 px-2 sm:px-4">
      <div className="w-full max-w-md bg-white min-h-[90vh] rounded-3xl shadow-xl flex flex-col overflow-hidden pb-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative">
          <div className="inline-flex items-center space-x-1.5 bg-brand-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-3 shadow">
            <span>{order.tableLabel}</span>
          </div>

          <h1 className="text-2xl font-bold font-display tracking-tight">
            Order Confirmed!
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-mono">
            {order.orderNumber} • Placed at {formatTime(order.createdAt)}
          </p>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchOrder();
            }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition"
            title="Refresh order status"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Status Lifecycle Indicator */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/70">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-4 text-center">
            Kitchen Preparation Status
          </span>

          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />

            {steps.map((st, idx) => {
              const Icon = st.icon;
              const isPastOrCurrent = currentStepIdx >= idx;
              const isCurrent = currentStepIdx === idx;

              return (
                <div key={st.status} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm ${
                      isCurrent
                        ? "bg-brand-500 text-white ring-4 ring-brand-100 animate-pulse"
                        : isPastOrCurrent
                        ? "bg-slate-900 text-white"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] mt-2 font-semibold text-center ${
                      isCurrent
                        ? "text-brand-600 font-bold"
                        : isPastOrCurrent
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Status banner */}
          <div className="mt-6 text-center bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-800">
              {order.status === "NEW" && "Your order has been sent to the kitchen."}
              {order.status === "ACCEPTED" && "Staff confirmed your ticket. Preparation is queued."}
              {order.status === "PREPARING" && "The chefs are actively cooking your dishes."}
              {order.status === "READY" && "Your food is ready and being plated for your table!"}
              {order.status === "SERVED" && "Order completed and served. Bon appétit!"}
              {order.status === "CANCELLED" && "This order was cancelled by the restaurant."}
            </span>
          </div>
        </div>

        {/* Order Details */}
        <div className="p-6 flex-1 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center">
              <Receipt className="h-4 w-4 mr-1.5 text-slate-400" />
              Order Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
            </h3>

            <div className="space-y-2.5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.isVeg ? "bg-emerald-600" : "bg-red-600"
                      }`}
                    />
                    <span className="font-medium text-slate-800">{item.name}</span>
                    <span className="text-slate-400 font-mono">x{item.quantity}</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {order.customerNotes && (
            <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 border border-slate-200">
              <strong className="text-slate-800">Instructions:</strong> {order.customerNotes}
            </div>
          )}

          {/* Bill summary */}
          <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.billing.subtotal)}</span>
            </div>

            {order.billing.serviceChargeEnabled && (
              <div className="flex justify-between text-slate-600">
                <span>Service Charge ({order.billing.serviceChargeRate}%)</span>
                <span>{formatCurrency(order.billing.serviceChargeAmount)}</span>
              </div>
            )}

            {order.billing.gstEnabled && (
              <div className="flex justify-between text-slate-600">
                <span>GST / Taxes ({order.billing.gstRate}%)</span>
                <span>{formatCurrency(order.billing.gstAmount)}</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-sm text-slate-900">
              <span>Total Bill</span>
              <span className="text-brand-600 font-display">
                {formatCurrency(order.billing.finalTotal)}
              </span>
            </div>
          </div>

          {/* Payment Notice */}
          <div className="text-[11px] text-slate-500 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 leading-relaxed">
            💡 <strong>Direct Settlement:</strong> Please settle this bill directly with your waiter or at the restaurant counter. RestroCharge does not process online customer payments.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0 space-y-2">
          <Link href={`/order/${restaurantSlug}/${tableCode}`}>
            <Button variant="outline" className="w-full text-xs font-semibold">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Order More Items
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
