import { BpmControl } from './BpmControl';

type Props = {
  fileName: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  /** Effective tempo at playhead (includes user tempo scale); null when no song */
  bpm: number | null;
  /** True when playback tempo differs from the MIDI file */
  tempoEdited?: boolean;
  playerOnly: boolean;
  onHome: () => void;
  onOpen: () => void;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  onTogglePlayerOnly: () => void;
  /** Nudge effective BPM (e.g. +1 / -1). Shift-click uses ±5. */
  onBpmDelta?: (delta: number) => void;
  /** Set absolute effective BPM */
  onBpmSet?: (bpm: number) => void;
  /** Restore MIDI original tempo */
  onBpmReset?: () => void;
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
  tempoEdited = false,
  playerOnly,
  onHome,
  onOpen,
  onPlayPause,
  onStop,
  onSeek,
  onTogglePlayerOnly,
  onBpmDelta,
  onBpmSet,
  onBpmReset,
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
        {bpm != null && onBpmDelta && onBpmSet ? (
          <BpmControl
            bpm={bpm}
            disabled={!fileName}
            tempoEdited={tempoEdited}
            onDelta={onBpmDelta}
            onSet={onBpmSet}
            onReset={onBpmReset}
          />
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
