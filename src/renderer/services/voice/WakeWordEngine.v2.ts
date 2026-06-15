export class WakeWordEngineV2 {
  private isActive = false;

  detect(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    const triggers = ["hallelujah mode", "open scripture mode", "start bible mode"];
    
    for (const phrase of triggers) {
      if (normalized.includes(phrase)) {
        this.isActive = true;
        window.dispatchEvent(new CustomEvent("wakeWordDetected", { detail: { mode: "hallelujah" } }));
        return true;
      }
    }
    return false;
  }

  isWakeWordActive() {
    return this.isActive;
  }
}

export const wakeWordEngine = new WakeWordEngineV2();
