/**
 * Falling note bar fills: solid, glass, gem, flame, crystal, outline, plasma, chrome, pixel.
 * Deterministic FX use song time so offline bake matches live.
 */
import type { NoteStyleParams } from '../midi/types';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexAlpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function mixTowardWhite(hex: string, t: number): string {
  const { r, g, b } = hexToRgb(hex);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`;
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
  if (radius <= 0.5) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Stable 0-1 noise from integers */
function hash01(a: number, b: number, c = 0): number {
  let n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

export type DrawNoteBarOpts = {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
  isActive: boolean;
  velocity: number;
  pitch: number;
  /** Song / visual time for animated inner FX */
  time: number;
  glowStrength: number;
  pulse: number;
  notes: NoteStyleParams;
};

export function drawStyledNoteBar(opts: DrawNoteBarOpts) {
  const {
    ctx,
    x,
    y,
    w,
    h,
    color,
    alpha,
    isActive,
    velocity,
    pitch,
    time,
    glowStrength,
    pulse,
    notes,
  } = opts;

  if (h < 1 || w < 1) return;

  const radius = Math.max(0, Math.min(10, notes.roundness * 8 + (notes.style === 'pixel' ? 0 : 1)));
  const borderA = notes.border * (0.35 + alpha * 0.65);
  const shine = notes.shine;
  const fx = notes.innerFx;
  const style = notes.style;

  ctx.save();

  // Outer soft glow (shared)
  if (glowStrength > 0.05) {
    ctx.shadowColor = hexAlpha(color, 0.5 * glowStrength * (isActive ? 1 + pulse * 0.4 : 1));
    ctx.shadowBlur = 16 * glowStrength * (isActive ? 1.35 + pulse * 0.5 : 1);
  } else {
    ctx.shadowBlur = 0;
  }

  // Clip to bar shape for inner FX
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  // Base fills stay bright: only lighten toward white for highlights, never darken.
  switch (style) {
    case 'outline': {
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexAlpha(color, alpha * 0.14);
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'glass': {
      // Translucent but still colorful, with a bright top edge
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, hexAlpha(mixTowardWhite(color, 0.45), alpha * 0.72));
      g.addColorStop(0.4, hexAlpha(color, alpha * 0.62));
      g.addColorStop(1, hexAlpha(mixTowardWhite(color, 0.2), alpha * 0.68));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'gem': {
      // Saturated body + bright diagonal facets (no muddy mid-tones)
      ctx.fillStyle = hexAlpha(color, alpha);
      ctx.fillRect(x, y, w, h);
      const facet = ctx.createLinearGradient(x, y, x + w, y + h);
      facet.addColorStop(0, `rgba(255,255,255,${0.38 * shine * alpha})`);
      facet.addColorStop(0.28, `rgba(255,255,255,${0.08 * shine * alpha})`);
      facet.addColorStop(0.45, 'rgba(255,255,255,0)');
      facet.addColorStop(0.62, hexAlpha(mixTowardWhite(color, 0.55), 0.35 * alpha));
      facet.addColorStop(0.78, 'rgba(255,255,255,0)');
      facet.addColorStop(1, `rgba(255,255,255,${0.22 * shine * alpha})`);
      ctx.fillStyle = facet;
      ctx.fillRect(x, y, w, h);
      // Facet lines (light only)
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * shine * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y);
      ctx.lineTo(x + w * 0.48, y + h);
      ctx.moveTo(x + w * 0.82, y);
      ctx.lineTo(x + w * 0.52, y + h);
      ctx.stroke();
      break;
    }
    case 'crystal': {
      // Clear ice: full color + bright vertical sheen
      ctx.fillStyle = hexAlpha(mixTowardWhite(color, 0.12), alpha);
      ctx.fillRect(x, y, w, h);
      const sheen = ctx.createLinearGradient(x, y, x + w, y);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.35, `rgba(255,255,255,${0.12 * shine * alpha})`);
      sheen.addColorStop(0.5, `rgba(255,255,255,${0.42 * shine * alpha})`);
      sheen.addColorStop(0.65, `rgba(255,255,255,${0.12 * shine * alpha})`);
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x, y, w, h);
      // Soft top frost
      const frost = ctx.createLinearGradient(x, y, x, y + Math.min(h * 0.4, 18));
      frost.addColorStop(0, `rgba(255,255,255,${0.28 * shine * alpha})`);
      frost.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = frost;
      ctx.fillRect(x, y, w, Math.min(h * 0.4, 18));
      break;
    }
    case 'chrome': {
      // Bright metal: color + white highlight bands (no dark strips)
      ctx.fillStyle = hexAlpha(mixTowardWhite(color, 0.18), alpha);
      ctx.fillRect(x, y, w, h);
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, `rgba(255,255,255,${0.08 * shine * alpha})`);
      g.addColorStop(0.22, `rgba(255,255,255,${0.55 * shine * alpha})`);
      g.addColorStop(0.38, `rgba(255,255,255,${0.1 * shine * alpha})`);
      g.addColorStop(0.55, hexAlpha(mixTowardWhite(color, 0.35), 0.35 * alpha));
      g.addColorStop(0.72, `rgba(255,255,255,${0.45 * shine * alpha})`);
      g.addColorStop(1, `rgba(255,255,255,${0.12 * shine * alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'pixel': {
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexAlpha(color, alpha);
      ctx.fillRect(x, y, w, h);
      // Light grid (not black)
      const cell = Math.max(3, Math.min(6, w * 0.35));
      ctx.strokeStyle = `rgba(255,255,255,${0.14 * alpha})`;
      ctx.lineWidth = 1;
      for (let py = y; py < y + h; py += cell) {
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
        ctx.stroke();
      }
      for (let px = x; px < x + w; px += cell) {
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h);
        ctx.stroke();
      }
      break;
    }
    case 'flame':
    case 'plasma':
    case 'solid':
    default: {
      // Even, vivid fill with a light top lift only
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, hexAlpha(mixTowardWhite(color, 0.18), alpha));
      g.addColorStop(0.35, hexAlpha(color, alpha));
      g.addColorStop(1, hexAlpha(mixTowardWhite(color, 0.08), alpha));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      break;
    }
  }

  // Inner animated FX
  if (fx > 0.05 && style === 'flame') {
    drawFlameInner(ctx, x, y, w, h, color, alpha, time, pitch, fx, velocity);
  } else if (fx > 0.05 && style === 'plasma') {
    drawPlasmaInner(ctx, x, y, w, h, color, alpha, time, pitch, fx);
  } else if (fx > 0.05 && (style === 'gem' || style === 'crystal')) {
    drawSparkleInner(ctx, x, y, w, h, alpha, time, pitch, fx, shine);
  } else if (fx > 0.08 && style === 'glass') {
    // Soft caustic bands
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.6 + i * 0.4 + pitch * 0.02) % 1;
      const yy = y + h * t;
      const band = ctx.createLinearGradient(x, yy - 4, x, yy + 4);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, `rgba(255,255,255,${0.08 * fx * alpha})`);
      band.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(x, yy - 4, w, 8);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Top shine strip
  if (shine > 0.05 && style !== 'outline') {
    const shineH = Math.min(h * 0.35, 10 + shine * 8);
    const sg = ctx.createLinearGradient(x, y, x, y + shineH);
    sg.addColorStop(0, `rgba(255,255,255,${0.22 * shine * alpha})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, w, shineH);
  }

  // Active hot tip
  if (isActive) {
    ctx.shadowBlur = 20 * glowStrength * (1 + pulse * 0.4);
    ctx.fillStyle = hexAlpha('#ffffff', 0.32 + pulse * 0.14);
    ctx.fillRect(x, y + h - Math.min(12, h * 0.2), w, Math.min(12, h * 0.2));
  }

  ctx.restore();

  // Border outside clip (bright edge, never muddy)
  if (borderA > 0.04) {
    ctx.save();
    ctx.shadowBlur = style === 'outline' ? 10 * glowStrength : 0;
    ctx.shadowColor = hexAlpha(color, 0.45 * glowStrength);
    roundedRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(0, radius - 0.5));
    const edgeMix =
      style === 'outline' || style === 'gem' || style === 'crystal' || style === 'chrome'
        ? 0.55
        : 0.25;
    ctx.strokeStyle = hexAlpha(mixTowardWhite(color, edgeMix), borderA * (style === 'outline' ? 0.95 : 0.8));
    ctx.lineWidth = style === 'outline' ? 1.5 + notes.border * 1.5 : 1 + notes.border * 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // Outline-only double edge
  if (style === 'outline' && shine > 0.2) {
    ctx.save();
    roundedRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(0, radius - 2));
    ctx.strokeStyle = hexAlpha('#ffffff', 0.15 * shine * alpha);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function drawFlameInner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
  time: number,
  pitch: number,
  fx: number,
  velocity: number,
) {
  ctx.globalCompositeOperation = 'lighter';
  const count = Math.max(4, Math.round(5 + fx * 10 + velocity * 4));
  for (let i = 0; i < count; i++) {
    const seed = hash01(pitch, i, 7);
    const rise = ((time * (0.7 + seed * 1.4) + seed) % 1);
    const px = x + w * (0.15 + hash01(pitch, i, 3) * 0.7);
    const py = y + h - rise * h * (0.85 + seed * 0.15);
    const size = (1.2 + seed * 2.8) * (0.6 + fx * 0.7) * (0.7 + velocity * 0.4);
    const hot = 0.35 + seed * 0.65;
    const rg = ctx.createRadialGradient(px, py, 0, px, py, size * 2.2);
    rg.addColorStop(0, `rgba(255,${Math.round(180 + hot * 75)},120,${0.35 * fx * alpha})`);
    rg.addColorStop(0.45, hexAlpha(color, 0.22 * fx * alpha));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(px, py, size * 0.7, size * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Core heat column
  const core = ctx.createLinearGradient(x, y + h, x, y);
  core.addColorStop(0, hexAlpha(mixTowardWhite(color, 0.5), 0.2 * fx * alpha));
  core.addColorStop(0.5, hexAlpha(color, 0.08 * fx * alpha));
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(x + w * 0.2, y, w * 0.6, h);
  ctx.globalCompositeOperation = 'source-over';
}

function drawPlasmaInner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
  time: number,
  pitch: number,
  fx: number,
) {
  ctx.globalCompositeOperation = 'lighter';
  const bands = Math.max(2, Math.round(2 + fx * 3));
  for (let b = 0; b < bands; b++) {
    const phase = time * (1.2 + b * 0.35) + pitch * 0.08 + b;
    ctx.beginPath();
    const mid = x + w * 0.5;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const yy = y + h * t;
      const wave = Math.sin(t * Math.PI * 3 + phase) * w * 0.28 * fx;
      const xx = mid + wave;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.strokeStyle = hexAlpha(mixTowardWhite(color, 0.4), 0.2 * fx * alpha);
    ctx.lineWidth = 1.2 + fx * 1.5;
    ctx.stroke();
  }
  // drifting orbs
  const orbs = Math.round(2 + fx * 4);
  for (let i = 0; i < orbs; i++) {
    const seed = hash01(pitch, i, 11);
    const t = (time * (0.5 + seed) + seed) % 1;
    const px = x + w * (0.2 + seed * 0.6);
    const py = y + h * t;
    const r = 1.5 + seed * 3 * fx;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
    g.addColorStop(0, `rgba(255,255,255,${0.25 * fx * alpha})`);
    g.addColorStop(0.5, hexAlpha(color, 0.18 * fx * alpha));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawSparkleInner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
  time: number,
  pitch: number,
  fx: number,
  shine: number,
) {
  ctx.globalCompositeOperation = 'lighter';
  const n = Math.max(2, Math.round(3 + fx * 5));
  for (let i = 0; i < n; i++) {
    const seed = hash01(pitch, i, 19);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * (2 + seed * 3) + seed * 6));
    const px = x + w * (0.15 + hash01(pitch, i, 2) * 0.7);
    const py = y + h * (0.1 + hash01(pitch, i, 5) * 0.8);
    const s = (1 + seed * 2.5) * (0.5 + fx * 0.6);
    const a = 0.15 * fx * shine * tw * alpha;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(px - s * 2, py);
    ctx.lineTo(px + s * 2, py);
    ctx.moveTo(px, py - s * 2);
    ctx.lineTo(px, py + s * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
