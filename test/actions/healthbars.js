const assert = require('node:assert/strict');

module.exports = async (page) => {
  await page.waitForFunction(() => window.__nw?.game);
  await page.click('#btn-start');
  await page.waitForFunction(() => !window.__nw.App.attract);
  const result = await page.evaluate(() => {
    const { App, game, RS, Cam, GFX, Input, UI } = window.__nw;
    App.loop = () => {};
    game.revealAll = true;
    const { x, z } = game.players[0].tc;
    const unit = game.addUnit('musketeer', 0, x + 7, z + 5);
    unit.px = unit.x - 0.8;
    unit.pz = unit.z - 0.25;
    Input.setSelection([unit]);
    Cam.jump(unit.x, unit.z, true);
    Cam.dist = Cam.tdist = 34;
    const overlay = UI.ovCtx;
    const fillRect = overlay.fillRect;
    const bars = [];
    overlay.fillRect = function (x, y, width, height) {
      if (width === 24 && height === 5) bars.push([x + 12, y + 1]);
      return fillRect.call(this, x, y, width, height);
    };
    const sceneHeight = game.heightAt(unit.px, unit.pz);
    const state = [];
    try {
      for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
        bars.length = 0;
        Cam.tyaw += 0.04;
        Cam.update(0.016, game);
        RS.computeViewBox(Cam);
        RS.frame(0.016, alpha, Input.selection);
        const rendered = RS.screenUnits.find((entry) => entry.u === unit);
        const camMatrix = GFX.camera.matrixWorld.clone();
        GFX.renderer.render(GFX.scene, GFX.camera);
        UI.drawOverlay(0.016);
        const center = new THREE.Vector3(rendered.x, rendered.y + unit.def.height * 1.32 + 0.5, rendered.z).project(GFX.camera);
        const expected = [(center.x * 0.5 + 0.5) * innerWidth, (-center.y * 0.5 + 0.5) * innerHeight];
        state.push({ bars: bars.slice(), expected, synced: camMatrix.equals(GFX.camera.matrixWorld), x: rendered.x, y: rendered.y });
      }
    } finally {
      overlay.fillRect = fillRect;
    }
    return { state, previousX: unit.px, currentX: unit.x, sceneHeight };
  });
  for (const frame of result.state) {
    assert.equal(frame.bars.length, 1);
    assert.ok(frame.synced);
    assert.ok(frame.expected.every((value, i) => Math.abs(value - frame.bars[0][i]) < 0.01));
  }
  assert.equal(result.state[0].x, result.previousX);
  assert.equal(result.state[0].y, result.sceneHeight);
  assert.equal(result.state.at(-1).x, result.currentX);
  assert.equal(new Set(result.state.map((frame) => frame.x)).size, result.state.length);
};
