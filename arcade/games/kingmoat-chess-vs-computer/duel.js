// duel.js — shared shell for our vs-computer board classics (copied into each game folder). Our own code, MIT.
// Gives a game: dark-glass start / win / lose cards with Easy / Normal / Hard chips, a daily duel (?daily=1 → D.seed seeds the
// CPU's own random choices), the CPU and You rows around the board, a full-screen board canvas with pointer input,
// a CPU that thinks in a Web Worker (the page never freezes), undo on Easy, win/loss/draw records, 2D confetti,
// honest flow wiring, the world board (wins vs CPU) and the window.__game test hook.
import { createUI, store, buzz, note, tone, loop } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, arp, soft, chime, todayKey } from './calm.js';
export { buzz, note, tone, arp, soft, chime, css };

export const DIFFS = ['Easy', 'Normal', 'Hard'];
export function rngf(seed) {
  let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 6; i++) r();
  return r;
}
export function rrect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export const ease = {
  out: (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3),
  inout: (t) => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  back: (t) => { t = Math.min(1, Math.max(0, t)); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
const SVG = {
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  new: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg>',
  hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg>',
};

export function duel(o) {
  const { key, name, brand, kicker, accent, bg, ink = '#2d2a3e', B, hint = '', youAv, cpuAv, youSub = '', short = brand } = o;
  const S = store(key), F = flow(key);
  const ui = createUI({ title: brand, hint: 'Tap to play', hand: '', score: false, progress: false });
  cardTheme({ accent });
  const D = daily(key, ui, { name });
  const fx = fx2d(11);
  let diff = D.isDaily ? 1 : Math.max(0, Math.min(2, S.get('diff', 0)));
  const wonDaily = S.get('daily_' + todayKey(), 0);
  startCard(ui, D, {
    kicker: D.isDaily ? 'Daily duel · Normal CPU' : kicker,
    doneLine: D.isDaily ? (wonDaily ? 'You beat today’s CPU ✓' : null) : (wonDaily ? 'Daily duel won ✓' : 'Same CPU for everyone today'),
    chips: D.isDaily ? null : { items: DIFFS, get: () => diff, set: (i) => { diff = i; S.set('diff', i); soft.click(); } },
  });
  const back = ui.els.start.querySelector('.calm-link'); if (back) back.textContent = 'Back to my games';
  if (hint) { const p = document.createElement('p'); p.className = 'du-hintline'; p.textContent = hint; ui.els.start.querySelector('.calm-kicker').after(p); }
  const wp = ui.els.win.querySelector('p'); wp.className = 'calm-kicker'; wp.innerHTML = '<span data-l></span>';
  ui.els.win.querySelector('.hint').textContent = 'Tap for a new game';
  ui.els.lose.querySelector('.hint').textContent = 'Tap for a rematch';
  const pop0 = ui.pop; ui.pop = (t, c = '#fff', ...rest) => pop0(t, c === '#fff' ? ink : c, ...rest);

  css(`
  body{background:radial-gradient(120% 70% at 50% 0%,${bg[0]},${bg[1]});color:${ink}}
  body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(255,255,255,.5) 1.2px,transparent 1.6px);background-size:22px 22px;opacity:.55;pointer-events:none}
  .hc-card{color:#fff}
  .du-hintline{font-size:15px!important;opacity:.8!important;max-width:320px;margin-top:6px!important}
  .hc-pop{text-shadow:0 0 14px rgba(255,255,255,.95),0 0 4px rgba(255,255,255,.9)!important}
  .hc-sub{top:calc(22px + env(safe-area-inset-top));font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:750;color:${ink};opacity:.55;text-shadow:none}
  #du-cv{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
  .du-row{position:fixed;z-index:3;display:flex;align-items:center;gap:10px;height:42px;pointer-events:none}
  .du-row .av{width:34px;height:34px;border-radius:50%;flex:none;box-shadow:0 3px 10px rgba(30,20,50,.18);transition:box-shadow .3s,transform .3s}
  .du-row.on .av{box-shadow:0 0 0 3px #fff,0 0 0 5.5px ${accent},0 4px 14px rgba(30,20,50,.2);transform:scale(1.06)}
  .du-row .nm{font-weight:760;font-size:16px;line-height:1.15;white-space:nowrap}
  .du-row .nm small{display:block;font-weight:600;font-size:12px;opacity:.6}
  .du-row .ex{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:750;font-variant-numeric:tabular-nums}
  .du-row .tk{display:none;gap:3px;margin-left:2px}.du-row.think .tk{display:inline-flex}
  .du-row .tk i{width:6px;height:6px;border-radius:50%;background:${accent};animation:dut 1s infinite}
  .du-row .tk i:nth-child(2){animation-delay:.15s}.du-row .tk i:nth-child(3){animation-delay:.3s}
  @keyframes dut{0%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
  #du-status{position:fixed;left:0;right:0;z-index:3;display:flex;justify-content:center;pointer-events:none}
  #du-status span{background:rgba(255,255,255,.78);border-radius:16px;padding:5px 14px;font-weight:700;font-size:14px;box-shadow:0 2px 10px rgba(40,30,70,.07);transition:opacity .25s;white-space:nowrap}
  #du-status span:empty{display:none}
  .du-pill{background:rgba(255,255,255,.85);border-radius:12px;padding:2px 10px;box-shadow:0 2px 8px rgba(40,30,70,.08)}
  #du-bar{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(18px,8vw,40px);z-index:5}
  .du-b{display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit;font-size:11px;font-weight:750;color:${ink};background:none;border:0;cursor:pointer;letter-spacing:1px;text-transform:uppercase;position:relative;padding:0;-webkit-tap-highlight-color:transparent}
  .du-b .c{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(40,30,70,.13),inset 0 -2px 0 rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;transition:transform .12s,opacity .2s}
  .du-b svg{width:24px;height:24px;stroke:${ink};fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .du-b:active .c{transform:scale(.9)}
  .du-b.dim{opacity:.4}
  `);
  const cv = document.createElement('canvas'); cv.id = 'du-cv'; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  const row = (cls, av, nm, sub) => { const d = document.createElement('div'); d.className = 'du-row ' + cls; d.innerHTML = `<div class="av" style="background:${av}"></div><div class="nm"><span data-n>${nm}</span><small data-s>${sub}</small></div><span class="tk"><i></i><i></i><i></i></span><div class="ex"></div>`; document.body.appendChild(d); return d; };
  const rowCpu = row('cpu', cpuAv, 'CPU', ''), rowYou = row('you', youAv, 'You', youSub);
  const status = document.createElement('div'); status.id = 'du-status'; status.innerHTML = '<span></span>'; document.body.appendChild(status);
  const bar = document.createElement('div'); bar.id = 'du-bar'; document.body.appendChild(bar);
  const btns = {};
  function button(id, label, svg, onPress) {
    const b = document.createElement('button'); b.className = 'du-b'; b.innerHTML = `<div class="c">${svg}</div><span>${label}</span>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onPress(b); });
    bar.appendChild(b); btns[id] = b; return b;
  }

  let turnAt = 0, dpr = 1, W = 0, H = 0, rect = { x: 0, y: 0, w: 100, h: 100 };
  let thinkTok = 0, stack = [], recorded = false, t0 = performance.now(), wins = S.get('wins', 0), beatenShown = false;
  const P = {
    S, F, D, ui, fx, g, cv, btns, state: 'ready', turn: 0, busy: false, fast: false, diff, seed: 1, rand: Math.random,
    get W() { return W; }, get H() { return H; }, get rect() { return rect; },
    /** fit a w:h board into the play area (a little above centre) */
    fit(a, ratio = 1) {
      let w = Math.min(a.w, a.h * ratio, 640), h = w / ratio;
      return { x: Math.round(a.x + (a.w - w) / 2), y: Math.round(a.y + Math.max(0, (a.h - h) * 0.42)), w: Math.round(w), h: Math.round(h) };
    },
    dur: (ms) => (P.fast ? ms * 0.15 : ms),
    hud() {
      const rec = S.get('rec' + P.diff, { w: 0, l: 0, d: 0 });
      ui.sub(`${D.isDaily ? 'Daily duel' : short} · ${DIFFS[P.diff]} · ${rec.w}W ${rec.l}L${rec.d ? ` ${rec.d}D` : ''}`);
      rowCpu.querySelector('[data-s]').textContent = DIFFS[P.diff] + (D.isDaily ? ' · daily' : '');
      if (o.extra) { rowCpu.querySelector('.ex').innerHTML = o.extra(1) || ''; rowYou.querySelector('.ex').innerHTML = o.extra(0) || ''; }
      if (o.youLine) rowYou.querySelector('[data-s]').textContent = o.youLine();
      btns.undo && btns.undo.classList.toggle('dim', P.diff !== 0 || !stack.length || P.state !== 'play');
    },
    setTurn(t) {
      if (t === 0 && P.turn !== 0) turnAt = performance.now();
      P.turn = t; rowYou.classList.toggle('on', t === 0 && P.state === 'play'); rowCpu.classList.toggle('on', t === 1 && P.state === 'play');
      if (t === 0) rowCpu.classList.remove('think');
      if (o.statusText) P.status(o.statusText(t));
      P.hud();
    },
    /** snapshot before each of the player's moves (undo on Easy) */
    push(s) { stack.push(s); if (stack.length > 400) stack.shift(); P.hud(); },
    /** ask the CPU for a move (Web Worker); resolves null if cancelled (undo / new game) */
    async think(payload) {
      const tok = ++thinkTok, start = performance.now();
      P.setTurn(1); rowCpu.classList.add('think');
      const minMs = P.fast ? 0 : (o.minThink || [650, 520, 420])[P.diff];
      let move = null;
      try { move = await ask(payload); } catch (e) { move = o.think(payload); }
      const left = minMs - (performance.now() - start); if (left > 0) await new Promise(r => setTimeout(r, left));
      if (tok !== thinkTok || P.state !== 'play') return null;
      rowCpu.classList.remove('think');
      return move;
    },
    cancel() { thinkTok++; rowCpu.classList.remove('think'); },
    /** the game is over: result 'win' | 'loss' | 'draw' */
    end(result, title, line = '', delay = 420) {
      if (P.state !== 'play') return;
      P.state = result === 'win' ? 'won' : 'lost'; P.cancel(); P.setTurn(-1);
      const rec = S.get('rec' + P.diff, { w: 0, l: 0, d: 0 }); rec[result[0]]++; S.set('rec' + P.diff, rec);
      if (!recorded) { recorded = true; if (!D.isDaily) F.level(result === 'win', result === 'draw' ? 0.8 : 0.3); }
      if (result === 'win') {
        wins++; S.set('wins', wins);
        B.submit(1, { ms: performance.now() - t0 });            // world board: one point per win vs the CPU (RULES.md)
        if (D.isDaily) S.set('daily_' + todayKey(), 1);
        D.won(wins, 'have won');
        if (!beatenShown && D.beaten(wins)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#d18b00', 40, 30); fx.confetti(60); }, 250); }
        arp([67, 72, 76, 79, 84], 95, 0.12, 0.9); buzz([20, 50, 20]); setTimeout(() => fx.confetti(), 200);
      } else if (result === 'loss') { arp([64, 60, 55], 160, 0.1, 0.8); buzz([40, 60, 40]); }
      else arp([67, 72, 67], 140, 0.1, 0.8);
      P.hud();
      setTimeout(() => {
        if (result === 'win') { ui.els.win.querySelector('h1').textContent = title; ui.win(`You beat the ${DIFFS[P.diff]} CPU`, line); }
        else ui.lose(title, line);
      }, P.fast ? 150 : delay);
    },
    button,
    status(html) { status.firstChild.innerHTML = html || ''; },
    /** % from the top for ui.pop: in the open space above the CPU row */
    popY: () => Math.max(9, (rect.y - 92) / H * 100),
  };

  // ---------------------------------------------------------------- CPU in a Web Worker (falls back to the main thread)
  let worker = null, wid = 0; const waiting = new Map();
  try {
    worker = new Worker(o.worker, { type: 'module' });
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); w.res(e.data.move); } };
    worker.onerror = (e) => { e.preventDefault && e.preventDefault(); worker = null; for (const [id, w] of waiting) { waiting.delete(id); w.res(o.think(w.payload)); } };
  } catch (e) { worker = null; }
  function ask(payload) {
    if (!worker) return new Promise(r => setTimeout(() => r(o.think(payload)), 30));
    return new Promise((res) => { const id = ++wid; waiting.set(id, { res, payload }); worker.postMessage({ id, payload }); });
  }

  // ---------------------------------------------------------------- buttons
  button('undo', 'Undo', SVG.undo, () => {
    if (P.state !== 'play') return;
    if (P.diff !== 0) { soft.err(); ui.pop('Undo is for Easy games', '#fff', 22, 44); return; }
    if (!stack.length || P.busy) { soft.err(); return; }
    P.cancel(); o.restore(stack.pop()); P.busy = false; P.setTurn(0); soft.swish(); buzz(6);
  });
  (o.buttons || []).forEach(b => button(b.id, b.label, b.svg || SVG.hint, b.onPress));
  button('new', 'New', SVG.new, () => { if (P.state === 'ready') return; P.cancel(); P.state = 'ready'; P.setTurn(-1); soft.click(); ui.start(); });

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
    const top = 58 + 48, bot = 104 + 50 + 44;
    const a = { x: 10, y: top, w: W - 20, h: Math.max(160, H - top - bot), W, H };
    rect = o.layout(a, P);
    const rw = Math.max(rect.w, Math.min(W - 24, 360)), rx = Math.round((W - rw) / 2);
    for (const [el, y] of [[rowCpu, rect.y - 50], [rowYou, rect.y + rect.h + 8]]) { el.style.left = rx + 'px'; el.style.width = rw + 'px'; el.style.top = y + 'px'; }
    status.style.top = (rect.y + rect.h + 58) + 'px';
  }
  addEventListener('resize', size);

  function newGame() {
    P.cancel(); P.diff = diff;
    P.seed = D.seed ? D.seed * 7 + 3 : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    P.rand = rngf(P.seed); stack = []; recorded = false; P.busy = false; t0 = performance.now();
    P.state = 'play'; B.start(); o.newGame(P); P.setTurn(0);
  }
  ui.onTap((which) => {
    if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
    newGame();
  });

  const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let down = false;
  const canAct = () => P.state === 'play' && P.turn === 0 && !P.busy;
  cv.addEventListener('pointerdown', (e) => { if (!canAct()) return; down = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} o.down && o.down(...loc(e)); });
  cv.addEventListener('pointermove', (e) => { if (P.state === 'play') o.hover && o.hover(...loc(e), down); if (!down) return; o.move && o.move(...loc(e)); });
  const up = (e) => { if (!down) return; down = false; if (canAct()) o.up && o.up(...loc(e)); else o.cancelDrag && o.cancelDrag(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  P.start = () => {
    o.newGame(P); P.state = 'ready'; size(); P.setTurn(-1);
    loop((dt, t) => { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); o.draw(g, performance.now(), P); });
    window.__game = {
      get state() { return P.state; }, get level() { return wins + 1; }, get score() { return wins; },
      // QA bot: plays your side; o.botPace keeps its wins at a human-plausible pace for the world board's speed check
      bot() { if (P.state === 'play' && P.turn === 0 && !P.busy && !down && performance.now() - turnAt >= (o.botPace || 0)) { P.fast = true; o.bot(P); } },
      get debug() { return o.debug ? o.debug() : null; },
    };
  };
  return P;
}
