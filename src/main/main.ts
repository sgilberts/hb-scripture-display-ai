import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  protocol,
  screen,
  session,
  type BrowserWindowConstructorOptions,
  type Display,
  type IpcMainEvent,
  type OpenDialogOptions,
} from "electron";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import keytar from "keytar";
import {
  deleteTranslation,
  getInstalledTranslations,
  initializeDatabase,
  navigateScripture,
  navigateScriptureInPath,
  searchVerses,
  searchVersesInPath,
} from "./db";
import { processBibleImport } from "./importer";
import type {
  AudioScriptureAnalysis,
  BackgroundStyle,
  BackgroundTexture,
  LowerThirdStyle,
  OutputTarget,
  ScriptureNavigationDirection,
  ThemeDefinition,
  CameraInput,
  InputSetting,
  // @ts-ignore
} from "../shared/types";

const VOSK_MODEL_PROTOCOL = "hb-vosk";
const VOSK_MODEL_ARCHIVE = "vosk-model-small-en-us-0.15.tar.gz";
const VOSK_MODEL_ARCHIVES = new Set([VOSK_MODEL_ARCHIVE]);

protocol.registerSchemesAsPrivileged([
  {
    scheme: VOSK_MODEL_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function buildContentSecurityPolicy(isDev: boolean): string {
  const devConnectSources = isDev
    ? [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "ws://localhost:*",
        "ws://127.0.0.1:*",
      ]
    : [];

  const devAssetSources = isDev
    ? ["http://localhost:*", "http://127.0.0.1:*"]
    : [];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' https: file: data: blob: ${devAssetSources.join(" ")}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' hb-vosk: https: data: blob: ${devConnectSources.join(" ")}`.trim(),
    "media-src 'self' file: data: blob:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join("; ");
}

interface ProjectionUpdatePayload {
  currentTextOutput: string;
  currentReferenceOutput: string;
  displayFormat: "FULL" | "LOWER_THIRD";
  activeTheme: "IMAGE" | "GREEN_SCREEN" | "TRANSPARENT";
  isLiveMode: boolean;
  verseHoldFlag: boolean;
  isAutoDisplayMode: boolean;
  isScriptureParaphraseMode: boolean;
  currentBibleTranslation: string;
  selectedOutputIds: string[];
  selectedAudioDeviceId: string;
  outputFontFamily: string;
  outputFontSize: number;
  lowerThirdStyle: LowerThirdStyle;
  scriptureLowerThirdStyle: LowerThirdStyle;
  lyricsLowerThirdStyle: LowerThirdStyle;
  backgroundStyle: BackgroundStyle;
  backgroundTexture: BackgroundTexture;
  backgroundImagePath: string;
  backgroundPositionX: number;
  backgroundPositionY: number;
  textPositionX: number;
  textPositionY: number;
  customThemes: ThemeDefinition[];
  defaultThemeId_SCRIPTURES: string | null;
  defaultThemeId_LYRICS: string | null;
  defaultThemeId_TIMER: string | null;
  previewInputId: number | null;
  outputInputId: number | null;
  layerToCameraMap: Record<number, number>;
  cameraThemeMap: Record<number, string>;
  cameraMultiviews: Record<number, Record<number, number>>;
  cameraInputs: CameraInput[];
  inputSettings: Record<number, InputSetting>;
  videoPlaybackState?: Record<number, boolean>;
  outputRoutingMap?: Record<string, string | number>;
}

interface BibleImportResponse {
  success: boolean;
  count: number;
  translation?: string;
  canceled?: boolean;
  error?: string;
}

interface AppSettings {
  currentBibleTranslation: string;
  selectedOutputIds: string[];
  displayFormat: "FULL" | "LOWER_THIRD";
  activeTheme: "IMAGE" | "GREEN_SCREEN" | "TRANSPARENT";
  defaultOutputResolution: string;
  enableAlphaChannel: boolean;
  enableScreenMirrorOutput: boolean;
  isAutoDisplayMode: boolean;
  isScriptureParaphraseMode: boolean;
  outputOpacity: number;
  inputGain: number;
  selectedAudioDeviceId: string;
  forceAspectRatio: boolean;
  stripMetadataOnImport: boolean;
  autoCorrectEncoding: boolean;
  outputFontFamily: string;
  outputFontSize: number;
  lowerThirdStyle: LowerThirdStyle;
  scriptureLowerThirdStyle: LowerThirdStyle;
  lyricsLowerThirdStyle: LowerThirdStyle;
  backgroundStyle: BackgroundStyle;
  backgroundTexture: BackgroundTexture;
  backgroundImagePath: string;
  backgroundPositionX: number;
  backgroundPositionY: number;
  textPositionX: number;
  textPositionY: number;
  customThemes: ThemeDefinition[];
  defaultThemeId_SCRIPTURES: string | null;
  defaultThemeId_LYRICS: string | null;
  defaultThemeId_TIMER: string | null;
  outputRoutingMap?: Record<string, string | number>;
  // Optional stored API key for AI audio (Gemini). Stored securely in settings file.
  geminiApiKey?: string;
  // Non-secret integration settings (secrets are stored in OS keychain via keytar)
  awsRegion?: string;
  pollyVoiceId?: string;
  bibleDatabasePath?: string;
  // DeepSpeech model/scorer paths (optional)
  deepspeechModelPath?: string;
  deepspeechScorerPath?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function postJson<T>(
  url: string,
  payload: unknown,
): Promise<{ ok: boolean; statusCode: number; data: T }> {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(body.byteLength),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          try {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            const data = rawBody ? (JSON.parse(rawBody) as T) : ({} as T);

            resolve({
              ok:
                response.statusCode !== undefined &&
                response.statusCode >= 200 &&
                response.statusCode < 300,
              statusCode: response.statusCode ?? 0,
              data,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(12000, () => {
      request.destroy(new Error("Gemini audio analysis timed out."));
    });
    request.write(body);
    request.end();
  });
}

interface OutputWindowRecord {
  target: OutputTarget;
  display?: Display;
  window: BrowserWindow;
}

const DEFAULT_PROJECTION_STATE: ProjectionUpdatePayload = {
  currentTextOutput: "",
  currentReferenceOutput: "",
  displayFormat: "FULL",
  activeTheme: "IMAGE",
  isLiveMode: false,
  verseHoldFlag: false,
  isAutoDisplayMode: false,
  isScriptureParaphraseMode: false,
  currentBibleTranslation: "KJV",
  selectedOutputIds: [],
  selectedAudioDeviceId: "default",
  outputFontFamily: "Inter, system-ui, sans-serif",
  outputFontSize: 100,
  lowerThirdStyle: "CLASSIC",
  scriptureLowerThirdStyle: "CLASSIC",
  lyricsLowerThirdStyle: "BANNER",
  backgroundStyle: "IMAGE",
  backgroundTexture: "NONE",
  backgroundImagePath: "",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  textPositionX: 50,
  textPositionY: 50,
  customThemes: [],
  defaultThemeId_SCRIPTURES: null,
  defaultThemeId_LYRICS: null,
  defaultThemeId_TIMER: null,
  previewInputId: null,
  outputInputId: null,
  layerToCameraMap: {},
  cameraThemeMap: {},
  cameraMultiviews: {},
  cameraInputs: [],
  inputSettings: {},
  videoPlaybackState: {},
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  currentBibleTranslation: "KJV",
  selectedOutputIds: [],
  displayFormat: "FULL",
  activeTheme: "IMAGE",
  defaultOutputResolution: "1920x1080 (16:9)",
  enableAlphaChannel: false,
  enableScreenMirrorOutput: false,
  isAutoDisplayMode: false,
  isScriptureParaphraseMode: false,
  outputOpacity: 100,
  inputGain: 100,
  selectedAudioDeviceId: "default",
  forceAspectRatio: true,
  stripMetadataOnImport: true,
  autoCorrectEncoding: true,
  outputFontFamily: "Inter, system-ui, sans-serif",
  outputFontSize: 100,
  lowerThirdStyle: "CLASSIC",
  scriptureLowerThirdStyle: "CLASSIC",
  lyricsLowerThirdStyle: "BANNER",
  backgroundStyle: "IMAGE",
  backgroundTexture: "NONE",
  backgroundImagePath: "",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  textPositionX: 50,
  textPositionY: 50,
  customThemes: [],
  defaultThemeId_SCRIPTURES: null,
  defaultThemeId_LYRICS: null,
  defaultThemeId_TIMER: null,
  outputRoutingMap: {},
  // Stored Gemini/Google API key (optional)
  geminiApiKey: "",
  // Default AWS region and Polly voice
  awsRegion: "us-east-1",
  pollyVoiceId: "Joanna",
  // Optional external bible database path
  bibleDatabasePath: "",
};

let mainWindow: BrowserWindow | null = null;
let latestProjectionState: ProjectionUpdatePayload = DEFAULT_PROJECTION_STATE;
let cachedSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };
const outputWindows = new Map<string, OutputWindowRecord>();
let escapeShortcutRegistered = false;

// DeepSpeech model instance (loaded lazily). Paths are persisted in cachedSettings.
// Model typically expects 16kHz, mono, 16-bit PCM audio.
let deepspeechModel: any = null;
let deepspeechSampleRate = 16000;
const handleProjectionUpdateEvent = (
  event: IpcMainEvent,
  payload: Partial<ProjectionUpdatePayload>,
): void => {
  void handleProjectionUpdate(event, payload);
};

function normalizeTranslationTag(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeOutputIds(outputIds: unknown): string[] {
  if (!Array.isArray(outputIds)) {
    return [];
  }

  return Array.from(
    new Set(
      outputIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeLowerThirdStyle(value: unknown): LowerThirdStyle {
  return value === "BANNER" ||
    value === "MINIMAL" ||
    value === "CUSTOM" ||
    value === "CLASSIC"
    ? value
    : "CLASSIC";
}

function normalizeBackgroundStyle(value: unknown): BackgroundStyle {
  return value === "SOLID" ||
    value === "GRADIENT" ||
    value === "IMAGE" ||
    value === "COMPOSITE"
    ? value
    : "IMAGE";
}

function normalizeBackgroundTexture(value: unknown): BackgroundTexture {
  return value === "GRAIN" || value === "DOT_GRID" || value === "SOFT_NOISE"
    ? value
    : "NONE";
}

function clampPosition(value: unknown, fallback = 50): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}

function getDefaultSelectedOutputIds(outputs: OutputTarget[]): string[] {
  const primaryDisplayId =
    outputs.find((output) => output.label.startsWith("Screen Mirror / Primary"))
      ?.id ?? outputs.find((output) => output.kind === "DISPLAY")?.id;
  const selected = outputs
    .filter(
      (output) => output.kind === "DISPLAY" && output.id !== primaryDisplayId,
    )
    .map((output) => output.id);

  if (!selected.includes("ndi:virtual")) {
    selected.push("ndi:virtual");
  }

  if (
    cachedSettings.enableScreenMirrorOutput &&
    primaryDisplayId &&
    !selected.includes(primaryDisplayId)
  ) {
    selected.unshift(primaryDisplayId);
  }

  return selected;
}

function mergeOutputSelection(
  outputs: OutputTarget[],
  selectedOutputIds: string[],
): OutputTarget[] {
  const selection = new Set(
    selectedOutputIds.length > 0
      ? selectedOutputIds
      : getDefaultSelectedOutputIds(outputs),
  );
  const primaryDisplayId = outputs.find((output) =>
    output.label.startsWith("Screen Mirror / Primary"),
  )?.id;

  if (cachedSettings.enableScreenMirrorOutput && primaryDisplayId) {
    selection.add(primaryDisplayId);
  }

  if (!cachedSettings.enableScreenMirrorOutput && primaryDisplayId) {
    selection.delete(primaryDisplayId);
  }

  return outputs.map((output) => ({
    ...output,
    selected: selection.has(output.id),
  }));
}

async function getSettingsPath(): Promise<string> {
  await app.whenReady();

  const userDataDirectory = app.getPath("userData");
  await mkdir(userDataDirectory, { recursive: true });

  return path.join(userDataDirectory, "hallelujahbeamer-settings.json");
}

async function getBackgroundAssetsDirectory(): Promise<string> {
  await app.whenReady();

  const assetsDirectory = path.join(
    app.getPath("userData"),
    "background-assets",
  );
  await mkdir(assetsDirectory, { recursive: true });
  return assetsDirectory;
}

async function importBackgroundImage(sourcePath: string): Promise<string> {
  const assetsDirectory = await getBackgroundAssetsDirectory();
  const fileName = `${Date.now()}-${path.basename(sourcePath)}`;
  const destinationPath = path.join(assetsDirectory, fileName);
  await copyFile(sourcePath, destinationPath);
  return destinationPath;
}

async function importCanvasMedia(sourcePath: string): Promise<string> {
  const assetsDirectory = await getBackgroundAssetsDirectory();
  const fileName = `canvas-${Date.now()}-${path.basename(sourcePath)}`;
  const destinationPath = path.join(assetsDirectory, fileName);
  await copyFile(sourcePath, destinationPath);
  return destinationPath;
}

async function loadSettings(): Promise<AppSettings> {
  const settingsPath = await getSettingsPath();

  try {
    const rawSettings = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(rawSettings) as Partial<AppSettings>;

    return {
      ...DEFAULT_APP_SETTINGS,
      currentBibleTranslation:
        normalizeTranslationTag(
          parsed.currentBibleTranslation ??
            DEFAULT_APP_SETTINGS.currentBibleTranslation,
        ) || DEFAULT_APP_SETTINGS.currentBibleTranslation,
      selectedOutputIds: normalizeOutputIds(parsed.selectedOutputIds),
      displayFormat:
        parsed.displayFormat === "LOWER_THIRD" ? "LOWER_THIRD" : "FULL",
      activeTheme:
        parsed.activeTheme === "GREEN_SCREEN" ||
        parsed.activeTheme === "TRANSPARENT"
          ? parsed.activeTheme
          : "IMAGE",
      defaultOutputResolution:
        parsed.defaultOutputResolution ??
        DEFAULT_APP_SETTINGS.defaultOutputResolution,
      enableAlphaChannel:
        parsed.enableAlphaChannel ?? DEFAULT_APP_SETTINGS.enableAlphaChannel,
      enableScreenMirrorOutput:
        parsed.enableScreenMirrorOutput ??
        DEFAULT_APP_SETTINGS.enableScreenMirrorOutput,
      isAutoDisplayMode:
        parsed.isAutoDisplayMode ?? DEFAULT_APP_SETTINGS.isAutoDisplayMode,
      isScriptureParaphraseMode:
        parsed.isScriptureParaphraseMode ??
        DEFAULT_APP_SETTINGS.isScriptureParaphraseMode,
      outputOpacity:
        typeof parsed.outputOpacity === "number"
          ? Math.max(0, Math.min(100, parsed.outputOpacity))
          : DEFAULT_APP_SETTINGS.outputOpacity,
      inputGain:
        typeof parsed.inputGain === "number"
          ? Math.max(0, Math.min(200, parsed.inputGain))
          : DEFAULT_APP_SETTINGS.inputGain,
      selectedAudioDeviceId:
        typeof parsed.selectedAudioDeviceId === "string" &&
        parsed.selectedAudioDeviceId.trim()
          ? parsed.selectedAudioDeviceId
          : DEFAULT_APP_SETTINGS.selectedAudioDeviceId,
      geminiApiKey:
        typeof parsed.geminiApiKey === "string" && parsed.geminiApiKey.trim()
          ? parsed.geminiApiKey.trim()
          : DEFAULT_APP_SETTINGS.geminiApiKey,
      awsRegion:
        typeof parsed.awsRegion === "string" && parsed.awsRegion.trim()
          ? parsed.awsRegion.trim()
          : DEFAULT_APP_SETTINGS.awsRegion,
      pollyVoiceId:
        typeof parsed.pollyVoiceId === "string" && parsed.pollyVoiceId.trim()
          ? parsed.pollyVoiceId.trim()
          : DEFAULT_APP_SETTINGS.pollyVoiceId,
      bibleDatabasePath:
        typeof parsed.bibleDatabasePath === "string"
          ? parsed.bibleDatabasePath
          : "",
      forceAspectRatio:
        parsed.forceAspectRatio ?? DEFAULT_APP_SETTINGS.forceAspectRatio,
      stripMetadataOnImport:
        parsed.stripMetadataOnImport ??
        DEFAULT_APP_SETTINGS.stripMetadataOnImport,
      autoCorrectEncoding:
        parsed.autoCorrectEncoding ?? DEFAULT_APP_SETTINGS.autoCorrectEncoding,
      outputFontFamily:
        typeof parsed.outputFontFamily === "string" &&
        parsed.outputFontFamily.trim()
          ? parsed.outputFontFamily
          : DEFAULT_APP_SETTINGS.outputFontFamily,
      outputFontSize:
        typeof parsed.outputFontSize === "number"
          ? Math.max(60, Math.min(160, parsed.outputFontSize))
          : DEFAULT_APP_SETTINGS.outputFontSize,
      lowerThirdStyle: normalizeLowerThirdStyle(parsed.lowerThirdStyle),
      scriptureLowerThirdStyle: normalizeLowerThirdStyle(
        parsed.scriptureLowerThirdStyle ?? parsed.lowerThirdStyle,
      ),
      lyricsLowerThirdStyle: normalizeLowerThirdStyle(
        parsed.lyricsLowerThirdStyle ?? parsed.lowerThirdStyle,
      ),
      backgroundStyle: normalizeBackgroundStyle(parsed.backgroundStyle),
      backgroundTexture: normalizeBackgroundTexture(parsed.backgroundTexture),
      backgroundImagePath:
        typeof parsed.backgroundImagePath === "string"
          ? parsed.backgroundImagePath
          : "",
      backgroundPositionX: clampPosition(parsed.backgroundPositionX),
      backgroundPositionY: clampPosition(parsed.backgroundPositionY),
      textPositionX: clampPosition(parsed.textPositionX),
      textPositionY: clampPosition(parsed.textPositionY),
      customThemes: Array.isArray(parsed.customThemes) ? parsed.customThemes : [],
      defaultThemeId_SCRIPTURES: parsed.defaultThemeId_SCRIPTURES || null,
      defaultThemeId_LYRICS: parsed.defaultThemeId_LYRICS || null,
      defaultThemeId_TIMER: parsed.defaultThemeId_TIMER || null,
      outputRoutingMap: parsed.outputRoutingMap || {},
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

async function saveSettings(nextSettings: Partial<AppSettings>): Promise<void> {
  const settingsPath = await getSettingsPath();
  console.log("Saving settings to:", settingsPath, "with:", nextSettings);
  const merged: AppSettings = {
    ...cachedSettings,
    currentBibleTranslation:
      normalizeTranslationTag(
        nextSettings.currentBibleTranslation ??
          cachedSettings.currentBibleTranslation,
      ) || cachedSettings.currentBibleTranslation,
    selectedOutputIds: normalizeOutputIds(
      nextSettings.selectedOutputIds ?? cachedSettings.selectedOutputIds,
    ),
    displayFormat: nextSettings.displayFormat ?? cachedSettings.displayFormat,
    activeTheme: nextSettings.activeTheme ?? cachedSettings.activeTheme,
    defaultOutputResolution:
      nextSettings.defaultOutputResolution ??
      cachedSettings.defaultOutputResolution,
    enableAlphaChannel:
      nextSettings.enableAlphaChannel ?? cachedSettings.enableAlphaChannel,
    enableScreenMirrorOutput:
      nextSettings.enableScreenMirrorOutput ??
      cachedSettings.enableScreenMirrorOutput,
    isAutoDisplayMode:
      nextSettings.isAutoDisplayMode ?? cachedSettings.isAutoDisplayMode,
    isScriptureParaphraseMode:
      nextSettings.isScriptureParaphraseMode ??
      cachedSettings.isScriptureParaphraseMode,
    outputOpacity:
      typeof nextSettings.outputOpacity === "number"
        ? Math.max(0, Math.min(100, nextSettings.outputOpacity))
        : cachedSettings.outputOpacity,
    inputGain:
      typeof nextSettings.inputGain === "number"
        ? Math.max(0, Math.min(200, nextSettings.inputGain))
        : cachedSettings.inputGain,
    selectedAudioDeviceId:
      typeof nextSettings.selectedAudioDeviceId === "string" &&
      nextSettings.selectedAudioDeviceId.trim()
        ? nextSettings.selectedAudioDeviceId
        : cachedSettings.selectedAudioDeviceId,
    geminiApiKey:
      typeof nextSettings.geminiApiKey === "string" &&
      nextSettings.geminiApiKey.trim()
        ? nextSettings.geminiApiKey
        : cachedSettings.geminiApiKey,
    awsRegion:
      typeof nextSettings.awsRegion === "string" &&
      nextSettings.awsRegion.trim()
        ? nextSettings.awsRegion
        : cachedSettings.awsRegion,
    pollyVoiceId:
      typeof nextSettings.pollyVoiceId === "string" &&
      nextSettings.pollyVoiceId.trim()
        ? nextSettings.pollyVoiceId
        : cachedSettings.pollyVoiceId,
    bibleDatabasePath:
      typeof nextSettings.bibleDatabasePath === "string"
        ? nextSettings.bibleDatabasePath
        : cachedSettings.bibleDatabasePath,
    forceAspectRatio:
      nextSettings.forceAspectRatio ?? cachedSettings.forceAspectRatio,
    stripMetadataOnImport:
      nextSettings.stripMetadataOnImport ??
      cachedSettings.stripMetadataOnImport,
    autoCorrectEncoding:
      nextSettings.autoCorrectEncoding ?? cachedSettings.autoCorrectEncoding,
    outputFontFamily:
      typeof nextSettings.outputFontFamily === "string" &&
      nextSettings.outputFontFamily.trim()
        ? nextSettings.outputFontFamily
        : cachedSettings.outputFontFamily,
    outputFontSize:
      typeof nextSettings.outputFontSize === "number"
        ? Math.max(60, Math.min(160, nextSettings.outputFontSize))
        : cachedSettings.outputFontSize,
    lowerThirdStyle: normalizeLowerThirdStyle(
      nextSettings.lowerThirdStyle ?? cachedSettings.lowerThirdStyle,
    ),
    scriptureLowerThirdStyle: normalizeLowerThirdStyle(
      nextSettings.scriptureLowerThirdStyle ??
        cachedSettings.scriptureLowerThirdStyle,
    ),
    lyricsLowerThirdStyle: normalizeLowerThirdStyle(
      nextSettings.lyricsLowerThirdStyle ??
        cachedSettings.lyricsLowerThirdStyle,
    ),
    backgroundStyle: normalizeBackgroundStyle(
      nextSettings.backgroundStyle ?? cachedSettings.backgroundStyle,
    ),
    backgroundTexture: normalizeBackgroundTexture(
      nextSettings.backgroundTexture ?? cachedSettings.backgroundTexture,
    ),
    backgroundImagePath:
      typeof nextSettings.backgroundImagePath === "string"
        ? nextSettings.backgroundImagePath
        : cachedSettings.backgroundImagePath,
    backgroundPositionX: clampPosition(
      nextSettings.backgroundPositionX ?? cachedSettings.backgroundPositionX,
      cachedSettings.backgroundPositionX,
    ),
    backgroundPositionY: clampPosition(
      nextSettings.backgroundPositionY ?? cachedSettings.backgroundPositionY,
      cachedSettings.backgroundPositionY,
    ),
    textPositionX: clampPosition(
      nextSettings.textPositionX ?? cachedSettings.textPositionX,
      cachedSettings.textPositionX,
    ),
    textPositionY: clampPosition(
      nextSettings.textPositionY ?? cachedSettings.textPositionY,
      cachedSettings.textPositionY,
    ),
    customThemes: nextSettings.customThemes ?? cachedSettings.customThemes,
    defaultThemeId_SCRIPTURES: nextSettings.defaultThemeId_SCRIPTURES ?? cachedSettings.defaultThemeId_SCRIPTURES,
    defaultThemeId_LYRICS: nextSettings.defaultThemeId_LYRICS ?? cachedSettings.defaultThemeId_LYRICS,
    defaultThemeId_TIMER: nextSettings.defaultThemeId_TIMER ?? cachedSettings.defaultThemeId_TIMER,
    outputRoutingMap: nextSettings.outputRoutingMap ?? cachedSettings.outputRoutingMap,
  };

  cachedSettings = merged;

  await writeFile(settingsPath, JSON.stringify(merged, null, 2), "utf8");
}

function getRendererEntryUrl(): string | null {
  return process.env.VITE_DEV_SERVER_URL ?? null;
}

function getRendererEntryPath(): string {
  return path.join(__dirname, "../renderer/index.html");
}

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getVoskModelArchivePath(fileName = VOSK_MODEL_ARCHIVE): string {
  if (!app.isPackaged && process.env.NODE_ENV !== "production") {
    return path.join(__dirname, "../renderer/public/vosk-models", fileName);
  }
  return path.join(__dirname, "../renderer/vosk-models", fileName);
}

function getVoskModelUrl(fileName = VOSK_MODEL_ARCHIVE): string {
  return `${VOSK_MODEL_PROTOCOL}://models/${encodeURIComponent(fileName)}`;
}

function getVoskModelFileName(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const fileName = path.basename(decodeURIComponent(url.pathname));

  if (!VOSK_MODEL_ARCHIVES.has(fileName)) {
    return null;
  }

  return fileName;
}

async function registerVoskModelProtocol(): Promise<void> {
  protocol.handle(VOSK_MODEL_PROTOCOL, async (request) => {
    const fileName = getVoskModelFileName(request.url);

    if (!fileName) {
      console.warn(
        "VOSK model protocol: Rejected unknown model URL:",
        request.url,
      );
      return new Response("Unknown VOSK model", { status: 404 });
    }

    const archivePath = getVoskModelArchivePath(fileName);
    console.log("VOSK model protocol: Fetch URL:", request.url);
    console.log("VOSK model protocol: Resolved model path:", archivePath);

    try {
      const archive = await readFile(archivePath);
      const headers = new Headers({
        "content-type": "application/gzip",
        "content-length": String(archive.byteLength),
        "cache-control": "no-cache",
      });

      console.log(
        "VOSK model protocol: Fetch success:",
        fileName,
        `${archive.byteLength} bytes`,
      );

      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }

      return new Response(archive, { status: 200, headers });
    } catch (error) {
      console.error(
        "VOSK model protocol: Fetch failure:",
        archivePath,
        error,
      );
      return new Response("VOSK model archive not found", { status: 404 });
    }
  });
}

function deriveSuggestedTranslation(filePath: string): string {
  const baseName = path.basename(filePath, path.extname(filePath));
  const normalized = normalizeTranslationTag(baseName).replace(
    /[^A-Z0-9]/g,
    "",
  );

  if (normalized.length >= 3) {
    return normalized.slice(0, 4);
  }

  return "KJV";
}

function getGeminiApiKey(): string | null {
  // Prefer configured key from stored settings, then environment variables.
  try {
    if (
      cachedSettings &&
      typeof cachedSettings.geminiApiKey === "string" &&
      cachedSettings.geminiApiKey.trim()
    ) {
      return cachedSettings.geminiApiKey.trim();
    }
  } catch {
    // ignore
  }

  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    null
  );
}

// Key management helpers using OS keychain via keytar
async function getSecret(name: string): Promise<string | null> {
  try {
    return await keytar.getPassword("hallelujahbeamer", name);
  } catch (err) {
    console.warn("Keytar getPassword error:", err);
    return null;
  }
}

async function setSecret(name: string, value: string): Promise<boolean> {
  try {
    await keytar.setPassword("hallelujahbeamer", name, value);
    return true;
  } catch (err) {
    console.warn("Keytar setPassword error:", err);
    return false;
  }
}

async function deleteSecret(name: string): Promise<boolean> {
  try {
    return await keytar.deletePassword("hallelujahbeamer", name);
  } catch (err) {
    console.warn("Keytar deletePassword error:", err);
    return false;
  }
}

async function ensureDeepSpeechModelLoaded(): Promise<boolean> {
  if (deepspeechModel) return true;
  try {
    const modelPath = (cachedSettings as any).deepspeechModelPath;
    if (!modelPath) return false;
    // Lazy-load DeepSpeech native module if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DS = require("deepspeech");
    deepspeechModel = new DS.Model(modelPath);
    if ((cachedSettings as any).deepspeechScorerPath) {
      try {
        deepspeechModel.enableExternalScorer(
          (cachedSettings as any).deepspeechScorerPath,
        );
      } catch (err) {
        console.warn("Failed to enable DeepSpeech scorer:", err);
      }
    }
    // Most DeepSpeech models target 16kHz audio
    deepspeechSampleRate =
      typeof deepspeechModel.sampleRate === "function"
        ? deepspeechModel.sampleRate()
        : 16000;
    return true;
  } catch (err) {
    console.warn("DeepSpeech model load failed:", err);
    deepspeechModel = null;
    return false;
  }
}

async function transcribeAudioWithDeepSpeech(
  audioData: ArrayBuffer | Buffer,
  sampleRate: number,
): Promise<{ transcript?: string; error?: string }> {
  return { error: "DeepSpeech functionality is disabled." };
}

async function getAwsCredentials(): Promise<{
  accessKeyId: string | null;
  secretAccessKey: string | null;
}> {
  const accessKeyIdSecret = await getSecret("awsAccessKeyId");
  const secretAccessKeySecret = await getSecret("awsSecretAccessKey");

  const accessKeyId =
    accessKeyIdSecret ||
    (typeof (cachedSettings as any).awsAccessKeyId === "string" &&
    (cachedSettings as any).awsAccessKeyId.trim()
      ? (cachedSettings as any).awsAccessKeyId
      : process.env.AWS_ACCESS_KEY_ID) ||
    null;

  const secretAccessKey =
    secretAccessKeySecret ||
    (typeof (cachedSettings as any).awsSecretAccessKey === "string" &&
    (cachedSettings as any).awsSecretAccessKey.trim()
      ? (cachedSettings as any).awsSecretAccessKey
      : process.env.AWS_SECRET_ACCESS_KEY) ||
    null;

  return { accessKeyId, secretAccessKey };
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
}

function normalizeGeminiAnalysis(
  responseText: string,
  aiEnabled: boolean,
): AudioScriptureAnalysis {
  const jsonText = extractFirstJsonObject(responseText);

  if (!jsonText) {
    return {
      transcript: responseText.trim(),
      searchQuery: responseText.trim(),
      aiEnabled,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<AudioScriptureAnalysis>;
    const transcript =
      typeof parsed.transcript === "string" ? parsed.transcript.trim() : "";
    const scriptureReference =
      typeof parsed.scriptureReference === "string"
        ? parsed.scriptureReference.trim()
        : undefined;
    const searchQuery =
      typeof parsed.searchQuery === "string"
        ? parsed.searchQuery.trim()
        : undefined;

    return {
      transcript,
      scriptureReference: scriptureReference || undefined,
      searchQuery: searchQuery || scriptureReference || transcript,
      aiEnabled,
    };
  } catch {
    return {
      transcript: responseText.trim(),
      searchQuery: responseText.trim(),
      aiEnabled,
    };
  }
}

async function analyzeAudioScripture(
  audioData: ArrayBuffer,
  mimeType: string,
): Promise<AudioScriptureAnalysis> {
  return {
    transcript: "",
    aiEnabled: false,
    error: "Gemini analysis is disabled.",
  };
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

// Synthesize text to speech using Amazon Polly (returns base64-encoded audio)
async function synthesizeVoicePolly(
  text: string,
  voiceId = "Joanna",
  format: string = "mp3",
): Promise<{ audioBase64?: string; error?: string }> {
  const { accessKeyId, secretAccessKey } = await getAwsCredentials();
  const region =
    cachedSettings.awsRegion || process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    return { error: "AWS credentials are not configured." };
  }

  try {
    const { PollyClient, SynthesizeSpeechCommand } =
      await import("@aws-sdk/client-polly");
    const polly = new PollyClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    } as any);

    const outputFormat = (format || "mp3").toUpperCase();

    const command = new SynthesizeSpeechCommand({
      OutputFormat: outputFormat as any,
      Text: text,
      VoiceId: voiceId as any,
      TextType: "text",
    });

    const result = await polly.send(command as any);
    const audioStream = (result as any).AudioStream as any;
    const buffer = await streamToBuffer(audioStream);

    return { audioBase64: buffer.toString("base64") };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function buildTranslationPromptMarkup(
  responseChannel: string,
  suggestedTag: string,
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Install Bible Translation</title>
        <style>
          :root {
            color-scheme: dark;
            font-family: Inter, "Segoe UI", sans-serif;
          }

          body {
            margin: 0;
            background: #131316;
            color: #e4e1e6;
          }

          .shell {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }

          .panel {
            width: 100%;
            max-width: 360px;
            border: 1px solid #3c4a42;
            background: #1f1f22;
            padding: 18px;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 18px;
            letter-spacing: -0.02em;
          }

          p {
            margin: 0 0 16px;
            color: #bbcabf;
            font-size: 13px;
            line-height: 1.5;
          }

          label {
            display: block;
            margin-bottom: 8px;
            font-family: "JetBrains Mono", monospace;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #bbcabf;
          }

          input {
            width: 100%;
            box-sizing: border-box;
            height: 42px;
            border: 1px solid #3c4a42;
            background: #131316;
            color: #e4e1e6;
            padding: 0 12px;
            font-size: 14px;
          }

          .actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
          }

          button {
            border: 1px solid #3c4a42;
            padding: 10px 14px;
            background: #131316;
            color: #e4e1e6;
            font-family: "JetBrains Mono", monospace;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            cursor: pointer;
          }

          .primary {
            border-color: #10b981;
            background: #10b981;
            color: #002113;
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <form class="panel" id="translation-form">
            <h1>Install Bible Translation</h1>
            <p>Enter a 3 to 4 letter translation tag so HallelujahBeamer can label this import cleanly.</p>
            <label for="translation-tag">Translation Tag</label>
            <input id="translation-tag" maxlength="6" value="${suggestedTag}" autofocus />
            <div class="actions">
              <button type="button" id="cancel-button">Cancel</button>
              <button type="submit" class="primary">Import</button>
            </div>
          </form>
        </div>
        <script>
          const form = document.getElementById("translation-form");
          const input = document.getElementById("translation-tag");
          const cancelButton = document.getElementById("cancel-button");

          function sendValue(value) {
            window.electron.submitTranslationTag("${responseChannel}", value);
          }

          form.addEventListener("submit", (event) => {
            event.preventDefault();
            sendValue(input.value);
          });

          cancelButton.addEventListener("click", () => {
            sendValue(null);
          });

          input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              sendValue(null);
            }
          });
        </script>
      </body>
    </html>
  `;
}

function promptForTranslationTag(
  parentWindow: BrowserWindow | null,
  suggestedTag: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const responseChannel = `translation-tag-response-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const promptWindow = new BrowserWindow({
      width: 420,
      height: 250,
      parent: parentWindow ?? undefined,
      modal: Boolean(parentWindow),
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      show: false,
      backgroundColor: "#131316",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: getPreloadPath(),
      },
    });

    let settled = false;

    const cleanup = (): void => {
      ipcMain.removeAllListeners(responseChannel);
    };

    ipcMain.on(responseChannel, (_event, value: string | null) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value ? normalizeTranslationTag(value) : null);

      if (!promptWindow.isDestroyed()) {
        promptWindow.close();
      }
    });

    promptWindow.on("closed", () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(null);
    });

    promptWindow.once("ready-to-show", () => {
      promptWindow.show();
    });

    void promptWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        buildTranslationPromptMarkup(responseChannel, suggestedTag),
      )}`,
    );
  });
}

async function loadRenderer(
  window: BrowserWindow,
  role: "main" | "output",
  outputId?: string,
): Promise<void> {
  const devServerUrl = getRendererEntryUrl();

  if (devServerUrl) {
    const url = new URL(devServerUrl);
    url.searchParams.set("window", role);
    if (outputId) url.searchParams.set("outputId", outputId);
    await window.loadURL(url.toString());
    return;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("window", role);
  if (outputId) searchParams.set("outputId", outputId);

  await window.loadFile(getRendererEntryPath(), {
    search: `?${searchParams.toString()}`,
  });
}

function getOperatorDisplay(displays: Display[]): Display {
  return displays[0] ?? screen.getPrimaryDisplay();
}

function getProjectionDisplay(displays: Display[]): Display | null {
  return (
    displays.find((display, index) => {
      if (index === 0) {
        return false;
      }

      const { x, y } = display.bounds;
      return x !== 0 || y !== 0;
    }) ?? null
  );
}

function createMainWindow(operatorDisplay: Display): BrowserWindow {
  const { x, y, width, height } = operatorDisplay.bounds;

  const options: BrowserWindowConstructorOptions = {
    x,
    y,
    width: Math.max(1280, Math.min(width, 1440)),
    height: Math.max(800, Math.min(height, 900)),
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: "#00000000",
    transparent: true,
    title: "HallelujahBeamer",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: getPreloadPath(),
      backgroundThrottling: false,
    },
  };

  const window = new BrowserWindow(options);

  void loadRenderer(window, "main");
  // window.webContents.openDevTools();

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

function getAvailableOutputs(): OutputTarget[] {
  const displays = screen.getAllDisplays();
  const primaryDisplayId = screen.getPrimaryDisplay().id;
  const displayOutputs: OutputTarget[] = displays.map((display, index) => ({
    id: `display:${display.id}`,
    label:
      display.id === primaryDisplayId
        ? `Screen Mirror / Primary • ${display.bounds.width}x${display.bounds.height}`
        : `Display ${index + 1} • ${display.bounds.width}x${display.bounds.height}`,
    kind: "DISPLAY",
    selected: false,
  }));

  displayOutputs.push({
    id: "ndi:virtual",
    label: "NDI (virtual mirror)",
    kind: "NDI",
    selected: false,
  });

  displayOutputs.push({
    id: "hdmi:external",
    label: "HDMI output route",
    kind: "HDMI",
    selected: false,
  });

  displayOutputs.push({
    id: "usb-c:external",
    label: "USB Type-C output route",
    kind: "USB_C",
    selected: false,
  });

  return mergeOutputSelection(displayOutputs, cachedSettings.selectedOutputIds);
}

function getDisplayForOutputId(outputId: string): Display | null {
  if (!outputId.startsWith("display:")) {
    return null;
  }

  const displayId = Number.parseInt(outputId.slice("display:".length), 10);
  if (Number.isNaN(displayId)) {
    return null;
  }

  return (
    screen.getAllDisplays().find((display) => display.id === displayId) ?? null
  );
}

function exitOutputFullscreen(): void {
  for (const record of outputWindows.values()) {
    if (record.window.isDestroyed() || record.target.kind !== "DISPLAY") {
      continue;
    }

    if (record.window.isFullScreen()) {
      record.window.setFullScreen(false);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function syncEscapeShortcutState(): void {
  const shouldRegister =
    latestProjectionState.isLiveMode &&
    Array.from(outputWindows.values()).some(
      (record) =>
        !record.window.isDestroyed() && record.target.kind === "DISPLAY",
    );

  if (shouldRegister && !escapeShortcutRegistered) {
    escapeShortcutRegistered = globalShortcut.register("Escape", () => {
      exitOutputFullscreen();
    });
    return;
  }

  if (!shouldRegister && escapeShortcutRegistered) {
    globalShortcut.unregister("Escape");
    escapeShortcutRegistered = false;
  }
}

function createOutputWindow(
  target: OutputTarget,
  display?: Display,
): BrowserWindow {
  const bounds = display?.bounds ?? screen.getPrimaryDisplay().bounds;
  const isVirtualNdi = target.kind === "NDI";
  const isPrimaryDisplay = Boolean(
    display && display.id === screen.getPrimaryDisplay().id,
  );
  const window = new BrowserWindow({
    type: "panel",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    fullscreen: !isVirtualNdi,
    transparent: cachedSettings.enableAlphaChannel || isVirtualNdi,
    alwaysOnTop: !isPrimaryDisplay,
    skipTaskbar: true,
    backgroundColor:
      cachedSettings.enableAlphaChannel || isVirtualNdi
        ? "#00000000"
        : "#000000",
    focusable: false,
    autoHideMenuBar: true,
    title: target.label,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: getPreloadPath(),
      backgroundThrottling: false,
    },
  });

  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (!isPrimaryDisplay) {
    window.setAlwaysOnTop(true, "screen-saver");
  }
  window.setOpacity(
    Math.max(0.05, Math.min(1, cachedSettings.outputOpacity / 100)),
  );
  if (cachedSettings.forceAspectRatio && !isVirtualNdi) {
    window.setAspectRatio(16 / 9);
  }

  // Prevent projection from being minimized
  // @ts-ignore - TS complains about "minimize" not being a valid event overload
  window.on("minimize", (e: any) => {
    e.preventDefault();
    if (window.isMinimized()) {
      window.restore();
    }
  });

  window.webContents.once("did-finish-load", () => {
    window.webContents.send("render-text", latestProjectionState);
  });

  void loadRenderer(window, "output", target.id);

  window.on("closed", () => {
    const record = outputWindows.get(target.id);
    if (record && record.window === window) {
      outputWindows.delete(target.id);
    }
  });

  return window;
}

function closeAllOutputWindows(): void {
  for (const [, record] of outputWindows) {
    if (!record.window.isDestroyed()) {
      record.window.close();
    }
  }

  outputWindows.clear();
}

function applyOutputWindowSettings(): void {
  for (const record of outputWindows.values()) {
    if (record.window.isDestroyed()) {
      continue;
    }

    record.window.setOpacity(
      Math.max(0.05, Math.min(1, cachedSettings.outputOpacity / 100)),
    );

    if (cachedSettings.forceAspectRatio && record.target.kind !== "NDI") {
      record.window.setAspectRatio(16 / 9);
    }
  }
}

function syncOutputWindows(): void {
  const availableOutputs = getAvailableOutputs();

  const selectedOutputs = availableOutputs.filter((output) => output.selected);
  const windowedOutputs = selectedOutputs.filter(
    (output) => output.kind === "DISPLAY" || output.kind === "NDI",
  );
  
  const shouldBeOpenIds = new Set(
    latestProjectionState.isLiveMode
      ? windowedOutputs.map((output) => output.id)
      : [],
  );

  for (const [outputId, record] of outputWindows.entries()) {
    if (!shouldBeOpenIds.has(outputId)) {
      if (!record.window.isDestroyed()) {
        record.window.close();
      }
      outputWindows.delete(outputId);
    }
  }

  if (!latestProjectionState.isLiveMode && shouldBeOpenIds.size === 0) {
    syncEscapeShortcutState();
    return;
  }

  for (const output of windowedOutputs) {
    if (!shouldBeOpenIds.has(output.id)) {
      continue;
    }

    const existingRecord = outputWindows.get(output.id);

    if (existingRecord && !existingRecord.window.isDestroyed()) {
      if (output.kind === "DISPLAY" && existingRecord.display) {
        existingRecord.window.setBounds(existingRecord.display.bounds);
      }
      existingRecord.window.webContents.send(
        "render-text",
        latestProjectionState,
      );
      continue;
    }

    const display = getDisplayForOutputId(output.id) ?? undefined;
    const window = createOutputWindow(output, display);
    outputWindows.set(output.id, {
      target: output,
      display,
      window,
    });
  }

  syncEscapeShortcutState();
}

function ensureDisplayWindows(): void {
  const displays = screen.getAllDisplays();
  const operatorDisplay = getOperatorDisplay(displays);

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(operatorDisplay);
  }
}

function normalizeProjectionUpdate(
  payload: Partial<ProjectionUpdatePayload>,
): ProjectionUpdatePayload {
  const selectedOutputIds = normalizeOutputIds(
    payload.selectedOutputIds ?? latestProjectionState.selectedOutputIds,
  );

  return {
    currentTextOutput:
      payload.currentTextOutput ?? latestProjectionState.currentTextOutput,
    currentReferenceOutput:
      payload.currentReferenceOutput ??
      latestProjectionState.currentReferenceOutput,
    displayFormat: payload.displayFormat ?? latestProjectionState.displayFormat,
    activeTheme: payload.activeTheme ?? latestProjectionState.activeTheme,
    isLiveMode: payload.isLiveMode ?? latestProjectionState.isLiveMode,
    verseHoldFlag: payload.verseHoldFlag ?? latestProjectionState.verseHoldFlag,
    isAutoDisplayMode:
      payload.isAutoDisplayMode ?? latestProjectionState.isAutoDisplayMode,
    isScriptureParaphraseMode:
      payload.isScriptureParaphraseMode ??
      latestProjectionState.isScriptureParaphraseMode,
    currentBibleTranslation:
      normalizeTranslationTag(
        payload.currentBibleTranslation ??
          latestProjectionState.currentBibleTranslation,
      ) || latestProjectionState.currentBibleTranslation,
    selectedOutputIds,
    selectedAudioDeviceId:
      payload.selectedAudioDeviceId ??
      latestProjectionState.selectedAudioDeviceId,
    outputFontFamily:
      typeof payload.outputFontFamily === "string" &&
      payload.outputFontFamily.trim()
        ? payload.outputFontFamily
        : latestProjectionState.outputFontFamily,
    outputFontSize:
      typeof payload.outputFontSize === "number"
        ? Math.max(60, Math.min(160, payload.outputFontSize))
        : latestProjectionState.outputFontSize,
    lowerThirdStyle: normalizeLowerThirdStyle(
      payload.lowerThirdStyle ??
        payload.scriptureLowerThirdStyle ??
        latestProjectionState.lowerThirdStyle,
    ),
    scriptureLowerThirdStyle: normalizeLowerThirdStyle(
      payload.scriptureLowerThirdStyle ??
        payload.lowerThirdStyle ??
        latestProjectionState.scriptureLowerThirdStyle,
    ),
    lyricsLowerThirdStyle: normalizeLowerThirdStyle(
      payload.lyricsLowerThirdStyle ??
        payload.lowerThirdStyle ??
        latestProjectionState.lyricsLowerThirdStyle,
    ),
    backgroundStyle: normalizeBackgroundStyle(
      payload.backgroundStyle ?? latestProjectionState.backgroundStyle,
    ),
    backgroundTexture: normalizeBackgroundTexture(
      payload.backgroundTexture ?? latestProjectionState.backgroundTexture,
    ),
    backgroundImagePath:
      typeof payload.backgroundImagePath === "string"
        ? payload.backgroundImagePath
        : latestProjectionState.backgroundImagePath,
    backgroundPositionX: clampPosition(
      payload.backgroundPositionX ?? latestProjectionState.backgroundPositionX,
      latestProjectionState.backgroundPositionX,
    ),
    backgroundPositionY: clampPosition(
      payload.backgroundPositionY ?? latestProjectionState.backgroundPositionY,
      latestProjectionState.backgroundPositionY,
    ),
    textPositionX: clampPosition(
      payload.textPositionX ?? latestProjectionState.textPositionX,
      latestProjectionState.textPositionX,
    ),
    textPositionY: clampPosition(
      payload.textPositionY ?? latestProjectionState.textPositionY,
      latestProjectionState.textPositionY,
    ),
    customThemes: payload.customThemes ?? latestProjectionState.customThemes,
    defaultThemeId_SCRIPTURES: payload.defaultThemeId_SCRIPTURES ?? latestProjectionState.defaultThemeId_SCRIPTURES,
    defaultThemeId_LYRICS: payload.defaultThemeId_LYRICS ?? latestProjectionState.defaultThemeId_LYRICS,
    defaultThemeId_TIMER: payload.defaultThemeId_TIMER ?? latestProjectionState.defaultThemeId_TIMER,
    previewInputId: payload.previewInputId !== undefined ? payload.previewInputId : latestProjectionState.previewInputId,
    outputInputId: payload.outputInputId !== undefined ? payload.outputInputId : latestProjectionState.outputInputId,
    layerToCameraMap: payload.layerToCameraMap ?? latestProjectionState.layerToCameraMap,
    cameraThemeMap: payload.cameraThemeMap ?? latestProjectionState.cameraThemeMap,
    cameraMultiviews: payload.cameraMultiviews ?? latestProjectionState.cameraMultiviews,
    cameraInputs: payload.cameraInputs ?? latestProjectionState.cameraInputs,
    inputSettings: payload.inputSettings ?? latestProjectionState.inputSettings,
    videoPlaybackState: payload.videoPlaybackState ?? latestProjectionState.videoPlaybackState,
    outputRoutingMap: payload.outputRoutingMap ?? latestProjectionState.outputRoutingMap,
  };
}

async function handleProjectionUpdate(
  _event: IpcMainEvent,
  payload: Partial<ProjectionUpdatePayload>,
): Promise<void> {
  latestProjectionState = normalizeProjectionUpdate(payload);

  if (
    latestProjectionState.currentBibleTranslation !==
      cachedSettings.currentBibleTranslation ||
    latestProjectionState.selectedOutputIds.join("|") !==
      cachedSettings.selectedOutputIds.join("|")
  ) {
    await saveSettings({
      currentBibleTranslation: latestProjectionState.currentBibleTranslation,
      selectedOutputIds: latestProjectionState.selectedOutputIds,
    });
  }

  syncOutputWindows();

  for (const record of outputWindows.values()) {
    if (!record.window.isDestroyed()) {
      record.window.webContents.send("render-text", latestProjectionState);
    }
  }
}

async function handleBibleImportPicker(): Promise<BibleImportResponse> {
  const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const pickerOptions: OpenDialogOptions = {
    properties: ["openFile"],
    filters: [
      {
        name: "Bible Files",
        extensions: ["json", "sqlite", "db", "txt", "pdf", "sql"],
      },
    ],
  };
  const picked = ownerWindow
    ? await dialog.showOpenDialog(ownerWindow, pickerOptions)
    : await dialog.showOpenDialog(pickerOptions);

  if (picked.canceled || picked.filePaths.length === 0) {
    return {
      success: false,
      count: 0,
      canceled: true,
    };
  }

  const filePath = picked.filePaths[0];
  const translation = await promptForTranslationTag(
    ownerWindow,
    deriveSuggestedTranslation(filePath),
  );

  if (!translation) {
    return {
      success: false,
      count: 0,
      canceled: true,
    };
  }

  try {
    const result = await processBibleImport(filePath, translation, {
      stripMetadataOnImport: cachedSettings.stripMetadataOnImport,
      autoCorrectEncoding: cachedSettings.autoCorrectEncoding,
    });

    return {
      ...result,
      translation,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Bible import failure.";
    dialog.showErrorBox("Bible Import Failed", message);

    return {
      success: false,
      count: 0,
      translation,
      error: message,
    };
  }
}

function registerAppLifecycle(): void {
  // Disable background throttling to ensure real-time projection
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');

  app.whenReady().then(async () => {
    await registerVoskModelProtocol();
    await initializeDatabase();
    cachedSettings = await loadSettings();
    latestProjectionState = {
      ...DEFAULT_PROJECTION_STATE,
      currentBibleTranslation: cachedSettings.currentBibleTranslation,
      selectedOutputIds: cachedSettings.selectedOutputIds,
      displayFormat: cachedSettings.displayFormat,
      activeTheme: cachedSettings.activeTheme,
      isScriptureParaphraseMode: cachedSettings.isScriptureParaphraseMode,
      lowerThirdStyle: cachedSettings.lowerThirdStyle,
      outputFontFamily: cachedSettings.outputFontFamily,
      outputFontSize: cachedSettings.outputFontSize,
      scriptureLowerThirdStyle: cachedSettings.scriptureLowerThirdStyle,
      lyricsLowerThirdStyle: cachedSettings.lyricsLowerThirdStyle,
      backgroundStyle: cachedSettings.backgroundStyle,
      backgroundTexture: cachedSettings.backgroundTexture,
      backgroundImagePath: cachedSettings.backgroundImagePath,
      backgroundPositionX: cachedSettings.backgroundPositionX,
      backgroundPositionY: cachedSettings.backgroundPositionY,
      textPositionX: cachedSettings.textPositionX,
      textPositionY: cachedSettings.textPositionY,
    };

    const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const csp = buildContentSecurityPolicy(isDev);

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [csp],
        },
      });
    });

    console.log(
      "Electron security: Content-Security-Policy:",
      buildContentSecurityPolicy(isDev),
    );

    session.defaultSession.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        callback(permission === "media");
      },
    );

    ensureDisplayWindows();

    screen.on("display-added", () => {
      ensureDisplayWindows();
      syncOutputWindows();
    });
    screen.on("display-removed", () => {
      ensureDisplayWindows();
      syncOutputWindows();
    });
    screen.on("display-metrics-changed", () => {
      ensureDisplayWindows();
      syncOutputWindows();
    });

    ipcMain.on("update-projection", handleProjectionUpdateEvent);
    
    ipcMain.on("sync-video-time", (event, cameraId: number, time: number) => {
      for (const record of outputWindows.values()) {
        if (!record.window.isDestroyed()) {
          record.window.webContents.send("sync-video-time", cameraId, time);
        }
      }
    });

    ipcMain.handle(
      "db-query-scripture",
      async (_event, queryStr: string, translation: string) => {
        // Prefer an externally configured bible database path if present
        if (cachedSettings.bibleDatabasePath) {
          try {
            const results = await searchVersesInPath(
              cachedSettings.bibleDatabasePath,
              queryStr,
              translation,
            );

            if (Array.isArray(results)) {
              return results;
            }
          } catch (err) {
            console.warn("External Bible DB search failed:", err);
          }
        }

        return searchVerses(queryStr, translation);
      },
    );
    ipcMain.handle(
      "db-navigate-scripture",
      async (
        _event,
        reference: string,
        translation: string,
        direction: ScriptureNavigationDirection,
      ) => {
        if (cachedSettings.bibleDatabasePath) {
          try {
            const result = await navigateScriptureInPath(
              cachedSettings.bibleDatabasePath,
              reference,
              translation,
              direction,
            );

            if (result) {
              return result;
            }
          } catch (err) {
            console.warn("External Bible DB navigation failed:", err);
          }
        }

        return navigateScripture(reference, translation, direction);
      },
    );
    ipcMain.handle(
      "analyze-audio-scripture",
      async (_event, audioData: ArrayBuffer, mimeType: string) =>
        analyzeAudioScripture(audioData, mimeType),
    );
    ipcMain.handle(
      "transcribe-audio-deepspeech",
      async (_event, audioData: ArrayBuffer, sampleRate: number) =>
        transcribeAudioWithDeepSpeech(audioData, sampleRate),
    );
    ipcMain.handle(
      "synthesize-voice-polly",
      async (
        _event,
        text: string,
        voiceId: string | undefined,
        format: string | undefined,
      ) => synthesizeVoicePolly(text, voiceId, format),
    );
    ipcMain.handle("open-bible-picker", async () => handleBibleImportPicker());
    ipcMain.handle("pick-bible-database", async () => {
      const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const pickerOptions: OpenDialogOptions = {
        properties: ["openFile"],
        filters: [
          {
            name: "Bible Database",
            extensions: ["sqlite", "db", "json", "txt"],
          },
        ],
      };

      const picked = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, pickerOptions)
        : await dialog.showOpenDialog(pickerOptions);

      if (picked.canceled || picked.filePaths.length === 0) {
        return { canceled: true, path: null };
      }

      const filePath = picked.filePaths[0];

      try {
        await saveSettings({ bibleDatabasePath: filePath });
        return { canceled: false, path: filePath };
      } catch (err) {
        return { canceled: true, path: null };
      }
    });
    ipcMain.handle("import-canvas-media", async (_event, sourcePath: string) => {
      const importedPath = await importCanvasMedia(sourcePath);
      return { path: importedPath };
    });

    ipcMain.handle("pick-background-image", async () => {
      const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const dialogOptions: OpenDialogOptions = {
        properties: ["openFile"],
        filters: [
          {
            name: "Image Files",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
          },
        ],
      };
      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, path: null as string | null };
      }

      const importedPath = await importBackgroundImage(result.filePaths[0]);
      await saveSettings({
        backgroundImagePath: importedPath,
        backgroundStyle: "IMAGE",
      });

      return { canceled: false, path: importedPath };
    });
    ipcMain.handle("get-translations", async () => getInstalledTranslations());
    ipcMain.handle(
      "delete-translation",
      async (_event, translation: string) => {
        const deletedCount = await deleteTranslation(translation);
        const translations = await getInstalledTranslations();

        if (
          normalizeTranslationTag(translation) ===
            cachedSettings.currentBibleTranslation &&
          translations.length > 0
        ) {
          await saveSettings({ currentBibleTranslation: translations[0] });
          latestProjectionState = {
            ...latestProjectionState,
            currentBibleTranslation: translations[0],
            currentReferenceOutput: "",
            currentTextOutput: "",
          };
        }

        return { deletedCount, translations };
      },
    );
    ipcMain.handle("get-output-targets", async () => getAvailableOutputs());
    ipcMain.handle("resolve-vosk-model-url", async () => {
      const archivePath = getVoskModelArchivePath();
      const url = getVoskModelUrl();

      console.log("VOSK model resolver: Resolved model path:", archivePath);
      console.log("VOSK model resolver: Fetch URL:", url);

      return {
        archivePath,
        url,
      };
    });
    ipcMain.handle("get-app-settings", async () => cachedSettings);
    ipcMain.handle(
      "save-integration-settings",
      async (
        _event,
        settings: {
          deepspeechModelPath?: string;
          deepspeechScorerPath?: string;
          awsAccessKeyId?: string;
          awsSecretAccessKey?: string;
          awsRegion?: string;
          pollyVoiceId?: string;
          bibleDatabasePath?: string;
        },
      ) => {
        try {
          if (settings.awsAccessKeyId)
            await setSecret("awsAccessKeyId", settings.awsAccessKeyId);
          if (settings.awsSecretAccessKey)
            await setSecret("awsSecretAccessKey", settings.awsSecretAccessKey);
          const nonSecret: Partial<AppSettings> = {};
          if (typeof settings.awsRegion === "string")
            nonSecret.awsRegion = settings.awsRegion;
          if (typeof settings.pollyVoiceId === "string")
            nonSecret.pollyVoiceId = settings.pollyVoiceId;
          if (typeof settings.bibleDatabasePath === "string")
            nonSecret.bibleDatabasePath = settings.bibleDatabasePath;
          if (typeof settings.deepspeechModelPath === "string")
            nonSecret.deepspeechModelPath = settings.deepspeechModelPath;
          if (typeof settings.deepspeechScorerPath === "string")
            nonSecret.deepspeechScorerPath = settings.deepspeechScorerPath;
          if (Object.keys(nonSecret).length > 0) await saveSettings(nonSecret);
          // invalidate loaded model so it will be reloaded on demand
          deepspeechModel = null;
          return { success: true };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    );
    ipcMain.handle("get-integration-status", async () => {
      try {
        const awsAccessId = await getSecret("awsAccessKeyId");
        const awsSecret = await getSecret("awsSecretAccessKey");
        const hasDeepModel =
          Boolean((cachedSettings as any).deepspeechModelPath) ||
          Boolean(deepspeechModel);
        return {
          hasDeepSpeechModel: hasDeepModel,
          hasAwsCreds: Boolean(
            (awsAccessId && awsSecret) ||
            (process.env.AWS_ACCESS_KEY_ID &&
              process.env.AWS_SECRET_ACCESS_KEY),
          ),
          awsRegion: cachedSettings.awsRegion || process.env.AWS_REGION || null,
          pollyVoiceId: cachedSettings.pollyVoiceId || null,
          bibleDatabasePath: cachedSettings.bibleDatabasePath || null,
          deepspeechModelPath:
            (cachedSettings as any).deepspeechModelPath || null,
          deepspeechScorerPath:
            (cachedSettings as any).deepspeechScorerPath || null,
        };
      } catch {
        return {
          hasDeepSpeechModel:
            Boolean((cachedSettings as any).deepspeechModelPath) ||
            Boolean(deepspeechModel),
          hasAwsCreds: false,
          awsRegion: cachedSettings.awsRegion || process.env.AWS_REGION || null,
          pollyVoiceId: cachedSettings.pollyVoiceId || null,
          bibleDatabasePath: cachedSettings.bibleDatabasePath || null,
          deepspeechModelPath:
            (cachedSettings as any).deepspeechModelPath || null,
          deepspeechScorerPath:
            (cachedSettings as any).deepspeechScorerPath || null,
        };
      }
    });
    ipcMain.handle("delete-integration-secrets", async () => {
      try {
        await deleteSecret("awsAccessKeyId");
        await deleteSecret("awsSecretAccessKey");
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });
    ipcMain.handle("pick-deepspeech-model", async () => {
      const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const pickerOptions: OpenDialogOptions = {
        properties: ["openFile"],
        filters: [
          { name: "DeepSpeech Model", extensions: ["pbmm", "tflite", "pb"] },
        ],
      };
      const picked = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, pickerOptions)
        : await dialog.showOpenDialog(pickerOptions);

      if (picked.canceled || picked.filePaths.length === 0) {
        return { canceled: true, path: null };
      }

      const filePath = picked.filePaths[0];

      try {
        await saveSettings({ deepspeechModelPath: filePath });
        deepspeechModel = null;
        return { canceled: false, path: filePath };
      } catch (err) {
        return { canceled: true, path: null };
      }
    });
    ipcMain.handle("pick-deepspeech-scorer", async () => {
      const ownerWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const pickerOptions: OpenDialogOptions = {
        properties: ["openFile"],
        filters: [{ name: "DeepSpeech Scorer", extensions: ["scorer"] }],
      };
      const picked = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, pickerOptions)
        : await dialog.showOpenDialog(pickerOptions);

      if (picked.canceled || picked.filePaths.length === 0) {
        return { canceled: true, path: null };
      }

      const filePath = picked.filePaths[0];

      try {
        await saveSettings({ deepspeechScorerPath: filePath });
        deepspeechModel = null;
        return { canceled: false, path: filePath };
      } catch (err) {
        return { canceled: true, path: null };
      }
    });
    ipcMain.handle("load-deepspeech-model", async () => {
      const loaded = await ensureDeepSpeechModelLoaded();
      if (loaded) return { success: true };
      return {
        success: false,
        error:
          "Failed to load DeepSpeech model. Ensure model path is set and deepspeech module is installed.",
      };
    });
    ipcMain.handle(
      "save-app-settings",
      async (_event, settings: Partial<AppSettings>) => {
        const previousSettings = { ...cachedSettings };
        await saveSettings(settings);
        if (
          previousSettings.enableAlphaChannel !==
            cachedSettings.enableAlphaChannel ||
          previousSettings.enableScreenMirrorOutput !==
            cachedSettings.enableScreenMirrorOutput
        ) {
          closeAllOutputWindows();
          syncOutputWindows();
        } else {
          applyOutputWindowSettings();
        }
        return cachedSettings;
      },
    );
    ipcMain.on("exit-output-fullscreen", () => {
      exitOutputFullscreen();
    });

    app.on("activate", () => {
      ensureDisplayWindows();
      syncOutputWindows();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    ipcMain.removeListener("update-projection", handleProjectionUpdateEvent);
    ipcMain.removeHandler("db-query-scripture");
    ipcMain.removeHandler("db-navigate-scripture");
    ipcMain.removeHandler("analyze-audio-scripture");
    ipcMain.removeHandler("open-bible-picker");
    ipcMain.removeHandler("pick-background-image");
    ipcMain.removeHandler("get-translations");
    ipcMain.removeHandler("delete-translation");
    ipcMain.removeHandler("get-output-targets");
    ipcMain.removeHandler("resolve-vosk-model-url");
    ipcMain.removeHandler("get-app-settings");
    ipcMain.removeHandler("save-app-settings");
    ipcMain.removeAllListeners("exit-output-fullscreen");
    globalShortcut.unregisterAll();
    escapeShortcutRegistered = false;
    closeAllOutputWindows();
    screen.removeAllListeners("display-added");
    screen.removeAllListeners("display-removed");
    screen.removeAllListeners("display-metrics-changed");
    session.defaultSession.setPermissionRequestHandler(null);
  });
}

registerAppLifecycle();
