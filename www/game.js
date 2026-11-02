
/* Ферма на краю света 3D — v1.0.0 */
'use strict';
const CROPS={
  wheat:{id:'wheat',name:'Пшеница',emoji:'🌾',cost:5,baseSell:12,grow:30,xp:3,unlock:1,color:'#d4c04a'},
  carrot:{id:'carrot',name:'Морковь',emoji:'🥕',cost:8,baseSell:18,grow:45,xp:5,unlock:1,color:'#ff8c42'},
  tomato:{id:'tomato',name:'Томат',emoji:'🍅',cost:15,baseSell:35,grow:70,xp:8,unlock:3,color:'#e53935'},
  corn:{id:'corn',name:'Кукуруза',emoji:'🌽',cost:22,baseSell:50,grow:90,xp:12,unlock:5,color:'#fbc02d'},
  potato:{id:'potato',name:'Картофель',emoji:'🥔',cost:28,baseSell:58,grow:100,xp:14,unlock:6,color:'#c4a484'},
  berry:{id:'berry',name:'Клубника',emoji:'🍓',cost:35,baseSell:72,grow:80,xp:16,unlock:7,color:'#ff1744'},
  pumpkin:{id:'pumpkin',name:'Тыква',emoji:'🎃',cost:40,baseSell:90,grow:120,xp:20,unlock:8,color:'#ff6f00'},
  grape:{id:'grape',name:'Виноград',emoji:'🍇',cost:55,baseSell:120,grow:150,xp:25,unlock:10,color:'#7b1fa2'},
  melon:{id:'melon',name:'Арбуз',emoji:'🍉',cost:70,baseSell:150,grow:180,xp:30,unlock:12,color:'#43a047'},
  sunf:{id:'sunf',name:'Подсолнух',emoji:'🌻',cost:48,baseSell:110,grow:110,xp:22,unlock:14,color:'#ffc107'},
  pepper:{id:'pepper',name:'Перец',emoji:'🌶️',cost:60,baseSell:130,grow:95,xp:26,unlock:15,color:'#d32f2f'},
  rainbow:{id:'rainbow',name:'Цветок радуги',emoji:'🌺',cost:90,baseSell:200,grow:200,xp:40,unlock:18,color:'#e91e63'},
  glow:{id:'glow',name:'Светящаяся тыква',emoji:'✨',cost:0,baseSell:180,grow:100,xp:35,unlock:99,hybrid:true,color:'#fff59d'},
  firepep:{id:'firepep',name:'Огненный перец',emoji:'🔥',cost:0,baseSell:140,grow:80,xp:28,unlock:99,hybrid:true,color:'#ff5722'},
  starmelon:{id:'starmelon',name:'Звёздная дыня',emoji:'🌌',cost:0,baseSell:260,grow:140,xp:48,unlock:99,hybrid:true,color:'#5c6bc0'},
  sunpod:{id:'sunpod',name:'Солнечный стручок',emoji:'☀️',cost:0,baseSell:210,grow:90,xp:36,unlock:99,hybrid:true,color:'#ffee58'},
  rubyberry:{id:'rubyberry',name:'Рубиновая ягода',emoji:'💎',cost:0,baseSell:240,grow:85,xp:42,unlock:99,hybrid:true,color:'#f44336'},
  goldcorn:{id:'goldcorn',name:'Золотая кукуруза',emoji:'👑',cost:0,baseSell:220,grow:100,xp:38,unlock:99,hybrid:true,color:'#ffd700'},
  frostroot:{id:'frostroot',name:'Морозный корень',emoji:'🧊',cost:0,baseSell:190,grow:110,xp:34,unlock:99,hybrid:true,color:'#81d4fa'},
  stormleaf:{id:'stormleaf',name:'Лист шторма',emoji:'⚡',cost:0,baseSell:230,grow:95,xp:40,unlock:99,hybrid:true,color:'#7e57c2'},
  voidfig:{id:'voidfig',name:'Инжир пустоты',emoji:'🌑',cost:0,baseSell:300,grow:160,xp:55,unlock:99,hybrid:true,color:'#37474f'},
  moonfl:{id:'moonfl',name:'Лунный цветок',emoji:'🌙',cost:0,baseSell:200,grow:60,xp:40,unlock:99,hybrid:true,nightOnly:true,zone:'moon',color:'#ce93d8'},
};
const HYBRIDS=[
  {a:'pumpkin',b:'wheat',result:'glow'},{a:'tomato',b:'carrot',result:'firepep'},
  {a:'melon',b:'moonfl',result:'starmelon'},{a:'pepper',b:'sunf',result:'sunpod'},
  {a:'berry',b:'grape',result:'rubyberry'},{a:'corn',b:'wheat',result:'goldcorn'},
  {a:'potato',b:'carrot',result:'frostroot'},{a:'grape',b:'pepper',result:'stormleaf'},
  {a:'rainbow',b:'moonfl',result:'voidfig'},{a:'pumpkin',b:'berry',result:'glow'},
];
const ANIMAL_TYPES={
  chicken:{id:'chicken',name:'Курица',emoji:'🐔',cost:60,unlock:6,produce:'egg',produceEmoji:'🥚',produceSell:18,interval:40,traits:['храбрая','ленивая','крикливая']},
  cow:{id:'cow',name:'Корова',emoji:'🐮',cost:150,unlock:10,produce:'milk',produceEmoji:'🥛',produceSell:40,interval:70,traits:['добрая','прожорливая','сонная']},
  sheep:{id:'sheep',name:'Овца',emoji:'🐑',cost:120,unlock:12,produce:'wool',produceEmoji:'🧶',produceSell:35,interval:60,traits:['пушистая','упрямая','нежная']},
};
const ZONES=[
  {id:'main',name:'Ферма',emoji:'🌱',needHeart:0,needLevel:1},
  {id:'ruins',name:'Руины',emoji:'🏛️',needHeart:40,needLevel:4},
  {id:'moon',name:'Лунный сад',emoji:'🌙',needHeart:120,needLevel:8},
  {id:'pen',name:'Загон',emoji:'🐾',needHeart:80,needLevel:6},
];
const STORIES=[
  'Записка #1: «Остров держится на сердце. Корми его — и земля вернётся…»',
  'Записка #2: «У каменного круга я скрещивал семена. Светящаяся тыква спасла нас в шторм.»',
  'Записка #3: «Ночью приходят тени-жуки. Пугала помогают, но лучше бить их пальцем.»',
  'Записка #4: «Лунные цветы всходят только в темноте. Не проспи.»',
  'Записка #5: «В руинах шепчет ветер: сердце — не камень, а семя первого хранителя.»',
  'Записка #6: «Животные чувствуют край. Храбрая курица клюёт вредителей сама.»',
  'Записка #7: «Сезоны крутятся быстрее, чем на земле внизу. Смотри на небо.»',
  'Записка #8: «Звёздная дыня открывает путь к саду луны.»',
  'Записка #9: «Если край осыплется — не бросай Сердце. Оно помнит тебя.»',
  'Записка #10: «Ты — следующий хранитель. Остров выбрал тебя.»',
];
const LEVEL_XP=[0,0,20,50,90,140,200,270,360,460,580,720,880,1060,1260,1500,1780,2100,2460,2860,3300,3800,4350,4950,5600,6300,7100,8000,9000,10100,11300];
const HEART_THRESHOLDS=[0,15,40,80,140,220,320,450,600];


const SAVE_KEY='farm_edge_3d_v1';
const DAY_MS=120000;
const GROW_SCALE=0.12;
const SEASONS=['spring','summer','autumn','winter'];
const SEASON_RU={spring:'Весна',summer:'Лето',autumn:'Осень',winter:'Зима'};
const SEASON_EMO={spring:'🌸',summer:'☀️',autumn:'🍂',winter:'❄️'};
const WX_RU={clear:'Ясно',rain:'Дождь',drought:'Засуха',storm:'Шторм'};
const APP_VERSION={version: '1.0.0',versionCode: 10000,webVersion: '1.0.0'};
const DEFAULT_MANIFEST_URL=localStorage.getItem('farm3d_manifest_url')||'https://github.com/alexpoleo19772301-boop/farm-3d/releases/latest/download/version.json';

function growSec(c){return Math.max(7,Math.round(c.grow*GROW_SCALE));}
function todayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){return [...s].reduce((a,c)=>a+c.charCodeAt(0),0);}
function dailyMultipliers(day){const rnd=mulberry32(hashStr(day));const m={};Object.keys(CROPS).forEach(id=>{m[id]=0.7+rnd()*0.7;});return m;}
function sellPrice(id,mults){const c=CROPS[id];return Math.max(1,Math.round(c.baseSell*(mults[id]||1)));}
function xpForLevel(lv){return LEVEL_XP[Math.min(lv,LEVEL_XP.length-1)]||99999;}

/* ---------- Audio ---------- */
const AudioFX=(function(){
  const BASE='assets/audio/';
  const FILES={
    music_day:'music_day.ogg', music_night:'music_night.ogg',
    amb_birds:'amb_birds.ogg', amb_crickets:'amb_crickets.ogg', amb_rain:'amb_rain.ogg', amb_storm:'amb_storm.ogg',
    tap:'sfx_tap.ogg', plant:'sfx_plant.ogg', water:'sfx_water.ogg', harvest:'sfx_harvest.ogg',
    coin:'sfx_coin.ogg', purchase:'sfx_purchase.ogg', levelup:'sfx_levelup.ogg', unlock:'sfx_unlock.ogg',
    notify:'sfx_notify.ogg', squish:'sfx_squish.ogg', moo:'sfx_moo.ogg', cluck:'sfx_cluck.ogg', baa:'sfx_baa.ogg'
  };
  let ctx, unlocked=false, muted=false, musicVol=0.45, sfxVol=0.7;
  let master, musicGain, sfxGain, ambGain, buffers={}, musicSrc, ambSrc, curMusic, curAmb, loading, lastAnimal=0;
  function ensure(){ if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain(); master.gain.value=muted?0:1; master.connect(ctx.destination);
    musicGain=ctx.createGain(); musicGain.gain.value=musicVol; musicGain.connect(master);
    sfxGain=ctx.createGain(); sfxGain.gain.value=sfxVol; sfxGain.connect(master);
    ambGain=ctx.createGain(); ambGain.gain.value=Math.min(.5,sfxVol*.5); ambGain.connect(master);} return ctx; }
  async function loadAll(){ ensure(); await Promise.all(Object.entries(FILES).map(async([k,f])=>{
    if(buffers[k])return; try{const r=await fetch(BASE+f); buffers[k]=await ctx.decodeAudioData((await r.arrayBuffer()).slice(0));}catch(e){} })); }
  function unlock(){ if(unlocked)return Promise.resolve(); unlocked=true; ensure(); const p=ctx.resume();
    if(!loading) loading=loadAll().then(()=>updateWorldAudio(true)); return Promise.all([p,loading]); }
  function playBuf(name,dest,opts){ opts=opts||{}; if(muted||!unlocked)return; ensure(); const b=buffers[name];
    if(!b){ if(dest===sfxGain) beep(600,.05,.08); return; } if(ctx.state==='suspended')ctx.resume();
    const s=ctx.createBufferSource(); s.buffer=b; s.loop=!!opts.loop; const g=ctx.createGain(); g.gain.value=opts.vol!=null?opts.vol:1;
    s.connect(g); g.connect(dest||sfxGain); try{s.start(0);}catch(e){} return s; }
  function beep(f,d,v){ try{ensure(); if(muted)return; const o=ctx.createOscillator(),g=ctx.createGain(); o.frequency.value=f; g.gain.value=v||.1;
    g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+d); o.connect(g); g.connect(sfxGain||master); o.start(); o.stop(ctx.currentTime+d);}catch(e){} }
  function stop(s){ if(!s)return; try{s.stop();}catch(e){} }
  function playLoop(name, dest, curRef, setCur){ if(curRef===name) return name; stop(arguments[4]); return name; }
  function setMusic(name){ if(curMusic===name&&musicSrc)return; stop(musicSrc); musicSrc=null; curMusic=name; musicSrc=playBuf(name,musicGain,{loop:true,vol:.85}); }
  function setAmb(name){ if(curAmb===name&&ambSrc)return; stop(ambSrc); ambSrc=null; curAmb=name; ambSrc=playBuf(name,ambGain,{loop:true,vol:.45}); }
  function sfx(n,v){ playBuf(n,sfxGain,{vol:v}); }
  function updateWorldAudio(force){
    if(!unlocked) return;
    const night=isNight();
    setMusic(night?'music_night':'music_day');
    if(state.weather==='rain'||state.weather==='storm') setAmb(state.weather==='storm'?'amb_storm':'amb_rain');
    else setAmb(night?'amb_crickets':'amb_birds');
  }
  function maybeAnimalIdle(list){
    if(!list||!list.length||Date.now()-lastAnimal<8000)return;
    if(Math.random()>.2)return; lastAnimal=Date.now();
    const a=list[(Math.random()*list.length)|0]; animal(a.type);
  }
  function animal(type){ sfx(type==='cow'?'moo':type==='sheep'?'baa':'cluck', .7); }
  function setMuted(m){ muted=!!m; if(master) master.gain.value=muted?0:1; }
  function setMusicVol(v){ musicVol=+v||0; if(musicGain) musicGain.gain.value=musicVol; }
  function setSfxVol(v){ sfxVol=+v||0; if(sfxGain) sfxGain.gain.value=sfxVol; if(ambGain) ambGain.gain.value=Math.min(.5,sfxVol*.5); }
  document.addEventListener('visibilitychange',()=>{ if(!ctx)return; if(document.hidden) ctx.suspend(); else if(unlocked) ctx.resume(); });
  return {unlockAudio:unlock,sfx,plant:()=>sfx('plant'),water:()=>sfx('water'),harvest:()=>sfx('harvest'),coin:()=>sfx('coin'),
    purchase:()=>sfx('purchase'),level:()=>sfx('levelup'),unlock:()=>sfx('unlock'),ui:()=>sfx('tap',.4),hit:()=>sfx('squish'),
    feed:()=>sfx('notify'),weather:()=>sfx('notify',.5),animal,updateWorldAudio,maybeAnimalIdle,setMuted,isMuted:()=>muted,
    setMusicVol,setSfxVol,getMusicVol:()=>musicVol,getSfxVol:()=>sfxVol};
})();

const state={
  coins:40,xp:0,level:1,heart:0,dayKey:todayKey(),seasonIdx:0,weather:'clear',weatherUntil:0,dayIndex:0,
  inventory:{},products:{},unlockedHybrids:[],animals:[],storyIdx:0,storiesRead:[0],cycleStart:Date.now(),
  order:null,ordersDone:0,muted:false,musicVol:.45,sfxVol:.7,plots:[],zone:'main',tool:'hand',selectedCrop:'wheat',
  pests:[],scarecrows:0,nightActive:false,mults:{},lastSave:0
};

function plotsUnlocked(){let n=4;for(let i=1;i<HEART_THRESHOLDS.length;i++)if(state.heart>=HEART_THRESHOLDS[i])n=Math.min(24,4+i*2);n=Math.max(n,Math.min(24,4+Math.floor((state.level-1)/2)*2));return n;}
function gridSize(n){if(n<=4)return{cols:2,rows:2};if(n<=6)return{cols:3,rows:2};if(n<=9)return{cols:3,rows:3};if(n<=12)return{cols:4,rows:3};if(n<=16)return{cols:4,rows:4};return{cols:4,rows:6};}
function zoneUnlocked(z){return state.heart>=z.needHeart&&state.level>=z.needLevel;}
function ensurePlots(){
  const n=plotsUnlocked(); const g=gridSize(n);
  while(state.plots.length<n){
    const i=state.plots.length; const c=i%g.cols, r=(i/g.cols)|0;
    state.plots.push({zone:'main',locked:false,cropId:null,plantedAt:0,watered:false,ready:false,pop:0,sway:Math.random()*6,col:c,row:r});
  }
  state.plots.forEach((p,i)=>{ p.locked=i>=n; const gg=gridSize(n); p.col=i%gg.cols; p.row=(i/gg.cols)|0; });
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._tm);toast._tm=setTimeout(()=>t.classList.remove('show'),2200);}
function addXp(n){state.xp+=n;while(state.level<30&&state.xp>=xpForLevel(state.level+1)){state.level++;AudioFX.level();toast('⬆️ Уровень '+state.level+'!');ensurePlots();maybeStory();World3D.refreshPlots();}}
function maybeStory(){const want=Math.min(STORIES.length-1,Math.floor(state.level/3)+Math.floor(state.heart/60)+state.ordersDone);if(want>state.storyIdx){state.storyIdx=want;if(!state.storiesRead.includes(want))state.storiesRead.push(want);document.getElementById('story').textContent=STORIES[state.storyIdx];AudioFX.unlock();toast('📜 Новая записка!');}}
function feedHeart(amount){state.heart+=amount;ensurePlots();maybeStory();AudioFX.feed();toast('❤️ Сердце +'+amount);World3D.refreshPlots();}
function season(){return SEASONS[state.seasonIdx%4];}
function seasonGrowMult(){const s=season();if(s==='spring')return .9;if(s==='summer')return state.weather==='drought'?1.35:1;if(s==='autumn')return 1.05;return 1.25;}
function seasonSellBonus(id){const s=season();if(s==='autumn'&&(id==='pumpkin'||id==='grape'))return 1.15;if(s==='summer'&&(id==='berry'||id==='melon'))return 1.1;if(s==='spring'&&(id==='carrot'||id==='wheat'))return 1.08;if(s==='winter'&&(id==='frostroot'||id==='potato'))return 1.12;return 1;}
function weatherGrowMult(){if(state.weather==='rain')return .85;if(state.weather==='drought')return 1.4;if(state.weather==='storm')return 1.2;return 1;}
function isNight(){const t=((Date.now()-state.cycleStart)%DAY_MS)/DAY_MS;return t>=.55&&t<.92;}
function cycleLabel(){const t=((Date.now()-state.cycleStart)%DAY_MS)/DAY_MS;if(t<.55)return{ico:'☀️',label:'День'};if(t<.92)return{ico:'🌙',label:'Ночь'};return{ico:'🌅',label:'Рассвет'};}
function rollWeather(){const s=season(),rnd=Math.random();let w='clear';if(s==='spring')w=rnd<.45?'rain':rnd<.55?'storm':'clear';else if(s==='summer')w=rnd<.35?'drought':rnd<.5?'storm':'clear';else if(s==='autumn')w=rnd<.4?'rain':rnd<.55?'storm':'clear';else w=rnd<.3?'storm':'clear';state.weather=w;state.weatherUntil=Date.now()+DAY_MS*(.4+Math.random()*.5);AudioFX.weather();toast((SEASON_EMO[s]||'')+' Погода: '+WX_RU[w]);}
function advanceTimeChunk(){state.dayIndex++;if(state.dayIndex%3===0){state.seasonIdx=(state.seasonIdx+1)%4;toast(SEASON_EMO[season()]+' Наступила '+SEASON_RU[season()]);}rollWeather();genOrder();}
function genOrder(){const unlocked=Object.values(CROPS).filter(c=>!c.hybrid&&state.level>=c.unlock);if(!unlocked.length){state.order=null;return;}const c=unlocked[Math.floor(Math.random()*unlocked.length)];const qty=1+Math.floor(Math.random()*3);state.order={cropId:c.id,qty,progress:0,reward:Math.round(c.baseSell*qty*(1.3+Math.random()*.5)),xp:8+qty*3};renderOrder();}
function renderOrder(){const el=document.getElementById('order-chip');if(!state.order){el.style.display='none';return;}const c=CROPS[state.order.cropId];el.style.display='block';el.innerHTML=`<b>Заказ дня</b> ${c.emoji} ${c.name} ${state.order.progress}/${state.order.qty} · ${state.order.reward}🪙`;}
function updateGrowth(){const now=Date.now();if(now>state.weatherUntil)rollWeather();const gMult=seasonGrowMult()*weatherGrowMult();state.plots.forEach(p=>{if(!p.cropId||p.ready||p.locked)return;const crop=CROPS[p.cropId];let need=growSec(crop)*1000*gMult;if(!p.watered)need*=1.55;if(state.weather==='rain'&&!p.watered)p.watered=true;if(crop.nightOnly&&!isNight())return;if(now-p.plantedAt>=need){p.ready=true;p.pop=1;}});state.animals.forEach(a=>{const t=ANIMAL_TYPES[a.type];if(!t)return;let iv=t.interval*1000;if(a.trait==='ленивая'||a.trait==='сонная')iv*=1.35;if(a.trait==='прожорливая')iv*=.85;if(!a.ready&&now-a.lastProduce>=iv)a.ready=true;});}

function plant(i){const p=state.plots[i];if(p.locked||p.cropId){toast('Грядка занята');return;}const id=state.selectedCrop;const crop=CROPS[id];if(!crop)return;if(crop.zone&&crop.zone!==state.zone){toast('Другая зона');return;}if(crop.nightOnly&&!isNight()){toast('Только ночью');return;}let have=state.inventory[id]||0;if(have>0)state.inventory[id]=have-1;else if(!crop.hybrid){if(state.coins<crop.cost){toast('Мало монет');return;}state.coins-=crop.cost;}else{toast('Нет семян гибрида');return;}p.cropId=id;p.plantedAt=Date.now();p.watered=false;p.ready=false;p.pop=1;AudioFX.plant();toast('Посадили '+crop.emoji);updateHUD();renderToolbar();World3D.refreshPlots();}
function waterPlot(i){const p=state.plots[i];if(!p.cropId||p.watered||p.ready){toast('Нечего поливать');return;}p.watered=true;AudioFX.water();toast('💧 Полито');World3D.refreshPlots();}
function harvest(i){const p=state.plots[i];if(!p.ready)return;const crop=CROPS[p.cropId];let price=Math.round(sellPrice(p.cropId,state.mults)*seasonSellBonus(p.cropId));if(state.weather==='storm'&&Math.random()<.15){toast('💨 Шторм (−30%)');price=Math.round(price*.7);}state.coins+=price;addXp(crop.xp);if(Math.random()<.4)state.inventory[p.cropId]=(state.inventory[p.cropId]||0)+1;if(state.order&&state.order.cropId===p.cropId&&state.order.progress<state.order.qty){state.order.progress++;if(state.order.progress>=state.order.qty){state.coins+=state.order.reward;addXp(state.order.xp);state.ordersDone++;AudioFX.coin();toast('📦 Заказ +'+state.order.reward+'🪙');state.order=null;maybeStory();genOrder();}else renderOrder();}AudioFX.harvest();AudioFX.coin();toast(crop.emoji+' +'+price+'🪙');p.cropId=null;p.plantedAt=0;p.watered=false;p.ready=false;updateHUD();World3D.refreshPlots();}
function collectAnimal(idx){const a=state.animals[idx];if(!a)return;AudioFX.animal(a.type);if(!a.ready){toast('Ещё не готово');return;}const t=ANIMAL_TYPES[a.type];let price=t.produceSell;if(a.trait==='храбрая')price=Math.round(price*1.1);state.coins+=price;addXp(5);state.products[t.produce]=(state.products[t.produce]||0)+1;a.ready=false;a.lastProduce=Date.now();if(a.trait==='храбрая'&&state.pests.length){removePest(state.pests[0]);toast('🐔 Курица прогнала вредителя!');}AudioFX.coin();toast(t.produceEmoji+' +'+price+'🪙');updateHUD();save();}
function buyAnimal(typeId){const t=ANIMAL_TYPES[typeId];if(state.level<t.unlock){toast('Нужен ур.'+t.unlock);return;}if(!zoneUnlocked(ZONES.find(z=>z.id==='pen'))){toast('Сначала открой Загон');return;}if(state.animals.length>=6){toast('Макс. 6');return;}if(state.coins<t.cost){toast('Мало монет');return;}state.coins-=t.cost;const trait=t.traits[Math.floor(Math.random()*t.traits.length)];state.animals.push({type:typeId,trait,lastProduce:Date.now(),ready:false});AudioFX.unlock();AudioFX.animal(typeId);AudioFX.purchase();toast(t.emoji+' «'+trait+'»');updateHUD();renderToolbar();World3D.refreshAnimals();save();}
function craft(resultId){const h=HYBRIDS.find(x=>x.result===resultId);if(!h)return;if((state.inventory[h.a]||0)<1||(state.inventory[h.b]||0)<1){toast('Нужны семена родителей');return;}state.inventory[h.a]--;state.inventory[h.b]--;state.inventory[resultId]=(state.inventory[resultId]||0)+1;if(!state.unlockedHybrids.includes(resultId)){state.unlockedHybrids.push(resultId);addXp(15);AudioFX.unlock();toast('🧬 '+CROPS[resultId].name);}else{AudioFX.plant();toast('🧬 '+CROPS[resultId].emoji);}renderToolbar();save();}

function spawnPest(){if(state.pests.length>=7)return;if(state.scarecrows>0&&Math.random()<.4)return;const pe={id:Math.random().toString(36).slice(2),plot:Math.floor(Math.random()*state.plots.length)};state.pests.push(pe);World3D.refreshPests();pe.timer=setTimeout(()=>{if(!state.pests.includes(pe))return;const p=state.plots[pe.plot];if(p&&p.cropId&&!p.locked){p.cropId=null;p.plantedAt=0;p.watered=false;p.ready=false;toast('🐛 Урожай съеден!');World3D.refreshPlots();}removePest(pe);},7500);}
function squashPest(pe){state.coins+=4;addXp(2);if(Math.random()<.28){state.inventory.moonfl=(state.inventory.moonfl||0)+1;if(!state.unlockedHybrids.includes('moonfl'))state.unlockedHybrids.push('moonfl');toast('🌙 Лунный цветок!');}else toast('💥 +4🪙');AudioFX.hit();removePest(pe);updateHUD();renderToolbar();save();}
function removePest(pe){clearTimeout(pe.timer);state.pests=state.pests.filter(x=>x!==pe);World3D.refreshPests();}

function save(){const data={coins:state.coins,xp:state.xp,level:state.level,heart:state.heart,dayKey:state.dayKey,seasonIdx:state.seasonIdx,weather:state.weather,weatherUntil:state.weatherUntil,dayIndex:state.dayIndex,inventory:state.inventory,products:state.products,unlockedHybrids:state.unlockedHybrids,animals:state.animals,storyIdx:state.storyIdx,storiesRead:state.storiesRead,cycleStart:state.cycleStart,order:state.order,ordersDone:state.ordersDone,muted:state.muted,musicVol:state.musicVol,sfxVol:state.sfxVol,plots:state.plots.map(p=>({zone:p.zone,locked:p.locked,cropId:p.cropId,plantedAt:p.plantedAt,watered:p.watered,ready:p.ready,col:p.col,row:p.row}))};try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch(e){}}
function load(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;const d=JSON.parse(raw);Object.assign(state,{coins:d.coins,xp:d.xp,level:d.level,heart:d.heart,dayKey:d.dayKey||todayKey(),seasonIdx:d.seasonIdx||0,weather:d.weather||'clear',weatherUntil:d.weatherUntil||0,dayIndex:d.dayIndex||0,inventory:d.inventory||{},products:d.products||{},unlockedHybrids:d.unlockedHybrids||[],animals:d.animals||[],storyIdx:d.storyIdx||0,storiesRead:d.storiesRead||[0],cycleStart:d.cycleStart||Date.now(),order:d.order||null,ordersDone:d.ordersDone||0,muted:!!d.muted,musicVol:d.musicVol!=null?d.musicVol:0.45,sfxVol:d.sfxVol!=null?d.sfxVol:0.7,plots:(d.plots||[]).map(p=>({...p,pop:0,sway:Math.random()*6}))});return true;}catch(e){return false;}}
function refreshDay(){const d=todayKey();if(d!==state.dayKey){state.dayKey=d;genOrder();}state.mults=dailyMultipliers(state.dayKey);if(!state.order)genOrder();}

function updateHUD(){document.getElementById('coins').textContent=state.coins;document.getElementById('level').textContent=state.level;const cl=cycleLabel();document.getElementById('tod-stat').textContent=cl.ico+' '+cl.label;document.getElementById('wx-stat').textContent=(SEASON_EMO[season()]||'')+' '+SEASON_RU[season()]+' · '+WX_RU[state.weather];document.getElementById('heart-pct').textContent=Math.round(Math.min(100,state.heart/(HEART_THRESHOLDS[HEART_THRESHOLDS.length-1]||600)*100))+'%';document.getElementById('btn-mute').textContent=state.muted?'🔇':'🔊';}
function renderZones(){const bar=document.getElementById('zonebar');bar.innerHTML='';ZONES.forEach(z=>{const ok=zoneUnlocked(z);const b=document.createElement('button');b.className='zbtn'+(state.zone===z.id?' on':'');b.disabled=!ok;b.textContent=z.emoji+' '+z.name+(ok?'':' 🔒');b.onclick=()=>{if(!ok)return;state.zone=z.id;AudioFX.ui();renderToolbar();};bar.appendChild(b);});}
function renderToolbar(){
  const tb=document.getElementById('toolbar'); tb.innerHTML='';
  const mk=(ico,label,active,fn)=>{const d=document.createElement('button');d.className='tool'+(active?' active':'');d.innerHTML=`<span class="t-ico">${ico}</span>${label}`;d.onclick=fn;tb.appendChild(d);};
  mk('✋','Рука',state.tool==='hand',()=>{state.tool='hand';renderToolbar();});
  mk('💧','Полив',state.tool==='water',()=>{state.tool='water';renderToolbar();});
  Object.values(CROPS).filter(c=>!c.hybrid&&state.level>=c.unlock).forEach(c=>{
    mk(c.emoji, c.cost+'🪙', state.tool==='plant'&&state.selectedCrop===c.id, ()=>{state.tool='plant';state.selectedCrop=c.id;renderToolbar();});
  });
  mk('🏪','Рынок',false,()=>openMarket());
}
function openModal(html){document.getElementById('modal').innerHTML=html;document.getElementById('modal-bg').classList.add('open');AudioFX.ui();}
function closeModal(){document.getElementById('modal-bg').classList.remove('open');}
document.getElementById('modal-bg').onclick=e=>{if(e.target.id==='modal-bg')closeModal();};

function openMarket(){
  let html='<h2>🏪 Рынок</h2><div class="tabs"><button class="tab on" data-t="sell">Продать</button><button class="tab" data-t="animals">Животные</button><button class="tab" data-t="craft">Гибриды</button><button class="tab" data-t="heart">Сердце</button></div><div id="mbody"></div><button class="btn ghost" style="width:100%;margin-top:8px" id="mclose">Закрыть</button>';
  openModal(html);
  const body=()=>document.getElementById('mbody');
  const show=tab=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.t===tab));
    if(tab==='sell'){
      let h='';
      Object.keys(state.inventory).forEach(id=>{const n=state.inventory[id]|0; if(n<=0)return; const c=CROPS[id]; const pr=sellPrice(id,state.mults);
        h+=`<div class="row"><div class="name">${c.emoji} ${c.name} ×${n}</div><button class="btn" data-sell="${id}">${pr}🪙</button></div>`;});
      Object.keys(state.products).forEach(id=>{const n=state.products[id]|0; if(n<=0)return;
        h+=`<div class="row"><div class="name">${id} ×${n}</div><button class="btn" data-psell="${id}">Продать</button></div>`;});
      if(!h) h='<p class="hint">Нечего продавать — соберите урожай.</p>';
      body().innerHTML=h;
      body().querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{const id=b.dataset.sell; if((state.inventory[id]||0)<1)return; state.inventory[id]--; state.coins+=sellPrice(id,state.mults); AudioFX.coin(); updateHUD(); show('sell'); save();});
      body().querySelectorAll('[data-psell]').forEach(b=>b.onclick=()=>{const id=b.dataset.psell; if((state.products[id]||0)<1)return; const t=Object.values(ANIMAL_TYPES).find(x=>x.produce===id); const pr=t?t.produceSell:10; state.products[id]--; state.coins+=pr; AudioFX.coin(); updateHUD(); show('sell'); save();});
    } else if(tab==='animals'){
      body().innerHTML=Object.values(ANIMAL_TYPES).map(t=>`<div class="row"><div class="name">${t.emoji} ${t.name}<div class="hint">ур.${t.unlock} · ${t.cost}🪙</div></div><button class="btn" data-buy="${t.id}">Купить</button></div>`).join('');
      body().querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{buyAnimal(b.dataset.buy); show('animals');});
    } else if(tab==='craft'){
      body().innerHTML=HYBRIDS.map(h=>{const a=CROPS[h.a],b=CROPS[h.b],r=CROPS[h.result];
        return `<div class="row"><div class="name">${a.emoji}+${b.emoji} → ${r.emoji} ${r.name}</div><button class="btn" data-craft="${h.result}">Скрестить</button></div>`;}).join('');
      body().querySelectorAll('[data-craft]').forEach(b=>b.onclick=()=>{craft(b.dataset.craft); show('craft');});
    } else {
      body().innerHTML=`<p>Корми Сердце острова, чтобы открывать грядки и зоны.</p><div class="row"><div class="name">❤️ Пожертвовать 20🪙</div><button class="btn" id="feed">Кормить</button></div>`;
      document.getElementById('feed').onclick=()=>{if(state.coins<20){toast('Мало монет');return;}state.coins-=20;feedHeart(5);updateHUD();save();};
    }
  };
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>show(t.dataset.t));
  document.getElementById('mclose').onclick=closeModal;
  show('sell');
}
function openBook(){
  let html=`<h2>📖 Книга</h2><p class="hint">Слияний нет — это 3D-ферма. Ур.${state.level}, сердце ${state.heart}, заказов ${state.ordersDone}</p>`;
  html+=`<label>Музыка <input type="range" id="vm" min="0" max="100" value="${Math.round(state.musicVol*100)}" style="width:100%"/></label>`;
  html+=`<label>Эффекты <input type="range" id="vs" min="0" max="100" value="${Math.round(state.sfxVol*100)}" style="width:100%"/></label>`;
  html+=`<p class="hint" style="margin-top:8px">${STORIES[state.storyIdx]||''}</p>`;
  html+=`<button class="btn" id="upd" style="width:100%;margin:6px 0">Проверить обновления</button>`;
  html+=`<button class="btn ghost" id="rst" style="width:100%">Сброс сохранения</button>`;
  html+=`<button class="btn ghost" id="clb" style="width:100%;margin-top:6px">Закрыть</button>`;
  openModal(html);
  document.getElementById('vm').oninput=e=>{state.musicVol=e.target.value/100;AudioFX.setMusicVol(state.musicVol);save();};
  document.getElementById('vs').oninput=e=>{state.sfxVol=e.target.value/100;AudioFX.setSfxVol(state.sfxVol);save();};
  document.getElementById('upd').onclick=()=>checkForUpdates({});
  document.getElementById('rst').onclick=()=>{if(confirm('Сбросить?')){localStorage.removeItem(SAVE_KEY);location.reload();}};
  document.getElementById('clb').onclick=closeModal;
}

/* ===================== THREE.JS WORLD ===================== */
const World3D=(function(){
  let renderer, scene, camera, sun, hemi, island, plotsGroup, cropsGroup, animalsGroup, pestsGroup, tractor, rain;
  let target={theta:0.55, phi:1.05, dist:14}, cur={theta:0.55, phi:1.05, dist:14}, look={x:1.5,y:0.4,z:0.5};
  let dragging=false, lastX=0, lastY=0, pinch0=0;
  let tractorTarget=null, tractorBusy=false, pendingAction=null;
  let plotMeshes=[], clock, frames=0, lastFps=0;
  const matCache={};

  function mat(color, opts){
    const key=color+JSON.stringify(opts||{});
    if(matCache[key]) return matCache[key];
    matCache[key]=new THREE.MeshStandardMaterial(Object.assign({color, roughness:0.72, metalness:0.05}, opts||{}));
    return matCache[key];
  }
  function box(w,h,d,color,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); m.position.set(x||0,y||0,z||0); m.castShadow=true; m.receiveShadow=true; return m; }
  function cyl(r,h,color,x,y,z,seg){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||8), mat(color)); m.position.set(x||0,y||0,z||0); m.castShadow=true; m.receiveShadow=true; return m; }
  function sph(r,color,x,y,z){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,8), mat(color)); m.position.set(x||0,y||0,z||0); m.castShadow=true; return m; }

  function makeTractor(){
    const g=new THREE.Group();
    const body=box(1.6,0.7,1.0,'#e53935',0,0.85,0); g.add(body);
    const cabin=box(0.7,0.55,0.85,'#42a5f5',-0.15,1.4,0); g.add(cabin);
    const pipe=cyl(0.06,0.55,'#455a64',0.55,1.35,-0.25,6); g.add(pipe);
    const light=sph(0.12,'#ffeb3b',0.85,0.95,0.35); g.add(light);
    [[-0.55,0.45,0.55],[0.55,0.45,0.55],[-0.55,0.45,-0.55],[0.55,0.45,-0.55]].forEach(([x,y,z],i)=>{
      const w=cyl(i<2?0.42:0.32,0.28,'#212121',x,y,z,10); w.rotation.z=Math.PI/2; g.add(w);
    });
    // driver
    const head=sph(0.22,'#ffcc80',-0.15,1.85,0); g.add(head);
    const hat=cyl(0.26,0.08,'#6d4c41',-0.15,2.05,0,8); g.add(hat);
    g.position.set(0.5,0.15,3.8); return g;
  }
  function makeBarn(){
    const g=new THREE.Group();
    g.add(box(4.2,2.6,3.2,'#c62828',0,1.3,0));
    const roof=new THREE.Mesh(new THREE.ConeGeometry(3.2,1.4,4), mat('#efebe9')); roof.position.y=3.2; roof.rotation.y=Math.PI/4; roof.castShadow=true; g.add(roof);
    g.add(box(0.9,1.6,0.1,'#5d4037',0,0.9,1.61));
    const silo=cyl(0.55,3.2,'#b0bec5',2.6,1.6,0,10); g.add(silo);
    const silotop=new THREE.Mesh(new THREE.ConeGeometry(0.65,0.5,8), mat('#c62828')); silotop.position.set(2.6,3.4,0); g.add(silotop);
    g.position.set(-6.5,0.1,-5.5); return g;
  }
  function makeTree(x,z,scale){
    const g=new THREE.Group();
    const trunk=cyl(0.18*scale,1.2*scale,'#6d4c41',0,0.6*scale,0,6); g.add(trunk);
    const leaf=sph(0.85*scale,'#43a047',0,1.5*scale,0); leaf.userData.sway=true; g.add(leaf);
    const leaf2=sph(0.55*scale,'#66bb6a',0.35*scale,1.7*scale,0.1*scale); leaf2.userData.sway=true; g.add(leaf2);
    g.position.set(x,0,z); g.userData.wind=Math.random()*Math.PI*2; return g;
  }
  function makeMountain(x,z,h,w,color){
    const m=new THREE.Mesh(new THREE.ConeGeometry(w,h,5), mat(color,{roughness:0.95}));
    m.position.set(x,h*0.45,z); m.receiveShadow=true; return m;
  }
  function makeIsland(){
    const g=new THREE.Group();
    // top disk
    const top=new THREE.Mesh(new THREE.CylinderGeometry(14,14.5,0.55,40), mat('#66bb6a')); top.position.y=0; top.receiveShadow=true; g.add(top);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(13.8,0.35,8,40), mat('#558b2f')); rim.rotation.x=Math.PI/2; rim.position.y=0.2; g.add(rim);
    const cliff=new THREE.Mesh(new THREE.CylinderGeometry(13.0,8.8,5.2,36), mat('#8d6e63',{roughness:0.92})); cliff.position.y=-2.7; cliff.receiveShadow=true; g.add(cliff);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(7.2,4.2,32), mat('#5d4037')); tip.position.y=-6.5; tip.rotation.x=Math.PI; g.add(tip);
    // field patch
    const soil=new THREE.Mesh(new THREE.BoxGeometry(7.5,0.15,6.5), mat('#4e342e')); soil.position.set(2.2,0.32,1.2); soil.receiveShadow=true; g.add(soil);
    return g;
  }
  function makeWell(){ const g=new THREE.Group(); g.add(cyl(0.7,0.7,'#90a4ae',0,0.35,0,10)); g.add(box(1.6,0.12,0.12,'#5d4037',0,1.2,0)); g.add(box(0.12,0.9,0.12,'#5d4037',-0.7,0.85,0)); g.add(box(0.12,0.9,0.12,'#5d4037',0.7,0.85,0)); g.position.set(7,0.1, -2); return g; }
  function makeMarket(){ const g=new THREE.Group(); g.add(box(2.2,0.15,1.4,'#a1887f',0,0.9,0)); g.add(box(0.12,0.9,0.12,'#6d4c41',-0.9,0.45,-0.5)); g.add(box(0.12,0.9,0.12,'#6d4c41',0.9,0.45,-0.5)); g.add(box(0.12,0.9,0.12,'#6d4c41',-0.9,0.45,0.5)); g.add(box(0.12,0.9,0.12,'#6d4c41',0.9,0.45,0.5)); const roof=box(2.4,0.08,1.6,'#ef6c00',0,1.35,0); g.add(roof); g.position.set(6.5,0.1,4.5); return g; }
  function makeFence(){
    const g=new THREE.Group();
    for(let i=-4;i<=4;i++){ g.add(box(0.12,0.7,0.12,'#8d6e63',i*0.7,0.35,-8.2)); if(i<4) g.add(box(0.7,0.08,0.08,'#a1887f',i*0.7+0.35,0.5,-8.2)); }
    return g;
  }
  function makeHay(x,z){ const g=new THREE.Group(); for(let i=0;i<3;i++) g.add(box(0.7,0.35,0.45,'#f9a825',0,0.2+i*0.36,0)); g.position.set(x,0.1,z); return g; }
  function makeCropMesh(cropId, stage){
    // stage 0 sprout, 1 growing, 2 ready — beet-like for carrot/potato, wheat stalks else
    const g=new THREE.Group();
    const c=CROPS[cropId]||{color:'#81c784'};
    const col=c.color||'#81c784';
    if(cropId==='carrot'||cropId==='potato'||cropId==='frostroot'||cropId==='beet'){
      const bulb=sph(0.28+stage*0.18, cropId==='carrot'?'#c62828':col, 0, 0.22+stage*0.12, 0); g.add(bulb);
      for(let i=0;i<5;i++){
        const ang=i/5*Math.PI*2;
        const leaf=box(0.08,0.55+stage*0.35,0.28,'#2e7d32', Math.cos(ang)*0.12, 0.55+stage*0.25, Math.sin(ang)*0.12);
        leaf.rotation.z=Math.cos(ang)*0.45; leaf.rotation.x=Math.sin(ang)*0.25; g.add(leaf);
      }
    } else if(cropId==='wheat'||cropId==='corn'||cropId==='goldcorn'){
      for(let i=0;i<4;i++){ const stalk=cyl(0.03,0.35+stage*0.45, col, (i%2)*0.12-0.06, 0.2+stage*0.2, ((i/2)|0)*0.12-0.06, 5); g.add(stalk); }
    } else if(cropId==='pumpkin'||cropId==='melon'||cropId==='glow'||cropId==='starmelon'){
      g.add(sph(0.15+stage*0.2, col, 0, 0.2+stage*0.15, 0));
    } else {
      g.add(sph(0.12+stage*0.1, col, 0, 0.2+stage*0.1, 0));
      g.add(cyl(0.03,0.25+stage*0.2,'#2e7d32',0,0.25+stage*0.15,0,5));
    }
    if(stage>=2){ const spark=sph(0.06,'#fff59d',0.2,0.5,0.1); spark.material=mat('#fff59d',{emissive:'#ffee58',emissiveIntensity:0.6}); g.add(spark); }
    return g;
  }
  function plotWorldPos(p){
    const originX=0.0, originZ=-0.5; const spacing=1.35;
    return {x: originX + p.col*spacing, z: originZ + p.row*spacing};
  }

  function init(){
    const canvas=document.getElementById('c3d');
    renderer=new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
    const pr=Math.min(window.devicePixelRatio||1, 1.5);
    renderer.setPixelRatio(pr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputEncoding=THREE.sRGBEncoding;

    scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(0xffb080, 0.012);

    camera=new THREE.PerspectiveCamera(42, canvas.clientWidth/Math.max(1,canvas.clientHeight), 0.3, 120);

    // lights — warm sunset
    hemi=new THREE.HemisphereLight(0xffe0b2, 0x4e342e, 0.55); scene.add(hemi);
    sun=new THREE.DirectionalLight(0xffcc80, 1.15); sun.position.set(12, 14, 6); sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.near=1; sun.shadow.camera.far=60;
    sun.shadow.camera.left=-18; sun.shadow.camera.right=18; sun.shadow.camera.top=18; sun.shadow.camera.bottom=-18;
    sun.shadow.bias=-0.0008; scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffe8d6, 0.25));

    // sky dome
    const skyGeo=new THREE.SphereGeometry(80, 16, 12);
    const skyMat=new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false,
      uniforms:{ top:{value:new THREE.Color(0x2b5f9e)}, bot:{value:new THREE.Color(0xff8a3d)} },
      vertexShader:'varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 top,bot; varying vec3 vP; void main(){ float h=normalize(vP).y*0.5+0.5; gl_FragColor=vec4(mix(bot,top,h),1.);}'
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    island=makeIsland(); scene.add(island);
    scene.add(makeBarn()); scene.add(makeWell()); scene.add(makeMarket()); scene.add(makeFence());
    scene.add(makeHay(5,-6)); scene.add(makeHay(6.2,-5.5)); scene.add(makeHay(-2,-7));
    // trees
    [[8,6,1.1],[9,-3,0.9],[-9,2,1.2],[-8,-7,1],[-4,8,0.85],[4,8.5,1],[10,2,0.7],[-10,-2,1],[7,-7,1],[11,5,0.8],[-7,6,1.05],[3,-8,0.9],[-11,4,0.95],[6,9,0.75]].forEach(([x,z,s])=>scene.add(makeTree(x,z,s)));
    // mountains
    [[-14,-10,18,12,'#8d6e63'],[-4,-13,22,14,'#6d4c41'],[8,-14,20,13,'#a1887f'],[16,-10,17,11,'#795548'],[-20,-4,14,10,'#5d4037'],[2,-16,15,10,'#8d6e63'],[22,-5,16,11,'#6d4c41'],[-10,-16,12,8,'#a1887f']].forEach(a=>scene.add(makeMountain(...a)));

    plotsGroup=new THREE.Group(); scene.add(plotsGroup);
    cropsGroup=new THREE.Group(); scene.add(cropsGroup);
    animalsGroup=new THREE.Group(); scene.add(animalsGroup);
    pestsGroup=new THREE.Group(); scene.add(pestsGroup);
    tractor=makeTractor(); scene.add(tractor);

    // rain
    const rainCount=400;
    const rainGeo=new THREE.BufferGeometry();
    const positions=new Float32Array(rainCount*3);
    for(let i=0;i<rainCount;i++){ positions[i*3]=(Math.random()-0.5)*28; positions[i*3+1]=Math.random()*12; positions[i*3+2]=(Math.random()-0.5)*28; }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    rain=new THREE.Points(rainGeo, new THREE.PointsMaterial({color:0xe3f2fd, size:0.05, transparent:true, opacity:0.55, depthWrite:false}));
    rain.visible=false; scene.add(rain);

    clock=new THREE.Clock();
    bindInput(canvas);
    refreshPlots(); refreshAnimals();
    animate();
    window.addEventListener('resize', onResize);
  }

  function onResize(){
    const canvas=renderer.domElement; const w=canvas.clientWidth, h=canvas.clientHeight;
    if(!w||!h) return; camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  }

  function refreshPlots(){
    while(plotsGroup.children.length) plotsGroup.remove(plotsGroup.children[0]);
    while(cropsGroup.children.length) cropsGroup.remove(cropsGroup.children[0]);
    plotMeshes=[];
    ensurePlots();
    state.plots.forEach((p,i)=>{
      if(p.locked) return;
      const pos=plotWorldPos(p);
      const bed=box(1.15,0.22,1.15, p.watered?'#3e2723':'#5d4037', pos.x, 0.42, pos.z);
      bed.userData.plotIndex=i; plotsGroup.add(bed); plotMeshes.push(bed);
      if(p.cropId){
        let stage=0; if(p.ready) stage=2; else if(p.plantedAt){ const crop=CROPS[p.cropId]; const need=growSec(crop)*1000; const t=(Date.now()-p.plantedAt)/need; stage=t>0.45?1:0; }
        const crop=makeCropMesh(p.cropId, stage); crop.position.set(pos.x, 0.52, pos.z); crop.userData.plotIndex=i; cropsGroup.add(crop);
      }
    });
  }
  function refreshAnimals(){
    while(animalsGroup.children.length) animalsGroup.remove(animalsGroup.children[0]);
    state.animals.forEach((a,i)=>{
      const g=new THREE.Group();
      const col=a.type==='cow'?'#efebe9':a.type==='sheep'?'#f5f5f5':'#ffcc80';
      g.add(sph(0.35, col, 0, 0.45, 0));
      g.add(sph(0.22, col, 0.35, 0.55, 0));
      g.position.set(-4+(i%3)*1.4, 0.1, 5+((i/3)|0)*1.3);
      g.userData.animalIndex=i; animalsGroup.add(g);
    });
  }
  function refreshPests(){
    while(pestsGroup.children.length) pestsGroup.remove(pestsGroup.children[0]);
    state.pests.forEach(pe=>{
      const p=state.plots[pe.plot]; if(!p) return; const pos=plotWorldPos(p);
      const bug=sph(0.18,'#33691e', pos.x, 0.7, pos.z); bug.userData.pest=pe; pestsGroup.add(bug);
    });
  }

  function bindInput(canvas){
    const raycaster=new THREE.Raycaster(); const pointer=new THREE.Vector2();
    function setPointer(e){ const r=canvas.getBoundingClientRect(); const x=(e.clientX??e.touches?.[0]?.clientX); const y=(e.clientY??e.touches?.[0]?.clientY);
      pointer.x=((x-r.left)/r.width)*2-1; pointer.y=-((y-r.top)/r.height)*2+1; }
    function pick(){
      raycaster.setFromCamera(pointer, camera);
      const hits=raycaster.intersectObjects([...plotMeshes, ...pestsGroup.children, ...animalsGroup.children], true);
      if(!hits.length) return null;
      let o=hits[0].object; while(o && !o.userData.plotIndex && o.userData.plotIndex!==0 && !o.userData.pest && o.userData.animalIndex==null) o=o.parent;
      return o;
    }
    canvas.addEventListener('pointerdown', e=>{
      AudioFX.unlockAudio();
      if(e.pointerType==='touch' && e.isPrimary===false) return;
      dragging=true; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture(e.pointerId);
      canvas._downX=e.clientX; canvas._downY=e.clientY; canvas._moved=false;
    });
    canvas.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      if(Math.abs(e.clientX-canvas._downX)+Math.abs(e.clientY-canvas._downY)>10) canvas._moved=true;
      target.theta -= dx*0.007; target.phi = Math.max(0.35, Math.min(1.35, target.phi+dy*0.005));
    });
    canvas.addEventListener('pointerup', e=>{
      dragging=false;
      try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
      if(canvas._moved) return;
      setPointer(e); const o=pick();
      if(!o) return;
      if(o.userData.pest){ squashPest(o.userData.pest); return; }
      if(o.userData.animalIndex!=null){ collectAnimal(o.userData.animalIndex); return; }
      if(o.userData.plotIndex!=null){ onPlotTap(o.userData.plotIndex); }
    });
    canvas.addEventListener('wheel', e=>{ e.preventDefault(); target.dist=Math.max(8, Math.min(32, target.dist+e.deltaY*0.02)); }, {passive:false});
    // pinch
    let touchCache=[];
    canvas.addEventListener('touchstart', e=>{ touchCache=[...e.touches]; if(touchCache.length===2){ const d=Math.hypot(touchCache[0].clientX-touchCache[1].clientX, touchCache[0].clientY-touchCache[1].clientY); pinch0=d; }},{passive:true});
    canvas.addEventListener('touchmove', e=>{
      if(e.touches.length===2 && pinch0){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); target.dist=Math.max(8,Math.min(32, target.dist*(pinch0/d))); pinch0=d; e.preventDefault(); }
    },{passive:false});
  }

  function onPlotTap(i){
    const p=state.plots[i]; if(!p||p.locked) return;
    const pos=plotWorldPos(p);
    // drive tractor then act
    tractorTarget={x:pos.x-1.2, z:pos.z+1.0};
    pendingAction=()=>{
      if(state.tool==='water') waterPlot(i);
      else if(state.tool==='plant') plant(i);
      else if(p.ready) harvest(i);
      else if(p.cropId && !p.watered) waterPlot(i);
      else if(!p.cropId){ state.tool='plant'; if(!state.selectedCrop) state.selectedCrop='wheat'; plant(i); }
      else toast('Растёт…');
      AudioFX.ui();
    };
  }

  function updateDayNight(dt){
    const t=((Date.now()-state.cycleStart)%DAY_MS)/DAY_MS;
    const night=t>=0.55&&t<0.92;
    const dawn=t>=0.92||t<0.08;
    if(night){ sun.intensity=0.25; hemi.intensity=0.2; sun.color.setHex(0x90caf9); scene.fog.color.setHex(0x1a237e); scene.fog.density=0.012; }
    else if(dawn){ sun.intensity=0.7; hemi.intensity=0.4; sun.color.setHex(0xffab91); scene.fog.color.setHex(0xffcc80); scene.fog.density=0.014; }
    else { // day / golden
      sun.intensity=1.15; hemi.intensity=0.55; sun.color.setHex(0xffcc80); scene.fog.color.setHex(0xffb074); scene.fog.density=0.012;
    }
    const ang = t * Math.PI * 2;
    sun.position.set(Math.cos(ang)*14, 6+Math.sin(ang)*10, Math.sin(ang)*8);
    rain.visible = state.weather==='rain'||state.weather==='storm';
  }

  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(0.05, clock.getDelta());
    // smooth orbit
    cur.theta += (target.theta-cur.theta)*0.12;
    cur.phi += (target.phi-cur.phi)*0.12;
    cur.dist += (target.dist-cur.dist)*0.12;
    camera.position.set(
      look.x + cur.dist*Math.sin(cur.phi)*Math.cos(cur.theta),
      look.y + cur.dist*Math.cos(cur.phi),
      look.z + cur.dist*Math.sin(cur.phi)*Math.sin(cur.theta)
    );
    camera.lookAt(look.x, look.y, look.z);

    // wind sway trees
    const t=clock.elapsedTime;
    scene.traverse(o=>{ if(o.userData && o.userData.sway){ o.rotation.z=Math.sin(t*1.5+(o.parent&&o.parent.userData.wind||0))*0.06; }});

    // tractor drive
    if(tractorTarget){
      const dx=tractorTarget.x-tractor.position.x, dz=tractorTarget.z-tractor.position.z;
      const dist=Math.hypot(dx,dz);
      if(dist<0.15){ tractorTarget=null; if(pendingAction){ const fn=pendingAction; pendingAction=null; fn(); } }
      else { const sp=Math.min(6*dt, dist); tractor.position.x+=dx/dist*sp; tractor.position.z+=dz/dist*sp; tractor.rotation.y=Math.atan2(dx,dz); }
    } else {
      // idle bob
      tractor.position.y=0.15+Math.sin(t*2)*0.02;
    }

    // rain fall
    if(rain.visible){
      const pos=rain.geometry.attributes.position.array;
      for(let i=0;i<pos.length;i+=3){ pos[i+1]-=dt*(8+(state.weather==='storm'?6:0)); if(pos[i+1]<0) pos[i+1]=10+Math.random()*4; }
      rain.geometry.attributes.position.needsUpdate=true;
    }

    updateDayNight(dt);
    renderer.render(scene, camera);
    frames++; if(performance.now()-lastFps>500){ document.getElementById('fps').textContent=((frames*1000)/(performance.now()-lastFps)|0)+' fps'; frames=0; lastFps=performance.now(); }
  }

  return {init, refreshPlots, refreshAnimals, refreshPests, onResize};
})();

/* ---------- Tick / OTA / Start ---------- */
let lastCycleBucket=-1;
function setNight(on){if(on&&!state.nightActive){state.nightActive=true;toast('🌙 Ночь! Береги посевы');}if(!on&&state.nightActive){state.nightActive=false;state.pests.slice().forEach(removePest);state.scarecrows=Math.max(0,state.scarecrows-1);toast('☀️ Рассвет');}}
function tick(){updateGrowth();const night=isNight();setNight(night);if(night&&Math.random()<.035)spawnPest();const prog=((Date.now()-state.cycleStart)%DAY_MS)/DAY_MS;if(prog<.02&&lastCycleBucket>.5)advanceTimeChunk();lastCycleBucket=prog;AudioFX.updateWorldAudio();AudioFX.maybeAnimalIdle(state.animals);updateHUD();renderOrder();if(!tick._n)tick._n=0;tick._n++;if(tick._n%4===0)World3D.refreshPlots();if(Date.now()-state.lastSave>6000){state.lastSave=Date.now();save();}}

function cmpSemver(a,b){const pa=String(a||'0').split('.').map(n=>parseInt(n,10)||0);const pb=String(b||'0').split('.').map(n=>parseInt(n,10)||0);for(let i=0;i<3;i++){const d=(pa[i]||0)-(pb[i]||0);if(d)return d;}return 0;}
function getAppUpdatePlugin(){try{const C=window.Capacitor;if(!C)return null;if(C.Plugins&&C.Plugins.AppUpdate)return C.Plugins.AppUpdate;if(typeof C.registerPlugin==='function')return C.registerPlugin('AppUpdate');}catch(e){}return null;}
async function checkForUpdates(opts){opts=opts||{};const url=opts.manifestUrl||DEFAULT_MANIFEST_URL;if(!url||url.indexOf('PLACEHOLDER')>=0)return{skipped:true};let manifest;try{const res=await fetch(url+(url.indexOf('?')>=0?'&':'?')+'t='+Date.now(),{cache:'no-store',mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);manifest=await res.json();}catch(e){if(!opts.silent)toast('Нет обновлений');return{skipped:true};}
  const plugin=getAppUpdatePlugin(); let localCode=APP_VERSION.versionCode, localName=APP_VERSION.version, localWeb=APP_VERSION.webVersion;
  if(plugin&&plugin.getInfo){try{const info=await plugin.getInfo();localCode=info.versionCode||localCode;localName=info.versionName||localName;localWeb=info.webVersion||localWeb;}catch(e){}}
  if(manifest.webBundleUrl&&cmpSemver(manifest.webVersion||manifest.version,localWeb)>0){if(!opts.silent&&confirm((manifest.changelog||'Обновление')+'\nОбновить контент?')){if(plugin&&plugin.downloadAndApplyWebBundle){await plugin.downloadAndApplyWebBundle({url:manifest.webBundleUrl,webVersion:manifest.webVersion||manifest.version});location.reload();}else window.open(manifest.webBundleUrl,'_blank');}return{update:'web'};}
  const remoteCode=parseInt(manifest.versionCode,10)||0; const need=(remoteCode>localCode)||(cmpSemver(manifest.version,localName)>0);
  if(need&&manifest.apkUrl){if(!opts.silent&&confirm((manifest.changelog||'APK')+'\nСкачать APK?')){if(plugin&&plugin.downloadAndInstallApk)await plugin.downloadAndInstallApk({url:manifest.apkUrl});else window.open(manifest.apkUrl,'_blank');}return{update:'apk'};}
  if(!opts.silent)toast('Актуальная версия'); return{upToDate:true};
}

function renderAll(){renderZones();renderToolbar();updateHUD();renderOrder();document.getElementById('story').textContent=STORIES[state.storyIdx]||'';}
function startGame(){
  document.getElementById('intro').style.display='none';
  document.getElementById('topbar').style.display='flex';
  document.getElementById('zonebar').style.display='flex';
  document.getElementById('stage').style.display='block';
  document.getElementById('toolbar').style.display='flex';
  AudioFX.unlockAudio(); AudioFX.setMusicVol(state.musicVol); AudioFX.setSfxVol(state.sfxVol); AudioFX.setMuted(state.muted);
  refreshDay(); ensurePlots(); if(!state.weatherUntil) rollWeather();
  renderAll(); World3D.init(); World3D.onResize();
  AudioFX.updateWorldAudio(true);
  setInterval(tick, 500);
  setTimeout(()=>checkForUpdates({silent:true}).catch(()=>{}),1000);
  save();
}
document.getElementById('btn-start').onclick=()=>{localStorage.removeItem(SAVE_KEY); Object.assign(state,{coins:40,xp:0,level:1,heart:0,plots:[],animals:[],inventory:{},products:{},unlockedHybrids:[],storyIdx:0,ordersDone:0,cycleStart:Date.now()}); ensurePlots(); genOrder(); startGame();};
document.getElementById('btn-mute').onclick=()=>{AudioFX.unlockAudio();state.muted=!state.muted;AudioFX.setMuted(state.muted);updateHUD();save();};
document.getElementById('btn-market').onclick=()=>openMarket();
document.getElementById('btn-book').onclick=()=>openBook();
const hasSave=load();
if(hasSave){document.getElementById('btn-continue').style.display='block';document.getElementById('btn-continue').onclick=()=>{ensurePlots();refreshDay();startGame();};document.getElementById('btn-start').textContent='Новая игра';}

window.__FARM3D__={state,World3D,APP_VERSION,CROPS};
