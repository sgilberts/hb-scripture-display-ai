export interface LanguageDetectionResult {
  language: "en" | "fr" | "tw" | "mixed" | "unknown";
  confidence: number;
}

export class LanguageDetectionCapability {
  detect(text: string): LanguageDetectionResult {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return { language: "unknown", confidence: 0 };

    const frTokens = ["dieu", "aime", "monde", "chapitre", "verset", "jean", "luc", "alléluia"];
    const twTokens = ["nyame", "dɔ", "wiase", "yohane", "asɛm", "bue", "fa"];
    const enTokens = ["god", "love", "world", "chapter", "verse", "john", "luke", "hallelujah"];

    let frScore = 0;
    let twScore = 0;
    let enScore = 0;

    const words = normalized.split(/\s+/);
    for (const w of words) {
      if (frTokens.includes(w)) frScore++;
      if (twTokens.includes(w)) twScore++;
      if (enTokens.includes(w)) enScore++;
    }

    const total = frScore + twScore + enScore;
    if (total === 0) return { language: "en", confidence: 0.5 }; // Default fallback

    const max = Math.max(frScore, twScore, enScore);
    let lang: LanguageDetectionResult["language"] = "mixed";
    
    // Simplistic heuristic
    if (frScore === max && frScore > total * 0.6) lang = "fr";
    else if (twScore === max && twScore > total * 0.6) lang = "tw";
    else if (enScore === max && enScore > total * 0.6) lang = "en";

    const confidence = max / total;
    
    // Non-blocking fire and forget emit
    window.dispatchEvent(new CustomEvent("language.detected", { detail: { language: lang, confidence } }));
    
    return { language: lang, confidence };
  }
}

export const languageDetection = new LanguageDetectionCapability();
