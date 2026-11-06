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

const tick=async()=>{ for(let k=0;k<80;k++){ if(!(await page.evaluate(()=>window.__V.getState().pour))) break; await page.evaluate(()=>window.__V.tick(0.05)); } };
const pour=async(i,j)=>{ await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]); await tick(); };

// Explicit dangerous path: unlock, then assemble 4 teal into empty size-4 (flask 0)
await pour(0,6); await pour(0,6); // red corked, 0 empty, size5 unlocked, ice thawed
// From solution-ish: clear path to gather teal into flask 0
// After unlock state from solver step1:
// [], [teal,yellow,orange,teal], [y,y,y,orange], [g,g,orange,g], [teal], [teal,teal,orange,green], [redx4 corked]
await pour(1,4); // teal -> size5
await pour(1,0); // orange -> 0  (blocker)
await pour(2,0); // orange -> 0
await pour(1,2); // yellow completes yellow? 
await pour(1,4); // teal -> size5  now size5 has 3 teal?, flask1 empty
// Check
let st=await page.evaluate(()=>window.__V.getState());
console.log('mid', st.flasks.map(f=>({n:f.n,cap:f.cap,colors:f.colors,corked:f.corked})));

// Keep pouring teals into a size-4 empty or teal flask
for(let g=0;g<30;g++){
  st=await page.evaluate(()=>window.__V.getState());
  const mono4=st.flasks.find(f=>f.cap===4 && f.colors && f.colors.length===4 && f.colors.every(c=>c==='teal'));
  if(mono4) break;
  // find teal top src and size4 dst that is empty or teal
  let moved=false;
  for(let i=0;i<st.flasks.length&&!moved;i++){
    const s=st.flasks[i];
    if(s.corked||s.frozen||s.locked||!s.n||s.top!=='teal') continue;
    for(let j=0;j<st.flasks.length;j++){
      if(i===j) continue; const d=st.flasks[j];
      if(d.cap!==4||d.corked||d.frozen||d.locked||d.n>=4) continue;
      if(d.n>0 && d.top!=='teal') continue;
      await pour(i,j); moved=true; break;
    }
  }
  if(moved) continue;
  // clear non-teal tops onto compatible flasks (not stealing last empty if needed)
  let cleared=false;
  for(let i=0;i<st.flasks.length&&!cleared;i++){
    const s=st.flasks[i];
    if(s.corked||s.frozen||s.locked||!s.n||s.top==='teal') continue;
    for(let j=0;j<st.flasks.length;j++){
      if(i===j) continue; const d=st.flasks[j];
      if(d.corked||d.frozen||d.locked||d.n>=d.cap) continue;
      if(d.n>0 && d.top!==s.top) continue;
      await pour(i,j); cleared=true; break;
    }
  }
  if(!cleared) break;
}
st=await page.evaluate(()=>window.__V.getState());
const mono4=st.flasks.map((f,i)=>({i,...f})).filter(f=>f.cap===4 && f.colors?.length===4 && f.colors.every(c=>c==='teal'));
const leftoverTeal=st.flasks.filter(f=>f.colors?.some(c=>c==='teal')).map(f=>({cap:f.cap,colors:f.colors,corked:f.corked}));
const result={moves:st.moves, mono4: mono4.map(f=>({i:f.i,corked:f.corked,colors:f.colors})), leftoverTeal, allFlasks:st.flasks.map(f=>({cap:f.cap,corked:f.corked,colors:f.colors}))};
console.log(JSON.stringify(result,null,2));
fs.writeFileSync('/tmp/strand_proof.json', JSON.stringify(result,null,2));
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_360x800.png'});
await browser.close(); server.close();
if(!mono4.length) { console.error('FAILED to assemble mono teal4'); process.exit(1); }
if(mono4.some(f=>f.corked)) { console.error('BUG: mono teal4 was corked'); process.exit(2); }
console.log('STRAND_PROOF_OK');
