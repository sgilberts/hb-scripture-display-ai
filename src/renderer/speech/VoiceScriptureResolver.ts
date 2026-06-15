import type { ScriptureRecord } from "../../shared/types";
import { BIBLE_BOOKS } from "./BibleBookRegistry";

export interface TranslationDetectionResult {
  translation: string | null;
  cleanedTranscript: string;
}

export interface VoicePhraseResolution {
  query: string;
  translation: string;
  results: ScriptureRecord[];
}

const TRANSLATION_ALIASES: Record<string, string[]> = {
  KJV: ["kjv", "k j v", "king james", "king james version", "king james bible", "authorized version", "authorised version"],
  NKJV: ["nkjv", "n k j v", "new king james", "new king james version", "new king james bible"],
  NIV: ["niv", "n i v", "new international", "new international version"],
  ESV: ["esv", "e s v", "english standard", "english standard version"],
  BBE: ["bbe", "bbe", "bbe version", "bbe bible"],
  GW: ["gw", "g w", "gods word", "gods word version", "gods word bible"],
  GNV: ["gnv", "gnv", "good news version", "good news bible", "good news version"],
  GNB: ["gnb", "g n b", "good news", "good news bible", "good news version"],
  NLT: ["nlt", "n l t", "new living", "new living translation"],
  NASB: ["nasb", "n a s b", "new american standard", "new american standard bible"],
  AMP: ["amp", "amplified", "amplified bible"],
  CSB: ["csb", "christian standard", "christian standard bible"],
  HCSB: ["hcsb", "holman christian standard", "holman christian standard bible"],
  RSV: ["rsv", "revised standard", "revised standard version"],
  NRSV: ["nrsv", "new revised standard", "new revised standard version"],
  ASV: ["asv", "american standard", "american standard version"],
  WEB: ["web", "world english", "world english bible"],
  YLT: ["ylt", "young literal", "youngs literal", "young's literal translation"],
  MSG: ["msg", "message", "the message"],
  TPT: ["tpt", "passion translation", "the passion translation"],
};

const TRANSLATION_COMMAND_WORDS = new Set([
  "please",
  "give",
  "get",
  "me",
  "show",
  "display",
  "open",
  "switch",
  "change",
  "set",
  "select",
  "make",
  "use",
  "using",
  "default",
  "current",
  "bible",
  "scripture",
  "translation",
  "translations",
  "version",
  "versions",
  "to",
  "in",
  "from",
  "as",
  "the",
  "now",
]);

const PHRASE_FILLER_WORDS = new Set([
  "show",
  "me",
  "open",
  "display",
  "find",
  "search",
  "look",
  "lookup",
  "scripture",
  "bible",
  "verse",
  "verses",
  "passage",
  "that",
  "says",
  "say",
  "where",
  "does",
  "the",
  "a",
  "an",
  "please",
  "version",
  "translation",
]);

const NOISE_WORDS = new Set([
  "applause",
  "clap",
  "claps",
  "clapping",
  "crowd",
  "kick",
  "drum",
  "drums",
  "percussion",
  "hit",
  "hits",
  "bump",
  "microphone",
  "mic",
  "noise",
  "random",
  "background",
  "sounds",
  "sound",
  "music",
  "um",
  "uh",
  "hmm",
]);

const MIN_PHRASE_CONTENT_WORDS = 3;
const MAX_SEARCH_CANDIDATES = 16;
const MAX_RESULTS_PER_CANDIDATE = 25;

const BOOK_WORDS = new Set(
  BIBLE_BOOKS.flatMap((book) => [
    ...book.canonicalName.toLowerCase().split(/\s+/),
    ...book.aliases.flatMap((alias) => alias.toLowerCase().split(/\s+/)),
  ]).filter((word) => word.length > 2),
);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferKnownTranslationCode(translation: string): string | null {
  const compactTranslation = compactText(translation);
  if (!compactTranslation) return null;

  for (const [code, aliases] of Object.entries(TRANSLATION_ALIASES)) {
    const normalizedCode = compactText(code);
    const normalizedAliases = aliases.map(compactText);
    if (compactTranslation === normalizedCode || normalizedAliases.includes(compactTranslation)) {
      return code;
    }
  }

  const rankedAliases = Object.entries(TRANSLATION_ALIASES)
    .flatMap(([code, aliases]) =>
      aliases.map((alias) => ({ code, alias: compactText(alias) })),
    )
    .filter(({ alias }) => alias.length > 2)
    .sort((left, right) => right.alias.length - left.alias.length);

  for (const { code, alias } of rankedAliases) {
    if (compactTranslation.includes(alias) || alias.includes(compactTranslation)) {
      return code;
    }
  }

  return null;
}

function translationCandidates(
  availableTranslations: string[],
): Array<{ translation: string; alias: string }> {
  const candidates: Array<{ translation: string; alias: string }> = [];
  for (const translation of availableTranslations) {
    const installedTranslation = translation.trim().toUpperCase();
    if (!installedTranslation) continue;

    const knownCode = inferKnownTranslationCode(installedTranslation);
    const aliases = unique([
      installedTranslation,
      installedTranslation.replace(/[^A-Z0-9]+/g, " "),
      knownCode ?? "",
      ...(knownCode ? TRANSLATION_ALIASES[knownCode] ?? [] : []),
    ]);

    for (const alias of aliases) {
      candidates.push({ translation: installedTranslation, alias });
    }
  }

  const seen = new Set<string>();
  const deduped = candidates.filter((candidate) => {
    const key = `${candidate.translation}:${candidate.alias}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => b.alias.length - a.alias.length);
}

function removeVersionCommandWords(transcript: string): string {
  const remainingWords = normalizeText(transcript)
    .split(/\s+/)
    .filter((word) => word && !TRANSLATION_COMMAND_WORDS.has(word));

  return remainingWords.join(" ");
}

export function detectSpokenTranslation(
  transcript: string,
  availableTranslations: string[],
): TranslationDetectionResult {
  let cleanedTranscript = normalizeText(transcript);

  for (const { translation, alias } of translationCandidates(availableTranslations)) {
    const aliasPattern = alias.split(/\s+/).map(escapeRegExp).join("\\s+");
    const regex = new RegExp(`\\b${aliasPattern}\\b`, "i");
    if (!regex.test(cleanedTranscript)) continue;

    const withoutAlias = cleanedTranscript.replace(regex, " ");
    cleanedTranscript = removeVersionCommandWords(withoutAlias);

    return { translation, cleanedTranscript };
  }

  return { translation: null, cleanedTranscript };
}

function phraseContentWords(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .filter((word) => !PHRASE_FILLER_WORDS.has(word));
}

function isNoisePhrase(query: string): boolean {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((word) => NOISE_WORDS.has(word));
}

function hasPhraseSearchSignal(query: string): boolean {
  if (isNoisePhrase(query)) return false;

  const contentWords = phraseContentWords(query);
  if (contentWords.length < MIN_PHRASE_CONTENT_WORDS) return false;
  if (contentWords.some((word) => BOOK_WORDS.has(word))) return true;
  return contentWords.some((word) => word.length >= 5);
}

function buildPhraseCandidates(query: string): string[] {
  const normalized = normalizeText(query);
  const contentWords = phraseContentWords(normalized);
  const candidates: string[] = [normalized, contentWords.join(" ")];

  for (let size = Math.min(8, contentWords.length); size >= 2; size--) {
    for (let start = 0; start <= contentWords.length - size; start++) {
      candidates.push(contentWords.slice(start, start + size).join(" "));
      if (candidates.length >= MAX_SEARCH_CANDIDATES * 2) break;
    }
    if (candidates.length >= MAX_SEARCH_CANDIDATES * 2) break;
  }

  const anchorWords = contentWords
    .filter((word) => word.length >= 5)
    .sort((a, b) => b.length - a.length);
  candidates.push(...anchorWords.slice(0, 4));

  return unique(candidates).slice(0, MAX_SEARCH_CANDIDATES);
}

function scoreVerse(record: ScriptureRecord, query: string): number {
  const normalizedQuery = normalizeText(query);
  const queryWords = phraseContentWords(normalizedQuery);
  const normalizedText = normalizeText(record.text);
  const reference = normalizeText(`${record.bookFull} ${record.chapter} ${record.verse}`);

  let score = 0;
  if (normalizedText.includes(normalizedQuery)) score += 120;

  let matchedWords = 0;
  for (const word of queryWords) {
    if (normalizedText.includes(word)) {
      matchedWords += 1;
      score += word.length >= 5 ? 8 : 4;
    }
    if (reference.includes(word)) score += 3;
  }

  if (queryWords.length > 0) {
    score += (matchedWords / queryWords.length) * 80;
  }

  for (let i = 0; i < queryWords.length - 1; i++) {
    if (normalizedText.includes(`${queryWords[i]} ${queryWords[i + 1]}`)) {
      score += 12;
    }
  }

  score -= Math.min(normalizedText.length / 500, 12);
  return score;
}

function dedupeAndRankResults(results: ScriptureRecord[], query: string): ScriptureRecord[] {
  const byReference = new Map<string, ScriptureRecord>();
  for (const record of results) {
    const key = `${record.translation}:${record.bookFull}:${record.chapter}:${record.verse}`;
    if (!byReference.has(key)) byReference.set(key, record);
  }

  return [...byReference.values()]
    .sort((a, b) => scoreVerse(b, query) - scoreVerse(a, query))
    .slice(0, 100);
}

export async function resolveVoiceBiblePhrase(
  transcript: string,
  translation: string,
  searchScriptures: (query: string, translation: string) => Promise<ScriptureRecord[]>,
): Promise<VoicePhraseResolution | null> {
  const query = normalizeText(transcript);
  if (!hasPhraseSearchSignal(query)) return null;

  const candidates = buildPhraseCandidates(query);
  const collected: ScriptureRecord[] = [];

  for (const candidate of candidates) {
    const results = await searchScriptures(candidate, translation).catch(() => []);
    collected.push(...results.slice(0, MAX_RESULTS_PER_CANDIDATE));
  }

  if (collected.length === 0) return null;

  return {
    query,
    translation,
    results: dedupeAndRankResults(collected, query),
  };
}
