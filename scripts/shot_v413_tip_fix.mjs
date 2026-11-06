import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'www');
const outDir = path.join(__dirname, '..', 'shots', 'v413');
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.ogg':'audio/ogg','.jpg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.svg':'image/svg+xml' };
const server = http.createServer((req,res)=>{ let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/')u='/index.html'; const fp=path.join(root,u.slice(1)); if(!fp.startsWith(root)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;} res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({args:['--no-sandbox']});
const evidence = [];

async function prep(page, lang){
  await page.evaluate((lang)=>{
    localStorage.clear();
    localStorage.setItem('vintiki_save_v40', JSON.stringify({
      unlocked:100, coins:500, stars:{}, boosters:{undo:9,flask:5,hint:9},
      musicOn:false, vibrateOn:false,
      seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,frozenTap:1,collector:1},
      pourSfxId:0, langPref: lang
    }));
  }, lang);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V && window.__V.VERSION==='4.1.3');
  // apply language
  await page.evaluate((lang)=>{ if(window.__V.setLanguagePref) window.__V.setLanguagePref(lang); }, lang);
}

async function measureOverlap(page){
  return page.evaluate(()=>{
    const hud = document.getElementById('hud');
    const wrap = document.getElementById('wrap');
    const hudR = hud.getBoundingClientRect();
    const wrapR = wrap.getBoundingClientRect();
    const hudBottom = hudR.bottom - wrapR.top;
    // sample canvas pixels can't easily get tip y; expose via layout
    const tipOn = true;
    return { hudBottom, hudHeight: hudR.height, W: wrapR.width, H: wrapR.height,
      restartVisible: !!document.getElementById('btn-restart')?.offsetParent,
      movesText: document.getElementById('moves-pill')?.textContent };
  });
}

for (const vp of [{w:360,h:800},{w:390,h:844},{w:412,h:915}]) {
  const page = await browser.newPage({viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page, 'ru');
  await page.evaluate(()=>window.__V.startLevel(0));
  await page.waitForTimeout(350);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.waitForTimeout(200);
  const m = await measureOverlap(page);
  evidence.push({vp, lang:'ru', ...m});
  await page.screenshot({path: path.join(outDir, `l1_tip_ru_${vp.w}x${vp.h}.png`)});
  await page.close();
}

// en + uk narrow
for (const lang of ['en','uk']) {
  const page = await browser.newPage({viewport:{width:360,height:800}, deviceScaleFactor:1});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page, lang);
  await page.evaluate(()=>window.__V.startLevel(0));
  await page.waitForTimeout(350);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.waitForTimeout(200);
  evidence.push({vp:{w:360,h:800}, lang, ...(await measureOverlap(page))});
  await page.screenshot({path: path.join(outDir, `l1_tip_${lang}_360x800.png`)});
  await page.close();
}

// collector initial 390
{
  const page = await browser.newPage({viewport:{width:390,height:844}, deviceScaleFactor:1});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page, 'ru');
  await page.evaluate(()=>window.__V.startLevel(11));
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.waitForTimeout(200);
  await page.screenshot({path: path.join(outDir, 'collector_initial_390x844.png')});
  await page.close();
}

// regressions: restart, collector win, thaw restart
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page, 'ru');
  // restart
  await page.evaluate(()=>window.__V.startLevel(0));
  await page.waitForTimeout(150);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.evaluate(()=>{ const mv=window.__V.solveHint(); if(mv){window.__V.pour(mv.from,mv.to);window.__V.tick(1);} });
  await page.click('#btn-restart'); await page.waitForTimeout(100); await page.click('#btn-confirm-yes'); await page.waitForTimeout(250);
  const r1 = await page.evaluate(()=>window.__V.getState().moves);
  // collector L12 win
  await page.evaluate(()=>window.__V.startLevel(11));
  await page.waitForTimeout(150);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.evaluate(async()=>{
    let s=0; while(s++<80 && window.__V.getState().state==='play'){ const mv=window.__V.solveHint(); if(!mv) break; window.__V.pour(mv.from,mv.to); window.__V.tick(1);} 
    await new Promise(r=>setTimeout(r,600));
  });
  const r2 = await page.evaluate(()=>window.__V.getState().state);
  // wrong color
  await page.evaluate(()=>window.__V.startLevel(21));
  await page.waitForTimeout(150);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  const wrong = await page.evaluate(()=>{
    const s=window.__V.getState(); const ci=s.flasks.findIndex(f=>f.collector); const want=s.collectorColor;
    let from=-1; for(let i=0;i<s.flasks.length;i++){ if(i!==ci && s.flasks[i].top && s.flasks[i].top!==want){ from=i; break; } }
    if(from<0) return {skip:true}; const before=s.moves; const ok=window.__V.pour(from,ci); window.__V.tick(0.1);
    return {before, after: window.__V.getState().moves, ok:!!ok};
  });
  // thaw restart
  await page.evaluate(()=>window.__V.startLevel(22));
  await page.waitForTimeout(150);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  const fi = await page.evaluate(()=>window.__V.getState().flasks.findIndex(f=>f.frozen));
  await page.evaluate(async(fi)=>{ let s=0; while(s++<80 && window.__V.getState().flasks[fi]?.frozen){ const mv=window.__V.solveHint(); if(!mv) break; window.__V.pour(mv.from,mv.to); window.__V.tick(1);} }, fi);
  await page.click('#btn-restart'); await page.waitForTimeout(100); await page.click('#btn-confirm-yes'); await page.waitForTimeout(250);
  const thaw = await page.evaluate(()=>{ const f=window.__V.getState().flasks.find(x=>x.frozen); return {frozen:!!f, thawLeft:f?.thawLeft}; });
  evidence.push({regressions:{restartMoves:r1, collectorWin:r2, wrong, thaw}});
  await page.close();
}

await browser.close(); server.close();
fs.writeFileSync(path.join(outDir,'evidence.json'), JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
console.log('SHOTS', fs.readdirSync(outDir).join(', '));
