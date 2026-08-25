export const MIDI_PREFS_KEY = 'lumenote-midi-prefs-v1';

export type MidiPrefs = {
  enableIntent: boolean;
  inputId: string | 'all' | null;
  outputId: string | null;
  thru: boolean;
  inputEnabled: boolean;
  outputPlayback: boolean;
};

export const DEFAULT_MIDI_PREFS: MidiPrefs = {
  enableIntent: false,
  inputId: null,
  outputId: null,
  thru: false,
  inputEnabled: true,
  outputPlayback: true,
};

function asInputId(v: unknown): string | 'all' | null {
  if (v === null || v === undefined || v === '') return null;
  if (v === 'all') return 'all';
  if (typeof v === 'string') return v;
  return null;
}

function asOutputId(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v;
  return null;
}

export function parseMidiPrefs(raw: unknown): MidiPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_MIDI_PREFS };
  }
  const o = raw as Record<string, unknown>;
  return {
    enableIntent: Boolean(o.enableIntent),
    inputId: asInputId(o.inputId),
    outputId: asOutputId(o.outputId),
    thru: Boolean(o.thru),
    inputEnabled: o.inputEnabled === undefined ? true : Boolean(o.inputEnabled),
    outputPlayback: o.outputPlayback === undefined ? true : Boolean(o.outputPlayback),
  };
}

export function serializeMidiPrefs(prefs: MidiPrefs): string {
  const normalized = parseMidiPrefs(prefs);
  return JSON.stringify(normalized);
}

export function loadMidiPrefs(): MidiPrefs {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_MIDI_PREFS };
    const raw = localStorage.getItem(MIDI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_MIDI_PREFS };
    return parseMidiPrefs(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_MIDI_PREFS };
  }
}

export function saveMidiPrefs(prefs: MidiPrefs): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MIDI_PREFS_KEY, serializeMidiPrefs(prefs));
  } catch {
    /* private mode / quota */
  }
}
