#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const outDir = 'shots/v37';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(BASE + '?v=3.7.0&t=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__V && window.__V.VERSION === '3.7.0');
console.log('VERSION', await page.evaluate(() => window.__V.VERSION));

// reset save-ish for clean daily popup
await page.evaluate(() => {
  const k = 'vintiki_save_v32';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.daily = { lastClaim: null, streak: 2, lastQuestDay: null, quests: [] };
  s.seenTut = {};
  s.stars = Object.assign({ 0: 3, 1: 2, 2: 1, 4: 3, 7: 2 }, s.stars || {});
  s.unlocked = Math.max(s.unlocked || 1, 30);
  s.coins = 500;
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__V && window.__V.VERSION === '3.7.0');
await page.waitForTimeout(900); // daily auto-open
// force open daily if not
await page.evaluate(() => { if (!document.getElementById('sc-daily').classList.contains('on')) window.__V.openDaily(); });
await page.waitForTimeout(200);
await page.screenshot({ path: `${outDir}/daily-reward-390x844.png` });

// quests are on same screen — scroll/clip already shows them; also dedicated name
await page.screenshot({ path: `${outDir}/quests-390x844.png` });

// win with stars
await page.evaluate(() => {
  window.__V.startLevel(0);
});
await page.waitForTimeout(100);
await page.evaluate(() => window.__V.autoSolve(40));
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/win-stars-390x844.png` });

// map with stars
await page.evaluate(() => { window.__V.openDaily && null; });
await page.click('#btn-win-map').catch(() => {});
await page.evaluate(() => {
  // build map via home
  const btn = document.getElementById('btn-home-map');
  if (document.getElementById('sc-map') && !document.getElementById('sc-map').classList.contains('on')) {
    // from win
  }
});
await page.evaluate(() => {
  // force map
  const ev = document.getElementById('btn-win-map') || document.getElementById('btn-home-map');
});
await page.evaluate(() => {
  // direct
  const g = document.getElementById('mapgrid');
  if (!document.getElementById('sc-map').classList.contains('on')) {
    // call internal via startLevel then map button simulation
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    document.getElementById('sc-map').classList.add('on');
    document.getElementById('hud').style.display = 'none';
  }
  // rebuild
  window.__V.startLevel(0);
});
// Better: expose buildMap — call via clicking home map after going home
await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('sc-home').classList.add('on');
});
await page.click('#btn-home-map');
await page.waitForTimeout(200);
await page.screenshot({ path: `${outDir}/map-stars-390x844.png` });

// obstacles: clear seenTut so tut may show; screenshot gameplay
async function shotObstacle(levelIdx, name) {
  await page.evaluate((i) => {
    const k = 'vintiki_save_v32';
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.seenTut = { rusty:1, glass:1, chain:1, ice:1, bomb:1 }; // skip tut overlay for clear view
    localStorage.setItem(k, JSON.stringify(s));
    window.__V.startLevel(i);
  }, levelIdx);
  await page.waitForTimeout(250);
  // dismiss tut if any
  await page.evaluate(() => {
    const t = document.getElementById('sc-tut');
    if (t && t.classList.contains('on')) {
      const b = document.getElementById('btn-tut-ok'); if (b) b.click();
    }
  });
  await page.waitForTimeout(150);
  const info = await page.evaluate(() => {
    const st = window.__V.getState();
    // count obstacle flags via screws/planks introspection
    return st;
  });
  await page.screenshot({ path: `${outDir}/obstacle-${name}-390x844.png` });
  console.log('obstacle', name, 'L'+(levelIdx+1), info);
}

await shotObstacle(7, 'rusty');   // L8
await shotObstacle(9, 'glass');   // L10
await shotObstacle(14, 'chain');  // L15
await shotObstacle(19, 'ice');    // L20
await shotObstacle(27, 'bomb');   // L28

// also tutorial popup shot
await page.evaluate(() => {
  const k = 'vintiki_save_v32';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.seenTut = {};
  localStorage.setItem(k, JSON.stringify(s));
  // reopen game context - call showObstacleTut via starting L8 without seen
  location.reload();
});
await page.waitForFunction(() => window.__V);
await page.evaluate(() => {
  const k = 'vintiki_save_v32';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.seenTut = {}; s.unlocked = 30;
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__V);
await page.evaluate(() => window.__V.startLevel(7));
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/tut-rusty-390x844.png` });

console.log('done', fs.readdirSync(outDir));
await browser.close();
