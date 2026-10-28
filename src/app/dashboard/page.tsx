import React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  TrendingUp,
  Clock,
  Utensils,
  AlertCircle,
  QrCode,
  ArrowRight,
  ChefHat,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function RestaurantOverviewDashboard() {
  const restaurants = dataStore.getRestaurants();
  const restaurant = restaurants[0] || null;
  const restaurantId = restaurant?.id || "";

  const orders = dataStore.getOrders(restaurantId);
  const products = dataStore.getProducts(restaurantId);
  const tables = dataStore.getTables(restaurantId);

  const todayOrders = orders;
  const todayOrderCount = todayOrders.length;
  const todayOrderValue = todayOrders.reduce((sum, o) => sum + o.billing.finalTotal, 0);

  const pendingOrders = orders.filter((o) => o.status === "NEW" || o.status === "ACCEPTED");
  const cookingOrders = orders.filter((o) => o.status === "PREPARING");
  const readyOrders = orders.filter((o) => o.status === "READY");
  const completedOrders = orders.filter((o) => o.status === "SERVED");
  const outOfStockProducts = products.filter((p) => !p.isAvailable);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Operational Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            {restaurant?.name || "Vivexa Restro"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time dine-in orders, kitchen status, and floor occupancy.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link href="/staff">
            <Button variant="outline" size="sm" className="font-semibold">
              <ChefHat className="h-4 w-4 mr-1.5 text-brand-600" />
              Open Live Staff Operations
            </Button>
          </Link>
          <Link href="/dashboard/menu">
            <Button size="sm" className="font-semibold shadow-sm">
              <Utensils className="h-4 w-4 mr-1.5" />
              Manage Menu
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today&apos;s Orders</span>
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{todayOrderCount}</p>
          <div className="mt-2 text-xs text-slate-500">
            {cookingOrders.length} currently in kitchen
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Recorded Order Value</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">
            {formatCurrency(todayOrderValue)}
          </p>
          <div className="mt-2 text-[11px] text-slate-400">
            Directly collected at restaurant
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Tables</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{tables.length}</p>
          <div className="mt-2 text-xs text-slate-500">
            {tables.filter((t) => t.isActive).length} QR codes active
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Menu Catalog</span>
            <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Utensils className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{products.length}</p>
          <div className="mt-2 text-xs text-slate-500">
            {outOfStockProducts.length > 0 ? (
              <span className="text-red-600 font-semibold">{outOfStockProducts.length} items sold out</span>
            ) : (
              <span className="text-emerald-600 font-semibold">All items in stock</span>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Order Stream Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Live Order Stream
            </h2>
            <p className="text-xs text-slate-500">Customer QR orders stream directly into your dashboard.</p>
          </div>
          <Link href="/dashboard/orders" className="text-xs text-brand-600 font-semibold hover:underline">
            View All Orders →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No Orders Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When customers scan table QR codes and place orders, live tickets will appear here automatically.
            </p>
            {restaurant && (
              <Link
                href={`/order/${restaurant.slug}/table-01`}
                target="_blank"
                className="inline-block mt-4"
              >
                <Button size="sm" variant="outline" className="font-semibold text-xs">
                  <QrCode className="h-3.5 w-3.5 mr-1.5" />
                  Test Customer QR Order (Table 01)
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Ticket</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Items Summary</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                    <td className="py-3 px-3">
                      <span className="bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded text-[11px]">
                        {o.tableLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 truncate max-w-xs">
                      {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {formatCurrency(o.billing.finalTotal)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          o.status === "NEW"
                            ? "default"
                            : o.status === "PREPARING"
                            ? "warning"
                            : o.status === "READY"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {o.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {formatDate(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
