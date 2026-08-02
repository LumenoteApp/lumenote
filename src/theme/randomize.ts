import type {
  BackgroundParams,
  BackgroundStyle,
  ParticleParams,
  VisualSettings,
} from '../midi/types';
import type { ColorMode, ColorSettings } from './colorPresets';
import { COLOR_MODE_PRESETS, TRACK_PALETTE_PRESETS } from './colorPresets';
import type { MusicReactiveParams } from '../midi/types';

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function snap(v: number, step = 0.05) {
  return Math.round(v / step) * step;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomHex(): string {
  const n = Math.floor(Math.random() * 0xffffff);
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Dark-ish base colors that still look intentional */
export function randomBgBaseColor(): string {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(rand(20, 55));
  const l = Math.floor(rand(4, 14));
  // convert simple HSL to hex via canvas-less approx
  return hslToHex(h, s / 100, l / 100);
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function randomizeParticles(): ParticleParams {
  return {
    density: snap(rand(0.35, 1.9)),
    size: snap(rand(0.4, 1.9)),
    sizeVariance: snap(rand(0.1, 0.95)),
    speed: snap(rand(0.35, 1.95)),
    spread: snap(rand(0.1, 1)),
    gravity: snap(rand(-1.0, 1.5)),
    drag: snap(rand(0.05, 0.75)),
    lifetime: snap(rand(0.35, 1.9)),
    turbulence: snap(rand(0.05, 1.1)),
    sparkle: snap(rand(0.1, 1)),
    bloom: snap(rand(0.5, 1.9)),
    secondaryBurst: snap(rand(0.1, 1.15)),
    trail: snap(rand(0.05, 0.95)),
    whiteHot: snap(rand(0.15, 0.95)),
    swirl: snap(rand(0, 1.1)),
    sustainEmit: snap(rand(0.05, 1.15)),
    hitFlash: snap(rand(0.15, 1.15)),
  };
}

const BG_STYLES: BackgroundStyle[] = [
  'void',
  'starfield',
  'aurora',
  'nebula',
  'pulse',
  'grid',
];

export function randomizeBackground(): BackgroundParams {
  const style = pick(BG_STYLES);
  return {
    enabled: true,
    style,
    intensity: snap(rand(0.35, 1.15)),
    parallax: snap(rand(0.15, 1.1)),
    stars: snap(rand(0.1, 1)),
    orbs: snap(rand(0.05, 1)),
    waves: snap(rand(0, 1)),
    beams: snap(rand(0, 1)),
    reactive: snap(rand(0.35, 1.15)),
  };
}

export function randomizeMusicReactive(): MusicReactiveParams {
  return {
    enabled: true,
    intensity: snap(rand(0.55, 1.35)),
    ambient: snap(rand(0.25, 1.25)),
    columns: snap(rand(0.2, 1.35)),
    waves: snap(rand(0.15, 1.3)),
    bassPulse: snap(rand(0.15, 1.3)),
    attack: snap(rand(0.35, 1.15)),
  };
}

export type VisualCoreRandom = Pick<
  VisualSettings,
  | 'pixelsPerSecond'
  | 'noteOpacity'
  | 'glowStrength'
  | 'backgroundColor'
  | 'showKeyboard'
  | 'showHitRail'
  | 'hitRailIntensity'
>;

export function randomizeVisuals(): VisualCoreRandom {
  return {
    pixelsPerSecond: Math.round(rand(160, 480)),
    noteOpacity: snap(rand(0.45, 1)),
    glowStrength: snap(rand(0.2, 1)),
    backgroundColor: randomBgBaseColor(),
    showKeyboard: Math.random() > 0.12,
    showHitRail: Math.random() > 0.15,
    hitRailIntensity: snap(rand(0.35, 1.15)),
  };
}

export function randomizeColors(): ColorSettings {
  const mode = pick(COLOR_MODE_PRESETS.map((m) => m.id)) as ColorMode;
  const paletteId = pick(TRACK_PALETTE_PRESETS).id;
  return {
    mode,
    paletteId,
    cycleSpeed: snap(rand(0.1, 1.2)),
    saturation: snap(rand(0.45, 1)),
    brightness: snap(rand(0.55, 1.15)),
    trackBlend: mode === 'track' ? 0 : snap(rand(0, 0.55)),
  };
}

/** Full look: every section at once */
export function randomizeEverything(
  current: VisualSettings,
): VisualSettings {
  return {
    ...current,
    ...randomizeVisuals(),
    particlesEnabled: true,
    particlePresetId: 'custom',
    particles: randomizeParticles(),
    background: randomizeBackground(),
    musicReactivePresetId: 'custom',
    musicReactive: randomizeMusicReactive(),
    colors: randomizeColors(),
  };
}
