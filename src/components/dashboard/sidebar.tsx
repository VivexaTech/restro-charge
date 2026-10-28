"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  QrCode,
  Globe,
  Users,
  CreditCard,
  Settings,
  ShoppingBag,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function RestaurantSidebar() {
  const pathname = usePathname();
  const { user, logout, switchUserRole } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
    { label: "Menu & Items", href: "/dashboard/menu", icon: UtensilsCrossed },
    { label: "Tables View", href: "/dashboard/tables", icon: QrCode },
    { label: "Website Builder", href: "/dashboard/website", icon: Globe },
    { label: "Staff Access", href: "/dashboard/staff", icon: Users },
    { label: "Subscription", href: "/dashboard/subscription", icon: CreditCard },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Restaurant Brand Header */}
        <div className="h-16 px-6 flex items-center space-x-3 border-b border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-brand-500 text-white font-bold flex items-center justify-center text-sm shadow">
            RC
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-slate-900 truncate">
              Vivexa Restro
            </span>
            <span className="text-[10px] text-slate-400 font-medium truncate">
              Restaurant Admin
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer controls */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        <Link
          href="/vivexa-restro"
          target="_blank"
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
        >
          <span className="truncate">View Public Website</span>
          <span className="text-[10px] text-brand-600 font-bold">/vivexa-restro ↗</span>
        </Link>

        <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
          <Link href="/" className="hover:text-slate-900 flex items-center">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Home
          </Link>
          <button
            onClick={() => {
              switchUserRole("CUSTOMER_GUEST");
              logout();
            }}
            className="hover:text-red-600 flex items-center"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
