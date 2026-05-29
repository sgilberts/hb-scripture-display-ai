import { useAppState } from "../context/AppState";

interface OutputCanvasProps {
  className?: string;
  compact?: boolean;
  indicatorLabel?: string;
  indicatorTone?: "live" | "preview";
}

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export default function OutputCanvas({
  className,
  compact = false,
  indicatorLabel,
  indicatorTone = "preview"
}: OutputCanvasProps): JSX.Element {
  const { state } = useAppState();

  const hasContent =
    state.currentTextOutput.trim().length > 0 ||
    state.currentReferenceOutput.trim().length > 0;
  const isScriptureContent = state.currentReferenceOutput.trim().length > 0;
  const activeLowerThirdStyle = isScriptureContent
    ? state.scriptureLowerThirdStyle
    : state.lyricsLowerThirdStyle;
  const backgroundImageUrl = state.backgroundImagePath
    ? `file://${state.backgroundImagePath.replace(/\\/g, "/").replace(/ /g, "%20")}`
    : "";

  const textOutput = hasContent
    ? state.currentTextOutput
    : "Let everything that has breath praise the LORD. Praise the LORD.";

  const referenceOutput = hasContent
    ? state.currentReferenceOutput
    : "Psalm 150:6";
  const referenceWithTranslation = `${referenceOutput} • ${state.currentBibleTranslation}`;
  const fontScale = Math.max(0.6, Math.min(1.6, state.outputFontSize / 100));
  const fullTextSize = compact
    ? `clamp(${0.78 * fontScale}rem, ${1.35 * fontScale}vw, ${1.35 * fontScale}rem)`
    : `clamp(${2.2 * fontScale}rem, ${4.8 * fontScale}vw, ${4.8 * fontScale}rem)`;
  const fullReferenceSize = compact
    ? `clamp(${0.55 * fontScale}rem, ${0.8 * fontScale}vw, ${0.78 * fontScale}rem)`
    : `clamp(${0.85 * fontScale}rem, ${1.2 * fontScale}vw, ${1.2 * fontScale}rem)`;
  const lowerTextSize = compact
    ? `clamp(${0.72 * fontScale}rem, ${1.25 * fontScale}vw, ${1.25 * fontScale}rem)`
    : `clamp(${1.8 * fontScale}rem, ${3.4 * fontScale}vw, ${3.5 * fontScale}rem)`;
  const lowerReferenceSize = compact
    ? `clamp(${0.54 * fontScale}rem, ${0.76 * fontScale}vw, ${0.76 * fontScale}rem)`
    : `clamp(${0.8 * fontScale}rem, ${1.05 * fontScale}vw, ${1.05 * fontScale}rem)`;

  const rootClasses = joinClasses(
    "relative isolate h-full w-full overflow-hidden bg-black text-white",
    state.activeTheme === "GREEN_SCREEN" && "bg-[#00b140]",
    state.activeTheme === "TRANSPARENT" && "bg-transparent",
    className
  );

  const indicatorClasses =
    indicatorTone === "live"
      ? "border border-[#10b981] bg-[#10b981]/15 text-[#4edea3]"
      : "border border-[#3c4a42] bg-[#1f1f22]/85 text-[#bbcabf]";
  const lowerThirdBackdropClasses = joinClasses(
    "absolute inset-0",
    activeLowerThirdStyle === "BANNER"
      ? "bg-black/90"
      : activeLowerThirdStyle === "MINIMAL"
        ? "bg-[linear-gradient(0deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.62)_62%,rgba(0,0,0,0)_100%)]"
        : activeLowerThirdStyle === "CUSTOM"
          ? "bg-[linear-gradient(90deg,rgba(7,19,24,0.94)_0%,rgba(16,185,129,0.26)_58%,rgba(0,0,0,0)_100%)] backdrop-blur-sm"
          : "bg-[linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.84)_42%,rgba(0,0,0,0.42)_78%,rgba(0,0,0,0)_100%)]"
  );
  const lowerThirdContentClasses = joinClasses(
    "relative flex items-end",
    compact
      ? "min-h-[38%] px-4 py-4"
      : "min-h-[26vh] px-8 py-8 sm:px-10 lg:px-14",
    activeLowerThirdStyle === "BANNER" && "justify-center text-center",
    activeLowerThirdStyle !== "BANNER" && "text-left"
  );
  const lowerThirdInnerClasses = joinClasses(
    "max-w-5xl",
    activeLowerThirdStyle === "CLASSIC" && "border-l-4 border-[#10b981] pl-4 sm:pl-6",
    activeLowerThirdStyle === "BANNER" && "mx-auto",
    activeLowerThirdStyle === "MINIMAL" && "pl-0",
    activeLowerThirdStyle === "CUSTOM" &&
      "rounded border border-white/20 bg-black/20 px-4 py-3 shadow-[0_18px_52px_rgba(0,0,0,0.42)] sm:px-6"
  );

  const positionStyle = {
    justifyContent:
      state.textPositionY < 34
        ? "flex-start"
        : state.textPositionY > 66
          ? "flex-end"
          : "center",
    alignItems:
      state.textPositionX < 34
        ? "flex-start"
        : state.textPositionX > 66
          ? "flex-end"
          : "center"
  } as const;

  return (
    <section className={rootClasses} style={{ fontFamily: state.outputFontFamily }}>
      {state.backgroundStyle === "IMAGE" || state.backgroundStyle === "COMPOSITE" ? (
        backgroundImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url("${backgroundImageUrl}")`,
              backgroundPosition: `${state.backgroundPositionX}% ${state.backgroundPositionY}%`
            }}
          />
        ) : null
      ) : null}

      {state.backgroundStyle === "SOLID" ? (
        <div className="absolute inset-0 bg-[#131316]" />
      ) : null}

      {state.backgroundTexture !== "NONE" ? (
        <div
          className={joinClasses(
            "absolute inset-0 opacity-40",
            state.backgroundTexture === "GRAIN" &&
              "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:6px_6px]",
            state.backgroundTexture === "DOT_GRID" &&
              "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:18px_18px]",
            state.backgroundTexture === "SOFT_NOISE" &&
              "bg-[linear-gradient(45deg,rgba(255,255,255,0.05)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.05)_75%,transparent_75%,transparent)] bg-[length:12px_12px]"
          )}
        />
      ) : null}

      {state.activeTheme === "IMAGE" ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(59,130,246,0.24),transparent_24%),radial-gradient(circle_at_50%_78%,rgba(91,33,182,0.22),transparent_30%),linear-gradient(160deg,#030712_0%,#0f172a_48%,#111827_100%)]" />
          <div className="absolute inset-0 bg-black/25" />
        </>
      ) : null}

      {state.activeTheme === "TRANSPARENT" ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_50%)]" />
      ) : null}

      {indicatorLabel ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <span
            className={joinClasses(
              "rounded px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] backdrop-blur-sm",
              indicatorClasses
            )}
          >
            {indicatorLabel}
          </span>
          <span className="rounded border border-[#3c4a42] bg-black/35 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[#e4e1e6]/80 backdrop-blur-sm">
            {state.activeTheme}
          </span>
        </div>
      ) : null}

      {state.displayFormat === "FULL" ? (
        <div className="absolute inset-0 flex px-8 py-10 text-center sm:px-12 lg:px-16" style={positionStyle}>
          <div className="max-w-6xl">
            <h1
              className="font-semibold leading-[1.08] tracking-normal text-white"
              style={{
                fontSize: fullTextSize,
                overflowWrap: "anywhere",
                textShadow:
                  "0 6px 28px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.75), 0 0 42px rgba(0,0,0,0.45)"
              }}
            >
              {textOutput}
            </h1>
            <p
              className={joinClasses(
                "uppercase tracking-[0.28em] text-white/80",
                compact ? "mt-3" : "mt-5"
              )}
              style={{
                fontSize: fullReferenceSize,
                textShadow:
                  "0 4px 18px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.75)"
              }}
            >
              {referenceWithTranslation}
            </p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex" style={positionStyle}>
          <div className="relative w-full">
            <div className={lowerThirdBackdropClasses} />
            <div className={lowerThirdContentClasses}>
              <div className={lowerThirdInnerClasses}>
                <h2
                  className="font-semibold leading-[1.1] tracking-normal text-white"
                  style={{
                    fontSize: lowerTextSize,
                    overflowWrap: "anywhere",
                    textShadow:
                      "0 6px 24px rgba(0,0,0,0.92), 0 2px 8px rgba(0,0,0,0.8)"
                  }}
                >
                  {textOutput}
                </h2>
                <p
                  className={joinClasses(
                    "mt-2 uppercase tracking-[0.24em] text-[#6ffbbe]",
                    activeLowerThirdStyle === "BANNER" && "text-white/78"
                  )}
                  style={{
                    fontSize: lowerReferenceSize,
                    textShadow:
                      "0 4px 16px rgba(0,0,0,0.88), 0 1px 5px rgba(0,0,0,0.8)"
                  }}
                >
                  {referenceWithTranslation}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
