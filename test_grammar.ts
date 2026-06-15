import { parseBibleReference, formatRef, isHighConfidence } from "./src/renderer/speech/BibleReferenceGrammar";

const tests = [
  { input: "Genesis 1:1", expectedBook: "Genesis", expectedChapter: 1, expectedVerse: 1 },
  { input: "Exodus 14:14", expectedBook: "Exodus", expectedChapter: 14, expectedVerse: 14 },
  { input: "1 Samuel 17:45", expectedBook: "1 Samuel", expectedChapter: 17, expectedVerse: 45 },
  { input: "2 Kings 2:1", expectedBook: "2 Kings", expectedChapter: 2, expectedVerse: 1 },
  { input: "1 Chronicles 4:10", expectedBook: "1 Chronicles", expectedChapter: 4, expectedVerse: 10 },
  { input: "2 Corinthians 5:17", expectedBook: "2 Corinthians", expectedChapter: 5, expectedVerse: 17 },
  { input: "1 Thessalonians 5:18", expectedBook: "1 Thessalonians", expectedChapter: 5, expectedVerse: 18 },
  { input: "Philemon 1:6", expectedBook: "Philemon", expectedChapter: 1, expectedVerse: 6 },
  { input: "Habakkuk 2:2", expectedBook: "Habakkuk", expectedChapter: 2, expectedVerse: 2 },
  { input: "Zephaniah 3:17", expectedBook: "Zephaniah", expectedChapter: 3, expectedVerse: 17 },
  { input: "Ecclesiastes 3:1", expectedBook: "Ecclesiastes", expectedChapter: 3, expectedVerse: 1 },
  { input: "Song of Solomon 2:1", expectedBook: "Song of Solomon", expectedChapter: 2, expectedVerse: 1 },
  { input: "Revelation 21:4", expectedBook: "Revelation", expectedChapter: 21, expectedVerse: 4 },
  { input: "John 3:16", expectedBook: "John", expectedChapter: 3, expectedVerse: 16 },
  { input: "Romans 8:28", expectedBook: "Romans", expectedChapter: 8, expectedVerse: 28 },
  { input: "Philippians 4:13", expectedBook: "Philippians", expectedChapter: 4, expectedVerse: 13 },
  { input: "First John 1:9", expectedBook: "1 John", expectedChapter: 1, expectedVerse: 9 },
  { input: "Third John 1:2", expectedBook: "3 John", expectedChapter: 1, expectedVerse: 2 },
  { input: "holy song 2 1", expectedBook: "Song of Solomon", expectedChapter: 2, expectedVerse: 1 },
  { input: "second timothy 3:16", expectedBook: "2 Timothy", expectedChapter: 3, expectedVerse: 16 },
  { input: "tesalonions chapter 5 verse 18", expectedBook: "1 Thessalonians", expectedChapter: 5, expectedVerse: 18 } // tesalonions maps to thessalonians, wait, is it 1 or 2? I'll just check what it parses as
];

let fails = 0;
for (const t of tests) {
  const res = parseBibleReference(t.input);
  if (!res) {
    console.error(`FAIL: ${t.input} parsed as null`);
    fails++;
    continue;
  }
  if (res.book !== t.expectedBook || res.chapter !== t.expectedChapter || res.verse !== t.expectedVerse) {
    console.error(`FAIL: ${t.input} -> got ${res.book} ${res.chapter}:${res.verse}, expected ${t.expectedBook} ${t.expectedChapter}:${t.expectedVerse}`);
    fails++;
  } else {
    console.log(`PASS: ${t.input} -> ${res.book} ${res.chapter}:${res.verse}`);
  }
}
if (fails === 0) console.log("ALL PASS");
