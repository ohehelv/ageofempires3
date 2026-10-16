// Браузерный тест: Chromium (Playwright) открывает dist/kolonii.html и выполняет test/actions/<имя>.js.
// Запуск: node test/run.cjs hud   (скриншоты сохраняются в test/*.png)
// Переменные: W/H — размер окна, Q — качество графики (low|medium|high), PW_GPU=1 — не форсировать SwiftShader.
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  throw new Error('Playwright не найден: выполните npm install и npx playwright install chromium');
}

(async () => {
  const { chromium } = loadPlaywright();
  const action = process.argv[2] || 'menu';
  const args = process.env.PW_GPU ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await chromium.launch({ args: args.concat(['--autoplay-policy=no-user-gesture-required']) });
  const W = +(process.env.W || 1280), H = +(process.env.H || 720);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(120000);
  if (process.env.Q) await page.addInitScript((q) => { try { localStorage.setItem('nw-quality', q); } catch (e) { /* ignore */ } }, process.env.Q);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + '] ' + m.text()); });
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 6).join('\n')); });
  // three.js и шрифты отдаём локально, чтобы тест не зависел от сети
  await page.route('**/three.min.js', (r) => r.fulfill({ path: path.join(path.dirname(require.resolve('three')), 'three.min.js'), contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  const t0 = Date.now();
  await page.goto(pathToFileURL(path.join(__dirname, '../dist/kolonii.html')).href);
  const file = path.join(__dirname, 'actions', action + '.js');
  if (fs.existsSync(file)) {
    await require(file)(page, { shot: async (name) => { await page.screenshot({ path: path.join(__dirname, name + '.png') }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1) + 's'); } });
  } else {
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(__dirname, 'menu.png') });
  }
  await browser.close();
})();
