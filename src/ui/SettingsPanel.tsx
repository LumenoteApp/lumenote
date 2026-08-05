import type {
  BackgroundParams,
  MusicReactiveParams,
  NoteStyleParams,
  ParticleParams,
  VisualSettings,
} from '../midi/types';
import { BACKGROUND_PRESETS } from '../theme/backgroundPresets';
import { MUSIC_REACTIVE_PRESETS } from '../theme/musicReactivePresets';
import { HIT_RAIL_STYLE_PRESETS } from '../theme/hitRailPresets';
import { NOTE_STYLE_PRESETS } from '../theme/notePresets';
import { PARTICLE_PRESETS } from '../theme/particlePresets';
import {
  randomizeBackground,
  randomizeMusicReactive,
  randomizeNoteStyle,
  randomizeParticles,
  randomizeVisuals,
} from '../theme/randomize';
import { CollapsiblePanel } from './CollapsiblePanel';
import { RandomizeButton } from './RandomizeButton';

type Props = {
  settings: VisualSettings;
  onChange: (s: VisualSettings) => void;
};

type SliderDef = {
  key: keyof ParticleParams;
  label: string;
  min: number;
  max: number;
  step: number;
};

type BgSliderDef = {
  key: keyof BackgroundParams;
  label: string;
  min: number;
  max: number;
  step: number;
};

const PARTICLE_SLIDERS: SliderDef[] = [
  { key: 'density', label: 'Density', min: 0.1, max: 2.2, step: 0.05 },
  { key: 'size', label: 'Size', min: 0.3, max: 2.2, step: 0.05 },
  { key: 'sizeVariance', label: 'Size variance', min: 0, max: 1, step: 0.05 },
  { key: 'speed', label: 'Speed', min: 0.2, max: 2.2, step: 0.05 },
  { key: 'spread', label: 'Spread', min: 0, max: 1, step: 0.05 },
  { key: 'gravity', label: 'Gravity', min: -1.2, max: 1.8, step: 0.05 },
  { key: 'drag', label: 'Drag', min: 0, max: 1, step: 0.05 },
  { key: 'lifetime', label: 'Lifetime', min: 0.25, max: 2.2, step: 0.05 },
  { key: 'turbulence', label: 'Turbulence', min: 0, max: 1.2, step: 0.05 },
  { key: 'sparkle', label: 'Sparkle', min: 0, max: 1, step: 0.05 },
  { key: 'bloom', label: 'Bloom', min: 0.4, max: 2.2, step: 0.05 },
  { key: 'secondaryBurst', label: 'Burst ring', min: 0, max: 1.2, step: 0.05 },
  { key: 'trail', label: 'Trails', min: 0, max: 1, step: 0.05 },
  { key: 'whiteHot', label: 'White-hot core', min: 0, max: 1, step: 0.05 },
  { key: 'swirl', label: 'Swirl', min: 0, max: 1.2, step: 0.05 },
  { key: 'sustainEmit', label: 'Sustain glow', min: 0, max: 1.2, step: 0.05 },
  { key: 'hitFlash', label: 'Hit flash', min: 0, max: 1.2, step: 0.05 },
];

const BG_SLIDERS: BgSliderDef[] = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 1.2, step: 0.05 },
  { key: 'reactive', label: 'Music reactive', min: 0, max: 1.2, step: 0.05 },
  { key: 'parallax', label: 'Motion', min: 0, max: 1.2, step: 0.05 },
  { key: 'stars', label: 'Stars', min: 0, max: 1, step: 0.05 },
  { key: 'orbs', label: 'Color orbs', min: 0, max: 1, step: 0.05 },
  { key: 'waves', label: 'Aurora waves', min: 0, max: 1, step: 0.05 },
  { key: 'beams', label: 'Light beams', min: 0, max: 1, step: 0.05 },
];

type MusicSliderDef = {
  key: keyof MusicReactiveParams;
  label: string;
  min: number;
  max: number;
  step: number;
};

const MUSIC_SLIDERS: MusicSliderDef[] = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 1.4, step: 0.05 },
  { key: 'ambient', label: 'Ambient dust', min: 0, max: 1.4, step: 0.05 },
  { key: 'columns', label: 'Rising streams', min: 0, max: 1.4, step: 0.05 },
  { key: 'waves', label: 'Shockwaves', min: 0, max: 1.4, step: 0.05 },
  { key: 'bassPulse', label: 'Bass pulse', min: 0, max: 1.4, step: 0.05 },
  { key: 'attack', label: 'Attack snap', min: 0.1, max: 1.2, step: 0.05 },
];

export function SettingsPanel({ settings, onChange }: Props) {
  const set = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const setParticle = <K extends keyof ParticleParams>(key: K, value: ParticleParams[K]) => {
    onChange({
      ...settings,
      particlePresetId: 'custom',
      particles: { ...settings.particles, [key]: value },
    });
  };

  const setBg = <K extends keyof BackgroundParams>(key: K, value: BackgroundParams[K]) => {
    onChange({
      ...settings,
      background: { ...settings.background, [key]: value, enabled: true },
    });
  };

  const setMusic = <K extends keyof MusicReactiveParams>(key: K, value: MusicReactiveParams[K]) => {
    onChange({
      ...settings,
      musicReactivePresetId: 'custom',
      musicReactive: { ...settings.musicReactive, [key]: value },
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

  const applyMusicPreset = (id: string) => {
    const preset = MUSIC_REACTIVE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      ...settings,
      musicReactivePresetId: id,
      musicReactive: { ...preset.params },
    });
  };

  const applyParticlePreset = (id: string) => {
    const preset = PARTICLE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      ...settings,
      particlePresetId: id,
      particles: { ...preset.params },
      particlesEnabled: true,
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

  const p = settings.particles;
  const bg = settings.background;
  const particlesOff = !settings.particlesEnabled;
  const bgOff = !bg.enabled;
  const activeBgId: string = !bg.enabled ? 'off' : bg.style;

  return (
    <>
      <CollapsiblePanel
        id="look-visuals"
        title="Visuals"
        actions={
          <RandomizeButton
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="field-label">Note style</span>
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
            {NOTE_STYLE_PRESETS.map((p) => {
              const active =
                settings.noteStylePresetId === p.id ||
                (settings.noteStylePresetId === 'custom' && settings.notes?.style === p.params.style);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-chip ${active ? 'active' : ''}`}
                  title={p.blurb}
                  onClick={() => applyNotePreset(p.id)}
                >
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-blurb">{p.blurb}</span>
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

        <label className="field check">
          <input
            type="checkbox"
            checked={settings.showKeyboard}
            onChange={(e) => set('showKeyboard', e.target.checked)}
          />
          <span>Show keyboard</span>
        </label>

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
            disabled={!settings.showKeyboard}
            onChange={(e) => set('keyboardHeight', Number(e.target.value))}
          />
        </label>

        <label className="field check">
          <input
            type="checkbox"
            checked={settings.showHitRail}
            onChange={(e) => set('showHitRail', e.target.checked)}
          />
          <span>Impact rail</span>
        </label>

        <div className={`field ${!settings.showHitRail ? 'is-disabled' : ''}`} style={{ marginTop: '0.4rem' }}>
          <span className="field-label">Rail style</span>
          <div className="preset-grid" style={{ marginTop: '0.35rem' }}>
            {HIT_RAIL_STYLE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`preset-chip ${settings.hitRailStyle === p.id ? 'active' : ''}`}
                title={p.blurb}
                disabled={!settings.showHitRail}
                onClick={() =>
                  onChange({
                    ...settings,
                    hitRailStyle: p.id,
                    hitRailEnergy: p.energy,
                    showHitRail: true,
                  })
                }
              >
                <span className="preset-name">{p.name}</span>
                <span className="preset-blurb">{p.blurb}</span>
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
            disabled={!settings.showHitRail}
            onChange={(e) => set('hitRailIntensity', Number(e.target.value))}
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
            disabled={!settings.showHitRail}
            onChange={(e) => set('hitRailEnergy', Number(e.target.value))}
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
        id="look-music"
        title="Music reactive"
        defaultOpen={false}
        actions={
          <RandomizeButton
            onClick={() =>
              onChange({
                ...settings,
                musicReactivePresetId: 'custom',
                musicReactive: randomizeMusicReactive(),
              })
            }
          />
        }
      >
        <p className="muted small">
          Particle animation that breathes with the notes - dust, rising streams, shockwaves.
        </p>

        <div className="preset-grid" style={{ marginTop: '0.5rem' }}>
          {MUSIC_REACTIVE_PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              className={`preset-chip ${settings.musicReactivePresetId === pr.id ? 'active' : ''}`}
              title={pr.blurb}
              onClick={() => applyMusicPreset(pr.id)}
            >
              <span className="preset-name">{pr.name}</span>
              <span className="preset-blurb">{pr.blurb}</span>
            </button>
          ))}
          {settings.musicReactivePresetId === 'custom' && (
            <div className="preset-chip active custom-tag">
              <span className="preset-name">Custom</span>
              <span className="preset-blurb">Manual / random mix</span>
            </div>
          )}
        </div>

        <label className="field check" style={{ marginTop: '0.65rem' }}>
          <input
            type="checkbox"
            checked={settings.musicReactive.enabled}
            onChange={(e) => setMusic('enabled', e.target.checked)}
          />
          <span>Enabled</span>
        </label>
        <div className={`param-stack ${settings.musicReactive.enabled ? '' : 'is-disabled'}`}>
          {MUSIC_SLIDERS.map((sl) => (
            <label key={sl.key} className="field compact">
              <span className="field-label">
                {sl.label}
                <em>{Number(settings.musicReactive[sl.key]).toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={Number(settings.musicReactive[sl.key])}
                disabled={!settings.musicReactive.enabled}
                onChange={(e) => setMusic(sl.key, Number(e.target.value) as never)}
              />
            </label>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="look-background"
        title="Background"
        defaultOpen={false}
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

        <div className={`param-stack ${bgOff ? 'is-disabled' : ''}`} style={{ marginTop: '0.75rem' }}>
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
                disabled={bgOff}
                onChange={(e) => setBg(sl.key, Number(e.target.value) as never)}
              />
            </label>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="look-particles"
        title="Particles"
        defaultOpen={false}
        actions={
          <RandomizeButton
            onClick={() =>
              onChange({
                ...settings,
                particlesEnabled: true,
                particlePresetId: 'custom',
                particles: randomizeParticles(),
              })
            }
          />
        }
      >
        <label className="field check">
          <input
            type="checkbox"
            checked={settings.particlesEnabled}
            onChange={(e) => set('particlesEnabled', e.target.checked)}
          />
          <span>Enabled</span>
        </label>

        <p className="muted small">Presets</p>
        <div className="preset-grid">
          {PARTICLE_PRESETS.filter((pr) => pr.id !== 'custom').map((pr) => (
            <button
              key={pr.id}
              type="button"
              className={`preset-chip ${settings.particlePresetId === pr.id ? 'active' : ''}`}
              title={pr.blurb}
              disabled={particlesOff}
              onClick={() => applyParticlePreset(pr.id)}
            >
              <span className="preset-name">{pr.name}</span>
              <span className="preset-blurb">{pr.blurb}</span>
            </button>
          ))}
          {settings.particlePresetId === 'custom' && (
            <div className="preset-chip active custom-tag">
              <span className="preset-name">Custom</span>
              <span className="preset-blurb">Manual / random mix</span>
            </div>
          )}
        </div>

        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Parameters
        </p>
        <div className={`param-stack ${particlesOff ? 'is-disabled' : ''}`}>
          {PARTICLE_SLIDERS.map((sl) => (
            <label key={sl.key} className="field compact">
              <span className="field-label">
                {sl.label}
                <em>{Number(p[sl.key]).toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={p[sl.key]}
                disabled={particlesOff}
                onChange={(e) => setParticle(sl.key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </CollapsiblePanel>
    </>
  );
}
