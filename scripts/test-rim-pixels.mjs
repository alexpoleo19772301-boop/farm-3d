#!/usr/bin/env node
/** Pixel rim test: tray-only rim band must be unchanged after planks draw. */
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
  { name: '412x915', width: 412, height: 915 },
];
const levels = [0, 4, 9, 41];
const outDir = process.env.OUT || 'shots/v332';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const report = [];
let fails = 0;
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  await page.goto(BASE + '?v=rimtest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__V && window.__V.assertRimPixels);
  for (const i of levels) {
    await page.evaluate(i => window.__V.startLevel(i), i);
    await page.waitForTimeout(40);
    const st = await page.evaluate(() => {
      const L = window.__V.getLayout();
      const rim = window.__V.assertRimPixels();
      const inside = window.__V.assertPlanksInsideBoard();
      const rects = window.__V.plankRects();
      let minTrayGap = 1e9;
      for (const p of rects) {
        minTrayGap = Math.min(minTrayGap,
          p.x - L.tray.x, p.y - L.tray.y,
          L.tray.x + L.tray.w - p.x - p.w, L.tray.y + L.tray.h - p.y - p.h);
      }
      return { rimOk: rim.ok, hits: rim.hits.length, inside: inside.ok,
        minTrayGap: +minTrayGap.toFixed(1), need: L.rim + L.boardPad, rim: L.rim };
    });
    await page.screenshot({ path: `${outDir}/${vp.name}-l${i + 1}.png` });
    const ok = st.rimOk && st.inside && st.minTrayGap >= st.need - 0.6;
    if (!ok) fails++;
    report.push({ vp: vp.name, level: i + 1, ok, ...st });
    console.log(vp.name, 'L' + (i + 1), ok ? 'OK' : 'FAIL', st);
  }
  await page.close();
}
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log('FAILS', fails);
process.exit(fails ? 2 : 0);
