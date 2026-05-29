import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AudioScriptureAnalysis,
  OutputTarget,
  ScriptureNavigationDirection,
  ScriptureRecord
} from "../shared/types";

export interface BibleImportResponse {
  success: boolean;
  count: number;
  translation?: string;
  canceled?: boolean;
  error?: string;
}

export interface ElectronApi {
  sendProjectionUpdate: (data: any) => void;
  onProjectionUpdate: (callback: (data: any) => void) => void;
  searchBible: (queryStr: string, translation: string) => Promise<any>;
  navigateScripture: (
    reference: string,
    translation: string,
    direction: ScriptureNavigationDirection
  ) => Promise<ScriptureRecord | null>;
  analyzeAudioScripture: (
    audioData: ArrayBuffer,
    mimeType: string
  ) => Promise<AudioScriptureAnalysis>;
  transcribeAudioDeepSpeech: (audioData: ArrayBuffer, sampleRate: number) => Promise<any>;
  synthesizePolly: (text: string, voiceId?: string, format?: string) => Promise<any>;
  hasAudioAiProvider: () => Promise<boolean>;
  pickBackgroundImage: () => Promise<{ canceled: boolean; path: string | null }>;
  pickBibleDatabase: () => Promise<{ canceled: boolean; path: string | null }>;
  pickDeepSpeechModel: () => Promise<{ canceled: boolean; path: string | null }>;
  pickDeepSpeechScorer: () => Promise<{ canceled: boolean; path: string | null }>;
  loadDeepSpeechModel: () => Promise<{ success: boolean; error?: string }>;
  triggerBibleImport: () => Promise<BibleImportResponse>;
  deleteTranslation: (
    translation: string
  ) => Promise<{ deletedCount: number; translations: string[] }>;
  fetchAvailableTranslations: () => Promise<string[]>;
  fetchAvailableOutputs: () => Promise<OutputTarget[]>;
  fetchAppSettings: () => Promise<Record<string, unknown>>;
  saveAppSettings: (settings: Record<string, unknown>) => Promise<Record<string, unknown>>;
  saveIntegrationSettings: (settings: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
  getIntegrationStatus: () => Promise<{ hasDeepSpeechModel: boolean; hasAwsCreds: boolean; awsRegion?: string | null; pollyVoiceId?: string | null; bibleDatabasePath?: string | null; deepspeechModelPath?: string | null; deepspeechScorerPath?: string | null }>;
  deleteIntegrationSecrets: () => Promise<{ success: boolean; error?: string }>;
  exitOutputFullscreen: () => void;
}

declare global {
  interface Window {
    electron: ElectronApi;
  }
}

const electronApi: ElectronApi = {
  sendProjectionUpdate(data: any): void {
    ipcRenderer.send("update-projection", data);
  },
  onProjectionUpdate(callback: (data: any) => void): void {
    ipcRenderer.removeAllListeners("render-text");
    ipcRenderer.on(
      "render-text",
      (_event: IpcRendererEvent, data: any) => callback(data)
    );
  },
  searchBible(queryStr: string, translation: string): Promise<any> {
    return ipcRenderer.invoke("db-query-scripture", queryStr, translation);
  },
  navigateScripture(
    reference: string,
    translation: string,
    direction: ScriptureNavigationDirection
  ): Promise<ScriptureRecord | null> {
    return ipcRenderer.invoke(
      "db-navigate-scripture",
      reference,
      translation,
      direction
    );
  },
  analyzeAudioScripture(
    audioData: ArrayBuffer,
    mimeType: string
  ): Promise<AudioScriptureAnalysis> {
    return ipcRenderer.invoke("analyze-audio-scripture", audioData, mimeType);
  },
  transcribeAudioDeepSpeech(audioData: ArrayBuffer, sampleRate: number): Promise<any> {
    return ipcRenderer.invoke("transcribe-audio-deepspeech", audioData, sampleRate);
  },
  synthesizePolly(text: string, voiceId?: string, format?: string): Promise<any> {
    return ipcRenderer.invoke("synthesize-voice-polly", text, voiceId, format);
  },
  saveIntegrationSettings(settings: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("save-integration-settings", settings);
  },
  getIntegrationStatus(): Promise<{ hasDeepSpeechModel: boolean; hasAwsCreds: boolean; awsRegion?: string | null; pollyVoiceId?: string | null; bibleDatabasePath?: string | null; deepspeechModelPath?: string | null; deepspeechScorerPath?: string | null }> {
    return ipcRenderer.invoke("get-integration-status");
  },
  deleteIntegrationSecrets(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("delete-integration-secrets");
  },
  hasAudioAiProvider(): Promise<boolean> {
    return ipcRenderer.invoke("has-audio-ai-provider");
  },
  pickBackgroundImage(): Promise<{ canceled: boolean; path: string | null }> {
    return ipcRenderer.invoke("pick-background-image");
  },
  pickBibleDatabase(): Promise<{ canceled: boolean; path: string | null }> {
    return ipcRenderer.invoke("pick-bible-database");
  },
  pickDeepSpeechModel(): Promise<{ canceled: boolean; path: string | null }> {
    return ipcRenderer.invoke("pick-deepspeech-model");
  },
  pickDeepSpeechScorer(): Promise<{ canceled: boolean; path: string | null }> {
    return ipcRenderer.invoke("pick-deepspeech-scorer");
  },
  loadDeepSpeechModel(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("load-deepspeech-model");
  },
  triggerBibleImport(): Promise<BibleImportResponse> {
    return ipcRenderer.invoke("open-bible-picker");
  },
  deleteTranslation(
    translation: string
  ): Promise<{ deletedCount: number; translations: string[] }> {
    return ipcRenderer.invoke("delete-translation", translation);
  },
  fetchAvailableTranslations(): Promise<string[]> {
    return ipcRenderer.invoke("get-translations");
  },
  fetchAvailableOutputs(): Promise<OutputTarget[]> {
    return ipcRenderer.invoke("get-output-targets");
  },
  fetchAppSettings(): Promise<Record<string, unknown>> {
    return ipcRenderer.invoke("get-app-settings");
  },
  saveAppSettings(
    settings: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return ipcRenderer.invoke("save-app-settings", settings);
  },
  exitOutputFullscreen(): void {
    ipcRenderer.send("exit-output-fullscreen");
  }
};

contextBridge.exposeInMainWorld("electron", electronApi);
