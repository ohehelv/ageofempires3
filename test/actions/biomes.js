module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  for (const biome of ['newEngland', 'plains', 'sonora', 'yukon']) {
    await page.evaluate((biome) => {
      const { App } = window.__nw;
      App.startGame({ mapSize: 'medium', biome, seed: 99, players: [
        { name: 'Вы', civ: 'spain', color: 0x2f6fd6, team: 1, human: true },
        { name: 'Бот', civ: 'russia', color: 0xc8352b, team: 2, difficulty: 'hard' }] }, false);
      document.getElementById('menu').hidden = true;
      const g = App.game; g.revealAll = true;
      // camera over the largest water area or over the enemy base
      let wx = 0, wz = 0, n = 0;
      for (let i = 0; i < g.N * g.N; i++) if (g.map.kind[i] === 2) { wx += (i % g.N) * 2; wz += Math.floor(i / g.N) * 2; n++; }
      const { Cam } = window.__nw;
      if (n > 30) Cam.jump(wx / n, wz / n + 10, true); else Cam.jump(g.size / 2, g.size / 2, true);
      Cam.tdist = Cam.dist = 85; Cam.tyaw = Cam.yaw = 0.3;
      for (let i = 0; i < 400; i++) g.tick();
    }, biome);
    await page.waitForTimeout(3500);
    await shot('biome_' + biome);
  }
};
