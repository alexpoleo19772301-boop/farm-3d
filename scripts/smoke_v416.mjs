import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require=createRequire(import.meta.url);
// load witness paths via regenerating quick from json solutionLen only — replay via hint autosolve or pour from python dump

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
const ver=await page.evaluate(()=>window.__V.VERSION);
const tut=async()=>page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
const tick=async()=>{for(let k=0;k<100;k++){if(!(await page.evaluate(()=>window.__V.getState().pour)))break;await page.evaluate(()=>window.__V.tick(0.05));}};

async function playWitness(levelIdx){
  await page.evaluate((i)=>window.__V.startLevel(i), levelIdx); await tut();
  // Use in-game autoSolve if present, else hint loop
  const end=await page.evaluate(async()=>{
    if (window.__V.autoSolve) {
      return window.__V.autoSolve(80);
    }
    let steps=0;
    while(steps++<80){
      const st=window.__V.getState();
      if(st.state!=='play') break;
      const mv=window.__V.solveHint();
      if(!mv) break;
      window.__V.pour(mv.from, mv.to);
      for(let k=0;k<50;k++){ window.__V.tick(0.05); if(!window.__V.getState().pour) break; }
    }
    await new Promise(r=>setTimeout(r,600));
    return window.__V.getState();
  });
  return end;
}

const out={ver};
// caps uniformity L25
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
out.l25=await page.evaluate(()=>({caps:window.__V.getState().flasks.map(f=>f.cap), state:window.__V.getState().state}));
await page.screenshot({path:'/workspace/farm-3d/shots/v416_l25_all4_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v416_l25_all4_360x800.png'});
await page.setViewportSize({width:412,height:915});
await page.screenshot({path:'/workspace/farm-3d/shots/v416_l25_all4_412x915.png'});

await page.setViewportSize({width:390,height:844});
out.l25end=await playWitness(24);
out.l27end=await playWitness(26);

// lock+thaw level: find one with both tags
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const lockFreeze=pack.levels.find(L=>(L.tags||[]).includes('locked')&&(L.tags||[]).includes('frozen'));
if(lockFreeze){
  out.lockFreezeId=lockFreeze.id;
  out.lockFreeze=await playWitness(lockFreeze.id-1);
}
out.mix=await playWitness(39); // L40 mixing
out.c12=await playWitness(11);
out.c62=await playWitness(61);
out.c92=await playWitness(91);

// collector screenshot
await page.evaluate(()=>window.__V.startLevel(11)); await tut();
await page.screenshot({path:'/workspace/farm-3d/shots/v416_l12_collector_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v416_l12_collector_360x800.png'});

await page.setViewportSize({width:390,height:844});
// restart + extra flask
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
const before=await page.evaluate(()=>window.__V.getState().flasks.map(f=>({n:f.n,cap:f.cap,colors:f.colors})));
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
const after=await page.evaluate(()=>window.__V.getState().flasks.map(f=>({n:f.n,cap:f.cap,colors:f.colors})));
await page.click('#b-flask');
const extra=await page.evaluate(()=>({n:window.__V.getState().flasks.length, lastCap:window.__V.getState().flasks.at(-1).cap}));
out.restart=JSON.stringify(before)===JSON.stringify(after);
out.extra=extra;

// boss after L25 if win
if(out.l25end && (out.l25end.state==='win'||out.l25end.state==='boss'||out.l25end.state==='play')){
  // if still play, force check
}
fs.writeFileSync('/tmp/smoke_v416.json', JSON.stringify(out,null,2));
console.log(JSON.stringify({
  ver:out.ver, l25caps:out.l25.caps,
  l25:out.l25end?.state||out.l25end, l27:out.l27end?.state||out.l27end,
  lockFreeze:out.lockFreeze?.state, mix:out.mix?.state,
  c12:out.c12?.state, c62:out.c62?.state, c92:out.c92?.state,
  restart:out.restart, extra:out.extra
},null,2));
await browser.close(); server.close();
if(out.ver!=='4.1.6') process.exit(1);
if(!out.l25.caps.every(c=>c===4)) process.exit(2);
if(out.extra.lastCap!==4) process.exit(3);
console.log('SMOKE_OK');
