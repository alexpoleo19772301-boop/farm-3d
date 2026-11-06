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
await page.evaluate(()=>window.__V.startLevel(24));
await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_before_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_before_360x800.png'});
await page.setViewportSize({width:390,height:844});
const strand=await page.evaluate(()=>{
  const tick=()=>{for(let k=0;k<50;k++){window.__V.tick(0.04); if(!window.__V.getState().pour) break;}};
  window.__V.pour(0,6); tick(); window.__V.pour(0,6); tick();
  for(let guard=0; guard<50; guard++){
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
  const st=window.__V.getState();
  return {moves:st.moves, flasks:st.flasks, uncorkedTeal4:st.flasks.filter(f=>f.cap===4&&f.n===4&&f.top==='teal'&&!f.corked).length, corkedTeal4:st.flasks.filter(f=>f.cap===4&&f.n===4&&f.top==='teal'&&f.corked).length};
});
console.log(JSON.stringify(strand,null,2));
await page.waitForTimeout(400); // let toast fade
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_360x800.png'});
await browser.close(); server.close();
if(strand.corkedTeal4>0||strand.uncorkedTeal4<1) process.exit(1);
