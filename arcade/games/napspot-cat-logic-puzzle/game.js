// Napspot — a calm cat logic puzzle. Every colour patch needs exactly one napping cat; one cat per row and column,
// and cats never touch, not even at the corners. Tap once for ✕, twice for a cat; drag to cross out many cells.
// Puzzles are generated (seeded) and only kept when our step-by-step logic solver can finish them without guessing.
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp } from './puzzle.js';
import { generate, solve, step, groupsOf, blocks, UNK, NO, CAT } from './napgen.js';

const REG = ['#f6a5b6', '#ffd27a', '#a6dba0', '#9fc9f3', '#cdb6f2', '#ffb58e', '#8fdcd2', '#e9d4a6', '#e3a8d2'];
const DARK = ['#d9637f', '#d9a12e', '#5ea95a', '#4f8fd0', '#8f6fd1', '#e07a48', '#3aa898', '#b8995a', '#b9629f'];
const FUR = [
  { fur: '#f2a65a', ear: '#ffc9b0', ink: '#5a3418', stripe: '#d77f2f', eye: '#3b2a1c' },   // ginger tabby
  { fur: '#a7afbd', ear: '#ffc4c8', ink: '#3b3f4c', stripe: '#8b93a3', eye: '#26303b' },   // grey
  { fur: '#3c3a46', ear: '#e3a1b3', ink: '#1d1c24', stripe: null, eye: '#f2d65a', light: true }, // black, golden eyes
  { fur: '#fbf6ee', ear: '#ffc4c8', ink: '#6b5a52', stripe: null, eye: '#4a90c8', patch: '#e8b27a' }, // white with patch
  { fur: '#e9d2ad', ear: '#f7b9b0', ink: '#5e4630', stripe: null, eye: '#3d2c1e', mask: '#7a5a43' }, // siamese
  { fur: '#c98d5c', ear: '#ffc9b0', ink: '#4a2c17', stripe: '#a86a3b', eye: '#2f2216' },   // brown tabby
];

let N = 5, reg = [], sol = [], st = [], anim = new Map(), shake = new Map(), conf = new Set(), drag = null, hintCell = -1, hintAt = 0, wonAt = 0, G, BL, geo = { x: 0, y: 0, s: 40 };
const B = board({ game: 'napspot', label: 'Puzzle points', limits: { maxRun: 1500, maxPerSec: 100 }, mode: 'sum' });
const P = shell({
  B,
  key: 'napspot', name: 'Napspot: Cat Logic Puzzle', brand: 'Napspot', kicker: 'cat logic puzzle', accent: '#e0708c', ink: '#3a2f45',
  bg: ['#fff4ea', '#f6dfe6'], winWord: 'Purrfect!', dailyLevel: 12,
  build(level, seed, fk) {
    const p = generate(level, seed, fk, rngf) || generate(1, seed + 1, 1, rngf);
    N = p.N; reg = p.reg; sol = p.sol; st = new Array(N * N).fill(UNK); anim = new Map(); shake = new Map(); conf = new Set(); hintCell = -1; wonAt = 0;
    G = groupsOf(N, reg); BL = []; for (let c = 0; c < N * N; c++) BL.push(blocks(N, reg, c));
    return { label: `${N} × ${N} · ${['', 'gentle', 'easy', 'tricky', 'clever', 'expert'][p.hard + 1] || 'tricky'}`, sizeKey: 'n' + N, cells: N * N };
  },
  layout(a) {
    const s = Math.floor(Math.min(a.w, a.h - 90, 470) / N);
    geo = { s, x: Math.round(a.x + (a.w - s * N) / 2), y: Math.round(a.y + Math.max(8, (a.h - 60 - s * N) * 0.5)) };
  },
  snapshot: () => st.slice(),
  restore(s) { st = s; refresh(); },
  isEmpty: () => st.every(v => v === UNK),
  clear() { st = new Array(N * N).fill(UNK); refresh(); },
  hint() {
    // 1) a wrong mark is the most useful thing to point out
    for (let c = 0; c < N * N; c++) if (st[c] !== UNK && st[c] !== sol[c]) { P.push(); set(c, sol[c]); flagHint(c); P.ui.pop(sol[c] === CAT ? 'A cat naps here' : 'No cat here', '#fff', 24, 40); return true; }
    // 2) otherwise run the logic from what's on the board until it places the next cat
    const t = st.slice();
    for (let guard = 0; guard < N * N * 2; guard++) {
      const s = step(N, reg, t, G, BL, 4); if (!s) break;
      t[s.c] = s.v; if (s.v === CAT && st[s.c] !== CAT) { P.push(); set(s.c, CAT); flagHint(s.c); return true; }
    }
    return false;
  },
  down(x, y) { const c = cellAt(x, y); if (c < 0) return; drag = { start: c, moved: false, last: c, startVal: st[c] }; },
  move(x, y) {
    if (!drag) return; const c = cellAt(x, y); if (c < 0 || c === drag.last) return;
    if (!drag.moved) { drag.moved = true; P.push(); if (st[drag.start] === UNK) set(drag.start, NO, true); }
    drag.last = c; if (st[c] === UNK) set(c, NO, true);
  },
  up() { if (!drag) return; if (!drag.moved) { P.push(); set(drag.start, st[drag.start] === UNK ? NO : st[drag.start] === NO ? CAT : UNK); } drag = null; },
  draw,
  debug: () => ({ geo, N, st: st.slice(), sol }),
  bot() {
    for (let c = 0; c < N * N; c++) if (st[c] !== UNK && st[c] !== sol[c]) { set(c, UNK); return; }
    const c = sol.findIndex((v, i) => v === CAT && st[i] !== CAT); if (c >= 0) { P.push(); set(c, CAT); }
  },
});

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on puzzle 1, until the first real touch,
// one empty cell shows what taps do: ✕, then a cat, then empty again (a cell with no cat in the answer, so nothing is given away)
let demoC = -1;
demo(n => {
  if (n === 1) { const free = st.map((v, i) => v === UNK && sol[i] !== CAT ? i : -1).filter(i => i >= 0); demoC = free[(free.length / 2) | 0] ?? -1; }
  if (demoC < 0 || (n > 1 && st[demoC] !== (n === 2 ? NO : CAT))) return false;
  set(demoC, n === 1 ? NO : n === 2 ? CAT : UNK);
}, { ready: () => P.state === 'play' && P.level === 1 && !P.D.isDaily && !drag && !wonAt, wait: 2000, every: 1100, max: 3 });

function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx; }
function flagHint(c) { hintCell = c; hintAt = performance.now(); }
const mew = () => { tone(620, 0.09, 'triangle', 0.1, 1.45); setTimeout(() => tone(880, 0.16, 'triangle', 0.08, 0.62), 70); };
function center(c) { return [geo.x + (c % N + 0.5) * geo.s, geo.y + (((c / N) | 0) + 0.5) * geo.s]; }

function set(c, v, quiet = false) {
  if (st[c] === v) return;
  st[c] = v; anim.set(c, performance.now());
  if (v === CAT) {
    mew(); buzz(10);
    const [x, y] = center(c); P.fx.sparks(x, y, ['#fff', REG[reg[c]], '#ffe08a'], 8, { speed: 2.4, size: 3 });
  } else if (v === NO) { if (!quiet) soft.wood(); else tone(1100 + Math.random() * 200, 0.025, 'sine', 0.04, 0.8); }
  else soft.click();
  refresh(c, v);
}
function refresh(c = -1, v = UNK) {
  // conflicts: cats sharing a row / column / region or touching
  conf = new Set();
  const cats = []; for (let i = 0; i < N * N; i++) if (st[i] === CAT) cats.push(i);
  for (const a of cats) for (const b of cats) if (a < b && BL[a].includes(b)) { conf.add(a); conf.add(b); }
  if (c >= 0 && v === CAT && conf.has(c)) { shake.set(c, performance.now()); soft.err(); buzz([8, 30, 8]); }
  const good = cats.filter(a => !conf.has(a)).length;
  P.progress(good / N);
  // a colour patch that just got its cat: little chime
  if (c >= 0 && v === CAT && !conf.has(c)) chime(good + 1, 72, 0.08);
  if (cats.length === N && !conf.size && P.state === 'play') win();
}
function win() {
  wonAt = performance.now();
  for (let i = 0; i < N * N; i++) if (st[i] === CAT) { const [x, y] = center(i); setTimeout(() => P.fx.sparks(x, y, ['#fff', '#ffe08a', REG[reg[i]]], 14, { speed: 3.2 }), (((i / N) | 0)) * 70); }
  P.solved();
}

// ---------------------------------------------------------------- drawing
function cat(g, cx, cy, s, f, o = {}) {
  const k = s / 100; g.save(); g.translate(cx, cy); g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round';
  // shadow
  g.fillStyle = 'rgba(40,20,40,.16)'; g.beginPath(); g.ellipse(0, 36, 34, 7, 0, 0, 7); g.fill();
  // ears
  for (const sx of [-1, 1]) {
    g.fillStyle = f.fur; g.strokeStyle = f.ink; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(sx * 36, -6); g.quadraticCurveTo(sx * 40, -40, sx * 30, -44); g.quadraticCurveTo(sx * 22, -40, sx * 6, -24); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = f.ear; g.beginPath(); g.moveTo(sx * 30, -14); g.quadraticCurveTo(sx * 33, -34, sx * 29, -37); g.quadraticCurveTo(sx * 22, -32, sx * 14, -22); g.closePath(); g.fill();
  }
  // head
  g.fillStyle = f.fur; g.strokeStyle = f.ink; g.lineWidth = 3.4;
  g.beginPath(); g.ellipse(0, 4, 41, 33, 0, 0, 7); g.fill();
  if (f.mask) { g.save(); g.clip(); g.fillStyle = f.mask; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(0, 14, 20, 17, 0, 0, 7); g.fill(); g.restore(); }
  if (f.patch) { g.save(); g.beginPath(); g.ellipse(0, 4, 41, 33, 0, 0, 7); g.clip(); g.fillStyle = f.patch; g.beginPath(); g.ellipse(-22, -12, 20, 16, -0.4, 0, 7); g.fill(); g.restore(); }
  g.beginPath(); g.ellipse(0, 4, 41, 33, 0, 0, 7); g.stroke();
  if (f.stripe) { g.strokeStyle = f.stripe; g.lineWidth = 3.4; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(dx, -27); g.lineTo(dx * 0.8, -18 + Math.abs(dx) * 0.4); g.stroke(); } }
  // cheeks
  g.fillStyle = 'rgba(255,120,140,.28)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 24, 14, 7, 4.5, 0, 0, 7); g.fill(); }
  // eyes: open (with blink) or asleep
  const ink = f.light ? '#f6eedf' : f.ink;
  if (o.sleep) {
    g.strokeStyle = ink; g.lineWidth = 3.4; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 15, 2, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  } else if (o.blink) {
    g.strokeStyle = ink; g.lineWidth = 3.4; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 15 - 6, 4); g.lineTo(sx * 15 + 6, 4); g.stroke(); }
  } else {
    for (const sx of [-1, 1]) {
      g.fillStyle = f.eye; g.beginPath(); g.ellipse(sx * 15, 3, 6.5, 8.5, 0, 0, 7); g.fill();
      if (f.light) { g.fillStyle = '#1d1c24'; g.beginPath(); g.ellipse(sx * 15, 3, 2.4, 6.5, 0, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * 15 + 2.4, -0.5, 2.4, 0, 7); g.fill();
    }
  }
  if (o.worry) { g.strokeStyle = ink; g.lineWidth = 3; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 9, -9); g.lineTo(sx * 21, -13); g.stroke(); } }
  // nose + mouth
  g.fillStyle = '#f27f95'; g.beginPath(); g.moveTo(-4.5, 12); g.lineTo(4.5, 12); g.lineTo(0, 16.5); g.closePath(); g.fill();
  g.strokeStyle = ink; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, 16.5); g.quadraticCurveTo(-1, 22, -7, 21); g.moveTo(0, 16.5); g.quadraticCurveTo(1, 22, 7, 21); g.stroke();
  // whiskers
  g.lineWidth = 1.8; g.strokeStyle = f.light ? 'rgba(255,255,255,.7)' : 'rgba(60,40,40,.55)';
  for (const sx of [-1, 1]) for (const dy of [-2, 4]) { g.beginPath(); g.moveTo(sx * 30, 14 + dy); g.lineTo(sx * 50, 10 + dy * 2.2); g.stroke(); }
  g.restore();
}
function chip(g, x, y, w, h, text) {
  rrect(g, x, y, w, h, h / 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill();
  g.fillStyle = '#3a2f45'; g.globalAlpha = 0.75; g.font = `650 ${Math.round(h * 0.42)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2 + 1); g.globalAlpha = 1;
}
function draw(g, t) {
  const { x: X, y: Y, s } = geo, now = performance.now(), B = s * N;
  // board card
  g.save(); g.shadowColor = 'rgba(80,40,70,.18)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(g, X - 8, Y - 8, B + 16, B + 16, 18); g.fillStyle = '#fffaf5'; g.fill(); g.restore();
  g.save(); rrect(g, X, Y, B, B, 11); g.clip();
  const blocked = new Set(); for (let c = 0; c < N * N; c++) if (st[c] === CAT) for (const d of BL[c]) blocked.add(d);
  for (let c = 0; c < N * N; c++) {
    const cx = X + (c % N) * s, cy = Y + ((c / N) | 0) * s;
    g.fillStyle = REG[reg[c] % REG.length]; g.fillRect(cx, cy, s, s);
    if (wonAt) { const k = Math.max(0, 1 - Math.abs((now - wonAt) / 900 - (((c / N) | 0) + (c % N)) / (2 * N)) * 5); if (k > 0) { g.fillStyle = `rgba(255,255,255,${0.45 * k})`; g.fillRect(cx, cy, s, s); } }
  }
  // thin grid
  g.strokeStyle = 'rgba(60,30,50,.16)'; g.lineWidth = 1;
  for (let i = 1; i < N; i++) { g.beginPath(); g.moveTo(X + i * s, Y); g.lineTo(X + i * s, Y + B); g.moveTo(X, Y + i * s); g.lineTo(X + B, Y + i * s); g.stroke(); }
  // thick region borders
  g.strokeStyle = '#3a2f45'; g.lineWidth = Math.max(2.5, s * 0.06); g.lineCap = 'round'; g.beginPath();
  for (let c = 0; c < N * N; c++) {
    const i = c % N, j = (c / N) | 0, cx = X + i * s, cy = Y + j * s;
    if (i < N - 1 && reg[c] !== reg[c + 1]) { g.moveTo(cx + s, cy); g.lineTo(cx + s, cy + s); }
    if (j < N - 1 && reg[c] !== reg[c + N]) { g.moveTo(cx, cy + s); g.lineTo(cx + s, cy + s); }
  }
  g.stroke(); g.restore();
  rrect(g, X, Y, B, B, 11); g.strokeStyle = '#3a2f45'; g.lineWidth = Math.max(3, s * 0.07); g.stroke();
  // marks
  for (let c = 0; c < N * N; c++) {
    const [cx, cy] = center(c), a0 = anim.get(c), k = a0 ? ease.back((now - a0) / 260) : 1;
    let ox = 0; const sh = shake.get(c); if (sh && now - sh < 420) ox = Math.sin((now - sh) / 25) * s * 0.08 * (1 - (now - sh) / 420);
    if (st[c] === NO) {
      const r = s * 0.17 * k; g.strokeStyle = DARK[reg[c] % DARK.length]; g.lineWidth = Math.max(2.5, s * 0.075); g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r); g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r); g.stroke();
    } else if (st[c] === CAT) {
      if (conf.has(c)) { g.fillStyle = 'rgba(230,60,80,.28)'; g.fillRect(cx - s / 2 + 2, cy - s / 2 + 2, s - 4, s - 4); }
      const bob = wonAt ? Math.sin(now / 500 + c) * s * 0.02 : 0;
      const blink = !wonAt && ((now / 1000 + c * 0.37) % 4.2) < 0.13;
      cat(g, cx + ox, cy + bob + s * 0.02, s * 0.82 * k, FUR[reg[c] % FUR.length], { sleep: !!wonAt, blink, worry: conf.has(c) });
      if (wonAt) { // floating z's
        const ph = ((now - wonAt) / 1400 + c * 0.13) % 1; g.fillStyle = `rgba(58,47,69,${0.7 * (1 - ph)})`; g.font = `800 ${Math.round(s * (0.16 + ph * 0.12))}px -apple-system,system-ui,sans-serif`;
        g.fillText('z', cx + s * (0.22 + ph * 0.16), cy - s * (0.22 + ph * 0.3));
      }
    } else if (blocked.has(c)) {
      g.fillStyle = 'rgba(58,47,69,.22)'; g.beginPath(); g.arc(cx, cy, Math.max(2, s * 0.045), 0, 7); g.fill();
    }
  }
  // hint glow
  if (hintCell >= 0 && now - hintAt < 1600) {
    const k = 1 - (now - hintAt) / 1600, [cx, cy] = center(hintCell);
    g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 4; rrect(g, cx - s / 2 + 3, cy - s / 2 + 3, s - 6, s - 6, 8); g.stroke();
    g.strokeStyle = `rgba(224,112,140,${k})`; g.lineWidth = 2; rrect(g, cx - s / 2 - 1 - (1 - k) * 8, cy - s / 2 - 1 - (1 - k) * 8, s + 2 + (1 - k) * 16, s + 2 + (1 - k) * 16, 10); g.stroke();
  }
  // rule chips under the board
  const cy = Y + B + 26, h = 28, gap = 8, labels = ['1 per row & column', '1 per colour', 'never touching'];
  g.font = `650 ${Math.round(h * 0.42)}px -apple-system,system-ui,sans-serif`;
  const ws = labels.map(l => g.measureText(l).width + 22), tot = ws.reduce((a, b) => a + b, 0) + gap * 2;
  if (tot < P.area().W - 16) { let x = (P.area().W - tot) / 2; labels.forEach((l, i) => { chip(g, x, cy, ws[i], h, l); x += ws[i] + gap; }); }
}

P.start();
