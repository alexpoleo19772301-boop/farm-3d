import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'www');
const outDir = path.join(__dirname, '..', 'shots', 'v404');
const mime = { '.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png' };
const server = http.createServer((req,res)=>{
  let u=decodeURIComponent((req.url||'/').split('?')[0]); if(u==='/') u='/index.html';
  const fp=path.join(root,u.replace(/^\//,''));
  if(!fp.startsWith(root)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port; const base=`http://127.0.0.1:${port}/`;
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const sizes=[{w:390,h:844,n:'390x844'},{w:360,h:800,n:'360x800'},{w:412,h:915,n:'412x915'}];
const save={unlocked:40,coins:500,stars:{},musicOn:false,musicVol:0.4,sfxVol:0.55,vibrateOn:false,trackId:1,
  boosters:{undo:5,flask:2,hint:3},daily:{lastClaim:null,streak:0,lastQuestDay:null,quests:[]},
  seenTut:{basic:1,hidden:1,frozen:1,locked:1},starChests:{},questBadge:false,sfxSoftened:1,sfxBoost404:1};
for(const sz of sizes){
  const page=await browser.newPage({viewport:{width:sz.w,height:sz.h},deviceScaleFactor:2});
  await page.goto(base+'?v=4.0.4',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  await page.evaluate((s)=>{localStorage.setItem('vintiki_save_v40',JSON.stringify(s));},save);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  await page.evaluate(()=>{window.__V.unlockAudio(); window.__V.startLevel(0);});
  await page.waitForTimeout(700);
  // dismiss tut if any
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&b.offsetParent) b.click(); });
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(outDir,`${sz.n}-l1.png`),type:'png'});
  // mid pour
  await page.evaluate(()=>{
    const V=window.__V;
    for(let i=0;i<6;i++) for(let j=0;j<6;j++){
      if(i===j) continue; if(V.pour(i,j)!==false && V.getState().pour) return;
    }
  });
  await page.waitForTimeout(160);
  await page.screenshot({path:path.join(outDir,`${sz.n}-pour.png`),type:'png'});
  // level 17 landscape bg
  await page.evaluate(()=>window.__V.startLevel(16));
  await page.waitForTimeout(500);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&b.offsetParent) b.click(); });
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(outDir,`${sz.n}-l17.png`),type:'png'});
  // level 36 hills
  await page.evaluate(()=>window.__V.startLevel(36));
  await page.waitForTimeout(500);
  await page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&b.offsetParent) b.click(); });
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(outDir,`${sz.n}-l37.png`),type:'png'});
  await page.close();
}
await browser.close(); server.close();
console.log('ok', fs.readdirSync(outDir).join('\n'));
