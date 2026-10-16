// HUD layout, new resource icons, stone/quarry, market trade, bastion
module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const ev = (f, arg) => page.evaluate(f, arg);
  const tick = (n) => ev((n) => { const g = window.__nw.game; for (let i = 0; i < n; i++) g.tick(); }, n);
  const frame = async (n = 2) => { const c0 = await ev(() => (window.__rafN = window.__rafN || 0)); await ev(() => { if (!window.__rafHook) { window.__rafHook = true; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f); } }); await page.waitForFunction((c) => window.__rafN >= c, c0 + n, { timeout: 60000 }); };
  // let the economy run a little so gatherer counts show
  await ev(() => { const { game } = window.__nw; const p = game.players[0]; const vs = game.units.filter((u) => u.owner === 0 && u.def.tags.has('villager')); vs.forEach((u, i) => { const r = i < 2 ? game.findNearestResource(['crate'], p.tc.x, p.tc.z, 30) : i < 4 ? game.findNearestResource(['tree'], p.tc.x, p.tc.z, 80) : game.findNearestResource(['quarry'], p.tc.x, p.tc.z, 80); if (r) u.cmdGather(r); }); });
  await tick(600);
  await frame(4);
  const layout = await ev(() => { const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }; return { resbar: r('resbar'), agebox: r('agebox'), status: r('status-right'), mini: r('mini-wrap'), cmds: r('cmds'), sel: r('sel'), hudH: getComputedStyle(document.documentElement).getPropertyValue('--hud-h'), clipT: getComputedStyle(document.documentElement).getPropertyValue('--clip-top') }; });
  console.log('layout', JSON.stringify(layout));
  console.log('res text', await ev(() => ['food', 'wood', 'coin', 'stone', 'pop'].map((k) => k + '=' + document.querySelector('#r-' + k + ' b').textContent + '/' + ((document.querySelector('#r-' + k + ' em') || {}).textContent || '')).join(' ')));
  await shot('hud_bottom');
  // resource tooltip
  const sb = await ev(() => { const b = document.getElementById('r-stone').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(sb.x, sb.y); await frame(3);
  console.log('tooltip', await ev(() => document.getElementById('tooltip').innerText.replace(/\n/g, ' | ')));
  await shot('hud_tip_stone');
  await page.mouse.move(640, 300); await frame(2);
  // villager selected: build card with bastion
  await ev(() => { const { game, Input } = window.__nw; const v = game.units.find((u) => u.owner === 0 && u.def.tags.has('villager')); Input.setSelection([v]); game.players[0].age = 2; game.players[0].res.stone = 600; game.players[0].res.wood = 900; });
  await frame(3);
  const tb = await ev(() => { const b = document.querySelectorAll('#cmds .cmd')[11].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(tb.x, tb.y); await frame(3);
  console.log('tower tip', await ev(() => document.getElementById('tooltip').innerText.replace(/\n/g, ' | ')));
  await shot('hud_vill_tower');
  await page.mouse.move(640, 300);
  // market with trade panel
  await ev(() => { const { game, Input } = window.__nw; const p = game.players[0]; const s = game.findBuildSpot(0, 'market', p.tc.x, p.tc.z, 12, 30); const m = game.placeBuilding('market', 0, s.cx0, s.cz0, { built: true }); p.res.coin = 800; Input.setSelection([m]); window.__mk = m; });
  await frame(4);
  const before = await ev(() => ({ ...window.__nw.game.players[0].res }));
  // click the "buy stone" button in the trade panel
  const bb = await ev(() => { const b = document.querySelector('[data-mk="buy:stone"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  console.log('trade btn', JSON.stringify(bb));
  if (bb) { await page.mouse.click(bb.x, bb.y); await frame(2); }
  await page.keyboard.press('z'); // sell food via hotkey (slot 10)
  await frame(2);
  const after = await ev(() => ({ ...window.__nw.game.players[0].res, ps: window.__nw.game.players[0].prices.stone }));
  console.log('market', JSON.stringify(before), '->', JSON.stringify(after));
  await shot('hud_market');
  // camera to a quarry, close up
  const q = await ev(() => { const { game, Cam } = window.__nw; const p = game.players[0]; const q = game.resources.filter((r) => r.rkind === 'quarry').sort((a, b) => Math.hypot(a.x - p.tc.x, a.z - p.tc.z) - Math.hypot(b.x - p.tc.x, b.z - p.tc.z))[0]; Cam.jump(q.x, q.z + 3, true); Cam.tdist = Cam.dist = 34; window.__nw.Input.setSelection([q]); return { x: q.x, z: q.z, amount: q.amount }; });
  console.log('quarry', JSON.stringify(q));
  await tick(40); await frame(6);
  await shot('hud_quarry');
  // bastion firing at enemies
  const tw = await ev(() => { const { game, Cam, Input } = window.__nw; const p = game.players[0]; game.revealAll = true; const s = game.findBuildSpot(0, 'tower', p.tc.x + 20, p.tc.z + 20, 0, 30); const t = game.placeBuilding('tower', 0, s.cx0, s.cz0, { built: true }); for (let i = 0; i < 6; i++) { const pos = game.freeNear(t.x + 16 + i, t.z + 8); game.addUnit('musketeer', 1, pos.x, pos.z); } Cam.jump(t.x + 6, t.z + 4, true); Cam.tdist = Cam.dist = 52; Input.setSelection([t]); return { x: t.x, z: t.z }; });
  let shots = 0;
  for (let k = 0; k < 6; k++) { await tick(30); await frame(2); shots = await ev(() => window.__nw.game.projectiles.filter((p) => p.type === 'cannon').length) || shots; if (shots) break; }
  console.log('tower', JSON.stringify(tw), 'cannonballs in flight', shots);
  await frame(3);
  await shot('hud_tower');
  await tick(200);
  console.log('enemy musketeers left', await ev(() => window.__nw.game.units.filter((u) => u.alive && u.owner === 1 && u.key === 'musketeer').length));
  // top layout
  await ev(() => { window.__nw.UI.setHudLayout('top'); window.__nw.Input.setSelection([]); });
  await frame(4);
  await shot('hud_top');
  await ev(() => window.__nw.UI.setHudLayout('bottom'));
  await frame(2);
};
