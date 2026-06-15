export interface SermonOutput {
  tag: "INTRO" | "SCRIPTURE" | "EXPLANATION" | "APPLICATION";
  transcript: string;
  timestamp: number;
}

export function processSermonTranscript(text: string): SermonOutput | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  let tag: SermonOutput["tag"] = "EXPLANATION"; // Default
  
  if (normalized.startsWith("welcome") || normalized.startsWith("today we are going to")) {
    tag = "INTRO";
  } else if (normalized.includes("chapter") && normalized.includes("verse")) {
    tag = "SCRIPTURE";
  } else if (normalized.includes("this means") || normalized.includes("so practically") || normalized.includes("let us apply") || normalized.includes("therefore")) {
    tag = "APPLICATION";
  }

  console.log(`[SERMON] Tagged block as ${tag}`);
  
  return {
    tag,
    transcript: text,
    timestamp: Date.now()
  };
}
