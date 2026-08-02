import { Midi } from '@tonejs/midi';
import { colorForTrack } from '../theme/defaultPalette';
import type { NoteEvent, Song, TrackInfo } from './types';

export async function parseMidiFile(file: File | ArrayBuffer, name = 'untitled.mid'): Promise<Song> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const displayName = file instanceof File ? file.name : name;
  const midi = new Midi(buffer);

  const tracks: TrackInfo[] = [];
  const notes: NoteEvent[] = [];
  let noteId = 0;

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
      notes.length = 0;
      notes.push(...remapped);
    }
  }

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  const duration = Math.max(
    midi.duration,
    notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0),
  );

  const tempos =
    midi.header.tempos?.map((t) => ({
      time: t.time ?? 0,
      bpm: t.bpm,
    })) ?? [{ time: 0, bpm: 120 }];

  return {
    name: displayName,
    duration: duration + 0.5,
    tracks,
    notes,
    tempos,
  };
}
