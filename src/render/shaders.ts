export const FULLSCREEN_VS = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const BACKGROUND_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform vec3 uTop;
uniform vec3 uBot;
uniform vec3 uGlow;
uniform float uGlowAmt;
uniform float uGlowX;
uniform float uKeyY;
uniform float uTime;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float v = clamp(px.y / uKeyY, 0.0, 1.0);
  vec3 col = mix(uTop, uBot, pow(v, 1.6));

  // Slow drifting haze so the background never looks flat.
  vec2 q = px / uRes.y * 1.6;
  float n = fbm(q + vec2(uTime * 0.012, -uTime * 0.025));
  col *= 0.75 + 0.5 * n;

  // Stage light rising from the keys, colored by what is playing.
  vec2 g = vec2((px.x - uGlowX) / (uRes.x * 0.4), (px.y - uKeyY) / (uKeyY * 0.42));
  col += uGlow * uGlowAmt * exp(-dot(g, g) * 2.2) * 0.045;

  o = vec4(col, 1.0);
}`;

export const SHAPE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aRect;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aParams;
uniform vec2 uRes;
out vec2 vLocal;
out vec2 vSize;
out vec4 vColor;
out vec4 vParams;
void main() {
  float pad = aParams.x < 2.5 ? 1.0 : 0.0;
  vec2 p = aRect.xy - pad + aCorner * (aRect.zw + 2.0 * pad);
  vLocal = p - (aRect.xy + aRect.zw * 0.5);
  vSize = aRect.zw;
  vColor = aColor;
  vParams = aParams;
  vec2 clip = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

/**
 * kinds: 0 note, 1 white key, 2 black key, 3 glow (additive), 4 spark (additive), 5 flat / gradient
 * params: x kind, y radius, z active / pressed, w extra (notes: 0..1 seed)
 * Output is premultiplied; additive shapes write alpha 0.
 */
export const SHAPE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vSize;
in vec4 vColor;
in vec4 vParams;
uniform float uScale;
uniform float uAnim;
uniform float uStyle;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm3(vec2 p) {
  return 0.55 * noise(p) + 0.3 * noise(p * 2.07 + 3.1) + 0.15 * noise(p * 4.13 + 7.7);
}

float sdRB(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  int k = int(vParams.x + 0.5);
  vec2 hs = vSize * 0.5;
  float t = clamp(vLocal.y / max(vSize.y, 1.0) + 0.5, 0.0, 1.0);
  vec3 c = vColor.rgb;

  if (k == 0) {
    float r = min(vParams.y, min(hs.x, hs.y));
    float d = sdRB(vLocal, hs, r);
    float a = clamp(0.5 - d, 0.0, 1.0);
    if (a <= 0.0) discard;
    float act = vParams.z;
    // Body: darker at the tail, brighter at the leading edge.
    vec3 col = c * (0.42 + 0.5 * t);
    // Soft glass sheen across the width.
    float xs = vLocal.x / max(hs.x, 1.0);
    col *= 0.9 + 0.18 * (1.0 - xs * xs);
    // Bright rim.
    float rim = 1.0 - smoothstep(0.0, 1.8 * uScale, -d);
    col = mix(col, c * 1.35 + 0.06, rim * 0.6);
    // Lit while sounding.
    col *= 1.0 + act * 1.5;
    col += act * c * 0.35 * t;

    // Note styles. y is measured in note widths so the pattern looks the same on short and long notes.
    float seed = vParams.w;
    vec2 nuv = vec2(xs, vLocal.y / max(vSize.x, 1.0));
    float edge = 1.0 - rim * 0.6;
    if (uStyle > 0.5 && uStyle < 1.5) {
      // Flame: a few tall, licking tongues climbing up the note, hottest at the leading edge.
      vec2 q = vec2(xs * 0.8, nuv.y * 0.55);
      float warp = noise(q * 2.0 + vec2(seed * 9.0, uAnim * 1.2)) - 0.5;
      vec2 p = vec2(q.x + warp * 0.5, q.y + uAnim * 0.9) * 2.0 + seed * 13.0;
      float body = fbm3(p) - abs(xs + warp * 0.4) * 0.45 + (t - 0.5) * 0.25;
      float f = smoothstep(0.33, 0.75, body) * edge;
      col *= 0.5 + 0.2 * t;
      col += c * f * (1.0 + act * 0.8);
      col += mix(c, vec3(1.0, 0.85, 0.6), 0.7) * pow(f, 2.5) * (0.6 + act * 0.6);
    } else if (uStyle > 1.5) {
      // Plasma: bright filaments where a few moving sine fields line up.
      float a2 = uAnim;
      float v = sin(xs * 2.6 + a2 * 1.3 + seed * 6.0)
              + sin(nuv.y * 1.9 - a2 * 1.7)
              + sin((xs * 1.5 + nuv.y) * 1.4 + a2 * 1.1 + seed * 3.0)
              + sin(length(vec2(xs * 1.8, nuv.y * 0.8 - sin(a2 * 0.7))) * 3.0 - a2 * 2.0);
      float lines = pow(1.0 - abs(sin(v * 1.6)), 6.0) * edge;
      float swell = 0.5 + 0.5 * sin(v * 0.8 + a2);
      col *= 0.62 + 0.3 * swell;
      col += mix(c, vec3(1.0), 0.5) * lines * (0.75 + act * 0.8);
      col += mix(c, c.gbr, 0.25) * swell * 0.22;
    }
    o = vec4(col, 1.0) * a * vColor.a;
    return;
  }

  if (k == 1) {
    float d = sdRB(vLocal, hs, 2.5 * uScale);
    float a = clamp(0.5 - d, 0.0, 1.0);
    float p = vParams.z;
    vec3 col = vec3(0.50, 0.50, 0.53) * (0.72 + 0.28 * t);
    col *= mix(1.0, 0.62, smoothstep(0.935, 0.975, t) * (1.0 - p));
    col *= 0.35 + 0.65 * smoothstep(0.0, 0.07, t);
    vec3 lit = c * (0.85 + 0.75 * (1.0 - t));
    col = mix(col, lit, p * 0.9);
    o = vec4(col, 1.0) * a;
    return;
  }

  if (k == 2) {
    float d = sdRB(vLocal, hs, 2.0 * uScale);
    float a = clamp(0.5 - d, 0.0, 1.0);
    float p = vParams.z;
    vec3 col = vec3(0.008) + vec3(0.02) * t;
    float bevel = smoothstep(0.84, 0.88, t) * (1.0 - smoothstep(0.96, 1.0, t));
    col += vec3(0.05) * bevel;
    float side = smoothstep(hs.x - 2.0 * uScale, hs.x, abs(vLocal.x));
    col += vec3(0.025) * side * (1.0 - t);
    vec3 lit = c * (0.45 + 0.7 * (1.0 - t));
    col = mix(col, lit, p * 0.92);
    o = vec4(col, 1.0) * a;
    return;
  }

  if (k == 3 || k == 4) {
    vec2 e = vLocal / max(hs, vec2(0.5));
    float r2 = dot(e, e);
    if (r2 > 1.0) discard;
    float g = k == 3 ? exp(-r2 * 4.0) * (1.0 - r2) : exp(-r2 * 5.0) + 0.6 * exp(-r2 * 28.0);
    o = vec4(c * g * vColor.a, 0.0);
    return;
  }

  // Flat / gradient (w = 1 fades to transparent toward the bottom, w = -1 toward the top)
  float a = vColor.a;
  if (vParams.w > 0.5) a *= 1.0 - t;
  else if (vParams.w < -0.5) a *= t;
  o = vec4(c * a, a);
}`;

export const BRIGHT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 o;
vec3 pick(vec2 uv) {
  vec3 c = texture(uTex, uv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.6;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float w = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * w;
}
void main() {
  // Karis-weighted 4-tap to keep tiny sparks from flickering.
  vec3 s = vec3(0.0);
  float ws = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 off = vec2(i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * uTexel;
    vec3 c = pick(vUv + off);
    float w = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
    s += c * w;
    ws += w;
  }
  o = vec4(s / ws, 1.0);
}`;

export const DOWN_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 o;
void main() {
  vec3 s = texture(uTex, vUv).rgb * 4.0;
  s += texture(uTex, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  s += texture(uTex, vUv + vec2( 1.0, -1.0) * uTexel).rgb;
  s += texture(uTex, vUv + vec2(-1.0,  1.0) * uTexel).rgb;
  s += texture(uTex, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
  o = vec4(s / 8.0, 1.0);
}`;

export const UP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uWeight;
out vec4 o;
void main() {
  vec2 d = uTexel;
  vec3 s = texture(uTex, vUv).rgb * 4.0;
  s += (texture(uTex, vUv + vec2(-d.x, 0)).rgb + texture(uTex, vUv + vec2(d.x, 0)).rgb
      + texture(uTex, vUv + vec2(0, -d.y)).rgb + texture(uTex, vUv + vec2(0, d.y)).rgb) * 2.0;
  s += texture(uTex, vUv - d).rgb + texture(uTex, vUv + d).rgb
     + texture(uTex, vUv + vec2(d.x, -d.y)).rgb + texture(uTex, vUv + vec2(-d.x, d.y)).rgb;
  o = vec4(s / 16.0 * uWeight, 1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform vec2 uRes;
uniform float uTime;
out vec4 o;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomAmt;
  c = aces(c * 1.1);
  vec2 v = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= mix(0.62, 1.0, smoothstep(1.2, 0.25, length(v)));
  c = pow(c, vec3(1.0 / 2.2));
  // Fine film grain doubles as dither against banding in the dark gradients.
  float n = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 917.0) - 0.5;
  c += n * (2.5 / 255.0);
  o = vec4(c, 1.0);
}`;
