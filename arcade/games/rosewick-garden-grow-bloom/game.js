// Rosewick Garden: a gentle grow-and-bloom garden sim (style C · Storybook Garden).
// Plant seeds in raised beds, water them, watch four painted growth stages in real time (seconds to minutes),
// harvest stems and tie bouquets for the villagers of Rosewick. Coins open beds, seed species and decorations.
// Art: assets/storybook (painted gouache WebP, copied into ./assets). Canvas 2D for the garden, DOM for the UI.
import { note, tone, buzz } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';
import { SPECIES, SP, STAGES, VILLAGERS, VIL, DECOR, DEC, STAMPS, PLOT_COST } from './data.js';

const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const BOT = navigator.webdriver || Q.has('demo');
const now = () => Date.now();
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const dayIdx = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);
const rngOf = seed => { let s = (Math.floor(seed) % 2147483647) || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; };
const fmtGrow = s => s < 60 ? `${s} sec` : `${+(s / 60).toFixed(1).replace(/\.0$/, '')} min`;
const round5 = n => Math.max(5, Math.round(n / 5) * 5);

// ------------------------------------------------------------------ kit wiring
const M = money({ game: 'rosewick', style: 'C' });
const D = daily('rosewick', null, { name: 'Rosewick Garden' });
const B = board({ game: 'rosewick', label: 'Bouquets delivered', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });

// ------------------------------------------------------------------ save
const KEY = 'rosewick_save_v1';
const PLOT_ORDER = [3, 4, 5, 7, 6, 8, 1, 0, 2];          // the order beds open in
function fresh() {
  const plots = Array.from({ length: 9 }, () => ({ open: false, sp: null, p: 0, w: 0 }));
  PLOT_ORDER.slice(0, 4).forEach(i => plots[i].open = true);
  // a gentle start (as in every farm game): two daisies already in bloom and a tulip in bud
  Object.assign(plots[3], { sp: 'daisy', p: 30, w: 7 });
  Object.assign(plots[4], { sp: 'daisy', p: 30, w: 7 });
  Object.assign(plots[5], { sp: 'tulip', p: 33, w: 3 });
  return {
    v: 1, at: now(), plots, opened: 4, basket: {}, orders: [], orderN: 0, seed: (Math.random() * 1e9) | 0,
    delivered: 0, xp: 0, lvl: 1, unlocked: ['daisy', 'tulip', 'sunflower'], owned: [], slots: {}, album: { daisy: dayNum() }, stamps: [], served: {},
    streak: 0, lastDaily: 0, freezeWeek: -1, dailyDone: 0, showerAt: 0, freeShower: true, dblLeft: 0, trugAt: 0, giftDay: 0,
    waterings: 0, set: { big: false, mute: false, music: true, calm: false }, plantSp: null,
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
if (!S || S.v !== 1) S = fresh();
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { S.at = now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 150); };
document.documentElement.classList.toggle('big', !!S.set.big);
document.documentElement.classList.toggle('calm', !!S.set.calm);

// ------------------------------------------------------------------ images
const IMG = {};
const load = (k, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[k] = i; r(); }; i.onerror = () => r(); i.src = src; });
const wide = () => innerWidth / innerHeight > 1.05;
const bgSrc = (name) => `assets/bg/${name}${wide() ? '-wide' : ''}${(devicePixelRatio || 1) < 2 && !wide() ? '-s' : ''}.webp`;
const plantSrc = (sp, st) => `assets/plants/${sp}-${st}.webp`;
async function loadAll() {
  const jobs = [load('bg', bgSrc('rosewick')), load('coin', 'assets/kit/coin.webp'), load('can', 'assets/decor/watering-can.webp'), load('lock', 'assets/icons/lock.webp'), load('trug', 'assets/items/trug.webp'), load('paper', 'assets/kit/paper.webp')];
  for (const s of SPECIES) for (const st of STAGES) jobs.push(load(s.id + '-' + st, plantSrc(s.id, st)));
  for (const d of DECOR) jobs.push(load('d-' + d.id, `assets/decor/${d.id}.webp`));
  await Promise.all(jobs);
}

// ------------------------------------------------------------------ audio (soft harp plucks, a slow pentatonic loop)
const snd = {
  on: () => !S.set.mute,
  pluck(m, d = 0.6, v = 0.07) { if (snd.on()) note(m, d, v); },
  plant() { snd.pluck(60, 0.5, 0.08); setTimeout(() => snd.pluck(67, 0.5, 0.06), 70); },
  water() { if (!snd.on()) return; for (let i = 0; i < 5; i++) setTimeout(() => tone(1400 + Math.random() * 900, 0.09, 'sine', 0.025, 0.55), i * 70); snd.pluck(72, 0.5, 0.04); },
  harvest() { [72, 76, 79].forEach((m, i) => setTimeout(() => snd.pluck(m, 0.7, 0.07), i * 80)); },
  grow() { snd.pluck(79, 0.5, 0.045); setTimeout(() => snd.pluck(84, 0.6, 0.04), 90); },
  coin() { snd.pluck(88, 0.3, 0.05); setTimeout(() => snd.pluck(91, 0.4, 0.045), 60); },
  deliver() { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => setTimeout(() => snd.pluck(m, 1.1, 0.07), i * 90)); },
  tap() { snd.pluck(74, 0.25, 0.04); },
  no() { snd.pluck(57, 0.4, 0.05); setTimeout(() => snd.pluck(55, 0.5, 0.04), 110); },
};
let musicOn = false, musicT = 0, adPlaying = false;
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79];
const CH = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
let mStep = 0;
function musicTick() {
  clearTimeout(musicT);
  if (!musicOn || adPlaying || S.set.mute || !S.set.music || document.hidden) { musicT = setTimeout(musicTick, 900); return; }
  const bar = Math.floor(mStep / 8) % CH.length, beat = mStep % 8;
  if (beat === 0) CH[bar].forEach((m, i) => setTimeout(() => note(m, 2.6, 0.022), i * 120));
  if (beat % 2 === 1 || Math.random() < 0.35) { const m = SCALE[(Math.random() * SCALE.length) | 0]; note(m + (Math.random() < 0.2 ? 12 : 0), 1.4, 0.02); }
  mStep++; musicT = setTimeout(musicTick, 520);
}
addEventListener('ap:ad', e => { adPlaying = e.detail && e.detail.phase === 'start'; });
M.onAd(p => { adPlaying = p === 'start'; });

// ------------------------------------------------------------------ growth model
const stageOf = pl => { const s = SP[pl.sp]; return Math.min(3, Math.floor(pl.p / (s.grow / 3) + 1e-6)); };
const bloomed = pl => pl.sp && pl.p >= SP[pl.sp].grow - 1e-6;
const thirsty = pl => pl.sp && !bloomed(pl) && !(pl.w & (1 << stageOf(pl)));
const stageLeft = pl => { const s = SP[pl.sp], st = stageOf(pl); return (st + 1) * s.grow / 3 - pl.p; };
const timeLeft = pl => SP[pl.sp].grow - pl.p;
function advance(sec) {
  let blooms = 0;
  for (const [i, pl] of S.plots.entries()) {
    if (!pl.sp || bloomed(pl)) continue;
    const st0 = stageOf(pl); pl.p = Math.min(SP[pl.sp].grow, pl.p + sec);
    const st1 = stageOf(pl);
    if (st1 !== st0) { anim[i] = { t: performance.now(), kind: 'grow' }; if (st1 === 3) { blooms++; if (!S.album[pl.sp]) albumNew(pl.sp); } }
  }
  return blooms;
}
// offline growth: plants keep growing while you're away
const away = Math.max(0, (now() - (S.at || now())) / 1000);
const anim = {};
const awayBlooms = advance(away);

// ------------------------------------------------------------------ orders
const VORDER = ['hedgehog', 'robin', 'fox', 'owl', 'squirrel', 'cat', 'swan', 'kingfisher', 'bluetit'];
const metVillagers = () => VORDER.slice(0, Math.min(VORDER.length, 3 + Math.floor(S.lvl / 1.5)));
const FIRST = [{ daisy: 2 }, { daisy: 1, tulip: 1 }, { tulip: 2 }, { sunflower: 1, daisy: 2 }, { daisy: 2, tulip: 2 }];
function genOrder(k) {
  const r = rngOf(S.seed + k * 7919);
  const busy = new Set(S.orders.map(o => o.vil));
  let pool = metVillagers().filter(v => !busy.has(v)); if (!pool.length) pool = metVillagers();
  const vil = k === 0 ? 'hedgehog' : pool[(r() * pool.length) | 0];
  let need, grand = false;
  if (k < FIRST.length) need = { ...FIRST[k] };
  else {
    grand = k % 6 === 5;                                   // a "Grand bouquet" about 1 in 6: bigger, short, better paid
    const un = S.unlocked.slice();
    let stems = Math.min(9, 3 + Math.floor((k - 5) / 5));
    if (grand) stems = Math.min(12, Math.ceil(stems * 1.35) + 1);
    let kinds = Math.min(un.length, grand ? 3 : 1 + (r() < 0.65 ? 1 : 0) + (k > 14 && r() < 0.35 ? 1 : 0));
    const pick = [];
    const fav = un.slice(-4);                              // newer species show up more often
    while (pick.length < kinds) { const src = r() < 0.6 ? fav : un; const s = src[(r() * src.length) | 0]; if (!pick.includes(s)) pick.push(s); }
    need = {}; pick.forEach(s => need[s] = 1); for (let i = pick.length; i < stems; i++) { const s = pick[(r() * pick.length) | 0]; need[s]++; }
    // long-growing species come in smaller numbers
    for (const s of pick) if (SP[s].grow >= 300) need[s] = Math.max(1, Math.ceil(need[s] / 2));
  }
  const value = Object.entries(need).reduce((a, [s, n]) => a + SP[s].value * n, 0);
  const stems = Object.values(need).reduce((a, b) => a + b, 0);
  return { k, vil, need, coins: round5(value * (grand ? 2 : 1.45) + 5), xp: stems * 2 + (grand ? 6 : 0), grand };
}
function dailyOrder() {
  const d = dayNum(), r = rngOf(d * 31 + 17);
  const vil = VORDER[(r() * VORDER.length) | 0], pool = ['daisy', 'tulip', 'sunflower'];
  const need = {}; const n = 4 + ((r() * 3) | 0);
  const a = pool[(r() * 3) | 0], b = pool.filter(x => x !== a)[(r() * 2) | 0];
  need[a] = Math.ceil(n / 2); need[b] = Math.floor(n / 2);
  const value = Object.entries(need).reduce((s, [k, v]) => s + SP[k].value * v, 0);
  return { k: 'daily', vil, need, coins: round5(value * 2.4 + 10), xp: n * 3, daily: d };
}
while (S.orders.length < 3) S.orders.push(genOrder(S.orderN++));
const dailyOpen = () => S.dailyDone !== dayNum();
const shown = () => dailyOpen() ? [dailyOrder(), S.orders[0], S.orders[1]] : S.orders.slice(0, 3);
const canDeliver = o => Object.entries(o.need).every(([s, n]) => (S.basket[s] || 0) >= n);
const xpNeed = l => 16 + (l - 1) * 14;

// ------------------------------------------------------------------ canvas + layout
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, L = null;
const safeTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
function layout() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  document.documentElement.classList.toggle('wide', wide());
  const wd = wide(), fs = S.set.big ? 1.2 : 1;
  const board = $('#board'), tools = $('#tools'), basket = $('#basket');
  const toolsH = 84, top = 108;
  let gTop, gBot, gL, gR, bw;
  if (!wd) {
    const bh = Math.round(176 * Math.min(fs, 1.12));
    const by = H - toolsH - bh - 10;
    Object.assign(board.style, { left: '12px', right: '12px', top: by + 'px', height: bh + 'px', width: 'auto', bottom: 'auto' });
    Object.assign(basket.style, { left: '8px', top: '64px', right: 'auto' });
    gTop = top; gBot = by - 6; gL = 0; gR = W;
    bw = Math.min((W - 18) / 3.08, (gBot - gTop) / 2.75);
  } else {
    const bwid = Math.min(330, W * 0.27);
    Object.assign(board.style, { left: 'auto', right: '16px', top: '112px', width: bwid + 'px', height: Math.min(H - 130, 560) + 'px', bottom: 'auto' });
    Object.assign(basket.style, { left: '10px', top: '66px', right: 'auto' });
    gTop = top; gBot = H - 16; gL = 96; gR = W - bwid - 30;
    bw = Math.min((gR - gL) / 3.6, (gBot - gTop) / 3.5, 175);
  }
  // three rows of raised beds with a little perspective (back rows smaller, closer together)
  const rows = [0.86, 0.93, 1], cx = (gL + gR) / 2;
  const front = gBot - bw * 0.36, step = bw * (wd ? 0.8 : 0.82);
  const plots = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const s = rows[r], w = bw * s;
    plots.push({ x: cx + (c - 1) * bw * 1.04 * s, y: front - (2 - r) * step * (r === 0 ? 0.96 : 1), w, h: w * 0.46, s, r, c });
  }
  const backTop = plots[0].y - plots[0].h / 2;
  const dy = Math.max(gTop + bw * (wd ? 0.82 : 0.7), backTop - bw * (wd ? 0.25 : 0.42));
  const slots = wd ? [
    { x: cx - bw * 1.62, y: dy + bw * 0.06, s: 0.62 }, { x: cx - bw * 0.54, y: dy, s: 0.56 }, { x: cx + bw * 0.54, y: dy, s: 0.56 }, { x: cx + bw * 1.62, y: dy + bw * 0.06, s: 0.62 },
    { x: cx - bw * 1.78, y: plots[0].y + bw * 0.12, s: 0.72 }, { x: cx + bw * 1.78, y: plots[2].y + bw * 0.12, s: 0.72 },
  ] : [0, 1, 2, 3, 4, 5].map(k => ({ x: W * (0.09 + 0.164 * k), y: dy + (k % 2 ? -bw * 0.2 : bw * 0.04), s: 0.5 }));
  for (const sl of slots) sl.size = bw * sl.s * 1.35;
  L = { wd, plots, slots, bw, gTop, gBot };
  posPlantChip();
}
function posPlantChip() { }

// ------------------------------------------------------------------ painted bits drawn in code
let soilPat = null, wetPat = null;
function noiseTile(base, spots) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), r = rngOf(9);
  g.fillStyle = base; g.fillRect(0, 0, 96, 96);
  for (const [col, n, sz] of spots) { g.fillStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = 0.25 + r() * 0.6; g.beginPath(); g.ellipse(r() * 96, r() * 96, sz * (0.4 + r()), sz * (0.3 + r() * 0.6), r() * 3, 0, 7); g.fill(); } }
  return ctx.createPattern(c, 'repeat');
}
let paperPat = null;
function makePatterns() {
  if (IMG.paper) paperPat = ctx.createPattern(IMG.paper, 'repeat');
  soilPat = noiseTile('#6a4630', [['#8a6040', 70, 2.4], ['#4a2f1e', 80, 2.2], ['#a07850', 18, 1.4], ['#3a2416', 30, 3.2]]);
  wetPat = noiseTile('#4a3020', [['#5e3e28', 70, 2.4], ['#2e1d12', 80, 2.2], ['#7a5a40', 14, 1.4], ['#24160d', 30, 3.2]]);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawBed(P, pl, i, t) {
  const { x, y, w, h } = P, d = w * 0.13, x0 = x - w / 2, y0 = y - h / 2;
  // contact shadow
  if (pl.open) { ctx.fillStyle = 'rgba(40,50,20,.22)'; ctx.beginPath(); ctx.ellipse(x + w * 0.03, y + h / 2 + d * 0.9, w * 0.54, h * 0.32, 0, 0, 7); ctx.fill(); }
  if (!pl.open) {
    const next = PLOT_ORDER[S.opened] === i;
    ctx.save(); ctx.globalAlpha = next ? 1 : 0.8;
    ctx.fillStyle = 'rgba(96,128,64,.42)'; rr(x0 + 4, y0 + 4, w - 8, h - 8, h * 0.3); ctx.fill();
    ctx.setLineDash([7, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(250,246,236,.85)'; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    if (next) {   // a little wooden sign with the price
      const sw = w * 0.62, sh = w * 0.3, sx = x - sw / 2, sy = y - sh * 1.15;
      ctx.fillStyle = '#7a5532'; ctx.fillRect(x - 3, sy + sh - 4, 6, sh * 0.9);
      ctx.fillStyle = '#c99a62'; rr(sx, sy, sw, sh, 6); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#7a5532'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(sx + 4, sy + 4, sw - 8, 3);
      const cs = sh * 0.62; if (IMG.coin) ctx.drawImage(IMG.coin, sx + sw * 0.1, sy + (sh - cs) / 2, cs, cs);
      ctx.fillStyle = '#2b1c10'; ctx.font = `700 ${Math.round(sh * 0.5)}px 'Libre Baskerville',Georgia,serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(PLOT_COST[S.opened], sx + sw * 0.1 + cs + 4, sy + sh / 2 + 1);
    } else {
      const li = IMG.lock, ls = w * 0.26; if (li) { ctx.globalAlpha = 0.85; ctx.drawImage(li, x - ls / 2, y - ls / 2, ls, ls); ctx.globalAlpha = 1; }
    }
    return;
  }
  // raised timber bed: front board, side boards, top rim, soil
  const wood = ctx.createLinearGradient(0, y + h / 2 - 2, 0, y + h / 2 + d);
  wood.addColorStop(0, '#9b6a40'); wood.addColorStop(1, '#6e4628');
  ctx.fillStyle = wood; rr(x0, y0 + h * 0.2, w, h * 0.8 + d, h * 0.22); ctx.fill();
  ctx.strokeStyle = 'rgba(60,35,18,.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 + 6, y + h / 2 + d * 0.5); ctx.lineTo(x0 + w - 6, y + h / 2 + d * 0.5); ctx.stroke();
  for (const fx of [0.33, 0.67]) { ctx.beginPath(); ctx.moveTo(x0 + w * fx, y + h / 2 + 1); ctx.lineTo(x0 + w * fx, y + h / 2 + d - 1); ctx.stroke(); }
  // rim
  ctx.fillStyle = '#b8875a'; rr(x0, y0, w, h, h * 0.24); ctx.fill();
  ctx.strokeStyle = '#7d532f'; ctx.lineWidth = 1.5; ctx.stroke();
  // soil
  const wet = pl.sp && (bloomed(pl) || !thirsty(pl));
  const inset = w * 0.065;
  ctx.save(); rr(x0 + inset, y0 + inset * 0.8, w - inset * 2, h - inset * 1.6, h * 0.18); ctx.clip();
  ctx.fillStyle = wet ? wetPat : soilPat; ctx.fillRect(x0, y0, w, h);
  const sh = ctx.createLinearGradient(0, y0, 0, y0 + h); sh.addColorStop(0, 'rgba(20,10,5,.35)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,230,190,.08)');
  ctx.fillStyle = sh; ctx.fillRect(x0, y0, w, h);
  if (wet) { ctx.fillStyle = 'rgba(160,200,255,.10)'; ctx.fillRect(x0, y0, w, h); }
  // furrows
  ctx.strokeStyle = 'rgba(30,18,10,.25)'; ctx.lineWidth = 1.2;
  for (let k = 1; k < 4; k++) { const yy = y0 + h * k / 4; ctx.beginPath(); ctx.moveTo(x0 + inset * 1.5, yy); ctx.quadraticCurveTo(x, yy + 2, x0 + w - inset * 1.5, yy); ctx.stroke(); }
  ctx.restore();
  // wood grain, ink outline, paper wash, grass tufts: make the bed sit in the painting
  ctx.save(); ctx.strokeStyle = 'rgba(90,55,28,.35)'; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) { const yy = y + h / 2 + d * (0.2 + k * 0.25); ctx.beginPath(); ctx.moveTo(x0 + 8, yy); ctx.bezierCurveTo(x0 + w * 0.3, yy - 1.5, x0 + w * 0.6, yy + 1.5, x0 + w - 8, yy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(70,40,20,.55)'; ctx.lineWidth = 1.6; rr(x0, y0 + h * 0.2, w, h * 0.8 + d, h * 0.22); ctx.stroke();
  if (paperPat) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55; ctx.fillStyle = paperPat; rr(x0, y0, w, h + d, h * 0.22); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = '#6f9455'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const [fx, n] of [[0.02, 5], [0.98, 5], [0.5, 3]]) for (let k = 0; k < n; k++) {
    const bx = x0 + w * fx + (k - n / 2) * 3, by = y + h / 2 + d + 1, hh = 5 + ((k * 7 + i * 3) % 5) * 1.6;
    ctx.strokeStyle = k % 2 ? '#7fa364' : '#5b7f45'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + (k - 2) * 1.5, by - hh * 0.6, bx + (k - 2) * 2.4, by - hh); ctx.stroke();
  }
  ctx.restore();
  // highlight on the rim
  ctx.strokeStyle = 'rgba(255,240,210,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + h * 0.3, y0 + 2); ctx.lineTo(x0 + w - h * 0.3, y0 + 2); ctx.stroke();
  // planting-mode hint on empty beds
  if (!pl.sp && (S.plantSp || pulseEmpty)) {
    const a = 0.35 + 0.25 * Math.sin(t * 4);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); rr(x0 + 3, y0 + 3, w - 6, h - 6, h * 0.2); ctx.stroke(); ctx.restore();
    if (S.plantSp && IMG[S.plantSp + '-seedling']) { ctx.save(); ctx.globalAlpha = 0.45; const im = IMG[S.plantSp + '-seedling'], k = w / 220; ctx.drawImage(im, x - im.width * k / 2, y + h * 0.12 - im.height * k, im.width * k, im.height * k); ctx.restore(); }
  }
}
function plantGeom(P, pl) {
  const st = STAGES[stageOf(pl)], im = IMG[pl.sp + '-' + st]; if (!im) return null;
  const k = P.w / 185;
  return { im, k, w: im.width * k, h: im.height * k, bx: P.x, by: P.y + P.h * 0.2 };
}
function drawPlant(P, pl, i, t) {
  const g = plantGeom(P, pl); if (!g) return;
  const st = stageOf(pl), a = anim[i];
  let sc = 1, sy = 1;
  if (a) { const e = (performance.now() - a.t) / 1000; if (e > 0.9) delete anim[i]; else { const b = Math.sin(e * 14) * Math.exp(-e * 5); sc = 1 + b * 0.18; sy = 1 - b * 0.12; if (a.kind === 'plant') { sc *= Math.min(1, e * 4); sy *= Math.min(1, e * 4); } } }
  const sway = S.set.calm ? 0 : Math.sin(t * 1.3 + i * 1.7) * (st >= 2 ? 0.028 : 0.015);
  ctx.save(); ctx.translate(g.bx, g.by); ctx.rotate(sway); ctx.scale(sc, sy);
  if (bloomed(pl)) { ctx.shadowColor = 'rgba(255,240,180,.9)'; ctx.shadowBlur = 14 + 6 * Math.sin(t * 3 + i); }
  ctx.drawImage(g.im, -g.w / 2, -g.h, g.w, g.h);
  ctx.restore();
}
function drawBadge(P, pl, i, t) {
  const g = plantGeom(P, pl); if (!g) return;
  if (bloomed(pl)) {   // twinkles
    if (!S.set.calm) for (let k = 0; k < 3; k++) {
      const ph = t * 1.6 + k * 2.1 + i, a = Math.max(0, Math.sin(ph)), px = g.bx + Math.cos(k * 2.4 + i) * g.w * 0.45, py = g.by - g.h * (0.55 + 0.3 * Math.sin(k * 1.9 + i));
      star(px, py, 4 + a * 5, a);
    }
    // a tiny "ready" basket bubble
    bubble(g.bx + g.w * 0.32, g.by - g.h * 0.88 + Math.sin(t * 2.4 + i) * 3, P.w * 0.2, 'pick');
    return;
  }
  if (thirsty(pl)) bubble(g.bx + P.w * 0.3, g.by - Math.max(g.h, P.w * 0.55) * 0.95 + Math.sin(t * 2.6 + i) * 3, P.w * 0.2, 'drop');
  // growth clock on the bed's front-right corner
  const r = P.w * 0.11, cx = P.x + P.w * 0.42, cy = P.y + P.h * 0.42;
  ctx.fillStyle = '#FAF6EC'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#B08834'; ctx.lineWidth = 1.5; ctx.stroke();
  const f = pl.p / SP[pl.sp].grow;
  ctx.strokeStyle = '#567854'; ctx.lineWidth = r * 0.42; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); ctx.lineCap = 'butt';
}
function star(x, y, r, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff6c8'; ctx.translate(x, y); ctx.beginPath();
  for (let k = 0; k < 8; k++) { const rr2 = k % 2 ? r * 0.28 : r; const an = k * Math.PI / 4; ctx.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function bubble(x, y, r, kind) {
  ctx.save();
  ctx.fillStyle = 'rgba(31,45,84,.18)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, r, r, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#FAF6EC'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.moveTo(x - r * 0.35, y + r * 0.8); ctx.lineTo(x - r * 0.6, y + r * 1.45); ctx.lineTo(x + r * 0.1, y + r * 0.9); ctx.fill();
  ctx.strokeStyle = '#B08834'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  if (kind === 'drop') {
    const gr = ctx.createLinearGradient(x, y - r * 0.6, x, y + r * 0.6); gr.addColorStop(0, '#9fd0f0'); gr.addColorStop(1, '#3f7fb8');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, y - r * 0.62); ctx.bezierCurveTo(x + r * 0.55, y, x + r * 0.45, y + r * 0.55, x, y + r * 0.55); ctx.bezierCurveTo(x - r * 0.45, y + r * 0.55, x - r * 0.55, y, x, y - r * 0.62); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - r * 0.12, y + r * 0.1, r * 0.08, r * 0.16, 0.4, 0, 7); ctx.fill();
  } else if (IMG.trug) { const k = r * 1.3 / IMG.trug.width; ctx.drawImage(IMG.trug, x - IMG.trug.width * k / 2, y - IMG.trug.height * k / 2, IMG.trug.width * k, IMG.trug.height * k);
  } else {   // fallback: a tiny posy
    ctx.fillStyle = '#B04A5C'; for (const [dx, dy] of [[-0.25, -0.2], [0.22, -0.22], [0, -0.42]]) { ctx.beginPath(); ctx.arc(x + r * dx, y + r * dy, r * 0.22, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#567854'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r * 0.25, y - r * 0.1); ctx.lineTo(x, y + r * 0.5); ctx.lineTo(x + r * 0.22, y - r * 0.1); ctx.moveTo(x, y - r * 0.3); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
    ctx.fillStyle = '#B08834'; ctx.beginPath(); ctx.ellipse(x - r * 0.14, y + r * 0.2, r * 0.14, r * 0.08, 0.5, 0, 7); ctx.ellipse(x + r * 0.14, y + r * 0.2, r * 0.14, r * 0.08, -0.5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ particles, butterflies, the watering can
const parts = [];
function puff(x, y, kind, n = 10) {
  if (S.set.calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.2;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'drop' ? 0 : 1.8), life: 1, kind, r: kind === 'petal' ? 4 + Math.random() * 4 : 2 + Math.random() * 3, rot: Math.random() * 6, col: kind === 'petal' ? ['#f2b8c4', '#f7d6dc', '#fff4d8', '#e9a0b0'][i % 4] : kind === 'leaf' ? '#7fa36a' : '#8cc4ee' });
  }
}
let rain = 0;
const flies = Array.from({ length: 3 }, (_, i) => ({ x: Math.random() * 400, y: 200 + Math.random() * 300, a: Math.random() * 6, t: Math.random() * 10, col: ['#f6e7a0', '#c9b6e8', '#a9cdea'][i] }));
const cans = [];   // { x, y, t0 }
function drawFX(dt, t) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt * (p.kind === 'petal' ? 0.6 : 1.4);
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += (p.kind === 'drop' ? 9 : p.kind === 'petal' ? 0.6 : 3) * dt; p.x += p.vx * dt * 60 * (p.kind === 'petal' ? 0.5 : 1); p.y += p.vy * dt * 60 * (p.kind === 'petal' ? 0.4 : 1); p.rot += dt * 3;
    ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.col; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.kind === 'spark') { ctx.restore(); star(p.x, p.y, p.r * 2, Math.min(1, p.life * 1.5)); continue; }
    ctx.beginPath(); p.kind === 'drop' ? ctx.ellipse(0, 0, p.r * 0.6, p.r * 1.3, 0, 0, 7) : ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  for (let i = cans.length - 1; i >= 0; i--) {
    const c = cans[i], e = (performance.now() - c.t0) / 1000; if (e > 1.1 || !IMG.can) { cans.splice(i, 1); continue; }
    const k = c.w / 300, tilt = Math.min(1, e * 4) * 0.55 - (e > 0.85 ? (e - 0.85) * 2.2 : 0);
    ctx.save(); ctx.globalAlpha = e < 0.15 ? e / 0.15 : e > 0.9 ? Math.max(0, (1.1 - e) / 0.2) : 1;
    ctx.translate(c.x - c.w * 0.25, c.y - c.w * 0.75); ctx.rotate(tilt); ctx.drawImage(IMG.can, -IMG.can.width * k / 2, -IMG.can.height * k / 2, IMG.can.width * k, IMG.can.height * k); ctx.restore();
    if (e > 0.2 && e < 0.85 && Math.random() < 0.7) parts.push({ x: c.x + c.w * 0.02 + (Math.random() - 0.5) * 10, y: c.y - c.w * 0.55, vx: (Math.random() - 0.3) * 0.6, vy: 2, life: 0.5, kind: 'drop', r: 2 + Math.random() * 1.5, rot: 0, col: '#8cc4ee' });
  }
  if (rain > 0) {
    rain -= dt; ctx.strokeStyle = 'rgba(160,200,235,.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let k = 0; k < (S.set.calm ? 30 : 90); k++) { const x = (k * 97.3 + t * 400) % (W + 60) - 30, y = (k * 53.1 + t * 900) % (H + 40) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); }
    ctx.stroke();
  }
  if (S.set.calm) return;
  for (const f of flies) {   // butterflies wander over the beds
    f.t += dt; f.a += (Math.sin(f.t * 0.7) * 0.9 + Math.sin(f.t * 1.9) * 0.6) * dt;
    f.x += Math.cos(f.a) * 38 * dt; f.y += Math.sin(f.a) * 26 * dt + Math.sin(f.t * 5) * 0.4;
    if (f.x < 20) f.a = 0; if (f.x > W - 20) f.a = Math.PI; if (f.y < L.gTop) f.a = Math.PI / 2; if (f.y > L.gBot) f.a = -Math.PI / 2;
    const fl = Math.abs(Math.sin(f.t * 13)), s = 7;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.cos(f.a) * 0.3);
    ctx.fillStyle = f.col; ctx.strokeStyle = 'rgba(60,50,40,.5)'; ctx.lineWidth = 0.8;
    for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd * (0.25 + fl * 0.75), 1); ctx.beginPath(); ctx.ellipse(s * 0.7, -s * 0.35, s * 0.8, s * 0.6, -0.4, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s * 0.55, s * 0.45, s * 0.5, s * 0.4, 0.4, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-0.8, -s * 0.7, 1.6, s * 1.4); ctx.restore();
  }
}

// ------------------------------------------------------------------ frame
let lastT = performance.now(), pulseEmpty = false, design = false;
function frame(tm) {
  const dt = Math.min(0.1, (tm - lastT) / 1000); lastT = tm; const t = tm / 1000;
  if (state !== 'ready') { const b = advance(dt); if (b) { snd.grow(); refreshBoard(); } }
  draw(dt, t);
  requestAnimationFrame(frame);
}
function draw(dt, t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = IMG.bg;
  if (bg) { const s = Math.max(W / bg.width, H / bg.height), bw = bg.width * s, bh = bg.height * s; ctx.drawImage(bg, (W - bw) / 2, (H - bh) * (L.wd ? 0.5 : 0.35), bw, bh); }
  else { ctx.fillStyle = '#dfe6cc'; ctx.fillRect(0, 0, W, H); }
  // soft warm light from the top left
  const lg = ctx.createRadialGradient(W * 0.2, -H * 0.1, 10, W * 0.3, H * 0.2, Math.max(W, H)); lg.addColorStop(0, 'rgba(255,240,200,.25)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  // decorations (behind the beds)
  L.slots.forEach((sl, si) => drawSlot(sl, si, t));
  // beds back to front, plants on top of their bed
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const i = r * 3 + c, P = L.plots[i], pl = S.plots[i];
    drawBed(P, pl, i, t);
    if (pl.open && pl.sp) drawPlant(P, pl, i, t);
  }
  for (let i = 0; i < 9; i++) if (S.plots[i].open && S.plots[i].sp) drawBadge(L.plots[i], S.plots[i], i, t);
  drawFX(dt, t);
  // vignette, very light
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.4, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(31,45,84,0)'); vg.addColorStop(1, 'rgba(31,45,84,.16)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function drawSlot(sl, si, t) {
  const id = S.slots[si], im = id && IMG['d-' + id];
  if (im) {
    const k = sl.size / Math.max(im.width, im.height);
    ctx.fillStyle = 'rgba(40,50,20,.2)'; ctx.beginPath(); ctx.ellipse(sl.x, sl.y + 2, im.width * k * 0.42, im.width * k * 0.1, 0, 0, 7); ctx.fill();
    ctx.drawImage(im, sl.x - im.width * k / 2, sl.y - im.height * k + im.height * k * 0.04, im.width * k, im.height * k);
  }
  if (design) {
    const r = sl.size * 0.36, y = sl.y - sl.size * 0.4, a = 0.6 + 0.3 * Math.sin(t * 4 + si);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = id ? 'rgba(250,246,236,.25)' : 'rgba(250,246,236,.7)'; ctx.beginPath(); ctx.arc(sl.x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1F2D54'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
    if (!id) { ctx.fillStyle = '#1F2D54'; ctx.font = `700 ${Math.round(r)}px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', sl.x, y + 1); }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ input on the garden
function hitPlot(x, y) {
  for (let r = 2; r >= 0; r--) for (let c = 2; c >= 0; c--) {
    const i = r * 3 + c, P = L.plots[i], pl = S.plots[i];
    if (Math.abs(x - P.x) < P.w * 0.52 && y > P.y - P.h * 0.62 && y < P.y + P.h * 0.5 + P.w * 0.13) return i;
  }
  for (let r = 2; r >= 0; r--) for (let c = 2; c >= 0; c--) {   // then the plant itself (tall blooms poke up behind)
    const i = r * 3 + c, P = L.plots[i], pl = S.plots[i]; if (!pl.sp) continue;
    const g = plantGeom(P, pl); if (g && Math.abs(x - g.bx) < g.w * 0.4 && y < g.by && y > g.by - g.h * 0.95) return i;
  }
  return -1;
}
function hitSlot(x, y) { for (let i = L.slots.length - 1; i >= 0; i--) { const s = L.slots[i]; if (Math.hypot(x - s.x, y - (s.y - s.size * 0.4)) < s.size * 0.5) return i; } return -1; }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const x = e.clientX, y = e.clientY;
  hidePop();
  if (design) { const s = hitSlot(x, y); if (s >= 0) { decorSheet(s); return; } }
  const i = hitPlot(x, y); if (i < 0) { if (S.plantSp) setPlanting(null); return; }
  tapPlot(i);
});
function plotScreen(i) { const P = L.plots[i], pl = S.plots[i], g = pl.sp && plantGeom(P, pl); return { x: P.x, y: g ? g.by - g.h * 0.5 : P.y }; }

function tapPlot(i) {
  const pl = S.plots[i];
  if (!pl.open) return tryOpenPlot(i);
  if (!pl.sp) { if (S.plantSp && SP[S.plantSp]) return plant(i, S.plantSp); return seedSheet(i); }
  if (bloomed(pl)) return harvest(i);
  if (thirsty(pl)) return water(i);
  growPop(i);
}
function plant(i, sp) {
  const s = SP[sp];
  if (!M.spend(s.seed, 'seeds')) { snd.no(); toast(`Seeds cost ${s.seed} coins. Fill an order to earn more.`); setPlanting(null); return false; }
  Object.assign(S.plots[i], { sp, p: 0, w: 0 }); anim[i] = { t: performance.now(), kind: 'plant' };
  const P = L.plots[i]; puff(P.x, P.y, 'leaf', 8); snd.plant(); buzz(8);
  floatText(`−${s.seed}`, P.x, P.y - P.h);
  if (!S.plots.some(p => p.open && !p.sp)) setPlanting(null);
  save(); return true;
}
function water(i) {
  const pl = S.plots[i], P = L.plots[i];
  pl.w |= 1 << stageOf(pl);
  const before = stageOf(pl);
  pl.p += stageLeft(pl) * 0.6;                     // a drink speeds this stage along
  if (stageOf(pl) !== before) { anim[i] = { t: performance.now(), kind: 'grow' }; if (bloomed(pl) && !S.album[pl.sp]) albumNew(pl.sp); }
  cans.push({ x: P.x, y: P.y, w: P.w, t0: performance.now() });
  setTimeout(() => puff(P.x, P.y - P.h * 0.2, 'drop', 8), 300);
  S.waterings++; snd.water(); buzz(6); save(); refreshBoard();
}
function harvest(i) {
  const pl = S.plots[i], sp = pl.sp, P = L.plots[i], pos = plotScreen(i);
  let n = 2; if (S.dblLeft > 0) { n = 4; S.dblLeft--; }
  S.basket[sp] = (S.basket[sp] || 0) + n;
  Object.assign(pl, { sp: null, p: 0, w: 0 });
  puff(pos.x, pos.y, 'petal', 14); puff(pos.x, pos.y, 'spark', 6);
  for (let k = 0; k < Math.min(n, 3); k++) setTimeout(() => flyImg(`assets/plants/${sp}-bloom.webp`, pos, $('#basket'), 46), k * 90);
  floatText(`+${n} ${SP[sp].name}`, pos.x, pos.y - 30);
  snd.harvest(); buzz(12); save();
  setTimeout(refreshBoard, 600);
  if (!S.plantSp && S.unlocked.includes(sp)) setTimeout(() => { if (state === 'play' && !S.plantSp && !sheetOpen) hintReplant(i, sp); }, 700);
}
let hintT = 0;
function hintReplant(i, sp) { pulseEmpty = true; clearTimeout(hintT); hintT = setTimeout(() => pulseEmpty = false, 2500); }
function tryOpenPlot(i) {
  if (PLOT_ORDER[S.opened] !== i) { toast('Open the bed with the wooden sign first.'); snd.no(); return; }
  const cost = PLOT_COST[S.opened];
  openSheet('A new flower bed', `Dig and edge this bed for <b>${cost}</b> coins. More beds, bigger bouquets.`, body => {
    const r = document.createElement('div'); r.className = 'row';
    const ok = mkBtn(`<img src="assets/kit/coin.webp" alt="">Open for ${cost}`, 'sage', () => {
      if (!M.spend(cost, 'plot')) { closeSheet(); toast('Not enough coins yet. Bouquets earn coins.'); setTimeout(() => M.shop(), 400); return; }
      S.plots[i].open = true; S.opened++; closeSheet(); const P = L.plots[i]; puff(P.x, P.y, 'leaf', 16); puff(P.x, P.y, 'spark', 8); snd.deliver(); save();
      toast('A fresh bed, ready for seeds.');
    });
    r.append(ok); body.append(r);
  });
}
// a small popover on a growing, watered plant: time left + "Bloom now" for a few coins
const pop = document.createElement('div');
pop.style.cssText = 'position:fixed;z-index:12;display:none;transform:translate(-50%,-100%);background:#FAF6EC;border:2px solid #d9b45a;border-radius:18px;padding:8px 10px;box-shadow:0 6px 16px rgba(31,45,84,.3);text-align:center;font-size:18px;color:#1F2D54;min-width:170px';
document.body.appendChild(pop);
function hidePop() { pop.style.display = 'none'; pop.dataset.i = ''; }
function growPop(i) {
  const pl = S.plots[i], left = timeLeft(pl), cost = Math.max(1, Math.ceil(left / 12)), pos = plotScreen(i);
  pop.innerHTML = `<div><b>${SP[pl.sp].name}</b> · ${STAGES[stageOf(pl)] === 'young' ? 'growing' : STAGES[stageOf(pl)]}</div><div style="margin:2px 0 6px">Blooms in <b data-left>${fmtT(left)}</b></div>`;
  const b = mkBtn(`Bloom now · <img src="assets/kit/coin.webp" alt="" style="width:24px;height:24px">${cost}`, 'sage', () => {
    if (!M.spend(cost, 'bloom-now')) { hidePop(); toast('Not enough coins.'); return; }
    pl.p = SP[pl.sp].grow; anim[i] = { t: performance.now(), kind: 'grow' }; if (!S.album[pl.sp]) albumNew(pl.sp);
    puff(pos.x, pos.y, 'spark', 10); snd.grow(); hidePop(); save(); refreshBoard();
  });
  b.style.minHeight = '52px'; b.style.fontSize = '17px'; b.style.padding = '4px 14px';
  pop.append(b); pop.dataset.i = i;
  pop.style.left = Math.max(100, Math.min(W - 100, pos.x)) + 'px'; pop.style.top = Math.max(150, pos.y - 20) + 'px'; pop.style.display = 'block';
  snd.tap();
}
setInterval(() => { const i = pop.dataset.i; if (i === '' || i === undefined || pop.style.display === 'none') return; const pl = S.plots[+i]; if (!pl || !pl.sp || bloomed(pl)) return hidePop(); const el = pop.querySelector('[data-left]'); if (el) el.textContent = fmtT(timeLeft(pl)); }, 500);

// ------------------------------------------------------------------ planting mode chip
function setPlanting(sp) {
  S.plantSp = sp; const chip = $('#plantchip');
  if (!sp) { chip.classList.add('off'); return; }
  chip.querySelector('img').src = plantSrc(sp, 'seedling');
  chip.querySelector('span').textContent = `Planting ${SP[sp].name} · tap empty beds`;
  chip.classList.remove('off');
}
$('#plantchip button').addEventListener('click', e => { e.stopPropagation(); if (design) return setDesign(false); setPlanting(null); });
function setDesign(on) {
  design = on; const chip = $('#plantchip');
  if (on) { setPlanting(null); chip.querySelector('img').src = 'assets/icons/pencil.webp'; chip.querySelector('span').textContent = 'Tap a circle to decorate'; chip.classList.remove('off'); }
  else chip.classList.add('off');
}

// ------------------------------------------------------------------ sheets
let sheetOpen = false;
const sheet = $('#sheet'), veil = $('#veil');
function openSheet(title, sub, fill) {
  hidePop();
  sheet.querySelector('h2').innerHTML = title; sheet.querySelector('.sub').innerHTML = sub || ''; sheet.querySelector('.sub').style.display = sub ? '' : 'none';
  const body = sheet.querySelector('.body'); body.innerHTML = ''; fill(body);
  sheet.classList.add('on'); veil.classList.add('on'); sheetOpen = true; body.scrollTop = 0;
}
function closeSheet() { sheet.classList.remove('on'); veil.classList.remove('on'); sheetOpen = false; }
sheet.querySelector('.x').addEventListener('click', closeSheet);
veil.addEventListener('pointerdown', closeSheet);
addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
function mkBtn(html, cls, fn) { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.innerHTML = html; b.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return b; }
const neededMap = () => { const m = {}; for (const o of shown()) for (const [s, n] of Object.entries(o.need)) m[s] = (m[s] || 0) + Math.max(0, n - (S.basket[s] || 0)); return m; };

function seedSheet(i) {
  const need = neededMap();
  openSheet('Seed tray', 'Pick a seed for this bed. After that, tap other empty beds to plant the same.', body => {
    const g = document.createElement('div'); g.className = 'grid';
    for (const s of SPECIES) {
      const have = S.unlocked.includes(s.id), canUnlock = !have && S.lvl >= s.lvl;
      const d = document.createElement('div'); d.className = 'pk' + (have ? '' : ' locked');
      d.innerHTML = `${have && need[s.id] ? '<span class="need">Wanted</span>' : ''}<img src="${plantSrc(s.id, 'bloom')}" alt=""><b>${s.name}</b>` +
        (have ? `<div class="meta"><span>⏱ ${fmtGrow(s.grow)}</span><span><img src="assets/kit/coin.webp" alt="">${s.seed}</span></div>`
          : canUnlock ? `<div class="cta">Unlock · ${s.unlock}</div>` : `<div class="meta">Garden level ${s.lvl}</div>`);
      d.addEventListener('click', () => {
        if (have) { closeSheet(); if (plant(i, s.id)) setPlanting(S.plots.some(p => p.open && !p.sp) ? s.id : null); return; }
        if (!canUnlock) { toast(`${s.name} seeds arrive at garden level ${s.lvl}.`); return; }
        if (!M.spend(s.unlock, 'species')) { toast(`You need ${s.unlock} coins for ${s.name} seeds.`); closeSheet(); setTimeout(() => M.shop(), 300); return; }
        S.unlocked.push(s.id); save(); snd.deliver(); toast(`${s.name} seeds added to your tray!`); seedSheet(i);
      });
      g.append(d);
    }
    body.append(g);
  });
}

function decorSheet(si) {
  const cur = S.slots[si];
  openSheet('Decorate', 'Choose something lovely for this spot. Each piece adds charm: +2% coins from every bouquet.', body => {
    const g = document.createElement('div'); g.className = 'grid';
    for (const d of DECOR) {
      const own = S.owned.includes(d.id), here = cur === d.id, elsewhere = !here && Object.values(S.slots).includes(d.id);
      const el = document.createElement('div'); el.className = 'pk' + (here ? ' sel' : '');
      el.innerHTML = `<img src="assets/decor/${d.id}.webp" alt=""><b>${d.name}</b>` + (here ? '<div class="cta dim">Remove</div>' : own ? `<div class="cta">${elsewhere ? 'Move here' : 'Place'}</div>` : `<div class="meta"><img src="assets/kit/coin.webp" alt="">${d.cost}</div>`);
      el.addEventListener('click', () => {
        if (here) { delete S.slots[si]; save(); closeSheet(); return; }
        if (!own) { if (!M.spend(d.cost, 'decor')) { toast(`${d.name} costs ${d.cost} coins.`); closeSheet(); setTimeout(() => M.shop(), 300); return; } S.owned.push(d.id); }
        for (const k of Object.keys(S.slots)) if (S.slots[k] === d.id) delete S.slots[k];
        S.slots[si] = d.id; save(); closeSheet(); const sl = L.slots[si]; puff(sl.x, sl.y - sl.size * 0.4, 'spark', 12); puff(sl.x, sl.y - sl.size * 0.3, 'petal', 8); snd.deliver();
        toast(`${d.name} placed. Charm ${charm()}`);
      });
      g.append(el);
    }
    body.append(g);
  });
}
const charm = () => S.owned.reduce((a, id) => a + (DEC[id] ? DEC[id].charm : 0), 0);

function albumSheet(tab = 'seeds') {
  openSheet('Garden album', tab === 'seeds' ? `${Object.keys(S.album).length} of ${SPECIES.length} flowers bloomed` : `${S.stamps.length} of 24 keepsake stamps`, body => {
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    for (const [k, t] of [['seeds', 'Seed album'], ['stamps', 'Stamps']]) { const b = document.createElement('button'); b.textContent = t; b.setAttribute('aria-pressed', k === tab); b.onclick = () => albumSheet(k); tabs.append(b); }
    body.append(tabs);
    if (tab === 'seeds') {
      const g = document.createElement('div'); g.className = 'alb';
      for (const s of SPECIES) { const got = S.album[s.id]; const d = document.createElement('div'); d.className = 'pg' + (got ? '' : ' no'); d.innerHTML = `<img src="${plantSrc(s.id, 'bloom')}" alt=""><b>${got ? s.name : '?'}</b>${got ? `<span style="font-size:16px;color:#4a4f66;margin-top:3px">${s.note}</span>` : `<span>Bloom one to fill this page</span>`}`; g.append(d); }
      body.append(g);
    } else {
      const g = document.createElement('div'); g.className = 'stamps';
      const all = [...VORDER, ...STAMPS];
      for (const id of all) { const got = S.stamps.includes(id); const im = document.createElement('img'); im.src = `assets/stamps/stamp-${VIL[id] ? VIL[id].stamp : id}.webp`; im.alt = id; if (!got) im.className = 'no'; g.append(im); }
      body.append(g);
      const p = document.createElement('p'); p.className = 'sub'; p.style.marginTop = '12px'; p.textContent = 'Villagers give you their stamp the first time you bring them flowers. The rest arrive as you deliver bouquets.'; body.append(p);
    }
  });
}
function albumNew(sp) { S.album[sp] = dayNum(); save(); setTimeout(() => toast(`New page in your seed album: ${SP[sp].name}`), 400); badge(); }

function settingsSheet() {
  openSheet('Settings', '', body => {
    const rows = [['big', 'Larger text'], ['mute', 'Sound off'], ['music', 'Gentle music'], ['calm', 'Calm motion (fewer effects)']];
    for (const [k, t] of rows) {
      const r = document.createElement('div'); r.className = 'tog'; r.innerHTML = `<span>${t}</span>`;
      const b = document.createElement('button'); b.setAttribute('aria-pressed', !!S.set[k]); b.setAttribute('aria-label', t);
      b.onclick = () => { S.set[k] = !S.set[k]; b.setAttribute('aria-pressed', S.set[k]); document.documentElement.classList.toggle('big', !!S.set.big); document.documentElement.classList.toggle('calm', !!S.set.calm); save(); layout(); refreshBoard(); };
      r.append(b); body.append(r);
    }
    const p = document.createElement('p'); p.className = 'sub'; p.style.marginTop = '14px';
    p.innerHTML = `Flowers keep growing while you're away. Nothing wilts, nothing is ever lost.<br>Daily bouquet streak: <b>${S.streak}</b> day${S.streak === 1 ? '' : 's'} · one free streak freeze each week.`;
    body.append(p);
    const r2 = document.createElement('div'); r2.className = 'row'; r2.style.marginTop = '6px';
    r2.append(mkBtn('🏆 World board', 'light', () => { closeSheet(); B.open(); }));
    body.append(r2);
  });
}

function basketSheet() {
  const need = neededMap();
  openSheet('Flower basket', 'Freshly cut stems, ready for bouquets.', body => {
    const g = document.createElement('div'); g.className = 'grid';
    const ids = SPECIES.filter(s => S.basket[s.id]);
    if (!ids.length) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = 'Empty for now. Tap a flower in bloom to cut it.'; body.append(p); }
    for (const s of ids) { const d = document.createElement('div'); d.className = 'pk'; d.innerHTML = `<img src="${plantSrc(s.id, 'bloom')}" alt=""><b>${s.name} × ${S.basket[s.id]}</b>${need[s.id] ? `<div class="meta">${need[s.id]} more wanted</div>` : ''}`; g.append(d); }
    body.append(g);
    body.append(document.createElement('hr'));
    const ready = now() - S.trugAt > 300e3;
    const p = document.createElement('p'); p.className = 'sub';
    p.innerHTML = S.dblLeft ? `Golden trug active: your next <b>${S.dblLeft}</b> harvests give double stems.` : ready ? 'Golden trug: the next 6 harvests give <b>double stems</b>.' : `The golden trug is resting. Back in ${fmtT((300e3 - (now() - S.trugAt)) / 1000)}.`;
    body.append(p);
    if (!S.dblLeft && ready) {
      const r = document.createElement('div'); r.className = 'row';
      r.append(mkBtn('<img src="assets/icons/video.webp" alt="">Watch a short video', 'rose', async () => {
        closeSheet();
        if (await M.rewarded('double', { title: 'Golden trug', what: 'Double stems from your next 6 harvests' })) { S.dblLeft = 6; S.trugAt = now(); save(); toast('Golden trug ready: double stems x6'); snd.deliver(); }
      }));
      body.append(r);
    }
  });
}

// ------------------------------------------------------------------ shower (rewarded speed-up)
const SHOWER_CD = 180e3;
const showerReady = () => S.freeShower || now() - S.showerAt > SHOWER_CD;
async function shower() {
  const growing = S.plots.some(p => p.sp && !bloomed(p));
  if (!growing) { toast('Plant some seeds first, then call the rain.'); return; }
  if (!showerReady()) { toast(`The clouds are resting. Next shower in ${fmtT((SHOWER_CD - (now() - S.showerAt)) / 1000)}.`); return; }
  let ok = false;
  if (S.freeShower) ok = true;
  else ok = await M.rewarded('shower', { title: 'Spring shower', what: 'Every growing flower jumps one whole stage' });
  if (!ok) return;
  S.freeShower = false; S.showerAt = now(); rain = 1.6; snd.water(); setTimeout(snd.water, 300);
  setTimeout(() => {
    for (const [i, pl] of S.plots.entries()) if (pl.sp && !bloomed(pl)) {
      pl.w |= 1 << stageOf(pl); pl.p = Math.min(SP[pl.sp].grow, (stageOf(pl) + 1) * SP[pl.sp].grow / 3);
      anim[i] = { t: performance.now() + i * 60, kind: 'grow' }; if (bloomed(pl) && !S.album[pl.sp]) albumNew(pl.sp);
      const P = L.plots[i]; puff(P.x, P.y - P.h, 'spark', 5);
    }
    snd.grow(); save(); refreshBoard();
  }, 700);
  toolsPaint();
}

// ------------------------------------------------------------------ visiting a villager's garden
function visitSheet() {
  const met = VORDER.filter(v => S.served[v]);
  const list = met.length ? met : ['hedgehog'];
  openSheet('Visit a neighbour', S.giftDay === dayNum() ? 'You took today\'s cutting. Visits are always welcome.' : 'Every garden has a cutting for you once a day.', body => {
    const g = document.createElement('div'); g.className = 'grid';
    for (const v of VORDER) {
      const ok = list.includes(v), d = document.createElement('div'); d.className = 'pk' + (ok ? '' : ' locked');
      d.innerHTML = `<img src="assets/stamps/stamp-${VIL[v].stamp}.webp" alt="" style="width:96px;height:80px"><b style="font-size:17px">${ok ? VIL[v].name : '?'}</b>${ok ? '<div class="cta">Visit</div>' : '<div class="meta">Bring them flowers</div>'}`;
      if (ok) d.addEventListener('click', () => { closeSheet(); visit(v); });
      g.append(d);
    }
    body.append(g);
  });
}
let visitEl = null;
async function visit(v) {
  const V = VIL[v], r = rngOf(VORDER.indexOf(v) * 991 + 3);
  await load('meta', bgSrc('meta-garden'));
  visitEl = document.createElement('div'); visitEl.id = 'visit';
  const c = document.createElement('canvas'); visitEl.append(c);
  visitEl.insertAdjacentHTML('beforeend', `<div class="vhead"><img src="assets/stamps/stamp-${V.stamp}.webp" alt=""><span>${V.name}'s garden</span></div><div class="vbar"></div>`);
  document.body.append(visitEl);
  const W2 = innerWidth, H2 = innerHeight, d = Math.min(2, devicePixelRatio || 1); c.width = W2 * d; c.height = H2 * d; const g = c.getContext('2d'); g.scale(d, d);
  const bg = IMG.meta, s = Math.max(W2 / bg.width, H2 / bg.height); g.drawImage(bg, (W2 - bg.width * s) / 2, (H2 - bg.height * s) / 2, bg.width * s, bg.height * s);
  // their planting: drifts of blooms on the lawn, a couple of their decorations
  const own = SPECIES.slice(0, 3 + VORDER.indexOf(v)).map(x => x.id), items = [];
  const decs = [DECOR[(VORDER.indexOf(v) * 3 + 5) % DECOR.length].id, DECOR[(VORDER.indexOf(v) * 5 + 9) % DECOR.length].id];
  const unit = Math.min(W2, H2 * 0.7) / 4.2;
  for (let k = 0; k < 2; k++) items.push({ im: IMG['d-' + decs[k]], x: W2 * (k ? 0.74 : 0.26), y: H2 * 0.5, h: unit * 1.25 });
  for (let k = 0; k < 9; k++) { const sp = own[(r() * own.length) | 0]; items.push({ im: IMG[sp + '-bloom'], x: W2 * (0.24 + r() * 0.52), y: H2 * (W2 < H2 ? 0.5 + r() * 0.14 : 0.55 + r() * 0.2), h: unit * (0.9 + r() * 0.3) }); }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) if (it.im) { const k = it.h / it.im.height; g.fillStyle = 'rgba(40,50,20,.2)'; g.beginPath(); g.ellipse(it.x, it.y, it.im.width * k * 0.4, it.im.width * k * 0.09, 0, 0, 7); g.fill(); g.drawImage(it.im, it.x - it.im.width * k / 2, it.y - it.h, it.im.width * k, it.h); }
  const bar = visitEl.querySelector('.vbar');
  const home = mkBtn('<img src="assets/icons/home.webp" alt="">Home', 'light', () => { visitEl.remove(); visitEl = null; });
  if (S.giftDay !== dayNum()) {
    bar.append(mkBtn('<img src="assets/icons/gift.webp" alt="">Take a cutting', 'rose', e => {
      const need = neededMap(), want = Object.keys(need).filter(k => need[k] > 0 && S.unlocked.includes(k));
      const sp = want.length ? want[0] : own.filter(x => S.unlocked.includes(x))[0] || 'daisy';
      S.basket[sp] = (S.basket[sp] || 0) + 3; S.giftDay = dayNum(); save(); snd.harvest();
      e.currentTarget.remove(); toast(`${V.name} gave you 3 ${SP[sp].name} stems`); refreshBoard();
    }));
  }
  bar.append(home);
  snd.deliver();
}

// ------------------------------------------------------------------ the order board (DOM)
let lastKeys = '';
function refreshBoard() {
  const b = $('#board'), list = shown();
  const keys = list.map(o => o.k).join(',');
  const fresh = keys !== lastKeys; const old = lastKeys.split(','); lastKeys = keys;
  b.innerHTML = '';
  list.forEach((o, idx) => {
    const ready = canDeliver(o), V = VIL[o.vil];
    const c = document.createElement('div'); c.className = 'ord' + (ready ? ' ready' : '') + (fresh && !old.includes(String(o.k)) ? ' enter' : '');
    c.innerHTML = (o.daily ? '<span class="tag gold">★ Daily</span>' : o.grand ? '<span class="tag">Grand bouquet</span>' : '') +
      `<img class="who" src="assets/stamps/stamp-${V.stamp}.webp" alt="${V.name}"><div class="needs">` +
      Object.entries(o.need).map(([s, n]) => { const h = S.basket[s] || 0; return `<div class="nd${h >= n ? ' ok' : ''}"><img src="${plantSrc(s, 'bloom')}" alt="${SP[s].name}">${Math.min(h, n)}/${n}</div>`; }).join('') +
      `</div><div class="rw"><img src="assets/kit/coin.webp" alt="">${bonus(o.coins)}</div><div class="go">Deliver</div>`;
    c.addEventListener('click', e => { e.stopPropagation(); if (state !== 'play') return; if (canDeliver(o)) deliver(o); else orderSheet(o); });
    b.append(c);
  });
  $('#basket b').textContent = Object.values(S.basket).reduce((a, n) => a + n, 0);
  hud(); toolsPaint();
}
const bonus = c => Math.round(c * (1 + charm() * 0.02));
function orderSheet(o) {
  const V = VIL[o.vil];
  openSheet(V.name, o.daily ? 'Today\'s bouquet: the same order for everyone in Rosewick today.' : o.grand ? 'A grand bouquet: bigger, and paid handsomely.' : 'Would love a bouquet of:', body => {
    const g = document.createElement('div'); g.className = 'grid';
    for (const [s, n] of Object.entries(o.need)) {
      const h = S.basket[s] || 0, d = document.createElement('div'); d.className = 'pk';
      d.innerHTML = `<img src="${plantSrc(s, 'bloom')}" alt=""><b>${SP[s].name}</b><div class="meta">${Math.min(h, n)} of ${n} cut · ⏱ ${fmtGrow(SP[s].grow)}</div>`;
      g.append(d);
    }
    body.append(g);
    const p = document.createElement('p'); p.className = 'sub'; p.style.marginTop = '12px';
    p.innerHTML = `Reward: <img class="coin-i" src="assets/kit/coin.webp" alt=""> <b>${bonus(o.coins)}</b> coins · <b>${o.xp}</b> garden points`; body.append(p);
    if (!o.daily) {
      const r = document.createElement('div'); r.className = 'row';
      r.append(mkBtn('Ask for a different bouquet', 'light', () => { const ix = S.orders.indexOf(S.orders.find(x => x.k === o.k)); if (ix >= 0) { S.orders[ix] = genOrder(S.orderN++); save(); } closeSheet(); refreshBoard(); }));
      body.append(r);
    }
  });
}

// ------------------------------------------------------------------ deliver = a "win"
let state = 'ready', lastDeliver = performance.now(), cardEl = null, lastWin = null;
function deliver(o) {
  if (state !== 'play') return;
  closeSheet(); hidePop();
  for (const [s, n] of Object.entries(o.need)) S.basket[s] -= n;
  const V = VIL[o.vil], coins = bonus(o.coins);
  const firstServe = !S.served[o.vil]; S.served[o.vil] = 1;
  const newStamps = [];
  if (firstServe && !S.stamps.includes(o.vil)) { S.stamps.push(o.vil); newStamps.push(o.vil); }
  S.delivered++;
  if ((S.delivered <= 4 || S.delivered % 2 === 0)) { const nx = STAMPS.find(x => !S.stamps.includes(x)); if (nx) { S.stamps.push(nx); newStamps.push(nx); } }
  let streakNote = '';
  if (o.daily) {
    const t = dayIdx(), last = S.lastDaily ? S.lastDailyIdx : -99, wk = Math.floor((t + 3) / 7);
    if (S.lastDailyIdx === t - 1) S.streak++;
    else if (S.lastDailyIdx === t - 2 && S.freezeWeek !== wk) { S.streak++; S.freezeWeek = wk; streakNote = 'Your weekly streak freeze kept the streak going.'; }
    else if (S.lastDailyIdx !== t) S.streak = 1;
    S.lastDailyIdx = t; S.lastDaily = dayNum(); S.dailyDone = dayNum();
  } else {
    const ix = S.orders.findIndex(x => x.k === o.k); if (ix >= 0) S.orders.splice(ix, 1);
    while (S.orders.length < 3) S.orders.push(genOrder(S.orderN++));
  }
  S.xp += o.xp; let lvlUp = null;
  while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; lvlUp = S.lvl; }
  M.add(coins, o.daily ? 'daily' : 'bouquet');
  const ms = performance.now() - lastDeliver; lastDeliver = performance.now();
  B.submit(1, { ms });
  save();
  state = 'won'; lastWin = { o, coins };
  snd.deliver(); buzz([10, 40, 10]);
  for (let k = 0; k < 6; k++) setTimeout(() => puff(W / 2 + (Math.random() - 0.5) * W * 0.6, H * 0.4, 'petal', 8), k * 80);
  setTimeout(() => showDelivery(o, V, coins, lvlUp, newStamps, streakNote), 380);
}
function showDelivery(o, V, coins, lvlUp, newStamps, streakNote) {
  const say = V.says[(S.delivered + o.vil.length) % V.says.length];
  const unlockNow = lvlUp && SPECIES.filter(s => s.lvl === lvlUp);
  cardEl = document.createElement('div'); cardEl.className = 'card';
  cardEl.innerHTML = `<div class="frame">
    <img src="assets/stamps/stamp-${V.stamp}.webp" alt="" style="width:92px;height:76px;object-fit:contain;margin-top:-62px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25))">
    <h1>${o.daily ? 'Today\'s bouquet!' : 'Bouquet delivered'}</h1>
    <p class="q">“${say}” <span style="font-style:normal;color:#4a4f66">— ${V.name}</span></p>
    <img class="big" src="assets/items/vase-bouquet.webp" alt="">
    <div class="gain"><span><img src="assets/kit/coin.webp" alt=""> <b data-c>+${coins}</b></span><span style="color:var(--sage)">+${o.xp} <small style="font-size:16px">garden pts</small></span></div>
    ${lvlUp ? `<p><b>Garden level ${lvlUp}!</b>${unlockNow && unlockNow.length ? ` ${unlockNow.map(s => s.name).join(', ')} seeds can now be unlocked in the seed tray.` : ''}</p>` : ''}
    ${newStamps.length ? `<p style="display:flex;align-items:center;gap:8px;justify-content:center">${newStamps.map(s => `<img src="assets/stamps/stamp-${VIL[s] ? VIL[s].stamp : s}.webp" alt="" style="width:54px;height:46px;object-fit:contain">`).join('')}<span>New stamp${newStamps.length > 1 ? 's' : ''} for your album</span></p>` : ''}
    ${o.daily ? `<p>Daily streak: <b>${S.streak}</b> day${S.streak === 1 ? '' : 's'}. ${streakNote}</p>` : ''}
    <div class="row" style="margin-top:6px"><button class="btn sage" data-go style="min-width:220px">Lovely</button></div>
    <div class="row" data-offer style="margin-top:2px"></div>
  </div>`;
  document.body.append(cardEl);
  const offer = cardEl.querySelector('[data-offer]');
  if (o.daily) {
    offer.append(mkBtn('<img src="assets/icons/share.webp" alt="">Share', 'light', () => shareDaily(o)));
  } else if (coins >= 15) {
    // one offer only: double the coins (opt-in, says what you get first)
    const b = mkBtn(`<img src="assets/icons/video.webp" alt="">Double to ${coins * 2}`, 'rose', async () => {
      b.disabled = true;
      if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); cardEl && (cardEl.querySelector('[data-c]').textContent = '+' + coins * 2); b.innerHTML = '✓ Doubled'; snd.coin(); }
      else b.disabled = false;
    });
    offer.append(b);
  }
  cardEl.querySelector('[data-go]').addEventListener('click', e => { e.stopPropagation(); closeCard(); });
  cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); });
  cardEl.addEventListener('click', e => { if (e.target === cardEl || e.target.classList.contains('frame') || e.target.tagName === 'P' || e.target.tagName === 'H1' || e.target.classList.contains('big')) closeCard(); });
  setTimeout(() => flyCoins(), 300);
}
async function closeCard() {
  if (!cardEl) return; cardEl.remove(); cardEl = null; state = 'play'; refreshBoard();
  await M.breakAd('level-end', { level: S.delivered });
}
function shareDaily(o) {
  const emo = Object.entries(o.need).map(([s, n]) => SP[s].emoji.repeat(n)).join('');
  const d = new Date();
  const text = `Rosewick Garden 🌿 Today's bouquet, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}\n${emo}\n🔥 ${S.streak}-day streak`;
  const url = location.origin + location.pathname + '?daily=1';
  (async () => { try { if (navigator.share) { await navigator.share({ title: 'Rosewick Garden', text, url }); return; } } catch (e) { return; } try { await navigator.clipboard.writeText(text + '\n' + url); toast('Copied, ready to paste'); } catch (e) {} })();
}

// ------------------------------------------------------------------ HUD + toolbar
function hud() {
  $('#ribbon b').textContent = `Level ${S.lvl}`;
  $('#xpbar i').style.width = Math.min(100, S.xp / xpNeed(S.lvl) * 100) + '%';
}
M.onChange(s => { $('#coins span').textContent = s.coins.toLocaleString(); });
$('#coins span').textContent = M.coins().toLocaleString();
$('#coins').addEventListener('click', e => { e.stopPropagation(); M.shop(); });
$('#gear').addEventListener('click', e => { e.stopPropagation(); settingsSheet(); });
$('#ribbon').addEventListener('click', e => { e.stopPropagation(); toast(`Garden level ${S.lvl}: ${S.xp} of ${xpNeed(S.lvl)} points to the next level`); });
$('#basket').addEventListener('click', e => { e.stopPropagation(); if (state === 'play') basketSheet(); });
document.querySelectorAll('.tb').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); if (state !== 'play') return; snd.tap();
  const t = b.dataset.t;
  if (t !== 'decor' && design) setDesign(false);
  if (t === 'album') albumSheet();
  if (t === 'decor') setDesign(!design);
  if (t === 'shower') shower();
  if (t === 'visit') visitSheet();
  if (t === 'shop') M.shop();
}));
function toolsPaint() {
  const sb = document.querySelector('.tb[data-t=shower]'), ready = showerReady();
  sb.classList.toggle('wait', !ready);
  sb.querySelector('span').textContent = ready ? (S.freeShower ? 'Free rain' : 'Shower') : fmtT((SHOWER_CD - (now() - S.showerAt)) / 1000);
  badge();
}
function badge() {
  const ab = document.querySelector('.tb[data-t=album]'); let bd = ab.querySelector('.badge');
  const n = Object.keys(S.album).length; if (!bd) { bd = document.createElement('i'); bd.className = 'badge'; ab.append(bd); } bd.textContent = n; bd.style.display = n ? '' : 'none';
}
setInterval(() => { if (state === 'play') toolsPaint(); }, 1000);

// ------------------------------------------------------------------ juice helpers
function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2700); }
function floatText(t, x, y) { const d = document.createElement('div'); d.className = 'float'; d.textContent = t; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.append(d); setTimeout(() => d.remove(), 1200); }
function flyImg(src, from, toEl, size = 40) {
  const r = toEl.getBoundingClientRect(), im = document.createElement('img'); im.className = 'fly'; im.src = src; im.style.width = im.style.height = size + 'px';
  im.style.left = (from.x - size / 2) + 'px'; im.style.top = (from.y - size / 2) + 'px'; document.body.append(im);
  requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transform = `translate(${r.left + r.width / 2 - from.x}px,${r.top + r.height / 2 - from.y}px) scale(.6)`; im.style.opacity = '0'; }));
  setTimeout(() => { im.remove(); toEl.animate && toEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260 }); }, 780);
}
function flyCoins() { const to = $('#coins'); for (let k = 0; k < 7; k++) setTimeout(() => { flyImg('assets/kit/coin.webp', { x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.55 }, to, 34); if (k % 2 === 0) snd.coin(); }, k * 70); }

// ------------------------------------------------------------------ start
function startCard() {
  const c = document.createElement('div'); c.className = 'card'; c.id = 'start';
  const bloomsLine = awayBlooms && away > 20 ? `<div class="streak">While you were away, ${awayBlooms} flower${awayBlooms > 1 ? 's' : ''} bloomed 🌸</div>` : S.streak > 1 ? `<div class="streak">🔥 ${S.streak}-day bouquet streak</div>` : '';
  const dl = D.isDaily && dailyOpen() ? (() => { const o = dailyOrder(); return `<div class="streak">Today's bouquet for ${VIL[o.vil].name}: ${Object.entries(o.need).map(([s, n]) => `${n} ${SP[s].name.toLowerCase()}${n > 1 ? 's' : ''}`).join(' & ')}</div>`; })() : '';
  c.innerHTML = `<div class="logo"><small>Welcome to</small><b>Rosewick<br>Garden</b><i>grow · bloom · gather</i></div>${dl}${bloomsLine}<button class="btn sage tapgo" style="min-width:220px">Into the garden</button>`;
  document.body.append(c);
  const go = e => { e && e.stopPropagation(); if (state !== 'ready') return; c.remove(); state = 'play'; B.start(); lastDeliver = performance.now(); musicOn = true; musicTick(); refreshBoard(); if (D.isDaily && dailyOpen()) setTimeout(() => orderSheet(dailyOrder()), 400); };
  c.addEventListener('pointerdown', go);
}
addEventListener('resize', () => { layout(); });
layout(); makePatterns(); refreshBoard(); badge();
startCard();
loadAll().then(() => { makePatterns(); requestAnimationFrame(frame); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastT = performance.now(); } else save(); });
addEventListener('pagehide', () => { S.at = now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} });

// ------------------------------------------------------------------ test hooks + bot (paced like a person)
let botAt = 0;
function bot() {
  const t = performance.now(); if (t - botAt < 900) return; botAt = t;
  if (state !== 'play') return;
  if (visitEl) { visitEl.remove(); visitEl = null; return; }
  if (sheetOpen) { closeSheet(); return; }
  const list = shown(), ready = list.find(canDeliver);
  if (ready) return deliver(ready);
  const bi = S.plots.findIndex(p => p.open && bloomed(p)); if (bi >= 0) return harvest(bi);
  const wi = S.plots.findIndex(p => p.open && thirsty(p)); if (wi >= 0) return water(wi);
  const need = neededMap();
  const growing = {}; for (const p of S.plots) if (p.sp) growing[p.sp] = (growing[p.sp] || 0) + 2;
  const want = SPECIES.map(s => s.id).filter(s => S.unlocked.includes(s) && (need[s] || 0) > (growing[s] || 0));
  const ei = S.plots.findIndex(p => p.open && !p.sp);
  if (ei >= 0 && want.length) return plant(ei, want[0]);
  if (S.plots.some(p => p.sp && !bloomed(p)) && showerReady()) return shower();
  if (ei >= 0 && M.coins() > 40) return plant(ei, S.unlocked[0]);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in a level-1 garden, until the first
// touch, the watering can tips over a thirsty bed (or a ripe bloom is picked into the basket), so a tap on a bed is shown
demo(() => {
  const wi = S.plots.findIndex(p => p.open && p.sp && thirsty(p)); if (wi >= 0) return water(wi);
  const bi = S.plots.findIndex(p => p.open && p.sp && bloomed(p)); if (bi >= 0) return harvest(bi);
  return false;
}, { ready: () => state === 'play' && S.lvl === 1 && !sheetOpen && !visitEl && !cardEl && !design, wait: 1800, every: 1600, max: 2 });
window.__game = {
  get state() { return state; }, get level() { return S.lvl; }, get score() { return S.delivered; }, bot,
  // the shell's autostart: step past the welcome card into the garden (so the first seconds can play themselves)
  autostart() { const c = document.getElementById('start'); if (!c || state !== 'ready') return false; c.dispatchEvent(new PointerEvent('pointerdown')); },
  S, M, shown, deliver, harvest, water, plant, layout,
};
