import { useMemo } from 'react';
import {
  type ExportFps,
  type ExportMode,
  type ExportProgress,
  type ExportSettings,
  EXPORT_PRESETS,
  canBakeOffline,
  pickRecorderMime,
  exportExtension,
  formatResolution,
} from '../export/VideoExporter';

type Props = {
  hasSong: boolean;
  duration: number;
  settings: ExportSettings;
  progress: ExportProgress;
  busy: boolean;
  onChange: (s: ExportSettings) => void;
  onStart: () => void;
  onCancel: () => void;
};

function formatDur(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ExportPanel({
  hasSong,
  duration,
  settings,
  progress,
  busy,
  onChange,
  onStart,
  onCancel,
}: Props) {
  const mimeRealtime = useMemo(() => pickRecorderMime(), []);
  const bakeOk = useMemo(() => canBakeOffline(), []);
  const realtimeOk = !!mimeRealtime;
  const supported = settings.mode === 'bake' ? bakeOk : realtimeOk;
  const ext = settings.mode === 'bake' ? 'mp4' : exportExtension(mimeRealtime);
  const pct =
    progress.duration > 0.05
      ? Math.min(100, Math.round((progress.elapsed / progress.duration) * 100))
      : 0;

  const setFps = (fps: ExportFps) => onChange({ ...settings, fps });
  const setMode = (mode: ExportMode) => onChange({ ...settings, mode });
  const setResolution = (width: number, height: number) =>
    onChange({ ...settings, width, height });

  const isHeavy = settings.width * settings.height >= 2560 * 1440;

  return (
    <section className="panel export-panel">
      <h2>Export video</h2>
      <p className="muted small">
        {settings.mode === 'bake'
          ? 'Offline bake: every frame is computed at exact fps - smooth MP4, no dropped frames.'
          : 'Realtime capture: plays the song live (may drop frames if the PC is busy).'}
      </p>

      <div className="export-row">
        <span className="field-label">Mode</span>
        <div className="export-fps">
          <button
            type="button"
            className={`btn compact-btn ${settings.mode === 'bake' ? 'primary' : ''}`}
            disabled={busy || !bakeOk}
            onClick={() => setMode('bake')}
            title={bakeOk ? 'Smooth offline render' : 'WebCodecs not available'}
          >
            Bake
          </button>
          <button
            type="button"
            className={`btn compact-btn ${settings.mode === 'realtime' ? 'primary' : ''}`}
            disabled={busy || !realtimeOk}
            onClick={() => setMode('realtime')}
            title="Live MediaRecorder capture"
          >
            Realtime
          </button>
        </div>
      </div>

      {!supported && (
        <p className="sound-error">
          {settings.mode === 'bake'
            ? 'Smooth bake needs WebCodecs (Chrome or Edge recommended).'
            : 'Realtime export needs MediaRecorder (try Chrome or Edge).'}
        </p>
      )}

      <div className="export-row export-row-stack">
        <span className="field-label">Resolution</span>
        <div className="export-fps export-res">
          {EXPORT_PRESETS.map((p) => {
            const active = settings.width === p.width && settings.height === p.height;
            return (
              <button
                key={p.id}
                type="button"
                className={`btn compact-btn ${active ? 'primary' : ''}`}
                disabled={busy}
                onClick={() => setResolution(p.width, p.height)}
                title={`${p.width}×${p.height}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="muted small export-res-meta">{formatResolution(settings.width, settings.height)}</p>

      <div className="export-row">
        <span className="field-label">Frame rate</span>
        <div className="export-fps">
          <button
            type="button"
            className={`btn compact-btn ${settings.fps === 30 ? 'primary' : ''}`}
            disabled={busy}
            onClick={() => setFps(30)}
          >
            30 fps
          </button>
          <button
            type="button"
            className={`btn compact-btn ${settings.fps === 60 ? 'primary' : ''}`}
            disabled={busy}
            onClick={() => setFps(60)}
          >
            60 fps
          </button>
        </div>
      </div>

      <label className="midi-check">
        <input
          type="checkbox"
          checked={settings.includeAudio}
          disabled={busy}
          onChange={(e) => onChange({ ...settings, includeAudio: e.target.checked })}
        />
        <span>Include audio</span>
      </label>

      <p className="muted small export-eta">
        {hasSong
          ? settings.mode === 'bake'
            ? `~${formatDur(duration)} song · bake can be faster or slower than realtime${
                isHeavy ? ' · 1440p/4K is heavier on CPU/GPU' : ''
              }`
            : `Length ~${formatDur(duration)} · capture runs in realtime${
                isHeavy ? ' · prefer Bake for 1440p/4K' : ''
              }`
          : 'Load a MIDI file to export'}
      </p>

      {busy && (
        <div className="export-progress">
          <div className="export-progress-bar">
            <div className="export-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            {progress.message ??
              (progress.phase === 'recording'
                ? `${formatDur(progress.elapsed)} / ${formatDur(progress.duration)}`
                : progress.phase)}
          </p>
        </div>
      )}

      {progress.phase === 'error' && progress.message && (
        <p className="sound-error">{progress.message}</p>
      )}
      {progress.phase === 'done' && progress.message && (
        <p className="muted small" style={{ color: 'rgba(105, 240, 174, 0.9)' }}>
          {progress.message}
        </p>
      )}

      <div className="export-actions">
        {!busy ? (
          <button
            type="button"
            className="btn primary compact-btn export-start"
            disabled={!hasSong || !supported}
            onClick={onStart}
          >
            {settings.mode === 'bake' ? 'Bake video' : 'Start capture'}
          </button>
        ) : (
          <button type="button" className="btn compact-btn export-start" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <p className="muted small" style={{ marginTop: '0.45rem' }}>
        {settings.mode === 'bake'
          ? `Output .${ext}. GM/SF2 bake audio may use Soft Piano offline. Party mode off during export.`
          : 'Close other tabs for fewer drops. Prefer Bake for smooth results.'}
      </p>
    </section>
  );
}
