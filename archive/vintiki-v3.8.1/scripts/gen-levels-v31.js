/** Generate & validate Vintiki v3.1 levels */
const fs = require('fs');
const path = require('path');

const COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'cyan'];
const BOX_CAP = 3;

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
function rotPts(pts, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
  }
  return inside;
}
function plankPoly(p) {
  return rotPts(shapeVerts(p.type, p.w, p.h), p.rot).map(([x, y]) => [x + p.x, y + p.y]);
}

function handLevels() {
  // L1: no blocking, 1 color — tutorial tap
  const L1 = {
    name: 'Старт', slots: 5, boxes: ['red'],
    goal: 'Урони все доски',
    tut: ['tap', 'Нажми на красный винт — он улетит в коробку'],
    planks: [
      { id: 'a', type: 'barH', x: 170, y: 150, w: 200, h: 58, rot: 0, layer: 0 },
      { id: 'b', type: 'barH', x: 170, y: 260, w: 200, h: 58, rot: 0, layer: 0 }
    ],
    screws: [
      { id: 's0', x: 100, y: 150, color: 'red', plankId: 'a' },
      { id: 's1', x: 240, y: 150, color: 'red', plankId: 'a' },
      { id: 's2', x: 170, y: 260, color: 'red', plankId: 'b' }
    ]
  };
  // L2: top plank covers one screw on bottom
  const L2 = {
    name: 'Перекрытие', slots: 5, boxes: ['red'],
    goal: 'Урони все доски',
    tut: ['block', 'Винт под доской — сначала убери верхнюю'],
    planks: [
      { id: 'base', type: 'barH', x: 170, y: 220, w: 260, h: 64, rot: 0, layer: 0 },
      { id: 'top', type: 'barH', x: 170, y: 200, w: 140, h: 56, rot: 0, layer: 1 }
    ],
    screws: [
      { id: 's0', x: 70, y: 220, color: 'red', plankId: 'base' },
      { id: 's1', x: 170, y: 220, color: 'red', plankId: 'base' }, // covered by top
      { id: 's2', x: 270, y: 220, color: 'red', plankId: 'base' },
      { id: 's3', x: 130, y: 200, color: 'red', plankId: 'top' },
      { id: 's4', x: 210, y: 200, color: 'red', plankId: 'top' }
    ]
  };
  // L3: 2 colors, 2 boxes, blocking + colour tip
  const L3 = {
    name: 'Цвета', slots: 5, boxes: ['yellow', 'blue'],
    goal: 'Урони все доски',
    tut: ['color', 'Смотри на цвет коробки — не копи винт «в запас» зря'],
    planks: [
      { id: 'p0', type: 'barH', x: 170, y: 280, w: 280, h: 56, rot: 0, layer: 0 },
      { id: 'p1', type: 'barV', x: 90, y: 170, w: 56, h: 160, rot: 0, layer: 0 },
      { id: 'p2', type: 'L', x: 200, y: 150, w: 150, h: 140, rot: 0, layer: 1 },
      { id: 'p3', type: 'square', x: 110, y: 300, w: 90, h: 90, rot: 0, layer: 2 }
    ],
    screws: [
      { id: 'a', x: 70, y: 280, color: 'yellow', plankId: 'p0' },
      { id: 'b', x: 170, y: 280, color: 'blue', plankId: 'p0' },
      { id: 'c', x: 270, y: 280, color: 'yellow', plankId: 'p0' },
      { id: 'd', x: 90, y: 120, color: 'blue', plankId: 'p1' },
      { id: 'e', x: 90, y: 200, color: 'yellow', plankId: 'p1' }, // may be under p2/p3
      { id: 'f', x: 160, y: 110, color: 'blue', plankId: 'p2' },
      { id: 'g', x: 240, y: 110, color: 'yellow', plankId: 'p2' },
      { id: 'h', x: 160, y: 200, color: 'blue', plankId: 'p2' },
      { id: 'i', x: 110, y: 280, color: 'yellow', plankId: 'p3' },
      { id: 'j', x: 140, y: 320, color: 'blue', plankId: 'p3' }
    ]
  };
  // L4: cover + colour trap (solvable)
  const L4 = {
    name: 'Давление', slots: 5, boxes: ['red', 'yellow'],
    goal: 'Урони все доски',
    tut: ['plan', 'Не копи чужой цвет в ожидание — слоты кончатся'],
    planks: [
      { id: 'base', type: 'barH', x: 170, y: 260, w: 280, h: 64, rot: 0, layer: 0 },
      { id: 'cover', type: 'barH', x: 170, y: 250, w: 120, h: 56, rot: 0, layer: 1 },
      { id: 'side', type: 'barV', x: 60, y: 160, w: 52, h: 150, rot: 0, layer: 0 },
      { id: 'top', type: 'square', x: 240, y: 150, w: 100, h: 100, rot: 0, layer: 2 }
    ],
    screws: [
      // base: left/right free, center covered by cover
      { id: 'a', x: 60, y: 260, color: 'green', plankId: 'base' },
      { id: 'b', x: 170, y: 260, color: 'red', plankId: 'base' },
      { id: 'c', x: 280, y: 260, color: 'blue', plankId: 'base' },
      // cover
      { id: 'd', x: 130, y: 250, color: 'yellow', plankId: 'cover' },
      { id: 'e', x: 210, y: 250, color: 'red', plankId: 'cover' },
      // side free greens/blues tempting wait
      { id: 'f', x: 60, y: 110, color: 'green', plankId: 'side' },
      { id: 'g', x: 60, y: 190, color: 'blue', plankId: 'side' },
      // top
      { id: 'h', x: 220, y: 130, color: 'yellow', plankId: 'top' },
      { id: 'i', x: 260, y: 170, color: 'red', plankId: 'top' }
    ]
  };
  // L5: 4 layers, 4 colours
  const L5 = {
    name: 'Слои', slots: 5, boxes: ['red', 'blue'],
    goal: 'Урони все доски',
    planks: [
      { id: 'p0', type: 'barH', x: 170, y: 300, w: 290, h: 58, rot: 0, layer: 0 },
      { id: 'p1', type: 'barH', x: 170, y: 220, w: 220, h: 56, rot: 0, layer: 1 },
      { id: 'p2', type: 'barV', x: 100, y: 160, w: 54, h: 160, rot: 0, layer: 2 },
      { id: 'p3', type: 'square', x: 220, y: 150, w: 96, h: 96, rot: 0, layer: 3 }
    ],
    screws: [
      { id: 'a', x: 60, y: 300, color: 'yellow', plankId: 'p0' },
      { id: 'b', x: 170, y: 300, color: 'green', plankId: 'p0' },
      { id: 'c', x: 280, y: 300, color: 'yellow', plankId: 'p0' },
      { id: 'd', x: 90, y: 220, color: 'green', plankId: 'p1' },
      { id: 'e', x: 170, y: 220, color: 'red', plankId: 'p1' },
      { id: 'f', x: 250, y: 220, color: 'blue', plankId: 'p1' },
      { id: 'g', x: 100, y: 100, color: 'red', plankId: 'p2' },
      { id: 'h', x: 100, y: 200, color: 'blue', plankId: 'p2' },
      { id: 'i', x: 200, y: 130, color: 'red', plankId: 'p3' },
      { id: 'j', x: 240, y: 170, color: 'blue', plankId: 'p3' }
    ]
  };
    return [L1, L2, L3, L4, L5];
}

function generateCandidate(n, attempt) {
  const rnd = mulberry(1000 + n * 917 + attempt * 131);
  const colorCount = Math.min(7, n < 5 ? 3 : n < 10 ? 4 : n < 20 ? 5 : 6 + (n > 30 ? 1 : 0));
  const colors = COLORS.slice(0, colorCount);
  const layers = Math.min(6, n < 4 ? 3 : n < 12 ? 4 : 5 + (n > 25 ? 1 : 0));
  const slots = n >= 18 ? 4 : 5;
  // always 2 boxes — pick two colors that are NOT the most frequent later
  const plankCount = Math.min(4 + Math.floor(n / 4), 11);
  const types = ['barH', 'barV', 'square', 'L', 'T', 'Z', 'tri'];
  const planks = [];
  for (let i = 0; i < plankCount; i++) {
    const type = types[Math.floor(rnd() * Math.min(types.length, 3 + Math.floor(n / 5)))];
    const w = type === 'barV' ? 50 + rnd() * 20 : 100 + rnd() * 130;
    const h = type === 'barH' ? 50 + rnd() * 18 : type === 'square' ? 70 + rnd() * 50 : 90 + rnd() * 90;
    const x = 55 + rnd() * 230;
    const y = 70 + rnd() * 260;
    const layer = Math.floor(rnd() * layers);
    const rot = (Math.floor(rnd() * 4) * Math.PI) / 2;
    planks.push({ id: 'p' + i, type, x, y, w, h, rot, layer });
  }
  // ensure layer spread
  for (let L = 0; L < layers; L++) {
    if (!planks.some(p => p.layer === L)) planks[L % planks.length].layer = L;
  }
  planks.sort((a, b) => a.layer - b.layer);

  const screws = [];
  let sid = 0;
  for (const p of planks) {
    const sc = 1 + Math.floor(rnd() * (n < 6 ? 2 : 3));
    for (let k = 0; k < sc; k++) {
      const ox = (rnd() - 0.5) * p.w * 0.5;
      const oy = (rnd() - 0.5) * p.h * 0.5;
      const ca = Math.cos(p.rot), sa = Math.sin(p.rot);
      const sx = p.x + ox * ca - oy * sa;
      const sy = p.y + ox * sa + oy * ca;
      if (sx < 20 || sx > 320 || sy < 30 || sy > 390) continue;
      if (screws.some(s => (s.x - sx) ** 2 + (s.y - sy) ** 2 < 26 * 26)) continue;
      const color = colors[Math.floor(rnd() * colors.length)];
      screws.push({ id: 's' + (sid++), x: sx, y: sy, color, plankId: p.id });
    }
  }
  // Force covering: for some lower screws, ensure a higher plank overlaps without owning the screw
  for (const sc of screws) {
    const owner = planks.find(p => p.id === sc.plankId);
    if (!owner || owner.layer >= layers - 1) continue;
    if (rnd() > 0.55) continue;
    // find or nudge a higher plank over this screw
    let cover = planks.find(p => p.layer > owner.layer && pointInPoly(sc.x, sc.y, plankPoly(p)));
    if (!cover) {
      cover = planks.find(p => p.layer > owner.layer);
      if (cover) {
        // move cover toward screw (keep own screws relative? just shift center)
        cover.x = sc.x + (rnd() - 0.5) * 30;
        cover.y = sc.y + (rnd() - 0.5) * 30;
      }
    }
  }

  // Force colour pressure: pick 2 box colors, ensure many screws are OTHER colors
  let boxes = [colors[0], colors[Math.min(1, colors.length - 1)]];
  if (colors.length >= 3) {
    boxes = [colors[Math.floor(rnd() * 2)], colors[2 + Math.floor(rnd() * (colors.length - 2))]];
  }
  if (boxes[0] === boxes[1] && colors.length > 1) boxes[1] = colors.find(c => c !== boxes[0]);
  // recolor ~55% of screws to non-box colors when available
  const off = colors.filter(c => c !== boxes[0] && c !== boxes[1]);
  if (off.length) {
    screws.forEach(s => {
      if (rnd() < 0.55) s.color = off[Math.floor(rnd() * off.length)];
      else s.color = boxes[Math.floor(rnd() * 2)];
    });
  }
  // ensure each box color exists at least 3 times (fillable) and off-colors exist
  const ensure = (col, n) => {
    let have = screws.filter(s => s.color === col).length;
    for (const s of screws) {
      if (have >= n) break;
      if (s.color !== col) { s.color = col; have++; }
    }
  };
  ensure(boxes[0], 3); ensure(boxes[1], 3);

  return {
    name: 'Ур.' + (n + 1),
    slots,
    boxes,
    goal: 'Урони все доски',
    planks,
    screws
  };
}

// ---- Solver ----
function cloneLevel(level) {
  return JSON.parse(JSON.stringify(level));
}

function blockedSet(level, alivePlankIds, aliveScrewIds) {
  const planks = level.planks.filter(p => alivePlankIds.has(p.id));
  const blocked = new Set();
  for (const sc of level.screws) {
    if (!aliveScrewIds.has(sc.id)) continue;
    const owner = level.planks.find(p => p.id === sc.plankId);
    if (!owner || !alivePlankIds.has(owner.id)) { blocked.add(sc.id); continue; }
    for (const p of planks) {
      if (p.layer <= owner.layer) continue;
      if (pointInPoly(sc.x, sc.y, plankPoly(p))) { blocked.add(sc.id); break; }
    }
  }
  return blocked;
}

function freeScrews(level, alivePlankIds, aliveScrewIds) {
  const blocked = blockedSet(level, alivePlankIds, aliveScrewIds);
  return level.screws.filter(s => aliveScrewIds.has(s.id) && !blocked.has(s.id));
}

function applyRemove(level, state, screwId) {
  // state: {planks:Set, screws:Set, boxes:[{c,n}], wait:string[]}
  const sc = level.screws.find(s => s.id === screwId);
  const screws = new Set(state.screws); screws.delete(screwId);
  const planks = new Set(state.planks);
  // check owner plank free
  const ownerScrews = level.screws.filter(s => s.plankId === sc.plankId && screws.has(s.id));
  if (!ownerScrews.length) planks.delete(sc.plankId);

  const boxes = state.boxes.map(b => ({ c: b.c, n: b.n }));
  let wait = state.wait.slice();
  const bi = boxes.findIndex(b => b.c === sc.color && b.n < BOX_CAP);
  if (bi >= 0) {
    boxes[bi].n++;
    if (boxes[bi].n >= BOX_CAP) {
      // fly away — replace with next needed color not already open
      const need = {};
      for (const s of level.screws) if (screws.has(s.id)) need[s.color] = (need[s.color] || 0) + 1;
      wait.forEach(c => { need[c] = (need[c] || 0) + 1; });
      const open = new Set(boxes.map(b => b.c));
      open.delete(boxes[bi].c);
      let next = Object.keys(need).filter(c => !open.has(c) && need[c] > 0)[0];
      if (!next) next = Object.keys(need)[0] || boxes[bi].c;
      boxes[bi] = { c: next, n: 0 };
      // flush wait
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < wait.length; i++) {
          const wi = boxes.findIndex(b => b.c === wait[i] && b.n < BOX_CAP);
          if (wi < 0) continue;
          boxes[wi].n++;
          wait.splice(i, 1); i--; moved = true;
          if (boxes[wi].n >= BOX_CAP) {
            const need2 = {};
            for (const s of level.screws) if (screws.has(s.id)) need2[s.color] = (need2[s.color] || 0) + 1;
            wait.forEach(c => { need2[c] = (need2[c] || 0) + 1; });
            const open2 = new Set(boxes.map(b => b.c));
            open2.delete(boxes[wi].c);
            let nx = Object.keys(need2).filter(c => !open2.has(c) && need2[c] > 0)[0] || Object.keys(need2)[0] || boxes[wi].c;
            boxes[wi] = { c: nx, n: 0 };
          }
        }
      }
    }
  } else {
    if (wait.length >= state.slots) return null; // lose
    wait.push(sc.color);
  }
  return { planks, screws, boxes, wait, slots: state.slots };
}

function keyOf(state) {
  const screws = [...state.screws].sort().join(',');
  const planks = [...state.planks].sort().join(',');
  const boxes = state.boxes.map(b => b.c + b.n).join('|');
  const wait = state.wait.slice().sort().join(',');
  return screws + ';' + planks + ';' + boxes + ';' + wait;
}

function solvable(level, maxNodes = 8000) {
  const start = {
    planks: new Set(level.planks.map(p => p.id)),
    screws: new Set(level.screws.map(s => s.id)),
    boxes: level.boxes.map(c => ({ c, n: 0 })),
    wait: [],
    slots: level.slots
  };
  const queue = [start];
  const seen = new Set([keyOf(start)]);
  let nodes = 0;
  while (queue.length && nodes < maxNodes) {
    const st = queue.shift(); nodes++;
    if (st.planks.size === 0) return { ok: true, nodes };
    const free = freeScrews(level, st.planks, st.screws);
    // prefer matching box colors first in search (heuristic order)
    free.sort((a, b) => {
      const am = st.boxes.some(x => x.c === a.color && x.n < BOX_CAP) ? 0 : 1;
      const bm = st.boxes.some(x => x.c === b.color && x.n < BOX_CAP) ? 0 : 1;
      return am - bm;
    });
    for (const sc of free) {
      const nx = applyRemove(level, st, sc.id);
      if (!nx) continue;
      const k = keyOf(nx);
      if (seen.has(k)) continue;
      seen.add(k);
      if (nx.planks.size === 0) return { ok: true, nodes };
      queue.push(nx);
    }
  }
  return { ok: false, nodes };
}

function greedyFailRate(level, trials = 40) {
  let fails = 0;
  for (let t = 0; t < trials; t++) {
    const rnd = mulberry(level.seed || 1 + t * 99 + level.screws.length * 3);
    let st = {
      planks: new Set(level.planks.map(p => p.id)),
      screws: new Set(level.screws.map(s => s.id)),
      boxes: level.boxes.map(c => ({ c, n: 0 })),
      wait: [],
      slots: level.slots
    };
    let guard = 0; let lost = false;
    while (st.planks.size && guard++ < 120) {
      const free = freeScrews(level, st.planks, st.screws);
      if (!free.length) { lost = true; break; }
      // naive: 50% random free tap; 50% "greedy match" without looking ahead (still dumps off-colors into wait)
      const matching = free.filter(s => st.boxes.some(b => b.c === s.color && b.n < BOX_CAP));
      let pick;
      if (matching.length && rnd() < 0.45) pick = matching[Math.floor(rnd() * matching.length)];
      else pick = free[Math.floor(rnd() * free.length)];
      const nx = applyRemove(level, st, pick.id);
      if (!nx) { lost = true; break; }
      st = nx;
    }
    if (lost || st.planks.size > 0) fails++;
  }
  return fails / trials;
}

function countBlockedAtStart(level) {
  const planks = new Set(level.planks.map(p => p.id));
  const screws = new Set(level.screws.map(s => s.id));
  return blockedSet(level, planks, screws).size;
}

function buildAll() {
  const levels = handLevels();
  const stats = [];
  for (let i = 0; i < levels.length; i++) {
    const sol = solvable(levels[i]);
    const blocked = countBlockedAtStart(levels[i]);
    const fail = i === 0 ? 0 : greedyFailRate(levels[i], 30);
    stats.push({ i, name: levels[i].name, solvable: sol.ok, blocked, greedyFail: fail, screws: levels[i].screws.length, colors: new Set(levels[i].screws.map(s => s.color)).size });
    if (!sol.ok) console.warn('HAND FAIL', i);
  }
  for (let n = 5; n < 42; n++) {
    let best = null, bestStat = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const cand = generateCandidate(n, attempt);
      cand.seed = 1000 + n * 917 + attempt * 131;
      if (cand.screws.length < 6) continue;
      const blocked = countBlockedAtStart(cand);
      if (n >= 3 && blocked < 2) continue;
      if (n >= 8 && blocked < 3) continue;
      const sol = solvable(cand, n > 20 ? 12000 : 8000);
      if (!sol.ok) continue;
      const fail = greedyFailRate(cand, n >= 4 ? 40 : 25);
      const needFail = n >= 4 ? 0.4 : 0.15;
      if (fail < needFail && n >= 4) continue;
      best = cand; bestStat = { i: n, name: cand.name, solvable: true, blocked, greedyFail: fail, screws: cand.screws.length, colors: new Set(cand.screws.map(s => s.color)).size, attempts: attempt };
      break;
    }
    if (!best) {
      // relax: accept best greedyFail among solvable with enough blocks
      let pool = [];
      for (let attempt = 0; attempt < 100; attempt++) {
        const cand = generateCandidate(n, 200 + attempt);
        cand.seed = 2000 + n * 17 + attempt;
        const blocked = countBlockedAtStart(cand);
        if (blocked < (n >= 8 ? 3 : 2)) continue;
        const sol = solvable(cand, 15000);
        if (!sol.ok) continue;
        const fail = greedyFailRate(cand, 40);
        pool.push({ cand, blocked, fail, attempt });
      }
      pool.sort((a, b) => b.fail - a.fail || b.blocked - a.blocked);
      if (pool.length) {
        best = pool[0].cand;
        bestStat = { i: n, name: best.name, solvable: true, blocked: pool[0].blocked, greedyFail: pool[0].fail, screws: best.screws.length, colors: new Set(best.screws.map(s => s.color)).size, relaxed: true, attempts: pool[0].attempt };
      }
    }
    if (!best) {
      console.error('FAILED to gen level', n + 1);
      // fallback: duplicate harder hand with extra cover plank
      best = cloneLevel(levels[2]);
      best.name = 'Ур.' + (n + 1);
      bestStat = { i: n, name: best.name, solvable: true, blocked: countBlockedAtStart(best), greedyFail: greedyFailRate(best, 20), fallback: true };
    }
    levels.push(best);
    stats.push(bestStat);
    console.log('L' + (n + 1), bestStat);
  }
  return { levels, stats };
}

const out = buildAll();
const dest = path.join(__dirname, '..', 'www', 'levels.json');
fs.writeFileSync(dest, JSON.stringify({ version: '3.1.0', levels: out.levels, stats: out.stats }, null, 0));
fs.writeFileSync(path.join(__dirname, '..', 'shots', 'v31-solver-stats.json'), JSON.stringify(out.stats, null, 2));
console.log('Wrote', dest, 'levels', out.levels.length);
const avgFail = out.stats.slice(4).reduce((a, s) => a + (s.greedyFail || 0), 0) / Math.max(1, out.stats.length - 4);
console.log('Avg greedy fail L5+:', avgFail.toFixed(2));
