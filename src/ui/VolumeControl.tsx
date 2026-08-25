type Props = {
  volume: number;
  onChange: (v: number) => void;
  compact?: boolean;
};

export function VolumeControl({ volume, onChange, compact = false }: Props) {
  const muted = volume <= 0.001;
  const pct = Math.round(volume * 100);

  return (
    <div className={`volume-control ${compact ? 'compact' : ''}`} title="Global volume">
      <button
        type="button"
        className={`volume-icon ${muted ? 'is-muted' : ''}`}
        onClick={() => onChange(muted ? 0.85 : 0)}
        aria-label={muted ? 'Unmute' : 'Mute'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : volume < 0.4 ? '🔈' : '🔊'}
      </button>
      <input
        className="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        aria-label="Volume"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="volume-pct" aria-hidden>
        {muted ? 'Mute' : `${pct}%`}
      </span>
    </div>
  );
}
