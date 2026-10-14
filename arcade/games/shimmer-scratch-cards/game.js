// Shimmer — original scratch-card game. Buy a free-play card, scratch the foil with a coin, win the printed prize.
// Honest casino rules: every result is drawn with crypto.getRandomValues against the printed table at purchase,
// odds never change, losing cards are a uniformly random no-win arrangement (no planted near-misses), no real money.
import { THREE, createStage, createUI, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, palette, applyPalette } from './kit/hc.js';
import { daily } from './kit/daily.js';

const NAME = 'Shimmer: Scratch Cards';
const V3 = THREE.Vector3;
const S = createStage({ fov: 42, shadowSize: 5 });
const { scene, camera, sun, hemi, renderer } = S;
sun.position.set(2.5, 5, 9); sun.intensity = 1.35; hemi.intensity = 1.25;
const ui = createUI({ title: 'SHIMMER', hint: 'Pick a card · scratch with the coin', hand: '👆' });
const D = daily('shimmer', ui, { name: NAME });
const save = store('shimmer');

// ---------------------------------------------------------------- fair randomness (outcomes only use this)
const U32 = new Uint32Array(1);
const rand = () => { crypto.getRandomValues(U32); return U32[0] / 4294967296; };
const ri = (n) => Math.floor(rand() * n);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------- the cards and their printed prize tables: [prize, 1 in X]
const CARDS = [
  { id: 'comet', name: 'Comet Cash', cost: 10, rule: 'Match 3 symbols, win that prize', kind: 'match3',
    bg: ['#2a1b6e', '#8b5cff', '#ff7ac6'], title: '#ffd23f', ink: '#ffffff', foil: ['#c9ccd8', '#f4f5fb', '#9da3b8'],
    prizes: [[10, 4], [20, 8], [50, 25], [100, 80], [500, 500], [2000, 5000]] },
  { id: 'garden', name: 'Lucky Garden', cost: 25, rule: '3 in a row, column or diagonal wins', kind: 'lines',
    bg: ['#57cc99', '#c7f9cc', '#ffd6e8'], title: '#ff5d8f', ink: '#1f4e3d', foil: ['#e9b8a8', '#fff0ea', '#c98d7c'],
    prizes: [[25, 4], [50, 5], [100, 20], [250, 150], [1000, 1000], [5000, 20000]] },
  { id: 'tides', name: 'Treasure Tides', cost: 50, rule: 'Match a lucky number,|win the prize below it', kind: 'numbers',
    bg: ['#0582ca', '#4cc9f0', '#ffe0b3'], title: '#ffffff', ink: '#14365c', foil: ['#e8b934', '#fff3b8', '#b7861a'],
    prizes: [[50, 5], [100, 6], [250, 20], [500, 80], [2500, 1000], [10000, 20000]] },
];
for (const c of CARDS) {
  c.winP = c.prizes.reduce((a, [, x]) => a + 1 / x, 0);
  c.rtp = c.prizes.reduce((a, [p, x]) => a + p / x, 0) / c.cost;
}
const CHEAPEST = Math.min(...CARDS.map(c => c.cost));
const START = 100;
const fmt = (n) => n.toLocaleString('en-US');
function drawPrize(card) {                         // fixed odds, decided at purchase
  const u = rand(); let acc = 0;
  for (let t = 0; t < card.prizes.length; t++) { acc += 1 / card.prizes[t][1]; if (u < acc) return t; }
  return -1;
}

// ---------------------------------------------------------------- layouts: uniformly random, conditioned only on the drawn outcome
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function genMatch3(tier) {
  for (;;) {
    const g = Array.from({ length: 9 }, () => ri(6));
    if (tier >= 0) { const at = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3); at.forEach(i => g[i] = tier); }
    const cnt = [0, 0, 0, 0, 0, 0]; g.forEach(s => cnt[s]++);
    const triples = cnt.filter(c => c >= 3).length;
    if (tier < 0 && triples === 0) return { cells: g, win: [] };
    if (tier >= 0 && triples === 1 && cnt[tier] === 3) return { cells: g, win: g.map((s, i) => s === tier ? i : -1).filter(i => i >= 0) };
  }
}
function genLines(tier) {
  for (;;) {
    const g = Array.from({ length: 9 }, () => ri(6));
    let line = null;
    if (tier >= 0) { line = LINES[ri(8)]; line.forEach(i => g[i] = tier); }
    const full = LINES.filter(l => g[l[0]] === g[l[1]] && g[l[1]] === g[l[2]]);
    if (tier < 0 && full.length === 0) return { cells: g, win: [] };
    if (tier >= 0 && full.length === 1) return { cells: g, win: line.slice() };
  }
}
function genNumbers(card, tier) {
  const pool = shuffle(Array.from({ length: 20 }, (_, i) => i + 1));
  const lucky = pool.slice(0, 2), rest = pool.slice(2);
  const yours = rest.slice(0, 6).map(n => ({ n, p: card.prizes[ri(6)][0] }));   // uniform decoy prizes
  let win = [];
  if (tier >= 0) { const k = ri(6); yours[k] = { n: lucky[ri(2)], p: card.prizes[tier][0] }; win = [k]; }
  return { lucky, yours, win };
}
function makeLayout(card, tier) {
  if (card.kind === 'match3') return genMatch3(tier);
  if (card.kind === 'lines') return genLines(tier);
  return genNumbers(card, tier);
}

// ---------------------------------------------------------------- card art (2D canvas → texture on a 3D card)
const W = 640, H = 1000, CW = 3.0, CH = CW * H / W;
const GRID = Array.from({ length: 9 }, (_, i) => ({ x: 62 + (i % 3) * 176, y: 404 + Math.floor(i / 3) * 176, w: 164, h: 164 }));
const LUCKY = [{ x: 176, y: 328, w: 136, h: 136 }, { x: 328, y: 328, w: 136, h: 136 }];
const YOURS = Array.from({ length: 6 }, (_, i) => ({ x: 52 + (i % 3) * 184, y: 552 + Math.floor(i / 3) * 196, w: 168, h: 182 }));
const rectsOf = (card) => card.kind === 'numbers' ? [...LUCKY, ...YOURS] : GRID;
const FONT = '"Baloo 2", system-ui, sans-serif';

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function star(c, x, y, n, ro, rin, rot = -Math.PI / 2) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? rin : ro, a = rot + i * Math.PI / n; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
function petals(c, x, y, n, dist, a, b, fill, stroke, rot = 0) {
  for (let i = 0; i < n; i++) { const t = rot + i * Math.PI * 2 / n; c.beginPath(); c.ellipse(x + Math.cos(t) * dist, y + Math.sin(t) * dist, a, b, t, 0, 7); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 3; c.stroke(); } }
}
function dot(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = fill; c.fill(); }
function radial(c, x, y, r, a, b) { const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

// six original space symbols (Comet Cash) and six garden symbols (Lucky Garden), tier 0 = smallest prize
const SPACE = [
  (c, x, y, s) => { c.save(); c.beginPath(); c.arc(x, y, s * 0.4, 0, 7); c.clip(); c.beginPath(); c.rect(x - s, y - s, 2 * s, 2 * s); c.arc(x + s * 0.2, y - s * 0.12, s * 0.34, 0, 7); c.fillStyle = '#fff1a8'; c.fill('evenodd'); c.restore(); },
  (c, x, y, s) => { star(c, x, y, 5, s * 0.46, s * 0.2); c.fillStyle = radial(c, x, y, s * 0.46, '#fff6b0', '#ffb300'); c.fill(); c.strokeStyle = '#b86e00'; c.lineWidth = s * 0.04; c.lineJoin = 'round'; c.stroke(); },
  (c, x, y, s) => { dot(c, x, y, s * 0.3, radial(c, x, y, s * 0.3, '#ffd3a0', '#ff6b3d')); c.beginPath(); c.ellipse(x, y, s * 0.5, s * 0.14, -0.35, 0, 7); c.strokeStyle = '#ffe9c7'; c.lineWidth = s * 0.07; c.stroke(); c.save(); c.beginPath(); c.rect(x - s, y - s, 2 * s, s * 0.98); c.clip(); dot(c, x, y, s * 0.3, radial(c, x, y, s * 0.3, '#ffd3a0', '#ff6b3d')); c.restore(); },
  (c, x, y, s) => { const g = c.createLinearGradient(x, y, x + s * 0.5, y - s * 0.5); g.addColorStop(0, 'rgba(120,230,255,.95)'); g.addColorStop(1, 'rgba(120,230,255,0)'); c.beginPath(); c.moveTo(x - s * 0.15, y + s * 0.2); c.lineTo(x + s * 0.5, y - s * 0.52); c.lineTo(x + s * 0.18, y + s * 0.0); c.lineTo(x + s * 0.52, y - s * 0.22); c.lineTo(x + s * 0.05, y + s * 0.28); c.closePath(); c.fillStyle = g; c.fill(); dot(c, x - s * 0.08, y + s * 0.16, s * 0.2, radial(c, x - s * 0.08, y + s * 0.16, s * 0.2, '#ffffff', '#36c5f0')); },
  (c, x, y, s) => { c.beginPath(); c.moveTo(x - s * 0.42, y - s * 0.12); c.lineTo(x - s * 0.22, y - s * 0.38); c.lineTo(x + s * 0.22, y - s * 0.38); c.lineTo(x + s * 0.42, y - s * 0.12); c.lineTo(x, y + s * 0.44); c.closePath(); c.fillStyle = radial(c, x, y, s * 0.5, '#e6fdff', '#21b8d8'); c.fill(); c.strokeStyle = '#0d7c97'; c.lineWidth = s * 0.035; c.lineJoin = 'round'; c.stroke(); c.beginPath(); c.moveTo(x - s * 0.42, y - s * 0.12); c.lineTo(x + s * 0.42, y - s * 0.12); c.moveTo(x - s * 0.12, y - s * 0.38); c.lineTo(x, y + s * 0.44); c.lineTo(x + s * 0.12, y - s * 0.38); c.stroke(); },
  (c, x, y, s) => { dot(c, x, y, s * 0.42, 'rgba(255,90,200,.25)'); star(c, x, y, 8, s * 0.48, s * 0.2, 0); c.fillStyle = radial(c, x, y, s * 0.48, '#ffffff', '#ff3fa4'); c.fill(); c.strokeStyle = '#a3005f'; c.lineWidth = s * 0.035; c.stroke(); dot(c, x, y, s * 0.1, '#fff'); },
];
const GARDEN = [
  (c, x, y, s) => { c.strokeStyle = '#2d6a4f'; c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(x, y + s * 0.05); c.quadraticCurveTo(x + s * 0.05, y + s * 0.3, x + s * 0.18, y + s * 0.45); c.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; dot(c, x + Math.cos(a) * s * 0.17, y - s * 0.08 + Math.sin(a) * s * 0.17, s * 0.17, '#40c057'); } dot(c, x, y - s * 0.08, s * 0.06, '#2b8a3e'); },
  (c, x, y, s) => { petals(c, x, y, 11, s * 0.24, s * 0.16, s * 0.07, '#ffffff', '#d9d9e6'); dot(c, x, y, s * 0.14, radial(c, x, y, s * 0.14, '#fff3a0', '#ffb703')); },
  (c, x, y, s) => { c.strokeStyle = '#2d6a4f'; c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + s * 0.46); c.stroke(); c.beginPath(); c.ellipse(x + s * 0.12, y + s * 0.3, s * 0.14, s * 0.05, -0.6, 0, 7); c.fillStyle = '#52b788'; c.fill(); c.beginPath(); c.moveTo(x - s * 0.24, y - s * 0.3); c.lineTo(x - s * 0.12, y - s * 0.14); c.lineTo(x, y - s * 0.34); c.lineTo(x + s * 0.12, y - s * 0.14); c.lineTo(x + s * 0.24, y - s * 0.3); c.quadraticCurveTo(x + s * 0.28, y + s * 0.08, x, y + s * 0.08); c.quadraticCurveTo(x - s * 0.28, y + s * 0.08, x - s * 0.24, y - s * 0.3); c.fillStyle = radial(c, x, y - s * 0.1, s * 0.3, '#ff9eb5', '#e5383b'); c.fill(); },
  (c, x, y, s) => { rr(c, x - s * 0.1, y - s * 0.02, s * 0.2, s * 0.4, s * 0.06); c.fillStyle = '#fff1dc'; c.fill(); c.beginPath(); c.arc(x, y + s * 0.02, s * 0.4, Math.PI, 0); c.quadraticCurveTo(x, y + s * 0.12, x - s * 0.4, y + s * 0.02); c.fillStyle = radial(c, x, y - s * 0.15, s * 0.4, '#ff8a8a', '#d62828'); c.fill(); dot(c, x - s * 0.18, y - s * 0.12, s * 0.06, '#fff'); dot(c, x + s * 0.05, y - s * 0.25, s * 0.07, '#fff'); dot(c, x + s * 0.22, y - s * 0.07, s * 0.05, '#fff'); },
  (c, x, y, s) => { petals(c, x, y, 14, s * 0.3, s * 0.16, s * 0.065, '#ffd23f', '#f4a100'); dot(c, x, y, s * 0.2, radial(c, x, y, s * 0.2, '#a0673a', '#5a3417')); for (let i = 0; i < 7; i++) { const a = i * 0.9; dot(c, x + Math.cos(a) * s * 0.1, y + Math.sin(a) * s * 0.1, s * 0.02, '#e9c46a'); } },
  (c, x, y, s) => { dot(c, x, y, s * 0.46, 'rgba(255,215,64,.28)'); petals(c, x, y, 6, s * 0.22, s * 0.2, s * 0.12, '#ffd23f', '#c98a00', 0.3); petals(c, x, y, 6, s * 0.12, s * 0.12, s * 0.08, '#fff3b0', null, 0.82); dot(c, x, y, s * 0.08, '#ff9f1c'); star(c, x + s * 0.34, y - s * 0.32, 4, s * 0.1, s * 0.03); c.fillStyle = '#fff'; c.fill(); },
];
const SYMS = { comet: SPACE, garden: GARDEN };

function drawArt(c, card, lay, hi = false) {
  c.clearRect(0, 0, W, H);
  rr(c, 0, 0, W, H, 44); const g = c.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, card.bg[0]); g.addColorStop(0.55, card.bg[1]); g.addColorStop(1, card.bg[2]); c.fillStyle = g; c.fill();
  c.save(); rr(c, 0, 0, W, H, 44); c.clip();
  // background motif per design (fixed per card so all cards of a kind look the same)
  let seed = card.cost * 7 + 3; const pr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (card.id === 'comet') for (let i = 0; i < 70; i++) dot(c, pr() * W, pr() * H, 1 + pr() * 3, `rgba(255,255,255,${0.25 + pr() * 0.6})`);
  if (card.id === 'garden') for (let i = 0; i < 26; i++) { c.globalAlpha = 0.18; petals(c, pr() * W, pr() * H, 5, 12, 11, 7, '#ffffff', null, pr() * 3); c.globalAlpha = 1; }
  if (card.id === 'tides') { c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 5; for (let k = 0; k < 14; k++) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, 60 + k * 72 + Math.sin(x / 40 + k) * 9); c.stroke(); } }
  // shine band
  const sh = c.createLinearGradient(0, 0, W, H * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,.16)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
  c.restore();
  rr(c, 14, 14, W - 28, H - 28, 34); c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 5; c.setLineDash([2, 12]); c.lineCap = 'round'; c.stroke(); c.setLineDash([]);
  // title + price ribbon + rule
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `800 86px ${FONT}`; c.lineJoin = 'round';
  c.strokeStyle = 'rgba(30,20,60,.55)'; c.lineWidth = 16; c.strokeText(card.name.toUpperCase(), W / 2, 108, W - 70);
  c.fillStyle = card.title; c.fillText(card.name.toUpperCase(), W / 2, 104, W - 70);
  rr(c, W / 2 - 110, 150, 220, 50, 25); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill();
  c.font = `800 32px ${FONT}`; c.fillStyle = '#2b2d42'; c.fillText(`${card.cost} CHIPS`, W / 2, 177);
  c.font = `800 29px ${FONT}`; c.fillStyle = card.ink;
  const rl = card.rule.split('|'); rl.forEach((l, i) => c.fillText(l, W / 2, 232 + i * 32));
  if (card.kind !== 'numbers') {
    // prize legend
    card.prizes.forEach(([p], t) => {
      const cx = 118 + (t % 3) * 202, cy = 290 + Math.floor(t / 3) * 60;
      rr(c, cx - 90, cy - 26, 180, 52, 26); c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
      SYMS[card.id][t](c, cx - 56, cy, 56);
      c.textAlign = 'left'; c.font = `800 32px ${FONT}`; c.fillStyle = card.id === 'comet' ? '#ffffff' : '#1f4e3d'; c.fillText(fmt(p), cx - 22, cy + 2); c.textAlign = 'center';
    });
    rr(c, 46, 390, W - 92, 548, 30); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill();
    GRID.forEach((r, i) => {
      const win = hi && lay.win.includes(i);
      rr(c, r.x, r.y, r.w, r.h, 22); c.fillStyle = win ? '#fff6c2' : 'rgba(255,255,255,.9)'; c.fill();
      if (lay) SYMS[card.id][lay.cells[i]](c, r.x + r.w / 2, r.y + r.h / 2, 140);
      if (win) glow(c, r);
    });
  } else {
    c.font = `800 26px ${FONT}`; c.fillStyle = '#ffffff'; c.fillText('LUCKY NUMBERS', W / 2, 308);
    rr(c, 150, 318, W - 300, 156, 30); c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
    c.fillStyle = card.ink; c.fillText('YOUR NUMBERS', W / 2, 520);
    rr(c, 38, 538, W - 76, 410, 30); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill();
    const shell = (r, n, sub, win) => {
      rr(c, r.x, r.y, r.w, r.h, 24); c.fillStyle = win ? '#fff6c2' : 'rgba(255,255,255,.92)'; c.fill();
      const cy = sub ? r.y + r.h * 0.4 : r.y + r.h / 2;
      dot(c, r.x + r.w / 2, cy, 52, radial(c, r.x + r.w / 2, cy, 52, '#ffffff', '#ffd6a5'));
      c.font = `800 60px ${FONT}`; c.fillStyle = '#14365c'; c.fillText(n, r.x + r.w / 2, cy + 4);
      if (sub) { c.font = `800 30px ${FONT}`; c.fillStyle = '#0582ca'; c.fillText(fmt(sub), r.x + r.w / 2, r.y + r.h - 26); }
      if (win) glow(c, r);
    };
    if (lay) {
      LUCKY.forEach((r, i) => shell(r, lay.lucky[i], 0, hi && lay.win.length && lay.yours[lay.win[0]].n === lay.lucky[i]));
      YOURS.forEach((r, i) => shell(r, lay.yours[i].n, lay.yours[i].p, hi && lay.win.includes(i)));
    }
  }
  c.font = `600 21px ${FONT}`; c.fillStyle = 'rgba(255,255,255,.85)'; c.fillText('Free-play chips · no cash value', W / 2, H - 34);
}
function glow(c, r) { c.save(); c.shadowColor = '#ffb703'; c.shadowBlur = 26; rr(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 24); c.strokeStyle = '#ffb703'; c.lineWidth = 9; c.stroke(); c.restore(); }

function drawFoil(c, card) {
  c.clearRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  for (const r of rectsOf(card)) {
    const g = c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    g.addColorStop(0, card.foil[0]); g.addColorStop(0.35, card.foil[1]); g.addColorStop(0.6, card.foil[0]); g.addColorStop(0.85, card.foil[1]); g.addColorStop(1, card.foil[2]);
    rr(c, r.x, r.y, r.w, r.h, 22); c.fillStyle = g; c.fill();
    c.save(); rr(c, r.x, r.y, r.w, r.h, 22); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
    for (let k = -r.h; k < r.w; k += 14) { c.beginPath(); c.moveTo(r.x + k, r.y + r.h); c.lineTo(r.x + k + r.h, r.y); c.stroke(); }
    c.restore();
    star(c, r.x + r.w / 2, r.y + r.h / 2, 4, Math.min(r.w, r.h) * 0.2, Math.min(r.w, r.h) * 0.06, 0);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
    rr(c, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 20); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 3; c.stroke();
  }
}

// ---------------------------------------------------------------- 3D card, coin, decor
const artC = document.createElement('canvas'); artC.width = W; artC.height = H; const AX = artC.getContext('2d');
const foilC = document.createElement('canvas'); foilC.width = W; foilC.height = H; const FX = foilC.getContext('2d');
const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const artTex = tex(artC), foilTex = tex(foilC);
const sheenC = document.createElement('canvas'); sheenC.width = 256; sheenC.height = 4;
{ const c = sheenC.getContext('2d'), g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.58, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 4); }
const sheenTex = new THREE.CanvasTexture(sheenC); sheenTex.wrapS = sheenTex.wrapT = THREE.RepeatWrapping; sheenTex.rotation = 0.6; sheenTex.repeat.set(1.4, 1);

const card = new THREE.Group(); scene.add(card);
const body = new THREE.Mesh(rounded(CW + 0.1, CH + 0.1, 0.07, 0.1), mat('#ffffff', { roughness: 0.4 })); body.castShadow = true; card.add(body);
const artMat = new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.42, metalness: 0.0, transparent: true });
const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), artMat); artPlane.position.z = 0.037; artPlane.receiveShadow = true; card.add(artPlane);
const foilMat = new THREE.MeshStandardMaterial({ map: foilTex, roughness: 0.28, metalness: 0.35, transparent: true, depthWrite: false, emissive: '#ffffff', emissiveIntensity: 0.08, emissiveMap: foilTex });
const foilPlane = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), foilMat); foilPlane.position.z = 0.039; foilPlane.receiveShadow = true; card.add(foilPlane);
const sheenMat = new THREE.MeshBasicMaterial({ map: sheenTex, alphaMap: foilTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
const sheen = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), sheenMat); sheen.position.z = 0.04; card.add(sheen);

// the scratching coin: our own design (gold disc, ridged rim, four-point star)
const coin = new THREE.Group(); card.add(coin);
{
  const gold = glossy('#ffc93c', { metalness: 0.55, roughness: 0.28, emissive: '#6b4300', emissiveIntensity: 0.25 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 44), gold); disc.rotation.x = Math.PI / 2; disc.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 10, 44), glossy('#ffb000', { metalness: 0.6, roughness: 0.25 }));
  rim.position.z = 0.035;
  const sh = new THREE.Shape(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.06 : 0.19, a = i * Math.PI / 4 - Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const st = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), glossy('#fff1a8', { metalness: 0.4, roughness: 0.25 }));
  st.position.z = 0.035;
  coin.add(disc, rim, st); coin.scale.setScalar(0.9);
}
const COIN_REST = new V3(CW / 2 - 0.15, -CH / 2 + 0.2, 0.32);
coin.position.copy(COIN_REST);
let coinTarget = COIN_REST.clone();

const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16, depthWrite: false }));
shadowPlane.position.z = -0.5; shadowPlane.receiveShadow = true; scene.add(shadowPlane);

// floating background chips + sparkles (instanced, behind the card)
const DEC_N = 22;
const decor = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 28), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }), DEC_N);
const decorD = [], dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler();
for (let i = 0; i < DEC_N; i++) {
  const side = i % 2 ? 1 : -1;
  decorD.push({ x: side * (2.6 + Math.random() * 2.6), y: -5 + Math.random() * 10, z: -2.5 - Math.random() * 3, s: 0.45 + Math.random() * 0.5, r: Math.random() * 6, v: 0.15 + Math.random() * 0.25 });
}
scene.add(decor);
function decorColors(p) { const cols = [p.a, p.b, '#ffffff', '#ffd23f']; for (let i = 0; i < DEC_N; i++) decor.setColorAt(i, new THREE.Color(cols[i % cols.length])); decor.instanceColor.needsUpdate = true; }

// ---------------------------------------------------------------- HUD (odds button, shop tray, reveal)
const css = document.createElement('style'); css.textContent = `
.hc-score{display:flex;align-items:center;justify-content:center;gap:10px}
.hc-score::before{content:'';width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 50% 50%,#fff 0 28%,#ffd23f 29% 52%,#fff 53% 60%,#ffb000 61%);box-shadow:0 4px 0 rgba(0,0,0,.14)}
.hc-pop{-webkit-text-stroke:6px rgba(43,45,66,.7);paint-order:stroke fill}
.hc-card h1{-webkit-text-stroke:3px rgba(43,45,66,.2);paint-order:stroke fill;letter-spacing:1px}
.sc-foot{position:absolute;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));font-size:14px;font-weight:600;opacity:.75;text-align:center}
.sc-odds{position:fixed;left:12px;top:calc(62px + env(safe-area-inset-top));z-index:11;font:inherit;font-weight:800;font-size:15px;color:#2b2d42;background:rgba(255,255,255,.9);border:0;border-radius:20px;padding:5px 14px 4px;box-shadow:0 4px 0 rgba(0,0,0,.12);cursor:pointer}
.sc-shop{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px;z-index:5;padding:0 10px;transition:opacity .2s}
.sc-tile{flex:0 1 120px;min-width:0;display:flex;align-items:center;gap:7px;padding:7px 8px 7px 9px;border:0;border-radius:18px;background:rgba(255,255,255,.92);box-shadow:0 5px 0 rgba(0,0,0,.13),0 10px 22px rgba(0,0,0,.08);font:inherit;color:#2b2d42;cursor:pointer;text-align:left;transition:transform .15s,opacity .2s,filter .2s}
.sc-tile img{width:40px;height:62px;border-radius:6px;box-shadow:0 3px 6px rgba(0,0,0,.22);transform:rotate(-5deg);flex:none}
.sc-tile b{display:flex;align-items:center;gap:4px;font-size:23px;line-height:1;font-weight:800;color:var(--ui)}
.sc-tile b::before{content:'';width:14px;height:14px;border-radius:50%;background:radial-gradient(circle,#fff 0 30%,#ffd23f 31% 60%,#ffb000 61%)}
.sc-tile span{display:block;font-size:13px;line-height:1.05;font-weight:800;opacity:.72;margin-top:3px}
.sc-tile.off{opacity:.45;filter:grayscale(.7)}
.sc-tile.pick{animation:scbob 1s ease-in-out infinite}
@keyframes scbob{50%{transform:translateY(-5px)}}
.sc-tile:active{transform:translateY(3px)}
.sc-shop.busy .sc-tile{opacity:.25;pointer-events:none;animation:none}
.sc-reveal{position:fixed;left:50%;bottom:calc(36px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:6;font:inherit;font-weight:800;font-size:19px;color:#fff;background:var(--ui);border:0;border-radius:30px;padding:8px 26px 6px;box-shadow:0 5px 0 rgba(0,0,0,.18);cursor:pointer;white-space:nowrap}
.sc-panel{position:fixed;inset:0;z-index:30;background:rgba(20,18,40,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(20px + env(safe-area-inset-top)) 14px 30px}
.sc-sheet{width:100%;max-width:440px;background:#fff;color:#2b2d42;border-radius:24px;padding:16px 16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.25)}
.sc-sheet h2{margin:0 0 2px;font-size:28px;line-height:1.1}
.sc-sheet h3{margin:14px 0 4px;font-size:19px;display:flex;justify-content:space-between}
.sc-sheet h3 small{font-size:14px;opacity:.7}
.sc-sheet p{margin:4px 0;font-size:14px;line-height:1.3;font-weight:600;opacity:.8}
.sc-sheet table{width:100%;border-collapse:collapse;font-size:15px;font-weight:600}
.sc-sheet td{padding:3px 4px;border-bottom:1px solid #eee}
.sc-sheet td:nth-child(2),.sc-sheet td:nth-child(3){text-align:right}
.sc-sheet tr.t td{font-weight:800;border:0;color:var(--ui)}
.sc-sheet button{margin-top:14px;width:100%}
`; document.head.appendChild(css);
const H_ = (h, parent = document.body) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; parent.appendChild(e); return e; };
H_('<div class="sc-foot">Free play · no real money</div>', ui.els.start); ui.els.start.classList.add('dim');
{ const p = document.createElement('p'); p.textContent = 'Scratch Cards · fair odds'; ui.els.start.querySelector('h1').after(p); }
const oddsBtn = H_('<button class="sc-odds">Odds</button>');
const shop = H_('<div class="sc-shop"></div>');
const tiles = CARDS.map((c, i) => { const b = H_(`<button class="sc-tile"><img alt=""><div><b>${c.cost}</b><span>${c.name}</span></div></button>`, shop); b.addEventListener('pointerdown', e => { e.stopPropagation(); buy(i); }); return b; });
const revealBtn = H_('<button class="sc-reveal hc-hidden">Reveal all</button>');
revealBtn.addEventListener('pointerdown', e => { e.stopPropagation(); reveal(); });
const pct = (x) => (100 / x < 1 ? (100 / x).toFixed(2) : (100 / x).toFixed(1)) + '%';
const panel = H_(`<div class="sc-panel hc-hidden"><div class="sc-sheet"><h2>Odds &amp; prizes</h2>
<p>Every card's result is drawn when you buy it with your browser's cryptographic random generator, against the printed table below. Odds are fixed: never changed per player, session or streak. Losing cards are a random no-win layout, never a planted near-miss. Free-play chips only: no real money, nothing to buy.</p>
${CARDS.map(c => `<h3>${c.name}<small>${c.cost} chips</small></h3><table>
<tr><td><b>Prize</b></td><td><b>Odds</b></td><td><b>Chance</b></td></tr>
${c.prizes.map(([p, x]) => `<tr><td>${fmt(p)}</td><td>1 in ${fmt(x)}</td><td>${pct(x)}</td></tr>`).join('')}
<tr class="t"><td>Any prize</td><td>1 in ${(1 / c.winP).toFixed(2)}</td><td>${(c.winP * 100).toFixed(1)}%</td></tr>
<tr class="t"><td>Return to player</td><td></td><td>${(c.rtp * 100).toFixed(1)}%</td></tr></table>`).join('')}
<p style="margin-top:10px">RTP = sum of (prize × chance) ÷ card price, computed from the table above.</p>
<button class="hc-btn">Close</button></div></div>`);
oddsBtn.addEventListener('pointerdown', e => { e.stopPropagation(); panel.classList.remove('hc-hidden'); sfx.tap(); });
panel.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === panel || e.target.tagName === 'BUTTON') panel.classList.add('hc-hidden'); });

function buildThumbs() {
  const big = document.createElement('canvas'); big.width = W; big.height = H; const bc = big.getContext('2d');
  const sm = document.createElement('canvas'); sm.width = 128; sm.height = 200; const sc = sm.getContext('2d');
  CARDS.forEach((c, i) => {
    drawArt(bc, c, null); sc.clearRect(0, 0, 128, 200); sc.drawImage(big, 0, 0, 128, 200);
    drawFoil(bc, c); sc.drawImage(big, 0, 0, 128, 200);
    tiles[i].querySelector('img').src = sm.toDataURL();
  });
}

// ---------------------------------------------------------------- scratching
const BR = 38;                                       // brush radius (canvas px)
const brush = document.createElement('canvas'); brush.width = brush.height = BR * 2;
{ const c = brush.getContext('2d'), g = c.createRadialGradient(BR, BR, 0, BR, BR, BR); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.62, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, BR * 2, BR * 2); }
let cells = [], cov = null, covN = 0, last = null, foilDirty = false, lastFx = 0;
function resetCoverage(cardDef) {
  cells = [];
  for (const r of rectsOf(cardDef)) for (let y = r.y + 6; y < r.y + r.h; y += 14) for (let x = r.x + 6; x < r.x + r.w; x += 14) cells.push(x, y);
  cov = new Uint8Array(cells.length / 2); covN = 0;
}
function stamp(x, y) {
  FX.drawImage(brush, x - BR, y - BR);
  const r2 = (BR * 0.85) ** 2;
  for (let i = 0; i < cov.length; i++) if (!cov[i]) { const dx = cells[i * 2] - x, dy = cells[i * 2 + 1] - y; if (dx * dx + dy * dy < r2) { cov[i] = 1; covN++; } }
}
/** the one scratch path: both the player's pointer and the bot go through here (canvas px) */
function scratchTo(x, y, fresh) {
  if (phase !== 'scratch') return;
  FX.globalCompositeOperation = 'destination-out';
  if (fresh || !last) stamp(x, y);
  else { const d = Math.hypot(x - last.x, y - last.y), n = Math.max(1, Math.ceil(d / 9)); for (let k = 1; k <= n; k++) stamp(last.x + (x - last.x) * k / n, last.y + (y - last.y) * k / n); }
  FX.globalCompositeOperation = 'source-over';
  const moved = last ? Math.hypot(x - last.x, y - last.y) : 0;
  last = { x, y }; foilDirty = true;
  coinTarget.set((x / W - 0.5) * CW, (0.5 - y / H) * CH, 0.2);
  const now = performance.now();
  if (now - lastFx > 55 && (moved > 3 || fresh)) {
    lastFx = now; scratchSound(); if (Math.random() < 0.35) buzz(4);
    const wp = coin.getWorldPosition(new V3()); wp.z += 0.05;
    burst(scene, wp, cur ? cur.c.foil : ['#ddd'], 3, { speed: 0.04, up: 0.03, size: 0.32, gravity: 0.004 });
  }
  if (cov && covN / cov.length >= 0.6) reveal();
}
// scratch noise: short band-passed white-noise ticks (our own synth)
let AC = null, NOISE = null;
function scratchSound() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    if (!NOISE) { NOISE = AC.createBuffer(1, AC.sampleRate * 0.1, AC.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), n = AC.currentTime;
    s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 2600; f.Q.value = 0.9;
    g.gain.setValueAtTime(0.13, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.08);
    s.connect(f); f.connect(g); g.connect(AC.destination); s.start(n); s.stop(n + 0.09);
  } catch (e) {}
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hitCard(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(foilPlane)[0]; return h && h.uv ? { x: h.uv.x * W, y: (1 - h.uv.y) * H } : null;
}
let scratching = false, swayX = 0, swayY = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  const p = hitCard(e);
  if (phase === 'scratch' && p) { scratching = true; last = null; scratchTo(p.x, p.y, true); }
  else if ((phase === 'shop') && p) { ui.pop('Pick a card below', '#fff', 28, 74); tiles.forEach(t => t.classList.add('pick')); }
});
addEventListener('pointermove', e => {
  swayX = e.clientX / innerWidth - 0.5; swayY = e.clientY / innerHeight - 0.5;
  if (!scratching) return; const p = hitCard(e); if (p) scratchTo(p.x, p.y, false); else last = null;
});
addEventListener('pointerup', () => { scratching = false; last = null; });

// ---------------------------------------------------------------- game state
let level = save.get('level', 1), best = save.get('best', 0);
let state = 'ready', phase = 'shop', stack = START, shown = START, tgt = 130, cur = null, beatenShown = false;
let readyK = 1, animT = 0, hadCard = false, swapped = false, resultT = 0, checked = false, shake = 0, cardSpin = 0, tickT = 0;
const flyers = [];
const targetFor = (l) => D.seed ? 100 + 30 * (2 + D.seed % 4) : Math.min(100 + 30 * l, 400);

function refreshShop() {
  const busy = phase !== 'shop' || state !== 'play';
  shop.classList.toggle('busy', busy && state === 'play' && phase !== 'result');
  tiles.forEach((t, i) => t.classList.toggle('off', stack < CARDS[i].cost));
  revealBtn.classList.toggle('hc-hidden', !(state === 'play' && phase === 'scratch'));
  shop.style.opacity = state === 'ready' ? 0 : 1;
}
function newLevel() {
  stack = START; shown = START; tgt = targetFor(level); beatenShown = false; checked = false;
  const p = palette(level); applyPalette(p); decorColors(p);
  ui.levels(level); ui.sub(D.seed ? `Daily · goal ${tgt} chips` : `Goal: ${tgt} chips`); ui.score(stack); ui.progress(stack / tgt);
  phase = 'shop'; cur = null; refreshShop();
}
function showIdleCard(c) { drawArt(AX, c, null); drawFoil(FX, c); artTex.needsUpdate = true; foilTex.needsUpdate = true; foilMat.opacity = 1; sheenMat.opacity = 0.55; }

function buy(i) {
  const c = CARDS[i];
  if (state !== 'play' || phase !== 'shop') return false;
  if (stack < c.cost) { ui.pop(`Need ${c.cost} chips`, '#fff', 26, 74); sfx.bounce(); return false; }
  stack -= c.cost; shown = Math.min(shown, stack + 0); sfx.coin(); buzz(12);
  const tier = drawPrize(c);
  cur = { c, tier, prize: tier >= 0 ? c.prizes[tier][0] : 0, lay: makeLayout(c, tier) };
  tiles.forEach(t => t.classList.remove('pick'));
  phase = 'enter'; animT = 0; swapped = false; hadCard = true; botPath = null; botI = 0;
  ui.score(stack); ui.progress(stack / tgt); refreshShop();
  return true;
}
function reveal() {
  if (phase !== 'scratch') return;
  phase = 'reveal'; animT = 0; scratching = false; refreshShop(); sfx.pick(3);
}
function resolve() {
  phase = 'result'; resultT = 0; checked = false;
  drawArt(AX, cur.c, cur.lay, true); artTex.needsUpdate = true;
  const center = card.localToWorld(new V3(0, 0, 0.3));
  if (cur.prize > 0) {
    stack += cur.prize;
    const big = cur.prize >= cur.c.cost * 10;
    ui.pop(big ? `BIG WIN ${fmt(cur.prize)}!` : `WIN ${fmt(cur.prize)}!`, '#ffd23f', big ? 52 : 46, 44);
    ui.flash(big ? 0.85 : 0.45); confetti(scene, center, big ? 150 : 60); sfx.win(); buzz(big ? [40, 40, 90] : [25, 30, 25]);
    shake = big ? 1 : 0.35; cardSpin = big ? 1 : 0.4;
    const n = Math.min(26, 5 + Math.round(cur.prize / cur.c.cost) * 2);
    for (let k = 0; k < n; k++) spawnFlyer(k * 0.045);
    if (big) setTimeout(() => { confetti(scene, center.clone().add(new V3(-1, 1, 0)), 90); confetti(scene, center.clone().add(new V3(1, 1, 0)), 90); sfx.win(); }, 380);
    if (D.beaten(stack) && !beatenShown) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#ffd23f', 48, 40); confetti(scene, center, 80); }, 700); }
  } else {
    ui.pop('No win', '#ffffff', 40, 44); tone(330, 0.16, 'triangle', 0.08, 0.8); setTimeout(() => tone(262, 0.2, 'triangle', 0.07, 0.85), 120);
  }
  refreshShop();
}
function checkEnd() {
  checked = true;
  if (stack >= tgt) {
    state = 'won'; best = Math.max(best, stack); save.set('best', best);
    const lv = level; level++; save.set('level', level);
    D.won(stack);
    ui.win(lv, `Turned ${START} into ${fmt(stack)} chips`);
    confetti(scene, new V3(0, 1, 1), 100); refreshShop();
  } else if (stack < CHEAPEST) {
    state = 'lost'; sfx.fail(); buzz([40, 30, 60]);
    ui.lose('OUT OF CHIPS', `Goal was ${tgt} · retry with a fresh ${START}`); refreshShop();
  } else { phase = 'shop'; refreshShop(); }
}

const chipGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24);
const chipMats = ['#ffd23f', '#ff5d8f', '#3a86ff', '#ffffff'].map(c => glossy(c, { metalness: 0.2 }));
function spawnFlyer(delay) {
  const m = new THREE.Mesh(chipGeo, chipMats[flyers.length % chipMats.length]); m.visible = false; scene.add(m);
  const from = card.localToWorld(new V3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2.5, 0.4));
  flyers.push({ m, from, t: -delay, rx: Math.random() * 6 });
}
function scoreWorld() {
  const v = new V3(0, 0.83, 0.5).unproject(camera), dir = v.sub(camera.position).normalize();
  const k = (1.2 - camera.position.z) / dir.z; return camera.position.clone().addScaledVector(dir, k);
}

ui.onTap(which => {
  if (which === 'start') { state = 'play'; newLevel(); sfx.tap(); }
  else { newLevel(); state = 'play'; refreshShop(); }
});

// ---------------------------------------------------------------- camera fit (card fills the space between HUD and tray)
function fit() {
  const asp = innerWidth / innerHeight, vf = Math.tan(camera.fov * Math.PI / 360) * 2;
  const needH = Math.max((CH + 0.1) / 0.6, (CW + 0.1) / (0.84 * asp));
  const d = needH / vf;
  camera.position.set(0, -0.12 * (needH / 8), d); camera.lookAt(0, -0.12 * (needH / 8) + 0.0, 0);
  card.userData.y = needH * 0.012;
  return needH;
}
let viewH = fit(); addEventListener('resize', () => { S.resize(); viewH = fit(); });

// ---------------------------------------------------------------- loop
const easeOut = (k) => 1 - Math.pow(1 - k, 3), easeBack = (k) => { const c1 = 1.5; return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
loop((dt, t) => {
  const dts = dt / 60;
  // card swap animation: old card flies out right, new one flips in from below
  let px = 0, py = card.userData.y || 0, rz = 0, ry = 0;
  if (phase === 'enter') {
    animT += dts;
    const OUT = hadCard && cur ? 0.22 : 0;
    if (animT < OUT && swapped === false && foilMat.opacity !== undefined) { const k = animT / OUT; px = easeOut(k) * 6; rz = -k * 0.5; }
    else {
      if (!swapped) { swapped = true; drawArt(AX, cur.c, cur.lay); drawFoil(FX, cur.c); artTex.needsUpdate = true; foilTex.needsUpdate = true; foilMat.opacity = 1; sheenMat.opacity = 0.55; resetCoverage(cur.c); last = null; sfx.pick(1); }
      const k = Math.min(1, (animT - OUT) / 0.42); py += (1 - easeBack(k)) * -8; ry = (1 - easeOut(k)) * Math.PI * 1.0; rz = (1 - easeOut(k)) * 0.3;
      if (k >= 1) { phase = 'scratch'; refreshShop(); if (!save.get('taught', 0)) { save.set('taught', 1); ui.pop('Scratch with the coin!', '#fff', 28, 74); } }
    }
  }
  if (phase === 'reveal') {
    animT += dts; const k = Math.min(1, animT / 0.35);
    foilMat.opacity = 1 - k; sheenMat.opacity = 0.55 * (1 - k);
    if (k >= 1) resolve();
  }
  if (phase === 'result') { resultT += dts; if (!checked && resultT > 0.7 && shown >= stack - 0.5) checkEnd(); }
  // card idle sway + win spin + shake
  cardSpin = Math.max(0, cardSpin - dts * 1.6);
  shake = Math.max(0, shake - dts * 2);
  const rs = state === 'ready' ? 1 : 0; readyK += (rs - readyK) * Math.min(1, 0.1 * dt); card.scale.setScalar(1 - 0.3 * readyK); py -= 0.085 * viewH * readyK;
  card.position.set(px + (Math.random() - 0.5) * 0.08 * shake, py + Math.sin(t * 1.3) * 0.03 + (Math.random() - 0.5) * 0.08 * shake, 0);
  card.rotation.set(-0.08 + swayY * 0.06 + Math.sin(t * 0.9) * 0.015, ry + swayX * 0.12 + Math.sin(t * 0.7) * 0.03 + Math.sin(cardSpin * Math.PI * 2) * 0.12 * cardSpin, rz);
  // coin: glides to the scratch point, leans while working, rests in the corner otherwise
  const working = phase === 'scratch';
  if (!working) coinTarget.copy(COIN_REST).setY(COIN_REST.y + Math.sin(t * 3) * 0.06);
  coin.position.lerp(coinTarget, Math.min(1, (working ? 0.45 : 0.12) * dt));
  coin.visible = phase !== 'enter' && phase !== 'reveal' && state === 'play' || state === 'ready';
  coin.rotation.set(working ? -0.55 : -0.25, working ? 0.35 : Math.sin(t * 2) * 0.4, working ? Math.sin(t * 20) * 0.08 : 0.2);
  if (foilDirty) { foilTex.needsUpdate = true; foilDirty = false; }
  sheenTex.offset.x = (t * 0.25) % 1;
  // chip roll-up + flying chips
  if (shown !== stack) {
    const d = stack - shown; shown = Math.abs(d) < 0.6 ? stack : shown + d * Math.min(1, 0.08 * dt) + Math.sign(d) * 0.3;
    if (d > 0) { tickT -= dts; if (tickT <= 0) { tickT = 0.07; tone(880 + Math.random() * 200, 0.04, 'square', 0.04, 1.2); } }
    ui.score(Math.round(shown)); ui.progress(shown / tgt);
  }
  const sw = flyers.length ? scoreWorld() : null;
  for (const f of flyers) {
    f.t += dts; if (f.t < 0) continue; f.m.visible = true;
    const k = Math.min(1, f.t / 0.6), e = k * k;
    f.m.position.lerpVectors(f.from, sw, e); f.m.position.x += Math.sin(k * Math.PI) * (f.from.x > 0 ? 0.8 : -0.8); f.m.position.z += Math.sin(k * Math.PI) * 1.2;
    f.m.rotation.set(f.rx + t * 8, t * 5, 0); f.m.scale.setScalar(1 - k * 0.5);
    if (k >= 1) { f.done = true; scene.remove(f.m); }
  }
  for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].done) flyers.splice(i, 1);
  // background chips drift
  for (let i = 0; i < DEC_N; i++) {
    const o = decorD[i]; let y = o.y + t * o.v * 0.6; y = ((y + 6) % 12 + 12) % 12 - 6;
    de.set(o.r + t * o.v, o.r * 0.5 + t * o.v * 0.7, 0); dq.setFromEuler(de);
    dm.compose(new V3(o.x, y * (viewH / 9), o.z), dq, new V3(o.s, o.s, o.s)); decor.setMatrixAt(i, dm);
  }
  decor.instanceMatrix.needsUpdate = true;
  sun.target.position.set(0, 0, 0);
});

showIdleCard(CARDS[0]);
decorColors(palette(level)); applyPalette(palette(level)); ui.levels(level); ui.score(START); ui.sub('');
buildThumbs(); refreshShop();
if (document.fonts && document.fonts.load) document.fonts.load(`800 80px ${FONT}`).then(() => { buildThumbs(); if (cur && phase !== 'enter') { drawArt(AX, cur.c, cur.lay, phase === 'result'); artTex.needsUpdate = true; } else if (!cur) showIdleCard(CARDS[0]); }).catch(() => {});
ui.start();

// ---------------------------------------------------------------- test hooks
let botPath = null, botI = 0;
function makeBotPath(c) {
  const pts = [];
  for (const r of rectsOf(c)) {
    let dir = 1, first = true;
    for (let y = r.y + 26; y < r.y + r.h; y += 44) {
      const xs = []; for (let x = r.x + 20; x <= r.x + r.w - 20; x += 30) xs.push(x);
      if (dir < 0) xs.reverse(); dir = -dir;
      for (const x of xs) { pts.push({ x, y, fresh: first }); first = false; }
    }
  }
  return pts;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return stack; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'shop') { let pick = -1; CARDS.forEach((c, i) => { if (stack >= c.cost) pick = i; }); if (pick >= 0) buy(pick); return; }
    if (phase === 'scratch') {
      if (!botPath) { botPath = makeBotPath(cur.c); botI = 0; }
      for (let k = 0; k < 26 && botI < botPath.length && phase === 'scratch'; k++) { const p = botPath[botI++]; scratchTo(p.x, p.y, p.fresh); }
      if (botI >= botPath.length) reveal();
    }
  },
};
