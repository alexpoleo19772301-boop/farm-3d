const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots3d');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' || /GLB fail/i.test(t)) console.log('CONSOLE', m.type(), t.slice(0,200));
  });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__FARM3D__ && document.getElementById('c3d') && document.getElementById('c3d').width > 0, { timeout: 30000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const { state, World3D } = window.__FARM3D__;
    state.coins = 9999; state.level = 15; state.heart = 200;
    state.weather = 'clear'; state.weatherUntil = Date.now() + 9999999;
    state.cycleStart = Date.now(); // day
    const ids = ['carrot','wheat','pumpkin','corn','potato','carrot','wheat','pumpkin','tomato','berry','wheat','carrot'];
    (state.plots || []).forEach((p, i) => {
      if (p.locked) return;
      if (i < ids.length) {
        p.cropId = ids[i % ids.length];
        p.plantedAt = Date.now() - 120000;
        p.watered = true;
        p.ready = i % 3 === 0;
      }
    });
    state.animals = [
      { type: 'cow', trait: 'добрая', lastProduce: Date.now(), ready: false },
      { type: 'sheep', trait: 'пушистая', lastProduce: Date.now(), ready: false },
      { type: 'chicken', trait: 'храбрая', lastProduce: Date.now(), ready: true },
      { type: 'pig', trait: 'весёлый', lastProduce: Date.now(), ready: false },
      { type: 'chicken', trait: 'ленивая', lastProduce: Date.now(), ready: false },
    ];
    World3D.refreshPlots();
    World3D.refreshAnimals();
  });
  // wait GLB + decor
  await page.waitForTimeout(9000);

  async function shot(name) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, name), type: 'png' });
    console.log('wrote', name, fs.statSync(path.join(OUT, name)).size);
  }

  // overview — default camera should already be wide
  await shot('v11-01-overview.png');

  // zoom in field / tractors
  await page.evaluate(() => {
    const canvas = document.getElementById('c3d');
    for (let i = 0; i < 14; i++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -140, bubbles: true }));
  });
  await page.waitForTimeout(800);
  await shot('v11-02-field.png');

  // pan orbit
  await page.evaluate(() => {
    const canvas = document.getElementById('c3d');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, clientY: 640, pointerId: 1, bubbles: true, buttons: 1 }));
    for (let i = 0; i < 8; i++) {
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 400 - i * 30, clientY: 640 + i * 8, pointerId: 1, bubbles: true, buttons: 1 }));
    }
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 704, pointerId: 1, bubbles: true }));
  });
  await page.waitForTimeout(800);
  await shot('v11-03-orbit.png');

  // zoom out island
  await page.evaluate(() => {
    const canvas = document.getElementById('c3d');
    for (let i = 0; i < 28; i++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, bubbles: true }));
  });
  await page.waitForTimeout(900);
  await shot('v11-04-island.png');

  // night
  await page.evaluate(() => { window.__FARM3D__.state.cycleStart = Date.now() - 120000 * 0.7; });
  await page.waitForTimeout(600);
  await shot('v11-05-night.png');

  // day crops close
  await page.evaluate(() => {
    window.__FARM3D__.state.cycleStart = Date.now();
    const canvas = document.getElementById('c3d');
    for (let i = 0; i < 20; i++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -140, bubbles: true }));
  });
  await page.waitForTimeout(900);
  await shot('v11-06-crops-close.png');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
