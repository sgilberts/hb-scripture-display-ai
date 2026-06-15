import { ScriptureRecord } from "../../../shared/types";

export class OfflineBibleSearchCapability {
  async semanticSearch(
    query: string,
    translatedQuery: string,
    translation: string,
    ipcSearch: (q: string, t: string) => Promise<ScriptureRecord[]>
  ): Promise<ScriptureRecord[]> {
    const normalized = translatedQuery.toLowerCase().trim() || query.toLowerCase().trim();
    if (!normalized) return [];

    console.log(`[CAPABILITY_SEARCH] Executing offline multilingual semantic query: "${normalized}"`);
    
    try {
      // Stripping filler words logic is kept offline
      const stopwords = ["what", "is", "the", "a", "an", "of", "in", "and", "to", "show", "me", "about"];
      const keywords = normalized.split(/\s+/).filter(w => !stopwords.includes(w)).join(" ");
      return await ipcSearch(keywords || normalized, translation);
    } catch (e) {
      console.error("[CAPABILITY_SEARCH] Failure", e);
      return [];
    }
  }
}

export const offlineBibleSearch = new OfflineBibleSearchCapability();
