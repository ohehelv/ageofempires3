// ---------------------------------------------------------------------------
// 13_render_sync.js — per-frame sync of game state to the GPU + FX events
// ---------------------------------------------------------------------------
const GAIA_TEAM = new THREE.Color(0x4a3a2e).convertSRGBToLinear();
const UNIT_SCALE = 1.32;
const DUST = [0.66, 0.58, 0.46];
const _m = new THREE.Matrix4(), _q2 = new THREE.Quaternion(), _e2 = new THREE.Euler(), _p2 = new THREE.Vector3(), _s2 = new THREE.Vector3();
const _c2 = new THREE.Color();

const FX = {
  active: false, game: null, smoke: null, fire: null, tracers: null, delayed: [],
  event(kind, x, z, d) {
    const g = this.game; if (!g) return;
    const y0 = g.heightAt(x, z);
    switch (kind) {
      case 'musket': {
        if (d.delay) { this.delayed.push({ t: d.delay, kind, x, z, d: Object.assign({}, d, { delay: 0 }) }); return; }
        const m = d.m, a = d.a;
        this.fire.emit(m.x, m.y, m.z, 0, 0.3, 0, 0.09, 0.9, 1.6, 1.0, 0.75, 0.35, 0.95);
        const n = d.building ? 2 : 3;
        for (let i = 0; i < n; i++) this.smoke.emit(m.x + rnd(0.2), m.y + rnd(0.1), m.z + rnd(0.2), Math.sin(d.heading || 0) * (1.2 + i * 0.5) + rnd(0.3), 0.35 + Math.random() * 0.4, Math.cos(d.heading || 0) * (1.2 + i * 0.5) + rnd(0.3), 2.6 + Math.random() * 1.2, 0.9, 3.2, 0.93, 0.92, 0.89, 0.85, 0.45, -0.06);
        this.tracers.add(m.x, m.y, m.z, a.x, a.y, a.z);
        Sfx.play(d.pistol ? 'pistol' : 'musket', x, z, d.hunting ? 0.5 : d.building ? 0.7 : 0.85);
        break;
      }
      case 'cannonFire': {
        const m = d.m;
        this.fire.emit(m.x, m.y, m.z, 0, 0.3, 0, 0.14, 1.6, 3.2, 1.0, 0.7, 0.3, 1);
        for (let i = 0; i < 6; i++) this.smoke.emit(m.x + rnd(0.4), m.y, m.z + rnd(0.4), Math.sin(d.heading) * 2 + rnd(0.8), 0.6 + Math.random() * 0.6, Math.cos(d.heading) * 2 + rnd(0.8), 3 + Math.random() * 1.5, 1.2, 4.2, 0.78, 0.76, 0.72, 0.6, 0.4, -0.05);
        Sfx.play('cannon', x, z, 1);
        break;
      }
      case 'bow': Sfx.play('bow', x, z, 0.7); break;
      case 'throw': Sfx.play('bow', x, z, 0.5); break;
      case 'explosion': {
        const y = Math.max(d.y || y0, y0 + 0.3), big = d.big;
        this.fire.emit(x, y + 0.5, z, 0, 1, 0, 0.25, big ? 3 : 2, big ? 6 : 4, 1, 0.6, 0.2, 1);
        for (let i = 0; i < (big ? 10 : 6); i++) this.fire.emit(x + rnd(0.6), y + 0.4, z + rnd(0.6), rnd(4), 3 + Math.random() * 4, rnd(4), 0.5 + Math.random() * 0.4, 0.4, 0.15, 1, 0.55, 0.15, 1, 0.5, 12);
        for (let i = 0; i < (big ? 9 : 5); i++) this.smoke.emit(x + rnd(1), y + 0.6, z + rnd(1), rnd(1.2), 1 + Math.random() * 1.5, rnd(1.2), 3 + Math.random() * 2, 1.5, 5.5, 0.33, 0.3, 0.27, 0.75, 0.5, -0.1);
        for (let i = 0; i < 8; i++) this.smoke.emit(x, y + 0.3, z, rnd(5), 4 + Math.random() * 4, rnd(5), 0.9, 0.35, 0.2, 0.28, 0.22, 0.16, 1, 0.6, 14);
        Sfx.play('explosion', x, z, big ? 1 : 0.7);
        break;
      }
      case 'melee': {
        const a = d.a;
        for (let i = 0; i < 3; i++) this.fire.emit(a.x, a.y, a.z, rnd(2), Math.random() * 2, rnd(2), 0.18, 0.18, 0.05, 1, 0.9, 0.6, 0.9, 0.5, 6);
        Sfx.play('sword', x, z, 0.6);
        break;
      }
      case 'bite': this.smoke.emit(x, y0 + 0.3, z, rnd(0.5), 0.4, rnd(0.5), 0.7, 0.6, 1.2, 0.55, 0.48, 0.38, 0.35, 0.6, 0); break;
      case 'torch': {
        const a = d.a;
        for (let i = 0; i < 6; i++) this.fire.emit(a.x + rnd(0.6), a.y + rnd(0.4), a.z + rnd(0.6), rnd(0.5), 1.5 + Math.random(), rnd(0.5), 0.6 + Math.random() * 0.4, 0.7, 0.2, 1, 0.5, 0.15, 0.9, 0.7, -1);
        this.smoke.emit(a.x, a.y + 0.5, a.z, rnd(0.3), 1, rnd(0.3), 2, 0.8, 2.4, 0.2, 0.18, 0.16, 0.5, 0.6, -0.1);
        Sfx.play('hammer', x, z, 0.4);
        break;
      }
      case 'gather': {
        const k = d.k, u = d.u;
        const fx = u.x + Math.sin(u.heading) * 0.9, fz = u.z + Math.cos(u.heading) * 0.9, fy = y0 + 0.7;
        if (k === 'wood') { Sfx.play('chop', x, z, 0.55); for (let i = 0; i < 3; i++) this.smoke.emit(fx, fy, fz, rnd(1.5), 1.5 + Math.random(), rnd(1.5), 0.6, 0.12, 0.1, 0.78, 0.62, 0.4, 1, 0.5, 9); }
        else if (k === 'mine') { Sfx.play('mine', x, z, 0.5); for (let i = 0; i < 3; i++) this.fire.emit(fx, fy, fz, rnd(2), 1 + Math.random() * 2, rnd(2), 0.3, 0.1, 0.04, 1, 0.9, 0.5, 1, 0.5, 10); }
        else if (k === 'quarry') { Sfx.play('stone', x, z, 0.55); for (let i = 0; i < 4; i++) this.smoke.emit(fx, fy, fz, rnd(1.8), 1.2 + Math.random() * 1.5, rnd(1.8), 0.55, 0.13, 0.09, 0.82, 0.8, 0.74, 1, 0.5, 10); this.smoke.emit(fx, fy - 0.3, fz, rnd(0.3), 0.3, rnd(0.3), 1.4, 0.4, 1.4, 0.8, 0.78, 0.72, 0.35, 0.6, 0); }
        else Sfx.play('rustle', x, z, 0.35);
        break;
      }
      case 'hammer': Sfx.play('hammer', x, z, 0.5); this.smoke.emit(x + rnd(1), y0 + 0.2, z + rnd(1), rnd(0.4), 0.4, rnd(0.4), 1.2, 0.5, 1.6, 0.7, 0.64, 0.52, 0.35, 0.6, 0); break;
      default: break;
    }
  },
  update(dt) {
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const e = this.delayed[i]; e.t -= dt;
      if (e.t <= 0) { this.delayed.splice(i, 1); this.event(e.kind, e.x, e.z, e.d); }
    }
  },
};
function rnd(a) { return (Math.random() * 2 - 1) * a; }

const RS = {
  game: null, units: null, viewBox: { x0: 0, z0: 0, x1: 0, z1: 0 }, screenUnits: [], markers: [],
  init(game) {
    this.game = game;
    const sc = GFX.scene;
    this.units = new UnitInstancer(sc);
    FX.game = game; FX.active = true;
    FX.smoke = new Particles(sc, 5000, false, makeSpriteTexture('smoke'));
    FX.fire = new Particles(sc, 3000, true, makeSpriteTexture('soft'));
    FX.tracers = new Tracers(sc);
    // projectiles
    const ballGeo = new THREE.SphereGeometry(0.16, 8, 6);
    this.balls = new InstPool(sc, ballGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }), 200);
    const arrowGeo = new THREE.BoxGeometry(0.04, 0.04, 0.9);
    this.arrows = new InstPool(sc, arrowGeo, new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.8 }), 300);
    // rings
    const ringGeo = propGeo('ring');
    this.rings = new InstPool(sc, ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }), 400, { color: true, renderOrder: 3 });
    const thin = new THREE.RingGeometry(0.93, 1.0, 48); thin.rotateX(-PI / 2);
    this.bRings = new InstPool(sc, thin, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), 64, { color: true, renderOrder: 3 });
    this.markRings = new InstPool(sc, ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }), 16, { color: true, renderOrder: 3 });
    // trees, mines, bushes
    buildTrees(game.map, game.map.trees);
    this.mines = game.resources.filter((r) => r.rkind === 'mine');
    this.quarries = game.resources.filter((r) => r.rkind === 'quarry');
    this.bushes = game.resources.filter((r) => r.rkind === 'bush');
    const mk = (list, geo, rot) => {
      if (!list.length) return null;
      const mesh = new THREE.InstancedMesh(geo, modelMaterial('staticInst'), list.length);
      list.forEach((r, i) => {
        _e2.set(0, rot ? (r.x * 7.13 + r.z * 3.7) % TAU : 0, 0); _q2.setFromEuler(_e2);
        _p2.set(r.x, game.heightAt(r.x, r.z) - 0.05, r.z); _s2.set(1, 1, 1);
        _m.compose(_p2, _q2, _s2); mesh.setMatrixAt(i, _m);
        r.inst = { mesh, i };
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      sc.add(mesh); return mesh;
    };
    mk(this.mines, propGeo('mine'), true);
    mk(this.quarries, propGeo('quarry'), true);
    mk(this.bushes, propGeo('bush'), true);
    game.on('depleted', (r) => {
      if (r.inst) { _m.makeScale(0, 0, 0); r.inst.mesh.setMatrixAt(r.inst.i, _m); r.inst.mesh.instanceMatrix.needsUpdate = true; }
      if (r.mesh) { sc.remove(r.mesh); r.mesh = null; }
    });
    // crates
    for (const r of game.resources) {
      if (r.rkind !== 'crate') continue;
      const mesh = new THREE.Mesh(propGeo('crate_' + r.res), modelMaterial('static'));
      mesh.position.set(r.x, game.heightAt(r.x, r.z), r.z); mesh.rotation.y = r.x * 1.7;
      mesh.castShadow = true; sc.add(mesh); r.mesh = mesh;
    }
    // treasures
    for (const t of game.treasures) {
      const mesh = new THREE.Mesh(propGeo('treasure'), modelMaterial('static'));
      mesh.position.set(t.x, game.heightAt(t.x, t.z), t.z); mesh.rotation.y = t.rot;
      mesh.castShadow = true; mesh.receiveShadow = true; sc.add(mesh); t.mesh = mesh;
    }
    game.on('treasure', (p, t) => { if (t.mesh) { sc.remove(t.mesh); t.mesh = null; } for (let i = 0; i < 14; i++) FX.fire.emit(t.x + rnd(0.6), game.heightAt(t.x, t.z) + 0.8, t.z + rnd(0.6), rnd(1), 2 + Math.random() * 2, rnd(1), 1.0, 0.35, 0.1, 1, 0.85, 0.35, 1, 0.6, 2); });
    // trade route: sockets + posts
    for (const s of game.sockets) {
      const mesh = new THREE.Mesh(propGeo('socket'), modelMaterial('static'));
      mesh.position.set(s.x, game.heightAt(s.x, s.z), s.z);
      mesh.castShadow = true; sc.add(mesh); s.mesh = mesh;
    }
    const posts = [];
    const R = game.map.route;
    for (let sd = 6; sd < R.total - 6; sd += 15) {
      const p = game.routePos(sd), p2 = game.routePos(sd + 1);
      const dx = p2.x - p.x, dz = p2.z - p.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
      for (const side of [-1, 1]) {
        const x = p.x - (dz / l) * 3.1 * side, z = p.z + (dx / l) * 3.1 * side;
        if (!game.nav.freeW(x, z)) continue;
        posts.push({ x, y: game.heightAt(x, z), z, rot: Math.atan2(dx, dz) + (side > 0 ? PI : 0), s: 1 });
      }
    }
    if (posts.length) sc.add(chunkedInstances(posts, propGeo('routePost'), modelMaterial('staticInst'), { castShadow: true, height: 2 }).group);
    // rally flag
    this.flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x4b3624 }));
    pole.position.y = 1.2;
    this.flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    this.flagCloth.position.set(0.38, 2.05, 0);
    this.flag.add(pole); this.flag.add(this.flagCloth); this.flag.visible = false;
    sc.add(this.flag);
    // ghost for placement
    this.ghost = new THREE.Group(); this.ghost.visible = false; sc.add(this.ghost);
    this.ghostMatOk = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xa8ffb0, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.8 });
    this.ghostMatBad = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xff7a6a, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.8 });
    this.ghostPlate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.32, depthWrite: false }));
    this.ghostPlate.renderOrder = 4;
    sc.add(this.ghostPlate); this.ghostPlate.visible = false;
  },

  computeViewBox(cam) {
    // project screen corners to ground plane (y ~ camera target height)
    const g = this.game;
    const pts = [];
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      v.set(sx, sy);
      ray.setFromCamera(v, GFX.camera);
      const o = ray.ray.origin, d = ray.ray.direction;
      const t = d.y < -0.01 ? (o.y - cam.groundY) / -d.y : 600;
      pts.push({ x: o.x + d.x * Math.min(t, 600), z: o.z + d.z * Math.min(t, 600) });
    }
    this.viewPoly = pts;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    this.viewBox = { x0: x0 - 8, z0: z0 - 12, x1: x1 + 8, z1: z1 + 8 };
    void g;
  },
  inView(x, z) { const b = this.viewBox; return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1; },
  friendly(owner) { const g = this.game; return owner >= 0 && g.players[owner].team === g.players[g.viewer].team; },

  frame(dt, alpha, selection) {
    const g = this.game, cam = GFX.camera;
    U.uTime.value += dt;
    FX.update(dt);
    // units
    const UIi = this.units;
    UIi.begin();
    this.rings.begin();
    this.screenUnits.length = 0;
    const proj = new THREE.Vector3();
    const W = GFX.renderer.domElement.clientWidth, H = GFX.renderer.domElement.clientHeight;
    for (const u of g.units) {
      if (u.garrisoned || u.removed) continue;
      if (!u.alive && u.deathT > 13 && !(u.carcass && u.carcass.alive)) continue;
      const fr = this.friendly(u.owner);
      if (!g.revealAll && !fr && !g.isVisibleW(u.x, u.z)) continue;
      const x = lerp(u.px, u.x, alpha), z = lerp(u.pz, u.z, alpha);
      if (!this.inView(x, z)) continue;
      const h = angleLerp(u.ph, u.heading, alpha);
      let y = g.heightAt(x, z);
      const def = u.def;
      const deerClips = deerMotionClips(def.model);
      let anim = u.anim;
      _e2.set(0, h, 0, 'YXZ');
      if (!u.alive || u.ko) {
        if (!deerClips) {
          const t = Math.min(1, (u.ko ? u.koT : u.deathT) / 0.7);
          const fall = t * t * 1.5;
          const side = def.tags.has('cavalry') || def.tags.has('animal') || def.tags.has('wagon') || def.tags.has('artillery');
          if (side) _e2.set(0, h, fall * (def.tags.has('artillery') ? 0.25 : 1), 'YXZ');
          else _e2.set(-fall, h, 0, 'YXZ');
          if (side && !def.tags.has('artillery')) y += t * 0.15;
        }
        anim = ANIM.DEAD;
        let sinkT = u.deathT - 8;
        if (u.carcass && u.carcass.alive) sinkT = -1;
        if (!u.ko && sinkT > 0) y -= sinkT * 0.35;
      }
      _q2.setFromEuler(_e2);
      _p2.set(x, y, z); _s2.set(UNIT_SCALE, UNIT_SCALE, UNIT_SCALE);
      _m.compose(_p2, _q2, _s2);
      const team = u.owner >= 0 ? g.players[u.owner].colorLin : GAIA_TEAM;
      if (u.moving && dt > 0 && (def.tags.has('cavalry') || def.tags.has('wagon') || def.tags.has('artillery') || def.tags.has('trade') || def.key === 'bison') && Math.random() < dt * 6) {
        FX.smoke.emit(x - Math.sin(h) * 0.9 + rnd(0.4), y + 0.15, z - Math.cos(h) * 0.9 + rnd(0.4), rnd(0.3), 0.35, rnd(0.3), 1.3, 0.6, 1.9, DUST[0], DUST[1], DUST[2], 0.32, 0.6, 0);
      }
      const phase = deerClips ? deerMotionFrame(deerClips, u, alpha) : u.walkPh;
      UIi.push(def.model, _m, team, anim, u.animT, phase, u.rnd);
      // selection ring + screen position for picking
      if (u.alive && !u.ko) {
        proj.set(x, y + (def.height || 1.8) * 0.5 * UNIT_SCALE, z).project(cam);
        const sx = (proj.x * 0.5 + 0.5) * W, sy = (-proj.y * 0.5 + 0.5) * H;
        this.screenUnits.push({ u, sx, sy, depth: proj.z });
        if (u.selected) {
          _c2.copy(u.owner === g.viewer ? new THREE.Color(0xf4f1e4) : u.owner < 0 ? new THREE.Color(0xe8d48a) : g.players[u.owner].colorLin);
          const r = (def.radius * 1.55 + 0.2) * UNIT_SCALE;
          _m.makeScale(r, 1, r); _m.setPosition(x, y + 0.08, z);
          this.rings.push(_m, _c2);
        }
      }
    }
    UIi.end();
    // buildings
    this.syncBuildings(dt, selection);
    // projectiles
    this.balls.begin(); this.arrows.begin();
    for (const p of g.projectiles) {
      if (!g.revealAll && !g.isVisibleW(p.x, p.z)) continue;
      const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha), z = lerp(p.pz, p.z, alpha);
      if (p.type === 'arrow' || p.type === 'bolt') {
        const dx = p.x - p.px, dy = p.y - p.py, dz = p.z - p.pz;
        _e2.set(-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)), Math.atan2(dx, dz), 0, 'YXZ');
        _q2.setFromEuler(_e2); _p2.set(x, y, z); _s2.set(1, 1, 1); _m.compose(_p2, _q2, _s2);
        this.arrows.push(_m);
      } else {
        const s = p.type === 'mortar' ? 1.8 : p.type === 'grenade' ? 0.7 : 1;
        _m.makeScale(s, s, s); _m.setPosition(x, y, z);
        this.balls.push(_m);
        if (p.type === 'grenade' && Math.random() < 0.5) FX.fire.emit(x, y, z, 0, 0.2, 0, 0.25, 0.25, 0.05, 1, 0.7, 0.3, 1, 0.5, 0);
        if (p.type === 'mortar' && Math.random() < 0.5) FX.smoke.emit(x, y, z, 0, 0, 0, 0.8, 0.4, 0.9, 0.5, 0.5, 0.5, 0.4, 0.6, 0);
      }
    }
    this.balls.end(); this.arrows.end();
    // markers
    this.markRings.begin();
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const mk = this.markers[i]; mk.t += dt;
      if (mk.t > 0.6) { this.markers.splice(i, 1); continue; }
      const s = lerp(1.6, 0.4, mk.t / 0.6);
      _m.makeScale(s, 1, s); _m.setPosition(mk.x, g.heightAt(mk.x, mk.z) + 0.12, mk.z);
      this.markRings.push(_m, mk.color);
    }
    this.markRings.end();
    this.rings.end();
    FX.smoke.uScale.value = FX.fire.uScale.value = H / (2 * Math.tan((cam.fov * PI) / 360));
    FX.smoke.update(dt); FX.fire.update(dt); FX.tracers.update(dt);
    updateFallingTrees(dt);
    // ambient: treasure sparkle
    if (Math.random() < 0.15) {
      for (const t of g.treasures) if (t.alive && this.inView(t.x, t.z) && g.isVisibleW(t.x, t.z) && Math.random() < 0.3) FX.fire.emit(t.x + rnd(0.5), g.heightAt(t.x, t.z) + 0.7, t.z + rnd(0.5), 0, 0.6, 0, 0.7, 0.25, 0.05, 1, 0.9, 0.5, 1, 0.5, 0);
    }
  },
  addMarker(x, z, kind) {
    const col = kind === 'attack' ? new THREE.Color(0xff5a3c) : kind === 'gather' || kind === 'build' ? new THREE.Color(0xffd36a) : new THREE.Color(0x9cff9a);
    this.markers.push({ x, z, t: 0, color: col });
  },

  syncBuildings(dt, selection) {
    const g = this.game, sc = GFX.scene;
    for (const b of g.buildings) {
      let o = b.gfx;
      const fr = this.friendly(b.owner);
      const seen = g.revealAll || fr || g.isExploredW(b.x, b.z) || b.seen;
      if (!o) {
        if (!seen) continue;
        o = b.gfx = { group: new THREE.Group() };
        const geo = getBuildingGeo(b.key, g.players[b.owner].civKey, g.players[b.owner].color);
        o.main = createBuildingMesh(geo, 'static');
        o.main.castShadow = true; o.main.receiveShadow = true;
        o.group.add(o.main);
        if (geo.blades) {
          const [x, y, z] = geo.bladePivot || [0, 6.6, 2.4];
          if (!geo.bladesC) { geo.bladesC = geo.blades.clone(); geo.bladesC.translate(-x, -y, -z); }
          o.blades = new THREE.Mesh(geo.bladesC, modelMaterial('static'));
          o.blades.position.set(x, y, z); o.blades.castShadow = true;
          o.bladeAxis = geo.bladeAxis || 'z';
          o.main.add(o.blades);
        }
        o.chimney = geo.chimney === undefined ? CHIMNEYS[b.key] : geo.chimney;
        o.scaffold = new THREE.Mesh(scaffoldGeo(b.size, b.def.height), modelMaterial('static'));
        o.scaffold.castShadow = true;
        o.group.add(o.scaffold);
        o.group.position.set(b.x, g.heightAt(b.x, b.z) - 0.05, b.z);
        sc.add(o.group);
        o.smokeT = Math.random() * 2;
      }
      if (seen) b.seen = true;
      if (!b.alive) {
        o.group.position.y = g.heightAt(b.x, b.z) - 0.05 - b.deathT * b.def.height * 0.12;
        o.group.rotation.z = Math.sin(b.id) * 0.04 * b.deathT;
        o.scaffold.visible = false;
        if (b.deathT < 2.5 && this.inView(b.x, b.z) && (fr || g.isVisibleW(b.x, b.z))) {
          for (let i = 0; i < 3; i++) FX.smoke.emit(b.x + rnd(b.size / 2), g.heightAt(b.x, b.z) + Math.random() * 2, b.z + rnd(b.size / 2), rnd(1), 1.5 + Math.random(), rnd(1), 3, 2, 6, 0.55, 0.5, 0.44, 0.6, 0.5, -0.1);
          if (!o.collapsed) { o.collapsed = true; Sfx.play('collapse', b.x, b.z, 1); }
        }
        if (b.deathT > 8) { sc.remove(o.group); b.gfx = null; o.done = true; }
        continue;
      }
      o.group.visible = seen;
      if (!b.built) {
        o.main.position.y = -(1 - b.progress) * b.def.height * 0.92 - 0.02;
        o.scaffold.visible = true;
      } else if (o.scaffold.visible) {
        o.main.position.y = 0; o.scaffold.visible = false;
      }
      if (o.blades && b.built) o.blades.rotation[o.bladeAxis] += dt * (b.gatherers() > 0 ? 1.4 : 0.35);
      if (!this.inView(b.x, b.z) || !(fr || g.isVisibleW(b.x, b.z))) continue;
      // damage fire & chimney smoke
      const hpf = b.hp / b.maxHp;
      if (b.built && hpf < 0.65) {
        const rate = (0.65 - hpf) * 2.2;
        if (Math.random() < rate) {
          const fx = b.x + rnd(b.size * 0.35), fz = b.z + rnd(b.size * 0.35), fy = g.heightAt(b.x, b.z) + b.def.height * (0.4 + Math.random() * 0.4);
          FX.fire.emit(fx, fy, fz, rnd(0.3), 1.6 + Math.random(), rnd(0.3), 0.7 + Math.random() * 0.5, 1.4, 0.4, 1, 0.5, 0.12, 0.9, 0.7, -1);
          FX.smoke.emit(fx, fy + 1, fz, rnd(0.4), 1.5, rnd(0.4), 3.5, 1.4, 4.5, 0.18, 0.16, 0.15, 0.55, 0.6, -0.1);
        }
      }
      o.smokeT -= dt;
      if (b.built && o.smokeT <= 0) {
        o.smokeT = 0.45 + Math.random() * 0.5;
        const ch = o.chimney;
        if (ch) FX.smoke.emit(b.x + ch[0] + rnd(0.1), g.heightAt(b.x, b.z) + ch[1], b.z + ch[2] + rnd(0.1), 0.4, 0.9, 0.2, 5, 0.6, 3.2, 0.82, 0.8, 0.78, 0.32, 0.7, -0.05);
      }
    }
    // selection rings & rally flag for buildings
    this.flag.visible = false;
    this.bRings.begin();
    for (const e of selection) {
      if (e.kind !== 'building' || !e.alive) continue;
      const col = e.owner === g.viewer ? new THREE.Color(0xf4f1e4) : g.players[e.owner].colorLin;
      const r = e.size * 0.74;
      _m.makeScale(r, 1, r); _m.setPosition(e.x, g.heightAt(e.x, e.z) + 0.12, e.z);
      this.bRings.push(_m, col);
      if (e.rally && e.owner === g.viewer) {
        this.flag.visible = true;
        this.flag.position.set(e.rally.x, g.heightAt(e.rally.x, e.rally.z), e.rally.z);
        this.flagCloth.material.color.copy(g.players[e.owner].colorLin);
      }
    }
    // resource / treasure selection ring
    for (const e of selection) {
      if (e.kind === 'res' && e.alive || e.kind === 'treasure' && e.alive) {
        const r = e.rkind === 'mine' || e.rkind === 'quarry' ? 3.2 : e.rkind === 'tree' ? 1.4 : 1.3;
        _m.makeScale(r, 1, r); _m.setPosition(e.x, g.heightAt(e.x, e.z) + 0.1, e.z);
        this.bRings.push(_m, new THREE.Color(0xe8d48a));
      }
    }
    this.bRings.end();
  },

  setGhost(key, civ, color, cx0, cz0, ok) {
    const g = this.game;
    if (!key) { this.ghost.visible = false; this.ghostPlate.visible = false; this.ghostKey = null; return; }
    const material = ok ? this.ghostMatOk : this.ghostMatBad;
    if (this.ghostKey !== key) {
      this.ghost.clear();
      const geo = getBuildingGeo(key, civ, color);
      this.ghost.add(createBuildingMesh(geo, 'staticNoFow', material));
      if (geo.blades) this.ghost.add(new THREE.Mesh(geo.blades, material));
      this.ghostKey = key;
    }
    const def = BUILDINGS[key];
    const x = (cx0 + def.cells / 2) * CELL, z = (cz0 + def.cells / 2) * CELL;
    this.ghost.visible = true;
    this.ghost.position.set(x, g.heightAt(x, z), z);
    this.ghost.traverse((object) => { if (object.isMesh) object.material = material; });
    // footprint plate conformed to terrain
    const pl = this.ghostPlate, pos = pl.geometry.attributes.position;
    const s = def.size;
    for (let i = 0; i < pos.count; i++) {
      const gx = (i % 9) / 8 - 0.5, gz = Math.floor(i / 9) / 8 - 0.5;
      const wx = x + gx * s, wz = z + gz * s;
      pos.setXYZ(i, wx, g.heightAt(wx, wz) + 0.12, wz);
    }
    pos.needsUpdate = true; pl.geometry.computeBoundingSphere();
    pl.material.color.set(ok ? 0x66ff88 : 0xff5544);
    pl.visible = true;
  },
};
const CHIMNEYS = { house: [1.05, 3.9, -0.5], tc: [-3.6, 9.4, -2.4], foundry: [2.4, 9.8, -2.6] };
