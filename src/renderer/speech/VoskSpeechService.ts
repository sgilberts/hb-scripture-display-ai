import { audioFrameRouter } from "../services/performance/AudioFrameRouter.v2";
import { Model } from "vosk-browser";
import {
  SpeechService,
  SpeechTranscript,
} from "../../shared/speech/SpeechService";
import { normalizeBibleTranscript } from "./BibleReferenceGrammar";

// ─── Model singleton ──────────────────────────────────────────────────────────
// Load once, reuse across restarts. Never reload if model path unchanged.

interface CachedModel {
  path: string;
  model: Model;
}

let _modelCache: CachedModel | null = null;

async function getOrLoadModel(archivePath: string, url: string): Promise<Model> {
  if (_modelCache && _modelCache.path === archivePath) {
    console.log("[VOSK] Using cached model");
    return _modelCache.model;
  }

  console.log("[VOSK] Loading model from", url);
  const model = await createVoskModel(url);
  _modelCache = { path: archivePath, model };
  console.log("[VOSK] Model loaded and cached");
  return model;
}

function createVoskModel(modelUrl: string): Promise<Model> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Timed out while waiting for Vosk model load event."));
    }, 120000);

    const model = new Model(modelUrl, 1);

    model.on("load", (message: any) => {
      console.log("VoskSpeechService: Worker load event:", message);
      window.clearTimeout(timeout);
      if (message.result) { resolve(model); return; }
      reject(new Error("Vosk worker reported an unsuccessful model load."));
    });

    model.on("error", (message: any) => {
      console.error("VoskSpeechService: Worker error event:", message);
      window.clearTimeout(timeout);
      reject(new Error(message?.error ?? "Vosk worker failed to load."));
    });
  });
}

// ─── CSP logger (register once) ───────────────────────────────────────────────
let hasRegisteredCspLogger = false;

function registerCspLogger(): void {
  if (hasRegisteredCspLogger) return;
  hasRegisteredCspLogger = true;
  window.addEventListener("securitypolicyviolation", (event) => {
    console.error("VoskSpeechService: CSP violation", {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
    });
  });
}

// ─── Type for Electron bridge ──────────────────────────────────────────────────
type ElectronVoskBridge = {
  resolveVoskModelUrl?: () => Promise<{ archivePath: string; url: string }>;
};

const DEFAULT_VOSK_MODEL_ARCHIVE = "vosk-model-small-en-us-0.15.tar.gz";

function getRecognizerConfidence(result: any): number | undefined {
  if (typeof result?.confidence === "number") return result.confidence;
  if (!Array.isArray(result?.result) || result.result.length === 0) return undefined;

  const confidences = result.result
    .map((word: any) => word?.conf)
    .filter((confidence: unknown): confidence is number => typeof confidence === "number");

  if (confidences.length === 0) return undefined;
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length;
}

// ─── VoskSpeechService ─────────────────────────────────────────────────────────

export class VoskSpeechService implements SpeechService {
  private model: any = null;
  private recognizer: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;

  // AudioWorklet node (primary)
  private workletNode: AudioWorkletNode | null = null;
  // ScriptProcessor fallback (deprecated, kept as graceful fallback)
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private isListening: boolean = false;
  private lastEmittedTranscript: string = "";

  constructor() {
    console.log("VoskSpeechService: Constructor called");
    registerCspLogger();
  }

  async initialize(modelPath: string): Promise<void> {
    console.log("VoskSpeechService: Initializing with modelPath:", modelPath);
    try {
      const resolved = await this.resolveModel(modelPath);
      console.log("VoskSpeechService: Resolved model path:", resolved.archivePath);
      console.log("VoskSpeechService: Fetch URL:", resolved.url);

      // Verify fetch reachability (HEAD request)
      await this.verifyModelFetch(resolved.url);

      // Use singleton — never double-load
      this.model = await getOrLoadModel(resolved.archivePath, resolved.url);
    } catch (err) {
      if (this.isLikelyWorkerCspError(err)) {
        console.error(
          "VoskSpeechService: Worker/runtime blocked by CSP. Check worker-src for blob: and script-src for wasm-unsafe-eval."
        );
      }
      console.error("VoskSpeechService: Model loading failed", err);
      throw err;
    }
  }

  async startListening(callback: (transcript: SpeechTranscript) => void): Promise<void> {
    console.log("[VOSK] startListening called");
    if (this.isListening) {
      console.warn("[VOSK] startListening ignored: already listening");
      return;
    }
    if (!this.model) throw new Error("Model not initialized");

    this.isListening = true;
    this.lastEmittedTranscript = "";

    // Clean up any existing recognizer just in case
    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }

    // Acquire microphone
    try {
      console.log("[VOSK] Requesting microphone permission");
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[VOSK] Microphone permission granted");
    } catch (err) {
      console.error("[VOSK] Microphone access failed", err);
      this.isListening = false;
      throw err;
    }

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Build recognizer in free recognition mode
    this.recognizer = new this.model.KaldiRecognizer(16000);
    console.log("[VOSK] Recognizer created in free recognition mode");

    // Recognizer event handlers
    this.recognizer.on("result", (message: any) => {
      const result = message?.result ?? {};
      const text = (result.text || "").trim();
      console.log("[VOSK FINAL]", text);
      this.lastEmittedTranscript = "";
      if (!text) return;
      console.log("[NORMALIZER CALLED]", text);
      const normalized = normalizeBibleTranscript(text);
      console.log("[PARSER RECEIVED]", normalized);
      callback({ text: normalized, isFinal: true, confidence: getRecognizerConfidence(result) });
    });

    this.recognizer.on("partialresult", (message: any) => {
      const result = message?.result ?? {};
      const text = (result.partial || "").trim();
      if (!text) return;
      if (text === this.lastEmittedTranscript) return;
      this.lastEmittedTranscript = text;
      console.log("[PARTIAL]", text);
      callback({ text, isFinal: false });
    });

    // Try AudioWorklet first; fall back to ScriptProcessorNode
    const useWorklet = await this.tryStartAudioWorklet(callback);
    if (!useWorklet) {
      this.startScriptProcessorFallback();
    }

    console.log("[VOSK] Listening started");
  }

  /** Attempt AudioWorklet — returns true on success, false on any failure */
  private async tryStartAudioWorklet(_callback: (t: SpeechTranscript) => void): Promise<boolean> {
    if (!this.audioContext || !this.source) return false;
    try {
      // worklet file must be served from same origin — placed in public/
      await this.audioContext.audioWorklet.addModule("./vosk-worklet.js");

      this.workletNode = new AudioWorkletNode(this.audioContext, "vosk-audio-processor");

      this.workletNode.port.onmessage = (event) => {
        if (event.data?.type !== "audio") return;
        const inputData: Float32Array = event.data.data;
        if (!this.recognizer) return;

        // Large batched frames (from worklet accumulator) always pass through.
        // Small frames go through the router's silence gate.
        const shouldFeed = inputData.length >= 1024
          ? true
          : audioFrameRouter.processAudioFrame(inputData);

        if (shouldFeed) {
          console.log("[VOSK FEED]", inputData.length);
          this.recognizer.acceptWaveformFloat(inputData, 16000);
        }
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      console.log("[AUDIO] AudioWorklet active");
      return true;
    } catch (err) {
      console.warn("[AUDIO] AudioWorklet unavailable, falling back to ScriptProcessor:", err);
      return false;
    }
  }

  /** Deprecated ScriptProcessorNode fallback */
  private startScriptProcessorFallback(): void {
    if (!this.audioContext || !this.source) return;
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor = processor;

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      if (this.recognizer && audioFrameRouter.processAudioFrame(inputData)) {
        this.recognizer.acceptWaveformFloat(inputData, 16000);
      }
    };

    this.source.connect(processor);
    processor.connect(this.audioContext.destination);
    console.log("[AUDIO] ScriptProcessor fallback active");
  }

  async stopListening(): Promise<void> {
    console.log("[VOSK] stopListening called");
    this.isListening = false;
    this.lastEmittedTranscript = "";

    // Disconnect AudioWorklet
    if (this.workletNode) {
      this.workletNode.port.postMessage("stop");
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    // Disconnect ScriptProcessor fallback
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      if (this.audioContext.state !== "closed") {
        await this.audioContext.close();
      }
      this.audioContext = null;
    }

    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async resolveModel(modelPath: string): Promise<{ archivePath: string; url: string }> {
    if (this.isAbsoluteUrl(modelPath)) {
      return { archivePath: modelPath, url: modelPath };
    }

    const electronBridge = (window as Window & { electron?: ElectronVoskBridge }).electron;
    if (electronBridge?.resolveVoskModelUrl) {
      return electronBridge.resolveVoskModelUrl();
    }

    const archiveName = this.toArchiveName(modelPath);
    const url = new URL(`/vosk-models/${archiveName}`, window.location.href);
    return { archivePath: `/vosk-models/${archiveName}`, url: url.toString() };
  }

  private async verifyModelFetch(url: string): Promise<void> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      console.log(
        "VoskSpeechService: Fetch success:",
        response.status,
        response.headers.get("content-length") ?? "unknown size"
      );
    } catch (error) {
      console.error("VoskSpeechService: Fetch failure:", url, error);
      throw error;
    }
  }

  private toArchiveName(modelPath: string): string {
    if (!modelPath) return DEFAULT_VOSK_MODEL_ARCHIVE;
    const lastSegment = modelPath.split("/").filter(Boolean).at(-1);
    if (!lastSegment) return DEFAULT_VOSK_MODEL_ARCHIVE;
    return lastSegment.endsWith(".tar.gz") ? lastSegment : `${lastSegment}.tar.gz`;
  }

  private isAbsoluteUrl(value: string): boolean {
    try { new URL(value); return true; } catch { return false; }
  }

  private isLikelyWorkerCspError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return (
      message.includes("Worker") ||
      message.includes("blob") ||
      message.includes("Content Security Policy") ||
      message.includes("CSP")
    );
  }
}
