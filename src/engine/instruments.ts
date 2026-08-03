/** Built-in instrument IDs and display metadata */

export type InstrumentBackend = 'tone' | 'tinysynth' | 'sf2';

export type BuiltinInstrumentId =
  | 'piano'
  | 'chiptune'
  | 'chip_lead'
  | 'epiano'
  | 'organ'
  | 'pad'
  | 'pluck'
  | 'bass'
  | 'strings'
  | 'gm_quality'
  | 'gm_chip';

export type InstrumentId = BuiltinInstrumentId | 'sf2';

export type InstrumentInfo = {
  id: InstrumentId;
  name: string;
  blurb: string;
  backend: InstrumentBackend;
  /** MIDI program for GM backends */
  program?: number;
};

export const BUILTIN_INSTRUMENTS: InstrumentInfo[] = [
  {
    id: 'piano',
    name: 'Soft Piano',
    blurb: 'Warm triangle keys',
    backend: 'tone',
  },
  {
    id: 'chiptune',
    name: 'Chiptune',
    blurb: '8-bit square pulse',
    backend: 'tone',
  },
  {
    id: 'chip_lead',
    name: 'Chip Lead',
    blurb: 'Pulse + short decay',
    backend: 'tone',
  },
  {
    id: 'epiano',
    name: 'E-Piano',
    blurb: 'FM electric keys',
    backend: 'tone',
  },
  {
    id: 'organ',
    name: 'Organ',
    blurb: 'Sustained drawbar-ish',
    backend: 'tone',
  },
  {
    id: 'pad',
    name: 'Pad',
    blurb: 'Slow ambient wash',
    backend: 'tone',
  },
  {
    id: 'pluck',
    name: 'Pluck',
    blurb: 'Sharp plucked tone',
    backend: 'tone',
  },
  {
    id: 'bass',
    name: 'Synth Bass',
    blurb: 'Low punchy mono-ish',
    backend: 'tone',
  },
  {
    id: 'strings',
    name: 'Strings',
    blurb: 'Soft bowed pad',
    backend: 'tone',
  },
  {
    id: 'gm_chip',
    name: 'GM Chip',
    blurb: 'TinySynth 1-osc GM',
    backend: 'tinysynth',
  },
  {
    id: 'gm_quality',
    name: 'GM FM',
    blurb: 'TinySynth multi-osc GM',
    backend: 'tinysynth',
  },
  {
    id: 'sf2',
    name: 'Custom SF2',
    blurb: 'Loaded soundfont file',
    backend: 'sf2',
  },
];

export function getInstrumentInfo(id: InstrumentId): InstrumentInfo {
  return BUILTIN_INSTRUMENTS.find((i) => i.id === id) ?? BUILTIN_INSTRUMENTS[0];
}

/**
 * Build a Tone.js polyphonic instrument for a builtin id.
 * Caller owns dispose(). Pass `output` (Tone node or AudioNode) to route
 * through a master bus for recording; otherwise connects to Destination.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function routeOut(synth: any, output?: any) {
  if (output) synth.connect(output);
  else synth.toDestination();
  return synth;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createToneInstrument(Tone: any, id: BuiltinInstrumentId, output?: any): any {
  const vol = -8;

  switch (id) {
    case 'chiptune': {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0.35, release: 0.08 },
      });
      s.maxPolyphony = 48;
      s.volume.value = vol - 2;
      return routeOut(s, output);
    }
    case 'chip_lead': {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'pulse', width: 0.25 },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0.2, release: 0.06 },
      });
      s.maxPolyphony = 32;
      s.volume.value = vol - 1;
      return routeOut(s, output);
    }
    case 'epiano': {
      const s = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 14,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.8 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0.05, release: 0.4 },
      });
      s.maxPolyphony = 32;
      s.volume.value = vol - 4;
      return routeOut(s, output);
    }
    case 'organ': {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine4' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.15 },
      });
      s.maxPolyphony = 48;
      s.volume.value = vol;
      return routeOut(s, output);
    }
    case 'pad': {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.4, decay: 0.3, sustain: 0.85, release: 1.8 },
      });
      s.maxPolyphony = 32;
      s.volume.value = vol - 4;
      return routeOut(s, output);
    }
    case 'pluck': {
      const s = new Tone.PolySynth(Tone.PluckSynth, {
        attackNoise: 1,
        dampening: 4000,
        resonance: 0.85,
      });
      s.maxPolyphony = 32;
      s.volume.value = vol;
      return routeOut(s, output);
    }
    case 'bass': {
      const s = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 0.3 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.2,
          release: 0.3,
          baseFrequency: 120,
          octaves: 3,
        },
      });
      s.maxPolyphony = 8;
      s.volume.value = vol;
      return routeOut(s, output);
    }
    case 'strings': {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 12 },
        envelope: { attack: 0.25, decay: 0.2, sustain: 0.7, release: 1.2 },
      });
      s.maxPolyphony = 28;
      s.volume.value = vol - 6;
      return routeOut(s, output);
    }
    case 'piano':
    default: {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.008, decay: 0.35, sustain: 0.25, release: 1.1 },
      });
      s.maxPolyphony = 64;
      s.volume.value = vol;
      return routeOut(s, output);
    }
  }
}
