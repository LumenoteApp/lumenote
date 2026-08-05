import type { RandomCategory, RandomizerConfig } from '../theme/randomizerConfig';
import { RANDOM_CATEGORIES, anyCategoryOn } from '../theme/randomizerConfig';
import { CollapsiblePanel } from './CollapsiblePanel';
import { RandomizeButton } from './RandomizeButton';

type Props = {
  config: RandomizerConfig;
  onChange: (c: RandomizerConfig) => void;
  onSurprise: () => void;
};

export function RandomizerDock({ config, onChange, onSurprise }: Props) {
  const setCat = (id: RandomCategory, on: boolean) => {
    onChange({
      ...config,
      categories: { ...config.categories, [id]: on },
    });
  };

  const toggleAll = (on: boolean) => {
    const categories = { ...config.categories };
    for (const c of RANDOM_CATEGORIES) categories[c.id] = on;
    onChange({ ...config, categories });
  };

  const enabled = anyCategoryOn(config.categories);

  return (
    <CollapsiblePanel
      id="scene-surprise"
      title="Surprise me"
      className={`randomizer-dock ${config.partyMode ? 'partying' : ''}`}
      defaultOpen={false}
    >
      <p className="muted small">
        {config.partyMode
          ? 'Party mode - parameters are dancing'
          : 'Toggle categories, then Surprise or Party'}
      </p>

      <div className="randomizer-actions">
        <RandomizeButton
          label="Surprise"
          title="Jump randomize enabled categories once"
          onClick={onSurprise}
        />
        <button
          type="button"
          className={`btn compact-btn party-toggle ${config.partyMode ? 'party-on' : ''}`}
          onClick={() => onChange({ ...config, partyMode: !config.partyMode })}
          disabled={!enabled && !config.partyMode}
          title="Smoothly dance parameters over time"
        >
          {config.partyMode ? '🎉 Party on' : '🎉 Party'}
        </button>
      </div>

      <p className="muted small" style={{ marginTop: '0.65rem' }}>
        Categories
      </p>
      <div className="category-toggles">
        {RANDOM_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cat-chip ${config.categories[c.id] ? 'on' : ''}`}
            title={c.blurb}
            onClick={() => setCat(c.id, !config.categories[c.id])}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className="cat-chip ghost"
          onClick={() => toggleAll(true)}
          title="Enable all"
        >
          All
        </button>
        <button
          type="button"
          className="cat-chip ghost"
          onClick={() => toggleAll(false)}
          title="Disable all"
        >
          None
        </button>
      </div>

      {config.partyMode && (
        <div className="party-sliders">
          <label className="field compact">
            <span className="field-label">
              Dance speed
              <em>{config.danceSpeed.toFixed(2)}</em>
            </span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={config.danceSpeed}
              onChange={(e) =>
                onChange({ ...config, danceSpeed: Number(e.target.value) })
              }
            />
          </label>
          <label className="field compact">
            <span className="field-label">
              Color / style flips
              <em>{config.colorSwitchRate.toFixed(2)}</em>
            </span>
            <input
              type="range"
              min={0.15}
              max={1.5}
              step={0.05}
              value={config.colorSwitchRate}
              onChange={(e) =>
                onChange({ ...config, colorSwitchRate: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}
    </CollapsiblePanel>
  );
}
