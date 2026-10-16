// ---------------------------------------------------------------------------
// 03_audio.js — procedural sound effects with WebAudio (no assets)
// ---------------------------------------------------------------------------
const Sfx = {
  ctx: null, master: null, bus: null, ambBus: null, noise: null,
  volume: 0.7, muted: false, listener: { x: 0, z: 0, yaw: 0 }, recent: {}, voices: 0,
  limits: { musket: 5, pistol: 3, cannon: 3, explosion: 4, bow: 4, sword: 4, chop: 3, mine: 3, stone: 3, hammer: 3, rustle: 2, collapse: 2 },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.bus = this.ctx.createGain(); this.bus.connect(this.master);
      this.ambBus = this.ctx.createGain(); this.ambBus.gain.value = 0.0; this.ambBus.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; },

  _noise(t, dur, type, freq, q, gain, attack = 0.002, out) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * Math.max(0, 1.9 - dur)); src.stop(t + dur + 0.05);
    return f;
  },
  _tone(t, dur, type, f0, f1, gain, out, attack = 0.003) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    return o;
  },

  // positional play. x/z optional (UI sounds have none)
  play(name, x, z, vol = 1) {
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const now = this.ctx.currentTime;
    let pan = 0;
    if (x !== undefined) {
      const dx = x - this.listener.x, dz = z - this.listener.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const fall = clamp(1 - d / 150, 0, 1);
      vol *= fall * fall;
      if (vol < 0.03) return;
      const c = Math.cos(this.listener.yaw), s = Math.sin(this.listener.yaw);
      pan = clamp((dx * c - dz * s) / 70, -0.8, 0.8);
    }
    const lim = this.limits[name];
    if (lim) {
      const r = this.recent[name] || (this.recent[name] = []);
      while (r.length && now - r[0] > 0.15) r.shift();
      if (r.length >= lim) return;
      r.push(now);
    }
    if (this.voices > 40) return;
    this.voices++;
    setTimeout(() => { this.voices--; }, 1200);
    const out = this.ctx.createGain(); out.gain.value = vol;
    let node = out;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); node = p; }
    node.connect(this.bus);
    const t = now + 0.005;
    const fn = this['s_' + name];
    if (fn) fn.call(this, t, out);
  },

  s_musket(t, o) {
    this._noise(t, 0.32, 'bandpass', 1100 + Math.random() * 400, 0.8, 0.9, 0.001, o);
    this._noise(t, 0.6, 'lowpass', 500, 0.5, 0.35, 0.004, o);
    this._tone(t, 0.16, 'sine', 140, 45, 0.6, o);
  },
  s_pistol(t, o) {
    this._noise(t, 0.2, 'bandpass', 1800, 0.9, 0.7, 0.001, o);
    this._tone(t, 0.1, 'sine', 200, 70, 0.4, o);
  },
  s_cannon(t, o) {
    this._noise(t, 1.4, 'lowpass', 380, 0.7, 1.0, 0.002, o);
    this._noise(t, 0.25, 'bandpass', 900, 0.6, 0.6, 0.001, o);
    this._tone(t, 0.7, 'sine', 85, 28, 1.0, o);
  },
  s_explosion(t, o) {
    this._noise(t, 0.9, 'lowpass', 700, 0.6, 0.9, 0.003, o);
    this._tone(t, 0.45, 'sine', 110, 35, 0.7, o);
  },
  s_bow(t, o) {
    this._noise(t, 0.12, 'highpass', 2200, 0.6, 0.35, 0.002, o);
    this._tone(t, 0.09, 'triangle', 520, 180, 0.25, o);
  },
  s_sword(t, o) {
    const f = 2000 + Math.random() * 600;
    this._tone(t, 0.28, 'sine', f, f * 0.98, 0.18, o, 0.001);
    this._tone(t, 0.2, 'sine', f * 1.47, f * 1.45, 0.12, o, 0.001);
    this._noise(t, 0.05, 'highpass', 3000, 0.7, 0.3, 0.001, o);
  },
  s_chop(t, o) {
    this._noise(t, 0.08, 'bandpass', 800 + Math.random() * 300, 2.5, 0.6, 0.001, o);
    this._tone(t, 0.07, 'sine', 210, 140, 0.4, o, 0.001);
  },
  s_mine(t, o) {
    const f = 1700 + Math.random() * 500;
    this._tone(t, 0.16, 'sine', f, f, 0.22, o, 0.001);
    this._tone(t, 0.12, 'sine', f * 1.52, f * 1.5, 0.12, o, 0.001);
    this._noise(t, 0.04, 'highpass', 2500, 0.8, 0.3, 0.001, o);
  },
  s_stone(t, o) { // chisel on limestone: duller than the silver pick
    const f = 900 + Math.random() * 260;
    this._tone(t, 0.08, 'triangle', f, f * 0.8, 0.22, o, 0.001);
    this._noise(t, 0.07, 'bandpass', 1300 + Math.random() * 400, 1.6, 0.45, 0.001, o);
  },
  s_hammer(t, o) {
    this._tone(t, 0.09, 'sine', 420 + Math.random() * 80, 300, 0.45, o, 0.001);
    this._noise(t, 0.04, 'bandpass', 1500, 1.5, 0.35, 0.001, o);
  },
  s_rustle(t, o) { this._noise(t, 0.22, 'bandpass', 3200, 0.6, 0.18, 0.02, o); },
  s_collapse(t, o) {
    this._noise(t, 2.4, 'lowpass', 260, 0.6, 1.0, 0.05, o);
    this._noise(t + 0.2, 1.6, 'bandpass', 700, 0.7, 0.4, 0.05, o);
  },
  s_buildDone(t, o) {
    this._tone(t, 0.5, 'triangle', 660, 660, 0.3, o);
    this._tone(t + 0.14, 0.7, 'triangle', 990, 990, 0.25, o);
  },
  s_trained(t, o) { this._tone(t, 0.35, 'sine', 880, 880, 0.18, o); this._tone(t, 0.25, 'sine', 1320, 1320, 0.08, o); },
  s_click(t, o) { this._tone(t, 0.04, 'sine', 1300, 900, 0.18, o, 0.001); },
  s_command(t, o) { this._tone(t, 0.06, 'triangle', 520, 380, 0.2, o, 0.001); this._noise(t, 0.05, 'bandpass', 1200, 1, 0.1, 0.001, o); },
  s_error(t, o) { this._tone(t, 0.18, 'square', 150, 120, 0.12, o); },
  s_ageup(t, o) {
    const notes = [261.6, 329.6, 392, 523.3];
    notes.forEach((f, i) => {
      const f1 = this.ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 1600; f1.connect(o);
      this._tone(t + i * 0.16, 0.5, 'sawtooth', f, f, 0.12, f1, 0.02);
    });
    [261.6, 329.6, 392, 523.3, 659.3].forEach((f) => {
      const f1 = this.ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 1800; f1.connect(o);
      this._tone(t + 0.66, 1.6, 'sawtooth', f, f, 0.08, f1, 0.05);
    });
  },
  s_shipment(t, o) {
    const f1 = this.ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 1200; f1.connect(o);
    this._tone(t, 0.35, 'sawtooth', 293.7, 293.7, 0.16, f1, 0.03);
    this._tone(t + 0.3, 0.8, 'sawtooth', 440, 440, 0.16, f1, 0.03);
  },
  s_alarm(t, o) {
    for (let i = 0; i < 3; i++) {
      this._tone(t + i * 0.22, 0.25, 'sine', 95, 50, 0.9, o, 0.002);
      this._noise(t + i * 0.22, 0.12, 'lowpass', 600, 0.6, 0.4, 0.002, o);
    }
  },
  s_treasure(t, o) { [1318, 1568, 2093, 2637].forEach((f, i) => this._tone(t + i * 0.07, 0.35, 'sine', f, f, 0.14, o)); },
  s_victory(t, o) {
    const seq = [392, 523.3, 659.3, 784, 659.3, 784, 1046.5];
    seq.forEach((f, i) => {
      const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2000; fl.connect(o);
      this._tone(t + i * 0.18, i === seq.length - 1 ? 1.8 : 0.3, 'sawtooth', f, f, 0.12, fl, 0.02);
    });
  },
  s_defeat(t, o) {
    [392, 349.2, 311.1, 261.6].forEach((f, i) => {
      const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.connect(o);
      this._tone(t + i * 0.4, i === 3 ? 2 : 0.5, 'sawtooth', f, f, 0.14, fl, 0.05);
    });
  },

  // ambient bed: wind + occasional birds
  startAmbient(biomeKey) {
    if (!this.ctx || this._amb) return;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
    const g = c.createGain(); g.gain.value = biomeKey === 'yukon' ? 0.16 : 0.08;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.ambBus);
    src.start(); lfo.start();
    this.ambBus.gain.setTargetAtTime(1, c.currentTime, 2);
    this._amb = { src, lfo, biomeKey };
    const birds = biomeKey !== 'yukon';
    const chirp = () => {
      if (!this._amb) return;
      if (birds && !this.muted) {
        const t = c.currentTime + 0.05, n = 2 + Math.floor(Math.random() * 4);
        const base = 2600 + Math.random() * 1800;
        const p = c.createStereoPanner ? c.createStereoPanner() : null;
        const out = c.createGain(); out.gain.value = 0.05;
        if (p) { p.pan.value = Math.random() * 1.6 - 0.8; out.connect(p); p.connect(this.ambBus); } else out.connect(this.ambBus);
        for (let i = 0; i < n; i++) this._tone(t + i * 0.11, 0.08, 'sine', base, base * (0.75 + Math.random() * 0.5), 0.5, out, 0.005);
      }
      this._ambTimer = setTimeout(chirp, 2500 + Math.random() * 7000);
    };
    this._ambTimer = setTimeout(chirp, 3000);
  },
  stopAmbient() {
    if (!this._amb) return;
    try { this._amb.src.stop(); this._amb.lfo.stop(); } catch (e) { /* already stopped */ }
    clearTimeout(this._ambTimer);
    this._amb = null;
  },
};
