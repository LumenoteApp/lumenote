import type {
  EffectsParams,
  MusicReactiveParams,
  ParticleParams,
} from '../midi/types';

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function snap(v: number, step = 0.05) {
  return Math.round(v / step) * step;
}

export type EffectsPreset = {
  id: string;
  name: string;
  blurb: string;
  params: EffectsParams;
};

export const DEFAULT_EFFECTS: EffectsParams = {
  enabled: true,
  intensity: 0.95,
  sparks: 0.85,
  ambient: 0.7,
  streams: 0.75,
  bassPulse: 0.65,
  attack: 0.7,
};

export const DEFAULT_EFFECTS_PRESET_ID = 'embers';

export const EFFECTS_PRESETS: EffectsPreset[] = [
  {
    id: 'off',
    name: 'Off',
    blurb: 'No sparks or field',
    params: {
      enabled: false,
      intensity: 0,
      sparks: 0,
      ambient: 0,
      streams: 0,
      bassPulse: 0,
      attack: 0.5,
    },
  },
  {
    id: 'embers',
    name: 'Embers',
    blurb: 'Warm sparks and soft dust',
    params: { ...DEFAULT_EFFECTS },
  },
  {
    id: 'sparks',
    name: 'Sparks',
    blurb: 'Punchy hit bursts',
    params: {
      enabled: true,
      intensity: 1.05,
      sparks: 1.2,
      ambient: 0.25,
      streams: 0.35,
      bassPulse: 0.4,
      attack: 1,
    },
  },
  {
    id: 'dust',
    name: 'Dust',
    blurb: 'Floating ambient haze',
    params: {
      enabled: true,
      intensity: 0.7,
      sparks: 0.2,
      ambient: 1.15,
      streams: 0.3,
      bassPulse: 0.25,
      attack: 0.4,
    },
  },
  {
    id: 'streams',
    name: 'Streams',
    blurb: 'Rising columns from keys',
    params: {
      enabled: true,
      intensity: 1,
      sparks: 0.45,
      ambient: 0.35,
      streams: 1.25,
      bassPulse: 0.35,
      attack: 0.7,
    },
  },
  {
    id: 'pulse',
    name: 'Pulse',
    blurb: 'Bass bloom and snap',
    params: {
      enabled: true,
      intensity: 1.05,
      sparks: 0.7,
      ambient: 0.4,
      streams: 0.45,
      bassPulse: 1.25,
      attack: 0.95,
    },
  },
  {
    id: 'storm',
    name: 'Storm',
    blurb: 'Dense energetic mix',
    params: {
      enabled: true,
      intensity: 1.25,
      sparks: 1.15,
      ambient: 0.85,
      streams: 1.1,
      bassPulse: 0.95,
      attack: 0.9,
    },
  },
  {
    id: 'soft',
    name: 'Soft',
    blurb: 'Quiet elegant glow',
    params: {
      enabled: true,
      intensity: 0.5,
      sparks: 0.4,
      ambient: 0.55,
      streams: 0.25,
      bassPulse: 0.3,
      attack: 0.45,
    },
  },
  {
    id: 'inferno',
    name: 'Inferno',
    blurb: 'Heavy fire and lift',
    params: {
      enabled: true,
      intensity: 1.2,
      sparks: 1.3,
      ambient: 0.7,
      streams: 0.85,
      bassPulse: 0.8,
      attack: 0.85,
    },
  },
  {
    id: 'haze',
    name: 'Haze',
    blurb: 'Slow ethereal field',
    params: {
      enabled: true,
      intensity: 0.75,
      sparks: 0.3,
      ambient: 1.2,
      streams: 0.55,
      bassPulse: 0.2,
      attack: 0.35,
    },
  },
];

export function getEffectsPreset(id: string): EffectsPreset {
  return EFFECTS_PRESETS.find((p) => p.id === id) ?? EFFECTS_PRESETS[1]!;
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeEffects(partial?: Partial<EffectsParams> | null): EffectsParams {
  const d = DEFAULT_EFFECTS;
  const p = partial ?? {};
  const enabled = p.enabled ?? d.enabled;
  return {
    enabled: Boolean(enabled),
    intensity: clamp(p.intensity ?? d.intensity, 0, 1.4, d.intensity),
    sparks: clamp(p.sparks ?? d.sparks, 0, 1.4, d.sparks),
    ambient: clamp(p.ambient ?? d.ambient, 0, 1.4, d.ambient),
    streams: clamp(p.streams ?? d.streams, 0, 1.4, d.streams),
    bassPulse: clamp(p.bassPulse ?? d.bassPulse, 0, 1.4, d.bassPulse),
    attack: clamp(p.attack ?? d.attack, 0.1, 1.2, d.attack),
  };
}

export type LegacyEffectsSource = {
  effects?: Partial<EffectsParams> | null;
  effectsPresetId?: string;
  particlesEnabled?: boolean;
  particlePresetId?: string;
  particles?: Partial<ParticleParams> | null;
  musicReactive?: Partial<MusicReactiveParams> | null;
  musicReactivePresetId?: string;
};

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Map old dual `particles` + `musicReactive` (including unused `waves`)
 * into the combined effects bag. Explicit `effects` wins.
 */
export function hydrateEffects(
  raw: LegacyEffectsSource | null | undefined,
): { effects: EffectsParams; effectsPresetId: string } {
  if (!raw || typeof raw !== 'object') {
    return {
      effects: { ...DEFAULT_EFFECTS },
      effectsPresetId: DEFAULT_EFFECTS_PRESET_ID,
    };
  }

  if (raw.effects && typeof raw.effects === 'object') {
    const effects = normalizeEffects(raw.effects);
    const hinted =
      typeof raw.effectsPresetId === 'string' && raw.effectsPresetId
        ? raw.effectsPresetId
        : inferPresetId(effects);
    return { effects, effectsPresetId: hinted };
  }

  const p = raw.particles ?? {};
  const m = raw.musicReactive ?? {};
  const hasLegacy =
    raw.particles != null ||
    raw.musicReactive != null ||
    raw.particlesEnabled != null ||
    typeof raw.particlePresetId === 'string' ||
    typeof raw.musicReactivePresetId === 'string';

  if (!hasLegacy) {
    return {
      effects: { ...DEFAULT_EFFECTS },
      effectsPresetId: DEFAULT_EFFECTS_PRESET_ID,
    };
  }

  const particlesOn = raw.particlesEnabled !== false;
  const musicOn = m.enabled !== false;

  const density = num(p.density, 1.1);
  const hitFlash = num(p.hitFlash, 0.7);
  const size = num(p.size, 1.1);
  const sparks = particlesOn
    ? clamp(density * 0.5 + hitFlash * 0.3 + size * 0.15, 0, 1.4, 0.85)
    : 0;

  const ambient = musicOn ? clamp(num(m.ambient, 0.5), 0, 1.4, 0.5) : particlesOn ? 0.12 : 0;
  const streams = musicOn ? clamp(num(m.columns, 0.4), 0, 1.4, 0.4) : 0;
  const bassPulse = musicOn ? clamp(num(m.bassPulse, 0.5), 0, 1.4, 0.5) : 0;
  const attack = clamp(num(m.attack, hitFlash), 0.1, 1.2, 0.7);
  const intensity = clamp(
    Math.max(musicOn ? num(m.intensity, 0.8) : 0, particlesOn ? density * 0.65 : 0),
    0,
    1.4,
    0.9,
  );
  const enabled =
    (particlesOn && sparks > 0.02) || (musicOn && num(m.intensity, 0) > 0.02) || sparks > 0.02;

  const effects = normalizeEffects({
    enabled,
    intensity,
    sparks,
    ambient,
    streams,
    bassPulse,
    attack,
  });

  const hinted =
    typeof raw.effectsPresetId === 'string' && raw.effectsPresetId
      ? raw.effectsPresetId
      : inferFromLegacyIds(raw, effects);

  return { effects, effectsPresetId: hinted };
}

function inferFromLegacyIds(raw: LegacyEffectsSource, effects: EffectsParams): string {
  if (raw.musicReactivePresetId === 'off' && raw.particlesEnabled === false) return 'off';
  if (!effects.enabled) return 'off';
  const music = raw.musicReactivePresetId;
  const part = raw.particlePresetId;
  if (part === 'ember' && (music === 'balanced' || !music)) return 'embers';
  if (part === 'neon' || part === 'firework' || part === 'crystal') return 'sparks';
  if (part === 'stardust' || part === 'aurora' || music === 'ethereal' || music === 'chill') {
    return 'dust';
  }
  if (music === 'streams') return 'streams';
  if (music === 'rave' || part === 'inferno' || part === 'blizzard') return 'storm';
  if (music === 'bass' || music === 'pulse') return 'pulse';
  if (part === 'soft' || music === 'minimal') return 'soft';
  if (part === 'rain') return 'streams';
  return inferPresetId(effects);
}

function inferPresetId(effects: EffectsParams): string {
  if (!effects.enabled) return 'off';
  for (const pr of EFFECTS_PRESETS) {
    if (pr.id === 'off') continue;
    if (roughlyEqual(pr.params, effects)) return pr.id;
  }
  return 'custom';
}

function roughlyEqual(a: EffectsParams, b: EffectsParams): boolean {
  const keys: (keyof EffectsParams)[] = [
    'intensity',
    'sparks',
    'ambient',
    'streams',
    'bassPulse',
    'attack',
  ];
  if (Boolean(a.enabled) !== Boolean(b.enabled)) return false;
  return keys.every((k) => Math.abs(Number(a[k]) - Number(b[k])) < 0.08);
}

/** Derive internal hit-particle physics from the small combined knob set. */
export function effectsToParticleParams(e: EffectsParams): ParticleParams {
  const k = Math.max(0, e.sparks) * Math.max(0, e.intensity);
  const lift = Math.max(0, e.ambient);
  const snapAmt = Math.max(0, e.attack);
  return {
    density: 0.35 + k * 0.85,
    size: 0.7 + k * 0.45,
    sizeVariance: 0.35 + k * 0.25,
    speed: 0.65 + k * 0.55 + snapAmt * 0.2,
    spread: 0.3 + snapAmt * 0.35,
    gravity: 0.35 - lift * 0.7,
    drag: 0.28 + lift * 0.15,
    lifetime: 0.55 + k * 0.45 + lift * 0.25,
    turbulence: 0.15 + lift * 0.35,
    sparkle: 0.25 + k * 0.45,
    bloom: 0.85 + k * 0.45,
    secondaryBurst: 0.2 + snapAmt * 0.55,
    trail: 0.15 + e.streams * 0.3,
    whiteHot: 0.3 + snapAmt * 0.35,
    swirl: lift * 0.4,
    sustainEmit: k * 0.4,
    hitFlash: 0.35 + snapAmt * 0.55,
  };
}

export function randomizeEffects(): EffectsParams {
  return {
    enabled: true,
    intensity: snap(rand(0.45, 1.3)),
    sparks: snap(rand(0.15, 1.3)),
    ambient: snap(rand(0.15, 1.25)),
    streams: snap(rand(0.1, 1.25)),
    bassPulse: snap(rand(0.1, 1.25)),
    attack: snap(rand(0.3, 1.15)),
  };
}

export const EFFECT_PARAM_KEYS: (keyof EffectsParams)[] = [
  'intensity',
  'sparks',
  'ambient',
  'streams',
  'bassPulse',
  'attack',
];
