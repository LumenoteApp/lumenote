import type { BackgroundParams } from '../midi/types';

type Star = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  speed: number;
};

type Orb = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  hueShift: number;
};

type Beam = {
  x: number;
  width: number;
  phase: number;
  speed: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Atmospheric background: stars, soft orbs, aurora bands, light beams.
 * `energy` (0–1) is musical activity so the scene reacts to notes.
 */
export class BackgroundEffects {
  private stars: Star[] = [];
  private orbs: Orb[] = [];
  private beams: Beam[] = [];
  private w = 0;
  private h = 0;
  private time = 0;
  private energySmooth = 0;
  private seeded = false;

  ensureLayout(w: number, h: number, params: BackgroundParams) {
    if (this.seeded && Math.abs(this.w - w) < 2 && Math.abs(this.h - h) < 2) return;
    this.w = w;
    this.h = h;
    this.seeded = true;
    this.rebuild(params);
  }

  rebuild(params: BackgroundParams) {
    const starCount = Math.round(40 + params.stars * 120);
    this.stars = [];
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.92,
        z: 0.3 + Math.random() * 0.7,
        size: 0.4 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.6,
      });
    }

    const orbCount = Math.round(2 + params.orbs * 5);
    this.orbs = [];
    for (let i = 0; i < orbCount; i++) {
      this.orbs.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.7,
        r: 80 + Math.random() * 160,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
        hueShift: Math.random(),
      });
    }

    const beamCount = Math.round(params.beams * 6);
    this.beams = [];
    for (let i = 0; i < beamCount; i++) {
      this.beams.push({
        x: Math.random() * this.w,
        width: 40 + Math.random() * 90,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.35,
      });
    }
  }

  update(dt: number, energy: number, params: BackgroundParams) {
    this.time += dt;
    this.energySmooth += (energy - this.energySmooth) * Math.min(1, dt * 4);

    const parallax = 8 + params.parallax * 40;
    for (const s of this.stars) {
      s.phase += dt * s.speed;
      s.y += dt * parallax * s.z * 0.15 * (0.3 + this.energySmooth);
      if (s.y > this.h) {
        s.y = -4;
        s.x = Math.random() * this.w;
      }
    }

    for (const o of this.orbs) {
      o.phase += dt * (0.2 + this.energySmooth * 0.5);
      o.x += o.vx * dt * (0.5 + params.parallax);
      o.y += o.vy * dt * (0.5 + params.parallax);
      o.x += Math.sin(o.phase) * 6 * dt;
      o.y += Math.cos(o.phase * 0.7) * 4 * dt;
      if (o.x < -o.r) o.x = this.w + o.r;
      if (o.x > this.w + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = this.h * 0.75;
      if (o.y > this.h * 0.85) o.y = -o.r * 0.3;
    }

    for (const b of this.beams) {
      b.phase += dt * b.speed;
      b.x += Math.sin(b.phase) * 20 * dt;
      if (b.x < -b.width) b.x = this.w + b.width;
      if (b.x > this.w + b.width) b.x = -b.width;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    baseColor: string,
    trackColors: string[],
    params: BackgroundParams,
  ) {
    if (!params.enabled) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, baseColor);
      bg.addColorStop(1, '#0a0c12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    this.ensureLayout(w, h, params);
    const intensity = params.intensity;
    const energy = this.energySmooth * params.reactive;
    const style = params.style;
    const base = hexToRgb(baseColor);
    const palette =
      trackColors.length > 0
        ? trackColors.map(hexToRgb)
        : [
            { r: 79, g: 195, b: 247 },
            { r: 244, g: 143, b: 177 },
            { r: 206, g: 147, b: 216 },
          ];

    // Base fill
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, baseColor);
    bg.addColorStop(0.55, `rgb(${Math.max(0, base.r - 2)},${Math.max(0, base.g - 1)},${Math.max(0, base.b + 4)})`);
    bg.addColorStop(1, '#05060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Style-specific layers
    if (style === 'nebula' || style === 'aurora' || style === 'pulse') {
      this.drawOrbs(ctx, palette, intensity, energy, style);
    }

    if (style === 'aurora' || style === 'nebula') {
      this.drawAurora(ctx, w, h, palette, intensity, energy, params.waves);
    }

    if (style === 'starfield' || style === 'nebula' || style === 'void') {
      this.drawStars(ctx, intensity, energy, style === 'void' ? 0.45 : 1);
    }

    if (style === 'pulse' || style === 'nebula') {
      this.drawBeams(ctx, h, palette, intensity, energy);
    }

    if (style === 'grid') {
      this.drawGrid(ctx, w, h, palette, intensity, energy);
      this.drawStars(ctx, intensity * 0.5, energy, 0.6);
    }

    // Always a soft floor glow near the keyboard (music reactive)
    this.drawFloorGlow(ctx, w, h, palette, intensity, energy);

    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.08, w / 2, h * 0.5, w * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${0.35 + intensity * 0.15})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  private drawStars(ctx: CanvasRenderingContext2D, intensity: number, energy: number, mul: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase * 2.2));
      const a = tw * intensity * mul * (0.25 + energy * 0.35 + s.z * 0.4);
      const size = s.size * (0.7 + energy * 0.4);
      ctx.fillStyle = `rgba(220,230,255,${clamp01(a)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
      ctx.fill();
      // occasional cross sparkle
      if (s.z > 0.75 && tw > 0.85) {
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - size * 3, s.y);
        ctx.lineTo(s.x + size * 3, s.y);
        ctx.moveTo(s.x, s.y - size * 3);
        ctx.lineTo(s.x, s.y + size * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawOrbs(
    ctx: CanvasRenderingContext2D,
    palette: { r: number; g: number; b: number }[],
    intensity: number,
    energy: number,
    style: string,
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      const c = palette[i % palette.length];
      const pulse = 1 + Math.sin(o.phase) * 0.12 + energy * 0.2;
      const radius = o.r * pulse;
      const alpha = intensity * (style === 'pulse' ? 0.18 : 0.12) * (0.55 + energy * 0.7);
      const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, radius);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${alpha})`);
      grad.addColorStop(0.45, `rgba(${c.r},${c.g},${c.b},${alpha * 0.35})`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(o.x, o.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAurora(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: { r: number; g: number; b: number }[],
    intensity: number,
    energy: number,
    waves: number,
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bands = Math.max(1, Math.round(1 + waves * 3));
    for (let b = 0; b < bands; b++) {
      const c = palette[b % palette.length];
      const baseY = h * (0.18 + b * 0.12);
      const amp = (18 + waves * 40) * (0.6 + energy * 0.8);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y =
          baseY +
          Math.sin(x * 0.008 + this.time * (0.4 + b * 0.15) + b) * amp +
          Math.sin(x * 0.02 - this.time * 0.6 + b * 2) * amp * 0.35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // close band downward
      for (let x = w; x >= 0; x -= 8) {
        const y =
          baseY +
          28 +
          Math.sin(x * 0.008 + this.time * (0.4 + b * 0.15) + b) * amp * 0.6;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const alpha = intensity * 0.08 * (0.5 + energy);
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBeams(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: { r: number; g: number; b: number }[],
    intensity: number,
    energy: number,
  ) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const c = palette[i % palette.length];
      const a = intensity * 0.06 * (0.4 + energy * 1.2) * (0.6 + 0.4 * Math.sin(b.phase * 2));
      const grad = ctx.createLinearGradient(b.x, 0, b.x + b.width, 0);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0)`);
      grad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${a})`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(b.x, 0, b.width, h * 0.85);
    }
    ctx.restore();
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: { r: number; g: number; b: number }[],
    intensity: number,
    energy: number,
  ) {
    const c = palette[0];
    const a = intensity * 0.08 * (0.35 + energy * 0.5);
    ctx.save();
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
    ctx.lineWidth = 1;
    const spacing = 48;
    const scroll = (this.time * (12 + energy * 40)) % spacing;
    for (let y = h * 0.15; y < h * 0.9; y += spacing) {
      const yy = y + scroll * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.15);
      ctx.lineTo(x, h * 0.9);
      ctx.stroke();
    }
    // horizon glow
    const horizon = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.85);
    horizon.addColorStop(0, 'rgba(0,0,0,0)');
    horizon.addColorStop(1, `rgba(${c.r},${c.g},${c.b},${intensity * 0.12 * (0.4 + energy)})`);
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.55, w, h * 0.3);
    ctx.restore();
  }

  private drawFloorGlow(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: { r: number; g: number; b: number }[],
    intensity: number,
    energy: number,
  ) {
    if (energy < 0.02 && intensity < 0.2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const c0 = palette[0];
    const c1 = palette[1 % palette.length];
    const y = h * 0.72;
    const grad = ctx.createLinearGradient(0, y, 0, h);
    const a = intensity * 0.15 * (0.2 + energy);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, `rgba(${c0.r},${c0.g},${c0.b},${a * 0.5})`);
    grad.addColorStop(1, `rgba(${c1.r},${c1.g},${c1.b},${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, h - y);
    ctx.restore();
  }
}
