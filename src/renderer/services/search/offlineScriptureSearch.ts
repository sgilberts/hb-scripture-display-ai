/**
 * Scripture Intelligence Engine v1 — Offline Semantic Scripture Search
 * TF-IDF + keyword scoring, no ML/LLM. Wraps existing SQLite IPC.
 */

import type { ScriptureRecord } from "../../../shared/types";

// Common stop-words to strip before scoring
const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could","should",
  "may","might","must","shall","to","of","in","on","at","by","for",
  "with","about","against","between","into","through","during","before",
  "after","above","below","from","up","down","out","off","over","under",
  "again","further","then","once","and","but","or","so","if","as","than",
  "that","this","what","which","who","me","my","i","we","you","he","she","it",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function tfidfScore(queryTokens: string[], docText: string): number {
  const docTokens = tokenize(docText);
  const docFreq: Record<string, number> = {};
  for (const t of docTokens) docFreq[t] = (docFreq[t] ?? 0) + 1;

  let score = 0;
  for (const qt of queryTokens) {
    if (docFreq[qt]) {
      // Simple TF component (normalized)
      score += docFreq[qt] / docTokens.length;
    }
    // Partial/n-gram match bonus
    for (const dt of Object.keys(docFreq)) {
      if (dt.includes(qt) && dt !== qt) score += 0.1 / docTokens.length;
    }
  }
  return score;
}

class OfflineScriptureSearch {
  /**
   * Search using keyword + TF-IDF scoring.
   * Falls back to calling the existing IPC backend.
   * Non-blocking; must be awaited.
   */
  async search(
    query: string,
    translation: string,
    ipcSearch: (q: string, t: string) => Promise<ScriptureRecord[]>,
    topK = 5
  ): Promise<ScriptureRecord[]> {
    if (!query.trim()) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const keywordQuery = queryTokens.join(" ");

    let results: ScriptureRecord[] = [];
    try {
      results = await ipcSearch(keywordQuery, translation);
    } catch (e) {
      console.error("[OFFLINE_SEARCH] IPC search failed:", e);
      return [];
    }

    if (results.length <= topK) return results;

    // Re-rank by TF-IDF score
    const scored = results.map(r => ({
      record: r,
      score: tfidfScore(queryTokens, r.text ?? ""),
    }));
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, topK).map(s => s.record);

    window.dispatchEvent(new CustomEvent("scriptureSearchResult", { detail: { results: top, query } }));
    return top;
  }
}

export const offlineScriptureSearch = new OfflineScriptureSearch();
