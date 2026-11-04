#!/usr/bin/env python3
"""Patch game.js + index.html for v3.8.0 screws/chain/boss."""
from pathlib import Path
import re

GJ_PATH = Path('/workspace/farm-3d/www/game.js')
HTML_PATH = Path('/workspace/farm-3d/www/index.html')
GJ = GJ_PATH.read_text()

# ---------- 1) drawScrewHead ----------
m = re.search(r'  function drawScrewHead\(x, y, color, spin, scale, blocked, shaking, isKey, opts\) \{.*?\n  \}\n', GJ, re.S)
assert m, 'drawScrewHead missing'
new_screw = r'''  function shadeHex(hex, amt) {
    const h = String(hex || '#888').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    if (!Number.isFinite(n)) return hex;
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function drawScrewHead(x, y, color, spin, scale, blocked, shaking, isKey, opts) {
    // ~25-30% bigger visual vs old 0.85*screwR; wide saturated rim, small cross
    const r = screwR * 1.08 * (scale || 1);
    ctx.save();
    ctx.translate(x + (shaking ? Math.sin(animT * 55) * 3 : 0), y);
    ctx.rotate(spin || 0);
    const col = COLORS[color] || '#888';
    const rim = (typeof COLOR_RIM !== 'undefined' && COLOR_RIM[color]) || col;

    // soft drop shadow
    ctx.beginPath();
    ctx.arc(1.6, 2.4, r * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();

    // saturated colour body + wide rim (colour reads clearly)
    const grd = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.08, 0, 0, r);
    grd.addColorStop(0, rim);
    grd.addColorStop(0.5, col);
    grd.addColorStop(1, shadeHex(col, -38));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // bright outer colour ring
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2);
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(3.8, r * 0.24);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // metal centre disc (smaller so colour rim dominates)
    const metalR = r * 0.52;
    const mg = ctx.createRadialGradient(-metalR * 0.3, -metalR * 0.35, 1, 0, 0, metalR);
    mg.addColorStop(0, '#f5f3eb');
    mg.addColorStop(0.55, '#c9c5b8');
    mg.addColorStop(1, '#8b8778');
    ctx.beginPath();
    ctx.arc(0, 0, metalR, 0, Math.PI * 2);
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // smaller cross slot
    const slot = metalR * 0.52;
    const sw = Math.max(2.0, r * 0.11);
    ctx.strokeStyle = '#2e2c26';
    ctx.lineWidth = sw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-slot, 0); ctx.lineTo(slot, 0);
    ctx.moveTo(0, -slot); ctx.lineTo(0, slot);
    ctx.stroke();

    // specular
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.34, r * 0.22, r * 0.11, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fill();

    opts = opts || {};
    if (opts.rusty) {
      ctx.fillStyle = 'rgba(120,70,30,0.40)';
      ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fill();
      ctx.font = Math.max(11, r * 0.55) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧱', r * 0.55, -r * 0.55);
    }
    if (opts.ice && !opts.iceBroken) {
      ctx.fillStyle = 'rgba(180,220,255,0.50)';
      ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.15); ctx.lineTo(r * 0.45, r * 0.45); ctx.stroke();
      ctx.font = Math.max(11, r * 0.5) + 'px sans-serif';
      ctx.fillStyle = '#e8f6ff'; ctx.fillText('❄️', 0, 0);
    } else if (opts.ice && opts.iceBroken) {
      ctx.strokeStyle = 'rgba(200,230,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.4, r * 0.4); ctx.stroke();
    }
    if (opts.chainId) {
      ctx.font = Math.max(12, r * 0.55) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔗', -r * 0.55, -r * 0.55);
    }
    if (isKey && !blocked) {
      ctx.font = Math.max(13, r * 0.58) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔑', r * 0.55, -r * 0.55);
    }
    if (blocked) {
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold ' + Math.max(12, r * 0.55) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText('🔒', 0, 1);
    }
    ctx.restore();
  }
'''
GJ = GJ[:m.start()] + new_screw + GJ[m.end():]

# ---------- 2) drawChains + helpers ----------
m2 = re.search(r'  function drawChains\(\) \{.*?\n  \}\n', GJ, re.S)
assert m2, 'drawChains missing'
new_chain = r'''  function drawChains() {
    const seen = new Set();
    for (const sc of screws) {
      if (!sc.alive || !sc.chainId || seen.has(sc.chainId)) continue;
      seen.add(sc.chainId);
      const group = screws.filter(s => s.alive && s.chainId === sc.chainId);
      if (group.length < 2) continue;
      for (let i = 0; i < group.length - 1; i++) {
        drawMetalChain(group[i].x, group[i].y, group[i + 1].x, group[i + 1].y);
      }
    }
    for (let i = chainDebris.length - 1; i >= 0; i--) {
      const d = chainDebris[i];
      d.vy += 0.38;
      d.x += d.vx; d.y += d.vy; d.rot += d.vr;
      d.life -= 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, d.life / 38));
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      drawChainLink(0, 0, d.face, d.scale || 1);
      ctx.restore();
      if (d.life <= 0 || d.y > H + 50) chainDebris.splice(i, 1);
    }
  }

  function drawMetalChain(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    // slight sag
    const sag = Math.min(22, dist * 0.14);
    const midX = (x1 + x2) / 2 + uy * Math.min(10, dist * 0.05);
    const midY = (y1 + y2) / 2 - ux * Math.min(10, dist * 0.05) + sag;
    const linkLen = 13;
    const n = Math.max(4, Math.round(dist / linkLen));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const omt = 1 - t;
      const px = omt * omt * x1 + 2 * omt * t * midX + t * t * x2;
      const py = omt * omt * y1 + 2 * omt * t * midY + t * t * y2;
      const tx = 2 * omt * (midX - x1) + 2 * t * (x2 - midX);
      const ty = 2 * omt * (midY - y1) + 2 * t * (y2 - midY);
      const ang = Math.atan2(ty, tx);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      drawChainLink(0, 0, i % 2 === 0, 1);
      ctx.restore();
    }
  }

  function drawChainLink(x, y, faceOn, scale) {
    const s = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (faceOn) {
      const lg = ctx.createLinearGradient(-7, -5, 7, 5);
      lg.addColorStop(0, '#eeebe4');
      lg.addColorStop(0.3, '#b0ada3');
      lg.addColorStop(0.65, '#6a675e');
      lg.addColorStop(1, '#c8c5bb');
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.2, 5.3, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 0, 4.3, 2.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = lg;
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(0,0,0,0.38)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.2, 5.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-3.1, -2.3, 2.3, 1.15, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(2.6, 1.9, 1.7, 0.85, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
    } else {
      const lg = ctx.createLinearGradient(0, -4.5, 0, 4.5);
      lg.addColorStop(0, '#ddd9d0');
      lg.addColorStop(0.4, '#8f8c82');
      lg.addColorStop(1, '#45433c');
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.3, 6.6, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 0, 1.25, 3.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = lg;
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(0,0,0,0.42)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.3, 6.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(-0.65, -4.6, 1.3, 2.6);
    }
    ctx.restore();
  }

  function spawnChainBreak(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
    const n = Math.max(5, Math.round(dist / 13));
    const sag = Math.min(18, dist * 0.12);
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2 + sag;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const omt = 1 - t;
      const px = omt * omt * x1 + 2 * omt * t * midX + t * t * x2;
      const py = omt * omt * y1 + 2 * omt * t * midY + t * t * y2;
      chainDebris.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 4.5,
        vy: -1.2 - Math.random() * 3.2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        life: 32 + Math.random() * 28,
        face: i % 2 === 0,
        scale: 0.85 + Math.random() * 0.25
      });
    }
  }

'''
GJ = GJ[:m2.start()] + new_chain + GJ[m2.end():]

# ---------- 3) chain break on removeScrew ----------
old_rm = """    sc.alive = false;
    removedKeys.add(sc.id);
    playSfx('screw', 0.7); buzz(16);"""
new_rm = """    // break metal chain visually + free remaining linked screws
    if (sc.chainId) {
      const mates = screws.filter(s => s.alive && s.id !== sc.id && s.chainId === sc.chainId);
      for (const m of mates) {
        spawnChainBreak(sc.x, sc.y, m.x, m.y);
        m.chainId = null;
      }
      sc.chainId = null;
    }
    sc.alive = false;
    removedKeys.add(sc.id);
    playSfx('screw', 0.7); buzz(16);"""
assert old_rm in GJ
GJ = GJ.replace(old_rm, new_rm, 1)

# ---------- 4) endWin → pending boss ----------
old_end = """    showScreen('win'); refreshHud();
  }
  function endLose() {"""
new_end = """    const lvlNum = levelIdx + 1;
    pendingBossAfterWin = (lvlNum % 5 === 0) && lvlNum >= 5;
    const bn = $('btn-next');
    if (bn) bn.textContent = pendingBossAfterWin ? '🧩 Мини-босс' : 'Дальше';
    showScreen('win'); refreshHud();
  }
  function endLose() {"""
assert old_end in GJ
GJ = GJ.replace(old_end, new_end, 1)

# ---------- 5) pointer handlers for boss ----------
old_ptr = """  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    onPointer(e.clientX - r.left, e.clientY - r.top);
  });"""
new_ptr = """  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (state === 'boss') { bossPointerDown(x, y, e.pointerId); return; }
    onPointer(x, y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (state !== 'boss' || !bossDrag) return;
    const r = canvas.getBoundingClientRect();
    bossPointerMove(e.clientX - r.left, e.clientY - r.top);
  });
  function bossPointerEnd(e) {
    if (state !== 'boss') return;
    const r = canvas.getBoundingClientRect();
    bossPointerUp(e.clientX - r.left, e.clientY - r.top);
  }
  canvas.addEventListener('pointerup', bossPointerEnd);
  canvas.addEventListener('pointercancel', bossPointerEnd);"""
assert old_ptr in GJ
GJ = GJ.replace(old_ptr, new_ptr, 1)

# ---------- 6) frame() boss branch + chain debris tick already in drawChains ----------
old_frame_home = """    if (state === 'home') {
      if (imgs.title_plaque) {
        const tw = Math.min(W - 36, 340), th = tw * 0.36;
        ctx.drawImage(imgs.title_plaque, (W - tw) / 2, 40, tw, th);
      }
      return;
    }

    if (state === 'play' || state === 'win' || state === 'lose') {"""
new_frame_home = """    if (state === 'home') {
      if (imgs.title_plaque) {
        const tw = Math.min(W - 36, 340), th = tw * 0.36;
        ctx.drawImage(imgs.title_plaque, (W - tw) / 2, 40, tw, th);
      }
      return;
    }

    if (state === 'boss') {
      drawBoss(dt);
      return;
    }

    if (state === 'play' || state === 'win' || state === 'lose') {"""
assert old_frame_home in GJ
GJ = GJ.replace(old_frame_home, new_frame_home, 1)

# ---------- 7) showScreen include boss (hide overlays) ----------
old_show = """  function showScreen(name) {
    state = name === 'play' ? 'play' : name;
    ['home', 'map', 'win', 'lose', 'settings', 'daily', 'tut'].forEach(s => {
      const el = $('sc-' + s); if (el) el.classList.toggle('on', s === name);
    });
    const playing = name === 'play';
    $('hud').style.display = playing ? 'block' : 'none';
    $('boosters').style.display = playing ? 'flex' : 'none';
    const hg = $('btn-home-settings');
    if (hg) hg.style.display = (name === 'home' || name === 'settings' || name === 'daily') ? 'block' : 'none';
  }"""
new_show = """  function showScreen(name) {
    state = name === 'play' ? 'play' : name;
    ['home', 'map', 'win', 'lose', 'settings', 'daily', 'tut'].forEach(s => {
      const el = $('sc-' + s); if (el) el.classList.toggle('on', s === name);
    });
    const playing = name === 'play';
    const bossing = name === 'boss';
    $('hud').style.display = (playing || bossing) ? 'block' : 'none';
    $('boosters').style.display = playing ? 'flex' : 'none';
    const hg = $('btn-home-settings');
    if (hg) hg.style.display = (name === 'home' || name === 'settings' || name === 'daily') ? 'block' : 'none';
    if (bossing) {
      const lp = $('lvl-pill');
      if (lp && boss) lp.textContent = '🧩 ' + (boss.title || 'Пазл');
    }
  }"""
assert old_show in GJ
GJ = GJ.replace(old_show, new_show, 1)

# ---------- 8) btn-next handler ----------
old_btn = "$('btn-next').onclick = () => startLevel(Math.min(levelIdx + 1, levels.length - 1));"
new_btn = """$('btn-next').onclick = () => {
      if (pendingBossAfterWin) {
        pendingBossAfterWin = false;
        const bn = $('btn-next'); if (bn) bn.textContent = 'Дальше';
        startBoss(Math.floor((levelIdx + 1) / 5) - 1);
        return;
      }
      startLevel(Math.min(levelIdx + 1, levels.length - 1));
    };"""
assert old_btn in GJ
GJ = GJ.replace(old_btn, new_btn, 1)

# ---------- 9) Append boss system before debug export / end ----------
# Find window.__VINTIKI or similar debug block
marker = "  // debug / QA hooks"
if marker not in GJ:
    # try alternate
    m_dbg = re.search(r'  window\.__VINTIKI\s*=', GJ)
    if m_dbg:
        insert_at = m_dbg.start()
    else:
        # before final closing of IIFE
        insert_at = GJ.rfind('})();')
        assert insert_at > 0
else:
    insert_at = GJ.find(marker)

boss_code = r'''
  /* ===== Mini-boss jigsaw (every 5th level) ===== */
  function bossGridFor(bossN) {
    // bossN 0-based: after L5, L10, ...
    if (bossN <= 1) return [3, 3];
    if (bossN === 2) return [3, 4];
    if (bossN <= 4) return [4, 4];
    return [4, 5];
  }

  function bossEdgeSeed(cols, rows, seed) {
    // edges[r][c] = {n,e,s,w} each -1|0|1 (tab out / flat / tab in)
    let s = (seed * 1103515245 + 12345) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s & 0xffff) / 0xffff; };
    const edges = [];
    for (let r = 0; r < rows; r++) {
      edges[r] = [];
      for (let c = 0; c < cols; c++) {
        const e = { n: 0, e: 0, s: 0, w: 0 };
        if (r === 0) e.n = 0; else e.n = -edges[r - 1][c].s;
        if (c === 0) e.w = 0; else e.w = -edges[r][c - 1].e;
        if (r < rows - 1) e.s = rnd() < 0.5 ? 1 : -1; else e.s = 0;
        if (c < cols - 1) e.e = rnd() < 0.5 ? 1 : -1; else e.e = 0;
        edges[r][c] = e;
      }
    }
    return edges;
  }

  function bossPiecePath(ctx, w, h, e, tab) {
    const t = tab || Math.min(w, h) * 0.22;
    const mid = (a, b) => (a + b) * 0.5;
    ctx.moveTo(0, 0);
    // north
    if (!e.n) { ctx.lineTo(w, 0); }
    else {
      const m = mid(0, w), sign = e.n;
      ctx.lineTo(m - t, 0);
      ctx.bezierCurveTo(m - t * 0.2, 0, m - t * 0.9, -sign * t, m, -sign * t);
      ctx.bezierCurveTo(m + t * 0.9, -sign * t, m + t * 0.2, 0, m + t, 0);
      ctx.lineTo(w, 0);
    }
    // east
    if (!e.e) { ctx.lineTo(w, h); }
    else {
      const m = mid(0, h), sign = e.e;
      ctx.lineTo(w, m - t);
      ctx.bezierCurveTo(w, m - t * 0.2, w + sign * t, m - t * 0.9, w + sign * t, m);
      ctx.bezierCurveTo(w + sign * t, m + t * 0.9, w, m + t * 0.2, w, m + t);
      ctx.lineTo(w, h);
    }
    // south
    if (!e.s) { ctx.lineTo(0, h); }
    else {
      const m = mid(0, w), sign = e.s;
      ctx.lineTo(m + t, h);
      ctx.bezierCurveTo(m + t * 0.2, h, m + t * 0.9, h + sign * t, m, h + sign * t);
      ctx.bezierCurveTo(m - t * 0.9, h + sign * t, m - t * 0.2, h, m - t, h);
      ctx.lineTo(0, h);
    }
    // west
    if (!e.w) { ctx.lineTo(0, 0); }
    else {
      const m = mid(0, h), sign = e.w;
      ctx.lineTo(0, m + t);
      ctx.bezierCurveTo(0, m + t * 0.2, -sign * t, m + t * 0.9, -sign * t, m);
      ctx.bezierCurveTo(-sign * t, m - t * 0.9, 0, m - t * 0.2, 0, m - t);
      ctx.lineTo(0, 0);
    }
    ctx.closePath();
  }

  function cutBossPiece(img, cols, rows, c, r, edges, pw, ph, tab) {
    const pad = Math.ceil(tab + 4);
    const cw = Math.ceil(pw + pad * 2);
    const ch = Math.ceil(ph + pad * 2);
    const off = document.createElement('canvas');
    off.width = cw; off.height = ch;
    const octx = off.getContext('2d');
    octx.save();
    octx.translate(pad, pad);
    octx.beginPath();
    bossPiecePath(octx, pw, ph, edges[r][c], tab);
    octx.clip();
    const sx = (c / cols) * img.width;
    const sy = (r / rows) * img.height;
    const sw = img.width / cols;
    const sh = img.height / rows;
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
    octx.restore();
    // outline
    octx.save();
    octx.translate(pad, pad);
    octx.beginPath();
    bossPiecePath(octx, pw, ph, edges[r][c], tab);
    octx.strokeStyle = 'rgba(255,255,255,0.55)';
    octx.lineWidth = 2;
    octx.stroke();
    octx.strokeStyle = 'rgba(0,0,0,0.35)';
    octx.lineWidth = 1;
    octx.stroke();
    octx.restore();
    return { canvas: off, pad, pw, ph };
  }

  function startBoss(bossN) {
    bossN = Math.max(0, bossN | 0);
    const [cols, rows] = bossGridFor(bossN);
    const title = BOSS_TITLES[bossN % BOSS_TITLES.length];
    const src = BOSS_IMGS[bossN % BOSS_IMGS.length];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const narrow = W < 420;
      const stripH = narrow ? Math.min(150, H * 0.22) : Math.min(130, H * 0.18);
      const topBar = 56;
      const boardPad = 12;
      const availW = W - boardPad * 2;
      const availH = H - topBar - stripH - 24;
      const side = Math.min(availW, availH);
      const bx = (W - side) / 2;
      const by = topBar + Math.max(8, (availH - side) / 2);
      const pw = side / cols;
      const ph = side / rows;
      const tab = Math.min(pw, ph) * 0.22;
      const edges = bossEdgeSeed(cols, rows, 9000 + bossN * 77 + (levelIdx | 0));
      const pieces = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cut = cutBossPiece(img, cols, rows, c, r, edges, pw, ph, tab);
          pieces.push({
            r, c, id: r + '_' + c,
            canvas: cut.canvas, pad: cut.pad, pw, ph,
            correctX: bx + c * pw,
            correctY: by + r * ph,
            x: 0, y: 0,
            placed: false,
            sparkle: 0
          });
        }
      }
      // shuffle into strip
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = pieces[i]; pieces[i] = pieces[j]; pieces[j] = t;
      }
      const slotW = Math.min(pw, ph) * 0.85 + tab;
      pieces.forEach((p, i) => {
        p.trayIndex = i;
        p.x = 16 + i * (slotW + 8);
        p.y = H - stripH + (stripH - slotW) / 2;
        p.drawW = slotW;
        p.drawH = slotW * (ph / pw);
      });
      boss = {
        n: bossN, title, img, cols, rows, edges, tab,
        board: { x: bx, y: by, w: side, h: side },
        strip: { y: H - stripH, h: stripH },
        pieces, scroll: 0, maxScroll: 0,
        startT: performance.now(),
        done: false, revealT: 0,
        rewardGiven: false,
        sparks: []
      };
      layoutBossTray();
      showScreen('boss');
      toast('Собери пазл: «' + title + '»');
    };
    img.onerror = () => {
      toast('Не удалось загрузить картинку босса');
      pendingBossAfterWin = false;
      startLevel(Math.min(levelIdx + 1, levels.length - 1));
    };
    img.src = src + '?v=' + VERSION;
  }

  function layoutBossTray() {
    if (!boss) return;
    const unplaced = boss.pieces.filter(p => !p.placed && (!bossDrag || bossDrag.piece !== p));
    const slot = Math.min(boss.board.w / boss.cols, boss.board.h / boss.rows) * 0.82;
    const gap = 10;
    const total = unplaced.length * (slot + gap) + 24;
    boss.maxScroll = Math.max(0, total - W);
    boss.scroll = Math.max(0, Math.min(boss.scroll, boss.maxScroll));
    unplaced.forEach((p, i) => {
      p.drawW = slot;
      p.drawH = slot * (p.ph / p.pw);
      p.x = 12 + i * (slot + gap) - boss.scroll;
      p.y = boss.strip.y + (boss.strip.h - p.drawH) / 2;
      p.inTray = true;
    });
  }

  function bossPointerDown(x, y, pid) {
    if (!boss || boss.done) {
      if (boss && boss.done && boss.revealT > 0.6) finishBoss();
      return;
    }
    // scroll strip drag start
    if (y >= boss.strip.y) {
      boss._scrollDrag = { x, scroll: boss.scroll, moved: false };
    }
    // topmost unplaced piece under pointer (prefer those not in strip if overlapping board)
    let hit = null;
    for (let i = boss.pieces.length - 1; i >= 0; i--) {
      const p = boss.pieces[i];
      if (p.placed) continue;
      const dw = p.inTray ? p.drawW : p.pw;
      const dh = p.inTray ? p.drawH : p.ph;
      if (x >= p.x && x <= p.x + dw && y >= p.y && y <= p.y + dh) { hit = p; break; }
    }
    if (!hit) return;
    // bring to end (top)
    const idx = boss.pieces.indexOf(hit);
    boss.pieces.splice(idx, 1);
    boss.pieces.push(hit);
    hit.inTray = false;
    const dw = hit.drawW || hit.pw;
    const dh = hit.drawH || hit.ph;
    bossDrag = {
      piece: hit, pid,
      ox: x - hit.x, oy: y - hit.y,
      fromTray: !!boss._scrollDrag
    };
    // scale up to full size while dragging
    hit.drawW = hit.pw;
    hit.drawH = hit.ph;
    hit.x = x - hit.pw / 2;
    hit.y = y - hit.ph / 2;
    bossDrag.ox = hit.pw / 2;
    bossDrag.oy = hit.ph / 2;
    playSfx('btn', 0.35);
  }

  function bossPointerMove(x, y) {
    if (!boss) return;
    if (boss._scrollDrag && !bossDrag) {
      const dx = boss._scrollDrag.x - x;
      if (Math.abs(dx) > 4) boss._scrollDrag.moved = true;
      boss.scroll = Math.max(0, Math.min(boss.maxScroll, boss._scrollDrag.scroll + dx));
      layoutBossTray();
      return;
    }
    if (!bossDrag) return;
    const p = bossDrag.piece;
    p.x = x - bossDrag.ox;
    p.y = y - bossDrag.oy;
  }

  function bossPointerUp(x, y) {
    if (!boss) return;
    if (boss._scrollDrag && !bossDrag) {
      boss._scrollDrag = null;
      return;
    }
    boss._scrollDrag = null;
    if (!bossDrag) return;
    const p = bossDrag.piece;
    bossDrag = null;
    const snap = Math.min(p.pw, p.ph) * 0.28;
    const dx = p.x - p.correctX;
    const dy = p.y - p.correctY;
    if (Math.hypot(dx, dy) <= snap) {
      p.x = p.correctX; p.y = p.correctY;
      p.placed = true; p.inTray = false;
      p.sparkle = 0.55;
      playSfx('box', 0.65); buzz(10);
      for (let i = 0; i < 10; i++) {
        boss.sparks.push({
          x: p.x + p.pw / 2, y: p.y + p.ph / 2,
          vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
          life: 0.45 + Math.random() * 0.25, t: 0
        });
      }
      if (boss.pieces.every(q => q.placed)) completeBoss();
    } else {
      // return to tray
      p.placed = false; p.inTray = true;
      playSfx('clunk', 0.4);
    }
    layoutBossTray();
  }

  function completeBoss() {
    if (!boss || boss.done) return;
    boss.done = true;
    boss.revealT = 0;
    playSfx('win', 0.75); buzz([18, 30, 18]);
    burstConfetti();
    const elapsed = (performance.now() - boss.startT) / 1000;
    const cells = boss.cols * boss.rows;
    // stars by time vs soft target
    const target = cells * 4.5;
    let stars = 1;
    if (elapsed <= target * 1.35) stars = 2;
    if (elapsed <= target * 0.85) stars = 3;
    const coins = 60 + boss.n * 15 + stars * 20;
    if (!boss.rewardGiven) {
      boss.rewardGiven = true;
      save.coins += coins;
      // store boss stars under key 'boss_'+n
      const key = 'boss_' + boss.n;
      const prev = save.stars[key] | 0;
      save.stars[key] = Math.max(prev, stars);
      persist();
      boss._reward = { stars, coins, elapsed };
    }
    toast('Пазл собран! 🎁');
  }

  function finishBoss() {
    boss = null; bossDrag = null;
    startLevel(Math.min(levelIdx + 1, levels.length - 1));
  }

  function drawBoss(dt) {
    if (!boss) return;
    // background
    ctx.fillStyle = '#2a180c';
    ctx.fillRect(0, 0, W, H);
    if (imgs.workshop_bg) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(imgs.workshop_bg, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // title
    ctx.fillStyle = '#fff6e0';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧩 Мини-босс: ' + boss.title, W / 2, 34);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,232,192,0.75)';
    ctx.fillText(boss.cols + '×' + boss.rows + ' · перетащи кусочки на картинку', W / 2, 52);

    const b = boss.board;
    // board frame
    ctx.fillStyle = 'rgba(40,22,10,0.85)';
    roundRect(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 14); ctx.fill();
    ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 3;
    roundRect(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 14); ctx.stroke();

    // faded template
    if (!boss.done) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.drawImage(boss.img, b.x, b.y, b.w, b.h);
      ctx.restore();
      // grid hint
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let c = 1; c < boss.cols; c++) {
        ctx.beginPath(); ctx.moveTo(b.x + c * (b.w / boss.cols), b.y);
        ctx.lineTo(b.x + c * (b.w / boss.cols), b.y + b.h); ctx.stroke();
      }
      for (let r = 1; r < boss.rows; r++) {
        ctx.beginPath(); ctx.moveTo(b.x, b.y + r * (b.h / boss.rows));
        ctx.lineTo(b.x + b.w, b.y + r * (b.h / boss.rows)); ctx.stroke();
      }
    }

    // placed pieces first
    for (const p of boss.pieces) {
      if (!p.placed) continue;
      ctx.drawImage(p.canvas, p.x - p.pad, p.y - p.pad);
      if (p.sparkle > 0) {
        p.sparkle -= dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.sparkle) * 1.2;
        ctx.strokeStyle = '#ffe566';
        ctx.lineWidth = 3;
        roundRect(ctx, p.x - 2, p.y - 2, p.pw + 4, p.ph + 4, 6); ctx.stroke();
        ctx.restore();
      }
    }

    // strip tray
    ctx.fillStyle = 'rgba(20,10,5,0.88)';
    ctx.fillRect(0, boss.strip.y - 4, W, boss.strip.h + 4);
    ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, boss.strip.y - 4); ctx.lineTo(W, boss.strip.y - 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,232,192,0.7)';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Кусочки ↓ (свайп)', 12, boss.strip.y + 12);

    // unplaced (not dragging last)
    for (const p of boss.pieces) {
      if (p.placed) continue;
      if (bossDrag && bossDrag.piece === p) continue;
      if (p.inTray) {
        ctx.drawImage(p.canvas, p.x - p.pad * (p.drawW / p.pw), p.y - p.pad * (p.drawH / p.ph),
          p.canvas.width * (p.drawW / p.pw), p.canvas.height * (p.drawH / p.ph));
      } else {
        ctx.drawImage(p.canvas, p.x - p.pad, p.y - p.pad);
      }
    }
    // dragging on top
    if (bossDrag) {
      const p = bossDrag.piece;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 12;
      ctx.drawImage(p.canvas, p.x - p.pad, p.y - p.pad);
      ctx.restore();
      // snap ghost
      const snap = Math.min(p.pw, p.ph) * 0.28;
      if (Math.hypot(p.x - p.correctX, p.y - p.correctY) <= snap * 1.6) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#9de06a';
        ctx.lineWidth = 3;
        roundRect(ctx, p.correctX, p.correctY, p.pw, p.ph, 4); ctx.stroke();
        ctx.restore();
      }
    }

    // sparks
    for (let i = boss.sparks.length - 1; i >= 0; i--) {
      const s = boss.sparks[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 180 * dt;
      const a = 1 - s.t / s.life;
      if (a <= 0) { boss.sparks.splice(i, 1); continue; }
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe566';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (boss.done) {
      boss.revealT += dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, boss.revealT * 1.2);
      ctx.drawImage(boss.img, b.x, b.y, b.w, b.h);
      ctx.restore();
      // reward card
      const rw = Math.min(320, W - 40), rh = 160;
      const rx = (W - rw) / 2, ry = H * 0.38;
      ctx.fillStyle = 'rgba(20,10,5,0.82)';
      roundRect(ctx, rx, ry, rw, rh, 18); ctx.fill();
      ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 3;
      roundRect(ctx, rx, ry, rw, rh, 18); ctx.stroke();
      const rew = boss._reward || { stars: 3, coins: 80 };
      ctx.fillStyle = '#fff6e0';
      ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Пазл собран! 🎁', W / 2, ry + 40);
      ctx.fillStyle = '#ffd76a';
      ctx.font = '28px sans-serif';
      ctx.fillText('★'.repeat(rew.stars) + '☆'.repeat(3 - rew.stars), W / 2, ry + 78);
      ctx.fillStyle = '#ffe8c0';
      ctx.font = '15px sans-serif';
      ctx.fillText('+' + rew.coins + ' монет · сундук!', W / 2, ry + 108);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,232,192,0.8)';
      ctx.fillText('Нажми, чтобы продолжить', W / 2, ry + 138);
    }
  }

'''

GJ = GJ[:insert_at] + boss_code + '\n' + GJ[insert_at:]

GJ_PATH.write_text(GJ)
print('game.js patched', 'startBoss' in GJ, 'drawMetalChain' in GJ, 'COLOR_RIM' in GJ)

# ---------- index.html ----------
HTML = HTML_PATH.read_text()
HTML = HTML.replace('>v3.7.0<', '>v3.8.0<')
HTML = HTML.replace('?v=3.7.0', '?v=3.8.0')
HTML = HTML.replace('matter.min.js?v=3.8.0', 'matter.min.js?v=3.8.0')  # noop if already
if '?v=3.8.0' not in HTML:
    HTML = HTML.replace('game.js"', 'game.js?v=3.8.0"')
HTML_PATH.write_text(HTML)
print('index.html', '3.8.0' in HTML)

# version.json
import json
vj = Path('/workspace/farm-3d/www/version.json')
data = json.loads(vj.read_text())
data['version'] = '3.8.0'
data['versionCode'] = 38000
data['webVersion'] = '3.8.0'
data['changelog'] = (
  '• v3.8.0: шляпки винтов крупнее + насыщенный цветной ободок (удобно для дальтоников)\\n'
  '• Реалистичная металлическая цепь с провисанием и разлётом звеньев\\n'
  '• Мини-босс-пазл после каждого 5-го уровня (3×3 → 4×5), кусочки сбоку, сборка по центру'
)
vj.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('version.json ok')
