import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = '/workspace/farm-3d/www';
const mime = { '.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.wav':'audio/wav','.css':'text/css' };
const server = http.createServer((req,res)=>{ let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/')u='/index.html'; const fp=path.join(root,u.slice(1)); if(!fs.existsSync(fp)){res.writeHead(404);res.end('missing '+u);return;} res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
const browser = await chromium.launch({args:['--no-sandbox']});

async function prep(page) {
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({unlocked:100,coins:999,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,sfxOn:false,seenTut:{basic:1,moves:1,hidden:1,frozen:1,locked:1,timer:1,varcap:1,mixing:1,collector:1,frozenTap:1},pourSfxId:0,langPref:'ru'})));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V && window.__V.VERSION);
}

function dismissTut(page) {
  return page.evaluate(()=>{ const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click(); });
}

async function waitPourDone(page) {
  for (let i=0;i<100;i++) {
    const busy = await page.evaluate(()=>window.__V.getState().pour);
    if (!busy) return;
    await page.evaluate(()=>window.__V.tick(0.05));
  }
}

const pathSol = JSON.parse(fs.readFileSync('/tmp/l25_path.json','utf8')).path;
const report = { version:null, before:null, afterStrand:null, win:null, restart:null, boss:null, errors:[], unitCounts:null };

// A: before
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await prep(page);
  report.version = await page.evaluate(()=>window.__V.VERSION);
  await page.evaluate(()=>window.__V.startLevel(24));
  await page.waitForTimeout(150);
  await dismissTut(page);
  report.before = await page.evaluate(()=>window.__V.getState());
  report.unitCounts = await page.evaluate(()=>{
    // Derive from level pack
    return fetch('assets/paint_levels.json').then(r=>r.json()).then(p=>{
      const L=p.levels[24]; const c={};
      for (const f of L.flasks) for (const x of f) c[x]=(c[x]|0)+1;
      return {totals:c, caps:L.caps};
    });
  });
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_before_390x844.png'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_before_360x800.png'});
  await page.close();
}

// B: strand attempt via auto-gather after unlocking
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(24));
  await dismissTut(page);
  const strand = await page.evaluate(async () => {
    const tick = () => { for (let k=0;k<50;k++){ window.__V.tick(0.04); if(!window.__V.getState().pour) break; } };
    // Unlock: move all red 0->6
    window.__V.pour(0,6); tick();
    window.__V.pour(0,6); tick();
    // Greedy: keep pouring teal into flask index with cap4 that already has teal or empty non-special
    for (let guard=0; guard<40; guard++) {
      const st = window.__V.getState();
      const teal4 = st.flasks.find(f => f.cap===4 && !f.corked && f.n>0 && f.top==='teal' && f.n===4);
      if (teal4) break;
      // find src with teal top and dst cap4 that can take teal
      let did=false;
      for (let i=0;i<st.flasks.length && !did;i++) {
        const s=st.flasks[i];
        if (s.corked||s.frozen||s.locked||!s.n||s.top!=='teal') continue;
        for (let j=0;j<st.flasks.length;j++) {
          if (i===j) continue;
          const d=st.flasks[j];
          if (d.cap!==4 || d.corked||d.frozen||d.locked) continue;
          if (d.n>0 && d.top!=='teal') continue;
          if (d.n>=4) continue;
          window.__V.pour(i,j); tick(); did=true; break;
        }
      }
      if (did) continue;
      // move blockers off teal
      let cleared=false;
      for (let i=0;i<st.flasks.length && !cleared;i++) {
        const s=st.flasks[i];
        if (s.corked||s.frozen||s.locked||!s.n||s.top==='teal') continue;
        for (let j=0;j<st.flasks.length;j++) {
          if (i===j) continue;
          const d=st.flasks[j];
          if (d.corked||d.frozen||d.locked) continue;
          if (d.n>0 && d.top!==s.top) continue;
          if (d.n>=d.cap) continue;
          window.__V.pour(i,j); tick(); cleared=true; break;
        }
      }
      if (!cleared) break;
    }
    const st = window.__V.getState();
    const uncorkedTeal4 = st.flasks.filter(f => f.cap===4 && f.n===4 && f.top==='teal' && !f.corked);
    const corkedTeal4 = st.flasks.filter(f => f.cap===4 && f.n===4 && f.top==='teal' && f.corked);
    // leftover teal elsewhere?
    const tealElse = st.flasks.filter(f => f.top==='teal' || (f.n>0 && !f.corked)).map((f,i)=>({i,n:f.n,cap:f.cap,top:f.top,corked:f.corked}));
    return { flasks: st.flasks, state: st.state, moves: st.moves,
      uncorkedTeal4: uncorkedTeal4.length, corkedTeal4: corkedTeal4.length, tealElse };
  });
  report.afterStrand = strand;
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_390x844.png'});
  await page.close();
}

// C: exact solution replay → win/boss
{
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await prep(page);
  await page.evaluate(()=>window.__V.startLevel(24));
  await dismissTut(page);
  const coinsBefore = await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).coins);
  const trace=[];
  for (const [i,j,amt] of pathSol) {
    await page.evaluate(([a,b])=>window.__V.pour(a,b), [i,j]);
    await waitPourDone(page);
    const st = await page.evaluate(()=>window.__V.getState());
    trace.push({i,j,amt,state:st.state,moves:st.moves,flasks:st.flasks.map(f=>({n:f.n,cap:f.cap,corked:f.corked,top:f.top,locked:f.locked,frozen:f.frozen}))});
    if (st.state !== 'play') break;
  }
  await page.waitForTimeout(800);
  await page.evaluate(()=>{ for(let i=0;i<40;i++) window.__V.tick(0.05); });
  await page.waitForTimeout(600);
  let st = await page.evaluate(()=>window.__V.getState());
  report.win = { state: st.state, moves: st.moves, flasks: st.flasks, levelIdx: st.levelIdx, traceLen: trace.length };
  report.trace = trace;
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_win_390x844.png'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_win_360x800.png'});

  if (st.state === 'boss') {
    await page.evaluate(()=>window.__V.placeBossN(99));
    await page.waitForTimeout(500);
    report.boss = await page.evaluate(()=>({ state: window.__V.getState().state, boss: window.__V.getBoss && window.__V.getBoss() }));
  } else {
    report.boss = { state: st.state, note: 'not in boss at capture' };
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_boss_or_next_390x844.png'});

  // Restart
  await page.evaluate(()=>window.__V.startLevel(24));
  await dismissTut(page);
  const st2 = await page.evaluate(()=>window.__V.getState());
  const coinsAfter = await page.evaluate(()=>JSON.parse(localStorage.getItem('vintiki_save_v40')).coins);
  report.restart = {
    state: st2.state, moves: st2.moves,
    flasks: st2.flasks,
    matchBefore: JSON.stringify(st2.flasks.map(f=>({n:f.n,cap:f.cap,locked:f.locked,frozen:f.frozen,top:f.top})))
      === JSON.stringify(report.before.flasks.map(f=>({n:f.n,cap:f.cap,locked:f.locked,frozen:f.frozen,top:f.top}))),
    coinsBefore, coinsAfter
  };
  await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_restart_390x844.png'});
  await page.close();
}

fs.writeFileSync('/tmp/l25_runtime_report.json', JSON.stringify(report,null,2));
console.log(JSON.stringify({
  version: report.version,
  unitCounts: report.unitCounts,
  strand: { uncorkedTeal4: report.afterStrand?.uncorkedTeal4, corkedTeal4: report.afterStrand?.corkedTeal4, state: report.afterStrand?.state, flasks: report.afterStrand?.flasks },
  win: report.win,
  boss: report.boss,
  restart: report.restart,
}, null, 2));
await browser.close(); server.close();

let fail=0;
if (report.version !== '4.1.4') { console.error('BAD VERSION'); fail=1; }
const okWin = report.win && ['win','boss','map'].includes(report.win.state);
if (!okWin) { console.error('NO WIN', report.win?.state); fail=2; }
if ((report.afterStrand?.corkedTeal4|0) > 0) { console.error('STRAND CORKED'); fail=3; }
if ((report.afterStrand?.uncorkedTeal4|0) === 0) { console.warn('WARN: could not assemble uncorked teal4 for strand demo'); }
if (!report.restart?.matchBefore) { console.warn('WARN restart layout mismatch'); }
if (fail) process.exit(fail);
console.log('RUNTIME_OK');
