module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1000);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.evaluate(() => {
    const { game, Cam, Input } = window.__nw;
    const p = game.players[0];
    const ai = new (game.ais[0].constructor)(game, p);
    for (let i = 0; i < 20 * 60 * 6; i++) { game.tick(); if (i % 30 === 0) ai.think(); }
    const vs = game.units.filter((u) => u.owner === 0 && u.def.tags.has('villager')).slice(0, 6);
    Input.setSelection(vs);
    Cam.jump(p.tc.x + 4, p.tc.z + 2, true); Cam.dist = Cam.tdist = 62; Cam.yaw = Cam.tyaw = 0.25;
  });
  await page.waitForTimeout(6000);
  await shot('hero');
};
