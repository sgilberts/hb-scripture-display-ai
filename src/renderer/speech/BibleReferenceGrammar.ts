/**
 * BibleReferenceGrammar.ts
 * Scripture Intelligence Engine — Bible Grammar Parser
 *
 * Replaces IntentParser with a robust, high-confidence scripture detector.
 * No LLM. Pure deterministic grammar + alias table.
 */

import { voiceLearningEngine } from "./VoiceLearningEngine";
import { BIBLE_BOOKS } from "./BibleBookRegistry";
import { scriptureGraph } from "../services/scripture/scriptureGraph";

export interface ParsedScriptureRef {
  book: string;        // Canonical book name e.g. "1 Samuel"
  chapter: number;
  verse: number | null;
  verseEnd: number | null;  // For ranges e.g. "3-5"
  raw: string;         // Original matched text
  confidence: number;  // 0–1, used for search gating
}

export interface BibleReferenceAnalysis {
  rawTranscript: string;
  normalizedTranscript: string;
  detectedBook: string | null;
  parsedChapter: number | null;
  parsedVerse: number | null;
  confidenceScore: number | null;
  acceptedReference: string | null;
  rejectedReason: string | null;
  parsedRef: ParsedScriptureRef | null;
}

export const TRANSCRIPT_CONFIDENCE_THRESHOLD = 0.6;

// Spoken number maps

const ORDINALS: Record<string, string> = {
  "1st": "1", "2nd": "2", "3rd": "3",
  "first": "1", "second": "2", "third": "3",
};

const ONES: Record<string, number> = {
  zero: 0, one: 1, wan: 1, two: 2, tu: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const CHAPTER_COUNTS: Record<string, number> = {
  Genesis: 50,
  Exodus: 40,
  Leviticus: 27,
  Numbers: 36,
  Deuteronomy: 34,
  Joshua: 24,
  Judges: 21,
  Ruth: 4,
  "1 Samuel": 31,
  "2 Samuel": 24,
  "1 Kings": 22,
  "2 Kings": 25,
  "1 Chronicles": 29,
  "2 Chronicles": 36,
  Ezra: 10,
  Nehemiah: 13,
  Esther: 10,
  Job: 42,
  Psalms: 150,
  Proverbs: 31,
  Ecclesiastes: 12,
  "Song of Solomon": 8,
  Isaiah: 66,
  Jeremiah: 52,
  Lamentations: 5,
  Ezekiel: 48,
  Daniel: 12,
  Hosea: 14,
  Joel: 3,
  Amos: 9,
  Obadiah: 1,
  Jonah: 4,
  Micah: 7,
  Nahum: 3,
  Habakkuk: 3,
  Zephaniah: 3,
  Haggai: 2,
  Zechariah: 14,
  Malachi: 4,
  Matthew: 28,
  Mark: 16,
  Luke: 24,
  John: 21,
  Acts: 28,
  Romans: 16,
  "1 Corinthians": 16,
  "2 Corinthians": 13,
  Galatians: 6,
  Ephesians: 6,
  Philippians: 4,
  Colossians: 4,
  "1 Thessalonians": 5,
  "2 Thessalonians": 3,
  "1 Timothy": 6,
  "2 Timothy": 4,
  Titus: 3,
  Philemon: 1,
  Hebrews: 13,
  James: 5,
  "1 Peter": 5,
  "2 Peter": 3,
  "1 John": 5,
  "2 John": 1,
  "3 John": 1,
  Jude: 1,
  Revelation: 22,
};

const CANONICAL_BOOKS = new Set(BIBLE_BOOKS.map((book) => book.canonicalName));

const NOISE_ONLY_WORDS = new Set([
  "applause",
  "applaud",
  "clap",
  "claps",
  "clapping",
  "crowd",
  "cheer",
  "cheers",
  "cheering",
  "kick",
  "drum",
  "drums",
  "percussion",
  "beat",
  "beats",
  "bang",
  "banging",
  "bump",
  "bumps",
  "microphone",
  "mic",
  "noise",
  "noises",
  "sound",
  "sounds",
  "thud",
  "tap",
  "taps",
  "hit",
  "hits",
  "hiss",
  "static",
  "random",
  "background",
  "backgrounds",
  "music",
  "laughter",
  "laughing",
  "cough",
  "coughing",
  "silence",
  "unknown",
  "inaudible",
  "um",
  "uh",
  "hmm",
]);

const MIN_REFERENCE_TOKEN_COUNT = 2;
const MAX_REASONABLE_VERSE = 176;

function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let i = 0;
  while (i < words.length) {
    const w = words[i].toLowerCase();
    if (/^\d+$/.test(w)) {
      total += parseInt(w, 10);
      i++;
    } else if (ONES[w] !== undefined) {
      total += ONES[w];
      i++;
    } else if (TENS[w] !== undefined) {
      total += TENS[w];
      i++;
      const next = words[i]?.toLowerCase();
      if (i < words.length && next && ONES[next] !== undefined) {
        total += ONES[next];
        i++;
      } else if (i < words.length && next && /^[1-9]$/.test(next)) {
        total += parseInt(next, 10);
        i++;
      }
    } else if (w === "hundred") {
      total = (total || 1) * 100;
      i++;
    } else {
      break;
    }
  }
  return total > 0 ? total : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAliasText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/[^\w\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface AliasEntry {
  alias: string;
  canonical: string;
  wordCount: number;
  compact: string;
  phonetic: string;
}

function phoneticWord(word: string): string {
  if (/^\d+$/.test(word)) return word;

  let normalized = word
    .replace(/ph/g, "f")
    .replace(/ght/g, "t")
    .replace(/ck/g, "k")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/v/g, "f")
    .replace(/y/g, "i")
    .replace(/w/g, "");

  const first = normalized[0] ?? "";
  normalized = first + normalized.slice(1).replace(/[aeiou]/g, "");
  return normalized.replace(/(.)\1+/g, "$1");
}

function phoneticKey(value: string): string {
  return normalizeAliasText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(phoneticWord)
    .join(" ");
}

function compactText(value: string): string {
  return normalizeAliasText(value).replace(/\s+/g, "");
}

// Build a flattened alias map sorted by word length (longest first).
const ALIAS_MAP: AliasEntry[] = [];
for (const book of BIBLE_BOOKS) {
  const canonicalAlias = normalizeAliasText(book.canonicalName);
  ALIAS_MAP.push({
    alias: canonicalAlias,
    canonical: book.canonicalName,
    wordCount: canonicalAlias.split(/\s+/).length,
    compact: compactText(canonicalAlias),
    phonetic: phoneticKey(canonicalAlias),
  });
  for (const alias of book.aliases) {
    const normalizedAlias = normalizeAliasText(alias);
    ALIAS_MAP.push({
      alias: normalizedAlias,
      canonical: book.canonicalName,
      wordCount: normalizedAlias.split(/\s+/).length,
      compact: compactText(normalizedAlias),
      phonetic: phoneticKey(normalizedAlias),
    });
  }
}
ALIAS_MAP.sort((a, b) => b.wordCount - a.wordCount || b.alias.length - a.alias.length);
const MAX_ALIAS_WORD_COUNT = Math.max(...ALIAS_MAP.map((entry) => entry.wordCount));

function normalizeOrdinals(text: string): string {
  let result = text.toLowerCase();
  for (const [spoken, digit] of Object.entries(ORDINALS)) {
    result = result.replace(new RegExp(`\\b${spoken}\\b`, "gi"), digit);
  }
  return result;
}

export function normalizeBibleTranscript(rawText: string): string {
  if (!rawText) return "";

  let text = rawText
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\bchapter\s+chapter\b/g, "chapter")
    .replace(/([0-9])\s*:\s*([0-9])/g, "$1:$2")
    .replace(/([0-9])\s*-\s*([0-9])/g, "$1-$2")
    .replace(/[-_/]/g, " ")
    .replace(/[^\w\s:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Spelling fixes for tricky book names and common recognizer quirks.
  const SPELLING_FIXES: Record<string, string> = {
    "diteronomi": "deuteronomy",
    "detronomi": "deuteronomy",
    "diteronomy": "deuteronomy",
    "detronomy": "deuteronomy",
    "iezaya": "isaiah",
    "aezaya": "isaiah",
    "aezaiya": "isaiah",
    "isaiya": "isaiah",
    "habbakuk": "habakkuk",
    "habakuk": "habakkuk",
    "habakook": "habakkuk",
    "habbakook": "habakkuk",
    "samiel": "samuel",
    "sammuel": "samuel",
    "samael": "samuel",
    "ezekial": "ezekiel",
    "ezakeeal": "ezekiel",
    "ezekeel": "ezekiel",
    "ezakiel": "ezekiel",
    "filipians": "philippians",
    "tesalonians": "thessalonians",
    "tesalonions": "thessalonians",
    "corintians": "corinthians",
    "efesians": "ephesians",
    "gelatians": "galatians",
    "ecclesiastis": "ecclesiastes",
    "ecclesiasties": "ecclesiastes",
    "eclesiasties": "ecclesiastes",
    "eklisiastis": "ecclesiastes",
    "nahoom": "nahum",
    "nayhum": "nahum",
    "isiah": "isaiah",
  };
  for (const [bad, good] of Object.entries(SPELLING_FIXES)) {
    text = text.replace(new RegExp(`\\b${bad}\\b`, "g"), good);
  }

  // Resolve ordinals while leaving cardinal words intact for chapter parsing.
  text = normalizeOrdinals(text);

  return text.replace(/\s+/g, " ").trim();
}

/**
 * Greedily match longest book alias from tokens
 */
function extractBookMatch(text: string): { canonical: string; matchedAlias: string; remainingText: string } | null {
  const lowerText = text.toLowerCase();

  for (const { alias, canonical } of ALIAS_MAP) {
    const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`);
    const match = lowerText.match(regex);
    if (match) {
      console.log(`[BOOK MATCH] ${alias}`);
      console.log(`[CANONICAL BOOK] ${canonical}`);

      const idx = match.index!;
      const remainingText = lowerText.slice(idx + alias.length).trim();

      return { canonical, matchedAlias: alias, remainingText };
    }
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }

  return previous[b.length];
}

function similarityScore(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

function fuzzyThreshold(alias: AliasEntry): number {
  if (alias.wordCount > 1) return 0.78;
  if (alias.compact.length >= 8) return 0.74;
  if (alias.compact.length >= 6) return 0.82;
  return 0.9;
}

function findFuzzyBookMatch(text: string): { canonical: string; matchedAlias: string; remainingText: string } | null {
  const tokens = text.split(/\s+/).filter(Boolean);
  let bestMatch: {
    canonical: string;
    matchedAlias: string;
    remainingText: string;
    score: number;
  } | null = null;

  for (let start = 0; start < tokens.length; start++) {
    for (let count = Math.min(MAX_ALIAS_WORD_COUNT, tokens.length - start); count >= 1; count--) {
      const phrase = tokens.slice(start, start + count).join(" ");
      const phraseCompact = compactText(phrase);
      if (phraseCompact.length < 3) continue;

      const remainingText = tokens.slice(start + count).join(" ");
      const phrasePhonetic = phoneticKey(phrase);

      for (const alias of ALIAS_MAP) {
        if (Math.abs(phraseCompact.length - alias.compact.length) > 4) continue;
        if (alias.compact.length < 3) continue;

        const compactSimilarity = similarityScore(phraseCompact, alias.compact);
        const phoneticSimilarity = similarityScore(phrasePhonetic, alias.phonetic);
        const score = Math.max(compactSimilarity, phoneticSimilarity * 0.97);
        if (score < fuzzyThreshold(alias)) continue;

        const { chapterNum, verseNum, verseEndNum } = parseChapterAndVerse(remainingText);
        if (getValidationError(alias.canonical, chapterNum, verseNum, verseEndNum)) continue;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            canonical: alias.canonical,
            matchedAlias: phrase,
            remainingText,
            score,
          };
        }
      }
    }
  }

  if (!bestMatch) return null;

  console.log(`[BOOK FUZZY MATCH] ${bestMatch.matchedAlias} (${bestMatch.score.toFixed(2)})`);
  console.log(`[CANONICAL BOOK] ${bestMatch.canonical}`);
  return {
    canonical: bestMatch.canonical,
    matchedAlias: bestMatch.matchedAlias,
    remainingText: bestMatch.remainingText,
  };
}

function isNoiseOnlyTranscript(normalizedText: string): boolean {
  const tokens = normalizedText.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => NOISE_ONLY_WORDS.has(token));
}

function parseChapterAndVerse(remainingText: string): {
  chapterNum: number | null;
  verseNum: number | null;
  verseEndNum: number | null;
} {
  const tokens = remainingText.split(/\s+/).filter((token) => token.length > 0);
  const ignoredWords = new Set(["chapter", "verse", "verses", "and", "the", "of", "through", "number"]);
  const numTokens = tokens.filter((token) => !ignoredWords.has(token));

  if (numTokens.length === 0) {
    return { chapterNum: null, verseNum: null, verseEndNum: null };
  }

  let chapterNum: number | null = null;
  let verseNum: number | null = null;
  let verseEndNum: number | null = null;

  const colonMatch = numTokens[0].match(/^(\d+):(\d+)(?:-(\d+))?$/);
  if (colonMatch) {
    chapterNum = parseInt(colonMatch[1], 10);
    verseNum = parseInt(colonMatch[2], 10);
    verseEndNum = colonMatch[3] ? parseInt(colonMatch[3], 10) : null;
    return { chapterNum, verseNum, verseEndNum };
  }

  const chapterWords: string[] = [];
  let i = 0;
  if (numTokens[i]) {
    chapterWords.push(numTokens[i]);
    i++;
  }

  const firstChapterToken = chapterWords[0]?.toLowerCase();
  const nextChapterToken = numTokens[i]?.toLowerCase();
  if (
    firstChapterToken &&
    TENS[firstChapterToken] !== undefined &&
    nextChapterToken &&
    (ONES[nextChapterToken] !== undefined || /^[1-9]$/.test(nextChapterToken))
  ) {
    chapterWords.push(numTokens[i]);
    i++;
  }

  chapterNum = wordsToNumber(chapterWords);

  if (i < numTokens.length) {
    const remainingVerseTokens = numTokens.slice(i).filter((token) => token !== "to" && token !== "too");
    const verseRangeMatch = remainingVerseTokens[0]?.match(/^(\d+)-(\d+)$/);
    if (verseRangeMatch) {
      verseNum = parseInt(verseRangeMatch[1], 10);
      verseEndNum = parseInt(verseRangeMatch[2], 10);
    } else {
      verseNum = wordsToNumber(remainingVerseTokens);
    }
  }

  return { chapterNum, verseNum, verseEndNum };
}

function getValidationError(book: string, chapter: number | null, verse: number | null, verseEnd: number | null): string | null {
  if (!CANONICAL_BOOKS.has(book)) return "unknown_bible_book";
  if (!chapter || chapter < 1) return "missing_or_invalid_chapter";

  const chapterCount = CHAPTER_COUNTS[book];
  if (!chapterCount) return "missing_book_chapter_metadata";
  if (chapter > chapterCount) return `chapter_out_of_range_${book.replace(/\s+/g, "_").toLowerCase()}_${chapterCount}`;

  if (verse !== null) {
    if (!Number.isInteger(verse) || verse < 1 || verse > MAX_REASONABLE_VERSE) {
      return "invalid_verse";
    }
    const verseCount = scriptureGraph.getVerseCount(book, chapter);
    if (!verseCount) return "missing_chapter_verse_metadata";
    if (verse > verseCount) return `verse_out_of_range_${book.replace(/\s+/g, "_").toLowerCase()}_${chapter}_${verseCount}`;
  }

  if (verseEnd !== null) {
    if (verse === null) return "verse_range_missing_start";
    if (!Number.isInteger(verseEnd) || verseEnd < verse || verseEnd > MAX_REASONABLE_VERSE) {
      return "invalid_verse_range";
    }
    const verseCount = scriptureGraph.getVerseCount(book, chapter);
    if (!verseCount) return "missing_chapter_verse_metadata";
    if (verseEnd > verseCount) return `verse_range_out_of_range_${book.replace(/\s+/g, "_").toLowerCase()}_${chapter}_${verseCount}`;
  }

  return null;
}

function logAnalysis(analysis: BibleReferenceAnalysis): void {
  console.log("[VOICE_GATE] Raw transcript:", analysis.rawTranscript);
  console.log("[VOICE_GATE] Normalized transcript:", analysis.normalizedTranscript);
  console.log("[VOICE_GATE] Detected Bible book:", analysis.detectedBook ?? "none");
  console.log("[VOICE_GATE] Parsed chapter:", analysis.parsedChapter ?? "none");
  console.log("[VOICE_GATE] Parsed verse:", analysis.parsedVerse ?? "none");
  console.log("[VOICE_GATE] Confidence score:", analysis.confidenceScore ?? "unknown");
  if (analysis.acceptedReference) {
    console.log("[VOICE_GATE] Accepted reference:", analysis.acceptedReference);
  } else {
    console.log("[VOICE_GATE] Rejected reason:", analysis.rejectedReason ?? "unknown");
  }
}

export function analyzeBibleTranscript(rawText: string, recognitionConfidence?: number): BibleReferenceAnalysis {
  const rawTranscript = rawText ?? "";
  const normalizedTranscript = normalizeBibleTranscript(rawTranscript);
  const confidenceScore = typeof recognitionConfidence === "number" ? recognitionConfidence : null;

  const reject = (
    rejectedReason: string,
    detectedBook: string | null = null,
    parsedChapter: number | null = null,
    parsedVerse: number | null = null,
  ): BibleReferenceAnalysis => {
    const analysis = {
      rawTranscript,
      normalizedTranscript,
      detectedBook,
      parsedChapter,
      parsedVerse,
      confidenceScore,
      acceptedReference: null,
      rejectedReason,
      parsedRef: null,
    };
    logAnalysis(analysis);
    return analysis;
  };

  if (!normalizedTranscript) return reject("empty_transcript");

  const normalizedTokens = normalizedTranscript.split(/\s+/).filter(Boolean);
  if (isNoiseOnlyTranscript(normalizedTranscript)) return reject("noise_only_transcript");
  if (normalizedTokens.length < MIN_REFERENCE_TOKEN_COUNT) return reject("transcript_too_short");
  if (confidenceScore !== null && confidenceScore < TRANSCRIPT_CONFIDENCE_THRESHOLD) {
    return reject("confidence_below_threshold");
  }

  const exactBookMatch = extractBookMatch(normalizedTranscript);
  let bookMatch = exactBookMatch ?? findFuzzyBookMatch(normalizedTranscript);
  if (!bookMatch) return reject("no_bible_book");

  let { canonical, remainingText } = bookMatch;
  let { chapterNum, verseNum, verseEndNum } = parseChapterAndVerse(remainingText);
  let validationError = getValidationError(canonical, chapterNum, verseNum, verseEndNum);
  if (validationError && exactBookMatch) {
    const fuzzyBookMatch = findFuzzyBookMatch(normalizedTranscript);
    if (fuzzyBookMatch) {
      const fuzzyParsed = parseChapterAndVerse(fuzzyBookMatch.remainingText);
      const fuzzyValidationError = getValidationError(
        fuzzyBookMatch.canonical,
        fuzzyParsed.chapterNum,
        fuzzyParsed.verseNum,
        fuzzyParsed.verseEndNum,
      );
      if (!fuzzyValidationError) {
        console.log(
          `[VOICE_GATE] Recovered from invalid exact book match (${validationError}) using fuzzy book match.`,
        );
        bookMatch = fuzzyBookMatch;
        canonical = fuzzyBookMatch.canonical;
        remainingText = fuzzyBookMatch.remainingText;
        chapterNum = fuzzyParsed.chapterNum;
        verseNum = fuzzyParsed.verseNum;
        verseEndNum = fuzzyParsed.verseEndNum;
        validationError = null;
      }
    }
  }
  if (validationError) {
    return reject(validationError, canonical, chapterNum, verseNum);
  }
  if (chapterNum === null) {
    return reject("missing_or_invalid_chapter", canonical, chapterNum, verseNum);
  }

  const parsedRef: ParsedScriptureRef = {
    book: canonical,
    chapter: chapterNum,
    verse: verseNum,
    verseEnd: verseEndNum,
    raw: rawTranscript,
    confidence: verseNum ? 0.95 : 0.9,
  };

  const acceptedReference = formatRef(parsedRef);
  const analysis: BibleReferenceAnalysis = {
    rawTranscript,
    normalizedTranscript,
    detectedBook: canonical,
    parsedChapter: chapterNum,
    parsedVerse: verseNum,
    confidenceScore,
    acceptedReference,
    rejectedReason: null,
    parsedRef,
  };
  logAnalysis(analysis);
  return analysis;
}

/**
 * Main parse entry point.
 * Detects scripture references from spoken/written text.
 * Returns null if no reference found.
 */
export function parseBibleReference(rawText: string): ParsedScriptureRef | null {
  if (!rawText?.trim()) return null;

  const learnedRef = voiceLearningEngine.predict(rawText);
  if (learnedRef) {
    const match = learnedRef.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (match) {
      return {
        book: match[1],
        chapter: parseInt(match[2], 10),
        verse: parseInt(match[3], 10),
        verseEnd: match[4] ? parseInt(match[4], 10) : null,
        raw: rawText,
        confidence: 1.0,
      };
    }
  }

  return analyzeBibleTranscript(rawText).parsedRef;
}

/**
 * Format a parsed reference as canonical string: "John 3:16"
 */
export function formatRef(ref: ParsedScriptureRef): string {
  if (ref.verse) {
    if (ref.verseEnd) return `${ref.book} ${ref.chapter}:${ref.verse}-${ref.verseEnd}`;
    return `${ref.book} ${ref.chapter}:${ref.verse}`;
  }
  return `${ref.book} ${ref.chapter}`;
}

export function isHighConfidence(ref: ParsedScriptureRef): boolean {
  return ref.confidence >= 0.85;
}

export function getBibleGrammarWords(): string[] {
  return [];
}

console.log("[VOSK] Bible grammar loaded (free dictation mode)");
