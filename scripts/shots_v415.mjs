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

await page.evaluate(()=>window.__V.startLevel(26)); await tut();
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_varcap_lock_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_varcap_lock_360x800.png'});

await page.setViewportSize({width:390,height:844});
const sol=JSON.parse(fs.readFileSync('/tmp/l27_path.json','utf8')).path;
for (const [i,j] of sol.slice(0,7)) {
  await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]); await tick();
}
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_unlocked_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l27_unlocked_360x800.png'});

await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_before_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_before_360x800.png'});
await page.setViewportSize({width:412,height:915});
await page.screenshot({path:'/workspace/farm-3d/shots/v415_l25_before_412x915.png'});

await browser.close(); server.close();
console.log('SHOTS_OK', window===undefined);
