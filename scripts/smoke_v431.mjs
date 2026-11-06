import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extension?path.extname(fp):path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v430.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({
  unlocked:100,coins:500,stars:{},boosters:{undo:20,flask:5,hint:9},musicOn:false,sfxOn:false,
  seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,filter:1,timer:1,mixing:1,layer_mix:1,collector:1},
  langPref:'ru'
})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const pass=(n,ok,d)=>console.log(ok?'PASS':'FAIL',n, typeof d==='string'?d:JSON.stringify(d));
const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
pass('version', (await page.evaluate(()=>window.__V.VERSION))==='4.3.1');
pass('collector_92', !!(pack.levels.find(L=>L.id===92).collector||[]).some(Boolean));
pass('collectors_9', pack.levels.filter(L=>(L.collector||[]).some(Boolean)).map(L=>L.id).join(',')==='13,22,32,43,52,62,73,82,92');

await page.evaluate(i=>window.__V.startLevel(i),2); await tut();
// dismiss any toast by waiting
await page.waitForTimeout(200);
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'shots/v431_L3_2mix_390.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'shots/v431_L3_2mix_360.png'});

// pending
const probe=await page.evaluate(()=>{
  const st=window.__V.getState();
  const mi=st.flasks.findIndex(f=>f.mixer&&f.mixRecipe);
  const want=st.flasks[mi].mixRecipe[0];
  const ING={green:['yellow','blue'],orange:['red','yellow'],purple:['red','blue']};
  const [a,b]=ING[want];
  let wrong=-1,src=-1;
  for(let i=0;i<st.flasks.length;i++){
    if(st.flasks[i].mixer) continue;
    const top=st.flasks[i].top;
    if(top&&top!==a&&top!==b&&wrong<0) wrong=i;
    if(top===a&&src<0) src=i;
  }
  if(src<0){ for(let i=0;i<st.flasks.length;i++){ if(!st.flasks[i].mixer&&st.flasks[i].top===b){src=i;break;} } }
  const m0=st.moves; if(wrong>=0) window.__V.pour(wrong,mi);
  const rejectOk=window.__V.getState().moves===m0;
  window.__V.pour(src,mi);
  return {mi,src,rejectOk};
});
for(let i=0;i<40;i++){ const p=await page.evaluate(()=>{window.__V.tick(0.08);return window.__V.getState().pour;}); if(!p) break; }
pass('reject0', probe.rejectOk);
pass('pending', !!(await page.evaluate(mi=>window.__V.getState().flasks[mi].pending, probe.mi)));
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'shots/v431_L3_pending_390.png'});
// undo
await page.evaluate(()=>document.getElementById('b-undo')?.click());
await page.waitForTimeout(80);
pass('undo_pending', !(await page.evaluate(mi=>window.__V.getState().flasks[mi].pending, probe.mi)));
// re-pending + product
await page.evaluate(({src,mi})=>{window.__V.pour(src,mi);}, probe);
for(let i=0;i<40;i++){ const p=await page.evaluate(()=>{window.__V.tick(0.08);return window.__V.getState().pour;}); if(!p) break; }
await page.evaluate(async ()=>{
  const st=window.__V.getState();
  const mi=st.flasks.findIndex(f=>f.mixer&&f.mixRecipe);
  const pend=st.flasks[mi].pending;
  const want=st.flasks[mi].mixRecipe[0];
  const ING={green:['yellow','blue'],orange:['red','yellow'],purple:['red','blue']};
  const [a,b]=ING[want];
  const need=pend===a?b:a;
  for(let i=0;i<st.flasks.length;i++){
    if(st.flasks[i].mixer) continue;
    if(st.flasks[i].top===need){ window.__V.pour(i,mi); break; }
  }
});
for(let i=0;i<40;i++){ const p=await page.evaluate(()=>{window.__V.tick(0.08);return window.__V.getState().pour;}); if(!p) break; }
await page.screenshot({path:'shots/v431_L3_after_product_390.png'});
pass('after_product_layer', (await page.evaluate(mi=>window.__V.getState().flasks[mi].colors.length, probe.mi))===1);

await page.evaluate(()=>window.__V.doRestart());
await page.waitForTimeout(80);
pass('restart0', (await page.evaluate(()=>window.__V.getState().moves))===0);

// popup
await page.evaluate(i=>window.__V.startLevel(i),2); await tut();
await page.evaluate(()=>{
  const mi=window.__V.getState().flasks.findIndex(f=>f.mixer&&f.mixRecipe);
  // simulate tap mixer
  const f=window.__V.getState().flasks[mi];
  // call via selecting - use internal by evaluating pour path: click through __V if exposed
});
// use canvas tap on mixer center via evaluate start of show — call by clicking flask through layout approx
await page.evaluate(()=>{
  // Direct: find mixer and open popup like onPointer
  const st=window.__V.getState();
  const mi=st.flasks.findIndex(f=>f.mixer&&f.mixRecipe);
  // monkey: dispatch by reusing request — open settings no; use startLevel already; call show via selecting empty mixer tap
  // Expose nothing — click canvas center-bottom
});
const box=await page.evaluate(()=>{
  const c=document.getElementById('game');
  const r=c.getBoundingClientRect();
  return {x:r.left+r.width*0.35, y:r.top+r.height*0.78, w:r.width,h:r.height};
});
await page.mouse.click(box.x, box.y);
await page.waitForTimeout(200);
let popupOn=await page.evaluate(()=>document.getElementById('sc-tut')?.classList.contains('on'));
if(!popupOn){
  // try other mixer position
  await page.mouse.click(box.x + box.w*0.3, box.y);
  await page.waitForTimeout(200);
  popupOn=await page.evaluate(()=>document.getElementById('sc-tut')?.classList.contains('on'));
}
pass('popup_on', popupOn);
await page.screenshot({path:'shots/v431_L3_recipe_popup_ru.png'});
const body=await page.evaluate(()=>document.getElementById('tut-body')?.textContent||'');
pass('popup_has_layers', body.includes('слой') || body.includes('Слой') || body.includes('Текущий') || /1\/4|1 из 4/.test(body), body.slice(0,80));
await page.evaluate(()=>document.getElementById('btn-tut-ok')?.click());

// 3-mix 390, 4-mix 360
await page.setViewportSize({width:390,height:844});
await page.evaluate(i=>window.__V.startLevel(i),47); await tut();
await page.waitForTimeout(200);
await page.screenshot({path:'shots/v431_L48_3mix_390.png'});
await page.setViewportSize({width:360,height:800});
await page.evaluate(i=>window.__V.startLevel(i),98); await tut();
await page.waitForTimeout(200);
await page.screenshot({path:'shots/v431_L99_4mix_360.png'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'shots/v431_L99_4mix_390.png'});

async function replay(lid){
  const path=sols[String(lid)].path;
  await page.evaluate(i=>window.__V.startLevel(i), lid-1); await tut();
  await page.evaluate((path)=>{
    for(const step of path){
      window.__V.pour(step[0],step[1]);
      for(let k=0;k<100;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    }
  }, path);
  await page.waitForTimeout(900);
  return page.evaluate(()=>window.__V.getState().state);
}
for(const lid of [3,48,99]) pass('win_L'+lid, (await replay(lid))==='win');

await page.evaluate(i=>window.__V.startLevel(i),91); await tut();
pass('collector_L92_runtime', await page.evaluate(()=>window.__V.getState().flasks.some(f=>f.collector)));

await browser.close(); server.close();
