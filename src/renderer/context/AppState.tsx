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
} from "../../shared/types";

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
  refreshAvailableOutputs: () => Promise<OutputTarget[]>;
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
  analyzeAudioScripture: (
    audioData: ArrayBuffer,
    mimeType: string,
  ) => Promise<AudioScriptureAnalysis>;
  hasAudioAiProvider?: () => Promise<boolean>;
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

    return Array.isArray(response) ? (response as ScriptureRecord[]) : [];
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

  const analyzeAudioScripture = async (
    audioData: ArrayBuffer,
    mimeType: string,
  ): Promise<AudioScriptureAnalysis> => {
    if (!window.electron?.analyzeAudioScripture) {
      return {
        transcript: "",
        aiEnabled: false,
        error: "Audio scripture analysis bridge is not available.",
      };
    }

    return window.electron.analyzeAudioScripture(audioData, mimeType);
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
    });
  }, [
    state.activeTheme,
    state.currentReferenceOutput,
    state.currentTextOutput,
    state.displayFormat,
    state.isLiveMode,
    state.verseHoldFlag,
    state.isAutoDisplayMode,
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
              lyricsLowerThirdStyle: nextLyricsLowerThirdStyle,
              backgroundStyle: nextBackgroundStyle,
              backgroundTexture: nextBackgroundTexture,
              backgroundImagePath: nextBackgroundImagePath,
              backgroundPositionX: nextBackgroundPositionX,
              backgroundPositionY: nextBackgroundPositionY,
              textPositionX: nextTextPositionX,
              textPositionY: nextTextPositionY,
            },
          });

          persistedSettingsSignatureRef.current = JSON.stringify({
            currentBibleTranslation: nextTranslation,
            selectedOutputIds: nextSelectedOutputIds,
            isAutoDisplayMode: nextAutoDisplayMode,
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
          });
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
    analyzeAudioScripture,
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
