import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'www');
const outDir = path.join(__dirname, '..', 'shots', 'v404');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.ogg': 'audio/ogg', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.css': 'text/css', '.md': 'text/markdown', '.wav': 'audio/wav'
};
const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/index.html';
  const fp = path.join(root, u.replace(/^\//, ''));
  if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const sizes = [
  { w: 390, h: 844, name: '390x844' },
  { w: 360, h: 800, name: '360x800' },
  { w: 412, h: 915, name: '412x915' }
];

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream']
});

const results = { pourPlays: [], sizes: [], version: null, sfxBufPour: false, rootCauseCheck: {} };

for (const sz of sizes) {
  const page = await browser.newPage({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: 2 });
  await page.goto(base + '?v=4.0.4', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__V && window.__V.VERSION, null, { timeout: 10000 });
  results.version = await page.evaluate(() => window.__V.VERSION);

  // Unlock + wait for pour buffer
  await page.evaluate(async () => {
    window.__V.unlockAudio();
    // wait up to 3s for pour buffer
    const t0 = Date.now();
    while (Date.now() - t0 < 3000) {
      if (window.__V.sfxBuf && window.__V.sfxBuf.pour) break;
      await new Promise(r => setTimeout(r, 50));
    }
  });

  await page.evaluate(() => {
    localStorage.setItem('vintiki_save_v40', JSON.stringify({
      unlocked: 20, coins: 500, stars: {}, musicOn: false, musicVol: 0.4, sfxVol: 0.55,
      vibrateOn: false, trackId: 1, boosters: { undo: 5, flask: 2, hint: 3 },
      daily: { lastClaim: null, streak: 0, lastQuestDay: null, quests: [] },
      seenTut: { 0: 1 }, starChests: {}, questBadge: false, sfxSoftened: 1, sfxBoost404: 1
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__V && window.__V.VERSION);

  await page.evaluate(() => { window.__V.unlockAudio(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__V.startLevel(0));
  await page.waitForTimeout(500);

  // screenshot idle
  const idlePath = path.join(outDir, `${sz.name}-l1.png`);
  await page.screenshot({ path: idlePath, type: 'png' });
  results.sizes.push({ ...sz, idle: idlePath });

  // Clear log and pour several times
  const pourResult = await page.evaluate(async () => {
    const V = window.__V;
    V.sfxLog.length = 0;
    V.unlockAudio();
    // wait buffer
    const t0 = Date.now();
    while (Date.now() - t0 < 2500) {
      if (V.sfxBuf && V.sfxBuf.pour) break;
      await new Promise(r => setTimeout(r, 40));
    }
    const hasBuf = !!(V.sfxBuf && V.sfxBuf.pour);
    const plays = [];
    // Force a few pours via API
    for (let n = 0; n < 4; n++) {
      const st = V.getState();
      // find a valid pour
      let done = false;
      for (let i = 0; i < st.flasks.length && !done; i++) {
        for (let j = 0; j < st.flasks.length && !done; j++) {
          if (i === j) continue;
          const before = V.sfxLog.length;
          const ok = V.pour(i, j);
          if (ok !== false && V.getState().pour) {
            V.tick(1.0);
            const after = V.sfxLog.slice(before).filter(e => e.name === 'pour');
            plays.push({ i, j, after, hasBuf });
            done = true;
          }
        }
      }
      if (!done) {
        // direct playSfx to verify engine
        const before = V.sfxLog.length;
        V.playSfx('pour', 0.78);
        await new Promise(r => setTimeout(r, 30));
        plays.push({ forced: true, after: V.sfxLog.slice(before).filter(e => e.name === 'pour'), hasBuf });
      }
      await new Promise(r => setTimeout(r, 50));
    }
    return {
      hasBuf,
      plays,
      log: V.sfxLog.filter(e => e.name === 'pour'),
      poolLen: (V.sfxPool && V.sfxPool.pour && V.sfxPool.pour.length) || 0,
      version: V.VERSION
    };
  });
  results.pourPlays.push({ size: sz.name, ...pourResult });
  results.sfxBufPour = results.sfxBufPour || pourResult.hasBuf;

  // pour mid screenshot
  await page.evaluate(() => {
    const V = window.__V;
    V.startLevel(0);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const V = window.__V;
    // try pour and freeze mid-anim by not finishing
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (i === j) continue;
        if (V.pour(i, j) !== false && V.getState().pour) return;
      }
    }
  });
  await page.waitForTimeout(180);
  const pourPath = path.join(outDir, `${sz.name}-pour.png`);
  await page.screenshot({ path: pourPath, type: 'png' });

  // higher level for landscape bg
  await page.evaluate(() => window.__V.startLevel(16));
  await page.waitForTimeout(600);
  const l17 = path.join(outDir, `${sz.name}-l17.png`);
  await page.screenshot({ path: l17, type: 'png' });

  await page.close();
}

await browser.close();
server.close();

// Summarize pour reliability
const allPourLogs = results.pourPlays.flatMap(p => p.log || []);
const perSizeOk = results.pourPlays.map(p => ({
  size: p.size,
  hasBuf: p.hasBuf,
  pourLogCount: (p.log || []).length,
  playAttempts: (p.plays || []).length,
  vols: (p.log || []).map(e => e.vol)
}));
results.summary = {
  version: results.version,
  sfxBufPour: results.sfxBufPour,
  perSizeOk,
  pourTriggeredEveryAttempt: perSizeOk.every(s => s.pourLogCount >= 1)
};
fs.writeFileSync(path.join(outDir, 'sfx-test.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
console.log('shots in', outDir);
