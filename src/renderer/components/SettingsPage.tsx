import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppState } from "../context/AppState";
import type {
  BackgroundStyle,
  BackgroundTexture,
  DisplayFormat,
  LowerThirdStyle,
  OutputTarget,
  ThemeType,
} from "../../shared/types";

type SectionId =
  | "general"
  | "bible"
  | "routing"
  | "mapping"
  | "ndi"
  | "matrix"
  | "audio"
  | "patching"
  | "video"
  | "integrations"
  | "about";

type EqBand = "low" | "mid" | "high";

interface SettingsPageProps {
  onClose: () => void;
  onOpenStudio: () => void;
}

interface SettingsSnapshot {
  currentBibleTranslation: string;
  selectedOutputIds: string[];
  displayFormat: DisplayFormat;
  activeTheme: ThemeType;
  isAutoDisplayMode: boolean;
  isScriptureParaphraseMode: boolean;
  selectedAudioDeviceId: string;
  inputGain: number;
  defaultOutputResolution: string;
  enableAlphaChannel: boolean;
  enableScreenMirrorOutput: boolean;
  outputOpacity: number;
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
  outputRoutingMap?: Record<string, string | number>;
  backgroundPositionX: number;
  backgroundPositionY: number;
  textPositionX: number;
  textPositionY: number;
}

interface IntegrationStatus {
  hasAwsCreds: boolean;
  awsRegion?: string | null;
  pollyVoiceId?: string | null;
  bibleDatabasePath?: string | null;
}

interface ExtendedElectronApi {
  saveIntegrationSettings?: (
    settings: Record<string, string | undefined>,
  ) => Promise<{ success: boolean; error?: string }>;
  getIntegrationStatus?: () => Promise<IntegrationStatus>;
  pickBibleDatabase?: () => Promise<{ canceled: boolean; path: string | null }>;
  synthesizePolly?: (
    text: string,
    voiceId?: string,
    format?: string,
  ) => Promise<{ audioBase64?: string; error?: string }>;
}

const DEFAULT_SETTINGS: SettingsSnapshot = {
  currentBibleTranslation: "KJV",
  selectedOutputIds: [],
  displayFormat: "FULL",
  activeTheme: "IMAGE",
  isAutoDisplayMode: false,
  isScriptureParaphraseMode: false,
  selectedAudioDeviceId: "default",
  inputGain: 100,
  defaultOutputResolution: "1920x1080 (16:9)",
  enableAlphaChannel: false,
  enableScreenMirrorOutput: false,
  outputOpacity: 100,
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
  outputRoutingMap: {},
};

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  navLabel: string;
  icon: string;
  group: "display" | "signals" | "system";
}> = [
    { id: "general", label: "General Display", navLabel: "General Display", icon: "monitor", group: "display" },
    { id: "bible", label: "Bible & Version Ingestion", navLabel: "Bible & Ingestion", icon: "auto_stories", group: "display" },
    { id: "mapping", label: "Screen Mapping", navLabel: "Screen Mapping", icon: "grid_4x4", group: "display" },
    { id: "routing", label: "Output Routing", navLabel: "Output Routing", icon: "call_split", group: "signals" },
    { id: "ndi", label: "NDI Pipeline Settings", navLabel: "NDI Pipeline", icon: "share", group: "signals" },
    { id: "matrix", label: "Output Destination Matrix", navLabel: "Output Destination Matrix", icon: "table_view", group: "signals" },
    { id: "audio", label: "Audio Input Channels", navLabel: "Audio Input Channels", icon: "graphic_eq", group: "signals" },
    { id: "patching", label: "Patching", navLabel: "Patching", icon: "settings_input_component", group: "signals" },
    { id: "video", label: "Video Input", navLabel: "Video Input", icon: "videocam", group: "signals" },
    { id: "integrations", label: "Integrations", navLabel: "Integrations", icon: "hub", group: "system" },
    { id: "about", label: "About Us", navLabel: "System Info", icon: "info", group: "system" },
  ];

const NAV_GROUPS: Array<{
  id: "display" | "signals" | "system";
  label: string;
}> = [
    { id: "display", label: "Display Control" },
    { id: "signals", label: "Signal Routing" },
    { id: "system", label: "System" },
  ];

const FONT_OPTIONS = [
  ["Inter", "Inter, system-ui, sans-serif"],
  ["Georgia", "Georgia, serif"],
  ["Trebuchet", "Trebuchet MS, sans-serif"],
  ["JetBrains Mono", "JetBrains Mono, monospace"],
] as const;

const RESOLUTIONS = ["1920x1080 (16:9)", "3840x2160 (4K)", "1280x720 (720p)"];
const DISPLAY_FORMATS: Array<[string, DisplayFormat]> = [
  ["Full", "FULL"],
  ["Lower Third", "LOWER_THIRD"],
];
const THEMES: Array<[string, ThemeType]> = [
  ["Image", "IMAGE"],
  ["Green", "GREEN_SCREEN"],
  ["Alpha", "TRANSPARENT"],
];
const LOWER_THIRDS: Array<[string, LowerThirdStyle]> = [
  ["Classic", "CLASSIC"],
  ["Banner", "BANNER"],
  ["Minimal", "MINIMAL"],
  ["Custom", "CUSTOM"],
];
const BACKGROUNDS: Array<[string, BackgroundStyle]> = [
  ["Solid", "SOLID"],
  ["Gradient", "GRADIENT"],
  ["Image", "IMAGE"],
  ["Composite", "COMPOSITE"],
];
const TEXTURES: Array<[string, BackgroundTexture]> = [
  ["None", "NONE"],
  ["Grain", "GRAIN"],
  ["Dot Grid", "DOT_GRID"],
  ["Soft Noise", "SOFT_NOISE"],
];

const FALLBACK_NDI = [
  ["STUDIO-CAM-1", "192.168.1.45", "ONLINE"],
  ["WORSHIP-MAC", "192.168.1.112", "IN-USE"],
  ["VMIX-MASTER", "192.168.1.200", "ONLINE"],
  ["OVERHEAD-CAM-04", "192.168.1.48", "OFFLINE"],
] as const;

const PATCH_ROWS = [
  ["Bible Text", "Primary Screen", "CONNECTED"],
  ["Song Lyrics", "LED Wall / NDI", "CONNECTED"],
  ["Lower Thirds", "NDI Output 1", "STANDBY"],
  ["Emergency Slide", "All Outputs", "OFFLINE"],
] as const;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ");
}

function extendedElectron(): ExtendedElectronApi {
  return (window.electron ?? {}) as ExtendedElectronApi;
}

function coerceSettings(raw: Record<string, unknown> | null | undefined): SettingsSnapshot {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    currentBibleTranslation:
      typeof raw?.currentBibleTranslation === "string" && raw.currentBibleTranslation.trim()
        ? raw.currentBibleTranslation.trim().toUpperCase()
        : DEFAULT_SETTINGS.currentBibleTranslation,
    selectedOutputIds: Array.isArray(raw?.selectedOutputIds)
      ? raw.selectedOutputIds.filter((item): item is string => typeof item === "string")
      : DEFAULT_SETTINGS.selectedOutputIds,
    displayFormat: raw?.displayFormat === "LOWER_THIRD" ? "LOWER_THIRD" : "FULL",
    activeTheme:
      raw?.activeTheme === "GREEN_SCREEN" || raw?.activeTheme === "TRANSPARENT"
        ? raw.activeTheme
        : "IMAGE",
    isAutoDisplayMode:
      typeof raw?.isAutoDisplayMode === "boolean"
        ? raw.isAutoDisplayMode
        : DEFAULT_SETTINGS.isAutoDisplayMode,
    isScriptureParaphraseMode:
      typeof raw?.isScriptureParaphraseMode === "boolean"
        ? raw.isScriptureParaphraseMode
        : DEFAULT_SETTINGS.isScriptureParaphraseMode,
    selectedAudioDeviceId:
      typeof raw?.selectedAudioDeviceId === "string" && raw.selectedAudioDeviceId.trim()
        ? raw.selectedAudioDeviceId
        : DEFAULT_SETTINGS.selectedAudioDeviceId,
    inputGain: typeof raw?.inputGain === "number" ? raw.inputGain : DEFAULT_SETTINGS.inputGain,
    outputOpacity:
      typeof raw?.outputOpacity === "number" ? raw.outputOpacity : DEFAULT_SETTINGS.outputOpacity,
    outputFontSize:
      typeof raw?.outputFontSize === "number" ? raw.outputFontSize : DEFAULT_SETTINGS.outputFontSize,
    forceAspectRatio:
      typeof raw?.forceAspectRatio === "boolean"
        ? raw.forceAspectRatio
        : DEFAULT_SETTINGS.forceAspectRatio,
    enableAlphaChannel:
      typeof raw?.enableAlphaChannel === "boolean"
        ? raw.enableAlphaChannel
        : DEFAULT_SETTINGS.enableAlphaChannel,
    enableScreenMirrorOutput:
      typeof raw?.enableScreenMirrorOutput === "boolean"
        ? raw.enableScreenMirrorOutput
        : DEFAULT_SETTINGS.enableScreenMirrorOutput,
    autoCorrectEncoding:
      typeof raw?.autoCorrectEncoding === "boolean"
        ? raw.autoCorrectEncoding
        : DEFAULT_SETTINGS.autoCorrectEncoding,
    stripMetadataOnImport:
      typeof raw?.stripMetadataOnImport === "boolean"
        ? raw.stripMetadataOnImport
        : DEFAULT_SETTINGS.stripMetadataOnImport,
    outputRoutingMap:
      typeof raw?.outputRoutingMap === "object" && raw?.outputRoutingMap !== null
        ? raw.outputRoutingMap
        : DEFAULT_SETTINGS.outputRoutingMap,
  } as SettingsSnapshot;
}

const ICON_PATHS: Record<string, ReactNode> = {
  account_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9.5" r="2.5" />
      <path d="M7.5 18c1-2.4 2.5-3.6 4.5-3.6s3.5 1.2 4.5 3.6" />
    </>
  ),
  aspect_ratio: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h3M8 9v3M16 15h-3M16 15v-3" />
    </>
  ),
  auto_stories: (
    <>
      <path d="M5 5.5h5.5c1.1 0 1.9.8 1.9 1.9V19c0-1.1-.8-1.9-1.9-1.9H5z" />
      <path d="M19 5.5h-5.5c-1.1 0-1.9.8-1.9 1.9V19c0-1.1.8-1.9 1.9-1.9H19z" />
      <path d="M8 9h2M8 12h2M16 9h-2M16 12h-2" />
    </>
  ),
  call_split: (
    <>
      <path d="M6 20V9a3 3 0 0 1 3-3h8" />
      <path d="M14 3l3 3-3 3" />
      <path d="M6 9a3 3 0 0 0 3 3h8" />
      <path d="M14 9l3 3-3 3" />
    </>
  ),
  center_focus_strong: (
    <>
      <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  display_settings: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M8 10h8M8 13h5" />
    </>
  ),
  equalizer: (
    <>
      <path d="M5 20V9M12 20V4M19 20v-8" />
      <path d="M3.5 9h3M10.5 14h3M17.5 12h3" />
    </>
  ),
  graphic_eq: (
    <>
      <path d="M4 14v3M8 9v8M12 5v12M16 11v6M20 7v10" />
    </>
  ),
  grid_4x4: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  grid_on: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 16h16M10 4v16M16 4v16" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 7.4l3.2 2.7M16.8 7.4l-3.2 2.7M7 16.6l3.2-2.7M16.8 16.6l-3.2-2.7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="3" />
      <path d="M11 14h9M17 14v3M14 14v2" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="7" rx="1.5" />
      <rect x="17" y="13" width="4" height="7" rx="1.5" />
    </>
  ),
  memory: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      <rect x="10" y="10" width="4" height="4" rx=".7" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  output: (
    <>
      <path d="M4 12h12" />
      <path d="M13 8l4 4-4 4" />
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </>
  ),
  precision_manufacturing: (
    <>
      <path d="M14 7l3-3 3 3-3 3z" />
      <path d="M4 20V9l5-3 5 3v11" />
      <path d="M8 20v-6h4v6M4 13h10" />
    </>
  ),
  radio_button_checked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </>
  ),
  radio_button_unchecked: (
    <>
      <circle cx="12" cy="12" r="8" />
    </>
  ),
  report: (
    <>
      <path d="M9 3h6l6 6v6l-6 6H9l-6-6V9z" />
      <path d="M12 7v7M12 17h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  security: (
    <>
      <path d="M12 3l7 3v5c0 4.5-2.8 8.4-7 10-4.2-1.6-7-5.5-7-10V6z" />
      <path d="M9.5 12l1.8 1.8 3.7-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  settings_input_antenna: (
    <>
      <path d="M12 19V9" />
      <path d="M8 13a5.7 5.7 0 0 1 8 0M5 10a10 10 0 0 1 14 0" />
      <path d="M10 19h4M9 22h6" />
      <circle cx="12" cy="7" r="1.5" />
    </>
  ),
  settings_input_component: (
    <>
      <rect x="4" y="5" width="5" height="5" rx="1" />
      <rect x="15" y="5" width="5" height="5" rx="1" />
      <rect x="4" y="14" width="5" height="5" rx="1" />
      <rect x="15" y="14" width="5" height="5" rx="1" />
      <path d="M9 7.5h6M9 16.5h6M6.5 10v4M17.5 10v4" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.7 10.7l6.6-4.4M8.7 13.3l6.6 4.4" />
    </>
  ),
  speaker: (
    <>
      <path d="M5 9v6h4l5 4V5L9 9z" />
      <path d="M17 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-2.8 8.4-7 10-4.2-1.6-7-5.5-7-10V6z" />
    </>
  ),
  speed: (
    <>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-5" />
      <path d="M8 20h8" />
    </>
  ),
  straighten: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <path d="M7 8v3M11 8v2M15 8v3M19 8v2" />
    </>
  ),
  table_view: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 10v9M15 10v9" />
    </>
  ),
  tune: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M4 12h4M12 12h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="10" cy="12" r="2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  upload_file: (
    <>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
      <path d="M14 3v4h4M12 17V9M9 12l3-3 3 3" />
    </>
  ),
  videocam: (
    <>
      <rect x="4" y="7" width="11" height="10" rx="2" />
      <path d="M15 10l5-3v10l-5-3z" />
    </>
  ),
  wallpaper: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M5 17l5-5 3.5 3.5 2-2L20 18" />
    </>
  ),
};

function Icon({ name, active = false, className }: { name: string; active?: boolean; className?: string }) {
  const path = ICON_PATHS[name] ?? ICON_PATHS.tune;

  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center leading-none", className)}
    >
      <svg
        className="h-[1em] w-[1em]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 2.2 : 1.9}
      >
        {path}
      </svg>
    </span>
  );
}

function Dot({ tone = "green" }: { tone?: "green" | "amber" | "red" | "dim" }) {
  return (
    <span
      className={cx(
        "block h-2 w-2 rounded-full",
        tone === "green" && "bg-[#4edea3] shadow-[0_0_9px_rgba(78,222,163,.55)]",
        tone === "amber" && "bg-[#ffb95f]",
        tone === "red" && "bg-[#93000a]",
        tone === "dim" && "bg-[#86948a]",
      )}
    />
  );
}

function Panel({
  title,
  icon,
  children,
  action,
  className,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("min-w-0 border border-[#3c4a42] bg-[#1f1f22]", className)}>
      <div className="flex h-10 items-center justify-between border-b border-[#3c4a42] bg-[#2a2a2d] px-3">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
          {icon ? <Icon name={icon} className="text-[16px] text-[#4edea3]" /> : null}
          <span className="truncate">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-[#bbcabf]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[11px] text-[#e4e1e6] outline-none focus:border-[#4edea3]"
    >
      {children}
    </select>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  readOnly = false,
  placeholder,
}: {
  value: string | number;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      className="h-8 w-full border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[11px] text-[#e4e1e6] outline-none placeholder:text-[#86948a] focus:border-[#4edea3]"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-[#10b981]" : "bg-surface-container-highest"
      )}
    >
      <span className="sr-only">Toggle {label}</span>
      <span
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute left-0 inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-[20px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[string, T]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(78px,1fr))] gap-1">
      {options.map(([label, item]) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cx(
            "h-8 truncate border px-2 font-mono text-[10px] uppercase tracking-[0.14em]",
            value === item
              ? "border-[#4edea3] bg-[#10b981]/20 text-[#4edea3]"
              : "border-[#3c4a42] bg-[#131316] text-[#bbcabf]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="h-full w-3 bg-[#0e0e11] p-px">
      <div className="flex h-full flex-col justify-end">
        <div
          className="w-full bg-[#4edea3] shadow-[0_0_8px_rgba(78,222,163,.35)]"
          style={{ height: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function Bar({ value, tone = "green" }: { value: number; tone?: "green" | "amber" | "red" }) {
  return (
    <div className="h-1.5 bg-[#0e0e11]">
      <div
        className={cx(
          "h-full",
          tone === "green" && "bg-[#4edea3]",
          tone === "amber" && "bg-[#ffb95f]",
          tone === "red" && "bg-[#93000a]",
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#3c4a42] bg-[#131316] px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#86948a]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[13px] text-[#4edea3]">{value}</div>
    </div>
  );
}

function toLevel(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function gainToDb(inputGain: number): number {
  if (inputGain <= 0) return -60;
  return Math.round(20 * Math.log10(inputGain / 100) * 10) / 10;
}

function AudioVerticalMeter({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "outline";
  className?: string;
}) {
  return (
    <div className={cx("relative overflow-hidden rounded-sm bg-[#0e0e11]", className ?? "h-full w-3")}>
      <div className="absolute inset-0 bg-[#10b981]/15" />
      <div
        className={cx(
          "absolute bottom-0 left-0 w-full rounded-sm transition-[height] duration-100",
          tone === "primary"
            ? "bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            : "bg-[#86948a]",
        )}
        style={{ height: `${toLevel(value)}%` }}
      />
    </div>
  );
}

function Fader({
  value,
  db,
  active,
  onChange,
}: {
  value: number;
  db: string;
  active?: boolean;
  onChange?: (value: number) => void;
}) {
  const top = 100 - toLevel(value);

  return (
    <div className="relative flex-1 overflow-hidden rounded-sm border border-[#3c4a42]/50 bg-[#1b1b1e]">
      <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[#3c4a42]" />
      <div
        className={cx(
          "absolute left-0 flex h-8 w-full -translate-y-1/2 items-center justify-center border-y shadow-lg",
          active ? "border-[#10b981]/70 bg-[#2a2a2d]" : "border-[#86948a] bg-[#2a2a2d]",
        )}
        style={{ top: `${Math.max(14, Math.min(86, top))}%` }}
      >
        <div className={cx("h-0.5 w-4", active ? "bg-[#10b981]" : "bg-[#86948a]")} />
      </div>
      <div className="pointer-events-none absolute inset-y-2 right-1 flex flex-col justify-between font-mono text-[8px] text-[#86948a]">
        <span>+12</span>
        <span>0</span>
        <span>-12</span>
        <span>-24</span>
        <span>-48</span>
        <span>-INF</span>
      </div>
      {onChange ? (
        <input
          aria-label="Input gain fader"
          type="range"
          min={0}
          max={200}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-ns-resize opacity-0"
          orient="vertical"
        />
      ) : null}
      <div className="absolute bottom-1 left-2 font-mono text-[9px] text-[#bbcabf]">{db}</div>
    </div>
  );
}

function AudioChannelStrip({
  channel,
  title,
  meter,
  db,
  gain,
  active,
  stereo,
  muted,
  onGainChange,
}: {
  channel: string;
  title: string;
  meter: number;
  db: string;
  gain: number;
  active?: boolean;
  stereo?: boolean;
  muted?: boolean;
  onGainChange?: (value: number) => void;
}) {
  const gainDb = gainToDb(gain);

  return (
    <div
      className={cx(
        "flex min-h-0 flex-col gap-3 bg-[#131316] p-3",
        active && "ring-1 ring-inset ring-[#10b981]/35",
      )}
    >
      <div className="min-w-0">
        <div className="font-mono text-[15px] uppercase tracking-[0.18em] text-[#86948a]">
          {channel}
        </div>
        <div className="truncate text-[13px] font-bold text-[#e4e1e6]">{title}</div>
      </div>
      <div className="flex h-48 gap-3">
        <AudioVerticalMeter value={muted ? 0 : meter} />
        <Fader value={gain} db={db} active={active} onChange={onGainChange} />
      </div>
      {stereo ? (
        <div className="flex h-[42px] items-center justify-center rounded-sm border border-[#3c4a42] bg-[#1f1f22]">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#10b981]">
            Stereo Linked
          </span>
        </div>
      ) : (
        <div className={cx("grid grid-cols-2 gap-2", muted && "opacity-55")}>
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-sm border border-[#3c4a42] bg-[#1f1f22] py-2"
          >
            <span className="mb-1 font-mono text-[10px] uppercase text-[#86948a]">48V</span>
            <span
              className={cx(
                "size-2 rounded-full",
                active ? "bg-[#10b981] shadow-[0_0_6px_#10b981]" : "bg-[#3c4a42]",
              )}
            />
          </button>
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-sm border border-[#3c4a42] bg-[#1f1f22] py-2"
          >
            <span className="mb-1 font-mono text-[10px] uppercase text-[#86948a]">Phase</span>
            <Icon
              name={active ? "radio_button_checked" : "radio_button_unchecked"}
              active={active}
              className={cx("text-[13px]", active ? "text-[#e4e1e6]" : "text-[#86948a]")}
            />
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase text-[#86948a]">Gain</span>
          <span className={cx("font-mono text-[10px]", active ? "text-[#10b981]" : "text-[#e4e1e6]")}>
            {gainDb > 0 ? `+${gainDb}` : gainDb}dB
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          value={gain}
          disabled={!onGainChange}
          onChange={(event) => onGainChange?.(Number(event.target.value))}
          className="h-1 w-full accent-[#10b981]"
        />
      </div>
    </div>
  );
}

function ProcessingEqGraph({ eq }: { eq: Record<EqBand, number> }) {
  const path = `M0 ${78 - eq.low * 2.5} Q 50 ${78 - eq.low * 4},80 ${42 - eq.low * 2} T150 ${22 - eq.mid * 1.8
    } T250 ${50 - eq.high} T350 ${70 - eq.high * 2} T400 ${70 - eq.high * 2}`;

  return (
    <div className="relative h-32 overflow-hidden rounded-sm border border-[#3c4a42] bg-[#0e0e11] bg-[linear-gradient(#1b1b1e_1px,transparent_1px),linear-gradient(90deg,#1b1b1e_1px,transparent_1px)] bg-[length:20px_20px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 100" preserveAspectRatio="none">
        <path d="M0 50 L400 50" stroke="#3c4a42" strokeWidth="0.5" />
        <path d={path} fill="none" stroke="#10b981" strokeWidth="2.5" />
        <circle cx="80" cy={42 - eq.low * 2} r="3" fill="#10b981" />
        <circle cx="150" cy={22 - eq.mid * 1.8} r="3" fill="#10b981" />
        <circle cx="250" cy={50 - eq.high} r="3" fill="#10b981" />
      </svg>
      <div className="absolute inset-x-2 bottom-1 flex justify-between font-mono text-[8px] uppercase tracking-widest text-[#86948a]">
        <span>20Hz</span>
        <span>100Hz</span>
        <span>1kHz</span>
        <span>5kHz</span>
        <span>20kHz</span>
      </div>
    </div>
  );
}

function Knob({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cx(
          "relative size-10 rounded-full border-2 border-t-transparent",
          active ? "border-[#10b981]" : "border-[#86948a]",
        )}
        style={{ transform: `rotate(${value}deg)` }}
      >
        <div
          className={cx(
            "absolute left-1/2 top-0 h-2 w-1 -translate-x-1/2 rounded-full",
            active ? "bg-[#10b981]" : "bg-[#86948a]",
          )}
        />
      </div>
      <span className="font-mono text-[9px] uppercase text-[#e4e1e6]">{label}</span>
    </div>
  );
}

function MiniBusCard({
  title,
  icon,
  level,
  mix,
  db,
  active,
}: {
  title: string;
  icon: string;
  level: number;
  mix: string;
  db: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-[#3c4a42] bg-[#131316] p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#86948a]">{title}</span>
        <Icon name={icon} className={cx("text-[15px]", active ? "text-[#10b981]" : "text-[#86948a]")} />
      </div>
      <div className="flex items-center gap-4">
        <AudioVerticalMeter value={level} tone={active ? "primary" : "outline"} className="h-16 w-2" />
        <div className="flex flex-1 flex-col gap-2">
          <input type="range" value={level} readOnly className="h-1 w-full accent-[#10b981]" />
          <div className="flex justify-between font-mono text-[9px] uppercase text-[#86948a]">
            <span>{mix}</span>
            <span>{db}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrossoverPanel({
  title,
  frequency,
  path,
  slope,
}: {
  title: string;
  frequency: string;
  path: string;
  slope: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-[#bbcabf]">{title}</span>
        <span className="font-mono text-[10px] text-[#10b981]">{frequency}</span>
      </div>
      <div className="relative h-12 overflow-hidden rounded-sm border border-[#3c4a42]/50 bg-[#1f1f22]">
        <svg className="h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="#10b981" strokeWidth="2" />
        </svg>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-[#86948a]">Slope: {slope}</span>
        <div className="flex gap-1">
          <button type="button" className="flex size-4 items-center justify-center rounded-sm bg-[#353438] text-[10px]">
            -
          </button>
          <button type="button" className="flex size-4 items-center justify-center rounded-sm bg-[#353438] text-[10px]">
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function AudioMatrixScreen({
  settings,
  audio,
  audioDevices,
  eq,
  setEq,
  updateSettings,
  outputs,
  isLiveMode,
  timecode,
}: {
  settings: SettingsSnapshot;
  audio: { level: number; db: number; error: string };
  audioDevices: MediaDeviceInfo[];
  eq: Record<EqBand, number>;
  setEq: React.Dispatch<React.SetStateAction<Record<EqBand, number>>>;
  updateSettings: (patch: Partial<SettingsSnapshot>) => void;
  outputs: OutputTarget[];
  isLiveMode: boolean;
  timecode: string;
}) {
  const selectedDevice =
    audioDevices.find((device) => device.deviceId === settings.selectedAudioDeviceId) ?? audioDevices[0];
  const inputName = selectedDevice?.label || "Default Audio Input";
  const selectedOutputs = outputs.filter((output) => output.selected);
  const mainDestination = selectedOutputs[0]?.label || outputs[0]?.label || "No mapped destination";
  const supportedCodec =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "Opus WebM"
      : "PCM 48k";
  const masterLevel = toLevel(audio.level * 1.08);
  const auxLevel = toLevel(audio.level * 0.48);
  const playbackLevel = toLevel(audio.level * 0.68);
  const latency = Math.max(1.2, Math.round((128 / 48000) * 10000) / 10);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#131316] text-[#e4e1e6]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#3c4a42] bg-[#1b1b1e] px-6">
        <div className="flex items-center gap-6">
          <h2 className="text-[18px] font-bold">Audio Matrix</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={cx(
                "rounded-sm border px-4 py-2 text-[14px]",
                isLiveMode
                  ? "border-[#10b981] bg-[#10b981] text-[#002113]"
                  : "border-[#3c4a42] text-[#bbcabf]",
              )}
            >
              Live Mode
            </button>
            <button
              type="button"
              className="rounded-sm border border-[#3c4a42] px-4 py-2 text-[14px] text-[#bbcabf]"
            >
              Rehearsal
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-sm border border-[#3c4a42] bg-[#353438] px-3 py-2">
            <span className="size-2 rounded-full bg-[#10b981]" />
            <span className="font-mono text-[16px]">{timecode}</span>
          </div>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full border border-[#3c4a42] text-[#e4e1e6]"
            aria-label="Audio alerts"
          >
            <Icon name="settings_input_antenna" className="text-[20px]" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex w-1/2 min-w-0 flex-col border-r border-[#3c4a42] bg-[#131316]">
          <div className="flex items-center justify-between border-b border-[#3c4a42] bg-[#1b1b1e] p-3">
            <span className="font-mono text-[16px] uppercase tracking-[0.04em] text-[#10b981]">
              Input Channels
            </span>
            <div className="flex items-center gap-3 text-[#e4e1e6]">
              <button type="button" className="text-[18px] leading-none">+</button>
              <button type="button" className="text-[18px] leading-none">⋮</button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="grid grid-cols-3 gap-px bg-[#3c4a42] p-px">
              <AudioChannelStrip
                channel="MIC 01"
                title={inputName}
                meter={audio.level}
                db={`${audio.db} dB`}
                gain={settings.inputGain}
                active
                onGainChange={(inputGain) => updateSettings({ inputGain })}
              />
              <AudioChannelStrip
                channel="LINE 02"
                title={audioDevices[1]?.label || "Aux Return"}
                meter={auxLevel}
                db={`${Math.round((audio.db - 9) * 10) / 10} dB`}
                gain={Math.max(0, Math.min(200, settings.inputGain * 0.72))}
                muted={!audioDevices[1]}
              />
              <AudioChannelStrip
                channel="AES 01"
                title="Main Playback"
                meter={playbackLevel}
                db={`${Math.round((audio.db - 4.5) * 10) / 10} dB`}
                gain={Math.max(0, Math.min(200, settings.inputGain * 0.88))}
                stereo
              />
            </div>

            <div className="m-3 flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-sm border border-[#3c4a42] bg-[#1b1b1e]">
              <div className="flex items-center gap-3 border-b border-[#3c4a42] bg-[#1f1f22] p-3">
                <span className="text-[16px] font-bold uppercase">Processing Chain</span>
                <div className="h-4 w-px bg-[#3c4a42]" />
                <div className="flex gap-2">
                  <span className="rounded-sm bg-[#10b981] px-2 py-1 text-[9px] font-bold uppercase text-[#002113]">
                    12-Band EQ
                  </span>
                  <span className="rounded-sm bg-[#353438] px-2 py-1 text-[9px] font-bold uppercase text-[#bbcabf]">
                    Gate
                  </span>
                  <span className="rounded-sm bg-[#353438] px-2 py-1 text-[9px] font-bold uppercase text-[#bbcabf]">
                    Comp
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-6 p-4">
                <ProcessingEqGraph eq={eq} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-3">
                    <span className="font-mono text-[10px] uppercase text-[#86948a]">Dynamics</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] uppercase text-[#3c4a42]">Threshold</span>
                        <div className="h-1 rounded-full bg-[#353438]">
                          <div className="h-full w-[70%] bg-[#10b981]" />
                        </div>
                        <span className="text-right font-mono text-[9px]">-18dB</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] uppercase text-[#3c4a42]">Ratio</span>
                        <div className="h-1 rounded-full bg-[#353438]">
                          <div className="h-full w-[30%] bg-[#10b981]" />
                        </div>
                        <span className="text-right font-mono text-[9px]">4:1</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["low", "mid", "high"] as EqBand[]).map((band) => (
                        <label key={band} className="flex flex-col gap-1">
                          <span className="font-mono text-[9px] uppercase text-[#86948a]">
                            {band} {eq[band]}dB
                          </span>
                          <input
                            type="range"
                            min={-12}
                            max={12}
                            value={eq[band]}
                            onChange={(event) =>
                              setEq((current) => ({ ...current, [band]: Number(event.target.value) }))
                            }
                            className="h-1 w-full accent-[#10b981]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="font-mono text-[10px] uppercase text-[#86948a]">Tonal Tuners</span>
                    <div className="flex justify-between">
                      <Knob label="Bass" value={45 + eq.low * 4} active />
                      <Knob label="Mid" value={-10 + eq.mid * 4} />
                      <Knob label="Treble" value={120 + eq.high * 4} active />
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                      <div className="rounded-sm border border-[#3c4a42] bg-[#131316] p-2">
                        Codec: <span className="text-[#10b981]">{supportedCodec}</span>
                      </div>
                      <div className="rounded-sm border border-[#3c4a42] bg-[#131316] p-2">
                        Plugin: <span className="text-[#10b981]">WebAudio Biquad</span>
                      </div>
                    </div>
                  </div>
                </div>
                {audio.error ? <div className="text-[11px] text-[#ffb4ab]">{audio.error}</div> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-1/2 min-w-0 flex-col bg-[#0e0e11]">
          <div className="flex items-center justify-between border-b border-[#3c4a42] bg-[#1b1b1e] p-3">
            <span className="font-mono text-[16px] uppercase tracking-[0.04em] text-[#ffb95f]">
              Output Buses
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] uppercase text-[#93000a]">
                {selectedOutputs.length ? "Broadcast Ready" : "Route Pending"}
              </span>
              <div className="h-4 w-px bg-[#3c4a42]" />
              <Icon name="equalizer" className="text-[16px] text-[#bbcabf]" />
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-3">
            <div className="flex gap-6 rounded-sm border border-[#3c4a42] bg-[#131316] p-4">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[15px] uppercase text-[#86948a]">Master L/R</span>
                <div className="flex h-40 gap-1">
                  <AudioVerticalMeter value={masterLevel} className="h-full w-3" />
                  <AudioVerticalMeter value={toLevel(masterLevel * 0.96)} className="h-full w-3" />
                </div>
                <span className="text-center font-mono text-[10px] text-[#10b981]">{audio.db} dB</span>
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-[15px] font-bold">Main Line Out</h4>
                    <p className="font-mono text-[10px] text-[#86948a]">Destination: {mainDestination}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-sm bg-[#93000a] px-3 py-2 text-[10px] font-bold uppercase text-white"
                    >
                      Mute All
                    </button>
                    <button
                      type="button"
                      className="rounded-sm border border-[#3c4a42] px-3 py-2 text-[10px] font-bold uppercase"
                    >
                      Mono
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2 rounded-sm border border-[#3c4a42] bg-[#1f1f22] p-2">
                    <span className="font-mono text-[9px] uppercase text-[#86948a]">Master EQ</span>
                    <div className="flex h-8 items-end gap-1">
                      {[60 + eq.low * 3, 80 + eq.low * 2, 50 + eq.mid * 2, 40, 70 + eq.high, 90 + eq.high, 30].map(
                        (height, index) => (
                          <div
                            key={index}
                            className="flex-1 bg-[#10b981]/40"
                            style={{ height: `${toLevel(height)}%` }}
                          />
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-sm bg-[#353438] py-1 text-[8px] font-bold uppercase"
                    >
                      Edit 12-Band
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 rounded-sm border border-[#3c4a42] bg-[#1f1f22] p-2">
                    <span className="font-mono text-[9px] uppercase text-[#86948a]">Broadcast Limiter</span>
                    <div className="flex flex-1 flex-col justify-center gap-1">
                      <div className="flex justify-between font-mono text-[8px]">
                        <span>Ceiling</span>
                        <span>-0.1dB</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#353438]">
                        <div className="h-full bg-[#ffb95f]" style={{ width: `${toLevel(masterLevel)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#ffb95f]" />
                      <span className="font-mono text-[8px] uppercase text-[#ffb95f]">Active Reduction</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniBusCard title="Monitor 1 (IEM)" icon="headphones" level={masterLevel * 0.45} mix="Mix: Vocal Focus" db="-12dB" active />
              <MiniBusCard title="Monitor 2 (Stage)" icon="speaker" level={masterLevel * 0.3} mix="Mix: Flat" db="-18dB" />
            </div>

            <div className="rounded-sm border border-[#3c4a42] bg-[#131316] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[16px] uppercase tracking-[0.12em] text-[#86948a]">
                  System Crossover
                </span>
                <button
                  type="button"
                  className="rounded-sm border border-[#10b981]/30 px-2 py-1 text-[9px] font-bold uppercase text-[#10b981]"
                >
                  Lock Tuning
                </button>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <CrossoverPanel title="Low Pass (Subs)" frequency="80Hz" path="M0 10 H70 Q80 10, 85 40" slope="24dB/Oct" />
                <CrossoverPanel title="High Pass (Mains)" frequency="85Hz" path="M100 10 H30 Q20 10, 15 40" slope="Linkwitz-Riley" />
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-sm border border-[#93000a]/40 bg-[#93000a]/10 p-3">
              <Icon name="report" className="text-[24px] text-[#93000a]" />
              <div className="flex-1">
                <p className="text-[13px] font-bold uppercase">Automatic Level Control Active</p>
                <p className="text-[11px] text-[#bbcabf]">
                  Capping peak transients at +3.0dB to prevent digital clipping in the broadcast feed.
                </p>
              </div>
              <button type="button" className="rounded-sm bg-[#93000a] px-4 py-2 text-[16px] text-white">
                Override
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#3c4a42] bg-[#0e0e11] px-4">
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase text-[#86948a]">
          <span>Clock Source: Internal (48kHz)</span>
          <span>Latency: {latency}ms</span>
          <span>Codec: {supportedCodec}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#3c4a42]">
          HallelujahBeamer Control V4.2.0-Stable
        </span>
      </footer>
    </div>
  );
}

function useLiveAudio(
  enabled: boolean,
  deviceId: string,
  inputGain: number,
  eq: Record<EqBand, number>,
) {
  const [level, setLevel] = useState(0);
  const [db, setDb] = useState(-60);
  const [error, setError] = useState("");
  const eqRef = useRef(eq);
  const gainRef = useRef(inputGain);

  useEffect(() => {
    eqRef.current = eq;
  }, [eq]);

  useEffect(() => {
    gainRef.current = inputGain;
  }, [inputGain]);

  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.getUserMedia) {
      setLevel(0);
      setDb(-60);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    const start = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio:
            deviceId && deviceId !== "default"
              ? {
                deviceId: { exact: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000,
              }
              : {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000,
              },
        });

        if (cancelled) return;

        const AudioContextCtor =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        context = new AudioContextCtor({ sampleRate: 48000 });
        const source = context.createMediaStreamSource(stream);
        const gain = context.createGain();
        const low = context.createBiquadFilter();
        const mid = context.createBiquadFilter();
        const high = context.createBiquadFilter();
        const analyser = context.createAnalyser();
        const mute = context.createGain();

        low.type = "lowshelf";
        low.frequency.value = 120;
        mid.type = "peaking";
        mid.frequency.value = 1200;
        mid.Q.value = 0.9;
        high.type = "highshelf";
        high.frequency.value = 6500;
        analyser.fftSize = 1024;
        mute.gain.value = 0;

        source.connect(gain);
        gain.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(analyser);
        analyser.connect(mute);
        mute.connect(context.destination);

        const samples = new Float32Array(analyser.fftSize);
        const tick = (): void => {
          if (!context || cancelled) return;

          gain.gain.value = Math.max(0, Math.min(2, gainRef.current / 100));
          low.gain.value = eqRef.current.low;
          mid.gain.value = eqRef.current.mid;
          high.gain.value = eqRef.current.high;

          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            sum += samples[index] * samples[index];
          }
          const rms = Math.sqrt(sum / samples.length);
          const nextDb = Math.max(-60, 20 * Math.log10(rms || 0.000001));
          setDb(Math.round(nextDb * 10) / 10);
          setLevel(Math.min(100, Math.max(0, (nextDb + 60) * 1.8)));
          frame = window.setTimeout(tick, 66) as unknown as number;
        };

        setError("");
        tick();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Audio input unavailable");
      }
    };

    void start();

    return () => {
      cancelled = true;
      window.clearTimeout(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [deviceId, enabled]);

  return { level, db, error };
}

export default function SettingsPage({ onClose, onOpenStudio }: SettingsPageProps) {
  const {
    state,
    availableOutputs,
    availableTranslations,
    patchState,
    setActiveTheme,
    setCurrentBibleTranslation,
    setDisplayFormat,
    setInputGain,
    setIsAutoDisplayMode,
    setLowerThirdStyle,
    setOutputFontFamily,
    setOutputFontSize,
    setSelectedAudioDeviceId,
    setSelectedOutputIds,
    refreshAvailableOutputs,
    refreshAvailableTranslations,
    triggerBibleImport,
    deleteTranslation,
  } = useAppState();

  const [active, setActive] = useState<SectionId>("general");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Settings engine ready.");
  const [audioTimecode, setAudioTimecode] = useState("00:00:00:00");
  const audioSessionStartRef = useRef(Date.now());
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [eq, setEq] = useState<Record<EqBand, number>>({ low: 0, mid: 0, high: 0 });
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [hasAwsCreds, setHasAwsCreds] = useState(false);
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [pollyVoice, setPollyVoice] = useState("Joanna");
  const [bibleDbPath, setBibleDbPath] = useState("");
  const [selectedConfigOutputId, setSelectedConfigOutputId] = useState<string | undefined>(undefined);
  const audio = useLiveAudio(active === "audio", settings.selectedAudioDeviceId, settings.inputGain, eq);

  useEffect(() => {
    if (active !== "audio") return;

    audioSessionStartRef.current = Date.now();
    const updateTimecode = (): void => {
      const elapsed = Date.now() - audioSessionStartRef.current;
      const totalSeconds = Math.floor(elapsed / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const frames = Math.floor(((elapsed % 1000) / 1000) * 30);
      setAudioTimecode(
        [hours, minutes, seconds, frames]
          .map((part) => String(part).padStart(2, "0"))
          .join(":"),
      );
    };

    updateTimecode();
    const interval = window.setInterval(updateTimecode, 250);
    return () => window.clearInterval(interval);
  }, [active]);

  const selectedOutputs = useMemo(
    () =>
      availableOutputs.map((output) => ({
        ...output,
        selected: settings.selectedOutputIds.includes(output.id),
      })),
    [availableOutputs, settings.selectedOutputIds],
  );

  const translations = availableTranslations.length
    ? availableTranslations
    : [settings.currentBibleTranslation];

  const videoRows = videoDevices.length
    ? videoDevices.map((device, index) => [
      device.label || `Camera ${index + 1}`,
      "MediaDevice",
      index === 0 ? "LIVE" : "READY",
    ])
    : [["No camera permission", "Browser media devices", "IDLE"]];

  const activeMeta = SECTIONS.find((section) => section.id === active) ?? SECTIONS[0];

  const updateSettings = (patch: Partial<SettingsSnapshot>): void => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      settingsRef.current = next;

      if (patch.currentBibleTranslation) setCurrentBibleTranslation(next.currentBibleTranslation);
      if (patch.selectedOutputIds) setSelectedOutputIds(next.selectedOutputIds);
      if (patch.displayFormat) setDisplayFormat(next.displayFormat);
      if (patch.activeTheme) setActiveTheme(next.activeTheme);
      if (typeof patch.isAutoDisplayMode === "boolean") setIsAutoDisplayMode(next.isAutoDisplayMode);
      if (patch.selectedAudioDeviceId) setSelectedAudioDeviceId(next.selectedAudioDeviceId);
      if (typeof patch.inputGain === "number") setInputGain(next.inputGain);
      if (patch.outputFontFamily) setOutputFontFamily(next.outputFontFamily);
      if (typeof patch.outputFontSize === "number") setOutputFontSize(next.outputFontSize);
      if (patch.lowerThirdStyle) setLowerThirdStyle(next.lowerThirdStyle);
      patchState({
        isScriptureParaphraseMode: next.isScriptureParaphraseMode,
        scriptureLowerThirdStyle: next.scriptureLowerThirdStyle,
        lyricsLowerThirdStyle: next.lyricsLowerThirdStyle,
        backgroundStyle: next.backgroundStyle,
        backgroundTexture: next.backgroundTexture,
        backgroundImagePath: next.backgroundImagePath,
        backgroundPositionX: next.backgroundPositionX,
        backgroundPositionY: next.backgroundPositionY,
        textPositionX: next.textPositionX,
        textPositionY: next.textPositionY,
        outputRoutingMap: next.outputRoutingMap,
      });

      return next;
    });
  };

  const saveSettings = async (): Promise<void> => {
    if (!window.electron?.saveAppSettings) return;
    setSaving(true);
    try {
      await window.electron.saveAppSettings(settingsRef.current);
      setStatus("Settings saved.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const stored = coerceSettings((await window.electron?.fetchAppSettings?.()) ?? null);
        settingsRef.current = stored;
        setSettings(stored);
        setCurrentBibleTranslation(stored.currentBibleTranslation);
        setSelectedOutputIds(stored.selectedOutputIds);
        setDisplayFormat(stored.displayFormat);
        setActiveTheme(stored.activeTheme);
        setIsAutoDisplayMode(stored.isAutoDisplayMode);
        setSelectedAudioDeviceId(stored.selectedAudioDeviceId);
        setInputGain(stored.inputGain);
        setOutputFontFamily(stored.outputFontFamily);
        setOutputFontSize(stored.outputFontSize);
        setLowerThirdStyle(stored.lowerThirdStyle);
        patchState(stored);
        await refreshAvailableTranslations();
        await refreshAvailableOutputs(stored.selectedOutputIds);

        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        if (devices) {
          setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
          setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
        }

        const integration = await extendedElectron().getIntegrationStatus?.();
        if (integration) {
          setHasAwsCreds(Boolean(integration.hasAwsCreds));
          setAwsRegion(integration.awsRegion ?? "us-east-1");
          setPollyVoice(integration.pollyVoiceId ?? "Joanna");
          setBibleDbPath(integration.bibleDatabasePath ?? "");
        }


      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to load settings.");
      } finally {
        setReady(true);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!ready || !window.electron?.saveAppSettings) return;
    const timer = window.setTimeout(() => {
      void window.electron?.saveAppSettings?.(settingsRef.current);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [ready, settings]);

  const toggleOutput = async (id: string): Promise<void> => {
    const next = settings.selectedOutputIds.includes(id)
      ? settings.selectedOutputIds.filter((item) => item !== id)
      : [...settings.selectedOutputIds, id];
    updateSettings({ selectedOutputIds: next });
    await refreshAvailableOutputs(next);
  };

  const importBible = async (): Promise<void> => {
    const result = await triggerBibleImport();
    if (result.success) {
      const refreshed = await refreshAvailableTranslations();
      if (result.translation && refreshed.includes(result.translation)) {
        updateSettings({ currentBibleTranslation: result.translation });
      }
      setStatus(`${result.translation ?? "Bible"} imported: ${result.count} records.`);
    } else {
      setStatus(result.canceled ? "Bible import cancelled." : result.error ?? "Bible import failed.");
    }
  };

  const chooseBibleDb = async (): Promise<void> => {
    const result = await extendedElectron().pickBibleDatabase?.();
    if (result?.path) {
      setBibleDbPath(result.path);
      await extendedElectron().saveIntegrationSettings?.({ bibleDatabasePath: result.path });
      setStatus("Bible database path saved.");
    }
  };

  const saveIntegrations = async (): Promise<void> => {
    setSaving(true);
    try {
      await extendedElectron().saveIntegrationSettings?.({
        awsAccessKeyId: awsAccessKey || undefined,
        awsSecretAccessKey: awsSecretKey || undefined,
        awsRegion,
        pollyVoiceId: pollyVoice,
        bibleDatabasePath: bibleDbPath,
      });
      const integration = await extendedElectron().getIntegrationStatus?.();
      if (integration) {
        setHasAwsCreds(Boolean(integration.hasAwsCreds));
      }
      setAwsAccessKey("");
      setAwsSecretKey("");
      setStatus("Integration settings saved.");
    } finally {
      setSaving(false);
    }
  };

  const close = async (): Promise<void> => {
    await saveSettings();
    onClose();
    onOpenStudio();
  };

  if (!ready) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0e0e11] text-[#e4e1e6]">
      <aside className="flex w-[276px] shrink-0 flex-col border-r border-[#3c4a42] bg-[#0e0e11]">
        <div className="flex min-h-16 items-center gap-3 border-b border-[#3c4a42] px-5">
          <Icon name="radio_button_checked" active className="text-[26px] text-[#4edea3]" />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold tracking-tight">HallelujahBeamer</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#bbcabf]">
              v1.0.0-EMERALD
            </div>
          </div>
        </div>

        <div className="border-b border-[#24332b] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#3c4a42] bg-[#1f1f22] text-[#bbcabf]">
              <Icon name="account_circle" active className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium leading-tight">Main Operator</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#89968d]">
                User Logged in Name
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              <div className="px-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#748078]">
                {group.label}
              </div>
              <div className="space-y-1">
                {SECTIONS.filter((section) => section.group === group.id).map((section) => {
                  const isActive = active === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActive(section.id)}
                      className={cx(
                        "group flex min-h-9 w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-[#3c4a42] bg-[#2a2a2d] text-[#4edea3]"
                          : "border-transparent text-[#bbcabf] hover:border-[#2d3b34] hover:bg-[#1f1f22] hover:text-[#e4e1e6]",
                      )}
                    >
                      <Icon
                        name={section.icon}
                        active={isActive}
                        className={cx(
                          "w-5 shrink-0 text-[19px] transition-colors",
                          isActive ? "text-[#4edea3]" : "text-[#89968d] group-hover:text-[#4edea3]",
                        )}
                      />
                      <span
                        className={cx(
                          "min-w-0 flex-1 text-[12px] leading-[1.2]",
                          isActive ? "font-bold" : "font-medium",
                        )}
                      >
                        {section.navLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#3c4a42] bg-[#141417] p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1f1f22] text-[#4edea3]">
              <Icon name="settings" active className="text-[19px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold">Admin Node</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#4edea3]">
                System Ready
              </div>
            </div>
            <Dot />
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[#131316]">
        {active !== "audio" && (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#3c4a42] bg-[#1f1f22] px-4">
            <div className="min-w-0">
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.24em] text-[#4edea3]">
                SYSTEM.CFG / {activeMeta.label}
              </div>
              <h1 className="truncate text-[18px] font-semibold">{activeMeta.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving}
                className="h-8 border border-[#4edea3] bg-[#10b981] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#003824]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => void close()}
                className="h-8 border border-[#3c4a42] bg-[#131316] px-3 font-mono text-[10px] uppercase tracking-[0.16em]"
              >
                Close
              </button>
            </div>
          </header>
        )}

        {active === "audio" ? (
          <AudioMatrixScreen
            settings={settings}
            audio={audio}
            audioDevices={audioDevices}
            eq={eq}
            setEq={setEq}
            updateSettings={updateSettings}
            outputs={selectedOutputs}
            isLiveMode={state.isLiveMode}
            timecode={audioTimecode}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid h-full min-h-[680px] grid-cols-12 gap-2">
              {active === "general" && (
                <>
                  <Panel title="Display Control" icon="monitor" className="col-span-7">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Display Format">
                        <Segmented
                          value={settings.displayFormat}
                          options={DISPLAY_FORMATS}
                          onChange={(displayFormat) => updateSettings({ displayFormat })}
                        />
                      </Field>
                      <Field label="Theme">
                        <Segmented
                          value={settings.activeTheme}
                          options={THEMES}
                          onChange={(activeTheme) => updateSettings({ activeTheme })}
                        />
                      </Field>
                      <Field label="Resolution">
                        <Select
                          value={settings.defaultOutputResolution}
                          onChange={(defaultOutputResolution) => updateSettings({ defaultOutputResolution })}
                        >
                          {RESOLUTIONS.map((resolution) => (
                            <option key={resolution}>{resolution}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Font">
                        <Select
                          value={settings.outputFontFamily}
                          onChange={(outputFontFamily) => updateSettings({ outputFontFamily })}
                        >
                          {FONT_OPTIONS.map(([label, value]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={`Font Size ${settings.outputFontSize}`}>
                        <input
                          type="range"
                          min={60}
                          max={160}
                          value={settings.outputFontSize}
                          onChange={(event) => updateSettings({ outputFontSize: Number(event.target.value) })}
                          className="w-full accent-[#4edea3]"
                        />
                      </Field>
                      <Field label={`Opacity ${settings.outputOpacity}%`}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={settings.outputOpacity}
                          onChange={(event) => updateSettings({ outputOpacity: Number(event.target.value) })}
                          className="w-full accent-[#ffb95f]"
                        />
                      </Field>
                    </div>
                  </Panel>
                  <Panel title="Background Studio" icon="wallpaper" className="col-span-5">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Style">
                        <Select
                          value={settings.backgroundStyle}
                          onChange={(backgroundStyle) =>
                            updateSettings({ backgroundStyle: backgroundStyle as BackgroundStyle })
                          }
                        >
                          {BACKGROUNDS.map(([label, value]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Texture">
                        <Select
                          value={settings.backgroundTexture}
                          onChange={(backgroundTexture) =>
                            updateSettings({ backgroundTexture: backgroundTexture as BackgroundTexture })
                          }
                        >
                          {TEXTURES.map(([label, value]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {[
                        ["BG X", "backgroundPositionX"],
                        ["BG Y", "backgroundPositionY"],
                        ["Text X", "textPositionX"],
                        ["Text Y", "textPositionY"],
                      ].map(([label, key]) => (
                        <Field key={key} label={`${label} ${settings[key as keyof SettingsSnapshot]}`}>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Number(settings[key as keyof SettingsSnapshot])}
                            onChange={(event) =>
                              updateSettings({ [key]: Number(event.target.value) } as Partial<SettingsSnapshot>)
                            }
                            className="w-full accent-[#4edea3]"
                          />
                        </Field>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Output Guards" icon="shield" className="col-span-12">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        ["Auto Display", settings.isAutoDisplayMode, "isAutoDisplayMode"],
                        ["Paraphrase", settings.isScriptureParaphraseMode, "isScriptureParaphraseMode"],
                        ["Alpha Channel", settings.enableAlphaChannel, "enableAlphaChannel"],
                        ["Mirror Output", settings.enableScreenMirrorOutput, "enableScreenMirrorOutput"],
                        ["Aspect Lock", settings.forceAspectRatio, "forceAspectRatio"],
                      ].map(([label, checked, key]) => (
                        <div key={String(key)} className="flex items-center justify-between border border-[#3c4a42] bg-[#131316] px-3 py-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
                          <Toggle
                            checked={Boolean(checked)}
                            label={String(label)}
                            onChange={(value) => updateSettings({ [key as string]: value } as Partial<SettingsSnapshot>)}
                          />
                        </div>
                      ))}
                    </div>
                  </Panel>
                </>
              )}

              {active === "bible" && (
                <>
                  <Panel title="Active Translations Repository" icon="database" className="col-span-8">
                    <table className="w-full table-fixed text-left font-mono text-[11px]">
                      <thead className="text-[#86948a]">
                        <tr className="border-b border-[#3c4a42]">
                          <th className="w-16 py-2">DEF</th>
                          <th className="w-24 py-2">CODE</th>
                          <th className="py-2">NAME</th>
                          <th className="w-28 py-2 text-right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {translations.map((translation) => (
                          <tr key={translation} className="border-b border-[#3c4a42]">
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => updateSettings({ currentBibleTranslation: translation })}
                                className="flex h-4 w-4 items-center justify-center rounded-full border border-[#4edea3]"
                              >
                                {translation === settings.currentBibleTranslation && <Dot />}
                              </button>
                            </td>
                            <td className="py-2 text-[#4edea3]">{translation}</td>
                            <td className="truncate py-2">Installed Translation {translation}</td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => void deleteTranslation(translation)}
                                className="text-[#ffb4ab]"
                              >
                                DELETE
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                  <Panel title="Universal Format File Ingestor" icon="upload_file" className="col-span-4">
                    <button
                      type="button"
                      onClick={() => void importBible()}
                      className="flex h-36 w-full flex-col items-center justify-center border border-dashed border-[#3c4a42] bg-[#131316] font-mono text-[11px] uppercase tracking-[0.2em] text-[#4edea3]"
                    >
                      <Icon name="upload" className="mb-3 text-[24px]" />
                      Upload File
                    </button>
                    <div className="mt-3 grid grid-cols-3 gap-1 font-mono text-[9px] text-[#bbcabf]">
                      {[".xml", ".sqlite", ".usfm", ".json", ".txt", ".csv"].map((ext) => (
                        <span key={ext} className="border border-[#3c4a42] bg-[#131316] px-2 py-1 text-center">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Parser Normalization" icon="tune" className="col-span-12">
                    <div className="grid grid-cols-3 gap-2">
                      <ToggleRow
                        label="Auto-correct encoding anomalies"
                        checked={settings.autoCorrectEncoding}
                        onChange={(autoCorrectEncoding) => updateSettings({ autoCorrectEncoding })}
                      />
                      <ToggleRow
                        label="Strip non-biblical metadata"
                        checked={settings.stripMetadataOnImport}
                        onChange={(stripMetadataOnImport) => updateSettings({ stripMetadataOnImport })}
                      />
                      <button
                        type="button"
                        onClick={() => void chooseBibleDb()}
                        className="border border-[#3c4a42] bg-[#131316] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em]"
                      >
                        DB: {bibleDbPath ? "LINKED" : "CHOOSE"}
                      </button>
                    </div>
                  </Panel>
                </>
              )}

              {active === "routing" && (
                <>
                  {/* Output Routing Configuration - uses IIFE to define local variables */}
                  {(() => {
                    const cameraInputs = state.cameraInputs ?? [];
                    const routingSourceOptions = [
                      { value: "MAIN_OUTPUT", label: "Main Output (Full Program)" },
                      { value: "PREVIEW", label: "Preview Canvas" },
                      ...cameraInputs.map((cam) => ({
                        value: String(cam.id),
                        label: cam.name || `Input ${cam.id}`,
                      })),
                    ];

                    const configOutput = selectedConfigOutputId
                      ? selectedOutputs.find((o) => o.id === selectedConfigOutputId)
                      : null;

                    const currentRouteValue = selectedConfigOutputId
                      ? String(settings.outputRoutingMap?.[selectedConfigOutputId] ?? "MAIN_OUTPUT")
                      : "MAIN_OUTPUT";

                    const handleRouteChange = (newValue: string): void => {
                      if (!selectedConfigOutputId) return;
                      const mapped: string | number =
                        newValue === "MAIN_OUTPUT" || newValue === "PREVIEW"
                          ? newValue
                          : Number(newValue);
                      const next = { ...(settings.outputRoutingMap ?? {}), [selectedConfigOutputId]: mapped };
                      updateSettings({ outputRoutingMap: next });
                    };

                    return (
                      <>
                        <Panel title="Output Settings" icon="display_settings" className="col-span-5">
                          <div className="grid gap-3">
                            {/* Source Routing Selector */}
                            <div className="border border-[#3c4a42] bg-[#0e0e11] p-3">
                              <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#4edea3]">
                                Signal Source Routing
                              </div>
                              {configOutput ? (
                                <>
                                  <div className="mb-2 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-[#4edea3]" />
                                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#e4e1e6]">
                                      Routing for: {configOutput.label}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <select
                                      value={currentRouteValue}
                                      onChange={(e) => handleRouteChange(e.target.value)}
                                      className="w-full border border-[#3c4a42] bg-[#131316] px-3 py-2 font-mono text-[11px] text-[#e4e1e6] focus:border-[#4edea3] focus:outline-none appearance-none"
                                      style={{ backgroundImage: "none" }}
                                    >
                                      {routingSourceOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#4edea3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3,4 6,7 9,4" />
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="mt-2 font-mono text-[9px] text-[#89968d]">
                                    → This source will project when GO LIVE is activated for {configOutput.label}
                                  </div>
                                </>
                              ) : (
                                <div className="flex h-16 items-center justify-center border border-dashed border-[#3c4a42]">
                                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#748078]">
                                    ← Select an output to configure routing
                                  </span>
                                </div>
                              )}
                            </div>

                            <Field label="Lower Third Style">
                              <Segmented
                                value={settings.lowerThirdStyle}
                                options={LOWER_THIRDS}
                                onChange={(lowerThirdStyle) =>
                                  updateSettings({
                                    lowerThirdStyle,
                                    scriptureLowerThirdStyle: lowerThirdStyle,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Resolution">
                              <Select
                                value={settings.defaultOutputResolution}
                                onChange={(defaultOutputResolution) => updateSettings({ defaultOutputResolution })}
                              >
                                {RESOLUTIONS.map((resolution) => (
                                  <option key={resolution}>{resolution}</option>
                                ))}
                              </Select>
                            </Field>
                            <ToggleRow
                              label="Alpha channel"
                              checked={settings.enableAlphaChannel}
                              onChange={(enableAlphaChannel) => updateSettings({ enableAlphaChannel })}
                            />
                            <ToggleRow
                              label="Screen mirror"
                              checked={settings.enableScreenMirrorOutput}
                              onChange={(enableScreenMirrorOutput) => updateSettings({ enableScreenMirrorOutput })}
                            />
                          </div>
                        </Panel>
                        <Panel title="Output Routing" icon="hub" className="col-span-7">
                          <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#748078]">
                            Click an output row to configure its source
                          </div>
                          <OutputGrid
                            outputs={selectedOutputs}
                            onToggle={toggleOutput}
                            selectedConfigId={selectedConfigOutputId}
                            onSelectConfig={(id) =>
                              setSelectedConfigOutputId((prev) => (prev === id ? undefined : id))
                            }
                          />
                          {selectedOutputs.length === 0 && (
                            <div className="mt-4 flex h-20 items-center justify-center border border-dashed border-[#3c4a42]">
                              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#748078]">
                                No outputs detected
                              </span>
                            </div>
                          )}
                          {/* Routing Summary Table */}
                          {selectedOutputs.length > 0 && (
                            <div className="mt-4 border border-[#24332b] bg-[#0e0e11]">
                              <div className="border-b border-[#24332b] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#4edea3]">
                                Active Routing Map
                              </div>
                              <table className="w-full table-fixed font-mono text-[10px]">
                                <tbody>
                                  {selectedOutputs.map((output) => {
                                    const src = settings.outputRoutingMap?.[output.id];
                                    const srcLabel =
                                      src === "PREVIEW"
                                        ? "Preview Canvas"
                                        : typeof src === "number"
                                          ? (state.cameraInputs?.find((c) => c.id === src)?.name ?? `Input ${src}`)
                                          : "Main Output";
                                    return (
                                      <tr
                                        key={output.id}
                                        className="border-b border-[#1f1f22] last:border-b-0"
                                      >
                                        <td className="truncate px-3 py-1.5 text-[#bbcabf]">{output.label}</td>
                                        <td className="truncate px-3 py-1.5 text-right text-[#4edea3]">
                                          → {srcLabel}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </Panel>
                      </>
                    );
                  })()}
                </>
              )}

              {active === "mapping" && <ScreenMapping outputs={selectedOutputs} />}
              {active === "ndi" && <NdiPipeline outputs={selectedOutputs} />}
              {active === "matrix" && <OutputMatrix outputs={selectedOutputs} onToggle={toggleOutput} settings={settings} updateSettings={updateSettings} />}

              {active === "patching" && <PatchMatrix outputs={selectedOutputs} onToggle={toggleOutput} />}

              {active === "video" && (
                <>
                  <Panel title="Input Discovery Matrix" icon="videocam" className="col-span-4">
                    <table className="w-full text-left font-mono text-[11px]">
                      <tbody>
                        {videoRows.map(([name, source, signal]) => (
                          <tr key={name} className="border-b border-[#3c4a42]">
                            <td className="py-2">
                              <div className="text-[#4edea3]">{name}</div>
                              <div className="text-[9px] uppercase tracking-[0.14em] text-[#86948a]">{source}</div>
                            </td>
                            <td className="py-2 text-right">{signal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                  <Panel title="Preview / Luma" icon="center_focus_strong" className="col-span-5">
                    <div className="flex h-64 items-center justify-center border border-[#3c4a42] bg-[#050506]">
                      <div className="text-center font-mono">
                        <Icon name="videocam" className="mb-2 text-[36px] text-[#4edea3]" />
                        <div className="text-[12px] uppercase tracking-[0.2em]">Media Device Preview</div>
                        <div className="mt-1 text-[10px] text-[#86948a]">{videoRows[0]?.[0]}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Bar value={68} />
                      <Bar value={48} tone="amber" />
                      <Bar value={28} />
                    </div>
                  </Panel>
                  <Panel title="Patch & Route" icon="output" className="col-span-3">
                    {["PGM Bus", "PIP Overlay", "ISO REC"].map((route, index) => (
                      <div key={route} className="mb-2 border border-[#3c4a42] bg-[#131316] p-2">
                        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#86948a]">{route}</div>
                        <div className="truncate font-mono text-[11px] text-[#4edea3]">{index === 0 ? videoRows[0]?.[0] : "UNASSIGNED"}</div>
                      </div>
                    ))}
                  </Panel>
                </>
              )}

              {active === "integrations" && (
                <>
                  <Panel title="Secure Integrations" icon="key" className="col-span-6">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="AWS Access Key">
                        <Input value={awsAccessKey} onChange={setAwsAccessKey} placeholder={hasAwsCreds ? "stored" : "missing"} />
                      </Field>
                      <Field label="AWS Secret">
                        <Input value={awsSecretKey} type="password" onChange={setAwsSecretKey} placeholder={hasAwsCreds ? "stored" : "missing"} />
                      </Field>
                      <Field label="AWS Region">
                        <Input value={awsRegion} onChange={setAwsRegion} />
                      </Field>
                      <Field label="Polly Voice">
                        <Input value={pollyVoice} onChange={setPollyVoice} />
                      </Field>
                      <button
                        type="button"
                        onClick={() => void saveIntegrations()}
                        className="mt-5 h-8 border border-[#4edea3] bg-[#10b981] font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#003824]"
                      >
                        Save Keys
                      </button>
                    </div>
                  </Panel>
                  <Panel title="Status" icon="security" className="col-span-6">
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="AWS Creds" value={hasAwsCreds ? "STORED" : "MISSING"} />
                      <Stat label="Region" value={awsRegion} />
                      <Stat label="Voice" value={pollyVoice} />
                      <button
                        type="button"
                        onClick={() => void chooseBibleDb()}
                        className="col-span-2 h-8 border border-[#3c4a42] bg-[#131316] font-mono text-[10px] uppercase tracking-[0.16em]"
                      >
                        {bibleDbPath ? "Bible DB Linked" : "Choose Bible DB"}
                      </button>
                    </div>
                  </Panel>
                </>
              )}

              {active === "about" && (
                <>
                  <Panel title="HallelujahBeamer" icon="settings_input_antenna" className="col-span-7">
                    <div className="flex h-72 flex-col items-center justify-center border border-[#3c4a42] bg-[#0e0e11] text-center">
                      <Icon name="settings_input_antenna" className="text-[52px] text-[#4edea3]" />
                      <div className="mt-3 text-[28px] font-semibold">HallelujahBeamer</div>
                      <div className="mt-2 border border-[#3c4a42] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
                        v0.1.0-stable
                      </div>
                      <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#4edea3]">
                        <Dot /> Activated
                      </div>
                    </div>
                  </Panel>
                  <Panel title="System Information" icon="memory" className="col-span-5">
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Build Node" value="XENO-09A" />
                      <Stat label="Runtime" value="V8.x" />
                      <Stat label="Hardware" value="HB-774-KPL" />
                      <Stat label="Updated" value="2026-04-12" />
                    </div>
                    <div className="mt-3 border border-[#3c4a42] bg-[#131316] p-3 text-[12px] leading-5 text-[#bbcabf]">
                      Core engine architecture and signal processing algorithms developed in-house.
                    </div>
                    <div className="mt-2 border border-[#3c4a42] bg-[#131316] p-3 font-mono text-[11px] leading-5 text-[#bbcabf]">
                      Proprietary software. Commercial deployment requires active validation.
                    </div>
                  </Panel>
                </>
              )}
            </div>
          </div>
        )}

        {active !== "audio" && (
          <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#3c4a42] bg-[#1f1f22] px-3">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[#bbcabf]">
              {status}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#86948a]">
              {state.isLiveMode ? "LIVE" : "STANDBY"}
            </span>
          </footer>
        )}
      </main>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex h-9 items-center justify-between border border-[#3c4a42] bg-[#131316] px-3">
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function OutputGrid({
  outputs,
  onToggle,
  selectedConfigId,
  onSelectConfig,
}: {
  outputs: Array<{ id: string; label: string; kind: string; selected: boolean }>;
  onToggle: (id: string) => Promise<void>;
  selectedConfigId?: string;
  onSelectConfig?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {outputs.map((output) => {
        const isConfigSelected = selectedConfigId === output.id;
        
        return (
          <div
            key={output.id}
            onClick={() => onSelectConfig?.(output.id)}
            className={cx(
              "flex h-12 items-center justify-between border pl-3 pr-2 text-left transition-colors",
              onSelectConfig ? "cursor-pointer hover:border-[#4edea3]/50" : "",
              isConfigSelected ? "border-[#4edea3] bg-[#2a2a2d]" : "border-[#3c4a42] bg-[#131316]"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#e4e1e6]">
                {output.label}
              </span>
              <span className="block font-mono text-[9px] text-[#86948a]">{output.kind}</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onToggle(output.id);
              }}
              className={cx(
                "flex h-7 px-3 shrink-0 items-center justify-center border font-mono text-[9px] font-bold uppercase tracking-[0.1em]",
                output.selected ? "border-[#4edea3] bg-[#10b981]/15 text-[#4edea3]" : "border-[#3c4a42] bg-[#0e0e11] text-[#86948a] hover:border-[#86948a]"
              )}
            >
              {output.selected ? "ACTIVE" : "STANDBY"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ScreenMapping({
  outputs,
}: {
  outputs: Array<{ id: string; label: string; kind: string; selected: boolean }>;
}) {
  return (
    <>
      <Panel title="Display Arrangement" icon="aspect_ratio" className="col-span-12">
        <div className="relative h-72 border border-[#3c4a42] bg-[#131316] bg-[radial-gradient(circle,#3c4a42_1px,transparent_1px)] bg-[length:20px_20px] p-6">
          <div className="flex h-full items-center justify-center gap-4 border border-dashed border-[#86948a]/70">
            {["Primary Monitor", "LED Wall", "Stage Display"].map((label, index) => (
              <div
                key={label}
                className={cx(
                  "flex flex-col justify-between border bg-black p-3 font-mono",
                  index === 0 ? "h-32 w-56 border-[#4edea3]" : "h-28 w-48 border-[#86948a]",
                )}
              >
                <div className="text-center text-[12px] uppercase tracking-[0.16em] text-[#4edea3]">
                  {label}
                </div>
                <div className="flex justify-between text-[10px] text-[#bbcabf]">
                  <span>{index === 2 ? "1280 x 720" : "1920 x 1080"}</span>
                  <span>{index === 1 ? "NDI-4" : index === 2 ? "DP-2" : "HDMI-1"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title="Output Routing Matrix" icon="hub" className="col-span-7">
        <CompactRows
          rows={PATCH_ROWS.map(([layer, destination, status]) => [layer, destination, status])}
        />
      </Panel>
      <Panel title="Coordinate Calibration" icon="straighten" className="col-span-5">
        <div className="grid grid-cols-2 gap-2">
          {["X Offset", "Y Offset", "Scale", "Rotation"].map((item, index) => (
            <Stat key={item} label={item} value={index === 2 ? "100" : "0"} />
          ))}
        </div>
      </Panel>
    </>
  );
}

function NdiPipeline({
  outputs,
}: {
  outputs: Array<{ id: string; label: string; kind: string; selected: boolean }>;
}) {
  return (
    <>
      <Panel title="NDI Source Discovery" icon="search" className="col-span-7">
        <CompactRows rows={FALLBACK_NDI.map(([a, b, c]) => [a, b, c])} />
      </Panel>
      <Panel title="Network Performance" icon="speed" className="col-span-5">
        <div className="space-y-3">
          <Stat label="Interface" value="Ethernet 1" />
          <Stat label="Bandwidth" value="482 Mbps" />
          <Stat label="Drops" value="0.02%" />
          <Bar value={72} />
        </div>
      </Panel>
      <Panel title="Output Patching Matrix" icon="grid_on" className="col-span-12">
        <OutputGrid outputs={outputs.filter((output) => output.kind === "NDI" || output.kind === "DISPLAY")} onToggle={async () => undefined} />
      </Panel>
    </>
  );
}

function OutputMatrix({
  outputs,
  onToggle,
  settings,
  updateSettings,
}: {
  outputs: Array<{ id: string; label: string; kind: string; selected: boolean }>;
  onToggle: (id: string) => Promise<void>;
  settings: SettingsSnapshot;
  updateSettings: (patch: Partial<SettingsSnapshot>) => void;
}) {
  return (
    <>
      <Panel title="Routing Matrix" icon="grid_on" className="col-span-8">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="text-[#86948a]">
            <tr className="border-b border-[#3c4a42]">
              <th className="py-2">OUTPUT</th>
              <th>STATUS</th>
              <th>RES</th>
              <th className="text-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {outputs.map((output) => (
              <tr key={output.id} className="border-b border-[#3c4a42]">
                <td className="py-2">{output.label}</td>
                <td className={output.selected ? "text-[#4edea3]" : "text-[#ffb95f]"}>
                  {output.selected ? "ACTIVE" : "STANDBY"}
                </td>
                <td>{output.kind === "DISPLAY" ? "4K" : "1080p"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => void onToggle(output.id)} className="text-[#4edea3]">
                    TOGGLE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Global Settings" icon="settings" className="col-span-4">
        <div className="space-y-2">
          <ToggleRow
            label="Output dimming"
            checked={settings.outputOpacity < 100}
            onChange={(enabled) => updateSettings({ outputOpacity: enabled ? 80 : 100 })}
          />
          <ToggleRow
            label="Safety margins"
            checked={settings.forceAspectRatio}
            onChange={(forceAspectRatio) => updateSettings({ forceAspectRatio })}
          />
          <ToggleRow
            label="Encryption"
            checked={settings.enableAlphaChannel}
            onChange={(enableAlphaChannel) => updateSettings({ enableAlphaChannel })}
          />
          <Stat label="AES" value="ACTIVE" />
        </div>
      </Panel>
    </>
  );
}

function PatchMatrix({
  outputs,
  onToggle,
}: {
  outputs: Array<{ id: string; label: string; kind: string; selected: boolean }>;
  onToggle: (id: string) => Promise<void>;
}) {
  return (
    <>
      <Panel title="Output Destination Matrix" icon="settings_input_component" className="col-span-7">
        <CompactRows rows={PATCH_ROWS.map(([a, b, c]) => [a, b, c])} />
      </Panel>
      <Panel title="Patch Controls" icon="precision_manufacturing" className="col-span-5">
        <OutputGrid outputs={outputs} onToggle={onToggle} />
      </Panel>
    </>
  );
}

function CompactRows({ rows }: { rows: Array<readonly [string, string, string]> }) {
  return (
    <table className="w-full table-fixed text-left font-mono text-[11px]">
      <tbody>
        {rows.map(([left, middle, right]) => (
          <tr key={`${left}-${middle}`} className="border-b border-[#3c4a42]">
            <td className="w-[42%] truncate py-2 text-[#e4e1e6]">{left}</td>
            <td className="truncate py-2 text-[#bbcabf]">{middle}</td>
            <td className="w-24 py-2 text-right text-[#4edea3]">{right}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
