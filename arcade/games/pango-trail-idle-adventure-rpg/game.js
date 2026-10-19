// Pango Trail — an idle critter adventure. Pip the pangolin walks a trail one day at a time: random encounters,
// pick 1 of 3 skills, auto battles, a boss every 10 days. Runs are short; how far can Pip get?
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, arp, soft } from './calm.js';
import * as T from './trail.js';

const NAME = 'Pango Trail: Idle Adventure RPG';
const S = store('pangotrail');
const F = flow('pangotrail', { par: 25 });
const ui = createUI({ title: 'Pango Trail', hint: 'Tap to set off', hand: '', score: false, progress: false });
cardTheme({ accent: '#3fae6a' });
const D = daily('pangotrail', ui, { name: NAME });
const B = board({ game: 'pango-trail', label: 'Furthest day', limits: { maxRun: 200, maxPerSec: 3 }, corner: 'tl', accent: '#7ee08a' });
const fx = fx2d(30);
startCard(ui, D, { kicker: D.isDaily ? 'Daily trail · same luck for everyone' : 'Idle adventure', dailySub: 'Same trail and dice for everyone' });
{ const p = document.createElement('p'); const b = S.get('best', 0); p.textContent = b ? `Furthest: day ${b}` : 'Walk, pick skills, beat the bosses'; p.style.marginTop = '6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
ui.els.win.querySelector('p').innerHTML = 'CHAPTER <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Boss down!';
ui.els.win.querySelector('.hint').textContent = 'Tap to keep walking';
ui.els.lose.querySelector('.hint').textContent = D.isDaily ? 'Tap to retry today\'s trail' : 'Tap to start a new trail';

const THEMES = [
  { sky: ['#8fd3ff', '#d9f3ff'], far: '#9fd99a', mid: '#6cc070', near: '#4fa65a', path: '#f1d9a6', page: ['#3d6b3f', '#2a4a2c'], deco: ['#ff8fab', '#ffd166', '#ffffff'] },
  { sky: ['#ffb27a', '#ffe2b8'], far: '#e9a36b', mid: '#d4824d', near: '#b8653a', path: '#f6d7a0', page: ['#7a4126', '#4f2816'], deco: ['#5fa35a', '#e8c170', '#7a4126'] },
  { sky: ['#a9c8ff', '#eef4ff'], far: '#dfeaf7', mid: '#c4d6ec', near: '#a7bfdc', path: '#ffffff', page: ['#45608a', '#2b3c5a'], deco: ['#ffffff', '#9fd0ff', '#5f7fa8'] },
  { sky: ['#6b4fa0', '#d6a6e8'], far: '#8a6bb8', mid: '#6a4f9a', near: '#4c3a7a', path: '#c9b2e8', page: ['#3b2a5c', '#231838'], deco: ['#7cf3d0', '#ffb3f0', '#ffe27a'] },
];

// ---------------------------------------------------------------- DOM
css(`
body{background:#2a4a2c;color:#fff}
#scene{position:fixed;left:0;top:0;width:100%;z-index:1}
#page{position:fixed;left:0;right:0;bottom:0;z-index:1}
#col{position:fixed;top:0;bottom:0;left:50%;width:min(100vw,460px);transform:translateX(-50%);z-index:3;pointer-events:none}
#col>*{pointer-events:auto}
#dayb{position:absolute;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:rgba(30,24,16,.55);border-radius:16px;padding:4px 16px;text-align:center;line-height:1.1;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);pointer-events:none}
#dayb b{font-size:20px;letter-spacing:1px}#dayb span{display:block;font-size:11px;opacity:.8;letter-spacing:1px;text-transform:uppercase;font-weight:700}
#speed{position:absolute;top:calc(12px + env(safe-area-inset-top));right:10px;font:inherit;font-weight:800;font-size:16px;color:#fff;background:rgba(30,24,16,.55);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:8px 12px;cursor:pointer}
#stats{position:absolute;left:12px;right:12px;display:flex;gap:6px;align-items:center}
#hpw{flex:1;position:relative;height:26px;border-radius:13px;background:rgba(0,0,0,.35);overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.3)}
#hpw i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#ff8b8b,#e8445a);border-radius:13px;transition:width .25s}
#hpw b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.st{background:rgba(0,0,0,.35);border-radius:12px;padding:3px 9px;font-weight:800;font-size:14px;white-space:nowrap}
#xpw{position:absolute;left:12px;right:12px;height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden}#xpw i{display:block;height:100%;background:#7ee0ff;width:0;transition:width .3s}
#jour{position:absolute;left:12px;right:12px;background:#fff8ec;color:#4a3b2a;border-radius:18px;box-shadow:0 6px 0 rgba(0,0,0,.18),0 10px 30px rgba(0,0,0,.25);overflow:hidden;padding:12px 16px}
#log{height:100%;overflow:hidden}
.en{padding:6px 0;border-bottom:1px dashed rgba(74,59,42,.18);animation:fin .35s}
.en:first-child{font-size:15px}.en:not(:first-child){opacity:.6;font-size:13px}
.en b{display:block;font-size:12px;letter-spacing:2px;color:#b07a3c;text-transform:uppercase}
@keyframes fin{from{opacity:0;transform:translateY(-8px)}}
#choice{position:absolute;inset:0;background:#fff8ec;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
#choice[hidden]{display:none}
#choice h3{margin:0;font-family:ui-serif,Georgia,serif;font-size:22px;color:#3b2d1f;text-align:center}
#choice .q{text-align:center;font-size:15px;margin-bottom:4px}
.sk{display:flex;align-items:center;gap:12px;background:#fff;border:2px solid #ecd9b8;border-radius:14px;padding:8px 12px;cursor:pointer;text-align:left;box-shadow:0 3px 0 #ecd9b8;transition:transform .12s;flex:1;min-height:0}
.sk:active{transform:scale(.97)}
.sk .ic{font-size:30px;width:44px;height:44px;flex:none;border-radius:12px;background:linear-gradient(160deg,#ffe3a8,#ffc46b);display:flex;align-items:center;justify-content:center}
.sk b{display:block;font-size:16px;color:#3b2d1f}.sk span{font-size:13px;color:#7a6047}.sk em{font-style:normal;color:#e08a2c;font-size:12px;font-weight:800;margin-left:6px;letter-spacing:1px}
.evb{font:inherit;font-weight:800;font-size:16px;color:#fff;border:0;border-radius:14px;padding:13px 10px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.2)}
#go{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));width:min(300px,76vw);font:inherit;font-weight:800;font-size:26px;color:#fff;background:linear-gradient(180deg,#5fd36e,#2f9e48);border:3px solid #fff;border-radius:40px;padding:10px 0;box-shadow:0 6px 0 #1f6b31,0 10px 24px rgba(0,0,0,.3);cursor:pointer;text-shadow:0 2px 0 rgba(0,0,0,.2)}
#go:active{transform:translate(-50%,4px);box-shadow:0 2px 0 #1f6b31}
#go:disabled{filter:grayscale(.6) brightness(.85)}
#go.pulse{animation:gp 1.2s ease-in-out infinite}
@keyframes gp{50%{transform:translateX(-50%) scale(1.05)}}
`);
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const cv = document.createElement('canvas'); cv.id = 'scene'; document.body.prepend(cv);
const page = $('<div id="page"></div>'); document.body.prepend(page);
const col = $(`<div id="col"><div id="dayb"><b>DAY 0</b><span>Clover Meadow</span></div><button id="speed">×1</button>
  <div id="stats"><div id="hpw"><i></i><b>120 / 120</b></div><div class="st" id="sa">⚔ 14</div><div class="st" id="sd">🛡 2</div><div class="st" id="sl">Lv 1</div></div>
  <div id="xpw"><i></i></div>
  <div id="jour"><div id="log"></div><div id="choice" hidden></div></div>
  <button id="go">Day 1 ▸</button></div>`);
document.body.appendChild(col);
const E = id => document.getElementById(id);
const g = cv.getContext('2d');
let W = 0, H = 0, SH = 0, dpr = 1;
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; SH = Math.round(Math.min(H * 0.46, 420, W * 1.1));
  cv.width = W * dpr; cv.height = SH * dpr; cv.style.height = SH + 'px';
  page.style.top = SH + 'px';
  E('stats').style.top = SH + 10 + 'px'; E('xpw').style.top = SH + 42 + 'px';
  const jt = SH + 58, jb = H - 16 - 70; E('jour').style.top = jt + 'px'; E('jour').style.height = Math.max(150, jb - jt - 8) + 'px';
}
addEventListener('resize', layout); layout();

// ---------------------------------------------------------------- state
let state = 'ready', busy = false, run = null, speed = S.get('speed', 1), choice = null, runT0 = 0, recorded = false, beatShown = false;
let theme = THEMES[0], scroll = 0, walkV = 0, t = 0, shake = 0;
const hero = { x: 0, lunge: 0, flash: 0, hurt: 0 };
let foe = null;           // { e, x, tx, hp, max, flash, lunge, dead }
let prop = null;          // event prop: 'chest' | 'well' | 'camp' | 'shrine' | 'stump'
const nums = [];          // floating damage numbers
const HASF = 'filter' in CanvasRenderingContext2D.prototype;
const sleep = ms => new Promise(r => setTimeout(r, ms / speed));

function hud() {
  if (!run) return;
  const s = T.stats(run);
  E('hpw').querySelector('i').style.width = Math.max(0, run.hp / s.maxHp * 100) + '%';
  E('hpw').querySelector('b').textContent = `${Math.max(0, run.hp)} / ${s.maxHp}`;
  E('sa').textContent = '⚔ ' + s.atk; E('sd').textContent = '🛡 ' + s.def; E('sl').textContent = 'Lv ' + run.lvl;
  E('xpw').querySelector('i').style.width = run.xp / T.xpNeed(run) * 100 + '%';
  const ch = Math.floor(Math.max(0, run.day - 1) / T.BOSS_EVERY);
  E('dayb').querySelector('b').textContent = 'DAY ' + run.day; E('dayb').querySelector('span').textContent = T.CHAPTERS[ch % T.CHAPTERS.length];
  E('go').textContent = `Day ${run.day + 1} ▸`;
}
function log(text, head) {
  const e = $(`<div class="en"><b></b><span></span></div>`); e.querySelector('b').textContent = head || `Day ${run.day}`; e.querySelector('span').textContent = text;
  const L = E('log'); L.prepend(e); while (L.children.length > 12) L.lastChild.remove();
}
E('speed').textContent = '×' + speed;
E('speed').addEventListener('pointerdown', e => e.stopPropagation());
E('speed').addEventListener('click', e => { e.stopPropagation(); setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1); });
function setSpeed(v) { speed = v; S.set('speed', speed); E('speed').textContent = '×' + speed; soft.click(); }
E('go').addEventListener('pointerdown', e => e.stopPropagation());
E('go').addEventListener('click', e => { e.stopPropagation(); nextDay(); });
E('choice').addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- run flow
function newRun() {
  const n = S.get('runs', 0) + 1; S.set('runs', n);
  run = T.newRun(D.seed || (Date.now() % 1e9) + n * 7919, F.k());
  state = 'play'; busy = false; recorded = false; beatShown = false; foe = null; prop = null; choice = null; runT0 = performance.now();
  theme = THEMES[0]; E('log').innerHTML = ''; E('choice').hidden = true;
  log('Pip packs a leaf hat, a scarf and a snack. The trail begins!', 'Day 0'); hud(); E('go').disabled = false; E('go').classList.add('pulse');
  B.start();
}
async function nextDay() {
  if (state !== 'play' || busy || choice) return;
  busy = true; E('go').disabled = true; E('go').classList.remove('pulse'); soft.click();
  const ev = T.rollDay(run);
  const ch = Math.floor((run.day - 1) / T.BOSS_EVERY); theme = THEMES[ch % THEMES.length];
  hud();
  // walk
  prop = null; walkV = 1; tone(520, 0.05, 'sine', 0.06, 1.3);
  await sleep(560); walkV = 0;
  if (ev.type === 'battle') await doBattle(ev.enemy);
  else if (ev.type === 'skill') { prop = 'shrine'; log('A glowing shrine hums softly. Pip may learn something new.'); await pickSkill(ev.opts, 'A shrine of skills'); }
  else if (ev.type === 'chest') {
    prop = 'chest'; await sleep(250); T.applyGear(run, ev.gear); popNum(W * 0.62, SH * 0.6, `+${ev.gear.v} ${ev.gear.k.toUpperCase()}`, '#ffd35c');
    fx.sparks(W * 0.62, SH * 0.72, ['#ffd35c', '#fff'], 16); arp([72, 76, 79], 70, 0.1);
    log(`A chest under a fern! Pip finds a ${ev.gear.n}: +${ev.gear.v} ${ev.gear.k === 'hp' ? 'max HP' : ev.gear.k.toUpperCase()}.`);
  } else if (ev.type === 'rest') {
    prop = 'camp'; const h = T.heal(run, ev.camp ? 0.5 : 0.3); popNum(W * 0.3, SH * 0.55, `+${h}`, '#7ee08a'); arp([67, 71, 74], 120, 0.08);
    log(ev.camp ? `A campfire before the big one. Pip rests: +${h} HP. Something huge rustles ahead…` : `A sunny nap spot. Pip snoozes: +${h} HP.`);
  } else if (ev.type === 'event') { prop = ev.ev.t.includes('well') ? 'well' : ev.ev.t.includes('stump') ? 'stump' : 'sign'; await doEvent(ev.ev); }
  hud();
  if (state !== 'play') return;
  if (!beatShown && D.beaten(run.day)) { beatShown = true; ui.pop('BEATEN!', '#ffd35c', 44, 30); fx.confetti(80); }
  busy = false; E('go').disabled = false;
}
async function doBattle(e) {
  foe = { e, x: W + 60, tx: W * 0.7, hp: e.hp, max: e.hp, flash: 0, lunge: 0, dead: 0 };
  if (e.boss) { log(`${e.n} blocks the trail! (HP ${e.hp}, ATK ${e.atk})`); ui.pop(e.n, '#ffd35c', 30, 22); tone(90, 0.5, 'sawtooth', 0.07, 0.7); buzz([30, 30, 30]); }
  await sleep(e.boss ? 700 : 420);
  const res = T.battle(run, e);
  let hp = 0;
  for (const b of res.beats) {
    if (b.who === 'hero') {
      hero.lunge = 1; await sleep(90); foe.hp = b.ehp; foe.flash = 1; shake = b.kind === 'crit' ? 8 : 4;
      const c = { crit: '#ffd35c', fire: '#ff8a3c', spark: '#7ee0ff', thorns: '#9be37a', twin: '#fff' }[b.kind] || '#fff';
      popNum(foe.x, SH * 0.5, (b.kind === 'crit' ? 'CRIT ' : b.kind === 'fire' ? '🔥' : b.kind === 'spark' ? '⚡' : '') + b.dmg, c, b.kind === 'crit' ? 30 : 22);
      fx.sparks(foe.x, SH * 0.66, [c, '#fff'], b.kind === 'crit' ? 14 : 7, { speed: 3.5, size: 3 });
      tone(b.kind === 'crit' ? 880 : 620 + Math.random() * 80, 0.06, 'square', 0.05, 0.5); buzz(b.kind === 'crit' ? 20 : 6);
    } else {
      foe.lunge = 1; await sleep(90);
      if (b.kind === 'dodge') popNum(hero.x, SH * 0.5, 'dodge!', '#7ee0ff');
      else if (b.kind === 'block') popNum(hero.x, SH * 0.5, 'curl! 0', '#c8b6ff');
      else { hero.hurt = 1; shake = 5; popNum(hero.x, SH * 0.5, '-' + b.dmg, '#ff5d6c', 24); tone(180, 0.1, 'sawtooth', 0.06, 0.6); buzz(12); if (b.kind === 'wind') { popNum(hero.x, SH * 0.38, 'Second wind!', '#7ee08a', 22); } }
      run.hp = b.hp; hud();
    }
    hud(); await sleep(e.boss ? 230 : 180); hp++;
  }
  if (!res.won) { run.hp = 0; hud(); return lost(e); }
  foe.dead = 1; fx.sparks(foe.x, SH * 0.66, ['#fff', '#ffd35c', theme.deco[0]], 24, { speed: 5 });
  tone(300, 0.15, 'triangle', 0.08, 2); buzz(25);
  const ups = T.afterBattle(run, e); hud();
  log(e.boss ? `Pip defeated ${e.n}! +${e.xp} XP and a big rest.` : `Pip beat a ${e.n} in ${res.beats.filter(b => b.who === 'hero').length} hits. +${e.xp} XP.`);
  await sleep(380); foe = null;
  for (let i = 0; i < ups; i++) { ui.pop('LEVEL UP!', '#7ee0ff', 36, 30); arp([72, 76, 79, 84], 70, 0.1); await pickSkill(T.skillOpts(run), `Level ${run.lvl - ups + i + 1}! Pick a skill`); }
  if (e.boss) return bossWon(e);
}
function pickSkill(opts, title) {
  if (!opts.length) return Promise.resolve();
  return new Promise(done => {
    const box = E('choice'); box.innerHTML = `<h3></h3>`; box.querySelector('h3').textContent = title;
    choice = { kind: 'skill', opts, pick: k => { T.learn(run, k); const d = T.SKILLS[k]; log(`Pip learned ${d.n}${run.sk[k] > 1 ? ' (lv ' + run.sk[k] + ')' : ''}: ${d.d(run.sk[k])}.`); box.hidden = true; choice = null; hud(); arp([67, 72, 79], 60, 0.1); buzz(15); setTimeout(done, 150); } };
    for (const k of opts) {
      const d = T.SKILLS[k], lv = (run.sk[k] || 0) + 1;
      const e = $(`<div class="sk"><div class="ic">${d.i}</div><div><b>${d.n}<em>${lv > 1 ? 'LV ' + lv : 'NEW'}</em></b><span></span></div></div>`);
      e.querySelector('span').textContent = d.d(lv);
      e.addEventListener('click', ev => { ev.stopPropagation(); choice && choice.pick(k); });
      box.appendChild(e);
    }
    box.hidden = false; soft.wood();
  });
}
function doEvent(ev) {
  return new Promise(done => {
    const box = E('choice'); box.innerHTML = `<h3>Day ${run.day}</h3><div class="q"></div>`; box.querySelector('.q').textContent = ev.t;
    const fin = async (c) => {
      box.hidden = true; choice = null; const out = c[1](run); hud();
      if (out === 'skill') { log(`${ev.t} Pip chose: ${c[0].toLowerCase()}.`); await pickSkill(T.skillOpts(run), 'The snail teaches you…'); }
      else log(`${ev.t} ${out}`);
      soft.wood(); done();
    };
    choice = { kind: 'event', opts: [ev.a, ev.b], pick: i => fin(i ? ev.b : ev.a) };
    [ev.a, ev.b].forEach((c, i) => { const b = $(`<button class="evb"></button>`); b.textContent = c[0]; b.style.background = i ? '#8a7a66' : '#3fae6a'; b.addEventListener('click', e => { e.stopPropagation(); choice && choice.pick(i); }); box.appendChild(b); });
    box.hidden = false;
  });
}
function bossWon(e) {
  const ch = run.day / T.BOSS_EVERY;
  submit(); S.set('best', Math.max(S.get('best', 0), run.day));
  D.won(run.day, 'reached day');
  state = 'won'; ui.win(ch, `${e.n} defeated on day ${run.day}`); fx.confetti(140); arp([67, 72, 76, 79, 84], 90, 0.12); buzz([30, 40, 30]);
}
function lost(e) {
  foe && (foe.flash = 0); submit(); S.set('best', Math.max(S.get('best', 0), run.day));
  if (!recorded) { recorded = true; F.endless(run.day); }
  state = 'lost'; busy = false;
  ui.lose(`Day ${run.day}`, `Pip curls up for a long nap after meeting ${e.boss ? e.n : 'a ' + e.n}. Level ${run.lvl}.`);
  log(`Pip was beaten by ${e.boss ? e.n : 'a ' + e.n}.`);
  tone(220, 0.3, 'triangle', 0.1, 0.5); setTimeout(() => tone(150, 0.5, 'triangle', 0.1, 0.5), 200); buzz([60, 40, 60]);
}
function submit() { B.submit(run.day, { ms: performance.now() - runT0 }); }
ui.onTap(w => {
  if (w === 'start' || w === 'lose') newRun();
  else if (w === 'win') { state = 'play'; busy = false; E('go').disabled = false; E('go').classList.add('pulse'); log(`Chapter ${run.day / T.BOSS_EVERY + 1}: ${T.CHAPTERS[(run.day / T.BOSS_EVERY) % T.CHAPTERS.length]}. The trail goes on.`, 'New chapter'); }
});
function popNum(x, y, text, color, size = 22) { nums.push({ x: x + (Math.random() - 0.5) * 20, y, text, color, size, life: 1 }); }

// ---------------------------------------------------------------- drawing
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function ell(x, y, rx, ry, c) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); }
function hills(y0, amp, freq, off, color) {
  g.beginPath(); g.moveTo(0, SH);
  for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, y0 - Math.sin((x + off) * freq) * amp - Math.sin((x + off) * freq * 2.3 + 1) * amp * 0.4);
  g.lineTo(W, SH); g.closePath(); g.fillStyle = color; g.fill();
}
function drawPango(x, gy, s) {
  const walk = walkV > 0, bob = walk ? -Math.abs(Math.sin(t * 11)) * 4 : Math.sin(t * 2.2) * 1.2;
  g.save(); g.translate(x + hero.lunge * 22 - hero.hurt * 8, gy); g.scale(s, s);
  if (hero.hurt > 0.3 && HASF) g.filter = 'sepia(1) saturate(6) hue-rotate(-40deg)';
  ell(0, 2, 36, 6, 'rgba(0,0,0,.18)');
  g.translate(0, bob);
  const leg = (lx, ph) => { const a = walk ? Math.sin(t * 11 + ph) * 5 : 0; rr(lx + a - 5, -14, 10, 15, 5); g.fillStyle = '#9a5f2e'; g.fill(); };
  leg(-18, 0); leg(14, Math.PI);
  // tail
  g.beginPath(); g.moveTo(-26, -20); g.quadraticCurveTo(-52, -18, -48, -4); g.quadraticCurveTo(-44, 4, -34, -2); g.quadraticCurveTo(-30, -12, -22, -10); g.closePath(); g.fillStyle = '#b5743b'; g.fill();
  // body + scales
  g.save(); g.beginPath(); g.ellipse(0, -28, 32, 24, 0, 0, Math.PI * 2); g.fillStyle = '#c98a4b'; g.fill(); g.clip();
  g.strokeStyle = '#9a5f2e'; g.lineWidth = 2.4;
  for (let row = 0; row < 5; row++) for (let c = -4; c < 5; c++) { const sx = c * 13 + (row % 2) * 6.5, sy = -50 + row * 10; g.beginPath(); g.arc(sx, sy, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  g.restore();
  ell(8, -16, 20, 9, '#f2cf9d');
  leg(-8, Math.PI / 2); leg(22, Math.PI * 1.5);
  // head
  g.save(); g.translate(30, -30 + (walk ? Math.sin(t * 11) * 1 : 0));
  g.beginPath(); g.moveTo(-6, -12); g.quadraticCurveTo(16, -12, 26, 2); g.quadraticCurveTo(14, 10, -4, 10); g.closePath(); g.fillStyle = '#e8b47c'; g.fill();
  ell(26, 2, 3.4, 3, '#4a2c1a');
  ell(6, -3, 3.4, 3.8, '#2b1c12'); ell(7.2, -4.4, 1.2, 1.2, '#fff');
  ell(10, 4, 4, 2.4, 'rgba(255,120,120,.45)');
  // leaf hat
  g.save(); g.translate(0, -12); g.rotate(-0.5 + Math.sin(t * 3) * 0.08);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -16, 0, -26); g.quadraticCurveTo(-10, -16, 0, 0); g.fillStyle = '#4fbf5e'; g.fill();
  g.strokeStyle = '#2f8a3d'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -22); g.stroke(); g.restore();
  g.restore();
  // scarf
  g.save(); g.translate(22, -30); g.rotate(0.35); rr(-5, -12, 10, 24, 5); g.fillStyle = '#2bb5c0'; g.fill();
  g.beginPath(); g.moveTo(-2, 8); g.quadraticCurveTo(-14 - (walk ? Math.sin(t * 9) * 4 : 0), 16, -18, 10); g.lineTo(-14, 4); g.closePath(); g.fill(); g.restore();
    g.restore();
}
function eyes(x, y, r, angry, gap = 1) {
  for (const sx of [-1, 1]) { ell(x + sx * r * 1.3 * gap, y, r, r * 1.1, '#fff'); ell(x + sx * r * 1.3 * gap - r * 0.3, y + r * 0.15, r * 0.55, r * 0.6, '#231a14'); }
  if (angry) { g.strokeStyle = '#231a14'; g.lineWidth = r * 0.45; g.lineCap = 'round'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(x + sx * r * 2.3 * gap, y - r * 1.5); g.lineTo(x + sx * r * 0.5, y - r * 0.9); g.stroke(); } }
}
function drawFoe(f, gy) {
  const e = f.e, s = e.boss ? 1.5 : 1, x = f.x - f.lunge * 22, bob = Math.sin(t * 4 + 1) * 2;
  g.save(); g.translate(x + f.flash * 6, gy); g.scale(s * (1 + f.flash * 0.06), s * (1 - f.flash * 0.06));
  if (f.flash > 0.3) { if (HASF) g.filter = 'brightness(1.9) saturate(.4)'; else g.globalAlpha = 0.6; }
  if (f.dead) { g.globalAlpha = Math.max(0, 1 - f.dead); g.scale(1 + f.dead * 0.3, 1 - f.dead * 0.6); }
  ell(0, 2, 30, 6, 'rgba(0,0,0,.18)'); g.translate(0, bob);
  switch (e.k) {
    case 'blob': g.beginPath(); g.moveTo(-28, 0); g.quadraticCurveTo(-30, -44, 0, -44); g.quadraticCurveTo(30, -44, 28, 0); g.closePath(); g.fillStyle = '#9b6bd6'; g.fill(); ell(-10, -32, 6, 4, 'rgba(255,255,255,.35)'); eyes(-4, -22, 6, true); break;
    case 'beetle': ell(0, -18, 26, 18, '#3e9b55'); g.strokeStyle = '#2a6b3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, -36); g.lineTo(4, -2); g.stroke(); ell(-22, -18, 12, 11, '#2a6b3a');
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-6 + i * 12, -34); g.lineTo(-2 + i * 12, -44); g.lineTo(2 + i * 12, -34); g.fillStyle = '#c9e86b'; g.fill(); } eyes(-24, -20, 4, true); break;
    case 'shroom': rr(-10, -26, 20, 26, 8); g.fillStyle = '#f6e6cc'; g.fill(); g.beginPath(); g.ellipse(0, -28, 30, 18, 0, Math.PI, 0); g.fillStyle = '#e8484f'; g.fill();
      for (const [a, b, r] of [[-14, -36, 4], [6, -40, 5], [18, -32, 3]]) ell(a, b, r, r, '#fff'); eyes(-3, -14, 4.5, true); break;
    case 'crab': ell(0, -16, 26, 16, '#8f9aa8'); for (const sx of [-1, 1]) { ell(sx * 30, -26, 9, 7, '#7a8594'); g.fillStyle = '#5f6a78'; g.fillRect(sx * 30 - 2, -22, 4, 8); }
      g.fillStyle = '#5f6a78'; g.fillRect(-8, -40, 3, 12); g.fillRect(6, -40, 3, 12); eyes(-6, -40, 4, false, 2.2); break;
    case 'wasp': ell(0, -30, 20, 16, '#ffcc33'); g.fillStyle = '#2b2222'; g.fillRect(-4, -46, 6, 32); g.fillRect(8, -44, 5, 28);
      g.globalAlpha *= 0.7; ell(-2, -50 + Math.sin(t * 40) * 3, 12, 6, '#e8f6ff'); ell(10, -50 - Math.sin(t * 40) * 3, 10, 5, '#e8f6ff'); g.globalAlpha = f.dead ? Math.max(0, 1 - f.dead) : 1; eyes(-12, -32, 4, true); break;
    case 'bat': g.beginPath(); g.moveTo(-40, -40 + Math.sin(t * 14) * 8); g.quadraticCurveTo(-20, -20, -10, -30); g.lineTo(10, -30); g.quadraticCurveTo(20, -20, 40, -40 - Math.sin(t * 14) * 8); g.quadraticCurveTo(20, -50, 0, -44); g.quadraticCurveTo(-20, -50, -40, -40 + Math.sin(t * 14) * 8); g.fillStyle = '#5a4b7a'; g.fill();
      ell(0, -34, 14, 14, '#6d5c94'); eyes(0, -36, 4, true); break;
    case 'bramble': ell(0, -34, 40, 34, '#3f8f3f'); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ell(Math.cos(a) * 32, -34 + Math.sin(a) * 28, 12, 12, i % 2 ? '#357a35' : '#4fa64f'); }
      g.fillStyle = '#ffd35c'; g.beginPath(); g.moveTo(-16, -70); g.lineTo(-10, -84); g.lineTo(-4, -72); g.lineTo(2, -86); g.lineTo(8, -72); g.lineTo(14, -84); g.lineTo(18, -70); g.closePath(); g.fill(); eyes(-6, -38, 7, true); break;
    case 'toad': ell(0, -26, 40, 26, '#7d8b6e'); ell(-14, -50, 10, 10, '#7d8b6e'); ell(14, -50, 10, 10, '#7d8b6e'); for (const [a, b] of [[-20, -20], [10, -14], [24, -30]]) ell(a, b, 5, 4, '#6a775c');
      ell(-14, -51, 6, 6, '#ffe27a'); ell(14, -51, 6, 6, '#ffe27a'); ell(-15, -51, 2, 4, '#231a14'); ell(13, -51, 2, 4, '#231a14'); g.strokeStyle = '#3d4535'; g.lineWidth = 3; g.beginPath(); g.moveTo(-34, -26); g.quadraticCurveTo(0, -18, 30, -26); g.stroke(); break;
    case 'moth': for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 26, -44 + Math.sin(t * 6) * 3, 26, 34, sx * 0.4, 0, Math.PI * 2); g.fillStyle = '#7a5cc8'; g.fill(); ell(sx * 26, -48, 8, 8, '#ffe27a'); }
      ell(0, -36, 10, 26, '#4a3a7a'); eyes(0, -54, 4.5, true); break;
    case 'yeti': ell(0, -36, 34, 36, '#f4f1ea'); ell(0, -40, 22, 22, '#ff9e6b'); eyes(0, -44, 5.5, true); g.fillStyle = '#fff'; g.fillRect(-8, -30, 5, 6); g.fillRect(3, -30, 5, 6); break;
  }
  g.restore();
  // hp bar
  if (!f.dead) { const bw = e.boss ? 110 : 76, bx = x - bw / 2, by = gy - (e.boss ? 150 : 82); rr(bx, by, bw, 10, 5); g.fillStyle = 'rgba(0,0,0,.4)'; g.fill(); rr(bx + 1, by + 1, Math.max(0, (bw - 2) * f.hp / f.max), 8, 4); g.fillStyle = '#ff5d6c'; g.fill();
    g.font = '700 11px system-ui'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(e.n, x, by - 4); }
}
function drawProp(kind, x, gy) {
  g.save(); g.translate(x, gy);
  if (kind === 'chest') { ell(0, 2, 26, 5, 'rgba(0,0,0,.15)'); rr(-24, -30, 48, 30, 6); g.fillStyle = '#b9733a'; g.fill(); rr(-24, -38, 48, 14, 7); g.fillStyle = '#d18a48'; g.fill(); g.fillStyle = '#ffd35c'; g.fillRect(-4, -30, 8, 10); }
  else if (kind === 'camp') { for (let i = 0; i < 3; i++) { g.save(); g.rotate((i - 1) * 0.5); rr(-3, -6, 6, 26, 3); g.fillStyle = '#7a4a26'; g.fill(); g.restore(); }
    const fl = Math.sin(t * 12) * 3; g.beginPath(); g.moveTo(-12, -2); g.quadraticCurveTo(-10, -26 - fl, 0, -36 - fl); g.quadraticCurveTo(10, -26 + fl, 12, -2); g.fillStyle = '#ff9a3c'; g.fill(); g.beginPath(); g.moveTo(-6, -2); g.quadraticCurveTo(0, -20 + fl, 6, -2); g.fillStyle = '#ffe27a'; g.fill(); }
  else if (kind === 'well') { rr(-26, -26, 52, 26, 6); g.fillStyle = '#9aa3ad'; g.fill(); ell(0, -26, 26, 7, '#5fb6e8'); g.fillStyle = '#7a4a26'; g.fillRect(-24, -66, 5, 40); g.fillRect(19, -66, 5, 40); rr(-30, -72, 60, 10, 4); g.fillStyle = '#c0583c'; g.fill(); }
  else if (kind === 'shrine') { rr(-18, -52, 36, 52, 10); g.fillStyle = '#d9d2c3'; g.fill(); ell(0, -34, 9 + Math.sin(t * 4) * 1.5, 9 + Math.sin(t * 4) * 1.5, '#7ee0ff'); g.globalAlpha = 0.3; ell(0, -34, 22, 22, '#7ee0ff'); }
  else if (kind === 'stump') { rr(-24, -36, 48, 36, 6); g.fillStyle = '#8a5a32'; g.fill(); ell(0, -36, 24, 6, '#c99a64'); rr(-8, -24, 16, 24, 8); g.fillStyle = '#5b3a20'; g.fill(); }
  else { g.fillStyle = '#7a4a26'; g.fillRect(-3, -50, 6, 50); rr(-24, -58, 48, 20, 4); g.fillStyle = '#c9925a'; g.fill(); }
  g.restore();
}
function render(dt) {
  t += dt / 60;
  scroll += walkV * dt * 4.2 * speed;
  hero.lunge = Math.max(0, hero.lunge - dt * 0.12); hero.hurt = Math.max(0, hero.hurt - dt * 0.06);
  if (foe) { foe.x += (foe.tx - foe.x) * Math.min(1, 0.12 * dt * speed); foe.flash = Math.max(0, foe.flash - dt * 0.1); foe.lunge = Math.max(0, foe.lunge - dt * 0.12); if (foe.dead) foe.dead = Math.min(1.2, foe.dead + dt * 0.05); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 0.6);
  g.translate(sx, 0);
  const th = theme, gy = SH * 0.84;
  const sk = g.createLinearGradient(0, 0, 0, SH); sk.addColorStop(0, th.sky[0]); sk.addColorStop(1, th.sky[1]); g.fillStyle = sk; g.fillRect(-10, 0, W + 20, SH);
  ell(W * 0.82, SH * 0.2, 26, 26, 'rgba(255,250,220,.9)');
  g.globalAlpha = 0.85; for (let i = 0; i < 4; i++) { const cx = ((i * 157 - scroll * 0.1 - t * 6) % (W + 160) + W + 160) % (W + 160) - 80, cy = SH * (0.12 + (i % 3) * 0.08); ell(cx, cy, 34, 12, '#fff'); ell(cx + 18, cy - 8, 20, 12, '#fff'); ell(cx - 16, cy - 4, 16, 10, '#fff'); } g.globalAlpha = 1;
  hills(SH * 0.56, 20, 0.008, scroll * 0.2, th.far);
  hills(SH * 0.66, 16, 0.012, scroll * 0.45 + 300, th.mid);
  hills(SH * 0.76, 10, 0.02, scroll * 0.8 + 90, th.near);
  g.fillStyle = th.near; g.fillRect(0, SH * 0.76, W, SH * 0.24);
  rr(-20, gy - 8, W + 40, 22, 11); g.fillStyle = th.path; g.fill();
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 12; i++) { const px = ((i * 70 - scroll) % (W + 70) + W + 70) % (W + 70) - 35; rr(px, gy + 1, 22, 4, 2); g.fill(); }
  for (let i = 0; i < 9; i++) { const px = ((i * 97 + 30 - scroll * 1.1) % (W + 97) + W + 97) % (W + 97) - 40, py = gy + 26 + (i % 3) * 8; ell(px, py, 4, 4, th.deco[i % 3]); ell(px + 5, py - 3, 3, 3, th.deco[(i + 1) % 3]); }
  if (prop) drawProp(prop, W * 0.66, gy + 4);
  hero.x = W * 0.28; drawPango(hero.x, gy + 4, Math.min(1.25, W / 330));
  if (foe) drawFoe(foe, gy + 4);
  for (const n of nums) { n.y -= dt * 0.8; n.life -= dt * 0.022; g.globalAlpha = Math.max(0, Math.min(1, n.life * 2)); g.font = `800 ${n.size}px system-ui`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(n.text, n.x, n.y); g.fillStyle = n.color; g.fillText(n.text, n.x, n.y); }
  g.globalAlpha = 1; for (let i = nums.length - 1; i >= 0; i--) if (nums[i].life <= 0) nums.splice(i, 1);
  // page below the scene
  page.style.background = `linear-gradient(180deg,${th.page[0]},${th.page[1]})`;
}
let last = performance.now();
function frame(now) { const dt = Math.min(2.5, (now - last) / 16.67); last = now; render(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
ui.start();

// ---------------------------------------------------------------- bot
window.__game = {
  get state() { return state; }, get level() { return run ? Math.floor(run.day / T.BOSS_EVERY) + 1 : 1; }, get score() { return run ? run.day : 0; },
  bot() {
    if (state !== 'play') return;
    if (speed < 4) return setSpeed(4);
    if (choice) {
      if (choice.kind === 'skill') { const k = T.PREF.find(p => choice.opts.includes(p)) || choice.opts[0]; return choice.pick(k); }
      return choice.pick(0);
    }
    if (!busy) nextDay();
  },
};
