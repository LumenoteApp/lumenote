/**
 * Reactive impact rail - where notes meet the keyboard.
 * Styles: soft, electric, wave, shock, spark, laser, storm, aurora.
 */

import type { HitRailStyleId } from '../midi/types';

export type RailBloom = {
  x: number;
  r: number;
  g: number;
  b: number;
  strength: number;
  life: number;
  maxLife: number;
  width: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hash01(a: number, b: number, c = 0): number {
  let n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

export class HitRail {
  private blooms: RailBloom[] = [];
  private pulse = 0;
  private time = 0;

  /** Call when a note hits the rail */
  hit(x: number, color: string, velocity: number) {
    const { r, g, b } = hexToRgb(color);
    this.blooms.push({
      x,
      r,
      g,
      b,
      strength: 0.55 + velocity * 0.7,
      life: 0.45 + velocity * 0.35,
      maxLife: 0.45 + velocity * 0.35,
      width: 28 + velocity * 50,
    });
    this.pulse = Math.min(1, this.pulse + 0.25 + velocity * 0.35);
    if (this.blooms.length > 64) this.blooms.shift();
  }

  update(dt: number) {
    this.time += dt;
    this.pulse = Math.max(0, this.pulse - dt * 1.8);
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      this.blooms[i].life -= dt;
      if (this.blooms[i].life <= 0) this.blooms.splice(i, 1);
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitY: number,
    active: { x: number; color: string; velocity: number }[],
    intensity = 1,
    style: HitRailStyleId = 'soft',
    energy = 0.55,
  ) {
    if (intensity <= 0.01) return;

    const e = Math.max(0, Math.min(1.4, energy));
    ctx.save();

    // Base band (varies by style)
    this.drawBase(ctx, w, hitY, intensity, style, e);

    ctx.globalCompositeOperation = 'lighter';

    // Style-specific ambient FX along the rail
    if (style === 'electric' || style === 'storm') {
      this.drawElectricCloud(ctx, w, hitY, intensity, e, style === 'storm');
    }
    if (style === 'wave' || style === 'aurora') {
      this.drawWaveBand(ctx, w, hitY, intensity, e, style === 'aurora', active);
    }
    if (style === 'laser') {
      this.drawLaserCore(ctx, w, hitY, intensity, e);
    }

    // Active key glows
    for (const a of active) {
      this.drawActive(ctx, a, hitY, intensity, style, e);
    }

    // Hit blooms + style extras on blooms
    for (const bloom of this.blooms) {
      this.drawBloom(ctx, bloom, hitY, intensity, style, e);
    }

    // Extra sparks along active + blooms
    if (style === 'spark' || (style === 'electric' && e > 0.4)) {
      this.drawSparks(ctx, w, hitY, active, intensity, e, style === 'electric');
    }

    ctx.restore();
  }

  private drawBase(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitY: number,
    intensity: number,
    style: HitRailStyleId,
    e: number,
  ) {
    const thick =
      style === 'laser' ? 6 + e * 4 : style === 'storm' ? 18 + e * 10 : 14 + e * 6;
    const baseA =
      style === 'laser'
        ? (0.12 + this.pulse * 0.25) * intensity
        : (0.06 + this.pulse * 0.12) * intensity * (0.85 + e * 0.2);

    const band = ctx.createLinearGradient(0, hitY - thick, 0, hitY + thick);
    if (style === 'aurora') {
      band.addColorStop(0, 'rgba(120,200,255,0)');
      band.addColorStop(0.4, `rgba(120,220,255,${baseA * 0.45})`);
      band.addColorStop(0.5, `rgba(200,160,255,${baseA * 0.85})`);
      band.addColorStop(0.6, `rgba(120,255,200,${baseA * 0.4})`);
      band.addColorStop(1, 'rgba(255,255,255,0)');
    } else if (style === 'laser') {
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.45, `rgba(180,220,255,${baseA * 0.5})`);
      band.addColorStop(0.5, `rgba(255,255,255,${baseA * 1.4})`);
      band.addColorStop(0.55, `rgba(180,220,255,${baseA * 0.5})`);
      band.addColorStop(1, 'rgba(255,255,255,0)');
    } else if (style === 'storm' || style === 'electric') {
      band.addColorStop(0, 'rgba(140,180,255,0)');
      band.addColorStop(0.4, `rgba(140,190,255,${baseA * 0.5})`);
      band.addColorStop(0.5, `rgba(220,235,255,${baseA * 1.1})`);
      band.addColorStop(0.6, `rgba(140,190,255,${baseA * 0.5})`);
      band.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.45, `rgba(200,210,255,${baseA * 0.35})`);
      band.addColorStop(0.5, `rgba(255,255,255,${baseA})`);
      band.addColorStop(0.55, `rgba(200,210,255,${baseA * 0.35})`);
      band.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = band;
    ctx.fillRect(0, hitY - thick, w, thick * 2);

    // Hairline core
    const coreA =
      style === 'laser'
        ? (0.35 + this.pulse * 0.45) * intensity
        : (0.08 + this.pulse * 0.2) * intensity;
    ctx.strokeStyle = `rgba(255,255,255,${coreA})`;
    ctx.lineWidth = style === 'laser' ? 1.5 + e * 0.8 : 1;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
  }

  private drawLaserCore(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitY: number,
    intensity: number,
    e: number,
  ) {
    const a = (0.25 + this.pulse * 0.4) * intensity * (0.6 + e * 0.5);
    ctx.strokeStyle = `rgba(160,230,255,${a})`;
    ctx.lineWidth = 3 + e * 2;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.9})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
  }

  private drawWaveBand(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitY: number,
    intensity: number,
    e: number,
    aurora: boolean,
    active: { x: number; color: string; velocity: number }[],
  ) {
    const amp = 4 + e * 10 + this.pulse * 6;
    const phases = aurora ? 3 : 2;
    for (let p = 0; p < phases; p++) {
      const phase = this.time * (1.1 + p * 0.35) + p * 1.7;
      ctx.beginPath();
      const steps = Math.max(40, Math.floor(w / 12));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const xx = t * w;
        const yy =
          hitY +
          Math.sin(t * Math.PI * (2 + p) + phase) * amp * (0.7 + p * 0.15) +
          Math.sin(t * Math.PI * 5 - phase * 0.6) * amp * 0.25;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      if (aurora) {
        const hues = [
          [120, 220, 255],
          [200, 150, 255],
          [120, 255, 200],
        ][p];
        ctx.strokeStyle = `rgba(${hues[0]},${hues[1]},${hues[2]},${(0.18 + this.pulse * 0.15) * intensity * e})`;
      } else {
        ctx.strokeStyle = `rgba(200,220,255,${(0.2 + this.pulse * 0.2) * intensity * (0.5 + e * 0.5)})`;
      }
      ctx.lineWidth = 1.2 + e * 0.8;
      ctx.stroke();
    }

    // Pull wave toward active keys slightly
    for (const a of active) {
      const { r, g, b } = hexToRgb(a.color);
      const g1 = ctx.createRadialGradient(a.x, hitY, 0, a.x, hitY, 30 + e * 20);
      g1.addColorStop(0, `rgba(${r},${g},${b},${0.2 * a.velocity * intensity * e})`);
      g1.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.ellipse(a.x, hitY, 28 + e * 16, 8 + e * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawElectricCloud(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitY: number,
    intensity: number,
    e: number,
    storm: boolean,
  ) {
    // Soft cloud puffs along the rail
    const puffs = Math.round(6 + e * 10);
    for (let i = 0; i < puffs; i++) {
      const seed = hash01(i, Math.floor(this.time * 2), 3);
      const drift = ((this.time * (12 + seed * 20) + i * 47) % (w + 80)) - 40;
      const px = drift;
      const py = hitY + (seed - 0.5) * (8 + e * 10);
      const rw = 28 + seed * 40 * e;
      const rh = 6 + seed * 10 * e;
      const a = (0.06 + seed * 0.08) * intensity * (0.5 + e * 0.6) * (storm ? 1.15 : 1);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rw);
      g.addColorStop(0, `rgba(200,220,255,${a})`);
      g.addColorStop(0.5, `rgba(140,180,255,${a * 0.45})`);
      g.addColorStop(1, 'rgba(100,140,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Jagged lightning arcs
    const arcs = Math.round(2 + e * 5 + this.pulse * 4);
    for (let i = 0; i < arcs; i++) {
      const seed = hash01(i, Math.floor(this.time * 8), 9);
      // Flicker: only some frames show
      const flicker = Math.sin(this.time * (14 + seed * 10) + i) * 0.5 + 0.5;
      if (flicker < 0.45 - e * 0.1) continue;

      const x0 = seed * w;
      const span = 40 + seed * 90 * e;
      const x1 = Math.min(w, x0 + span);
      const y0 = hitY + (hash01(i, 2, 1) - 0.5) * 6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const segs = 5 + Math.floor(seed * 5);
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const jx = x0 + (x1 - x0) * t;
        const jy = hitY + (hash01(i, s, Math.floor(this.time * 12)) - 0.5) * (10 + e * 14);
        ctx.lineTo(jx, jy);
      }
      const a = (0.25 + flicker * 0.45) * intensity * e * (0.5 + this.pulse);
      ctx.strokeStyle = `rgba(180,220,255,${a})`;
      ctx.lineWidth = 1 + e * 0.8;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  private drawActive(
    ctx: CanvasRenderingContext2D,
    a: { x: number; color: string; velocity: number },
    hitY: number,
    intensity: number,
    style: HitRailStyleId,
    e: number,
  ) {
    const { r, g, b } = hexToRgb(a.color);
    const strength = (0.35 + a.velocity * 0.5) * intensity;
    const hw = 18 + a.velocity * 28 + e * 8;
    const grad = ctx.createRadialGradient(a.x, hitY, 0, a.x, hitY, hw);
    grad.addColorStop(0, `rgba(255,255,255,${strength * 0.7})`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},${strength * 0.55})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(a.x, hitY, hw, 10 + a.velocity * 8 + e * 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'electric' || style === 'storm') {
      // Mini forks from active keys
      for (let i = 0; i < 2; i++) {
        const seed = hash01(Math.floor(a.x), i, Math.floor(this.time * 10));
        if (seed < 0.35) continue;
        const len = 12 + seed * 28 * e;
        const dir = i === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, hitY);
        ctx.lineTo(a.x + dir * len * 0.4, hitY + (seed - 0.5) * 16);
        ctx.lineTo(a.x + dir * len, hitY + (hash01(i, 3, 1) - 0.5) * 12);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 * strength * e})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  private drawBloom(
    ctx: CanvasRenderingContext2D,
    bloom: RailBloom,
    hitY: number,
    intensity: number,
    style: HitRailStyleId,
    e: number,
  ) {
    const t = bloom.life / bloom.maxLife;
    const a = t * t * bloom.strength * intensity;
    const hw = bloom.width * (0.6 + (1 - t) * 0.5);

    if (style === 'shock') {
      // Expanding ring
      const radius = hw * (0.4 + (1 - t) * (1.2 + e));
      ctx.strokeStyle = `rgba(${bloom.r},${bloom.g},${bloom.b},${a * 0.75})`;
      ctx.lineWidth = 1.5 + e * 1.5 * t;
      ctx.beginPath();
      ctx.ellipse(bloom.x, hitY, radius, 6 + (1 - t) * 10 * e, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(bloom.x, hitY, radius * 0.75, 4 + (1 - t) * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const grad = ctx.createRadialGradient(bloom.x, hitY, 0, bloom.x, hitY, hw);
    grad.addColorStop(0, `rgba(255,255,255,${a * 0.85})`);
    grad.addColorStop(0.3, `rgba(${bloom.r},${bloom.g},${bloom.b},${a * 0.65})`);
    grad.addColorStop(1, `rgba(${bloom.r},${bloom.g},${bloom.b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(bloom.x, hitY, hw, 12 + (1 - t) * 16, 0, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'spark' || style === 'electric') {
      const sparks = Math.round(3 + e * 5);
      for (let i = 0; i < sparks; i++) {
        const seed = hash01(Math.floor(bloom.x), i, Math.floor(t * 20));
        const ang = seed * Math.PI * 2;
        const dist = (8 + seed * 28) * (1 - t) * (0.6 + e);
        const px = bloom.x + Math.cos(ang) * dist;
        const py = hitY + Math.sin(ang) * dist * 0.35;
        ctx.fillStyle = `rgba(255,255,255,${a * 0.6 * seed})`;
        ctx.beginPath();
        ctx.arc(px, py, 0.8 + seed * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawSparks(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitY: number,
    active: { x: number; color: string; velocity: number }[],
    intensity: number,
    e: number,
    electric: boolean,
  ) {
    const n = Math.round(8 + e * 16 + this.pulse * 10);
    for (let i = 0; i < n; i++) {
      const seed = hash01(i, Math.floor(this.time * 20), 5);
      let px: number;
      if (active.length > 0 && seed > 0.4) {
        const a = active[Math.floor(seed * active.length) % active.length];
        px = a.x + (hash01(i, 2, 1) - 0.5) * 40;
      } else {
        px = seed * w;
      }
      const py = hitY + (hash01(i, 3, 2) - 0.5) * (10 + e * 14);
      const life = Math.abs(Math.sin(this.time * (8 + seed * 6) + i));
      const a = life * 0.35 * intensity * e;
      if (a < 0.04) continue;
      if (electric) {
        ctx.strokeStyle = `rgba(180,220,255,${a})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + (seed - 0.5) * 12, py + (hash01(i, 4, 1) - 0.5) * 8);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255,240,200,${a})`;
        ctx.beginPath();
        ctx.arc(px, py, 0.7 + seed * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  clear() {
    this.blooms = [];
    this.pulse = 0;
    this.time = 0;
  }
}
