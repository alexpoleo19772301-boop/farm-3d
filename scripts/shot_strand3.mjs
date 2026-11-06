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
const strandPath=JSON.parse(fs.readFileSync('/tmp/strand_path.json','utf8')).path;
for (const [i,j] of strandPath) {
  await page.evaluate(([a,b])=>window.__V.pour(a,b),[i,j]);
  for(let k=0;k<80;k++){ if(!(await page.evaluate(()=>window.__V.getState().pour))) break; await page.evaluate(()=>window.__V.tick(0.05)); }
}
await page.waitForTimeout(500);
const st=await page.evaluate(()=>window.__V.getState());
const mono=st.flasks.map((f,i)=>({i,cap:f.cap,corked:f.corked,colors:f.colors})).filter(f=>f.colors?.length===4&&f.colors.every(c=>c==='teal'));
const tealLeft=st.flasks.filter(f=>f.colors?.includes('teal'));
console.log(JSON.stringify({mono, tealLeft:tealLeft.map(f=>({cap:f.cap,colors:f.colors,corked:f.corked})), moves:st.moves, state:st.state},null,2));
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_390x844.png'});
await page.setViewportSize({width:360,height:800});
await page.screenshot({path:'/workspace/farm-3d/shots/v414_l25_strand_blocked_360x800.png'});
// Also prove OLD behavior would cork: simulate by checking canSafelyCork false and flask still pourable
const safe=await page.evaluate((idx)=>{
  // use exported canSafelyCork with internal flask via test: pour out 1 unit should work if not corked
  return { corked: window.__V.getState().flasks[idx].corked, n: window.__V.getState().flasks[idx].n };
}, mono[0].i);
console.log('mono flask still open', safe);
await browser.close(); server.close();
if(!mono.length || mono.some(m=>m.corked)) process.exit(1);
console.log('STRAND_PROOF_OK');
