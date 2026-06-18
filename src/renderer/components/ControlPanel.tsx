import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  LowerThirdStyle,
  ScriptureNavigationDirection,
  ScriptureRecord,
  ThemeType,
  ThemeDefinition,
  InputSetting,
} from "../../shared/types";
import InputSettingsDialog from './InputSettingsDialog';
import { useAppState } from "../context/AppState";
import abstractBackgroundUrl from "../assets/abstract-motion-background.png";
import OutputCanvas from "./OutputCanvas";
import ThemeDesigner from "./ThemeDesigner";
import { LiveCamera } from "./LiveCamera";
import ChromaKeyCanvas from "./ChromaKeyCanvas";
import MediaChromaWrapper from "./MediaChromaWrapper";
import { hexToRgb, computeAutoChromaSettings, type ChromaKeySettings } from "../core/chromaKeyEngine";
import LyricsPanel from "./LyricsPanel";
import LyricsEditorPane from "./LyricsEditorPane";
import type { LyricRecord, ScheduleRecord } from "../../shared/types";

interface ControlPanelProps {
  onOpenSettings: () => void;
}

interface RailItem {
  label: string;
  icon: string;
  active?: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const RAIL_ITEMS: RailItem[] = [
  { label: "Sources", icon: "SRC" },
  { label: "Layers", icon: "LYR" },
  { label: "Outputs", icon: "OUT" },
  { label: "Macros", icon: "MAC", active: true },
  { label: "Settings", icon: "SET" },
  { label: "System", icon: "SYS" },
];

const LOWER_THIRD_STYLES: Array<{ label: string; value: LowerThirdStyle }> = [
  { label: "Classic", value: "CLASSIC" },
  { label: "Banner", value: "BANNER" },
  { label: "Minimal", value: "MINIMAL" },
  { label: "Custom", value: "CUSTOM" },
];

function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

const VideoMiniControls = ({
  cameraId,
  isPlaying,
  onTogglePlay,
}: {
  cameraId: number;
  isPlaying: boolean;
  onTogglePlay: (id: number) => void;
}) => {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    const tick = () => {
      const video = document.querySelector<HTMLVideoElement>(
        `video[data-input-id="${cameraId}"]`
      );
      if (video) {
        setProgress(video.currentTime);
        setDuration(video.duration || 1);
      }
      timerId = setTimeout(tick, 250);
    };
    tick();
    return () => clearTimeout(timerId);
  }, [cameraId]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    const videos = document.querySelectorAll<HTMLVideoElement>(
      `video[data-input-id="${cameraId}"]`
    );
    videos.forEach((v) => {
      v.currentTime = time;
    });
    setProgress(time);
  };

  return (
    <div className="flex w-full items-center gap-2 px-2 py-1 bg-[#131316] border-t border-[#3c4a42] shrink-0">
      <button
        onClick={() => onTogglePlay(cameraId)}
        className="text-[#e4e1e6] hover:text-[#4edea3] font-mono text-[9px] font-bold w-8 text-left"
      >
        {isPlaying ? "STOP" : "PLAY"}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={progress}
        onChange={handleSeek}
        className="flex-1 h-1 appearance-none bg-[#3c4a42] rounded-full accent-[#4edea3] cursor-pointer"
      />
    </div>
  );
};


function toReference(record: ScriptureRecord): string {
  return `${record.bookFull} ${record.chapter}:${record.verse}`;
}

function cleanNavigationReference(reference: string): string {
  return reference
    .trim()
    .replace(/\s+[A-Z][A-Z0-9]+\s*$/, "")
    .trim();
}

function isTruthyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function transcriptToNavigationCommand(
  transcript: string,
): ScriptureNavigationDirection | null {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const hasChapter = /\bchapter\b/.test(normalized);
  const hasVerse = /\bverse\b/.test(normalized);
  const saysNext = /\b(next|forward|forwards|advance|ahead)\b/.test(normalized);
  const saysPrevious =
    /\b(previous|prev|back|backward|backwards|before|prior|last)\b/.test(
      normalized,
    );

  if (hasChapter && saysNext) {
    return "NEXT_CHAPTER";
  }

  if (hasChapter && saysPrevious) {
    return "PREVIOUS_CHAPTER";
  }

  if (
    /\b(next verse|verse next|advance verse|forward verse|go forward)\b/.test(
      normalized,
    ) ||
    normalized === "next"
  ) {
    return "NEXT_VERSE";
  }

  if (
    /\b(previous verse|prev verse|verse before|before verse|prior verse|last verse|go back|back one|move back)\b/.test(
      normalized,
    ) ||
    (hasVerse && saysPrevious) ||
    normalized === "previous" ||
    normalized === "prev" ||
    normalized === "back"
  ) {
    return "PREVIOUS_VERSE";
  }

  if (hasVerse && saysNext) {
    return "NEXT_VERSE";
  }

  return null;
}

function StatusLed({
  active,
  tone = "green",
}: {
  active: boolean;
  tone?: "green" | "amber";
}) {
  return (
    <span
      className={joinClasses(
        "block h-3 w-3 rounded-full border",
        active && tone === "green"
          ? "border-[#6ffbbe] bg-[#4edea3] shadow-[0_0_18px_rgba(78,222,163,0.82)]"
          : active
            ? "border-[#ffddb8] bg-[#ffb95f] shadow-[0_0_16px_rgba(255,185,95,0.7)]"
            : "border-[#3c4a42] bg-[#353438]",
      )}
    />
  );
}

function ProjectionMonitor({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <section className="min-w-0">
      <div
        className={joinClasses(
          "inline-flex border border-b-0 bg-[#1f1f22] px-2.5 py-1.5",
          active ? "border-[#10b981]" : "border-[#3c4a42]",
        )}
      >
        <span
          className={joinClasses(
            "font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em]",
            active ? "text-[#4edea3]" : "text-[#bbcabf]",
          )}
        >
          {label}
        </span>
      </div>
      <div
        className={joinClasses(
          "relative aspect-[16/9] overflow-hidden border",
          active ? "border-[#10b981]" : "border-[#3c4a42]",
        )}
      >
        <OutputCanvas
          compact
          indicatorLabel={active ? "LIVE" : "PREVIEW"}
          indicatorTone={active ? "live" : "preview"}
        />
      </div>
    </section>
  );
}


export default function ControlPanel({
  onOpenSettings,
}: ControlPanelProps) {
  const {
    state,
    availableTranslations,
    availableOutputs,
    setVerseHoldFlag,
    setIsAutoDisplayMode,
    setInputGain,
    setSelectedAudioDeviceId,
    setDisplayFormat,
    patchState,
    setActiveTheme,
    setCurrentBibleTranslation,
    setCurrentTextOutput,
    setCurrentReferenceOutput,
    setSelectedOutputIds,
    refreshAvailableTranslations,
    refreshAvailableOutputs,
    triggerBibleImport,
    searchScriptures,
    navigateScripture,
    startListening,
    stopListening,
  } = useAppState();

  const [searchQuery, setSearchQuery] = useState(state.currentReferenceOutput);
  const [searchResults, setSearchResults] = useState<ScriptureRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [isAudioListening, setIsAudioListening] = useState(false);
  const videoPlaybackState = state.videoPlaybackState || {};
  const [statusMessage, setStatusMessage] = useState(
    "Control node online. Projection bus armed.",
  );
  const [networkStreams, setNetworkStreams] = useState<any[]>([]);

  const inputGain = state.inputGain;
  const selectedAudioDeviceId = state.selectedAudioDeviceId;
  // inputLevel and inputLevelDb states removed to prevent 60 FPS re-renders

  const [activeTab, setActiveTab] = useState<"SCRIPTURES" | "LYRICS" | "TIMER">("SCRIPTURES");
  const [activeRail, setActiveRail] = useState<"CN" | "LYR" | "MAC" | string>("CN");
  const [productionTab, setProductionTab] = useState<"RECORD" | "STREAM" | "COUNTDOWN" | "TIME" | "STOPWATCH">("COUNTDOWN");
  const [stopwatchTimeMs, setStopwatchTimeMs] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [backgroundPositionY, setBackgroundPositionY] = useState(50);
  const [textPositionX, setTextPositionX] = useState(50);
  const [textPositionY, setTextPositionY] = useState(50);

  const [selectedLyric, setSelectedLyric] = useState<LyricRecord | null>(null);
  const [lyricsRefreshTrigger, setLyricsRefreshTrigger] = useState(0);

  const handleSaveLyric = async (lyric: LyricRecord) => {
    if (window.electron.saveLyric) {
      await window.electron.saveLyric(lyric);
      setSelectedLyric(lyric);
      setLyricsRefreshTrigger(prev => prev + 1);
    }
  };

  const handleDeleteLyric = async (id: string) => {
    if (window.electron.deleteLyric) {
      await window.electron.deleteLyric(id);
      setSelectedLyric(null);
      setLyricsRefreshTrigger(prev => prev + 1);
    }
  };

  const handleSendLyricToTheme = (text: string) => {
    patchState({
      currentTextOutput: text,
      currentReferenceOutput: "LYRICS",
    } as any);
  };
  const [countdownHours, setCountdownHours] = useState(0);
  const [countdownMinutes, setCountdownMinutes] = useState(5);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const initialCountdownMs = (countdownHours * 3600 + countdownMinutes * 60 + countdownSeconds) * 1000;
  const [countdownTimeMs, setCountdownTimeMs] = useState(initialCountdownMs);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [isLiveTimerActive, setIsLiveTimerActive] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [cameraInputs, setCameraInputs] = useState<{ id: number, name: string, live: boolean, type: string, mediaPath?: string }[]>(() => {
    return state.cameraInputs && state.cameraInputs.length > 0 ? state.cameraInputs : [
      { id: 1, name: "CAMERA 1", live: true, type: "Camera" },
      { id: 2, name: "CAMERA 2", live: false, type: "Camera" }
    ];
  });
  const [previewInputId, setPreviewInputId] = useState<number | null>(state.previewInputId ?? null);
  const [outputInputId, setoutputInputId] = useState<number | null>(state.outputInputId || null);
  const [layerToCameraMap, setLayerToCameraMap] = useState<Record<number, number>>(state.layerToCameraMap || {});
  const masterActiveLayers = new Set(Object.keys(layerToCameraMap).map(Number));
  const [settingsDialogInputId, setSettingsDialogInputId] = useState<number | null>(null);
  const [settingsTab, setSettingsTab] = useState<string>("General");
  const [cameraMultiviews, setCameraMultiviews] = useState<Record<number, Record<number, number>>>(state.cameraMultiviews || {});
  const [activeMultiviewEditLayer, setActiveMultiviewEditLayer] = useState<number | null>(null);

  // Theme Designer State
  const [isThemeDesignerOpen, setIsThemeDesignerOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<ThemeDefinition | null>(null);
  const [cameraThemeMap, setCameraThemeMap] = useState<Record<number, string>>(state.cameraThemeMap || {});
  const [inputSettings, setInputSettings] = useState<Record<number, InputSetting>>(state.inputSettings || {});

  // Per-camera audio levels for the stereo meters
  const audioContextsRef = useRef<Record<number, { ctx: AudioContext, analyser: AnalyserNode, source: MediaElementAudioSourceNode, gainNode: GainNode }>>({});

  useEffect(() => {
    patchState({
      outputInputId,
      previewInputId,
      layerToCameraMap,
      cameraThemeMap,
      cameraMultiviews,
      cameraInputs,
      inputSettings,
    });
  }, [outputInputId, previewInputId, layerToCameraMap, cameraThemeMap, cameraMultiviews, cameraInputs, inputSettings]);

  // Subscribe to live network streams from main process
  useEffect(() => {
    const api = window.electron as any;
    if (api.getNetworkStreams) {
      api.getNetworkStreams().then(setNetworkStreams).catch(console.error);
    }
    if (api.onNetworkStreamsUpdated) {
      return api.onNetworkStreamsUpdated((s: any[]) => setNetworkStreams(s));
    }
  }, []);

  const handleCameraLayerToggle = (cameraId: number, layer: number) => {
    setLayerToCameraMap(prev => {
      const next = { ...prev };
      // If this camera already has this layer, just deselect it
      if (next[layer] === cameraId) {
        delete next[layer];
        return next;
      }
      // Remove any existing layer this camera already occupies (one layer per camera)
      for (const key of Object.keys(next)) {
        if (next[Number(key)] === cameraId) {
          delete next[Number(key)];
        }
      }
      // Assign the new layer to this camera
      next[layer] = cameraId;
      return next;
    });
  };

  const handleMasterLayerToggle = (layer: number) => {
    setLayerToCameraMap(prev => {
      const next = { ...prev };
      if (next[layer]) delete next[layer];
      return next;
    });
  };

  const handleAddCamera = () => {
    const nextId = Math.max(0, ...cameraInputs.map(c => c.id)) + 1;
    setCameraInputs([...cameraInputs, { id: nextId, name: `INPUT ${nextId}`, live: false, type: "Camera" }]);
  };

  const handleRemoveCamera = (cameraId: number) => {
    setCameraInputs(prev => prev.filter(c => c.id !== cameraId));
    if (previewInputId === cameraId) setPreviewInputId(null);
    if (outputInputId === cameraId) setoutputInputId(null);
    setLayerToCameraMap(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[Number(key)] === cameraId) delete next[Number(key)];
      }
      return next;
    });
  };

  const getInputSettings = (id: number): InputSetting => {
    const cam = cameraInputs.find(c => c.id === id);
    return inputSettings[id] || {
      name: cam?.name || `INPUT ${id}`,
      volume: 100, solo: false, muted: false, deinterlace: "None",
      brightness: 0, contrast: 0, saturation: 0, hue: 0, gamma: 1,
      chromaEnabled: false, chromaColor: "#00ff00", chromaKey: 0, chromaKeyFilterEnabled: false, chromaKeyFilter: 0, chromaAntiAliasing: "Low", chromaRed: 0, chromaGreen: 0, chromaBlue: 0, lumaKey: 0, keyFillInputId: "None",
      panX: 0, panY: 0, zoom: 1, zoomX: 1, zoomY: 1, rotation: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
      triggerOnStart: "", triggerOnStop: "", triggerOnLoop: "",
      tallyEnabled: false, tallyPort: 0,
    };
  };


  const updateInputSetting = (id: number, key: string, value: any) => {
    setInputSettings(prev => ({
      ...prev,
      [id]: { ...getInputSettings(id), ...prev[id], [key]: value }
    }));
  };

  const applyVideoPlayback = (cameraId: number, shouldPlay: boolean): void => {
    const videos = document.querySelectorAll<HTMLVideoElement>(
      `video[data-input-id="${cameraId}"]`,
    );

    videos.forEach(video => {
      if (shouldPlay) {
        void video.play().catch(() => { });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  };

  const toggleVideoPlayback = (cameraId: number): void => {
    const cam = cameraInputs.find(c => c.id === cameraId);
    if (cam?.type !== "Video" || !cam.mediaPath) {
      return;
    }

    const nextPlaying = !(videoPlaybackState[cameraId] ?? false);
    patchState({
      videoPlaybackState: {
        ...(state.videoPlaybackState || {}),
        [cameraId]: nextPlaying
      }
    } as any);
    applyVideoPlayback(cameraId, nextPlaying);
  };

  const toggleAudioMute = (cameraId: number): void => {
    const isMuted = state.audioMutedState?.[cameraId] ?? true;
    patchState({
      audioMutedState: {
        ...(state.audioMutedState || {}),
        [cameraId]: !isMuted
      }
    } as any);
  };

  const renderInputMedia = (cameraId: number | null, depth = 0, isMuted = true): React.ReactNode => {
    if (cameraId === null || depth > 3) return null;
    const cam = cameraInputs.find(c => c.id === cameraId);
    if (!cam) return <span className="font-mono text-[10px] text-[#3c4a42]">NO SIGNAL</span>;

    let themeIdForCamera: string | null | undefined = cameraThemeMap[cameraId];
    let themeForCamera = themeIdForCamera ? (state.customThemes || []).find(t => t.id === themeIdForCamera) : undefined;

    if (!themeForCamera) {
      if (cam.type === "Scripture") {
        themeForCamera = (state.customThemes || []).find(t => t.id === state.defaultThemeId_SCRIPTURES);
      } else if (cam.type === "Lyrics") {
        themeForCamera = (state.customThemes || []).find(t => t.id === state.defaultThemeId_LYRICS);
      } else if (cam.type === "Timer") {
        themeForCamera = (state.customThemes || []).find(t => t.id === state.defaultThemeId_TIMER);
      }
    }

    const isTransparentTheme = themeForCamera?.backgroundStyle === "TRANSPARENT";

    // Also check inputSettings for mediaPath (before save is clicked)
    let effectiveMediaPath = cam.mediaPath || inputSettings[cameraId]?.mediaPath;
    const effectiveType = cam.type || inputSettings[cameraId]?.type || 'Camera';
    const effectiveMuted = isMuted || (state.audioMutedState?.[cam.id] ?? true);

    let mediaContent: React.ReactNode = null;
    if (effectiveType === "Image" && effectiveMediaPath) {
      mediaContent = <img src={effectiveMediaPath} alt="" className="w-full h-full object-contain" data-input-id={cam.id} data-input-kind="image" />;
    } else if (effectiveType === "Video" && effectiveMediaPath) {
      mediaContent = (
        <video
          key={`video-${cam.id}-${effectiveMediaPath}`}
          src={effectiveMediaPath}
          className="w-full h-full object-contain"
          loop
          playsInline
          autoPlay={state.videoPlaybackState?.[cam.id] ?? false}
          muted={effectiveMuted}
          data-input-id={cam.id}
          data-input-kind="video"
          onTimeUpdate={(e) => {
            if (!window.electron?.syncVideoTime) return;
            const video = e.currentTarget;
            const now = performance.now();
            const lastSync = (video as any)._lastSyncTime || 0;
            if (now - lastSync > 1000) {
              (video as any)._lastSyncTime = now;
              window.electron.syncVideoTime(cam.id, video.currentTime);
            }
          }}
        />
      );
    } else if (cam.type === "Scripture") {
      mediaContent = (
        <div className="w-full h-full pointer-events-none">
          <OutputCanvas
            compact
            indicatorLabel=""
            indicatorTone="preview"
            forceThemeId={state.defaultThemeId_SCRIPTURES ?? undefined}
            forceTransparentBg={isTransparentTheme}
          />
        </div>
      );
    } else if (cam.type !== "Camera" && cam.type !== "Virtual Set" && cam.type !== "NDI") {
      mediaContent = (
        <span className="font-mono text-[10px] text-[#4edea3]/30 flex items-center justify-center w-full h-full">
          {cam.type} {cam.id}
        </span>
      );
    } else if (effectiveType === "Camera" && effectiveMediaPath) {
      mediaContent = (
        <LiveCamera
          deviceId={effectiveMediaPath}
          className="w-full h-full object-cover"
          muted={effectiveMuted}
          data-input-id={cam.id}
          data-input-kind="camera"
        />
      );
    } else {
      // Default camera placeholder
      mediaContent = (
        <div className="w-full h-full bg-[#111] flex items-center justify-center text-[#333] font-mono text-[10px] font-bold">
          CAMERA {cam.id}
        </div>
      );
    }

    const posSettings = inputSettings[cameraId];
    const camZoom = posSettings?.zoom ?? 1;
    const camZoomX = posSettings?.zoomX ?? 1;
    const camZoomY = posSettings?.zoomY ?? 1;
    const camPanX = posSettings?.panX ?? 0;
    const camPanY = posSettings?.panY ?? 0;
    const camRotate = posSettings?.rotation ?? 0;
    const camCropL = posSettings?.cropLeft ?? 0;
    const camCropR = posSettings?.cropRight ?? 0;
    const camCropT = posSettings?.cropTop ?? 0;
    const camCropB = posSettings?.cropBottom ?? 0;
    const hasPosTransform = camZoom !== 1 || camZoomX !== 1 || camZoomY !== 1 || camPanX !== 0 || camPanY !== 0 || camRotate !== 0 || camCropL !== 0 || camCropR !== 0 || camCropT !== 0 || camCropB !== 0;

    let baseContent = (
      <div className="relative w-full h-full overflow-hidden">
        {!(isTransparentTheme && cam.type !== "Scripture") && (
          <div
            className="absolute inset-0"
            style={hasPosTransform ? {
              transform: `translate(${camPanX * 50}%, ${camPanY * 50}%) scale(${camZoom * camZoomX}, ${camZoom * camZoomY}) rotate(${camRotate}deg)`,
              clipPath: `inset(${camCropT * 100}% ${camCropR * 100}% ${camCropB * 100}% ${camCropL * 100}%)`,
              transformOrigin: "center center",
              transition: "transform 0.05s linear, clip-path 0.05s linear",
            } : undefined}
          >
            {inputSettings[cameraId]?.chromaEnabled ? (
              <MediaChromaWrapper
                node={mediaContent}
                settings={{
                  enabled: inputSettings[cameraId].chromaEnabled,
                  keyColor: hexToRgb(inputSettings[cameraId].chromaColor),
                  chromaKey: inputSettings[cameraId].chromaKey,
                  chromaKeyFilterEnabled: inputSettings[cameraId].chromaKeyFilterEnabled,
                  chromaKeyFilter: inputSettings[cameraId].chromaKeyFilter,
                  antiAliasing: inputSettings[cameraId].chromaAntiAliasing as any,
                  red: inputSettings[cameraId].chromaRed,
                  green: inputSettings[cameraId].chromaGreen,
                  blue: inputSettings[cameraId].chromaBlue,
                  lumaKey: inputSettings[cameraId].lumaKey || 0
                }}
                showCheckerboard={false}
              />
            ) : (
              mediaContent
            )}
          </div>
        )}
        {themeIdForCamera && (
          <div className="absolute inset-0 pointer-events-none">
            <OutputCanvas compact indicatorLabel="" indicatorTone="preview" forceThemeId={themeIdForCamera} forceTransparentBg={isTransparentTheme} />
          </div>
        )}
      </div>
    );


    const multiviews = cameraMultiviews[cameraId];
    if (!multiviews || Object.keys(multiviews).length === 0) {
      return baseContent;
    }

    return (
      <div className="relative w-full h-full overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">{baseContent}</div>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(layerIndex => {
          const childId = multiviews[layerIndex];
          if (childId && childId !== cameraId) {
            return (
              <div key={layerIndex} className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {renderInputMedia(childId, depth + 1)}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  useEffect(() => {
    for (const [cameraIdKey, shouldPlay] of Object.entries(videoPlaybackState)) {
      const cameraId = Number(cameraIdKey);
      if (Number.isNaN(cameraId)) continue;

      const videos = document.querySelectorAll<HTMLVideoElement>(
        `video[data-input-id="${cameraId}"]`,
      );

      videos.forEach((video) => {
        if (shouldPlay) {
          void video.play().catch(() => { });
        } else {
          video.pause();
          video.currentTime = 0;
        }
      });
    }
  }, [videoPlaybackState, cameraInputs, previewInputId, outputInputId]);

  // Dynamic audio level monitoring for each camera's video
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    const measure = () => {
      cameraInputs.forEach(cam => {
        const videoEl = document.querySelector<HTMLVideoElement>(`video[data-input-id="${cam.id}"]`);
        let leftLevel = 0;
        let rightLevel = 0;

        if (videoEl && !videoEl.paused && !videoEl.ended && videoEl.readyState >= 2) {
          try {
            let entry = audioContextsRef.current[cam.id];
            if (!entry) {
              const ctx = new AudioContext();
              const source = ctx.createMediaElementSource(videoEl);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.6;
              const gainNode = ctx.createGain();
              source.connect(analyser); // Analyser gets full signal before gain
              analyser.connect(gainNode);
              gainNode.connect(ctx.destination);
              entry = { ctx, analyser, source, gainNode };
              audioContextsRef.current[cam.id] = entry;
            }

            // --- 1. Mute/Gain Control ---
            // Only output audio if it's on the main output or is a layer on the output screen
            const isMainOutput = outputInputId === cam.id || Object.values(layerToCameraMap).includes(cam.id);
            const settings = inputSettings[cam.id] || { volume: 100, solo: false, muted: false };

            if (settings.muted || !isMainOutput) {
              entry.gainNode.gain.value = 0;
            } else {
              entry.gainNode.gain.value = settings.volume / 100;
            }

            // --- 2. Audio Meter Calculation ---
            const data = new Uint8Array(entry.analyser.frequencyBinCount);
            entry.analyser.getByteFrequencyData(data); // Use frequency data for Peak

            let peak = 0;
            for (let i = 0; i < data.length; i++) {
              if (data[i] > peak) peak = data[i];
            }

            // Peak is 0-255, level is 0.0-1.0
            const level = peak / 255;

            // Simulate stereo with slight variation
            leftLevel = Math.min(1, level + (Math.random() * 0.05));
            rightLevel = Math.min(1, level + (Math.random() * 0.05));
          } catch {
            // Audio context failed to initialize or read
          }
        }

        // Update DOM directly to avoid ControlPanel re-render
        const leftMeter = document.getElementById(`meter-left-${cam.id}`);
        const rightMeter = document.getElementById(`meter-right-${cam.id}`);
        if (leftMeter) leftMeter.style.height = `${leftLevel * 100}%`;
        if (rightMeter) rightMeter.style.height = `${rightLevel * 100}%`;
      });

      timerId = setTimeout(measure, 66);
    };
    timerId = setTimeout(measure, 66);
    return () => clearTimeout(timerId);
  }, [cameraInputs, outputInputId, layerToCameraMap, inputSettings]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchTimeMs(prev => prev + 100);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountdownRunning) {
      interval = setInterval(() => {
        setCountdownTimeMs(prev => Math.max(0, prev - 100));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isCountdownRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLiveTimerActive) {
      interval = setInterval(() => {
        let text = "";
        let ref = "";
        if (productionTab === 'COUNTDOWN') {
          text = formatTime(countdownTimeMs, true);
          ref = "COUNTDOWN";
        } else if (productionTab === 'STOPWATCH') {
          text = formatTime(stopwatchTimeMs, false);
          ref = "STOPWATCH";
        } else if (productionTab === 'TIME') {
          text = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
          ref = "TIME";
        }
        patchState({
          currentTextOutput: text,
          currentReferenceOutput: ref,
        } as any);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isLiveTimerActive, productionTab, countdownTimeMs, stopwatchTimeMs, patchState]);

  useEffect(() => {
    if (!isLiveTimerActive && (state.currentReferenceOutput === "COUNTDOWN" || state.currentReferenceOutput === "STOPWATCH" || state.currentReferenceOutput === "TIME")) {
      patchState({
        currentTextOutput: "",
        currentReferenceOutput: "",
      } as any);
    }
  }, [isLiveTimerActive]);

  const formatTime = (ms: number, isCountdown = false) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const micro = Math.floor((ms % 1000) / 10);
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (isCountdown && hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(micro)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}:${pad(micro)}`;
  };

  const handleLivePress = () => {
    setIsLiveTimerActive(prev => !prev);
    if (!isLiveTimerActive) {
      setActiveTab("TIMER");
    }
  };

  const handleOpenThemeDesigner = () => {
    setEditingTheme(null);
    setIsThemeDesignerOpen(true);
  };

  const getScriptureThemeTemplate = (): ThemeDefinition => {
    const defaultScriptureTheme =
      (state.customThemes || []).find(
        (theme) =>
          theme.tabType === "SCRIPTURES" &&
          theme.id === state.defaultThemeId_SCRIPTURES,
      ) ??
      (state.customThemes || []).find((theme) => theme.tabType === "SCRIPTURES");

    return (
      defaultScriptureTheme ?? {
        id: "scripture-theme-template",
        name: "Scripture Theme",
        tabType: "SCRIPTURES",
        lowerThirdStyle: state.scriptureLowerThirdStyle,
        backgroundStyle: state.backgroundStyle,
        backgroundTexture: state.backgroundTexture,
        backgroundImagePath: state.backgroundImagePath,
        backgroundPositionX: state.backgroundPositionX,
        backgroundPositionY: state.backgroundPositionY,
        textPositionX: state.textPositionX,
        textPositionY: state.textPositionY,
        fillType: "Linear Gradient",
        scale: 100,
        entranceAnimation: "Slide Up",
        animationDuration: 0.8,
        animationCurve: "Ease-Out",
      }
    );
  };

  const createScriptureThemeFromRecord = (record: ScriptureRecord): ThemeDefinition => {
    const template = getScriptureThemeTemplate();

    return {
      ...template,
      id: `scripture-${record.bookShort}-${record.chapter}-${record.verse}-${Date.now()}`,
      name: `${toReference(record)} Theme`,
      tabType: "SCRIPTURES",
    };
  };

  const handleEditTheme = (theme: ThemeDefinition) => {
    setEditingTheme(theme);
    setIsThemeDesignerOpen(true);
  };

  const handleEditScriptureResultTheme = (record: ScriptureRecord) => {
    setActiveTab("SCRIPTURES");
    setCurrentReferenceOutput(toReference(record));
    setCurrentTextOutput(record.text);
    setEditingTheme(createScriptureThemeFromRecord(record));
    setIsThemeDesignerOpen(true);
  };

  const handlePreviewUpdate = (theme: ThemeDefinition) => {
    // Only update if it's the currently active theme, otherwise we just update the preview version of it
    const existingThemes = state.customThemes || [];
    const existingIndex = existingThemes.findIndex((t) => t.id === theme.id);
    let nextThemes: ThemeDefinition[];
    if (existingIndex >= 0) {
      nextThemes = existingThemes.map((t, i) => (i === existingIndex ? theme : t));
    } else {
      nextThemes = [...existingThemes, theme];
    }
    patchState({ customThemes: nextThemes } as any);
  };

  const handleSaveTheme = (theme: ThemeDefinition) => {
    const existingThemes = state.customThemes || [];
    const existingIndex = existingThemes.findIndex((t) => t.id === theme.id);
    let nextThemes: ThemeDefinition[];
    if (existingIndex >= 0) {
      nextThemes = existingThemes.map((t, i) => (i === existingIndex ? theme : t));
    } else {
      nextThemes = [...existingThemes, theme];
    }
    patchState({ customThemes: nextThemes } as any);
    void window.electron?.saveAppSettings?.({ customThemes: nextThemes });
    if (
      theme.tabType === "SCRIPTURES" &&
      !nextThemes.some((item) => item.id === state.defaultThemeId_SCRIPTURES)
    ) {
      patchState({ defaultThemeId_SCRIPTURES: theme.id } as any);
      void window.electron?.saveAppSettings?.({
        defaultThemeId_SCRIPTURES: theme.id,
      });
    }
    setIsThemeDesignerOpen(false);
    setEditingTheme(null);
    setStatusMessage(`Theme "${theme.name}" saved for ${theme.tabType}.`);
  };

  const handleDeleteTheme = (themeId: string) => {
    const existingThemes = state.customThemes || [];
    const nextThemes = existingThemes.filter((t) => t.id !== themeId);
    patchState({ customThemes: nextThemes } as any);
    void window.electron?.saveAppSettings?.({ customThemes: nextThemes });
    if (state.defaultThemeId_SCRIPTURES === themeId) {
      const nextScriptureDefault =
        nextThemes.find((theme) => theme.tabType === "SCRIPTURES")?.id ?? null;
      patchState({ defaultThemeId_SCRIPTURES: nextScriptureDefault } as any);
      void window.electron?.saveAppSettings?.({
        defaultThemeId_SCRIPTURES: nextScriptureDefault,
      });
    }
    setStatusMessage("Theme deleted.");
  };

  const handleSetDefaultTheme = (themeId: string, tabType: "SCRIPTURES" | "LYRICS" | "TIMER") => {
    const key = `defaultThemeId_${tabType}` as const;
    patchState({ [key]: themeId } as any);
    void window.electron?.saveAppSettings?.({ [key]: themeId });
    const theme = (state.customThemes || []).find((t) => t.id === themeId);
    setStatusMessage(`"${theme?.name || "Theme"}" set as default for ${tabType}.`);
  };

  const selectedOutputCount =
    state.selectedOutputIds.length ||
    availableOutputs.filter((output) => output.selected).length;
  const lastAnalyzedTranscriptRef = useRef("");
  const lastNavigationCommandRef = useRef({ key: "", timestamp: 0 });
  const audioAnalysisInFlightRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const voskStatusLabel = isAudioListening
    ? "Listening"
    : state.isAutoDisplayMode
      ? "Starting"
      : "Idle";
  const isVoskActive = isAudioListening || state.isAutoDisplayMode;

  useEffect(() => {
    const handleSearchResults = (event: Event) => {
      const customEvent = event as CustomEvent<{ results: ScriptureRecord[] }>;
      if (customEvent.detail?.results) {
        setSearchResults(customEvent.detail.results);
      }
    };
    window.addEventListener("scriptureSearchResults", handleSearchResults);
    return () => window.removeEventListener("scriptureSearchResults", handleSearchResults);
  }, []);

  const inputGainRef = useRef(inputGain);
  const isAutoDisplayModeRef = useRef(state.isAutoDisplayMode);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    inputGainRef.current = inputGain;
  }, [inputGain]);

  useEffect(() => {
    isAutoDisplayModeRef.current = state.isAutoDisplayMode;
  }, [state.isAutoDisplayMode]);
  const handleOpenSettings = (): void => {
    onOpenSettings();
  };

  const toggleAutoDisplayMode = async (): Promise<void> => {
    lastAnalyzedTranscriptRef.current = "";
    if (state.isAutoDisplayMode) {
      setIsAutoDisplayMode(false);
      if (!state.isScriptureParaphraseMode) {
        await stopListening();
        setIsAudioListening(false);
        setStatusMessage("Voice control (VOSK) stopped.");
      } else {
        setStatusMessage("Scripture reference display disabled. Paraphrase listening remains active.");
      }
      return;
    }

    setStatusMessage("Starting scripture reference listening (VOSK)...");
    setIsAutoDisplayMode(true);

    try {
      if (!isAudioListening) {
        await startListening("assets/vosk-models/vosk-model-small-en-us-0.15");
        setIsAudioListening(true);
      }
      setStatusMessage("Scripture reference listening is active.");
    } catch (error) {
      setIsAutoDisplayMode(false);
      setIsAudioListening(false);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Voice control could not start.",
      );
    }
  };

  const toggleScriptureParaphraseMode = async (): Promise<void> => {
    lastAnalyzedTranscriptRef.current = "";

    if (state.isScriptureParaphraseMode) {
      patchState({ isScriptureParaphraseMode: false });
      if (!state.isAutoDisplayMode) {
        await stopListening();
        setIsAudioListening(false);
        setStatusMessage("Voice control (VOSK) stopped.");
      } else {
        setStatusMessage("Scripture paraphrase listening disabled. Reference listening remains active.");
      }
      return;
    }

    setStatusMessage("Starting scripture paraphrase listening (VOSK)...");
    patchState({ isScriptureParaphraseMode: true });

    try {
      if (!isAudioListening) {
        await startListening("assets/vosk-models/vosk-model-small-en-us-0.15");
        setIsAudioListening(true);
      }
      setStatusMessage("Scripture paraphrase listening is active.");
    } catch (error) {
      patchState({ isScriptureParaphraseMode: false });
      setIsAudioListening(false);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Scripture paraphrase listening could not start.",
      );
    }
  };

  const handleGoLiveToggle = async (): Promise<void> => {
    const nextLive = !state.isLiveMode;

    if (!nextLive) {
      patchState({ isLiveMode: false });
      setStatusMessage("Live output stand-by.");
      return;
    }

    // Attempt to automatically select an output if none is selected
    if (state.selectedOutputIds.length === 0) {
      const fetchedOutputs = await window.electron?.fetchAvailableOutputs() ?? [];
      const fallbackOutputs = fetchedOutputs
        .filter((output) => output.kind === "DISPLAY" || output.kind === "NDI")
        .slice(0, 1)
        .map((output) => output.id);

      patchState({
        selectedOutputIds: fallbackOutputs,
        isLiveMode: true,
      });
    } else {
      patchState({ isLiveMode: true });
    }

    setStatusMessage("Go live armed.");
  };

  const semanticMatches = useMemo(() => {
    if (searchResults.length > 0) {
      return searchResults.slice(0, 4).map((result, index) => ({
        id: `${result.translation}-${result.id}-${index}`,
        reference: toReference(result),
        text: result.text,
        score: Math.max(63, 98 - index * 11),
        record: result,
      }));
    }

    return [
      {
        id: "default-match-primary",
        reference: state.currentReferenceOutput || "John 3:16",
        text: state.currentTextOutput || "For God so loved...",
        score: 98,
        record: null,
      },
      {
        id: "default-match-secondary",
        reference: "Romans 8:28",
        text: "And we know that in all...",
        score: 72,
        record: null,
      },
    ];
  }, [searchResults, state.currentReferenceOutput, state.currentTextOutput]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        await refreshAvailableTranslations();
        await refreshAvailableOutputs();
      } finally {
        // Any other ready logic
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!searchQuery && isTruthyString(state.currentReferenceOutput)) {
      setSearchQuery(state.currentReferenceOutput);
    }
  }, [searchQuery, state.currentReferenceOutput]);

  const displayScriptureRecord = (
    record: ScriptureRecord,
    source = "Scripture loaded",
  ): void => {
    setIsLiveTimerActive(false);
    const reference = toReference(record);
    setActiveTab("SCRIPTURES");
    setCurrentReferenceOutput(reference);
    setCurrentTextOutput(record.text);
    setSearchQuery(reference);
    setStatusMessage(`${source}: ${reference}.`);
  };

  const runSearch = async (
    queryOverride?: string,
    translationOverride?: string,
  ): Promise<ScriptureRecord[]> => {
    const query = (queryOverride ?? searchQuery).trim();
    const translation = translationOverride ?? state.currentBibleTranslation;

    if (!query) {
      setSearchResults([]);
      setStatusMessage("Enter a scripture reference to search.");
      return [];
    }

    setIsSearching(true);

    try {
      const results = await searchScriptures(query, translation);

      startTransition(() => setSearchResults(results));

      if (results.length > 0) {
        const firstResult = results[0];
        displayScriptureRecord(firstResult, "Preview updated");
        setStatusMessage(
          `${results.length} semantic match${results.length === 1 ? "" : "es"} loaded from ${translation}.`,
        );

        // Try to synthesize the first matching verse via Polly (if configured).
        try {
          if (!isSpeakingRef.current && (window.electron as any)?.synthesizePolly) {
            isSpeakingRef.current = true;
            const pollyResp = await (window.electron as any).synthesizePolly(
              firstResult.text,
            );

            if (pollyResp && (pollyResp as any).audioBase64) {
              const audio = new Audio(
                `data:audio/mp3;base64,${(pollyResp as any).audioBase64}`,
              );
              audio.play().catch(() => { });
            }
          }
        } catch (err) {
          console.warn("Polly synthesis failed:", err);
        } finally {
          isSpeakingRef.current = false;
        }
      } else {
        setStatusMessage(
          `No scripture match found in ${translation} for "${query}".`,
        );
      }

      return results;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown scripture search error.";
      setStatusMessage(message);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigateScripture = async (
    direction: ScriptureNavigationDirection,
  ): Promise<void> => {
    const reference = cleanNavigationReference(
      state.currentReferenceOutput.trim() || searchQuery.trim(),
    );

    if (!reference) {
      setStatusMessage(
        "Load a scripture before using chapter and verse navigation.",
      );
      return;
    }

    const nextRecord = await navigateScripture(
      reference,
      direction,
      state.currentBibleTranslation,
    );

    if (!nextRecord) {
      setStatusMessage(
        "No adjacent scripture found in the current translation.",
      );
      return;
    }

    displayScriptureRecord(nextRecord, "Navigation");
  };

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (event.key === "Enter") {
      void runSearch();
    }
  };

  const handleAudioDeviceChange = (deviceId: string): void => {
    lastAnalyzedTranscriptRef.current = "";
    setSpeechTranscript("");
    setSelectedAudioDeviceId(deviceId || "default");
    setStatusMessage("Audio input device selected.");
  };

  const handleTranslationChange = (translation: string): void => {
    lastAnalyzedTranscriptRef.current = "";
    setCurrentBibleTranslation(translation);

    // Strip any trailing translation tag from the reference (e.g. "John 3:16 KJV" → "John 3:16")
    // so the reference parser can correctly identify the book/chapter/verse.
    const rawRef = state.currentReferenceOutput || searchQuery;
    const cleanRef = rawRef
      .trim()
      .replace(/\s+[A-Z][A-Z0-9]+\s*$/, "") // strip trailing translation abbreviation (e.g. "KJV", "ESV", "NIV84")
      .trim();

    if (cleanRef) {
      void runSearch(cleanRef, translation);
    }
  };

  const toggleOutputTarget = (outputId: string): void => {
    const nextSelected = state.selectedOutputIds.includes(outputId)
      ? state.selectedOutputIds.filter((id) => id !== outputId)
      : [...state.selectedOutputIds, outputId];

    setSelectedOutputIds(nextSelected);
    void window.electron?.saveAppSettings?.({
      selectedOutputIds: nextSelected,
    });
    void refreshAvailableOutputs(nextSelected);
  };

  const handleImportBible = async (): Promise<void> => {
    setIsImporting(true);

    try {
      const result = await triggerBibleImport();

      if (result.canceled) {
        setStatusMessage("Bible import cancelled.");
        return;
      }

      if (result.success) {
        await refreshAvailableTranslations();
        await refreshAvailableOutputs();

        if (isTruthyString(result.translation)) {
          setCurrentBibleTranslation(result.translation);
        }

        setStatusMessage(
          `${result.translation ?? "Translation"} installed with ${result.count} verse records.`,
        );
      } else {
        setStatusMessage(result.error ?? "Bible import failed.");
      }
    } finally {
      setIsImporting(false);
    }
  };

  const chooseTheme = (theme: ThemeType): void => {
    setActiveTheme(theme);
    setStatusMessage(
      `${theme.replace("_", " ")} theme armed for Bible output.`,
    );
  };

  const handleAutoTranscript = (transcript: string, source: string): void => {
    if (inputGainRef.current <= 0) {
      return;
    }

    const normalizedTranscript = transcript.replace(/\s+/g, " ").trim();
    const normalizedKey = normalizedTranscript.toLowerCase();

    if (!normalizedTranscript || normalizedTranscript.length < 2) {
      return;
    }

    const navigationCommand =
      transcriptToNavigationCommand(normalizedTranscript);

    if (navigationCommand) {
      const now = Date.now();
      const commandKey = `${navigationCommand}:${normalizedKey}`;

      if (
        lastNavigationCommandRef.current.key === commandKey &&
        now - lastNavigationCommandRef.current.timestamp < 900
      ) {
        return;
      }

      lastNavigationCommandRef.current = {
        key: commandKey,
        timestamp: now,
      };
      setSpeechTranscript(normalizedTranscript);
      setStatusMessage(
        `Voice navigation: ${navigationCommand.replace("_", " ")}.`,
      );
      void handleNavigateScripture(navigationCommand);
      return;
    }

    if (normalizedKey === lastAnalyzedTranscriptRef.current) {
      return;
    }

    lastAnalyzedTranscriptRef.current = normalizedKey;
    setSpeechTranscript(normalizedTranscript);
    setSearchQuery(normalizedTranscript);
    setStatusMessage(
      `Auto-display heard "${normalizedTranscript}" from ${source}.`,
    );
    void runSearch(normalizedTranscript, state.currentBibleTranslation);
  };

  const getAudioRecorderMimeType = (): string => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];

    return (
      candidates.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      ) ?? ""
    );
  };

  const getSelectedAudioConstraints = (): MediaTrackConstraints => ({
    ...(selectedAudioDeviceId
      ? {
        deviceId:
          selectedAudioDeviceId === "default"
            ? "default"
            : { exact: selectedAudioDeviceId },
      }
      : {}),
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
  });

  useEffect(() => {
    inputGainRef.current = inputGain;
  }, [inputGain]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const loadMediaDevices = async (): Promise<void> => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
      setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
    };

    void loadMediaDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadMediaDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadMediaDevices);
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setInputLevel(0);
      setInputLevelDb(-60);
      return;
    }

    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    const startMeter = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: getSelectedAudioConstraints(),
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const gain = audioContext.createGain();
        const analyser = audioContext.createAnalyser();

        gain.gain.value = inputGain / 100;
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        const samples = new Uint8Array(analyser.fftSize);
        source.connect(gain);
        gain.connect(analyser);

        const tick = (): void => {
          analyser.getByteTimeDomainData(samples);

          let sumSquares = 0;
          for (const sample of samples) {
            const centered = (sample - 128) / 128;
            sumSquares += centered * centered;
          }

          const rms = Math.sqrt(sumSquares / samples.length);
          const adjustedRms = inputGain <= 0 ? 0 : rms * (inputGain / 100);
          const db =
            inputGain <= 0
              ? -60
              : clampNumber(20 * Math.log10(adjustedRms || 0.000001), -60, 0);
          const level = clampNumber(((db + 60) / 60) * 100, 0, 100);
          // Update DOM directly to avoid re-rendering the entire ControlPanel
          const levelText = document.getElementById('input-level-db');
          const levelBar = document.getElementById('input-level-bar');
          if (levelText) levelText.textContent = `${Math.round(db)}dB`;
          if (levelBar) levelBar.style.width = `${level}%`;
          animationFrame = window.setTimeout(tick, 66) as unknown as number;
        };

        tick();
      } catch {
        const levelText = document.getElementById('input-level-db');
        const levelBar = document.getElementById('input-level-bar');
        if (levelText) levelText.textContent = `-60dB`;
        if (levelBar) levelBar.style.width = `0%`;
      }
    };

    void startMeter();

    return () => {
      cancelled = true;
      window.clearTimeout(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [selectedAudioDeviceId, inputGain]);

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-[#131316] font-sans text-[#e4e1e6] text-[10px]">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[#3c4a42] bg-[#131316] px-3">
        <div className="flex items-center gap-4 h-full">
          <h1 className="font-display-lg text-xl tracking-tight">
            <span className="font-bold text-white">Hallelujah</span>
            <span className="text-[#10b981]">Beamer</span>
          </h1>
          <nav className="flex h-full items-center gap-4 pt-1">
            {["Dashboard", "Monitors", "Patching", "Logs"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={joinClasses(
                  "h-full border-b-2 px-1 text-[10px] font-semibold transition",
                  index === 0
                    ? "border-[#4edea3] text-[#4edea3]"
                    : "border-transparent text-[#bbcabf] hover:text-[#e4e1e6]"
                )}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex h-full items-center gap-2">
          <button
            type="button"
            onClick={() => void handleGoLiveToggle()}
            className={joinClasses(
              "h-7 min-w-[6rem] border px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition active:scale-[0.99]",
              state.isLiveMode
                ? "border-[#4edea3] bg-[#4edea3] text-[#003824]"
                : "border-[#4edea3] bg-[#4edea3] text-[#003824] hover:brightness-110"
            )}
          >
            {state.isLiveMode ? "ON AIR" : "GO LIVE"}
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            className="grid h-7 w-7 place-items-center border border-transparent font-mono text-[9px] font-bold uppercase text-[#bbcabf] transition hover:border-[#3c4a42] hover:text-[#4edea3]"
          >
            SET
          </button>
          <button className="grid h-7 w-7 place-items-center border border-transparent font-mono text-[9px] font-bold uppercase text-[#bbcabf] transition hover:border-[#3c4a42] hover:text-[#4edea3]">ALT</button>
          <button className="grid h-7 w-7 place-items-center border border-transparent font-mono text-[9px] font-bold uppercase text-[#bbcabf] transition hover:border-[#3c4a42] hover:text-[#4edea3]">ID</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-12 shrink-0 flex-col justify-between border-r border-[#3c4a42] bg-[#1b1b1e]">
          <div>
            <div className="flex flex-col items-center gap-1 border-b border-[#3c4a42] py-2">
              <button
                onClick={() => setActiveRail("CN")}
                className={joinClasses(
                  "grid h-6 w-6 place-items-center rounded font-mono text-[9px] font-bold transition",
                  activeRail === "CN" ? "bg-amber-500 text-[#131316]" : "bg-[#353438] text-[#bbcabf]"
                )}
              >
                CN
              </button>
              <div className="text-center font-mono text-[8px] leading-tight">
                <div>Control</div>
                <div>Node 01</div>
                <div className="text-[#4edea3] mt-0.5">Online</div>
              </div>
            </div>
            <nav className="flex flex-col items-center gap-1 py-2">
              {RAIL_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.label === "Settings") {
                      handleOpenSettings();
                    } else if (item.icon === "LYR" || item.icon === "MAC") {
                      setActiveRail(item.icon);
                    }
                  }}
                  className={joinClasses(
                    "flex w-10 flex-col items-center gap-1 border py-1.5 transition",
                    activeRail === item.icon
                      ? "border-amber-500 bg-amber-500 text-[#131316]"
                      : "border-transparent text-[#bbcabf] hover:border-[#3c4a42] hover:bg-[#2a2a2d]"
                  )}
                >
                  <span className="font-mono text-[9px] font-bold">{item.icon}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="flex flex-col items-center gap-2 pb-2">
            <button className="w-10 bg-[#ef4444] text-[#fff] font-mono text-[7px] font-bold py-1 px-0.5 leading-none">E-STOP</button>
            <button className="w-6 h-6 border border-[#3c4a42] text-[#bbcabf] rounded-full flex items-center justify-center font-bold text-[10px]">?</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-px bg-[#3c4a42]">

          <div className="flex min-h-0 flex-1 gap-px">
            <section className="flex w-52 shrink-0 flex-col gap-px bg-[#3c4a42]">
              
              <div className="bg-[#1f1f22] flex flex-col shrink-0">
                <div className="bg-[#2a2a2d] px-2 py-1.5 border-b border-[#3c4a42]">
                  <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#e4e1e6]">Media Settings</h2>
                </div>
                <div className="p-2 space-y-2">
                  <label className="block">
                    <span className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#bbcabf]">Audio Input</span>
                    <select
                      value={selectedAudioDeviceId}
                      onChange={(e) => handleAudioDeviceChange(e.target.value)}
                      className="h-7 w-full border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] text-[#e4e1e6] outline-none"
                    >
                      <option value="default">System Default</option>
                      {audioDevices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Input ${i + 1}`}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 flex justify-between font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#bbcabf]">
                      <span>Volume</span><span>{inputGain}%</span>
                    </span>
                    <input
                      className="h-1 w-full appearance-none rounded-full accent-[#4edea3]"
                      type="range" min={0} max={200} value={inputGain}
                      onChange={(e) => setInputGain(Number(e.target.value))}
                    />
                  </label>
                  <div>
                    <div className="mb-1 flex justify-between font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#bbcabf]">
                      <span>Level</span><span id="input-level-db">-60dB</span>
                    </div>
                    <div className="h-1 border border-[#3c4a42] bg-[#131316]"><div id="input-level-bar" className="h-full bg-[#4edea3]" style={{ width: `0%` }} /></div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGoLiveToggle()}
                    className="flex h-7 w-full items-center justify-between border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] font-bold uppercase text-[#e4e1e6]"
                  >
                    <span>Go Live</span><StatusLed active={state.isLiveMode} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleAutoDisplayMode()}
                    className="flex h-7 w-full items-center justify-between border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] font-bold uppercase text-[#e4e1e6]"
                  >
                    <span>Display Scripture</span>
                    <span className={joinClasses("relative h-4 w-8 rounded-full", state.isAutoDisplayMode ? "bg-[#10b981]" : "bg-[#353438]")}>
                      <span className={joinClasses("absolute top-0.5 h-3 w-3 rounded-full bg-[#bbcabf] transition-transform", state.isAutoDisplayMode ? "left-4.5" : "left-0.5")} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleScriptureParaphraseMode()}
                    className="flex h-7 w-full items-center justify-between border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] font-bold uppercase text-[#e4e1e6]"
                  >
                    <span>Paraphrase Scripture</span>
                    <span className={joinClasses("relative h-4 w-8 rounded-full", state.isScriptureParaphraseMode ? "bg-[#10b981]" : "bg-[#353438]")}>
                      <span className={joinClasses("absolute top-0.5 h-3 w-3 rounded-full bg-[#bbcabf] transition-transform", state.isScriptureParaphraseMode ? "left-4.5" : "left-0.5")} />
                    </span>
                  </button>

                </div>
              </div>

              <div className="relative flex-1 overflow-hidden min-h-0">
                <div className={joinClasses(
                  "flex flex-col gap-px w-full h-full absolute inset-0 transition-transform duration-300 ease-in-out overflow-y-auto",
                  activeRail === "LYR" ? "-translate-y-full" : "translate-y-0"
                )}>
                  <div className="flex flex-col bg-[#1f1f22] p-2 gap-2 shrink-0">
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#bbcabf]">Bible Controls</div>
                <div className="flex items-center gap-1">
                  <select
                    value={state.currentBibleTranslation}
                    onChange={(e) => handleTranslationChange(e.target.value)}
                    className="h-7 flex-1 bg-black border border-[#3c4a42] px-2 font-mono text-[9px] text-[#e4e1e6] outline-none"
                  >
                    {availableTranslations.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={() => void runSearch()} className="h-7 px-2 border border-[#10b981] bg-[#10b981]/10 text-[#4edea3] font-mono text-[9px] font-bold uppercase">SRCH</button>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search..."
                  className="h-7 w-full bg-black border border-[#3c4a42] px-2 font-mono text-[9px] text-[#e4e1e6] outline-none focus:border-[#4edea3]"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[
                    ["<<", "PREVIOUS_CHAPTER"],
                    ["<", "PREVIOUS_VERSE"],
                    [">", "NEXT_VERSE"],
                    [">>", "NEXT_CHAPTER"]
                  ].map(([symbol, direction]) => (
                    <button
                      key={symbol}
                      onClick={() => void handleNavigateScripture(direction as ScriptureNavigationDirection)}
                      className="h-7 bg-[#1f1f22] border border-[#3c4a42] font-mono text-[10px] text-[#e4e1e6] hover:border-[#4edea3]"
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setVerseHoldFlag(!state.verseHoldFlag)}
                  className={joinClasses("h-7 flex justify-between items-center px-2 border font-mono text-[9px] font-bold uppercase mt-1", state.verseHoldFlag ? "border-[#ee9800] text-[#ffb95f]" : "border-[#3c4a42] text-[#bbcabf]")}
                >
                  <span>Verse Lock (V)</span>
                  <span className="border px-1 py-0.5 text-[7px] leading-none border-current">{state.verseHoldFlag ? "LOCK" : "OPEN"}</span>
                </button>
              </div>

              <div className="mt-auto p-2 bg-[#1f1f22]">
                <div className="font-mono text-[8px] text-[#bbcabf] font-bold">VOSK ACTIVE</div>
                <div className={joinClasses("mt-1 font-mono text-[8px] font-bold uppercase", isVoskActive ? "text-[#4edea3]" : "text-[#bbcabf]")}>
                  {voskStatusLabel}
                </div>
              </div>
              </div>

            <div className={joinClasses(
                "flex flex-col gap-px w-full h-full absolute inset-0 transition-transform duration-300 ease-in-out",
                activeRail === "LYR" ? "translate-y-0" : "translate-y-full"
              )}>
              <LyricsPanel onLyricSelect={setSelectedLyric} activeRail={activeRail} refreshTrigger={lyricsRefreshTrigger} />
            </div>
          </div>
        </section>

            <section className="flex min-w-0 flex-1 flex-col gap-px bg-[#3c4a42]">

              <div className="flex h-56 shrink-0 bg-[#131316] p-2 gap-2 justify-center border-b border-[#3c4a42]">
                <div className="w-[30%] max-w-[320px] flex flex-col bg-[#1f1f22] border border-[#f59e0b]">
                  <div className="flex justify-between items-center px-2 py-0.5 bg-[#f59e0b] text-[#000]">
                    <span className="font-mono text-[9px] font-bold uppercase">Preview</span>
                    <span className="text-[10px]">⚙</span>
                  </div>
                  <div className={joinClasses("m-auto w-full aspect-[16/9] relative overflow-hidden flex items-center justify-center", (() => {
                    if (previewInputId === null) return "bg-black";
                    const cam = cameraInputs.find(c => c.id === previewInputId);
                    if (!cam) return "bg-black";
                    let themeIdForCam: string | null | undefined = cameraThemeMap[cam.id];
                    if (cam.type === "Scripture") themeIdForCam = state.defaultThemeId_SCRIPTURES;
                    else if (cam.type === "Lyrics") themeIdForCam = state.defaultThemeId_LYRICS;
                    else if (cam.type === "Timer") themeIdForCam = state.defaultThemeId_TIMER;
                    const t = state.customThemes?.find(th => th.id === themeIdForCam);
                    return t?.backgroundStyle === "TRANSPARENT" ? "checkerboard-bg" : "bg-black";
                  })())}>
                    {previewInputId !== null ? renderInputMedia(previewInputId) : (
                      <span className="font-mono text-[10px] text-[#3c4a42]">NO PREVIEW</span>
                    )}
                  </div>
                  {previewInputId !== null && cameraInputs.find(c => c.id === previewInputId)?.type === "Video" && (
                    <VideoMiniControls
                      cameraId={previewInputId}
                      isPlaying={videoPlaybackState[previewInputId] ?? false}
                      onTogglePlay={toggleVideoPlayback}
                    />
                  )}
                </div>

                <div className="w-16 bg-[#1f1f22] flex flex-col justify-center items-center p-1 gap-1 shrink-0 border border-[#3c4a42]">
                  <div className="font-mono text-[7px] text-[#e4e1e6] text-center border border-[#3c4a42] bg-[#2a2a2d] w-full py-0.5">Transition</div>
                  <button onClick={() => { if (previewInputId !== null) setoutputInputId(previewInputId); }} className="bg-[#4edea3] text-[#003824] h-6 w-full font-mono text-[8px] font-bold hover:bg-[#6ffbbe] transition-colors">Quick Play</button>
                  <button onClick={() => { if (previewInputId !== null) setoutputInputId(previewInputId); }} className="bg-[#353438] text-[#e4e1e6] h-5 w-full font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Cut</button>
                  <button onClick={() => { if (previewInputId !== null) setoutputInputId(previewInputId); }} className="bg-[#353438] text-[#e4e1e6] h-5 w-full font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Fade</button>
                  <button onClick={() => { if (previewInputId !== null) setoutputInputId(previewInputId); }} className="bg-[#353438] text-[#e4e1e6] h-5 w-full font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Wipe</button>
                  <button onClick={() => { if (previewInputId !== null) setoutputInputId(previewInputId); }} className="bg-[#353438] text-[#e4e1e6] h-5 w-full font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Fly</button>
                  <button onClick={() => { setoutputInputId(null); }} className="bg-[#353438] text-[#e4e1e6] h-5 w-full font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">FTB</button>
                </div>

                <div className="w-[30%] max-w-[320px] flex flex-col bg-[#1f1f22] border border-[#ef4444]">
                  <div className="flex justify-between items-center px-2 py-0.5 bg-[#ef4444] text-[#fff]">
                    <span className="font-mono text-[9px] font-bold uppercase">Output</span>
                    <span className="text-[10px]">⚙</span>
                  </div>
                  <div className={joinClasses("m-auto w-full aspect-[16/9] relative overflow-hidden flex items-center justify-center", (() => {
                    if (outputInputId === null) return "bg-black";
                    const cam = cameraInputs.find(c => c.id === outputInputId);
                    if (!cam) return "bg-black";
                    let themeIdForCam: string | null | undefined = cameraThemeMap[cam.id];
                    if (cam.type === "Scripture") themeIdForCam = state.defaultThemeId_SCRIPTURES;
                    else if (cam.type === "Lyrics") themeIdForCam = state.defaultThemeId_LYRICS;
                    else if (cam.type === "Timer") themeIdForCam = state.defaultThemeId_TIMER;
                    const t = state.customThemes?.find(th => th.id === themeIdForCam);
                    return t?.backgroundStyle === "TRANSPARENT" ? "checkerboard-bg" : "bg-black";
                  })())}>
                    {/* Base: single outputInputId if set */}
                    {outputInputId !== null && (
                      <div className="absolute inset-0">{renderInputMedia(outputInputId, 0, false)}</div>
                    )}
                    {/* Stacked layers from layerToCameraMap (layer 1 at bottom, 8 on top) */}
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(layerNum => {
                      const camId = layerToCameraMap[layerNum];
                      if (camId === undefined) return null;
                      return (
                        <div key={layerNum} className="absolute inset-0" style={{ zIndex: layerNum }}>
                          {renderInputMedia(camId)}
                        </div>
                      );
                    })}
                    {/* Show BLACK label only if nothing is assigned */}
                    {outputInputId === null && Object.keys(layerToCameraMap).length === 0 && (
                      <span className="font-mono text-[10px] text-[#3c4a42]">BLACK</span>
                    )}
                  </div>
                  {outputInputId !== null && cameraInputs.find(c => c.id === outputInputId)?.type === "Video" && (
                    <VideoMiniControls
                      cameraId={outputInputId}
                      isPlaying={videoPlaybackState[outputInputId] ?? false}
                      onTogglePlay={toggleVideoPlayback}
                    />
                  )}
                </div>
              </div>

              <div className="bg-[#1f1f22] p-2 flex items-center justify-between border-b border-[#3c4a42]">
                <div className="flex gap-1 items-center">
                  <div className="w-2.5 h-2.5 bg-[#ef4444]"></div>
                  <div className="w-2.5 h-2.5 bg-[#3b82f6]"></div>
                  <div className="w-2.5 h-2.5 bg-[#22c55e]"></div>
                  <div className="w-2.5 h-2.5 bg-[#eab308]"></div>
                </div>
                <div className="flex gap-1 items-center">
                  <input type="text" className="h-7 w-48 bg-black border border-[#3c4a42] px-2 font-mono text-[9px] text-[#e4e1e6]" placeholder="Search inputs..." />
                  <button onClick={handleAddCamera} className="bg-[#4edea3] text-[#003824] h-7 px-3 font-mono text-[9px] font-bold">ADD</button>
                  <button className="bg-[#353438] text-[#e4e1e6] h-7 px-3 font-mono text-[9px] border border-[#3c4a42] hover:bg-[#2a2a2d]">SETTINGS</button>
                </div>
              </div>

              <div className="flex flex-1 min-h-[15rem] gap-px bg-[#3c4a42]">
                <div className="flex-1 overflow-y-auto bg-[#131316] p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {cameraInputs.map(cam => (
                      <div key={cam.id} className="bg-[#1f1f22] border border-black flex flex-col min-w-[240px]">
                        {/* Title Bar (Orange) */}
                        <div className="flex justify-between items-center px-2 py-1 bg-[#F58A2B]">
                          <div className="flex items-center gap-2 font-sans font-semibold text-[13px] text-white">
                            <span>{cam.id}</span>
                            <span className="truncate max-w-[12rem]">{cam.name}</span>
                          </div>
                          <div className="flex gap-2 text-white">
                            <button onClick={() => handleRemoveCamera(cam.id)} className="hover:text-gray-200 leading-none text-[14px] font-bold">×</button>
                          </div>
                        </div>

                        {/* Preview Area & Audio Meters */}
                        {(() => {
                          let themeIdForCam: string | null | undefined = cameraThemeMap[cam.id];
                          if (cam.type === "Scripture") themeIdForCam = state.defaultThemeId_SCRIPTURES;
                          else if (cam.type === "Lyrics") themeIdForCam = state.defaultThemeId_LYRICS;
                          else if (cam.type === "Timer") themeIdForCam = state.defaultThemeId_TIMER;
                          const themeForCamera = state.customThemes?.find(t => t.id === themeIdForCam);
                          const isTransparentTheme = themeForCamera?.backgroundStyle === "TRANSPARENT";
                          return (
                            <div className={joinClasses("flex relative", isTransparentTheme ? "checkerboard-bg" : "bg-black")}>
                              <div
                                className="flex-1 aspect-video relative cursor-pointer group overflow-hidden flex items-center justify-center"
                                onClick={() => setPreviewInputId(cam.id)}
                              >
                                {renderInputMedia(cam.id)}

                                {/* Realtime Theme Preview overlay - only if a theme is set for this camera */}
                                {cameraThemeMap[cam.id] && (
                                  <div className="absolute inset-0 pointer-events-none">
                                    <OutputCanvas compact={true} forceTransparentBg={true} forceThemeId={cameraThemeMap[cam.id]} />
                                  </div>
                                )}

                                {previewInputId === cam.id && (
                                  <div className="absolute inset-0 border-2 border-[#22c55e] pointer-events-none"></div>
                                )}
                                {outputInputId === cam.id && (
                                  <div className="absolute inset-0 border-2 border-[#ef4444] pointer-events-none"></div>
                                )}
                              </div>

                              {/* Audio Meters (Right edge) - Dynamic */}
                              <div className="w-3 bg-[#0a0a0a] flex gap-[1px] p-[1px] pt-1 pb-1 border-l border-[#333]">
                                <div className="w-1.5 h-full bg-[#111] rounded-sm overflow-hidden flex items-end">
                                  <div id={`meter-left-${cam.id}`} className="w-full bg-gradient-to-t from-[#22c55e] via-[#4ade80] to-[#ef4444] transition-all duration-100" style={{ height: '0%' }}></div>
                                </div>
                                <div className="w-1.5 h-full bg-[#111] rounded-sm overflow-hidden flex items-end">
                                  <div id={`meter-right-${cam.id}`} className="w-full bg-gradient-to-t from-[#22c55e] via-[#4ade80] to-[#ef4444] transition-all duration-100" style={{ height: '0%' }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Control Bar (Two Columns: Numbers Left, Actions Right) */}
                        <div className="flex bg-[#222222] border-t border-black h-[48px]">
                          {/* Left: Numbers Grid */}
                          <div className="w-1/2 grid grid-cols-4 grid-rows-2 gap-[1px] bg-black p-[1px] border-r border-black">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                              <button
                                key={i}
                                onClick={() => handleCameraLayerToggle(cam.id, i)}
                                className={joinClasses(
                                  "font-sans font-semibold text-[11px] flex items-center justify-center leading-none transition-colors",
                                  layerToCameraMap[i] === cam.id ? "bg-[#22c55e] text-white font-bold" : "bg-[#2A2A2A] text-gray-400 hover:bg-[#333333] hover:text-white"
                                )}
                              >{i}</button>
                            ))}
                          </div>

                          {/* Right: Actions Grid */}
                          <div className="w-1/2 grid grid-cols-4 grid-rows-2 gap-[1px] bg-black p-[1px]">
                            {/* Top Row */}
                            <button className="bg-[#2A2A2A] text-gray-300 font-sans font-semibold text-[10px] hover:bg-[#333] hover:text-white flex items-center justify-center col-span-2">GO (FADE)</button>
                            <button className="bg-[#2A2A2A] text-gray-300 font-sans font-semibold text-[10px] hover:bg-[#333] hover:text-white flex items-center justify-center col-span-1">CUT</button>
                            <button className="bg-[#2A2A2A] text-gray-300 hover:bg-[#333] hover:text-white flex items-center justify-center col-span-1" title="Repeat/Loop">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>
                            </button>

                            {/* Bottom Row */}
                            <button
                              onClick={() => toggleAudioMute(cam.id)}
                              className={joinClasses(
                                "font-sans font-semibold text-[10px] flex items-center justify-center col-span-1",
                                !(state.audioMutedState?.[cam.id] ?? true) ? "bg-[#ef4444] text-white hover:bg-red-600" : "bg-[#2A2A2A] text-gray-300 hover:bg-[#333] hover:text-white"
                              )}
                            >
                              Audio
                            </button>
                            <button
                              onClick={() => toggleVideoPlayback(cam.id)}
                              className="bg-[#2A2A2A] text-gray-300 hover:bg-[#333] hover:text-white flex items-center justify-center col-span-1" title="Play/Stop"
                            >
                              {(videoPlaybackState[cam.id] ?? false) ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                              )}
                            </button>
                            <button onClick={() => setPreviewInputId(cam.id)} className="bg-[#2A2A2A] text-gray-300 hover:bg-[#333] hover:text-white flex items-center justify-center col-span-1" title="Display Preview">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                            </button>
                            <button onClick={() => setSettingsDialogInputId(cam.id)} className="bg-[#2A2A2A] text-gray-300 hover:bg-[#333] hover:text-white flex items-center justify-center col-span-1" title="Settings">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"></path></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-16 bg-[#1f1f22] flex flex-col items-center p-1 gap-0.5 shrink-0 border-l border-[#3c4a42]">
                  <div className="font-mono text-[7px] text-[#e4e1e6] text-center border border-[#3c4a42] bg-[#2a2a2d] w-full py-0.5 mb-0.5">Master Layers</div>
                  <div className="grid grid-cols-2 gap-px w-full mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <button
                        key={i}
                        onClick={() => handleMasterLayerToggle(i)}
                        className={joinClasses(
                          "border border-[#3c4a42] h-6 font-mono text-[8px] font-bold flex justify-center items-center transition-colors",
                          masterActiveLayers.has(i) ? "bg-[#f59e0b] text-[#000]" : "bg-[#1f1f22] text-[#bbcabf] hover:bg-[#2a2a2d]"
                        )}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 flex justify-center py-0.5 w-full">
                    <div className="w-2 h-full bg-black border border-[#3c4a42] relative rounded-sm">
                      <div className="absolute top-[40%] left-0 right-0 h-2 bg-[#e4e1e6] rounded-sm"></div>
                    </div>
                  </div>
                  <div className="text-center font-mono text-[7px] text-[#4edea3]">{formatTime(countdownTimeMs, true)}</div>
                  <div className="text-center font-mono text-[7px] text-[#bbcabf]">{new Date().toLocaleTimeString('en-US', { hour12: true, hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>

              <div className="flex flex-1 min-h-0 gap-px bg-[#3c4a42] relative overflow-hidden">
                <div className={joinClasses(
                  "flex flex-1 min-h-0 gap-px absolute inset-0 transition-transform duration-300 ease-in-out",
                  activeRail === "LYR" ? "-translate-y-full" : "translate-y-0"
                )}>
                  <div className="flex-1 bg-[#1f1f22] flex flex-col min-w-0">
                  <div className="flex border-b border-[#3c4a42] items-center px-2">
                    {["SCRIPTURES", "LYRICS", "TIMER"].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={joinClasses(
                          "px-3 h-8 font-mono text-[8px] font-bold uppercase transition",
                          activeTab === tab ? "text-[#4edea3] border-b-2 border-[#4edea3]" : "text-[#bbcabf] hover:bg-[#2a2a2d]"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                    <button onClick={handleOpenThemeDesigner} className="ml-auto text-[#4edea3] font-bold text-[12px] hover:text-[#6ffbbe] transition-colors" title={`Add ${activeTab} theme`}>+</button>
                  </div>
                  <div className="flex-1 p-2 overflow-y-auto bg-[#131316]">
                    {activeTab === "SCRIPTURES" && (
                      <>
                        {/* Theme cards for Scriptures */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {(state.customThemes || []).filter(t => t.tabType === "SCRIPTURES").map(theme => {
                            const isDefault = (state as any).defaultThemeId_SCRIPTURES === theme.id;
                            return (
                              <div key={theme.id} className={joinClasses("flex flex-col", isDefault ? "border border-[#4edea3] bg-[#10b981]/5" : "bg-[#1f1f22] border border-[#3c4a42]")}>
                                <div className={joinClasses("w-full aspect-[16/9] relative border-b border-[#3c4a42]", theme.backgroundStyle === "TRANSPARENT" ? "checkerboard-bg" : "bg-black")}>
                                  <OutputCanvas compact indicatorLabel="" forceThemeId={theme.id} overrideText="Praise the LORD" overrideReference="Psalm 150:6" forceTransparentBg={theme.backgroundStyle === "TRANSPARENT"} />
                                  {isDefault && <div className="absolute top-1 left-1 bg-[#10b981] text-black text-[6px] font-bold px-1 py-0.5 rounded shadow">DEFAULT</div>}
                                </div>
                                <div className="p-1.5 flex flex-col justify-center text-center">
                                  <div className={joinClasses("text-[8px] font-bold uppercase truncate", isDefault ? "text-[#4edea3]" : "text-[#bbcabf]")}>{theme.name}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-px p-px bg-[#3c4a42]">
                                  <button onClick={() => handleSetDefaultTheme(theme.id, "SCRIPTURES")} className={joinClasses("h-5 font-mono text-[7px]", isDefault ? "bg-[#10b981]/20 text-[#4edea3]" : "bg-[#1f1f22] hover:bg-[#353438] text-[#e4e1e6]")}>SET</button>
                                  <button onClick={() => handleEditTheme(theme)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#e4e1e6]">EDIT</button>
                                  <button onClick={() => handleDeleteTheme(theme.id)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#e4e1e6]">DEL</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Scripture search results — raw text only */}
                        {searchResults.length > 0 && (
                          <div className="space-y-1">
                            {searchResults.map((result) => (
                              <div key={result.id} className="flex items-start gap-2 px-2 py-1.5 border border-[#3c4a42] bg-[#1f1f22] hover:bg-[#2a2a2d] cursor-pointer" onClick={() => displayScriptureRecord(result, "Set")}>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[#4edea3] text-[7px] font-bold uppercase">{result.bookFull} {result.chapter}:{result.verse}</div>
                                  <div className="text-[#e4e1e6] text-[8px] leading-tight mt-0.5">{result.text}</div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); displayScriptureRecord(result, "Set"); }} className="shrink-0 bg-[#353438] hover:bg-[#10b981]/20 hover:text-[#4edea3] h-5 px-2 font-mono text-[7px] text-[#e4e1e6] border border-[#3c4a42]">SET</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {searchResults.length === 0 && (state.customThemes || []).filter(t => t.tabType === "SCRIPTURES").length === 0 && (
                          <div className="flex items-center justify-center w-full text-[#bbcabf] text-[9px]">Tap + to add a Scripture theme</div>
                        )}
                      </>
                    )}
                    {activeTab === "LYRICS" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {(state.customThemes || []).filter(t => t.tabType === "LYRICS").map(theme => {
                            const isDefault = (state as any).defaultThemeId_LYRICS === theme.id;
                            return (
                              <div key={theme.id} className={joinClasses("flex flex-col", isDefault ? "border border-[#4edea3] bg-[#10b981]/5" : "bg-[#1f1f22] border border-[#3c4a42]")}>
                                <div className={joinClasses("w-full aspect-[16/9] relative border-b border-[#3c4a42]", theme.backgroundStyle === "TRANSPARENT" ? "checkerboard-bg" : "bg-black")}>
                                  <OutputCanvas compact indicatorLabel="" forceThemeId={theme.id} overrideText="Amazing Grace" overrideReference="Chorus" forceTransparentBg={theme.backgroundStyle === "TRANSPARENT"} />
                                  {isDefault && <div className="absolute top-1 left-1 bg-[#10b981] text-black text-[6px] font-bold px-1 py-0.5 rounded shadow">DEFAULT</div>}
                                </div>
                                <div className="p-1.5 flex flex-col justify-center text-center">
                                  <div className={joinClasses("text-[8px] font-bold uppercase truncate", isDefault ? "text-[#4edea3]" : "text-[#bbcabf]")}>{theme.name}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-px p-px bg-[#3c4a42]">
                                  <button onClick={() => handleSetDefaultTheme(theme.id, "LYRICS")} className={joinClasses("h-5 font-mono text-[7px]", isDefault ? "bg-[#10b981]/20 text-[#4edea3]" : "bg-[#1f1f22] hover:bg-[#353438] text-[#e4e1e6]")}>SET</button>
                                  <button onClick={() => handleEditTheme(theme)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#e4e1e6]">EDIT</button>
                                  <button onClick={() => handleDeleteTheme(theme.id)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#e4e1e6]">DEL</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {(state.customThemes || []).filter(t => t.tabType === "LYRICS").length === 0 && (
                          <div className="flex items-center justify-center w-full text-[#bbcabf] text-[9px]">Tap + to add a Lyrics theme</div>
                        )}
                      </>
                    )}
                    {activeTab === "TIMER" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {(state.customThemes || []).filter(t => t.tabType === "TIMER").map(theme => {
                            const isDefault = (state as any).defaultThemeId_TIMER === theme.id;
                            return (
                              <div key={theme.id} className={joinClasses("flex flex-col", isDefault ? "border border-[#4edea3] bg-[#10b981]/5" : "bg-[#1f1f22] border border-[#3c4a42]")}>
                                <div className="p-2 flex-1 flex flex-col justify-center text-center">
                                  <div className={joinClasses("text-[7px] font-bold mb-1 uppercase", isDefault ? "text-[#4edea3]" : "text-[#bbcabf]")}>{theme.name}</div>
                                  <div className="text-[#e4e1e6] text-[7px] leading-tight">{theme.lowerThirdStyle} • {theme.entranceAnimation}</div>
                                  {isDefault && <div className="text-[6px] text-[#4edea3] mt-1 font-bold">★ DEFAULT</div>}
                                </div>
                                <div className="grid grid-cols-3 gap-px p-px bg-[#3c4a42]">
                                  <button onClick={() => handleSetDefaultTheme(theme.id, "TIMER")} className={joinClasses("h-5 font-mono text-[7px]", isDefault ? "bg-[#10b981]/20 text-[#4edea3]" : "bg-[#1f1f22] hover:bg-[#353438] text-[#e4e1e6]")}>SET</button>
                                  <button onClick={() => handleEditTheme(theme)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#e4e1e6]">EDIT</button>
                                  <button onClick={() => handleDeleteTheme(theme.id)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#e4e1e6]">DEL</button>
                                </div>
                              </div>
                            );
                          })}
                          {isLiveTimerActive && (
                            <div className="bg-[#1f1f22] border border-[#10b981] flex flex-col">
                              <div className="p-2 flex-1 flex flex-col items-center justify-center text-center">
                                <div className="text-[#4edea3] text-[8px] font-bold mb-1 uppercase">LIVE {productionTab}</div>
                                <div className="text-[#e4e1e6] text-[14px] font-mono">
                                  {productionTab === 'COUNTDOWN' && formatTime(countdownTimeMs, true)}
                                  {productionTab === 'STOPWATCH' && formatTime(stopwatchTimeMs, false)}
                                  {productionTab === 'TIME' && new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-px p-px bg-[#3c4a42]">
                                <button onClick={() => setIsLiveTimerActive(false)} className="bg-[#1f1f22] hover:bg-[#353438] h-5 font-mono text-[7px] text-[#ef4444]">STOP LIVE TIMER</button>
                              </div>
                            </div>
                          )}
                        </div>
                        {(state.customThemes || []).filter(t => t.tabType === "TIMER").length === 0 && !isLiveTimerActive && (
                          <div className="flex items-center justify-center w-full text-[#bbcabf] text-[9px]">Tap + to add a Timer theme</div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="w-[12rem] bg-[#1f1f22] flex flex-col shrink-0">
                  <div className="px-2 py-1.5 border-b border-[#3c4a42]">
                    <h2 className="font-mono text-[9px] font-bold text-[#e4e1e6]">Output Monitor Matrix</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[#3c4a42] p-px flex-1 overflow-y-auto">
                    {availableOutputs.map(out => (
                      <div key={out.id} className="bg-[#0d1410] flex flex-col min-h-[3.5rem]">
                        <div className="flex justify-between px-1.5 py-0.5 bg-[#131316] border-b border-[#3c4a42]">
                          <span className="font-mono text-[7px] text-[#e4e1e6] font-bold truncate">{out.label}</span>
                          <span className={joinClasses("font-mono text-[7px] font-bold", state.selectedOutputIds.includes(out.id) ? "text-[#4edea3]" : "text-[#bbcabf]")}>
                            {state.selectedOutputIds.includes(out.id) ? "LIVE" : "IDLE"}
                          </span>
                        </div>
                        <div className="flex-1 flex items-center justify-center text-[#353438] text-[7px] font-mono">Preview</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-[15rem] bg-[#1f1f22] flex flex-col shrink-0">
                  <div className="px-2 py-1.5 border-b border-[#3c4a42]">
                    <h2 className="font-mono text-[9px] font-bold text-[#e4e1e6]">Production Control</h2>
                  </div>
                  <div className="p-2 flex flex-col flex-1 gap-1.5 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-1">
                      <button className="h-6 bg-[#ef4444] text-white font-mono text-[8px] font-bold flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white"></span> RECORD</button>
                      <button className="h-6 bg-[#10b981] text-[#003824] font-mono text-[8px] font-bold">STREAM LIVE</button>
                    </div>

                    <div className="flex gap-px">
                      {[["Countdown", "COUNTDOWN"], ["Current Time", "TIME"], ["Stopwatch", "STOPWATCH"]].map(([label, key]) => (
                        <button
                          key={key}
                          onClick={() => setProductionTab(key as any)}
                          className={joinClasses(
                            "flex-1 h-5 font-mono text-[7px] font-bold uppercase border",
                            productionTab === key ? "bg-[#4edea3] text-[#003824] border-[#4edea3]" : "bg-[#131316] text-[#bbcabf] border-[#3c4a42]"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="h-10 bg-[#0a1a10] border border-[#2a5a3a] flex items-center justify-center font-mono text-[20px] text-[#4edea3] font-bold tracking-wider relative">
                      {productionTab === "COUNTDOWN" && (
                        <>
                          {!isCountdownRunning && countdownTimeMs === initialCountdownMs ? (
                            <div className="flex gap-1 text-[14px]">
                              <div className="flex items-center"><input type="number" value={countdownHours} onChange={e => { setCountdownHours(Math.max(0, parseInt(e.target.value) || 0)); setCountdownTimeMs((Math.max(0, parseInt(e.target.value) || 0) * 3600 + countdownMinutes * 60 + countdownSeconds) * 1000); }} className="w-6 bg-transparent text-center border-b border-[#4edea3] outline-none" min="0" />h</div>
                              <div className="flex items-center"><input type="number" value={countdownMinutes} onChange={e => { setCountdownMinutes(Math.max(0, parseInt(e.target.value) || 0)); setCountdownTimeMs((countdownHours * 3600 + Math.max(0, parseInt(e.target.value) || 0) * 60 + countdownSeconds) * 1000); }} className="w-6 bg-transparent text-center border-b border-[#4edea3] outline-none" min="0" max="59" />m</div>
                              <div className="flex items-center"><input type="number" value={countdownSeconds} onChange={e => { setCountdownSeconds(Math.max(0, parseInt(e.target.value) || 0)); setCountdownTimeMs((countdownHours * 3600 + countdownMinutes * 60 + Math.max(0, parseInt(e.target.value) || 0)) * 1000); }} className="w-6 bg-transparent text-center border-b border-[#4edea3] outline-none" min="0" max="59" />s</div>
                            </div>
                          ) : (
                            <span>{formatTime(countdownTimeMs, true)}</span>
                          )}
                        </>
                      )}
                      {productionTab === "TIME" && (
                        <span className="text-[16px]">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      )}
                      {productionTab === "STOPWATCH" && (
                        <span>{formatTime(stopwatchTimeMs, false)}</span>
                      )}
                    </div>

                    <div className="bg-[#0e0e11] border border-[#3c4a42] p-1.5 flex-1 min-h-0">
                      <div className="font-mono text-[7px] text-[#bbcabf] mb-1 uppercase tracking-wider">Target Selection:</div>
                      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                        {["HDMI 1", "OMT 1", "OMT 2", "NDI A", "USB", "Pastor"].map(target => (
                          <label key={target} className="flex items-center gap-1 font-mono text-[7px] text-[#e4e1e6] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTargets.includes(target)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedTargets([...selectedTargets, target]);
                                else setSelectedTargets(selectedTargets.filter(t => t !== target));
                              }}
                              className="accent-[#4edea3] w-2 h-2"
                            />
                            <span className="truncate">{target}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (productionTab === 'STOPWATCH') setIsStopwatchRunning(!isStopwatchRunning);
                          if (productionTab === 'COUNTDOWN') setIsCountdownRunning(!isCountdownRunning);
                        }}
                        className="flex-1 h-7 bg-[#1f1f22] border border-[#3c4a42] text-[#e4e1e6] font-mono text-[9px] font-bold hover:bg-[#353438]"
                      >
                        {(productionTab === 'STOPWATCH' && isStopwatchRunning) || (productionTab === 'COUNTDOWN' && isCountdownRunning) ? "PAUSE" : "START"}
                      </button>
                      <button
                        onClick={() => {
                          if (productionTab === 'STOPWATCH') { setIsStopwatchRunning(false); setStopwatchTimeMs(0); }
                          if (productionTab === 'COUNTDOWN') { setIsCountdownRunning(false); setCountdownTimeMs(initialCountdownMs); }
                        }}
                        className="flex-1 h-7 bg-[#1f1f22] border border-[#3c4a42] text-[#e4e1e6] font-mono text-[9px] font-bold hover:bg-[#353438]"
                      >
                        STOP
                      </button>
                      <button
                        onClick={() => handleLivePress()}
                        className="w-14 h-7 bg-[#10b981]/10 border border-[#10b981] text-[#4edea3] font-mono text-[9px] font-bold hover:bg-[#10b981] hover:text-[#003824] transition-colors"
                      >
                        LIVE
                      </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={joinClasses(
                    "flex flex-col gap-px w-full h-full absolute inset-0 transition-transform duration-300 ease-in-out",
                    activeRail === "LYR" ? "translate-y-0" : "translate-y-full"
                  )}>
                  <LyricsEditorPane selectedLyric={selectedLyric} onSendToTheme={handleSendLyricToTheme} onSaveLyric={handleSaveLyric} onDeleteLyric={handleDeleteLyric} />
                </div>
              </div>

            </section>

            <section className="flex w-64 shrink-0 flex-col gap-px bg-[#3c4a42]">
              <div className="flex-1 bg-[#1f1f22] flex flex-col min-h-0">
                <div className="bg-[#1f1f22] px-2 py-2 border-b border-[#3c4a42] shrink-0">
                  <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#bbcabf]">AI Real-Time Semantic Parsing</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#131316]">
                  {semanticMatches.map((match, i) => (
                    <div key={match.id} className={joinClasses("p-2 border", i === 0 ? "border-[#10b981] bg-[#10b981]/5" : "border-[#3c4a42] bg-[#131316]")} onClick={() => { if (match.record) displayScriptureRecord(match.record, "Semantic match selected"); }}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-mono text-[9px] font-bold text-[#e4e1e6] truncate">{match.reference}</div>
                        <div className={joinClasses("px-1.5 py-0.5 rounded text-[8px] font-mono border", i === 0 ? "border-[#10b981] text-[#4edea3]" : "border-[#3c4a42] text-[#bbcabf]")}>{match.score}%</div>
                      </div>
                      <div className="text-[8px] text-[#bbcabf] truncate line-clamp-1">{match.text}</div>
                      {i === 0 && <div className="h-0.5 bg-[#10b981] w-full mt-2"></div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-[#1f1f22] flex flex-col min-h-0 border-t border-[#3c4a42]">
                <div className="bg-[#1f1f22] px-2 py-2 border-b border-[#3c4a42] shrink-0">
                  <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#bbcabf]">Output History Queue</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-[9px] text-[#bbcabf] space-y-1.5 bg-[#1f1f22]">
                  <div className="flex gap-2"><span>10:42:01</span><span className="text-[#e4e1e6]">[SYSTEM] Init OK</span></div>
                  <div className="flex gap-2"><span>10:45:12</span><span className="text-[#4edea3]">[LIVE] 1 Chronicles 2:30 KJV</span></div>
                  <div className="flex gap-2"><span>10:48:33</span><span className="text-[#4edea3]">[LIVE] 0 outputs</span></div>
                </div>
              </div>

              <div className="bg-[#131316] p-2 text-right">
                <span className="font-mono text-[8px] text-[#eab308] font-bold uppercase">Voice Control (Vosk) is Active.</span>
              </div>
            </section>
          </div>

          <footer className="h-6 shrink-0 bg-[#0e0e11] flex items-center px-2 justify-between border-t border-[#3c4a42] font-mono text-[8px] text-[#bbcabf]">
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#e4e1e6]">ADD INPUT</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-[#ef4444] rounded-full"></div>
                <span className="text-[#e4e1e6]">REC 00:18:06</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Live network stream indicators */}
              <div className="flex items-center gap-2">
                {networkStreams.length === 0 ? (
                  <span className="text-[#3c4a42]">NO STREAMS</span>
                ) : (
                  networkStreams.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <span className={joinClasses(
                        "w-1.5 h-1.5 rounded-full",
                        s.status === 'ONLINE' || s.status === 'IN-USE' ? 'bg-[#4edea3]' : 'bg-[#3c4a42]'
                      )}></span>
                      <span className={s.status === 'IN-USE' ? 'text-[#4edea3]' : 'text-[#bbcabf]'}>{s.protocol}: {s.name}</span>
                    </div>
                  ))
                )}
              </div>
              <span>FPS: 60 • GPU: 15% • CPU: 12%</span>
              <span className="text-[#4edea3] font-bold uppercase">STREAMING</span>
            </div>
          </footer>
        </div>
        {settingsDialogInputId !== null && (
          <InputSettingsDialog
            sid={settingsDialogInputId}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            onClose={() => setSettingsDialogInputId(null)}
            cameraInputs={cameraInputs}
            setCameraInputs={setCameraInputs}
            inputSettings={inputSettings}
            updateInputSetting={updateInputSetting}
            getInputSettings={getInputSettings}
            cameraMultiviews={cameraMultiviews}
            setCameraMultiviews={setCameraMultiviews}
            activeMultiviewEditLayer={activeMultiviewEditLayer}
            setActiveMultiviewEditLayer={setActiveMultiviewEditLayer}
            state={state}
            patchState={patchState}
            computeAutoChromaSettings={computeAutoChromaSettings}
            hexToRgb={hexToRgb}
            renderInputMedia={renderInputMedia}
            videoDevices={videoDevices}
            cameraThemeMap={cameraThemeMap}
            setCameraThemeMap={setCameraThemeMap}
          />
        )}

        {isThemeDesignerOpen && (
          <ThemeDesigner
            isOpen={isThemeDesignerOpen}
            tabType={activeTab}
            initialTheme={editingTheme || undefined}
            onSave={handleSaveTheme}
            onCancel={() => setIsThemeDesignerOpen(false)}
            onPreviewUpdate={handlePreviewUpdate}
            previewText={state.currentTextOutput}
            previewReference={state.currentReferenceOutput}
          />
        )}
      </div>
    </main>
  );
}