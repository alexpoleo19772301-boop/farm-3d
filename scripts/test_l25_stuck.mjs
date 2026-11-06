import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root = '/workspace/farm-3d/www';
const mime = { '.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.wav':'audio/wav' };
const server = http.createServer((req,res)=>{ let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/')u='/index.html'; const fp=path.join(root,u.slice(1)); if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
await page.evaluate(()=>window.__V.startLevel(24));
await page.waitForTimeout(200);
await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
const init = await page.evaluate(()=>window.__V.getState());
console.log('INIT', JSON.stringify(init.flasks,null,2));
console.log('locked/corked/frozen', init.flasks.map((f,i)=>({i, locked:f.locked, lockColor:f.lockColor, corked:f.corked, frozen:f.frozen, thaw:f.thawLeft, n:f.n, cap:f.cap, top:f.top})));

// Try autoSolve with hint
const result = await page.evaluate(async()=>{
  const log=[];
  let steps=0;
  while(steps++<100 && window.__V.getState().state==='play'){
    const before=window.__V.getState();
    const mv=window.__V.solveHint();
    if(!mv){ log.push({t:'no_hint', moves:before.moves, flasks:before.flasks.map(f=>({n:f.n,corked:f.corked,locked:f.locked,frozen:f.frozen,top:f.top,cap:f.cap}))}); break; }
    window.__V.pour(mv.from,mv.to); window.__V.tick(1);
    const after=window.__V.getState();
    if(before.flasks.some((f,i)=>f.locked!==after.flasks[i].locked) || before.flasks.some((f,i)=>f.frozen!==after.flasks[i].frozen))
      log.push({t:'statechange', from:mv, before:before.flasks.map(f=>({locked:f.locked,frozen:f.frozen,corked:f.corked,n:f.n})), after:after.flasks.map(f=>({locked:f.locked,frozen:f.frozen,corked:f.corked,n:f.n}))});
  }
  await new Promise(r=>setTimeout(r,600));
  const end=window.__V.getState();
  log.push({t:'end', state:end.state, moves:end.moves, flasks:end.flasks.map(f=>({n:f.n,corked:f.corked,locked:f.locked,frozen:f.frozen,top:f.top,cap:f.cap}))});
  return log;
});
console.log(JSON.stringify(result,null,2));
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_stuck_390x844.png'});
await browser.close(); server.close();
