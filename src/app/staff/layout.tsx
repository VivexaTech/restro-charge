"use client";

// ==============================================================================
// RESTROCHARGE - Staff & Kitchen Operational Layout
// Wraps staff floor orders and KDS display with OrderAlertProvider,
// persistent audio alert manager, fast acceptance banner, and settings modal.
// ==============================================================================

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed,
  ChefHat,
  Volume2,
  VolumeX,
  LayoutDashboard,
  LogOut,
  Settings,
  Bell,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleGuard } from "@/components/auth/role-guard";
import { OrderAlertProvider, useOrderAlert } from "@/context/order-alert-context";
import { OrderAlertBanner } from "@/components/staff/alert-banner";
import { SoundSettingsModal } from "@/components/staff/sound-settings-modal";

function StaffHeaderControls() {
  const {
    soundEnabled,
    toggleSound,
    selectedSound,
    isRinging,
    unlockAudio,
    activeAlertOrders,
  } = useOrderAlert();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleToggleSound = async () => {
    await unlockAudio();
    await toggleSound(!soundEnabled);
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        {/* Ringing Indicator Pill */}
        {isRinging && (
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono font-bold animate-pulse">
            <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5 animate-ping" />
            RINGING ({activeAlertOrders.length})
          </span>
        )}

        {/* Audio Mute/Unmute Toggle Button */}
        <button
          onClick={handleToggleSound}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center space-x-1.5 transition ${
            soundEnabled
              ? "bg-slate-800 border-slate-700 text-emerald-400 hover:text-emerald-300"
              : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400"
          }`}
          title={soundEnabled ? "Audio alert is active. Click to mute." : "Audio alert is muted. Click to activate."}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          <span className="hidden md:inline text-[11px] font-semibold">
            {soundEnabled ? "Alerts On" : "Muted"}
          </span>
        </button>

        {/* Sound Settings Button */}
        <button
          onClick={() => {
            unlockAudio();
            setSettingsOpen(true);
          }}
          className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1.5"
          title="Change notification sound tone & background push settings"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden lg:inline text-[11px] font-semibold">Alert Tone</span>
        </button>
      </div>

      <SoundSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

function StaffLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, switchUserRole } = useAuth();

  return (
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
          <StaffHeaderControls />

          <Link href="/dashboard" className="hidden sm:inline-block">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-700 text-slate-300 text-xs h-8"
            >
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

      {/* Main content with prominent order alert banner */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        <OrderAlertBanner />
        {children}
      </main>
    </div>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
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
      <OrderAlertProvider>
        <StaffLayoutContent>{children}</StaffLayoutContent>
      </OrderAlertProvider>
    </RoleGuard>
  );
}
