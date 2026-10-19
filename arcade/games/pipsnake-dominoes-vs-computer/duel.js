// duel.js — shared shell for our calm "you vs the computer" table games (copied into each game folder). Our own code, MIT.
// Gives a game: a start card with Easy / Normal / Hard, a players header with turn glow, a status line, a toolbar,
// a full-screen board canvas with pointer input, tween helpers, 2D confetti, honest flow + daily + world-board wiring,
// and win / lose / draw cards. The game supplies newGame / draw / input / bot.
import { createUI, store, buzz, note, tone, loop } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, fx2d, arp, soft, chime } from './calm.js';
export { buzz, note, tone, arp, soft, chime, css };

export function rngf(seed) {
  let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 6; i++) r();
  return r;
}
/** fair random in [0,1): crypto when available (never seeded by the game), used for dice and shuffles outside the daily game */
export function fair() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
}
export function shuffle(a, r = fair) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function rrect(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export const ease = {
  out: (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3),
  inOut: (t) => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  back: (t) => { t = Math.min(1, Math.max(0, t)); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
export const SVG = {
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  draw: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>',
};
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const eat = (el) => { el.addEventListener('pointerdown', e => e.stopPropagation()); return el; };

export function duel(o) {
  const { key, name, brand, kicker, rule = '', accent, bg, ink = '#2d2a3e', B, diffs = ['Easy', 'Normal', 'Hard'],
    dailyBtn = false, dailyLine = 'Same game for everyone today', chips2 = null, winWord = 'You win!' } = o;
  const S = store(key), F = flow(key);
  const ui = createUI({ title: brand, hint: 'Tap to play', hand: '', score: false });
  cardTheme({ accent });
  const D = daily(key, ui, { name });
  const fx = fx2d(11);
  let diff = D.isDaily ? 1 : Math.max(0, Math.min(diffs.length - 1, S.get('diff', 1)));

  // ---------------------------------------------------------------- start card
  {
    const card = ui.els.start, h1 = card.querySelector('h1'), hint = card.querySelector('.hint');
    const k = document.createElement('p'); k.className = 'calm-kicker'; k.textContent = D.isDaily ? 'Daily game' : kicker; h1.after(k);
    if (rule) { const r = document.createElement('p'); r.className = 'du-rule'; r.innerHTML = rule; k.after(r); }
    const chipRow = (items, get, set, label) => {
      const wrap = eat(document.createElement('div')); wrap.className = 'du-chipwrap';
      if (label) { const l = document.createElement('div'); l.className = 'du-chiplab'; l.textContent = label; wrap.appendChild(l); }
      const row = document.createElement('div'); row.className = 'calm-row'; row.style.marginTop = '0'; wrap.appendChild(row);
      const draw = () => { row.innerHTML = ''; items.forEach((c, i) => { const b = document.createElement('button'); b.className = 'calm-chip' + (i === get() ? ' on' : ''); b.textContent = c; b.onclick = (e) => { e.stopPropagation(); set(i); soft.click(); draw(); }; row.appendChild(b); }); };
      draw(); hint.before(wrap); return wrap;
    };
    if (!D.isDaily && diffs.length > 1) chipRow(diffs, () => diff, (i) => { diff = i; S.set('diff', i); }, 'Computer');
    if (chips2 && !D.isDaily) chipRow(chips2.items, chips2.get, chips2.set, chips2.label);
    const d = new Date();
    if (dailyBtn && !D.isDaily) {
      const b = eat(document.createElement('button')); b.className = 'calm-daily';
      b.innerHTML = `<div class="cal"><i>${MON[d.getMonth()]}</i><em>${d.getDate()}</em></div><div><b>Daily game</b><span>${dailyLine}</span></div>`;
      b.onclick = (e) => { e.stopPropagation(); const u = new URL(location.href); u.search = '?daily=1'; location.href = u.href; };
      hint.before(b);
    } else if (D.isDaily) {
      const a = eat(document.createElement('div')); a.className = 'calm-link'; a.textContent = 'Back to normal games';
      a.onclick = (e) => { e.stopPropagation(); const u = new URL(location.href); u.search = ''; location.href = u.href; };
      hint.before(a);
    }
  }
  ui.els.win.querySelector('p').innerHTML = 'vs computer · <span data-l></span>';
  ui.els.win.querySelector('h1').textContent = winWord;
  ui.els.lose.querySelector('.hint').textContent = 'Tap for a rematch';
  ui.els.win.querySelector('.hint').textContent = 'Tap for a rematch';
  const pop0 = ui.pop; ui.pop = (t, c = '#fff', ...rest) => pop0(t, c === '#fff' ? ink : c, ...rest);

  css(`
  body{background:radial-gradient(120% 70% at 50% 0%,${bg[0]},${bg[1]});color:${ink}}
  .hc-top{display:none!important}
  .hc-card{color:#fff}
  .hc-pop{text-shadow:0 0 14px rgba(255,255,255,.95),0 0 4px rgba(255,255,255,.9)!important}
  .du-rule{font-size:15px!important;max-width:320px;line-height:1.35;opacity:.85!important;margin-top:6px!important}
  .du-chipwrap{margin-top:14px;pointer-events:auto}
  .du-chiplab{font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;opacity:.6;margin-bottom:7px}
  #du-board{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
  #du-head{position:fixed;top:calc(10px + env(safe-area-inset-top));left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100% - 120px);display:flex;align-items:center;gap:6px;z-index:5;pointer-events:none}
  .du-pl{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.88);border-radius:22px;padding:4px 10px 4px 4px;box-shadow:0 3px 12px rgba(40,30,70,.10);transition:transform .25s,box-shadow .25s;border:2px solid transparent;min-width:0}
  .du-pl .av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:13px;flex:none}
  .du-pl .nm{font-size:12px;font-weight:700;opacity:.7;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .du-pl em{font-style:normal;font-weight:800;font-size:18px;font-variant-numeric:tabular-nums;min-width:14px;text-align:right}
  .du-pl.on{transform:scale(1.06);box-shadow:0 4px 16px rgba(40,30,70,.18);border-color:var(--c)}
  .du-pl.small .nm{display:none}
  #du-status{position:fixed;left:0;right:0;top:calc(58px + env(safe-area-inset-top));text-align:center;z-index:5;pointer-events:none;font-weight:700;font-size:15px;letter-spacing:.2px;opacity:.82;transition:opacity .2s}
  #du-status small{display:block;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;opacity:.6;font-weight:750;margin-bottom:1px}
  #du-bar{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(12px,5vw,26px);z-index:5;pointer-events:none}
  .du-b{display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit;font-size:10.5px;font-weight:750;color:${ink};background:none;border:0;cursor:pointer;letter-spacing:1px;text-transform:uppercase;position:relative;padding:0;pointer-events:auto;-webkit-tap-highlight-color:transparent}
  .du-b .c{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(40,30,70,.13),inset 0 -2px 0 rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;transition:transform .12s,background .2s}
  .du-b svg{width:23px;height:23px;stroke:${ink};fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .du-b.on .c{background:${accent}}.du-b.on svg{stroke:#fff}
  .du-b.go .c{background:${accent};animation:dugo 1.1s ease-in-out infinite}.du-b.go svg{stroke:#fff}
  @keyframes dugo{50%{transform:scale(1.08);box-shadow:0 8px 24px ${accent}88}}
  .du-b:active .c{transform:scale(.9)}
  .du-b.dim{opacity:.35}
  .du-b.gone{display:none}
  #du-toast{position:fixed;left:50%;transform:translateX(-50%);top:calc(92px + env(safe-area-inset-top));z-index:7;background:rgba(30,26,46,.86);color:#fff;font-weight:700;padding:7px 15px;border-radius:18px;font-size:14px;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap}
  `);
  const cv = document.createElement('canvas'); cv.id = 'du-board'; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  const head = document.createElement('div'); head.id = 'du-head'; document.body.appendChild(head);
  const statusEl = document.createElement('div'); statusEl.id = 'du-status'; document.body.appendChild(statusEl);
  const bar = document.createElement('div'); bar.id = 'du-bar'; document.body.appendChild(bar);
  const toastEl = document.createElement('div'); toastEl.id = 'du-toast'; document.body.appendChild(toastEl);
  let toastT = 0;

  let dpr = 1, W = 0, H = 0, gen = 0, anims = [], timers = [], recorded = false, playerMoved = false, score = 0, beatenShown = false;
  let wins = S.get('wins', 0), games = S.get('games', 0);
  const T = {
    S, F, D, B, ui, fx, g, cv, state: 'ready', speed: 1, bot: false,
    get diff() { return diff; }, get diffName() { return diffs[diff]; }, get W() { return W; }, get H() { return H; },
    get wins() { return wins; }, get busy() { return anims.length > 0; }, get gen() { return gen; },
    area() { const top = 92, bot = H - 98; return { x: 10, y: top, w: W - 20, h: Math.max(160, bot - top), W, H }; },
    /** gen-guarded timeout, scaled by the speed (the QA bot plays fast) */
    after(ms, fn) { const my = gen; const id = setTimeout(() => { timers = timers.filter(t => t !== id); if (my === gen) fn(); }, ms * T.speed); timers.push(id); return id; },
    /** tween: fn(p 0..1) every frame for ms, then done() */
    anim(ms, fn, done) { const a = { t0: performance.now(), ms: Math.max(1, ms * T.speed), fn, done, gen }; anims.push(a); fn(0); return a; },
    toast(t, ms = 1400) { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => toastEl.style.opacity = 0, ms); },
    status(t, small = '') { statusEl.innerHTML = (small ? `<small>${small}</small>` : '') + t; },
    /** players: [{ name, init, color, score }] — active: index or -1 */
    header(players, active = -1) {
      const many = players.length > 2;
      head.innerHTML = players.map((p, i) => `${i === 1 && !many ? '<span style="font-weight:800;opacity:.4;font-size:12px">vs</span>' : ''}<div class="du-pl ${i === active ? 'on' : ''} ${many ? 'small' : ''}" style="--c:${p.color}"><b class="av" style="background:${p.color}">${p.init}</b><span class="nm">${p.name}</span><em>${p.score}</em></div>`).join('');
    },
    score(n) { score = n; if (!beatenShown && D.beaten(n)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } },
    moved() { playerMoved = true; },
    button(id, label, svg, onPress) {
      const b = document.createElement('button'); b.className = 'du-b'; b.innerHTML = `<div class="c">${svg}</div><span>${label}</span>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (T.state !== 'play') return; if (b.classList.contains('dim')) { soft.err(); return; } onPress(b); });
      bar.appendChild(b); T.btns[id] = b; return b;
    },
    btns: {},
    setBtn(id, { dim, go, gone, label } = {}) {
      const b = T.btns[id]; if (!b) return;
      if (dim !== undefined) b.classList.toggle('dim', !!dim); if (go !== undefined) b.classList.toggle('go', !!go);
      if (gone !== undefined) b.classList.toggle('gone', !!gone); if (label !== undefined) b.querySelector('span').textContent = label;
    },
    /** result: 'win' | 'lose' | 'draw'. margin = how much you won by (share text). frac = how close you got (0..1) for flow. */
    end(result, { line = '', frac = 0.5, margin = 0, title = null } = {}) {
      if (T.state !== 'play') return;
      T.state = result === 'win' ? 'won' : 'lost';
      games++; S.set('games', games);
      if (!recorded) { recorded = true; if (!D.isDaily) F.level(result === 'win', result === 'draw' ? 0.5 : frac); }
      if (result === 'win') {
        wins++; S.set('wins', wins);
        B && B.submit(diff === 2 ? 2 : 1);                     // world board: wins vs CPU today (Hard counts 2)
        D.won(Math.max(1, margin), 'won by');
        arp([67, 72, 76, 79, 84], 95, 0.12, 0.9); buzz([20, 50, 20]);
        setTimeout(() => fx.confetti(130), 200);
        ui.win(D.isDaily ? 'daily game' : diffs[diff], line);
      } else {
        if (result === 'draw') arp([67, 72, 67], 110, 0.1, 0.6); else { soft.err(); arp([64, 60, 55], 140, 0.09, 0.7); }
        ui.lose(title || (result === 'draw' ? 'Draw!' : 'CPU wins'), line);
      }
      T.refreshButtons();
    },
    refreshButtons() { o.buttons && o.refresh && o.refresh(); },
  };

  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; o.layout && o.layout(T.area()); };
  addEventListener('resize', size);

  function abandon() {
    if (T.state === 'play' && playerMoved && !recorded && !D.isDaily) { recorded = true; F.level(false, o.frac ? o.frac() : 0.3); }
  }
  T.button('new', 'New', SVG.restart, () => { abandon(); gen++; anims = []; T.state = 'ready'; ui.start(); });
  (o.buttons || []).forEach(b => T.button(b.id, b.label, b.svg, b.onPress));

  function newGame() {
    gen++; anims = []; timers.forEach(clearTimeout); timers = []; recorded = false; playerMoved = false; score = 0; beatenShown = false;
    const fk = D.isDaily ? 1 : F.k();
    const seed = D.seed ? D.seed * 31 + 7 : Math.floor(fair() * 2147483646) + 1;
    B && B.start();
    T.state = 'play';
    o.newGame({ seed, diff, fk, daily: D.isDaily, games });
    size(); T.refreshButtons();
  }
  ui.onTap(() => newGame());

  const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let down = false;
  cv.addEventListener('pointerdown', (e) => { if (T.state !== 'play') return; down = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} o.down && o.down(...loc(e)); });
  cv.addEventListener('pointermove', (e) => { if (!down || T.state !== 'play') return; o.move && o.move(...loc(e)); });
  const up = (e) => { if (!down) return; down = false; if (T.state === 'play') o.up && o.up(...loc(e)); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  T.start = () => {
    size();
    o.idle && o.idle();                       // draw a resting board behind the start card
    loop((dt, t) => {
      const now = performance.now();
      if (anims.length) {
        const list = anims; anims = [];
        const keep = [];
        for (const a of list) {
          if (a.gen !== gen) continue;
          const p = Math.min(1, (now - a.t0) / a.ms); a.fn(p);
          if (p >= 1) { a.done && a.done(); } else keep.push(a);
        }
        anims = keep.concat(anims);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      o.draw(g, t, T.area());
    });
    window.__game = {
      get state() { return T.state; }, get level() { return wins + 1; }, get score() { return score; },
      bot() { if (T.state !== 'play' || down) return; if (!T.bot) { T.bot = true; T.speed = o.botSpeed || 0.3; } o.bot(); },
      get debug() { return o.debug ? o.debug() : null; },
    };
  };
  return T;
}
