export interface ScriptureMapOutput {
  canonicalReference: string;
  equivalents: { en: string; fr: string; tw: string };
}

export class ScriptureMapCapability {
  private fuzzyBookMap: Record<string, string> = {
    "chess chronicles": "2 Chronicles",
    "first kings two three": "1 Kings 2:3",
    "jean": "John",
    "yohane": "John"
  };

  mapReference(text: string): ScriptureMapOutput | null {
    let canonical = text.trim();
    
    for (const [fuzzy, clean] of Object.entries(this.fuzzyBookMap)) {
      if (canonical.toLowerCase().includes(fuzzy)) {
        canonical = clean;
        break;
      }
    }

    if (!canonical) return null;

    // Provide multilingual equivalents for the canonical representation
    let equivalents = { en: canonical, fr: canonical, tw: canonical };
    
    if (canonical.toLowerCase().includes("john")) {
      equivalents.fr = canonical.replace(/john/i, "Jean");
      equivalents.tw = canonical.replace(/john/i, "Yohane");
    }

    const payload: ScriptureMapOutput = { canonicalReference: canonical, equivalents };
    window.dispatchEvent(new CustomEvent("scripture.mapped", { detail: payload }));
    
    return payload;
  }
}

export const scriptureMap = new ScriptureMapCapability();
