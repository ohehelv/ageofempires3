// ---------------------------------------------------------------------------
// 11_game.js — Player and Game: economy, combat resolution, projectiles,
// trade route, treasures, visibility, victory, commands
// ---------------------------------------------------------------------------
class Player {
  constructor(game, index, cfg) {
    this.game = game; this.index = index; this.name = cfg.name; this.civKey = cfg.civ; this.civ = CIVS[cfg.civ];
    this.color = cfg.color; this.colorLin = linColor(cfg.color); this.team = cfg.team; this.isHuman = !!cfg.human;
    this.difficulty = cfg.difficulty || 'normal';
    this.res = { food: 300, wood: 200, coin: 100, stone: 100 };
    this.age = 1; this.aging = null; this.techs = new Set(); this.researching = new Set();
    this.mods = { gather: { berry: 1, hunt: 1, farm: 1, wood: 1, mine: 1, quarry: 1, plantation: 1, crate: 1 }, hp: {}, dmg: {}, range: {}, speed: {}, bldHp: 1, tcHp: 1, tcAtk: 1, towerAtk: 1, regen: 0, houseCost: 1 };
    this.xp = 0; this.xpTotal = 0; this.shipments = 0; this.earned = 0; this.shipNeed = 150; this.shipCount = 0;
    this.cardsUsed = new Set(); this.inTransit = null;
    this.deck = Object.values(CARDS).filter((c) => (!c.civ || c.civ === cfg.civ) && (!c.notCiv || !c.notCiv.includes(cfg.civ)));
    this.alive = true; this.explorer = null; this.tradeMode = 'xp';
    this.prices = Object.assign({}, PRICE_BASE);
    this.politicians = {};
    this.stats = { trained: 0, lost: 0, killed: 0, built: 0, bLost: 0, razed: 0, gathered: { food: 0, wood: 0, coin: 0, stone: 0 }, treasures: 0, ageTimes: [0, 0] };
    this._popT = -1; this._pop = 0;
    if (cfg.civ === 'france') { this.mods.hp.villager = 1.5; for (const k in this.mods.gather) this.mods.gather[k] *= 1.1; }
    this.handicap = this.isHuman ? 1 : (DIFFICULTY[this.difficulty] || DIFFICULTY.normal).gather;
  }
  get ageName() { return AGES[this.age].name; }
  costOf(kind, key) {
    if (kind === 'unit') {
      const c = Object.assign({}, UNITS[key].cost || {});
      if (key === 'settler') { if (this.civKey === 'france') c.food = 120; if (this.civKey === 'russia') c.food = 90; }
      return c;
    }
    if (kind === 'building') {
      const c = Object.assign({}, BUILDINGS[key].cost || {});
      if (key === 'house') for (const r in c) c[r] = Math.round(c[r] * this.mods.houseCost);
      return c;
    }
    if (kind === 'tech') return TECHS[key].cost;
    if (kind === 'age') return AGES[key].cost;
    return {};
  }
  canAfford(c) { for (const r in c) if ((this.res[r] || 0) < c[r] - 1e-6) return false; return true; }
  pay(c) { for (const r in c) this.res[r] -= c[r]; }
  refund(c, f = 1) { for (const r in c) this.res[r] += c[r] * f; }
  popUsed() {
    const g = this.game;
    if (this._popT === g.tickN) return this._pop;
    let n = 0;
    for (const u of g.units) if (u.owner === this.index && u.alive && !u.def.tags.has('trade')) n += u.def.pop || 0;
    for (const b of g.buildings) if (b.owner === this.index && b.alive) for (const q of b.queue) if (q.started) n += q.reserved || 0;
    this._pop = n; this._popT = g.tickN;
    return n;
  }
  popCap() {
    let n = 0;
    for (const b of this.game.buildings) if (b.owner === this.index) n += b.popProvided();
    return Math.min(200, n);
  }
  tagMul(table, def) { let m = 1; for (const t of def.cls) if (table[t]) m *= table[t]; return m; }
  unitHp(def) { return Math.round(def.hp * this.tagMul(this.mods.hp, def)); }
  dmgMul(def) { return this.tagMul(this.mods.dmg, def); }
  speedMul(def) { return this.tagMul(this.mods.speed, def); }
  rangeAdd(def) { let a = 0; for (const t of def.cls) if (this.mods.range[t]) a += this.mods.range[t]; return a; }
  trainSpeed(def) {
    let s = 1;
    if (this.civKey === 'russia' && (def.tags.has('villager') || def.tags.has('infantry'))) s *= 1.43;
    if (!this.isHuman) s *= 0.85 + 0.15 * this.handicap;
    return s;
  }
  gatherMul(k) { return this.mods.gather[k] * this.handicap; }
  bldHpMul(key) { return this.mods.bldHp * (key === 'tc' ? this.mods.tcHp : 1); }
  gain(r, amt) {
    this.res[r] += amt; this.stats.gathered[r] += amt;
    this.addXp(amt * XP_PER_RES);
  }
  addXp(v) {
    if (v <= 0) return;
    if (this.civKey === 'spain') v *= 1.25;
    this.xp += v; this.xpTotal += v;
    while (this.xp >= this.shipNeed) {
      this.xp -= this.shipNeed; this.shipments++; this.earned++;
      this.shipNeed = 150 + 75 * this.earned;
      this.game.emit('shipmentReady', this);
    }
  }
  applyTech(key) { this.techs.add(key); this.applyFx(TECHS[key].fx); }
  applyFx(fx) {
    const g = this.game;
    if (fx.gather) for (const k in fx.gather) {
      if (k === 'all') { for (const kk in this.mods.gather) this.mods.gather[kk] *= 1 + fx.gather.all; }
      else this.mods.gather[k] *= 1 + fx.gather[k];
    }
    if (fx.hp) for (const t in fx.hp) {
      const m = fx.hp[t];
      this.mods.hp[t] = (this.mods.hp[t] || 1) * m;
      for (const u of g.units) if (u.owner === this.index && u.alive && u.def.tags.has(t)) { u.maxHp = Math.round(u.maxHp * m); u.hp *= m; }
    }
    if (fx.dmg) for (const t in fx.dmg) this.mods.dmg[t] = (this.mods.dmg[t] || 1) * fx.dmg[t];
    if (fx.range) for (const t in fx.range) this.mods.range[t] = (this.mods.range[t] || 0) + fx.range[t];
    if (fx.speed) for (const t in fx.speed) this.mods.speed[t] = (this.mods.speed[t] || 1) * fx.speed[t];
    if (fx.bldHp) { this.mods.bldHp *= fx.bldHp; for (const b of g.buildings) if (b.owner === this.index && b.alive) { b.maxHp = Math.round(b.maxHp * fx.bldHp); b.hp *= fx.bldHp; } }
    if (fx.tcHp) { this.mods.tcHp *= fx.tcHp; for (const b of g.buildings) if (b.owner === this.index && b.alive && b.key === 'tc') { b.maxHp = Math.round(b.maxHp * fx.tcHp); b.hp *= fx.tcHp; } }
    if (fx.tcAtk) this.mods.tcAtk *= fx.tcAtk;
    if (fx.towerAtk) this.mods.towerAtk *= fx.towerAtk;
    if (fx.regen) this.mods.regen = Math.max(this.mods.regen, fx.regen);
    if (fx.houseCost) this.mods.houseCost *= fx.houseCost;
  }
  cardAvailable(c) {
    return c.age <= this.age && (c.infinite || !this.cardsUsed.has(c.key));
  }
  update(dt) {
    const g = this.game;
    if (this.aging) {
      this.aging.t += dt;
      if (this.aging.t >= this.aging.total) {
        const to = this.aging.to, pol = this.aging.pol;
        this.aging = null; this.age = to; this.stats.ageTimes[to] = g.time;
        const P = POLITICIANS[to].find((p) => p.key === pol) || POLITICIANS[to][0];
        this.politicians[to] = P.key;
        g.giveBundle(this, P.give);
        g.emit('ageUp', this, to, P);
      }
    }
    if (this.inTransit) {
      this.inTransit.t += dt;
      if (this.inTransit.t >= this.inTransit.total) {
        const c = CARDS[this.inTransit.card];
        this.inTransit = null; this.shipCount++;
        g.giveBundle(this, c.give);
        g.emit('shipmentArrived', this, c);
      }
    }
    if (g.tickN % 200 === 0) for (const r in PRICE_BASE) { const b = PRICE_BASE[r]; this.prices[r] += Math.sign(b - this.prices[r]) * Math.min(3, Math.abs(b - this.prices[r])); }
  }
}

class Game extends Emitter {
  constructor(setup) {
    super();
    this.setup = setup;
    this.rng = new RNG((setup.seed ^ 0x9e3779b9) >>> 0);
    this.map = generateMap(setup);
    this.size = this.map.size; this.N = this.map.N;
    this.heightAt = makeHeightSampler(this.map);
    this.nav = new Nav(this.N);
    this.time = 0; this.tickN = 0; this.nextId = 1;
    this.players = setup.players.map((p, i) => new Player(this, i, p));
    this.units = []; this.buildings = []; this.resources = []; this.projectiles = []; this.treasures = []; this.trees = [];
    this.vis = new Uint8Array(this.N * this.N); this.explored = new Uint8Array(this.N * this.N);
    this.viewer = setup.players.findIndex((p) => p.human); if (this.viewer < 0) this.viewer = 0;
    this.revealAll = false;
    this.hashS = 8; this.hashN = Math.ceil(this.size / this.hashS);
    this.hash = new Array(this.hashN * this.hashN); for (let i = 0; i < this.hash.length; i++) this.hash[i] = [];
    this.pathBudget = 0; this.pathNodes = 0;
    this.over = false; this.winnerTeam = null;
    this.alertT = {};
    this.circles = {};
    this.ais = [];
    this.wagons = []; this.wagonT = 6; this.wagonDir = 1;
    this.autoWork = true;
    this.init();
  }

  // ---------------------------------------------------------------- setup
  init() {
    const m = this.map, N = this.N, nav = this.nav;
    for (let i = 0; i < N * N; i++) if (m.kind[i] === CK_WATER || m.kind[i] === CK_CLIFF) nav.block[i] |= BL_TERRAIN;
    this.treeGrid = new Int32Array(N * N).fill(-1);
    m.trees.forEach((t, i) => {
      const r = new Resource(this, 'tree', t.x, t.z, 260, { cx: t.cx, cz: t.cz, ti: i });
      this.trees.push(r); this.resources.push(r);
      nav.block[t.cz * N + t.cx] |= BL_TREE;
      this.treeGrid[t.cz * N + t.cx] = i;
    });
    for (const mi of m.mines) {
      const r = new Resource(this, 'mine', mi.x, mi.z, mi.amount, { cx: mi.cx, cz: mi.cz });
      this.resources.push(r); nav.setRect(mi.cx, mi.cz, 2, 2, BL_RES, true);
    }
    for (const q of m.quarries) {
      const r = new Resource(this, 'quarry', q.x, q.z, q.amount, { cx: q.cx, cz: q.cz });
      this.resources.push(r); nav.setRect(q.cx, q.cz, 2, 2, BL_RES, true);
    }
    for (const b of m.bushes) {
      const r = new Resource(this, 'bush', b.x, b.z, b.amount, { cx: b.cx, cz: b.cz });
      this.resources.push(r); nav.setRect(b.cx, b.cz, 1, 1, BL_RES, true);
    }
    this.crates = [];
    for (const c of m.crates) { const r = new Resource(this, 'crate', c.x, c.z, c.amount, { res: c.res }); this.resources.push(r); this.crates.push(r); }
    for (const h of m.herds) {
      for (let i = 0; i < h.count; i++) {
        const a = this.rng.range(0, TAU), r = this.rng.range(0, 4.5);
        let x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r;
        if (!nav.freeW(x, z)) { x = h.x; z = h.z; }
        if (!nav.freeW(x, z)) continue;
        const u = this.addUnit(h.type, GAIA, x, z);
        u.herdX = h.x; u.herdZ = h.z;
      }
    }
    for (const t of m.treasures) {
      const tr = { id: this.nextId++, kind: 'treasure', x: t.x, z: t.z, alive: true, reward: t.reward, tier: t.tier, rot: t.rot, guards: [] };
      t.guards.forEach((gk, i) => {
        const a = (i / t.guards.length) * TAU + 0.4;
        let x = t.x + Math.cos(a) * 3, z = t.z + Math.sin(a) * 3;
        if (!nav.freeW(x, z)) { x = t.x; z = t.z; }
        const u = this.addUnit(gk, GAIA, x, z);
        u.homeX = x; u.homeZ = z; u.treasure = tr;
        tr.guards.push(u);
      });
      this.treasures.push(tr);
    }
    this.sockets = m.route.sockets.map((s) => {
      const cx0 = Math.round(s.x / CELL) - 1, cz0 = Math.round(s.z / CELL) - 1;
      return { x: (cx0 + 1) * CELL, z: (cz0 + 1) * CELL, cx0, cz0, s: s.frac * m.route.total, tp: null };
    });
    // players
    this.players.forEach((p, i) => {
      const s = m.starts[i];
      const cx0 = Math.round(s.x / CELL - 2.5), cz0 = Math.round(s.z / CELL - 2.5);
      nav.setRect(cx0, cz0, 5, 5, BL_RES | BL_TREE, false);
      const tc = this.placeBuilding('tc', i, cx0, cz0, { free: true, built: true });
      const toC = Math.atan2(this.size / 2 - tc.z, this.size / 2 - tc.x);
      const fx = Math.cos(toC), fz = Math.sin(toC);
      for (let k = 0; k < 5; k++) {
        const a = toC + (k - 2) * 0.32;
        const pos = this.freeNear(tc.x + Math.cos(a) * 7.5, tc.z + Math.sin(a) * 7.5);
        const u = this.addUnit('settler', i, pos.x, pos.z);
        u.heading = Math.atan2(fx, fz);
      }
      const ep = this.freeNear(tc.x + fx * 8 - fz * 5, tc.z + fz * 8 + fx * 5);
      const ex = this.addUnit('explorer', i, ep.x, ep.z);
      p.explorer = ex;
      p.stats.ageTimes[1] = 0;
      p.tc = tc;
    });
    this.rebuildHash();
    this.updateVisibility();
  }

  // ---------------------------------------------------------------- entity management
  addUnit(key, owner, x, z) {
    const u = new Unit(this, key, owner, x, z);
    u.y = this.heightAt(x, z);
    this.units.push(u);
    if (owner >= 0) this.players[owner].stats.trained += UNITS[key].pop ? 1 : 0;
    return u;
  }
  removeUnit(u) {
    u.alive = false; u.deathT = 99; u.removed = true; u.releaseSlot();
    this.emit('removed', u);
  }
  freeNear(x, z) {
    const nf = this.nav.nearestFree(Math.floor(x / CELL), Math.floor(z / CELL), 12);
    if (!nf) return { x, z };
    if (nf.cx === Math.floor(x / CELL) && nf.cz === Math.floor(z / CELL)) return { x, z };
    return { x: (nf.cx + 0.5) * CELL + this.rng.range(-0.4, 0.4), z: (nf.cz + 0.5) * CELL + this.rng.range(-0.4, 0.4) };
  }
  spawnPointNear(b, tx, tz) {
    // nearest free cell around the footprint, toward (tx,tz)
    const r = b.rect();
    let best = null, bd = 1e9;
    for (let ring = 0; ring < 4 && !best; ring++) {
      for (let cz = r.z0 - 1 - ring; cz <= r.z1 + 1 + ring; cz++) for (let cx = r.x0 - 1 - ring; cx <= r.x1 + 1 + ring; cx++) {
        const edge = cx === r.x0 - 1 - ring || cx === r.x1 + 1 + ring || cz === r.z0 - 1 - ring || cz === r.z1 + 1 + ring;
        if (!edge || !this.nav.free(cx, cz)) continue;
        const d = dist2((cx + 0.5) * CELL, (cz + 0.5) * CELL, tx, tz) + this.rng.next() * 6;
        if (d < bd) { bd = d; best = { x: (cx + 0.5) * CELL + this.rng.range(-0.5, 0.5), z: (cz + 0.5) * CELL + this.rng.range(-0.5, 0.5) }; }
      }
    }
    return best || { x: b.x, z: b.z + b.size / 2 + 1 };
  }
  takePathBudget() { if (this.pathBudget > 0 && this.pathNodes < 60000) { this.pathBudget--; return true; } return false; }

  // ---------------------------------------------------------------- relations
  hostile(a, b) {
    if (!a || !b || a === b) return false;
    const oa = a.owner, ob = b.owner;
    if (oa === GAIA && ob === GAIA) return false;
    if (oa === GAIA) return a.kind === 'unit' && a.def.tags.has('guardian') && b.kind === 'unit' && !b.def.tags.has('animal') && !b.def.tags.has('trade');
    if (ob === GAIA) return b.kind === 'unit' && b.def.tags.has('guardian');
    return this.players[oa].team !== this.players[ob].team;
  }
  enemies(pa, pb) { return pa !== pb && pa >= 0 && pb >= 0 && this.players[pa].team !== this.players[pb].team; }
  validTarget(u, t) {
    if (!t || !t.alive || t.ko || t.garrisoned || t.removed) return false;
    if (t.kind === 'unit') {
      if (t.def.tags.has('trade')) return false;
      if (t.owner === u.owner) return false;
      if (t.owner >= 0 && u.owner >= 0 && !this.enemies(u.owner, t.owner)) return false;
      if (u.def.ranged && u.def.ranged.buildingsOnly && !u.def.melee) return false;
      return true;
    }
    if (t.kind === 'building') return t.owner !== u.owner && (u.owner === GAIA ? false : this.enemies(u.owner, t.owner));
    return false;
  }

  // ---------------------------------------------------------------- spatial hash
  rebuildHash() {
    for (let i = 0; i < this.hash.length; i++) this.hash[i].length = 0;
    const S = this.hashS, HN = this.hashN;
    for (const u of this.units) {
      if (!u.alive || u.garrisoned || u.trade) continue;
      const hx = clamp(Math.floor(u.x / S), 0, HN - 1), hz = clamp(Math.floor(u.z / S), 0, HN - 1);
      this.hash[hz * HN + hx].push(u);
    }
  }
  forUnitsNear(x, z, r, fn) {
    const S = this.hashS, HN = this.hashN;
    const x0 = clamp(Math.floor((x - r) / S), 0, HN - 1), x1 = clamp(Math.floor((x + r) / S), 0, HN - 1);
    const z0 = clamp(Math.floor((z - r) / S), 0, HN - 1), z1 = clamp(Math.floor((z + r) / S), 0, HN - 1);
    const r2 = r * r;
    for (let hz = z0; hz <= z1; hz++) for (let hx = x0; hx <= x1; hx++) {
      const L = this.hash[hz * HN + hx];
      for (let i = 0; i < L.length; i++) { const u = L[i]; if (u.alive && dist2(u.x, u.z, x, z) <= r2) fn(u); }
    }
  }
  unitsInRadius(x, z, r, filter) { const out = []; this.forUnitsNear(x, z, r, (u) => { if (!filter || filter(u)) out.push(u); }); return out; }

  acquireTarget(u, radius, includeBuildings) {
    const buildingsOnly = u.def.ranged && u.def.ranged.buildingsOnly;
    let best = null, bs = 1e9;
    if (!buildingsOnly) {
      this.forUnitsNear(u.x, u.z, radius, (t) => {
        if (t.ko || !this.hostile(u, t)) return;
        let s = dist(u.x, u.z, t.x, t.z);
        if (t.canFight) s -= 4;
        if (t.def.tags.has('villager')) s += 2;
        if (u.def.bonus) for (const tag in u.def.bonus) if (t.def.tags.has(tag) && u.def.bonus[tag] > 1) s -= 5;
        if (s < bs) { bs = s; best = t; }
      });
    }
    if (best || (!includeBuildings && !buildingsOnly) || u.owner === GAIA) return best;
    for (const b of this.buildings) {
      if (!b.alive || !this.enemies(u.owner, b.owner)) continue;
      const d = b.edgeDist(u.x, u.z);
      if (d <= radius && d < bs) { bs = d; best = b; }
    }
    return best;
  }
  findTargets(b, range, n) {
    const out = [];
    const cands = [];
    this.forUnitsNear(b.x, b.z, range, (t) => {
      if (t.ko || t.owner === GAIA && !t.def.tags.has('guardian')) return;
      if (t.owner === GAIA ? true : this.enemies(b.owner, t.owner)) {
        const d = dist(b.x, b.z, t.x, t.z) - (t.canFight ? 6 : 0);
        cands.push({ t, d });
      }
    });
    cands.sort((a, c) => a.d - c.d);
    for (let i = 0; i < n && cands.length; i++) out.push(cands[i % Math.min(cands.length, 3)].t);
    return out;
  }

  // ---------------------------------------------------------------- damage
  damage(t, base, src, type, srcDef, srcOwner) {
    if (!t || !t.alive || t.ko) return;
    const sdef = srcDef || (src && src.def);
    const owner = srcOwner !== undefined ? srcOwner : src ? src.owner : GAIA;
    let mult = 1;
    if (sdef && sdef.bonus) {
      for (const tag in sdef.bonus) {
        const has = t.kind === 'building' ? tag === 'building' : t.def.tags.has(tag);
        if (has) mult *= sdef.bonus[tag];
      }
    }
    let armor = 0;
    if (t.kind === 'unit' && type !== 'siege') armor = t.def.armor[type] || 0;
    if (t.kind === 'building' && type === 'ranged' && sdef && sdef.ranged && !['cannon', 'mortar', 'grenade'].includes(sdef.ranged.proj)) mult *= 0.15;
    const dmg = base * mult * (1 - armor);
    t.hp -= dmg;
    t.lastHitT = this.time;
    if (t.kind === 'unit') this.onUnitHit(t, src, owner);
    if (t.kind === 'building' && t.owner >= 0 && owner !== t.owner) this.alert(t.owner, t.x, t.z, true);
    if (t.hp <= 0) this.kill(t, src, owner);
  }
  onUnitHit(t, src, owner) {
    if (t.owner >= 0 && owner >= 0 && owner !== t.owner) this.alert(t.owner, t.x, t.z, false);
    if (!src || src.kind !== 'unit' || !src.alive) return;
    if (t.def.tags.has('huntable')) {
      if (t.alive) {
        const a = Math.atan2(t.x - src.x, t.z - src.z) + this.rng.range(-0.5, 0.5);
        const fx = clamp(t.x + Math.sin(a) * 12, 4, this.size - 4), fz = clamp(t.z + Math.cos(a) * 12, 4, this.size - 4);
        t.clearOrder(); t.order = { type: 'flee', x: fx, z: fz, t: 2.5 };
        t.herdX = fx; t.herdZ = fz;
      }
      return;
    }
    if (!t.order && t.canFight && !t.def.tags.has('villager') && this.validTarget(t, src)) {
      t.cmdAttack(src, true);
    } else if (t.def.tags.has('guardian') && (!t.order || t.order.type !== 'attack') && this.validTarget(t, src)) {
      t.cmdAttack(src, true);
      t.home = { x: t.homeX !== undefined ? t.homeX : t.x, z: t.homeZ !== undefined ? t.homeZ : t.z };
    }
  }
  alert(owner, x, z, building) {
    const k = owner;
    if (this.time - (this.alertT[k] || -99) < 14) return;
    this.alertT[k] = this.time;
    this.emit('attacked', owner, x, z, building);
  }
  valueOf(t) {
    if (t.kind === 'building') return costTotal(t.def.cost) || 800;
    if (t.def.tags.has('guardian')) return 150;
    return costTotal(t.def.cost);
  }
  kill(t, src, owner) {
    const killer = owner >= 0 ? this.players[owner] : null;
    if (killer && killer.index !== t.owner) {
      killer.addXp(this.valueOf(t) * 0.12);
      if (t.kind === 'building') killer.stats.razed++; else if (t.owner >= 0) killer.stats.killed++;
    }
    if (t.kind === 'unit') {
      if (t.def.hero) {
        t.ko = true; t.koT = 0; t.hp = 0; t.clearOrder(); t.setAnim(ANIM.DEAD, true); t.selected = false;
        this.emit('ko', t);
        return;
      }
      t.alive = false; t.deathT = 0; t.clearOrder(); t.selected = false; t.setAnim(ANIM.DEAD, true);
      if (t.owner >= 0) this.players[t.owner].stats.lost++;
      if (t.def.tags.has('huntable')) {
        const c = new Resource(this, 'carcass', t.x, t.z, t.def.food, { animal: t });
        t.carcass = c;
        this.resources.push(c);
      }
      this.emit('unitDied', t);
      if (t.garrisonedIn) t.garrisonedIn = null;
    } else if (t.kind === 'building') {
      t.alive = false; t.deathT = 0;
      if (t.owner >= 0) this.players[t.owner].stats.bLost++;
      this.nav.setRect(t.cx0, t.cz0, t.n, t.n, BL_BUILD, false);
      for (const u of t.garrison) { u.garrisoned = null; const p = this.freeNear(t.x + this.rng.range(-4, 4), t.z + t.size / 2 + 1.5); u.x = u.px = p.x; u.z = u.pz = p.z; }
      t.garrison.length = 0;
      for (const q of t.queue) if (q.kind === 'tech') this.players[t.owner].researching.delete(q.key);
      t.queue.length = 0;
      if (t.socket) t.socket.tp = null;
      this.emit('buildingDestroyed', t);
    }
  }
  reviveExplorer(u) {
    const p = this.players[u.owner];
    const tc = this.buildings.find((b) => b.alive && b.built && b.owner === u.owner && (b.key === 'tc' || b.key === 'fort'));
    if (!tc) { u.koT = 100; return false; }
    const pos = this.spawnPointNear(tc, tc.x, tc.z + 20);
    u.x = u.px = pos.x; u.z = u.pz = pos.z; u.ko = false; u.koT = 0; u.hp = u.maxHp; u.setAnim(ANIM.IDLE, true);
    this.emit('revived', u);
    return true;
  }

  // ---------------------------------------------------------------- ranged attacks & projectiles
  muzzle(u) {
    const h = u.def.tags.has('cavalry') ? 2.2 : u.def.tags.has('artillery') ? 0.9 : 1.45;
    const f = u.def.tags.has('artillery') ? 1.6 : 0.7;
    return { x: u.x + Math.sin(u.heading) * f, y: (u.y || this.heightAt(u.x, u.z)) + h, z: u.z + Math.cos(u.heading) * f };
  }
  aimPoint(t) {
    if (t.kind === 'building') return { x: t.x + this.rng.range(-t.size / 4, t.size / 4), y: this.heightAt(t.x, t.z) + t.def.height * 0.35, z: t.z + this.rng.range(-t.size / 4, t.size / 4) };
    return { x: t.x, y: this.heightAt(t.x, t.z) + (t.def.height || 1.6) * 0.55, z: t.z };
  }
  rangedAttack(u, t, r, dmg) {
    const m = this.muzzle(u), a = this.aimPoint(t);
    if (r.proj === 'musket' || r.proj === 'pistol') {
      this.damage(t, dmg, u, 'ranged');
      this.fx('musket', m.x, m.z, { m, a, pistol: r.proj === 'pistol', heading: u.heading });
      return;
    }
    const d = dist(m.x, m.z, a.x, a.z);
    let T, arc;
    switch (r.proj) {
      case 'arrow': case 'bolt': T = d / 34; arc = d * 0.12; break;
      case 'cannon': T = d / 55; arc = d * 0.05; break;
      case 'mortar': T = 1.6 + d / 40; arc = d * 0.7; break;
      case 'grenade': T = 0.4 + d / 18; arc = d * 0.35; break;
      default: T = d / 30; arc = 1;
    }
    this.projectiles.push({ type: r.proj, owner: u.owner, src: u, srcDef: u.def, target: t, x0: m.x, y0: m.y, z0: m.z, x1: a.x, y1: a.y, z1: a.z, t: 0, T: Math.max(0.12, T), arc, dmg, splash: r.splash || 0, buildingsOnly: !!r.buildingsOnly, x: m.x, y: m.y, z: m.z, px: m.x, py: m.y, pz: m.z });
    this.fx(r.proj === 'cannon' || r.proj === 'mortar' ? 'cannonFire' : r.proj === 'grenade' ? 'throw' : 'bow', m.x, m.z, { m, heading: u.heading });
  }
  buildingShot(b, t, dmg, k) {
    const atk = b.def.attack;
    if (atk.proj === 'cannon') {
      // bastion: a cannonball from the gun platform, splash on impact
      const a = this.aimPoint(t);
      const hd = Math.atan2(a.x - b.x, a.z - b.z);
      const m = { x: b.x + Math.sin(hd) * 2.2, y: this.heightAt(b.x, b.z) + b.def.height * 0.86, z: b.z + Math.cos(hd) * 2.2 };
      // lead a moving target a little
      if (t.kind === 'unit' && t.moving) { const lead = dist(m.x, m.z, a.x, a.z) / 55; a.x += Math.sin(t.heading) * t.speed() * lead * 0.8; a.z += Math.cos(t.heading) * t.speed() * lead * 0.8; }
      const d = dist(m.x, m.z, a.x, a.z);
      this.projectiles.push({ type: 'cannon', owner: b.owner, src: b, srcDef: b.def, target: t, x0: m.x, y0: m.y, z0: m.z, x1: a.x, y1: a.y, z1: a.z, t: 0, T: Math.max(0.15, d / 55), arc: d * 0.06, dmg, splash: atk.splash || 0, buildingsOnly: false, x: m.x, y: m.y, z: m.z, px: m.x, py: m.y, pz: m.z });
      this.fx('cannonFire', m.x, m.z, { m, heading: hd });
      return;
    }
    const top = { x: b.x + this.rng.range(-b.size * 0.3, b.size * 0.3), y: this.heightAt(b.x, b.z) + b.def.height * 0.65, z: b.z + this.rng.range(-b.size * 0.3, b.size * 0.3) };
    const a = this.aimPoint(t);
    this.damage(t, dmg, b, 'ranged', b.def, b.owner);
    this.fx('musket', top.x, top.z, { m: top, a, delay: k * 0.12, building: true });
  }
  updateProjectiles(dt) {
    const P = this.projectiles;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.px = p.x; p.py = p.y; p.pz = p.z;
      if ((p.type === 'arrow' || p.type === 'bolt') && p.target.alive && p.target.kind === 'unit') {
        const a = { x: p.target.x, z: p.target.z };
        p.x1 = lerp(p.x1, a.x, 0.3); p.z1 = lerp(p.z1, a.z, 0.3);
      }
      p.t += dt;
      const s = Math.min(1, p.t / p.T);
      p.x = lerp(p.x0, p.x1, s); p.z = lerp(p.z0, p.z1, s);
      p.y = lerp(p.y0, p.y1, s) + p.arc * 4 * s * (1 - s);
      if (s >= 1) { this.impact(p); P.splice(i, 1); }
    }
  }
  impact(p) {
    const srcU = p.src && p.src.alive ? p.src : null;
    if (p.splash) {
      if (!p.buildingsOnly) {
        this.forUnitsNear(p.x, p.z, p.splash, (u) => {
          if (u.ko) return;
          const hostile = u.owner === GAIA ? u.def.tags.has('guardian') : p.owner >= 0 && this.enemies(p.owner, u.owner);
          if (!hostile && u !== p.target) return;
          const f = 1 - 0.5 * dist(u.x, u.z, p.x, p.z) / p.splash;
          this.damage(u, p.dmg * f, srcU, 'ranged', p.srcDef, p.owner);
        });
      }
      for (const b of this.buildings) {
        if (!b.alive || !(p.owner >= 0 && this.enemies(p.owner, b.owner))) continue;
        if (b.edgeDist(p.x, p.z) <= p.splash * 0.6) this.damage(b, p.dmg, srcU, 'ranged', p.srcDef, p.owner);
      }
      this.fx('explosion', p.x, p.z, { y: p.y, big: p.type === 'mortar' || p.type === 'cannon', type: p.type });
    } else {
      const t = p.target;
      if (t && t.alive && (t.kind === 'building' ? t.edgeDist(p.x, p.z) < 2.5 : dist(t.x, t.z, p.x, p.z) < 2.2)) this.damage(t, p.dmg, srcU, 'ranged', p.srcDef, p.owner);
      if (p.type === 'cannon') this.fx('explosion', p.x, p.z, { y: p.y, big: false, type: p.type });
    }
  }

  // ---------------------------------------------------------------- fx bridge (renderer may be absent)
  fx(kind, x, z, data) {
    if (typeof FX === 'undefined' || !FX.active) return;
    if (!this.revealAll && !this.isVisibleW(x, z)) return;
    FX.event(kind, x, z, data);
  }
  fxMusket(u, t, hunting) { const m = this.muzzle(u), a = this.aimPoint(t); this.fx('musket', m.x, m.z, { m, a, hunting, heading: u.heading }); }
  fxMelee(u, t) { this.fx(u.def.tags.has('animal') ? 'bite' : 'melee', u.x, u.z, { a: this.aimPoint(t) }); }
  fxTorch(u, t) { this.fx('torch', u.x, u.z, { a: this.aimPoint(t) }); }
  fxGather(u, k) { this.fx('gather', u.x, u.z, { k, u }); }
  fxBuild(u, b) { this.fx('hammer', u.x, u.z, { u }); }

  // ---------------------------------------------------------------- resources
  treeSpot(t, x, z) {
    const nav = this.nav;
    let best = null, bd = 1e9;
    for (let k = 0; k < 8; k++) {
      const cx = t.cx + NAV_DX[k], cz = t.cz + NAV_DZ[k];
      if (!nav.free(cx, cz)) continue;
      const px = (cx + 0.5) * CELL, pz = (cz + 0.5) * CELL;
      const d = dist2(px, pz, x, z);
      if (d < bd) { bd = d; best = { x: px, z: pz }; }
    }
    return best;
  }
  treeAccessible(t) { for (let k = 0; k < 8; k++) if (this.nav.free(t.cx + NAV_DX[k], t.cz + NAV_DZ[k])) return true; return false; }
  onTreeFelled(t, u) { if (typeof treeStartFall === 'function' && GFX.treeRefs) treeStartFall(t.ti, Math.atan2(t.x - u.x, t.z - u.z)); }
  depleteResource(r) {
    if (!r.alive) return;
    r.alive = false; r.amount = 0;
    if (r.rkind === 'tree') { this.nav.block[r.cz * this.N + r.cx] &= ~BL_TREE; this.treeGrid[r.cz * this.N + r.cx] = -1; if (typeof treeRemove === 'function' && GFX.treeRefs) treeRemove(r.ti); }
    if (r.rkind === 'mine' || r.rkind === 'quarry') this.nav.setRect(r.cx, r.cz, 2, 2, BL_RES, false);
    if (r.rkind === 'bush') this.nav.setRect(r.cx, r.cz, 1, 1, BL_RES, false);
    if (r.rkind === 'carcass' && r.animal) r.animal.deathT = Math.max(r.animal.deathT, 9);
    this.emit('depleted', r);
  }
  findNearestResource(kinds, x, z, radius, exclude, owner) {
    let best = null, bd = radius * radius;
    const wantHunt = kinds.includes('hunt');
    for (const r of this.resources) {
      if (!r.alive || r === exclude || r.amount <= 0) continue;
      if (!kinds.includes(r.rkind)) continue;
      const d = dist2(r.x, r.z, x, z);
      if (d >= bd) continue;
      if (r.rkind === 'tree' && !this.treeAccessible(r)) continue;
      if (r.slotOcc) { r.ensureSlots(); if (r.unreachable || r.slotOcc.every((o) => o)) continue; }
      bd = d; best = r;
    }
    if (wantHunt) {
      for (const u of this.units) {
        if (!u.alive || u.owner !== GAIA || !u.def.tags.has('huntable')) continue;
        const d = dist2(u.x, u.z, x, z);
        if (d < bd) { bd = d; best = u; }
      }
    }
    return best;
  }
  findGatherBuilding(owner, key, x, z, exclude) {
    let best = null, bd = 1e9;
    for (const b of this.buildings) {
      if (!b.alive || !b.built || b.owner !== owner || b.key !== key || b === exclude) continue;
      b.ensureSlots();
      if (b.gatherers() >= b.slots.length) continue;
      const d = dist2(b.x, b.z, x, z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  findUnfinished(owner, x, z, r) {
    let best = null, bd = r * r;
    for (const b of this.buildings) {
      if (!b.alive || b.built || b.owner !== owner) continue;
      const d = dist2(b.x, b.z, x, z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ---------------------------------------------------------------- treasures
  treasureGuarded(t) { return t.guards.some((u) => u.alive && dist(u.x, u.z, t.x, t.z) < 14); }
  collectTreasure(t, u) {
    if (!t.alive) return;
    const p = this.players[u.owner];
    t.alive = false;
    const r = t.reward;
    let text = '';
    if (r.res) { p.res[r.res] += r.amount; text = '+' + r.amount + ' ' + RES_NAME_GEN[r.res]; }
    else if (r.xp) { p.addXp(r.xp); text = '+' + r.xp + ' опыта'; }
    else if (r.unit) {
      for (let i = 0; i < r.count; i++) { const pos = this.freeNear(t.x + this.rng.range(-2, 2), t.z + this.rng.range(-2, 2)); this.addUnit(r.unit, u.owner, pos.x, pos.z); }
      text = r.count + ' × ' + UNITS[r.unit].name.toLowerCase();
    }
    p.addXp(30);
    p.stats.treasures++;
    this.emit('treasure', p, t, text);
  }

  // ---------------------------------------------------------------- garrison
  garrisonUnit(u, b) {
    if (b.garrison.length >= (b.def.garrison || 0)) { u.clearOrder(); return false; }
    u.clearOrder(); u.garrisoned = b; u.selected = false; b.garrison.push(u);
    this.emit('garrisoned', u, b);
    return true;
  }
  ungarrison(b) {
    const L = b.garrison.slice(); b.garrison.length = 0;
    for (const u of L) {
      u.garrisoned = null;
      const p = this.spawnPointNear(b, b.x + this.rng.range(-10, 10), b.z + 12);
      u.x = u.px = p.x; u.z = u.pz = p.z;
    }
    return L;
  }

  // ---------------------------------------------------------------- building placement
  footprintOk(cx0, cz0, n) {
    const N = this.N, m = this.map;
    for (let z = cz0; z < cz0 + n; z++) for (let x = cx0; x < cx0 + n; x++) {
      if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) return false;
      const i = z * N + x;
      if (this.nav.block[i] !== 0) return false;
      if (m.kind[i] !== CK_LAND) return false;
    }
    return true;
  }
  socketAt(cx0, cz0) { return this.sockets.find((s) => s.cx0 === cx0 && s.cz0 === cz0) || null; }
  nearestSocket(x, z, r = 9) { let best = null, bd = r * r; for (const s of this.sockets) { if (s.tp) continue; const d = dist2(s.x, s.z, x, z); if (d < bd) { bd = d; best = s; } } return best; }
  canPlace(key, cx0, cz0, owner, ignoreUnit) {
    const def = BUILDINGS[key];
    if (def.socket) { const s = this.socketAt(cx0, cz0); if (!s || s.tp) return false; }
    else {
      for (const s of this.sockets) if (Math.abs(s.cx0 + 1 - (cx0 + def.cells / 2)) < 2 + def.cells / 2 && Math.abs(s.cz0 + 1 - (cz0 + def.cells / 2)) < 2 + def.cells / 2) return false;
    }
    if (!this.footprintOk(cx0, cz0, def.cells)) return false;
    // supply crates and treasure chests on the ground block construction
    const x0 = cx0 * CELL - 0.7, z0 = cz0 * CELL - 0.7, x1 = (cx0 + def.cells) * CELL + 0.7, z1 = (cz0 + def.cells) * CELL + 0.7;
    for (const c of this.crates) if (c.alive && c.x > x0 && c.x < x1 && c.z > z0 && c.z < z1) return false;
    for (const t of this.treasures) if (t.alive && t.x > x0 - 0.5 && t.x < x1 + 0.5 && t.z > z0 - 0.5 && t.z < z1 + 0.5) return false;
    if (owner === this.viewer && !this.revealAll) {
      const N = this.N;
      for (let z = cz0; z < cz0 + def.cells; z++) for (let x = cx0; x < cx0 + def.cells; x++) if (!this.explored[z * N + x]) return false;
    }
    return true;
  }
  placeBuilding(key, owner, cx0, cz0, opts = {}) {
    const def = BUILDINGS[key];
    const b = new Building(this, key, owner, cx0, cz0, !!opts.built);
    this.buildings.push(b);
    this.nav.setRect(cx0, cz0, def.cells, def.cells, BL_BUILD, true);
    if (def.socket) { const s = this.socketAt(cx0, cz0); if (s) { s.tp = b; b.socket = s; } }
    // push units out of the footprint
    const r = b.rect();
    for (const u of this.units) {
      if (!u.alive || u.garrisoned || u.trade) continue;
      const cx = Math.floor(u.x / CELL), cz = Math.floor(u.z / CELL);
      if (cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1) { const p = this.spawnPointNear(b, u.x, u.z); u.x = u.px = p.x; u.z = u.pz = p.z; u.path = null; u.goalKey = null; }
    }
    if (typeof paintSplat === 'function') {
      paintSplat(b.x, b.z, def.size / 2 + 1.2, 0, 0.9, true);
      if (def.gather) paintSplat(b.x, b.z, def.size / 2 + 6.5, 3, 1, true);
    }
    if (opts.built) this.completeBuilding(b, true);
    this.emit('placed', b);
    return b;
  }
  completeBuilding(b, silent) {
    b.built = true; b.progress = 1;
    if (!silent) { b.hp = b.maxHp; }
    const p = this.players[b.owner];
    p.stats.built++;
    p.addXp(costTotal(b.def.cost) * 0.1);
    if (!silent) {
      this.emit('built', b);
      if (b.key === 'house' && p.civKey === 'britain') {
        const u = b.spawnUnit('settler');
        if (u) this.emit('float', b.x, b.z, '+1 поселенец', '#e9dcb8');
      }
    }
  }
  // find a free build spot for AI / wagons around (x,z)
  findBuildSpot(owner, key, x, z, rMin, rMax, avoid) {
    const def = BUILDINGS[key], n = def.cells;
    const pad = key === 'house' || n >= 6 ? 1 : 2;
    const attempt = (r0, r1, tries) => {
      let best = null, bd = 1e9;
      for (let t = 0; t < tries; t++) {
        const a = this.rng.range(0, TAU), r = this.rng.range(r0, r1);
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const cx0 = Math.round(px / CELL - n / 2), cz0 = Math.round(pz / CELL - n / 2);
        if (!this.footprintOk(cx0 - pad, cz0 - pad, n + pad * 2)) continue;
        if (!this.canPlace(key, cx0, cz0, owner)) continue;
        // keep away from mines, quarries and berries so gatherers have room
        let bad = false;
        const mx = (cx0 + n / 2) * CELL, mz = (cz0 + n / 2) * CELL;
        for (const rr of this.resources) {
          if (!rr.alive || (rr.rkind !== 'mine' && rr.rkind !== 'quarry' && rr.rkind !== 'bush')) continue;
          if (dist2(rr.x, rr.z, mx, mz) < (n * CELL / 2 + 4) ** 2) { bad = true; break; }
        }
        if (bad) continue;
        const d = r + (avoid ? -dist(mx, mz, avoid.x, avoid.z) * 0.15 : 0);
        if (d < bd) { bd = d; best = { cx0, cz0 }; }
        if (t > 50 && best) break;
      }
      return best;
    };
    return attempt(rMin, rMax, 160) || attempt(rMin, rMax * 1.7 + 10, 260);
  }

  // ---------------------------------------------------------------- bundles (shipments, politicians)
  giveBundle(p, give) {
    if (give.res) for (const r in give.res) p.res[r] += give.res[r];
    if (give.fx) p.applyFx(give.fx);
    if (give.units) {
      const home = this.buildings.find((b) => b.alive && b.built && b.owner === p.index && (b.key === 'tc' || b.key === 'fort'))
        || this.buildings.find((b) => b.alive && b.owner === p.index);
      for (const k in give.units) {
        let key = k;
        if (key === 'crossbowman' && p.civKey === 'britain') key = 'longbowman';
        if (key === 'crossbowman' && p.civKey === 'russia') key = 'strelet';
        for (let i = 0; i < give.units[k]; i++) {
          let pos;
          if (home) pos = this.spawnPointNear(home, home.x + this.rng.range(-8, 8), home.z + this.rng.range(4, 14));
          else if (p.explorer) pos = this.freeNear(p.explorer.x + this.rng.range(-3, 3), p.explorer.z + this.rng.range(-3, 3));
          else continue;
          const u = this.addUnit(key, p.index, pos.x, pos.z);
          if (home && home.rally && !UNITS[key].tags.has('wagon')) u.cmdMove(home.rally.x + this.rng.range(-3, 3), home.rally.z + this.rng.range(-3, 3));
        }
      }
    }
  }

  // ---------------------------------------------------------------- trade route
  updateTrade(dt) {
    const R = this.map.route;
    this.wagonT -= dt;
    if (this.wagonT <= 0 && this.wagons.length < 4) {
      this.wagonT = 24;
      const dir = this.wagonDir; this.wagonDir *= -1;
      const s = dir > 0 ? 0 : R.total;
      const p = this.routePos(s);
      const u = new Unit(this, 'tradeWagon', GAIA, p.x, p.z);
      u.trade = true; u.routeS = s; u.dir = dir; u.y = this.heightAt(p.x, p.z);
      this.units.push(u); this.wagons.push(u);
    }
    for (let i = this.wagons.length - 1; i >= 0; i--) {
      const u = this.wagons[i];
      u.px = u.x; u.pz = u.z; u.ph = u.heading;
      const s0 = u.routeS;
      u.routeS += u.dir * 5 * dt;
      const p = this.routePos(u.routeS);
      const dx = p.x - u.x, dz = p.z - u.z;
      u.x = p.x; u.z = p.z; u.moving = true; u.anim = ANIM.MOVE; u.walkPh += 5 * dt * u.stride;
      if (dx || dz) u.heading = angleLerp(u.heading, Math.atan2(dx, dz), 0.3);
      for (const so of this.sockets) {
        if (!so.tp || !so.tp.alive || !so.tp.built) continue;
        if ((s0 - so.s) * (u.routeS - so.s) <= 0) this.tradeIncome(so.tp);
      }
      if (u.routeS < 0 || u.routeS > R.total) { u.alive = false; u.removed = true; u.deathT = 99; this.wagons.splice(i, 1); }
    }
  }
  routePos(s) {
    const R = this.map.route, L = R.len;
    s = clamp(s, 0, R.total);
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] < s) lo = mid; else hi = mid; }
    const t = (s - L[lo]) / Math.max(1e-6, L[hi] - L[lo]);
    return { x: lerp(R.pts[lo].x, R.pts[hi].x, t), z: lerp(R.pts[lo].z, R.pts[hi].z, t) };
  }
  tradeIncome(tp) {
    const p = this.players[tp.owner];
    if (p.tradeMode === 'coin') { const v = 20 + 6 * p.age; p.res.coin += v; this.emit('float', tp.x, tp.z, '+' + v + ' монет', '#e3c565', tp.owner); }
    else { const v = 35 + 10 * p.age; p.addXp(v); this.emit('float', tp.x, tp.z, '+' + v + ' опыта', '#9fd3c7', tp.owner); }
  }

  // ---------------------------------------------------------------- separation
  separate() {
    for (const u of this.units) {
      if (!u.alive || u.garrisoned || u.ko || u.trade) continue;
      const ru = u.def.radius;
      const wu = u.moving ? 1 : (u.order && (u.order.type === 'gather' || u.order.type === 'build')) ? 0.12 : 0.5;
      this.forUnitsNear(u.x, u.z, ru + 1.3, (v) => {
        if (v.id <= u.id || v.garrisoned || v.ko || v.trade) return;
        const minD = (ru + v.def.radius) * 0.85;
        let dx = v.x - u.x, dz = v.z - u.z;
        let d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD) return;
        let d = Math.sqrt(d2);
        if (d < 1e-3) { const a = this.rng.range(0, TAU); dx = Math.cos(a); dz = Math.sin(a); d = 1; }
        const wv = v.moving ? 1 : (v.order && (v.order.type === 'gather' || v.order.type === 'build')) ? 0.12 : 0.5;
        const push = Math.min(0.25, (minD - d) * 0.5);
        const tw = wu + wv;
        const nx = dx / d, nz = dz / d;
        const ux = u.x - nx * push * (wu / tw) * 2, uz = u.z - nz * push * (wu / tw) * 2;
        const vx = v.x + nx * push * (wv / tw) * 2, vz = v.z + nz * push * (wv / tw) * 2;
        if (this.nav.freeW(ux, uz)) { u.x = ux; u.z = uz; }
        if (this.nav.freeW(vx, vz)) { v.x = vx; v.z = vz; }
      });
    }
  }

  // ---------------------------------------------------------------- visibility
  circle(r) {
    const k = Math.round(r);
    if (this.circles[k]) return this.circles[k];
    const out = [];
    for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) if (dx * dx + dz * dz <= k * k + k * 0.6) out.push(dx, dz);
    return (this.circles[k] = out);
  }
  stamp(x, z, r) {
    const N = this.N, cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), c = this.circle(r / CELL);
    const vis = this.vis, ex = this.explored;
    for (let i = 0; i < c.length; i += 2) {
      const xx = cx + c[i], zz = cz + c[i + 1];
      if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
      const j = zz * N + xx; vis[j] = 1; ex[j] = 1;
    }
  }
  updateVisibility() {
    this.vis.fill(0);
    const team = this.players[this.viewer].team;
    for (const u of this.units) {
      if (!u.alive || u.owner < 0 || u.garrisoned || this.players[u.owner].team !== team) continue;
      this.stamp(u.x, u.z, u.ko ? 4 : u.def.los);
    }
    for (const b of this.buildings) {
      if (!b.alive || this.players[b.owner].team !== team) continue;
      this.stamp(b.x, b.z, (b.built ? b.def.los : 8) + b.size / 2);
    }
  }
  isVisibleW(x, z) {
    if (this.revealAll) return true;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= this.N || cz >= this.N) return false;
    return this.vis[cz * this.N + cx] === 1;
  }
  isExploredW(x, z) {
    if (this.revealAll) return true;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= this.N || cz >= this.N) return false;
    return this.explored[cz * this.N + cx] === 1;
  }

  // ---------------------------------------------------------------- victory
  checkVictory() {
    for (const p of this.players) {
      if (!p.alive) continue;
      const hasB = this.buildings.some((b) => b.alive && b.owner === p.index && b.key !== 'tradingPost');
      const hasU = this.units.some((u) => u.alive && u.owner === p.index && !u.ko && !u.def.hero);
      if (!hasB && !hasU) this.defeat(p);
    }
    if (this.over) return;
    const teams = new Set(this.players.filter((p) => p.alive).map((p) => p.team));
    if (teams.size <= 1) {
      this.over = true;
      this.winnerTeam = teams.size ? [...teams][0] : null;
      this.emit('gameOver', this.winnerTeam);
    }
  }
  defeat(p) {
    if (!p.alive) return;
    p.alive = false;
    for (const u of this.units) if (u.alive && u.owner === p.index) { u.alive = false; u.deathT = 0; u.ko = false; u.setAnim(ANIM.DEAD, true); }
    for (const b of this.buildings) if (b.alive && b.owner === p.index) this.kill(b, null, GAIA);
    this.emit('defeated', p);
  }

  // ---------------------------------------------------------------- main tick
  tick() {
    const dt = TICK;
    this.time += dt; this.tickN++;
    this.pathBudget = 26; this.pathNodes = 0;
    for (const p of this.players) if (p.alive) p.update(dt);
    for (let i = 0; i < this.buildings.length; i++) this.buildings[i].update(dt);
    for (let i = 0; i < this.units.length; i++) { const u = this.units[i]; if (!u.trade) u.update(dt); }
    for (const u of this.units) if (u.alive && !u.trade) u.y = this.heightAt(u.x, u.z);
    this.separate();
    this.updateProjectiles(dt);
    this.updateTrade(dt);
    this.rebuildHash();
    if (this.tickN % 4 === 0) this.updateVisibility();
    for (const ai of this.ais) ai.tick(dt);
    if (this.tickN % 20 === 0) {
      this.checkVictory();
      // cleanup
      this.units = this.units.filter((u) => u.alive || (u.deathT < 14 && !u.removed) || (u.carcass && u.carcass.alive));
      this.buildings = this.buildings.filter((b) => b.alive || b.deathT < 10);
      if (this.tickN % 200 === 0) this.resources = this.resources.filter((r) => r.alive);
    }
  }

  // ---------------------------------------------------------------- commands (used by UI and AI)
  orderMove(units, x, z, attackMove) {
    units = units.filter((u) => u.alive && !u.ko && !u.garrisoned && u.owner >= 0);
    if (!units.length) return;
    if (units.length === 1) { units[0].cmdMove(x, z, attackMove); return; }
    let cx = 0, cz = 0;
    for (const u of units) { cx += u.x; cz += u.z; }
    cx /= units.length; cz /= units.length;
    const a = Math.atan2(x - cx, z - cz);
    const fx = Math.sin(a), fz = Math.cos(a), rx = fz, rz = -fx;
    const role = (u) => u.def.tags.has('artillery') ? 3 : u.def.tags.has('villager') ? 4 : u.def.ranged && !u.def.tags.has('cavalry') ? 2 : u.def.tags.has('cavalry') ? 1 : 0;
    const sorted = units.slice().sort((p, q) => role(p) - role(q) || ((p.x * rx + p.z * rz) - (q.x * rx + q.z * rz)));
    const cols = Math.max(2, Math.ceil(Math.sqrt(units.length * 2.2)));
    const sp = units.some((u) => u.def.tags.has('cavalry') || u.def.tags.has('artillery')) ? 2.6 : 1.9;
    let row = 0, col = 0, lastRole = role(sorted[0]);
    const rows = [];
    for (const u of sorted) {
      const rl = role(u);
      if (rl !== lastRole && col > 0) { row++; col = 0; }
      lastRole = rl;
      (rows[row] || (rows[row] = [])).push(u);
      col++;
      if (col >= cols) { row++; col = 0; }
    }
    rows.forEach((list, r) => {
      list.sort((p, q) => (p.x * rx + p.z * rz) - (q.x * rx + q.z * rz));
      list.forEach((u, c) => {
        const off = (c - (list.length - 1) / 2) * sp;
        let tx = x + rx * off - fx * r * sp, tz = z + rz * off - fz * r * sp;
        tx = clamp(tx, 3, this.size - 3); tz = clamp(tz, 3, this.size - 3);
        u.cmdMove(tx, tz, attackMove);
      });
    });
  }
  orderTarget(units, t, opts = {}) {
    units = units.filter((u) => u.alive && !u.ko && !u.garrisoned);
    if (!units.length || !t) return null;
    let did = null;
    const own = units[0].owner;
    for (const u of units) {
      if (t.kind === 'treasure') { if (!u.def.tags.has('villager')) { u.cmdTreasure(t); did = 'treasure'; } else u.cmdMove(t.x, t.z); continue; }
      if (t.kind === 'res' || (t.kind === 'unit' && t.owner === GAIA && t.def.tags.has('huntable'))) {
        if (u.def.gather) { u.cmdGather(t); did = 'gather'; }
        else if (t.kind === 'unit') { u.cmdAttack(t); did = 'attack'; }
        else u.cmdMove(t.x, t.z);
        continue;
      }
      if (t.kind === 'building' && t.owner === u.owner) {
        if (u.def.build && !t.built) { u.cmdBuild(t); did = 'build'; continue; }
        if (u.def.gather && t.def.gather) { u.cmdGather(t); did = 'gather'; continue; }
        if (u.def.build && t.hp < t.maxHp) { u.cmdRepair(t); did = 'repair'; continue; }
        if (u.def.tags.has('villager') && t.key === 'tc' && opts.garrison) { u.cmdGarrison(t); did = 'garrison'; continue; }
        u.cmdMove(t.x, t.z + t.size / 2 + 2); did = 'move';
        continue;
      }
      if (this.validTarget(u, t) && (u.canFight || u.def.siege)) { u.cmdAttack(t); did = 'attack'; continue; }
      if (t.kind === 'unit' && t.owner === own) { u.cmdMove(t.x, t.z); did = 'move'; continue; }
      u.cmdMove(t.x, t.z);
    }
    if (did === 'move' || !did) this.orderMove(units.filter((u) => !u.order || u.order.type === 'move'), t.x, t.z, false);
    return did;
  }
  cmdTrain(b, key, count = 1) {
    const p = this.players[b.owner];
    const def = UNITS[key];
    if (!b.built || !b.alive) return 'Здание ещё не построено';
    if (def.age > p.age) return 'Требуется ' + AGES[def.age].name.toLowerCase();
    if (b.queue.length >= 6) return 'Очередь заполнена';
    const cost = p.costOf('unit', key);
    const total = {}; for (const r in cost) total[r] = cost[r] * count;
    if (!p.canAfford(total)) return 'Недостаточно ресурсов';
    p.pay(total);
    b.queue.push({ kind: 'unit', key, count, t: 0, total: def.time, cost: total, started: false });
    p.addXp(costTotal(total) * 0.05);
    return null;
  }
  cmdResearch(b, key) {
    const p = this.players[b.owner], T = TECHS[key];
    if (!b.built || !b.alive) return 'Здание ещё не построено';
    if (p.techs.has(key) || p.researching.has(key)) return 'Уже изучено';
    if (T.age > p.age) return 'Требуется ' + AGES[T.age].name.toLowerCase();
    if (T.req && !p.techs.has(T.req)) return 'Сначала: ' + TECHS[T.req].name;
    if (b.queue.length >= 6) return 'Очередь заполнена';
    if (!p.canAfford(T.cost)) return 'Недостаточно ресурсов';
    p.pay(T.cost); p.researching.add(key);
    b.queue.push({ kind: 'tech', key, count: 1, t: 0, total: T.time, cost: T.cost });
    return null;
  }
  cmdCancel(b, idx) {
    const q = b.queue[idx]; if (!q) return;
    const p = this.players[b.owner];
    b.queue.splice(idx, 1);
    p.refund(q.cost);
    if (q.kind === 'tech') p.researching.delete(q.key);
  }
  cmdAgeUp(p, polKey) {
    if (p.age >= 5) return 'Достигнута последняя эпоха';
    if (p.aging) return 'Переход в новую эпоху уже идёт';
    const tc = this.buildings.find((b) => b.alive && b.built && b.owner === p.index && b.key === 'tc');
    if (!tc) return 'Нужен городской центр';
    const A = AGES[p.age + 1];
    if (!p.canAfford(A.cost)) return 'Недостаточно ресурсов';
    p.pay(A.cost);
    p.aging = { to: p.age + 1, t: 0, total: A.time, pol: polKey, cost: A.cost };
    this.emit('agingStarted', p);
    return null;
  }
  cmdShip(p, key) {
    const c = CARDS[key];
    if (!c) return 'Нет такой поставки';
    if (p.shipments < 1) return 'Нет доступных поставок';
    if (p.inTransit) return 'Корабль уже в пути';
    if (!p.cardAvailable(c)) return c.age > p.age ? 'Требуется ' + AGES[c.age].name.toLowerCase() : 'Поставка уже использована';
    p.shipments--; p.cardsUsed.add(key);
    p.inTransit = { card: key, t: 0, total: p.civKey === 'spain' ? 15 : 20 };
    this.emit('shipmentSent', p, c);
    return null;
  }
  cmdPlace(p, key, cx0, cz0, builders) {
    const def = BUILDINGS[key];
    if (def.age > p.age) return 'Требуется ' + AGES[def.age].name.toLowerCase();
    if (def.wagonOnly) return 'Строится только фургоном';
    const cost = p.costOf('building', key);
    if (!p.canAfford(cost)) return 'Недостаточно ресурсов';
    if (!this.canPlace(key, cx0, cz0, p.index)) return def.socket ? 'Торговый пост строится только на гнезде торгового пути' : 'Здесь нельзя строить';
    p.pay(cost);
    const b = this.placeBuilding(key, p.index, cx0, cz0);
    for (const u of builders) if (u.alive && (u.def.build || (u.def.buildTP && key === 'tradingPost'))) u.cmdBuild(b);
    return b;
  }
  cmdMarket(p, action, r) {
    const m = this.buildings.find((b) => b.alive && b.built && b.owner === p.index && b.key === 'market');
    if (!m) return 'Нужен рынок';
    if (!(r in PRICE_BASE)) return 'Этим не торгуют';
    const price = Math.round(p.prices[r]);
    if (action === 'buy') {
      if (p.res.coin < price) return 'Недостаточно монет';
      p.res.coin -= price; p.res[r] += 100; p.prices[r] = clamp(p.prices[r] + 9, 25, 400);
    } else {
      if (p.res[r] < 100) return 'Нужно 100 ' + RES_NAME_GEN[r];
      p.res[r] -= 100; p.res.coin += this.sellPrice(p, r); p.prices[r] = clamp(p.prices[r] - 9, 25, 400);
    }
    return null;
  }
  sellPrice(p, r) { return Math.max(10, Math.round(p.prices[r]) - 22); }
  cmdRansom(p) {
    const ex = p.explorer;
    if (!ex || !ex.ko) return 'Исследователь в строю';
    if (p.res.coin < 300) return 'Нужно 300 монет';
    if (!this.reviveExplorer(ex)) return 'Нужен городской центр';
    p.res.coin -= 300;
    return null;
  }
  cmdAlarm(tc) {
    if (tc.garrison.length) { this.ungarrison(tc); return 'out'; }
    const vs = this.units.filter((u) => u.alive && u.owner === tc.owner && u.def.tags.has('villager') && dist(u.x, u.z, tc.x, tc.z) < 45);
    vs.sort((a, b) => dist2(a.x, a.z, tc.x, tc.z) - dist2(b.x, b.z, tc.x, tc.z));
    for (const u of vs.slice(0, tc.def.garrison)) u.cmdGarrison(tc);
    return 'in';
  }
  cmdDelete(e) {
    if (e.kind === 'unit') { if (e.def.hero) return; this.kill(e, null, GAIA); }
    else if (e.kind === 'building') {
      if (!e.built) this.players[e.owner].refund(this.players[e.owner].costOf('building', e.key), 1 - e.progress);
      e.hp = 0; this.kill(e, null, GAIA);
    }
  }
}
