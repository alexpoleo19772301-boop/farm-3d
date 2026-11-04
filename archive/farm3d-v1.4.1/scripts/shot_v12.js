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
  // landscape-ish phone-wide to verify no letterbox; also portrait
  for (const [w,h,tag] of [[720,1280,''],[1280,720,'-wide']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    page.on('console', m => { if (m.type()==='error') console.log('ERR', m.text().slice(0,180)); });
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.click('#btn-start');
    await page.waitForFunction(() => window.__FARM3D__ && document.getElementById('c3d')?.width > 0, { timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const { state, World3D } = window.__FARM3D__;
      state.coins=9999; state.level=15; state.heart=200;
      state.weather='clear'; state.weatherUntil=Date.now()+9e9;
      state.cycleStart=Date.now();
      const ids=['carrot','wheat','pumpkin','corn','potato','carrot','wheat','pumpkin','tomato','berry','wheat','carrot'];
      (state.plots||[]).forEach((p,i)=>{
        if(p.locked) return;
        if(i<ids.length){ p.cropId=ids[i%ids.length]; p.plantedAt=Date.now()-150000; p.watered=true; p.ready=i%2===0; }
      });
      state.animals=[
        {type:'cow',trait:'добрая',lastProduce:Date.now(),ready:false},
        {type:'sheep',trait:'пушистая',lastProduce:Date.now(),ready:false},
        {type:'chicken',trait:'храбрая',lastProduce:Date.now(),ready:true},
        {type:'pig',trait:'весёлый',lastProduce:Date.now(),ready:false},
      ];
      World3D.refreshPlots(); World3D.refreshAnimals();
    });
    await page.waitForTimeout(9000);
    async function shot(name){
      await page.waitForTimeout(400);
      const f=path.join(OUT, name);
      await page.screenshot({ path:f, type:'png' });
      console.log('wrote', name, fs.statSync(f).size, w+'x'+h);
    }
    if (!tag) {
      await shot('v12-01-overview.png');
      await page.evaluate(()=>{ const c=document.getElementById('c3d'); for(let i=0;i<12;i++) c.dispatchEvent(new WheelEvent('wheel',{deltaY:-140,bubbles:true})); });
      await page.waitForTimeout(700);
      await shot('v12-02-field.png');
      await page.evaluate(()=>{
        const c=document.getElementById('c3d');
        c.dispatchEvent(new PointerEvent('pointerdown',{clientX:400,clientY:640,pointerId:1,bubbles:true,buttons:1}));
        for(let i=0;i<10;i++) c.dispatchEvent(new PointerEvent('pointermove',{clientX:400-i*28,clientY:640+i*6,pointerId:1,bubbles:true,buttons:1}));
        c.dispatchEvent(new PointerEvent('pointerup',{clientX:120,clientY:700,pointerId:1,bubbles:true}));
      });
      await page.waitForTimeout(700);
      await shot('v12-03-orbit.png');
      await page.evaluate(()=>{ const c=document.getElementById('c3d'); for(let i=0;i<26;i++) c.dispatchEvent(new WheelEvent('wheel',{deltaY:160,bubbles:true})); });
      await page.waitForTimeout(800);
      await shot('v12-04-island.png');
      await page.evaluate(()=>{ window.__FARM3D__.state.cycleStart=Date.now()-120000*0.7; });
      await page.waitForTimeout(500);
      await shot('v12-05-night.png');
      await page.evaluate(()=>{
        window.__FARM3D__.state.cycleStart=Date.now();
        const c=document.getElementById('c3d'); for(let i=0;i<18;i++) c.dispatchEvent(new WheelEvent('wheel',{deltaY:-140,bubbles:true}));
      });
      await page.waitForTimeout(800);
      await shot('v12-06-crops-close.png');
    } else {
      await shot('v12-07-wide.png');
    }
    await page.close();
  }
  await browser.close();
})().catch(e=>{ console.error(e); process.exit(1); });
