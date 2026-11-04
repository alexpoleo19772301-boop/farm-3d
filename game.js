/* Винтики v3.4.1 — classic solid jigsaw knobs */
(function () {
  'use strict';
  const VERSION = '3.4.1';
  const COLORS = {
    red: '#e23b3b', yellow: '#f0c41a', green: '#3cb84a', blue: '#3b7aef',
    purple: '#9b4de0', orange: '#f08a2a'
  };
  const BOX_CAP = 3;
  const SAVE_KEY = 'vintiki_save_v32';
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const wrap = $('wrap');
  const Matter = window.Matter;
  const { Engine, World, Bodies, Body, Constraint } = Matter;

  let W = 390, H = 844, dpr = 1;
  let state = 'home', levelIdx = 0, levels = [];
  let save = loadSave();
  let muted = !!save.muted;
  let animT = 0, particles = [], flyers = [], confetti = [], shards = [];
  let screenShake = 0;
  let tutStep = 0, tutMsg = '', hintScrewId = null, hammerMode = false;
  let outcomeGen = 0, shakeScrewId = null, shakeT = 0;
  // Source UV cuts past carved lip into flat floor; dest rim matches drawTrayNine
  const TRAY_UV = { l: 0.195, t: 0.200, r: 0.195, b: 0.215 };
  const RIM_PX = 36;
  const BOARD_PAD = 10; // extra margin inside drawn rim — planks never touch lip
  const MIN_SCREW_DIST = 48;
  let screwR = 20;
  let tray = { x: 0, y: 0, w: 360, h: 360 }; // outer art draw rect
  let board = { x: 24, y: 200, w: 280, h: 280 }; // INNER playable = art floor
  let playOrigin = { x: 0, y: 0, s: 1 };
  let boxes = [], waitSlots = [], maxSlots = 5;
  let planks = [], screws = [], removedKeys = new Set();
  let engine = null, world = null;
  let imgs = {}, audio = {}, bgmStarted = false;
  let goalText = 'Урони все доски';
  let goalBannerT = 0;
  let levelBands = 1;

  function loadSave() {
    try {
      return Object.assign({
        unlocked: 1, coins: 0, stars: {}, muted: false,
        boosters: { slot: 2, hammer: 2, hint: 3 }
      }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch (e) {
      return { unlocked: 1, coins: 0, stars: {}, muted: false, boosters: { slot: 2, hammer: 2, hint: 3 } };
    }
  }
  function persist() { save.muted = muted; localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.style.display = 'none'; }, 2200);
  }
  function playSfx(name, vol) {
    if (muted) return;
    const a = audio[name]; if (!a) return;
    try { const c = a.cloneNode(); c.volume = vol == null ? 0.55 : vol; c.play().catch(() => {}); } catch (e) {}
  }
  function ensureBgm() {
    if (muted || bgmStarted) return;
    const a = audio.bgm; if (!a) return;
    a.loop = true; a.volume = 0.25;
    a.play().then(() => { bgmStarted = true; }).catch(() => {});
  }

  function shapeVerts(type, w, h) {
    const hw = w / 2, hh = h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  }
  function rotatePts(pts, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  }
  function translatePts(pts, x, y) { return pts.map(([px, py]) => [px + x, py + y]); }
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }
  function plankWorldPoly(p) {
    const ang = p.body ? p.body.angle : p.rot;
    const cx = p.body ? p.body.position.x : board.x + p.lx;
    const cy = p.body ? p.body.position.y : board.y + p.ly;
    return translatePts(rotatePts(shapeVerts(p.type, p.w, p.h), ang), cx, cy);
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

  function trayRimPx() {
    // MUST match drawTrayNine destination rim exactly
    return Math.min(RIM_PX, tray.w * 0.09, tray.h * 0.09);
  }
  function layoutTray() {
    // Room for HUD + colour boxes + goal strip, then tray fills the rest
    const boxY = 78, boxH = 62, goalStrip = 32;
    const topUI = boxY + boxH + goalStrip + 8; // ~180
    const botUI = 140;
    tray.x = 4;
    tray.w = Math.max(160, W - 8);
    tray.y = topUI;
    tray.h = Math.max(180, H - topUI - botUI);
    const rim = trayRimPx();
    // Inner floor = drawn 9-slice rim + BOARD_PAD — never let planks sit on the lip
    board.x = tray.x + rim + BOARD_PAD;
    board.y = tray.y + rim + BOARD_PAD;
    board.w = Math.max(40, tray.w - 2 * (rim + BOARD_PAD));
    board.h = Math.max(40, tray.h - 2 * (rim + BOARD_PAD));
    screwR = Math.max(16, Math.min(21, Math.min(board.w, board.h) / 20));
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutTray();
  }

  function clearWorld() {
    if (engine) { World.clear(engine.world, false); Engine.clear(engine); }
    engine = Engine.create({ enableSleeping: true });
    world = engine.world; world.gravity.y = 2.2;
    World.add(world, [
      Bodies.rectangle(W / 2, H + 40, W * 2, 80, { isStatic: true }),
      Bodies.rectangle(-40, H / 2, 80, H * 2, { isStatic: true }),
      Bodies.rectangle(W + 40, H / 2, 80, H * 2, { isStatic: true })
    ]);
  }

  function scaleLevel(def) {
    // Fit CONTENT bbox into full inner board (planks grow with the enlarged tray)
    const margin = 8;
    const usableW = Math.max(40, board.w - margin * 2);
    const usableH = Math.max(40, board.h - margin * 2);
    const srcPlanks = def.planks || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of srcPlanks) {
      minX = Math.min(minX, p.x - p.w / 2);
      minY = Math.min(minY, p.y - p.h / 2);
      maxX = Math.max(maxX, p.x + p.w / 2);
      maxY = Math.max(maxY, p.y + p.h / 2);
    }
    if (!srcPlanks.length) { minX = 0; minY = 0; maxX = 320; maxY = 320; }
    const bw = Math.max(40, maxX - minX);
    const bh = Math.max(40, maxY - minY);
    // Anisotropic fill: stretch X and Y independently so layout uses the whole tray
    const Sx = usableW / bw;
    const Sy = usableH / bh;
    const S = Math.min(Sx, Sy); // keep for playOrigin compat
    const contentW = bw * Sx, contentH = bh * Sy;
    const ox = margin + (usableW - contentW) / 2 - minX * Sx;
    const oy = margin + (usableH - contentH) / 2 - minY * Sy;
    playOrigin = { x: board.x + ox, y: board.y + oy, s: S, sx: Sx, sy: Sy };
    const planks = srcPlanks.map(p => ({
      ...p, x: ox + p.x * Sx, y: oy + p.y * Sy, w: p.w * Sx, h: p.h * Sy
    }));
    const screws = (def.screws || []).map(s => ({
      ...s, x: ox + s.x * Sx, y: oy + s.y * Sy
    }));
    // enlarge planks that can't hold their screws with full padding
    const pad = screwR + 12;
    const minD = screwR * 2.4;
    const by = {};
    for (const s of screws) (by[s.plankId] = by[s.plankId] || []).push(s);
    for (const [pid, ss] of Object.entries(by)) {
      const pl = planks.find(p => p.id === pid); if (!pl) continue;
      const n = ss.length;
      const needW = n <= 1 ? pad * 2 + 8 : (n === 2 ? pad * 2 + minD : pad * 2 + minD * 1.25);
      const needH = n <= 1 ? pad * 2 + 8 : (n === 2 ? pad * 2 + 8 : pad * 2 + minD * 1.15);
      if (pl.w < needW) pl.w = needW;
      if (pl.h < needH) pl.h = needH;
      // layout screws fully inside
      if (n === 1) { ss[0].x = pl.x; ss[0].y = pl.y; }
      else if (n === 2) {
        if (pl.w >= pl.h) {
          ss[0].x = pl.x - minD / 2; ss[0].y = pl.y;
          ss[1].x = pl.x + minD / 2; ss[1].y = pl.y;
        } else {
          ss[0].x = pl.x; ss[0].y = pl.y - minD / 2;
          ss[1].x = pl.x; ss[1].y = pl.y + minD / 2;
        }
      } else {
        const R = Math.min(pl.w, pl.h) / 2 - pad;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + i * Math.PI * 2 / n;
          ss[i].x = pl.x + Math.cos(a) * Math.max(minD * 0.58, R * 0.85);
          ss[i].y = pl.y + Math.sin(a) * Math.max(minD * 0.58, R * 0.85);
        }
      }
      for (const s of ss) {
        s.x = Math.max(pl.x - pl.w / 2 + pad, Math.min(pl.x + pl.w / 2 - pad, s.x));
        s.y = Math.max(pl.y - pl.h / 2 + pad, Math.min(pl.y + pl.h / 2 - pad, s.y));
      }
    }
    // after enlarging, push any plank AABB back inside board (relative coords 0..board)
    for (const pl of planks) {
      const hw = pl.w / 2, hh = pl.h / 2;
      pl.x = Math.max(hw + 2, Math.min(board.w - hw - 2, pl.x));
      pl.y = Math.max(hh + 2, Math.min(board.h - hh - 2, pl.y));
    }
    // re-clamp screws to (possibly moved) planks
    for (const [pid, ss] of Object.entries(by)) {
      const pl = planks.find(p => p.id === pid); if (!pl) continue;
      for (const s of ss) {
        s.x = Math.max(pl.x - pl.w / 2 + pad, Math.min(pl.x + pl.w / 2 - pad, s.x));
        s.y = Math.max(pl.y - pl.h / 2 + pad, Math.min(pl.y + pl.h / 2 - pad, s.y));
      }
    }
    // resolve plank overlaps after grow
    for (let iter = 0; iter < 40; iter++) {
      let moved = false;
      for (let i = 0; i < planks.length; i++) for (let j = i + 1; j < planks.length; j++) {
        const a = planks[i], b = planks[j];
        const ax = a.x - a.w / 2, ay = a.y - a.h / 2, bx = b.x - b.w / 2, by = b.y - b.h / 2;
        if (ax + a.w <= bx || bx + b.w <= ax || ay + a.h <= by || by + b.h <= ay) continue;
        moved = true;
        let dx = b.x - a.x || 0.01, dy = b.y - a.y || 0.01, d = Math.hypot(dx, dy) || 0.01;
        dx /= d; dy /= d;
        a.x -= dx * 3; a.y -= dy * 3; b.x += dx * 3; b.y += dy * 3;
        a.x = Math.max(a.w / 2 + 2, Math.min(board.w - a.w / 2 - 2, a.x));
        a.y = Math.max(a.h / 2 + 2, Math.min(board.h - a.h / 2 - 2, a.y));
        b.x = Math.max(b.w / 2 + 2, Math.min(board.w - b.w / 2 - 2, b.x));
        b.y = Math.max(b.h / 2 + 2, Math.min(board.h - b.h / 2 - 2, b.y));
      }
      if (!moved) break;
    }
    for (const [pid, ss] of Object.entries(by)) {
      const pl = planks.find(p => p.id === pid); if (!pl) continue;
      for (const s of ss) {
        s.x = Math.max(pl.x - pl.w / 2 + pad, Math.min(pl.x + pl.w / 2 - pad, s.x));
        s.y = Math.max(pl.y - pl.h / 2 + pad, Math.min(pl.y + pl.h / 2 - pad, s.y));
      }
    }
    // Final fill pass: expand layout toward board edges if sparse
    {
      let cminX = Infinity, cminY = Infinity, cmaxX = -Infinity, cmaxY = -Infinity;
      for (const pl of planks) {
        cminX = Math.min(cminX, pl.x - pl.w / 2);
        cminY = Math.min(cminY, pl.y - pl.h / 2);
        cmaxX = Math.max(cmaxX, pl.x + pl.w / 2);
        cmaxY = Math.max(cmaxY, pl.y + pl.h / 2);
      }
      const cw = Math.max(1, cmaxX - cminX), ch = Math.max(1, cmaxY - cminY);
      const targetW = board.w - 16, targetH = board.h - 16;
      const fx = Math.max(1, targetW / cw), fy = Math.max(1, targetH / ch);
      if (fx > 1.02 || fy > 1.02) {
        const midX = (cminX + cmaxX) / 2, midY = (cminY + cmaxY) / 2;
        const tx = board.w / 2, ty = board.h / 2;
        for (const pl of planks) {
          pl.x = tx + (pl.x - midX) * fx;
          pl.y = ty + (pl.y - midY) * fy;
          pl.w = Math.min(board.w - 8, pl.w * Math.min(fx, 1.35));
          pl.h = Math.min(board.h - 8, pl.h * Math.min(fy, 1.35));
        }
        for (const s of screws) {
          s.x = tx + (s.x - midX) * fx;
          s.y = ty + (s.y - midY) * fy;
        }
        for (const pl of planks) {
          const hw = pl.w / 2, hh = pl.h / 2;
          pl.x = Math.max(hw + 2, Math.min(board.w - hw - 2, pl.x));
          pl.y = Math.max(hh + 2, Math.min(board.h - hh - 2, pl.y));
        }
        for (const [pid, ss] of Object.entries(by)) {
          const pl = planks.find(p => p.id === pid); if (!pl) continue;
          for (const s of ss) {
            s.x = Math.max(pl.x - pl.w / 2 + pad, Math.min(pl.x + pl.w / 2 - pad, s.x));
            s.y = Math.max(pl.y - pl.h / 2 + pad, Math.min(pl.y + pl.h / 2 - pad, s.y));
          }
        }
      }
    }
    return { ...def, planks, screws };
  }

  function startLevel(idx) {
    outcomeGen++;
    levelIdx = idx;
    state = 'play';
    showScreen('play');
    hammerMode = false; hintScrewId = null; shakeScrewId = null;
    particles = []; flyers = []; confetti = []; shards = []; screenShake = 0;
    removedKeys = new Set();
    const toastEl = $('toast'); if (toastEl) toastEl.style.display = 'none';
    const raw = levels[idx] || levels[0];
    const def = scaleLevel(raw);
    goalText = def.goal || 'Урони все доски';
    goalBannerT = (def.tut || levelIdx <= 3) ? 3.5 : 2.0;
    levelBands = def.bands || 1;
    maxSlots = def.slots || 5;
    if (save.boosters._extraSlots) maxSlots += save.boosters._extraSlots;
    tutStep = 0; tutMsg = '';
    if (def.tut) { tutStep = 1; tutMsg = def.tut[1] || ''; }

    clearWorld();
    planks = []; screws = [];
    waitSlots = Array(maxSlots).fill(null);
    boxes = (def.boxes || ['red', 'yellow']).slice(0, 2).map((c, i) => ({
      color: c, count: 0, flying: false, flyT: 0, id: 'b' + i
    }));
    layoutBoxes();

    for (const pd of def.planks) {
      const cx = board.x + pd.x, cy = board.y + pd.y;
      // clamp body fully inside board
      const halfW = pd.w / 2, halfH = pd.h / 2;
      const pad = 2;
      const minX = board.x + halfW + pad, maxX = board.x + board.w - halfW - pad;
      const minY = board.y + halfH + pad, maxY = board.y + board.h - halfH - pad;
      const ccx = Math.max(minX, Math.min(maxX, cx));
      const ccy = Math.max(minY, Math.min(maxY, cy));
      const body = Bodies.rectangle(ccx, ccy, pd.w, pd.h, {
        isStatic: true, chamfer: { radius: 10 }, friction: 0.35, restitution: 0.04, density: 0.002, label: 'plank'
      });
      const plank = {
        id: pd.id, type: pd.type || 'barH', w: pd.w, h: pd.h,
        layer: 0, band: pd.band || 0, rot: 0,
        lx: pd.x, ly: pd.y,
        body, alive: true, falling: false, screwIds: [], constraint: null,
        woodTone: 0.95 + (planks.length % 4) * 0.02
      };
      World.add(world, body);
      planks.push(plank);
    }

    for (const sd of def.screws) {
      const owner = planks.find(p => p.id === sd.plankId);
      let sx = board.x + sd.x, sy = board.y + sd.y;
      if (owner) {
        const inset = screwR + 12;
        const bx = owner.body.position.x, by = owner.body.position.y;
        sx = Math.max(bx - owner.w / 2 + inset, Math.min(bx + owner.w / 2 - inset, sx));
        sy = Math.max(by - owner.h / 2 + inset, Math.min(by + owner.h / 2 - inset, sy));
      }
      const sc = {
        id: sd.id, x: sx, y: sy, color: sd.color, plankId: sd.plankId,
        alive: true, locked: !!sd.locked, keyId: sd.keyId || null,
        lockedUntilBand: sd.lockedUntilBand || 0, isKey: !!sd.isKey,
        blocked: false
      };
      if (owner) owner.screwIds.push(sc.id);
      screws.push(sc);
    }
    // final world-space: screws fully inside plank (circle ⊆ plank)
    (function separateScrews() {
      const pad = screwR + 12;
      const minD = screwR * 2.4;
      const by = {};
      for (const sc of screws) (by[sc.plankId] = by[sc.plankId] || []).push(sc);
      for (const [pid, ss] of Object.entries(by)) {
        const owner = planks.find(p => p.id === pid); if (!owner) continue;
        const bx = owner.body.position.x, byy = owner.body.position.y;
        const n = ss.length;
        const needW = n <= 1 ? pad * 2 + 8 : (n === 2 ? pad * 2 + minD : pad * 2 + minD * 1.25);
        const needH = n <= 1 ? pad * 2 + 8 : (n === 2 ? pad * 2 + 8 : pad * 2 + minD * 1.15);
        if (owner.w < needW || owner.h < needH) {
          const oldW = owner.w, oldH = owner.h;
          owner.w = Math.max(owner.w, needW);
          owner.h = Math.max(owner.h, needH);
          if (oldW > 1 && oldH > 1) Body.scale(owner.body, owner.w / oldW, owner.h / oldH);
          const hw = owner.w / 2, hh = owner.h / 2;
          const cx = Math.max(board.x + hw + 2, Math.min(board.x + board.w - hw - 2, owner.body.position.x));
          const cy = Math.max(board.y + hh + 2, Math.min(board.y + board.h - hh - 2, owner.body.position.y));
          Body.setPosition(owner.body, { x: cx, y: cy });
        }
        const ox = owner.body.position.x, oy = owner.body.position.y;
        if (n === 1) { ss[0].x = ox; ss[0].y = oy; }
        else if (n === 2) {
          if (owner.w >= owner.h) {
            ss[0].x = ox - minD / 2; ss[0].y = oy;
            ss[1].x = ox + minD / 2; ss[1].y = oy;
          } else {
            ss[0].x = ox; ss[0].y = oy - minD / 2;
            ss[1].x = ox; ss[1].y = oy + minD / 2;
          }
        } else {
          const R = Math.min(owner.w, owner.h) / 2 - pad;
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + i * Math.PI * 2 / n;
            ss[i].x = ox + Math.cos(a) * Math.max(minD * 0.58, R * 0.85);
            ss[i].y = oy + Math.sin(a) * Math.max(minD * 0.58, R * 0.85);
          }
        }
        for (const s of ss) {
          s.x = Math.max(ox - owner.w / 2 + pad, Math.min(ox + owner.w / 2 - pad, s.x));
          s.y = Math.max(oy - owner.h / 2 + pad, Math.min(oy + owner.h / 2 - pad, s.y));
        }
      }
    })();
    assignPuzzleEdges();

    updateLocks();
    refreshHud();
    ensureBgm();
  }

  function layoutBoxes() {
    const bw = 84, gap = 16, boxY = 78, boxH = 62;
    const total = boxes.length * bw + (boxes.length - 1) * gap;
    const x0 = (W - total) / 2;
    boxes.forEach((b, i) => { b.w = bw; b.h = boxH; b.x = x0 + i * (bw + gap); b.y = boxY; });
  }

  function bandCleared(band) {
    return !planks.some(p => p.alive && !p.falling && (p.band || 0) < band);
  }

  function updateLocks() {
    for (const sc of screws) {
      if (!sc.alive) { sc.blocked = false; continue; }
      let locked = false;
      if (sc.lockedUntilBand > 0 && !bandCleared(sc.lockedUntilBand)) locked = true;
      if (sc.locked && sc.keyId && !removedKeys.has(sc.keyId)) locked = true;
      sc.blocked = locked;
    }
  }

  function livingScrewsOnPlank(p) {
    return p.screwIds.filter(id => { const s = screws.find(x => x.id === id); return s && s.alive; });
  }

  function startPlankFall(p) { startPlankShatter(p); }

  function startPlankShatter(p) {
    if (!p.alive || p.falling || p.shattering) return;
    if (p.constraint) { try { World.remove(world, p.constraint); } catch (e) {} p.constraint = null; }
    try { Body.setStatic(p.body, true); } catch (e) {}
    p.falling = true; // reuse flag so band/win logic treats it as gone-in-progress
    p.shattering = true;
    const px = Number(p.body.position.x) || board.x + board.w / 2;
    const py = Number(p.body.position.y) || board.y + board.h / 2;
    const ang = Number.isFinite(p.body.angle) ? p.body.angle : 0;
    const cracks = [];
    const nCrack = 3 + (Math.random() * 3 | 0);
    for (let i = 0; i < nCrack; i++) {
      const a0 = Math.random() * Math.PI * 2;
      const len = Math.min(p.w, p.h) * (0.35 + Math.random() * 0.45);
      cracks.push({
        x0: (Math.random() - 0.5) * p.w * 0.3,
        y0: (Math.random() - 0.5) * p.h * 0.3,
        x1: Math.cos(a0) * len, y1: Math.sin(a0) * len,
        mid: 0.3 + Math.random() * 0.4,
        kink: (Math.random() - 0.5) * 18
      });
    }
    p.shatter = { t: 0, phase: 'crack', crackDur: 0.15, shards: [], cracks, px, py, ang, tone: p.woodTone };
    playSfx('wood', 0.95);
    playSfx('crack', 0.7);
    screenShake = 0.28;
    spawnDust(px, py);
    updateLocks();
  }

  function spawnShatterShards(p) {
    const sh = p.shatter; if (!sh) return;
    const n = 6 + (Math.random() * 7 | 0);
    const hw = p.w / 2, hh = p.h / 2;
    for (let i = 0; i < n; i++) {
      const lx = (Math.random() - 0.5) * p.w * 0.85;
      const ly = (Math.random() - 0.5) * p.h * 0.85;
      const c = Math.cos(sh.ang), s = Math.sin(sh.ang);
      const wx = sh.px + lx * c - ly * s;
      const wy = sh.py + lx * s + ly * c;
      const a = Math.atan2(ly, lx) + sh.ang + (Math.random() - 0.5) * 0.8;
      const spd = 90 + Math.random() * 220;
      shards.push({
        x: wx, y: wy,
        vx: Math.cos(a) * spd + (Math.random() - 0.5) * 40,
        vy: Math.sin(a) * spd - 40 - Math.random() * 80,
        w: 10 + Math.random() * Math.min(28, p.w * 0.35),
        h: 8 + Math.random() * Math.min(22, p.h * 0.35),
        rot: Math.random() * Math.PI * 2,
        omega: (Math.random() - 0.5) * 14,
        t: 0, life: 0.85 + Math.random() * 0.35,
        tone: sh.tone + (Math.random() - 0.5) * 0.06
      });
    }
    // sawdust burst
    for (let i = 0; i < 18; i++) {
      particles.push({
        x: sh.px + (Math.random() - 0.5) * p.w * 0.6,
        y: sh.py + (Math.random() - 0.5) * p.h * 0.6,
        vx: (Math.random() - 0.5) * 160,
        vy: -40 - Math.random() * 140,
        r: 1.2 + Math.random() * 2.8,
        color: Math.random() < 0.5 ? '#d2a66a' : '#a87840',
        t: 0, life: 0.55 + Math.random() * 0.45
      });
    }
  }

  function tickFalls(dt) {
    if (screenShake > 0) screenShake = Math.max(0, screenShake - dt);
    for (const p of planks) {
      if (!p.falling || !p.shatter) continue;
      const sh = p.shatter;
      sh.t += dt;
      if (sh.phase === 'crack') {
        if (sh.t >= sh.crackDur) {
          sh.phase = 'burst';
          spawnShatterShards(p);
          playSfx('wood', 0.55);
          playSfx('crack', 0.45);
          p.alive = false;
          try { World.remove(world, p.body); } catch (e) {}
        }
      } else if (sh.phase === 'burst') {
        if (sh.t >= sh.crackDur + 1.05) {
          p.falling = false; p.shattering = false; p.shatter = null;
          updateLocks();
        }
      }
    }
    // tick flying shards
    shards = shards.filter(s => {
      s.t += dt;
      s.vy += 1600 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.omega * dt;
      s.omega *= (1 - 0.4 * dt);
      return s.t < s.life && s.y < H + 80;
    });
  }

  function drawShards() {
    for (const s of shards) {
      const a = Math.max(0, 1 - s.t / s.life);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(-s.w / 2 + 2, -s.h / 2 + 3, s.w, s.h);
      roundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 3);
      ctx.fillStyle = woodFill(s.tone); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }

  function knobRadiusFor(edgeLen, w, h) {
    // head radius ~18–22% of edge, capped so it stays readable
    return Math.max(9, Math.min(edgeLen * 0.20, Math.min(w, h) * 0.22, 28));
  }

  function tabReachFor(p) {
    // tip sticks out ≈ d + R with d≈0.82R → ~1.82R
    const R = p.tabR || 12;
    return R * 1.85;
  }

  function assignPuzzleEdges() {
    for (const p of planks) {
      if (!p.alive) continue;
      const edge = Math.min(p.w, p.h);
      p.tabR = knobRadiusFor(edge, p.w, p.h);
      p.edges = { t: 0, r: 0, b: 0, l: 0 }; // 0 flat, +1 tab out, -1 blank in
    }
    const alive = planks.filter(p => p.alive && !p.falling);
    // Pair nearest facing sides as complementary tab/blank
    const used = new Set();
    const pairs = [];
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const ax = a.body.position.x, ay = a.body.position.y;
        const bx = b.body.position.x, by = b.body.position.y;
        const aL = ax - a.w / 2, aR = ax + a.w / 2, aT = ay - a.h / 2, aB = ay + a.h / 2;
        const bL = bx - b.w / 2, bR = bx + b.w / 2, bT = by - b.h / 2, bB = by + b.h / 2;
        const overlapY = Math.min(aB, bB) - Math.max(aT, bT);
        const overlapX = Math.min(aR, bR) - Math.max(aL, bL);
        if (overlapY > Math.min(a.h, b.h) * 0.3) {
          const gap = bL - aR;
          if (Math.abs(gap) < Math.max(a.w, b.w) * 0.55)
            pairs.push({ a, b, dir: 'h', gap: Math.abs(gap), score: Math.abs(gap) - overlapY * 0.01 });
        }
        if (overlapX > Math.min(a.w, b.w) * 0.3) {
          const gap = bT - aB;
          if (Math.abs(gap) < Math.max(a.h, b.h) * 0.55)
            pairs.push({ a, b, dir: 'v', gap: Math.abs(gap), score: Math.abs(gap) - overlapX * 0.01 });
        }
      }
    }
    pairs.sort((p, q) => p.score - q.score);
    for (const pr of pairs) {
      const a = pr.a, b = pr.b;
      if (pr.dir === 'h') {
        // ensure A is left of B
        const aLeft = a.body.position.x <= b.body.position.x ? a : b;
        const aRight = aLeft === a ? b : a;
        const k1 = aLeft.id + ':r', k2 = aRight.id + ':l';
        if (used.has(k1) || used.has(k2)) continue;
        const tab = Math.random() < 0.5 ? 1 : -1;
        aLeft.edges.r = tab; aRight.edges.l = -tab;
        used.add(k1); used.add(k2);
        pr._left = aLeft; pr._right = aRight; pr._paired = true;
      } else {
        const aTop = a.body.position.y <= b.body.position.y ? a : b;
        const aBot = aTop === a ? b : a;
        const k1 = aTop.id + ':b', k2 = aBot.id + ':t';
        if (used.has(k1) || used.has(k2)) continue;
        const tab = Math.random() < 0.5 ? 1 : -1;
        aTop.edges.b = tab; aBot.edges.t = -tab;
        used.add(k1); used.add(k2);
        pr._top = aTop; pr._bot = aBot; pr._paired = true;
      }
    }
    // Decorative tabs/blanks on remaining free edges
    for (const p of alive) {
      for (const k of ['t', 'r', 'b', 'l']) {
        if (p.edges[k] === 0) p.edges[k] = Math.random() < 0.55 ? 1 : -1;
      }
    }
    // Outer edges facing rim: never tab outward (blank/flat only)
    for (const p of alive) {
      const x = p.body.position.x, y = p.body.position.y;
      const reach = tabReachFor(p) + 4;
      const nearL = x - p.w / 2 < board.x + reach;
      const nearR = x + p.w / 2 > board.x + board.w - reach;
      const nearT = y - p.h / 2 < board.y + reach;
      const nearB = y + p.h / 2 > board.y + board.h - reach;
      if (nearL) p.edges.l = -1;
      if (nearR) p.edges.r = -1;
      if (nearT) p.edges.t = -1;
      if (nearB) p.edges.b = -1;
      // Guarantee a classic look: at least one outward knob if space allows
      if (![p.edges.t, p.edges.r, p.edges.b, p.edges.l].some(v => v > 0)) {
        const rooms = {
          t: y - p.h / 2 - board.y,
          b: board.y + board.h - (y + p.h / 2),
          l: x - p.w / 2 - board.x,
          r: board.x + board.w - (x + p.w / 2)
        };
        const best = Object.entries(rooms).sort((a, b) => b[1] - a[1])[0];
        if (best[1] > tabReachFor(p) + 6) p.edges[best[0]] = 1;
      }
    }
    nestPuzzlePieces(pairs);
  }

  /** Pull complementary neighbours flush so tabs seat into blanks; keep inside board. */
  function nestPuzzlePieces(pairs) {
    const alive = planks.filter(p => p.alive && !p.falling);
    for (let iter = 0; iter < 12; iter++) {
      for (const pr of pairs) {
        if (!pr._paired) continue;
        const seamGap = 0.75; // hairline between bodies; tab still fills blank
        if (pr.dir === 'h' && pr._left && pr._right) {
          const L = pr._left, R = pr._right;
          const target = (L.body.position.x + L.w / 2 + R.body.position.x - R.w / 2) / 2;
          Body.setPosition(L.body, { x: target - L.w / 2 - seamGap * 0.5, y: L.body.position.y });
          Body.setPosition(R.body, { x: target + R.w / 2 + seamGap * 0.5, y: R.body.position.y });
        } else if (pr.dir === 'v' && pr._top && pr._bot) {
          const T = pr._top, B = pr._bot;
          const target = (T.body.position.y + T.h / 2 + B.body.position.y - B.h / 2) / 2;
          Body.setPosition(T.body, { x: T.body.position.x, y: target - T.h / 2 - seamGap * 0.5 });
          Body.setPosition(B.body, { x: B.body.position.x, y: target + B.h / 2 + seamGap * 0.5 });
        }
      }
      // resolve body overlaps (bodies may not overlap; tabs occupy blanks)
      for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const ax = a.body.position.x, ay = a.body.position.y;
        const bx = b.body.position.x, by = b.body.position.y;
        const dx = (a.w + b.w) / 2 - Math.abs(bx - ax);
        const dy = (a.h + b.h) / 2 - Math.abs(by - ay);
        if (dx > 0.5 && dy > 0.5) {
          if (dx < dy) {
            const s = ax < bx ? -1 : 1;
            Body.setPosition(a.body, { x: ax + s * dx * 0.5, y: ay });
            Body.setPosition(b.body, { x: bx - s * dx * 0.5, y: by });
          } else {
            const s = ay < by ? -1 : 1;
            Body.setPosition(a.body, { x: ax, y: ay + s * dy * 0.5 });
            Body.setPosition(b.body, { x: bx, y: by - s * dy * 0.5 });
          }
        }
      }
    }
    // Clamp so body + outward tabs stay inside board
    for (const p of alive) {
      const reach = tabReachFor(p);
      const padL = (p.edges.l > 0 ? reach : 2);
      const padR = (p.edges.r > 0 ? reach : 2);
      const padT = (p.edges.t > 0 ? reach : 2);
      const padB = (p.edges.b > 0 ? reach : 2);
      let x = p.body.position.x, y = p.body.position.y;
      const minX = board.x + p.w / 2 + padL;
      const maxX = board.x + board.w - p.w / 2 - padR;
      const minY = board.y + p.h / 2 + padT;
      const maxY = board.y + board.h - p.h / 2 - padB;
      x = Math.max(minX, Math.min(maxX, x));
      y = Math.max(minY, Math.min(maxY, y));
      Body.setPosition(p.body, { x, y });
      // keep screws inside body
      for (const id of p.screwIds) {
        const sc = screws.find(s => s.id === id); if (!sc || !sc.alive) continue;
        const inset = screwR + 10;
        sc.x = Math.max(x - p.w / 2 + inset, Math.min(x + p.w / 2 - inset, sc.x));
        sc.y = Math.max(y - p.h / 2 + inset, Math.min(y + p.h / 2 - inset, sc.y));
      }
    }
  }

  /**
   * Classic jigsaw outline (one closed path). Knob = circle intersecting the edge:
   * neck narrower than head, solid fill includes the tab.
   * edges: t/r/b/l ∈ {-1,0,1}; outward normals given per side.
   */
  function jigsawPath(ctx, w, h, edges, tabR) {
    const hw = w / 2, hh = h / 2;
    function bump(x0, y0, x1, y1, kind, nx, ny) {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      if (!kind) { ctx.lineTo(x1, y1); return; }
      const R = Math.max(8, Math.min(tabR || len * 0.2, len * 0.22));
      // center offset: neck width 2*sqrt(R^2-d^2) ≈ 1.05 R (narrower than 2R head)
      const d = R * 0.82;
      const neckHalf = Math.sqrt(Math.max(R * R - d * d, 1));
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const s = kind > 0 ? 1 : -1;
      const cx = mx + nx * s * d;
      const cy = my + ny * s * d;
      const ax = mx - ux * neckHalf, ay = my - uy * neckHalf;
      const bx = mx + ux * neckHalf, by = my + uy * neckHalf;
      ctx.lineTo(ax, ay);
      const a0 = Math.atan2(ay - cy, ax - cx);
      const a1 = Math.atan2(by - cy, bx - cx);
      // Pick sweep that passes through the tip (outward for tab, inward for blank)
      const tipAng = Math.atan2(ny * s, nx * s);
      const ccw = sweepIncludes(a0, a1, tipAng, true);
      ctx.arc(cx, cy, R, a0, a1, !ccw);
      ctx.lineTo(x1, y1);
    }
    function sweepIncludes(from, to, mid, ccw) {
      const TAU = Math.PI * 2;
      const norm = a => ((a % TAU) + TAU) % TAU;
      const f = norm(from), t = norm(to), m = norm(mid);
      if (ccw) {
        if (f <= t) return m >= f && m <= t;
        return m >= f || m <= t;
      }
      if (f >= t) return m <= f && m >= t;
      return m <= f || m >= t;
    }
    ctx.moveTo(-hw, -hh);
    bump(-hw, -hh, hw, -hh, edges.t || 0, 0, -1);
    bump(hw, -hh, hw, hh, edges.r || 0, 1, 0);
    bump(hw, hh, -hw, hh, edges.b || 0, 0, 1);
    bump(-hw, hh, -hw, -hh, edges.l || 0, -1, 0);
    ctx.closePath();
  }

  function refreshPlankPhysics(p) {
    if (!p.alive || p.falling) return;
    const live = livingScrewsOnPlank(p);
    if (live.length >= 2) {
      if (!p.body.isStatic) Body.setStatic(p.body, true);
      if (p.constraint) { World.remove(world, p.constraint); p.constraint = null; }
      p.body.frictionAir = 0.12;
    } else if (live.length === 1) {
      const sc = screws.find(x => x.id === live[0]);
      Body.setStatic(p.body, false);
      if (p.constraint) World.remove(world, p.constraint);
      const lx = sc.x - p.body.position.x, ly = sc.y - p.body.position.y;
      const a = -p.body.angle;
      p.constraint = Constraint.create({
        bodyA: p.body,
        pointA: { x: lx * Math.cos(a) - ly * Math.sin(a), y: lx * Math.sin(a) + ly * Math.cos(a) },
        pointB: { x: sc.x, y: sc.y }, stiffness: 0.95, length: 0, damping: 0.05
      });
      World.add(world, p.constraint);
      p.body.frictionAir = 0.02;
      Body.setAngularVelocity(p.body, (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.06));
      Body.setVelocity(p.body, { x: (Math.random() - 0.5) * 1.5, y: 0.8 });
      p.swinging = true;
    } else {
      startPlankFall(p);
    }
  }

  function findBoxFor(color) { return boxes.find(b => !b.flying && b.color === color && b.count < BOX_CAP); }
  function nextBoxColorNeeded() {
    const need = {};
    for (const sc of screws) if (sc.alive) need[sc.color] = (need[sc.color] || 0) + 1;
    for (const w of waitSlots) if (w) need[w.color] = (need[w.color] || 0) + 1;
    const open = new Set(boxes.filter(b => !b.flying).map(b => b.color));
    const cands = Object.keys(need).filter(c => !open.has(c) && need[c] > 0);
    return cands[0] || Object.keys(need)[0] || 'red';
  }
  function slotPos(i) {
    const sw = 40, gap = 8;
    const total = maxSlots * sw + (maxSlots - 1) * gap;
    return { x: (W - total) / 2 + sw / 2 + i * (sw + gap), y: tray.y + tray.h + 30 };
  }

  function removeScrew(sc) {
    if (!sc.alive) return false;
    if (sc.blocked) {
      shakeScrewId = sc.id; shakeT = 0.35;
      playSfx('clunk', 0.75);
      if (sc.lockedUntilBand > 0) toast('Сначала урони доски верхнего ряда');
      else toast('Сначала открути винт с ключиком');
      return false;
    }
    sc.alive = false;
    removedKeys.add(sc.id);
    playSfx('screw', 0.7);
    const owner = planks.find(p => p.id === sc.plankId);
    if (owner) refreshPlankPhysics(owner);
    updateLocks();

    const box = findBoxFor(sc.color);
    if (box) {
      flyers.push({ kind: 'toBox', color: sc.color, x: sc.x, y: sc.y, tx: box.x + box.w / 2, ty: box.y + box.h / 2, t: 0, spin: 0, boxId: box.id, arc: 70 + Math.random() * 50, speed: 1.55 });
    } else {
      const slot = waitSlots.findIndex(s => !s);
      if (slot < 0) {
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen) endLose(); }, 450);
        return true;
      }
      waitSlots[slot] = { color: sc.color, id: sc.id };
      const sp = slotPos(slot);
      flyers.push({ kind: 'toWait', color: sc.color, x: sc.x, y: sc.y, tx: sp.x, ty: sp.y, t: 0, spin: 0, arc: 55 + Math.random() * 40, speed: 1.7 });
    }
    if (tutStep === 1) {
      tutStep = 2;
      tutMsg = levelIdx === 0 ? 'Открути остальные винты' :
        levelIdx === 1 ? 'Чужой цвет займёт слот ожидания' :
        levelIdx === 2 ? 'Ключик открывает замки' :
        levelIdx === 3 ? 'Освободи верхний ряд — откроется нижний' : goalText;
    }
    return true;
  }

  function onFlyerArrived(f) {
    if (f.kind !== 'toBox') return;
    const box = boxes.find(b => b.id === f.boxId); if (!box) return;
    box.count++; playSfx('box', 0.5);
    spawnSpark(box.x + box.w / 2, box.y + box.h / 2, box.color);
    if (box.count >= BOX_CAP) { box.flying = true; box.flyT = 0; }
  }
  function tryFlushWaits() {
    let moved;
    do {
      moved = false;
      for (let i = 0; i < waitSlots.length; i++) {
        const w = waitSlots[i]; if (!w) continue;
        const box = findBoxFor(w.color); if (!box) continue;
        const sp = slotPos(i);
        flyers.push({ kind: 'toBox', color: w.color, x: sp.x, y: sp.y, tx: box.x + box.w / 2, ty: box.y + box.h / 2, t: 0, spin: 0, boxId: box.id, arc: 60, speed: 1.8 });
        waitSlots[i] = null; moved = true;
      }
      const filled = waitSlots.filter(Boolean);
      waitSlots = filled.concat(Array(maxSlots - filled.length).fill(null));
    } while (moved);
  }
  function tickBoxes(dt) {
    for (const b of boxes) {
      if (!b.flying) continue;
      b.flyT += dt * 1.8;
      if (b.flyT >= 1) {
        const idx = boxes.indexOf(b);
        boxes[idx] = { color: nextBoxColorNeeded(), count: 0, flying: false, flyT: 0, id: 'b' + Date.now() + idx };
        layoutBoxes(); tryFlushWaits();
      }
    }
  }

  function checkWin() {
    if (state !== 'play') return;
    if (!planks.some(p => p.alive && !p.falling) && !screws.some(s => s.alive)) {
      const g = outcomeGen;
      if (checkWin._armed !== g) {
        checkWin._armed = g;
        setTimeout(() => { if (g === outcomeGen && state === 'play') endWin(); }, 550);
      }
    }
  }
  function endWin() {
    if (state !== 'play') return;
    state = 'win'; playSfx('win', 0.7); burstConfetti();
    save.stars[levelIdx] = 3;
    save.coins += 40 + levelIdx * 2;
    if (save.unlocked < levelIdx + 2) save.unlocked = levelIdx + 2;
    persist();
    $('win-stars').textContent = '★★★';
    $('win-coins').textContent = '+' + (40 + levelIdx * 2) + ' монет';
    showScreen('win'); refreshHud();
  }
  function endLose() {
    if (state !== 'play') return;
    state = 'lose'; playSfx('lose', 0.6); showScreen('lose');
  }

  function screwAt(x, y) {
    let best = null, bd = (screwR + 18) * (screwR + 18);
    for (const sc of screws) {
      if (!sc.alive) continue;
      const d = (sc.x - x) ** 2 + (sc.y - y) ** 2;
      if (d < bd) { bd = d; best = sc; }
    }
    return best;
  }
  function plankAt(x, y) {
    for (const p of planks) {
      if (!p.alive || p.falling) continue;
      if (pointInPoly(x, y, plankWorldPoly(p))) return p;
    }
    return null;
  }
  function onPointer(x, y) {
    if (state !== 'play') return;
    ensureBgm();
    if (hammerMode) {
      const p = plankAt(x, y);
      if (p && save.boosters.hammer > 0) {
        save.boosters.hammer--; persist();
        for (const id of [...p.screwIds]) {
          const sc = screws.find(s => s.id === id && s.alive);
          if (sc) { sc.alive = false; removedKeys.add(sc.id); }
        }
        p.screwIds = []; refreshPlankPhysics(p); hammerMode = false;
        updateLocks(); refreshHud(); playSfx('wood', 0.8); toast('Доска убрана');
      }
      return;
    }
    const sc = screwAt(x, y);
    if (!sc) return;
    removeScrew(sc);
    if (hintScrewId === sc.id) hintScrewId = null;
  }
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    onPointer(e.clientX - r.left, e.clientY - r.top);
  });

  function useHint() {
    if (state !== 'play' || save.boosters.hint <= 0) return;
    updateLocks();
    let pick = screws.find(s => s.alive && !s.blocked && findBoxFor(s.color));
    if (!pick) pick = screws.find(s => s.alive && !s.blocked);
    if (!pick) { toast('Нет свободных винтов'); return; }
    save.boosters.hint--; persist(); hintScrewId = pick.id; refreshHud();
  }
  function useSlot() {
    if (state !== 'play' || save.boosters.slot <= 0) return;
    if (maxSlots >= 8) { toast('Максимум слотов'); return; }
    save.boosters.slot--; save.boosters._extraSlots = (save.boosters._extraSlots || 0) + 1;
    maxSlots++; waitSlots.push(null); persist(); refreshHud(); toast('+1 слот');
  }
  function useHammer() {
    if (state !== 'play' || save.boosters.hammer <= 0) return;
    hammerMode = !hammerMode;
    toast(hammerMode ? 'Выбери доску' : 'Отмена');
  }

  function woodFill(tone) {
    const g = ctx.createLinearGradient(-50, -30, 50, 40);
    const r = Math.floor(205 * tone), g0 = Math.floor(155 * tone), b = Math.floor(88 * tone);
    g.addColorStop(0, `rgb(${r + 30},${g0 + 22},${b + 10})`);
    g.addColorStop(0.5, `rgb(${r},${g0},${b})`);
    g.addColorStop(1, `rgb(${r - 40},${g0 - 30},${b - 20})`);
    return g;
  }

  function drawPlank(p) {
    if (!p.alive && !p.shattering) return;
    if (p.shattering && p.shatter && p.shatter.phase === 'burst') return; // shards take over
    if (!p.body || p.body.position.y > H + 120) return;
    const edges = p.edges || { t: 0, r: 0, b: 0, l: 0 };
    const tabR = p.tabR || 10;
    const x = p.body.position.x, y = p.body.position.y;
    const ang = p.body.angle || 0;
    // drop shadow
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.translate(x + 4, y + 7); ctx.rotate(ang);
    ctx.beginPath(); jigsawPath(ctx, p.w, p.h, edges, tabR);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
    // piece body
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    const reach = tabReachFor(p);
    ctx.beginPath(); jigsawPath(ctx, p.w, p.h, edges, tabR);
    ctx.fillStyle = woodFill(p.woodTone); ctx.fill('nonzero');
    // bevel + grain clipped to FULL outline (tabs included)
    ctx.save();
    ctx.beginPath(); jigsawPath(ctx, p.w, p.h, edges, tabR);
    ctx.clip('nonzero');
    const g = ctx.createLinearGradient(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
    g.addColorStop(0, 'rgba(255,240,200,0.32)');
    g.addColorStop(0.4, 'rgba(255,240,200,0)');
    g.addColorStop(1, 'rgba(40,20,5,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(-p.w / 2 - reach, -p.h / 2 - reach, p.w + reach * 2, p.h + reach * 2);
    ctx.strokeStyle = 'rgba(90,50,20,0.2)'; ctx.lineWidth = 1.2;
    for (let yy = -p.h / 2 - reach; yy < p.h / 2 + reach; yy += 5) {
      ctx.beginPath();
      ctx.moveTo(-p.w / 2 - reach, yy);
      ctx.bezierCurveTo(-p.w / 6, yy + 1.5, p.w / 6, yy - 1.2, p.w / 2 + reach, yy + 0.8);
      ctx.stroke();
    }
    // soft inner bevel along outline
    ctx.beginPath(); jigsawPath(ctx, p.w, p.h, edges, tabR);
    ctx.strokeStyle = 'rgba(255,235,190,0.35)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); jigsawPath(ctx, p.w, p.h, edges, tabR);
    ctx.strokeStyle = 'rgba(255,235,190,0.55)'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(55,30,8,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    // crack lines during shatter
    if (p.shattering && p.shatter && p.shatter.phase === 'crack') {
      const u = Math.min(1, p.shatter.t / p.shatter.crackDur);
      ctx.strokeStyle = 'rgba(30,12,4,' + (0.35 + 0.55 * u) + ')';
      ctx.lineWidth = 1.5 + u;
      ctx.lineCap = 'round';
      for (const c of p.shatter.cracks) {
        ctx.beginPath();
        ctx.moveTo(c.x0, c.y0);
        const mx = c.x0 + c.x1 * c.mid + c.kink * u;
        const my = c.y0 + c.y1 * c.mid - c.kink * 0.4 * u;
        ctx.lineTo(mx, my);
        ctx.lineTo(c.x0 + c.x1 * u, c.y0 + c.y1 * u);
        ctx.stroke();
      }
    }
    ctx.restore();
    if (!p.shattering) {
      for (const id of p.screwIds) {
        const sc = screws.find(s => s.id === id); if (!sc || !sc.alive) continue;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, screwR * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(25,12,5,0.45)'; ctx.fill();
      }
    }
  }

  function drawScrewHead(x, y, color, spin, scale, blocked, shaking, isKey) {
    // draw ~15% smaller than layout radius so wood padding is always visible
    const r = screwR * 0.85 * (scale || 1);
    ctx.save();
    ctx.translate(x + (shaking ? Math.sin(animT * 55) * 3 : 0), y);
    ctx.rotate(spin || 0);
    const im = imgs['screw_' + color];
    if (im) ctx.drawImage(im, -r, -r, r * 2, r * 2);
    else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[color] || '#ccc'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0);
      ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, r * 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    }
    if (isKey && !blocked) {
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔑', r * 0.55, -r * 0.55);
    }
    if (blocked) {
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText('🔒', 0, 1);
    }
    ctx.restore();
  }

  function drawBoxes() {
    for (const b of boxes) {
      ctx.save();
      let y = b.y, a = 1, sc = 1;
      if (b.flying) { y = b.y - b.flyT * 120; a = 1 - b.flyT; sc = 1 + b.flyT * 0.2; }
      ctx.globalAlpha = a;
      ctx.translate(b.x + b.w / 2, y + b.h / 2); ctx.scale(sc, sc);
      ctx.translate(-(b.x + b.w / 2), -(y + b.h / 2));
      ctx.fillStyle = '#5c3a1a';
      roundRect(ctx, b.x, y, b.w, b.h, 14); ctx.fill();
      ctx.strokeStyle = COLORS[b.color]; ctx.lineWidth = 5;
      roundRect(ctx, b.x + 3, y + 3, b.w - 6, b.h - 6, 12); ctx.stroke();
      for (let i = 0; i < BOX_CAP; i++) {
        const cx = b.x + 20 + i * 22, cy = y + b.h / 2;
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        if (i < b.count) { ctx.fillStyle = COLORS[b.color]; ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      ctx.restore();
    }
  }
  function drawWaitRow() {
    for (let i = 0; i < maxSlots; i++) {
      const p = slotPos(i);
      ctx.beginPath(); ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,22,10,0.85)'; ctx.fill();
      ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 2; ctx.stroke();
      if (waitSlots[i]) drawScrewHead(p.x, p.y, waitSlots[i].color, 0, 0.9, false, false, false);
    }
    ctx.fillStyle = 'rgba(255,232,192,0.75)';
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Ожидание', W / 2, slotPos(0).y + 34);
  }

  function drawBandDivider() {
    if (levelBands < 2) return;
    // approximate mid of board
    const y = board.y + board.h * 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,150,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(board.x + 12, y); ctx.lineTo(board.x + board.w - 12, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(30,15,5,0.7)';
    roundRect(ctx, board.x + board.w / 2 - 70, y - 12, 140, 24, 8); ctx.fill();
    ctx.fillStyle = '#ffe8c0';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const locked = !bandCleared(1);
    ctx.fillText(locked ? 'Ряд 2 · закрыт 🔒' : 'Ряд 2 · открыт', board.x + board.w / 2, y);
    ctx.restore();
  }

  function drawTutorial() {
    ctx.save();
    const boxBottom = boxes.length ? (boxes[0].y + boxes[0].h) : 140;
    let gy = boxBottom + 6;
    if (gy + 28 > tray.y - 2) gy = Math.max(boxBottom + 2, tray.y - 30);
    // Goal / tutorial strip between boxes and tray — never over boxes or boosters
    if (goalBannerT > 0 && gy >= boxBottom + 2) {
      ctx.globalAlpha = Math.min(1, goalBannerT / 0.35);
      ctx.fillStyle = 'rgba(30,15,5,0.88)';
      roundRect(ctx, tray.x + 24, gy, tray.w - 48, 26, 10); ctx.fill();
      ctx.fillStyle = '#ffe566';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = (levelIdx <= 3 && tutMsg) ? tutMsg : goalText;
      ctx.fillText(label, tray.x + tray.w / 2, gy + 13);
      ctx.globalAlpha = 1;
    }
    if (levelIdx <= 1) {
      const free = screws.find(s => s.alive && !s.blocked);
      if (free) {
        const pulse = 1 + Math.sin(animT * 6) * 0.08;
        ctx.beginPath(); ctx.arc(free.x, free.y, (screwR + 8) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffe566'; ctx.lineWidth = 3; ctx.stroke();
        if (imgs.finger) ctx.drawImage(imgs.finger, free.x + 10, free.y + 8, 48, 48);
      }
    }
    ctx.restore();
  }

  function spawnDust(x, y) {
    for (let i = 0; i < 10; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 50, r: 2 + Math.random() * 3, color: '#c9a06a', t: 0, life: 0.45 });
  }
  function spawnSpark(x, y, color) {
    for (let i = 0; i < 8; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, r: 2, color: COLORS[color] || '#fff', t: 0, life: 0.35 });
  }
  function burstConfetti() {
    const cols = Object.values(COLORS);
    for (let i = 0; i < 50; i++) confetti.push({ x: W * Math.random(), y: -10, vx: (Math.random() - 0.5) * 70, vy: 90 + Math.random() * 100, rot: 0, vr: (Math.random() - 0.5) * 8, color: cols[i % cols.length], t: 0 });
  }
  function drawParticles(dt) {
    particles = particles.filter(p => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
      if (p.t > p.life) return false;
      ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      return true;
    });
    confetti = confetti.filter(c => {
      c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.t > 2.2) return false;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.color; ctx.fillRect(-4, -3, 8, 6); ctx.restore();
      return true;
    });
  }
  function drawFlyers(dt) {
    flyers = flyers.filter(f => {
      f.t += dt * (f.speed || 2.2);
      f.spin += dt * 10;
      const u = Math.min(1, f.t);
      const e = 1 - Math.pow(1 - u, 2);
      const x = f.x + (f.tx - f.x) * e;
      const y = f.y + (f.ty - f.y) * e - Math.sin(u * Math.PI) * (f.arc || 40);
      drawScrewHead(x, y, f.color, f.spin, 0.95, false, false, false);
      if (u >= 1) { onFlyerArrived(f); return false; }
      return true;
    });
  }

function drawTrayNine() {
    const img = imgs.board_tray;
    if (!img) {
      ctx.fillStyle = '#6b4423'; roundRect(ctx, tray.x, tray.y, tray.w, tray.h, 18); ctx.fill();
      ctx.fillStyle = '#4a2f16'; roundRect(ctx, board.x, board.y, board.w, board.h, 12); ctx.fill();
      return;
    }
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const sl = Math.round(iw * TRAY_UV.l), st = Math.round(ih * TRAY_UV.t);
    const sr = Math.round(iw * TRAY_UV.r), sb = Math.round(ih * TRAY_UV.b);
    const sw = iw - sl - sr, sh = ih - st - sb;
    const rim = trayRimPx();
    const dl = rim, dt = rim, dr = rim, db = rim;
    const dw = tray.w - dl - dr, dh = tray.h - dt - db;
    const dx = tray.x, dy = tray.y;
    // 9 patches
    ctx.drawImage(img, 0, 0, sl, st, dx, dy, dl, dt);
    ctx.drawImage(img, sl, 0, sw, st, dx + dl, dy, dw, dt);
    ctx.drawImage(img, sl + sw, 0, sr, st, dx + dl + dw, dy, dr, dt);
    ctx.drawImage(img, 0, st, sl, sh, dx, dy + dt, dl, dh);
    ctx.drawImage(img, sl, st, sw, sh, dx + dl, dy + dt, dw, dh);
    ctx.drawImage(img, sl + sw, st, sr, sh, dx + dl + dw, dy + dt, dr, dh);
    ctx.drawImage(img, 0, st + sh, sl, sb, dx, dy + dt + dh, dl, db);
    ctx.drawImage(img, sl, st + sh, sw, sb, dx + dl, dy + dt + dh, dw, db);
    ctx.drawImage(img, sl + sw, st + sh, sr, sb, dx + dl + dw, dy + dt + dh, dr, db);
  }

  function frame(dt) {
    animT += dt; if (shakeT > 0) shakeT -= dt;
    if (goalBannerT > 0) goalBannerT -= dt;
    ctx.clearRect(0, 0, W, H);
    if (imgs.workshop_bg) ctx.drawImage(imgs.workshop_bg, 0, 0, W, H);
    else { ctx.fillStyle = '#3a2412'; ctx.fillRect(0, 0, W, H); }

    if (state === 'home') {
      if (imgs.title_plaque) {
        const tw = Math.min(W - 36, 340), th = tw * 0.36;
        ctx.drawImage(imgs.title_plaque, (W - tw) / 2, 40, tw, th);
      }
      return;
    }

    if (state === 'play' || state === 'win' || state === 'lose') {
      if (engine && state === 'play') {
        Engine.update(engine, Math.min(32, dt * 1000));
        for (const p of planks) {
          if (p.constraint && Math.abs(p.body.angularVelocity) > 0.05)
            Body.setAngularVelocity(p.body, p.body.angularVelocity * 0.85);
        }
      }
      tickBoxes(dt);
      tickFalls(dt);
      ctx.save();
      if (screenShake > 0) {
        const mag = screenShake * 10;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }
      drawBoxes();
      drawTrayNine();
      for (const p of planks) if (p.alive || (p.shattering && p.shatter && p.shatter.phase === 'crack')) drawPlank(p);
      drawBandDivider();
      for (const sc of screws) {
        if (!sc.alive) continue;
        if (hintScrewId === sc.id) {
          ctx.beginPath(); ctx.arc(sc.x, sc.y, screwR + 8 + Math.sin(animT * 8) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffe566'; ctx.lineWidth = 3; ctx.stroke();
        }
        drawScrewHead(sc.x, sc.y, sc.color, 0, 1, sc.blocked, shakeScrewId === sc.id && shakeT > 0, sc.isKey);
      }
      drawWaitRow();
      drawTutorial();
      drawShards();
      drawFlyers(dt);
      drawParticles(dt);
      ctx.restore();
      if (state === 'play') checkWin();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt); requestAnimationFrame(loop);
  }

  function showScreen(name) {
    state = name === 'play' ? 'play' : name;
    ['home', 'map', 'win', 'lose'].forEach(s => {
      const el = $('sc-' + s); if (el) el.classList.toggle('on', s === name);
    });
    const playing = name === 'play';
    $('hud').style.display = playing ? 'block' : 'none';
    $('boosters').style.display = playing ? 'flex' : 'none';
  }
  function refreshHud() {
    $('lvl-pill').textContent = 'Ур. ' + (levelIdx + 1);
    $('coin-pill').textContent = '🪙 ' + (save.coins | 0);
    $('badge-slot').textContent = save.boosters.slot;
    $('badge-hammer').textContent = save.boosters.hammer;
    $('badge-hint').textContent = save.boosters.hint;
    $('btn-sound').textContent = muted ? '🔇' : '🔊';
    $('ver').textContent = 'v' + VERSION;
  }
  function buildMap() {
    const g = $('mapgrid'); g.innerHTML = '';
    for (let i = 0; i < levels.length; i++) {
      const cell = document.createElement('div');
      const unlocked = i < save.unlocked;
      cell.className = 'mapcell' + (unlocked ? '' : ' lock') + (save.stars[i] ? ' done' : '');
      cell.innerHTML = (unlocked ? (i + 1) : '🔒') + (save.stars[i] ? '<div class="stars">★★★</div>' : '');
      if (unlocked) cell.onclick = () => startLevel(i);
      g.appendChild(cell);
    }
  }
  async function checkOta() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.webVersion && j.webVersion !== VERSION) {
        toast('Доступна ' + j.webVersion); setTimeout(() => location.reload(), 600);
      } else toast('У вас последняя версия ' + VERSION);
    } catch (e) { toast('Нет сети для обновления'); }
  }
  function loadImg(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  function loadAudio(name, src) { const a = new Audio(src); a.preload = 'auto'; audio[name] = a; }

  function plankRects() {
    return planks.filter(p => p.alive && !p.falling).map(p => ({
      id: p.id,
      x: p.body.position.x - p.w / 2, y: p.body.position.y - p.h / 2, w: p.w, h: p.h
    }));
  }
  function assertNoOverlapRuntime() {
    const boxesA = plankRects();
    for (let i = 0; i < boxesA.length; i++) {
      for (let j = i + 1; j < boxesA.length; j++) {
        const a = boxesA[i], b = boxesA[j];
        const eps = 1.0; // flush nest counts as non-overlap
        const hit = !(a.x + a.w <= b.x + eps || b.x + b.w <= a.x + eps || a.y + a.h <= b.y + eps || b.y + b.h <= a.y + eps);
        if (hit) return { ok: false, reason: 'overlap', a: a.id, b: b.id };
      }
    }
    const eps = 0.5;
    for (const p of boxesA) {
      if (p.x < board.x - eps || p.y < board.y - eps ||
          p.x + p.w > board.x + board.w + eps || p.y + p.h > board.y + board.h + eps)
        return { ok: false, reason: 'oob', oob: p.id, plank: p, board: { ...board }, tray: { ...tray } };
    }
    return { ok: true, count: boxesA.length, board: { ...board }, tray: { ...tray } };
  }

  async function boot() {
    resize(); window.addEventListener('resize', resize);
    try {
      const r = await fetch('levels.json?t=' + Date.now());
      const j = await r.json(); levels = j.levels || [];
    } catch (e) { levels = []; }
    const pairs = [
      ['workshop_bg', 'assets/sprites/workshop_bg.webp'],
      ['board_tray', 'assets/sprites/board_tray.webp'],
      ['finger', 'assets/sprites/finger.webp'],
      ['title_plaque', 'assets/sprites/title_plaque.webp'],
      ['screw_red', 'assets/sprites/screw_red.webp'],
      ['screw_yellow', 'assets/sprites/screw_yellow.webp'],
      ['screw_green', 'assets/sprites/screw_green.webp'],
      ['screw_blue', 'assets/sprites/screw_blue.webp'],
      ['screw_purple', 'assets/sprites/screw_purple.webp'],
      ['screw_orange', 'assets/sprites/screw_orange.webp']
    ];
    await Promise.all(pairs.map(async ([k, s]) => { imgs[k] = await loadImg(s); }));
    loadAudio('screw', 'assets/audio/sfx_screw.wav');
    loadAudio('clunk', 'assets/audio/sfx_clunk.wav');
    loadAudio('wood', 'assets/audio/sfx_wood.wav');
    loadAudio('crack', 'assets/audio/sfx_pebbles.ogg');
    loadAudio('box', 'assets/audio/sfx_box.wav');
    loadAudio('win', 'assets/audio/sfx_win.wav');
    loadAudio('lose', 'assets/audio/sfx_lose_v.wav');
    loadAudio('btn', 'assets/audio/sfx_btn.ogg');
    loadAudio('bgm', 'assets/audio/music_vintiki.wav');

    $('btn-play').onclick = () => startLevel(Math.min(save.unlocked - 1, levels.length - 1));
    $('btn-home-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-map-back').onclick = () => showScreen('home');
    $('btn-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-next').onclick = () => startLevel(Math.min(levelIdx + 1, levels.length - 1));
    $('btn-win-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-retry').onclick = () => startLevel(levelIdx);
    $('btn-lose-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-sound').onclick = () => { muted = !muted; persist(); refreshHud(); if (muted && audio.bgm) audio.bgm.pause(); else ensureBgm(); };
    $('btn-update').onclick = checkOta;
    $('btn-home-update').onclick = checkOta;
    $('b-hint').onclick = useHint; $('b-slot').onclick = useSlot; $('b-hammer').onclick = useHammer;
    refreshHud(); requestAnimationFrame(loop);

    window.__V = {
      VERSION, startLevel, assertNoOverlapRuntime, plankRects, startPlankFall, startPlankShatter, assignPuzzleEdges,
      assertScrewsInside: () => {
        const bad = [];
        for (const sc of screws) {
          if (!sc.alive) continue;
          const p = planks.find(x => x.id === sc.plankId && x.alive && !x.falling);
          if (!p) continue;
          const bx = p.body.position.x, by = p.body.position.y;
          const rr = Math.min(14, Math.min(p.w, p.h) * 0.18);
          const inset = screwR + Math.max(2, rr * 0.35);
          const l = bx - p.w / 2 + inset, r = bx + p.w / 2 - inset;
          const t0 = by - p.h / 2 + inset, b0 = by + p.h / 2 - inset;
          if (sc.x < l - 0.5 || sc.x > r + 0.5 || sc.y < t0 - 0.5 || sc.y > b0 + 0.5)
            bad.push({ id: sc.id, plankId: sc.plankId, x: sc.x, y: sc.y, inset, plank: { bx, by, w: p.w, h: p.h } });
        }
        return { ok: bad.length === 0, bad, screwR };
      },

      getLayout: () => ({ W, H, tray: { ...tray }, board: { ...board }, playOrigin: { ...playOrigin }, uv: { ...TRAY_UV }, screwR, rim: trayRimPx(), boardPad: BOARD_PAD }),
      trayRimPx,
      assertPlanksInsideBoard: () => {
        const bad = [];
        for (const p of planks) {
          if (!p.alive || p.falling) continue;
          const x = p.body.position.x, y = p.body.position.y;
          const l = x - p.w / 2, r = x + p.w / 2, t0 = y - p.h / 2, b0 = y + p.h / 2;
          if (l < board.x - 0.5 || r > board.x + board.w + 0.5 || t0 < board.y - 0.5 || b0 > board.y + board.h + 0.5)
            bad.push({ id: p.id, l, r, t0, b0, board: { ...board } });
        }
        return { ok: bad.length === 0, bad, board: { ...board }, rim: trayRimPx() };
      },
      /** Pixel test: rim band from tray-only render must stay unchanged with planks drawn. */
      assertRimPixels: () => {
        const rim = trayRimPx();
        const step = 2; // sample stride in CSS pixels
        // 1) Capture tray-only reference
        const saved = planks.map(p => ({ alive: p.alive, falling: p.falling }));
        const savedS = screws.map(s => s.alive);
        for (const p of planks) { p.alive = false; p.falling = false; }
        for (const s of screws) s.alive = false;
        frame(0);
        const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // 2) Restore and draw with planks
        for (let i = 0; i < planks.length; i++) { planks[i].alive = saved[i].alive; planks[i].falling = saved[i].falling; }
        for (let i = 0; i < screws.length; i++) screws[i].alive = savedS[i];
        frame(0);
        const cur = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hits = [];
        const scale = dpr;
        // Rim band in CSS px: tray edge strip of width rim (the drawn 9-slice rim)
        const bands = [
          { x0: tray.x, y0: tray.y, x1: tray.x + tray.w, y1: tray.y + rim }, // top
          { x0: tray.x, y0: tray.y + tray.h - rim, x1: tray.x + tray.w, y1: tray.y + tray.h }, // bottom
          { x0: tray.x, y0: tray.y + rim, x1: tray.x + rim, y1: tray.y + tray.h - rim }, // left
          { x0: tray.x + tray.w - rim, y0: tray.y + rim, x1: tray.x + tray.w, y1: tray.y + tray.h - rim }, // right
        ];
        for (const b of bands) {
          for (let y = b.y0; y < b.y1; y += step) {
            for (let x = b.x0; x < b.x1; x += step) {
              const px = Math.floor(x * scale), py = Math.floor(y * scale);
              if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
              const i = (py * canvas.width + px) * 4;
              const dr = Math.abs(ref.data[i] - cur.data[i]);
              const dg = Math.abs(ref.data[i + 1] - cur.data[i + 1]);
              const db = Math.abs(ref.data[i + 2] - cur.data[i + 2]);
              // plank wood is much lighter; ignore tiny AA/anti-alias diffs
              if (dr + dg + db > 40) {
                hits.push({ x: +x.toFixed(1), y: +y.toFixed(1), dr, dg, db });
                if (hits.length > 40) break;
              }
            }
            if (hits.length > 40) break;
          }
          if (hits.length > 40) break;
        }
        return { ok: hits.length === 0, hits: hits.slice(0, 20), rim, boardPad: BOARD_PAD, tray: { ...tray }, board: { ...board } };
      },
      getScrews: () => screws.filter(s => s.alive).map(s => ({ id: s.id, x: s.x, y: s.y, plankId: s.plankId, color: s.color })),
      getFalling: () => planks.filter(p => p.falling).map(p => ({ id: p.id, shatter: p.shatter && { phase: p.shatter.phase, t: p.shatter.t } })),
      getShards: () => shards.length,
      getEdges: () => planks.filter(p => p.alive).map(p => ({ id: p.id, edges: p.edges, tabR: p.tabR, w: p.w, h: p.h })),
      getState: () => ({
        state, levelIdx,
        screws: screws.filter(s => s.alive).length,
        locked: screws.filter(s => s.alive && s.blocked).length,
        planks: planks.filter(p => p.alive && !p.falling).length,
        wait: waitSlots.filter(Boolean).length,
        boxes: boxes.map(b => ({ c: b.color, n: b.count })),
        geom: assertNoOverlapRuntime(),
        layout: { tray: { ...tray }, board: { ...board } },
        tutMsg, goalText
      }),
      tapFree: () => {
        updateLocks();
        const sc = screws.find(s => s.alive && !s.blocked && findBoxFor(s.color))
          || screws.find(s => s.alive && !s.blocked);
        if (sc) { removeScrew(sc); return sc.id; }
        return null;
      },
      tapLocked: () => {
        updateLocks();
        const sc = screws.find(s => s.alive && s.blocked);
        if (sc) { removeScrew(sc); return sc.id; }
        return null;
      },
forceLose: () => { waitSlots = waitSlots.map(() => ({ color: 'red', id: 'x' })); endLose(); },
      forceFallPlank: () => {
        const p = planks.find(x => x.alive && !x.falling);
        if (!p) return null;
        for (const id of [...p.screwIds]) {
          const sc = screws.find(s => s.id === id && s.alive);
          if (sc) { sc.alive = false; removedKeys.add(sc.id); }
        }
        p.screwIds = [];
        startPlankFall(p);
        return p.id;
      },
      idle: (sec) => {
        const steps = Math.ceil(sec / 0.016);
        for (let i = 0; i < steps; i++) {
          if (engine) Engine.update(engine, 16);
          tickFalls(0.016); tickBoxes(0.016); animT += 0.016; if (goalBannerT > 0) goalBannerT -= 0.016;
          for (const f of flyers) f.t += 0.05;
          flyers = flyers.filter(f => { if (f.t >= 1) { onFlyerArrived(f); return false; } return true; });
          for (const b of boxes) if (b.flying) b.flyT += 0.05;
          checkWin();
        }
      },
      autoSolve: (maxSteps) => {
        let steps = 0;
        while (steps++ < (maxSteps || 120) && state === 'play') {
          updateLocks();
          const id = window.__V.tapFree();
          window.__V.idle(0.28);
          if (!id && !screws.some(s => s.alive)) break;
          if (!id) break;
        }
        window.__V.idle(1.0);
        const st = window.__V.getState();
        if (st.state === 'play' && st.planks === 0 && st.screws === 0) endWin();
        return window.__V.getState();
      }
    };
  }
  boot();
})();
