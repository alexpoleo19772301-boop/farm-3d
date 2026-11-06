import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
const tick=async()=>{for(let k=0;k<80;k++){if(!(await page.evaluate(()=>window.__V.getState().pour)))break;await page.evaluate(()=>window.__V.tick(0.05));}};
const solPath=JSON.parse(fs.readFileSync('/tmp/l27_path.json','utf8')).path;
await page.evaluate(()=>window.__V.startLevel(26)); await tut();
const lim=await page.evaluate(()=>window.__V.getState().moveLimit);
console.log('lim', lim, 'path', path.length);
for(const [i,j] of solPath){
  await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]); await tick();
  const st=await page.evaluate(()=>window.__V.getState());
  if(st.state!=='play'&&st.state!=='win'){ console.log('early', st.state, st.moves); break; }
}
await page.waitForTimeout(800);
console.log('end', await page.evaluate(()=>({state:window.__V.getState().state,moves:window.__V.getState().moves,lim:window.__V.getState().moveLimit})));
// L62 quick win
const p62=[[1,0],[1,4],[2,6],[4,5],[5,6]];
await page.evaluate(()=>window.__V.startLevel(61)); await tut();
for(const [i,j] of p62){ await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]); await tick(); }
await page.waitForTimeout(700);
console.log('l62', await page.evaluate(()=>window.__V.getState().state));
await browser.close(); server.close();
