"use client";

// ==============================================================================
// RESTROCHARGE - Multi-Order Real-Time Alert Banner
// Alerts staff to unaccepted orders with continuous ringing status and fast acceptance.
// Handles autoplay unlock requirements gracefully per browser policies.
// ==============================================================================

import React, { useState } from "react";
import {
  Bell,
  Volume2,
  VolumeX,
  AlertCircle,
  CheckCircle2,
  Settings,
  Sparkles,
  ArrowRight,
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
    enablePushNotifications,
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
        {/* 1. Autoplay Blocked Warning Banner */}
        {isAutoplayBlocked && (
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

        {/* 3. Push notification permission prompt if default */}
        {pushPermission === "default" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-brand-400 shrink-0" />
              <span>
                Want new order alerts when your screen is locked or browser is minimized?
              </span>
            </div>
            <button
              onClick={enablePushNotifications}
              className="text-brand-400 hover:text-brand-300 font-semibold underline underline-offset-2 shrink-0 cursor-pointer"
            >
              Enable Browser Push Notifications →
            </button>
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
