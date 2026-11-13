const assert = require('node:assert/strict');

module.exports = async (page, { shot }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForTimeout(1200);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => {
    const { game, Cam, Input } = window.__nw;
    game.revealAll = true;
    const p = game.players[0], tc = p.tc;
    const cx = tc.x + 14, cz = tc.z + 14;
    const mk = (owner, key, x, z, h) => { const pos = game.freeNear(x, z); const u = game.addUnit(key, owner, pos.x, pos.z); u.heading = h || 0; return u; };
    // marching musketeers
    for (let i = 0; i < 4; i++) { const u = mk(0, 'musketeer', cx - 6 + i * 1.6, cz - 4, 0); u.cmdMove(cx - 6 + i * 1.6, cz + 30); }
    // aiming musketeers vs enemy pikemen
    const e1 = mk(1, 'pikeman', cx + 4, cz + 9, Math.PI);
    for (let i = 0; i < 3; i++) { const u = mk(0, 'musketeer', cx + 2 + i * 1.6, cz + 1, 0); u.cmdAttack(e1); }
    // galloping hussars
    for (let i = 0; i < 2; i++) { const u = mk(0, 'hussar', cx - 12, cz + 2 + i * 2.5, Math.PI / 2); u.cmdMove(cx + 30, cz + 2 + i * 2.5); }
    // cannon firing at enemy building-less target
    const f = mk(0, 'falconet', cx + 10, cz - 2, 0); const e2 = mk(1, 'musketeer', cx + 12, cz + 18, Math.PI); f.cmdAttack(e2);
    Cam.jump(cx + 2, cz + 5, true); Cam.dist = Cam.tdist = 30; Cam.yaw = Cam.tyaw = 0.5;
    for (let i = 0; i < 24; i++) game.tick();
  });
  await page.waitForTimeout(2500);
  await shot('anim1');
  await ev(() => { const g = window.__nw.game; for (let i = 0; i < 9; i++) g.tick(); });
  await page.waitForTimeout(1500);
  await shot('anim2');
  const skinning = await ev(() => ['musketeer', 'hussar', 'falconet'].every((key) => {
    const set = window.__nw.RS.units.sets[key];
    return set?.mesh.geometry.attributes.aSkinWeights.array.some((weight) => weight > 0 && weight < 1);
  }));
  assert.ok(skinning);
  assert.deepEqual(errors, []);
};
