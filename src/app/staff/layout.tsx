"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed,
  ChefHat,
  BellRing,
  Volume2,
  VolumeX,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { audioAlert } from "@/components/staff/audio-alert";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/auth/role-guard";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, switchUserRole } = useAuth();
  const [audioEnabled, setAudioEnabled] = useState(true);

  const toggleAudio = () => {
    audioAlert.unlock();
    audioAlert.playNewOrderChime();
    setAudioEnabled(!audioEnabled);
  };

  return (
    <RoleGuard
      allowedRoles={[
        "SUPER_ADMIN",
        "RESTAURANT_OWNER",
        "RESTAURANT_MANAGER",
        "ORDER_STAFF",
        "KITCHEN_STAFF",
      ]}
      portalName="Staff & Kitchen Display System"
    >
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top operational bar */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <Link href="/staff" className="flex items-center space-x-2">
            <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold shadow">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display font-bold text-base text-white tracking-tight">
                RestroCharge Operations
              </span>
              <span className="text-[10px] text-brand-400 block -mt-0.5">
                Live Floor & Kitchen Stream
              </span>
            </div>
          </Link>

          {/* Navigation tabs */}
          <nav className="hidden sm:flex items-center space-x-1 ml-6">
            <Link
              href="/staff"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                pathname === "/staff"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Floor Orders
            </Link>
            <Link
              href="/staff/kitchen"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                pathname === "/staff/kitchen"
                  ? "bg-brand-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span>Kitchen Display (KDS)</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {/* Audio Chime toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-xl text-xs font-medium border flex items-center space-x-1.5 transition ${
              audioEnabled
                ? "bg-slate-800 border-slate-700 text-emerald-400"
                : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
            title="Toggle Order Sound Alert"
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden md:inline text-[11px]">
              {audioEnabled ? "Sound Alert Active" : "Muted"}
            </span>
          </button>

          <Link href="/dashboard" className="hidden sm:inline-block">
            <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 text-xs h-8">
              <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
              Admin
            </Button>
          </Link>

          <button
            onClick={() => {
              switchUserRole("CUSTOMER_GUEST");
              logout();
            }}
            className="text-slate-400 hover:text-red-400 transition p-2"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
    </RoleGuard>
  );
}
