export class VoicePerformanceGuardV2 {
  public isListening = false;
  public isProcessingFrame = false;

  canStartListening(): boolean {
    if (this.isListening) {
      console.warn("[V2_GUARD] Prevented duplicate listening initialization.");
      return false;
    }
    this.isListening = true;
    return true;
  }

  markStopped() {
    this.isListening = false;
    this.isProcessingFrame = false;
  }
}

export const performanceGuard = new VoicePerformanceGuardV2();
