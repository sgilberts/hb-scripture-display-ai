/**
 * Scripture Intelligence Engine v1 — Sermon Mode Engine
 * Deterministic, template-based structuring. No LLM.
 */

import { scriptureGraph } from "../scripture/scriptureGraph";

export interface StructuredSermon {
  title: string;
  outline: string[];
  verses: string[];
  applicationPoints: string[];
}

// Static application templates per theme keyword
const THEME_APPLICATIONS: Record<string, string[]> = {
  faith: [
    "Trust God even when circumstances are uncertain.",
    "Faith without works is dead — put belief into action.",
    "Remember past faithfulness to strengthen present trust.",
  ],
  love: [
    "Show love through tangible acts of kindness today.",
    "Love your neighbour as yourself, regardless of differences.",
    "Reflect God's unconditional love in your relationships.",
  ],
  grace: [
    "Accept God's grace and extend it to others.",
    "Grace is undeserved — respond with humility and gratitude.",
    "Let grace transform how you view failure and redemption.",
  ],
  hope: [
    "Anchor your hope in God's promises, not circumstances.",
    "Share the source of your hope with those around you.",
    "Hope in Scripture is certain, not merely wishful thinking.",
  ],
  prayer: [
    "Set aside dedicated time for prayer each day.",
    "Pray with expectation, trusting God hears you.",
    "Intercede for others as well as yourself.",
  ],
};

const DEFAULT_APPLICATIONS = [
  "Meditate on this passage throughout the week.",
  "Share what you've learned with someone today.",
  "Ask God how this scripture applies to your life right now.",
];

function detectTheme(topic: string): string | null {
  const lower = topic.toLowerCase();
  for (const key of Object.keys(THEME_APPLICATIONS)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

class SermonModeEngine {
  generate(currentRef: string, topic: string = ""): StructuredSermon {
    const theme = detectTheme(topic);
    const applications = theme
      ? THEME_APPLICATIONS[theme]
      : DEFAULT_APPLICATIONS;

    // Build a contextual set of verses from scripture graph
    const contextVerses = currentRef
      ? scriptureGraph.expandContext(currentRef, 3)
      : [];

    const title = topic
      ? `${topic.charAt(0).toUpperCase() + topic.slice(1)} — A Study`
      : `Scripture Study: ${currentRef || "Opening Passage"}`;

    const outline = [
      "1. Introduction — Setting the context",
      `2. Main Scripture — ${currentRef || "Core Passage"}`,
      "3. Exposition — Understanding the passage",
      "4. Application — Living it out",
      "5. Closing Prayer",
    ];

    const sermon: StructuredSermon = {
      title,
      outline,
      verses: contextVerses.length > 0 ? contextVerses : [currentRef].filter(Boolean),
      applicationPoints: applications,
    };

    window.dispatchEvent(new CustomEvent("sermon.generated", { detail: sermon }));
    return sermon;
  }
}

export const sermonModeEngine = new SermonModeEngine();
