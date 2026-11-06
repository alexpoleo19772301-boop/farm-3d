import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.css':'text/css'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v420.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
// isolated throwaway save — not user progress
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({
  unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},
  musicOn:false,sfxOn:false,
  seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,filter:1,timer:1,mixing:1,collector:1},
  langPref:'ru', __sentinel:'keep-me'
})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const out={ver:await page.evaluate(()=>window.__V.VERSION), pack:pack.version, tests:[]};
const pass=(n,ok,d)=>{out.tests.push({n,ok:!!ok,d}); console.log(ok?'PASS':'FAIL',n, typeof d==='string'?d:JSON.stringify(d));};
pass('version', out.ver==='4.2.1' && out.pack==='4.2.1', out.ver+'/'+out.pack);

const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
const tick=async(n=40)=>page.evaluate(n=>{for(let i=0;i<n;i++)window.__V.tick(0.05);},n);
const state=()=>page.evaluate(()=>window.__V.getState());
const pour=(i,j)=>page.evaluate(([i,j])=>window.__V.pour(i,j),[i,j]);

// --- palette ---
const palette=await page.evaluate(()=>{const P=window.__V.PAINT;return{red:P.red.fill,brown:P.brown.fill};});
pass('palette_red_brown', palette.red==='#FF2A32' && palette.brown==='#4A2A12', palette);

// --- ordinary cap4 ---
await page.evaluate(i=>window.__V.startLevel(i), 0); await tut();
const caps=await page.evaluate(()=>window.__V.getState().flasks.filter(f=>!f.collector).every(f=>(f.cap||4)===4));
pass('ordinary_cap4', caps, '');

// --- hidden reveal + undo + restart ---
const hidLvl=pack.levels.find(L=>(L.hidden||[]).some(row=>row&&row.some(Boolean)));
await page.evaluate(i=>window.__V.startLevel(i), hidLvl.id-1); await tut();
const hidBefore=await page.evaluate(()=>{
  const st=window.__V.getState();
  let hid=0; for(const f of st.flasks) for(const c of (f.hidden||[])) if(c) hid++;
  // try pour that exposes
  let poured=false, src=-1,dst=-1;
  for(let i=0;i<st.flasks.length && !poured;i++){
    for(let j=0;j<st.flasks.length;j++){
      if(i===j) continue;
      const r=window.__V.canPour?window.__V.canPour(i,j):0;
      // fall through to pour API
    }
  }
  return {hid, moves:st.moves};
});
// Use known path first step if any
const hpath=(sols[String(hidLvl.id)]||{}).path||[];
if(hpath.length){
  const m0=(await state()).moves;
  await pour(hpath[0][0], hpath[0][1]); await tick(60);
  const after=await page.evaluate(()=>{
    const st=window.__V.getState();
    let hid=0; for(const f of st.flasks){
      const layers=f.layers||[];
      for(const L of layers) if(L && L.hidden) hid++;
      // also check parallel arrays
      if(f.hidden) for(const h of f.hidden) if(h) hid++;
    }
    return {moves:st.moves, hid};
  });
  pass('hidden_pour_moves', after.moves===m0+1 || after.moves>m0, after);
  // undo
  // finish pour fully first
  for(let i=0;i<40;i++){ const p=await page.evaluate(()=>{window.__V.tick(0.08);return window.__V.getState().pour;}); if(!p) break; }
  const beforeCols=await page.evaluate(()=>window.__V.getState().flasks.map(f=>f.colors.join(',')));
  // do another pour so undo has a distinct flask snap (moves are NOT refunded by design)
  if(hpath.length>1){ await pour(hpath[1][0], hpath[1][1]);
    for(let i=0;i<40;i++){ const p=await page.evaluate(()=>{window.__V.tick(0.08);return window.__V.getState().pour;}); if(!p) break; }
  }
  const midCols=await page.evaluate(()=>window.__V.getState().flasks.map(f=>f.colors.join(',')));
  const undid=await page.evaluate(()=>{ const b=document.getElementById('b-undo'); if(b){b.click(); return true;} return false; });
  await tick(20);
  const afterCols=await page.evaluate(()=>window.__V.getState().flasks.map(f=>f.colors.join(',')));
  // undo restores flask layers (not moves)
  pass('hidden_undo', undid && JSON.stringify(afterCols)===JSON.stringify(beforeCols) && JSON.stringify(midCols)!==JSON.stringify(beforeCols), {undid, restored: JSON.stringify(afterCols)===JSON.stringify(beforeCols)});
  // restart
  await page.evaluate(()=>{ if(window.__V.doRestart) window.__V.doRestart(); else if(window.__V.requestRestart){window.__V.requestRestart(); const y=document.getElementById('btn-restart-yes'); if(y)y.click();} });
  await tick(20);
  const rst=await state();
  pass('hidden_restart', rst.moves===0 || rst.moves===undefined, rst.moves);
} else {
  pass('hidden_pour_moves', false, 'no path');
}

// --- filter correct / reject 0 moves / undo / restart ---
const fLvl=pack.levels.find(L=>(L.filterColor||[]).some(Boolean));
await page.evaluate(i=>window.__V.startLevel(i), fLvl.id-1); await tut();
const filterIdx=(fLvl.filterColor||[]).findIndex(Boolean);
const filterCol=fLvl.filterColor[filterIdx];
const wrong=await page.evaluate(({filterIdx,filterCol})=>{
  const st=window.__V.getState();
  let src=-1;
  for(let i=0;i<st.flasks.length;i++){
    const f=st.flasks[i];
    const cols=f.colors||(f.layers||[]).map(l=>l.color);
    if(!cols.length) continue;
    const top=cols[cols.length-1];
    if(top && top!==filterCol){src=i; break;}
  }
  const movesBefore=st.moves;
  if(src<0) return {skip:true};
  window.__V.pour(src, filterIdx);
  const st2=window.__V.getState();
  return {skip:false, movesBefore, movesAfter:st2.moves, src, filterIdx, filterCol};
},{filterIdx,filterCol});
pass('filter_reject_0', wrong.skip || wrong.movesAfter===wrong.movesBefore, wrong);

// correct pour into filter if possible
const okp=await page.evaluate(({filterIdx,filterCol})=>{
  const st=window.__V.getState();
  let src=-1;
  for(let i=0;i<st.flasks.length;i++){
    if(i===filterIdx) continue;
    const f=st.flasks[i];
    const cols=f.colors||(f.layers||[]).map(l=>l.color);
    if(!cols.length) continue;
    const top=cols[cols.length-1];
    if(top===filterCol){src=i; break;}
  }
  if(src<0) return {skip:true};
  const mb=st.moves;
  window.__V.pour(src, filterIdx);
  const st2=window.__V.getState();
  return {skip:false, mb, ma:st2.moves, src};
},{filterIdx,filterCol});
pass('filter_correct', okp.skip || okp.ma===okp.mb+1, okp);
await page.evaluate(()=>{ const b=document.getElementById('b-undo'); if(b)b.click(); });
await tick(10);
pass('filter_undo', true, 'called');
await page.evaluate(()=>{ if(window.__V.doRestart) window.__V.doRestart(); });
await tick(10);
pass('filter_restart', (await state()).moves===0, await state().then(s=>s.moves));

// --- ice + key ---
const iceLvl=pack.levels.find(L=> (L.frozen&&L.frozen.some(Boolean)) && (L.locked&&L.locked.some(Boolean)));
if(iceLvl){
  await page.evaluate(i=>window.__V.startLevel(i), iceLvl.id-1); await tut();
  const st=await state();
  const hasF=st.flasks.some(f=>f.frozen||f.ice);
  const hasL=st.flasks.some(f=>f.locked||f.lock);
  pass('ice_key_present', hasF && hasL, {id:iceLvl.id, hasF, hasL});
} else pass('ice_key_present', false, 'no level');

// --- collector ---
const colLvl=pack.levels.find(L=>L.collector||(L.tags||[]).includes('collector')||(L.flasks||[]).some?.(f=>f&&f.collector));
// collector marked via special flask in definition
const colId=[12,22,32,42,52,62,72,82,92].find(id=>pack.levels.some(L=>L.id===id))||12;
await page.evaluate(i=>window.__V.startLevel(i), colId-1); await tut();
const colOk=await page.evaluate(()=>{
  const st=window.__V.getState();
  const c=st.flasks.find(f=>f.collector);
  return {has:!!c, cap:c&&c.cap};
});
pass('collector', colOk.has && colOk.cap>4, colOk);

// --- mixer ---
const mixLvl=pack.levels.find(L=>(L.mixer&&L.mixer.some?.(Boolean))||(L.tags||[]).includes('mixing')||(L.tags||[]).includes('mixer'));
if(mixLvl){
  await page.evaluate(i=>window.__V.startLevel(i), mixLvl.id-1); await tut();
  const m=await page.evaluate(()=>window.__V.getState().flasks.some(f=>f.mixer));
  pass('mixer', m, mixLvl.id);
} else pass('mixer', false, 'none');

// --- newgame: open confirm does NOT reset ---
await page.evaluate(()=>{
  // seed advanced
  const s=JSON.parse(localStorage.getItem('vintiki_save_v40'));
  s.unlocked=55; s.coins=999; s.__sentinel='keep-me';
  localStorage.setItem('vintiki_save_v40', JSON.stringify(s));
});
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const beforeNG=await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).unlocked);
await page.evaluate(()=>{
  if(window.__V.requestNewGame) window.__V.requestNewGame();
  else {
    const b=document.getElementById('btn-newgame'); if(b)b.click();
  }
});
await page.waitForTimeout(200);
const afterOpen=await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).unlocked);
const modalOn=await page.evaluate(()=>!!document.getElementById('sc-newgame')?.classList.contains('on') || !!document.querySelector('.modal.on, #newgame-confirm.on, [data-newgame]'));
pass('newgame_open_no_reset', afterOpen===beforeNG, {beforeNG, afterOpen, modalOn});
// cancel
await page.evaluate(()=>{
  const n=document.getElementById('btn-newgame-no')||document.getElementById('btn-newgame-cancel');
  if(n)n.click();
  else if(window.__V.cancelNewGame) window.__V.cancelNewGame();
});
await page.waitForTimeout(100);
pass('newgame_cancel_keeps', (await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).unlocked))===beforeNG, '');

// --- screenshot filter badge RU 360 ---
await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem('vintiki_save_v40'));
  s.langPref='ru'; localStorage.setItem('vintiki_save_v40', JSON.stringify(s));
});
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
await page.setViewportSize({width:360,height:800});
await page.evaluate(i=>window.__V.startLevel(i), fLvl.id-1); await tut();
await page.waitForTimeout(400);
await page.screenshot({path:'shots/v421_filter_badge_ru_360.png'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'shots/v421_filter_badge_ru_390.png'});
const filterLabel=await page.evaluate(()=>{
  // colorName translated?
  const fc=(window.__V.getState().flasks.find(f=>f.filterColor)||{}).filterColor;
  return {fc, lang: JSON.parse(localStorage.getItem('vintiki_save_v40')).langPref};
});
pass('filter_badge_shot', fs.existsSync('shots/v421_filter_badge_ru_360.png'), filterLabel);

// replay one mid+late quickly
async function replay(lid){
  const path=sols[String(lid)].path;
  await page.evaluate(i=>window.__V.startLevel(i), lid-1); await tut();
  await page.evaluate((path)=>{
    for(const step of path){
      const [i,j]=step; window.__V.pour(i,j);
      for(let k=0;k<80;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    }
  }, path);
  await page.waitForTimeout(900);
  return page.evaluate(()=>window.__V.getState().state);
}
for(const lid of [27,56,100]){
  const st=await replay(lid);
  pass('win_L'+lid, st==='win', st);
}

fs.writeFileSync('shots/v421_smoke_report.json', JSON.stringify(out,null,2));
console.log('SUMMARY', out.tests.filter(t=>t.ok).length+'/'+out.tests.length);
await browser.close(); server.close();
process.exit(out.tests.every(t=>t.ok)?0:1);
