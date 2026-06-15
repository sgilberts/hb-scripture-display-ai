export function detectFollowUp(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  const nextVersePhrases = ["what about the next verse", "and after that", "continue from there", "read the next one"];
  const prevVersePhrases = ["what about the previous verse", "go back one verse", "read the verse before that"];

  for (const phrase of nextVersePhrases) {
    if (normalized.includes(phrase)) return "NEXT_VERSE";
  }
  
  for (const phrase of prevVersePhrases) {
    if (normalized.includes(phrase)) return "PREV_VERSE";
  }

  return null;
}
