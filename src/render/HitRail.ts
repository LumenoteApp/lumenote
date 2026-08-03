/**
 * Reactive impact rail - where notes meet the keyboard.
 * Not a static white line: soft base + local color blooms on hits/active keys.
 */

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

export class HitRail {
  private blooms: RailBloom[] = [];
  private pulse = 0;

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
  ) {
    if (intensity <= 0.01) return;

    ctx.save();

    // Soft base rail (very subtle - not a hard white line)
    const baseA = (0.06 + this.pulse * 0.12) * intensity;
    const band = ctx.createLinearGradient(0, hitY - 14, 0, hitY + 14);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.45, `rgba(200,210,255,${baseA * 0.35})`);
    band.addColorStop(0.5, `rgba(255,255,255,${baseA})`);
    band.addColorStop(0.55, `rgba(200,210,255,${baseA * 0.35})`);
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, hitY - 14, w, 28);

    // Hairline core
    ctx.strokeStyle = `rgba(255,255,255,${(0.08 + this.pulse * 0.2) * intensity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';

    // Active key glows along the rail
    for (const a of active) {
      const { r, g, b } = hexToRgb(a.color);
      const strength = (0.35 + a.velocity * 0.5) * intensity;
      const hw = 18 + a.velocity * 28;
      const grad = ctx.createRadialGradient(a.x, hitY, 0, a.x, hitY, hw);
      grad.addColorStop(0, `rgba(255,255,255,${strength * 0.7})`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},${strength * 0.55})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(a.x, hitY, hw, 10 + a.velocity * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit blooms (linger after note attack)
    for (const bloom of this.blooms) {
      const t = bloom.life / bloom.maxLife;
      const a = t * t * bloom.strength * intensity;
      const hw = bloom.width * (0.6 + (1 - t) * 0.5);
      const grad = ctx.createRadialGradient(bloom.x, hitY, 0, bloom.x, hitY, hw);
      grad.addColorStop(0, `rgba(255,255,255,${a * 0.85})`);
      grad.addColorStop(0.3, `rgba(${bloom.r},${bloom.g},${bloom.b},${a * 0.65})`);
      grad.addColorStop(1, `rgba(${bloom.r},${bloom.g},${bloom.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(bloom.x, hitY, hw, 12 + (1 - t) * 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  clear() {
    this.blooms = [];
    this.pulse = 0;
  }
}
