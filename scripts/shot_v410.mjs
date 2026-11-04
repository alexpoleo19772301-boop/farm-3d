import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'www');
const outDir = path.join(__dirname, '..', 'shots', 'v410');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'
};
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const fp = path.join(root, u.replace(/^\//, ''));
  if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

async function shot(page, name) {
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log('wrote', name);
  return p;
}

async function prep(page) {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('vintiki_save_v40', JSON.stringify({
      unlocked: 100, coins: 500, stars: {}, boosters: { undo: 5, flask: 2, hint: 3 },
      musicOn: false, vibrateOn: false, seenTut: {
        basic: 1, moves: 1, hidden: 1, frozen: 1, locked: 1, timer: 1, varcap: 1, mixing: 1
      }, trackId: 1, pourSfxId: 0, colorBlindMode: false, langPref: 'ru'
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__V && window.__V.VERSION);
}

async function runViewport(vp) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await prep(page);
  const tag = `${vp.w}x${vp.h}`;

  // Move limit HUD — level 1
  await page.evaluate(() => window.__V.startLevel(0));
  await page.waitForTimeout(400);
  await shot(page, `moves_hud_${tag}.png`);

  // Fail screen — burn moves via debug
  await page.evaluate(() => {
    const st = window.__V.getState();
    // force endLose by exhausting moves artificially
    // expose: call pour until limit by setting internal via auto
  });
  // Directly trigger lose UI by exhausting: set moves high through finish path
  await page.evaluate(() => {
    // monkey: open lose via starting and forcing
    const g = window.__V;
    g.startLevel(0);
  });
  await page.waitForTimeout(200);
  // Use DOM: call endLose if exposed — expose temporarily
  await page.evaluate(() => {
    // Force via moves: keep pouring illegal won't work. Inject by evaluating game closure — not available.
    // Click retry path: manually show lose screen by manipulating DOM like game does.
    // Better: patch __V to call endLose — we'll add it.
  });

  // Locked flask level 15
  await page.evaluate(() => window.__V.startLevel(14));
  await page.waitForTimeout(500);
  await shot(page, `locked_${tag}.png`);

  // Timer level 20
  await page.evaluate(() => window.__V.startLevel(19));
  await page.waitForTimeout(500);
  await shot(page, `timer_${tag}.png`);

  // Varcap level 25
  await page.evaluate(() => window.__V.startLevel(24));
  await page.waitForTimeout(500);
  await shot(page, `varcap_${tag}.png`);

  // Mixing level 40
  await page.evaluate(() => window.__V.startLevel(39));
  await page.waitForTimeout(500);
  await shot(page, `mixing_${tag}.png`);

  await browser.close();
}

// Expose endLose on __V first via a tiny game.js note — use page to show lose DOM
async function failShots() {
  for (const vp of [{ w: 390, h: 844 }, { w: 360, h: 800 }]) {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await prep(page);
    await page.evaluate(() => window.__V.startLevel(0));
    await page.waitForTimeout(300);
    // Show lose screen by mimicking endLose DOM updates
    await page.evaluate(() => {
      const t = (k, v) => window.I18N ? I18N.t(k, v) : k;
      document.getElementById('lose-title').textContent = t('lose_moves_title');
      document.getElementById('lose-body').textContent = t('lose_moves_body');
      const b = document.getElementById('btn-lose-extra');
      b.style.display = 'inline-flex';
      b.textContent = t('lose_plus_moves', { cost: 40 });
      // show lose screen
      ['home','map','win','lose','settings','daily','tut'].forEach(s => {
        const el = document.getElementById('sc-' + s);
        if (el) el.classList.toggle('on', s === 'lose');
      });
      document.getElementById('hud').style.display = 'none';
      document.getElementById('boosters').style.display = 'none';
    });
    await page.waitForTimeout(200);
    await shot(page, `fail_moves_${vp.w}x${vp.h}.png`);

    // time fail variant
    await page.evaluate(() => {
      const t = (k, v) => window.I18N ? I18N.t(k, v) : k;
      document.getElementById('lose-title').textContent = t('lose_time_title');
      document.getElementById('lose-body').textContent = t('lose_time_body');
      const b = document.getElementById('btn-lose-extra');
      b.textContent = t('lose_plus_time', { cost: 50 });
    });
    await page.waitForTimeout(150);
    await shot(page, `fail_time_${vp.w}x${vp.h}.png`);
    await browser.close();
  }
}

await runViewport({ w: 390, h: 844 });
await runViewport({ w: 360, h: 800 });
await failShots();
server.close();
console.log('DONE', fs.readdirSync(outDir).join(', '));
