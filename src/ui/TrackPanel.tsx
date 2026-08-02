import type { TrackInfo } from '../midi/types';
import type { ColorSettings } from '../theme/colorPresets';
import {
  COLOR_MODE_PRESETS,
  DEFAULT_COLOR_SETTINGS,
  TRACK_PALETTE_PRESETS,
  applyPaletteToTracks,
  getPalette,
  modePreviewColors,
  normalizeColorSettings,
} from '../theme/colorPresets';
import { randomizeColors } from '../theme/randomize';
import { PanelHeader, RandomizeButton } from './RandomizeButton';

void RandomizeButton;

type Props = {
  tracks: TrackInfo[];
  colors?: Partial<ColorSettings> | null;
  onTracksChange: (tracks: TrackInfo[]) => void;
  onColorsChange: (colors: ColorSettings) => void;
};

export function TrackPanel({ tracks, colors: colorsProp, onTracksChange, onColorsChange }: Props) {
  const colors = normalizeColorSettings(colorsProp);

  const applyPalette = (paletteId: string) => {
    onColorsChange({ ...colors, paletteId });
    if (tracks.length > 0) {
      onTracksChange(applyPaletteToTracks(tracks, paletteId));
    }
  };

  const setMode = (mode: ColorSettings['mode']) => {
    onColorsChange({ ...colors, mode });
  };

  const setColor = <K extends keyof ColorSettings>(key: K, value: ColorSettings[K]) => {
    onColorsChange({ ...colors, [key]: value });
  };

  const update = (index: number, patch: Partial<TrackInfo>) => {
    onTracksChange(tracks.map((t) => (t.index === index ? { ...t, ...patch } : t)));
  };

  const randomize = () => {
    const next = randomizeColors();
    onColorsChange(next);
    if (tracks.length > 0) {
      onTracksChange(applyPaletteToTracks(tracks, next.paletteId));
    }
  };

  return (
    <section className="panel">
      <PanelHeader title="Colors" onRandomize={randomize} />

      <p className="muted small">Note color mode</p>
      <div className="preset-grid">
        {COLOR_MODE_PRESETS.map((m) => {
          const swatches = modePreviewColors(m.id, performance.now() / 1000);
          return (
            <button
              key={m.id}
              type="button"
              className={`preset-chip ${colors.mode === m.id ? 'active' : ''}`}
              title={m.blurb}
              onClick={() => setMode(m.id)}
            >
              <span className="preset-name">{m.name}</span>
              <span className="preset-blurb">{m.blurb}</span>
              <span className="swatch-row">
                {swatches.map((c, i) => (
                  <span key={i} className="swatch" style={{ background: c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {colors.mode !== 'track' && (
        <div className="param-stack" style={{ marginTop: '0.65rem' }}>
          <label className="field compact">
            <span className="field-label">
              Cycle speed
              <em>{(colors.cycleSpeed ?? DEFAULT_COLOR_SETTINGS.cycleSpeed).toFixed(2)}</em>
            </span>
            <input
              type="range"
              min={0.05}
              max={1.5}
              step={0.05}
              value={colors.cycleSpeed}
              onChange={(e) => setColor('cycleSpeed', Number(e.target.value))}
            />
          </label>
          <label className="field compact">
            <span className="field-label">
              Saturation
              <em>{(colors.saturation ?? DEFAULT_COLOR_SETTINGS.saturation).toFixed(2)}</em>
            </span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={colors.saturation}
              onChange={(e) => setColor('saturation', Number(e.target.value))}
            />
          </label>
          <label className="field compact">
            <span className="field-label">
              Brightness
              <em>{(colors.brightness ?? DEFAULT_COLOR_SETTINGS.brightness).toFixed(2)}</em>
            </span>
            <input
              type="range"
              min={0.4}
              max={1.2}
              step={0.05}
              value={colors.brightness}
              onChange={(e) => setColor('brightness', Number(e.target.value))}
            />
          </label>
          <label className="field compact">
            <span className="field-label">
              Track blend
              <em>{(colors.trackBlend ?? DEFAULT_COLOR_SETTINGS.trackBlend).toFixed(2)}</em>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={colors.trackBlend}
              onChange={(e) => setColor('trackBlend', Number(e.target.value))}
            />
          </label>
        </div>
      )}

      <p className="muted small" style={{ marginTop: '0.85rem' }}>
        Track palettes
      </p>
      <div className="preset-grid">
        {TRACK_PALETTE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset-chip ${colors.paletteId === p.id ? 'active' : ''}`}
            title={p.blurb}
            onClick={() => applyPalette(p.id)}
          >
            <span className="preset-name">{p.name}</span>
            <span className="swatch-row">
              {p.colors.slice(0, 5).map((c, i) => (
                <span key={i} className="swatch" style={{ background: c }} />
              ))}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="preset-chip"
          title="Shuffle track colors from the current palette order"
          onClick={() => {
            const base = [...getPalette(colors.paletteId)];
            for (let i = base.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [base[i], base[j]] = [base[j], base[i]];
            }
            if (tracks.length > 0) {
              onTracksChange(
                tracks.map((t, i) => ({ ...t, color: base[i % base.length] })),
              );
            }
          }}
        >
          <span className="preset-name">Shuffle</span>
          <span className="preset-blurb">Randomize order</span>
        </button>
      </div>

      {tracks.length === 0 ? (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Load a multi-track MIDI to assign colors per hand/track.
        </p>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: '0.85rem' }}>
            Tracks
          </p>
          <ul className="track-list">
            {tracks.map((t) => (
              <li key={t.index} className={`track-row ${t.visible ? '' : 'dim'}`}>
                <input
                  type="color"
                  className="color-input"
                  value={t.color}
                  onChange={(e) => update(t.index, { color: e.target.value })}
                  title="Color"
                />
                <div className="track-meta">
                  <span className="track-name">{t.name}</span>
                  <span className="track-sub">
                    {t.noteCount} notes · ch {t.channel + 1}
                  </span>
                </div>
                <button
                  type="button"
                  className={`btn tiny ${t.visible ? '' : 'off'}`}
                  title={t.visible ? 'Hide' : 'Show'}
                  onClick={() => update(t.index, { visible: !t.visible })}
                >
                  {t.visible ? '👁' : '–'}
                </button>
                <button
                  type="button"
                  className={`btn tiny ${t.muted ? 'off' : ''}`}
                  title={t.muted ? 'Unmute' : 'Mute'}
                  onClick={() => update(t.index, { muted: !t.muted })}
                >
                  {t.muted ? '🔇' : '🔊'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
