import { useCallback, useEffect, useState } from 'react';
import { midiIO, type MidiPortInfo } from '../engine/MidiIO';
import { playbackEngine } from '../engine/PlaybackEngine';

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
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState(false);

  useEffect(() => {
    const unsub = midiIO.subscribe(() => setState(snap()));
    return () => {
      unsub();
    };
  }, []);

  // Flash activity when notes arrive
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

  if (!state.supported) {
    return (
      <section className="panel midi-panel">
        <h2>Live MIDI</h2>
        <p className="muted small">
          Web MIDI is not available in this browser. Use Chrome, Edge, or Opera
          on desktop for hardware keyboards and external synths.
        </p>
      </section>
    );
  }

  return (
    <section className="panel midi-panel">
      <h2>
        Live MIDI
        {state.enabled && (
          <span
            className={`midi-activity ${activity ? 'on' : ''}`}
            title="Incoming note activity"
            aria-hidden
          />
        )}
      </h2>
      <p className="muted small">
        Connect a keyboard for live play, and/or send song playback to a MIDI
        out device.
      </p>

      {!state.enabled ? (
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

          <div className="midi-actions">
            <button
              type="button"
              className="btn compact-btn"
              onClick={() => {
                playbackEngine.releaseLiveNotes();
                midiIO.allNotesOff();
              }}
              title="Release stuck notes"
            >
              Panic
            </button>
            <button
              type="button"
              className="btn compact-btn"
              onClick={disable}
            >
              Disable
            </button>
          </div>
        </>
      )}

      {state.error && <p className="sound-error">{state.error}</p>}
    </section>
  );
}
