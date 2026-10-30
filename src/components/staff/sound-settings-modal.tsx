"use client";

// ==============================================================================
// RESTROCHARGE - Order Notification Sound & Push Settings Modal
// Allows staff to select among 5 permitted sounds, preview tracks, toggle mute,
// and manage background push notification permissions.
// ==============================================================================

import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Settings2,
  X,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  NOTIFICATION_SOUNDS,
  SoundOption,
} from "@/lib/services/audio-alert-service";
import { NotificationSoundFile } from "@/lib/types";
import { useOrderAlert } from "@/context/order-alert-context";
import { toast } from "sonner";

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SoundSettingsModal({ isOpen, onClose }: SoundSettingsModalProps) {
  const {
    selectedSound,
    setSelectedSound,
    soundEnabled,
    toggleSound,
    previewSound,
    stopPreview,
    pushPermission,
    isPushEnabled,
    isRegisteringPush,
    enablePushNotifications,
    disablePushNotifications,
    unlockAudio,
  } = useOrderAlert();

  const [previewingFile, setPreviewingFile] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopPreview();
      setPreviewingFile(null);
    }
  }, [isOpen, stopPreview]);

  if (!isOpen) return null;

  const handleSelectSound = async (soundFile: NotificationSoundFile) => {
    stopPreview();
    setPreviewingFile(null);
    await unlockAudio();
    await setSelectedSound(soundFile);
    toast.success(`Notification sound updated!`);
  };

  const handleTogglePreview = async (soundFile: NotificationSoundFile) => {
    if (previewingFile === soundFile) {
      stopPreview();
      setPreviewingFile(null);
    } else {
      await unlockAudio();
      setPreviewingFile(soundFile);
      await previewSound(soundFile);
      setPreviewingFile(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-display">
                Order Alert & Notification Settings
              </h2>
              <p className="text-xs text-slate-400">
                Staff-specific audio chime preferences and background push notifications.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Master Sound Toggle */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {soundEnabled ? (
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Volume2 className="h-4 w-4" />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <VolumeX className="h-4 w-4" />
              </div>
            )}
            <div>
              <span className="text-sm font-semibold text-white block">
                Audible Order Alert Chime
              </span>
              <span className="text-xs text-slate-400">
                {soundEnabled
                  ? "Repeats continuously when new tickets are awaiting acceptance."
                  : "Muted. Visual alerts will continue to show."}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant={soundEnabled ? "default" : "outline"}
            onClick={() => toggleSound(!soundEnabled)}
            className="text-xs font-semibold h-8"
          >
            {soundEnabled ? "Mute" : "Unmute"}
          </Button>
        </div>

        {/* 5 Selectable Notification Sounds */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select Alert Tone (5 Choices)
            </span>
            <span className="text-[11px] text-slate-400">
              Active: <strong className="text-brand-400">{selectedSound}</strong>
            </span>
          </div>

          <div className="space-y-2">
            {NOTIFICATION_SOUNDS.map((opt: SoundOption) => {
              const isSelected = selectedSound === opt.file;
              const isPlaying = previewingFile === opt.file;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectSound(opt.file)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "bg-brand-500/10 border-brand-500/60 ring-1 ring-brand-500/30"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-slate-600 bg-transparent"
                      }`}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">
                          {opt.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({opt.file})
                        </span>
                        {isSelected && (
                          <Badge variant="default" className="text-[10px] py-0 px-1.5 h-4">
                            Selected
                          </Badge>
                        )}
                        {opt.file.endsWith(".mp4") && (
                          <Badge variant="neutral" className="text-[9px] py-0 px-1.5 h-4 bg-slate-800 text-slate-300">
                            AAC Audio
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {opt.description}
                      </span>
                    </div>
                  </div>

                  {/* Preview / Stop Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePreview(opt.file);
                    }}
                    className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
                      isPlaying
                        ? "bg-brand-500 text-white shadow"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 italic">
            * Selected tone persists across your sessions and devices on your staff account.
          </p>
        </div>

        {/* Background Push Notifications Section */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Background Push Notifications
              </span>
            </div>

            <Badge
              variant={
                pushPermission === "granted"
                  ? "success"
                  : pushPermission === "denied"
                  ? "danger"
                  : "warning"
              }
              className="text-[10px]"
            >
              {pushPermission === "granted"
                ? "Allowed"
                : pushPermission === "denied"
                ? "Blocked by Browser"
                : "Not Registered"}
            </Badge>
          </div>

          <p className="text-xs text-slate-400">
            Receive instant push notifications when tickets arrive even when the RestroCharge tab is in the background or minimized.
          </p>

          {pushPermission === "denied" && (
            <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-xs text-red-300 flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div>
                <strong>Notifications are blocked in your browser:</strong>
                <p className="text-[11px] text-red-300/80 mt-0.5">
                  Click the lock or settings icon in your browser address bar next to the URL, set Notifications to "Allow", and reload the page.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-1">
            {isPushEnabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={disablePushNotifications}
                className="bg-slate-900 border-slate-700 text-slate-300 text-xs h-8"
              >
                Disable Push Alerts
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={enablePushNotifications}
                disabled={isRegisteringPush || pushPermission === "denied"}
                className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold h-8"
              >
                {isRegisteringPush ? "Registering..." : "Enable Browser Notifications"}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Automatic cloud sync</span>
          </span>

          <Button
            size="sm"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs h-8 px-4"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
