import type {
  BackgroundParams,
  MusicReactiveParams,
  ParticleParams,
  VisualSettings,
} from '../midi/types';
import type { ColorSettings } from './colorPresets';
import { normalizeColorSettings } from './colorPresets';
import {
  pick,
  randomizeBackground,
  randomizeColors,
  randomizeMusicReactive,
  randomizeNoteStyle,
  randomizeParticles,
  randomizeVisuals,
} from './randomize';

export type RandomCategory =
  | 'visuals'
  | 'colors'
  | 'music'
  | 'background'
  | 'particles';

export const RANDOM_CATEGORIES: {
  id: RandomCategory;
  label: string;
  blurb: string;
}[] = [
  { id: 'visuals', label: 'Visuals', blurb: 'Glow, scroll, rail' },
  { id: 'colors', label: 'Colors', blurb: 'Palette & RGB modes' },
  { id: 'music', label: 'Music FX', blurb: 'Reactive field' },
  { id: 'background', label: 'Background', blurb: 'Atmosphere' },
  { id: 'particles', label: 'Particles', blurb: 'Hit sparks' },
];

export type CategoryFlags = Record<RandomCategory, boolean>;

export type RandomizerConfig = {
  categories: CategoryFlags;
  partyMode: boolean;
  /** How fast params dance (0.25-2) */
  danceSpeed: number;
  /** How often palette/mode/style flip while partying (0.2-1.5) */
  colorSwitchRate: number;
};

export const DEFAULT_RANDOMIZER_CONFIG: RandomizerConfig = {
  categories: {
    visuals: true,
    colors: true,
    music: true,
    background: true,
    particles: true,
  },
  partyMode: false,
  danceSpeed: 0.75,
  colorSwitchRate: 0.55,
};

export function anyCategoryOn(cats: CategoryFlags): boolean {
  return Object.values(cats).some(Boolean);
}

/** One-shot surprise using only enabled categories */
export function randomizeSelected(
  current: VisualSettings,
  cats: CategoryFlags,
): VisualSettings {
  let next: VisualSettings = { ...current };
  if (cats.visuals) {
    next = {
      ...next,
      ...randomizeVisuals(),
      notes: randomizeNoteStyle(),
      noteStylePresetId: 'custom',
    };
  }
  if (cats.particles) {
    next = {
      ...next,
      particlesEnabled: true,
      particlePresetId: 'custom',
      particles: randomizeParticles(),
    };
  }
  if (cats.background) {
    next = { ...next, background: randomizeBackground() };
  }
  if (cats.music) {
    next = {
      ...next,
      musicReactivePresetId: 'custom',
      musicReactive: randomizeMusicReactive(),
    };
  }
  if (cats.colors) {
    next = { ...next, colors: randomizeColors() };
  }
  return next;
}

/** Numeric-only targets for smooth dancing (no discrete jumps) */
export function randomizeContinuousTargets(
  current: VisualSettings,
  cats: CategoryFlags,
): VisualSettings {
  let next = { ...current };

  if (cats.visuals) {
    const v = randomizeVisuals();
    const n = randomizeNoteStyle();
    // Keep booleans stable while dancing - only slide numbers
    next = {
      ...next,
      pixelsPerSecond: v.pixelsPerSecond,
      noteOpacity: v.noteOpacity,
      glowStrength: v.glowStrength,
      keyboardHeight: v.keyboardHeight,
      hitRailIntensity: v.hitRailIntensity,
      notes: {
        ...next.notes,
        border: n.border,
        shine: n.shine,
        innerFx: n.innerFx,
        roundness: n.roundness,
        // style flips via discrete party path
      },
    };
  }

  if (cats.particles) {
    next = {
      ...next,
      particlesEnabled: true,
      particlePresetId: 'custom',
      particles: randomizeParticles(),
    };
  }

  if (cats.background) {
    const bg = randomizeBackground();
    next = {
      ...next,
      background: {
        ...current.background,
        enabled: true,
        // keep style until discrete flip
        style: current.background.style,
        intensity: bg.intensity,
        parallax: bg.parallax,
        stars: bg.stars,
        orbs: bg.orbs,
        waves: bg.waves,
        beams: bg.beams,
        reactive: bg.reactive,
      },
    };
  }

  if (cats.music) {
    const m = randomizeMusicReactive();
    next = {
      ...next,
      musicReactivePresetId: 'custom',
      musicReactive: {
        ...m,
        enabled: true,
      },
    };
  }

  if (cats.colors) {
    const c = randomizeColors();
    next = {
      ...next,
      colors: {
        ...normalizeColorSettings(current.colors),
        // keep mode/palette for continuous dance
        mode: current.colors.mode,
        paletteId: current.colors.paletteId,
        cycleSpeed: c.cycleSpeed,
        saturation: c.saturation,
        brightness: c.brightness,
        trackBlend: c.trackBlend,
      },
    };
  }

  return next;
}

/** Discrete party flips: palette, color mode, bg style, base color */
export function randomizeDiscreteFlip(
  current: VisualSettings,
  cats: CategoryFlags,
): VisualSettings {
  let next = { ...current };

  if (cats.colors) {
    const c = randomizeColors();
    // Sometimes only palette, sometimes mode, sometimes both
    const roll = Math.random();
    if (roll < 0.4) {
      next = {
        ...next,
        colors: { ...normalizeColorSettings(current.colors), paletteId: c.paletteId },
      };
    } else if (roll < 0.75) {
      next = {
        ...next,
        colors: {
          ...normalizeColorSettings(current.colors),
          mode: c.mode,
          trackBlend: c.mode === 'track' ? 0 : current.colors.trackBlend,
        },
      };
    } else {
      next = { ...next, colors: c };
    }
  }

  if (cats.visuals && Math.random() < 0.55) {
    const n = randomizeNoteStyle();
    next = {
      ...next,
      notes: n,
      noteStylePresetId: 'custom',
    };
  }

  if (cats.background && Math.random() < 0.7) {
    const bg = randomizeBackground();
    next = {
      ...next,
      background: { ...current.background, style: bg.style, enabled: true },
    };
  }

  if (cats.visuals && Math.random() < 0.45) {
    next = { ...next, backgroundColor: randomizeVisuals().backgroundColor };
  }

  return next;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpObj<T extends Record<string, unknown>>(
  from: T,
  to: T,
  t: number,
  keys: (keyof T)[],
): T {
  const out = { ...from };
  for (const k of keys) {
    const a = from[k];
    const b = to[k];
    if (typeof a === 'number' && typeof b === 'number') {
      (out as Record<string, unknown>)[k as string] = lerp(a, b, t);
    }
  }
  return out;
}

const PARTICLE_KEYS: (keyof ParticleParams)[] = [
  'density',
  'size',
  'sizeVariance',
  'speed',
  'spread',
  'gravity',
  'drag',
  'lifetime',
  'turbulence',
  'sparkle',
  'bloom',
  'secondaryBurst',
  'trail',
  'whiteHot',
  'swirl',
  'sustainEmit',
  'hitFlash',
];

const MUSIC_KEYS: (keyof MusicReactiveParams)[] = [
  'intensity',
  'ambient',
  'columns',
  'waves',
  'bassPulse',
  'attack',
];

const BG_NUM_KEYS: (keyof BackgroundParams)[] = [
  'intensity',
  'parallax',
  'stars',
  'orbs',
  'waves',
  'beams',
  'reactive',
];

const COLOR_NUM_KEYS: (keyof ColorSettings)[] = [
  'cycleSpeed',
  'saturation',
  'brightness',
  'trackBlend',
];

/**
 * Smoothly blend numeric parameters from `from` toward `to`.
 * Discrete fields (mode, palette, style) snap from `to` when provided.
 */
export function lerpSettings(
  from: VisualSettings,
  to: VisualSettings,
  t: number,
  cats: CategoryFlags,
): VisualSettings {
  const k = Math.max(0, Math.min(1, t));
  // Ease for dancing feel
  const e = k * k * (3 - 2 * k);
  let out: VisualSettings = { ...from };

  if (cats.visuals) {
    out = {
      ...out,
      pixelsPerSecond: lerp(from.pixelsPerSecond, to.pixelsPerSecond, e),
      noteOpacity: lerp(from.noteOpacity, to.noteOpacity, e),
      glowStrength: lerp(from.glowStrength, to.glowStrength, e),
      keyboardHeight: lerp(from.keyboardHeight, to.keyboardHeight, e),
      hitRailIntensity: lerp(from.hitRailIntensity, to.hitRailIntensity, e),
      backgroundColor: to.backgroundColor !== from.backgroundColor && k > 0.92
        ? to.backgroundColor
        : from.backgroundColor,
      notes: {
        style: to.notes?.style ?? from.notes?.style ?? 'solid',
        border: lerp(from.notes?.border ?? 0.25, to.notes?.border ?? 0.25, e),
        shine: lerp(from.notes?.shine ?? 0.35, to.notes?.shine ?? 0.35, e),
        innerFx: lerp(from.notes?.innerFx ?? 0.35, to.notes?.innerFx ?? 0.35, e),
        roundness: lerp(from.notes?.roundness ?? 0.55, to.notes?.roundness ?? 0.55, e),
      },
      noteStylePresetId: to.noteStylePresetId ?? from.noteStylePresetId,
    };
  }

  if (cats.particles) {
    out = {
      ...out,
      particlesEnabled: true,
      particlePresetId: 'custom',
      particles: lerpObj(from.particles, to.particles, e, PARTICLE_KEYS),
    };
  }

  if (cats.background) {
    out = {
      ...out,
      background: {
        ...lerpObj(from.background, to.background, e, BG_NUM_KEYS),
        enabled: true,
        style: to.background.style, // discrete - already set on target flip
      },
    };
  }

  if (cats.music) {
    out = {
      ...out,
      musicReactivePresetId: 'custom',
      musicReactive: {
        ...lerpObj(from.musicReactive, to.musicReactive, e, MUSIC_KEYS),
        enabled: true,
      },
    };
  }

  if (cats.colors) {
    out = {
      ...out,
      colors: {
        ...lerpObj(
          normalizeColorSettings(from.colors),
          normalizeColorSettings(to.colors),
          e,
          COLOR_NUM_KEYS,
        ),
        mode: to.colors.mode,
        paletteId: to.colors.paletteId,
      },
    };
  }

  return out;
}

export function distanceRough(a: VisualSettings, b: VisualSettings, cats: CategoryFlags): number {
  let d = 0;
  let n = 0;
  const add = (x: number, y: number) => {
    d += Math.abs(x - y);
    n++;
  };
  if (cats.visuals) {
    add(a.pixelsPerSecond / 400, b.pixelsPerSecond / 400);
    add(a.glowStrength, b.glowStrength);
    add(a.noteOpacity, b.noteOpacity);
  }
  if (cats.particles) {
    add(a.particles.density, b.particles.density);
    add(a.particles.speed, b.particles.speed);
    add(a.particles.bloom, b.particles.bloom);
  }
  if (cats.music) {
    add(a.musicReactive.intensity, b.musicReactive.intensity);
    add(a.musicReactive.waves, b.musicReactive.waves);
  }
  if (cats.background) {
    add(a.background.intensity, b.background.intensity);
    add(a.background.stars, b.background.stars);
  }
  if (cats.colors) {
    add(a.colors.cycleSpeed, b.colors.cycleSpeed);
    add(a.colors.saturation, b.colors.saturation);
  }
  return n ? d / n : 0;
}

export function pickDanceHoldSeconds(speed: number): number {
  // Faster dance → shorter holds between new targets
  const base = 3.5 / Math.max(0.25, speed);
  return base * (0.65 + Math.random() * 0.7);
}

export function pickColorFlipSeconds(rate: number): number {
  const base = 8 / Math.max(0.15, rate);
  return base * (0.7 + Math.random() * 0.8);
}

// silence unused pick if tree-shaken oddly
void pick;
