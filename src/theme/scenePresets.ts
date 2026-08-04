import type { VisualSettings } from '../midi/types';
import type { InstrumentId } from '../engine/instruments';
import { DEFAULT_VISUAL_SETTINGS } from './defaultPalette';
import { normalizeColorSettings } from './colorPresets';
import { getPreset as getParticlePreset } from './particlePresets';

const STORAGE_KEY = 'lumenote-scene-presets-v1';
/** Previous brand - migrate once so saved looks aren't lost */
const LEGACY_STORAGE_KEY = 'notefall-scene-presets-v1';

/** Browse groups for factory looks (order = UI order) */
export type SceneCategoryId =
  | 'classic'
  | 'rave'
  | 'chill'
  | 'cinematic'
  | 'retro'
  | 'cosmic'
  | 'minimal';

export type SceneCategory = {
  id: SceneCategoryId;
  label: string;
  blurb: string;
};

export const SCENE_CATEGORIES: readonly SceneCategory[] = [
  { id: 'classic', label: 'Classic', blurb: 'Balanced piano looks' },
  { id: 'rave', label: 'Rave', blurb: 'High energy club' },
  { id: 'chill', label: 'Chill', blurb: 'Soft ambient haze' },
  { id: 'cinematic', label: 'Cinema', blurb: 'Dramatic scores' },
  { id: 'retro', label: 'Retro', blurb: 'Chip & synthwave' },
  { id: 'cosmic', label: 'Cosmic', blurb: 'Space & warp' },
  { id: 'minimal', label: 'Minimal', blurb: 'Quiet clean stages' },
] as const;

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
  /** Factory browse category (user saves may omit) */
  category?: SceneCategoryId;
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
  // Don't persist custom SF2 as playable without the file - store id but UI will warn
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
  category: SceneCategoryId,
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
    category,
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
  // ── Classic ──
  makeBuiltIn('classic-ember', 'Classic Ember', 'Warm rising sparks, balanced reactive field', 'classic', {
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
  makeBuiltIn('studio-warm', 'Studio Warm', 'Soft piano, gentle ember, quiet room', 'classic', {
    instrumentId: 'piano',
    volume: 0.82,
    settings: {
      particlePresetId: 'ember',
      particles: { ...ember, density: 0.85, gravity: -0.2 },
      particlesEnabled: true,
      pixelsPerSecond: 250,
      glowStrength: 0.55,
      background: {
        enabled: true,
        style: 'nebula',
        intensity: 0.55,
        parallax: 0.3,
        stars: 0.4,
        orbs: 0.55,
        waves: 0.25,
        beams: 0.15,
        reactive: 0.55,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.55,
        ambient: 0.6,
        columns: 0.45,
        waves: 0.35,
        bassPulse: 0.3,
        attack: 0.5,
      },
      musicReactivePresetId: 'chill',
      colors: {
        mode: 'track',
        paletteId: 'sunset',
        cycleSpeed: 0.2,
        saturation: 0.75,
        brightness: 0.95,
        trackBlend: 0.2,
      },
      backgroundColor: '#0a0806',
      hitRailIntensity: 0.55,
    },
  }),
  makeBuiltIn('crystal-keys', 'Crystal Keys', 'Glass shards over a cool stage', 'classic', {
    instrumentId: 'epiano',
    volume: 0.8,
    settings: {
      particlePresetId: 'crystal',
      particles: { ...crystal },
      particlesEnabled: true,
      pixelsPerSecond: 270,
      glowStrength: 0.75,
      background: {
        enabled: true,
        style: 'aurora',
        intensity: 0.7,
        parallax: 0.4,
        stars: 0.5,
        orbs: 0.45,
        waves: 0.7,
        beams: 0.2,
        reactive: 0.75,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.85,
        ambient: 0.7,
        columns: 0.7,
        waves: 0.65,
        bassPulse: 0.5,
        attack: 0.75,
      },
      musicReactivePresetId: 'balanced',
      colors: {
        mode: 'palette_wave',
        paletteId: 'ice',
        cycleSpeed: 0.35,
        saturation: 0.85,
        brightness: 1.05,
        trackBlend: 0.15,
      },
      backgroundColor: '#060a10',
      hitRailIntensity: 0.75,
    },
  }),

  // ── Rave ──
  makeBuiltIn('neon-rave', 'Neon Rave', 'Electric bursts, pulse beams, RGB chase', 'rave', {
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
  makeBuiltIn('bass-radar', 'Bass Radar', 'Scan sweep locked to heavy bass hits', 'rave', {
    instrumentId: 'bass',
    volume: 0.9,
    settings: {
      particlePresetId: 'neon',
      particles: { ...neon, density: 1.45, trail: 0.85 },
      particlesEnabled: true,
      pixelsPerSecond: 330,
      glowStrength: 1,
      background: {
        enabled: true,
        style: 'radar',
        intensity: 0.95,
        parallax: 0.65,
        stars: 0.25,
        orbs: 0.2,
        waves: 0.95,
        beams: 0.3,
        reactive: 1.2,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.2,
        ambient: 0.45,
        columns: 0.6,
        waves: 1.25,
        bassPulse: 1.4,
        attack: 1.05,
      },
      musicReactivePresetId: 'bass',
      colors: {
        mode: 'spectrum',
        paletteId: 'neon',
        cycleSpeed: 0.7,
        saturation: 1,
        brightness: 1.1,
        trackBlend: 0.05,
      },
      backgroundColor: '#020608',
      hitRailIntensity: 1.1,
    },
  }),
  makeBuiltIn('laser-storm', 'Laser Storm', 'Rain streaks + neon punches', 'rave', {
    instrumentId: 'chip_lead',
    volume: 0.84,
    settings: {
      particlePresetId: 'neon',
      particles: { ...neon, density: 1.5, secondaryBurst: 1 },
      particlesEnabled: true,
      pixelsPerSecond: 350,
      glowStrength: 0.95,
      background: {
        enabled: true,
        style: 'rain',
        intensity: 1,
        parallax: 0.7,
        stars: 0.85,
        orbs: 0.2,
        waves: 0.15,
        beams: 0.55,
        reactive: 1.15,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.3,
        ambient: 0.85,
        columns: 1.15,
        waves: 1.1,
        bassPulse: 1.05,
        attack: 1.1,
      },
      musicReactivePresetId: 'rave',
      colors: {
        mode: 'rgb_chase',
        paletteId: 'vapor',
        cycleSpeed: 0.95,
        saturation: 1,
        brightness: 1.1,
        trackBlend: 0,
      },
      backgroundColor: '#080018',
      hitRailIntensity: 1.05,
    },
  }),
  makeBuiltIn('inferno', 'Inferno', 'Heavy fire particles and rising columns', 'rave', {
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

  // ── Chill ──
  makeBuiltIn('chill-aurora', 'Chill Aurora', 'Soft floating haze and gentle streams', 'chill', {
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
  makeBuiltIn('soft-rain', 'Soft Rain', 'Gentle falling streaks over a pad', 'chill', {
    instrumentId: 'pad',
    volume: 0.72,
    settings: {
      particlePresetId: 'soft',
      particles: { ...soft, gravity: 0.15, lifetime: 1.2 },
      particlesEnabled: true,
      pixelsPerSecond: 190,
      glowStrength: 0.45,
      background: {
        enabled: true,
        style: 'rain',
        intensity: 0.65,
        parallax: 0.35,
        stars: 0.55,
        orbs: 0.1,
        waves: 0.2,
        beams: 0.25,
        reactive: 0.55,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.5,
        ambient: 1.1,
        columns: 0.3,
        waves: 0.25,
        bassPulse: 0.25,
        attack: 0.35,
      },
      musicReactivePresetId: 'ethereal',
      colors: {
        mode: 'palette_wave',
        paletteId: 'ocean',
        cycleSpeed: 0.18,
        saturation: 0.65,
        brightness: 0.9,
        trackBlend: 0.2,
      },
      backgroundColor: '#050810',
      hitRailIntensity: 0.4,
    },
  }),
  makeBuiltIn('pastel-drift', 'Pastel Drift', 'Candy tones and slow aurora bands', 'chill', {
    instrumentId: 'pluck',
    volume: 0.76,
    settings: {
      particlePresetId: 'aurora',
      particles: { ...aurora, density: 0.9 },
      particlesEnabled: true,
      pixelsPerSecond: 210,
      glowStrength: 0.5,
      background: {
        enabled: true,
        style: 'aurora',
        intensity: 0.75,
        parallax: 0.3,
        stars: 0.35,
        orbs: 0.7,
        waves: 0.9,
        beams: 0.1,
        reactive: 0.6,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.55,
        ambient: 1,
        columns: 0.4,
        waves: 0.35,
        bassPulse: 0.3,
        attack: 0.4,
      },
      musicReactivePresetId: 'chill',
      colors: {
        mode: 'palette',
        paletteId: 'pastel',
        cycleSpeed: 0.25,
        saturation: 0.7,
        brightness: 1,
        trackBlend: 0.1,
      },
      backgroundColor: '#0a0810',
      hitRailIntensity: 0.5,
    },
  }),
  makeBuiltIn('midnight-tea', 'Midnight Tea', 'Warm low glow for late practice', 'chill', {
    instrumentId: 'epiano',
    volume: 0.74,
    settings: {
      particlePresetId: 'soft',
      particles: { ...soft },
      particlesEnabled: true,
      pixelsPerSecond: 220,
      glowStrength: 0.4,
      background: {
        enabled: true,
        style: 'void',
        intensity: 0.5,
        parallax: 0.2,
        stars: 0.45,
        orbs: 0.25,
        waves: 0,
        beams: 0,
        reactive: 0.4,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.45,
        ambient: 0.7,
        columns: 0.35,
        waves: 0.25,
        bassPulse: 0.25,
        attack: 0.4,
      },
      musicReactivePresetId: 'minimal',
      colors: {
        mode: 'track',
        paletteId: 'sunset',
        cycleSpeed: 0.15,
        saturation: 0.65,
        brightness: 0.9,
        trackBlend: 0.25,
      },
      backgroundColor: '#0c0908',
      hitRailIntensity: 0.45,
    },
  }),

  // ── Cinematic ──
  makeBuiltIn('noir-stage', 'Noir Stage', 'Dark room, mono keys, sparse dust', 'cinematic', {
    instrumentId: 'piano',
    volume: 0.8,
    settings: {
      particlePresetId: 'soft',
      particles: { ...soft, density: 0.7, sparkle: 0.2 },
      particlesEnabled: true,
      pixelsPerSecond: 240,
      glowStrength: 0.35,
      background: {
        enabled: true,
        style: 'void',
        intensity: 0.55,
        parallax: 0.15,
        stars: 0.25,
        orbs: 0,
        waves: 0,
        beams: 0.1,
        reactive: 0.35,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.4,
        ambient: 0.5,
        columns: 0.25,
        waves: 0.2,
        bassPulse: 0.25,
        attack: 0.45,
      },
      musicReactivePresetId: 'minimal',
      colors: {
        mode: 'track',
        paletteId: 'mono',
        cycleSpeed: 0.1,
        saturation: 0.35,
        brightness: 0.9,
        trackBlend: 0,
      },
      backgroundColor: '#050506',
      hitRailIntensity: 0.35,
    },
  }),
  makeBuiltIn('golden-hour', 'Golden Hour', 'Sunset palette, slow ember rise', 'cinematic', {
    instrumentId: 'strings',
    volume: 0.78,
    settings: {
      particlePresetId: 'ember',
      particles: { ...ember, density: 1, gravity: -0.45 },
      particlesEnabled: true,
      pixelsPerSecond: 230,
      glowStrength: 0.7,
      background: {
        enabled: true,
        style: 'nebula',
        intensity: 0.8,
        parallax: 0.4,
        stars: 0.35,
        orbs: 0.85,
        waves: 0.4,
        beams: 0.35,
        reactive: 0.75,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.75,
        ambient: 0.85,
        columns: 0.65,
        waves: 0.55,
        bassPulse: 0.5,
        attack: 0.55,
      },
      musicReactivePresetId: 'ethereal',
      colors: {
        mode: 'palette_wave',
        paletteId: 'sunset',
        cycleSpeed: 0.28,
        saturation: 0.9,
        brightness: 1.05,
        trackBlend: 0.15,
      },
      backgroundColor: '#100806',
      hitRailIntensity: 0.7,
    },
  }),
  makeBuiltIn('deep-score', 'Deep Score', 'Organ weight with radar horizon', 'cinematic', {
    instrumentId: 'organ',
    volume: 0.86,
    settings: {
      particlePresetId: 'stardust',
      particles: { ...stardust },
      particlesEnabled: true,
      pixelsPerSecond: 255,
      glowStrength: 0.65,
      background: {
        enabled: true,
        style: 'radar',
        intensity: 0.75,
        parallax: 0.45,
        stars: 0.4,
        orbs: 0.15,
        waves: 0.8,
        beams: 0.2,
        reactive: 0.9,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.9,
        ambient: 0.65,
        columns: 0.75,
        waves: 0.8,
        bassPulse: 0.85,
        attack: 0.65,
      },
      musicReactivePresetId: 'bass',
      colors: {
        mode: 'spectrum',
        paletteId: 'classic',
        cycleSpeed: 0.3,
        saturation: 0.8,
        brightness: 0.95,
        trackBlend: 0.2,
      },
      backgroundColor: '#04060a',
      hitRailIntensity: 0.8,
    },
  }),
  makeBuiltIn('ember-orchestra', 'Ember Orchestra', 'Strings + fire columns', 'cinematic', {
    instrumentId: 'strings',
    volume: 0.84,
    settings: {
      particlePresetId: 'inferno',
      particles: { ...inferno, density: 0.95 },
      particlesEnabled: true,
      pixelsPerSecond: 265,
      glowStrength: 0.8,
      background: {
        enabled: true,
        style: 'nebula',
        intensity: 0.85,
        parallax: 0.5,
        stars: 0.3,
        orbs: 0.8,
        waves: 0.35,
        beams: 0.4,
        reactive: 0.95,
      },
      musicReactive: {
        enabled: true,
        intensity: 1,
        ambient: 0.7,
        columns: 1.1,
        waves: 0.7,
        bassPulse: 0.9,
        attack: 0.7,
      },
      musicReactivePresetId: 'streams',
      colors: {
        mode: 'track',
        paletteId: 'fire',
        cycleSpeed: 0.35,
        saturation: 0.95,
        brightness: 1,
        trackBlend: 0.1,
      },
      backgroundColor: '#0e0704',
      hitRailIntensity: 0.9,
    },
  }),

  // ── Retro ──
  makeBuiltIn('retro-chip', 'Retro Chip', '8-bit lead with neon vapor colors', 'retro', {
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
  makeBuiltIn('cyber-night', 'Cyber Night', 'Magenta/cyan grid, crystal shards', 'retro', {
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
  makeBuiltIn('arcade-rain', 'Arcade Rain', 'Chip lead under digital rain', 'retro', {
    instrumentId: 'chiptune',
    volume: 0.83,
    settings: {
      particlePresetId: 'neon',
      particles: { ...neon, trail: 0.65 },
      particlesEnabled: true,
      pixelsPerSecond: 345,
      glowStrength: 0.9,
      background: {
        enabled: true,
        style: 'rain',
        intensity: 0.9,
        parallax: 0.6,
        stars: 0.7,
        orbs: 0.15,
        waves: 0.1,
        beams: 0.4,
        reactive: 1.05,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.15,
        ambient: 0.7,
        columns: 1.05,
        waves: 1,
        bassPulse: 0.95,
        attack: 1.05,
      },
      musicReactivePresetId: 'pulse',
      colors: {
        mode: 'rgb_chase',
        paletteId: 'neon',
        cycleSpeed: 0.8,
        saturation: 1,
        brightness: 1.05,
        trackBlend: 0,
      },
      backgroundColor: '#040a06',
      hitRailIntensity: 0.95,
    },
  }),
  makeBuiltIn('fm-horizon', 'FM Horizon', 'GM FM over a synthwave grid', 'retro', {
    instrumentId: 'gm_quality',
    volume: 0.84,
    settings: {
      particlePresetId: 'crystal',
      particles: { ...crystal, density: 1.1 },
      particlesEnabled: true,
      pixelsPerSecond: 310,
      glowStrength: 0.85,
      background: {
        enabled: true,
        style: 'grid',
        intensity: 0.9,
        parallax: 0.8,
        stars: 0.4,
        orbs: 0.3,
        waves: 0,
        beams: 0.4,
        reactive: 1,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.05,
        ambient: 0.6,
        columns: 0.95,
        waves: 1,
        bassPulse: 0.85,
        attack: 0.95,
      },
      musicReactivePresetId: 'pulse',
      colors: {
        mode: 'palette_wave',
        paletteId: 'vapor',
        cycleSpeed: 0.55,
        saturation: 0.95,
        brightness: 1.05,
        trackBlend: 0.1,
      },
      backgroundColor: '#080218',
      hitRailIntensity: 0.95,
    },
  }),

  // ── Cosmic ──
  makeBuiltIn('stardust-void', 'Stardust Void', 'Deep space glitter and fine dust', 'cosmic', {
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
  makeBuiltIn('warp-drive', 'Warp Drive', 'Hyperspace tunnel locked to the groove', 'cosmic', {
    instrumentId: 'pad',
    volume: 0.8,
    settings: {
      particlePresetId: 'stardust',
      particles: { ...stardust, density: 1.25, trail: 0.7 },
      particlesEnabled: true,
      pixelsPerSecond: 280,
      glowStrength: 0.75,
      background: {
        enabled: true,
        style: 'warp',
        intensity: 1,
        parallax: 0.85,
        stars: 0.6,
        orbs: 0.35,
        waves: 0.15,
        beams: 0.75,
        reactive: 1.15,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.1,
        ambient: 1,
        columns: 0.7,
        waves: 0.9,
        bassPulse: 0.85,
        attack: 0.8,
      },
      musicReactivePresetId: 'balanced',
      colors: {
        mode: 'rainbow_time',
        paletteId: 'cyber',
        cycleSpeed: 0.55,
        saturation: 0.9,
        brightness: 1.05,
        trackBlend: 0.1,
      },
      backgroundColor: '#01040c',
      hitRailIntensity: 0.85,
    },
  }),
  makeBuiltIn('nebula-scan', 'Nebula Scan', 'Radar rings through purple gas', 'cosmic', {
    instrumentId: 'pad',
    volume: 0.77,
    settings: {
      particlePresetId: 'aurora',
      particles: { ...aurora, density: 1.05 },
      particlesEnabled: true,
      pixelsPerSecond: 235,
      glowStrength: 0.6,
      background: {
        enabled: true,
        style: 'radar',
        intensity: 0.9,
        parallax: 0.55,
        stars: 0.5,
        orbs: 0.4,
        waves: 0.9,
        beams: 0.25,
        reactive: 1,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.9,
        ambient: 1.05,
        columns: 0.55,
        waves: 0.7,
        bassPulse: 0.55,
        attack: 0.55,
      },
      musicReactivePresetId: 'ethereal',
      colors: {
        mode: 'rainbow_pitch',
        paletteId: 'cyber',
        cycleSpeed: 0.4,
        saturation: 0.85,
        brightness: 1,
        trackBlend: 0.15,
      },
      backgroundColor: '#060218',
      hitRailIntensity: 0.7,
    },
  }),
  makeBuiltIn('ice-comet', 'Ice Comet', 'Crystal hits through a cold warp', 'cosmic', {
    instrumentId: 'pluck',
    volume: 0.81,
    settings: {
      particlePresetId: 'crystal',
      particles: { ...crystal, trail: 0.8, speed: 1.3 },
      particlesEnabled: true,
      pixelsPerSecond: 290,
      glowStrength: 0.85,
      background: {
        enabled: true,
        style: 'warp',
        intensity: 0.9,
        parallax: 0.75,
        stars: 0.7,
        orbs: 0.25,
        waves: 0.1,
        beams: 0.6,
        reactive: 1.05,
      },
      musicReactive: {
        enabled: true,
        intensity: 1,
        ambient: 0.85,
        columns: 0.8,
        waves: 0.85,
        bassPulse: 0.6,
        attack: 0.9,
      },
      musicReactivePresetId: 'pulse',
      colors: {
        mode: 'spectrum',
        paletteId: 'ice',
        cycleSpeed: 0.5,
        saturation: 0.9,
        brightness: 1.1,
        trackBlend: 0.1,
      },
      backgroundColor: '#020810',
      hitRailIntensity: 0.9,
    },
  }),

  // ── Minimal ──
  makeBuiltIn('minimal-clean', 'Minimal Clean', 'Subtle glow, soft particles, quiet room', 'minimal', {
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
  makeBuiltIn('paper-white', 'Paper White', 'Bright mono keys, almost no FX', 'minimal', {
    instrumentId: 'piano',
    volume: 0.78,
    settings: {
      particlePresetId: 'soft',
      particles: { ...soft, density: 0.45, bloom: 0.7 },
      particlesEnabled: true,
      pixelsPerSecond: 250,
      glowStrength: 0.2,
      noteOpacity: 0.95,
      background: {
        enabled: true,
        style: 'void',
        intensity: 0.25,
        parallax: 0.1,
        stars: 0.15,
        orbs: 0,
        waves: 0,
        beams: 0,
        reactive: 0.15,
      },
      musicReactive: {
        enabled: false,
        intensity: 0,
        ambient: 0,
        columns: 0,
        waves: 0,
        bassPulse: 0,
        attack: 0.4,
      },
      musicReactivePresetId: 'off',
      colors: {
        mode: 'track',
        paletteId: 'mono',
        cycleSpeed: 0.1,
        saturation: 0.25,
        brightness: 1.05,
        trackBlend: 0,
      },
      backgroundColor: '#0c0d10',
      hitRailIntensity: 0.25,
      showHitRail: true,
    },
  }),
  makeBuiltIn('mono-focus', 'Mono Focus', 'Tight pluck, low glow, no clutter', 'minimal', {
    instrumentId: 'pluck',
    volume: 0.8,
    settings: {
      particlePresetId: 'soft',
      particles: { ...soft, density: 0.6, trail: 0.15 },
      particlesEnabled: true,
      pixelsPerSecond: 275,
      glowStrength: 0.3,
      background: {
        enabled: true,
        style: 'void',
        intensity: 0.35,
        parallax: 0.15,
        stars: 0.25,
        orbs: 0,
        waves: 0,
        beams: 0,
        reactive: 0.25,
      },
      musicReactive: {
        enabled: true,
        intensity: 0.3,
        ambient: 0.35,
        columns: 0.2,
        waves: 0.15,
        bassPulse: 0.15,
        attack: 0.5,
      },
      musicReactivePresetId: 'minimal',
      colors: {
        mode: 'track',
        paletteId: 'classic',
        cycleSpeed: 0.15,
        saturation: 0.55,
        brightness: 0.95,
        trackBlend: 0,
      },
      backgroundColor: '#07080a',
      hitRailIntensity: 0.35,
    },
  }),
];

/** Pure helpers for category browsing (testable without React). */
export function listBuiltInCategories(): SceneCategory[] {
  return SCENE_CATEGORIES.map((c) => ({ ...c }));
}

export function listBuiltInsByCategory(category: SceneCategoryId): ScenePreset[] {
  return BUILTIN_SCENE_PRESETS.filter((p) => p.category === category);
}

export function countBuiltInPresets(): number {
  return BUILTIN_SCENE_PRESETS.length;
}

export function getBuiltInCategoryIdsInUse(): SceneCategoryId[] {
  const used = new Set<SceneCategoryId>();
  for (const p of BUILTIN_SCENE_PRESETS) {
    if (p.category) used.add(p.category);
  }
  return SCENE_CATEGORIES.map((c) => c.id).filter((id) => used.has(id));
}

function readUserPresets(): ScenePreset[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        localStorage.setItem(STORAGE_KEY, legacy);
        try {
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    }
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
