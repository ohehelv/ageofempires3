module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1500);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const F = window.__nw.FX;
    const s = F.smoke;
    const cols = []; for (let i = 0; i < Math.min(4, s.n); i++) cols.push([s.col[i * 4], s.col[i * 4 + 1], s.col[i * 4 + 2], s.col[i * 4 + 3], s.size[i], s.pos[i*3+1]]);
    return { n: s.n, cols, blending: s.points.material.blending, tex: !!s.points.material.uniforms.uTex.value, img: s.points.material.uniforms.uTex.value && s.points.material.uniforms.uTex.value.image && s.points.material.uniforms.uTex.value.image.width };
  });
  console.log(JSON.stringify(info));
  // zoom to TC chimney
  await page.evaluate(() => { const { game, Cam } = window.__nw; const tc = game.players[0].tc; Cam.jump(tc.x - 3, tc.z - 2, true); Cam.tdist = Cam.dist = 26; });
  await page.waitForTimeout(3000);
  await shot('smoke_zoom');
};
