import type { NoteEvent, TrackInfo } from '../midi/types';
import {
  type BuiltinInstrumentId,
  type InstrumentId,
  createToneInstrument,
  getInstrumentInfo,
} from './instruments';

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
  private volume = 0.85; // 0–1

  async init() {
    if (!this.Tone) {
      this.Tone = await import('tone');
    }
    await this.Tone.start();
    await this.ensureInstrumentLoaded();
    this.ready = true;
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
    // SF2 volume via gain if we stored one — Spessa uses internal levels
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
    if (this.Tone) {
      await this.ensureSf2Synth();
      this.instrumentId = 'sf2';
    } else {
      this.instrumentId = 'sf2';
    }
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
    const backend = this.getBackend();
    if (backend === 'tone') {
      this.disposeToneSynth();
      const id =
        this.instrumentId === 'sf2' ||
        this.instrumentId === 'gm_chip' ||
        this.instrumentId === 'gm_quality'
          ? 'piano'
          : (this.instrumentId as BuiltinInstrumentId);
      this.toneSynth = createToneInstrument(this.Tone, id);
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
    // CJS module
    const mod = await import('webaudio-tinysynth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (mod as any).default ?? mod;
    const rawCtx = this.Tone.getContext().rawContext;
    this.tinySynth = new Ctor({ quality: 1, useReverb: 1, voices: 48 });
    if (this.tinySynth.setAudioContext) {
      this.tinySynth.setAudioContext(rawCtx);
    }
    this.tinySynth.setMasterVol?.(this.volume);
  }

  private async ensureSf2Synth() {
    if (!this.sf2Buffer) throw new Error('No SF2 loaded');
    if (this.sf2Synth) return;

    const rawCtx = this.Tone.getContext().rawContext as AudioContext;
    // Worklet must be served from same origin
    const workletUrl = `${import.meta.env.BASE_URL}spessasynth_processor.min.js`;
    await rawCtx.audioWorklet.addModule(workletUrl);

    const { WorkletSynthesizer } = await import('spessasynth_lib');
    const synth = new WorkletSynthesizer(rawCtx);
    await synth.soundBankManager.addSoundBank(this.sf2Buffer, 'main');
    await synth.isReady;
    // Connect to destination if needed — WorkletSynthesizer usually auto-connects
    this.sf2Synth = synth;
  }

  clearSchedule() {
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

  scheduleNotes(notes: NoteEvent[], tracks: TrackInfo[], fromTime: number) {
    if (!this.Tone || !this.ready) return;
    this.clearSchedule();

    const muted = new Set(tracks.filter((t) => t.muted || !t.visible).map((t) => t.index));
    const transport = this.Tone.getTransport();
    const backend = this.getBackend();
    const Tone = this.Tone;

    for (const n of notes) {
      if (muted.has(n.trackIndex)) continue;
      if (n.start + n.duration < fromTime) continue;

      const start = Math.max(0, n.start - fromTime);
      const duration = n.start < fromTime ? n.duration - (fromTime - n.start) : n.duration;
      if (duration <= 0.01) continue;

      const pitchMidi = n.pitch;
      const pitchName = Tone.Frequency(pitchMidi, 'midi').toNote();
      const vel = n.velocity;
      const ch = Math.min(15, Math.max(0, n.channel ?? 0));

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
        }, start);
      } else if (backend === 'tinysynth' && this.tinySynth) {
        const tiny = this.tinySynth;
        const v127 = Math.max(1, Math.min(127, Math.round(vel * 127)));
        transport.schedule((time: number) => {
          tiny.noteOn(ch, pitchMidi, v127, time);
        }, start);
        transport.schedule((time: number) => {
          tiny.noteOff(ch, pitchMidi, time);
        }, start + duration);
      } else if (backend === 'sf2' && this.sf2Synth) {
        const sf = this.sf2Synth;
        const v127 = Math.max(1, Math.min(127, Math.round(vel * 127)));
        transport.schedule((time: number) => {
          sf.noteOn(ch, pitchMidi, v127, { time });
        }, start);
        transport.schedule((time: number) => {
          sf.noteOff(ch, pitchMidi, { time });
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
