// The imported deer use samples of their original, fully weighted glTF animations.
// The same per-instance frame drives the model and its shadow.
const DEER_MOTION_GLSL = /* glsl */`
attribute vec2 aDeerVertex;
attribute vec4 iAnim;
uniform sampler2D uDeerPositions;
uniform sampler2D uDeerNormals;
uniform vec3 uDeerPositionLayout;
uniform vec3 uDeerNormalLayout;
uniform float uDeerScale;
vec3 sampleDeerPose(sampler2D atlas, vec3 layoutSize, float index) {
  float frame = iAnim.z;
  vec2 vertex = vec2(mod(index, layoutSize.x), floor(index / layoutSize.x));
  vec2 a = (vertex + vec2(0.5, 0.5 + floor(frame) * layoutSize.z)) / layoutSize.xy;
  vec2 b = (vertex + vec2(0.5, 0.5 + ceil(frame) * layoutSize.z)) / layoutSize.xy;
  return mix(texture2D(atlas, a).xyz, texture2D(atlas, b).xyz, fract(frame));
}
vec3 deerPosition() { return sampleDeerPose(uDeerPositions, uDeerPositionLayout, aDeerVertex.x) * uDeerScale; }
vec3 deerNormal() { return normalize(sampleDeerPose(uDeerNormals, uDeerNormalLayout, aDeerVertex.y) * 255.0 - 127.0); }
`;

const DEER_ATLASES = new Map();

function deerMotionClips(key) {
  return DEER_ATLASES.get(ANIMAL_ART[key]?.[0])?.clips;
}

function deerPoseTexture(frames, count, type, sample) {
  const width = Math.min(count, 1024), rows = Math.ceil(count / width), height = frames * rows;
  const Storage = type === THREE.HalfFloatType ? Uint16Array : Uint8Array;
  const data = new Storage(width * height * 4);
  for (let frame = 0; frame < frames; frame++) {
    for (let v = 0; v < count; v++) {
      const pixel = (frame * width * rows + v) * 4;
      for (let axis = 0; axis < 3; axis++) {
        data[pixel + axis] = sample((frame * count + v) * 3 + axis);
      }
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, type);
  texture.needsUpdate = true;
  return { texture: { value: texture }, layout: { value: new THREE.Vector3(width, height, rows) } };
}

async function loadDeerMotion() {
  await Promise.all(['doe', 'stag'].map(async (key) => {
    try {
      const [count, , , , [clips, positions, normals, packed]] = ART_MODELS[key];
      const bytes = Uint8Array.from(atob(packed), (c) => c.charCodeAt(0));
      const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
      const view = new DataView(await new Response(stream).arrayBuffer());
      const frames = Object.values(clips).reduce((total, [, n]) => total + n, 0);
      const positionStart = count * 4, normalStart = positionStart + frames * positions * 6;
      const prevPositions = new Int16Array(positions * 3), prevNormals = new Int8Array(normals * 3);
      const p = deerPoseTexture(frames, positions, THREE.HalfFloatType, (i) => {
        const vertex = i % prevPositions.length;
        prevPositions[vertex] += view.getInt16(positionStart + i * 2, true);
        return THREE.DataUtils.toHalfFloat(prevPositions[vertex] / 16384);
      });
      const n = deerPoseTexture(frames, normals, THREE.UnsignedByteType, (i) => {
        const vertex = i % prevNormals.length;
        prevNormals[vertex] += view.getInt8(normalStart + i);
        return prevNormals[vertex] + 127;
      });
      const lookup = new Uint16Array(count * 2);
      for (let i = 0; i < lookup.length; i++) lookup[i] = view.getUint16(i * 2, true);
      DEER_ATLASES.set(key, { clips, lookup, uniforms: {
        uDeerPositions: p.texture, uDeerPositionLayout: p.layout,
        uDeerNormals: n.texture, uDeerNormalLayout: n.layout,
      } });
    } catch (error) {
      console.warn('Не удалось загрузить анимации оленевых', error);
    }
  }));
}

function animatedDeer(b, key, asset, fit, color) {
  const sourceVertices = [];
  const { scale } = artPart(b, asset, { fit, color, sourceVertices });
  const { lookup, uniforms } = DEER_ATLASES.get(asset);
  const geo = b.build();
  geo.setAttribute('aDeerVertex', new THREE.Float32BufferAttribute(sourceVertices.flatMap((i) => [lookup[i * 2], lookup[i * 2 + 1]]), 2));
  const motion = { ...uniforms, uDeerScale: { value: scale } };
  const material = MATS[key] = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), { motion, fow: false });
  const depth = makeDepthMaterial({ motion });
  return { geo, style: 1, material, depth };
}

function deerMotionFrame(clips, unit, alpha) {
  if (!unit.alive || unit.ko) {
    const [start, count, duration] = clips.Death;
    return start + clamp((unit.ko ? unit.koT : unit.deathT) / duration, 0, 1) * (count - 1);
  }
  let clip = clips.Idle;
  let cycles = Math.max(0, unit.animT - (1 - alpha) * TICK) / clip[2] + unit.rnd;
  if (unit.anim === ANIM.MOVE) {
    const walking = unit.order?.walk;
    clip = walking ? clips.Walk : clips.Gallop;
    const step = Math.hypot(unit.x - unit.px, unit.z - unit.pz);
    const phase = unit.walkPh - (1 - alpha) * step * unit.stride;
    cycles = phase / (TAU * (walking ? 1 : 1.5));
  }
  return clip[0] + (cycles - Math.floor(cycles)) * (clip[1] - 1);
}
