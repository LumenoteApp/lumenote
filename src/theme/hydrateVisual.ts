import type {
  VisualSettings,
  ParticleParams,
  MusicReactiveParams,
  BackgroundParams,
} from '../midi/types';
import { DEFAULT_VISUAL_SETTINGS } from './defaultPalette';
import { normalizeColorSettings } from './colorPresets';
import { normalizeNoteStyle } from './notePresets';
import {
  normalizeHitRailEnergy,
  normalizeHitRailStyle,
} from './hitRailPresets';
import { hydrateEffects, type LegacyEffectsSource } from './effects';
import { normalizeStageImage } from './stageImage';

export type RawVisualSettings = Partial<VisualSettings> &
  LegacyEffectsSource & {
    background?: Partial<BackgroundParams>;
    particles?: Partial<ParticleParams> | null;
    musicReactive?: Partial<MusicReactiveParams> | null;
  };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Merge loaded JSON with defaults so older presets still work. */
export function hydrateVisualSettings(raw: unknown): VisualSettings {
  const r = isRecord(raw) ? (raw as RawVisualSettings) : {};
  const d = DEFAULT_VISUAL_SETTINGS;
  const { effects, effectsPresetId } = hydrateEffects(r);
  const bg = r.background ?? {};

  return {
    pixelsPerSecond: num(r.pixelsPerSecond, d.pixelsPerSecond),
    noteOpacity: num(r.noteOpacity, d.noteOpacity),
    glowStrength: num(r.glowStrength, d.glowStrength),
    notes: normalizeNoteStyle({
      ...d.notes,
      ...(r.notes ?? {}),
    }),
    noteStylePresetId: str(r.noteStylePresetId, d.noteStylePresetId),
    effectsPresetId,
    effects,
    background: {
      ...d.background,
      ...bg,
    },
    stageImage: normalizeStageImage(r.stageImage),
    colors: normalizeColorSettings(r.colors ?? d.colors),
    backgroundColor: str(r.backgroundColor, d.backgroundColor),
    showKeyboard: bool(r.showKeyboard, d.showKeyboard),
    keyboardHeight: num(r.keyboardHeight, d.keyboardHeight),
    showHitRail: bool(r.showHitRail, d.showHitRail),
    hitRailIntensity: num(r.hitRailIntensity, d.hitRailIntensity),
    hitRailStyle: normalizeHitRailStyle(r.hitRailStyle ?? d.hitRailStyle),
    hitRailEnergy: normalizeHitRailEnergy(r.hitRailEnergy ?? d.hitRailEnergy),
  };
}

export function cloneVisualSettings(s: VisualSettings): VisualSettings {
  return {
    ...s,
    notes: normalizeNoteStyle(s.notes),
    effects: { ...s.effects },
    background: { ...s.background },
    stageImage: { ...s.stageImage },
    colors: normalizeColorSettings(s.colors),
  };
}
