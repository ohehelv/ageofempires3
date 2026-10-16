module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1500);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const { game, Cam } = window.__nw;
    game.revealAll = true;
    const p0 = game.players[0], tc = p0.tc;
    p0.age = 5;
    const keys = ['barracks', 'stable', 'foundry', 'church', 'arsenal', 'market', 'mill', 'plantation', 'outpost', 'house', 'house'];
    let k = 0;
    for (const key of keys) {
      const spot = game.findBuildSpot(0, key, tc.x, tc.z, 14, 34);
      if (spot) game.placeBuilding(key, 0, spot.cx0, spot.cz0, { built: true });
    }
    const s = game.sockets.slice().sort((a, b) => Math.hypot(a.x - tc.x, a.z - tc.z) - Math.hypot(b.x - tc.x, b.z - tc.z))[0];
    game.placeBuilding('tradingPost', 0, s.cx0, s.cz0, { built: true });
    const fs = game.findBuildSpot(0, 'fort', tc.x, tc.z, 30, 50);
    if (fs) game.placeBuilding('fort', 0, fs.cx0, fs.cz0, { built: true });
    Cam.jump(tc.x, tc.z + 4, true); Cam.tdist = Cam.dist = 95;
  });
  await page.waitForTimeout(3500);
  await shot('sc_base');
  // battle in the middle
  await page.evaluate(() => {
    const { game, Cam } = window.__nw;
    const cx = game.size / 2, cz = game.size / 2;
    const spawn = (owner, key, n, x, z) => { for (let i = 0; i < n; i++) { const p = game.freeNear(x + (i % 5) * 1.8, z + Math.floor(i / 5) * 1.8); const u = game.addUnit(key, owner, p.x, p.z); u.heading = owner === 0 ? 0 : Math.PI; } };
    spawn(0, 'musketeer', 10, cx - 8, cz - 18);
    spawn(0, 'hussar', 5, cx - 18, cz - 22);
    spawn(0, 'falconet', 2, cx - 3, cz - 26);
    spawn(0, 'longbowman', 6, cx + 4, cz - 22);
    spawn(0, 'grenadier', 3, cx + 12, cz - 20);
    spawn(1, 'musketeer', 8, cx - 6, cz + 14);
    spawn(1, 'cuirassier', 4, cx - 16, cz + 18);
    spawn(1, 'skirmisher', 6, cx + 6, cz + 16);
    spawn(1, 'dragoon', 4, cx + 14, cz + 18);
    spawn(1, 'mortar', 1, cx, cz + 26);
    spawn(1, 'pikeman', 5, cx - 2, cz + 20);
    Cam.jump(cx, cz, true); Cam.tdist = Cam.dist = 58;
    const mine0 = game.units.filter((u) => u.owner === 0 && u.isMilitary && !u.def.hero && Math.abs(u.z - cz) < 40);
    const mine1 = game.units.filter((u) => u.owner === 1 && u.isMilitary && !u.def.hero && Math.abs(u.z - cz) < 40);
    game.orderMove(mine0, cx, cz + 4, true);
    game.orderMove(mine1, cx, cz - 4, true);
    for (let i = 0; i < 70; i++) game.tick();
  });
  await page.waitForTimeout(3000);
  await shot('sc_battle1');
  await page.evaluate(() => { const g = window.__nw.game; for (let i = 0; i < 60; i++) g.tick(); });
  await page.waitForTimeout(2500);
  await shot('sc_battle2');
  console.log(JSON.stringify(await page.evaluate(() => { const g = window.__nw.game; const c = (o) => g.units.filter((u) => u.owner === o && u.alive && u.isMilitary && !u.def.hero).length; return { p0: c(0), p1: c(1), proj: g.projectiles.length }; })));
};
