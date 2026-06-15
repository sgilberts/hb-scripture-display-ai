export interface StructuredSermon {
  intro: string[];
  scripture: string[];
  explanation: string[];
  application: string[];
  summary: string[];
}

export class SermonBuilderCapability {
  private currentSermon: StructuredSermon = {
    intro: [],
    scripture: [],
    explanation: [],
    application: [],
    summary: []
  };

  buildFromStream(text: string, lang: string) {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return;

    let category: keyof StructuredSermon = "explanation"; // default

    // Basic Multilingual Keywords Heuristics
    if (normalized.includes("welcome") || normalized.includes("bienvenue") || normalized.includes("akwaaba")) {
      category = "intro";
    } else if (normalized.includes("chapter") || normalized.includes("chapitre") || normalized.includes("ti")) {
      category = "scripture";
    } else if (normalized.includes("apply") || normalized.includes("application") || normalized.includes("yɛbɛyɛ dɛn")) {
      category = "application";
    } else if (normalized.includes("summary") || normalized.includes("résumé") || normalized.includes("awiei")) {
      category = "summary";
    }

    this.currentSermon[category].push(text);

    window.dispatchEvent(new CustomEvent("sermon.generated", { detail: { ...this.currentSermon } }));
  }
}

export const sermonBuilder = new SermonBuilderCapability();
