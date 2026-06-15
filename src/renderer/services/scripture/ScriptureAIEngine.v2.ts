export interface ParsedReference {
  book: string;
  chapter: number;
  verse?: number;
  raw: string;
}

export class ScriptureAIEngineV2 {
  private fuzzyMap: Record<string, string> = {
    "chess": "1 Chronicles",
    "look": "Luke",
    "math you": "Matthew",
    "axe": "Acts",
    "marks": "Mark"
  };

  parseReference(text: string): ParsedReference | null {
    try {
      let normalized = text.toLowerCase().trim();
      
      // Apply OCR-style fuzzy patches
      for (const [bad, good] of Object.entries(this.fuzzyMap)) {
        if (normalized.includes(bad)) {
          normalized = normalized.replace(bad, good.toLowerCase());
        }
      }

      const words = normalized.split(/\s+/);
      const numbers: Record<string, string> = {
        "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
        "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
        "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
        "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
        "nineteen": "19", "twenty": "20", "thirty": "30", "forty": "40",
        "fifty": "50"
      };

      const textWithDigits = words.map(w => numbers[w] || w).join(" ");
      const regex = /^(first\s+|second\s+|third\s+|1\s+|2\s+|3\s+)?([a-z]+)\s+(?:chapter\s+)?(\d+)(?:\s+(?:verse\s+)?(\d+))?$/i;
      const match = textWithDigits.match(regex);
      
      if (!match) return null;

      let prefix = match[1] ? match[1].trim() : "";
      if (prefix === "first") prefix = "1";
      if (prefix === "second") prefix = "2";
      if (prefix === "third") prefix = "3";
      
      const book = match[2].charAt(0).toUpperCase() + match[2].slice(1);
      const chapter = parseInt(match[3], 10);
      const verse = match[4] ? parseInt(match[4], 10) : undefined;
      const fullBook = prefix ? `${prefix} ${book}` : book;

      return { book: fullBook, chapter, verse, raw: text };
    } catch (e) {
      console.warn("[V2_AI_ENGINE] Failed to parse reference silently", e);
      return null;
    }
  }
}

export const scriptureAIEngine = new ScriptureAIEngineV2();
