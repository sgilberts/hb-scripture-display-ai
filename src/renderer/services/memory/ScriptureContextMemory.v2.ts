import { ScriptureRecord } from "../../../shared/types";

export interface ContextMemoryState {
  lastBook: string;
  lastChapter: number;
  lastVerse: number;
  recentVerses: string[];
  navigationStack: string[];
}

export class ScriptureContextMemoryV2 {
  private state: ContextMemoryState = {
    lastBook: "",
    lastChapter: 1,
    lastVerse: 1,
    recentVerses: [],
    navigationStack: []
  };

  resolveFollowUp(text: string): string | null {
    const normalized = text.toLowerCase().trim();
    if (normalized.includes("next verse") || normalized.includes("continue")) {
      return "NEXT_VERSE";
    }
    if (normalized.includes("go back") || normalized.includes("previous verse")) {
      return "PREVIOUS_VERSE";
    }
    return null;
  }

  updateMemory(record: ScriptureRecord, direction: string) {
    this.state.lastBook = record.bookFull;
    this.state.lastChapter = record.chapter;
    this.state.lastVerse = record.verse;
    
    const ref = `${record.bookFull} ${record.chapter}:${record.verse}`;
    this.state.recentVerses.push(ref);
    if (this.state.recentVerses.length > 20) this.state.recentVerses.shift();
    
    this.state.navigationStack.push(direction);
    if (this.state.navigationStack.length > 50) this.state.navigationStack.shift();
  }

  getState(): ContextMemoryState {
    return { ...this.state };
  }
}

export const scriptureMemory = new ScriptureContextMemoryV2();
