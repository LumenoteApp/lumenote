/** Standard 88-key piano: A0 (21) - C8 (108) */
export const FIRST_MIDI = 21;
export const LAST_MIDI = 108;
export const KEY_COUNT = LAST_MIDI - FIRST_MIDI + 1;

const BLACK_OFFSETS = new Set([1, 3, 6, 8, 10]); // within octave (C=0)

export function isBlackKey(midi: number): boolean {
  return BLACK_OFFSETS.has(midi % 12);
}

export function countWhiteKeys(from = FIRST_MIDI, to = LAST_MIDI): number {
  let n = 0;
  for (let m = from; m <= to; m++) {
    if (!isBlackKey(m)) n++;
  }
  return n;
}

export const WHITE_KEY_COUNT = countWhiteKeys();

/** Map MIDI pitch to center X in [0, width] using white-key spacing */
export function pitchToX(midi: number, width: number): number {
  const whiteWidth = width / WHITE_KEY_COUNT;
  let whiteIndex = 0;
  for (let m = FIRST_MIDI; m < midi; m++) {
    if (!isBlackKey(m)) whiteIndex++;
  }
  if (isBlackKey(midi)) {
    // Black key sits between previous and next white
    return (whiteIndex - 0.5) * whiteWidth + whiteWidth * 0.5;
  }
  return whiteIndex * whiteWidth + whiteWidth * 0.5;
}

export function whiteKeyWidth(width: number): number {
  return width / WHITE_KEY_COUNT;
}

export function blackKeyWidth(width: number): number {
  return whiteKeyWidth(width) * 0.58;
}

export type KeyRect = {
  midi: number;
  x: number;
  w: number;
  isBlack: boolean;
};

export function buildKeyRects(width: number): KeyRect[] {
  const ww = whiteKeyWidth(width);
  const bw = blackKeyWidth(width);
  const whites: KeyRect[] = [];
  const blacks: KeyRect[] = [];
  let wi = 0;
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    if (!isBlackKey(m)) {
      whites.push({ midi: m, x: wi * ww, w: ww, isBlack: false });
      wi++;
    }
  }
  wi = 0;
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    if (!isBlackKey(m)) {
      wi++;
    } else {
      blacks.push({
        midi: m,
        x: wi * ww - bw / 2,
        w: bw,
        isBlack: true,
      });
    }
  }
  return [...whites, ...blacks];
}

/** Black key height as a fraction of the keyboard strip (matches VisualizerEngine paint). */
export const BLACK_KEY_HEIGHT_RATIO = 0.62;

/**
 * Hit-test logical canvas coords against the on-screen piano.
 * Black keys win when the pointer is in the black-key vertical band.
 * Returns MIDI pitch or null.
 */
export function hitTestPianoKey(
  x: number,
  y: number,
  width: number,
  height: number,
  keyboardH: number,
): number | null {
  if (keyboardH <= 0 || width <= 0 || height <= 0) return null;
  const ky = height - keyboardH;
  if (y < ky || y > height || x < 0 || x > width) return null;

  const keys = buildKeyRects(width);
  const blackBottom = ky + 3 + keyboardH * BLACK_KEY_HEIGHT_RATIO;

  if (y <= blackBottom) {
    for (const key of keys) {
      if (!key.isBlack) continue;
      if (x >= key.x && x < key.x + key.w) return key.midi;
    }
  }

  for (const key of keys) {
    if (key.isBlack) continue;
    if (x >= key.x && x < key.x + key.w) return key.midi;
  }
  return null;
}
