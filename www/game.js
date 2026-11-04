
/* Ферма на краю света 3D — v1.4.0 */
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
const APP_VERSION={version: '1.4.1',versionCode: 14001,webVersion: '1.4.1'};
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
  let renderer, scene, camera, sun, hemi, island, plotsGroup, cropsGroup, animalsGroup, pestsGroup, tractor, rain, decorRoot, skyMat;
  let target={theta:0.55, phi:1.12, dist:40}, cur={theta:0.55, phi:1.12, dist:40}, look={x:0.3,y:0.2,z:0.0};
  let dragging=false, lastX=0, lastY=0, pinch0=0;
  let tractorTarget=null, pendingAction=null;
  let plotMeshes=[], clock, frames=0, lastFps=0;
  let templates={}, ready=false, loadPromise=null;
  const matCache={};
  const HIGH = (navigator.deviceMemory||4)>=3;
  const SHADOW = HIGH ? 2048 : 1024;

  function mat(color, opts){
    const key=color+JSON.stringify(opts||{});
    if(matCache[key]) return matCache[key];
    matCache[key]=toonMat(Object.assign({color}, opts||{}));
    return matCache[key];
  }
  function box(w,h,d,color,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); m.position.set(x||0,y||0,z||0); m.castShadow=true; m.receiveShadow=true; return m; }
  function cyl(r,h,color,x,y,z,seg){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||8), mat(color)); m.position.set(x||0,y||0,z||0); m.castShadow=true; m.receiveShadow=true; return m; }
  function sph(r,color,x,y,z){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,8), mat(color)); m.position.set(x||0,y||0,z||0); m.castShadow=true; return m; }


  // ---- v1.4 toon shading + world-space UVs ----
  let _grad=null;
  function gradMap(){ if(_grad) return _grad;
    const d=new Uint8Array([105,105,105,255, 150,150,150,255, 190,190,190,255, 210,210,210,255]);
    _grad=new THREE.DataTexture(d,4,1,THREE.RGBAFormat); _grad.minFilter=_grad.magFilter=THREE.NearestFilter; _grad.generateMipmaps=false; _grad.needsUpdate=true; return _grad; }
  function toonMat(o){ o=Object.assign({},o||{});
    ['roughness','metalness','roughnessMap','metalnessMap','envMap','flatShading'].forEach(k=>delete o[k]);
    if(o.normalMap===null) delete o.normalMap;
    o.gradientMap=gradMap(); return new THREE.MeshToonMaterial(o); }
  // Per-triangle box projection in world units (tile = metres per texture repeat). No stretching on any shape.
  function boxUV(geo, tile, scl){
    let g=geo.index?geo.toNonIndexed():geo.clone();
    const P=g.attributes.position, n=P.count, uv=new Float32Array(n*2);
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),N=new THREE.Vector3();
    const sx=(scl&&scl.x)||1, sy=(scl&&scl.y)||1, sz=(scl&&scl.z)||1;
    for(let i=0;i<n;i+=3){
      a.fromBufferAttribute(P,i); b.fromBufferAttribute(P,i+1); c.fromBufferAttribute(P,i+2);
      N.subVectors(c,b).cross(a.clone().sub(b)); const ax=Math.abs(N.x*sy*sz),ay=Math.abs(N.y*sx*sz),az=Math.abs(N.z*sx*sy);
      for(let k=0;k<3;k++){ const x=P.getX(i+k)*sx/tile, y=P.getY(i+k)*sy/tile, z=P.getZ(i+k)*sz/tile;
        let u,v; if(ay>=ax&&ay>=az){u=x;v=z;} else if(ax>=az){u=z;v=y;} else {u=x;v=y;}
        uv[(i+k)*2]=u; uv[(i+k)*2+1]=v; }
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.computeVertexNormals(); return g;
  }
  // Cylinder/cone: sides use arc-length (u*2πr) so the wrap seam lines up; caps planar.
  function cylUV(geo, tile, rTop, rBot, h){
    const P=geo.attributes.position, N=geo.attributes.normal, UV=geo.attributes.uv;
    for(let i=0;i<P.count;i++){
      if(Math.abs(N.getY(i))>0.85){ UV.setXY(i,P.getX(i)/tile,P.getZ(i)/tile); }
      else { const r=Math.max(rTop,rBot); const circ=Math.round(2*Math.PI*r/tile); UV.setXY(i,UV.getX(i)*circ,P.getY(i)/tile); }
    }
    UV.needsUpdate=true; return geo;
  }
  const _olCache=new WeakMap();
  function outlineGeo(geo){
    if(_olCache.has(geo)) return _olCache.get(geo);
    const g=geo.clone(), P=g.attributes.position, n=P.count, acc=new Map(), key=i=>Math.round(P.getX(i)*1e3)+'_'+Math.round(P.getY(i)*1e3)+'_'+Math.round(P.getZ(i)*1e3);
    if(!g.attributes.normal) g.computeVertexNormals();
    const Nn=g.attributes.normal;
    for(let i=0;i<n;i++){ const k=key(i); let v=acc.get(k); if(!v){ v=[0,0,0]; acc.set(k,v);} v[0]+=Nn.getX(i); v[1]+=Nn.getY(i); v[2]+=Nn.getZ(i); }
    const out=new Float32Array(n*3);
    for(let i=0;i<n;i++){ const v=acc.get(key(i)); const l=Math.hypot(v[0],v[1],v[2])||1; out[i*3]=v[0]/l; out[i*3+1]=v[1]/l; out[i*3+2]=v[2]/l; }
    g.setAttribute('normal',new THREE.BufferAttribute(out,3)); _olCache.set(geo,g); return g;
  }
  function addOutline(mesh, w){
        if(!mesh.isMesh||mesh.userData.outlined) return; mesh.userData.outlined=true;
    const m=new THREE.MeshBasicMaterial({color:0x2a1a10, side:THREE.BackSide});
    const ow=w||0.03; m.onBeforeCompile=sh=>{ sh.uniforms.olW={value:ow}; sh.vertexShader='uniform float olW;\n'+sh.vertexShader.replace('#include <begin_vertex>','vec3 transformed = position + normal * olW;'); };
    const ol=mesh.isSkinnedMesh?mesh.geometry:outlineGeo(mesh.geometry);
    let o;
    if(mesh.isSkinnedMesh){ o=new THREE.SkinnedMesh(ol,m); o.bind(mesh.skeleton, mesh.bindMatrix); }
    else o=new THREE.Mesh(ol,m);
    o.userData.outlined=true; o.userData.isOutline=true; o.castShadow=false; o.receiveShadow=false; o.raycast=()=>{}; o.frustumCulled=mesh.frustumCulled; mesh.add(o);
  }
  // --- PBR texture pack (CC0 ambientCG / Poly Haven + procedural fallbacks) ---
  const TEX={}; let texReady=false; let maxAniso=4;
  const matRefs=[]; // materials to refresh when maps load
  function confColorMap(t, rx, ry){
    if(!t) return t;
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry);
    t.anisotropy=maxAniso; t.encoding=THREE.sRGBEncoding; t.needsUpdate=true; return t;
  }
  function confDataMap(t, rx, ry){
    if(!t) return t;
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry);
    t.anisotropy=maxAniso; t.needsUpdate=true; return t;
  }
  function makeNoiseCanvas(size, paint){
    const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d'); paint(g,size); return c;
  }
  function soilTexture(){
    if(TEX.soil) return TEX.soil;
    if(_soilTex) return _soilTex;
    const c=makeNoiseCanvas(256,(g,s)=>{
      g.fillStyle='#8a5a32'; g.fillRect(0,0,s,s);
      for(let y=0;y<s;y+=10){
        const dark=y%20===0;
        g.fillStyle=dark?'#5c3318':'#b06a3a'; g.fillRect(0,y,s,dark?6:7);
        g.fillStyle='#3d1f0c'; g.fillRect(0,y+(dark?6:7),s,2);
        g.fillStyle='rgba(220,170,110,0.35)'; g.fillRect(0,y+1,s,2);
      }
      for(let i=0;i<140;i++){ g.fillStyle='rgba(160,90,40,'+(0.15+Math.random()*0.4)+')'; g.beginPath(); g.arc(Math.random()*s,Math.random()*s,1+Math.random()*2.5,0,6.28); g.fill(); }
    });
    _soilTex=confColorMap(new THREE.CanvasTexture(c), 1, 1); return _soilTex;
  }
  function grassTexture(){
    if(TEX.grass) return TEX.grass;
    if(_grassTex) return _grassTex;
    const c=makeNoiseCanvas(256,(g,s)=>{
      const base=g.createLinearGradient(0,0,s,s);
      base.addColorStop(0,'#5d9e2e'); base.addColorStop(0.5,'#3f8f2a'); base.addColorStop(1,'#6fad3a');
      g.fillStyle=base; g.fillRect(0,0,s,s);
      for(let i=0;i<1600;i++){
        const hues=['#7CB342','#558B2F','#9CCC65','#33691E','#AED581','#8BC34A'];
        g.fillStyle=hues[i%hues.length];
        g.fillRect(Math.random()*s, Math.random()*s, 1+Math.random()*2, 2+Math.random()*6);
      }
      for(let i=0;i<30;i++){ g.fillStyle='rgba(120,85,40,0.22)'; g.beginPath(); g.arc(Math.random()*s,Math.random()*s,6+Math.random()*14,0,6.28); g.fill(); }
    });
    _grassTex=confColorMap(new THREE.CanvasTexture(c), 1, 1); return _grassTex;
  }
  function woodTexture(){
    if(TEX.wood) return TEX.wood;
    if(_woodTex) return _woodTex;
    const c=makeNoiseCanvas(256,(g,s)=>{
      g.fillStyle='#8d6e4c'; g.fillRect(0,0,s,s);
      for(let x=0;x<s;x+=32){
        g.fillStyle=x%64===0?'#6d4c33':'#a1886a'; g.fillRect(x,0,30,s);
        g.strokeStyle='rgba(50,30,15,0.45)'; g.beginPath(); g.moveTo(x+30,0); g.lineTo(x+30,s); g.stroke();
        for(let i=0;i<18;i++){ g.strokeStyle='rgba(60,35,18,'+(0.15+Math.random()*0.25)+')'; g.beginPath(); g.moveTo(x+2+Math.random()*26, Math.random()*s); g.lineTo(x+2+Math.random()*26, Math.random()*s); g.stroke(); }
      }
    });
    _woodTex=confColorMap(new THREE.CanvasTexture(c), 1, 1); return _woodTex;
  }
  function pathTexture(){
    if(TEX.path) return TEX.path;
    if(_pathTex) return _pathTex;
    const c=makeNoiseCanvas(256,(g,s)=>{
      g.fillStyle='#9e9588'; g.fillRect(0,0,s,s);
      for(let y=0;y<s;y+=42) for(let x=0;x<s;x+=42){
        const ox=(Math.floor(y/42)%2)*21;
        g.fillStyle='rgb('+(130+Math.random()*40|0)+','+(125+Math.random()*35|0)+','+(115+Math.random()*30|0)+')';
        g.fillRect(x+ox+2,y+2,38,38);
        g.strokeStyle='rgba(70,60,50,0.55)'; g.strokeRect(x+ox+2,y+2,38,38);
      }
    });
    _pathTex=confColorMap(new THREE.CanvasTexture(c), 1, 1); return _pathTex;
  }
  function rockTexture(){
    if(TEX.rock) return TEX.rock;
    if(_rockTex) return _rockTex;
    const c=makeNoiseCanvas(256,(g,s)=>{
      g.fillStyle='#8a8076'; g.fillRect(0,0,s,s);
      for(let i=0;i<500;i++){ const v=90+Math.random()*80|0; g.fillStyle='rgb('+v+','+(v-5)+','+(v-12)+')'; g.beginPath(); g.arc(Math.random()*s,Math.random()*s,2+Math.random()*8,0,6.28); g.fill(); }
    });
    _rockTex=confColorMap(new THREE.CanvasTexture(c), 1, 1); return _rockTex;
  }
  function roofTexture(){
    if(TEX.roof) return TEX.roof;
    if(_roofTex) return _roofTex;
    const c=makeNoiseCanvas(256,(g,s)=>{
      g.fillStyle='#8c3030'; g.fillRect(0,0,s,s);
      for(let y=0;y<s;y+=16){ for(let x=0;x<s;x+=36){ const ox=(Math.floor(y/16)%2)*18; g.fillStyle='rgb('+(130+Math.random()*40|0)+','+(40+Math.random()*20|0)+','+(35+Math.random()*15|0)+')'; g.fillRect(x+ox,y,34,14); g.fillStyle='rgba(60,20,15,0.5)'; g.fillRect(x+ox,y+13,34,2);} }
    });
    _roofTex=confColorMap(new THREE.CanvasTexture(c), 1, 1); return _roofTex;
  }
  let _soilTex=null,_grassTex=null,_woodTex=null,_pathTex=null,_rockTex=null,_roofTex=null;

  function stdMat(opts){
    const m=toonMat(opts);
    matRefs.push(m); return m;
  }
  function loadTextures(){
    if(!renderer) return Promise.resolve();
    maxAniso=Math.min(8, renderer.capabilities.getMaxAnisotropy()||4);
    const loader=new THREE.TextureLoader();
    const jobs=[
      ['grass','assets/textures/grass_color.jpg',true,[1,1]],
      ['soil','assets/textures/soil_color.jpg',true,[1,1]],
      ['wood','assets/textures/wood_color.jpg',true,[1,1]],
      ['path','assets/textures/path_color.jpg',true,[1,1]],
      ['rock','assets/textures/rock_color.jpg',true,[1,1]],
      ['cliff','assets/textures/cliff_color.jpg',true,[1,1]],
      ['roof','assets/textures/roof_color.jpg',true,[1,1]],
      ['planks','assets/textures/planks_light.jpg',true,[1,1]],
      ['shingle','assets/textures/shingle_light.jpg',true,[1,1]],
      ['fur','assets/textures/fur_light.jpg',true,[1,1]],
      ['paint','assets/textures/paint_light.jpg',true,[1,1]],
    ];
    return Promise.all(jobs.map(([key,url,srgb,rep])=>new Promise(res=>{
      loader.load(url, t=>{
        if(srgb) confColorMap(t, rep[0], rep[1]); else confDataMap(t, rep[0], rep[1]);
        TEX[key]=t; res();
      }, undefined, err=>{ console.warn('tex fail',url); res(); });
    }))).then(()=>{ texReady=true; applyTexToMats(); });
  }
  function applyTexToMats(){
    // island materials stash
    if(islandMats.grass){
      if(TEX.grass){ islandMats.grass.map=TEX.grass; islandMats.grass.color.setHex(0xffffff); }
      if(TEX.grassN) islandMats.grass.normalMap=TEX.grassN;
      if(TEX.grassR){ islandMats.grass.roughnessMap=TEX.grassR; islandMats.grass.roughness=1; }
      islandMats.grass.normalScale && islandMats.grass.normalScale.set(0.85,0.85);
      islandMats.grass.needsUpdate=true;
    }
    if(islandMats.soil){
      if(TEX.soil){ islandMats.soil.map=TEX.soil; islandMats.soil.color.setHex(0xffffff); }
      if(TEX.soilN) islandMats.soil.normalMap=TEX.soilN;
      if(TEX.soilR){ islandMats.soil.roughnessMap=TEX.soilR; islandMats.soil.roughness=1; }
      if(islandMats.soil.normalScale) islandMats.soil.normalScale.set(1.1,1.1);
      islandMats.soil.needsUpdate=true;
    }
    if(islandMats.path){
      if(TEX.path){ islandMats.path.map=TEX.path; islandMats.path.color.setHex(0xffffff); }
      if(TEX.pathN) islandMats.path.normalMap=TEX.pathN;
      if(islandMats.path.normalScale) islandMats.path.normalScale.set(1.0,1.0);
      islandMats.path.needsUpdate=true;
    }
    if(islandMats.cliff){
      if(TEX.cliff){ islandMats.cliff.map=TEX.cliff; islandMats.cliff.color.setHex(0xffffff); }
      else if(TEX.rock){ islandMats.cliff.map=TEX.rock; islandMats.cliff.color.setHex(0xc4a882); }
      if(TEX.rockN) islandMats.cliff.normalMap=TEX.rockN;
      islandMats.cliff.needsUpdate=true;
    }
  }
  const islandMats={};

  function prepModel(root){
    root.traverse(o=>{
      if(o.isMesh){
        o.castShadow=true; o.receiveShadow=true;
        if(o.material){
          const mats=Array.isArray(o.material)?o.material:[o.material];
          mats.forEach(m=>{
            if(m.map) m.map.encoding=THREE.sRGBEncoding;
            m.side=THREE.FrontSide;
            if(m.isMeshBasicMaterial || (m.type==='MeshBasicMaterial')){
              const std=toonMat({
                map:m.map||null, color:m.color?m.color.clone():new THREE.Color(0xffffff),
                roughness:0.78, metalness:0.0, transparent:m.transparent, opacity:m.opacity, vertexColors:!!m.vertexColors
              });
              if(Array.isArray(o.material)){ const i=o.material.indexOf(m); o.material[i]=std; }
              else o.material=std;
              m=std;
            } else if(!m.isMeshToonMaterial){
              // Kenney nature packs ship metallic=1 (rendered dark under PBR); toon ignores metal, so pre-darken
              if(m.metalness>0.5 && m.color && !m.map){ const h={}; m.color.getHSL(h); const leaf=/leaf|grass|green/i.test(m.name||'');
                m.color.setHSL(leaf?Math.max(0,h.h-0.09):h.h, Math.min(1,h.s*1.1), h.l*0.42);
                const nm=m.name||'';
                if(/dirt/i.test(nm)) m.color.setHex(0x9c7a55).convertSRGBToLinear();
                else if(/bark|wood/i.test(nm)) m.color.setHex(0x8a5e3c).convertSRGBToLinear();
                m.userData.natural=/dirt|bark|wood/i.test(nm); }
              const t=toonMat({map:m.map||null, color:m.color?m.color.clone():new THREE.Color(0xffffff), transparent:m.transparent, opacity:m.opacity, vertexColors:!!m.vertexColors}); t.userData.natural=!!m.userData.natural;
              if(Array.isArray(o.material)){ const i=o.material.indexOf(m); o.material[i]=t; } else o.material=t;
              m=t;
            }
            // mild cheer under calibrated exposure (v1.3)
            if(m.color && !m.userData.natural){
              const hsl={h:0,s:0,l:0}; m.color.getHSL(hsl);
              m.color.setHSL(hsl.h, Math.min(1, hsl.s*1.18+0.04), Math.min(0.62, hsl.l*1.04+0.02));
            }
            if(m.emissive){ m.emissive.multiplyScalar(0); m.emissiveIntensity=0; }
          });
        }
      }
    });
    return root;
  }
  function fitHeight(obj, targetH){
    const box3=new THREE.Box3().setFromObject(obj);
    const size=new THREE.Vector3(); box3.getSize(size);
    if(size.y<0.001) return obj;
    const s=targetH/size.y; obj.scale.multiplyScalar(s);
    box3.setFromObject(obj); const min=box3.min;
    obj.position.y -= min.y; // sit on ground of parent
    return obj;
  }
  function cloneTpl(name, height){
    if(!templates[name]) return null;
    const c=templates[name].clone(true);
    if(height) fitHeight(c, height);
    return c;
  }

  function loadAll(){
    if(loadPromise) return loadPromise;
    const loader=new THREE.GLTFLoader();
    const jobs={
      tractor:'assets/models/car/tractor.glb',
      barn:'assets/models/quaternius/barn.glb',
      silo:'assets/models/quaternius/silo.glb',
      house:'assets/models/suburb/house-a.glb',
      houseB:'assets/models/suburb/house-h.glb',
      windmill:'assets/models/fantasy/windmill.glb',
      cart:'assets/models/fantasy/cart.glb',
      stall:'assets/models/fantasy/stall-red.glb',
      treeOak:'assets/models/nature/tree_oak.glb',
      treePine:'assets/models/nature/tree_pineTallA.glb',
      treeFat:'assets/models/nature/tree_fat.glb',
      treeDet:'assets/models/nature/tree_detailed.glb',
      treeCone:'assets/models/nature/tree_cone.glb',
      bush:'assets/models/nature/plant_bushDetailed.glb',
      bushL:'assets/models/nature/plant_bushLarge.glb',
      grass:'assets/models/nature/grass_large.glb',
      rockA:'assets/models/nature/rock_largeA.glb',
      rockB:'assets/models/nature/rock_largeB.glb',
      rockS:'assets/models/nature/rock_smallA.glb',
      fence:'assets/models/nature/fence_simple.glb',
      fenceC:'assets/models/nature/fence_corner.glb',
      fenceG:'assets/models/nature/fence_gate.glb',
      dirt:'assets/models/nature/crops_dirtRow.glb',
      carrot:'assets/models/nature/crop_carrot.glb',
      pumpkin:'assets/models/nature/crop_pumpkin.glb',
      turnip:'assets/models/nature/crop_turnip.glb',
      melon:'assets/models/nature/crop_melon.glb',
      wheatA:'assets/models/nature/crops_wheatStageA.glb',
      wheatB:'assets/models/nature/crops_wheatStageB.glb',
      cornA:'assets/models/nature/crops_cornStageA.glb',
      cornC:'assets/models/nature/crops_cornStageC.glb',
      cornD:'assets/models/nature/crops_cornStageD.glb',
      leafA:'assets/models/nature/crops_leafsStageA.glb',
      leafB:'assets/models/nature/crops_leafsStageB.glb',
      cow:'assets/models/quaternius/cow.glb',
      sheep:'assets/models/quaternius/sheep.glb',
      chicken:'assets/models/quaternius/chicken.glb',
      pig:'assets/models/quaternius/pig.glb',
      farmer:'assets/models/quaternius/farmer.glb',
      farmer2:'assets/models/quaternius/farmer.glb',
    };
    loadPromise=Promise.all(Object.entries(jobs).map(([k,url])=>new Promise(res=>{
      loader.load(url, gltf=>{ templates[k]=prepModel(gltf.scene); res(); }, undefined, err=>{ console.warn('GLB fail',url,err); res(); });
    }))).then(()=>{ ready=true; });
    return loadPromise;
  }

  function makeCloud(x,y,z,s){
    const g=new THREE.Group();
    const m=new THREE.MeshBasicMaterial({color:0xffe8d0, transparent:true, opacity:0.78, depthWrite:false, fog:false});
    if('toneMapped' in m) m.toneMapped=false;
    [[0,0,0,1.15],[1.1,0.2,0.2,0.9],[-1.0,0.15,-0.2,0.85],[0.45,0.45,-0.35,0.7],[-0.4,0.4,0.45,0.65],[0.2,-0.15,0.6,0.55]].forEach(([a,b,c,r])=>{
      const p=new THREE.Mesh(new THREE.SphereGeometry(r*s,10,8), m); p.position.set(a*s,b*s,c*s); p.castShadow=false; p.receiveShadow=false; g.add(p);
    });
    g.position.set(x,y,z); g.userData.cloud=true; return g;
  }

  function makeMountain(x,z,h,w,color){
    // Unlit tinted peaks — immune to sun bleach; fog provides depth
    const matM=new THREE.MeshBasicMaterial({color, fog:true});
    if('toneMapped' in matM) matM.toneMapped=true;
    const m=new THREE.Mesh(new THREE.ConeGeometry(w,h,7), matM);
    m.position.set(x,h*0.42,z); m.receiveShadow=false; m.castShadow=false; return m;
  }

  function makeIsland(){
    const g=new THREE.Group();
    const grassMat=stdMat({map:grassTexture(), roughness:0.92, metalness:0, color:0xffffff});
    grassMat.normalScale=new THREE.Vector2(0.85,0.85);
    islandMats.grass=grassMat;
    const top=new THREE.Mesh(cylUV(new THREE.CylinderGeometry(15,15.4,0.6,64),3.0,15,15.4,0.6), grassMat);
    top.position.y=0; top.receiveShadow=true; top.castShadow=false; g.add(top);
    const cliffMat=stdMat({map:rockTexture(), color:0xffffff, roughness:0.95, metalness:0});
    cliffMat.normalScale=new THREE.Vector2(1.2,1.2);
    islandMats.cliff=cliffMat;
    const cliff=new THREE.Mesh(cylUV(new THREE.CylinderGeometry(14.2,9.2,5.5,48),2.75,14.2,9.2,5.5), cliffMat);
    cliff.position.y=-2.85; cliff.receiveShadow=true; cliff.castShadow=true; g.add(cliff);
    const tip=new THREE.Mesh(cylUV(new THREE.ConeGeometry(7.5,4.4,40),2.75,0,7.5,4.4), stdMat({map:rockTexture(), color:0xa67c52, roughness:0.96})); tip.position.y=-6.7; tip.rotation.x=Math.PI; tip.castShadow=true; g.add(tip);
    // furrowed soil field
    const soilMat=stdMat({map:soilTexture(), roughness:0.96, metalness:0, color:0xffffff});
    soilMat.normalScale=new THREE.Vector2(1.15,1.15);
    islandMats.soil=soilMat;
    const soil=new THREE.Mesh(boxUV(new THREE.BoxGeometry(9.2,0.18,7.2),1.6), soilMat);
    soil.position.set(2.0,0.35,1.0); soil.receiveShadow=true; soil.castShadow=false; g.add(soil);
    // stone path
    const pathMat=stdMat({map:pathTexture(), roughness:0.9, metalness:0.02, color:0xffffff});
    pathMat.normalScale=new THREE.Vector2(1.0,1.0);
    islandMats.path=pathMat;
    const path=new THREE.Mesh(boxUV(new THREE.BoxGeometry(1.4,0.08,10),1.4), pathMat);
    path.position.set(-1.2,0.34,0); path.receiveShadow=true; g.add(path);
    return g;
  }

  function placeFenceRing(){
    const g=new THREE.Group();
    const posts=[];
    // rectangle around field
    const xs=[-2.5,6.5], zs=[-2.8,5.0];
    for(let x=xs[0]; x<=xs[1]; x+=1.1){
      posts.push([x, zs[0]], [x, zs[1]]);
    }
    for(let z=zs[0]+1.1; z<zs[1]; z+=1.1){
      posts.push([xs[0], z], [xs[1], z]);
    }
    posts.forEach(([x,z],i)=>{
      let f=cloneTpl('fence', 0.85);
      if(!f){
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.7,0.12), stdMat({map:woodTexture(), color:0xffffff, roughness:0.88}));
        post.position.set(0,0.35,0); post.castShadow=true; post.receiveShadow=true;
        const rail=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.08,0.08), stdMat({map:woodTexture(), color:0xffffff, roughness:0.88}));
        rail.position.set(0.5,0.5,0); rail.castShadow=true; rail.receiveShadow=true;
        const gg=new THREE.Group(); gg.add(post); gg.add(rail); f=gg;
      } else {
        f.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
      }
      f.position.set(x,0.05,z);
      if(Math.abs(x-xs[0])<0.01||Math.abs(x-xs[1])<0.01) f.rotation.y=Math.PI/2;
      g.add(f);
    });
    const gate=cloneTpl('fenceG', 1.0); if(gate){ gate.position.set(2.0,0.05,zs[1]); g.add(gate); }
    return g;
  }

  function scatterNature(){
    const g=new THREE.Group();
    const trees=[
      [8.5,6.5,'treeOak',2.8],[9.5,-3.2,'treePine',3.4],[-9.2,2.5,'treeFat',2.6],
      [-8.2,-6.5,'treeDet',2.9],[-4.5,8.2,'treeCone',2.4],[4.2,8.8,'treeOak',2.7],
      [10.5,2.2,'treePine',3.0],[-10.5,-1.5,'treeOak',2.5],[7.2,-7.2,'treeFat',2.4],
      [11.2,5.5,'treeCone',2.2],[-7.5,6.5,'treeDet',2.8],[3.5,-8.2,'treeOak',2.3],
      [-11.2,4.0,'treePine',3.1],[6.5,9.2,'treeCone',2.0],[-5.5,-8.5,'treeFat',2.5],
      [12,-1,'treeOak',2.4],[-12,0.5,'treeDet',2.7],[0.5,9.5,'treePine',2.9],
      [8,-8.5,'treeOak',2.2],[-3,9,'treeFat',2.4]
    ];
    trees.forEach(([x,z,k,h])=>{
      const t=cloneTpl(k,h)||makeFallbackTree(x,z,h/2.5);
      if(t.position) t.position.set(x,0.05,z); else { /* fallback already placed */ }
      if(templates[k]) { t.position.set(x,0.05,z); t.rotation.y=Math.random()*6.28; t.updateMatrixWorld(true); const s0=new THREE.Vector3(); const ms=[]; t.traverse(o=>{ if(o.isMesh) ms.push(o); }); ms.forEach(o=>{ o.getWorldScale(s0); addOutline(o,0.03/Math.max(s0.x,s0.y,s0.z,0.001)); }); g.add(t); }
      else g.add(t);
    });
    // bushes
    [[5,7],[ -6,5],[7.5,3],[-2,7.5],[9,-5],[-9,-4],[4,-7],[-5, -3]].forEach(([x,z],i)=>{
      const b=cloneTpl(i%2?'bushL':'bush', 0.7+Math.random()*0.4);
      if(b){ b.position.set(x,0.05,z); g.add(b); }
    });
    // rocks
    [[6.5,-4.5,1.2],[ -7,-5,1.4],[10,4,0.9],[ -10,3,1.1],[3,7.5,0.8],[8.5,7,1.0]].forEach(([x,z,h],i)=>{
      const r=cloneTpl(i%2?'rockA':'rockB', h);
      if(r){ r.position.set(x,0.05,z); r.rotation.y=Math.random()*3; g.add(r); }
    });
    // instanced grass tufts
    if(templates.grass){
      const proto=templates.grass;
      const N=90;
      // simple clones (instancing hard with multi-mesh gltf) — keep modest count
      for(let i=0;i<N;i++){
        const a=Math.random()*Math.PI*2, rad=3+Math.random()*11;
        const x=Math.cos(a)*rad, z=Math.sin(a)*rad;
        if(x> -2 && x<7 && z>-2.5 && z<5) continue; // skip field
        const c=proto.clone(true); fitHeight(c, 0.25+Math.random()*0.35);
        c.position.set(x,0.05,z); c.rotation.y=Math.random()*6; g.add(c);
      }
    }
    // hay stacks (procedural golden rolls)
    [[-5.5, -5.2],[-4.3,-5.5],[-4.8,-4.4],[5.8,-6.2],[6.6,-5.6],[7.2,-6.8]].forEach(([x,z],i)=>{
      const hay=new THREE.Group();
      for(let k=0;k<(i%2?2:3);k++){
        const roll=cyl(0.45,0.7,'#f9a825',k*0.55,0.45,0,10); roll.rotation.z=Math.PI/2; hay.add(roll);
      }
      hay.position.set(x,0.05,z); g.add(hay);
    });
    // decorative crop rows outside main plots (wheat / beets richness)
    for(let row=0; row<4; row++){
      for(let col=0; col<10; col++){
        const x=-11.5+col*0.5, z=-4.0+row*0.5;
        const w=cloneTpl(col%3===0?'wheatB':'wheatA', 0.6+Math.random()*0.3);
        if(w){ w.position.set(x,0.05,z); w.rotation.y=Math.random(); g.add(w); }
      }
    }
    // lush beet / carrot patch with oversized leafy tops
    for(let i=0;i<16;i++){
      const beet=makeCropMesh(i%3===0?'carrot':'potato', 2);
      beet.scale.multiplyScalar(1.35);
      beet.position.set(7.2+(i%6)*0.48, 0.35, -3.0+((i/6)|0)*0.55);
      g.add(beet);
    }
    for(let i=0;i<8;i++){
      const p=cloneTpl('pumpkin', 0.55+Math.random()*0.2);
      if(p){ p.position.set(5.5+(i%4)*0.7, 0.05, -7.0+((i/4)|0)*0.7); g.add(p); }
    }
    // flowers
    ['flower_redA','flower_yellowA','flower_purpleA'].forEach((fk,fi)=>{
      // templates may use bush as stand-in — procedural blooms
      for(let k=0;k<6;k++){
        const fl=new THREE.Group();
        const col=['#e53935','#ffeb3b','#ab47bc'][fi];
        fl.add(cyl(0.03,0.35,'#2e7d32',0,0.18,0,5));
        fl.add(sph(0.14,col,0,0.4,0));
        fl.position.set(-8+fi*1.2+k*0.45, 0.05, 7.2+(k%2)*0.35);
        g.add(fl);
      }
    });
    // low stone wall along back of field
    for(let i=0;i<12;i++){
      const st=cloneTpl(i%2?'rockS':'rockA', 0.35+Math.random()*0.25);
      if(st){ st.position.set(-2.2+i*0.75, 0.05, -3.2); st.rotation.y=Math.random(); g.add(st); }
      else {
        const b=box(0.7,0.4+Math.random()*0.25,0.45,'#9e9e9e', -2.2+i*0.75, 0.25, -3.2); g.add(b);
      }
    }
    // autumn tint on ~40% of trees already added
    g.children.forEach((ch,idx)=>{
      if(idx%5!==0) return;
      ch.traverse(o=>{
        if(o.isMesh&&o.material&&o.material.color&&!o.material.map){
          const m=o.material.clone(); const hsl={}; m.color.getHSL(hsl);
          if(hsl.h>0.2 && hsl.h<0.5){ // green foliage → autumn
            m.color.setHSL([0.08,0.12,0.02][idx%3], 0.85, 0.52);
            o.material=m;
          }
        }
      });
    });
    return g;
  }
  function makeFallbackTree(x,z,scale){
    const g=new THREE.Group();
    g.add(cyl(0.18*scale,1.2*scale,'#6d4c41',0,0.6*scale,0,6));
    const leaf=sph(0.85*scale,'#43a047',0,1.5*scale,0); leaf.userData.sway=true; g.add(leaf);
    g.position.set(x,0,z); return g;
  }

  function dressBuilding(root, outline, mode){
    mode=mode||'building';
    if(!root) return;
    root.updateMatrixWorld(true);
    const ws=new THREE.Vector3(), cache={};
    const bb=new THREE.Box3().setFromObject(root), H=bb.max.y-bb.min.y, yRoof=bb.min.y+H*0.5;
    const meshes=[]; root.traverse(o=>{ if(o.isMesh&&o.material&&!o.userData.isOutline) meshes.push(o); });
    meshes.forEach(o=>{
      if(o.isSkinnedMesh){ o.getWorldScale(ws); const ms=Array.isArray(o.material)?o.material:[o.material];
        const nm=ms.map(m=>{ const h={}; m.color.clone().convertLinearToSRGB().getHSL(h); const t=(h.l>0.12)?(mode==='paint'?TEX.paint:TEX.fur):null; return toonMat({color:m.color.clone(), map:t||null, vertexColors:!!m.vertexColors}); });
        const gg=boxUV(o.geometry, 0.45, ws); gg.groups=o.geometry.groups; o.geometry=gg; o.material=Array.isArray(o.material)?nm:nm[0]; o.castShadow=true; return; } // skinned: no inverted hull (bone-space scale is unreliable)
      o.castShadow=true; o.receiveShadow=true;
      o.getWorldScale(ws);
      const src=Array.isArray(o.material)?o.material:[o.material];
      const g0=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      const P=g0.attributes.position, UV=g0.attributes.uv, n=P.count;
      const groupsSrc=g0.groups.length?g0.groups:[{start:0,count:n,materialIndex:0}];
      const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),N=new THREE.Vector3(),wp=new THREE.Vector3();
      const tris=[]; // {i, key}
      groupsSrc.forEach(gr=>{
        const m=src[gr.materialIndex]||src[0]; const pix=atlasPixels(m.map);
        for(let i=gr.start;i<gr.start+gr.count;i+=3){
          let col=m.color?m.color.clone():new THREE.Color(1,1,1);
          if(pix&&UV){ const u=(UV.getX(i)+UV.getX(i+1)+UV.getX(i+2))/3, v=(UV.getY(i)+UV.getY(i+1)+UV.getY(i+2))/3;
            const px=Math.min(pix.w-1,Math.max(0,Math.floor(((u%1)+1)%1*pix.w))), py=Math.min(pix.h-1,Math.max(0,Math.floor((((v%1)+1)%1)*(m.map.flipY?-1:1)*pix.h+(m.map.flipY?pix.h:0))));
            const k=(py*pix.w+px)*4; const t=new THREE.Color(); t.setRGB(pix.d[k]/255,pix.d[k+1]/255,pix.d[k+2]/255); t.convertSRGBToLinear(); col.multiply(t); }
          a.fromBufferAttribute(P,i); b.fromBufferAttribute(P,i+1); c.fromBufferAttribute(P,i+2);
          N.subVectors(c,b).cross(a.clone().sub(b)).normalize().transformDirection(o.matrixWorld);
          wp.copy(a).add(b).add(c).multiplyScalar(1/3).applyMatrix4(o.matrixWorld);
          const hsl={}; col.clone().convertLinearToSRGB().getHSL(hsl);
          let cls='flat';
          if(mode==='building'){ if(N.y>0.3 && wp.y>yRoof) cls='roof'; else if(Math.abs(N.y)<0.5 && hsl.l<0.85) cls='wall'; }
          else if(mode==='fur'){ if(hsl.l>0.12) cls='fur'; }
          else if(mode==='paint'){ if(hsl.l>0.14) cls='paint'; }
          const q=col.clone().convertLinearToSRGB(); const key=cls+'_'+q.getHexString();
          tris.push([i,key,col,cls]);
        }
      });
      // rebuild geometry grouped by key, with box UVs in world units
      const keys=[...new Set(tris.map(t=>t[1]))];
      const pos=new Float32Array(n*3), mats=[]; let w=0; const g=new THREE.BufferGeometry();
      keys.forEach((key,mi)=>{
        const st=w; let info=null;
        tris.forEach(t=>{ if(t[1]!==key) return; info=t; for(let k=0;k<3;k++){ pos[(w)*3]=P.getX(t[0]+k); pos[w*3+1]=P.getY(t[0]+k); pos[w*3+2]=P.getZ(t[0]+k); w++; } });
        g.addGroup(st,w-st,mi);
        if(!cache[key]){
          const [,,col,cls]=info;
          const opt={color:col};
          if(cls==='roof') opt.map=TEX.shingle||roofTexture();
          else if(cls==='wall') opt.map=TEX.planks||woodTexture();
          else if(cls==='fur') opt.map=TEX.fur||null;
          else if(cls==='paint') opt.map=TEX.paint||null;
          cache[key]=toonMat(opt);
        }
        mats.push(cache[key]);
      });
      g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.computeVertexNormals();
      const ug=boxUV(g, mode==='building'?1.1:mode==='fur'?0.45:0.8, ws); ug.groups=g.groups;
      o.geometry=ug; o.material=mats;
      if(outline) addOutline(o, outline/Math.max(ws.x,ws.y,ws.z,0.001));
    });
  }
  function atlasPixels(tex){
    if(!tex||!tex.image) return null; if(tex.userData.pix) return tex.userData.pix;
    try{ const im=tex.image, cw=im.width, ch=im.height; const cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
      const cx=cv.getContext('2d'); cx.drawImage(im,0,0); tex.userData.pix={w:cw,h:ch,d:cx.getImageData(0,0,cw,ch).data}; return tex.userData.pix; }catch(e){ return null; }
  }
  function placeBuildings(){
    const g=new THREE.Group();
    const barn=cloneTpl('barn', 4.2);
    if(barn){ barn.position.set(-7.2,0.05,-5.0); barn.rotation.y=Math.PI*0.15; dressBuilding(barn,0.06); g.add(barn); }
    else {
      const fb=new THREE.Group(); fb.add(box(4.2,2.6,3.2,'#c62828',0,1.3,0));
      const roof=new THREE.Mesh(new THREE.ConeGeometry(3.2,1.4,4), stdMat({map:roofTexture(), color:0xffffff, roughness:0.8})); roof.position.y=3.2; roof.rotation.y=Math.PI/4; roof.castShadow=true; fb.add(roof);
      fb.position.set(-7.2,0.05,-5); g.add(fb);
    }
    const silo=cloneTpl('silo', 4.5);
    if(silo){ silo.position.set(-4.6,0.05,-6.2); dressBuilding(silo,0.06); g.add(silo); }
    const house=cloneTpl('house', 3.2);
    if(house){ house.position.set(-9.5,0.05,1.5); house.rotation.y=0.4; dressBuilding(house,0.06); g.add(house); }
    const house2=cloneTpl('houseB', 2.8);
    if(house2){ house2.position.set(-9.0,0.05,4.8); house2.rotation.y=-0.3; dressBuilding(house2,0.06); g.add(house2); }
    const wm=cloneTpl('windmill', 5.5);
    if(wm){ wm.position.set(9.5,0.05,-6.5); wm.rotation.y=-0.5; dressBuilding(wm,0.06); g.add(wm); }
    const stall=cloneTpl('stall', 2.0);
    if(stall){ stall.position.set(6.8,0.05,5.5); stall.rotation.y=Math.PI; g.add(stall); }
    const cart=cloneTpl('cart', 1.1);
    if(cart){ cart.position.set(5.2,0.05,4.8); cart.rotation.y=0.8; g.add(cart); }
    return g;
  }

  function makeTractorRig(){
    const g=new THREE.Group();
    const body=cloneTpl('tractor', 1.35);
    if(body){ body.traverse(o=>{ if(o.isMesh&&o.material){ o.material=toonMat({color:/wheel|tire/i.test(o.name||'')?0x222222:0x43a047}); }}); g.add(body); dressBuilding(body, 0.03, 'paint'); }
    else {
      g.add(box(1.6,0.7,1.0,'#43a047',0,0.85,0));
      g.add(box(0.7,0.55,0.85,'#42a5f5',-0.15,1.4,0));
    }
    // characters on / near tractor
    const chars=['farmer','farmer2'];
    chars.forEach((k,i)=>{
      const ch=cloneTpl(k, 1.15);
      if(ch){
        ch.position.set(-0.15 + i*0.05, body?1.05:1.55, 0.05);
        if(i===1) ch.visible=false; // one driver
        g.add(ch);
      }
    });
    // extra farmers beside
    [[-1.8,0.9,1.2],[1.6,0.9,0.8],[-0.5,0.9,-1.6]].forEach(([x,y,z],i)=>{
      const ch=cloneTpl(i%2?'farmer':'farmer2', 1.05+Math.random()*0.15);
      if(ch){ /* placed in decor instead */ }
    });
    g.position.set(-2.2,0.05,2.2);
    return g;
  }

  function placeCharacters(){
    const g=new THREE.Group();
    const spots=[[-0.6,3.8],[1.1,3.95],[2.8,3.85],[4.5,4.0]];
    // green / red / blue / purple — forced body tints (colormap tractors read grey otherwise)
    const bodyHex=[0x2e7d32,0xd50000,0x2962ff,0xaa00ff];
    const accentHex=[0xffea00,0xff9100,0x00e5ff,0xff4081];
    spots.forEach(([x,z],i)=>{
      const rig=new THREE.Group();
      const tr=cloneTpl('tractor', 1.3);
      if(tr){
        tr.rotation.y=Math.PI;
        let mi=0;
        tr.traverse(o=>{
          if(!o.isMesh||!o.material) return;
          const nm=(o.name||'').toLowerCase();
          const isWheel=/wheel|tire|rim/i.test(nm);
          const isPipe=/pipe|exhaust|chimney|stack/i.test(nm);
          const col = isWheel ? 0x1a1a1a : isPipe ? 0xffc107 : (mi++%3===1 ? accentHex[i] : bodyHex[i]);
          o.material=toonMat({color:col, roughness:isWheel?0.9:0.45, metalness:isPipe?0.4:0.05});
          o.castShadow=true; o.receiveShadow=true;
        });
        // bold body shell so color always reads
        const shell=box(1.15,0.5,0.85, '#'+bodyHex[i].toString(16).padStart(6,'0'), 0, 0.85, 0);
        shell.material=toonMat({color:bodyHex[i], roughness:0.4, metalness:0.08});
        const cab=box(0.5,0.42,0.55, '#'+accentHex[i].toString(16).padStart(6,'0'), -0.05, 1.35, 0);
        cab.material=toonMat({color:accentHex[i], roughness:0.45, metalness:0.05});
        [shell,cab].forEach(b=>{ b.geometry=boxUV(b.geometry,0.8); b.material.map=TEX.paint||null; b.material.needsUpdate=true; addOutline(b,0.03); });
        dressBuilding(tr, 0.03, 'paint');
        rig.add(tr); rig.add(shell); rig.add(cab);
      } else {
        rig.add(box(1.4,0.6,0.95,'#'+bodyHex[i].toString(16).padStart(6,'0'),0,0.75,0));
        rig.add(box(0.55,0.45,0.7,'#'+accentHex[i].toString(16).padStart(6,'0'),-0.1,1.3,0));
      }
      const ch=cloneTpl(i%2?'farmer':'farmer2', 1.05);
      if(ch){
        ch.traverse(o=>{ if(o.isMesh&&o.material&&o.material.color){ const m=o.material.clone(); const hsl={}; m.color.getHSL(hsl); m.color.setHSL(hsl.h, Math.min(1,hsl.s*1.4), Math.min(0.7,hsl.l*1.15)); o.material=m; }});
        ch.position.set(0,1.1,0.05); ch.rotation.y=Math.PI; rig.add(ch);
      }
      rig.position.set(x,0.05,z); rig.rotation.y=Math.PI + (i-1.5)*0.04; g.add(rig);
    });
    return g;
  }

  function cropKey(cropId, stage){
    if(cropId==='carrot'||cropId==='potato'||cropId==='frostroot') return stage>=2?'carrot':'leafB';
    if(cropId==='pumpkin'||cropId==='glow') return stage>=1?'pumpkin':'leafA';
    if(cropId==='melon'||cropId==='starmelon') return stage>=1?'melon':'leafA';
    if(cropId==='wheat'||cropId==='goldcorn') return stage>=2?'wheatB':stage>=1?'wheatA':'leafA';
    if(cropId==='corn') return stage>=2?'cornD':stage>=1?'cornC':'cornA';
    if(cropId==='tomato'||cropId==='berry'||cropId==='pepper'||cropId==='grape') return stage>=2?'turnip':'leafB';
    return stage>=2?'turnip':stage>=1?'leafB':'leafA';
  }

  function makeCropMesh(cropId, stage){
    const key=cropKey(cropId, stage);
    const m=cloneTpl(key, 0.35+stage*0.25);
    if(m){
      // beet-like boost for carrot/potato: tint leaves via emissive none, scale up
      if((cropId==='carrot'||cropId==='potato') && stage>=1) m.scale.multiplyScalar(1.15);
      return m;
    }
    // procedural beet / fallback
    const g=new THREE.Group();
    const c=CROPS[cropId]||{color:'#81c784'};
    const col=c.color||'#81c784';
    if(cropId==='carrot'||cropId==='potato'||cropId==='frostroot'){
      const bulbCol=cropId==='carrot'?'#ff6d00':'#d32f2f';
      const bulb=sph(0.38+stage*0.28, bulbCol, 0, 0.28+stage*0.12, 0); g.add(bulb);
      for(let i=0;i<8;i++){
        const ang=i/8*Math.PI*2;
        const leaf=box(0.14,0.85+stage*0.55,0.42,'#43a047', Math.cos(ang)*0.12, 0.75+stage*0.3, Math.sin(ang)*0.12);
        leaf.rotation.z=Math.cos(ang)*0.55; leaf.rotation.x=Math.sin(ang)*0.2; g.add(leaf);
        if(stage>=1){ const vein=box(0.04,0.65+stage*0.4,0.03,'#c62828', Math.cos(ang)*0.12, 0.8+stage*0.25, Math.sin(ang)*0.12); vein.rotation.z=Math.cos(ang)*0.55; g.add(vein); }
      }
    } else if(cropId==='wheat'||cropId==='corn'||cropId==='goldcorn'){
      for(let i=0;i<5;i++) g.add(cyl(0.03,0.4+stage*0.5, col, (i%2)*0.14-0.07, 0.25+stage*0.22, ((i/2)|0)*0.14-0.07, 5));
    } else {
      g.add(sph(0.15+stage*0.18, col, 0, 0.22+stage*0.12, 0));
      g.add(cyl(0.03,0.3+stage*0.25,'#2e7d32',0,0.28+stage*0.15,0,5));
    }
    return g;
  }

  function plotWorldPos(p){
    const originX=0.0, originZ=-0.5; const spacing=1.35;
    return {x: originX + p.col*spacing, z: originZ + p.row*spacing};
  }

  function buildDecor(){
    if(decorRoot) scene.remove(decorRoot);
    decorRoot=new THREE.Group();
    decorRoot.add(placeBuildings());
    decorRoot.add(placeFenceRing());
    decorRoot.add(scatterNature());
    decorRoot.add(placeCharacters());
    // standing farmers near barn
    [[-5.5,-3.5],[-6.8,-3.0],[-8.2, -2.2]].forEach(([x,z],i)=>{
      const ch=cloneTpl(i%2?'farmer':'farmer2', 1.1);
      if(ch){ ch.position.set(x,0.05,z); ch.rotation.y=Math.random()*3; decorRoot.add(ch); }
    });
    scene.add(decorRoot);
  }

  function init(){
    const canvas=document.getElementById('c3d');
    renderer=new THREE.WebGLRenderer({canvas, antialias:HIGH, powerPreference:'high-performance'});
    const pr=Math.min(window.devicePixelRatio||1, HIGH?1.75:1.35);
    renderer.setPixelRatio(pr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    if(renderer.physicallyCorrectLights!=null) renderer.physicallyCorrectLights=false;

    scene=new THREE.Scene();
    scene.fog=new THREE.Fog(0x6aa7d8, 55, 155);
    renderer.setClearColor(0x3f8fd8, 1);

    camera=new THREE.PerspectiveCamera(38, canvas.clientWidth/Math.max(1,canvas.clientHeight), 0.4, 220);

    // Soft AO feel: cooler/darker ground hemisphere + modest sky
    hemi=new THREE.HemisphereLight(0xffe8c8, 0x2e4520, 0.48); scene.add(hemi);
    sun=new THREE.DirectionalLight(0xffd29a, 1.4);
    sun.position.set(14, 20, 9); sun.castShadow=true;
    sun.shadow.mapSize.set(SHADOW, SHADOW);
    sun.shadow.camera.near=2; sun.shadow.camera.far=70;
    sun.shadow.camera.left=-18; sun.shadow.camera.right=18; sun.shadow.camera.top=18; sun.shadow.camera.bottom=-18;
    sun.shadow.bias=-0.0001; sun.shadow.normalBias=0.045; sun.shadow.radius=HIGH?2.2:1.6; scene.add(sun);
    scene.add(sun.target);
    sun.target.position.set(0,0,0);
    // Low ambient so PCF soft shadows stay visible on grass/soil
    scene.add(new THREE.AmbientLight(0xffe0b8, 0.18));
    const fill=new THREE.DirectionalLight(0x9ec9ff, 0.14); fill.position.set(-14,10,-12); scene.add(fill);
    const rim=new THREE.DirectionalLight(0xff8a65, 0.10); rim.position.set(-8,4,16); scene.add(rim);

    // Blue → warm sunset sky (richer mid blues, not washed white)
    const skyC=document.createElement('canvas'); skyC.width=8; skyC.height=256; const sg=skyC.getContext('2d');
    const grd=sg.createLinearGradient(0,0,0,256);
    grd.addColorStop(0,'#0a2f6b'); grd.addColorStop(0.22,'#1557a8'); grd.addColorStop(0.42,'#2f86d4');
    grd.addColorStop(0.58,'#6eb6ef'); grd.addColorStop(0.72,'#b7d7f5'); grd.addColorStop(0.84,'#ffc58a'); grd.addColorStop(1,'#ff8f4a');
    sg.fillStyle=grd; sg.fillRect(0,0,8,256);
    const skyTex=new THREE.CanvasTexture(skyC); skyTex.encoding=THREE.sRGBEncoding;
    skyMat=new THREE.MeshBasicMaterial({map:skyTex, side:THREE.BackSide, depthWrite:false, fog:false});
    if('toneMapped' in skyMat) skyMat.toneMapped=false;
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(160, 28, 18), skyMat));
    // soft warm clouds (less neon-white)
    [[-20,14,-24,5.5],[8,12,-28,6.2],[-4,16,-32,6.5],[22,11,-22,5.0],[14,15,-36,5.8],[-26,13,-18,4.5],[0,14,30,5.0],[18,12,26,4.4],[-10,17,-40,5.2],[26,10,-16,4.2]].forEach(a=>scene.add(makeCloud(...a)));

    island=makeIsland(); scene.add(island);
    // Distant mountains — earthy slate / violet, never near-white
    [[-18,-22,30,16,'#2f425a'],[-4,-26,36,18,'#24364c'],[10,-28,32,17,'#385370'],[22,-22,26,14,'#2c4058'],
     [-26,-14,24,13,'#4a3f58'],[2,-30,22,12,'#334860'],[28,-12,26,14,'#25364c'],[-12,-28,20,11,'#3e3854'],
     [14,-32,22,12,'#2e445c'],[-30,0,18,10,'#364a60'],[32,0,20,11,'#223044'],[0,-34,24,13,'#433c54']].forEach(a=>scene.add(makeMountain(...a)));

    plotsGroup=new THREE.Group(); scene.add(plotsGroup);
    cropsGroup=new THREE.Group(); scene.add(cropsGroup);
    animalsGroup=new THREE.Group(); scene.add(animalsGroup);
    pestsGroup=new THREE.Group(); scene.add(pestsGroup);

    // rain
    const rainCount=HIGH?500:280;
    const rainGeo=new THREE.BufferGeometry();
    const positions=new Float32Array(rainCount*3);
    for(let i=0;i<rainCount;i++){ positions[i*3]=(Math.random()-0.5)*30; positions[i*3+1]=Math.random()*14; positions[i*3+2]=(Math.random()-0.5)*30; }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    rain=new THREE.Points(rainGeo, new THREE.PointsMaterial({color:0xe3f2fd, size:0.05, transparent:true, opacity:0.55, depthWrite:false}));
    rain.visible=false; scene.add(rain);

    clock=new THREE.Clock();
    bindInput(canvas);
    // placeholder tractor until assets load
    tractor=makeTractorRig(); scene.add(tractor);
    refreshPlots(); refreshAnimals();
    animate();
    window.addEventListener('resize', onResize);

    Promise.all([loadTextures(), loadAll()]).then(()=>{
      // rebuild with real GLBs + textured island mats
      applyTexToMats();
      scene.remove(tractor);
      tractor=makeTractorRig(); scene.add(tractor);
      buildDecor();
      refreshPlots(); refreshAnimals();
    });
  }

  function onResize(){
    const canvas=renderer.domElement; const w=canvas.clientWidth, h=canvas.clientHeight;
    if(!w||!h) return; camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  }

  function refreshPlots(){
    if(!plotsGroup||!cropsGroup) return;
    while(plotsGroup.children.length) plotsGroup.remove(plotsGroup.children[0]);
    while(cropsGroup.children.length) cropsGroup.remove(cropsGroup.children[0]);
    plotMeshes=[];
    ensurePlots();
    state.plots.forEach((p,i)=>{
      if(p.locked) return;
      const pos=plotWorldPos(p);
      // warm soil pad (no pale Kenney dirt planks)
      let bed=box(1.2,0.2,1.2, p.watered?'#8d4e24':'#c4783c', pos.x, 0.42, pos.z);
      bed.geometry=boxUV(bed.geometry,1.2);
      bed.material=stdMat({map:soilTexture(), color:p.watered?0x8a6252:0xc8a890});
      if(bed.material.normalScale) bed.material.normalScale.set(1.0,1.0);
      bed.userData.plotIndex=i; plotsGroup.add(bed); plotMeshes.push(bed);
      if(p.watered){ const wet=box(1.05,0.02,1.05,'#3e2723', pos.x, 0.52, pos.z); wet.material=mat('#2c1810',{transparent:true,opacity:0.35}); plotsGroup.add(wet); }
      if(p.cropId){
        let stage=0; if(p.ready) stage=2; else if(p.plantedAt){ const crop=CROPS[p.cropId]; const need=growSec(crop)*1000; const t=(Date.now()-p.plantedAt)/need; stage=t>0.45?1:0; }
        const crop=makeCropMesh(p.cropId, stage); crop.position.set(pos.x, 0.48, pos.z); crop.userData.plotIndex=i;
        if(stage>=2){
          crop.scale.multiplyScalar(1.25);
          // harvest sparkles
          for(let s=0;s<4;s++){
            const sp=new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), new THREE.MeshBasicMaterial({color:0xfff59d, transparent:true, opacity:0.9}));
            sp.position.set((Math.random()-0.5)*0.5, 0.5+Math.random()*0.5, (Math.random()-0.5)*0.5);
            sp.userData.sparkle=true; crop.add(sp);
          }
          crop.traverse(o=>{ if(o.isMesh&&o.material&&o.material.emissive){ o.material=o.material.clone(); o.material.emissive=new THREE.Color(0xffe082); o.material.emissiveIntensity=0.12; }});
        }
        cropsGroup.add(crop);
      }
    });
  }
  function refreshAnimals(){
    if(!animalsGroup) return;
    while(animalsGroup.children.length) animalsGroup.remove(animalsGroup.children[0]);
    // default showcase animals if none owned yet (visual richness); interactive ones from state
    const showcase=[{type:'cow'},{type:'sheep'},{type:'chicken'},{type:'pig'},{type:'chicken'}];
    const list=state.animals.length?state.animals:showcase;
    list.forEach((a,i)=>{
      const key=a.type==='cow'?'cow':a.type==='sheep'?'sheep':a.type==='chicken'?'chicken':'pig';
      let g=cloneTpl(key, a.type==='cow'?1.3:a.type==='sheep'?0.9:a.type==='pig'?0.7:0.45);
      if(!g){
        g=new THREE.Group();
        const col=a.type==='cow'?'#efebe9':a.type==='sheep'?'#f5f5f5':'#ffcc80';
        g.add(sph(0.35, col, 0, 0.45, 0));
      }
      g.position.set(-5.5+(i%3)*1.6, 0.05, 5.5+((i/3)|0)*1.5);
      if(g.children.length) dressBuilding(g, 0.025, 'fur');
      g.rotation.y=Math.random()*2;
      g.userData.animalIndex=state.animals.length?i:undefined;
      animalsGroup.add(g);
    });
  }
  function refreshPests(){
    if(!pestsGroup) return;
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
      let o=hits[0].object; while(o && o.userData.plotIndex==null && !o.userData.pest && o.userData.animalIndex==null) o=o.parent;
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
      target.theta -= dx*0.007; target.phi = Math.max(0.55, Math.min(1.35, target.phi+dy*0.005));
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
    canvas.addEventListener('wheel', e=>{ e.preventDefault(); target.dist=Math.max(18, Math.min(52, target.dist+e.deltaY*0.03)); }, {passive:false});
    let touchCache=[];
    canvas.addEventListener('touchstart', e=>{ touchCache=[...e.touches]; if(touchCache.length===2){ const d=Math.hypot(touchCache[0].clientX-touchCache[1].clientX, touchCache[0].clientY-touchCache[1].clientY); pinch0=d; }},{passive:true});
    canvas.addEventListener('touchmove', e=>{
      if(e.touches.length===2 && pinch0){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); target.dist=Math.max(18,Math.min(52, target.dist*(pinch0/d))); pinch0=d; e.preventDefault(); }
    },{passive:false});
  }

  function onPlotTap(i){
    const p=state.plots[i]; if(!p||p.locked) return;
    const pos=plotWorldPos(p);
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
    if(night){
      sun.intensity=0.35; hemi.intensity=0.28; sun.color.setHex(0xa0c8ff);
      scene.fog.color.setHex(0x1c2e58); scene.fog.near=30; scene.fog.far=120;
      renderer.toneMappingExposure=0.85; renderer.setClearColor(0x0e1a36,1);
    } else if(dawn){
      sun.intensity=1.05; hemi.intensity=0.48; sun.color.setHex(0xffb090);
      scene.fog.color.setHex(0xe0a878); scene.fog.near=45; scene.fog.far=140;
      renderer.toneMappingExposure=0.98; renderer.setClearColor(0x7eb3df,1);
    } else {
      sun.intensity=1.38; hemi.intensity=0.48; sun.color.setHex(0xffd29a);
      scene.fog.color.setHex(0x6aa7d8); scene.fog.near=60; scene.fog.far=165;
      renderer.toneMappingExposure=1.05; renderer.setClearColor(0x3f8fd8,1);
    }
    if(night) sun.position.set(-16, 16, -10);
    else if(dawn) sun.position.set(20, 12, 8);
    else sun.position.set(14, 20, 9);
    rain.visible = state.weather==='rain'||state.weather==='storm';
  }

  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(0.05, clock.getDelta());
    cur.theta += (target.theta-cur.theta)*0.1;
    cur.phi += (target.phi-cur.phi)*0.1;
    cur.dist += (target.dist-cur.dist)*0.1;
    camera.position.set(
      look.x + cur.dist*Math.sin(cur.phi)*Math.cos(cur.theta),
      look.y + cur.dist*Math.cos(cur.phi),
      look.z + cur.dist*Math.sin(cur.phi)*Math.sin(cur.theta)
    );
    camera.lookAt(look.x, look.y, look.z);

    const t=clock.elapsedTime;
    scene.traverse(o=>{ if(o.userData && o.userData.sway){ o.rotation.z=Math.sin(t*1.5+(o.parent&&o.parent.userData.wind||0))*0.06; }
      if(o.userData && o.userData.sparkle){ o.position.y += Math.sin(t*4+o.id)*0.002; o.material.opacity=0.55+0.4*Math.sin(t*5+o.id); }});
    // drift clouds slowly
    scene.children.forEach(o=>{ if(o.userData&&o.userData.cloud){ o.position.x += dt*0.15; if(o.position.x>40) o.position.x=-40; }});

    if(tractorTarget && tractor){
      const dx=tractorTarget.x-tractor.position.x, dz=tractorTarget.z-tractor.position.z;
      const dist=Math.hypot(dx,dz);
      if(dist<0.15){ tractorTarget=null; if(pendingAction){ const fn=pendingAction; pendingAction=null; fn(); } }
      else { const sp=Math.min(6*dt, dist); tractor.position.x+=dx/dist*sp; tractor.position.z+=dz/dist*sp; tractor.rotation.y=Math.atan2(dx,dz); }
    } else if(tractor) {
      tractor.position.y=0.05+Math.sin(t*2)*0.015;
    }

    if(rain.visible){
      const pos=rain.geometry.attributes.position.array;
      for(let i=0;i<pos.length;i+=3){ pos[i+1]-=dt*(8+(state.weather==='storm'?6:0)); if(pos[i+1]<0) pos[i+1]=10+Math.random()*4; }
      rain.geometry.attributes.position.needsUpdate=true;
    }

    updateDayNight(dt);
    renderer.render(scene, camera);
    frames++; if(performance.now()-lastFps>500){ const el=document.getElementById('fps'); if(el) el.textContent=((frames*1000)/(performance.now()-lastFps)|0)+' fps'; frames=0; lastFps=performance.now(); }
  }

  return {init, refreshPlots, refreshAnimals, refreshPests, onResize};
})();


/* ---------- Tick / OTA / Start ---------- */
let lastCycleBucket=-1;
function setNight(on){if(on&&!state.nightActive){state.nightActive=true;toast('🌙 Ночь! Береги посевы');}if(!on&&state.nightActive){state.nightActive=false;state.pests.slice().forEach(removePest);state.scarecrows=Math.max(0,state.scarecrows-1);toast('☀️ Рассвет');}}
function tick(){updateGrowth();const night=isNight();setNight(night);if(night&&Math.random()<.035)spawnPest();const prog=((Date.now()-state.cycleStart)%DAY_MS)/DAY_MS;if(prog<.02&&lastCycleBucket>.5)advanceTimeChunk();lastCycleBucket=prog;AudioFX.updateWorldAudio();AudioFX.maybeAnimalIdle(state.animals);updateHUD();renderOrder();if(!tick._n)tick._n=0;tick._n++;if(tick._n%16===0)World3D.refreshPlots();if(Date.now()-state.lastSave>6000){state.lastSave=Date.now();save();}}

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
