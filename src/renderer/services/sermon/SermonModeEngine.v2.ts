export interface SermonBlock {
  type: "intro" | "scripture" | "explanation" | "application" | "summary";
  content: string;
}

export interface SermonPayload {
  title: string;
  sections: SermonBlock[];
}

export class SermonModeEngineV2 {
  private currentSermon: SermonPayload = { title: "Live Sermon", sections: [] };

  processTranscript(text: string): SermonPayload {
    const normalized = text.toLowerCase().trim();
    let type: SermonBlock["type"] = "explanation";
    
    if (normalized.includes("welcome") || normalized.includes("today we")) type = "intro";
    else if (normalized.includes("chapter") && normalized.includes("verse")) type = "scripture";
    else if (normalized.includes("apply this") || normalized.includes("what this means for us")) type = "application";
    else if (normalized.includes("in summary") || normalized.includes("to conclude")) type = "summary";

    this.currentSermon.sections.push({ type, content: text });
    
    return { ...this.currentSermon };
  }
  
  reset() {
    this.currentSermon = { title: "Live Sermon", sections: [] };
  }
}

export const sermonModeEngine = new SermonModeEngineV2();
