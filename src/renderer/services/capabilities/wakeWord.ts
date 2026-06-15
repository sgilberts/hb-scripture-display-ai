export class WakeWordCapability {
  private active = false;

  detect(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    const wakePhrases = [
      "hallelujah mode",      // EN
      "mode alléluia",        // FR
      "fa bible no bue",      // TW
      "open scripture mode"   // EN ALT
    ];

    for (const phrase of wakePhrases) {
      if (normalized.includes(phrase)) {
        this.active = true;
        window.dispatchEvent(new CustomEvent("wakeword.detected", { detail: { phrase, language: this.guessLang(phrase) } }));
        return true;
      }
    }
    return false;
  }

  private guessLang(phrase: string) {
    if (phrase.includes("alléluia")) return "fr";
    if (phrase.includes("bue")) return "tw";
    return "en";
  }
}

export const wakeWordCapability = new WakeWordCapability();
