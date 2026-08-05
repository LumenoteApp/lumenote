import type { NoteEvent, TrackInfo } from '../midi/types';
import { noteSoundDuration } from '../midi/types';
import {
  type BuiltinInstrumentId,
  type InstrumentId,
  createToneInstrument,
  getInstrumentInfo,
} from './instruments';
import { midiIO } from './MidiIO';

/**
 * Lazy-loads audio backends after a user gesture.
 * Supports Tone built-ins, TinySynth GM (chip/FM), and SF2/SF3 via SpessaSynth.
 */
export class AudioEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private Tone: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toneSynth: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tinySynth: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sf2Synth: any = null;
  private ready = false;
  private instrumentId: InstrumentId = 'piano';
  private sf2Name: string | null = null;
  private sf2Buffer: ArrayBuffer | null = null;
  private volume = 0.85; // 0-1
  /** Live held notes: key = `${channel}:${pitch}` */
  private liveHeld = new Set<string>();
  /** Master bus: instruments → speakers + optional MediaRecorder tap */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toneMaster: any = null;
  private masterGain: GainNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  /**
   * Native AudioContext for SpessaSynth worklets.
   * Tone uses standardized-audio-context wrappers; native AudioWorkletNode
   * rejects those (not instanceof BaseAudioContext).
   */
  private nativeCtx: AudioContext | null = null;
  private sf2Gain: GainNode | null = null;
  private sf2RecordDest: MediaStreamAudioDestinationNode | null = null;

  async init() {
    if (!this.Tone) {
      this.Tone = await import('tone');
    }
    await this.Tone.start();
    this.ensureMasterBus();
    await this.ensureNativeContextRunning();
    await this.ensureInstrumentLoaded();
    this.ready = true;
  }

  /**
   * Audio stream for MediaRecorder (same bus as speakers).
   * Merges Tone master bus + native SF2 bus when both exist.
   */
  getRecordStream(): MediaStream | null {
    if (!this.Tone) return null;
    this.ensureMasterBus();
    const tracks: MediaStreamTrack[] = [];
    if (this.recordDest) tracks.push(...this.recordDest.stream.getAudioTracks());
    if (this.sf2RecordDest) tracks.push(...this.sf2RecordDest.stream.getAudioTracks());
    if (tracks.length === 0) return this.recordDest?.stream ?? null;
    return new MediaStream(tracks);
  }

  /**
   * Resolve a real browser AudioContext suitable for AudioWorkletNode.
   * Tone's rawContext is often a standardized-audio-context wrapper.
   */
  private getNativeAudioContext(): AudioContext {
    if (this.nativeCtx && this.nativeCtx.state !== 'closed') {
      return this.nativeCtx;
    }

    const raw = this.Tone?.getContext?.()?.rawContext as
      | AudioContext
      | (AudioContext & { destination?: { _nativeAudioNode?: AudioNode } })
      | null
      | undefined;

    // Already a true native context
    if (raw && typeof AudioContext !== 'undefined' && raw instanceof AudioContext) {
      this.nativeCtx = raw;
      return raw;
    }

    // standardized-audio-context: unwrap via destination's native node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dest = (raw as any)?.destination;
    const nativeNode =
      dest?._nativeAudioNode ?? dest?._nativeNode ?? dest?.__native ?? null;
    const fromDest = nativeNode?.context as AudioContext | undefined;
    if (fromDest && typeof AudioContext !== 'undefined' && fromDest instanceof AudioContext) {
      this.nativeCtx = fromDest;
      return fromDest;
    }

    // Last resort: dedicated native context (speakers still work; separate graph)
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) throw new Error('Web Audio is not available in this browser');
    this.nativeCtx = new AC();
    return this.nativeCtx;
  }

  private async ensureNativeContextRunning() {
    const ctx = this.getNativeAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* autoplay policy - will retry on user gesture */
      }
    }
  }

  private ensureMasterBus() {
    if (!this.Tone || (this.masterGain && this.recordDest && this.toneMaster)) return;
    // Tone graph uses its (possibly wrapped) context
    const toneCtx = this.Tone.getContext().rawContext as AudioContext;

    if (!this.masterGain) {
      this.masterGain = toneCtx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(toneCtx.destination);
    }
    if (!this.recordDest) {
      this.recordDest = toneCtx.createMediaStreamDestination();
      this.masterGain.connect(this.recordDest);
    }
    if (!this.toneMaster) {
      // Tone instruments connect here; then into the raw master bus
      this.toneMaster = new this.Tone.Gain(1);
      try {
        this.toneMaster.connect(this.masterGain);
      } catch {
        // Fallback: speakers only via Tone destination
        this.toneMaster.toDestination();
      }
    }
  }

  /** Native-side bus for SF2 worklet → speakers + record tap */
  private ensureSf2Bus(native: AudioContext) {
    if (!this.sf2Gain) {
      this.sf2Gain = native.createGain();
      this.sf2Gain.gain.value = 1;
      this.sf2Gain.connect(native.destination);
    }
    if (!this.sf2RecordDest) {
      this.sf2RecordDest = native.createMediaStreamDestination();
      this.sf2Gain.connect(this.sf2RecordDest);
    }
  }

  isReady() {
    return this.ready;
  }

  getInstrumentId() {
    return this.instrumentId;
  }

  getSf2Name() {
    return this.sf2Name;
  }

  hasSf2() {
    return !!this.sf2Buffer;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  getVolume() {
    return this.volume;
  }

  private applyVolume() {
    const db = this.volume <= 0.001 ? -60 : 20 * Math.log10(this.volume) - 6;
    if (this.toneSynth?.volume) this.toneSynth.volume.value = db;
    if (this.tinySynth?.setMasterVol) this.tinySynth.setMasterVol(this.volume);
    // SF2 volume via gain if we stored one - Spessa uses internal levels
  }

  async setInstrument(id: InstrumentId) {
    if (id === 'sf2' && !this.sf2Buffer) {
      throw new Error('Load an SF2 soundfont first');
    }
    this.instrumentId = id;
    if (this.Tone) {
      await this.ensureInstrumentLoaded();
      this.applyVolume();
    }
  }

  async loadSf2(buffer: ArrayBuffer, name: string) {
    this.sf2Buffer = buffer.slice(0);
    this.sf2Name = name;
    // Force rebuild SF2 synth with new bank
    if (this.sf2Synth) {
      try {
        this.sf2Synth.destroy?.();
      } catch {
        /* ignore */
      }
      this.sf2Synth = null;
    }
    // Always ensure Tone + native context are running (user gesture path)
    if (!this.Tone) {
      this.Tone = await import('tone');
    }
    await this.Tone.start();
    this.ensureMasterBus();
    await this.ensureNativeContextRunning();
    await this.ensureSf2Synth();
    this.instrumentId = 'sf2';
    this.ready = true;
  }

  private getBackend() {
    return getInstrumentInfo(this.instrumentId).backend;
  }

  private disposeToneSynth() {
    if (this.toneSynth) {
      try {
        this.toneSynth.dispose?.();
      } catch {
        /* ignore */
      }
      this.toneSynth = null;
    }
  }

  private async ensureInstrumentLoaded() {
    this.ensureMasterBus();
    const backend = this.getBackend();
    if (backend === 'tone') {
      this.disposeToneSynth();
      const id =
        this.instrumentId === 'sf2' ||
        this.instrumentId === 'gm_chip' ||
        this.instrumentId === 'gm_quality'
          ? 'piano'
          : (this.instrumentId as BuiltinInstrumentId);
      this.toneSynth = createToneInstrument(this.Tone, id, this.toneMaster);
    } else if (backend === 'tinysynth') {
      await this.ensureTinySynth();
      const q = this.instrumentId === 'gm_chip' ? 0 : 1;
      this.tinySynth.setQuality?.(q);
      // Acoustic grand default
      this.tinySynth.setProgram?.(0, 0);
    } else if (backend === 'sf2') {
      await this.ensureSf2Synth();
    }
    this.applyVolume();
  }

  private async ensureTinySynth() {
    if (this.tinySynth) return;
    this.ensureMasterBus();
    // CJS module
    const mod = await import('webaudio-tinysynth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (mod as any).default ?? mod;
    const rawCtx = this.Tone.getContext().rawContext as AudioContext;
    this.tinySynth = new Ctor({ quality: 1, useReverb: 1, voices: 48 });
    if (this.tinySynth.setAudioContext) {
      // Route through master bus so captureStream includes audio
      this.tinySynth.setAudioContext(rawCtx, this.masterGain ?? undefined);
    }
    this.tinySynth.setMasterVol?.(this.volume);
  }

  private async ensureSf2Synth() {
    if (!this.sf2Buffer) throw new Error('No SF2 loaded');
    if (this.sf2Synth) return;
    this.ensureMasterBus();
    await this.ensureNativeContextRunning();

    // Must be a real BaseAudioContext - Tone's wrapper breaks AudioWorkletNode
    const native = this.getNativeAudioContext();
    this.ensureSf2Bus(native);

    const workletUrl = `${import.meta.env.BASE_URL}spessasynth_processor.min.js`;
    try {
      await native.audioWorklet.addModule(workletUrl);
    } catch (e) {
      // Already registered from a previous load is OK
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already|InvalidStateError/i.test(msg)) throw e;
    }

    const { WorkletSynthesizer } = await import('spessasynth_lib');
    const synth = new WorkletSynthesizer(native);
    await synth.soundBankManager.addSoundBank(this.sf2Buffer, 'main');
    await synth.isReady;
    try {
      synth.disconnect?.();
      if (this.sf2Gain) synth.connect(this.sf2Gain);
    } catch {
      /* keep default routing to native destination */
    }
    this.sf2Synth = synth;
  }

  clearSchedule() {
    midiIO.allNotesOff();
    this.liveHeld.clear();
    if (!this.Tone || !this.ready) {
      this.toneSynth?.releaseAll?.();
      return;
    }
    this.Tone.getTransport().cancel(0);
    this.toneSynth?.releaseAll?.();
    // All notes off on other backends
    try {
      for (let ch = 0; ch < 16; ch++) {
        this.tinySynth?.allSoundOff?.(ch);
        this.sf2Synth?.stopAll?.(ch);
        this.sf2Synth?.noteOff?.(ch, 0); // best-effort
      }
    } catch {
      /* ignore */
    }
    // Spessa: controller all notes off
    try {
      for (let ch = 0; ch < 16; ch++) {
        this.sf2Synth?.controllerChange?.(ch, 123, 0); // all notes off
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Immediate note-on for live MIDI / on-screen keyboard.
   * Velocity is 0-1. Does not touch the transport schedule.
   */
  noteOn(pitch: number, velocity: number, channel = 0) {
    if (!this.Tone || !this.ready) return;
    const ch = Math.min(15, Math.max(0, channel));
    const pitchMidi = Math.min(127, Math.max(0, pitch | 0));
    const vel = Math.max(0.01, Math.min(1, velocity));
    const key = `${ch}:${pitchMidi}`;
    this.liveHeld.add(key);
    const backend = this.getBackend();
    const v127 = Math.max(1, Math.min(127, Math.round(vel * 127)));

    try {
      if (backend === 'tone' && this.toneSynth) {
        const pitchName = this.Tone.Frequency(pitchMidi, 'midi').toNote();
        const synth = this.toneSynth;
        if (typeof synth.triggerAttack === 'function') {
          synth.triggerAttack(pitchName, undefined, vel);
        } else if (typeof synth.triggerAttackRelease === 'function') {
          // Pluck-style: one-shot
          synth.triggerAttackRelease(pitchName, 0.4, undefined, vel);
        }
      } else if (backend === 'tinysynth' && this.tinySynth) {
        this.tinySynth.noteOn(ch, pitchMidi, v127);
      } else if (backend === 'sf2' && this.sf2Synth) {
        this.sf2Synth.noteOn(ch, pitchMidi, v127);
      }
    } catch {
      /* voice steal / backend glitch */
    }
  }

  /** Immediate note-off for live MIDI. */
  noteOff(pitch: number, channel = 0) {
    if (!this.Tone || !this.ready) return;
    const ch = Math.min(15, Math.max(0, channel));
    const pitchMidi = Math.min(127, Math.max(0, pitch | 0));
    const key = `${ch}:${pitchMidi}`;
    this.liveHeld.delete(key);
    const backend = this.getBackend();

    try {
      if (backend === 'tone' && this.toneSynth) {
        const pitchName = this.Tone.Frequency(pitchMidi, 'midi').toNote();
        this.toneSynth.triggerRelease?.(pitchName);
      } else if (backend === 'tinysynth' && this.tinySynth) {
        this.tinySynth.noteOff(ch, pitchMidi);
      } else if (backend === 'sf2' && this.sf2Synth) {
        this.sf2Synth.noteOff(ch, pitchMidi);
      }
    } catch {
      /* ignore */
    }
  }

  /** Release all live-held notes without cancelling the transport schedule. */
  releaseLiveNotes() {
    if (!this.Tone || !this.ready) {
      this.liveHeld.clear();
      return;
    }
    const backend = this.getBackend();
    for (const key of this.liveHeld) {
      const [chStr, pitchStr] = key.split(':');
      const ch = Number(chStr);
      const pitchMidi = Number(pitchStr);
      try {
        if (backend === 'tone' && this.toneSynth) {
          const pitchName = this.Tone.Frequency(pitchMidi, 'midi').toNote();
          this.toneSynth.triggerRelease?.(pitchName);
        } else if (backend === 'tinysynth' && this.tinySynth) {
          this.tinySynth.noteOff(ch, pitchMidi);
        } else if (backend === 'sf2' && this.sf2Synth) {
          this.sf2Synth.noteOff(ch, pitchMidi);
        }
      } catch {
        /* ignore */
      }
    }
    this.liveHeld.clear();
  }

  private scheduleMidiOut(
    type: 'on' | 'off',
    pitch: number,
    velocity127: number,
    channel: number,
    audioTime: number,
  ) {
    if (!this.Tone || !midiIO.isOutputPlayback() || !midiIO.getOutputId()) return;
    const ctxTime = this.Tone.getContext().currentTime as number;
    midiIO.schedulePlaybackNote(type, pitch, velocity127, channel, audioTime, ctxTime);
  }

  /**
   * Schedule song notes from `fromTime` (song seconds).
   * `tempoScale` > 1 plays faster (higher BPM): transport times are shortened.
   */
  scheduleNotes(
    notes: NoteEvent[],
    tracks: TrackInfo[],
    fromTime: number,
    tempoScale = 1,
  ) {
    if (!this.Tone || !this.ready) return;
    this.clearSchedule();

    const scale = Number.isFinite(tempoScale) && tempoScale > 0 ? tempoScale : 1;
    const muted = new Set(tracks.filter((t) => t.muted || !t.visible).map((t) => t.index));
    const transport = this.Tone.getTransport();
    const backend = this.getBackend();
    const Tone = this.Tone;
    const self = this;

    for (const n of notes) {
      if (muted.has(n.trackIndex)) continue;
      const soundDur = noteSoundDuration(n);
      if (n.start + soundDur < fromTime) continue;

      // Wall/transport time = song-time delta / scale
      const start = Math.max(0, n.start - fromTime) / scale;
      // Audio gate includes sustain pedal; visuals use n.duration separately
      const durationSong =
        n.start < fromTime ? soundDur - (fromTime - n.start) : soundDur;
      const duration = durationSong / scale;
      if (duration <= 0.01) continue;

      const pitchMidi = n.pitch;
      const pitchName = Tone.Frequency(pitchMidi, 'midi').toNote();
      const vel = n.velocity;
      const ch = Math.min(15, Math.max(0, n.channel ?? 0));
      const v127 = Math.max(1, Math.min(127, Math.round(vel * 127)));

      if (backend === 'tone' && this.toneSynth) {
        const synth = this.toneSynth;
        // PluckSynth only has triggerAttack, not attackRelease with same API sometimes
        transport.schedule((time: number) => {
          try {
            if (typeof synth.triggerAttackRelease === 'function') {
              // MonoSynth/PolySynth
              synth.triggerAttackRelease(pitchName, duration, time, vel);
            } else if (typeof synth.triggerAttack === 'function') {
              synth.triggerAttack(pitchName, time, vel);
              synth.triggerRelease(pitchName, time + duration);
            }
          } catch {
            /* ignore voice steal errors */
          }
          self.scheduleMidiOut('on', pitchMidi, v127, ch, time);
        }, start);
        transport.schedule((time: number) => {
          self.scheduleMidiOut('off', pitchMidi, 0, ch, time);
        }, start + duration);
      } else if (backend === 'tinysynth' && this.tinySynth) {
        const tiny = this.tinySynth;
        transport.schedule((time: number) => {
          tiny.noteOn(ch, pitchMidi, v127, time);
          self.scheduleMidiOut('on', pitchMidi, v127, ch, time);
        }, start);
        transport.schedule((time: number) => {
          tiny.noteOff(ch, pitchMidi, time);
          self.scheduleMidiOut('off', pitchMidi, 0, ch, time);
        }, start + duration);
      } else if (backend === 'sf2' && this.sf2Synth) {
        const sf = this.sf2Synth;
        transport.schedule((time: number) => {
          sf.noteOn(ch, pitchMidi, v127, { time });
          self.scheduleMidiOut('on', pitchMidi, v127, ch, time);
        }, start);
        transport.schedule((time: number) => {
          sf.noteOff(ch, pitchMidi, { time });
          self.scheduleMidiOut('off', pitchMidi, 0, ch, time);
        }, start + duration);
      }
    }
  }

  getTransportSeconds(): number {
    if (!this.Tone || !this.ready) return 0;
    return this.Tone.getTransport().seconds;
  }

  transportStart() {
    if (!this.Tone || !this.ready) return;
    const t = this.Tone.getTransport();
    t.seconds = 0;
    t.start();
  }

  transportStop() {
    if (!this.Tone || !this.ready) return;
    const t = this.Tone.getTransport();
    t.stop();
    t.seconds = 0;
  }

  transportPauseStop() {
    if (!this.Tone || !this.ready) return;
    this.Tone.getTransport().stop();
  }
}
