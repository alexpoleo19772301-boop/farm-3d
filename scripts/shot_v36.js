#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const outDir = 'shots/v36';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(BASE + '?v=3.6.0&t=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__V && window.__V.VERSION === '3.6.0', { timeout: 15000 });
console.log('VERSION', await page.evaluate(() => window.__V.VERSION));
await page.evaluate(() => window.__V.openSettings());
await page.waitForTimeout(200);
await page.screenshot({ path: `${outDir}/settings-390x844.png` });
const tracks = await page.evaluate(() => window.__V.BGM_TRACKS.map(t => ({ id: t.id, name: t.name })));
console.log('tracks', JSON.stringify(tracks, null, 2));
await browser.close();
console.log('wrote', `${outDir}/settings-390x844.png`);
