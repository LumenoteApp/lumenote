import { useMemo, useState } from 'react';
import type { InstrumentId } from '../engine/instruments';
import type { VisualSettings } from '../midi/types';
import {
  type ScenePreset,
  captureScene,
  deleteUserPreset,
  listAllPresets,
  saveUserPreset,
} from '../theme/scenePresets';

type Props = {
  settings: VisualSettings;
  instrumentId: InstrumentId;
  volume: number;
  activePresetId: string | null;
  onLoad: (preset: ScenePreset) => void;
  onActiveId: (id: string | null) => void;
};

export function ScenePresetPanel({
  settings,
  instrumentId,
  volume,
  activePresetId,
  onLoad,
  onActiveId,
}: Props) {
  const [name, setName] = useState('');
  const [tick, setTick] = useState(0);
  const presets = useMemo(() => listAllPresets(), [tick]);

  const builtIn = presets.filter((p) => p.builtIn);
  const user = presets.filter((p) => !p.builtIn);

  const save = () => {
    const data = captureScene(settings, instrumentId, volume);
    const preset = saveUserPreset(name || `Look ${user.length + 1}`, data);
    setName('');
    setTick((t) => t + 1);
    onActiveId(preset.id);
  };

  const remove = (id: string) => {
    if (!confirm('Delete this saved preset?')) return;
    deleteUserPreset(id);
    if (activePresetId === id) onActiveId(null);
    setTick((t) => t + 1);
  };

  return (
    <section className="panel scene-preset-panel">
      <h2>Scene presets</h2>
      <p className="muted small">
        Save everything - visuals, particles, colors, FX, sound & volume - and load it later.
      </p>

      <div className="scene-save-row">
        <input
          className="scene-name-input"
          type="text"
          placeholder="Preset name…"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <button type="button" className="btn primary compact-btn" onClick={save}>
          Save
        </button>
      </div>
      {instrumentId === 'sf2' && (
        <p className="muted small scene-sf2-note">
          Note: SF2 files themselves aren’t stored - reload your soundfont after loading this preset.
        </p>
      )}

      <p className="muted small" style={{ marginTop: '0.75rem' }}>
        Built-in
      </p>
      <div className="preset-grid">
        {builtIn.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset-chip ${activePresetId === p.id ? 'active' : ''}`}
            title={p.blurb}
            onClick={() => {
              onLoad(p);
              onActiveId(p.id);
            }}
          >
            <span className="preset-name">{p.name}</span>
            <span className="preset-blurb">{p.blurb}</span>
          </button>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: '0.75rem' }}>
        Your saves {user.length === 0 ? '(none yet)' : `(${user.length})`}
      </p>
      {user.length > 0 && (
        <ul className="user-preset-list">
          {user.map((p) => (
            <li key={p.id} className={`user-preset-row ${activePresetId === p.id ? 'active' : ''}`}>
              <button
                type="button"
                className="user-preset-main"
                onClick={() => {
                  onLoad(p);
                  onActiveId(p.id);
                }}
              >
                <span className="preset-name">{p.name}</span>
                <span className="preset-blurb">
                  {p.savedAt
                    ? new Date(p.savedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : p.blurb}
                </span>
              </button>
              <button
                type="button"
                className="btn tiny"
                title="Delete"
                onClick={() => remove(p.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
