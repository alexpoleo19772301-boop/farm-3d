/** Vintiki v3.2 — non-overlapping planks, lock keys, colour pressure */
const fs = require('fs');
const path = require('path');
const COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange'];
const BOX_CAP = 3;
const BOARD = { w: 320, h: 320, pad: 10 }; // local coords

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function rectsOverlap(a, b, gap = 8) {
  return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);
}
function insideBoard(r) {
  return r.x >= BOARD.pad && r.y >= BOARD.pad && r.x + r.w <= BOARD.w - BOARD.pad && r.y + r.h <= BOARD.h - BOARD.pad;
}

function packPlanks(n, rnd, bands) {
  // Deterministic shelf packer: rows of non-overlapping bars inside bands
  const planks = [];
  const gap = 10;
  const bandGap = bands > 1 ? 18 : 0;
  const bandH = (BOARD.h - 2 * BOARD.pad - bandGap * (bands - 1)) / bands;
  let perBand = Math.ceil(n / bands);
  for (let band = 0; band < bands; band++) {
    const y0 = BOARD.pad + band * (bandH + bandGap);
    let x = BOARD.pad;
    let y = y0 + 4;
    let rowH = 0;
    const target = Math.min(perBand, n - planks.length);
    let placed = 0;
    let guard = 0;
    while (placed < target && guard++ < 200) {
      const typeRoll = rnd();
      let w, h, type;
      if (typeRoll < 0.5) { type = 'barH'; w = 64 + Math.floor(rnd() * 90); h = 46 + Math.floor(rnd() * 10); }
      else if (typeRoll < 0.75) { type = 'square'; w = 54 + Math.floor(rnd() * 36); h = w; }
      else { type = 'barV'; w = 46 + Math.floor(rnd() * 8); h = 64 + Math.floor(rnd() * 50); }
      h = Math.min(h, bandH - 8);
      w = Math.min(w, BOARD.w - 2 * BOARD.pad);
      if (x + w > BOARD.w - BOARD.pad) {
        x = BOARD.pad;
        y += rowH + gap;
        rowH = 0;
        if (y + 46 > y0 + bandH) break;
        continue;
      }
      if (y + h > y0 + bandH) {
        // shrink height to fit
        h = Math.floor(y0 + bandH - y);
        if (h < 44) { break; }
      }
      const r = { x, y, w, h };
      if (!insideBoard(r) || planks.some(p => rectsOverlap(r, p, gap - 2))) {
        x += 12; continue;
      }
      planks.push({ id: 'p' + planks.length, type, x: x + w / 2, y: y + h / 2, w, h, rot: 0, layer: 0, band, _r: r });
      x += w + gap;
      rowH = Math.max(rowH, h);
      placed++;
    }
  }
  return planks;
}

function placeScrews(planks, colors, rnd) {
  const screws = [];
  let sid = 0;
  for (const p of planks) {
    const count = 2 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.35 ? 1 : 0);
    const positions = [];
    for (let k = 0; k < count; k++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const sx = p._r.x + 18 + rnd() * Math.max(1, p._r.w - 36);
        const sy = p._r.y + 18 + rnd() * Math.max(1, p._r.h - 36);
        if (positions.some(([x, y]) => (x - sx) ** 2 + (y - sy) ** 2 < 28 * 28)) continue;
        // must be inside plank rect with margin
        if (sx < p._r.x + 14 || sx > p._r.x + p._r.w - 14 || sy < p._r.y + 14 || sy > p._r.y + p._r.h - 14) continue;
        positions.push([sx, sy]);
        screws.push({
          id: 's' + (sid++), x: sx, y: sy,
          color: colors[Math.floor(rnd() * colors.length)],
          plankId: p.id, locked: false, keyId: null
        });
        break;
      }
    }
    if (!screws.some(s => s.plankId === p.id)) {
      screws.push({
        id: 's' + (sid++), x: p.x, y: p.y,
        color: colors[Math.floor(rnd() * colors.length)],
        plankId: p.id, locked: false, keyId: null
      });
    }
  }
  return screws;
}

function addLocks(screws, planks, rnd, lockFrac) {
  // Pick some screws as keys (free), lock others requiring a key
  const byBand = {};
  planks.forEach(p => { byBand[p.band] = byBand[p.band] || []; byBand[p.band].push(p.id); });
  const free = screws.filter(s => !s.locked);
  // Band lock: all screws on band>0 locked until ALL planks on lower bands gone — encoded as lockedUntilBandClear
  for (const sc of screws) {
    const p = planks.find(x => x.id === sc.plankId);
    if (p && p.band > 0) sc.lockedUntilBand = p.band; // need bands < this clear
  }
  // Additional key locks on same band for harder levels
  const candidates = screws.filter(s => !s.lockedUntilBand || s.lockedUntilBand === 0);
  const lockN = Math.floor(candidates.length * lockFrac);
  const keys = candidates.filter(s => !(s.lockedUntilBand > 0));
  for (let i = 0; i < lockN && keys.length > 1; i++) {
    const target = candidates[Math.floor(rnd() * candidates.length)];
    if (target.locked || target.keyId) continue;
    const key = keys.find(k => k.id !== target.id && k.plankId !== target.plankId);
    if (!key) continue;
    target.locked = true;
    target.keyId = key.id;
    key.isKey = true;
  }
}

function chooseBoxes(screws, colors, rnd) {
  const counts = {};
  screws.forEach(s => { counts[s.color] = (counts[s.color] || 0) + 1; });
  const off = colors.slice();
  // two boxes from colors, ensure off-colors exist
  let boxes = [colors[0], colors[Math.min(1, colors.length - 1)]];
  if (colors.length >= 3) {
    boxes = [colors[0], colors[2]];
  }
  // recolor ~50% to off-box
  const others = colors.filter(c => c !== boxes[0] && c !== boxes[1]);
  if (others.length) {
    screws.forEach(s => {
      if (rnd() < 0.62) s.color = others[Math.floor(rnd() * others.length)];
      else s.color = boxes[Math.floor(rnd() * 2)];
    });
  }
  const ensure = (col, n) => {
    let have = screws.filter(s => s.color === col).length;
    for (const s of screws) { if (have >= n) break; if (s.color !== col) { s.color = col; have++; } }
  };
  ensure(boxes[0], 3); ensure(boxes[1], 3);
  return boxes;
}

function handLevels() {
  const L1 = {
    name: 'Старт', slots: 5, boxes: ['red'], bands: 1,
    goal: 'Урони все доски',
    tut: ['tap', 'Нажми на винт — он улетит в коробку'],
    planks: [
      { id: 'a', type: 'barH', x: 160, y: 110, w: 200, h: 56, rot: 0, layer: 0, band: 0 },
      { id: 'b', type: 'barH', x: 160, y: 210, w: 200, h: 56, rot: 0, layer: 0, band: 0 }
    ],
    screws: [
      { id: 's0', x: 90, y: 110, color: 'red', plankId: 'a' },
      { id: 's1', x: 230, y: 110, color: 'red', plankId: 'a' },
      { id: 's2', x: 160, y: 210, color: 'red', plankId: 'b' }
    ]
  };
  const L2 = {
    name: 'Коробки', slots: 5, boxes: ['red', 'yellow'], bands: 1,
    goal: 'Урони все доски',
    tut: ['color', 'Смотри цвет коробки — чужой винт займёт ожидание'],
    planks: [
      { id: 'a', type: 'barH', x: 110, y: 90, w: 140, h: 52, rot: 0, layer: 0, band: 0 },
      { id: 'b', type: 'barH', x: 250, y: 90, w: 100, h: 52, rot: 0, layer: 0, band: 0 },
      { id: 'c', type: 'square', x: 100, y: 200, w: 90, h: 90, rot: 0, layer: 0, band: 0 },
      { id: 'd', type: 'barV', x: 230, y: 210, w: 52, h: 120, rot: 0, layer: 0, band: 0 }
    ],
    screws: [
      { id: 's0', x: 70, y: 90, color: 'red', plankId: 'a' },
      { id: 's1', x: 150, y: 90, color: 'yellow', plankId: 'a' },
      { id: 's2', x: 250, y: 90, color: 'green', plankId: 'b' },
      { id: 's3', x: 100, y: 180, color: 'red', plankId: 'c' },
      { id: 's4', x: 100, y: 230, color: 'blue', plankId: 'c' },
      { id: 's5', x: 230, y: 170, color: 'yellow', plankId: 'd' },
      { id: 's6', x: 230, y: 250, color: 'green', plankId: 'd' }
    ]
  };
  const L3 = {
    name: 'Замок', slots: 5, boxes: ['red', 'yellow'], bands: 1,
    goal: 'Урони все доски',
    tut: ['lock', 'Серый замок: сначала открути винт с ключиком'],
    planks: [
      { id: 'a', type: 'barH', x: 160, y: 80, w: 220, h: 54, rot: 0, layer: 0, band: 0 },
      { id: 'b', type: 'barH', x: 100, y: 180, w: 140, h: 54, rot: 0, layer: 0, band: 0 },
      { id: 'c', type: 'barH', x: 250, y: 180, w: 100, h: 54, rot: 0, layer: 0, band: 0 },
      { id: 'd', type: 'square', x: 160, y: 270, w: 100, h: 80, rot: 0, layer: 0, band: 0 }
    ],
    screws: [
      { id: 'k0', x: 80, y: 80, color: 'red', plankId: 'a', isKey: true },
      { id: 's1', x: 160, y: 80, color: 'yellow', plankId: 'a' },
      { id: 's2', x: 240, y: 80, color: 'green', plankId: 'a', locked: true, keyId: 'k0' },
      { id: 's3', x: 60, y: 180, color: 'yellow', plankId: 'b' },
      { id: 's4', x: 140, y: 180, color: 'blue', plankId: 'b', locked: true, keyId: 'k0' },
      { id: 's5', x: 250, y: 180, color: 'red', plankId: 'c' },
      { id: 's6', x: 140, y: 270, color: 'yellow', plankId: 'd' },
      { id: 's7', x: 190, y: 270, color: 'red', plankId: 'd' }
    ]
  };
  const L4 = {
    name: 'Два ряда', slots: 4, boxes: ['red', 'blue'], bands: 2,
    goal: 'Урони все доски',
    tut: ['band', 'Нижний ряд закрыт, пока не упадёт верхний'],
    planks: [
      { id: 't0', type: 'barH', x: 95, y: 55, w: 120, h: 48, rot: 0, layer: 0, band: 0 },
      { id: 't1', type: 'barH', x: 230, y: 55, w: 110, h: 48, rot: 0, layer: 0, band: 0 },
      { id: 't2', type: 'square', x: 160, y: 120, w: 72, h: 52, rot: 0, layer: 0, band: 0 },
      { id: 'b0', type: 'barH', x: 95, y: 220, w: 120, h: 48, rot: 0, layer: 0, band: 1 },
      { id: 'b1', type: 'barH', x: 230, y: 220, w: 110, h: 48, rot: 0, layer: 0, band: 1 },
      { id: 'b2', type: 'square', x: 160, y: 280, w: 80, h: 55, rot: 0, layer: 0, band: 1 }
    ],
    screws: [
      { id: 'a', x: 55, y: 55, color: 'red', plankId: 't0' },
      { id: 'b', x: 130, y: 55, color: 'yellow', plankId: 't0' },
      { id: 'c', x: 200, y: 55, color: 'blue', plankId: 't1' },
      { id: 'd', x: 260, y: 55, color: 'green', plankId: 't1' },
      { id: 'e', x: 160, y: 120, color: 'red', plankId: 't2' },
      { id: 'f', x: 55, y: 220, color: 'green', plankId: 'b0', lockedUntilBand: 1 },
      { id: 'g', x: 130, y: 220, color: 'blue', plankId: 'b0', lockedUntilBand: 1 },
      { id: 'h', x: 200, y: 220, color: 'yellow', plankId: 'b1', lockedUntilBand: 1 },
      { id: 'i', x: 260, y: 220, color: 'red', plankId: 'b1', lockedUntilBand: 1 },
      { id: 'j', x: 140, y: 280, color: 'yellow', plankId: 'b2', lockedUntilBand: 1 },
      { id: 'k', x: 185, y: 280, color: 'green', plankId: 'b2', lockedUntilBand: 1 }
    ]
  };
  return [L1, L2, L3, L4];
}

function normalizeHand(level) {
  for (const p of level.planks) {
    p._r = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
  }
  return level;
}

function validateGeometry(level) {
  const planks = level.planks.map(p => {
    const r = p._r || { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    return { ...p, _r: r };
  });
  for (const p of planks) {
    if (!insideBoard(p._r)) return { ok: false, reason: 'oob ' + p.id };
  }
  for (let i = 0; i < planks.length; i++) {
    for (let j = i + 1; j < planks.length; j++) {
      if (rectsOverlap(planks[i]._r, planks[j]._r, 6)) return { ok: false, reason: 'overlap ' + planks[i].id + '/' + planks[j].id };
    }
  }
  for (const s of level.screws) {
    const p = planks.find(x => x.id === s.plankId);
    if (!p) return { ok: false, reason: 'no plank ' + s.id };
    const m = 10;
    if (s.x < p._r.x + m || s.x > p._r.x + p._r.w - m || s.y < p._r.y + m || s.y > p._r.y + p._r.h - m)
      return { ok: false, reason: 'screw oob plank ' + s.id };
  }
  return { ok: true };
}

// ---- solver ----
function bandClear(level, alivePlanks, band) {
  return ![...alivePlanks].some(id => {
    const p = level.planks.find(x => x.id === id);
    return p && (p.band || 0) < band;
  });
}
function isScrewLocked(level, sc, alivePlanks, removedKeys) {
  if (sc.lockedUntilBand && sc.lockedUntilBand > 0) {
    if (!bandClear(level, alivePlanks, sc.lockedUntilBand)) return true;
  }
  if (sc.locked && sc.keyId && !removedKeys.has(sc.keyId)) return true;
  return false;
}
function freeScrews(level, alivePlanks, aliveScrews, removedKeys) {
  return level.screws.filter(s => aliveScrews.has(s.id) && !isScrewLocked(level, s, alivePlanks, removedKeys));
}
function applyRemove(level, state, screwId) {
  const sc = level.screws.find(s => s.id === screwId);
  const screws = new Set(state.screws); screws.delete(screwId);
  const planks = new Set(state.planks);
  const removedKeys = new Set(state.removedKeys); removedKeys.add(screwId);
  if (!level.screws.some(s => s.plankId === sc.plankId && screws.has(s.id))) planks.delete(sc.plankId);
  const boxes = state.boxes.map(b => ({ c: b.c, n: b.n }));
  let wait = state.wait.slice();
  const bi = boxes.findIndex(b => b.c === sc.color && b.n < BOX_CAP);
  if (bi >= 0) {
    boxes[bi].n++;
    if (boxes[bi].n >= BOX_CAP) {
      const need = {};
      for (const s of level.screws) if (screws.has(s.id)) need[s.color] = (need[s.color] || 0) + 1;
      wait.forEach(c => { need[c] = (need[c] || 0) + 1; });
      const open = new Set(boxes.map(b => b.c)); open.delete(boxes[bi].c);
      let next = Object.keys(need).filter(c => !open.has(c) && need[c] > 0)[0] || Object.keys(need)[0] || boxes[bi].c;
      boxes[bi] = { c: next, n: 0 };
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < wait.length; i++) {
          const wi = boxes.findIndex(b => b.c === wait[i] && b.n < BOX_CAP);
          if (wi < 0) continue;
          boxes[wi].n++; wait.splice(i, 1); i--; moved = true;
          if (boxes[wi].n >= BOX_CAP) {
            const need2 = {};
            for (const s of level.screws) if (screws.has(s.id)) need2[s.color] = (need2[s.color] || 0) + 1;
            wait.forEach(c => { need2[c] = (need2[c] || 0) + 1; });
            const open2 = new Set(boxes.map(b => b.c)); open2.delete(boxes[wi].c);
            let nx = Object.keys(need2).filter(c => !open2.has(c) && need2[c] > 0)[0] || Object.keys(need2)[0] || boxes[wi].c;
            boxes[wi] = { c: nx, n: 0 };
          }
        }
      }
    }
  } else {
    if (wait.length >= state.slots) return null;
    wait.push(sc.color);
  }
  return { planks, screws, boxes, wait, slots: state.slots, removedKeys };
}
function keyOf(st) {
  return [...st.screws].sort().join(',') + ';' + [...st.planks].sort().join(',') + ';' +
    st.boxes.map(b => b.c + b.n).join('|') + ';' + st.wait.slice().sort().join(',') + ';' +
    [...st.removedKeys].sort().join(',');
}
function solvable(level, maxNodes = 10000) {
  const start = {
    planks: new Set(level.planks.map(p => p.id)),
    screws: new Set(level.screws.map(s => s.id)),
    boxes: level.boxes.map(c => ({ c, n: 0 })),
    wait: [], slots: level.slots, removedKeys: new Set()
  };
  const q = [start]; const seen = new Set([keyOf(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const st = q.shift(); nodes++;
    if (st.planks.size === 0) return { ok: true, nodes };
    const free = freeScrews(level, st.planks, st.screws, st.removedKeys);
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
      q.push(nx);
    }
  }
  return { ok: false, nodes };
}
function naiveFailRate(level, trials = 40) {
  let fails = 0;
  for (let t = 0; t < trials; t++) {
    const rnd = mulberry(7 + t * 99 + level.screws.length * 3);
    let st = {
      planks: new Set(level.planks.map(p => p.id)),
      screws: new Set(level.screws.map(s => s.id)),
      boxes: level.boxes.map(c => ({ c, n: 0 })),
      wait: [], slots: level.slots, removedKeys: new Set()
    };
    let guard = 0, lost = false;
    while (st.planks.size && guard++ < 140) {
      const free = freeScrews(level, st.planks, st.screws, st.removedKeys);
      if (!free.length) { lost = true; break; }
      const matching = free.filter(s => st.boxes.some(b => b.c === s.color && b.n < BOX_CAP));
      const pick = (matching.length && rnd() < 0.4)
        ? matching[Math.floor(rnd() * matching.length)]
        : free[Math.floor(rnd() * free.length)];
      const nx = applyRemove(level, st, pick.id);
      if (!nx) { lost = true; break; }
      st = nx;
    }
    if (lost || st.planks.size > 0) fails++;
  }
  return fails / trials;
}

function generateCandidate(n, attempt) {
  const rnd = mulberry(3200 + n * 911 + attempt * 44);
  const colorCount = Math.min(6, n < 5 ? 3 : n < 12 ? 4 : n < 22 ? 5 : 6);
  const colors = COLORS.slice(0, colorCount);
  const bands = n >= 3 ? (n >= 15 ? 2 : (rnd() < 0.55 ? 2 : 1)) : 1;
  const plankCount = Math.min(4 + Math.floor(n / 2.5), bands === 2 ? 10 : 8);
  const planks = packPlanks(plankCount, rnd, bands);
  if (planks.length < Math.min(3, plankCount)) return null;
  const screws = placeScrews(planks, colors, rnd);
  const lockFrac = n < 5 ? 0.1 : n < 12 ? 0.2 : 0.3;
  addLocks(screws, planks, rnd, lockFrac);
  const boxes = chooseBoxes(screws, colors, rnd);
  const level = {
    name: 'Ур.' + (n + 1),
    slots: n >= 8 ? 4 : 5,
    boxes, bands,
    goal: 'Урони все доски',
    planks: planks.map(({ _r, ...p }) => p),
    screws
  };
  // keep _r for validate via reconstruct
  level.planks.forEach((p, i) => { p._r = planks[i]._r; });
  return level;
}

function stripInternal(level) {
  const L = JSON.parse(JSON.stringify(level));
  L.planks.forEach(p => { delete p._r; });
  return L;
}

function buildAll() {
  const levels = handLevels().map(normalizeHand);
  const stats = [];
  for (let i = 0; i < levels.length; i++) {
    const g = validateGeometry(levels[i]);
    const sol = solvable(levels[i]);
    const fail = naiveFailRate(levels[i], 30);
    stats.push({ i, name: levels[i].name, geom: g.ok, solvable: sol.ok, greedyFail: fail, screws: levels[i].screws.length, planks: levels[i].planks.length, colors: new Set(levels[i].screws.map(s => s.color)).size });
    if (!g.ok) console.warn('HAND GEOM', i, g);
    if (!sol.ok) console.warn('HAND SOL', i);
  }
  for (let n = 4; n < 42; n++) {
    let best = null, bestStat = null, pool = [];
    for (let attempt = 0; attempt < 70; attempt++) {
      const cand = generateCandidate(n, attempt);
      if (!cand) continue;
      const g = validateGeometry(cand);
      if (!g.ok) continue;
      const sol = solvable(cand, 12000);
      if (!sol.ok) continue;
      const fail = naiveFailRate(cand, 40);
      const need = n >= 4 ? 0.4 : 0.1;
      const item = { cand, fail, attempt, screws: cand.screws.length, colors: new Set(cand.screws.map(s => s.color)).size };
      if (fail >= need) { best = cand; bestStat = { i: n, name: cand.name, geom: true, solvable: true, greedyFail: fail, screws: item.screws, planks: cand.planks.length, colors: item.colors, attempts: attempt }; break; }
      pool.push(item);
    }
    if (!best && pool.length) {
      pool.sort((a, b) => b.fail - a.fail);
      best = pool[0].cand;
      bestStat = { i: n, name: best.name, geom: true, solvable: true, greedyFail: pool[0].fail, screws: pool[0].screws, planks: best.planks.length, colors: pool[0].colors, relaxed: true, attempts: pool[0].attempt };
    }
    if (!best) {
      console.error('fallback', n + 1);
      best = JSON.parse(JSON.stringify(levels[Math.min(3, levels.length - 1)]));
      best.name = 'Ур.' + (n + 1);
      bestStat = { i: n, name: best.name, fallback: true, solvable: true, greedyFail: naiveFailRate(best, 20), geom: true, screws: best.screws.length, planks: best.planks.length, colors: new Set(best.screws.map(s => s.color)).size };
    }
    levels.push(best);
    stats.push(bestStat);
    console.log('L' + (n + 1), bestStat);
  }
  return { levels: levels.map(stripInternal), stats };
}

const out = buildAll();
fs.writeFileSync(path.join(__dirname, '..', 'www', 'levels.json'), JSON.stringify({ version: '3.2.0', levels: out.levels, stats: out.stats }));
fs.writeFileSync(path.join(__dirname, '..', 'shots', 'v32-solver-stats.json'), JSON.stringify(out.stats, null, 2));
const avg = out.stats.slice(4).reduce((a, s) => a + (s.greedyFail || 0), 0) / Math.max(1, out.stats.length - 4);
console.log('Wrote 42 levels, L5+ avg fail', avg.toFixed(2));
