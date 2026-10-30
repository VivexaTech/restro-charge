"use client";

// ==============================================================================
// RESTROCHARGE - Staff Order Notification Sound Setting Card
// Renders the 5 selectable notification sounds with radio buttons, previews,
// active indicators, and automatic backend persistence per Requirement B.
// ==============================================================================

import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  CheckCircle2,
  Bell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  NOTIFICATION_SOUNDS,
  SoundOption,
  audioAlertService,
  isValidSoundFile,
} from "@/lib/services/audio-alert-service";
import { NotificationSoundFile } from "@/lib/types";
import { authFetch } from "@/lib/auth/client-auth";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

export function StaffSoundPreferenceCard() {
  const { user } = useAuth();
  const [selectedSound, setSelectedSound] = useState<NotificationSoundFile>(
    audioAlertService.getSelectedSound()
  );
  const [previewingFile, setPreviewingFile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(audioAlertService.isSoundEnabled());

  useEffect(() => {
    // Load persisted preference
    async function load() {
      try {
        const res = await authFetch("/api/staff/notification-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            if (isValidSoundFile(data.preferences.orderSound)) {
              setSelectedSound(data.preferences.orderSound);
              audioAlertService.setSelectedSound(data.preferences.orderSound);
            }
            if (typeof data.preferences.soundEnabled === "boolean") {
              setSoundEnabled(data.preferences.soundEnabled);
              audioAlertService.setSoundEnabled(data.preferences.soundEnabled);
            }
          }
        }
      } catch {
        // use local
      }
    }
    load();

    return () => {
      audioAlertService.stopPreview();
    };
  }, [user]);

  const handleSelect = async (file: NotificationSoundFile) => {
    audioAlertService.stopPreview();
    setPreviewingFile(null);
    audioAlertService.setSelectedSound(file);
    setSelectedSound(file);
    setIsSaving(true);

    try {
      const res = await authFetch("/api/staff/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderSound: file }),
      });
      if (res.ok) {
        toast.success(`Sound preference updated to ${file}!`);
      }
    } catch {
      toast.error("Failed to save sound preference to profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePreview = async (file: NotificationSoundFile) => {
    if (previewingFile === file) {
      audioAlertService.stopPreview();
      setPreviewingFile(null);
    } else {
      await audioAlertService.unlock();
      setPreviewingFile(file);
      await audioAlertService.previewSound(file);
      setPreviewingFile(null);
    }
  };

  const handleToggleEnabled = async () => {
    const next = !soundEnabled;
    audioAlertService.setSoundEnabled(next);
    setSoundEnabled(next);

    try {
      await authFetch("/api/staff/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soundEnabled: next }),
      });
    } catch {}
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Order Notification Sound
            </h2>
            <p className="text-xs text-slate-500">
              Personalized alert tone played continuously when new dining orders arrive.
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleEnabled}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition ${
            soundEnabled
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
          }`}
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          <span>{soundEnabled ? "Alert Sound Active" : "Sound Muted"}</span>
        </button>
      </div>

      {/* 5 Selectable Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {NOTIFICATION_SOUNDS.map((opt: SoundOption) => {
          const isSelected = selectedSound === opt.file;
          const isPlaying = previewingFile === opt.file;

          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.file)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected
                  ? "bg-brand-50/70 border-brand-500 ring-2 ring-brand-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <input
                    type="radio"
                    name="orderNotificationSound"
                    checked={isSelected}
                    onChange={() => handleSelect(opt.file)}
                    className="h-4 w-4 text-brand-600 border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {opt.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {opt.file}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <Badge variant="default" className="text-[10px] py-0 px-2 h-5">
                    Active
                  </Badge>
                ) : (
                  opt.file.endsWith(".mp4") && (
                    <Badge variant="neutral" className="text-[9px] py-0 px-1.5 h-4 bg-slate-100 text-slate-600">
                      AAC MP4
                    </Badge>
                  )
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 truncate max-w-[130px]">
                  {opt.description}
                </span>

                <Button
                  size="sm"
                  variant={isPlaying ? "default" : "outline"}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePreview(opt.file);
                  }}
                  className="h-7 text-[11px] px-2.5"
                >
                  {isPlaying ? (
                    <>
                      <Square className="h-3 w-3 mr-1 fill-current" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1 fill-current" />
                      Preview
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-save footer note */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
        <span className="flex items-center space-x-1.5 text-emerald-600 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{isSaving ? "Saving to staff profile..." : "Saved to your staff account"}</span>
        </span>

        <span className="text-[11px] text-slate-500">
          Default: Sound 1 (/a1.mp3)
        </span>
      </div>
    </div>
  );
}
