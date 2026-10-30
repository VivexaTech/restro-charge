// ==============================================================================
// RESTROCHARGE - Multi-Tenant Staff Audio Alert & Order Chime Service
// Handles continuous ringing, selectable sounds, autoplay policies, and multi-order state.
// ==============================================================================

import { NotificationSoundFile, OrderItem } from "@/lib/types";

export interface SoundOption {
  id: string;
  name: string;
  file: NotificationSoundFile;
  format: "audio/mpeg" | "audio/mp4";
  description: string;
}

export const NOTIFICATION_SOUNDS: readonly SoundOption[] = [
  {
    id: "sound-1",
    name: "Sound 1",
    file: "/a1.mp3",
    format: "audio/mpeg",
    description: "Standard Restaurant Chime",
  },
  {
    id: "sound-2",
    name: "Sound 2",
    file: "/a2.mp3",
    format: "audio/mpeg",
    description: "High Bell Alert",
  },
  {
    id: "sound-3",
    name: "Sound 3",
    file: "/a3.mp3",
    format: "audio/mpeg",
    description: "Kitchen Dispatch Gong",
  },
  {
    id: "sound-4",
    name: "Sound 4",
    file: "/a4.mp4",
    format: "audio/mp4",
    description: "AAC Audio Alert (MP4 container)",
  },
  {
    id: "sound-5",
    name: "Sound 5",
    file: "/a5.mp3",
    format: "audio/mpeg",
    description: "Modern Dual Chime",
  },
] as const;

export const DEFAULT_SOUND: NotificationSoundFile = "/a1.mp3";
export const ALLOWED_SOUND_FILES: Set<string> = new Set<string>(
  NOTIFICATION_SOUNDS.map((s) => s.file)
);

export function isValidSoundFile(file: any): file is NotificationSoundFile {
  return typeof file === "string" && ALLOWED_SOUND_FILES.has(file);
}

class AudioAlertManager {
  private currentAudio: HTMLAudioElement | null = null;
  private previewAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;

  private selectedSound: NotificationSoundFile = DEFAULT_SOUND;
  private soundEnabled: boolean = true;
  private isRinging: boolean = false;
  private isAutoplayBlocked: boolean = false;
  private isPreviewPlaying: boolean = false;

  // Multi-order tracking: orderId -> OrderItem
  private activePendingOrders: Map<string, OrderItem> = new Map();

  // Tab coordination channel
  private broadcastChannel: BroadcastChannel | null = null;
  private tabId: string = Math.random().toString(36).substring(2, 9);
  private isAudioMasterTab: boolean = true;

  // Listeners for state changes
  private stateListeners: Set<() => void> = new Set();
  private loopTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initTabSync();
      // Read cached sound preference if available
      try {
        const cached = localStorage.getItem("restrocharge_staff_sound");
        if (cached && isValidSoundFile(cached)) {
          this.selectedSound = cached;
        }
        const cachedEnabled = localStorage.getItem("restrocharge_staff_sound_enabled");
        if (cachedEnabled !== null) {
          this.soundEnabled = cachedEnabled === "true";
        }
      } catch {
        // ignore localStorage access issues
      }
    }
  }

  private initTabSync() {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel("restrocharge_audio_sync");
      this.broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === "AUDIO_PLAYING" && data.senderId !== this.tabId) {
          // Another tab on the same browser is already playing the sound
          if (this.isRinging && this.currentAudio) {
            this.currentAudio.pause();
          }
          this.isAudioMasterTab = false;
        } else if (data.type === "AUDIO_STOPPED") {
          this.isAudioMasterTab = true;
        }
      };
    } catch {
      // BroadcastChannel unsupported or blocked
    }
  }

  private notifyStateChange() {
    this.stateListeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("[AudioAlert] Listener error:", e);
      }
    });
  }

  public subscribeState(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Initializes or resumes Web Audio Context to unblock browser autoplay restrictions.
   */
  public async unlock(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === "suspended") {
          await this.audioCtx.resume();
        }
      }

      // Test a muted audio element play to satisfy user-gesture requirement
      const dummy = new Audio();
      dummy.volume = 0;
      dummy.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      await dummy.play();

      this.isAutoplayBlocked = false;
      this.notifyStateChange();

      // If orders were pending while blocked, start playing now
      if (this.activePendingOrders.size > 0 && this.soundEnabled && !this.isRinging) {
        this.startLooping();
      }

      return true;
    } catch (err) {
      console.warn("[AudioAlert] Unlock attempt failed or blocked:", err);
      return false;
    }
  }

  /**
   * Synthesized bell fallback (used if sound files are not yet uploaded or if file playback fails).
   */
  private playSynthesizedChime() {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      // High crisp dual bell
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(783.99, now); // G5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.5, now + 0.15); // C6
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.9);
    } catch {
      // AudioContext blocked
    }
  }

  /**
   * Internal loop runner: plays sound, waits for completion + interval, repeats until activePendingOrders is empty.
   */
  private startLooping() {
    if (this.isRinging || !this.soundEnabled || this.activePendingOrders.size === 0) {
      return;
    }

    if (typeof window === "undefined" || typeof Audio === "undefined") {
      this.isRinging = true;
      this.notifyStateChange();
      return;
    }

    this.isRinging = true;
    this.notifyStateChange();

    const playNext = () => {
      if (this.activePendingOrders.size === 0 || !this.soundEnabled || !this.isRinging) {
        this.stopLooping();
        return;
      }

      if (this.isPreviewPlaying) {
        // Defer alert loop while user is previewing a sound in settings
        this.loopTimer = setTimeout(playNext, 1000);
        return;
      }

      try {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio = null;
        }

        const audio = new Audio(this.selectedSound);
        audio.preload = "auto";
        audio.volume = 1.0;
        this.currentAudio = audio;

        // Broadcast to other tabs to suppress secondary echoes
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({
            type: "AUDIO_PLAYING",
            senderId: this.tabId,
          });
        }

        const handleEnded = () => {
          if (this.isRinging && this.activePendingOrders.size > 0) {
            // Repeat alert after a 1.2s cadence
            this.loopTimer = setTimeout(playNext, 1200);
          }
        };

        audio.addEventListener("ended", handleEnded, { once: true });

        audio.play().catch((playError: any) => {
          if (playError.name === "NotAllowedError") {
            // Autoplay blocked: user hasn't interacted with document
            this.isAutoplayBlocked = true;
            this.isRinging = false;
            this.notifyStateChange();
          } else {
            // File error (e.g. 404 if file not yet uploaded): fallback to synthesized chime
            this.playSynthesizedChime();
            this.loopTimer = setTimeout(playNext, 2000);
          }
        });
      } catch (err) {
        console.warn("[AudioAlert] Playback exception:", err);
        this.playSynthesizedChime();
        this.loopTimer = setTimeout(playNext, 2000);
      }
    };

    playNext();
  }

  private stopLooping() {
    this.isRinging = false;

    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "AUDIO_STOPPED",
          senderId: this.tabId,
        });
      } catch {}
    }

    this.notifyStateChange();
  }

  /**
   * Registers a newly received pending order.
   * If the order is eligible (status === 'NEW'), adds it to the alert set and rings continuously.
   */
  public registerOrderAlert(order: OrderItem) {
    if (order.status !== "NEW") {
      this.removeOrderAlert(order.id);
      return;
    }

    // Add or update order in active alert map
    this.activePendingOrders.set(order.id, order);
    this.notifyStateChange();

    if (this.soundEnabled && !this.isRinging && !this.isAutoplayBlocked) {
      this.startLooping();
    }
  }

  /**
   * Removes an order from the active alert map (e.g. when accepted, cancelled, or served).
   * If no pending orders remain, stops audio ringing immediately.
   */
  public removeOrderAlert(orderId: string) {
    if (this.activePendingOrders.has(orderId)) {
      this.activePendingOrders.delete(orderId);
      this.notifyStateChange();
    }

    if (this.activePendingOrders.size === 0 && this.isRinging) {
      this.stopLooping();
    }
  }

  /**
   * Synchronizes the full set of currently pending orders.
   * Reconciles current orders so orders that were accepted elsewhere are removed.
   */
  public reconcilePendingOrders(orders: OrderItem[]) {
    const newPendingMap = new Map<string, OrderItem>();

    orders.forEach((o) => {
      if (o.status === "NEW") {
        newPendingMap.set(o.id, o);
      }
    });

    // Check if any previously ringing order is no longer pending
    let changed = false;
    for (const orderId of Array.from(this.activePendingOrders.keys())) {
      if (!newPendingMap.has(orderId)) {
        this.activePendingOrders.delete(orderId);
        changed = true;
      }
    }

    // Add any new ones
    for (const [orderId, ord] of Array.from(newPendingMap.entries())) {
      if (!this.activePendingOrders.has(orderId)) {
        this.activePendingOrders.set(orderId, ord);
        changed = true;
      }
    }

    if (changed) {
      this.notifyStateChange();
    }

    if (this.activePendingOrders.size > 0) {
      if (this.soundEnabled && !this.isRinging && !this.isAutoplayBlocked) {
        this.startLooping();
      }
    } else if (this.isRinging) {
      this.stopLooping();
    }
  }

  /**
   * Previews a specific sound file without altering the active order ringing state.
   */
  public async previewSound(soundFile: NotificationSoundFile): Promise<void> {
    this.stopPreview();

    if (!isValidSoundFile(soundFile)) return;

    this.isPreviewPlaying = true;
    this.notifyStateChange();

    return new Promise((resolve) => {
      try {
        const audio = new Audio(soundFile);
        audio.preload = "auto";
        audio.volume = 1.0;
        this.previewAudio = audio;

        const cleanup = () => {
          this.isPreviewPlaying = false;
          this.previewAudio = null;
          this.notifyStateChange();
          resolve();
        };

        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener("error", () => {
          this.playSynthesizedChime();
          setTimeout(cleanup, 800);
        }, { once: true });

        audio.play().catch(() => {
          this.playSynthesizedChime();
          setTimeout(cleanup, 800);
        });
      } catch {
        this.playSynthesizedChime();
        this.isPreviewPlaying = false;
        this.notifyStateChange();
        resolve();
      }
    });
  }

  public stopPreview() {
    if (this.previewAudio) {
      try {
        this.previewAudio.pause();
        this.previewAudio.currentTime = 0;
      } catch {}
      this.previewAudio = null;
    }
    if (this.isPreviewPlaying) {
      this.isPreviewPlaying = false;
      this.notifyStateChange();
    }
  }

  public setSelectedSound(sound: NotificationSoundFile) {
    if (isValidSoundFile(sound)) {
      this.selectedSound = sound;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("restrocharge_staff_sound", sound);
        } catch {}
      }
      this.notifyStateChange();

      // If currently ringing, restart with new sound
      if (this.isRinging) {
        this.stopLooping();
        this.startLooping();
      }
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("restrocharge_staff_sound_enabled", String(enabled));
      } catch {}
    }
    this.notifyStateChange();

    if (!enabled && this.isRinging) {
      this.stopLooping();
    } else if (enabled && this.activePendingOrders.size > 0 && !this.isRinging) {
      this.startLooping();
    }
  }

  // Getters
  public getSelectedSound(): NotificationSoundFile {
    return this.selectedSound;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public isCurrentlyRinging(): boolean {
    return this.isRinging;
  }

  public isBlocked(): boolean {
    return this.isAutoplayBlocked;
  }

  public isPreviewing(): boolean {
    return this.isPreviewPlaying;
  }

  public getActivePendingOrders(): OrderItem[] {
    return Array.from(this.activePendingOrders.values());
  }

  public getActivePendingOrderIds(): string[] {
    return Array.from(this.activePendingOrders.keys());
  }

  public destroy() {
    this.stopLooping();
    this.stopPreview();
    this.stateListeners.clear();
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
  }
}

export const audioAlertService = new AudioAlertManager();
