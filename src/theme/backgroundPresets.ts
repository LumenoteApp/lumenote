import type { BackgroundParams, BackgroundStyle } from '../midi/types';

export type BackgroundPreset = {
  id: BackgroundStyle | 'off';
  name: string;
  blurb: string;
  params: BackgroundParams;
};

export const DEFAULT_BACKGROUND: BackgroundParams = {
  enabled: true,
  style: 'nebula',
  intensity: 0.75,
  parallax: 0.45,
  stars: 0.55,
  orbs: 0.7,
  waves: 0.55,
  beams: 0.35,
  reactive: 0.85,
};

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'nebula',
    name: 'Nebula',
    blurb: 'Orbs + stars + haze',
    params: {
      enabled: true,
      style: 'nebula',
      intensity: 0.8,
      parallax: 0.5,
      stars: 0.6,
      orbs: 0.85,
      waves: 0.45,
      beams: 0.4,
      reactive: 0.9,
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Flowing color bands',
    params: {
      enabled: true,
      style: 'aurora',
      intensity: 0.85,
      parallax: 0.4,
      stars: 0.35,
      orbs: 0.55,
      waves: 0.95,
      beams: 0.15,
      reactive: 0.8,
    },
  },
  {
    id: 'starfield',
    name: 'Starfield',
    blurb: 'Deep space glitter',
    params: {
      enabled: true,
      style: 'starfield',
      intensity: 0.9,
      parallax: 0.65,
      stars: 1,
      orbs: 0.15,
      waves: 0,
      beams: 0.1,
      reactive: 0.6,
    },
  },
  {
    id: 'pulse',
    name: 'Pulse',
    blurb: 'Beams that pump with notes',
    params: {
      enabled: true,
      style: 'pulse',
      intensity: 0.85,
      parallax: 0.55,
      stars: 0.25,
      orbs: 0.7,
      waves: 0.2,
      beams: 0.95,
      reactive: 1,
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    blurb: 'Synthwave horizon',
    params: {
      enabled: true,
      style: 'grid',
      intensity: 0.75,
      parallax: 0.7,
      stars: 0.3,
      orbs: 0.2,
      waves: 0,
      beams: 0.2,
      reactive: 0.85,
    },
  },
  {
    id: 'void',
    name: 'Void',
    blurb: 'Minimal distant stars',
    params: {
      enabled: true,
      style: 'void',
      intensity: 0.45,
      parallax: 0.25,
      stars: 0.4,
      orbs: 0,
      waves: 0,
      beams: 0,
      reactive: 0.35,
    },
  },
  {
    id: 'off',
    name: 'Off',
    blurb: 'Flat color only',
    params: {
      enabled: false,
      style: 'void',
      intensity: 0,
      parallax: 0,
      stars: 0,
      orbs: 0,
      waves: 0,
      beams: 0,
      reactive: 0,
    },
  },
];
