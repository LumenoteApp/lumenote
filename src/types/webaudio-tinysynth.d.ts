declare module 'webaudio-tinysynth' {
  export default class WebAudioTinySynth {
    constructor(options?: {
      quality?: number;
      useReverb?: number;
      voices?: number;
    });
    setAudioContext(ctx: AudioContext, destination?: AudioNode): void;
    setQuality(q: number): void;
    setMasterVol(lev: number): void;
    setProgram(ch: number, pg: number): void;
    noteOn(ch: number, note: number, velo: number, t?: number): void;
    noteOff(ch: number, note: number, t?: number): void;
    allSoundOff(ch: number): void;
    send(msg: number[], t?: number): void;
  }
}
