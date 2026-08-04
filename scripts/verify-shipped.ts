/**
 * Durable shipped-code checks for Lumenote goal verification.
 * Run: npx tsx scripts/verify-shipped.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tracksAffectAudio } from '../src/engine/PlaybackEngine.ts';
import { EXPORT_PRESETS } from '../src/export/VideoExporter.ts';
import { BACKGROUND_PRESETS } from '../src/theme/backgroundPresets.ts';
import {
  BUILTIN_SCENE_PRESETS,
  countBuiltInPresets,
  getBuiltInCategoryIdsInUse,
  listBuiltInCategories,
  listBuiltInsByCategory,
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
assert.match(panelSrc, /listBuiltInsByCategory/);
assert.match(panelSrc, /SCENE_CATEGORIES|categoryMeta/);

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

// ── Export 4K still present ──
assert.ok(EXPORT_PRESETS.some((p) => p.width === 3840 && p.height === 2160));

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
