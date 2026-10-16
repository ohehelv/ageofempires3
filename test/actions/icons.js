// render the resource pictograms at several sizes for a close visual check
module.exports = async (page, { shot }) => {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const Glyph = window.__nwGlyph;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:999;background:#0d131a;padding:20px;display:grid;gap:14px;color:#ece2c6;font:14px sans-serif';
    const names = ['food', 'wood', 'coin', 'stone', 'pop', 'xp', 'ship', 'villager'];
    for (const s of [96, 48, 28, 20]) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:18px;align-items:center';
      row.innerHTML = '<b style="width:40px">' + s + '</b>' + names.map((n) => '<img style="width:' + s + 'px;height:' + s + 'px" src="' + Glyph.get(n, 96) + '">').join('');
      d.appendChild(row);
    }
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px';
    row.innerHTML = ['food', 'wood', 'stone'].map((r) => '<img style="width:50px;height:50px" src="' + Glyph.tradeIcon(r, 'buy') + '"><img style="width:50px;height:50px" src="' + Glyph.tradeIcon(r, 'sell') + '">').join('');
    d.appendChild(row);
    document.body.appendChild(d);
  });
  await page.waitForTimeout(300);
  await shot('icons');
};
