import { Midi } from '@tonejs/midi';
import { colorForTrack } from '../theme/defaultPalette';
import type { NoteEvent, Song, TempoEvent, TrackInfo } from './types';
import { MIDI_DEFAULT_BPM, normalizeBpm, noteSoundDuration } from './types';

/**
 * Empty time at the start of every loaded song so the first notes can
 * scroll down from above before they hit (live + offline bake share this).
 */
export const SONG_LEAD_IN_SECONDS = 1;

type SustainEvent = {
  time: number;
  /** true when CC64 ≥ 64 */
  down: boolean;
  channel: number;
};

/**
 * @tonejs/midi stores CC values as 0–1 (raw MIDI / 127), not 0–127.
 * Pedal "on" is raw ≥ 64 → normalized ≥ ~0.5.
 */
function isSustainDown(value: number): boolean {
  // Support both normalized (Tone) and raw 0–127 if a path ever changes
  if (value > 1) return value >= 64;
  return value >= 0.5;
}

/**
 * Collect sustain pedal (CC 64) from every track, including tracks with no notes.
 * Also accepts the named key "sustain" that Tone may expose.
 */
function collectSustainEvents(midi: Midi): SustainEvent[] {
  const events: SustainEvent[] = [];
  for (const track of midi.tracks) {
    const channel = track.channel ?? 0;
    const ccs =
      track.controlChanges?.[64] ??
      track.controlChanges?.['64'] ??
      // name alias used by some Tone controlChange maps
      (track.controlChanges as { sustain?: typeof track.controlChanges[64] })
        ?.sustain;
    if (!ccs?.length) continue;
    for (const cc of ccs) {
      events.push({
        time: cc.time ?? 0,
        down: isSustainDown(cc.value ?? 0),
        channel,
      });
    }
  }
  events.sort((a, b) => a.time - b.time);
  return events;
}

/**
 * Compute sustain-extended *sound* lengths from CC 64.
 * Visual `duration` (key-down length) is left unchanged; audio uses `soundDuration`.
 */
export function applySustainPedal(
  notes: NoteEvent[],
  pedals: SustainEvent[],
): NoteEvent[] {
  if (notes.length === 0) return notes;
  if (pedals.length === 0) {
    return notes.map((n) => ({
      ...n,
      soundDuration: n.soundDuration ?? n.duration,
    }));
  }

  const byChannel = new Map<number, NoteEvent[]>();
  for (const n of notes) {
    const list = byChannel.get(n.channel) ?? [];
    list.push(n);
    byChannel.set(n.channel, list);
  }

  type Work = {
    note: NoteEvent;
    keyOff: number;
    soundingEnd: number;
  };

  type Ev =
    | { t: number; kind: 'on'; pitch: number; w: Work }
    | { t: number; kind: 'off'; pitch: number; w: Work }
    | { t: number; kind: 'pedal'; down: boolean };

  const kindOrder = { off: 0, pedal: 1, on: 2 } as const;
  const out: NoteEvent[] = [];

  for (const [channel, chNotes] of byChannel) {
    const work: Work[] = chNotes.map((n) => {
      const keyOff = n.start + n.duration;
      return { note: n, keyOff, soundingEnd: keyOff };
    });

    // Prefer pedals on this channel; if none (pedal track with different/default ch),
    // fall back to all sustain events (common piano MIDI layout).
    let chPedals = pedals.filter((p) => p.channel === channel);
    if (chPedals.length === 0) chPedals = pedals;

    const events: Ev[] = [];
    for (const w of work) {
      events.push({ t: w.note.start, kind: 'on', pitch: w.note.pitch, w });
      events.push({ t: w.keyOff, kind: 'off', pitch: w.note.pitch, w });
    }
    for (const p of chPedals) {
      events.push({ t: p.time, kind: 'pedal', down: p.down });
    }

    events.sort(
      (a, b) => a.t - b.t || kindOrder[a.kind] - kindOrder[b.kind],
    );

    let pedal = false;
    const fingers = new Map<number, Work>();
    const pedalHeld = new Map<number, Work>();

    const endWork = (w: Work, t: number) => {
      w.soundingEnd = Math.max(w.soundingEnd, t);
    };

    for (const e of events) {
      if (e.kind === 'pedal') {
        pedal = e.down;
        if (!pedal) {
          for (const [, w] of pedalHeld) {
            endWork(w, e.t);
          }
          pedalHeld.clear();
        }
        continue;
      }

      if (e.kind === 'on') {
        const prevFinger = fingers.get(e.pitch);
        const prevPedal = pedalHeld.get(e.pitch);
        if (prevFinger && prevFinger !== e.w) {
          endWork(prevFinger, e.t);
          fingers.delete(e.pitch);
        }
        if (prevPedal && prevPedal !== e.w) {
          endWork(prevPedal, e.t);
          pedalHeld.delete(e.pitch);
        }
        fingers.set(e.pitch, e.w);
        continue;
      }

      // off
      if (fingers.get(e.pitch) === e.w) {
        fingers.delete(e.pitch);
      }
      if (pedal) {
        pedalHeld.set(e.pitch, e.w);
      } else {
        endWork(e.w, e.t);
        pedalHeld.delete(e.pitch);
      }
    }

    for (const w of work) {
      const visual = Math.max(0.04, w.note.duration);
      const sound = Math.max(visual, w.soundingEnd - w.note.start);
      out.push({
        ...w.note,
        duration: visual,
        soundDuration: sound,
      });
    }
  }

  return out;
}

export async function parseMidiFile(
  file: File | ArrayBuffer,
  name = 'untitled.mid',
): Promise<Song> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const displayName = file instanceof File ? file.name : name;
  const midi = new Midi(buffer);

  const tracks: TrackInfo[] = [];
  // `let` so large remaps can reassign without Array#push(...huge) which
  // blows the call stack (arg list limit) on dense / long MIDI files.
  let notes: NoteEvent[] = [];
  let noteId = 0;

  // Sustain may live on tracks without notes - collect before filtering
  const sustainEvents = collectSustainEvents(midi);

  midi.tracks.forEach((track) => {
    if (track.notes.length === 0) return;

    const channel = track.channel ?? 0;
    const trackName =
      track.name?.trim() ||
      (track.instrument?.name ? String(track.instrument.name) : `Track ${tracks.length + 1}`);

    const infoIndex = tracks.length;
    tracks.push({
      index: infoIndex,
      name: trackName,
      channel,
      color: colorForTrack(infoIndex),
      visible: true,
      muted: false,
      noteCount: track.notes.length,
    });

    for (const n of track.notes) {
      const duration = Math.max(n.duration, 0.04);
      notes.push({
        id: `n${noteId++}`,
        pitch: n.midi,
        start: n.time,
        duration,
        velocity: Math.min(1, Math.max(0.05, n.velocity)),
        trackIndex: infoIndex,
        channel,
      });
    }
  });

  // Fallback: some files put everything on one track with multiple channels
  if (tracks.length === 1) {
    const channels = new Set(notes.map((n) => n.channel));
    if (channels.size > 1) {
      const byChannel = new Map<number, NoteEvent[]>();
      for (const n of notes) {
        const list = byChannel.get(n.channel) ?? [];
        list.push(n);
        byChannel.set(n.channel, list);
      }
      tracks.length = 0;
      const remapped: NoteEvent[] = [];
      let idx = 0;
      for (const [channel, channelNotes] of byChannel) {
        tracks.push({
          index: idx,
          name: `Channel ${channel + 1}`,
          channel,
          color: colorForTrack(idx),
          visible: true,
          muted: false,
          noteCount: channelNotes.length,
        });
        for (const n of channelNotes) {
          remapped.push({ ...n, trackIndex: idx });
        }
        idx++;
      }
      notes = remapped;
    }
  }

  // Apply CC 64 sustain so scheduled note-off matches piano pedaling.
  // Reassign instead of push(...arr) — see note above about stack limits.
  notes = applySustainPedal(notes, sustainEvents);

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  // Refresh note counts after sustain (count unchanged, but keep consistent)
  for (const t of tracks) {
    t.noteCount = notes.filter((n) => n.trackIndex === t.index).length;
  }

  // Lead-in: shift timeline so notes fall in from above before the first hit.
  // Applied after sustain so soundDuration stays a relative length.
  const leadIn = SONG_LEAD_IN_SECONDS;
  if (leadIn > 0) {
    for (const n of notes) {
      n.start += leadIn;
    }
  }

  // Song length must cover lead-in + sustain tail so audio is not cut off
  const duration = Math.max(
    midi.duration + leadIn,
    notes.reduce(
      (max, n) => Math.max(max, n.start + noteSoundDuration(n)),
      0,
    ),
  );

  const tempos = buildTempoMap(midi.header.tempos, leadIn);

  return {
    name: displayName,
    duration: duration + 0.5,
    tracks,
    notes,
    tempos,
  };
}

/**
 * Build a clean tempo map for UI + playback display.
 * - Converts Tone.js tempo events (ticks already → time on header)
 * - Normalizes float BPM noise from µs/beat conversion
 * - Ensures a value at song start (MIDI default 120 until first setTempo)
 * - Drops redundant consecutive duplicates
 */
function buildTempoMap(
  raw: Array<{ time?: number; bpm?: number; ticks?: number }> | undefined,
  leadIn: number,
): TempoEvent[] {
  const events: TempoEvent[] = [];
  if (raw?.length) {
    for (const t of raw) {
      const bpm = normalizeBpm(typeof t.bpm === 'number' ? t.bpm : MIDI_DEFAULT_BPM);
      const time = (typeof t.time === 'number' && Number.isFinite(t.time) ? t.time : 0) + leadIn;
      events.push({ time: Math.max(0, time), bpm });
    }
  }

  events.sort((a, b) => a.time - b.time || a.bpm - b.bpm);

  // MIDI default until the first setTempo (often missing at tick 0)
  if (events.length === 0) {
    return [{ time: 0, bpm: MIDI_DEFAULT_BPM }];
  }
  if (events[0]!.time > leadIn + 0.02) {
    events.unshift({ time: 0, bpm: MIDI_DEFAULT_BPM });
  } else {
    // Snap near-start tempos to 0 so bpmAt(0) hits cleanly
    events[0] = { ...events[0]!, time: 0, bpm: normalizeBpm(events[0]!.bpm) };
  }

  const deduped: TempoEvent[] = [];
  for (const ev of events) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.bpm - ev.bpm) < 0.05 && Math.abs(prev.time - ev.time) < 0.001) {
      continue;
    }
    if (prev && Math.abs(prev.bpm - ev.bpm) < 0.05) {
      // Same BPM later - keep first only
      continue;
    }
    deduped.push({ time: ev.time, bpm: normalizeBpm(ev.bpm) });
  }

  return deduped.length > 0 ? deduped : [{ time: 0, bpm: MIDI_DEFAULT_BPM }];
}
