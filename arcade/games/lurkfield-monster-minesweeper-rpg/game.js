// Lurkfield — a monster minesweeper RPG. Every number is the SUM of the levels of the monsters around that tile.
// Tap a tile to step on it: empty floor shows its number, a monster fights you (you lose that many hearts and gain that
// much XP). Level up to refill and grow your hearts, keep going, and slay the Deep Lurker to clear the field.
import { createUI, store, buzz, note, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Lurkfield: Monster Minesweeper RPG';
const S = store('lurkfield');
const F = flow('lurkfield');
const ui = createUI({ title: 'Lurkfield', hint: 'Tap to descend', hand: '', score: false });
cardTheme({ accent: '#e0913a', serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('lurkfield', ui, { name: NAME });
const B = board({ game: 'lurkfield', label: 'Fields cleared', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily dungeon' : 'monster minesweeper', doneLine: doneToday ? (D.isDaily ? `Cleared today · ${doneToday.s} pts` : 'Daily dungeon cleared ✓') : null });
{ const p = document.createElement('p'); p.style.cssText = 'max-width:300px;font-size:15px;opacity:.85;margin-top:10px;line-height:1.35'; p.textContent = 'Numbers add up the levels of the monsters next to a tile. Beat weak ones to level up, then slay the boss.'; ui.els.start.querySelector('.hint').before(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily dungeon<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Lurker slain!';

// original monster roster (level = damage dealt = XP given)
const MON = { 1: ['🐌', 'Glum Slug'], 2: ['🦇', 'Flitter Bat'], 3: ['🐀', 'Grain Rat'], 4: ['🕷️', 'Loom Spider'], 5: ['🐗', 'Bramble Boar'], 6: ['🦂', 'Sand Stinger'], 7: ['👻', 'Draft Ghost'], 8: ['🐊', 'Moat Croc'], 9: ['🗿', 'Rubble Golem'] };
const BOSS = ['🐙', 'Deep Lurker'];
const NUMC = ['', '#8fd1ff', '#86e0a6', '#d4e36a', '#ffd166', '#ffb15c', '#ff8c5a', '#ff6b6b', '#ff5c9a', '#e070ff'];

css(`
body{background:radial-gradient(110% 70% at 50% 10%,#3a2c20 0%,#1c1612 65%,#120e0b 100%)}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:800;color:#2a1b0c;background:#f0b35a}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.12);color:#f6e2c4}
.hc-top .hc-bar{background:rgba(255,255,255,.12);height:8px}.hc-top .hc-bar i{background:linear-gradient(90deg,#e0913a,#f6d36a)}
#lf{position:fixed;inset:0;z-index:2;font-family:'Baloo 2',system-ui,sans-serif;color:#f6e2c4;pointer-events:none}
#stat{position:absolute;left:12px;right:12px;display:flex;gap:10px;align-items:stretch;pointer-events:auto}
#hp,#xp{flex:1;background:rgba(0,0,0,.28);border:1px solid rgba(255,220,170,.14);border-radius:14px;padding:6px 10px;position:relative;overflow:hidden}
#hp .lab,#xp .lab{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.65;font-weight:800}
#hp b,#xp b{font-size:22px;line-height:1;font-variant-numeric:tabular-nums}
#hp .bar,#xp .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);margin-top:5px;overflow:hidden}
#hp .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff5d6c,#ff9a8a);transition:width .25s}
#xp .bar i{display:block;height:100%;background:linear-gradient(90deg,#f0b35a,#ffe08a);transition:width .25s}
#xp.ready{border-color:#ffd56a;box-shadow:0 0 0 2px rgba(255,213,106,.5),0 0 22px rgba(255,213,106,.45);animation:lfglow 1s ease-in-out infinite;cursor:pointer}
#xp .go{display:none;position:absolute;right:8px;top:6px;background:#ffd56a;color:#2a1b0c;font-weight:800;font-size:12px;border-radius:9px;padding:1px 8px}
#xp.ready .go{display:block}
@keyframes lfglow{50%{transform:scale(1.03)}}
#hp.hurt{animation:lfhurt .35s}
@keyframes lfhurt{25%{transform:translateX(-6px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
#book{position:absolute;left:6px;right:6px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;font-size:13px;font-weight:700}
#book span{display:flex;align-items:center;gap:1px;background:rgba(0,0,0,.22);border-radius:10px;padding:1px 6px 0 3px;white-space:nowrap}
#book span i{font-style:normal;font-size:15px}
#book span em{font-style:normal;opacity:.55;font-size:11px;margin-left:2px}
#book span.gone{opacity:.3}
#grid{position:absolute;display:grid;gap:3px;pointer-events:auto;touch-action:none}
.c{position:relative;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;line-height:1;cursor:pointer;
 background:linear-gradient(160deg,#7a634c,#5c4936);box-shadow:inset 0 2px 0 rgba(255,235,200,.22),inset 0 -3px 0 rgba(0,0,0,.25),0 2px 3px rgba(0,0,0,.35);transition:background .2s,transform .15s}
.c:active{transform:scale(.93)}
.c.o{background:#2a211a;box-shadow:inset 0 2px 5px rgba(0,0,0,.5);cursor:default}
.c.o.z{background:#241c16}
.c .n{font-size:calc(var(--cs) * .5)}
.c .e{font-size:calc(var(--cs) * .6)}
.c .tag{font-size:calc(var(--cs) * .44);color:#ffe08a;text-shadow:0 1px 0 rgba(0,0,0,.6)}
.c .bones{position:absolute;right:2px;bottom:1px;font-size:calc(var(--cs) * .28);opacity:.6;filter:grayscale(1)}
.c.boss{background:radial-gradient(circle at 50% 40%,#6b3b8a,#2c1838);box-shadow:0 0 0 2px #c77dff,0 0 18px rgba(199,125,255,.55)}
.c.boss .e{font-size:calc(var(--cs) * .72);animation:lfbob 1.6s ease-in-out infinite}
.c.boss .lv{position:absolute;right:-4px;top:-6px;background:#c77dff;color:#fff;font-size:12px;border-radius:9px;padding:1px 5px}
@keyframes lfbob{50%{transform:translateY(-3px) scale(1.06)}}
.c.item .e{animation:lfbob 1.2s ease-in-out infinite}
.c.pop{animation:lfpop .32s ease-out}
@keyframes lfpop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
.c.hit{animation:lfhit .4s}
@keyframes lfhit{0%{transform:scale(1.25) rotate(-6deg);background:#ff5d6c}100%{transform:scale(1)}}
#bar{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:12px;pointer-events:auto}
#bar button{font:inherit;font-weight:800;font-size:16px;color:#f6e2c4;background:rgba(0,0,0,.28);border:1px solid rgba(255,220,170,.2);border-radius:24px;padding:9px 18px;cursor:pointer}
#bar button.on{background:#ffd56a;color:#2a1b0c}
#tip{position:absolute;left:24px;right:24px;text-align:center;font-size:13px;opacity:.55;font-weight:600;line-height:1.3}
#pick{position:absolute;left:8px;right:8px;display:none;justify-content:center;gap:5px;pointer-events:auto;flex-wrap:wrap}
#pick.on{display:flex}
#pick button{font:inherit;font-weight:800;width:34px;height:40px;border-radius:10px;border:0;background:#3a2c20;color:#ffe08a;font-size:18px;box-shadow:0 2px 0 rgba(0,0,0,.4);cursor:pointer}
.hc-card{background:linear-gradient(180deg,rgba(20,14,10,.72),rgba(20,14,10,.86))!important}
`);
const root = document.createElement('div'); root.id = 'lf';
root.innerHTML = `<div id="stat"><div id="hp"><div class="lab">hearts</div><b>5/5</b><div class="bar"><i></i></div></div><div id="xp"><div class="lab">level <span data-pl>1</span> · xp</div><b>0/5</b><div class="bar"><i></i></div><div class="go">LEVEL UP</div></div></div>
<div id="book"></div><div id="grid"></div><div id="pick"></div><div id="bar"><button data-tag>🏷️ Tag</button></div><div id="tip"></div>`;
document.body.appendChild(root);
const $ = (s) => root.querySelector(s);
const grid = $('#grid'), book = $('#book'), hpEl = $('#hp'), xpEl = $('#xp'), pick = $('#pick'), tagBtn = $('[data-tag]');
pick.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => `<button data-v="${v}">${v}</button>`).join('') + '<button data-v="0">✕</button>';

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, W = 8, H = 10, cells = [], hp = 5, maxHp = 5, plvl = 1, xp = 0, gained = 0, totalXp = 1;
let tagMode = false, tagCell = -1, recorded = false, beatenShown = false, bossIdx = -1, cs = 40;
const need = () => 3 + plvl * 2;
const nbrs = (i) => { const x = i % W, y = (i / W) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) o.push(ny * W + nx); } return o; };

function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 4 : level, r = rngf(D.seed || level * 104729 + 17);
  W = L <= 1 ? 8 : 9; H = L <= 1 ? 10 : L <= 2 ? 11 : 12;
  const grow = 1 + Math.min(0.6, (L - 1) * 0.07);
  // monster counts per level 1..9 (bigger boards and the flow multiplier add more of the mid and high levels)
  const base = [0, 8, 5, 4, 3, 3, 2, 2, 1, 1];
  const counts = base.map((c, lv) => lv === 0 || (lv >= 8 && L < 3) ? 0 : Math.max(1, Math.round(c * (W * H / 80) * (lv <= 2 ? 1 : grow * fk))));
  const bossLv = Math.max(9, Math.min(17, Math.round((8 + L) * fk)));
  cells = Array.from({ length: W * H }, () => ({ k: 'empty', lv: 0, open: false, dead: false, got: false, tag: 0, n: 0 }));
  // safe start pocket (3×3) in a random spot away from the boss
  const sx = 1 + Math.floor(r() * (W - 2)), sy = H - 2 - Math.floor(r() * 2), start = sy * W + sx;
  const safe = new Set([start, ...nbrs(start)]);
  // boss in the upper half
  do { bossIdx = Math.floor(r() * W) + Math.floor(r() * Math.floor(H / 2.5)) * W + W; } while (safe.has(bossIdx));
  cells[bossIdx] = { ...cells[bossIdx], k: 'boss', lv: bossLv, open: true };
  const free = []; for (let i = 0; i < W * H; i++) if (!safe.has(i) && i !== bossIdx) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  let fi = 0;
  for (let lv = 1; lv <= 9; lv++) for (let c = 0; c < counts[lv] && fi < free.length - 6; c++) { const i = free[fi++]; cells[i].k = 'mon'; cells[i].lv = lv; }
  const potions = 2 + (L > 2 ? 1 : 0), chests = 2;
  for (let c = 0; c < potions; c++) cells[free[fi++]].k = 'potion';
  for (let c = 0; c < chests; c++) cells[free[fi++]].k = 'chest';
  cells.forEach((c, i) => c.n = nbrs(i).reduce((a, j) => a + (cells[j].k === 'mon' || cells[j].k === 'boss' ? cells[j].lv : 0), 0));
  totalXp = cells.reduce((a, c) => a + (c.k === 'mon' ? c.lv : 0), 0);
  hp = maxHp = 5; plvl = 1; xp = 0; gained = 0; score = 0; tagMode = false; tagCell = -1; recorded = false; beatenShown = false;
  tagBtn.classList.remove('on'); pick.classList.remove('on');
  grid.innerHTML = ''; cells.forEach((c, i) => { const d = document.createElement('div'); d.className = 'c'; d.dataset.i = i; grid.appendChild(d); c.el = d; });
  refresh(); layout(); flood(start, true); cells.forEach((_, i) => draw(i));
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  refresh();
}
function layout() {
  const VW = innerWidth, VH = innerHeight, top = 58;
  $('#stat').style.top = top + 'px';
  book.style.top = (top + 74) + 'px';
  const bookH = book.offsetHeight || 44;
  const gy = top + 84 + bookH, avail = VH - gy - 76;
  cs = Math.floor(Math.min((Math.min(VW, 520) - 16 - (W - 1) * 3) / W, (avail - (H - 1) * 3) / H));
  const gw = cs * W + (W - 1) * 3;
  grid.style.cssText += `;grid-template-columns:repeat(${W},${cs}px);grid-auto-rows:${cs}px;left:${(VW - gw) / 2}px;top:${gy}px`;
  grid.style.setProperty('--cs', cs + 'px');
  const gb = gy + cs * H + (H - 1) * 3;
  $('#bar').style.top = (gb + 14) + 'px'; $('#tip').style.top = (gb + 70) + 'px'; pick.style.top = (gb + 8) + 'px';
}
addEventListener('resize', () => cells.length && layout());

function draw(i) {
  const c = cells[i], d = c.el;
  d.className = 'c' + (c.open ? ' o' : '') + (c.open && c.n === 0 && c.k !== 'boss' ? ' z' : '') + (c.k === 'boss' && !c.dead ? ' boss' : '') + (c.open && !c.got && (c.k === 'potion' || c.k === 'chest') ? ' item' : '');
  if (!c.open) { d.innerHTML = c.tag ? `<span class="tag">${c.tag}</span>` : ''; return; }
  if (c.k === 'boss' && !c.dead) { d.innerHTML = `<span class="e">${BOSS[0]}</span><span class="lv">${c.lv}</span>`; return; }
  if ((c.k === 'potion' || c.k === 'chest') && !c.got) { d.innerHTML = `<span class="e">${c.k === 'potion' ? '🧪' : '💎'}</span>`; return; }
  const corpse = c.k === 'mon' || c.k === 'boss' ? `<span class="bones">${(c.k === 'boss' ? BOSS : MON[c.lv])[0]}</span>` : '';
  d.innerHTML = (c.n ? `<span class="n" style="color:${NUMC[Math.min(9, Math.ceil(c.n / 3))]}">${c.n}</span>` : '') + corpse;
}
const TIPS = ['Leveling up refills every heart: save it for when you are hurt.', 'A number is the sum of the monster levels on the 8 tiles around it.', 'Beaten monsters leave their number behind. Use it.', 'Tag a stone with your guess so you remember it.', 'The boss only falls when your hearts are at least its level.'];
function refresh() {
  $('#tip').textContent = TIPS[(plvl + Math.floor(gained / 12)) % TIPS.length];
  hpEl.querySelector('b').textContent = `${Math.max(0, hp)}/${maxHp}`; hpEl.querySelector('i').style.width = Math.max(0, hp) / maxHp * 100 + '%';
  xpEl.querySelector('b').textContent = `${xp}/${need()}`; xpEl.querySelector('i').style.width = Math.min(1, xp / need()) * 100 + '%';
  xpEl.querySelector('[data-pl]').textContent = plvl; xpEl.classList.toggle('ready', xp >= need() && state === 'play');
  const left = {}; cells.forEach(c => { if (c.k === 'mon' && !c.dead) left[c.lv] = (left[c.lv] || 0) + 1; });
  const all = {}; cells.forEach(c => { if (c.k === 'mon') all[c.lv] = (all[c.lv] || 0) + 1; });
  book.innerHTML = Object.keys(all).map(lv => `<span class="${left[lv] ? '' : 'gone'}"><i>${MON[lv][0]}</i>${lv}<em>×${left[lv] || 0}</em></span>`).join('') + `<span><i>${BOSS[0]}</i>${cells[bossIdx].lv}<em>boss</em></span>`;
  ui.progress(gained / totalXp);
}

// ---------------------------------------------------------------- actions
function flood(i, silent) {
  const st = [i], seen = new Set(); let k = 0;
  while (st.length) {
    const j = st.pop(); if (seen.has(j)) continue; seen.add(j);
    const c = cells[j]; if (c.k === 'mon' || c.k === 'boss') continue;
    if (!c.open) { c.open = true; c.tag = 0; draw(j); if (!silent) { const d = c.el; setTimeout(() => { d.classList.add('pop'); }, k * 12); k++; } }
    if (c.n === 0 && c.k === 'empty') nbrs(j).forEach(q => { if (!cells[q].open) st.push(q); });
  }
  return k;
}
function cellCenter(i) { const b = cells[i].el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }
function step(i) {
  if (state !== 'play') return;
  const c = cells[i];
  if (tagMode && !c.open) { tagCell = i; pick.classList.add('on'); soft.click(); return; }
  if (c.k === 'boss' && !c.dead) return fight(i);
  if (c.open) {
    if ((c.k === 'potion' || c.k === 'chest') && !c.got) collect(i);
    return;
  }
  if (c.k === 'mon') { c.open = true; return fight(i); }
  const k = flood(i, false); soft.wood(); buzz(5);
  if (k > 4) chime(Math.min(8, k / 4), 67, 0.08);
  if (c.k === 'potion' || c.k === 'chest') { c.el.classList.add('pop'); tone(880, 0.08, 'triangle', 0.08, 1.4); }
  refresh();
}
function fight(i) {
  const c = cells[i], [x, y] = cellCenter(i);
  hp -= c.lv; c.dead = true; c.open = true; c.tag = 0;
  draw(i); c.el.classList.remove('hit'); void c.el.offsetWidth; c.el.classList.add('hit');
  hpEl.classList.remove('hurt'); void hpEl.offsetWidth; hpEl.classList.add('hurt');
  ui.pop(`-${c.lv} ❤`, '#ff6b7a', 28, y / innerHeight * 100 - 6);
  fx.sparks(x, y, ['#ff6b7a', '#ffd56a', '#fff'], 10 + c.lv, { speed: 3 + c.lv * 0.3, size: 3 });
  tone(160 - c.lv * 6, 0.16, 'square', 0.1, 0.5); tone(90, 0.2, 'sawtooth', 0.06, 0.6); buzz(20 + c.lv * 6);
  if (hp < 0) { refresh(); return lose(c); }
  if (c.k === 'boss') { refresh(); return win(); }
  xp += c.lv; gained += c.lv; score += c.lv * 10;
  setTimeout(() => { note(72 + c.lv, 0.18, 0.1); fx.ring(x, y, '#ffd56a', cs * 0.6); }, 140);
  if (xp >= need() && xp - c.lv < need()) { ui.pop('LEVEL UP ready!', '#ffd56a', 24, 14); arp([76, 79, 84], 70, 0.08, 0.4); }
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }
  if (hp === 0) ui.pop('Last breath!', '#ff6b7a', 22, 22);
  refresh();
}
function collect(i) {
  const c = cells[i], [x, y] = cellCenter(i); c.got = true; draw(i); c.el.classList.add('pop');
  if (c.k === 'potion') { const h = maxHp - hp; hp = maxHp; ui.pop(`+${h} ❤`, '#ff9aa8', 28, y / innerHeight * 100 - 6); fx.sparks(x, y, ['#ff9aa8', '#fff'], 14, { speed: 3, size: 3 }); arp([72, 76, 79, 84], 60, 0.1, 0.5); }
  else { xp += 5; score += 50; ui.pop('+5 XP', '#ffe08a', 28, y / innerHeight * 100 - 6); fx.sparks(x, y, ['#7af0ff', '#ffe08a', '#fff'], 16, { speed: 3.5, size: 3 }); arp([79, 83, 86, 91], 60, 0.1, 0.5); }
  buzz(10); refresh();
}
function levelUp() {
  if (state !== 'play' || xp < need()) return;
  xp -= need(); plvl++; maxHp++; hp = maxHp;
  const b = xpEl.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#ffd56a', '#fff', '#ff9a8a'], 26, { speed: 5, size: 4 });
  ui.pop(`LEVEL ${plvl}! ❤ ${maxHp}`, '#ffd56a', 34, 22); ui.flash(0.25); arp([67, 72, 76, 79, 84], 70, 0.12, 0.6); buzz([15, 40, 15]);
  refresh();
}
xpEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); levelUp(); });
grid.addEventListener('pointerdown', (e) => { const d = e.target.closest('.c'); if (!d) return; step(+d.dataset.i); });
tagBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); tagMode = !tagMode; tagBtn.classList.toggle('on', tagMode); pick.classList.remove('on'); soft.click(); });
pick.addEventListener('pointerdown', (e) => { e.stopPropagation(); const b = e.target.closest('button'); if (!b || tagCell < 0) return; cells[tagCell].tag = +b.dataset.v; draw(tagCell); pick.classList.remove('on'); tagCell = -1; soft.click(); });

function slain() { return gained / totalXp; }
function revealAll() { cells.forEach((c, i) => { if (!c.open) { c.open = true; if (c.k === 'mon') c.el.innerHTML = ''; } }); cells.forEach((c, i) => { if (c.k === 'mon' && !c.dead) { c.el.className = 'c o'; c.el.innerHTML = `<span class="e">${MON[c.lv][0]}</span>`; } else draw(i); }); }
function win() {
  if (state !== 'play') return;
  state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  const bonus = 200 + Math.max(0, hp) * 20; score += bonus;
  const [x, y] = cellCenter(bossIdx); fx.sparks(x, y, ['#c77dff', '#ffd56a', '#fff'], 40, { speed: 6, size: 4 });
  arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); fx.confetti(140, ['#ffd56a', '#c77dff', '#ff9a8a', '#7af0ff', '#fff']); ui.flash(0.4); buzz([30, 60, 30]);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); }
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  refresh(); D.won(score); B.submit(1);   // world board: fields cleared today
  ui.win(D.isDaily ? '' : level - 1, `${score} pts · hero level ${plvl} · ${Math.max(0, hp)} hearts left`);
}
function lose(c) {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, slain()); }
  ui.flash(0.5); document.body.animate([{ filter: 'none' }, { filter: 'saturate(0) brightness(.7)' }], { duration: 600, fill: 'forwards' });
  setTimeout(revealAll, 250); refresh();
  ui.lose('Defeated', `A ${(c.k === 'boss' ? BOSS : MON[c.lv])[1]} (level ${c.lv}) was too strong · ${Math.round(slain() * 100)}% slain`);
}
ui.onTap((which) => {
  B.start();
  document.body.getAnimations().forEach(a => a.cancel());
  if (which === 'start') { state = 'play'; refresh(); return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play'; refresh();
});
build();

// ---------------------------------------------------------------- test hook: a careful player who peeks at nothing it couldn't deduce… mostly
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get dbg() { return { hp, maxHp, xp, need: need(), plvl, gained, totalXp, left: cells.filter(c => c.k === 'mon' && !c.dead).map(c => c.lv).join(''), hidden: cells.filter(c => !c.open).length }; },
  bot() {
    if (state !== 'play') return;
    if (cells[bossIdx].lv <= hp) return step(bossIdx);
    const front = new Set(); cells.forEach((c, i) => { if (c.open) nbrs(i).forEach(j => { if (!cells[j].open) front.add(j); }); });
    const F_ = [...front];
    const item = cells.findIndex(c => c.open && !c.got && c.k === 'chest');
    if (item >= 0) return step(item);
    // a hidden tile next to the open area whose numbered neighbours prove it is empty
    const bound = (j) => Math.min(99, ...nbrs(j).filter(q => cells[q].open && cells[q].k !== 'boss').map(q => cells[q].n - nbrs(q).reduce((a, z) => a + (cells[z].open && (cells[z].k === 'mon' || cells[z].k === 'boss') ? cells[z].lv : 0), 0)));
    let safe = F_.find(j => bound(j) === 0); if (safe !== undefined) return step(safe);
    const weak = F_.filter(j => cells[j].k !== 'mon' || cells[j].lv <= hp).sort((a, b) => (cells[a].k === 'mon' ? cells[a].lv : 0) - (cells[b].k === 'mon' ? cells[b].lv : 0));
    if (weak.length) return step(weak[0]);
    if (xp >= need()) return levelUp();
    const pot = cells.findIndex(c => c.open && !c.got && c.k === 'potion'); if (pot >= 0) return step(pot);
    const any = cells.findIndex(c => !c.open && (c.k !== 'mon' || c.lv <= hp)); if (any >= 0) return step(any);
    step(F_[0] ?? bossIdx);
  },
};
