/**
 * VoiceRegressionTests.ts
 * Automated offline regression tests for the scripture voice pipeline.
 *
 * Run via: voiceRegressionTests.runAll()
 * Outputs PASS/FAIL report to console.
 */

import { parseBibleReference, formatRef, isHighConfidence } from "./BibleReferenceGrammar";
import { routeTranscript } from "./CommandRouter";
import { scriptureLockManager } from "./ScriptureLockManager";
import { verseContextManager } from "./VerseContextManager";

interface TestCase {
  name: string;
  input: string;
  expectedBook: string;
  expectedChapter: number;
  expectedVerse: number | null;
  expectHighConfidence?: boolean;
}

interface TestResult {
  name: string;
  pass: boolean;
  actual: string | null;
  expected: string;
  latencyMs: number;
  notes?: string;
}

const SCRIPTURE_TESTS: TestCase[] = [
  // OT
  { name: "Genesis 1:1", input: "Genesis 1:1", expectedBook: "Genesis", expectedChapter: 1, expectedVerse: 1 },
  { name: "Exodus 14:14", input: "Exodus 14:14", expectedBook: "Exodus", expectedChapter: 14, expectedVerse: 14 },
  { name: "Leviticus 1:1", input: "Leviticus 1:1", expectedBook: "Leviticus", expectedChapter: 1, expectedVerse: 1 },
  { name: "Numbers 6:24", input: "Numbers 6:24", expectedBook: "Numbers", expectedChapter: 6, expectedVerse: 24 },
  { name: "Deuteronomy 6:4", input: "Deuteronomy 6:4", expectedBook: "Deuteronomy", expectedChapter: 6, expectedVerse: 4 },
  { name: "Joshua 1:9", input: "Joshua 1:9", expectedBook: "Joshua", expectedChapter: 1, expectedVerse: 9 },
  { name: "Judges 2:1", input: "Judges 2:1", expectedBook: "Judges", expectedChapter: 2, expectedVerse: 1 },
  { name: "Ruth 1:16", input: "Ruth 1:16", expectedBook: "Ruth", expectedChapter: 1, expectedVerse: 16 },
  { name: "1 Samuel 17:45", input: "First Samuel 17:45", expectedBook: "1 Samuel", expectedChapter: 17, expectedVerse: 45 },
  { name: "2 Samuel 7:1", input: "Second Samuel 7:1", expectedBook: "2 Samuel", expectedChapter: 7, expectedVerse: 1 },
  { name: "1 Kings 18:21", input: "1 Kings 18:21", expectedBook: "1 Kings", expectedChapter: 18, expectedVerse: 21 },
  { name: "2 Kings 2:9", input: "2 Kings 2:9", expectedBook: "2 Kings", expectedChapter: 2, expectedVerse: 9 },
  { name: "1 Chronicles 4:10", input: "1 Chronicles 4:10", expectedBook: "1 Chronicles", expectedChapter: 4, expectedVerse: 10 },
  { name: "2 Chronicles 7:14", input: "2 Chronicles 7:14", expectedBook: "2 Chronicles", expectedChapter: 7, expectedVerse: 14 },
  { name: "Ezra 7:10", input: "Ezra 7:10", expectedBook: "Ezra", expectedChapter: 7, expectedVerse: 10 },
  { name: "Nehemiah 8:10", input: "Nehemiah 8:10", expectedBook: "Nehemiah", expectedChapter: 8, expectedVerse: 10 },
  { name: "Esther 4:14", input: "Esther 4:14", expectedBook: "Esther", expectedChapter: 4, expectedVerse: 14 },
  { name: "Job 19:25", input: "Job 19:25", expectedBook: "Job", expectedChapter: 19, expectedVerse: 25 },
  { name: "Psalms 23:1", input: "Psalm 23:1", expectedBook: "Psalms", expectedChapter: 23, expectedVerse: 1 },
  { name: "Proverbs 3:5", input: "Proverbs 3:5", expectedBook: "Proverbs", expectedChapter: 3, expectedVerse: 5 },
  { name: "Ecclesiastes 3:1", input: "Ecclesiastes 3:1", expectedBook: "Ecclesiastes", expectedChapter: 3, expectedVerse: 1 },
  { name: "Song of Solomon 2:1", input: "Song of Solomon 2:1", expectedBook: "Song of Solomon", expectedChapter: 2, expectedVerse: 1 },
  { name: "Isaiah 40:31", input: "Isaiah 40:31", expectedBook: "Isaiah", expectedChapter: 40, expectedVerse: 31 },
  { name: "Jeremiah 29:11", input: "Jeremiah 29:11", expectedBook: "Jeremiah", expectedChapter: 29, expectedVerse: 11 },
  { name: "Lamentations 3:22", input: "Lamentations 3:22", expectedBook: "Lamentations", expectedChapter: 3, expectedVerse: 22 },
  { name: "Ezekiel 36:26", input: "Ezekiel 36:26", expectedBook: "Ezekiel", expectedChapter: 36, expectedVerse: 26 },
  { name: "Daniel 6:10", input: "Daniel 6:10", expectedBook: "Daniel", expectedChapter: 6, expectedVerse: 10 },
  { name: "Hosea 4:6", input: "Hosea 4:6", expectedBook: "Hosea", expectedChapter: 4, expectedVerse: 6 },
  { name: "Joel 2:28", input: "Joel 2:28", expectedBook: "Joel", expectedChapter: 2, expectedVerse: 28 },
  { name: "Amos 5:24", input: "Amos 5:24", expectedBook: "Amos", expectedChapter: 5, expectedVerse: 24 },
  { name: "Obadiah 1:15", input: "Obadiah 1:15", expectedBook: "Obadiah", expectedChapter: 1, expectedVerse: 15 },
  { name: "Jonah 2:2", input: "Jonah 2:2", expectedBook: "Jonah", expectedChapter: 2, expectedVerse: 2 },
  { name: "Micah 6:8", input: "Micah 6:8", expectedBook: "Micah", expectedChapter: 6, expectedVerse: 8 },
  { name: "Nahum 1:7", input: "Nahum 1:7", expectedBook: "Nahum", expectedChapter: 1, expectedVerse: 7 },
  { name: "Habakkuk 2:2", input: "Habakkuk 2:2", expectedBook: "Habakkuk", expectedChapter: 2, expectedVerse: 2 },
  { name: "Zephaniah 3:17", input: "Zephaniah 3:17", expectedBook: "Zephaniah", expectedChapter: 3, expectedVerse: 17 },
  { name: "Haggai 1:5", input: "Haggai 1:5", expectedBook: "Haggai", expectedChapter: 1, expectedVerse: 5 },
  { name: "Zechariah 4:6", input: "Zechariah 4:6", expectedBook: "Zechariah", expectedChapter: 4, expectedVerse: 6 },
  { name: "Malachi 3:10", input: "Malachi 3:10", expectedBook: "Malachi", expectedChapter: 3, expectedVerse: 10 },
  
  // NT
  { name: "Matthew 28:19", input: "Matthew 28:19", expectedBook: "Matthew", expectedChapter: 28, expectedVerse: 19 },
  { name: "Mark 16:15", input: "Mark 16:15", expectedBook: "Mark", expectedChapter: 16, expectedVerse: 15 },
  { name: "Luke 2:11", input: "Luke 2:11", expectedBook: "Luke", expectedChapter: 2, expectedVerse: 11 },
  { name: "John 3:16", input: "John 3:16", expectedBook: "John", expectedChapter: 3, expectedVerse: 16 },
  { name: "Acts 1:8", input: "Acts 1:8", expectedBook: "Acts", expectedChapter: 1, expectedVerse: 8 },
  { name: "Romans 8:28", input: "Romans 8:28", expectedBook: "Romans", expectedChapter: 8, expectedVerse: 28 },
  { name: "1 Corinthians 13:4", input: "First Corinthians 13:4", expectedBook: "1 Corinthians", expectedChapter: 13, expectedVerse: 4 },
  { name: "2 Corinthians 5:17", input: "Second Corinthians 5:17", expectedBook: "2 Corinthians", expectedChapter: 5, expectedVerse: 17 },
  { name: "Galatians 5:22", input: "Galatians 5:22", expectedBook: "Galatians", expectedChapter: 5, expectedVerse: 22 },
  { name: "Ephesians 2:8", input: "Ephesians 2:8", expectedBook: "Ephesians", expectedChapter: 2, expectedVerse: 8 },
  { name: "Philippians 4:13", input: "Philippians 4:13", expectedBook: "Philippians", expectedChapter: 4, expectedVerse: 13 },
  { name: "Colossians 3:23", input: "Colossians 3:23", expectedBook: "Colossians", expectedChapter: 3, expectedVerse: 23 },
  { name: "1 Thessalonians 5:16", input: "1 Thessalonians 5:16", expectedBook: "1 Thessalonians", expectedChapter: 5, expectedVerse: 16 },
  { name: "2 Thessalonians 3:3", input: "2 Thessalonians 3:3", expectedBook: "2 Thessalonians", expectedChapter: 3, expectedVerse: 3 },
  { name: "1 Timothy 6:12", input: "1 Timothy 6:12", expectedBook: "1 Timothy", expectedChapter: 6, expectedVerse: 12 },
  { name: "2 Timothy 1:7", input: "2 Timothy 1:7", expectedBook: "2 Timothy", expectedChapter: 1, expectedVerse: 7 },
  { name: "Titus 2:11", input: "Titus 2:11", expectedBook: "Titus", expectedChapter: 2, expectedVerse: 11 },
  { name: "Philemon 1:6", input: "Philemon 1:6", expectedBook: "Philemon", expectedChapter: 1, expectedVerse: 6 },
  { name: "Hebrews 11:1", input: "Hebrews 11:1", expectedBook: "Hebrews", expectedChapter: 11, expectedVerse: 1 },
  { name: "James 1:2", input: "James 1:2", expectedBook: "James", expectedChapter: 1, expectedVerse: 2 },
  { name: "1 Peter 5:7", input: "1 Peter 5:7", expectedBook: "1 Peter", expectedChapter: 5, expectedVerse: 7 },
  { name: "2 Peter 3:9", input: "2 Peter 3:9", expectedBook: "2 Peter", expectedChapter: 3, expectedVerse: 9 },
  { name: "1 John 1:9", input: "First John 1:9", expectedBook: "1 John", expectedChapter: 1, expectedVerse: 9 },
  { name: "2 John 1:6", input: "Second John 1:6", expectedBook: "2 John", expectedChapter: 1, expectedVerse: 6 },
  { name: "3 John 1:2", input: "Third John 1:2", expectedBook: "3 John", expectedChapter: 1, expectedVerse: 2 },
  { name: "Jude 1:24", input: "Jude 1:24", expectedBook: "Jude", expectedChapter: 1, expectedVerse: 24 },
  { name: "Revelation 21:4", input: "Revelation 21:4", expectedBook: "Revelation", expectedChapter: 21, expectedVerse: 4 },
];

interface CommandTestCase {
  name: string;
  setup?: { book: string; chapter: number; verse: number };
  input: string;
  expectedRouteType: "scripture" | "command" | "semantic" | "suppress";
  expectedCommand?: string;
  expectedNavRef?: string;
}

const COMMAND_TESTS: CommandTestCase[] = [
  {
    name: "next → navigate (not semantic search)",
    setup: { book: "Genesis", chapter: 1, verse: 1 },
    input: "next",
    expectedRouteType: "command",
    expectedCommand: "next",
    expectedNavRef: "Genesis 1:2",
  },
  {
    name: "back → navigate previous",
    setup: { book: "Genesis", chapter: 1, verse: 2 },
    input: "back",
    expectedRouteType: "command",
    expectedCommand: "back",
    expectedNavRef: "Genesis 1:1",
  },
  {
    name: "clear → suppress navigation",
    input: "clear",
    expectedRouteType: "suppress",
  },
  {
    name: "scripture wins over commands",
    input: "John 3:16",
    expectedRouteType: "scripture",
  },
  {
    name: "buffer bleed — John 3:16 then Genesis 18 — should suppress continuation",
    input: "John 3:16 Genesis 18 verse 1",
    expectedRouteType: "scripture",
  },
];

class VoiceRegressionTests {
  private results: TestResult[] = [];

  async runAll(): Promise<void> {
    console.log("═══════════════════════════════════════════");
    console.log("  VOICE REGRESSION TEST SUITE");
    console.log("═══════════════════════════════════════════");

    this.results = [];

    this.runScriptureParseTests();
    this.runCommandRouteTests();
    this.runContextNavTests();
    this.runLearningTests();
    this.runPreviewStressTest();

    this.printReport();
  }

  private runScriptureParseTests(): void {
    console.log("\n── Scripture Parse Tests ──────────────────");

    for (const tc of SCRIPTURE_TESTS) {
      const start = performance.now();
      const parsed = parseBibleReference(tc.input);
      const latencyMs = Math.round(performance.now() - start);

      let pass = false;
      let actual: string | null = null;
      let notes: string | undefined;

      if (!parsed) {
        notes = "No reference parsed";
        actual = null;
      } else {
        actual = formatRef(parsed);
        const bookOk = parsed.book === tc.expectedBook;
        const chapterOk = parsed.chapter === tc.expectedChapter;
        const verseOk = tc.expectedVerse === null
          ? parsed.verse === null || parsed.verse === undefined
          : parsed.verse === tc.expectedVerse;
        const confidenceOk = tc.expectHighConfidence === undefined
          ? true
          : isHighConfidence(parsed) === tc.expectHighConfidence;

        pass = bookOk && chapterOk && verseOk && confidenceOk;

        if (!bookOk) notes = `Book: expected "${tc.expectedBook}" got "${parsed.book}"`;
        else if (!chapterOk) notes = `Chapter: expected ${tc.expectedChapter} got ${parsed.chapter}`;
        else if (!verseOk) notes = `Verse: expected ${tc.expectedVerse} got ${parsed.verse}`;
        else if (!confidenceOk) notes = `Confidence: expected high=${tc.expectHighConfidence}, got ${parsed.confidence.toFixed(2)}`;
      }

      const expected = tc.expectedVerse
        ? `${tc.expectedBook} ${tc.expectedChapter}:${tc.expectedVerse}`
        : `${tc.expectedBook} ${tc.expectedChapter}`;

      this.results.push({ name: tc.name, pass, actual, expected, latencyMs, notes });
      console.log(`  ${pass ? "✓" : "✗"} [${latencyMs}ms] ${tc.name}${notes ? ` — ${notes}` : ""}`);
    }
  }

  private runCommandRouteTests(): void {
    console.log("\n── Command Route Tests ────────────────────");

    for (const tc of COMMAND_TESTS) {
      const start = performance.now();

      // Reset state
      scriptureLockManager.resetBuffer();
      if (tc.setup) {
        verseContextManager.setCurrentVerse(tc.setup.book, tc.setup.chapter, tc.setup.verse);
      }

      const result = routeTranscript(tc.input, true);
      const latencyMs = Math.round(performance.now() - start);

      const routeOk = result.type === tc.expectedRouteType;
      const cmdOk = tc.expectedCommand ? result.command === tc.expectedCommand : true;
      const navOk = tc.expectedNavRef ? result.navigationRef === tc.expectedNavRef : true;

      const pass = routeOk && cmdOk && navOk;
      let notes: string | undefined;
      if (!routeOk) notes = `Route: expected "${tc.expectedRouteType}" got "${result.type}"`;
      else if (!cmdOk) notes = `Command: expected "${tc.expectedCommand}" got "${result.command}"`;
      else if (!navOk) notes = `Nav: expected "${tc.expectedNavRef}" got "${result.navigationRef}"`;

      this.results.push({
        name: tc.name, pass,
        actual: result.scriptureRef ?? result.command ?? result.type,
        expected: tc.expectedRouteType,
        latencyMs, notes,
      });
      console.log(`  ${pass ? "✓" : "✗"} [${latencyMs}ms] ${tc.name}${notes ? ` — ${notes}` : ""}`);
    }
  }

  private runContextNavTests(): void {
    console.log("\n── Verse Context Navigation Tests ─────────");

    // Test: Genesis 1:1 → next → Genesis 1:2
    verseContextManager.setCurrentVerse("Genesis", 1, 1);
    const next = verseContextManager.next();
    const nextPass = next === "Genesis 1:2";
    console.log(`  ${nextPass ? "✓" : "✗"} Genesis 1:1 → next → ${next} (expected Genesis 1:2)`);
    this.results.push({
      name: "Genesis 1:1 → next = 1:2",
      pass: nextPass,
      actual: next,
      expected: "Genesis 1:2",
      latencyMs: 0,
    });

    // Test: Genesis 1:2 → previous → Genesis 1:1
    verseContextManager.setCurrentVerse("Genesis", 1, 2);
    const prev = verseContextManager.previous();
    const prevPass = prev === "Genesis 1:1";
    console.log(`  ${prevPass ? "✓" : "✗"} Genesis 1:2 → previous → ${prev} (expected Genesis 1:1)`);
    this.results.push({
      name: "Genesis 1:2 → previous = 1:1",
      pass: prevPass,
      actual: prev,
      expected: "Genesis 1:1",
      latencyMs: 0,
    });

    // Test: Genesis 1:31 → next → Genesis 2:1 (cross chapter)
    verseContextManager.setCurrentVerse("Genesis", 1, 31);
    const nextChap = verseContextManager.next();
    const nextChapPass = nextChap === "Genesis 2:1";
    console.log(`  ${nextChapPass ? "✓" : "✗"} Genesis 1:31 → next → ${nextChap} (expected Genesis 2:1)`);
    this.results.push({
      name: "Genesis 1:31 → next = 2:1",
      pass: nextChapPass,
      actual: nextChap,
      expected: "Genesis 2:1",
      latencyMs: 0,
    });
  }

  private runLearningTests(): void {
    console.log("\n── Voice Learning Engine Tests ────────────");

    const { voiceLearningEngine } = require("./VoiceLearningEngine");
    
    // Simulate misheard transcript corrected by user
    voiceLearningEngine.recordCorrection("he back up to two", "Habakkuk 2:2");
    
    const start = performance.now();
    const learned = parseBibleReference("he back up to two");
    const latencyMs = Math.round(performance.now() - start);
    
    const pass = learned?.book === "Habakkuk" && learned?.chapter === 2 && learned?.verse === 2;
    console.log(`  ${pass ? "✓" : "✗"} [${latencyMs}ms] Learning: "he back up to two" -> Habakkuk 2:2`);
    this.results.push({
      name: "Learning: he back up to two -> Habakkuk 2:2",
      pass,
      actual: learned ? formatRef(learned) : "null",
      expected: "Habakkuk 2:2",
      latencyMs,
    });

    // Test 2: Multiple corrections for the same transcript
    voiceLearningEngine.recordCorrection("he back up to two", "Haggai 1:5"); // Corrected to Haggai
    voiceLearningEngine.recordCorrection("he back up to two", "Haggai 1:5"); // Reinforced
    const learned2 = parseBibleReference("he back up to two");
    const pass2 = learned2?.book === "Haggai" && learned2?.chapter === 1 && learned2?.verse === 5;
    console.log(`  ${pass2 ? "✓" : "✗"} Learning: "he back up to two" -> Haggai 1:5`);
    this.results.push({
      name: "Learning (Repeated): he back up to two -> Haggai 1:5",
      pass: pass2,
      actual: learned2 ? formatRef(learned2) : "null",
      expected: "Haggai 1:5",
      latencyMs: 0,
    });
  }

  private runPreviewStressTest(): void {
    console.log("\n── Preview Renderer Stress Test ───────────");
    // Simulating 100 fast rapid transitions
    const start = performance.now();
    let stressPass = true;
    try {
      for (let i = 0; i < 100; i++) {
        // Fast consecutive transitions simulation
        const simulatedEvent = new CustomEvent("scriptureHighlightEvent", {
          detail: { reference: `Genesis 1:${i+1}`, scrollTarget: `verse-Genesis-1-${i+1}` }
        });
        window.dispatchEvent(simulatedEvent);
      }
    } catch (e) {
      stressPass = false;
    }
    const latencyMs = Math.round(performance.now() - start);
    
    console.log(`  ${stressPass ? "✓" : "✗"} [${latencyMs}ms] 100 rapid preview transitions`);
    this.results.push({
      name: "Preview Stress Test (100 transitions)",
      pass: stressPass,
      actual: stressPass ? "No crash" : "Crashed",
      expected: "No crash",
      latencyMs,
    });
  }

  private printReport(): void {
    const passed = this.results.filter(r => r.pass).length;
    const failed = this.results.filter(r => !r.pass).length;
    const avgLatency = Math.round(
      this.results.reduce((s, r) => s + r.latencyMs, 0) / this.results.length
    );

    console.log("\n═══════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} PASS / ${failed} FAIL`);
    console.log(`  Avg parse latency: ${avgLatency}ms`);
    console.log("═══════════════════════════════════════════");

    if (failed > 0) {
      console.log("\n  FAILURES:");
      this.results.filter(r => !r.pass).forEach(r => {
        console.log(`  ✗ ${r.name}`);
        console.log(`    Expected: ${r.expected}`);
        console.log(`    Actual:   ${r.actual ?? "null"}`);
        if (r.notes) console.log(`    Notes:    ${r.notes}`);
      });
    }
  }
}

export const voiceRegressionTests = new VoiceRegressionTests();

// Auto-run in development
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      voiceRegressionTests.runAll();
    }, 500);
  });
}
