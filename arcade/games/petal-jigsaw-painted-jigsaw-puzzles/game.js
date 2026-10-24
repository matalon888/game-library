// Petal Jigsaw — calm jigsaw puzzles of hand-painted storybook gardens (style C · Storybook Garden).
// 36–196 real knob-shaped pieces cut in code from 16 painted scenes; drag (or tap, then tap the spot) from the tray,
// pieces snap home; edge filter, ghost image, peek, pinch / double-tap zoom, optional rotation. Untimed, no fail.
// Journey of puzzles, gallery chapters unlocked by stars, a stamp album, a daily puzzle with a streak + weekly freeze.
import { money } from './kit/money.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { flow } from './kit/flow.js';
import { A, $, h, eat, theme, icon, toast, sheet, sheetOpen, toggleRow, snd, music, saved, dayKey, prettyDay, streakNow, streakWin, freezes, albumSheet, shareText } from './sb.js';

const SLUG = 'petal-jigsaw', NAME = 'Petal Jigsaw';
theme('bg/petal-jigsaw.webp', 'bg/petal-jigsaw-wide.webp');
const M = money({ game: 'petal-jigsaw', style: 'C' });
const D = daily(SLUG, null, { name: NAME });
const B = board({ game: 'petal-jigsaw', label: 'Puzzles completed', limits: { maxRun: 1, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const F = flow(SLUG);   // recorded only: a jigsaw has no fail state and no skill knob (FLOW_BRIEF rule 4)

// ---------------------------------------------------------------- content
const PAINT = [
  ['cottage-june', 'Cottage in June'], ['rose-arbour', 'The Rose Arbour'], ['bluebell-wood', 'Bluebell Wood'], ['duck-pond', 'The Duck Pond'],
  ['lawn-teatime', 'Tea on the Lawn'], ['tea-table', 'Lemon Cake & Tea'], ['conservatory', 'The Conservatory'], ['cat-window', 'Cat on the Sill'],
  ['harbour', 'Little Harbour'], ['lighthouse', 'Cliff Lighthouse'], ['lavender-farm', 'Lavender Farm'], ['spaniel', 'Spaniel in Tulips'],
  ['orchard', 'Apple Orchard'], ['kitchen-garden', 'Kitchen Garden'], ['flower-market', 'Flower Market'], ['snow-cottage', 'Snowy Cottage'],
].map(([id, name], k) => ({ id, name, ch: k >> 2 }));
const CHAP = [{ name: 'Spring Garden', need: 0 }, { name: 'Teatime', need: 3 }, { name: 'Seaside & Country', need: 7 }, { name: 'Turning Seasons', need: 12 }];
const SIZES = [6, 8, 10, 12, 14];                  // 36 · 64 · 100 · 144 · 196 pieces
const tier = n => n >= 14 ? 3 : n >= 10 ? 2 : 1;   // stars a size earns for its painting
const coinsFor = n => ({ 6: 20, 7: 25, 8: 30, 9: 38, 10: 45, 12: 60, 14: 80 })[n] || 30;
const STAMPS = [
  ['robin', 'Robin', 'First puzzle', s => s.solved >= 1], ['rose', 'Rose', '5 puzzles', s => s.solved >= 5],
  ['teapot', 'Teapot', '10 puzzles', s => s.solved >= 10], ['cottage', 'Cottage', '25 puzzles', s => s.solved >= 25],
  ['bluetit', 'Blue tit', '50 puzzles', s => s.solved >= 50], ['bluebells', 'Bluebells', 'Spring Garden', s => chapDone(0)],
  ['teacup', 'Teacup', 'Teatime chapter', s => chapDone(1)], ['sailboat', 'Sailboat', 'Seaside chapter', s => chapDone(2)],
  ['squirrel', 'Squirrel', 'Seasons chapter', s => chapDone(3)], ['butterfly', 'Butterfly', 'First daily', s => s.dailies >= 1],
  ['strawberry', 'Strawberry', '3-day streak', s => (st.streak.best || 0) >= 3], ['sunflower', 'Sunflower', '7-day streak', s => (st.streak.best || 0) >= 7],
  ['lavender', 'Lavender', '100 pieces', s => s.big >= 10], ['hydrangea', 'Hydrangea', '144 pieces', s => s.big >= 12],
  ['peony', 'Peony', '196 pieces', s => s.big >= 14], ['hedgehog', 'Hedgehog', 'Edges first', s => s.edgesFirst],
  ['owl', 'Owl', 'No hints, 64+', s => s.noHint], ['fox', 'Fox', 'With rotation', s => s.rotated],
  ['kingfisher', 'Kingfisher', 'No ghost image', s => s.noGhost], ['beehive', 'Beehive', '3 in one day', s => s.today.n >= 3],
  ['cat', 'Cat', 'Cat on the Sill', s => !!st.done['cat-window']], ['lighthouse', 'Lighthouse', 'Cliff Lighthouse', s => !!st.done.lighthouse],
  ['swan', 'Swan', 'The Duck Pond', s => !!st.done['duck-pond']], ['tulip', 'Tulip', 'Spaniel in Tulips', s => !!st.done.spaniel],
].map(([img, name, how, test]) => ({ id: img, img, name, how, test }));

// ---------------------------------------------------------------- saved state
const st = saved('pj_state', {
  journey: 1, done: {}, stamps: {}, saves: {}, last: null,
  stats: { solved: 0, dailies: 0, big: 0, edgesFirst: false, noHint: false, rotated: false, noGhost: false, today: { d: 0, n: 0 } },
  streak: { n: 0, last: 0, freeWeek: 0, extra: 0, best: 0 }, dailyDone: 0,
  set: { big: false, rotate: false, ghost: true, music: true, sfx: true, zoomTip: false },
});
const applySet = () => { document.documentElement.classList.toggle('big', st.set.big); music.on = st.set.music; snd.sfx = st.set.sfx; };
applySet();
const starsOf = id => (st.done[id] && st.done[id].stars) || 0;
const totalStars = () => PAINT.reduce((a, p) => a + starsOf(p.id), 0);
const chapOpen = k => totalStars() >= CHAP[k].need || !!(st.unlocked && st.unlocked[k]);
const chapDone = k => PAINT.filter(p => p.ch === k).every(p => st.done[p.id]);
const thumb = id => `${A}jig/${id}-thumb.webp`;
const dailyPick = (d = dayKey()) => { let x = d * 2654435761 % 4294967296; x = (x ^ (x >>> 15)) >>> 0; return PAINT[x % PAINT.length]; };
function journeyPlan(n = st.journey) {
  const N = n <= 5 ? 6 : [8, 7, 8, 9, 8, 10][(n - 6) % 6];
  const hard = n > 5 && (n - 6) % 6 === 5;
  const open = PAINT.filter(p => chapOpen(p.ch));
  const cnt = p => (st.done[p.id] && st.done[p.id].n) || 0;
  const min = Math.min(...open.map(cnt));
  const pick = open.find(p => cnt(p) === min && p.id !== (st.lastId || '')) || open.find(p => cnt(p) === min) || open[0];
  return { p: pick, N, hard };
}

// ---------------------------------------------------------------- page
document.body.insertAdjacentHTML('beforeend', `
<canvas id="cv"></canvas>
<div id="home"></div>
<div id="hud" hidden>
  <div class="tl"></div>
  <div class="ttl"><span class="disp nm"></span><span class="ct"></span></div>
  <div class="tools"></div>
</div>`);
const css2 = document.createElement('style'); css2.textContent = `
#cv{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
#home{position:fixed;inset:0;z-index:20;overflow:auto;touch-action:pan-y;display:flex;flex-direction:column;align-items:center;padding:calc(12px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,rgba(250,246,236,.0),rgba(250,246,236,.35) 30%,rgba(250,246,236,.35) 70%,rgba(250,246,236,0))}
#home[hidden],#hud[hidden]{display:none}
.hbar{position:absolute;top:calc(12px + env(safe-area-inset-top));left:12px;right:80px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.hcol{width:min(460px,100%);display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:66px}
.htitle{font-size:3.1rem;line-height:.95;color:var(--navy);text-align:center;margin:0;text-shadow:0 2px 0 rgba(255,255,255,.7),0 0 18px rgba(255,255,255,.9)}
.hsub{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:600;font-size:1.25rem;color:var(--rose);margin-top:-4px;text-shadow:0 0 10px #fff}
.ribbon{position:relative;width:300px;height:88px;background:url(${A}ui/ribbon-rose.webp) center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:#fff8ef;
  font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:1.3rem;letter-spacing:1px;padding-bottom:10px;text-shadow:0 1px 2px rgba(80,20,30,.45);cursor:pointer}
.card{width:100%;display:flex;align-items:center;gap:14px;padding:12px;border-radius:22px;background:rgba(250,246,236,.94);border:2px solid var(--gold);box-shadow:0 8px 24px rgba(31,45,84,.18),inset 0 0 0 5px rgba(250,246,236,1),inset 0 0 0 6px rgba(176,136,52,.35);cursor:pointer;text-align:left}
.card .th{flex:none;width:104px;height:104px;border-radius:10px;border:3px solid #fff;box-shadow:0 3px 10px rgba(31,45,84,.3);background:#ddd center/cover}
.card .tx{flex:1;min-width:0}
.card .k{font-size:.78rem;letter-spacing:2px;text-transform:uppercase;color:var(--rose);font-weight:700}
.card .t{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:1.55rem;line-height:1.05;margin:.15rem 0 .2rem}
.card .s{font-size:.9rem;color:var(--soft)}
.card.big{flex-direction:column;align-items:stretch;gap:10px}
.card.big .row{display:flex;gap:14px;align-items:center}
.card.big .th{width:132px;height:132px}
.hrow{display:flex;gap:12px;width:100%}.hrow .sb-btn{flex:1;min-width:0;padding:.5rem .7rem}
.done-tick{display:inline-block;background:var(--sage);color:#fff;border-radius:999px;padding:.1rem .6rem;font-size:.8rem;margin-left:.3rem}
#hud .tl{position:fixed;top:calc(12px + env(safe-area-inset-top));left:12px;display:flex;gap:10px;z-index:10}
#hud .tr{position:fixed;top:calc(12px + env(safe-area-inset-top));right:80px;z-index:10}
#hud .ttl{position:fixed;left:0;right:0;z-index:9;display:flex;justify-content:center;align-items:baseline;gap:.6rem;pointer-events:none;color:var(--navy);white-space:nowrap}
#hud .nm{font-size:1.45rem;text-shadow:0 0 8px #fff,0 0 2px #fff}
#hud .ct{font-size:.95rem;font-weight:700;background:rgba(250,246,236,.92);border:1.5px solid var(--gold);border-radius:999px;padding:.1rem .6rem}
#hud .tools{position:fixed;z-index:10;display:flex;gap:8px;justify-content:center}
.tb{flex:1;display:flex;align-items:center;justify-content:center;gap:.35rem;min-height:56px;padding:0 .7rem 0 .3rem;border-radius:999px;border:2px solid var(--gold);background:linear-gradient(180deg,#fffdf7,#f1e7d2);
  font-weight:700;font-size:1rem;color:var(--navy);cursor:pointer;box-shadow:0 4px 12px rgba(31,45,84,.18);white-space:nowrap}
.tb img{width:42px;height:42px}
html.big .tb{font-size:21px;padding:0 .5rem 0 .2rem}html.big .tb img{width:36px;height:36px}html.big #hud .nm{font-size:1.25rem}
.tb.on{background:linear-gradient(180deg,#2c3c6b,#1F2D54);color:var(--ivory)}
.tb:active{transform:scale(.96)}
.tb .pr{display:inline-flex;align-items:center;font-size:.8rem;color:var(--gold);margin-left:.1rem}
.tb .pr img{width:22px;height:22px}
.peek{width:56px;height:56px;border-radius:50%;border:3px solid var(--gold);background:#ddd center/cover;box-shadow:0 4px 10px rgba(31,45,84,.3);cursor:pointer;flex:none}
.peek.on{transform:scale(.92)}
.gal h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.55rem;margin:1rem 0 .4rem;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(176,136,52,.45)}
.gal h3 small{font-family:'Libre Baskerville',Georgia,serif;font-size:.8rem;color:var(--soft)}
.ggrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media (min-width:700px){.ggrid{grid-template-columns:repeat(4,1fr)}}
.gi{position:relative;cursor:pointer;text-align:center;font-size:1rem;line-height:1.2}
.gi .im{width:100%;aspect-ratio:1;border-radius:10px;border:3px solid #fff;box-shadow:0 4px 12px rgba(31,45,84,.25);background:#ddd center/cover}
.gi.lock .im{filter:grayscale(.7) brightness(.85) blur(1.5px)}
.gi .lk{position:absolute;top:calc(50% - 50px);left:50%;transform:translate(-50%,-50%);width:64px}
.gi .stars{display:flex;justify-content:center;gap:2px;margin-top:4px}.gi .stars img{width:26px;height:26px}
.gi .nm{margin-top:4px}
.unl{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:.3rem 0 .6rem;font-size:.9rem;color:var(--soft)}
.pick-im{width:min(260px,70vw);aspect-ratio:1;margin:.4rem auto .6rem;display:block;border-radius:12px;border:4px solid #fff;box-shadow:0 6px 18px rgba(31,45,84,.3);background:center/cover}
.sizes{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:.4rem 0 .8rem}
.sz{min-height:64px;border-radius:16px;border:2px solid var(--gold);background:#fffdf7;color:var(--navy);font-weight:700;font-size:1.15rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.sz small{font-size:.62rem;color:var(--gold);letter-spacing:1px}
.sz.on{background:linear-gradient(180deg,#2c3c6b,#1F2D54);color:var(--ivory)}
.col{display:flex;flex-direction:column;gap:10px}
.wstars{display:flex;justify-content:center;gap:6px;margin:.2rem 0}.wstars img{width:54px;height:54px}
.wst img.st{width:54px}
.wline{display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:1.2rem;font-weight:700;color:var(--navy)}
.wline img{width:40px;height:40px}
.wstamp{display:flex;align-items:center;gap:12px;justify-content:center;background:rgba(86,120,84,.1);border-radius:16px;padding:.5rem;margin:.4rem 0}
.wstamp img{width:72px}
.howto li{margin:.35rem 0;font-size:1rem;line-height:1.4}
`;
document.head.appendChild(css2);
const cv = $('#cv'), g = cv.getContext('2d'), home = $('#home'), hud = $('#hud');

// coins pill (home + play) and HUD buttons
function coinPill() {
  const b = eat(h(`<button class="sb-coins" aria-label="Coins and shop"><img src="${A}ui/coin.webp" alt=""><span class="n">${M.coins().toLocaleString()}</span><b>+</b></button>`));
  b.addEventListener('click', () => { snd.tap(); M.shop(); }); return b;
}
M.onChange(s => document.querySelectorAll('.sb-coins .n').forEach(e => e.textContent = s.coins.toLocaleString()));
const hudTL = $('#hud .tl'), hudTools = $('#hud .tools');
hudTL.append(icon('home', 'Home', () => { snd.tap(); goHome(); }));
const peekB = eat(h(`<button class="peek" aria-label="Hold to see the picture"></button>`)); hudTL.append(peekB);
const hudTR = h(`<div class="tr"></div>`); hudTR.append(coinPill()); hud.append(hudTR);
let peek = false;
peekB.addEventListener('pointerdown', () => { peek = true; peekB.classList.add('on'); dirty = true; snd.tap(); });
addEventListener('pointerup', () => { if (peek) { peek = false; peekB.classList.remove('on'); dirty = true; } });
function tb(img, label, fn) { const b = eat(h(`<button class="tb">${img ? `<img src="${A}ui/i-${img}.webp" alt="">` : ''}<span class="lb">${label}</span></button>`)); b.addEventListener('click', fn); hudTools.append(b); return b; }
const edgeB = tb('', 'Edges', () => { filter = filter ? 0 : 1; scroll = 0; snd.tap(); syncTools(); dirty = true; });
const ghostB = tb('', 'Ghost', () => { st.set.ghost = !st.set.ghost; if (!st.set.ghost && cur) cur.save.ghostOff = true; st.save(); snd.tap(); syncTools(); dirty = true; });
const hintB = tb('hint', 'Hint', () => hint());
function syncTools() {
  edgeB.classList.toggle('on', filter === 1); ghostB.classList.toggle('on', st.set.ghost);
  const left = cur ? cur.pieces.filter(p => !p.placed && p.edge).length : 0;
  edgeB.querySelector('.lb').textContent = filter === 1 ? `Edges ${left}` : 'Edges';
  const free = cur ? Math.max(0, 2 - cur.save.hints) : 0;
  hintB.innerHTML = `<img src="${A}ui/i-hint.webp" alt=""><span class="lb">Hint</span>${free ? `<span class="pr">${free} free</span>` : `<span class="pr"><img src="${A}ui/coin.webp" alt="">20</span>`}`;
}

// ---------------------------------------------------------------- images
const imgCache = {};
function loadImg(src) { return imgCache[src] || (imgCache[src] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; })); }

// ---------------------------------------------------------------- puzzle model
let state = 'ready', cur = null, filter = 0, scroll = 0, dirty = true, sel = null, drag = null, flies = [], parts = [], hintP = null, hintAt = 0, doneAt = 0, t0 = 0;
const PAD = 0.36, SRC = 1024;
function rngOf(seed) { let s = (Math.floor(seed) % 2147483647) || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const keyOf = (id, N, isDaily) => isDaily ? 'daily_' + dayKey() : id + '_' + N;

async function startPuzzle({ p, N, isDaily = false, hard = false, journey = false }) {
  const key = keyOf(p.id, N, isDaily);
  const save = st.saves[key] || { id: p.id, N, placed: [], loose: {}, rot: {}, ms: 0, hints: 0, order: [], edgesFirst: true, ghostOff: !st.set.ghost, rotate: st.set.rotate, journey, hard, daily: isDaily };
  st.saves[key] = save; st.last = key; st.save();
  const img = await loadImg(`${A}jig/${p.id}.webp`);
  const seed = isDaily ? dayKey() : (PAINT.indexOf(p) + 1) * 7919 + N * 104729;
  const r = rngOf(seed);
  const hT = [], vT = [], hJ = [], vJ = [];
  for (let i = 0; i < N; i++) { hT.push([]); vT.push([]); hJ.push([]); vJ.push([]); for (let j = 0; j < N; j++) { hT[i].push(r() < 0.5 ? 1 : -1); vT[i].push(r() < 0.5 ? 1 : -1); hJ[i].push((r() - 0.5) * 0.12); vJ[i].push((r() - 0.5) * 0.12); } }
  const pieces = [];
  for (let i = 0; i < N * N; i++) { const pr = (i / N) | 0, pc = i % N; pieces.push({ i, r: pr, c: pc, edge: pr === 0 || pc === 0 || pr === N - 1 || pc === N - 1, ord: r(), rot: 0, ra: 0, placed: false, loose: null, at: 0 }); }
  if (save.rotate) for (const q of pieces) q.rot = q.ra = save.rot[q.i] ?? Math.floor(r() * 4);
  for (const i of save.placed) { pieces[i].placed = true; pieces[i].rot = pieces[i].ra = 0; }
  for (const [i, v] of Object.entries(save.loose)) if (!pieces[i].placed) pieces[i].loose = { x: v[0], y: v[1] };
  cur = { p, N, key, save, img, hT, vT, hJ, vJ, pieces, isDaily, hard, journey, looseOrder: Object.keys(save.loose).map(Number) };
  for (const q of pieces) q.can = cut(q);
  // the finished picture at source size for the ghost / peek / finale
  state = 'play'; filter = 0; scroll = 0; sel = null; drag = null; flies = []; parts = []; hintP = null; doneAt = 0; t0 = performance.now();
  view.z = 1; layout();
  home.hidden = true; hud.hidden = false;
  $('#hud .nm').textContent = p.name; peekB.style.backgroundImage = `url(${thumb(p.id)})`;
  updateCount(); syncTools();
  if (!isDaily) M.level(st.journey);
  B.start();
  if (hard) toast('A challenge puzzle: take your time');
  else if (N >= 10 && !st.set.zoomTip) { st.set.zoomTip = true; st.save(); toast('Pinch or double-tap to zoom'); }
  else if (save.placed.length) toast(`Welcome back: ${save.placed.length} of ${N * N} placed`);
  dirty = true;
}
function edge(x0, y0, x1, y1, t, j, path) {
  const dx = x1 - x0, dy = y1 - y0, nx = dy, ny = -dx, P = (u, v) => [x0 + dx * u + nx * v * t, y0 + dy * u + ny * v * t];
  if (!t) { path.lineTo(x1, y1); return; }
  const K = [[0.36 + j, 0], [0.43 + j, 0, 0.45 + j, 0.07, 0.41 + j, 0.13], [0.34 + j, 0.24, 0.42 + j, 0.33, 0.5 + j, 0.33], [0.58 + j, 0.33, 0.66 + j, 0.24, 0.59 + j, 0.13], [0.55 + j, 0.07, 0.57 + j, 0, 0.64 + j, 0]];
  path.lineTo(...P(K[0][0], K[0][1]));
  for (let k = 1; k < 5; k++) { const q = K[k]; path.bezierCurveTo(...P(q[0], q[1]), ...P(q[2], q[3]), ...P(q[4], q[5])); }
  path.lineTo(x1, y1);
}
function piecePath(q, ox, oy, c) {
  const { N, hT, vT, hJ, vJ } = cur, path = new Path2D(), { r, c: k } = q;
  path.moveTo(ox, oy);
  edge(ox, oy, ox + c, oy, r === 0 ? 0 : -hT[r - 1][k], r === 0 ? 0 : -hJ[r - 1][k], path);
  edge(ox + c, oy, ox + c, oy + c, k === N - 1 ? 0 : vT[r][k], k === N - 1 ? 0 : vJ[r][k], path);
  edge(ox + c, oy + c, ox, oy + c, r === N - 1 ? 0 : hT[r][k], r === N - 1 ? 0 : hJ[r][k], path);
  edge(ox, oy + c, ox, oy, k === 0 ? 0 : -vT[r][k - 1], k === 0 ? 0 : -vJ[r][k - 1], path);
  path.closePath(); return path;
}
function cut(q) {
  const c = SRC / cur.N, size = Math.ceil(c * (1 + 2 * PAD)), can = document.createElement('canvas'); can.width = can.height = size;
  const x = can.getContext('2d'), path = piecePath(q, PAD * c, PAD * c, c);
  x.save(); x.clip(path);
  x.drawImage(cur.img, q.c * c - PAD * c, q.r * c - PAD * c, size, size, 0, 0, size, size);
  const lw = Math.max(2, c * 0.055);
  x.lineWidth = lw; x.translate(lw * 0.45, lw * 0.45); x.strokeStyle = 'rgba(30,20,10,.32)'; x.stroke(path);
  x.translate(-lw * 0.9, -lw * 0.9); x.strokeStyle = 'rgba(255,252,240,.55)'; x.stroke(path);
  x.restore();
  x.lineWidth = Math.max(1, c * 0.012); x.strokeStyle = 'rgba(50,35,20,.45)'; x.stroke(path);
  return can;
}

// ---------------------------------------------------------------- layout + view (zoom / pan)
let W = 0, H = 0, dpr = 1, wide = false;
const L = { bx: 0, by: 0, bs: 300, tray: { x: 0, y: 0, w: 0, h: 0 }, ts: 72, rows: 2, cols: 4 };
const view = { z: 1, ox: 0, oy: 0 };
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  wide = W > H * 1.05 && W >= 700;
  const big = st.set.big ? 1.2 : 1, top = 12 + 56 + 14 + 34 * big;
  const tools = $('#hud .tools'), ttl = $('#hud .ttl');
  if (!wide) {
    L.bs = Math.floor(Math.min(W - 24, H - top - 12 - 56 - 12 - (66 * 2 + 14) - 14)); L.bx = Math.round((W - L.bs) / 2); L.by = Math.round(top + 4);
    const ty = L.by + L.bs + 12;
    const ts = Math.max(66, Math.min(112, (H - (ty + 56 + 12) - 14 - 18 - 14) / 2));
    Object.assign(tools.style, { left: '12px', right: '12px', top: ty + 'px', width: '' });
    L.ts = ts; L.tray = { x: 8, y: ty + 56 + 12, w: W - 16, h: ts * 2 + 14 }; L.rows = 2; L.orient = 'h';
    ttl.style.top = (12 + 56 + 8) + 'px';
  } else {
    const panelW = Math.min(440, Math.max(300, W * 0.3));
    L.bs = Math.floor(Math.min(H - top - 24, W - panelW - 72)); L.bx = Math.round((W - L.bs - panelW - 28) / 2); L.by = Math.round(top + 4);
    const px = L.bx + L.bs + 28;
    Object.assign(tools.style, { left: px + 'px', right: '', width: panelW + 'px', top: L.by + 'px' });
    L.ts = 88; L.tray = { x: px, y: L.by + 56 + 12, w: panelW, h: L.by + L.bs - (L.by + 68) }; L.cols = Math.max(2, Math.floor((panelW - 12) / L.ts)); L.orient = 'v';
    ttl.style.top = (12 + 56 + 8) + 'px';
  }
  clampView(); dirty = true;
}
addEventListener('resize', () => layout());
const cell = () => L.bs / cur.N;
function clampView() {
  view.z = Math.max(1, Math.min(view.z, cur ? Math.max(1.5, cur.N / 4.5) : 1));
  const s = L.bs * view.z;
  view.ox = Math.min(L.bx, Math.max(L.bx + L.bs - s, view.ox ?? L.bx)); view.oy = Math.min(L.by, Math.max(L.by + L.bs - s, view.oy ?? L.by));
  if (view.z === 1) { view.ox = L.bx; view.oy = L.by; }
}
const toBoard = (x, y) => [(x - view.ox) / view.z, (y - view.oy) / view.z];
const toScreen = (bx, by) => [view.ox + bx * view.z, view.oy + by * view.z];
const target = q => [(q.c + 0.5) * cell(), (q.r + 0.5) * cell()];
const inBoard = (x, y) => x >= L.bx && x < L.bx + L.bs && y >= L.by && y < L.by + L.bs;
const inTray = (x, y) => x >= L.tray.x && x < L.tray.x + L.tray.w && y >= L.tray.y - 6 && y < L.tray.y + L.tray.h + 6;
function zoomAt(z, sx, sy) { const [bx, by] = toBoard(sx, sy); view.z = z; view.ox = sx - bx * z; view.oy = sy - by * z; clampView(); dirty = true; }

// tray
const trayList = () => cur.pieces.filter(q => !q.placed && !q.loose && q !== (drag && drag.q) && !flies.some(f => f.q === q) && (filter === 0 || q.edge)).sort((a, b) => a.ord - b.ord);
function slotOf(k) {
  const { x, y } = L.tray, ts = L.ts;
  if (L.orient === 'h') return [x + 10 + Math.floor(k / 2) * ts + ts / 2 - scroll, y + 7 + (k % 2) * ts + ts / 2];
  const gap = (L.tray.w - L.cols * ts) / 2; return [x + gap + (k % L.cols) * ts + ts / 2, y + 8 + Math.floor(k / L.cols) * ts + ts / 2 - scroll];
}
const maxScroll = () => { const n = trayList().length; return L.orient === 'h' ? Math.max(0, Math.ceil(n / 2) * L.ts + 20 - L.tray.w) : Math.max(0, Math.ceil(n / L.cols) * L.ts + 16 - L.tray.h); };
const trayCell = () => L.ts * 0.58;
function scrollTo(q) { const k = trayList().indexOf(q); if (k < 0) return; scroll = L.orient === 'h' ? Math.floor(k / 2) * L.ts - L.tray.w / 2 + L.ts : Math.floor(k / L.cols) * L.ts - L.tray.h / 2 + L.ts; scroll = Math.max(0, Math.min(maxScroll(), scroll)); }

// ---------------------------------------------------------------- input
const ptrs = new Map(); let down = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 }, lpTimer = 0;
const isTouch = e => e.pointerType === 'touch';
function hitLoose(x, y) {
  const [bx, by] = toBoard(x, y), c = cell();
  for (let k = cur.looseOrder.length - 1; k >= 0; k--) { const q = cur.pieces[cur.looseOrder[k]]; if (q && q.loose && Math.abs(bx - q.loose.x) < c * 0.55 && Math.abs(by - q.loose.y) < c * 0.55) return q; }
  return null;
}
function hitTray(x, y) { let hit = null; trayList().forEach((q, k) => { const [sx, sy] = slotOf(k); if (Math.abs(x - sx) < L.ts / 2 && Math.abs(y - sy) < L.ts / 2) hit = q; }); return hit; }
function beginDrag(q, x, y, e, from) {
  const lift = e && isTouch(e) ? Math.max(cell() * view.z * 0.55, 30) : 0;
  drag = { q, x, y, lift, from }; sel = null; snd.pick(); if (navigator.vibrate) try { navigator.vibrate(5); } catch (_) {}
  if (q.loose) { cur.looseOrder = cur.looseOrder.filter(i => i !== q.i); q.loose = null; }
  dirty = true;
}
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || sheetOpen()) return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const x = e.clientX, y = e.clientY;
  if (ptrs.size === 2 && !drag) {
    const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; down = null; clearTimeout(lpTimer); return;
  }
  if (ptrs.size > 1) return;
  if (inTray(x, y)) {
    const q = hitTray(x, y); down = { kind: 'tray', q, x, y, s0: scroll, mode: null };
    if (q) lpTimer = setTimeout(() => { if (down && !down.mode && down.q) { down.mode = 'drag'; beginDrag(q, down.x, down.y, e, 'tray'); } }, 320);
    return;
  }
  const lq = hitLoose(x, y);
  if (lq) { down = { kind: 'loose', q: lq, x, y, mode: null }; return; }
  down = { kind: 'board', x, y, ox: view.ox, oy: view.oy, mode: null };
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const x = e.clientX, y = e.clientY;
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoomAt(pinch.z * d / pinch.d, pinch.mx, pinch.my); view.ox += mx - pinch.mx; view.oy += my - pinch.my; clampView(); return;
  }
  if (drag) { drag.x = x; drag.y = y; dirty = true; return; }
  if (!down) return;
  const dx = x - down.x, dy = y - down.y, far = Math.hypot(dx, dy) > 8;
  if (down.kind === 'tray') {
    if (!down.mode && far) {
      const along = L.orient === 'h' ? Math.abs(dx) > Math.abs(dy) * 1.1 : Math.abs(dy) > Math.abs(dx) * 1.1;
      clearTimeout(lpTimer);
      if (!along && down.q) { down.mode = 'drag'; beginDrag(down.q, x, y, e, 'tray'); } else down.mode = 'scroll';
    }
    if (down.mode === 'scroll') { scroll = Math.max(0, Math.min(maxScroll(), down.s0 - (L.orient === 'h' ? dx : dy))); dirty = true; }
  } else if (down.kind === 'loose') {
    if (!down.mode && far) { down.mode = 'drag'; beginDrag(down.q, x, y, e, 'board'); }
  } else if (down.kind === 'board' && view.z > 1) {
    if (far || down.mode) { down.mode = 'pan'; view.ox = down.ox + dx; view.oy = down.oy + dy; clampView(); }
  }
});
function up(e) {
  ptrs.delete(e.pointerId); clearTimeout(lpTimer);
  if (pinch) { if (ptrs.size < 2) pinch = null; down = null; return; }
  if (drag) { drop(); down = null; return; }
  if (!down) return;
  const d = down; down = null;
  if (d.mode) return;
  // taps
  if (d.kind === 'tray' && d.q) {
    if (cur.save.rotate && d.q.rot) { rotate(d.q); return; }
    sel = sel === d.q ? null : d.q; snd.tap(); dirty = true; return;
  }
  if (d.kind === 'loose') { if (cur.save.rotate && d.q.rot) rotate(d.q); else { sel = d.q; snd.tap(); dirty = true; } return; }
  if (d.kind === 'board' && inBoard(d.x, d.y)) {
    const now = performance.now();
    if (sel) {
      const [bx, by] = toBoard(d.x, d.y), c = cell(), r = Math.floor(by / c), k = Math.floor(bx / c);
      if (sel.r === r && sel.c === k && !sel.rot) { const q = sel; sel = null; const from = fromScreenOf(q); place(q, from[0], from[1], from[2]); }
      else { snd.no(); hintP = sel; hintAt = now - 1600; dirty = true; }
      return;
    }
    if (now - lastTap.t < 330 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 30) { zoomAt(view.z > 1.05 ? 1 : Math.min(2.4, Math.max(1.6, cur.N / 5)), d.x, d.y); snd.tap(); lastTap.t = 0; return; }
    lastTap = { t: now, x: d.x, y: d.y };
  }
}
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => {
  if (state !== 'play') return; e.preventDefault();
  if (inTray(e.clientX, e.clientY)) { scroll = Math.max(0, Math.min(maxScroll(), scroll + (L.orient === 'h' ? (e.deltaX || e.deltaY) : e.deltaY))); dirty = true; return; }
  if (inBoard(e.clientX, e.clientY)) zoomAt(view.z * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
}, { passive: false });
function fromScreenOf(q) {   // where a piece is drawn now (screen x, y, cell px)
  if (q.loose) { const [x, y] = toScreen(q.loose.x, q.loose.y); return [x, y, cell() * view.z]; }
  const k = trayList().indexOf(q); if (k >= 0) { const [x, y] = slotOf(k); return [x, y, trayCell()]; }
  return [L.tray.x + L.tray.w / 2, L.tray.y + L.tray.h / 2, trayCell()];
}
function rotate(q) { q.rot = (q.rot + 1) % 4; cur.save.rot[q.i] = q.rot; snd.soft(); dirty = true; saveSoon(); }
function drop() {
  const { q, x, y, lift } = drag; drag = null;
  const cx = x, cy = y - lift;
  if (inTray(x, y) || cy > L.tray.y + 10 && L.orient === 'h' && !inBoard(cx, cy)) { delete cur.save.loose[q.i]; snd.soft(); saveSoon(); dirty = true; return; }
  const [bx, by] = toBoard(cx, cy), [tx, ty] = target(q), c = cell();
  const thr = Math.max(c * 0.42, 16 / view.z);
  if (!q.rot && Math.hypot(bx - tx, by - ty) < thr) { place(q, cx, cy, c * view.z, true); return; }
  if (bx > -c * 0.3 && by > -c * 0.3 && bx < L.bs + c * 0.3 && by < L.bs + c * 0.3) {
    q.loose = { x: bx, y: by }; cur.looseOrder.push(q.i); cur.save.loose[q.i] = [bx, by]; snd.soft(); saveSoon(); dirty = true; return;
  }
  delete cur.save.loose[q.i]; snd.soft(); saveSoon(); dirty = true;
}

// ---------------------------------------------------------------- placing, hints, finishing
function place(q, fx, fy, fcell, quick = false) {
  if (q.loose) { cur.looseOrder = cur.looseOrder.filter(i => i !== q.i); q.loose = null; }
  delete cur.save.loose[q.i]; if (sel === q) sel = null;
  flies.push({ q, fx, fy, fc: fcell, at: performance.now(), dur: quick ? 120 : 260 });
}
function landed(q) {
  q.placed = true; q.rot = q.ra = 0; q.at = performance.now();
  const s = cur.save; s.placed.push(q.i); s.order.push(q.i);
  if (!q.edge && cur.pieces.some(p => p.edge && !p.placed)) s.edgesFirst = false;
  const n = s.placed.length, all = cur.N * cur.N;
  snd.place(n); try { navigator.vibrate && navigator.vibrate(8); } catch (_) {}
  const [tx, ty] = target(q), [sx, sy] = toScreen(tx, ty);
  sparkle(sx, sy, 9);
  updateCount(); saveSoon();
  if (q.edge && !cur.pieces.some(p => p.edge && !p.placed) && n < all) { toast('The frame is complete'); snd.chime(4); if (filter) { filter = 0; syncTools(); } }
  else if (n % Math.max(5, cur.N) === 0 && n < all) snd.chime(2);
  syncTools();
  if (n === all) finish();
}
function updateCount() { if (!cur) return; $('#hud .ct').textContent = `${cur.save.placed.length} / ${cur.N * cur.N}`; }
let saveT = 0;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => { if (cur && state === 'play') { cur.save.ms += performance.now() - t0; t0 = performance.now(); } st.save(); }, 400); }
async function hint() {
  if (state !== 'play' || sheetOpen()) return;
  const left = cur.pieces.filter(q => !q.placed && !flies.some(f => f.q === q));
  if (!left.length) return;
  if (cur.save.hints >= 2) {
    if (!M.spend(20, 'hint')) { if (!(await M.rewarded('hint', { what: 'One hint: a piece and its spot' }))) return; }
  }
  cur.save.hints++; saveSoon();
  const q = left.find(p => p.edge && cur.pieces.some(o => o.edge && !o.placed)) && left.filter(p => p.edge).sort((a, b) => a.ord - b.ord)[0] || left.sort((a, b) => a.ord - b.ord)[0];
  if (!q.edge && filter) filter = 0;
  if (q.rot) { q.rot = 0; cur.save.rot[q.i] = 0; }
  scrollTo(q); hintP = q; hintAt = performance.now(); sel = q.loose ? null : q; snd.chime(3); syncTools(); dirty = true;
}
function finish() {
  state = 'won'; doneAt = performance.now(); sel = null;
  const s = cur.save; s.ms += performance.now() - t0;
  const N = cur.N, id = cur.p.id, S = st.stats, today = dayKey();
  S.solved++; if (S.today.d !== today) S.today = { d: today, n: 0 }; S.today.n++;
  S.big = Math.max(S.big, N);
  if (s.edgesFirst) S.edgesFirst = true;
  if (!s.hints && N >= 8) S.noHint = true;
  if (s.rotate) S.rotated = true;
  if (s.ghostOff) S.noGhost = true;
  const prevStars = starsOf(id), newStars = Math.max(prevStars, tier(N));
  st.done[id] = { n: ((st.done[id] && st.done[id].n) || 0) + 1, stars: newStars, best: Math.max(N, (st.done[id] && st.done[id].best) || 0) };
  st.lastId = id;
  let streak = null;
  if (cur.isDaily) { S.dailies++; streak = streakWin(st.streak); st.dailyDone = today; }
  const before = { ...st.stamps }, opened = CHAP.map((c, k) => chapOpen(k));
  const newStamps = STAMPS.filter(t => !before[t.id] && t.test(S));
  for (const t of newStamps) st.stamps[t.id] = today;
  const coins = coinsFor(N) + (cur.isDaily ? 50 : 0);
  M.add(coins, cur.isDaily ? 'daily' : 'win');
  if (cur.journey) st.journey++;
  const grid = cur.isDaily ? shareGrid(s) : '';
  delete st.saves[cur.key]; st.last = null; st.save();
  F.level(true); B.submit(1, { ms: Math.max(1000, s.ms) }); D.won(S.solved, 'completed');
  const unlocked = CHAP.map((c, k) => !opened[k] && chapOpen(k) ? c.name : null).filter(Boolean);
  setTimeout(() => { snd.win(); petals(70); }, 450);
  setTimeout(() => winCard({ coins, stars: newStars, gained: newStars > prevStars, newStamps, streak, grid, unlocked }), 2100);
}
function shareGrid(s) {
  // spoiler-free: the board in 4×4 blocks, each coloured by when you finished it (sprout → full bloom)
  const N = cur.N, when = {}; s.order.forEach((i, k) => when[i] = k / (N * N));
  const E = ['🌱', '🌿', '🌷', '🌸'], rows = [];
  for (let br = 0; br < 4; br++) { let row = ''; for (let bc = 0; bc < 4; bc++) { let m = 0;
    for (let r = Math.floor(br * N / 4); r < Math.floor((br + 1) * N / 4); r++) for (let c = Math.floor(bc * N / 4); c < Math.floor((bc + 1) * N / 4); c++) m = Math.max(m, when[r * N + c] || 0);
    row += E[Math.min(3, Math.floor(m * 4))]; } rows.push(row); }
  return rows.join('\n');
}
function winCard({ coins, stars, gained, newStamps, streak, grid, unlocked }) {
  const daily = cur.isDaily, name = cur.p.name, N = cur.N;
  const starRow = [1, 2, 3].map(k => `<img src="${A}ui/${k <= stars ? 'star-full' : 'star-empty'}.webp" alt="">`).join('');
  const stamp = newStamps[0];
  const sh = sheet(`
    <h2>${daily ? 'Daily puzzle done' : 'Beautifully done'}</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center;margin:0"><i>${name}</i> · ${N * N} pieces</p>
    <div class="wstars" aria-label="${stars} of 3 stars">${starRow}</div>
    <div class="wline"><img src="${A}ui/coin.webp" alt=""><span class="cn">+${coins}</span> coins</div>
    ${daily && streak ? `<p style="text-align:center"><b>${streak.n}-day streak</b>${streak.used ? ' · a freeze kept it going' : ''}</p><div class="sb-grid">${grid.replace(/\n/g, '<br>')}</div>` : ''}
    ${stamp ? `<div class="wstamp"><img src="${A}stamps/stamp-${stamp.img}.webp" alt=""><div><b>New stamp: ${stamp.name}</b><br><small>${stamp.how}</small></div></div>` : ''}
    ${unlocked.length ? `<p style="text-align:center"><b>New chapter open: ${unlocked.join(', ')}</b></p>` : ''}
    <div class="col" style="margin-top:.6rem">
      <button class="sb-btn nx">${daily ? 'Back to the garden' : 'Next puzzle'}</button>
      ${daily ? `<button class="sb-btn ivory shr"><img src="${A}ui/i-share.webp" alt="">Share my grid</button>` : `<button class="sb-btn rose dbl"><img src="${A}ui/i-video.webp" alt="">Double to ${coins * 2} coins</button>`}
      <button class="sb-btn ivory hm">Home</button>
    </div>`, { close: false });
  let left = false;
  const go = async (where) => {
    if (left) return; left = true; sh.close(); snd.tap();
    await M.breakAd('level-end', { level: st.journey });
    if (where === 'home' || daily) goHome(); else next();
  };
  sh.el.querySelector('.nx').onclick = e => { e.stopPropagation(); go('next'); };
  sh.el.querySelector('.hm').onclick = e => { e.stopPropagation(); go('home'); };
  const dbl = sh.el.querySelector('.dbl');
  if (dbl) dbl.onclick = async e => { e.stopPropagation(); if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); sh.el.querySelector('.cn').textContent = '+' + coins * 2; snd.coin(); } dbl.remove(); };
  const shr = sh.el.querySelector('.shr');
  if (shr) shr.onclick = e => { e.stopPropagation(); shareText(`Petal Jigsaw · ${prettyDay()}\n${grid}\n${N * N} pieces · ${streak ? streak.n + '-day streak' : ''}\n${location.origin}${location.pathname}?daily=1`); };
  // tap anywhere else on the card: continue
  sh.el.parentElement.addEventListener('click', e => { if (!e.target.closest('button')) go('next'); });
  if (stamp) setTimeout(() => snd.chime(5), 300);
}
function next() { const j = journeyPlan(); startPuzzle({ p: j.p, N: j.N, hard: j.hard, journey: true }); }

// ---------------------------------------------------------------- particles
function sparkle(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 1 + Math.random() * 2.2; parts.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 1, s: 2 + Math.random() * 2.5, c: ['#fff6d6', '#e8c66a', '#ffffff'][i % 3] }); } dirty = true; }
function petals(n) { const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) return; for (let i = 0; i < n; i++) parts.push({ k: 'p', x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.3, life: 1, s: 6 + Math.random() * 6, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.08, c: ['#e8a3b0', '#f3c6cf', '#d9788c', '#fff3f0', '#e9c46a'][i % 5], ph: Math.random() * 6 }); dirty = true; }

// ---------------------------------------------------------------- drawing
function rr(x, y, w, h2, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h2, r) : g.rect(x, y, w, h2); }
function drawPiece(q, cx, cy, cpx, ang = 0, shadow = 0) {
  const size = cpx * (1 + 2 * PAD);
  g.save(); g.translate(cx, cy); if (ang) g.rotate(ang);
  if (shadow) { g.shadowColor = 'rgba(40,30,20,.38)'; g.shadowBlur = shadow; g.shadowOffsetY = shadow * 0.35; }
  g.drawImage(q.can, -size / 2, -size / 2, size, size); g.restore();
}
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function draw(now) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!cur || state === 'ready') return;
  const { bx, by, bs } = L, c = cell(), z = view.z;
  // board mat: ivory mount, gold hairline, soft shadow
  g.save(); g.shadowColor = 'rgba(31,45,84,.28)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rr(bx - 9, by - 9, bs + 18, bs + 18, 14); g.fillStyle = '#fbf7ee'; g.fill(); g.restore();
  g.strokeStyle = '#B08834'; g.lineWidth = 1.5; rr(bx - 5, by - 5, bs + 10, bs + 10, 10); g.stroke();
  g.save(); g.beginPath(); g.rect(bx, by, bs, bs); g.clip();
  g.fillStyle = '#eee5d2'; g.fillRect(bx, by, bs, bs);
  g.translate(view.ox, view.oy); g.scale(z, z);
  if (st.set.ghost || doneAt) { g.globalAlpha = doneAt ? 0.25 : 0.24; g.drawImage(cur.img, 0, 0, bs, bs); g.globalAlpha = 1; }
  if (!doneAt && !st.set.ghost) { g.strokeStyle = 'rgba(176,136,52,.18)'; g.lineWidth = 1 / z; g.beginPath(); for (let i = 1; i < cur.N; i++) { g.moveTo(i * c, 0); g.lineTo(i * c, bs); g.moveTo(0, i * c); g.lineTo(bs, i * c); } g.stroke(); }
  g.restore();
  // placed pieces (in screen space so the board clip + zoom match)
  g.save(); g.beginPath(); g.rect(bx - 2, by - 2, bs + 4, bs + 4); g.clip();
  let anim = false;
  for (const q of cur.pieces) if (q.placed) {
    const k = (now - q.at) / 260, pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.07 : 1; if (k < 1) anim = true;
    const [tx, ty] = target(q), [sx, sy] = toScreen(tx, ty); drawPiece(q, sx, sy, c * z * pop, 0, k < 1 ? 10 : 0);
  }
  if (doneAt) {
    const k = ease((now - doneAt) / 900); g.globalAlpha = k; g.drawImage(cur.img, view.ox, view.oy, bs * z, bs * z); g.globalAlpha = 1;
    const sw = ((now - doneAt) / 1100); if (sw < 2) { anim = true; const gx = bx - bs * 0.4 + (sw % 1) * bs * 1.8, gr = g.createLinearGradient(gx - 90, by, gx + 90, by + bs * 0.3); gr.addColorStop(0, 'rgba(255,250,230,0)'); gr.addColorStop(0.5, 'rgba(255,250,230,.55)'); gr.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = gr; g.fillRect(bx, by, bs, bs); }
  }
  // hint target
  if (hintP && now - hintAt < 2800 && !hintP.placed) {
    anim = true; const k = 1 - (now - hintAt) / 2800, pulse = 0.5 + 0.5 * Math.sin(now / 140);
    g.save(); g.translate(view.ox + hintP.c * c * z, view.oy + hintP.r * c * z); g.scale(z, z);
    g.shadowColor = '#ffe9a6'; g.shadowBlur = 14; g.strokeStyle = `rgba(176,136,52,${0.5 + 0.5 * pulse * k})`; g.lineWidth = 3.5 / z; g.stroke(piecePath(hintP, 0, 0, c)); g.restore();
  }
  // loose pieces on the board
  for (const i of cur.looseOrder) { const q = cur.pieces[i]; if (!q.loose) continue; const [sx, sy] = toScreen(q.loose.x, q.loose.y); q.ra += (q.rot - q.ra) * 0.3; if (Math.abs(q.rot - q.ra) > 0.01) anim = true; else q.ra = q.rot;
    drawPiece(q, sx, sy, c * z, ((q.ra % 4) * Math.PI) / 2, 6); if (q === sel) ring(sx, sy, c * z * 0.62); }
  g.restore();
  if (doneAt) { const k = ease((now - doneAt - 400) / 800); if (k > 0) { g.globalAlpha = k; g.strokeStyle = '#B08834'; g.lineWidth = 4; rr(bx - 6, by - 6, bs + 12, bs + 12, 10); g.stroke(); g.lineWidth = 1.2; rr(bx - 12, by - 12, bs + 24, bs + 24, 15); g.stroke(); g.globalAlpha = 1; } }
  if (peek) { g.save(); g.shadowColor = 'rgba(31,45,84,.4)'; g.shadowBlur = 20; g.drawImage(cur.img, bx, by, bs, bs); g.restore(); }
  // tray
  if (state === 'play') {
    const T = L.tray;
    g.save(); g.shadowColor = 'rgba(31,45,84,.2)'; g.shadowBlur = 18; g.shadowOffsetY = 5; rr(T.x, T.y, T.w, T.h, 20); g.fillStyle = 'rgba(250,246,236,.9)'; g.fill(); g.restore();
    g.strokeStyle = 'rgba(176,136,52,.7)'; g.lineWidth = 1.5; rr(T.x + 4, T.y + 4, T.w - 8, T.h - 8, 16); g.stroke();
    g.save(); rr(T.x + 2, T.y + 2, T.w - 4, T.h - 4, 18); g.clip();
    const list = trayList(), tc = trayCell();
    list.forEach((q, k) => {
      const [sx, sy] = slotOf(k); if (sx < T.x - L.ts || sx > T.x + T.w + L.ts || sy < T.y - L.ts || sy > T.y + T.h + L.ts) return;
      q.ra += (q.rot - q.ra) * 0.3; if (Math.abs(q.rot - q.ra) > 0.01) anim = true; else q.ra = q.rot;
      if (q === sel) { rr(sx - L.ts / 2 + 4, sy - L.ts / 2 + 4, L.ts - 8, L.ts - 8, 14); g.fillStyle = 'rgba(176,136,52,.25)'; g.fill(); }
      const bob = hintP === q && now - hintAt < 2800 ? (anim = true, Math.sin(now / 90) * 3) : 0;
      drawPiece(q, sx, sy + bob, tc, ((q.ra % 4) * Math.PI) / 2, 4);
    });
    if (!list.length) { g.fillStyle = '#5b6280'; g.font = `italic ${st.set.big ? 24 : 20}px 'Libre Baskerville',Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(filter ? 'All edge pieces are out' : cur.looseOrder.length ? 'The rest are on the board' : '', T.x + T.w / 2, T.y + T.h / 2); }
    // scroll fades
    const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(250,246,236,.95)'); gr.addColorStop(1, 'rgba(250,246,236,0)'); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); };
    if (L.orient === 'h') { if (scroll > 0) fade(T.x, 0, T.x + 34, 0, T.x, T.y, 34, T.h); if (scroll < maxScroll()) fade(T.x + T.w, 0, T.x + T.w - 34, 0, T.x + T.w - 34, T.y, 34, T.h); }
    else { if (scroll > 0) fade(0, T.y, 0, T.y + 30, T.x, T.y, T.w, 30); if (scroll < maxScroll()) fade(0, T.y + T.h, 0, T.y + T.h - 30, T.x, T.y + T.h - 30, T.w, 30); }
    g.restore();
  }
  // flying + dragged on top
  flies = flies.filter(f => {
    anim = true; const k = ease((now - f.at) / f.dur), [tx, ty] = target(f.q), [ex, ey] = toScreen(tx, ty), ec = c * z;
    f.q.ra += (0 - f.q.ra) * 0.4;
    drawPiece(f.q, f.fx + (ex - f.fx) * k, f.fy + (ey - f.fy) * k, f.fc + (ec - f.fc) * k, ((f.q.ra % 4) * Math.PI) / 2, 10);
    if (k >= 1) { landed(f.q); return false; } return true;
  });
  if (drag) { anim = true; drag.q.ra += (drag.q.rot - drag.q.ra) * 0.3; drawPiece(drag.q, drag.x, drag.y - drag.lift, c * z * 1.08, ((drag.q.ra % 4) * Math.PI) / 2, 18); }
  // particles
  if (parts.length) anim = true;
  parts = parts.filter(p => {
    if (p.k === 's') { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.035; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s * p.life + 0.5, 0, 6.28); g.fill(); }
    else { p.ph += 0.03; p.x += p.vx + Math.sin(p.ph) * 0.7; p.y += p.vy; p.a += p.va; if (p.y > H + 20) p.life = 0;
      g.globalAlpha = 0.9; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.28); g.fill(); g.restore(); }
    g.globalAlpha = 1; return p.life > 0;
  });
  return anim;
}
function ring(x, y, r) { g.save(); g.strokeStyle = '#B08834'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(x, y, r, 0, 6.28); g.stroke(); g.restore(); }
function frame(now) { if (dirty || peek || drag || flies.length || parts.length || doneAt || (hintP && now - hintAt < 2900)) { const a = draw(now); dirty = !!a; } requestAnimationFrame(frame); }
requestAnimationFrame(frame);
setInterval(() => { if (state === 'play' && cur) { cur.save.ms += performance.now() - t0; t0 = performance.now(); st.save(); } }, 15000);
addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && cur) { cur.save.ms += performance.now() - t0; t0 = performance.now(); st.save(); } else t0 = performance.now(); });

// ---------------------------------------------------------------- home, gallery, picker, settings
function goHome() {
  if (state === 'play' && cur) { cur.save.ms += performance.now() - t0; st.save(); }
  state = 'ready'; cur = null; hud.hidden = true; home.hidden = false; dirty = true; renderHome();
}
function renderHome() {
  const j = journeyPlan(), dp = dailyPick(), sn = streakNow(st.streak), doneToday = st.dailyDone === dayKey();
  const resume = st.last && st.saves[st.last] && !st.saves[st.last].daily ? st.saves[st.last] : null;
  const rp = resume && PAINT.find(p => p.id === resume.id);
  const dsave = st.saves['daily_' + dayKey()], dmode = D.isDaily && !doneToday;
  home.innerHTML = `
    <div class="hbar"><span class="hl"></span><span class="hr"></span></div>
    <div class="hcol">
      <h1 class="htitle disp">Petal Jigsaw</h1>
      <div class="hsub">painted jigsaw puzzles</div>
      <div class="ribbon" role="button">${sn.n > 0 ? `${sn.n}-day streak` : 'Begin a streak'}</div>
      <div class="card daily" role="button"><div class="th" style="background-image:url(${thumb(dp.id)})"></div><div class="tx">
        <div class="k">Today · ${prettyDay().replace(/(\d+ \w{3})\w*/, '$1')}</div><div class="t">${dp.name}</div>
        <div class="s">${doneToday ? `Done <span class="done-tick">✓</span> · play it again` : dsave ? `${dsave.placed.length} of 64 placed · tap to carry on` : '64 pieces · the same for everyone'}</div></div></div>
      ${dmode ? '' : ''}<div class="card big cont" role="button"><div class="row"><div class="th" style="background-image:url(${thumb((rp || j.p).id)})"></div><div class="tx">
        <div class="k">${rp ? 'In progress' : j.hard ? 'Challenge puzzle' : 'Puzzle ' + st.journey}</div><div class="t">${(rp || j.p).name}</div>
        <div class="s">${rp ? `${resume.placed.length} of ${resume.N * resume.N} pieces placed` : `${j.N * j.N} pieces${j.hard ? ' · a bigger one' : ''}`}</div></div></div>
        <button class="sb-btn go"><img src="${A}ui/i-play.webp" alt="">${rp ? 'Carry on' : 'Play'}</button></div>
      <div class="hrow"><button class="sb-btn ivory gal"><img src="${A}ui/i-album.webp" alt="">Gallery</button><button class="sb-btn ivory alb"><img src="${A}ui/i-star.webp" alt="">Stamps</button></div>
    </div>`;
  $('.hl', home).append(icon('settings', 'Settings', settings));
  $('.hr', home).append(coinPill());
  const playDaily = () => { snd.tap(); startPuzzle({ p: dp, N: 8, isDaily: true }); };
  $('.daily', home).onclick = playDaily;
  $('.ribbon', home).onclick = () => { snd.tap(); streakSheet(); };
  $('.cont', home).onclick = () => { snd.tap(); if (dmode) return playDaily(); if (rp) startPuzzle({ p: rp, N: resume.N, journey: resume.journey, hard: resume.hard }); else startPuzzle({ p: j.p, N: j.N, hard: j.hard, journey: true }); };
  $('.gal', home).onclick = e => { e.stopPropagation(); snd.tap(); gallery(); };
  $('.alb', home).onclick = e => { e.stopPropagation(); snd.tap(); albumSheet(STAMPS, st.stamps); };
  if (dmode) { $('.daily', home).remove(); const c = $('.cont', home); $('.th', c).style.backgroundImage = `url(${thumb(dp.id)})`; $('.k', c).textContent = `Daily puzzle · ${prettyDay().replace(/(\d+ \w{3})\w*/, '$1')}`; $('.t', c).textContent = dp.name; $('.s', c).textContent = dsave ? `${dsave.placed.length} of 64 placed` : '64 pieces · the same for everyone today';
    $('.go', c).innerHTML = `<img src="${A}ui/i-calendar.webp" alt="">Play today's puzzle`; }
}
function streakSheet() {
  const sn = streakNow(st.streak), fz = freezes(st.streak);
  const s = sheet(`<h2>Daily streak</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center;font-size:1.3rem"><b>${sn.n} day${sn.n === 1 ? '' : 's'}</b>${st.streak.best ? ` · best ${st.streak.best}` : ''}</p>
    <p>Finish the daily puzzle each day to grow your streak. Miss a day and a <b>streak freeze</b> keeps it safe: you get one free every week.</p>
    <p style="text-align:center">Freezes ready: <b>${fz}</b></p>
    <div class="col"><button class="sb-btn ivory buy" ${(st.streak.extra || 0) >= 2 ? 'disabled' : ''}><img src="${A}ui/coin.webp" alt="">Extra freeze · 60 coins</button>
    <button class="sb-btn go">${st.dailyDone === dayKey() ? 'Close' : "Play today's puzzle"}</button></div>`);
  s.el.querySelector('.buy').onclick = () => { if (M.spend(60, 'freeze')) { st.streak.extra = (st.streak.extra || 0) + 1; st.save(); snd.coin(); s.close(); toast('Freeze saved for a busy day'); } else { s.close(); M.shop(); } };
  s.el.querySelector('.go').onclick = () => { s.close(); if (st.dailyDone !== dayKey()) startPuzzle({ p: dailyPick(), N: 8, isDaily: true }); };
}
function gallery() {
  const ts = totalStars();
  const s = sheet(`<h2>Gallery</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center"><img src="${A}ui/star-full.webp" alt="" style="width:30px;vertical-align:middle"> <b>${ts}</b> star${ts === 1 ? '' : 's'} · bigger puzzles earn more</p>
    <div class="gal">${CHAP.map((ch, k) => { const open = chapOpen(k); return `<h3>${ch.name}<small>${open ? PAINT.filter(p => p.ch === k && st.done[p.id]).length + ' of 4 done' : ch.need + ' stars to open'}</small></h3>
      ${open ? '' : `<div class="unl"><span>Collect ${ch.need - ts} more star${ch.need - ts === 1 ? '' : 's'}, or</span><button class="sb-btn ivory un" data-k="${k}"><img src="${A}ui/coin.webp" alt="">300</button></div>`}
      <div class="ggrid">${PAINT.filter(p => p.ch === k).map(p => `<div class="gi ${open ? '' : 'lock'}" data-id="${p.id}"><div class="im" style="background-image:url(${thumb(p.id)})"></div>
        ${open ? '' : `<img class="lk" src="${A}ui/i-lock.webp" alt="">`}<div class="stars">${[1, 2, 3].map(i => `<img src="${A}ui/${i <= starsOf(p.id) ? 'star-full' : 'star-empty'}.webp" alt="">`).join('')}</div><div class="nm">${p.name}</div></div>`).join('')}</div>`; }).join('')}</div>`);
  s.el.querySelectorAll('.gi').forEach(el => el.onclick = () => { const p = PAINT.find(q => q.id === el.dataset.id); if (!chapOpen(p.ch)) { snd.no(); toast('This chapter is still closed'); return; } snd.tap(); s.close(); picker(p); });
  s.el.querySelectorAll('.un').forEach(el => el.onclick = e => { e.stopPropagation(); const k = +el.dataset.k; if (M.spend(300, 'unlock')) { st.unlocked = st.unlocked || {}; st.unlocked[k] = 1; st.save(); snd.coin(); s.close(); toast(`${CHAP[k].name} is open`); gallery(); } else { s.close(); M.shop(); } });
}
function picker(p) {
  let N = (st.done[p.id] && st.done[p.id].best) ? Math.min(14, SIZES.find(n => n > st.done[p.id].best) || 14) : 6;
  const saves = SIZES.map(n => st.saves[p.id + '_' + n]).filter(Boolean);
  const s = sheet(`<h2>${p.name}</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <div class="pick-im" style="background-image:url(${A}jig/${p.id}.webp)"></div>
    <p style="text-align:center;margin:.2rem 0">How many pieces?</p>
    <div class="sizes">${SIZES.map(n => `<button class="sz ${n === N ? 'on' : ''}" data-n="${n}">${n * n}<small>${'★'.repeat(tier(n))}</small></button>`).join('')}</div>
    <div class="col">${saves.map(v => `<button class="sb-btn ivory res" data-n="${v.N}">Carry on ${v.N * v.N} · ${v.placed.length} placed</button>`).join('')}
    <button class="sb-btn go"><img src="${A}ui/i-play.webp" alt="">Start</button></div>`);
  s.el.querySelectorAll('.sz').forEach(b => b.onclick = () => { N = +b.dataset.n; s.el.querySelectorAll('.sz').forEach(x => x.classList.toggle('on', x === b)); snd.tap(); });
  s.el.querySelectorAll('.res').forEach(b => b.onclick = () => { s.close(); startPuzzle({ p, N: +b.dataset.n }); });
  s.el.querySelector('.go').onclick = () => { s.close(); if (st.saves[p.id + '_' + N]) delete st.saves[p.id + '_' + N]; startPuzzle({ p, N }); };
}
function settings() {
  snd.tap();
  const s = sheet(`<h2>Settings</h2><img class="sb-div" src="${A}ui/divider.webp" alt=""><div class="tg"></div>
    <h3 class="disp" style="font-size:1.5rem;margin:1rem 0 .2rem">How to play</h3>
    <ul class="howto"><li>Drag a piece from the tray onto the picture. It clicks into place when it is close.</li>
    <li>Or tap a piece, then tap its spot.</li><li><b>Edges</b> shows only the border pieces. <b>Ghost</b> shows a faint picture underneath. Hold the round picture at the top to peek.</li>
    <li>Pinch, scroll or double-tap the picture to zoom.</li><li>There is no clock. Your puzzle is saved as you go.</li></ul>
    <div class="col" style="margin-top:.6rem"><button class="sb-btn ivory shop"><img src="${A}ui/i-shop.webp" alt="">Shop</button></div>`);
  const tg = s.el.querySelector('.tg');
  tg.append(toggleRow('Larger text', 'Bigger words everywhere', st.set.big, v => { st.set.big = v; st.save(); applySet(); }));
  tg.append(toggleRow('Rotate pieces', 'Pieces arrive turned; tap to turn them. For new puzzles.', st.set.rotate, v => { st.set.rotate = v; st.save(); }));
  tg.append(toggleRow('Ghost image', 'A faint picture under the pieces', st.set.ghost, v => { st.set.ghost = v; st.save(); }));
  tg.append(toggleRow('Music', 'Soft harp in the background', st.set.music, v => { st.set.music = v; st.save(); applySet(); }));
  tg.append(toggleRow('Sounds', 'Clicks and chimes', st.set.sfx, v => { st.set.sfx = v; st.save(); applySet(); }));
  s.el.querySelector('.shop').onclick = () => { s.close(); M.shop(); };
}

goHome();

// ---------------------------------------------------------------- test hooks
let botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return st.journey; }, get view() { return { ...view, L }; },
  get score() { return st.stats.solved * 1000 + (cur ? cur.save.placed.length : 0); },
  bot() {   // a steady human: edges first, then row by row, one piece about every third beat
    if (state !== 'play' || drag || flies.length || sheetOpen() || (botTick++ % 2)) return;
    const left = cur.pieces.filter(q => !q.placed).sort((a, b) => (b.edge - a.edge) || (a.r - b.r) || (a.c - b.c));
    if (!left.length) return;
    const q = left[0]; filter = 0; q.rot = 0; scrollTo(q); const [x, y, c] = fromScreenOf(q); place(q, x, y, c);
  },
};
