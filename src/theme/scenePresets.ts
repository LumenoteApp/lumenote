import type { VisualSettings } from '../midi/types';
import type { InstrumentId } from '../engine/instruments';
import { DEFAULT_VISUAL_SETTINGS } from './defaultPalette';
import { normalizeColorSettings } from './colorPresets';
import { getPreset as getParticlePreset } from './particlePresets';

const STORAGE_KEY = 'notefall-scene-presets-v1';

/** Full snapshot of the studio look + sound */
export type ScenePresetData = {
  settings: VisualSettings;
  instrumentId: InstrumentId;
  volume: number;
};

export type ScenePreset = ScenePresetData & {
  id: string;
  name: string;
  blurb: string;
  /** Built-in factory presets cannot be deleted */
  builtIn: boolean;
  /** ISO date when user saved */
  savedAt?: string;
};

function cloneSettings(s: VisualSettings): VisualSettings {
  return {
    ...s,
    particles: { ...s.particles },
    background: { ...s.background },
    musicReactive: { ...s.musicReactive },
    colors: normalizeColorSettings(s.colors),
  };
}

export function captureScene(
  settings: VisualSettings,
  instrumentId: InstrumentId,
  volume: number,
): ScenePresetData {
  // Don't persist custom SF2 as playable without the file — store id but UI will warn
  return {
    settings: cloneSettings(settings),
    instrumentId,
    volume,
  };
}

/** Merge loaded JSON with defaults so older presets still work */
export function hydrateSceneData(raw: Partial<ScenePresetData> | null | undefined): ScenePresetData {
  const base = captureScene(DEFAULT_VISUAL_SETTINGS, 'piano', 0.85);
  if (!raw) return base;
  const s = raw.settings ?? base.settings;
  return {
    instrumentId: (raw.instrumentId as InstrumentId) || 'piano',
    volume: typeof raw.volume === 'number' ? raw.volume : 0.85,
    settings: {
      ...DEFAULT_VISUAL_SETTINGS,
      ...s,
      particles: {
        ...DEFAULT_VISUAL_SETTINGS.particles,
        ...(s.particles ?? {}),
      },
      background: {
        ...DEFAULT_VISUAL_SETTINGS.background,
        ...(s.background ?? {}),
      },
      musicReactive: {
        ...DEFAULT_VISUAL_SETTINGS.musicReactive,
        ...(s.musicReactive ?? {}),
      },
      colors: normalizeColorSettings(s.colors ?? DEFAULT_VISUAL_SETTINGS.colors),
    },
  };
}

function makeBuiltIn(
  id: string,
  name: string,
  blurb: string,
  partial: {
    settings?: Partial<VisualSettings> & {
      particles?: Partial<VisualSettings['particles']>;
      background?: Partial<VisualSettings['background']>;
      musicReactive?: Partial<VisualSettings['musicReactive']>;
      colors?: Partial<VisualSettings['colors']>;
    };
    instrumentId?: InstrumentId;
    volume?: number;
  },
): ScenePreset {
  const base = captureScene(DEFAULT_VISUAL_SETTINGS, 'piano', 0.85);
  const ps = partial.settings ?? {};
  return {
    id,
    name,
    blurb,
    builtIn: true,
    instrumentId: partial.instrumentId ?? 'piano',
    volume: partial.volume ?? 0.85,
    settings: {
      ...base.settings,
      ...ps,
      particles: { ...base.settings.particles, ...(ps.particles ?? {}) },
      background: { ...base.settings.background, ...(ps.background ?? {}) },
      musicReactive: { ...base.settings.musicReactive, ...(ps.musicReactive ?? {}) },
      colors: normalizeColorSettings({ ...base.settings.colors, ...(ps.colors ?? {}) }),
    },
  };
}

const ember = getParticlePreset('ember').params;
const neon = getParticlePreset('neon').params;
const stardust = getParticlePreset('stardust').params;
const aurora = getParticlePreset('aurora').params;
const inferno = getParticlePreset('inferno').params;
const crystal = getParticlePreset('crystal').params;
const soft = getParticlePreset('soft').params;

/** Factory lookbooks shipped with the app */
export const BUILTIN_SCENE_PRESETS: ScenePreset[] = [
  makeBuiltIn('classic-ember', 'Classic Ember', 'Warm rising sparks, balanced reactive field', {
    instrumentId: 'piano',
    volume: 0.85,
    settings: {
      particlePresetId: 'ember',
      particles: { ...ember },
      particlesEnabled: true,
      background: {
        enabled: true,
        style: 'nebula',
        intensity: 0.75,
        parallax: 0.45,
        stars: 0.55,
        orbs: 0.7,
        waves: 0.45,
        beams: 0.3,
        reactive: 0.85,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.95,
        ambient: 0.75,
        columns: 0.85,
        waves: 0.75,
        bassPulse: 0.65,
        attack: 0.7,
      },
      musicReactivePresetId: 'balanced',
      colors: {
        mode: 'track',
        paletteId: 'classic',
        cycleSpeed: 0.35,
        saturation: 0.9,
        brightness: 1,
        trackBlend: 0.15,
      },
      glowStrength: 0.7,
      hitRailIntensity: 0.85,
      backgroundColor: '#07080c',
    },
  }),

  makeBuiltIn('neon-rave', 'Neon Rave', 'Electric bursts, pulse beams, RGB chase', {
    instrumentId: 'chiptune',
    volume: 0.8,
    settings: {
      particlePresetId: 'neon',
      particles: { ...neon },
      particlesEnabled: true,
      pixelsPerSecond: 320,
      glowStrength: 0.95,
      noteOpacity: 0.95,
      background: {
        enabled: true,
        style: 'pulse',
        intensity: 0.95,
        parallax: 0.7,
        stars: 0.3,
        orbs: 0.85,
        waves: 0.25,
        beams: 1,
        reactive: 1.1,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.25,
        ambient: 0.9,
        columns: 1.1,
        waves: 1.2,
        bassPulse: 1.15,
        attack: 1.05,
      },
      musicReactivePresetId: 'rave',
      colors: {
        mode: 'rgb_chase',
        paletteId: 'neon',
        cycleSpeed: 0.85,
        saturation: 1,
        brightness: 1.1,
        trackBlend: 0.1,
      },
      backgroundColor: '#05010a',
      hitRailIntensity: 1.05,
    },
  }),

  makeBuiltIn('chill-aurora', 'Chill Aurora', 'Soft floating haze and gentle streams', {
    instrumentId: 'pad',
    volume: 0.75,
    settings: {
      particlePresetId: 'aurora',
      particles: { ...aurora },
      particlesEnabled: true,
      pixelsPerSecond: 200,
      glowStrength: 0.55,
      noteOpacity: 0.85,
      background: {
        enabled: true,
        style: 'aurora',
        intensity: 0.85,
        parallax: 0.35,
        stars: 0.4,
        orbs: 0.6,
        waves: 0.95,
        beams: 0.15,
        reactive: 0.7,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.6,
        ambient: 1.05,
        columns: 0.45,
        waves: 0.3,
        bassPulse: 0.35,
        attack: 0.4,
      },
      musicReactivePresetId: 'chill',
      colors: {
        mode: 'rainbow_pitch',
        paletteId: 'ocean',
        cycleSpeed: 0.2,
        saturation: 0.7,
        brightness: 0.95,
        trackBlend: 0.25,
      },
      backgroundColor: '#060a10',
      hitRailIntensity: 0.55,
    },
  }),

  makeBuiltIn('cyber-night', 'Cyber Night', 'Magenta/cyan grid, crystal shards', {
    instrumentId: 'epiano',
    volume: 0.82,
    settings: {
      particlePresetId: 'crystal',
      particles: { ...crystal },
      particlesEnabled: true,
      pixelsPerSecond: 300,
      glowStrength: 0.8,
      background: {
        enabled: true,
        style: 'grid',
        intensity: 0.85,
        parallax: 0.75,
        stars: 0.35,
        orbs: 0.25,
        waves: 0,
        beams: 0.35,
        reactive: 0.9,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.05,
        ambient: 0.55,
        columns: 0.9,
        waves: 0.95,
        bassPulse: 0.8,
        attack: 0.9,
      },
      musicReactivePresetId: 'pulse',
      colors: {
        mode: 'spectrum',
        paletteId: 'cyber',
        cycleSpeed: 0.45,
        saturation: 0.95,
        brightness: 1.05,
        trackBlend: 0.2,
      },
      backgroundColor: '#04060e',
      hitRailIntensity: 0.95,
    },
  }),

  makeBuiltIn('inferno', 'Inferno', 'Heavy fire particles and rising columns', {
    instrumentId: 'organ',
    volume: 0.88,
    settings: {
      particlePresetId: 'inferno',
      particles: { ...inferno },
      particlesEnabled: true,
      pixelsPerSecond: 290,
      glowStrength: 0.9,
      background: {
        enabled: true,
        style: 'nebula',
        intensity: 0.9,
        parallax: 0.55,
        stars: 0.25,
        orbs: 0.95,
        waves: 0.35,
        beams: 0.5,
        reactive: 1,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.15,
        ambient: 0.7,
        columns: 1.25,
        waves: 0.85,
        bassPulse: 1.1,
        attack: 0.85,
      },
      musicReactivePresetId: 'streams',
      colors: {
        mode: 'track',
        paletteId: 'fire',
        cycleSpeed: 0.4,
        saturation: 1,
        brightness: 1.05,
        trackBlend: 0,
      },
      backgroundColor: '#0c0604',
      hitRailIntensity: 1,
    },
  }),

  makeBuiltIn('stardust-void', 'Stardust Void', 'Deep space glitter and fine dust', {
    instrumentId: 'strings',
    volume: 0.78,
    settings: {
      particlePresetId: 'stardust',
      particles: { ...stardust },
      particlesEnabled: true,
      pixelsPerSecond: 240,
      glowStrength: 0.5,
      background: {
        enabled: true,
        style: 'starfield',
        intensity: 1,
        parallax: 0.65,
        stars: 1,
        orbs: 0.2,
        waves: 0,
        beams: 0.1,
        reactive: 0.65,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.85,
        ambient: 1.15,
        columns: 0.5,
        waves: 0.55,
        bassPulse: 0.4,
        attack: 0.55,
      },
      musicReactivePresetId: 'ethereal',
      colors: {
        mode: 'rainbow_wave',
        paletteId: 'ice',
        cycleSpeed: 0.3,
        saturation: 0.75,
        brightness: 1,
        trackBlend: 0.15,
      },
      backgroundColor: '#020308',
      hitRailIntensity: 0.6,
    },
  }),

  makeBuiltIn('minimal-clean', 'Minimal Clean', 'Subtle glow, soft particles, quiet room', {
    instrumentId: 'piano',
    volume: 0.8,
    settings: {
      particlePresetId: 'soft',
      particles: { ...soft },
      particlesEnabled: true,
      pixelsPerSecond: 260,
      glowStrength: 0.35,
      noteOpacity: 0.9,
      background: {
        enabled: true,
        style: 'void',
        intensity: 0.4,
        parallax: 0.2,
        stars: 0.35,
        orbs: 0,
        waves: 0,
        beams: 0,
        reactive: 0.3,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.4,
        ambient: 0.45,
        columns: 0.25,
        waves: 0.2,
        bassPulse: 0.2,
        attack: 0.45,
      },
      musicReactivePresetId: 'minimal',
      colors: {
        mode: 'track',
        paletteId: 'mono',
        cycleSpeed: 0.2,
        saturation: 0.5,
        brightness: 0.95,
        trackBlend: 0,
      },
      backgroundColor: '#08090c',
      hitRailIntensity: 0.4,
    },
  }),

  makeBuiltIn('retro-chip', 'Retro Chip', '8-bit lead with neon vapor colors', {
    instrumentId: 'gm_chip',
    volume: 0.82,
    settings: {
      particlePresetId: 'neon',
      particles: { ...neon, density: 1.1, trail: 0.55 },
      particlesEnabled: true,
      pixelsPerSecond: 340,
      glowStrength: 0.85,
      background: {
        enabled: true,
        style: 'pulse',
        intensity: 0.8,
        parallax: 0.6,
        stars: 0.2,
        orbs: 0.55,
        waves: 0.15,
        beams: 0.75,
        reactive: 0.95,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.1,
        ambient: 0.65,
        columns: 1,
        waves: 1.05,
        bassPulse: 0.9,
        attack: 1,
      },
      musicReactivePresetId: 'pulse',
      colors: {
        mode: 'rgb_chase',
        paletteId: 'vapor',
        cycleSpeed: 0.7,
        saturation: 1,
        brightness: 1.05,
        trackBlend: 0.05,
      },
      backgroundColor: '#0a0512',
      hitRailIntensity: 0.9,
    },
  }),
];

function readUserPresets(): ScenePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScenePreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      ...hydrateSceneData(p),
      id: p.id || `user-${Date.now()}`,
      name: p.name || 'Untitled',
      blurb: p.blurb || 'Saved preset',
      builtIn: false,
      savedAt: p.savedAt,
    }));
  } catch {
    return [];
  }
}

function writeUserPresets(list: ScenePreset[]) {
  const toStore = list.filter((p) => !p.builtIn);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function listAllPresets(): ScenePreset[] {
  return [...BUILTIN_SCENE_PRESETS, ...readUserPresets()];
}

export function listUserPresets(): ScenePreset[] {
  return readUserPresets();
}

export function saveUserPreset(
  name: string,
  data: ScenePresetData,
  blurb = 'Your saved look',
): ScenePreset {
  const preset: ScenePreset = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'My preset',
    blurb,
    builtIn: false,
    savedAt: new Date().toISOString(),
    ...hydrateSceneData(data),
  };
  const list = readUserPresets();
  list.unshift(preset);
  writeUserPresets(list);
  return preset;
}

export function deleteUserPreset(id: string): boolean {
  const list = readUserPresets();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  writeUserPresets(next);
  return true;
}

export function getScenePreset(id: string): ScenePreset | undefined {
  return listAllPresets().find((p) => p.id === id);
}
