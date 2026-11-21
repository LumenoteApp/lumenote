import type { LiveNote } from './render/Renderer';
import type { Audio } from './audio/Player';
import type { Voice } from './audio/Piano';

export type Port = { id: string; name: string };

const PREFS = 'lumenote.v2.midi';
type Prefs = { input: string; output: string; local: boolean };

function loadPrefs(): Prefs {
  try {
    return { input: 'all', output: '', local: true, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') };
  } catch {
    return { input: 'all', output: '', local: true };
  }
}

/**
 * Web MIDI in and out.
 * In: rising notes + piano sound (with sustain pedal), from one keyboard or all.
 * Out: what you play (thru) and song playback go to the chosen output, e.g. Pianoteq or a digital piano.
 */
export class LiveInput {
  notes: LiveNote[] = [];
  inputs: Port[] = [];
  outputs: Port[] = [];
  /** Names of the inputs we are listening to right now. */
  devices: string[] = [];
  connected = false;
  enabled = false;
  prefs = loadPrefs();
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
    if (this.access) return;
    this.access = await navigator.requestMIDIAccess();
    this.enabled = true;
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

  setInput(id: string) {
    this.prefs.input = id;
    this.savePrefs();
    this.bind();
  }

  setOutput(id: string) {
    this.allOff();
    this.prefs.output = id;
    this.savePrefs();
    this.onChange();
  }

  setLocal(on: boolean) {
    this.prefs.local = on;
    this.savePrefs();
    this.onChange();
  }

  private savePrefs() {
    localStorage.setItem(PREFS, JSON.stringify(this.prefs));
  }

  /** The chosen output, if it is plugged in. */
  get output(): MIDIOutput | null {
    if (!this.access || !this.prefs.output) return null;
    const out = this.access.outputs.get(this.prefs.output);
    return out && out.state === 'connected' ? out : null;
  }

  /** Play the built-in piano? Always when nothing else makes sound. */
  get localSound() {
    return this.prefs.local || !this.output;
  }

  private bind() {
    if (!this.access) return;
    const ports = (m: MIDIInputMap | MIDIOutputMap) =>
      [...m.values()].filter((p) => p.state === 'connected').map((p) => ({ id: p.id, name: p.name || 'MIDI device' }));
    this.inputs = ports(this.access.inputs);
    this.outputs = ports(this.access.outputs);
    // A saved keyboard that is not plugged in: listen to everything until it comes back.
    const only = this.inputs.some((p) => p.id === this.prefs.input) ? this.prefs.input : 'all';
    this.devices = [];
    for (const input of this.access.inputs.values()) {
      const use = input.state === 'connected' && (only === 'all' || input.id === only);
      input.onmidimessage = use ? (e) => e.data && this.message(e.data, input.name ?? '') : null;
      if (use) this.devices.push(input.name || 'MIDI input');
    }
    this.connected = this.devices.length > 0;
    this.onChange();
  }

  private message(d: Uint8Array, from: string) {
    const type = d[0] & 0xf0;
    const isNote = type === 0x90 || type === 0x80;
    const isPedal = type === 0xb0 && d[1] === 64;
    if (type === 0x90 && d[2] > 0) this.down(d[1], d[2] / 127);
    else if (isNote) this.up(d[1]);
    else if (isPedal) this.setPedal(d[2] >= 64);
    // Thru, but not back into the keyboard we are playing (it already sounds).
    const out = this.output;
    if (out && (isNote || isPedal) && out.name !== from) this.send([d[0], d[1], d[2]]);
  }

  down(pitch: number, velocity: number) {
    const now = this.now();
    this.up(pitch);
    for (const v of this.sustained.get(pitch) ?? []) v.stop(this.audio.now);
    this.sustained.delete(pitch);
    const note: LiveNote = { pitch, start: now, end: null, velocity };
    this.notes.push(note);
    const piano = this.audio.piano;
    const voice =
      this.localSound && piano && this.audio.ctx?.state === 'running' ? piano.play(pitch, velocity, this.audio.now) : null;
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

  // ---------------------------------------------------------------- output

  send(bytes: number[], at?: number) {
    try {
      this.output?.send(bytes, at);
    } catch {
      /* port went away */
    }
  }

  /** Schedule a song note on the output. Delays are seconds from now. */
  playNote(pitch: number, velocity: number, onIn: number, offIn: number) {
    if (!this.output) return;
    const t = performance.now();
    const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    this.send([0x90, pitch, v], t + Math.max(0, onIn) * 1000);
    this.send([0x80, pitch, 0], t + Math.max(0, offIn) * 1000);
  }

  /** Silence the output, including notes already queued for later. */
  allOff() {
    const out = this.output;
    if (!out) return;
    try {
      (out as MIDIOutput & { clear?: () => void }).clear?.();
    } catch {
      /* clear() is not in every browser */
    }
    for (let ch = 0; ch < 16; ch++) {
      this.send([0xb0 | ch, 64, 0]);
      this.send([0xb0 | ch, 123, 0]);
    }
  }

  /** Drop notes that have scrolled off the top. */
  prune(maxAge: number) {
    const now = this.now();
    if (this.notes.length && this.notes.some((n) => n.end !== null && now - n.end > maxAge)) {
      this.notes = this.notes.filter((n) => n.end === null || now - n.end <= maxAge);
    }
  }
}
