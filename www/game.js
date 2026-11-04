/* Спасти принцессу: Маджонг v2.2.0 — L-pipe, circle pebbles, pair match */
(function () {
  'use strict';
  const VERSION = '2.2.0';
  const SAVE_KEY = 'princess_mahjong_v22';
  const TILE_TYPES = ['zhong', 'fa', 'frame'];
  const N_LEVELS = 36;
  const DT = 1 / 60;
  const GRAV = 980;
  const DAMP = 0.988;
  const REST = 0.18;
  const FRICTION = 0.92;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  let W = 390, H = 780, DPR = 1;
  let state = 'intro'; // intro|map|play|win|lose
  let levelIdx = 0;
  let save = loadSave();
  let imgs = {};
  let audioMuted = !!save.muted;
  let toastT = 0;

  // Level runtime
  let tiles = []; // {c,r,type,alive}
  let cols = 9, rows = 9;
  let tw = 34, th = 42, wallX = 16, wallY = 420;
  let pipe = { topY: 70, topH: 110, rightX: 250, rightW: 120 };
  let solids = []; // AABB walls of pipe frame
  let pebbles = []; // {x,y,ox,oy,r,spr,sleep,vx-ish via verlet}
  let selected = null; // tile index
  let hintPair = null;
  let drained = 0, startCount = 0;
  let buryFill = 0;
  let winPending = false, losePending = false;
  let princessMood = 'scared';
  let animT = 0;
  let boosts = { hint: 3, shuffle: 3 };
  let lastPairSnap = null;
  let spat = { cell: 24, map: new Map() };
  let pausedPhysics = false;

  function loadSave() {
    try {
      return Object.assign({
        unlocked: 1, coins: 0, stars: {}, muted: false, best: {}
      }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch (e) { return { unlocked: 1, coins: 0, stars: {}, muted: false, best: {} }; }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function levelDef(i) {
    // i 0..35 — wall sizes & pipe shapes vary; always 3 classic faces
    const colsL = 8 + (i % 3);           // 8-10
    const rowsL = 8 + ((i + 1) % 3);     // 8-10
    const types = 3;
    const pebblesN = 560 + Math.min(320, i * 8);
    const pipeW = 0.30 + (i % 5) * 0.012;
    const topH = 0.145 + (i % 3) * 0.012;
    return { cols: colsL, rows: rowsL, types, pebblesN, pipeW, topH, seed: 1000 + i * 97 };
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
    for (let i = 0; i < 6; i++) list['p' + i] = 'assets/sprites/pebbles/p' + i + '.webp';
    for (let i = 0; i < 8; i++) list['g' + i] = 'assets/sprites/pebbles/g' + i + '.webp';
    const entries = Object.entries(list);
    const loaded = await Promise.all(entries.map(([, s]) => loadImg(s)));
    entries.forEach(([k], i) => { imgs[k] = loaded[i]; });
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 1800);
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
    const hudPad = 56;
    const boostPad = 78;
    pipe.rightW = Math.floor(W * def.pipeW);
    pipe.topH = Math.floor(H * def.topH);
    pipe.topY = hudPad + 4;
    pipe.rightX = W - marginR - pipe.rightW;

    // Tile wall abuts right channel from the left (dam)
    const chamberRight = pipe.rightX; // flush against pipe
    const wallBottom = H - boostPad;
    const princessH = Math.floor(H * 0.24);
    const wallTopMin = pipe.topY + pipe.topH + Math.floor(princessH * 0.72);
    tw = Math.floor((chamberRight - marginL) / cols);
    th = Math.floor(tw * 1.20);
    let needH = th * rows;
    const maxH = wallBottom - wallTopMin;
    if (needH > maxH) {
      th = Math.floor(maxH / rows);
      tw = Math.floor(th / 1.20);
    }
    wallX = chamberRight - tw * cols; // flush right edge to pipe.rightX
    wallY = wallBottom - th * rows;

    // solids: pipe frame. Tile AABBs are the dam — no solid over tile band.
    const rim = Math.max(10, Math.floor(W * 0.028));
    solids = [];
    // ceiling of top pipe
    solids.push({ x: wallX + tw * Math.floor(cols * 0.3), y: pipe.topY - rim, w: W, h: rim });
    // left stopper of top arm (prevent dump into chamber from top)
    const topArmLeft = wallX + tw * Math.floor(cols * 0.35);
    solids.push({ x: topArmLeft - rim, y: pipe.topY, w: rim, h: pipe.topH });
    // floor of top arm ONLY left of right shaft (so stones roll into shaft)
    solids.push({ x: 0, y: pipe.topY + pipe.topH, w: pipe.rightX + 2, h: rim });
    // left wall of right shaft ABOVE the tile wall only (tiles are dam below)
    const aboveWallH = Math.max(0, wallY - (pipe.topY + pipe.topH + rim));
    if (aboveWallH > 0) {
      solids.push({ x: pipe.rightX - 6, y: pipe.topY + pipe.topH + rim - 2, w: 10, h: aboveWallH + 4 });
    }
    // cap on TOP of tile wall (right half) so stones can't climb over dam into chamber
    solids.push({
      x: wallX + tw * Math.floor(cols * 0.55),
      y: wallY - 8,
      w: tw * Math.ceil(cols * 0.45) + 8,
      h: 10
    });
    // right outer wall
    solids.push({ x: W - marginR, y: pipe.topY - rim, w: rim + 10, h: H });
    // princess chamber floor (left of dam) so overflow piles / buries
    solids.push({ x: 0, y: H - 12, w: Math.max(8, wallX + tw * cols - 10), h: 30 });
    // right-shaft floor is DYNAMIC (see stepPhysics): sealed until rightmost tiles dug
  }

  function buildTiles(def) {
    const rnd = mulberry32(def.seed);
    const nTypes = def.types;
    const types = TILE_TYPES.slice(0, nTypes);
    const cells = cols * rows;
    // even pairs
    let pool = [];
    while (pool.length < cells) {
      for (const t of types) { pool.push(t); pool.push(t); }
    }
    pool = pool.slice(0, cells);
    // if odd, force last pairable
    if (pool.length % 2) pool[pool.length - 1] = pool[0];
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    tiles = [];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({ c, r, type: pool[k++], alive: true });
      }
    }
  }

  function spawnPebbles(def) {
    pebbles = [];
    drained = 0;
    const rnd = mulberry32(def.seed + 7);
    // ~15-25px on ~390-438 wide → radius ~8-12
    const rBase = Math.max(8.5, W * 0.022);
    const rJitter = Math.max(2.2, W * 0.006);
    const topArmLeft = wallX + tw * Math.floor(cols * 0.35) + 6;
    const regions = [
      { x0: topArmLeft, y0: pipe.topY + 8, x1: W - 16, y1: pipe.topY + pipe.topH - 6 },
      { x0: pipe.rightX + 6, y0: pipe.topY + 8, x1: W - 16, y1: H - 40 }
    ];
    function packRegion(reg, spacingScale) {
      const rAvg = rBase + rJitter * 0.4;
      const dx = rAvg * 2.02 * spacingScale;
      const dy = rAvg * 1.78 * spacingScale;
      let row = 0;
      for (let y = reg.y0 + rAvg; y <= reg.y1 - rAvg; y += dy, row++) {
        const xOff = (row % 2) * dx * 0.5;
        for (let x = reg.x0 + rAvg + xOff; x <= reg.x1 - rAvg; x += dx) {
          const r = rBase + rnd() * rJitter;
          const jx = (rnd() - 0.5) * r * 0.25;
          const jy = (rnd() - 0.5) * r * 0.25;
          const spr = rnd() < 0.5 ? ('p' + ((rnd() * 6) | 0)) : ('g' + ((rnd() * 8) | 0));
          pebbles.push({ x: x + jx, y: y + jy, ox: x + jx, oy: y + jy, r, spr, sleep: 0 });
        }
      }
    }
    packRegion(regions[0], 0.84);
    packRegion(regions[1], 0.82);
    // extra random fill if under target
    let attempts = 0;
    const target = def.pebblesN;
    while (pebbles.length < target && attempts < target * 25) {
      attempts++;
      const reg = regions[attempts & 1];
      const r = rBase + rnd() * rJitter;
      const x = reg.x0 + r + rnd() * Math.max(1, reg.x1 - reg.x0 - 2 * r);
      const y = reg.y0 + r + rnd() * Math.max(1, reg.y1 - reg.y0 - 2 * r);
      let ok = true;
      for (let i = 0; i < pebbles.length; i++) {
        const p = pebbles[i];
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < (p.r + r) * (p.r + r) * 0.72) { ok = false; break; }
      }
      if (!ok) continue;
      const spr = rnd() < 0.5 ? ('p' + ((rnd() * 6) | 0)) : ('g' + ((rnd() * 8) | 0));
      pebbles.push({ x, y, ox: x, oy: y, r, spr, sleep: 0 });
    }
    startCount = pebbles.length;
    spat.cell = (rBase + rJitter) * 2.3;
  }

  function tileAABB(t) {
    return {
      x: wallX + t.c * tw,
      y: wallY + t.r * th,
      w: tw,
      h: th
    };
  }

  function isFree(ti) {
    const t = tiles[ti];
    if (!t || !t.alive) return false;
    const left = tiles.find(o => o.alive && o.r === t.r && o.c === t.c - 1);
    const right = tiles.find(o => o.alive && o.r === t.r && o.c === t.c + 1);
    // classic: free if left OR right open (also always free on rightmost abutting stones)
    if (!left || !right) return true;
    // also free if top of column (helps early game)
    const above = tiles.find(o => o.alive && o.c === t.c && o.r === t.r - 1);
    if (!above && t.r === 0) return true;
    return false;
  }

  function findPair() {
    const free = [];
    for (let i = 0; i < tiles.length; i++) if (isFree(i)) free.push(i);
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (tiles[free[i]].type === tiles[free[j]].type) return [free[i], free[j]];
      }
    }
    return null;
  }

  function removePair(a, b) {
    lastPairSnap = {
      a: { i: a, ...tiles[a] },
      b: { i: b, ...tiles[b] }
    };
    tiles[a].alive = false;
    tiles[b].alive = false;
    selected = null;
    hintPair = null;
    // wake nearby pebbles and nudge into the opened cells
    const boxes = [tileAABB(tiles[a]), tileAABB(tiles[b])];
    for (const p of pebbles) {
      for (const box of boxes) {
        if (p.x + p.r > box.x - 20 && p.x - p.r < box.x + box.w + 24 &&
            p.y + p.r > box.y - 20 && p.y - p.r < box.y + box.h + 24) {
          p.sleep = 0;
          p.ox = p.x + 1.2; // verlet: move left into hole
          p.oy = p.y - 1.5;
        }
      }
    }
    playSfx('match');
  }

  // ---- Physics ----
  function rebuildSpat() {
    spat.map.clear();
    const c = spat.cell;
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const kx = (p.x / c) | 0, ky = (p.y / c) | 0;
      const key = kx + ',' + ky;
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
    // inside or penetrating
    if (d2 < 1e-6) {
      // push out via nearest face
      const dl = p.x - box.x, dr = box.x + box.w - p.x;
      const dt = p.y - box.y, db = box.y + box.h - p.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { p.x = box.x - p.r; p.ox = p.x + (p.ox - p.x) * REST; }
      else if (m === dr) { p.x = box.x + box.w + p.r; p.ox = p.x + (p.ox - p.x) * REST; }
      else if (m === dt) { p.y = box.y - p.r; p.oy = p.y + (p.oy - p.y) * REST; }
      else { p.y = box.y + box.h + p.r; p.oy = p.y + (p.oy - p.y) * REST; }
      p.sleep = 0;
      return;
    }
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d;
    const pen = p.r - d;
    p.x += nx * pen;
    p.y += ny * pen;
    // bounce along normal lightly
    const vx = p.x - p.ox, vy = p.y - p.oy;
    const vn = vx * nx + vy * ny;
    if (vn < 0) {
      p.ox = p.x - (vx - (1 + REST) * vn * nx) * FRICTION;
      p.oy = p.y - (vy - (1 + REST) * vn * ny);
    }
    p.sleep = 0;
  }

  function stepPhysics() {
    if (pausedPhysics || state !== 'play') return;
    const g = GRAV * DT * DT;
    rebuildSpat();
    const csz = spat.cell;

    // integrate
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.sleep > 25) continue;
      let vx = (p.x - p.ox) * DAMP;
      let vy = (p.y - p.oy) * DAMP;
      p.ox = p.x; p.oy = p.y;
      p.x += vx;
      p.y += vy + g;
    }

    // circle-circle (2 iterations)
    for (let iter = 0; iter < 3; iter++) {
      rebuildSpat();
      for (let i = 0; i < pebbles.length; i++) {
        const a = pebbles[i];
        if (a.sleep > 25) continue;
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
              const as = a.sleep > 25, bs = b.sleep > 25;
              if (!as && !bs) {
                a.x -= nx * pen; a.y -= ny * pen;
                b.x += nx * pen; b.y += ny * pen;
              } else if (as) {
                b.x += nx * pen * 2; b.y += ny * pen * 2; b.sleep = 0;
              } else {
                a.x -= nx * pen * 2; a.y -= ny * pen * 2; a.sleep = 0;
              }
            }
          }
        }
      }
    }

    // solids + tiles + per-column bottom seals (open when column dug through)
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      if (p.sleep > 25) continue;
      for (const s of solids) collideCircleAABB(p, s);
      for (let ti = 0; ti < tiles.length; ti++) {
        if (!tiles[ti].alive) continue;
        collideCircleAABB(p, tileAABB(tiles[ti]));
      }
      // seal under column while bottom tile remains
      for (let c = 0; c < cols; c++) {
        let bottomAlive = false;
        for (let ti = 0; ti < tiles.length; ti++) {
          if (tiles[ti].alive && tiles[ti].c === c && tiles[ti].r === rows - 1) {
            bottomAlive = true; break;
          }
        }
        if (bottomAlive) {
          collideCircleAABB(p, {
            x: wallX + c * tw,
            y: wallY + rows * th - 2,
            w: tw,
            h: H - (wallY + rows * th) + 8
          });
        }
      }
      // Right-shaft floor plugs per tile-row: removing rightmost tile opens that band's drain
      // so gravel pours down the channel (ad look). Full seal if all rightmost still present.
      {
        const bandH = th;
        for (let r = 0; r < rows; r++) {
          let rightAlive = false;
          for (let ti = 0; ti < tiles.length; ti++) {
            if (tiles[ti].alive && tiles[ti].c === cols - 1 && tiles[ti].r === r) {
              rightAlive = true; break;
            }
          }
          if (rightAlive) {
            // plug at bottom of shaft corresponding to this band — actually hold ALL
            // stones with a continuous floor while ANY lower rightmost remains
          }
        }
        let lowestRightAlive = -1;
        for (let ti = 0; ti < tiles.length; ti++) {
          if (tiles[ti].alive && tiles[ti].c === cols - 1) {
            if (tiles[ti].r > lowestRightAlive) lowestRightAlive = tiles[ti].r;
          }
        }
        // floor under shaft stays while at least one rightmost tile exists;
        // once a gap opens in rightmost column, open floor under that gap's Y so stones fall
        if (lowestRightAlive >= 0) {
          // still have some rightmost tiles — floor at bottom, but open windows beside missing ones
          collideCircleAABB(p, {
            x: pipe.rightX - 2,
            y: H - 16,
            w: pipe.rightW + 20,
            h: 28
          });
        }
        // For each missing rightmost tile, don't collide in a vertical chute strip —
        // instead actively pull stones down when beside an open rightmost cell
        for (let r = 0; r < rows; r++) {
          let alive = false;
          for (let ti = 0; ti < tiles.length; ti++) {
            if (tiles[ti].alive && tiles[ti].c === cols - 1 && tiles[ti].r === r) {
              alive = true; break;
            }
          }
          if (!alive) {
            const by = wallY + r * th;
            if (p.x > pipe.rightX - p.r && p.y > by - 4 && p.y < by + th + 8) {
              p.sleep = 0;
              p.oy = p.y - 2.2; // accelerate downward through opened band
              // also allow leftward into the hole
              if (p.x < pipe.rightX + p.r * 2) p.ox = p.x + 1.5;
            }
          }
        }
        // If entire rightmost column gone, remove shaft floor entirely (full pour)
        if (lowestRightAlive < 0) {
          // no bottom floor collide — stones free-fall out of shaft
          if (p.x > pipe.rightX && p.y > H - 40) {
            p.sleep = 0;
            p.oy = p.y - 3;
          }
        }
      }
      if (p.x - p.r < 4) { p.x = 4 + p.r; p.ox = p.x; }
      if (p.x + p.r > W - 4) { p.x = W - 4 - p.r; p.ox = p.x; }
    }

    // drain + sleep + bury measure
    let chamberMass = 0;
    const chamberLimitX = wallX + tw * cols + 2;
    const princessFeetY = wallY - 4;
    const alive = [];
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      // drain below screen in right channel OR through open tile holes past bottom
      if (p.y - p.r > H + 4) {
        drained++;
        continue;
      }
      // sleep
      const spd = Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy);
      if (spd < 0.035) p.sleep++; else p.sleep = 0;

      // bury: pile on princess platform (left of dam, above wall top)
      if (p.x + p.r < wallX + tw * cols * 0.72 && p.y + p.r < wallY + 6 && p.y > pipe.topY + pipe.topH) {
        chamberMass += p.r * p.r;
      }
      alive.push(p);
    }
    pebbles = alive;

    const chamberArea = Math.max(1, (wallX + tw * cols * 0.72) * Math.max(40, wallY - (pipe.topY + pipe.topH) - 20) * 0.35);
    buryFill = Math.min(100, (chamberMass / chamberArea) * 100);

    // win: drained enough OR few left in pipe
    const remainRatio = pebbles.length / Math.max(1, startCount);
    const drainRatio = drained / Math.max(1, startCount);
    if (!winPending && !losePending) {
      if (buryFill >= 70) {
        losePending = true;
        setTimeout(() => endLose(), 600);
      } else {
        const tilesLeft = tiles.filter(t => t.alive).length;
        if (drainRatio >= 0.38 || (tilesLeft <= 4 && drainRatio >= 0.18) ||
            (tilesLeft === 0 && drained >= 8)) {
          winPending = true;
          princessMood = 'happy';
          setTimeout(() => endWin(), 700);
        }
      }
    }

    $('hud-stones').textContent = Math.round(buryFill);
    $('hud-danger').classList.toggle('warn', buryFill > 55);
  }

  function endWin() {
    if (state !== 'play') return;
    const stars = buryFill < 25 ? 3 : buryFill < 55 ? 2 : 1;
    const prev = save.stars[levelIdx] | 0;
    if (stars > prev) save.stars[levelIdx] = stars;
    save.coins = (save.coins | 0) + 10 * stars;
    if (save.unlocked < levelIdx + 2) save.unlocked = Math.min(N_LEVELS, levelIdx + 2);
    persist();
    $('win-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-msg').textContent = 'Слито камней: ' + Math.round(drained / Math.max(1, startCount) * 100) + '%';
    $('hud-coins').textContent = save.coins;
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
    const def = levelDef(i);
    resize();
    layoutFromLevel(def);
    buildTiles(def);
    spawnPebbles(def);
    selected = null;
    hintPair = null;
    buryFill = 0;
    winPending = losePending = false;
    princessMood = 'scared';
    boosts = { hint: 3, shuffle: 3 };
    $('c-hint').textContent = boosts.hint;
    $('c-shuffle').textContent = boosts.shuffle;
    $('hud-level').textContent = i + 1;
    $('hud-coins').textContent = save.coins | 0;
    $('hud-stones').textContent = '0';
    showScreen('play');
    // short settle so hex pack nests without emptying the top arm
    for (let s = 0; s < 18; s++) stepPhysics();
  }

  // ---- Draw ----
  function drawPipeFrame() {
    ctx.save();
    const rim = Math.max(10, W * 0.028);
    const topArmLeft = wallX + tw * Math.floor(cols * 0.35);
    ctx.fillStyle = '#e8dcc8';
    // top L arm outer
    roundRect(ctx, topArmLeft - rim, pipe.topY - rim, W - topArmLeft + rim + 4, pipe.topH + rim * 2, 10);
    ctx.fill();
    // right column outer
    roundRect(ctx, pipe.rightX - rim, pipe.topY, pipe.rightW + rim * 2 + 4, H - pipe.topY - 2, 10);
    ctx.fill();
    // block mortar lines
    ctx.strokeStyle = 'rgba(130,110,80,.4)';
    ctx.lineWidth = 1.5;
    for (let y = pipe.topY; y < H; y += 20) {
      ctx.beginPath();
      ctx.moveTo(pipe.rightX - rim + 2, y);
      ctx.lineTo(W - 4, y);
      ctx.stroke();
    }
    for (let x = topArmLeft; x < W; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, pipe.topY - rim + 2);
      ctx.lineTo(x, pipe.topY + pipe.topH + rim - 2);
      ctx.stroke();
    }
    // inner dark channel
    ctx.fillStyle = '#3d322a';
    roundRect(ctx, topArmLeft + 2, pipe.topY + 2, W - topArmLeft - 14, pipe.topH - 6, 6);
    ctx.fill();
    roundRect(ctx, pipe.rightX + 2, pipe.topY + 4, pipe.rightW - 8, H - pipe.topY - 20, 6);
    ctx.fill();
    ctx.restore();
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

  function drawTiles() {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t.alive) continue;
      const box = tileAABB(t);
      const im = imgs['t_' + t.type];
      // 3D edge
      ctx.fillStyle = '#c4a882';
      roundRect(ctx, box.x + 1, box.y + 4, box.w - 2, box.h - 2, 5);
      ctx.fill();
      if (im) {
        ctx.drawImage(im, box.x, box.y - 1, box.w, box.h - 4);
      } else {
        ctx.fillStyle = '#fffaf0';
        roundRect(ctx, box.x, box.y - 1, box.w, box.h - 6, 5);
        ctx.fill();
      }
      if (selected === i || (hintPair && (hintPair[0] === i || hintPair[1] === i))) {
        ctx.strokeStyle = selected === i ? '#ffeb3b' : '#80d8ff';
        ctx.lineWidth = 3;
        roundRect(ctx, box.x - 1, box.y - 2, box.w + 2, box.h - 2, 6);
        ctx.stroke();
      }
    }
  }

  function drawPebbles() {
    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      const im = imgs[p.spr];
      const s = p.r * 2.15;
      if (im) {
        ctx.drawImage(im, p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = '#6ec6ff';
        ctx.fill();
      }
    }
  }

  function drawPrincess() {
    const im = princessMood === 'happy' ? (imgs.princessWin || imgs.princess) : (imgs.princessScared || imgs.princess);
    // ~1/4 screen height, FEET on top of tile wall
    const ph = Math.floor(H * 0.26);
    const pw = ph * 0.52;
    const px = wallX + Math.max(4, (tw * cols - pw) * 0.35);
    const py = wallY - ph + 14; // stand on tiles
    const bob = Math.sin(animT * 3) * 1.5;
    if (im) ctx.drawImage(im, px, py + bob, pw, ph);
    else {
      ctx.fillStyle = '#ff80ab';
      ctx.fillRect(px, py, pw, ph);
    }
  }

  function drawChamber() {
    // dark left room hint if no bg
    ctx.fillStyle = 'rgba(20,24,36,.35)';
    ctx.fillRect(0, pipe.topY + pipe.topH + 8, pipe.rightX - 6, H);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (imgs.bg) {
      // cover
      const bw = imgs.bg.width, bh = imgs.bg.height;
      const s = Math.max(W / bw, H / bh);
      const dw = bw * s, dh = bh * s;
      ctx.drawImage(imgs.bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // darken left for readability
      ctx.fillStyle = 'rgba(10,12,20,.25)';
      ctx.fillRect(0, 0, pipe.rightX, H);
    } else {
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(0, 0, W, H);
      drawChamber();
    }
    drawPipeFrame();
    drawTiles();
    drawPebbles();
    drawPrincess();

    // pressure arrow / danger vignette
    if (state === 'play' && buryFill > 40) {
      ctx.fillStyle = 'rgba(180,20,40,' + (0.08 + buryFill * 0.002) + ')';
      ctx.fillRect(0, 0, wallX + tw * cols, wallY);
    }
  }

  // ---- Input ----
  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: (t.clientX - r.left) * (W / r.width),
      y: (t.clientY - r.top) * (H / r.height)
    };
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
    const p = canvasPos(e);
    const ti = hitTile(p.x, p.y);
    if (ti < 0) { selected = null; return; }
    if (!isFree(ti)) {
      toast('Плитка закрыта с боков');
      playSfx('bad');
      return;
    }
    if (selected == null) {
      selected = ti;
      playSfx('tap');
      return;
    }
    if (selected === ti) { selected = null; return; }
    if (tiles[selected].type === tiles[ti].type) {
      removePair(selected, ti);
    } else {
      toast('Нужна пара одинаковых');
      selected = ti;
      playSfx('bad');
    }
  }

  canvas.addEventListener('pointerdown', onTap, { passive: false });

  // ---- Audio (simple beeps) ----
  let ac = null;
  function ensureAC() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return ac;
  }
  function playSfx(kind) {
    if (audioMuted) return;
    const a = ensureAC();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    const now = a.currentTime;
    g.gain.value = 0.04;
    if (kind === 'match') { o.frequency.value = 520; o.type = 'triangle'; g.gain.exponentialRampToValueAtTime(0.001, now + 0.15); }
    else if (kind === 'tap') { o.frequency.value = 380; o.type = 'sine'; g.gain.exponentialRampToValueAtTime(0.001, now + 0.08); }
    else if (kind === 'win') { o.frequency.value = 660; o.type = 'triangle'; g.gain.exponentialRampToValueAtTime(0.001, now + 0.4); }
    else if (kind === 'lose') { o.frequency.value = 160; o.type = 'sawtooth'; g.gain.exponentialRampToValueAtTime(0.001, now + 0.35); }
    else { o.frequency.value = 220; o.type = 'square'; g.gain.exponentialRampToValueAtTime(0.001, now + 0.1); }
    o.start(now); o.stop(now + 0.4);
  }

  // ---- Boosters ----
  $('b-hint').onclick = () => {
    if (state !== 'play' || boosts.hint <= 0) return;
    const pair = findPair();
    if (!pair) { toast('Нет свободной пары — смешай'); return; }
    boosts.hint--;
    $('c-hint').textContent = boosts.hint;
    hintPair = pair;
    selected = null;
    toast('Подсказка подсвечена');
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
    toast('Плитки перемешаны');
  };

  // ---- Nav ----
  $('btn-play').onclick = () => { renderMap(); showScreen('map'); };
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

  // ---- Loop ----
  let acc = 0, last = performance.now();
  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += raw;
    animT += raw;
    let steps = 0;
    while (acc >= DT && steps < 4) {
      stepPhysics();
      acc -= DT;
      steps++;
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---- Boot ----
  $('ver-label').textContent = 'v' + VERSION;
  window.addEventListener('resize', () => {
    const prev = { cols, rows };
    resize();
    if (state === 'play') {
      layoutFromLevel(levelDef(levelIdx));
      // keep tiles; rescale pebbles softly into pipe
    }
  });
  resize();
  loadAll().then(() => {
    showScreen('intro');
    requestAnimationFrame(frame);
  });

  // expose for screenshots / debug
  window.__PM = {
    startLevel, stepPhysics, getState: () => ({
      state, levelIdx, pebbles: pebbles.length, drained, buryFill, tiles: tiles.filter(t => t.alive).length,
      W, H, cols, rows, tw, th, wallX, wallY, pipe, startCount
    }),
    removePairAt: (a, b) => removePair(a, b),
    findPair, tiles: () => tiles, pebbles: () => pebbles,
    VERSION
  };
})();
