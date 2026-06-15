/**
 * AudioFrameRouter.v2.ts
 *
 * Gates audio frames before they reach the Vosk recognizer.
 *
 * Previous version throttled at 30 ms and used a 0.5% silence gate.
 * Both of these were silently dropping the accumulated 4096-sample
 * batches coming from the AudioWorklet, preventing any recognition.
 *
 * Updated rules:
 *  - No time-based throttle (batches arrive at ~4 Hz, never too fast)
 *  - Silence threshold lowered to 0.001 (0.1%) to pass normal speech
 *  - Always accept frames that are large enough to be batched (≥ 1024)
 */
export class AudioFrameRouterV2 {
  private silenceThreshold = 0.001; // 0.1% — low enough to pass soft speech

  processAudioFrame(audioData: Float32Array): boolean {
    // Always pass large batched frames through — they come pre-accumulated
    if (audioData.length >= 1024) {
      return true;
    }

    // For any small frames (e.g. ScriptProcessor fallback), apply silence gate only
    let maxAmplitude = 0;
    for (let i = 0; i < audioData.length; i += 4) {
      const val = Math.abs(audioData[i]);
      if (val > maxAmplitude) maxAmplitude = val;
    }
    return maxAmplitude >= this.silenceThreshold;
  }
}

export const audioFrameRouter = new AudioFrameRouterV2();
