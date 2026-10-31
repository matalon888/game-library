// Viral Den v2: chart parsing and scoring, no DOM (the game and qa/charts.mjs both use it, so they can't disagree).
import { LEVELS } from './levels.js';

export const WIN = { perfect: 0.06, good: 0.17 };     // seconds either side of the beat
export const STARS = [0, 0.72, 0.92];                  // star 1 = the level's goal; 2 and 3 = these shares of a perfect run
const SPIKE = 1.25, TAPS = 'xgupch';

// a chart string → { notes: [{ t, type, end, steps }], beats: [{ t, down, spike }], len, bpm }
export function parse(L) {
  const src = L.chart.replace(/[\s|]/g, '');
  const notes = [], beats = []; let t = 0, k = 1, step = 0, open = null;
  for (const ch of src) {
    if (ch === '!') { k = SPIKE; continue; }
    if (ch === '~') { k = 1; continue; }
    const dt = 60 / (L.bpm * k) / 2;
    if (ch === '=') { if (open) { open.steps++; open.end = t + dt; } }
    else {
      open = null;
      if (ch !== '.') { const n = { t, type: ch, end: t, steps: 1, i: notes.length }; if (ch === 'h') { n.end = t + dt; open = n; } notes.push(n); }
    }
    beats.push({ t, down: step % 8 === 0, beat: step % 2 === 0, spike: k > 1 });
    t += dt; step++;
  }
  return { notes, beats, len: t, bpm: L.bpm, steps: step };
}
export const beatLen = (L) => 60 / L.bpm;

// one take (a run of a video): hype, VIRAL, combo, points. grade: 'perfect' | 'good'
export class Take {
  constructor(L) { this.L = L; this.pts = 0; this.hype = 0; this.viralTo = -1; this.combo = 0; this.best = 0; this.perfects = 0; this.goods = 0; this.misses = 0; this.flubs = 0; this.golds = 0; this.fed = 0; this.virals = 0; }
  viral(t) { return t < this.viralTo; }
  mult(t) { return this.viral(t) ? 5 : 1 + Math.floor(this.hype * 3.999); }
  add(p, t) { const m = this.mult(t), v = p * m; this.pts += v; return v; }
  up(h, t) {
    if (this.viral(t)) return false;
    this.hype = Math.min(1, this.hype + h);
    if (this.hype >= 1) { this.viralTo = t + 8 * beatLen(this.L); this.virals++; return true; }
    return false;
  }
  down(h) { this.hype = Math.max(0, this.hype - h); }
  // returns { pts, viral } for the effects
  hit(n, grade, t) {
    const P = { x: [100, 60], h: [100, 60], g: [300, 80], p: [130, 80], u: [120, 70] }[n.type] || [100, 60];
    const pf = grade === 'perfect'; if (pf) this.perfects++; else this.goods++;
    if (n.type === 'g' && pf) this.golds++;
    this.combo++; this.best = Math.max(this.best, this.combo);
    const pts = this.add(pf ? P[0] : P[1], t);
    const e = LEVELS.indexOf(this.L) < 3 ? 1.6 : 1;   // the first three videos pay hype fast: VIRAL inside the first 20 s
    const viral = this.up(e * (pf ? (n.type === 'g' ? 0.14 : 0.08) : 0.05), t);
    return { pts, viral };
  }
  holdTick(t) { const pts = this.add(30, t); const viral = this.up(0.02, t); return { pts, viral }; }
  holdDone(full, t) { if (!full) return { pts: 0 }; this.combo++; this.best = Math.max(this.best, this.combo); return { pts: this.add(80, t), viral: this.up(0.03, t) }; }
  trollPass(t) { this.combo++; this.best = Math.max(this.best, this.combo); return { pts: this.add(40, t), viral: this.up(0.03, t) }; }
  trollFed() { this.fed++; this.combo = 0; this.down(0.3); }
  miss() { this.misses++; this.combo = 0; this.down(0.15); }
  flub() { this.flubs++; this.combo = 0; this.down(0.15); this.pts = Math.max(0, this.pts - 60); }   // mashing costs points: spam can't clear a video
  endViral(t) { if (this.viralTo > 0 && t >= this.viralTo && this.hype >= 1) { this.hype = 0.35; return true; } return false; }
}

// play a whole chart with a scripted player: grade(n, i) → 'perfect' | 'good' | 'miss'; holds are held to the end
export function simulate(L, grade = () => 'perfect') {
  const C = parse(L), T = new Take(L);
  const ev = [];
  for (const n of C.notes) {
    ev.push({ t: n.t, n, k: 'note' });
    if (n.type === 'h') { for (let s = 1; s < n.steps; s++) ev.push({ t: n.t + (n.end - n.t) * s / n.steps, n, k: 'tick' }); ev.push({ t: n.end, n, k: 'end' }); }
  }
  ev.sort((a, b) => a.t - b.t);
  const held = new Set();
  ev.forEach((e, i) => {
    T.endViral(e.t);
    if (e.k === 'note') {
      if (e.n.type === 'c') return;
      if (e.n.type === 'o') return T.trollPass(e.t);
      const g = grade(e.n, e.n.i); if (g === 'miss') return T.miss();
      T.hit(e.n, g, e.t); if (e.n.type === 'h') held.add(e.n);
    } else if (held.has(e.n)) { if (e.k === 'tick') T.holdTick(e.t); else T.holdDone(true, e.t); }
  });
  return T;
}

const maxCache = new Map();
export const maxPts = (L) => { if (!maxCache.has(L)) maxCache.set(L, simulate(L).pts); return maxCache.get(L); };
export const targets = (L) => { const m = maxPts(L); return [L.goal * m, STARS[1] * m, STARS[2] * m]; };
export const starsOf = (L, pts) => targets(L).filter(x => pts >= x - 1e-6).length;

// after level 30: generated videos from the unlocked elements, seeded by level (same for everyone)
export function levelOf(n, k = 1) {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  let s = n * 9301 + 49297; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const bars = [], pool = ['x.x.x.x.', 'x.xx.x..', 'xx..xg..', 'h==.x.x.', 'xox.x.x.', 'u.xou.x.', 'x.p.p.x.', 'xxoxu.x.', 'h===u.o.', 'g.g.x.x.', 'x..xx.x.', 'xpxpu.o.'];
  for (let i = 0; i < 12; i++) bars.push(i === 6 ? '!' + pool[Math.floor(r() * pool.length)] : i === 9 ? '~' + pool[Math.floor(r() * pool.length)] : pool[Math.floor(r() * pool.length)]);
  bars.push('g.g.g.g.');
  const titles = ['Fan meetup', 'Speed run', 'Mystery box', 'Remix night', 'Cooking chaos', 'Prank wars', 'Dance break', 'Sunset vlog'];
  return { title: titles[n % titles.length] + ' #' + (n - 30), bpm: Math.round(Math.min(124, 100 + (n - 30) * 0.8) * Math.min(1.1, Math.max(0.9, k))), goal: 0.5, hard: n % 5 === 0, chart: bars.join(' | '), gen: true };
}
