module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1500);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__nw.game && !window.__nw.App.attract, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const { game, Input } = window.__nw; Input.setSelection(game.units.filter((u) => u.owner === 0 && u.def.tags.has('villager'))); });
  await page.waitForTimeout(800);
  console.log('cmds', await page.evaluate(() => window.__nw.UI.cmds.map((c) => c && c.title).join('|')));
  await page.evaluate(() => { window.__keys = []; window.addEventListener('keydown', (e) => window.__keys.push(e.key + ':' + (e.target && e.target.tagName))); });
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  console.log('keys', await page.evaluate(() => JSON.stringify(window.__keys)), 'placement', await page.evaluate(() => JSON.stringify(window.__nw.Input.placement && window.__nw.Input.placement.key)));
  const r = await page.evaluate(() => { try { return window.__nw.UI.pressCommand(0); } catch (e) { return 'ERR ' + e.message + e.stack; } });
  console.log('press', r, await page.evaluate(() => JSON.stringify(window.__nw.Input.placement && window.__nw.Input.placement.key)));
};
