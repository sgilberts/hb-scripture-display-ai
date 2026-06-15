/**
 * ChromaKeyCanvas.tsx
 *
 * React component that renders a real‑time chroma‑keyed version of a source
 * media element (video, image, or live camera) onto a visible <canvas>.
 *
 * Uses requestAnimationFrame for smooth frame‑by‑frame processing.
 * Shows a checkerboard pattern behind the canvas so keyed‑out areas are visible.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { processChromaKeyFrame, type ChromaKeySettings } from '../core/chromaKeyEngine';

interface ChromaKeyCanvasProps {
  /** A ref to the source media element to key */
  sourceRef: React.RefObject<HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null>;
  /** Current chroma key settings snapshot */
  settings: ChromaKeySettings;
  /** Standard className for sizing */
  className?: string;
  /** Standard inline style */
  style?: React.CSSProperties;
  /** Whether to show the checkerboard transparency indicator */
  showCheckerboard?: boolean;
  /** Called when the canvas successfully renders a keyed frame */
  onFrameProcessed?: () => void;
}

/** CSS for the classic Photoshop‑style checkerboard transparency pattern */
const CHECKERBOARD_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), ' +
    'linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, #2a2a2a 75%), ' +
    'linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  backgroundColor: '#1a1a1a',
};

export default function ChromaKeyCanvas({
  sourceRef,
  settings,
  className,
  style,
  showCheckerboard = true,
  onFrameProcessed,
}: ChromaKeyCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef<number>(0);
  const settingsRef = useRef(settings);
  const frameErrorCountRef = useRef(0);
  const hasReportedFrameRef = useRef(false);

  // Keep a mutable ref to the latest settings so the rAF loop always reads
  // current values without needing to restart the loop on every change.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const processFrame = useCallback(() => {
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      if (processChromaKeyFrame(source, canvas, settingsRef.current)) {
        frameErrorCountRef.current = 0;
        if (!hasReportedFrameRef.current) {
          hasReportedFrameRef.current = true;
          onFrameProcessed?.();
        }
      }
    } catch (error) {
      frameErrorCountRef.current += 1;
      if (frameErrorCountRef.current <= 3) {
        console.warn('Chroma key frame processing skipped', error);
      }
    }

    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [sourceRef]);

  // Start / stop the rAF loop
  useEffect(() => {
    if (!settings.enabled) return;

    rafIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [settings.enabled, processFrame]);

  const containerStyle: React.CSSProperties = {
    ...(showCheckerboard ? CHECKERBOARD_BG : {}),
    ...style,
  };

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', ...containerStyle }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
}
