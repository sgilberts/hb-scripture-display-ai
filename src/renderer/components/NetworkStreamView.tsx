import { useEffect, useRef, useState } from "react";

interface NetworkStreamViewProps {
  streamId?: string;
  className?: string;
  muted?: boolean;
  inputId?: number;
}

interface PlaneInfo {
  offset: number;
  length: number;
  bytesPerRow: number;
  bytesPerPixel: number;
}

interface FrameHeader {
  width: number;
  height: number;
  format?: string;
  planes: PlaneInfo[];
}

const MAGIC = "HBCF";
const FRAME_STALE_MS = 1500;

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function planeValue(
  data: Uint8Array,
  plane: PlaneInfo | undefined,
  x: number,
  y: number,
  fallback = 128,
): number {
  if (!plane) return fallback;
  const byteOffset = plane.offset + y * plane.bytesPerRow + x * plane.bytesPerPixel;
  return byteOffset >= plane.offset && byteOffset < plane.offset + plane.length
    ? data[byteOffset]
    : fallback;
}

function drawYuv420Frame(canvas: HTMLCanvasElement, header: FrameHeader, frameData: Uint8Array): void {
  const width = header.width;
  const height = header.height;
  if (!width || !height || header.planes.length < 1) return;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  const image = context.createImageData(width, height);
  const [yPlane, uPlane, vPlane] = header.planes;
  const out = image.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const chromaX = Math.floor(x / 2);
      const chromaY = Math.floor(y / 2);
      const yy = planeValue(frameData, yPlane, x, y, 16);
      const uu = planeValue(frameData, uPlane, chromaX, chromaY) - 128;
      const vv = planeValue(frameData, vPlane, chromaX, chromaY) - 128;
      const c = yy - 16;
      const index = (y * width + x) * 4;

      out[index] = clamp(1.164 * c + 1.596 * vv);
      out[index + 1] = clamp(1.164 * c - 0.392 * uu - 0.813 * vv);
      out[index + 2] = clamp(1.164 * c + 2.017 * uu);
      out[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}

function drawRgbaFrame(canvas: HTMLCanvasElement, header: FrameHeader, frameData: Uint8Array): boolean {
  const width = header.width;
  const height = header.height;
  const plane = header.planes[0];
  const expectedLength = width * height * 4;
  if (!width || !height || !plane || plane.length < expectedLength) return false;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return false;

  const start = plane.offset;
  const end = start + expectedLength;
  if (start < 0 || end > frameData.length) return false;

  const rgba = new Uint8ClampedArray(
    frameData.buffer,
    frameData.byteOffset + start,
    expectedLength,
  );
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  return true;
}

function parseAndDrawFrame(canvas: HTMLCanvasElement, payload: Uint8Array): boolean {
  if (payload.length < 8) return false;

  const magic = String.fromCharCode(payload[0], payload[1], payload[2], payload[3]);
  if (magic !== MAGIC) return false;

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const headerLength = view.getUint32(4, false);
  const headerStart = 8;
  const frameStart = headerStart + headerLength;
  if (headerLength <= 0 || frameStart > payload.length) return false;

  try {
    const headerJson = new TextDecoder().decode(payload.subarray(headerStart, frameStart));
    const header = JSON.parse(headerJson) as FrameHeader;
    const planeData = payload.subarray(frameStart);
    if (String(header.format ?? "").toLowerCase().includes("rgba")) {
      return drawRgbaFrame(canvas, header, planeData);
    }
    drawYuv420Frame(canvas, header, planeData);
    return true;
  } catch (error) {
    console.warn("[NetworkStreamView] Failed to decode camera frame:", error);
    return false;
  }
}

export default function NetworkStreamView({
  streamId,
  className = "",
  muted = true,
  inputId,
}: NetworkStreamViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef(0);
  const latestFrameRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const staleTimerRef = useRef<number | null>(null);
  const hasFrameRef = useRef(false);
  const [hasFrame, setHasFrame] = useState(false);

  const clearFrame = () => {
    latestFrameRef.current = null;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (staleTimerRef.current !== null) {
      window.clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasFrameRef.current = false;
    setHasFrame(false);
  };

  const markFrameReceived = () => {
    if (!hasFrameRef.current) {
      hasFrameRef.current = true;
      setHasFrame(true);
    }
    if (staleTimerRef.current !== null) {
      window.clearTimeout(staleTimerRef.current);
    }
    staleTimerRef.current = window.setTimeout(clearFrame, FRAME_STALE_MS);
  };

  useEffect(() => {
    if (!streamId || !window.electron?.onOmtVideoFrame) return undefined;

    const drawLatestFrame = () => {
      animationFrameRef.current = null;
      const payload = latestFrameRef.current;
      const canvas = canvasRef.current;
      latestFrameRef.current = null;
      if (payload && canvas && parseAndDrawFrame(canvas, payload)) {
        markFrameReceived();
      }
      if (latestFrameRef.current) {
        animationFrameRef.current = window.requestAnimationFrame(drawLatestFrame);
      }
    };

    return window.electron.onOmtVideoFrame((incomingStreamId, payload) => {
      if (incomingStreamId !== streamId || !canvasRef.current) return;
      latestFrameRef.current = payload;
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(drawLatestFrame);
      }
    });
  }, [streamId]);

  useEffect(() => {
    clearFrame();
  }, [streamId]);

  useEffect(() => {
    if (!streamId || !window.electron?.onNetworkStreamStopped) return undefined;
    return window.electron.onNetworkStreamStopped((incomingStreamId) => {
      if (incomingStreamId === streamId) {
        clearFrame();
      }
    });
  }, [streamId]);

  useEffect(() => {
    if (!streamId || !window.electron?.onOmtAudioChunk) return undefined;

    return window.electron.onOmtAudioChunk((incomingStreamId, payload) => {
      if (incomingStreamId !== streamId || muted || payload.length < 2) return;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = audioContextRef.current ?? new AudioContextCtor({ sampleRate: 48000 });
      audioContextRef.current = context;
      if (context.state === "suspended") {
        void context.resume().catch(() => {});
      }

      const samples = Math.floor(payload.length / 2);
      const buffer = context.createBuffer(1, samples, 48000);
      const channel = buffer.getChannelData(0);
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      for (let index = 0; index < samples; index++) {
        channel[index] = view.getInt16(index * 2, true) / 32768;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime + 0.02, nextAudioTimeRef.current);
      source.start(startAt);
      nextAudioTimeRef.current = startAt + buffer.duration;
    });
  }, [muted, streamId]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (staleTimerRef.current !== null) {
        window.clearTimeout(staleTimerRef.current);
      }
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <canvas
        ref={canvasRef}
        className="h-full w-full object-cover"
        data-input-id={inputId}
        data-input-kind="network"
      />
      {!hasFrame ? (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-[#4edea3]/40">
          WAITING FOR STREAM
        </div>
      ) : null}
    </div>
  );
}
