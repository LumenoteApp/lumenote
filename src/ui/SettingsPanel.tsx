import { useRef } from 'react';
import type {
  BackgroundParams,
  EffectsParams,
  NoteStyleParams,
  VisualSettings,
} from '../midi/types';
import { BACKGROUND_PRESETS } from '../theme/backgroundPresets';
import { EFFECTS_PRESETS, getEffectsPreset } from '../theme/effects';
import { HIT_RAIL_STYLE_PRESETS } from '../theme/hitRailPresets';
import { NOTE_STYLE_PRESETS } from '../theme/notePresets';
import {
  randomizeBackground,
  randomizeEffects,
  randomizeNoteStyle,
  randomizeVisuals,
} from '../theme/randomize';
import { fileToStageImageSrc, normalizeStageImage } from '../theme/stageImage';
import { CollapsiblePanel } from './CollapsiblePanel';
import { RandomizeButton } from './RandomizeButton';

type Props = {
  settings: VisualSettings;
  onChange: (s: VisualSettings) => void;
};

type BgSliderDef = {
  key: keyof BackgroundParams;
  label: string;
  min: number;
  max: number;
  step: number;
};

const BG_SLIDERS: BgSliderDef[] = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 1.2, step: 0.05 },
  { key: 'reactive', label: 'Music reactive', min: 0, max: 1.2, step: 0.05 },
  { key: 'parallax', label: 'Motion', min: 0, max: 1.2, step: 0.05 },
  { key: 'stars', label: 'Stars', min: 0, max: 1, step: 0.05 },
  { key: 'orbs', label: 'Color orbs', min: 0, max: 1, step: 0.05 },
  { key: 'waves', label: 'Aurora waves', min: 0, max: 1, step: 0.05 },
  { key: 'beams', label: 'Light beams', min: 0, max: 1, step: 0.05 },
];

type EffectSliderDef = {
  key: keyof EffectsParams;
  label: string;
  min: number;
  max: number;
  step: number;
};

const EFFECT_SLIDERS: EffectSliderDef[] = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 1.4, step: 0.05 },
  { key: 'sparks', label: 'Hit sparks', min: 0, max: 1.4, step: 0.05 },
  { key: 'ambient', label: 'Ambient dust', min: 0, max: 1.4, step: 0.05 },
  { key: 'streams', label: 'Rising streams', min: 0, max: 1.4, step: 0.05 },
  { key: 'bassPulse', label: 'Bass pulse', min: 0, max: 1.4, step: 0.05 },
  { key: 'attack', label: 'Attack snap', min: 0.1, max: 1.2, step: 0.05 },
];

export function SettingsPanel({ settings, onChange }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const setBg = <K extends keyof BackgroundParams>(key: K, value: BackgroundParams[K]) => {
    onChange({
      ...settings,
      background: { ...settings.background, [key]: value, enabled: true },
    });
  };

  const setEffect = <K extends keyof EffectsParams>(key: K, value: EffectsParams[K]) => {
    onChange({
      ...settings,
      effectsPresetId: 'custom',
      effects: {
        ...settings.effects,
        [key]: value,
        ...(key === 'enabled' ? {} : { enabled: true }),
      },
    });
  };

  const setNote = <K extends keyof NoteStyleParams>(key: K, value: NoteStyleParams[K]) => {
    onChange({
      ...settings,
      noteStylePresetId: 'custom',
      notes: { ...settings.notes, [key]: value },
    });
  };

  const applyNotePreset = (id: string) => {
    const preset = NOTE_STYLE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      ...settings,
      noteStylePresetId: id,
      notes: { ...preset.params },
    });
  };

  const applyEffectsPreset = (id: string) => {
    const preset = getEffectsPreset(id);
    onChange({
      ...settings,
      effectsPresetId: id,
      effects: { ...preset.params },
    });
  };

  const applyBgPreset = (id: string) => {
    const preset = BACKGROUND_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      ...settings,
      background: { ...preset.params },
    });
  };

  const fx = settings.effects;
  const bg = settings.background;
  const stage = settings.stageImage;
  // Prefer style chip when on; highlight Off chip only when disabled
  const activeBgId: string = !bg.enabled ? 'off' : bg.style;

  return (
    <>
      <CollapsiblePanel
        id="look-visuals"
        title="Notes"
        defaultOpen={false}
        actions={
          <RandomizeButton
            label="Random"
            subtle
            onClick={() => onChange({ ...settings, ...randomizeVisuals() })}
          />
        }
      >
        <label className="field compact">
          <span className="field-label">
            Scroll speed
            <em>{Math.round(settings.pixelsPerSecond)}</em>
          </span>
          <input
            type="range"
            min={120}
            max={520}
            value={settings.pixelsPerSecond}
            onChange={(e) => set('pixelsPerSecond', Number(e.target.value))}
          />
        </label>

        <label className="field compact">
          <span className="field-label">
            Glow
            <em>{settings.glowStrength.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.glowStrength}
            onChange={(e) => set('glowStrength', Number(e.target.value))}
          />
        </label>

        <label className="field compact">
          <span className="field-label">
            Note opacity
            <em>{settings.noteOpacity.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={settings.noteOpacity}
            onChange={(e) => set('noteOpacity', Number(e.target.value))}
          />
        </label>

        <div className="field" style={{ marginTop: '0.65rem' }}>
          <div className="field-label">
            <span>Note style</span>
            <button
              type="button"
              className="btn tiny"
              onClick={() =>
                onChange({
                  ...settings,
                  noteStylePresetId: 'custom',
                  notes: randomizeNoteStyle(),
                })
              }
            >
              Random
            </button>
          </div>
          <div className="preset-grid" style={{ marginTop: '0.4rem' }}>
            {NOTE_STYLE_PRESETS.map((preset) => {
              const active =
                settings.noteStylePresetId === preset.id ||
                (settings.noteStylePresetId === 'custom' &&
                  settings.notes?.style === preset.params.style);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-chip ${active ? 'active' : ''}`}
                  title={preset.blurb}
                  onClick={() => applyNotePreset(preset.id)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-blurb">{preset.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="field compact">
          <span className="field-label">
            Note border
            <em>{(settings.notes?.border ?? 0).toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.notes?.border ?? 0.25}
            onChange={(e) => setNote('border', Number(e.target.value))}
          />
        </label>
        <label className="field compact">
          <span className="field-label">
            Note shine
            <em>{(settings.notes?.shine ?? 0).toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.notes?.shine ?? 0.35}
            onChange={(e) => setNote('shine', Number(e.target.value))}
          />
        </label>
        <label className="field compact">
          <span className="field-label">
            Inner FX
            <em>{(settings.notes?.innerFx ?? 0).toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1.4}
            step={0.05}
            value={settings.notes?.innerFx ?? 0.35}
            onChange={(e) => setNote('innerFx', Number(e.target.value))}
          />
        </label>
        <label className="field compact">
          <span className="field-label">
            Roundness
            <em>{(settings.notes?.roundness ?? 0).toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.notes?.roundness ?? 0.55}
            onChange={(e) => setNote('roundness', Number(e.target.value))}
          />
        </label>

        <label className="field row">
          <span>Base color</span>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => set('backgroundColor', e.target.value)}
          />
        </label>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="look-keyboard"
        title="Keyboard"
        defaultOpen={false}
        enabled={settings.showKeyboard}
        onEnabledChange={(on) => set('showKeyboard', on)}
      >
        <p className="muted small">Height of the drawn piano.</p>
        <label className="field compact">
          <span className="field-label">
            Piano height
            <em>{Math.round(settings.keyboardHeight ?? 200)}px</em>
          </span>
          <input
            type="range"
            min={100}
            max={280}
            step={4}
            value={settings.keyboardHeight ?? 200}
            onChange={(e) =>
              onChange({
                ...settings,
                keyboardHeight: Number(e.target.value),
                showKeyboard: true,
              })
            }
          />
        </label>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="look-hit-rail"
        title="Impact rail"
        defaultOpen={false}
        enabled={settings.showHitRail}
        onEnabledChange={(on) => set('showHitRail', on)}
      >
        <p className="muted small">Bloom when notes land.</p>
        <div className="field" style={{ marginTop: '0.4rem' }}>
          <span className="field-label">Rail style</span>
          <div className="preset-grid" style={{ marginTop: '0.35rem' }}>
            {HIT_RAIL_STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip ${settings.hitRailStyle === preset.id ? 'active' : ''}`}
                title={preset.blurb}
                onClick={() =>
                  onChange({
                    ...settings,
                    hitRailStyle: preset.id,
                    hitRailEnergy: preset.energy,
                    showHitRail: true,
                  })
                }
              >
                <span className="preset-name">{preset.name}</span>
                <span className="preset-blurb">{preset.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="field compact">
          <span className="field-label">
            Rail intensity
            <em>{settings.hitRailIntensity.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={settings.hitRailIntensity}
            onChange={(e) =>
              onChange({
                ...settings,
                hitRailIntensity: Number(e.target.value),
                showHitRail: true,
              })
            }
          />
        </label>

        <label className="field compact">
          <span className="field-label">
            Rail energy
            <em>{(settings.hitRailEnergy ?? 0.55).toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={1.4}
            step={0.05}
            value={settings.hitRailEnergy ?? 0.55}
            onChange={(e) =>
              onChange({
                ...settings,
                hitRailEnergy: Number(e.target.value),
                showHitRail: true,
              })
            }
          />
        </label>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="look-effects"
        title="Effects"
        defaultOpen={false}
        enabled={fx.enabled}
        onEnabledChange={(on) =>
          onChange({
            ...settings,
            effects: { ...fx, enabled: on },
          })
        }
      >
        <div className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="muted small" style={{ margin: 0 }}>
            Hit sparks, dust, streams, and bass pulse as one mix.
          </p>
          <RandomizeButton
            onClick={() =>
              onChange({
                ...settings,
                effectsPresetId: 'custom',
                effects: randomizeEffects(),
              })
            }
          />
        </div>

        <div className="preset-grid" style={{ marginTop: '0.5rem' }}>
          {EFFECTS_PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              className={`preset-chip ${settings.effectsPresetId === pr.id ? 'active' : ''}`}
              title={pr.blurb}
              onClick={() => applyEffectsPreset(pr.id)}
            >
              <span className="preset-name">{pr.name}</span>
              <span className="preset-blurb">{pr.blurb}</span>
            </button>
          ))}
          {settings.effectsPresetId === 'custom' && (
            <div className="preset-chip active custom-tag">
              <span className="preset-name">Custom</span>
              <span className="preset-blurb">Manual mix</span>
            </div>
          )}
        </div>

        <div className="param-stack" style={{ marginTop: '0.65rem' }}>
          {EFFECT_SLIDERS.map((sl) => (
            <label key={sl.key} className="field compact">
              <span className="field-label">
                {sl.label}
                <em>{Number(fx[sl.key]).toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={Number(fx[sl.key])}
                onChange={(e) => setEffect(sl.key, Number(e.target.value) as never)}
              />
            </label>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="look-background"
        title="Background"
        defaultOpen={false}
        enabled={bg.enabled}
        onEnabledChange={(on) =>
          onChange({
            ...settings,
            background: { ...settings.background, enabled: on },
          })
        }
        actions={
          <RandomizeButton
            onClick={() =>
              onChange({
                ...settings,
                background: randomizeBackground(),
              })
            }
          />
        }
      >
        <p className="muted small">Atmosphere behind the notes - reacts to what you play.</p>

        <div className="stage-image-block">
          <span className="field-label">Stage image</span>
          <p className="muted small">Paints under the notes in live view and baked export.</p>
          <div className="stage-image-row">
            <button
              type="button"
              className="btn compact-btn"
              onClick={() => imageInputRef.current?.click()}
            >
              {stage.src ? 'Change image' : 'Add image'}
            </button>
            {stage.src ? (
              <button
                type="button"
                className="btn compact-btn"
                onClick={() =>
                  onChange({
                    ...settings,
                    stageImage: normalizeStageImage({ enabled: false, src: '' }),
                  })
                }
              >
                Clear
              </button>
            ) : null}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              void fileToStageImageSrc(f)
                .then((src) => {
                  onChange({
                    ...settings,
                    stageImage: normalizeStageImage({
                      ...stage,
                      enabled: true,
                      src,
                    }),
                  });
                })
                .catch(() => {
                  /* ignore unreadable files */
                });
            }}
          />
          {stage.src ? (
            <>
              <label className="midi-check">
                <input
                  type="checkbox"
                  checked={stage.enabled}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      stageImage: { ...stage, enabled: e.target.checked },
                    })
                  }
                />
                <span>Show image</span>
              </label>
              <label className="field compact">
                <span className="field-label">
                  Image opacity
                  <em>{stage.opacity.toFixed(2)}</em>
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={stage.opacity}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      stageImage: {
                        ...stage,
                        enabled: true,
                        opacity: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <div className="stage-image-fit">
                <button
                  type="button"
                  className={`btn tiny ${stage.fit === 'cover' ? 'primary' : ''}`}
                  onClick={() =>
                    onChange({
                      ...settings,
                      stageImage: { ...stage, fit: 'cover', enabled: true },
                    })
                  }
                >
                  Cover
                </button>
                <button
                  type="button"
                  className={`btn tiny ${stage.fit === 'contain' ? 'primary' : ''}`}
                  onClick={() =>
                    onChange({
                      ...settings,
                      stageImage: { ...stage, fit: 'contain', enabled: true },
                    })
                  }
                >
                  Contain
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="preset-grid">
          {BACKGROUND_PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              className={`preset-chip ${activeBgId === pr.id ? 'active' : ''}`}
              title={pr.blurb}
              onClick={() => applyBgPreset(pr.id)}
            >
              <span className="preset-name">{pr.name}</span>
              <span className="preset-blurb">{pr.blurb}</span>
            </button>
          ))}
        </div>

        <div className="param-stack" style={{ marginTop: '0.75rem' }}>
          {BG_SLIDERS.map((sl) => (
            <label key={sl.key} className="field compact">
              <span className="field-label">
                {sl.label}
                <em>{Number(bg[sl.key]).toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={Number(bg[sl.key])}
                onChange={(e) => setBg(sl.key, Number(e.target.value) as never)}
              />
            </label>
          ))}
        </div>
      </CollapsiblePanel>
    </>
  );
}
