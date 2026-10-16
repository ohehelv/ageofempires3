module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const { App, RS, UI, Input, Cam } = window.__nw;
    const civs = ['britain', 'france', 'spain', 'russia'];
    App.startGame({ mapSize: 'huge', biome: 'newEngland', seed: 5, players: civs.map((c, i) => ({ name: 'P' + i, civ: c, color: [0x2f6fd6, 0xc8352b, 0xe2b42c, 0x24a398][i], team: i + 1, human: i === 0, difficulty: 'hard' })) }, false);
    document.getElementById('menu').hidden = true;
    const g = App.game;
    const ai0 = new (g.ais[0].constructor)(g, g.players[0]); g.ais.push(ai0);
    const t0 = performance.now();
    for (let i = 0; i < 20 * 60 * 14; i++) g.tick();
    const simMs = performance.now() - t0;
    g.revealAll = true;
    const p = g.players[0];
    const tc = g.buildings.find((b) => b.owner === 0 && b.alive) || { x: g.size / 2, z: g.size / 2 };
    Cam.jump(tc.x, tc.z, true); Cam.dist = Cam.tdist = 110;
    Cam.update(0.016, g);
    // time JS parts of a frame
    const times = { rs: 0, ui: 0, fow: 0, tick: 0 };
    const N = 20;
    for (let k = 0; k < N; k++) {
      let a = performance.now(); g.tick(); times.tick += performance.now() - a;
      a = performance.now(); RS.computeViewBox(Cam); RS.frame(0.016, 0.5, Input.selection); times.rs += performance.now() - a;
      a = performance.now(); updateFow(); times.fow += performance.now() - a;
      a = performance.now(); UI.update(0.016); times.ui += performance.now() - a;
    }
    function updateFow() { window.__nw.GFX.fowTex.needsUpdate = true; }
    for (const k in times) times[k] = +(times[k] / N).toFixed(2);
    const counts = { units: g.units.length, alive: g.units.filter((u) => u.alive).length, b: g.buildings.length, proj: g.projectiles.length };
    return { simMsPer14min: Math.round(simMs), times, counts, alive: g.players.map((q) => q.alive) };
  });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(3000);
  await shot('perf_late');
};
