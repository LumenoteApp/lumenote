import type { VisualSettings } from '../midi/types';
import { DEFAULT_BACKGROUND } from './backgroundPresets';
import { DEFAULT_COLOR_SETTINGS } from './colorPresets';
import { getPreset } from './particlePresets';

/** Distinct hues for multi-track coloring (LH/RH etc.) */
export const TRACK_PALETTE = [
  '#4FC3F7',
  '#F48FB1',
  '#CE93D8',
  '#A5D6A7',
  '#FFCC80',
  '#80CBC4',
  '#EF9A9A',
  '#90CAF9',
  '#FFF59D',
  '#B0BEC5',
  '#F8BBD0',
  '#B39DDB',
];

export function colorForTrack(index: number): string {
  return TRACK_PALETTE[index % TRACK_PALETTE.length];
}

const ember = getPreset('ember');

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  pixelsPerSecond: 280,
  noteOpacity: 0.92,
  glowStrength: 0.65,
  particlesEnabled: true,
  particlePresetId: 'ember',
  particles: { ...ember.params },
  background: { ...DEFAULT_BACKGROUND },
  musicReactive: {
    enabled: true,
    intensity: 0.95,
    ambient: 0.75,
    columns: 0.85,
    waves: 0.8,
    bassPulse: 0.7,
    attack: 0.75,
  },
  musicReactivePresetId: 'balanced',
  colors: { ...DEFAULT_COLOR_SETTINGS },
  backgroundColor: '#07080c',
  showKeyboard: true,
  showHitRail: true,
  hitRailIntensity: 0.85,
};
