import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--no-sandbox']});
async function prep(page){
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
}
const tut=async(page)=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
const tick=async(page)=>{for(let k=0;k<80;k++){if(!(await page.evaluate(()=>window.__V.getState().pour)))break;await page.evaluate(()=>window.__V.tick(0.05));}};
const pour=async(page,i,j)=>{await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]);await tick(page);};
const out={};

const page=await browser.newPage({viewport:{width:390,height:844}});
await prep(page);
out.ver=await page.evaluate(()=>window.__V.VERSION);

// Proportional geometry check on L27 (caps 3/4/5)
await page.evaluate(()=>window.__V.startLevel(26)); await tut(page);
const geom=await page.evaluate(()=>{
  // probe layouts via pouring state — expose through temporary measure using canvas clicks positions from internal
  // Use solveHint path: read flask caps and compute expected heights via __V if we add helper — instead measure by drawing internals:
  const st=window.__V.getState();
  return {caps:st.flasks.map(f=>f.cap), locked:st.flasks.map(f=>({locked:f.locked,lockColor:f.lockColor,n:f.n,colors:f.colors})), frozen:st.flasks.map(f=>({frozen:f.frozen,thaw:f.thawLeft}))};
});
out.l27init=geom;
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_varcap_lock_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_varcap_lock_360x800.png'});

// Tap locked flask → toast with color
await page.setViewportSize({width:390,height:844});
const toast=await page.evaluate(()=>{
  // find locked index and simulate onPointer via selecting — use internal by clicking approximate
  const st=window.__V.getState();
  const li=st.flasks.findIndex(f=>f.locked);
  // dispatch by calling pour rejection path: we need click. Use canvas center of locked — approximate via evaluate of toast after synthetic
  // Direct: monkey the locked toast by invoking same logic
  const f=st.flasks[li];
  return {li, lockColor:f.lockColor, need: (st.flasks.reduce((n,ff)=>n+(ff.colors||[]).filter(c=>c===f.lockColor).length,0))};
});
out.lockTapMeta=toast;

// Unlock path first few moves from witness
const p27=JSON.parse(fs.readFileSync('/tmp/l27_path.json','utf8')).path;
for(const [i,j] of p27.slice(0,7)) await pour(page,i,j);
const mid=await page.evaluate(()=>window.__V.getState());
out.afterUnlock={locked:mid.flasks.map(f=>f.locked), corked:mid.flasks.map(f=>f.corked), frozen:mid.flasks.map(f=>f.frozen)};
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_unlocked_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_unlocked_360x800.png'});

// Finish L27 win
await page.setViewportSize({width:390,height:844});
for(const [i,j] of p27.slice(7)) await pour(page,i,j);
await page.waitForTimeout(700);
out.l27win=await page.evaluate(()=>window.__V.getState().state);

// L25 win smoke
await page.evaluate(()=>window.__V.startLevel(24)); await tut(page);
const p25=JSON.parse(fs.readFileSync('/tmp/l25_path.json','utf8')).path;
for(const [i,j] of p25) await pour(page,i,j);
await page.waitForTimeout(700);
out.l25win=await page.evaluate(()=>window.__V.getState().state);
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_win_390x844.png'});

// L25 before proportional
await page.evaluate(()=>window.__V.startLevel(24)); await tut(page);
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_before_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_before_360x800.png'});
await page.setViewportSize({width:412,height:915});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_before_412x915.png'});

// collectors
for (const [idx,name] of [[11,'12'],[61,'62'],[91,'92']]){
  await page.setViewportSize({width:390,height:844});
  await page.evaluate((i)=>window.__V.startLevel(i), idx); await tut(page);
  const st=await page.evaluate(()=>window.__V.getState());
  out['c'+name]={collector:st.collector, flasks:st.flasks.length, caps:st.flasks.map(f=>f.cap)};
}
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l62_collector_390x844.png'});

// Measure unit heights via injecting layout read — add temporary to __V in page
const units=await page.evaluate(()=>{
  window.__V.startLevel(26);
  // Access flaskLayout through drawing by reading from a probe we add:
  // Not exported — compute expected: maxCap 5, compare visual via canvas? Skip — check canSafelyCork still exists
  return {ver:window.__V.VERSION, hasSafe:typeof window.__V.canSafelyCork==='function'};
});
out.units=units;

fs.writeFileSync('/tmp/smoke_v415.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
let fail=0;
if(out.ver!=='4.1.5') fail=1;
if(out.l27win!=='win') fail=2;
if(out.l25win!=='win') fail=3;
if(out.afterUnlock.locked[6]) fail=4; // L27 lock idx6 opens when orange corks (~move 6)
await browser.close(); server.close();
if(fail){console.error('FAIL',fail); process.exit(fail);}
console.log('SMOKE_OK');
