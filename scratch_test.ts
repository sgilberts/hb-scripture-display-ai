import { normalizeBibleTranscript } from "../src/renderer/speech/BibleReferenceGrammar";
import { parseBibleReference } from "../src/renderer/speech/BibleReferenceGrammar";

const phrases = [
  "John 3:16",
  "Genesis 1:1",
  "Psalm 23",
  "First John 1:9",
  "Second Kings 2:1",
  "Habakkuk 2:2",
  "Philippians 4:13",
  "john chapter three verse sixteen",
  "john 3 16"
];

for (const phrase of phrases) {
  const norm = normalizeBibleTranscript(phrase);
  const parsed = parseBibleReference(norm);
  console.log(`Original: "${phrase}" => Normalized: "${norm}" => Parsed:`, parsed ? `${parsed.book} ${parsed.chapter}${parsed.verse ? ':' + parsed.verse : ''}` : null);
}
