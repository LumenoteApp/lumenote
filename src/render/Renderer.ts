import type { Note, Song } from '../midi';
import { hexToRgb, LOOKS, type Settings } from '../looks';
import {
  BACKGROUND_FS,
  BRIGHT_FS,
  COMPOSITE_FS,
  DOWN_FS,
  FULLSCREEN_VS,
  SHAPE_FS,
  SHAPE_VS,
  UP_FS,
} from './shaders';

export type LiveNote = { pitch: number; start: number; end: number | null; velocity: number };

type RGB = [number, number, number];

const BLACK_PC = new Set([1, 3, 6, 8, 10]);
const BLACK_OFFSET: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.12, 8: 0, 10: 0.12 };
const isBlack = (p: number) => BLACK_PC.has(((p % 12) + 12) % 12);

const FLOATS = 12; // rect4 color4 params4
const MAX_SHAPES = 20000;
const MAX_SPARKS = 4000;
const BLOOM_LEVELS = 6;

const toLinear = (c: RGB): RGB => [c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2];
const STYLE_ID: Record<string, number> = { classic: 0, flame: 1, plasma: 2 };
/** Stable 0..1 per note, so each note's flame or plasma pattern is its own and does not jump. */
const noteSeed = (pitch: number, start: number) => {
  const x = Math.sin(pitch * 12.9898 + start * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Small deterministic PRNG so exports are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private hdr: boolean;

  private bgProg: WebGLProgram;
  private shapeProg: WebGLProgram;
  private brightProg: WebGLProgram;
  private downProg: WebGLProgram;
  private upProg: WebGLProgram;
  private compProg: WebGLProgram;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  private shapeVao: WebGLVertexArrayObject;
  private emptyVao: WebGLVertexArrayObject;
  private instanceBuf: WebGLBuffer;
  private data = new Float32Array(MAX_SHAPES * FLOATS);
  private count = 0;

  private scene: Target | null = null;
  private bloom: Target[] = [];
  private w = 0;
  private h = 0;

  private song: Song | null = null;
  private maxLen = 0;
  private settings!: Settings;
  private hands: [RGB, RGB] = [
    [1, 1, 1],
    [1, 1, 1],
  ];
  private bg: [RGB, RGB] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  private lo = 21;
  private hi = 108;

  // Sparks: x, y, vx, vy, age, life, size, r, g, b
  private sparks = new Float32Array(MAX_SPARKS * 10);
  private sparkCount = 0;
  private rand = mulberry32(7);
  private glowColor: RGB = [0, 0, 0];
  private glowAmt = 0;
  private glowX = 0.5;
  private lastOnsetSeen = new Map<string, number>();
  private time = 0;
  /** Animation clock: runs at the Motion setting's speed. */
  private anim = 0;

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserve,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');

    this.bgProg = this.program(FULLSCREEN_VS, BACKGROUND_FS);
    this.shapeProg = this.program(SHAPE_VS, SHAPE_FS);
    this.brightProg = this.program(FULLSCREEN_VS, BRIGHT_FS);
    this.downProg = this.program(FULLSCREEN_VS, DOWN_FS);
    this.upProg = this.program(FULLSCREEN_VS, UP_FS);
    this.compProg = this.program(FULLSCREEN_VS, COMPOSITE_FS);

    this.emptyVao = gl.createVertexArray()!;
    this.shapeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.shapeVao);
    const corner = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------- setup

  setSong(song: Song | null) {
    this.song = song;
    this.maxLen = 0;
    if (song) for (const n of song.notes) this.maxLen = Math.max(this.maxLen, n.end - n.start);
    this.reset();
  }

  setSettings(s: Settings) {
    this.settings = s;
    const look = LOOKS.find((l) => l.id === s.look) ?? LOOKS[0];
    this.hands = [toLinear(hexToRgb(s.hands[0])), toLinear(hexToRgb(s.hands[1]))];
    this.bg = [toLinear(hexToRgb(look.bg[0])), toLinear(hexToRgb(look.bg[1]))];
  }

  /** Visible key range (MIDI). Snaps outward to white keys. */
  setKeyRange(lo: number, hi: number) {
    while (isBlack(lo)) lo--;
    while (isBlack(hi)) hi++;
    this.lo = Math.max(0, lo);
    this.hi = Math.min(127, hi);
  }

  /** Clears particles and onset memory (call after seeking). */
  reset() {
    this.sparkCount = 0;
    this.lastOnsetSeen.clear();
    this.rand = mulberry32(7);
    this.glowAmt = 0;
  }

  resize(w: number, h: number) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl;
    const del = (t: Target | null) => {
      if (!t) return;
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    };
    del(this.scene);
    this.bloom.forEach(del);
    this.scene = this.target(w, h);
    this.bloom = [];
    let bw = w;
    let bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
      this.bloom.push(this.target(bw, bh));
    }
  }

  // ---------------------------------------------------------------- layout

  private layout() {
    const W = this.w;
    const H = this.h;
    const scale = Math.min(W, H) / 1080;
    let whites = 0;
    for (let p = this.lo; p <= this.hi; p++) if (!isBlack(p)) whites++;
    const whiteW = W / whites;
    const kbH = Math.min(H * 0.2, Math.max(H * 0.1, whiteW * 5.4));
    const keyY = Math.round(H - kbH);
    return { W, H, scale, whiteW, blackW: whiteW * 0.6, kbH, keyY };
  }

  /** x center and width of a key column. */
  private keyX(p: number, whiteW: number, blackW: number): [number, number, boolean] {
    let idx = 0;
    for (let q = this.lo; q < p; q++) if (!isBlack(q)) idx++;
    if (!isBlack(p)) return [(idx + 0.5) * whiteW, whiteW, false];
    const pc = ((p % 12) + 12) % 12;
    return [(idx + BLACK_OFFSET[pc]) * whiteW, blackW, true];
  }

  // ---------------------------------------------------------------- frame

  /**
   * Draw one frame.
   * @param t song time (seconds)
   * @param dt seconds since previous frame (drives sparks; use 1/fps when exporting)
   * @param live live-played notes, times in the same clock as `liveNow`
   */
  frame(t: number, dt: number, live: LiveNote[] = [], liveNow = 0) {
    if (!this.scene) return;
    const gl = this.gl;
    const L = this.layout();
    const { W, H, scale, whiteW, blackW, keyY } = L;
    const s = this.settings;
    const pps = keyY / s.fall;
    this.time += dt;
    this.anim += dt * (s.motion ?? 1);
    this.count = 0;

    // Precompute key columns.
    const cols = new Map<number, [number, number, boolean]>();
    for (let p = this.lo; p <= this.hi; p++) cols.set(p, this.keyX(p, whiteW, blackW));

    // Pressed state per key: color, amount, velocity, onset age
    const pressed = new Map<number, { c: RGB; amt: number; vel: number; age: number }>();

    // Lane lines on every C.
    for (let p = this.lo; p <= this.hi; p++) {
      if (p % 12 !== 0) continue;
      const [cx] = cols.get(p)!;
      this.push(cx - whiteW / 2 - 0.5 * scale, 0, Math.max(1, scale), keyY, [1, 1, 1], 0.025, 5, 0, 0, -1);
    }

    // ---- song notes (falling)
    const notesDrawn: { n: Note; x: number; w: number; act: number }[] = [];
    if (this.song) {
      const notes = this.song.notes;
      const from = lowerBound(notes, t - this.maxLen - 0.1);
      const horizon = t + s.fall * 1.02;
      for (let i = from; i < notes.length; i++) {
        const n = notes[i];
        if (n.start > horizon) break;
        if (n.end < t) continue;
        const col = cols.get(n.pitch);
        if (!col) continue;
        const [cx, kw, black] = col;
        const w = kw * (black ? 0.9 : 0.84);
        const top = keyY - (n.end - t) * pps;
        const bottom = Math.min(keyY, keyY - (n.start - t) * pps);
        if (bottom - top < 0.5) continue;
        const act = n.start <= t ? 1 : 0;
        notesDrawn.push({ n, x: cx, w, act });
        if (act) {
          const c = this.hands[n.hand];
          const age = t - n.start;
          const prev = pressed.get(n.pitch);
          if (!prev || prev.age > age) pressed.set(n.pitch, { c, amt: 1, vel: n.velocity, age });
          this.onset(`${i}`, n.start, cx, w, c, n.velocity, keyY, scale, t);
        }
      }
    }

    // Draw white-key-column notes first, black on top, so overlaps read cleanly.
    for (const pass of [false, true]) {
      for (const d of notesDrawn) {
        if (isBlack(d.n.pitch) !== pass) continue;
        const n = d.n;
        const top = keyY - (n.end - t) * pps;
        const bottom = Math.min(keyY, keyY - (n.start - t) * pps);
        const c = this.hands[n.hand];
        const vb = 0.8 + 0.35 * n.velocity;
        this.push(
          d.x - d.w / 2,
          top,
          d.w,
          bottom - top,
          [c[0] * vb, c[1] * vb, c[2] * vb],
          1,
          0,
          Math.min(d.w * 0.32, 7 * scale),
          d.act,
          noteSeed(n.pitch, n.start),
        );
      }
    }

    // ---- live notes (rising from the keys)
    for (const ln of live) {
      const col = cols.get(ln.pitch);
      if (!col) continue;
      const [cx, kw, black] = col;
      const w = kw * (black ? 0.9 : 0.84);
      const hand = ln.pitch < 60 ? 0 : 1;
      const c = this.hands[hand];
      const top = keyY - (liveNow - ln.start) * pps;
      const bottom = ln.end === null ? keyY : keyY - (liveNow - ln.end) * pps;
      const held = ln.end === null;
      if (bottom > 0 && bottom - top > 0.5) {
        this.push(cx - w / 2, Math.max(-20, top), w, bottom - Math.max(-20, top), c, 1, 0, Math.min(w * 0.32, 7 * scale), held ? 1 : 0, noteSeed(ln.pitch, ln.start));
      }
      if (held) {
        const age = liveNow - ln.start;
        pressed.set(ln.pitch, { c, amt: 1, vel: ln.velocity, age });
        this.onset(`live${ln.pitch}:${ln.start}`, ln.start, cx, w, c, ln.velocity, keyY, scale, liveNow);
      }
    }

    // ---- keyboard
    const kbStart = this.count;
    this.push(0, keyY, W, H - keyY, [0.004, 0.004, 0.005], 1, 5, 0, 0, 0);
    for (let p = this.lo; p <= this.hi; p++) {
      if (isBlack(p)) continue;
      const [cx] = cols.get(p)!;
      const pr = pressed.get(p);
      const gap = Math.max(1, 1.4 * scale);
      this.push(cx - whiteW / 2 + gap / 2, keyY, whiteW - gap, H - keyY + 4 * scale, pr ? pr.c : [1, 1, 1], 1, 1, 0, pr ? pr.amt : 0, 0);
    }
    const blackH = (H - keyY) * 0.63;
    for (let p = this.lo; p <= this.hi; p++) {
      if (!isBlack(p)) continue;
      const [cx] = cols.get(p)!;
      const pr = pressed.get(p);
      this.push(cx - blackW / 2, keyY - 2 * scale, blackW, blackH, pr ? pr.c : [1, 1, 1], 1, 2, 0, pr ? pr.amt : 0, 0);
    }
    // Shadow cast by the rail onto the keys.
    this.push(0, keyY, W, 16 * scale, [0, 0, 0], 0.55, 5, 0, 0, 1);
    void kbStart;

    // ---- rail: thin light line + glow where keys are hit
    let gr = 0;
    let gg = 0;
    let gb = 0;
    let gsum = 0;
    let gx = 0;
    const avg: RGB = [
      (this.hands[0][0] + this.hands[1][0]) / 2,
      (this.hands[0][1] + this.hands[1][1]) / 2,
      (this.hands[0][2] + this.hands[1][2]) / 2,
    ];
    this.push(0, keyY - 1.5 * scale, W, 2 * scale, [avg[0] * 0.5, avg[1] * 0.5, avg[2] * 0.5], 1, 5, 0, 0, 0);

    for (const [p, pr] of pressed) {
      const [cx, kw] = cols.get(p) ?? [0, 0, false];
      const flash = 1 + 1.6 * Math.exp(-pr.age * 10);
      const k = (0.55 + 0.6 * pr.vel) * flash * s.glow;
      const c = pr.c;
      // Wide soft bloom above the rail.
      this.push(cx - kw * 2.2, keyY - 60 * scale, kw * 4.4, 120 * scale, c, 0.55 * k, 3, 0, 0, 0);
      // Hot core on the rail.
      this.push(cx - kw * 0.9, keyY - 5 * scale, kw * 1.8, 10 * scale, [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5], 1.6 * k, 3, 0, 0, 0);
      gr += c[0] * k;
      gg += c[1] * k;
      gb += c[2] * k;
      gx += cx * k;
      gsum += k;
    }

    // ---- sparks
    this.stepSparks(dt, pressed, cols, keyY, scale, s.sparks);
    const sp = this.sparks;
    for (let i = 0; i < this.sparkCount; i++) {
      const o = i * 10;
      const life = sp[o + 5];
      const a = sp[o + 4] / life;
      const fade = Math.min(1, a * 8) * (1 - a) * (1 - a);
      const size = sp[o + 6] * (1 - a * 0.5);
      this.push(sp[o] - size, sp[o + 1] - size, size * 2, size * 2, [sp[o + 7], sp[o + 8], sp[o + 9]], 2.4 * fade, 4, 0, 0, 0);
    }

    // Smoothed stage glow (exponential, dt-based so export matches live).
    const target = gsum > 0 ? Math.min(1, gsum / 4) : 0;
    const k = 1 - Math.exp(-dt * 6);
    this.glowAmt += (target - this.glowAmt) * k;
    if (gsum > 0) {
      const tc: RGB = [gr / gsum, gg / gsum, gb / gsum];
      for (let i = 0; i < 3; i++) this.glowColor[i] += (tc[i] - this.glowColor[i]) * k;
      this.glowX += (gx / gsum / W - this.glowX) * k;
    }

    // ---------------------------------------------------------- GPU passes
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(this.bgProg);
    this.u2(this.bgProg, 'uRes', W, H);
    this.u3(this.bgProg, 'uTop', this.bg[0]);
    this.u3(this.bgProg, 'uBot', this.bg[1]);
    this.u3(this.bgProg, 'uGlow', this.glowColor);
    this.u1(this.bgProg, 'uGlowAmt', this.glowAmt * s.glow);
    this.u1(this.bgProg, 'uGlowX', this.glowX * W);
    this.u1(this.bgProg, 'uKeyY', keyY);
    this.u1(this.bgProg, 'uTime', this.anim);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.shapeProg);
    this.u2(this.shapeProg, 'uRes', W, H);
    this.u1(this.shapeProg, 'uScale', scale);
    this.u1(this.shapeProg, 'uAnim', this.anim);
    this.u1(this.shapeProg, 'uStyle', STYLE_ID[s.style] ?? 0);
    gl.bindVertexArray(this.shapeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.disable(gl.BLEND);

    // Bloom: bright pass -> downsample chain -> additive upsample.
    gl.bindVertexArray(this.emptyVao);
    const b = this.bloom;
    this.pass(this.brightProg, b[0], this.scene, { uThreshold: 0.6 });
    for (let i = 1; i < b.length; i++) this.pass(this.downProg, b[i], b[i - 1]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = b.length - 2; i >= 0; i--) this.pass(this.upProg, b[i], b[i + 1], { uWeight: 1 });
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b[0].tex);
    this.ui(this.compProg, 'uScene', 0);
    this.ui(this.compProg, 'uBloom', 1);
    this.u1(this.compProg, 'uBloomAmt', 0.32 * s.glow);
    this.u2(this.compProg, 'uRes', W, H);
    this.u1(this.compProg, 'uTime', this.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------------------------------------------------------- sparks

  private onset(key: string, start: number, cx: number, w: number, c: RGB, vel: number, keyY: number, scale: number, now: number) {
    if (this.lastOnsetSeen.has(key)) return;
    this.lastOnsetSeen.set(key, start);
    if (this.lastOnsetSeen.size > 4000) {
      // Forget the oldest half.
      const keep = [...this.lastOnsetSeen].slice(2000);
      this.lastOnsetSeen = new Map(keep);
    }
    if (now - start > 0.25) return; // seeked into the middle of a note
    const n = Math.round((6 + 14 * vel) * this.settings.sparks);
    for (let i = 0; i < n; i++) this.spawn(cx, w, c, keyY, scale, 1.6);
  }

  private spawn(cx: number, w: number, c: RGB, keyY: number, scale: number, power: number) {
    if (this.sparkCount >= MAX_SPARKS) return;
    const r = this.rand;
    const o = this.sparkCount++ * 10;
    const sp = this.sparks;
    sp[o] = cx + (r() - 0.5) * w;
    sp[o + 1] = keyY - 2 * scale;
    sp[o + 2] = (r() - 0.5) * 70 * scale * power;
    sp[o + 3] = -(60 + r() * 220) * scale * power;
    sp[o + 4] = 0;
    sp[o + 5] = 0.45 + r() * 0.9;
    sp[o + 6] = (1.2 + r() * 2.6) * scale;
    const white = 0.25 + r() * 0.35;
    sp[o + 7] = c[0] + (1 - c[0]) * white;
    sp[o + 8] = c[1] + (1 - c[1]) * white;
    sp[o + 9] = c[2] + (1 - c[2]) * white;
  }

  private stepSparks(
    dt: number,
    pressed: Map<number, { c: RGB; vel: number }>,
    cols: Map<number, [number, number, boolean]>,
    keyY: number,
    scale: number,
    amount: number,
  ) {
    if (dt <= 0) return;
    // Continuous trickle while keys are held.
    for (const [p, pr] of pressed) {
      const col = cols.get(p);
      if (!col) continue;
      const rate = 28 * amount * (0.4 + pr.vel);
      let n = rate * dt;
      while (n > 0) {
        if (n >= 1 || this.rand() < n) this.spawn(col[0], col[1] * 0.8, pr.c, keyY, scale, 0.8);
        n -= 1;
      }
    }
    const sp = this.sparks;
    const drag = Math.exp(-dt * 1.6);
    let j = 0;
    for (let i = 0; i < this.sparkCount; i++) {
      const o = i * 10;
      sp[o + 4] += dt;
      if (sp[o + 4] >= sp[o + 5]) continue;
      sp[o + 2] = sp[o + 2] * drag + Math.sin(sp[o + 1] * 0.03 + this.anim * 2 + i) * 18 * scale * dt;
      sp[o + 3] = sp[o + 3] * drag - 40 * scale * dt;
      sp[o] += sp[o + 2] * dt;
      sp[o + 1] += sp[o + 3] * dt;
      if (j !== i) sp.copyWithin(j * 10, o, o + 10);
      j++;
    }
    this.sparkCount = j;
  }

  // ---------------------------------------------------------------- GL helpers

  private push(
    x: number,
    y: number,
    w: number,
    h: number,
    c: RGB | number[],
    a: number,
    kind: number,
    radius: number,
    active: number,
    extra: number,
  ) {
    if (this.count >= MAX_SHAPES) return;
    const o = this.count++ * FLOATS;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = w;
    d[o + 3] = h;
    d[o + 4] = c[0];
    d[o + 5] = c[1];
    d[o + 6] = c[2];
    d[o + 7] = a;
    d[o + 8] = kind;
    d[o + 9] = radius;
    d[o + 10] = active;
    d[o + 11] = extra;
  }

  private pass(prog: WebGLProgram, dst: Target, src: Target, extra: Record<string, number> = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    this.ui(prog, 'uTex', 0);
    this.u2(prog, 'uTexel', 1 / src.w, 1 / src.h);
    for (const k in extra) this.u1(prog, k, extra[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error');
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    this.uniforms.set(p, new Map());
    return p;
  }

  private loc(p: WebGLProgram, name: string) {
    const m = this.uniforms.get(p)!;
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }
  private u1(p: WebGLProgram, n: string, v: number) {
    this.gl.uniform1f(this.loc(p, n), v);
  }
  private ui(p: WebGLProgram, n: string, v: number) {
    this.gl.uniform1i(this.loc(p, n), v);
  }
  private u2(p: WebGLProgram, n: string, a: number, b: number) {
    this.gl.uniform2f(this.loc(p, n), a, b);
  }
  private u3(p: WebGLProgram, n: string, v: RGB | number[]) {
    this.gl.uniform3f(this.loc(p, n), v[0], v[1], v[2]);
  }
}

function lowerBound(notes: Note[], t: number) {
  let a = 0;
  let b = notes.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (notes[m].start < t) a = m + 1;
    else b = m;
  }
  return a;
}
