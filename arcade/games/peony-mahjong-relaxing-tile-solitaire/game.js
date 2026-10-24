// Peony Mahjong: calm, untimed mahjong solitaire in a painted Storybook Garden (style C, BATCH12).
// Board: 2D canvas with painted tile faces on ivory-and-jade bodies. UI: DOM. Rules: engine.js. Layouts: layouts.js.
import { money } from './kit/money.js';
import { board } from './kit/board.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { LAYOUTS, parse, transpose, bounds, layoutFor, dailyLayout, COUNTS } from './layouts.js';
import * as E from './engine.js';
import { sfx, unlock, setSound, setMusic } from './audio.js';

const SLUG = 'peony-mahjong', NAME = 'Peony Mahjong';
const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const ls = {
  get(k, d) { try { const v = localStorage.getItem('pm_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pm_' + k, JSON.stringify(v)); } catch (e) {} },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = { out: t => 1 - Math.pow(1 - t, 3), back: t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 };
const fmt = n => n.toLocaleString('en-US');
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const dayShift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayNum(d); };
const weekId = (d = new Date()) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return dayNum(t); };

// ---------------------------------------------------------------- kit wiring
const M = money({ game: SLUG, style: 'C' });
const B = board({ game: 'peony-mahjong', label: 'Puzzles solved', limits: { maxRun: 3, maxPerSec: 0.5 }, mode: 'sum', corner: 'tl' });
const F = flow(SLUG);
const D = daily(SLUG, null, { name: NAME });

// ---------------------------------------------------------------- saved state
const prog = Object.assign({ level: 1, stars: {}, spent: 0, garden: 0, hints: 3, shuffles: 2, solved: 0, tipBlocked: false, gild: 0 }, ls.get('prog', {}));
const opts = Object.assign({ big: false, sound: true, music: true, dim: true, set: 'garden' }, ls.get('opts', {}));
const dly = Object.assign({ last: 0, streak: 0, freezeWeek: 0, wins: 0, done: {} }, ls.get('daily', {}));
const saveProg = () => ls.set('prog', prog), saveOpts = () => ls.set('opts', opts), saveDaily = () => ls.set('daily', dly);
const totalStars = () => Object.values(prog.stars).reduce((a, b) => a + b, 0) + (dly.wins || 0);
const starsFree = () => totalStars() - prog.spent;
document.documentElement.classList.toggle('big', opts.big);
setSound(opts.sound); setMusic(false);

// ---------------------------------------------------------------- art
const STAMPS = ['peony', 'robin', 'teacup', 'rose', 'butterfly', 'bluetit', 'cottage', 'hydrangea', 'hedgehog', 'bluebells', 'teapot', 'swan', 'fox', 'lavender', 'beehive', 'owl', 'strawberry', 'sunflower', 'kingfisher', 'cat', 'tulip', 'squirrel', 'lighthouse', 'sailboat'];
const GARDEN = [
  { n: 'Rose arch', src: 'decor/rose-arch', x: 50, y: 36, w: 15 }, { n: 'Fountain', src: 'decor/fountain', x: 50, y: 60, w: 24 },
  { n: 'Garden bench', src: 'decor/bench', x: 27, y: 46, w: 18 }, { n: 'Birdbath', src: 'decor/birdbath', x: 73, y: 53, w: 12 },
  { n: 'Peonies', src: 'plants/peony-bloom', x: 21, y: 72, w: 13 }, { n: 'Sundial', src: 'decor/sundial', x: 34, y: 66, w: 12 },
  { n: 'Lavender', src: 'plants/lavender-bloom', x: 63, y: 43, w: 9 }, { n: 'Stone urn', src: 'decor/urn', x: 85, y: 48, w: 12 },
  { n: 'Lantern', src: 'decor/lantern', x: 65, y: 72, w: 7 }, { n: 'Birdhouse', src: 'decor/birdhouse', x: 13, y: 49, w: 10 },
  { n: 'Hydrangeas', src: 'plants/hydrangea-bloom', x: 81, y: 64, w: 13 }, { n: 'Clematis trellis', src: 'decor/trellis', x: 39, y: 39, w: 10 },
  { n: 'Wheelbarrow', src: 'decor/wheelbarrow', x: 43, y: 78, w: 15 }, { n: 'Beehive', src: 'decor/beehive', x: 89, y: 37, w: 9 },
  { n: 'Foxgloves', src: 'plants/foxglove-bloom', x: 9, y: 63, w: 9 }, { n: 'Tulips', src: 'plants/tulip-bloom', x: 57, y: 81, w: 8 },
  { n: 'Watering can', src: 'decor/watering-can', x: 74, y: 79, w: 10 }, { n: 'Climbing roses', src: 'plants/rose-bloom', x: 62, y: 36, w: 8 },
];
const gardenCost = i => 3 + Math.floor(i / 2);

let SET = null; const IMG = {};
const ALT = ['alt-blue-jay', 'alt-chickadee', 'alt-goldfinch', 'alt-wren', 'alt-bluebird', 'alt-plum-blossom', 'alt-orchid', 'alt-chrysanthemum', 'alt-lotus', 'alt-camellia-dot'];
async function loadArt() {
  SET = await (await fetch('assets/mahjong/set.json')).json();
  const names = [...Object.keys(SET.faces), ...ALT];
  await Promise.all(names.map(n => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = `assets/mahjong/${n}.webp`; IMG[n] = im; })));
  const hi = new Image(); hi.onload = () => $('#bg').classList.add('hi'); hi.src = innerWidth / innerHeight < 1 ? 'assets/bg/peony-mahjong.webp' : 'assets/bg/peony-mahjong-wide.webp';
}
// kinds, easiest to tell apart first. 'flower' and 'season' are the any-matches-any groups.
function kindPool() {
  const k = [];
  if (opts.set === 'classic') for (let i = 1; i <= 9; i++) k.push('characters-' + i); else k.push(...ALT);
  k.splice(opts.set === 'classic' ? 9 : 3, 0, 'flower', 'season');
  k.push('dragon-red', 'dragon-green', 'dragon-white');
  for (let i = 1; i <= 9; i++) k.push('circles-' + i);
  for (let i = 1; i <= 9; i++) k.push('bamboo-' + i);
  k.push('wind-e', 'wind-s', 'wind-w', 'wind-n');
  return k;
}
// choose the pair units for P pairs. dup = share of kinds that come as two pairs (4 tiles): more choice, more traps.
function pickUnits(P, dup, r) {
  const pool = kindPool();
  let K = Math.round(P - dup * P / 2); K = clamp(K, Math.ceil(P / 2), Math.min(P, pool.length));
  const window = Math.min(pool.length, K + 4 + Math.floor(P / 10));
  const kinds = E.shuffleA(pool.slice(0, window), r).slice(0, K);
  const doubles = P - K, units = [];
  kinds.forEach((kd, i) => {
    const n = i < doubles ? 2 : 1;
    for (let u = 0; u < n; u++) {
      if (kd === 'flower' || kd === 'season') { const f = E.shuffleA([1, 2, 3, 4].map(x => kd + '-' + x), r); units.push(u === 0 ? [f[0], f[1]] : [f[2], f[3]]); }
      else units.push([kd, kd]);
    }
  });
  return units;
}

// ---------------------------------------------------------------- canvas + geometry
const cv = $('#board'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const view = { z: 1, tx: 0, ty: 0 };
let G = null;                 // the level: tiles, links, faces, alive, free, order, geometry
let state = 'ready', sel = -1, hintP = null, hintT = 0, dirty = true, busyUntil = 0;
const an = [];                // per-tile animation: { intro, shake, flip, pop }
let fx = [], parts = [];

function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  if (G) { layoutGeo(); }
  dirty = true;
}
function area() {
  const top = $('#info').getBoundingClientRect().bottom + 10, c = $('#coach');
  const bot = Math.min($('#bar').getBoundingClientRect().top, c.hidden ? 1e9 : c.getBoundingClientRect().top) - 12;
  const side = W > 700 ? 40 : 8;
  return { x: side, y: top, w: W - side * 2, h: Math.max(100, bot - top) };
}
const R = 4 / 3;
function fitS(b, a) {
  const cols = b.w / 2, rows = b.h / 2, top = b.top;
  return Math.min(a.w / (cols + 0.1 + top * 0.08), a.h / (rows * R + 0.1 + top * 0.1), W > 700 ? 100 : 92);
}
function layoutGeo() {
  const a = area(), b = G.b, S = Math.floor(fitS(b, a) * 10) / 10;
  const g = { S, fw: S * 0.955, fh: S * R * 0.962, d: S * 0.1, lx: S * 0.08, ly: S * 0.1, pad: S * 0.18, r: S * 0.1 };
  const bw = (b.w / 2) * S + g.d + b.top * g.lx, bh = (b.h / 2) * S * R + g.d + b.top * g.ly;
  g.ox = a.x + (a.w - bw) / 2; g.oy = a.y + (a.h - bh) / 2; g.bw = bw; g.bh = bh; g.area = a;
  G.g = g; sprites.clear();
  $('#zoom').hidden = !(S < 50 && W < 700);
  if (S >= 50 || W >= 700) { view.z = 1; view.tx = view.ty = 0; }
  clampView();
}
function tilePos(i) {
  const t = G.tiles[i], g = G.g, b = G.b;
  return { x: g.ox + (t.x - b.x0) / 2 * g.S + (b.top - t.l) * g.lx, y: g.oy + (t.y - b.y0) / 2 * g.S * R + (b.top - t.l) * g.ly };
}
const toScreen = (x, y) => ({ x: x * view.z + view.tx, y: y * view.z + view.ty });
const toBoard = (x, y) => ({ x: (x - view.tx) / view.z, y: (y - view.ty) / view.z });
function clampView() {
  if (!G || !G.g) return;
  if (view.z <= 1.001) { view.z = 1; view.tx = view.ty = 0; return; }
  const a = G.g.area, g = G.g;
  // keep the board's edges within the play area
  const minX = a.x + a.w - (g.ox + g.bw) * view.z, maxX = a.x - g.ox * view.z;
  const minY = a.y + a.h - (g.oy + g.bh) * view.z, maxY = a.y - g.oy * view.z;
  view.tx = minX > maxX ? (minX + maxX) / 2 : clamp(view.tx, minX, maxX);
  view.ty = minY > maxY ? (minY + maxY) / 2 : clamp(view.ty, minY, maxY);
}

// ---------------------------------------------------------------- tile sprites (ivory face on a jade back, soft shadow)
const sprites = new Map();
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function sprite(face, dim) {
  const key = face + (dim ? '~' : '');
  let s = sprites.get(key); if (s) return s;
  const { fw, fh, d, pad, r } = G.g, k = DPR * view.z;
  const c = document.createElement('canvas'); c.width = Math.ceil((fw + d + pad * 2) * k); c.height = Math.ceil((fh + d + pad * 2) * k);
  const g = c.getContext('2d'); g.scale(k, k); g.translate(pad, pad);
  // shadow cast onto whatever is below
  g.save(); g.shadowColor = 'rgba(40,52,34,.42)'; g.shadowBlur = fw * 0.16 * k; g.shadowOffsetX = fw * 0.05 * k; g.shadowOffsetY = fw * 0.09 * k;
  rr(g, d, d, fw, fh, r); g.fillStyle = '#244b41'; g.fill(); g.restore();
  // jade back
  let gr = g.createLinearGradient(0, 0, fw + d, fh + d); gr.addColorStop(0, '#4b8471'); gr.addColorStop(1, '#1d4036');
  rr(g, d, d, fw, fh, r); g.fillStyle = gr; g.fill();
  // ivory body layer
  gr = g.createLinearGradient(0, 0, fw + d * .6, fh + d * .6); gr.addColorStop(0, '#f1e8d2'); gr.addColorStop(1, '#cdbd98');
  rr(g, d * .58, d * .58, fw, fh, r); g.fillStyle = gr; g.fill();
  rr(g, d * .58, d * .58, fw, fh, r); g.strokeStyle = 'rgba(120,100,60,.35)'; g.lineWidth = 1 / k * 1.2; g.stroke();
  // painted face
  g.save(); rr(g, 0, 0, fw, fh, r); g.clip();
  g.fillStyle = '#f6efdd'; g.fillRect(0, 0, fw, fh);
  const im = IMG[face]; if (im && im.complete && im.naturalWidth) g.drawImage(im, 0, 0, fw, fh);
  const hl = g.createLinearGradient(0, 0, fw * .7, fh * .7); hl.addColorStop(0, 'rgba(255,255,255,.38)'); hl.addColorStop(.45, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(0, 0, fw, fh);
  const sh = g.createLinearGradient(0, fh * .7, 0, fh); sh.addColorStop(0, 'rgba(120,96,50,0)'); sh.addColorStop(1, 'rgba(120,96,50,.12)'); g.fillStyle = sh; g.fillRect(0, 0, fw, fh);
  if (dim) { g.fillStyle = 'rgba(78,66,46,.13)'; g.fillRect(0, 0, fw, fh); }
  g.restore();
  rr(g, .5 / k, .5 / k, fw - 1 / k, fh - 1 / k, r); g.strokeStyle = dim ? 'rgba(140,110,60,.45)' : 'rgba(176,136,52,.75)'; g.lineWidth = Math.max(1 / k, fw * .014); g.stroke();
  sprites.set(key, c); return c;
}

// ---------------------------------------------------------------- the level
function curKey() { return G ? (G.daily ? 'd' + G.seed : 'l' + G.level) : ''; }
function startLevel(level, { isDaily = false } = {}) {
  const seed = isDaily ? D.seed || dayNum() : level * 7919 + 13;
  const info = isDaily ? { idx: dailyLayout(seed), hard: false, lap: 0 } : layoutFor(level);
  const lay = LAYOUTS[info.idx];
  let tiles = parse(lay);
  // portrait phones get the layout turned on its side when that makes the tiles bigger
  const a = area(), b0 = bounds(tiles), tt = transpose(tiles), b1 = bounds(tt);
  const turned = fitS(b1, a) > fitS(b0, a) * 1.06;
  if (turned) tiles = tt;
  // normalise so x0/y0 = 0
  const b = bounds(tiles); tiles = tiles.map(t => ({ x: t.x - b.x0, y: t.y - b.y0, l: t.l }));
  const L = E.links(tiles), r = E.rng(seed + info.lap * 104729 + (turned ? 17 : 0) + (opts.set === 'classic' ? 3 : 0));
  // difficulty: share of kinds dealt as two pairs. Tutorial levels: none (no traps). flow.js nudges it (never on the world board).
  const fk = isDaily ? 1 : F.k();
  const dup = level <= 5 && !isDaily ? 0 : clamp((Math.min(0.8, 0.25 + level * 0.012) + (info.hard ? 0.2 : 0)) * fk, 0, 1);
  const units = pickUnits(tiles.length / 2, dup, r);
  const dl = E.deal(tiles, L, units, r);
  G = { level, daily: isDaily, seed, hard: info.hard, lay, name: lay.name, tiles, L, b: bounds(tiles), faces: dl.faces, alive: tiles.map(() => true), free: [],
    order: tiles.map((t, i) => i).sort((p, q) => tiles[p].l - tiles[q].l || tiles[p].y - tiles[q].y || tiles[p].x - tiles[q].x),
    hist: [], assists: 0, hintsUsed: 0, shufUsed: 0, ms: 0, t0: performance.now(), log: [], combo: 0, lastMatch: 0 };
  // resume a level left half-way
  const cur = ls.get('cur', null);
  if (cur && cur.key === curKey() && cur.n === tiles.length && cur.set === opts.set) {
    G.faces = cur.faces; G.alive = cur.alive; G.hist = cur.hist || []; G.assists = cur.assists || 0; G.hintsUsed = cur.hintsUsed || 0; G.shufUsed = cur.shufUsed || 0; G.ms = cur.ms || 0; G.log = cur.log || [];
  }
  sel = -1; hintP = null; fx = []; view.z = 1; view.tx = view.ty = 0;
  an.length = 0; tiles.forEach(() => an.push({}));
  coach(level === 1 && !isDaily ? 'Tap two matching tiles to clear them. A tile is free when nothing sits on it and its left or right side is open.' : '');
  layoutGeo(); refreshFree();
  // tiles drop in, lowest layer first
  const now = performance.now();
  G.order.forEach((i, k) => { if (G.alive[i]) an[i].intro = now + 120 + k * Math.min(14, 900 / tiles.length) + G.tiles[i].l * 60; });
  busyUntil = now + 500;
  state = 'play'; document.body.classList.add('playing');
  M.level(level); B.start();
  $('#lname').textContent = G.daily ? 'Daily Puzzle' : G.name;
  hud();
  if (G.hard) { const rb = $('#ribbon'); rb.classList.add('on'); setTimeout(() => rb.classList.remove('on'), 1700); }
  if (level === 1 && !G.daily && G.hist.length === 0) setTimeout(() => { if (G && state === 'play' && !hintP) { const mv = bestMove(); if (mv) { hintP = mv; hintT = performance.now(); dirty = true; } } }, 1300);
  dirty = true;
}
function refreshFree() { G.free = G.alive.map((a, i) => a && E.isFree(i, G.alive, G.L)); dirty = true; }
const pairsLeft = () => G.alive.filter(Boolean).length / 2;
const openPairs = () => E.pairsAvailable(G.alive, G.faces, G.L).length;
function saveCur() {
  if (!G || state !== 'play') return;
  ls.set('cur', { key: curKey(), n: G.tiles.length, set: opts.set, faces: G.faces, alive: G.alive, hist: G.hist.slice(-200), assists: G.assists, hintsUsed: G.hintsUsed, shufUsed: G.shufUsed, ms: G.ms + (performance.now() - G.t0), log: G.log });
}
function hud() {
  if (!G) return;
  const op = openPairs(), pl = pairsLeft();
  $('#info').innerHTML = `${G.hard ? '<span class="hard">Hard</span> · ' : ''}${G.daily ? 'Today' : 'Level ' + G.level} · ${pl} pair${pl === 1 ? '' : 's'} · ${op} match${op === 1 ? '' : 'es'}`;
  const hn = $('#hintN'), sn = $('#shufN');
  if (prog.hints > 0) { hn.className = ''; hn.textContent = prog.hints; } else if (M.coins() >= 50) { hn.className = 'c'; hn.textContent = '50'; } else { hn.className = 'v'; hn.textContent = '▶'; }
  if (prog.shuffles > 0) { sn.className = ''; sn.textContent = prog.shuffles; } else if (M.coins() >= 40) { sn.className = 'c'; sn.textContent = '40'; } else { sn.className = 'v'; sn.textContent = '▶'; }
  $('#undoBtn').disabled = !G.hist.length;
}
function coach(text) { const c = $('#coach'); c.textContent = text; c.hidden = !text; }
let toastT = 0;
function toast(text, ms = 2400) { const t = $('#toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

// ---------------------------------------------------------------- play
function tapTile(i) {
  if (state !== 'play' || !G.alive[i]) return;
  unlock();
  if (!G.free[i]) {
    an[i].shake = performance.now(); sfx.blocked(); dirty = true;
    if (!prog.tipBlocked) { prog.tipBlocked = true; saveProg(); toast('That tile is held in place. Choose a brighter tile with an open left or right side.', 4200); }
    return;
  }
  if (sel === -1) { sel = i; sfx.select(G.combo); dirty = true; return; }
  if (sel === i) { sel = -1; dirty = true; sfx.tap(); return; }
  if (E.matches(G.faces[sel], G.faces[i])) { doMatch(sel, i); return; }
  sel = i; sfx.select(G.combo); dirty = true;
}
function doMatch(a, b) {
  const now = performance.now();
  G.combo = now - G.lastMatch < 3200 ? G.combo + 1 : 0; G.lastMatch = now;
  G.alive[a] = G.alive[b] = false; G.hist.push({ t: 'm', a, b }); G.log.push(0);
  const pa = tilePos(a), pb = tilePos(b);
  fx.push({ a, b, fa: G.faces[a], fb: G.faces[b], pa, pb, t0: now });
  sel = -1; hintP = null; coach('');
  sfx.match(G.combo); refreshFree(); hud(); saveCur();
  if (G.combo > 0 && G.combo % 4 === 3) floatWord(['Lovely', 'Graceful', 'In full bloom', 'Splendid'][(G.combo >> 2) % 4], (pa.x + pb.x) / 2 + G.g.fw / 2, Math.min(pa.y, pb.y));
  if (!G.alive.some(Boolean)) return win();
  if (!openPairs()) setTimeout(() => { if (G && state === 'play' && !openPairs()) { toast('No pairs are open. Here is a free shuffle.'); setTimeout(() => shuffle(true), 700); } }, 650);
}
function bestMove() { return E.solveFrom(G.tiles, G.alive, G.faces, G.L, { ms: 35 }) || E.pairsAvailable(G.alive, G.faces, G.L)[0] || null; }
async function hint() {
  if (state !== 'play' || performance.now() < busyUntil) return;
  unlock();
  if (!openPairs()) { shuffle(true); return; }
  if (hintP) return;
  if (prog.hints > 0) prog.hints--;
  else if (M.coins() >= 50) { if (!M.spend(50, 'hint')) return; toast('Hint · 50 coins'); }
  else if (!(await M.rewarded('hint', { what: '1 hint' }))) return;
  const mv = bestMove(); if (!mv) return;
  hintP = mv; hintT = performance.now(); G.assists++; G.hintsUsed++; G.log.push(1); sfx.hint(); saveProg(); hud(); saveCur(); dirty = true;
}
async function shuffle(free = false) {
  if (state !== 'play' || (!free && performance.now() < busyUntil)) return;
  unlock();
  if (!free) {
    if (prog.shuffles > 0) prog.shuffles--;
    else if (M.coins() >= 40) { if (!M.spend(40, 'shuffle')) return; toast('Shuffle · 40 coins'); }
    else if (!(await M.rewarded('hint', { what: '1 shuffle', title: 'Free shuffle' }))) return;
    G.assists++; G.shufUsed++; G.log.push(2); saveProg();
  }
  const rd = E.redeal(G.tiles, G.alive, G.faces, G.L, Math.random);
  if (!rd) return;
  G.hist.push({ t: 's', before: G.faces.slice() });
  const now = performance.now();
  G.order.forEach((i, k) => { if (G.alive[i]) { an[i].flip = now + k * 6; an[i].old = G.faces[i]; } });
  G.faces = rd.faces; sel = -1; hintP = null; busyUntil = now + 700;
  sfx.shuffle(); refreshFree(); hud(); saveCur();
}
function undo() {
  if (state !== 'play' || !G.hist.length || performance.now() < busyUntil) return;
  unlock();
  const h = G.hist.pop(), now = performance.now();
  if (h.t === 'm') { G.alive[h.a] = G.alive[h.b] = true; an[h.a].pop = an[h.b].pop = now; fx = fx.filter(f => f.a !== h.a); }
  else { G.order.forEach(i => { if (G.alive[i]) { an[i].flip = now; an[i].old = G.faces[i]; } }); G.faces = h.before; }
  sel = -1; hintP = null; sfx.undo(); refreshFree(); hud(); saveCur();
}

// ---------------------------------------------------------------- win
function starsFor() { return G.assists === 0 ? 3 : G.assists <= 2 ? 2 : 1; }
function win() {
  state = 'won'; document.body.classList.remove('playing');
  const ms = G.ms + (performance.now() - G.t0), st = starsFor();
  ls.set('cur', null);
  let coins = 10 + st * 5; if (G.hard) coins *= 2;
  let newStamp = null, gild = false, streakNote = '';
  if (G.daily) {
    coins += 25;
    const today = dayNum();
    if (!dly.done[today]) {
      if (dly.last === dayShift(-1)) dly.streak++;
      else if (dly.last === dayShift(-2) && dly.freezeWeek !== weekId()) { dly.streak++; dly.freezeWeek = weekId(); streakNote = 'Your weekly streak freeze kept the streak going.'; }
      else if (dly.last !== today) dly.streak = 1;
      dly.last = today; dly.done[today] = st; dly.wins++; saveDaily();
      if (prog.gild < STAMPS.length) { newStamp = STAMPS[prog.gild]; prog.gild++; gild = true; }
    }
  } else {
    const prev = prog.stars[G.level] || 0;
    if (st > prev) prog.stars[G.level] = st;
    if (G.level >= prog.level) {
      prog.level = G.level + 1;
      if (G.level <= STAMPS.length) newStamp = STAMPS[G.level - 1];
      else if ((G.level - STAMPS.length) % 3 === 0 && prog.gild < STAMPS.length) { newStamp = STAMPS[prog.gild]; prog.gild++; gild = true; }
      prog.hints++; if (G.level % 3 === 0) prog.shuffles++;
    }
  }
  prog.solved++; saveProg();
  F.level(true);
  const pts = G.hard ? 2 : 1;
  B.submit(pts, { ms });
  if (G.daily) D.won(pts, 'solved');
  sfx.win(); shower();
  setTimeout(() => winCard({ st, coins, newStamp, gild, streakNote }), 1050);
}
function shareText() {
  const n = G.tiles.length, row = [];
  const per = Math.max(1, Math.ceil(G.log.length / 10));
  for (let i = 0; i < G.log.length; i += per) { const seg = G.log.slice(i, i + per); row.push(seg.includes(2) ? '🔀' : seg.includes(1) ? '💡' : '🌸'); }
  const d = new Date();
  return `${NAME} · Daily ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}\n${row.join('')}\n${'⭐'.repeat(starsFor())} ${n} tiles · ${G.hintsUsed} hints${dly.streak > 1 ? ` · 🔥 ${dly.streak} days` : ''}\n${location.origin + location.pathname}?daily=1`;
}
function winCard({ st, coins, newStamp, gild, streakNote }) {
  if (state !== 'won') return;
  M.add(coins, G.daily ? 'daily' : 'win'); sfx.coin();
  const nextGarden = prog.garden < GARDEN.length && starsFree() >= gardenCost(prog.garden);
  const words = st === 3 ? 'Beautifully done' : st === 2 ? 'Well played' : 'Puzzle solved';
  openSheet(`
    <h2>${words}</h2>
    <p class="sub">${G.daily ? "Today's puzzle" : 'Level ' + G.level} · ${G.name}</p>
    <div class="stars">${[0, 1, 2].map(i => `<img src="assets/kit/${i < st ? 'star-full' : 'star-empty'}.webp" alt="">`).join('')}</div>
    <p>${st === 3 ? 'Three stars: solved without hints or shuffles.' : 'Solve without hints or shuffles for three stars.'}</p>
    <div class="reward"><img src="assets/kit/coin.webp" alt=""><span id="wcoins">+${coins} coins</span><button class="pillbtn" id="dbl"><img src="assets/icons/video.webp" alt="">Double</button></div>
    ${newStamp ? `<div class="stampnew"><img src="assets/stamps/stamp-${newStamp}.webp" alt="" style="${gild ? 'filter:sepia(.55) saturate(1.5) hue-rotate(-12deg) drop-shadow(0 0 5px rgba(217,184,101,.9))' : ''}"><p><b>New ${gild ? 'gilded ' : ''}stamp</b><br>${cap(newStamp)} is in your album.</p></div>` : ''}
    ${G.daily ? `<p><b>🔥 ${dly.streak}-day streak.</b> ${streakNote || 'A new puzzle arrives tomorrow.'}</p><button class="btn alt" id="share"><img src="assets/icons/share.webp" alt="">Share my result</button>` : ''}
    ${nextGarden ? `<p class="sub">You have enough stars to restore the ${GARDEN[prog.garden].n.toLowerCase()}.</p>` : ''}
    <button class="btn" id="cont">${nextGarden ? 'To the garden' : G.daily ? 'Back to the garden gate' : 'Next puzzle'}</button>`, { onBackdrop: cont, tapAnywhere: true });
  const stars = [...document.querySelectorAll('#panel .stars img')];
  stars.forEach((s, i) => setTimeout(() => { s.classList.add('on'); if (i < st) sfx.select(i * 2); }, 250 + i * 260));
  if (newStamp) setTimeout(() => sfx.stamp(), 600);
  const dbl = $('#dbl');
  dbl.onclick = async e => { e.stopPropagation(); dbl.disabled = true; if (await M.rewarded('double', { what: `${coins} more coins (${coins * 2} in all)` })) { M.add(coins, 'double'); $('#wcoins').textContent = `+${coins * 2} coins`; sfx.coin(); dbl.remove(); } else dbl.disabled = false; };
  const sh = $('#share'); if (sh) sh.onclick = async e => { e.stopPropagation(); const t = shareText(); try { if (navigator.share) { await navigator.share({ title: NAME, text: t }); return; } } catch (er) { return; } try { await navigator.clipboard.writeText(t); toast('Copied. Paste it to a friend.'); } catch (er) {} };
  $('#cont').onclick = e => { e.stopPropagation(); cont(); };
}
let continuing = false;
async function cont() {
  if (state !== 'won' || continuing) return;
  continuing = true; closeSheet();
  const wasDaily = G.daily;
  state = 'next';
  try { await M.breakAd('level-end', { level: G.level }); } catch (e) {}
  continuing = false;
  if (prog.garden < GARDEN.length && starsFree() >= gardenCost(prog.garden)) { if (wasDaily && Q.get('daily') === '1') history.replaceState(null, '', location.pathname); G = null; state = 'ready'; showGarden(); return; }
  if (wasDaily) { if (Q.get('daily') === '1') history.replaceState(null, '', location.pathname); showHome(); return; }
  startLevel(prog.level);
}
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- drawing
function drawTile(i, now) {
  const p = tilePos(i), g = G.g, A = an[i];
  let dx = 0, dy = 0, sx = 1, sy = 1, al = 1, face = G.faces[i];
  if (A.intro) { const t = (now - A.intro) / 460; if (t < 0) return true; if (t < 1) { dy = -g.S * 1.1 * (1 - ease.back(t)); al = clamp(t * 2.2, 0, 1); } else A.intro = 0; }
  if (A.shake) { const t = (now - A.shake) / 340; if (t < 1) dx = Math.sin(t * 26) * g.S * 0.06 * (1 - t); else A.shake = 0; }
  if (A.flip) { const t = (now - A.flip) / 520; if (t < 0) face = A.old; else if (t < 1) { sx = Math.abs(Math.cos(t * Math.PI)); if (t < .5) face = A.old; dy -= Math.sin(t * Math.PI) * g.S * .15; } else A.flip = 0; }
  if (A.pop) { const t = (now - A.pop) / 360; if (t < 1) { const e = ease.back(t); sx = sy = 0.6 + 0.4 * e; al = clamp(t * 2, 0, 1); } else A.pop = 0; }
  const isSel = sel === i, isHint = hintP && (hintP[0] === i || hintP[1] === i);
  if (isSel) dy -= g.S * 0.07;
  const sp = sprite(face, opts.dim && !G.free[i] && !isSel), k = DPR * view.z;
  const cx = p.x + dx + g.fw / 2, cy = p.y + dy + g.fh / 2;
  ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(sp, -g.fw / 2 - g.pad, -g.fh / 2 - g.pad, sp.width / k, sp.height / k);
  if (isSel || isHint) {
    const pulse = isHint ? 0.5 + 0.5 * Math.sin((now - hintT) / 180) : 1;
    ctx.shadowColor = isSel ? 'rgba(230,180,60,.95)' : 'rgba(110,170,90,.95)'; ctx.shadowBlur = g.S * 0.3;
    rr(ctx, -g.fw / 2, -g.fh / 2, g.fw, g.fh, g.r); ctx.lineWidth = g.S * (isSel ? 0.07 : 0.05 + 0.03 * pulse);
    ctx.strokeStyle = isSel ? '#D9A93A' : `rgba(86,140,80,${0.65 + 0.35 * pulse})`; ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = isSel ? 'rgba(255,236,170,.16)' : `rgba(200,240,190,${0.12 * pulse})`; ctx.fill();
  }
  ctx.restore();
  return A.intro || A.shake || A.flip || A.pop || isHint;
}
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  let busy = false;
  if (G && G.g && (state === 'play' || state === 'won' || state === 'next')) {
    ctx.setTransform(DPR * view.z, 0, 0, DPR * view.z, DPR * view.tx, DPR * view.ty);
    for (const i of G.order) if (G.alive[i]) busy = drawTile(i, now) || busy;
    // matched pairs: slide together, lift, and dissolve into petals
    const g = G.g;
    fx = fx.filter(f => {
      const t = (now - f.t0) / 640; if (t >= 1) return false; busy = true;
      const mx = (f.pa.x + f.pb.x) / 2, my = Math.min(f.pa.y, f.pb.y) - g.S * 0.25;
      const m = ease.inout(clamp(t / 0.5, 0, 1)), fade = clamp((t - 0.5) / 0.5, 0, 1);
      if (!f.burst && t > 0.5) { f.burst = true; const s = toScreen(mx + g.fw / 2, my + g.fh / 2); petals(s.x, s.y, 16); }
      [[f.pa, f.fa, -1], [f.pb, f.fb, 1]].forEach(([p, face, side]) => {
        const tx = mx + side * g.fw * 0.52, x = p.x + (tx - p.x) * m, y = p.y + (my - p.y) * m - fade * g.S * 0.3;
        const sp = sprite(face, false), k = DPR * view.z, sc = 1 + 0.06 * Math.sin(m * Math.PI) - fade * 0.35;
        ctx.save(); ctx.globalAlpha = 1 - fade; ctx.translate(x + g.fw / 2, y + g.fh / 2); ctx.scale(sc, sc);
        ctx.drawImage(sp, -g.fw / 2 - g.pad, -g.fh / 2 - g.pad, sp.width / k, sp.height / k); ctx.restore();
      });
      return true;
    });
  }
  // petals + sparkles (screen space)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (parts.length) busy = true;
  parts = parts.filter(p => {
    p.life -= 1 / 60; if (p.life <= 0 || p.y > H + 40) return false;
    p.vy += p.g; p.vx *= 0.985; p.x += p.vx + Math.sin(p.ph += 0.05) * p.sway; p.y += p.vy; p.rot += p.vr;
    ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.kind === 'spark') { ctx.fillStyle = p.c; ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? p.s * .3 : p.s; ctx.lineTo(Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r); } ctx.fill(); }
    else { const gr = ctx.createRadialGradient(-p.s * .3, -p.s * .2, 0, 0, 0, p.s); gr.addColorStop(0, '#fff7f4'); gr.addColorStop(1, p.c); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .58, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore(); return true;
  });
  return busy;
}
const PET = ['#F2B6C3', '#E895AA', '#F7D3D9', '#FFFFFF', '#F4C7CF'];
function petals(x, y, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3.2; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.07, life: 1 + Math.random() * .7, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, s: 5 + Math.random() * 6, c: PET[i % PET.length], ph: Math.random() * 6, sway: .3 }); }
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5; parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: .55 + Math.random() * .3, rot: 0, vr: .05, s: 5 + Math.random() * 4, c: '#E2BE5A', ph: 0, sway: 0 }); }
}
function shower() { for (let i = 0; i < 90; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * .5, vx: (Math.random() - .5) * 1.2, vy: 1 + Math.random() * 1.6, g: 0.012, life: 4, rot: Math.random() * 6, vr: (Math.random() - .5) * .1, s: 6 + Math.random() * 7, c: PET[i % PET.length], ph: Math.random() * 6, sway: .8 }); }
function floatWord(text, bx, by) {
  const s = toScreen(bx, by), d = document.createElement('div');
  d.textContent = text; d.style.cssText = `position:fixed;left:${s.x}px;top:${s.y}px;transform:translate(-50%,-50%);z-index:8;pointer-events:none;font:700 2rem/1 var(--display);color:var(--rose);text-shadow:0 2px 0 #fff,0 0 12px #fff;transition:transform 1.2s cubic-bezier(.2,.8,.3,1),opacity 1.2s`;
  document.body.appendChild(d); requestAnimationFrame(() => { d.style.transform = 'translate(-50%,-160%) scale(1.1)'; d.style.opacity = '0'; }); setTimeout(() => d.remove(), 1300);
}
function frame(now) {
  requestAnimationFrame(frame);
  if (state === 'play' && G) { /* keep the clock only while visible */ }
  if (!dirty && !animBusy) return;
  dirty = false; animBusy = draw(now);
}
let animBusy = false;

// ---------------------------------------------------------------- input: tap, drag to pan when zoomed, pinch
const ptrs = new Map(); let gesture = null;
function hit(x, y) {
  if (!G || !G.g) return -1;
  const b = toBoard(x, y), g = G.g;
  for (let k = G.order.length - 1; k >= 0; k--) {
    const i = G.order[k]; if (!G.alive[i]) continue;
    const p = tilePos(i), lift = sel === i ? g.S * .07 : 0;
    if (b.x >= p.x && b.x <= p.x + g.fw + g.d * .5 && b.y >= p.y - lift && b.y <= p.y + g.fh + g.d * .5 - lift) return i;
  }
  return -1;
}
cv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; gesture = { pinch: true, d0: Math.hypot(p.x - q.x, p.y - q.y), z0: view.z, tx0: view.tx, ty0: view.ty, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 }; }
  else gesture = { pinch: false, moved: false };
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  if (gesture.pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    const z = clamp(gesture.z0 * d / gesture.d0, 1, 2.6), bx = (gesture.mx - gesture.tx0) / gesture.z0, by = (gesture.my - gesture.ty0) / gesture.z0;
    view.z = z; view.tx = gesture.mx - bx * z; view.ty = gesture.my - by * z; clampView(); sprites.clear(); dirty = true;
  } else if (!gesture.pinch) {
    if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 10) gesture.moved = true;
    if (gesture.moved && view.z > 1) { view.tx += dx; view.ty += dy; clampView(); dirty = true; }
  }
});
const endPtr = e => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (!p || !gesture) return;
  if (!gesture.pinch && !gesture.moved && e.type === 'pointerup' && state === 'play' && performance.now() > busyUntil - 300) {
    const i = hit(e.clientX, e.clientY); if (i >= 0) tapTile(i); else if (sel >= 0) { sel = -1; dirty = true; }
  }
  if (!ptrs.size) gesture = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { if (!G || W >= 700) return; e.preventDefault(); }, { passive: false });
$('#zoom').onclick = () => {
  if (!G) return; sfx.tap();
  const a = G.g.area, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  if (view.z > 1.05) { view.z = 1; view.tx = view.ty = 0; }
  else { const z = clamp(50 / G.g.S * 1.25, 1.4, 2.4); const bx = (cx - view.tx) / view.z, by = (cy - view.ty) / view.z; view.z = z; view.tx = cx - bx * z; view.ty = cy - by * z; clampView(); }
  sprites.clear(); dirty = true;
  if (view.z > 1 && !ls.get('zoomtip', false)) { ls.set('zoomtip', true); toast('Drag to look around. Tap the magnifier again to see the whole board.', 3600); }
};

// ---------------------------------------------------------------- screens and sheets
function openSheet(html, { onBackdrop = null, tapAnywhere = false, wide = false } = {}) {
  const sh = $('#sheet'), pn = $('#panel');
  pn.className = 'panel' + (wide ? ' wide' : ''); pn.innerHTML = html; sh.hidden = false; document.body.classList.add('sheet-open');
  sh.onpointerdown = e => { if (e.target === sh && onBackdrop) { e.preventDefault(); onBackdrop(); } };
  pn.onclick = tapAnywhere ? (e => { if (!e.target.closest('button')) onBackdrop && onBackdrop(); }) : null;
}
function closeSheet() { $('#sheet').hidden = true; document.body.classList.remove('sheet-open'); }

function showHome() {
  state = 'ready'; G = null; dirty = true; document.body.classList.remove('playing', 'ingarden'); closeSheet(); coach('');
  $('#garden').hidden = true; $('#home').hidden = false;
  ['#top', '#info', '#bar', '#roseL', '#roseR'].forEach(s => $(s).style.visibility = 'hidden'); $('#zoom').hidden = true;
  $('#playLvl').textContent = 'Level ' + prog.level;
  const today = dayNum(), done = dly.done[today];
  $('#dailyTxt').textContent = done ? "Today's puzzle is solved ✓" : 'Daily puzzle';
  const hs = $('#hStreak'), alive = dly.last === today || dly.last === dayShift(-1);
  hs.hidden = !(alive && dly.streak > 0);
  hs.textContent = `🔥 ${dly.streak}-day streak${done ? '' : ' · keep it going today'}`;
  $('#gardenDot').hidden = !(prog.garden < GARDEN.length && starsFree() >= gardenCost(prog.garden));
}
function showPlay() { document.body.classList.remove('ingarden'); $('#home').hidden = true; $('#garden').hidden = true; ['#top', '#info', '#bar', '#roseL', '#roseR'].forEach(s => $(s).style.visibility = ''); }
function play(level, o) { unlock(); showPlay(); artReady.then(() => requestAnimationFrame(() => startLevel(level, o))); }

// garden (meta): spend stars (or coins) to bring the garden back, one piece at a time
function showGarden() {
  document.body.classList.add('ingarden'); document.body.classList.remove('playing');
  $('#home').hidden = true; $('#garden').hidden = false; closeSheet();
  ['#top', '#info', '#bar', '#roseL', '#roseR'].forEach(s => $(s).style.visibility = 'hidden');
  const box = $('#gbox');
  if (!box.children.length) GARDEN.forEach((g, i) => { const im = document.createElement('img'); im.src = `assets/${g.src}.webp`; im.alt = g.n; im.style.left = g.x + '%'; im.style.top = g.y + '%'; im.style.width = g.w + '%'; box.appendChild(im); });
  paintGarden();
}
function paintGarden(justAdded = -1) {
  const imgs = [...$('#gbox').children];
  imgs.forEach((im, i) => { im.className = i < prog.garden ? '' : i === prog.garden ? 'ghost' : 'off'; if (i === justAdded) { im.className = 'off'; requestAnimationFrame(() => requestAnimationFrame(() => im.className = '')); } });
  $('#gStars').textContent = starsFree(); $('#gCoins').textContent = fmt(M.coins());
  const gp = $('#gpanel');
  if (prog.garden >= GARDEN.length) { gp.innerHTML = `<h2>The garden is whole</h2><p>Every corner is blooming again. Thank you for tending it.</p><button class="btn" id="gPlay">Play level ${prog.level}</button>`; }
  else {
    const it = GARDEN[prog.garden], c = gardenCost(prog.garden), ok = starsFree() >= c, coinC = c * 40;
    gp.innerHTML = `<div class="gnext"><img src="assets/${it.src}.webp" alt=""><div><h3>${it.n}</h3><p style="margin:4px 0 0">Piece ${prog.garden + 1} of ${GARDEN.length} · ${c} stars</p></div></div>
      <div class="gbtns">${ok ? `<button class="btn" id="gBuy"><img src="assets/kit/star-full.webp" alt="">Restore · ${c}</button>` : `<button class="btn" id="gPlay">${justAdded >= 0 ? 'Next puzzle' : 'Play'} · Level ${prog.level}</button>`}
      ${!ok && M.coins() >= coinC ? `<button class="btn alt" id="gCoin"><img src="assets/kit/coin.webp" alt="">Restore now for ${fmt(coinC)} coins</button>` : ''}</div>
      ${ok ? '' : `<p style="margin:8px 0 0">${justAdded >= 0 ? `Restored! Next up: the ${it.n.toLowerCase()}, ${c} stars.` : `You have ${starsFree()} of ${c} stars. Each puzzle gives up to three.`}</p>`}`;
  }
  const buy = $('#gBuy'); if (buy) buy.onclick = () => { prog.spent += gardenCost(prog.garden); restored(); };
  const bc = $('#gCoin'); if (bc) bc.onclick = () => { if (M.spend(gardenCost(prog.garden) * 40, 'decor')) restored(); };
  const gpl = $('#gPlay'); if (gpl) gpl.onclick = () => { leaveGarden(); play(prog.level); };
}
function restored() {
  const i = prog.garden; prog.garden++; saveProg(); sfx.stamp();
  paintGarden(i);
  const im = $('#gbox').children[i], r = im.getBoundingClientRect();
  setTimeout(() => { petals(r.left + r.width / 2, r.top + r.height / 2, 26); animBusy = true; }, 350);
}
$('#gBack').onclick = () => { sfx.tap(); showHome(); };
const leaveGarden = () => { document.body.classList.remove('ingarden'); $('#garden').hidden = true; };

function showAlbum(page = 0) {
  const got = page === 0 ? Math.min(STAMPS.length, prog.level - 1) : prog.gild;
  openSheet(`<h2>Stamp album</h2>
    <div class="tabs"><button data-pg="0" aria-pressed="${page === 0}">Garden stamps</button><button data-pg="1" aria-pressed="${page === 1}">Gilded</button></div>
    <p class="sub">${page === 0 ? `${got} of ${STAMPS.length} · one for each new level` : `${got} of ${STAMPS.length} · from daily puzzles, and every third level after level 24`}</p>
    <div class="grid ${page ? 'gild' : ''}">${STAMPS.map((s, i) => i < got ? `<div class="got"><img src="assets/stamps/stamp-${s}.webp" alt="${s}"></div>` : `<div>${page === 0 ? '<b style="font:700 1.5rem/1 var(--display);color:#a8987c">' + (i + 1) + '</b>' : ''}</div>`).join('')}</div>
    <button class="btn" id="aClose">Close</button>`, { onBackdrop: closeSheet, wide: true });
  document.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { sfx.tap(); showAlbum(+b.dataset.pg); });
  $('#aClose').onclick = closeSheet;
}
function howHtml() {
  return `<div class="how"><img src="assets/mahjong/bamboo-3.webp" alt=""><p>Tap two tiles with the same picture to clear them.</p></div>
    <div class="how"><img src="assets/mahjong/flower-2.webp" alt=""><p>Any flower matches any flower, and any season matches any season.</p></div>
    <div class="how"><img src="assets/mahjong/tile-blank.webp" alt=""><p>A tile can be taken when nothing sits on it and its left or right side is open. Covered tiles look a little darker.</p></div>
    <p>There is no timer. Undo is always free, and if no pairs are open you get a free shuffle.</p>`;
}
function settings(inGame) {
  const sw = (k, label) => `<div class="set"><span>${label}</span><button class="sw" role="switch" data-k="${k}" aria-checked="${!!opts[k]}" aria-label="${label}"></button></div>`;
  openSheet(`<h2>${inGame ? 'Paused' : 'Settings'}</h2>
    ${inGame ? '<button class="btn" id="sResume">Resume</button>' : ''}
    ${sw('big', 'Larger text')}${sw('sound', 'Sounds')}${sw('music', 'Soft piano')}${sw('dim', 'Shade covered tiles')}
    <div class="set"><span>Tile faces</span><div class="seg"><button data-set="garden" aria-pressed="${opts.set === 'garden'}">Garden</button><button data-set="classic" aria-pressed="${opts.set === 'classic'}">Classic</button></div></div>
    <div class="two">${inGame ? '<button class="btn alt" id="sRestart">Restart</button><button class="btn alt" id="sHome">Home</button>' : ''}</div>
    <div class="two"><button class="btn alt" id="sHow">How to play</button><button class="btn alt" id="sBoard">🏆 Leaderboard</button></div>
    ${inGame ? '' : '<button class="btn" id="sClose">Close</button>'}`, { onBackdrop: closeSheet });
  document.querySelectorAll('.sw').forEach(b => b.onclick = () => {
    const k = b.dataset.k; opts[k] = !opts[k]; b.setAttribute('aria-checked', opts[k]); saveOpts(); sfx.tap();
    if (k === 'big') { document.documentElement.classList.toggle('big', opts.big); if (G) setTimeout(() => { layoutGeo(); dirty = true; }, 50); }
    if (k === 'sound') setSound(opts.sound);
    if (k === 'music') setMusic(opts.music);
    if (k === 'dim') { sprites.clear(); dirty = true; }
  });
  document.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    opts.set = b.dataset.set; saveOpts(); sfx.tap(); document.querySelectorAll('[data-set]').forEach(x => x.setAttribute('aria-pressed', x.dataset.set === opts.set));
    toast('New tile faces start with the next puzzle.');
  });
  const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
  on('#sResume', closeSheet); on('#sClose', closeSheet);
  on('#sRestart', () => { if (!G) return; F.level(false, 1 - pairsLeft() / (G.tiles.length / 2)); ls.set('cur', null); closeSheet(); const d = G.daily; startLevel(G.level, { isDaily: d }); });
  on('#sHome', () => { saveCur(); showHome(); });
  on('#sHow', () => openSheet(`<h2>How to play</h2>${howHtml()}<button class="btn" id="hOk">Got it</button>`, { onBackdrop: closeSheet }) || ($('#hOk').onclick = closeSheet));
  on('#sBoard', () => { closeSheet(); B.open(); });
}

// ---------------------------------------------------------------- buttons
$('#hintBtn').onclick = () => hint();
$('#shufBtn').onclick = () => shuffle(false);
$('#undoBtn').onclick = () => undo();
$('#menuBtn').onclick = () => { sfx.tap(); settings(true); };
$('#coins').onclick = () => { sfx.tap(); M.shop(); };
$('#playBtn').onclick = () => { sfx.tap(); play(prog.level); };
$('#dailyBtn').onclick = () => { sfx.tap(); if (Q.get('daily') !== '1') { history.replaceState(null, '', '?daily=1'); } play(prog.level, { isDaily: true }); };
$('#gardenBtn').onclick = () => { sfx.tap(); showGarden(); };
$('#albumBtn').onclick = () => { sfx.tap(); showAlbum(0); };
$('#shopBtn').onclick = () => { sfx.tap(); M.shop(); };
$('#setBtn').onclick = () => { sfx.tap(); settings(false); };
addEventListener('keydown', e => {
  if (state !== 'play' || !$('#sheet').hidden) return;
  if (e.key === 'h') hint(); else if (e.key === 's') shuffle(false); else if (e.key === 'z' || (e.key === 'Backspace')) undo(); else if (e.key === 'Escape') { sel = -1; dirty = true; }
});
M.onChange(s => { $('#coinN').textContent = s.coins >= 10000 ? Math.round(s.coins / 1000) + 'k' : fmt(s.coins); if (G) hud(); });
$('#coinN').textContent = fmt(M.coins());
addEventListener('resize', resize);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveCur(); });
// track time only while the page is visible (untimed game; the board just wants a believable duration)
addEventListener('visibilitychange', () => { if (!G) return; if (document.visibilityState === 'hidden') { G.ms += performance.now() - G.t0; } else G.t0 = performance.now(); });

// ---------------------------------------------------------------- test hooks
let botNext = null, botT = 0;
window.__game = {
  get state() { return state === 'next' ? 'won' : state; },
  get level() { return G ? G.level : prog.level; },
  get score() { return prog.solved; },
  bot() {
    const now = performance.now();
    if (state === 'ready') {
      if (!$('#sheet').hidden) return;
      if (!$('#garden').hidden) { if (now - botT < 700) return; botT = now; const b = $('#gBuy') || $('#gPlay'); if (b) b.click(); return; }
      play(prog.level); return;
    }
    if (state !== 'play' || !$('#sheet').hidden || now < busyUntil || now - botT < 560) return;
    botT = now;
    if (sel >= 0 && botNext != null && G.alive[botNext] && G.free[botNext] && E.matches(G.faces[sel], G.faces[botNext])) { tapTile(botNext); botNext = null; return; }
    const mv = E.solveFrom(G.tiles, G.alive, G.faces, G.L, { ms: 12 }) || E.pairsAvailable(G.alive, G.faces, G.L)[0];
    if (!mv) return;
    sel = -1; tapTile(mv[0]); botNext = mv[1];
  },
  autostart() { play(prog.level); },
  debug: () => ({ prog, opts, dly, G: G && { level: G.level, name: G.name, n: G.tiles.length, left: pairsLeft(), open: openPairs(), S: G.g.S }, money: M.debug() }),
};

// ---------------------------------------------------------------- boot
const artReady = loadArt();
resize();
requestAnimationFrame(frame);
artReady.then(() => {
  resize();
  if (D.isDaily) play(prog.level, { isDaily: true }); else showHome();
});
showHome();
