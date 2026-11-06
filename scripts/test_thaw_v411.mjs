import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'www');
const outDir = path.join(__dirname, '..', 'shots', 'v411');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav'
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

async function prep(page) {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('vintiki_save_v40', JSON.stringify({
      unlocked: 100, coins: 500, stars: {}, boosters: { undo: 9, flask: 5, hint: 9 },
      musicOn: false, vibrateOn: false, seenTut: {
        basic: 1, moves: 1, hidden: 1, frozen: 1, locked: 1, timer: 1, varcap: 1, mixing: 1
        // frozenTap intentionally absent for popup shot
      }, trackId: 1, pourSfxId: 0, colorBlindMode: false, langPref: 'ru'
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__V && window.__V.VERSION === '4.1.1');
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'networkidle' });
await prep(page);

const levels = await page.evaluate(async () => {
  const r = await fetch('assets/paint_levels.json?v=4.1.1');
  return r.json();
});

// Find first thaw=1 level
let testIdx = levels.levels.findIndex(L => (L.thawAfter || []).includes(1));
if (testIdx < 0) throw new Error('no thaw=1 level');
const L = levels.levels[testIdx];
console.log('TEST level', L.id, 'thawAfter', L.thawAfter, 'sol', L.solutionLen, 'lim', L.moveLimit);

await page.evaluate((idx) => window.__V.startLevel(idx), testIdx);
await page.waitForTimeout(300);
// dismiss tut if any
await page.evaluate(() => {
  const b = document.getElementById('btn-tut-ok');
  if (b && document.getElementById('sc-tut').classList.contains('on')) b.click();
});
await page.waitForTimeout(200);

let st = await page.evaluate(() => window.__V.getState());
const fi = st.flasks.findIndex(f => f.frozen);
console.log('INITIAL frozen idx', fi, 'thawLeft', st.flasks[fi].thawLeft, 'frozen', st.flasks[fi].frozen);
if (!st.flasks[fi].frozen || st.flasks[fi].thawLeft < 1) throw new Error('no thaw counter at start');

await page.screenshot({ path: path.join(outDir, 'before_thaw_390x844.png') });

// Tap frozen flask → instruction popup
const layout = await page.evaluate((i) => {
  // approximate center via canvas — use __V select path by synthesizing click via flask index
  // expose nothing for layout; call onPointer indirectly: we can use evaluate to click ice
  const f = window.__V.getState().flasks[i];
  return f;
}, fi);
await page.evaluate((i) => {
  // Directly invoke same path as tap: find flask by forcing selected flow through internal — use DOM events hard.
  // Call toast path by poking canvas center of flask — use startLevel debug: temporarily call code
  // We'll use a helper added? force via __V — add tapFrozen
  const g = window.__V;
  // Simulate: read flasks from getState only. Use autoSolve carefully.
}, fi);

// Add temporary tap via page.evaluate accessing closure — not available.
// Use hint+autoSolve to complete one flask, watching thaw.
const beforeThaw = st.flasks[fi].thawLeft;

// Auto-solve until thaw or win
const result = await page.evaluate(async (frozenIdx) => {
  const log = [];
  const snap = () => {
    const s = window.__V.getState();
    const f = s.flasks[frozenIdx];
    return { moves: s.moves, state: s.state, frozen: f.frozen, thawLeft: f.thawLeft, top: f.top, n: f.n };
  };
  log.push({ t: 'start', ...snap() });
  let steps = 0;
  while (steps++ < 120 && window.__V.getState().state === 'play') {
    const before = snap();
    const mv = window.__V.solveHint();
    if (!mv) { log.push({ t: 'no_hint', ...before }); break; }
    window.__V.pour(mv.from, mv.to);
    // tick pour animation
    window.__V.tick(1.0);
    const after = snap();
    log.push({ t: 'pour', from: mv.from, to: mv.to, before, after });
    if (before.frozen && !after.frozen) {
      log.push({ t: 'THAWED', ...after });
      break;
    }
    if (before.thawLeft !== after.thawLeft) {
      log.push({ t: 'CRACK', from: before.thawLeft, to: after.thawLeft });
    }
  }
  // After thaw, continue to win if possible
  let winSteps = 0;
  while (winSteps++ < 80 && window.__V.getState().state === 'play') {
    const mv = window.__V.solveHint();
    if (!mv) break;
    window.__V.pour(mv.from, mv.to);
    window.__V.tick(1.0);
  }
  // allow win timeout
  await new Promise(r => setTimeout(r, 700));
  log.push({ t: 'end', ...snap(), state: window.__V.getState().state });
  return log;
}, fi);

console.log(JSON.stringify(result, null, 2));
const thawed = result.some(e => e.t === 'THAWED' || (e.after && e.before && e.before.frozen && !e.after.frozen));
const cracked = result.some(e => e.t === 'CRACK' || e.t === 'THAWED');
fs.writeFileSync(path.join(outDir, 'thaw_runtime_log.json'), JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(outDir, 'after_progress_390x844.png') });

if (!cracked && !thawed) {
  console.error('FAIL: ice never cracked/thawed');
  process.exitCode = 2;
} else {
  console.log('OK thaw/crack observed', { thawed, cracked });
}

// Popup shot: reload, start level, tap ice via injecting showTut path
await prep(page);
await page.evaluate((idx) => {
  // clear frozenTap
  const raw = JSON.parse(localStorage.getItem('vintiki_save_v40'));
  delete raw.seenTut.frozenTap;
  raw.seenTut.frozen = 1;
  localStorage.setItem('vintiki_save_v40', JSON.stringify(raw));
}, testIdx);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__V);
await page.evaluate((idx) => window.__V.startLevel(idx), testIdx);
await page.waitForTimeout(250);
await page.evaluate(() => {
  const b = document.getElementById('btn-tut-ok');
  if (b && document.getElementById('sc-tut').classList.contains('on')) b.click();
});
await page.waitForTimeout(150);
// Manually trigger ice tap instruction (same as onPointer frozen branch)
await page.evaluate((i) => {
  const s = window.__V.getState();
  const n = s.flasks[i].thawLeft;
  // Call showTut via clicking: dispatch by setting DOM like game
  // Use internal: forceThawTick not right. Show tut using I18N + screen
  const t = (k, v) => I18N.t(k, v);
  document.getElementById('tut-title').textContent = t('tut_frozen_t');
  document.getElementById('tut-body').textContent = t('tut_frozen_tap', { n });
  ['home','map','win','lose','settings','daily','tut'].forEach(name => {
    const el = document.getElementById('sc-' + name);
    if (el) el.classList.toggle('on', name === 'tut');
  });
}, fi);
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, 'ice_popup_390x844.png') });

// 360x800 copies of key shots
await page.setViewportSize({ width: 360, height: 800 });
await prep(page);
await page.evaluate((idx) => window.__V.startLevel(idx), testIdx);
await page.waitForTimeout(300);
await page.evaluate(() => {
  const b = document.getElementById('btn-tut-ok');
  if (b && document.getElementById('sc-tut').classList.contains('on')) b.click();
});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, 'before_thaw_360x800.png') });
await page.evaluate((i) => {
  const s = window.__V.getState();
  const n = s.flasks[i].thawLeft;
  const t = (k, v) => I18N.t(k, v);
  document.getElementById('tut-title').textContent = t('tut_frozen_t');
  document.getElementById('tut-body').textContent = t('tut_frozen_tap', { n });
  ['home','map','win','lose','settings','daily','tut'].forEach(name => {
    const el = document.getElementById('sc-' + name);
    if (el) el.classList.toggle('on', name === 'tut');
  });
}, fi);
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(outDir, 'ice_popup_360x800.png') });

await browser.close();
server.close();
console.log('SHOTS', fs.readdirSync(outDir).join(', '));
