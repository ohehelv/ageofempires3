// ---------------------------------------------------------------------------
// 07_models.js — procedural low-poly models (units with bones, buildings,
// trees, resources, decor). Models face +Z, origin at ground centre.
// ---------------------------------------------------------------------------
const COL = {
  skin: 0xe2b48c, skin2: 0xc4906a, boot: 0x2b241f, leather: 0x6b4a2e, linen: 0xd9ceb1, white: 0xebe6d8, black: 0x1f1d1b,
  steel: 0x9aa1a8, iron: 0x3c3f44, brass: 0xc9a24a, bronze: 0xa8743a, wood: 0x7a5a3a, darkWood: 0x4b3624, stone: 0x8f8a80,
  stoneDark: 0x6c6860, plaster: 0xe2d8c0, hay: 0xd8b85a, canvas: 0xe9e0c8, red: 0x9e2b25, fur: 0x3a2d22, gold: 0xe0b53a,
};
const TEAM = 0xffffff;

// ------------------------------------------------------------------ humans
// returns hand/shoulder pivots. o.rider -> bones +20 and seated legs
function buildHuman(b, o) {
  if (ART_MODELS.farmer) return importedHuman(b, o);
  const R = o.rider ? 20 : 0;
  const oy = o.oy || 0;
  const hipY = 0.86 + oy, shY = 1.42 + oy, shX = 0.26;
  const coat = o.coat === undefined ? TEAM : o.coat, coatTeam = o.coat === undefined ? 1 : (o.coatTeam || 0);
  const sleeve = o.sleeve === undefined ? coat : o.sleeve, sleeveTeam = o.sleeve === undefined ? coatTeam : (o.sleeveTeam || 0);
  const pants = o.pants || COL.white, boots = o.boots || COL.boot, skin = o.skin || COL.skin;
  if (!o.rider) {
    for (const side of [-1, 1]) {
      const bone = side < 0 ? 1 : 2, pv = [side * 0.1, hipY, 0];
      b.box(0.15, 0.48, 0.17, side * 0.1, hipY - 0.24, 0, pants, { bone, pivot: pv });
      b.box(0.165, 0.4, 0.2, side * 0.1, 0.2, 0.01, boots, { bone, pivot: pv });
      b.box(0.15, 0.08, 0.26, side * 0.1, 0.04, 0.05, boots, { bone, pivot: pv });
    }
  } else {
    for (const side of [-1, 1]) {
      b.box(0.15, 0.15, 0.46, side * 0.21, hipY + 0.02, 0.14, pants, { bone: R });
      b.box(0.16, 0.5, 0.18, side * 0.25, hipY - 0.26, 0.34, boots, { bone: R });
    }
  }
  // torso
  b.box(0.42, 0.58, 0.26, 0, hipY + 0.29, 0, coat, { team: coatTeam, bone: R, vary: 0.04 });
  if (o.coatLong) b.box(0.46, o.rider ? 0.2 : 0.36, 0.3, 0, hipY - (o.rider ? 0.0 : 0.1), -0.02, coat, { team: coatTeam, bone: R });
  if (o.kaftan) b.box(0.5, 0.62, 0.32, 0, hipY - 0.22, 0, coat, { team: coatTeam, bone: R });
  if (o.vest !== undefined) b.box(0.44, 0.44, 0.28, 0, hipY + 0.25, 0, o.vest, { team: o.vestTeam || 0, bone: R });
  if (o.cuirass) {
    b.box(0.46, 0.46, 0.3, 0, hipY + 0.33, 0.005, COL.steel, { bone: R, rough: 0.35, metal: 0.85 });
  }
  if (o.belts) {
    b.box(0.44, 0.06, 0.28, 0, hipY + 0.04, 0, COL.white, { bone: R });
    b.box(0.05, 0.72, 0.02, 0, hipY + 0.3, 0.135, COL.white, { bone: R, rz: 0.62 });
    b.box(0.05, 0.72, 0.02, 0, hipY + 0.3, 0.135, COL.white, { bone: R, rz: -0.62 });
  }
  if (o.sash) b.box(0.44, 0.09, 0.28, 0, hipY + 0.06, 0, TEAM, { team: 1, bone: R });
  // head
  b.box(0.09, 0.08, 0.09, 0, shY + 0.03, 0, skin, { bone: R });
  b.sphere(0.13, 0, shY + 0.2, 0.01, skin, { bone: R, ws: 7, hs: 5 });
  if (o.beard) b.box(0.18, 0.12, 0.08, 0, shY + 0.1, 0.1, o.beard, { bone: R });
  hat(b, o.hat, shY + 0.2, R, o);
  // arms
  for (const side of [-1, 1]) {
    const bone = (side < 0 ? 3 : 4) + R, pv = [side * shX, shY - 0.03, 0];
    b.box(0.12, 0.5, 0.14, side * shX, shY - 0.28, 0, sleeve, { team: sleeveTeam, bone, pivot: pv, vary: 0.04 });
    b.box(0.13, 0.08, 0.15, side * shX, shY - 0.5, 0, o.cuff === undefined ? COL.white : o.cuff, { team: o.cuffTeam || 0, bone, pivot: pv });
    b.box(0.09, 0.1, 0.1, side * shX, shY - 0.59, 0.01, skin, { bone, pivot: pv });
  }
  return { handR: [shX, shY - 0.6, 0.03], shR: [shX, shY - 0.03, 0], handL: [-shX, shY - 0.6, 0.03], shL: [-shX, shY - 0.03, 0], R, shY, hipY };
}

function hat(b, kind, y, R, o) {
  const hb = { bone: R };
  switch (kind) {
    case 'tricorn':
      b.cyl(0.14, 0.14, 0.09, 8, 0, y + 0.1, 0, COL.black, hb);
      b.cone(0.25, 0.1, 3, 0, y + 0.1, 0, COL.black, Object.assign({ ry: PI / 6 }, hb));
      b.box(0.08, 0.06, 0.02, 0.0, y + 0.13, 0.17, COL.brass, hb);
      break;
    case 'cap':
      b.cyl(0.14, 0.15, 0.12, 8, 0, y + 0.1, 0, o.hatColor || COL.leather, hb);
      b.cyl(0.2, 0.2, 0.025, 8, 0, y + 0.05, 0.03, o.hatColor || COL.leather, hb);
      break;
    case 'brim':
      b.cyl(0.29, 0.29, 0.03, 10, 0, y + 0.07, 0, o.hatColor || COL.darkWood, hb);
      b.cyl(0.13, 0.15, 0.16, 8, 0, y + 0.15, 0, o.hatColor || COL.darkWood, hb);
      b.box(0.27, 0.035, 0.27, 0, y + 0.1, 0, TEAM, Object.assign({ team: o.bandTeam ? 1 : 0 }, hb, { ry: PI / 4 }));
      break;
    case 'morion':
      b.sphere(0.16, 0, y + 0.07, 0, COL.steel, Object.assign({ rough: 0.35, metal: 0.8, sy: 0.75 }, hb));
      b.cyl(0.25, 0.25, 0.025, 10, 0, y + 0.02, 0, COL.steel, Object.assign({ rough: 0.35, metal: 0.8, sz: 0.65 }, hb));
      b.box(0.03, 0.12, 0.26, 0, y + 0.17, 0, COL.steel, Object.assign({ rough: 0.35, metal: 0.8 }, hb));
      break;
    case 'mitre':
      b.cone(0.16, 0.42, 4, 0, y + 0.24, 0, TEAM, Object.assign({ team: 1, ry: PI / 4, sz: 0.7 }, hb));
      b.box(0.24, 0.24, 0.02, 0, y + 0.18, 0.1, COL.brass, Object.assign({ rough: 0.4, metal: 0.7 }, hb));
      break;
    case 'shako':
      b.cyl(0.14, 0.13, 0.24, 8, 0, y + 0.15, 0, COL.black, hb);
      b.box(0.2, 0.025, 0.1, 0, y + 0.04, 0.13, COL.black, hb);
      b.cyl(0.035, 0.035, 0.14, 5, 0, y + 0.33, 0.06, TEAM, Object.assign({ team: 1 }, hb));
      break;
    case 'busby':
      b.cyl(0.15, 0.16, 0.28, 8, 0, y + 0.15, 0, COL.fur, hb);
      b.box(0.06, 0.22, 0.12, 0.1, y + 0.18, -0.06, TEAM, Object.assign({ team: 1, rz: -0.3 }, hb));
      b.cyl(0.03, 0.03, 0.2, 5, 0, y + 0.36, 0.08, COL.white, hb);
      break;
    case 'plumed':
      b.sphere(0.165, 0, y + 0.06, 0, COL.steel, Object.assign({ rough: 0.3, metal: 0.85, sy: 0.85 }, hb));
      b.box(0.04, 0.12, 0.3, 0, y + 0.2, -0.02, COL.brass, Object.assign({ rough: 0.4, metal: 0.7 }, hb));
      b.box(0.06, 0.08, 0.34, 0, y + 0.29, -0.08, TEAM, Object.assign({ team: 1 }, hb));
      break;
    case 'kolpak':
      b.cyl(0.13, 0.15, 0.3, 8, 0, y + 0.17, 0, TEAM, Object.assign({ team: 0.9 }, hb));
      b.cyl(0.17, 0.17, 0.08, 8, 0, y + 0.04, 0, COL.fur, hb);
      break;
    case 'hood':
      b.cone(0.18, 0.34, 6, 0, y + 0.13, -0.03, TEAM, Object.assign({ team: 0.7, rx: -0.2 }, hb));
      break;
    case 'bandana':
      b.sphere(0.145, 0, y + 0.03, 0, COL.black, Object.assign({ sy: 0.7 }, hb));
      b.box(0.04, 0.16, 0.05, 0.03, y - 0.03, -0.15, COL.black, hb);
      break;
    case 'bonnet':
      b.sphere(0.15, 0, y + 0.03, -0.02, COL.linen, Object.assign({ sy: 0.8 }, hb));
      break;
    default: break;
  }
}

// weapons are attached to the right hand (bone 5) or left hand (bone 6); modelled pointing UP from the hand
function weaponR(b, h, kind) {
  const R = h.R, bone = 5 + R, pv = h.handR, pv2 = h.shR;
  const x = pv[0] + 0.02, y = pv[1], z = pv[2] + 0.04;
  const o = (extra) => Object.assign({ bone, pivot: pv, pivot2: pv2 }, extra || {});
  if (importedWeapon(b, kind, x, y, z, o())) return;
  switch (kind) {
    case 'musket':
      b.box(0.06, 0.5, 0.09, x, y - 0.3, z, COL.wood, o());
      b.box(0.035, 1.05, 0.035, x, y + 0.42, z, COL.iron, o({ rough: 0.4, metal: 0.8 }));
      b.box(0.018, 0.26, 0.018, x, y + 1.06, z, COL.steel, o({ rough: 0.3, metal: 0.9 }));
      break;
    case 'carbine':
      b.box(0.06, 0.4, 0.08, x, y - 0.25, z, COL.wood, o());
      b.box(0.035, 0.75, 0.035, x, y + 0.3, z, COL.iron, o({ rough: 0.4, metal: 0.8 }));
      break;
    case 'rifle':
      b.box(0.06, 0.5, 0.09, x, y - 0.3, z, COL.darkWood, o());
      b.box(0.035, 1.0, 0.035, x, y + 0.4, z, COL.iron, o({ rough: 0.4, metal: 0.8 }));
      break;
    case 'pistol':
      b.box(0.05, 0.14, 0.08, x, y - 0.02, z, COL.wood, o());
      b.box(0.035, 0.34, 0.035, x, y + 0.16, z, COL.iron, o({ rough: 0.4, metal: 0.8 }));
      break;
    case 'pike':
      b.box(0.045, 3.4, 0.045, x, y + 0.7, z, COL.wood, o());
      b.cone(0.06, 0.28, 4, x, y + 2.52, z, COL.steel, o({ rough: 0.3, metal: 0.9 }));
      break;
    case 'sword':
      b.box(0.1, 0.03, 0.05, x, y + 0.05, z, COL.brass, o({ rough: 0.4, metal: 0.7 }));
      b.box(0.04, 0.82, 0.015, x, y + 0.48, z, COL.steel, o({ rough: 0.25, metal: 0.9 }));
      break;
    case 'broadsword':
      b.box(0.14, 0.04, 0.06, x, y + 0.05, z, COL.brass, o({ rough: 0.4, metal: 0.7 }));
      b.box(0.06, 1.0, 0.02, x, y + 0.56, z, COL.steel, o({ rough: 0.25, metal: 0.9 }));
      break;
    case 'axe':
      b.box(0.04, 0.85, 0.04, x, y + 0.3, z, COL.wood, o());
      b.box(0.04, 0.16, 0.22, x, y + 0.66, z + 0.08, COL.steel, o({ rough: 0.35, metal: 0.8 }));
      break;
    case 'crossbow':
      b.box(0.06, 0.75, 0.08, x, y + 0.12, z, COL.wood, o());
      b.box(0.7, 0.05, 0.05, x, y + 0.42, z, COL.darkWood, o());
      b.box(0.68, 0.01, 0.01, x, y + 0.38, z - 0.02, COL.linen, o());
      break;
    case 'grenade':
      b.sphere(0.09, x, y + 0.02, z, COL.black, o({ rough: 0.5, metal: 0.4 }));
      b.box(0.015, 0.08, 0.015, x, y + 0.13, z, COL.hay, o());
      break;
    case 'rammer':
      b.box(0.04, 1.8, 0.04, x, y + 0.5, z, COL.wood, o());
      b.cyl(0.07, 0.07, 0.15, 6, x, y + 1.4, z, COL.darkWood, o());
      break;
    default: break;
  }
}
function weaponL(b, h, kind) {
  const R = h.R, bone = 6 + R, pv = h.handL, pv2 = h.shL;
  const x = pv[0] - 0.02, y = pv[1], z = pv[2] + 0.04;
  const o = (extra) => Object.assign({ bone, pivot: pv, pivot2: pv2 }, extra || {});
  if (importedWeapon(b, kind, x, y, z, o())) return;
  if (kind === 'longbow') {
    b.box(0.035, 0.75, 0.04, x, y + 0.36, z + 0.06, COL.wood, o({ rx: -0.18 }));
    b.box(0.035, 0.75, 0.04, x, y - 0.36, z + 0.06, COL.wood, o({ rx: 0.18 }));
    b.box(0.008, 1.45, 0.008, x, y, z - 0.03, COL.linen, o());
  } else if (kind === 'shield') {
    b.cyl(0.32, 0.32, 0.05, 10, x - 0.06, y + 0.1, z + 0.08, COL.darkWood, o({ rx: PI / 2 }));
    b.cyl(0.24, 0.24, 0.06, 10, x - 0.06, y + 0.1, z + 0.09, TEAM, o({ rx: PI / 2, team: 1 }));
    b.sphere(0.07, x - 0.06, y + 0.1, z + 0.13, COL.brass, o({ rough: 0.4, metal: 0.7 }));
  }
}

// ------------------------------------------------------------------ quadrupeds (bones 7..13)
function buildQuad(b, s) {
  // s: { len, h (body centre), w, bh (body height), leg, col, belly, neck, head, tail, extra }
  const by = s.h, L = s.len, W = s.w;
  b.box(W, s.bh, L, 0, by, 0, s.col, { bone: 13, vary: 0.05 });
  if (s.belly) b.box(W * 0.85, s.bh * 0.35, L * 0.8, 0, by - s.bh * 0.45, 0, s.belly, { bone: 13 });
  if (s.hump) b.box(W * 1.05, s.hump, L * 0.45, 0, by + s.bh * 0.45, L * 0.18, s.humpCol || s.col, { bone: 13, vary: 0.06 });
  // legs
  const lx = W * 0.32, lz = L * 0.36, top = by - s.bh * 0.2, legH = top;
  const legs = [[-lx, lz, 7], [lx, lz, 8], [-lx, -lz, 9], [lx, -lz, 10]];
  for (const [x, z, bone] of legs) {
    const pv = [x, top, z];
    b.box(s.legW || 0.12, legH, s.legW || 0.12, x, legH / 2, z, s.legCol || s.col, { bone, pivot: pv });
    b.box((s.legW || 0.12) * 1.1, 0.08, (s.legW || 0.12) * 1.2, x, 0.04, z + 0.01, s.hoof || COL.black, { bone, pivot: pv });
  }
  // neck + head (bone 11)
  const nb = [0, by + s.bh * 0.2, L * 0.42];
  const hb = { bone: 11, pivot: nb };
  b.box(s.neckW || W * 0.5, s.neckLen, s.neckW || W * 0.5, 0, by + s.neckLen * 0.35, L * 0.5 + s.neckLen * 0.15, s.neckCol || s.col, Object.assign({ rx: s.neckTilt || 0.7 }, hb));
  const hy = s.headY !== undefined ? s.headY : by + s.neckLen * 0.75, hz = s.headZ !== undefined ? s.headZ : L * 0.5 + s.neckLen * 0.5;
  b.box(s.headW, s.headH, s.headL, 0, hy, hz + s.headL * 0.3, s.headCol || s.col, Object.assign({ rx: s.headTilt || 0.25 }, hb));
  if (s.muzzle) b.box(s.headW * 0.8, s.headH * 0.6, s.headL * 0.3, 0, hy - s.headH * 0.15, hz + s.headL * 0.75, s.muzzle, hb);
  if (s.ears) for (const side of [-1, 1]) b.box(0.05, s.ears, 0.08, side * s.headW * 0.4, hy + s.headH * 0.55, hz + 0.05, s.headCol || s.col, Object.assign({ rz: side * 0.4 }, hb));
  if (s.antlers) for (const side of [-1, 1]) {
    b.box(0.04, s.antlers, 0.04, side * 0.12, hy + s.headH * 0.5 + s.antlers * 0.45, hz, COL.linen, Object.assign({ rz: side * 0.45 }, hb));
    b.box(0.03, s.antlers * 0.6, 0.03, side * (0.18 + s.antlers * 0.2), hy + s.headH * 0.5 + s.antlers * 0.7, hz + 0.08, COL.linen, Object.assign({ rz: side * 0.1, rx: 0.4 }, hb));
  }
  if (s.horns) for (const side of [-1, 1]) b.cone(0.05, 0.22, 5, side * s.headW * 0.55, hy + s.headH * 0.35, hz, COL.linen, Object.assign({ rz: -side * 1.1 }, hb));
  if (s.mane) b.box(0.08, s.neckLen * 0.95, 0.16, 0, by + s.neckLen * 0.42, L * 0.46 + s.neckLen * 0.08, s.mane, Object.assign({ rx: s.neckTilt || 0.7 }, hb));
  // tail
  if (s.tail) {
    const tp = [0, by + s.bh * 0.25, -L * 0.5];
    b.box(s.tailW || 0.08, s.tail, s.tailW || 0.08, 0, by + s.bh * 0.25 - s.tail * 0.45, -L * 0.52 - 0.06, s.tailCol || s.col, { bone: 12, pivot: tp, rx: -0.3 });
  }
}

function buildHorse(b, o = {}) {
  if (ART_MODELS.horse) { importedHorse(b, o); return; }
  buildQuad(b, {
    len: 1.55, h: 1.25, w: 0.5, bh: 0.58, col: o.col || 0x6b4428, belly: null, neckLen: 0.85, neckW: 0.3, neckTilt: 0.62,
    headW: 0.24, headH: 0.28, headL: 0.55, headTilt: 1.1, muzzle: 0x2b211b, ears: 0.12, tail: 0.75, tailCol: 0x221a15, mane: 0x221a15,
    legW: 0.12, legCol: o.col || 0x6b4428, hoof: 0x1d1a17,
  });
  // saddle cloth & saddle
  b.box(0.62, 0.08, 0.7, 0, 1.56, -0.05, o.armor ? COL.steel : TEAM, { team: o.armor ? 0 : 0.95, bone: 13, rough: o.armor ? 0.35 : 0.8, metal: o.armor ? 0.8 : 0 });
  b.box(0.38, 0.12, 0.42, 0, 1.63, -0.05, COL.leather, { bone: 13 });
  if (o.armor) b.box(0.56, 0.5, 0.35, 0, 1.25, 0.66, COL.steel, { bone: 13, rough: 0.35, metal: 0.8 });
}

// ------------------------------------------------------------------ unit models
const UNIT_MODELS = {};
function unitModel(key) {
  if (UNIT_MODELS[key]) return UNIT_MODELS[key];
  const b = new PartBuilder();
  const animal = importedAnimal(b, key);
  if (animal) return UNIT_MODELS[key] = animal;
  let style = 0;
  switch (key) {
    case 'settler': {
      const h = buildHuman(b, { coat: COL.linen, vest: TEAM, vestTeam: 0.85, sleeve: COL.linen, pants: 0x6a5238, hat: 'cap', hatColor: 0x6b4f33, cuff: COL.linen });
      weaponR(b, h, 'axe'); style = 1; break;
    }
    case 'explorer': {
      const h = buildHuman(b, { coatLong: true, hat: 'brim', bandTeam: true, pants: 0xcfc3a5, boots: 0x231c17, belts: false, sash: true, cuff: COL.brass, beard: 0x5a3e2a });
      b.box(0.04, 0.7, 0.05, -0.27, 0.62, 0.05, COL.steel, { rz: 0.15, rough: 0.3, metal: 0.8 });
      weaponR(b, h, 'pistol'); style = 0; break;
    }
    case 'musketeer': {
      const h = buildHuman(b, { coatLong: true, hat: 'tricorn', belts: true, pants: COL.white, boots: 0x262321 });
      weaponR(b, h, 'musket'); style = 0; break;
    }
    case 'pikeman': {
      const h = buildHuman(b, { hat: 'morion', cuirass: true, pants: 0x5c4733, cuff: COL.steel });
      weaponR(b, h, 'pike'); style = 2; break;
    }
    case 'crossbowman': {
      const h = buildHuman(b, { hat: 'cap', hatColor: 0x4d3a28, vest: 0x8b7351, sleeve: TEAM, sleeveTeam: 0.9, pants: 0x6a5238 });
      weaponR(b, h, 'crossbow'); style = 0; break;
    }
    case 'longbowman': {
      const h = buildHuman(b, { hat: 'hood', coat: TEAM, coatTeam: 0.75, pants: 0x5b4d34, belts: false, cuff: 0x5b4d34 });
      b.cyl(0.08, 0.07, 0.6, 6, -0.15, 1.35, -0.18, COL.leather, { rx: 0.3 });
      weaponL(b, h, 'longbow'); style = 3; break;
    }
    case 'strelet': {
      const h = buildHuman(b, { kaftan: true, hat: 'kolpak', pants: 0x7a6a50, boots: 0x6b3b22, cuff: COL.fur, beard: 0x4a3324 });
      b.box(0.04, 1.3, 0.04, -0.12, 1.1, -0.18, COL.wood, { rz: 0.35 });
      b.box(0.04, 0.4, 0.28, -0.32, 1.66, -0.18, COL.steel, { rz: 0.35, rough: 0.35, metal: 0.8 });
      weaponR(b, h, 'musket'); style = 0; break;
    }
    case 'rodelero': {
      const h = buildHuman(b, { hat: 'morion', cuirass: true, sleeve: TEAM, sleeveTeam: 1, pants: TEAM, cuff: COL.steel, beard: 0x3a281c });
      weaponR(b, h, 'sword'); weaponL(b, h, 'shield'); style = 1; break;
    }
    case 'skirmisher': {
      const h = buildHuman(b, { coat: 0x3f4a3a, sleeve: 0x3f4a3a, cuff: TEAM, cuffTeam: 1, hat: 'shako', pants: 0xc9bfa6, belts: true });
      weaponR(b, h, 'rifle'); style = 0; break;
    }
    case 'grenadier': {
      const h = buildHuman(b, { coatLong: true, hat: 'mitre', belts: true, pants: COL.white });
      b.box(0.22, 0.24, 0.12, -0.2, 0.95, -0.1, COL.leather);
      b.box(0.035, 1.2, 0.035, 0.05, 1.25, -0.17, COL.iron, { rz: -0.4 });
      weaponR(b, h, 'grenade'); style = 1; break;
    }
    case 'bandit': {
      const h = buildHuman(b, { coat: 0x3b302a, sleeve: 0x5a4a3a, pants: 0x4a3c30, hat: 'brim', hatColor: 0x2a221c, cuff: 0x3b302a, beard: 0x2a1d14 });
      weaponR(b, h, 'musket'); style = 0; break;
    }
    case 'hussar': {
      buildHorse(b, { col: 0x5a3a24 });
      const h = buildHuman(b, { rider: true, oy: 0.82, hat: 'busby', pants: 0xe8dfc6, boots: 0x1f1b18, belts: false, sash: true, cuff: COL.brass });
      weaponR(b, h, 'sword'); style = 1; break;
    }
    case 'dragoon': {
      buildHorse(b, { col: 0x3b2a1e });
      const h = buildHuman(b, { rider: true, oy: 0.82, hat: 'plumed', coatLong: true, pants: 0xd8cfb8, belts: true });
      weaponR(b, h, 'carbine'); style = 0; break;
    }
    case 'cuirassier': {
      buildHorse(b, { col: 0x2c2420, armor: true });
      const h = buildHuman(b, { rider: true, oy: 0.82, hat: 'plumed', cuirass: true, pants: 0xe8dfc6, cuff: COL.steel });
      weaponR(b, h, 'broadsword'); style = 1; break;
    }
    case 'falconet': case 'culverin': case 'mortar': {
      artilleryModel(b, key); style = 1; break;
    }
    case 'wagon': case 'tradeWagon': {
      wagonModel(b, key === 'wagon'); style = 1; break;
    }
    case 'deer': case 'pronghorn': case 'caribou': {
      const cfg = {
        deer: { col: 0x8a6240, belly: 0xd9c4a0, ant: 0.45, len: 1.1, h: 0.95, leg: 0.12 },
        pronghorn: { col: 0xc0874e, belly: 0xf0e4cc, ant: 0.0, len: 1.0, h: 0.85, horns: true },
        caribou: { col: 0x7d6a58, belly: 0xd8d0c2, ant: 0.6, len: 1.25, h: 1.05 },
      }[key];
      buildQuad(b, {
        len: cfg.len, h: cfg.h, w: 0.38, bh: 0.42, col: cfg.col, belly: cfg.belly, neckLen: 0.55, neckW: 0.18, neckTilt: 0.5,
        headW: 0.18, headH: 0.18, headL: 0.36, headTilt: 0.55, muzzle: 0x3a2a20, ears: 0.13, antlers: cfg.ant || 0, horns: cfg.horns,
        tail: 0.16, tailCol: 0xf2ece0, legW: 0.08,
      });
      style = 1; break;
    }
    case 'bison': {
      buildQuad(b, {
        len: 1.8, h: 1.05, w: 0.75, bh: 0.85, col: 0x4a3324, hump: 0.45, humpCol: 0x3a281c, neckLen: 0.45, neckW: 0.55, neckTilt: 1.9,
        headW: 0.45, headH: 0.42, headL: 0.45, headTilt: 0.6, headY: 0.92, headZ: 1.25, muzzle: 0x231a14, horns: true, tail: 0.45, tailCol: 0x2a1d14, legW: 0.16, legCol: 0x2f2219,
      });
      style = 1; break;
    }
    case 'wolf': {
      buildQuad(b, {
        len: 1.0, h: 0.62, w: 0.3, bh: 0.32, col: 0x7c7a74, belly: 0xb8b2a6, neckLen: 0.35, neckW: 0.2, neckTilt: 1.0,
        headW: 0.2, headH: 0.2, headL: 0.36, headTilt: 0.15, headY: 0.82, headZ: 0.78, muzzle: 0x4d4a45, ears: 0.12, tail: 0.45, tailCol: 0x6a675f, tailW: 0.1, legW: 0.08,
      });
      style = 1; break;
    }
    case 'bear': {
      buildQuad(b, {
        len: 1.5, h: 0.85, w: 0.75, bh: 0.75, col: 0x3d2b1f, hump: 0.18, neckLen: 0.35, neckW: 0.45, neckTilt: 1.3,
        headW: 0.42, headH: 0.38, headL: 0.45, headTilt: 0.2, headY: 1.0, headZ: 1.05, muzzle: 0x6b5644, ears: 0.12, tail: 0.1, legW: 0.2,
      });
      style = 1; break;
    }
    default: {
      buildHuman(b, {}); break;
    }
  }
  const geo = b.build();
  UNIT_MODELS[key] = { geo, style };
  return UNIT_MODELS[key];
}

function artilleryModel(b, key) {
  if (ART_MODELS.cannon) { importedArtillery(b, key); return; }
  const wheelR = key === 'mortar' ? 0 : 0.55;
  if (key !== 'mortar') {
    // carriage cheeks + trail
    for (const s of [-1, 1]) b.box(0.08, 0.32, 1.5, s * 0.22, 0.62, -0.25, COL.darkWood, { rx: 0.18 });
    b.box(0.3, 0.12, 1.4, 0, 0.32, -1.05, COL.darkWood, { rx: 0.32 });
    b.box(0.6, 0.1, 0.1, 0, wheelR, 0, COL.iron, { rough: 0.5, metal: 0.6 });
    for (const s of [-1, 1]) {
      const pv = [s * 0.42, wheelR, 0];
      b.cyl(wheelR, wheelR, 0.07, 10, s * 0.42, wheelR, 0, COL.wood, { rz: PI / 2, bone: 14, pivot: pv });
      b.cyl(0.1, 0.1, 0.12, 6, s * 0.42, wheelR, 0, COL.iron, { rz: PI / 2, bone: 14, pivot: pv });
      b.box(0.04, wheelR * 1.8, 0.05, s * 0.42, wheelR, 0, COL.darkWood, { bone: 14, pivot: pv });
      b.box(0.04, 0.05, wheelR * 1.8, s * 0.42, wheelR, 0, COL.darkWood, { bone: 14, pivot: pv });
    }
    const len = key === 'culverin' ? 2.6 : 1.7, r0 = key === 'culverin' ? 0.13 : 0.15, r1 = key === 'culverin' ? 0.1 : 0.11;
    const colB = key === 'culverin' ? COL.iron : COL.bronze;
    b.cyl(r1, r0, len, 10, 0, 0.84, len * 0.28, colB, { rx: PI / 2 - 0.05, bone: 15, pivot: [0, 0.84, 0], rough: 0.35, metal: 0.85 });
    b.sphere(r0 * 1.05, 0, 0.84, len * 0.28 - len / 2, colB, { bone: 15, pivot: [0, 0.84, 0], rough: 0.35, metal: 0.85 });
    b.cyl(r1 * 1.25, r1 * 1.25, 0.1, 10, 0, 0.84 + 0.04, len * 0.28 + len / 2 - 0.05, colB, { rx: PI / 2, bone: 15, pivot: [0, 0.84, 0], rough: 0.35, metal: 0.85 });
  } else {
    b.box(1.0, 0.35, 1.2, 0, 0.18, 0, COL.darkWood);
    b.box(0.2, 0.3, 1.0, -0.35, 0.5, 0, COL.darkWood); b.box(0.2, 0.3, 1.0, 0.35, 0.5, 0, COL.darkWood);
    b.cyl(0.32, 0.38, 0.75, 10, 0, 0.75, 0.12, COL.bronze, { rx: 0.75, bone: 15, pivot: [0, 0.6, 0], rough: 0.35, metal: 0.85 });
    b.cyl(0.24, 0.24, 0.06, 10, 0, 1.03, 0.38, COL.black, { rx: 0.75, bone: 15, pivot: [0, 0.6, 0] });
  }
  // gunner
  const crew = new PartBuilder();
  const h = buildHuman(crew, { coat: TEAM, coatTeam: 0.9, hat: 'tricorn', belts: false, pants: COL.white });
  weaponR(crew, h, 'rammer');
  b.merge(crew, { x: 0.9, z: -0.6 });
}

function wagonModel(b, team) {
  if (ART_MODELS.cart) { importedWagon(b, team); return; }
  // horse pulling in front
  const hb = new PartBuilder();
  buildHorse(hb, { col: 0x6a4a30 });
  b.merge(hb, { z: 2.0 });
  b.box(0.06, 0.06, 1.6, -0.3, 1.0, 1.0, COL.wood); b.box(0.06, 0.06, 1.6, 0.3, 1.0, 1.0, COL.wood);
  // cart bed
  b.box(1.4, 0.18, 2.4, 0, 0.95, -0.4, COL.wood, { vary: 0.08 });
  b.box(1.45, 0.4, 0.06, 0, 1.2, 0.8, COL.darkWood); b.box(1.45, 0.4, 0.06, 0, 1.2, -1.6, COL.darkWood);
  // canvas cover (half cylinder)
  b.add(new THREE.CylinderGeometry(0.75, 0.75, 2.3, 10, 1, true, -PI / 2, PI), { x: 0, y: 1.3, z: -0.4, rx: PI / 2, rz: PI / 2, color: team ? TEAM : COL.canvas, team: team ? 0.55 : 0, sy: 1 });
  for (const zz of [0.6, -0.4, -1.4]) b.torus(0.76, 0.03, 0, 1.3, zz, COL.darkWood, { ts: 10 });
  // wheels
  for (const [x, z, r] of [[-0.75, 0.4, 0.45], [0.75, 0.4, 0.45], [-0.75, -1.2, 0.55], [0.75, -1.2, 0.55]]) {
    const pv = [x, r, z];
    b.cyl(r, r, 0.08, 10, x, r, z, COL.wood, { rz: PI / 2, bone: 14, pivot: pv });
    b.box(0.05, r * 1.8, 0.05, x, r, z, COL.darkWood, { bone: 14, pivot: pv });
    b.box(0.05, 0.05, r * 1.8, x, r, z, COL.darkWood, { bone: 14, pivot: pv });
  }
  // cargo crates / barrels peeking out the back
  b.cyl(0.22, 0.22, 0.45, 8, -0.35, 1.25, -1.45, COL.wood);
  b.box(0.45, 0.4, 0.4, 0.3, 1.25, -1.4, COL.darkWood);
}

// ------------------------------------------------------------------ buildings
const BUILDING_BUILDERS = {};
function windowBox(b, x, y, z, w, h, ry = 0, shutter) {
  b.box(w + 0.1, h + 0.1, 0.06, x, y, z, COL.darkWood, { ry });
  b.box(w, h, 0.08, x, y, z, 0x1d2630, { ry, rough: 0.3, metal: 0.2 });
  if (shutter) {
    const off = (w / 2 + 0.12);
    const dx = Math.cos(ry) * off, dz = -Math.sin(ry) * off;
    b.box(0.2, h + 0.06, 0.04, x + dx, y, z + dz, TEAM, { ry, team: 0.85 });
    b.box(0.2, h + 0.06, 0.04, x - dx, y, z - dz, TEAM, { ry, team: 0.85 });
  }
}
function flagPole(b, x, y, z, h, size = 1) {
  b.cyl(0.05, 0.07, h, 6, x, y + h / 2, z, COL.darkWood);
  b.sphere(0.09, x, y + h + 0.05, z, COL.brass, { rough: 0.4, metal: 0.7 });
  b.box(1.1 * size, 0.7 * size, 0.04, x + 0.58 * size, y + h - 0.4 * size, z, TEAM, { team: 1, tag: 0 });
}
function timberFrame(b, w, h, d, x, y, z) { // dark beams around a box wall
  const t = 0.12;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(t, h, t, x + sx * w / 2, y + h / 2, z + sz * d / 2, COL.darkWood);
  b.box(w + 0.05, t, t, x, y + h, z + d / 2, COL.darkWood); b.box(w + 0.05, t, t, x, y + h, z - d / 2, COL.darkWood);
  b.box(t, t, d + 0.05, x + w / 2, y + h, z, COL.darkWood); b.box(t, t, d + 0.05, x - w / 2, y + h, z, COL.darkWood);
  b.box(w + 0.05, t, t, x, y + 0.15, z + d / 2, COL.darkWood);
  // braces on front
  const bl = Math.sqrt((w / 4) ** 2 + h * h) * 0.9;
  b.box(t * 0.8, bl, t * 0.8, x - w / 4 - w / 8, y + h / 2, z + d / 2 + 0.01, COL.darkWood, { rz: Math.atan2(w / 4, h) });
  b.box(t * 0.8, bl, t * 0.8, x + w / 4 + w / 8, y + h / 2, z + d / 2 + 0.01, COL.darkWood, { rz: -Math.atan2(w / 4, h) });
}
function barrel(b, x, z, y = 0, r = 0.28) { b.cyl(r, r * 0.9, r * 2.6, 8, x, y + r * 1.3, z, COL.wood, { vary: 0.1 }); b.torus(r * 0.98, 0.025, x, y + r * 0.6, z, COL.iron, { rx: PI / 2, ts: 8 }); b.torus(r * 0.98, 0.025, x, y + r * 2.0, z, COL.iron, { rx: PI / 2, ts: 8 }); }
function crate(b, x, z, s = 0.6, y = 0, ry = 0) { b.box(s, s, s, x, y + s / 2, z, COL.wood, { ry, vary: 0.12 }); b.box(s + 0.02, 0.06, s * 0.2, x, y + s / 2, z, COL.darkWood, { ry }); }

function buildingModel(key, civ) {
  const pal = (CIVS[civ] || CIVS.britain).palette;
  const b = new PartBuilder();
  const roof = pal.roof, wall = pal.wall;
  switch (key) {
    case 'house': {
      b.box(3.7, 0.35, 3.3, 0, 0.17, 0, COL.stone, { vary: 0.08 });
      b.box(3.2, 2.0, 2.7, 0, 1.35, 0, wall, { vary: 0.03 });
      timberFrame(b, 3.2, 2.0, 2.7, 0, 0.35, 0);
      b.gable(3.8, 3.5, 1.6, 0, 2.35, 0, roof, { vary: 0.05 });
      b.box(0.42, 1.4, 0.42, 1.05, 3.1, -0.5, COL.stoneDark);
      b.box(0.7, 1.15, 0.08, -0.6, 0.93, 1.36, COL.darkWood);
      windowBox(b, 0.75, 1.55, 1.37, 0.5, 0.5, 0, true);
      windowBox(b, -1.61, 1.55, 0.2, 0.45, 0.45, PI / 2, false);
      barrel(b, 1.75, 1.25);
      if (civ === 'russia') { b.box(3.9, 0.12, 0.12, 0, 2.38, 1.76, COL.wood); }
      break;
    }
    case 'tc': {
      b.box(9.4, 0.7, 9.4, 0, 0.35, 0, COL.stone, { vary: 0.07 });
      b.box(3.2, 0.35, 1.0, 0, 0.18, 5.1, COL.stoneDark);
      // main hall
      b.box(7.2, 3.4, 5.2, -0.4, 2.4, -0.9, wall, { vary: 0.03 });
      timberFrame(b, 7.2, 3.4, 5.2, -0.4, 0.7, -0.9);
      b.box(7.6, 2.3, 5.6, -0.4, 5.25, -0.9, wall, { vary: 0.03 });
      timberFrame(b, 7.6, 2.3, 5.6, -0.4, 4.1, -0.9);
      b.gable(8.2, 6.4, 3.0, -0.4, 6.4, -0.9, roof, { vary: 0.04 });
      for (const x of [-2.6, 1.8]) { b.box(1.0, 1.0, 0.9, x, 7.4, 1.4, wall); b.gable(1.2, 1.1, 0.6, x, 7.9, 1.4, roof, { ry: PI / 2 }); windowBox(b, x, 7.4, 1.86, 0.4, 0.4); }
      b.box(0.7, 2.4, 0.7, -3.6, 8.0, -2.4, COL.stoneDark); b.box(0.7, 2.0, 0.7, 2.4, 7.8, -3.0, COL.stoneDark);
      // front porch
      b.box(3.2, 0.12, 1.6, -0.6, 3.3, 2.5, COL.darkWood);
      b.gable(3.4, 1.9, 0.8, -0.6, 3.36, 2.5, roof, { ry: 0 });
      for (const x of [-2.0, 0.8]) b.cyl(0.1, 0.12, 2.6, 6, x, 2.0, 3.2, COL.wood);
      b.box(1.3, 2.0, 0.1, -0.6, 1.7, 1.72, COL.darkWood);
      for (const x of [-3.2, 2.0]) windowBox(b, x, 2.4, 1.72, 0.7, 0.9, 0, true);
      for (const x of [-3.0, -0.6, 1.8]) windowBox(b, x, 5.2, 1.92, 0.6, 0.7, 0, true);
      // banners
      for (const x of [-1.8, 0.6]) b.box(0.6, 1.5, 0.05, x, 5.15, 1.98, TEAM, { team: 1 });
      // tower
      b.box(2.6, 6.4, 2.6, 3.0, 3.9, 2.6, COL.stone, { vary: 0.08 });
      b.box(2.8, 2.6, 2.8, 3.0, 8.4, 2.6, wall);
      timberFrame(b, 2.8, 2.6, 2.8, 3.0, 7.1, 2.6);
      windowBox(b, 3.0, 8.4, 4.02, 0.8, 1.0); windowBox(b, 4.42, 8.4, 2.6, 0.8, 1.0, PI / 2);
      b.pyramid(3.4, 3.0, 3.0, 9.7, 2.6, roof);
      flagPole(b, 3.0, 12.6, 2.6, 3.2, 1.4);
      b.cyl(0.35, 0.35, 0.08, 12, 3.0, 6.3, 3.95, COL.white, { rx: PI / 2 });
      // goods
      barrel(b, -4.1, 3.6, 0.7); barrel(b, -3.5, 4.1, 0.7, 0.24); crate(b, 4.3, 4.3, 0.7, 0.7); crate(b, -4.2, 2.9, 0.55, 0.7, 0.4);
      break;
    }
    case 'mill': {
      b.box(5.2, 0.4, 5.2, 0, 0.2, 0, COL.stone, { vary: 0.08 });
      b.cyl(1.5, 2.2, 6.2, 8, 0, 3.4, 0, wall, { vary: 0.04 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + PI / 8; b.box(0.1, 6.2, 0.1, Math.sin(a) * 1.82, 3.4, Math.cos(a) * 1.82, COL.darkWood, { ry: a, rx: 0 , sz: 1 }); }
      b.cone(2.0, 1.9, 8, 0, 7.45, 0, roof, { vary: 0.05 });
      b.box(0.9, 1.4, 0.15, 0, 1.1, 2.12, COL.darkWood);
      windowBox(b, 0, 4.2, 1.82, 0.45, 0.55);
      b.cyl(0.25, 0.25, 0.8, 8, 0, 6.6, 1.95, COL.darkWood, { rx: PI / 2 });
      // sails (tag 1 -> separate rotating mesh, pivot at hub)
      const hub = [0, 6.6, 2.4];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        const L = 3.6;
        const cx = hub[0] + Math.sin(a) * L / 2, cy = hub[1] + Math.cos(a) * L / 2;
        b.box(0.12, L, 0.08, cx, cy, hub[2], COL.darkWood, { rz: -a, tag: 1 });
        const sx = hub[0] + Math.sin(a) * L * 0.58 + Math.cos(a) * 0.32, sy = hub[1] + Math.cos(a) * L * 0.58 - Math.sin(a) * 0.32;
        b.box(0.56, L * 0.7, 0.03, sx, sy, hub[2] + 0.03, COL.canvas, { rz: -a, tag: 1 });
      }
      b.sphere(0.3, hub[0], hub[1], hub[2], COL.darkWood, { tag: 1 });
      // grain sacks
      for (const [x, z] of [[1.9, 1.7], [2.2, 1.2], [-2.0, 1.6]]) b.sphere(0.32, x, 0.65, z, 0xcbb78a, { sy: 1.2 });
      flagPole(b, -2.1, 0.4, -2.0, 3.6, 0.8);
      break;
    }
    case 'plantation': {
      b.box(5.6, 0.25, 5.4, 0, 0.12, 0, COL.darkWood);
      for (const x of [-2.4, 0, 2.4]) for (const z of [-2.2, 2.2]) b.box(0.18, 3.0, 0.18, x, 1.6, z, COL.wood);
      b.gable(6.0, 5.6, 1.8, 0, 3.05, 0, roof, { vary: 0.05 });
      for (let i = 0; i < 5; i++) for (const z of [-1.2, 0, 1.2]) b.box(0.08, 0.9, 0.5, -2.0 + i * 1.0, 2.35, z, 0x8a7a3a, { rz: 0.1 });
      b.box(2.4, 1.6, 1.8, -1.2, 1.05, -1.0, COL.wood, { vary: 0.08 });
      crate(b, 2.0, 2.6, 0.6); crate(b, 2.5, 2.1, 0.5, 0, 0.5); barrel(b, 1.4, 2.8);
      flagPole(b, 2.6, 0.2, -2.6, 4.0, 0.8);
      break;
    }
    case 'market': {
      b.box(7.4, 0.25, 7.4, 0, 0.12, 0, COL.stone, { vary: 0.06 });
      b.box(3.6, 2.6, 3.0, 0, 1.55, -1.8, wall, { vary: 0.03 });
      timberFrame(b, 3.6, 2.6, 3.0, 0, 0.25, -1.8);
      b.gable(4.2, 3.6, 1.6, 0, 2.85, -1.8, roof);
      windowBox(b, -0.9, 1.6, -0.28, 0.6, 0.6, 0, true); b.box(0.8, 1.6, 0.08, 0.8, 1.05, -0.27, COL.darkWood);
      // stalls with striped awnings
      for (const [x, z, ry] of [[-2.4, 1.6, 0], [2.4, 1.6, 0], [0, 2.9, 0]]) {
        for (const [px, pz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) b.box(0.1, 2.0, 0.1, x + px, 1.2, z + pz, COL.wood);
        b.box(1.9, 0.6, 1.3, x, 0.55, z, COL.wood, { vary: 0.1 });
        for (let s = 0; s < 4; s++) b.box(0.5, 0.05, 1.5, x - 0.75 + s * 0.5, 2.25 + (s % 2) * 0.02, z, s % 2 ? COL.canvas : TEAM, { team: s % 2 ? 0 : 1, rx: 0.15, ry });
        for (let k = 0; k < 4; k++) b.sphere(0.13, x - 0.6 + k * 0.4, 0.95, z, [0xb3412e, 0xd3a03a, 0x6d8a35, 0x8e4f2a][k]);
      }
      barrel(b, 3.2, -2.5); barrel(b, -3.2, -2.8, 0, 0.25); crate(b, 3.0, -1.5, 0.6);
      flagPole(b, -3.2, 0.25, -0.6, 3.6, 0.8);
      break;
    }
    case 'barracks': {
      b.box(7.6, 0.3, 7.6, 0, 0.15, 0, COL.stone, { vary: 0.06 });
      b.box(7.0, 3.2, 3.6, 0, 1.9, -1.8, wall, { vary: 0.03 });
      timberFrame(b, 7.0, 3.2, 3.6, 0, 0.3, -1.8);
      b.gable(7.6, 4.2, 1.9, 0, 3.5, -1.8, roof, { vary: 0.04 });
      for (const x of [-2.4, 0, 2.4]) windowBox(b, x, 2.4, 0.02, 0.6, 0.7, 0, true);
      b.box(1.0, 1.7, 0.1, -1.2, 1.15, 0.02, COL.darkWood);
      // courtyard wall
      for (const [x, z, w, d] of [[0, 3.6, 7.4, 0.35], [-3.6, 1.8, 0.35, 3.6], [3.6, 1.8, 0.35, 3.6]]) b.box(w, 0.9, d, x, 0.75, z, COL.stone, { vary: 0.1 });
      b.box(1.6, 0.92, 0.4, 0, 0.75, 3.6, 0x000000, { sy: 0.01 });
      // musket rack + target dummy
      b.box(1.6, 0.08, 0.1, 2.0, 1.3, 1.2, COL.darkWood);
      for (let i = 0; i < 5; i++) b.box(0.04, 1.4, 0.04, 1.4 + i * 0.3, 1.0, 1.25, COL.iron, { rx: -0.2, metal: 0.6, rough: 0.4 });
      b.box(0.1, 1.6, 0.1, -2.2, 1.1, 1.8, COL.wood); b.box(0.9, 0.1, 0.1, -2.2, 1.6, 1.8, COL.wood); b.sphere(0.25, -2.2, 2.0, 1.8, COL.hay);
      flagPole(b, -3.3, 0.3, 3.3, 4.6, 0.9); flagPole(b, 3.3, 0.3, 3.3, 4.6, 0.9);
      break;
    }
    case 'stable': {
      b.box(7.6, 0.25, 7.6, 0, 0.12, 0, COL.stoneDark);
      b.box(6.0, 3.0, 4.6, -0.6, 1.75, -1.2, 0x7a3e2c, { vary: 0.08 });
      for (let i = 0; i < 6; i++) b.box(6.02, 0.05, 4.62, -0.6, 0.6 + i * 0.45, -1.2, 0x5e2e21);
      b.gable(6.6, 5.4, 2.4, -0.6, 3.25, -1.2, 0x4a3a2c, { vary: 0.05 });
      b.box(2.0, 2.2, 0.1, -0.6, 1.35, 1.12, COL.darkWood);
      b.box(2.1, 0.12, 0.12, -0.6, 1.35, 1.18, COL.wood, { rz: 0.82 }); b.box(2.1, 0.12, 0.12, -0.6, 1.35, 1.18, COL.wood, { rz: -0.82 });
      windowBox(b, -0.6, 3.8, 1.36, 0.6, 0.5);
      // paddock fence
      for (let i = 0; i < 5; i++) { b.box(0.12, 1.1, 0.12, 3.4, 0.55, 3.4 - i * 1.6, COL.wood); }
      for (let i = 0; i < 5; i++) { b.box(0.12, 1.1, 0.12, 3.4 - i * 1.6, 0.55, 3.4, COL.wood); }
      for (const y of [0.5, 0.9]) { b.box(0.08, 0.08, 6.4, 3.4, y, 0.2, COL.wood); b.box(6.4, 0.08, 0.08, 0.2, y, 3.4, COL.wood); }
      for (const [x, z] of [[1.5, 2.2], [2.2, 1.6], [1.8, 1.6]]) b.box(0.9, 0.5, 0.6, x, 0.37, z, COL.hay, { ry: x, vary: 0.1 });
      b.box(1.4, 0.4, 0.4, -2.6, 0.32, 2.4, COL.darkWood);
      flagPole(b, -3.4, 0.25, 3.2, 4.2, 0.8);
      break;
    }
    case 'church': {
      b.box(7.4, 0.35, 7.6, 0, 0.17, 0, COL.stone, { vary: 0.06 });
      b.box(4.4, 4.2, 6.2, 0, 2.45, -0.8, wall, { vary: 0.03 });
      b.gable(7.0, 5.0, 3.0, 0, 4.55, -0.8, roof, { ry: PI / 2, vary: 0.04 });
      for (const z of [-2.6, -0.8, 1.0]) { windowBox(b, 2.22, 2.8, z, 0.5, 1.3, PI / 2); windowBox(b, -2.22, 2.8, z, 0.5, 1.3, PI / 2); }
      b.box(2.6, 7.2, 2.6, 0, 3.95, 3.0, COL.stone, { vary: 0.06 });
      b.box(2.0, 1.6, 2.0, 0, 8.3, 3.0, wall);
      for (const s of [[0, 4.02, 0], [1.02, 3.0, PI / 2]]) b.box(0.7, 0.9, 0.08, s[0], 8.3, s[1], 0x1e1a16, { ry: s[2] });
      b.cone(1.5, 4.6, 8, 0, 11.4, 3.0, roof);
      b.box(0.12, 1.2, 0.12, 0, 14.1, 3.0, COL.gold, { rough: 0.3, metal: 0.9 }); b.box(0.7, 0.12, 0.12, 0, 14.3, 3.0, COL.gold, { rough: 0.3, metal: 0.9 });
      b.box(1.2, 2.0, 0.12, 0, 1.35, 4.32, COL.darkWood);
      b.cyl(0.45, 0.45, 0.1, 12, 0, 5.0, 4.32, 0x9a6b2e, { rx: PI / 2, rough: 0.3, metal: 0.4 });
      b.box(2.4, 0.2, 0.7, 0, 0.3, 4.6, COL.stoneDark);
      b.box(0.5, 1.4, 0.06, 1.7, 3.4, 2.2, TEAM, { team: 1 });
      break;
    }
    case 'foundry': {
      b.box(7.6, 0.3, 7.6, 0, 0.15, 0, COL.stoneDark);
      b.box(6.2, 3.8, 4.4, -0.4, 2.2, -1.2, COL.stone, { vary: 0.1 });
      b.gable(6.8, 5.0, 1.8, -0.4, 4.1, -1.2, 0x4a4c50, { vary: 0.05 });
      b.box(1.5, 9.5, 1.5, 2.4, 4.75, -2.6, 0x8a4b36, { vary: 0.1 });
      b.box(1.7, 0.4, 1.7, 2.4, 9.4, -2.6, COL.stoneDark);
      b.box(2.0, 2.0, 0.1, -1.4, 1.3, 1.02, 0x1a1512);
      b.box(1.6, 1.4, 0.12, -1.4, 1.1, 1.04, 0xe06a2a, { rough: 1 });
      windowBox(b, 1.0, 2.6, 1.02, 0.6, 0.6);
      // displayed cannon + shot pile
      b.box(0.8, 0.3, 1.4, 1.6, 0.45, 2.6, COL.darkWood);
      b.cyl(0.13, 0.16, 1.8, 10, 1.6, 0.9, 2.7, COL.bronze, { rx: PI / 2, rough: 0.35, metal: 0.85 });
      for (let i = 0; i < 6; i++) b.sphere(0.16, -2.8 + (i % 3) * 0.33, 0.45 + Math.floor(i / 3) * 0.28, 2.8 + (i > 2 ? 0.16 : 0), COL.iron, { rough: 0.5, metal: 0.6 });
      b.box(0.6, 0.6, 0.4, -0.2, 0.6, 2.6, COL.iron, { rough: 0.5, metal: 0.6 });
      flagPole(b, -3.4, 0.3, 3.2, 4.4, 0.8);
      break;
    }
    case 'arsenal': {
      b.box(7.6, 0.3, 7.6, 0, 0.15, 0, COL.stone, { vary: 0.06 });
      b.box(6.4, 3.4, 5.4, 0, 2.0, -0.8, COL.stoneDark, { vary: 0.1 });
      b.box(6.8, 0.3, 5.8, 0, 3.8, -0.8, COL.stone);
      for (let i = 0; i < 7; i++) { b.box(0.5, 0.5, 0.4, -3.0 + i, 4.2, 2.0, COL.stone); b.box(0.5, 0.5, 0.4, -3.0 + i, 4.2, -3.6, COL.stone); }
      b.box(1.6, 2.2, 0.1, 0, 1.4, 1.92, COL.darkWood);
      b.box(1.9, 0.2, 0.2, 0, 2.6, 1.95, COL.stone);
      for (const x of [-2.2, 2.2]) windowBox(b, x, 2.2, 1.92, 0.5, 0.8);
      for (let i = 0; i < 5; i++) barrel(b, -3.2 + (i % 3) * 0.6, 2.7 + Math.floor(i / 3) * 0.6, 0.3, 0.24);
      crate(b, 3.0, 2.8, 0.6, 0.3); crate(b, 2.4, 3.1, 0.5, 0.3, 0.3);
      b.box(1.0, 1.4, 0.06, 2.2, 3.0, 1.93, TEAM, { team: 1 });
      flagPole(b, 2.6, 4.0, -0.8, 3.6, 0.9);
      break;
    }
    case 'outpost': {
      for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) b.cyl(0.13, 0.16, 5.0, 6, x, 2.5, z, COL.wood);
      b.box(0.08, 3.2, 0.08, 0, 2.2, 1.2, COL.wood, { rz: 0.78 }); b.box(0.08, 3.2, 0.08, 0, 2.2, -1.2, COL.wood, { rz: -0.78 });
      b.box(3.2, 0.25, 3.2, 0, 5.0, 0, COL.darkWood);
      for (const s of [-1, 1]) { b.box(3.2, 0.7, 0.1, 0, 5.45, s * 1.55, COL.wood); b.box(0.1, 0.7, 3.2, s * 1.55, 5.45, 0, COL.wood); }
      for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) b.box(0.1, 1.4, 0.1, x, 5.8, z, COL.wood);
      b.pyramid(3.8, 1.4, 0, 6.5, 0, roof);
      for (let i = 0; i < 8; i++) b.box(0.5, 0.06, 0.06, 0, 0.4 + i * 0.6, 1.75, COL.wood);
      b.box(0.06, 5, 0.06, -0.25, 2.5, 1.75, COL.wood); b.box(0.06, 5, 0.06, 0.25, 2.5, 1.75, COL.wood);
      flagPole(b, 0, 7.6, 0, 1.8, 0.8);
      break;
    }
    case 'tower': {
      // stone bastion: sloped talus, octagonal body, crenellated gun platform with a cannon
      const o8 = { ry: PI / 8, vary: 0.07 };
      b.box(5.8, 0.4, 5.8, 0, 0.2, 0, COL.stoneDark, { vary: 0.06 });
      b.cyl(2.45, 2.9, 1.7, 8, 0, 1.25, 0, COL.stone, o8);
      b.cyl(2.2, 2.45, 5.3, 8, 0, 4.75, 0, COL.stone, o8);
      b.cyl(2.52, 2.52, 0.35, 8, 0, 7.45, 0, COL.stoneDark, o8);
      b.cyl(2.42, 2.42, 0.55, 8, 0, 7.9, 0, COL.stone, o8);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; b.box(0.82, 0.72, 0.42, Math.sin(a) * 2.15, 8.5, Math.cos(a) * 2.15, COL.stone, { ry: a, vary: 0.06 }); }
      b.cyl(2.0, 2.0, 0.12, 8, 0, 8.1, 0, COL.darkWood, o8);
      b.box(0.75, 0.32, 1.1, 0, 8.32, 1.05, COL.darkWood);
      b.cyl(0.25, 0.25, 0.12, 10, -0.42, 8.3, 0.85, COL.darkWood, { rz: PI / 2 }); b.cyl(0.25, 0.25, 0.12, 10, 0.42, 8.3, 0.85, COL.darkWood, { rz: PI / 2 });
      b.cyl(0.15, 0.21, 1.9, 10, 0, 8.6, 1.65, COL.iron, { rx: PI / 2, rough: 0.4, metal: 0.8 });
      b.box(1.0, 1.7, 0.14, 0, 1.25, 2.62, COL.darkWood);
      b.box(1.25, 0.18, 0.2, 0, 2.15, 2.64, COL.stoneDark);
      for (const [x, z, ry] of [[0, 2.13, 0], [2.13, 0, PI / 2], [-2.13, 0, PI / 2], [0, -2.13, 0]]) windowBox(b, x, 5.0, z, 0.22, 0.75, ry);
      b.box(0.8, 1.5, 0.05, 0, 6.1, 2.14, TEAM, { team: 1 });
      for (let i = 0; i < 6; i++) b.sphere(0.17, 2.15 + (i % 3) * 0.32 - 0.3, 0.57 + Math.floor(i / 3) * 0.28, 2.1 + (i > 2 ? 0.15 : 0), COL.iron, { rough: 0.5, metal: 0.6 });
      flagPole(b, -1.25, 8.15, -1.25, 2.8, 0.9);
      break;
    }
    case 'tradingPost': {
      b.box(3.6, 0.3, 3.6, 0, 0.15, 0, COL.stoneDark);
      for (let i = 0; i < 6; i++) {
        const y = 0.45 + i * 0.34;
        b.cyl(0.17, 0.17, 3.2, 6, 0, y, 1.2, i % 2 ? 0x6e4e32 : 0x7c5a3a, { rz: PI / 2 });
        b.cyl(0.17, 0.17, 3.2, 6, 0, y, -1.2, i % 2 ? 0x6e4e32 : 0x7c5a3a, { rz: PI / 2 });
        b.cyl(0.17, 0.17, 2.6, 6, 1.45, y, 0, i % 2 ? 0x7c5a3a : 0x6e4e32, { rx: PI / 2 });
        b.cyl(0.17, 0.17, 2.6, 6, -1.45, y, 0, i % 2 ? 0x7c5a3a : 0x6e4e32, { rx: PI / 2 });
      }
      b.gable(3.6, 3.2, 1.3, 0, 2.4, 0, roof);
      b.box(0.8, 1.3, 0.1, -0.5, 0.95, 1.38, COL.darkWood);
      b.box(0.9, 0.6, 0.4, 1.4, 0.6, 1.8, COL.fur); b.box(0.7, 0.4, 0.3, 1.2, 1.05, 1.8, 0x8a6a48);
      flagPole(b, -1.7, 0.3, -1.7, 6.2, 1.0);
      b.cyl(0.12, 0.12, 0.25, 6, -1.45, 5.2, -1.7, 0xf2c45a, { rough: 0.4 });
      break;
    }
    case 'fort': {
      b.box(15.6, 0.6, 15.6, 0, 0.3, 0, 0x6f6a55, { vary: 0.08 });
      const W = 11.6, T = 1.3, Hh = 3.2;
      for (const [x, z, w, d] of [[0, W / 2, W, T], [0, -W / 2, W, T], [W / 2, 0, T, W], [-W / 2, 0, T, W]]) {
        b.box(w, Hh, d, x, 0.6 + Hh / 2, z, COL.stone, { vary: 0.08 });
        const n = Math.round(Math.max(w, d) / 1.2);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5;
          const cx = w > d ? x + t * w : x + (x > 0 ? 0.35 : -0.35), cz = w > d ? z + (z > 0 ? 0.35 : -0.35) : z + t * d;
          if (i % 2 === 0) b.box(0.6, 0.55, 0.6, cx, 0.6 + Hh + 0.27, cz, COL.stone);
        }
      }
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        b.box(3.8, Hh + 0.6, 3.8, x * W / 2, 0.6 + (Hh + 0.6) / 2, z * W / 2, COL.stone, { ry: PI / 4, vary: 0.08 });
        b.cyl(0.14, 0.18, 1.6, 8, x * (W / 2 + 1.4), 0.6 + Hh + 0.85, z * (W / 2 + 1.4), COL.iron, { rx: PI / 2, ry: Math.atan2(x, z), rough: 0.4, metal: 0.8 });
      }
      b.box(2.4, 2.6, 0.5, 0, 1.9, W / 2 + 0.55, COL.darkWood);
      b.box(3.0, 0.6, 0.7, 0, 3.4, W / 2 + 0.5, COL.stoneDark);
      b.box(5.0, 4.6, 5.0, 0, 2.9, -0.6, wall, { vary: 0.04 });
      timberFrame(b, 5.0, 4.6, 5.0, 0, 0.6, -0.6);
      b.pyramid(5.8, 2.6, 0, 5.2, -0.6, roof);
      for (const x of [-1.2, 1.2]) windowBox(b, x, 3.4, 1.92, 0.6, 0.8);
      flagPole(b, 0, 7.8, -0.6, 4.2, 1.8);
      for (const [x, z] of [[-3, 3], [3, 3], [-3.5, -3.8], [3.5, -3.8]]) { barrel(b, x, z, 0.6); crate(b, x + 0.6, z + 0.2, 0.55, 0.6); }
      break;
    }
    default: b.box(2, 2, 2, 0, 1, 0, 0xff00ff);
  }
  return b;
}
function getBuildingGeo(key, civ, colorHex) {
  const id = key + '|' + civ + '|' + colorHex;
  if (BUILDING_BUILDERS[id]) return BUILDING_BUILDERS[id];
  if (key === 'outpost' && outpostModel) {
    return BUILDING_BUILDERS[id] = { ...outpostModel, flag: outpostModel.flag.build(colorHex) };
  }
  const imported = importedBuilding(key, civ, colorHex);
  if (imported) return BUILDING_BUILDERS[id] = imported;
  const b = buildingModel(key, civ);
  const res = { main: (key === 'mill' ? b.without(1) : b).build(colorHex), blades: key === 'mill' ? b.buildTag(1, colorHex) : null };
  BUILDING_BUILDERS[id] = res;
  return res;
}

// scaffolding around a construction site
const SCAFFOLD = {};
function scaffoldGeo(size, height) {
  const id = size + '|' + height;
  if (SCAFFOLD[id]) return SCAFFOLD[id];
  const b = new PartBuilder();
  const h = Math.max(2, height * 0.75), s = size * 0.5 - 0.15;
  const posts = Math.max(2, Math.round(size / 2.5));
  for (let i = 0; i <= posts; i++) {
    const t = -s + (2 * s * i) / posts;
    for (const [x, z] of [[t, s], [t, -s], [s, t], [-s, t]]) b.box(0.1, h, 0.1, x, h / 2, z, 0x9c7d55);
  }
  for (const y of [h * 0.45, h * 0.95]) {
    b.box(2 * s, 0.08, 0.3, 0, y, s, 0x8a6b45); b.box(2 * s, 0.08, 0.3, 0, y, -s, 0x8a6b45);
    b.box(0.3, 0.08, 2 * s, s, y, 0, 0x8a6b45); b.box(0.3, 0.08, 2 * s, -s, y, 0, 0x8a6b45);
  }
  SCAFFOLD[id] = b.build(0xffffff);
  return SCAFFOLD[id];
}

// ------------------------------------------------------------------ trees
const TREE_GEOS = {};
function treeGeo(species) {
  if (TREE_GEOS[species]) return TREE_GEOS[species];
  const imported = importedTree(species);
  if (imported) return TREE_GEOS[species] = imported;
  const b = new PartBuilder();
  const tr = { color: 0x5a4030 };
  switch (species) {
    case 'pine': case 'snowpine': case 'spruce': {
      const narrow = species === 'spruce' ? 0.78 : 1;
      b.cyl(0.13, 0.24, 2.4, 6, 0, 1.2, 0, 0x5b3f2c);
      const green = species === 'spruce' ? 0x2a4a3a : 0x2f5a2e;
      const levels = [[1.8, 3.0, 2.8], [1.45, 2.6, 4.3], [1.05, 2.2, 5.6], [0.6, 1.6, 6.7]];
      for (const [r, h, y] of levels) {
        b.cone(r * narrow, h, 7, 0, y, 0, green, { vary: 0.12, ry: y });
        if (species === 'snowpine') b.cone(r * narrow * 0.75, h * 0.42, 7, 0, y + h * 0.3, 0, 0xf2f6f8, { ry: y + 0.3, vary: 0.03 });
      }
      break;
    }
    case 'oak': case 'cottonwood': {
      const tall = species === 'cottonwood' ? 1.25 : 1;
      b.cyl(0.2, 0.34, 3.0 * tall, 6, 0, 1.5 * tall, 0, 0x5a4232);
      b.cyl(0.08, 0.12, 1.4, 5, 0.5, 2.7 * tall, 0.1, 0x5a4232, { rz: -0.8 });
      const g = species === 'cottonwood' ? 0x6f8a3c : 0x4c7a30;
      const blobs = [[0, 4.2, 0, 1.75], [1.1, 3.8, 0.5, 1.25], [-1.0, 3.9, -0.4, 1.3], [0.3, 3.7, -1.0, 1.2], [-0.4, 3.6, 1.0, 1.15], [0.2, 5.1, 0.1, 1.2]];
      for (const [x, y, z, r] of blobs) b.ico(r, x, y * tall, z, g, { vary: 0.14 });
      break;
    }
    case 'birch': {
      b.cyl(0.12, 0.18, 4.4, 6, 0, 2.2, 0, 0xe8e4da);
      for (let i = 0; i < 5; i++) b.box(0.26, 0.06, 0.26, 0, 0.6 + i * 0.75, 0, 0x2b2622);
      for (const [x, y, z, r] of [[0, 4.6, 0, 1.2], [0.6, 4.0, 0.3, 0.9], [-0.5, 4.1, -0.3, 0.95], [0.1, 5.4, 0, 0.8]]) b.ico(r, x, y, z, 0x8aa443, { vary: 0.14, sy: 1.25 });
      break;
    }
    case 'mesquite': {
      b.cyl(0.14, 0.24, 1.8, 5, 0.15, 0.9, 0, 0x5d4636, { rz: -0.25 });
      b.cyl(0.1, 0.14, 1.4, 5, -0.3, 1.8, 0.1, 0x5d4636, { rz: 0.5 });
      for (const [x, y, z, r] of [[0.2, 2.5, 0, 1.6], [-1.0, 2.3, 0.4, 1.1], [1.0, 2.2, -0.5, 1.1], [0, 2.8, 0.8, 0.9]]) b.ico(r, x, y, z, 0x7d8a4c, { vary: 0.15, sy: 0.55 });
      break;
    }
    case 'saguaro': {
      const g = 0x5f7d45;
      b.cyl(0.32, 0.36, 5.2, 8, 0, 2.6, 0, g, { vary: 0.08 });
      b.sphere(0.32, 0, 5.2, 0, g, { ws: 8, hs: 4 });
      b.cyl(0.2, 0.22, 1.0, 7, 0.65, 2.1, 0, g, { rz: PI / 2 }); b.cyl(0.2, 0.2, 1.6, 7, 1.1, 2.9, 0, g); b.sphere(0.2, 1.1, 3.7, 0, g);
      b.cyl(0.18, 0.2, 0.8, 7, -0.55, 2.9, 0, g, { rz: PI / 2 }); b.cyl(0.18, 0.18, 1.1, 7, -0.9, 3.4, 0, g); b.sphere(0.18, -0.9, 3.95, 0, g);
      break;
    }
    default: b.cyl(0.2, 0.3, 3, 6, 0, 1.5, 0, 0x5a4030);
  }
  TREE_GEOS[species] = b.build(0xffffff);
  return TREE_GEOS[species];
}

// ------------------------------------------------------------------ resources & props
const PROP_GEOS = {};
function propGeo(kind) {
  if (PROP_GEOS[kind]) return PROP_GEOS[kind];
  const imported = importedProp(kind);
  if (imported) return PROP_GEOS[kind] = imported;
  const b = new PartBuilder();
  switch (kind) {
    case 'mine': {
      const rocks = [[0, 0.7, 0, 1.25], [1.1, 0.5, 0.6, 0.85], [-1.0, 0.55, 0.4, 0.9], [0.4, 0.45, -1.1, 0.8], [-0.7, 0.4, -0.9, 0.7], [1.2, 0.35, -0.5, 0.6]];
      for (const [x, y, z, r] of rocks) b.dodec(r, x, y, z, COL.stone, { vary: 0.12, sy: 0.8, ry: x * 3 });
      const nug = [[0.3, 1.5, 0.5], [-0.4, 1.35, 0.6], [0.9, 1.0, 0.9], [-1.1, 1.0, 0.8], [0.1, 1.1, -0.9], [0.6, 1.25, -0.2], [-0.5, 1.5, -0.2], [1.3, 0.8, -0.2]];
      for (const [x, y, z] of nug) b.ico(0.22, x, y, z, COL.gold, { rough: 0.25, metal: 1.0 });
      b.box(0.15, 1.6, 0.15, -1.6, 0.8, 1.2, COL.wood); b.box(0.15, 1.6, 0.15, -0.4, 0.8, 1.6, COL.wood);
      b.box(1.5, 0.15, 0.2, -1.0, 1.6, 1.4, COL.wood, { ry: -0.33 });
      b.box(0.5, 0.35, 0.7, 1.6, 0.18, 1.3, COL.darkWood, { ry: 0.4 });
      b.ico(0.18, 1.6, 0.42, 1.3, COL.gold, { rough: 0.25, metal: 1.0 });
      break;
    }
    case 'quarry': {
      // pale limestone outcrop with terraced cut faces, stacked blocks and a lifting frame
      const rough = 0x5a5751, cut = 0x968e7d, block = 0xa59d8a;
      for (const [x, y, z, r] of [[-0.7, 0.7, -0.6, 1.25], [0.9, 0.5, -1.0, 0.85], [-1.35, 0.42, 0.55, 0.7], [1.25, 0.35, 0.35, 0.6], [-0.2, 0.3, -1.45, 0.65]]) b.dodec(r, x, y, z, rough, { vary: 0.12, sy: 0.8, ry: x * 2.3 });
      b.box(2.1, 1.25, 1.5, -0.25, 0.62, -0.45, cut, { vary: 0.06, ry: 0.18 });
      b.box(1.65, 0.85, 1.05, -0.05, 1.66, -0.7, cut, { vary: 0.06, ry: 0.18 });
      b.box(1.0, 0.5, 0.65, 0.05, 2.33, -0.92, cut, { vary: 0.06, ry: 0.18 });
      b.box(0.5, 0.06, 1.48, 0.8, 1.27, -0.3, 0x6e6a62, { ry: 0.18 });            // chisel groove
      for (const [x, y, z, ry] of [[1.25, 0.24, 1.15, 0.1], [0.62, 0.24, 1.32, -0.12], [0.95, 0.72, 1.22, 0.06], [-0.35, 0.24, 1.5, 0.35], [-0.95, 0.24, 1.3, -0.2]]) b.box(0.6, 0.48, 0.48, x, y, z, block, { ry, vary: 0.07 });
      for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 1.6 + (i % 3) * 0.25; b.dodec(0.13 + (i % 2) * 0.06, Math.cos(a) * r, 0.08, Math.sin(a) * r + 0.3, cut, { ry: a }); }
      // A-frame hoist with a hanging block
      b.box(0.11, 2.6, 0.11, -1.75, 1.25, 0.95, COL.wood, { rz: 0.2 }); b.box(0.11, 2.6, 0.11, -0.95, 1.25, 0.95, COL.wood, { rz: -0.2 });
      b.box(1.2, 0.12, 0.14, -1.35, 2.5, 0.95, COL.wood);
      b.box(0.03, 0.8, 0.03, -1.35, 2.05, 0.95, 0xd8c9a0);
      b.box(0.42, 0.34, 0.34, -1.35, 1.5, 0.95, block, { vary: 0.05 });
      break;
    }
    case 'bush': {
      b.ico(0.75, 0, 0.55, 0, 0x3f6b2c, { vary: 0.15, sy: 0.75 });
      b.ico(0.55, 0.5, 0.45, 0.3, 0x47732f, { vary: 0.15, sy: 0.8 });
      b.ico(0.5, -0.45, 0.4, -0.3, 0x3a6328, { vary: 0.15, sy: 0.8 });
      const rng = new RNG(7);
      for (let i = 0; i < 26; i++) {
        const a = rng.next() * TAU, e = rng.range(0.2, 1.2), r = 0.72;
        b.sphere(0.075, Math.cos(a) * Math.cos(e) * r * 0.95, 0.45 + Math.sin(e) * r * 0.6, Math.sin(a) * Math.cos(e) * r * 0.95, i % 3 ? 0xb3262c : 0x6e1f3e, { ws: 4, hs: 3 });
      }
      break;
    }
    case 'crate_food': crate(b, 0, 0, 0.7); b.sphere(0.28, -0.1, 0.9, 0.05, 0xcbb78a, { sy: 0.8 }); b.sphere(0.24, 0.2, 0.85, -0.12, 0xc2ab7c, { sy: 0.8 }); break;
    case 'crate_wood': for (let i = 0; i < 5; i++) b.cyl(0.13, 0.13, 1.3, 6, -0.28 + (i % 3) * 0.28, 0.14 + Math.floor(i / 3) * 0.24, (i > 2 ? 0.14 : 0), 0x8a6640, { rx: PI / 2 }); b.box(0.06, 0.6, 0.06, 0, 0.3, 0.55, COL.leather); break;
    case 'crate_stone':
      b.box(1.0, 0.12, 0.8, 0, 0.06, 0, COL.darkWood);
      for (const [x, y, z] of [[-0.24, 0.31, -0.18], [0.24, 0.31, -0.18], [-0.24, 0.31, 0.19], [0.24, 0.31, 0.19], [0, 0.69, 0]]) b.box(0.44, 0.38, 0.34, x, y, z, 0xd2cbba, { vary: 0.08 });
      break;
    case 'crate_coin': b.box(0.8, 0.5, 0.55, 0, 0.25, 0, COL.darkWood); b.box(0.82, 0.08, 0.57, 0, 0.42, 0, COL.brass, { rough: 0.4, metal: 0.7 }); for (let i = 0; i < 7; i++) b.cyl(0.08, 0.08, 0.03, 8, -0.25 + (i % 4) * 0.16, 0.55 + Math.floor(i / 4) * 0.03, -0.1 + Math.floor(i / 4) * 0.12, COL.gold, { rough: 0.25, metal: 1 }); break;
    case 'treasure': {
      for (const [x, z, h, r] of [[-1.2, -0.8, 2.2, 0.32], [1.3, -0.6, 1.3, 0.3], [0.9, 1.1, 0.7, 0.32]]) b.cyl(r, r * 1.1, h, 8, x, h / 2, z, COL.stone, { vary: 0.1 });
      b.box(1.0, 0.25, 0.4, -0.7, 0.15, 0.9, COL.stone, { ry: 0.6 });
      b.box(0.9, 0.5, 0.6, 0, 0.25, 0, COL.darkWood);
      b.box(0.92, 0.08, 0.62, 0, 0.36, 0, COL.brass, { rough: 0.4, metal: 0.7 });
      b.box(0.9, 0.08, 0.6, 0, 0.75, -0.42, COL.darkWood, { rx: -1.1 });
      for (let i = 0; i < 9; i++) b.ico(0.1, -0.3 + (i % 3) * 0.3, 0.55 + Math.floor(i / 3) * 0.04, -0.15 + Math.floor(i / 3) * 0.12, COL.gold, { rough: 0.2, metal: 1 });
      b.ico(0.14, 0.45, 0.12, 0.5, COL.gold, { rough: 0.2, metal: 1 });
      break;
    }
    case 'socket': {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; b.dodec(0.32, Math.cos(a) * 1.8, 0.15, Math.sin(a) * 1.8, COL.stone, { sy: 0.6, ry: a }); }
      b.cyl(0.08, 0.1, 2.4, 6, 0, 1.2, 0, COL.wood);
      b.box(0.7, 0.4, 0.03, 0.36, 2.15, 0, 0xd8cdb0);
      break;
    }
    case 'routePost': {
      b.cyl(0.08, 0.11, 1.6, 6, 0, 0.8, 0, COL.wood);
      b.box(0.5, 0.07, 0.07, 0.15, 1.45, 0, COL.wood);
      b.box(0.16, 0.22, 0.16, 0.38, 1.25, 0, 0xe8b04a, { rough: 0.5 });
      break;
    }
    case 'grass': {
      const rng = new RNG(3);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rng.range(-0.3, 0.3), h = rng.range(0.35, 0.6);
        const g = new THREE.BufferGeometry();
        const w = 0.07;
        g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, h, 0.12], 3));
        b.add(g, { ry: a, x: Math.cos(a) * 0.08, z: Math.sin(a) * 0.08, color: 0xffffff });
      }
      break;
    }
    case 'flower': {
      const rng = new RNG(4);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU, h = rng.range(0.3, 0.5);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, h, 0.08], 3));
        b.add(g, { ry: a, color: 0xffffff });
      }
      for (let i = 0; i < 3; i++) b.box(0.09, 0.09, 0.09, rng.range(-0.15, 0.15), rng.range(0.35, 0.5), rng.range(-0.15, 0.15), 0xffffff, { tag: 2 });
      break;
    }
    case 'rock': b.dodec(0.5, 0, 0.18, 0, 0x8a857c, { sy: 0.55, vary: 0.15 }); break;
    case 'ring': {
      const g = new THREE.RingGeometry(0.82, 1.0, 28); g.rotateX(-PI / 2);
      b.add(g, { color: 0xffffff, smooth: true });
      break;
    }
    case 'flag': {
      b.cyl(0.04, 0.05, 2.2, 5, 0, 1.1, 0, COL.darkWood);
      b.box(0.7, 0.45, 0.03, 0.36, 1.9, 0, TEAM, { team: 1 });
      break;
    }
    default: b.box(1, 1, 1, 0, 0.5, 0, 0xff00ff);
  }
  PROP_GEOS[kind] = b.build(kind === 'flag' ? undefined : 0xffffff);
  return PROP_GEOS[kind];
}
