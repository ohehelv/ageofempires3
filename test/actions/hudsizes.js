// HUD at several viewport sizes (desktop, artifact side panel, small)
module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  const ev = (f, arg) => page.evaluate(f, arg);
  const frame = async (n = 2) => { const c0 = await ev(() => (window.__rafN = window.__rafN || 0)); await ev(() => { if (!window.__rafHook) { window.__rafHook = true; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f); } }); await page.waitForFunction((c) => window.__rafN >= c, c0 + n, { timeout: 60000 }); };
  await ev(() => { const { game, Input } = window.__nw; const p = game.players[0]; p.age = 2; p.res.coin = 900; const s = game.findBuildSpot(0, 'market', p.tc.x, p.tc.z, 12, 30); const m = game.placeBuilding('market', 0, s.cx0, s.cz0, { built: true }); Input.setSelection([m]); });
  await frame(3);
  for (const [w, h, name] of [[1920, 1080, 'sz_1920'], [1000, 760, 'sz_1000'], [760, 820, 'sz_760'], [520, 760, 'sz_520']]) {
    await page.setViewportSize({ width: w, height: h });
    await frame(4);
    const lay = await ev(() => { const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }; return { resbar: r('resbar'), agebox: r('agebox'), status: r('status-right'), mini: r('mini-wrap'), cmds: r('cmds'), sel: r('sel'), W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth }; });
    console.log(name, JSON.stringify(lay));
    await shot(name);
  }
};
