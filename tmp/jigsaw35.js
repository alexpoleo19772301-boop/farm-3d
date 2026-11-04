  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Rebuild level as a real assembled jigsaw:
   * polyominoes (1x1/1x2/2x1/2x2) on a cell grid, shared edges get
   * complementary knob/blank, outer & empty-facing edges stay flat,
   * bodies sit flush with a hairline seam (no overlaps).
   */
  function rebuildAsJigsaw(raw, levelSeed) {
    const rng = makeRng((levelSeed + 1) * 9973 + 42);
    const srcPlanks = raw.planks || [];
    const srcScrews = raw.screws || [];
    const by = {};
    for (const s of srcScrews) (by[s.plankId] = by[s.plankId] || []).push(s);

    const pieces = srcPlanks.map((p, i) => {
      const ss = by[p.id] || [];
      const ns = ss.length;
      let cw = 1, ch = 1;
      if (ns >= 3) { cw = 2; ch = 2; }
      else if (ns === 2) {
        if ((p.w || 1) >= (p.h || 1)) { cw = 2; ch = 1; }
        else { cw = 1; ch = 2; }
      } else if (rng() < 0.22) {
        if ((p.w || 1) >= (p.h || 1)) { cw = 2; ch = 1; }
        else { cw = 1; ch = 2; }
      }
      return { id: p.id, cw, ch, band: p.band || 0, type: p.type || 'barH', screws: ss, i };
    });

    const margin = 6;
    const usableW = Math.max(80, board.w - margin * 2);
    const usableH = Math.max(80, board.h - margin * 2);
    const minCell = Math.max(58, screwR * 2 + 26);

    let totalCells = pieces.reduce((s, p) => s + p.cw * p.ch, 0);
    let emptyBoost = Math.max(1, Math.round(totalCells * 0.15));
    let cols = Math.max(2, Math.ceil(Math.sqrt(totalCells + emptyBoost)));
    let rows = Math.max(2, Math.ceil((totalCells + emptyBoost) / cols));
    // Fit cell size
    while (cols > 2 && usableW / cols < minCell) cols--;
    while (rows > 2 && usableH / rows < minCell) rows--;
    // If still too tight, shrink piece shapes
    function shrinkToFit() {
      let cells = pieces.reduce((s, p) => s + p.cw * p.ch, 0);
      while (cells > cols * rows) {
        // shrink largest
        let best = null;
        for (const p of pieces) {
          if (p.cw * p.ch <= 1) continue;
          if (!best || p.cw * p.ch > best.cw * best.ch) best = p;
        }
        if (!best) break;
        if (best.cw >= best.ch && best.cw > 1) best.cw--;
        else if (best.ch > 1) best.ch--;
        else break;
        cells = pieces.reduce((s, p) => s + p.cw * p.ch, 0);
      }
    }
    shrinkToFit();

    const order = pieces.slice().sort((a, b) =>
      (b.cw * b.ch) - (a.cw * a.ch) || a.band - b.band || a.i - b.i);

    let grid = null, placed = null;
    function tryPack(C, R) {
      const g = Array.from({ length: R }, () => Array(C).fill(null));
      const pl = {};
      const hasBand1 = pieces.some(p => p.band >= 1);
      const split = hasBand1 ? Math.max(1, Math.ceil(R / 2)) : R;
      for (const pc of order) {
        const minR = pc.band >= 1 ? split : 0;
        const maxR = pc.band >= 1 ? R : split;
        const spots = [];
        for (let r = minR; r <= maxR - pc.ch; r++) {
          for (let c = 0; c <= C - pc.cw; c++) {
            let free = true;
            for (let dr = 0; dr < pc.ch && free; dr++)
              for (let dc = 0; dc < pc.cw && free; dc++)
                if (g[r + dr][c + dc]) free = false;
            if (free) spots.push({ r, c });
          }
        }
        if (!spots.length) return null;
        spots.sort((A, B) => {
          const score = (s) => {
            let n = 0;
            for (let dr = 0; dr < pc.ch; dr++) for (let dc = 0; dc < pc.cw; dc++) {
              const rr = s.r + dr, cc = s.c + dc;
              [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dr2, dc2]) => {
                const r2 = rr + dr2, c2 = cc + dc2;
                if (r2 >= 0 && r2 < R && c2 >= 0 && c2 < C && g[r2][c2]) n++;
              });
            }
            return -n * 20 + Math.hypot(s.r + pc.ch / 2 - R / 2, s.c + pc.cw / 2 - C / 2);
          };
          return score(A) - score(B);
        });
        // slight rng among top 3
        const pick = spots[Math.min(spots.length - 1, (rng() * Math.min(3, spots.length)) | 0)];
        for (let dr = 0; dr < pc.ch; dr++)
          for (let dc = 0; dc < pc.cw; dc++)
            g[pick.r + dr][pick.c + dc] = pc.id;
        pl[pc.id] = { r: pick.r, c: pick.c, cw: pc.cw, ch: pc.ch };
      }
      return { g, pl, C, R };
    }

    let pack = tryPack(cols, rows);
    for (let grow = 0; !pack && grow < 12; grow++) {
      if (grow % 2 === 0) cols++; else rows++;
      shrinkToFit();
      pack = tryPack(cols, rows);
    }
    if (!pack) {
      cols = Math.max(cols, pieces.length); rows = Math.max(rows, 3);
      for (const p of pieces) { p.cw = 1; p.ch = 1; }
      pack = tryPack(cols, rows);
    }
    grid = pack.g; placed = pack.pl; cols = pack.C; rows = pack.R;

    // Crop empty borders (keep interior holes)
    let minC = cols, minR = rows, maxC = -1, maxR = -1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c]) {
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    }
    if (maxC >= minC) {
      const newCols = maxC - minC + 1, newRows = maxR - minR + 1;
      const ng = Array.from({ length: newRows }, () => Array(newCols).fill(null));
      for (let r = 0; r < newRows; r++) for (let c = 0; c < newCols; c++)
        ng[r][c] = grid[r + minR][c + minC];
      grid = ng; cols = newCols; rows = newRows;
      for (const id of Object.keys(placed)) {
        placed[id].r -= minR; placed[id].c -= minC;
      }
    }

    const seam = 1.0;
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const unit = Math.min(cellW, cellH);
    const tabR = Math.max(9, Math.min(unit * 0.20, 26));

    function owner(r, c) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
      return grid[r][c];
    }
    function tabSign(r, c, horiz) {
      const h = ((r * 73856093) ^ (c * 19349663) ^ (horiz ? 83492791 : 1) ^ ((levelSeed + 3) * 17)) >>> 0;
      return (h & 1) ? 1 : -1;
    }

    playOrigin = { x: board.x + margin, y: board.y + margin, s: 1, sx: 1, sy: 1 };

    const planksOut = [];
    const screwsOut = [];
    let sid = 0;

    for (const pc of pieces) {
      const pl = placed[pc.id];
      if (!pl) continue;
      const pw = pl.cw * cellW - seam;
      const ph = pl.ch * cellH - seam;
      const px = margin + (pl.c + pl.cw / 2) * cellW;
      const py = margin + (pl.r + pl.ch / 2) * cellH;

      // Edge kinds in PATH order (one entry per unit cell along that side)
      const edges = { t: [], r: [], b: [], l: [] };
      // Top L→R
      for (let dc = 0; dc < pl.cw; dc++) {
        const nb = owner(pl.r - 1, pl.c + dc);
        let k = 0;
        if (nb && nb !== pc.id) k = -tabSign(pl.r - 1, pl.c + dc, true);
        edges.t.push(k);
      }
      // Right T→B
      for (let dr = 0; dr < pl.ch; dr++) {
        const nb = owner(pl.r + dr, pl.c + pl.cw);
        let k = 0;
        if (nb && nb !== pc.id) k = -tabSign(pl.r + dr, pl.c + pl.cw - 1, false);
        edges.r.push(k);
      }
      // Bottom R→L
      for (let dc = pl.cw - 1; dc >= 0; dc--) {
        const nb = owner(pl.r + pl.ch, pl.c + dc);
        let k = 0;
        if (nb && nb !== pc.id) k = tabSign(pl.r + pl.ch - 1, pl.c + dc, true);
        edges.b.push(k);
      }
      // Left B→T
      for (let dr = pl.ch - 1; dr >= 0; dr--) {
        const nb = owner(pl.r + dr, pl.c - 1);
        let k = 0;
        if (nb && nb !== pc.id) k = tabSign(pl.r + dr, pl.c - 1, false);
        edges.l.push(k);
      }

      planksOut.push({
        id: pc.id, type: pc.type, x: px, y: py, w: pw, h: ph,
        rot: 0, layer: 0, band: pc.band,
        edges, tabR, cells: { r: pl.r, c: pl.c, cw: pl.cw, ch: pl.ch }
      });

      // Screw positions: cell centers, pushed away from blanks
      const reach = tabR * 1.85;
      const centers = [];
      for (let dr = 0; dr < pl.ch; dr++) {
        for (let dc = 0; dc < pl.cw; dc++) {
          let cx = margin + (pl.c + dc + 0.5) * cellW;
          let cy = margin + (pl.r + dr + 0.5) * cellH;
          // blank insets for this unit cell relative to piece
          const topBlank = edges.t[dc] < 0 && dr === 0;
          const botBlank = edges.b[pl.cw - 1 - dc] < 0 && dr === pl.ch - 1;
          const leftBlank = edges.l[pl.ch - 1 - dr] < 0 && dc === 0;
          const rightBlank = edges.r[dr] < 0 && dc === pl.cw - 1;
          const inset = screwR + 8;
          const blankPad = reach + screwR + 2;
          let x0 = margin + pl.c * cellW + seam * 0.5 + inset;
          let x1 = margin + (pl.c + pl.cw) * cellW - seam * 0.5 - inset;
          let y0 = margin + pl.r * cellH + seam * 0.5 + inset;
          let y1 = margin + (pl.r + pl.ch) * cellH - seam * 0.5 - inset;
          if (topBlank) y0 = Math.max(y0, margin + pl.r * cellH + blankPad);
          if (botBlank) y1 = Math.min(y1, margin + (pl.r + pl.ch) * cellH - blankPad);
          if (leftBlank) x0 = Math.max(x0, margin + pl.c * cellW + blankPad);
          if (rightBlank) x1 = Math.min(x1, margin + (pl.c + pl.cw) * cellW - blankPad);
          cx = Math.max(x0, Math.min(x1, cx));
          cy = Math.max(y0, Math.min(y1, cy));
          centers.push({ x: cx, y: cy });
        }
      }
      // Prefer evenly spaced centers for N screws
      const ss = pc.screws.slice();
      const n = ss.length;
      let picks = centers.slice();
      if (n === 1) picks = [centers[centers.length >> 1] || { x: px, y: py }];
      else if (n === 2 && centers.length >= 2) {
        picks = [centers[0], centers[centers.length - 1]];
      } else if (n > centers.length) {
        // synthesize along long axis inside safe box
        picks = [];
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          if (pw >= ph) picks.push({ x: px - pw * 0.28 + pw * 0.56 * t, y: py });
          else picks.push({ x: px, y: py - ph * 0.28 + ph * 0.56 * t });
        }
      } else {
        // pick N spread centers
        picks = [];
        for (let i = 0; i < n; i++) {
          const idx = Math.round(i * (centers.length - 1) / Math.max(1, n - 1));
          picks.push(centers[idx]);
        }
      }
      const safeInset = screwR + 10;
      const blankExtra = reach * 0.5;
      function clampScrew(sx, sy) {
        let x0 = px - pw / 2 + safeInset, x1 = px + pw / 2 - safeInset;
        let y0 = py - ph / 2 + safeInset, y1 = py + ph / 2 - safeInset;
        // pad from any blank side of the whole piece
        if (edges.t.some(k => k < 0)) y0 += blankExtra;
        if (edges.b.some(k => k < 0)) y1 -= blankExtra;
        if (edges.l.some(k => k < 0)) x0 += blankExtra;
        if (edges.r.some(k => k < 0)) x1 -= blankExtra;
        return {
          x: Math.max(x0, Math.min(x1, sx)),
          y: Math.max(y0, Math.min(y1, sy))
        };
      }
      for (let i = 0; i < n; i++) {
        const src = ss[i];
        const pt = clampScrew(picks[i].x, picks[i].y);
        screwsOut.push({
          ...src,
          id: src.id || ('s' + (sid++)),
          x: pt.x, y: pt.y, plankId: pc.id
        });
      }
    }

    return {
      ...raw,
      planks: planksOut,
      screws: screwsOut,
      _jigsaw: { cols, rows, cellW, cellH, tabR, grid }
    };
  }

  function scaleLevel(def) {
    // v3.5: geometry comes from rebuildAsJigsaw; keep stub for compat
    return def;
  }

  function knobRadiusFor(edgeLen, w, h) {
    return Math.max(9, Math.min(edgeLen * 0.20, Math.min(w, h) * 0.22, 28));
  }

  function tabReachFor(p) {
    const R = p.tabR || 12;
    return R * 1.85;
  }

  function assignPuzzleEdges() {
    // Edges already assigned in rebuildAsJigsaw — ensure every plank has them
    for (const p of planks) {
      if (!p.alive) continue;
      if (!p.edges) p.edges = { t: [0], r: [0], b: [0], l: [0] };
      if (!p.tabR) p.tabR = knobRadiusFor(Math.min(p.w, p.h), p.w, p.h);
    }
  }

  function nestPuzzlePieces() { /* no-op: grid already flush */ }

  /**
   * Classic jigsaw outline. edges[side] = array of -1|0|1 per unit segment
   * in path order (t L→R, r T→B, b R→L, l B→T). Knob = circle through edge.
   */
  function jigsawPath(ctx, w, h, edges, tabR) {
    const hw = w / 2, hh = h / 2;
    function normEdge(e) {
      if (Array.isArray(e)) return e.length ? e : [0];
      if (typeof e === 'number') return [e];
      return [0];
    }
    function bumpOne(x0, y0, x1, y1, kind, nx, ny) {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      if (!kind) { ctx.lineTo(x1, y1); return; }
      const R = Math.max(7, Math.min(tabR || len * 0.2, len * 0.28));
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
    function side(x0, y0, x1, y1, nx, ny, kinds) {
      const ks = normEdge(kinds);
      const n = ks.length;
      for (let i = 0; i < n; i++) {
        const xa = x0 + (x1 - x0) * i / n;
        const ya = y0 + (y1 - y0) * i / n;
        const xb = x0 + (x1 - x0) * (i + 1) / n;
        const yb = y0 + (y1 - y0) * (i + 1) / n;
        bumpOne(xa, ya, xb, yb, ks[i] || 0, nx, ny);
      }
    }
    const e = edges || { t: [0], r: [0], b: [0], l: [0] };
    ctx.moveTo(-hw, -hh);
    side(-hw, -hh, hw, -hh, 0, -1, e.t);
    side(hw, -hh, hw, hh, 1, 0, e.r);
    side(hw, hh, -hw, hh, 0, 1, e.b);
    side(-hw, hh, -hw, -hh, -1, 0, e.l);
    ctx.closePath();
  }
