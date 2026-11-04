/* Спасти принцессу: Маджонг v2.0.0 — original casual match-3 tray mahjong */
'use strict';

const APP_VERSION = { version: '2.0.0', versionCode: 20000, webVersion: '2.0.0' };
const DEFAULT_MANIFEST_URL = localStorage.getItem('farm3d_manifest_url') ||
  ((location.hostname||'').endsWith('github.io')
    ? (location.origin + location.pathname.replace(/\/[^/]*$/, '/') + 'version.json')
    : 'https://alexpoleo19772301-boop.github.io/farm-3d/version.json');
const SAVE_KEY = 'princess_mahjong_v2';
const TRAY_SIZE = 7;
const TILE_IDS = ['flower','star','heart','moon','gem','leaf','sun','butterfly','fish','bird','crown','shell'];
const TILE_LABELS = {flower:'🌸',star:'⭐',heart:'❤️',moon:'🌙',gem:'💎',leaf:'🍃',sun:'☀️',butterfly:'🦋',fish:'🐟',bird:'🐦',crown:'👑',shell:'🐚'};

/* ---------- Save ---------- */
const defaultSave = () => ({
  coins: 100,
  muted: false,
  musicVol: 0.45,
  sfxVol: 0.7,
  maxUnlocked: 1,
  stars: {},
  boosters: { undo: 5, hint: 5, shuffle: 5 },
  totalStars: 0
});
let saveData = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
function persist(){ localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); }

/* ---------- Audio ---------- */
const AudioFX = (() => {
  const cache = {};
  let unlocked = false, muted = false, music = null, musicVol = 0.45, sfxVol = 0.7;
  function unlock(){
    if(unlocked) return;
    unlocked = true;
    ['sfx_tap','sfx_pick','sfx_match','sfx_win','sfx_lose','sfx_shuffle','sfx_hint','sfx_undo','sfx_btn','sfx_drop','sfx_star','music_theme']
      .forEach(n => { const a = new Audio('assets/audio/'+n+'.ogg'); a.preload='auto'; cache[n]=a; });
  }
  function play(name, volScale){
    if(muted || !unlocked) return;
    let a = cache[name]; if(!a) return;
    try{
      const c = a.cloneNode();
      c.volume = Math.min(1, (name.startsWith('music')?musicVol:sfxVol) * (volScale||1));
      c.play().catch(()=>{});
    }catch(e){}
  }
  function startMusic(){
    if(!unlocked) return;
    if(!music){ music = new Audio('assets/audio/music_theme.ogg'); music.loop = true; }
    music.volume = muted ? 0 : musicVol;
    music.play().catch(()=>{});
  }
  function stopMusic(){ if(music){ music.pause(); } }
  function setMuted(m){ muted=m; if(music) music.volume = m?0:musicVol; }
  function setMusicVol(v){ musicVol=v; if(music&&!muted) music.volume=v; }
  function setSfxVol(v){ sfxVol=v; }
  return { unlock, play, startMusic, stopMusic, setMuted, setMusicVol, setSfxVol, get muted(){return muted;} };
})();

/* ---------- Levels (procedural, solvable) ---------- */
function levelConfig(n){
  // n = 1..N
  const types = Math.min(12, 4 + Math.floor((n-1)/3));           // 4..12
  const cols = n < 4 ? 4 : (n < 12 ? 5 : 6);
  const rows = Math.min(10, 3 + Math.floor((n+1)/2));            // 3..10
  const layers = n < 5 ? 1 : (n < 15 ? 2 : 3);
  // tile count must be multiple of 3
  let slots = cols * rows * layers;
  // leave some empty for interesting shapes on higher levels
  const fill = n < 3 ? 1 : (n < 8 ? 0.92 : 0.85);
  let count = Math.floor(slots * fill);
  count = count - (count % 3);
  if(count < types * 3) count = types * 3;
  const trayWarn = TRAY_SIZE;
  return { level:n, types, cols, rows, layers, count, name: 'Этаж '+n };
}

function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

function buildLevel(n){
  const cfg = levelConfig(n);
  const rnd = mulberry32(n * 9973 + 42);
  const typePool = TILE_IDS.slice(0, cfg.types);
  // Create solvable multiset: groups of 3
  const bag = [];
  const groups = cfg.count / 3;
  for(let g=0; g<groups; g++){
    const t = typePool[g % typePool.length];
    bag.push(t,t,t);
  }
  // Fisher-Yates
  for(let i=bag.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const tmp=bag[i]; bag[i]=bag[j]; bag[j]=tmp; }

  // Build stacked slots: base fill, then extra layers on top of occupied cells
  const base = [];
  for(let r=0;r<cfg.rows;r++) for(let c=0;c<cfg.cols;c++){
    if(cfg.level>=8 && ((c+r)%7===0)) continue; // sparse holes
    base.push({c,r,L:0});
  }
  for(let i=base.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const tmp=base[i]; base[i]=base[j]; base[j]=tmp; }
  const used = [];
  // reserve room for layers: aim ~count tiles
  const baseTake = Math.min(base.length, Math.max(cfg.cols*2, Math.floor(cfg.count * (cfg.layers===1?1:0.62))));
  for(let i=0;i<baseTake;i++) used.push(base[i]);
  let need = cfg.count - used.length;
  for(let L=1; L<cfg.layers && need>0; L++){
    const under = used.filter(s=>s.L===L-1).slice();
    for(let i=under.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const tmp=under[i]; under[i]=under[j]; under[j]=tmp; }
    const take = Math.min(need, Math.max(1, Math.floor(under.length * (L===1?0.55:0.4))));
    for(let i=0;i<take;i++){ used.push({c:under[i].c, r:under[i].r, L}); need--; }
  }
  // if still short, add more base
  let bi = baseTake;
  while(used.length < cfg.count && bi < base.length){ used.push(base[bi++]); }
  while(used.length < cfg.count){
    used.push({c:(used.length)%cfg.cols, r:((used.length/cfg.cols)|0)%cfg.rows, L:0});
  }
  // trim to exact count
  used.length = cfg.count;

  const tiles = used.map((s,i) => ({
    id: i,
    type: bag[i],
    c: s.c, r: s.r, L: s.L,
    alive: true,
    // animation
    x:0,y:0, scale:1, alpha:1, shake:0, highlight:0
  }));
  return { cfg, tiles };
}

/* ---------- Free-tile rules ---------- */
function tilesAt(tiles, c, r, L){
  return tiles.find(t => t.alive && t.c===c && t.r===r && t.L===L);
}
function isCovered(tile, tiles){
  for(const o of tiles){
    if(!o.alive || o.id===tile.id || o.L <= tile.L) continue;
    if(o.c === tile.c && o.r === tile.r) return true;
  }
  return false;
}
function isFree(tile, tiles){
  if(!tile.alive) return false;
  // Casual tray-mahjong: any tile not covered from above is tappable
  return !isCovered(tile, tiles);
}

/* ---------- Game state ---------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W=0, H=0, dpr=1;
let screen = 'intro'; // intro | map | play | win | lose
let levelNum = 1;
let level = null;
let tray = []; // tile refs in tray
let history = [];
let anims = []; // {type, t, dur, ...}
let princessY = 0; // normalized 0=top of stack, 1=bottom
let particles = [];
let hintIds = [];
let layout = { tileW:64, tileH:72, ox:0, oy:0, gapX:4, gapY:4 };
let bgImg=null, princessImg=null, princessWinImg=null;
const tileImgs = {};
let assetsReady = false;
let lastTs = 0;

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>el.classList.remove('show'), 2200);
}

function loadAssets(){
  const jobs = [];
  function load(src, assign){
    jobs.push(new Promise(res => {
      const im = new Image();
      im.onload = ()=>{ assign(im); res(); };
      im.onerror = ()=>res();
      im.src = src;
    }));
  }
  load('assets/sprites/tower_bg.webp', im => bgImg=im);
  load('assets/sprites/princess.webp', im => princessImg=im);
  load('assets/sprites/princess_win.webp', im => princessWinImg=im);
  TILE_IDS.forEach(id => load('assets/sprites/tiles/'+id+'.webp', im => tileImgs[id]=im));
  return Promise.all(jobs).then(()=>{ assetsReady=true; });
}

function resize(){
  const app = document.getElementById('app');
  const rect = app.getBoundingClientRect();
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  W = rect.width; H = rect.height;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  recomputeLayout();
}
window.addEventListener('resize', resize);

function recomputeLayout(){
  if(!level) return;
  const { cols, rows, layers } = level.cfg;
  const topPad = 70, bottomPad = 210, sidePad = 12;
  const availW = W - sidePad*2;
  const availH = H - topPad - bottomPad;
  const tw = Math.min(78, Math.floor(availW / cols) - 4);
  const th = Math.floor(tw * 1.12);
  layout.tileW = tw; layout.tileH = th;
  layout.gapX = Math.max(2, Math.floor((availW - tw*cols) / (cols+1)));
  layout.gapY = Math.max(2, Math.floor(Math.min(8, (availH - th*rows - layers*6) / (rows+1))));
  const gridW = cols*tw + (cols-1)*layout.gapX;
  const gridH = rows*th + (rows-1)*layout.gapY + layers*8;
  layout.ox = (W - gridW)/2;
  layout.oy = topPad + Math.max(10, (availH - gridH)/2);
  // place tiles
  for(const t of level.tiles){
    if(!t.alive && t.alpha<=0) continue;
    t.x = layout.ox + t.c * (tw + layout.gapX) + t.L * 5;
    t.y = layout.oy + t.r * (th + layout.gapY) - t.L * 8;
  }
  updatePrincessTarget();
}

function updatePrincessTarget(){
  if(!level) return;
  const alive = level.tiles.filter(t=>t.alive);
  if(!alive.length){ princessY = 1; return; }
  const minR = Math.min(...alive.map(t=>t.r - t.L*0.3));
  const maxR = level.cfg.rows;
  princessY = Math.max(0, Math.min(1, 1 - (minR+1)/maxR));
}

/* ---------- Screens ---------- */
function showOverlay(id, on){
  const el = document.getElementById(id);
  if(!el) return;
  if(on) el.classList.remove('hidden'); else el.classList.add('hidden');
}
function setScreen(name){
  screen = name;
  document.getElementById('screen-intro').style.display = name==='intro' ? 'flex' : 'none';
  document.getElementById('screen-map').classList.toggle('show', name==='map');
  showOverlay('screen-win', name==='win');
  showOverlay('screen-lose', name==='lose');
  const playing = name==='play';
  document.getElementById('hud').style.display = playing ? 'flex' : 'none';
  document.getElementById('boosts').style.display = playing ? 'flex' : 'none';
  document.getElementById('ver-label').style.display = playing ? 'none' : 'block';
  if(name==='map') renderMap();
  updateHUD();
}

function renderMap(){
  const grid = document.getElementById('map-grid');
  grid.innerHTML = '';
  const TOTAL = 36;
  let sumStars = 0;
  for(let i=1;i<=TOTAL;i++){
    const st = saveData.stars[i] || 0;
    sumStars += st;
    const unlocked = i <= saveData.maxUnlocked;
    const div = document.createElement('div');
    div.className = 'lvl' + (unlocked?'':' lock') + (st?' done':'');
    div.innerHTML = (unlocked? i : '🔒') + '<div class="stars">'+(st?('⭐'.repeat(st)):'')+'</div>';
    if(unlocked) div.onclick = () => startLevel(i);
    grid.appendChild(div);
  }
  saveData.totalStars = sumStars;
  document.getElementById('map-coins').textContent = saveData.coins;
  document.getElementById('map-stars').textContent = sumStars;
  document.getElementById('map-mute').textContent = saveData.muted ? '🔇' : '🔊';
  persist();
}

function updateHUD(){
  document.getElementById('hud-level').textContent = levelNum;
  document.getElementById('hud-stars').textContent = saveData.stars[levelNum]||0;
  document.getElementById('hud-coins').textContent = saveData.coins;
  document.getElementById('btn-mute').textContent = saveData.muted ? '🔇' : '🔊';
  document.getElementById('c-undo').textContent = saveData.boosters.undo;
  document.getElementById('c-hint').textContent = saveData.boosters.hint;
  document.getElementById('c-shuffle').textContent = saveData.boosters.shuffle;
  document.getElementById('ver-label').textContent = 'v'+APP_VERSION.version;
}

function startLevel(n){
  AudioFX.unlock(); AudioFX.startMusic();
  levelNum = n;
  level = buildLevel(n);
  tray = [];
  history = [];
  hintIds = [];
  particles = [];
  anims = [];
  recomputeLayout();
  // spawn-in animation
  level.tiles.forEach((t,i)=>{
    t.alpha = 0; t.scale = 0.5;
    anims.push({type:'spawn', id:t.id, t:0, dur:280+i*8, fromA:0, toA:1, fromS:0.5, toS:1});
  });
  setScreen('play');
  AudioFX.play('sfx_btn');
}

/* ---------- Gameplay ---------- */
function snapshot(){
  return {
    tiles: level.tiles.map(t => ({id:t.id, type:t.type, c:t.c, r:t.r, L:t.L, alive:t.alive})),
    tray: tray.map(t => t.id)
  };
}
function restore(snap){
  const byId = {};
  level.tiles.forEach(t => byId[t.id]=t);
  snap.tiles.forEach(s => {
    const t = byId[s.id];
    if(!t) return;
    Object.assign(t, {type:s.type,c:s.c,r:s.r,L:s.L,alive:s.alive,alpha:s.alive?1:0,scale:1});
  });
  tray = snap.tray.map(id => byId[id]).filter(Boolean);
  recomputeLayout();
  updatePrincessTarget();
}

function pickTile(tile){
  if(screen!=='play' || !tile || !tile.alive) return;
  if(!isFree(tile, level.tiles)){ tile.shake = 1; AudioFX.play('sfx_tap', 0.5); toast('Плитка закрыта'); return; }
  if(tray.length >= TRAY_SIZE){ AudioFX.play('sfx_tap'); return; }

  history.push(snapshot());
  if(history.length > 30) history.shift();

  tile.alive = false;
  // insert into tray grouped with same types
  let insertAt = tray.length;
  for(let i=tray.length-1;i>=0;i--){
    if(tray[i].type === tile.type){ insertAt = i+1; break; }
  }
  tray.splice(insertAt, 0, tile);
  AudioFX.play('sfx_pick');
  hintIds = [];

  // match-3 check
  const counts = {};
  tray.forEach(t => { counts[t.type]=(counts[t.type]||0)+1; });
  const matchType = Object.keys(counts).find(k => counts[k] >= 3);
  if(matchType){
    // remove first 3 of that type
    let removed = 0;
    const gone = [];
    tray = tray.filter(t => {
      if(t.type===matchType && removed<3){ gone.push(t); removed++; return false; }
      return true;
    });
    gone.forEach(t => {
      particles.push({x:t.tx||W/2, y:H-90, life:1, color:'#ffd54f'});
      anims.push({type:'pop', x:t.tx||W/2, y:H-90, t:0, dur:400});
    });
    AudioFX.play('sfx_match');
    // collapse / princess drop feedback
    updatePrincessTarget();
    AudioFX.play('sfx_drop', 0.6);
  }

  // win?
  if(level.tiles.every(t => !t.alive) && tray.length===0){
    setTimeout(() => winLevel(), 350);
    return;
  }
  // lose?
  if(tray.length >= TRAY_SIZE){
    // check if any match possible in tray (shouldn't if we just checked)
    const c2={}; tray.forEach(t=>c2[t.type]=(c2[t.type]||0)+1);
    if(!Object.values(c2).some(v=>v>=3)){
      setTimeout(() => loseLevel(), 400);
    }
  }
}

function winLevel(){
  AudioFX.play('sfx_win');
  let stars = 3;
  // Fewer undos / more picks relative to tile count → fewer stars
  if(history.length > level.cfg.count * 0.9) stars = 2;
  if(history.length > level.cfg.count * 1.35) stars = 1;
  stars = Math.max(1, Math.min(3, stars));

  const prev = saveData.stars[levelNum] || 0;
  if(stars > prev){
    saveData.coins += (stars - prev) * 20 + 30;
    saveData.stars[levelNum] = stars;
  } else {
    saveData.coins += 15;
  }
  if(levelNum >= saveData.maxUnlocked){
    saveData.maxUnlocked = Math.min(36, levelNum + 1);
  }
  // reward boosters occasionally
  if(stars === 3){ saveData.boosters.hint++; saveData.boosters.shuffle++; }
  persist();

  document.getElementById('win-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
  document.getElementById('win-msg').textContent = stars===3 ? 'Идеально! Принцесса благодарит тебя!' :
    stars===2 ? 'Хорошо! Можно ещё лучше.' : 'Спасена! Попробуй набрать больше звёзд.';
  setScreen('win');
  AudioFX.play('sfx_star');
}

function loseLevel(){
  AudioFX.play('sfx_lose');
  setScreen('lose');
}

function boosterUndo(){
  if(saveData.boosters.undo <= 0){ toast('Нет отмен. Заработай на уровнях!'); return; }
  if(!history.length){ toast('Нечего отменять'); return; }
  saveData.boosters.undo--;
  restore(history.pop());
  persist(); updateHUD();
  AudioFX.play('sfx_undo');
}
function boosterHint(){
  if(saveData.boosters.hint <= 0){ toast('Нет подсказок'); return; }
  // find a free tile whose type appears 2+ times free, or any free that helps tray
  const free = level.tiles.filter(t => isFree(t, level.tiles));
  if(!free.length){ toast('Нет свободных плиток'); return; }
  let best = null;
  // prefer type already in tray
  const trayTypes = new Set(tray.map(t=>t.type));
  best = free.find(t => trayTypes.has(t.type));
  if(!best){
    // pair among free
    const by={}; free.forEach(t=>{(by[t.type]=by[t.type]||[]).push(t);});
    const pair = Object.values(by).find(a=>a.length>=2);
    best = pair ? pair[0] : free[0];
  }
  saveData.boosters.hint--;
  persist(); updateHUD();
  hintIds = [best.id];
  best.highlight = 1;
  AudioFX.play('sfx_hint');
  toast('Подсказка: подсвеченная плитка');
}
function boosterShuffle(){
  if(saveData.boosters.shuffle <= 0){ toast('Нет перемешиваний'); return; }
  history.push(snapshot());
  const alive = level.tiles.filter(t=>t.alive);
  const types = alive.map(t=>t.type);
  for(let i=types.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=types[i]; types[i]=types[j]; types[j]=tmp; }
  alive.forEach((t,i)=> t.type = types[i]);
  saveData.boosters.shuffle--;
  persist(); updateHUD();
  hintIds = [];
  AudioFX.play('sfx_shuffle');
  toast('Плитки перемешаны');
}

/* ---------- Input ---------- */
function tileAt(x,y){
  if(!level) return null;
  // topmost free first: sort by layer desc
  const candidates = level.tiles.filter(t => t.alive).sort((a,b)=> b.L - a.L || b.r - a.r);
  for(const t of candidates){
    if(x >= t.x && x <= t.x+layout.tileW && y >= t.y && y <= t.y+layout.tileH) return t;
  }
  return null;
}
function onPointer(e){
  if(screen !== 'play') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
  const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
  const t = tileAt(x,y);
  if(t) pickTile(t);
}
canvas.addEventListener('pointerdown', onPointer);

/* ---------- Draw ---------- */
function roundRect(x,y,w,h,r){
  const rr = Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
function drawTile(t, x, y, w, h, opts){
  opts = opts||{};
  ctx.save();
  ctx.globalAlpha = t.alpha ?? 1;
  const cx=x+w/2, cy=y+h/2;
  ctx.translate(cx,cy);
  ctx.scale(t.scale||1, t.scale||1);
  if(t.shake>0){ ctx.translate((Math.random()-0.5)*6*t.shake, 0); }
  ctx.translate(-w/2,-h/2);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(3,5,w,h,10); ctx.fill();

  // body
  const free = opts.forceFree || (t.alive && isFree(t, level.tiles));
  const grad = ctx.createLinearGradient(0,0,0,h);
  if(free){ grad.addColorStop(0,'#fffef8'); grad.addColorStop(1,'#f0e6d0'); }
  else { grad.addColorStop(0,'#d8d0c4'); grad.addColorStop(1,'#b8b0a4'); }
  ctx.fillStyle = grad;
  roundRect(0,0,w,h,10); ctx.fill();
  ctx.strokeStyle = free ? '#d4a017' : '#8a8070';
  ctx.lineWidth = 2.5;
  roundRect(0,0,w,h,10); ctx.stroke();

  // icon
  const img = tileImgs[t.type];
  const pad = w*0.08;
  if(img){
    ctx.globalAlpha = (t.alpha??1) * (free?1:0.72);
    ctx.drawImage(img, pad, pad, w-pad*2, h-pad*2);
  } else {
    ctx.font = (w*0.45|0)+'px serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(TILE_LABELS[t.type]||'?', w/2, h/2);
  }

  if(t.highlight>0 || hintIds.includes(t.id)){
    ctx.globalAlpha = 0.55 + 0.45*Math.sin(performance.now()/120);
    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 4;
    roundRect(2,2,w-4,h-4,10); ctx.stroke();
  }
  if(!free && t.alive){
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    roundRect(0,0,w,h,10); ctx.fill();
  }
  ctx.restore();
}

function drawPrincess(){
  if(!princessImg || !level) return;
  const alive = level.tiles.filter(t=>t.alive);
  let topY = layout.oy - 10;
  let topX = W/2;
  if(alive.length){
    const top = alive.reduce((a,b)=> (a.r - a.L*0.5 < b.r - b.L*0.5 ? a : b));
    topY = top.y - 8;
    topX = top.x + layout.tileW/2;
  } else {
    topY = layout.oy + level.cfg.rows * (layout.tileH + layout.gapY);
  }
  const ph = Math.min(78, layout.tileH * 1.35);
  const pw = ph * (princessImg.width/princessImg.height);
  ctx.save();
  ctx.drawImage(princessImg, topX - pw/2, topY - ph + 12, pw, ph);
  ctx.restore();
}

function drawTray(){
  const slotW = Math.min(52, (W - 40) / TRAY_SIZE - 4);
  const slotH = slotW * 1.12;
  const totalW = TRAY_SIZE * (slotW+4) - 4;
  const x0 = (W - totalW)/2;
  const y0 = H - 168;
  // tray plate
  ctx.save();
  ctx.fillStyle = 'rgba(30,10,50,0.82)';
  roundRect(x0-10, y0-12, totalW+20, slotH+24, 16); ctx.fill();
  ctx.strokeStyle = '#ce93d8'; ctx.lineWidth=2;
  roundRect(x0-10, y0-12, totalW+20, slotH+24, 16); ctx.stroke();
  for(let i=0;i<TRAY_SIZE;i++){
    const x = x0 + i*(slotW+4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(x, y0, slotW, slotH, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth=1.5;
    roundRect(x, y0, slotW, slotH, 8); ctx.stroke();
  }
  tray.forEach((t,i)=>{
    const x = x0 + i*(slotW+4);
    t.tx = x + slotW/2; t.ty = y0 + slotH/2;
    const fake = { type:t.type, alpha:1, scale:1, shake:0, highlight:0, alive:false };
    drawTile(fake, x, y0, slotW, slotH, {forceFree:true});
  });
  ctx.restore();
}

function drawBg(){
  if(bgImg){
    // cover
    const scale = Math.max(W/bgImg.width, H/bgImg.height);
    const bw = bgImg.width*scale, bh = bgImg.height*scale;
    ctx.drawImage(bgImg, (W-bw)/2, (H-bh)/2, bw, bh);
    ctx.fillStyle = 'rgba(40,10,60,0.25)';
    ctx.fillRect(0,0,W,H);
  } else {
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#6a4c93'); g.addColorStop(1,'#1a0f2e');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  }
}

function drawParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt/600;
    p.y -= 40*dt/1000;
    p.x += (Math.random()-0.5)*20*dt/1000;
    if(p.life<=0){ particles.splice(i,1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color||'#fff';
    ctx.beginPath(); ctx.arc(p.x,p.y,4+3*(1-p.life),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function tickAnims(dt){
  for(let i=anims.length-1;i>=0;i--){
    const a = anims[i];
    a.t += dt;
    const u = Math.min(1, a.t/a.dur);
    const ease = 1 - Math.pow(1-u, 3);
    if(a.type==='spawn'){
      const t = level.tiles.find(x=>x.id===a.id);
      if(t){ t.alpha = a.fromA + (a.toA-a.fromA)*ease; t.scale = a.fromS + (a.toS-a.fromS)*ease; }
    } else if(a.type==='pop'){
      ctx.save();
      ctx.globalAlpha = 1-u;
      ctx.fillStyle = '#ffe082';
      ctx.beginPath(); ctx.arc(a.x, a.y, 10+30*ease, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    if(u>=1) anims.splice(i,1);
  }
  if(level){
    for(const t of level.tiles){
      if(t.shake>0) t.shake = Math.max(0, t.shake - dt/250);
      if(t.highlight>0) t.highlight = Math.max(0, t.highlight - dt/1500);
    }
  }
}

function frame(ts){
  const dt = Math.min(40, ts - (lastTs||ts));
  lastTs = ts;
  if(screen === 'play' && level){
    drawBg();
    // draw tiles back-to-front: low layer first, then by row
    const list = level.tiles.filter(t => t.alive || (t.alpha||0)>0.05)
      .sort((a,b)=> a.L - b.L || a.r - b.r || a.c - b.c);
    for(const t of list){
      if(!t.alive && t.alpha < 0.05) continue;
      drawTile(t, t.x, t.y, layout.tileW, layout.tileH);
    }
    drawPrincess();
    drawTray();
    tickAnims(dt);
    drawParticles(dt);
    // level label
    ctx.save();
    ctx.font = 'bold 13px Trebuchet MS,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(level.cfg.name + ' · ' + level.tiles.filter(t=>t.alive).length + ' плиток', W/2, H - 198);
    ctx.restore();
  } else if(screen === 'intro' || screen === 'win' || screen === 'lose'){
    // overlays handle visuals; still paint soft bg behind
    drawBg();
  } else if(screen === 'map'){
    // map is DOM
  }
  requestAnimationFrame(frame);
}

/* ---------- OTA ---------- */
function cmpSemver(a,b){
  const pa=String(a||'0').split('.').map(n=>parseInt(n,10)||0);
  const pb=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<3;i++){ const d=(pa[i]||0)-(pb[i]||0); if(d) return d; }
  return 0;
}
function getAppUpdatePlugin(){
  try{
    const C=window.Capacitor; if(!C) return null;
    if(C.Plugins&&C.Plugins.AppUpdate) return C.Plugins.AppUpdate;
    if(typeof C.registerPlugin==='function') return C.registerPlugin('AppUpdate');
  }catch(e){}
  return null;
}
async function checkForUpdates(opts){
  opts = opts||{};
  const url = opts.manifestUrl || DEFAULT_MANIFEST_URL;
  if(!url || url.indexOf('PLACEHOLDER')>=0) return {skipped:true};
  let manifest;
  try{
    const res = await fetch(url+(url.indexOf('?')>=0?'&':'?')+'t='+Date.now(), {cache:'no-store', mode:'cors'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    manifest = await res.json();
  }catch(e){
    if(!opts.silent) toast('Нет обновлений или нет сети');
    return {skipped:true};
  }
  const plugin = getAppUpdatePlugin();
  let localCode=APP_VERSION.versionCode, localName=APP_VERSION.version, localWeb=APP_VERSION.webVersion;
  if(plugin && plugin.getInfo){
    try{ const info=await plugin.getInfo(); localCode=info.versionCode||localCode; localName=info.versionName||localName; localWeb=info.webVersion||localWeb; }catch(e){}
  }
  if(manifest.webBundleUrl && cmpSemver(manifest.webVersion||manifest.version, localWeb)>0){
    if(!opts.silent && confirm((manifest.changelog||'Обновление')+'\n\nОбновить контент игры?')){
      if(plugin && plugin.downloadAndApplyWebBundle){
        await plugin.downloadAndApplyWebBundle({url:manifest.webBundleUrl, webVersion:manifest.webVersion||manifest.version});
        location.reload();
      } else window.open(manifest.webBundleUrl, '_blank');
    }
    return {update:'web'};
  }
  const remoteCode = parseInt(manifest.versionCode,10)||0;
  const need = (remoteCode>localCode) || (cmpSemver(manifest.version, localName)>0);
  if(need && manifest.apkUrl){
    if(!opts.silent && confirm((manifest.changelog||'Новая версия APK')+'\n\nСкачать и установить?')){
      if(plugin && plugin.downloadAndInstallApk) await plugin.downloadAndInstallApk({url:manifest.apkUrl});
      else window.open(manifest.apkUrl, '_blank');
    }
    return {update:'apk'};
  }
  if(!opts.silent) toast('У вас актуальная версия v'+localName);
  return {upToDate:true};
}

/* ---------- Wire UI ---------- */
document.getElementById('btn-play').onclick = () => {
  AudioFX.unlock(); AudioFX.setMuted(saveData.muted); AudioFX.startMusic();
  setScreen('map');
  AudioFX.play('sfx_btn');
};
document.getElementById('map-back').onclick = () => { setScreen('intro'); AudioFX.play('sfx_btn'); };
document.getElementById('btn-back').onclick = () => { setScreen('map'); AudioFX.play('sfx_btn'); };
document.getElementById('btn-next').onclick = () => {
  const next = Math.min(36, levelNum+1);
  if(next <= saveData.maxUnlocked) startLevel(next); else setScreen('map');
};
document.getElementById('btn-win-map').onclick = () => setScreen('map');
document.getElementById('btn-retry').onclick = () => startLevel(levelNum);
document.getElementById('btn-lose-map').onclick = () => setScreen('map');
document.getElementById('b-undo').onclick = () => boosterUndo();
document.getElementById('b-hint').onclick = () => boosterHint();
document.getElementById('b-shuffle').onclick = () => boosterShuffle();
function toggleMute(){
  AudioFX.unlock();
  saveData.muted = !saveData.muted;
  AudioFX.setMuted(saveData.muted);
  persist(); updateHUD();
  document.getElementById('map-mute').textContent = saveData.muted ? '🔇' : '🔊';
  AudioFX.play('sfx_btn');
}
document.getElementById('btn-mute').onclick = toggleMute;
document.getElementById('map-mute').onclick = toggleMute;
document.getElementById('btn-update').onclick = () => { AudioFX.unlock(); checkForUpdates({silent:false}); };
document.getElementById('map-update').onclick = () => { AudioFX.unlock(); checkForUpdates({silent:false}); };

/* ---------- Boot ---------- */
document.getElementById('ver-label').textContent = 'v'+APP_VERSION.version;
loadAssets().then(()=>{ resize(); requestAnimationFrame(frame); });
window.addEventListener('load', () => {
  resize();
  setTimeout(()=>checkForUpdates({silent:true}).catch(()=>{}), 1200);
});

window.__PRINCESS__ = { APP_VERSION, startLevel, saveData, buildLevel, levelConfig };
