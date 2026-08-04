/**
 * Virtual Piano QWERTY layout (the common 1–m sheet layout).
 *
 * White keys in order (36 keys):
 *   1234567890qwertyuiopasdfghjklzxcvbnm
 *   1 = C2 (MIDI 36) … m = C7 (MIDI 96)
 *
 * Hold Shift → temporary +1 transpose (release restores).
 * Global transpose: ←/→ ±12, ↓/↑ ±1 (applied on top of base map).
 * Space: toggles sustain from the default (sustain-on-by-default is normal VP).
 */

/** White-key chain as KeyboardEvent.code, left → right. */
export const VP_WHITE_CODES: readonly string[] = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
];

/** Labels drawn on white keys (same order as VP_WHITE_CODES). */
export const VP_WHITE_LABELS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  'Q',
  'W',
  'E',
  'R',
  'T',
  'Y',
  'U',
  'I',
  'O',
  'P',
  'A',
  'S',
  'D',
  'F',
  'G',
  'H',
  'J',
  'K',
  'L',
  'Z',
  'X',
  'C',
  'V',
  'B',
  'N',
  'M',
];

/** Semitone steps within an octave for white keys C D E F G A B. */
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/** Base: white index 0 = C2. */
export const VP_BASE_C_MIDI = 36; // C2
export const VP_WHITE_COUNT = VP_WHITE_CODES.length; // 36 → ends on C7 (96)

const CODE_TO_WHITE_INDEX: Readonly<Record<string, number>> = (() => {
  const m: Record<string, number> = {};
  VP_WHITE_CODES.forEach((code, i) => {
    m[code] = i;
  });
  return m;
})();

/** MIDI pitch for the nth white key starting at C2 (no transpose). */
export function whiteIndexToMidi(whiteIndex: number): number {
  const octave = Math.floor(whiteIndex / 7);
  const step = whiteIndex % 7;
  return VP_BASE_C_MIDI + octave * 12 + WHITE_SEMITONES[step]!;
}

export function isComputerPianoNoteCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CODE_TO_WHITE_INDEX, code);
}

export function isComputerPianoHandledCode(code: string): boolean {
  return (
    isComputerPianoNoteCode(code) ||
    code === 'Space' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown'
  );
}

/**
 * Resolve a note key to MIDI.
 * @param transpose - effective transpose (base + temporary Shift, etc.)
 */
export function codeToMidi(code: string, transpose: number): number | null {
  const idx = CODE_TO_WHITE_INDEX[code];
  if (idx === undefined) return null;
  const midi = whiteIndexToMidi(idx) + transpose;
  if (midi < 0 || midi > 127) return null;
  return midi;
}

export const DEFAULT_TRANSPOSE = 0;
export const MIN_TRANSPOSE = -24;
export const MAX_TRANSPOSE = 24;

export function clampTranspose(t: number): number {
  const n = Math.round(Number(t));
  if (!Number.isFinite(n)) return DEFAULT_TRANSPOSE;
  return Math.max(MIN_TRANSPOSE, Math.min(MAX_TRANSPOSE, n));
}

/** midi → label for current effective transpose (white keys only). */
export function labelsForTranspose(transpose: number): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 0; i < VP_WHITE_COUNT; i++) {
    const whiteMidi = whiteIndexToMidi(i) + transpose;
    if (whiteMidi >= 0 && whiteMidi <= 127) {
      map.set(whiteMidi, VP_WHITE_LABELS[i]!);
    }
  }
  return map;
}

export const COMPUTER_PIANO_STORAGE_KEY = 'lumenote-computer-piano-v2';

export type ComputerPianoPrefs = {
  /** Virtual Piano QWERTY (1–m) */
  qwertyEnabled: boolean;
  /** Global transpose in semitones (0 = 1 is C2) */
  transpose: number;
  /** Draw key letters on the on-screen keyboard */
  showLabels: boolean;
  /**
   * When true (Virtual Piano default): notes sustain after key-up;
   * hold Space to lift sustain. When false: normal key-up; hold Space to sustain.
   */
  sustainDefaultOn: boolean;
};

export const DEFAULT_COMPUTER_PIANO_PREFS: ComputerPianoPrefs = {
  qwertyEnabled: false,
  transpose: DEFAULT_TRANSPOSE,
  showLabels: true,
  sustainDefaultOn: true,
};

export function loadComputerPianoPrefs(): ComputerPianoPrefs {
  try {
    const raw =
      localStorage.getItem(COMPUTER_PIANO_STORAGE_KEY) ??
      localStorage.getItem('lumenote-computer-piano-v1');
    if (!raw) return { ...DEFAULT_COMPUTER_PIANO_PREFS };
    const parsed = JSON.parse(raw) as Partial<ComputerPianoPrefs> & {
      octave?: number;
    };
    return {
      qwertyEnabled: Boolean(parsed.qwertyEnabled),
      transpose: clampTranspose(
        parsed.transpose ?? DEFAULT_TRANSPOSE,
      ),
      showLabels:
        parsed.showLabels === undefined
          ? DEFAULT_COMPUTER_PIANO_PREFS.showLabels
          : Boolean(parsed.showLabels),
      sustainDefaultOn:
        parsed.sustainDefaultOn === undefined
          ? DEFAULT_COMPUTER_PIANO_PREFS.sustainDefaultOn
          : Boolean(parsed.sustainDefaultOn),
    };
  } catch {
    return { ...DEFAULT_COMPUTER_PIANO_PREFS };
  }
}

export function saveComputerPianoPrefs(prefs: ComputerPianoPrefs) {
  try {
    localStorage.setItem(COMPUTER_PIANO_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota */
  }
}

/** Format transpose for UI, e.g. 0 → "0 (1=C2)", +12 → "+12". */
export function formatTranspose(t: number): string {
  if (t === 0) return '0 · 1=C2';
  return t > 0 ? `+${t}` : `${t}`;
}
