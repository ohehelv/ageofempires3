// ---------------------------------------------------------------------------
// 16_main.js — boot, menu, attract mode, game loop
// ---------------------------------------------------------------------------
const BOT_NAMES = {
  britain: ['Джон Уинтроп', 'Уильям Пенн', 'Джеймс Оглторп'],
  france: ['Граф Фронтенак', 'Самюэль Шамплен', 'Жан Тальон'],
  spain: ['Хуан де Оньяте', 'Педро Менендес', 'Эрнандо де Сото'],
  russia: ['Александр Баранов', 'Григорий Шелихов', 'Витус Беринг'],
};

const App = {
  game: null, attract: false, last: 0, acc: 0, iconsFor: null, setup: null,

  boot() {
    const canvas = document.getElementById('gl');
    try { initRenderer(canvas); }
    catch (e) {
      document.getElementById('menu-error').hidden = false;
      return;
    }
    UI.init();
    Input.init(canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupMenu();
    window.addEventListener('pointerdown', () => Sfx.init(), { once: true });
    document.getElementById('app').addEventListener('contextmenu', (e) => { if (!(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'))) e.preventDefault(); });
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });
    this.startAttract();
    requestAnimationFrame((t) => this.loop(t));
  },
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    GFX.renderer.setSize(w, h, false);
    GFX.camera.aspect = w / Math.max(1, h); GFX.camera.updateProjectionMatrix();
    UI.resize();
  },

  // ---------------------------------------------------------------- menu
  loadPrefs() { try { return JSON.parse(localStorage.getItem('nw-colonies-setup') || 'null'); } catch (e) { return null; } },
  savePrefs(s) { try { localStorage.setItem('nw-colonies-setup', JSON.stringify(s)); } catch (e) { /* storage unavailable */ } },
  setupMenu() {
    const prefs = this.loadPrefs() || {};
    const st = this.menuState = {
      civ: prefs.civ || 'britain', biome: prefs.biome || 'newEngland', size: prefs.size || 'large',
      opps: prefs.opps && prefs.opps.length ? prefs.opps.slice(0, 3) : [{ civ: 'france', diff: 'normal', team: 'enemy' }],
      ffa: prefs.ffa !== undefined ? prefs.ffa : true,
    };
    const civWrap = document.getElementById('civ-pick');
    civWrap.innerHTML = Object.entries(CIVS).map(([k, c]) => '<label class="pick civ"><input type="radio" name="civ" value="' + k + '"' + (st.civ === k ? ' checked' : '') + '><span><b>' + c.name + '</b><small>' + c.bonus + '</small></span></label>').join('');
    civWrap.addEventListener('change', (e) => { st.civ = e.target.value; });
    const bWrap = document.getElementById('biome-pick');
    bWrap.innerHTML = Object.entries(BIOMES).map(([k, b]) => '<label class="pick biome"><input type="radio" name="biome" value="' + k + '"' + (st.biome === k ? ' checked' : '') + '><span><i class="sw" style="--a:' + hexToCss(b.grassA) + ';--b:' + hexToCss(b.grassB) + ';--c:' + hexToCss(b.deep) + ';--d:' + hexToCss(b.rock) + '"></i><b>' + b.name + '</b><small>' + b.desc + '</small></span></label>').join('');
    bWrap.addEventListener('change', (e) => { st.biome = e.target.value; });
    const sWrap = document.getElementById('size-pick');
    sWrap.innerHTML = Object.entries(MAP_SIZES).map(([k, s]) => '<label class="seg-opt"><input type="radio" name="msize" value="' + k + '"' + (st.size === k ? ' checked' : '') + '><span>' + s.name + ' <small>' + s.size + '×' + s.size + ' м</small></span></label>').join('');
    sWrap.addEventListener('change', (e) => { st.size = e.target.value; });
    const ffa = document.getElementById('opt-ffa');
    ffa.checked = st.ffa; ffa.addEventListener('change', () => { st.ffa = ffa.checked; });
    this.renderOpps();
    document.getElementById('add-opp').addEventListener('click', () => {
      if (st.opps.length >= 3) return;
      const civs = Object.keys(CIVS);
      st.opps.push({ civ: civs[(st.opps.length + 2) % civs.length], diff: 'normal', team: 'enemy' });
      this.renderOpps();
    });
    document.getElementById('btn-start').addEventListener('click', () => { Sfx.init(); this.startFromMenu(); });
    document.getElementById('btn-howto').addEventListener('click', () => { document.getElementById('modal-help').hidden = false; });
    const fs = () => {
      try {
        if (!document.fullscreenElement) { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => UI.toast('Браузер не разрешил полноэкранный режим', true)); }
        else if (document.exitFullscreen) document.exitFullscreen();
      } catch (e) { /* not available */ }
    };
    document.getElementById('btn-fs').addEventListener('click', fs);
    document.getElementById('btn-fs2').addEventListener('click', fs);
    // pause menu
    const pm = document.getElementById('modal-pause');
    pm.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { UI.speed = +b.dataset.speed; pm.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b)); }));
    pm.querySelectorAll('[data-quality]').forEach((b) => b.addEventListener('click', () => { this.qualityChosen = true; setQuality(b.dataset.quality); pm.querySelectorAll('[data-quality]').forEach((x) => x.classList.toggle('on', x === b)); try { localStorage.setItem('nw-quality', b.dataset.quality); } catch (e) { /* ignore */ } }));
    pm.querySelectorAll('[data-hud]').forEach((b) => b.addEventListener('click', () => { UI.setHudLayout(b.dataset.hud); pm.querySelectorAll('[data-hud]').forEach((x) => x.classList.toggle('on', x === b)); }));
    document.getElementById('opt-volume').addEventListener('input', (e) => Sfx.setVolume(e.target.value / 100));
    document.getElementById('opt-edge').addEventListener('change', (e) => { UI.edgeScroll = e.target.checked; });
    document.getElementById('opt-advisor').addEventListener('change', (e) => { UI.advisorOn = e.target.checked; });
    document.getElementById('opt-autowork').addEventListener('change', (e) => { if (this.game) this.game.autoWork = e.target.checked; this.autoWork = e.target.checked; });
    document.getElementById('btn-resume').addEventListener('click', () => UI.closeModals());
    document.getElementById('btn-help2').addEventListener('click', () => { UI.closeModals(); UI.openHelp(); });
    document.getElementById('btn-resign').addEventListener('click', () => {
      const g = this.game; if (!g || this.attract) return;
      const btn = document.getElementById('btn-resign');
      if (!btn.dataset.confirm) { btn.dataset.confirm = '1'; btn.textContent = 'Точно сдаться?'; setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Сдаться'; }, 3000); return; }
      btn.dataset.confirm = ''; btn.textContent = 'Сдаться';
      UI.closeModals(); g.defeat(g.players[g.viewer]); g.checkVictory();
    });
    document.getElementById('btn-quit').addEventListener('click', () => { UI.closeModals(); this.toMenu(); });
    document.getElementById('btn-end-menu').addEventListener('click', () => { document.getElementById('modal-end').hidden = true; this.toMenu(); });
    document.getElementById('btn-end-watch').addEventListener('click', () => { document.getElementById('modal-end').hidden = true; if (this.game) { this.game.revealAll = true; } });
    document.getElementById('btn-end-again').addEventListener('click', () => { document.getElementById('modal-end').hidden = true; if (this.setup) this.launch(Object.assign({}, this.setup, { seed: (Math.random() * 1e9) >>> 0 })); });
    try { const q = localStorage.getItem('nw-quality'); if (q) { GFX.quality = q; this.qualityChosen = true; } } catch (e) { /* ignore */ }
  },
  renderOpps() {
    const st = this.menuState, wrap = document.getElementById('opps');
    wrap.innerHTML = st.opps.map((o, i) => {
      const civOpts = Object.entries(CIVS).map(([k, c]) => '<option value="' + k + '"' + (o.civ === k ? ' selected' : '') + '>' + c.name + '</option>').join('');
      const dOpts = Object.entries(DIFFICULTY).map(([k, d]) => '<option value="' + k + '"' + (o.diff === k ? ' selected' : '') + '>' + d.name + '</option>').join('');
      return '<div class="opp" style="--pc:' + hexToCss(PLAYER_COLORS[i + 1].hex) + '"><i class="pc"></i>'
        + '<select id="opp-civ-' + i + '" data-i="' + i + '" data-f="civ" aria-label="Цивилизация бота ' + (i + 1) + '">' + civOpts + '</select>'
        + '<select id="opp-diff-' + i + '" data-i="' + i + '" data-f="diff" aria-label="Сложность бота ' + (i + 1) + '">' + dOpts + '</select>'
        + '<select id="opp-team-' + i + '" data-i="' + i + '" data-f="team" aria-label="Сторона бота ' + (i + 1) + '"><option value="enemy"' + (o.team === 'enemy' ? ' selected' : '') + '>Враг</option><option value="ally"' + (o.team === 'ally' ? ' selected' : '') + '>Союзник</option></select>'
        + (st.opps.length > 1 ? '<button class="rm" data-rm="' + i + '" aria-label="Убрать бота">×</button>' : '') + '</div>';
    }).join('');
    wrap.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { st.opps[+s.dataset.i][s.dataset.f] = s.value; }));
    wrap.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { st.opps.splice(+b.dataset.rm, 1); this.renderOpps(); }));
    document.getElementById('add-opp').hidden = st.opps.length >= 3;
  },
  startFromMenu() {
    const st = this.menuState;
    if (!st.opps.some((o) => o.team === 'enemy')) { st.opps[0].team = 'enemy'; this.renderOpps(); }
    this.savePrefs(st);
    const players = [{ name: 'Вы', civ: st.civ, color: PLAYER_COLORS[0].hex, team: 1, human: true }];
    const used = {};
    st.opps.forEach((o, i) => {
      const names = BOT_NAMES[o.civ];
      used[o.civ] = (used[o.civ] || 0) + 1;
      players.push({ name: names[(used[o.civ] - 1) % names.length], civ: o.civ, color: PLAYER_COLORS[i + 1].hex, team: o.team === 'ally' ? 1 : (st.ffa ? 2 + i : 2), difficulty: o.diff });
    });
    this.launch({ mapSize: st.size, biome: st.biome, seed: (Math.random() * 1e9) >>> 0, players });
  },
  launch(setup) {
    this.setup = setup;
    document.getElementById('menu').hidden = true;
    const ld = document.getElementById('loading');
    ld.hidden = false;
    setTimeout(() => {
      this.startGame(setup, false);
      ld.hidden = true;
      Sfx.init(); Sfx.stopAmbient(); Sfx.startAmbient(setup.biome);
      UI.toast('Цель: уничтожьте все здания и войска противника. F1 — управление');
    }, 30);
  },
  toMenu() {
    Sfx.stopAmbient();
    UI.closeModals();
    document.getElementById('modal-end').hidden = true;
    document.getElementById('hud').hidden = true;
    document.getElementById('menu').hidden = false;
    this.startAttract();
  },
  startAttract() {
    const biomes = Object.keys(BIOMES);
    const civs = Object.keys(CIVS);
    const c1 = civs[Math.floor(Math.random() * civs.length)];
    let c2 = civs[Math.floor(Math.random() * civs.length)]; if (c2 === c1) c2 = civs[(civs.indexOf(c1) + 1) % civs.length];
    const setup = {
      mapSize: 'medium', biome: biomes[Math.floor(Math.random() * biomes.length)], seed: (Math.random() * 1e9) >>> 0,
      players: [
        { name: BOT_NAMES[c1][0], civ: c1, color: PLAYER_COLORS[0].hex, team: 1, difficulty: 'expert' },
        { name: BOT_NAMES[c2][1], civ: c2, color: PLAYER_COLORS[1].hex, team: 2, difficulty: 'expert' },
      ],
    };
    this.startGame(setup, true);
  },

  // ---------------------------------------------------------------- game lifecycle
  disposeScene() {
    const sc = GFX.scene;
    if (!sc) return;
    const keep = new Set();
    for (const k in UNIT_MODELS) keep.add(UNIT_MODELS[k].geo);
    for (const k in BUILDING_BUILDERS) { const b = BUILDING_BUILDERS[k]; keep.add(b.main); if (b.blades) keep.add(b.blades); if (b.bladesC) keep.add(b.bladesC); }
    for (const k in TREE_GEOS) keep.add(TREE_GEOS[k]);
    for (const k in PROP_GEOS) keep.add(PROP_GEOS[k]);
    for (const k in SCAFFOLD) keep.add(SCAFFOLD[k]);
    const keepMat = new Set(Object.values(MATS));
    sc.traverse((o) => {
      if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
      if (o.material && !keepMat.has(o.material)) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (!keepMat.has(m)) m.dispose(); }); }
    });
    if (GFX.fowTex) GFX.fowTex.dispose();
    if (GFX.splatTex) GFX.splatTex.dispose();
    if (sc.environment) sc.environment.dispose();
    GFX.renderer.renderLists.dispose();
    GFX.scene = null;
  },
  startGame(setup, attract) {
    FX.active = false;
    this.disposeScene();
    const game = new Game(setup);
    this.game = game; this.attract = attract; this.acc = 0;
    buildScene(game.map);
    RS.init(game);
    const viewer = game.players[game.viewer];
    const iconKey = viewer.color + '|' + viewer.civKey;
    if (!attract && this.iconsFor !== iconKey) { renderIcons(viewer.color, viewer.civKey); this.iconsFor = iconKey; for (const k in Glyph.cache) if (k.startsWith('c:')) delete Glyph.cache[k]; }
    for (const p of game.players) if (!p.isHuman) game.ais.push(new BotAI(game, p));
    if (attract) {
      game.revealAll = true;
      UI.game = null;
      Input.setGame(null);
      const s = game.map.starts[0];
      Cam.yaw = Cam.tyaw = 0.4; Cam.dist = Cam.tdist = 64; Cam.jump(s.x, s.z + 6, true);
      this.attractT = 0; this.attractIdx = 0;
      setQuality(GFX.quality);
    } else {
      Input.setGame(game);
      if (this.autoWork === false) game.autoWork = false;
      UI.speed = 1;
      UI.attach(game);
      const tc = viewer.tc;
      Cam.yaw = Cam.tyaw = 0; Cam.dist = Cam.tdist = 70;
      Cam.jump(tc.x, tc.z + 4, true);
      Input.setSelection([]);
      setQuality(GFX.quality);
      // warm up so the first frame has a settled fog texture
      updateFowTexture(game.vis, game.explored, 10, false);
      this.fpsStat = null;
    }
    this.last = performance.now();
  },

  reportError(e) {
    this.errN = (this.errN || 0) + 1;
    if (this.errN <= 3) console.error('Ошибка в игровом цикле:', e);
    if (this.errN === 1 && !this.attract) UI.toast('Произошла внутренняя ошибка, игра продолжается', true);
  },
  autoQuality(dt) {
    if (this.qualityChosen || this.attract || document.hidden) return;
    const s = this.fpsStat || (this.fpsStat = { t: 0, n: 0, sum: 0, warm: 0 });
    s.warm += dt;
    if (s.warm < 3) return;              // skip shader compilation hitches
    s.t += dt; s.n++; s.sum += dt;
    if (s.t < 4) return;
    const avg = s.sum / s.n;
    this.fpsStat = { t: 0, n: 0, sum: 0, warm: 2.5 };
    if (avg > 1 / 30 && GFX.quality !== 'low') {
      const next = GFX.quality === 'high' ? 'medium' : 'low';
      setQuality(next);
      UI.toast('Графика переключена на «' + (next === 'medium' ? 'среднее' : 'низкое') + '» качество для плавности. Можно изменить в меню.');
    }
  },
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const g = this.game;
    let dt = (t - this.last) / 1000; this.last = t;
    if (!(dt > 0)) dt = 0.016;
    if (dt < 0.5) this.autoQuality(dt);
    dt = Math.min(dt, 0.1);
    if (!g || !GFX.scene) return;
    const paused = !this.attract && UI.isPaused();
    try {
      if (!paused) {
        this.acc += dt * (this.attract ? 1 : UI.speed);
        let n = 0;
        while (this.acc >= TICK && n < 10) { g.tick(); this.acc -= TICK; n++; }
        if (n >= 10) this.acc = 0;
      }
    } catch (e) { this.reportError(e); this.acc = 0; }
    const alpha = clamp(this.acc / TICK, 0, 1);
    try {
      if (this.attract) this.attractCamera(dt);
      else Input.update(dt);
      Cam.update(dt, g);
      RS.computeViewBox(Cam);
      RS.frame(paused ? 0 : dt, paused ? 1 : alpha, this.attract ? [] : Input.selection);
      updateSun(Cam.x, Cam.z, Cam.dist);
      updateFowTexture(g.vis, g.explored, dt, g.revealAll);
      GFX.renderer.render(GFX.scene, GFX.camera);
      if (!this.attract) UI.update(dt);
    } catch (e) { this.reportError(e); }
  },
  attractCamera(dt) {
    const g = this.game;
    this.attractT += dt;
    Cam.tyaw += dt * 0.035;
    if (this.attractT > 26) {
      this.attractT = 0;
      this.attractIdx++;
      // alternate between bases and the busiest fight
      const fights = g.units.filter((u) => u.alive && u.isMilitary && u.order && u.order.type === 'attack');
      if (fights.length > 4 && this.attractIdx % 2 === 0) { const u = fights[Math.floor(Math.random() * fights.length)]; Cam.jump(u.x, u.z); }
      else { const s = g.map.starts[this.attractIdx % g.map.starts.length]; Cam.jump(s.x + rnd(10), s.z + rnd(10)); }
      Cam.tdist = 50 + Math.random() * 40;
    }
  },
};

window.addEventListener('DOMContentLoaded', async () => {
  if (typeof THREE === 'undefined') { document.getElementById('menu-error').hidden = false; return; }
  await Promise.all([loadOutpostModel(), loadDeerMotion()]);
  App.boot();
});
window.__nw = { App, get game() { return App.game; }, Input, UI, Cam, GFX, RS, FX, Sfx };
window.__nwGlyph = Glyph; window.__nwBot = BotAI;
