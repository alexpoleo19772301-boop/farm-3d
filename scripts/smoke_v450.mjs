import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sols=JSON.parse(fs.readFileSync('scripts/paint_solutions_v440.json','utf8'));
const fixed=JSON.parse(fs.readFileSync('scripts/paint_solutions_v441_fixed.json','utf8'));
const extra=JSON.parse(fs.readFileSync('scripts/paint_solutions_v450_extra.json','utf8'));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(()=>localStorage.setItem('vintiki_save_v40', JSON.stringify({
  unlocked:100,coins:500,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,seenTut:{basic:1,moves:1,workshop:1,hidden:1,filter:1,frozen:1,frozenTap:1,lock:1,collector:1},langPref:'ru'})));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
let fails=0;
const check=(name,ok,data)=>{console.log(ok?'PASS':'FAIL',name,ok?'':JSON.stringify(data??null));if(!ok)fails++;};
const closeTut=()=>page.evaluate(()=>{for(let k=0;k<4;k++){const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();}});
// 1) every level winnable with its verified witness inside the NEW tighter limit
for(let id=1;id<=100;id++){
  const s=extra[id]||fixed[id]||sols[id]; const steps=(s&&(s.path||s))||[];
  await page.evaluate(i=>window.__V.startLevel(i),id-1); await closeTut();
  const lim=await page.evaluate(()=>window.__V.getState().moveLimit);
  await page.evaluate(p=>{for(const st of p){if(window.__V.getState().state!=='play')break;window.__V.pour(st[0],st[1]);window.__V.tick(2);}},steps);
  await page.waitForTimeout(650);
  const g=await page.evaluate(()=>window.__V.getState());
  check('L'+id+'_win_lim'+lim, g.state==='win' && g.moves<=lim && lim===pack.levels[id-1].moveLimit, {state:g.state,moves:g.moves,lim,len:steps.length});
}
// 2) pipe after even (not boss) levels
await page.evaluate(()=>window.__V.startLevel(1)); await closeTut();
await page.evaluate(p=>{for(const st of p){window.__V.pour(st[0],st[1]);window.__V.tick(2);}},(sols[2].path||sols[2]));
await page.waitForTimeout(700);
check('next_label_pipe', (await page.textContent('#btn-next')).includes('Водопровод'));
await page.click('#btn-next'); await page.waitForTimeout(300);
let pp=await page.evaluate(()=>window.__V.getPipe());
check('pipe_started_after_L2', pp && pp.lvl===2 && !pp.done && !pp.solved, pp);
await page.waitForTimeout(400); await page.screenshot({path:'shots/v450_pipe_L2_390.png'});
const coins0=(await page.evaluate(()=>window.__V.getSave())).coins;
check('pipe_solve', await page.evaluate(()=>window.__V.pipeSolve()));
await page.waitForTimeout(900); await page.screenshot({path:'shots/v450_pipe_done_390.png'});
const sv=await page.evaluate(()=>window.__V.getSave());
check('pipe_reward', sv.coins>coins0 && sv.stars.pipe_2>=1, {c0:coins0,c:sv.coins});
await page.mouse.click(195,420); await page.waitForTimeout(300);
let st=await page.evaluate(()=>window.__V.getState());
check('pipe_continue_to_L3', st.state==='play' && st.levelIdx===2, st.levelIdx);
// odd level -> plain next
await page.evaluate(p=>{for(const s of p){window.__V.pour(s[0],s[1]);window.__V.tick(2);}},(sols[3].path||sols[3])); await page.waitForTimeout(700);
check('L3_next_plain', !(await page.textContent('#btn-next')).includes('Водопровод'));
// boss level 10 still boss
await page.evaluate(()=>window.__V.startLevel(9)); await closeTut();
await page.evaluate(p=>{for(const s of p){window.__V.pour(s[0],s[1]);window.__V.tick(2);}},(sols[10].path||sols[10])); await page.waitForTimeout(700);
check('L10_still_boss', (await page.textContent('#btn-next')).includes('босс'));
// every pipe board solvable and not pre-solved, big boards late
for(const lv of [3,5,9,31,57,71,99]){
  await page.evaluate(l=>window.__V.startPipe(l),lv);
  const a=await page.evaluate(()=>window.__V.getPipe());
  const ok=await page.evaluate(()=>window.__V.pipeSolve());
  check('pipe'+lv+'_n'+a.n, !a.solved && ok && a.par>=1, a);
}
await page.evaluate(()=>window.__V.startPipe(72)); await page.waitForTimeout(300);
await page.screenshot({path:'shots/v450_pipe_7x7_360.png'});
// restart pipe = reshuffle same board, no reward
await page.evaluate(()=>{window.__V.pipeTap(0,0);});
await page.click('#btn-restart'); await page.waitForTimeout(200);
pp=await page.evaluate(()=>window.__V.getPipe()); check('pipe_restart', pp.taps===0 && !pp.done, pp);
const fin=await page.evaluate(()=>window.__V.getSave()); check('progress_kept', fin.unlocked>=100, fin.unlocked);
console.log('SUMMARY fails',fails);
await browser.close();server.close();process.exit(fails?1:0);
