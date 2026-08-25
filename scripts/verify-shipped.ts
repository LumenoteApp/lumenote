/**
 * Durable shipped-code checks for Lumenote goal verification.
 * Run: npx tsx scripts/verify-shipped.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AudioEngine } from '../src/engine/AudioEngine.ts';
import { tracksAffectAudio } from '../src/engine/PlaybackEngine.ts';
import {
  parseAudioPrefs,
  restoreAudioToEngine,
  serializeAudioPrefs,
} from '../src/engine/audioPrefs.ts';
import {
  parseMidiPrefs,
  serializeMidiPrefs,
} from '../src/engine/midiPrefs.ts';
import {
  MIDI_DEFAULT_BPM,
  bpmAt,
  normalizeBpm,
  scaleSongTempo,
} from '../src/midi/types.ts';
import { EXPORT_PRESETS } from '../src/export/VideoExporter.ts';
import { BACKGROUND_PRESETS } from '../src/theme/backgroundPresets.ts';
import { hydrateEffects } from '../src/theme/effects.ts';
import { hydrateVisualSettings } from '../src/theme/hydrateVisual.ts';
import { getProductStats } from '../src/theme/productStats.ts';
import {
  BUILTIN_SCENE_PRESETS,
  USER_PRESET_FILE_FORMAT,
  applySceneVisualsKeepingAudio,
  countBuiltInPresets,
  getBuiltInCategoryIdsInUse,
  hydrateSceneData,
  listBuiltInCategories,
  listBuiltInsByCategory,
  parseUserPresetsImport,
  serializeUserPresetsExport,
} from '../src/theme/scenePresets.ts';
import {
  computeStageImageDest,
  shouldPaintStageImage,
} from '../src/theme/stageImage.ts';
import type { TrackInfo } from '../src/midi/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function track(partial: Partial<TrackInfo> & Pick<TrackInfo, 'index'>): TrackInfo {
  return {
    name: 't',
    channel: 0,
    color: '#fff',
    visible: true,
    muted: false,
    noteCount: 1,
    ...partial,
  };
}

// ── Presets ≥ 24, unique ids ──
const count = countBuiltInPresets();
assert.ok(count >= 24, `expected ≥24 built-ins, got ${count}`);
const ids = new Set(BUILTIN_SCENE_PRESETS.map((p) => p.id));
assert.equal(ids.size, BUILTIN_SCENE_PRESETS.length, 'built-in ids must be unique');
for (const p of BUILTIN_SCENE_PRESETS) {
  assert.ok(p.name.trim().length > 0, `preset ${p.id} missing name`);
  assert.ok(p.settings && p.settings.background, `preset ${p.id} missing settings`);
  assert.ok(p.builtIn === true, `preset ${p.id} not marked builtIn`);
  assert.ok(p.category, `preset ${p.id} missing category`);
}

// ── Categories ──
const cats = listBuiltInCategories();
assert.ok(cats.length >= 2, 'expected multiple categories');
const inUse = getBuiltInCategoryIdsInUse();
assert.ok(inUse.length >= 2, 'expected ≥2 categories with presets');
let totalByCat = 0;
for (const id of inUse) {
  const list = listBuiltInsByCategory(id);
  assert.ok(list.length > 0, `category ${id} empty`);
  totalByCat += list.length;
}
assert.equal(totalByCat, count, 'category lists must cover all built-ins');

// ── UI groups (source structure) ──
const panelSrc = readFileSync(join(root, 'src/ui/ScenePresetPanel.tsx'), 'utf8');
assert.match(panelSrc, /scene-cat-row/);
assert.match(panelSrc, /scene-cat-select/);
assert.match(panelSrc, /listBuiltInsByCategory/);
assert.match(panelSrc, /SCENE_CATEGORIES|categoryMeta/);
assert.match(panelSrc, /parseUserPresetsImport/);
assert.match(panelSrc, /serializeUserPresetsExport/);
assert.match(panelSrc, /Import/);
assert.match(panelSrc, /Export/);
assert.match(panelSrc, /user-preset-io/);
assert.match(panelSrc, /scene-lib-tabs/);
assert.match(panelSrc, /scene-preset-scroll/);

const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8');
assert.match(appSrc, /sidebar-tabs/);
assert.match(appSrc, /sidebarTab/);
assert.match(appSrc, /sidebar-body/);
assert.match(appSrc, /VolumeControl/);
assert.match(appSrc, /onVolumeChange/);
assert.match(appSrc, /applySceneVisualsKeepingAudio/);
assert.match(appSrc, /restoreAudioToEngine/);
assert.doesNotMatch(
  appSrc,
  /playbackEngine\.setInstrument\(instrumentId\)/,
);
assert.match(appSrc, /sidebar-edge-toggle/);
assert.match(appSrc, /studioSidebarOpen|toggleSidebar/);
assert.match(
  readFileSync(join(root, 'src/ui/TransportBar.tsx'), 'utf8'),
  /MidiDock/,
);
assert.match(
  readFileSync(join(root, 'src/ui/TransportBar.tsx'), 'utf8'),
  /transport-play-row/,
);
assert.doesNotMatch(
  readFileSync(join(root, 'src/ui/MidiPanel.tsx'), 'utf8'),
  /midi-select/,
);

const collapseSrc = readFileSync(join(root, 'src/ui/CollapsiblePanel.tsx'), 'utf8');
assert.match(collapseSrc, /usePanelOpen/);
assert.match(collapseSrc, /CollapsiblePanel/);
assert.match(collapseSrc, /lumenote-sidebar-collapse-v1/);
assert.match(
  readFileSync(join(root, 'src/ui/SettingsPanel.tsx'), 'utf8'),
  /CollapsiblePanel/,
);
assert.match(
  readFileSync(join(root, 'src/ui/TransportBar.tsx'), 'utf8'),
  /VolumeControl/,
);

// ── User preset import / export (pure) ──
{
  const sample = serializeUserPresetsExport([
    {
      ...BUILTIN_SCENE_PRESETS[0]!,
      id: 'user-test-1',
      name: 'My export',
      blurb: 'test',
      builtIn: false,
      savedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const wrapped = parseUserPresetsImport(sample);
  assert.equal(wrapped.ok, true);
  if (wrapped.ok) {
    assert.equal(wrapped.presets.length, 1);
    assert.equal(wrapped.presets[0]!.name, 'My export');
    assert.equal(wrapped.presets[0]!.builtIn, false);
    assert.ok(wrapped.presets[0]!.settings.background);
  }
  const parsedFile = JSON.parse(sample) as { format: string };
  assert.equal(parsedFile.format, USER_PRESET_FILE_FORMAT);

  const bare = parseUserPresetsImport(
    JSON.stringify([
      {
        name: 'Bare',
        instrumentId: 'piano',
        volume: 0.5,
        settings: BUILTIN_SCENE_PRESETS[0]!.settings,
      },
    ]),
  );
  assert.equal(bare.ok, true);
  if (bare.ok) assert.equal(bare.presets[0]!.name, 'Bare');

  const bad = parseUserPresetsImport('{ "nope": true }');
  assert.equal(bad.ok, false);
  const junk = parseUserPresetsImport('not-json');
  assert.equal(junk.ok, false);
}

// ── New FX styles in shared registry ──
const newStyles = ['rain', 'radar', 'warp'] as const;
const bgIds = new Set(BACKGROUND_PRESETS.map((p) => p.id));
for (const s of newStyles) {
  assert.ok(bgIds.has(s), `BACKGROUND_PRESETS missing ${s}`);
}
const bgSrc = readFileSync(join(root, 'src/render/BackgroundEffects.ts'), 'utf8');
for (const s of newStyles) {
  assert.match(bgSrc, new RegExp(`style === '${s}'`));
  assert.match(bgSrc, new RegExp(`draw${s[0]!.toUpperCase()}${s.slice(1)}`));
}
// At least one built-in uses each new style
for (const s of newStyles) {
  const hit = BUILTIN_SCENE_PRESETS.some((p) => p.settings.background.style === s);
  assert.ok(hit, `no built-in preset uses background.style=${s}`);
}

// ── Tempo helpers ──
assert.equal(normalizeBpm(119.999), 120);
assert.equal(normalizeBpm(140.002), 140);
assert.equal(bpmAt([{ time: 2, bpm: 90 }], 0), MIDI_DEFAULT_BPM);
assert.equal(bpmAt([{ time: 0, bpm: 128 }, { time: 4, bpm: 140 }], 1), 128);
assert.equal(bpmAt([{ time: 0, bpm: 128 }, { time: 4, bpm: 140 }], 4), 140);
{
  const scaled = scaleSongTempo(
    {
      name: 't',
      duration: 10,
      tracks: [],
      notes: [
        {
          id: 'n0',
          pitch: 60,
          start: 2,
          duration: 1,
          velocity: 0.8,
          trackIndex: 0,
          channel: 0,
        },
      ],
      tempos: [{ time: 0, bpm: 120 }],
    },
    2,
  );
  assert.equal(scaled.duration, 5);
  assert.equal(scaled.notes[0]!.start, 1);
  assert.equal(scaled.tempos[0]!.bpm, 240);
}

// ── Export 4K still present ──
assert.ok(EXPORT_PRESETS.some((p) => p.width === 3840 && p.height === 2160));

// ── Homepage stats derive from the same registries ──
const product = getProductStats();
assert.equal(product.scenes, count);
assert.ok(product.palettes >= 8);
assert.ok(product.backgrounds >= 6);
assert.ok(product.particles >= 8);
assert.equal(product.exportMaxLabel, '4K');

// ── Combined effects hydrate from legacy particles + musicReactive ──
{
  const legacy = hydrateSceneData({
    instrumentId: 'chiptune',
    volume: 0.22,
    settings: {
      particlesEnabled: true,
      particlePresetId: 'neon',
      particles: {
        density: 1.7,
        size: 1.1,
        sizeVariance: 0.4,
        speed: 1.4,
        spread: 0.6,
        gravity: 0.2,
        drag: 0.25,
        lifetime: 0.8,
        turbulence: 0.2,
        sparkle: 0.7,
        bloom: 1.4,
        secondaryBurst: 0.8,
        trail: 0.6,
        whiteHot: 0.7,
        swirl: 0.1,
        sustainEmit: 0.2,
        hitFlash: 1,
      },
      musicReactive: {
        enabled: true,
        intensity: 1.15,
        ambient: 0.9,
        columns: 0.7,
        waves: 1.35,
        bassPulse: 1.1,
        attack: 0.95,
      },
      musicReactivePresetId: 'bass',
    } as never,
  });
  const fx = legacy.settings.effects;
  assert.ok(fx, 'hydrated scene must have combined effects');
  assert.equal(typeof fx.enabled, 'boolean');
  assert.ok(fx.sparks > 0, 'legacy hit particles become sparks');
  assert.ok(fx.ambient > 0, 'legacy ambient dust is kept');
  assert.ok(fx.streams > 0, 'legacy rising streams are kept');
  assert.ok(fx.bassPulse > 0, 'legacy bass pulse is kept');
  assert.equal(
    Object.prototype.hasOwnProperty.call(fx, 'waves'),
    false,
    'shockwave waves must not be a user-facing effects field',
  );

  const fromFxHelper = hydrateEffects({
    particlesEnabled: true,
    particles: { density: 1.2, hitFlash: 0.8 },
    musicReactive: {
      enabled: true,
      intensity: 1,
      ambient: 0.5,
      columns: 0.6,
      waves: 1.2,
      bassPulse: 0.7,
      attack: 0.8,
    },
  });
  assert.ok(fromFxHelper.effects.enabled);
  assert.equal(
    Object.prototype.hasOwnProperty.call(fromFxHelper.effects, 'waves'),
    false,
  );
}

// ── Scene load does not change caller volume / instrument ──
{
  const applied = applySceneVisualsKeepingAudio(
    {
      instrumentId: 'bass',
      volume: 0.11,
      settings: BUILTIN_SCENE_PRESETS[0]!.settings,
    },
    { volume: 0.42, instrumentId: 'chiptune' },
  );
  assert.equal(applied.volume, 0.42);
  assert.equal(applied.instrumentId, 'chiptune');
  assert.ok(applied.settings.effects);
  assert.ok(applied.settings.stageImage);
}

// ── MIDI prefs round-trip ──
{
  const json = serializeMidiPrefs({
    enableIntent: true,
    inputId: 'input-abc',
    outputId: 'output-xyz',
    thru: true,
    inputEnabled: false,
    outputPlayback: true,
  });
  const restored = parseMidiPrefs(JSON.parse(json) as unknown);
  assert.equal(restored.enableIntent, true);
  assert.equal(restored.inputId, 'input-abc');
  assert.equal(restored.outputId, 'output-xyz');
  assert.equal(restored.thru, true);
  assert.equal(restored.inputEnabled, false);
  assert.equal(restored.outputPlayback, true);
}

// ── Audio prefs round-trip (instrument id + volume; never SF2 binary) ──
{
  const json = serializeAudioPrefs({ instrumentId: 'pad', volume: 0.33 });
  const restored = parseAudioPrefs(JSON.parse(json) as unknown);
  assert.equal(restored.instrumentId, 'pad');
  assert.equal(restored.volume, 0.33);
  const sf2 = parseAudioPrefs({ instrumentId: 'sf2', volume: 0.9 });
  assert.equal(sf2.instrumentId, 'piano');
}

// Restore instrument id without starting Tone (no user gesture)
{
  const audio = new AudioEngine();
  await restoreAudioToEngine(
    { setVolume: (v) => audio.setVolume(v), audio },
    { instrumentId: 'chiptune', volume: 0.41 },
  );
  assert.equal(audio.getInstrumentId(), 'chiptune');
  assert.equal(audio.isReady(), false, 'restore must not start Web Audio / Tone');
  assert.ok(Math.abs(audio.getVolume() - 0.41) < 1e-6);
}

// ── Background image on visual settings + shared paint contract ──
{
  const visual = hydrateVisualSettings({
    stageImage: {
      enabled: true,
      src: 'data:image/png;base64,aaa',
      opacity: 0.7,
      fit: 'contain',
    },
  });
  assert.equal(visual.stageImage.enabled, true);
  assert.ok(visual.stageImage.src.startsWith('data:image/'));
  assert.equal(shouldPaintStageImage(visual.stageImage), true);
  const dest = computeStageImageDest(1920, 1080, 800, 600, 'cover');
  assert.ok(dest.dw >= 1920 - 1 || dest.dh >= 1080 - 1);
  const engineSrc = readFileSync(join(root, 'src/render/VisualizerEngine.ts'), 'utf8');
  assert.match(engineSrc, /paintUserStageImage/);
  assert.match(engineSrc, /stageImage/);
  assert.match(engineSrc, /const hitY = h - keyboardH;/);
  assert.doesNotMatch(engineSrc, /HIT_LINE_PAD/);
  const railSrc = readFileSync(join(root, 'src/render/HitRail.ts'), 'utf8');
  assert.doesNotMatch(railSrc, /Soft cloud puffs/);
  assert.doesNotMatch(railSrc, /drawElectricCloud/);
  assert.match(
    readFileSync(join(root, 'src/export/offlineBake.ts'), 'utf8'),
    /prepareStageImage/,
  );
}

// ── Look UI is one combined effects section ──
{
  const settingsSrc = readFileSync(join(root, 'src/ui/SettingsPanel.tsx'), 'utf8');
  assert.match(settingsSrc, /look-effects/);
  assert.doesNotMatch(settingsSrc, /id="look-particles"/);
  assert.doesNotMatch(settingsSrc, /id="look-music"/);
  assert.doesNotMatch(settingsSrc, /PARTICLE_SLIDERS/);
  assert.doesNotMatch(settingsSrc, /Shockwaves/);
}

for (const p of BUILTIN_SCENE_PRESETS) {
  assert.ok(p.settings.effects, `built-in ${p.id} missing combined effects`);
  assert.ok(p.settings.stageImage, `built-in ${p.id} missing stageImage`);
}

// ── Color-only track updates do not affect audio scheduling ──
const a = [track({ index: 0, color: '#4FC3F7', muted: false, visible: true })];
const colorOnly = [track({ index: 0, color: '#FF00AA', muted: false, visible: true })];
assert.equal(tracksAffectAudio(a, colorOnly), false);
const muteOnly = [track({ index: 0, color: '#4FC3F7', muted: true, visible: true })];
assert.equal(tracksAffectAudio(a, muteOnly), true);
const hideOnly = [track({ index: 0, color: '#4FC3F7', muted: false, visible: false })];
assert.equal(tracksAffectAudio(a, hideOnly), true);

console.log(
  JSON.stringify(
    {
      ok: true,
      builtInCount: count,
      categories: inUse,
      newFx: newStyles,
      export4k: true,
      colorOnlyNoReschedule: true,
    },
    null,
    2,
  ),
);
