import { useEffect, useRef } from 'react';
import type { NoteEvent, Song, TrackInfo, VisualSettings } from '../midi/types';
import { playbackEngine } from '../engine/PlaybackEngine';
import { buildKeyRects, isBlackKey, pitchToX, whiteKeyWidth } from './keyboardLayout';
import { ParticleSystem } from './ParticleSystem';
import { BackgroundEffects } from './BackgroundEffects';
import { HitRail } from './HitRail';
import { MusicReactiveField, analyzeMusicEnergy } from './MusicReactiveField';
import { normalizeColorSettings, resolveNoteColor } from '../theme/colorPresets';

type Props = {
  song: Song | null;
  tracks: TrackInfo[];
  settings: VisualSettings;
  seekTime: number;
  playing: boolean;
};

/** ~1.7× original 96px height */
const KEYBOARD_H = 163;
const HIT_LINE_PAD = 10;

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

export function VisualizerCanvas({ song, tracks, settings, seekTime, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef(new ParticleSystem());
  const backgroundRef = useRef(new BackgroundEffects());
  const hitRailRef = useRef(new HitRail());
  const musicFieldRef = useRef(new MusicReactiveField());
  const onsetAccRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const tracksRef = useRef(tracks);
  const settingsRef = useRef(settings);
  const songRef = useRef(song);
  const seekTimeRef = useRef(seekTime);
  const playingRef = useRef(playing);
  const bgStyleRef = useRef<string>(settings.background.style);

  tracksRef.current = tracks;
  settingsRef.current = settings;
  songRef.current = song;
  seekTimeRef.current = seekTime;
  playingRef.current = playing;

  useEffect(() => {
    const particles = particlesRef.current;
    const hitRail = hitRailRef.current;
    playbackEngine.setOnNoteHit((note: NoteEvent) => {
      const canvas = canvasRef.current;
      const s = settingsRef.current;
      if (!canvas) return;
      const track = tracksRef.current.find((t) => t.index === note.trackIndex);
      if (!track || !track.visible) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const keyboardH = s.showKeyboard ? KEYBOARD_H : 28;
      const hitY = h - keyboardH - HIT_LINE_PAD;
      const x = pitchToX(note.pitch, w);
      const color = resolveNoteColor({
        trackColor: track.color,
        pitch: note.pitch,
        time: playbackEngine.getTime(),
        noteStart: note.start,
        settings: normalizeColorSettings(s.colors),
      });

      // Accumulate onset energy for music-reactive field (consumed each frame)
      onsetAccRef.current = Math.min(1.5, onsetAccRef.current + 0.15 + note.velocity * 0.35);

      if (s.showHitRail) {
        hitRail.hit(x, color, note.velocity);
      }
      if (s.particlesEnabled) {
        particles.spawn(x, hitY, color, note.velocity, s.particles);
      }
    });
    return () => playbackEngine.setOnNoteHit(null);
  }, []);

  useEffect(() => {
    particlesRef.current.clear();
    hitRailRef.current.clear();
    musicFieldRef.current.clear();
    onsetAccRef.current = 0;
  }, [song]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // force bg reseed
      backgroundRef.current = new BackgroundEffects();
      bgStyleRef.current = '';
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const draw = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      const s = settingsRef.current;
      const particleParams = s.particles;
      const bgParams = s.background;
      const currentSong = songRef.current;
      const currentTracks = tracksRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const keyboardH = s.showKeyboard ? KEYBOARD_H : 28;
      const hitY = h - keyboardH - HIT_LINE_PAD;
      const pps = s.pixelsPerSecond;

      const isPlaying = playingRef.current;
      const time = isPlaying ? playbackEngine.getTime() : seekTimeRef.current;
      if (isPlaying) playbackEngine.tickHits();

      if (bgStyleRef.current !== bgParams.style) {
        backgroundRef.current.rebuild(bgParams);
        bgStyleRef.current = bgParams.style;
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

      // Pre-scan active keys for energy (used by bg)
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

      const activeList = [...activeKeys.entries()].map(([pitch, info]) => ({
        pitch,
        x: pitchToX(pitch, w),
        color: info.color,
        velocity: info.velocity,
      }));
      const bands = analyzeMusicEnergy(activeList);
      const onset = onsetAccRef.current;
      onsetAccRef.current = Math.max(0, onsetAccRef.current - dt * 3.5);

      // Combine held-note energy + recent hits for stronger reactivity
      const energy = Math.min(
        1,
        bands.total * 0.75 + Math.min(1, onset) * 0.45 + musicFieldRef.current.getPulse() * 0.2,
      );

      // Dynamic palette sample for bg / ambient (follows RGB modes)
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
        energy * (0.5 + bgParams.reactive * 0.7) + musicFieldRef.current.getBassKick() * 0.35,
      );
      backgroundRef.current.update(dt, bgEnergy, bgParams);
      backgroundRef.current.draw(ctx, w, h, s.backgroundColor, colors, bgParams);

      // Music-reactive ambient particle animation (behind notes)
      musicFieldRef.current.resize(w, h, hitY);
      musicFieldRef.current.update(dt, bands, activeList, onset, s.musicReactive, colors);
      musicFieldRef.current.draw(ctx, s.musicReactive);

      // Notes
      if (currentSong) {
        const lookAhead = (hitY + 40) / pps + 0.5;
        const lookBehind = keyboardH / pps + 2;

        ctx.save();
        for (const note of currentSong.notes) {
          if (!trackVisible(note.trackIndex)) continue;
          const end = note.start + note.duration;
          if (end < time - lookBehind || note.start > time + lookAhead) continue;

          const color = noteColor(note.trackIndex, note.pitch, note.start);
          const xCenter = pitchToX(note.pitch, w);
          const keyW = isBlackKey(note.pitch)
            ? whiteKeyWidth(w) * 0.55
            : whiteKeyWidth(w) * 0.88;
          const noteH = Math.max(6, note.duration * pps);
          const yBottom = hitY - (note.start - time) * pps;
          const yTop = yBottom - noteH;

          if (yTop > hitY + 20 || yBottom < -20) continue;

          const isActive = note.start <= time && end > time;
          const pulse = musicFieldRef.current.getPulse();
          const bass = musicFieldRef.current.getBassKick();
          const reactiveBoost = s.musicReactive.enabled
            ? 1 + pulse * 0.12 + (isActive ? bass * 0.08 : 0)
            : 1;
          const alpha = s.noteOpacity * (0.55 + note.velocity * 0.45);

          if (s.glowStrength > 0.05) {
            ctx.shadowColor = hexAlpha(color, 0.55 * s.glowStrength * (isActive ? 1 + pulse * 0.4 : 1));
            ctx.shadowBlur = 18 * s.glowStrength * (isActive ? 1.4 + pulse * 0.6 : 1) * reactiveBoost;
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
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Reactive impact rail (replaces dead white line)
      hitRailRef.current.update(dt);
      if (s.showHitRail) {
        const activeRail = [...activeKeys.entries()].map(([pitch, info]) => ({
          x: pitchToX(pitch, w),
          color: info.color,
          velocity: info.velocity,
        }));
        hitRailRef.current.draw(ctx, w, hitY, activeRail, s.hitRailIntensity);
      }

      // Sustain particles while keys held
      if (s.particlesEnabled && isPlaying && particleParams.sustainEmit > 0) {
        for (const [pitch, info] of activeKeys) {
          const x = pitchToX(pitch, w);
          particlesRef.current.emitSustain(
            x,
            hitY,
            info.color,
            info.velocity,
            particleParams,
            dt,
          );
        }
      }

      if (s.particlesEnabled) {
        particlesRef.current.update(dt, particleParams);
        particlesRef.current.draw(ctx, particleParams);
      }

      // Keyboard
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

      if (!currentSong) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Drop a MIDI file or click Open', w / 2, h / 2 - 10);
        ctx.font = '400 13px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillText('Multi-track files get separate colors for each hand/track', w / 2, h / 2 + 16);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="visualizer-canvas" />;
}
