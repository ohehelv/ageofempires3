module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1200);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const ev = (f, arg) => page.evaluate(f, arg);
  const tick = (n) => ev((n) => { const g = window.__nw.game; for (let i = 0; i < n; i++) g.tick(); }, n);
  const screenOf = (x, z) => ev(([x, z]) => { const { game, GFX } = window.__nw; const v = new THREE.Vector3(x, game.heightAt(x, z) + 0.5, z).project(GFX.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; }, [x, z]);
  const frame = async (n = 2) => { const c0 = await ev(() => (window.__rafN = window.__rafN || 0)); await ev(() => { if (!window.__rafHook) { window.__rafHook = true; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f); } }); await page.waitForFunction((c) => window.__rafN >= c, c0 + n, { timeout: 60000 }); };
  // setup
  const tc = await ev(() => { const { game, Cam } = window.__nw; game.revealAll = true; const p = game.players[0]; p.age = 3; p.res.food = p.res.wood = p.res.coin = 4000; Cam.jump(p.tc.x, p.tc.z, true); return { x: p.tc.x, z: p.tc.z }; });
  // 1) fort wagon
  await ev(() => { const { game, Input } = window.__nw; const p = game.players[0]; const pos = game.freeNear(p.tc.x + 8, p.tc.z + 8); const w = game.addUnit('fortWagon', 0, pos.x, pos.z); Input.setSelection([w]); });
  await frame();
  await page.keyboard.press('q');
  const spot = await ev(() => { const { game } = window.__nw; const p = game.players[0]; const s = game.findBuildSpot(0, 'fort', p.tc.x, p.tc.z, 26, 60); return { x: (s.cx0 + 4) * 2 + 0.5, z: (s.cz0 + 4) * 2 + 0.5, cx0: s.cx0, cz0: s.cz0 }; });
  await ev(([x, z]) => window.__nw.Cam.jump(x, z, true), [spot.x, spot.z]); await frame(3);
  let sp = await screenOf(spot.x, spot.z);
  console.log('dbg ground now', JSON.stringify(await ev(([sx, sy]) => { const g = window.__nw.Input.groundAt(sx, sy); const C = window.__nw.Cam; return { g: [g.x.toFixed(1), g.z.toFixed(1)], cam: [C.x.toFixed(1), C.z.toFixed(1), C.dist.toFixed(1), C.groundY.toFixed(2)] }; }, [sp.x, sp.y])), 'spot', spot.x, spot.z);
  await page.mouse.move(sp.x, sp.y); await frame(3);
  console.log('dbg after move', JSON.stringify(await ev(() => { const C = window.__nw.Cam, I = window.__nw.Input; return { cam: [C.x.toFixed(1), C.z.toFixed(1), C.dist.toFixed(1), C.groundY.toFixed(2)], mouse: [I.mouse.x, I.mouse.y], keys: [...I.keys] }; })));
  console.log('dbg manual', JSON.stringify(await ev(() => { const I = window.__nw.Input; const gp = I.groundAt(I.mouse.x, I.mouse.y); I.updatePlacement(); return { gp: [gp.x.toFixed(1), gp.z.toFixed(1)], cx0: I.placement && I.placement.cx0, cz0: I.placement && I.placement.cz0, mouse: [I.mouse.x, I.mouse.y] }; })));
  console.log('placement ok?', await ev(() => JSON.stringify(window.__nw.Input.placement && { ok: window.__nw.Input.placement.ok, k: window.__nw.Input.placement.key, cx0: window.__nw.Input.placement.cx0, cz0: window.__nw.Input.placement.cz0 })), 'spot', spot.cx0, spot.cz0);
  await page.mouse.click(sp.x, sp.y);
  console.log('wagon order:', await ev(() => { const w = window.__nw.game.units.find((u) => u.key === 'fortWagon' && u.alive); return w && w.order && w.order.type; }));
  await tick(400);
  console.log('fort:', await ev(() => window.__nw.game.buildings.filter((b) => b.key === 'fort').map((b) => (b.built ? 'built' : 'building ' + b.progress.toFixed(2))).join(',') || 'none'), 'wagon:', await ev(() => window.__nw.game.units.filter((u) => u.key === 'fortWagon' && u.alive).length));
  await tick(1600);
  console.log('fort after:', await ev(() => window.__nw.game.buildings.filter((b) => b.key === 'fort').map((b) => (b.built ? 'built' : 'building ' + b.progress.toFixed(2))).join(',')));
  // 2) market trade
  await ev(() => { const { game, Input } = window.__nw; const s = game.findBuildSpot(0, 'market', game.players[0].tc.x, game.players[0].tc.z, 12, 30); const m = game.placeBuilding('market', 0, s.cx0, s.cz0, { built: true }); Input.setSelection([m]); });
  await frame();
  const before = await ev(() => ({ ...window.__nw.game.players[0].res }));
  await page.keyboard.press('z'); await page.keyboard.press('x');
  const after = await ev(() => ({ ...window.__nw.game.players[0].res, pf: window.__nw.game.players[0].prices.food }));
  console.log('market', JSON.stringify(before), '->', JSON.stringify(after));
  // 3) alarm
  await ev(() => { const { game, Input } = window.__nw; Input.setSelection([game.players[0].tc]); });
  await frame();
  await page.keyboard.press('z');
  await tick(300);
  console.log('garrison:', await ev(() => window.__nw.game.players[0].tc.garrison.length));
  await page.keyboard.press('z');
  await tick(5);
  console.log('garrison after release:', await ev(() => window.__nw.game.players[0].tc.garrison.length));
  // 4) explorer -> treasure via right click
  const tr = await ev(() => { const { game, Input, Cam } = window.__nw; const ex = game.players[0].explorer; const t = game.treasures.filter((t) => t.alive).sort((a, b) => Math.hypot(a.x - ex.x, a.z - ex.z) - Math.hypot(b.x - ex.x, b.z - ex.z))[0]; game.revealAll = true; Cam.jump(t.x, t.z, true); Input.setSelection([ex]); return { x: t.x, z: t.z, guards: t.guards.map((u) => u.key), reward: t.reward }; });
  console.log('treasure target', JSON.stringify(tr));
  await frame(3);
  sp = await screenOf(tr.x, tr.z);
  await page.mouse.click(sp.x, sp.y - 8, { button: 'right' });
  console.log('explorer order:', await ev(() => { const o = window.__nw.game.players[0].explorer.order; return o && o.type; }));
  await tick(1400);
  console.log('treasure alive:', await ev(([x, z]) => window.__nw.game.treasures.find((t) => t.x === x && t.z === z).alive, [tr.x, tr.z]), 'explorer hp', await ev(() => { const e = window.__nw.game.players[0].explorer; return e.hp.toFixed(0) + (e.ko ? ' KO' : ''); }), 'res', JSON.stringify(await ev(() => window.__nw.game.players[0].res)));
  await frame();
  await shot('flows_treasure');
  // 5) KO + ransom
  await ev(() => { const g = window.__nw.game; const e = g.players[0].explorer; g.damage(e, 9999, null, 'melee', null, 1); });
  console.log('ko:', await ev(() => window.__nw.game.players[0].explorer.ko));
  await ev(() => { const { game, Input } = window.__nw; Input.setSelection([game.players[0].tc]); });
  await frame();
  await page.keyboard.press('x');
  console.log('after ransom ko:', await ev(() => window.__nw.game.players[0].explorer.ko));
  // 6) trading post by right-click on socket
  const so = await ev(() => { const { game, Input, Cam } = window.__nw; const ex = game.players[0].explorer; const s = game.sockets.filter((s) => !s.tp).sort((a, b) => Math.hypot(a.x - ex.x, a.z - ex.z) - Math.hypot(b.x - ex.x, b.z - ex.z))[0]; Cam.jump(s.x, s.z, true); Input.setSelection([ex]); return { x: s.x, z: s.z }; });
  await frame(3);
  sp = await screenOf(so.x, so.z);
  await page.mouse.click(sp.x, sp.y - 6, { button: 'right' });
  console.log('tp:', await ev(() => window.__nw.game.buildings.filter((b) => b.key === 'tradingPost' && b.owner === 0).length), 'order', await ev(() => { const o = window.__nw.game.players[0].explorer.order; return o && o.type; }));
  await tick(1200);
  console.log('tp built:', await ev(() => window.__nw.game.buildings.filter((b) => b.key === 'tradingPost' && b.owner === 0).map((b) => b.built)));
  await frame();
  await shot('flows_tp');
};
