import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.ogg':'audio/ogg','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent((req.url||'/').split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.replace(/^\//,''));if(!fp.startsWith(root)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(base+'?v=4.0.5',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__V);
const r=await page.evaluate(async()=>{
  const V=window.__V; V.unlockAudio();
  await new Promise(r=>setTimeout(r,800));
  const out={version:V.VERSION, options:V.POUR_OPTIONS.map(o=>({id:o.id,name:o.name,file:o.file})), plays:[]};
  for(let id=1;id<=5;id++){
    V.setPourSfxId(id);
    V.sfxLog.length=0;
    V.playSfx('pour',0.85);
    await new Promise(r=>setTimeout(r,40));
    out.plays.push({id, log:V.sfxLog.filter(e=>String(e.name).startsWith('pour')), hasBuf:!!(V.sfxBuf['pour_'+id])});
  }
  V.setPourSfxId(0); V.sfxLog.length=0; V.playSfx('pour',0.85);
  out.offLog=V.sfxLog.slice();
  out.defaultId=1;
  return out;
});
fs.mkdirSync('shots/v405',{recursive:true});
fs.writeFileSync('shots/v405/pour-test.json', JSON.stringify(r,null,2));
console.log(JSON.stringify(r,null,2));
await browser.close(); server.close();
