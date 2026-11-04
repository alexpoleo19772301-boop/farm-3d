/* Спасти принцессу v2.4.0 — press board → spikes, gravel pressure, mahjong drain */
(function () {
  'use strict';
  const VERSION = '2.4.0';
  const SAVE_KEY = 'princess_mahjong_v24';
  const TILE_TYPES = ['zhong', 'fa', 'frame'];
  const N_LEVELS = 36;
  const DT = 1 / 60;
  const GRAV = 1350;
  const DAMP = 0.985;
  const REST = 0.1;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  let W = 390, H = 780, DPR = 1;
  let state = 'intro';
  let levelIdx = 0;
  let save = loadSave();
  let imgs = {};
  let audioMuted = !!save.muted;
  let toastT = 0;

  let tiles = [];
  let cols = 8, rows = 8;
  let tw = 34, th = 40;
  let tileOriginX = 0, tileOriginY = 0;
  let spikesRight = 42;
  let board = { x: 200, w: 48, y0: 100, y1: 500, progress: 0, vel: 0 };
  let boardStartX = 220, boardKillX = 90;
  let princess = { x: 120, y: 0, w: 70, h: 140, mood: 'scared' };
  let pebbles = [];
  let solids = [];
  let selected = null;
  let hintPair = null;
  let drained = 0, startCount = 0;
  let winPending = false, losePending = false;
  let animT = 0, handT = 0, creakT = 0, pourSfxT = 0;
  let levelTime = 0;
  let firstMatchDone = false;
  let tutStep = 0;
  let boosts = { hint: 3, shuffle: 3 };
  let spat = { cell: 24, map: new Map() };
  let curDef = null;
  let loseFlash = 0;
  let outcomeGen = 0;
  let sfx = {};
  let bgm = null;
  let audioReady = false;

  function loadSave() {
    try {
      return Object.assign({ unlocked: 1, coins: 0, stars: {}, muted: false },
        JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch (e) { return { unlocked: 1, coins: 0, stars: {}, muted: false }; }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function levelDef(i) {
    const colsL = 7 + Math.min(3, (i / 4) | 0); // 7..10
    const rowsL = 7 + Math.min(3, ((i + 2) / 5) | 0);
    const types = i < 3 ? 2 : 3;
    const pebblesN = 380 + Math.min(320, i * 8);
    const advance = 0.028 + i * 0.0018; // board advance at full pressure (~25-40s idle)
    const retract = 0.10 + Math.min(0.05, i * 0.0012);
    const seed = 3000 + i * 77;
    return { cols: colsL, rows: rowsL, types, pebblesN, advance, retract, seed };
  }

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function resize() {
    const r = $('app').getBoundingClientRect();
    W = Math.max(320, Math.floor(r.width));
    H = Math.max(520, Math.floor(r.height));
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function loadImg(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  async function loadAll() {
    const list = {
      bg: 'assets/sprites/tower_bg.webp',
      princess: 'assets/sprites/princess_scared.webp',
      princessWin: 'assets/sprites/princess_win.webp',
      princessScared: 'assets/sprites/princess_scared.webp',
      board: 'assets/sprites/board.webp',
      spikes: 'assets/sprites/spikes.webp',
      spikesProc: 'assets/sprites/spikes_proc.webp',
      finger: 'assets/sprites/finger.webp',
    };
    TILE_TYPES.forEach(t => { list['t_' + t] = 'assets/sprites/tiles/' + t + '.webp'; });
    for (let i = 0; i < 8; i++) list['g' + i] = 'assets/sprites/pebbles/g' + i + '.webp';
    for (let i = 0; i < 6; i++) list['p' + i] = 'assets/sprites/pebbles/p' + i + '.webp';
    const entries = Object.entries(list);
    const loaded = await Promise.all(entries.map(([, s]) => loadImg(s)));
    entries.forEach(([k], i) => { imgs[k] = loaded[i]; });
    ['match','tap','win','lose','pebbles','pressure','hint','shuffle','drop','pick'].forEach(n => {
      const a = new Audio('assets/audio/sfx_' + n + '.ogg');
      a.preload = 'auto';
      sfx[n] = a;
    });
    bgm = new Audio('assets/audio/music_theme.ogg');
    bgm.loop = true; bgm.volume = 0.32;
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function setHint(msg) {
    const el = $('hint-line');
    if (!msg) { el.classList.remove('show'); el.textContent = ''; return; }
    el.textContent = msg;
    el.classList.add('show');
  }

  function showScreen(name) {
    state = name;
    $('screen-intro').classList.toggle('hidden', name !== 'intro');
    $('screen-map').classList.toggle('show', name === 'map');
    $('screen-win').classList.toggle('hidden', name !== 'win');
    $('screen-lose').classList.toggle('hidden', name !== 'lose');
    const play = name === 'play';
    $('hud').style.display = play ? 'flex' : 'none';
    $('boosts').style.display = play ? 'flex' : 'none';
    if (!play) setHint('');
    updateBgm();
  }

  function totalStars() {
    return Object.values(save.stars).reduce((a, b) => a + (b | 0), 0);
  }

  function renderMap() {
    const grid = $('map-grid');
    grid.innerHTML = '';
    $('map-coins').textContent = save.coins | 0;
    $('map-stars').textContent = totalStars();
    for (let i = 0; i < N_LEVELS; i++) {
      const el = document.createElement('div');
      const locked = i + 1 > save.unlocked;
      el.className = 'lvl' + (locked ? ' lock' : '') + (save.stars[i] ? ' done' : '');
      const st = save.stars[i] | 0;
      el.innerHTML = (i + 1) + '<div class="stars">' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</div>';
      if (!locked) el.onclick = () => startLevel(i);
      grid.appendChild(el);
    }
  }

  function layoutFromLevel(def) {
    cols = def.cols; rows = def.rows;
    const hudPad = 96;
    const boostPad = 78;
    spikesRight = Math.max(32, W * 0.08);
    board.w = Math.max(36, W * 0.10);
    board.y0 = hudPad + 8;
    // tile floor under gravel — right ~48% of width so chamber has room
    const tileAreaBottom = H - boostPad;
    const tileAreaTop = Math.floor(H * 0.54);
    const tileSpan = W * 0.48;
    tw = Math.floor(tileSpan / cols);
    th = Math.floor(tw * 1.15);
    if (th * rows > tileAreaBottom - tileAreaTop) {
      th = Math.floor((tileAreaBottom - tileAreaTop) / rows);
      tw = Math.floor(th / 1.15);
    }
    tileOriginX = W - 8 - tw * cols;
    tileOriginY = tileAreaBottom - th * rows;
    board.y1 = tileOriginY - 2;

    // board starts just left of gravel/tiles; travels LEFT toward spikes
    boardStartX = Math.min(tileOriginX - board.w - 4, W * 0.58);
    // kill when board left face is almost on spikes (princess crushed)
    boardKillX = spikesRight + 10;
    board.x = boardStartX;
    board.progress = 0;
    board.vel = 0;

    princess.h = Math.floor(H * 0.20);
    princess.w = princess.h * 0.50;
    princess.y = board.y1 - princess.h + 8;
    princess.x = spikesRight + 20; // home — not crushed at start
    princess.mood = 'scared';

    solids = [];
    solids.push({ x: boardStartX, y: board.y0 - 8, w: W, h: 10 });
    solids.push({ x: W - 10, y: board.y0, w: 14, h: H });
    // floor under princess chamber (left of tile pit)
    solids.push({ x: 0, y: board.y1, w: Math.max(boardKillX + 40, tileOriginX - 8), h: H - board.y1 });
  }

  function tileAABB(t) {
    return { x: tileOriginX + t.c * tw, y: tileOriginY + t.r * th, w: tw, h: th };
  }

  function buildTiles(def) {
    const rnd = mulberry32(def.seed);
    const types = TILE_TYPES.slice(0, def.types);
    const cells = cols * rows;
    let pool = [];
    while (pool.length < cells) for (const t of types) { pool.push(t); pool.push(t); }
    pool = pool.slice(0, cells);
    if (pool.length % 2) pool[pool.length - 1] = pool[0];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (levelIdx <= 1) {
      const t0 = types[0];
      pool[0] = t0;
      pool[cols - 1] = t0;
    }
    tiles = [];
    let k = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        tiles.push({ c, r, type: pool[k++], alive: true });
  }

  function makePebble(x, y, rnd) {
    const rBase = Math.max(7.5, W * 0.019);
    const r = rBase + rnd() * Math.max(2.2, W * 0.006);
    const spr = rnd() < 0.8 ? ('g' + ((rnd() * 8) | 0)) : ('p' + ((rnd() * 6) | 0));
    return { x, y, ox: x, oy: y, r, spr, sleep: 0 };
  }

  function spawnPebbles(def) {
    pebbles = [];
    drained = 0;
    const rnd = mulberry32(def.seed + 3);
    const x0 = board.x + board.w + 8;
    const x1 = W - 18;
    const y0 = board.y0 + 10;
    const y1 = tileOriginY - 4;
    const rAvg = Math.max(8, W * 0.02);
    const dx = rAvg * 1.9, dy = rAvg * 1.7;
    let row = 0;
    for (let y = y0 + rAvg; y <= y1 - rAvg; y += dy, row++) {
      const xOff = (row % 2) * dx * 0.5;
      for (let x = x0 + rAvg + xOff; x <= x1 - rAvg; x += dx) {
        pebbles.push(makePebble(x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2, rnd));
      }
    }
    let attempts = 0;
    while (pebbles.length < def.pebblesN && attempts < def.pebblesN * 30) {
      attempts++;
      const x = x0 + rAvg + rnd() * Math.max(1, x1 - x0 - 2 * rAvg);
      const y = y0 + rAvg + rnd() * Math.max(1, y1 - y0 - 2 * rAvg);
      let ok = true;
      for (let i = 0; i < pebbles.length; i++) {
        const p = pebbles[i];
        const ddx = p.x - x, ddy = p.y - y;
        if (ddx * ddx + ddy * ddy < (p.r + rAvg) * (p.r + rAvg) * 0.7) { ok = false; break; }
      }
      if (ok) pebbles.push(makePebble(x, y, rnd));
    }
    // never spawn left of board
    pebbles = pebbles.filter(p => p.x - p.r >= board.x + board.w - 2);
    startCount = pebbles.length;
    spat.cell = rAvg * 2.3;
  }

  function gravelMass() {
    let n = 0;
    const left = board.x + board.w - 4;
    for (const p of pebbles) if (p.x >= left) n++;
    return n;
  }

  function pressure() {
    return Math.min(1.15, gravelMass() / Math.max(1, startCount));
  }

  function isFree(ti) {
    const t = tiles[ti];
    if (!t || !t.alive) return false;
    const left = tiles.find(o => o.alive && o.r === t.r && o.c === t.c - 1);
    const right = tiles.find(o => o.alive && o.r === t.r && o.c === t.c + 1);
    return !left || !right;
  }

  function findPair() {
    const free = [];
    for (let i = 0; i < tiles.length; i++) if (isFree(i)) free.push(i);
    free.sort((a, b) => tiles[a].r - tiles[b].r || tiles[b].c - tiles[a].c);
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++)
        if (tiles[free[i]].type === tiles[free[j]].type) return [free[i], free[j]];
    return null;
  }

  function removePair(a, b) {
    tiles[a].alive = false;
    tiles[b].alive = false;
    selected = null;
    hintPair = null;
    // wake gravel above those cells only (no teleport assist)
    const boxes = [tileAABB(tiles[a]), tileAABB(tiles[b])];
    for (const p of pebbles) {
      for (const box of boxes) {
        if (p.x + p.r > box.x && p.x - p.r < box.x + box.w &&
            p.y + p.r > box.y - 80 && p.y < box.y + box.h + 10) {
          p.sleep = 0;
        }
      }
    }
    playSfx('match');
    if (!firstMatchDone) {
      firstMatchDone = true;
      playSfx('pebbles');
      playSfx('drop');
      if (levelIdx <= 1) {
        setHint('Гравий сыплется! Слей ещё — доска отойдёт!');
        tutStep = 2;
      }
    }
  }

  function rebuildSpat() {
    spat.map.clear();
    const c = spat.cell;
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const key = ((p.x / c) | 0) + ',' + ((p.y / c) | 0);
      let arr = spat.map.get(key);
      if (!arr) { arr = []; spat.map.set(key, arr); }
      arr.push(i);
    }
  }

  function collideCircleAABB(p, box) {
    const cx = Math.max(box.x, Math.min(p.x, box.x + box.w));
    const cy = Math.max(box.y, Math.min(p.y, box.y + box.h));
    let dx = p.x - cx, dy = p.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 >= p.r * p.r) return;
    if (d2 < 1e-6) {
      const dl = p.x - box.x, dr = box.x + box.w - p.x;
      const dt = p.y - box.y, db = box.y + box.h - p.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { p.x = box.x - p.r; p.ox = p.x; }
      else if (m === dr) { p.x = box.x + box.w + p.r; p.ox = p.x; }
      else if (m === dt) { p.y = box.y - p.r; p.oy = p.y; }
      else { p.y = box.y + box.h + p.r; p.oy = p.y; }
      p.sleep = 0; return;
    }
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d;
    const pen = p.r - d;
    p.x += nx * pen; p.y += ny * pen;
    const vx = p.x - p.ox, vy = p.y - p.oy;
    const vn = vx * nx + vy * ny;
    if (vn < 0) {
      p.ox = p.x - (vx - (1 + REST) * vn * nx) * 0.9;
      p.oy = p.y - (vy - (1 + REST) * vn * ny);
    }
    p.sleep = 0;
  }

  function stepBoard(def, dt) {
    const p = pressure();
    // acceleration from gravel pressure toward spikes; retract when drained
    const force = p * def.advance - (1 - Math.min(1, p)) * def.retract;
    board.vel += force * dt;
    board.vel *= 0.92;
    board.progress = Math.max(0, Math.min(1.05, board.progress + board.vel * dt));
    board.x = boardStartX + (boardKillX - boardStartX) * board.progress;

    // keep princess BODY left of board face (compress if gap small)
    const homeX = spikesRight + 18;
    const gap = Math.max(12, board.x - spikesRight - 4);
    const maxW = Math.min(princess.w, gap * 0.92);
    princess._drawW = maxW;
    if (board.x < homeX + princess.w) {
      princess.x = board.x - maxW - 2;
      if (princess.x < spikesRight + 2) princess.x = spikesRight + 2;
    } else {
      princess.x = homeX;
      princess._drawW = princess.w;
    }

    if (Math.abs(board.vel) > 0.08 && creakT <= 0) {
      playSfx('pressure');
      creakT = 0.55;
    }
    if (creakT > 0) creakT -= dt;

    const span = Math.max(40, boardStartX - boardKillX);
    const danger = Math.max(0, Math.min(1, board.progress));
    if (board.progress > 0.7) princess.mood = 'panic';
    else princess.mood = 'scared';

    updateDangerHud(danger, p);

    if (!winPending && !losePending) {
      // lose only when board has truly closed most of the gap
      if (board.progress >= 0.92 || (board.progress > 0.8 && princess.x <= spikesRight + 8)) {
        losePending = true;
        loseFlash = 1;
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen) endLose(); }, 450);
      } else if (p < 0.34 && board.progress < 0.22 && drained >= Math.max(25, startCount * 0.18)) {
        winPending = true;
        princess.mood = 'happy';
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen) endWin(); }, 500);
      } else if (tiles.every(t => !t.alive) && p < 0.5 && drained >= 20) {
        winPending = true;
        princess.mood = 'happy';
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen) endWin(); }, 600);
      }
    }
  }

  function updateDangerHud(danger, p) {
    // show remaining safety % (100 = safe far from spikes)
    const safe = Math.round((1 - Math.max(danger, board.progress)) * 100);
    $('hud-stones').textContent = Math.max(0, safe);
    $('danger-fill').style.width = Math.round(board.progress * 100) + '%';
    $('hud-danger').classList.toggle('warn', board.progress > 0.45 || safe < 50);
  }

  function stepPhysics() {
    if (state !== 'play' || !curDef) return;
    levelTime += DT;
    const g = GRAV * DT * DT;
    const boardBox = { x: board.x, y: board.y0, w: board.w, h: board.y1 - board.y0 };

    rebuildSpat();
    const csz = spat.cell;

    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.sleep > 28) continue;
      let vx = (p.x - p.ox) * DAMP;
      let vy = (p.y - p.oy) * DAMP;
      p.ox = p.x; p.oy = p.y;
      p.x += vx;
      p.y += vy + g;
    }

    for (let iter = 0; iter < 2; iter++) {
      rebuildSpat();
      for (let i = 0; i < pebbles.length; i++) {
        const a = pebbles[i];
        if (a.sleep > 28) continue;
        const kx = (a.x / csz) | 0, ky = (a.y / csz) | 0;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const arr = spat.map.get((kx + ox) + ',' + (ky + oy));
          if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue;
            const b = pebbles[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d2 = dx * dx + dy * dy;
            const minD = a.r + b.r;
            if (d2 >= minD * minD || d2 < 1e-8) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d;
            const pen = (minD - d) * 0.5;
            a.x -= nx * pen; a.y -= ny * pen;
            b.x += nx * pen; b.y += ny * pen;
            a.sleep = 0; b.sleep = 0;
          }
        }
      }
    }

    let movingDrain = 0;
    const alive = [];
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.sleep > 28) { alive.push(p); continue; }
      // board right face (gravel presses from right)
      collideCircleAABB(p, boardBox);
      for (const s of solids) collideCircleAABB(p, s);
      // tile floor plugs — holes where tiles removed (passive fall)
      for (let ti = 0; ti < tiles.length; ti++) {
        if (!tiles[ti].alive) continue;
        collideCircleAABB(p, tileAABB(tiles[ti]));
      }
      // seal under each column while ANY tile in column alive (prevent under-slip until column dug)
      for (let c = 0; c < cols; c++) {
        let bottomAlive = false;
        for (let ti = 0; ti < tiles.length; ti++)
          if (tiles[ti].alive && tiles[ti].c === c && tiles[ti].r === rows - 1) {
            bottomAlive = true; break;
          }
        if (bottomAlive) {
          collideCircleAABB(p, {
            x: tileOriginX + c * tw,
            y: tileOriginY + rows * th - 2,
            w: tw,
            h: 40
          });
        }
      }
      if (p.x - p.r < board.x + board.w) {
        // keep gravel behind board
        if (p.y < board.y1) { p.x = board.x + board.w + p.r; p.ox = p.x; }
      }
      if (p.x + p.r > W - 8) { p.x = W - 8 - p.r; p.ox = p.x; }

      if (p.y - p.r > H + 2) { drained++; continue; }
      const spd = Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy);
      if (spd < 0.04) p.sleep++; else p.sleep = 0;
      if (spd > 0.6 && p.y > tileOriginY) movingDrain++;
      alive.push(p);
    }
    pebbles = alive;
    if (movingDrain > 3 && pourSfxT <= 0) { playSfx('pebbles'); pourSfxT = 0.4; }
    if (pourSfxT > 0) pourSfxT -= DT;

    stepBoard(curDef, DT);
  }

  function endWin() {
    if (state !== 'play') return;
    const stars = board.progress < 0.2 ? 3 : board.progress < 0.45 ? 2 : 1;
    const prev = save.stars[levelIdx] | 0;
    if (stars > prev) save.stars[levelIdx] = stars;
    save.coins = (save.coins | 0) + 10 * stars;
    if (save.unlocked < levelIdx + 2) save.unlocked = Math.min(N_LEVELS, levelIdx + 2);
    persist();
    $('win-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-msg').textContent = 'Гравий: −' + Math.round((1 - pressure()) * 100) + '% · доска отступила';
    $('hud-coins').textContent = save.coins;
    princess.mood = 'happy';
    showScreen('win');
    playSfx('win');
  }

  function endLose() {
    if (state !== 'play') return;
    showScreen('lose');
    playSfx('lose');
  }

  function startLevel(i) {
    levelIdx = i;
    curDef = levelDef(i);
    resize();
    layoutFromLevel(curDef);
    buildTiles(curDef);
    spawnPebbles(curDef);
    selected = null; hintPair = null;
    outcomeGen++;
    winPending = losePending = false;
    loseFlash = 0;
    firstMatchDone = false;
    levelTime = 0;
    board.progress = 0;
    board.vel = 0;
    board.x = boardStartX;
    boosts = { hint: 3, shuffle: 3 };
    $('c-hint').textContent = 3;
    $('c-shuffle').textContent = 3;
    $('hud-level').textContent = i + 1;
    $('hud-coins').textContent = save.coins | 0;
    showScreen('play');
    tutStep = i <= 1 ? 1 : 99;
    if (i <= 1) {
      hintPair = findPair();
      setHint('Собери пару плиток — открой яму под гравием!');
    } else setHint('');
    for (let s = 0; s < 8; s++) stepPhysics();
    // ensure no gravel left of board
    pebbles = pebbles.filter(p => p.x >= board.x + board.w - 4);
    startCount = Math.max(startCount, gravelMass());
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawSpikes() {
    const h = board.y1 - board.y0;
    const im = imgs.spikesProc || imgs.spikes;
    // wall plate
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(0, board.y0, spikesRight, h);
    ctx.fillStyle = '#2a2e36';
    ctx.fillRect(0, board.y0, 8, h);
    if (im) {
      // tips point toward princess (right)
      ctx.save();
      // draw multiple rows of spikes
      const sh = 36;
      for (let y = board.y0 + 8; y < board.y1 - 10; y += sh) {
        ctx.drawImage(im, 2, y, spikesRight + 8, sh);
      }
      ctx.restore();
    } else {
      // procedural triangles pointing right
      ctx.fillStyle = '#b0b6c0';
      for (let y = board.y0 + 12; y < board.y1 - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(6, y);
        ctx.lineTo(spikesRight + 6, y + 10);
        ctx.lineTo(6, y + 20);
        ctx.closePath();
        ctx.fill();
      }
    }
    // label
    ctx.save();
    ctx.fillStyle = 'rgba(255,100,100,.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.translate(14, (board.y0 + board.y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('ШИПЫ', 0, 0);
    ctx.restore();
  }

  function drawBoard() {
    const h = board.y1 - board.y0;
    const im = imgs.board;
    if (im) ctx.drawImage(im, board.x, board.y0, board.w, h);
    else {
      ctx.fillStyle = '#8d6e4a';
      roundRect(ctx, board.x, board.y0, board.w, h, 6);
      ctx.fill();
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // pressure gauge on board face
    const gx = board.x + board.w * 0.22;
    const gy = board.y0 + 16;
    const gw = board.w * 0.56;
    const gh = h - 32;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    roundRect(ctx, gx, gy, gw, gh, 6);
    ctx.fill();
    const fillH = gh * Math.min(1, pressure());
    ctx.fillStyle = pressure() > 0.6 ? '#e53935' : pressure() > 0.35 ? '#fb8c00' : '#66bb6a';
    roundRect(ctx, gx + 3, gy + gh - fillH, gw - 6, fillH, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(pressure() * 100) + '%', board.x + board.w / 2, gy + 14);
    ctx.textAlign = 'left';
    // distance arrow to princess
    const midY = board.y0 + h * 0.2;
    ctx.strokeStyle = 'rgba(255,230,120,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(board.x - 4, midY);
    ctx.lineTo(princess.x + princess.w * 0.7, midY);
    ctx.stroke();
    const distPx = Math.max(0, (board.x - (princess.x + princess.w * 0.7)) | 0);
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(distPx + 'px → шипы', princess.x, board.y0 + 14);
  }

  function drawPrincess() {
    const im = princess.mood === 'happy' ? (imgs.princessWin || imgs.princess)
      : (imgs.princessScared || imgs.princess);
    const shake = princess.mood === 'panic' ? Math.sin(animT * 28) * 3 : 0;
    const bob = Math.sin(animT * 3) * 1.5;
    const dw = princess._drawW || princess.w;
    if (im) ctx.drawImage(im, princess.x + shake, princess.y + bob, dw, princess.h);
    if (princess.mood === 'panic') {
      ctx.font = '18px sans-serif';
      ctx.fillText('!', princess.x + princess.w * 0.75, princess.y + 18);
    }
    // ouch flash
    if (loseFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (loseFlash * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = 'rgba(255,80,80,' + loseFlash + ')';
      ctx.textAlign = 'center';
      ctx.fillText('АЙ!', W / 2, H * 0.35);
      ctx.textAlign = 'left';
      loseFlash = Math.max(0, loseFlash - 0.02);
    }
  }

  function drawTiles() {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t.alive) continue;
      const box = tileAABB(t);
      const im = imgs['t_' + t.type];
      ctx.fillStyle = '#c4a882';
      roundRect(ctx, box.x + 1, box.y + 4, box.w - 2, box.h - 2, 5);
      ctx.fill();
      if (im) ctx.drawImage(im, box.x, box.y - 1, box.w, box.h - 4);
      else {
        ctx.fillStyle = '#fffaf0';
        roundRect(ctx, box.x, box.y - 1, box.w, box.h - 6, 5);
        ctx.fill();
      }
      const hl = selected === i || (hintPair && (hintPair[0] === i || hintPair[1] === i));
      if (hl) {
        ctx.strokeStyle = selected === i ? '#ffeb3b' : '#80d8ff';
        ctx.lineWidth = 3;
        roundRect(ctx, box.x - 1, box.y - 2, box.w + 2, box.h - 2, 6);
        ctx.stroke();
        if (hintPair && tutStep === 1) {
          ctx.fillStyle = 'rgba(128,216,255,' + (0.18 + 0.14 * Math.sin(animT * 6)) + ')';
          roundRect(ctx, box.x - 2, box.y - 3, box.w + 4, box.h, 6);
          ctx.fill();
        }
      }
    }
    // pit hint under empty cells
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (const t of tiles) {
      if (t.alive) continue;
      const box = tileAABB(t);
      ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
    }
  }

  function drawPebbles() {
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const im = imgs[p.spr];
      const s = p.r * 2.15;
      if (im) ctx.drawImage(im, p.x - s / 2, p.y - s / 2, s, s);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = '#7e57c2';
        ctx.fill();
      }
    }
  }

  function drawFinger() {
    if (tutStep !== 1 || !hintPair || state !== 'play') return;
    const t = tiles[hintPair[0]];
    if (!t || !t.alive) return;
    const box = tileAABB(t);
    const fx = box.x + box.w * 0.55;
    const fy = box.y + box.h * 0.2 + Math.sin(handT * 4) * 10;
    const im = imgs.finger;
    const s = Math.min(110, W * 0.28);
    if (im) ctx.drawImage(im, fx - s * 0.15, fy, s, s);
    else {
      ctx.fillStyle = '#f5c6a5';
      ctx.beginPath();
      ctx.ellipse(fx + 20, fy + 40, 18, 28, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawChamberBg() {
    // gravel chamber backdrop
    ctx.fillStyle = 'rgba(40,32,28,.55)';
    ctx.fillRect(board.x + board.w, board.y0, W - (board.x + board.w), board.y1 - board.y0);
    // princess chamber
    ctx.fillStyle = 'rgba(20,24,36,.25)';
    ctx.fillRect(spikesRight, board.y0, board.x - spikesRight, board.y1 - board.y0);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (imgs.bg) {
      const bw = imgs.bg.width, bh = imgs.bg.height;
      const s = Math.max(W / bw, H / bh);
      ctx.drawImage(imgs.bg, (W - bw * s) / 2, (H - bh * s) / 2, bw * s, bh * s);
      ctx.fillStyle = 'rgba(10,12,20,.3)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(0, 0, W, H);
    }
    drawChamberBg();
    drawSpikes();
    drawTiles();
    drawPebbles();
    drawBoard();
    drawPrincess();
    drawFinger();
    // vignette when close to lose
    if (state === 'play' && board.progress > 0.5) {
      ctx.fillStyle = 'rgba(160,20,30,' + ((board.progress - 0.5) * 0.35) + ')';
      ctx.fillRect(0, board.y0, board.x, board.y1 - board.y0);
    }
  }

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  function hitTile(x, y) {
    for (let i = tiles.length - 1; i >= 0; i--) {
      if (!tiles[i].alive) continue;
      const b = tileAABB(tiles[i]);
      if (x >= b.x && x <= b.x + b.w && y >= b.y - 2 && y <= b.y + b.h) return i;
    }
    return -1;
  }
  function onTap(e) {
    if (state !== 'play') return;
    e.preventDefault();
    ensureAudio();
    const p = canvasPos(e);
    const ti = hitTile(p.x, p.y);
    if (ti < 0) { selected = null; return; }
    if (!isFree(ti)) { toast('Плитка закрыта с боков'); playSfx('tap'); return; }
    if (selected == null) { selected = ti; playSfx('pick'); return; }
    if (selected === ti) { selected = null; return; }
    if (tiles[selected].type === tiles[ti].type) {
      removePair(selected, ti);
      if (tutStep === 1) tutStep = 2;
    } else {
      toast('Нужна пара одинаковых');
      selected = ti;
      playSfx('tap');
    }
  }
  canvas.addEventListener('pointerdown', onTap, { passive: false });

  function ensureAudio() {
    if (audioReady) return;
    audioReady = true;
    updateBgm();
  }
  function updateBgm() {
    if (!bgm) return;
    if (audioMuted || state !== 'play') { try { bgm.pause(); } catch (e) {} return; }
    bgm.play().catch(() => {});
  }
  function playSfx(kind) {
    if (audioMuted) return;
    const a = sfx[kind];
    if (!a) return;
    try {
      const c = a.cloneNode();
      c.volume = (kind === 'pebbles' || kind === 'pressure') ? 0.5 : 0.7;
      c.play().catch(() => {});
    } catch (e) {}
  }

  $('b-hint').onclick = () => {
    if (state !== 'play' || boosts.hint <= 0) return;
    const pair = findPair();
    if (!pair) { toast('Нет пары — смешай'); return; }
    boosts.hint--; $('c-hint').textContent = boosts.hint;
    hintPair = pair; selected = null; playSfx('hint'); toast('Подсказка');
  };
  $('b-shuffle').onclick = () => {
    if (state !== 'play' || boosts.shuffle <= 0) return;
    boosts.shuffle--; $('c-shuffle').textContent = boosts.shuffle;
    const alive = tiles.filter(t => t.alive);
    const types = alive.map(t => t.type);
    for (let i = types.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [types[i], types[j]] = [types[j], types[i]];
    }
    alive.forEach((t, i) => { t.type = types[i]; });
    selected = null; hintPair = null; playSfx('shuffle'); toast('Перемешано');
  };

  $('btn-play').onclick = () => { ensureAudio(); renderMap(); showScreen('map'); };
  $('map-back').onclick = () => showScreen('intro');
  $('btn-back').onclick = () => { showScreen('map'); renderMap(); };
  $('btn-next').onclick = () => {
    if (levelIdx + 1 < N_LEVELS && levelIdx + 1 < save.unlocked) startLevel(levelIdx + 1);
    else { renderMap(); showScreen('map'); }
  };
  $('btn-win-map').onclick = () => { renderMap(); showScreen('map'); };
  $('btn-retry').onclick = () => startLevel(levelIdx);
  $('btn-lose-map').onclick = () => { renderMap(); showScreen('map'); };
  $('btn-mute').onclick = () => {
    audioMuted = !audioMuted; save.muted = audioMuted; persist();
    $('btn-mute').textContent = audioMuted ? '🔇' : '🔊';
    updateBgm();
  };
  async function checkUpdate() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.webVersion && j.webVersion !== VERSION) {
        toast('Доступна ' + j.webVersion); setTimeout(() => location.reload(true), 600);
      } else toast('У вас последняя версия ' + VERSION);
    } catch (e) { toast('Нет сети'); }
  }
  $('btn-update').onclick = checkUpdate;
  $('map-update').onclick = checkUpdate;

  let acc = 0, last = performance.now();
  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now; acc += raw; animT += raw; handT += raw;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      if (state === 'play') stepPhysics();
      acc -= DT; steps++;
    }
    if (state === 'play' && tutStep === 1 && levelIdx <= 1) {
      if (!hintPair || !tiles[hintPair[0]]?.alive || !tiles[hintPair[1]]?.alive)
        hintPair = findPair();
    }
    draw();
    requestAnimationFrame(frame);
  }

  $('ver-label').textContent = 'v' + VERSION;
  window.addEventListener('resize', () => { if (state === 'play' && curDef) { resize(); layoutFromLevel(curDef); } else resize(); });
  resize();
  loadAll().then(() => { showScreen('intro'); requestAnimationFrame(frame); });

  window.__PM = {
    startLevel,
    stepPhysics: (n) => { for (let i = 0; i < (n || 1); i++) stepPhysics(); },
    idle: (sec) => {
      const steps = Math.floor(sec / DT);
      for (let i = 0; i < steps; i++) stepPhysics();
      if (losePending && state === 'play') endLose();
      if (winPending && state === 'play') endWin();
    },
    setProgress: (v) => {
      board.progress = Math.max(0, Math.min(1, v));
      board.x = boardStartX + (boardKillX - boardStartX) * board.progress;
      const homeX = spikesRight + 18;
      const gap = Math.max(12, board.x - spikesRight - 4);
      const maxW = Math.min(princess.w, gap * 0.92);
      princess._drawW = maxW;
      if (board.x < homeX + princess.w) {
        princess.x = Math.max(spikesRight + 2, board.x - maxW - 2);
      } else { princess.x = homeX; princess._drawW = princess.w; }
      if (board.progress > 0.7) princess.mood = 'panic';
      updateDangerHud(board.progress, pressure());
    },
    drainMany: (n) => {
      // remove n pebbles from chamber as if they fell through holes (for win strip)
      let left = n;
      pebbles = pebbles.filter(p => {
        if (left > 0 && p.x > board.x + board.w) { left--; drained++; return false; }
        return true;
      });
      for (let i = 0; i < 30; i++) stepPhysics();
      if (winPending && state === 'play') endWin();
    },
    getState: () => ({
      state, levelIdx, pebbles: pebbles.length, drained, pressure: pressure(),
      boardProgress: board.progress, boardX: board.x, princessX: princess.x,
      spikesRight, tiles: tiles.filter(t => t.alive).length, startCount,
      levelTime, tutStep, VERSION
    }),
    removePairAt: (a, b) => removePair(a, b),
    findPair, tiles: () => tiles, VERSION
  };
})();
