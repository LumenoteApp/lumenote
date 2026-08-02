import type { MusicReactiveParams } from '../midi/types';

export type MusicReactivePreset = {
  id: string;
  name: string;
  blurb: string;
  params: MusicReactiveParams;
};

export const MUSIC_REACTIVE_PRESETS: MusicReactivePreset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    blurb: 'Default lively mix',
    params: {
      enabled: true,
      intensity: 0.95,
      ambient: 0.75,
      columns: 0.85,
      waves: 0.8,
      bassPulse: 0.7,
      attack: 0.75,
    },
  },
  {
    id: 'chill',
    name: 'Chill',
    blurb: 'Soft floating dust',
    params: {
      enabled: true,
      intensity: 0.55,
      ambient: 0.9,
      columns: 0.35,
      waves: 0.25,
      bassPulse: 0.3,
      attack: 0.4,
    },
  },
  {
    id: 'rave',
    name: 'Rave',
    blurb: 'Max chaos energy',
    params: {
      enabled: true,
      intensity: 1.35,
      ambient: 1.15,
      columns: 1.25,
      waves: 1.3,
      bassPulse: 1.2,
      attack: 1.05,
    },
  },
  {
    id: 'bass',
    name: 'Bass heavy',
    blurb: 'Booms & shockwaves',
    params: {
      enabled: true,
      intensity: 1.05,
      ambient: 0.5,
      columns: 0.55,
      waves: 1.15,
      bassPulse: 1.35,
      attack: 0.9,
    },
  },
  {
    id: 'streams',
    name: 'Streams',
    blurb: 'Rising key columns',
    params: {
      enabled: true,
      intensity: 1,
      ambient: 0.4,
      columns: 1.35,
      waves: 0.45,
      bassPulse: 0.4,
      attack: 0.7,
    },
  },
  {
    id: 'pulse',
    name: 'Pulse',
    blurb: 'Snappy attack hits',
    params: {
      enabled: true,
      intensity: 1.1,
      ambient: 0.55,
      columns: 0.7,
      waves: 1.2,
      bassPulse: 0.85,
      attack: 1.15,
    },
  },
  {
    id: 'ethereal',
    name: 'Ethereal',
    blurb: 'Airy slow field',
    params: {
      enabled: true,
      intensity: 0.7,
      ambient: 1.2,
      columns: 0.5,
      waves: 0.35,
      bassPulse: 0.25,
      attack: 0.35,
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'Barely there',
    params: {
      enabled: true,
      intensity: 0.35,
      ambient: 0.4,
      columns: 0.2,
      waves: 0.15,
      bassPulse: 0.2,
      attack: 0.5,
    },
  },
  {
    id: 'off',
    name: 'Off',
    blurb: 'Disable field',
    params: {
      enabled: false,
      intensity: 0,
      ambient: 0,
      columns: 0,
      waves: 0,
      bassPulse: 0,
      attack: 0.5,
    },
  },
];

export { randomizeMusicReactive } from './randomize';

export function getMusicPreset(id: string): MusicReactivePreset {
  return MUSIC_REACTIVE_PRESETS.find((p) => p.id === id) ?? MUSIC_REACTIVE_PRESETS[0];
}
