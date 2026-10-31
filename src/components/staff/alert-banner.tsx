"use client";

// ==============================================================================
// RESTROCHARGE - Multi-Order Real-Time Alert Banner
// Alerts staff to unaccepted orders with continuous ringing status and fast acceptance.
// Prominently presents 'Enable Order Notifications' for FCM and PWA installation.
// ==============================================================================

import React, { useState } from "react";
import {
  Bell,
  Volume2,
  VolumeX,
  AlertCircle,
  CheckCircle2,
  Settings,
  Download,
  Smartphone,
  Share,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrderAlert } from "@/context/order-alert-context";
import { SoundSettingsModal } from "@/components/staff/sound-settings-modal";
import { formatCurrency, timeAgo } from "@/lib/utils";

export function OrderAlertBanner() {
  const {
    activeAlertOrders,
    isRinging,
    isAutoplayBlocked,
    unlockAudio,
    acceptOrder,
    soundEnabled,
    selectedSound,
    pushPermission,
    isPushEnabled,
    isRegisteringPush,
    enablePushNotifications,
    canInstallPWA,
    isIOS,
    isStandalone,
    promptInstallPWA,
  } = useOrderAlert();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleFastAccept = async (orderId: string) => {
    setAcceptingId(orderId);
    await acceptOrder(orderId);
    setAcceptingId(null);
  };

  return (
    <>
      <div className="w-full space-y-3">
        {/* 1. Autoplay Blocked Warning Banner (Only displayed if an order is actively pending) */}
        {isAutoplayBlocked && activeAlertOrders.length > 0 && (
          <div className="bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-4 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <VolumeX className="h-5 w-5" />
              </div>
              <div>
                <strong className="text-sm font-bold text-white block">
                  Audible Order Alert Blocked by Browser
                </strong>
                <p className="text-xs text-amber-300/90 mt-0.5">
                  Browsers require a user interaction before playing audio. Click to enable continuous ringing for incoming customer orders.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={unlockAudio}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0"
            >
              <Volume2 className="h-4 w-4 mr-1.5" />
              Enable Sound Alerts
            </Button>
          </div>
        )}

        {/* 2. Active Pending Order Ringing Alert Banner */}
        {activeAlertOrders.length > 0 && (
          <div className="bg-gradient-to-r from-brand-950 via-slate-900 to-brand-950 border-2 border-brand-500 rounded-2xl p-4 sm:p-5 text-white shadow-2xl relative overflow-hidden ring-4 ring-brand-500/20">
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-brand-500/30">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center animate-bounce shadow-lg">
                  <Bell className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-extrabold font-display text-white tracking-tight">
                      🚨 NEW ORDER ALERT — AWAITING ACCEPTANCE
                    </span>
                    <Badge variant="default" className="bg-brand-500 text-white font-mono text-[10px]">
                      {activeAlertOrders.length} PENDING {activeAlertOrders.length === 1 ? "TICKET" : "TICKETS"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 flex items-center space-x-2">
                    <span>
                      Audio ringing continuously ({selectedSound}). Alert stops automatically as each ticket is claimed.
                    </span>
                  </p>
                </div>
              </div>

              {/* Sound settings shortcut */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="self-end md:self-center text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 transition"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Alert Settings</span>
              </button>
            </div>

            {/* List of Pending Tickets with Instant Acceptance */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeAlertOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-950/80 border border-brand-500/50 rounded-xl p-3 flex flex-col justify-between space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="bg-brand-500 text-white font-black text-xs px-2 py-0.5 rounded-md">
                          {ord.tableLabel}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {ord.orderNumber}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {ord.items.length} dishes • {formatCurrency(ord.billing.finalTotal)} • {timeAgo(ord.createdAt)}
                      </span>
                    </div>

                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500 animate-ping" />
                  </div>

                  <Button
                    size="sm"
                    disabled={acceptingId === ord.id}
                    onClick={() => handleFastAccept(ord.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 shadow"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {acceptingId === ord.id ? "Accepting..." : "Accept Ticket"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Prominent 'Enable Order Notifications' Setup Banner */}
        {!isPushEnabled && pushPermission !== "denied" && (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-brand-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg ring-1 ring-brand-500/20">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <strong className="text-sm font-bold text-white block">
                    Never Miss an Incoming Table Order
                  </strong>
                  <span className="text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/40 px-2 py-0.5 rounded-full font-semibold">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Receive instant push notifications when orders arrive even when your screen is locked or browser is minimized.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
              <Button
                size="sm"
                disabled={isRegisteringPush}
                onClick={enablePushNotifications}
                className="bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs shadow-md w-full sm:w-auto h-9 px-4"
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                {isRegisteringPush ? "Enabling..." : "Enable Order Notifications"}
              </Button>
            </div>
          </div>
        )}

        {/* 4. Push Active Confirmation Indicator */}
        {isPushEnabled && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-bold text-xs">
                ✅ Order Notifications Active
              </span>
              <span className="hidden sm:inline text-slate-600">•</span>
              <span className="hidden sm:inline text-[11px] text-slate-400">
                Device registered for background order pushes and instant alerts.
              </span>
            </div>

            <button
              onClick={() => setSettingsOpen(true)}
              className="text-slate-400 hover:text-white text-xs font-medium underline underline-offset-2 ml-2 transition"
            >
              Alert Tone
            </button>
          </div>
        )}

        {/* 5. Notifications Blocked Warning */}
        {pushPermission === "denied" && (
          <div className="bg-red-950/20 border border-red-900/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-red-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>
                Browser push notifications are blocked. To receive new order alerts in the background, allow notifications in your browser settings.
              </span>
            </div>
          </div>
        )}

        {/* 6. PWA Installation Options (Chromium / Android beforeinstallprompt) */}
        {canInstallPWA && !isStandalone && (
          <div className="bg-brand-950/30 border border-brand-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-brand-200">
            <div className="flex items-center space-x-2">
              <Smartphone className="h-4 w-4 text-brand-400 shrink-0" />
              <span>
                Install RestroCharge on your home screen for fullscreen kitchen and staff operation.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={promptInstallPWA}
              className="border-brand-500/40 text-brand-300 hover:text-white hover:bg-brand-500/20 text-xs h-7 px-3 shrink-0"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Install App
            </Button>
          </div>
        )}

        {/* 7. iOS Safari PWA Instructions */}
        {isIOS && !isStandalone && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Share className="h-3.5 w-3.5 text-brand-400 shrink-0" />
              <span>
                Install on iPhone/iPad: Tap <strong className="text-white">Share</strong> in Safari, then select <strong className="text-white">&quot;Add to Home Screen&quot;</strong>.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sound & Alert Settings Modal */}
      <SoundSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
