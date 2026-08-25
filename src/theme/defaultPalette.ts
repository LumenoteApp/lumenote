import type { VisualSettings } from '../midi/types';
import { DEFAULT_BACKGROUND } from './backgroundPresets';
import { DEFAULT_COLOR_SETTINGS } from './colorPresets';
import { DEFAULT_NOTE_STYLE } from './notePresets';
import { DEFAULT_EFFECTS, DEFAULT_EFFECTS_PRESET_ID } from './effects';
import { DEFAULT_STAGE_IMAGE } from './stageImage';

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

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  pixelsPerSecond: 280,
  noteOpacity: 0.92,
  glowStrength: 0.65,
  notes: { ...DEFAULT_NOTE_STYLE },
  noteStylePresetId: 'solid',
  effectsPresetId: DEFAULT_EFFECTS_PRESET_ID,
  effects: { ...DEFAULT_EFFECTS },
  background: { ...DEFAULT_BACKGROUND },
  stageImage: { ...DEFAULT_STAGE_IMAGE },
  colors: { ...DEFAULT_COLOR_SETTINGS },
  backgroundColor: '#07080c',
  showKeyboard: true,
  keyboardHeight: 200,
  showHitRail: true,
  hitRailIntensity: 0.85,
  hitRailStyle: 'soft',
  hitRailEnergy: 0.55,
};
