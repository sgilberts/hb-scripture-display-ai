export class VoiceCommandRouterV2 {
  private lastEmitTime = 0;
  private debounceMs = 400;

  detectAndRoute(text: string): string | null {
    const normalized = text.toLowerCase().trim();
    const validCommands = ["next", "back", "previous verse", "forward"];
    
    let detectedCommand: string | null = null;
    if (validCommands.includes(normalized)) {
      detectedCommand = normalized;
    } else {
      for (const cmd of validCommands) {
        if (normalized.startsWith(`${cmd} `)) {
          detectedCommand = cmd;
          break;
        }
      }
    }

    if (detectedCommand) {
      const now = Date.now();
      if (now - this.lastEmitTime > this.debounceMs) {
        this.lastEmitTime = now;
        window.dispatchEvent(new CustomEvent("voiceCommandDetected", { detail: { command: detectedCommand } }));
      }
    }
    return detectedCommand;
  }
}

export const voiceCommandRouter = new VoiceCommandRouterV2();
