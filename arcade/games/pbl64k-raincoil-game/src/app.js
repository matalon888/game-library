import { Game, W, H } from './engine.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { VARIANTS, migrateRecords, recordKey } from './variants.js';
const $ = id => document.getElementById(id);
const canvas = $('game'), renderer = new Renderer(canvas), sound = new Sound();
let saved = {}; try { saved = JSON.parse(localStorage.getItem('raincoil.v1') || '{}') || {}; } catch (_) {}
saved.best = saved.best || {storm:0,endless:0};
saved.records = migrateRecords(saved);
let selectedVariant = VARIANTS[saved.variant] ? saved.variant : 'cadence';
let selectedRelaxed = saved.relaxed === true;
sound.music = typeof saved.music === 'number' ? saved.music : .35;
sound.sfx = typeof saved.sfx === 'number' ? saved.sfx : .65;
renderer.reduced = saved.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
let game = new Game(), state = 'menu', previousState = 'menu', lastMode = 'storm', elapsed = 0, lastFrame = performance.now(), countdown = 0, toastUntil = 0, lastPhase = -1, resultShown = false;
let trainingStep = 0, trainingClock = 0, trainingDrop = 0, hudClock = 0, lastHit = '';
const overlays = ['menu','pause-overlay','result-overlay'];
function persist() { saved.music = sound.music; saved.sfx = sound.sfx; saved.reduced = renderer.reduced; try { localStorage.setItem('raincoil.v1', JSON.stringify(saved)); } catch (_) {} }
function visibleOverlay(id) { for (const name of overlays) $(name).classList.toggle('hidden', name !== id); }
function toast(text, seconds=1.7) { $('toast').textContent=text; $('toast').classList.add('show'); toastUntil=elapsed+seconds; }
function focusGame() { canvas.focus({preventScroll:true}); }
function clearEffects() { renderer.particles=[];renderer.rings=[];renderer.labels=[];renderer.flash=0;renderer.shake=0; }
function freshSeed() { return (Date.now() ^ Math.floor(Math.random()*0xffffffff)) >>> 0; }
function start(mode='storm', variant=selectedVariant) {
  selectedVariant=VARIANTS[variant]?variant:'cadence';saved.variant=selectedVariant;persist();
  sound.unlock();sound.event('start');lastMode=mode;game=new Game({mode,variant:selectedVariant,relaxed:selectedRelaxed,seed:freshSeed()});state='playing';countdown=2.8;resultShown=false;lastPhase=-1;lastHit='';clearEffects();
  visibleOverlay(null);$('training').classList.add('hidden');$('mode-label').textContent=`${VARIANTS[selectedVariant].name}${game.relaxed?' / RELAXED':''} / ${mode==='storm'?`${180/game.speed} SECONDS`:'ENDLESS'}`;$('time-label').textContent=mode==='storm'?'STORM REMAINING':'TIME IN THE RAIN';
  $('board-caption').textContent='ARROWS / WASD TO STEER · SPACE TO SHED';$('status-caption').textContent='PIGMENT SYSTEM ONLINE';toast('READY YOUR COIL',1);focusGame();updateHUD();
}
function menu() {
  state='menu';sound.active=false;visibleOverlay('menu');$('training').classList.add('hidden');$('mode-label').textContent='STORM CHAMBER';$('time-label').textContent='STORM REMAINING';$('phase-label').textContent='AWAITING SIGNAL';$('board-caption').textContent='COLOR IS A WAY OUT.';$('status-caption').textContent='ALL SYSTEMS DREAMING';$('toast').classList.remove('show');clearEffects();updateHUD();
}
function pause() { if(state!=='playing'&&state!=='training')return;previousState=state;state='paused';sound.active=false;visibleOverlay('pause-overlay');$('training').classList.add('hidden');$('resume-button').focus(); }
function resume() { if(state!=='paused')return;state=previousState;visibleOverlay(null);$('training').classList.toggle('hidden',state!=='training');focusGame(); }
function finish() {
  if(resultShown)return;resultShown=true;state='result';sound.active=false;visibleOverlay('result-overlay');
  const won=game.status==='won', key=recordKey(game.variant,lastMode,game.relaxed), best=saved.records[key]||0, record=game.score>best;
  if(record){saved.records[key]=game.score;persist();}
  $('result-stamp').textContent=won?'STORM PASSED / LIFE REMAINS':'SIGNAL LOST / THE RAIN REMEMBERS';
  $('result-title').innerHTML=won?'STILL<br><span>ALIVE.</span>':'COME<br><span>BACK GREEN.</span>';
  $('result-copy').textContent=won?'You made room for a little life. The chamber is yours.':lastHit==='wall'?'The walls got close. Turn early, and keep a little tail for emergencies.':lastHit==='body'?'Your own coil closed the door. Leave space for your next turn.':lastHit==='skin'?'An afterimage closed the route. Paint its links into a match to reclaim it.':'The stone caught up. Clear color near the rubble to reclaim space.';
  $('result-score').textContent=game.score.toLocaleString();
  $('result-metrics').innerHTML=`<div><b>${formatTime(game.time/game.speed)}</b>SURVIVED</div><div><b>${game.stats.clears+(game.stats.skinClears||0)}</b>BURSTS</div><div><b>${game.stats.skinClears||0}</b>SKIN BURSTS</div>`;
  if(record)$('result-stamp').textContent+=' / PERSONAL BEST';
  $('result-stamp').textContent=`${VARIANTS[game.variant].name}${game.relaxed?' / RELAXED':''} / `+$('result-stamp').textContent;
  $('again-button').innerHTML=(lastMode==='storm'?'ONE MORE STORM':'BACK TO ENDLESS')+' <span>↗</span>';
  $('board-caption').textContent=won?'SOME THINGS GROW BACK.':'THE NEXT RUN IS A FRESH START.';$('again-button').focus();updateHUD();
}
function tryShed() {
  if(state!=='playing'&&state!=='training')return;if(countdown>0&&state==='playing')return;
  sound.unlock();if(!game.shed()){toast(game.snake.length<9?'SHED NEEDS 9 LINKS':`SHED RECHARGING · ${Math.ceil(game.shedCooldown/game.speed)}s`,1.2);sound.tone(90,70,.09,.08,'triangle');}
}
function steer(dx,dy){if(state==='playing'||state==='training'){sound.unlock();game.turn(dx,dy);}}
function formatTime(seconds){const n=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
const phases=[['LIGHT RAIN','Find a color. Catch it twice.'],['CROSSFALL','Lay your body across the rain.'],['HEAVY WEATHER','Bursts make room in the rubble.'],['HIGH PRESSURE','Keep an escape route open.'],['ELECTRIC SKY','Save a little tail for a shed.'],['LAST FRONT','Hold together. Almost daylight.']];
function updateHUD() {
  const idle=state==='menu', training=state==='training'||state==='paused'&&previousState==='training';
  const variant=idle?selectedVariant:game.variant;
  const relaxed=idle?selectedRelaxed:game.relaxed, speed=idle?(selectedRelaxed?.6:1):game.speed;
  $('chosen-variant').textContent=VARIANTS[selectedVariant].name+(selectedRelaxed?' / RELAXED':'');
  document.querySelector('.menu-copy').innerHTML=`A living fuse. A sky full of color.<br>${selectedRelaxed?'Five minutes. A little more breathing room.':'Three minutes to hold it together.'}`;
  $('score').textContent=String(idle?0:game.score).padStart(5,'0');$('best').textContent=(saved.records[recordKey(variant,idle?'storm':lastMode,relaxed)]||0).toLocaleString();
  const seconds=(idle?180:game.mode==='endless'?game.time:180-game.time)/speed;
  $('time').innerHTML=formatTime(seconds).replace(':','<span>:</span>');$('time-progress').style.width=(idle?100:Math.max(0,100-game.time/1.8))+'%';
  $('length').textContent=idle?12:game.snake.length;$('combo').textContent='×'+Math.max(1,game.combo);
  $('hearts').innerHTML=Array.from({length:relaxed?5:3},(_,i)=>`<i${i>=(idle?(relaxed?5:3):game.health)?' class="empty"':''}>✦</i>`).join('');
  const ready=!idle&&game.snake.length>=9&&game.shedCooldown<=0;
  $('shed-button').classList.toggle('ready',ready);$('shed-button').disabled=!(state==='playing'||state==='training');
  $('shed-state').textContent=idle?'4 LINKS → BREATHING ROOM':game.shedCooldown>0?`RECHARGING ${(game.shedCooldown/game.speed).toFixed(1)}s`:game.snake.length<9?`NEED ${9-game.snake.length} MORE LINKS`:'READY / SHED 4 LINKS';
  $('shed-progress').style.width=(game.shedCooldown>0?100*(1-game.shedCooldown/6):Math.min(100,game.snake.length/9*100))+'%';
  const phase=Math.min(5,Math.floor(game.time/30));
  const patterned=variant!=='wild', phrase=!idle&&game.phrase;
  $('weather').textContent=idle?VARIANTS[variant].name:phrase?phrase.name:training?'TRAINING CLOUD':game.mode==='endless'&&game.time>=180?'PERMANENT STORM':phases[phase][0];
  const patternHints={sweep:'Neighboring columns. Follow the color across.',echo:'Same column, three returns. Leave a pair beneath it.',fork:'Out, then back. Be ready for the returning color.'};
  $('weather-copy').textContent=idle?VARIANTS[variant].hint:phrase?patternHints[phrase.kind]:training?'A safe space to get your bearings.':phases[phase][1];
  const glyphs=['●','◆','−'],colors=['#ff7b70','#79ceff','#e3f67b'];
  $('phrase-preview').innerHTML=phrase?phrase.columns.map((x,i)=>`<i class="${game.forecast.some(n=>n.index===i)?'':'past'}" style="color:${colors[phrase.color]}" title="Note ${i+1}, column ${x+1}">${glyphs[phrase.color]}</i>${i<2?`<span>${phrase.columns[i+1]===x?'↻':phrase.columns[i+1]>x?'→':'←'}</span>`:''}`).join(''):'';
  $('skin-count').classList.toggle('hidden',variant!=='afterimage'||idle);
  $('skin-count').textContent=`${game.skins?.length||0} SKINS / ${game.stats.skinClears||0} RECLAIMED`;
  document.querySelector('.shed-hint').textContent=variant==='afterimage'?'Shed 4 links. Leave a collector. Match it before it blocks your route.':'Trade 4 links for a clearing and a moment of safety.';
  if(!idle&&patterned&&!training)$('board-caption').textContent=`${phrase?.name||'READ THE FORECAST'} · ${variant==='afterimage'?`${game.skins.length} SKINS / MATCH 3 TO CLEAR`:'NUMBERED SIGNALS SHOW THE NEXT DROPS'}`;
  if(!idle&&state!=='paused')$('phase-label').textContent=training?'NO PRESSURE':`FRONT ${Math.min(6,phase+1)} / 6`;
}
const lessons=[
  ['A LITTLE LIFE.','Your coil keeps moving. Use arrows or WASD to turn. Avoid walls, your tail, and stone. Try a few turns here: this chamber is safe.'],
  ['COLOR WANTS COMPANY.','Watch the two drops. Each paints two links where it hits. Three matching neighbors burst, and your tail pulls shorter. Different colors can overwrite a useful pair.'],
  ['NOTHING DISAPPEARS FOR FREE.','Rain you miss becomes stone. Watch it stack on the right. A matching burst on the left clears nearby stone as well as your tail. Fight for open space.'],
  ['SPEND A LITTLE OF YOURSELF.','Press SPACE or tap SHED. Trade four links for a clearing and a brief shield. You need at least nine links. In the storm, your body grows back over time.']
];
const extraLessons=[
  ['THE WEATHER HAS A MEMORY.','Watch the numbered signals: three drops, one color. Sweep crosses columns, Echo repeats, Fork goes out and back. Plan for the returning color while you keep moving.'],
  ['LEAVE A LITTLE LIFE BEHIND.','Press SPACE. Four tail links stay behind as a skin. Repeated color soaks farther along it: match three to dissolve it. Ghosted skins let you leave safely; solid skins block your route.']
];
function currentLessons(){return [...lessons,...extraLessons.slice(0,selectedVariant==='wild'?0:selectedVariant==='cadence'?1:2)];}
function learn(){sound.unlock();state='training';countdown=0;trainingStep=0;visibleOverlay(null);$('training').classList.remove('hidden');setupLesson();focusGame();}
function setupLesson(){
  game=new Game({practice:trainingStep!==4,variant:trainingStep>=4?selectedVariant:'wild',relaxed:selectedRelaxed,seed:101});game.invulnerable=999;game.growthTimer=999;trainingClock=0;trainingDrop=0;clearEffects();
  if(trainingStep>0){game.snake=Array.from({length:12},(_,i)=>({x:15-i,y:9,color:-1}));game.previousSnake=game.snake.map(p=>({...p}));game.moveAccumulator=-1000;}
  if(trainingStep===2){for(let x=7;x<=13;x++)game.debris.push({x,y:11,color:x%3});}
  if(trainingStep===3){for(const [x,y]of [[16,9],[15,10],[16,10],[15,8],[16,8],[17,9]])game.debris.push({x,y,color:(x+y)%3});}
  if(trainingStep===5){game.snake[8].color=0;game.snake[9].color=0;for(let x=4;x<=7;x++)game.debris.push({x,y:11,color:1});}
  const activeLessons=currentLessons();
  $('training-step').textContent=`FIRST RAIN / ${trainingStep+1} OF ${activeLessons.length}`;$('training-title').textContent=activeLessons[trainingStep][0];$('training-copy').textContent=activeLessons[trainingStep][1];$('training-next').textContent=trainingStep===activeLessons.length-1?'ENTER THE STORM ↗':'GOT IT / NEXT ↗';
  $('mode-label').textContent='FIRST RAIN / SAFE CHAMBER';$('board-caption').textContent=trainingStep===0?'TRY THE ARROW KEYS. YOU CANNOT LOSE HERE.':'LIVE DEMONSTRATION / NO DAMAGE';updateHUD();
}
function trainingTick(dt){
  trainingClock+=dt*game.speed;game.invulnerable=999;
  if(trainingStep===1||trainingStep===2){
    if(trainingClock>1&&trainingDrop===0){game.spawnDrop(12,0,0,0);trainingDrop=1;}
    if(trainingClock>2.2&&trainingDrop===1){game.spawnDrop(11,0,0,0);trainingDrop=2;}
    if(trainingStep===2&&trainingClock>trainingDrop*.65&&trainingDrop>=2&&trainingDrop<8){game.spawnDrop(19,1,6,0);trainingDrop++;}
    if(trainingClock>7)setupLesson();
  }
  if(trainingStep===5&&game.skins.length&&trainingDrop===0){const skin=game.skins[0];game.spawnDrop(skin.cells[1].x,0,0,1.2);trainingDrop=1;$('training-copy').textContent='Your skin stayed behind with its colors. Watch the coral drop finish its pair. In a real storm, you would place the skin under a forecast yourself.';}
  if(trainingStep===5&&game.stats.skinClears>0)$('training-copy').textContent='The skin caught the rain and burst, clearing nearby stone without shortening your living coil. That is a little plan you can leave behind.';
  game.update(dt);
}
function events(){
  for(const e of game.drainEvents()){
    renderer.effect(e);sound.event(e.type==='skin_clear'?'clear':e.type==='skin_catch'?'catch':e.type,e.color,game.combo);
    if(e.type==='clear'&&state!=='training')toast(e.combo>1?`CHAIN ×${e.combo} / ${e.count} LINKS`:`${e.count} LINKS RECLAIMED`,1.1);
    if(e.type==='shed')toast('SHED / ROOM TO BREATHE',1.2);
    if(e.type==='skin_create')toast('AFTERIMAGE / MATCH 3 TO RECLAIM',1.7);
    if(e.type==='skin_clear')toast('AFTERIMAGE RECLAIMED',1.5);
    if(e.type==='skin_reject')toast('SHED / NO ROOM FOR A SKIN',1.5);
    if(e.type==='hit'){lastHit=e.text;toast(`${e.text.toUpperCase()} HIT / ${game.health} INTEGRITY`,1.5);}
  }
}
function demoBoard(t){
  const path=[];for(let x=2;x<=19;x++)path.push({x,y:7});for(let y=8;y<=17;y++)path.push({x:19,y});for(let x=18;x>=2;x--)path.push({x,y:17});for(let y=16;y>7;y--)path.push({x:2,y});
  const tick=t*4,idx=Math.floor(tick)%path.length,snake=Array.from({length:27},(_,i)=>({...path[(idx-i+path.length*2)%path.length],color:i===0?-1:Math.floor(i/4)%4-1}));
  const previousSnake=Array.from({length:27},(_,i)=>({...path[(idx-i-1+path.length*2)%path.length],color:snake[i].color}));const p=path[idx],q=path[(idx-1+path.length)%path.length];
  const drops=Array.from({length:6},(_,i)=>({x:(i*7+4)%W,y:((t*(3+i*.2)+i*5)%26)-2,color:i%3,warning:0}));
  return{snake,previousSnake,dir:{x:p.x-q.x,y:p.y-q.y},moveAccumulator:tick%1,stepDuration:1,drops,debris:Array.from({length:25},(_,i)=>({x:(i*7)%W,y:H-1-Math.floor(i/W),color:i%3})),invulnerable:0};
}
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;elapsed+=dt;
  if(state==='playing'){
    if(countdown>0){const before=Math.ceil(countdown);countdown=Math.max(0,countdown-dt);const n=Math.ceil(countdown);if(n!==before)toast(n?String(n):'CATCH THE RAIN',n?.8:1);}
    else {game.update(dt);events();const phase=Math.floor(game.time/30);if(phase!==lastPhase){if(phase>0&&phase<6)toast(phases[phase][0],2);lastPhase=phase;}if(game.status!=='playing')finish();}
  }else if(state==='training'){trainingTick(dt);events();}
  sound.active=state==='playing'&&countdown<=0||state==='training';sound.intensity=Math.min(1,game.time/180);sound.tick();
  renderer.draw(state==='menu'?demoBoard(renderer.reduced?5:elapsed):game,dt,elapsed,{demo:state==='menu'});
  if(elapsed>toastUntil)$('toast').classList.remove('show');
  hudClock+=dt;if(hudClock>.1){updateHUD();hudClock=0;}
  requestAnimationFrame(frame);
}
$('start-button').onclick=()=>start('storm');$('endless-button').onclick=()=>start('endless');$('learn-button').onclick=learn;
$('pause-button').onclick=()=>state==='paused'?resume():pause();$('resume-button').onclick=resume;$('restart-button').onclick=()=>start(lastMode);$('quit-button').onclick=menu;$('brand').onclick=e=>{e.preventDefault();if(state==='playing'||state==='training')pause();else if(state!=='paused')menu();};
$('again-button').onclick=()=>start(lastMode);$('result-menu-button').onclick=menu;$('shed-button').onclick=tryShed;$('touch-shed').onpointerdown=e=>{e.preventDefault();tryShed();};
$('training-next').onclick=()=>{if(trainingStep===currentLessons().length-1){saved.learned=true;persist();start('storm');}else{trainingStep++;setupLesson();focusGame();}};$('training-exit').onclick=()=>start('storm');
$('variant-button').onclick=()=>{document.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===selectedVariant)));$('relaxed-pace').checked=selectedRelaxed;$('variant-dialog').showModal();};
$('relaxed-pace').onchange=e=>{selectedRelaxed=e.target.checked;saved.relaxed=selectedRelaxed;persist();updateHUD();};
document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{selectedVariant=b.dataset.variant;saved.variant=selectedVariant;persist();document.querySelectorAll('[data-variant]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));updateHUD();});
document.querySelectorAll('[data-dir]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();steer(...b.dataset.dir.split(',').map(Number));});
const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
window.addEventListener('keydown',e=>{
  if($('settings').open||$('variant-dialog').open)return;const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(directions[key]){if(state==='playing'||state==='training'){e.preventDefault();if(!e.repeat)steer(...directions[key]);}return;}
  if(e.code==='Space'&&(state==='playing'||state==='training')){e.preventDefault();if(!e.repeat)tryShed();}
  if(key==='Escape'||key==='p'){e.preventDefault();state==='paused'?resume():pause();}
  if(key==='Enter'&&e.target===canvas){e.preventDefault();if(state==='menu')start();else if(state==='result')start(lastMode);else if(state==='training')$('training-next').click();}
});
window.addEventListener('blur',()=>{if(state==='playing'||state==='training')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='playing'||state==='training'))pause();});
let touchStart=null;canvas.addEventListener('pointerdown',e=>{touchStart={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);focusGame();});canvas.addEventListener('pointermove',e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))>18){steer(...(Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)]));touchStart={x:e.clientX,y:e.clientY};}});canvas.addEventListener('pointerup',()=>touchStart=null);canvas.addEventListener('pointercancel',()=>touchStart=null);
let settingsReturn='menu';$('settings-button').onclick=()=>{settingsReturn=state;if(state==='playing'||state==='training')pause();$('sfx-volume').value=sound.sfx*100;$('music-volume').value=sound.music*100;$('reduced-motion').checked=renderer.reduced;$('settings').showModal();sound.unlock();};
$('sfx-volume').oninput=e=>{sound.sfx=+e.target.value/100;sound.volumes();sound.event('catch',0);persist();};$('music-volume').oninput=e=>{sound.music=+e.target.value/100;sound.volumes();persist();};$('reduced-motion').onchange=e=>{renderer.reduced=e.target.checked;persist();};
$('settings').addEventListener('close',()=>{if((settingsReturn==='playing'||settingsReturn==='training')&&state==='paused')resume();});
$('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){$('fullscreen-button').textContent='FULLSCREEN UNAVAILABLE IN THIS VIEW';}};
// Explicit QA mode permits deterministic interaction checks without shipping a visible debug panel.
if(new URLSearchParams(location.search).has('qa'))window.__raincoil={get game(){return game;},get state(){return state;},get countdown(){return countdown;},get variant(){return selectedVariant;},start,menu,learn,pause,resume,snapshot:()=>({state,variant:game.variant,time:game.time,score:game.score,health:game.health,length:game.snake.length,skins:game.skins?.length||0,stats:{...game.stats}})};
menu();requestAnimationFrame(frame);

// AGENTPARK: open straight into play
window.__game = window.__game || {};
window.__game.autostart = () => { if (state === 'menu') start('storm'); window.__game.state = 'play'; return true; };
