import { coreEventBus } from "../../core/EventBus.v2";
import { scriptureAIEngine } from "../scripture/ScriptureAIEngine.v2";
import { voiceCommandRouter } from "../voice/VoiceCommandRouter.v2";
import { wakeWordEngine } from "../voice/WakeWordEngine.v2";

export interface V2TranscriptPayload {
  text: string;
  final: boolean;
  parsedReference?: string | null;
  intent?: "navigate" | "read" | "idle" | "command";
  confidence?: number;
}

export class TranscriptFilterStackV2 {
  private lastProcessed = "";

  processRawStream(text: string, isFinal: boolean) {
    if (!text.trim()) return;

    // Wake Word Interception
    wakeWordEngine.detect(text);

    // Deduplication layer
    if (this.lastProcessed === text && !isFinal) return;
    this.lastProcessed = text;

    // Cleaning layer (remove umms, ahhs - simplistic placeholder)
    let cleanedText = text.replace(/\b(umm|uhh|ah)\b/gi, "").trim();

    // Intent Engine Layer
    let intent: V2TranscriptPayload["intent"] = "idle";
    const commandNode = voiceCommandRouter.detectAndRoute(cleanedText);
    
    // Scripture AI Layer
    const parsedRef = scriptureAIEngine.parseReference(cleanedText);
    if (parsedRef) {
      intent = "read";
      coreEventBus.emit("intent.parsed", parsedRef);
    } else if (commandNode) {
      intent = "command";
    }

    const payload: V2TranscriptPayload = {
      text: cleanedText,
      final: isFinal,
      parsedReference: parsedRef ? parsedRef.raw : null,
      intent,
      confidence: 1.0
    };

    // Final Emitter
    coreEventBus.emit(isFinal ? "transcript.final" : "transcript.partial", payload);
  }
}

export const transcriptFilterStack = new TranscriptFilterStackV2();
