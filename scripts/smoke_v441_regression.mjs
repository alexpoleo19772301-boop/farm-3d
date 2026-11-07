import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v440.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
// Simulate upgrade from mix-pending attempt: unlocked mid mix level
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({
  unlocked:40,coins:777,stars:{0:3,1:2},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,
  seenTut:{basic:1,moves:1,workshop:0},langPref:'ru',_mixAttempt:{pending:true,junk:1}
})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const pass=(n,ok,d)=>{console.log(ok?'PASS':'FAIL',n,d===undefined?'':(typeof d==='string'?d:JSON.stringify(d))); return !!ok;};
let fails=0; const P=(n,ok,d)=>{if(!pass(n,ok,d))fails++;};

P('version', (await page.evaluate(()=>window.__V.VERSION))===pack.version);
const mixLeft=pack.levels.filter(L=>anyMix(L));
function anyMix(L){return (L.mixer||[]).some(Boolean)||(L.mixRecipe||[]).some(r=>r&&r.length)||(L.tags||[]).includes('layer_mix');}
P('no_mixers', mixLeft.length===0, mixLeft.map(L=>L.id).slice(0,5));
const ws=pack.levels.filter(L=>(L.tags||[]).includes('workshop')||(L.workshopOrder&&L.workshopOrder.length));
P('workshop_33', ws.length===33 && ws.every(L=>L.id%3===0));
P('goals_2_early', (pack.levels.find(L=>L.id===3).workshopOrder||[]).length===2);
P('goals_4_late', (pack.levels.find(L=>L.id===99).workshopOrder||[]).length===4);
P('collectors_9', pack.levels.filter(L=>(L.collector||[]).some(Boolean)).map(L=>L.id).join(',')==='13,22,32,43,52,62,73,82,92');
P('cap4_quest', pack.levels.filter(L=>L.id%3===0).every(L=>(L.caps||[]).every(c=>c===4)));
// migration
const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')));
P('migrate_keep_progress', save.unlocked===40 && save.coins===777 && save.stars['0']===3);
P('migrate_clear_mixAttempt', !save._mixAttempt);

const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
await page.evaluate(i=>window.__V.startLevel(i),2); await tut();
await page.waitForTimeout(200);
const st=await page.evaluate(()=>window.__V.getState());
P('L3_order', Array.isArray(st.workshopOrder) && st.workshopOrder.length===2, st.workshopOrder);
P('L3_no_mixer_flasks', st.flasks.every(f=>!f.mixer));
const hud=await page.evaluate(()=>document.getElementById('workshop-hud')?.style.display);
P('hud_on', hud==='flex'||hud==='');
await page.setViewportSize({width:360,height:800});
await page.evaluate(()=>{const t=document.getElementById('toast');if(t){t.style.display='none';t.textContent='';}});
await page.waitForTimeout(300);
await page.screenshot({path:'shots/v441_regression_L3_order_360.png'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'shots/v441_regression_L3_order_390.png'});
await page.setViewportSize({width:412,height:915});
await page.screenshot({path:'shots/v441_regression_L3_order_412.png'});

// partial doesn't count: pour one unit of goal color into empty — not corked
// skip deep; check corked-only via evaluate counts
const have0=await page.evaluate(()=>window.__V.getState().workshopHave);
P('start_have_zero', Object.values(have0||{}).every(v=>!v) || Object.keys(have0||{}).length===0 || Object.values(have0).every(v=>v===0), have0);

async function replay(lid){
  const path=sols[String(lid)].path;
  await page.evaluate(i=>window.__V.startLevel(i), lid-1); await tut();
  await page.evaluate((path)=>{
    for(const step of path){
      window.__V.pour(step[0],step[1]);
      for(let k=0;k<120;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    }
  }, path);
  await page.waitForTimeout(1000);
  return page.evaluate(()=>window.__V.getState().state);
}
for(const lid of [3,48,99]){
  P('win_L'+lid, (await replay(lid))==='win');
}
await page.setViewportSize({width:390,height:844});
await page.evaluate(i=>window.__V.startLevel(i),98); await tut();
await page.evaluate(()=>{const t=document.getElementById('toast');if(t){t.style.display='none';}});
await page.waitForTimeout(300);
await page.screenshot({path:'shots/v441_regression_L99_order4_390.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'shots/v441_regression_L99_order4_360.png'});

await page.evaluate(i=>window.__V.startLevel(i),1); await tut();
P('L2_ordinary', !(await page.evaluate(()=>window.__V.getState().workshopOrder)));

await page.evaluate(i=>window.__V.startLevel(i),91); await tut();
P('collector_92', await page.evaluate(()=>window.__V.getState().flasks.some(f=>f.collector)));

// newgame open no reset
await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vintiki_save_v40'));s.unlocked=40;localStorage.setItem('vintiki_save_v40',JSON.stringify(s));});
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
await page.evaluate(()=>window.__V.requestNewGame());
await page.waitForTimeout(150);
P('newgame_open_no_reset', (await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).unlocked))===40);

console.log('SUMMARY fails', fails);
await browser.close(); server.close();
process.exit(fails?1:0);
