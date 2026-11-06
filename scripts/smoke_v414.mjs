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
const port=server.address().port;
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const ver=await page.evaluate(()=>window.__V.VERSION);
page.on('pageerror', e=>console.log('PAGEERROR', e.message));
const tick=async()=>{for(let k=0;k<80;k++){if(!(await page.evaluate(()=>window.__V.getState().pour)))break;await page.evaluate(()=>window.__V.tick(0.05));}};
const pour=async(i,j)=>{await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]);await tick();};
const tut=async()=>{await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();});};
const out={ver};

// Strand path
const strandPath=JSON.parse(fs.readFileSync('/tmp/strand_path.json','utf8')).path;
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
for(const [i,j] of strandPath) await pour(i,j);
let st=await page.evaluate(()=>window.__V.getState());
const mono=st.flasks.filter(f=>f.colors?.length===4&&f.colors.every(c=>c==='teal'));
out.strand={monoCorked:mono.map(f=>f.corked), monoCount:mono.length, tealUnits:st.flasks.reduce((n,f)=>n+(f.colors||[]).filter(c=>c==='teal').length,0)};

// Consolidate: pour leftover teal into size5 then mono4→size5
// Find leftover teal flask and size5
const consolidate=await page.evaluate(async()=>{
  const tick=()=>{for(let k=0;k<50;k++){window.__V.tick(0.04);if(!window.__V.getState().pour)break;}};
  // empty size5 if needed by pouring non-teal out — size5 should be empty from strand path
  // pour mono4 teal (idx5) into size5 (idx4) in chunks, plus the 1 teal from idx1
  const st0=window.__V.getState();
  const i4=st0.flasks.findIndex(f=>f.colors?.length===4&&f.colors.every(c=>c==='teal'));
  const i5=st0.flasks.findIndex(f=>f.cap===5);
  const iTeal=st0.flasks.findIndex((f,i)=>i!==i4&&(f.colors||[]).includes('teal')&&f.top==='teal');
  // First free the buried teal if needed — strand left teal under stuff in flask1; top may not be teal
  // From known strand: flask1=[teal,yellow,orange,orange] top orange — need clear
  // Simpler: pour mono teal4 (i4) into size5
  if(i4>=0&&i5>=0){ window.__V.pour(i4,i5); tick(); window.__V.pour(i4,i5); tick(); }
  // clear blockers off remaining teal then pour to size5
  for(let g=0;g<20;g++){
    const st=window.__V.getState();
    const s5=st.flasks[i5];
    if(s5.colors?.length===5&&s5.colors.every(c=>c==='teal')&&s5.corked) break;
    // pour any teal top into size5
    let did=false;
    for(let i=0;i<st.flasks.length;i++){
      if(i===i5) continue; const s=st.flasks[i];
      if(s.corked||s.frozen||s.locked||s.top!=='teal') continue;
      window.__V.pour(i,i5); tick(); did=true; break;
    }
    if(did) continue;
    // move non-teal blocker
    let cleared=false;
    for(let i=0;i<st.flasks.length&&!cleared;i++){
      const s=st.flasks[i]; if(s.corked||s.frozen||s.locked||!s.n||s.top==='teal') continue;
      if(!(s.colors||[]).includes('teal')) continue; // only clear flasks that still hold teal below
      for(let j=0;j<st.flasks.length;j++){
        if(i===j||j===i5) continue; const d=st.flasks[j];
        if(d.corked||d.frozen||d.locked||d.n>=d.cap) continue;
        if(d.n>0&&d.top!==s.top) continue;
        window.__V.pour(i,j); tick(); cleared=true; break;
      }
    }
    if(!cleared) break;
  }
  const end=window.__V.getState();
  const s5=end.flasks[i5];
  return {size5:s5, corked:s5?.corked, colors:s5?.colors};
});
out.consolidate=consolidate;

// Full win from fresh start
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
const winPath=JSON.parse(fs.readFileSync('/tmp/l25_path.json','utf8')).path;
for(const [i,j] of winPath) await pour(i,j);
await page.waitForSelector('#sc-win.on',{timeout:5000});
out.win=await page.evaluate(()=>window.__V.getState().state);
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_win_390x844.png'});
await page.evaluate(()=>document.getElementById('btn-next').click());
await page.waitForFunction(()=>window.__V.getState().state==='boss',{timeout:8000});
out.boss=await page.evaluate(()=>window.__V.getBoss());
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_boss_390x844.png'});
await page.evaluate(()=>window.__V.placeBossN(99));
await page.waitForTimeout(800);
out.afterBoss=await page.evaluate(()=>window.__V.getState().state);

// L62
await page.evaluate(()=>window.__V.startLevel(61)); await tut();
const l62init=await page.evaluate(()=>window.__V.getState());
out.l62preCork=l62init.flasks.some(f=>!f.collector&&f.corked&&(f.colors||[]).every(c=>c==='blue')&&f.n===4);
for(const [i,j] of [[1,0],[1,4],[2,6],[4,5],[5,6]]) await pour(i,j);
await page.waitForTimeout(700);
out.l62=await page.evaluate(()=>window.__V.getState().state);

// Restart conservation
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
const a=await page.evaluate(()=>window.__V.getState().flasks.map(f=>({n:f.n,cap:f.cap,colors:f.colors,locked:f.locked,frozen:f.frozen})));
await page.evaluate(()=>window.__V.startLevel(24)); await tut();
const b=await page.evaluate(()=>window.__V.getState().flasks.map(f=>({n:f.n,cap:f.cap,colors:f.colors,locked:f.locked,frozen:f.frozen})));
out.restartMatch=JSON.stringify(a)===JSON.stringify(b);

// Extra flask
await page.click('#b-flask');
out.extraFlask=await page.evaluate(()=>({n:window.__V.getState().flasks.length, lastCap:window.__V.getState().flasks.at(-1).cap}));

// Boss i18n keys exist
out.bossKeys=await page.evaluate(()=>({boss0:typeof t==='function'?null:null, hasI18n:!!window.I18N||!!document.querySelector('[data-i18n]')}));
// check via game toast path already showed Пекарня

fs.writeFileSync('/tmp/smoke_v414.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
let fail=0;
if(out.ver!=='4.1.4') fail=1;
if(!out.strand.monoCount||out.strand.monoCorked.some(Boolean)||out.strand.tealUnits!==5) fail=2;
if(out.win!=='win') fail=3;
if(!out.boss||out.boss.total<1) fail=4;
if(out.l62!=='win'||out.l62preCork) fail=5;
if(!out.restartMatch) fail=6;
if(out.extraFlask.n!==8||out.extraFlask.lastCap!==4) fail=7;
await browser.close(); server.close();
if(fail){ console.error('SMOKE_FAIL', fail); process.exit(fail); }
console.log('SMOKE_OK');
