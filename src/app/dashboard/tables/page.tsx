"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  ExternalLink,
  Info,
  Clock,
  CheckCircle2,
  Store,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useActiveRestaurant } from "@/lib/hooks/use-active-restaurant";
import { TableItem, RestaurantProfile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function RestaurantTablesViewPage() {
  const { user } = useAuth();
  const {
    restaurantId: currentRestaurantId,
    restaurant,
    allRestaurants,
    selectRestaurant,
    isSuperAdmin,
    loading: resLoading,
  } = useActiveRestaurant();

  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!currentRestaurantId) {
        if (!resLoading) {
          setTables([]);
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/tables?restaurantId=${currentRestaurantId}`);
        const data = await res.json();
        setTables(data.tables || []);
      } catch {
        console.error("Failed to load tables");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentRestaurantId, resLoading]);

  const slug = restaurant?.slug || "";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Dining Floor Setup
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Configured Tables & QR Status
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View active tables and verify QR code URLs mapped by Vivexa Tech.
          </p>
        </div>

        {/* Security badge explaining Vivexa exclusive issuance */}
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3.5 py-2 rounded-xl flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            QR codes and table issuance are strictly managed by Vivexa Tech Operations.
          </span>
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
                  {restaurant?.name || (currentRestaurantId ? `Restaurant: ${currentRestaurantId}` : "No Venue Selected")}
                </span>
                {isSuperAdmin && (
                  <Badge variant="default" className="text-[10px] py-0 px-2 font-semibold">
                    Super Admin Scope
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Floor tables and QR destinations are scoped to this restaurant venue.
              </p>
            </div>
          </div>

          {allRestaurants.length > 0 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label htmlFor="tables-venue-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Switch Venue:
              </label>
              <select
                id="tables-venue-select"
                value={currentRestaurantId}
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {tables.length === 0 ? (
          <div className="p-12 text-center">
            <QrCode className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No Tables Configured</h3>
            <p className="text-xs text-slate-500 mt-1">
              Contact your Vivexa Tech onboarding representative to generate table QR stickers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Table Label</th>
                  <th className="py-3 px-4">Stable Table ID</th>
                  <th className="py-3 px-4">Destination QR URL</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Provisioned Date</th>
                  <th className="py-3 px-4 text-right">Customer Menu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tables.map((t) => {
                  const url = `/order/${t.restaurantSlug || slug}/${t.code}`;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        {t.displayLabel}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {t.id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-brand-600">
                        {url}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={t.isActive ? "success" : "neutral"}>
                          {t.isActive ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={url} target="_blank">
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <span>Open Menu</span>
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
