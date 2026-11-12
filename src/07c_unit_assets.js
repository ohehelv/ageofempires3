// Map each imported rig to the game's instanced movement and attack controls.
function importedHuman(b, o) {
  const rider = !!o.rider, R = rider ? 20 : 0;
  const model = o.hat === 'brim' ? (o.beard === 0x2a1d14 ? 'henry' : 'captain') :
    o.vest === 0x8b7351 ? 'anne' : o.hat === 'cap' || o.hat === 'hood' ? 'farmer' : 'adventurer';
  const hands = {};
  const rig = (joints) => {
    const bindings = new Map();
    for (const side of ['L', 'R']) {
      const right = side === 'L'; // these source rigs face +Z, with their left on +X
      const sh = joints.get(`UpperArm.${side}`);
      const hand = joints.get(`Middle2.${side}`) || joints.get(`Middle1.${side}`) || joints.get(`Wrist.${side}`);
      const hip = joints.get(`UpperLeg.${side}`);
      const origin = new THREE.Vector3().fromArray(sh);
      const grip = new THREE.Vector3().fromArray(hand).sub(origin);
      const rest = new THREE.Quaternion().setFromUnitVectors(grip.clone().normalize(), new THREE.Vector3(right ? 0.13 : -0.13, -1, 0.14).normalize());
      hands[right ? 'handR' : 'handL'] = grip.applyQuaternion(rest).add(origin).toArray();
      hands[right ? 'shR' : 'shL'] = sh;
      const arm = { bone: R + (right ? 4 : 3), pivot: sh, origin, rest };
      const leg = { bone: rider ? R : right ? 2 : 1, pivot: hip };
      if (rider) {
        leg.origin = new THREE.Vector3().fromArray(hip);
        leg.rest = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(right ? 0.4 : -0.4, -0.7, 0.46).normalize());
      }
      for (const name of joints.keys()) {
        if (!name.endsWith(`.${side}`)) continue;
        if (/^(?:UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(name)) bindings.set(name, arm);
        if (/^(?:UpperLeg|LowerLeg|Foot)/.test(name)) bindings.set(name, leg);
      }
    }
    return bindings;
  };
  const cloth = (hex, joint, p) => {
    const r = hex >> 16, g = (hex >> 8) & 255, blue = hex & 255;
    const skin = r > 120 && r > g * 1.06 && g > blue * 1.09;
    if (skin || /(?:Head|Neck|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(joint)) return false;
    return /(?:Body|Abdomen|Torso|Chest|Shoulder|UpperArm|LowerArm)/.test(joint) && p.y > 0.83 + (o.oy || 0);
  };
  const variant = o.cuirass ? 0x8d9ba0 : o.kaftan ? 0x705644 : o.coat === TEAM || o.coat === undefined ? 0xc7b79b : o.coat;
  const body = artPart(b, model, {
    fit: [0, o.hat === 'brim' ? 1.92 : 1.83], y: o.oy, bone: R, rig,
    color: (hex, joint, p) => cloth(hex, joint, p) ? srgbMix(hex, variant, 0.57) : hex,
    team: (hex, joint, p) => cloth(hex, joint, p) ? (o.cuirass ? 0.37 : (o.coatTeam ?? o.vestTeam ?? o.cuffTeam ?? 0.8)) : 0,
  });
  const head = body.joints.get('Head');
  const shY = (hands.shR[1] + hands.shL[1]) / 2;
  const hipY = body.joints.get('Hips')?.[1] || 0.85 + (o.oy || 0);
  if (o.hat && o.hat !== 'brim' && !(o.hat === 'cap' && model === 'farmer')) {
    hat(b, o.hat, body.bounds.max.y - 0.14, R, o);
  }
  if (o.cuirass) {
    b.box(0.34, 0.35, 0.07, 0, shY - 0.2, head[2] + 0.17, COL.steel, { bone: R, rough: 0.45, metal: 0.6 });
  }
  return { ...hands, R, shY, hipY };
}

const WEAPON_ART = {
  musket: ['musket', 1.28, 0.30, 0], rifle: ['musket', 1.4, 0.30, 0], carbine: ['musket', 0.93, 0.29, 0],
  pistol: ['pistol', 0.48, 0.28, 0], pike: ['spear', 2.8, 0.35, 1], sword: ['cutlass', 0.88, 0.13, 1],
  broadsword: ['claymore', 1.08, 0.11, 1], axe: ['axe', 0.78, 0.25, 1], grenade: ['bomb', 0.25, 0.45, 1],
  longbow: ['bow', 1.32, 0.5, 1], shield: ['roundShield', 0.66, 0.39, 1],
};

function importedWeapon(b, kind, x, y, z, binding) {
  const spec = WEAPON_ART[kind];
  if (!spec) return false;
  const [model, length, grip, axis] = spec;
  const size = artMesh(model).bounds.getSize(new THREE.Vector3());
  artPart(b, model, {
    ...binding, x, y: y + length * (axis === 0 ? 0.5 - grip : -grip), z,
    scale: length / size.getComponent(axis), rz: axis === 0 ? PI / 2 : 0,
    centerY: axis === 0, rough: 0.65,
  });
  return true;
}

function animalRig(joints) {
  const rig = new Map();
  for (const [name, pivot] of joints) {
    if (/^(?:Ear|Head|Jaw|Neck)/i.test(name)) {
      rig.set(name, { bone: 11, pivot: joints.get('Neck1') || joints.get('Head') || pivot });
    } else if (/^Tail/i.test(name)) {
      rig.set(name, { bone: 12, pivot: joints.get('Tail1') || pivot });
    } else {
      const leg = /^(Front|Back)(?:Shoulder|Leg|UpperLeg|LowerLeg)\.([LR])$/.exec(name);
      if (!leg) continue;
      const [, end, side] = leg;
      const root = end === 'Front' ? `FrontUpperLeg.${side}` : `BackLeg.${side}`;
      rig.set(name, { bone: (end === 'Front' ? 7 : 9) + (side === 'L' ? 0 : 1), pivot: joints.get(root) || pivot });
    }
  }
  return rig;
}

const ANIMAL_ART = {
  deer: ['stag', 1.65, 2.05], pronghorn: ['doe', 1.3, 1.73], caribou: ['stag', 1.95, 2.4],
  bison: ['bison', 1.8, 2.9], wolf: ['wolf', 1.05, 1.8], bear: ['bear', 1.45, 2.25],
};

function importedAnimal(b, key) {
  const spec = ANIMAL_ART[key];
  if (!spec) return null;
  const [model, h, d] = spec;
  const color = key === 'caribou' ? (hex) => srgbMix(hex, 0x9d9d8d, 0.3) : undefined;
  if (ART_MODELS[model][4]) {
    if (deerMotionClips(key)) return animatedDeer(b, key, model, [0, h, d], color);
    artPart(b, model, { fit: [0, h, d], color });
    return { geo: b.build(), style: 1 };
  }
  const side = (p) => p.x > 0 ? 1 : -1;
  const unriggedLeg = (p) => {
    if (p.y > h * 0.43 || Math.abs(p.z) < d * 0.15) return null;
    const front = p.z > 0;
    return { bone: (front ? 7 : 9) + (side(p) > 0 ? 0 : 1), pivot: [side(p) * d * 0.095, h * 0.41, (front ? 1 : -1) * d * 0.27] };
  };
  artPart(b, model, {
    fit: [0, h, d], stretch: key === 'bison' ? [1.16, 1, 1] : [1, 1, 1], rig: animalRig,
    vertexRig: key === 'bison' || key === 'bear' ? unriggedLeg : undefined, bone: 13, color,
  });
  return { geo: b.build(), style: 1 };
}

function importedHorse(b, o) {
  const z = o.z || 0;
  artPart(b, 'horse', { fit: [0, 1.86, 2.55], z, rig: animalRig, bone: 13,
    color: (hex) => {
      const r = hex >> 16, g = (hex >> 8) & 255, blue = hex & 255;
      return r > blue * 1.27 && r > g * 1.12 ? srgbMix(hex, o.col || 0x674531, 0.52) : hex;
    } });
  if (!z) b.box(0.57, 0.085, 0.46, 0, 1.29, -0.04, o.armor ? COL.steel : COL.leather, { bone: 13 });
}

function importedArtillery(b, key) {
  if (key === 'mortar') {
    artPart(b, 'crate', { fit: [1.05, 0.38, 1.1], stretch: [1, 0.55, 1] });
    b.cyl(0.34, 0.4, 0.76, 18, 0, 0.62, 0.13, COL.bronze, { rx: 0.78, bone: 15, rough: 0.34, metal: 0.7 });
    b.torus(0.34, 0.055, 0, 0.89, 0.4, COL.iron, { rx: 0.78 - PI / 2, bone: 15, rough: 0.34, metal: 0.65 });
    b.cyl(0.285, 0.285, 0.025, 18, 0, 0.895, 0.405, COL.black, { rx: 0.78, bone: 15 });
  } else {
    const long = key === 'culverin';
    artPart(b, 'cannon', {
      fit: [2.18, 1.35, 1.64], ry: PI / 2, stretch: [long ? 1.32 : 1, 1, 1],
      vertexRig: (p) => {
        if (p.y > 0.69 && Math.abs(p.x) < 0.37) return { bone: 15 };
        return null;
      },
      color: long ? (hex) => srgbMix(hex, 0x525d64, 0.26) : undefined,
    });
  }
  const start = b.P.length;
  const crew = importedHuman(b, { coat: COL.linen, coatTeam: 0.85, hat: 'tricorn' });
  weaponR(b, crew, 'rammer');
  for (const data of [b.P, b.PV, b.PV2]) for (let i = start; i < data.length; i += 3) {
    data[i] += 0.93; data[i + 2] -= 0.64;
  }
}

function importedWagon(b, team) {
  importedHorse(b, { col: 0x785a41, z: 1.75 });
  artPart(b, 'cart', { fit: [1.75, 1.35, 2.5], z: -0.64, team: () => team ? 0.24 : 0,
    vertexRig: (p) => Math.abs(p.x) > 0.23 && p.y < 0.56 && p.z < -0.86
      ? { bone: 14, pivot: [p.x, 0.27, -1.16] } : null });
  artPart(b, team ? 'crate' : 'sacks', { fit: [0.9, 0.62, 0.93], y: 0.79, z: -0.7 });
  for (const sx of [-1, 1]) b.box(0.055, 0.055, 1.45, sx * 0.24, 0.83, 0.6, COL.wood);
}
