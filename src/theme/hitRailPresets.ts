import type { HitRailStyleId } from '../midi/types';

export type HitRailStylePreset = {
  id: HitRailStyleId;
  name: string;
  blurb: string;
  /** Default energy for this look */
  energy: number;
};

export const HIT_RAIL_STYLE_PRESETS: HitRailStylePreset[] = [
  { id: 'soft', name: 'Soft', blurb: 'Classic bloom rail', energy: 0.45 },
  { id: 'electric', name: 'Electric', blurb: 'Jagged arcs + cloud', energy: 0.95 },
  { id: 'wave', name: 'Wave', blurb: 'Traveling sine crest', energy: 0.75 },
  { id: 'shock', name: 'Shock', blurb: 'Expanding hit rings', energy: 0.9 },
  { id: 'spark', name: 'Spark', blurb: 'Hot spark scatter', energy: 0.85 },
  { id: 'laser', name: 'Laser', blurb: 'Hard neon core', energy: 0.55 },
  { id: 'storm', name: 'Storm', blurb: 'Thunder cloud bank', energy: 1.05 },
  { id: 'aurora', name: 'Aurora', blurb: 'Soft color curtains', energy: 0.8 },
];

export const DEFAULT_HIT_RAIL_STYLE: HitRailStyleId = 'soft';
export const DEFAULT_HIT_RAIL_ENERGY = 0.55;

export function getHitRailStylePreset(id: string): HitRailStylePreset {
  return HIT_RAIL_STYLE_PRESETS.find((p) => p.id === id) ?? HIT_RAIL_STYLE_PRESETS[0];
}

export function normalizeHitRailStyle(id: unknown): HitRailStyleId {
  const s = String(id ?? '');
  return HIT_RAIL_STYLE_PRESETS.some((p) => p.id === s)
    ? (s as HitRailStyleId)
    : DEFAULT_HIT_RAIL_STYLE;
}

export function normalizeHitRailEnergy(v: unknown): number {
  const n = typeof v === 'number' ? v : DEFAULT_HIT_RAIL_ENERGY;
  if (!Number.isFinite(n)) return DEFAULT_HIT_RAIL_ENERGY;
  return Math.max(0, Math.min(1.4, n));
}
