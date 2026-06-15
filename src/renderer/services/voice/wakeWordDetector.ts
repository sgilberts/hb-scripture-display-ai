/**
 * Scripture Intelligence Engine v1 — Wake Word Detector
 * Pure keyword streaming match. No ML model. Low CPU. Debounce safe.
 */

const WAKE_PHRASES = [
  "hallelujah mode",
  "mode alléluia",
  "fa bible no bue",
  "open scripture mode",
];

const DEBOUNCE_MS = 3000;

class WakeWordDetector {
  private lastFiredAt = 0;
  private active = false;

  /**
   * Call this on every transcript segment (partial or final).
   * Returns true if a wake word was detected.
   */
  check(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    const now = Date.now();

    for (const phrase of WAKE_PHRASES) {
      if (normalized.includes(phrase)) {
        // Debounce: don't re-fire within the debounce window
        if (now - this.lastFiredAt < DEBOUNCE_MS) return false;

        this.lastFiredAt = now;
        this.active = true;

        const detail = {
          phrase,
          timestamp: now,
          active: this.active,
        };

        window.dispatchEvent(new CustomEvent("wakeWordActivated", { detail }));
        console.log("[WAKE_WORD] Activated:", phrase);
        return true;
      }
    }
    return false;
  }

  isActive(): boolean {
    return this.active;
  }

  deactivate() {
    this.active = false;
  }
}

export const wakeWordDetector = new WakeWordDetector();
