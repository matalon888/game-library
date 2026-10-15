// Thumb Duel — original one-phone party pack for two: the phone lies flat between you, blue plays the bottom half,
// red plays the top half (upside down). Five micro duels — Rocket Race, Tug of War, Sumo Ring, Quick Draw, Air Hockey —
// first to 5 points takes the match. Solo? A fair CPU plays red.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, arp, soft, todayKey } from './calm.js';
import { board } from './kit/board.js';
const B = board({ game: 'thumb-duel', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Thumb Duel: Party Duels for Two';
const S = store('thumbduel');
const F = flow('thumbduel');
const ui = createUI({ title: 'Thumb Duel', hint: 'Tap to start', hand: '', score: false, progress: false });
cardTheme({ accent: '#3a7bfd', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('thumbduel', ui, { name: NAME });
const fx = fx2d(12);
let mode = S.get('mode', 0);   // 0 = 1 player vs CPU, 1 = 2 players
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily duel set' : 'party duels for two',
  doneLine: doneToday ? (D.isDaily ? 'Daily set won ✓' : 'Daily set won ✓') : 'Same duel order for everyone today',
  chips: { items: ['🤖 1 Player', '👫 2 Players'], get: () => mode, set: (i) => { mode = i; S.set('mode', mode); } },
});
{ const p = document.createElement('p'); p.style.cssText = 'font-size:15px;opacity:.8;margin-top:12px;line-height:1.45'; p.innerHTML = 'Lay the phone flat between you · blue at the bottom, red on top<br>Five micro duels · first to 5 wins'; ui.els.start.querySelector('.calm-row').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily set<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'MATCH <span data-l>1</span>';

css(`
body{background:#20264a}
#cv{position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none}
`);
const cv = document.createElement('canvas'); cv.id = 'cv'; document.body.prepend(cv);
const g = cv.getContext('2d');
let W = 390, H = 844, DPR = 1;
function size() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
addEventListener('resize', size); size();

const BLUE = '#3a7bfd', RED = '#ff4d5e', BLUE2 = '#1f56c9', RED2 = '#c92a3c', CREAM = '#fff8ec', INK = '#20264a';
const PCOL = [BLUE, RED], PDARK = [BLUE2, RED2], PNAME = ['Blue', 'Red'];
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- drawing helpers
const half = (p, fn) => { if (p === 0) { fn(); return; } g.save(); g.translate(W, H); g.rotate(Math.PI); fn(); g.restore(); };
function text(t, x, y, size, color = '#fff', weight = 800, align = 'center') { g.font = `${weight} ${size}px 'Baloo 2',system-ui,sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(t, x, y); }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function disc(x, y, r, c, ring = null) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = c; g.fill(); if (ring) { g.lineWidth = r * 0.18; g.strokeStyle = ring; g.stroke(); } }
function shadowDisc(x, y, r) { g.beginPath(); g.ellipse(x + 3, y + 6, r, r * 0.9, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); }

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, pts = [0, 0], duelIdx = 0, order = [], phase = 'idle', pt = 0, winnerP = -1, skill = 0.5, recorded = false, beatenShown = false;
let R = Math.random, cur = null, shake = 0, flashC = null, flashA = 0;
const TO = 5;

// ---------------------------------------------------------------- the five duels
const DUELS = [
  { // Rocket Race: mash to fly your rocket to the middle line
    name: 'Rocket Race', icon: '🚀', tip: 'Tap fast! First rocket to the line',
    init() { this.pos = [0, 0]; this.boost = [0, 0]; this.cpuT = 0; },
    tap(p) { this.pos[p] = Math.min(1, this.pos[p] + 1 / 28); this.boost[p] = 1; tone(300 + this.pos[p] * 500, 0.04, 'triangle', 0.06, 1.4); if (this.pos[p] >= 1) point(p); },
    cpu(dt) { this.cpuT -= dt / 60; if (this.cpuT <= 0) { this.cpuT = 1 / (4.6 + skill * 5.2) * (0.75 + R() * 0.5); this.tap(1); } },
    bot() { this.tap(0); },
    draw() {
      for (const p of [0, 1]) half(p, () => {
        const x = W / 2 + (p ? 0 : 0), y0 = H - 70, y1 = H / 2 + 46, y = y0 - (y0 - y1) * this.pos[p];
        g.setLineDash([6, 10]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); g.setLineDash([]);
        for (let k = 0; k < 6; k++) { const yy = y + 40 + k * 16 + Math.random() * 6; g.globalAlpha = (1 - k / 6) * (0.4 + this.boost[p] * 0.6); disc(x + (Math.random() - 0.5) * 10, yy, 9 - k, k < 2 ? '#fff3b0' : '#ffb627'); }
        g.globalAlpha = 1;
        g.save(); g.translate(x, y); g.font = '64px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(-Math.PI / 4); g.fillText('🚀', 0, 0); g.restore();
        this.boost[p] *= 0.85;
      });
    },
  },
  { // Tug of War: mash to drag the knot into your zone
    name: 'Tug of War', icon: '🪢', tip: 'Tap fast! Pull the flag to your side',
    init() { this.k = 0; this.cpuT = 0; this.jig = [0, 0]; },
    tap(p) { this.k += p === 0 ? 0.08 : -0.08; this.jig[p] = 1; tone(p ? 260 : 330, 0.04, 'square', 0.04, 0.8); if (Math.abs(this.k) >= 1) point(this.k > 0 ? 0 : 1); },
    cpu(dt) { this.cpuT -= dt / 60; if (this.cpuT <= 0) { this.cpuT = 1 / (4.0 + skill * 5.0) * (0.75 + R() * 0.5); this.tap(1); } },
    bot() { this.tap(0); },
    draw() {
      const span = H / 2 - 110, ky = H / 2 + this.k * span;
      // zones
      for (const p of [0, 1]) half(p, () => { rr(W / 2 - 80, H / 2 + span - 6, 160, 12, 6); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); text('flag here = point', W / 2 - 18, H / 2 + span - 22, 15, 'rgba(255,255,255,.9)', 800, 'right'); });
      // rope
      g.lineCap = 'round'; g.strokeStyle = '#a4703d'; g.lineWidth = 12; g.beginPath(); g.moveTo(W / 2, 46); g.lineTo(W / 2, H - 46); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.setLineDash([8, 10]); g.beginPath(); g.moveTo(W / 2 - 2, 46); g.lineTo(W / 2 - 2, H - 46); g.stroke(); g.setLineDash([]);
      // flag on the knot
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(W / 2, ky - 18); g.lineTo(W / 2 + 46, ky); g.lineTo(W / 2, ky + 18); g.closePath(); g.fill();
      disc(W / 2, ky, 12, '#fff', INK);
      // pullers
      for (const p of [0, 1]) half(p, () => {
        const y = H - 46 + Math.sin(this.jig[p] * 3) * 6; this.jig[p] *= 0.8;
        for (let i = 0; i < 2; i++) { const xx = W / 2 + (i ? 30 : -30), yy = y - i * 6; shadowDisc(xx, yy, 21); disc(xx, yy, 21, PCOL[p], '#fff'); text(i ? '💪' : '😤', xx, yy + 1, 21); }
      });
    },
  },
  { // Sumo Ring: tap to dash along your spinning arrow, push the rival out
    name: 'Sumo Ring', icon: '🥋', tip: 'Tap to dash along your arrow',
    init() {
      this.R = Math.min(W * 0.42, H * 0.27); this.r = Math.min(34, this.R * 0.2);
      this.b = [{ x: W / 2, y: H / 2 + this.R * 0.45, vx: 0, vy: 0, a: -Math.PI / 2, s: 1, cd: 0 }, { x: W / 2, y: H / 2 - this.R * 0.45, vx: 0, vy: 0, a: Math.PI / 2, s: -1, cd: 0 }];
      this.cpuWait = 0; this.over = false;
    },
    tap(p) { const b = this.b[p]; if (b.cd > 0 || this.over) return; b.vx += Math.cos(b.a) * 13.5; b.vy += Math.sin(b.a) * 13.5; b.cd = 0.38; tone(200, 0.08, 'sine', 0.12, 0.6); },
    aimErr(p) { const b = this.b[p], o = this.b[1 - p]; let d = Math.atan2(o.y - b.y, o.x - b.x) - b.a; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d); },
    cpu(dt) {
      if (this.cpuWait > 0) { this.cpuWait -= dt / 60; if (this.cpuWait <= 0) this.tap(1); return; }
      const tol = 0.62 - skill * 0.42; if (this.b[1].cd <= 0 && this.aimErr(1) < tol) this.cpuWait = 0.05 + (1 - skill) * 0.22 + R() * 0.08;
    },
    bot() { if (this.b[0].cd <= 0 && this.aimErr(0) < 0.3) this.tap(0); },
    update(dt) {
      if (this.over) return;
      for (const b of this.b) { b.a += 0.08 * b.s * dt; b.x += b.vx * dt; b.y += b.vy * dt; const f = Math.pow(0.945, dt); b.vx *= f; b.vy *= f; b.cd -= dt / 60; }
      const [a, c] = this.b, dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), md = this.r * 2;
      if (d < md && d > 0) {
        const nx = dx / d, ny = dy / d, rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (rel > 0) { a.vx -= rel * nx; a.vy -= rel * ny; c.vx += rel * nx; c.vy += rel * ny; shake = Math.min(10, rel * 1.2); tone(120, 0.12, 'square', 0.08, 0.5); buzz(15); fx.sparks((a.x + c.x) / 2, (a.y + c.y) / 2, ['#fff', '#ffd23f'], 8, { speed: 3, size: 3 }); }
        const push = (md - d) / 2; a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
      }
      for (let p = 0; p < 2; p++) { const b = this.b[p]; if (Math.hypot(b.x - W / 2, b.y - H / 2) > this.R + this.r * 0.2) { this.over = true; fx.sparks(b.x, b.y, [PCOL[p], '#fff'], 18, { speed: 5 }); point(1 - p); return; } }
    },
    draw() {
      const cx = W / 2, cy = H / 2;
      disc(cx, cy, this.R + 16, '#e8d6b0'); disc(cx, cy, this.R, '#f6e7c8', '#c9a46a');
      g.strokeStyle = 'rgba(160,120,60,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 34, cy - 10); g.lineTo(cx - 34, cy + 10); g.moveTo(cx + 34, cy - 10); g.lineTo(cx + 34, cy + 10); g.stroke();
      this.b.forEach((b, p) => {
        g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.globalAlpha = b.cd > 0 ? 0.35 : 0.95;
        g.fillStyle = PCOL[p]; g.beginPath(); g.moveTo(this.r + 34, 0); g.lineTo(this.r + 12, -11); g.lineTo(this.r + 12, 11); g.closePath(); g.fill(); g.globalAlpha = 1; g.restore();
        shadowDisc(b.x, b.y, this.r); disc(b.x, b.y, this.r, PCOL[p], '#fff');
        g.save(); g.translate(b.x, b.y); if (p) g.rotate(Math.PI); text(Math.hypot(b.vx, b.vy) > 4 ? '😠' : '😐', 0, 2, this.r * 1.1); g.restore();
      });
    },
  },
  { // Quick Draw: wait for GO, first tap wins, tapping early gives the point away
    name: 'Quick Draw', icon: '🤠', tip: 'Wait for GO… then tap first!',
    init() { this.wait = 1.4 + R() * 2.4; this.t = 0; this.go = false; this.cpuAt = 0.36 - skill * 0.2 + R() * 0.1; this.done = false; this.rt = null; },
    update(dt) { if (this.done) return; this.t += dt / 60; if (!this.go && this.t >= this.wait) { this.go = true; this.t0 = this.t; tone(880, 0.12, 'square', 0.1, 1); buzz(20); } },
    tap(p) {
      if (this.done) return; this.done = true;
      if (!this.go) { this.foul = p; tone(160, 0.25, 'sawtooth', 0.1, 0.6); point(1 - p, 'Too early!'); return; }
      this.rt = Math.round((this.t - this.t0) * 1000); this.winp = p; point(p, `${this.rt} ms`);
    },
    cpu() { if (this.go && !this.done && this.t - this.t0 >= this.cpuAt) this.tap(1); },
    bot() { if (this.go) this.tap(0); },
    draw() {
      for (const p of [0, 1]) half(p, () => {
        const cy = H * 0.75, go = this.go && !this.done;
        disc(W / 2, cy, 92, go ? '#2ee59d' : this.done ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)', go ? '#fff' : 'rgba(255,255,255,.5)');
        text(go ? 'GO!' : this.done ? (this.foul === p ? 'EARLY!' : this.winp === p ? 'BANG!' : '') : 'WAIT…', W / 2, cy + 2, go ? 52 : 34, go ? INK : '#fff');
        if (!go && !this.done) text('🤠', W / 2, cy + 132, 42);
      });
    },
  },
  { // Air Hockey: drag your paddle, score one goal
    name: 'Air Hockey', icon: '🏒', tip: 'Drag your paddle · score a goal',
    init() {
      this.m = 14; this.gw = W * 0.44; this.pr = Math.min(32, W * 0.085); this.kr = this.pr * 0.55;
      this.pad = [{ x: W / 2, y: H - 110, tx: W / 2, ty: H - 110, vx: 0, vy: 0 }, { x: W / 2, y: 110, tx: W / 2, ty: 110, vx: 0, vy: 0 }];
      const dirn = R() < 0.5 ? 1 : -1; this.k = { x: W / 2, y: H / 2, vx: (R() - 0.5) * 2, vy: dirn * 2.2 }; this.over = false;
    },
    drag(p, x, y) { const pd = this.pad[p], lo = p ? this.m + this.pr : H / 2 + this.pr, hi = p ? H / 2 - this.pr : H - this.m - this.pr; pd.tx = Math.max(this.m + this.pr, Math.min(W - this.m - this.pr, x)); pd.ty = Math.max(lo, Math.min(hi, y)); },
    ai(p, sp) {
      const pd = this.pad[p], k = this.k, mine = p ? k.y < H / 2 : k.y > H / 2, home = p ? 100 : H - 100;
      if (mine) { const goal = p ? H : 0, ax = k.x + (k.x - W / 2) * 0.15, ay = k.y + (p ? -1 : 1) * this.pr * 0.9; this.drag(p, ax, ay); void goal; }
      else this.drag(p, W / 2 + (k.x - W / 2) * 0.4, home);
      const dx = pd.tx - pd.x, dy = pd.ty - pd.y, d = Math.hypot(dx, dy); if (d > sp) { pd.tx = pd.x + dx / d * sp; pd.ty = pd.y + dy / d * sp; }
    },
    cpu() { this.ai(1, 3.6 + skill * 6.4); },
    bot() { this.ai(0, 9); },
    update(dt) {
      if (this.over) return;
      for (const pd of this.pad) { const nx = pd.x + (pd.tx - pd.x) * Math.min(1, 0.6 * dt), ny = pd.y + (pd.ty - pd.y) * Math.min(1, 0.6 * dt); pd.vx = (nx - pd.x) / dt; pd.vy = (ny - pd.y) / dt; pd.x = nx; pd.y = ny; }
      const k = this.k, steps = 3;
      for (let s = 0; s < steps; s++) {
        k.x += k.vx * dt / steps; k.y += k.vy * dt / steps;
        if (k.x < this.m + this.kr) { k.x = this.m + this.kr; k.vx = Math.abs(k.vx) * 0.92; soft.wood(); }
        if (k.x > W - this.m - this.kr) { k.x = W - this.m - this.kr; k.vx = -Math.abs(k.vx) * 0.92; soft.wood(); }
        const inGoal = Math.abs(k.x - W / 2) < this.gw / 2 - this.kr * 0.4;
        if (k.y < this.m + this.kr) { if (inGoal) { if (k.y < -this.kr) { this.over = true; return point(0, 'GOAL!'); } } else { k.y = this.m + this.kr; k.vy = Math.abs(k.vy) * 0.92; soft.wood(); } }
        if (k.y > H - this.m - this.kr) { if (inGoal) { if (k.y > H + this.kr) { this.over = true; return point(1, 'GOAL!'); } } else { k.y = H - this.m - this.kr; k.vy = -Math.abs(k.vy) * 0.92; soft.wood(); } }
        for (const pd of this.pad) {
          const dx = k.x - pd.x, dy = k.y - pd.y, d = Math.hypot(dx, dy), md = this.pr + this.kr;
          if (d < md && d > 0) {
            const nx = dx / d, ny = dy / d; k.x = pd.x + nx * md; k.y = pd.y + ny * md;
            const rv = (k.vx - pd.vx) * nx + (k.vy - pd.vy) * ny;
            if (rv < 0) { k.vx -= 1.9 * rv * nx; k.vy -= 1.9 * rv * ny; tone(420, 0.05, 'triangle', 0.1, 0.7); buzz(8); fx.sparks(k.x, k.y, ['#fff', '#9ff'], 6, { speed: 2.5, size: 2.5 }); }
          }
        }
      }
      const sp = Math.hypot(k.vx, k.vy), mx = 21; if (sp > mx) { k.vx *= mx / sp; k.vy *= mx / sp; }
      const f = Math.pow(0.996, dt); k.vx *= f; k.vy *= f;
    },
    draw() {
      g.fillStyle = 'rgba(255,255,255,.08)'; rr(this.m, this.m, W - this.m * 2, H - this.m * 2, 26); g.fill();
      g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.55)'; rr(this.m, this.m, W - this.m * 2, H - this.m * 2, 26); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, 64, 0, 7); g.stroke();
      for (const p of [0, 1]) half(p, () => { g.fillStyle = PDARK[p]; rr(W / 2 - this.gw / 2, H - this.m - 4, this.gw, 22, 8); g.fill(); g.beginPath(); g.arc(W / 2, H - this.m, 90, Math.PI, 0); g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke(); });
      const k = this.k; shadowDisc(k.x, k.y, this.kr); disc(k.x, k.y, this.kr, INK, '#ffd23f');
      this.pad.forEach((pd, p) => { shadowDisc(pd.x, pd.y, this.pr); disc(pd.x, pd.y, this.pr, PCOL[p], '#fff'); disc(pd.x, pd.y, this.pr * 0.42, PDARK[p]); });
    },
  },
];

// ---------------------------------------------------------------- round + match flow
function point(p, why = '') {
  if (phase !== 'play') return;
  phase = 'result'; pt = 0; winnerP = p; pts[p]++;
  cur.why = why;
  flashC = PCOL[p]; flashA = 0.5; shake = 8;
  arp(p === 0 ? [72, 76, 79] : [67, 71, 74], 80, 0.1); buzz([20, 40, 20]);
  fx.sparks(W / 2, p === 0 ? H * 0.75 : H * 0.25, [PCOL[p], '#fff', '#ffd23f'], 26, { speed: 6, size: 4 });
  if (p === 0 && mode === 0) { score += 100; if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 60); fx.confetti(60); } }
}
function nextRound() {
  if (pts[0] >= TO || pts[1] >= TO) return endMatch();
  cur = DUELS[order[duelIdx++ % order.length]]; cur.init(); cur.why = '';
  phase = 'intro'; pt = 0;
}
function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 4 : level;
  skill = Math.max(0.12, Math.min(0.98, (0.3 + Math.min(L, 12) * 0.055) * fk));
  R = rngf(D.seed || (level * 4111 + Date.now() % 100000));
  order = [0, 1, 2, 3, 4]; for (let i = 4; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  pts = [0, 0]; duelIdx = 0; score = 0; recorded = false; beatenShown = false;
  ui.levels(D.isDaily ? 1 : level);
  nextRound();
}
function endMatch() {
  const w = pts[0] >= TO ? 0 : 1; phase = 'over';
  fx.confetti(140, w ? ['#ff4d5e', '#ffd23f', '#fff'] : ['#3a7bfd', '#ffd23f', '#fff']);
  if (mode === 1) {   // two humans: no CPU, no difficulty record, both outcomes use the win card
    state = 'won'; ui.els.win.querySelector('h1').textContent = `${PNAME[w].toUpperCase()} WINS!`;
    D.won(pts[w]); ui.win(D.isDaily ? '' : level, `${pts[0]} – ${pts[1]}`); return;
  }
  if (w === 0) {
    state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); B.submit(1); }   // solo vs the CPU only
    score += (TO - pts[1]) * 50;
    ui.els.win.querySelector('h1').textContent = 'YOU WIN!';
    if (D.isDaily) S.set('daily_' + todayKey(), { s: score }); else { level++; S.set('level', level); }
    const best = S.get('best', 0); if (score > best) S.set('best', score);
    D.won(score); ui.win(D.isDaily ? '' : level - 1, `${pts[0]} – ${pts[1]} · ${score} pts`);
  } else {
    state = 'lost'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, pts[0] / TO); }
    ui.lose('CPU wins', `${pts[0]} – ${pts[1]} · tap for a rematch`);
  }
}
ui.onTap((which) => {
  B.start();
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (which === 'win' && mode === 1) level++, S.set('level', level);
  build(); state = 'play';
});

// ---------------------------------------------------------------- multi-touch input: each pointer belongs to the half it started in
const owner = new Map();
cv.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return; e.preventDefault();
  const p = e.clientY > H / 2 ? 0 : 1; if (p === 1 && mode === 0) return;
  owner.set(e.pointerId, p);
  if (phase === 'play') { if (cur.drag) cur.drag(p, e.clientX, e.clientY); else cur.tap(p); }
});
cv.addEventListener('pointermove', (e) => { const p = owner.get(e.pointerId); if (p === undefined || phase !== 'play' || !cur.drag) return; cur.drag(p, e.clientX, e.clientY); });
const up = (e) => owner.delete(e.pointerId); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

// ---------------------------------------------------------------- render loop
function drawBoard() {
  const sk = shake > 0.3 ? (Math.random() - 0.5) * shake : 0; shake *= 0.86;
  g.setTransform(DPR, 0, 0, DPR, sk * DPR, sk * DPR);
  let gr = g.createLinearGradient(0, H / 2, 0, H); gr.addColorStop(0, '#5b93ff'); gr.addColorStop(1, '#2f63e0'); g.fillStyle = gr; g.fillRect(-10, H / 2, W + 20, H / 2 + 10);
  gr = g.createLinearGradient(0, H / 2, 0, 0); gr.addColorStop(0, '#ff6f7c'); gr.addColorStop(1, '#e03549'); g.fillStyle = gr; g.fillRect(-10, -10, W + 20, H / 2 + 10);
  // soft pattern
  g.globalAlpha = 0.07; g.fillStyle = '#fff';
  for (let y = 18; y < H; y += 36) for (let x = (y / 36 % 2) * 18; x < W; x += 36) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
function drawScores() {
  // middle band with the two score rows
  g.fillStyle = CREAM; g.fillRect(0, H / 2 - 3, W, 6);
  for (const p of [0, 1]) half(p, () => {
    for (let i = 0; i < TO; i++) { const x = W / 2 - (TO - 1) * 13 + i * 26, y = H / 2 + 22; disc(x, y, 8, i < pts[p] ? '#ffd23f' : 'rgba(255,255,255,.28)', i < pts[p] ? '#fff' : null); }
    text(p === 0 ? (mode === 0 ? 'YOU' : 'BLUE') : (mode === 0 ? 'CPU' : 'RED'), 26, H / 2 + 22, 14, 'rgba(255,255,255,.85)', 800, 'left');
  });
}
function drawIntro(k) {
  g.fillStyle = `rgba(20,24,60,${0.55 * Math.min(1, k * 4)})`; g.fillRect(0, 0, W, H);
  const n = 3 - Math.floor((pt - 0.9) / 0.42);
  for (const p of [0, 1]) half(p, () => {
    const y = H * 0.73, s = Math.min(1, k * 5);
    g.save(); g.translate(W / 2, y); g.scale(s, s);
    text(cur.icon, 0, -78, 60); text(cur.name.toUpperCase(), 0, 0, 40, '#fff'); text(cur.tip, 0, 40, 17, 'rgba(255,255,255,.85)', 700);
    if (pt > 0.9) text(n > 0 ? String(n) : 'GO!', 0, 108, 46, '#ffd23f');
    g.restore();
    if (p === 1 && mode === 0) text('🤖 CPU', W / 2, H - 46, 16, 'rgba(255,255,255,.7)');
  });
}
function drawResult() {
  for (const p of [0, 1]) half(p, () => {
    const won = winnerP === p, y = H * 0.73, s = Math.min(1, pt * 5) * (won ? 1 + Math.sin(pt * 10) * 0.04 : 1);
    g.save(); g.translate(W / 2, y); g.scale(s, s);
    g.fillStyle = won ? 'rgba(255,255,255,.95)' : 'rgba(20,24,60,.55)'; rr(-130, -54, 260, 108, 26); g.fill();
    text(won ? 'POINT!' : 'Oof!', 0, -12, 40, won ? PDARK[p] : '#fff'); if (cur.why) text(cur.why, 0, 26, 18, won ? INK : 'rgba(255,255,255,.85)', 700);
    g.restore();
  });
}
let last = performance.now(), botTick = 0;
function frame(t) {
  const dt = Math.min(2.5, (t - last) / 16.67); last = t;
  drawBoard();
  if (cur && state !== 'ready') {
    if (phase === 'intro') { pt += dt / 60; if (pt > 0.9 + 0.42 * 3) { phase = 'play'; pt = 0; tone(880, 0.1, 'triangle', 0.1, 1); } }
    else if (phase === 'play') { cur.update && cur.update(dt); if (mode === 0 && phase === 'play' && state === 'play') cur.cpu(dt); }
    else if (phase === 'result') { pt += dt / 60; if (pt > 1.25) nextRound(); }
    cur.draw();
    drawScores();
    if (phase === 'intro') drawIntro(pt);
    if (phase === 'result') drawResult();
  } else if (!cur) drawScores();
  if (flashA > 0.01) { g.fillStyle = flashC; g.globalAlpha = flashA; g.fillRect(0, 0, W, H); g.globalAlpha = 1; flashA *= 0.88; }
  requestAnimationFrame(frame);
}
build(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hook: the bot plays blue (bottom)
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get debug() { return { phase, duel: cur && cur.name, pts: pts.join('-'), k: cur && cur.k && cur.k.x !== undefined ? [Math.round(cur.k.x), Math.round(cur.k.y), +cur.k.vx.toFixed(1), +cur.k.vy.toFixed(1)] : null }; },
  bot() { if (state === 'play' && phase === 'play' && cur) cur.bot(); },
};
