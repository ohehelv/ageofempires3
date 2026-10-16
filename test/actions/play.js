module.exports = async (page, { shot }) => {
  await page.waitForTimeout(2500);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot('play_start');
  // select all villagers via API, order build house with first one
  const info = await page.evaluate(() => {
    const { game, Input } = window.__nw;
    const vs = game.units.filter((u) => u.owner === 0 && u.def.tags.has('villager'));
    Input.setSelection(vs);
    return { vills: vs.length, cmds: window.__nw.UI.cmds.filter(Boolean).map((c) => c.title) };
  });
  console.log(JSON.stringify(info));
  await page.waitForTimeout(800);
  await shot('play_select');
  // hover a command to show tooltip
  await page.hover('#cmds .cmd:nth-child(1)');
  await page.waitForTimeout(600);
  await shot('play_tooltip');
  // fast forward 2 minutes with an AI controlling the human too
  await page.evaluate(() => {
    const { game } = window.__nw;
    const ai = new (game.ais[0].constructor)(game, game.players[0]);
    for (let i = 0; i < 2400; i++) { game.tick(); if (i % 30 === 0) ai.think(); }
  });
  await page.waitForTimeout(1500);
  await shot('play_2min');
  const st = await page.evaluate(() => { const g = window.__nw.game; const p = g.players[0]; return { t: g.time, res: p.res, age: p.age, units: g.units.filter((u) => u.owner === 0 && u.alive).length, b: g.buildings.filter((b) => b.owner === 0).map((b) => b.key) }; });
  console.log(JSON.stringify(st));
};
