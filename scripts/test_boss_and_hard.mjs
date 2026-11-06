import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const pathSol=JSON.parse(fs.readFileSync('/tmp/l25_path.json','utf8')).path;
await page.evaluate(()=>window.__V.startLevel(24));
await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
for (const [i,j] of pathSol) {
  await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]);
  for(let k=0;k<80;k++){ const p=await page.evaluate(()=>window.__V.getState().pour); if(!p) break; await page.evaluate(()=>window.__V.tick(0.05)); }
}
await page.waitForTimeout(900);
let st=await page.evaluate(()=>window.__V.getState().state);
console.log('after win state', st);
// Click Мини-босс
await page.click('#btn-next');
await page.waitForTimeout(800);
st=await page.evaluate(()=>({state:window.__V.getState().state, boss:window.__V.getBoss&&window.__V.getBoss()}));
console.log('after next', st);
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_boss_390x844.png'});
if (st.state==='boss') {
  await page.evaluate(()=>window.__V.placeBossN(99));
  await page.waitForTimeout(600);
  console.log('after boss complete', await page.evaluate(()=>window.__V.getState().state));
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_after_boss_390x844.png'});
}
// L51 autosolve probe
await page.evaluate(()=>window.__V.startLevel(50));
await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
const r51=await page.evaluate(async()=>{
  if (window.__V.autoSolve) return window.__V.autoSolve(80);
  // manual hint loop
  let steps=0; const log=[];
  while(steps++<60){
    const st=window.__V.getState();
    if(st.state!=='play') break;
    const mv=window.__V.solveHint();
    if(!mv){log.push('nohint'); break;}
    window.__V.pour(mv.from,mv.to);
    for(let k=0;k<40;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
  }
  return {steps, end:window.__V.getState().state, moves:window.__V.getState().moves, flasks:window.__V.getState().flasks};
});
console.log('L51 probe', JSON.stringify(r51).slice(0,500));
await browser.close(); server.close();
