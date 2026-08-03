/**
 * Web MIDI input / output manager.
 * Lazy: does not request access until enable() (user gesture friendly).
 */

export type MidiPortInfo = {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
};

export type MidiNoteMessage = {
  type: 'noteon' | 'noteoff';
  pitch: number;
  velocity: number; // 0–1
  channel: number; // 0–15
  rawVelocity: number; // 0–127
};

type Listener = () => void;
type NoteListener = (msg: MidiNoteMessage) => void;

function portInfo(port: MIDIPort): MidiPortInfo {
  return {
    id: port.id,
    name: port.name || port.id,
    manufacturer: port.manufacturer || '',
    state: port.state,
  };
}

function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export class MidiIO {
  private access: MIDIAccess | null = null;
  private listeners = new Set<Listener>();
  private noteListeners = new Set<NoteListener>();
  private inputId: string | 'all' | null = null;
  private outputId: string | null = null;
  /** When true, midimessage handlers are attached and fire note events */
  private inputEnabled = true;
  /** Echo live input to the selected MIDI out */
  private thru = false;
  /** Send song playback notes to MIDI out */
  private outputPlayback = true;
  private error: string | null = null;
  private boundPorts = new Map<string, (e: MIDIMessageEvent) => void>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onNote(fn: NoteListener) {
    this.noteListeners.add(fn);
    return () => {
      this.noteListeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private emitNote(msg: MidiNoteMessage) {
    for (const fn of this.noteListeners) fn(msg);
  }

  isSupported() {
    return isWebMidiSupported();
  }

  isEnabled() {
    return !!this.access;
  }

  getError() {
    return this.error;
  }

  getInputs(): MidiPortInfo[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map(portInfo);
  }

  getOutputs(): MidiPortInfo[] {
    if (!this.access) return [];
    return [...this.access.outputs.values()].map(portInfo);
  }

  getInputId() {
    return this.inputId;
  }

  getOutputId() {
    return this.outputId;
  }

  isInputEnabled() {
    return this.inputEnabled;
  }

  isThru() {
    return this.thru;
  }

  isOutputPlayback() {
    return this.outputPlayback;
  }

  setInputEnabled(v: boolean) {
    this.inputEnabled = v;
    this.rewireInputs();
    this.emit();
  }

  setThru(v: boolean) {
    this.thru = v;
    this.emit();
  }

  setOutputPlayback(v: boolean) {
    this.outputPlayback = v;
    this.emit();
  }

  setInputId(id: string | 'all' | null) {
    this.inputId = id;
    this.rewireInputs();
    this.emit();
  }

  setOutputId(id: string | null) {
    // All notes off on previous output before switching
    if (this.outputId && this.outputId !== id) {
      this.allNotesOff();
    }
    this.outputId = id;
    this.emit();
  }

  /**
   * Request MIDI access (call from a user gesture when possible).
   */
  async enable(): Promise<boolean> {
    if (!isWebMidiSupported()) {
      this.error = 'Web MIDI is not supported in this browser (try Chrome, Edge, or Opera).';
      this.emit();
      return false;
    }
    if (this.access) return true;

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.error = null;
      this.access.onstatechange = () => {
        this.rewireInputs();
        this.emit();
      };
      // Prefer first input if none selected
      if (this.inputId === null) {
        const first = this.access.inputs.values().next().value as MIDIInput | undefined;
        this.inputId = first ? first.id : 'all';
      }
      this.rewireInputs();
      this.emit();
      return true;
    } catch (e) {
      this.error =
        e instanceof Error
          ? e.message
          : 'MIDI access denied — check browser permissions.';
      this.access = null;
      this.emit();
      return false;
    }
  }

  disable() {
    this.unwireAllInputs();
    this.allNotesOff();
    if (this.access) {
      this.access.onstatechange = null;
    }
    this.access = null;
    this.error = null;
    this.emit();
  }

  private unwireAllInputs() {
    if (!this.access) {
      this.boundPorts.clear();
      return;
    }
    for (const [id, handler] of this.boundPorts) {
      const port = this.access.inputs.get(id);
      if (port) port.onmidimessage = null;
      void handler;
    }
    this.boundPorts.clear();
  }

  private rewireInputs() {
    this.unwireAllInputs();
    if (!this.access || !this.inputEnabled) return;

    const attach = (input: MIDIInput) => {
      const handler = (e: MIDIMessageEvent) => this.handleMessage(e);
      input.onmidimessage = handler;
      this.boundPorts.set(input.id, handler);
    };

    if (this.inputId === 'all' || this.inputId === null) {
      for (const input of this.access.inputs.values()) attach(input);
    } else {
      const input = this.access.inputs.get(this.inputId);
      if (input) attach(input);
    }
  }

  private handleMessage(e: MIDIMessageEvent) {
    const data = e.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const cmd = status & 0xf0;
    const channel = status & 0x0f;
    const data1 = data[1];
    const data2 = data.length > 2 ? data[2] : 0;

    // Note on (0x90) with vel 0 = note off
    if (cmd === 0x90 && data2 > 0) {
      const msg: MidiNoteMessage = {
        type: 'noteon',
        pitch: data1,
        velocity: data2 / 127,
        channel,
        rawVelocity: data2,
      };
      this.emitNote(msg);
      if (this.thru) this.sendNoteOn(data1, data2, channel);
      return;
    }

    if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
      const msg: MidiNoteMessage = {
        type: 'noteoff',
        pitch: data1,
        velocity: 0,
        channel,
        rawVelocity: 0,
      };
      this.emitNote(msg);
      if (this.thru) this.sendNoteOff(data1, channel);
      return;
    }

    // CC 64 sustain, CC 123 all notes off — forward when thru
    if (cmd === 0xb0 && this.thru) {
      this.sendRaw([status, data1, data2]);
    }
  }

  private getOutput(): MIDIOutput | null {
    if (!this.access || !this.outputId) return null;
    return this.access.outputs.get(this.outputId) ?? null;
  }

  sendRaw(bytes: number[], timestamp?: number) {
    const out = this.getOutput();
    if (!out) return;
    try {
      if (timestamp !== undefined) out.send(bytes, timestamp);
      else out.send(bytes);
    } catch {
      /* port may have disappeared */
    }
  }

  sendNoteOn(pitch: number, velocity127: number, channel = 0, timestamp?: number) {
    const ch = Math.min(15, Math.max(0, channel));
    const p = Math.min(127, Math.max(0, pitch | 0));
    const v = Math.min(127, Math.max(1, velocity127 | 0));
    this.sendRaw([0x90 | ch, p, v], timestamp);
  }

  sendNoteOff(pitch: number, channel = 0, timestamp?: number) {
    const ch = Math.min(15, Math.max(0, channel));
    const p = Math.min(127, Math.max(0, pitch | 0));
    this.sendRaw([0x80 | ch, p, 0], timestamp);
  }

  /**
   * Schedule a playback note to the selected MIDI out (if outputPlayback).
   * `audioTime` is AudioContext time; converted to DOMHighResTimestamp.
   */
  schedulePlaybackNote(
    type: 'on' | 'off',
    pitch: number,
    velocity127: number,
    channel: number,
    audioTime: number,
    audioContextCurrentTime: number,
  ) {
    if (!this.outputPlayback || !this.outputId) return;
    const delaySec = Math.max(0, audioTime - audioContextCurrentTime);
    const ts = performance.now() + delaySec * 1000;
    if (type === 'on') this.sendNoteOn(pitch, velocity127, channel, ts);
    else this.sendNoteOff(pitch, channel, ts);
  }

  allNotesOff() {
    const out = this.getOutput();
    if (!out) return;
    try {
      for (let ch = 0; ch < 16; ch++) {
        out.send([0xb0 | ch, 123, 0]); // All Notes Off
        out.send([0xb0 | ch, 120, 0]); // All Sound Off
      }
    } catch {
      /* ignore */
    }
  }
}

export const midiIO = new MidiIO();
