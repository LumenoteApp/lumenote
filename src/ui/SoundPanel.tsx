import { useRef, useState } from 'react';
import {
  BUILTIN_INSTRUMENTS,
  type InstrumentId,
} from '../engine/instruments';
import { playbackEngine } from '../engine/PlaybackEngine';
import { CollapsiblePanel } from './CollapsiblePanel';

type Props = {
  instrumentId: InstrumentId;
  sf2Name: string | null;
  onInstrumentChange: (id: InstrumentId) => void;
  onSf2Loaded: (name: string) => void;
};

export function SoundPanel({
  instrumentId,
  sf2Name,
  onInstrumentChange,
  onSf2Loaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (id: InstrumentId) => {
    setError(null);
    if (id === 'sf2' && !playbackEngine.audio.hasSf2()) {
      fileRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      await playbackEngine.setInstrument(id);
      onInstrumentChange(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set instrument');
    } finally {
      setBusy(false);
    }
  };

  const loadSf2 = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      await playbackEngine.loadSf2(buf, file.name);
      onSf2Loaded(file.name);
      onInstrumentChange('sf2');
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load soundfont (try .sf2 / .sf3)',
      );
    } finally {
      setBusy(false);
    }
  };

  const builtins = BUILTIN_INSTRUMENTS.filter((i) => i.id !== 'sf2');

  return (
    <CollapsiblePanel id="audio-sound" title="Sound" className="sound-panel">
      <p className="muted small">Synths, chip, GM, or a local SF2. Volume lives in the transport bar.</p>

      <div className="preset-grid sound-grid">
        {builtins.map((inst) => (
          <button
            key={inst.id}
            type="button"
            className={`preset-chip ${instrumentId === inst.id ? 'active' : ''}`}
            title={inst.blurb}
            disabled={busy}
            onClick={() => void pick(inst.id)}
          >
            <span className="preset-name">{inst.name}</span>
            <span className="preset-blurb">{inst.blurb}</span>
          </button>
        ))}
      </div>

      <div className="sf2-block">
        <button
          type="button"
          className={`btn compact-btn sf2-btn ${instrumentId === 'sf2' ? 'primary' : ''}`}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Loading…' : 'Load SF2 / SF3'}
        </button>
        {sf2Name && (
          <button
            type="button"
            className={`preset-chip sf2-chip ${instrumentId === 'sf2' ? 'active' : ''}`}
            disabled={busy}
            onClick={() => void pick('sf2')}
            title="Use loaded soundfont"
          >
            <span className="preset-name">SF2 active</span>
            <span className="preset-blurb">{sf2Name}</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".sf2,.sf3,.dls,application/octet-stream"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadSf2(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="sound-error">{error}</p>}
      <p className="muted small" style={{ marginTop: '0.5rem' }}>
        Tip: try <strong>Chiptune</strong> or <strong>GM Chip</strong> for retro vibes.
        Large SF2s may take a moment to load.
      </p>
    </CollapsiblePanel>
  );
}
