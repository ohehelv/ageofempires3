const assert = require('node:assert/strict');

module.exports = async (page, { shot }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForFunction(() => window.__nw?.game);
  await page.click('#btn-start');
  await page.waitForFunction(() => !window.__nw.App.attract);
  await page.evaluate(() => {
    const { App, Cam, game, GFX } = window.__nw;
    App.loop = () => {};
    game.revealAll = true;
    const { x, z } = game.players[0].tc;
    const center = game.freeNear(x + 10, z + 8);
    window.testDeer = ['deer', 'pronghorn', 'caribou'].map((key, i) => {
      const spot = game.freeNear(center.x + (i - 1) * 3.5, center.z);
      const animal = game.addUnit(key, -1, spot.x, spot.z);
      animal.heading = animal.ph = 0.7;
      return animal;
    });
    Cam.jump(center.x, center.z, true);
    Cam.dist = Cam.tdist = 23;
    Cam.update(0.016, game);
    GFX.camera.updateMatrixWorld(true);
  });

  const pose = (state, time) => page.evaluate(({ state, time }) => {
    const { Cam, GFX, RS } = window.__nw;
    for (const animal of window.testDeer) {
      animal.alive = state !== 'death';
      animal.anim = state === 'walk' || state === 'gallop' ? 1 : 0;
      animal.animT = animal.walkPh = animal.deathT = time;
      animal.order = { walk: state === 'walk' };
    }
    RS.computeViewBox(Cam);
    RS.frame(0, 1, []);
    GFX.renderer.render(GFX.scene, GFX.camera);
    const frames = window.testDeer.map((animal) => {
      const instance = RS.units.sets[animal.key];
      const matrices = instance.mesh.instanceMatrix.array;
      const vertex = instance.mesh.geometry.getAttribute('aDeerVertex');
      if (vertex?.itemSize !== 2 || !instance.mesh.customDepthMaterial) throw new Error(`Missing deer skin or shadow: ${animal.key}`);
      for (let i = 0; i < instance.n; i++) {
        if (Math.abs(matrices[i * 16 + 12] - animal.x) < 0.001 && Math.abs(matrices[i * 16 + 14] - animal.z) < 0.001) {
          return instance.iAnim.array[i * 4 + 2];
        }
      }
      throw new Error(`Missing instance: ${animal.key}`);
    });
    return { frames, image: GFX.renderer.domElement.toDataURL() };
  }, { state, time });

  const idle = await pose('idle', 0.25);
  const walk = await pose('walk', 0.8);
  const nextStep = await pose('walk', 3.1);
  const gallop = await pose('gallop', 2.4);
  await shot('deer_gallop');
  const falling = await pose('death', 0.4);
  const corpse = await pose('death', 2);
  const settled = await pose('death', 4);
  await shot('deer_corpse');
  for (let i = 0; i < 3; i++) {
    assert.ok(idle.frames[i] < walk.frames[i] && walk.frames[i] < nextStep.frames[i]);
    assert.ok(nextStep.frames[i] < gallop.frames[i] && gallop.frames[i] < falling.frames[i]);
    assert.ok(falling.frames[i] < corpse.frames[i]);
    assert.equal(corpse.frames[i], settled.frames[i]);
  }
  assert.notEqual(walk.image, nextStep.image);
  assert.notEqual(gallop.image, corpse.image);
  assert.deepEqual(errors, []);
};
