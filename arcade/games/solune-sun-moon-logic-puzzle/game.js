// Solune — fill the grid with suns and moons: each row and column holds as many suns as moons, never three alike in a
// line, '=' joins two alike cells and '×' two different ones. Puzzles are generated (seeded) and kept only when our
// step-by-step logic solver finishes them without guessing (so the answer is unique).
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp } from './puzzle.js';
import { generate, step, lineCells, ek, SUN, MOON } from './solgen.js';

let N = 4, sol = [], given = [], st = [], edges = new Map(), edgeList = [], LC = [], geo = { x: 0, y: 0, s: 50 }, anim = new Map(), bad = new Set(), badEdges = new Set(), wonAt = 0, hintCell = -1, hintAt = 0;

const P = shell({
  key: 'solune', name: 'Solune: Sun & Moon Logic Puzzle', brand: 'Solune', kicker: 'sun & moon logic', accent: '#ee8a3a', ink: '#2c2f4a',
  bg: ['#fff3df', '#e2e6fb'], winWord: 'Balanced!', dailyLevel: 10,
  build(level, seed, fk) {
    const p = generate(level, seed, fk, rngf) || generate(1, seed + 5, 1, rngf);
    N = p.N; sol = p.sol; given = p.given; edgeList = p.edges; edges = new Map(p.edges); LC = lineCells(N);
    st = given.slice(); anim = new Map(); bad = new Set(); badEdges = new Set(); wonAt = 0; hintCell = -1;
    return { label: `${N} × ${N} · ${p.hard > 1 ? 'tricky' : 'gentle'}`, sizeKey: 'n' + N, cells: N * N };
  },
  layout(a) {
    const s = Math.floor(Math.min(a.w, a.h - 70, 480) / N);
    geo = { s, x: Math.round(a.x + (a.w - s * N) / 2), y: Math.round(a.y + Math.max(8, (a.h - 60 - s * N) * 0.48)) };
  },
  snapshot: () => st.slice(),
  restore(s) { st = s; check(); },
  isEmpty: () => st.every((v, i) => v === given[i]),
  clear() { st = given.slice(); check(); },
  hint() {
    for (let c = 0; c < N * N; c++) if (st[c] && st[c] !== sol[c]) { P.push(); put(c, sol[c]); flag(c); P.ui.pop('This one flips', '#fff', 24, 40); return true; }
    const s = step(N, st, edges, 2, LC); if (!s) return false;
    P.push(); put(s.c, s.v); flag(s.c);
    P.ui.pop({ sign: 'Follow the sign', pair: 'No three alike', between: 'No three alike', count: 'Half and half', line: 'Only option in this line' }[s.why], '#fff', 22, 40);
    return true;
  },
  down(x, y) {
    const c = cellAt(x, y); if (c < 0) return;
    if (given[c]) { anim.set(c, performance.now()); soft.err(); return; }
    P.push(); put(c, st[c] === 0 ? SUN : st[c] === SUN ? MOON : 0);
  },
  draw,
  debug: () => ({ geo, N, st: st.slice(), sol, given }),
  bot() {
    for (let c = 0; c < N * N; c++) if (st[c] && st[c] !== sol[c]) { put(c, 0); return; }
    const s = step(N, st, edges, 2, LC); if (s) { P.push(); put(s.c, s.v); }
  },
});

function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx; }
const center = (c) => [geo.x + (c % N + 0.5) * geo.s, geo.y + (((c / N) | 0) + 0.5) * geo.s];
function flag(c) { hintCell = c; hintAt = performance.now(); }
function put(c, v) {
  st[c] = v; anim.set(c, performance.now());
  if (v === SUN) { tone(784, 0.07, 'triangle', 0.1, 1.25); buzz(6); }
  else if (v === MOON) { tone(523, 0.12, 'sine', 0.12, 0.85); buzz(6); }
  else soft.click();
  check(c);
}
function check(c = -1) {
  const prevBad = bad.size + badEdges.size;
  bad = new Set(); badEdges = new Set();
  for (const L of LC) {
    for (let i = 0; i + 2 < N; i++) if (st[L[i]] && st[L[i]] === st[L[i + 1]] && st[L[i]] === st[L[i + 2]]) { bad.add(L[i]); bad.add(L[i + 1]); bad.add(L[i + 2]); }
    for (const v of [SUN, MOON]) if (L.filter(x => st[x] === v).length > N / 2) L.forEach(x => st[x] === v && bad.add(x));
  }
  for (const [k, s] of edgeList) { const [a, b] = k.split(':').map(Number); if (st[a] && st[b] && ((s === '=') !== (st[a] === st[b]))) badEdges.add(k); }
  if (c >= 0 && bad.size + badEdges.size > prevBad) { soft.err(); buzz([6, 24, 6]); }
  const filled = st.filter(v => v).length, nGiven = given.filter(v => v).length;
  P.progress((filled - nGiven) / Math.max(1, N * N - nGiven));
  // a line that just became complete and valid: little chime + sparkle along it
  if (c >= 0 && st[c]) for (const L of LC) if (L.includes(c) && L.every(x => st[x] && !bad.has(x))) {
    chime(LC.indexOf(L) % 5 + 2, 72, 0.07);
    const [x0, y0] = center(L[0]), [x1, y1] = center(L[N - 1]); for (let i = 0; i < 4; i++) P.fx.sparks(x0 + (x1 - x0) * i / 3, y0 + (y1 - y0) * i / 3, ['#ffd36e', '#fff', '#9fb0ff'], 3, { speed: 1.8, size: 2.4 });
  }
  if (filled === N * N && !bad.size && !badEdges.size && P.state === 'play') {
    wonAt = performance.now();
    for (let i = 0; i < N * N; i++) setTimeout(() => anim.set(i, performance.now()), ((i % N) + ((i / N) | 0)) * 40);
    P.solved();
  }
}

// ---------------------------------------------------------------- drawing
function sun(g, x, y, r, t, spin) {
  g.save(); g.translate(x, y); g.rotate(t * (spin ? 3 : 0.25));
  g.fillStyle = '#ffb547';
  for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-r * 0.2, -r * 0.82); g.lineTo(0, -r * 1.22); g.lineTo(r * 0.2, -r * 0.82); g.closePath(); g.fill(); }
  g.restore();
  const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r * 0.8); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#f59a2f');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.72, 0, 7); g.fill();
  g.strokeStyle = 'rgba(200,100,20,.35)'; g.lineWidth = 1.5; g.stroke();
}
function moon(g, x, y, r, t) {
  g.save(); g.translate(x, y); g.rotate(-0.35);
  const gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, '#8ea0ff'); gr.addColorStop(1, '#4a59c9');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.82, Math.PI * 0.5 - 1.25, Math.PI * 1.5 + 1.25, false);
  g.arc(r * 0.42, -r * 0.08, r * 0.62, Math.PI * 1.5 + 0.9, Math.PI * 0.5 - 0.9, true); g.closePath(); g.fill();
  g.restore();
  const tw = 0.6 + 0.4 * Math.sin(t * 2.5 + x);
  g.fillStyle = `rgba(255,214,110,${tw})`; g.beginPath(); const sx = x + r * 0.5, sy = y - r * 0.45, sr = r * 0.2;
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? sr * 0.4 : sr; g.lineTo(sx + Math.cos(i * Math.PI / 4) * rr, sy + Math.sin(i * Math.PI / 4) * rr); } g.fill();
}
function draw(g, t) {
  const { x: X, y: Y, s } = geo, B = s * N, now = performance.now();
  g.save(); g.shadowColor = 'rgba(50,50,100,.16)'; g.shadowBlur = 28; g.shadowOffsetY = 10; rrect(g, X - 9, Y - 9, B + 18, B + 18, 20); g.fillStyle = '#fffdf8'; g.fill(); g.restore();
  for (let c = 0; c < N * N; c++) {
    const cx = X + (c % N) * s, cy = Y + ((c / N) | 0) * s, a0 = anim.get(c), k = a0 ? ease.back((now - a0) / 260) : 1;
    rrect(g, cx + 2.5, cy + 2.5, s - 5, s - 5, s * 0.18);
    g.fillStyle = bad.has(c) ? '#ffd9d9' : given[c] ? '#efe9df' : '#f6f3ee'; g.fill();
    if (given[c]) { g.strokeStyle = 'rgba(44,47,74,.10)'; g.lineWidth = 1.5; g.stroke(); }
    const [x, y] = center(c), r = s * 0.27 * (st[c] ? k : 1);
    if (st[c] === SUN) sun(g, x, y, r, t, wonAt && now - wonAt < 1500);
    else if (st[c] === MOON) moon(g, x, y, r, t);
    if (bad.has(c) && st[c]) { g.strokeStyle = 'rgba(220,60,70,.7)'; g.lineWidth = 2.5; rrect(g, cx + 3.5, cy + 3.5, s - 7, s - 7, s * 0.17); g.stroke(); }
    if (given[c]) { g.fillStyle = 'rgba(44,47,74,.28)'; g.beginPath(); g.arc(cx + s * 0.16, cy + s * 0.16, Math.max(1.6, s * 0.03), 0, 7); g.fill(); }
  }
  // signs on the borders
  for (const [kk, sg] of edgeList) {
    const [a, b] = kk.split(':').map(Number), [x0, y0] = center(a), [x1, y1] = center(b), x = (x0 + x1) / 2, y = (y0 + y1) / 2, r = Math.max(9, s * 0.15), isBad = badEdges.has(kk);
    g.fillStyle = isBad ? '#e5484d' : '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = isBad ? '#e5484d' : 'rgba(44,47,74,.25)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = isBad ? '#fff' : '#2c2f4a'; g.lineWidth = Math.max(2, r * 0.22); g.lineCap = 'round'; g.beginPath();
    const q = r * 0.42;
    if (sg === '=') { g.moveTo(x - q, y - q * 0.45); g.lineTo(x + q, y - q * 0.45); g.moveTo(x - q, y + q * 0.45); g.lineTo(x + q, y + q * 0.45); }
    else { g.moveTo(x - q * 0.8, y - q * 0.8); g.lineTo(x + q * 0.8, y + q * 0.8); g.moveTo(x + q * 0.8, y - q * 0.8); g.lineTo(x - q * 0.8, y + q * 0.8); }
    g.stroke();
  }
  if (wonAt) { const k = Math.max(0, 1 - (now - wonAt) / 900); if (k > 0) { g.fillStyle = `rgba(255,236,170,${0.35 * k})`; rrect(g, X - 9, Y - 9, B + 18, B + 18, 20); g.fill(); } }
  if (hintCell >= 0 && now - hintAt < 1500) { const k = 1 - (now - hintAt) / 1500, [x, y] = center(hintCell); g.strokeStyle = `rgba(238,138,58,${k})`; g.lineWidth = 4; rrect(g, x - s / 2 - (1 - k) * 6, y - s / 2 - (1 - k) * 6, s + (1 - k) * 12, s + (1 - k) * 12, s * 0.2); g.stroke(); }
  // rules
  const yy = Y + B + 24, h = 28, labels = [`${N / 2} + ${N / 2} per line`, 'no 3 in a row', '= same  × differ'];
  g.font = `650 ${Math.round(h * 0.42)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ws = labels.map(l => g.measureText(l).width + 22), tot = ws.reduce((a, b) => a + b, 0) + 16, W = P.area().W;
  if (tot < W - 16) { let x = (W - tot) / 2; labels.forEach((l, i) => { rrect(g, x, yy, ws[i], h, h / 2); g.fillStyle = 'rgba(255,255,255,.82)'; g.fill(); g.fillStyle = 'rgba(44,47,74,.75)'; g.fillText(l, x + ws[i] / 2, yy + h / 2 + 1); x += ws[i] + 8; }); }
}

P.start();
