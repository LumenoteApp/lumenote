/** Track palettes + note color modes (RGB / rainbow transitions) */

export type ColorMode =
  | 'track'
  | 'palette'
  | 'palette_wave'
  | 'rainbow_time'
  | 'rainbow_pitch'
  | 'rainbow_wave'
  | 'spectrum'
  | 'rgb_chase';

export type ColorSettings = {
  mode: ColorMode;
  /** Active track palette preset id */
  paletteId: string;
  /** RGB / rainbow cycle speed */
  cycleSpeed: number;
  saturation: number;
  brightness: number;
  /** Mix track base color into dynamic modes (0 = pure RGB, 1 = stick to track) */
  trackBlend: number;
};

export type TrackPalettePreset = {
  id: string;
  name: string;
  blurb: string;
  colors: string[];
};

export type ColorModePreset = {
  id: ColorMode;
  name: string;
  blurb: string;
};

export const TRACK_PALETTE_PRESETS: TrackPalettePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Sky & pink hands',
    colors: ['#4FC3F7', '#F48FB1', '#CE93D8', '#A5D6A7', '#FFCC80', '#80CBC4'],
  },
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Club night lights',
    colors: ['#00F5FF', '#FF00E5', '#B8FF00', '#FF3D00', '#7B61FF', '#00FF9F'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    blurb: 'Deep teal & aqua',
    colors: ['#00B4D8', '#48CAE4', '#0077B6', '#90E0EF', '#023E8A', '#CAF0F8'],
  },
  {
    id: 'fire',
    name: 'Fire',
    blurb: 'Ember to gold',
    colors: ['#FF6B35', '#F7C59F', '#FFD23F', '#EF476F', '#FF9F1C', '#E71D36'],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    blurb: 'Soft candy tones',
    colors: ['#A8D8EA', '#AA96DA', '#FCBAD3', '#FFFFD2', '#B5EAD7', '#FFDAC1'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    blurb: 'Pink to orange sky',
    colors: ['#FF6B6B', '#FFA07A', '#FFD93D', '#C44569', '#F8B500', '#FF8E53'],
  },
  {
    id: 'ice',
    name: 'Ice',
    blurb: 'Frozen blues',
    colors: ['#E0F7FA', '#80DEEA', '#4DD0E1', '#B2EBF2', '#26C6DA', '#A7FFEB'],
  },
  {
    id: 'cyber',
    name: 'Cyber',
    blurb: 'Magenta / cyan',
    colors: ['#FF2A6D', '#05D9E8', '#D1F7FF', '#01012B', '#005678', '#FF6AD5'],
  },
  {
    id: 'forest',
    name: 'Forest',
    blurb: 'Moss & gold leaf',
    colors: ['#2D6A4F', '#95D5B2', '#D8F3DC', '#B7E4C7', '#FFB703', '#40916C'],
  },
  {
    id: 'mono',
    name: 'Mono',
    blurb: 'White / grey keys',
    colors: ['#F5F5F5', '#BDBDBD', '#90A4AE', '#ECEFF1', '#CFD8DC', '#FFFFFF'],
  },
  {
    id: 'royal',
    name: 'Royal',
    blurb: 'Purple & gold',
    colors: ['#7B2CBF', '#C77DFF', '#FFD700', '#E0AAFF', '#5A189A', '#FFBA08'],
  },
  {
    id: 'vapor',
    name: 'Vapor',
    blurb: 'Retrowave mix',
    colors: ['#FF71CE', '#01CDFE', '#05FFA1', '#B967FF', '#FFFB96', '#FF6AD5'],
  },
];

export const COLOR_MODE_PRESETS: ColorModePreset[] = [
  {
    id: 'palette',
    name: 'Palette',
    blurb: 'Scatter all palette colors by pitch',
  },
  {
    id: 'palette_wave',
    name: 'Palette wave',
    blurb: 'Palette colors scroll over time',
  },
  {
    id: 'track',
    name: 'Per track',
    blurb: 'One solid color per track',
  },
  { id: 'rainbow_time', name: 'RGB cycle', blurb: 'Full spectrum over time' },
  { id: 'rainbow_pitch', name: 'By pitch', blurb: 'Low→high rainbow' },
  { id: 'rainbow_wave', name: 'Wave', blurb: 'Scrolling RGB wave' },
  { id: 'spectrum', name: 'Spectrum', blurb: 'Bass/mid/high bands' },
  { id: 'rgb_chase', name: 'RGB chase', blurb: 'Fast chase + track mix' },
];

export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  // Scatter palette colors across notes (not one solid per track)
  mode: 'palette',
  paletteId: 'classic',
  cycleSpeed: 0.35,
  saturation: 0.9,
  brightness: 1,
  trackBlend: 0,
};

/** Merge partial / HMR-stale color settings with defaults */
export function normalizeColorSettings(partial?: Partial<ColorSettings> | null): ColorSettings {
  return {
    ...DEFAULT_COLOR_SETTINGS,
    ...(partial ?? {}),
    mode: partial?.mode ?? DEFAULT_COLOR_SETTINGS.mode,
    paletteId: partial?.paletteId ?? DEFAULT_COLOR_SETTINGS.paletteId,
    cycleSpeed: Number.isFinite(partial?.cycleSpeed as number)
      ? (partial!.cycleSpeed as number)
      : DEFAULT_COLOR_SETTINGS.cycleSpeed,
    saturation: Number.isFinite(partial?.saturation as number)
      ? (partial!.saturation as number)
      : DEFAULT_COLOR_SETTINGS.saturation,
    brightness: Number.isFinite(partial?.brightness as number)
      ? (partial!.brightness as number)
      : DEFAULT_COLOR_SETTINGS.brightness,
    trackBlend: Number.isFinite(partial?.trackBlend as number)
      ? (partial!.trackBlend as number)
      : DEFAULT_COLOR_SETTINGS.trackBlend,
  };
}

export function getPalette(id: string): string[] {
  return (
    TRACK_PALETTE_PRESETS.find((p) => p.id === id)?.colors ?? TRACK_PALETTE_PRESETS[0].colors
  );
}

export function applyPaletteToTracks<T extends { index: number; color: string }>(
  tracks: T[],
  paletteId: string,
): T[] {
  const colors = getPalette(paletteId);
  return tracks.map((t, i) => ({
    ...t,
    color: colors[i % colors.length],
  }));
}

/** HSV → hex */
export function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return `#${[R, G, B].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t,
  );
}

/**
 * Sample a palette with continuous index (wraps + lerps between neighbors).
 * t = 0 → colors[0], t = 1 → colors[1], …
 */
export function samplePalette(colors: string[], t: number): string {
  if (colors.length === 0) return '#ffffff';
  if (colors.length === 1) return colors[0];
  const n = colors.length;
  let x = t % n;
  if (x < 0) x += n;
  const i0 = Math.floor(x) % n;
  const i1 = (i0 + 1) % n;
  const frac = x - Math.floor(x);
  return mixHex(colors[i0], colors[i1], frac);
}

/** Soft sat/brightness adjust on a hex (for palette modes). */
function adjustHex(hex: string, saturation: number, brightness: number): string {
  const { r, g, b } = hexToRgb(hex);
  const s = Math.max(0, Math.min(1, saturation));
  const v = Math.max(0.2, Math.min(1.2, brightness));
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  const rs = (grey + (r - grey) * s) * v;
  const gs = (grey + (g - grey) * s) * v;
  const bs = (grey + (b - grey) * s) * v;
  return rgbToHex(rs, gs, bs);
}

/**
 * Resolve the display color for a note given mode + time.
 */
export function resolveNoteColor(opts: {
  trackColor: string;
  pitch: number;
  time: number;
  noteStart?: number;
  settings: ColorSettings;
}): string {
  const { trackColor, pitch, time, noteStart = 0, settings } = opts;
  const s = Math.max(0, Math.min(1, settings.saturation));
  const v = Math.max(0.2, Math.min(1.2, settings.brightness));
  const speed = settings.cycleSpeed;
  const blend = Math.max(0, Math.min(1, settings.trackBlend));
  const palette = getPalette(settings.paletteId);

  let dynamic = trackColor;

  switch (settings.mode) {
    case 'track':
      // Solid per-track color only (palette assigns one swatch per track)
      return trackColor;

    case 'palette': {
      // Scatter every palette color across the keyboard by pitch
      // Optional slow drift via cycleSpeed so it still feels alive
      const span = Math.max(1, palette.length - 0.001);
      const pitchT = ((pitch - 21) / (108 - 21)) * span;
      const drift = time * speed * 0.35;
      dynamic = adjustHex(samplePalette(palette, pitchT + drift), s, v);
      break;
    }

    case 'palette_wave': {
      // Palette colors scroll with time + pitch (like RGB wave but locked to swatches)
      dynamic = adjustHex(
        samplePalette(palette, pitch * 0.12 + time * speed * 2.4 + noteStart * 0.55),
        s,
        v,
      );
      break;
    }

    case 'rainbow_time': {
      // Full RGB loop - continuous hue spin
      const hue = (time * speed * 120) % 360;
      dynamic = hsvToHex(hue, s, Math.min(1, v));
      break;
    }

    case 'rainbow_pitch': {
      // Map A0-C8 → full hue wheel
      const t = (pitch - 21) / (108 - 21);
      const hue = (t * 300 + time * speed * 20) % 360;
      dynamic = hsvToHex(hue, s, Math.min(1, v));
      break;
    }

    case 'rainbow_wave': {
      // Scrolling wave across pitch + time
      const hue = (pitch * 4.5 + time * speed * 180 + noteStart * 40) % 360;
      dynamic = hsvToHex(hue, s, Math.min(1, v));
      break;
    }

    case 'spectrum': {
      // Bass → red/orange, mid → green/cyan, high → blue/violet
      let hue: number;
      if (pitch < 48) hue = 0 + (pitch - 21) * 1.5;
      else if (pitch <= 72) hue = 100 + (pitch - 48) * 2.5;
      else hue = 200 + (pitch - 72) * 3;
      hue = (hue + time * speed * 40) % 360;
      dynamic = hsvToHex(hue, s, Math.min(1, v));
      break;
    }

    case 'rgb_chase': {
      // Fast RGB primary chase mixed with soft rainbow
      const phase = time * speed * 4;
      const primaries = [0, 120, 240]; // R G B hues
      const idx = Math.floor(phase) % 3;
      const next = (idx + 1) % 3;
      const frac = phase - Math.floor(phase);
      const hue = primaries[idx] + (primaries[next] - primaries[idx]) * frac;
      // add pitch shimmer
      dynamic = hsvToHex((hue + pitch * 0.8) % 360, s, Math.min(1, v));
      break;
    }
  }

  if (blend <= 0.001) return dynamic;
  return mixHex(dynamic, trackColor, blend);
}

/** Palette swatch colors for UI preview of dynamic modes */
export function modePreviewColors(mode: ColorMode, time = 0): string[] {
  if (mode === 'track') return getPalette('classic').slice(0, 4);
  if (mode === 'palette' || mode === 'palette_wave') {
    return getPalette('neon').slice(0, 5);
  }
  const settings: ColorSettings = {
    ...DEFAULT_COLOR_SETTINGS,
    mode,
    cycleSpeed: 0.5,
    trackBlend: 0,
  };
  return [36, 48, 60, 72, 84].map((pitch) =>
    resolveNoteColor({ trackColor: '#4FC3F7', pitch, time, settings }),
  );
}
