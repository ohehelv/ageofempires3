module.exports = async (page, { shot }) => {
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => { const g = window.__nw.game; return g ? { units: g.units.length, b: g.buildings.length, t: g.time.toFixed(1), trees: g.trees.length, q: window.__nw.GFX.quality } : 'nogame'; });
  console.log(JSON.stringify(info));
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  console.log('fps', fps);
  await shot('menu');
};
