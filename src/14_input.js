// ---------------------------------------------------------------------------
// 14_input.js — RTS camera, picking, selection, orders, placement, hotkeys
// ---------------------------------------------------------------------------
const Cam = {
  x: 100, z: 100, dist: 72, yaw: 0, tx: 100, tz: 100, tdist: 72, tyaw: 0, groundY: 1, minD: 22, maxD: 150, shake: 0, auto: false,
  jump(x, z, instant) { this.tx = x; this.tz = z; if (instant) { this.x = x; this.z = z; } },
  update(dt, game) {
    const k = 1 - Math.pow(0.0005, dt);
    this.x = lerp(this.x, this.tx, k); this.z = lerp(this.z, this.tz, k);
    this.dist = lerp(this.dist, this.tdist, 1 - Math.pow(0.002, dt));
    this.yaw = angleLerp(this.yaw, this.tyaw, 1 - Math.pow(0.002, dt));
    const s = game.size;
    this.tx = clamp(this.tx, 8, s - 8); this.tz = clamp(this.tz, 8, s - 8);
    this.groundY = lerp(this.groundY, Math.max(0, game.heightAt(this.x, this.z)), 0.1);
    const t = clamp((this.dist - this.minD) / (this.maxD - this.minD), 0, 1);
    const pitch = lerp(0.82, 1.06, t);
    const cam = GFX.camera;
    const hz = Math.cos(pitch) * this.dist, vy = Math.sin(pitch) * this.dist;
    cam.position.set(this.x + Math.sin(this.yaw) * hz, this.groundY + vy, this.z + Math.cos(this.yaw) * hz);
    cam.lookAt(this.x, this.groundY, this.z);
    if (GFX.scene && GFX.scene.fog) { GFX.scene.fog.near = this.dist * 1.6; GFX.scene.fog.far = this.dist * 5.5 + 80; }
    Sfx.listener.x = this.x; Sfx.listener.z = this.z; Sfx.listener.yaw = this.yaw;
  },
};

const Input = {
  game: null, canvas: null, mouse: { x: 0, y: 0, inside: false }, keys: new Set(),
  selection: [], groups: {}, placement: null, drag: null, mmb: null, hover: null, hoverT: 0,
  lastClick: { t: 0, id: null }, lastGroupKey: { k: null, t: 0 }, alertPos: null, idleIdx: 0, enabled: true,
  ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), box: new THREE.Box3(), tmpV: new THREE.Vector3(),

  init(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.onWheel(e); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    document.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.drag = null; this.mmb = null; });
    // touch: one finger pans, tap selects / orders (basic support)
    canvas.addEventListener('touchstart', (e) => this.onTouch(e, 'start'), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouch(e, 'move'), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouch(e, 'end'), { passive: false });
  },
  setGame(g) { this.game = g; this.selection = []; this.groups = {}; this.placement = null; this.hover = null; },

  // ---------------------------------------------------------------- picking
  rayAt(sx, sy) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, GFX.camera);
    return this.ray.ray;
  },
  groundAt(sx, sy) {
    const g = this.game, ray = this.rayAt(sx, sy), o = ray.origin, d = ray.direction;
    let t = 0, prevT = 0, hit = null;
    for (let i = 0; i < 900; i++) {
      t += i < 50 ? 1 : 2;
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      const h = (x < 0 || z < 0 || x > g.size || z > g.size) ? -50 : g.heightAt(x, z);
      if (y <= h) {
        let a = prevT, b = t;
        for (let k = 0; k < 12; k++) { const m = (a + b) / 2; const yy = o.y + d.y * m; const hh = g.heightAt(o.x + d.x * m, o.z + d.z * m); if (yy <= hh) b = m; else a = m; }
        hit = { x: o.x + d.x * b, z: o.z + d.z * b, t: b };
        break;
      }
      prevT = t;
      if (y < -40) break;
    }
    if (!hit) {
      const tt = d.y < 0 ? (o.y - Cam.groundY) / -d.y : 300;
      hit = { x: o.x + d.x * tt, z: o.z + d.z * tt, t: tt };
    }
    hit.x = clamp(hit.x, 1, g.size - 1); hit.z = clamp(hit.z, 1, g.size - 1);
    return hit;
  },
  pickAt(sx, sy) {
    const g = this.game, ray = this.rayAt(sx, sy), cam = GFX.camera;
    const rect = this.canvas.getBoundingClientRect();
    const px = sx - rect.left, py = sy - rect.top;
    const H = rect.height, f = H / (2 * Math.tan((cam.fov * PI) / 360));
    let best = null, bd = 1e9;
    // units (screen-space)
    for (const su of RS.screenUnits) {
      const u = su.u;
      const dc = cam.position.distanceTo(this.tmpV.set(u.x, u.y || 0, u.z));
      const pr = Math.max(10, ((u.def.radius * 1.3 + 0.6) * UNIT_SCALE * f) / dc);
      const dx = su.sx - px, dy = su.sy - py;
      const dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < pr && dc - 3 + dd * 0.05 < bd) { bd = dc - 3 + dd * 0.05; best = u; }
    }
    // buildings (ray vs box)
    for (const b of g.buildings) {
      if (!b.alive || !b.gfx || !b.gfx.group.visible) continue;
      const y0 = g.heightAt(b.x, b.z), hh = b.def.height * (b.built ? 0.9 : Math.max(0.25, b.progress));
      const s = b.size / 2 * 0.92;
      this.box.min.set(b.x - s, y0 - 0.5, b.z - s); this.box.max.set(b.x + s, y0 + hh, b.z + s);
      const hit = ray.intersectBox(this.box, this.tmpV);
      if (hit) { const d = hit.distanceTo(ray.origin); if (d < bd) { bd = d; best = b; } }
    }
    // resources & treasures by marching along the ray close to the ground
    const o = ray.origin, d = ray.direction;
    const gp = this.groundAt(sx, sy);
    const tEnd = gp.t, tStart = Math.max(0, tEnd - 30);
    for (let t = tStart; t <= tEnd + 0.01; t += 0.5) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (t > bd) break;
      const ground = g.heightAt(x, z), above = y - ground;
      if (above > 8) continue;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      if (cx < 0 || cz < 0 || cx >= g.N || cz >= g.N) continue;
      const ti = g.treeGrid[cz * g.N + cx];
      if (ti >= 0 && above < 6.5 && g.isExploredW(x, z)) {
        const tr = g.trees[ti];
        if (tr && tr.alive && dist(tr.x, tr.z, x, z) < 1.6 + above * 0.12) { if (t < bd) { bd = t; best = tr; } break; }
      }
    }
    for (const r of g.resources) {
      if (!r.alive || r.rkind === 'tree' || !RS.inView(r.x, r.z) || !g.isExploredW(r.x, r.z)) continue;
      if (r.rkind === 'carcass' && !g.isVisibleW(r.x, r.z)) continue;
      const dep = r.rkind === 'mine' || r.rkind === 'quarry';
      const rad = dep ? 2.6 : r.rkind === 'bush' ? 1.2 : 0.9, hgt = dep ? 2.4 : 1.2;
      const y0 = g.heightAt(r.x, r.z);
      this.box.min.set(r.x - rad, y0 - 0.3, r.z - rad); this.box.max.set(r.x + rad, y0 + hgt, r.z + rad);
      const hit = ray.intersectBox(this.box, this.tmpV);
      if (hit) { const dd = hit.distanceTo(o); if (dd < bd) { bd = dd; best = r; } }
    }
    for (const t of g.treasures) {
      if (!t.alive || !RS.inView(t.x, t.z) || !g.isExploredW(t.x, t.z)) continue;
      const y0 = g.heightAt(t.x, t.z);
      this.box.min.set(t.x - 1.4, y0 - 0.3, t.z - 1.4); this.box.max.set(t.x + 1.4, y0 + 2.2, t.z + 1.4);
      const hit = ray.intersectBox(this.box, this.tmpV);
      if (hit) { const dd = hit.distanceTo(o); if (dd < bd) { bd = dd; best = t; } }
    }
    for (const s of g.sockets) {
      if (s.tp || !RS.inView(s.x, s.z) || !g.isExploredW(s.x, s.z)) continue;
      const y0 = g.heightAt(s.x, s.z);
      this.box.min.set(s.x - 2.1, y0 - 0.3, s.z - 2.1); this.box.max.set(s.x + 2.1, y0 + 2.6, s.z + 2.1);
      const hit = ray.intersectBox(this.box, this.tmpV);
      if (hit) { const dd = hit.distanceTo(o); if (dd < bd) { bd = dd; best = Object.assign(s, { kind: 'socket' }); } }
    }
    return best;
  },

  // ---------------------------------------------------------------- selection helpers
  own(e) { return e && e.owner === this.game.viewer; },
  setSelection(list, add) {
    if (!add) for (const e of this.selection) if (e.kind === 'unit') e.selected = false;
    if (add) {
      for (const e of list) {
        const i = this.selection.indexOf(e);
        if (i >= 0) { this.selection.splice(i, 1); if (e.kind === 'unit') e.selected = false; }
        else this.selection.push(e);
      }
    } else this.selection = list.slice();
    for (const e of this.selection) if (e.kind === 'unit') e.selected = true;
    UI.selectionChanged();
  },
  pruneSelection() {
    let changed = false;
    this.selection = this.selection.filter((e) => {
      const ok = e.alive && !e.ko && !e.garrisoned && !(e.kind === 'res' && e.amount <= 0);
      if (!ok) { changed = true; if (e.kind === 'unit') e.selected = false; }
      return ok;
    });
    if (changed) UI.selectionChanged();
  },
  selUnits() { return this.selection.filter((e) => e.kind === 'unit' && this.own(e)); },
  selBuildings() { return this.selection.filter((e) => e.kind === 'building' && this.own(e)); },

  // ---------------------------------------------------------------- mouse
  onDown(e) {
    if (!this.game || !this.enabled) return;
    Sfx.init();
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
    if (e.button === 1 || (e.button === 0 && this.keys.has(' ') && false)) { e.preventDefault(); this.mmb = { x: e.clientX, y: e.clientY, alt: e.altKey }; return; }
    if (e.button === 0) {
      if (this.placement) { this.tryPlace(e.shiftKey); return; }
      if (UI.targetMode) { this.issueAt(e.clientX, e.clientY, UI.targetMode === 'attackMove'); UI.targetMode = null; UI.updateCursor(); return; }
      this.drag = { x: e.clientX, y: e.clientY, shift: e.shiftKey, ctrl: e.ctrlKey };
    } else if (e.button === 2) {
      if (this.placement) { this.cancelPlacement(); return; }
      if (UI.targetMode) { UI.targetMode = null; UI.updateCursor(); return; }
      this.issueAt(e.clientX, e.clientY, e.ctrlKey);
    }
  },
  onMove(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
    if (this.mmb) {
      const dx = e.clientX - this.mmb.x, dy = e.clientY - this.mmb.y;
      this.mmb.x = e.clientX; this.mmb.y = e.clientY;
      if (this.mmb.alt) { Cam.tyaw -= dx * 0.006; }
      else {
        const s = Cam.dist * 0.0022;
        const c = Math.cos(Cam.yaw), sn = Math.sin(Cam.yaw);
        Cam.tx -= (dx * c + dy * sn) * s; Cam.tz -= (-dx * sn + dy * c) * s;
        Cam.x = Cam.tx; Cam.z = Cam.tz;
      }
    }
  },
  onUp(e) {
    if (e.button === 1) { this.mmb = null; return; }
    if (e.button !== 0 || !this.drag || !this.game) return;
    const d = this.drag; this.drag = null;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) this.clickSelect(e.clientX, e.clientY, d.shift, d.ctrl);
    else this.boxSelect(d.x, d.y, e.clientX, e.clientY, d.shift);
  },
  onWheel(e) {
    if (!this.game) return;
    if (e.altKey) { Cam.tyaw += Math.sign(e.deltaY) * 0.15; return; }
    Cam.tdist = clamp(Cam.tdist * Math.pow(1.0015, e.deltaY), Cam.minD, Cam.maxD);
  },
  clickSelect(sx, sy, shift, ctrl) {
    const g = this.game;
    const e = this.pickAt(sx, sy);
    if (!e) { if (!shift) this.setSelection([]); return; }
    const now = performance.now();
    const dbl = now - this.lastClick.t < 330 && this.lastClick.id === e.id;
    this.lastClick = { t: now, id: e.id };
    if ((dbl || ctrl) && e.kind === 'unit' && this.own(e)) {
      const same = RS.screenUnits.filter((s) => s.u.key === e.key && this.own(s.u)).map((s) => s.u);
      this.setSelection(same, false); Sfx.play('click');
      return;
    }
    if ((dbl || ctrl) && e.kind === 'building' && this.own(e)) {
      const same = g.buildings.filter((b) => b.alive && b.key === e.key && b.owner === e.owner && RS.inView(b.x, b.z));
      this.setSelection(same, false); return;
    }
    if (shift && this.own(e) && e.kind === 'unit') this.setSelection([e], true);
    else this.setSelection([e], false);
    Sfx.play('click');
  },
  boxSelect(x0, y0, x1, y1, shift) {
    const r = this.canvas.getBoundingClientRect();
    const ax = Math.min(x0, x1) - r.left, bx = Math.max(x0, x1) - r.left, ay = Math.min(y0, y1) - r.top, by = Math.max(y0, y1) - r.top;
    let list = RS.screenUnits.filter((s) => this.own(s.u) && s.sx >= ax && s.sx <= bx && s.sy >= ay && s.sy <= by).map((s) => s.u);
    const mil = list.filter((u) => u.isMilitary && !u.def.hero);
    if (mil.length && mil.length < list.length) list = list.filter((u) => u.isMilitary);
    if (!list.length && !shift) { this.setSelection([]); return; }
    this.setSelection(list, shift);
    if (list.length) Sfx.play('click');
  },

  // ---------------------------------------------------------------- orders
  issueAt(sx, sy, attackMove) {
    const g = this.game;
    const units = this.selUnits();
    const blds = this.selBuildings();
    const t = this.pickAt(sx, sy);
    const gp = this.groundAt(sx, sy);
    if (!units.length) {
      if (blds.length) {
        for (const b of blds) b.rally = { x: gp.x, z: gp.z, target: t && (t.kind === 'res' || t.kind === 'building' && t.owner === b.owner && t.def.gather) ? t : null };
        RS.addMarker(gp.x, gp.z, 'move'); Sfx.play('command');
      }
      return;
    }
    Sfx.init();
    if (t && t.kind === 'socket') {
      const builders = units.filter((u) => u.def.build || u.def.buildTP);
      if (builders.length) {
        const err = g.cmdPlace(g.players[g.viewer], 'tradingPost', t.cx0, t.cz0, builders);
        if (typeof err === 'string') UI.toast(err, true); else { RS.addMarker(t.x, t.z, 'build'); Sfx.play('command'); }
        g.orderMove(units.filter((u) => !builders.includes(u)), t.x, t.z, false);
        return;
      }
    }
    if (t && t.kind !== 'socket' && !(t.kind === 'unit' && t.owner === g.viewer)) {
      if (t.kind === 'unit' && !g.revealAll && t.owner !== g.viewer && !g.isVisibleW(t.x, t.z)) { /* hidden */ }
      else {
        const did = g.orderTarget(units, t);
        RS.addMarker(t.x, t.z, did === 'attack' ? 'attack' : did === 'gather' || did === 'build' || did === 'repair' ? 'gather' : 'move');
        Sfx.play('command');
        return;
      }
    }
    g.orderMove(units, gp.x, gp.z, attackMove);
    RS.addMarker(gp.x, gp.z, attackMove ? 'attack' : 'move');
    Sfx.play('command');
  },

  // ---------------------------------------------------------------- placement
  startPlacement(key, wagon) {
    this.placement = { key, wagon: wagon || null, cx0: 0, cz0: 0, ok: false };
    UI.updateCursor();
  },
  cancelPlacement() { this.placement = null; RS.setGhost(null); UI.updateCursor(); },
  updatePlacement() {
    const pl = this.placement; if (!pl) return;
    const g = this.game, p = g.players[g.viewer], def = BUILDINGS[pl.key];
    const gp = this.groundAt(this.mouse.x, this.mouse.y);
    let cx0 = Math.round(gp.x / CELL - def.cells / 2), cz0 = Math.round(gp.z / CELL - def.cells / 2);
    if (def.socket) { const s = g.nearestSocket(gp.x, gp.z, 10); if (s) { cx0 = s.cx0; cz0 = s.cz0; } }
    pl.cx0 = cx0; pl.cz0 = cz0;
    pl.ok = !!(g.canPlace(pl.key, cx0, cz0, g.viewer) && (pl.wagon || p.canAfford(p.costOf("building", pl.key))));
    RS.setGhost(pl.key, p.civKey, p.color, cx0, cz0, pl.ok);
  },
  tryPlace(shift) {
    const g = this.game, pl = this.placement, p = g.players[g.viewer];
    if (!pl) return;
    if (!pl.ok) { UI.toast(g.canPlace(pl.key, pl.cx0, pl.cz0, g.viewer) ? 'Недостаточно ресурсов' : 'Здесь нельзя строить', true); Sfx.play('error'); return; }
    if (pl.wagon) {
      pl.wagon.cmdDeploy(pl.key, pl.cx0, pl.cz0);
      Sfx.play('command'); this.cancelPlacement(); return;
    }
    const builders = this.selUnits().filter((u) => u.def.build || (u.def.buildTP && pl.key === 'tradingPost'));
    const r = g.cmdPlace(p, pl.key, pl.cx0, pl.cz0, builders);
    if (typeof r === 'string') { UI.toast(r, true); Sfx.play('error'); return; }
    Sfx.play('command');
    RS.addMarker(r.x, r.z, 'build');
    if (!shift) this.cancelPlacement();
  },

  // ---------------------------------------------------------------- keyboard
  onKey(e, down) {
    const k = e.key;
    if (down) this.keys.add(k.length === 1 ? k.toLowerCase() : k); else this.keys.delete(k.length === 1 ? k.toLowerCase() : k);
    if (!down || !this.game) return;
    if (UI.modalOpen()) { if (k === 'Escape') UI.closeModals(); return; }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const g = this.game, p = g.players[g.viewer];
    if (k === 'Escape') {
      if (this.placement) this.cancelPlacement();
      else if (UI.targetMode) { UI.targetMode = null; UI.updateCursor(); }
      else if (this.selection.length) this.setSelection([]);
      else UI.togglePause();
      return;
    }
    if (k === 'F10' || k === 'F3' || (k === 'p' || k === 'P' || k === 'з' || k === 'З') && !e.ctrlKey) { e.preventDefault(); UI.togglePause(); return; }
    if (/^[0-9]$/.test(k)) {
      const n = k;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.groups[n] = this.selection.filter((x) => this.own(x)); UI.toast('Группа ' + n + ' назначена'); return; }
      const grp = (this.groups[n] || []).filter((x) => x.alive && !x.garrisoned);
      if (!grp.length) return;
      this.setSelection(grp, e.shiftKey);
      const now = performance.now();
      if (this.lastGroupKey.k === n && now - this.lastGroupKey.t < 400) this.focusOn(grp);
      this.lastGroupKey = { k: n, t: now };
      return;
    }
    if ((k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const army = g.units.filter((u) => u.alive && u.owner === g.viewer && u.isMilitary && !u.def.hero && !u.garrisoned && !u.def.tags.has('wagon'));
      if (army.length) { this.setSelection(army); UI.toast('Выбрана вся армия: ' + army.length); } else UI.toast('Армии пока нет');
      return;
    }
    if (k === 'Delete') { for (const x of this.selection.slice()) if (this.own(x)) g.cmdDelete(x); this.pruneSelection(); return; }
    if (k === 'Home') { Cam.tyaw = 0; return; }
    if (k === '[') { Cam.tyaw += 0.3; return; }
    if (k === ']') { Cam.tyaw -= 0.3; return; }
    if (k === '.' || k === 'ю' || k === 'Ю') { this.selectIdleVillager(); return; }
    if (k === ',' || k === 'б' || k === 'Б') { const ex = p.explorer; if (ex && ex.alive && !ex.ko) { this.setSelection([ex]); this.focusOn([ex]); } return; }
    if ((k === 'h' || k === 'H' || k === 'р' || k === 'Р') && !this.hotkeyButton(k)) { const tc = g.buildings.find((b) => b.alive && b.owner === g.viewer && b.key === 'tc'); if (tc) { this.setSelection([tc]); this.focusOn([tc]); } return; }
    if (k === ' ') { e.preventDefault(); if (this.alertPos) Cam.jump(this.alertPos.x, this.alertPos.z); return; }
    if (k === '+' || k === '=') { UI.setSpeed(Math.min(2, UI.speed + 0.5)); return; }
    if (k === '-' || k === '_') { UI.setSpeed(Math.max(0.5, UI.speed - 0.5)); return; }
    if (k === 'F1') { e.preventDefault(); UI.openHelp(); return; }
    if (k === 'Tab') { e.preventDefault(); UI.openHomeCity(); return; }
    this.hotkeyButton(k);
  },
  hotkeyButton(k) {
    const map = { q: 0, w: 1, e: 2, r: 3, t: 4, a: 5, s: 6, d: 7, f: 8, g: 9, z: 10, x: 11, c: 12, v: 13, b: 14,
      'й': 0, 'ц': 1, 'у': 2, 'к': 3, 'е': 4, 'ф': 5, 'ы': 6, 'в': 7, 'а': 8, 'п': 9, 'я': 10, 'ч': 11, 'с': 12, 'м': 13, 'и': 14 };
    const i = map[k.toLowerCase()];
    if (i === undefined) return false;
    return UI.pressCommand(i);
  },
  selectIdleVillager() {
    const g = this.game;
    const idle = g.units.filter((u) => u.alive && u.owner === g.viewer && u.def.tags.has('villager') && !u.order && !u.garrisoned);
    if (!idle.length) { UI.toast('Все поселенцы заняты'); return; }
    this.idleIdx = (this.idleIdx + 1) % idle.length;
    const u = idle[this.idleIdx];
    this.setSelection([u]); this.focusOn([u]);
  },
  focusOn(list) {
    let x = 0, z = 0; for (const e of list) { x += e.x; z += e.z; }
    Cam.jump(x / list.length, z / list.length);
  },

  // ---------------------------------------------------------------- touch (basic)
  onTouch(e, phase) {
    e.preventDefault();
    if (!this.game) return;
    const t = e.changedTouches[0];
    if (phase === 'start') { Sfx.init(); this.touch = { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, n: e.touches.length, moved: false, t: performance.now() }; return; }
    if (!this.touch) return;
    if (phase === 'move') {
      if (e.touches.length >= 2 && this.touch.n >= 2) {
        const a = e.touches[0], b = e.touches[1];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (this.touch.pinch) Cam.tdist = clamp(Cam.tdist * (this.touch.pinch / d), Cam.minD, Cam.maxD);
        this.touch.pinch = d; this.touch.moved = true; return;
      }
      const dx = t.clientX - this.touch.x, dy = t.clientY - this.touch.y;
      this.touch.x = t.clientX; this.touch.y = t.clientY;
      if (Math.abs(t.clientX - this.touch.sx) + Math.abs(t.clientY - this.touch.sy) > 10) this.touch.moved = true;
      const s = Cam.dist * 0.0025, c = Math.cos(Cam.yaw), sn = Math.sin(Cam.yaw);
      Cam.tx -= (dx * c + dy * sn) * s; Cam.tz -= (-dx * sn + dy * c) * s; Cam.x = Cam.tx; Cam.z = Cam.tz;
      return;
    }
    if (phase === 'end') {
      if (!this.touch.moved) {
        if (this.placement) { this.mouse.x = t.clientX; this.mouse.y = t.clientY; this.updatePlacement(); this.tryPlace(false); }
        else {
          const ent = this.pickAt(t.clientX, t.clientY);
          if (this.selUnits().length && (!ent || !this.own(ent))) this.issueAt(t.clientX, t.clientY, false);
          else this.clickSelect(t.clientX, t.clientY, false, false);
        }
      }
      this.touch = null;
    }
  },

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game; if (!g) return;
    const pan = Cam.dist * 1.25 * dt;
    let px = 0, pz = 0;
    if (this.keys.has('ArrowLeft')) px -= 1; if (this.keys.has('ArrowRight')) px += 1;
    if (this.keys.has('ArrowUp')) pz -= 1; if (this.keys.has('ArrowDown')) pz += 1;
    const m = this.mouse, W = window.innerWidth, H = window.innerHeight;
    if (m.inside && !this.drag && !this.mmb && UI.edgeScroll && !UI.modalOpen() && document.hasFocus()) {
      const E = 5;
      if (m.x <= E) px -= 1; if (m.x >= W - 1 - E) px += 1; if (m.y <= E) pz -= 1; if (m.y >= H - 1 - E) pz += 1;
    }
    if (px || pz) {
      const c = Math.cos(Cam.yaw), s = Math.sin(Cam.yaw);
      Cam.tx += (px * c + pz * s) * pan; Cam.tz += (-px * s + pz * c) * pan;
    }
    if (this.placement) this.updatePlacement();
    this.hoverT -= dt;
    if (this.hoverT <= 0 && !this.drag) {
      this.hoverT = 0.08;
      const over = document.elementFromPoint(m.x, m.y);
      this.hover = over === this.canvas ? this.pickAt(m.x, m.y) : null;
      UI.updateCursor();
    }
    this.pruneSelection();
  },
};
