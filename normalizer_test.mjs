/**
 * Standalone normalizer diagnostic — mirrors the FIXED normalizeBibleTranscript.
 * Run with: node normalizer_test.mjs
 */

const ORDINALS = {
  "1st": "1", "2nd": "2", "3rd": "3",
  "first": "1", "second": "2", "third": "3",
};
const ONES = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function wordsToNumber(words) {
  let total = 0, i = 0;
  while (i < words.length) {
    const w = words[i].toLowerCase();
    if (ONES[w] !== undefined) { total += ONES[w]; i++; }
    else if (TENS[w] !== undefined) {
      total += TENS[w]; i++;
      if (i < words.length && ONES[words[i]?.toLowerCase()] !== undefined) {
        total += ONES[words[i].toLowerCase()]; i++;
      }
    } else if (w === "hundred") { total = (total || 1) * 100; i++; }
    else { const n = parseInt(w, 10); if (!isNaN(n)) { total += n; i++; } else break; }
  }
  return total > 0 ? total : null;
}

const BOOK_ALIASES = {
  "genesis": "Genesis",   "gen": "Genesis",
  "exodus": "Exodus",
  "psalms": "Psalms",     "psalm": "Psalms", "psa": "Psalms",
  "john": "John",         "jn": "John",
  "1 john": "1 John",     "first john": "1 John",  "one john": "1 John",
  "2 john": "2 John",     "second john": "2 John", "two john": "2 John",
  "3 john": "3 John",     "third john": "3 John",  "three john": "3 John",
  "1 kings": "1 Kings",   "first kings": "1 Kings","one kings": "1 Kings",
  "2 kings": "2 Kings",   "second kings": "2 Kings","two kings": "2 Kings",
  "romans": "Romans",
  "habakkuk": "Habakkuk", "hab": "Habakkuk",
  "philippians": "Philippians", "phil": "Philippians",
  "1 corinthians": "1 Corinthians", "first corinthians": "1 Corinthians",
  "1 samuel": "1 Samuel", "first samuel": "1 Samuel",
};
const SORTED_ALIASES = Object.keys(BOOK_ALIASES).sort((a, b) => b.length - a.length);

function normalizeOrdinals(text) {
  let result = text.toLowerCase();
  for (const [spoken, digit] of Object.entries(ORDINALS)) {
    result = result.replace(new RegExp(`\\b${spoken}\\b`, "gi"), digit);
  }
  return result;
}

function resolveAlias(text) {
  const lower = text.toLowerCase();
  for (const alias of SORTED_ALIASES) {
    if (lower.includes(alias)) return lower.replace(alias, BOOK_ALIASES[alias]);
  }
  return text;
}

// ─── FIXED normalizeBibleTranscript ──────────────────────────────────────────
function normalizeBibleTranscript(rawText) {
  if (!rawText) return "";

  const SPELLING_FIXES = { "habbakuk": "habakkuk", "habakuk": "habakkuk", "filipians": "philippians", "tesalonians": "thessalonians" };
  let text = rawText.toLowerCase();
  for (const [bad, good] of Object.entries(SPELLING_FIXES)) {
    text = text.replace(new RegExp(`\\b${bad}\\b`, "g"), good);
  }

  text = normalizeOrdinals(text);
  text = resolveAlias(text);

  const bookTailPattern = /^((?:[1-3]\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(.+)$/;
  const m = text.match(bookTailPattern);
  if (m) {
    const bookPart = m[1];
    const tail = m[2].trim();

    if (!/\d+:\d+/.test(tail)) {
      const NOISE = new Set(["chapter", "verse", "and", "the", "of", "through", "to"]);
      const tokens = tail.split(/\s+/).filter(t => !NOISE.has(t.toLowerCase()));

      let chapterNum = null, verseNum = null;
      if (tokens.length > 0) {
        if (/^\d+$/.test(tokens[0])) {
          chapterNum = parseInt(tokens[0], 10);
          if (tokens.length > 1) {
            verseNum = /^\d+$/.test(tokens[1]) ? parseInt(tokens[1], 10) : wordsToNumber(tokens.slice(1));
          }
        } else {
          let i = 0;
          const chapterWords = [tokens[i]]; i++;
          if (TENS[tokens[0]?.toLowerCase()] !== undefined && i < tokens.length) {
            if (ONES[tokens[i]?.toLowerCase()] !== undefined) { chapterWords.push(tokens[i]); i++; }
          }
          chapterNum = wordsToNumber(chapterWords);
          if (i < tokens.length) verseNum = wordsToNumber(tokens.slice(i));
        }
        if (chapterNum) {
          const verseStr = verseNum ? `:${verseNum}` : "";
          text = `${bookPart} ${chapterNum}${verseStr}`;
        }
      }
    }
  }

  text = text.replace(/((?:[1-3]\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+(\d+)/g, "$1 $2:$3");
  text = text.replace(/\b([a-z])([a-z]+)\b/g, (_, i, r) => i.toUpperCase() + r);
  return text.trim();
}

// ─── Tests ────────────────────────────────────────────────────────────────────
const tests = [
  { input: "John 3:16",                         expected: "John 3:16" },
  { input: "john 3 16",                         expected: "John 3:16" },
  { input: "john chapter three verse sixteen",  expected: "John 3:16" },
  { input: "Genesis 1:1",                       expected: "Genesis 1:1" },
  { input: "Psalm 23",                          expected: "Psalms 23" },
  { input: "First John 1:9",                    expected: "1 John 1:9" },
  { input: "first john 1 9",                    expected: "1 John 1:9" },
  { input: "Second Kings 2:1",                  expected: "2 Kings 2:1" },
  { input: "second kings 2 1",                  expected: "2 Kings 2:1" },
  { input: "Habakkuk 2:2",                      expected: "Habakkuk 2:2" },
  { input: "Philippians 4:13",                  expected: "Philippians 4:13" },
  { input: "Romans eight twenty eight",         expected: "Romans 8:28" },
  { input: "Clear",                             expected: "Clear" },
  { input: "Next",                              expected: "Next" },
  { input: "Previous",                          expected: "Previous" },
];

console.log("=== FIXED normalizeBibleTranscript VERIFICATION ===\n");
let pass = 0, fail = 0;
for (const { input, expected } of tests) {
  const actual = normalizeBibleTranscript(input);
  const ok = actual === expected;
  if (ok) { pass++; console.log(`✓ "${input}"`); }
  else {
    fail++;
    console.log(`✗ "${input}"`);
    console.log(`    expected: "${expected}"`);
    console.log(`    actual:   "${actual}"`);
  }
}
console.log(`\n=== ${pass} PASS, ${fail} FAIL ===`);
if (fail > 0) process.exit(1);
