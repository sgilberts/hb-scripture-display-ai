import { ScriptureRecord } from "../../../shared/types";

export class OfflineScriptureSearchV2 {
  async search(
    query: string, 
    translation: string,
    ipcFallback: (q: string, t: string) => Promise<ScriptureRecord[]>
  ): Promise<ScriptureRecord[]> {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];

    console.log(`[V2_SEARCH] Executing offline semantic query: "${query}"`);
    
    // Fuzzy matching payload prep without blocking UI
    const stopwords = ["what", "is", "the", "a", "an", "of", "in", "and", "to", "show", "me", "verse", "about", "verses"];
    const keywords = normalized.split(/\s+/).filter(w => !stopwords.includes(w)).join(" ");
    
    try {
      return await ipcFallback(keywords || normalized, translation);
    } catch (e) {
      console.error("[V2_SEARCH] Search failure", e);
      return [];
    }
  }
}

export const offlineSearchEngine = new OfflineScriptureSearchV2();
