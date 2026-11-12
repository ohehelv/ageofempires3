// ---------------------------------------------------------------------------
// 06_gfx_common.js — shared uniforms, material patching (fog of war, GPU bone
// animation, wind, per-vertex material), PartBuilder geometry kit, textures
// ---------------------------------------------------------------------------
const U = {
  uFow: { value: null },
  uMapSize: { value: 320 },
  uTime: { value: 0 },
};

function linColor(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
function srgbMix(a, b, t) { // hex mix in sRGB space -> hex
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}

const ANIM_GLSL = /* glsl */`
attribute float aBone;
attribute vec3 aPivot;
attribute vec3 aPivot2;
attribute vec4 iAnim;
mat3 rotXm(float a){ float c=cos(a), s=sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }
mat3 rotYm(float a){ float c=cos(a), s=sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }
void rotAround(inout vec3 p, inout vec3 n, vec3 piv, mat3 r){ p = piv + r * (p - piv); n = r * n; }
float armAngle(bool right, float st, float t, float ph, float rnd, float rider, float style){
  if (st > 9.5) return right ? 0.35 : -0.25;                       // dead
  if (st < 0.5) return (right ? -0.04 : 0.05) + 0.035*sin(t*1.3 + rnd*6.0 + (right?0.0:1.0));
  if (st < 1.5) {
    if (rider > 0.5) return -0.55;
    float s = sin(ph) * (style < 0.5 ? 0.25 : 0.42);
    return right ? s : -s;
  }
  if (st < 2.5 || (st > 10.5 && st < 11.5)) {                     // gun / crossbow aim
    float rc = exp(-t*11.0) * 0.22;
    return (right ? -1.48 : -1.28) - rc;
  }
  if (st < 3.5) {                                                    // sword swing
    float s = fract(t * 0.85 + rnd);
    float a = s < 0.4 ? mix(-0.5, -2.6, smoothstep(0.0, 0.4, s)) : mix(-2.6, -0.25, smoothstep(0.4, 0.58, s));
    return right ? a : -0.55;
  }
  if (st < 4.5) {                                                    // work: chop / mine / hammer
    float s = fract(t * 0.9 + rnd);
    float a = s < 0.55 ? mix(-0.6, -2.5, smoothstep(0.0, 0.55, s)) : mix(-2.5, -0.55, smoothstep(0.55, 0.7, s));
    return right ? a : a * 0.85 + 0.15;
  }
  if (st < 5.5) return -0.85 + 0.28*sin(t*4.5 + (right?0.0:1.7));   // gather / farm
  if (st < 6.5) {                                                    // pike / bayonet thrust
    float th = max(0.0, sin(t * 5.5)) * 0.28;
    return (right ? -1.25 : -1.15) - th;
  }
  if (st < 7.5) return right ? -0.35 : -0.2;                         // gun crew
  if (st < 8.5) {                                                    // bow
    float s = fract(t * 0.4 + rnd);
    return right ? (-1.35 + 0.25*smoothstep(0.1,0.7,s)) : -1.55;
  }
  if (st < 9.5) {                                                    // throw
    float s = fract(t / 3.5);
    float a = s < 0.35 ? mix(-0.3, 0.9, smoothstep(0.0, 0.35, s)) : (s < 0.45 ? mix(0.9, -2.5, smoothstep(0.35, 0.45, s)) : mix(-2.5, -0.3, smoothstep(0.45, 0.8, s)));
    return right ? a : -0.6;
  }
  return 0.0;
}
float weaponAngle(bool right, float st, float t, float arm, float style){
  // style 0 gun, 1 sword/tool, 2 pike, 3 bow (left), 4 shield (left)
  if (style < 0.5) {
    if (st > 1.5 && st < 2.5 || (st > 10.5 && st < 11.5)) return 1.5708 - arm - exp(-t*12.0)*0.12;
    if (st > 5.5 && st < 6.5) return 1.5708 - arm;
    if (st > 2.5 && st < 3.5) return 2.9;
    return 0.0;
  }
  if (style < 1.5) return 2.75;
  if (style < 2.5) {
    if ((st > 5.5 && st < 6.5) || (st > 2.5 && st < 3.5)) return 1.5708 - arm;
    return 0.0;
  }
  if (style < 3.5) return -arm;
  return -arm * 0.6;
}
void animApply(inout vec3 p, inout vec3 n){
  float b = aBone;
  if (b < 0.5) return;
  float st = iAnim.x, t = iAnim.y, ph = iAnim.z;
  float style = floor(iAnim.w), rnd = fract(iAnim.w);
  float rider = 0.0;
  if (b > 19.5) { rider = 1.0; b -= 20.0; }
  vec3 off = vec3(0.0);
  bool moving = st > 0.5 && st < 1.5;
  if (b < 0.5) {
  } else if (b < 2.5) {
    float s = (moving && rider < 0.5) ? sin(ph) * 0.62 : 0.0;
    float a = b < 1.5 ? s : -s;
    if (st > 9.5) a = b < 1.5 ? 0.25 : -0.1;
    rotAround(p, n, aPivot, rotXm(a));
  } else if (b < 6.5) {
    bool right = (b > 3.5 && b < 5.5);
    float arm = armAngle(right, st, t, ph, rnd, rider, style);
    if (b > 4.5) {
      float w = weaponAngle(right, st, t, arm, style);
      rotAround(p, n, aPivot, rotXm(w));
      rotAround(p, n, aPivot2, rotXm(arm));
    } else {
      rotAround(p, n, aPivot, rotXm(arm));
    }
  } else if (b < 10.5) {
    float k = b - 7.0;
    float pha = ph + (k < 0.5 ? 0.0 : k < 1.5 ? 3.14159 : k < 2.5 ? 1.5708 : 4.7124);
    float amp = moving ? 0.6 : 0.0;
    if (st > 9.5) amp = 0.0;
    rotAround(p, n, aPivot, rotXm(sin(pha) * amp));
  } else if (b < 11.5) {
    float a = 0.0;
    if (st < 0.5) a = 0.5 * smoothstep(0.2, 0.9, sin(t * 0.35 + rnd * 6.28));
    else if (moving) { a = sin(ph * 2.0) * 0.08; off.y += abs(sin(ph)) * 0.07; }
    else if (st > 2.5 && st < 3.5) a = -0.25 + 0.55 * max(0.0, sin(t * 8.0));
    else if (st > 9.5) a = 0.5;
    rotAround(p, n, aPivot, rotXm(a));
  } else if (b < 12.5) {
    float a = sin(t * 3.0 + rnd * 5.0) * 0.3 + (moving ? sin(ph) * 0.25 : 0.0);
    rotAround(p, n, aPivot, rotYm(a));
  } else if (b < 13.5) {
    if (moving) off.y += abs(sin(ph)) * 0.07;
  } else if (b < 14.5) {
    rotAround(p, n, aPivot, rotXm(ph));
  } else if (b < 15.5) {
    if (st > 6.5 && st < 7.5) off.z -= exp(-t * 6.0) * 0.35;
  }
  if (rider > 0.5 && moving) off.y += abs(sin(ph)) * 0.09;
  p += off;
}
`;

// patch a MeshStandardMaterial / MeshLambertMaterial
// opts: { anim, motion, team, vmat, wind (amplitude), fow (default true) }
function patchMaterial(mat, opts = {}) {
  const fow = opts.fow !== false;
  const key = ['p', opts.motion ? 'm' : opts.anim ? 'a' : '', opts.team ? 't' : '', opts.vmat ? 'v' : '', opts.wind ? 'w' + opts.wind : '', fow ? 'f' : ''].join('');
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFow = U.uFow; sh.uniforms.uMapSize = U.uMapSize; sh.uniforms.uTime = U.uTime;
    if (opts.motion) Object.assign(sh.uniforms, opts.motion);
    let vs = sh.vertexShader, fs = sh.fragmentShader;
    let vpre = 'varying vec3 vFowPos;\nuniform float uTime;\n';
    if (opts.motion) vpre += DEER_MOTION_GLSL;
    else if (opts.anim) vpre += ANIM_GLSL;
    if (opts.team) vpre += 'attribute float aTeam;\nattribute vec3 iTeam;\nvarying float vTeam;\nvarying vec3 vTeamCol;\n';
    if (opts.vmat) vpre += 'attribute vec2 aMat;\nvarying vec2 vMat;\n';
    vs = vs.replace('#include <common>', '#include <common>\n' + vpre);
    let bn = 'vec3 objectNormal = vec3( normal );\n';
    if (opts.motion) bn += 'objectNormal = deerNormal();\n';
    else if (opts.anim) bn += '{ vec3 _p = position; animApply(_p, objectNormal); }\n';
    vs = vs.replace('#include <beginnormal_vertex>', bn);
    let bv = 'vec3 transformed = vec3( position );\n';
    if (opts.motion) bv += 'transformed = deerPosition();\n';
    else if (opts.anim) bv += '{ vec3 _n = vec3(0.0,1.0,0.0); animApply(transformed, _n); }\n';
    if (opts.wind) {
      bv += `{
        vec3 iw = vec3(0.0);
        #ifdef USE_INSTANCING
        iw = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #endif
        float sw = sin(uTime*1.3 + iw.x*0.23 + iw.z*0.19) * 0.6 + sin(uTime*2.9 + iw.x*0.71 - iw.z*0.4) * 0.3;
        float hh = max(transformed.y, 0.0);
        float amt = ${opts.wind.toFixed(4)} * hh * hh;
        transformed.x += sw * amt; transformed.z += sw * amt * 0.5;
      }\n`;
    }
    vs = vs.replace('#include <begin_vertex>', bv);
    let extra = '';
    if (opts.team) extra += 'vTeam = aTeam; vTeamCol = iTeam;\n';
    if (opts.vmat) extra += 'vMat = aMat;\n';
    vs = vs.replace('#include <color_vertex>', '#include <color_vertex>\n' + extra);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 fowWP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      fowWP = instanceMatrix * fowWP;
      #endif
      fowWP = modelMatrix * fowWP;
      vFowPos = fowWP.xyz;`);
    let fpre = 'varying vec3 vFowPos;\nuniform sampler2D uFow;\nuniform float uMapSize;\n';
    if (opts.team) fpre += 'varying float vTeam;\nvarying vec3 vTeamCol;\n';
    if (opts.vmat) fpre += 'varying vec2 vMat;\n';
    fs = fs.replace('#include <common>', '#include <common>\n' + fpre);
    if (opts.team) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vTeamCol, vTeam);\n');
    if (opts.vmat) {
      fs = fs.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.x;');
      fs = fs.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.y;');
    }
    if (fow) {
      fs = fs.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      {
        float fv = texture2D(uFow, vFowPos.xz / uMapSize).r;
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 dim = mix(vec3(lum), gl_FragColor.rgb, 0.35) * 0.4;
        vec3 c = mix(vec3(0.0), dim, smoothstep(0.03, 0.5, fv));
        gl_FragColor.rgb = mix(c, gl_FragColor.rgb, smoothstep(0.5, 0.97, fv));
      }`);
    }
    sh.vertexShader = vs; sh.fragmentShader = fs;
  };
  return mat;
}
// depth material for animated / wind-swayed instanced meshes (so shadows move too)
function makeDepthMaterial(opts) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const key = 'd' + (opts.motion ? 'm' : opts.anim ? 'a' : '') + (opts.wind ? 'w' + opts.wind : '');
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    if (opts.motion) Object.assign(sh.uniforms, opts.motion);
    let vs = sh.vertexShader;
    const pre = 'uniform float uTime;\n' + (opts.motion ? DEER_MOTION_GLSL : opts.anim ? ANIM_GLSL : '');
    vs = vs.replace('#include <common>', '#include <common>\n' + pre);
    let bv = 'vec3 transformed = vec3( position );\n';
    if (opts.motion) bv += 'transformed = deerPosition();\n';
    else if (opts.anim) bv += '{ vec3 _n = vec3(0.0,1.0,0.0); animApply(transformed, _n); }\n';
    if (opts.wind) bv += `{
        vec3 iw = vec3(0.0);
        #ifdef USE_INSTANCING
        iw = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #endif
        float sw = sin(uTime*1.3 + iw.x*0.23 + iw.z*0.19) * 0.6 + sin(uTime*2.9 + iw.x*0.71 - iw.z*0.4) * 0.3;
        float hh = max(transformed.y, 0.0);
        float amt = ${opts.wind.toFixed(4)} * hh * hh;
        transformed.x += sw * amt; transformed.z += sw * amt * 0.5;
      }\n`;
    vs = vs.replace('#include <begin_vertex>', bv);
    sh.vertexShader = vs;
  };
  return m;
}

// ----------------------------------------------------------------- PartBuilder
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3();

class PartBuilder {
  constructor() { this.P = []; this.Nn = []; this.Cc = []; this.T = []; this.B = []; this.PV = []; this.PV2 = []; this.M = []; this.tag = []; this.indices = null; }
  add(geo, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
    _q.setFromEuler(_e);
    _v3.set(o.x || 0, o.y || 0, o.z || 0);
    _s3.set(o.sx || 1, o.sy || 1, o.sz || 1);
    _m4.compose(_v3, _q, _s3);
    g.applyMatrix4(_m4);
    if (o.post) g.applyMatrix4(o.post);
    if (!o.smooth) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const col = linColor(o.color === undefined ? 0xffffff : o.color);
    const vary = o.vary || 0;
    const team = o.team || 0, bone = o.bone || 0;
    const pv = o.pivot || [0, 0, 0], pv2 = o.pivot2 || pv;
    const rough = o.rough === undefined ? 0.8 : o.rough, metal = o.metal || 0;
    const nv = p.length / 3;
    for (let i = 0; i < nv; i++) {
      if (this.indices) this.indices.push(this.P.length / 3);
      this.P.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      this.Nn.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      let k = 1;
      if (vary) k = 1 + (Math.sin(p[i * 3] * 12.9 + p[i * 3 + 1] * 78.2 + p[i * 3 + 2] * 37.7) * 0.5) * vary;
      this.Cc.push(col.r * k, col.g * k, col.b * k);
      this.T.push(team); this.B.push(bone);
      this.PV.push(pv[0], pv[1], pv[2]); this.PV2.push(pv2[0], pv2[1], pv2[2]);
      this.M.push(rough, metal);
      this.tag.push(o.tag || 0);
    }
    return this;
  }
  box(w, h, d, x, y, z, color, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), Object.assign({}, o, { x, y, z, color })); }
  cyl(rt, rb, h, seg, x, y, z, color, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), Object.assign({}, o, { x, y, z, color })); }
  sphere(r, x, y, z, color, o = {}) { return this.add(new THREE.SphereGeometry(r, o.ws || 7, o.hs || 5), Object.assign({}, o, { x, y, z, color })); }
  ico(r, x, y, z, color, o = {}) { return this.add(new THREE.IcosahedronGeometry(r, o.detail || 0), Object.assign({}, o, { x, y, z, color })); }
  dodec(r, x, y, z, color, o = {}) { return this.add(new THREE.DodecahedronGeometry(r, 0), Object.assign({}, o, { x, y, z, color })); }
  cone(r, h, seg, x, y, z, color, o = {}) { return this.add(new THREE.ConeGeometry(r, h, seg), Object.assign({}, o, { x, y, z, color })); }
  torus(r, t, x, y, z, color, o = {}) { return this.add(new THREE.TorusGeometry(r, t, o.rs || 5, o.ts || 12), Object.assign({}, o, { x, y, z, color })); }
  // gable roof: ridge along X (length w), slopes down to z = ±d/2, height h, base at y
  gable(w, d, h, x, y, z, color, o = {}) { return this.add(gableGeo(w, d, h), Object.assign({}, o, { x, y, z, color })); }
  // square pyramid roof (side s, height h)
  pyramid(s, h, x, y, z, color, o = {}) {
    const g = new THREE.ConeGeometry(s / Math.SQRT2, h, 4); g.rotateY(PI / 4);
    return this.add(g, Object.assign({}, o, { x, y: y + h / 2, z, color }));
  }
  merge(other, o = {}) { // append another builder's data (optional offset)
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
    for (let i = 0; i < other.P.length; i += 3) this.P.push(other.P[i] + ox, other.P[i + 1] + oy, other.P[i + 2] + oz);
    this.Nn.push(...other.Nn); this.Cc.push(...other.Cc); this.T.push(...other.T); this.B.push(...other.B);
    for (let i = 0; i < other.PV.length; i += 3) { this.PV.push(other.PV[i] + ox, other.PV[i + 1] + oy, other.PV[i + 2] + oz); this.PV2.push(other.PV2[i] + ox, other.PV2[i + 1] + oy, other.PV2[i + 2] + oz); }
    this.M.push(...other.M); this.tag.push(...other.tag);
    return this;
  }
  // bake: if teamHex given, team-flagged vertices take that colour and no team attribute is emitted
  build(teamHex) {
    const g = new THREE.BufferGeometry();
    if (this.indices) g.setIndex(this.indices);
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.Nn, 3));
    let C = this.Cc;
    if (teamHex !== undefined) {
      const tc = linColor(teamHex);
      C = this.Cc.slice();
      for (let i = 0; i < this.T.length; i++) {
        const t = this.T[i];
        if (t > 0) { C[i * 3] = lerp(C[i * 3], tc.r, t); C[i * 3 + 1] = lerp(C[i * 3 + 1], tc.g, t); C[i * 3 + 2] = lerp(C[i * 3 + 2], tc.b, t); }
      }
    } else {
      g.setAttribute('aTeam', new THREE.Float32BufferAttribute(this.T, 1));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('aBone', new THREE.Float32BufferAttribute(this.B, 1));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.PV, 3));
    g.setAttribute('aPivot2', new THREE.Float32BufferAttribute(this.PV2, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.M, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  // only vertices with a given tag (e.g. mill blades split out)
  buildTag(tag, teamHex) {
    const b = new PartBuilder();
    for (let v = 0; v < this.tag.length; v++) {
      if (this.tag[v] !== tag) continue;
      b.P.push(this.P[v * 3], this.P[v * 3 + 1], this.P[v * 3 + 2]); b.Nn.push(this.Nn[v * 3], this.Nn[v * 3 + 1], this.Nn[v * 3 + 2]);
      b.Cc.push(this.Cc[v * 3], this.Cc[v * 3 + 1], this.Cc[v * 3 + 2]); b.T.push(this.T[v]); b.B.push(this.B[v]);
      b.PV.push(this.PV[v * 3], this.PV[v * 3 + 1], this.PV[v * 3 + 2]); b.PV2.push(this.PV2[v * 3], this.PV2[v * 3 + 1], this.PV2[v * 3 + 2]);
      b.M.push(this.M[v * 2], this.M[v * 2 + 1]); b.tag.push(0);
    }
    return b.P.length ? b.build(teamHex) : null;
  }
  without(tag) {
    const b = new PartBuilder();
    for (let v = 0; v < this.tag.length; v++) {
      if (this.tag[v] === tag) continue;
      b.P.push(this.P[v * 3], this.P[v * 3 + 1], this.P[v * 3 + 2]); b.Nn.push(this.Nn[v * 3], this.Nn[v * 3 + 1], this.Nn[v * 3 + 2]);
      b.Cc.push(this.Cc[v * 3], this.Cc[v * 3 + 1], this.Cc[v * 3 + 2]); b.T.push(this.T[v]); b.B.push(this.B[v]);
      b.PV.push(this.PV[v * 3], this.PV[v * 3 + 1], this.PV[v * 3 + 2]); b.PV2.push(this.PV2[v * 3], this.PV2[v * 3 + 1], this.PV2[v * 3 + 2]);
      b.M.push(this.M[v * 2], this.M[v * 2 + 1]); b.tag.push(this.tag[v]);
    }
    return b;
  }
}

function gableGeo(w, d, h) {
  const hw = w / 2, hd = d / 2;
  const v = [
    // slope +z
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    // slope -z
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
    // gable +x
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
    // gable -x
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    // underside
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// standard material used by all procedural models
const MATS = {};
function modelMaterial(kind) {
  if (MATS[kind]) return MATS[kind];
  let m;
  if (kind === 'unit') {
    m = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }), { anim: true, team: true, vmat: true, fow: false });
  } else if (kind === 'static') {
    m = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), { vmat: true });
  } else if (kind === 'staticInst' || kind === 'staticInstC') {
    // separate material objects: r149 does not switch programs between instanced meshes with and without instanceColor
    m = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), { vmat: true });
  } else if (kind === 'staticNoFow') {
    m = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), { vmat: true, fow: false });
  } else if (kind === 'tree') {
    m = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), { wind: 0.0022, vmat: true });
  } else if (kind === 'grass') {
    m = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }), { wind: 0.18 });
  } else if (kind === 'ghost') {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, opacity: 0.55, depthWrite: false });
  }
  MATS[kind] = m;
  return m;
}
const DEPTHS = {};
function depthMaterial(kind) {
  if (DEPTHS[kind]) return DEPTHS[kind];
  if (kind === 'unit') DEPTHS[kind] = makeDepthMaterial({ anim: true });
  else if (kind === 'tree') DEPTHS[kind] = makeDepthMaterial({ wind: 0.0022 });
  return DEPTHS[kind];
}

// ----------------------------------------------------------------- textures
function makeDetailTexture() {
  const S = 256;
  const a = tileFbm(S, 8, 5, 11), b = tileFbm(S, 3, 4, 23), c = tileFbm(S, 32, 2, 37);
  const rng = new RNG(99);
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const speck = c[i] > 0.62 ? 1 : 0;
    data[i * 4] = clamp(a[i] * 255, 0, 255);
    data[i * 4 + 1] = clamp(b[i] * 255, 0, 255);
    data[i * 4 + 2] = clamp((c[i] * 0.6 + rng.next() * 0.4) * 255, 0, 255);
    data[i * 4 + 3] = speck * 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
function makeSpriteTexture(kind) {
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (kind === 'smoke') {
    const rng = new RNG(5);
    for (let k = 0; k < 7; k++) {
      const x = S / 2 + rng.range(-9, 9), y = S / 2 + rng.range(-9, 9), r = rng.range(12, 20);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  } else {
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(cv);
  return t;
}
