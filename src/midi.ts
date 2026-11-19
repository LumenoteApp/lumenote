import { Midi } from '@tonejs/midi';

export type Note = {
  pitch: number;
  start: number;
  /** Key-down end (what the visuals show). */
  end: number;
  /** Sound end including sustain pedal. */
  soundEnd: number;
  velocity: number;
  /** 0 = left hand / first part, 1 = right hand / second part. */
  hand: 0 | 1;
};

export type Song = {
  name: string;
  notes: Note[];
  /** Time of the first note-on. */
  first: number;
  /** Time the last note stops sounding. */
  end: number;
  lowest: number;
  highest: number;
};

type Raw = { pitch: number; start: number; end: number; velocity: number; track: number };

export function parseMidi(buffer: ArrayBuffer, name: string): Song {
  const midi = new Midi(buffer);
  const raw: Raw[] = [];
  const pedal: { t: number; down: boolean }[] = [];

  midi.tracks.forEach((track, ti) => {
    for (const n of track.notes) {
      raw.push({
        pitch: n.midi,
        start: n.time,
        end: n.time + Math.max(0.03, n.duration),
        velocity: n.velocity,
        track: ti,
      });
    }
    for (const cc of track.controlChanges[64] ?? []) {
      pedal.push({ t: cc.time, down: cc.value >= 0.5 });
    }
  });

  raw.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  pedal.sort((a, b) => a.t - b.t);

  const hands = assignHands(raw);
  const soundEnds = sustainEnds(raw, pedal);

  const notes: Note[] = raw.map((r, i) => ({
    pitch: r.pitch,
    start: r.start,
    end: r.end,
    soundEnd: soundEnds[i],
    velocity: r.velocity,
    hand: hands[i],
  }));

  let lowest = 127;
  let highest = 0;
  let end = 0;
  for (const n of notes) {
    lowest = Math.min(lowest, n.pitch);
    highest = Math.max(highest, n.pitch);
    end = Math.max(end, n.soundEnd);
  }

  return {
    name: name.replace(/\.(mid|midi)$/i, ''),
    notes,
    first: notes.length ? notes[0].start : 0,
    end,
    lowest: notes.length ? lowest : 21,
    highest: notes.length ? highest : 108,
  };
}

/**
 * Two or more note tracks: lowest-average track is the left hand, the rest right.
 * One track (typical piano transcription): split around a moving center so
 * both hands keep their own color even when they cross middle C.
 */
function assignHands(raw: Raw[]): (0 | 1)[] {
  const byTrack = new Map<number, { sum: number; count: number }>();
  for (const r of raw) {
    const s = byTrack.get(r.track) ?? { sum: 0, count: 0 };
    s.sum += r.pitch;
    s.count++;
    byTrack.set(r.track, s);
  }

  if (byTrack.size >= 2) {
    let leftTrack = -1;
    let lowest = Infinity;
    for (const [t, s] of byTrack) {
      const avg = s.sum / s.count;
      if (avg < lowest) {
        lowest = avg;
        leftTrack = t;
      }
    }
    return raw.map((r) => (r.track === leftTrack ? 0 : 1));
  }

  // Single track: split each note against the local pitch center (smoothed),
  // clamped to a sane range around middle C.
  const out: (0 | 1)[] = new Array(raw.length);
  let lo = 48;
  let hi = 72;
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i].pitch;
    // Track running low/high hand centers.
    const split = Math.min(66, Math.max(54, (lo + hi) / 2));
    const left = p < split;
    out[i] = left ? 0 : 1;
    if (left) lo = lo * 0.85 + p * 0.15;
    else hi = hi * 0.85 + p * 0.15;
  }
  return out;
}

function sustainEnds(raw: Raw[], pedal: { t: number; down: boolean }[]): number[] {
  const out = raw.map((r) => r.end);
  if (!pedal.length) return out;
  // For each note, if the pedal is down when the key is released, the sound
  // continues until the pedal comes up (or the same key is struck again).
  const nextSame = new Array<number>(raw.length).fill(Infinity);
  const lastIdx = new Map<number, number>();
  for (let i = raw.length - 1; i >= 0; i--) {
    const j = lastIdx.get(raw[i].pitch);
    if (j !== undefined) nextSame[i] = raw[j].start;
    lastIdx.set(raw[i].pitch, i);
  }
  for (let i = 0; i < raw.length; i++) {
    const off = raw[i].end;
    let down = false;
    let k = 0;
    // Binary search for last pedal event <= off.
    let a = 0;
    let b = pedal.length - 1;
    k = -1;
    while (a <= b) {
      const m = (a + b) >> 1;
      if (pedal[m].t <= off) {
        k = m;
        a = m + 1;
      } else b = m - 1;
    }
    if (k >= 0) down = pedal[k].down;
    if (!down) continue;
    let up = Infinity;
    for (let m = k + 1; m < pedal.length; m++) {
      if (!pedal[m].down) {
        up = pedal[m].t;
        break;
      }
    }
    out[i] = Math.max(off, Math.min(up, nextSame[i], off + 12));
  }
  return out;
}
