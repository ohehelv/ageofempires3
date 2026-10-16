module.exports = async (page, { shot }) => {
  await page.waitForTimeout(2000);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const scr = async (expr) => page.evaluate((expr) => {
    const { game, GFX } = window.__nw;
    const v = new (window.THREE.Vector3)();
    const pick = new Function('game', 'return ' + expr)(game);
    const list = Array.isArray(pick) ? pick : [pick];
    return list.map((e) => { v.set(e.x, game.heightAt(e.x, e.z) + 1, e.z).project(GFX.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, id: e.id }; });
  }, expr);
  // box select villagers
  const vs = await scr("game.units.filter(u=>u.owner===0&&u.def.tags.has('villager'))");
  const xs = vs.map((p) => p.x), ys = vs.map((p) => p.y);
  await page.mouse.move(Math.min(...xs) - 25, Math.min(...ys) - 35);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 25, Math.max(...ys) + 25, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('selected', await page.evaluate(() => window.__nw.Input.selection.length));
  // right-click berry bush
  const bush = await scr("game.resources.filter(r=>r.rkind==='bush').sort((a,b)=>Math.hypot(a.x-game.players[0].tc.x,a.z-game.players[0].tc.z)-Math.hypot(b.x-game.players[0].tc.x,b.z-game.players[0].tc.z))[0]");
  await page.mouse.click(bush[0].x, bush[0].y, { button: 'right' });
  await page.waitForTimeout(300);
  console.log('orders', await page.evaluate(() => window.__nw.Input.selection.map((u) => u.order && u.order.type + ':' + (u.order.target && u.order.target.rkind)).join(',')));
  // build a house: press Q then click ground near TC
  await page.keyboard.press('q');
  const spot = await scr("({x: game.players[0].tc.x - 12, z: game.players[0].tc.z + 10})");
  await page.mouse.move(spot[0].x, spot[0].y);
  await page.waitForTimeout(400);
  await shot('ia_place');
  await page.mouse.click(spot[0].x, spot[0].y);
  await page.waitForTimeout(300);
  console.log('buildings', await page.evaluate(() => window.__nw.game.buildings.filter((b) => b.owner === 0).map((b) => b.key + (b.built ? '' : '(u)')).join(',')));
  // select TC by clicking and queue settlers with Q
  const tc = await scr("game.players[0].tc");
  await page.mouse.click(tc[0].x, tc[0].y - 70);
  await page.waitForTimeout(300);
  console.log('sel', await page.evaluate(() => window.__nw.Input.selection.map((e) => e.key).join(',')));
  await page.keyboard.press('q');
  await page.keyboard.press('q');
  console.log('queue', await page.evaluate(() => window.__nw.game.players[0].tc.queue.map((q) => q.key).join(',')));
  await page.waitForTimeout(500);
  await shot('ia_tc');
  // run 60 seconds of sim
  await page.evaluate(() => { const g = window.__nw.game; for (let i = 0; i < 1200; i++) g.tick(); });
  await page.waitForTimeout(2500);
  await shot('ia_60s');
  console.log(JSON.stringify(await page.evaluate(() => { const g = window.__nw.game; return g.units.filter((u) => u.owner === 0 && u.alive).map((u) => u.key + ':' + (u.order ? u.order.type : 'idle')); })));
};
