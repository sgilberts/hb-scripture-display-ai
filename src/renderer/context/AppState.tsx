import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import { VoskSpeechService } from "../speech/VoskSpeechService";
import { parseSpokenReference } from "../speech/IntentParser";
import { detectVoiceCommand } from "../speech/VoiceCommandLayer";
import { verseMemory } from "../speech/VerseMemory";
import { detectFollowUp } from "../speech/FollowUpDetector";
import { processSermonTranscript } from "../speech/SermonEngine";
import { searchScriptureLocal } from "../speech/SemanticSearch";
import { initializeVerseHighlightOverlay, highlightActiveVerse } from "../speech/VerseHighlightOverlay";

// --- V2 ARCHITECTURE ---
import { performanceGuard } from "../services/performance/VoicePerformanceGuard.v2";
import { transcriptFilterStack } from "../services/intelligence/TranscriptFilterStack.v2";

// --- V1 MULTILINGUAL CAPABILITIES ---
import { languageDetection } from "../services/capabilities/languageDetection";
import { translationBridge } from "../services/capabilities/translationBridge";
import { scriptureMap } from "../services/capabilities/scriptureMap";
import { offlineBibleSearch } from "../services/capabilities/offlineBibleSearch";
import { voiceLearningEngine } from "../speech/VoiceLearningEngine";

let lastFailedTranscript: string | null = null;
let lastFailedTranscriptTime = 0;
import { wakeWordCapability } from "../services/capabilities/wakeWord";
import { contextMemory } from "../services/capabilities/contextMemory";
import { sermonBuilder } from "../services/capabilities/sermonBuilder";

// --- SCRIPTURE INTELLIGENCE ENGINE v1 ---
import { scriptureContextMemory } from "../services/scripture/contextMemory";
import { resolveFollowUp } from "../services/intent/followUpDetector";
import { wakeWordDetector } from "../services/voice/wakeWordDetector";
import { normalizeLanguage } from "../services/voice/languageNormalizer";

// --- UPGRADED VOICE PIPELINE ---
import { routeTranscript } from "../speech/CommandRouter";
import { scriptureLockManager } from "../speech/ScriptureLockManager";
import { verseContextManager } from "../speech/VerseContextManager";
import {
  detectSpokenTranslation,
  resolveVoiceBiblePhrase,
} from "../speech/VoiceScriptureResolver";

import type {
  AudioScriptureAnalysis,
  AppStateMatrix,
  BackgroundStyle,
  BackgroundTexture,
  DisplayFormat,
  LowerThirdStyle,
  OutputTarget,
  ScriptureNavigationDirection,
  ScriptureRecord,
  ThemeType,
  ThemeDefinition,
} from "../../shared/types";

const DEFAULT_SCRIPTURE_THEMES: ThemeDefinition[] = [
  {
    id: "scripture-classic-default",
    name: "Scripture Classic",
    tabType: "SCRIPTURES",
    lowerThirdStyle: "CLASSIC",
    backgroundStyle: "IMAGE",
    backgroundTexture: "NONE",
    backgroundImagePath: "",
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    textPositionX: 50,
    textPositionY: 78,
    fillType: "Linear Gradient",
    scale: 100,
    entranceAnimation: "Slide Up",
    animationDuration: 0.8,
    animationCurve: "Ease-Out",
  },
  {
    id: "scripture-minimal-default",
    name: "Scripture Minimal",
    tabType: "SCRIPTURES",
    lowerThirdStyle: "MINIMAL",
    backgroundStyle: "SOLID",
    backgroundTexture: "NONE",
    backgroundImagePath: "",
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    textPositionX: 50,
    textPositionY: 72,
    fillType: "Flat",
    scale: 100,
    entranceAnimation: "Fade In",
    animationDuration: 0.6,
    animationCurve: "Ease-Out",
  },
];

function mergeDefaultScriptureThemes(
  themes: ThemeDefinition[],
): ThemeDefinition[] {
  const nextThemes = [...themes];

  for (const defaultTheme of DEFAULT_SCRIPTURE_THEMES) {
    if (!nextThemes.some((theme) => theme.id === defaultTheme.id)) {
      nextThemes.push(defaultTheme);
    }
  }

  return nextThemes;
}

type AppStateAction =
  | { type: "SET_LIVE_MODE"; payload: boolean }
  | { type: "SET_VERSE_HOLD_FLAG"; payload: boolean }
  | { type: "SET_AUTO_DISPLAY_MODE"; payload: boolean }
  | { type: "SET_DISPLAY_FORMAT"; payload: DisplayFormat }
  | { type: "SET_ACTIVE_THEME"; payload: ThemeType }
  | { type: "SET_CURRENT_BIBLE_TRANSLATION"; payload: string }
  | { type: "SET_CURRENT_TEXT_OUTPUT"; payload: string }
  | { type: "SET_CURRENT_REFERENCE_OUTPUT"; payload: string }
  | { type: "SET_SELECTED_OUTPUT_IDS"; payload: string[] }
  | { type: "SET_SELECTED_AUDIO_DEVICE_ID"; payload: string }
  | { type: "SET_INPUT_GAIN"; payload: number }
  | { type: "SET_OUTPUT_FONT_FAMILY"; payload: string }
  | { type: "SET_OUTPUT_FONT_SIZE"; payload: number }
  | { type: "SET_LOWER_THIRD_STYLE"; payload: LowerThirdStyle }
  | { type: "PATCH_STATE"; payload: Partial<AppStateMatrix> }
  | { type: "RESET_STATE" };

interface BibleImportResponse {
  success: boolean;
  count: number;
  translation?: string;
  canceled?: boolean;
  error?: string;
}

interface AppSettingsSnapshot {
  currentBibleTranslation?: string;
  selectedOutputIds?: string[];
  isAutoDisplayMode?: boolean;
  isScriptureParaphraseMode?: boolean;
  displayFormat?: DisplayFormat;
  activeTheme?: ThemeType;
  selectedAudioDeviceId?: string;
  inputGain?: number;
  outputFontFamily?: string;
  outputFontSize?: number;
  lowerThirdStyle?: LowerThirdStyle;
  scriptureLowerThirdStyle?: LowerThirdStyle;
  lyricsLowerThirdStyle?: LowerThirdStyle;
  backgroundStyle?: BackgroundStyle;
  backgroundTexture?: BackgroundTexture;
  backgroundImagePath?: string;
  backgroundPositionX?: number;
  backgroundPositionY?: number;
  textPositionX?: number;
  textPositionY?: number;
  customThemes?: ThemeDefinition[];
  defaultThemeId_SCRIPTURES?: string | null;
  defaultThemeId_LYRICS?: string | null;
  defaultThemeId_TIMER?: string | null;
  previewInputId?: number | null;
  outputRoutingMap?: Record<string, string | number>;
}

interface AppStateContextValue {
  state: AppStateMatrix;
  availableTranslations: string[];
  availableOutputs: OutputTarget[];
  dispatch: Dispatch<AppStateAction>;
  setIsLiveMode: (value: boolean) => void;
  setVerseHoldFlag: (value: boolean) => void;
  setIsAutoDisplayMode: (value: boolean) => void;
  setDisplayFormat: (value: DisplayFormat) => void;
  setActiveTheme: (value: ThemeType) => void;
  setCurrentBibleTranslation: (value: string) => void;
  setCurrentTextOutput: (value: string) => void;
  setCurrentReferenceOutput: (value: string) => void;
  setSelectedOutputIds: (value: string[]) => void;
  setSelectedAudioDeviceId: (value: string) => void;
  setInputGain: (value: number) => void;
  setOutputFontFamily: (value: string) => void;
  setOutputFontSize: (value: number) => void;
  setLowerThirdStyle: (value: LowerThirdStyle) => void;
  patchState: (value: Partial<AppStateMatrix>) => void;
  resetState: () => void;
  refreshAvailableTranslations: () => Promise<string[]>;
  refreshAvailableOutputs: (overrideSelectedIds?: string[]) => Promise<OutputTarget[]>;
  triggerBibleImport: () => Promise<BibleImportResponse>;
  deleteTranslation: (
    translation: string,
  ) => Promise<{ deletedCount: number; translations: string[] }>;
  searchScriptures: (
    queryStr: string,
    translation?: string,
  ) => Promise<ScriptureRecord[]>;
  navigateScripture: (
    reference: string,
    direction: ScriptureNavigationDirection,
    translation?: string,
  ) => Promise<ScriptureRecord | null>;
  startListening: (modelPath: string) => Promise<void>;
  stopListening: () => Promise<void>;
  pickBackgroundImage: () => Promise<{
    canceled: boolean;
    path: string | null;
  }>;
}

interface ElectronBridge {
  sendProjectionUpdate: (data: unknown) => void;
  onProjectionUpdate: (callback: (data: unknown) => void) => void;
  searchBible: (queryStr: string, translation: string) => Promise<unknown>;
  navigateScripture: (
    reference: string,
    translation: string,
    direction: ScriptureNavigationDirection,
  ) => Promise<ScriptureRecord | null>;
  analyzeAudioScripture: (
    audioData: ArrayBuffer,
    mimeType: string,
  ) => Promise<AudioScriptureAnalysis>;
  pickBackgroundImage: () => Promise<{
    canceled: boolean;
    path: string | null;
  }>;
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
  fetchAppSettings: () => Promise<AppSettingsSnapshot>;
  saveAppSettings: (
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

function isProjectionWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "output";
}

const initialState: AppStateMatrix = {
  isLiveMode: false,
  verseHoldFlag: false,
  isAutoDisplayMode: false,
  isScriptureParaphraseMode: false,
  displayFormat: "FULL",
  activeTheme: "IMAGE",
  currentBibleTranslation: "KJV",
  currentTextOutput: "",
  currentReferenceOutput: "",
  selectedOutputIds: [],
  selectedAudioDeviceId: "default",
  inputGain: 100,
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
  customThemes: [...DEFAULT_SCRIPTURE_THEMES],
  defaultThemeId_SCRIPTURES: DEFAULT_SCRIPTURE_THEMES[0].id,
  defaultThemeId_LYRICS: null,
  defaultThemeId_TIMER: null,
  previewInputId: null,
  outputInputId: null,
  layerToCameraMap: {},
  cameraThemeMap: {},
  cameraMultiviews: {},
  cameraInputs: [],
  inputSettings: {},
  outputRoutingMap: {},
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function appStateReducer(
  state: AppStateMatrix,
  action: AppStateAction,
): AppStateMatrix {
  switch (action.type) {
    case "SET_LIVE_MODE":
      return { ...state, isLiveMode: action.payload };
    case "SET_VERSE_HOLD_FLAG":
      return { ...state, verseHoldFlag: action.payload };
    case "SET_AUTO_DISPLAY_MODE":
      return { ...state, isAutoDisplayMode: action.payload };
    case "SET_DISPLAY_FORMAT":
      return { ...state, displayFormat: action.payload };
    case "SET_ACTIVE_THEME":
      return { ...state, activeTheme: action.payload };
    case "SET_CURRENT_BIBLE_TRANSLATION":
      return { ...state, currentBibleTranslation: action.payload };
    case "SET_CURRENT_TEXT_OUTPUT":
      return { ...state, currentTextOutput: action.payload };
    case "SET_CURRENT_REFERENCE_OUTPUT":
      return { ...state, currentReferenceOutput: action.payload };
    case "SET_SELECTED_OUTPUT_IDS":
      return { ...state, selectedOutputIds: action.payload };
    case "SET_SELECTED_AUDIO_DEVICE_ID":
      return { ...state, selectedAudioDeviceId: action.payload };
    case "SET_INPUT_GAIN":
      return { ...state, inputGain: action.payload };
    case "SET_OUTPUT_FONT_FAMILY":
      return { ...state, outputFontFamily: action.payload };
    case "SET_OUTPUT_FONT_SIZE":
      return { ...state, outputFontSize: action.payload };
    case "SET_LOWER_THIRD_STYLE":
      return { ...state, lowerThirdStyle: action.payload };
    case "PATCH_STATE":
      return { ...state, ...action.payload };
    case "RESET_STATE":
      return initialState;
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}

function mergeTranslationList(
  translations: string[],
  currentTranslation: string,
): string[] {
  const merged = Array.from(
    new Set(
      [currentTranslation, ...translations]
        .map((translation) => translation.trim())
        .filter(Boolean)
        .map((translation) => translation.toUpperCase()),
    ),
  );

  return merged.sort((left, right) => left.localeCompare(right));
}

export function AppStateProvider({
  children,
  initialValue,
}: {
  children: ReactNode;
  initialValue?: Partial<AppStateMatrix>;
}): JSX.Element {
  const [speechService] = useState(() => new VoskSpeechService());
  const [state, dispatch] = useReducer(appStateReducer, {
    ...initialState,
    ...initialValue,
  });
  const [availableTranslations, setAvailableTranslations] = useState<string[]>(
    () => [
      initialValue?.currentBibleTranslation ??
        initialState.currentBibleTranslation,
    ],
  );
  const [availableOutputs, setAvailableOutputs] = useState<OutputTarget[]>([]);
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(false);
  const projectionWindow = isProjectionWindow();
  const persistedSettingsSignatureRef = useRef<string>("");
  const currentBibleTranslationRef = useRef(state.currentBibleTranslation);
  const availableTranslationsRef = useRef(availableTranslations);
  const hasRefreshedTranslationsForVoiceRef = useRef(false);
  const scriptureVoiceModesRef = useRef({
    displayScriptures: state.isAutoDisplayMode,
    paraphraseScriptures: state.isScriptureParaphraseMode,
  });

  useEffect(() => {
    currentBibleTranslationRef.current = state.currentBibleTranslation;
  }, [state.currentBibleTranslation]);

  useEffect(() => {
    availableTranslationsRef.current = availableTranslations;
  }, [availableTranslations]);

  useEffect(() => {
    scriptureVoiceModesRef.current = {
      displayScriptures: state.isAutoDisplayMode,
      paraphraseScriptures: state.isScriptureParaphraseMode,
    };
  }, [state.isAutoDisplayMode, state.isScriptureParaphraseMode]);

  const refreshAvailableTranslations = async (
    preferredTranslation = state.currentBibleTranslation,
  ): Promise<string[]> => {
    if (projectionWindow) {
      return availableTranslations;
    }

    const fallback = mergeTranslationList([], preferredTranslation);

    if (!window.electron?.fetchAvailableTranslations) {
      setAvailableTranslations(fallback);
      return fallback;
    }

    const fetchedTranslations =
      await window.electron.fetchAvailableTranslations();
    const merged = mergeTranslationList(
      fetchedTranslations,
      preferredTranslation,
    );

    setAvailableTranslations(merged);

    if (
      fetchedTranslations.length > 0 &&
      !fetchedTranslations.includes(preferredTranslation)
    ) {
      dispatch({
        type: "SET_CURRENT_BIBLE_TRANSLATION",
        payload: fetchedTranslations[0],
      });
    }

    return merged;
  };

  const refreshAvailableOutputs = async (
    preferredSelectedOutputIds = state.selectedOutputIds,
  ): Promise<OutputTarget[]> => {
    if (projectionWindow) {
      return availableOutputs;
    }

    if (!window.electron?.fetchAvailableOutputs) {
      setAvailableOutputs([]);
      return [];
    }

    const fetchedOutputs = await window.electron.fetchAvailableOutputs();
    const mergedOutputs = fetchedOutputs.map((output) => ({
      ...output,
      selected: preferredSelectedOutputIds.includes(output.id),
    }));

    setAvailableOutputs(mergedOutputs);

    const selectedOutputIds = mergedOutputs
      .filter((output) => output.selected)
      .map((output) => output.id);

    if (
      selectedOutputIds.length > 0 &&
      selectedOutputIds.join("|") !== preferredSelectedOutputIds.join("|")
    ) {
      dispatch({
        type: "SET_SELECTED_OUTPUT_IDS",
        payload: selectedOutputIds,
      });
    }

    return mergedOutputs;
  };

  const triggerBibleImport = async (): Promise<BibleImportResponse> => {
    if (projectionWindow) {
      return {
        success: false,
        count: 0,
        canceled: true,
        error: "Bible import is only available in the operator window.",
      };
    }

    if (!window.electron?.triggerBibleImport) {
      return {
        success: false,
        count: 0,
        canceled: true,
        error: "Bible import bridge is not available.",
      };
    }

    const result = await window.electron.triggerBibleImport();

    if (result.success) {
      const refreshed = await refreshAvailableTranslations();
      await refreshAvailableOutputs();

      if (result.translation && refreshed.includes(result.translation)) {
        dispatch({
          type: "SET_CURRENT_BIBLE_TRANSLATION",
          payload: result.translation,
        });
      }
    }

    return result;
  };

  const deleteTranslation = async (
    translation: string,
  ): Promise<{ deletedCount: number; translations: string[] }> => {
    if (!window.electron?.deleteTranslation) {
      return { deletedCount: 0, translations: availableTranslations };
    }

    const result = await window.electron.deleteTranslation(translation);
    const refreshed = await refreshAvailableTranslations();
    const nextTranslation =
      refreshed[0] ?? initialState.currentBibleTranslation;

    if (!refreshed.includes(state.currentBibleTranslation)) {
      dispatch({
        type: "SET_CURRENT_BIBLE_TRANSLATION",
        payload: nextTranslation,
      });
      dispatch({ type: "SET_CURRENT_TEXT_OUTPUT", payload: "" });
      dispatch({ type: "SET_CURRENT_REFERENCE_OUTPUT", payload: "" });
    }

    return result;
  };

  const searchScriptures = async (
    queryStr: string,
    translation = state.currentBibleTranslation,
  ): Promise<ScriptureRecord[]> => {
    if (!window.electron?.searchBible) {
      return [];
    }

    const response = await window.electron.searchBible(queryStr, translation);

    const results = Array.isArray(response) ? (response as ScriptureRecord[]) : [];

    if (results.length > 0 && lastFailedTranscript && Date.now() - lastFailedTranscriptTime < 15000) {
      const r = results[0];
      const refString = `${r.bookFull} ${r.chapter}:${r.verse}`;
      voiceLearningEngine.recordCorrection(lastFailedTranscript, refString);
      lastFailedTranscript = null;
    }

    return results;
  };

  const handleNavigateScripture = async (
    reference: string,
    direction: ScriptureNavigationDirection,
    translation = state.currentBibleTranslation,
  ): Promise<ScriptureRecord | null> => {
    if (!window.electron?.navigateScripture) {
      return null;
    }

    return window.electron.navigateScripture(reference, translation, direction);
  };

  const startListening = async (modelPath: string) => {
    if (!performanceGuard.canStartListening()) return;

    console.log(
      "[VOSK] Starting listening with modelPath:",
      modelPath,
    );
    try {
      await speechService.initialize(modelPath);
      initializeVerseHighlightOverlay();
      
      let lastDispatchedText = "";
      let lastDispatchedRef = "";
      let lastDispatchTime = 0;
      const sermonMode = true; // Optional structured mode
      const displayVoiceScriptureResult = (
        record: ScriptureRecord,
        results: ScriptureRecord[],
      ): boolean => {
        const newText = record.text;
        const newRef = `${record.bookFull} ${record.chapter}:${record.verse} ${record.translation}`;
        const now = Date.now();

        window.dispatchEvent(new CustomEvent("scriptureSearchResults", { detail: { results } }));

        if ((lastDispatchedText === newText && lastDispatchedRef === newRef) || (now - lastDispatchTime <= 200)) {
          return false;
        }

        lastDispatchedText = newText;
        lastDispatchedRef = newRef;
        lastDispatchTime = now;

        if (!newText) {
          console.log(`[DISPLAY FAIL] No text for ${newRef}`);
          return false;
        }

        console.log(`[DISPLAY REQUEST] ${newRef}`);
        dispatch({ type: "SET_CURRENT_TEXT_OUTPUT", payload: newText });
        dispatch({ type: "SET_CURRENT_REFERENCE_OUTPUT", payload: newRef });
        highlightActiveVerse(newRef);
        window.dispatchEvent(new CustomEvent("scriptureHighlightEvent", {
          detail: {
            reference: newRef,
            scrollTarget: `verse-${record.bookFull?.replace(/\s+/g, "-")}-${record.chapter}-${record.verse}`,
          }
        }));
        console.log(`[DISPLAY SUCCESS] ${newRef}`);
        return true;
      };

      // --- V1 MICRO-BATCHING GUARD ---
      let microBatchTimer: ReturnType<typeof setTimeout> | null = null;
      let pendingBatchText = "";
      const flushMicroBatch = () => {
        if (pendingBatchText) {
          // Batched partial transcripts are available here for lightweight processing
          pendingBatchText = "";
        }
        microBatchTimer = null;
      };

      await speechService.startListening(async (transcript) => {
        const text = transcript.text;
        console.log(`[VOICE RAW] ${text}`);
        if (!text?.trim()) return;

        // --- MICRO-BATCHING: Deduplicate bursting partials ---
        if (!transcript.isFinal) {
          pendingBatchText = text;
          if (!microBatchTimer) {
            microBatchTimer = setTimeout(flushMicroBatch, 75);
          }
        }

        let translationDetection = detectSpokenTranslation(
          text,
          availableTranslationsRef.current,
        );
        if (
          !translationDetection.translation &&
          transcript.isFinal &&
          !hasRefreshedTranslationsForVoiceRef.current
        ) {
          hasRefreshedTranslationsForVoiceRef.current = true;
          try {
            const refreshedTranslations = await refreshAvailableTranslations(
              currentBibleTranslationRef.current,
            );
            availableTranslationsRef.current = refreshedTranslations;
            translationDetection = detectSpokenTranslation(
              text,
              refreshedTranslations,
            );
          } catch (error) {
            console.warn("[VOICE_TRANSLATION] Could not refresh installed translations", error);
          }
        }
        const activeVoiceTranslation = translationDetection.translation ?? currentBibleTranslationRef.current;
        if (translationDetection.translation && transcript.isFinal) {
          console.log(`[VOICE_TRANSLATION] Switching scripture translation to ${translationDetection.translation}`);
          currentBibleTranslationRef.current = translationDetection.translation;
          dispatch({
            type: "SET_CURRENT_BIBLE_TRANSLATION",
            payload: translationDetection.translation,
          });
        }

        // --- LANGUAGE NORMALIZER ---
        const normalizedText = normalizeLanguage(translationDetection.cleanedTranscript || text);
        console.log(`[NORMALIZED] ${normalizedText}`);
        if (translationDetection.translation && transcript.isFinal && !normalizedText) {
          return;
        }

        // --- WAKE WORD DETECTOR ---
        wakeWordDetector.check(normalizedText);
        wakeWordCapability.detect(text);
        if (text.toLowerCase().includes("hallelujah mode")) {
          console.log(`[WAKE_WORD] Activated: Hallelujah mode`);
          window.dispatchEvent(new CustomEvent("wakeWordDetected", { detail: { phrase: "hallelujah mode" } }));
        }

        // --- MULTILINGUAL OVERLAY ---
        const { language } = languageDetection.detect(text);
        const translatedOutput = translationBridge.translate(text, language);
        if (sermonMode && transcript.isFinal) {
          sermonBuilder.buildFromStream(translatedOutput.translated, language);
          const sermonOutput = processSermonTranscript(text);
          if (sermonOutput) window.dispatchEvent(new CustomEvent("sermonModeOutput", { detail: sermonOutput }));
        }

        console.log(`[TRANSCRIPT] ${transcript.isFinal ? "Final" : "Partial"}:`, text);

        // --- V2 TRANSCRIPT FILTER STACK ---
        transcriptFilterStack.processRawStream(text, transcript.isFinal);

        // ═══════════════════════════════════════════════════════════════
        // COMMAND ROUTER — Priority: scripture → command → semantic
        // ═══════════════════════════════════════════════════════════════
        const routeResult = routeTranscript(
          normalizedText,
          transcript.isFinal,
          transcript.confidence,
        );
        const voiceModes = scriptureVoiceModesRef.current;

        // SUPPRESSED: inside scripture lock hold window, partial transcript, or non-reference text.
        if (routeResult.type === "suppress") {
          if (!voiceModes.paraphraseScriptures) return;
          if (!transcript.isFinal || scriptureLockManager.isLocked()) return;

          const phraseResolution = await resolveVoiceBiblePhrase(
            normalizedText,
            activeVoiceTranslation,
            searchScriptures,
          );
          if (!phraseResolution?.results.length) return;

          const r = phraseResolution.results[0];
          const refString = `${r.bookFull} ${r.chapter}:${r.verse}`;
          console.log(
            `[VOICE_PHRASE] "${phraseResolution.query}" -> ${refString} ${phraseResolution.translation} (${phraseResolution.results.length} candidates)`,
          );

          contextMemory.recordInteraction(refString, language, "forward");
          scriptureContextMemory.record(refString, normalizedText, "voice");
          verseContextManager.setCurrentVerse(r.bookFull, r.chapter, r.verse);
          verseMemory.updateVerseContext(r, "forward");
          displayVoiceScriptureResult(r, phraseResolution.results);
          return;
        }

        // ── A: SCRIPTURE REFERENCE DETECTED ─────────────────────────────
        if (routeResult.type === "scripture" && routeResult.scriptureRef) {
          if (!voiceModes.displayScriptures) {
            scriptureLockManager.resetBuffer();
            return;
          }
          const lockedRef = routeResult.scriptureRef;
          console.log(`[PARSED REF] ${lockedRef}`);
          transcript.parsedReference = lockedRef;

          // Only do DB lookup on final — partials trigger early lock only
          if (!transcript.isFinal) return;

          // Use canonical ref as primary search key (skip full semantic)
          console.log(`[LOOKUP REQUEST] ${lockedRef}`);
          const results = await searchScriptures(
            lockedRef,
            activeVoiceTranslation
          ).catch(() => []);

          if (results.length > 0) {
            console.log(`[LOOKUP RESULT] Success (${results.length} matches)`);
            const r = results[0];
            const refString = `${r.bookFull} ${r.chapter}:${r.verse}`;

            // Update ALL context managers
            verseContextManager.setCurrentVerse(r.bookFull, r.chapter, r.verse);
            verseMemory.updateVerseContext(r, "forward");
            scriptureContextMemory.record(refString, lockedRef, "voice");
            contextMemory.recordInteraction(refString, language, "forward");
            voiceLearningEngine.recordCorrection(normalizedText, refString);

            // Reset scripture lock so next utterance is fresh
            scriptureLockManager.resetBuffer();

            window.dispatchEvent(new CustomEvent("scriptureSearchResults", { detail: { results } }));

            const newText = r.text;
            const newRef = `${r.bookFull} ${r.chapter}:${r.verse} ${r.translation}`;
            const now = Date.now();

            if ((lastDispatchedText !== newText || lastDispatchedRef !== newRef) && (now - lastDispatchTime > 200)) {
              lastDispatchedText = newText;
              lastDispatchedRef = newRef;
              lastDispatchTime = now;

              if (!newText) {
                console.log(`[DISPLAY FAIL] No text for ${newRef}`);
              } else {
                console.log(`[DISPLAY REQUEST] ${newRef}`);
                dispatch({ type: "SET_CURRENT_TEXT_OUTPUT", payload: newText });
                dispatch({ type: "SET_CURRENT_REFERENCE_OUTPUT", payload: newRef });
                highlightActiveVerse(newRef);
                window.dispatchEvent(new CustomEvent("scriptureHighlightEvent", {
                  detail: {
                    reference: newRef,
                    scrollTarget: `verse-${r.bookFull?.replace(/\s+/g, "-")}-${r.chapter}-${r.verse}`,
                  }
                }));
                console.log(`[DISPLAY SUCCESS] ${newRef}`);
              }
            }
          } else {
            console.log(`[LOOKUP RESULT] Fail (No matches)`);
            lastFailedTranscript = normalizedText;
            lastFailedTranscriptTime = Date.now();
          }

          return;
        }

        // ── B: VOICE COMMAND ─────────────────────────────────────────────
        if (routeResult.type === "command") {
          // Navigation already handled inside CommandRouter (verseContextManager.next/previous)
          // If a nav ref came back, look it up in DB
          if (routeResult.navigationRef && transcript.isFinal) {
            const navResults = await searchScriptures(
              routeResult.navigationRef,
              activeVoiceTranslation
            ).catch(() => []);

            if (navResults.length > 0) {
              const r = navResults[0];
              verseMemory.updateVerseContext(r, routeResult.command === "back" ? "back" : "forward");
              const newText = r.text;
              const newRef = `${r.bookFull} ${r.chapter}:${r.verse} ${r.translation}`;
              const now = Date.now();
              if ((lastDispatchedText !== newText || lastDispatchedRef !== newRef) && (now - lastDispatchTime > 200)) {
                lastDispatchedText = newText;
                lastDispatchedRef = newRef;
                lastDispatchTime = now;
                if (!newText) {
                  console.log(`[DISPLAY FAIL] No text for ${newRef}`);
                } else {
                  console.log(`[DISPLAY REQUEST] ${newRef}`);
                  dispatch({ type: "SET_CURRENT_TEXT_OUTPUT", payload: newText });
                  dispatch({ type: "SET_CURRENT_REFERENCE_OUTPUT", payload: newRef });
                  highlightActiveVerse(newRef);
                  console.log(`[DISPLAY SUCCESS] ${newRef}`);
                }
              }
            }
          }
          return;
        }

        // ── C: SEMANTIC SEARCH FALLBACK (only for non-scripture text) ─────
        if (routeResult.type === "semantic" && transcript.isFinal) {
          if (!voiceModes.paraphraseScriptures) return;

          // Follow-up detector (legacy)
          const followUpIntent = detectFollowUp(text);
          if (followUpIntent) {
            window.dispatchEvent(new CustomEvent("followUpDetected", { detail: { intent: followUpIntent } }));
          }

          // V1 follow-up resolver
          const followUpResolution = resolveFollowUp(normalizedText);
          if (followUpResolution?.resolvedReference) {
            console.log(`[FOLLOW_UP] Resolved to: ${followUpResolution.resolvedReference}`);
          }

          // Map + capabilities search
          const mapped = scriptureMap.mapReference(translatedOutput.translated);
          const searchTarget = mapped?.canonicalReference || translatedOutput.translated || text;

          const results = await offlineBibleSearch.semanticSearch(
            searchTarget,
            translatedOutput.translated,
            activeVoiceTranslation,
            searchScriptures
          );

          if (results.length > 0) {
            const r = results[0];
            const refString = `${r.bookFull} ${r.chapter}:${r.verse}`;
            contextMemory.recordInteraction(refString, language, "forward");
            scriptureContextMemory.record(refString, normalizedText, "voice");
            verseContextManager.setCurrentVerse(r.bookFull, r.chapter, r.verse);
            verseMemory.updateVerseContext(r, "forward");

            window.dispatchEvent(new CustomEvent("scriptureSearchResults", { detail: { results } }));

            const newText = r.text;
            const newRef = `${r.bookFull} ${r.chapter}:${r.verse} ${r.translation}`;
            const now = Date.now();
            if ((lastDispatchedText !== newText || lastDispatchedRef !== newRef) && (now - lastDispatchTime > 200)) {
              lastDispatchedText = newText;
              lastDispatchedRef = newRef;
              lastDispatchTime = now;
              dispatch({ type: "SET_CURRENT_TEXT_OUTPUT", payload: newText });
              dispatch({ type: "SET_CURRENT_REFERENCE_OUTPUT", payload: newRef });
              highlightActiveVerse(newRef);
              window.dispatchEvent(new CustomEvent("scriptureHighlightEvent", {
                detail: {
                  reference: newRef,
                  scrollTarget: `verse-${r.bookFull?.replace(/\s+/g, "-")}-${r.chapter}-${r.verse}`,
                }
              }));
            }
          }
        }
      });
      console.log("[VOSK] Listening started successfully");
    } catch (err) {
      performanceGuard.markStopped();
      console.error("[VOSK] Failed to start listening:", err);
    }
  };

  const stopListening = async () => {
    try {
      await speechService.stopListening();
      performanceGuard.markStopped();
    } catch (err) {
      console.error("[VOSK] Error stopping:", err);
    }
  };

  useEffect(() => {
    if (projectionWindow || !window.electron?.sendProjectionUpdate) {
      return;
    }

    window.electron.sendProjectionUpdate({
      currentTextOutput: state.currentTextOutput,
      currentReferenceOutput: state.currentReferenceOutput,
      displayFormat: state.displayFormat,
      activeTheme: state.activeTheme,
      isLiveMode: state.isLiveMode,
      verseHoldFlag: state.verseHoldFlag,
      isAutoDisplayMode: state.isAutoDisplayMode,
      isScriptureParaphraseMode: state.isScriptureParaphraseMode,
      currentBibleTranslation: state.currentBibleTranslation,
      selectedOutputIds: state.selectedOutputIds,
      selectedAudioDeviceId: state.selectedAudioDeviceId,
      inputGain: state.inputGain,
      outputFontFamily: state.outputFontFamily,
      outputFontSize: state.outputFontSize,
      lowerThirdStyle: state.lowerThirdStyle,
      scriptureLowerThirdStyle: state.scriptureLowerThirdStyle,
      lyricsLowerThirdStyle: state.lyricsLowerThirdStyle,
      backgroundStyle: state.backgroundStyle,
      backgroundTexture: state.backgroundTexture,
      backgroundImagePath: state.backgroundImagePath,
      backgroundPositionX: state.backgroundPositionX,
      backgroundPositionY: state.backgroundPositionY,
      textPositionX: state.textPositionX,
      textPositionY: state.textPositionY,
      customThemes: state.customThemes,
      defaultThemeId_SCRIPTURES: state.defaultThemeId_SCRIPTURES,
      defaultThemeId_LYRICS: state.defaultThemeId_LYRICS,
      defaultThemeId_TIMER: state.defaultThemeId_TIMER,
      previewInputId: state.previewInputId,
      outputInputId: state.outputInputId,
      layerToCameraMap: state.layerToCameraMap,
      cameraThemeMap: state.cameraThemeMap,
      cameraMultiviews: state.cameraMultiviews,
      cameraInputs: state.cameraInputs,
      inputSettings: state.inputSettings,
      videoPlaybackState: state.videoPlaybackState,
      outputRoutingMap: state.outputRoutingMap,
    });
  }, [
    state.activeTheme,
    state.currentReferenceOutput,
    state.currentTextOutput,
    state.displayFormat,
    state.isLiveMode,
    state.verseHoldFlag,
    state.isAutoDisplayMode,
    state.isScriptureParaphraseMode,
    state.currentBibleTranslation,
    state.selectedOutputIds,
    state.selectedAudioDeviceId,
    state.inputGain,
    state.outputFontFamily,
    state.outputFontSize,
    state.lowerThirdStyle,
    state.scriptureLowerThirdStyle,
    state.lyricsLowerThirdStyle,
    state.backgroundStyle,
    state.backgroundTexture,
    state.backgroundImagePath,
    state.backgroundPositionX,
    state.backgroundPositionY,
    state.textPositionX,
    state.textPositionY,
    state.customThemes,
    state.defaultThemeId_SCRIPTURES,
    state.defaultThemeId_LYRICS,
    state.defaultThemeId_TIMER,
    state.previewInputId,
    state.outputInputId,
    state.layerToCameraMap,
    state.cameraThemeMap,
    state.cameraMultiviews,
    state.cameraInputs,
    state.inputSettings,
    state.videoPlaybackState,
    state.outputRoutingMap,
  ]);

  useEffect(() => {
    if (!window.electron?.onProjectionUpdate) {
      return;
    }

    window.electron.onProjectionUpdate((data: unknown) => {
      if (!data || typeof data !== "object") {
        return;
      }

      dispatch({
        type: "PATCH_STATE",
        payload: data as Partial<AppStateMatrix>,
      });
    });
  }, []);

  useEffect(() => {
    if (projectionWindow) {
      return;
    }

  const load = async (): Promise<void> => {
      let nextTranslation = state.currentBibleTranslation;
      let nextSelectedOutputIds = state.selectedOutputIds;
      let nextAutoDisplayMode = state.isAutoDisplayMode;
      let nextScriptureParaphraseMode = state.isScriptureParaphraseMode;
      let nextDisplayFormat = state.displayFormat;
      let nextActiveTheme = state.activeTheme;
      let nextSelectedAudioDeviceId = state.selectedAudioDeviceId;
      let nextInputGain = state.inputGain;
      let nextOutputFontFamily = state.outputFontFamily;
      let nextOutputFontSize = state.outputFontSize;
      let nextLowerThirdStyle = state.lowerThirdStyle;
      let nextScriptureLowerThirdStyle = state.scriptureLowerThirdStyle;
      let nextLyricsLowerThirdStyle = state.lyricsLowerThirdStyle;
      let nextBackgroundStyle = state.backgroundStyle;
      let nextBackgroundTexture = state.backgroundTexture;
      let nextBackgroundImagePath = state.backgroundImagePath;
      let nextBackgroundPositionX = state.backgroundPositionX;
      let nextBackgroundPositionY = state.backgroundPositionY;
      let nextTextPositionX = state.textPositionX;
      let nextTextPositionY = state.textPositionY;
      let nextCustomThemes = state.customThemes;
      let nextDefaultThemeIdScriptures = state.defaultThemeId_SCRIPTURES;
      let nextDefaultThemeIdLyrics = state.defaultThemeId_LYRICS;
      let nextDefaultThemeIdTimer = state.defaultThemeId_TIMER;

      try {
        const storedSettings =
          (await window.electron?.fetchAppSettings?.()) ?? null;

        if (storedSettings) {
          nextTranslation =
            typeof storedSettings.currentBibleTranslation === "string" &&
            storedSettings.currentBibleTranslation.trim()
              ? storedSettings.currentBibleTranslation.trim().toUpperCase()
              : state.currentBibleTranslation;

          nextSelectedOutputIds = Array.isArray(
            storedSettings.selectedOutputIds,
          )
            ? storedSettings.selectedOutputIds.filter(
                (value): value is string => typeof value === "string",
              )
            : state.selectedOutputIds;

          nextAutoDisplayMode =
            typeof storedSettings.isAutoDisplayMode === "boolean"
              ? storedSettings.isAutoDisplayMode
              : state.isAutoDisplayMode;

          nextScriptureParaphraseMode =
            typeof storedSettings.isScriptureParaphraseMode === "boolean"
              ? storedSettings.isScriptureParaphraseMode
              : state.isScriptureParaphraseMode;

          nextDisplayFormat =
            storedSettings.displayFormat === "LOWER_THIRD"
              ? "LOWER_THIRD"
              : "FULL";

          nextActiveTheme =
            storedSettings.activeTheme === "GREEN_SCREEN" ||
            storedSettings.activeTheme === "TRANSPARENT"
              ? storedSettings.activeTheme
              : "IMAGE";

          nextSelectedAudioDeviceId =
            typeof storedSettings.selectedAudioDeviceId === "string"
              ? storedSettings.selectedAudioDeviceId
              : state.selectedAudioDeviceId;

          nextInputGain =
            typeof storedSettings.inputGain === "number"
              ? storedSettings.inputGain
              : state.inputGain;

          nextOutputFontFamily =
            typeof storedSettings.outputFontFamily === "string" &&
            storedSettings.outputFontFamily.trim()
              ? storedSettings.outputFontFamily
              : state.outputFontFamily;

          nextOutputFontSize =
            typeof storedSettings.outputFontSize === "number"
              ? storedSettings.outputFontSize
              : state.outputFontSize;

          nextLowerThirdStyle =
            storedSettings.lowerThirdStyle === "BANNER" ||
            storedSettings.lowerThirdStyle === "MINIMAL" ||
            storedSettings.lowerThirdStyle === "CUSTOM" ||
            storedSettings.lowerThirdStyle === "CLASSIC"
              ? storedSettings.lowerThirdStyle
              : state.lowerThirdStyle;

          nextScriptureLowerThirdStyle =
            storedSettings.scriptureLowerThirdStyle === "BANNER" ||
            storedSettings.scriptureLowerThirdStyle === "MINIMAL" ||
            storedSettings.scriptureLowerThirdStyle === "CUSTOM" ||
            storedSettings.scriptureLowerThirdStyle === "CLASSIC"
              ? storedSettings.scriptureLowerThirdStyle
              : nextLowerThirdStyle;

          nextLyricsLowerThirdStyle =
            storedSettings.lyricsLowerThirdStyle === "BANNER" ||
            storedSettings.lyricsLowerThirdStyle === "MINIMAL" ||
            storedSettings.lyricsLowerThirdStyle === "CUSTOM" ||
            storedSettings.lyricsLowerThirdStyle === "CLASSIC"
              ? storedSettings.lyricsLowerThirdStyle
              : nextLowerThirdStyle;

          nextBackgroundStyle =
            storedSettings.backgroundStyle === "SOLID" ||
            storedSettings.backgroundStyle === "GRADIENT" ||
            storedSettings.backgroundStyle === "IMAGE" ||
            storedSettings.backgroundStyle === "COMPOSITE"
              ? storedSettings.backgroundStyle
              : state.backgroundStyle;

          nextBackgroundTexture =
            storedSettings.backgroundTexture === "GRAIN" ||
            storedSettings.backgroundTexture === "DOT_GRID" ||
            storedSettings.backgroundTexture === "SOFT_NOISE"
              ? storedSettings.backgroundTexture
              : state.backgroundTexture;

          nextBackgroundImagePath =
            typeof storedSettings.backgroundImagePath === "string"
              ? storedSettings.backgroundImagePath
              : state.backgroundImagePath;

          nextBackgroundPositionX =
            typeof storedSettings.backgroundPositionX === "number"
              ? storedSettings.backgroundPositionX
              : state.backgroundPositionX;

          nextBackgroundPositionY =
            typeof storedSettings.backgroundPositionY === "number"
              ? storedSettings.backgroundPositionY
              : state.backgroundPositionY;

          nextTextPositionX =
            typeof storedSettings.textPositionX === "number"
              ? storedSettings.textPositionX
              : state.textPositionX;

          nextTextPositionY =
            typeof storedSettings.textPositionY === "number"
              ? storedSettings.textPositionY
              : state.textPositionY;

          nextCustomThemes = mergeDefaultScriptureThemes(
            Array.isArray(storedSettings.customThemes)
              ? (storedSettings.customThemes as ThemeDefinition[])
              : state.customThemes,
          );

          const scriptureThemeIds = new Set(
            nextCustomThemes
              .filter((theme) => theme.tabType === "SCRIPTURES")
              .map((theme) => theme.id),
          );
          const lyricsThemeIds = new Set(
            nextCustomThemes
              .filter((theme) => theme.tabType === "LYRICS")
              .map((theme) => theme.id),
          );
          const timerThemeIds = new Set(
            nextCustomThemes
              .filter((theme) => theme.tabType === "TIMER")
              .map((theme) => theme.id),
          );

          nextDefaultThemeIdScriptures =
            typeof storedSettings.defaultThemeId_SCRIPTURES === "string" &&
            scriptureThemeIds.has(storedSettings.defaultThemeId_SCRIPTURES)
              ? storedSettings.defaultThemeId_SCRIPTURES
              : nextCustomThemes.find((theme) => theme.tabType === "SCRIPTURES")
                ?.id ?? DEFAULT_SCRIPTURE_THEMES[0].id;

          nextDefaultThemeIdLyrics =
            typeof storedSettings.defaultThemeId_LYRICS === "string" &&
            lyricsThemeIds.has(storedSettings.defaultThemeId_LYRICS)
              ? storedSettings.defaultThemeId_LYRICS
              : state.defaultThemeId_LYRICS;

          nextDefaultThemeIdTimer =
            typeof storedSettings.defaultThemeId_TIMER === "string" &&
            timerThemeIds.has(storedSettings.defaultThemeId_TIMER)
              ? storedSettings.defaultThemeId_TIMER
              : state.defaultThemeId_TIMER;

          dispatch({
            type: "SET_CURRENT_BIBLE_TRANSLATION",
            payload: nextTranslation,
          });

          dispatch({
            type: "SET_SELECTED_OUTPUT_IDS",
            payload: nextSelectedOutputIds,
          });

          dispatch({
            type: "SET_AUTO_DISPLAY_MODE",
            payload: nextAutoDisplayMode,
          });

          dispatch({
            type: "SET_DISPLAY_FORMAT",
            payload: nextDisplayFormat,
          });

          dispatch({
            type: "SET_ACTIVE_THEME",
            payload: nextActiveTheme,
          });

          dispatch({
            type: "SET_SELECTED_AUDIO_DEVICE_ID",
            payload: nextSelectedAudioDeviceId,
          });

          dispatch({
            type: "SET_INPUT_GAIN",
            payload: nextInputGain,
          });

          dispatch({
            type: "SET_OUTPUT_FONT_FAMILY",
            payload: nextOutputFontFamily,
          });

          dispatch({
            type: "SET_OUTPUT_FONT_SIZE",
            payload: nextOutputFontSize,
          });

          dispatch({
            type: "SET_LOWER_THIRD_STYLE",
            payload: nextLowerThirdStyle,
          });

          dispatch({
            type: "PATCH_STATE",
            payload: {
              scriptureLowerThirdStyle: nextScriptureLowerThirdStyle,
              isScriptureParaphraseMode: nextScriptureParaphraseMode,
              lyricsLowerThirdStyle: nextLyricsLowerThirdStyle,
              backgroundStyle: nextBackgroundStyle,
              backgroundTexture: nextBackgroundTexture,
              backgroundImagePath: nextBackgroundImagePath,
              backgroundPositionX: nextBackgroundPositionX,
              backgroundPositionY: nextBackgroundPositionY,
              textPositionX: nextTextPositionX,
              textPositionY: nextTextPositionY,
              customThemes: nextCustomThemes,
              defaultThemeId_SCRIPTURES: nextDefaultThemeIdScriptures,
              defaultThemeId_LYRICS: nextDefaultThemeIdLyrics,
              defaultThemeId_TIMER: nextDefaultThemeIdTimer,
              outputRoutingMap:
                storedSettings.outputRoutingMap &&
                typeof storedSettings.outputRoutingMap === "object"
                  ? (storedSettings.outputRoutingMap as Record<string, string | number>)
                  : state.outputRoutingMap,
            },
          });

          persistedSettingsSignatureRef.current = JSON.stringify({
            currentBibleTranslation: nextTranslation,
            selectedOutputIds: nextSelectedOutputIds,
            isAutoDisplayMode: nextAutoDisplayMode,
            isScriptureParaphraseMode: nextScriptureParaphraseMode,
            displayFormat: nextDisplayFormat,
            activeTheme: nextActiveTheme,
            selectedAudioDeviceId: nextSelectedAudioDeviceId,
            inputGain: nextInputGain,
            outputFontFamily: nextOutputFontFamily,
            outputFontSize: nextOutputFontSize,
            lowerThirdStyle: nextLowerThirdStyle,
            scriptureLowerThirdStyle: nextScriptureLowerThirdStyle,
            lyricsLowerThirdStyle: nextLyricsLowerThirdStyle,
            backgroundStyle: nextBackgroundStyle,
            backgroundTexture: nextBackgroundTexture,
            backgroundImagePath: nextBackgroundImagePath,
            backgroundPositionX: nextBackgroundPositionX,
            backgroundPositionY: nextBackgroundPositionY,
            textPositionX: nextTextPositionX,
            textPositionY: nextTextPositionY,
            customThemes: nextCustomThemes,
            defaultThemeId_SCRIPTURES: nextDefaultThemeIdScriptures,
            defaultThemeId_LYRICS: nextDefaultThemeIdLyrics,
            defaultThemeId_TIMER: nextDefaultThemeIdTimer,
          });

          if (window.electron?.saveAppSettings) {
            void window.electron.saveAppSettings({
              customThemes: nextCustomThemes,
              defaultThemeId_SCRIPTURES: nextDefaultThemeIdScriptures,
              defaultThemeId_LYRICS: nextDefaultThemeIdLyrics,
              defaultThemeId_TIMER: nextDefaultThemeIdTimer,
            });
          }
        }
      } finally {
        setIsSettingsHydrated(true);
        void refreshAvailableTranslations(nextTranslation);
        void refreshAvailableOutputs(nextSelectedOutputIds);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (
      projectionWindow ||
      !isSettingsHydrated ||
      !window.electron?.saveAppSettings
    ) {
      return;
    }

    const nextSnapshot = {
      currentBibleTranslation: state.currentBibleTranslation,
      selectedOutputIds: state.selectedOutputIds,
      isAutoDisplayMode: state.isAutoDisplayMode,
      isScriptureParaphraseMode: state.isScriptureParaphraseMode,
      displayFormat: state.displayFormat,
      activeTheme: state.activeTheme,
      selectedAudioDeviceId: state.selectedAudioDeviceId,
      inputGain: state.inputGain,
      outputFontFamily: state.outputFontFamily,
      outputFontSize: state.outputFontSize,
      lowerThirdStyle: state.lowerThirdStyle,
      scriptureLowerThirdStyle: state.scriptureLowerThirdStyle,
      lyricsLowerThirdStyle: state.lyricsLowerThirdStyle,
      backgroundStyle: state.backgroundStyle,
      backgroundTexture: state.backgroundTexture,
      backgroundImagePath: state.backgroundImagePath,
      backgroundPositionX: state.backgroundPositionX,
      backgroundPositionY: state.backgroundPositionY,
      textPositionX: state.textPositionX,
      textPositionY: state.textPositionY,
      customThemes: state.customThemes,
      defaultThemeId_SCRIPTURES: state.defaultThemeId_SCRIPTURES,
      defaultThemeId_LYRICS: state.defaultThemeId_LYRICS,
      defaultThemeId_TIMER: state.defaultThemeId_TIMER,
      outputRoutingMap: state.outputRoutingMap,
    };
    const nextSignature = JSON.stringify(nextSnapshot);

    if (persistedSettingsSignatureRef.current === nextSignature) {
      return;
    }

    persistedSettingsSignatureRef.current = nextSignature;
    void window.electron.saveAppSettings(nextSnapshot);
  }, [
    isSettingsHydrated,
    projectionWindow,
    state.currentBibleTranslation,
    state.selectedOutputIds,
    state.isAutoDisplayMode,
    state.isScriptureParaphraseMode,
    state.displayFormat,
    state.activeTheme,
    state.selectedAudioDeviceId,
    state.inputGain,
    state.outputFontFamily,
    state.outputFontSize,
    state.lowerThirdStyle,
    state.scriptureLowerThirdStyle,
    state.lyricsLowerThirdStyle,
    state.backgroundStyle,
    state.backgroundTexture,
    state.backgroundImagePath,
    state.backgroundPositionX,
    state.backgroundPositionY,
    state.textPositionX,
    state.textPositionY,
    state.customThemes,
    state.defaultThemeId_SCRIPTURES,
    state.defaultThemeId_LYRICS,
    state.defaultThemeId_TIMER,
    state.outputRoutingMap,
  ]);

  const contextValue: AppStateContextValue = {
    state,
    availableTranslations,
    availableOutputs,
    dispatch,
    setIsLiveMode: (value) =>
      dispatch({ type: "SET_LIVE_MODE", payload: value }),
    setVerseHoldFlag: (value) =>
      dispatch({ type: "SET_VERSE_HOLD_FLAG", payload: value }),
    setIsAutoDisplayMode: (value) =>
      dispatch({ type: "SET_AUTO_DISPLAY_MODE", payload: value }),
    setDisplayFormat: (value) =>
      dispatch({ type: "SET_DISPLAY_FORMAT", payload: value }),
    setActiveTheme: (value) =>
      dispatch({ type: "SET_ACTIVE_THEME", payload: value }),
    setCurrentBibleTranslation: (value) =>
      dispatch({ type: "SET_CURRENT_BIBLE_TRANSLATION", payload: value }),
    setCurrentTextOutput: (value) =>
      dispatch({ type: "SET_CURRENT_TEXT_OUTPUT", payload: value }),
    setCurrentReferenceOutput: (value) =>
      dispatch({ type: "SET_CURRENT_REFERENCE_OUTPUT", payload: value }),
    setSelectedOutputIds: (value) =>
      dispatch({ type: "SET_SELECTED_OUTPUT_IDS", payload: value }),
    setSelectedAudioDeviceId: (value) =>
      dispatch({ type: "SET_SELECTED_AUDIO_DEVICE_ID", payload: value }),
    setInputGain: (value) =>
      dispatch({ type: "SET_INPUT_GAIN", payload: value }),
    setOutputFontFamily: (value) =>
      dispatch({ type: "SET_OUTPUT_FONT_FAMILY", payload: value }),
    setOutputFontSize: (value) =>
      dispatch({ type: "SET_OUTPUT_FONT_SIZE", payload: value }),
    setLowerThirdStyle: (value) =>
      dispatch({ type: "SET_LOWER_THIRD_STYLE", payload: value }),
    patchState: (value) => dispatch({ type: "PATCH_STATE", payload: value }),
    resetState: () => dispatch({ type: "RESET_STATE" }),
    refreshAvailableTranslations,
    refreshAvailableOutputs,
    triggerBibleImport,
    deleteTranslation,
    searchScriptures,
    navigateScripture: handleNavigateScripture,
    startListening,
    stopListening,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider.");
  }

  return context;
}
