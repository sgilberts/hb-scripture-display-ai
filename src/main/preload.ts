import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AudioScriptureAnalysis,
  OutputTarget,
  ScriptureNavigationDirection,
  ScriptureRecord,
  LyricRecord,
  ScheduleRecord
  // @ts-ignore
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
  syncVideoTime: (cameraId: number, time: number) => void;
  onSyncVideoTime: (callback: (cameraId: number, time: number) => void) => void;
  submitTranslationTag: (responseChannel: string, value: string | null) => void;
  searchBible: (queryStr: string, translation: string) => Promise<any>;
  navigateScripture: (
    reference: string,
    translation: string,
    direction: ScriptureNavigationDirection,
  ) => Promise<ScriptureRecord | null>;
  analyzeAudioScripture: (
    audioData: ArrayBuffer,
    mimeType: string,
  ) => Promise<AudioScriptureAnalysis>;
  synthesizePolly: (
    text: string,
    voiceId?: string,
    format?: string,
  ) => Promise<any>;
  pickBackgroundImage: () => Promise<{
    canceled: boolean;
    path: string | null;
  }>;
  pickBibleDatabase: () => Promise<{ canceled: boolean; path: string | null }>;
  triggerBibleImport: () => Promise<BibleImportResponse>;
  deleteTranslation: (
    translation: string,
  ) => Promise<{ deletedCount: number; translations: string[] }>;
  fetchAvailableTranslations: () => Promise<string[]>;
  fetchAvailableOutputs: () => Promise<OutputTarget[]>;
  resolveVoskModelUrl: () => Promise<{
    archivePath: string;
    url: string;
  }>;
  fetchAppSettings: () => Promise<Record<string, unknown>>;
  saveAppSettings: (
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  saveIntegrationSettings: (
    settings: Record<string, string>,
  ) => Promise<{ success: boolean; error?: string }>;
  getIntegrationStatus: () => Promise<{
    hasAwsCreds: boolean;
    awsRegion?: string | null;
    pollyVoiceId?: string | null;
    bibleDatabasePath?: string | null;
  }>;
  deleteIntegrationSecrets: () => Promise<{ success: boolean; error?: string }>;
  exitOutputFullscreen: () => void;
  importCanvasMedia: (sourcePath: string) => Promise<{ path: string }>;
  saveLyric: (record: LyricRecord) => Promise<void>;
  getLyrics: () => Promise<LyricRecord[]>;
  deleteLyric: (id: string) => Promise<void>;
  saveSchedule: (record: ScheduleRecord) => Promise<void>;
  getSchedules: () => Promise<ScheduleRecord[]>;
  deleteSchedule: (id: string) => Promise<void>;
  exportScheduleFile: (name: string, data: string) => Promise<void>;
  importScheduleFile: () => Promise<string | null>;
  getNetworkStreams: () => Promise<any[]>;
  refreshNetworkStreams: () => Promise<any[]>;
  deleteNetworkStream: (sourceId: string) => Promise<any[]>;
  onNetworkStreamsUpdated: (callback: (streams: any[]) => void) => void;
  onOmtVideoFrame: (callback: (streamId: string, payload: Uint8Array) => void) => () => void;
  onOmtAudioChunk: (callback: (streamId: string, payload: Uint8Array) => void) => () => void;
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
    ipcRenderer.on("render-text", (_event: IpcRendererEvent, data: any) =>
      callback(data),
    );
  },
  syncVideoTime(cameraId: number, time: number): void {
    ipcRenderer.send("sync-video-time", cameraId, time);
  },
  onSyncVideoTime(callback: (cameraId: number, time: number) => void): void {
    ipcRenderer.removeAllListeners("sync-video-time");
    ipcRenderer.on("sync-video-time", (_event: IpcRendererEvent, cameraId: number, time: number) => 
        callback(cameraId, time)
    );
  },
  submitTranslationTag(responseChannel: string, value: string | null): void {
    if (!responseChannel.startsWith("translation-tag-response-")) {
      return;
    }

    ipcRenderer.send(responseChannel, value);
  },
  searchBible(queryStr: string, translation: string): Promise<any> {
    return ipcRenderer.invoke("db-query-scripture", queryStr, translation);
  },
  navigateScripture(
    reference: string,
    translation: string,
    direction: ScriptureNavigationDirection,
  ): Promise<ScriptureRecord | null> {
    return ipcRenderer.invoke(
      "db-navigate-scripture",
      reference,
      translation,
      direction,
    );
  },
  analyzeAudioScripture(
    audioData: ArrayBuffer,
    mimeType: string,
  ): Promise<AudioScriptureAnalysis> {
    return ipcRenderer.invoke("analyze-audio-scripture", audioData, mimeType);
  },
  synthesizePolly(
    text: string,
    voiceId?: string,
    format?: string,
  ): Promise<any> {
    return ipcRenderer.invoke("synthesize-voice-polly", text, voiceId, format);
  },
  saveIntegrationSettings(
    settings: Record<string, string>,
  ): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("save-integration-settings", settings);
  },
  getIntegrationStatus(): Promise<{
    hasAwsCreds: boolean;
    awsRegion?: string | null;
    pollyVoiceId?: string | null;
    bibleDatabasePath?: string | null;
  }> {
    return ipcRenderer.invoke("get-integration-status");
  },
  deleteIntegrationSecrets(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke("delete-integration-secrets");
  },
  pickBackgroundImage(): Promise<{ canceled: boolean; path: string | null }> {
    return ipcRenderer.invoke("pick-background-image");
  },
  pickBibleDatabase(): Promise<{ canceled: boolean; path: string | null }> {
    return ipcRenderer.invoke("pick-bible-database");
  },
  triggerBibleImport(): Promise<BibleImportResponse> {
    return ipcRenderer.invoke("open-bible-picker");
  },

  deleteTranslation(
    translation: string,
  ): Promise<{ deletedCount: number; translations: string[] }> {
    return ipcRenderer.invoke("delete-translation", translation);
  },
  fetchAvailableTranslations(): Promise<string[]> {
    return ipcRenderer.invoke("get-translations");
  },
  fetchAvailableOutputs(): Promise<OutputTarget[]> {
    return ipcRenderer.invoke("get-output-targets");
  },
  resolveVoskModelUrl(): Promise<{ archivePath: string; url: string }> {
    return ipcRenderer.invoke("resolve-vosk-model-url");
  },
  fetchAppSettings(): Promise<Record<string, unknown>> {
    return ipcRenderer.invoke("get-app-settings");
  },
  saveAppSettings(
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return ipcRenderer.invoke("save-app-settings", settings);
  },
  exitOutputFullscreen(): void {
    ipcRenderer.send("exit-output-fullscreen");
  },
  importCanvasMedia(sourcePath: string): Promise<{ path: string }> {
    return ipcRenderer.invoke("import-canvas-media", sourcePath);
  },
  saveLyric(record: LyricRecord): Promise<void> {
    return ipcRenderer.invoke("save-lyric", record);
  },
  getLyrics(): Promise<LyricRecord[]> {
    return ipcRenderer.invoke("get-lyrics");
  },
  deleteLyric(id: string): Promise<void> {
    return ipcRenderer.invoke("delete-lyric", id);
  },
  saveSchedule(record: ScheduleRecord): Promise<void> {
    return ipcRenderer.invoke("save-schedule", record);
  },
  getSchedules(): Promise<ScheduleRecord[]> {
    return ipcRenderer.invoke("get-schedules");
  },
  deleteSchedule(id: string): Promise<void> {
    return ipcRenderer.invoke("delete-schedule", id);
  },
  exportScheduleFile(name: string, data: string): Promise<void> {
    return ipcRenderer.invoke("export-schedule-file", name, data);
  },
  importScheduleFile(): Promise<string | null> {
    return ipcRenderer.invoke("import-schedule-file");
  },
  getNetworkStreams(): Promise<any[]> {
    return ipcRenderer.invoke("get-network-streams");
  },
  refreshNetworkStreams(): Promise<any[]> {
    return ipcRenderer.invoke("refresh-network-streams");
  },
  deleteNetworkStream(sourceId: string): Promise<any[]> {
    return ipcRenderer.invoke("delete-network-stream", sourceId);
  },
  onNetworkStreamsUpdated(callback: (streams: any[]) => void): () => void {
    const listener = (_event: any, streams: any[]) => callback(streams);
    ipcRenderer.on("network-streams-updated", listener);
    return () => ipcRenderer.removeListener("network-streams-updated", listener);
  },
  onOmtVideoFrame(callback: (streamId: string, payload: Uint8Array) => void): () => void {
    const listener = (_event: any, streamId: string, payload: Uint8Array) => callback(streamId, payload);
    ipcRenderer.on("omt-video-frame", listener);
    return () => ipcRenderer.removeListener("omt-video-frame", listener);
  },
  onOmtAudioChunk(callback: (streamId: string, payload: Uint8Array) => void): () => void {
    const listener = (_event: any, streamId: string, payload: Uint8Array) => callback(streamId, payload);
    ipcRenderer.on("omt-audio-chunk", listener);
    return () => ipcRenderer.removeListener("omt-audio-chunk", listener);
  }
};

contextBridge.exposeInMainWorld("electron", electronApi);
