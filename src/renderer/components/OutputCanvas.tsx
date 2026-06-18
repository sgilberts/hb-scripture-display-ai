import React, { useMemo, useEffect, useState, useRef } from "react";
import { useAppState } from "../context/AppState";
import { ThemeDefinition, LowerThirdStyle, ScriptureRecord, BackgroundStyle, CameraInput } from "../../shared/types";
import CanvasRenderer from "./CanvasRenderer";
import { LiveCamera } from "./LiveCamera";
import NetworkStreamView from "./NetworkStreamView";
import MediaChromaWrapper from "./MediaChromaWrapper";
import { hexToRgb, type ChromaKeySettings } from "../core/chromaKeyEngine";

interface OutputCanvasProps {
  className?: string;
  compact?: boolean;
  indicatorLabel?: string;
  indicatorTone?: "live" | "preview";
  forceThemeId?: string;
  forceTransparentBg?: boolean;
  overrideThemeDefinition?: any; // ThemeDefinition
  overrideText?: string;
  overrideReference?: string;
  renderCameras?: boolean;
  outputId?: string;
}

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export default function OutputCanvas({
  className,
  compact = false,
  indicatorLabel,
  indicatorTone = "preview",
  forceThemeId,
  forceTransparentBg = false,
  overrideThemeDefinition,
  overrideText,
  overrideReference,
  renderCameras = false,
  outputId,
}: OutputCanvasProps): JSX.Element {
  const { state } = useAppState();

  const textOutputRaw = overrideText !== undefined ? overrideText : (state.currentTextOutput || "");
  const referenceOutputRaw = overrideReference !== undefined ? overrideReference : (state.currentReferenceOutput || "");

  const routeSource = outputId ? state.outputRoutingMap?.[outputId] : undefined;

  React.useEffect(() => {
    if (!state.videoPlaybackState) return;
    for (const [cameraIdKey, shouldPlay] of Object.entries(state.videoPlaybackState)) {
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
  }, [state.videoPlaybackState, state.cameraInputs]);

  // Sync video time from IPC (ControlPanel acts as the master clock)
  React.useEffect(() => {
    if (!window.electron?.onSyncVideoTime) return;
    window.electron.onSyncVideoTime((cameraId, time) => {
      const videoElement = document.querySelector(`video[data-input-id="${cameraId}"]`) as HTMLVideoElement;
      if (videoElement && Math.abs(videoElement.currentTime - time) > 0.5) {
        videoElement.currentTime = time;
      }
    });
  }, []);

  const hasContent =
    textOutputRaw.trim().length > 0 ||
    referenceOutputRaw.trim().length > 0;
  const isLyricsContent = referenceOutputRaw === "LYRICS";
  const isTimerContent = referenceOutputRaw === "COUNTDOWN" || referenceOutputRaw === "STOPWATCH" || referenceOutputRaw === "TIME" || (textOutputRaw.includes(":") && !isNaN(Number(textOutputRaw.replace(/:/g, ""))));
  const isScriptureContent = !isLyricsContent && !isTimerContent && referenceOutputRaw.trim().length > 0;
  
  const activeTabType = isLyricsContent ? "LYRICS" : (isScriptureContent ? "SCRIPTURES" : (isTimerContent ? "TIMER" : "LYRICS"));
  const activeThemeId = forceThemeId || (state as any)[`defaultThemeId_${activeTabType}`];
  const activeCustomTheme = overrideThemeDefinition || (state.customThemes || []).find(t => t.id === activeThemeId);

  const activeLowerThirdStyle = activeCustomTheme?.lowerThirdStyle ?? (isLyricsContent
    ? state.lyricsLowerThirdStyle
    : state.scriptureLowerThirdStyle);
  const backgroundStyle = activeCustomTheme?.backgroundStyle ?? state.backgroundStyle;
  const backgroundTexture = activeCustomTheme?.backgroundTexture ?? state.backgroundTexture;
  const rawBgImagePath = activeCustomTheme?.backgroundImagePath ?? state.backgroundImagePath;
  const isBlobImage = rawBgImagePath?.startsWith('blob:');
  const backgroundImageUrl = (rawBgImagePath && !isBlobImage)
    ? (rawBgImagePath.startsWith('http') || rawBgImagePath.startsWith('data:') || rawBgImagePath.startsWith('file://'))
      ? rawBgImagePath
      : `file://${rawBgImagePath.replace(/\\/g, "/").replace(/ /g, "%20")}`
    : undefined;

  const bgPosX = activeCustomTheme?.backgroundPositionX ?? state.backgroundPositionX;
  const bgPosY = activeCustomTheme?.backgroundPositionY ?? state.backgroundPositionY;
  const textPosX = activeCustomTheme?.textPositionX ?? state.textPositionX;
  const textPosY = activeCustomTheme?.textPositionY ?? state.textPositionY;

  const fontColor = activeCustomTheme?.fontColor || undefined;
  const fontFamily = activeCustomTheme?.fontFamily || state.outputFontFamily;
  const referencePosition = activeCustomTheme?.referencePosition || "BELOW_TEXT";
  const referenceColor = activeCustomTheme?.referenceColor || undefined;
  const referenceSize = activeCustomTheme?.referenceSize || 100;
  const referenceEnabled = activeCustomTheme?.referenceEnabled ?? true;
  const referenceWeight = activeCustomTheme?.referenceWeight || "normal";

  const rawBgVideoPath = activeCustomTheme?.backgroundVideoPath;
  const isBlobVideo = rawBgVideoPath?.startsWith('blob:');
  const bgVideoUrl = (rawBgVideoPath && !isBlobVideo)
    ? (rawBgVideoPath.startsWith('http') || rawBgVideoPath.startsWith('data:') || rawBgVideoPath.startsWith('file://'))
      ? rawBgVideoPath
      : `file://${rawBgVideoPath.replace(/\\/g, "/").replace(/ /g, "%20")}`
    : undefined;

  const textOutput = hasContent
    ? textOutputRaw
    : "Let everything that has breath praise the LORD. Praise the LORD.";

  const showReference = referenceEnabled && !isLyricsContent && !isTimerContent && hasContent && referenceOutputRaw.trim().length > 0;
  
  const referenceOutput = hasContent
    ? referenceOutputRaw
    : "Psalm 150:6";
  const referenceWithTranslation = `${referenceOutput} • ${state.currentBibleTranslation || "KJV"}`;
  const fontScale = Math.max(0.6, Math.min(1.6, state.outputFontSize / 100));
  const fullTextSize = compact
    ? `clamp(${0.78 * fontScale}rem, ${1.35 * fontScale}vw, ${1.35 * fontScale}rem)`
    : `clamp(${2.2 * fontScale}rem, ${4.8 * fontScale}vw, ${4.8 * fontScale}rem)`;
  const refSizeFactor = referenceSize / 100;
  const fullReferenceSize = compact
    ? `clamp(${0.55 * fontScale * refSizeFactor}rem, ${0.8 * fontScale * refSizeFactor}vw, ${0.78 * fontScale * refSizeFactor}rem)`
    : `clamp(${0.85 * fontScale * refSizeFactor}rem, ${1.2 * fontScale * refSizeFactor}vw, ${1.2 * fontScale * refSizeFactor}rem)`;
  const lowerTextSize = compact
    ? `clamp(${0.72 * fontScale}rem, ${1.25 * fontScale}vw, ${1.25 * fontScale}rem)`
    : `clamp(${1.8 * fontScale}rem, ${3.4 * fontScale}vw, ${3.5 * fontScale}rem)`;
  const lowerReferenceSize = compact
    ? `clamp(${0.54 * fontScale * refSizeFactor}rem, ${0.76 * fontScale * refSizeFactor}vw, ${0.76 * fontScale * refSizeFactor}rem)`
    : `clamp(${0.8 * fontScale * refSizeFactor}rem, ${1.05 * fontScale * refSizeFactor}vw, ${1.05 * fontScale * refSizeFactor}rem)`;

  const isTransparent = forceTransparentBg || state.activeTheme === "TRANSPARENT" || backgroundStyle === "TRANSPARENT";

  const rootClasses = joinClasses(
    "relative isolate h-full w-full overflow-hidden text-white",
    !isTransparent && "bg-black",
    !isTransparent && state.activeTheme === "GREEN_SCREEN" && "bg-[#00b140]",
    isTransparent && "bg-transparent",
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
      textPosY < 34
        ? "flex-start"
        : textPosY > 66
          ? "flex-end"
          : "center",
    alignItems:
      textPosX < 34
        ? "flex-start"
        : textPosX > 66
          ? "flex-end"
          : "center"
  } as const;

  const renderInputMedia = (cameraId: number | null, depth = 0): React.ReactNode => {
    if (cameraId === null || depth > 3) return null;
    const cam = state.cameraInputs?.find(c => c.id === cameraId);
    if (!cam) return null;

    let themeIdForCamera = state.cameraThemeMap?.[cameraId];
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
    const effectiveMediaPath = cam.mediaPath || state.inputSettings?.[cameraId]?.mediaPath;
    const effectiveType = cam.type || state.inputSettings?.[cameraId]?.type || 'Camera';

    let mediaContent: React.ReactNode = null;
    if (effectiveType === "Image" && effectiveMediaPath) {
      mediaContent = <img src={effectiveMediaPath} alt="" className="w-full h-full object-contain" />;
    } else if (effectiveType === "Video" && effectiveMediaPath) {
      mediaContent = (
        <video
          key={`video-${cam.id}-${effectiveMediaPath}`}
          src={effectiveMediaPath}
          className="w-full h-full object-contain"
          loop
          playsInline
          autoPlay={state.videoPlaybackState?.[cam.id] ?? false}
          muted={compact || (state.audioMutedState?.[cam.id] ?? true)}
          data-input-id={cam.id}
          data-input-kind="video"
        />
      );
    } else if (cam.type === "Scripture") {
      mediaContent = (
        <div className="w-full h-full pointer-events-none">
          <OutputCanvas
            compact
            indicatorLabel=""
            indicatorTone="preview"
            forceThemeId={state.defaultThemeId_SCRIPTURES || undefined}
            forceTransparentBg={isTransparentTheme}
          />
        </div>
      );
    } else if (
      (effectiveType === "OMT" || effectiveType === "NDI" || (cam as any).networkStreamId) &&
      ((cam as any).networkStreamId || effectiveMediaPath)
    ) {
      mediaContent = (
        <NetworkStreamView
          streamId={(cam as any).networkStreamId || effectiveMediaPath}
          className="h-full w-full"
          muted={compact || (state.audioMutedState?.[cam.id] ?? true)}
          inputId={cam.id}
        />
      );
    } else if (effectiveType === "Camera" && effectiveMediaPath) {
      mediaContent = (
        <LiveCamera
          deviceId={effectiveMediaPath}
          className="w-full h-full object-cover"
          muted={compact || (state.audioMutedState?.[cam.id] ?? true)}
          data-input-id={cam.id}
          data-input-kind="camera"
        />
      );
    } else if (cam.type !== "Camera" && cam.type !== "Virtual Set" && cam.type !== "NDI") {
      mediaContent = null;
    }

    const posSettings = state.inputSettings?.[cameraId];
    const camZoom = posSettings?.zoom ?? 1;
    const camZoomX = posSettings?.zoomX ?? 1;
    const camZoomY = posSettings?.zoomY ?? 1;
    const camPanX = posSettings?.panX ?? 0;
    const camPanY = posSettings?.panY ?? 0;
    const camRotate = posSettings?.rotation ?? 0;
    const camCropL = posSettings?.cropLeft ?? 0;
    const camCropT = posSettings?.cropTop ?? 0;
    const camCropR = posSettings?.cropRight ?? 0;
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
            {state.inputSettings?.[cameraId]?.chromaEnabled && mediaContent ? (
              <MediaChromaWrapper
                node={mediaContent as React.ReactElement}
                settings={{
                  enabled: state.inputSettings[cameraId].chromaEnabled,
                  keyColor: hexToRgb(state.inputSettings[cameraId].chromaColor),
                  chromaKey: state.inputSettings[cameraId].chromaKey,
                  chromaKeyFilterEnabled: state.inputSettings[cameraId].chromaKeyFilterEnabled,
                  chromaKeyFilter: state.inputSettings[cameraId].chromaKeyFilter,
                  antiAliasing: state.inputSettings[cameraId].chromaAntiAliasing as any,
                  red: state.inputSettings[cameraId].chromaRed,
                  green: state.inputSettings[cameraId].chromaGreen,
                  blue: state.inputSettings[cameraId].chromaBlue,
                  lumaKey: state.inputSettings[cameraId].lumaKey || 0
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

    const multiviews = state.cameraMultiviews?.[cameraId];
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

  const cameraLayers = renderCameras ? (
    <div className="absolute inset-0 z-0">
      {state.outputInputId !== null && (
        <div className="absolute inset-0">{renderInputMedia(state.outputInputId)}</div>
      )}
      {[1, 2, 3, 4, 5, 6, 7, 8].map(layerNum => {
        const camId = state.layerToCameraMap?.[layerNum];
        if (camId === undefined) return null;
        return (
          <div key={layerNum} className="absolute inset-0" style={{ zIndex: layerNum }}>
            {renderInputMedia(camId)}
          </div>
        );
      })}
    </div>
  ) : null;

  if (routeSource === "PREVIEW") {
    return (
      <div className="absolute inset-0 bg-black overflow-hidden">
        {state.previewInputId !== null && (
          <div className="absolute inset-0">{renderInputMedia(state.previewInputId)}</div>
        )}
      </div>
    );
  }

  if (typeof routeSource === "number") {
    return (
      <div className="absolute inset-0 bg-black overflow-hidden">
        <div className="absolute inset-0">{renderInputMedia(routeSource)}</div>
      </div>
    );
  }

  if (outputId && routeSource !== "PREVIEW" && !state.isLiveMode) {
    return <div className="absolute inset-0 bg-black z-50" />;
  }

  if (renderCameras) {
    return (
      <div className="absolute inset-0 bg-black overflow-hidden">
        {cameraLayers}
      </div>
    );
  }

  if (activeCustomTheme && activeCustomTheme.canvasElements && activeCustomTheme.canvasElements.length > 0) {
    return (
      <section className={rootClasses}>
        {cameraLayers}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <CanvasRenderer
            theme={activeCustomTheme}
            elements={activeCustomTheme.canvasElements}
            textOverride={textOutput}
            referenceOverride={referenceOutput}
            forceTransparentBg={forceTransparentBg}
          />
        </div>
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
      </section>
    );
  }

  return (
    <section className={rootClasses} style={{ fontFamily }}>
      {cameraLayers}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {!forceTransparentBg && (backgroundStyle === "IMAGE" || backgroundStyle === "COMPOSITE") ? (
          backgroundImageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-no-repeat transition-all duration-700 ease-out"
              style={{
                backgroundImage: `url("${backgroundImageUrl}")`,
                backgroundPosition: `${bgPosX}% ${bgPosY}%`
              }}
            />
          ) : null
        ) : null}

        {!forceTransparentBg && backgroundStyle === "VIDEO" ? (
          bgVideoUrl ? (
            <video
              src={bgVideoUrl}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
              style={{
                objectPosition: `${bgPosX}% ${bgPosY}%`
              }}
              autoPlay
              loop
              muted={compact}
            />
          ) : null
        ) : null}

        {!forceTransparentBg && backgroundStyle === "SOLID" ? (
          <div className="absolute inset-0 bg-[#131316] transition-colors duration-700" />
        ) : null}

        {backgroundTexture !== "NONE" ? (
          <div
            className={joinClasses(
              "absolute inset-0 opacity-40 transition-opacity duration-700",
              backgroundTexture === "GRAIN" &&
              "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:6px_6px]",
              backgroundTexture === "DOT_GRID" &&
              "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:18px_18px]",
              backgroundTexture === "SOFT_NOISE" &&
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
      </div>

      {state.displayFormat === "FULL" ? (
        <div className="absolute inset-0 flex px-8 py-10 text-center sm:px-12 lg:px-16" style={positionStyle}>
          <div className="max-w-6xl">
            <h1
              className={joinClasses("font-semibold leading-[1.08] tracking-normal", !fontColor && "text-white")}
              style={{
                fontSize: fullTextSize,
                color: fontColor,
                overflowWrap: "anywhere",
                textShadow:
                  "0 6px 28px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.75), 0 0 42px rgba(0,0,0,0.45)"
              }}
            >
              {textOutput}
            </h1>
            {showReference && referencePosition === "BELOW_TEXT" && (
              <p
                className={joinClasses(
                  "uppercase tracking-[0.28em]",
                  !referenceColor && "text-white/80",
                  compact ? "mt-3" : "mt-5"
                )}
                style={{
                  fontSize: fullReferenceSize,
                  fontWeight: referenceWeight,
                  color: referenceColor,
                  textShadow:
                    "0 4px 18px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.75)"
                }}
              >
                {referenceWithTranslation}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex" style={positionStyle}>
          <div className="relative w-full">
            <div className={lowerThirdBackdropClasses} />
            <div className={lowerThirdContentClasses}>
              <div className={lowerThirdInnerClasses}>
                <h2
                  className={joinClasses("font-semibold leading-[1.1] tracking-normal", !fontColor && "text-white")}
                  style={{
                    fontSize: lowerTextSize,
                    color: fontColor,
                    overflowWrap: "anywhere",
                    textShadow:
                      "0 6px 24px rgba(0,0,0,0.92), 0 2px 8px rgba(0,0,0,0.8)"
                  }}
                >
                  {textOutput}
                </h2>
                {showReference && referencePosition === "BELOW_TEXT" && (
                  <p
                    className={joinClasses(
                      "mt-2 uppercase tracking-[0.24em]",
                      !referenceColor && (activeLowerThirdStyle === "BANNER" ? "text-white/78" : "text-[#6ffbbe]")
                    )}
                    style={{
                      fontSize: lowerReferenceSize,
                      fontWeight: referenceWeight,
                      color: referenceColor,
                      textShadow:
                        "0 4px 16px rgba(0,0,0,0.88), 0 1px 5px rgba(0,0,0,0.8)"
                    }}
                  >
                    {referenceWithTranslation}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Reference Position */}
      {showReference && referencePosition !== "BELOW_TEXT" && (
        <p
          className={joinClasses(
            "absolute uppercase tracking-[0.28em] z-20",
            !referenceColor && "text-white/80"
          )}
          style={{
            fontSize: state.displayFormat === "FULL" ? fullReferenceSize : lowerReferenceSize,
            fontWeight: referenceWeight,
            color: referenceColor,
            textShadow: "0 4px 18px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.75)",
            top: referencePosition.includes("TOP") ? (compact ? "10px" : "30px") : undefined,
            bottom: referencePosition.includes("BOTTOM") ? (compact ? "10px" : "30px") : undefined,
            left: referencePosition.includes("LEFT") ? (compact ? "10px" : "30px") : undefined,
            right: referencePosition.includes("RIGHT") ? (compact ? "10px" : "30px") : undefined,
          }}
        >
          {referenceWithTranslation}
        </p>
      )}
    </section>
  );
}
