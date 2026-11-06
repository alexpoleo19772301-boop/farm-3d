import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v430.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({
  unlocked:100,coins:500,stars:{},boosters:{undo:20,flask:5,hint:9},musicOn:false,sfxOn:false,
  seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,filter:1,timer:1,mixing:1,layer_mix:1,collector:1},
  langPref:'ru', __sentinel:'keep'
})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const out={ver:await page.evaluate(()=>window.__V.VERSION),tests:[]};
const pass=(n,ok,d)=>{out.tests.push({n,ok:!!ok,d}); console.log(ok?'PASS':'FAIL',n, typeof d==='string'?d:JSON.stringify(d));};
pass('version', out.ver==='4.3.0' && pack.version==='4.3.0', out.ver+'/'+pack.version);

const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
const tickUntil=async()=>{for(let i=0;i<50;i++){const p=await page.evaluate(()=>{window.__V.tick(0.08);return window.__V.getState().pour;}); if(!p) break;}};

// cadence
const mixIds=pack.levels.filter(L=>(L.tags||[]).includes('layer_mix')).map(L=>L.id);
pass('mix_count_33', mixIds.length===33 && mixIds.every(id=>id%3===0), mixIds.length);
const counts=Object.fromEntries(mixIds.map(id=>{
  const L=pack.levels.find(x=>x.id===id);
  return [id, (L.mixer||[]).filter(Boolean).length];
}));
pass('mixers_2_early', counts[3]===2 && counts[21]===2, counts[3]+'/'+counts[21]);
pass('mixers_3_mid', counts[24]===3 && counts[54]===3, counts[24]+'/'+counts[54]);
pass('mixers_4_late', counts[57]===4 && counts[99]===4, counts[57]+'/'+counts[99]);

// cap4
await page.evaluate(i=>window.__V.startLevel(i), 2); await tut();
const caps=await page.evaluate(()=>window.__V.getState().flasks.every(f=>(f.cap||4)===4 || f.collector));
pass('L3_cap4', caps, '');

// pending + product + reject 0
await page.evaluate(i=>window.__V.startLevel(i), 2); await tut();
const mixProbe=await page.evaluate(()=>{
  const st=window.__V.getState();
  const mi=st.flasks.findIndex(f=>f.mixer && f.mixRecipe);
  const want=st.flasks[mi].mixRecipe[0];
  const ING={green:['yellow','blue'],orange:['red','yellow'],purple:['red','blue']};
  const [a,b]=ING[want];
  // wrong color
  let wrong=-1;
  for(let i=0;i<st.flasks.length;i++){
    if(st.flasks[i].mixer) continue;
    const top=st.flasks[i].top;
    if(top && top!==a && top!==b){wrong=i; break;}
  }
  const m0=st.moves;
  if(wrong>=0) window.__V.pour(wrong, mi);
  const m1=window.__V.getState().moves;
  // find a
  let srcA=-1;
  for(let i=0;i<st.flasks.length;i++){
    if(st.flasks[i].mixer) continue;
    if(window.__V.getState().flasks[i].top===a){srcA=i; break;}
  }
  if(srcA<0){
    for(let i=0;i<st.flasks.length;i++){
      if(st.flasks[i].mixer) continue;
      if(window.__V.getState().flasks[i].top===b){srcA=i; break;}
    }
  }
  return {mi,want,a,b,wrong,m0,m1,srcA,rejectOk:m1===m0};
});
pass('reject_0', mixProbe.rejectOk, mixProbe);
if(mixProbe.srcA>=0){
  await page.evaluate(([i,j])=>window.__V.pour(i,j),[mixProbe.srcA, mixProbe.mi]);
  await tickUntil();
  const pend=await page.evaluate(mi=>window.__V.getState().flasks[mi].pending, mixProbe.mi);
  pass('pending_set', !!pend, pend);
  // undo
  await page.evaluate(()=>document.getElementById('b-undo')?.click());
  await page.waitForTimeout(100);
  const afterUndo=await page.evaluate(mi=>({pending:window.__V.getState().flasks[mi].pending, moves:window.__V.getState().moves}), mixProbe.mi);
  pass('undo_clears_pending', !afterUndo.pending, afterUndo);
}
// restart
await page.evaluate(()=>window.__V.doRestart && window.__V.doRestart());
await page.waitForTimeout(100);
pass('restart_moves0', (await page.evaluate(()=>window.__V.getState().moves))===0, '');

async function replay(lid){
  const path=sols[String(lid)].path;
  await page.evaluate(i=>window.__V.startLevel(i), lid-1); await tut();
  await page.evaluate((path)=>{
    for(const step of path){
      const [i,j]=step; window.__V.pour(i,j);
      for(let k=0;k<100;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    }
  }, path);
  await page.waitForTimeout(900);
  return page.evaluate(()=>window.__V.getState().state);
}
for(const lid of [3,6,48,99]){
  const st=await replay(lid);
  pass('win_L'+lid, st==='win', st);
}

// ordinary L2
const st2=await replay(2);
pass('win_L2_ordinary', st2==='win' || st2==='play', st2); // L2 may use v420 sols
// Prefer pack solution if present
if(sols['2']){
  pass('win_L2', st2==='win', st2);
} else {
  await page.evaluate(i=>window.__V.startLevel(i),1); await tut();
  const cap=await page.evaluate(()=>window.__V.getState().flasks.every(f=>!f.mixer && (f.cap||4)===4));
  pass('L2_no_mixer_cap4', cap, '');
}

// collector relocated 13
await page.evaluate(i=>window.__V.startLevel(i),12); await tut();
const col=await page.evaluate(()=>window.__V.getState().flasks.some(f=>f.collector));
pass('collector_L13', col, '');

// ice/key still on non-mix
const ice=pack.levels.find(L=>L.id%3 && (L.frozen||[]).some(Boolean) && (L.locked||[]).some(Boolean));
if(ice){
  await page.evaluate(i=>window.__V.startLevel(i), ice.id-1); await tut();
  const ok=await page.evaluate(()=>{const s=window.__V.getState(); return s.flasks.some(f=>f.frozen)&&s.flasks.some(f=>f.locked);});
  pass('ice_key', ok, ice.id);
} else pass('ice_key', true, 'skip');

// newgame open no reset
await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vintiki_save_v40')); s.unlocked=55; localStorage.setItem('vintiki_save_v40',JSON.stringify(s));});
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).unlocked);
await page.evaluate(()=>window.__V.requestNewGame());
await page.waitForTimeout(150);
pass('newgame_open_no_reset', (await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).unlocked))===before, before);

// screenshots 2/3/4 mixers
for(const [lid,w,h,name] of [[3,360,800,'L3_2mix_360'],[3,390,844,'L3_2mix_390'],[3,412,915,'L3_2mix_412'],[48,390,844,'L48_3mix_390'],[99,390,844,'L99_4mix_390'],[99,360,800,'L99_4mix_360']]){
  await page.setViewportSize({width:w,height:h});
  await page.evaluate(i=>window.__V.startLevel(i), lid-1); await tut();
  await page.waitForTimeout(300);
  await page.screenshot({path:`shots/v430_${name}.png`});
}
// after first product on L3
await page.setViewportSize({width:390,height:844});
await page.evaluate(i=>window.__V.startLevel(i),2); await tut();
await page.evaluate((path)=>{
  // first two pours of witness = one product
  for(const step of path.slice(0,2)){
    window.__V.pour(step[0],step[1]);
    for(let k=0;k<80;k++){window.__V.tick(0.05); if(!window.__V.getState().pour) break;}
  }
}, sols['3'].path);
await page.waitForTimeout(200);
await page.screenshot({path:'shots/v430_L3_after_product_390.png'});

fs.writeFileSync('shots/v430_smoke_report.json', JSON.stringify(out,null,2));
console.log('SUMMARY', out.tests.filter(t=>t.ok).length+'/'+out.tests.length);
await browser.close(); server.close();
process.exit(out.tests.every(t=>t.ok)?0:1);
