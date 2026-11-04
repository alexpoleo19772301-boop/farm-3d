#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const outDir = 'shots/v38';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(BASE + '?v=3.8.0&t=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__V && window.__V.VERSION === '3.8.0', { timeout: 15000 });
console.log('VERSION', await page.evaluate(() => window.__V.VERSION));

await page.evaluate(() => {
  const k = 'vintiki_save_v32';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.seenTut = { rusty:1, glass:1, chain:1, ice:1, bomb:1 };
  s.unlocked = Math.max(s.unlocked || 1, 40);
  s.coins = 800;
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__V && window.__V.VERSION === '3.8.0');

// 1) Bigger screw heads — early colourful level
await page.evaluate(() => {
  window.__V.startLevel(2);
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const t = document.getElementById('sc-tut');
  if (t && t.classList.contains('on')) document.getElementById('btn-tut-ok')?.click();
});
await page.waitForTimeout(200);
const lay = await page.evaluate(() => {
  const L = window.__V.getLayout();
  const A = window.__V.assertScrewsInside();
  const sc = window.__V.getScrews();
  return { screwR: L.screwR, assert: A, n: sc.length, colors: [...new Set(sc.map(s => s.color))] };
});
console.log('screws', lay);
await page.screenshot({ path: `${outDir}/01-bigger-screws-390x844.png` });

// 2) Chain closeup — L15 (idx 14)
await page.evaluate(() => {
  window.__V.startLevel(14);
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const t = document.getElementById('sc-tut');
  if (t && t.classList.contains('on')) document.getElementById('btn-tut-ok')?.click();
});
await page.waitForTimeout(200);
const chain = await page.evaluate(() => window.__V.getObstacles());
console.log('chain obs', chain.chain);
// zoom-ish: if chain pair exists, pan by temporarily — just full shot is fine; also crop via clip around chain mid
let clip = null;
if (chain.chain && chain.chain.length >= 2) {
  const mid = await page.evaluate(() => {
    const ch = window.__V.getObstacles().chain;
    const all = window.__V.getScrews();
    const a = all.find(s => s.id === ch[0].id);
    const b = all.find(s => s.id === ch[1].id);
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  });
  if (mid) {
    const s = 220;
    clip = {
      x: Math.max(0, Math.round(mid.x - s / 2)),
      y: Math.max(0, Math.round(mid.y - s / 2)),
      width: s,
      height: s
    };
  }
}
await page.screenshot({ path: `${outDir}/02-chain-full-390x844.png` });
if (clip) {
  await page.screenshot({ path: `${outDir}/02-chain-closeup.png`, clip });
  console.log('chain clip', clip);
}

// 3) Boss start
await page.evaluate(() => window.__V.startBoss(0));
await page.waitForFunction(() => window.__V.getBoss() && window.__V.getBoss().total > 0, { timeout: 10000 });
await page.waitForTimeout(300);
console.log('boss start', await page.evaluate(() => window.__V.getBoss()));
await page.screenshot({ path: `${outDir}/03-boss-start-390x844.png` });

// 4) Boss mid-assembly
await page.evaluate(() => window.__V.placeBossN(4));
await page.waitForTimeout(250);
console.log('boss mid', await page.evaluate(() => window.__V.getBoss()));
await page.screenshot({ path: `${outDir}/04-boss-mid-390x844.png` });

// 5) Boss complete
await page.evaluate(() => window.__V.placeBossN(99));
await page.waitForTimeout(500);
console.log('boss done', await page.evaluate(() => window.__V.getBoss()));
await page.screenshot({ path: `${outDir}/05-boss-complete-390x844.png` });

await browser.close();
console.log('done', outDir);
