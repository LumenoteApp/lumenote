export type NoteEvent = {
  id: string;
  pitch: number;
  start: number;
  /**
   * Visual / key-down length (seconds). Does not include sustain pedal hold.
   * Falling bars and “active key” use this.
   */
  duration: number;
  /**
   * Audio sounding length (seconds), including sustain pedal extension.
   * Defaults to `duration` when omitted.
   */
  soundDuration?: number;
  velocity: number;
  trackIndex: number;
  channel: number;
};

/** Audio gate length for a note (sustain-aware). */
export function noteSoundDuration(n: NoteEvent): number {
  const d = n.soundDuration ?? n.duration;
  return Number.isFinite(d) && d > 0 ? d : n.duration;
}

export type TrackInfo = {
  index: number;
  name: string;
  channel: number;
  color: string;
  visible: boolean;
  muted: boolean;
  noteCount: number;
};

export type TempoEvent = {
  time: number;
  bpm: number;
};

export type Song = {
  name: string;
  duration: number;
  tracks: TrackInfo[];
  notes: NoteEvent[];
  tempos: TempoEvent[];
};

/** MIDI default tempo when no setTempo event has occurred yet. */
export const MIDI_DEFAULT_BPM = 120;

/**
 * Clean floating-point BPM from MIDI microsecond conversion
 * (e.g. 119.9999998 → 120, 140.002 → 140).
 */
export function normalizeBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return MIDI_DEFAULT_BPM;
  const clamped = Math.min(400, Math.max(20, bpm));
  const to3 = Math.round(clamped * 1000) / 1000;
  const nearestInt = Math.round(to3);
  if (Math.abs(to3 - nearestInt) < 0.05) return nearestInt;
  const to1 = Math.round(to3 * 10) / 10;
  if (Math.abs(to3 - to1) < 0.01) return to1;
  return to3;
}

/**
 * Active BPM at song time (seconds). Tempos should be sorted by time.
 * Before the first setTempo event, uses MIDI default 120 (not the first
 * change's value), matching the MIDI spec.
 */
export function bpmAt(tempos: TempoEvent[] | undefined, time: number): number | null {
  if (!tempos?.length) return MIDI_DEFAULT_BPM;
  const t = Number.isFinite(time) ? time : 0;
  let bpm = MIDI_DEFAULT_BPM;
  let saw = false;
  for (const ev of tempos) {
    if (ev.time <= t + 1e-9) {
      bpm = ev.bpm;
      saw = true;
    } else {
      break;
    }
  }
  // If the first event is at t≈0 and we haven't matched yet, still use it
  // when playhead is at/near start (float noise).
  if (!saw && tempos[0]!.time <= 1e-6) {
    bpm = tempos[0]!.bpm;
  }
  return Number.isFinite(bpm) && bpm > 0 ? bpm : MIDI_DEFAULT_BPM;
}

/** Display helper: integer when whole, one decimal otherwise. */
export function formatBpm(bpm: number): string {
  const r = Math.round(bpm * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Clamp a user-facing tempo scale (0.25x–4x original). */
export function clampTempoScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(4, Math.max(0.25, scale));
}

/**
 * Scale a song's timeline for export at a different tempo.
 * `scale` > 1 = faster (higher BPM, shorter wall duration).
 */
export function scaleSongTempo(song: Song, scale: number): Song {
  const s = clampTempoScale(scale);
  if (Math.abs(s - 1) < 1e-6) return song;
  return {
    ...song,
    duration: song.duration / s,
    notes: song.notes.map((n) => ({
      ...n,
      start: n.start / s,
      duration: n.duration / s,
      soundDuration:
        n.soundDuration != null && Number.isFinite(n.soundDuration)
          ? n.soundDuration / s
          : n.soundDuration,
    })),
    tempos: song.tempos.map((t) => ({
      time: t.time / s,
      bpm: normalizeBpm(t.bpm * s),
    })),
  };
}

/** Full particle look - driven by presets or manual sliders */
export type ParticleParams = {
  /** Spawn count multiplier */
  density: number;
  /** Base particle radius */
  size: number;
  /** Random size spread (0-1) */
  sizeVariance: number;
  /** Launch speed */
  speed: number;
  /** Horizontal angle fan (0 = tight fountain, 1 = wide) */
  spread: number;
  /** Gravity (positive pulls down; negative floats up) */
  gravity: number;
  /** Air resistance 0-1 */
  drag: number;
  /** Lifetime in seconds */
  lifetime: number;
  /** Wiggle / noise force */
  turbulence: number;
  /** Twinkle intensity */
  sparkle: number;
  /** Soft glow radius multiplier */
  bloom: number;
  /** Extra ring burst on hit */
  secondaryBurst: number;
  /** Streak / comet trail length */
  trail: number;
  /** Bright white core mix */
  whiteHot: number;
  /** Rotational swirl force */
  swirl: number;
  /** Continuous sparkle while key is held */
  sustainEmit: number;
  /** Expanding flash ring on hit */
  hitFlash: number;
};

export type BackgroundStyle =
  | 'void'
  | 'starfield'
  | 'aurora'
  | 'nebula'
  | 'pulse'
  | 'grid'
  /** Falling colored streaks that accelerate with note energy */
  | 'rain'
  /** Concentric rings + rotating scan sweep */
  | 'radar'
  /** Hyperspace tunnel lines toward the horizon */
  | 'warp';

export type BackgroundParams = {
  enabled: boolean;
  style: BackgroundStyle;
  /** Overall strength of bg FX */
  intensity: number;
  /** Drift / motion amount */
  parallax: number;
  /** Star density 0-1 */
  stars: number;
  /** Soft color orb count 0-1 */
  orbs: number;
  /** Aurora wave amount 0-1 */
  waves: number;
  /** Vertical light beams 0-1 */
  beams: number;
  /** How much notes pump the background 0-1 */
  reactive: number;
};

/** Ambient particle animation driven by note energy / pitch bands */
export type MusicReactiveParams = {
  enabled: boolean;
  intensity: number;
  ambient: number;
  columns: number;
  waves: number;
  bassPulse: number;
  attack: number;
};

export type ColorMode =
  | 'track'
  | 'palette'
  | 'palette_wave'
  | 'rainbow_time'
  | 'rainbow_pitch'
  | 'rainbow_wave'
  | 'spectrum'
  | 'rgb_chase';

export type ColorSettings = {
  mode: ColorMode;
  paletteId: string;
  cycleSpeed: number;
  saturation: number;
  brightness: number;
  trackBlend: number;
};

/** Falling note bar appearance */
export type NoteStyleId =
  | 'solid'
  | 'glass'
  | 'gem'
  | 'flame'
  | 'crystal'
  | 'outline'
  | 'plasma'
  | 'chrome'
  | 'pixel';

export type NoteStyleParams = {
  style: NoteStyleId;
  /** Edge stroke strength 0-1 */
  border: number;
  /** Specular / top highlight 0-1 */
  shine: number;
  /** Internal motion (flame, plasma sparkles, etc.) 0-1.4 */
  innerFx: number;
  /** Corner roundness 0-1 */
  roundness: number;
};

export type HitRailStyleId =
  | 'soft'
  | 'electric'
  | 'wave'
  | 'shock'
  | 'spark'
  | 'laser'
  | 'storm'
  | 'aurora';

export type VisualSettings = {
  pixelsPerSecond: number;
  noteOpacity: number;
  glowStrength: number;
  /** Falling note bar look (fill, border, internal FX) */
  notes: NoteStyleParams;
  noteStylePresetId: string;
  particlesEnabled: boolean;
  particlePresetId: string;
  particles: ParticleParams;
  background: BackgroundParams;
  musicReactive: MusicReactiveParams;
  musicReactivePresetId: string;
  colors: ColorSettings;
  backgroundColor: string;
  showKeyboard: boolean;
  /** On-screen piano height in CSS pixels */
  keyboardHeight: number;
  /** Impact rail above the keyboard (reactive hit line) */
  showHitRail: boolean;
  hitRailIntensity: number;
  /** Rail look: soft blooms, electric cloud, waves, etc. */
  hitRailStyle: HitRailStyleId;
  /** Secondary rail FX amount (arcs, clouds, sparks) 0-1.4 */
  hitRailEnergy: number;
};
