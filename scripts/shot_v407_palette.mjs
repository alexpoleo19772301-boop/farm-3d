import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'v407');
fs.mkdirSync(outDir, { recursive: true });
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.css':'text/css'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent((req.url||'/').split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.replace(/^\//,''));if(!fp.startsWith(root)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true});

const NAMES={red:'Red / Красный',orange:'Orange / Оранж.',yellow:'Yellow / Жёлтый',green:'Green / Зелёный',teal:'Teal / Бирюза',blue:'Blue / Синий',purple:'Purple / Фиолет.',pink:'Pink / Розовый',brown:'Brown / Коричн.',lime:'Lime / Лайм',indigo:'Indigo / Индиго',coral:'Coral / Коралл'};

// Palette swatch via page canvas
{
  const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:2});
  await page.goto(base+'?v=4.0.7',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V && window.__V.PAINT);
  const buf = await page.evaluate((NAMES)=>{
    const P=window.__V.PAINT;
    const keys=Object.keys(P);
    const c=document.createElement('canvas'); c.width=900; c.height=700;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#140a1c'; ctx.fillRect(0,0,900,700);
    ctx.fillStyle='#fff6ff'; ctx.font='bold 28px sans-serif'; ctx.fillText('Краски v4.0.7 — palette', 28, 44);
    ctx.font='14px sans-serif'; ctx.fillStyle='rgba(255,232,255,0.75)';
    ctx.fillText('CIEDE2000 min ≈ 15.7 · green↔blue ≈ 67 · patterns = color-blind mode', 28, 70);
    const cols=4, rows=3, cellW=200, cellH=180, ox=40, oy=100;
    keys.forEach((k,i)=>{
      const col=i%cols, row=(i/cols)|0;
      const x=ox+col*cellW, y=oy+row*cellH;
      const pal=P[k];
      // swatch
      const g=ctx.createLinearGradient(x,y,x+160,y+100);
      g.addColorStop(0, pal.gloss); g.addColorStop(0.45, pal.fill); g.addColorStop(1, pal.deep);
      ctx.fillStyle=g; roundRect(ctx,x,y,160,100,14); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2; roundRect(ctx,x,y,160,100,14); ctx.stroke();
      // mini pattern preview
      ctx.save(); ctx.beginPath(); roundRect(ctx,x,y,160,100,14); ctx.clip();
      ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=1.6;
      // draw simplified pattern
      const pat=pal.pat;
      if(pat==='hstripes') for(let yy=y+8;yy<y+100;yy+=8){ctx.beginPath();ctx.moveTo(x+6,yy);ctx.lineTo(x+154,yy);ctx.stroke();}
      if(pat==='vstripes') for(let xx=x+10;xx<x+160;xx+=8){ctx.beginPath();ctx.moveTo(xx,y+6);ctx.lineTo(xx,y+94);ctx.stroke();}
      if(pat==='diag') for(let i=-4;i<24;i++){ctx.beginPath();ctx.moveTo(x+i*10,y+100);ctx.lineTo(x+i*10+80,y);ctx.stroke();}
      if(pat==='dots') for(let yy=y+12;yy<y+100;yy+=14) for(let xx=x+12;xx<x+160;xx+=14){ctx.beginPath();ctx.arc(xx,yy,2.2,0,Math.PI*2);ctx.fill();}
      if(pat==='diamonds') for(let yy=y+16;yy<y+100;yy+=18) for(let xx=x+16;xx<x+160;xx+=18){ctx.beginPath();ctx.moveTo(xx,yy-5);ctx.lineTo(xx+5,yy);ctx.lineTo(xx,yy+5);ctx.lineTo(xx-5,yy);ctx.closePath();ctx.stroke();}
      if(pat==='cross') for(let yy=y+14;yy<y+100;yy+=16) for(let xx=x+14;xx<x+160;xx+=16){ctx.beginPath();ctx.moveTo(xx-4,yy);ctx.lineTo(xx+4,yy);ctx.moveTo(xx,yy-4);ctx.lineTo(xx,yy+4);ctx.stroke();}
      if(pat==='chevron') for(let yy=y+12;yy<y+100;yy+=12){ctx.beginPath();ctx.moveTo(x+8,yy+6);ctx.lineTo(x+80,yy);ctx.lineTo(x+152,yy+6);ctx.stroke();}
      if(pat==='rings') for(let yy=y+18;yy<y+100;yy+=22) for(let xx=x+18;xx<x+160;xx+=22){ctx.beginPath();ctx.arc(xx,yy,5,0,Math.PI*2);ctx.stroke();}
      if(pat==='bricks') for(let r=0,yy=y+8;yy<y+100;yy+=12,r++){const off=(r%2)*8; for(let xx=x+4+off;xx<x+160;xx+=18) ctx.strokeRect(xx,yy,16,10);}
      if(pat==='plus') for(let yy=y+16;yy<y+100;yy+=18) for(let xx=x+16;xx<x+160;xx+=18){ctx.beginPath();ctx.moveTo(xx-5,yy);ctx.lineTo(xx+5,yy);ctx.moveTo(xx,yy-5);ctx.lineTo(xx,yy+5);ctx.stroke();}
      if(pat==='tri') for(let yy=y+18;yy<y+100;yy+=18) for(let xx=x+16;xx<x+160;xx+=18){ctx.beginPath();ctx.moveTo(xx,yy-5);ctx.lineTo(xx+5,yy+4);ctx.lineTo(xx-5,yy+4);ctx.closePath();ctx.stroke();}
      if(pat==='waves') for(let yy=y+12;yy<y+100;yy+=10){ctx.beginPath();for(let xx=x+6;xx<=x+154;xx+=3) ctx.lineTo(xx, yy+Math.sin(xx*0.2)*3);ctx.stroke();}
      ctx.restore();
      ctx.fillStyle='#fff6ff'; ctx.font='bold 15px sans-serif';
      ctx.fillText(k, x, y+124);
      ctx.font='12px sans-serif'; ctx.fillStyle='rgba(255,232,255,0.85)';
      ctx.fillText(pal.fill, x, y+142);
      ctx.fillText(NAMES[k]||'', x, y+158);
    });
    function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
    return c.toDataURL('image/png');
  }, NAMES);
  const b64=buf.split(',')[1];
  fs.writeFileSync(path.join(outDir,'palette.png'), Buffer.from(b64,'base64'));
  // also without patterns overlay on swatches — regenerate clean swatches (patterns are for a11y preview, OK to show)
  await page.close();
}

const saveBase={unlocked:60,coins:500,stars:{},musicOn:false,musicVol:0.4,sfxVol:0.55,vibrateOn:false,trackId:1,pourSfxId:1,langPref:'ru',
  boosters:{undo:5,flask:2,hint:3},daily:{lastClaim:null,streak:0,lastQuestDay:null,quests:[]},
  seenTut:{basic:1,hidden:1,frozen:1,locked:1},starChests:{},questBadge:false,sfxSoftened:1,sfxBoost404:1,colorBlindMode:false};

async function shotLevel(name, levelIdx, cb){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.goto(base+'?v=4.0.7',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  await page.evaluate(({s,cb})=>{s.colorBlindMode=!!cb; localStorage.setItem('vintiki_save_v40',JSON.stringify(s));}, {s:saveBase, cb});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__V);
  await page.evaluate((cb)=>window.__V.setColorBlindMode(!!cb), cb);
  await page.evaluate((idx)=>{
    window.__V.startLevel(idx);
    const b=document.getElementById('btn-tut-ok'); if(b) b.click();
    ['home','map','win','lose','settings','daily','tut'].forEach(s=>{
      const el=document.getElementById('sc-'+s); if(el){ el.style.display=''; el.classList.remove('on'); }
    });
    document.getElementById('hud').style.display='block';
    document.getElementById('boosters').style.display='flex';
  }, levelIdx);
  await page.waitForTimeout(600);
  await page.screenshot({path:path.join(outDir, name), type:'png'});
  await page.close();
}

await shotLevel('390x844-level40.png', 40, false);
await shotLevel('390x844-level50.png', 50, false);
await shotLevel('390x844-level40-cb.png', 40, true);
await shotLevel('390x844-level50-cb.png', 50, true);
await shotLevel('390x844-greenblue.png', 30, false); // has green+teal+blue

await browser.close(); server.close();
console.log(fs.readdirSync(outDir).join('\n'));
