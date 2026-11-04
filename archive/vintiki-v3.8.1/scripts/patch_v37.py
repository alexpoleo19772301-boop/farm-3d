#!/usr/bin/env python3
"""Patch farm-3d www to v3.7.0: daily, quests, stars, obstacles."""
from pathlib import Path
import re

ROOT = Path('/workspace/farm-3d')
GJ = (ROOT / 'www/game.js').read_text()
IX = (ROOT / 'www/index.html').read_text()

GJ = GJ.replace("/* Винтики v3.6.0 — 5 BGM tracks + sound settings */",
                "/* Винтики v3.7.0 — daily/quests/stars/obstacles */")
GJ = GJ.replace("const VERSION = '3.6.0';", "const VERSION = '3.7.0';")

# --- save defaults ---
old_defaults = """    const defaults = {
      unlocked: 1, coins: 0, stars: {}, muted: false,
      musicOn: true, musicVol: 0.40, sfxVol: 0.70, vibrateOn: true, trackId: 1,
      boosters: { slot: 2, hammer: 2, hint: 3 }
    };"""
new_defaults = """    const defaults = {
      unlocked: 1, coins: 0, stars: {}, muted: false,
      musicOn: true, musicVol: 0.40, sfxVol: 0.70, vibrateOn: true, trackId: 1,
      boosters: { slot: 2, hammer: 2, hint: 3 },
      daily: { lastClaim: null, streak: 0, lastQuestDay: null, quests: [] },
      seenTut: {},
      starChests: {},
      questBadge: false
    };"""
assert old_defaults in GJ
GJ = GJ.replace(old_defaults, new_defaults)

# migrate fields after raw assign
old_mig = """      if (raw.trackId == null) raw.trackId = 1;
      return raw;"""
new_mig = """      if (raw.trackId == null) raw.trackId = 1;
      if (!raw.daily) raw.daily = { lastClaim: null, streak: 0, lastQuestDay: null, quests: [] };
      if (!raw.seenTut) raw.seenTut = {};
      if (!raw.starChests) raw.starChests = {};
      if (raw.questBadge == null) raw.questBadge = false;
      // normalize stars values to 0..3 ints
      const ns = {};
      for (const k of Object.keys(raw.stars || {})) {
        const v = raw.stars[k];
        ns[k] = Math.max(0, Math.min(3, (typeof v === 'number' ? v : 3) | 0));
      }
      raw.stars = ns;
      return raw;"""
assert old_mig in GJ
GJ = GJ.replace(old_mig, new_mig)

# run-stats vars after settingsReturn
old_vars = """  let settingsReturn = 'home';
  let previewAudio = null;"""
new_vars = """  let settingsReturn = 'home';
  let previewAudio = null;
  let runUsedBooster = false, runUsedHint = false, runMoves = 0, runPar = 0;
  let runUnscrewed = 0, runPlanksBroken = 0;
  let bombHud = null; // {plankId, left}
  let pendingTut = null; // obstacle tutorial queue
  let starAnimT = 0;"""
assert old_vars in GJ
GJ = GJ.replace(old_vars, new_vars)

# Insert big feature block after persist()
FEATURE_BLOCK = r'''
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function yesterdayKey() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function totalStars() {
    let n = 0; for (const k of Object.keys(save.stars || {})) n += (save.stars[k] | 0); return n;
  }
  const DAILY_REWARDS = [
    { day: 1, coins: 50 },
    { day: 2, coins: 80 },
    { day: 3, coins: 120 },
    { day: 4, coins: 160 },
    { day: 5, coins: 220 },
    { day: 6, coins: 280 },
    { day: 7, coins: 400, boosters: { hint: 1, hammer: 1, slot: 1 } }
  ];
  const QUEST_POOL = [
    { type: 'pass_levels', label: 'Пройди {n} уровня', targets: [2, 3, 4], reward: [60, 90, 120] },
    { type: 'unscrew', label: 'Открути {n} винтов', targets: [30, 50, 70], reward: [50, 80, 110] },
    { type: 'break_planks', label: 'Разрушь {n} досок', targets: [12, 20, 28], reward: [50, 80, 110] },
    { type: 'win_no_boost', label: 'Победи {n} раз без бустеров', targets: [1, 2, 3], reward: [70, 100, 140] },
    { type: 'earn_stars', label: 'Собери {n} ★ за день', targets: [5, 8, 12], reward: [60, 100, 150] }
  ];
  const STAR_MILESTONES = [
    { at: 10, coins: 100, id: 'm10' },
    { at: 30, coins: 200, boosters: { hint: 1 }, id: 'm30' },
    { at: 60, coins: 350, boosters: { hammer: 1, hint: 1 }, id: 'm60' },
    { at: 90, coins: 500, boosters: { slot: 1, hammer: 1, hint: 1 }, id: 'm90' },
    { at: 120, coins: 800, boosters: { slot: 2, hammer: 1, hint: 2 }, id: 'm120' }
  ];
  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function ensureDailyQuests() {
    const day = todayKey();
    if (!save.daily) save.daily = { lastClaim: null, streak: 0, lastQuestDay: null, quests: [] };
    if (save.daily.lastQuestDay === day && Array.isArray(save.daily.quests) && save.daily.quests.length) return;
    const seed = parseInt(day.replace(/-/g, ''), 10) ^ 0x37A1;
    const rnd = mulberry32(seed);
    const pool = QUEST_POOL.slice();
    const picks = [];
    while (picks.length < 3 && pool.length) {
      const i = (rnd() * pool.length) | 0;
      const q = pool.splice(i, 1)[0];
      const ti = (rnd() * q.targets.length) | 0;
      picks.push({
        id: q.type + '_' + picks.length,
        type: q.type,
        target: q.targets[ti],
        progress: 0,
        reward: q.reward[ti],
        label: q.label.replace('{n}', String(q.targets[ti])),
        claimed: false
      });
    }
    save.daily.lastQuestDay = day;
    save.daily.quests = picks;
    save.questBadge = true;
    persist();
  }
  function questProgress(type, amount) {
    ensureDailyQuests();
    let changed = false;
    for (const q of save.daily.quests) {
      if (q.type !== type || q.claimed) continue;
      const before = q.progress | 0;
      q.progress = Math.min(q.target, before + (amount || 1));
      if (q.progress !== before) changed = true;
      if (q.progress >= q.target && !q.claimed) save.questBadge = true;
    }
    if (changed) persist();
    updateQuestBadge();
  }
  function claimQuest(id) {
    ensureDailyQuests();
    const q = save.daily.quests.find(x => x.id === id);
    if (!q || q.claimed || q.progress < q.target) return false;
    q.claimed = true;
    save.coins += q.reward;
    persist(); refreshHud(); renderQuests();
    toast('+' + q.reward + ' монет');
    return true;
  }
  function canClaimDaily() {
    if (!save.daily) return true;
    return save.daily.lastClaim !== todayKey();
  }
  function currentStreakPreview() {
    const d = save.daily || {};
    if (d.lastClaim === todayKey()) return d.streak | 0;
    if (d.lastClaim === yesterdayKey()) return (d.streak | 0);
    return 0;
  }
  function claimDaily() {
    if (!canClaimDaily()) { toast('Уже получено сегодня'); return null; }
    let streak = 0;
    if (save.daily.lastClaim === yesterdayKey()) streak = (save.daily.streak | 0);
    else streak = 0;
    streak = Math.min(7, streak + 1);
    const reward = DAILY_REWARDS[streak - 1];
    save.daily.lastClaim = todayKey();
    save.daily.streak = streak;
    save.coins += reward.coins;
    if (reward.boosters) {
      for (const k of Object.keys(reward.boosters)) {
        save.boosters[k] = (save.boosters[k] | 0) + reward.boosters[k];
      }
    }
    persist(); refreshHud();
    return { streak, reward };
  }
  function checkStarMilestones() {
    const ts = totalStars();
    const got = [];
    for (const m of STAR_MILESTONES) {
      if (ts >= m.at && !save.starChests[m.id]) {
        save.starChests[m.id] = true;
        save.coins += m.coins;
        if (m.boosters) {
          for (const k of Object.keys(m.boosters)) save.boosters[k] = (save.boosters[k] | 0) + m.boosters[k];
        }
        got.push(m);
      }
    }
    if (got.length) { persist(); refreshHud(); }
    return got;
  }
  function updateQuestBadge() {
    const el = $('badge-daily');
    if (!el) return;
    ensureDailyQuests();
    const claimable = canClaimDaily() || save.daily.quests.some(q => !q.claimed && q.progress >= q.target);
    el.style.display = claimable || save.questBadge ? 'flex' : 'none';
  }
  function openDaily() {
    ensureDailyQuests();
    settingsReturn = (state === 'play') ? 'play' : (state === 'map' ? 'map' : 'home');
    showScreen('daily');
    renderDaily();
    renderQuests();
    save.questBadge = false; persist(); updateQuestBadge();
  }
  function renderDaily() {
    const streak = save.daily.lastClaim === todayKey() ? (save.daily.streak | 0) : currentStreakPreview();
    const nextDay = save.daily.lastClaim === todayKey() ? streak : Math.min(7, streak + 1) || 1;
    const grid = $('daily-grid'); if (!grid) return;
    grid.innerHTML = '';
    for (const r of DAILY_REWARDS) {
      const cell = document.createElement('div');
      const claimed = (save.daily.streak | 0) >= r.day && save.daily.lastClaim;
      const isToday = r.day === (save.daily.lastClaim === todayKey() ? save.daily.streak : Math.min(7, currentStreakPreview() + 1) || 1);
      cell.className = 'daily-cell' + (r.day <= (save.daily.lastClaim === todayKey() ? save.daily.streak : 0) ? ' done' : '') + (isToday && canClaimDaily() ? ' today' : '');
      let gift = '🪙' + r.coins;
      if (r.boosters) gift = '🎁+' + r.coins;
      cell.innerHTML = '<div class="d-day">День ' + r.day + '</div><div class="d-gift">' + gift + '</div>';
      grid.appendChild(cell);
    }
    const st = $('daily-streak'); if (st) st.textContent = 'Серия: ' + (save.daily.lastClaim === todayKey() ? save.daily.streak : currentStreakPreview()) + ' / 7';
    const btn = $('btn-daily-claim');
    if (btn) {
      btn.disabled = !canClaimDaily();
      btn.textContent = canClaimDaily() ? 'Забрать награду' : 'Уже получено';
    }
  }
  function renderQuests() {
    ensureDailyQuests();
    const box = $('quest-list'); if (!box) return;
    box.innerHTML = '';
    for (const q of save.daily.quests) {
      const row = document.createElement('div');
      row.className = 'quest-row' + (q.claimed ? ' claimed' : '') + (q.progress >= q.target && !q.claimed ? ' ready' : '');
      const pct = Math.min(100, Math.round(100 * (q.progress || 0) / q.target));
      row.innerHTML = '<div class="q-label">' + q.label + '</div>'
        + '<div class="q-bar"><div class="q-fill" style="width:' + pct + '%"></div></div>'
        + '<div class="q-meta">' + (q.progress | 0) + ' / ' + q.target + ' · 🪙' + q.reward + '</div>';
      if (q.progress >= q.target && !q.claimed) {
        const b = document.createElement('button');
        b.className = 'btn green q-claim'; b.textContent = 'Забрать';
        b.onclick = () => claimQuest(q.id);
        row.appendChild(b);
      } else if (q.claimed) {
        const d = document.createElement('div'); d.className = 'q-done'; d.textContent = '✓'; row.appendChild(d);
      }
      box.appendChild(row);
    }
  }
  function showObstacleTut(kind) {
    if (save.seenTut[kind]) return;
    save.seenTut[kind] = true; persist();
    const info = {
      rusty: { title: 'Ржавый винт', body: 'Ржавые винты нужно нажать дважды, чтобы открутить.' },
      glass: { title: 'Стеклянная доска', body: 'Стеклянная доска разлетается на осколки — осторожно, это просто эффект!' },
      chain: { title: 'Цепь', body: 'Два винта связаны цепью. Оба должны быть свободны (без замка), прежде чем любой из них открутится.' },
      ice: { title: 'Лёд', body: 'Сначала разбей лёд одним нажатием, затем открути винт.' },
      bomb: { title: 'Доска-бомба', body: 'У этой доски ограниченное число ходов. Успей снять все её винты, пока таймер не истечёт!' }
    }[kind];
    if (!info) return;
    const t = $('tut-title'), b = $('tut-body'), sc = $('sc-tut');
    if (t) t.textContent = info.title;
    if (b) b.textContent = info.body;
    if (sc) { pendingTut = kind; showScreen('tut'); }
    else toast(info.title + ': ' + info.body);
  }
  function closeTut() {
    showScreen('play');
    pendingTut = null;
  }
  function applyObstacles(def, idx) {
    const L = idx + 1;
    const planks = (def.planks || []).map(p => Object.assign({}, p));
    const screws = (def.screws || []).map(s => Object.assign({}, s));
    const intro = [];
    // helper picks
    const freeScrews = () => screws.filter(s => !s.locked && !s.isKey && !s.rusty && !s.ice && !s.chainId);
    if (L >= 8) {
      const n = L >= 18 ? 2 : 1;
      const cand = freeScrews();
      for (let i = 0; i < n && cand.length; i++) {
        const s = cand.splice((i * 3) % cand.length, 1)[0];
        s.rusty = true; s.rustyHits = 0;
      }
      if (n) intro.push('rusty');
    }
    if (L >= 10) {
      // glass plank: prefer a plank with >=2 screws
      const ranked = planks.slice().sort((a, b) => {
        const sa = screws.filter(s => s.plankId === a.id).length;
        const sb = screws.filter(s => s.plankId === b.id).length;
        return sb - sa;
      });
      if (ranked.length >= 2) {
        ranked[0].material = 'glass';
        intro.push('glass');
      }
    }
    if (L >= 15) {
      const cand = freeScrews().filter(s => !s.rusty);
      if (cand.length >= 2) {
        const a = cand[0], b = cand[Math.min(cand.length - 1, 1 + (L % 3))];
        if (a && b && a.id !== b.id) {
          a.chainId = 'c' + L; b.chainId = 'c' + L;
          intro.push('chain');
        }
      }
    }
    if (L >= 20) {
      const cand = freeScrews().filter(s => !s.chainId);
      const n = L >= 30 ? 2 : 1;
      for (let i = 0; i < n && cand.length; i++) {
        const s = cand.splice((i * 5) % cand.length, 1)[0];
        s.ice = true; s.iceBroken = false;
      }
      if (n) intro.push('ice');
    }
    if (L >= 28) {
      // bomb: a plank that isn't glass if possible, with screws
      let target = planks.find(p => p.material !== 'glass') || planks[0];
      const scN = screws.filter(s => s.plankId === target.id).length;
      if (scN > 0) {
        target.bomb = true;
        target.bombMoves = Math.max(scN + 2, scN + 1 + ((L - 28) / 4 | 0));
        intro.push('bomb');
      }
    }
    return Object.assign({}, def, { planks, screws, _intro: intro });
  }
'''

marker = "  function persist() {\n    save.muted = !musicOn;"
assert marker in GJ
# Insert feature block BEFORE persist
GJ = GJ.replace(marker, FEATURE_BLOCK + "\n" + marker)

# Update persist to keep daily fields (already saving whole save object — good)
# persist already does localStorage.setItem(SAVE_KEY, JSON.stringify(save)) after assigning music fields
# Need to ensure daily fields aren't wiped — they live on save object. OK.

print('features inserted', 'ensureDailyQuests' in GJ)
(ROOT / 'www/game.js').write_text(GJ)
print('phase1 ok', len(GJ))
