import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v470.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
// Simulate upgrade from mix-pending attempt: unlocked mid mix level
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({worldsPaid:{egypt:1,england:1,greece:1,japan:1,atlantis:1},worldsMigrated:1,
  unlocked:40,coins:777,stars:{0:3,1:2},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,
  seenTut:{basic:1,moves:1,workshop:0},langPref:'ru',_mixAttempt:{pending:true,junk:1}
})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);

const fixed=JSON.parse(fs.readFileSync('scripts/paint_solutions_v470.json','utf8'));
const check=(name,ok,data)=>{console.log(name,ok?'PASS':'FAIL',JSON.stringify(data??null));if(!ok)throw new Error(name);};
for(const id of [40,47]){
 await page.evaluate(i=>window.__V.startLevel(i),id-1);
 await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});
 const initial=await page.evaluate(()=>window.__V.getState());
 const colors=initial.flasks.flatMap(f=>f.colors).reduce((a,c)=>(a[c]=(a[c]||0)+1,a),{});
 check('L'+id+'_paint_4each_no_mix',Object.values(colors).every(n=>n===4)&&initial.flasks.every(f=>!f.mixer&&f.cap===4),colors); // v4.7.0: regenerated harder, still no mixing
 await page.screenshot({path:`shots/v441_L${id}_initial_390.png`});
 await page.evaluate(path=>{for(const step of path){window.__V.pour(step[0],step[1]);window.__V.tick(2);}},fixed[id].path);
 await page.waitForTimeout(1100);
 const done=await page.evaluate(()=>window.__V.getState());check('L'+id+'_win',done.state==='win',done);
 await page.screenshot({path:`shots/v441_L${id}_win_390.png`});
 if(id===40){
  await page.evaluate(()=>document.getElementById('btn-next').click());
  await page.waitForFunction(()=>!!window.__V.getBoss(),{timeout:5000});
  check('boss40_started',!!(await page.evaluate(()=>window.__V.getBoss())));
  await page.evaluate(()=>window.__V.placeBossN(999));await page.waitForTimeout(1100);
  const b=await page.evaluate(()=>window.__V.getBoss());check('boss40_complete',b?.done,b);
  await page.screenshot({path:'shots/v441_L40_boss_complete_390.png'});
 }
}
const save=await page.evaluate(()=>window.__V.getSave());check('kept_test_progress',save.unlocked>=40&&save.coins>=777,save.unlocked);
await browser.close();server.close();
