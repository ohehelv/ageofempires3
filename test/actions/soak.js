// let a bot play the human slot for a while with the real UI attached; watch for errors
module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  const ev = (f, arg) => page.evaluate(f, arg);
  await ev(() => { const { game } = window.__nw; const BotAI = window.__nwBot; if (BotAI) game.ais.push(new BotAI(game, game.players[0])); window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); });
  const frame = async (n = 2) => { const c0 = await ev(() => (window.__rafN = window.__rafN || 0)); await ev(() => { if (!window.__rafHook) { window.__rafHook = true; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f); } }); await page.waitForFunction((c) => window.__rafN >= c, c0 + n, { timeout: 60000 }); };
  for (let m = 1; m <= 14; m++) {
    await ev(() => { const { game } = window.__nw; for (let i = 0; i < 1200; i++) game.tick(); });
    await frame(2);
    if (m % 4 === 0) {
      const info = await ev(() => { const { game, Input, Cam } = window.__nw; const p = game.players[0]; const b = game.buildings.filter((x) => x.alive && x.owner === 0); const pick = b.find((x) => x.key === 'tower') || b.find((x) => x.key === 'market') || p.tc; if (pick) { Input.setSelection([pick]); Cam.jump(pick.x, pick.z, true); } return { t: (game.time / 60).toFixed(1), age: p.age, res: Object.fromEntries(Object.entries(p.res).map(([k, v]) => [k, v | 0])), blds: [...new Set(b.map((x) => x.key))].join(','), sel: pick && pick.key, over: game.over }; });
      console.log('min', m, JSON.stringify(info));
      await frame(3);
      await shot('soak_' + m);
    }
  }
  console.log('errors', JSON.stringify(await ev(() => window.__errs)), 'loopErrs', await ev(() => window.__nw.App.errN || 0));
};
