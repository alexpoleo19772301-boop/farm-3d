import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'v406');
fs.mkdirSync(outDir, { recursive: true });
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.css':'text/css'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent((req.url||'/').split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.replace(/^\//,''));if(!fp.startsWith(root)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const sizes=[{w:390,h:844,n:'390x844'},{w:360,h:800,n:'360x800'}];
const langs=['ru','uk','en'];
const saveBase={unlocked:20,coins:500,stars:{},musicOn:false,musicVol:0.4,sfxVol:0.55,vibrateOn:false,trackId:1,pourSfxId:1,
  boosters:{undo:5,flask:2,hint:3},daily:{lastClaim:null,streak:2,lastQuestDay:null,quests:[]},
  seenTut:{basic:1,hidden:1,frozen:1,locked:1},starChests:{},questBadge:false,sfxSoftened:1,sfxBoost404:1};

const issues=[];
for (const lang of langs) {
  for (const sz of sizes) {
    const page=await browser.newPage({viewport:{width:sz.w,height:sz.h},deviceScaleFactor:2});
    await page.goto(base+'?v=4.0.6',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__V && window.I18N);
    await page.evaluate(({s,lang})=>{
      s.langPref=lang;
      localStorage.setItem('vintiki_save_v40',JSON.stringify(s));
    }, {s:saveBase, lang});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__V && window.I18N);
    await page.evaluate((lang)=>window.__V.setLanguagePref(lang), lang);
    await page.waitForTimeout(250);

    // HOME — default boot screen
    await page.evaluate(()=>{
      // clear any leftover inline display
      ['home','map','win','lose','settings','daily','tut'].forEach(s=>{
        const el=document.getElementById('sc-'+s); if(el){ el.style.display=''; el.classList.toggle('on', s==='home'); }
      });
      document.getElementById('hud').style.display='none';
      document.getElementById('boosters').style.display='none';
      window.__V.applyI18nDom();
    });
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(outDir, `${sz.n}-${lang}-home.png`), type:'png'});

    // LEVEL
    await page.evaluate(()=>{
      window.__V.startLevel(0);
      const b=document.getElementById('btn-tut-ok'); if(b) b.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(()=>{
      const b=document.getElementById('btn-tut-ok'); if(b && document.getElementById('sc-tut')?.classList.contains('on')) b.click();
      // ensure play HUD visible, overlays off
      ['home','map','win','lose','settings','daily','tut'].forEach(s=>{
        const el=document.getElementById('sc-'+s); if(el){ el.style.display=''; el.classList.remove('on'); }
      });
      document.getElementById('hud').style.display='block';
      document.getElementById('boosters').style.display='flex';
      window.__V.applyI18nDom();
      if (window.__V.refreshHud) window.__V.refreshHud();
      else {
        // refreshHud not exported — poke pills via setLanguagePref re-apply
        window.__V.setLanguagePref(window.__V.langPref());
      }
    });
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(outDir, `${sz.n}-${lang}-level.png`), type:'png'});

    // SETTINGS
    await page.evaluate(()=>window.__V.openSettings());
    await page.waitForTimeout(400);
    // scroll language list into view if needed
    await page.evaluate(()=>{
      const ll=document.getElementById('lang-list');
      if(ll) ll.scrollIntoView({block:'center'});
      const sc=document.getElementById('sc-settings');
      if(sc) sc.scrollTop = Math.max(0, (sc.scrollHeight - sc.clientHeight) * 0.35);
    });
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(outDir, `${sz.n}-${lang}-settings.png`), type:'png'});

    const check = await page.evaluate((lang)=>{
      const bad=[];
      const cyr=/[А-Яа-яЁё]/;
      document.querySelectorAll('button,h1,h2,label,p,.sub,#logoTitle,.booster,.pill,.track-item').forEach(el=>{
        if(el.offsetParent===null && !el.closest('.screen.on')) return;
        const tx=(el.innerText||el.textContent||'').trim();
        if(!tx) return;
        if(/Русский|Українська|English|Auto|Авто \(гаджет\)|Авто \(пристрій\)|Auto \(device\)|Язык|Мова|Language|★|🪙|v4|♫|🎵|🎁/.test(tx)) return;
        if(lang==='en' && cyr.test(tx)) bad.push({el:el.id||el.className, tx:tx.slice(0,80)});
      });
      document.querySelectorAll('.btn, .booster, .pill, .track-item').forEach(el=>{
        if(!el.closest('.screen.on') && el.offsetParent===null) return;
        if(el.scrollWidth > el.clientWidth + 3) bad.push({overflow:true, el:el.id||el.className, sw:el.scrollWidth, cw:el.clientWidth, tx:(el.innerText||'').slice(0,40)});
      });
      const langItems=[...document.querySelectorAll('#lang-list .track-item')].map(e=>e.innerText.trim());
      return {
        lang: document.documentElement.lang,
        i18nLang: window.I18N.lang,
        play: document.getElementById('btn-play')?.textContent?.trim(),
        settingsTitle: document.querySelector('#sc-settings h1')?.textContent?.trim(),
        langLabel: document.querySelector('[data-i18n="lang_label"]')?.textContent?.trim()
          || [...document.querySelectorAll('#sc-settings label,.sub,h2,p')].find(e=>/Язык|Мова|Language/.test(e.textContent||''))?.textContent?.trim(),
        langItems,
        hudLevel: document.getElementById('lvl-pill')?.textContent?.trim(),
        hudMoves: document.getElementById('moves-pill')?.textContent?.trim(),
        undo: document.getElementById('b-undo')?.innerText?.trim(),
        bad
      };
    }, lang);
    if (check.bad.length) issues.push({lang, size:sz.n, bad:check.bad});
    fs.writeFileSync(path.join(outDir, `${sz.n}-${lang}-meta.json`), JSON.stringify(check,null,2));
    await page.close();
  }
}
await browser.close(); server.close();
fs.writeFileSync(path.join(outDir,'issues.json'), JSON.stringify(issues,null,2));
console.log('issues', JSON.stringify(issues,null,2));
console.log(JSON.stringify(Object.fromEntries(
  langs.flatMap(l=>sizes.map(sz=>{
    const m=JSON.parse(fs.readFileSync(path.join(outDir,`${sz.n}-${l}-meta.json`),'utf8'));
    return [`${sz.n}-${l}`, {lang:m.lang, title:m.settingsTitle, langLabel:m.langLabel, langItems:m.langItems, hud:m.hudLevel, moves:m.hudMoves, undo:m.undo}];
  }))
), null, 2));
