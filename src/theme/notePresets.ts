import type { NoteStyleId, NoteStyleParams } from '../midi/types';

export type NoteStylePreset = {
  id: string;
  name: string;
  blurb: string;
  params: NoteStyleParams;
};

export const DEFAULT_NOTE_STYLE: NoteStyleParams = {
  style: 'solid',
  border: 0.25,
  shine: 0.35,
  innerFx: 0.35,
  roundness: 0.55,
};

export const NOTE_STYLE_PRESETS: NoteStylePreset[] = [
  {
    id: 'solid',
    name: 'Solid',
    blurb: 'Classic filled bars',
    params: { style: 'solid', border: 0.2, shine: 0.3, innerFx: 0.2, roundness: 0.55 },
  },
  {
    id: 'glass',
    name: 'Glass',
    blurb: 'Frosted translucent bars',
    params: { style: 'glass', border: 0.55, shine: 0.85, innerFx: 0.25, roundness: 0.7 },
  },
  {
    id: 'gem',
    name: 'Gem',
    blurb: 'Faceted jewel edges',
    params: { style: 'gem', border: 0.75, shine: 1, innerFx: 0.55, roundness: 0.35 },
  },
  {
    id: 'flame',
    name: 'Flame',
    blurb: 'Fire particles inside',
    params: { style: 'flame', border: 0.45, shine: 0.55, innerFx: 1.1, roundness: 0.5 },
  },
  {
    id: 'crystal',
    name: 'Crystal',
    blurb: 'Ice shards and glints',
    params: { style: 'crystal', border: 0.7, shine: 0.95, innerFx: 0.75, roundness: 0.25 },
  },
  {
    id: 'outline',
    name: 'Outline',
    blurb: 'Hollow neon stroke',
    params: { style: 'outline', border: 1, shine: 0.4, innerFx: 0.15, roundness: 0.6 },
  },
  {
    id: 'plasma',
    name: 'Plasma',
    blurb: 'Electric bands inside',
    params: { style: 'plasma', border: 0.5, shine: 0.65, innerFx: 1.05, roundness: 0.55 },
  },
  {
    id: 'chrome',
    name: 'Chrome',
    blurb: 'Metallic sheen',
    params: { style: 'chrome', border: 0.4, shine: 1, innerFx: 0.35, roundness: 0.4 },
  },
  {
    id: 'pixel',
    name: 'Pixel',
    blurb: 'Chunky retro blocks',
    params: { style: 'pixel', border: 0.65, shine: 0.2, innerFx: 0.2, roundness: 0.05 },
  },
];

export function getNoteStylePreset(id: string): NoteStylePreset {
  return NOTE_STYLE_PRESETS.find((p) => p.id === id) ?? NOTE_STYLE_PRESETS[0];
}

export function normalizeNoteStyle(partial?: Partial<NoteStyleParams> | null): NoteStyleParams {
  const base = DEFAULT_NOTE_STYLE;
  const style = (partial?.style as NoteStyleId) || base.style;
  const clamp = (v: number | undefined, d: number) =>
    Number.isFinite(v as number) ? Math.max(0, Math.min(1.5, v as number)) : d;
  return {
    style: NOTE_STYLE_PRESETS.some((p) => p.params.style === style) ? style : base.style,
    border: clamp(partial?.border, base.border),
    shine: clamp(partial?.shine, base.shine),
    innerFx: clamp(partial?.innerFx, base.innerFx),
    roundness: clamp(partial?.roundness, base.roundness),
  };
}
