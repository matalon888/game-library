// Petalword — original seven-letter word flower. Make words of 4+ letters from the seven petals; every word must use
// the golden center letter, letters can repeat. Four-letter words score 1, longer words score their length, and a word
// that uses all seven letters (a "full bloom") scores 7 extra. Climb the rank ladder; the daily flower is the same for everyone.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { SAFE } from './safe.js';
import { WORDS } from './words.js';

const NAME = 'Petalword: Seven Letter Word Puzzle';
const S = store('petalword');
const F = flow('petalword');
const ui = createUI({ title: 'Petalword', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#e5679a' });
const D = daily('petalword', ui, { name: NAME });
const B = board({ game: 'petalword', label: 'Points', limits: { maxRun: 600, maxPerSec: 8 }, mode: 'best' });   // world board: best flower score today (RULES.md part C)
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily flower' : 'seven-letter word puzzle', doneLine: doneToday ? `Today · ${doneToday.p} pts · ${doneToday.r}` : null });
{ const p = document.createElement('p'); p.textContent = 'Words of 4+ letters, always with the center letter'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily flower<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'FLOWER <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'In bloom!';
ui.els.win.querySelector('.hint').textContent = 'Tap for a new flower';
const keepBtn = document.createElement('button'); keepBtn.className = 'hc-btn'; keepBtn.textContent = 'Keep finding words'; keepBtn.style.cssText = 'margin-top:10px;background:rgba(255,255,255,.16);box-shadow:none;border:1px solid rgba(255,255,255,.35)';
keepBtn.addEventListener('pointerdown', e => e.stopPropagation());
keepBtn.addEventListener('click', e => { e.stopPropagation(); ui.els.win.classList.add('hc-hidden'); state = 'play'; });
ui.els.win.querySelector('.hint').before(keepBtn);

// ---------------------------------------------------------------- puzzles
const SAFESET = new Set(SAFE), CORE = WORDS.slice(0, 5911).filter(w => SAFESET.has(w));   // SCOWL levels 10 + 20: everyday words only
const FOUR = CORE.filter(w => w.length >= 4 && !w.includes('s'));
const PANS = CORE.filter(w => w.length === 7 && new Set(w).size === 7 && !w.includes('s'));
const rngf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
function makeFlower(seed) {
  const r = rngf(seed); r(); r();
  for (let t = 0; t < 300; t++) {
    const p = PANS[Math.floor(r() * PANS.length)], L = [...new Set(p)];
    const center = L[Math.floor(r() * 7)]; if ('jqxz'.includes(center)) continue;
    const set = new Set(L), words = FOUR.filter(w => w.includes(center) && [...w].every(ch => set.has(ch)));
    if (words.length < 15 || words.length > 60) continue;
    const outer = L.filter(c => c !== center); for (let k = 5; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [outer[k], outer[j]] = [outer[j], outer[k]]; }
    return { center, outer, words, set };
  }
}
const isPan = (w) => new Set(w).size === 7;
const PTS = (w) => (w.length === 4 ? 1 : w.length) + (isPan(w) ? 7 : 0);
const RANKS = [['Seed', 0], ['Sprout', 0.02], ['Shoot', 0.05], ['Leaf', 0.09], ['Bloom', 0.15], ['Blossom', 0.25], ['Bouquet', 0.4], ['Garden', 0.55], ['Meadow', 0.75]];

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#3b2a3a}
body{background:radial-gradient(120% 70% at 50% 0%,#fff8f2 0%,#fde9ef 55%,#f6dbe8 100%)}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#e5679a;box-shadow:0 2px 6px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:#fff;color:#e5679a}.hc-top .hc-bar{background:rgba(160,80,120,.12);height:8px}.hc-top .hc-bar i{background:#e5679a}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#b07a93;text-shadow:none;opacity:1}
#rank{position:fixed;z-index:4;left:16px;right:16px;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px}
#rank b{font-size:17px;min-width:76px;color:#3b2a3a}
#rank .lad{flex:1;position:relative;height:22px;display:flex;align-items:center;justify-content:space-between}
#rank .lad:before{content:'';position:absolute;left:4px;right:4px;height:2px;background:#ebcbd9}
#rank .lad i{position:relative;width:9px;height:9px;border-radius:50%;background:#ebcbd9;font-style:normal;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;color:#fff;transition:all .3s}
#rank .lad i.on{background:#e5679a}
#rank .lad i.cur{width:28px;height:28px;background:#e5679a;box-shadow:0 3px 10px rgba(229,103,154,.45)}
#rank .lad i.goal:not(.on){background:#fff;border:2px solid #e5679a;width:13px;height:13px}
#list{position:fixed;z-index:4;left:16px;right:16px;max-width:520px;margin:0 auto;border-radius:16px;background:rgba(255,255,255,.75);border:1px solid #f1d4e1;padding:10px 12px;font-size:14px;color:#7d6574;overflow:hidden;cursor:pointer}
#list .hd{display:flex;justify-content:space-between;font-weight:700}
#list .ws{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;text-transform:capitalize;color:#3b2a3a;font-weight:600}
#list .ws .pan{color:#d0457f;font-weight:800}
#list .ws .miss{color:#c0a6b3;font-weight:500}
#list.open{bottom:120px!important;height:auto!important;overflow:auto;box-shadow:0 18px 40px rgba(120,40,80,.18);z-index:7;background:#fffaf8}
#entry{position:fixed;z-index:4;left:0;right:0;text-align:center;font-weight:800;font-size:32px;letter-spacing:2px;text-transform:uppercase;height:44px;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;white-space:nowrap}
#entry .c{color:#d99a1a}#entry .x{color:#c9b3bf}
#entry .caret{display:inline-block;width:3px;height:30px;background:#e5679a;vertical-align:-4px;margin-left:3px;animation:blink 1s steps(1) infinite}
#entry.bad{animation:shake .35s}
@keyframes blink{50%{opacity:0}}
@keyframes shake{20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
#flower{position:fixed;z-index:3;touch-action:manipulation}
#flower svg{width:100%;height:100%;overflow:visible}
#flower .pt{cursor:pointer;transition:transform .12s}
#flower .pt text{font-weight:800;text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;pointer-events:none}
#flower .pt.press{transform:scale(.9)}
#toast{position:fixed;left:50%;z-index:9;transform:translateX(-50%);background:#3b2a3a;color:#fff;font-weight:700;font-size:15px;padding:8px 16px;border-radius:12px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}
#toast.show{opacity:1}#toast.good{background:#e5679a}
#ctl{position:fixed;z-index:4;left:0;right:0;display:flex;justify-content:center;gap:12px}
#ctl button{height:52px;min-width:96px;border-radius:26px;border:1.5px solid #e9c6d6;background:#fff;color:#3b2a3a;font:inherit;font-weight:800;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 18px;box-shadow:0 3px 0 #efd6e1}
#ctl button.round{min-width:52px;width:52px;padding:0}
#ctl button svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ctl button:active{transform:translateY(2px);box-shadow:none}
#pts{position:fixed;z-index:6;right:12px;top:calc(60px + env(safe-area-inset-top));height:30px;display:flex;align-items:center;border-radius:16px;font-weight:800;font-size:15px;padding:0 12px;background:#fff;color:#e5679a;box-shadow:0 2px 8px rgba(120,40,80,.12);pointer-events:none;font-variant-numeric:tabular-nums}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(80,30,58,.74),rgba(56,20,42,.88))}
`);
const rankEl = document.createElement('div'); rankEl.id = 'rank'; document.body.appendChild(rankEl);
const listEl = document.createElement('div'); listEl.id = 'list'; document.body.appendChild(listEl);
const entry = document.createElement('div'); entry.id = 'entry'; document.body.appendChild(entry);
const flowerEl = document.createElement('div'); flowerEl.id = 'flower'; document.body.appendChild(flowerEl);
const ctl = document.createElement('div'); ctl.id = 'ctl'; document.body.appendChild(ctl);
const toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast);
let toastT = 0;
function say(t, cls = '', ms = 1300) { toast.textContent = t; toast.className = 'show ' + cls; clearTimeout(toastT); toastT = setTimeout(() => (toast.className = ''), ms); }
const mk = (cls, html, fn, label) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = html; if (label) b.setAttribute('aria-label', label); b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); ctl.appendChild(b); return b; };
mk('', 'Delete', () => del());
mk('round', '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/></svg>', () => shuffle(), 'Shuffle');
mk('', 'Enter', () => enter());
listEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); listEl.classList.toggle('open'); paintList(); });

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), P = null, found = [], cur = '', points = 0, maxPts = 1, goal = 0.15, cleared = false, recorded = false, beatenShown = false, t0 = performance.now(), key = '';
let petals = [], geo = {};

function build() {
  const seed = D.isDaily ? D.seed * 11 + 5 : level * 6007 + 29;
  P = makeFlower(seed);
  maxPts = P.words.reduce((a, w) => a + PTS(w), 0);
  // flow (honest difficulty): the rank that clears this flower. With the world board on, F.k() is 1 for everyone → Bloom.
  goal = D.isDaily ? 0.15 : Math.min(0.25, Math.max(0.09, 0.15 * F.k()));
  key = D.isDaily ? 'd' + D.seed : 'l' + level;
  const saved = S.get('found', null);
  found = saved && saved.k === key ? saved.w.filter(w => P.words.includes(w)) : [];
  points = found.reduce((a, w) => a + PTS(w), 0); cur = ''; cleared = points >= Math.ceil(goal * maxPts); recorded = cleared; beatenShown = false; t0 = performance.now();
  ui.levels(D.isDaily ? 1 : level);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const d = new Date();
  ui.sub(D.isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `Flower #${level}`);
  listEl.classList.remove('open');
  drawFlower(); layout(); hud(); paintEntry();
}
const rankIdx = () => { let k = 0; RANKS.forEach(([, f], i) => { if (points >= Math.ceil(f * maxPts)) k = i; }); return k; };
const goalIdx = () => RANKS.findIndex(([, f]) => f >= goal - 1e-9);
function hud() {
  const k = rankIdx(), gi = goalIdx();
  rankEl.innerHTML = `<b>${RANKS[k][0]}</b><div class="lad">${RANKS.map((_, i) => `<i class="${i <= k ? 'on' : ''} ${i === k ? 'cur' : ''} ${i === gi ? 'goal' : ''}">${i === k ? points : ''}</i>`).join('')}</div>`;
  ui.progress(Math.min(1, points / Math.max(1, Math.ceil(goal * maxPts))));
  paintList();
}
function paintList() {
  const open = listEl.classList.contains('open'), sorted = open ? found.slice().sort() : found.slice().reverse();
  const done = state === 'won' || state === 'lost';
  const miss = open && done ? P.words.filter(w => !found.includes(w)) : [];
  listEl.innerHTML = `<div class="hd"><span>You found ${found.length} word${found.length === 1 ? '' : 's'}</span><span>${open ? '▲' : '▼'}</span></div>
    <div class="ws">${found.length ? '' : '<span class="miss" style="text-transform:none">Tap petals to spell words. The golden center letter is a must.</span>'}${sorted.map(w => `<span class="${isPan(w) ? 'pan' : ''}">${w}</span>`).join('')}${miss.map(w => `<span class="miss">${w}</span>`).join('')}</div>`;
}
function paintEntry(cls = '') {
  entry.className = cls;
  entry.innerHTML = [...cur].map(ch => `<span class="${ch === P.center ? 'c' : P.set.has(ch) ? '' : 'x'}">${ch}</span>`).join('') + '<span class="caret"></span>';
}
function drawFlower() {
  const R = 100, pr = 46;   // svg units: petal distance + petal radius
  let s = `<svg viewBox="-170 -170 340 340">`;
  s += `<defs><radialGradient id="pg" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff4f8"/><stop offset="1" stop-color="#f8bfd5"/></radialGradient>
    <radialGradient id="cg" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#f4b73c"/></radialGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#b04a78" flood-opacity=".22"/></filter></defs>`;
  s += `<path d="M0 60 Q -14 130 -6 168" stroke="#7cc08f" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  P.outer.forEach((ch, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 3, x = Math.cos(a) * R, y = Math.sin(a) * R, deg = a * 180 / Math.PI + 90;
    s += `<g class="pt" data-i="${i}" style="transform-origin:${x}px ${y}px"><ellipse cx="${x}" cy="${y}" rx="${pr}" ry="${pr * 1.18}" transform="rotate(${deg} ${x} ${y})" fill="url(#pg)" stroke="#f1a9c6" stroke-width="2" filter="url(#sh)"/>
      <text x="${x}" y="${y + 13}" text-anchor="middle" font-size="40" fill="#5b2f47">${ch}</text></g>`;
  });
  s += `<g class="pt" data-i="c" style="transform-origin:0 0"><circle r="${pr + 8}" fill="url(#cg)" stroke="#e6a02a" stroke-width="2.5" filter="url(#sh)"/>
    ${Array.from({ length: 14 }, (_, k) => { const a = k / 14 * 6.283; return `<circle cx="${Math.cos(a) * 40}" cy="${Math.sin(a) * 40}" r="2.4" fill="#e6a02a" opacity=".5"/>`; }).join('')}
    <text x="0" y="14" text-anchor="middle" font-size="44" fill="#5a3a06">${P.center}</text></g></svg>`;
  flowerEl.innerHTML = s;
  petals = [...flowerEl.querySelectorAll('.pt')];
  petals.forEach(g => g.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const i = g.dataset.i; type(i === 'c' ? P.center : P.outer[+i]); g.classList.add('press'); setTimeout(() => g.classList.remove('press'), 120); }));
}
function layout() {
  const W = innerWidth, H = innerHeight;
  const ctlY = H - Math.max(20, H * 0.032) - 52; ctl.style.top = ctlY + 'px';
  rankEl.style.top = '100px';
  listEl.style.top = '140px'; listEl.style.height = '62px'; listEl.style.bottom = '';
  const top = 224, fs = Math.min(W - 40, 380, ctlY - 24 - (top + 50));
  const fy = top + 50 + Math.max(0, ((ctlY - 24 - (top + 50)) - fs) * 0.4);
  entry.style.top = fy - 46 + 'px';
  Object.assign(flowerEl.style, { left: (W - fs) / 2 + 'px', top: fy + 'px', width: fs + 'px', height: fs + 'px' });
  toast.style.top = '214px';
  geo = { fs };
}
addEventListener('resize', () => P && layout());

// ---------------------------------------------------------------- play
function type(ch) { if (state !== 'play' || cur.length >= 19) return; cur += ch; chime(cur.length - 1, ch === P.center ? 72 : 67, 0.09); buzz(4); paintEntry(); }
function del() { if (state !== 'play' || !cur) return; cur = cur.slice(0, -1); soft.click(); paintEntry(); }
function shuffle() {
  if (state !== 'play') return;
  for (let k = 5; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [P.outer[k], P.outer[j]] = [P.outer[j], P.outer[k]]; }
  petals.forEach(g => { const i = g.dataset.i; if (i !== 'c') { g.querySelector('text').textContent = P.outer[+i]; g.animate([{ opacity: 0.2, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' }); } });
  soft.swish();
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || state !== 'play') return;
  if (e.key === 'Enter') enter(); else if (e.key === 'Backspace') del(); else if (e.key === ' ') shuffle(); else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
});
function bad(msg) { entry.classList.remove('bad'); void entry.offsetWidth; paintEntry('bad'); say(msg); soft.err(); buzz(20); setTimeout(() => { cur = ''; paintEntry(); }, 450); }
const PRAISE = { 4: 'Good!', 5: 'Nice!', 6: 'Great!', 7: 'Lovely!' };
function enter() {
  if (state !== 'play' || !cur) return;
  const w = cur;
  if (w.length < 4) return bad('Too short');
  if (![...w].every(ch => P.set.has(ch))) return bad('Use the petal letters');
  if (!w.includes(P.center)) return bad('Missing center letter');
  if (found.includes(w)) return bad('Already found');
  if (!P.words.includes(w)) return bad('Not in our word list');
  const before = rankIdx(), p = PTS(w);
  found.push(w); points += p; cur = ''; paintEntry();
  S.set('found', { k: key, w: found });
  B.submit(points, { ms: performance.now() - t0 });   // best mode: today's best flower score (the server sees the time it took)
  if (D.isDaily) S.set('daily_' + todayKey(), { p: points, r: RANKS[rankIdx()][0] });
  const r = flowerEl.getBoundingClientRect();
  if (isPan(w)) { say(`Full bloom! +${p}`, 'good', 1800); fx.confetti(90); arp([67, 71, 74, 79, 83, 86], 80, 0.12, 0.8); buzz([20, 40, 20]); petals.forEach((g, i) => g.animate([{ transform: 'none' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 500, delay: i * 50 })); }
  else { say(`${PRAISE[Math.min(7, w.length)]} +${p}`, 'good'); fx.sparks(r.left + r.width / 2, r.top + r.height / 2, ['#fff', '#f8bfd5', '#ffd36e'], 10 + p, { speed: 3, size: 3 }); arp([67, 72, 76].slice(0, Math.min(3, w.length - 2)), 60, 0.1); buzz(10); }
  hud();
  const after = rankIdx();
  if (after > before && !isPan(w)) ui.pop(RANKS[after][0] + '!', '#e5679a', 34, 30);
  if (!beatenShown && D.beaten(points)) { beatenShown = true; ui.pop('BEATEN!', '#e5679a', 40, 22); fx.confetti(60); }
  if (!cleared && points >= Math.ceil(goal * maxPts)) clear();
}
function clear() {
  cleared = true; state = 'won';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  fx.confetti(); arp([67, 72, 76, 79, 84], 90, 0.12, 0.8);
  D.won(points, `reached ${RANKS[rankIdx()][0]} on ${D.isDaily ? "today's flower" : `flower #${level}`} with`);
  const lv = level;
  if (!D.isDaily) { level++; S.set('level', level); }
  ui.els.win.querySelector('.hint').textContent = D.isDaily ? 'Tap to go back to my flowers' : 'Tap for a new flower';
  ui.win(D.isDaily ? '' : lv, `${RANKS[rankIdx()][0]} · ${found.length} words · ${points} pts`);
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; t0 = performance.now(); return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot spells one unfound word, one petal every ~0.24 s
let botWord = null, botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return points; },
  bot() {
    if (state !== 'play' || (botTick++ % 2)) return;
    if (!botWord) { const open = P.words.filter(w => !found.includes(w)); if (!open.length) return; open.sort((a, b) => PTS(b) - PTS(a)); botWord = open[Math.floor(Math.random() * Math.min(open.length, found.length ? 6 : 1))]; cur = ''; paintEntry(); }
    if (cur.length < botWord.length) type(botWord[cur.length]); else { botWord = null; enter(); }
  },
};
