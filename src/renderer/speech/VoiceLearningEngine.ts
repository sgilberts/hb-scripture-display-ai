import { ParsedScriptureRef } from "./BibleReferenceGrammar";

interface LearnedMapping {
  canonicalRef: string;
  weight: number;
  lastSeen: number;
}

export class VoiceLearningEngine {
  private mappings: Map<string, LearnedMapping> = new Map();
  private readonly STORAGE_KEY = "hallelujah_voice_learning_v1";

  constructor() {
    this.load();
  }

  private load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        for (const [key, val] of Object.entries(parsed)) {
          this.mappings.set(key, val as LearnedMapping);
        }
      }
    } catch (e) {
      console.warn("Failed to load voice learning mappings", e);
    }
  }

  private save() {
    try {
      const obj = Object.fromEntries(this.mappings.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to save voice learning mappings", e);
    }
  }

  private normalizeTranscript(text: string): string {
    return text.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  }

  recordCorrection(transcript: string, canonicalRef: string) {
    const key = this.normalizeTranscript(transcript);
    if (!key || key.length < 3) return;

    const existing = this.mappings.get(key) || { canonicalRef, weight: 0, lastSeen: 0 };
    
    // If the reference changed for this transcript, we reset weight
    if (existing.canonicalRef !== canonicalRef) {
      existing.canonicalRef = canonicalRef;
      existing.weight = 1;
    } else {
      existing.weight += 1;
    }
    
    existing.lastSeen = Date.now();
    this.mappings.set(key, existing);
    this.save();
    
    console.log(`[LEARN STORE] "${key}" -> ${canonicalRef} (weight: ${existing.weight})`);
  }

  predict(transcript: string): string | null {
    const key = this.normalizeTranscript(transcript);
    const match = this.mappings.get(key);
    
    if (match) {
      console.log(`[LEARN MATCH] "${key}" -> ${match.canonicalRef} (weight: ${match.weight})`);
      console.log(`[LEARN BOOST] ${match.canonicalRef}`);
      return match.canonicalRef;
    }
    return null;
  }
}

export const voiceLearningEngine = new VoiceLearningEngine();
