#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const outDir = 'shots/v35';
fs.mkdirSync(outDir, { recursive: true });
const levels = [0, 4, 11, 41]; // L1,5,12,42
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(BASE + '?v=3.5.0&t=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__V && window.__V.VERSION);
const ver = await page.evaluate(() => window.__V.VERSION);
console.log('VERSION', ver);
const report = [];
for (const i of levels) {
  await page.evaluate(i => window.__V.startLevel(i), i);
  await page.waitForTimeout(60);
  const st = await page.evaluate(() => {
    const geom = window.__V.assertNoOverlapRuntime();
    const inside = window.__V.assertPlanksInsideBoard();
    const screws = window.__V.assertScrewsInside();
    const rim = window.__V.assertRimPixels();
    const edges = window.__V.getEdges();
    const L = window.__V.getLayout();
    let shared = 0, flatOuter = 0, tabs = 0, blanks = 0;
    for (const e of edges) {
      for (const side of ['t','r','b','l']) {
        const arr = Array.isArray(e.edges[side]) ? e.edges[side] : [e.edges[side]];
        for (const k of arr) {
          if (k > 0) tabs++;
          else if (k < 0) blanks++;
          else flatOuter++;
        }
      }
    }
    // complementarity rough: tabs≈blanks
    return {
      ver: window.__V.VERSION,
      geom, inside, screws: { ok: screws.ok, bad: screws.bad.length },
      rim: { ok: rim.ok, hits: rim.hits.length },
      edges: edges.map(e => ({ id: e.id, edges: e.edges, w: +e.w.toFixed(1), h: +e.h.toFixed(1), tabR: e.tabR })),
      counts: { tabs, blanks, flat: flatOuter, planks: edges.length },
      board: L.board, tray: L.tray
    };
  });
  const path = `${outDir}/390x844-l${i + 1}.png`;
  await page.screenshot({ path });
  const ok = st.geom.ok && st.inside.ok && st.screws.ok && st.rim.ok && st.counts.tabs === st.counts.blanks && st.counts.tabs > 0;
  report.push({ level: i + 1, ok, tabs: st.counts.tabs, blanks: st.counts.blanks, flat: st.counts.flat, geom: st.geom.ok, inside: st.inside.ok, screws: st.screws, rim: st.rim.ok, edges: st.edges });
  console.log('L' + (i + 1), ok ? 'OK' : 'FAIL', 'tabs', st.counts.tabs, 'blanks', st.counts.blanks, 'flat', st.counts.flat, 'geom', st.geom, 'screws', st.screws, 'rim', st.rim.ok);
}
// break filmstrip on L5
await page.evaluate(() => window.__V.startLevel(4));
await page.waitForTimeout(40);
await page.screenshot({ path: `${outDir}/break-f0.png` });
await page.evaluate(() => window.__V.forceFallPlank());
await page.waitForTimeout(30);
await page.screenshot({ path: `${outDir}/break-f1.png` });
// advance shatter via wall clock + rAF
for (const [name, ms] of [['break-f2.png', 200], ['break-f3.png', 700]]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${outDir}/${name}` });
}
// filmstrip
await page.evaluate(async () => {});
const { createCanvas, loadImage } = await import('canvas').catch(() => ({ createCanvas: null, loadImage: null }));
if (loadImage) {
  const imgs = [];
  for (const f of ['break-f0.png','break-f1.png','break-f2.png','break-f3.png']) imgs.push(await loadImage(`${outDir}/${f}`));
  const w = imgs[0].width, h = imgs[0].height;
  const c = createCanvas(w * 4, h);
  const cx = c.getContext('2d');
  imgs.forEach((im, i) => cx.drawImage(im, i * w, 0));
  fs.writeFileSync(`${outDir}/break-filmstrip.png`, c.toBuffer('image/png'));
} else {
  // fallback: sharp or just copy note
  const { execSync } = await import('child_process');
  try {
    execSync(`convert ${outDir}/break-f0.png ${outDir}/break-f1.png ${outDir}/break-f2.png ${outDir}/break-f3.png +append ${outDir}/break-filmstrip.png`, { stdio: 'inherit' });
  } catch (e) {
    console.log('no filmstrip tool', e.message);
  }
}
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
const fails = report.filter(r => !r.ok).length;
console.log('FAILS', fails, 'VERSION', ver);
await browser.close();
process.exit(fails ? 2 : 0);
