// ---------------------------------------------------------------------------
// 08_world_render.js — renderer, camera, lights, terrain, water, forests,
// resources, decor, fog-of-war texture
// ---------------------------------------------------------------------------
const GFX = {
  renderer: null, scene: null, camera: null, sun: null, hemi: null, detail: null, quality: 'high',
  terrain: null, water: null, fowTex: null, fowCur: null, map: null,
  treeIndex: null, // tree id -> {mesh, i}
  chunkSize: 48,
};

function initRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.98;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.shadowMap.autoUpdate = true;
  GFX.renderer = r;
  GFX.camera = new THREE.PerspectiveCamera(38, 1, 1, 1500);
  GFX.detail = makeDetailTexture();
  return r;
}

function setQuality(q) {
  GFX.quality = q;
  const r = GFX.renderer;
  if (!r) return;
  const pr = window.devicePixelRatio || 1;
  r.setPixelRatio(q === 'low' ? Math.min(pr, 1) : Math.min(pr, q === 'high' ? 2 : 1.5));
  if (GFX.sun) {
    const s = q === 'low' ? 1024 : q === 'medium' ? 2048 : 3072;
    if (GFX.sun.shadow.mapSize.x !== s) {
      GFX.sun.shadow.mapSize.set(s, s);
      if (GFX.sun.shadow.map) { GFX.sun.shadow.map.dispose(); GFX.sun.shadow.map = null; }
    }
  }
  if (GFX.decorGroup) GFX.decorGroup.visible = q !== 'low';
}

function buildScene(map) {
  const biome = map.biome;
  GFX.map = map;
  const scene = new THREE.Scene();
  GFX.scene = scene;
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.Fog(new THREE.Color(biome.fog).convertSRGBToLinear(), 150, 520);
  U.uMapSize.value = map.size;

  // environment (IBL) from a gradient sky
  const pmrem = new THREE.PMREMGenerator(GFX.renderer);
  const skyScene = new THREE.Scene();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: linColor(biome.sky) }, hor: { value: linColor(biome.horizon) }, bot: { value: linColor(biome.hemiGround) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor, bot, pow(-y, 0.4)); gl_FragColor = vec4(c, 1.0); }',
  });
  skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), skyMat));
  const envRT = pmrem.fromScene(skyScene, 0.02);
  scene.environment = envRT.texture;
  pmrem.dispose();

  // lights
  const hemi = new THREE.HemisphereLight(linColor(biome.hemiSky), linColor(biome.hemiGround), biome.hemiI * 0.6);
  scene.add(hemi); GFX.hemi = hemi;
  const sun = new THREE.DirectionalLight(linColor(biome.sun), biome.sunI * 0.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 420;
  scene.add(sun); scene.add(sun.target);
  GFX.sun = sun;
  GFX.sunDir = new THREE.Vector3(-0.55, 0.95, 0.42).normalize();

  // fog of war texture
  const N = map.N;
  const fowData = new Uint8Array(N * N * 4);
  const fowTex = new THREE.DataTexture(fowData, N, N, THREE.RGBAFormat);
  fowTex.magFilter = THREE.LinearFilter; fowTex.minFilter = THREE.LinearFilter;
  fowTex.wrapS = fowTex.wrapT = THREE.ClampToEdgeWrapping;
  fowTex.needsUpdate = true;
  GFX.fowTex = fowTex; GFX.fowCur = new Float32Array(N * N);
  U.uFow.value = fowTex;

  buildTerrain(map);
  buildWater(map);
  buildDecor(map);
  setQuality(GFX.quality);
}

function buildTerrain(map) {
  const { V, H, size, biome } = map;
  const pos = new Float32Array(V * V * 3), nor = new Float32Array(V * V * 3);
  for (let vz = 0; vz < V; vz++) for (let vx = 0; vx < V; vx++) {
    const i = vz * V + vx;
    pos[i * 3] = vx * CELL; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = vz * CELL;
    const hl = H[vz * V + Math.max(0, vx - 1)], hr = H[vz * V + Math.min(V - 1, vx + 1)];
    const hd = H[Math.max(0, vz - 1) * V + vx], hu = H[Math.min(V - 1, vz + 1) * V + vx];
    const nx = hl - hr, nz = hd - hu, ny = 2 * CELL;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
  }
  const idx = new Uint32Array((V - 1) * (V - 1) * 6);
  let k = 0;
  for (let vz = 0; vz < V - 1; vz++) for (let vx = 0; vx < V - 1; vx++) {
    const a = vz * V + vx, b = a + 1, c = a + V, d = c + 1;
    // (00,01,10) and (10,01,11): a=00, b=10, c=01, d=11 ; winding for +y normal
    idx[k++] = a; idx[k++] = c; idx[k++] = b;
    idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();

  const splatTex = new THREE.DataTexture(map.splat, map.splatRes, map.splatRes, THREE.RGBAFormat);
  splatTex.magFilter = THREE.LinearFilter; splatTex.minFilter = THREE.LinearFilter;
  splatTex.needsUpdate = true;
  GFX.splatTex = splatTex;

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0 });
  mat.envMapIntensity = 0.7;
  const TU = {
    uDetail: { value: GFX.detail }, uSplat: { value: splatTex },
    cGrassA: { value: linColor(biome.grassA) }, cGrassB: { value: linColor(biome.grassB) }, cDirt: { value: linColor(biome.dirt) },
    cFloor: { value: linColor(biome.floor) }, cSand: { value: linColor(biome.sand) }, cRock: { value: linColor(biome.rock) },
    cRoad: { value: linColor(biome.road) }, cField: { value: linColor(biome.field) }, uHighTint: { value: biome.highTint || 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TU);
    sh.uniforms.uFow = U.uFow; sh.uniforms.uMapSize = U.uMapSize; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvWN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWN;
        uniform sampler2D uDetail; uniform sampler2D uSplat; uniform sampler2D uFow; uniform float uMapSize; uniform float uTime;
        uniform vec3 cGrassA, cGrassB, cDirt, cFloor, cSand, cRock, cRoad, cField; uniform float uHighTint;
        vec3 terrainColor(){
          vec2 wp = vWPos.xz;
          vec4 d1 = texture2D(uDetail, wp * 0.13);
          vec4 d2 = texture2D(uDetail, wp * 0.027);
          vec4 d3 = texture2D(uDetail, wp * 0.0052);
          vec4 sp = texture2D(uSplat, wp / uMapSize);
          float macro = d3.g * 0.65 + d2.g * 0.35;
          vec3 grass = mix(cGrassA, cGrassB, smoothstep(0.32, 0.68, macro));
          grass *= 0.84 + 0.3 * d1.r;
          grass = mix(grass, grass * vec3(1.12, 1.06, 0.82), d1.a * 0.3);
          vec3 dirt = cDirt * (0.78 + 0.42 * d1.r) * (0.9 + 0.2 * d2.b);
          dirt = mix(dirt, dirt * 0.72, step(0.78, d1.b));
          vec3 floorC = cFloor * (0.72 + 0.5 * d1.g);
          vec3 road = cRoad * (0.8 + 0.32 * d1.r);
          vec3 sand = cSand * (0.88 + 0.22 * d1.r);
          vec3 rock = cRock * (0.72 + 0.46 * d1.r) * (0.86 + 0.28 * d2.g);
          rock *= 0.86 + 0.18 * sin(vWPos.y * 2.6 + d2.r * 5.0);
          vec3 c = grass;
          c = mix(c, dirt, smoothstep(0.25, 0.75, clamp(sp.r * (0.7 + 0.6 * d2.r), 0.0, 1.0)));
          c = mix(c, floorC, smoothstep(0.08, 0.85, sp.g));
          float rows = sin((vWPos.x + vWPos.z) * 2.3) * 0.5 + 0.5;
          vec3 field = mix(cField * 0.75, cField * 1.15, rows);
          field = mix(field, vec3(0.16, 0.27, 0.06), smoothstep(0.55, 0.95, rows) * (0.5 + 0.5 * d1.r));
          c = mix(c, field, sp.a);
          c = mix(c, road, smoothstep(0.12, 0.55, sp.b * (0.7 + 0.55 * d1.r)));
          float sandW = 1.0 - smoothstep(0.1, 0.55, vWPos.y + (d1.r - 0.5) * 0.3);
          c = mix(c, sand, sandW);
          c = mix(c, c * vec3(0.5, 0.62, 0.64), 1.0 - smoothstep(-1.8, -0.1, vWPos.y));
          float slope = 1.0 - normalize(vWN).y;
          c = mix(c, rock, smoothstep(0.2, 0.36, slope + (d2.r - 0.5) * 0.12));
          c = mix(c, rock * (0.9 + 0.2 * d2.g), uHighTint * smoothstep(4.5, 8.0, vWPos.y + (d1.r - 0.5)));
          float lumT = dot(c, vec3(0.299, 0.587, 0.114));
          c = max(mix(vec3(lumT), c, 1.12), 0.0);
          // drifting cloud shadows
          float cl = texture2D(uDetail, wp * 0.0035 + vec2(uTime * 0.0042, uTime * 0.0021)).g;
          cl = smoothstep(0.52, 0.72, cl + texture2D(uDetail, wp * 0.011 + vec2(uTime * 0.006, 0.0)).r * 0.18);
          c *= 1.0 - cl * 0.22;
          return c;
        }`)
      .replace('#include <map_fragment>', 'diffuseColor.rgb = terrainColor();')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float fv = texture2D(uFow, vWPos.xz / uMapSize).r;
          float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 dim = mix(vec3(lum), gl_FragColor.rgb, 0.35) * 0.4;
          vec3 cc = mix(vec3(0.0), dim, smoothstep(0.03, 0.5, fv));
          gl_FragColor.rgb = mix(cc, gl_FragColor.rgb, smoothstep(0.5, 0.97, fv));
        }`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  GFX.scene.add(mesh);
  GFX.terrain = mesh;
}

function paintSplat(x, z, r, channel, value, square) {
  const map = GFX.map; if (!map) return;
  const T = map.splatRes, ts = map.size / T;
  const x0 = Math.floor((x - r) / ts), x1 = Math.ceil((x + r) / ts), z0 = Math.floor((z - r) / ts), z1 = Math.ceil((z + r) / ts);
  for (let ty = z0; ty <= z1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || ty < 0 || tx >= T || ty >= T) continue;
    const wx = (tx + 0.5) * ts, wz = (ty + 0.5) * ts;
    let w;
    if (square) w = smoothstep(r, r - 1.2, Math.max(Math.abs(wx - x), Math.abs(wz - z)));
    else w = smoothstep(r, r * 0.55, dist(wx, wz, x, z));
    const o = (ty * T + tx) * 4 + channel;
    const v = clamp(value * w * 255, 0, 255);
    if (v > map.splat[o]) map.splat[o] = v;
  }
  if (GFX.splatTex) GFX.splatTex.needsUpdate = true;
}

function buildWater(map) {
  const { N, V, H, size, biome } = map;
  // depth texture from vertices (meters/4 -> 0..255)
  const D = new Uint8Array(V * V * 4);
  let any = false;
  for (let i = 0; i < V * V; i++) {
    const d = clamp(-H[i] / 4, 0, 1);
    if (d > 0) any = true;
    D[i * 4] = d * 255;
  }
  if (!any) return;
  const dTex = new THREE.DataTexture(D, V, V, THREE.RGBAFormat);
  dTex.magFilter = THREE.LinearFilter; dTex.minFilter = THREE.LinearFilter; dTex.needsUpdate = true;
  const sd = GFX.sunDir;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uDepth: { value: dTex }, uFow: U.uFow, uMapSize: U.uMapSize, uTime: U.uTime, uDetail: { value: GFX.detail },
      uShallow: { value: linColor(biome.shallow) }, uDeep: { value: linColor(biome.deep) }, uSky: { value: linColor(biome.sky) },
      uSunDir: { value: sd.clone() }, uSunCol: { value: linColor(biome.sun) }, uSizeV: { value: V * CELL },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform sampler2D uDepth; uniform sampler2D uFow; uniform sampler2D uDetail; uniform float uMapSize; uniform float uTime; uniform float uSizeV;
      uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunCol;
      varying vec3 vW;
      void main(){
        vec2 uv = vW.xz / uSizeV;
        float depth = texture2D(uDepth, (vW.xz / ${CELL.toFixed(1)} + 0.5) / ${(V).toFixed(1)}).r * 4.0;
        if (depth < 0.015) discard;
        vec2 p = vW.xz;
        vec4 n1 = texture2D(uDetail, p * 0.045 + vec2(uTime * 0.011, uTime * 0.007));
        vec4 n2 = texture2D(uDetail, p * 0.083 - vec2(uTime * 0.009, -uTime * 0.013));
        vec2 g = (n1.rg + n2.gr - 1.0) * 0.55;
        vec3 N = normalize(vec3(g.x, 1.0, g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.1, 2.8, depth));
        col = mix(col, uSky * 0.9, fres * 0.55 + 0.08);
        vec3 Hh = normalize(normalize(uSunDir) + V);
        col += uSunCol * pow(max(dot(N, Hh), 0.0), 140.0) * 1.6;
        float foamBand = 1.0 - smoothstep(0.0, 0.38, depth);
        float foam = foamBand * (0.55 + 0.45 * sin(uTime * 1.7 + p.x * 0.7 + p.y * 0.4 + n1.r * 7.0));
        col = mix(col, vec3(0.93, 0.95, 0.95), foam * 0.6);
        float alpha = mix(0.4, 0.93, smoothstep(0.0, 1.3, depth));
        alpha = max(alpha, foam * 0.7);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        float fv = texture2D(uFow, vW.xz / uMapSize).r;
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 dim = mix(vec3(lum), gl_FragColor.rgb, 0.35) * 0.4;
        vec3 cc = mix(vec3(0.0), dim, smoothstep(0.03, 0.5, fv));
        gl_FragColor.rgb = mix(cc, gl_FragColor.rgb, smoothstep(0.5, 0.97, fv));
        gl_FragColor.a = mix(1.0, gl_FragColor.a, smoothstep(0.03, 0.3, fv));
      }`,
  });
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(size / 2, WATER_Y - 0.02, size / 2);
  mesh.renderOrder = 2;
  GFX.scene.add(mesh);
  GFX.water = mesh;
}

// ------------------------------------------------------------------ chunked instancing helper
function chunkedInstances(items, geo, material, opts = {}) {
  // items: [{x, y, z, rot, s, color?}] ; returns Map chunkKey -> mesh, and per-item {mesh, i}
  const cs = GFX.chunkSize;
  const buckets = new Map();
  items.forEach((it, idx) => {
    const k = Math.floor(it.x / cs) + ',' + Math.floor(it.z / cs);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(idx);
  });
  const refs = new Array(items.length);
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const col = new THREE.Color();
  for (const [k, list] of buckets) {
    const g = new THREE.BufferGeometry();
    for (const name in geo.attributes) g.setAttribute(name, geo.attributes[name]);
    if (geo.index) g.setIndex(geo.index);
    const mesh = new THREE.InstancedMesh(g, material, list.length);
    let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9, maxY = 0;
    list.forEach((idx, i) => {
      const it = items[idx];
      e.set(it.rx || 0, it.rot || 0, 0, 'YXZ'); q.setFromEuler(e);
      p.set(it.x, it.y, it.z); s.set(it.s, it.sy || it.s, it.s);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      if (it.color !== undefined) { col.copy(it.color); mesh.setColorAt(i, col); }
      refs[idx] = { mesh, i, it };
      minX = Math.min(minX, it.x); maxX = Math.max(maxX, it.x); minZ = Math.min(minZ, it.z); maxZ = Math.max(maxZ, it.z); maxY = Math.max(maxY, it.y);
    });
    const r = Math.sqrt((maxX - minX) ** 2 + (maxZ - minZ) ** 2) / 2 + (opts.radius || 6);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((minX + maxX) / 2, maxY + (opts.height || 3), (minZ + maxZ) / 2), r + (opts.height || 3));
    mesh.frustumCulled = true;
    mesh.castShadow = !!opts.castShadow; mesh.receiveShadow = opts.receiveShadow !== false;
    if (opts.depth) mesh.customDepthMaterial = opts.depth;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return { group, refs };
}

function buildDecor(map) {
  const { biome } = map;
  const heightAt = makeHeightSampler(map);
  GFX.heightAt = heightAt;
  const group = new THREE.Group();
  // grass geometry with baked biome colours (dark base -> light tip)
  const mkGrass = (tipHex, flower) => {
    const base = propGeo(flower ? 'flower' : 'grass').clone();
    const pos = base.attributes.position.array, colA = base.attributes.color.array;
    const cBase = linColor(srgbMix(biome.grassB, 0x203010, 0.35)), cTip = linColor(srgbMix(biome.grassA, 0xffffff, 0.12)), cF = linColor(tipHex);
    const tag = new Float32Array(pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) {
      const y = pos[i * 3 + 1], t = clamp(y / 0.55, 0, 1);
      let c = { r: lerp(cBase.r, cTip.r, t), g: lerp(cBase.g, cTip.g, t), b: lerp(cBase.b, cTip.b, t) };
      if (flower && colA[i * 3] > 0.99 && y > 0.3 && Math.abs(pos[i * 3]) < 0.25) {
        // flower heads are boxes (vertex count > blades) — identify by being part of a box near the top
      }
      colA[i * 3] = c.r; colA[i * 3 + 1] = c.g; colA[i * 3 + 2] = c.b;
      tag[i] = 0;
    }
    if (flower) { // recolour the last 3 boxes (36 verts each) as flower heads
      const nv = pos.length / 3;
      for (let i = nv - 108; i < nv; i++) { colA[i * 3] = cF.r; colA[i * 3 + 1] = cF.g; colA[i * 3 + 2] = cF.b; }
    }
    base.attributes.color.needsUpdate = true;
    return base;
  };
  const grassGeo = mkGrass(biome.grassA, false), flowerGeo = mkGrass(biome.flower, true), rockGeo = propGeo('rock');
  const grassItems = [], flowerItems = [], rockItems = [];
  const rng = new RNG(map.seed + 7);
  for (const d of map.decor) {
    const y = heightAt(d.x, d.z);
    if (y < 0.15) continue;
    const it = { x: d.x, y: y - 0.02, z: d.z, rot: d.rot, s: d.s, color: new THREE.Color().setScalar(rng.range(0.82, 1.12)) };
    if (d.type === 'grass') grassItems.push(it); else if (d.type === 'flower') flowerItems.push(it); else rockItems.push(it);
  }
  const gm = modelMaterial('grass');
  if (grassItems.length) group.add(chunkedInstances(grassItems, grassGeo, gm, { height: 1, radius: 2 }).group);
  if (flowerItems.length) group.add(chunkedInstances(flowerItems, flowerGeo, gm, { height: 1, radius: 2 }).group);
  if (rockItems.length) group.add(chunkedInstances(rockItems, rockGeo, modelMaterial('staticInstC'), { height: 1, radius: 2, castShadow: true }).group);
  GFX.decorGroup = group;
  GFX.scene.add(group);
}

// trees: one chunked instanced set per species; returns refs per tree index
function buildTrees(map, trees) {
  const heightAt = GFX.heightAt;
  const bySpecies = {};
  trees.forEach((t, i) => { (bySpecies[t.species] || (bySpecies[t.species] = [])).push(i); });
  GFX.treeRefs = new Array(trees.length);
  const rng = new RNG(map.seed + 3);
  const group = new THREE.Group();
  for (const sp in bySpecies) {
    const idxs = bySpecies[sp];
    const items = idxs.map((i) => {
      const t = trees[i];
      const tint = rng.range(0.82, 1.12);
      return { x: t.x, y: heightAt(t.x, t.z) - 0.1, z: t.z, rot: t.rot, s: t.scale, color: new THREE.Color(tint, tint * rng.range(0.96, 1.04), tint) };
    });
    const res = chunkedInstances(items, treeGeo(sp), modelMaterial('tree'), { height: 8, radius: 4, castShadow: true, depth: depthMaterial('tree') });
    idxs.forEach((ti, k) => { GFX.treeRefs[ti] = res.refs[k]; });
    group.add(res.group);
  }
  GFX.scene.add(group);
  GFX.treeGroup = group;
  GFX.fallingTrees = [];
}
const _tm4 = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tp = new THREE.Vector3(), _ts = new THREE.Vector3();
function setTreeMatrix(ref, fall, fallDir, scaleMul) {
  const it = ref.it;
  _te.set(fall, fallDir, 0, 'YXZ');
  _tq.setFromEuler(_te);
  _tp.set(it.x, it.y + (fall > 0 ? 0.15 : 0), it.z);
  const s = it.s * scaleMul;
  _ts.set(s, s, s);
  _tm4.compose(_tp, _tq, _ts);
  ref.mesh.setMatrixAt(ref.i, _tm4);
  ref.mesh.instanceMatrix.needsUpdate = true;
}
function treeStartFall(treeIdx, dir) {
  const ref = GFX.treeRefs && GFX.treeRefs[treeIdx];
  if (!ref || ref.fallen) return;
  ref.fallen = true;
  GFX.fallingTrees.push({ ref, t: 0, dir });
}
function treeRemove(treeIdx) {
  const ref = GFX.treeRefs && GFX.treeRefs[treeIdx];
  if (!ref) return;
  ref.removed = true;
  setTreeMatrix(ref, 0, 0, 0);
}
function updateFallingTrees(dt) {
  const L = GFX.fallingTrees;
  for (let i = L.length - 1; i >= 0; i--) {
    const f = L[i];
    if (f.ref.removed) { L.splice(i, 1); continue; }
    f.t = Math.min(1, f.t + dt * 1.1);
    const e = f.t * f.t;
    setTreeMatrix(f.ref, e * 1.48, f.dir, 1);
    if (f.t >= 1) L.splice(i, 1);
  }
}

// ------------------------------------------------------------------ fog of war texture update
function updateFowTexture(vis, explored, dt, reveal) {
  const N = GFX.map.N, cur = GFX.fowCur, data = GFX.fowTex.image.data;
  const k = Math.min(1, dt * 6);
  for (let i = 0; i < N * N; i++) {
    const target = reveal ? 1 : vis[i] ? 1 : explored[i] ? 0.5 : 0;
    let c = cur[i];
    if (c !== target) {
      c += (target - c) * k;
      if (Math.abs(target - c) < 0.01) c = target;
      cur[i] = c;
    }
    data[i * 4] = c * 255;
  }
  GFX.fowTex.needsUpdate = true;
}

// sun & shadow frustum follow the camera target
function updateSun(tx, tz, viewR) {
  const sun = GFX.sun, d = GFX.sunDir;
  const half = clamp(viewR * 1.15, 36, 150);
  const texel = (half * 2) / sun.shadow.mapSize.x;
  const sx = Math.round(tx / texel) * texel, sz = Math.round(tz / texel) * texel;
  sun.position.set(sx + d.x * 200, d.y * 200, sz + d.z * 200);
  sun.target.position.set(sx, 0, sz);
  const cam = sun.shadow.camera;
  if (cam.right !== half) {
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
  }
}
