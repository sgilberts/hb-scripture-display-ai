/**
 * Scripture Intelligence Engine v1 — Follow-Up Detector
 * Keyword + regex based. No LLM. No external API.
 * Resolves follow-up intents using context memory + scripture graph.
 */

import { scriptureContextMemory } from "../scripture/contextMemory";
import { scriptureGraph } from "../scripture/scriptureGraph";

export type FollowUpIntent = "next" | "previous" | "repeat" | "expand" | null;

const NEXT_PATTERNS = [
  /\bnext\s*(one|verse|chapter)?\b/i,
  /\bcontinue\b/i,
  /\bgo\s+on\b/i,
  /\bwhat\s+about\s+next\b/i,
  /\bkeep\s+going\b/i,
];

const PREV_PATTERNS = [
  /\bprev(ious)?\s*(one|verse|chapter)?\b/i,
  /\bgo\s+back\b/i,
  /\bbefore\s+that\b/i,
  /\blast\s+one\b/i,
];

const REPEAT_PATTERNS = [
  /\brepeat\b/i,
  /\bagain\b/i,
  /\bread\s+that\s+again\b/i,
];

const EXPAND_PATTERNS = [
  /\bmore\s+context\b/i,
  /\bsurround(ing)?\s+verses\b/i,
  /\bexpand\b/i,
];

export function detectFollowUpIntent(text: string): FollowUpIntent {
  if (NEXT_PATTERNS.some(r => r.test(text))) return "next";
  if (PREV_PATTERNS.some(r => r.test(text))) return "previous";
  if (REPEAT_PATTERNS.some(r => r.test(text))) return "repeat";
  if (EXPAND_PATTERNS.some(r => r.test(text))) return "expand";
  return null;
}

export interface FollowUpResolution {
  intent: FollowUpIntent;
  resolvedReference: string | null;
  contextReferences?: string[];
}

export function resolveFollowUp(text: string): FollowUpResolution | null {
  const intent = detectFollowUpIntent(text);
  if (!intent) return null;

  const currentRef = scriptureContextMemory.getCurrent();

  let resolvedReference: string | null = null;
  let contextReferences: string[] | undefined;

  if (intent === "next") {
    resolvedReference = currentRef ? scriptureGraph.nextVerse(currentRef) : null;
  } else if (intent === "previous") {
    resolvedReference = currentRef ? scriptureGraph.previousVerse(currentRef) : null;
  } else if (intent === "repeat") {
    resolvedReference = currentRef || null;
  } else if (intent === "expand") {
    if (currentRef) {
      contextReferences = scriptureGraph.expandContext(currentRef, 5);
      resolvedReference = currentRef;
    }
  }

  const resolution: FollowUpResolution = { intent, resolvedReference, contextReferences };

  // Non-blocking event dispatch
  window.dispatchEvent(new CustomEvent("followUpResolvedEvent", { detail: resolution }));

  return resolution;
}
