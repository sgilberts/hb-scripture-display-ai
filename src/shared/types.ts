export type DisplayFormat = "FULL" | "LOWER_THIRD";

export type LowerThirdStyle = "CLASSIC" | "BANNER" | "MINIMAL" | "CUSTOM";

export type BackgroundStyle = "SOLID" | "GRADIENT" | "IMAGE" | "COMPOSITE" | "VIDEO" | "TRANSPARENT";

export type BackgroundTexture = "NONE" | "GRAIN" | "DOT_GRID" | "SOFT_NOISE";

export type ThemeType = "IMAGE" | "GREEN_SCREEN" | "TRANSPARENT";

export type OutputTargetKind = "DISPLAY" | "NDI" | "HDMI" | "USB_C";

export interface OutputTarget {
  id: string;
  label: string;
  kind: OutputTargetKind;
  selected: boolean;
}
export interface ThemeDefinition {
  id: string;
  name: string;
  tabType: "SCRIPTURES" | "LYRICS" | "TIMER";
  lowerThirdStyle: LowerThirdStyle;
  backgroundStyle: BackgroundStyle;
  backgroundTexture: BackgroundTexture;
  backgroundImagePath: string;
  backgroundPositionX: number;
  backgroundPositionY: number;
  textPositionX: number;
  textPositionY: number;
  fillType: string;
  scale: number;
  entranceAnimation: string;
  animationDuration: number;
  animationCurve: string;
  fontFamily?: string;
  fontColor?: string;
  referencePosition?: "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "BELOW_TEXT";
  referenceColor?: string;
  referenceSize?: number;
  referenceEnabled?: boolean;
  referenceWeight?: string;
  backgroundVideoPath?: string;
  canvasElements?: CanvasElement[];
}

export type CanvasElementKind = "text" | "shape" | "image" | "video" | "overlay";

export interface CanvasElement {
  id: string;
  kind: CanvasElementKind;
  x: number; y: number; width: number; height: number;
  rotation: number; visible: boolean; locked: boolean; zIndex: number;
  text?: string; fontSize?: number; fontFamily?: string; fontColor?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  textShadow?: string; textOutline?: string; bgOpacity?: number; backgroundColor?: string;
  shapeType?: "rect" | "rounded-rect" | "circle" | "lower-third-bar" | "triangle" | "diamond" | "pentagon" | "hexagon" | "star" | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down" | "callout" | "line" | "parallelogram" | "trapezoid" | "cross" | "cylinder" | "heart" | "moon" | "cloud" | "lightning" | "speech-bubble" | "banner";
  fillColor?: string; fillOpacity?: number;
  borderColor?: string; borderWidth?: number; borderRadius?: number;
  mediaSrc?: string; mediaType?: "image" | "video";
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";
  overlayType?: "dust" | "light-leak" | "bokeh" | "film-grain";
  overlayOpacity?: number;
}

export interface CameraInput {
  id: number;
  name: string;
  live: boolean;
  type: string;
  mediaPath?: string;
  networkStreamId?: string;
}

export interface InputSetting {
  id: number;
  type: string;
  name?: string;
  deviceId?: string;
  mediaPath?: string;
  zoom?: number;
  zoomX?: number;
  zoomY?: number;
  panX?: number;
  panY?: number;
  rotation?: number;
  cropLeft?: number;
  cropRight?: number;
  cropTop?: number;
  cropBottom?: number;
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
  gamma: number;
  chromaEnabled: boolean;
  chromaColor: string;
  chromaKey: number;
  chromaKeyFilterEnabled: boolean;
  chromaKeyFilter: number;
  chromaAntiAliasing: string;
  chromaRed: number;
  chromaGreen: number;
  chromaBlue: number;
  lumaKey: number;
  opacity?: number;
  volume?: number;
  solo?: boolean;
  muted?: boolean;
  keyFillInputId?: string;
  triggerOnStart?: string;
  triggerOnStop?: string;
  triggerOnLoop?: string;
  tallyEnabled?: boolean;
  tallyPort?: number;
  deinterlace?: boolean;
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
  audioMutedState?: Record<number, boolean>;
  outputRoutingMap?: Record<string, string | number>;
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

export interface LyricRecord {
  id: string;
  title: string;
  artist: string;
  lyrics: string; // JSON string array of sections or raw text
}

export interface ScheduleRecord {
  id: string;
  name: string;
  data: string; // JSON string of schedule items (e.g., song IDs)
}
