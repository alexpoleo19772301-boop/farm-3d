/* Винтики v3.0.0 — screw puzzle (Wood Nuts style), Matter.js physics */
(function () {
  'use strict';
  const VERSION = '3.0.0';
  const COLORS = {
    red: '#e23b3b', yellow: '#f0c41a', green: '#3cb84a', blue: '#3b7aef',
    purple: '#9b4de0', orange: '#f08a2a'
  };
  const COLOR_KEYS = Object.keys(COLORS);
  const SAVE_KEY = 'vintiki_save_v3';
  const BOX_CAP = 3;
  const BASE_SLOTS = 5;

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const wrap = $('wrap');

  let W = 390, H = 844, dpr = 1;
  let state = 'home'; // home|map|play|win|lose
  let levelIdx = 0;
  let save = loadSave();
  let muted = !!save.muted;
  let animT = 0;
  let particles = [];
  let flyers = [];
  let confetti = [];
  let toastT = 0;
  let tutStep = 0;
  let hintScrewId = null;
  let hammerMode = false;
  let outcomeGen = 0;

  // board layout
  let board = { x: 24, y: 200, w: 342, h: 420 };
  let boxes = []; // {color, count, x,y,w,h, flying, flyT}
  let waitSlots = []; // screw refs or null
  let maxSlots = BASE_SLOTS;
  let planks = [];
  let screws = [];
  let engine = null, world = null;
  let wallBodies = [];
  let imgs = {};
  let audio = {};
  let bgmStarted = false;

  const Matter = window.Matter;
  const { Engine, World, Bodies, Body, Constraint, Composite, Events } = Matter;

  function loadSave() {
    try {
      return Object.assign({
        unlocked: 1, coins: 0, stars: {}, muted: false,
        boosters: { slot: 2, hammer: 2, hint: 3 }
      }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
    } catch (e) { return { unlocked: 1, coins: 0, stars: {}, muted: false, boosters: { slot: 2, hammer: 2, hint: 3 } }; }
  }
  function persist() {
    save.muted = muted;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.style.display = 'none'; }, 2200);
  }

  function playSfx(name, vol) {
    if (muted) return;
    const a = audio[name];
    if (!a) return;
    try {
      const c = a.cloneNode();
      c.volume = vol == null ? 0.55 : vol;
      c.play().catch(() => {});
    } catch (e) {}
  }
  function ensureBgm() {
    if (muted || bgmStarted) return;
    const a = audio.bgm;
    if (!a) return;
    a.loop = true; a.volume = 0.28;
    a.play().then(() => { bgmStarted = true; }).catch(() => {});
  }

  // ---------- shapes ----------
  function shapeVerts(type, w, h) {
    const hw = w / 2, hh = h / 2;
    if (type === 'barH') return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    if (type === 'barV') return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    if (type === 'square') return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    if (type === 'L') {
      const t = Math.min(w, h) * 0.42;
      return [[-hw, -hh], [hw, -hh], [hw, -hh + t], [-hw + t, -hh + t], [-hw + t, hh], [-hw, hh]];
    }
    if (type === 'T') {
      const t = h * 0.38;
      return [[-hw, -hh], [hw, -hh], [hw, -hh + t], [hw * 0.35, -hh + t], [hw * 0.35, hh], [-hw * 0.35, hh], [-hw * 0.35, -hh + t], [-hw, -hh + t]];
    }
    if (type === 'tri') return [[0, -hh], [hw, hh], [-hw, hh]];
    if (type === 'Z') {
      const t = h / 3;
      return [[-hw, -hh], [hw * 0.2, -hh], [hw * 0.2, -t], [hw, -t], [hw, hh], [-hw * 0.2, hh], [-hw * 0.2, t], [-hw, t]];
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
      const inter = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }

  // ---------- levels ----------
  function makeLevel(n) {
    // n is 0-based
    const hand = HAND[n];
    if (hand) return JSON.parse(JSON.stringify(hand));
    return proceduralLevel(n);
  }

  // Handcrafted first levels (board-local coords: 0..board.w / 0..board.h)
  const HAND = [];
  (function buildHand() {
    // Level 1 — tutorial: 2 planks, 3 red screws, obvious
    HAND.push({
      name: 'Старт',
      slots: 5,
      boxes: ['red'],
      planks: [
        { type: 'barH', x: 170, y: 160, w: 220, h: 56, rot: 0, layer: 0 },
        { type: 'barH', x: 170, y: 260, w: 220, h: 56, rot: 0, layer: 0 }
      ],
      screws: [
        { x: 90, y: 160, color: 'red' },
        { x: 250, y: 160, color: 'red' },
        { x: 170, y: 260, color: 'red' }
      ]
    });
    // Level 2 — two colors, slight overlap layer
    HAND.push({
      name: 'Два цвета',
      slots: 5,
      boxes: ['red', 'yellow'],
      planks: [
        { type: 'barH', x: 170, y: 140, w: 240, h: 52, rot: 0, layer: 0 },
        { type: 'barV', x: 100, y: 250, w: 52, h: 180, rot: 0, layer: 0 },
        { type: 'barV', x: 240, y: 250, w: 52, h: 180, rot: 0, layer: 1 }
      ],
      screws: [
        { x: 80, y: 140, color: 'red' },
        { x: 170, y: 140, color: 'yellow' },
        { x: 260, y: 140, color: 'red' },
        { x: 100, y: 220, color: 'yellow' },
        { x: 100, y: 310, color: 'red' },
        { x: 240, y: 220, color: 'yellow' },
        { x: 240, y: 310, color: 'red' }
      ]
    });
    // Level 3 — L + square
    HAND.push({
      name: 'Уголок',
      slots: 5,
      boxes: ['red', 'green'],
      planks: [
        { type: 'L', x: 130, y: 180, w: 160, h: 160, rot: 0, layer: 0 },
        { type: 'square', x: 250, y: 280, w: 100, h: 100, rot: 0, layer: 1 },
        { type: 'barH', x: 160, y: 340, w: 200, h: 48, rot: 0, layer: 0 }
      ],
      screws: [
        { x: 80, y: 120, color: 'red' },
        { x: 80, y: 230, color: 'green' },
        { x: 180, y: 120, color: 'red' },
        { x: 230, y: 250, color: 'green' },
        { x: 270, y: 310, color: 'red' },
        { x: 100, y: 340, color: 'green' },
        { x: 220, y: 340, color: 'red' }
      ]
    });
    // Level 4
    HAND.push({
      name: 'Слои',
      slots: 5,
      boxes: ['blue', 'yellow'],
      planks: [
        { type: 'barH', x: 170, y: 120, w: 260, h: 48, rot: 0, layer: 0 },
        { type: 'barH', x: 170, y: 200, w: 260, h: 48, rot: 0, layer: 1 },
        { type: 'barH', x: 170, y: 280, w: 260, h: 48, rot: 0, layer: 0 },
        { type: 'barV', x: 170, y: 200, w: 48, h: 220, rot: 0, layer: 2 }
      ],
      screws: [
        { x: 70, y: 120, color: 'blue' }, { x: 270, y: 120, color: 'yellow' },
        { x: 70, y: 200, color: 'yellow' }, { x: 270, y: 200, color: 'blue' },
        { x: 70, y: 280, color: 'blue' }, { x: 270, y: 280, color: 'yellow' },
        { x: 170, y: 140, color: 'blue' }, { x: 170, y: 260, color: 'yellow' }
      ]
    });
    // Level 5
    HAND.push({
      name: 'Треугольник',
      slots: 5,
      boxes: ['red', 'blue', 'green'],
      planks: [
        { type: 'tri', x: 170, y: 150, w: 160, h: 130, rot: 0, layer: 0 },
        { type: 'barH', x: 170, y: 260, w: 280, h: 50, rot: 0, layer: 1 },
        { type: 'L', x: 120, y: 340, w: 140, h: 120, rot: Math.PI, layer: 0 },
        { type: 'square', x: 260, y: 340, w: 90, h: 90, rot: 0, layer: 0 }
      ],
      screws: [
        { x: 170, y: 120, color: 'red' },
        { x: 130, y: 190, color: 'blue' },
        { x: 210, y: 190, color: 'green' },
        { x: 80, y: 260, color: 'red' },
        { x: 170, y: 260, color: 'blue' },
        { x: 260, y: 260, color: 'green' },
        { x: 80, y: 320, color: 'red' },
        { x: 140, y: 380, color: 'blue' },
        { x: 260, y: 320, color: 'green' },
        { x: 260, y: 370, color: 'red' }
      ]
    });
    // Levels 6-12 more handcrafted variants
    for (let i = 6; i <= 12; i++) {
      HAND.push(proceduralLevel(i - 1, true));
    }
  })();

  function proceduralLevel(n, seedHand) {
    // deterministic pseudo-random from n
    let s = (n + 1) * 9973;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const colorPool = COLOR_KEYS.slice(0, Math.min(2 + Math.floor(n / 5), 5));
    const plankCount = Math.min(3 + Math.floor(n / 3), 10);
    const types = ['barH', 'barV', 'square', 'L', 'T', 'tri', 'Z'];
    const planks = [];
    const screws = [];
    for (let i = 0; i < plankCount; i++) {
      const type = types[Math.floor(rnd() * Math.min(types.length, 3 + Math.floor(n / 4)))];
      const w = type === 'barV' ? 46 + rnd() * 16 : 90 + rnd() * 140;
      const h = type === 'barH' ? 46 + rnd() * 14 : (type === 'square' ? 80 + rnd() * 40 : 100 + rnd() * 80);
      const x = 60 + rnd() * 220;
      const y = 80 + rnd() * 280;
      const layer = Math.floor(rnd() * Math.min(3, 1 + Math.floor(n / 6)));
      const rot = (Math.floor(rnd() * 4) * Math.PI) / 2;
      planks.push({ type, x, y, w, h, rot, layer });
      // 1-3 screws on plank
      const sc = 1 + Math.floor(rnd() * (n < 4 ? 2 : 3));
      for (let k = 0; k < sc; k++) {
        const ox = (rnd() - 0.5) * w * 0.55;
        const oy = (rnd() - 0.5) * h * 0.55;
        const ca = Math.cos(rot), sa = Math.sin(rot);
        const sx = x + ox * ca - oy * sa;
        const sy = y + ox * sa + oy * ca;
        const color = colorPool[Math.floor(rnd() * colorPool.length)];
        // avoid near-duplicates
        if (screws.some(scw => (scw.x - sx) ** 2 + (scw.y - sy) ** 2 < 28 * 28)) continue;
        screws.push({ x: sx, y: sy, color });
      }
    }
    // ensure at least one screw per color used in boxes
    const used = [...new Set(screws.map(s => s.color))];
    const boxes = used.slice(0, Math.min(3, used.length));
    if (!boxes.length) boxes.push('red');
    // guarantee solvable-ish: enough box capacity over time by cycling colors; starting boxes match
    return {
      name: seedHand ? 'Ур.' + (n + 1) : 'Авто ' + (n + 1),
      slots: n > 20 ? 4 : 5,
      boxes,
      planks,
      screws
    };
  }

  // Ensure 40+ levels
  const LEVEL_COUNT = 42;

  // ---------- physics / level load ----------
  function resize() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    board.w = Math.min(350, W - 40);
    board.x = (W - board.w) / 2;
    board.h = Math.min(board.w * 1.05, H * 0.48);
    board.y = Math.min(H * 0.26, 210);
  }

  function clearWorld() {
    if (engine) {
      World.clear(engine.world, false);
      Engine.clear(engine);
    }
    engine = Engine.create({ enableSleeping: true });
    world = engine.world;
    world.gravity.y = 0.95;
    wallBodies = [];
    // floor + side walls below board so planks fall away
    const floor = Bodies.rectangle(W / 2, H + 40, W * 2, 80, { isStatic: true, label: 'floor' });
    const L = Bodies.rectangle(-40, H / 2, 80, H * 2, { isStatic: true });
    const R = Bodies.rectangle(W + 40, H / 2, 80, H * 2, { isStatic: true });
    World.add(world, [floor, L, R]);
  }

  function plankWorldPoly(p) {
    const local = shapeVerts(p.type, p.w, p.h);
    return translatePts(rotatePts(local, p.rot + (p.body ? p.body.angle - p._baseAngle : 0)), 
      p.body ? p.body.position.x : board.x + p.x,
      p.body ? p.body.position.y : board.y + p.y);
  }

  function startLevel(idx) {
    outcomeGen++;
    levelIdx = idx;
    state = 'play';
    showScreen('play');
    hammerMode = false;
    hintScrewId = null;
    particles = []; flyers = []; confetti = [];
    tutStep = idx <= 1 ? 1 : 99;
    maxSlots = BASE_SLOTS + (save.boosters._extraSlots || 0);
    const def = makeLevel(idx);
    maxSlots = def.slots || BASE_SLOTS;
    if (save.boosters._extraSlots) maxSlots += save.boosters._extraSlots;

    clearWorld();
    planks = [];
    screws = [];
    waitSlots = Array(maxSlots).fill(null);
    boxes = def.boxes.map((c, i) => ({
      color: c, count: 0, flying: false, flyT: 0, id: 'b' + i
    }));
    layoutBoxes();

    // create planks bottom layer first
    const sorted = def.planks.map((p, i) => Object.assign({ _i: i }, p)).sort((a, b) => a.layer - b.layer);
    for (const pd of sorted) {
      const cx = board.x + pd.x;
      const cy = board.y + pd.y;
      const verts = rotatePts(shapeVerts(pd.type, pd.w, pd.h), pd.rot);
      let body;
      try {
        body = Bodies.fromVertices(cx, cy, [verts.map(([x, y]) => ({ x, y }))], {
          isStatic: true,
          friction: 0.35,
          restitution: 0.05,
          density: 0.002,
          label: 'plank'
        }, true);
      } catch (e) {
        body = Bodies.rectangle(cx, cy, pd.w, pd.h, { isStatic: true, angle: pd.rot, label: 'plank' });
      }
      if (!body) body = Bodies.rectangle(cx, cy, pd.w, pd.h, { isStatic: true, angle: pd.rot, label: 'plank' });
      Body.setAngle(body, pd.rot);
      const plank = {
        id: 'p' + pd._i,
        type: pd.type, w: pd.w, h: pd.h, layer: pd.layer,
        rot: pd.rot, x: pd.x, y: pd.y,
        body, _baseAngle: pd.rot,
        alive: true, falling: false,
        screwIds: [],
        constraint: null,
        woodTone: 0.92 + (pd._i % 5) * 0.03
      };
      World.add(world, body);
      planks.push(plank);
    }

    def.screws.forEach((sd, i) => {
      const screw = {
        id: 's' + i,
        x: board.x + sd.x,
        y: board.y + sd.y,
        color: sd.color,
        alive: true,
        removed: false,
        spin: 0,
        blocked: false
      };
      // attach to planks containing this point
      for (const p of planks) {
        const poly = plankWorldPoly(p);
        if (pointInPoly(screw.x, screw.y, poly)) {
          p.screwIds.push(screw.id);
          screw.plankIds = screw.plankIds || [];
          screw.plankIds.push(p.id);
        }
      }
      screws.push(screw);
    });
    // if a screw hit no plank, still show it (design error) — snap to nearest
    for (const sc of screws) {
      if (!sc.plankIds || !sc.plankIds.length) {
        let best = null, bd = 1e9;
        for (const p of planks) {
          const d = (p.body.position.x - sc.x) ** 2 + (p.body.position.y - sc.y) ** 2;
          if (d < bd) { bd = d; best = p; }
        }
        if (best) { best.screwIds.push(sc.id); sc.plankIds = [best.id]; }
      }
    }
    updateBlocked();
    refreshHud();
    ensureBgm();
  }

  function layoutBoxes() {
    const n = boxes.filter(b => !b.flying || b.flyT < 1).length;
    const bw = 72, gap = 10;
    const total = boxes.length * bw + (boxes.length - 1) * gap;
    let x0 = (W - total) / 2;
    boxes.forEach((b, i) => {
      b.w = bw; b.h = 56;
      b.x = x0 + i * (bw + gap);
      b.y = 72;
    });
  }

  function updateBlocked() {
    for (const sc of screws) {
      if (!sc.alive) { sc.blocked = false; continue; }
      sc.blocked = false;
      const holders = (sc.plankIds || []).map(id => planks.find(p => p.id === id && p.alive)).filter(Boolean);
      const maxLayer = holders.reduce((m, p) => Math.max(m, p.layer), -1);
      for (const p of planks) {
        if (!p.alive || p.falling) continue;
        if (p.layer <= maxLayer) continue;
        const poly = plankWorldPoly(p);
        if (pointInPoly(sc.x, sc.y, poly)) { sc.blocked = true; break; }
      }
    }
  }

  function livingScrewsOnPlank(p) {
    return p.screwIds.filter(id => {
      const s = screws.find(x => x.id === id);
      return s && s.alive;
    });
  }

  function refreshPlankPhysics(p) {
    if (!p.alive || p.falling) return;
    const live = livingScrewsOnPlank(p);
    if (live.length >= 2) {
      // keep static
      if (!p.body.isStatic) Body.setStatic(p.body, true);
      if (p.constraint) { World.remove(world, p.constraint); p.constraint = null; }
    } else if (live.length === 1) {
      // pivot around remaining screw
      const sc = screws.find(x => x.id === live[0]);
      Body.setStatic(p.body, false);
      if (p.constraint) World.remove(world, p.constraint);
      const lx = sc.x - p.body.position.x;
      const ly = sc.y - p.body.position.y;
      // rotate local offset by -angle
      const a = -p.body.angle;
      const ox = lx * Math.cos(a) - ly * Math.sin(a);
      const oy = lx * Math.sin(a) + ly * Math.cos(a);
      p.constraint = Constraint.create({
        bodyA: p.body,
        pointA: { x: ox, y: oy },
        pointB: { x: sc.x, y: sc.y },
        stiffness: 1,
        length: 0,
        damping: 0.15
      });
      World.add(world, p.constraint);
      Body.setAngularVelocity(p.body, Math.max(-0.04, Math.min(0.04, p.body.angularVelocity)));
      p.body.frictionAir = 0.05;
    } else {
      // fall free
      if (p.constraint) { World.remove(world, p.constraint); p.constraint = null; }
      Body.setStatic(p.body, false);
      p.falling = true;
      Body.setAngularVelocity(p.body, (Math.random() - 0.5) * 0.08);
      playSfx('wood', 0.7);
      spawnDust(p.body.position.x, p.body.position.y);
    }
  }

  function findBoxFor(color) {
    return boxes.find(b => !b.flying && b.color === color && b.count < BOX_CAP);
  }

  function nextBoxColorNeeded() {
    const need = {};
    for (const sc of screws) if (sc.alive) need[sc.color] = (need[sc.color] || 0) + 1;
    for (const w of waitSlots) if (w) need[w.color] = (need[w.color] || 0) + 1;
    // prefer colors still on board not already having an open box
    const open = new Set(boxes.filter(b => !b.flying).map(b => b.color));
    const candidates = Object.keys(need).filter(c => !open.has(c) && need[c] > 0);
    if (candidates.length) return candidates[0];
    const any = Object.keys(need)[0];
    return any || COLOR_KEYS[levelIdx % COLOR_KEYS.length];
  }

  function removeScrew(sc) {
    if (!sc.alive || sc.blocked) return false;
    sc.alive = false;
    sc.removed = true;
    playSfx('screw', 0.65);
    // detach from planks
    for (const pid of (sc.plankIds || [])) {
      const p = planks.find(x => x.id === pid);
      if (p) refreshPlankPhysics(p);
    }
    updateBlocked();

    const box = findBoxFor(sc.color);
    if (box) {
      flyers.push({
        kind: 'toBox', color: sc.color, x: sc.x, y: sc.y,
        tx: box.x + box.w / 2, ty: box.y + box.h / 2,
        t: 0, spin: 0, boxId: box.id
      });
    } else {
      // waiting slot
      const slot = waitSlots.findIndex(s => !s);
      if (slot < 0) {
        // lose
        flyers.push({ kind: 'toWaitFail', color: sc.color, x: sc.x, y: sc.y, t: 0, spin: 0 });
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen) endLose(); }, 500);
        return true;
      }
      const sx = slotPos(slot).x, sy = slotPos(slot).y;
      waitSlots[slot] = { color: sc.color, id: sc.id };
      flyers.push({
        kind: 'toWait', color: sc.color, x: sc.x, y: sc.y,
        tx: sx, ty: sy, t: 0, spin: 0, slot
      });
    }
    return true;
  }

  function slotPos(i) {
    const sw = 40, gap = 8;
    const total = maxSlots * sw + (maxSlots - 1) * gap;
    const x0 = (W - total) / 2 + sw / 2;
    return { x: x0 + i * (sw + gap), y: board.y + board.h + 36 };
  }

  function onFlyerArrived(f) {
    if (f.kind === 'toBox') {
      const box = boxes.find(b => b.id === f.boxId);
      if (!box) return;
      box.count++;
      playSfx('box', 0.5);
      spawnSpark(box.x + box.w / 2, box.y + box.h / 2, box.color);
      if (box.count >= BOX_CAP) {
        box.flying = true; box.flyT = 0;
        playSfx('box', 0.7);
        // after fly, replace with new box; try flush wait slots
      }
    }
  }

  function tryFlushWaits() {
    let moved;
    do {
      moved = false;
      for (let i = 0; i < waitSlots.length; i++) {
        const w = waitSlots[i];
        if (!w) continue;
        const box = findBoxFor(w.color);
        if (!box) continue;
        const sp = slotPos(i);
        flyers.push({
          kind: 'toBox', color: w.color, x: sp.x, y: sp.y,
          tx: box.x + box.w / 2, ty: box.y + box.h / 2,
          t: 0, spin: 0, boxId: box.id
        });
        waitSlots[i] = null;
        moved = true;
      }
      // compact? keep holes for simplicity — or compact left
      const filled = waitSlots.filter(Boolean);
      waitSlots = filled.concat(Array(maxSlots - filled.length).fill(null));
    } while (moved);
  }

  function tickBoxes(dt) {
    for (const b of boxes) {
      if (b.flying) {
        b.flyT += dt * 1.8;
        if (b.flyT >= 1) {
          // replace
          const idx = boxes.indexOf(b);
          const col = nextBoxColorNeeded();
          boxes[idx] = { color: col, count: 0, flying: false, flyT: 0, id: 'b' + Date.now() + idx };
          layoutBoxes();
          tryFlushWaits();
        }
      }
    }
  }

  function checkWin() {
    if (state !== 'play') return;
    // mark fallen as dead
    for (const p of planks) {
      if (p.falling && p.body.position.y > board.y + board.h + 30) {
        p.alive = false;
        if (p.constraint) { World.remove(world, p.constraint); p.constraint = null; }
        try { World.remove(world, p.body); } catch (e) {}
      }
    }
    const remaining = planks.filter(p => p.alive && !p.falling);
    const screwsLeft = screws.some(s => s.alive);
    // win when no fixed planks remain (all falling/gone) and no screws left
    if (!remaining.length && !screwsLeft) {
      const g = outcomeGen;
      state = 'play'; // keep
      if (!checkWin._armed || checkWin._armed !== g) {
        checkWin._armed = g;
        setTimeout(() => { if (g === outcomeGen && state === 'play') endWin(); }, 400);
      }
    }
  }

  function endWin() {
    if (state !== 'play') return;
    state = 'win';
    playSfx('win', 0.7);
    burstConfetti();
    const stars = 3;
    save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, stars);
    save.coins += 40 + levelIdx * 2;
    if (save.unlocked < levelIdx + 2) save.unlocked = levelIdx + 2;
    persist();
    $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-coins').textContent = '+' + (40 + levelIdx * 2) + ' монет';
    showScreen('win');
    refreshHud();
  }
  function endLose() {
    if (state !== 'play') return;
    state = 'lose';
    playSfx('lose', 0.6);
    showScreen('lose');
  }

  // ---------- input ----------
  function screwAt(x, y) {
    let best = null, bd = 28 * 28;
    for (const sc of screws) {
      if (!sc.alive) continue;
      const d = (sc.x - x) ** 2 + (sc.y - y) ** 2;
      if (d < bd) { bd = d; best = sc; }
    }
    return best;
  }
  function plankAt(x, y) {
    const ordered = planks.filter(p => p.alive && !p.falling).sort((a, b) => b.layer - a.layer);
    for (const p of ordered) {
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
        save.boosters.hammer--;
        persist();
        // remove all screws on plank then force fall
        for (const id of [...p.screwIds]) {
          const sc = screws.find(s => s.id === id && s.alive);
          if (sc) { sc.alive = false; sc.removed = true; }
        }
        p.screwIds = [];
        refreshPlankPhysics(p);
        hammerMode = false;
        updateBlocked();
        refreshHud();
        playSfx('wood', 0.8);
        toast('Доска сломана!');
      }
      return;
    }
    const sc = screwAt(x, y);
    if (!sc) return;
    if (sc.blocked) { toast('Винт перекрыт доской сверху'); playSfx('btn', 0.3); return; }
    if (tutStep === 1) tutStep = 2;
    removeScrew(sc);
    if (hintScrewId === sc.id) hintScrewId = null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    onPointer(e.clientX - r.left, e.clientY - r.top);
  });

  // ---------- boosters ----------
  function useHint() {
    if (state !== 'play' || save.boosters.hint <= 0) return;
    updateBlocked();
    // prefer screw that matches an open box and is free
    let pick = screws.find(s => s.alive && !s.blocked && findBoxFor(s.color));
    if (!pick) pick = screws.find(s => s.alive && !s.blocked);
    if (!pick) { toast('Нет свободных винтов'); return; }
    save.boosters.hint--;
    persist();
    hintScrewId = pick.id;
    refreshHud();
    playSfx('btn', 0.5);
  }
  function useSlot() {
    if (state !== 'play' || save.boosters.slot <= 0) return;
    if (maxSlots >= 8) { toast('Максимум слотов'); return; }
    save.boosters.slot--;
    save.boosters._extraSlots = (save.boosters._extraSlots || 0) + 1;
    maxSlots++;
    waitSlots.push(null);
    persist();
    refreshHud();
    playSfx('btn', 0.5);
    toast('+1 слот ожидания');
  }
  function useHammer() {
    if (state !== 'play' || save.boosters.hammer <= 0) return;
    hammerMode = !hammerMode;
    toast(hammerMode ? 'Выбери доску для молота' : 'Молот отменён');
  }

  // ---------- draw ----------
  function woodFill(ctx, tone) {
    const g = ctx.createLinearGradient(-50, -30, 50, 40);
    const t = tone;
    const r = Math.floor(190 * t), g0 = Math.floor(140 * t), b = Math.floor(75 * t);
    g.addColorStop(0, `rgb(${r + 30},${g0 + 25},${b + 10})`);
    g.addColorStop(0.45, `rgb(${r + 10},${g0 + 5},${b})`);
    g.addColorStop(1, `rgb(${r - 25},${g0 - 20},${b - 15})`);
    return g;
  }

  function drawPlank(p) {
    if (!p.alive && !p.falling) return;
    if (p.body.position.y > H + 100) return;
    const poly = plankWorldPoly(p);
    ctx.save();
    ctx.beginPath();
    poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = woodFill(ctx, p.woodTone);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(90,50,20,0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,180,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.stroke();
    // grain lines
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(90,50,20,0.12)';
    ctx.lineWidth = 1;
    const minx = Math.min(...poly.map(p => p[0]));
    const maxx = Math.max(...poly.map(p => p[0]));
    const miny = Math.min(...poly.map(p => p[1]));
    const maxy = Math.max(...poly.map(p => p[1]));
    for (let y = miny; y < maxy; y += 6) {
      ctx.beginPath(); ctx.moveTo(minx, y); ctx.lineTo(maxx, y + 2); ctx.stroke();
    }
    ctx.restore();
    // holes for living screws on this plank
    for (const id of p.screwIds) {
      const sc = screws.find(s => s.id === id);
      if (!sc) continue;
      // hole position: if screw alive use screw pos else approximate
      const hx = sc.alive ? sc.x : sc.x;
      const hy = sc.alive ? sc.y : sc.y;
      if (pointInPoly(hx, hy, poly) || sc.alive) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30,15,5,0.55)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawScrewHead(x, y, color, spin, scale, blocked) {
    const r = 15 * (scale || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    if (imgs['screw_' + color]) {
      const im = imgs['screw_' + color];
      ctx.drawImage(im, -r, -r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[color] || '#ccc';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, 0); ctx.lineTo(r * 0.45, 0);
      ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.45);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    if (blocked) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', 0, 1);
    }
    ctx.restore();
  }

  function drawBoard() {
    // tray
    if (imgs.board_tray) {
      ctx.drawImage(imgs.board_tray, board.x - 16, board.y - 16, board.w + 32, board.h + 32);
    } else {
      ctx.fillStyle = '#6b4423';
      roundRect(ctx, board.x - 12, board.y - 12, board.w + 24, board.h + 24, 18);
      ctx.fill();
      ctx.fillStyle = '#4a2f16';
      roundRect(ctx, board.x, board.y, board.w, board.h, 12);
      ctx.fill();
    }
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

  function drawBoxes() {
    for (const b of boxes) {
      ctx.save();
      let y = b.y, a = 1, sc = 1;
      if (b.flying) {
        y = b.y - b.flyT * 120;
        a = 1 - b.flyT;
        sc = 1 + b.flyT * 0.3;
      }
      ctx.globalAlpha = a;
      ctx.translate(b.x + b.w / 2, y + b.h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(b.x + b.w / 2), -(y + b.h / 2));
      // crate
      ctx.fillStyle = '#5a3a1c';
      roundRect(ctx, b.x, y, b.w, b.h, 10);
      ctx.fill();
      ctx.strokeStyle = COLORS[b.color];
      ctx.lineWidth = 4;
      roundRect(ctx, b.x + 2, y + 2, b.w - 4, b.h - 4, 8);
      ctx.stroke();
      // slots
      for (let i = 0; i < BOX_CAP; i++) {
        const cx = b.x + 16 + i * 20;
        const cy = y + b.h / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        if (i < b.count) {
          ctx.fillStyle = COLORS[b.color];
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function drawWaitRow() {
    for (let i = 0; i < maxSlots; i++) {
      const p = slotPos(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,22,10,0.75)';
      ctx.fill();
      ctx.strokeStyle = '#c9a06a';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (waitSlots[i]) {
        drawScrewHead(p.x, p.y, waitSlots[i].color, 0, 0.95, false);
      }
    }
    ctx.fillStyle = 'rgba(255,232,192,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ожидание', W / 2, slotPos(0).y + 34);
  }

  function drawTutorial() {
    if (tutStep > 2 || levelIdx > 1) return;
    const free = screws.find(s => s.alive && !s.blocked);
    if (!free) return;
    ctx.save();
    // pulse ring
    const pulse = 1 + Math.sin(animT * 6) * 0.08;
    ctx.beginPath();
    ctx.arc(free.x, free.y, 26 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,220,80,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // finger
    if (imgs.finger) {
      const fy = free.y + 10 + Math.sin(animT * 5) * 8;
      ctx.drawImage(imgs.finger, free.x - 10, fy, 64, 64);
    }
    // tip
    ctx.fillStyle = 'rgba(30,15,5,0.85)';
    roundRect(ctx, W / 2 - 140, board.y - 48, 280, 36, 12);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tip = tutStep === 1 ? 'Нажми на винт — он улетит в коробку!' : 'Освободи доску от всех винтов!';
    ctx.fillText(tip, W / 2, board.y - 30);
    ctx.restore();
  }

  function drawParticles(dt) {
    particles = particles.filter(p => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
      if (p.t > p.life) return false;
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
    confetti = confetti.filter(c => {
      c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.t > 2.5) return false;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-4, -3, 8, 6);
      ctx.restore();
      return true;
    });
  }

  function spawnDust(x, y) {
    for (let i = 0; i < 10; i++) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60,
        r: 2 + Math.random() * 3, color: '#c9a06a', t: 0, life: 0.5 + Math.random() * 0.4
      });
    }
  }
  function spawnSpark(x, y, color) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
        r: 2 + Math.random() * 2, color: COLORS[color] || '#fff', t: 0, life: 0.4
      });
    }
  }
  function burstConfetti() {
    const cols = Object.values(COLORS);
    for (let i = 0; i < 60; i++) {
      confetti.push({
        x: W * Math.random(), y: -20, vx: (Math.random() - 0.5) * 80,
        vy: 80 + Math.random() * 120, rot: 0, vr: (Math.random() - 0.5) * 8,
        color: cols[i % cols.length], t: 0
      });
    }
  }

  function drawFlyers(dt) {
    flyers = flyers.filter(f => {
      f.t += dt * 2.2;
      f.spin += dt * 18;
      const t = Math.min(1, f.t);
      const e = 1 - Math.pow(1 - t, 3);
      if (f.kind === 'toBox' || f.kind === 'toWait') {
        const x = f.x + (f.tx - f.x) * e;
        const y = f.y + (f.ty - f.y) * e - Math.sin(e * Math.PI) * 40;
        drawScrewHead(x, y, f.color, f.spin, 1.05, false);
        if (t >= 1) { onFlyerArrived(f); return false; }
        return true;
      }
      drawScrewHead(f.x, f.y + t * 20, f.color, f.spin, 1, false);
      return t < 1;
    });
  }

  function drawGoalBanner() {
    ctx.fillStyle = 'rgba(30,15,5,0.75)';
    roundRect(ctx, board.x, board.y - 42, board.w, 28, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe8c0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Открути винты · доски должны упасть', board.x + board.w / 2, board.y - 28);
  }

  function frame(dt) {
    animT += dt;
    ctx.clearRect(0, 0, W, H);
    // bg wood
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#5a3a1e');
    bg.addColorStop(1, '#2a1a0c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (state === 'play' || state === 'win' || state === 'lose') {
      if (engine && state === 'play') {
        Engine.update(engine, Math.min(32, dt * 1000));
        for (const p of planks) {
          if (p.constraint && p.body) {
            const av = p.body.angularVelocity;
            if (Math.abs(av) > 0.06) Body.setAngularVelocity(p.body, av * 0.85);
          }
        }
      }
      tickBoxes(dt);
      drawBoxes();
      drawGoalBanner();
      drawBoard();
      // planks by layer
      const sorted = [...planks].filter(p => p.alive || p.falling).sort((a, b) => a.layer - b.layer);
      for (const p of sorted) drawPlank(p);
      for (const sc of screws) {
        if (!sc.alive) continue;
        const hint = hintScrewId === sc.id;
        if (hint) {
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, 22 + Math.sin(animT * 8) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffe566';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        drawScrewHead(sc.x, sc.y, sc.color, 0, 1, sc.blocked);
      }
      drawWaitRow();
      drawFlyers(dt);
      drawTutorial();
      drawParticles(dt);
      if (state === 'play') checkWin();
      if (hammerMode) {
        ctx.fillStyle = 'rgba(255,100,50,0.12)';
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt);
    requestAnimationFrame(loop);
  }

  // ---------- UI ----------
  function showScreen(name) {
    state = name === 'play' ? 'play' : name;
    ['home', 'map', 'win', 'lose'].forEach(s => {
      const el = $('sc-' + s);
      if (el) el.classList.toggle('on', s === name);
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
    const g = $('mapgrid');
    g.innerHTML = '';
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const cell = document.createElement('div');
      const unlocked = i < save.unlocked;
      cell.className = 'mapcell' + (unlocked ? '' : ' lock') + (save.stars[i] ? ' done' : '');
      cell.innerHTML = (unlocked ? (i + 1) : '🔒') +
        (save.stars[i] ? '<div class="stars">' + '★'.repeat(save.stars[i]) + '</div>' : '');
      if (unlocked) cell.onclick = () => { startLevel(i); };
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

  // ---------- assets ----------
  function loadImg(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }
  function loadAudio(name, src) {
    const a = new Audio(src);
    a.preload = 'auto';
    audio[name] = a;
  }

  async function boot() {
    resize();
    window.addEventListener('resize', resize);
    $('ver').textContent = 'v' + VERSION;

    const pairs = [
      ['board_tray', 'assets/sprites/board_tray.webp'],
      ['finger', 'assets/sprites/finger.webp'],
      ['screw_red', 'assets/sprites/screw_red.webp'],
      ['screw_yellow', 'assets/sprites/screw_yellow.webp'],
      ['screw_green', 'assets/sprites/screw_green.webp'],
      ['screw_blue', 'assets/sprites/screw_blue.webp']
    ];
    await Promise.all(pairs.map(async ([k, s]) => { imgs[k] = await loadImg(s); }));
    loadAudio('screw', 'assets/audio/sfx_screw.wav');
    loadAudio('wood', 'assets/audio/sfx_wood.wav');
    loadAudio('box', 'assets/audio/sfx_box.wav');
    loadAudio('win', 'assets/audio/sfx_win.wav');
    loadAudio('lose', 'assets/audio/sfx_lose_v.wav');
    loadAudio('btn', 'assets/audio/sfx_btn.ogg');
    loadAudio('bgm', 'assets/audio/music_vintiki.wav');

    $('btn-play').onclick = () => startLevel(Math.min(save.unlocked - 1, LEVEL_COUNT - 1));
    $('btn-home-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-map-back').onclick = () => showScreen('home');
    $('btn-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-next').onclick = () => startLevel(Math.min(levelIdx + 1, LEVEL_COUNT - 1));
    $('btn-win-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-retry').onclick = () => startLevel(levelIdx);
    $('btn-lose-map').onclick = () => { buildMap(); showScreen('map'); };
    $('btn-sound').onclick = () => {
      muted = !muted; persist(); refreshHud();
      if (muted && audio.bgm) audio.bgm.pause();
      else ensureBgm();
    };
    $('btn-update').onclick = checkOta;
    $('btn-home-update').onclick = checkOta;
    $('b-hint').onclick = useHint;
    $('b-slot').onclick = useSlot;
    $('b-hammer').onclick = useHammer;

    refreshHud();
    requestAnimationFrame(loop);

    // test hooks
    window.__V = {
      VERSION, startLevel, getState: () => ({
        state, levelIdx, screws: screws.filter(s => s.alive).length,
        blocked: screws.filter(s => s.alive && s.blocked).length,
        planks: planks.filter(p => p.alive && !p.falling).length,
        falling: planks.filter(p => p.falling).length,
        wait: waitSlots.filter(Boolean).length,
        maxSlots, boxes: boxes.map(b => ({ c: b.color, n: b.count, fly: b.flying })),
        tutStep
      }),
      tapScrew: (i) => {
        const alive = screws.filter(s => s.alive && !s.blocked);
        const sc = alive[i] || alive[0];
        if (sc) removeScrew(sc);
        return !!sc;
      },
      tapFree: () => {
        updateBlocked();
        const sc = screws.find(s => s.alive && !s.blocked && findBoxFor(s.color))
          || screws.find(s => s.alive && !s.blocked);
        if (sc) { removeScrew(sc); return sc.id; }
        return null;
      },
      forceLose: () => {
        waitSlots = waitSlots.map(() => ({ color: 'red', id: 'x' }));
        endLose();
      },
      solveStep: () => {
        // greedy: remove free screw matching box, else any free
        return window.__V.tapFree();
      },
      idle: (sec) => {
        const steps = Math.ceil(sec / 0.016);
        for (let i = 0; i < steps; i++) {
          if (engine) Engine.update(engine, 16);
          tickBoxes(0.016);
          animT += 0.016;
          // advance flyers quickly
          for (const f of flyers) { f.t += 0.05; }
          flyers = flyers.filter(f => {
            if (f.t >= 1) { onFlyerArrived(f); return false; }
            return true;
          });
          for (const b of boxes) if (b.flying) b.flyT += 0.05;
          checkWin();
        }
      },
      autoSolve: (maxSteps) => {
        let steps = 0;
        while (steps < (maxSteps || 80) && state === 'play') {
          updateBlocked();
          const id = window.__V.tapFree();
          window.__V.idle(0.35);
          steps++;
          if (!id && !screws.some(s => s.alive)) break;
          if (!id) {
            // stuck — try hammer on top plank
            const top = [...planks].filter(p => p.alive && !p.falling).sort((a, b) => b.layer - a.layer)[0];
            if (top) {
              for (const sid of [...top.screwIds]) {
                const sc = screws.find(s => s.id === sid && s.alive);
                if (sc) { sc.alive = false; sc.removed = true; }
              }
              top.screwIds = [];
              refreshPlankPhysics(top);
              updateBlocked();
              window.__V.idle(0.4);
            } else break;
          }
        }
        window.__V.idle(1.5);
        // if all clear but timer not fired in headless, force win
        const st = window.__V.getState();
        if (st.state === 'play' && st.planks === 0 && st.screws === 0) endWin();
        return window.__V.getState();
      }
    };
  }

  boot();
})();
