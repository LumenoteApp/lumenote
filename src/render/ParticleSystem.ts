import type { ParticleParams } from '../midi/types';

type ParticleKind = 'spark' | 'shard' | 'glow' | 'ember';

type Particle = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  kind: ParticleKind;
  spin: number;
  phase: number;
  trail: number;
  active: boolean;
};

type Flash = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
  strength: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private flashes: Flash[] = [];

  constructor(poolSize = 5500) {
    for (let i = 0; i < poolSize; i++) {
      this.particles.push(this.blank());
    }
  }

  private blank(): Particle {
    return {
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      r: 255,
      g: 255,
      b: 255,
      kind: 'spark',
      spin: 0,
      phase: 0,
      trail: 0,
      active: false,
    };
  }

  private acquire(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  /** Main hit burst + optional secondary ring + flash */
  spawn(x: number, y: number, color: string, velocity: number, params: ParticleParams) {
    const base = hexToRgb(color);
    const dens = params.density;
    const count = Math.round((8 + velocity * 18) * dens);
    const spreadAngle = lerp(0.35, Math.PI * 1.15, clamp01(params.spread));

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      this.initParticle(p, x, y, base, velocity, params, spreadAngle, 'burst');
    }

    // Secondary ring
    const ringCount = Math.round(params.secondaryBurst * (10 + velocity * 16) * dens);
    for (let i = 0; i < ringCount; i++) {
      const p = this.acquire();
      if (!p) break;
      const angle = (i / Math.max(1, ringCount)) * Math.PI * 2 + Math.random() * 0.2;
      const speed = (90 + Math.random() * 160) * params.speed * (0.7 + velocity * 0.5);
      this.fillParticle(p, x, y, base, velocity, params, {
        angle,
        speed,
        kind: Math.random() > 0.5 ? 'shard' : 'spark',
        lifeScale: 0.75,
      });
    }

    // Soft glow puffs
    const glowCount = Math.round(3 * dens * (0.5 + params.bloom * 0.5));
    for (let i = 0; i < glowCount; i++) {
      const p = this.acquire();
      if (!p) break;
      this.fillParticle(p, x, y, base, velocity, params, {
        angle: -Math.PI / 2 + (Math.random() - 0.5) * 1.2,
        speed: (20 + Math.random() * 50) * params.speed,
        kind: 'glow',
        lifeScale: 1.25,
        sizeMul: 2.2,
      });
    }

    if (params.hitFlash > 0.05) {
      this.flashes.push({
        x,
        y,
        life: 0.18 + params.hitFlash * 0.22,
        maxLife: 0.18 + params.hitFlash * 0.22,
        r: base.r,
        g: base.g,
        b: base.b,
        strength: params.hitFlash * (0.6 + velocity * 0.5),
      });
      if (this.flashes.length > 80) this.flashes.shift();
    }
  }

  /** Gentle continuous emission while a key is held */
  emitSustain(x: number, y: number, color: string, velocity: number, params: ParticleParams, dt: number) {
    if (params.sustainEmit <= 0.01) return;
    const rate = params.sustainEmit * params.density * (4 + velocity * 8) * dt;
    let n = Math.floor(rate);
    if (Math.random() < rate - n) n++;
    const base = hexToRgb(color);
    for (let i = 0; i < n; i++) {
      const p = this.acquire();
      if (!p) break;
      this.initParticle(
        p,
        x + (Math.random() - 0.5) * 6,
        y,
        base,
        velocity * 0.6,
        params,
        lerp(0.4, 1.2, params.spread),
        'sustain',
      );
    }
  }

  private initParticle(
    p: Particle,
    x: number,
    y: number,
    base: { r: number; g: number; b: number },
    velocity: number,
    params: ParticleParams,
    spreadAngle: number,
    mode: 'burst' | 'sustain',
  ) {
    const roll = Math.random();
    let kind: ParticleKind = 'spark';
    if (roll > 0.82) kind = 'ember';
    else if (roll > 0.62) kind = 'shard';
    else if (roll > 0.48) kind = 'glow';

    const angle =
      mode === 'sustain'
        ? -Math.PI / 2 + (Math.random() - 0.5) * spreadAngle * 0.8
        : -Math.PI / 2 + (Math.random() - 0.5) * spreadAngle;

    const speedBase = mode === 'sustain' ? 35 : 55;
    const speed =
      (speedBase + Math.random() * 160 * velocity) * params.speed * (mode === 'sustain' ? 0.55 : 1);

    this.fillParticle(p, x, y, base, velocity, params, {
      angle,
      speed,
      kind,
      lifeScale: mode === 'sustain' ? 0.7 : 1,
    });
  }

  private fillParticle(
    p: Particle,
    x: number,
    y: number,
    base: { r: number; g: number; b: number },
    velocity: number,
    params: ParticleParams,
    opts: {
      angle: number;
      speed: number;
      kind: ParticleKind;
      lifeScale?: number;
      sizeMul?: number;
    },
  ) {
    const lifeScale = opts.lifeScale ?? 1;
    const sizeMul = opts.sizeMul ?? 1;
    const variance = 1 - params.sizeVariance + Math.random() * params.sizeVariance * 2;

    // Color: mix toward white for hot core
    const hot = params.whiteHot * (0.3 + Math.random() * 0.7);
    p.r = Math.round(lerp(base.r, 255, hot));
    p.g = Math.round(lerp(base.g, 255, hot * 0.92));
    p.b = Math.round(lerp(base.b, 255, hot * 0.85));

    // Slight random hue drift for life
    p.r = Math.min(255, Math.max(0, p.r + (Math.random() - 0.5) * 30));
    p.g = Math.min(255, Math.max(0, p.g + (Math.random() - 0.5) * 30));
    p.b = Math.min(255, Math.max(0, p.b + (Math.random() - 0.5) * 30));

    p.x = x + (Math.random() - 0.5) * 10;
    p.y = y + (Math.random() - 0.5) * 6;
    p.px = p.x;
    p.py = p.y;
    p.vx = Math.cos(opts.angle) * opts.speed;
    p.vy = Math.sin(opts.angle) * opts.speed;
    p.life = (0.25 + Math.random() * 0.85) * params.lifetime * lifeScale;
    p.maxLife = p.life;
    p.size =
      (0.8 + Math.random() * 2.8 * velocity) * params.size * variance * sizeMul *
      (opts.kind === 'glow' ? 1.8 : opts.kind === 'shard' ? 0.75 : 1);
    p.kind = opts.kind;
    p.spin = (Math.random() - 0.5) * 12;
    p.phase = Math.random() * Math.PI * 2;
    p.trail = params.trail;
    p.active = true;
  }

  update(dt: number, params: ParticleParams) {
    const g = params.gravity * 320;
    const drag = 1 - clamp01(params.drag) * 0.12;
    const turb = params.turbulence * 220;
    const swirl = params.swirl * 3.5;

    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.px = p.x;
      p.py = p.y;
      p.phase += dt * (8 + p.spin);

      // Turbulence noise (cheap pseudo-noise)
      if (turb > 0.5) {
        p.vx += Math.sin(p.phase * 1.7 + p.y * 0.02) * turb * dt;
        p.vy += Math.cos(p.phase * 1.3 + p.x * 0.02) * turb * dt * 0.7;
      }

      // Swirl around origin-ish upward
      if (swirl > 0.01) {
        const cx = p.x;
        // rotate velocity slightly
        const ang = swirl * dt * (p.kind === 'ember' ? 1.4 : 1);
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const nvx = p.vx * cos - p.vy * sin;
        const nvy = p.vx * sin + p.vy * cos;
        p.vx = nvx;
        p.vy = nvy;
        void cx;
      }

      p.vy += g * dt * (p.kind === 'glow' ? 0.45 : p.kind === 'ember' ? 0.7 : 1);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, params: ParticleParams) {
    // Hit flashes (under particles)
    for (const f of this.flashes) {
      const t = f.life / f.maxLife;
      const radius = (1 - t) * 55 * f.strength + 8;
      const alpha = t * t * 0.55 * f.strength;
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.35, `rgba(${f.r},${f.g},${f.b},${alpha * 0.7})`);
      grad.addColorStop(1, `rgba(${f.r},${f.g},${f.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      if (!p.active) continue;
      const lifeT = p.life / p.maxLife;

      // Sparkle modulation
      let spark = 1;
      if (params.sparkle > 0.01) {
        const tw = 0.55 + 0.45 * Math.sin(p.phase * (3 + params.sparkle * 6));
        spark = lerp(1, tw, params.sparkle);
      }

      const alpha = lifeT * lifeT * spark * (p.kind === 'glow' ? 0.45 : 0.95);
      if (alpha < 0.02) continue;

      const bloom = params.bloom * (p.kind === 'glow' ? 1.6 : 1);
      const radius = p.size * (0.4 + lifeT * 0.75) * bloom;

      // Trails / streaks
      if (p.trail > 0.05 && (Math.abs(p.x - p.px) > 0.4 || Math.abs(p.y - p.py) > 0.4)) {
        const trailAlpha = alpha * 0.55 * p.trail;
        ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${trailAlpha})`;
        ctx.lineWidth = Math.max(0.6, radius * 0.45 * p.trail);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const tx = p.x - (p.x - p.px) * (1 + p.trail * 2.5);
        const ty = p.y - (p.y - p.py) * (1 + p.trail * 2.5);
        ctx.moveTo(tx, ty);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      if (p.kind === 'shard') {
        // Diamond / shard
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.phase * 0.35 + p.spin);
        const s = radius * 1.3;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.45, 0);
        ctx.lineTo(0, s * 0.7);
        ctx.lineTo(-s * 0.45, 0);
        ctx.closePath();
        ctx.fill();
        if (params.whiteHot > 0.3) {
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.45);
          ctx.lineTo(s * 0.15, 0);
          ctx.lineTo(0, s * 0.2);
          ctx.lineTo(-s * 0.15, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else {
        const outer = radius * (p.kind === 'glow' ? 2.4 : 2);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, outer);
        const coreA = alpha * (0.75 + params.whiteHot * 0.25);
        grad.addColorStop(0, `rgba(255,255,255,${coreA})`);
        grad.addColorStop(0.18, `rgba(${p.r},${p.g},${p.b},${alpha})`);
        grad.addColorStop(0.5, `rgba(${p.r},${p.g},${p.b},${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, outer, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  clear() {
    for (const p of this.particles) p.active = false;
    this.flashes.length = 0;
  }
}
