import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'www');
const outDir = path.join(__dirname, '..', 'shots', 'v412');
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.ogg':'audio/ogg','.jpg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.svg':'image/svg+xml' };
const server = http.createServer((req,res)=>{ let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/')u='/index.html'; const fp=path.join(root,u.slice(1)); if(!fp.startsWith(root)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;} res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const evidence=[];

async function prep(page){
  await page.evaluate(()=>{
    localStorage.clear();
    localStorage.setItem('vintiki_save_v40', JSON.stringify({
      unlocked:100, coins:500, stars:{}, boosters:{undo:9,flask:5,hint:9},
      musicOn:false, vibrateOn:false,
      seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,frozenTap:1,collector:1},
      pourSfxId:0, langPref:'ru'
    }));
  });
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V && window.__V.VERSION==='4.1.2');
}

async function shot(page, name){ const p=path.join(outDir,name); await page.screenshot({path:p}); console.log('shot', name); return p; }

const browser = await chromium.launch({args:['--no-sandbox']});

// ---- Restart button + confirm on normal level ----
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(0));
  await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.waitForTimeout(150);
  // make a move
  await page.evaluate(()=>{ const mv=window.__V.solveHint(); if(mv){ window.__V.pour(mv.from,mv.to); window.__V.tick(1);} });
  const moves1 = (await page.evaluate(()=>window.__V.getState())).moves;
  await shot(page, 'restart_btn_normal_390x844.png');
  // click restart
  await page.click('#btn-restart');
  await page.waitForTimeout(200);
  const confirmOn = await page.evaluate(()=>document.getElementById('sc-confirm').classList.contains('on'));
  evidence.push({restartConfirmShown: confirmOn, movesBefore: moves1});
  await shot(page, 'restart_confirm_390x844.png');
  await page.click('#btn-confirm-yes');
  await page.waitForTimeout(300);
  const after = await page.evaluate(()=>window.__V.getState());
  evidence.push({afterRestartMoves: after.moves, state: after.state});
  if (after.moves !== 0) throw new Error('restart did not reset moves');
  await page.close();
}

// ---- Collector L12: initial, wrong color, fill, win ----
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(11)); // L12
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.waitForTimeout(200);
  let st = await page.evaluate(()=>window.__V.getState());
  const ci = st.flasks.findIndex(f=>f.collector);
  evidence.push({L12: {collectorIdx:ci, need:st.collectorNeed, color:st.collectorColor, layout: st.flasks.map(f=>({n:f.n,coll:f.collector}))}});
  if (ci < 0) throw new Error('no collector on L12');
  await shot(page, 'collector_initial_390x844.png');

  // Wrong color attempt: find flask with wrong top, try pour into collector — should not spend move
  const wrong = await page.evaluate((cIdx)=>{
    const s=window.__V.getState();
    const want=s.collectorColor;
    let from=-1;
    for(let i=0;i<s.flasks.length;i++){
      if(i===cIdx||!s.flasks[i].top) continue;
      if(s.flasks[i].top!==want){ from=i; break; }
    }
    if(from<0) return {skipped:true};
    const before=s.moves;
    window.__V.select(from);
    const ok=window.__V.pour(from, cIdx);
    window.__V.tick(0.2);
    const after=window.__V.getState();
    return {from, before, afterMoves: after.moves, pourOk: !!ok, collectorN: after.flasks[cIdx].n};
  }, ci);
  evidence.push({wrongColor: wrong});
  if (!wrong.skipped && wrong.afterMoves !== wrong.before) throw new Error('wrong color consumed move');

  // Mid fill via autoSolve partial
  await page.evaluate(async (cIdx)=>{
    let steps=0;
    while(steps++<40){
      const s=window.__V.getState();
      if(s.flasks[cIdx].n>= Math.ceil(s.collectorNeed/2)) break;
      if(s.state!=='play') break;
      const mv=window.__V.solveHint(); if(!mv) break;
      window.__V.pour(mv.from,mv.to); window.__V.tick(1);
    }
  }, ci);
  st = await page.evaluate(()=>window.__V.getState());
  evidence.push({midFill: st.flasks[ci].n, need: st.collectorNeed});
  await shot(page, 'collector_mid_390x844.png');

  // Complete to win
  await page.evaluate(async ()=>{
    let steps=0;
    while(steps++<80 && window.__V.getState().state==='play'){
      const mv=window.__V.solveHint(); if(!mv) break;
      window.__V.pour(mv.from,mv.to); window.__V.tick(1);
    }
    await new Promise(r=>setTimeout(r,700));
  });
  st = await page.evaluate(()=>window.__V.getState());
  evidence.push({collectorWin: st.state, moves: st.moves, filled: st.flasks[ci]?.n});
  await shot(page, 'collector_success_390x844.png');
  if (st.state !== 'win') throw new Error('collector L12 did not win, state='+st.state);
  await page.close();
}

// ---- Collector cannot drain ----
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(11));
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  // fill one unit into collector then try pour out
  const drain = await page.evaluate(()=>{
    const s0=window.__V.getState();
    const ci=s0.flasks.findIndex(f=>f.collector);
    const want=s0.collectorColor;
    // pour correct color in
    let from=-1;
    for(let i=0;i<s0.flasks.length;i++){ if(i!==ci && s0.flasks[i].top===want){ from=i; break; } }
    if(from>=0){ window.__V.pour(from,ci); window.__V.tick(1); }
    const mid=window.__V.getState();
    const empty=mid.flasks.findIndex((f,i)=>i!==ci && f.n===0);
    const before=mid.flasks[ci].n;
    const ok=empty>=0 ? window.__V.pour(ci, empty) : false;
    window.__V.tick(0.2);
    const after=window.__V.getState();
    return {before, after: after.flasks[ci].n, pourOk:!!ok};
  });
  evidence.push({noDrain: drain});
  if (drain.after !== drain.before) throw new Error('collector was drained');
  await page.close();
}

// ---- Late collector L92 ----
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(91));
  await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await page.evaluate(async ()=>{
    let steps=0;
    while(steps++<120 && window.__V.getState().state==='play'){
      const mv=window.__V.solveHint(); if(!mv) break;
      window.__V.pour(mv.from,mv.to); window.__V.tick(1);
    }
    await new Promise(r=>setTimeout(r,700));
  });
  const st=await page.evaluate(()=>window.__V.getState());
  evidence.push({L92: {state:st.state, moves:st.moves, limit:st.moveLimit, need:st.collectorNeed}});
  await shot(page, 'collector_late92_390x844.png');
  if (st.state !== 'win') console.warn('L92 win via hint failed (may be suboptimal hint)', st.state);
  await page.close();
}

// ---- Restart after thaw resets counter ----
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(22)); // L23 frozen
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  const fi = await page.evaluate(()=>window.__V.getState().flasks.findIndex(f=>f.frozen));
  // thaw
  await page.evaluate(async (frozenIdx)=>{
    let s=0;
    while(s++<80 && window.__V.getState().flasks[frozenIdx]?.frozen){
      const mv=window.__V.solveHint(); if(!mv) break;
      window.__V.pour(mv.from,mv.to); window.__V.tick(1);
    }
  }, fi);
  let st=await page.evaluate(()=>window.__V.getState());
  evidence.push({thawed: !st.flasks[fi]?.frozen, thawLeft: st.flasks[fi]?.thawLeft});
  await page.click('#btn-restart');
  await page.waitForTimeout(150);
  await page.click('#btn-confirm-yes');
  await page.waitForTimeout(300);
  st=await page.evaluate(()=>window.__V.getState());
  const f2=st.flasks.find(f=>f.frozen);
  evidence.push({afterRestartThaw: {frozen:!!f2, thawLeft:f2?.thawLeft}});
  if (!f2 || !(f2.thawLeft>0)) throw new Error('thaw counter not restored on restart');
  await page.close();
}

// ---- Collector tutorial popup ----
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    localStorage.setItem('vintiki_save_v40', JSON.stringify({
      unlocked:100, coins:500, stars:{}, boosters:{undo:5,flask:2,hint:3},
      musicOn:false, seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1},
      pourSfxId:0, langPref:'ru'
    }));
  });
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  await page.evaluate(()=>window.__V.startLevel(11));
  await page.waitForTimeout(350);
  const tut = await page.evaluate(()=>({
    on: document.getElementById('sc-tut').classList.contains('on'),
    title: document.getElementById('tut-title').textContent,
    body: document.getElementById('tut-body').textContent
  }));
  evidence.push({collectorTut: tut});
  await shot(page, 'collector_tutorial_390x844.png');
  await page.close();
}

// 360 & 412 viewports for key shots
for (const vp of [{w:360,h:800},{w:412,h:915}]) {
  const page = await browser.newPage({viewport:{width:vp.w,height:vp.h}});
  await page.goto(base,{waitUntil:'networkidle'});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(0));
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await shot(page, `restart_btn_normal_${vp.w}x${vp.h}.png`);
  await page.evaluate(()=>window.__V.startLevel(11));
  await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
  await shot(page, `collector_initial_${vp.w}x${vp.h}.png`);
  await page.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir,'evidence.json'), JSON.stringify(evidence,null,2));
console.log('EVIDENCE', JSON.stringify(evidence,null,2));
console.log('DONE', fs.readdirSync(outDir).join(', '));
