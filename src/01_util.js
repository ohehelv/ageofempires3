// ---------------------------------------------------------------------------
// 01_util.js — math, RNG, noise, small helpers
// ---------------------------------------------------------------------------
const PI = Math.PI, TAU = Math.PI * 2;
const CELL = 2;            // meters per navigation / fog cell
const TICK = 0.05;         // simulation step (20 Hz)
const WATER_Y = 0;         // water surface height

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
const angleDiff = (a, b) => ((((b - a + PI) % TAU) + TAU) % TAU) - PI;
const angleLerp = (a, b, t) => a + angleDiff(a, b) * t;

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.next()); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  weighted(obj) { // {key: weight}
    let total = 0; for (const k in obj) total += obj[k];
    let r = this.next() * total;
    for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
    return Object.keys(obj)[0];
  }
}

// 2D simplex noise (seeded)
class Noise2D {
  constructor(rng) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise(x, y) {
    const F2 = 0.36602540378, G2 = 0.2113248654;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255, perm = this.perm;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { t0 *= t0; n += t0 * t0 * Noise2D.g(perm[ii + perm[jj]], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { t1 *= t1; n += t1 * t1 * Noise2D.g(perm[ii + i1 + perm[jj + j1]], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { t2 *= t2; n += t2 * t2 * Noise2D.g(perm[ii + 1 + perm[jj + 1]], x2, y2); }
    return 70 * n;
  }
  static g(h, x, y) {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  }
  fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) { s += a * this.noise(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  }
}

// periodic value noise for tileable textures
function tileNoise(size, period, seed) {
  const rng = new RNG(seed);
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = rng.next();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * period, fy = (y / size) * period;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = lat[(y0 % period) * period + (x0 % period)];
    const b = lat[(y0 % period) * period + ((x0 + 1) % period)];
    const c = lat[((y0 + 1) % period) * period + (x0 % period)];
    const d = lat[((y0 + 1) % period) * period + ((x0 + 1) % period)];
    out[y * size + x] = lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }
  return out;
}
function tileFbm(size, basePeriod, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(size, period, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp; amp *= 0.5; period *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function fmtNum(n) { return Math.floor(n).toLocaleString('ru-RU'); }
function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function hexToCss(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
function costTotal(c) { if (!c) return 0; let s = 0; for (const r in c) s += c[r] || 0; return s; }

// Russian plural helper: plural(5, ['поселенец','поселенца','поселенцев'])
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

// simple event emitter
class Emitter {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] || (this.h[ev] = [])).push(fn); }
  emit(ev, a, b, c) { const l = this.h[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c); }
}
