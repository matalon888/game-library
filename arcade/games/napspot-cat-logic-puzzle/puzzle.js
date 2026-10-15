// puzzle.js — shared shell for our calm daily logic puzzles (copied into each game folder). Our own code, MIT.
// Gives a game: start / win cards (dark glass), daily challenge (?daily=1 → D.seed), honest flow difficulty, a timer with
// best time per size, an undo / restart / hint toolbar, a full-screen board canvas with pointer input, points + 2D confetti.
import { createUI, store, buzz, note, tone, loop } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, arp, soft, chime, todayKey, fmtTime } from './calm.js';
export { buzz, note, tone, arp, soft, chime, fmtTime, css };

export function rngf(seed) {
  let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 6; i++) r();
  return r;
}
export function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function rrect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export const ease = { out: (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3), back: (t) => { t = Math.min(1, Math.max(0, t)); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };

export const SVG = {
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg>',
};

export function shell(o) {
  const { key, name, brand, kicker, accent, bg, ink = '#2d2a3e', winWord = 'Solved!', dailyLevel = 12, hints: HINTS = 3 } = o;
  const S = store(key), F = flow(key);
  const ui = createUI({ title: brand, hint: 'Tap to play', hand: '', score: false });
  cardTheme({ accent });
  const D = daily(key, ui, { name });
  const fx = fx2d(11);
  const done = S.get('daily_' + todayKey(), null);
  startCard(ui, D, { kicker: D.isDaily ? 'Daily puzzle' : kicker, doneLine: done ? (D.isDaily ? `Solved today in ${fmtTime(done.t)}` : 'Daily puzzle solved ✓') : null });
  if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
  ui.els.win.querySelector('h1').textContent = winWord;
  // pops sit on a light page: draw them in ink with a soft white halo
  const pop0 = ui.pop; ui.pop = (t, c = '#fff', ...rest) => pop0(t, c === '#fff' ? ink : c, ...rest);

  css(`
  body{background:radial-gradient(120% 70% at 50% 0%,${bg[0]},${bg[1]});color:${ink}}
  body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(255,255,255,.55) 1.2px,transparent 1.6px);background-size:22px 22px;opacity:.6;pointer-events:none}
  .hc-card{color:#fff}
  .hc-pop{text-shadow:0 0 14px rgba(255,255,255,.95),0 0 4px rgba(255,255,255,.9)!important}
  .hc-top{z-index:6}
  .hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12)}
  .hc-top .hc-lvl.next{background:rgba(255,255,255,.85);color:${accent}}
  .hc-top .hc-bar{background:rgba(255,255,255,.7);height:8px}
  .hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:750;color:${ink};opacity:.55;text-shadow:none}
  #pz-time{position:fixed;left:0;right:0;top:calc(74px + env(safe-area-inset-top));display:flex;justify-content:center;gap:8px;z-index:5;pointer-events:none}
  #pz-time span{background:rgba(255,255,255,.82);color:${ink};border-radius:14px;padding:3px 12px;font-weight:750;font-size:15px;font-variant-numeric:tabular-nums;box-shadow:0 2px 10px rgba(40,30,70,.07)}
  #pz-time span.best{font-weight:600;opacity:.75}
  #pz-board{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
  #pz-bar{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(14px,6vw,30px);z-index:5}
  .pz-b{display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit;font-size:11px;font-weight:750;color:${ink};background:none;border:0;cursor:pointer;letter-spacing:1px;text-transform:uppercase;position:relative;padding:0;-webkit-tap-highlight-color:transparent}
  .pz-b .c{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(40,30,70,.13),inset 0 -2px 0 rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;transition:transform .12s,background .2s}
  .pz-b svg{width:24px;height:24px;stroke:${ink};fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .pz-b i{position:absolute;top:-4px;right:-6px;font-style:normal;background:${accent};color:#fff;font-size:11px;font-weight:800;border-radius:10px;padding:1px 6px;min-width:18px;text-align:center;letter-spacing:0}
  .pz-b i.off{background:#a39fae}
  .pz-b.on .c{background:${accent}}.pz-b.on svg{stroke:#fff}
  .pz-b:active .c{transform:scale(.9)}
  .pz-b.dim{opacity:.45}
  `);
  const cv = document.createElement('canvas'); cv.id = 'pz-board'; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  const timeEl = document.createElement('div'); timeEl.id = 'pz-time'; timeEl.innerHTML = '<span class="now">0:00</span><span class="best"></span>'; document.body.appendChild(timeEl);
  const bar = document.createElement('div'); bar.id = 'pz-bar'; document.body.appendChild(bar);
  const btns = {};
  function button(id, label, svg, onPress) {
    const b = document.createElement('button'); b.className = 'pz-b'; b.innerHTML = `<div class="c">${svg}</div>${label}`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (P.state !== 'play') return; onPress(b); });
    bar.appendChild(b); btns[id] = b; return b;
  }

  let dpr = 1, W = 0, H = 0;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; o.layout && o.layout(P.area()); };
  addEventListener('resize', size);

  let level = S.get('level', 1), score = S.get('score', 0), secs = 0, shownSec = -1, hintsLeft = HINTS, hintsUsed = 0, firstHintAt = -1, undo = [], recorded = false, info = {}, prog = 0;
  const P = {
    S, F, D, ui, fx, g, cv, btns, state: 'ready',
    get level() { return level; }, get score() { return score; }, get secs() { return secs; }, get hintsUsed() { return hintsUsed; },
    area() { const top = 112, bot = H - 104; return { x: 14, y: top, w: W - 28, h: Math.max(120, bot - top), W, H }; },
    push() { undo.push(o.snapshot()); if (undo.length > 300) undo.shift(); },
    progress(p) { prog = Math.max(0, Math.min(1, p)); ui.progress(prog); },
    button,
    hintBadge() { const i = btns.hint && btns.hint.querySelector('i'); if (i) { i.textContent = hintsLeft; i.classList.toggle('off', !hintsLeft); } },
    solved(extra = '', delay = 350) {
      if (P.state !== 'play') return;
      P.state = 'won';
      const t = Math.max(1, Math.round(secs)), cells = info.cells || 25;
      const pts = Math.max(20, Math.round(cells * 4 + Math.max(0, cells * 6 - t * 2) - hintsUsed * 25));
      const bk = 'best_' + (info.sizeKey || 'x'), prev = S.get(bk, 0), newBest = !prev || t < prev;
      if (newBest) S.set(bk, t);
      if (!recorded) { recorded = true; if (!D.isDaily) { if (!hintsUsed) F.level(true); else F.level(false, Math.max(0, firstHintAt)); } }
      score += pts; S.set('score', score);
      if (D.isDaily) { const k = 'daily_' + todayKey(), pd = S.get(k, null); if (!pd || t < pd.t) S.set(k, { t, s: pts }); }
      else { level++; S.set('level', level); }
      D.won(pts, 'scored');
      if (D.beaten(pts)) { setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }, 300); }
      arp([67, 72, 76, 79, 84], 95, 0.12, 0.9); buzz([20, 50, 20]); setTimeout(() => fx.confetti(), 250);
      ui.progress(1);
      const line = `${fmtTime(t)} · ${newBest ? (prev ? 'new best!' : 'first solve') : 'best ' + fmtTime(prev)} · ${pts} pts${extra ? ' · ' + extra : ''}`;
      setTimeout(() => ui.win(D.isDaily ? '' : level - 1, line), delay);
    },
  };
  button('undo', 'Undo', SVG.undo, () => { if (!undo.length) { soft.err(); return; } o.restore(undo.pop()); soft.click(); buzz(6); });
  button('restart', 'Clear', SVG.restart, () => { if (!o.isEmpty || !o.isEmpty()) { P.push(); o.clear(); soft.swish(); } });
  (o.buttons || []).forEach(b => button(b.id, b.label, b.svg, b.onPress));
  const hb = button('hint', 'Hint', SVG.hint, () => {
    if (!hintsLeft) { soft.err(); ui.pop('No hints left', '#fff', 22, 40); return; }
    const before = prog;
    if (o.hint()) { if (firstHintAt < 0) firstHintAt = before; hintsLeft--; hintsUsed++; P.hintBadge(); chime(4, 76, 0.1); }
  });
  hb.insertAdjacentHTML('beforeend', '<i>3</i>');

  function build() {
    const fk = D.isDaily ? 1 : F.k();
    const seed = D.seed ? D.seed * 31 + 7 : level * 7919 + 13;
    info = o.build(D.isDaily ? dailyLevel : level, seed, fk) || {};
    secs = 0; shownSec = -1; hintsLeft = HINTS; hintsUsed = 0; firstHintAt = -1; undo = []; recorded = false; P.hintBadge();
    ui.levels(D.isDaily ? 1 : level); P.progress(0);
    if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
    ui.sub((D.isDaily ? 'Daily · ' : '') + (info.label || ''));
    const best = S.get('best_' + (info.sizeKey || 'x'), 0);
    timeEl.querySelector('.best').textContent = best ? 'best ' + fmtTime(best) : '';
    timeEl.querySelector('.best').style.display = best ? '' : 'none';
    size();
  }
  ui.onTap((which) => {
    if (which === 'start') { P.state = 'play'; return; }
    if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
    build(); P.state = 'play';
  });

  const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let down = false;
  cv.addEventListener('pointerdown', (e) => { if (P.state !== 'play') return; down = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} o.down && o.down(...loc(e)); });
  cv.addEventListener('pointermove', (e) => { if (!down || P.state !== 'play') return; o.move && o.move(...loc(e)); });
  const up = (e) => { if (!down) return; down = false; if (P.state === 'play') o.up && o.up(...loc(e)); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  P.start = () => {
    build();
    loop((dt, t) => {
      if (P.state === 'play' && !document.hidden) secs += dt / 60;
      const s = Math.floor(secs); if (s !== shownSec) { shownSec = s; timeEl.querySelector('.now').textContent = fmtTime(s); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      o.draw(g, t, P.area());
    });
    window.__game = {
      get state() { return P.state; }, get level() { return level; }, get score() { return score; },
      bot() { if (P.state === 'play' && !down) o.bot(); },
      get debug() { return o.debug ? o.debug() : null; },   // read-only QA snapshot
    };
  };
  return P;
}
