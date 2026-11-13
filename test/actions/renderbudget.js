const assert = require('node:assert/strict');

module.exports = async (page) => {
  const warnings = [], errors = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForFunction(() => window.__nw?.game);
  await page.reload();
  await page.waitForFunction(() => window.__nw?.game && window.__nw.GFX.renderer.info.render.frame > 0);
  assert.deepEqual(await page.evaluate(() => {
    const { App, GFX } = window.__nw;
    return [App.attract, GFX.quality, GFX.sun.castShadow];
  }), [true, 'low', false]);

  await page.click('input[name="msize"][value="huge"] + span');
  await page.click('#btn-start');
  await page.waitForFunction(() => !window.__nw.App.attract && document.getElementById('loading').hidden);

  const budget = await page.evaluate(() => {
    const { App, Cam, GFX } = window.__nw;
    const { renderer } = GFX;
    const { game } = App;
    const initialQuality = GFX.quality;
    const center = GFX.treeChunks.reduce((nearest, chunk) => {
      const { simple } = chunk;
      const { x, z } = simple.boundingSphere.center;
      const distance = Math.hypot(x - game.size / 2, z - game.size / 2);
      return distance < nearest.distance ? { chunk, distance } : nearest;
    }, { distance: Infinity }).chunk;
    const mesh = center.mesh;
    const matrix = mesh.instanceMatrix;
    const frame = () => {
      App.last = performance.now() - 17;
      const requestFrame = window.requestAnimationFrame;
      try {
        window.requestAnimationFrame = () => {};
        App.loop(performance.now());
      } finally {
        window.requestAnimationFrame = requestFrame;
      }
    };
    Cam.jump(center.simple.boundingSphere.center.x, center.simple.boundingSphere.center.z, true);
    Cam.dist = Cam.tdist = 35;
    App.applyQuality('high');
    frame();
    const near = mesh.geometry === center.detail && !!GFX.sun.shadow.map;
    Cam.dist = Cam.tdist = 140;
    frame();
    const far = mesh.geometry === center.simple;
    const highTriangles = renderer.info.render.triangles;

    App.qualityWarmup = 0;
    for (let i = 0; i < 5; i++) App.autoQuality(0.55, performance.now());
    frame();
    const low = GFX.quality === 'low' && !GFX.sun.castShadow && !GFX.sun.shadow.map;
    const lowTriangles = renderer.info.render.triangles;
    let disposed = false;
    center.detail.addEventListener('dispose', () => { disposed = true; });
    App.toMenu();
    return {
      safeDefault: !GFX.softwareRenderer || initialQuality === 'low',
      near, far, low, disposed, sameMatrix: mesh.instanceMatrix === matrix,
      fewerTriangles: lowTriangles < highTriangles,
    };
  });
  assert.deepEqual(budget, {
    safeDefault: true, near: true, far: true, low: true, disposed: true, sameMatrix: true, fewerTriangles: true,
  });
  assert.ok(!warnings.some((warning) => warning.includes('KHR_texture_transform')), warnings.join('\n'));
  assert.deepEqual(errors, []);
};
