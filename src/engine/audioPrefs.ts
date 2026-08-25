import {
  BUILTIN_INSTRUMENTS,
  type InstrumentId,
} from './instruments';

export const AUDIO_PREFS_KEY = 'lumenote-audio-prefs-v1';

export type AudioPrefs = {
  instrumentId: InstrumentId;
  volume: number;
};

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  instrumentId: 'piano',
  volume: 0.85,
};

const VALID_IDS = new Set<string>(
  BUILTIN_INSTRUMENTS.filter((i) => i.id !== 'sf2').map((i) => i.id),
);

export function parseInstrumentId(raw: unknown): InstrumentId {
  if (typeof raw !== 'string') return DEFAULT_AUDIO_PREFS.instrumentId;
  // Never restore SF2 without the binary file
  if (raw === 'sf2') return 'piano';
  if (VALID_IDS.has(raw)) return raw as InstrumentId;
  return DEFAULT_AUDIO_PREFS.instrumentId;
}

export function clampVolume(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_AUDIO_PREFS.volume;
  return Math.min(1, Math.max(0, v));
}

export function parseAudioPrefs(raw: unknown): AudioPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_AUDIO_PREFS };
  }
  const o = raw as Record<string, unknown>;
  return {
    instrumentId: parseInstrumentId(o.instrumentId),
    volume: clampVolume(o.volume),
  };
}

export function serializeAudioPrefs(prefs: AudioPrefs): string {
  const normalized = parseAudioPrefs(prefs);
  return JSON.stringify(normalized);
}

export function loadAudioPrefs(): AudioPrefs {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_AUDIO_PREFS };
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_PREFS };
    return parseAudioPrefs(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_AUDIO_PREFS };
  }
}

export function saveAudioPrefs(prefs: AudioPrefs): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AUDIO_PREFS_KEY, serializeAudioPrefs(prefs));
  } catch {
    /* private mode / quota */
  }
}

type AudioHost = {
  setVolume: (v: number) => void;
  audio: {
    setInstrument: (id: InstrumentId) => Promise<unknown>;
  };
};

/**
 * Restore remembered volume + instrument id without starting Web Audio / Tone.
 * Call AudioEngine.setInstrument (stores id). Do NOT go through PlaybackEngine.setInstrument,
 * which awaits init()/Tone.start() and needs a user gesture.
 */
export function restoreAudioToEngine(
  engine: AudioHost,
  prefs: AudioPrefs,
): Promise<unknown> {
  const next = parseAudioPrefs(prefs);
  engine.setVolume(next.volume);
  return engine.audio.setInstrument(next.instrumentId);
}
