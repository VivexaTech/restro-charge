import React from "react";
import Link from "next/link";
import {
  Store,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Receipt,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function SuperAdminDashboardPage() {
  let restaurants = await firestoreService.getRestaurants();
  if (restaurants && restaurants.length > 0) {
    restaurants.forEach((r) => dataStore.saveRestaurantLocally(r));
  } else {
    restaurants = dataStore.getRestaurants();
  }
  const requests = dataStore.getRequests();
  const allOrders = dataStore.getOrders();
  const auditLogs = dataStore.getAuditLogs().slice(0, 5);

  const activeRestaurants = restaurants.filter(
    (r) => r.subscription?.status === "ACTIVE" || r.subscription?.status === "TRIAL"
  );
  const graceRestaurants = restaurants.filter(
    (r) => r.subscription?.status === "GRACE_PERIOD"
  );
  const expiredRestaurants = restaurants.filter(
    (r) => r.subscription?.status === "EXPIRED" || r.subscription?.status === "SUSPENDED"
  );
  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  // Total recorded orders across the platform
  const totalRecordedOrderCount = allOrders.length;
  const totalFoodOrderValue = allOrders.reduce((sum, o) => sum + o.billing.finalTotal, 0);

  // Platform verified subscription revenue from real payments
  const payments = dataStore.getPayments();
  const totalSubscriptionRevenue = payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Vivexa Tech Operations
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Platform Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Central tenant provisioning, exclusive QR issuance, and subscription oversight.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/super-admin/tables" className="flex-1 sm:flex-initial">
            <Button size="sm" className="w-full sm:w-auto font-semibold shadow-sm text-xs">
              <QrCode className="h-4 w-4 mr-1.5" />
              Generate Table QRs
            </Button>
          </Link>
          <Link href="/super-admin/onboarding" className="flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">
              <UserPlus className="h-4 w-4 mr-1.5" />
              Review Requests ({pendingRequests.length})
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Restaurants</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{restaurants.length}</p>
          <div className="mt-2 text-xs text-slate-500 flex items-center">
            <span className="text-emerald-600 font-bold mr-1">{activeRestaurants.length} active</span>
            <span>• {expiredRestaurants.length} offline</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Onboarding</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{pendingRequests.length}</p>
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Requires Vivexa Tech review
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Grace Period Subscriptions</span>
            <div className="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{graceRestaurants.length}</p>
          <div className="mt-2 text-xs text-slate-500">
            Within 3-day grace window
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Platform Subscriptions</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">
            {formatCurrency(totalSubscriptionRevenue)}
          </p>
          <div className="mt-2 text-[11px] text-slate-400">
            Verified RestroCharge SaaS billings
          </div>
        </div>
      </div>

      {/* Distinction Note */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
              Audit Architecture Principle
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Customer food orders across all restaurants ({totalRecordedOrderCount} orders totaling {formatCurrency(totalFoodOrderValue)}) are paid directly to restaurants. RestroCharge records them for kitchen workflows, but never collects customer dining payments.
          </p>
        </div>
        <Link href="/super-admin/billing">
          <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-white shrink-0">
            Billing Rules
          </Button>
        </Link>
      </div>

      {/* Grid: Restaurants Table + Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Restaurants Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 font-display">
              Provisioned Restaurants
            </h3>
            <Link href="/super-admin/restaurants" className="text-xs text-brand-600 font-semibold hover:underline">
              View All ({restaurants.length})
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Restaurant</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Subscription</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {restaurants.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{r.name}</span>
                      <span className="text-slate-400 text-[10px] font-mono">/{r.slug}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{r.city}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800">{r.subscription?.planName}</span>
                      <span className="text-slate-400 block text-[10px]">{r.subscription?.billingCycle}</span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          r.subscription?.status === "ACTIVE"
                            ? "success"
                            : r.subscription?.status === "GRACE_PERIOD"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {r.subscription?.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link href={`/${r.slug}`} target="_blank">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Live Site
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 font-display">
                Admin Audit Trail
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                Immutable
              </span>
            </div>

            <div className="space-y-3.5">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No privileged actions recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px] font-mono">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      By {log.performedBy.name} ({log.targetType})
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">
              Only authorized Vivexa Tech staff can create QR codes and renew subscriptions.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
