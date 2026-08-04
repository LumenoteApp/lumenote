import { formatBpm } from '../midi/types';

type Props = {
  fileName: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  /** Active tempo at playhead; null when no song / unknown */
  bpm: number | null;
  playerOnly: boolean;
  onHome: () => void;
  onOpen: () => void;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  onTogglePlayerOnly: () => void;
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TransportBar({
  fileName,
  playing,
  currentTime,
  duration,
  bpm,
  playerOnly,
  onHome,
  onOpen,
  onPlayPause,
  onStop,
  onSeek,
  onTogglePlayerOnly,
}: Props) {
  return (
    <header className={`transport ${playerOnly ? 'transport-hidden' : ''}`}>
      <div className="transport-left">
        <button type="button" className="btn compact-btn transport-home-btn" onClick={onHome}>
          Home
        </button>
        <button type="button" className="btn primary" onClick={onOpen}>
          Open MIDI
        </button>
        <span className="file-name" title={fileName ?? undefined}>
          {fileName ?? 'No file loaded'}
        </span>
      </div>

      <div className="transport-center">
        <button type="button" className="btn icon" onClick={onStop} title="Stop (R)">
          ⏹
        </button>
        <button
          type="button"
          className="btn icon play"
          onClick={onPlayPause}
          title="Play / Pause (Space)"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="time">
          {formatTime(currentTime)}
          <span className="time-sep">/</span>
          {formatTime(duration)}
        </span>
        {bpm != null ? (
          <span className="bpm" title="Tempo from MIDI">
            {formatBpm(bpm)}
            <span className="bpm-unit">BPM</span>
          </span>
        ) : null}
      </div>

      <div className="transport-right">
        <input
          className="scrubber"
          type="range"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={!fileName}
        />
        <button
          type="button"
          className="btn icon fullscreen-btn"
          onClick={onTogglePlayerOnly}
          title={playerOnly ? 'Exit player view (Esc / F)' : 'Player fullscreen (F)'}
        >
          {playerOnly ? '⛶' : '⛶'}
        </button>
      </div>
    </header>
  );
}
