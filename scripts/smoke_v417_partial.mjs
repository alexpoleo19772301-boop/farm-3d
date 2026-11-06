import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = '/workspace/farm-3d/www';
const mime = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg'};
const server = http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/') u='/index.html';
  const fp=path.join(root,u.slice(1));
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v417_partial.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({
  unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,
  seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},
  pourSfxId:0,langPref:'ru'
})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const ver=await page.evaluate(()=>window.__V.VERSION);
const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});

async function replayLevel(lid){
  const path=sols[String(lid)].path;
  await page.evaluate((i)=>window.__V.startLevel(i), lid-1);
  await tut();
  const caps=await page.evaluate(()=>window.__V.getState().flasks.map(f=>f.cap));
  const result=await page.evaluate(async(path)=>{
    for(const step of path){
      const [i,j,amt]=step;
      const a=window.__V.pour(i,j);
      if(a===false || a===0){
        // try anyway; some APIs return void
      }
      for(let k=0;k<80;k++){
        window.__V.tick(0.05);
        if(!window.__V.getState().pour) break;
      }
    }
    // drain remaining anim
    for(let k=0;k<40;k++) window.__V.tick(0.05);
    const st=window.__V.getState();
    return {state: st.state, moves: st.moves, n: st.flasks.length, caps: st.flasks.map(f=>f.cap)};
  }, path);
  return {lid, caps, ...result, pathLen: path.length};
}

const out={ver, packVersion: pack.version};
// screenshots first (start state)
for(const [lid, tag] of [[10,'l10'],[27,'l27'],[12,'collector'],[55,'l55']]){
  await page.setViewportSize({width:390,height:844});
  await page.evaluate((i)=>window.__V.startLevel(i), lid-1); await tut();
  await page.screenshot({path:`/workspace/farm-3d/shots/v417_${tag}_390x844.png`});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:`/workspace/farm-3d/shots/v417_${tag}_360x800.png`});
}

await page.setViewportSize({width:390,height:844});
out.l27=await replayLevel(27);
out.l12=await replayLevel(12);
out.l55=await replayLevel(55);

// restart check on 27
await page.evaluate(()=>window.__V.startLevel(26)); await tut();
const before=await page.evaluate(()=>window.__V.getState().flasks.map(f=>({cap:f.cap,n:f.layers?.length??f.n})));
await page.evaluate(()=>{const b=document.getElementById('b-restart'); if(b) b.click(); else window.__V.startLevel(26);});
await tut();
const after=await page.evaluate(()=>window.__V.getState().flasks.map(f=>({cap:f.cap,n:f.layers?.length??f.n})));
out.restart27={before, after, capsAll4: after.every(f=>f.cap===4 || f.cap>=6)};

fs.writeFileSync('scripts/smoke_v417_partial_out.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
await browser.close(); server.close();
