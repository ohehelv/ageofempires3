// ---------------------------------------------------------------------------
// 05_nav.js — navigation grid, line-of-walk checks, weighted A*
// ---------------------------------------------------------------------------
const BL_TERRAIN = 1, BL_TREE = 2, BL_BUILD = 4, BL_RES = 8;
const NAV_DX = [-1, -1, -1, 0, 0, 1, 1, 1];
const NAV_DZ = [-1, 0, 1, -1, 1, -1, 0, 1];

class Nav {
  constructor(N) {
    this.N = N;
    const n = N * N;
    this.block = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 1;
    this.heapI = new Int32Array(n * 3);
    this.heapF = new Float32Array(n * 3);
    this.heapN = 0;
    this.region = null; // connected components for fast unreachable checks
  }
  idx(cx, cz) { return cz * this.N + cx; }
  inb(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.N && cz < this.N; }
  free(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.N && cz < this.N && this.block[cz * this.N + cx] === 0; }
  freeW(x, z) { return this.free(Math.floor(x / CELL), Math.floor(z / CELL)); }
  setRect(cx0, cz0, w, h, flag, on) {
    for (let z = cz0; z < cz0 + h; z++) for (let x = cx0; x < cx0 + w; x++) {
      if (!this.inb(x, z)) continue;
      const i = z * this.N + x;
      if (on) this.block[i] |= flag; else this.block[i] &= ~flag;
    }
  }
  rectFree(cx0, cz0, w, h) {
    for (let z = cz0; z < cz0 + h; z++) for (let x = cx0; x < cx0 + w; x++) if (!this.free(x, z)) return false;
    return true;
  }
  nearestFree(cx, cz, maxR = 24) {
    if (this.free(cx, cz)) return { cx, cz };
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        if (this.free(cx + dx, cz + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = { cx: cx + dx, cz: cz + dz }; } }
      }
      if (best) return best;
    }
    return null;
  }
  // nearest free cell to (tx,tz) preferring the side facing (fx,fz)
  nearestFreeToward(tcx, tcz, fx, fz, maxR = 12) {
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const cx = tcx + dx, cz = tcz + dz;
        if (!this.free(cx, cz)) continue;
        const d = dist2((cx + 0.5) * CELL, (cz + 0.5) * CELL, fx, fz);
        if (d < bd) { bd = d; best = { cx, cz }; }
      }
      if (best) return best;
    }
    return null;
  }

  // Amanatides–Woo traversal; corners must be clear on both sides
  los(x0, z0, x1, z1) {
    let cx = Math.floor(x0 / CELL), cz = Math.floor(z0 / CELL);
    const ex = Math.floor(x1 / CELL), ez = Math.floor(z1 / CELL);
    const dx = x1 - x0, dz = z1 - z0;
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tmx = dx !== 0 ? (sx > 0 ? (cx + 1) * CELL - x0 : x0 - cx * CELL) / Math.abs(dx) : Infinity;
    let tmz = dz !== 0 ? (sz > 0 ? (cz + 1) * CELL - z0 : z0 - cz * CELL) / Math.abs(dz) : Infinity;
    let guard = Math.abs(ex - cx) + Math.abs(ez - cz) + 4;
    while (true) {
      if (!this.free(cx, cz)) return false;
      if (cx === ex && cz === ez) return true;
      if (Math.abs(tmx - tmz) < 1e-7) {
        if (!this.free(cx + sx, cz) || !this.free(cx, cz + sz)) return false;
        cx += sx; cz += sz; tmx += tdx; tmz += tdz;
      } else if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
      if (--guard < 0) return false;
    }
  }
  losWide(x0, z0, x1, z1, r = 0.45) {
    if (!this.los(x0, z0, x1, z1)) return false;
    const dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz);
    if (l < 0.01) return true;
    const nx = (-dz / l) * r, nz = (dx / l) * r;
    return this.los(x0 + nx, z0 + nz, x1 + nx, z1 + nz) && this.los(x0 - nx, z0 - nz, x1 - nx, z1 - nz);
  }

  // connected regions (8-connected, no corner cutting) for quick reachability tests
  computeRegions() {
    const N = this.N, reg = new Int32Array(N * N).fill(-1);
    const stack = new Int32Array(N * N);
    let id = 0;
    for (let s = 0; s < N * N; s++) {
      if (reg[s] !== -1 || this.block[s] & (BL_TERRAIN)) continue;
      let sp = 0; stack[sp++] = s; reg[s] = id;
      while (sp > 0) {
        const c = stack[--sp], cx = c % N, cz = (c / N) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
          const ni = nz * N + nx;
          if (reg[ni] !== -1 || this.block[ni] & BL_TERRAIN) continue;
          reg[ni] = id; stack[sp++] = ni;
        }
      }
      id++;
    }
    this.region = reg;
  }

  _push(i, f) {
    let k = this.heapN++;
    const H = this.heapI, F = this.heapF;
    if (k >= H.length) { this.heapN--; return; }
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (F[p] <= f) break;
      H[k] = H[p]; F[k] = F[p]; k = p;
    }
    H[k] = i; F[k] = f;
  }
  _pop() {
    const H = this.heapI, F = this.heapF;
    const top = H[0];
    const n = --this.heapN;
    if (n > 0) {
      const li = H[n], lf = F[n];
      let k = 0;
      while (true) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && F[c + 1] < F[c]) c++;
        if (F[c] >= lf) break;
        H[k] = H[c]; F[k] = F[c]; k = c;
      }
      H[k] = li; F[k] = lf;
    }
    return top;
  }

  // goal: { x0, z0, x1, z1 } inclusive cell rect, range in cells (euclidean, measured to rect)
  findPath(sx, sz, goal, maxNodes = 26000, wx, wz) {
    const N = this.N;
    let scx = clamp(Math.floor(sx / CELL), 0, N - 1), scz = clamp(Math.floor(sz / CELL), 0, N - 1);
    if (!this.free(scx, scz)) {
      const nf = this.nearestFree(scx, scz, 6);
      if (!nf) return null;
      scx = nf.cx; scz = nf.cz;
    }
    const range = goal.range || 0, r2 = range * range;
    const gx0 = goal.x0, gz0 = goal.z0, gx1 = goal.x1, gz1 = goal.z1;
    const dToRect = (cx, cz) => {
      const dx = Math.max(gx0 - cx, 0, cx - gx1), dz = Math.max(gz0 - cz, 0, cz - gz1);
      return [dx, dz];
    };
    const heur = (cx, cz) => {
      let dx = Math.max(gx0 - range - cx, 0, cx - gx1 - range), dz = Math.max(gz0 - range - cz, 0, cz - gz1 - range);
      return dx + dz - 0.5858 * Math.min(dx, dz);
    };
    const inGoal = (cx, cz) => { const [dx, dz] = dToRect(cx, cz); return dx * dx + dz * dz <= r2 + 1e-6; };

    if (++this.gen > 4000000000) { this.gen = 1; this.seen.fill(0); this.closed.fill(0); }
    const gen = this.gen, g = this.g, parent = this.parent, seen = this.seen, closed = this.closed, block = this.block;
    this.heapN = 0;
    const start = scz * N + scx;
    g[start] = 0; seen[start] = gen; parent[start] = -1;
    this._push(start, heur(scx, scz));
    let best = start, bestH = heur(scx, scz), found = false, expanded = 0;
    const W = 1.15;
    while (this.heapN > 0) {
      const cur = this._pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      const cx = cur % N, cz = (cur / N) | 0;
      if (inGoal(cx, cz)) { best = cur; found = true; break; }
      const hc = heur(cx, cz);
      if (hc < bestH) { bestH = hc; best = cur; }
      if (++expanded > maxNodes) break;
      const gc = g[cur];
      for (let k = 0; k < 8; k++) {
        const dx = NAV_DX[k], dz = NAV_DZ[k];
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = nz * N + nx;
        if (block[ni] !== 0 || closed[ni] === gen) continue;
        const diag = dx !== 0 && dz !== 0;
        if (diag && (block[cz * N + nx] !== 0 || block[nz * N + cx] !== 0)) continue;
        const ng = gc + (diag ? 1.41421 : 1);
        if (seen[ni] !== gen || ng < g[ni]) {
          seen[ni] = gen; g[ni] = ng; parent[ni] = cur;
          this._push(ni, ng + heur(nx, nz) * W);
        }
      }
    }
    this.lastExpanded = expanded;
    // reconstruct
    const cells = [];
    for (let c = best; c !== -1; c = parent[c]) { cells.push(c); if (cells.length > N * N) break; }
    cells.reverse();
    // smooth
    const pts = [];
    let ax = sx, az = sz;
    const cxw = (c) => ((c % N) + 0.5) * CELL, czw = (c) => (((c / N) | 0) + 0.5) * CELL;
    for (let i = 1; i < cells.length; i++) {
      const nxt = i + 1 < cells.length ? cells[i + 1] : -1;
      const tx = nxt >= 0 ? cxw(nxt) : cxw(cells[i]), tz = nxt >= 0 ? czw(nxt) : czw(cells[i]);
      if (nxt < 0 || !this.losWide(ax, az, tx, tz)) {
        const px = cxw(cells[i]), pz = czw(cells[i]);
        pts.push({ x: px, z: pz });
        ax = px; az = pz;
      }
    }
    // exact final point if it is walkable and visible from the last waypoint
    if (found && wx !== undefined) {
      const last = pts.length ? pts[pts.length - 1] : { x: sx, z: sz };
      if (this.freeW(wx, wz) && this.losWide(last.x, last.z, wx, wz, 0.3)) {
        if (pts.length && dist(last.x, last.z, wx, wz) < 2.2 && pts.length > 0) pts[pts.length - 1] = { x: wx, z: wz };
        else pts.push({ x: wx, z: wz });
      }
    }
    return { pts, found };
  }
}
