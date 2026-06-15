type EventHandler = (payload: any) => void;

export class EventBusV2 {
  private listeners: Record<string, EventHandler[]> = {};

  on(event: string, handler: EventHandler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  off(event: string, handler: EventHandler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
  }

  emit(event: string, payload: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(handler => {
        try {
          handler(payload);
        } catch (e) {
          console.error(`[EVENT_BUS_V2] Error in handler for ${event}`, e);
        }
      });
    }
    // Mirror to global window safely
    try {
      window.dispatchEvent(new CustomEvent(`v2.${event}`, { detail: payload }));
    } catch (e) {
      // Ignore
    }
  }
}

export const coreEventBus = new EventBusV2();
