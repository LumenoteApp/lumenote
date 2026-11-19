import type { Note } from '../midi';

/**
 * Small sampled piano (Salamander Grand, CC-BY, via the Tone.js sample CDN).
 * Works on a realtime AudioContext (live play / playback) and on an
 * OfflineAudioContext (video export) with identical sound.
 */
const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
const NAMES = ['C', 'Ds', 'Fs', 'A'];
const PCS = [0, 3, 6, 9];

let samplesPromise: Promise<Map<number, AudioBuffer>> | null = null;

/** Decode the sample set once; AudioBuffers can be shared between contexts. */
export function loadSamples(ctx: BaseAudioContext): Promise<Map<number, AudioBuffer>> {
  if (samplesPromise) return samplesPromise;
  const jobs: Promise<[number, AudioBuffer]>[] = [];
  for (let midi = 21; midi <= 108; midi++) {
    const pc = midi % 12;
    const i = PCS.indexOf(pc);
    if (i < 0) continue;
    const octave = Math.floor(midi / 12) - 1;
    const url = `${SAMPLE_BASE}${NAMES[i]}${octave}.mp3`;
    jobs.push(
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${url}: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => [midi, buf] as [number, AudioBuffer]),
    );
  }
  samplesPromise = Promise.all(jobs).then((list) => new Map(list));
  samplesPromise.catch(() => (samplesPromise = null));
  return samplesPromise;
}

function impulse(ctx: BaseAudioContext, seconds = 2.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      // Darker as it decays.
      const a = 0.25 + 0.6 * Math.exp(-t * 2.2);
      lp += (rnd() - lp) * a;
      d[i] = lp * Math.exp(-t * 2.6) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return buf;
}

export type Voice = { stop: (when: number) => void };

export class Piano {
  readonly ctx: BaseAudioContext;
  private samples: Map<number, AudioBuffer>;
  readonly input: GainNode;
  readonly output: GainNode;

  constructor(ctx: BaseAudioContext, samples: Map<number, AudioBuffer>, volume = 0.9) {
    this.ctx = ctx;
    this.samples = samples;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.value = volume;

    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;

    this.input.connect(comp);
    this.input.connect(verb);
    verb.connect(wet);
    wet.connect(comp);
    comp.connect(this.output);
    this.output.connect(ctx.destination);
  }

  setVolume(v: number) {
    this.output.gain.value = v;
  }

  /** Start a note at `when`; returns a handle to release it. */
  play(pitch: number, velocity: number, when: number): Voice | null {
    let best = -1;
    let dist = 99;
    for (const k of this.samples.keys()) {
      const d = Math.abs(k - pitch);
      if (d < dist) {
        dist = d;
        best = k;
      }
    }
    const buf = this.samples.get(best);
    if (!buf) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 2 ** ((pitch - best) / 12);

    // Soft notes are darker and quieter, like a real hammer.
    const v = Math.max(0.05, Math.min(1, velocity));
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 + v * v * 14000;
    filter.Q.value = 0.3;
    const gain = ctx.createGain();
    const level = 0.12 + 0.88 * v ** 1.6;
    gain.gain.setValueAtTime(level * 0.55, when);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.input);
    src.start(when);
    // Stop eventually even if never released (sample tails are ~4-8 s).
    src.stop(when + buf.duration / src.playbackRate.value + 0.05);
    // Take finished voices out of the graph; idle filters still cost CPU.
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    let stopped = false;
    return {
      stop: (at: number) => {
        if (stopped) return;
        stopped = true;
        const t = Math.max(at, when + 0.02);
        // Damper: faster in the treble, slower in the bass.
        const tau = pitch > 84 ? 0.06 : pitch < 48 ? 0.16 : 0.1;
        gain.gain.setTargetAtTime(0, t, tau);
        try {
          src.stop(t + tau * 8);
        } catch {
          /* already scheduled to stop earlier */
        }
      },
    };
  }

}

/**
 * Render a song to an AudioBuffer offline (for video export).
 * Voices are created in 2-second blocks just before they are needed, so long
 * songs with thousands of notes stay fast, and progress can be reported.
 */
export async function renderSongAudio(
  notes: Note[],
  offset: number,
  duration: number,
  volume = 1.6,
  onProgress?: (fraction: number) => void,
): Promise<AudioBuffer> {
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * rate), rate);
  const samples = await loadSamples(ctx);
  const piano = new Piano(ctx, samples, volume);
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  let idx = 0;
  const scheduleUntil = (t: number) => {
    while (idx < sorted.length && sorted[idx].start - offset < t) {
      const n = sorted[idx++];
      const at = n.start - offset;
      if (at < 0) continue;
      piano.play(n.pitch, n.velocity, at)?.stop(n.soundEnd - offset);
    }
  };
  const BLOCK = 2;
  scheduleUntil(BLOCK * 2);
  for (let t = BLOCK; t < duration; t += BLOCK) {
    void ctx.suspend(t).then(() => {
      scheduleUntil(t + BLOCK * 2);
      onProgress?.(t / duration);
      void ctx.resume();
    });
  }
  return ctx.startRendering();
}
