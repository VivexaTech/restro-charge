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
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { TableItem, RestaurantProfile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function RestaurantTablesViewPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "rest_vivexa_01";

  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const restRes = await fetch(`/api/restaurants/${currentRestaurantId}`);
        const restData = await restRes.json();
        setRestaurant(restData.restaurant || null);

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
  }, [currentRestaurantId]);

  const slug = restaurant?.slug || "vivexa-restro";

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
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
        )}
      </div>
    </div>
  );
}
