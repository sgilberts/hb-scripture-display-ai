import { ScriptureRecord } from "../../shared/types";

export interface VerseContext {
  lastBook: string;
  lastChapter: number;
  navigationDirection: string;
  recentVerses: string[];
}

class VerseMemory {
  private lastBook = "";
  private lastChapter = 1;
  private navigationDirection = "forward";
  private recentVerses: string[] = [];

  getVerseContext(): VerseContext {
    return {
      lastBook: this.lastBook,
      lastChapter: this.lastChapter,
      navigationDirection: this.navigationDirection,
      recentVerses: [...this.recentVerses],
    };
  }

  updateVerseContext(record: ScriptureRecord, direction: string = "forward") {
    this.lastBook = record.bookFull;
    this.lastChapter = record.chapter;
    this.navigationDirection = direction;
    
    const ref = `${record.bookFull} ${record.chapter}:${record.verse}`;
    this.recentVerses.push(ref);
    if (this.recentVerses.length > 20) {
      this.recentVerses.shift();
    }
    console.log(`[VERSE] Context updated: ${ref} (Direction: ${direction})`);
  }
}

export const verseMemory = new VerseMemory();
