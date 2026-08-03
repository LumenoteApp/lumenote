/**
 * Music-reactive ambient particle animation.
 * Floats, pulses, rises from active keys, and pops shockwaves on onsets.
 */

import type { MusicReactiveParams } from '../midi/types';

export type MusicBandEnergy = {
  /** 0-1 overall activity */
  total: number;
  bass: number;
  mid: number;
  high: number;
  /** Average velocity of active notes */
  velocity: number;
  /** Active note count */
  count: number;
};

type Dust = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  phase: number;
  active: boolean;
};

type Streamer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  active: boolean;
};

type Wave = {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class MusicReactiveField {
  private dust: Dust[] = [];
  private streamers: Streamer[] = [];
  private waves: Wave[] = [];
  private w = 0;
  private h = 0;
  private hitY = 0;
  private time = 0;

  private energySmooth = 0;
  private bassSmooth = 0;
  private midSmooth = 0;
  private highSmooth = 0;
  private prevEnergy = 0;
  private pulse = 0;
  private bassKick = 0;

  constructor() {
    for (let i = 0; i < 900; i++) this.dust.push(this.blankDust());
    for (let i = 0; i < 1200; i++) this.streamers.push(this.blankStreamer());
  }

  private blankDust(): Dust {
    return {
      x: 0,
      y: 0,
      z: 1,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      r: 255,
      g: 255,
      b: 255,
      phase: 0,
      active: false,
    };
  }

  private blankStreamer(): Streamer {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      r: 255,
      g: 255,
      b: 255,
      active: false,
    };
  }

  private takeDust(): Dust | null {
    for (const d of this.dust) if (!d.active) return d;
    return null;
  }

  private takeStreamer(): Streamer | null {
    for (const s of this.streamers) if (!s.active) return s;
    return null;
  }

  resize(w: number, h: number, hitY: number) {
    this.w = w;
    this.h = h;
    this.hitY = hitY;
  }

  /**
   * Drive the field from current musical state.
   * active: list of held notes with position + color
   * onsetStrength: 0-1 spike when new notes land this frame
   */
  update(
    dt: number,
    bands: MusicBandEnergy,
    active: { x: number; color: string; velocity: number; pitch: number }[],
    onsetStrength: number,
    params: MusicReactiveParams,
    palette: string[],
  ) {
    if (!params.enabled || params.intensity <= 0.01) {
      // still decay smoothers
      this.energySmooth *= 0.9;
      return;
    }

    this.time += dt;
    const I = params.intensity;
    const attack = 2 + params.attack * 10;

    this.energySmooth += (bands.total - this.energySmooth) * Math.min(1, dt * attack);
    this.bassSmooth += (bands.bass - this.bassSmooth) * Math.min(1, dt * attack);
    this.midSmooth += (bands.mid - this.midSmooth) * Math.min(1, dt * (attack * 0.85));
    this.highSmooth += (bands.high - this.highSmooth) * Math.min(1, dt * (attack * 1.1));

    // Onset / kick detection
    const rise = Math.max(0, bands.total - this.prevEnergy);
    this.prevEnergy = bands.total;
    const onset = clamp01(onsetStrength + rise * 2.5);
    this.pulse = Math.min(1.5, this.pulse + onset * 0.85);
    this.pulse = Math.max(0, this.pulse - dt * 2.2);
    this.bassKick = Math.min(1.2, this.bassKick + onset * bands.bass * 1.2);
    this.bassKick = Math.max(0, this.bassKick - dt * 1.6);

    const e = this.energySmooth;
    const defaultColors =
      palette.length > 0 ? palette : ['#4FC3F7', '#F48FB1', '#CE93D8'];

    // --- Ambient dust: always present, denser & faster with energy ---
    const ambientRate =
      params.ambient * I * (4 + e * 55 + this.pulse * 40 + this.highSmooth * 20) * dt;
    let ambientN = Math.floor(ambientRate);
    if (Math.random() < ambientRate - ambientN) ambientN++;
    for (let i = 0; i < ambientN; i++) {
      const d = this.takeDust();
      if (!d) break;
      const col = hexToRgb(defaultColors[Math.floor(Math.random() * defaultColors.length)]);
      const bandPick = Math.random();
      // Bias spawn height by frequency band energy
      let yBias = this.hitY * (0.3 + Math.random() * 0.55);
      if (bandPick < this.bassSmooth * 0.5) yBias = this.hitY * (0.55 + Math.random() * 0.35);
      else if (bandPick > 1 - this.highSmooth * 0.4) yBias = this.hitY * (0.05 + Math.random() * 0.35);

      d.x = Math.random() * this.w;
      d.y = yBias;
      d.z = 0.35 + Math.random() * 0.65;
      d.vx = (Math.random() - 0.5) * (20 + e * 80 + this.midSmooth * 40);
      d.vy =
        -15 -
        Math.random() * (25 + e * 90) * (0.5 + this.highSmooth) +
        this.bassSmooth * (Math.random() - 0.3) * 40;
      d.life = 0.6 + Math.random() * (1.2 + e);
      d.maxLife = d.life;
      d.size = (0.6 + Math.random() * 2.2) * (0.7 + e * 0.8) * (0.6 + params.ambient);
      d.r = col.r;
      d.g = col.g;
      d.b = col.b;
      d.phase = Math.random() * Math.PI * 2;
      d.active = true;
    }

    // --- Rising columns from each active key ---
    if (params.columns > 0.02 && active.length > 0) {
      for (const note of active) {
        const rate =
          params.columns *
          I *
          (6 + note.velocity * 18 + e * 12) *
          dt *
          (0.5 + bands.velocity);
        let n = Math.floor(rate);
        if (Math.random() < rate - n) n++;
        const col = hexToRgb(note.color);
        const isBass = note.pitch < 48;
        const isHigh = note.pitch > 72;
        for (let i = 0; i < n; i++) {
          const s = this.takeStreamer();
          if (!s) break;
          s.x = note.x + (Math.random() - 0.5) * 14;
          s.y = this.hitY - Math.random() * 6;
          s.vx = (Math.random() - 0.5) * (18 + note.velocity * 40);
          s.vy = -(60 + Math.random() * 140 * note.velocity + e * 80) * (isHigh ? 1.25 : 1);
          if (isBass) {
            s.vy *= 0.55;
            s.vx *= 1.4;
          }
          s.life = 0.35 + Math.random() * 0.7 * (0.7 + note.velocity);
          s.maxLife = s.life;
          s.size = (1.2 + Math.random() * 3 * note.velocity) * (isBass ? 1.6 : 1) * params.columns;
          s.r = col.r;
          s.g = col.g;
          s.b = col.b;
          s.active = true;
        }
      }
    }

    // --- Shockwave rings on onsets ---
    if (params.waves > 0.02 && onset > 0.12) {
      // Prefer wave centers at loudest active notes; else screen center
      const centers =
        active.length > 0
          ? active.slice(0, Math.min(4, Math.ceil(onset * 5)))
          : [{ x: this.w / 2, color: defaultColors[0], velocity: onset, pitch: 60 }];

      for (const c of centers) {
        const col = hexToRgb(c.color);
        this.waves.push({
          x: c.x,
          y: this.hitY,
          radius: 4,
          maxRadius: 80 + onset * 220 * params.waves + this.bassSmooth * 100,
          life: 0.5 + onset * 0.45,
          maxLife: 0.5 + onset * 0.45,
          r: col.r,
          g: col.g,
          b: col.b,
          strength: onset * params.waves * I * (0.5 + c.velocity),
        });
      }
      // Full-width bass boom wave
      if (this.bassSmooth > 0.35 && onset > 0.2 && params.bassPulse > 0.2) {
        const col = hexToRgb(defaultColors[0]);
        this.waves.push({
          x: this.w / 2,
          y: this.hitY,
          radius: 10,
          maxRadius: this.w * 0.55,
          life: 0.55,
          maxLife: 0.55,
          r: col.r,
          g: col.g,
          b: col.b,
          strength: onset * params.bassPulse * I * 0.7,
        });
      }
      if (this.waves.length > 40) this.waves.splice(0, this.waves.length - 40);
    }

    // Integrate dust
    const swirl = e * 40 + this.midSmooth * 30;
    for (const d of this.dust) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        continue;
      }
      d.phase += dt * (2 + e * 4);
      d.vx += Math.sin(d.phase + d.y * 0.01) * swirl * dt;
      d.vy += Math.cos(d.phase * 0.8) * swirl * 0.5 * dt;
      // bass lifts everything
      d.vy -= this.bassKick * params.bassPulse * 80 * dt;
      d.vx *= 0.99;
      d.vy *= 0.99;
      d.x += d.vx * dt * d.z;
      d.y += d.vy * dt * d.z;
      if (d.x < -20 || d.x > this.w + 20 || d.y < -40 || d.y > this.h + 20) d.active = false;
    }

    // Integrate streamers
    for (const s of this.streamers) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      s.vy += 30 * dt; // slight gravity so arcs look natural
      s.vx *= 0.985;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -30 || s.x < -30 || s.x > this.w + 30) s.active = false;
    }

    // Integrate waves
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.life -= dt;
      const t = 1 - w.life / w.maxLife;
      w.radius = lerp(4, w.maxRadius, 1 - Math.pow(1 - t, 1.4));
      if (w.life <= 0) this.waves.splice(i, 1);
    }
  }

  /** 0-1 value for other systems (bg, rail) to piggyback on */
  getSmoothedEnergy() {
    return this.energySmooth;
  }

  getBassKick() {
    return this.bassKick;
  }

  getPulse() {
    return this.pulse;
  }

  draw(ctx: CanvasRenderingContext2D, params: MusicReactiveParams) {
    if (!params.enabled || params.intensity <= 0.01) return;
    const I = params.intensity;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Bass screen wash
    if (params.bassPulse > 0.05 && this.bassKick > 0.05) {
      const a = this.bassKick * params.bassPulse * I * 0.12;
      const grad = ctx.createRadialGradient(
        this.w / 2,
        this.hitY,
        0,
        this.w / 2,
        this.hitY,
        this.w * 0.65,
      );
      grad.addColorStop(0, `rgba(255,180,120,${a})`);
      grad.addColorStop(0.5, `rgba(120,80,200,${a * 0.35})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // Shockwaves
    for (const w of this.waves) {
      const t = w.life / w.maxLife;
      const a = t * w.strength * 0.7;
      ctx.strokeStyle = `rgba(${w.r},${w.g},${w.b},${a})`;
      ctx.lineWidth = 1.5 + t * 3;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, Math.PI, Math.PI * 2, true); // upper semicircle
      ctx.stroke();
      // soft fill ring
      const rg = ctx.createRadialGradient(w.x, w.y, w.radius * 0.85, w.x, w.y, w.radius * 1.15);
      rg.addColorStop(0, `rgba(${w.r},${w.g},${w.b},0)`);
      rg.addColorStop(0.5, `rgba(${w.r},${w.g},${w.b},${a * 0.35})`);
      rg.addColorStop(1, `rgba(${w.r},${w.g},${w.b},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ambient dust
    for (const d of this.dust) {
      if (!d.active) continue;
      const t = d.life / d.maxLife;
      const twinkle = 0.55 + 0.45 * Math.sin(d.phase * 3);
      const a = t * t * twinkle * I * (0.35 + this.energySmooth * 0.65) * params.ambient;
      if (a < 0.02) continue;
      const size = d.size * (0.5 + t) * (1 + this.pulse * 0.35);
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, size * 2.5);
      g.addColorStop(0, `rgba(255,255,255,${a * 0.9})`);
      g.addColorStop(0.35, `rgba(${d.r},${d.g},${d.b},${a})`);
      g.addColorStop(1, `rgba(${d.r},${d.g},${d.b},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rising streamers with trails
    for (const s of this.streamers) {
      if (!s.active) continue;
      const t = s.life / s.maxLife;
      const a = t * t * I * 0.85 * params.columns;
      if (a < 0.02) continue;
      const size = s.size * (0.4 + t);
      // trail
      ctx.strokeStyle = `rgba(${s.r},${s.g},${s.b},${a * 0.45})`;
      ctx.lineWidth = size * 0.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size * 2);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.4, `rgba(${s.r},${s.g},${s.b},${a * 0.7})`);
      g.addColorStop(1, `rgba(${s.r},${s.g},${s.b},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  clear() {
    for (const d of this.dust) d.active = false;
    for (const s of this.streamers) s.active = false;
    this.waves = [];
    this.energySmooth = 0;
    this.pulse = 0;
    this.bassKick = 0;
    this.prevEnergy = 0;
  }
}

/** Build band energies from active notes (pitch + velocity). */
export function analyzeMusicEnergy(
  active: { pitch: number; velocity: number }[],
): MusicBandEnergy {
  if (active.length === 0) {
    return { total: 0, bass: 0, mid: 0, high: 0, velocity: 0, count: 0 };
  }
  let bass = 0;
  let mid = 0;
  let high = 0;
  let vel = 0;
  for (const n of active) {
    vel += n.velocity;
    // MIDI: bass < 48, mid 48-72, high > 72
    if (n.pitch < 48) bass += n.velocity;
    else if (n.pitch <= 72) mid += n.velocity;
    else high += n.velocity;
  }
  const count = active.length;
  const norm = (v: number) => clamp01(v / Math.max(2.5, count * 0.45));
  const total = clamp01((count / 10) * 0.55 + (vel / count) * 0.45 + (bass + mid + high) * 0.08);
  return {
    total: clamp01(total),
    bass: norm(bass),
    mid: norm(mid),
    high: norm(high),
    velocity: vel / count,
    count,
  };
}
