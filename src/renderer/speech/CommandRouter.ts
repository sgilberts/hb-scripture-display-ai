/**
 * CommandRouter.ts
 * Routes incoming transcript text to the correct handler.
 *
 * Priority:
 *   1. Scripture reference (BibleReferenceGrammar) → lock + display, skip semantic
 *   2. Voice command (next/back/etc.) → navigate, skip semantic
 *   3. Everything else → semantic search
 *
 * Fixes: "next" previously triggered semantic search instead of navigation.
 */

import {
  analyzeBibleTranscript,
  formatRef,
  isHighConfidence,
  ParsedScriptureRef,
} from "./BibleReferenceGrammar";
import { scriptureLockManager } from "./ScriptureLockManager";
import { verseContextManager } from "./VerseContextManager";

export type RouteType = "scripture" | "command" | "semantic" | "suppress";

export interface CommandRouteResult {
  type: RouteType;
  /** Canonical scripture ref if type === "scripture" */
  scriptureRef?: string;
  parsedRef?: ParsedScriptureRef;
  /** Command string if type === "command" */
  command?: string;
  /** Navigation result ref (for next/previous) */
  navigationRef?: string;
}

// Voice navigation commands
const NEXT_COMMANDS = ["next", "go", "go forward", "forward", "next verse", "continue", "move forward"];
const PREV_COMMANDS = [
  "back",
  "go back",
  "previous",
  "previous verse",
  "prev",
  "before this",
  "verse before this",
  "the verse before this one",
  "move back",
];
const CHAPTER_COMMANDS = ["next chapter", "previous chapter"];
const UTILITY_COMMANDS = ["clear", "stop", "repeat"];

function detectCommand(text: string): string | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const commands = [...NEXT_COMMANDS, ...PREV_COMMANDS, ...CHAPTER_COMMANDS, ...UTILITY_COMMANDS]
    .sort((a, b) => b.length - a.length);

  for (const cmd of commands) {
    if (normalized === cmd || normalized.startsWith(cmd + " ") || normalized.endsWith(" " + cmd)) {
      return cmd;
    }
  }
  return null;
}

let lastCommandTime = 0;
let navigationExecutedCount = 0;

/**
 * Main router — call once per transcript (partial or final).
 */
export function routeTranscript(
  text: string,
  isFinal: boolean,
  recognitionConfidence?: number,
): CommandRouteResult {
  const normalized = text.trim();
  if (!normalized) return { type: "suppress" };

  // ── Step 1: Attempt scripture parse ──────────────────────────────────────
  const scriptureAnalysis = analyzeBibleTranscript(normalized, recognitionConfidence);
  const parsed = scriptureAnalysis.parsedRef;
  const hasScripture = parsed !== null;

  // ── Step 2: Check if currently locked and should suppress ────────────────
  if (scriptureLockManager.shouldSuppressText(normalized, hasScripture)) {
    return { type: "suppress" };
  }

  // ── Step 3: Scripture reference detected ─────────────────────────────────
  if (parsed && isHighConfidence(parsed)) {
    const ref = formatRef(parsed);
    // Lock on this reference
    scriptureLockManager.tryLock(ref);

    console.log(`[SEARCH_GATE] Scripture detected — semantic skipped (${ref})`);
    return { type: "scripture", scriptureRef: ref, parsedRef: parsed };
  }

  // ── Step 4: Voice command detection ──────────────────────────────────────
  const command = detectCommand(normalized);
  if (command) {
    // Partial command transcripts must not mutate verse context; the final
    // transcript will execute exactly one navigation action.
    if (!isFinal) {
      console.log(`[NAV COMMAND] Waiting for final transcript before executing '${command}'`);
      return { type: "suppress" };
    }

    const now = Date.now();
    if (now - lastCommandTime < 600) {
      console.log(`[NAV COMMAND] Suppressed duplicate '${command}' (debounce)`);
      return { type: "suppress" };
    }
    lastCommandTime = now;

    console.log(`[NAV COMMAND] ${command}`);
    const navSource = verseContextManager.getCurrentRef();
    console.log(`[NAV SOURCE] ${navSource || "none"}`);
    console.log(`[NAV BEFORE] ${navSource || "none"}`);

    let navigationRef: string | undefined;
    let navigationDirection: "next" | "previous" | "next chapter" | null = null;

    if (NEXT_COMMANDS.includes(command)) {
      navigationDirection = "next";
      const next = verseContextManager.next();
      if (next) {
        navigationRef = next;
        console.log(`[NAV TARGET] ${next}`);
        window.dispatchEvent(new CustomEvent("verseNavigation", {
          detail: { direction: "next", reference: next }
        }));
      }
    } else if (PREV_COMMANDS.includes(command)) {
      navigationDirection = "previous";
      const prev = verseContextManager.previous();
      if (prev) {
        navigationRef = prev;
        console.log(`[NAV TARGET] ${prev}`);
        window.dispatchEvent(new CustomEvent("verseNavigation", {
          detail: { direction: "previous", reference: prev }
        }));
      }
    } else if (command === "next chapter") {
      navigationDirection = "next chapter";
      const next = verseContextManager.nextChapter();
      if (next) {
        navigationRef = next;
        console.log(`[NAV TARGET] Chapter → ${next}`);
      }
    }

    if (navigationRef && navigationDirection) {
      navigationExecutedCount += 1;
      console.log(`[NAV DEBUG] Current reference: ${navSource || "none"}`);
      console.log(`[NAV DEBUG] Target reference: ${navigationRef}`);
      console.log(`[NAV DEBUG] Navigation direction: ${navigationDirection}`);
      console.log(`[NAV DEBUG] Navigation executed count: ${navigationExecutedCount}`);
    }

    console.log(`[NAV AFTER] ${verseContextManager.getCurrentRef() || "none"}`);

    window.dispatchEvent(new CustomEvent("voiceCommandDetected", {
      detail: { command, navigationRef }
    }));

    return { type: "command", command, navigationRef };
  }

  // ── Step 5: Strict lookup gate ───────────────────────────────────────────
  // Final non-reference transcripts must not reach scripture lookup.
  if (!isFinal) return { type: "suppress" };

  console.log(
    `[SEARCH_GATE] Suppressed transcript before lookup (${scriptureAnalysis.rejectedReason ?? "not_a_scripture_reference"})`,
  );
  return { type: "suppress" };
}
