export type DisplayFormat = "FULL" | "LOWER_THIRD";

export type LowerThirdStyle = "CLASSIC" | "BANNER" | "MINIMAL" | "CUSTOM";

export type BackgroundStyle = "SOLID" | "GRADIENT" | "IMAGE" | "COMPOSITE";

export type BackgroundTexture = "NONE" | "GRAIN" | "DOT_GRID" | "SOFT_NOISE";

export type ThemeType = "IMAGE" | "GREEN_SCREEN" | "TRANSPARENT";

export type OutputTargetKind = "DISPLAY" | "NDI" | "HDMI" | "USB_C";

export interface OutputTarget {
  id: string;
  label: string;
  kind: OutputTargetKind;
  selected: boolean;
}

export interface AppStateMatrix {
  isLiveMode: boolean;
  verseHoldFlag: boolean;
  isAutoDisplayMode: boolean;
  isScriptureParaphraseMode: boolean;
  displayFormat: DisplayFormat;
  activeTheme: ThemeType;
  currentBibleTranslation: string;
  currentTextOutput: string;
  currentReferenceOutput: string;
  selectedOutputIds: string[];
  selectedAudioDeviceId: string;
  inputGain: number;
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
  previewInputId: number | null;
}

export interface ScriptureRecord {
  id: number;
  bookFull: string;
  bookShort: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
}

export type ScriptureNavigationDirection =
  | "PREVIOUS_CHAPTER"
  | "PREVIOUS_VERSE"
  | "NEXT_VERSE"
  | "NEXT_CHAPTER";

export interface AudioScriptureAnalysis {
  transcript: string;
  scriptureReference?: string;
  searchQuery?: string;
  aiEnabled: boolean;
  error?: string;
}
