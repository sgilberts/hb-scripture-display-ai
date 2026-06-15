import { ScriptureRecord } from "../../shared/types";

export async function searchScriptureLocal(
  query: string,
  translation: string,
  backendSearch: (q: string, t: string) => Promise<ScriptureRecord[]>
): Promise<ScriptureRecord[]> {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];

  console.log(`[SEARCH] Executing offline semantic query: "${query}"`);
  
  // Clean out filler words to improve backend FTS hit rate (fuzzy proxy)
  const stopwords = ["what", "is", "the", "a", "an", "of", "in", "and", "to", "show", "me", "verse", "about", "verses"];
  const keywords = normalized.split(/\s+/).filter(w => !stopwords.includes(w)).join(" ");
  
  // Rely on backend's SQLite FTS but optimized for semantic hits
  const results = await backendSearch(keywords || normalized, translation);
  return results;
}
