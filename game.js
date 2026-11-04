/* Спасти принцессу: Маджонг v2.1.0 — tiles plug a shaft; pebbles pour when path opens */
'use strict';

const APP_VERSION = { version: '2.1.0', versionCode: 21000, webVersion: '2.1.0' };
const DEFAULT_MANIFEST_URL = localStorage.getItem('farm3d_manifest_url') ||
  ((location.hostname||'').endsWith('github.io')
    ? (location.origin + location.pathname.replace(/\/[^/]*$/, '/') + 'version.json')
    : 'https://alexpoleo19772301-boop.github.io/farm-3d/version.json');
const SAVE_KEY = 'princess_mahjong_v21';
const TRAY_SIZE = 7;
const TILE_IDS = ['flower','star','heart','moon','gem','leaf','sun','butterfly','fish','bird','crown','shell'];
const TILE_LABELS = {flower:'🌸',star:'⭐',heart:'❤️',moon:'🌙',gem:'💎',leaf:'🍃',sun:'☀️',butterfly:'🦋',fish:'🐟',bird:'🐦',crown:'👑',shell:'🐚'};

const CELL = { EMPTY:0, STONE:1, WALL:2, TILE:3 };

const defaultSave = () => ({
  coins:100, muted:false, maxUnlocked:1, stars:{},
  boosters:{undo:5, hint:5, shuffle:5}, totalStars:0
});
let saveData = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));
function persist(){ localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); }

/* ---------- Audio ---------- */
const AudioFX = (() => {
  const cache = {};
  let unlocked=false, muted=false, music=null, musicVol=0.42, sfxVol=0.7, pebbleCD=0;
  function unlock(){
    if(unlocked) return; unlocked=true;
    ['sfx_tap','sfx_pick','sfx_match','sfx_win','sfx_lose','sfx_shuffle','sfx_hint','sfx_undo','sfx_btn','sfx_drop','sfx_star','sfx_pebbles','sfx_pressure','music_theme']
      .forEach(n=>{ const a=new Audio('assets/audio/'+n+'.ogg'); a.preload='auto'; cache[n]=a; });
  }
  function play(name, volScale){
    if(muted||!unlocked) return;
    const a=cache[name]; if(!a) return;
    try{ const c=a.cloneNode(); c.volume=Math.min(1,(name.startsWith('music')?musicVol:sfxVol)*(volScale||1)); c.play().catch(()=>{}); }catch(e){}
  }
  function pebbles(intensity){
    if(muted||!unlocked) return;
    const now=performance.now();
    if(now<pebbleCD) return;
    pebbleCD=now + (intensity>0.4?180:320);
    play('sfx_pebbles', 0.25+0.5*Math.min(1,intensity||0.4));
  }
  function startMusic(){
    if(!unlocked) return;
    if(!music){ music=new Audio('assets/audio/music_theme.ogg'); music.loop=true; }
    music.volume=muted?0:musicVol; music.play().catch(()=>{});
  }
  function setMuted(m){ muted=m; if(music) music.volume=m?0:musicVol; }
  return { unlock, play, pebbles, startMusic, setMuted, get muted(){return muted;} };
})();

/* ---------- Level config ---------- */
function levelConfig(n){
  const types=Math.min(12, 4+Math.floor((n-1)/3));
  const cols=n<4?4:(n<12?5:6);
  const rows=Math.min(8, 3+Math.floor(n/2));
  let count=cols*rows;
  const holeChance=n<5?0.06:(n<15?0.12:0.16);
  count=Math.floor(count*(1-holeChance));
  count-=count%3;
  if(count<types*3) count=types*3;
  const stoneBudget=Math.min(720, 220 + n*12);
  const spawnRate=0.12 + n*0.022; // slower early pressure
  const fillMax=Math.min(0.93, 0.78 + n*0.004); // chamber full ratio → lose
  const drainGoal=Math.floor(stoneBudget*(n<4?0.48:0.42));
  return {level:n, types, cols, rows, count, stoneBudget, spawnRate, fillMax, buryLimit:Math.floor(fillMax*100), drainGoal, name:'Этаж '+n};
}
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------- Sand grid ---------- */
const Sand = {
  cols:0, rows:0, cell:8,
  ox:0, oy:0, // pixel origin
  grid:null,
  colors:null,
  drained:0,
  moved:0,
  init(cols, rows, cell, ox, oy){
    this.cols=cols; this.rows=rows; this.cell=cell; this.ox=ox; this.oy=oy;
    this.grid=new Uint8Array(cols*rows);
    this.colors=new Uint8Array(cols*rows);
    this.drained=0; this.moved=0;
  },
  idx(c,r){ return r*this.cols+c; },
  get(c,r){ if(c<0||r<0||c>=this.cols||r>=this.rows) return CELL.WALL; return this.grid[this.idx(c,r)]; },
  set(c,r,v){ if(c<0||r<0||c>=this.cols||r>=this.rows) return; this.grid[this.idx(c,r)]=v; },
  fillRect(c0,r0,w,h,v, color){
    for(let r=r0;r<r0+h;r++) for(let c=c0;c<c0+w;c++){
      if(c>=0&&r>=0&&c<this.cols&&r<this.rows){
        const i=this.idx(c,r); this.grid[i]=v;
        if(v===CELL.STONE) this.colors[i]=color!=null?color:(Math.random()*8)|0;
      }
    }
  },
  countInRect(c0,r0,w,h,v){
    let n=0;
    for(let r=r0;r<r0+h;r++) for(let c=c0;c<c0+w;c++){
      if(this.get(c,r)===v) n++;
    }
    return n;
  },
  countAll(v){
    let n=0; for(let i=0;i<this.grid.length;i++) if(this.grid[i]===v) n++; return n;
  },
  clearTileCells(tileCells){
    for(const {c,r} of tileCells){
      if(this.get(c,r)===CELL.TILE || this.get(c,r)===CELL.WALL) this.set(c,r, CELL.EMPTY);
      // open tiny seams around cleared tile so flow starts
      for(const [dc,dr] of [[0,1],[0,-1],[1,0],[-1,0]]){
        const v=this.get(c+dc,r+dr);
        if(v===CELL.WALL) this.set(c+dc,r+dr, CELL.EMPTY);
      }
    }
  },
  markTileCells(tileCells){
    for(const {c,r} of tileCells){
      if(this.get(c,r)!==CELL.STONE) this.set(c,r, CELL.TILE);
    }
  },
  spawnTop(n){
    let added=0;
    for(let i=0;i<n;i++){
      const c=(Math.random()*this.cols)|0;
      // find first empty from top in column
      for(let r=0;r<Math.min(8,this.rows);r++){
        if(this.get(c,r)===CELL.EMPTY){
          this.set(c,r,CELL.STONE);
          this.colors[this.idx(c,r)]=(Math.random()*8)|0;
          added++; break;
        }
      }
    }
    return added;
  },
  step(){
    // Falling sand bottom-up; track moves for SFX
    this.moved=0;
    const cols=this.cols, rows=this.rows, g=this.grid, colr=this.colors;
    for(let r=rows-2;r>=0;r--){
      // alternate scan direction to reduce bias
      const leftFirst = ((r + (performance.now()/16|0)) & 1)===0;
      for(let k=0;k<cols;k++){
        const c = leftFirst ? k : (cols-1-k);
        const i=r*cols+c;
        if(g[i]!==CELL.STONE) continue;
        // down
        const below=i+cols;
        if(g[below]===CELL.EMPTY){
          g[below]=CELL.STONE; colr[below]=colr[i];
          g[i]=CELL.EMPTY; this.moved++; continue;
        }
        // diagonal
        const dir = Math.random()<0.5?-1:1;
        let fell=false;
        for(const d of [dir,-dir]){
          const nc=c+d;
          if(nc<0||nc>=cols) continue;
          const di=below+d;
          if(g[di]===CELL.EMPTY){
            // also require side empty-ish for squeeze
            g[di]=CELL.STONE; colr[di]=colr[i];
            g[i]=CELL.EMPTY; this.moved++; fell=true; break;
          }
        }
        if(fell) continue;
      }
    }
    // Drain: stones in last 2 rows disappear into pit
    for(let r=rows-2;r<rows;r++){
      for(let c=0;c<cols;c++){
        const i=r*cols+c;
        if(g[i]===CELL.STONE){
          g[i]=CELL.EMPTY; this.drained++; this.moved++;
        }
      }
    }
  }
};

/* ---------- Build level ---------- */
function buildLevel(n){
  const cfg=levelConfig(n);
  const rnd=mulberry32(n*9973+42);
  const typePool=TILE_IDS.slice(0,cfg.types);
  const bag=[];
  for(let g=0;g<cfg.count/3;g++){ const t=typePool[g%typePool.length]; bag.push(t,t,t); }
  for(let i=bag.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const tmp=bag[i]; bag[i]=bag[j]; bag[j]=tmp; }

  // channel layout slots for tiles — plug in lower-mid shaft
  const slots=[];
  for(let r=0;r<cfg.rows;r++) for(let c=0;c<cfg.cols;c++){
    // varied shapes: leave side gaps / checker on higher
    if(cfg.level>=6 && (c+r*3)%11===0) continue;
    if(cfg.level>=14 && c===0 && r%2===0) continue;
    if(cfg.level>=20 && r===cfg.rows-1 && c%2===1) continue;
    slots.push({c,r});
  }
  for(let i=slots.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const tmp=slots[i]; slots[i]=slots[j]; slots[j]=tmp; }
  const used=slots.slice(0, Math.min(cfg.count, slots.length));
  while(used.length<cfg.count){
    used.push({c:used.length%cfg.cols, r:((used.length/cfg.cols)|0)%cfg.rows});
  }
  used.length=cfg.count;

  const tiles=used.map((s,i)=>({
    id:i, type:bag[i], c:s.c, r:s.r, alive:true,
    x:0,y:0, scale:1, alpha:1, shake:0, highlight:0,
    cells:[] // sand cells occupied
  }));
  return {cfg, tiles};
}

/* ---------- Game ---------- */
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d',{alpha:false});
let W=0,H=0,dpr=1;
let screen='intro';
let levelNum=1, level=null, tray=[], history=[];
let anims=[], hintIds=[], particles=[];
let lastTs=0, spawnAcc=0, ended=false;
let princessMood='ok'; // ok | scared | happy
let layout={ tileW:56, tileH:62, ox:0, oy:0, gap:3 };
let princessZone={c0:0,r0:0,w:0,h:0};
let bgImg=null, princessImg=null, princessWinImg=null, princessScaredImg=null;
const tileImgs={}, pebbleImgs=[];
let assetsReady=false;

function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),2200);
}

function loadAssets(){
  const jobs=[];
  const load=(src,assign)=>{
    jobs.push(new Promise(res=>{ const im=new Image(); im.onload=()=>{assign(im);res();}; im.onerror=()=>res(); im.src=src; }));
  };
  load('assets/sprites/tower_bg.webp', im=>bgImg=im);
  load('assets/sprites/princess.webp', im=>princessImg=im);
  load('assets/sprites/princess_win.webp', im=>princessWinImg=im);
  load('assets/sprites/princess_scared.webp', im=>princessScaredImg=im);
  TILE_IDS.forEach(id=>load('assets/sprites/tiles/'+id+'.webp', im=>tileImgs[id]=im));
  for(let i=0;i<8;i++) load('assets/sprites/pebbles/g'+i+'.webp', im=>pebbleImgs[i]=im);
  for(let i=0;i<16;i++) load('assets/sprites/pebbles/p'+i+'.webp', im=>{ if(im) pebbleImgs.push(im); });
  return Promise.all(jobs).then(()=>{ assetsReady=true; });
}

function resize(){
  const rect=document.getElementById('app').getBoundingClientRect();
  dpr=Math.min(2.25, window.devicePixelRatio||1);
  W=rect.width; H=rect.height;
  canvas.width=Math.floor(W*dpr); canvas.height=Math.floor(H*dpr);
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(level) setupWorldGeometry();
}
window.addEventListener('resize', resize);

function setupWorldGeometry(){
  if(!level) return;
  const {cols, rows}=level.cfg;
  const topPad=64, bottomPad=200, sidePad=16;
  const availW=W-sidePad*2;
  const availH=H-topPad-bottomPad;

  const sandCols=Math.max(cols*4, 28);
  const sandRows=Math.max(56, Math.min(80, (availH/7)|0));
  const cell=Math.max(5, Math.min(10, Math.floor(Math.min(availW/sandCols, availH/sandRows))));
  const chanW=sandCols*cell;
  const chanH=sandRows*cell;
  const ox=(W-chanW)/2;
  const oy=topPad + Math.max(4, (availH-chanH)/2);

  Sand.init(sandCols, sandRows, cell, ox, oy);
  Sand.grid.fill(CELL.EMPTY);

  // Tile plug in MID shaft — princess stands ON TOP of it; stones press from above
  const plugRows = Math.min(rows, Math.max(3, Math.floor(sandRows*0.34)));
  const thCells = Math.max(3, Math.floor((sandRows*0.36)/Math.max(1,rows)));
  const twCells = Math.max(3, Math.floor(sandCols/cols) - 1);
  // Seal plug tightly so stones only drain through CLEARED tiles
  const gapC = Math.max(0, Math.floor((sandCols - cols*twCells)/2)); // side margins only
  const gapR = 0;
  const plugTop = Math.floor(sandRows*0.38); // tiles start here
  const plugH = rows*(thCells+gapR);

  layout.tileW = twCells*cell - 2;
  layout.tileH = thCells*cell - 2;
  layout.gap = gapC*cell;
  layout.ox = ox; layout.oy = oy;

  level.tiles.forEach(t=>{
    const sc = gapC + t.c*twCells;
    const sr = plugTop + t.r*thCells;
    t.cells=[];
    for(let rr=0;rr<thCells;rr++) for(let cc=0;cc<twCells;cc++){
      const cc2=sc+cc, rr2=sr+rr;
      if(cc2>=0&&rr2>=0&&cc2<sandCols&&rr2<sandRows) t.cells.push({c:cc2,r:rr2});
    }
    t.x = ox + sc*cell;
    t.y = oy + sr*cell;
    t.tw = twCells*cell;
    t.th = thCells*cell;
  });
  rematerializeTiles();

  // Seal FULL plug band (including side bypasses) so stones only pass via cleared tiles
  {
    const plugBottom = plugTop + rows*thCells;
    for(let r=plugTop;r<Math.min(plugBottom,sandRows);r++){
      for(let c=0;c<sandCols;c++){
        if(Sand.get(c,r)===CELL.EMPTY) Sand.set(c,r, CELL.WALL);
      }
    }
  }
  rematerializeTiles();

  // Headroom / princess zone: rows just ABOVE the plug (stones pile here)
  const headH = Math.max(5, Math.floor(sandRows*0.10));
  const pzR0 = Math.max(0, plugTop - headH);
  princessZone={c0:0, r0:pzR0, w:sandCols, h:headH};

  // Pre-fill stones ABOVE the plug only (not through tiles)
  const fillBottom = pzR0 + headH; // top of tiles
  let stones=0;
  for(let r=0;r<fillBottom;r++){
    for(let c=0;c<sandCols;c++){
      // leave a small air pocket near center for princess silhouette early on
      const cx=sandCols/2, dist=Math.abs(c-cx)/sandCols;
      const dens = r < fillBottom*0.55 ? 0.72 : (0.42 + dist*0.22);
      if(Math.random() < dens){
        if(level.cfg.level<=5 && r>=pzR0 && dist<0.18) continue;
        Sand.set(c,r,CELL.STONE);
        Sand.colors[Sand.idx(c,r)]=(Math.random()*8)|0;
        stones++;
      }
    }
  }
  while(stones>level.cfg.stoneBudget){
    const c=(Math.random()*sandCols)|0, r=(Math.random()*fillBottom)|0;
    if(Sand.get(c,r)===CELL.STONE){ Sand.set(c,r,CELL.EMPTY); stones--; }
  }
  // ensure tiles solid again after fill
  rematerializeTiles();
}

function rematerializeTiles(){
  // Clear old TILE cells that are not stone
  for(let i=0;i<Sand.grid.length;i++){
    if(Sand.grid[i]===CELL.TILE) Sand.grid[i]=CELL.EMPTY;
  }
  for(const t of level.tiles){
    if(!t.alive) continue;
    for(const {c,r} of t.cells){
      if(Sand.get(c,r)===CELL.STONE){
        // stone trapped inside tile footprint — push stone up if possible else delete into pressure
        Sand.set(c,r,CELL.TILE);
      } else {
        Sand.set(c,r,CELL.TILE);
      }
    }
  }
}

function isFree(tile){
  if(!tile.alive) return false;
  // free if no other alive tile "covers" — for flat plug, all alive are free (casual)
  // optional: blocked if completely surrounded — keep simple: all alive tappable
  return true;
}

/* ---------- Screens ---------- */
function showOverlay(id,on){
  const el=document.getElementById(id); if(!el) return;
  if(on) el.classList.remove('hidden'); else el.classList.add('hidden');
}
function setScreen(name){
  screen=name;
  document.getElementById('screen-intro').style.display=name==='intro'?'flex':'none';
  document.getElementById('screen-map').classList.toggle('show', name==='map');
  showOverlay('screen-win', name==='win');
  showOverlay('screen-lose', name==='lose');
  const playing=name==='play';
  document.getElementById('hud').style.display=playing?'flex':'none';
  document.getElementById('boosts').style.display=playing?'flex':'none';
  document.getElementById('ver-label').style.display=playing?'none':'block';
  if(name==='map') renderMap();
  updateHUD();
}
function renderMap(){
  const grid=document.getElementById('map-grid'); grid.innerHTML='';
  let sum=0;
  for(let i=1;i<=36;i++){
    const st=saveData.stars[i]||0; sum+=st;
    const unlocked=i<=saveData.maxUnlocked;
    const div=document.createElement('div');
    div.className='lvl'+(unlocked?'':' lock')+(st?' done':'');
    div.innerHTML=(unlocked?i:'🔒')+'<div class="stars">'+(st?('⭐'.repeat(st)):'')+'</div>';
    if(unlocked) div.onclick=()=>startLevel(i);
    grid.appendChild(div);
  }
  saveData.totalStars=sum;
  document.getElementById('map-coins').textContent=saveData.coins;
  document.getElementById('map-stars').textContent=sum;
  document.getElementById('map-mute').textContent=saveData.muted?'🔇':'🔊';
  persist();
}
function chamberFill(){
  if(!level||!Sand.cols) return 0;
  const z=princessZone; // rows above plug
  const top=z.r0+z.h; // plug top row
  let stones=0, cap=0;
  for(let r=0;r<top;r++){
    for(let c=0;c<Sand.cols;c++){
      const v=Sand.get(c,r);
      if(v===CELL.TILE||v===CELL.WALL) continue;
      cap++;
      if(v===CELL.STONE) stones++;
    }
  }
  return cap? stones/cap : 0;
}
function updateHUD(){
  document.getElementById('hud-level').textContent=levelNum;
  document.getElementById('hud-coins').textContent=saveData.coins;
  document.getElementById('btn-mute').textContent=saveData.muted?'🔇':'🔊';
  document.getElementById('c-undo').textContent=saveData.boosters.undo;
  document.getElementById('c-hint').textContent=saveData.boosters.hint;
  document.getElementById('c-shuffle').textContent=saveData.boosters.shuffle;
  document.getElementById('ver-label').textContent='v'+APP_VERSION.version;
  if(level){
    const pct=Math.min(100, Math.round(100*chamberFill()));
    document.getElementById('hud-stones').textContent=pct;
    const danger=document.getElementById('hud-danger');
    if(pct>=Math.round(level.cfg.fillMax*100)-8) danger.classList.add('warn'); else danger.classList.remove('warn');
  }
}

function startLevel(n){
  AudioFX.unlock(); AudioFX.startMusic();
  levelNum=n; level=buildLevel(n);
  tray=[]; history=[]; hintIds=[]; particles=[]; anims=[];
  ended=false; spawnAcc=0; princessMood='ok'; window.__buryPeak=0;
  setupWorldGeometry();
  level.tiles.forEach((t,i)=>{
    t.alpha=0; t.scale=0.6;
    anims.push({type:'spawn', id:t.id, t:0, dur:240+i*6, fromA:0, toA:1, fromS:0.6, toS:1});
  });
  setScreen('play');
  AudioFX.play('sfx_btn');
}

/* ---------- Gameplay ---------- */
function snapshot(){
  return {
    tiles: level.tiles.map(t=>({id:t.id,type:t.type,c:t.c,r:t.r,alive:t.alive})),
    tray: tray.map(t=>t.id),
    // sand snapshot compressed: only copy grid (ok ~ few KB)
    grid: Sand.grid.slice(0),
    colors: Sand.colors.slice(0),
    drained: Sand.drained
  };
}
function restore(snap){
  const by={}; level.tiles.forEach(t=>by[t.id]=t);
  snap.tiles.forEach(s=>{ const t=by[s.id]; if(t) Object.assign(t,{type:s.type,c:s.c,r:s.r,alive:s.alive,alpha:s.alive?1:0,scale:1}); });
  tray=snap.tray.map(id=>by[id]).filter(Boolean);
  Sand.grid.set(snap.grid); Sand.colors.set(snap.colors); Sand.drained=snap.drained;
  rematerializeTiles();
  // refresh tile pixel pos
  setupWorldGeometryPositionsOnly();
}
function setupWorldGeometryPositionsOnly(){
  // lightweight: recompute tile x,y from cells without resetting sand
  if(!level) return;
  for(const t of level.tiles){
    if(!t.cells.length) continue;
    const c0=t.cells[0].c, r0=t.cells[0].r;
    t.x=Sand.ox + c0*Sand.cell;
    t.y=Sand.oy + r0*Sand.cell;
  }
}

function pickTile(tile){
  if(screen!=='play'||ended||!tile||!tile.alive) return;
  if(!isFree(tile)){ tile.shake=1; AudioFX.play('sfx_tap',0.5); return; }
  if(tray.length>=TRAY_SIZE){ AudioFX.play('sfx_tap'); return; }

  history.push(snapshot());
  if(history.length>20) history.shift();

  tile.alive=false;
  // open path: clear tile cells in sand
  Sand.clearTileCells(tile.cells);

  let insertAt=tray.length;
  for(let i=tray.length-1;i>=0;i--){ if(tray[i].type===tile.type){ insertAt=i+1; break; } }
  tray.splice(insertAt,0,tile);
  AudioFX.play('sfx_pick');
  hintIds=[];

  // match-3
  const counts={}; tray.forEach(t=>{ counts[t.type]=(counts[t.type]||0)+1; });
  const matchType=Object.keys(counts).find(k=>counts[k]>=3);
  if(matchType){
    let removed=0; const gone=[];
    tray=tray.filter(t=>{
      if(t.type===matchType && removed<3){ gone.push(t); removed++; return false; }
      return true;
    });
    gone.forEach(t=>{
      particles.push({x:t.tx||W/2,y:H-160,life:1,color:'#ffd54f'});
    });
    AudioFX.play('sfx_match');
    AudioFX.play('sfx_drop',0.5);
  }

  if(tray.length>=TRAY_SIZE){
    const c2={}; tray.forEach(t=>c2[t.type]=(c2[t.type]||0)+1);
    if(!Object.values(c2).some(v=>v>=3)){
      // tray full — not instant lose; stones still threaten. Soft: force lose only if also buried soon.
      toast('Лоток полон! Отмена или микс');
    }
  }
}

function winLevel(){
  if(ended) return; ended=true; princessMood='happy';
  AudioFX.play('sfx_win');
  let stars=3;
  const buryPeak = window.__buryPeak||0;
  if(buryPeak > level.cfg.fillMax*0.85) stars=2;
  if(buryPeak > level.cfg.fillMax*0.93) stars=1;
  stars=Math.max(1,stars);
  const prev=saveData.stars[levelNum]||0;
  if(stars>prev){ saveData.coins+=(stars-prev)*20+30; saveData.stars[levelNum]=stars; }
  else saveData.coins+=15;
  if(levelNum>=saveData.maxUnlocked) saveData.maxUnlocked=Math.min(36, levelNum+1);
  if(stars===3){ saveData.boosters.hint++; saveData.boosters.shuffle++; }
  persist();
  document.getElementById('win-stars').textContent='⭐'.repeat(stars)+'☆'.repeat(3-stars);
  document.getElementById('win-msg').textContent=stars===3?'Идеально! Камни ухнули вниз!':(stars===2?'Путь открыт, можно чище.':'Спасена! В следующий раз быстрее.');
  setTimeout(()=>setScreen('win'), 450);
  AudioFX.play('sfx_star');
}
function loseLevel(reason){
  if(ended) return; ended=true; princessMood='scared';
  AudioFX.play('sfx_lose');
  document.getElementById('lose-msg').textContent=reason||'Камни завалили принцессу. Открывай сток быстрее!';
  document.getElementById('lose-princess').src='assets/sprites/princess_scared.webp';
  setTimeout(()=>setScreen('lose'), 500);
}

function boosterUndo(){
  if(saveData.boosters.undo<=0){ toast('Нет отмен'); return; }
  if(!history.length){ toast('Нечего отменять'); return; }
  saveData.boosters.undo--; restore(history.pop()); persist(); updateHUD(); AudioFX.play('sfx_undo');
}
function boosterHint(){
  if(saveData.boosters.hint<=0){ toast('Нет подсказок'); return; }
  const free=level.tiles.filter(t=>t.alive);
  if(!free.length){ toast('Плиток не осталось'); return; }
  const trayTypes=new Set(tray.map(t=>t.type));
  let best=free.find(t=>trayTypes.has(t.type))||free[0];
  const by={}; free.forEach(t=>{(by[t.type]=by[t.type]||[]).push(t);});
  const pair=Object.values(by).find(a=>a.length>=2);
  if(pair) best=pair[0];
  saveData.boosters.hint--; persist(); updateHUD();
  hintIds=[best.id]; best.highlight=1; AudioFX.play('sfx_hint'); toast('Подсказка подсвечена');
}
function boosterShuffle(){
  if(saveData.boosters.shuffle<=0){ toast('Нет перемешиваний'); return; }
  history.push(snapshot());
  const alive=level.tiles.filter(t=>t.alive);
  const types=alive.map(t=>t.type);
  for(let i=types.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=types[i]; types[i]=types[j]; types[j]=tmp; }
  alive.forEach((t,i)=>t.type=types[i]);
  saveData.boosters.shuffle--; persist(); updateHUD(); hintIds=[]; AudioFX.play('sfx_shuffle');
}

/* ---------- Input ---------- */
function tileAt(x,y){
  if(!level) return null;
  for(let i=level.tiles.length-1;i>=0;i--){
    const t=level.tiles[i];
    if(!t.alive) continue;
    if(x>=t.x && x<=t.x+(t.tw||layout.tileW) && y>=t.y && y<=t.y+(t.th||layout.tileH)) return t;
  }
  return null;
}
canvas.addEventListener('pointerdown', e=>{
  if(screen!=='play'||ended) return;
  const rect=canvas.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  const t=tileAt(x,y);
  if(t) pickTile(t);
});

/* ---------- Draw ---------- */
function roundRect(x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
function drawBg(){
  if(bgImg){
    const scale=Math.max(W/bgImg.width, H/bgImg.height);
    const bw=bgImg.width*scale, bh=bgImg.height*scale;
    ctx.drawImage(bgImg,(W-bw)/2,(H-bh)/2,bw,bh);
    // vignette for depth
    const g=ctx.createRadialGradient(W*0.5,H*0.35,W*0.1,W*0.5,H*0.5,W*0.85);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(10,0,20,0.45)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  } else {
    ctx.fillStyle='#1a0f2e'; ctx.fillRect(0,0,W,H);
  }
  // channel shade
  if(Sand.cols){
    ctx.fillStyle='rgba(0,0,0,0.28)';
    roundRect(Sand.ox-6, Sand.oy-6, Sand.cols*Sand.cell+12, Sand.rows*Sand.cell+12, 14);
    ctx.fill();
  }
}
function drawSand(){
  const cell=Sand.cell, ox=Sand.ox, oy=Sand.oy;
  const g=Sand.grid, cols=Sand.cols, rows=Sand.rows;
  // draw stones only
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const i=r*cols+c;
      if(g[i]!==CELL.STONE) continue;
      const x=ox+c*cell, y=oy+r*cell;
      const img=pebbleImgs[Sand.colors[i]%pebbleImgs.length];
      const s=cell*1.15;
      if(img){
        ctx.drawImage(img, x+cell/2-s/2, y+cell/2-s/2, s, s);
      } else {
        ctx.fillStyle=['#7a5cff','#5a7dff','#a050e0','#6a90ff'][Sand.colors[i]%4];
        ctx.beginPath(); ctx.arc(x+cell/2,y+cell/2,cell*0.42,0,Math.PI*2); ctx.fill();
      }
    }
  }
}
function drawTile(t){
  const w=t.tw||layout.tileW, h=t.th||layout.tileH;
  ctx.save();
  ctx.globalAlpha=t.alpha??1;
  const cx=t.x+w/2, cy=t.y+h/2;
  ctx.translate(cx,cy); ctx.scale(t.scale||1,t.scale||1);
  if(t.shake>0) ctx.translate((Math.random()-0.5)*5*t.shake,0);
  ctx.translate(-w/2,-h/2);
  // soft shadow
  ctx.fillStyle='rgba(0,0,0,0.25)';
  roundRect(2,3,w,h,8); ctx.fill();
  // thin border porcelain
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#fffef8'); grad.addColorStop(1,'#efe6d4');
  ctx.fillStyle=grad;
  roundRect(0,0,w,h,8); ctx.fill();
  ctx.strokeStyle='#d4a84b';
  ctx.lineWidth=1.4;
  roundRect(0.5,0.5,w-1,h-1,8); ctx.stroke();
  const img=tileImgs[t.type];
  const pad=w*0.06;
  if(img){ ctx.drawImage(img, pad, pad, w-pad*2, h-pad*2); }
  else {
    ctx.font=(w*0.4|0)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(TILE_LABELS[t.type]||'?', w/2, h/2);
  }
  if(t.highlight>0 || hintIds.includes(t.id)){
    ctx.globalAlpha=0.5+0.5*Math.sin(performance.now()/120);
    ctx.strokeStyle='#ff4081'; ctx.lineWidth=3;
    roundRect(1,1,w-2,h-2,8); ctx.stroke();
  }
  ctx.restore();
}
function drawPrincess(){
  const z=princessZone;
  const img = princessMood==='scared' ? (princessScaredImg||princessImg)
            : princessMood==='happy' ? (princessWinImg||princessImg)
            : princessImg;
  if(!img || !Sand.cols) return;
  // stand on highest alive tile (top of plug); fallback to zone bottom
  let topY = Sand.oy + (z.r0 + z.h)*Sand.cell;
  let topX = Sand.ox + Sand.cols*Sand.cell/2;
  const alive=level.tiles.filter(t=>t.alive);
  if(alive.length){
    const top=alive.reduce((a,b)=>a.y<b.y?a:b);
    topY=top.y+4; topX=top.x+(top.tw||layout.tileW)/2;
  }
  const threat=chamberFill() / Math.max(0.01, level.cfg.fillMax);
  if(threat>0.82 && princessMood==='ok') princessMood='scared';
  if(threat<0.7 && princessMood==='scared' && !ended) princessMood='ok';
  const ph=Math.min(68, layout.tileH*1.25);
  const pw=ph*(img.width/img.height);
  const bob=Math.sin(performance.now()/280)*2;
  ctx.save();
  if(threat>0.65) ctx.translate((Math.random()-0.5)*3, 0);
  ctx.drawImage(img, topX-pw/2, topY-ph+6+bob, pw, ph);
  ctx.restore();
}
function drawTray(){
  const slotW=Math.min(50,(W-40)/TRAY_SIZE-4);
  const slotH=slotW*1.12;
  const totalW=TRAY_SIZE*(slotW+4)-4;
  const x0=(W-totalW)/2;
  const y0=H-168;
  ctx.fillStyle='rgba(20,8,40,0.85)';
  roundRect(x0-10,y0-12,totalW+20,slotH+24,16); ctx.fill();
  ctx.strokeStyle='#ce93d8'; ctx.lineWidth=2;
  roundRect(x0-10,y0-12,totalW+20,slotH+24,16); ctx.stroke();
  for(let i=0;i<TRAY_SIZE;i++){
    const x=x0+i*(slotW+4);
    ctx.fillStyle='rgba(255,255,255,0.08)';
    roundRect(x,y0,slotW,slotH,8); ctx.fill();
  }
  tray.forEach((t,i)=>{
    const x=x0+i*(slotW+4);
    t.tx=x+slotW/2; t.ty=y0+slotH/2;
    const fake={type:t.type,alpha:1,scale:1,shake:0,highlight:0,x,y:y0,tw:slotW,th:slotH};
    drawTile(fake);
  });
}
function drawParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.life-=dt/550; p.y-=50*dt/1000;
    if(p.life<=0){ particles.splice(i,1); continue; }
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color||'#fff';
    ctx.beginPath(); ctx.arc(p.x,p.y,4+4*(1-p.life),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
}
function tickAnims(dt){
  for(let i=anims.length-1;i>=0;i--){
    const a=anims[i]; a.t+=dt; const u=Math.min(1,a.t/a.dur); const ease=1-Math.pow(1-u,3);
    if(a.type==='spawn'){
      const t=level.tiles.find(x=>x.id===a.id);
      if(t){ t.alpha=a.fromA+(a.toA-a.fromA)*ease; t.scale=a.fromS+(a.toS-a.fromS)*ease; }
    }
    if(u>=1) anims.splice(i,1);
  }
  if(level) for(const t of level.tiles){
    if(t.shake>0) t.shake=Math.max(0,t.shake-dt/250);
    if(t.highlight>0) t.highlight=Math.max(0,t.highlight-dt/1500);
  }
}

function sim(dt){
  if(!level||ended||screen!=='play') return;
  // 2 sand steps per frame for snappier flow
  Sand.step(); Sand.step();
  if(Sand.moved>12) AudioFX.pebbles(Math.min(1, Sand.moved/80));

  // continuous pressure spawn
  spawnAcc += level.cfg.spawnRate * (dt/1000);
  if(spawnAcc>=1){
    const n=Math.min(6, spawnAcc|0);
    spawnAcc-=n;
    Sand.spawnTop(n);
    if(n>=3) AudioFX.play('sfx_pressure', 0.25);
  }

  const fill=chamberFill();
  window.__buryPeak=Math.max(window.__buryPeak||0, fill);
  updateHUD();

  if(fill>=level.cfg.fillMax){
    loseLevel('Галька засыпала принцессу!');
    return;
  }
  if(tray.length>=TRAY_SIZE){
    const c2={}; tray.forEach(t=>c2[t.type]=(c2[t.type]||0)+1);
    if(!Object.values(c2).some(v=>v>=3) && fill>level.cfg.fillMax*0.85){
      if(!pickTile._fullSince) pickTile._fullSince=performance.now();
      else if(performance.now()-pickTile._fullSince>4000){
        loseLevel('Лоток забит — путь не открыть вовремя!');
        return;
      }
    }
  } else pickTile._fullSince=0;

  const stonesLeft=Sand.countAll(CELL.STONE);
  const tilesLeft=level.tiles.filter(t=>t.alive).length;
  if(Sand.drained>=level.cfg.drainGoal && fill < level.cfg.fillMax*0.85){
    winLevel(); return;
  }
  if(tilesLeft===0 && fill < level.cfg.fillMax*0.9 && stonesLeft < level.cfg.stoneBudget*0.3){
    winLevel(); return;
  }
  if(Sand.drained>=level.cfg.stoneBudget*0.7){ winLevel(); return; }
}

function frame(ts){
  const dt=Math.min(40, ts-(lastTs||ts)); lastTs=ts;
  if(screen==='play' && level){
    sim(dt);
    drawBg();
    drawSand();
    // tiles
    for(const t of level.tiles){
      if(t.alive || (t.alpha||0)>0.05) drawTile(t);
    }
    drawPrincess();
    drawTray();
    tickAnims(dt);
    drawParticles(dt);
    // status
    ctx.save();
    ctx.font='bold 12px Trebuchet MS,sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.75)';
    ctx.textAlign='center';
    const left=level.tiles.filter(t=>t.alive).length;
    ctx.fillText(level.cfg.name+' · плиток '+left+' · сток '+Sand.drained+'/'+level.cfg.drainGoal, W/2, H-198);
    ctx.restore();
  } else if(screen==='intro'||screen==='win'||screen==='lose'){
    drawBg();
  }
  requestAnimationFrame(frame);
}

/* ---------- OTA ---------- */
function cmpSemver(a,b){
  const pa=String(a||'0').split('.').map(n=>parseInt(n,10)||0);
  const pb=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<3;i++){ const d=(pa[i]||0)-(pb[i]||0); if(d) return d; } return 0;
}
function getAppUpdatePlugin(){
  try{ const C=window.Capacitor; if(!C) return null;
    if(C.Plugins&&C.Plugins.AppUpdate) return C.Plugins.AppUpdate;
    if(typeof C.registerPlugin==='function') return C.registerPlugin('AppUpdate');
  }catch(e){} return null;
}
async function checkForUpdates(opts){
  opts=opts||{};
  const url=opts.manifestUrl||DEFAULT_MANIFEST_URL;
  if(!url||url.indexOf('PLACEHOLDER')>=0) return {skipped:true};
  let manifest;
  try{
    const res=await fetch(url+(url.indexOf('?')>=0?'&':'?')+'t='+Date.now(),{cache:'no-store',mode:'cors'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    manifest=await res.json();
  }catch(e){ if(!opts.silent) toast('Нет обновлений или нет сети'); return {skipped:true}; }
  const plugin=getAppUpdatePlugin();
  let localCode=APP_VERSION.versionCode, localName=APP_VERSION.version, localWeb=APP_VERSION.webVersion;
  if(plugin&&plugin.getInfo){ try{ const info=await plugin.getInfo(); localCode=info.versionCode||localCode; localName=info.versionName||localName; localWeb=info.webVersion||localWeb; }catch(e){} }
  if(manifest.webBundleUrl && cmpSemver(manifest.webVersion||manifest.version, localWeb)>0){
    if(!opts.silent && confirm((manifest.changelog||'Обновление')+'\n\nОбновить контент игры?')){
      if(plugin&&plugin.downloadAndApplyWebBundle){ await plugin.downloadAndApplyWebBundle({url:manifest.webBundleUrl, webVersion:manifest.webVersion||manifest.version}); location.reload(); }
      else window.open(manifest.webBundleUrl,'_blank');
    }
    return {update:'web'};
  }
  const remoteCode=parseInt(manifest.versionCode,10)||0;
  const need=(remoteCode>localCode)||(cmpSemver(manifest.version,localName)>0);
  if(need&&manifest.apkUrl){
    if(!opts.silent && confirm((manifest.changelog||'Новая версия APK')+'\n\nСкачать и установить?')){
      if(plugin&&plugin.downloadAndInstallApk) await plugin.downloadAndInstallApk({url:manifest.apkUrl});
      else window.open(manifest.apkUrl,'_blank');
    }
    return {update:'apk'};
  }
  if(!opts.silent) toast('У вас актуальная версия v'+localName);
  return {upToDate:true};
}

/* ---------- UI wire ---------- */
document.getElementById('btn-play').onclick=()=>{ AudioFX.unlock(); AudioFX.setMuted(saveData.muted); AudioFX.startMusic(); setScreen('map'); AudioFX.play('sfx_btn'); };
document.getElementById('map-back').onclick=()=>{ setScreen('intro'); AudioFX.play('sfx_btn'); };
document.getElementById('btn-back').onclick=()=>{ setScreen('map'); AudioFX.play('sfx_btn'); };
document.getElementById('btn-next').onclick=()=>{ const next=Math.min(36,levelNum+1); if(next<=saveData.maxUnlocked) startLevel(next); else setScreen('map'); };
document.getElementById('btn-win-map').onclick=()=>setScreen('map');
document.getElementById('btn-retry').onclick=()=>startLevel(levelNum);
document.getElementById('btn-lose-map').onclick=()=>setScreen('map');
document.getElementById('b-undo').onclick=()=>boosterUndo();
document.getElementById('b-hint').onclick=()=>boosterHint();
document.getElementById('b-shuffle').onclick=()=>boosterShuffle();
function toggleMute(){ AudioFX.unlock(); saveData.muted=!saveData.muted; AudioFX.setMuted(saveData.muted); persist(); updateHUD(); document.getElementById('map-mute').textContent=saveData.muted?'🔇':'🔊'; AudioFX.play('sfx_btn'); }
document.getElementById('btn-mute').onclick=toggleMute;
document.getElementById('map-mute').onclick=toggleMute;
document.getElementById('btn-update').onclick=()=>{ AudioFX.unlock(); checkForUpdates({silent:false}); };
document.getElementById('map-update').onclick=()=>{ AudioFX.unlock(); checkForUpdates({silent:false}); };

document.getElementById('ver-label').textContent='v'+APP_VERSION.version;
loadAssets().then(()=>{ resize(); requestAnimationFrame(frame); });
window.addEventListener('load',()=>{ resize(); setTimeout(()=>checkForUpdates({silent:true}).catch(()=>{}),1200); });

window.__PRINCESS__={ APP_VERSION, startLevel, saveData, levelConfig, Sand, get level(){return level;} };
