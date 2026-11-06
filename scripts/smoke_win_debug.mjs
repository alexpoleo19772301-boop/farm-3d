import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v417_partial.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
console.log('__V', (await page.evaluate(()=>Object.keys(window.__V))).sort().join(','));
await page.evaluate(()=>window.__V.startLevel(26));
await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
const witness=sols['27'].path;
const info=await page.evaluate((witness)=>{
  const results=[];
  for(const step of witness){
    const [i,j,amt]=step;
    let r;
    try { r = window.__V.pour(i,j); } catch(e){ r='err:'+e.message; }
    for(let k=0;k<100;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    const st=window.__V.getState();
    results.push({step, r:String(r), state:st.state, moves:st.moves});
    if(st.state!=='play') break;
  }
  const st=window.__V.getState();
  return {
    final: st.state, moves: st.moves, nSteps: results.length,
    flasks: st.flasks.map(f=>({cap:f.cap,corked:!!f.corked,locked:!!f.locked,thaw:f.thawLeft|0,cols:(f.layers||[]).map(l=>l.color)})),
    lastFew: results.slice(-3)
  };
}, witness);
console.log(JSON.stringify(info,null,2));
await browser.close(); server.close();
