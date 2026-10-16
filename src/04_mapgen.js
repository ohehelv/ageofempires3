// ---------------------------------------------------------------------------
// 04_mapgen.js — procedural map: relief, water, forests, resources, treasures, trade route
// ---------------------------------------------------------------------------
const CK_LAND = 0, CK_SHALLOW = 1, CK_WATER = 2, CK_CLIFF = 3;

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, pz, ax + dx * t, az + dz * t);
}
function polyDist(px, pz, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = segDist(px, pz, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
    if (d < best) best = d;
  }
  return best;
}
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function generateMap(setup) {
  const size = MAP_SIZES[setup.mapSize].size;
  const N = size / CELL, V = N + 1;
  const rng = new RNG(setup.seed);
  const nA = new Noise2D(rng), nB = new Noise2D(rng), nF = new Noise2D(rng), nG = new Noise2D(rng), nS = new Noise2D(rng);
  const biome = BIOMES[setup.biome];
  const nP = setup.players.length;
  const C = size / 2;
  const H = new Float32Array(V * V);

  // ---------------- player starts (teams sit next to each other)
  const order = setup.players.map((p, i) => i).sort((a, b) => (setup.players[a].team - setup.players[b].team) || (a - b));
  const a0 = rng.next() * TAU;
  const R = size * (nP === 2 ? 0.35 : 0.335);
  const starts = new Array(nP);
  order.forEach((pi, k) => {
    const ang = a0 + (k * TAU) / nP + rng.range(-0.08, 0.08);
    starts[pi] = { x: C + Math.cos(ang) * R, z: C + Math.sin(ang) * R, angle: ang };
  });

  // ---------------- trade route: choose the direction that stays farthest from all starts
  let bestDir = 0, bestScore = -1;
  for (let deg = 0; deg < 180; deg += 3) {
    const a = (deg * PI) / 180, dx = Math.cos(a), dz = Math.sin(a);
    let minD = 1e9;
    for (const s of starts) minD = Math.min(minD, Math.abs((s.x - C) * dz - (s.z - C) * dx));
    if (minD > bestScore) { bestScore = minD; bestDir = a; }
  }
  const rdx = Math.cos(bestDir), rdz = Math.sin(bestDir);
  const ctrl = [];
  const half = size / 2 - 3, nCtrl = 7;
  for (let i = 0; i < nCtrl; i++) {
    const t = i / (nCtrl - 1);
    const along = -half + 2 * half * t;
    const lat = (i === 0 || i === nCtrl - 1) ? 0 : rng.range(-1, 1) * size * 0.04;
    ctrl.push({ x: C + rdx * along - rdz * lat, z: C + rdz * along + rdx * lat });
  }
  const routePts = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const segLen = dist(p1.x, p1.z, p2.x, p2.z), steps = Math.ceil(segLen / 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      routePts.push({ x: catmull(p0.x, p1.x, p2.x, p3.x, t), z: catmull(p0.z, p1.z, p2.z, p3.z, t) });
    }
  }
  routePts.push({ x: ctrl[ctrl.length - 1].x, z: ctrl[ctrl.length - 1].z });
  // arc length
  const routeLen = [0];
  for (let i = 1; i < routePts.length; i++) routeLen.push(routeLen[i - 1] + dist(routePts[i - 1].x, routePts[i - 1].z, routePts[i].x, routePts[i].z));
  const coarseRoute = routePts.filter((p, i) => i % 3 === 0 || i === routePts.length - 1);
  const routeTotal = routeLen[routeLen.length - 1];
  function routeAt(frac) {
    const L = frac * routeTotal;
    let i = 1; while (i < routeLen.length - 1 && routeLen[i] < L) i++;
    const t = (L - routeLen[i - 1]) / Math.max(1e-6, routeLen[i] - routeLen[i - 1]);
    const a = routePts[i - 1], b = routePts[i];
    const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    const len = dist(a.x, a.z, b.x, b.z) || 1;
    return { x, z, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len };
  }
  const sockets = [];
  const socketFracs = nP <= 2 ? [0.17, 0.39, 0.61, 0.83] : [0.12, 0.27, 0.42, 0.58, 0.73, 0.88];
  for (const f of socketFracs) {
    const p = routeAt(f);
    // put the socket beside the road, on the side facing the nearest player
    let near = starts[0], nd = 1e9;
    for (const s of starts) { const d = dist(s.x, s.z, p.x, p.z); if (d < nd) { nd = d; near = s; } }
    const nx = -p.tz, nz = p.tx;
    const side = ((near.x - p.x) * nx + (near.z - p.z) * nz) >= 0 ? 1 : -1;
    const sx = p.x + nx * side * 6, sz = p.z + nz * side * 6;
    sockets.push({ x: Math.round(sx / CELL) * CELL, z: Math.round(sz / CELL) * CELL, frac: f, rx: p.x, rz: p.z });
  }

  const minStartDist = (x, z) => { let m = 1e9; for (const s of starts) m = Math.min(m, dist(x, z, s.x, s.z)); return m; };

  // ---------------- features: hills / mesas, lakes
  const hills = [];
  const nHills = Math.round((biome.mesas ? 4 : 2) * (size / 320) + rng.range(0, 1.5));
  for (let tries = 0; tries < 400 && hills.length < nHills; tries++) {
    const x = rng.range(size * 0.12, size * 0.88), z = rng.range(size * 0.12, size * 0.88);
    const r = rng.range(14, 26) * (biome.mesas ? 1.1 : 1);
    if (minStartDist(x, z) < r + 42) continue;
    if (polyDist(x, z, coarseRoute) < r + 14) continue;
    if (hills.some((h) => dist(h.x, h.z, x, z) < h.r + r + 16)) continue;
    hills.push({ x, z, r, h: rng.range(6, 11) * (biome.mesas ? 1.15 : 0.9), mesa: biome.mesas || rng.chance(0.35) });
  }
  const lakes = [];
  const nLakes = biome.water === 'oasis' ? rng.int(1, 2) : Math.round((biome.water === 'river' ? 2 : 3) * (size / 320) + rng.range(0, 1.2));
  for (let tries = 0; tries < 600 && lakes.length < nLakes; tries++) {
    const x = rng.range(size * 0.1, size * 0.9), z = rng.range(size * 0.1, size * 0.9);
    const r = biome.water === 'oasis' ? rng.range(8, 13) : rng.range(12, 24);
    if (minStartDist(x, z) < r + 40) continue;
    if (polyDist(x, z, coarseRoute) < r + 14) continue;
    if (hills.some((h) => dist(h.x, h.z, x, z) < h.r + r + 8)) continue;
    if (lakes.some((l) => dist(l.x, l.z, x, z) < l.r + r + 20)) continue;
    lakes.push({ x, z, r, ex: rng.range(0.7, 1.3) });
  }

  // ---------------- heightfield
  for (let vz = 0; vz < V; vz++) for (let vx = 0; vx < V; vx++) {
    const x = vx * CELL, z = vz * CELL;
    let h = 1.7 + nA.fbm(x / 150, z / 150, 4) * 3.0 * biome.hills + nB.fbm(x / 42, z / 42, 3) * 0.8;
    h = Math.max(h, 0.55 + nB.noise(x / 20, z / 20) * 0.15);
    for (const hl of hills) {
      const w = 1 + 0.28 * nG.noise(x / 18 + hl.x, z / 18);
      const d = dist(x, z, hl.x, hl.z) / (hl.r * w);
      if (d < 1.15) {
        const p = hl.mesa ? smoothstep(1.0, 0.82, d) : Math.pow(Math.max(0, 1 - d * d), 2);
        h += hl.h * p * (hl.mesa ? (0.92 + 0.08 * nB.noise(x / 7, z / 7)) : 1);
      }
    }
    for (const lk of lakes) {
      const w = 1 + 0.22 * nG.noise(x / 14 + lk.x * 0.1, z / 14);
      const dx = (x - lk.x) / lk.ex, dz = (z - lk.z) * lk.ex;
      const d = Math.sqrt(dx * dx + dz * dz) / (lk.r * w);
      if (d < 1.4) {
        const s = smoothstep(1.35, 0.55, d);
        h = lerp(h, -2.6 - lk.r * 0.04, s);
      }
    }
    // flatten starts
    for (const s of starts) {
      const d = dist(x, z, s.x, s.z);
      if (d < 36) {
        const t = smoothstep(36, 20, d);
        h = lerp(h, 1.6 + nB.noise(x / 9, z / 9) * 0.12, t);
      }
    }
    // route corridor: keep it walkable and gentle
    const rd = polyDist(x, z, coarseRoute);
    if (rd < 9) {
      const t = smoothstep(9, 3, rd);
      h = lerp(h, Math.max(h, 1.0), t);
    }
    H[vz * V + vx] = h;
  }
  // light smoothing pass to kill spikes
  {
    const tmp = new Float32Array(H);
    for (let vz = 1; vz < V - 1; vz++) for (let vx = 1; vx < V - 1; vx++) {
      const i = vz * V + vx;
      tmp[i] = H[i] * 0.6 + (H[i - 1] + H[i + 1] + H[i - V] + H[i + V]) * 0.1;
    }
    H.set(tmp);
  }

  // ---------------- per-cell classification
  const cellH = new Float32Array(N * N);
  const kind = new Uint8Array(N * N);
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const a = H[cz * V + cx], b = H[cz * V + cx + 1], c = H[(cz + 1) * V + cx], d = H[(cz + 1) * V + cx + 1];
    const avg = (a + b + c + d) / 4;
    const slope = (Math.max(a, b, c, d) - Math.min(a, b, c, d)) / CELL;
    const i = cz * N + cx;
    cellH[i] = avg;
    if (avg < -0.45) kind[i] = CK_WATER;
    else if (avg < 0.0) kind[i] = CK_SHALLOW;
    else if (slope > 0.9) kind[i] = CK_CLIFF;
    else kind[i] = CK_LAND;
    if (cx === 0 || cz === 0 || cx === N - 1 || cz === N - 1) kind[i] = kind[i] === CK_WATER ? CK_WATER : CK_CLIFF;
  }
  const cellOf = (x, z) => clamp(Math.floor(z / CELL), 0, N - 1) * N + clamp(Math.floor(x / CELL), 0, N - 1);
  const reserved = new Uint8Array(N * N); // cells taken by resources/sockets
  const isOpen = (cx, cz) => cx > 1 && cz > 1 && cx < N - 2 && cz < N - 2 && kind[cz * N + cx] === CK_LAND && !reserved[cz * N + cx];

  // route & socket reservation
  const routeCell = new Uint8Array(N * N);
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
    if (polyDist(x, z, coarseRoute) < 7.5) routeCell[cz * N + cx] = 1;
  }
  for (const s of sockets) {
    const cx0 = Math.floor(s.x / CELL) - 2, cz0 = Math.floor(s.z / CELL) - 2;
    for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 4; dx++) {
      const cx = cx0 + dx, cz = cz0 + dz;
      if (cx >= 0 && cz >= 0 && cx < N && cz < N) { const i = cz * N + cx; reserved[i] = 2; kind[i] = kind[i] === CK_LAND ? CK_LAND : CK_LAND; }
    }
  }

  // ---------------- forests
  const treeCell = new Uint8Array(N * N);
  const speciesKeys = Object.keys(biome.trees);
  function speciesAt(x, z) {
    const n = nS.noise(x / 60, z / 60) * 0.5 + 0.5;
    let acc = 0; const total = speciesKeys.reduce((s, k) => s + biome.trees[k], 0);
    const r = (n * 0.7 + rng.next() * 0.3) * total;
    for (const k of speciesKeys) { acc += biome.trees[k]; if (r <= acc) return k; }
    return speciesKeys[speciesKeys.length - 1];
  }
  const forestBlobs = [];
  for (const s of starts) {
    for (let k = 0; k < 2; k++) {
      const ang = s.angle + (k === 0 ? rng.range(-0.5, 0.5) : rng.range(1.2, 2.0) * (rng.chance(0.5) ? 1 : -1));
      const d = k === 0 ? rng.range(36, 42) : rng.range(40, 48);
      forestBlobs.push({ x: s.x + Math.cos(ang) * d, z: s.z + Math.sin(ang) * d, r: rng.range(9, 13) });
    }
  }
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const i = cz * N + cx;
    if (kind[i] !== CK_LAND || reserved[i] || routeCell[i]) continue;
    if (cellH[i] < 0.35) continue;
    const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
    const ds = minStartDist(x, z);
    if (ds < 25) continue;
    const border = Math.min(x, z, size - x, size - z);
    let p = 0;
    const f = nF.fbm(x / 70, z / 70, 3) * 0.85 + nG.noise(x / 20, z / 20) * 0.2;
    if (f > biome.forest) p = 0.84;
    else if (f > biome.forest - 0.06) p = 0.3;
    if (border < 12) p = Math.max(p, 0.95); else if (border < 20) p = Math.max(p, 0.55);
    for (const b of forestBlobs) if (dist(x, z, b.x, b.z) < b.r) p = Math.max(p, 0.88);
    if (ds < 32) p *= 0.35;
    if (p === 0 && rng.chance(0.006)) p = 1;
    if (p > 0 && rng.chance(p)) treeCell[i] = 1;
  }

  function clearTrees(x, z, r) {
    const c0x = Math.floor((x - r) / CELL), c1x = Math.floor((x + r) / CELL);
    const c0z = Math.floor((z - r) / CELL), c1z = Math.floor((z + r) / CELL);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
      if (dist((cx + 0.5) * CELL, (cz + 0.5) * CELL, x, z) <= r) treeCell[cz * N + cx] = 0;
    }
  }
  function areaFree(cx0, cz0, w, ignoreTrees) {
    for (let dz = 0; dz < w; dz++) for (let dx = 0; dx < w; dx++) {
      const cx = cx0 + dx, cz = cz0 + dz;
      if (!isOpen(cx, cz)) return false;
      if (!ignoreTrees && treeCell[cz * N + cx]) return false;
    }
    return true;
  }
  function reserve(cx0, cz0, w) { for (let dz = 0; dz < w; dz++) for (let dx = 0; dx < w; dx++) reserved[(cz0 + dz) * N + cx0 + dx] = 1; }

  // ---------------- resources
  const mines = [], quarries = [], bushes = [], herds = [], crates = [], treasures = [];
  // 2x2-cell deposits: silver mines and stone quarries keep their distance from each other
  function tryPlaceDeposit(list, x, z, amount, minSame) {
    const cx0 = Math.round(x / CELL) - 1, cz0 = Math.round(z / CELL) - 1;
    if (!areaFree(cx0, cz0, 2, true)) return false;
    for (const m of list) if (dist(m.x, m.z, x, z) < minSame) return false;
    for (const m of mines.concat(quarries)) if (dist(m.x, m.z, x, z) < 12) return false;
    reserve(cx0, cz0, 2);
    const mx = (cx0 + 1) * CELL, mz = (cz0 + 1) * CELL;
    clearTrees(mx, mz, 7);
    list.push({ cx: cx0, cz: cz0, x: mx, z: mz, amount });
    return true;
  }
  const tryPlaceMine = (x, z, amount) => tryPlaceDeposit(mines, x, z, amount, 22);
  const tryPlaceQuarry = (x, z, amount) => tryPlaceDeposit(quarries, x, z, amount, 26);
  function placeNear(s, dMin, dMax, angCenter, angSpread, fn) {
    for (let t = 0; t < 80; t++) {
      const ang = angCenter + rng.range(-angSpread, angSpread);
      const d = rng.range(dMin, dMax);
      const x = s.x + Math.cos(ang) * d, z = s.z + Math.sin(ang) * d;
      if (fn(x, z, ang)) return true;
    }
    return false;
  }
  const toCenter = (s) => Math.atan2(C - s.z, C - s.x);
  starts.forEach((s, pi) => {
    const tc = toCenter(s);
    // TC front (crates go here)
    // home mine: to the side
    const side = rng.chance(0.5) ? 1 : -1;
    placeNear(s, 18, 22, tc + side * 1.6, 0.6, (x, z) => tryPlaceMine(x, z, 3000)) || placeNear(s, 18, 26, 0, PI, (x, z) => tryPlaceMine(x, z, 3000));
    placeNear(s, 40, 52, tc - side * 0.9, 0.8, (x, z) => tryPlaceMine(x, z, 4000)) || placeNear(s, 40, 60, 0, PI, (x, z) => tryPlaceMine(x, z, 4000));
    // stone: a quarry behind the town, another further out
    placeNear(s, 22, 28, tc + PI, 0.7, (x, z) => tryPlaceQuarry(x, z, 2500)) || placeNear(s, 20, 32, 0, PI, (x, z) => tryPlaceQuarry(x, z, 2500));
    placeNear(s, 42, 56, tc + side * 2.3, 0.7, (x, z) => tryPlaceQuarry(x, z, 3500)) || placeNear(s, 40, 64, 0, PI, (x, z) => tryPlaceQuarry(x, z, 3500));
    // berries
    placeNear(s, 15, 18, tc - side * 1.5, 0.5, (x, z) => {
      const cx0 = Math.floor(x / CELL), cz0 = Math.floor(z / CELL);
      if (!areaFree(cx0 - 1, cz0 - 1, 3, true)) return false;
      clearTrees(x, z, 6);
      const offs = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, 1], [1, -1]];
      let n = 0;
      for (const [ox, oz] of offs) {
        const cx = cx0 + ox, cz = cz0 + oz;
        if (n >= 7 || !isOpen(cx, cz)) continue;
        reserved[cz * N + cx] = 1;
        bushes.push({ cx, cz, x: (cx + 0.5) * CELL + rng.range(-0.3, 0.3), z: (cz + 0.5) * CELL + rng.range(-0.3, 0.3), amount: 400 });
        n++;
      }
      return n >= 4;
    });
    // herds
    const hunt = biome.hunt[0];
    placeNear(s, 24, 30, tc + side * 0.6, 0.7, (x, z) => {
      if (!isOpen(Math.floor(x / CELL), Math.floor(z / CELL))) return false;
      clearTrees(x, z, 5);
      herds.push({ type: hunt, x, z, count: hunt === 'bison' ? 6 : 8, home: pi });
      return true;
    });
    placeNear(s, 46, 58, tc + rng.range(-1, 1), 1.2, (x, z) => {
      if (!isOpen(Math.floor(x / CELL), Math.floor(z / CELL))) return false;
      clearTrees(x, z, 5);
      const t = biome.hunt[biome.hunt.length - 1];
      herds.push({ type: t, x, z, count: t === 'bison' ? 6 : 8 });
      return true;
    });
    // crates in front of the town center
    const fx = Math.cos(tc), fz = Math.sin(tc);
    const px = -fz, pz = fx;
    ['food', 'wood', 'coin', 'stone'].forEach((r, k) => {
      const off = (k - 1.5) * 2.4;
      crates.push({ x: s.x + fx * 8.5 + px * off, z: s.z + fz * 8.5 + pz * off, res: r, amount: 100 });
    });
    clearTrees(s.x, s.z, 24);
  });
  // neutral mines & herds
  const extraMines = Math.round(nP * 1.6 + size / 160);
  for (let t = 0, placed = 0; t < 600 && placed < extraMines; t++) {
    const x = rng.range(20, size - 20), z = rng.range(20, size - 20);
    if (minStartDist(x, z) < 60) continue;
    if (polyDist(x, z, coarseRoute) < 10) continue;
    if (tryPlaceMine(x, z, 5000)) placed++;
  }
  const extraQuarries = Math.round(nP * 1.2 + size / 200);
  for (let t = 0, placed = 0; t < 600 && placed < extraQuarries; t++) {
    const x = rng.range(20, size - 20), z = rng.range(20, size - 20);
    if (minStartDist(x, z) < 58) continue;
    if (polyDist(x, z, coarseRoute) < 10) continue;
    if (tryPlaceQuarry(x, z, 4500)) placed++;
  }
  const extraHerds = Math.round(nP * 2.2 + size / 100);
  for (let t = 0, placed = 0; t < 600 && placed < extraHerds; t++) {
    const x = rng.range(20, size - 20), z = rng.range(20, size - 20);
    if (minStartDist(x, z) < 55) continue;
    const ci = cellOf(x, z);
    if (kind[ci] !== CK_LAND || treeCell[ci]) continue;
    if (herds.some((h) => dist(h.x, h.z, x, z) < 30)) continue;
    const type = rng.pick(biome.hunt);
    clearTrees(x, z, 4);
    herds.push({ type, x, z, count: type === 'bison' ? rng.int(5, 8) : rng.int(6, 10) });
    placed++;
  }
  // a few neutral berry patches
  for (let t = 0, placed = 0; t < 300 && placed < nP; t++) {
    const x = rng.range(25, size - 25), z = rng.range(25, size - 25);
    if (minStartDist(x, z) < 55) continue;
    const cx0 = Math.floor(x / CELL), cz0 = Math.floor(z / CELL);
    if (!areaFree(cx0 - 1, cz0 - 1, 3, true)) continue;
    clearTrees(x, z, 5);
    for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]]) {
      const cx = cx0 + ox, cz = cz0 + oz;
      if (!isOpen(cx, cz)) continue;
      reserved[cz * N + cx] = 1;
      bushes.push({ cx, cz, x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL, amount: 400 });
    }
    placed++;
  }
  // treasures with guardians
  const nTreasure = nP * 4 + Math.round(size / 70);
  for (let t = 0; t < 1200 && treasures.length < nTreasure; t++) {
    const x = rng.range(18, size - 18), z = rng.range(18, size - 18);
    const ds = minStartDist(x, z);
    if (ds < 38) continue;
    const ci = cellOf(x, z);
    if (kind[ci] !== CK_LAND || reserved[ci]) continue;
    if (treasures.some((tr) => dist(tr.x, tr.z, x, z) < 26)) continue;
    // guardians must not ambush settlers at trade-route sockets or wagons on the road
    if (sockets.some((so) => dist(so.x, so.z, x, z) < 20) || polyDist(x, z, coarseRoute) < 10) continue;
    if (mines.some((m) => dist(m.x, m.z, x, z) < 10) || quarries.some((m) => dist(m.x, m.z, x, z) < 10)) continue;
    const tier = ds < 70 ? 1 : ds < 105 ? 2 : 3;
    let guards;
    if (tier === 1) guards = rng.pick([['wolf'], ['wolf', 'wolf'], ['bandit']]);
    else if (tier === 2) guards = rng.pick([['wolf', 'wolf', 'wolf'], ['bandit', 'bandit'], ['bear'], ['bandit', 'wolf', 'wolf']]);
    else guards = rng.pick([['bear', 'wolf', 'wolf'], ['bandit', 'bandit', 'bandit', 'bandit'], ['bear', 'bear'], ['bandit', 'bandit', 'bear']]);
    let reward;
    const r = rng.next();
    if (tier === 1) reward = r < 0.75 ? { res: rng.pick(RES), amount: rng.int(6, 10) * 10 } : { xp: 60 };
    else if (tier === 2) reward = r < 0.6 ? { res: rng.pick(RES), amount: rng.int(15, 22) * 10 } : r < 0.85 ? { xp: 140 } : { unit: 'settler', count: 2 };
    else reward = r < 0.45 ? { res: rng.pick(RES), amount: rng.int(28, 40) * 10 } : r < 0.7 ? { xp: 280 } : { unit: 'musketeer', count: 3 };
    clearTrees(x, z, 6);
    treasures.push({ x, z, tier, guards, reward, rot: rng.range(0, TAU) });
  }

  // ---------------- connectivity: treasures, herds and deposits must be reachable from the bases
  {
    const passable = (i) => (kind[i] === CK_LAND || kind[i] === CK_SHALLOW) && !treeCell[i] && reserved[i] !== 1;
    const reach = new Uint8Array(N * N), q = new Int32Array(N * N);
    const flood = () => {
      reach.fill(0);
      let qh = 0, qt = 0;
      for (const s of starts) { const i = cellOf(s.x, s.z); if (!reach[i]) { reach[i] = 1; q[qt++] = i; } }
      while (qh < qt) {
        const i = q[qh++], cx = i % N, cz = (i / N) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (nx < 1 || nz < 1 || nx >= N - 1 || nz >= N - 1) continue;
          const j = nz * N + nx;
          if (reach[j] || !passable(j)) continue;
          reach[j] = 1; q[qt++] = j;
        }
      }
    };
    // clear a corridor of trees from (x,z) to the nearest reachable cell
    const carveTo = (x, z) => {
      const c0x = Math.floor(x / CELL), c0z = Math.floor(z / CELL);
      let best = -1, bd = 1e9;
      for (let r = 1; r < 30 && best < 0; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = c0x + dx, cz = c0z + dz;
          if (cx < 1 || cz < 1 || cx >= N - 1 || cz >= N - 1 || !reach[cz * N + cx]) continue;
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = cz * N + cx; }
        }
      }
      if (best < 0) return;
      const tx = ((best % N) + 0.5) * CELL, tz = (((best / N) | 0) + 0.5) * CELL;
      const steps = Math.ceil(dist(x, z, tx, tz));
      for (let s = 0; s <= steps; s++) { const t = s / Math.max(1, steps); clearTrees(lerp(x, tx, t), lerp(z, tz, t), 2.4); }
      flood();
    };
    const reachable = (x, z) => reach[cellOf(x, z)] === 1;
    flood();
    for (const t of treasures) if (!reachable(t.x, t.z)) carveTo(t.x, t.z);
    for (let i = treasures.length - 1; i >= 0; i--) if (!reachable(treasures[i].x, treasures[i].z)) treasures.splice(i, 1);
    for (const h of herds) if (!reachable(h.x, h.z)) carveTo(h.x, h.z);
    for (let i = herds.length - 1; i >= 0; i--) if (!reachable(herds[i].x, herds[i].z)) herds.splice(i, 1);
    for (const m of mines.concat(quarries)) {
      let ok = false;
      for (let dz = -1; dz <= 2 && !ok; dz++) for (let dx = -1; dx <= 2; dx++) {
        if (dx >= 0 && dx <= 1 && dz >= 0 && dz <= 1) continue;
        const cx = m.cx + dx, cz = m.cz + dz;
        if (cx >= 0 && cz >= 0 && cx < N && cz < N && reach[cz * N + cx]) { ok = true; break; }
      }
      if (!ok) carveTo(m.x, m.z + 3);
    }
  }

  // ---------------- tree list
  const trees = [];
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const i = cz * N + cx;
    if (!treeCell[i] || reserved[i] || kind[i] !== CK_LAND) { treeCell[i] = 0; continue; }
    const x = (cx + 0.5) * CELL + rng.range(-0.55, 0.55), z = (cz + 0.5) * CELL + rng.range(-0.55, 0.55);
    trees.push({ cx, cz, x, z, species: speciesAt(x, z), scale: rng.range(0.82, 1.28), rot: rng.range(0, TAU) });
  }

  // ---------------- splat (R dirt, G forest floor, B road, A field)
  const T = 512, ts = size / T;
  const splat = new Uint8Array(T * T * 4);
  const dens = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) dens[i] = treeCell[i] ? 1 : 0;
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(dens);
    for (let cz = 1; cz < N - 1; cz++) for (let cx = 1; cx < N - 1; cx++) {
      const i = cz * N + cx;
      tmp[i] = dens[i] * 0.4 + (dens[i - 1] + dens[i + 1] + dens[i - N] + dens[i + N]) * 0.15;
    }
    dens.set(tmp);
  }
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    const x = (tx + 0.5) * ts, z = (ty + 0.5) * ts;
    let dirt = smoothstep(0.38, 0.7, nG.fbm(x / 34, z / 34, 3)) * 0.7;
    for (const s of starts) { const d = dist(x, z, s.x, s.z); if (d < 16) dirt = Math.max(dirt, smoothstep(16, 7, d) * 0.75); }
    // bilinear forest density
    const fx = x / CELL - 0.5, fz = z / CELL - 0.5;
    const ix = clamp(Math.floor(fx), 0, N - 2), iz = clamp(Math.floor(fz), 0, N - 2);
    const ax = clamp(fx - ix, 0, 1), az = clamp(fz - iz, 0, 1);
    const d00 = dens[iz * N + ix], d10 = dens[iz * N + ix + 1], d01 = dens[(iz + 1) * N + ix], d11 = dens[(iz + 1) * N + ix + 1];
    const fd = lerp(lerp(d00, d10, ax), lerp(d01, d11, ax), az);
    const o = (ty * T + tx) * 4;
    splat[o] = clamp(dirt * 255, 0, 255);
    splat[o + 1] = clamp(smoothstep(0.05, 0.6, fd) * 255, 0, 255);
    splat[o + 2] = 0; splat[o + 3] = 0;
  }
  // road stamping
  for (let i = 0; i < routePts.length; i++) {
    const p = routePts[i];
    const r = 3.4, r0 = Math.floor((p.x - r) / ts), r1 = Math.ceil((p.x + r) / ts), q0 = Math.floor((p.z - r) / ts), q1 = Math.ceil((p.z + r) / ts);
    for (let ty = q0; ty <= q1; ty++) for (let tx = r0; tx <= r1; tx++) {
      if (tx < 0 || ty < 0 || tx >= T || ty >= T) continue;
      const d = dist((tx + 0.5) * ts, (ty + 0.5) * ts, p.x, p.z);
      const v = smoothstep(r, 1.6, d) * 255;
      const o = (ty * T + tx) * 4 + 2;
      if (v > splat[o]) splat[o] = v;
    }
  }

  // worked, trampled ground around mines and quarries
  for (const m of mines.concat(quarries)) {
    const r = 5.2, q0 = Math.floor((m.z - r) / ts), q1 = Math.ceil((m.z + r) / ts), r0 = Math.floor((m.x - r) / ts), r1 = Math.ceil((m.x + r) / ts);
    for (let ty = q0; ty <= q1; ty++) for (let tx = r0; tx <= r1; tx++) {
      if (tx < 0 || ty < 0 || tx >= T || ty >= T) continue;
      const v = smoothstep(r, r * 0.45, dist((tx + 0.5) * ts, (ty + 0.5) * ts, m.x, m.z)) * 235;
      const o = (ty * T + tx) * 4;
      if (v > splat[o]) splat[o] = v;
    }
  }

  // ---------------- decor (grass tufts, rocks, flowers)
  const decor = [];
  const nDecor = Math.round((size * size) / 30 * biome.grassDecor);
  for (let k = 0; k < nDecor; k++) {
    const x = rng.range(2, size - 2), z = rng.range(2, size - 2);
    const ci = cellOf(x, z);
    if (kind[ci] !== CK_LAND || treeCell[ci] || reserved[ci] || routeCell[ci] && rng.chance(0.85)) continue;
    if (cellH[ci] < 0.25) continue;
    const g = nF.noise(x / 18, z / 18);
    if (g < -0.35 && rng.chance(0.7)) continue;
    const r = rng.next();
    decor.push({ x, z, type: r < 0.06 ? 'rock' : r < 0.18 ? 'flower' : 'grass', s: rng.range(0.6, 1.25), rot: rng.range(0, TAU) });
  }
  // a scattering of rocks near cliffs
  for (let k = 0; k < size; k++) {
    const x = rng.range(2, size - 2), z = rng.range(2, size - 2);
    const ci = cellOf(x, z);
    if (kind[ci] === CK_CLIFF) decor.push({ x, z, type: 'rock', s: rng.range(1.2, 2.4), rot: rng.range(0, TAU) });
  }

  // ---------------- minimap colours (RGB per cell)
  const mini = new Uint8Array(N * N * 3);
  const col = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const cA = col(biome.grassA), cB = col(biome.grassB), cFor = col(biome.floor), cRock = col(biome.rock), cSh = col(biome.shallow), cDp = col(biome.deep), cRoad = col(biome.road), cSand = col(biome.sand);
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const i = cz * N + cx, o = i * 3;
    const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
    let c;
    const k = kind[i];
    if (k === CK_WATER) c = cDp;
    else if (k === CK_SHALLOW) c = cSh;
    else if (k === CK_CLIFF) c = cRock;
    else if (treeCell[i]) c = cFor.map((v) => v * 0.75);
    else if (routeCell[i] && polyDist(x, z, coarseRoute) < 2.5) c = cRoad;
    else if (cellH[i] < 0.35) c = cSand;
    else {
      const t = clamp(0.5 + nA.fbm(x / 60, z / 60, 2), 0, 1);
      c = [lerp(cA[0], cB[0], t), lerp(cA[1], cB[1], t), lerp(cA[2], cB[2], t)];
    }
    const shade = clamp(0.85 + cellH[i] * 0.035, 0.7, 1.25);
    mini[o] = clamp(c[0] * shade, 0, 255); mini[o + 1] = clamp(c[1] * shade, 0, 255); mini[o + 2] = clamp(c[2] * shade, 0, 255);
  }

  return {
    size, N, V, H, cellH, kind, biomeKey: setup.biome, biome, starts, trees, treeCell, mines, quarries, bushes, herds, crates, treasures,
    route: { pts: routePts, coarse: coarseRoute, sockets, len: routeLen, total: routeTotal }, splat, splatRes: T, decor, mini, seed: setup.seed,
  };
}

// ------------------------------------------------------------------ height sampling (matches mesh triangulation)
function makeHeightSampler(map) {
  const { H, V, size } = map;
  return function heightAt(x, z) {
    const fx = clamp(x / CELL, 0, V - 1.001), fz = clamp(z / CELL, 0, V - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const h00 = H[iz * V + ix], h10 = H[iz * V + ix + 1], h01 = H[(iz + 1) * V + ix], h11 = H[(iz + 1) * V + ix + 1];
    // triangles: (00,01,10) and (10,01,11) — diagonal from 10 to 01
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  };
}

