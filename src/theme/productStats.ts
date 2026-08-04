/**
 * Live product counts for marketing UI.
 * Derived from the same registries the app uses, so the homepage cannot drift.
 */
import { BUILTIN_INSTRUMENTS } from '../engine/instruments';
import { EXPORT_PRESETS } from '../export/VideoExporter';
import { BACKGROUND_PRESETS } from './backgroundPresets';
import { COLOR_MODE_PRESETS, TRACK_PALETTE_PRESETS } from './colorPresets';
import { MUSIC_REACTIVE_PRESETS } from './musicReactivePresets';
import { NOTE_STYLE_PRESETS } from './notePresets';
import { PARTICLE_PRESETS } from './particlePresets';
import { BUILTIN_SCENE_PRESETS, SCENE_CATEGORIES } from './scenePresets';

export type ProductStats = {
  scenes: number;
  sceneCategories: number;
  backgrounds: number;
  particles: number;
  noteStyles: number;
  musicReactive: number;
  palettes: number;
  colorModes: number;
  instruments: number;
  exportResolutions: number;
  exportMaxLabel: string;
};

export function getProductStats(): ProductStats {
  const maxExport = EXPORT_PRESETS.reduce(
    (best, p) => (p.width * p.height > best.width * best.height ? p : best),
    EXPORT_PRESETS[0],
  );
  return {
    scenes: BUILTIN_SCENE_PRESETS.length,
    sceneCategories: SCENE_CATEGORIES.length,
    backgrounds: BACKGROUND_PRESETS.filter((p) => p.id !== 'off').length,
    particles: PARTICLE_PRESETS.filter((p) => p.id !== 'custom').length,
    noteStyles: NOTE_STYLE_PRESETS.length,
    musicReactive: MUSIC_REACTIVE_PRESETS.filter((p) => p.id !== 'off').length,
    palettes: TRACK_PALETTE_PRESETS.length,
    colorModes: COLOR_MODE_PRESETS.length,
    instruments: BUILTIN_INSTRUMENTS.filter((i) => i.id !== 'sf2').length,
    exportResolutions: EXPORT_PRESETS.length,
    exportMaxLabel: maxExport?.label ?? '4K',
  };
}
