export type NoteEvent = {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
  trackIndex: number;
  channel: number;
};

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

export type VisualSettings = {
  pixelsPerSecond: number;
  noteOpacity: number;
  glowStrength: number;
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
};
