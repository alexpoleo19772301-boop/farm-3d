import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = '/workspace/farm-3d/www';
const mime = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.jpg':'image/jpeg'};
const server = http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/') u='/index.html';
  const fp=path.join(root,u.slice(1));
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'octet-stream'});
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const browser=await chromium.launch({args:['--no-sandbox']});
const out={ver:null, tests:[]};
function pass(name, ok, detail){ out.tests.push({name, ok:!!ok, detail}); console.log((ok?'PASS':'FAIL'), name, detail||''); }

async function freshPage(seed){
  const ctx=await browser.newContext();
  const page=await ctx.newPage({viewport:{width:390,height:844}});
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate((seed)=>{
    localStorage.setItem('vintiki_save_v40', JSON.stringify(seed));
    localStorage.setItem('farm3d_test_sentinel', 'keep-me');
    localStorage.setItem('farm3d_cap4_notice', '4.1.7');
    localStorage.setItem('farm3d_manifest_url', 'https://example.test/manifest.json');
  }, seed);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  return {ctx, page};
}

const advanced = {
  unlocked: 42, coins: 9999, stars: {'0':3,'1':3,'24':2,'26':3},
  musicOn: false, musicVol: 0.22, sfxVol: 0.33, vibrateOn: false, trackId: 3, pourSfxId: 4,
  langPref: 'uk', colorBlindMode: true,
  boosters: { undo: 1, flask: 0, hint: 0 },
  daily: { lastClaim: '2099-01-01', streak: 6, lastQuestDay: '2099-01-01', quests: [{id:'x', progress:9, target:9, claimed:true}] },
  seenTut: { basic:1, moves:1, hidden:1, frozen:1, locked:1, collector:1 },
  starChests: { a:1 }, questBadge: true
};

// 1) load alone unchanged
{
  const {ctx,page}=await freshPage(advanced);
  out.ver=await page.evaluate(()=>window.__V.VERSION);
  const s=await page.evaluate(()=>window.__V.getSave());
  pass('load_preserves_advanced', s.unlocked===42 && s.coins===9999 && s.langPref==='uk' && s.musicVol===0.22 && s.pourSfxId===4 && s.colorBlindMode===true && s.boosters.undo===1, JSON.stringify({u:s.unlocked,c:s.coins,lang:s.langPref}));
  await ctx.close();
}

// 2) open settings + tap newgame only opens confirm, no reset
{
  const {ctx,page}=await freshPage(advanced);
  await page.evaluate(()=>window.__V.openSettings());
  await page.click('#btn-newgame');
  const st=await page.evaluate(()=>({state:window.__V.getState().state, save:window.__V.getSave(), title:document.getElementById('confirm-title')?.textContent, sc:document.getElementById('sc-confirm')?.classList.contains('on')}));
  pass('tap_opens_confirm_only', st.sc && st.save.unlocked===42 && st.save.coins===9999, st.title);
  // screenshot button in settings first — reopen
  await page.evaluate(()=>window.__V.cancelRestart());
  await page.evaluate(()=>window.__V.openSettings());
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_btn_390_TEST.png'});
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_btn_360_TEST.png'});
  await page.setViewportSize({width:390,height:844});
  await page.click('#btn-newgame');
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_confirm_390_TEST.png'});
  await ctx.close();
}

// 3) Cancel preserves save + timer resume path
{
  const {ctx,page}=await freshPage(advanced);
  await page.evaluate(()=>{ window.__V.startLevel(26); });
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  // fake timer running
  await page.evaluate(()=>{ const st=window.__V.getState(); /* open settings pauses */ window.__V.openSettings(); });
  const before=await page.evaluate(()=>window.__V.getSave());
  await page.click('#btn-newgame');
  await page.click('#btn-confirm-no');
  const after=await page.evaluate(()=>({save:window.__V.getSave(), scSettings:document.getElementById('sc-settings')?.classList.contains('on')}));
  pass('cancel_preserves', after.save.unlocked===before.unlocked && after.save.coins===before.coins && JSON.stringify(after.save.stars)===JSON.stringify(before.stars) && after.scSettings, 'unlocked '+after.save.unlocked);
  // Done resumes play
  await page.click('#btn-settings-done');
  const st=await page.evaluate(()=>window.__V.getState().state);
  pass('cancel_back_to_play', st==='play', st);
  await ctx.close();
}

// 4) Confirm resets gameplay, keeps prefs + sentinel, durable reload, starts L1
{
  const {ctx,page}=await freshPage(advanced);
  await page.evaluate(()=>window.__V.openSettings());
  await page.click('#btn-newgame');
  await page.click('#btn-confirm-yes');
  await page.waitForTimeout(200);
  let s=await page.evaluate(()=>({save:window.__V.getSave(), state:window.__V.getState(), sentinel:localStorage.getItem('farm3d_test_sentinel'), manifest:localStorage.getItem('farm3d_manifest_url'), notice:localStorage.getItem('farm3d_cap4_notice')}));
  const tut=s.save.seenTut||{};
  pass('confirm_resets_gameplay', s.save.unlocked===1 && s.save.coins===120 && Object.keys(s.save.stars||{}).length===0 && s.save.boosters.undo===5 && s.save.boosters.flask===2 && s.save.boosters.hint===3 && !tut.collector && !tut.frozen && !tut.locked && s.state.levelIdx===0, JSON.stringify({u:s.save.unlocked,c:s.save.coins,lvl:s.state.levelIdx,boost:s.save.boosters,tut}));
  pass('confirm_keeps_prefs', s.save.langPref==='uk' && s.save.musicOn===false && s.save.musicVol===0.22 && s.save.sfxVol===0.33 && s.save.vibrateOn===false && s.save.trackId===3 && s.save.pourSfxId===4 && s.save.colorBlindMode===true, JSON.stringify({lang:s.save.langPref,track:s.save.trackId,pour:s.save.pourSfxId}));
  // version migrate notice may update to current app version; unrelated sentinel+manifest must remain
  pass('confirm_keeps_unrelated', s.sentinel==='keep-me' && s.manifest==='https://example.test/manifest.json', JSON.stringify({sentinel:s.sentinel,manifest:s.manifest,notice:s.notice}));
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_level1_390_TEST.png'});
  // reload durability
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  s=await page.evaluate(()=>({save:window.__V.getSave(), sentinel:localStorage.getItem('farm3d_test_sentinel')}));
  pass('reload_durable_l1', s.save.unlocked===1 && s.save.coins===120 && Object.keys(s.save.stars||{}).length===0 && s.save.langPref==='uk' && s.sentinel==='keep-me', JSON.stringify({u:s.save.unlocked,lang:s.save.langPref}));
  await ctx.close();
}

// 5) stale win race: schedule fake win after dispose shouldn't grant
{
  const {ctx,page}=await freshPage(advanced);
  await page.evaluate(()=>window.__V.startLevel(5));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  // confirm new game while "would win"
  await page.evaluate(()=>window.__V.openSettings());
  await page.click('#btn-newgame');
  await page.click('#btn-confirm-yes');
  await page.waitForTimeout(100);
  // try call end path via tick long after
  await page.evaluate(()=>{ for(let i=0;i<100;i++) window.__V.tick(0.05); });
  const s=await page.evaluate(()=>window.__V.getSave());
  pass('stale_win_no_regrant', s.unlocked===1 && s.coins===120 && Object.keys(s.stars||{}).length===0, JSON.stringify({u:s.unlocked,c:s.coins,stars:s.stars}));
  await ctx.close();
}

// 6) HUD restart still level-only
{
  const {ctx,page}=await freshPage(advanced);
  await page.evaluate(()=>window.__V.startLevel(26));
  await page.evaluate(()=>{const b=document.getElementById('btn-tut-ok'); if(b&&document.getElementById('sc-tut')?.classList.contains('on')) b.click();});
  await page.evaluate(()=>window.__V.pour(0,1));
  await page.evaluate(()=>{ for(let i=0;i<80;i++) window.__V.tick(0.05); });
  await page.click('#btn-restart');
  // may open confirm
  const hasConfirm=await page.evaluate(()=>document.getElementById('sc-confirm')?.classList.contains('on'));
  if(hasConfirm) await page.click('#btn-confirm-yes');
  await page.waitForTimeout(100);
  const s=await page.evaluate(()=>({save:window.__V.getSave(), st:window.__V.getState()}));
  pass('hud_restart_keeps_campaign', s.save.unlocked===42 && s.save.coins===9999 && s.st.levelIdx===26, JSON.stringify({u:s.save.unlocked,lvl:s.st.levelIdx}));
  await ctx.close();
}

// EN/RU string fit shots
{
  const {ctx,page}=await freshPage({...advanced, langPref:'en'});
  await page.evaluate(()=>{ window.__V.setLanguagePref('en'); window.__V.openSettings(); });
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_btn_en_390_TEST.png'});
  await page.click('#btn-newgame');
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_confirm_en_390_TEST.png'});
  await ctx.close();
}
{
  const {ctx,page}=await freshPage({...advanced, langPref:'ru'});
  await page.evaluate(()=>{ window.__V.setLanguagePref('ru'); window.__V.openSettings(); });
  await page.click('#btn-newgame');
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_confirm_ru_360_TEST.png',});
  // resize
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:'/workspace/farm-3d/shots/v418_newgame_confirm_ru_360b_TEST.png'});
  await ctx.close();
}

fs.writeFileSync('scripts/smoke_v418_newgame_out.json', JSON.stringify(out,null,2));
const failed=out.tests.filter(t=>!t.ok);
console.log('VERSION', out.ver);
console.log('RESULT', failed.length? 'FAILED '+failed.length : 'ALL PASS', out.tests.length);
await browser.close(); server.close();
if(failed.length) process.exit(1);
