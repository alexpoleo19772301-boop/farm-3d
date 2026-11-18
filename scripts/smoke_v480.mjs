// v4.8.0: wooden blocks puzzle «Проверь свой IQ» after every 2nd level (replaces pipe slot). Headless Playwright.
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
fs.mkdirSync('shots',{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:false});
const url=`http://127.0.0.1:${server.address().port}/`;
await page.goto(url);
const TUT={basic:1,moves:1,workshop:1,hidden:1,filter:1,frozen:1,frozenTap:1,lock:1,locked:1,collector:1,timer:1};
const ALLPAID={egypt:1,england:1,greece:1,japan:1,atlantis:1};
async function seed(obj){await page.evaluate(o=>{localStorage.clear();localStorage.setItem('farm3d_cap4_notice','4.7.0');localStorage.setItem('vintiki_save_v40',JSON.stringify(o));},obj);await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__V);}
let fails=0;
const check=(name,ok,data)=>{console.log(ok?'PASS':'FAIL',name,ok?'':JSON.stringify(data??null));if(!ok)fails++;};
const closeTut=()=>page.evaluate(()=>{for(let k=0;k<4;k++){const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();}});
const play=(steps)=>page.evaluate(p=>{for(const st of p){if(window.__V.getState().state!=='play')break;window.__V.pour(st[0],st[1]);window.__V.tick(2);}},steps);
const sv=()=>page.evaluate(()=>window.__V.getSave());

// independent exact-cover solver (rotations only if the puzzle allows them)
function norm(c){let mx=Math.min(...c.map(p=>p[0])),my=Math.min(...c.map(p=>p[1]));return c.map(([x,y])=>[x-mx,y-my]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);}
function rot(c){return norm(c.map(([x,y])=>[-y,x]));}
function solve(b){
  const T=new Set(b.target.map(([x,y])=>x+','+y));
  const orients=b.pieces.map(p=>{const out=[];let c=norm(p.cells);const seen=new Set();for(let r=0;r<(b.canRotate?4:1);r++){const s=JSON.stringify(c);if(!seen.has(s)){seen.add(s);out.push(c);}c=rot(c);}return out;});
  const cells=[...T].map(k=>k.split(',').map(Number)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const occ=new Set(),used=new Array(b.pieces.length).fill(false);let nodes=0;
  function rec(){
    if(++nodes>2e6)return false;
    const first=cells.find(([x,y])=>!occ.has(x+','+y));if(!first)return true;
    for(let i=0;i<orients.length;i++){if(used[i])continue;
      for(const o of orients[i]){const [ax,ay]=o[0];const dx=first[0]-ax,dy=first[1]-ay;
        const ks=o.map(([x,y])=>(x+dx)+','+(y+dy));if(ks.some(k=>!T.has(k)||occ.has(k)))continue;
        ks.forEach(k=>occ.add(k));used[i]=true;if(rec())return true;ks.forEach(k=>occ.delete(k));used[i]=false;}}
    return false;}
  const sizeOk=b.pieces.reduce((a,p)=>a+p.cells.length,0)===T.size;
  return sizeOk&&rec();
}

// 1) blocks after L2, boss after L10, plain after odd
await seed({unlocked:30,coins:0,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,seenTut:TUT,langPref:'ru',worldsPaid:ALLPAID,worldsMigrated:1});
await page.evaluate(()=>window.__V.startLevel(1)); await closeTut();
await play(pack.levels[1].hintPath); await page.waitForTimeout(600);
check('L2_next_is_blocks', (await page.textContent('#btn-next')).includes('IQ'), await page.textContent('#btn-next'));
await page.click('#btn-next'); await page.waitForTimeout(400);
let b=await page.evaluate(()=>window.__V.getBlocks());
let st=await page.evaluate(()=>window.__V.getState());
check('blocks_started_after_L2', st.state==='blocks' && b && b.lvl===2 && !b.done && b.placed===0, {state:st.state,b:b&&{lvl:b.lvl}});
const pills=await page.evaluate(()=>({m:getComputedStyle(document.getElementById('moves-pill')).display,t:getComputedStyle(document.getElementById('timer-pill')).display,r:getComputedStyle(document.getElementById('btn-restart')).display,lp:document.getElementById('lvl-pill').textContent}));
check('moves_timer_hidden_restart_shown', pills.m==='none'&&pills.t==='none'&&pills.r!=='none'&&pills.lp.includes('IQ'), pills);
await page.screenshot({path:'shots/v480_blocks_easy_L2.png'});

// 2) drag & snap with real pointer events: piece 0 dragged from tray to its solution spot
const k0=(await sv()).coins;
async function dragPiece(bb,i){
  const p=bb.pieces[i],L=bb.layout;
  const a=p.cells[0];                       // grab the first cell of the tray piece
  const fx=p.tx+(a[0]+0.5)*p.ts, fy=p.ty+(a[1]+0.5)*p.ts;
  // where that cell must land on the board (solution orientation === current when rot===0)
  const tx=L.x+(p.sx+a[0]+0.5)*L.cs+L.cs*0.2, ty=L.y+(p.sy+a[1]+0.5)*L.cs-L.cs*0.2; // slightly off -> must snap
  await page.mouse.move(fx,fy); await page.mouse.down();
  for(let s=1;s<=8;s++){await page.mouse.move(fx+(tx-fx)*s/8,fy+(ty-fy)*s/8);}
  return {fx,fy,tx,ty};
}
check('L2_no_rotation_needed', b.rot==='none' && b.pieces.every(p=>p.rot===0), b.pieces.map(p=>p.rot));
const id0=b.pieces[0].id;
let d=await dragPiece(b,0);
let mid=await page.evaluate(()=>window.__V.getBlocks());
check('mid_drag_state', mid.dragging===true && mid.placed===0, mid.dragging);
await page.mouse.up(); await page.waitForTimeout(150);
b=await page.evaluate(()=>window.__V.getBlocks());
const p0=b.pieces.find(p=>p.id===id0);
check('drag_snaps_into_frame', p0.placed && p0.gx===p0.sx && p0.gy===p0.sy && b.moves===1, p0);
// bad drop (outside the frame) goes back to tray
const q=b.pieces.find(p=>!p.placed); const qi=b.pieces.indexOf(q);
await page.mouse.move(q.tx+q.ts*0.5,q.ty+q.ts*0.5); await page.mouse.down(); await page.mouse.move(20,140,{steps:5}); await page.mouse.up(); await page.waitForTimeout(100);
b=await page.evaluate(()=>window.__V.getBlocks());
check('bad_drop_returns_to_tray', !b.pieces.find(p=>p.id===q.id).placed && b.moves===1);
// pick up a placed piece again (drag it off the board)
const pl=b.pieces.find(p=>p.placed); const cx=b.layout.x+(pl.gx+pl.cells[0][0]+0.5)*b.layout.cs, cy=b.layout.y+(pl.gy+pl.cells[0][1]+0.5)*b.layout.cs;
await page.mouse.move(cx,cy); await page.mouse.down(); await page.mouse.move(cx,cy+300,{steps:6}); await page.mouse.up(); await page.waitForTimeout(100);
b=await page.evaluate(()=>window.__V.getBlocks());
check('placed_piece_can_be_picked_up', b.placed===0, b.placed);
// now drag every piece with the pointer -> win
for(let n=0;n<b.nPieces;n++){
  b=await page.evaluate(()=>window.__V.getBlocks());
  const i=b.pieces.findIndex(p=>!p.placed); if(i<0)break;
  await dragPiece(b,i); await page.mouse.up(); await page.waitForTimeout(80);
}
b=await page.evaluate(()=>window.__V.getBlocks());
check('pointer_drags_fill_frame_win', b.done && b.filled, {done:b.done,placed:b.placed});
await page.waitForTimeout(700); await page.screenshot({path:'shots/v480_blocks_done_L2.png'});
let k1=(await sv()).coins;
check('blocks_first_clear_pays_5', k1-k0===5, {k0,k1});
await page.mouse.click(195,420); await page.waitForTimeout(300);
st=await page.evaluate(()=>window.__V.getState());
check('blocks_continue_to_L3', st.state==='play' && st.levelIdx===2, st);
await page.evaluate(()=>window.__V.startBlocks(2)); await page.evaluate(()=>window.__V.blocksSolve()); await page.waitForTimeout(200);
let k2=(await sv()).coins;
check('blocks_replay_no_coins', k2===k1, {k1,k2});
// a slot already paid through the old pipe game does not pay twice
await page.evaluate(()=>window.__V.setStars({pipe_4:3}));
await page.evaluate(()=>window.__V.startBlocks(4)); await page.evaluate(()=>window.__V.blocksSolve()); await page.waitForTimeout(200);
check('old_pipe_slot_not_paid_twice', (await sv()).coins===k2);
// world amounts (Camelot slot pays 6, Atlantis 10)
let c3=(await sv()).coins; await page.evaluate(()=>window.__V.startBlocks(22)); await page.evaluate(()=>window.__V.blocksSolve()); await page.waitForTimeout(150);
check('camelot_slot_pays_6', (await sv()).coins-c3===6);
c3=(await sv()).coins; await page.evaluate(()=>window.__V.startBlocks(84)); await page.evaluate(()=>window.__V.blocksSolve()); await page.waitForTimeout(150);
check('atlantis_slot_pays_10', (await sv()).coins-c3===10);
// odd -> plain next; L10 -> boss
await page.evaluate(()=>window.__V.startLevel(2)); await closeTut(); await play(pack.levels[2].hintPath); await page.waitForTimeout(600);
const n3=await page.textContent('#btn-next');
check('L3_next_plain', !n3.includes('IQ') && !n3.includes('Водопровод'), n3);
await page.evaluate(()=>window.__V.startLevel(9)); await closeTut(); await play(pack.levels[9].hintPath); await page.waitForTimeout(600);
check('L10_next_is_boss', (await page.textContent('#btn-next')).includes('босс'));
await page.click('#btn-next'); await page.waitForTimeout(300);
check('L10_boss_started', (await page.evaluate(()=>window.__V.getState().state))==='boss');

// 3) every puzzle for even levels 2..100: solver + in-game solve; difficulty ramp
const ramp=[]; let prev=null, mono=true, solvedAll=0, gameAll=0, total=0;
for(let lv=2;lv<=100;lv+=2){
  await page.evaluate(l=>window.__V.startBlocks(l),lv);
  const g=await page.evaluate(()=>window.__V.getBlocks());
  total++;
  const sizesOk=g.pieces.every(p=>p.size>=2&&p.size<=5);
  if(solve(g)&&sizesOk) solvedAll++; else check('solver_L'+lv,false,{sizesOk});
  ramp.push({lv,k:g.k,cells:g.cells,pieces:g.nPieces,box:g.w+'x'+g.h,rot:g.rot,iq:g.iq,maxPiece:Math.max(...g.pieces.map(p=>p.size))});
  if(prev&&(g.cells<prev.cells||g.nPieces<prev.nPieces||g.iq<prev.iq)) mono=false;
  prev={cells:g.cells,nPieces:g.nPieces,iq:g.iq};
  // deterministic: same puzzle on restart
  await page.evaluate(()=>window.__V.requestRestart());
  const g2=await page.evaluate(()=>window.__V.getBlocks());
  if(JSON.stringify(g2.target)!==JSON.stringify(g.target)) check('deterministic_L'+lv,false);
  if(g.rot==='all' && g.pieces.every(p=>p.rot===0)) check('rotation_required_L'+lv,false);
  const ok=await page.evaluate(()=>window.__V.blocksSolve());
  const g3=await page.evaluate(()=>window.__V.getBlocks());
  if(ok&&g3.done&&g3.filled) gameAll++; else check('ingame_L'+lv,false,{ok,done:g3.done});
}
check('solver_all_'+total+'_puzzles', solvedAll===total, solvedAll);
check('ingame_debug_placement_wins_all', gameAll===total, gameAll);
check('difficulty_monotone', mono);
check('ramp_start_easy', ramp[0].pieces===3 && ramp[0].cells===10 && ramp[0].rot==='none', ramp[0]);
check('ramp_end_hard', ramp[ramp.length-1].pieces>=9 && ramp[ramp.length-1].cells>=40 && ramp[ramp.length-1].rot==='all', ramp[ramp.length-1]);
console.log('RAMP '+JSON.stringify(ramp.filter((r,i)=>i%5===0||i===ramp.length-1)));
fs.writeFileSync('scripts/blocks_ramp_v480.json',JSON.stringify(ramp,null,1));

// 4) rotation by tap in tray (puzzle #20, level 40)
await page.evaluate(()=>window.__V.startBlocks(40)); await page.waitForTimeout(100);
b=await page.evaluate(()=>window.__V.getBlocks());
const rp=b.pieces[0]; const r0=rp.rot;
await page.mouse.click(rp.tx+rp.cells[0][0]*rp.ts+rp.ts/2, rp.ty+rp.cells[0][1]*rp.ts+rp.ts/2); await page.waitForTimeout(80);
b=await page.evaluate(()=>window.__V.getBlocks());
const r1=b.pieces.find(p=>p.id===rp.id).rot;
check('tap_rotates_tray_piece', b.canRotate && r1===(r0+1)%4 && b.placed===0, {r0,r1});
await page.evaluate(()=>window.__V.startBlocks(96)); await page.waitForTimeout(300);
await page.screenshot({path:'shots/v480_blocks_hard_L96.png'});
// mid-drag screenshot on a mid puzzle: some pieces placed, one in the hand
await page.evaluate(()=>window.__V.startBlocks(30)); await page.waitForTimeout(100);
b=await page.evaluate(()=>window.__V.getBlocks());
await page.evaluate(()=>{const g=window.__V.getBlocks();let n=0;for(let i=0;i<g.nPieces&&n<3;i++){const p=g.pieces[i];window.__V.blocksPlaceCells(i,0,p.sx,p.sy);n++;}});
b=await page.evaluate(()=>window.__V.getBlocks());
let fi=b.pieces.findIndex(p=>!p.placed);
await page.evaluate(i=>window.__V.blocksPlaceCells(i,0,-99,-99),fi); // no-op, keeps rot=0 for the screenshot
b=await page.evaluate(()=>window.__V.getBlocks());
{const p=b.pieces[fi];const a=p.cells[0];const fx=p.tx+(a[0]+0.5)*p.ts,fy=p.ty+(a[1]+0.5)*p.ts;const L=b.layout;const tx=L.x+(p.sx+a[0]+0.5)*L.cs+8,ty=L.y+(p.sy+a[1]+0.5)*L.cs+6;
 await page.mouse.move(fx,fy);await page.mouse.down();await page.mouse.move(tx,ty,{steps:8});await page.waitForTimeout(120);
 await page.screenshot({path:'shots/v480_blocks_middrag_L30.png'});await page.mouse.up();}
b=await page.evaluate(()=>window.__V.getBlocks());
check('middrag_piece_snapped', b.placed===4, b.placed);
// language check
await page.evaluate(()=>window.__V.setLanguagePref('en')); await page.evaluate(()=>window.__V.startBlocks(6)); await page.waitForTimeout(100);
check('en_pill', (await page.textContent('#lvl-pill')).includes('IQ puzzle'));
await page.evaluate(()=>window.__V.setLanguagePref('uk')); await page.evaluate(()=>window.__V.startBlocks(6)); await page.waitForTimeout(100);
check('uk_pill', (await page.textContent('#lvl-pill')).includes('IQ-пазл'));
const fin=await sv(); check('progress_kept', fin.unlocked===30 && fin.worldsPaid.atlantis===1, {u:fin.unlocked});
// migration still works (old save without worldsMigrated)
await seed({unlocked:45,coins:77,stars:{1:2},boosters:{undo:1,flask:1,hint:1},musicOn:false,seenTut:TUT,langPref:'ru'});
const wl=await page.evaluate(()=>window.__V.worlds());
check('migration_intact', wl.find(w=>w.id==='greece').paid && !wl.find(w=>w.id==='japan').paid, wl);
console.log('SUMMARY fails',fails);
await browser.close();server.close();process.exit(fails?1:0);
