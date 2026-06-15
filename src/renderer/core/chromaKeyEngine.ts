/**
 * chromaKeyEngine.ts
 *
 * Pure‑logic chroma key processing module.
 * Implements a real-time chroma keyer using keyed-colour distance matting.
 * Generates true alpha-channel transparency, features edge feathering (smoothness),
 * and advanced spill suppression for green/blue screens.
 *
 * No React or DOM dependencies — operates exclusively on canvas primitives.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChromaKeySettings {
  enabled: boolean;
  keyColor: { r: number; g: number; b: number };
  /** 0‑100 — main key strength / similarity tolerance */
  chromaKey: number;
  chromaKeyFilterEnabled: boolean;
  /** 0‑100 — spill suppression and edge smoothness strength */
  chromaKeyFilter: number;
  antiAliasing: 'Off' | 'Low' | 'Medium' | 'High';
  /** Per‑channel fine‑tune offsets (-100..100) */
  red: number;
  green: number;
  blue: number;
  /** 0‑100 — brightness‑based keying */
  lumaKey: number;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Core per‑frame processor
// ---------------------------------------------------------------------------

/**
 * Process one frame of chroma key.
 *
 * @param source  The source element to read from (video, image, or canvas).
 * @param canvas  The destination canvas to write keyed output to.
 * @param settings  Current chroma key parameter snapshot.
 *
 * Returns `true` if a frame was processed, `false` if the source was not ready.
 */
export function processChromaKeyFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  canvas: HTMLCanvasElement,
  settings: ChromaKeySettings,
): boolean {
  if (!settings.enabled) return false;

  // Determine source dimensions
  let sw = 0;
  let sh = 0;
  if (source instanceof HTMLVideoElement) {
    sw = source.videoWidth;
    sh = source.videoHeight;
    if (sw === 0 || sh === 0) return false; // video not ready
  } else if (source instanceof HTMLImageElement) {
    sw = source.naturalWidth;
    sh = source.naturalHeight;
    if (sw === 0 || sh === 0) return false;
  } else {
    sw = source.width;
    sh = source.height;
  }
  if (sw === 0 || sh === 0) return false;

  // Cap processing resolution for performance (process at ≤ 1280px wide for decent quality)
  const MAX_W = 1280;
  let pw = sw;
  let ph = sh;
  if (pw > MAX_W) {
    const scale = MAX_W / pw;
    pw = MAX_W;
    ph = Math.round(sh * scale);
  }

  // Ensure canvas matches output size
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
  if (!ctx) return false;

  // Always draw the live source first so enabling chroma never blanks preview
  // while the user is tuning the key.
  ctx.clearRect(0, 0, pw, ph);
  ctx.drawImage(source, 0, 0, pw, ph);

  const imageData = ctx.getImageData(0, 0, pw, ph);
  const data = imageData.data;

  // Target key color with user-defined R/G/B offset adjustments
  const keyR = clamp(settings.keyColor.r + (settings.red * 1.28), 0, 255);
  const keyG = clamp(settings.keyColor.g + (settings.green * 1.28), 0, 255);
  const keyB = clamp(settings.keyColor.b + (settings.blue * 1.28), 0, 255);

  // Auto-detect green vs blue screen for targeted spill suppression
  const isGreenScreen = keyG > keyR && keyG > keyB;
  const isBlueScreen = keyB > keyR && keyB > keyG;

  // Convert key color to YCbCr for professional chrominance-based keying
  const keyY = 0.299 * keyR + 0.587 * keyG + 0.114 * keyB;
  const keyCb = -0.168736 * keyR - 0.331264 * keyG + 0.5 * keyB;
  const keyCr = 0.5 * keyR - 0.418688 * keyG - 0.081312 * keyB;

  // Base tolerance and feather for smoothstep
  // Even at chromaKey = 0, distance 0 will be keyed out (alpha = 0)
  const tolerance = (clamp(settings.chromaKey, 0, 100) / 100) * 80;
  const feather = settings.chromaKeyFilterEnabled
    ? 2 + clamp(settings.chromaKeyFilter, 0, 100) * 0.8
    : 1.5; // Small default feather for antialiasing
  const spill = settings.chromaKeyFilterEnabled
    ? clamp(settings.chromaKeyFilter, 0, 100) / 100
    : 0;
  const lumaKeyThresh = clamp(settings.lumaKey, 0, 100) / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // Ignore fully transparent pixels
    if (data[i + 3] === 0) continue;

    // Convert pixel to YCbCr
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;

    // Chrominance distance is primary, luma distance is lightly penalized
    // so we don't accidentally key out bright white or pitch black
    const chromaDist = Math.sqrt((cb - keyCb) ** 2 + (cr - keyCr) ** 2);
    const lumaDist = Math.abs(y - keyY);
    const colorDistance = chromaDist + (lumaDist * 0.1);

    // --- Generate Transparency (Alpha) ---
    const alpha = smoothstep(tolerance, tolerance + feather, colorDistance);

    // --- Luma Key ---
    if (lumaKeyThresh > 0) {
      const v = Math.max(r, g, b) / 255;
      if (v < lumaKeyThresh) {
        const lumaAlpha = v / lumaKeyThresh;
        data[i + 3] = Math.round(Math.min(alpha, lumaAlpha) * 255);
      } else {
        data[i + 3] = Math.round(alpha * 255);
      }
    } else {
      data[i + 3] = Math.round(alpha * 255);
    }

    // --- Spill Suppression ---
    // Remove colored halos and reflections from edge pixels
    if (spill > 0 && colorDistance < tolerance + feather + 90) {
        let spillFactor = 1.0 - alpha;
        
        if (alpha === 1.0) {
             // For pixels just outside the matte, apply gentle despill to remove fringes
             const distToEdge = colorDistance - (tolerance + feather);
             spillFactor = Math.max(0, 1.0 - (distToEdge / 90));
        }
        spillFactor *= Math.max(0.25, spill);

        if (spillFactor > 0) {
            if (isGreenScreen) {
                // Despill green: bound green channel by the average of red and blue
                const despillTarget = Math.min(g, (r + b) / 2);
                g = Math.round(g * (1 - spillFactor) + despillTarget * spillFactor);
            } else if (isBlueScreen) {
                // Despill blue: bound blue channel by the average of red and green
                const despillTarget = Math.min(b, (r + g) / 2);
                b = Math.round(b * (1 - spillFactor) + despillTarget * spillFactor);
            } else {
                 // Generic despill: bring color towards gray
                 const grey = (r + g + b) / 3;
                 r = Math.round(r * (1 - spillFactor * 0.5) + grey * spillFactor * 0.5);
                 g = Math.round(g * (1 - spillFactor * 0.5) + grey * spillFactor * 0.5);
                 b = Math.round(b * (1 - spillFactor * 0.5) + grey * spillFactor * 0.5);
            }
        }
    }

    // Write modified RGB and true Alpha back to buffer
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  // --- Anti‑aliasing (box blur on alpha channel only) ---
  const aaRadius = settings.antiAliasing === 'High' ? 3
    : settings.antiAliasing === 'Medium' ? 2
      : settings.antiAliasing === 'Low' ? 1
        : 0;

  if (aaRadius > 0) {
    blurAlphaChannel(data, pw, ph, aaRadius);
  }

  // Apply the processed true-transparent pixels back to the canvas
  ctx.putImageData(imageData, 0, 0);
  return true;
}

// ---------------------------------------------------------------------------
// Alpha‑channel box blur for anti‑aliasing
// ---------------------------------------------------------------------------

function blurAlphaChannel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  // Separable box blur — horizontal then vertical passes
  const alphaBuffer = new Uint8ClampedArray(width * height);

  // Extract alpha
  for (let i = 0; i < width * height; i++) {
    alphaBuffer[i] = data[i * 4 + 3];
  }

  const temp = new Uint8ClampedArray(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += alphaBuffer[y * width + nx];
          count++;
        }
      }
      temp[y * width + x] = Math.round(sum / count);
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += temp[ny * width + x];
          count++;
        }
      }
      data[(y * width + x) * 4 + 3] = Math.round(sum / count);
    }
  }
}

// ---------------------------------------------------------------------------
// Auto‑configure from a sampled colour
// ---------------------------------------------------------------------------

/**
 * Given a sampled key colour, return professional starter values for chroma key
 * controls based on detected green vs blue screen characteristics.
 */
export function computeAutoChromaSettings(keyColor: { r: number; g: number; b: number }): {
  chromaKey: number;
  chromaKeyFilterEnabled: boolean;
  chromaKeyFilter: number;
  red: number;
  green: number;
  blue: number;
} {
  const isGreen = keyColor.g > keyColor.r && keyColor.g > keyColor.b;
  const isBlue = keyColor.b > keyColor.r && keyColor.b > keyColor.g;

  // We provide a solid default that matches a "clean screen" profile.
  // The user can then use presets (1, 2, 3) for edge cases.
  
  if (isGreen) {
    return {
      chromaKey: 45,
      chromaKeyFilterEnabled: true,
      chromaKeyFilter: 25,
      red: -40,
      green: -10,
      blue: 0,
    };
  }

  if (isBlue) {
    return {
      chromaKey: 45,
      chromaKeyFilterEnabled: true,
      chromaKeyFilter: 25,
      red: -10,
      green: -10,
      blue: -40,
    };
  }

  // Generic fallback
  return {
    chromaKey: 40,
    chromaKeyFilterEnabled: false,
    chromaKeyFilter: 0,
    red: 0,
    green: 0,
    blue: 0,
  };
}
