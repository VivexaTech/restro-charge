"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Clock,
  Filter,
  CheckCircle2,
  Utensils,
  Receipt,
  Search,
  Inbox,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { OrderItem } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function RestaurantOrdersPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "rest_vivexa_01";

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orders?restaurantId=${currentRestaurantId}`);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch {
        console.error("Order fetch error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentRestaurantId]);

  const filtered = orders.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.tableLabel.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Customer Dining Tickets
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Order Management & History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time customer QR orders with portion selections and backend bill snapshots.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search ticket # or table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {["all", "NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition ${
              filterStatus === st
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-card">
          <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {orders.length === 0 ? "No Orders Recorded" : "No Matching Orders Found"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {orders.length === 0
              ? "When guests place orders through table QR codes, their tickets will stream into this view in real time."
              : "Try switching status filters or clearing your search term."}
          </p>
          {orders.length === 0 && (
            <Link
              href="/order/vivexa-restro/table-01"
              target="_blank"
              className="inline-block mt-4"
            >
              <Button size="sm" variant="outline" className="font-semibold text-xs">
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                Place Test QR Order (Vivexa Restro - Table 01)
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ord) => (
            <div
              key={ord.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card hover:shadow-soft transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {ord.orderNumber}
                  </span>
                  <span className="bg-brand-50 text-brand-700 font-bold px-2.5 py-0.5 rounded-lg text-xs">
                    {ord.tableLabel}
                  </span>
                  <Badge
                    variant={
                      ord.status === "NEW"
                        ? "default"
                        : ord.status === "PREPARING"
                        ? "warning"
                        : ord.status === "READY"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {ord.status}
                  </Badge>
                </div>

                <div className="text-xs text-slate-400">
                  {formatDateTime(ord.createdAt)}
                </div>
              </div>

              {/* Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Ordered Dishes
                  </span>
                  {ord.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                      <div>
                        <span className="text-slate-800 font-medium">
                          {item.name} <strong className="text-brand-600">x{item.quantity}</strong>
                        </span>
                        {item.portionName && (
                          <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                            {item.portionName}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}

                  {ord.customerNotes && (
                    <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      <strong>Note:</strong> {ord.customerNotes}
                    </p>
                  )}
                </div>

                {/* Bill Snapshot */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(ord.billing.subtotal)}</span>
                  </div>
                  {ord.billing.serviceChargeEnabled && (
                    <div className="flex justify-between text-slate-500">
                      <span>Service Charge ({ord.billing.serviceChargeRate}%)</span>
                      <span>{formatCurrency(ord.billing.serviceChargeAmount)}</span>
                    </div>
                  )}
                  {ord.billing.gstEnabled && (
                    <div className="flex justify-between text-slate-500">
                      <span>GST ({ord.billing.gstRate}%)</span>
                      <span>{formatCurrency(ord.billing.gstAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-xs text-slate-900">
                    <span>Total Calculated</span>
                    <span className="text-brand-600">{formatCurrency(ord.billing.finalTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
