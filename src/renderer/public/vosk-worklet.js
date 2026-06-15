/**
 * vosk-worklet.js
 * AudioWorkletProcessor for Vosk microphone streaming.
 *
 * Accumulates 128-frame chunks internally until BATCH_SIZE samples
 * are collected, then posts a single cloned Float32 block to the
 * main thread.  This gives Vosk enough PCM context per call to
 * produce reliable PARTIAL and FINAL results.
 */

const BATCH_SIZE = 4096; // samples — ~256 ms @ 16 kHz

class VoskAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._active = true;
    this._buffer = new Float32Array(BATCH_SIZE);
    this._filled = 0;

    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this._active = false;
        this._filled = 0; // discard any partial buffer
      }
    };
  }

  process(inputs, _outputs, _parameters) {
    if (!this._active) return false;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // 128 samples per frame

    let srcOffset = 0;

    while (srcOffset < channelData.length) {
      const space = BATCH_SIZE - this._filled;
      const toCopy = Math.min(space, channelData.length - srcOffset);

      this._buffer.set(channelData.subarray(srcOffset, srcOffset + toCopy), this._filled);
      this._filled += toCopy;
      srcOffset += toCopy;

      if (this._filled >= BATCH_SIZE) {
        // Clone before transfer so the internal buffer remains usable
        const batch = new Float32Array(BATCH_SIZE);
        batch.set(this._buffer);

        console.log("[PCM BATCH]", batch.length);
        this.port.postMessage({ type: "audio", data: batch }, [batch.buffer]);

        // Reset accumulator
        this._buffer = new Float32Array(BATCH_SIZE);
        this._filled = 0;
      }
    }

    return true;
  }
}

registerProcessor("vosk-audio-processor", VoskAudioProcessor);
