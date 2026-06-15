export interface ContextMemoryState {
  lastVerse: string;
  lastChapter: string;
  languageUsed: string;
  navigationHistory: string[];
}

export class ContextMemoryCapability {
  private state: ContextMemoryState = {
    lastVerse: "",
    lastChapter: "",
    languageUsed: "en",
    navigationHistory: []
  };

  recordInteraction(ref: string, lang: string, direction: string) {
    this.state.lastVerse = ref;
    this.state.languageUsed = lang;
    this.state.navigationHistory.push(direction);
    if (this.state.navigationHistory.length > 50) {
      this.state.navigationHistory.shift();
    }
  }

  suggestFollowUp(text: string): string | null {
    const normalized = text.toLowerCase().trim();
    if (normalized.includes("next verse") || normalized.includes("what about the next verse")) return "NEXT";
    if (normalized.includes("go back") || normalized.includes("previous")) return "PREV";
    return null;
  }

  getState() {
    return { ...this.state };
  }
}

export const contextMemory = new ContextMemoryCapability();
