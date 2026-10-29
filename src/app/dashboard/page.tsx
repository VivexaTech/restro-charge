"use client";

import React, { useState, useEffect } from "react";
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
  LogOut,
  RefreshCw,
  Store,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useActiveRestaurant } from "@/lib/hooks/use-active-restaurant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantProfile, OrderItem, ProductItem, TableItem } from "@/lib/types";

export default function RestaurantOverviewDashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const {
    restaurantId: effectiveRestaurantId,
    restaurant,
    allRestaurants,
    selectRestaurant,
    isSuperAdmin,
    loading: resLoading,
  } = useActiveRestaurant();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || resLoading) return;

    if (!user) {
      setDataLoading(false);
      return;
    }

    if (!effectiveRestaurantId) {
      setDataLoading(false);
      return;
    }

    async function loadData() {
      setDataLoading(true);
      setErrorMsg(null);
      try {
        const restId = effectiveRestaurantId;

        // Parallel fetch for orders, products, tables
        const [ordersRes, productsRes, tablesRes] = await Promise.all([
          fetch(`/api/orders?restaurantId=${restId}`),
          fetch(`/api/products?restaurantId=${restId}`),
          fetch(`/api/tables?restaurantId=${restId}`),
        ]);

        if (ordersRes.ok) {
          const ordData = await ordersRes.json();
          setOrders(ordData.orders || []);
        }

        if (productsRes.ok) {
          const prodData = await productsRes.json();
          setProducts(prodData.products || []);
        }

        if (tablesRes.ok) {
          const tabData = await tablesRes.json();
          setTables(tabData.tables || []);
        }
      } catch (err: any) {
        console.error("Dashboard data load error:", err);
        setErrorMsg("Failed to synchronize restaurant operations data.");
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [authLoading, resLoading, user, effectiveRestaurantId]);

  if (authLoading || dataLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading restaurant operations...</p>
      </div>
    );
  }

  // 1. User has no assigned restaurant membership
  if (user && !effectiveRestaurantId && user.role !== "SUPER_ADMIN") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full my-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-card text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Store className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-display font-extrabold text-slate-900">
            No Restaurant Membership Linked
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Your account (<span className="font-semibold text-slate-800">{user.email}</span>) is active, but is not currently linked to an approved restaurant tenant.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 max-w-md mx-auto text-left space-y-2">
            <p><strong>• If you registered a restaurant:</strong> Super Admin is reviewing your registration. You will receive an activation email once approved.</p>
            <p><strong>• If you are restaurant staff:</strong> Ask your restaurant manager to invite or assign your email address.</p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="text-xs font-semibold"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign Out
            </Button>
            <Link href="/register-restaurant">
              <Button size="sm" className="text-xs font-semibold">
                Register a Restaurant
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const todayOrders = orders;
  const todayOrderCount = todayOrders.length;
  const todayOrderValue = todayOrders.reduce((sum, o) => sum + (o.billing?.finalTotal || 0), 0);

  const cookingOrders = orders.filter((o) => o.status === "PREPARING");
  const outOfStockProducts = products.filter((p) => !p.isAvailable);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Operational Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            {restaurant?.name || "Your Restaurant"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time dine-in orders, kitchen status, and floor occupancy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/staff" className="flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" className="w-full sm:w-auto font-semibold text-xs">
              <ChefHat className="h-4 w-4 mr-1.5 text-brand-600" />
              Open Live Staff Operations
            </Button>
          </Link>
          <Link href="/dashboard/menu" className="flex-1 sm:flex-initial">
            <Button size="sm" className="w-full sm:w-auto font-semibold shadow-sm text-xs">
              <Utensils className="h-4 w-4 mr-1.5" />
              Manage Menu
            </Button>
          </Link>
        </div>
      </div>

      {/* Multi-tenant Venue Switcher Banner (Visible to Super Admin or Multi-restaurant Managers) */}
      {(isSuperAdmin || allRestaurants.length > 1) && (
        <div className="bg-brand-50/70 border border-brand-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-700 flex items-center justify-center shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">
                  {restaurant?.name || (effectiveRestaurantId ? `Restaurant: ${effectiveRestaurantId}` : "No Venue Selected")}
                </span>
                {isSuperAdmin && (
                  <Badge variant="default" className="text-[10px] py-0 px-2 font-semibold">
                    Super Admin Scope
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                You are currently viewing operations for this restaurant venue.
              </p>
            </div>
          </div>

          {allRestaurants.length > 0 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label htmlFor="overview-venue-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Switch Venue:
              </label>
              <select
                id="overview-venue-select"
                value={effectiveRestaurantId}
                onChange={(e) => selectRestaurant(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs cursor-pointer w-full sm:w-auto"
              >
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

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
                      {formatCurrency(o.billing?.finalTotal || 0)}
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
