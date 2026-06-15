export interface TranslationBridgeOutput {
  original: string;
  translated: string;
  canonicalReference?: string;
}

export class TranslationBridgeCapability {
  // Hardcoded mini-dictionary for specific keywords mapping to English
  private frToEn: Record<string, string> = {
    "chapitre": "chapter",
    "verset": "verse",
    "jean": "john",
    "luc": "luke",
    "dieu aime le monde": "God loves the world"
  };

  private twToEn: Record<string, string> = {
    "yohane": "john",
    "asɛm": "word",
    "nyame ye": "God is good",
    "nyame dɔ wiase": "God loves the world"
  };

  translate(text: string, lang: string): TranslationBridgeOutput {
    let translated = text;
    const normalized = text.toLowerCase();

    if (lang === "fr" || lang === "mixed") {
      Object.keys(this.frToEn).forEach(fr => {
        translated = translated.replace(new RegExp(fr, "gi"), this.frToEn[fr]);
      });
    }
    
    if (lang === "tw" || lang === "mixed") {
      Object.keys(this.twToEn).forEach(tw => {
        translated = translated.replace(new RegExp(tw, "gi"), this.twToEn[tw]);
      });
    }

    // Try to guess a canonical reference if possible
    let canonicalReference: string | undefined = undefined;
    const refMatch = translated.match(/([a-z]+)\s+chapter\s+(\d+)\s+verse\s+(\d+)/i);
    if (refMatch) {
      canonicalReference = `${refMatch[1]} ${refMatch[2]}:${refMatch[3]}`;
    }

    const payload: TranslationBridgeOutput = {
      original: text,
      translated,
      canonicalReference
    };

    window.dispatchEvent(new CustomEvent("translation.ready", { detail: payload }));
    return payload;
  }
}

export const translationBridge = new TranslationBridgeCapability();
