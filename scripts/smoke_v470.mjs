// v4.7.0: harder puzzles (structure, not moves) + 3-star economy gate. Headless Playwright.
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
const root='/workspace/farm-3d/www';
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.slice(1));if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const pack=JSON.parse(fs.readFileSync('www/assets/paint_levels.json','utf8'));
const old=fs.existsSync('/tmp/paint_levels_v460.json')?JSON.parse(fs.readFileSync('/tmp/paint_levels_v460.json','utf8')):null;
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const url=`http://127.0.0.1:${server.address().port}/`;
await page.goto(url);
const TUT={basic:1,moves:1,workshop:1,hidden:1,filter:1,frozen:1,frozenTap:1,lock:1,locked:1,collector:1,timer:1};
const ALLPAID={egypt:1,england:1,greece:1,japan:1,atlantis:1};
async function seed(obj){await page.evaluate(o=>{localStorage.clear();localStorage.setItem('farm3d_cap4_notice','4.7.0');localStorage.setItem('vintiki_save_v40',JSON.stringify(o));},obj);await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__V);}
let fails=0;
const check=(name,ok,data)=>{console.log(ok?'PASS':'FAIL',name,ok?'':JSON.stringify(data??null));if(!ok)fails++;};
const closeTut=()=>page.evaluate(()=>{for(let k=0;k<4;k++){const b=document.getElementById('btn-tut-ok');if(b&&document.getElementById('sc-tut')?.classList.contains('on'))b.click();}});
const play=(steps)=>page.evaluate(p=>{for(const st of p){if(window.__V.getState().state!=='play')break;window.__V.pour(st[0],st[1]);window.__V.tick(2);}},steps);

// 0) static rules on the pack: 4-portion flasks, no mixing, colour counts
for(const [i,l] of pack.levels.entries()){
  const cnt={};for(const f of l.flasks)for(const c of f)cnt[c]=(cnt[c]||0)+1;
  const coll=(l.collector||[]).some(Boolean);
  const capsOk=l.caps.every((c,k)=>(l.collector&&l.collector[k])?c===l.collectorNeed:c===4) && l.flasks.every((f,k)=>f.length<=l.caps[k]);
  const cntOk=Object.entries(cnt).every(([c,n])=>coll&&c===l.collectorColor?n===l.collectorNeed:n===4);
  const noMix=!(l.mixer||[]).some(Boolean);
  const spareOk=l.moveLimit>l.solutionLen;
  if(!(capsOk&&cntOk&&noMix&&spareOk)) check('static_L'+(i+1),false,{capsOk,cntOk,noMix,spareOk,cnt});
  if(old){const o=old.levels[i];const rOld=(o.moveLimit-o.solutionLen)/o.solutionLen,rNew=(l.moveLimit-l.solutionLen)/l.solutionLen;
    if(rNew+1e-9<rOld) check('spare_pct_not_smaller_L'+(i+1),false,{rOld,rNew});}
}
check('static_pack_rules_100',fails===0);

// 1) every level winnable in the REAL game with its witness, inside the move limit, and the witness earns ★★★
await seed({unlocked:100,coins:0,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,seenTut:TUT,langPref:'ru',worldsPaid:ALLPAID,worldsMigrated:1});
let won=0;
for(let id=1;id<=100;id++){
  const L=pack.levels[id-1];
  await page.evaluate(i=>window.__V.startLevel(i),id-1); await closeTut();
  const lim=await page.evaluate(()=>window.__V.getState().moveLimit);
  await play(L.hintPath);
  await page.waitForTimeout(600);
  const g=await page.evaluate(()=>window.__V.getState());
  const stars=(await page.textContent('#win-stars'))||'';
  const ok=g.state==='win'&&g.moves<=lim&&lim===L.moveLimit&&stars.startsWith('★★★');
  if(ok)won++; else check('L'+id+'_win3',false,{state:g.state,moves:g.moves,lim,len:L.hintPath.length,stars});
}
check('all_100_levels_won_with_3stars_in_limit',won===100,won);
const sv1=await page.evaluate(()=>window.__V.getSave());
// coins from a full 3★ run across all 100 levels = sum of tier[3] per world
const ec=await page.evaluate(()=>window.__V.economy());
const exp3=[35,44,53,62,70].reduce((a,b)=>a+b*20,0);
check('coins_for_all_3star_first_time',sv1.coins===exp3,{have:sv1.coins,exp3});

// 2) no farming: replay an already-3★ level -> 0 coins
await page.evaluate(()=>window.__V.startLevel(2)); await closeTut();
const c0=(await page.evaluate(()=>window.__V.getSave())).coins;
await play(pack.levels[2].hintPath); await page.waitForTimeout(600);
const c1=(await page.evaluate(()=>window.__V.getSave())).coins;
check('replay_gives_no_coins',c1===c0,{c0,c1});
check('replay_text', (await page.textContent('#win-coins')).includes('уже получены'));

// 3) economy math
for(const w of ec){ if(w.nextCost==null) continue;
  check('econ_'+w.id+'_all2star_below_next', w.all2<w.nextCost, w);
  check('econ_'+w.id+'_14x3star_below_next', w.earn14<w.nextCost, w);
  check('econ_'+w.id+'_15x3star_reaches_next', w.earn15>=w.nextCost, w);
}
console.log('ECON',JSON.stringify(ec));

// 4) star improvement pays only the difference: 2★ then 3★
await seed({unlocked:30,coins:0,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,seenTut:TUT,langPref:'ru',worldsPaid:ALLPAID,worldsMigrated:1});
await page.evaluate(()=>window.__V.startLevel(24)); await closeTut();
const p25=pack.levels[24].hintPath;
// waste moves first via a pour and its reverse is not always possible: use extra moves by pouring back-and-forth into the empty extra flask
await page.evaluate(()=>{window.__V.getState();}); 
await page.click('#b-flask');
await play(p25); await page.waitForTimeout(600);
const s25=await page.evaluate(()=>window.__V.getSave());
check('booster_caps_at_2star', s25.stars[24]===2 && s25.coins===12, {st:s25.stars[24],coins:s25.coins});
await page.evaluate(()=>window.__V.startLevel(24)); await closeTut();
await play(p25); await page.waitForTimeout(600);
const s25b=await page.evaluate(()=>window.__V.getSave());
check('upgrade_to_3star_pays_difference', s25b.stars[24]===3 && s25b.coins===44, {st:s25b.stars[24],coins:s25b.coins});

// 5) gate: 14 three-star levels not enough even with lots of coins; 15 opens it
const st14={};for(let i=0;i<20;i++)st14[i]=i<14?3:2;
await seed({unlocked:21,coins:5000,stars:st14,boosters:{undo:5,flask:2,hint:3},musicOn:false,seenTut:TUT,langPref:'ru',worldsPaid:{egypt:1},worldsMigrated:1});
await page.evaluate(()=>window.__V.buyWorld('england'));
let wl=await page.evaluate(()=>window.__V.worlds());
check('gate_14x3star_blocks', !wl.find(w=>w.id==='england').paid && (await page.evaluate(()=>window.__V.getSave())).coins===5000);
await page.evaluate(()=>window.__V.startLevel(20)); await page.waitForTimeout(300);
const card=await page.evaluate(()=>{const s=document.querySelector('.world[data-world="england"] .wreq');return s?s.innerText:'';});
check('locked_card_shows_3star_requirement', card.includes('⭐⭐⭐ на 15 из 20')&&card.includes('14/15'), card);
await page.waitForTimeout(3500); await page.evaluate(()=>{document.querySelector('.world[data-world="england"]').scrollIntoView({block:'center'});}); await page.waitForTimeout(250);
await page.screenshot({path:'shots/v470_world_locked_3star.png'});
await page.evaluate(()=>window.__V.setStars({14:3}));
await page.evaluate(()=>window.__V.buyWorld('england'));
wl=await page.evaluate(()=>window.__V.worlds());
const sv5=await page.evaluate(()=>window.__V.getSave());
check('gate_15x3star_opens_and_charges', wl.find(w=>w.id==='england').paid && sv5.coins===5000-670, sv5.coins);
// coins still required
const st15={};for(let i=0;i<20;i++)st15[i]=i<15?3:2;
await seed({unlocked:21,coins:600,stars:st15,boosters:{undo:5,flask:2,hint:3},musicOn:false,seenTut:TUT,langPref:'ru',worldsPaid:{egypt:1},worldsMigrated:1});
await page.evaluate(()=>window.__V.buyWorld('england'));
check('gate_needs_coins_too', !(await page.evaluate(()=>window.__V.worlds())).find(w=>w.id==='england').paid);
// uk / en strings
for(const [lang,needle] of [['uk','з 20'],['en','of 20']]){
  await page.evaluate(l=>window.__V.setLanguagePref(l),lang); await page.evaluate(()=>window.__V.startLevel(20)); await page.waitForTimeout(200);
  const c=await page.evaluate(()=>{const s=document.querySelector('.world[data-world="england"] .wreq');return s?s.innerText:'';});
  check('i18n_'+lang+'_card', c.includes(needle) && !c.includes('world_req'), c);
}

// 6) existing players keep their worlds (migration, no reset)
await page.evaluate(()=>{localStorage.clear();localStorage.setItem('vintiki_save_v40',JSON.stringify({unlocked:45,coins:77,stars:{0:1,1:2,30:1},seenTut:{basic:1}}));});
await page.reload({waitUntil:'networkidle'}); await page.waitForFunction(()=>window.__V);
wl=await page.evaluate(()=>window.__V.worlds());
const sv6=await page.evaluate(()=>window.__V.getSave());
check('migration_keeps_reached_worlds', wl.find(w=>w.id==='england').paid&&wl.find(w=>w.id==='greece').paid&&!wl.find(w=>w.id==='japan').paid&&sv6.unlocked===45&&sv6.coins===77&&sv6.stars[1]===2, {wl,u:sv6.unlocked,c:sv6.coins});
const dflt=await page.evaluate(()=>{localStorage.clear();return 1;});

// 7) pipe pays on first clear only; boss still after 5th, pipe after even
await seed({unlocked:30,coins:0,stars:{},boosters:{undo:9,flask:5,hint:9},musicOn:false,seenTut:TUT,langPref:'ru',worldsPaid:ALLPAID,worldsMigrated:1});
await page.evaluate(()=>window.__V.startLevel(1)); await closeTut();
await play(pack.levels[1].hintPath); await page.waitForTimeout(600);
check('L2_next_is_pipe', (await page.textContent('#btn-next')).includes('Водопровод'));
await page.click('#btn-next'); await page.waitForTimeout(300);
let k0=(await page.evaluate(()=>window.__V.getSave())).coins;
await page.evaluate(()=>window.__V.pipeSolve()); await page.waitForTimeout(400);
let k1=(await page.evaluate(()=>window.__V.getSave())).coins;
check('pipe_first_clear_pays_5', k1-k0===5, {k0,k1});
await page.evaluate(()=>window.__V.startPipe(2)); await page.evaluate(()=>window.__V.pipeSolve()); await page.waitForTimeout(300);
let k2=(await page.evaluate(()=>window.__V.getSave())).coins;
check('pipe_replay_no_coins', k2===k1, {k1,k2});
await page.evaluate(()=>window.__V.startLevel(9)); await closeTut();
await play(pack.levels[9].hintPath); await page.waitForTimeout(600);
check('L10_next_is_boss', (await page.textContent('#btn-next')).includes('босс'));

// 8) hint follows the verified solution on hard boards
await page.evaluate(()=>window.__V.startLevel(85)); await closeTut();
let hintOk=true;
for(let k=0;k<4;k++){const h=await page.evaluate(()=>window.__V.solveHint());const w=pack.levels[85].hintPath[k];if(!h||h.from!==w[0]||h.to!==w[1])hintOk=false;await page.evaluate(s=>{window.__V.pour(s[0],s[1]);window.__V.tick(2);},w);}
check('hint_follows_witness_L86', hintOk);
await page.evaluate(()=>window.__V.startLevel(85)); await closeTut(); await page.waitForTimeout(3500);
await page.screenshot({path:'shots/v470_hard_L86.png'});
await page.evaluate(()=>window.__V.startLevel(59)); await closeTut(); await page.waitForTimeout(3500);
await page.screenshot({path:'shots/v470_hard_L60.png'});

console.log('SUMMARY fails',fails);
await browser.close();server.close();process.exit(fails?1:0);
