// ---------------------------------------------------------------------------
// 09_instanced.js — instanced unit rendering, buildings, resources, particles,
// projectiles, tracers, selection rings, markers, icon rendering
// ---------------------------------------------------------------------------

class UnitInstancer {
  constructor(scene) { this.scene = scene; this.sets = {}; }
  _make(key, cap) {
    const model = unitModel(key);
    const g = new THREE.BufferGeometry();
    for (const n in model.geo.attributes) g.setAttribute(n, model.geo.attributes[n]);
    g.setIndex(model.geo.index);
    const iTeam = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const iAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    iTeam.setUsage(THREE.DynamicDrawUsage); iAnim.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iTeam', iTeam); g.setAttribute('iAnim', iAnim);
    const mesh = new THREE.InstancedMesh(g, model.material || modelMaterial('unit'), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = model.depth || depthMaterial('unit');
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    return { mesh, cap, n: 0, iTeam, iAnim, style: model.style };
  }
  begin() { for (const k in this.sets) this.sets[k].n = 0; }
  push(key, m4, team, a0, a1, a2, a3) {
    let s = this.sets[key];
    if (!s) s = this.sets[key] = this._make(key, 64);
    if (s.n >= s.cap) {
      const ns = this._make(key, s.cap * 2);
      ns.n = s.n;
      ns.mesh.instanceMatrix.array.set(s.mesh.instanceMatrix.array);
      ns.iTeam.array.set(s.iTeam.array); ns.iAnim.array.set(s.iAnim.array);
      this.scene.remove(s.mesh); s.mesh.dispose();
      s = this.sets[key] = ns;
    }
    const i = s.n++;
    m4.toArray(s.mesh.instanceMatrix.array, i * 16);
    s.iTeam.array[i * 3] = team.r; s.iTeam.array[i * 3 + 1] = team.g; s.iTeam.array[i * 3 + 2] = team.b;
    const A = s.iAnim.array;
    A[i * 4] = a0; A[i * 4 + 1] = a1; A[i * 4 + 2] = a2; A[i * 4 + 3] = s.style + clamp(a3, 0, 0.95);
  }
  end() {
    for (const k in this.sets) {
      const s = this.sets[k];
      s.mesh.count = s.n;
      if (s.n) {
        s.mesh.instanceMatrix.updateRange.offset = 0; s.mesh.instanceMatrix.updateRange.count = s.n * 16;
        s.iTeam.updateRange.offset = 0; s.iTeam.updateRange.count = s.n * 3;
        s.iAnim.updateRange.offset = 0; s.iAnim.updateRange.count = s.n * 4;
        s.mesh.instanceMatrix.needsUpdate = true; s.iTeam.needsUpdate = true; s.iAnim.needsUpdate = true;
      }
    }
  }
}

// ------------------------------------------------------------------ particles
class Particles {
  constructor(scene, max, additive, tex) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.rgb = new Float32Array(max * 3); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aSize', this.aSize);
    g.setDrawRange(0, 0);
    this.uScale = { value: 600 };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: tex }, uScale: this.uScale },
      vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(aSize * uScale / -mv.z, 256.0); gl_Position = projectionMatrix * mv; vCol = aCol; }',
      fragmentShader: 'uniform sampler2D uTex; varying vec4 vCol; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a); }',
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 1, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 0; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.rgb[i * 3] = r; this.rgb[i * 3 + 1] = g; this.rgb[i * 3 + 2] = b; this.a0[i] = a;
    this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        // swap-remove
        n--;
        if (i !== n) {
          this.pos[i * 3] = this.pos[n * 3]; this.pos[i * 3 + 1] = this.pos[n * 3 + 1]; this.pos[i * 3 + 2] = this.pos[n * 3 + 2];
          this.vel[i * 3] = this.vel[n * 3]; this.vel[i * 3 + 1] = this.vel[n * 3 + 1]; this.vel[i * 3 + 2] = this.vel[n * 3 + 2];
          this.life[i] = this.life[n]; this.maxLife[i] = this.maxLife[n]; this.s0[i] = this.s0[n]; this.s1[i] = this.s1[n];
          this.rgb[i * 3] = this.rgb[n * 3]; this.rgb[i * 3 + 1] = this.rgb[n * 3 + 1]; this.rgb[i * 3 + 2] = this.rgb[n * 3 + 2];
          this.a0[i] = this.a0[n]; this.drag[i] = this.drag[n]; this.grav[i] = this.grav[n];
        }
        i--; continue;
      }
      const d = Math.pow(this.drag[i], dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.size[i] = lerp(this.s0[i], this.s1[i], t);
      this.col[i * 4] = this.rgb[i * 3]; this.col[i * 4 + 1] = this.rgb[i * 3 + 1]; this.col[i * 4 + 2] = this.rgb[i * 3 + 2];
      this.col[i * 4 + 3] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    this.n = n;
    this.points.geometry.setDrawRange(0, n);
    if (n === 0 && this._lastN === 0) return;
    this._lastN = n;
    this.aPos.updateRange.offset = 0; this.aPos.updateRange.count = Math.max(1, n) * 3;
    this.aCol.updateRange.offset = 0; this.aCol.updateRange.count = Math.max(1, n) * 4;
    this.aSize.updateRange.offset = 0; this.aSize.updateRange.count = Math.max(1, n);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ tracers (musket shots)
class Tracers {
  constructor(scene, max = 160) {
    this.max = max; this.items = [];
    this.pos = new Float32Array(max * 6); this.col = new Float32Array(max * 6);
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('color', this.aC);
    g.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 7;
    scene.add(this.lines);
  }
  add(x0, y0, z0, x1, y1, z1) { if (this.items.length < this.max) this.items.push({ x0, y0, z0, x1, y1, z1, t: 0 }); }
  update(dt) {
    let k = 0;
    for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i]; it.t += dt; if (it.t > 0.12) this.items.splice(i, 1); }
    for (const it of this.items) {
      const f = 1 - it.t / 0.12;
      const a = clamp(it.t / 0.12, 0, 1);
      const sx = lerp(it.x0, it.x1, a * 0.5), sy = lerp(it.y0, it.y1, a * 0.5), sz = lerp(it.z0, it.z1, a * 0.5);
      this.pos.set([sx, sy, sz, it.x1, it.y1, it.z1], k * 6);
      this.col.set([1.0 * f, 0.85 * f, 0.5 * f, 0.6 * f, 0.45 * f, 0.2 * f], k * 6);
      k++;
    }
    this.lines.geometry.setDrawRange(0, k * 2);
    this.aP.needsUpdate = true; this.aC.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ simple instanced pools
class InstPool {
  constructor(scene, geo, mat, cap, opts = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.cap = cap; this.n = 0;
    this.mesh.castShadow = !!opts.castShadow; this.mesh.receiveShadow = false;
    if (opts.renderOrder) this.mesh.renderOrder = opts.renderOrder;
    if (opts.color) { this.mesh.setColorAt(0, new THREE.Color()); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(m4, color) {
    if (this.n >= this.cap) return;
    this.mesh.setMatrixAt(this.n, m4);
    if (color && this.mesh.instanceColor) this.mesh.setColorAt(this.n, color);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ icon renderer (portraits)
const ICONS = {};
function renderIcons(playerColorHex, civ) {
  const S = 112;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  let r2;
  try {
    r2 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return; }
  r2.setPixelRatio(1); r2.setSize(S, S, false);
  r2.outputEncoding = THREE.sRGBEncoding; r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = 1.15;
  r2.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x5a4a38, 1.1));
  const dl = new THREE.DirectionalLight(0xfff0dd, 2.0); dl.position.set(-3, 5, 6); scene.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const team = linColor(playerColorHex);
  const out = document.createElement('canvas'); out.width = out.height = S;
  const ctx = out.getContext('2d');
  const box = new THREE.Box3(), ctr = new THREE.Vector3(), sz = new THREE.Vector3();
  const snap = (key, obj, fit = 1, yaw = -0.6, elev = 0.42, lookY = 0.5) => {
    scene.add(obj);
    if (obj.isInstancedMesh) { if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox(); box.copy(obj.geometry.boundingBox); }
    else box.setFromObject(obj);
    box.getCenter(ctr); box.getSize(sz);
    const r = Math.max(sz.x, sz.z) * 0.62 + sz.y * 0.55;
    const d = (r / Math.tan((cam.fov * PI) / 360)) * fit;
    const ty = box.min.y + sz.y * lookY;
    cam.position.set(ctr.x + Math.sin(yaw) * d * Math.cos(elev), ty + d * Math.sin(elev), ctr.z + Math.cos(yaw) * d * Math.cos(elev));
    cam.lookAt(ctr.x, ty, ctr.z);
    r2.render(scene, cam);
    ctx.clearRect(0, 0, S, S); ctx.drawImage(cv, 0, 0);
    ICONS[key] = out.toDataURL('image/png');
    scene.remove(obj);
  };
  // units
  const unitKeys = ['settler', 'explorer', 'musketeer', 'pikeman', 'crossbowman', 'longbowman', 'strelet', 'rodelero', 'skirmisher', 'grenadier',
    'hussar', 'dragoon', 'cuirassier', 'falconet', 'mortar', 'culverin', 'fortWagon', 'tcWagon', 'tradeWagon', 'deer', 'pronghorn', 'caribou', 'bison', 'wolf', 'bear', 'bandit'];
  const m4 = new THREE.Matrix4();
  for (const k of unitKeys) {
    const def = UNITS[k];
    const model = unitModel(def.model);
    const g = new THREE.BufferGeometry();
    for (const n in model.geo.attributes) g.setAttribute(n, model.geo.attributes[n]);
    g.setIndex(model.geo.index);
    g.setAttribute('iTeam', new THREE.InstancedBufferAttribute(new Float32Array([team.r, team.g, team.b]), 3));
    g.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array([0, 0.5, 0, model.style + 0.3]), 4));
    const mesh = new THREE.InstancedMesh(g, model.material || modelMaterial('unit'), 1);
    mesh.setMatrixAt(0, m4.identity()); mesh.frustumCulled = false;
    const human = !def.tags.has('cavalry') && !def.tags.has('wagon') && !def.tags.has('artillery') && !def.tags.has('animal');
    snap('u:' + k, mesh, human ? 0.62 : 0.78, -0.62, human ? 0.22 : 0.4, human ? 0.6 : 0.5);
    g.dispose();
  }
  for (const k in BUILDINGS) {
    const def = BUILDINGS[k];
    const geo = getBuildingGeo(k, civ, playerColorHex);
    const grp = new THREE.Group();
    grp.add(createBuildingMesh(geo, 'staticNoFow'));
    if (geo.blades) grp.add(new THREE.Mesh(geo.blades, modelMaterial('staticNoFow')));
    snap('b:' + k, grp, 0.82, -0.6, 0.5, 0.42);
  }
  // resources
  const res = { tree: treeGeo(Object.keys(GFX.map ? GFX.map.biome.trees : { pine: 1 })[0]), mine: propGeo('mine'), quarry: propGeo('quarry'), bush: propGeo('bush'), treasure: propGeo('treasure'), crate: propGeo('crate_coin'), crate_food: propGeo('crate_food'), crate_wood: propGeo('crate_wood'), crate_stone: propGeo('crate_stone') };
  for (const k in res) {
    const mesh = new THREE.Mesh(res[k], modelMaterial(k === 'tree' ? 'staticNoFow' : 'staticNoFow'));
    snap('r:' + k, mesh, 0.85, -0.6, 0.45, 0.45);
  }
  r2.dispose();
  try { r2.forceContextLoss(); } catch (e) { /* ignore */ }
}
