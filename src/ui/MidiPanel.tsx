import { useCallback, useEffect, useState } from 'react';
import { computerPiano } from '../engine/ComputerPiano';
import {
  MAX_TRANSPOSE,
  MIN_TRANSPOSE,
  formatTranspose,
  type ComputerPianoPrefs,
} from '../engine/computerKeyboardMap';
import { midiIO, type MidiPortInfo } from '../engine/MidiIO';
import { playbackEngine } from '../engine/PlaybackEngine';
import { CollapsiblePanel } from './CollapsiblePanel';

type Snapshot = {
  supported: boolean;
  enabled: boolean;
  error: string | null;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  inputId: string | 'all' | null;
  outputId: string | null;
  inputEnabled: boolean;
  thru: boolean;
  outputPlayback: boolean;
};

function snap(): Snapshot {
  return {
    supported: midiIO.isSupported(),
    enabled: midiIO.isEnabled(),
    error: midiIO.getError(),
    inputs: midiIO.getInputs(),
    outputs: midiIO.getOutputs(),
    inputId: midiIO.getInputId(),
    outputId: midiIO.getOutputId(),
    inputEnabled: midiIO.isInputEnabled(),
    thru: midiIO.isThru(),
    outputPlayback: midiIO.isOutputPlayback(),
  };
}

export function MidiPanel() {
  const [state, setState] = useState<Snapshot>(() => snap());
  const [piano, setPiano] = useState<ComputerPianoPrefs>(() =>
    computerPiano.getPrefs(),
  );
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState(false);

  useEffect(() => {
    const unsub = midiIO.subscribe(() => setState(snap()));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const unsub = computerPiano.subscribe(() =>
      setPiano({ ...computerPiano.getPrefs() }),
    );
    return () => {
      unsub();
    };
  }, []);

  // Flash activity when notes arrive from hardware MIDI
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = midiIO.onNote(() => {
      setActivity(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setActivity(false), 120);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      // User gesture - also warm audio so first note isn't silent
      await playbackEngine.audio.init();
      await midiIO.enable();
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(() => {
    playbackEngine.releaseLiveNotes();
    midiIO.disable();
  }, []);

  const enableQwerty = useCallback(async () => {
    try {
      await playbackEngine.audio.init();
    } catch {
      /* still allow toggle; next note will retry */
    }
    computerPiano.setQwertyEnabled(true);
  }, []);

  return (
    <CollapsiblePanel id="audio-live" title="Live play" className="midi-panel" defaultOpen={false}>
      <p className="muted small">
        Play with your computer keyboard, tap the on-screen piano, or connect a
        MIDI controller.
      </p>

      <div className="midi-subsection">
        <h3 className="midi-subhead">Computer piano</h3>
        <p className="muted small midi-hint">
          Virtual Piano layout: whites are 1–m (1=C2 … m=C7). Hold Shift for
          temporary +1 transpose. ←/→ octave, ↑/↓ semitone. Space flips
          sustain from the default below. Tap or drag the drawn keyboard
          anytime.
        </p>

        <label className="midi-check">
          <input
            type="checkbox"
            checked={piano.qwertyEnabled}
            onChange={(e) => {
              if (e.target.checked) void enableQwerty();
              else computerPiano.setQwertyEnabled(false);
            }}
          />
          <span>QWERTY piano (Virtual Piano 1–m)</span>
        </label>

        <label className="midi-check">
          <input
            type="checkbox"
            checked={piano.showLabels}
            onChange={(e) => computerPiano.setShowLabels(e.target.checked)}
          />
          <span>Show key labels on keyboard</span>
        </label>

        <label className="midi-check">
          <input
            type="checkbox"
            checked={piano.sustainDefaultOn}
            onChange={(e) =>
              computerPiano.setSustainDefaultOn(e.target.checked)
            }
          />
          <span>
            Sustain on by default
            <span className="midi-check-detail">
              {piano.sustainDefaultOn
                ? ' (hold Space to lift)'
                : ' (hold Space to sustain)'}
            </span>
          </span>
        </label>

        <div className="midi-octave-row">
          <span className="field-label">Transpose</span>
          <div className="midi-octave-controls">
            <button
              type="button"
              className="btn compact-btn"
              disabled={piano.transpose <= MIN_TRANSPOSE}
              onClick={() => computerPiano.shiftTranspose(-12)}
              title="Octave down (←)"
            >
              −12
            </button>
            <button
              type="button"
              className="btn compact-btn"
              disabled={piano.transpose <= MIN_TRANSPOSE}
              onClick={() => computerPiano.shiftTranspose(-1)}
              title="Semitone down (↓)"
            >
              −1
            </button>
            <span
              className="midi-octave-value"
              title="Global transpose in semitones (Shift adds +1 while held)"
            >
              {formatTranspose(piano.transpose)}
              {computerPiano.isShiftHeld() ? ' ⇧' : ''}
            </span>
            <button
              type="button"
              className="btn compact-btn"
              disabled={piano.transpose >= MAX_TRANSPOSE}
              onClick={() => computerPiano.shiftTranspose(1)}
              title="Semitone up (↑)"
            >
              +1
            </button>
            <button
              type="button"
              className="btn compact-btn"
              disabled={piano.transpose >= MAX_TRANSPOSE}
              onClick={() => computerPiano.shiftTranspose(12)}
              title="Octave up (→)"
            >
              +12
            </button>
          </div>
        </div>

        {piano.qwertyEnabled && (
          <p className="muted small midi-hint">
            Studio shortcuts are off while QWERTY is on (Space / arrows /
            Shift are piano). Use transport buttons; Esc still exits
            fullscreen.
          </p>
        )}
      </div>

      <div className="midi-subsection">
        <h3 className="midi-subhead">
          Hardware MIDI
          {state.enabled && (
            <span
              className={`midi-activity ${activity ? 'on' : ''}`}
              title="Incoming note activity"
              aria-hidden
            />
          )}
        </h3>

        {!state.supported ? (
          <p className="muted small">
            Web MIDI is not available in this browser. Use Chrome, Edge, or
            Opera on desktop for hardware keyboards and external synths. You can
            still use QWERTY and the on-screen piano.
          </p>
        ) : !state.enabled ? (
          <button
            type="button"
            className="btn primary compact-btn midi-enable-btn"
            disabled={busy}
            onClick={() => void enable()}
          >
            {busy ? 'Connecting…' : 'Enable Web MIDI'}
          </button>
        ) : (
          <>
            <div className="midi-row">
              <label className="field compact midi-field">
                <span className="field-label">Input</span>
                <select
                  className="midi-select"
                  value={state.inputId ?? 'all'}
                  onChange={(e) => {
                    const v = e.target.value;
                    midiIO.setInputId(v === 'all' ? 'all' : v);
                  }}
                >
                  <option value="all">All inputs</option>
                  {state.inputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.manufacturer ? ` (${p.manufacturer})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="midi-row">
              <label className="field compact midi-field">
                <span className="field-label">Output</span>
                <select
                  className="midi-select"
                  value={state.outputId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    midiIO.setOutputId(v === '' ? null : v);
                  }}
                >
                  <option value="">None (browser sound only)</option>
                  {state.outputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.manufacturer ? ` (${p.manufacturer})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {state.inputs.length === 0 && (
              <p className="muted small midi-hint">
                No MIDI inputs found. Plug in a controller and it should appear
                automatically.
              </p>
            )}

            <label className="midi-check">
              <input
                type="checkbox"
                checked={state.inputEnabled}
                onChange={(e) => midiIO.setInputEnabled(e.target.checked)}
              />
              <span>Listen to MIDI in (play + visualize)</span>
            </label>

            <label className="midi-check">
              <input
                type="checkbox"
                checked={state.outputPlayback}
                onChange={(e) => midiIO.setOutputPlayback(e.target.checked)}
                disabled={!state.outputId}
              />
              <span>Send song playback to MIDI out</span>
            </label>

            <label className="midi-check">
              <input
                type="checkbox"
                checked={state.thru}
                onChange={(e) => midiIO.setThru(e.target.checked)}
                disabled={!state.outputId}
              />
              <span>Thru (input → output)</span>
            </label>
          </>
        )}
      </div>

      <div className="midi-actions">
        <button
          type="button"
          className="btn compact-btn"
          onClick={() => {
            computerPiano.releaseAll();
            playbackEngine.releaseLiveNotes();
            if (state.enabled) midiIO.allNotesOff();
          }}
          title="Release stuck notes"
        >
          Panic
        </button>
        {state.supported && state.enabled && (
          <button type="button" className="btn compact-btn" onClick={disable}>
            Disable MIDI
          </button>
        )}
      </div>

      {state.error && <p className="sound-error">{state.error}</p>}
    </CollapsiblePanel>
  );
}
