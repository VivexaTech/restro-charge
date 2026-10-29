"use client";

import React, { useState, useEffect } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function SuperAdminNav() {
  const pathname = usePathname();
  const { user, logout, switchUserRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileOpen]);

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
    <>
      {/* ------------------------------------------------------------------ */}
      {/* MOBILE TOP BAR (Phone & Tablet < 1024px)                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-xs shadow">
            RC
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-white tracking-tight">
              Vivexa Super Admin
            </span>
            <span className="text-[9px] text-brand-400 font-medium">
              Platform Master
            </span>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MOBILE SLIDE-OVER DRAWER                                           */}
      {/* ------------------------------------------------------------------ */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer content */}
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-300 h-full flex flex-col justify-between z-10 shadow-2xl border-r border-slate-800">
            <div>
              {/* Header with Close Button */}
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-xs">
                    RC
                  </div>
                  <span className="font-bold text-xs text-white">Super Admin Menu</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation list */}
              <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
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
            <div className="p-3 border-t border-slate-800 space-y-2">
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-white truncate text-[11px]">
                    {user?.displayName || "Vivexa Team"}
                  </span>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-bold">
                    SUPER_ADMIN
                  </span>
                </div>
                <span className="text-slate-400 text-[10px] truncate block">
                  {user?.email || "admin@vivexatech.in"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <Link
                  href="/"
                  className="flex items-center text-slate-400 hover:text-white transition text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Public Site
                </Link>

                <button
                  onClick={() => {
                    switchUserRole("CUSTOMER_GUEST");
                    logout();
                  }}
                  className="text-red-400 hover:text-red-300 transition flex items-center text-xs font-medium"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DESKTOP SIDEBAR (Large screens >= 1024px)                          */}
      {/* ------------------------------------------------------------------ */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col justify-between shrink-0 border-r border-slate-800 min-h-screen sticky top-0 h-screen">
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
              className="text-red-400 hover:text-red-300 transition flex items-center font-medium"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
