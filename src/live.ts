import type { LiveNote } from './render/Renderer';
import type { Audio } from './audio/Player';
import type { Voice } from './audio/Piano';

/** Web MIDI input -> rising notes + piano sound (with sustain pedal). */
export class LiveInput {
  notes: LiveNote[] = [];
  devices: string[] = [];
  connected = false;
  onChange: () => void = () => {};

  private held = new Map<number, { note: LiveNote; voice: Voice | null }>();
  private sustained = new Map<number, Voice[]>();
  private pedal = false;
  private access: MIDIAccess | null = null;

  constructor(private audio: Audio) {}

  static get supported() {
    return 'requestMIDIAccess' in navigator;
  }

  /** Seconds, same clock used to draw live notes. */
  now() {
    return performance.now() / 1000;
  }

  async connect() {
    if (!LiveInput.supported) throw new Error('This browser has no Web MIDI. Use Chrome or Edge.');
    void this.audio.ensure();
    this.access = await navigator.requestMIDIAccess();
    this.access.onstatechange = () => this.bind();
    this.bind();
  }

  /** Reconnect silently if the user granted MIDI before. */
  async autoConnect() {
    if (!LiveInput.supported) return;
    try {
      const st = await navigator.permissions.query({ name: 'midi' as PermissionName });
      if (st.state === 'granted') await this.connect();
    } catch {
      /* permissions API without midi support */
    }
  }

  private bind() {
    if (!this.access) return;
    this.devices = [];
    for (const input of this.access.inputs.values()) {
      if (input.state !== 'connected') continue;
      this.devices.push(input.name ?? 'MIDI input');
      input.onmidimessage = (e) => e.data && this.message(e.data);
    }
    this.connected = this.devices.length > 0;
    this.onChange();
  }

  private message(d: Uint8Array) {
    const type = d[0] & 0xf0;
    if (type === 0x90 && d[2] > 0) this.down(d[1], d[2] / 127);
    else if (type === 0x80 || (type === 0x90 && d[2] === 0)) this.up(d[1]);
    else if (type === 0xb0 && d[1] === 64) this.setPedal(d[2] >= 64);
  }

  down(pitch: number, velocity: number) {
    const now = this.now();
    this.up(pitch);
    for (const v of this.sustained.get(pitch) ?? []) v.stop(this.audio.now);
    this.sustained.delete(pitch);
    const note: LiveNote = { pitch, start: now, end: null, velocity };
    this.notes.push(note);
    const piano = this.audio.piano;
    const voice = piano && this.audio.ctx?.state === 'running' ? piano.play(pitch, velocity, this.audio.now) : null;
    this.held.set(pitch, { note, voice });
  }

  up(pitch: number) {
    const h = this.held.get(pitch);
    if (!h) return;
    this.held.delete(pitch);
    h.note.end = this.now();
    if (!h.voice) return;
    if (this.pedal) {
      const list = this.sustained.get(pitch) ?? [];
      list.push(h.voice);
      this.sustained.set(pitch, list);
    } else h.voice.stop(this.audio.now);
  }

  private setPedal(down: boolean) {
    this.pedal = down;
    if (down) return;
    const now = this.audio.now;
    for (const list of this.sustained.values()) for (const v of list) v.stop(now);
    this.sustained.clear();
  }

  /** Drop notes that have scrolled off the top. */
  prune(maxAge: number) {
    const now = this.now();
    if (this.notes.length && this.notes.some((n) => n.end !== null && now - n.end > maxAge)) {
      this.notes = this.notes.filter((n) => n.end === null || now - n.end <= maxAge);
    }
  }
}
