// Botanical Brush — calm colour by number on hand-drawn storybook pages (style C · Storybook Garden).
// 12 line-art pages split into 70–170 numbered areas (tools/build_pages.py merges areas under ~1500 px), colour plans
// made per page (tools/palettes.py). Tap a colour, tap its numbered areas; pinch / wheel / double-tap to zoom, drag to
// pan. Hint finds an area, the Bucket fills one whole colour. No fail state, no clock. Finished pages hang in a gallery.
import { money } from './kit/money.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { flow } from './kit/flow.js';
import { A, $, h, eat, theme, icon, toast, sheet, sheetOpen, toggleRow, snd, music, saved, dayKey, prettyDay, streakNow, streakWin, freezes, albumSheet, shareText, pluck } from './sb.js';

const NAME = 'Botanical Brush';
theme('bg/botanical-brush.webp', 'bg/botanical-brush-wide.webp');
const M = money({ game: 'botanical-brush', style: 'C' });
const D = daily('botanical-brush', null, { name: NAME });
const B = board({ game: 'botanical-brush', label: 'Pages coloured', limits: { maxRun: 1, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr' });
const F = flow('botanical-brush');   // recorded only: colouring has no fail state and no skill knob (FLOW_BRIEF rule 4)

// ---------------------------------------------------------------- content
const ORDER = ['robin', 'owl-oak', 'butterfly-lilies', 'kingfisher', 'rose-bouquet', 'teapot-roses', 'hedgehog', 'peony-vase', 'wildflower-wreath', 'bluetit-blossom', 'swan', 'hydrangea'];
const CHAP = [{ name: 'Garden Birds', ids: ['robin', 'owl-oak', 'kingfisher', 'bluetit-blossom'], need: 0 },
  { name: 'Blooms', ids: ['rose-bouquet', 'peony-vase', 'wildflower-wreath', 'hydrangea'], need: 4 },
  { name: 'Garden Friends', ids: ['butterfly-lilies', 'teapot-roses', 'hedgehog', 'swan'], need: 8 }];
const TITLES = { robin: 'Robin in the Holly', 'owl-oak': 'Owl in the Oak', 'butterfly-lilies': 'Swallowtail & Lilies', kingfisher: 'Kingfisher by the Reeds',
  'rose-bouquet': 'A Bouquet of Roses', 'teapot-roses': 'Teapot & Roses', hedgehog: 'Hedgehog in the Leaves', 'peony-vase': 'Peonies in a Vase',
  'wildflower-wreath': 'Wildflower Wreath', 'bluetit-blossom': 'Blue Tit in Blossom', swan: 'Swan on the Lily Pond', hydrangea: 'Blue Hydrangea' };
const chapOf = id => CHAP.findIndex(c => c.ids.includes(id));
const pageStamp = { robin: 'robin', 'bluetit-blossom': 'bluetit', kingfisher: 'kingfisher', 'owl-oak': 'owl', hedgehog: 'hedgehog', swan: 'swan', 'butterfly-lilies': 'butterfly',
  hydrangea: 'hydrangea', 'peony-vase': 'peony', 'teapot-roses': 'teapot', 'rose-bouquet': 'rose', 'wildflower-wreath': 'lavender' };
const STAMPS = [
  ...Object.entries(pageStamp).map(([id, img]) => [img, TITLES[id].replace(/^(A |The )/, '').split(/ (in|by|on|&) /)[0], TITLES[id], s => !!st.done[id]]),
  ['teacup', 'Teacup', '1,000 areas', s => s.areas >= 1000], ['strawberry', 'Strawberry', '3-day streak', s => (st.streak.best || 0) >= 3],
  ['sunflower', 'Sunflower', '7-day streak', s => (st.streak.best || 0) >= 7], ['tulip', 'Tulip', 'First daily page', s => s.dailies >= 1],
  ['cottage', 'Cottage', '5 pages', s => s.solved >= 5], ['beehive', 'Beehive', '3 in one day', s => s.today.n >= 3],
  ['fox', 'Fox', 'No bucket', s => s.noBucket], ['squirrel', 'Squirrel', 'No hints', s => s.noHint],
  ['lighthouse', 'Lighthouse', 'All 12 pages', s => ORDER.every(id => st.done[id])], ['sailboat', 'Sailboat', 'Save a picture', s => s.saved],
  ['cat', 'Cat', 'Colour one again', s => s.again], ['bluebells', 'Bluebells', 'Garden Birds', s => CHAP[0].ids.every(id => st.done[id])],
].map(([img, name, how, test]) => ({ id: img, img, name, how, test }));

// ---------------------------------------------------------------- saved state
const st = saved('bb_state', {
  journey: 1, done: {}, stamps: {}, saves: {}, last: null, unlocked: {},
  stats: { solved: 0, dailies: 0, areas: 0, noBucket: false, noHint: false, saved: false, again: false, today: { d: 0, n: 0 } },
  streak: { n: 0, last: 0, freeWeek: 0, extra: 0, best: 0 }, dailyDone: 0,
  set: { big: false, music: true, sfx: true, zoomTip: false },
});
const applySet = () => { document.documentElement.classList.toggle('big', st.set.big); music.on = st.set.music; snd.sfx = st.set.sfx; };
applySet();
const starsOf = id => (st.done[id] && st.done[id].stars) || 0;
const totalStars = () => ORDER.reduce((a, id) => a + starsOf(id), 0);
const chapOpen = k => totalStars() >= CHAP[k].need || !!st.unlocked[k];
const dailyPick = (d = dayKey()) => { let x = d * 2654435761 % 4294967296; x = (x ^ (x >>> 15)) >>> 0; return ORDER[x % ORDER.length]; };
function journeyPlan() {
  const open = ORDER.filter(id => chapOpen(chapOf(id)));
  const next = open.find(id => !st.done[id]);
  if (next) return { id: next, again: false };
  const cnt = id => (st.done[id] && st.done[id].n) || 0, min = Math.min(...open.map(cnt));
  return { id: open.find(id => cnt(id) === min && id !== st.lastId) || open[0], again: true };
}

// ---------------------------------------------------------------- page data (labels, regions, shade)
const cache = {};
function imgData(src, w = 1024) {
  return fetch(src).then(r => r.blob()).then(b => createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })).then(bm => {
    const c = document.createElement('canvas'); c.width = c.height = w; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0, w, w); return x.getImageData(0, 0, w, w).data;
  });
}
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function loadPage(id) {
  if (cache[id]) return cache[id];
  return cache[id] = (async () => {
    const [J, lab, shade, line] = await Promise.all([fetch(`./pages/${id}.json`).then(r => r.json()), imgData(`./pages/${id}.png`), imgData(`./pages/${id}-shade.webp`), loadImg(`${A}lines/${id}.webp`)]);
    const N = 1024 * 1024, L = new Uint16Array(N), S = new Uint8Array(N), n = J.regions.length;
    for (let i = 0; i < N; i++) { L[i] = lab[i * 4] + lab[i * 4 + 1] * 256; S[i] = shade[i * 4]; }
    const cnt = new Uint32Array(n + 2); for (let i = 0; i < N; i++) cnt[L[i]]++;
    const off = new Uint32Array(n + 2); for (let k = 1; k <= n + 1; k++) off[k] = off[k - 1] + cnt[k - 1];
    const pos = off.slice(), pix = new Uint32Array(N); for (let i = 0; i < N; i++) pix[pos[L[i]]++] = i;
    const R = [null];
    for (const r of J.regions) {
      let x0 = 1024, y0 = 1024, x1 = 0, y1 = 0; for (let k = off[r.id]; k < off[r.id + 1]; k++) { const p = pix[k], x = p & 1023, y = p >> 10; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      R[r.id] = { ...r, a: off[r.id], b: off[r.id + 1], bb: [x0, y0, x1 + 1, y1 + 1] };
    }
    const pal = J.palette.map(hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]);
    return { id, J, L, S, pix, R, pal, line, n };
  })();
}

// ---------------------------------------------------------------- page + HUD DOM
document.body.insertAdjacentHTML('beforeend', `
<canvas id="cv"></canvas>
<div id="home"></div>
<div id="hud" hidden>
  <div class="tl"></div>
  <div class="ttl"><span class="disp nm"></span><span class="ct"></span></div>
  <div class="tools"></div>
  <div class="pal"></div>
</div>`);
const css2 = document.createElement('style'); css2.textContent = `
#cv{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
#home{position:fixed;inset:0;z-index:20;overflow:auto;touch-action:pan-y;display:flex;flex-direction:column;align-items:center;padding:calc(12px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,rgba(250,246,236,0),rgba(250,246,236,.4) 30%,rgba(250,246,236,.4) 70%,rgba(250,246,236,0))}
#home[hidden],#hud[hidden]{display:none}
.hbar{position:absolute;top:calc(12px + env(safe-area-inset-top));left:12px;right:80px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.hcol{width:min(460px,100%);display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:66px}
.htitle{font-size:clamp(2.4rem,13vw,3.1rem);white-space:nowrap;line-height:.95;color:var(--navy);text-align:center;margin:0;text-shadow:0 2px 0 rgba(255,255,255,.7),0 0 18px rgba(255,255,255,.9)}
.hsub{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:600;font-size:1.25rem;color:var(--rose);margin-top:-4px;text-shadow:0 0 10px #fff}
.ribbon{position:relative;width:300px;height:88px;background:url(${A}ui/ribbon-sage.webp) center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:#fff8ef;
  font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:1.3rem;letter-spacing:1px;padding-bottom:10px;text-shadow:0 1px 2px rgba(30,50,30,.5);cursor:pointer}
.card{width:100%;display:flex;align-items:center;gap:14px;padding:12px;border-radius:22px;background:rgba(250,246,236,.95);border:2px solid var(--gold);box-shadow:0 8px 24px rgba(31,45,84,.18),inset 0 0 0 5px rgba(250,246,236,1),inset 0 0 0 6px rgba(176,136,52,.35);cursor:pointer;text-align:left}
.card .th{flex:none;width:104px;height:104px;border-radius:10px;border:3px solid #fff;box-shadow:0 3px 10px rgba(31,45,84,.3);background:#fff center/cover}
.card .tx{flex:1;min-width:0}
.card .k{font-size:.78rem;letter-spacing:2px;text-transform:uppercase;color:var(--rose);font-weight:700}
.card .t{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:1.55rem;line-height:1.05;margin:.15rem 0 .2rem}
.card .s{font-size:.9rem;color:var(--soft)}
.card.big{flex-direction:column;align-items:stretch;gap:10px}
.card.big .row{display:flex;gap:14px;align-items:center}
.card.big .th{width:132px;height:132px}
.hrow{display:flex;gap:10px;width:100%}.hrow .sb-btn{flex:1;min-width:0;padding:.5rem .6rem}
.done-tick{display:inline-block;background:var(--sage);color:#fff;border-radius:999px;padding:.1rem .6rem;font-size:.8rem;margin-left:.3rem}
#hud .tl{position:fixed;top:calc(12px + env(safe-area-inset-top));left:12px;display:flex;gap:10px;z-index:10}
#hud .tr{position:fixed;top:calc(12px + env(safe-area-inset-top));right:80px;z-index:10}
#hud .ttl{position:fixed;left:0;right:0;z-index:9;display:flex;justify-content:center;align-items:baseline;gap:.6rem;pointer-events:none;color:var(--navy);white-space:nowrap}
#hud .nm{font-size:1.4rem;text-shadow:0 0 8px #fff,0 0 2px #fff;overflow:hidden;text-overflow:ellipsis;max-width:62vw}
#hud .ct{font-size:.95rem;font-weight:700;background:rgba(250,246,236,.92);border:1.5px solid var(--gold);border-radius:999px;padding:.1rem .6rem}
#hud .tools{position:fixed;z-index:10;display:flex;gap:8px}
.tb{flex:1;display:flex;align-items:center;justify-content:center;gap:.35rem;min-height:56px;padding:0 .7rem 0 .3rem;border-radius:999px;border:2px solid var(--gold);background:linear-gradient(180deg,#fffdf7,#f1e7d2);
  font-weight:700;font-size:1rem;color:var(--navy);cursor:pointer;box-shadow:0 4px 12px rgba(31,45,84,.18);white-space:nowrap}
.tb img{width:42px;height:42px}
.tb:active{transform:scale(.96)}
.tb .pr{display:inline-flex;align-items:center;font-size:.8rem;color:var(--gold);margin-left:.1rem}
.tb .pr img{width:22px;height:22px}
html.big .tb{font-size:21px;padding:0 .5rem}html.big .tb > img{display:none}
#hud .pal{position:fixed;z-index:10;display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);gap:10px 10px;overflow-x:auto;overflow-y:hidden;touch-action:pan-x;padding:12px 14px;
  background:rgba(250,246,236,.93);border:1.5px solid rgba(176,136,52,.75);border-radius:22px;box-shadow:0 6px 20px rgba(31,45,84,.18);scrollbar-width:none}
#hud .pal::-webkit-scrollbar{display:none}
#hud .pal.v{grid-auto-flow:row;grid-template-rows:none;grid-template-columns:repeat(var(--cols,4),auto);overflow-x:hidden;overflow-y:auto;touch-action:pan-y;align-content:start;justify-content:center}
.sw{position:relative;width:68px;height:68px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;font-weight:700;font-size:1.15rem;
  background:conic-gradient(var(--gold) calc(var(--p,0)*1turn),rgba(31,45,84,.12) 0);transition:transform .15s}
.sw i{position:absolute;inset:5px;border-radius:50%;background:var(--c);box-shadow:inset 0 -3px 6px rgba(0,0,0,.12),inset 0 2px 4px rgba(255,255,255,.35)}
.sw b{position:relative;color:var(--ink2,#1F2D54)}
.sw.on{transform:scale(1.12)}.sw.on:after{content:'';position:absolute;inset:-5px;border-radius:50%;border:3px solid var(--navy)}
.sw.done i{opacity:.35}.sw.done b{font-size:0}.sw.done b:after{content:'✓';font-size:26px;color:var(--sage)}
.sw:active{transform:scale(.94)}
.lib h3,.galw h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.55rem;margin:1rem 0 .4rem;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(176,136,52,.45)}
.lib h3 small{font-family:'Libre Baskerville',Georgia,serif;font-size:.8rem;color:var(--soft)}
.ggrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media (min-width:700px){.ggrid{grid-template-columns:repeat(4,1fr)}}
.gi{position:relative;cursor:pointer;text-align:center;font-size:1rem;line-height:1.2}
.gi canvas,.gi .im{width:100%;aspect-ratio:1;border-radius:8px;border:3px solid #fff;box-shadow:0 4px 12px rgba(31,45,84,.25);background:#fff;display:block}
.gi.lock canvas{filter:grayscale(.6) opacity(.55)}
.gi .lk{position:absolute;top:calc(50% - 50px);left:50%;transform:translate(-50%,-50%);width:64px}
.gi .stars{display:flex;justify-content:center;gap:2px;margin-top:4px}.gi .stars img{width:26px;height:26px}
.gi .pc{position:absolute;top:8px;right:8px;background:var(--navy);color:var(--ivory);border-radius:999px;font-size:.7rem;padding:.1rem .45rem}
.frm{padding:10px;background:linear-gradient(135deg,#d9b25a,#a57d2c 40%,#e7c876 60%,#9c7426);border-radius:6px;box-shadow:0 8px 18px rgba(31,45,84,.35)}
.frm canvas{border:6px solid #f8f2e4;border-radius:2px;box-shadow:none}
.unl{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:.3rem 0 .6rem;font-size:.9rem;color:var(--soft)}
.col{display:flex;flex-direction:column;gap:10px}
.wstars{display:flex;justify-content:center;gap:6px;margin:.2rem 0}.wstars img{width:54px;height:54px}
.wline{display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:1.2rem;font-weight:700;color:var(--navy)}
.wline img{width:40px;height:40px}
.wstamp{display:flex;align-items:center;gap:12px;justify-content:center;background:rgba(86,120,84,.1);border-radius:16px;padding:.5rem;margin:.4rem 0}
.wstamp img{width:72px}
.howto li{margin:.35rem 0;font-size:1rem;line-height:1.4}
.big-view{width:min(420px,80vw);margin:.4rem auto .8rem}
.big-view canvas{width:100%}
`;
document.head.appendChild(css2);
const cv = $('#cv'), g = cv.getContext('2d'), home = $('#home'), hud = $('#hud'), palEl = $('#hud .pal');

function coinPill() {
  const b = eat(h(`<button class="sb-coins" aria-label="Coins and shop"><img src="${A}ui/coin.webp" alt=""><span class="n">${M.coins().toLocaleString()}</span><b>+</b></button>`));
  b.addEventListener('click', () => { snd.tap(); M.shop(); }); return b;
}
M.onChange(s => document.querySelectorAll('.sb-coins .n').forEach(e => e.textContent = s.coins.toLocaleString()));
$('#hud .tl').append(icon('home', 'Home', () => { snd.tap(); goHome(); }));
$('#hud .tl').append(icon('zoom', 'Zoom', () => { snd.tap(); if (view.z > 1.05) zoomTo(1, W / 2, H / 2); else zoomTo(2.6, L.ax + L.as / 2, L.ay + L.as / 2); }));
const hudTR = h(`<div class="tr"></div>`); hudTR.append(coinPill()); hud.append(hudTR);
function tb(img, label, fn) { const b = eat(h(`<button class="tb"><img src="${A}ui/i-${img}.webp" alt=""><span class="lb">${label}</span><span class="pr"></span></button>`)); b.addEventListener('click', fn); $('#hud .tools').append(b); return b; }
const hintB = tb('hint', 'Find', () => hint());
const bucketB = tb('pencil', 'Fill all', () => bucket());
function syncTools() {
  if (!cur) return;
  const free = Math.max(0, 3 - cur.save.hints);
  hintB.querySelector('.pr').innerHTML = free ? `${free} free` : `<img src="${A}ui/coin.webp" alt="">15`;
  bucketB.querySelector('.pr').innerHTML = `<img src="${A}ui/coin.webp" alt="">40`;
}

// ---------------------------------------------------------------- state + art layer
let state = 'ready', cur = null, dirty = true, anims = [], parts = [], pulse = null, doneAt = 0, t0 = 0;
const art = document.createElement('canvas'); art.width = art.height = 1024;
const ax = art.getContext('2d', { willReadFrequently: true }); let id = null;
const BASE = [251, 248, 241];
function paintRegion(r, mode) {   // mode: 'fill' | 'blank' | 'mark'
  const P = cur.P, d = id.data, S = P.S, pix = P.pix, col = P.pal[r.c];
  for (let k = r.a; k < r.b; k++) {
    const p = pix[k], s = S[p] / 235, o = p * 4;
    let c = BASE;
    if (mode === 'fill') c = col;
    else if (mode === 'mark') { const x = p & 1023, y = p >> 10; c = ((x + y) >> 3) & 1 ? [214, 211, 204] : [232, 229, 222]; }
    d[o] = Math.min(255, c[0] * s); d[o + 1] = Math.min(255, c[1] * s); d[o + 2] = Math.min(255, c[2] * s); d[o + 3] = 255;
  }
}
function flush(bb) { ax.putImageData(id, 0, 0, bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); dirty = true; }
function remark(prev) {   // re-hatch the selected colour's open areas
  for (const r of cur.P.R) if (r && !cur.filled.has(r.id) && (r.c === prev || r.c === cur.sel)) { paintRegion(r, r.c === cur.sel ? 'mark' : 'blank'); flush(r.bb); }
}

async function startPage(pid, { isDaily = false, again = false } = {}) {
  const key = isDaily ? 'daily_' + dayKey() : pid;
  const save = st.saves[key] || { id: pid, filled: [], ms: 0, hints: 0, bucket: 0, order: [], daily: isDaily, again };
  st.saves[key] = save; st.last = key; st.save();
  const P = await loadPage(pid);
  cur = { id: pid, P, key, save, isDaily, filled: new Set(save.filled), sel: -1, left: [] };
  id = ax.createImageData(1024, 1024);
  for (const r of P.R) if (r) paintRegion(r, cur.filled.has(r.id) ? 'fill' : 'blank');
  ax.putImageData(id, 0, 0);
  state = 'play'; anims = []; parts = []; pulse = null; doneAt = 0; t0 = performance.now();
  view.z = 1; layout();
  home.hidden = true; hud.hidden = false;
  $('#hud .nm').textContent = TITLES[pid];
  buildPalette();
  selectColour(firstOpen(0));
  updateCount(); syncTools();
  if (!isDaily) M.level(st.journey);
  B.start();
  if (!st.set.zoomTip) { st.set.zoomTip = true; st.save(); toast('Pinch or double-tap to zoom in'); }
  else if (save.filled.length) toast('Welcome back to your page');
  dirty = true;
}
const leftOf = c => cur.P.R.filter(r => r && r.c === c && !cur.filled.has(r.id)).length;
const totalOf = c => cur.P.R.filter(r => r && r.c === c).length;
function firstOpen(from) { const n = cur.P.pal.length; for (let k = 0; k < n; k++) { const c = (from + k) % n; if (leftOf(c)) return c; } return -1; }
function buildPalette() {
  palEl.innerHTML = '';
  cur.P.pal.forEach((c, k) => {
    const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const b = eat(h(`<button class="sw" aria-label="Colour ${k + 1}" style="--c:rgb(${c});--ink2:${lum > 150 ? '#1F2D54' : '#FAF6EC'}"><i></i><b>${k + 1}</b></button>`));
    b.addEventListener('click', () => { snd.tap(); selectColour(k); });
    palEl.append(b);
  });
  syncPalette();
}
function syncPalette() {
  [...palEl.children].forEach((b, k) => { const t = totalOf(k), l = leftOf(k); b.style.setProperty('--p', t ? (t - l) / t : 1); b.classList.toggle('done', !l); b.classList.toggle('on', k === cur.sel); });
}
function selectColour(k) {
  if (k < 0 || !cur) return; const prev = cur.sel; cur.sel = k; remark(prev); syncPalette();
  const b = palEl.children[k]; if (b) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function updateCount() { if (!cur) return; $('#hud .ct').textContent = `${Math.floor(100 * cur.filled.size / cur.P.n)}%`; }

// ---------------------------------------------------------------- layout + view
let W = 0, H = 0, dpr = 1, wide = false;
const L = { ax: 0, ay: 0, as: 300 };
const view = { z: 1, ox: 0, oy: 0 };
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  wide = W > H * 1.05 && W >= 700;
  const big = st.set.big ? 1.2 : 1, top = 12 + 56 + 14 + 34 * big, tools = $('#hud .tools'), ttl = $('#hud .ttl');
  ttl.style.top = (12 + 56 + 8) + 'px';
  if (!wide) {
    const palH = 2 * 68 + 10 + 24 + 6;
    L.as = Math.floor(Math.min(W - 24, H - top - 12 - 56 - 12 - palH - 16)); L.ax = Math.round((W - L.as) / 2); L.ay = Math.round(top + 4);
    const ty = L.ay + L.as + 12;
    Object.assign(tools.style, { left: '12px', right: '12px', top: ty + 'px', width: '' });
    Object.assign(palEl.style, { left: '8px', right: '8px', top: ty + 56 + 12 + 'px', width: '', height: '', bottom: '' }); palEl.classList.remove('v');
  } else {
    const panelW = Math.min(420, Math.max(300, W * 0.3));
    L.as = Math.floor(Math.min(H - top - 24, W - panelW - 72)); L.ax = Math.round((W - L.as - panelW - 28) / 2); L.ay = Math.round(top + 4);
    const px = L.ax + L.as + 28;
    Object.assign(tools.style, { left: px + 'px', right: '', width: panelW + 'px', top: L.ay + 'px' });
    Object.assign(palEl.style, { left: px + 'px', right: '', width: panelW + 'px', top: L.ay + 68 + 'px', height: (L.as - 68) + 'px', bottom: '' });
    palEl.classList.add('v'); palEl.style.setProperty('--cols', Math.max(3, Math.floor((panelW - 28) / 74)));
  }
  clampView(); dirty = true;
}
addEventListener('resize', () => { if (state !== 'ready') layout(); });
const sc = () => (L.as / 1024) * view.z;
function clampView() {
  view.z = Math.max(1, Math.min(6, view.z));
  const s = L.as * view.z;
  view.ox = Math.min(L.ax, Math.max(L.ax + L.as - s, view.ox || L.ax)); view.oy = Math.min(L.ay, Math.max(L.ay + L.as - s, view.oy || L.ay));
  if (view.z === 1) { view.ox = L.ax; view.oy = L.ay; }
}
const toArt = (x, y) => [(x - view.ox) / sc(), (y - view.oy) / sc()];
const toScr = (x, y) => [view.ox + x * sc(), view.oy + y * sc()];
const inArt = (x, y) => x >= L.ax && x < L.ax + L.as && y >= L.ay && y < L.ay + L.as;
function zoomAt(z, sx, sy) { const [x, y] = toArt(sx, sy); view.z = z; const s = sc(); view.ox = sx - x * s; view.oy = sy - y * s; clampView(); dirty = true; }
let zoomAnim = null;
function zoomTo(z, sx, sy, cx = null, cy = null) {   // ease to zoom z; centre the art point (cx, cy) if given
  const from = { ...view }; const [axp, ayp] = cx === null ? toArt(sx, sy) : [cx, cy];
  const tz = Math.max(1, Math.min(6, z)), ts = (L.as / 1024) * tz;
  const tx = cx === null ? sx - axp * ts : L.ax + L.as / 2 - axp * ts, ty = cx === null ? sy - ayp * ts : L.ay + L.as / 2 - ayp * ts;
  zoomAnim = { from, to: { z: tz, ox: tx, oy: ty }, t: performance.now() }; dirty = true;
}

// ---------------------------------------------------------------- input
const ptrs = new Map(); let down = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 };
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || sheetOpen()) return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); zoomAnim = null;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; down = null; return; }
  if (ptrs.size > 1) return;
  down = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy, moved: false };
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoomAt(pinch.z * d / pinch.d, pinch.mx, pinch.my); view.ox += mx - pinch.mx; view.oy += my - pinch.my; clampView(); return; }
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) > 9) down.moved = true;
  if (down.moved && view.z > 1) { view.ox = down.ox + dx; view.oy = down.oy + dy; clampView(); dirty = true; }
});
function up(e) {
  ptrs.delete(e.pointerId);
  if (pinch) { if (ptrs.size < 2) pinch = null; down = null; return; }
  const d = down; down = null; if (!d || d.moved || !inArt(d.x, d.y)) return;
  const now = performance.now();
  if (now - lastTap.t < 300 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 26) { lastTap.t = 0; if (view.z > 1.05) zoomTo(1, d.x, d.y); else zoomTo(3, d.x, d.y); snd.tap(); return; }
  lastTap = { t: now, x: d.x, y: d.y };
  tapAt(d.x, d.y);
}
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { if (state !== 'play') return; e.preventDefault(); if (inArt(e.clientX, e.clientY)) { zoomAnim = null; zoomAt(view.z * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY); } }, { passive: false });
function regionAt(x, y) { const X = Math.floor(x), Y = Math.floor(y); if (X < 0 || Y < 0 || X > 1023 || Y > 1023) return null; return cur.P.R[cur.P.L[(Y << 10) + X]] || null; }
function tapAt(sx, sy) {
  const [x, y] = toArt(sx, sy); let r = regionAt(x, y);
  if (!r) return;
  if (cur.filled.has(r.id) || r.c !== cur.sel) {
    // forgiving finger: an open area of the chosen colour within ~10 screen px counts
    const rad = 10 / sc(); let best = null, bd = 1e9;
    for (let a = 0; a < 16 && cur.sel >= 0; a++) for (const f of [0.5, 1]) { const q = regionAt(x + Math.cos(a / 16 * 6.283) * rad * f, y + Math.sin(a / 16 * 6.283) * rad * f); if (q && q.c === cur.sel && !cur.filled.has(q.id)) { const dd = f; if (dd < bd) { bd = dd; best = q; } } }
    if (best) r = best;
    else if (!cur.filled.has(r.id)) { snd.no(); pulse = { r, t: performance.now(), wrong: true }; dirty = true; return; }
    else return;
  }
  fill(r, x, y);
}
function fill(r, x, y, quiet = false) {
  if (cur.filled.has(r.id)) return;
  cur.filled.add(r.id); cur.save.filled.push(r.id); cur.save.order.push(r.id);
  st.stats.areas++;
  // reveal outward from the tap: counting sort of the area's pixels by distance
  const P = cur.P, n = r.b - r.a, dist = new Uint16Array(n); let maxd = 0;
  for (let k = 0; k < n; k++) { const p = P.pix[r.a + k], dx = (p & 1023) - x, dy = (p >> 10) - y; const dd = Math.sqrt(dx * dx + dy * dy) | 0; dist[k] = dd; if (dd > maxd) maxd = dd; }
  const cnt = new Uint32Array(maxd + 2); for (let k = 0; k < n; k++) cnt[dist[k] + 1]++;
  for (let k = 1; k <= maxd + 1; k++) cnt[k] += cnt[k - 1];
  const ord = new Uint32Array(n); for (let k = 0; k < n; k++) ord[cnt[dist[k]]++] = P.pix[r.a + k];
  anims.push({ r, ord, done: 0, t: performance.now(), dur: quiet ? 160 : Math.min(520, 200 + Math.sqrt(n) * 1.2) });
  if (!quiet) { snd.brush(cur.filled.size); try { navigator.vibrate && navigator.vibrate(6); } catch (_) {} const [sx, sy] = toScr(r.x, r.y); sparkle(sx, sy, 6, P.pal[r.c]); }
  if (pulse && pulse.r === r) pulse = null;
  updateCount(); saveSoon();
  if (!leftOf(r.c)) { setTimeout(() => { snd.chime(3); }, 120); const nx = firstOpen(r.c + 1); syncPalette(); if (nx >= 0) setTimeout(() => selectColour(nx), quiet ? 0 : 380); }
  else syncPalette();
  if (cur.filled.size === P.n) setTimeout(finish, 600);
}
let saveT = 0;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => { if (cur && state === 'play') { cur.save.ms += performance.now() - t0; t0 = performance.now(); } st.save(); }, 500); }

async function hint() {
  if (state !== 'play' || sheetOpen()) return;
  let c = cur.sel; if (c < 0 || !leftOf(c)) c = firstOpen(0); if (c < 0) return;
  if (cur.save.hints >= 3) { if (!M.spend(15, 'hint')) { if (!(await M.rewarded('hint', { what: 'Find one area to colour' }))) return; } }
  cur.save.hints++; saveSoon(); syncTools();
  if (c !== cur.sel) selectColour(c);
  // the open area of this colour nearest the middle of what you see
  const [mx, my] = toArt(L.ax + L.as / 2, L.ay + L.as / 2);
  let best = null, bd = 1e12; for (const r of cur.P.R) if (r && r.c === c && !cur.filled.has(r.id)) { const d = (r.x - mx) ** 2 + (r.y - my) ** 2; if (d < bd) { bd = d; best = r; } }
  if (!best) return;
  const need = Math.max(1, Math.min(4, 14 / ((L.as / 1024) * Math.max(5, best.r))));
  zoomTo(Math.max(view.z, need), 0, 0, best.x, best.y);
  pulse = { r: best, t: performance.now() + 300 }; snd.chime(2); dirty = true;
}
async function bucket() {
  if (state !== 'play' || sheetOpen()) return;
  const c = cur.sel >= 0 && leftOf(cur.sel) ? cur.sel : firstOpen(0); if (c < 0) return;
  if (!M.spend(40, 'bucket')) { if (!(await M.rewarded('hint', { what: `Fill every area of colour ${c + 1} at once`, title: 'Fill a whole colour' }))) return; }
  cur.save.bucket++; if (c !== cur.sel) selectColour(c);
  const list = cur.P.R.filter(r => r && r.c === c && !cur.filled.has(r.id));
  list.forEach((r, k) => setTimeout(() => { if (cur && state === 'play') fill(r, r.x, r.y, true); }, k * 40));
  snd.brush(3); setTimeout(() => snd.chime(4), 200);
}

// ---------------------------------------------------------------- finishing
function finish() {
  if (state !== 'play') return;
  state = 'won'; doneAt = performance.now();
  const s = cur.save; s.ms += performance.now() - t0;
  const S = st.stats, today = dayKey(), pid = cur.id;
  S.solved++; if (S.today.d !== today) S.today = { d: today, n: 0 }; S.today.n++;
  if (!s.bucket) S.noBucket = true; if (!s.hints) S.noHint = true; if (s.again || st.done[pid]) S.again = true;
  const stars = 1 + (s.bucket ? 0 : 1) + (!s.bucket && s.hints <= 3 ? 1 : 0), prev = starsOf(pid);
  const opened = CHAP.map((c, k) => chapOpen(k));
  st.done[pid] = { n: ((st.done[pid] && st.done[pid].n) || 0) + 1, stars: Math.max(prev, stars), when: today };
  st.lastId = pid;
  let streak = null;
  if (cur.isDaily) { S.dailies++; streak = streakWin(st.streak); st.dailyDone = today; } else st.journey++;
  const newStamps = STAMPS.filter(t => !st.stamps[t.id] && t.test(S)); for (const t of newStamps) st.stamps[t.id] = today;
  const coins = 20 + Math.round(cur.P.n / 5) + (cur.isDaily ? 50 : 0);
  M.add(coins, cur.isDaily ? 'daily' : 'win');
  const grid = cur.isDaily ? shareGrid() : '';
  delete st.saves[cur.key]; st.last = null; st.save();
  F.level(true); B.submit(1, { ms: Math.max(1000, s.ms) }); D.won(S.solved, 'coloured');
  const unlocked = CHAP.map((c, k) => !opened[k] && chapOpen(k) ? c.name : null).filter(Boolean);
  view.z = Math.max(view.z, 1); zoomTo(1, W / 2, H / 2);
  setTimeout(() => { snd.win(); petals(70); }, 500);
  setTimeout(() => winCard({ coins, stars, newStamps, streak, grid, unlocked }), 2300);
}
function shareGrid() {   // spoiler-free: 4×4 blocks of the page, each by when you finished it (sprout → bloom)
  const when = {}, o = cur.save.order; o.forEach((rid, k) => when[rid] = k / o.length);
  const E = ['🌱', '🌿', '🌷', '🌸'], rows = [];
  for (let by = 0; by < 4; by++) { let row = ''; for (let bx = 0; bx < 4; bx++) { let m = 0, n = 0;
    for (const r of cur.P.R) if (r && r.x >= bx * 256 && r.x < bx * 256 + 256 && r.y >= by * 256 && r.y < by * 256 + 256) { m += when[r.id] || 0; n++; }
    row += E[Math.min(3, Math.floor((n ? m / n : 0.5) * 4))]; } rows.push(row); }
  return rows.join('\n');
}
function winCard({ coins, stars, newStamps, streak, grid, unlocked }) {
  const daily = cur.isDaily, stamp = newStamps[0];
  const sh = sheet(`
    <h2>${daily ? 'Daily page done' : 'A finished painting'}</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center;margin:0"><i>${TITLES[cur.id]}</i> · now in your gallery</p>
    <div class="wstars" aria-label="${stars} of 3 stars">${[1, 2, 3].map(k => `<img src="${A}ui/${k <= stars ? 'star-full' : 'star-empty'}.webp" alt="">`).join('')}</div>
    <div class="wline"><img src="${A}ui/coin.webp" alt=""><span class="cn">+${coins}</span> coins</div>
    ${daily && streak ? `<p style="text-align:center"><b>${streak.n}-day streak</b>${streak.used ? ' · a freeze kept it going' : ''}</p><div class="sb-grid">${grid.replace(/\n/g, '<br>')}</div>` : ''}
    ${stamp ? `<div class="wstamp"><img src="${A}stamps/stamp-${stamp.img}.webp" alt=""><div><b>New stamp: ${stamp.name}</b><br><small>${stamp.how}</small></div></div>` : ''}
    ${unlocked.length ? `<p style="text-align:center"><b>New chapter open: ${unlocked.join(', ')}</b></p>` : ''}
    <div class="col" style="margin-top:.6rem">
      <button class="sb-btn nx">${daily ? 'Back to the studio' : 'Next page'}</button>
      ${daily ? `<button class="sb-btn ivory shr"><img src="${A}ui/i-share.webp" alt="">Share my grid</button>` : `<button class="sb-btn rose dbl"><img src="${A}ui/i-video.webp" alt="">Double to ${coins * 2} coins</button>`}
      <button class="sb-btn ivory hm">Home</button>
    </div>`, { close: false });
  let left = false;
  const go = async where => { if (left) return; left = true; sh.close(); snd.tap(); await M.breakAd('level-end', { level: st.journey }); if (where === 'home' || daily) goHome(); else { const j = journeyPlan(); startPage(j.id, { again: j.again }); } };
  sh.el.querySelector('.nx').onclick = e => { e.stopPropagation(); go('next'); };
  sh.el.querySelector('.hm').onclick = e => { e.stopPropagation(); go('home'); };
  const dbl = sh.el.querySelector('.dbl');
  if (dbl) dbl.onclick = async e => { e.stopPropagation(); if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); sh.el.querySelector('.cn').textContent = '+' + coins * 2; snd.coin(); } dbl.remove(); };
  const shr = sh.el.querySelector('.shr');
  if (shr) shr.onclick = e => { e.stopPropagation(); shareText(`Botanical Brush · ${prettyDay()}\n${grid}\n${streak ? streak.n + '-day streak' : ''}\n${location.origin}${location.pathname}?daily=1`); };
  sh.el.parentElement.addEventListener('click', e => { if (!e.target.closest('button')) go('next'); });
  if (stamp) setTimeout(() => snd.chime(5), 300);
}

// ---------------------------------------------------------------- sounds (brush swish + rising harp)
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
snd.brush = (i = 0) => { if (!snd.sfx) return; snd.soft(); pluck(SCALE[i % SCALE.length] + (i % 20 >= 10 ? 12 : 0), 0.05, 1.4); };

// ---------------------------------------------------------------- particles
function sparkle(x, y, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 0.8 + Math.random() * 2; parts.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, life: 1, s: 2 + Math.random() * 2.5, c: i % 2 ? '#fff6d6' : `rgb(${col})` }); } }
function petals(n) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; for (let i = 0; i < n; i++) parts.push({ k: 'p', x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.3, life: 1, s: 6 + Math.random() * 6, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.08, c: ['#e8a3b0', '#f3c6cf', '#9DBB7E', '#fff3f0', '#e9c46a'][i % 5], ph: Math.random() * 6 }); }

// ---------------------------------------------------------------- drawing
function rr(x, y, w, h2, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h2, r) : g.rect(x, y, w, h2); }
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function draw(now) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!cur || state === 'ready') return false;
  let anim = false;
  if (zoomAnim) { const k = ease((now - zoomAnim.t) / 420), a = zoomAnim.from, b = zoomAnim.to; view.z = a.z + (b.z - a.z) * k; view.ox = a.ox + (b.ox - a.ox) * k; view.oy = a.oy + (b.oy - a.oy) * k; clampView(); if (k >= 1) zoomAnim = null; anim = true; }
  // fill animations write into the art layer
  for (const f of anims) {
    const k = Math.min(1, (now - f.t) / f.dur), upto = Math.floor(f.ord.length * (1 - Math.pow(1 - k, 2))), d = id.data, P = cur.P, col = P.pal[f.r.c];
    for (let i = f.done; i < upto; i++) { const p = f.ord[i], s = P.S[p] / 235, o = p * 4; d[o] = Math.min(255, col[0] * s); d[o + 1] = Math.min(255, col[1] * s); d[o + 2] = Math.min(255, col[2] * s); }
    f.done = upto; flush(f.r.bb); anim = true;
  }
  anims = anims.filter(f => f.done < f.ord.length);
  const { ax: X, ay: Y, as: S } = L, s = sc();
  // mount: ivory card with a gold hairline and soft shadow
  g.save(); g.shadowColor = 'rgba(31,45,84,.28)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rr(X - 9, Y - 9, S + 18, S + 18, 14); g.fillStyle = '#fbf7ee'; g.fill(); g.restore();
  g.strokeStyle = '#B08834'; g.lineWidth = 1.5; rr(X - 5, Y - 5, S + 10, S + 10, 10); g.stroke();
  g.save(); g.beginPath(); g.rect(X, Y, S, S); g.clip();
  g.imageSmoothingQuality = 'high';
  g.drawImage(art, view.ox, view.oy, 1024 * s, 1024 * s);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = doneAt ? 1 - 0.45 * ease((now - doneAt) / 1400) : 1;
  g.drawImage(cur.P.line, view.ox, view.oy, 1024 * s, 1024 * s);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // numbers
  if (!doneAt) {
    const big = st.set.big ? 1.15 : 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of cur.P.R) {
      if (!r || cur.filled.has(r.id)) continue;
      const rs = r.r * s; if (rs < 5.5) continue;
      const [x, y] = toScr(r.x, r.y); if (x < X - 20 || y < Y - 20 || x > X + S + 20 || y > Y + S + 20) continue;
      const label = String(r.c + 1), fs = Math.min(34, Math.max(10, rs * (label.length > 1 ? 1.0 : 1.25))) * big;
      const on = r.c === cur.sel;
      g.font = `${on ? 700 : 400} ${fs}px 'Libre Baskerville',Georgia,serif`;
      g.fillStyle = on ? '#1F2D54' : 'rgba(80,80,90,.62)'; g.fillText(label, x, y + fs * 0.04);
    }
  }
  // pulse ring for a hint / a wrong tap
  if (pulse) {
    const k = (now - pulse.t) / 1800; if (k > 1) pulse = null; else if (k > 0) { anim = true; const [x, y] = toScr(pulse.r.x, pulse.r.y), rad = Math.max(16, pulse.r.r * s * 1.4) * (1 + 0.15 * Math.sin(now / 120));
      g.save(); g.globalAlpha = 1 - k; g.strokeStyle = pulse.wrong ? '#B04A5C' : '#B08834'; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, rad, 0, 6.28); g.stroke();
      if (pulse.wrong) { g.font = `700 ${22 * (st.set.big ? 1.15 : 1)}px 'Libre Baskerville',Georgia,serif`; g.fillStyle = '#B04A5C'; g.textAlign = 'center'; g.fillText(`this is ${pulse.r.c + 1}`, x, y - rad - 14); }
      g.restore(); } else anim = true;
  }
  if (doneAt) { const k = (now - doneAt) / 1200; if (k < 2.2) { anim = true; const gx = X - S * 0.4 + (k % 1) * S * 1.8, gr = g.createLinearGradient(gx - 90, Y, gx + 90, Y + S * 0.3); gr.addColorStop(0, 'rgba(255,250,230,0)'); gr.addColorStop(0.5, 'rgba(255,250,230,.5)'); gr.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = gr; g.fillRect(X, Y, S, S); } }
  g.restore();
  if (doneAt) { const k = ease((now - doneAt - 300) / 800); if (k > 0) { g.globalAlpha = k; g.strokeStyle = '#B08834'; g.lineWidth = 4; rr(X - 6, Y - 6, S + 12, S + 12, 10); g.stroke(); g.lineWidth = 1.2; rr(X - 12, Y - 12, S + 24, S + 24, 15); g.stroke(); g.globalAlpha = 1; } }
  if (parts.length) anim = true;
  parts = parts.filter(p => {
    if (p.k === 's') { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.035; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s * p.life + 0.5, 0, 6.28); g.fill(); }
    else { p.ph += 0.03; p.x += p.vx + Math.sin(p.ph) * 0.7; p.y += p.vy; p.a += p.va; if (p.y > H + 20) p.life = 0; g.globalAlpha = 0.9; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.28); g.fill(); g.restore(); }
    g.globalAlpha = 1; return p.life > 0;
  });
  return anim;
}
function frame(now) { if (dirty || anims.length || parts.length || zoomAnim || pulse || (doneAt && now - doneAt < 3000)) { const a = draw(now); dirty = !!a; } requestAnimationFrame(frame); }
requestAnimationFrame(frame);
setInterval(() => { if (state === 'play' && cur) { cur.save.ms += performance.now() - t0; t0 = performance.now(); st.save(); } }, 15000);
addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && cur) { cur.save.ms += performance.now() - t0; st.save(); } t0 = performance.now(); });

// ---------------------------------------------------------------- thumbnails (page in its current colours)
const thumbs = {};
async function thumb(pid, filledIds, size = 256, full = false) {
  const P = await loadPage(pid), c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), im = x.createImageData(size, size), d = im.data, step = 1024 / size, F = new Set(filledIds);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const p = (Math.floor(j * step) << 10) + Math.floor(i * step), r = P.R[P.L[p]], o = (j * size + i) * 4, col = r && (full || F.has(r.id)) ? P.pal[r.c] : BASE, sh = P.S[p] / 235;
    d[o] = Math.min(255, col[0] * sh); d[o + 1] = Math.min(255, col[1] * sh); d[o + 2] = Math.min(255, col[2] * sh); d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.drawImage(P.line, 0, 0, size, size);
  return c;
}
const progressOf = pid => { const s = st.saves[pid]; return s ? s.filled : (st.done[pid] ? null : []); };
async function thumbInto(el, pid, opts = {}) {
  const f = progressOf(pid), done = !!st.done[pid];
  const c = await thumb(pid, f || [], opts.size || 256, opts.full ?? (done && !f));
  c.className = el.className; el.replaceWith(c); return c;
}

// ---------------------------------------------------------------- home, library, gallery, settings
function goHome() {
  if (state === 'play' && cur) { cur.save.ms += performance.now() - t0; st.save(); }
  state = 'ready'; cur = null; hud.hidden = true; home.hidden = false; dirty = true; renderHome();
}
function renderHome() {
  const j = journeyPlan(), dp = dailyPick(), sn = streakNow(st.streak), doneToday = st.dailyDone === dayKey();
  const resume = st.last && st.saves[st.last] && !st.saves[st.last].daily ? st.saves[st.last] : null;
  const cid = resume ? resume.id : j.id, dsave = st.saves['daily_' + dayKey()], dmode = D.isDaily && !doneToday;
  home.innerHTML = `
    <div class="hbar"><span class="hl"></span><span class="hr"></span></div>
    <div class="hcol">
      <h1 class="htitle disp">Botanical Brush</h1>
      <div class="hsub">colour by number</div>
      <div class="ribbon" role="button">${sn.n > 0 ? `${sn.n}-day streak` : 'Begin a streak'}</div>
      ${dmode ? '' : `<div class="card daily" role="button"><span class="th"></span><div class="tx">
        <div class="k">Today · ${prettyDay().replace(/(\d+ \w{3})\w*/, '$1')}</div><div class="t">${TITLES[dp]}</div>
        <div class="s">${doneToday ? 'Done <span class="done-tick">✓</span> · paint it again' : dsave ? 'Carry on with today’s page' : 'The daily page, the same for everyone'}</div></div></div>`}
      <div class="card big cont" role="button"><div class="row"><span class="th"></span><div class="tx">
        <div class="k">${dmode ? 'Daily page · ' + prettyDay().replace(/(\d+ \w{3})\w*/, '$1') : resume ? 'In progress' : j.again ? 'Paint again' : 'Page ' + st.journey}</div><div class="t">${TITLES[dmode ? dp : cid]}</div>
        <div class="s">${dmode ? 'The same page for everyone today' : resume ? 'Carry on where you left off' : (j.again ? 'Fresh paper, same picture' : 'A new page to colour')}</div></div></div>
        <button class="sb-btn go"><img src="${A}ui/i-${dmode ? 'calendar' : 'play'}.webp" alt="">${dmode ? "Paint today's page" : resume ? 'Carry on' : 'Paint'}</button></div>
      <div class="hrow"><button class="sb-btn ivory lib"><img src="${A}ui/i-album.webp" alt="">Pages</button><button class="sb-btn ivory gal"><img src="${A}ui/i-star.webp" alt="">Gallery</button></div>
      <button class="sb-btn ivory alb" style="width:100%"><img src="${A}ui/i-gift.webp" alt="">Stamp album · ${Object.keys(st.stamps).length} of ${STAMPS.length}</button>
    </div>`;
  $('.hl', home).append(icon('settings', 'Settings', settings));
  $('.hr', home).append(coinPill());
  const dth = $('.daily .th', home); if (dth) thumbInto(dth, dp, { size: 208, full: false }).then(c => c.style.cssText = 'width:104px;height:104px');
  thumbInto($('.cont .th', home), dmode ? dp : cid, { size: 264 }).then(c => c.style.cssText = 'width:132px;height:132px');
  const playDaily = () => { snd.tap(); startPage(dp, { isDaily: true }); };
  const dc = $('.daily', home); if (dc) dc.onclick = playDaily;
  $('.ribbon', home).onclick = () => { snd.tap(); streakSheet(); };
  $('.cont', home).onclick = () => { snd.tap(); if (dmode) return playDaily(); startPage(cid, { again: !resume && j.again }); };
  $('.lib', home).onclick = e => { e.stopPropagation(); snd.tap(); library(); };
  $('.gal', home).onclick = e => { e.stopPropagation(); snd.tap(); gallery(); };
  $('.alb', home).onclick = e => { e.stopPropagation(); snd.tap(); albumSheet(STAMPS, st.stamps); };
}
function streakSheet() {
  const sn = streakNow(st.streak), fz = freezes(st.streak);
  const s = sheet(`<h2>Daily streak</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center;font-size:1.3rem"><b>${sn.n} day${sn.n === 1 ? '' : 's'}</b>${st.streak.best ? ` · best ${st.streak.best}` : ''}</p>
    <p>Finish the daily page each day to grow your streak. Miss a day and a <b>streak freeze</b> keeps it safe: you get one free every week.</p>
    <p style="text-align:center">Freezes ready: <b>${fz}</b></p>
    <div class="col"><button class="sb-btn ivory buy" ${(st.streak.extra || 0) >= 2 ? 'disabled' : ''}><img src="${A}ui/coin.webp" alt="">Extra freeze · 60 coins</button>
    <button class="sb-btn go">${st.dailyDone === dayKey() ? 'Close' : "Paint today's page"}</button></div>`);
  s.el.querySelector('.buy').onclick = () => { if (M.spend(60, 'freeze')) { st.streak.extra = (st.streak.extra || 0) + 1; st.save(); snd.coin(); s.close(); toast('Freeze saved for a busy day'); } else { s.close(); M.shop(); } };
  s.el.querySelector('.go').onclick = () => { s.close(); if (st.dailyDone !== dayKey()) startPage(dailyPick(), { isDaily: true }); };
}
function library() {
  const ts = totalStars();
  const s = sheet(`<h2>Pages</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center"><img src="${A}ui/star-full.webp" alt="" style="width:30px;vertical-align:middle"> <b>${ts}</b> star${ts === 1 ? '' : 's'} · 3 for a page without the bucket and with few hints</p>
    <div class="lib">${CHAP.map((ch, k) => { const open = chapOpen(k); return `<h3>${ch.name}<small>${open ? ch.ids.filter(id => st.done[id]).length + ' of 4 done' : ch.need + ' stars to open'}</small></h3>
      ${open ? '' : `<div class="unl"><span>Collect ${ch.need - ts} more star${ch.need - ts === 1 ? '' : 's'}, or</span><button class="sb-btn ivory un" data-k="${k}"><img src="${A}ui/coin.webp" alt="">300</button></div>`}
      <div class="ggrid">${ch.ids.map(id => `<div class="gi ${open ? '' : 'lock'}" data-id="${id}"><span class="im"></span>${open ? '' : `<img class="lk" src="${A}ui/i-lock.webp" alt="">`}
        <div class="stars">${[1, 2, 3].map(i => `<img src="${A}ui/${i <= starsOf(id) ? 'star-full' : 'star-empty'}.webp" alt="">`).join('')}</div><div class="nm">${TITLES[id]}</div></div>`).join('')}</div>`; }).join('')}</div>`);
  s.el.querySelectorAll('.gi').forEach(el => { thumbInto(el.querySelector('.im'), el.dataset.id); el.onclick = () => { const id2 = el.dataset.id; if (!chapOpen(chapOf(id2))) { snd.no(); toast('This chapter is still closed'); return; } snd.tap(); s.close(); startPage(id2, { again: !!st.done[id2] && !st.saves[id2] }); }; });
  s.el.querySelectorAll('.un').forEach(el => el.onclick = e => { e.stopPropagation(); const k = +el.dataset.k; if (M.spend(300, 'unlock')) { st.unlocked[k] = 1; st.save(); snd.coin(); s.close(); toast(`${CHAP[k].name} is open`); library(); } else { s.close(); M.shop(); } });
}
function gallery() {
  const done = ORDER.filter(id => st.done[id]);
  const s = sheet(`<h2>My Gallery</h2><img class="sb-div" src="${A}ui/divider.webp" alt="">
    <p style="text-align:center">${done.length ? `${done.length} of 12 paintings framed` : 'Finish a page and it is framed here.'}</p>
    <div class="ggrid galw">${ORDER.map(id => st.done[id] ? `<div class="gi" data-id="${id}"><div class="frm"><span class="im"></span></div><div class="nm" style="margin-top:6px">${TITLES[id]}</div></div>`
      : `<div class="gi" style="opacity:.5"><div style="aspect-ratio:1;border:3px dashed rgba(176,136,52,.6);border-radius:8px;display:grid;place-items:center;font-size:.9rem;color:var(--soft)">empty frame</div></div>`).join('')}</div>`);
  s.el.querySelectorAll('.gi[data-id]').forEach(el => { thumbInto(el.querySelector('.im'), el.dataset.id, { full: true }); el.onclick = () => { snd.tap(); s.close(); viewPainting(el.dataset.id); }; });
}
async function viewPainting(pid) {
  const s = sheet(`<h2>${TITLES[pid]}</h2><img class="sb-div" src="${A}ui/divider.webp" alt=""><div class="big-view frm"><span class="im"></span></div>
    <div class="col"><button class="sb-btn sv"><img src="${A}ui/i-share.webp" alt="">Save picture</button><button class="sb-btn ivory ag"><img src="${A}ui/i-pencil.webp" alt="">Colour it again</button></div>`);
  const c = await thumb(pid, [], 1024, true); s.el.querySelector('.im').replaceWith(c);
  s.el.querySelector('.sv').onclick = () => { const a = document.createElement('a'); a.download = `botanical-brush-${pid}.png`; a.href = c.toDataURL('image/png'); a.click(); st.stats.saved = true; st.save(); toast('Saved to your downloads'); };
  s.el.querySelector('.ag').onclick = () => { s.close(); delete st.saves[pid]; startPage(pid, { again: true }); };
}
function settings() {
  snd.tap();
  const s = sheet(`<h2>Settings</h2><img class="sb-div" src="${A}ui/divider.webp" alt=""><div class="tg"></div>
    <h3 class="disp" style="font-size:1.5rem;margin:1rem 0 .2rem">How to play</h3>
    <ul class="howto"><li>Pick a colour at the bottom. Its areas are shaded on the page.</li><li>Tap an area with that number to paint it.</li>
    <li>Pinch, scroll or double-tap to zoom in, and drag to move around. Numbers grow as you zoom.</li>
    <li><b>Find</b> shows you an area still to paint. <b>Fill colour</b> paints every area of one colour at once.</li><li>There is no clock and nothing to lose. Your page is saved as you go.</li></ul>
    <div class="col" style="margin-top:.6rem"><button class="sb-btn ivory shop"><img src="${A}ui/i-shop.webp" alt="">Shop</button></div>`);
  const tg = s.el.querySelector('.tg');
  tg.append(toggleRow('Larger text', 'Bigger words and numbers', st.set.big, v => { st.set.big = v; st.save(); applySet(); }));
  tg.append(toggleRow('Music', 'Soft harp in the background', st.set.music, v => { st.set.music = v; st.save(); applySet(); }));
  tg.append(toggleRow('Sounds', 'Brush strokes and chimes', st.set.sfx, v => { st.set.sfx = v; st.save(); applySet(); }));
  s.el.querySelector('.shop').onclick = () => { s.close(); M.shop(); };
}

goHome();

// ---------------------------------------------------------------- test hooks
let botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return st.journey; }, get view() { return { ...view, L, zoomAnim: !!zoomAnim }; },
  get score() { return st.stats.solved * 1000 + (cur ? cur.filled.size : 0); },
  bot() {   // a steady human: one area of the chosen colour about every other beat, then the next colour
    if (state !== 'play' || !cur || sheetOpen() || anims.length > 1 || (botTick++ % 2)) return;
    if (cur.sel < 0 || !leftOf(cur.sel)) { selectColour(firstOpen(0)); return; }
    const r = cur.P.R.find(q => q && q.c === cur.sel && !cur.filled.has(q.id)); if (r) fill(r, r.x, r.y);
  },
};
