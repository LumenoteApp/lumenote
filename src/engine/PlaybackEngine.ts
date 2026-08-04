import type { NoteEvent, Song, TrackInfo } from '../midi/types';
import { AudioEngine } from './AudioEngine';
import type { InstrumentId } from './instruments';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

/** Live MIDI note for keyboard state + rising note bars. */
export type LiveNoteState = {
  id: string;
  pitch: number;
  velocity: number;
  channel: number;
  /** performance.now() when pressed (wall clock - animates without song play) */
  wallStart: number;
  /** performance.now() when released; null while still held */
  wallEnd: number | null;
};

type Listener = () => void;

/**
 * True only when mute/visibility change (not color/name).
 * Exported so tests can assert color-only updates never reschedule audio.
 */
export function tracksAffectAudio(prev: TrackInfo[], next: TrackInfo[]): boolean {
  if (prev.length !== next.length) return true;
  const prevByIndex = new Map(prev.map((t) => [t.index, t]));
  for (const t of next) {
    const p = prevByIndex.get(t.index);
    if (!p) return true;
    if (p.muted !== t.muted || p.visible !== t.visible) return true;
  }
  return false;
}

export class PlaybackEngine {
  readonly audio = new AudioEngine();
  private song: Song | null = null;
  private tracks: TrackInfo[] = [];
  private state: PlaybackState = 'stopped';
  private pauseOffset = 0;
  private listeners = new Set<Listener>();
  private onNoteHit: ((note: NoteEvent) => void) | null = null;
  private hitCursor = 0;
  private lastTime = 0;
  private playWallStart = 0;
  /** Currently held live notes (pitch → state) for keyboard lighting. */
  private liveHeld = new Map<number, LiveNoteState>();
  /**
   * Held + recently released live notes for rising bars.
   * Released notes stay until pruned (scrolled off / aged out).
   */
  private liveVisual: LiveNoteState[] = [];

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  setOnNoteHit(cb: ((note: NoteEvent) => void) | null) {
    this.onNoteHit = cb;
  }

  /** Currently held live notes (keyboard / sustain particles). */
  getLiveNotes(): ReadonlyMap<number, LiveNoteState> {
    return this.liveHeld;
  }

  /**
   * Live note bars (held grow up from hit line; released scroll upward).
   * Prunes notes older than ~12s after release.
   */
  getLiveVisualNotes(): readonly LiveNoteState[] {
    const now = performance.now();
    const maxReleaseAgeMs = 12_000;
    if (this.liveVisual.length > 0) {
      this.liveVisual = this.liveVisual.filter((n) => {
        if (n.wallEnd === null) return true;
        return now - n.wallEnd < maxReleaseAgeMs;
      });
    }
    return this.liveVisual;
  }

  private clearLiveVisual() {
    this.liveHeld.clear();
    this.liveVisual = [];
  }

  /**
   * Live MIDI note-on: init audio if needed, sound, track for visuals, fire hit FX.
   * Does not touch the transport schedule (safe mid-playback).
   */
  async liveNoteOn(pitch: number, velocity: number, channel = 0) {
    const p = Math.min(127, Math.max(0, pitch | 0));
    const vel = Math.max(0.01, Math.min(1, velocity));
    const ch = Math.min(15, Math.max(0, channel));

    if (!this.audio.isReady()) {
      try {
        await this.audio.init();
      } catch {
        return;
      }
    }

    this.audio.noteOn(p, vel, ch);
    const now = performance.now();

    // Re-trigger same pitch: seal previous bar so it can float up
    const prev = this.liveHeld.get(p);
    if (prev && prev.wallEnd === null) {
      prev.wallEnd = now;
    }

    const note: LiveNoteState = {
      id: `live-${p}-${now}`,
      pitch: p,
      velocity: vel,
      channel: ch,
      wallStart: now,
      wallEnd: null,
    };
    this.liveHeld.set(p, note);
    this.liveVisual.push(note);

    if (this.onNoteHit) {
      this.onNoteHit({
        id: note.id,
        pitch: p,
        start: this.getTime(),
        duration: 0.05,
        velocity: vel,
        trackIndex: this.tracks[0]?.index ?? 0,
        channel: ch,
      });
    }
  }

  liveNoteOff(pitch: number, _channel = 0) {
    const p = Math.min(127, Math.max(0, pitch | 0));
    this.audio.noteOff(p, _channel);
    const held = this.liveHeld.get(p);
    if (held && held.wallEnd === null) {
      held.wallEnd = performance.now();
    }
    this.liveHeld.delete(p);
  }

  /** Clear live held notes + rising bars (UI disconnect / panic). */
  releaseLiveNotes() {
    this.audio.releaseLiveNotes();
    this.clearLiveVisual();
  }

  setSong(song: Song | null) {
    this.stop();
    this.song = song;
    this.tracks = song ? song.tracks.map((t) => ({ ...t })) : [];
    this.pauseOffset = 0;
    this.hitCursor = 0;
    this.emit();
  }

  getSong() {
    return this.song;
  }

  getTracks() {
    return this.tracks;
  }

  /**
   * Update track metadata. Color/name-only changes never touch the audio
   * schedule (that was desyncing playback when applying color presets).
   * Mute/visibility changes re-anchor the transport correctly.
   */
  updateTracks(tracks: TrackInfo[]) {
    const needsAudioResync = tracksAffectAudio(this.tracks, tracks);
    this.tracks = tracks.map((t) => ({ ...t }));

    if (needsAudioResync && this.state === 'playing' && this.song && this.audio.isReady()) {
      this.reanchorPlayback(this.getTime());
    }

    // Emit so UI picks up new colors without touching the clock
    this.emit();
  }

  getState() {
    return this.state;
  }

  getTime(): number {
    if (!this.song) return 0;
    if (this.state === 'playing') {
      if (this.audio.isReady()) {
        return this.pauseOffset + this.audio.getTransportSeconds();
      }
      return this.pauseOffset + (performance.now() - this.playWallStart) / 1000;
    }
    return this.pauseOffset;
  }

  getDuration() {
    return this.song?.duration ?? 0;
  }

  async setInstrument(id: InstrumentId) {
    const wasPlaying = this.state === 'playing';
    const t = this.getTime();
    if (wasPlaying) {
      this.audio.transportPauseStop();
      this.audio.clearSchedule();
    }
    this.clearLiveVisual();
    await this.audio.init();
    await this.audio.setInstrument(id);
    if (wasPlaying) {
      this.reanchorPlayback(t);
      this.state = 'playing';
    }
    this.emit();
  }

  async loadSf2(buffer: ArrayBuffer, name: string) {
    const wasPlaying = this.state === 'playing';
    const t = this.getTime();
    if (wasPlaying) {
      this.audio.transportPauseStop();
      this.audio.clearSchedule();
    }
    this.clearLiveVisual();
    await this.audio.init();
    await this.audio.loadSf2(buffer, name);
    await this.audio.setInstrument('sf2');
    if (wasPlaying) {
      this.reanchorPlayback(t);
      this.state = 'playing';
    }
    this.emit();
  }

  setVolume(v: number) {
    this.audio.setVolume(v);
    this.emit();
  }

  async play() {
    if (!this.song) return;
    await this.audio.init();

    if (this.state === 'playing') return;

    if (this.pauseOffset >= this.song.duration - 0.05) {
      this.pauseOffset = 0;
    }

    this.reanchorPlayback(this.pauseOffset);
    this.state = 'playing';
    this.emit();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.pauseOffset = this.getTime();
    this.audio.transportPauseStop();
    this.audio.clearSchedule();
    // clearSchedule releases synths - drop live visual state to match
    this.clearLiveVisual();
    this.state = 'paused';
    this.emit();
  }

  stop() {
    this.audio.transportStop();
    this.audio.clearSchedule();
    this.clearLiveVisual();
    this.pauseOffset = 0;
    this.hitCursor = 0;
    this.lastTime = 0;
    this.state = 'stopped';
    this.emit();
  }

  seek(time: number) {
    const duration = this.getDuration();
    const t = Math.max(0, Math.min(time, duration));
    const wasPlaying = this.state === 'playing';

    if (wasPlaying) {
      this.audio.transportPauseStop();
      this.audio.clearSchedule();
      this.clearLiveVisual();
    }

    this.pauseOffset = t;
    this.syncHitCursor(t);
    this.lastTime = t;

    if (wasPlaying) {
      this.reanchorPlayback(t);
      this.state = 'playing';
    } else {
      this.state = t > 0 ? 'paused' : 'stopped';
    }
    this.emit();
  }

  /**
   * Rebuild the note schedule so relative times start at 0 on the Tone
   * transport, and song position is carried by pauseOffset.
   * Always call this instead of scheduleNotes alone while playing.
   */
  private reanchorPlayback(songTime: number) {
    if (!this.song) return;
    this.pauseOffset = songTime;
    this.syncHitCursor(songTime);
    this.lastTime = songTime;
    this.playWallStart = performance.now();
    // scheduleNotes → clearSchedule kills live synth voices
    this.clearLiveVisual();
    this.audio.scheduleNotes(this.song.notes, this.tracks, songTime);
    if (this.audio.isReady()) {
      this.audio.transportStart(); // transport.seconds = 0, then start
    }
  }

  private syncHitCursor(time: number) {
    if (!this.song) {
      this.hitCursor = 0;
      return;
    }
    let i = 0;
    while (i < this.song.notes.length && this.song.notes[i].start < time - 0.001) i++;
    this.hitCursor = i;
  }

  tickHits() {
    if (!this.song || this.state !== 'playing' || !this.onNoteHit) return;
    const time = this.getTime();
    const notes = this.song.notes;
    const muted = new Set(this.tracks.filter((t) => t.muted || !t.visible).map((t) => t.index));

    while (this.hitCursor < notes.length && notes[this.hitCursor].start <= time) {
      const n = notes[this.hitCursor];
      if (!muted.has(n.trackIndex) && n.start >= this.lastTime - 0.02) {
        this.onNoteHit(n);
      }
      this.hitCursor++;
    }

    if (time >= this.song.duration) {
      this.pauseOffset = this.song.duration;
      this.audio.transportPauseStop();
      this.audio.clearSchedule();
      this.state = 'paused';
      this.emit();
    }

    this.lastTime = time;
  }
}

export const playbackEngine = new PlaybackEngine();
