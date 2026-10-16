// ---------------------------------------------------------------------------
// 10_entities.js — Unit, Building, Resource behaviour
// ---------------------------------------------------------------------------
const ANIM_OF = { gun: ANIM.GUN, xbow: ANIM.XBOW, bow: ANIM.BOW, throw: ANIM.THROW, cannon: ANIM.CANNON, sword: ANIM.SWORD, pike: ANIM.PIKE, work: ANIM.WORK, bite: ANIM.SWORD };
const GATHER_RANGE = 1.35;

class Resource {
  constructor(game, kind, x, z, amount, extra = {}) {
    this.game = game; this.id = game.nextId++; this.kind = 'res'; this.rkind = kind; this.x = x; this.z = z;
    this.amount = amount; this.max = amount; this.alive = true;
    Object.assign(this, extra);
    this.res = kind === 'tree' ? 'wood' : kind === 'mine' ? 'coin' : kind === 'quarry' ? 'stone' : kind === 'crate' ? extra.res : 'food';
    this.rateKey = kind === 'tree' ? 'wood' : kind === 'mine' ? 'mine' : kind === 'quarry' ? 'quarry' : kind === 'bush' ? 'berry' : kind === 'carcass' ? 'hunt' : 'crate';
    this.users = 0;
    this.slots = null; this.slotOcc = null;
  }
  get deposit() { return this.rkind === 'mine' || this.rkind === 'quarry'; }
  get name() {
    if (this.rkind === 'tree') return 'Дерево';
    if (this.rkind === 'mine') return 'Серебряный рудник';
    if (this.rkind === 'quarry') return 'Каменоломня';
    if (this.rkind === 'bush') return 'Ягодный куст';
    if (this.rkind === 'carcass') return (UNITS[this.animal.key] || {}).name || 'Туша';
    if (this.rkind === 'crate') return { food: 'Ящик с провиантом', wood: 'Связка брёвен', coin: 'Сундук монет', stone: 'Груда тёсаного камня' }[this.res];
    return 'Ресурс';
  }
  // footprint rect in cells (for blocking resources)
  rect() {
    if (this.deposit) return { x0: this.cx, z0: this.cz, x1: this.cx + 1, z1: this.cz + 1 };
    if (this.rkind === 'tree' || this.rkind === 'bush') return { x0: this.cx, z0: this.cz, x1: this.cx, z1: this.cz };
    const cx = Math.floor(this.x / CELL), cz = Math.floor(this.z / CELL);
    return { x0: cx, z0: cz, x1: cx, z1: cz };
  }
  edgeDist(x, z) {
    if (this.deposit) return Math.max(0, Math.max(Math.abs(x - this.x), Math.abs(z - this.z)) - 2);
    if (this.rkind === 'tree' || this.rkind === 'bush') return Math.max(0, Math.max(Math.abs(x - (this.cx + 0.5) * CELL), Math.abs(z - (this.cz + 0.5) * CELL)) - 1);
    return Math.max(0, dist(x, z, this.x, this.z) - 0.6);
  }
  ensureSlots() {
    if (this.slots) return;
    const nav = this.game.nav;
    const pts = [];
    if (this.deposit) {
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; pts.push({ x: this.x + Math.cos(a) * 3.0, z: this.z + Math.sin(a) * 3.0 }); }
    } else if (this.rkind === 'bush') {
      const cx = (this.cx + 0.5) * CELL, cz = (this.cz + 0.5) * CELL;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push({ x: cx + dx * 1.75, z: cz + dz * 1.75 });
    } else if (this.rkind === 'carcass' || this.rkind === 'crate') {
      // ring of standing spots; widen the ring if something stands right next to the pile
      for (const rad of [1.15, 1.8, 2.4]) {
        const ring = [];
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + rad; ring.push({ x: this.x + Math.cos(a) * rad, z: this.z + Math.sin(a) * rad }); }
        if (!pts.length) pts.push(...ring);
        if (ring.some((p) => nav.freeW(p.x, p.z))) { pts.length = 0; pts.push(...ring); break; }
      }
    }
    this.slots = pts.filter((p) => nav.freeW(p.x, p.z));
    this.unreachable = false;
    if (!this.slots.length && this.rkind !== 'tree') { this.slots = pts.slice(0, 1); this.unreachable = true; }
    this.slotOcc = new Array(this.slots.length).fill(0);
  }
}

class Building {
  constructor(game, key, owner, cx0, cz0, built) {
    const def = BUILDINGS[key];
    this.game = game; this.id = game.nextId++; this.kind = 'building'; this.key = key; this.def = def; this.owner = owner;
    this.player = game.players[owner];
    this.cx0 = cx0; this.cz0 = cz0; this.n = def.cells; this.size = def.size;
    this.x = (cx0 + this.n / 2) * CELL; this.z = (cz0 + this.n / 2) * CELL;
    this.maxHp = Math.round(def.hp * this.player.bldHpMul(key));
    this.built = !!built; this.progress = built ? 1 : 0;
    this.hp = built ? this.maxHp : Math.max(1, Math.round(this.maxHp * 0.1));
    this.queue = []; this.rally = null; this.attackT = Math.random(); this.garrison = [];
    this.alive = true; this.deathT = 0; this.selfBuild = false;
    this.slots = null; this.slotOcc = null; this.lastHitT = -99; this.fxT = Math.random();
    this.socket = null;
  }
  get name() { return this.def.name; }
  rect() { return { x0: this.cx0, z0: this.cz0, x1: this.cx0 + this.n - 1, z1: this.cz0 + this.n - 1 }; }
  edgeDist(x, z) { const h = this.size / 2; return Math.max(0, Math.max(Math.abs(x - this.x) - h, Math.abs(z - this.z) - h)); }
  ensureSlots() {
    if (this.slots) return;
    const nav = this.game.nav, r = this.size / 2 + 1.3;
    const pts = [];
    const n = this.def.slots || 10;
    for (let i = 0; i < n + 6; i++) { const a = (i / (n + 6)) * TAU; pts.push({ x: this.x + Math.cos(a) * r * 1.2, z: this.z + Math.sin(a) * r * 1.2 }); }
    this.slots = pts.filter((p) => nav.freeW(p.x, p.z)).slice(0, n);
    this.slotOcc = new Array(this.slots.length).fill(0);
  }
  gatherers() { let c = 0; if (this.slotOcc) for (const o of this.slotOcc) if (o) c++; return c; }
  popProvided() { return this.built && this.alive ? (this.def.pop || 0) : 0; }

  update(dt) {
    const g = this.game, p = this.player;
    if (!this.alive) { this.deathT += dt; return; }
    if (!this.built) {
      if (this.selfBuild) this.addProgress(dt / (this.def.time * 0.6));
      return;
    }
    // production queue
    const q = this.queue[0];
    if (q) {
      if (q.kind === 'unit') {
        const def = UNITS[q.key];
        if (!q.started) {
          if (p.popUsed() + def.pop * q.count <= p.popCap() || def.pop === 0) { q.started = true; q.reserved = def.pop * q.count; }
          else q.blocked = true;
        }
        if (q.started) {
          q.blocked = false;
          q.t += dt * p.trainSpeed(def);
          if (q.t >= q.total) {
            this.queue.shift();
            for (let i = 0; i < q.count; i++) this.spawnUnit(q.key);
            g.emit('trained', this, q.key);
          }
        }
      } else if (q.kind === 'tech') {
        q.t += dt;
        if (q.t >= q.total) { this.queue.shift(); p.researching.delete(q.key); p.applyTech(q.key); g.emit('researched', p, q.key); }
      }
    }
    // shooting
    const atk = this.def.attack;
    if (atk) {
      this.attackT -= dt;
      if (this.attackT <= 0) {
        this.attackT = atk.rof;
        const shots = (atk.shots || 1) + Math.floor(this.garrison.length / 5);
        const tgts = g.findTargets(this, atk.range + this.size / 2, shots);
        let k = 0;
        for (const t of tgts) {
          const dmg = atk.dmg * (this.key === 'tc' ? p.mods.tcAtk : 1) * (this.key === 'tower' || this.key === 'outpost' ? p.mods.towerAtk : 1);
          g.buildingShot(this, t, dmg, k++);
        }
      }
    }
    // damage fx handled by renderer
  }
  addProgress(v) {
    if (this.built) return;
    const before = this.progress;
    this.progress = Math.min(1, this.progress + v);
    this.hp = Math.min(this.maxHp, this.hp + (this.progress - before) * this.maxHp * 0.9);
    if (this.progress >= 1) this.game.completeBuilding(this);
  }
  spawnUnit(key) {
    const g = this.game;
    const rp = this.rally;
    const tx = rp ? rp.x : this.x + 2, tz = rp ? rp.z : this.z + this.size;
    const pos = g.spawnPointNear(this, tx, tz);
    const u = g.addUnit(key, this.owner, pos.x, pos.z);
    u.heading = Math.atan2(tx - pos.x, tz - pos.z);
    if (rp) {
      if (rp.target && rp.target.alive && u.def.gather && (rp.target.kind === 'res' || (rp.target.kind === 'building' && rp.target.def.gather))) u.cmdGather(rp.target);
      else u.cmdMove(rp.x, rp.z);
    } else if (u.def.gather && this.player.isHuman && g.autoWork) {
      // new settlers without a rally point look for the nearest work
      const r = g.findNearestResource(['crate', 'bush', 'carcass'], this.x, this.z, 34, null, this.owner)
        || g.findGatherBuilding(this.owner, 'mill', this.x, this.z)
        || g.findNearestResource(['hunt'], this.x, this.z, 45, null, this.owner)
        || g.findNearestResource(['tree'], this.x, this.z, 75, null, this.owner);
      if (r) u.cmdGather(r);
    }
    return u;
  }
}

class Unit {
  constructor(game, key, owner, x, z) {
    const def = UNITS[key];
    this.game = game; this.id = game.nextId++; this.kind = 'unit'; this.key = key; this.def = def; this.owner = owner;
    this.player = owner >= 0 ? game.players[owner] : null;
    this.x = x; this.z = z; this.px = x; this.pz = z;
    this.heading = game.rng.range(0, TAU); this.ph = this.heading;
    this.maxHp = this.player ? this.player.unitHp(def) : def.hp; this.hp = this.maxHp;
    this.alive = true; this.deathT = 0; this.ko = false; this.koT = 0;
    this.order = null;
    this.path = null; this.pi = 0; this.goalKey = null; this.goalT = 0; this.stuckT = 0; this.repaths = 0;
    this.cool = game.rng.range(0, 0.5); this.anim = ANIM.IDLE; this.animT = 0; this.walkPh = 0; this.rnd = game.rng.next() * 0.9;
    this.moving = false; this.scanT = game.rng.range(0, 0.5); this.selected = false;
    this.slot = null; this.lastHitT = -99; this.gatherSoundT = game.rng.range(0, 1);
    this.garrisoned = null; this.idleT = 0; this.wanderT = game.rng.range(2, 8);
    this.stride = def.tags.has('cavalry') ? 2.1 : def.tags.has('animal') ? 3.2 : def.tags.has('artillery') || def.tags.has('wagon') || def.tags.has('trade') ? 1.0 / 0.55 : 3.9;
  }
  get isMilitary() { const t = this.def.tags; return !t.has('villager') && !t.has('animal') && !t.has('wagon') && !t.has('trade'); }
  get canFight() { return !!(this.def.ranged || this.def.melee) && !this.def.tags.has('huntable'); }
  get name() { return this.def.name; }
  speed() {
    const d = this.def;
    let s = d.speed;
    if (this.player) s *= this.player.speedMul(d);
    return s;
  }
  setAnim(a, reset) { if (this.anim !== a || reset) { this.anim = a; this.animT = 0; } }
  faceDir(dx, dz, dt, rate = 10) {
    if (dx * dx + dz * dz < 1e-6) return;
    const target = Math.atan2(dx, dz);
    this.heading = angleLerp(this.heading, target, Math.min(1, dt * rate));
  }
  releaseSlot() {
    if (this.slot) { const s = this.slot; if (s.res.slotOcc && s.res.slotOcc[s.i] === this.id) s.res.slotOcc[s.i] = 0; this.slot = null; }
  }
  clearOrder() { this.releaseSlot(); this.order = null; this.path = null; this.goalKey = null; this.home = null; }

  // ---------------------------------------------------------------- commands
  cmdMove(x, z, attackMove = false) {
    this.clearOrder();
    this.order = { type: 'move', x, z, attackMove };
  }
  cmdAttack(t, auto) {
    if (!t || !t.alive || t === this) return;
    this.clearOrder();
    this.order = { type: 'attack', target: t, auto: !!auto };
    if (auto) this.home = { x: this.x, z: this.z };
  }
  cmdGather(t) {
    if (!this.def.gather) return this.cmdMove(t.x, t.z);
    this.clearOrder();
    const kind = t.kind === 'building' ? t.key : (t.kind === 'unit' ? 'hunt' : t.rkind);
    this.order = { type: 'gather', target: t, rk: kind };
  }
  cmdBuild(b) {
    const prev = this.order && this.order.type === 'gather' ? this.order : (this.order && this.order.type === 'build' && this.order.resume ? this.order.resume : null);
    this.clearOrder(); this.order = { type: 'build', target: b, resume: prev };
  }
  cmdRepair(b) { this.clearOrder(); this.order = { type: 'build', target: b, repair: true }; }
  cmdTreasure(t) { this.clearOrder(); this.order = { type: 'treasure', target: t }; }
  cmdGarrison(b) { this.clearOrder(); this.order = { type: 'garrison', target: b }; }
  cmdDeploy(key, cx0, cz0) { this.clearOrder(); this.order = { type: 'deploy', key, cx0, cz0 }; }
  cmdStop() { this.clearOrder(); this.setAnim(ANIM.IDLE); }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (!this.alive) { this.deathT += dt; return; }
    if (this.garrisoned) return;
    this.px = this.x; this.pz = this.z; this.ph = this.heading;
    this.animT += dt;
    if (this.ko) { this.updateKO(dt); return; }
    if (this.cool > 0) this.cool -= dt;
    this.moving = false;
    const o = this.order;
    if (!o) this.updateIdle(dt);
    else {
      this.idleT = 0;
      switch (o.type) {
        case 'move': this.updMove(dt, o); break;
        case 'attack': this.updAttack(dt, o); break;
        case 'gather': this.updGather(dt, o); break;
        case 'build': this.updBuild(dt, o); break;
        case 'treasure': this.updTreasure(dt, o); break;
        case 'garrison': this.updGarrison(dt, o); break;
        case 'deploy': this.updDeploy(dt, o); break;
        case 'flee': this.updFlee(dt, o); break;
        default: this.order = null;
      }
    }
    if (!this.moving && this.anim === ANIM.MOVE) this.setAnim(ANIM.IDLE);
    // regeneration
    if (this.player && this.player.mods.regen && !this.order && this.hp < this.maxHp && this.isMilitary && this.game.time - this.lastHitT > 6) this.hp = Math.min(this.maxHp, this.hp + this.player.mods.regen * dt);
    if (this.def.tags.has('guardian') && !this.order && this.hp < this.maxHp && this.game.time - this.lastHitT > 8) this.hp = Math.min(this.maxHp, this.hp + 4 * dt);
  }

  // movement toward a goal; returns true when arrived
  goTo(goal, dt) {
    const g = this.game;
    if (this.goalKey !== goal.key || (!this.path && !this.waitPath)) {
      this.goalKey = goal.key;
      this.path = null;
      this.waitPath = true;
    }
    if (this.waitPath) {
      if (!g.takePathBudget()) return false;
      const rect = goal.rect || { x0: Math.floor(goal.x / CELL), z0: Math.floor(goal.z / CELL), x1: Math.floor(goal.x / CELL), z1: Math.floor(goal.z / CELL) };
      let gr = rect, wx = goal.rect ? undefined : goal.x, wz = goal.rect ? undefined : goal.z;
      if (!goal.rect) {
        const cx = rect.x0, cz = rect.z0;
        if (!g.nav.free(cx, cz)) {
          const nf = g.nav.nearestFreeToward(cx, cz, this.x, this.z, 14);
          if (nf) { gr = { x0: nf.cx, z0: nf.cz, x1: nf.cx, z1: nf.cz }; wx = (nf.cx + 0.5) * CELL; wz = (nf.cz + 0.5) * CELL; }
        }
      }
      const res = g.nav.findPath(this.x, this.z, Object.assign({}, gr, { range: goal.range || 0 }), 26000, wx, wz);
      g.pathNodes += g.nav.lastExpanded || 0;
      this.waitPath = false;
      this.path = res ? res.pts : [];
      this.pathFound = res ? res.found : false;
      this.pi = 0; this.stuckT = 0; this.lastProgX = this.x; this.lastProgZ = this.z;
    }
    if (!this.path) return false;
    if (this.pi >= this.path.length) return true;
    const spd = this.speed();
    let rem = spd * dt, moved = 0;
    while (rem > 1e-4 && this.pi < this.path.length) {
      const p = this.path[this.pi];
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.05) { this.pi++; continue; }
      const step = Math.min(d, rem);
      const nx = this.x + (dx / d) * step, nz = this.z + (dz / d) * step;
      if (!g.nav.freeW(nx, nz) && g.nav.freeW(this.x, this.z)) { this.stuckT += dt * 3; break; }
      this.x = nx; this.z = nz; rem -= step; moved += step;
      this.faceDir(dx, dz, dt, 12);
      if (step >= d - 1e-4) this.pi++;
    }
    if (moved > 0) { this.moving = true; this.walkPh += moved * this.stride; this.setAnim(ANIM.MOVE); }
    // stuck detection
    this.stuckT += dt;
    if (dist2(this.x, this.z, this.lastProgX, this.lastProgZ) > 0.64) { this.stuckT = 0; this.lastProgX = this.x; this.lastProgZ = this.z; }
    if (this.stuckT > 1.6) {
      this.stuckT = 0; this.repaths++;
      this.goalKey = null; this.path = null;
      if (this.repaths > 4) { this.repaths = 0; return true; }
      return false;
    }
    return this.pi >= this.path.length;
  }
  stopMove() { this.path = null; this.goalKey = null; }

  updMove(dt, o) {
    if (o.attackMove && this.canFight) {
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.45;
        const t = this.game.acquireTarget(this, this.def.los, true);
        if (t) { const resume = o; this.cmdAttack(t); this.order.resume = resume; return; }
      }
    }
    const arrived = this.goTo({ key: 'm' + (o.x | 0) + ',' + (o.z | 0), x: o.x, z: o.z }, dt);
    if (arrived) { this.order = null; this.path = null; this.repaths = 0; if (o.then) o.then(this); }
  }

  updateIdle(dt) {
    this.idleT += dt;
    const g = this.game, t = this.def.tags;
    if (t.has('huntable')) {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = g.rng.range(5, 14);
        const hx = this.herdX !== undefined ? this.herdX : this.x, hz = this.herdZ !== undefined ? this.herdZ : this.z;
        const a = g.rng.range(0, TAU), r = g.rng.range(1, 6);
        const tx = clamp(hx + Math.cos(a) * r, 4, g.size - 4), tz = clamp(hz + Math.sin(a) * r, 4, g.size - 4);
        if (g.nav.freeW(tx, tz)) this.order = { type: 'flee', x: tx, z: tz, t: 6, walk: true };
      }
      return;
    }
    if (t.has('guardian')) {
      if (this.homeX !== undefined && dist2(this.x, this.z, this.homeX, this.homeZ) > 9) { this.order = { type: 'move', x: this.homeX, z: this.homeZ }; return; }
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.5;
        const tg = g.acquireTarget(this, 10, false);
        if (tg) { this.cmdAttack(tg, true); this.home = { x: this.homeX !== undefined ? this.homeX : this.x, z: this.homeZ !== undefined ? this.homeZ : this.z }; }
      }
      return;
    }
    if (this.canFight && !t.has('villager')) {
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.5;
        const tg = g.acquireTarget(this, this.def.los, false);
        if (tg) this.cmdAttack(tg, true);
      }
    }
  }

  attackMode(t) {
    const d = this.def;
    if (t.kind === 'building') {
      if (d.ranged && (d.ranged.buildingsOnly || d.ranged.proj === 'cannon' || d.ranged.proj === 'grenade' || d.ranged.proj === 'mortar')) return 'ranged';
      if (d.siege) return 'siege';
      if (d.ranged) return 'ranged';
      return d.melee ? 'melee' : null;
    }
    if (d.ranged && !d.ranged.buildingsOnly) {
      if (d.melee && t.kind === 'unit' && dist(this.x, this.z, t.x, t.z) < 2.6 + t.def.radius && (t.def.melee && !t.def.ranged || t.def.tags.has('cavalry'))) return 'melee';
      return 'ranged';
    }
    if (d.melee) return 'melee';
    return null;
  }
  rangeFor(mode) {
    const d = this.def;
    if (mode === 'ranged') return d.ranged.range + (this.player ? this.player.rangeAdd(d) : 0);
    if (mode === 'siege') return 1.6;
    return d.melee ? d.melee.range : 1.5;
  }
  distTo(t) {
    if (t.kind === 'building') return t.edgeDist(this.x, this.z);
    if (t.kind === 'res') return t.edgeDist(this.x, this.z);
    return Math.max(0, dist(this.x, this.z, t.x, t.z) - (t.def.radius || 0.5) * 0.6);
  }
  updAttack(dt, o) {
    const g = this.game, t = o.target;
    if (!g.validTarget(this, t)) {
      const resume = o.resume, home = this.home;
      this.clearOrder();
      if (resume) { this.order = resume; return; }
      if (this.canFight && !this.def.tags.has('villager')) {
        const nt = g.acquireTarget(this, this.def.los, false);
        if (nt) { this.cmdAttack(nt, o.auto); if (o.auto && home) this.home = home; return; }
        if (o.auto && home && dist2(this.x, this.z, home.x, home.z) > 16 && !this.def.tags.has('guardian')) { this.order = { type: 'move', x: home.x, z: home.z }; return; }
      }
      if (this.def.tags.has('guardian') && this.homeX !== undefined) this.order = { type: 'move', x: this.homeX, z: this.homeZ };
      return;
    }
    const mode = this.attackMode(t);
    if (!mode) { this.clearOrder(); return; }
    const range = this.rangeFor(mode);
    const d = this.distTo(t);
    if (d <= range) {
      this.stopMove();
      const minR = mode === 'ranged' && this.def.ranged.minRange;
      if (minR && d < minR) {
        // too close (mortar): step back
        const a = Math.atan2(this.x - t.x, this.z - t.z);
        this.order = { type: 'flee', x: this.x + Math.sin(a) * 6, z: this.z + Math.cos(a) * 6, t: 2.5, then: o };
        return;
      }
      this.faceDir(t.x - this.x, t.z - this.z, dt, 9);
      const ad = Math.abs(angleDiff(this.heading, Math.atan2(t.x - this.x, t.z - this.z)));
      const anim = mode === 'ranged' ? ANIM_OF[this.def.ranged.anim] : mode === 'siege' ? ANIM.SWORD : ANIM_OF[(this.def.melee || {}).anim] || ANIM.SWORD;
      if (this.anim !== anim) this.setAnim(anim);
      if (this.cool <= 0 && ad < 0.5) this.doAttack(t, mode);
    } else {
      // leash for auto-acquired targets
      if (o.auto && this.home && dist(this.x, this.z, this.home.x, this.home.z) > (this.def.tags.has('guardian') ? 18 : 26)) {
        const h = this.home;
        this.clearOrder();
        this.order = { type: 'move', x: h.x, z: h.z };
        return;
      }
      const moved = t.kind === 'unit' ? Math.floor(t.x / 3) + ',' + Math.floor(t.z / 3) : 'b';
      const rangeCells = Math.max(0, (range - 0.3) / CELL) + (t.kind === 'unit' ? 0.5 : 0.7);
      let rect;
      if (t.kind === 'unit') { const cx = Math.floor(t.x / CELL), cz = Math.floor(t.z / CELL); rect = { x0: cx, z0: cz, x1: cx, z1: cz }; }
      else rect = t.rect();
      this.goTo({ key: 'a' + t.id + ':' + moved, rect, range: rangeCells }, dt);
      if (this.path && this.pi >= this.path.length && !this.moving) {
        // reached end of path but not in range: target unreachable, nudge directly
        const dx = t.x - this.x, dz = t.z - this.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = this.x + (dx / l) * this.speed() * dt, nz = this.z + (dz / l) * this.speed() * dt;
        if (g.nav.freeW(nx, nz)) { this.x = nx; this.z = nz; this.moving = true; this.walkPh += this.speed() * dt * this.stride; this.setAnim(ANIM.MOVE); this.faceDir(dx, dz, dt); }
        else { this.goalKey = null; this.path = null; o.fails = (o.fails || 0) + 1; if (o.fails > 6) this.clearOrder(); }
      }
    }
  }
  doAttack(t, mode) {
    const g = this.game, d = this.def;
    const mul = this.player ? this.player.dmgMul(d) : 1;
    if (mode === 'ranged') {
      const r = d.ranged;
      this.cool = r.rof * (0.9 + g.rng.next() * 0.2);
      this.setAnim(ANIM_OF[r.anim] || ANIM.GUN, true);
      g.rangedAttack(this, t, r, r.dmg * mul);
    } else if (mode === 'siege') {
      this.cool = 3;
      this.setAnim(ANIM.SWORD, true);
      g.damage(t, d.siege * mul, this, 'siege');
      g.fxTorch(this, t);
    } else {
      const m = d.melee;
      this.cool = m.rof * (0.9 + g.rng.next() * 0.2);
      const a = ANIM_OF[m.anim] || ANIM.SWORD;
      this.setAnim(a, this.anim !== a);
      if (m.splash) {
        const hits = g.unitsInRadius(t.x, t.z, m.splash, (u) => g.hostile(this, u));
        for (const u of hits) g.damage(u, m.dmg * mul * (u === t ? 1 : 0.5), this, 'melee');
      } else g.damage(t, m.dmg * mul, this, 'melee');
      g.fxMelee(this, t);
    }
  }

  // ---------------------------------------------------------------- gathering
  updGather(dt, o) {
    const g = this.game;
    let t = o.target;
    // hunting a live animal
    if (t.kind === 'unit') {
      if (!t.alive) {
        if (t.carcass && t.carcass.alive) { o.target = t.carcass; return; }
        return this.findNextResource(o);
      }
      const d = dist(this.x, this.z, t.x, t.z);
      if (d <= 9) {
        this.stopMove();
        this.faceDir(t.x - this.x, t.z - this.z, dt, 10);
        if (this.anim !== ANIM.GUN) this.setAnim(ANIM.GUN);
        if (this.cool <= 0) {
          this.cool = 1.4;
          this.setAnim(ANIM.GUN, true);
          g.damage(t, 26, this, 'ranged');
          g.fxMusket(this, t, true);
        }
      } else {
        this.goTo({ key: 'h' + t.id + ':' + Math.floor(t.x / 4) + ',' + Math.floor(t.z / 4), x: t.x, z: t.z }, dt);
      }
      return;
    }
    const isBld = t.kind === 'building';
    if (!t.alive || (!isBld && t.amount <= 0) || (isBld && (!t.built || t.owner !== this.owner))) {
      if (isBld && t.alive && !t.built && t.owner === this.owner) { this.cmdBuild(t); return; }
      return this.findNextResource(o);
    }
    // claim a slot
    if (!this.slot || this.slot.res !== t) {
      this.releaseSlot();
      if (t.rkind === 'tree') {
        const sp = g.treeSpot(t, this.x, this.z);
        if (!sp) return this.findNextResource(o, true);
        this.slot = { res: t, i: -1, x: sp.x, z: sp.z };
      } else {
        t.ensureSlots();
        let best = -1, bd = 1e9;
        for (let i = 0; i < t.slots.length; i++) {
          if (t.slotOcc[i] && t.slotOcc[i] !== this.id) continue;
          const d = dist2(this.x, this.z, t.slots[i].x, t.slots[i].z);
          if (d < bd) { bd = d; best = i; }
        }
        if (best < 0) {
          // full: look for an alternative of same kind
          return this.findNextResource(o, true);
        }
        t.slotOcc[best] = this.id;
        this.slot = { res: t, i: best, x: t.slots[best].x, z: t.slots[best].z };
      }
    }
    const s = this.slot;
    const dSlot = dist(this.x, this.z, s.x, s.z);
    const reach = t.edgeDist(this.x, this.z) <= GATHER_RANGE + (isBld ? 1.6 : 0.2);
    if (dSlot > 0.45 && !(reach && dSlot < 1.6)) {
      const arrived = this.goTo({ key: 'g' + t.id + ':' + (s.x | 0) + ',' + (s.z | 0), x: s.x, z: s.z }, dt);
      if (!arrived) return;
      if (t.edgeDist(this.x, this.z) > GATHER_RANGE + (isBld ? 2.2 : 0.6)) {
        // could not get close: drop this one
        this.releaseSlot();
        o.badTries = (o.badTries || 0) + 1;
        if (o.badTries > 2) return this.findNextResource(o, true);
        return;
      }
    }
    this.stopMove();
    // work
    const p = this.player;
    this.faceDir(t.x - this.x, t.z - this.z, dt, 8);
    const rateKey = isBld ? t.def.rateKey : t.rateKey;
    const resType = isBld ? t.def.gather : t.res;
    const animK = rateKey === 'wood' || rateKey === 'mine' || rateKey === 'quarry' ? ANIM.WORK : ANIM.GATHER;
    if (this.anim !== animK) this.setAnim(animK);
    let amt = GATHER[rateKey] * p.gatherMul(rateKey) * dt;
    if (!isBld) {
      amt = Math.min(amt, t.amount);
      t.amount -= amt;
      if (t.rkind === 'tree' && !t.felled) { t.felled = true; g.onTreeFelled(t, this); }
    }
    p.gain(resType, amt);
    this.gatherSoundT -= dt;
    if (this.gatherSoundT <= 0) {
      this.gatherSoundT = rateKey === 'wood' || rateKey === 'mine' || rateKey === 'quarry' ? 1.11 : 2.4;
      g.fxGather(this, rateKey);
    }
    if (!isBld && t.amount <= 0.001) {
      g.depleteResource(t);
      this.findNextResource(o);
    }
  }
  findNextResource(o, skipCurrent) {
    const g = this.game;
    const cur = o.target;
    this.releaseSlot();
    const rk = o.rk;
    let next = null;
    if (rk === 'mill' || rk === 'plantation') {
      next = g.findGatherBuilding(this.owner, rk, this.x, this.z, cur);
    } else {
      const kinds = rk === 'hunt' || rk === 'carcass' ? ['carcass', 'hunt'] : rk === 'crate' ? ['crate'] : [rk];
      next = g.findNearestResource(kinds, this.x, this.z, 26, skipCurrent ? cur : null, this.owner);
      // starting crates used up: carry on with the nearest berries / game, then timber
      if (!next && rk === 'crate') next = g.findNearestResource(['bush', 'carcass'], this.x, this.z, 32, null, this.owner) || g.findNearestResource(['tree'], this.x, this.z, 40, null, this.owner);
    }
    if (next) { o.target = next; o.rk = next.kind === 'unit' ? 'hunt' : next.kind === 'building' ? next.key : next.rkind; o.badTries = 0; this.path = null; this.goalKey = null; }
    else { this.clearOrder(); this.setAnim(ANIM.IDLE); }
  }

  // ---------------------------------------------------------------- building
  updBuild(dt, o) {
    const g = this.game, b = o.target;
    if (!b.alive || b.owner !== this.owner) { this.clearOrder(); return; }
    if (b.built) {
      if (b.hp < b.maxHp && o.repair) { /* fallthrough to repair */ }
      else {
        // auto-continue
        if (b.def.gather && this.def.gather) { this.cmdGather(b); return; }
        const nb0 = g.findUnfinished(this.owner, this.x, this.z, 14);
        if (nb0) { o.target = nb0; this.path = null; this.goalKey = null; return; }
        if (o.resume && o.resume.target && o.resume.target.alive && !(o.resume.target.kind === 'res' && o.resume.target.amount <= 0)) { const r = o.resume; this.clearOrder(); this.order = r; return; }
        const nb = g.findUnfinished(this.owner, this.x, this.z, 30);
        if (nb) { o.target = nb; this.path = null; this.goalKey = null; return; }
        if (b.def.trade || b.key === 'house' || b.key === 'tc' || b.key === 'outpost' || b.key === 'tradingPost' || b.key === 'market') {
          const r = g.findNearestResource(['crate', 'bush', 'carcass', 'tree', 'mine', 'quarry'], this.x, this.z, 18, null, this.owner);
          if (r && b.key === 'tc') { this.cmdGather(r); return; }
        }
        this.clearOrder(); return;
      }
    }
    const d = b.edgeDist(this.x, this.z);
    if (d > 1.6) {
      this.goTo({ key: 'b' + b.id, rect: b.rect(), range: 1.0 }, dt);
      if (this.path && this.pi >= this.path.length && b.edgeDist(this.x, this.z) > 2.4) { o.fails = (o.fails || 0) + 1; this.path = null; this.goalKey = null; if (o.fails > 5) this.clearOrder(); }
      return;
    }
    this.stopMove();
    this.faceDir(b.x - this.x, b.z - this.z, dt, 8);
    if (this.anim !== ANIM.WORK) this.setAnim(ANIM.WORK);
    if (!b.built) {
      b.addProgress(dt / b.def.time);
    } else {
      // repair: costs a little wood
      const p = this.player;
      const heal = (b.maxHp / b.def.time) * 0.5 * dt;
      const cost = heal * 0.04;
      if (p.res.wood >= cost) { p.res.wood -= cost; b.hp = Math.min(b.maxHp, b.hp + heal); }
      if (b.hp >= b.maxHp) this.clearOrder();
    }
    this.gatherSoundT -= dt;
    if (this.gatherSoundT <= 0) { this.gatherSoundT = 1.11; g.fxBuild(this, b); }
  }
  updTreasure(dt, o) {
    const g = this.game, t = o.target;
    if (!t.alive) { this.clearOrder(); return; }
    if (dist(this.x, this.z, t.x, t.z) > 2.4) {
      this.goTo({ key: 't' + t.id, x: t.x, z: t.z }, dt);
      if (this.path && this.pi >= this.path.length && dist(this.x, this.z, t.x, t.z) > 3.5) {
        o.fails = (o.fails || 0) + 1; this.path = null; this.goalKey = null;
        if (o.fails > 3 || this.pathFound === false && o.fails > 1) { (t.noPath || (t.noPath = {}))[this.owner] = g.time; this.clearOrder(); }
      }
      return;
    }
    this.stopMove();
    if (g.treasureGuarded(t)) {
      // fight guardians first
      const gd = t.guards.find((u) => u.alive);
      if (gd && this.canFight) { const resume = o; this.cmdAttack(gd); this.order.resume = resume; }
      return;
    }
    g.collectTreasure(t, this);
    this.clearOrder();
  }
  updGarrison(dt, o) {
    const g = this.game, b = o.target;
    if (!b.alive || !b.built || b.owner !== this.owner) { this.clearOrder(); return; }
    if (b.edgeDist(this.x, this.z) > 1.6) { this.goTo({ key: 'gr' + b.id, rect: b.rect(), range: 1.0 }, dt); return; }
    g.garrisonUnit(this, b);
  }
  updDeploy(dt, o) {
    const g = this.game, def = BUILDINGS[o.key];
    const cx = (o.cx0 + def.cells / 2) * CELL, cz = (o.cz0 + def.cells / 2) * CELL;
    const half = def.size / 2;
    const d = Math.max(0, Math.max(Math.abs(this.x - cx), Math.abs(this.z - cz)) - half);
    if (d > 2.5) { this.goTo({ key: 'd' + o.cx0 + ',' + o.cz0, rect: { x0: o.cx0, z0: o.cz0, x1: o.cx0 + def.cells - 1, z1: o.cz0 + def.cells - 1 }, range: 1.0 }, dt); return; }
    this.stopMove();
    if (!g.canPlace(o.key, o.cx0, o.cz0, this.owner, this)) { g.emit('message', this.owner, 'Место для постройки занято'); this.clearOrder(); return; }
    const b = g.placeBuilding(o.key, this.owner, o.cx0, o.cz0, { free: true });
    if (b) { b.selfBuild = true; g.removeUnit(this); }
  }
  updFlee(dt, o) {
    o.t -= dt;
    const arrived = this.goTo({ key: 'f' + (o.x | 0) + ',' + (o.z | 0), x: o.x, z: o.z }, o.walk ? dt * (this.def.walk || 1.5) / this.def.speed : dt);
    if (arrived || o.t <= 0) { this.clearOrder(); if (o.then && o.then.target && o.then.target.alive) this.order = o.then; }
  }
  updateKO(dt) {
    this.koT += dt;
    this.setAnim(ANIM.DEAD);
    if (this.koT > 150) this.game.reviveExplorer(this);
  }
}
