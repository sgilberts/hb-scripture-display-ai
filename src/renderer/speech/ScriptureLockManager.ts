/**
 * ScriptureLockManager.ts
 * Prevents transcript buffer bleed-over after a scripture reference is detected.
 *
 * Bug fixed: "John 3:16 Genesis 18:1" was treated as one utterance.
 * With lock: John 3:16 locks, displays, resets buffer → Genesis 18:1 becomes new query.
 */

export interface ScriptureLock {
  locked: boolean;
  lockedReference: string;
  lockTimestamp: number;
}

// After locking, ignore continuation speech for this many ms
const LOCK_HOLD_MS = 1500;

class ScriptureLockManager {
  private locked = false;
  private lockedReference = "";
  private lockTimestamp = 0;

  /**
   * Attempt to lock on a newly detected scripture reference.
   * Returns true if this is a fresh lock (new reference).
   */
  tryLock(reference: string): boolean {
    const now = Date.now();

    // Already locked on same reference — ignore
    if (this.locked && this.lockedReference === reference) {
      return false;
    }

    // Lock on the new reference
    this.locked = true;
    this.lockedReference = reference;
    this.lockTimestamp = now;

    console.log(`[SCRIPTURE_LOCK] Locked: ${reference}`);
    window.dispatchEvent(new CustomEvent("scriptureLocked", {
      detail: { reference, timestamp: now }
    }));

    return true;
  }

  /**
   * Reset the lock — call after displaying the verse or after hold window.
   */
  resetBuffer(): void {
    if (!this.locked) return;
    console.log(`[SCRIPTURE_LOCK] Buffer reset (was: ${this.lockedReference})`);
    this.locked = false;
    this.lockedReference = "";
    this.lockTimestamp = 0;
    window.dispatchEvent(new CustomEvent("scriptureBufferReset"));
  }

  /**
   * Returns true if incoming text should be suppressed because we're
   * inside a lock hold window and the text doesn't contain a new scripture.
   */
  shouldSuppressText(text: string, hasNewScripture: boolean): boolean {
    if (!this.locked) return false;
    const age = Date.now() - this.lockTimestamp;
    if (age > LOCK_HOLD_MS) {
      // Lock expired — auto-reset and allow through
      this.resetBuffer();
      return false;
    }
    // If the new text has a new scripture reference, allow it through (new utterance)
    if (hasNewScripture) {
      this.resetBuffer();
      return false;
    }
    return true;
  }

  isLocked(): boolean {
    return this.locked;
  }

  getLockedReference(): string {
    return this.lockedReference;
  }

  getState(): ScriptureLock {
    return {
      locked: this.locked,
      lockedReference: this.lockedReference,
      lockTimestamp: this.lockTimestamp,
    };
  }
}

export const scriptureLockManager = new ScriptureLockManager();
