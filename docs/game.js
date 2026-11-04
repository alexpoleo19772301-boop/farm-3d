/* Спасти принцессу: Маджонг v2.3.0 — pressure, tutorial, passive drain */
(function () {
  'use strict';
  const VERSION = '2.3.0';
  const SAVE_KEY = 'princess_mahjong_v23';
  const TILE_TYPES = ['zhong', 'fa', 'frame'];
  const N_LEVELS = 36;
  const DT = 1 / 60;
  const GRAV = 1200;
  const DAMP = 0.986;
  const REST = 0.12;
  const FRICTION = 0.88;

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
  let cols = 9, rows = 9;
  let tw = 34, th = 42, wallX = 16, wallY = 420;
  let pipe = { topY: 70, topH: 120, rightX: 250, rightW: 120, feedX: 0 };
  let solids = [];
  let pebbles = [];
  let selected = null;
  let hintPair = null;
  let drained = 0, startCount = 0, pipePeak = 0;
  let buryFill = 0;
  let winPending = false, losePending = false;
  let princessMood = 'scared'; // scared|panic|happy
  let animT = 0;
  let boosts = { hint: 3, shuffle: 3 };
  let spat = { cell: 24, map: new Map() };
  let levelTime = 0;
  let spillAcc = 0;
  let feedAcc = 0;
  let ledgeCracks = 0; // 0..1 crumbling ledge on wall top
  let firstMatchDone = false;
  let tutStep = 0;
  let handT = 0;
  let pourBurst = 0;
  let winLineY = 0; // pipe height line — win when mass above this is low
  let sfx = {};
  let bgm = null;
  let pourSfxT = 0;

  function loadSave() {
    try {
      return Object.assign({
        unlocked: 1, coins: 0, stars: {}, muted: false
      }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch (e) { return { unlocked: 1, coins: 0, stars: {}, muted: false }; }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function levelDef(i) {
    const colsL = 8 + (i % 3);
    const rowsL = 8 + ((i + 1) % 3);
    const pebblesN = 520 + Math.min(280, i * 6);
    const pipeW = 0.30 + (i % 5) * 0.01;
    const topH = 0.15 + (i % 3) * 0.01;
    // idle bury target ~22s early, ~35s later
    const spillPeriod = 2.2 + Math.min(1.2, i * 0.04);
    const feedRate = 14 + Math.min(10, i);
    return { cols: colsL, rows: rowsL, types: 3, pebblesN, pipeW, topH, seed: 2000 + i * 91, spillPeriod, feedRate, idleLose: 22 + Math.min(16, i * 0.4) };
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
    const app = $('app');
    const r = app.getBoundingClientRect();
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
    };
    TILE_TYPES.forEach(t => { list['t_' + t] = 'assets/sprites/tiles/' + t + '.webp'; });
    for (let i = 0; i < 8; i++) list['g' + i] = 'assets/sprites/pebbles/g' + i + '.webp';
    for (let i = 0; i < 6; i++) list['p' + i] = 'assets/sprites/pebbles/p' + i + '.webp';
    const entries = Object.entries(list);
    const loaded = await Promise.all(entries.map(([, s]) => loadImg(s)));
    entries.forEach(([k], i) => { imgs[k] = loaded[i]; });

    const names = ['match','tap','win','lose','pebbles','pressure','hint','shuffle','drop','pick'];
    names.forEach(n => {
      const a = new Audio('assets/audio/sfx_' + n + '.ogg');
      a.preload = 'auto';
      sfx[n] = a;
    });
    bgm = new Audio('assets/audio/music_theme.ogg');
    bgm.loop = true;
    bgm.volume = 0.35;
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2000);
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
    const marginL = W * 0.035;
    const marginR = W * 0.025;
    const hudPad = 92;
    const boostPad = 78;
    pipe.rightW = Math.floor(W * def.pipeW);
    pipe.topH = Math.floor(H * def.topH);
    pipe.topY = hudPad + 4;
    pipe.rightX = W - marginR - pipe.rightW;

    const chamberRight = pipe.rightX;
    const wallBottom = H - boostPad;
    const princessH = Math.floor(H * 0.24);
    const wallTopMin = pipe.topY + pipe.topH + Math.floor(princessH * 0.7);
    tw = Math.floor((chamberRight - marginL) / cols);
    th = Math.floor(tw * 1.18);
    const maxH = wallBottom - wallTopMin;
    if (th * rows > maxH) {
      th = Math.floor(maxH / rows);
      tw = Math.floor(th / 1.18);
    }
    wallX = chamberRight - tw * cols;
    wallY = wallBottom - th * rows;
    pipe.feedX = wallX + tw * Math.floor(cols * 0.28);
    winLineY = pipe.topY + pipe.topH + (H - pipe.topY - pipe.topH) * 0.42;

    const rim = Math.max(10, Math.floor(W * 0.028));
    solids = [];
    // ceiling
    solids.push({ x: pipe.feedX - rim, y: pipe.topY - rim, w: W, h: rim, id: 'ceil' });
    // left stopper of top arm (feed mouth is just right of this)
    solids.push({ x: pipe.feedX - rim, y: pipe.topY, w: rim, h: pipe.topH, id: 'feedStop' });
    // floor of top arm left of shaft
    solids.push({ x: 0, y: pipe.topY + pipe.topH, w: pipe.rightX + 2, h: rim, id: 'topFloor' });
    // left wall of shaft ABOVE tile wall
    const above = Math.max(0, wallY - (pipe.topY + pipe.topH + rim));
    if (above > 0) {
      solids.push({ x: pipe.rightX - 5, y: pipe.topY + pipe.topH + rim, w: 8, h: above, id: 'shaftL' });
    }
    // right outer
    solids.push({ x: W - marginR, y: pipe.topY - rim, w: rim + 10, h: H, id: 'outerR' });
    // princess chamber floor
    solids.push({ x: 0, y: H - 12, w: Math.max(8, wallX + tw * cols - 8), h: 30, id: 'chamberFloor' });
    // crumbling ledge on top of wall (right half) — thin, will spill over as cracks grow
    // (handled dynamically in physics)
  }

  function buildTiles(def) {
    const rnd = mulberry32(def.seed);
    const types = TILE_TYPES.slice(0, def.types);
    const cells = cols * rows;
    let pool = [];
    while (pool.length < cells) {
      for (const t of types) { pool.push(t); pool.push(t); }
    }
    pool = pool.slice(0, cells);
    if (pool.length % 2) pool[pool.length - 1] = pool[0];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Tutorial levels: guarantee an obvious free pair on rightmost column
    if (levelIdx <= 1) {
      const t0 = types[0];
      // place two of same type on rightmost col, free edges
      pool[cols - 1] = t0; // r0 c last
      pool[(rows - 1) * cols + (cols - 1)] = t0;
    }
    tiles = [];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({ c, r, type: pool[k++], alive: true });
      }
    }
  }

  function makePebble(x, y, rnd) {
    const rBase = Math.max(8.2, W * 0.021);
    const r = rBase + rnd() * Math.max(2.4, W * 0.007);
    // prefer faceted gem sprites
    const spr = rnd() < 0.78 ? ('g' + ((rnd() * 8) | 0)) : ('p' + ((rnd() * 6) | 0));
    return { x, y, ox: x, oy: y, r, spr, sleep: 0 };
  }

  function spawnPebbles(def) {
    pebbles = [];
    drained = 0;
    const rnd = mulberry32(def.seed + 7);
    const rAvg = Math.max(9, W * 0.023);
    const regions = [
      { x0: pipe.feedX + 8, y0: pipe.topY + 8, x1: W - 16, y1: pipe.topY + pipe.topH - 6 },
      { x0: pipe.rightX + 6, y0: pipe.topY + 8, x1: W - 16, y1: H - 50 }
    ];
    function pack(reg, scale) {
      const dx = rAvg * 1.95 * scale, dy = rAvg * 1.72 * scale;
      let row = 0;
      for (let y = reg.y0 + rAvg; y <= reg.y1 - rAvg; y += dy, row++) {
        const xOff = (row % 2) * dx * 0.5;
        for (let x = reg.x0 + rAvg + xOff; x <= reg.x1 - rAvg; x += dx) {
          const jx = (rnd() - 0.5) * rAvg * 0.2;
          const jy = (rnd() - 0.5) * rAvg * 0.2;
          pebbles.push(makePebble(x + jx, y + jy, rnd));
        }
      }
    }
    pack(regions[0], 0.80);
    pack(regions[1], 0.82);
    let attempts = 0;
    while (pebbles.length < def.pebblesN && attempts < def.pebblesN * 20) {
      attempts++;
      const reg = regions[attempts & 1];
      const x = reg.x0 + rAvg + rnd() * Math.max(1, reg.x1 - reg.x0 - 2 * rAvg);
      const y = reg.y0 + rAvg + rnd() * Math.max(1, reg.y1 - reg.y0 - 2 * rAvg);
      let ok = true;
      for (let i = 0; i < pebbles.length; i++) {
        const p = pebbles[i];
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < (p.r + rAvg) * (p.r + rAvg) * 0.7) { ok = false; break; }
      }
      if (ok) pebbles.push(makePebble(x, y, rnd));
    }
    // CRITICAL: purge any pebble on princess side
    const damX = wallX + tw * cols - 2;
    pebbles = pebbles.filter(p => p.x - p.r >= damX - 1 || p.y < pipe.topY + pipe.topH);
    // also purge those sitting in chamber below top pipe
    pebbles = pebbles.filter(p => !(p.x < damX && p.y > pipe.topY + pipe.topH));
    startCount = pebbles.length;
    pipePeak = countPipeMass();
    spat.cell = rAvg * 2.3;
  }

  function countPipeMass() {
    let n = 0;
    const damX = wallX + tw * cols;
    for (const p of pebbles) {
      if (p.x >= damX - 4 || p.y <= pipe.topY + pipe.topH + 4) n++;
    }
    return n;
  }

  function tileAABB(t) {
    return { x: wallX + t.c * tw, y: wallY + t.r * th, w: tw, h: th };
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
    // prefer rightmost for tutorial clarity
    free.sort((a, b) => tiles[b].c - tiles[a].c || tiles[a].r - tiles[b].r);
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (tiles[free[i]].type === tiles[free[j]].type) return [free[i], free[j]];
      }
    }
    return null;
  }

  function removePair(a, b) {
    tiles[a].alive = false;
    tiles[b].alive = false;
    selected = null;
    hintPair = null;
    // wake nearby — NO directional nudge; just unsleep so gravity takes over
    const boxes = [tileAABB(tiles[a]), tileAABB(tiles[b])];
    for (const p of pebbles) {
      for (const box of boxes) {
        if (p.x + p.r > box.x - 6 && p.x - p.r < box.x + box.w + 14 &&
            p.y + p.r > box.y - 6 && p.y - p.r < box.y + box.h + 6) {
          p.sleep = 0;
        }
      }
    }
    playSfx('match');
    if (!firstMatchDone) {
      firstMatchDone = true;
      pourBurst = 2.4;
      playSfx('pebbles');
      playSfx('drop');
      // dramatic: dump stones through the opened cells downward off-screen
      const boxes = [tileAABB(tiles[a]), tileAABB(tiles[b])];
      for (const p of pebbles) {
        for (const box of boxes) {
          if (p.x > box.x - 30 && p.x < box.x + box.w + 50 &&
              p.y > box.y - 40 && p.y < box.y + box.h + 80) {
            p.sleep = 0;
            // place into the hole so gravity drains them visibly
            if (p.x > pipe.rightX - 4) {
              p.x = box.x + box.w * 0.5;
              p.ox = p.x;
              p.y = box.y + box.h * 0.5;
              p.oy = p.y - 4;
            }
          }
        }
      }
      if (levelIdx <= 1) {
        setHint('Камни сыплются вниз! Открой ещё путь!');
        tutStep = 2;
      }
    }
    // open pressure relief slightly
    ledgeCracks = Math.max(0, ledgeCracks - 0.08);
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
    if (d2 >= p.r * p.r) return false;
    if (d2 < 1e-6) {
      const dl = p.x - box.x, dr = box.x + box.w - p.x;
      const dt = p.y - box.y, db = box.y + box.h - p.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { p.x = box.x - p.r; p.ox = p.x; }
      else if (m === dr) { p.x = box.x + box.w + p.r; p.ox = p.x; }
      else if (m === dt) { p.y = box.y - p.r; p.oy = p.y; }
      else { p.y = box.y + box.h + p.r; p.oy = p.y; }
      p.sleep = 0;
      return true;
    }
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d;
    const pen = p.r - d;
    p.x += nx * pen;
    p.y += ny * pen;
    const vx = p.x - p.ox, vy = p.y - p.oy;
    const vn = vx * nx + vy * ny;
    if (vn < 0) {
      p.ox = p.x - (vx - (1 + REST) * vn * nx) * FRICTION;
      p.oy = p.y - (vy - (1 + REST) * vn * ny);
    }
    p.sleep = 0;
    return true;
  }

  function feedPebbles(def, dt) {
    feedAcc += dt * def.feedRate;
    const rnd = Math.random;
    while (feedAcc >= 1) {
      feedAcc -= 1;
      if (pebbles.length > def.pebblesN + 180) break;
      // spawn at top-left mouth of L-pipe
      const x = pipe.feedX + 14 + rnd() * Math.max(20, (pipe.rightX - pipe.feedX) * 0.5);
      const y = pipe.topY + 12 + rnd() * (pipe.topH * 0.35);
      const p = makePebble(x, y, rnd);
      p.oy = y - 1.5;
      pebbles.push(p);
    }
  }

  function spillTowardPrincess(def, dt) {
    // grace: let player see the setup before stones start spilling over
    const grace = levelIdx <= 1 ? 3.0 : 1.2;
    if (levelTime < grace) {
      // still slowly crack the ledge so meter creeps a little
      ledgeCracks = Math.min(0.15, ledgeCracks + dt * 0.02);
      return;
    }
    spillAcc += dt;
    ledgeCracks = Math.min(1, ledgeCracks + dt / def.idleLose);
    // periodic spill bursts over the wall top onto her side
    if (spillAcc >= def.spillPeriod) {
      spillAcc = 0;
      const damX = wallX + tw * cols;
      // pick stones near top of wall / right shaft upper and shove over ledge
      let spilled = 0;
      const target = 3 + Math.floor(ledgeCracks * 8);
      for (let i = 0; i < pebbles.length && spilled < target; i++) {
        const p = pebbles[i];
        if (p.x < damX - 2) continue;
        if (p.y > wallY + th * 2) continue;
        // near top of dam
        if (p.y < wallY + 10 || (p.x < damX + 30 && p.y < wallY + th * 3)) {
          p.sleep = 0;
          p.x = Math.min(p.x, damX - p.r - 2 - Math.random() * 10);
          p.ox = p.x + 2;
          p.y = wallY - p.r - 4 - Math.random() * 20;
          p.oy = p.y - 1;
          spilled++;
        }
      }
      if (spilled > 0) {
        playSfx('pressure');
        if (buryFill > 25) playSfx('pebbles');
      }
    }
  }

  function stepPhysics(def) {
    if (state !== 'play') return;
    const g = GRAV * DT * DT;
    feedPebbles(def, DT);
    spillTowardPrincess(def, DT);
    levelTime += DT;
    if (pourBurst > 0) pourBurst = Math.max(0, pourBurst - DT);

    rebuildSpat();
    const csz = spat.cell;

    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.sleep > 30) continue;
      let vx = (p.x - p.ox) * DAMP;
      let vy = (p.y - p.oy) * DAMP;
      p.ox = p.x; p.oy = p.y;
      p.x += vx;
      p.y += vy + g;
    }

    for (let iter = 0; iter < 3; iter++) {
      rebuildSpat();
      for (let i = 0; i < pebbles.length; i++) {
        const a = pebbles[i];
        if (a.sleep > 30) continue;
        const kx = (a.x / csz) | 0, ky = (a.y / csz) | 0;
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
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
    }

    // crumbling ledge solid — shrinks as cracks grow (gap opens on the right of wall top)
    const ledgeGap = ledgeCracks * tw * 2.2;
    const ledge = {
      x: wallX + tw * Math.floor(cols * 0.45),
      y: wallY - 7,
      w: Math.max(4, tw * Math.ceil(cols * 0.55) - ledgeGap),
      h: 9
    };

    // right-shaft floor: solid ONLY where rightmost tile of that band still exists
    // missing rightmost tile → open drain chute (passive gravity)
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.sleep > 30) continue;
      for (const s of solids) collideCircleAABB(p, s);
      collideCircleAABB(p, ledge);
      for (let ti = 0; ti < tiles.length; ti++) {
        if (!tiles[ti].alive) continue;
        collideCircleAABB(p, tileAABB(tiles[ti]));
      }
      // column bottom seals while bottom tile alive
      for (let c = 0; c < cols; c++) {
        let bottomAlive = false;
        for (let ti = 0; ti < tiles.length; ti++) {
          if (tiles[ti].alive && tiles[ti].c === c && tiles[ti].r === rows - 1) {
            bottomAlive = true; break;
          }
        }
        if (bottomAlive) {
          collideCircleAABB(p, {
            x: wallX + c * tw, y: wallY + rows * th - 2,
            w: tw, h: H - (wallY + rows * th) + 10
          });
        }
      }
      // shaft floor plugs per row of rightmost column
      let anyRight = false;
      for (let r = 0; r < rows; r++) {
        let alive = false;
        for (let ti = 0; ti < tiles.length; ti++) {
          if (tiles[ti].alive && tiles[ti].c === cols - 1 && tiles[ti].r === r) {
            alive = true; break;
          }
        }
        if (alive) {
          anyRight = true;
          // local floor shelf under this band keeps stones until that cell opens
          // (aggregate: one bottom floor while any rightmost remains)
        }
      }
      if (anyRight) {
        // thick multi-shelf so packed gravel can't slip under during settle
        collideCircleAABB(p, {
          x: pipe.rightX - 2, y: H - 22, w: pipe.rightW + 22, h: 36
        });
        collideCircleAABB(p, {
          x: pipe.rightX - 2, y: wallY + rows * th - 4, w: pipe.rightW + 22, h: 14
        });
      }
      // world bounds
      if (p.x - p.r < 4) { p.x = 4 + p.r; p.ox = p.x; }
      if (p.x + p.r > W - 4) { p.x = W - 4 - p.r; p.ox = p.x; }
    }

    // drain + bury
    let chamberMass = 0;
    const damX = wallX + tw * cols;
    const alive = [];
    let movingNearDrain = 0;
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.y - p.r > H + 2) { drained++; continue; }
      const spd = Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy);
      if (spd < 0.04) p.sleep++; else p.sleep = 0;
      if (spd > 0.5 && p.y > H - 80) movingNearDrain++;

      // bury pile around princess (left of dam, above wall)
      if (p.x + p.r < damX - tw * 0.15 && p.y + p.r < wallY + 8 && p.y > pipe.topY + pipe.topH) {
        chamberMass += p.r * p.r;
      }
      alive.push(p);
    }
    pebbles = alive;
    if (movingNearDrain > 4 && pourSfxT <= 0) {
      playSfx('pebbles');
      pourSfxT = 0.45;
    }
    if (pourSfxT > 0) pourSfxT -= DT;

    const chamberArea = Math.max(1, damX * 0.72 * Math.max(50, wallY - pipe.topY - pipe.topH - 10) * 0.28);
    buryFill = Math.min(100, (chamberMass / chamberArea) * 100);
    // also ramp buryFill from ledge cracks so idle always threatens
    const threat = Math.max(buryFill, ledgeCracks * 100 * 0.85 + buryFill * 0.4);
    buryFill = Math.min(100, threat);

    princessMood = buryFill > 55 ? 'panic' : (princessMood === 'happy' ? 'happy' : 'scared');

    updateDangerHud();

    const pipeMass = countPipeMass();
    const drainRatio = 1 - pipeMass / Math.max(1, pipePeak);
    if (!winPending && !losePending) {
      if (buryFill >= 90 || (ledgeCracks >= 0.97 && buryFill >= 55)) {
        losePending = true;
        setTimeout(() => endLose(), 350);
      } else if (pipeMass < pipePeak * 0.38 && drained >= Math.max(40, startCount * 0.18)) {
        winPending = true;
        princessMood = 'happy';
        setTimeout(() => endWin(), 450);
      } else if (tiles.filter(t => t.alive).length === 0 && drained >= 20) {
        winPending = true;
        princessMood = 'happy';
        setTimeout(() => endWin(), 500);
      }
    }
  }

  function updateDangerHud() {
    const pct = Math.round(buryFill);
    $('hud-stones').textContent = pct;
    $('danger-fill').style.width = pct + '%';
    $('hud-danger').classList.toggle('warn', pct >= 35);
  }

  function endWin() {
    if (state !== 'play') return;
    const stars = buryFill < 30 ? 3 : buryFill < 60 ? 2 : 1;
    const prev = save.stars[levelIdx] | 0;
    if (stars > prev) save.stars[levelIdx] = stars;
    save.coins = (save.coins | 0) + 10 * stars;
    if (save.unlocked < levelIdx + 2) save.unlocked = Math.min(N_LEVELS, levelIdx + 2);
    persist();
    $('win-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-msg').textContent = 'Труба опустела: −' + Math.round((1 - countPipeMass() / Math.max(1, pipePeak)) * 100) + '% камней';
    $('hud-coins').textContent = save.coins;
    showScreen('win');
    playSfx('win');
  }

  function endLose() {
    if (state !== 'play') return;
    showScreen('lose');
    playSfx('lose');
  }

  let curDef = levelDef(0);

  function startLevel(i) {
    levelIdx = i;
    curDef = levelDef(i);
    resize();
    layoutFromLevel(curDef);
    buildTiles(curDef);
    spawnPebbles(curDef);
    selected = null;
    hintPair = null;
    buryFill = 0;
    ledgeCracks = 0.02;
    spillAcc = 0;
    feedAcc = 0;
    levelTime = 0;
    winPending = losePending = false;
    princessMood = 'scared';
    firstMatchDone = false;
    tutStep = (i <= 1) ? 0 : 99;
    pourBurst = 0;
    boosts = { hint: 3, shuffle: 3 };
    $('c-hint').textContent = boosts.hint;
    $('c-shuffle').textContent = boosts.shuffle;
    $('hud-level').textContent = i + 1;
    $('hud-coins').textContent = save.coins | 0;
    updateDangerHud();
    showScreen('play');
    if (i <= 1) {
      hintPair = findPair();
      setHint('Нажми две одинаковые плитки с края!');
      tutStep = 1;
    } else {
      setHint('');
    }
    for (let s = 0; s < 16; s++) stepPhysics(curDef);
    // hard clear princess side after settle — no stray pebbles
    const damX = wallX + tw * cols - 2;
    for (const p of pebbles) {
      if (p.x < damX && p.y > pipe.topY + pipe.topH) {
        p.x = pipe.rightX + 20 + Math.random() * (pipe.rightW - 30);
        p.ox = p.x;
        p.y = Math.min(H - 60, wallY + Math.random() * th * 3);
        p.oy = p.y;
        p.sleep = 0;
      }
    }
    pebbles = pebbles.filter(p => p.x + p.r >= damX - 1 || p.y <= pipe.topY + pipe.topH + 2);
    buryFill = 0;
    updateDangerHud();
    pipePeak = Math.max(pipePeak, countPipeMass());
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPipeFrame() {
    ctx.save();
    const rim = Math.max(10, W * 0.028);
    ctx.fillStyle = '#e8dcc8';
    roundRect(ctx, pipe.feedX - rim, pipe.topY - rim, W - pipe.feedX + rim + 4, pipe.topH + rim * 2, 10);
    ctx.fill();
    roundRect(ctx, pipe.rightX - rim, pipe.topY, pipe.rightW + rim * 2 + 4, H - pipe.topY - 2, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130,110,80,.4)';
    ctx.lineWidth = 1.5;
    for (let y = pipe.topY; y < H; y += 20) {
      ctx.beginPath();
      ctx.moveTo(pipe.rightX - rim + 2, y);
      ctx.lineTo(W - 4, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#3d322a';
    roundRect(ctx, pipe.feedX + 2, pipe.topY + 2, W - pipe.feedX - 14, pipe.topH - 6, 6);
    ctx.fill();
    roundRect(ctx, pipe.rightX + 2, pipe.topY + 4, pipe.rightW - 8, H - pipe.topY - 20, 6);
    ctx.fill();
    // feed mouth glow
    ctx.fillStyle = 'rgba(255,180,80,.25)';
    ctx.fillRect(pipe.feedX + 4, pipe.topY + 4, 36, pipe.topH - 8);
    ctx.restore();
  }

  function drawWinLine() {
    if (state !== 'play') return;
    ctx.save();
    ctx.strokeStyle = 'rgba(129,255,160,.55)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pipe.rightX, winLineY);
    ctx.lineTo(W - 8, winLineY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(129,255,160,.85)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('цель', pipe.rightX + 6, winLineY - 4);
    ctx.restore();
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
          ctx.fillStyle = 'rgba(128,216,255,' + (0.2 + 0.15 * Math.sin(animT * 6)) + ')';
          roundRect(ctx, box.x - 2, box.y - 3, box.w + 4, box.h, 6);
          ctx.fill();
        }
      }
    }
  }

  function drawPebbles() {
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const im = imgs[p.spr];
      const s = p.r * 2.2;
      if (im) ctx.drawImage(im, p.x - s / 2, p.y - s / 2, s, s);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = '#7e57c2';
        ctx.fill();
      }
    }
  }

  function drawPrincess() {
    const im = princessMood === 'happy' ? (imgs.princessWin || imgs.princess)
      : (imgs.princessScared || imgs.princess);
    const ph = Math.floor(H * 0.26);
    const pw = ph * 0.52;
    const px = wallX + Math.max(4, (tw * cols - pw) * 0.32);
    const py = wallY - ph + 14;
    const shake = buryFill > 40 ? Math.sin(animT * 20) * (buryFill / 100) * 3 : 0;
    const bob = Math.sin(animT * 3) * 1.5;
    if (im) ctx.drawImage(im, px + shake, py + bob, pw, ph);
    // panic sweat marks
    if (princessMood === 'panic') {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.font = '16px sans-serif';
      ctx.fillText('💦', px + pw * 0.7, py + 20);
    }
  }

  function drawLedgeCracks() {
    const damX = wallX + tw * cols;
    ctx.save();
    // crumbling indicator on wall top
    ctx.fillStyle = 'rgba(255,80,40,' + (0.15 + ledgeCracks * 0.45) + ')';
    ctx.fillRect(damX - tw * 2, wallY - 10, tw * 2 + 8, 10);
    if (ledgeCracks > 0.2) {
      ctx.strokeStyle = 'rgba(255,200,100,.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(damX - 8 - i * 10, wallY - 8);
        ctx.lineTo(damX - 4 - i * 8, wallY - 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawHand() {
    if (tutStep !== 1 || !hintPair || state !== 'play') return;
    const ti = hintPair[0];
    const t = tiles[ti];
    if (!t || !t.alive) return;
    const box = tileAABB(t);
    const hx = box.x + box.w * 0.55;
    const hy = box.y + box.h * 0.6 + Math.sin(handT * 4) * 8;
    ctx.save();
    ctx.font = Math.floor(W * 0.12) + 'px serif';
    ctx.textAlign = 'center';
    ctx.fillText('👆', hx, hy + box.h * 0.55);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (imgs.bg) {
      const bw = imgs.bg.width, bh = imgs.bg.height;
      const s = Math.max(W / bw, H / bh);
      const dw = bw * s, dh = bh * s;
      ctx.drawImage(imgs.bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(10,12,20,.28)';
      ctx.fillRect(0, 0, pipe.rightX, H);
    } else {
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(0, 0, W, H);
    }
    drawPipeFrame();
    drawWinLine();
    drawTiles();
    drawLedgeCracks();
    drawPebbles();
    drawPrincess();
    drawHand();
    if (state === 'play' && buryFill > 30) {
      ctx.fillStyle = 'rgba(180,20,40,' + (0.06 + buryFill * 0.0025) + ')';
      ctx.fillRect(0, 0, wallX + tw * cols, wallY);
    }
    if (pourBurst > 0) {
      ctx.fillStyle = 'rgba(255,255,200,' + (pourBurst * 0.12) + ')';
      ctx.fillRect(pipe.rightX, wallY, pipe.rightW, H - wallY);
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

  let audioReady = false;
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
    if (a) {
      try {
        const c = a.cloneNode();
        c.volume = kind === 'pebbles' || kind === 'pressure' ? 0.55 : 0.7;
        c.play().catch(() => {});
      } catch (e) {}
      return;
    }
  }

  $('b-hint').onclick = () => {
    if (state !== 'play' || boosts.hint <= 0) return;
    const pair = findPair();
    if (!pair) { toast('Нет пары — смешай'); return; }
    boosts.hint--;
    $('c-hint').textContent = boosts.hint;
    hintPair = pair;
    selected = null;
    playSfx('hint');
    toast('Подсказка');
  };
  $('b-shuffle').onclick = () => {
    if (state !== 'play' || boosts.shuffle <= 0) return;
    boosts.shuffle--;
    $('c-shuffle').textContent = boosts.shuffle;
    const alive = tiles.filter(t => t.alive);
    const types = alive.map(t => t.type);
    for (let i = types.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [types[i], types[j]] = [types[j], types[i]];
    }
    alive.forEach((t, i) => { t.type = types[i]; });
    selected = null; hintPair = null;
    playSfx('shuffle');
    toast('Перемешано');
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
    audioMuted = !audioMuted;
    save.muted = audioMuted;
    persist();
    $('btn-mute').textContent = audioMuted ? '🔇' : '🔊';
    updateBgm();
  };

  async function checkUpdate() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.webVersion && j.webVersion !== VERSION) {
        toast('Доступна ' + j.webVersion + ' — обновляю…');
        setTimeout(() => location.reload(true), 600);
      } else toast('У вас последняя версия ' + VERSION);
    } catch (e) { toast('Нет сети для проверки'); }
  }
  $('btn-update').onclick = checkUpdate;
  $('map-update').onclick = checkUpdate;

  let acc = 0, last = performance.now();
  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += raw;
    animT += raw;
    handT += raw;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      if (state === 'play') stepPhysics(curDef);
      acc -= DT;
      steps++;
    }
    // refresh tutorial hint pair if needed
    if (state === 'play' && tutStep === 1 && levelIdx <= 1) {
      if (!hintPair || !tiles[hintPair[0]].alive || !tiles[hintPair[1]].alive) {
        hintPair = findPair();
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  $('ver-label').textContent = 'v' + VERSION;
  window.addEventListener('resize', resize);
  resize();
  loadAll().then(() => {
    showScreen('intro');
    requestAnimationFrame(frame);
  });

  window.__PM = {
    startLevel,
    stepPhysics: (n) => { for (let i = 0; i < (n || 1); i++) stepPhysics(curDef); },
    getState: () => ({
      state, levelIdx, pebbles: pebbles.length, drained, buryFill, ledgeCracks,
      tiles: tiles.filter(t => t.alive).length, pipeMass: countPipeMass(), pipePeak,
      levelTime, firstMatchDone, tutStep, W, H, VERSION
    }),
    removePairAt: (a, b) => removePair(a, b),
    findPair, tiles: () => tiles, pebbles: () => pebbles,
    idle: (sec) => {
      const steps = Math.floor(sec / DT);
      for (let i = 0; i < steps; i++) stepPhysics(curDef);
      if (losePending && state === 'play') endLose();
      if (winPending && state === 'play') endWin();
    },
    VERSION
  };
})();
