/* Краски v4.0.6 — paint / water sort + i18n */
(function () {
  'use strict';
  const VERSION = '4.0.6';
  const APP_VERSION = { version: '4.0.6', versionCode: 40006, webVersion: '4.0.6' };
  const DEFAULT_MANIFEST_URL = localStorage.getItem('farm3d_manifest_url') ||
    'https://github.com/alexpoleo19772301-boop/farm-3d/releases/latest/download/version.json';
  const CAP = 4;
  const SAVE_KEY = 'vintiki_save_v40';
  const LEGACY_KEY = 'vintiki_save_v32';
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);
  let langPref = 'auto';
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const wrap = $('wrap');

  // Colour-blind friendly vivid paints (Okabe–Ito + extras)
  const PAINT = {
    red:    { fill: '#D55E00', gloss: '#FF8A3D', deep: '#8A3A00' },
    orange: { fill: '#E69F00', gloss: '#FFC94D', deep: '#8A5A00' },
    yellow: { fill: '#F0E442', gloss: '#FFF6A0', deep: '#A09010' },
    green:  { fill: '#009E73', gloss: '#3DD4A8', deep: '#00664A' },
    teal:   { fill: '#00A8A8', gloss: '#5CE0E0', deep: '#006666' },
    blue:   { fill: '#0072B2', gloss: '#3DA8E6', deep: '#004A75' },
    purple: { fill: '#CC79A7', gloss: '#E8A8C8', deep: '#7A4060' },
    pink:   { fill: '#E87AB0', gloss: '#FFB0D0', deep: '#8A4060' },
    brown:  { fill: '#8B5A2B', gloss: '#C4945A', deep: '#4A3010' },
    lime:   { fill: '#7DCF3A', gloss: '#B0F06A', deep: '#3A7010' },
    indigo: { fill: '#5B4BB2', gloss: '#9A8AE8', deep: '#2A2060' },
    coral:  { fill: '#FF6B6B', gloss: '#FFA0A0', deep: '#A03030' }
  };

  let W = 390, H = 844, dpr = 1;
  let state = 'home', levelIdx = 0, levels = [];
  let save = loadSave();
  let musicOn = save.musicOn !== false;
  let musicVol = Math.max(0, Math.min(1, +save.musicVol || 0.40));
  let sfxVol = Math.max(0, Math.min(1, save.sfxVol != null ? +save.sfxVol : 0.55));
  if (!save.sfxSoftened && (+save.sfxVol || 0) >= 0.55) { sfxVol = 0.38; save.sfxVol = 0.38; save.sfxSoftened = 1; }
  else if (!save.sfxSoftened) { save.sfxSoftened = 1; }
  // v4.0.4: earlier soft SFX were near-silent; bump default once if still at quiet 0.38
  if (!save.sfxBoost404 && Math.abs((+save.sfxVol || 0) - 0.38) < 0.001) {
    sfxVol = 0.55; save.sfxVol = 0.55; save.sfxBoost404 = 1;
  } else if (!save.sfxBoost404) { save.sfxBoost404 = 1; }
  let vibrateOn = save.vibrateOn !== false;
  let trackId = Math.max(1, Math.min(5, (save.trackId | 0) || 1));
  langPref = (save.langPref === 'ru' || save.langPref === 'uk' || save.langPref === 'en') ? save.langPref : 'auto';
  if (window.I18N) I18N.init(langPref);
  let pourSfxId = (save.pourSfxId == null ? 1 : (save.pourSfxId | 0)); // 0=off, 1..5
  if (pourSfxId < 0 || pourSfxId > 5) pourSfxId = 1;
  let settingsReturn = 'home';
  let previewAudio = null;
  let animT = 0;
  let selected = -1;
  let flasks = []; // runtime flask objects
  let moves = 0, runPar = 0, runUsedBooster = false, runUsedHint = false;
  let history = [];
  let pourAnim = null; // {from,to,color,amt,t,duration, streamY...}
  let particles = [];
  let confetti = [];
  let hintMove = null; // {from,to,t}
  let pendingBossAfterWin = false;
  let boss = null, bossDrag = null;
  let outcomeGen = 0;
  let audio = {}, bgmStarted = false, imgs = {};
  let levelPack = null;
  let tutPending = null;

  const BGM_TRACK_FILES = [
    { id: 1, file: 'assets/audio/bgm/track1.ogg', nameKey: 'track1', descKey: 'track1_d' },
    { id: 2, file: 'assets/audio/bgm/track2.ogg', nameKey: 'track2', descKey: 'track2_d' },
    { id: 3, file: 'assets/audio/bgm/track3.ogg', nameKey: 'track3', descKey: 'track3_d' },
    { id: 4, file: 'assets/audio/bgm/track4.ogg', nameKey: 'track4', descKey: 'track4_d' },
    { id: 5, file: 'assets/audio/bgm/track5.ogg', nameKey: 'track5', descKey: 'track5_d' }
  ];
  function getBgmTracks() {
    return BGM_TRACK_FILES.map(x => ({ id: x.id, file: x.file, name: t(x.nameKey), desc: t(x.descKey) }));
  }

  const POUR_OPTION_FILES = [
    { id: 0, nameKey: 'pour0', descKey: 'pour0_d', file: null },
    { id: 1, nameKey: 'pour1', descKey: 'pour1_d', file: 'assets/audio/sfx/sfx_pour_1.ogg' },
    { id: 2, nameKey: 'pour2', descKey: 'pour2_d', file: 'assets/audio/sfx/sfx_pour_2.ogg' },
    { id: 3, nameKey: 'pour3', descKey: 'pour3_d', file: 'assets/audio/sfx/sfx_pour_3.ogg' },
    { id: 4, nameKey: 'pour4', descKey: 'pour4_d', file: 'assets/audio/sfx/sfx_pour_4.ogg' },
    { id: 5, nameKey: 'pour5', descKey: 'pour5_d', file: 'assets/audio/sfx/sfx_pour_5.ogg' }
  ];
  function getPourOptions() {
    return POUR_OPTION_FILES.map(x => ({ id: x.id, name: t(x.nameKey), desc: t(x.descKey), file: x.file }));
  }

  const BOSS_IMGS = [
    'assets/boss/boss1_workshop.jpg','assets/boss/boss2_village.jpg','assets/boss/boss3_cat.jpg','assets/boss/boss4_landscape.jpg',
    'assets/boss/boss5_bakery.jpg','assets/boss/boss6_forest.jpg','assets/boss/boss7_beach.jpg','assets/boss/boss8_winter.jpg'
  ];
  const BOSS_TITLE_KEYS = ['boss0','boss1','boss2','boss3','boss4','boss5','boss6','boss7'];
  function bossTitleAt(i) {
    const n = BOSS_TITLE_KEYS.length;
    return t(BOSS_TITLE_KEYS[((i % n) + n) % n]);
  }

  function loadSave() {
    const defaults = {
      unlocked: 1, coins: 120, stars: {},
      musicOn: true, musicVol: 0.40, sfxVol: 0.55, vibrateOn: true, trackId: 1, pourSfxId: 1, langPref: 'auto',
      boosters: { undo: 5, flask: 2, hint: 3 },
      daily: { lastClaim: null, streak: 0, lastQuestDay: null, quests: [] },
      seenTut: {}, starChests: {}, questBadge: false
    };
    try {
      let raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw) {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (legacy) {
          raw = Object.assign({}, defaults, {
            coins: legacy.coins | 0,
            musicOn: legacy.musicOn !== false,
            musicVol: legacy.musicVol, sfxVol: legacy.sfxVol,
            vibrateOn: legacy.vibrateOn !== false, trackId: legacy.trackId || 1,
            daily: legacy.daily || defaults.daily
          });
        }
      }
      raw = Object.assign({}, defaults, raw || {});
      if (!raw.boosters) raw.boosters = defaults.boosters;
      if (raw.boosters.undo == null) raw.boosters.undo = 5;
      if (raw.boosters.flask == null) raw.boosters.flask = 2;
      if (raw.boosters.hint == null) raw.boosters.hint = 3;
      if (!raw.daily) raw.daily = defaults.daily;
      if (!raw.seenTut) raw.seenTut = {};
      if (!raw.stars) raw.stars = {};
      return raw;
    } catch (e) { return defaults; }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.style.display = 'none'; }, 2200);
  }
  function buzz(ms) {
    if (!vibrateOn) return;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
  }
  const sfxLog = [];
  const SFX_POOL = 6;
  let actx = null;
  const sfxBuf = {};       // name -> AudioBuffer
  const sfxPool = {};      // name -> HTMLAudioElement[]
  const sfxSrc = {};       // name -> url
  let audioUnlocked = false;

  function getActx() {
    if (actx) return actx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    } catch (e) { return null; }
    return actx;
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const ctx = getActx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Prime one silent HTMLAudio play for Android WebView autoplay policy
    try {
      const a = new Audio();
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
      a.volume = 0.01;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function playSfx(name, vol) {
    if (sfxVol <= 0.001) return;
    if (name === 'pour') {
      if (pourSfxId <= 0) return;
      name = 'pour_' + pourSfxId;
    }
    unlockAudio();
    const gain = Math.max(0, Math.min(1, (vol == null ? 1 : vol) * sfxVol));
    const srcUrl = sfxSrc[name] || (audio[name] && (audio[name].currentSrc || audio[name].src)) || '';
    sfxLog.push({ t: Date.now(), name, src: srcUrl, vol: gain });
    if (sfxLog.length > 60) sfxLog.shift();
    console.log('[sfx]', name, (srcUrl || '').split('/').slice(-2).join('/'), 'vol=' + gain.toFixed(2));

    // Prefer WebAudio decoded buffers (reliable overlapping plays on Android)
    const ctx = getActx();
    const buf = sfxBuf[name];
    if (ctx && buf) {
      try {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(g); g.connect(ctx.destination);
        src.start(0);
        return;
      } catch (e) {
        console.warn('[sfx] webaudio fail', name, e && e.message);
      }
    }

    // Fallback: pooled HTMLAudio elements (reuse, never clone)
    const pool = sfxPool[name];
    if (!pool || !pool.length) {
      sfxLog.push({ t: Date.now(), name, err: 'missing', src: null });
      console.warn('[sfx] missing', name);
      return;
    }
    try {
      let el = null;
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].paused || pool[i].ended || pool[i].currentTime === 0) { el = pool[i]; break; }
      }
      if (!el) el = pool[0]; // steal oldest if all busy
      try { el.pause(); el.currentTime = 0; } catch (e) {}
      el.volume = gain;
      const p = el.play();
      if (p && p.catch) p.catch((e) => console.warn('[sfx] play fail', name, e && e.message));
    } catch (e) {
      sfxLog.push({ t: Date.now(), name, err: String(e) });
    }
  }

  function loadAudio(name, src) {
    sfxSrc[name] = src;
    const pool = [];
    for (let i = 0; i < SFX_POOL; i++) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.setAttribute('data-sfx', name);
      a.setAttribute('playsinline', 'true');
      a.addEventListener('error', () => console.warn('[sfx] load error', name, src));
      try { a.load(); } catch (e) {}
      pool.push(a);
    }
    sfxPool[name] = pool;
    audio[name] = pool[0]; // back-compat for debug / old references
    // Decode into WebAudio buffer asynchronously
    fetch(src).then(r => r.arrayBuffer()).then(ab => {
      const ctx = getActx();
      if (!ctx) return;
      return ctx.decodeAudioData(ab.slice(0));
    }).then(buf => {
      if (buf) sfxBuf[name] = buf;
    }).catch(e => console.warn('[sfx] decode', name, e && e.message));
  }
  /* ---------- BGM singleton (exactly one playing source) ---------- */
  let bgmReq = 0;           // request token — stale play() ignored
  let bgmFadeTimer = null;
  const _bgmPool = new Set(); // track every HTMLAudioElement we ever used for BGM/preview

  function _killAudioEl(a) {
    if (!a) return;
    try { a.onplay = a.onplaying = a.onended = a.onerror = null; } catch (e) {}
    try { a.pause(); } catch (e) {}
    try { a.currentTime = 0; } catch (e) {}
    try { a.loop = false; } catch (e) {}
    try { a.volume = 0; } catch (e) {}
    try { a.removeAttribute('src'); a.src = ''; a.load(); } catch (e) {}
    _bgmPool.delete(a);
  }

  function stopPreview() {
    if (previewAudio) {
      _killAudioEl(previewAudio);
      previewAudio = null;
    }
  }

  function stopBgm() {
    if (bgmFadeTimer) { clearTimeout(bgmFadeTimer); bgmFadeTimer = null; }
    bgmReq++; // invalidate in-flight play()
    const a = audio.bgm;
    audio.bgm = null;
    bgmStarted = false;
    _killAudioEl(a);
    // safety: kill any leaked pool members still potentially audible
    for (const el of Array.from(_bgmPool)) {
      if (!el.paused) _killAudioEl(el);
      else _bgmPool.delete(el);
    }
  }

  function applyBgmVol() {
    const a = audio.bgm;
    if (!a) return;
    try { a.volume = musicOn ? musicVol : 0; } catch (e) {}
    if (!musicOn) {
      try { a.pause(); } catch (e) {}
      bgmStarted = false;
    }
  }

  /** Start or resume the single BGM element for current trackId. */
  function ensureBgm(forceRestart) {
    if (!musicOn) { stopBgm(); stopPreview(); return; }
    const tr = getBgmTracks().find(t => t.id === trackId) || getBgmTracks()[0];
    let a = audio.bgm;
    const needNew = forceRestart || !a || a._track !== trackId || !a.src;
    if (needNew) {
      // tear down previous completely before creating the next
      stopPreview();
      if (a) { audio.bgm = null; _killAudioEl(a); }
      const req = ++bgmReq;
      a = new Audio();
      a.preload = 'auto';
      a.loop = true;
      a._track = trackId;
      a._bgm = true;
      a.src = tr.file;
      a.volume = musicVol;
      _bgmPool.add(a);
      audio.bgm = a;
      const playP = a.play();
      if (playP && playP.then) {
        playP.then(() => {
          if (req !== bgmReq || audio.bgm !== a) {
            // stale — another switch happened
            _killAudioEl(a);
            return;
          }
          bgmStarted = true;
        }).catch(() => {
          if (req === bgmReq && audio.bgm === a) bgmStarted = false;
        });
      } else {
        bgmStarted = true;
      }
      return;
    }
    // same track — just ensure playing + volume
    a.volume = musicVol;
    if (a.paused) {
      const req = ++bgmReq;
      a.play().then(() => {
        if (req !== bgmReq || audio.bgm !== a) { _killAudioEl(a); return; }
        bgmStarted = true;
      }).catch(() => {});
    } else {
      bgmStarted = true;
    }
  }

  function setBgmTrack(id) {
    const next = Math.max(1, Math.min(5, id | 0));
    if (next === trackId && audio.bgm && !audio.bgm.paused && audio.bgm._track === next) {
      stopPreview();
      return;
    }
    trackId = next;
    save.trackId = trackId;
    persist();
    stopPreview();
    ensureBgm(true); // forceRestart → stop old, play new
  }

  function countPlayingBgm() {
    let n = 0;
    const seen = new Set();
    const consider = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      try {
        if (!el.paused && el.currentTime >= 0 && (el.src || el.currentSrc)) n++;
      } catch (e) {}
    };
    consider(audio.bgm);
    consider(previewAudio);
    for (const el of _bgmPool) consider(el);
    // also scan document for leaked looping audios pointing at bgm/
    try {
      document.querySelectorAll('audio').forEach((el) => {
        const src = el.currentSrc || el.src || '';
        if (src.indexOf('/bgm/') >= 0 || src.indexOf('assets/audio/bgm') >= 0) consider(el);
      });
    } catch (e) {}
    return n;
  }

  function totalStars() {
    let n = 0;
    for (const k of Object.keys(save.stars)) n += (save.stars[k] | 0);
    return n;
  }

  /* ---------- daily / quests ---------- */
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }
  function ensureQuests() {
    const day = todayKey();
    if (save.daily.lastQuestDay === day && save.daily.quests && save.daily.quests.length) return;
    const pool = [
      { id: 'pour', labelKey: 'q_pour', target: 20, progress: 0, reward: 40, claimed: false },
      { id: 'complete_flask', labelKey: 'q_complete_flask', target: 5, progress: 0, reward: 50, claimed: false },
      { id: 'pass_levels', labelKey: 'q_pass_levels', target: 3, progress: 0, reward: 60, claimed: false },
      { id: 'earn_stars', labelKey: 'q_earn_stars', target: 5, progress: 0, reward: 45, claimed: false },
      { id: 'win_no_boost', labelKey: 'q_win_no_boost', target: 1, progress: 0, reward: 55, claimed: false }
    ];
    const pick = [];
    const rng = (todayKey().split('').reduce((a,c)=>a+c.charCodeAt(0),0));
    const order = [0,1,2,3,4].sort((a,b) => ((a*17+rng)%5) - ((b*17+rng)%5));
    for (let i = 0; i < 3; i++) pick.push(Object.assign({}, pool[order[i]]));
    save.daily.lastQuestDay = day;
    save.daily.quests = pick;
    persist();
  }
  function questProgress(id, n) {
    ensureQuests();
    let changed = false;
    for (const q of save.daily.quests) {
      if (q.id === id && !q.claimed) {
        const before = q.progress;
        q.progress = Math.min(q.target, (q.progress | 0) + n);
        if (q.progress !== before) changed = true;
      }
    }
    if (changed) { save.questBadge = true; persist(); updateQuestBadge(); }
  }
  function updateQuestBadge() {
    ensureQuests();
    const ready = save.daily.quests.some(q => !q.claimed && q.progress >= q.target);
    const el = $('badge-daily');
    if (el) el.style.display = (ready || !save.daily.lastClaim || save.daily.lastClaim !== todayKey()) ? 'flex' : 'none';
  }
  const DAILY_GIFTS = [
    { coins: 30 }, { coins: 40 }, { undo: 1, coins: 20 }, { coins: 50 },
    { hint: 1, coins: 30 }, { flask: 1, coins: 40 }, { coins: 100, undo: 2, hint: 1 }
  ];
  function openDaily() {
    ensureQuests();
    showScreen('daily');
    renderDaily(); renderQuests();
  }
  function renderDaily() {
    const g = $('daily-grid'); if (!g) return;
    g.innerHTML = '';
    const streak = save.daily.streak | 0;
    const claimedToday = save.daily.lastClaim === todayKey();
    for (let i = 0; i < 7; i++) {
      const cell = document.createElement('div');
      cell.className = 'daily-cell' + (i < streak ? ' done' : '') + (i === Math.min(streak, 6) ? ' today' : '');
      const gift = DAILY_GIFTS[i];
      let label = '🪙' + gift.coins;
      if (gift.undo) label += ' ↩️';
      if (gift.hint) label += ' 💡';
      if (gift.flask) label += ' 🧪';
      cell.innerHTML = '<div class="d-day">' + t('day_n', { n: i+1 }) + '</div><div class="d-gift">' + label + '</div>';
      g.appendChild(cell);
    }
    const st = $('daily-streak'); if (st) st.textContent = t('streak', { n: streak }) + (claimedToday ? t('claimed_today_suffix') : '');
    const btn = $('btn-daily-claim');
    if (btn) { btn.disabled = claimedToday; btn.textContent = claimedToday ? t('claimed') : t('claim_reward'); }
  }
  function claimDaily() {
    if (save.daily.lastClaim === todayKey()) { toast(t('toast_claimed_today')); return; }
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); })();
    if (save.daily.lastClaim === yesterday) save.daily.streak = Math.min(7, (save.daily.streak|0) + 1);
    else save.daily.streak = 1;
    const gift = DAILY_GIFTS[Math.min(6, (save.daily.streak|0) - 1)];
    save.coins += gift.coins || 0; playSfx('coin', 0.4);
    if (gift.undo) save.boosters.undo += gift.undo;
    if (gift.hint) save.boosters.hint += gift.hint;
    if (gift.flask) save.boosters.flask += gift.flask;
    save.daily.lastClaim = todayKey();
    persist(); renderDaily(); refreshHud();
    toast(t('toast_reward'));
  }
  function renderQuests() {
    ensureQuests();
    const list = $('quest-list'); if (!list) return;
    list.innerHTML = '';
    for (const q of save.daily.quests) {
      const row = document.createElement('div');
      const ready = q.progress >= q.target;
      row.className = 'quest-row' + (q.claimed ? ' claimed' : (ready ? ' ready' : ''));
      const pct = Math.min(100, 100 * q.progress / q.target);
      row.innerHTML = '<div class="q-label">' + t(q.labelKey || '') + '</div>' +
        '<div class="q-bar"><div class="q-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="q-meta">' + q.progress + ' / ' + q.target + ' · 🪙' + q.reward + '</div>' +
        (q.claimed ? '<div class="q-done">✓</div>' :
          (ready ? '<button class="btn green q-claim" data-qid="' + q.id + '">' + t('claim') + '</button>' : ''));
      list.appendChild(row);
    }
    list.querySelectorAll('.q-claim').forEach(btn => {
      btn.onclick = () => {
        const q = save.daily.quests.find(x => x.id === btn.getAttribute('data-qid'));
        if (!q || q.claimed || q.progress < q.target) return;
        q.claimed = true; save.coins += q.reward; persist(); refreshHud(); renderQuests(); playSfx('coin', 0.4); toast(t('coins_plus', { n: q.reward }));
      };
    });
  }

  /* ---------- flask logic ---------- */
  function topRun(layers) {
    if (!layers.length) return { color: null, n: 0 };
    const color = layers[layers.length - 1].color;
    let n = 0;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].color !== color || layers[i].hidden) break;
      n++;
    }
    return { color, n };
  }
  function flaskComplete(f) {
    if (f.corked) return true;
    if (!f.layers.length) return false;
    if (f.layers.length !== CAP) return false;
    if (f.layers.some(l => l.hidden)) return false;
    const c = f.layers[0].color;
    return f.layers.every(l => l.color === c);
  }
  function canPour(src, dst) {
    if (!src || !dst || src === dst) return 0;
    if (src.frozen || src.locked || dst.frozen || dst.locked) return 0;
    if (src.corked || dst.corked) return 0;
    if (!src.layers.length) return 0;
    if (dst.layers.length >= CAP) return 0;
    // reveal check: top must not be hidden (hidden only below)
    const top = src.layers[src.layers.length - 1];
    if (top.hidden) return 0;
    const { color, n } = topRun(src.layers);
    if (!n) return 0;
    if (!dst.layers.length) return Math.min(n, CAP - dst.layers.length);
    const dt = dst.layers[dst.layers.length - 1];
    if (dt.hidden) return 0;
    if (dt.color !== color) return 0;
    return Math.min(n, CAP - dst.layers.length);
  }

  function cloneFlasks() {
    return flasks.map(f => ({
      layers: f.layers.map(l => ({ color: l.color, hidden: !!l.hidden })),
      frozen: !!f.frozen, locked: !!f.locked, corked: !!f.corked,
      lift: 0, wobble: 0
    }));
  }
  function pushHistory() {
    history.push({ flasks: cloneFlasks(), moves });
    if (history.length > 40) history.shift();
  }

  function revealExposed(f) {
    // topmost layer always visible; if it was hidden, reveal it when it becomes top
    if (!f.layers.length) return;
    const top = f.layers[f.layers.length - 1];
    if (top.hidden) {
      top.hidden = false;
      playSfx('hint', 0.35);
      toast(t('toast_hidden'));
    }
  }

  function tryCompleteFlask(f, idx) {
    if (f.corked) return;
    if (!flaskComplete(f)) return;
    f.corked = true;
    playSfx('cork', 0.5); playSfx('star', 0.28); buzz(18);
    spawnSparkles(flaskLayout(idx).cx, flaskLayout(idx).cy - 40);
    questProgress('complete_flask', 1);
    // unlock locked flasks when a colour is completed
    for (const o of flasks) {
      if (o.locked) { o.locked = false; toast(t('toast_unlock')); playSfx('box', 0.4); }
    }
  }

  function checkWin() {
    if (state !== 'play' || pourAnim) return;
    if (flasks.every(f => !f.layers.length || f.corked || flaskComplete(f))) {
      // cork any remaining complete
      flasks.forEach((f, i) => { if (!f.corked && flaskComplete(f)) tryCompleteFlask(f, i); });
      if (flasks.every(f => !f.layers.length || f.corked)) {
        const g = outcomeGen;
        setTimeout(() => { if (g === outcomeGen && state === 'play') endWin(); }, 500);
      }
    }
  }

  function startPour(fromIdx, toIdx) {
    const amt = canPour(flasks[fromIdx], flasks[toIdx]);
    if (amt <= 0) { playSfx('error', 0.35); return false; }
    pushHistory();
    const color = flasks[fromIdx].layers[flasks[fromIdx].layers.length - 1].color;
    pourAnim = {
      from: fromIdx, to: toIdx, color, amt,
      t: 0, duration: 0.55 + amt * 0.08,
      phase: 'tilt' // tilt -> stream -> settle
    };
    selected = -1;
    playSfx('pour', 0.78);
    buzz(10);
    return true;
  }

  function finishPour() {
    if (!pourAnim) return;
    const { from, to, amt } = pourAnim;
    const src = flasks[from], dst = flasks[to];
    for (let i = 0; i < amt; i++) {
      const layer = src.layers.pop();
      if (layer) dst.layers.push({ color: layer.color, hidden: false });
    }
    revealExposed(src);
    src.wobble = 1; dst.wobble = 1;
    moves++;
    questProgress('pour', 1);
    tryCompleteFlask(dst, to);
    pourAnim = null;
    $('moves-pill').textContent = t('moves', { n: moves });
    checkWin();
  }

  /* ---------- layout ---------- */
  function flaskLayout(i) {
    const n = flasks.length;
    const topY = 100;
    const bottomY = H - 110;
    const areaH = bottomY - topY;
    // rows
    let cols = n <= 5 ? n : (n <= 8 ? Math.ceil(n / 2) : (n <= 12 ? Math.ceil(n / 2) : Math.ceil(n / 3)));
    if (n <= 6) cols = Math.min(n, 6);
    if (n > 6 && n <= 10) cols = Math.ceil(n / 2);
    if (n > 10) cols = Math.ceil(n / 3);
    const rows = Math.ceil(n / cols);
    const cellW = Math.min(78, (W - 24) / cols);
    const cellH = Math.min(areaH / rows, 210);
    const flaskW = Math.min(52, cellW * 0.72);
    const flaskH = Math.min(160, cellH * 0.85);
    const row = (i / cols) | 0;
    const col = i % cols;
    const rowCount = Math.min(cols, n - row * cols);
    const rowWidth = rowCount * cellW;
    const x0 = (W - rowWidth) / 2;
    const y0 = topY + (areaH - rows * cellH) / 2;
    const cx = x0 + col * cellW + cellW / 2;
    const cy = y0 + row * cellH + cellH / 2 + 10;
    return { cx, cy, w: flaskW, h: flaskH, cellW, cellH };
  }

  function flaskAt(x, y) {
    for (let i = 0; i < flasks.length; i++) {
      const L = flaskLayout(i);
      const lift = (selected === i ? 18 : 0) + (flasks[i].lift || 0);
      if (Math.abs(x - L.cx) < L.w * 0.65 && Math.abs(y - (L.cy - lift)) < L.h * 0.6) return i;
    }
    return -1;
  }

  /* ---------- drawing ---------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  const BG_SET = [
    { file: 'assets/bg/bg_workshop.webp', from: 0, to: 14 },
    { file: 'assets/bg/bg_landscape.webp', from: 15, to: 34 },
    { file: 'assets/bg/bg_hills.webp', from: 35, to: 9999 }
  ];
  let bgParticles = [];
  function ensureBgParticles() {
    if (bgParticles.length) return;
    for (let i = 0; i < 28; i++) {
      bgParticles.push({
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 1.8,
        sp: 0.015 + Math.random() * 0.04,
        ph: Math.random() * Math.PI * 2,
        a: 0.15 + Math.random() * 0.35
      });
    }
  }
  function pickBgFile() {
    const idx = Math.max(0, levelIdx | 0);
    for (const b of BG_SET) if (idx >= b.from && idx <= b.to) return b.file;
    return BG_SET[0].file;
  }
  function drawCoverImage(img) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }
  function drawStudioBg() {
    ensureBgParticles();
    const key = pickBgFile();
    let img = imgs[key];
    if (!img) {
      img = new Image();
      img.src = key;
      imgs[key] = img;
    }
    const painted = drawCoverImage(img);
    if (!painted) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2048');
      g.addColorStop(0.45, '#2a1838');
      g.addColorStop(1, '#140a1c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Dim + slight blur feel via translucent overlays (keeps flask contrast high)
    ctx.fillStyle = 'rgba(18, 8, 28, 0.42)';
    ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.42, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(8,2,14,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    // soft shelf under flasks for readability
    ctx.fillStyle = 'rgba(40,22,30,0.55)';
    roundRect(ctx, 8, H - 98, W - 16, 22, 8); ctx.fill();
    // subtle floating sparkles
    for (const p of bgParticles) {
      p.ph += p.sp;
      const x = (p.x * W + Math.sin(p.ph) * 12 + W) % W;
      const y = (p.y * H + Math.cos(p.ph * 0.7) * 10 + H) % H;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,230,180,' + (p.a * (0.55 + 0.45 * Math.sin(p.ph))).toFixed(3) + ')';
      ctx.fill();
    }
  }

  function drawFlask(f, idx, dt) {
    const L = flaskLayout(idx);
    let lift = 0;
    if (selected === idx) lift = 18;
    if (f.lift) { f.lift *= 0.85; lift += f.lift; }
    if (f.wobble > 0) f.wobble = Math.max(0, f.wobble - dt * 2.2);

    let tilt = 0;
    if (pourAnim && pourAnim.from === idx) {
      const p = Math.min(1, pourAnim.t / 0.2);
      tilt = -0.55 * (p < 1 ? p : Math.max(0, 1 - (pourAnim.t - pourAnim.duration + 0.15) / 0.15));
    }

    const x = L.cx, y = L.cy - lift;
    const w = L.w, h = L.h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    if (f.wobble) ctx.rotate(Math.sin(animT * 20) * 0.04 * f.wobble);

    // shadow
    ctx.beginPath();
    ctx.ellipse(0, h * 0.48, w * 0.45, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    // glass body path (bottle)
    const neckW = w * 0.32, neckH = h * 0.16;
    const bodyTop = -h * 0.32, bodyBot = h * 0.42;
    ctx.beginPath();
    ctx.moveTo(-neckW, -h * 0.48);
    ctx.lineTo(neckW, -h * 0.48);
    ctx.lineTo(neckW, bodyTop);
    ctx.quadraticCurveTo(w * 0.48, bodyTop + 8, w * 0.48, bodyTop + 24);
    ctx.lineTo(w * 0.48, bodyBot - 10);
    ctx.quadraticCurveTo(w * 0.48, bodyBot, 0, bodyBot);
    ctx.quadraticCurveTo(-w * 0.48, bodyBot, -w * 0.48, bodyBot - 10);
    ctx.lineTo(-w * 0.48, bodyTop + 24);
    ctx.quadraticCurveTo(-w * 0.48, bodyTop + 8, -neckW, bodyTop);
    ctx.closePath();

    // glass fill
    const glass = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    glass.addColorStop(0, 'rgba(200,230,255,0.18)');
    glass.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    glass.addColorStop(1, 'rgba(160,200,240,0.22)');
    ctx.fillStyle = glass;
    ctx.fill();

    // clip liquids inside body
    ctx.save();
    ctx.clip();
    const layerH = (bodyBot - bodyTop - 6) / CAP;
    const baseY = bodyBot - 4;
    // during pour, visually reduce src / raise dst
    let visCount = f.layers.length;
    let pendingAdd = 0;
    if (pourAnim) {
      if (pourAnim.from === idx) {
        const prog = Math.min(1, Math.max(0, (pourAnim.t - 0.15) / (pourAnim.duration - 0.25)));
        visCount = f.layers.length - Math.floor(pourAnim.amt * prog);
      }
      if (pourAnim.to === idx) {
        const prog = Math.min(1, Math.max(0, (pourAnim.t - 0.15) / (pourAnim.duration - 0.25)));
        pendingAdd = Math.floor(pourAnim.amt * prog);
      }
    }
    for (let li = 0; li < visCount; li++) {
      const layer = f.layers[li];
      const y1 = baseY - (li + 1) * layerH;
      const wob = Math.sin(animT * 6 + idx + li) * 1.5 * (f.wobble || 0.15);
      if (layer.hidden) {
        ctx.fillStyle = 'rgba(40,30,50,0.85)';
        ctx.fillRect(-w * 0.44, y1, w * 0.88, layerH + 1);
        ctx.fillStyle = '#ffe8ff';
        ctx.font = 'bold ' + Math.max(12, layerH * 0.55) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, y1 + layerH / 2);
      } else {
        const pal = PAINT[layer.color] || PAINT.red;
        const lg = ctx.createLinearGradient(-w * 0.4, y1, w * 0.4, y1 + layerH);
        lg.addColorStop(0, pal.gloss);
        lg.addColorStop(0.45, pal.fill);
        lg.addColorStop(1, pal.deep);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(-w * 0.44, y1 + 2);
        ctx.lineTo(w * 0.44, y1 + 2);
        ctx.lineTo(w * 0.44, y1 + layerH + 1);
        ctx.quadraticCurveTo(0, y1 + layerH + 1 + wob, -w * 0.44, y1 + layerH + 1);
        ctx.closePath();
        ctx.fill();
        // meniscus highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(-w * 0.3, y1 + 2, w * 0.55, 2.5);
      }
    }
    // pouring-in preview layers
    if (pendingAdd > 0 && pourAnim) {
      const pal = PAINT[pourAnim.color] || PAINT.red;
      for (let k = 0; k < pendingAdd; k++) {
        const li = visCount + k; // visual index
        const y1 = baseY - (li + 1) * layerH;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pal.fill;
        ctx.fillRect(-w * 0.44, y1, w * 0.88, layerH + 1);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    // glass stroke + highlight
    ctx.beginPath();
    ctx.moveTo(-neckW, -h * 0.48);
    ctx.lineTo(neckW, -h * 0.48);
    ctx.lineTo(neckW, bodyTop);
    ctx.quadraticCurveTo(w * 0.48, bodyTop + 8, w * 0.48, bodyTop + 24);
    ctx.lineTo(w * 0.48, bodyBot - 10);
    ctx.quadraticCurveTo(w * 0.48, bodyBot, 0, bodyBot);
    ctx.quadraticCurveTo(-w * 0.48, bodyBot, -w * 0.48, bodyBot - 10);
    ctx.lineTo(-w * 0.48, bodyTop + 24);
    ctx.quadraticCurveTo(-w * 0.48, bodyTop + 8, -neckW, bodyTop);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(245,250,255,0.92)';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // refraction streak
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, bodyTop + 20);
    ctx.lineTo(-w * 0.30, bodyBot - 20);
    ctx.stroke();

    // cork
    if (f.corked) {
      ctx.fillStyle = '#8B5A2B';
      roundRect(ctx, -neckW - 2, -h * 0.52, neckW * 2 + 4, 14, 3); ctx.fill();
      ctx.fillStyle = '#C4945A';
      roundRect(ctx, -neckW + 2, -h * 0.50, neckW * 2 - 4, 6, 2); ctx.fill();
    }

    // frozen overlay
    if (f.frozen) {
      ctx.fillStyle = 'rgba(180,220,255,0.35)';
      roundRect(ctx, -w * 0.5, -h * 0.5, w, h, 10); ctx.fill();
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('❄️', 0, 0);
    }
    if (f.locked) {
      ctx.fillStyle = 'rgba(20,10,30,0.45)';
      roundRect(ctx, -w * 0.5, -h * 0.5, w, h, 10); ctx.fill();
      ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🔒', 0, 0);
    }

    // selection glow
    if (selected === idx) {
      ctx.strokeStyle = 'rgba(255,220,120,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    // hint highlight
    if (hintMove && (hintMove.from === idx || hintMove.to === idx)) {
      ctx.strokeStyle = 'rgba(120,255,160,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawPourStream() {
    if (!pourAnim) return;
    const a = pourAnim;
    if (a.t < 0.12 || a.t > a.duration - 0.12) return;
    const A = flaskLayout(a.from), B = flaskLayout(a.to);
    const pal = PAINT[a.color] || PAINT.red;
    const x1 = A.cx - 10, y1 = A.cy - A.h * 0.35;
    const x2 = B.cx, y2 = B.cy - B.h * 0.2;
    ctx.save();
    ctx.strokeStyle = pal.fill;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 30, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = pal.gloss;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  function spawnSparkles(x, y) {
    for (let i = 0; i < 14; i++) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140 - 40,
        life: 0.5 + Math.random() * 0.3, t: 0, color: '#ffe566'
      });
    }
  }
  function burstConfetti() {
    for (let i = 0; i < 40; i++) {
      confetti.push({
        x: W * Math.random(), y: -10, vx: (Math.random() - 0.5) * 80,
        vy: 60 + Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
        color: Object.values(PAINT)[i % 12].fill, life: 2
      });
    }
  }

  /* ---------- solver for hint ---------- */
  function solveHint() {
    // BFS shallow for next move
    const start = flasks.map(f => f.layers.filter(l => !l.hidden).map(l => l.color));
    // include hidden as blockers by treating hidden tops as unpourable — already filtered
    // rebuild with hidden: use actual colors but mark unpourable via separate flags
    const N = flasks.length;
    const frozen = flasks.map(f => !!(f.frozen || f.locked || f.corked));
    function norm(st) { return st.map(a => a.join(',')).join('|'); }
    function won(st) {
      return st.every(a => !a.length || (a.length === CAP && a.every(c => c === a[0])));
    }
    function topR(a) {
      if (!a.length) return [null, 0];
      const c = a[a.length - 1]; let n = 0;
      for (let i = a.length - 1; i >= 0; i--) { if (a[i] !== c) break; n++; }
      return [c, n];
    }
    function can(st, i, j) {
      if (frozen[i] || frozen[j]) return 0;
      if (!st[i].length || st[j].length >= CAP) return 0;
      const [c, n] = topR(st[i]);
      if (!st[j].length) return Math.min(n, CAP - st[j].length);
      if (st[j][st[j].length - 1] !== c) return 0;
      return Math.min(n, CAP - st[j].length);
    }
    function apply(st, i, j, amt) {
      const nf = st.map(a => a.slice());
      const moved = [];
      for (let k = 0; k < amt; k++) moved.push(nf[i].pop());
      for (let k = moved.length - 1; k >= 0; k--) nf[j].push(moved[k]);
      return nf;
    }
    const q = [[start, []]];
    const seen = new Set([norm(start)]);
    let guard = 0;
    while (q.length && guard++ < 50000) {
      const [st, path] = q.shift();
      if (won(st)) return path[0] || null;
      if (path.length > 25) continue;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const amt = can(st, i, j);
          if (!amt) continue;
          const ns = apply(st, i, j, amt);
          const key = norm(ns);
          if (seen.has(key)) continue;
          seen.add(key);
          q.push([ns, path.concat([{ from: i, to: j }])]);
        }
      }
    }
    // fallback: any legal move
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (canPour(flasks[i], flasks[j]) > 0) return { from: i, to: j };
    }
    return null;
  }

  /* ---------- levels / screens ---------- */
  function startLevel(idx) {
    outcomeGen++;
    levelIdx = idx;
    boss = null; bossDrag = null; pourAnim = null; selected = -1;
    hintMove = null; history = []; particles = [];
    moves = 0; runUsedBooster = false; runUsedHint = false;
    const def = levels[idx] || levels[0];
    runPar = def.par || 15;
    flasks = def.flasks.map((arr, fi) => {
      const hidden = (def.hidden && def.hidden[fi]) || [];
      return {
        layers: arr.map((c, li) => ({ color: c, hidden: !!hidden[li] })),
        frozen: !!(def.frozen && def.frozen[fi]),
        locked: !!(def.locked && def.locked[fi]),
        corked: false, lift: 0, wobble: 0
      };
    });
    // do not cork at start — levels are scrambled open
    state = 'play';
    showScreen('play');
    refreshHud();
    ensureBgm();
    // tutorials
    if (idx === 0 && !save.seenTut.basic) {
      showTut(t('tut_basic_t'), t('tut_basic_b'));
      save.seenTut.basic = 1; persist();
    } else if (def.hidden && !save.seenTut.hidden) {
      showTut(t('tut_hidden_t'), t('tut_hidden_b'));
      save.seenTut.hidden = 1; persist();
    } else if (def.frozen && !save.seenTut.frozen) {
      showTut(t('tut_frozen_t'), t('tut_frozen_b'));
      save.seenTut.frozen = 1; persist();
    } else if (def.locked && !save.seenTut.locked) {
      showTut(t('tut_locked_t'), t('tut_locked_b'));
      save.seenTut.locked = 1; persist();
    }
  }

  function showTut(title, body) {
    $('tut-title').textContent = title;
    $('tut-body').textContent = body;
    showScreen('tut');
  }

  function endWin() {
    if (state !== 'play') return;
    state = 'win'; playSfx('win', 0.55); buzz([20, 40, 20]); burstConfetti();
    let earned = 1;
    if (!runUsedBooster && !runUsedHint) earned = 2;
    if (earned === 2 && moves <= runPar) earned = 3;
    const prev = save.stars[levelIdx] | 0;
    const best = Math.max(prev, earned);
    const gained = Math.max(0, best - prev);
    save.stars[levelIdx] = best;
    const coins = 40 + levelIdx * 2 + earned * 10;
    save.coins += coins; playSfx('coin', 0.35);
    if (save.unlocked < levelIdx + 2) save.unlocked = levelIdx + 2;
    questProgress('pass_levels', 1);
    if (gained) questProgress('earn_stars', gained);
    if (!runUsedBooster && !runUsedHint) questProgress('win_no_boost', 1);
    persist();
    const starStr = '★'.repeat(earned) + '☆'.repeat(3 - earned);
    const ws = $('win-stars'); if (ws) { ws.textContent = starStr; ws.className = 'win-stars-anim'; }
    const wc = $('win-coins'); if (wc) wc.textContent = t('coins_win', { coins: coins, moves: moves, par: runPar });
    const wr = $('btn-win-replay'); if (wr) wr.style.display = (best < 3) ? 'inline-flex' : 'none';
    const lvlNum = levelIdx + 1;
    pendingBossAfterWin = (lvlNum % 5 === 0) && lvlNum >= 5;
    const bn = $('btn-next'); if (bn) bn.textContent = pendingBossAfterWin ? t('mini_boss') : t('next');
    showScreen('win'); refreshHud();
  }

  function showScreen(name) {
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
    if (bossing) { const lp = $('lvl-pill'); if (lp) lp.textContent = t('boss_pill'); }
  }
  function refreshHud() {
    $('lvl-pill').textContent = state === 'boss' ? t('boss_pill') : t('level', { n: levelIdx + 1 });
    $('coin-pill').textContent = '🪙 ' + (save.coins | 0);
    const sc = $('star-pill'); if (sc) sc.textContent = '★ ' + totalStars();
    const mp = $('moves-pill'); if (mp) mp.textContent = t('moves', { n: moves });
    $('badge-undo').textContent = save.boosters.undo;
    $('badge-flask').textContent = save.boosters.flask;
    $('badge-hint').textContent = save.boosters.hint;
    $('ver').textContent = 'v' + VERSION;
    updateQuestBadge();
  }

  function buildMap() {
    const g = $('mapgrid'); if (!g) return;
    g.innerHTML = '';
    const ms = $('map-stars'); if (ms) ms.textContent = '★ ' + totalStars();
    for (let i = 0; i < levels.length; i++) {
      const cell = document.createElement('div');
      const locked = i >= (save.unlocked | 0);
      cell.className = 'mapcell' + (locked ? ' lock' : '') + ((save.stars[i] | 0) > 0 ? ' done' : '');
      const st = save.stars[i] | 0;
      cell.innerHTML = '<div>' + (i + 1) + '</div><div class="stars">' + (locked ? '🔒' : ('★'.repeat(st) + '☆'.repeat(3 - st))) + '</div>';
      if (!locked) cell.onclick = () => startLevel(i);
      g.appendChild(cell);
    }
  }

  /* ---------- input ---------- */
  function onPointer(x, y) {
    if (state === 'boss') { bossPointerDown(x, y); return; }
    if (state !== 'play' || pourAnim) return;
    ensureBgm();
    const i = flaskAt(x, y);
    if (i < 0) { selected = -1; return; }
    const f = flasks[i];
    if (f.frozen) { toast(t('toast_ice')); playSfx('error', 0.35); return; }
    if (f.locked) { toast(t('toast_need_color')); playSfx('error', 0.35); return; }
    if (f.corked) { toast(t('toast_done')); return; }
    if (selected < 0) {
      if (!f.layers.length) { playSfx('error', 0.28); return; }
      selected = i; f.lift = 10; playSfx('tap', 0.45); buzz(8);
      return;
    }
    if (selected === i) { selected = -1; return; }
    if (!startPour(selected, i)) {
      // retarget selection
      if (f.layers.length) { selected = i; f.lift = 10; }
      else selected = -1;
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
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
  canvas.addEventListener('pointercancel', bossPointerEnd);

  /* ---------- boosters ---------- */
  function useUndo() {
    if (state !== 'play' || pourAnim) return;
    if (save.boosters.undo <= 0) { toast(t('toast_no_undo')); return; }
    if (!history.length) { toast(t('toast_nothing_undo')); return; }
    save.boosters.undo--; runUsedBooster = true; persist();
    const snap = history.pop();
    flasks = snap.flasks; moves = snap.moves; selected = -1;
    refreshHud(); playSfx('undo', 0.45); toast(t('toast_undo'));
  }
  function useExtraFlask() {
    if (state !== 'play' || pourAnim) return;
    if (save.boosters.flask <= 0) { toast(t('toast_no_flask')); return; }
    if (flasks.length >= 16) { toast(t('toast_too_many')); return; }
    save.boosters.flask--; runUsedBooster = true; persist();
    flasks.push({ layers: [], frozen: false, locked: false, corked: false, lift: 0, wobble: 0 });
    refreshHud(); playSfx('box', 0.4); toast(t('toast_flask_plus'));
  }
  function useHint() {
    if (state !== 'play' || pourAnim) return;
    if (save.boosters.hint <= 0) { toast(t('toast_no_hint')); return; }
    const mv = solveHint();
    if (!mv) { toast(t('toast_no_move')); return; }
    save.boosters.hint--; runUsedHint = true; persist();
    hintMove = { from: mv.from, to: mv.to, t: 2.5 };
    refreshHud(); playSfx('hint', 0.35); toast(t('toast_hint', { from: mv.from+1, to: mv.to+1 }));
  }

  /* ---------- boss (reuse simplified from v3.8) ---------- */
  function bossGridFor(n) {
    if (n <= 1) return [3, 3];
    if (n === 2) return [3, 4];
    if (n <= 4) return [4, 4];
    return [4, 5];
  }
  function bossEdgeSeed(cols, rows, seed) {
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
  function bossPiecePath(c, w, h, e, tab) {
    const t = tab || Math.min(w, h) * 0.22;
    const mid = (a, b) => (a + b) * 0.5;
    c.moveTo(0, 0);
    if (!e.n) c.lineTo(w, 0);
    else { const m = mid(0, w), s = e.n; c.lineTo(m - t, 0); c.bezierCurveTo(m - t * 0.2, 0, m - t * 0.9, -s * t, m, -s * t); c.bezierCurveTo(m + t * 0.9, -s * t, m + t * 0.2, 0, m + t, 0); c.lineTo(w, 0); }
    if (!e.e) c.lineTo(w, h);
    else { const m = mid(0, h), s = e.e; c.lineTo(w, m - t); c.bezierCurveTo(w, m - t * 0.2, w + s * t, m - t * 0.9, w + s * t, m); c.bezierCurveTo(w + s * t, m + t * 0.9, w, m + t * 0.2, w, m + t); c.lineTo(w, h); }
    if (!e.s) c.lineTo(0, h);
    else { const m = mid(0, w), s = e.s; c.lineTo(m + t, h); c.bezierCurveTo(m + t * 0.2, h, m + t * 0.9, h + s * t, m, h + s * t); c.bezierCurveTo(m - t * 0.9, h + s * t, m - t * 0.2, h, m - t, h); c.lineTo(0, h); }
    if (!e.w) c.lineTo(0, 0);
    else { const m = mid(0, h), s = e.w; c.lineTo(0, m + t); c.bezierCurveTo(0, m + t * 0.2, -s * t, m + t * 0.9, -s * t, m); c.bezierCurveTo(-s * t, m - t * 0.9, 0, m - t * 0.2, 0, m - t); c.lineTo(0, 0); }
    c.closePath();
  }
  function cutBossPiece(img, cols, rows, c, r, edges, pw, ph, tab) {
    const pad = Math.ceil(tab + 4);
    const off = document.createElement('canvas');
    off.width = Math.ceil(pw + pad * 2); off.height = Math.ceil(ph + pad * 2);
    const o = off.getContext('2d');
    o.save(); o.translate(pad, pad); o.beginPath(); bossPiecePath(o, pw, ph, edges[r][c], tab); o.clip();
    o.drawImage(img, (c / cols) * img.width, (r / rows) * img.height, img.width / cols, img.height / rows, 0, 0, pw, ph);
    o.restore();
    o.save(); o.translate(pad, pad); o.beginPath(); bossPiecePath(o, pw, ph, edges[r][c], tab);
    o.strokeStyle = 'rgba(255,255,255,0.55)'; o.lineWidth = 2; o.stroke(); o.restore();
    return { canvas: off, pad, pw, ph };
  }
  function startBoss(bossN) {
    bossN = Math.max(0, bossN | 0);
    const [cols, rows] = bossGridFor(bossN);
    const title = bossTitleAt(bossN % BOSS_TITLES.length);
    const img = new Image();
    img.onload = () => {
      const stripH = Math.min(140, H * 0.2);
      const topBar = Math.max(108, Math.round(H * 0.13));
      const side = Math.min(W - 24, H - topBar - stripH - 24);
      const bx = (W - side) / 2, by = topBar + 8;
      const pw = side / cols, ph = side / rows, tab = Math.min(pw, ph) * 0.22;
      const edges = bossEdgeSeed(cols, rows, 9000 + bossN * 77);
      const pieces = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cut = cutBossPiece(img, cols, rows, c, r, edges, pw, ph, tab);
        pieces.push({ r, c, id: r + '_' + c, canvas: cut.canvas, pad: cut.pad, pw, ph,
          correctX: bx + c * pw, correctY: by + r * ph, x: 0, y: 0, placed: false, sparkle: 0, inTray: true });
      }
      for (let i = pieces.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = pieces[i]; pieces[i] = pieces[j]; pieces[j] = t; }
      boss = { n: bossN, title, img, cols, rows, tab, board: { x: bx, y: by, w: side, h: side },
        strip: { y: H - stripH, h: stripH }, pieces, scroll: 0, maxScroll: 0, startT: performance.now(),
        done: false, revealT: 0, rewardGiven: false, sparks: [] };
      layoutBossTray(); showScreen('boss'); toast(t('toast_boss', { title: title }));
    };
    img.onerror = () => { toast(t('toast_no_boss_img')); startLevel(Math.min(levelIdx + 1, levels.length - 1)); };
    img.src = BOSS_IMGS[bossN % BOSS_IMGS.length] + '?v=' + VERSION;
  }
  function layoutBossTray() {
    if (!boss) return;
    const unplaced = boss.pieces.filter(p => !p.placed && (!bossDrag || bossDrag.piece !== p));
    const slot = Math.min(boss.board.w / boss.cols, boss.board.h / boss.rows) * 0.82;
    const gap = 10;
    boss.maxScroll = Math.max(0, unplaced.length * (slot + gap) + 24 - W);
    boss.scroll = Math.max(0, Math.min(boss.scroll, boss.maxScroll));
    unplaced.forEach((p, i) => {
      p.drawW = slot; p.drawH = slot * (p.ph / p.pw);
      p.x = 12 + i * (slot + gap) - boss.scroll;
      p.y = boss.strip.y + (boss.strip.h - p.drawH) / 2; p.inTray = true;
    });
  }
  function bossPointerDown(x, y) {
    if (!boss || boss.done) { if (boss && boss.done && boss.revealT > 0.6) finishBoss(); return; }
    if (y >= boss.strip.y) boss._scrollDrag = { x, scroll: boss.scroll };
    let hit = null;
    for (let i = boss.pieces.length - 1; i >= 0; i--) {
      const p = boss.pieces[i]; if (p.placed) continue;
      const dw = p.inTray ? p.drawW : p.pw, dh = p.inTray ? p.drawH : p.ph;
      if (x >= p.x && x <= p.x + dw && y >= p.y && y <= p.y + dh) { hit = p; break; }
    }
    if (!hit) return;
    boss.pieces.splice(boss.pieces.indexOf(hit), 1); boss.pieces.push(hit);
    hit.inTray = false; hit.drawW = hit.pw; hit.drawH = hit.ph;
    hit.x = x - hit.pw / 2; hit.y = y - hit.ph / 2;
    bossDrag = { piece: hit, ox: hit.pw / 2, oy: hit.ph / 2 };
    playSfx('btn', 0.28);
  }
  function bossPointerMove(x, y) {
    if (!boss) return;
    if (boss._scrollDrag && !bossDrag) {
      boss.scroll = Math.max(0, Math.min(boss.maxScroll, boss._scrollDrag.scroll + (boss._scrollDrag.x - x)));
      layoutBossTray(); return;
    }
    if (!bossDrag) return;
    bossDrag.piece.x = x - bossDrag.ox; bossDrag.piece.y = y - bossDrag.oy;
  }
  function bossPointerUp(x, y) {
    if (!boss) return;
    boss._scrollDrag = null;
    if (!bossDrag) return;
    const p = bossDrag.piece; bossDrag = null;
    const snap = Math.min(p.pw, p.ph) * 0.28;
    if (Math.hypot(p.x - p.correctX, p.y - p.correctY) <= snap) {
      p.x = p.correctX; p.y = p.correctY; p.placed = true; p.inTray = false; p.sparkle = 0.5;
      playSfx('reward', 0.45); buzz(10);
      if (boss.pieces.every(q => q.placed)) completeBoss();
    } else { p.placed = false; p.inTray = true; playSfx('error', 0.3); }
    layoutBossTray();
  }
  function completeBoss() {
    if (!boss || boss.done) return;
    boss.done = true; boss.revealT = 0;
    playSfx('win', 0.55); burstConfetti();
    const elapsed = (performance.now() - boss.startT) / 1000;
    const cells = boss.cols * boss.rows;
    let stars = 1; if (elapsed <= cells * 4.5 * 1.35) stars = 2; if (elapsed <= cells * 4.5 * 0.85) stars = 3;
    const coins = 60 + boss.n * 15 + stars * 20;
    if (!boss.rewardGiven) {
      boss.rewardGiven = true; save.coins += coins; playSfx('coin', 0.4);
      const key = 'boss_' + boss.n;
      save.stars[key] = Math.max(save.stars[key] | 0, stars); persist(); refreshHud();
      boss._reward = { stars, coins };
    }
    toast(t('toast_puzzle_done'));
  }
  function finishBoss() { boss = null; bossDrag = null; startLevel(Math.min(levelIdx + 1, levels.length - 1)); }
  function drawBoss(dt) {
    if (!boss) return;
    drawStudioBg();
    const titleY = 72;
    ctx.fillStyle = '#fff6ff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t('boss_title', { title: boss.title }), W / 2, titleY);
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,232,255,0.8)';
    ctx.fillText(t('boss_drag', { cols: boss.cols, rows: boss.rows }), W / 2, titleY + 20);
    ctx.textBaseline = 'alphabetic';
    const b = boss.board;
    ctx.fillStyle = 'rgba(40,20,50,0.85)'; roundRect(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 14); ctx.fill();
    ctx.strokeStyle = '#e8b8f0'; ctx.lineWidth = 3; roundRect(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 14); ctx.stroke();
    if (!boss.done) { ctx.save(); ctx.globalAlpha = 0.28; ctx.drawImage(boss.img, b.x, b.y, b.w, b.h); ctx.restore(); }
    for (const p of boss.pieces) {
      if (!p.placed) continue;
      ctx.drawImage(p.canvas, p.x - p.pad, p.y - p.pad);
      if (p.sparkle > 0) { p.sparkle -= dt; ctx.strokeStyle = '#ffe566'; ctx.lineWidth = 3; roundRect(ctx, p.x - 2, p.y - 2, p.pw + 4, p.ph + 4, 6); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(20,10,30,0.88)'; ctx.fillRect(0, boss.strip.y - 4, W, boss.strip.h + 4);
    ctx.strokeStyle = '#d89ae0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, boss.strip.y - 4); ctx.lineTo(W, boss.strip.y - 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,232,255,0.7)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(t('boss_pieces'), 12, boss.strip.y + 12);
    for (const p of boss.pieces) {
      if (p.placed || (bossDrag && bossDrag.piece === p)) continue;
      if (p.inTray) ctx.drawImage(p.canvas, p.x - p.pad * (p.drawW / p.pw), p.y - p.pad * (p.drawH / p.ph), p.canvas.width * (p.drawW / p.pw), p.canvas.height * (p.drawH / p.ph));
      else ctx.drawImage(p.canvas, p.x - p.pad, p.y - p.pad);
    }
    if (bossDrag) { const p = bossDrag.piece; ctx.drawImage(p.canvas, p.x - p.pad, p.y - p.pad); }
    if (boss.done) {
      boss.revealT += dt;
      ctx.save(); ctx.globalAlpha = Math.min(1, boss.revealT * 1.2); ctx.drawImage(boss.img, b.x, b.y, b.w, b.h); ctx.restore();
      const rw = Math.min(320, W - 40), rh = 150, rx = (W - rw) / 2, ry = H * 0.38;
      ctx.fillStyle = 'rgba(20,10,30,0.85)'; roundRect(ctx, rx, ry, rw, rh, 18); ctx.fill();
      ctx.strokeStyle = '#e8b8f0'; ctx.lineWidth = 3; roundRect(ctx, rx, ry, rw, rh, 18); ctx.stroke();
      const rew = boss._reward || { stars: 3, coins: 80 };
      ctx.fillStyle = '#fff6ff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(t('boss_done'), W / 2, ry + 40);
      ctx.fillStyle = '#ffd76a'; ctx.font = '28px sans-serif';
      ctx.fillText('★'.repeat(rew.stars) + '☆'.repeat(3 - rew.stars), W / 2, ry + 78);
      ctx.fillStyle = '#ffe8ff'; ctx.font = '15px sans-serif';
      ctx.fillText(t('coins_plus', { n: rew.coins }), W / 2, ry + 110);
      ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,232,255,0.8)';
      ctx.fillText(t('boss_tap'), W / 2, ry + 132);
    }
  }

  /* ---------- frame ---------- */
  function frame(dt) {
    animT += dt;
    ctx.clearRect(0, 0, W, H);
    if (state === 'home') {
      drawStudioBg();
      return;
    }
    if (state === 'boss') { drawBoss(dt); return; }
    if (state === 'play' || state === 'win' || state === 'lose') {
      drawStudioBg();
      if (pourAnim) {
        pourAnim.t += dt;
        if (pourAnim.t >= pourAnim.duration) finishPour();
      }
      if (hintMove) { hintMove.t -= dt; if (hintMove.t <= 0) hintMove = null; }
      for (let i = 0; i < flasks.length; i++) drawFlask(flasks[i], i, dt);
      drawPourStream();
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
        const a = 1 - p.t / p.life; if (a <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]; c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr;
        if (c.life <= 0 || c.y > H + 20) { confetti.splice(i, 1); continue; }
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.color; ctx.fillRect(-4, -2, 8, 4); ctx.restore();
      }
      if (state === 'play' && levelIdx === 0 && moves === 0 && selected < 0) {
        ctx.fillStyle = 'rgba(255,232,255,0.85)';
        ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(t('tip_pour'), W / 2, 88);
      }
    }
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt); requestAnimationFrame(loop);
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- settings / OTA ---------- */
  function openSettings() {
    settingsReturn = (state === 'play') ? 'play' : (state === 'map' ? 'map' : 'home');
    showScreen('settings'); renderSettings();
  }
  function closeSettings() {
    if (settingsReturn === 'play') showScreen('play');
    else if (settingsReturn === 'map') { showScreen('map'); buildMap(); }
    else showScreen('home');
    applyBgmVol(); persist();
  }

  function applyI18nDom() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = t(key);
      if (el.tagName === 'TITLE') { document.title = val; el.textContent = val; }
      else el.textContent = val;
    });
    if (window.I18N && I18N.fitAll) I18N.fitAll();
    refreshHud();
  }

  function setLanguagePref(pref) {
    langPref = (pref === 'ru' || pref === 'uk' || pref === 'en') ? pref : 'auto';
    save.langPref = langPref;
    persist();
    if (window.I18N) I18N.setPref(langPref);
    applyI18nDom();
    renderSettings();
    renderDaily();
    renderQuests();
  }

  function renderSettings() {
    const tm = $('tog-music'); if (tm) tm.checked = musicOn;
    const tv = $('tog-vib'); if (tv) tv.checked = vibrateOn;
    const sm = $('sl-music'); if (sm) sm.value = String(Math.round(musicVol * 100));
    const ss = $('sl-sfx'); if (ss) ss.value = String(Math.round(sfxVol * 100));
    const vm = $('val-music'); if (vm) vm.textContent = Math.round(musicVol * 100) + '%';
    const vs = $('val-sfx'); if (vs) vs.textContent = Math.round(sfxVol * 100) + '%';


    const llist = $('lang-list');
    if (llist) {
      llist.innerHTML = '';
      const opts = (window.I18N && I18N.LANG_OPTS) || [
        { id: 'auto', nameKey: 'lang_auto', descKey: 'lang_auto_desc' },
        { id: 'ru', nameKey: 'lang_ru' }, { id: 'uk', nameKey: 'lang_uk' }, { id: 'en', nameKey: 'lang_en' }
      ];
      for (const opt of opts) {
        const row = document.createElement('div');
        row.className = 'track-item' + (opt.id === langPref ? ' on' : '');
        const desc = opt.descKey ? ('<div class="td">' + t(opt.descKey) + '</div>') : '';
        row.innerHTML = '<div style="flex:1"><div class="tn">' + t(opt.nameKey) + '</div>' + desc + '</div>';
        row.onclick = () => setLanguagePref(opt.id);
        llist.appendChild(row);
      }
    }

    const plist = $('pour-list');
    if (plist) {
      plist.innerHTML = '';
      for (const opt of getPourOptions()) {
        const row = document.createElement('div');
        row.className = 'track-item' + (opt.id === pourSfxId ? ' on' : '');
        row.innerHTML = '<div style="flex:1"><div class="tn">' + opt.name + '</div><div class="td">' + opt.desc + '</div></div>' +
          (opt.file ? '<button type="button" class="preview" data-pour="' + opt.id + '">▶</button>' : '');
        row.onclick = (ev) => {
          const isPreview = !!(ev.target && ev.target.getAttribute && ev.target.getAttribute('data-pour') != null);
          pourSfxId = opt.id;
          save.pourSfxId = pourSfxId;
          persist();
          if (opt.file && (isPreview || true)) {
            // Always preview when selecting an audible option (and on ▶)
            playSfx('pour', 0.85);
          }
          renderSettings();
        };
        plist.appendChild(row);
      }
    }

    const list = $('track-list'); if (!list) return;
    list.innerHTML = '';
    for (const trk of getBgmTracks()) {
      const row = document.createElement('div');
      row.className = 'track-item' + (trk.id === trackId ? ' on' : '');
      row.innerHTML = '<div style="flex:1"><div class="tn">' + trk.name + '</div><div class="td">' + trk.desc + '</div></div><button class="preview" data-id="' + trk.id + '">▶</button>';
      row.onclick = (ev) => {
        if (ev.target.classList.contains('preview')) {
          // Preview uses the same singleton pipeline: stop everything, play this track once as preview
          stopBgm();
          stopPreview();
          const req = ++bgmReq;
          const a = new Audio();
          a.preload = 'auto';
          a.loop = false;
          a._track = trk.id;
          a.src = trk.file;
          a.volume = musicVol;
          _bgmPool.add(a);
          previewAudio = a;
          a.play().then(() => {
            if (req !== bgmReq || previewAudio !== a) _killAudioEl(a);
          }).catch(() => {});
          a.onended = () => { if (previewAudio === a) { previewAudio = null; _killAudioEl(a); } };
          return;
        }
        setBgmTrack(trk.id);
        renderSettings();
      };
      list.appendChild(row);
    }
  }
  function cmpSemver(a, b) {
    const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
    return 0;
  }
  function getAppUpdatePlugin() {
    try {
      const C = window.Capacitor;
      if (!C) return null;
      if (C.Plugins && C.Plugins.AppUpdate) return C.Plugins.AppUpdate;
      if (typeof C.registerPlugin === 'function') return C.registerPlugin('AppUpdate');
    } catch (e) {}
    return null;
  }
  function hardReloadTo(ver) {
    try {
      if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
    } catch (e) {}
    const u = new URL(location.href);
    u.searchParams.set('v', ver || VERSION);
    u.searchParams.set('t', String(Date.now()));
    location.replace(u.toString());
  }
  async function checkOta(silent) {
    const url = DEFAULT_MANIFEST_URL;
    try {
      let manifest;
      const plugin = getAppUpdatePlugin();
      // Prefer native fetch on Android (avoids CORS), else browser fetch of GitHub release manifest
      if (plugin && plugin.fetchManifest) {
        try {
          const ret = await plugin.fetchManifest({ url });
          manifest = ret.manifest || JSON.parse(ret.body);
        } catch (e) { /* fall through */ }
      }
      if (!manifest) {
        const r = await fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', mode: 'cors' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        manifest = await r.json();
      }
      let localWeb = APP_VERSION.webVersion || VERSION;
      let localCode = APP_VERSION.versionCode || 0;
      let localName = APP_VERSION.version || VERSION;
      if (plugin && plugin.getInfo) {
        try {
          const info = await plugin.getInfo();
          localWeb = info.webVersion || localWeb;
          localCode = info.versionCode || localCode;
          localName = info.versionName || localName;
        } catch (e) {}
      }
      const remoteWeb = manifest.webVersion || manifest.version;
      if (manifest.webBundleUrl && cmpSemver(remoteWeb, localWeb) > 0) {
        if (!silent) toast(t('toast_updating', { v: remoteWeb }));
        if (plugin && plugin.downloadAndApplyWebBundle) {
          await plugin.downloadAndApplyWebBundle({ url: manifest.webBundleUrl, webVersion: remoteWeb });
          location.reload();
          return { update: 'web' };
        }
        // Browser / Pages: hard reload so cache-busted assets load from Pages once deployed
        hardReloadTo(remoteWeb);
        return { update: 'web-reload' };
      }
      const remoteCode = parseInt(manifest.versionCode, 10) || 0;
      const needApk = (remoteCode > localCode) || (cmpSemver(manifest.version, localName) > 0);
      if (needApk && manifest.apkUrl) {
        if (!silent) {
          toast(t('toast_apk', { v: manifest.version }));
          if (plugin && plugin.downloadAndInstallApk) {
            try { await plugin.downloadAndInstallApk({ url: manifest.apkUrl }); } catch (e) { window.open(manifest.apkUrl, '_blank'); }
          } else {
            window.open(manifest.apkUrl, '_blank');
          }
        }
        return { update: 'apk' };
      }
      if (!silent) toast(t('toast_latest', { v: localWeb }));
      return { upToDate: true };
    } catch (e) {
      console.warn('OTA', e);
      if (!silent) toast(t('toast_offline'));
      return { error: String(e && e.message || e) };
    }
  }

  ['pointerdown','touchstart','mousedown','keydown'].forEach(ev => {
    document.addEventListener(ev, unlockAudio, { once: false, passive: true });
  });

  function wireUi() {
    $('btn-play').onclick = () => startLevel(Math.min((save.unlocked | 1) - 1, levels.length - 1));
    $('btn-home-map').onclick = () => { showScreen('map'); buildMap(); };
    $('btn-map').onclick = () => { showScreen('map'); buildMap(); };
    $('btn-map-back').onclick = () => showScreen('home');
    $('btn-next').onclick = () => {
      if (pendingBossAfterWin) {
        pendingBossAfterWin = false;
        const bn = $('btn-next'); if (bn) bn.textContent = t('next');
        startBoss(Math.floor((levelIdx + 1) / 5) - 1);
        return;
      }
      startLevel(Math.min(levelIdx + 1, levels.length - 1));
    };
    $('btn-win-replay').onclick = () => startLevel(levelIdx);
    $('btn-win-map').onclick = () => { showScreen('map'); buildMap(); };
    $('btn-retry').onclick = () => startLevel(levelIdx);
    $('btn-lose-map').onclick = () => { showScreen('map'); buildMap(); };
    $('btn-settings').onclick = openSettings;
    $('btn-home-settings').onclick = openSettings;
    $('btn-home-sound').onclick = openSettings;
    $('btn-settings-done').onclick = closeSettings;
    $('btn-update').onclick = () => checkOta(false);
    $('btn-home-update').onclick = () => checkOta(false);
    $('btn-home-daily').onclick = openDaily;
    $('btn-daily-back').onclick = () => showScreen('home');
    $('btn-daily-claim').onclick = claimDaily;
    $('btn-tut-ok').onclick = () => showScreen('play');
    $('b-undo').onclick = useUndo;
    $('b-flask').onclick = useExtraFlask;
    $('b-hint').onclick = useHint;
    const tm = $('tog-music'); if (tm) tm.onchange = () => { musicOn = tm.checked; save.musicOn = musicOn; persist(); if (musicOn) ensureBgm(true); else { stopBgm(); stopPreview(); } };
    const tv = $('tog-vib'); if (tv) tv.onchange = () => { vibrateOn = tv.checked; save.vibrateOn = vibrateOn; persist(); };
    const sm = $('sl-music'); if (sm) sm.oninput = () => { musicVol = (+sm.value || 0) / 100; save.musicVol = musicVol; $('val-music').textContent = Math.round(musicVol * 100) + '%'; applyBgmVol(); persist(); };
    const ss = $('sl-sfx'); if (ss) ss.oninput = () => { sfxVol = (+ss.value || 0) / 100; save.sfxVol = sfxVol; $('val-sfx').textContent = Math.round(sfxVol * 100) + '%'; persist(); };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // keep element but pause to avoid focus-stack duplicates on some WebViews
      try { if (audio.bgm && !audio.bgm.paused) audio.bgm.pause(); } catch (e) {}
      stopPreview();
    } else if (musicOn) {
      ensureBgm(false);
    }
  });

  async function boot() {
    resize(); window.addEventListener('resize', resize);
    // Soft CC0 / gentle SFX (v4.0.2) — ONLY assets/audio/sfx/*.ogg — see CREDITS.md
    const SFX = 'assets/audio/sfx/';
    loadAudio('btn', SFX + 'sfx_btn.ogg');
    loadAudio('tap', SFX + 'sfx_tap.ogg');
    loadAudio('pour', SFX + 'sfx_pour.ogg');
    for (let i = 1; i <= 5; i++) loadAudio('pour_' + i, SFX + 'sfx_pour_' + i + '.ogg');
    loadAudio('cork', SFX + 'sfx_cork.ogg');
    loadAudio('win', SFX + 'sfx_win.ogg');
    loadAudio('error', SFX + 'sfx_error.ogg');
    loadAudio('clunk', SFX + 'sfx_clunk.ogg'); // soft alias of error
    loadAudio('box', SFX + 'sfx_box.ogg');
    loadAudio('reward', SFX + 'sfx_reward.ogg');
    loadAudio('hint', SFX + 'sfx_hint.ogg');
    loadAudio('coin', SFX + 'sfx_coin.ogg');
    loadAudio('star', SFX + 'sfx_star.ogg');
    loadAudio('undo', SFX + 'sfx_undo.ogg');
    for (const b of BG_SET) {
      const im = new Image();
      im.src = b.file;
      imgs[b.file] = im;
    }
    try {
      const r = await fetch('assets/paint_levels.json?v=' + VERSION, { cache: 'no-store' });
      levelPack = await r.json();
      levels = levelPack.levels || [];
    } catch (e) {
      levels = [{ id: 1, par: 5, flasks: [['red','blue','red','blue'],['blue','red','blue','red'],['red','blue','red','blue'],[],[]] }];
    }
    wireUi();
    ensureQuests();
    applyI18nDom();
    refreshHud();
    showScreen('home');
    requestAnimationFrame(loop);
    setTimeout(() => checkOta(true), 1200);
    // debug API
    window.__V = {
      VERSION, startLevel, startBoss, getBoss: () => boss && ({ done: boss.done, total: boss.pieces.length, placed: boss.pieces.filter(p => p.placed).length }),
      placeBossN: (n) => { if (!boss) return 0; let k = 0; for (const p of boss.pieces) { if (p.placed) continue; p.x = p.correctX; p.y = p.correctY; p.placed = true; p.inTray = false; k++; if (k >= n) break; } layoutBossTray(); if (boss.pieces.every(q => q.placed)) completeBoss(); return k; },
      getState: () => ({ state, levelIdx, moves, selected, flasks: flasks.map(f => ({ n: f.layers.length, corked: f.corked, frozen: f.frozen, locked: f.locked, top: f.layers.length ? f.layers[f.layers.length-1].color : null })), pour: !!pourAnim }),
      pour: (i, j) => startPour(i, j),
      select: (i) => { selected = i; },
      tick: (sec) => { const steps = Math.ceil(sec / 0.016); for (let i = 0; i < steps; i++) { if (pourAnim) { pourAnim.t += 0.016; if (pourAnim.t >= pourAnim.duration) finishPour(); } animT += 0.016; } },
      solveHint, openDaily, openSettings, checkOta, sfxLog, audio, playSfx, sfxBuf, sfxPool, unlockAudio, getActx, getPourOptions, getBgmTracks, langPref: () => langPref, setLanguagePref, applyI18nDom, getPourSfxId: () => pourSfxId, setPourSfxId: (id) => { pourSfxId = Math.max(0, Math.min(5, id|0)); save.pourSfxId = pourSfxId; persist(); },
      ensureBgm, stopBgm, setBgmTrack, countPlayingBgm, stopPreview, getBgmTracks,
      autoSolve: (maxSteps) => {
        let steps = 0;
        while (steps++ < (maxSteps || 80) && state === 'play') {
          const mv = solveHint();
          if (!mv) break;
          startPour(mv.from, mv.to);
          window.__V.tick(0.8);
        }
        return window.__V.getState();
      }
    };
  }
  boot();
})();
