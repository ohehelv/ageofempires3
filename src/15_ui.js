// ---------------------------------------------------------------------------
// 15_ui.js — HUD, command card, minimap, overlays, modals, glyph icons
// ---------------------------------------------------------------------------
const Glyph = {
  cache: {},
  // draw a brass glyph; returns dataURL
  get(name, size = 64, bg) {
    const key = name + '|' + size + '|' + (bg || '');
    if (this.cache[key]) return this.cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.save(); g.scale(size / 64, size / 64);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 64, 64); }
    this.draw(g, name);
    g.restore();
    return (this.cache[key] = cv.toDataURL());
  },
  draw(g, name, col = '#e2c06a', dark = '#3a2c14') {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 4;
    const P = (pts, close = true) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); if (close) g.closePath(); };
    const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
    const OL = '#22160b';
    switch (name) {
      // ---- resources: full-colour pictograms with dark outlines so they read at 18–28 px
      case 'food': { // roast drumstick
        const bone = '#f3ead6';
        g.strokeStyle = OL; g.lineWidth = 11; g.beginPath(); g.moveTo(27, 37); g.lineTo(13, 51); g.stroke();
        for (const [x, y] of [[8.5, 46.5], [17.5, 55.5]]) { circle(x, y, 7.4); g.fillStyle = OL; g.fill(); }
        g.strokeStyle = bone; g.lineWidth = 6.4; g.beginPath(); g.moveTo(27, 37); g.lineTo(13, 51); g.stroke();
        for (const [x, y] of [[8.5, 46.5], [17.5, 55.5]]) { circle(x, y, 5.1); g.fillStyle = bone; g.fill(); }
        g.beginPath(); g.ellipse(38, 25, 21.5, 16, -PI / 4, 0, TAU);
        const gr = g.createRadialGradient(31, 17, 2, 38, 26, 25); gr.addColorStop(0, '#f6ad62'); gr.addColorStop(0.5, '#cc6a2e'); gr.addColorStop(1, '#7a3014');
        g.fillStyle = gr; g.fill(); g.lineWidth = 3.2; g.strokeStyle = OL; g.stroke();
        g.fillStyle = 'rgba(255,238,205,0.8)'; g.beginPath(); g.ellipse(31, 16.5, 6.5, 2.8, -PI / 4, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(96,34,12,0.6)'; g.lineWidth = 2.2;
        for (const [x, y] of [[43, 31], [48, 23], [37, 36]]) { g.beginPath(); g.moveTo(x - 3, y + 3); g.lineTo(x + 3, y - 3); g.stroke(); }
        break;
      }
      case 'wood': { // pile of three log ends
        const log = (x, y, r) => {
          circle(x, y, r + 1.8); g.fillStyle = OL; g.fill();
          circle(x, y, r); g.fillStyle = '#6e3f1c'; g.fill();
          const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, 1, x, y, r * 0.8); gr.addColorStop(0, '#f8d9a2'); gr.addColorStop(1, '#cf9450');
          circle(x, y, r * 0.74); g.fillStyle = gr; g.fill();
          g.strokeStyle = 'rgba(138,80,34,0.9)'; g.lineWidth = 1.6;
          for (const k of [0.5, 0.25]) { circle(x, y, r * k); g.stroke(); }
        };
        log(19, 45, 12.5); log(45, 45, 12.5); log(32, 22, 12.5);
        break;
      }
      case 'coin': { // two gold coins with an embossed star
        const coin = (x, y, r) => {
          circle(x, y, r + 1.9); g.fillStyle = '#3b2505'; g.fill();
          const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
          gr.addColorStop(0, '#fff7c0'); gr.addColorStop(0.45, '#f5c736'); gr.addColorStop(1, '#ad770b');
          circle(x, y, r); g.fillStyle = gr; g.fill();
          g.strokeStyle = 'rgba(150,98,8,0.95)'; g.lineWidth = 1.9; circle(x, y, r * 0.78); g.stroke();
          g.fillStyle = 'rgba(158,102,6,0.95)'; g.beginPath();
          for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5, rr = i % 2 ? r * 0.22 : r * 0.52; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,252,225,0.75)'; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, r * 0.9, PI * 1.05, PI * 1.45); g.stroke();
        };
        coin(41, 22, 15); coin(26, 38, 19);
        break;
      }
      case 'stone': { // stack of three cut blocks
        const block = (x, y, w, h, d) => {
          const dy = d * 0.62;
          g.lineWidth = 2.6; g.strokeStyle = '#25231f';
          P([x, y, x + d, y - dy, x + w + d, y - dy, x + w, y]); g.fillStyle = '#e6e2d8'; g.fill(); g.stroke();
          P([x + w, y, x + w + d, y - dy, x + w + d, y + h - dy, x + w, y + h]); g.fillStyle = '#7d786e'; g.fill(); g.stroke();
          const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#bdb8ad'); gr.addColorStop(1, '#98938a');
          g.beginPath(); g.rect(x, y, w, h); g.fillStyle = gr; g.fill(); g.stroke();
          g.strokeStyle = 'rgba(64,60,54,0.6)'; g.lineWidth = 1.5; g.beginPath();
          g.moveTo(x + w * 0.22, y + h * 0.32); g.lineTo(x + w * 0.42, y + h * 0.58); g.moveTo(x + w * 0.62, y + h * 0.28); g.lineTo(x + w * 0.7, y + h * 0.74); g.stroke();
        };
        block(5, 37, 23, 16, 7); block(30, 37, 23, 16, 7); block(17.5, 20, 23, 16, 7);
        break;
      }
      case 'pop': { // two settlers
        const person = (x, y, s, fill) => {
          const body = (o) => { g.beginPath(); g.moveTo(x - 13 * s - o, y + 15 * s + o * 0.8); g.quadraticCurveTo(x - 12 * s - o, y - 3 * s - o, x, y - 3 * s - o); g.quadraticCurveTo(x + 12 * s + o, y - 3 * s - o, x + 13 * s + o, y + 15 * s + o * 0.8); g.closePath(); };
          g.fillStyle = '#1d170f'; circle(x, y - 13 * s, 7.6 * s + 1.9); g.fill(); body(1.9); g.fill();
          g.fillStyle = fill; circle(x, y - 13 * s, 7.6 * s); g.fill(); body(0); g.fill();
        };
        person(42, 30, 0.85, '#b5a57f'); person(25, 36, 1, '#f0e5c8');
        break;
      }
      case 'xp': { // gold star
        const st = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5, r = i % 2 ? 11.5 : 26; st.push(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
        P(st); g.lineWidth = 5; g.strokeStyle = '#2d1d05'; g.stroke();
        const gr = g.createRadialGradient(27, 24, 2, 32, 34, 28); gr.addColorStop(0, '#fff4b4'); gr.addColorStop(0.5, '#f3c43a'); gr.addColorStop(1, '#b37c0c');
        P(st); g.fillStyle = gr; g.fill();
        break;
      }
      case 'villager': case 'villagerMuted': {
        g.fillStyle = name === 'villagerMuted' ? '#b3ab95' : col;
        circle(32, 17, 11); g.fill();
        g.beginPath(); g.moveTo(12, 62); g.quadraticCurveTo(12, 31, 32, 30); g.quadraticCurveTo(52, 31, 52, 62); g.closePath(); g.fill();
        break;
      }
      case 'shield': P([32, 6, 54, 14, 52, 36, 32, 58, 12, 36, 10, 14]); g.fill(); g.fillStyle = dark; P([32, 14, 46, 19, 44, 34, 32, 49, 32, 14]); g.fill(); break;
      case 'sword':
        g.save(); g.translate(32, 32); g.rotate(-PI / 4);
        g.fillRect(-3.5, -26, 7, 38); P([-3.5, -26, 0, -32, 3.5, -26]); g.fill(); g.fillRect(-12, 12, 24, 5); g.fillRect(-3, 17, 6, 10); g.beginPath(); g.arc(0, 29, 4, 0, TAU); g.fill();
        g.restore(); break;
      case 'swords':
        for (const s of [-1, 1]) { g.save(); g.translate(32, 32); g.rotate(s * PI / 4); g.fillRect(-3, -27, 6, 36); P([-3, -27, 0, -32, 3, -27]); g.fill(); g.fillRect(-10, 9, 20, 4); g.fillRect(-2.5, 13, 5, 9); g.restore(); }
        break;
      case 'cannon':
        g.save(); g.translate(30, 34); g.rotate(-0.35); g.fillRect(-6, -7, 32, 14); g.beginPath(); g.arc(-6, 0, 7, 0, TAU); g.fill(); g.restore();
        g.beginPath(); g.arc(22, 44, 12, 0, TAU); g.fill(); g.fillStyle = dark; g.beginPath(); g.arc(22, 44, 5, 0, TAU); g.fill();
        break;
      case 'heart': g.fillRect(26, 10, 12, 44); g.fillRect(10, 26, 44, 12); break;
      case 'flag': g.fillRect(14, 8, 5, 50); P([19, 10, 52, 14, 42, 24, 52, 34, 19, 32]); g.fill(); break;
      case 'rank1': case 'rank2': case 'rank3': {
        const n = +name[4];
        for (let i = 0; i < n; i++) { const y = 44 - i * 12; g.lineWidth = 6; g.beginPath(); g.moveTo(12, y); g.lineTo(32, y - 12); g.lineTo(52, y); g.stroke(); }
        break;
      }
      case 'stop': P([22, 6, 42, 6, 58, 22, 58, 42, 42, 58, 22, 58, 6, 42, 6, 22]); g.fill(); g.fillStyle = dark; g.fillRect(18, 28, 28, 8); break;
      case 'bell': g.beginPath(); g.moveTo(14, 46); g.quadraticCurveTo(16, 14, 32, 12); g.quadraticCurveTo(48, 14, 50, 46); g.closePath(); g.fill(); g.fillRect(10, 44, 44, 6); g.beginPath(); g.arc(32, 54, 5, 0, TAU); g.fill(); g.fillRect(29, 6, 6, 8); break;
      case 'bellOff': this.draw(g, 'bell', col, dark); g.strokeStyle = '#d8573f'; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 10); g.lineTo(54, 54); g.stroke(); break;
      case 'up': P([32, 8, 54, 32, 41, 32, 41, 56, 23, 56, 23, 32, 10, 32]); g.fill(); break;
      case 'down': P([32, 56, 54, 32, 41, 32, 41, 8, 23, 8, 23, 32, 10, 32]); g.fill(); break;
      case 'ship': { // home-city galleon in colour
        P([5, 39, 59, 39, 51, 55, 13, 55]); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); g.fillStyle = '#8a552a'; g.fill();
        g.fillStyle = '#5c3617'; g.fillRect(9, 44, 46, 3);
        g.fillStyle = OL; g.fillRect(30, 5, 4, 35);
        for (const s of [[34, 9, 53, 33, 34, 33], [30, 13, 12, 33, 30, 33]]) { P(s); g.lineWidth = 4; g.strokeStyle = OL; g.stroke(); g.fillStyle = '#f2e8cc'; g.fill(); }
        P([34, 4, 47, 7.5, 34, 11]); g.fillStyle = '#c8352b'; g.fill();
        break;
      }
      case 'trade': g.beginPath(); g.arc(32, 32, 22, 0, TAU); g.lineWidth = 5; g.stroke(); P([32, 14, 38, 22, 26, 22]); g.fill(); P([32, 50, 38, 42, 26, 42]); g.fill(); break;
      case 'delete': g.lineWidth = 8; g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.moveTo(50, 14); g.lineTo(14, 50); g.stroke(); break;
      case 'eye': g.beginPath(); g.ellipse(32, 32, 24, 14, 0, 0, TAU); g.fill(); g.fillStyle = dark; g.beginPath(); g.arc(32, 32, 8, 0, TAU); g.fill(); break;
      default: g.beginPath(); g.arc(32, 32, 20, 0, TAU); g.fill();
    }
  },
  // composite: base icon dataURL + badge glyph
  compose(baseKey, glyph, text) {
    const key = 'c:' + baseKey + '|' + glyph + '|' + (text || '');
    if (this.cache[key]) return this.cache[key];
    const base = ICONS[baseKey];
    const S = 112, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const finish = () => {
      if (glyph || text) {
        g.fillStyle = 'rgba(12,16,22,0.88)'; g.strokeStyle = '#c9a24a'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(S - 26, S - 26, 22, 0, TAU); g.fill(); g.stroke();
        if (glyph) { g.save(); g.translate(S - 44, S - 44); g.scale(36 / 64, 36 / 64); this.draw(g, glyph); g.restore(); }
        if (text) { g.fillStyle = '#e9c977'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, S - 26, S - 25); }
      }
      this.cache[key] = cv.toDataURL();
    };
    if (base) {
      const img = new Image();
      img.src = base;
      if (img.complete) { g.drawImage(img, 0, 0, S, S); finish(); }
      else { this.cache[key] = base; img.onload = () => { g.drawImage(img, 0, 0, S, S); finish(); UI.cmdDirty = true; }; return base; }
    } else finish();
    return this.cache[key];
  },
  // market button: big resource pictogram, coloured arrow and a КУПИТЬ / ПРОДАТЬ caption
  tradeIcon(r, kind) {
    const key = 't:' + r + ':' + kind;
    if (this.cache[key]) return this.cache[key];
    const S = 112, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#26343f'); bg.addColorStop(1, '#131b23');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    g.save(); g.translate(14, 4); g.scale(68 / 64, 68 / 64); this.draw(g, r); g.restore();
    const buy = kind === 'buy', ac = buy ? '#6fd05a' : '#f06a52';
    g.save(); g.translate(76, 6); g.scale(30 / 64, 30 / 64);
    g.fillStyle = ac; g.strokeStyle = '#0b0f13'; g.lineWidth = 7; g.lineJoin = 'round';
    g.beginPath();
    const pts = buy ? [32, 4, 60, 34, 43, 34, 43, 60, 21, 60, 21, 34, 4, 34] : [32, 60, 60, 30, 43, 30, 43, 4, 21, 4, 21, 30, 4, 30];
    g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath();
    g.stroke(); g.fill(); g.restore();
    g.fillStyle = 'rgba(6,9,12,0.82)'; g.fillRect(0, 80, S, 32);
    g.fillStyle = ac; g.font = '800 21px "Alegreya Sans", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(buy ? 'КУПИТЬ' : 'ПРОДАТЬ', S / 2, 97);
    return (this.cache[key] = cv.toDataURL());
  },
};

const UI = {
  game: null, speed: 1, paused: false, edgeScroll: true, targetMode: null, cmdDirty: true, selDirty: true,
  cmds: [], floats: [], pings: [], miniT: 0, selT: 0, resT: 0, lastCmdSig: '', toastList: [],
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), topbar: $('topbar'), bottom: $('bottom'), resbar: $('resbar'), agebox: $('agebox'), status: $('status-right'),
      food: $('r-food'), wood: $('r-wood'), coin: $('r-coin'), stone: $('r-stone'), pop: $('r-pop'), ageNum: $('age-num'), ageName: $('age-name'), ageProg: $('age-prog'),
      home: $('btn-home'), homeBadge: $('home-badge'), xpFill: $('xp-fill'), xpText: $('xp-text'), clock: $('clock'), menuBtn: $('btn-menu'), speedTag: $('speed-tag'),
      sel: $('sel'), cmds: $('cmds'), tooltip: $('tooltip'), toasts: $('toasts'), mini: $('minimap'), idleBtn: $('btn-idle'), alertBtn: $('btn-alert'),
      ov: $('ov'), banner: $('banner'),
      mHome: $('modal-home'), mAge: $('modal-age'), mPause: $('modal-pause'), mHelp: $('modal-help'), mEnd: $('modal-end'),
    };
    this.ovCtx = this.el.ov.getContext('2d');
    this.miniCtx = this.el.mini.getContext('2d');
    // resource counters: pictogram + caption + gatherers; hover explains where it comes from
    for (const id of ['food', 'wood', 'coin', 'stone', 'pop']) {
      const el = this.el[id];
      const img = el.querySelector('img'); if (img) img.src = Glyph.get(id, 56);
      el.addEventListener('mouseenter', () => this.showResTip(id, el));
      el.addEventListener('mouseleave', () => this.hideTip());
    }
    try {
      const rs = document.documentElement.style;
      rs.setProperty('--vill-ico', 'url("' + Glyph.get('villagerMuted', 24) + '")');
      rs.setProperty('--bell-ico', 'url("' + Glyph.get('bell', 32) + '")');
    } catch (e) { /* ignore */ }
    $('xp-ico').src = Glyph.get('ship', 56);
    this.setHudLayout(this.loadLayout());
    this.watchVisibleArea();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.measureHud()).observe(this.el.bottom);
    // command grid
    this.el.cmds.innerHTML = '';
    for (let i = 0; i < 15; i++) {
      const b = document.createElement('button');
      b.className = 'cmd'; b.type = 'button'; b.dataset.i = i;
      b.innerHTML = '<img alt=""><span class="hk"></span><span class="qn"></span><span class="prog"></span>';
      b.addEventListener('click', (e) => { e.stopPropagation(); Sfx.init(); this.pressCommand(i, true); });
      b.addEventListener('mouseenter', () => this.showTip(i, b));
      b.addEventListener('mouseleave', () => this.hideTip());
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.pressCommand(i, true, true); });
      this.el.cmds.appendChild(b);
    }
    this.el.home.addEventListener('click', () => { Sfx.init(); this.openHomeCity(); });
    this.el.menuBtn.addEventListener('click', () => { Sfx.init(); this.togglePause(); });
    this.el.idleBtn.addEventListener('click', () => Input.selectIdleVillager());
    this.el.alertBtn.addEventListener('click', () => { if (Input.alertPos) Cam.jump(Input.alertPos.x, Input.alertPos.z); });
    // minimap interaction
    const mm = this.el.mini;
    const toWorld = (e) => {
      const r = mm.getBoundingClientRect(), g = this.game;
      return { x: clamp(((e.clientX - r.left) / r.width) * g.size, 0, g.size), z: clamp(((e.clientY - r.top) / r.height) * g.size, 0, g.size) };
    };
    mm.addEventListener('mousedown', (e) => {
      if (!this.game) return;
      e.preventDefault();
      const w = toWorld(e);
      if (e.button === 0) { Cam.jump(w.x, w.z, true); this.miniDrag = true; }
      else if (e.button === 2) {
        const us = Input.selUnits();
        if (us.length) { this.game.orderMove(us, w.x, w.z, e.ctrlKey); RS.addMarker(w.x, w.z, 'move'); Sfx.play('command'); }
        else for (const b of Input.selBuildings()) b.rally = { x: w.x, z: w.z };
      }
    });
    window.addEventListener('mousemove', (e) => { if (this.miniDrag) { const w = toWorld(e); Cam.jump(w.x, w.z, true); } });
    window.addEventListener('mouseup', () => { this.miniDrag = false; });
    mm.addEventListener('contextmenu', (e) => e.preventDefault());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModals()));
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ov = this.el.ov;
    ov.width = Math.round(window.innerWidth * dpr); ov.height = Math.round(window.innerHeight * dpr);
    ov.style.width = window.innerWidth + 'px'; ov.style.height = window.innerHeight + 'px';
    this.ovDpr = dpr;
    this.measureHud();
  },

  // ---------------------------------------------------------------- HUD placement
  // Default: everything at the bottom (resources beside the minimap). Option: classic top bar.
  loadLayout() { try { return localStorage.getItem('nw-hud') || 'bottom'; } catch (e) { return 'bottom'; } },
  setHudLayout(mode) {
    const el = this.el;
    this.hudMode = mode === 'top' ? 'top' : 'bottom';
    el.hud.classList.toggle('hud-top', this.hudMode === 'top');
    el.hud.classList.toggle('hud-bottom', this.hudMode === 'bottom');
    if (this.hudMode === 'top') el.topbar.append(el.resbar, el.agebox, el.status);
    else for (const n of [el.resbar, el.agebox, el.status]) el.bottom.insertBefore(n, el.sel);
    try { localStorage.setItem('nw-hud', this.hudMode); } catch (e) { /* storage unavailable */ }
    this.hideTip();
    this.measureHud();
  },
  measureHud() {
    const b = this.el.bottom; if (!b) return;
    const h = b.offsetHeight;
    if (h && h !== this._hudH) { this._hudH = h; document.documentElement.style.setProperty('--hud-h', h + 'px'); }
  },
  // If the page is shown in a frame that is taller than what is actually on screen, keep the HUD
  // inside the visible part (IntersectionObserver reports how much of the viewport is clipped).
  watchVisibleArea() {
    const probe = document.getElementById('vis-probe');
    if (!probe || typeof IntersectionObserver === 'undefined') return;
    const th = []; for (let i = 0; i <= 40; i++) th.push(i / 40);
    const root = document.documentElement;
    try {
      new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        const br = e.boundingClientRect, ir = e.intersectionRect;
        let top = 0, bot = 0;
        if (e.isIntersecting && ir && ir.height > 160 && br.height > 0) {
          top = Math.max(0, ir.top - br.top); bot = Math.max(0, br.bottom - ir.bottom);
          if (top + bot > br.height - 240) { top = 0; bot = 0; }
        }
        root.style.setProperty('--clip-top', Math.round(top) + 'px');
        root.style.setProperty('--clip-bottom', Math.round(bot) + 'px');
      }, { threshold: th }).observe(probe);
    } catch (err) { /* not supported */ }
  },

  attach(game) {
    this.game = game;
    this.floats = []; this.pings = []; this.cmdDirty = true; this.selDirty = true; this.lastCmdSig = '';
    this.advSeen = {}; this.advLast = -99; this.idleSince = -1; this.shipSince = -1;
    this.incHist = []; this.incT = 0; this.gathT = 0; this.lastSelHtml = '';
    const N = game.N;
    // minimap base layers
    this.miniBase = document.createElement('canvas'); this.miniBase.width = this.miniBase.height = N;
    const bctx = this.miniBase.getContext('2d'), id = bctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { id.data[i * 4] = game.map.mini[i * 3]; id.data[i * 4 + 1] = game.map.mini[i * 3 + 1]; id.data[i * 4 + 2] = game.map.mini[i * 3 + 2]; id.data[i * 4 + 3] = 255; }
    bctx.putImageData(id, 0, 0);
    // route line on the base
    bctx.strokeStyle = 'rgba(232,212,160,0.75)'; bctx.lineWidth = 1.2; bctx.beginPath();
    game.map.route.pts.forEach((p, i) => { const x = p.x / CELL, z = p.z / CELL; if (i) bctx.lineTo(x, z); else bctx.moveTo(x, z); });
    bctx.stroke();
    this.miniFog = document.createElement('canvas'); this.miniFog.width = this.miniFog.height = N;
    this.miniFogCtx = this.miniFog.getContext('2d'); this.miniFogData = this.miniFogCtx.createImageData(N, N);
    if (this.boundGame !== game) {
      this.boundGame = game;
      game.on('attacked', (owner, x, z, bld) => {
        if (owner !== game.viewer) return;
        Input.alertPos = { x, z };
        this.pings.push({ x, z, t: 0 });
        this.toast(bld ? 'Наши здания атакуют!' : 'Наши войска атакованы!', true);
        Sfx.play('alarm');
        this.el.alertBtn.classList.add('on'); clearTimeout(this.alertTO); this.alertTO = setTimeout(() => this.el.alertBtn.classList.remove('on'), 8000);
      });
      game.on('shipmentReady', (p) => { if (p.index === game.viewer) { this.toast('Доступна поставка из Метрополии'); Sfx.play('trained'); this.el.home.classList.add('ready'); } });
      game.on('shipmentSent', (p, c) => { if (p.index === game.viewer) this.toast('Корабль отплыл: ' + c.name); });
      game.on('shipmentArrived', (p, c) => {
        if (p.index === game.viewer) { this.toast('Прибыла поставка: ' + c.name + ' (' + c.desc + ')'); Sfx.play('shipment'); const tc = game.buildings.find((b) => b.alive && b.owner === p.index && b.key === 'tc'); if (tc) this.floats.push({ x: tc.x, z: tc.z, y: 10, text: c.desc, color: '#e9c977', t: 0 }); }
      });
      game.on('agingStarted', (p) => { if (p.index === game.viewer) { this.toast('Начат переход: ' + AGES[p.aging.to].name); this.cmdDirty = true; } });
      game.on('ageUp', (p, to, pol) => {
        if (p.index === game.viewer) { this.banner(AGES[to].name, 'Политик: ' + pol.name + ' — ' + pol.desc); Sfx.play('ageup'); this.cmdDirty = true; }
        else if (game.players[game.viewer].alive) this.toast(p.name + ' переходит в ' + AGES[to].name.toLowerCase().replace('эпоха', 'эпоху'));
      });
      game.on('trained', (b, key) => { if (b.owner === game.viewer) Sfx.play('trained', b.x, b.z, 0.5); });
      game.on('built', (b) => { if (b.owner === game.viewer) { Sfx.play('buildDone', b.x, b.z, 0.8); if (Input.selection.includes(b)) this.cmdDirty = this.selDirty = true; } });
      game.on('researched', (p, key) => { if (p.index === game.viewer) { this.toast('Изучено: ' + TECHS[key].name); Sfx.play('trained'); this.cmdDirty = true; } });
      game.on('treasure', (p, t, text) => { if (p.index === game.viewer) { this.floats.push({ x: t.x, z: t.z, y: 2.5, text, color: '#e9c977', t: 0 }); Sfx.play('treasure', t.x, t.z, 1); } });
      game.on('float', (x, z, text, color, owner) => { if (owner === undefined || owner === game.viewer) this.floats.push({ x, z, y: 6, text, color, t: 0 }); });
      game.on('message', (owner, msg) => { if (owner === game.viewer) this.toast(msg, true); });
      game.on('ko', (u) => { if (u.owner === game.viewer) this.toast('Исследователь без сознания. Выкуп — в городском центре', true); });
      game.on('revived', (u) => { if (u.owner === game.viewer) this.toast('Исследователь снова в строю'); });
      game.on('defeated', (p) => {
        if (p.index === game.viewer) { if (!game.over) this.showEnd(-1); }
        else this.toast(p.name + ' (' + p.civ.name + ') повержен');
      });
      game.on('gameOver', (team) => { if (team === game.players[game.viewer].team || game.players[game.viewer].alive) this.showEnd(team); else if (this.el.mEnd.hidden) this.toast('Партия окончена'); });
      game.on('buildingDestroyed', (b) => { if (Input.selection.includes(b)) this.selDirty = this.cmdDirty = true; });
    }
    this.el.hud.hidden = false;
    requestAnimationFrame(() => this.measureHud());
  },

  // ---------------------------------------------------------------- resource panel helpers
  gatherBreakdown() {
    const g = this.game, me = g.viewer;
    const out = { food: { total: 0, k: {} }, wood: { total: 0, k: {} }, coin: { total: 0, k: {} }, stone: { total: 0, k: {} }, builders: 0, idle: 0 };
    const KN = { tree: 'лес', mine: 'рудник', quarry: 'каменоломня', bush: 'ягоды', carcass: 'охота', crate: 'ящики' };
    for (const u of g.units) {
      if (!u.alive || u.owner !== me || u.garrisoned || !u.def.tags.has('villager')) continue;
      const o = u.order;
      if (!o) { out.idle++; continue; }
      if (o.type === 'build') { out.builders++; continue; }
      if (o.type !== 'gather') continue;
      const t = o.target;
      let r, k;
      if (t.kind === 'unit') { r = 'food'; k = 'охота'; }
      else if (t.kind === 'building') { r = t.def.gather; k = t.key === 'mill' ? 'мельница' : 'плантация'; }
      else { r = t.res; k = KN[t.rkind] || ''; }
      const b = out[r]; if (!b) continue;
      b.total++; b.k[k] = (b.k[k] || 0) + 1;
    }
    for (const r of RES) out[r].parts = Object.entries(out[r].k).map(([k, n]) => k + ' ' + n);
    return out;
  },
  incomeOf(r) {
    const H = this.incHist; if (!H || H.length < 3) return null;
    const last = H[H.length - 1];
    let first = H[0];
    for (const h of H) if (last.t - h.t <= 62) { first = h; break; }
    const dt = last.t - first.t;
    if (dt < 5) return null;
    return Math.round(((last.v[r] - first.v[r]) / dt) * 60);
  },
  showResTip(r, el) {
    const g = this.game; if (!g) return;
    const p = g.players[g.viewer], tip = this.el.tooltip;
    this.tipIdx = undefined; this.resTipFor = r; this.resTipEl = el;
    let html;
    if (r === 'pop') {
      const pu = p.popUsed(), pc = p.popCap();
      let v = 0, mil = 0;
      for (const u of g.units) if (u.alive && u.owner === g.viewer) { if (u.def.tags.has('villager')) v++; else if (u.isMilitary) mil += u.def.pop || 0; }
      html = '<h4><span class="tt-res"><img src="' + Glyph.get('pop', 32) + '" alt="">Население</span></h4>'
        + '<div class="cost"><span>' + pu + ' / ' + pc + '</span><span class="t">предел 200</span></div>'
        + '<p class="stats-line">Поселенцы: ' + v + ' · войска: ' + mil + '</p>'
        + '<p>Каждый дом даёт +10 к населению. Когда места нет, обучение останавливается.</p>';
    } else {
      const b = this.gatherBreakdown()[r], inc = this.incomeOf(r);
      html = '<h4><span class="tt-res"><img src="' + Glyph.get(r, 32) + '" alt="">' + RES_TITLE[r] + '</span></h4>'
        + '<div class="cost"><span>Запас: ' + fmtNum(p.res[r]) + '</span>' + (inc !== null ? '<span class="t">≈ +' + fmtNum(Math.max(0, inc)) + ' в минуту</span>' : '') + '</div>'
        + '<p class="stats-line">Добывают: ' + b.total + ' ' + plural(b.total, ['поселенец', 'поселенца', 'поселенцев']) + (b.parts.length ? ' (' + b.parts.join(', ') + ')' : '') + '</p>'
        + '<p class="hint">Где взять: ' + RES_HELP[r].from + '.</p>'
        + '<p>Нужен для: ' + RES_HELP[r].use + '.</p>';
      if (PRICE_BASE[r] && g.buildings.some((x) => x.alive && x.built && x.owner === g.viewer && x.key === 'market')) html += '<p class="stats-line">Рынок: купить 100 за ' + Math.round(p.prices[r]) + ', продать за ' + g.sellPrice(p, r) + ' монет</p>';
    }
    tip.innerHTML = html;
    tip.hidden = false;
    const rc = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    if (this.hudMode === 'top') {
      tip.style.left = clamp(rc.left, 8, window.innerWidth - tw - 8) + 'px';
      tip.style.top = Math.min(window.innerHeight - th - 8, rc.bottom + 8) + 'px';
    } else {
      tip.style.left = clamp(rc.right + 12, 8, window.innerWidth - tw - 8) + 'px';
      tip.style.top = clamp(rc.top + rc.height / 2 - th / 2, 8, window.innerHeight - th - 8) + 'px';
    }
  },
  marketDo(p, action, r) {
    const err = this.game.cmdMarket(p, action, r);
    if (err) { this.toast(err, true); Sfx.play('error'); } else { Sfx.play('click'); this.selDirty = true; }
  },

  // ---------------------------------------------------------------- advisor hints
  advisorOn: true, advT: 0, advLast: -99, advSeen: {}, idleSince: -1, shipSince: -1,
  advisor(dt) {
    const g = this.game; if (!g || !this.advisorOn || g.over) return;
    this.advT -= dt; if (this.advT > 0) return; this.advT = 1;
    const p = g.players[g.viewer]; if (!p.alive) return;
    const now = g.time;
    const say = (key, cd, text) => {
      if (now - this.advLast < 14) return false;
      if (this.advSeen[key] !== undefined && (cd < 0 || now - this.advSeen[key] < cd)) return false;
      this.advSeen[key] = now; this.advLast = now;
      this.toast(text, false, true);
      return true;
    };
    if (now > 3) say('intro', -1, 'Совет: выделите поселенцев рамкой и щёлкните ПКМ по ящикам у центра, ягодам или деревьям.');
    const vills = g.units.filter((x) => x.alive && x.owner === g.viewer && x.def.tags.has('villager'));
    const idle = vills.filter((x) => !x.order && !x.garrisoned).length;
    if (idle > 0) { if (this.idleSince < 0) this.idleSince = now; } else this.idleSince = -1;
    if (this.idleSince >= 0 && now - this.idleSince > 14) say('idle', 70, 'Есть свободные поселенцы: нажмите «.» или кнопку «Свободные» у миникарты.');
    const housing = g.buildings.some((b) => b.alive && !b.built && b.owner === g.viewer && b.key === 'house');
    if (p.popCap() < 200 && p.popUsed() >= p.popCap() - 1 && !housing) say('house', 50, 'Население упёрлось в предел — постройте дом: выберите поселенца и нажмите Q.');
    if (p.shipments > 0 && !p.inTransit) { if (this.shipSince < 0) this.shipSince = now; } else this.shipSince = -1;
    if (this.shipSince >= 0 && now - this.shipSince > 18) say('ship', 75, 'Поставка из Метрополии ждёт отправки — нажмите Tab.');
    if (p.age < 5 && !p.aging && p.canAfford(AGES[p.age + 1].cost)) say('age' + p.age, -1, 'Хватает ресурсов на ' + AGES[p.age + 1].name.toLowerCase().replace('эпоха', 'эпоху') + ': H — городской центр, затем W.');
    if (p.age >= 2 && now - (p.stats.ageTimes[2] || now) > 50 && !g.buildings.some((b) => b.alive && b.owner === g.viewer && b.key === 'barracks')) say('barracks', 150, 'Для армии нужны казармы и конюшня — постройте их поселенцами (A, S).');
    if (p.age >= 2 && now - (p.stats.ageTimes[2] || now) > 100 && p.res.stone < 150 && p.stats.gathered.stone < 60) say('stone', 300, 'Камень добывают в каменоломнях — серых скалах с тёсаными блоками. Он нужен для бастионов (X), церкви, арсенала и IV эпохи.');
    if (vills.length >= 12 && !g.buildings.some((b) => b.alive && b.owner === g.viewer && b.key === 'mill')) {
      const tc = p.tc && p.tc.alive ? p.tc : null;
      if (tc && !g.findNearestResource(['bush', 'carcass', 'crate'], tc.x, tc.z, 45, null, g.viewer)) say('mill', 150, 'Ягоды и охота поблизости кончаются — мельница (W) даёт еду бесконечно.');
    }
    const ex = p.explorer;
    if (ex && ex.alive && !ex.ko && !ex.order && now > 40) say('explorer', 200, 'Исследователь скучает: отправьте его за сокровищами (ПКМ по сундуку) или на разведку.');
  },

  // ---------------------------------------------------------------- toasts & banner
  toast(msg, bad, advisor) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '') + (advisor ? ' adv' : '');
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, 3800);
  },
  banner(title, sub) {
    const b = this.el.banner;
    b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub || '';
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerTO); this.bannerTO = setTimeout(() => { b.hidden = true; }, 4200);
  },

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game; if (!g) return;
    const p = g.players[g.viewer];
    this.resT -= dt;
    if (this.resT <= 0) {
      this.resT = 0.15;
      for (const r of RES) this.setTxt(this.el[r], fmtNum(p.res[r]));
      const pu = p.popUsed(), pc = p.popCap();
      this.setTxt(this.el.pop, pu + ' / ' + pc);
      this.el.pop.classList.toggle('full', pu >= pc && pc < 200);
      this.gathT -= 0.15;
      if (this.gathT <= 0) {
        this.gathT = 0.6;
        const b = this.gatherBreakdown();
        for (const r of RES) { const em = this.el[r].querySelector('em'); const t = String(b[r].total); if (em && em.textContent !== t) em.textContent = t; }
        const em = this.el.pop.querySelector('em'); if (em) { const t = b.idle ? String(b.idle) : ''; if (em.textContent !== t) { em.textContent = t; em.title = b.idle ? 'Свободных поселенцев: ' + b.idle : ''; } }
        if (this.resTipFor && !this.el.tooltip.hidden && this.tipIdx === undefined) this.showResTip(this.resTipFor, this.resTipEl);
      }
      this.incT -= 0.15;
      if (this.incT <= 0) { this.incT = 2; this.incHist.push({ t: g.time, v: Object.assign({}, p.stats.gathered) }); if (this.incHist.length > 40) this.incHist.shift(); }
      const xpT = p.inTransit ? 'корабль в пути' : 'опыт ' + Math.floor(p.xp) + ' / ' + p.shipNeed;
      if (this.el.xpText.textContent !== xpT) this.el.xpText.textContent = xpT;
      this.el.ageNum.textContent = AGES[p.age].num;
      this.el.ageName.textContent = p.aging ? 'Переход: ' + AGES[p.aging.to].name : AGES[p.age].name;
      this.el.ageProg.style.width = p.aging ? (100 * p.aging.t / p.aging.total).toFixed(1) + '%' : '0%';
      this.el.homeBadge.textContent = p.inTransit ? '⛵' : p.shipments;
      this.el.home.classList.toggle('ready', p.shipments > 0 && !p.inTransit);
      this.el.xpFill.style.width = p.inTransit ? (100 * p.inTransit.t / p.inTransit.total).toFixed(1) + '%' : (100 * p.xp / p.shipNeed).toFixed(1) + '%';
      this.el.xpFill.classList.toggle('transit', !!p.inTransit);
      this.el.clock.textContent = fmtTime(g.time);
      this.el.speedTag.textContent = this.speed !== 1 ? '×' + this.speed : '';
      const idle = g.units.reduce((a, u) => a + (u.alive && u.owner === g.viewer && u.def.tags.has('villager') && !u.order && !u.garrisoned ? 1 : 0), 0);
      this.el.idleBtn.querySelector('b').textContent = idle;
      this.el.idleBtn.classList.toggle('on', idle > 0);
    }
    this.selT -= dt;
    if (this.selDirty || this.selT <= 0) { this.selT = 0.25; this.renderSelection(); this.selDirty = false; }
    const sig = this.commandSignature();
    if (this.cmdDirty || sig !== this.lastCmdSig) { this.lastCmdSig = sig; this.cmdDirty = false; this.buildCommands(); }
    else this.refreshCommandStates();
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.2; this.drawMinimap(); }
    this.drawOverlay(dt);
    this.advisor(dt);
  },
  setTxt(el, t) { const b = el.querySelector('b'); if (b && b.textContent !== t) b.textContent = t; },
  selectionChanged() {
    this.selDirty = true; this.targetMode = null; this.updateCursor();
    if (this.game) { this.lastCmdSig = this.commandSignature(); this.cmdDirty = false; this.buildCommands(); }
  },

  // ---------------------------------------------------------------- selection panel
  renderSelection() {
    const g = this.game, sel = Input.selection, el = this.el.sel;
    el.hidden = !sel.length;
    if (!sel.length) { el.innerHTML = ''; this.lastSelHtml = ''; return; }
    if (sel.length === 1) {
      const e = sel[0];
      const html = this.singleHtml(e);
      if (html === this.lastSelHtml && this.lastSelEnt === e) return; // unchanged: keep the DOM (and clicks) stable
      this.lastSelHtml = html; this.lastSelEnt = e;
      el.innerHTML = html;
      el.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => { g.cmdCancel(e, +b.dataset.cancel); Sfx.play('click'); this.selDirty = true; }));
      el.querySelectorAll('[data-trade]').forEach((b) => b.addEventListener('click', () => { g.players[e.owner].tradeMode = b.dataset.trade; this.selDirty = true; }));
      el.querySelectorAll('[data-mk]').forEach((b) => b.addEventListener('click', () => { const [a, r] = b.dataset.mk.split(':'); this.marketDo(g.players[e.owner], a, r); }));
      return;
    }
    this.lastSelHtml = ''; this.lastSelEnt = null;
    // group
    const groups = new Map();
    for (const e of sel) { const k = e.kind + ':' + (e.key || e.rkind); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
    let html = '<div class="sel-multi"><div class="sel-count">' + sel.length + ' ' + plural(sel.length, ['объект', 'объекта', 'объектов']) + '</div><div class="sel-grid">';
    for (const [k, list] of groups) {
      const e = list[0];
      const icon = e.kind === 'unit' ? ICONS['u:' + e.key] : e.kind === 'building' ? ICONS['b:' + e.key] : '';
      const hp = list.reduce((a, x) => a + x.hp / x.maxHp, 0) / list.length;
      html += '<button class="sel-tile" data-group="' + k + '" title="' + (e.name || '') + '"><img src="' + (icon || '') + '" alt=""><span class="n">' + list.length + '</span><span class="hpb"><i style="width:' + (hp * 100).toFixed(0) + '%;background:' + this.hpColor(hp) + '"></i></span></button>';
    }
    html += '</div></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', (ev) => {
      const list = groups.get(b.dataset.group);
      if (ev.shiftKey) Input.setSelection(Input.selection.filter((x) => !list.includes(x)));
      else Input.setSelection(list);
    }));
  },
  hpColor(f) { return f > 0.6 ? '#6fbf5a' : f > 0.3 ? '#d8b23f' : '#cf4b3a'; },
  activity(u) {
    const o = u.order;
    if (u.ko) return 'Без сознания';
    if (u.garrisoned) return 'В укрытии';
    if (!o) return 'Ожидает приказа';
    switch (o.type) {
      case 'move': return o.attackMove ? 'Наступает' : 'В пути';
      case 'attack': return 'Атакует: ' + (o.target.name || '');
      case 'gather': {
        const t = o.target;
        if (t.kind === 'unit') return 'Охотится';
        if (t.kind === 'building') return t.key === 'mill' ? 'Работает на мельнице' : 'Работает на плантации';
        return { tree: 'Рубит лес', mine: 'Добывает серебро', quarry: 'Добывает камень', bush: 'Собирает ягоды', carcass: 'Разделывает тушу', crate: 'Разбирает ящик' }[t.rkind] || 'Собирает';
      }
      case 'build': return o.repair ? 'Чинит здание' : 'Строит: ' + o.target.name.toLowerCase();
      case 'treasure': return 'Идёт к сокровищу';
      case 'garrison': return 'Укрывается';
      case 'deploy': return 'Едет к месту постройки';
      default: return '';
    }
  },
  singleHtml(e) {
    const g = this.game;
    let icon = '', name = e.name || '', sub = '', body = '', hp = '';
    const ownerTag = (o) => o >= 0 ? '<span class="owner" style="--pc:' + hexToCss(g.players[o].color) + '">' + g.players[o].name + ' · ' + g.players[o].civ.name + '</span>' : '<span class="owner gaia">Дикая природа</span>';
    if (e.kind === 'unit') {
      icon = ICONS['u:' + e.key];
      const d = e.def;
      hp = this.hpBar(e.hp, e.maxHp);
      const p = e.player;
      const stats = [];
      if (d.ranged && !d.ranged.buildingsOnly) stats.push(['Выстрел', Math.round(d.ranged.dmg * (p ? p.dmgMul(d) : 1)) + ' · ' + Math.round(d.ranged.range + (p ? p.rangeAdd(d) : 0)) + ' м']);
      else if (d.ranged) stats.push(['Осада', Math.round(d.ranged.dmg * (p ? p.dmgMul(d) : 1)) + ' · ' + d.ranged.range + ' м']);
      if (d.melee) stats.push(['Ближний бой', String(Math.round(d.melee.dmg * (p ? p.dmgMul(d) : 1)))]);
      if (d.armor.ranged) stats.push(['Защита от пуль', Math.round(d.armor.ranged * 100) + '%']);
      if (d.armor.melee) stats.push(['Защита в рукопашной', Math.round(d.armor.melee * 100) + '%']);
      stats.push(['Скорость', (e.speed()).toFixed(1) + ' м/с']);
      if (d.bonus) { const bs = Object.entries(d.bonus).filter(([, v]) => v > 1).map(([k, v]) => '×' + v + ' ' + TAG_NAMES[k]); if (bs.length) stats.push(['Бонус', bs.join(', ')]); }
      sub = e.owner === g.viewer ? '<span class="act">' + this.activity(e) + '</span>' : ownerTag(e.owner);
      body = '<dl class="stats">' + stats.map(([a, b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join('') + '</dl>';
      if (d.desc) body += '<p class="desc">' + d.desc + '</p>';
    } else if (e.kind === 'building') {
      icon = ICONS['b:' + e.key];
      hp = this.hpBar(e.hp, e.maxHp);
      sub = e.owner === g.viewer ? '' : ownerTag(e.owner);
      if (!e.built) body += '<div class="progress"><span>Строительство</span><div class="bar"><i style="width:' + (e.progress * 100).toFixed(0) + '%"></i></div></div>';
      let qHtml = '';
      if (e.owner === g.viewer && e.queue.length) {
        qHtml = '<div class="queue">' + e.queue.map((q, i) => {
          const ic = q.kind === 'unit' ? ICONS['u:' + q.key] : this.techIcon(q.key);
          const pr = i === 0 && q.started !== false ? (q.t / q.total) : (q.kind === 'tech' && i === 0 ? q.t / q.total : 0);
          return '<button class="q" data-cancel="' + i + '" title="Отменить"><img src="' + ic + '" alt="">' + (q.count > 1 ? '<span class="n">' + q.count + '</span>' : '') + '<span class="qbar"><i style="width:' + (pr * 100).toFixed(0) + '%"></i></span>' + (q.blocked ? '<span class="warn">дома!</span>' : '') + '</button>';
        }).join('') + '</div>';
      }
      const isMarket = e.key === 'market' && e.owner === g.viewer && e.built;
      if (!isMarket) body += qHtml;
      if (e.def.garrison && e.owner === g.viewer) body += '<p class="note">В укрытии: ' + e.garrison.length + ' / ' + e.def.garrison + (e.garrison.length ? ' · дополнительные выстрелы' : '') + '</p>';
      if (e.def.gather && e.built) body += '<p class="note">Работников: ' + e.gatherers() + ' / ' + (e.slots ? e.slots.length : e.def.slots) + '</p>';
      if (e.key === 'tradingPost' && e.owner === g.viewer) {
        const m = g.players[e.owner].tradeMode;
        body += '<div class="seg"><span>Доход с обозов:</span><button data-trade="xp" class="' + (m === 'xp' ? 'on' : '') + '">Опыт</button><button data-trade="coin" class="' + (m === 'coin' ? 'on' : '') + '">Монеты</button></div>';
      }
      if (e.def.pop && e.built) body += '<p class="note">+' + e.def.pop + ' к населению</p>';
      if (isMarket) {
        // trade table (with the research queue beside it, if any)
        const pl = g.players[e.owner], ci = Glyph.get('coin', 32);
        body += '<div class="mk-row"><div class="trade' + (qHtml ? ' compact' : '') + '"><div class="thead">Торговля — по 100 единиц за монеты</div>' + ['food', 'wood', 'stone'].map((r) => {
          const bp = Math.round(pl.prices[r]), sp = g.sellPrice(pl, r);
          return '<div class="trow"><span class="tres" title="' + RES_TITLE[r] + '"><img src="' + Glyph.get(r, 32) + '" alt=""><span class="nm">' + RES_TITLE[r] + '</span></span>'
            + '<button type="button" data-mk="buy:' + r + '"' + (pl.res.coin < bp ? ' class="no"' : '') + ' title="Купить 100 ' + RES_NAME_GEN[r] + ' за ' + bp + ' монет">Купить <i>−' + bp + '<img src="' + ci + '" alt="монет"></i></button>'
            + '<button type="button" data-mk="sell:' + r + '"' + (pl.res[r] < 100 ? ' class="no"' : '') + ' title="Продать 100 ' + RES_NAME_GEN[r] + ' за ' + sp + ' монет">Продать <i>+' + sp + '<img src="' + ci + '" alt="монет"></i></button></div>';
        }).join('') + '</div>' + qHtml + '</div>';
      }
      if (e.key === 'tower' && e.built) body += '<p class="note">Пушка: ' + Math.round(e.def.attack.dmg * g.players[e.owner].mods.towerAtk) + ' урона по площади · дальность ' + e.def.attack.range + ' м</p>';
      if (!body) body = '<p class="desc">' + (e.def.desc || '') + '</p>';
    } else if (e.kind === 'res') {
      icon = e.rkind === 'crate' ? ICONS['r:crate_' + e.res] || ICONS['r:crate'] : ICONS['r:' + e.rkind] || (e.animal ? ICONS['u:' + e.animal.key] : '');
      sub = '<span class="owner gaia">Ресурс: ' + RES_NAME[e.res] + '</span>';
      body = '<p class="big-num"><img src="' + Glyph.get(e.res, 40) + '" alt="">' + fmtNum(e.amount) + ' <small>' + RES_NAME_GEN[e.res] + '</small></p>';
      if (e.rkind === 'quarry') body += '<p class="desc">Камень нужен для бастионов, церкви, арсенала, литейного двора и переходов в IV–V эпохи.</p>';
    } else if (e.kind === 'treasure') {
      icon = ICONS['r:treasure']; name = 'Сокровище';
      const r = e.reward;
      const what = r.res ? r.amount + ' ' + RES_NAME_GEN[r.res] : r.xp ? r.xp + ' опыта' : r.count + ' × ' + UNITS[r.unit].name.toLowerCase();
      const guards = e.guards.filter((u) => u.alive);
      body = '<p class="desc">Награда: <b>' + what + '</b></p><p class="note">' + (guards.length ? 'Охрана: ' + guards.map((u) => u.def.name.toLowerCase()).join(', ') : 'Охраны нет — заберите исследователем или войсками') + '</p>';
    }
    return '<div class="sel-single"><div class="portrait">' + (icon ? '<img src="' + icon + '" alt="">' : '') + '</div><div class="info"><h3>' + name + '</h3>' + hp + sub + body + '</div></div>';
  },
  hpBar(hp, max) {
    const f = clamp(hp / max, 0, 1);
    return '<div class="hp"><div class="bar"><i style="width:' + (f * 100).toFixed(1) + '%;background:' + this.hpColor(f) + '"></i></div><span>' + Math.ceil(Math.max(0, hp)) + ' / ' + max + '</span></div>';
  },
  techIcon(key) {
    const T = TECHS[key];
    return Glyph.compose('b:' + T.at, T.icon);
  },

  // ---------------------------------------------------------------- command card
  commandSignature() {
    const g = this.game, sel = Input.selection;
    const p = g.players[g.viewer];
    let s = p.age + '|' + (p.aging ? 1 : 0) + '|' + p.techs.size + '|' + p.researching.size + '|' + (p.explorer && p.explorer.ko ? 'ko' : '') + '|';
    for (const e of sel.slice(0, 6)) s += e.id + ':' + (e.built === false ? 'u' : '') + (e.garrison ? e.garrison.length : '') + ',';
    return s;
  },
  buildCommands() {
    const g = this.game, p = g.players[g.viewer];
    const cmds = new Array(15).fill(null);
    const sel = Input.selection.filter((e) => e.alive && e.owner === g.viewer);
    const units = sel.filter((e) => e.kind === 'unit');
    const blds = sel.filter((e) => e.kind === 'building');
    const put = (i, c) => { cmds[i] = c; };
    if (units.length) {
      const vills = units.filter((u) => u.def.build);
      const explorer = units.find((u) => u.def.buildTP);
      const wagon = units.find((u) => u.def.tags.has('wagon'));
      if (vills.length) {
        const slots = { house: 0, mill: 1, market: 2, outpost: 3, plantation: 4, barracks: 5, stable: 6, church: 7, foundry: 8, arsenal: 9, tradingPost: 10, tower: 11 };
        for (const k of VILLAGER_BUILDS) put(slots[k], this.buildCmd(k));
      } else if (explorer) put(0, this.buildCmd('tradingPost'));
      if (wagon) {
        const k = wagon.def.builds;
        put(0, { icon: ICONS['b:' + k], title: k === 'fort' ? 'Построить форт' : 'Основать городской центр', desc: BUILDINGS[k].desc, run: () => Input.startPlacement(k, wagon) });
      }
      const fighters = units.filter((u) => u.canFight && !u.def.tags.has('villager'));
      if (fighters.length) put(vills.length ? 12 : 5, { icon: Glyph.get('swords', 96, '#18222c'), title: 'Атака с ходу', desc: 'Отряд идёт к точке и атакует всех врагов на пути. Также: Ctrl + ПКМ.', run: () => { this.targetMode = 'attackMove'; this.updateCursor(); } });
      put(14, { icon: Glyph.get('stop', 96, '#18222c'), title: 'Стоп', desc: 'Прекратить текущее действие.', run: () => { for (const u of units) u.cmdStop(); } });
      if (vills.length && blds.length === 0) {
        const tc = g.buildings.find((b) => b.alive && b.built && b.owner === g.viewer && b.key === 'tc');
        if (tc) put(13, { icon: Glyph.get('bell', 96, '#18222c'), title: 'Укрыться в центре', desc: 'Выбранные поселенцы прячутся в ближайшем городском центре и усиливают его огонь.', run: () => { for (const u of vills) u.cmdGarrison(this.nearestTC(u)); } });
      }
    } else if (blds.length) {
      const b = blds[0];
      const same = blds.every((x) => x.key === b.key);
      if (!b.built) {
        put(14, { icon: Glyph.get('delete', 96, '#18222c'), title: 'Отменить строительство', desc: 'Снести фундамент и вернуть часть затрат.', run: () => { g.cmdDelete(b); } });
      } else if (same) {
        let i = 0;
        const trains = (b.def.trains || []).filter((k) => { const d = UNITS[k]; return (!d.civ || d.civ.includes(p.civKey)) && (!d.notCiv || !d.notCiv.includes(p.civKey)); });
        for (const k of trains) { if (i >= 10) break; put(i++, this.trainCmd(k, blds)); }
        if (b.key === 'tc') {
          put(1, this.ageCmd(b));
          i = 2;
        }
        const techMax = b.key === 'market' ? 7 : 10;
        for (const t of b.def.techs || []) {
          if (p.techs.has(t)) continue;
          const T = TECHS[t];
          if (T.req && !p.techs.has(T.req) && !p.researching.has(T.req)) continue;
          if (i >= techMax) break;
          put(i++, this.techCmd(t, b));
        }
        if (b.key === 'tc') {
          put(10, { icon: Glyph.get(b.garrison.length ? 'bellOff' : 'bell', 96, '#18222c'), title: b.garrison.length ? 'Отбой тревоги' : 'Тревога!', desc: b.garrison.length ? 'Выпустить поселенцев обратно на работу.' : 'Поселенцы рядом укрываются в центре; каждые пять дают центру дополнительный выстрел.', run: () => { g.cmdAlarm(b); this.cmdDirty = true; } });
          const ex = p.explorer;
          if (ex && ex.ko) put(11, { icon: Glyph.compose('u:explorer', 'coin'), title: 'Выкупить исследователя', cost: { coin: 300 }, desc: 'Исследователь вернётся к городскому центру.', run: () => { const err = g.cmdRansom(p); if (err) { this.toast(err, true); Sfx.play('error'); } else this.cmdDirty = true; } });
        }
        if (b.key === 'market') {
          // row 2 (right part): buy; row 3: sell — food, wood, stone for coins
          ['food', 'wood', 'stone'].forEach((r, k) => {
            put(7 + k, { icon: Glyph.tradeIcon(r, 'buy'), title: 'Купить 100 ' + RES_NAME_GEN[r], costFn: () => ({ coin: Math.round(p.prices[r]) }), gainFn: () => ({ [r]: 100 }), desc: 'Платите монетами. Цена растёт с каждой покупкой и постепенно возвращается к норме.', run: () => this.marketDo(p, 'buy', r) });
            put(10 + k, { icon: Glyph.tradeIcon(r, 'sell'), title: 'Продать 100 ' + RES_NAME_GEN[r], costFn: () => ({ [r]: 100 }), gainFn: () => ({ coin: g.sellPrice(p, r) }), desc: 'Излишки — в монеты. Цена падает с каждой продажей.', run: () => this.marketDo(p, 'sell', r) });
          });
        }
      }
      if (b.built && b.key !== 'tc') put(14, { icon: Glyph.get('delete', 96, '#18222c'), title: 'Снести здание', desc: 'Разрушить выбранное здание. Delete.', run: () => { for (const x of blds) g.cmdDelete(x); } });
    }
    this.cmds = cmds;
    const keys = 'QWERTASDFGZXCVB';
    const btns = this.el.cmds.children;
    for (let i = 0; i < 15; i++) {
      const c = cmds[i], btn = btns[i];
      btn.hidden = false;
      btn.classList.toggle('empty', !c);
      btn.querySelector('img').src = c ? c.icon || '' : '';
      btn.querySelector('img').style.visibility = c && c.icon ? 'visible' : 'hidden';
      btn.querySelector('.hk').textContent = c ? keys[i] : '';
      btn.setAttribute('aria-label', c ? c.title : '');
      btn.disabled = !c;
      btn._dis = btn._ph = btn._qn = undefined;
      btn.classList.remove('dis'); btn.querySelector('.prog').style.height = '0'; btn.querySelector('.qn').textContent = '';
    }
    this.refreshCommandStates();
    if (this.tipIdx !== undefined) this.showTip(this.tipIdx, btns[this.tipIdx]);
  },
  nearestTC(u) {
    const g = this.game; let best = null, bd = 1e9;
    for (const b of g.buildings) if (b.alive && b.built && b.owner === u.owner && b.key === 'tc') { const d = dist2(b.x, b.z, u.x, u.z); if (d < bd) { bd = d; best = b; } }
    return best;
  },
  buildCmd(k) {
    const g = this.game, p = g.players[g.viewer], def = BUILDINGS[k];
    return {
      icon: ICONS['b:' + k], title: def.name, costFn: () => p.costOf('building', k), desc: def.desc, age: def.age,
      run: () => {
        if (def.age > p.age) { this.toast('Требуется ' + AGES[def.age].name.toLowerCase(), true); Sfx.play('error'); return; }
        if (!p.canAfford(p.costOf('building', k))) { this.toast('Недостаточно ресурсов', true); Sfx.play('error'); return; }
        Input.startPlacement(k);
      },
    };
  },
  trainCmd(k, blds) {
    const g = this.game, p = g.players[g.viewer], def = UNITS[k];
    return {
      icon: ICONS['u:' + k], title: def.name, costFn: () => p.costOf('unit', k), desc: def.desc, age: def.age, pop: def.pop, time: def.time, queueKey: k, unit: def,
      run: (alt) => {
        const target = blds.slice().sort((a, b) => a.queue.length - b.queue.length)[0];
        const n = Input.keys.has('Shift') || alt ? 5 : 1;
        const err = g.cmdTrain(target, k, n);
        if (err) { this.toast(err, true); Sfx.play('error'); } else Sfx.play('click');
        this.selDirty = true;
      },
    };
  },
  techCmd(t, b) {
    const g = this.game, p = g.players[g.viewer], T = TECHS[t];
    return {
      icon: this.techIcon(t), title: T.name, costFn: () => T.cost, desc: T.desc, age: T.age, time: T.time, tech: t,
      run: () => { const err = g.cmdResearch(b, t); if (err) { this.toast(err, true); Sfx.play('error'); } else { Sfx.play('click'); this.cmdDirty = true; } this.selDirty = true; },
    };
  },
  ageCmd(tc) {
    const g = this.game, p = g.players[g.viewer];
    if (p.age >= 5) return null;
    const to = p.age + 1, A = AGES[to];
    return {
      icon: Glyph.compose('b:tc', null, A.num), title: 'Перейти: ' + A.name, costFn: () => A.cost, desc: 'Открывает новые здания, войска, технологии и поставки. Выберите политика с наградой.', age: 1, time: A.time, aging: true,
      run: () => {
        if (p.aging) { this.toast('Переход уже идёт', true); return; }
        if (!p.canAfford(A.cost)) { this.toast('Недостаточно ресурсов', true); Sfx.play('error'); return; }
        this.openAgeUp();
      },
    };
  },
  refreshCommandStates() {
    const g = this.game, p = g.players[g.viewer], btns = this.el.cmds.children;
    for (let i = 0; i < 15; i++) {
      const c = this.cmds[i], btn = btns[i];
      if (!c) continue;
      let dis = false, prog = 0, qn = 0;
      if (c.age && c.age > p.age) dis = true;
      const cost = c.costFn ? c.costFn() : c.cost;
      if (cost && !p.canAfford(cost)) dis = true;
      if (c.tech && p.researching.has(c.tech)) { dis = true; for (const b of Input.selection) if (b.queue) for (const q of b.queue) if (q.key === c.tech) prog = q.t / q.total; }
      if (c.aging && p.aging) { dis = true; prog = p.aging.t / p.aging.total; }
      if (c.queueKey) for (const b of Input.selection) if (b.queue) for (const q of b.queue) if (q.key === c.queueKey) qn += q.count;
      if (btn._dis !== dis) { btn._dis = dis; btn.classList.toggle('dis', dis); }
      const ph = prog ? (prog * 100).toFixed(0) + '%' : '0';
      if (btn._ph !== ph) { btn._ph = ph; btn.querySelector('.prog').style.height = ph; }
      const qs = qn ? String(qn) : '';
      if (btn._qn !== qs) { btn._qn = qs; btn.querySelector('.qn').textContent = qs; }
    }
  },
  pressCommand(i, fromMouse, alt) {
    if (this.cmdDirty && this.game) { this.cmdDirty = false; this.lastCmdSig = this.commandSignature(); this.buildCommands(); }
    const c = this.cmds[i];
    if (!c) return false;
    if (this.modalOpen()) return false;
    c.run(alt);
    this.cmdDirty = true;
    return true;
  },
  showTip(i, btn) {
    const c = this.cmds[i];
    this.tipIdx = i;
    if (!c) { this.hideTip(); return; }
    const g = this.game, p = g.players[g.viewer];
    const tip = this.el.tooltip;
    let html = '<h4>' + c.title + ' <kbd>' + 'QWERTASDFGZXCVB'[i] + '</kbd></h4>';
    const cost = c.costFn ? c.costFn() : c.cost;
    if (cost) {
      html += '<div class="cost">' + (c.gainFn ? '<span class="cap">Отдаёте</span>' : '');
      for (const r of RES) if (cost[r]) html += '<span class="' + (p.res[r] < cost[r] ? 'lack' : '') + '" title="' + RES_TITLE[r] + '"><img src="' + Glyph.get(r, 32) + '" alt="' + RES_TITLE[r] + '">' + Math.round(cost[r]) + '</span>';
      if (c.pop) html += '<span title="Население"><img src="' + Glyph.get('pop', 32) + '" alt="Население">' + c.pop + '</span>';
      if (c.time) html += '<span class="t">' + c.time + ' с</span>';
      html += '</div>';
    }
    if (c.gainFn) { const gn = c.gainFn(); html += '<div class="cost gain"><span class="cap">Получаете</span>' + Object.keys(gn).map((r) => '<span><img src="' + Glyph.get(r, 32) + '" alt="' + RES_TITLE[r] + '">+' + gn[r] + '</span>').join('') + '</div>'; }
    if (c.desc) html += '<p>' + c.desc + '</p>';
    if (c.unit) {
      const d = c.unit, bits = [];
      bits.push('HP ' + p.unitHp(d));
      if (d.ranged) bits.push((d.ranged.buildingsOnly ? 'осада ' : 'выстрел ') + Math.round(d.ranged.dmg * p.dmgMul(d)) + ' / ' + d.ranged.range + ' м');
      if (d.melee) bits.push('ближний ' + Math.round(d.melee.dmg * p.dmgMul(d)));
      html += '<p class="stats-line">' + bits.join(' · ') + '</p>';
      if (c.queueKey) html += '<p class="hint">Shift или ПКМ — заказать 5</p>';
    }
    if (c.age && c.age > p.age) html += '<p class="req">Требуется: ' + AGES[c.age].name + '</p>';
    tip.innerHTML = html;
    tip.hidden = false;
    const r = btn.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + 'px';
    tip.style.top = Math.max(8, r.top - th - 10) + 'px';
  },
  hideTip() { this.el.tooltip.hidden = true; this.tipIdx = undefined; this.resTipFor = null; },

  // ---------------------------------------------------------------- cursor
  updateCursor() {
    const c = Input.canvas; if (!c) return;
    let cur = 'default';
    if (Input.placement) cur = 'crosshair';
    else if (this.targetMode) cur = CURSORS.attack;
    else if (Input.hover && this.game) {
      const h = Input.hover, g = this.game;
      const us = Input.selUnits();
      if (us.length) {
        if ((h.kind === 'unit' || h.kind === 'building') && h.owner !== g.viewer && g.validTarget(us[0], h)) cur = CURSORS.attack;
        else if ((h.kind === 'res' || (h.kind === 'unit' && h.owner === GAIA && h.def.tags.has('huntable'))) && us.some((u) => u.def.gather)) cur = CURSORS.gather;
        else if (h.kind === 'building' && h.owner === g.viewer && (!h.built || h.hp < h.maxHp) && us.some((u) => u.def.build)) cur = CURSORS.build;
        else if (h.kind === 'treasure' || h.kind === 'socket') cur = CURSORS.gather;
        else if (h.kind) cur = CURSORS.select;
      } else if (h.kind) cur = CURSORS.select;
    }
    if (c.style.cursor !== cur) c.style.cursor = cur;
  },

  // ---------------------------------------------------------------- minimap
  drawMinimap() {
    const g = this.game, ctx = this.miniCtx, S = this.el.mini.width, k = S / g.size, N = g.N;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.miniBase, 0, 0, S, S);
    // resources (explored)
    for (const r of g.resources) {
      if (!r.alive || (r.rkind !== 'mine' && r.rkind !== 'quarry' && r.rkind !== 'bush')) continue;
      if (!g.isExploredW(r.x, r.z)) continue;
      ctx.fillStyle = r.rkind === 'mine' ? '#f2d46b' : r.rkind === 'quarry' ? '#d9d6ce' : '#d0566a';
      const s = r.rkind === 'bush' ? 2.5 : 4;
      ctx.fillRect(r.x * k - s / 2, r.z * k - s / 2, s, s);
      if (r.rkind === 'quarry') { ctx.strokeStyle = 'rgba(40,38,34,0.85)'; ctx.lineWidth = 1; ctx.strokeRect(r.x * k - s / 2, r.z * k - s / 2, s, s); }
    }
    for (const t of g.treasures) if (t.alive && g.isExploredW(t.x, t.z)) { ctx.fillStyle = '#ffe9a0'; ctx.save(); ctx.translate(t.x * k, t.z * k); ctx.rotate(PI / 4); ctx.fillRect(-2, -2, 4, 4); ctx.restore(); }
    for (const s of g.sockets) if (g.isExploredW(s.x, s.z)) { ctx.strokeStyle = s.tp ? hexToCss(g.players[s.tp.owner].color) : '#f4ead0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x * k, s.z * k, 3, 0, TAU); ctx.stroke(); }
    // buildings
    for (const b of g.buildings) {
      if (!b.alive || !(b.seen || g.revealAll)) continue;
      ctx.fillStyle = hexToCss(g.players[b.owner].color);
      const s = Math.max(4, b.size * k);
      ctx.fillRect(b.x * k - s / 2, b.z * k - s / 2, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(b.x * k - s / 2, b.z * k - s / 2, s, s);
    }
    // units
    for (const u of g.units) {
      if (!u.alive || u.garrisoned || u.ko) continue;
      if (u.owner === GAIA) {
        if (!u.def.tags.has('guardian') && !u.def.tags.has('huntable') && !u.trade) continue;
        if (!g.isVisibleW(u.x, u.z)) continue;
        ctx.fillStyle = u.trade ? '#f4ead0' : u.def.tags.has('guardian') ? '#a33' : '#c9b28a';
        ctx.fillRect(u.x * k - 1, u.z * k - 1, 2, 2);
        continue;
      }
      const fr = g.players[u.owner].team === g.players[g.viewer].team;
      if (!fr && !g.isVisibleW(u.x, u.z)) continue;
      ctx.fillStyle = u.selected ? '#ffffff' : hexToCss(g.players[u.owner].color);
      const s = u.def.tags.has('villager') ? 2 : 3;
      ctx.fillRect(u.x * k - s / 2, u.z * k - s / 2, s, s);
    }
    // fog
    if (!g.revealAll) {
      const d = this.miniFogData.data;
      for (let i = 0; i < N * N; i++) d[i * 4 + 3] = g.vis[i] ? 0 : g.explored[i] ? 120 : 255;
      this.miniFogCtx.putImageData(this.miniFogData, 0, 0);
      ctx.drawImage(this.miniFog, 0, 0, S, S);
    }
    // camera view
    if (RS.viewPoly) {
      ctx.strokeStyle = 'rgba(244,236,214,0.9)'; ctx.lineWidth = 1.3; ctx.beginPath();
      RS.viewPoly.forEach((p, i) => { const x = clamp(p.x, -50, g.size + 50) * k, z = clamp(p.z, -50, g.size + 50) * k; if (i) ctx.lineTo(x, z); else ctx.moveTo(x, z); });
      ctx.closePath(); ctx.stroke();
    }
    // alert pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i]; p.t += 0.2;
      if (p.t > 4) { this.pings.splice(i, 1); continue; }
      const r = 4 + (p.t % 1) * 14;
      ctx.strokeStyle = 'rgba(230,80,60,' + (1 - (p.t % 1)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x * k, p.z * k, r, 0, TAU); ctx.stroke();
    }
  },

  // ---------------------------------------------------------------- overlay: bars, box, floating text
  drawOverlay(dt) {
    const g = this.game, ctx = this.ovCtx, dpr = this.ovDpr, cam = GFX.camera;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const W = window.innerWidth, H = window.innerHeight;
    const v = new THREE.Vector3();
    const toScreen = (x, y, z) => { v.set(x, y, z).project(cam); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z }; };
    const bar = (sx, sy, w, f, col, back = 'rgba(10,12,14,0.75)') => {
      ctx.fillStyle = back; ctx.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 5);
      ctx.fillStyle = col; ctx.fillRect(sx - w / 2, sy, w * clamp(f, 0, 1), 3);
    };
    const near = Cam.dist < 110;
    // units
    for (const su of RS.screenUnits) {
      const u = su.u;
      const show = u.selected || (g.time - u.lastHitT < 3 && near && u.hp < u.maxHp && (u.owner >= 0 || u.def.tags.has('guardian')));
      if (!show) continue;
      const p = toScreen(su.x, su.y + (u.def.height || 1.8) * UNIT_SCALE + 0.5, su.z);
      if (p.z > 1) continue;
      const w = u.def.tags.has('cavalry') || u.def.tags.has('artillery') ? 30 : 22;
      bar(p.x, p.y, w, u.hp / u.maxHp, this.hpColor(u.hp / u.maxHp));
    }
    // buildings
    for (const b of g.buildings) {
      if (!b.alive || !b.gfx || !b.gfx.group.visible || !RS.inView(b.x, b.z)) continue;
      const sel = Input.selection.includes(b);
      const show = sel || !b.built || (g.time - b.lastHitT < 4) || b.hp < b.maxHp * 0.999 && near;
      if (!show) continue;
      const p = toScreen(b.x, g.heightAt(b.x, b.z) + b.def.height * (b.built ? 1 : Math.max(0.3, b.progress)) + 1.2, b.z);
      if (p.z > 1) continue;
      const w = clamp(b.size * 7, 34, 90);
      if (!b.built) bar(p.x, p.y - 6, w, b.progress, '#6fa8d8');
      bar(p.x, p.y, w, b.hp / b.maxHp, this.hpColor(b.hp / b.maxHp));
      if (b.queue.length && b.owner === g.viewer && b.queue[0].started !== false) bar(p.x, p.y + 6, w, b.queue[0].t / b.queue[0].total, '#d9b85a');
    }
    // floating texts
    ctx.textAlign = 'center'; ctx.font = '600 15px "Alegreya Sans", sans-serif';
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.t += dt;
      if (f.t > 2.6) { this.floats.splice(i, 1); continue; }
      const p = toScreen(f.x, g.heightAt(f.x, f.z) + f.y + f.t * 1.6, f.z);
      if (p.z > 1) continue;
      ctx.globalAlpha = f.t > 1.8 ? (2.6 - f.t) / 0.8 : 1;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,10,12,0.8)'; ctx.strokeText(f.text, p.x, p.y);
      ctx.fillStyle = f.color || '#fff'; ctx.fillText(f.text, p.x, p.y);
      ctx.globalAlpha = 1;
    }
    // selection rectangle
    const d = Input.drag;
    if (d) {
      const m = Input.mouse;
      const x = Math.min(d.x, m.x), y = Math.min(d.y, m.y), w = Math.abs(m.x - d.x), h = Math.abs(m.y - d.y);
      if (w > 5 || h > 5) {
        ctx.fillStyle = 'rgba(233,201,119,0.08)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(233,201,119,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      }
    }
  },

  // ---------------------------------------------------------------- modals
  modalOpen() { return [this.el.mHome, this.el.mAge, this.el.mPause, this.el.mHelp].some((m) => m && !m.hidden); },
  closeModals() {
    for (const m of [this.el.mHome, this.el.mAge, this.el.mPause, this.el.mHelp]) m.hidden = true;
  },
  isPaused() { return !this.el.mPause.hidden || !this.el.mHelp.hidden; },
  togglePause() {
    if (!this.game) return;
    const m = this.el.mPause;
    if (!m.hidden) { this.closeModals(); return; }
    this.closeModals();
    m.hidden = false;
    m.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === this.speed));
    m.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('on', b.dataset.quality === GFX.quality));
    const vol = m.querySelector('#opt-volume'); if (vol) vol.value = Math.round(Sfx.volume * 100);
    const es = m.querySelector('#opt-edge'); if (es) es.checked = this.edgeScroll;
    m.querySelectorAll('[data-hud]').forEach((b) => b.classList.toggle('on', b.dataset.hud === this.hudMode));
  },
  setSpeed(s) { this.speed = s; this.toast('Скорость игры ×' + s); },
  openHelp() { this.closeModals(); this.el.mHelp.hidden = false; },
  openHomeCity() {
    const g = this.game; if (!g) return;
    const p = g.players[g.viewer], m = this.el.mHome;
    this.closeModals();
    const body = m.querySelector('.hc-body');
    const head = m.querySelector('.hc-head');
    head.innerHTML = '<div><h2>Метрополия · ' + p.civ.name + '</h2><p>' + (p.inTransit ? 'Корабль в пути: ' + CARDS[p.inTransit.card].name + ' — прибудет через ' + Math.ceil(p.inTransit.total - p.inTransit.t) + ' с' : p.shipments ? 'Доступно поставок: <b>' + p.shipments + '</b>. Выберите карту — груз прибудет к городскому центру.' : 'Копите опыт: сбор ресурсов, обучение войск, победы и сокровища. До следующей поставки: ' + Math.ceil(p.shipNeed - p.xp) + ' опыта.') + '</p></div><div class="hc-xp"><span>Опыт</span><div class="bar"><i style="width:' + (100 * p.xp / p.shipNeed).toFixed(0) + '%"></i></div></div>';
    let html = '';
    for (let a = 1; a <= 5; a++) {
      const cards = p.deck.filter((c) => c.age === a);
      html += '<section class="hc-age' + (a > p.age ? ' locked' : '') + '"><h3><span>' + AGES[a].num + '</span>' + AGES[a].name + '</h3><div class="hc-cards">';
      for (const c of cards) {
        const used = p.cardsUsed.has(c.key) && !c.infinite;
        const avail = !used && a <= p.age && p.shipments > 0 && !p.inTransit;
        const fxG = c.give.fx && c.give.fx.gather ? Object.keys(c.give.fx.gather) : [];
        const fxRes = fxG.length === 1 ? { quarry: 'stone', mine: 'coin', plantation: 'coin', wood: 'wood', farm: 'food', hunt: 'food', berry: 'food' }[fxG[0]] : null;
        const ic = c.give.units ? ICONS['u:' + this.cardUnitIcon(c, p)] : c.give.res ? Glyph.get(Object.keys(c.give.res)[0], 64) : Glyph.get(fxRes || 'xp', 64);
        html += '<button class="card' + (used ? ' used' : '') + (avail ? ' avail' : '') + (c.civ ? ' civ' : '') + '" data-card="' + c.key + '" ' + (avail ? '' : 'aria-disabled="true"') + '><img src="' + ic + '" alt=""><b>' + c.name + '</b><span>' + c.desc + '</span>' + (c.infinite ? '<i class="inf" title="Можно отправлять повторно">∞</i>' : '') + '</button>';
      }
      html += '</div></section>';
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => {
      const err = g.cmdShip(p, b.dataset.card);
      if (err) { this.toast(err, true); Sfx.play('error'); return; }
      Sfx.play('click'); this.closeModals(); this.el.home.classList.remove('ready');
    }));
    m.hidden = false;
  },
  cardUnitIcon(c, p) {
    let k = Object.keys(c.give.units)[0];
    if (k === 'crossbowman' && p.civKey === 'britain') k = 'longbowman';
    if (k === 'crossbowman' && p.civKey === 'russia') k = 'strelet';
    return k;
  },
  openAgeUp() {
    const g = this.game, p = g.players[g.viewer], m = this.el.mAge;
    this.closeModals();
    const to = p.age + 1, A = AGES[to];
    m.querySelector('h2').textContent = A.name;
    m.querySelector('.age-cost').innerHTML = 'Стоимость: ' + Object.entries(A.cost).map(([r, v]) => '<span><img src="' + Glyph.get(r, 32) + '" alt="">' + v + '</span>').join(' ') + ' · ' + A.time + ' с';
    const list = m.querySelector('.pols');
    list.innerHTML = POLITICIANS[to].map((pl) => {
      const ic = pl.give.units ? ICONS['u:' + Object.keys(pl.give.units)[0]] : Glyph.get(Object.keys(pl.give.res)[0], 64);
      return '<button class="pol" data-pol="' + pl.key + '"><img src="' + ic + '" alt=""><b>' + pl.name + '</b><span>' + pl.desc + '</span></button>';
    }).join('');
    list.querySelectorAll('[data-pol]').forEach((b) => b.addEventListener('click', () => {
      const err = g.cmdAgeUp(p, b.dataset.pol);
      if (err) { this.toast(err, true); Sfx.play('error'); } else Sfx.play('click');
      this.closeModals(); this.cmdDirty = true;
    }));
    m.hidden = false;
  },
  showEnd(team) {
    const g = this.game, me = g.players[g.viewer];
    const win = team === me.team && team !== -1;
    Sfx.play(win ? 'victory' : 'defeat');
    const m = this.el.mEnd;
    m.querySelector('h2').textContent = win ? 'Победа' : 'Поражение';
    m.querySelector('.end-sub').textContent = win ? 'Новый Свет признал вашу власть. Время партии: ' + fmtTime(g.time) : 'Ваша колония пала. Время партии: ' + fmtTime(g.time) + (g.over ? '' : '. Остальные соперники продолжают войну — можно досмотреть.');
    const rows = g.players.map((p) => {
      const s = p.stats, gath = Math.round(RES.reduce((a, r) => a + (s.gathered[r] || 0), 0));
      return '<tr><td><i class="pc" style="background:' + hexToCss(p.color) + '"></i>' + p.name + '<small>' + p.civ.name + '</small></td><td>' + AGES[p.age].num + '</td><td>' + fmtNum(gath) + '</td><td>' + s.trained + '</td><td>' + s.killed + '</td><td>' + s.lost + '</td><td>' + s.razed + '</td><td>' + s.treasures + '</td><td>' + Math.round(p.xpTotal) + '</td></tr>';
    }).join('');
    m.querySelector('tbody').innerHTML = rows;
    m.classList.toggle('win', win);
    m.hidden = false;
  },
};
const TAG_NAMES = { cavalry: 'кавалерия', heavyInf: 'тяж. пехота', lightInf: 'лёгк. пехота', heavyCav: 'тяж. кавалерия', lightCav: 'лёгк. кавалерия', artillery: 'артиллерия', building: 'здания', villager: 'поселенцы', infantry: 'пехота' };

const CURSORS = (() => {
  const svg = (body, hx, hy) => 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' + body + '</svg>') + '") ' + hx + ' ' + hy + ', auto';
  return {
    select: svg('<path d="M4 3 L4 25 L10 19 L14 28 L18 26 L14 17 L22 17 Z" fill="#e9c977" stroke="#2a1d0c" stroke-width="1.6" stroke-linejoin="round"/>', 4, 3),
    attack: svg('<g stroke="#2a0c08" stroke-width="1.4" fill="#e2563f"><path d="M4 4 L8 4 L22 18 L18 22 L4 8 Z"/><path d="M20 24 L24 20 L28 24 L24 28 Z"/></g><path d="M3 3 L9 3 L9 6" stroke="#fff" fill="none" stroke-width="1"/>', 3, 3),
    gather: svg('<path d="M6 26 L18 14" stroke="#6b4a2e" stroke-width="3.2" stroke-linecap="round"/><path d="M15 5 Q24 6 27 13 L20 17 Q19 11 13 10 Z" fill="#cfd4d8" stroke="#2b2b2b" stroke-width="1.3"/>', 6, 26),
    build: svg('<path d="M8 27 L19 16" stroke="#6b4a2e" stroke-width="3.5" stroke-linecap="round"/><rect x="15" y="4" width="13" height="8" rx="1.5" transform="rotate(45 21 8)" fill="#a7adb3" stroke="#2b2b2b" stroke-width="1.3"/>', 8, 27),
  };
})();
