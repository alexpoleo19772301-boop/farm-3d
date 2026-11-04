# Краски / Винтики (com.alex.farm3d)

Оригинальная казуальная игра. Движок: HTML5 Canvas + Matter.js + Capacitor.

## Фоновая музыка (v3.6.0) — все CC0 / Public Domain

Файлы в `www/assets/audio/bgm/track{1..5}.ogg` (loudnorm ≈ −23 LUFS, OGG Vorbis ~q4).

| # | Имя в игре | Источник | Автор | Лицензия | Примечание |
|---|------------|----------|-------|----------|------------|
| 1 | Тихий рояль | [Soft Piano Emotional 1](https://opengameart.org/content/soft-piano-emotional-1) (OpenGameArt) | Tozan | **CC0** | укорочено/зациклено ~150 с |
| 2 | Закатные струны | [Sunset Plains](https://opengameart.org/content/sunset-plains) (OpenGameArt) | Yoiyami | **CC0** | акустическая гитара ~150 с |
| 3 | Музыкальная шкатулка | [whispered music box](https://archive.org/details/Ondrosik-Free-music-catalog) (archive.org CC0 catalog) | Ondrosik | **CC0** | ~105 с loop |
| 4 | Дождь и колокольчики | [AMB Rain Loop 1](https://opengameart.org/content/amb-rain-loop-1) + тихие chimes из track3 | Kresiek The Furry (дождь) + Ondrosik (chimes) | **CC0** | микс ~120 с |
| 5 | Спокойный lo-fi | [Chill lofi inspired](https://opengameart.org/content/chill-lofi-inspired) (OpenGameArt) | omfgdude | **CC0** | ~125 с |

Pixabay / не-CC0 источники **не** использовались.

## SFX (v4.0.2 / v4.0.1) — тихие / мягкие

Файлы в `www/assets/audio/sfx/sfx_*.ogg` (OGG Vorbis, low-pass, короткие fade, пониженная громкость).
Дефолт громкости эффектов: **38%** (отдельный слайдер «Громкость эффектов»).

| Файл | Назначение | Источник | Автор | Лицензия |
|------|------------|----------|-------|----------|
| `sfx_btn.ogg` | Кнопки UI | [Kenney UI Audio](https://kenney.nl/assets/ui-audio) (`click2`) | Kenney Vleugels | **CC0** |
| `sfx_tap.ogg` | Выбор колбы | Kenney UI Audio (`rollover2`) | Kenney | **CC0** |
| `sfx_undo.ogg` | Отмена | Kenney UI Audio (`mouserelease1`) | Kenney | **CC0** |
| `sfx_box.ogg` / `sfx_reward.ogg` | Бустер / награда | Kenney UI Audio (`switch26`) | Kenney | **CC0** |
| `sfx_cork.ogg` | Пробка / собранная колба | [bubbles 'pop'](https://opengameart.org/content/bubbles-pop) | farfadet46 (OGA) | **CC0** |
| `sfx_pour.ogg` | Перелив | мягкий synth (sine bubbles + pink noise) + фрагмент [Water Drops](https://opengameart.org/content/water-drops) | оригинал + ceoxblackj | **CC0** |
| `sfx_win.ogg` | Победа | мягкий sine-аккорд + [Completion sound](https://opengameart.org/content/completion-sound) (`completetask`) | оригинал + haeldb | **CC0** |
| `sfx_hint.ogg` | Подсказка | мягкий sine-chime (оригинал проекта) | оригинал | **CC0** |
| `sfx_coin.ogg` / `sfx_star.ogg` | Монеты / звёзды | мягкий sine-bell (оригинал проекта) | оригинал | **CC0** |
| `sfx_error.ogg` / `sfx_clunk.ogg` | Ошибка / нельзя | мягкий low sine thud (оригинал проекта) | оригинал | **CC0** |

Kenney UI Audio также зеркалирован на OpenGameArt: [51 UI sound effects](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks) (CC0).
Старые резкие `www/assets/audio/sfx_*.wav|ogg` (вне папки `sfx/`) больше не подключаются.

## Графика

Оригинальные спрайты мастерской, лотка, винтов.


## OTA (v4.0.2)

Исправлен OTA: приложение снова качает `version.json` + `www.zip` с GitHub Releases через Capacitor `AppUpdate` (в v4.0.0–4.0.1 остался только локальный reload). Старые резкие `assets/audio/sfx_*.wav|ogg` удалены; только `assets/audio/sfx/`.

## v4.0.4 — pour SFX + фон
- `sfx_pour.ogg` был почти неслышен (mean ≈ −68 dB, peak ≈ 0.008). Пересобран + loudnorm ≈ −16 LUFS; остальные SFX нормализованы.
- WebAudio buffer + пул HTMLAudio; unlock на первом жесте (Android WebView).
- Фоны: `assets/bg/bg_workshop.webp`, `bg_landscape.webp`, `bg_hills.webp` (cover, dim, particles).
