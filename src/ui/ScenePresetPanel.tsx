import { useMemo, useRef, useState } from 'react';
import type { InstrumentId } from '../engine/instruments';
import type { VisualSettings } from '../midi/types';
import {
  type SceneCategoryId,
  type ScenePreset,
  SCENE_CATEGORIES,
  captureScene,
  deleteUserPreset,
  getBuiltInCategoryIdsInUse,
  importUserPresets,
  listAllPresets,
  listBuiltInsByCategory,
  parseUserPresetsImport,
  saveUserPreset,
  serializeUserPresetsExport,
} from '../theme/scenePresets';

type Props = {
  settings: VisualSettings;
  instrumentId: InstrumentId;
  volume: number;
  activePresetId: string | null;
  onLoad: (preset: ScenePreset) => void;
  onActiveId: (id: string | null) => void;
};

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

function stampFilename(base: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}-${stamp}.json`;
}

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
  const [ioNote, setIoNote] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const presets = useMemo(() => listAllPresets(), [tick]);
  const categoryIds = useMemo(() => getBuiltInCategoryIdsInUse(), []);
  const [category, setCategory] = useState<SceneCategoryId>(categoryIds[0] ?? 'classic');

  const builtIn = useMemo(() => listBuiltInsByCategory(category), [category]);
  const user = presets.filter((p) => !p.builtIn);

  const save = () => {
    const data = captureScene(settings, instrumentId, volume);
    const preset = saveUserPreset(name || `Look ${user.length + 1}`, data);
    setName('');
    setIoNote(null);
    setTick((t) => t + 1);
    onActiveId(preset.id);
  };

  const remove = (id: string) => {
    if (!confirm('Delete this saved preset?')) return;
    deleteUserPreset(id);
    if (activePresetId === id) onActiveId(null);
    setIoNote(null);
    setTick((t) => t + 1);
  };

  const exportAll = () => {
    if (user.length === 0) {
      setIoNote('Nothing to export yet. Save a look first.');
      return;
    }
    downloadJson(stampFilename('lumenote-presets'), serializeUserPresetsExport(user));
    setIoNote(`Exported ${user.length} preset${user.length === 1 ? '' : 's'}.`);
  };

  const exportOne = (preset: ScenePreset) => {
    const safe = preset.name
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const base = safe ? `lumenote-preset-${safe}` : 'lumenote-preset';
    downloadJson(stampFilename(base), serializeUserPresetsExport([preset]));
    setIoNote(`Exported "${preset.name}".`);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseUserPresetsImport(text);
      if (!parsed.ok) {
        setIoNote(parsed.error);
        return;
      }
      if (user.length > 0) {
        const ok = confirm(
          `Import ${parsed.presets.length} preset${parsed.presets.length === 1 ? '' : 's'} and merge with your ${user.length} existing save${user.length === 1 ? '' : 's'}?`,
        );
        if (!ok) {
          setIoNote('Import cancelled.');
          return;
        }
      }
      const { added } = importUserPresets(parsed.presets, { mode: 'merge' });
      setTick((t) => t + 1);
      setIoNote(`Imported ${added} preset${added === 1 ? '' : 's'}.`);
    } catch {
      setIoNote('Could not read that file.');
    }
  };

  const categoryMeta = SCENE_CATEGORIES.filter((c) => categoryIds.includes(c.id));

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
          Note: SF2 files themselves aren't stored - reload your soundfont after loading this preset.
        </p>
      )}

      <p className="muted small" style={{ marginTop: '0.75rem' }}>
        Built-in looks
      </p>
      <div className="scene-cat-row" role="tablist" aria-label="Preset categories">
        {categoryMeta.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={`scene-cat-chip ${category === c.id ? 'active' : ''}`}
            title={c.blurb}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="muted small scene-cat-blurb">
        {categoryMeta.find((c) => c.id === category)?.blurb ?? ''}
        {builtIn.length > 0 ? ` · ${builtIn.length} looks` : ''}
      </p>
      <div className="preset-grid scene-preset-grid">
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

      <div className="user-preset-header">
        <p className="muted small" style={{ margin: 0 }}>
          Your saves {user.length === 0 ? '(none yet)' : `(${user.length})`}
        </p>
        <div className="user-preset-io">
          <button
            type="button"
            className="btn tiny"
            title="Import presets from a JSON file"
            onClick={() => importRef.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="btn tiny"
            title="Export all saved presets as JSON"
            disabled={user.length === 0}
            onClick={exportAll}
          >
            Export
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void onImportFile(file);
            }}
          />
        </div>
      </div>
      {ioNote && (
        <p className="muted small scene-io-note" role="status">
          {ioNote}
        </p>
      )}
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
                title="Export this preset"
                onClick={() => exportOne(p)}
              >
                ↓
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
