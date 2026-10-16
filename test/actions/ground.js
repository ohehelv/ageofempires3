module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1000);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const { game, GFX, Input, Cam } = window.__nw;
    const out = [];
    for (const [dx, dz] of [[0, 0], [10, 0], [0, 10], [-15, -8]]) {
      const x = Cam.x + dx, z = Cam.z + dz;
      const v = new THREE.Vector3(x, game.heightAt(x, z), z).project(GFX.camera);
      const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      const gp = Input.groundAt(sx, sy);
      out.push({ want: [x.toFixed(1), z.toFixed(1)], got: [gp.x.toFixed(1), gp.z.toFixed(1)], t: gp.t.toFixed(1) });
    }
    return { out, cam: [GFX.camera.position.x.toFixed(1), GFX.camera.position.y.toFixed(1), GFX.camera.position.z.toFixed(1)], rect: JSON.stringify(Input.canvas.getBoundingClientRect()) };
  });
  console.log(JSON.stringify(r, null, 1));
};
