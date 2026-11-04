/* Винтики v3.1.0 — occlusion puzzle, colour pressure, Matter.js */
(function () {
  'use strict';
  const VERSION = '3.1.0';
  const COLORS = {
    red: '#e23b3b', yellow: '#f0c41a', green: '#3cb84a', blue: '#3b7aef',
    purple: '#9b4de0', orange: '#f08a2a', cyan: '#2ec4b6'
  };
  const BOX_CAP = 3;
  const SAVE_KEY = 'vintiki_save_v31';
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
  let animT = 0, particles = [], flyers = [], confetti = [];
  let tutStep = 0, tutMsg = '', hintScrewId = null, hammerMode = false;
  let outcomeGen = 0, shakeScrewId = null, shakeT = 0;
  let board = { x: 24, y: 190, w: 342, h: 360 };
  let boxes = [], waitSlots = [], maxSlots = 5;
  let planks = [], screws = [];
  let engine = null, world = null;
  let imgs = {}, audio = {}, bgmStarted = false;
  let goalText = 'Урони все доски';

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
    if (type === 'L') {
      const t = Math.min(w, h) * 0.42;
      return [[-hw, -hh], [hw, -hh], [hw, -hh + t], [-hw + t, -hh + t], [-hw + t, hh], [-hw, hh]];
    }
    if (type === 'T') {
      const t = h * 0.38;
      return [[-hw, -hh], [hw, -hh], [hw, -hh + t], [hw * 0.32, -hh + t], [hw * 0.32, hh], [-hw * 0.32, hh], [-hw * 0.32, -hh + t], [-hw, -hh + t]];
    }
    if (type === 'tri') return [[0, -hh], [hw, hh], [-hw, hh]];
    if (type === 'Z') {
      const t = h / 3;
      return [[-hw, -hh], [hw * 0.15, -hh], [hw * 0.15, -t], [hw, -t], [hw, hh], [-hw * 0.15, hh], [-hw * 0.15, t], [-hw, t]];
    }
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

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    board.w = Math.min(350, W - 40);
    board.x = (W - board.w) / 2;
    board.h = Math.min(board.w * 1.02, H * 0.46);
    board.y = Math.min(H * 0.255, 215);
  }

  function clearWorld() {
    if (engine) { World.clear(engine.world, false); Engine.clear(engine); }
    engine = Engine.create({ enableSleeping: true });
    world = engine.world; world.gravity.y = 0.95;
    World.add(world, [
      Bodies.rectangle(W / 2, H + 40, W * 2, 80, { isStatic: true }),
      Bodies.rectangle(-40, H / 2, 80, H * 2, { isStatic: true }),
      Bodies.rectangle(W + 40, H / 2, 80, H * 2, { isStatic: true })
    ]);
  }

  function startLevel(idx) {
    outcomeGen++;
    levelIdx = idx;
    state = 'play';
    showScreen('play');
    hammerMode = false; hintScrewId = null; shakeScrewId = null;
    particles = []; flyers = []; confetti = [];
    const toastEl = $('toast'); if (toastEl) toastEl.style.display = 'none';
    const def = levels[idx] || levels[0];
    goalText = def.goal || 'Урони все доски';
    maxSlots = def.slots || 5;
    if (save.boosters._extraSlots) maxSlots += save.boosters._extraSlots;
    tutStep = 0; tutMsg = '';
    if (def.tut) { tutStep = 1; tutMsg = def.tut[1] || ''; }
    else if (idx <= 2) { tutStep = 1; tutMsg = 'Урони все доски'; }

    clearWorld();
    planks = []; screws = [];
    waitSlots = Array(maxSlots).fill(null);
    boxes = (def.boxes || ['red', 'yellow']).slice(0, 2).map((c, i) => ({
      color: c, count: 0, flying: false, flyT: 0, id: 'b' + i
    }));
    layoutBoxes();

    const sorted = (def.planks || []).map((p, i) => Object.assign({}, p, { _i: i }))
      .sort((a, b) => a.layer - b.layer);
    for (const pd of sorted) {
      const cx = board.x + pd.x, cy = board.y + pd.y;
      const verts = rotatePts(shapeVerts(pd.type || 'barH', pd.w, pd.h), pd.rot || 0);
      let body;
      try {
        body = Bodies.fromVertices(cx, cy, [verts.map(([x, y]) => ({ x, y }))], {
          isStatic: true, friction: 0.35, restitution: 0.05, density: 0.002, label: 'plank'
        }, true);
      } catch (e) { body = null; }
      if (!body) body = Bodies.rectangle(cx, cy, pd.w, pd.h, { isStatic: true, angle: pd.rot || 0, label: 'plank' });
      Body.setAngle(body, pd.rot || 0);
      const plank = {
        id: pd.id || ('p' + pd._i),
        type: pd.type || 'barH', w: pd.w, h: pd.h, layer: pd.layer | 0,
        rot: pd.rot || 0, lx: pd.x, ly: pd.y,
        body, alive: true, falling: false, screwIds: [], constraint: null,
        woodTone: 0.88 + ((pd.layer | 0) % 4) * 0.04
      };
      World.add(world, body);
      planks.push(plank);
    }

    (def.screws || []).forEach((sd, i) => {
      const sc = {
        id: sd.id || ('s' + i),
        x: board.x + sd.x, y: board.y + sd.y,
        color: sd.color, plankId: sd.plankId,
        alive: true, blocked: false
      };
      const owner = planks.find(p => p.id === sc.plankId);
      if (owner) owner.screwIds.push(sc.id);
      else {
        // fallback nearest
        let best = null, bd = 1e9;
        for (const p of planks) {
          const d = (p.body.position.x - sc.x) ** 2 + (p.body.position.y - sc.y) ** 2;
          if (d < bd) { bd = d; best = p; }
        }
        if (best) { sc.plankId = best.id; best.screwIds.push(sc.id); }
      }
      screws.push(sc);
    });
    updateBlocked();
    refreshHud();
    ensureBgm();
  }

  function layoutBoxes() {
    const bw = 78, gap = 14;
    const total = boxes.length * bw + (boxes.length - 1) * gap;
    const x0 = (W - total) / 2;
    boxes.forEach((b, i) => { b.w = bw; b.h = 60; b.x = x0 + i * (bw + gap); b.y = 78; });
  }

  function ownerPlank(sc) { return planks.find(p => p.id === sc.plankId && p.alive); }

  function updateBlocked() {
    for (const sc of screws) {
      if (!sc.alive) { sc.blocked = false; continue; }
      const owner = ownerPlank(sc);
      if (!owner) { sc.blocked = true; continue; }
      sc.blocked = false;
      for (const p of planks) {
        if (!p.alive || p.falling) continue;
        if (p.layer <= owner.layer) continue;
        if (pointInPoly(sc.x, sc.y, plankWorldPoly(p))) { sc.blocked = true; break; }
      }
    }
  }

  function livingScrewsOnPlank(p) {
    return p.screwIds.filter(id => { const s = screws.find(x => x.id === id); return s && s.alive; });
  }

  function refreshPlankPhysics(p) {
    if (!p.alive || p.falling) return;
    const live = livingScrewsOnPlank(p);
    if (live.length >= 2) {
      if (!p.body.isStatic) Body.setStatic(p.body, true);
      if (p.constraint) { World.remove(world, p.constraint); p.constraint = null; }
    } else if (live.length === 1) {
      const sc = screws.find(x => x.id === live[0]);
      Body.setStatic(p.body, false);
      if (p.constraint) World.remove(world, p.constraint);
      const lx = sc.x - p.body.position.x, ly = sc.y - p.body.position.y;
      const a = -p.body.angle;
      const ox = lx * Math.cos(a) - ly * Math.sin(a);
      const oy = lx * Math.sin(a) + ly * Math.cos(a);
      p.constraint = Constraint.create({
        bodyA: p.body, pointA: { x: ox, y: oy }, pointB: { x: sc.x, y: sc.y },
        stiffness: 1, length: 0, damping: 0.18
      });
      World.add(world, p.constraint);
      p.body.frictionAir = 0.06;
    } else {
      if (p.constraint) { World.remove(world, p.constraint); p.constraint = null; }
      Body.setStatic(p.body, false);
      p.falling = true;
      Body.setAngularVelocity(p.body, (Math.random() - 0.5) * 0.08);
      playSfx('wood', 0.7);
      spawnDust(p.body.position.x, p.body.position.y);
      updateBlocked();
    }
  }

  function findBoxFor(color) {
    return boxes.find(b => !b.flying && b.color === color && b.count < BOX_CAP);
  }
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
    const x0 = (W - total) / 2 + sw / 2;
    return { x: x0 + i * (sw + gap), y: board.y + board.h + 34 };
  }

  function removeScrew(sc) {
    if (!sc.alive) return false;
    if (sc.blocked) {
      shakeScrewId = sc.id; shakeT = 0.35;
      playSfx('clunk', 0.75);
      toast('Винт под доской — сначала убери верхнюю');
      return false;
    }
    sc.alive = false;
    playSfx('screw', 0.7);
    const owner = planks.find(p => p.id === sc.plankId);
    if (owner) refreshPlankPhysics(owner);
    updateBlocked();

    const box = findBoxFor(sc.color);
    if (box) {
      flyers.push({ kind: 'toBox', color: sc.color, x: sc.x, y: sc.y, tx: box.x + box.w / 2, ty: box.y + box.h / 2, t: 0, spin: 0, boxId: box.id });
    } else {
      const slot = waitSlots.findIndex(s => !s);
      if (slot < 0) {
        flyers.push({ kind: 'fail', color: sc.color, x: sc.x, y: sc.y, t: 0, spin: 0 });
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen) endLose(); }, 450);
        return true;
      }
      waitSlots[slot] = { color: sc.color, id: sc.id };
      const sp = slotPos(slot);
      flyers.push({ kind: 'toWait', color: sc.color, x: sc.x, y: sc.y, tx: sp.x, ty: sp.y, t: 0, spin: 0 });
    }
    if (tutStep === 1) {
      tutStep = 2;
      if (levelIdx === 0) tutMsg = 'Открути остальные — доска упадёт';
      else if (levelIdx === 1) tutMsg = 'Серый винт закрыт — сначала верхнюю доску';
      else if (levelIdx === 2) tutMsg = 'Смотри на цвет коробки';
      else tutMsg = goalText;
    }
    return true;
  }

  function onFlyerArrived(f) {
    if (f.kind !== 'toBox') return;
    const box = boxes.find(b => b.id === f.boxId); if (!box) return;
    box.count++;
    playSfx('box', 0.5);
    spawnSpark(box.x + box.w / 2, box.y + box.h / 2, box.color);
    if (box.count >= BOX_CAP) { box.flying = true; box.flyT = 0; playSfx('box', 0.7); }
  }
  function tryFlushWaits() {
    let moved;
    do {
      moved = false;
      for (let i = 0; i < waitSlots.length; i++) {
        const w = waitSlots[i]; if (!w) continue;
        const box = findBoxFor(w.color); if (!box) continue;
        const sp = slotPos(i);
        flyers.push({ kind: 'toBox', color: w.color, x: sp.x, y: sp.y, tx: box.x + box.w / 2, ty: box.y + box.h / 2, t: 0, spin: 0, boxId: box.id });
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
    for (const p of planks) {
      if (p.falling && p.body.position.y > board.y + board.h + 30) {
        p.alive = false;
        if (p.constraint) { try { World.remove(world, p.constraint); } catch (e) {} p.constraint = null; }
        try { World.remove(world, p.body); } catch (e) {}
      }
    }
    const remaining = planks.filter(p => p.alive && !p.falling);
    const screwsLeft = screws.some(s => s.alive);
    if (!remaining.length && !screwsLeft) {
      const g = outcomeGen;
      if (checkWin._armed !== g) {
        checkWin._armed = g;
        setTimeout(() => { if (g === outcomeGen && state === 'play') endWin(); }, 400);
      }
    }
  }
  function endWin() {
    if (state !== 'play') return;
    state = 'win'; playSfx('win', 0.7); burstConfetti();
    const stars = 3;
    save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, stars);
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
    let best = null, bd = 30 * 30;
    for (const sc of screws) {
      if (!sc.alive) continue;
      const d = (sc.x - x) ** 2 + (sc.y - y) ** 2;
      if (d < bd) { bd = d; best = sc; }
    }
    return best;
  }
  function plankAt(x, y) {
    const ordered = planks.filter(p => p.alive && !p.falling).sort((a, b) => b.layer - a.layer);
    for (const p of ordered) if (pointInPoly(x, y, plankWorldPoly(p))) return p;
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
          if (sc) sc.alive = false;
        }
        p.screwIds = []; refreshPlankPhysics(p); hammerMode = false;
        updateBlocked(); refreshHud(); playSfx('wood', 0.8); toast('Доска сломана!');
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
    updateBlocked();
    let pick = screws.find(s => s.alive && !s.blocked && findBoxFor(s.color));
    if (!pick) pick = screws.find(s => s.alive && !s.blocked);
    if (!pick) { toast('Нет свободных винтов'); return; }
    save.boosters.hint--; persist(); hintScrewId = pick.id; refreshHud(); playSfx('btn', 0.5);
  }
  function useSlot() {
    if (state !== 'play' || save.boosters.slot <= 0) return;
    if (maxSlots >= 8) { toast('Максимум слотов'); return; }
    save.boosters.slot--; save.boosters._extraSlots = (save.boosters._extraSlots || 0) + 1;
    maxSlots++; waitSlots.push(null); persist(); refreshHud(); playSfx('btn', 0.5); toast('+1 слот');
  }
  function useHammer() {
    if (state !== 'play' || save.boosters.hammer <= 0) return;
    hammerMode = !hammerMode;
    toast(hammerMode ? 'Выбери доску для молота' : 'Молот отменён');
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
  function woodFill(ctx, tone, layer) {
    const g = ctx.createLinearGradient(-60, -40, 60, 50);
    const lift = 1 + layer * 0.06;
    const r = Math.floor(198 * tone * lift), g0 = Math.floor(148 * tone * lift), b = Math.floor(82 * tone);
    g.addColorStop(0, `rgb(${Math.min(255, r + 35)},${Math.min(255, g0 + 28)},${b + 12})`);
    g.addColorStop(0.5, `rgb(${r},${g0},${b})`);
    g.addColorStop(1, `rgb(${r - 35},${g0 - 28},${b - 18})`);
    return g;
  }

  function drawPlank(p) {
    if (!p.alive && !p.falling) return;
    if (p.body.position.y > H + 100) return;
    const poly = plankWorldPoly(p);
    ctx.save();
    // drop shadow (stronger for higher layers visually offset)
    ctx.beginPath();
    poly.forEach(([x, y], i) => i ? ctx.lineTo(x + 3 + p.layer, y + 5 + p.layer * 1.5) : ctx.moveTo(x + 3 + p.layer, y + 5 + p.layer * 1.5));
    ctx.closePath();
    ctx.fillStyle = `rgba(0,0,0,${0.18 + p.layer * 0.05})`;
    ctx.fill();

    ctx.beginPath();
    poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = woodFill(ctx, p.woodTone, p.layer);
    ctx.fill();
    // bevel
    ctx.strokeStyle = 'rgba(255,235,190,0.4)';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(70,40,15,0.55)';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(90,50,20,0.14)'; ctx.lineWidth = 1;
    const minx = Math.min(...poly.map(p => p[0])), maxx = Math.max(...poly.map(p => p[0]));
    const miny = Math.min(...poly.map(p => p[1])), maxy = Math.max(...poly.map(p => p[1]));
    for (let y = miny; y < maxy; y += 5) { ctx.beginPath(); ctx.moveTo(minx, y); ctx.lineTo(maxx, y + 1.5); ctx.stroke(); }
    ctx.restore();
    // holes
    for (const id of p.screwIds) {
      const sc = screws.find(s => s.id === id); if (!sc) continue;
      ctx.beginPath(); ctx.arc(sc.x, sc.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(25,12,5,0.55)'; ctx.fill();
    }
    ctx.restore();
  }

  function drawScrewHead(x, y, color, spin, scale, blocked, shaking) {
    const r = 18 * (scale || 1);
    ctx.save();
    ctx.translate(x + (shaking ? Math.sin(animT * 55) * 3 : 0), y);
    ctx.rotate(spin || 0);
    const im = imgs['screw_' + color];
    if (im && (color === 'red' || color === 'yellow' || color === 'green' || color === 'blue')) {
      ctx.drawImage(im, -r, -r, r * 2, r * 2);
    } else {
      // vector glossy head
      const grd = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      grd.addColorStop(0, '#fff8');
      grd.addColorStop(0.35, COLORS[color] || '#ccc');
      grd.addColorStop(1, '#0006');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[color] || '#ccc'; ctx.fill();
      ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, 0); ctx.lineTo(r * 0.42, 0);
      ctx.moveTo(0, -r * 0.42); ctx.lineTo(0, r * 0.42);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
    }
    if (blocked) {
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒', 0, 1);
    }
    ctx.restore();
  }

  function drawBoxes() {
    for (const b of boxes) {
      ctx.save();
      let y = b.y, a = 1, sc = 1;
      if (b.flying) { y = b.y - b.flyT * 120; a = 1 - b.flyT; sc = 1 + b.flyT * 0.25; }
      ctx.globalAlpha = a;
      ctx.translate(b.x + b.w / 2, y + b.h / 2); ctx.scale(sc, sc);
      ctx.translate(-(b.x + b.w / 2), -(y + b.h / 2));
      ctx.fillStyle = '#5a3a1c';
      roundRect(ctx, b.x, y, b.w, b.h, 12); ctx.fill();
      ctx.strokeStyle = COLORS[b.color]; ctx.lineWidth = 5;
      roundRect(ctx, b.x + 2, y + 2, b.w - 4, b.h - 4, 10); ctx.stroke();
      for (let i = 0; i < BOX_CAP; i++) {
        const cx = b.x + 18 + i * 22, cy = y + b.h / 2;
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
      ctx.fillStyle = 'rgba(40,22,10,0.8)'; ctx.fill();
      ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 2; ctx.stroke();
      if (waitSlots[i]) drawScrewHead(p.x, p.y, waitSlots[i].color, 0, 0.9, false, false);
    }
    ctx.fillStyle = 'rgba(255,232,192,0.75)';
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Ожидание', W / 2, slotPos(0).y + 34);
  }

  function drawTutorial() {
    if (levelIdx > 2 && tutStep === 0) return;
    ctx.save();
    // goal always
    ctx.fillStyle = 'rgba(30,15,5,0.82)';
    roundRect(ctx, board.x, board.y - 44, board.w, 30, 10); ctx.fill();
    ctx.fillStyle = '#ffe566';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(goalText, board.x + board.w / 2, board.y - 29);

    if (levelIdx <= 2 && tutMsg) {
      ctx.fillStyle = 'rgba(20,10,5,0.88)';
      roundRect(ctx, 24, board.y + board.h + 52, W - 48, 40, 12); ctx.fill();
      ctx.fillStyle = '#fff6e0';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(tutMsg, W / 2, board.y + board.h + 72);
    }
    // highlight free teaching screw
    if (levelIdx <= 1) {
      const free = screws.find(s => s.alive && !s.blocked);
      const blocked = screws.find(s => s.alive && s.blocked);
      const target = levelIdx === 1 && tutStep >= 2 && blocked ? blocked : free;
      if (target) {
        const pulse = 1 + Math.sin(animT * 6) * 0.08;
        ctx.beginPath(); ctx.arc(target.x, target.y, 28 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = target.blocked ? 'rgba(255,120,80,0.9)' : 'rgba(255,220,80,0.9)';
        ctx.lineWidth = 3; ctx.stroke();
        if (imgs.finger && !target.blocked) {
          ctx.drawImage(imgs.finger, target.x - 8, target.y + 12 + Math.sin(animT * 5) * 8, 58, 58);
        }
      }
    }
    ctx.restore();
  }

  function spawnDust(x, y) {
    for (let i = 0; i < 10; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, r: 2 + Math.random() * 3, color: '#c9a06a', t: 0, life: 0.5 });
  }
  function spawnSpark(x, y, color) {
    for (let i = 0; i < 8; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, r: 2, color: COLORS[color] || '#fff', t: 0, life: 0.4 });
  }
  function burstConfetti() {
    const cols = Object.values(COLORS);
    for (let i = 0; i < 55; i++) confetti.push({ x: W * Math.random(), y: -20, vx: (Math.random() - 0.5) * 80, vy: 80 + Math.random() * 120, rot: 0, vr: (Math.random() - 0.5) * 8, color: cols[i % cols.length], t: 0 });
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
      if (c.t > 2.5) return false;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.color; ctx.fillRect(-4, -3, 8, 6); ctx.restore();
      return true;
    });
  }
  function drawFlyers(dt) {
    flyers = flyers.filter(f => {
      f.t += dt * 2.2; f.spin += dt * 18;
      const t = Math.min(1, f.t); const e = 1 - Math.pow(1 - t, 3);
      if (f.kind === 'toBox' || f.kind === 'toWait') {
        const x = f.x + (f.tx - f.x) * e, y = f.y + (f.ty - f.y) * e - Math.sin(e * Math.PI) * 40;
        drawScrewHead(x, y, f.color, f.spin, 1.1, false, false);
        if (t >= 1) { onFlyerArrived(f); return false; }
        return true;
      }
      drawScrewHead(f.x, f.y + t * 20, f.color, f.spin, 1, false, false);
      return t < 1;
    });
  }

  function frame(dt) {
    animT += dt;
    if (shakeT > 0) shakeT -= dt;
    ctx.clearRect(0, 0, W, H);
    if (imgs.workshop_bg) ctx.drawImage(imgs.workshop_bg, 0, 0, W, H);
    else {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#5a3a1e'); bg.addColorStop(1, '#2a1a0c');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    }

    if (state === 'home') {
      if (imgs.title_plaque) {
        const tw = Math.min(W - 40, 340), th = tw * 0.35;
        ctx.drawImage(imgs.title_plaque, (W - tw) / 2, 48, tw, th);
      } else {
        ctx.fillStyle = '#fff3d0'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Винтики', W / 2, 100);
      }
      return;
    }

    if (state === 'play' || state === 'win' || state === 'lose') {
      if (engine && state === 'play') {
        Engine.update(engine, Math.min(32, dt * 1000));
        for (const p of planks) {
          if (p.constraint && p.body && Math.abs(p.body.angularVelocity) > 0.06)
            Body.setAngularVelocity(p.body, p.body.angularVelocity * 0.85);
        }
      }
      tickBoxes(dt);
      drawBoxes();
      // tray
      if (imgs.board_tray) ctx.drawImage(imgs.board_tray, board.x - 14, board.y - 14, board.w + 28, board.h + 28);
      else {
        ctx.fillStyle = '#6b4423'; roundRect(ctx, board.x - 10, board.y - 10, board.w + 20, board.h + 20, 16); ctx.fill();
        ctx.fillStyle = '#4a2f16'; roundRect(ctx, board.x, board.y, board.w, board.h, 12); ctx.fill();
      }
      const sorted = [...planks].filter(p => p.alive || p.falling).sort((a, b) => a.layer - b.layer);
      for (const p of sorted) drawPlank(p);
      for (const sc of screws) {
        if (!sc.alive) continue;
        if (hintScrewId === sc.id) {
          ctx.beginPath(); ctx.arc(sc.x, sc.y, 24 + Math.sin(animT * 8) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffe566'; ctx.lineWidth = 3; ctx.stroke();
        }
        drawScrewHead(sc.x, sc.y, sc.color, 0, 1, sc.blocked, shakeScrewId === sc.id && shakeT > 0);
      }
      drawWaitRow();
      drawFlyers(dt);
      drawTutorial();
      drawParticles(dt);
      if (state === 'play') checkWin();
      if (hammerMode) { ctx.fillStyle = 'rgba(255,100,50,0.12)'; ctx.fillRect(0, 0, W, H); }
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
    // hide HTML title card content when playing — canvas draws
    if (name === 'home') {
      // keep HTML home visible
    }
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
      cell.innerHTML = (unlocked ? (i + 1) : '🔒') + (save.stars[i] ? '<div class="stars">' + '★'.repeat(save.stars[i]) + '</div>' : '');
      if (unlocked) cell.onclick = () => startLevel(i);
      g.appendChild(cell);
    }
  }
  async function checkOta() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.webVersion && j.webVersion !== VERSION) {
        toast('Доступна ' + j.webVersion + ' — перезагрузка…');
        setTimeout(() => location.reload(), 600);
      } else toast('У вас последняя версия ' + VERSION);
    } catch (e) { toast('Не удалось проверить обновление'); }
  }
  function loadImg(src) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  function loadAudio(name, src) { const a = new Audio(src); a.preload = 'auto'; audio[name] = a; }

  async function boot() {
    resize(); window.addEventListener('resize', resize);
    $('ver').textContent = 'v' + VERSION;
    try {
      const r = await fetch('levels.json?t=' + Date.now());
      const j = await r.json();
      levels = j.levels || [];
    } catch (e) { levels = []; toast('Нет levels.json'); }
    if (!levels.length) levels = [{ name: 'empty', slots: 5, boxes: ['red'], planks: [], screws: [] }];

    const pairs = [
      ['workshop_bg', 'assets/sprites/workshop_bg.webp'],
      ['board_tray', 'assets/sprites/board_tray.webp'],
      ['finger', 'assets/sprites/finger.webp'],
      ['title_plaque', 'assets/sprites/title_plaque.webp'],
      ['screw_red', 'assets/sprites/screw_red.webp'],
      ['screw_yellow', 'assets/sprites/screw_yellow.webp'],
      ['screw_green', 'assets/sprites/screw_green.webp'],
      ['screw_blue', 'assets/sprites/screw_blue.webp']
    ];
    await Promise.all(pairs.map(async ([k, s]) => { imgs[k] = await loadImg(s); }));
    loadAudio('screw', 'assets/audio/sfx_screw.wav');
    loadAudio('clunk', 'assets/audio/sfx_clunk.wav');
    loadAudio('wood', 'assets/audio/sfx_wood.wav');
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
    $('b-hint').onclick = useHint;
    $('b-slot').onclick = useSlot;
    $('b-hammer').onclick = useHammer;

    // Improve home HTML title if plaque loaded — keep subtitle
    refreshHud();
    requestAnimationFrame(loop);

    window.__V = {
      VERSION, startLevel,
      getState: () => ({
        state, levelIdx,
        screws: screws.filter(s => s.alive).length,
        blocked: screws.filter(s => s.alive && s.blocked).length,
        planks: planks.filter(p => p.alive && !p.falling).length,
        falling: planks.filter(p => p.falling).length,
        wait: waitSlots.filter(Boolean).length,
        maxSlots,
        boxes: boxes.map(b => ({ c: b.color, n: b.count, fly: b.flying })),
        tutStep, tutMsg, goalText
      }),
      tapFree: () => {
        updateBlocked();
        const sc = screws.find(s => s.alive && !s.blocked && findBoxFor(s.color))
          || screws.find(s => s.alive && !s.blocked);
        if (sc) { removeScrew(sc); return sc.id; }
        return null;
      },
      tapBlocked: () => {
        updateBlocked();
        const sc = screws.find(s => s.alive && s.blocked);
        if (sc) { removeScrew(sc); return sc.id; }
        return null;
      },
      forceLose: () => { waitSlots = waitSlots.map(() => ({ color: 'red', id: 'x' })); endLose(); },
      idle: (sec) => {
        const steps = Math.ceil(sec / 0.016);
        for (let i = 0; i < steps; i++) {
          if (engine) Engine.update(engine, 16);
          tickBoxes(0.016); animT += 0.016;
          for (const f of flyers) f.t += 0.05;
          flyers = flyers.filter(f => { if (f.t >= 1) { onFlyerArrived(f); return false; } return true; });
          for (const b of boxes) if (b.flying) b.flyT += 0.05;
          checkWin();
        }
      },
      autoSolve: (maxSteps) => {
        let steps = 0;
        while (steps < (maxSteps || 100) && state === 'play') {
          updateBlocked();
          const id = window.__V.tapFree();
          window.__V.idle(0.3);
          steps++;
          if (!id && !screws.some(s => s.alive)) break;
          if (!id) {
            const top = [...planks].filter(p => p.alive && !p.falling).sort((a, b) => b.layer - a.layer)[0];
            if (!top) break;
            for (const sid of [...top.screwIds]) {
              const sc = screws.find(s => s.id === sid && s.alive);
              if (sc && !sc.blocked) removeScrew(sc);
              else if (sc) { sc.alive = false; }
            }
            refreshPlankPhysics(top); updateBlocked(); window.__V.idle(0.35);
          }
        }
        window.__V.idle(1.2);
        const st = window.__V.getState();
        if (st.state === 'play' && st.planks === 0 && st.screws === 0) endWin();
        return window.__V.getState();
      }
    };
  }
  boot();
})();
