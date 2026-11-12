// The packed CC-licensed meshes share the existing building, fog and instancing shaders.
const ART_CACHE = new Map();
const ART_COLORS = new Map();

function artMesh(key) {
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);
  const [count, encoded, groups, joints] = ART_MODELS[key];
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const vertices = [], indices = [], bounds = new THREE.Box3();
  for (let i = 0; i < count; i++) {
    const at = i * 13;
    const p = new THREE.Vector3(view.getInt16(at, true), view.getInt16(at + 2, true), view.getInt16(at + 4, true)).multiplyScalar(1 / 16384);
    const n = new THREE.Vector3(view.getInt8(at + 6), view.getInt8(at + 7), view.getInt8(at + 8));
    const color = (bytes[at + 9] << 16) | (bytes[at + 10] << 8) | bytes[at + 11];
    vertices.push({ p, n, color, joint: bytes[at + 12] });
    bounds.expandByPoint(p);
  }
  for (let at = count * 13; at < bytes.length; at += 2) indices.push(view.getUint16(at, true));
  const mesh = { vertices, indices, groups, joints, bounds };
  ART_CACHE.set(key, mesh);
  return mesh;
}

function artPart(b, key, options = {}) {
  const model = artMesh(key);
  const size = model.bounds.getSize(new THREE.Vector3());
  const fit = options.fit || [];
  const uniform = Math.min(...fit.map((n, i) => n ? n / Math.max(size.getComponent(i), 0.001) : Infinity));
  const scale = options.scale || (Number.isFinite(uniform) ? uniform : 1);
  const stretch = options.stretch || [1, 1, 1];
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(options.x || 0, options.y || 0, options.z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(options.rx || 0, options.ry || 0, options.rz || 0)),
    new THREE.Vector3(stretch[0], stretch[1], stretch[2]).multiplyScalar(scale),
  );
  if (options.centerY) transform.multiply(new THREE.Matrix4().makeTranslation(0, -size.y / 2, 0));
  const normal = new THREE.Matrix3().getNormalMatrix(transform);
  const point = (p) => new THREE.Vector3().fromArray(p).applyMatrix4(transform).toArray();
  const joints = new Map(model.joints.map(([name, ...p]) => [name, point(p)]));
  const rig = options.rig ? options.rig(joints) : null;
  const defaultPivot = options.pivot || [0, 0, 0];
  const defaultBone = options.bone || 0;
  const bounds = new THREE.Box3();
  const remap = new Map();
  if (!b.indices) b.indices = Array.from({ length: b.P.length / 3 }, (_, i) => i);
  let first = 0;
  for (const [name, length] of model.groups) {
    const end = first + length;
    if (options.part && !options.part(name)) { first = end; continue; }
    for (; first < end; first++) {
      const index = model.indices[first];
      if (remap.has(index)) { b.indices.push(remap.get(index)); continue; }
      const v = model.vertices[index];
      const p = v.p.clone().applyMatrix4(transform);
      const n = v.n.clone().applyMatrix3(normal).normalize();
      const joint = model.joints[v.joint]?.[0] || '';
      const binding = rig?.get(joint) || options.vertexRig?.(p, v.color);
      if (binding?.rest) {
        p.sub(binding.origin).applyQuaternion(binding.rest).add(binding.origin);
        n.applyQuaternion(binding.rest);
      }
      const color = options.color ? options.color(v.color, joint, p) : v.color;
      const team = options.team ? options.team(v.color, joint, p) : 0;
      if (!ART_COLORS.has(color)) ART_COLORS.set(color, linColor(color));
      const c = ART_COLORS.get(color);
      const pivot = binding?.pivot || defaultPivot;
      const vertex = b.P.length / 3;
      remap.set(index, vertex);
      b.indices.push(vertex);
      b.P.push(p.x, p.y, p.z); b.Nn.push(n.x, n.y, n.z); b.Cc.push(c.r, c.g, c.b);
      b.T.push(team); b.B.push(binding?.bone ?? defaultBone);
      b.PV.push(...pivot); b.PV2.push(...(options.pivot2 || pivot));
      b.M.push(options.rough ?? 0.82, options.metal ?? 0); b.tag.push(0);
      bounds.expandByPoint(p);
    }
  }
  return { bounds, joints, point };
}

const BUILDING_ART = {
  house: ['cottage', 3.85, 4.35, 3.85],
  tc: ['manor', 9.1, 8.7, 8.3],
  mill: ['mill', 6.4, 8.6, 5.8],
  market: ['houseLong', 4.4, 4.7, 5.7, -1.35, 0, -0.6],
  plantation: ['cottage', 2.8, 3.9, 3.8, -1.25, 0, -0.6],
  barracks: ['hall', 6.5, 5.8, 6.2, 0, 0, -0.45],
  stable: ['stable', 7.7, 5.8, 7.4],
  church: ['houseLong', 6.1, 6.8, 5.7, 0, 0, -1.05],
  foundry: ['smithy', 7.7, 8.9, 7.7],
  arsenal: ['hall', 6.9, 5.8, 6.6, 0, 0, -0.3],
  tower: ['bastion', 5.7, 8.2, 5.7],
  tradingPost: ['sawmill', 5.6, 5.8, 5.1, 0, 0, -0.45],
  fort: ['keep', 5.1, 10.5, 5.1, 0, 0, -1.5],
};

const FORT_STONE = new Set(['keep', 'bastion', 'wall', 'gate']);

function stonePalette(hex) {
  const r = hex >> 16, g = (hex >> 8) & 255, b = hex & 255;
  return Math.min(r, g, b) > 125 ? srgbMix(hex, 0x756e5f, 0.62) : hex;
}

function importedBuilding(key, civ, colorHex) {
  const layout = BUILDING_ART[key];
  if (!layout) return null;
  const [model, w, h, d, x, y, z] = layout;
  const b = new PartBuilder();
  const roof = (CIVS[civ] || CIVS.britain).palette.roof;
  const tintRoof = (hex) => {
    const r = hex >> 16, g = (hex >> 8) & 255, blue = hex & 255;
    return r > 65 && r > g * 1.28 && r > blue * 1.32 ? srgbMix(hex, roof, 0.37) : hex;
  };
  const base = artPart(b, model, { fit: [w, h, d], x, y, z, color: FORT_STONE.has(model) ? stonePalette : tintRoof,
    part: key === 'mill' ? (name) => name !== 'Mill_Blades' : undefined });
  const put = (name, fit, px, pz, py = 0, ry = 0) => artPart(b, name, {
    fit, x: px, z: pz, y: py, ry, color: FORT_STONE.has(name) ? stonePalette : undefined,
  });
  const height = base.bounds.max.y;
  let blades, bladePivot, bladeAxis;
  switch (key) {
    case 'house':
      b.box(0.42, 0.3, 0.04, 0, 1.1, base.bounds.max.z - 0.02, TEAM, { team: 0.85 });
      break;
    case 'tc':
      put('well', [1.6, 2.2, 1.65], -3.65, 3.4);
      flagPole(b, 3.55, 0, 3.2, 5.2, 1.3);
      break;
    case 'mill': {
      const sails = new PartBuilder();
      const rotor = artPart(sails, 'mill', { fit: [w, h, d], part: (name) => name === 'Mill_Blades' });
      blades = sails.build(colorHex);
      bladePivot = rotor.bounds.getCenter(new THREE.Vector3()).toArray();
      const span = rotor.bounds.getSize(new THREE.Vector3());
      bladeAxis = span.x < span.z ? 'x' : 'z';
      for (const px of [-1.95, 1.95]) put('wheat', [1.1, 1.1, 1.1], px, 2.05);
      break;
    }
    case 'market':
      put('stall', [3.0, 3.0, 3.3], 2.1, 1.35);
      put('sacks', [1.2, 0.9, 1.1], -0.2, 2.85);
      flagPole(b, 2.65, 0, -2.4, 3.3, 0.95);
      break;
    case 'plantation':
      for (const px of [0.3, 1.5, 2.4]) for (const pz of [-1.6, -0.2, 1.2, 2.3]) {
        put('corn', [0.85, 1.25, 1], px, pz, 0, px + pz);
      }
      flagPole(b, -2.3, 0, 2.05, 3.4, 0.75);
      break;
    case 'barracks':
      put('target', [1.1, 1.8, 1], -2.7, 2.65);
      put('fence', [3.6, 1, 1], 1.25, 2.95);
      flagPole(b, 2.8, 0, 2.25, 4.6, 1.2);
      break;
    case 'stable':
      put('hay', [1.1, 0.8, 1.2], 2.5, 2.35);
      flagPole(b, -2.7, 0, 2.4, 3.4, 0.85);
      break;
    case 'church': {
      const tower = put('bellTower', [3.2, 12.25, 3.2], 0, 2.15);
      const top = tower.bounds.max.y;
      b.box(0.15, 1.05, 0.15, 0, top + 0.34, 2.15, COL.brass);
      b.box(0.72, 0.15, 0.15, 0, top + 0.46, 2.15, COL.brass);
      put('gothicWindow', [1.2, 2.25, 0.3], -1.4, 2.12, 1.8);
      break;
    }
    case 'foundry':
      put('cannon', [1.8, 1.35, 2.1], 2.6, 2.4, 0, -0.15);
      put('barrel', [0.85, 0.95, 0.85], 0.8, 2.85);
      flagPole(b, -2.5, 0, 2.5, 3.9, 0.9);
      break;
    case 'arsenal':
      put('crate', [1.2, 1.05, 1.2], -2.1, 2.6);
      put('barrel', [0.85, 0.95, 0.85], -3.15, 2.45);
      put('cannon', [1.9, 1.1, 1.7], 2.65, 2.5, 0, 0.7);
      flagPole(b, 3.15, 0, 0, 4.8, 1.1);
      break;
    case 'tower':
      put('cannon', [1.9, 1.2, 2], 0, 0.42, height - 0.48, PI / 2);
      flagPole(b, -0.95, height - 0.48, -0.95, 1.9, 1.2);
      break;
    case 'tradingPost':
      put('stallWide', [2.75, 2.6, 2.8], 1.0, 1.45);
      put('sacks', [0.85, 0.9, 0.85], -1.8, 2.1);
      flagPole(b, -2.25, 0, -0.8, 3.9, 1.0);
      break;
    case 'fort':
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) put('bastion', [2.85, 6.4, 2.85], side * 4.25, end * 4.25);
        put('wall', [8.15, 4.0, 1.85], side * 4.25, 0, 0, PI / 2);
      }
      put('wall', [8.15, 4.0, 1.85], 0, -4.25);
      put('gate', [8.15, 4.5, 1.85], 0, 4.25);
      flagPole(b, 0, height * 0.78, -1.5, 3.5, 1.5);
      break;
  }
  return { main: b.build(colorHex), blades, bladePivot, bladeAxis, chimney: null };
}

const TREE_ART_HEIGHT = { pine: 6.9, snowpine: 6.4, spruce: 6.5, oak: 5.6, cottonwood: 6.0, birch: 6.0, mesquite: 3.8, saguaro: 4.25 };

function importedTree(species) {
  const h = TREE_ART_HEIGHT[species];
  if (!h) return null;
  const b = new PartBuilder();
  artPart(b, species, { fit: [h * 1.15, h, h * 1.15] });
  return b.build(0xffffff);
}

const PROP_ART = {
  mine: [['rockMoss', [4.1, 2.6, 3.9]], ['rock', [1.6, 1.5, 1.5], 1.4, 0.85], ['coinBag', [0.8, 0.8, 0.8], 0.65, 1.35]],
  quarry: [['rock', [3.5, 2.45, 3.3]], ['rock', [2.45, 1.6, 2.0], -1.25, 0.55], ['rock', [1.15, 0.8, 1.2], 1.1, 1.2]],
  bush: [['berries', [2.3, 1.2, 2.1]]],
  crate_food: [['sacks', [1.1, 0.9, 0.85]]],
  crate_wood: [['log', [1.25, 0.48, 0.85]], ['log', [0.85, 0.36, 0.65], 0.18, 0.15, 0.25]],
  crate_stone: [['crate', [0.9, 0.53, 0.85]], ['rock', [0.66, 0.4, 0.65], 0, 0, 0.42]],
  crate_coin: [['coinBag', [0.9, 0.9, 0.85]]],
  treasure: [['treasure', [1.75, 1.25, 1.55]]],
  socket: [['fence', [1.4, 1.5, 1.2]], ['crate', [0.62, 0.64, 0.62], 0.48, 0.38]],
  routePost: [['fence', [0.85, 1.25, 0.55]]],
  grass: [['grass', [0.8, 0.5, 0.8]]],
  flower: [['flowers', [0.8, 0.52, 0.8]]],
  rock: [['rock', [0.94, 0.52, 0.87]]],
};

function importedProp(key) {
  const parts = PROP_ART[key];
  if (!parts) return null;
  const b = new PartBuilder();
  for (const [model, fit, x, z, y] of parts) artPart(b, model, { fit, x, y, z });
  return b.build(0xffffff);
}
