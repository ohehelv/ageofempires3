// ---------------------------------------------------------------------------
// 12_ai.js — computer opponents
// ---------------------------------------------------------------------------
class BotAI {
  constructor(game, player) {
    this.g = game; this.p = player; this.d = DIFFICULTY[player.difficulty] || DIFFICULTY.normal;
    this.thinkT = game.rng.range(0.2, 1.5);
    this.wave = this.d.wave; this.waveN = 0;
    this.attacking = null; // {target player index, launched army size, x, z}
    this.rebalanceT = 6; this.scoutT = 0; this.tpBuilt = 0;
    this.alarm = false; this.lastAgeTry = 0;
    const tc = player.tc;
    this.homeX = tc ? tc.x : game.size / 2; this.homeZ = tc ? tc.z : game.size / 2;
    const a = Math.atan2(game.size / 2 - this.homeZ, game.size / 2 - this.homeX);
    this.frontX = this.homeX + Math.cos(a) * 20; this.frontZ = this.homeZ + Math.sin(a) * 20;
    this.dirX = Math.cos(a); this.dirZ = Math.sin(a);
  }
  tick(dt) {
    if (!this.p.alive || this.g.over) return;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = this.d.think * this.g.rng.range(0.85, 1.15);
    try { this.think(); } catch (e) { if (!this._errLogged) { console.warn('AI error', e); this._errLogged = true; } }
  }

  // ------------------------------------------------------------ helpers
  mine() {
    const g = this.g, pi = this.p.index;
    const S = { vill: [], idleVill: [], mil: [], idleMil: [], byKey: {}, bld: {}, bldAll: [], unfinished: [], explorer: this.p.explorer, wagons: [] };
    for (const u of g.units) {
      if (!u.alive || u.owner !== pi || u.garrisoned) continue;
      S.byKey[u.key] = (S.byKey[u.key] || 0) + 1;
      if (u.def.tags.has('villager')) { S.vill.push(u); if (!u.order) S.idleVill.push(u); }
      else if (u.def.tags.has('wagon')) S.wagons.push(u);
      else if (u.isMilitary && !u.def.hero) { S.mil.push(u); if (!u.order) S.idleMil.push(u); }
    }
    for (const b of g.buildings) {
      if (!b.alive || b.owner !== pi) continue;
      (S.bld[b.key] || (S.bld[b.key] = [])).push(b);
      S.bldAll.push(b);
      if (!b.built) S.unfinished.push(b);
    }
    S.tc = (S.bld.tc || []).find((b) => b.built) || (S.bld.tc || [])[0] || null;
    if (S.tc) { this.homeX = S.tc.x; this.homeZ = S.tc.z; }
    S.garrisoned = 0;
    for (const b of S.bld.tc || []) S.garrisoned += b.garrison.length;
    return S;
  }
  count(S, key) { return (S.bld[key] || []).length; }
  builtCount(S, key) { return (S.bld[key] || []).filter((b) => b.built).length; }
  resOf(u) {
    const o = u.order;
    if (!o) return null;
    if (o.type === 'build') return 'build';
    if (o.type !== 'gather') return null;
    const t = o.target;
    if (t.kind === 'building') return t.def.gather;
    if (t.kind === 'unit') return 'food';
    return t.res;
  }
  desired(S) {
    const p = this.p, age = p.age;
    const base = age === 1 ? { food: 0.62, wood: 0.27, coin: 0.11, stone: 0 }
      : age === 2 ? { food: 0.45, wood: 0.27, coin: 0.22, stone: 0.06 }
        : age === 3 ? { food: 0.42, wood: 0.23, coin: 0.27, stone: 0.08 }
          : { food: 0.4, wood: 0.24, coin: 0.28, stone: 0.08 };
    const w = Object.assign({}, base);
    const goal = this.savingFor ? AGES[this.savingFor].cost : null;
    // stone is wanted only up to a stock target (towers, stone buildings, next age)
    const stoneNeed = Math.max(this.stoneTarget(), goal && goal.stone ? goal.stone + 150 : 0) - p.res.stone;
    w.stone = stoneNeed <= 0 ? 0 : clamp(0.03 + stoneNeed / 4000, 0.05, 0.14);
    for (const r of RES) {
      if (r === 'stone') continue;
      const need = goal ? (goal[r] || 0) : 0;
      if (goal) {
        if (need === 0) w[r] *= 0.75;
        else if (p.res[r] >= need) w[r] *= 0.35;
        else w[r] *= 1 + Math.min(1.5, (need - p.res[r]) / 900);
      }
      if (p.res[r] > 3000) w[r] *= 0.15; else if (p.res[r] > 1600) w[r] *= 0.4;
    }
    if (!this.quarryReachable) w.stone = 0;
    w.wood = Math.max(w.wood, 0.14);
    const t = w.food + w.wood + w.coin + w.stone;
    return { food: w.food / t, wood: w.wood / t, coin: w.coin / t, stone: w.stone / t };
  }
  // how much stone the bot likes to keep for towers, stone buildings and the next age
  stoneTarget() { return [0, 0, 300, 450, 600, 600][this.p.age]; }
  reserve() { return this.savingFor ? AGES[this.savingFor].cost : null; }
  canSpend(cost) {
    const p = this.p, rsv = this.reserve();
    for (const r in cost) if (p.res[r] - (rsv && rsv[r] ? rsv[r] : 0) < cost[r]) return false;
    return true;
  }
  targetVillagers() {
    const m = this.d.maxVill;
    return Math.min(m, [0, 22, 38, 55, 70, 80][this.p.age]);
  }
  enemyPlayers() { return this.g.players.filter((q) => q.alive && this.g.enemies(this.p.index, q.index)); }
  enemyComposition() {
    const c = { heavyInf: 0, lightInf: 0, heavyCav: 0, lightCav: 0, artillery: 0 };
    for (const u of this.g.units) {
      if (!u.alive || u.owner < 0 || !this.g.enemies(this.p.index, u.owner)) continue;
      for (const k in c) if (u.def.tags.has(k)) c[k]++;
    }
    return c;
  }

  // ------------------------------------------------------------ main decision loop
  think() {
    const g = this.g, p = this.p;
    const S = this.mine();
    if (!S.tc && !S.vill.length && !S.mil.length) return;
    this.handleWagons(S);
    this.handleAge(S);
    this.handleEconomy(S);
    this.handleBuildings(S);
    this.handleTechs(S);
    this.handleMilitary(S);
    this.handleShipments(S);
    this.handleExplorer(S);
    this.handleDefense(S);
    this.handleAttack(S);
    this.handleMarket(S);
  }

  // ------------------------------------------------------------ age
  handleAge(S) {
    const g = this.g, p = this.p;
    this.savingFor = 0;
    if (p.aging || p.age >= 5 || !S.tc) return;
    const to = p.age + 1;
    if (g.time < (this.d.ageMinTime[to - 1] || 0)) return;
    const villNeed = [0, 0, 13, 24, 34, 42][to] * (this.p.difficulty === 'easy' ? 0.8 : 1);
    if (S.vill.length < villNeed) return;
    const milNeed = { easy: [0, 0, 0, 0, 6, 10], normal: [0, 0, 0, 4, 10, 16], hard: [0, 0, 0, 6, 14, 20], expert: [0, 0, 0, 8, 16, 24] }[this.p.difficulty] || [0, 0, 0, 4, 10, 16];
    if (S.mil.length < milNeed[to]) { this.savingFor = 0; return; }
    if (to >= 3 && this.underAttack && S.mil.length < 8) return;
    this.savingFor = to;
    const A = AGES[to];
    if (p.canAfford(A.cost)) {
      const pols = POLITICIANS[to];
      let pick = pols[g.rng.int(0, pols.length - 1)];
      if (this.underAttack) pick = pols.find((x) => x.give.units && !x.give.units.fortWagon) || pick;
      g.cmdAgeUp(p, pick.key);
      this.savingFor = 0;
    }
  }

  // ------------------------------------------------------------ economy
  handleEconomy(S) {
    const g = this.g, p = this.p;
    // train settlers
    if (S.tc && S.tc.built) {
      const inQ = S.tc.queue.filter((q) => q.kind === 'unit').reduce((a, q) => a + q.count, 0);
      if (S.vill.length + inQ < this.targetVillagers() && inQ < 2 && p.popUsed() < p.popCap()) {
        const c = p.costOf('unit', 'settler');
        const reserve = this.savingFor ? 0 : 0;
        if (p.res.food - reserve >= c.food) g.cmdTrain(S.tc, 'settler');
      }
    }
    // is there still a quarry worth walking to?
    this.quarryT = (this.quarryT || 0) - this.d.think;
    if (this.quarryT <= 0) {
      this.quarryT = 10;
      const hx = this.homeX, hz = this.homeZ;
      this.quarryReachable = g.resources.some((r) => r.alive && r.rkind === 'quarry' && r.amount > 0 && dist2(r.x, r.z, hx, hz) < 150 * 150);
    }
    // gatherer assignment
    const counts = { food: 0, wood: 0, coin: 0, stone: 0 };
    for (const u of S.vill) { const r = this.resOf(u); if (r && counts[r] !== undefined) counts[r]++; }
    const want = this.desired(S);
    const workers = S.vill.length - S.idleVill.length;
    const total = S.vill.length;
    for (const u of S.idleVill) {
      // finish nearby construction first
      const unf = g.findUnfinished(p.index, u.x, u.z, 40);
      if (unf && S.unfinished.length && g.rng.chance(0.5)) { u.cmdBuild(unf); continue; }
      let best = 'food', bd = -1e9;
      for (const r of RES) { const def = want[r] * total - counts[r]; if (def > bd) { bd = def; best = r; } }
      if (this.assignGather(u, best, S)) counts[best]++;
      else for (const r of RES) if (r !== best && this.assignGather(u, r, S)) { counts[r]++; break; }
    }
    // rebalance
    this.rebalanceT -= this.d.think;
    if (this.rebalanceT <= 0 && total > 6) {
      this.rebalanceT = 7;
      let surplus = null, deficit = null, sv = 0, dv = 0;
      for (const r of RES) {
        const diff = counts[r] - want[r] * total;
        if (diff > sv) { sv = diff; surplus = r; }
        if (-diff > dv) { dv = -diff; deficit = r; }
      }
      if (surplus && deficit && sv >= 1.5 && dv >= 1.5) {
        let moved = 0;
        for (const u of S.vill) {
          if (moved >= 2) break;
          if (this.resOf(u) === surplus && this.assignGather(u, deficit, S)) moved++;
        }
      }
    }
    void workers;
  }
  assignGather(u, r, S) {
    const g = this.g, p = this.p, hx = this.homeX, hz = this.homeZ;
    let t = null;
    if (r === 'food') {
      t = this.nearCrate(hx, hz, 'food') || this.nearCrate(hx, hz);
      if (!t) t = g.findNearestResource(['bush', 'carcass'], hx, hz, 48, null, p.index);
      if (!t) t = g.findNearestResource(['hunt'], hx, hz, 62, null, p.index);
      if (!t) t = g.findGatherBuilding(p.index, 'mill', u.x, u.z);
      if (!t) t = g.findNearestResource(['hunt', 'bush', 'carcass'], hx, hz, 110, null, p.index);
    } else if (r === 'wood') {
      t = g.findNearestResource(['tree'], u.order ? hx : u.x, u.order ? hz : u.z, 60, null, p.index) || g.findNearestResource(['tree'], hx, hz, 120, null, p.index);
    } else if (r === 'stone') {
      t = g.findNearestResource(['quarry'], hx, hz, 70, null, p.index) || g.findNearestResource(['quarry'], hx, hz, 150, null, p.index);
    } else {
      t = g.findNearestResource(['mine'], hx, hz, 68, null, p.index);
      if (!t) t = g.findGatherBuilding(p.index, 'plantation', u.x, u.z);
      if (!t) t = g.findNearestResource(['mine'], hx, hz, 140, null, p.index);
    }
    if (!t) return false;
    u.cmdGather(t);
    return true;
  }

  // a starting crate near home that still has a free, reachable spot
  nearCrate(hx, hz, res) {
    const g = this.g;
    let best = null, bd = 24 * 24;
    for (const c of g.crates) {
      if (!c.alive || c.amount <= 0 || (res && c.res !== res)) continue;
      const d = dist2(c.x, c.z, hx, hz);
      if (d >= bd) continue;
      c.ensureSlots();
      if (c.unreachable || c.slotOcc.every((o) => o)) continue;
      bd = d; best = c;
    }
    return best;
  }

  // ------------------------------------------------------------ construction
  handleBuildings(S) {
    const g = this.g, p = this.p;
    if (!S.tc) return;
    const popRoom = p.popCap() - p.popUsed();
    const housesBuilding = (S.bld.house || []).filter((b) => !b.built).length;
    const need = p.popCap() < 200 && popRoom < 5 + p.age * 2 && housesBuilding < (p.age >= 3 ? 2 : 1);
    if (need) this.build('house', S, 10, 26, 1);
    const food = g.resources.filter((r) => r.alive && (r.rkind === 'bush' || r.rkind === 'carcass') && dist(r.x, r.z, this.homeX, this.homeZ) < 60).reduce((a, r) => a + r.amount, 0)
      + g.units.filter((u) => u.alive && u.owner === GAIA && u.def.tags.has('huntable') && dist(u.x, u.z, this.homeX, this.homeZ) < 65).reduce((a, u) => a + u.def.food, 0);
    const mills = this.count(S, 'mill');
    const foodWorkers = S.vill.filter((u) => this.resOf(u) === 'food').length;
    if ((food < 1200 && mills === 0 && S.vill.length >= 10) || (mills > 0 && foodWorkers > mills * 9 && food < 1500 && mills < 5)) this.build('mill', S, 12, 30, 2);
    if (p.age >= 2) {
      const coin = g.resources.filter((r) => r.alive && r.rkind === 'mine' && dist(r.x, r.z, this.homeX, this.homeZ) < 70).reduce((a, r) => a + r.amount, 0);
      const plants = this.count(S, 'plantation');
      const coinWorkers = S.vill.filter((u) => this.resOf(u) === 'coin').length;
      if ((coin < 1500 && plants === 0 && S.vill.length > 20) || (plants > 0 && coin < 800 && coinWorkers > plants * 9 && plants < 4)) this.build('plantation', S, 12, 32, 2);
    }
    if (!this.count(S, 'market') && S.vill.length >= 12) this.build('market', S, 14, 30, 1);
    if (p.age >= 2) {
      if (!this.count(S, 'barracks')) this.build('barracks', S, 16, 32, 2, true);
      else if (!this.count(S, 'stable') && S.vill.length >= 22) this.build('stable', S, 16, 34, 2, true);
      else if (this.p.difficulty !== 'easy' && !this.count(S, 'church') && S.vill.length >= 32 && p.res.wood > 500) this.build('church', S, 14, 32, 1);
    }
    if (p.age >= 3) {
      if (!this.count(S, 'foundry')) this.build('foundry', S, 16, 34, 2, true);
      else if (!this.count(S, 'arsenal') && this.d.techs > 0.5) this.build('arsenal', S, 14, 32, 1);
      const extra = this.p.difficulty === 'hard' || this.p.difficulty === 'expert' ? 2 : 1;
      if (this.count(S, 'barracks') < extra && p.res.wood > 400) this.build('barracks', S, 16, 36, 2, true);
      if (this.count(S, 'stable') < extra && p.res.wood > 450) this.build('stable', S, 16, 36, 2, true);
    }
    if (p.age >= 2 && this.count(S, 'outpost') < (this.p.difficulty === 'easy' ? 0 : 1) && p.res.wood > 400) this.build('outpost', S, 22, 34, 1, true);
    // stone bastions guard the approach
    const strong = this.p.difficulty === 'hard' || this.p.difficulty === 'expert';
    const towersWanted = this.p.difficulty === 'easy' ? (p.age >= 4 ? 1 : 0) : p.age >= 3 ? (strong ? 2 : 1) : (strong && S.vill.length >= 24 ? 1 : 0);
    if (this.count(S, 'tower') < towersWanted && p.res.stone >= 300) this.build('tower', S, 16, 30, 2, true);
    // repair damaged buildings when safe
    if (!this.underAttack) {
      const dmg = S.bldAll.find((b) => b.built && b.hp < b.maxHp * 0.7);
      if (dmg && !S.vill.some((u) => u.order && u.order.type === 'build' && u.order.target === dmg)) {
        const v = this.nearestVill(S, dmg.x, dmg.z);
        if (v) v.cmdRepair(dmg);
      }
    }
  }
  nearestVill(S, x, z, exclude) {
    let best = null, bd = 1e9;
    for (const u of S.vill) {
      if (exclude && exclude.has(u)) continue;
      if (u.order && u.order.type === 'build') continue;
      const d = dist2(u.x, u.z, x, z);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  build(key, S, rMin, rMax, builders, forward) {
    const g = this.g, p = this.p;
    if ((S.bld[key] || []).some((b) => !b.built)) return false;
    const cost = p.costOf('building', key);
    const essential = key === 'house' || key === 'mill' || key === 'plantation';
    if (!(essential ? p.canAfford(cost) : this.canSpend(cost))) return false;
    if (BUILDINGS[key].age > p.age) return false;
    if (S.vill.length < 2) return false;
    let cx = this.homeX, cz = this.homeZ;
    if (forward) { cx += this.dirX * 10; cz += this.dirZ * 10; }
    const spot = g.findBuildSpot(p.index, key, cx, cz, rMin, rMax);
    if (!spot) return false;
    const used = new Set();
    const list = [];
    for (let i = 0; i < builders; i++) { const v = this.nearestVill(S, (spot.cx0 + 1) * CELL, (spot.cz0 + 1) * CELL, used); if (v) { used.add(v); list.push(v); } }
    if (!list.length) return false;
    const b = g.cmdPlace(p, key, spot.cx0, spot.cz0, list);
    if (b && typeof b === 'object') { (S.bld[key] || (S.bld[key] = [])).push(b); S.unfinished.push(b); return true; }
    return false;
  }

  // ------------------------------------------------------------ technologies
  handleTechs(S) {
    const g = this.g, p = this.p;
    if (g.rng.next() > this.d.techs) return;
    const order = ['huntingDogs', 'gangSaw', 'placerMines', 'stonecutters', 'seedDrill', 'bookkeeping', 'tc_fortify', 'circularSaw', 'deepMining', 'paperCartridge', 'vetInf', 'vetCav', 'masonry', 'blasting', 'fertilizer', 'exchange', 'cuirass', 'breastplate', 'gunnersQuadrant', 'heavyGuns', 'vetArt', 'guardInf', 'guardCav', 'fieldHospital', 'impInf', 'impCav'];
    for (const k of order) {
      const T = TECHS[k];
      if (p.techs.has(k) || p.researching.has(k) || T.age > p.age) continue;
      if (T.req && !p.techs.has(T.req)) continue;
      const b = (S.bld[T.at] || []).find((x) => x.built && x.queue.length < 2);
      if (!b) continue;
      // keep a reserve for military in later ages
      const c = T.cost; let ok = this.canSpend(c);
      for (const r in c) if (p.res[r] < c[r] + (p.age >= 3 ? 250 : 50)) ok = false;
      if (!ok) continue;
      g.cmdResearch(b, k);
      break;
    }
  }

  // ------------------------------------------------------------ army
  pickUnit(bkey, S) {
    const g = this.g, p = this.p, civ = p.civKey;
    const cands = BUILDINGS[bkey].trains.filter((k) => {
      const d = UNITS[k];
      if (d.age > p.age) return false;
      if (d.civ && !d.civ.includes(civ)) return false;
      if (d.notCiv && d.notCiv.includes(civ)) return false;
      if (k === 'culverin' && this.enemyArt < 2) return false;
      if (k === 'mortar' && !this.attacking) return false;
      return true;
    });
    if (!cands.length) return null;
    const e = this.d.counter ? this.enemyComposition() : { heavyInf: 2, lightInf: 1, heavyCav: 1, lightCav: 0, artillery: 0 };
    this.enemyArt = e.artillery;
    const myArt = S.byKey.falconet || 0;
    const w = (k) => {
      const d = UNITS[k], t = d.tags;
      let s = 1;
      if (k === 'musketeer') s = 3 + e.heavyCav * 0.4;
      if (k === 'pikeman') s = 1.4 + e.heavyCav * 0.35;
      if (t.has('lightInf')) s = 2.2 + e.heavyInf * 0.35;
      if (k === 'skirmisher') s += 0.8;
      if (k === 'rodelero') s = 2 + e.lightInf * 0.45;
      if (k === 'grenadier') s = 0.8;
      if (k === 'hussar') s = 2.4 + e.lightInf * 0.3 + e.artillery * 0.8;
      if (k === 'cuirassier') s = 2.6 + e.lightInf * 0.3;
      if (k === 'dragoon') s = 1.2 + e.heavyCav * 0.5;
      if (k === 'falconet') s = myArt < 4 ? 1.6 + (e.heavyInf + e.lightInf) * 0.04 : 0.2;
      if (k === 'culverin') s = e.artillery * 0.6;
      if (k === 'mortar') s = (S.byKey.mortar || 0) < 2 ? 1.2 : 0.1;
      if (d.civ) s *= 1.35;
      const c = p.costOf('unit', k);
      if (!p.canAfford(c)) s *= 0.05;
      return s * g.rng.range(0.7, 1.3);
    };
    let best = null, bs = 0;
    for (const k of cands) { const s = w(k); if (s > bs) { bs = s; best = k; } }
    return best;
  }
  handleMilitary(S) {
    const g = this.g, p = this.p;
    if (p.age < 2) return;
    const milPop = S.mil.reduce((a, u) => a + u.def.pop, 0);
    const cap = Math.min(this.d.maxArmy + p.age * (this.d.maxArmy > 30 ? 6 : 2), Math.max(10, p.popCap() - Math.min(S.vill.length, this.targetVillagers()) - 2));
    if (milPop >= cap) return;
    for (const key of ['barracks', 'stable', 'foundry', 'fort']) {
      for (const b of S.bld[key] || []) {
        if (!b.built || b.queue.length >= 2) continue;
        if (p.popUsed() >= p.popCap()) return;
        const k = this.pickUnit(key, S);
        if (!k) continue;
        const c = p.costOf('unit', k);
        if (!(this.underAttack ? p.canAfford(c) : this.canSpend(c))) continue;
        const batch = p.res.food > 1200 && p.res.coin > 800 && UNITS[k].pop <= 2 ? 2 : 1;
        const err = g.cmdTrain(b, k, batch);
        if (err === 'Недостаточно ресурсов' && batch > 1) g.cmdTrain(b, k, 1);
        b.rally = { x: this.frontX + g.rng.range(-5, 5), z: this.frontZ + g.rng.range(-5, 5) };
      }
    }
  }

  // ------------------------------------------------------------ shipments
  handleShipments(S) {
    const g = this.g, p = this.p;
    if (p.shipments < 1 || p.inTransit) return;
    const avail = p.deck.filter((c) => p.cardAvailable(c));
    if (!avail.length) return;
    const score = (c) => {
      let s = 1 + c.age * 0.8;
      if (c.give.units) {
        const n = Object.values(c.give.units).reduce((a, b) => a + b, 0);
        if (c.give.units.settler) s += p.age <= 2 ? 3 : 0.5;
        else if (c.give.units.fortWagon) s += p.age >= 3 ? 2.5 : 0;
        else if (c.give.units.tcWagon) s += 0.5;
        else s += (this.underAttack ? 3 : 1.2) + n * 0.05;
      }
      if (c.give.res) {
        s += p.age === 1 ? 2 : 1;
        if (c.give.res.wood && p.res.wood < 200) s += 1;
        if (c.give.res.coin && this.savingFor >= 3) s += 1.5;
        if (c.give.res.stone) s += p.age >= 2 && p.res.stone < this.stoneTarget() ? 1.2 : -1;
      }
      if (c.give.fx) s += p.age <= 2 ? 1.8 : 0.4;
      return s + g.rng.range(0, 1.5);
    };
    avail.sort((a, b) => score(b) - score(a));
    g.cmdShip(p, avail[0].key);
  }

  // ------------------------------------------------------------ explorer & wagons
  handleExplorer(S) {
    const g = this.g, p = this.p, ex = p.explorer;
    if (!ex) return;
    if (ex.ko) {
      if ((this.p.difficulty === 'hard' || this.p.difficulty === 'expert') && p.res.coin > 700 && p.age >= 2) g.cmdRansom(p);
      return;
    }
    if (!ex.alive || ex.order) return;
    // trading post
    if (this.tpBuilt < (this.p.difficulty === 'easy' ? 0 : 2) && p.res.wood >= 260 && g.time > 120) {
      let best = null, bd = 1e9;
      const foes = this.enemyPlayers().filter((q) => q.tc && q.tc.alive);
      for (const s of g.sockets) {
        if (s.tp) continue;
        const d = dist2(s.x, s.z, this.homeX, this.homeZ);
        if (foes.some((q) => dist2(s.x, s.z, q.tc.x, q.tc.z) < d)) continue; // leave sockets on the enemy's side
        if (d < bd) { bd = d; best = s; }
      }
      if (best && bd < 150 * 150) {
        const b = g.cmdPlace(p, 'tradingPost', best.cx0, best.cz0, [ex]);
        if (b && typeof b === 'object') { this.tpBuilt++; return; }
      }
    }
    // treasure hunting
    const maxTier = this.p.difficulty === 'easy' ? 1 : 2;
    if (ex.hp > ex.maxHp * 0.5) {
      let best = null, bd = 1e9;
      for (const t of g.treasures) {
        if (!t.alive || t.tier > maxTier) continue;
        if (t.noPath && g.time - (t.noPath[p.index] || -1e9) < 300) continue;
        const guards = t.guards.filter((u) => u.alive).reduce((a, u) => a + u.def.hp, 0);
        if (guards > (t.tier === 1 ? 160 : 400)) continue;
        let nearEnemy = false;
        for (const q of this.enemyPlayers()) if (q.tc && q.tc.alive && dist(q.tc.x, q.tc.z, t.x, t.z) < 55) nearEnemy = true;
        if (nearEnemy) continue;
        const d = dist(t.x, t.z, ex.x, ex.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best && bd < 160) { ex.cmdTreasure(best); return; }
    } else if (dist(ex.x, ex.z, this.homeX, this.homeZ) > 20) { ex.cmdMove(this.homeX + 6, this.homeZ + 6); return; }
    // scout
    this.scoutT -= this.d.think;
    if (this.scoutT <= 0) {
      this.scoutT = 25;
      const a = g.rng.range(0, TAU), r = g.rng.range(30, g.size * 0.4);
      ex.cmdMove(clamp(this.homeX + Math.cos(a) * r, 10, g.size - 10), clamp(this.homeZ + Math.sin(a) * r, 10, g.size - 10));
    }
  }
  handleWagons(S) {
    const g = this.g, p = this.p;
    for (const w of S.wagons) {
      if (w.order) continue;
      const key = w.def.builds;
      const spot = key === 'fort'
        ? g.findBuildSpot(p.index, key, this.homeX + this.dirX * 30, this.homeZ + this.dirZ * 30, 0, 26)
        : g.findBuildSpot(p.index, key, this.homeX - this.dirX * 30, this.homeZ - this.dirZ * 30, 20, 60);
      if (spot) w.cmdDeploy(key, spot.cx0, spot.cz0);
    }
  }

  // ------------------------------------------------------------ defense & attack
  handleDefense(S) {
    const g = this.g, p = this.p;
    let threat = null, tc = 0;
    const tcs = S.bld.tc || [];
    for (const u of g.units) {
      if (!u.alive || u.owner < 0 || !g.enemies(p.index, u.owner) || !u.isMilitary) continue;
      for (const b of S.bldAll) {
        if (dist2(u.x, u.z, b.x, b.z) < 36 * 36) { tc++; if (!threat) threat = u; break; }
      }
    }
    this.underAttack = tc > 0;
    if (threat) {
      const defenders = S.mil.filter((u) => !this.attacking || !u.inWave);
      for (const u of defenders) {
        if (u.order && u.order.type === 'attack' && u.order.target.alive) continue;
        u.cmdMove(threat.x, threat.z, true);
      }
      // villagers hide when the raid is serious
      if (tc >= 5 && S.mil.length < tc && !this.alarm && tcs.length) {
        for (const t of tcs) if (t.built && !t.garrison.length) g.cmdAlarm(t);
        this.alarm = true;
      }
    } else if (this.alarm) {
      for (const t of tcs) if (t.garrison.length) g.ungarrison(t);
      this.alarm = false;
    }
    // gather idle army at the front
    if (!threat) for (const u of S.idleMil) if (!u.inWave && dist2(u.x, u.z, this.frontX, this.frontZ) > 15 * 15) u.cmdMove(this.frontX + g.rng.range(-6, 6), this.frontZ + g.rng.range(-6, 6));
  }
  handleAttack(S) {
    const g = this.g, p = this.p;
    const army = S.mil;
    if (this.attacking) {
      const wave = army.filter((u) => u.inWave);
      if (wave.length < Math.max(2, this.attacking.size * 0.3)) {
        for (const u of wave) { u.inWave = false; u.cmdMove(this.frontX + g.rng.range(-5, 5), this.frontZ + g.rng.range(-5, 5)); }
        this.attacking = null; this.wave += this.d.waveGrow; this.waveN++;
        return;
      }
      // pick next target when idle near target area
      const tgtP = g.players[this.attacking.player];
      let target = null, bd = 1e9;
      let cx = 0, cz = 0; for (const u of wave) { cx += u.x; cz += u.z; } cx /= wave.length; cz /= wave.length;
      for (const b of g.buildings) {
        if (!b.alive || !g.enemies(p.index, b.owner)) continue;
        const d = dist2(b.x, b.z, cx, cz) * (b.owner === tgtP.index ? 1 : 1.6);
        if (d < bd) { bd = d; target = b; }
      }
      if (!target) {
        for (const u of g.units) { if (!u.alive || u.owner < 0 || !g.enemies(p.index, u.owner) || u.ko) continue; const d = dist2(u.x, u.z, cx, cz); if (d < bd) { bd = d; target = u; } }
      }
      if (!target) { for (const u of wave) u.inWave = false; this.attacking = null; return; }
      for (const u of wave) {
        if (u.order && (u.order.type === 'attack' || u.order.type === 'move')) continue;
        if (u.def.ranged && u.def.ranged.buildingsOnly && target.kind === 'building') u.cmdAttack(target);
        else u.cmdMove(target.x + g.rng.range(-4, 4), target.z + g.rng.range(-4, 4), true);
      }
      return;
    }
    if (g.time < this.d.firstAttack || this.underAttack) return;
    const pop = army.reduce((a, u) => a + u.def.pop, 0);
    if (pop < this.wave) return;
    // choose the nearest enemy base
    let best = null, bd = 1e9;
    for (const q of this.enemyPlayers()) {
      const b = g.buildings.find((x) => x.alive && x.owner === q.index && x.key === 'tc') || g.buildings.find((x) => x.alive && x.owner === q.index);
      if (!b) continue;
      const d = dist2(b.x, b.z, this.homeX, this.homeZ);
      if (d < bd) { bd = d; best = { q, b }; }
    }
    if (!best) return;
    let units = army.filter((u) => !u.def.tags.has('wagon'));
    const capN = Math.round(this.wave * (this.p.difficulty === 'easy' ? 1.3 : this.p.difficulty === 'normal' ? 1.7 : 3));
    if (units.length > capN) { units.sort((a, b) => dist2(a.x, a.z, this.frontX, this.frontZ) - dist2(b.x, b.z, this.frontX, this.frontZ)); units = units.slice(0, capN); }
    this.attacking = { player: best.q.index, size: units.length, x: best.b.x, z: best.b.z };
    for (const u of units) u.inWave = true;
    g.orderMove(units, best.b.x, best.b.z, true);
  }
  handleMarket(S) {
    const g = this.g, p = this.p;
    if (!this.builtCount(S, 'market') || p.age < 2) return;
    const rsv = this.reserve() || {};
    for (let i = 0; i < 3; i++) {
      const spare = p.res.coin - (rsv.coin || 0);
      const stoneShort = p.res.stone < (rsv.stone || 0) + (this.quarryReachable ? 0 : 300);
      if (spare > 900 && p.res.food < 500 + (rsv.food || 0) && p.prices.food < 160) g.cmdMarket(p, 'buy', 'food');
      else if (spare > 900 && p.res.wood < 400 && p.prices.wood < 160) g.cmdMarket(p, 'buy', 'wood');
      else if (spare > 700 && stoneShort && p.prices.stone < 200) g.cmdMarket(p, 'buy', 'stone');
      else if (p.res.wood > 2200 && p.res.coin < 600) g.cmdMarket(p, 'sell', 'wood');
      else if (p.res.food > 2600 && p.res.coin < 600) g.cmdMarket(p, 'sell', 'food');
      else if (p.res.stone > 1800 && p.res.coin < 600) g.cmdMarket(p, 'sell', 'stone');
      else break;
    }
  }
}
