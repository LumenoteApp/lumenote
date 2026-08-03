/**
 * Deterministic visualizer frame engine.
 * Used by the live canvas (rAF) and offline video bake (fixed dt).
 */
import type { NoteEvent, Song, TrackInfo, VisualSettings } from '../midi/types';
import type { LiveNoteState } from '../engine/PlaybackEngine';
import { buildKeyRects, isBlackKey, pitchToX, whiteKeyWidth } from './keyboardLayout';
import { ParticleSystem } from './ParticleSystem';
import { BackgroundEffects } from './BackgroundEffects';
import { HitRail } from './HitRail';
import { MusicReactiveField, analyzeMusicEnergy } from './MusicReactiveField';
import { normalizeColorSettings, resolveNoteColor } from '../theme/colorPresets';

const DEFAULT_KEYBOARD_H = 200;
const MIN_KEYBOARD_H = 100;
const MAX_KEYBOARD_H = 280;
const HIT_LINE_PAD = 10;

export function resolveKeyboardH(settings: VisualSettings): number {
  if (!settings.showKeyboard) return 28;
  const h = Number(settings.keyboardHeight);
  if (!Number.isFinite(h)) return DEFAULT_KEYBOARD_H;
  return Math.max(MIN_KEYBOARD_H, Math.min(MAX_KEYBOARD_H, h));
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export type FrameInput = {
  song: Song | null;
  tracks: TrackInfo[];
  settings: VisualSettings;
  /** Song position in seconds */
  time: number;
  /** Fixed or wall dt */
  dt: number;
  /**
   * Previous frame song time — used in bake mode to fire hits for notes
   * that started in (prevTime, time].
   */
  prevTime: number;
  /** When true, scan song notes for hits (offline bake). Live mode uses noteHit(). */
  processSongHits: boolean;
  liveHeld?: ReadonlyMap<number, LiveNoteState>;
  liveVisual?: readonly LiveNoteState[];
  /** performance.now() for live rising notes; ignored in bake if no live visual */
  wallNow?: number;
  showEmptyHint?: boolean;
};

export class VisualizerEngine {
  private particles = new ParticleSystem();
  private background = new BackgroundEffects();
  private hitRail = new HitRail();
  private musicField = new MusicReactiveField();
  private onsetAcc = 0;
  private bgStyle = '';
  private hitCursor = 0;

  reset() {
    this.particles.clear();
    this.hitRail.clear();
    this.musicField.clear();
    this.onsetAcc = 0;
    this.hitCursor = 0;
    this.bgStyle = '';
    this.background = new BackgroundEffects();
  }

  /** Force background reseed (e.g. after canvas resize). */
  reseatBackground() {
    this.background = new BackgroundEffects();
    this.bgStyle = '';
  }

  /**
   * Live playback: call when PlaybackEngine fires onNoteHit.
   */
  noteHit(
    note: NoteEvent,
    w: number,
    h: number,
    settings: VisualSettings,
    tracks: TrackInfo[],
    songTime: number,
  ) {
    const track = tracks.find((t) => t.index === note.trackIndex);
    if (track && !track.visible) return;
    const trackColor = track?.color ?? '#4FC3F7';
    const keyboardH = resolveKeyboardH(settings);
    const hitY = h - keyboardH - HIT_LINE_PAD;
    const x = pitchToX(note.pitch, w);
    const color = resolveNoteColor({
      trackColor,
      pitch: note.pitch,
      time: songTime,
      noteStart: note.start,
      settings: normalizeColorSettings(settings.colors),
    });

    this.onsetAcc = Math.min(1.5, this.onsetAcc + 0.15 + note.velocity * 0.35);

    if (settings.showHitRail) {
      this.hitRail.hit(x, color, note.velocity);
    }
    if (settings.particlesEnabled) {
      this.particles.spawn(x, hitY, color, note.velocity, settings.particles);
    }
  }

  /**
   * Advance systems and paint one frame into ctx (logical size w×h).
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, input: FrameInput) {
    const {
      song: currentSong,
      tracks: currentTracks,
      settings: s,
      time,
      dt: rawDt,
      prevTime,
      processSongHits,
      liveHeld,
      liveVisual,
      wallNow = 0,
      showEmptyHint = true,
    } = input;
    const dt = Math.min(0.05, Math.max(0, rawDt));
    const particleParams = s.particles;
    const bgParams = s.background;
    const keyboardH = resolveKeyboardH(s);
    const hitY = h - keyboardH - HIT_LINE_PAD;
    const pps = s.pixelsPerSecond;

    // Offline: fire hits for notes that crossed the playhead this step
    if (processSongHits && currentSong) {
      const muted = new Set(
        currentTracks.filter((t) => t.muted || !t.visible).map((t) => t.index),
      );
      // Keep cursor monotonic for bake from 0→end
      while (
        this.hitCursor < currentSong.notes.length &&
        currentSong.notes[this.hitCursor].start <= time
      ) {
        const n = currentSong.notes[this.hitCursor];
        if (
          !muted.has(n.trackIndex) &&
          n.start > prevTime - 0.0001 &&
          n.start <= time + 0.0001
        ) {
          this.noteHit(n, w, h, s, currentTracks, time);
        }
        this.hitCursor++;
      }
    }

    if (this.bgStyle !== bgParams.style) {
      this.background.rebuild(bgParams);
      this.bgStyle = bgParams.style;
    }

    const baseTrackColor = (index: number) =>
      currentTracks.find((t) => t.index === index)?.color ?? '#fff';
    const trackVisible = (index: number) =>
      currentTracks.find((t) => t.index === index)?.visible !== false;
    const colorSettings = normalizeColorSettings(s.colors);
    const noteColor = (trackIndex: number, pitch: number, noteStart: number) =>
      resolveNoteColor({
        trackColor: baseTrackColor(trackIndex),
        pitch,
        time,
        noteStart,
        settings: colorSettings,
      });

    const activeKeys = new Map<number, { color: string; velocity: number }>();

    if (currentSong) {
      for (const note of currentSong.notes) {
        if (!trackVisible(note.trackIndex)) continue;
        const end = note.start + note.duration;
        if (note.start <= time && end > time) {
          const color = noteColor(note.trackIndex, note.pitch, note.start);
          const prev = activeKeys.get(note.pitch);
          if (!prev || note.velocity > prev.velocity) {
            activeKeys.set(note.pitch, { color, velocity: note.velocity });
          }
        }
      }
    }

    const liveTrackIdx = currentTracks[0]?.index ?? 0;
    if (liveHeld && liveHeld.size > 0) {
      for (const [pitch, live] of liveHeld) {
        const color = noteColor(liveTrackIdx, pitch, live.wallStart / 1000);
        const prev = activeKeys.get(pitch);
        if (!prev || live.velocity > prev.velocity) {
          activeKeys.set(pitch, { color, velocity: live.velocity });
        }
      }
    }

    const activeList = [...activeKeys.entries()].map(([pitch, info]) => ({
      pitch,
      x: pitchToX(pitch, w),
      color: info.color,
      velocity: info.velocity,
    }));
    const bands = analyzeMusicEnergy(activeList);
    const onset = this.onsetAcc;
    this.onsetAcc = Math.max(0, this.onsetAcc - dt * 3.5);

    const energy = Math.min(
      1,
      bands.total * 0.75 + Math.min(1, onset) * 0.45 + this.musicField.getPulse() * 0.2,
    );

    const colors =
      colorSettings.mode === 'track'
        ? currentTracks.filter((t) => t.visible).map((t) => t.color)
        : [36, 48, 60, 72, 84].map((pitch) =>
            resolveNoteColor({
              trackColor: baseTrackColor(0),
              pitch,
              time,
              settings: colorSettings,
            }),
          );
    const bgEnergy = Math.min(
      1,
      energy * (0.5 + bgParams.reactive * 0.7) + this.musicField.getBassKick() * 0.35,
    );
    this.background.update(dt, bgEnergy, bgParams);
    this.background.draw(ctx, w, h, s.backgroundColor, colors, bgParams);

    this.musicField.resize(w, h, hitY);
    this.musicField.update(dt, bands, activeList, onset, s.musicReactive, colors);
    this.musicField.draw(ctx, s.musicReactive);

    const pulse = this.musicField.getPulse();
    const bass = this.musicField.getBassKick();

    const drawNoteBar = (
      pitch: number,
      velocity: number,
      color: string,
      yTop: number,
      yBottom: number,
      isActive: boolean,
    ) => {
      const noteH = yBottom - yTop;
      if (noteH < 1) return;
      if (yTop > hitY + 20 || yBottom < -20) return;

      const keyW = isBlackKey(pitch) ? whiteKeyWidth(w) * 0.55 : whiteKeyWidth(w) * 0.88;
      const xCenter = pitchToX(pitch, w);
      const reactiveBoost = s.musicReactive.enabled
        ? 1 + pulse * 0.12 + (isActive ? bass * 0.08 : 0)
        : 1;
      const alpha = s.noteOpacity * (0.55 + velocity * 0.45);

      if (s.glowStrength > 0.05) {
        ctx.shadowColor = hexAlpha(
          color,
          0.55 * s.glowStrength * (isActive ? 1 + pulse * 0.4 : 1),
        );
        ctx.shadowBlur =
          18 * s.glowStrength * (isActive ? 1.4 + pulse * 0.6 : 1) * reactiveBoost;
      } else {
        ctx.shadowBlur = 0;
      }

      const drawW = keyW * (isActive ? reactiveBoost : 1);
      const drawX = xCenter - drawW / 2;
      const grad = ctx.createLinearGradient(drawX, yTop, drawX, yBottom);
      grad.addColorStop(0, hexAlpha(color, alpha * 0.75));
      grad.addColorStop(0.5, hexAlpha(color, alpha));
      grad.addColorStop(1, hexAlpha(color, alpha * 0.9));
      ctx.fillStyle = grad;
      roundedRect(ctx, drawX, yTop, drawW, noteH, 5);
      ctx.fill();

      if (isActive) {
        ctx.shadowBlur = 24 * s.glowStrength * (1 + pulse * 0.5);
        ctx.fillStyle = hexAlpha('#ffffff', 0.35 + pulse * 0.15);
        roundedRect(ctx, drawX, yBottom - 10, drawW, 10, 4);
        ctx.fill();
      }
    };

    ctx.save();
    if (currentSong) {
      const lookAhead = (hitY + 40) / pps + 0.5;
      const lookBehind = keyboardH / pps + 2;

      for (const note of currentSong.notes) {
        if (!trackVisible(note.trackIndex)) continue;
        const end = note.start + note.duration;
        if (end < time - lookBehind || note.start > time + lookAhead) continue;

        const color = noteColor(note.trackIndex, note.pitch, note.start);
        const noteH = Math.max(6, note.duration * pps);
        const yBottom = hitY - (note.start - time) * pps;
        const yTop = yBottom - noteH;
        const isActive = note.start <= time && end > time;
        drawNoteBar(note.pitch, note.velocity, color, yTop, yBottom, isActive);
      }
    }

    if (liveVisual && liveVisual.length > 0) {
      for (const note of liveVisual) {
        const isHeld = note.wallEnd === null;
        const durationSec = Math.max(
          0.03,
          ((isHeld ? wallNow : note.wallEnd!) - note.wallStart) / 1000,
        );
        const releaseAgeSec = isHeld ? 0 : (wallNow - note.wallEnd!) / 1000;
        const noteH = Math.max(6, durationSec * pps);
        const yBottom = hitY - releaseAgeSec * pps;
        const yTop = yBottom - noteH;
        if (yBottom < -20) continue;

        const color = noteColor(liveTrackIdx, note.pitch, note.wallStart / 1000);
        drawNoteBar(note.pitch, note.velocity, color, yTop, yBottom, isHeld);
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    this.hitRail.update(dt);
    if (s.showHitRail) {
      const activeRail = [...activeKeys.entries()].map(([pitch, info]) => ({
        x: pitchToX(pitch, w),
        color: info.color,
        velocity: info.velocity,
      }));
      this.hitRail.draw(ctx, w, hitY, activeRail, s.hitRailIntensity);
    }

    if (s.particlesEnabled && particleParams.sustainEmit > 0 && activeKeys.size > 0) {
      for (const [pitch, info] of activeKeys) {
        const x = pitchToX(pitch, w);
        this.particles.emitSustain(x, hitY, info.color, info.velocity, particleParams, dt);
      }
    }

    if (s.particlesEnabled) {
      this.particles.update(dt, particleParams);
      this.particles.draw(ctx, particleParams);
    }

    if (s.showKeyboard) {
      const keys = buildKeyRects(w);
      const ky = h - keyboardH;

      ctx.fillStyle = '#10121a';
      ctx.fillRect(0, ky, w, keyboardH);

      const edge = ctx.createLinearGradient(0, ky, 0, ky + 8);
      edge.addColorStop(0, 'rgba(255,255,255,0.08)');
      edge.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = edge;
      ctx.fillRect(0, ky, w, 8);

      for (const key of keys) {
        if (key.isBlack) continue;
        const pressed = activeKeys.get(key.midi);
        ctx.fillStyle = pressed ? hexAlpha(pressed.color, 0.88) : '#f2f2f5';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        roundedRect(ctx, key.x + 0.5, ky + 3, key.w - 1, keyboardH - 8, 4);
        ctx.fill();
        ctx.stroke();
        if (pressed) {
          ctx.fillStyle = hexAlpha(pressed.color, 0.3);
          ctx.fillRect(key.x, ky, key.w, 5);
        }
      }
      for (const key of keys) {
        if (!key.isBlack) continue;
        const pressed = activeKeys.get(key.midi);
        const bh = keyboardH * 0.62;
        ctx.fillStyle = pressed ? hexAlpha(pressed.color, 0.95) : '#1a1c24';
        roundedRect(ctx, key.x, ky + 3, key.w, bh, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.stroke();
      }
    }

    const liveEmpty = !liveHeld?.size && !(liveVisual && liveVisual.length > 0);
    if (showEmptyHint && !currentSong && liveEmpty) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Drop a MIDI file or click Open', w / 2, h / 2 - 10);
      ctx.font = '400 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText(
        'Or enable Live MIDI in the sidebar and play a keyboard',
        w / 2,
        h / 2 + 16,
      );
    }
  }
}
