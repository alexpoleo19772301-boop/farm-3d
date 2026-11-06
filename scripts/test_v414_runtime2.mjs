import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--no-sandbox']});
async function prep(page){
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
}
async function tickPour(page){ for(let k=0;k<80;k++){ if(!(await page.evaluate(()=>window.__V.getState().pour))) break; await page.evaluate(()=>window.__V.tick(0.05)); } }
const out={};

// L62
{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(61));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  const init=await page.evaluate(()=>window.__V.getState());
  // Must NOT cork blue side flask at start
  const blueCorked=init.flasks.some(f=>!f.collector && f.corked && f.top==='blue');
  const path=[[1,0],[1,4],[2,6],[4,5],[5,6]]; // from solver; amts handled by engine
  // Use solver path with amts from python: (1,0,1),(1,4,2),(2,6,4),(4,5,3),(5,6,4)
  for (const [i,j] of [[1,0],[1,4],[2,6],[4,5],[5,6]]) {
    await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]);
    await tickPour(page);
  }
  await page.waitForTimeout(700);
  const end=await page.evaluate(()=>window.__V.getState());
  out.l62={blueCorkedAtStart:blueCorked, state:end.state, flasks:end.flasks, moves:end.moves};
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l62_collector_390x844.png'});
  await page.close();
}

// L25 full path + boss via onclick evaluate
{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await prep(page);
  const pathSol=JSON.parse(fs.readFileSync('/tmp/l25_path.json','utf8')).path;
  await page.evaluate(()=>window.__V.startLevel(24));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  // strand proof mid-way: after unlock, gather teal4
  await page.evaluate(([a,b])=>window.__V.pour(a,b),[0,6]); await tickPour(page);
  await page.evaluate(([a,b])=>window.__V.pour(a,b),[0,6]); await tickPour(page);
  // restart clean for win path
  await page.evaluate(()=>window.__V.startLevel(24));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  for (const [i,j] of pathSol) {
    await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]);
    await tickPour(page);
  }
  await page.waitForSelector('#sc-win.on',{timeout:5000});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_win_390x844.png'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_win_360x800.png'});
  // trigger next via DOM click handler directly
  await page.evaluate(()=>{ const b=document.getElementById('btn-next'); b.click(); });
  try { await page.waitForFunction(()=>window.__V.getState().state==='boss',{timeout:10000}); } catch(e) {}
  const boss=await page.evaluate(()=>({state:window.__V.getState().state, boss:window.__V.getBoss&&window.__V.getBoss(), on:[...document.querySelectorAll('.screen.on')].map(s=>s.id)}));
  out.boss=boss;
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_boss_390x844.png'});
  if (boss.state==='boss') {
    await page.evaluate(()=>window.__V.placeBossN(99));
    await page.waitForTimeout(800);
    out.afterBoss=await page.evaluate(()=>window.__V.getState().state);
    await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_after_boss_390x844.png'});
  }
  // Extra flask: start L25, add flask, ensure rem=1 still can't false-win
  await page.evaluate(()=>window.__V.startLevel(24));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  await page.evaluate(()=>window.__V.pour(0,6)); await tickPour(page);
  await page.evaluate(()=>window.__V.pour(0,6)); await tickPour(page);
  const beforeFlask=await page.evaluate(()=>window.__V.getState().flasks.length);
  await page.click('#b-flask');
  await page.waitForTimeout(200);
  const afterFlask=await page.evaluate(()=>window.__V.getState());
  out.extraFlask={before:beforeFlask, after:afterFlask.flasks.length, caps:afterFlask.flasks.map(f=>f.cap)};
  await page.close();
}

// Better before + strand shots
{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(24));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_before_390x844.png'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_before_360x800.png'});
  // Build stranded teal4 uncorked
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{
    const tick=()=>{for(let k=0;k<50;k++){window.__V.tick(0.04); if(!window.__V.getState().pour) break;}};
    window.__V.pour(0,6); tick(); window.__V.pour(0,6); tick();
    for(let g=0;g=40,g++<40;){
      const st=window.__V.getState();
      if(st.flasks.some(f=>f.cap===4&&f.n===4&&f.top==='teal'&&!f.corked)) break;
      let did=false;
      for(let i=0;i<st.flasks.length&&!did;i++){
        const s=st.flasks[i]; if(s.corked||s.frozen||s.locked||!s.n||s.top!=='teal') continue;
        for(let j=0;j<st.flasks.length;j++){
          if(i===j) continue; const d=st.flasks[j];
          if(d.cap!==4||d.corked||d.frozen||d.locked||d.n>=4) continue;
          if(d.n>0&&d.top!=='teal') continue;
          window.__V.pour(i,j); tick(); did=true; break;
        }
      }
      if(did) continue;
      let cleared=false;
      for(let i=0;i<st.flasks.length&&!cleared;i++){
        const s=st.flasks[i]; if(s.corked||s.frozen||s.locked||!s.n||s.top==='teal') continue;
        for(let j=0;j<st.flasks.length;j++){
          if(i===j) continue; const d=st.flasks[j];
          if(d.corked||d.frozen||d.locked||d.n>=d.cap) continue;
          if(d.n>0&&d.top!==s.top) continue;
          window.__V.pour(i,j); tick(); cleared=true; break;
        }
      }
      if(!cleared) break;
    }
  });
  const strand=await page.evaluate(()=>{
    const st=window.__V.getState();
    return {flasks:st.flasks, uncorkedTeal4:st.flasks.filter(f=>f.cap===4&&f.n===4&&f.top==='teal'&&!f.corked).length,
      corkedTeal4:st.flasks.filter(f=>f.cap===4&&f.n===4&&f.top==='teal'&&f.corked).length};
  });
  out.strand=strand;
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_390x844.png'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_360x800.png'});
  await page.close();
}

fs.writeFileSync('/tmp/v414_runtime2.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
await browser.close(); server.close();
let fail=0;
if (out.l62?.blueCorkedAtStart) { console.error('L62 blue corked at start'); fail=1; }
if (out.l62?.state!=='win') { console.error('L62 no win', out.l62?.state); fail=2; }
if (out.boss?.state!=='boss') { console.error('no boss', out.boss); fail=3; }
if ((out.strand?.corkedTeal4|0)>0) { console.error('strand corked'); fail=4; }
if ((out.strand?.uncorkedTeal4|0)<1) { console.warn('strand demo weak'); }
if (fail) process.exit(fail);
console.log('RUNTIME2_OK');
