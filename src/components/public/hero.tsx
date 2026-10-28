import React from "react";
import Link from "next/link";
import { ArrowRight, QrCode, Utensils, Sparkles, ChefHat, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PublicHero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-white via-orange-50/30 to-white">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-brand-500/5 blur-3xl -z-10 rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <Badge variant="default" className="px-3.5 py-1 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-brand-600" />
            Built for Modern Restaurants by Vivexa Tech
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Your Restaurant.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-amber-600">
              One Smarter Digital System.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Manage your menu, receive table orders, and build your restaurant&apos;s digital presence with one simple platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/restaurants/request">
              <Button size="lg" className="w-full sm:w-auto shadow-md hover:shadow-lg font-semibold px-8">
                Request a Demo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/order/vivexa-restro/table-01">
              <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium">
                <QrCode className="h-4 w-4 mr-2 text-brand-600" />
                Live Customer QR Demo
              </Button>
            </Link>
          </div>

          {/* Quick trust metrics */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Zero App Downloads for Diners</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Real-Time Kitchen Display</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Vivexa-Issued Protected QR Codes</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Visualization Preview */}
        <div className="mt-14 max-w-5xl mx-auto rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-elevated">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Column 1: Customer Phone View Mockup */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-md border border-slate-800">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800 text-slate-400">
                <span className="font-semibold text-brand-400">Customer QR Scan</span>
                <span>Table 01</span>
              </div>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center space-x-2.5 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <div className="w-10 h-10 rounded-md bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 font-bold text-xs">
                    🍛
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">Hyderabadi Dum Biryani</p>
                    <p className="text-[11px] text-slate-400">₹360 • Qty: 2</p>
                  </div>
                  <span className="text-xs font-bold text-brand-400">₹720</span>
                </div>
                <div className="bg-brand-500 text-white rounded-lg p-2.5 text-center text-xs font-semibold shadow">
                  Placed Order #RC-8821
                </div>
              </div>
            </div>

            {/* Column 2: Live Kitchen Display Mockup */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <ChefHat className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-900">Kitchen Display (KDS)</span>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  PREPARING
                </span>
              </div>
              <div className="mt-3 text-xs space-y-1.5 text-slate-700">
                <p className="font-bold text-slate-900">Table 01 • Order #RC-8821</p>
                <p className="text-slate-600">• 2x Hyderabadi Dum Biryani</p>
                <p className="text-slate-600">• 1x Mutton Galouti Kebab</p>
                <div className="mt-2 text-[11px] text-brand-700 bg-brand-50 p-1.5 rounded font-medium">
                  Note: Medium spicy, extra fried onions
                </div>
              </div>
            </div>

            {/* Column 3: Restaurant Admin Insights */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Utensils className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-900">RestroCharge Dashboard</span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  ACTIVE
                </span>
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <span className="text-[11px] text-slate-500 block">Today&apos;s Recorded Orders</span>
                  <span className="text-xl font-extrabold text-slate-900">38 Orders</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                  <span className="text-slate-500">Active Tables</span>
                  <span className="font-bold text-emerald-600">12 / 12 Configured</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
