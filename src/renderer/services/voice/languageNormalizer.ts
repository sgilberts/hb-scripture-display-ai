/**
 * Scripture Intelligence Engine v1 — Language Normalizer
 * Converts spoken numbers → digits and multilingual aliases → canonical book names.
 * No LLM. No external API. Offline safe.
 */

const SPOKEN_NUMBER_MAP: Record<string, string> = {
  "first": "1",
  "second": "2",
  "third": "3",
  "one": "1",
  "two": "2",
  "three": "3",
  "four": "4",
  "five": "5",
  "six": "6",
  "seven": "7",
  "eight": "8",
  "nine": "9",
  "ten": "10",
};

// Multilingual and common mispronunciation aliases → canonical Bible book name
const BOOK_ALIASES: Record<string, string> = {
  // Twi/phonetic variants
  "yoanes":     "John",
  "yohane":     "John",
  "yohanes":    "John",
  "mateo":      "Matthew",
  "marko":      "Mark",
  "luka":       "Luke",
  "yuda":       "Jude",
  "dawid":      "David", // Psalms of David
  "revelasyon": "Revelation",
  "kolosai":    "Colossians",

  // French variants
  "jean":       "John",
  "luc":        "Luke",
  "marc":       "Mark",
  "matthieu":   "Matthew",
  "actes":      "Acts",
  "romains":    "Romans",
  "apocalypse": "Revelation",
  "galates":    "Galatians",

  // Common OCR/speech errors
  "genesis":    "Genesis",
  "geneses":    "Genesis",
  "exodous":    "Exodus",
  "psam":       "Psalms",
  "psalim":     "Psalms",
  "psalms":     "Psalms",
  "proverb":    "Proverbs",
  "proverbs":   "Proverbs",
  "mathew":     "Matthew",
  "matthews":   "Matthew",
  "jhon":       "John",
  "jonh":       "John",
  "revelations":"Revelation",
  "philippian": "Philippians",
  "ephesian":   "Ephesians",
  "colossian":  "Colossians",
  "thessalonian": "Thessalonians",
  "corinthian": "Corinthians",
  "timothy":    "Timothy",
  "ezekial":    "Ezekiel",
  "isaaiah":    "Isaiah",
  "zachariah":  "Zechariah",

  // Number-prefix aliases
  "chess chronicles": "2 Chronicles",
  "first kings":    "1 Kings",
  "second kings":   "2 Kings",
  "first samuel":   "1 Samuel",
  "second samuel":  "2 Samuel",
  "first chronicles": "1 Chronicles",
  "second chronicles": "2 Chronicles",
  "first corinthians": "1 Corinthians",
  "second corinthians": "2 Corinthians",
  "first thessalonians": "1 Thessalonians",
  "second thessalonians": "2 Thessalonians",
  "first timothy": "1 Timothy",
  "second timothy": "2 Timothy",
  "first peter": "1 Peter",
  "second peter": "2 Peter",
  "first john": "1 John",
  "second john": "2 John",
  "third john": "3 John",
};

export function normalizeLanguage(text: string): string {
  let normalized = text.toLowerCase();

  // Replace full spoken number words before book names
  for (const [spoken, digit] of Object.entries(SPOKEN_NUMBER_MAP)) {
    normalized = normalized.replace(
      new RegExp(`\\b${spoken}\\s+`, "gi"),
      `${digit} `
    );
  }

  // Replace multi-word book alias keys first (longest match wins)
  const aliasKeys = Object.keys(BOOK_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliasKeys) {
    normalized = normalized.replace(
      new RegExp(`\\b${alias}\\b`, "gi"),
      BOOK_ALIASES[alias]
    );
  }

  return normalized;
}
