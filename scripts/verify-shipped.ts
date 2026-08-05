/**
 * Durable shipped-code checks for Lumenote goal verification.
 * Run: npx tsx scripts/verify-shipped.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tracksAffectAudio } from '../src/engine/PlaybackEngine.ts';
import {
  MIDI_DEFAULT_BPM,
  bpmAt,
  normalizeBpm,
  scaleSongTempo,
} from '../src/midi/types.ts';
import { EXPORT_PRESETS } from '../src/export/VideoExporter.ts';
import { BACKGROUND_PRESETS } from '../src/theme/backgroundPresets.ts';
import { getProductStats } from '../src/theme/productStats.ts';
import {
  BUILTIN_SCENE_PRESETS,
  USER_PRESET_FILE_FORMAT,
  countBuiltInPresets,
  getBuiltInCategoryIdsInUse,
  listBuiltInCategories,
  listBuiltInsByCategory,
  parseUserPresetsImport,
  serializeUserPresetsExport,
} from '../src/theme/scenePresets.ts';
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

const collapseSrc = readFileSync(join(root, 'src/ui/CollapsiblePanel.tsx'), 'utf8');
assert.match(collapseSrc, /usePanelOpen/);
assert.match(collapseSrc, /CollapsiblePanel/);
assert.match(collapseSrc, /lumenote-sidebar-collapse-v1/);
assert.match(
  readFileSync(join(root, 'src/ui/SettingsPanel.tsx'), 'utf8'),
  /CollapsiblePanel/,
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
