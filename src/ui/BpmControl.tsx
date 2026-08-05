import { useEffect, useState, type KeyboardEvent } from 'react';
import { formatBpm } from '../midi/types';

type Props = {
  bpm: number;
  disabled?: boolean;
  tempoEdited?: boolean;
  onDelta: (delta: number) => void;
  onSet: (bpm: number) => void;
  onReset?: () => void;
};

function parseBpmInput(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.min(400, Math.max(20, n));
}

/**
 * − / editable BPM / + control for playback tempo.
 * Type a value and press Enter (or blur) to apply; Esc cancels.
 */
export function BpmControl({
  bpm,
  disabled = false,
  tempoEdited = false,
  onDelta,
  onSet,
  onReset,
}: Props) {
  const [draft, setDraft] = useState(() => formatBpm(bpm));
  const [focused, setFocused] = useState(false);

  // Keep field in sync when not actively editing
  useEffect(() => {
    if (!focused) setDraft(formatBpm(bpm));
  }, [bpm, focused]);

  const commit = () => {
    const parsed = parseBpmInput(draft);
    if (parsed == null) {
      setDraft(formatBpm(bpm));
      return;
    }
    onSet(parsed);
    setDraft(formatBpm(parsed));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Don't let studio Space/R etc. steal focus while typing
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(formatBpm(bpm));
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onDelta(e.shiftKey ? 5 : 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onDelta(e.shiftKey ? -5 : -1);
    }
  };

  return (
    <div
      className={`bpm-control ${tempoEdited ? 'is-edited' : ''}`}
      title={
        tempoEdited
          ? 'Playback tempo (edited). Type a value, or click Reset. Shift+± for 5 BPM.'
          : 'Playback tempo. Type a BPM, or use +/−. Shift+click ± for 5.'
      }
    >
      <button
        type="button"
        className="btn tiny bpm-nudge"
        disabled={disabled}
        aria-label="Decrease BPM"
        onClick={(e) => onDelta(e.shiftKey ? -5 : -1)}
      >
        −
      </button>
      <label className="bpm-field">
        <span className="visually-hidden">BPM</span>
        <input
          className="bpm bpm-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={draft}
          size={Math.max(3, draft.length)}
          aria-label="Playback BPM"
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            setFocused(true);
            e.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={onKeyDown}
        />
        <span className="bpm-unit">BPM</span>
      </label>
      <button
        type="button"
        className="btn tiny bpm-nudge"
        disabled={disabled}
        aria-label="Increase BPM"
        onClick={(e) => onDelta(e.shiftKey ? 5 : 1)}
      >
        +
      </button>
      {tempoEdited && onReset ? (
        <button
          type="button"
          className="btn tiny bpm-reset"
          disabled={disabled}
          title="Reset to MIDI original tempo"
          onClick={onReset}
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
