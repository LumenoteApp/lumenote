import type { Song } from '../midi';
import { loadSamples, Piano, type Voice } from './Piano';
import type { LiveInput } from '../live';

/** Shared realtime audio: song playback + live keyboard. Created on first user gesture. */
export class Audio {
  ctx: AudioContext | null = null;
  piano: Piano | null = null;
  private loading: Promise<void> | null = null;
  volume = 0.9;

  ensure(): Promise<void> {
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.loading) {
      const ctx = this.ctx;
      this.loading = loadSamples(ctx).then((s) => {
        this.piano = new Piano(ctx, s, this.volume);
      });
      this.loading.catch(() => (this.loading = null));
    }
    return this.loading;
  }

  setVolume(v: number) {
    this.volume = v;
    this.piano?.setVolume(v);
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }
}

/** Song transport. Song time = offset + (ctx time - anchor) while playing. */
export class Player {
  song: Song | null = null;
  playing = false;
  private offset = 0;
  private anchor = 0;
  private cursor = 0;
  private voices: { v: Voice; end: number }[] = [];
  private timer = 0;
  /** Wall clock fallback while audio is still loading. */
  private wallAnchor = 0;
  onEnd: () => void = () => {};
  /** MIDI out for song playback (and whether the built-in piano should still sound). */
  midi: LiveInput | null = null;

  constructor(private audio: Audio) {}

  load(song: Song, startAt: number) {
    this.pause();
    this.song = song;
    this.offset = startAt;
  }

  get time(): number {
    if (!this.playing) return this.offset;
    const ctx = this.audio.ctx;
    if (ctx && ctx.state === 'running') return this.offset + (ctx.currentTime - this.anchor);
    return this.offset + (performance.now() / 1000 - this.wallAnchor);
  }

  async play() {
    if (!this.song || this.playing) return;
    if (this.offset >= this.song.end) this.offset = 0;
    void this.audio.ensure();
    const ctx = this.audio.ctx!;
    this.playing = true;
    this.anchor = ctx.currentTime;
    this.wallAnchor = performance.now() / 1000;
    this.cursor = this.indexAt(this.offset);
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.time;
    this.playing = false;
    clearInterval(this.timer);
    const now = this.audio.now;
    for (const { v } of this.voices) v.stop(now);
    this.voices = [];
    this.midi?.allOff();
  }

  seek(t: number) {
    const was = this.playing;
    this.pause();
    this.offset = t;
    if (was) void this.play();
  }

  private indexAt(t: number) {
    const notes = this.song!.notes;
    let a = 0;
    let b = notes.length;
    while (a < b) {
      const m = (a + b) >> 1;
      if (notes[m].start < t) a = m + 1;
      else b = m;
    }
    return a;
  }

  private schedule() {
    const song = this.song!;
    const piano = this.audio.piano;
    const ctx = this.audio.ctx!;
    const t = this.time;
    const horizon = t + 0.12;
    const notes = song.notes;
    while (this.cursor < notes.length && notes[this.cursor].start < horizon) {
      const n = notes[this.cursor++];
      if (n.start < t - 0.05) continue;
      this.midi?.playNote(n.pitch, n.velocity, n.start - t, n.soundEnd - t);
      if (this.midi && !this.midi.localSound) continue;
      if (!piano || ctx.state !== 'running') continue;
      const at = this.anchor + (n.start - this.offset);
      const v = piano.play(n.pitch, n.velocity, at);
      if (v) {
        const endAt = this.anchor + (n.soundEnd - this.offset);
        v.stop(endAt);
        this.voices.push({ v, end: endAt });
      }
    }
    if (this.voices.length > 64) {
      const now = ctx.currentTime;
      this.voices = this.voices.filter((x) => x.end > now);
    }
    if (t > song.end + 1.5) {
      this.pause();
      this.offset = song.end + 1.5;
      this.onEnd();
    }
  }
}
