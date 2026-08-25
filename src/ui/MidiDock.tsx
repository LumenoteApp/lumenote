import { midiIO } from '../engine/MidiIO';
import { useMidiIO } from './useMidiIO';

/** Compact MIDI port picker for the transport bar. */
export function MidiDock() {
  const { state, busy, activity, enable } = useMidiIO();

  if (!state.supported) {
    return (
      <div className="midi-dock" title="Web MIDI needs Chrome, Edge, or Opera">
        <span className="midi-dock-na">MIDI</span>
      </div>
    );
  }

  if (!state.enabled) {
    return (
      <div className="midi-dock">
        <span className={`midi-activity ${activity ? 'on' : ''}`} aria-hidden />
        <button
          type="button"
          className="btn compact-btn midi-dock-enable"
          disabled={busy}
          onClick={() => void enable()}
          title="Enable Web MIDI"
        >
          {busy ? 'MIDI…' : 'MIDI'}
        </button>
      </div>
    );
  }

  return (
    <div className="midi-dock is-on">
      <span
        className={`midi-activity ${activity ? 'on' : ''}`}
        title="Incoming MIDI"
        aria-hidden
      />
      <label className="midi-dock-field">
        <span className="midi-dock-k">In</span>
        <select
          className="midi-dock-select"
          value={state.inputId ?? 'all'}
          onChange={(e) => {
            const v = e.target.value;
            midiIO.setInputId(v === 'all' ? 'all' : v);
          }}
          title="MIDI input"
          aria-label="MIDI input"
        >
          <option value="all">All inputs</option>
          {state.inputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="midi-dock-field">
        <span className="midi-dock-k">Out</span>
        <select
          className="midi-dock-select"
          value={state.outputId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            midiIO.setOutputId(v === '' ? null : v);
          }}
          title="MIDI output"
          aria-label="MIDI output"
        >
          <option value="">Browser</option>
          {state.outputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
