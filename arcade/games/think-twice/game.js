// Think Twice! — original trick-puzzle game. Every level has a sneaky lateral answer.
// Framework: a notebook page with a question (words can be tapped/dragged), an SVG scene with tappable / draggable
// props, free hints, 3 tries per level, level select grid. Levels live in levels.js.
import { createUI, sfx, tone, buzz, store, loop } from './kit/hc.js';
import { LEVELS } from './levels.js';
import { pip } from './art.js';

const SV = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const svg = $('scene'), root = $('root'), fxg = $('fx'), defs = $('defs'), paper = $('paper');
const save = store('thinktwice');
const N = LEVELS.length;
let level = Math.min(N, save.get('level', 1)), maxL = Math.max(level, save.get('max', 1));
let botI = 0, botBusy = false, botWait = 0;
let state = 'ready', score = save.get('solved', 0), hearts = 3, gen = 0, cur = null, S = null, hintShown = false;

// ---------------------------------------------------------------- UI (kit cards)
const ui = createUI({ title: 'THINK<br>TWICE!', hint: 'Tap to play', hand: '', progress: false, score: false });
ui.els.start.insertAdjacentHTML('beforeend', `<div class="sub">Tricky puzzles. Sneaky answers.</div>
  <svg id="startArt" viewBox="-90 -215 180 230">${pip('happy', 1.15, true)}
  <g transform="translate(52,-196) rotate(14)"><text font-family="Patrick Hand,cursive" font-size="58" font-weight="700" fill="#ffd84d" stroke="#2b2b2b" stroke-width="3" paint-order="stroke">?</text></g>
  <g transform="translate(-78,-170) rotate(-16)"><text font-family="Patrick Hand,cursive" font-size="40" font-weight="700" fill="#7fe3ec" stroke="#2b2b2b" stroke-width="3" paint-order="stroke">!</text></g></svg>`);
ui.els.start.appendChild(ui.els.start.querySelector('.hint'));
const PRAISE = ['Genius!', 'Big brain!', 'Sneaky!', 'Nailed it!', 'Clever!', 'Brilliant!', 'Smart move!', 'You got it!'];

// ---------------------------------------------------------------- helpers
function toSvg(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(root.getScreenCTM().inverse()); }
function toScreen(x, y) { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; return pt.matrixTransform(root.getScreenCTM()); }
const easeOut = (k) => 1 - Math.pow(1 - k, 3), easeIn = (k) => k * k * k, easeInOut = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeBack = (k) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function tween(ms, fn, ease = easeOut) {
  const my = gen;
  return new Promise((res) => { const t0 = performance.now(); const tick = () => { if (gen !== my) return; const k = Math.min(1, (performance.now() - t0) / ms); fn(ease(k), k); if (k < 1) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
}
function apply(g) { const t = g._t; g.setAttribute('transform', `translate(${t.x.toFixed(2)},${t.y.toFixed(2)}) rotate(${t.r.toFixed(2)}) scale(${(t.s * t.sx).toFixed(3)},${(t.s * t.sy).toFixed(3)})`); }
function frag(str, cls) { const g = document.createElementNS(SV, 'g'); if (cls) g.setAttribute('class', cls); g.innerHTML = str; return g; }
function wait(ms) { const my = gen; return new Promise((r) => setTimeout(() => gen === my && r(), ms)); }

// ---------------------------------------------------------------- scene API handed to each level
function makeScene() {
  const my = gen, timers = [], ticks = [];
  const api = {
    W: 360, H: 440, level, svg, root, fx: fxg, defs,
    get alive() { return gen === my && state === 'play'; },
    /** add an SVG object; content is drawn around its own origin and the group is placed at x,y */
    obj(str, x = 0, y = 0, o = {}) {
      const g = frag(str, o.cls); g._t = { x, y, r: o.r || 0, s: o.s || 1, sx: 1, sy: 1 }; apply(g);
      (o.parent || root).appendChild(g); g.home = { x, y };
      g.set = (p) => { Object.assign(g._t, p); apply(g); return g; };
      g.to = (p, ms = 300, ease) => { const from = { ...g._t }; return tween(ms, (k) => { for (const key in p) g._t[key] = from[key] + (p[key] - from[key]) * k; apply(g); }, ease); };
      g.front = () => g.parentNode.appendChild(g);
      return g;
    },
    tween, wait, easeOut, easeIn, easeInOut, easeBack,
    /** tap (no-drag) and/or drag on an object */
    interact(g, { tap, drag } = {}) {
      g.style.cursor = 'pointer'; g._tap = tap; g._drag = drag;
      g.classList.add(drag ? 'dragme' : 'tapme');
      g.addEventListener('pointerdown', (e) => {
        if (!api.alive || g._off) return; e.stopPropagation(); e.preventDefault(); sfx.tap();
        const p0 = toSvg(e), start = { ...g._t }; let moved = false;
        try { g.setPointerCapture(e.pointerId); } catch (er) {}
        if (drag && drag.front !== false) g.front();
        const mv = (ev) => {
          const p = toSvg(ev), dx = p.x - p0.x, dy = p.y - p0.y;
          if (!moved && Math.hypot(dx, dy) > 7) { moved = true; drag && drag.start && drag.start(g); }
          if (moved && drag) {
            let nx = drag.axis === 'y' ? start.x : start.x + dx, ny = drag.axis === 'x' ? start.y : start.y + dy;
            if (drag.clamp) [nx, ny] = drag.clamp(nx, ny);
            g.set({ x: nx, y: ny }); drag.move && drag.move(g, p, dx, dy);
          }
        };
        const up = (ev) => {
          g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
          if (!api.alive) return;
          if (!moved) { tap && tap(g, toSvg(ev)); if (!tap && drag) api.say('Drag me!', g._t.x, g._t.y - 40, 700); }
          else if (drag) { const r = drag.drop ? drag.drop(g, toSvg(ev)) : true; if (r === false) g.to({ x: start.x, y: start.y }, 280, easeBack); }
        };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
      });
      return g;
    },
    /** question words: {id:text} in the question becomes a span */
    word(id) { return $('q').querySelector(`[data-id="${id}"]`); },
    tapWord(id, fn) { const s = api.word(id); s.addEventListener('pointerdown', (e) => { if (!api.alive) return; e.stopPropagation(); sfx.tap(); fn(s); }); s._tap = fn; return s; },
    dragWord(id, { drop, tap }) {
      const s = api.word(id); s._drop = drop;
      s.addEventListener('pointerdown', (e) => {
        if (!api.alive || s.classList.contains('gone')) return; e.stopPropagation(); e.preventDefault(); sfx.tap();
        const fl = document.createElement('div'); fl.className = 'floatword'; fl.textContent = s.textContent; document.body.appendChild(fl);
        let moved = false; const x0 = e.clientX, y0 = e.clientY;
        const place = (ev) => { fl.style.left = ev.clientX + 'px'; fl.style.top = (ev.clientY - 18) + 'px'; };
        place(e); fl.style.opacity = 0;
        const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6 && !moved) { moved = true; fl.style.opacity = 1; s.style.opacity = .25; } place(ev); };
        const up = (ev) => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
          if (!moved) { fl.remove(); tap && tap(s); return; }
          const ok = api.alive && drop(toSvg({ clientX: ev.clientX, clientY: ev.clientY - 18 }), s);
          if (ok) { s.classList.add('gone'); s.style.opacity = ''; fl.remove(); }
          else { fl.style.transition = 'left .25s, top .25s'; const r = s.getBoundingClientRect(); fl.style.left = r.left + r.width / 2 + 'px'; fl.style.top = r.top + r.height / 2 + 'px'; setTimeout(() => { fl.remove(); s.style.opacity = ''; }, 260); }
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
      });
      return s;
    },
    /** gentle feedback with no penalty */
    say(text, x = 180, y = 60, ms = 1300) {
      const w = Math.max(60, text.length * 9.4 + 26);
      const g = api.obj(`<g><rect x="${-w / 2}" y="-20" width="${w}" height="38" rx="16" fill="#fff" class="ink"/><path d="M-8 17 L0 30 L8 17" fill="#fff" class="ink"/><rect x="${-w / 2 + 2}" y="12" width="${w - 4}" height="7" fill="#fff"/>
        <text y="7" text-anchor="middle" class="hand" font-size="21" fill="#2b2b2b">${text}</text></g>`, Math.max(w / 2 + 4, Math.min(356 - w / 2, x)), Math.max(26, y), { parent: fxg, s: .4 });
      g.to({ s: 1 }, 260, easeBack); setTimeout(() => g.to({ s: 0 }, 180, easeIn).then(() => g.remove()), ms); return g;
    },
    /** wrong answer: red cross + lose a try */
    wrong(x = 180, y = 220, text) {
      if (!api.alive) return;
      const g = api.obj(`<g><path d="M-26 -26 L26 26 M26 -26 L-26 26" stroke="#ff4458" stroke-width="12" stroke-linecap="round"/><path d="M-26 -26 L26 26 M26 -26 L-26 26" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/></g>`, x, y, { parent: fxg, s: .2 });
      g.to({ s: 1.1 }, 220, easeBack); setTimeout(() => g.to({ s: 0 }, 200, easeIn).then(() => g.remove()), 650);
      sfx.fail(); buzz([40, 30, 40]); paper.classList.remove('shake'); void paper.offsetWidth; paper.classList.add('shake');
      if (text) api.say(text, x, y - 50, 1200);
      hearts--; drawHearts();
      if (hearts <= 0) { state = 'lost'; setTimeout(() => ui.lose('OUT OF TRIES!', 'Think twice… then try again.'), 400); }
    },
    nope(text, x, y) { tone(300, 0.08, 'triangle', 0.08, 0.8); api.say(text, x, y); },
    good(x, y, text) { sfx.coin(); if (text) api.say(text, x, y - 40, 900); sparkle(x, y); },
    win(x = 180, y = 220) { if (!api.alive) return; doWin(x, y); },
    lose(t, line) { if (!api.alive) return; state = 'lost'; sfx.fail(); buzz(120); setTimeout(() => ui.lose(t, line), 500); },
    every(ms, fn) { const id = setInterval(() => { if (gen !== my) return clearInterval(id); fn(); }, ms); timers.push(id); },
    later(ms, fn) { const id = setTimeout(() => gen === my && fn(), ms); timers.push(id); },
    tick(fn) { ticks.push(fn); },
    /** bot helpers */
    async botDrag(g, ...pts) {
      if (typeof pts[0] === 'number') pts = [[pts[0], pts[1]]];
      g._drag && g._drag.start && g._drag.start(g); if (g._drag && g._drag.front !== false) g.front();
      for (const [x, y] of pts) {
        const sx = g._t.x, sy = g._t.y, d = Math.hypot(x - sx, y - sy);
        await tween(Math.max(160, d * 2.6), (k) => { g.set({ x: sx + (x - sx) * k, y: sy + (y - sy) * k }); g._drag && g._drag.move && g._drag.move(g, { x: g._t.x, y: g._t.y }, g._t.x - sx, g._t.y - sy); }, easeInOut);
      }
      if (!api.alive) return;
      const r = g._drag && g._drag.drop ? g._drag.drop(g, { x: g._t.x, y: g._t.y }) : true; if (r === false) g.to({ x: g.home.x, y: g.home.y }, 280);
    },
    botTap(g) { g._tap && g._tap(g, { x: g._t.x, y: g._t.y }); },
    async botWord(id, x, y) {
      const s = api.word(id), r = s.getBoundingClientRect(), fl = document.createElement('div'); fl.className = 'floatword'; fl.textContent = s.textContent; document.body.appendChild(fl);
      s.style.opacity = .25; const a = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, b = toScreen(x, y);
      await tween(700, (k) => { fl.style.left = a.x + (b.x - a.x) * k + 'px'; fl.style.top = a.y + (b.y - a.y) * k + 'px'; }, easeInOut);
      fl.remove(); s.style.opacity = ''; if (api.alive && s._drop({ x, y }, s)) s.classList.add('gone');
    },
    _cleanup() { timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); },
    _ticks: ticks,
    pip(mood = 'neutral', x = 180, y = 400, s = 1, o = {}) {
      const g = api.obj(pip(mood, 1, false), x, y, { s, ...o });
      g.mood = (m) => { g.querySelector('.face').innerHTML = pip.face(m); }; return g;
    },
  };
  return api;
}

// ---------------------------------------------------------------- feedback fx
function sparkle(x, y, n = 8, col = '#ffd84d') {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, g = frag(`<path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z" fill="${col}" stroke="#2b2b2b" stroke-width="1.2"/>`);
    fxg.appendChild(g);
    tween(520, (k) => g.setAttribute('transform', `translate(${x + Math.cos(a) * 40 * k},${y + Math.sin(a) * 40 * k}) scale(${1.2 - k})`)).then(() => g.remove());
  }
}
function doWin(x, y) {
  state = 'won';
  const g = frag(`<circle r="62" fill="#8fe3a8" class="ink" opacity=".95"/><path d="M-30 2 L-8 24 L32 -22" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M-30 2 L-8 24 L32 -22" fill="none" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".0"/>`);
  fxg.appendChild(g);
  tween(380, (k) => g.setAttribute('transform', `translate(180,200) scale(${easeBack(k)})`), (k) => k);
  sparkle(180, 200, 12); setTimeout(() => sparkle(180, 200, 10, '#7fe3ec'), 150);
  sfx.win(); buzz([30, 40, 60]); confettiBurst();
  if (S && S._pip) S._pip.mood('happy');
  score++; save.set('solved', score);
  const done = save.get('done', []); if (!done.includes(level)) { done.push(level); save.set('done', done); }
  const next = level >= N ? 1 : level + 1; maxL = Math.max(maxL, next); save.set('max', maxL); save.set('level', next);
  const my = gen; setTimeout(() => gen === my && ui.win(level, PRAISE[(level * 7) % PRAISE.length]), 600);
}
// confetti on a 2D canvas overlay
const cv = $('conf'), cx = cv.getContext('2d'); let parts = [];
function confettiBurst() {
  const cols = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#7fe3ec'];
  for (let i = 0; i < 110; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .42, vx: (Math.random() - .5) * 15, vy: -Math.random() * 15 - 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, c: cols[i % 6], w: 6 + Math.random() * 6, life: 1 });
}
function resizeCv() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
addEventListener('resize', resizeCv); resizeCv();

// ---------------------------------------------------------------- level flow
function drawHearts() { $('hearts').innerHTML = [0, 1, 2].map((i) => `<i class="${i < hearts ? '' : 'off'}">♥</i>`).join(''); }
function renderQ(q) { $('q').innerHTML = q.replace(/\{(\w+):([^}:]+)(?::(\w+))?\}/g, (_, id, t, cls) => `<span class="qw ${cls || ''}" data-id="${id}">${t}</span>`); }
function load(n) {
  if (S) S._cleanup();
  gen++; level = n; cur = LEVELS[n - 1]; hearts = 3; hintShown = false;
  root.innerHTML = ''; fxg.innerHTML = ''; defs.innerHTML = ''; $('bubble').classList.add('hidden'); $('bHint').classList.remove('glow');
  $('lvl').textContent = 'LEVEL ' + n; renderQ(cur.q); drawHearts();
  S = makeScene(); botI = 0; botWait = performance.now() + 900;
  state = 'play';
  cur.setup(S);
  setTimeout(() => { if (S && gen && state === 'play') $('bHint').classList.add('glow'); }, 20000);
}
svg.addEventListener('pointerdown', (e) => { if (state === 'play' && S && cur.miss) cur.miss(S, toSvg(e)); });

$('bHint').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play') return; sfx.pick(3);
  if (cur.hintTap && cur.hintTap(S)) return;
  const b = $('bubble'); b.innerHTML = '<b>Hint:</b> ' + cur.hint; b.classList.remove('hidden'); hintShown = true; $('bHint').classList.remove('glow');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.add('hidden'), 4200);
});
$('bRestart').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state !== 'play' && state !== 'lost') return; sfx.tap(); load(level); });
$('bSkip').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play') return; sfx.pick(5);
  const next = level >= N ? 1 : level + 1; maxL = Math.max(maxL, next); save.set('max', maxL); save.set('level', next); load(next);
});
$('bGrid').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); sfx.tap(); const done = save.get('done', []);
  $('gcells').innerHTML = LEVELS.map((_, i) => `<button data-n="${i + 1}" class="${done.includes(i + 1) ? 'done' : ''} ${i + 1 === level ? 'cur' : ''}" ${i + 1 > maxL ? 'disabled' : ''}>${i + 1 > maxL ? '🔒' : i + 1}</button>`).join('');
  $('grid').classList.remove('hidden');
});
$('gcells').addEventListener('pointerdown', (e) => { const n = +e.target.dataset.n; if (!n || e.target.disabled) return; e.stopPropagation(); $('grid').classList.add('hidden'); ui.hideStart(); sfx.pick(2); load(n); });
$('gClose').addEventListener('pointerdown', (e) => { e.stopPropagation(); $('grid').classList.add('hidden'); });
$('grid').addEventListener('pointerdown', (e) => { if (e.target.id === 'grid') $('grid').classList.add('hidden'); });

ui.onTap((which) => {
  sfx.tap();
  if (which === 'start') load(level);
  else if (which === 'win') load(level >= N ? 1 : level + 1);
  else load(level);
});
// show the current level under the start card
load(level); state = 'ready';

// ---------------------------------------------------------------- bot (checker): runs the level's scripted solution one step at a time
function bot() {
  if (state !== 'play' || botBusy || !cur || !cur.bot || performance.now() < botWait) return;
  if (botI >= cur.bot.length) return;
  const r = cur.bot[botI](S); const my = gen;
  if (r && r.then) { botBusy = true; r.then(() => { botBusy = false; if (gen === my) { botI++; botWait = performance.now() + 350; } }); }
  else if (r !== false) { botI++; botWait = performance.now() + 350; }
}

loop((dt) => {
  if (S && state === 'play') for (const f of S._ticks) f(dt);
  cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); cx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.vy += 0.45 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= 0.008 * dt;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); cx.restore();
  }
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
});

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot, load: (n) => { ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); load(n); }, levels: N,
};
