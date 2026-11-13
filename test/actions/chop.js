const assert = require('node:assert/strict');

module.exports = async (page, { shot }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForFunction(() => window.__nw?.game);
  await page.click('#btn-start');
  await page.waitForFunction(() => !window.__nw.App.attract);
  const result = await page.evaluate(() => {
    const { App, game, RS, FX, GFX, Cam, Sfx } = window.__nw;
    App.loop = () => {};
    game.revealAll = true;
    const { x, z } = game.players[0].tc;
    const tree = game.findNearestResource(['tree'], x, z, 75);
    const spot = game.treeSpot(tree, x, z);
    const settler = game.addUnit('settler', 0, spot.x, spot.z);
    const woodBefore = settler.player.res.wood;
    const angle = Math.atan2(tree.x - spot.x, tree.z - spot.z);
    settler.heading = settler.ph = angle;
    const sounds = [];
    const originalSound = Sfx.play;
    Sfx.play = function (name, ...args) { if (name === 'chop') sounds.push(settler.animT); return originalSound.call(this, name, ...args); };
    const original = FX.event;
    const hits = [];
    FX.event = function (kind, x, z, data) {
      if (kind === 'gather' && data.u === settler) hits.push({ time: settler.animT, correctTree: data.tree === tree });
      return original.call(this, kind, x, z, data);
    };
    settler.cmdGather(tree);
    for (let i = 0; i < 12; i++) settler.update(0.05);
    const beforeImpact = !tree.felled && hits.length === 0;
    settler.update(0.05);
    const felledAtImpact = tree.felled && hits.length === 1 && sounds.length === 1;
    const ref = GFX.treeRefs[tree.ti];
    const matrix = new THREE.Matrix4();
    Cam.jump((tree.x + spot.x) / 2, (tree.z + spot.z) / 2, true);
    Cam.yaw = Cam.tyaw = angle + 1.15; Cam.dist = Cam.tdist = 22;
    Cam.update(0.05, game); GFX.camera.updateMatrixWorld(true);
    const frame = () => { RS.computeViewBox(Cam); RS.frame(0.05, 1, []); GFX.renderer.render(GFX.scene, GFX.camera); };
    for (let i = 0; i < 22; i++) { settler.update(0.05); frame(); }
    ref.mesh.getMatrixAt(ref.i, matrix);
    const fellAway = (matrix.elements[4] * Math.sin(angle) + matrix.elements[6] * Math.cos(angle)) > 0;
    const mesh = RS.units.sets.settler.mesh;
    const weighted = mesh.geometry.attributes.aSkinWeights.array.some((weight) => weight > 0 && weight < 1);
    const { position, aBonePivot } = mesh.geometry.attributes;
    let bladeForward = -Infinity;
    let handleForward = -Infinity;
    let sideways = 0;
    for (let i = 0; i < position.count; i++) {
      if (aBonePivot.getW(i) !== 40) continue;
      const dz = position.getZ(i) - aBonePivot.getZ(i);
      sideways = Math.max(sideways, Math.abs(position.getX(i) - aBonePivot.getX(i)));
      const dy = position.getY(i) - aBonePivot.getY(i);
      if (dy > 0.28) bladeForward = Math.max(bladeForward, dz);
      if (Math.abs(dy) < 0.08) handleForward = Math.max(handleForward, dz);
    }
    const axeFacesSwing = bladeForward - handleForward > 0.18 && sideways < 0.09;
    const logPose = RS.units.sets.settler.iAnim.array.some((value, i) => i % 4 === 0 && value === 13);
    window.chopFixture = { settler, tree };
    return { beforeImpact, felledAtImpact, hits, sounds, fellAway, grounded: ref.onGround, weighted, axeFacesSwing, logPose, gathered: settler.player.res.wood > woodBefore };
  });
  for (const key of ['beforeImpact', 'felledAtImpact', 'fellAway', 'grounded', 'weighted', 'axeFacesSwing', 'logPose', 'gathered']) assert.equal(result[key], true, key);
  assert.equal(result.hits.length, 2);
  assert.ok(result.hits.every(({ correctTree }) => correctTree));
  assert.ok(Math.abs(result.hits[1].time - result.hits[0].time - 1.1) < 0.001);
  assert.equal(result.sounds.length, 2);
  await shot('chop_log');
  const idle = await page.evaluate(() => {
    const { game, RS } = window.__nw;
    const { settler, tree } = window.chopFixture;
    game.depleteResource(tree);
    settler.cmdStop();
    settler.update(0.05);
    return settler.anim === 0 && !settler.order && !!RS.units.sets.settler.mesh.customDepthMaterial;
  });
  assert.ok(idle);
  assert.deepEqual(errors, []);
};
