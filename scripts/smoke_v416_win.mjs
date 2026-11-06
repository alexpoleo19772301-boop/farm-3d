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
const tick=async()=>{for(let k=0;k<100;k++){if(!(await page.evaluate(()=>window.__V.getState().pour)))break;await page.evaluate(()=>window.__V.tick(0.05));}};
const paths=JSON.parse(fs.readFileSync('/tmp/v416_paths.json','utf8'));
async function run(lid){
  await page.evaluate((i)=>window.__V.startLevel(i), lid-1); await tut();
  const sol=paths[String(lid)];
  for(const [i,j] of sol){
    await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]); await tick();
    const st=await page.evaluate(()=>window.__V.getState().state);
    if(st!=='play') return st;
  }
  await page.waitForTimeout(800);
  return await page.evaluate(()=>window.__V.getState().state);
}
const out={ver:await page.evaluate(()=>window.__V.VERSION)};
for (const lid of Object.keys(paths).map(Number).sort((a,b)=>a-b)){
  out['L'+lid]=await run(lid);
  console.log('L'+lid, out['L'+lid]);
}
// L25 boss button if win
if(out.L25==='win'){
  await page.evaluate(()=>document.getElementById('btn-next')?.click());
  try{await page.waitForFunction(()=>window.__V.getState().state==='boss',{timeout:8000}); out.boss='boss';}
  catch(e){ out.boss=await page.evaluate(()=>window.__V.getState().state); }
}
fs.writeFileSync('/tmp/smoke_v416_win.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
await browser.close(); server.close();
const bad=Object.entries(out).filter(([k,v])=>k.startsWith('L')&&v!=='win');
if(out.ver!=='4.1.6'||bad.length){ console.error('FAIL', bad); process.exit(1); }
console.log('WIN_SMOKE_OK');
