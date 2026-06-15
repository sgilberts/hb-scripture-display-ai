/**
 * VerseContextManager.ts
 * Fixes the Genesis 1:1 → Genesis 1:9 bug.
 *
 * Root cause: VerseMemory stored only book+chapter, never verse.
 * Navigation incremented chapter instead of verse.
 *
 * This manager tracks full book+chapter+verse and uses scriptureGraph
 * for boundary-safe traversal.
 */

import { scriptureGraph } from "../services/scripture/scriptureGraph";

export interface VersePosition {
  book: string;
  chapter: number;
  verse: number;
}

class VerseContextManager {
  private current: VersePosition | null = null;

  /**
   * Set the current verse from a confirmed search result.
   */
  setCurrentVerse(book: string, chapter: number, verse: number): void {
    this.current = { book, chapter, verse };
    console.log(`[VERSE_CONTEXT] Current ${book} ${chapter}:${verse}`);
  }

  getCurrentVerse(): VersePosition | null {
    return this.current ? { ...this.current } : null;
  }

  getCurrentRef(): string | null {
    if (!this.current) return null;
    return `${this.current.book} ${this.current.chapter}:${this.current.verse}`;
  }

  /**
   * Navigate to next verse using the scripture graph.
   * Returns the new reference string or null.
   */
  next(): string | null {
    const ref = this.getCurrentRef();
    if (!ref) {
      console.warn("[VERSE_CONTEXT] next() called but no current verse set");
      return null;
    }
    const nextRef = scriptureGraph.nextVerse(ref);
    if (nextRef) {
      const parsed = this._parseRef(nextRef);
      if (parsed) this.current = parsed;
      console.log(`[FOLLOW_UP] Next → ${nextRef}`);
    }
    return nextRef;
  }

  /**
   * Navigate to previous verse using the scripture graph.
   */
  previous(): string | null {
    const ref = this.getCurrentRef();
    if (!ref) {
      console.warn("[VERSE_CONTEXT] previous() called but no current verse set");
      return null;
    }
    const prevRef = scriptureGraph.previousVerse(ref);
    if (prevRef) {
      const parsed = this._parseRef(prevRef);
      if (parsed) this.current = parsed;
      console.log(`[FOLLOW_UP] Previous → ${prevRef}`);
    }
    return prevRef;
  }

  /**
   * Navigate to next chapter (first verse).
   */
  nextChapter(): string | null {
    if (!this.current) return null;
    const lastVerse = scriptureGraph.getVerseCount(this.current.book, this.current.chapter);
    // Jump to last verse of current chapter then next
    const endRef = `${this.current.book} ${this.current.chapter}:${lastVerse}`;
    const nextRef = scriptureGraph.nextVerse(endRef);
    if (nextRef) {
      const parsed = this._parseRef(nextRef);
      if (parsed) this.current = parsed;
    }
    return nextRef;
  }

  /**
   * Parse "Book Chapter:Verse" into a VersePosition.
   */
  private _parseRef(ref: string): VersePosition | null {
    const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!match) return null;
    return {
      book: match[1],
      chapter: parseInt(match[2], 10),
      verse: parseInt(match[3], 10),
    };
  }

  reset(): void {
    this.current = null;
  }
}

export const verseContextManager = new VerseContextManager();
