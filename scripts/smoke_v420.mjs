import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v420.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,filter:1,timer:1,mixing:1,collector:1},langPref:'en'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const out={ver:await page.evaluate(()=>window.__V.VERSION), pack:pack.version, tests:[]};
const pass=(n,ok,d)=>{out.tests.push({n,ok:!!ok,d}); console.log(ok?'PASS':'FAIL',n,d||'');};
pass('version', out.ver==='4.2.0' && out.pack==='4.2.0', out.ver);

const palette=await page.evaluate(()=>{
  const P=window.__V.PAINT;
  return {red:P.red.fill, brown:P.brown.fill, orange:P.orange.fill};
});
pass('palette_distinct', palette.red!==palette.brown && palette.red.toLowerCase()!=='#e53935', JSON.stringify(palette));

const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});

// Find filter level
const fLvl=pack.levels.find(L=>(L.filterColor||[]).some(Boolean));
await page.evaluate(i=>window.__V.startLevel(i), fLvl.id-1); await tut();
const filterIdx=(fLvl.filterColor||[]).findIndex(Boolean);
const filterCol=fLvl.filterColor[filterIdx];
// try wrong pour into filter: find src with wrong top color
const wrong=await page.evaluate(({filterIdx,filterCol})=>{
  const st=window.__V.getState();
  let src=-1;
  for(let i=0;i<st.flasks.length;i++){
    const f=st.flasks[i];
    if(!f.colors.length) continue;
    const top=f.colors[f.colors.length-1];
    if(top!==filterCol){src=i; break;}
  }
  const movesBefore=st.moves;
  if(src<0) return {skip:true};
  const r=window.__V.pour(src, filterIdx);
  const st2=window.__V.getState();
  return {skip:false, r, movesBefore, movesAfter:st2.moves, src, filterIdx, filterCol};
}, {filterIdx, filterCol});
pass('wrong_filter_no_move', wrong.skip || (wrong.movesAfter===wrong.movesBefore), JSON.stringify(wrong));

// replay L56 win
async function replay(lid){
  const path=sols[String(lid)].path;
  await page.evaluate(i=>window.__V.startLevel(i), lid-1); await tut();
  await page.evaluate((path)=>{
    for(const step of path){
      const [i,j]=step; window.__V.pour(i,j);
      for(let k=0;k<100;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    }
  }, path);
  await page.waitForTimeout(700);
  return page.evaluate(()=>window.__V.getState().state);
}
for(const lid of [56,90,100]){
  const st=await replay(lid);
  pass('win_L'+lid, st==='win', st);
}

// screenshots red+brown if present, filter level, late board
await page.setViewportSize({width:390,height:844});
await page.evaluate(i=>window.__V.startLevel(i), fLvl.id-1); await tut();
await page.screenshot({path:'shots/v420_filter_level_390.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'shots/v420_filter_level_360.png'});
await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>window.__V.startLevel(89)); await tut();
await page.screenshot({path:'shots/v420_l90_390.png'});
await page.evaluate(()=>window.__V.startLevel(99)); await tut();
await page.screenshot({path:'shots/v420_l100_390.png'});
// color compare: start a level that has both red and brown if any
const rb=pack.levels.find(L=>L.flasks.some(f=>f.includes('red'))&&L.flasks.some(f=>f.includes('brown')));
if(rb){ await page.evaluate(i=>window.__V.startLevel(i), rb.id-1); await tut(); await page.screenshot({path:'shots/v420_red_brown_390.png'}); out.redBrownLevel=rb.id; }

fs.writeFileSync('scripts/smoke_v420_out.json', JSON.stringify(out,null,2));
console.log('RESULT', out.tests.filter(t=>!t.ok).length?'FAIL':'ALL PASS', out.tests.length);
await browser.close(); server.close();
if(out.tests.some(t=>!t.ok)) process.exit(1);
