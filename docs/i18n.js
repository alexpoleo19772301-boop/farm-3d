/* Краски i18n — ru / uk / en */
(function (global) {
  'use strict';
  const DICT = {
    ru: {
      app_title: 'Краски',
      home_sub: 'Переливай · сортируй · освобождай колбы',
      home_blurb: 'Нажми колбу с краской, затем другую — перелей верхний цвет. Собери одинаковые цвета!',
      play: 'Играть',
      daily_btn: '🎁 Награды и задания',
      map_levels: 'Карта уровней',
      update: 'Обновить',
      sound_btn: '🎵 Звук',
      map: 'Карта',
      map_title: 'Карта',
      back: 'Назад',
      win_title: 'Победа! 🎉',
      next: 'Дальше',
      replay: 'Ещё раз ★',
      lose_title: 'Застряли?',
      lose_body: 'Попробуй отмену или добавь пустую колбу!',
      retry: 'Заново',
      settings_title: '🔊 Звук',
      music: 'Музыка',
      music_vol: 'Громкость музыки',
      sfx_vol: 'Громкость эффектов',
      vibrate: 'Вибрация',
      pour_section: 'Звук переливания',
      melody_section: 'Мелодия',
      language_section: 'Язык',
      done: 'Готово',
      daily_title: '🎁 Ежедневки',
      daily_quests: '📋 Задания дня',
      claim_reward: 'Забрать награду',
      claimed: 'Уже забрано',
      claimed_today_suffix: ' · сегодня забрано',
      streak: 'Серия: {n} / 7',
      day_n: 'День {n}',
      claim: 'Забрать',
      tut_ok: 'Понятно',
      undo: 'Отмена',
      flask: 'Колба',
      hint: 'Хинт',
      moves: 'ходы {n}',
      level: 'Ур. {n}',
      boss_pill: '🧩 Босс',
      mini_boss: '🧩 Мини-босс',
      coins_win: '+{coins} монет · ходы {moves}/{par}',
      coins_plus: '+{n} монет',
      lang_auto: 'Авто (устройство)',
      lang_ru: 'Русский',
      lang_uk: 'Українська',
      lang_en: 'English',
      lang_auto_desc: 'как в системе телефона',
      // tracks
      track1: 'Тихий рояль', track1_d: 'мягкое соло-фортепиано',
      track2: 'Закатные струны', track2_d: 'акустическая гитара',
      track3: 'Лёгкий ветер', track3_d: 'эмбиент',
      track4: 'Вечерняя комната', track4_d: 'спокойный фон',
      track5: 'Мягкий пульс', track5_d: 'минимал',
      // pour
      pour0: 'Выкл', pour0_d: 'без звука переливания',
      pour1: 'В стакан (бутылка)', pour1_d: 'пластиковая бутылка → стеклянный стакан',
      pour2: 'В стакан №2', pour2_d: 'другой дубль наполнения стакана',
      pour3: 'В кружку (мягко)', pour3_d: 'вода комнатной температуры в кружку',
      pour4: 'В кружку №2', pour4_d: 'ровная струя в кружку',
      pour5: 'Ручеёк', pour5_d: 'мягкий поток воды (OpenGameArt)',
      // boss titles
      boss0: 'Мастерская', boss1: 'Деревня', boss2: 'Котик', boss3: 'Пейзаж',
      boss4: 'Пекарня', boss5: 'Лес', boss6: 'Пляж', boss7: 'Зима',
      // quests
      q_pour: 'Перелей краску 20 раз',
      q_complete_flask: 'Собери 5 колб',
      q_pass_levels: 'Пройди 3 уровня',
      q_earn_stars: 'Заработай 5 ★',
      q_win_no_boost: 'Победи без бустеров',
      // tut
      tut_basic_t: 'Как играть',
      tut_basic_b: 'Нажми колбу с краской — она поднимется. Затем нажми другую колбу, чтобы перелить верхний цвет. Собери 4 одинаковых слоя!',
      tut_hidden_t: 'Скрытые слои',
      tut_hidden_b: 'Слои с «?» откроются, когда окажутся сверху. Планируй ходы!',
      tut_frozen_t: 'Лёд',
      tut_frozen_b: 'Замороженную колбу нельзя трогать. Обходи её!',
      tut_locked_t: 'Замок',
      tut_locked_b: 'Закрытая колба откроется, когда соберёшь любую полную колбу одного цвета.',
      // toasts
      toast_claimed_today: 'Уже забрано сегодня',
      toast_reward: 'Награда получена!',
      toast_hidden: 'Скрытый цвет открыт!',
      toast_unlock: 'Замок снят! 🔓',
      toast_ice: 'Колба во льду ❄️',
      toast_need_color: 'Сначала собери цвет 🔒',
      toast_done: 'Уже собрано!',
      toast_no_undo: 'Нет отмен',
      toast_nothing_undo: 'Нечего отменять',
      toast_undo: 'Отмена',
      toast_no_flask: 'Нет колб',
      toast_too_many: 'Слишком много колб',
      toast_flask_plus: 'Пустая колба +1',
      toast_no_hint: 'Нет подсказок',
      toast_no_move: 'Ход не найден',
      toast_hint: 'Подсказка: колба {from} → {to}',
      toast_boss: 'Собери пазл: «{title}»',
      toast_no_boss_img: 'Нет картинки босса',
      toast_puzzle_done: 'Пазл собран! 🎁',
      toast_updating: 'Обновление {v}…',
      toast_apk: 'Доступен APK {v}',
      toast_latest: 'У вас последняя версия {v}',
      toast_offline: 'Нет сети для обновления',
      // canvas
      tip_pour: 'Нажми колбу, затем другую — перелей краску',
      boss_title: 'Мини-босс: {title}',
      boss_drag: '{cols}×{rows} · перетащи кусочки',
      boss_pieces: 'Кусочки (свайп)',
      boss_done: 'Пазл собран! 🎁',
      boss_tap: 'Нажми, чтобы продолжить',
      gift_undo: '↩️ ×{n}',
      gift_flask: '🧪 ×{n}',
      gift_hint: '💡 ×{n}',
      gift_coins: '🪙 {n}'
    },
    uk: {
      app_title: 'Фарби',
      home_sub: 'Переливай · сортуй · звільняй колби',
      home_blurb: 'Натисни колбу з фарбою, потім іншу — перелий верхній колір. Збери однакові кольори!',
      play: 'Грати',
      daily_btn: '🎁 Нагороди та завдання',
      map_levels: 'Карта рівнів',
      update: 'Оновити',
      sound_btn: '🎵 Звук',
      map: 'Карта',
      map_title: 'Карта',
      back: 'Назад',
      win_title: 'Перемога! 🎉',
      next: 'Далі',
      replay: 'Ще раз ★',
      lose_title: 'Застрягли?',
      lose_body: 'Спробуй скасувати хід або додай порожню колбу!',
      retry: 'Заново',
      settings_title: '🔊 Звук',
      music: 'Музика',
      music_vol: 'Гучність музики',
      sfx_vol: 'Гучність ефектів',
      vibrate: 'Вібрація',
      pour_section: 'Звук переливання',
      melody_section: 'Мелодія',
      language_section: 'Мова',
      done: 'Готово',
      daily_title: '🎁 Щоденні',
      daily_quests: '📋 Завдання дня',
      claim_reward: 'Забрати нагороду',
      claimed: 'Вже отримано',
      claimed_today_suffix: ' · сьогодні отримано',
      streak: 'Серія: {n} / 7',
      day_n: 'День {n}',
      claim: 'Забрати',
      tut_ok: 'Зрозуміло',
      undo: 'Скасувати',
      flask: 'Колба',
      hint: 'Підказка',
      moves: 'ходи {n}',
      level: 'Рів. {n}',
      boss_pill: '🧩 Бос',
      mini_boss: '🧩 Міні-бос',
      coins_win: '+{coins} монет · ходи {moves}/{par}',
      coins_plus: '+{n} монет',
      lang_auto: 'Авто (пристрій)',
      lang_ru: 'Русский',
      lang_uk: 'Українська',
      lang_en: 'English',
      lang_auto_desc: 'як у системі телефону',
      track1: 'Тихий рояль', track1_d: 'м\'яке соло-фортепіано',
      track2: 'Закатні струни', track2_d: 'акустична гітара',
      track3: 'Легкий вітер', track3_d: 'ембієнт',
      track4: 'Вечірня кімната', track4_d: 'спокійний фон',
      track5: 'М\'який пульс', track5_d: 'мінімал',
      pour0: 'Вимк.', pour0_d: 'без звуку переливання',
      pour1: 'У склянку (пляшка)', pour1_d: 'пластикова пляшка → склянка',
      pour2: 'У склянку №2', pour2_d: 'інший дубль наповнення склянки',
      pour3: 'У чашку (м\'яко)', pour3_d: 'вода кімнатної температури в чашку',
      pour4: 'У чашку №2', pour4_d: 'рівний струмінь у чашку',
      pour5: 'Струмочок', pour5_d: 'м\'який потік води (OpenGameArt)',
      boss0: 'Майстерня', boss1: 'Село', boss2: 'Котик', boss3: 'Пейзаж',
      boss4: 'Пекарня', boss5: 'Ліс', boss6: 'Пляж', boss7: 'Зима',
      q_pour: 'Перелий фарбу 20 разів',
      q_complete_flask: 'Збери 5 колб',
      q_pass_levels: 'Пройди 3 рівні',
      q_earn_stars: 'Здобудь 5 ★',
      q_win_no_boost: 'Перемоги без бустерів',
      tut_basic_t: 'Як грати',
      tut_basic_b: 'Натисни колбу з фарбою — вона підніметься. Потім натисни іншу колбу, щоб перелити верхній колір. Збери 4 однакові шари!',
      tut_hidden_t: 'Приховані шари',
      tut_hidden_b: 'Шари з «?» відкриються, коли опиняться зверху. Плануй ходи!',
      tut_frozen_t: 'Крига',
      tut_frozen_b: 'Заморожену колбу не можна чіпати. Обходь її!',
      tut_locked_t: 'Замок',
      tut_locked_b: 'Закрита колба відкриється, коли збереш будь-яку повну колбу одного кольору.',
      toast_claimed_today: 'Вже отримано сьогодні',
      toast_reward: 'Нагороду отримано!',
      toast_hidden: 'Прихований колір відкрито!',
      toast_unlock: 'Замок знято! 🔓',
      toast_ice: 'Колба в кризі ❄️',
      toast_need_color: 'Спочатку збери колір 🔒',
      toast_done: 'Вже зібрано!',
      toast_no_undo: 'Немає скасувань',
      toast_nothing_undo: 'Нічого скасовувати',
      toast_undo: 'Скасовано',
      toast_no_flask: 'Немає колб',
      toast_too_many: 'Занадто багато колб',
      toast_flask_plus: 'Порожня колба +1',
      toast_no_hint: 'Немає підказок',
      toast_no_move: 'Хід не знайдено',
      toast_hint: 'Підказка: колба {from} → {to}',
      toast_boss: 'Збери пазл: «{title}»',
      toast_no_boss_img: 'Немає зображення боса',
      toast_puzzle_done: 'Пазл зібрано! 🎁',
      toast_updating: 'Оновлення {v}…',
      toast_apk: 'Доступний APK {v}',
      toast_latest: 'У вас остання версія {v}',
      toast_offline: 'Немає мережі для оновлення',
      tip_pour: 'Натисни колбу, потім іншу — перелий фарбу',
      boss_title: 'Міні-бос: {title}',
      boss_drag: '{cols}×{rows} · перетягни шматочки',
      boss_pieces: 'Шматочки (свайп)',
      boss_done: 'Пазл зібрано! 🎁',
      boss_tap: 'Натисни, щоб продовжити',
      gift_undo: '↩️ ×{n}',
      gift_flask: '🧪 ×{n}',
      gift_hint: '💡 ×{n}',
      gift_coins: '🪙 {n}'
    },
    en: {
      app_title: 'Paints',
      home_sub: 'Pour · sort · free the flasks',
      home_blurb: 'Tap a paint flask, then another — pour the top color. Match identical colors!',
      play: 'Play',
      daily_btn: '🎁 Rewards & quests',
      map_levels: 'Level map',
      update: 'Update',
      sound_btn: '🎵 Sound',
      map: 'Map',
      map_title: 'Map',
      back: 'Back',
      win_title: 'You win! 🎉',
      next: 'Next',
      replay: 'Again ★',
      lose_title: 'Stuck?',
      lose_body: 'Try undo or add an empty flask!',
      retry: 'Retry',
      settings_title: '🔊 Sound',
      music: 'Music',
      music_vol: 'Music volume',
      sfx_vol: 'SFX volume',
      vibrate: 'Vibration',
      pour_section: 'Pour sound',
      melody_section: 'Melody',
      language_section: 'Language',
      done: 'Done',
      daily_title: '🎁 Daily',
      daily_quests: '📋 Daily quests',
      claim_reward: 'Claim reward',
      claimed: 'Claimed',
      claimed_today_suffix: ' · claimed today',
      streak: 'Streak: {n} / 7',
      day_n: 'Day {n}',
      claim: 'Claim',
      tut_ok: 'Got it',
      undo: 'Undo',
      flask: 'Flask',
      hint: 'Hint',
      moves: 'moves {n}',
      level: 'Lv. {n}',
      boss_pill: '🧩 Boss',
      mini_boss: '🧩 Mini-boss',
      coins_win: '+{coins} coins · moves {moves}/{par}',
      coins_plus: '+{n} coins',
      lang_auto: 'Auto (device)',
      lang_ru: 'Русский',
      lang_uk: 'Українська',
      lang_en: 'English',
      lang_auto_desc: 'follow phone language',
      track1: 'Quiet piano', track1_d: 'soft solo piano',
      track2: 'Sunset strings', track2_d: 'acoustic guitar',
      track3: 'Light breeze', track3_d: 'ambient',
      track4: 'Evening room', track4_d: 'calm backdrop',
      track5: 'Soft pulse', track5_d: 'minimal',
      pour0: 'Off', pour0_d: 'no pour sound',
      pour1: 'Into a glass (bottle)', pour1_d: 'plastic bottle → glass',
      pour2: 'Into a glass #2', pour2_d: 'another glass-fill take',
      pour3: 'Into a mug (soft)', pour3_d: 'room-temp water into a mug',
      pour4: 'Into a mug #2', pour4_d: 'steady stream into a mug',
      pour5: 'Brook', pour5_d: 'soft water flow (OpenGameArt)',
      boss0: 'Workshop', boss1: 'Village', boss2: 'Kitty', boss3: 'Landscape',
      boss4: 'Bakery', boss5: 'Forest', boss6: 'Beach', boss7: 'Winter',
      q_pour: 'Pour paint 20 times',
      q_complete_flask: 'Complete 5 flasks',
      q_pass_levels: 'Clear 3 levels',
      q_earn_stars: 'Earn 5 ★',
      q_win_no_boost: 'Win without boosters',
      tut_basic_t: 'How to play',
      tut_basic_b: 'Tap a paint flask — it lifts. Then tap another flask to pour the top color. Collect 4 matching layers!',
      tut_hidden_t: 'Hidden layers',
      tut_hidden_b: 'Layers with «?» reveal when they reach the top. Plan your moves!',
      tut_frozen_t: 'Ice',
      tut_frozen_b: 'A frozen flask can’t be touched. Work around it!',
      tut_locked_t: 'Lock',
      tut_locked_b: 'A locked flask opens when you complete any full same-color flask.',
      toast_claimed_today: 'Already claimed today',
      toast_reward: 'Reward claimed!',
      toast_hidden: 'Hidden color revealed!',
      toast_unlock: 'Lock removed! 🔓',
      toast_ice: 'Flask is frozen ❄️',
      toast_need_color: 'Complete a color first 🔒',
      toast_done: 'Already done!',
      toast_no_undo: 'No undos left',
      toast_nothing_undo: 'Nothing to undo',
      toast_undo: 'Undone',
      toast_no_flask: 'No flasks left',
      toast_too_many: 'Too many flasks',
      toast_flask_plus: 'Empty flask +1',
      toast_no_hint: 'No hints left',
      toast_no_move: 'No move found',
      toast_hint: 'Hint: flask {from} → {to}',
      toast_boss: 'Solve the puzzle: “{title}”',
      toast_no_boss_img: 'Boss image missing',
      toast_puzzle_done: 'Puzzle complete! 🎁',
      toast_updating: 'Updating {v}…',
      toast_apk: 'APK {v} available',
      toast_latest: 'You’re on the latest {v}',
      toast_offline: 'No network for update',
      tip_pour: 'Tap a flask, then another — pour the paint',
      boss_title: 'Mini-boss: {title}',
      boss_drag: '{cols}×{rows} · drag the pieces',
      boss_pieces: 'Pieces (swipe)',
      boss_done: 'Puzzle complete! 🎁',
      boss_tap: 'Tap to continue',
      gift_undo: '↩️ ×{n}',
      gift_flask: '🧪 ×{n}',
      gift_hint: '💡 ×{n}',
      gift_coins: '🪙 {n}'
    }
  };

  const LANG_OPTS = [
    { id: 'auto', nameKey: 'lang_auto', descKey: 'lang_auto_desc' },
    { id: 'ru', nameKey: 'lang_ru', descKey: null },
    { id: 'uk', nameKey: 'lang_uk', descKey: null },
    { id: 'en', nameKey: 'lang_en', descKey: null }
  ];

  function detectFromNavigator() {
    const list = [];
    try {
      if (navigator.languages && navigator.languages.length) list.push(...navigator.languages);
      if (navigator.language) list.push(navigator.language);
    } catch (e) {}
    for (const raw of list) {
      const l = String(raw || '').toLowerCase();
      if (l.startsWith('uk')) return 'uk';
      if (l.startsWith('ru') || l.startsWith('be') || l.startsWith('kk')) return 'ru';
    }
    return 'en';
  }

  function resolve(pref) {
    if (pref && pref !== 'auto' && DICT[pref]) return pref;
    return detectFromNavigator();
  }

  const I18N = {
    dict: DICT,
    pref: 'auto',
    lang: 'en',
    t(key, vars) {
      const pack = DICT[this.lang] || DICT.en;
      let s = (pack && pack[key] != null) ? pack[key] : ((DICT.en && DICT.en[key]) || key);
      if (vars) {
        for (const k of Object.keys(vars)) {
          s = String(s).split('{' + k + '}').join(String(vars[k]));
        }
      }
      return s;
    },
    setPref(pref) {
      this.pref = (pref === 'ru' || pref === 'uk' || pref === 'en') ? pref : 'auto';
      this.lang = resolve(this.pref);
      try { document.documentElement.lang = this.lang; } catch (e) {}
      return this.lang;
    },
    init(savedPref) {
      this.setPref(savedPref || 'auto');
      return this.lang;
    },
    LANG_OPTS,
    fitText(el, maxPx, minPx) {
      if (!el) return;
      maxPx = maxPx || 17; minPx = minPx || 10;
      el.style.fontSize = maxPx + 'px';
      el.style.whiteSpace = el.style.whiteSpace || 'nowrap';
      let size = maxPx;
      // Shrink until fits parent width (with padding slack)
      const parent = el.parentElement || el;
      const limit = Math.max(40, (parent.clientWidth || el.clientWidth || 200) - 8);
      while (size > minPx && el.scrollWidth > limit) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
    },
    fitAll() {
      document.querySelectorAll('[data-i18n-fit], .btn, .booster').forEach((el) => {
        const max = parseFloat(el.getAttribute('data-i18n-max')) || (el.classList.contains('booster') ? 11 : 17);
        const min = parseFloat(el.getAttribute('data-i18n-min')) || (el.classList.contains('booster') ? 8 : 11);
        this.fitText(el, max, min);
      });
    }
  };

  global.I18N = I18N;
})(typeof window !== 'undefined' ? window : globalThis);
