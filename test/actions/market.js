module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  const ev = (f, arg) => page.evaluate(f, arg);
  const frame = async (n = 2) => { const c0 = await ev(() => (window.__rafN = window.__rafN || 0)); await ev(() => { if (!window.__rafHook) { window.__rafHook = true; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f); } }); await page.waitForFunction((c) => window.__rafN >= c, c0 + n, { timeout: 60000 }); };
  await ev(() => { const { game, Input, Cam } = window.__nw; const p = game.players[0]; p.res.food = 900; p.res.wood = 900; p.res.coin = 900; const s = game.findBuildSpot(0, 'market', p.tc.x, p.tc.z, 12, 30); const m = game.placeBuilding('market', 0, s.cx0, s.cz0, { built: true }); game.cmdResearch(m, 'gangSaw'); game.cmdResearch(m, 'stonecutters'); Input.setSelection([m]); Cam.jump(m.x, m.z, true); });
  await frame(4);
  await shot('market_queue');
  const rows = await ev(() => { const t = document.querySelector('.trade'); const r = t.getBoundingClientRect(); const s = document.getElementById('sel').getBoundingClientRect(); return { trade: [r.left, r.top, r.width, r.height].map(Math.round), sel: [s.left, s.top, s.width, s.height].map(Math.round) }; });
  console.log(JSON.stringify(rows));
};
