/**
 * Scripture Intelligence Engine v1 — Context Memory
 * Deterministic, in-memory only. No LLM. No blocking calls.
 */

export type NavigationDirection = "next" | "back" | "manual" | "voice";

export interface ContextMemoryState {
  currentReference: string;
  lastValidReference: string;
  last10References: string[];
  lastIntent: string;
  navigationDirection: NavigationDirection;
}

class ScriptureContextMemory {
  private state: ContextMemoryState = {
    currentReference: "",
    lastValidReference: "",
    last10References: [],
    lastIntent: "",
    navigationDirection: "voice",
  };

  record(reference: string, intent: string, direction: NavigationDirection = "voice") {
    if (!reference) return;

    this.state.lastValidReference = this.state.currentReference || reference;
    this.state.currentReference = reference;
    this.state.lastIntent = intent;
    this.state.navigationDirection = direction;

    this.state.last10References.push(reference);
    if (this.state.last10References.length > 10) {
      this.state.last10References.shift();
    }
  }

  getState(): Readonly<ContextMemoryState> {
    return { ...this.state };
  }

  getCurrent(): string {
    return this.state.currentReference;
  }

  getLast(): string {
    return this.state.lastValidReference;
  }

  reset() {
    this.state = {
      currentReference: "",
      lastValidReference: "",
      last10References: [],
      lastIntent: "",
      navigationDirection: "voice",
    };
  }
}

export const scriptureContextMemory = new ScriptureContextMemory();
