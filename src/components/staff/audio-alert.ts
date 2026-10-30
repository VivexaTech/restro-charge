// ==============================================================================
// RESTROCHARGE - Staff Audio Alert Synthesizer & Manager
// Export audioAlertService as primary manager and maintain backward-compatible audioAlert
// ==============================================================================

import { audioAlertService } from "@/lib/services/audio-alert-service";

class AudioAlertCompatibilityWrapper {
  public unlock() {
    audioAlertService.unlock();
  }

  public playNewOrderChime() {
    audioAlertService.previewSound(audioAlertService.getSelectedSound());
  }

  public playKitchenAlert() {
    audioAlertService.previewSound(audioAlertService.getSelectedSound());
  }
}

export const audioAlert = new AudioAlertCompatibilityWrapper();
export { audioAlertService } from "@/lib/services/audio-alert-service";
