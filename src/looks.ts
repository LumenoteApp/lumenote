/** A "look" is a complete, tuned style. Users pick one, then optionally change the two hand colors. */
export type Look = {
  id: string;
  name: string;
  /** Background top / bottom. */
  bg: [string, string];
  /** Left hand, right hand. */
  hands: [string, string];
  /** Bloom strength 0..2 */
  glow: number;
  /** Particle amount 0..1.5 */
  sparks: number;
};

export const LOOKS: Look[] = [
  { id: 'midnight', name: 'Midnight', bg: ['#04050b', '#0c1022'], hands: ['#8b7cff', '#3fd0ff'], glow: 1, sparks: 1 },
  { id: 'ember', name: 'Ember', bg: ['#070302', '#1a0a05'], hands: ['#ff4d5e', '#ffb340'], glow: 1.1, sparks: 1.2 },
  { id: 'aurora', name: 'Aurora', bg: ['#020807', '#06171a'], hands: ['#4f8dff', '#3cf0b4'], glow: 1, sparks: 0.9 },
  { id: 'sakura', name: 'Sakura', bg: ['#08040a', '#190b1a'], hands: ['#b48cff', '#ff8cc6'], glow: 0.9, sparks: 0.8 },
  { id: 'forest', name: 'Forest', bg: ['#020604', '#0a1a10'], hands: ['#2fe0a0', '#c8e85a'], glow: 1, sparks: 0.9 },
  { id: 'copper', name: 'Copper', bg: ['#060403', '#1a110b'], hands: ['#e8946a', '#ffe2b0'], glow: 1.05, sparks: 0.8 },
  { id: 'mono', name: 'Mono', bg: ['#050505', '#111111'], hands: ['#9aa3ad', '#f2f4f7'], glow: 0.6, sparks: 0.5 },
];

/** How the falling notes are filled. */
export const NOTE_STYLES = [
  { id: 'classic', name: 'Classic' },
  { id: 'flame', name: 'Flame' },
  { id: 'plasma', name: 'Plasma' },
] as const;
export type NoteStyle = (typeof NOTE_STYLES)[number]['id'];

export type Settings = {
  look: string;
  hands: [string, string];
  /** Seconds a note takes to fall from the top to the keys. */
  fall: number;
  glow: number;
  sparks: number;
  style: NoteStyle;
  /** Speed of everything that animates (haze, sparks, flame, plasma). 0 = still, 1 = normal. */
  motion: number;
};

export function settingsForLook(id: string): Settings {
  const look = LOOKS.find((l) => l.id === id) ?? LOOKS[0];
  return { look: look.id, hands: [...look.hands], fall: 2.4, glow: look.glow, sparks: look.sparks, style: 'classic', motion: 1 };
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
