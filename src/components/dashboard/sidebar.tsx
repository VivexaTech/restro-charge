"use client";

import React, { useState, useEffect } from "react";
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
  Menu,
  X,
  Tag,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { RestaurantProfile } from "@/lib/types";
import { useActiveRestaurant } from "@/lib/hooks/use-active-restaurant";

export function RestaurantSidebar() {
  const pathname = usePathname();
  const { user, logout, switchUserRole } = useAuth();
  const { restaurant } = useActiveRestaurant();
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
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
    { label: "Menu & Items", href: "/dashboard/menu", icon: UtensilsCrossed },
    { label: "Offers & Combos", href: "/dashboard/offers", icon: Tag },
    { label: "Tables View", href: "/dashboard/tables", icon: QrCode },
    { label: "Website Builder", href: "/dashboard/website", icon: Globe },
    { label: "Staff Access", href: "/dashboard/staff", icon: Users },
    { label: "Subscription", href: "/dashboard/subscription", icon: CreditCard },
  ];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* MOBILE TOP BAR (Phone & Tablet < 1024px)                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-xs shadow">
            RC
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-slate-900 tracking-tight truncate max-w-[180px]">
              {restaurant?.name || (user?.role === "SUPER_ADMIN" ? "RestroCharge Super Admin" : "Your Restaurant")}
            </span>
            <span className="text-[9px] text-brand-600 font-medium">
              {user?.role === "SUPER_ADMIN" ? "Platform Control" : "Restaurant Admin"}
            </span>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
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
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer content */}
          <aside className="relative w-72 max-w-[85vw] bg-white text-slate-700 h-full flex flex-col justify-between z-10 shadow-2xl border-r border-slate-200">
            <div>
              {/* Header with Close Button */}
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-xs">
                    RC
                  </div>
                  <span className="font-bold text-xs text-slate-900">Restaurant Menu</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation items */}
              <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
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
                href={`/${restaurant?.slug || "vivexa-restro"}`}
                target="_blank"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                <span className="truncate">View Public Website</span>
                <span className="text-[10px] text-brand-600 font-bold">/{restaurant?.slug || "vivexa-restro"} ↗</span>
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
                  className="hover:text-red-600 flex items-center font-medium"
                >
                  <LogOut className="h-3 w-3 mr-1" />
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
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col justify-between shrink-0 min-h-screen sticky top-0 h-screen">
        <div>
          {/* Restaurant Brand Header */}
          <div className="h-16 px-6 flex items-center space-x-3 border-b border-slate-100">
            <div className="h-9 w-9 rounded-xl bg-brand-500 text-white font-bold flex items-center justify-center text-sm shadow">
              RC
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-slate-900 truncate">
                {restaurant?.name || (user?.role === "SUPER_ADMIN" ? "Super Admin" : "Your Restaurant")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate">
                {restaurant?.slug ? `@${restaurant.slug}` : (user?.role === "SUPER_ADMIN" ? "All Restaurants Access" : "Restaurant Admin")}
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
            href={`/${restaurant?.slug || "vivexa-restro"}`}
            target="_blank"
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            <span className="truncate">View Public Website</span>
            <span className="text-[10px] text-brand-600 font-bold">/{restaurant?.slug || "vivexa-restro"} ↗</span>
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
              className="hover:text-red-600 flex items-center font-medium"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
