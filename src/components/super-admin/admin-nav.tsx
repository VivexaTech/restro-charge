"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  UserPlus,
  CreditCard,
  Receipt,
  QrCode,
  Users,
  Settings,
  ArrowLeft,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function SuperAdminNav() {
  const pathname = usePathname();
  const { user, logout, switchUserRole } = useAuth();

  const navItems = [
    { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
    { label: "Restaurants", href: "/super-admin/restaurants", icon: Store },
    { label: "Onboarding Requests", href: "/super-admin/onboarding", icon: UserPlus },
    { label: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
    { label: "Billing & Taxes", href: "/super-admin/billing", icon: Receipt },
    { label: "Table QR Manager", href: "/super-admin/tables", icon: QrCode, highlight: true },
    { label: "Internal Team", href: "/super-admin/team", icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 min-h-screen">
      <div>
        {/* Brand */}
        <div className="h-16 px-6 flex items-center space-x-3 border-b border-slate-800">
          <div className="h-8 w-8 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-sm shadow">
            RC
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-white tracking-tight">
              Vivexa Super Admin
            </span>
            <span className="text-[10px] text-brand-400 font-medium">
              Platform Master
            </span>
          </div>
        </div>

        {/* Navigation list */}
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
                    ? "bg-brand-500 text-white shadow-sm"
                    : item.highlight
                    ? "text-brand-400 hover:bg-slate-800/80 hover:text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : ""}`} />
                <span>{item.label}</span>
                {item.highlight && (
                  <span className="ml-auto bg-brand-500/20 text-brand-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                    Vivexa
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile & actions */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white truncate">{user?.displayName || "Vivexa Team"}</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold">
              SUPER_ADMIN
            </span>
          </div>
          <span className="text-slate-400 text-[11px] truncate block">{user?.email || "admin@vivexatech.in"}</span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <Link
            href="/"
            className="flex items-center text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Public Site
          </Link>

          <button
            onClick={() => {
              switchUserRole("CUSTOMER_GUEST");
              logout();
            }}
            className="text-red-400 hover:text-red-300 transition flex items-center"
          >
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
