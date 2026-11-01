// Think Twice! deep v2 (studio lane 4): the same trick-puzzle game, plus a 4-world level map with stars, Pip's hat collection,
// a daily trick, a clean-solve streak and 10 new levels (levels2.js). v1 stays untouched in v1.js.
// Think Twice! — original trick-puzzle game. Every level has a sneaky lateral answer.
// Framework: a notebook page with a question (words can be tapped/dragged), an SVG scene with tappable / draggable
// props, free hints, 3 tries per level, level select grid. Levels live in levels.js.
import { createUI, sfx, tone, buzz, store, loop } from './kit/hc.js';
import { LEVELS as L1 } from './levels.js';
import { NEW, WORLDS } from './levels2.js';
import { HATS } from './hats.js';
import { pip, pipHead, hat } from './art.js';
import { board } from './kit/board.js';
const B = board({ game: 'think-twice', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tr' });   // world board: levels cleared today (RULES.md C)

const SV = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const svg = $('scene'), root = $('root'), fxg = $('fx'), defs = $('defs'), paper = $('paper');
const LEVELS = L1.concat(NEW);
const save = store('thinktwice2');
const N = LEVELS.length;
const WSIZE = 10;
let level = Math.min(N, save.get('level', 1)), maxL = Math.max(level, save.get('max', 1));
let botI = 0, botBusy = false, botWait = 0;
let state = 'ready', score = save.get('solved', 0), hearts = 3, gen = 0, cur = null, S = null, hintShown = false;

// ---------------------------------------------------------------- meta (stars, hats, daily, streak)
// the star glyph is missing from some phone fonts: draw it. In HTML strings \u2605 = filled star, \u2606 = empty star; H() swaps them for SVG.
const SP = '<path d="M0 -17 L5 -6 L17 -5 L8 3 L11 15 L0 9 L-11 15 L-8 3 L-17 -5 L-5 -6Z" stroke="#2b2b2b" stroke-width="3.5" stroke-linejoin="round"/>';
const H = (h) => h.replace(/\u2605/g, `<svg class="gs" viewBox="-20 -20 40 40"><g fill="#ffd84d">${SP}</g></svg>`).replace(/\u2606/g, `<svg class="gs" viewBox="-20 -20 40 40"><g fill="#e5dccd">${SP}</g></svg>`);

const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const starsOf = () => save.get('stars', {});
const totalStars = () => Object.values(starsOf()).reduce((a, b) => a + b, 0) + save.get('bonus', 0);
const failsRun = {};

// ---- tricks found: every level teaches one kind of trick; solving any level of a kind "finds" it, 3 stars on all of them masters it
const TK = [['READ', 'Read it twice'], ['WORD', 'Drag a word'], ['DRAG', 'Move things'], ['COUNT', 'Count it all'], ['LOGIC', 'Think sideways'], ['WAIT', 'Be patient']];
const TRICK = 'READ READ WORD DRAG COUNT DRAG LOGIC WORD DRAG COUNT DRAG LOGIC DRAG DRAG LOGIC READ DRAG READ COUNT WORD DRAG DRAG READ DRAG LOGIC LOGIC DRAG DRAG LOGIC DRAG WAIT READ LOGIC WORD WAIT DRAG LOGIC COUNT DRAG DRAG'.split(' ');
const kindOf = (n) => TRICK[n - 1];
const kindLevels = (k) => TRICK.map((t, i) => t === k ? i + 1 : 0).filter(Boolean);
const kindFound = (k) => kindLevels(k).some((n) => starsOf()[n]);
const kindMaster = (k) => kindLevels(k).every((n) => (starsOf()[n] || 0) >= 3);
const trickRow = () => `<div class="tricks">${TK.map(([k, nm]) => { const ls = kindLevels(k), got = ls.filter((n) => starsOf()[n]).length; return `<span class="tk ${kindMaster(k) ? 'mas' : got ? 'on' : ''}"><b>${got ? nm : '???'}</b><i>${got}/${ls.length}${kindMaster(k) ? ' \u2605' : ''}</i></span>`; }).join('')}</div>`;
const unlockedHats = () => HATS.filter((h) => h.at <= totalStars());
const nextHat = () => HATS.find((h) => h.at > totalStars());
function equip(id) { const h = HATS.find((x) => x.id === id); hat.svg = h ? h.svg : ''; save.set('hat', h ? id : ''); }
equip(save.get('hat', ''));
const worldOf = (n) => Math.min(WORLDS.length - 1, Math.floor((n - 1) / WSIZE));
const isBoss = (n) => n % WSIZE === 0;
function frontier() { const st = starsOf(); for (let n = 1; n <= N; n++) if (!st[n]) return n; return 0; }
function metaStrip() {
  let m = document.getElementById('mstrip');
  if (!m) { m = document.createElement('div'); m.id = 'mstrip'; $('hdr').after(m); }
  const c = save.get('chestN', 0), nh = nextHat(), sk = save.get('streak', 0);
  m.innerHTML = H(`<span class="mp">\uD83C\uDF81 ${[0, 1, 2, 3, 4].map((i) => `<i class="${i < c ? 'on' : ''}"></i>`).join('')}</span>` +
    (sk >= 2 ? `<span class="mp hot">\uD83D\uDD25 ${sk}</span>` : '') +
    (nh ? `<span class="mp">\uD83C\uDFA9 <u><b style="width:${Math.min(100, Math.round(100 * totalStars() / nh.at))}%"></b></u> ${nh.at}\u2605</span>` : ''));
}
function dailyPick() {
  const t = today(); let d = save.get('daily', null);
  if (d && d.day === t) return d;
  const st = starsOf(), top = Math.min(N, Math.max(maxL, 3));
  let c = []; for (let n = 1; n <= top; n++) if ((st[n] || 0) < 3 && !isBoss(n)) c.push(n);
  if (!c.length) for (let n = 1; n <= top; n++) c.push(n);
  let h = 7; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  d = { day: t, n: c[h % c.length], done: false }; save.set('daily', d); return d;
}
const tomorrowLine = () => save.get('solved', 0) < 3 ? 'Come back tomorrow: a new Daily Trick' : 'Tomorrow: a new Daily Trick \u00b7 day ' + (save.get('dstreak', 0) + 1) + ' streak';

// ---------------------------------------------------------------- UI (kit cards)
const ui = createUI({ title: 'THINK<br>TWICE!', hint: '', hand: '', progress: false, score: false, button: 'PLAY' });
const startArt = () => `<svg id="startArt" viewBox="-90 -215 180 230">${pip('happy', 1.15, true)}
  <g transform="translate(52,-196) rotate(14)"><text font-family="Patrick Hand,cursive" font-size="58" font-weight="700" fill="#ffd84d" stroke="#2b2b2b" stroke-width="3" paint-order="stroke">?</text></g>
  <g transform="translate(-78,-170) rotate(-16)"><text font-family="Patrick Hand,cursive" font-size="40" font-weight="700" fill="#7fe3ec" stroke="#2b2b2b" stroke-width="3" paint-order="stroke">!</text></g></svg>`;
function fillStart() {
  const el = ui.els.start; el.querySelectorAll('.sub,#startArt,.schips').forEach((e) => e.remove());
  const d = dailyPick(), f = frontier();
  el.querySelector('h1').insertAdjacentHTML('afterend', startArt());
  el.querySelector('#startArt').insertAdjacentHTML('afterend', H(`<div class="sub">${f ? 'Level ' + Math.max(f, 1) : 'All solved!'} \u00b7 \u2605 ${totalStars()}</div>`));
  el.insertAdjacentHTML('beforeend', `<div class="schips"><button class="chip" data-a="map">MAP</button><button class="chip ${d.done ? 'done' : 'gold'}" data-a="daily">${d.done ? 'DAILY DONE' : 'DAILY TRICK'}</button></div>`);
  el.querySelectorAll('.chip').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); sfx.tap();
    if (b.dataset.a === 'map') openMap(); else { ui.hideStart(); load(dailyPick().n); }
  }));
}
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
        if (!api.alive || g._off) return; e.stopPropagation(); e.preventDefault(); sfx.tap(); lastG = g; lastGt = performance.now();
        const p0 = toSvg(e), start = { ...g._t }; let moved = false;
        squash(g);
        try { g.setPointerCapture(e.pointerId); } catch (er) {}
        if (drag && drag.front !== false) g.front();
        const mv = (ev) => {
          const p = toSvg(ev), dx = p.x - p0.x, dy = p.y - p0.y;
          if (!moved && Math.hypot(dx, dy) > 7) { moved = true; g.classList.add('lift'); tone(520, .06, 'triangle', .08, 1.3); drag && drag.start && drag.start(g); }
          if (moved && drag) {
            let nx = drag.axis === 'y' ? start.x : start.x + dx, ny = drag.axis === 'x' ? start.y : start.y + dy;
            if (drag.clamp) [nx, ny] = drag.clamp(nx, ny);
            g.set({ x: nx, y: ny }); drag.move && drag.move(g, p, dx, dy);
          }
        };
        const up = (ev) => {
          g.classList.remove('lift'); g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
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
      wrongN++; if (!text) text = JOKES[wrongN % JOKES.length];
      wrongFx(x, y);
      if (text) api.say(text, x, y - 50, 1200);
      hearts--; drawHearts();
      if (hearts === 1) { api.say('LAST TRY!', 180, 120, 1100); tone(220, .2, 'sawtooth', .1, .8); }
      if (hearts <= 0) { state = 'lost'; failsRun[level] = (failsRun[level] || 0) + 1; const f = failsRun[level]; failGag(); setTimeout(() => ui.lose(loseTitle(f), (f >= 2 && cur && cur.hint ? 'Psst: ' + cur.hint.replace(/<[^>]+>/g, '') : 'Tricky! Read the question again\u2026')), 1100); }
    },
    nope(text, x, y) { tone(300, 0.08, 'triangle', 0.08, 0.8); api.say(text, x, y); },
    good(x, y, text) { sfx.coin(); goodN++; tone(440 * Math.pow(1.122, Math.min(10, goodN * 2)), .16, 'triangle', .13, 1.15); dots(x, y); if (text) api.say(text, x, y - 40, 900); sparkle(x, y); },
    win(x = 180, y = 220) { if (!api.alive) return; doWin(x, y); },
    lose(t, line) { if (!api.alive) return; state = 'lost'; failsRun[level] = (failsRun[level] || 0) + 1; sfx.fail(); buzz(120); setTimeout(() => ui.lose(t, line), 500); },
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
let goodN = 0, wrongN = 0, lastG = null, lastGt = 0;
/** a wrong answer is felt on the thing you touched: each kind reacts differently + ripple + Pip winces */
function wrongFx(x, y) {
  const g = lastG && performance.now() - lastGt < 900 && lastG.isConnected ? lastG : null, k = wrongN % 4;
  tone(200 - k * 18, .22, 'sawtooth', .09, .6);
  const rg = frag('<circle r="14" fill="none" stroke="#ff4458" stroke-width="5"/>'); fxg.appendChild(rg);
  tween(480, (t) => { rg.setAttribute('transform', `translate(${x},${y}) scale(${1 + t * 4})`); rg.setAttribute('opacity', 1 - t); }).then(() => rg.remove());
  if (g && g._t) {
    const t0 = { ...g._t };
    if (k === 0) tween(520, (t) => { g._t.r = t0.r + Math.sin(t * 22) * 16 * (1 - t); apply(g); }, (t) => t).then(() => { g._t.r = t0.r; apply(g); });
    else if (k === 1) tween(560, (t) => { g._t.y = t0.y + Math.sin(t * Math.PI) * 26; g._t.sy = 1 - .25 * Math.sin(t * Math.PI); apply(g); }, (t) => t).then(() => { g._t.y = t0.y; g._t.sy = 1; apply(g); });
    else if (k === 2) tween(560, (t) => { g._t.x = t0.x + Math.sin(t * 30) * 12 * (1 - t); g._t.sx = 1 + .15 * Math.sin(t * Math.PI); apply(g); }, (t) => t).then(() => { g._t.x = t0.x; g._t.sx = 1; apply(g); });
    else tween(620, (t) => { const u = t < .5 ? t * 2 : 2 - t * 2; g._t.r = t0.r + 22 * u; g._t.s = t0.s * (1 - .25 * u); apply(g); }, (t) => t).then(() => { g._t.r = t0.r; g._t.s = t0.s; apply(g); });
  }
  const P = S && S._pip; if (P && P.mood) { P.mood('sad'); squash(P); setTimeout(() => S && S._pip === P && state === 'play' && P.mood('neutral'), 900); }
}
/** failing is a gag: Pip spins dizzy with orbiting stars before the retry card */
function failGag() {
  const P = S && S._pip; tone(330, .5, 'sawtooth', .08, .4);
  if (P && P._t) { P.mood && P.mood('sad'); const r0 = P._t.r || 0; tween(900, (t) => { P._t.r = r0 + Math.sin(t * 20) * 14 * (1 - t); P._t.sy = 1 - .2 * Math.sin(t * Math.PI); apply(P); }, (t) => t).then(() => { P._t.r = r0; P._t.sy = 1; apply(P); }); }
  const cx = P && P._t ? P._t.x : 180, cy = (P && P._t ? P._t.y : 400) - 70;
  for (let i = 0; i < 4; i++) { const g = frag('<path d="M0 -9 L3 -3 L9 0 L3 3 L0 9 L-3 3 L-9 0 L-3 -3Z" fill="#ffd84d" stroke="#2b2b2b" stroke-width="1.5"/>'); fxg.appendChild(g);
    tween(1000, (t) => { const a = t * 12 + i * 1.57; g.setAttribute('transform', `translate(${cx + Math.cos(a) * 34},${cy + Math.sin(a) * 10})`); g.setAttribute('opacity', 1 - t * t); }, (t) => t).then(() => g.remove()); }
}
/** a different 1s payoff for each puzzle */
function winGag(n) {
  const k = n % 6, cols = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff'];
  const mk = (str, fn, ms = 1100) => { const g = frag(str); fxg.appendChild(g); tween(ms, (t) => g.setAttribute('transform', fn(t)), (t) => t).then(() => g.remove()); };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28, x0 = 40 + i * 35, d = i * 40;
    setTimeout(() => {
      if (k === 0) mk(`<path d="M0 0c-9-9-16 4 0 14c16-10 9-23 0-14z" fill="#ff5d8f" stroke="#2b2b2b" stroke-width="1.5"/>`, (t) => `translate(${x0},${470 - t * 520}) scale(${1 + t * .3}) rotate(${Math.sin(t * 9 + i) * 14})`, 1300);
      else if (k === 1) mk(`<circle r="7" fill="#ffd23f" stroke="#2b2b2b" stroke-width="2"/>`, (t) => `translate(${180 + Math.cos(a) * 150 * t},${230 + Math.sin(a) * 120 * t + 140 * t * t})`, 900);
      else if (k === 2) mk(`<text font-size="26" text-anchor="middle" class="hand" fill="${cols[i % 5]}">${['\u2605', '!', '\u266a'][i % 3]}</text>`, (t) => `translate(${x0},${-20 + t * 520}) rotate(${t * 300})`, 1100);
      else if (k === 3) mk(`<circle r="${5 + i % 3 * 3}" fill="${cols[i % 5]}" stroke="#2b2b2b" stroke-width="1.5"/>`, (t) => `translate(${x0},${440 - Math.abs(Math.sin(t * 9)) * (260 - t * 200) * (1 - t * .3)})`, 1200);
      else if (k === 4) mk(`<path d="M-8 0 L0 -26 L8 0Z" fill="${cols[i % 5]}" stroke="#2b2b2b" stroke-width="1.5"/>`, (t) => `translate(${180 + (i - 4) * 18},${440 - t * 380}) rotate(${(i - 4) * 14 * t})`, 800);
      else mk(`<g><circle r="9" fill="#fff" stroke="#2b2b2b" stroke-width="2"/><path d="M-4 -1 L-1 3 L5 -4" stroke="#3ab795" stroke-width="3" fill="none"/></g>`, (t) => `translate(${40 + t * 280},${60 + i * 40 + Math.sin(t * 12 + i) * 14}) scale(${1 - t * .3})`, 1000);
      tone(500 + i * 70 + k * 40, .07, 'triangle', .07, 1.2);
    }, d / 3);
  }
}
const JOKES = ['Oof, tricked!', 'Think twice!', 'Nice try!', 'Sneaky, right?', 'Not quite!', 'Hehe, no!', 'Look closer!', 'Ooh, so close'];
function squash(g) {
  g._t.sx = 1.22; g._t.sy = .78; apply(g);
  tween(260, (k) => { g._t.sx = 1.22 - .22 * k + Math.sin(k * 9) * .06 * (1 - k); g._t.sy = .78 + .22 * k - Math.sin(k * 9) * .06 * (1 - k); apply(g); }, easeOut).then(() => { g._t.sx = 1; g._t.sy = 1; apply(g); });
}
function dots(x, y, n = 10) {
  const cols = ['#ff7a8a', '#ffd84d', '#6ad0ff', '#8fe3a8'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, d = 30 + Math.random() * 45, g = frag(`<circle r="${2.5 + Math.random() * 3}" fill="${cols[i % 4]}" stroke="#2b2b2b" stroke-width="1"/>`);
    fxg.appendChild(g);
    tween(480, (k) => { g.setAttribute('transform', `translate(${x + Math.cos(a) * d * k},${y + Math.sin(a) * d * k + 22 * k * k})`); g.setAttribute('opacity', 1 - k); }).then(() => g.remove());
  }
}
function sparkle(x, y, n = 8, col = '#ffd84d') {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, g = frag(`<path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z" fill="${col}" stroke="#2b2b2b" stroke-width="1.2"/>`);
    fxg.appendChild(g);
    tween(520, (k) => g.setAttribute('transform', `translate(${x + Math.cos(a) * 40 * k},${y + Math.sin(a) * 40 * k}) scale(${1.2 - k})`)).then(() => g.remove());
  }
}
const LOSE_T = ['SO CLOSE!', 'OOPS! TRICKY!', 'PIP IS CONFUSED', 'THINK TWICE!', 'ALMOST!'];
function loseTitle(f) { return LOSE_T[(level + f) % LOSE_T.length]; }
function shockwave(x, y) {
  [0, 1].forEach((i) => { const g = frag('<circle r="30" fill="none" stroke="#fff" stroke-width="10"/>'); fxg.appendChild(g);
    setTimeout(() => tween(520, (k) => { g.setAttribute('transform', `translate(${x},${y}) scale(${1 + k * 9})`); g.setAttribute('opacity', 1 - k); }).then(() => g.remove()), i * 120); });
}
// tap ripple + tiny blip on every tap in play
document.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || e.target.closest('button, #wcard, #grid')) return;
  const r = document.createElement('div'); r.className = 'ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
  document.body.appendChild(r); setTimeout(() => r.remove(), 450);
}, true);
function doWin(x, y) {
  if (state === 'play') B.submit(1); state = 'won';
  const g = frag(`<circle r="62" fill="#8fe3a8" class="ink" opacity=".95"/><path d="M-30 2 L-8 24 L32 -22" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>`);
  fxg.appendChild(g);
  tween(380, (k) => g.setAttribute('transform', `translate(180,200) scale(${easeBack(k)})`), (k) => k);
  sparkle(180, 200, 12); setTimeout(() => sparkle(180, 200, 10, '#7fe3ec'), 150);
  sfx.win(); buzz([30, 40, 60]); shockwave(180, 200); [0, 1, 2, 3].forEach((i) => setTimeout(() => tone(523 * Math.pow(1.2599, i + Math.min(3, save.get('streak', 0))), .12, 'triangle', .12, 1.1), 90 * i));
  paper.classList.remove('bump'); void paper.offsetWidth; paper.classList.add('bump');
  if (S && S._pip) { S._pip.mood('happy'); S._pip.to({ y: S._pip._t.y - 22 }, 220, easeOut).then(() => S._pip.to({ y: S._pip.home.y }, 260, easeBack)); }
  winGag(level);
  // --- stars: 3 = clean (no lost try, no hint, first run), each slip costs one
  const kd = kindOf(level), kNew = !kindFound(kd), kMasBefore = kindMaster(kd);
  const lostHearts = 3 - hearts, penalty = lostHearts + (failsRun[level] || 0) + (hintShown ? 1 : 0);
  const st = Math.max(1, 3 - penalty), all = starsOf(), old = all[level] || 0, first = !old;
  all[level] = Math.max(old, st); save.set('stars', all); failsRun[level] = 0;
  score++; save.set('solved', score);
  const done = save.get('done', []); if (!done.includes(level)) { done.push(level); save.set('done', done); }
  maxL = Math.max(maxL, Math.min(N, level + 1)); save.set('max', maxL);
  // --- streak of clean wins, day streak, daily, boss, world clear
  const chips = []; let bonus = 0;
  let streak = st === 3 ? save.get('streak', 0) + 1 : 0; save.set('streak', streak);
  const STREAK = { 2: 'SHARP x2', 3: 'SNEAKY x3', 4: 'SLICK x4', 5: 'GENIUS x5' };
  if (streak >= 2) chips.push(`<b class="hot">${STREAK[Math.min(streak, 5)] || 'LEGEND x' + streak}</b>`);
  if (streak > 0 && streak % 5 === 0) { bonus += 1; chips.push('<b>STREAK +1\u2605</b>'); }
  const t = today(), last = save.get('lastDay', '');
  if (last !== t) { save.set('dstreak', last === yesterday() ? save.get('dstreak', 0) + 1 : 1); save.set('lastDay', t); }
  const dly = dailyPick(); if (dly.n === level && !dly.done) { dly.done = true; save.set('daily', dly); bonus += 2; chips.push('<b class="gold">DAILY TRICK +2\u2605</b>'); }
  { const slips = lostHearts + (failsRun[level] || 0); const why = (slips ? 'slip \u2212' + Math.min(2, slips) + '\u2605 ' : '') + (hintShown ? 'hint \u22121\u2605' : '');
    if (st < 3 && why) chips.unshift(`<b class="why">${why}</b>`); else if (st === 3 && !old) chips.unshift('<b class="why">no slips = 3\u2605</b>'); }
  if (first && isBoss(level)) { confettiBurst(160); ui.flash(.6); [0, 1, 2, 3, 4].forEach((i) => setTimeout(() => tone(392 * Math.pow(1.2, i), .16, 'square', .1, 1.1), i * 90)); bonus += 2; chips.push('<b class="red">BOSS +2\u2605</b>'); }
  { const cw = save.get('chestN', 0) + 1; if (cw >= 5) { save.set('chestN', 0); const pr = 1 + (st === 3 ? 1 : 0); bonus += pr; chips.push(`<b class="gold">\uD83C\uDF81 CHEST +${pr}\u2605</b>`); confettiBurst(70); [0, 1, 2].forEach((i) => setTimeout(() => tone(660 * Math.pow(1.25, i), .12, 'triangle', .12, 1.1), i * 80)); }
    else { save.set('chestN', cw); chips.push(`<b>\uD83C\uDF81 chest ${cw}/5</b>`); } }
  const w = worldOf(level), wc = save.get('wclear', []);
  if (!wc.includes(w) && [...Array(WSIZE)].every((_, k) => { const n = w * WSIZE + k + 1; return n > N || all[n]; })) { wc.push(w); save.set('wclear', wc); bonus += 3; chips.push(`<b class="gold">${WORLDS[w][0].toUpperCase()} CLEARED +3\u2605</b>`); }
  { const sec = (performance.now() - t0) / 1000, bt = save.get('best', {}), pb = bt[level];
    if (!hintShown && sec < 10 && (!pb || sec < pb)) { bt[level] = Math.round(sec * 10) / 10; save.set('best', bt); const meds = save.get('medals', []); if (!meds.includes(level)) { meds.push(level); save.set('medals', meds); bonus += 1; chips.push('<b class="gold">\u26A1 QUICK ' + sec.toFixed(1) + 's +1\u2605</b>'); } else chips.push('<b class="hot">\u26A1 NEW BEST ' + sec.toFixed(1) + 's</b>'); } }
  { const nm = TK.find((t) => t[0] === kd)[1]; if (kNew) { bonus += 1; chips.unshift(`<b class="gold">NEW TRICK: ${nm.toUpperCase()} +1\u2605</b>`); } else if (!kMasBefore && kindMaster(kd)) { bonus += 2; chips.unshift(`<b class="gold">${nm.toUpperCase()} MASTERED +2\u2605</b>`); } }
  if (bonus) save.set('bonus', save.get('bonus', 0) + bonus);
  $('tot').innerHTML = H('\u2605 ' + totalStars()); metaStrip();
  // --- hats
  const seen = save.get('hatsSeen', []); const fresh = unlockedHats().filter((h) => !seen.includes(h.id));
  if (fresh.length) { save.set('hatsSeen', seen.concat(fresh.map((h) => h.id))); equip(fresh[fresh.length - 1].id); }
  const nh = nextHat(); if (nh && !fresh.length) chips.push(`<b>\u2605 ${totalStars()}/${nh.at} \u2192 new hat</b>`);
  confettiBurst(st === 3 ? 90 + Math.min(streak, 6) * 40 : 60);
  if (streak >= 3 || fresh.length) ui.flash(.5);
  const my = gen; setTimeout(() => gen === my && winCard({ st, first, old, chips, fresh: fresh[fresh.length - 1], streak }), 1500);
}
const wcard = document.createElement('div'); wcard.id = 'wcard'; wcard.className = 'hidden'; document.body.appendChild(wcard);
function stars3(n) { return [0, 1, 2].map((i) => `<svg class="wst ${i < n ? 'on' : ''}" viewBox="-20 -20 40 40" style="--i:${i}"><path d="M0 -17 L5 -6 L17 -5 L8 3 L11 15 L0 9 L-11 15 L-8 3 L-17 -5 L-5 -6Z" fill="${i < n ? '#ffd84d' : '#e5dccd'}" stroke="#2b2b2b" stroke-width="3" stroke-linejoin="round"/></svg>`).join(''); }
function winCard({ st, first, old, chips, fresh, streak }) {
  const f = frontier(), nxt = (level < N && !starsOf()[level + 1]) ? level + 1 : (f || 0);
  const mini = !fresh && !isBoss(level) && st >= 2 && !chips.some((c) => /CHEST|CLEARED|DAILY|TRICK|MASTERED/.test(c));
  const praise = st === 3 ? PRAISE[(level * 7) % PRAISE.length] : st === 2 ? 'Nice one!' : 'Got it!';
  wcard.innerHTML = H(`<div class="wbox ${isBoss(level) ? 'boss' : ''} ${mini ? 'mini' : ''}"><div class="wl">${isBoss(level) ? 'BOSS ' : ''}LEVEL ${level}</div><div class="wsts">${stars3(0)}</div>
    <div class="wp">${praise}</div>${fresh ? `<div class="what"><svg viewBox="-56 -112 112 150">${pipHead('happy', false, 1)}</svg><div><small>NEW HAT</small><b>${fresh.name}</b></div></div>` : ''}
    <div class="wchips">${chips.join('')}</div>
    <button class="hc-btn" id="wnext">${nxt ? 'NEXT' : 'MAP'}</button>
    <div class="wrow">${st < 3 ? '<button class="chip" id="wagain">REPLAY FOR 3\u2605</button>' : ''}<button class="chip" id="wmap">MAP</button></div>
    <div class="wtom">${tomorrowLine()}</div></div>`);
  wcard.classList.remove('hidden');
  const sts = wcard.querySelectorAll('.wst');
  for (let i = 0; i < st; i++) setTimeout(() => { sts[i].classList.add('on'); sts[i].querySelector('path').setAttribute('fill', '#ffd84d'); tone(523 * Math.pow(1.26, i), .14, 'triangle', .14, 1.2); buzz(15); }, 250 + i * 260);
  const my = gen;
  const go = (fn) => (e) => { e && e.stopPropagation(); wcard.classList.add('hidden'); sfx.tap(); fn(); };
  if (mini) setTimeout(() => { if (gen === my && !wcard.classList.contains('hidden')) go(() => (nxt ? load(nxt) : openMap()))(); }, 1900);
  wcard.querySelector('#wnext').onpointerdown = go(() => (nxt ? load(nxt) : openMap()));
  wcard.querySelector('#wmap').onpointerdown = go(() => openMap());
  const ag = wcard.querySelector('#wagain'); if (ag) ag.onpointerdown = go(() => load(level));
}
// confetti on a 2D canvas overlay
const cv = $('conf'), cx = cv.getContext('2d'); let parts = [];
function confettiBurst(n = 110) {
  const cols = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#7fe3ec'];
  for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .42, vx: (Math.random() - .5) * 15, vy: -Math.random() * 15 - 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, c: cols[i % 6], w: 6 + Math.random() * 6, life: 1 });
}
function resizeCv() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
addEventListener('resize', resizeCv); resizeCv();

// ---------------------------------------------------------------- level flow
function drawHearts() { $('hearts').innerHTML = [0, 1, 2].map((i) => `<i class="${i < hearts ? '' : 'off'}">♥</i>`).join(''); }
function renderQ(q) { $('q').innerHTML = q.replace(/\{(\w+):([^}:]+)(?::(\w+))?\}/g, (_, id, t, cls) => `<span class="qw ${cls || ''}" data-id="${id}">${t}</span>`); }
function bossIntro(n) {
  const b = document.createElement('div'); b.className = 'bossban'; b.innerHTML = `<small>${WORLDS[worldOf(n)][0].toUpperCase()}</small>BOSS TRICK`;
  document.body.appendChild(b); setTimeout(() => b.remove(), 1700);
  [0, 1, 2].forEach((i) => setTimeout(() => { tone(110 - i * 18, .22, 'sawtooth', .16, .7); buzz(40); }, i * 170));
  paper.classList.remove('shake'); void paper.offsetWidth; paper.classList.add('shake'); ui.flash(.35);
}
let t0 = 0;
function load(n) {
  goodN = 0;
  if (S) S._cleanup();
  gen++; level = n; cur = LEVELS[n - 1]; hearts = 3; hintShown = false; t0 = performance.now();
  root.innerHTML = ''; fxg.innerHTML = ''; defs.innerHTML = ''; $('bubble').classList.add('hidden'); $('bHint').classList.remove('glow');
  save.set('level', n); const dl = dailyPick();
  $('lvl').textContent = (isBoss(n) ? 'BOSS ' : 'LEVEL ') + n; $('lvl').classList.toggle('boss', isBoss(n));
  $('hdr').style.borderBottomColor = isBoss(n) ? '#e0485a' : WORLDS[worldOf(n)][1];
  $('dtag').classList.toggle('hidden', !(dl.n === n && !dl.done && score >= 3)); $('tot').innerHTML = H('\u2605 ' + totalStars()); metaStrip();
  renderQ(cur.q); drawHearts();
  S = makeScene(); botI = 0; botBusy = false; botWait = performance.now() + 900;
  state = 'play';
  cur.setup(S);
  if (isBoss(n)) bossIntro(n);
  setTimeout(() => { if (S && gen && state === 'play') $('bHint').classList.add('glow'); }, 14000);
}
const QUIPS = ['Boing!', 'Hee hee!', 'Tickles!', 'Nope, just me', 'Not it!', 'Boop!', 'Ooh!', 'Still here', 'Hmm?', 'Wheee'];
let deadN = 0;
svg.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || !S) return;
  if (cur.miss) cur.miss(S, toSvg(e));
  // dead scenery: every object answers a touch (no penalty), a little different each time
  const p = toSvg(e); let g = e.target;
  while (g && g.parentNode !== root) g = g.parentNode;
  deadN++;
  tone(260 + (deadN * 70) % 420, .09, 'triangle', .1, 1.25 + (deadN % 3) * .1);
  if (g && g._t) {
    squash(g); const r0 = g._t.r, d = deadN % 2 ? 9 : -9;
    tween(380, (k) => { g._t.r = r0 + Math.sin(k * 14) * d * (1 - k); apply(g); }, (k) => k).then(() => { g._t.r = r0; apply(g); });
  }
  dots(p.x, p.y, 4);
  if (deadN % 3 === 1 && fxg.childElementCount < 8) S.say(QUIPS[deadN % QUIPS.length], p.x, p.y - 34, 800);
});

$('bHint').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play') return; sfx.pick(3);
  if (cur.hintTap && cur.hintTap(S)) return;
  const b = $('bubble'); b.innerHTML = H('<b>Hint</b> <i class="hcost">max 2\u2605</i> ') + cur.hint; b.classList.remove('hidden'); if (!hintShown) { $('tot').classList.add('pulse'); setTimeout(() => $('tot').classList.remove('pulse'), 600); } hintShown = true; $('bHint').classList.remove('glow');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.add('hidden'), 4200);
});
$('bRestart').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state !== 'play' && state !== 'lost') return; sfx.tap(); load(level); });
$('bSkip').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play') return; sfx.pick(5);
  const next = level >= N ? 1 : level + 1; maxL = Math.max(maxL, next); save.set('max', maxL); save.set('level', next); load(next);
});
// ---------------------------------------------------------------- level map (4 worlds, stars, hat collection, daily)
const gridEl = $('grid'); gridEl.querySelector('h2').textContent = 'Map';
function openMap() {
  const st = starsOf(), d = dailyPick(), nh = nextHat(), f = frontier();
  const hatsHtml = HATS.map((h) => { const un = h.at <= totalStars(); return `<button class="hslot ${un ? 'un' : ''} ${save.get('hat', '') === h.id ? 'on' : ''}" data-hat="${h.id}" ${un ? '' : 'disabled'}><svg viewBox="-56 -252 112 106">${h.svg}</svg><i>${un ? h.name : '\u2605' + h.at}</i></button>`; }).join('');
  let ws = '';
  WORLDS.forEach(([name, col], w) => {
    let cells = '', got = 0;
    for (let k = 0; k < WSIZE; k++) {
      const n = w * WSIZE + k + 1; if (n > N) break; const s3 = st[n] || 0; got += s3;
      const lock = n > maxL && !s3, cls = [s3 ? 'done' : '', n === (f || level) ? 'next' : '', isBoss(n) ? 'boss' : '', lock ? 'lock' : '', d.n === n && !d.done ? 'daily' : ''].join(' ');
      cells += `<button class="node ${cls}" data-n="${n}" ${lock ? 'disabled' : ''} style="--c:${col}"><b>${lock ? '\u{1F512}' : isBoss(n) ? '\u2606' + n : n}</b><span>${[1, 2, 3].map((i) => i <= s3 ? '\u2605' : '\u2606').join('')}</span></button>`;
    }
    ws += `<div class="world" style="--c:${col}"><h3>${name}<small>${got}/${WSIZE * 3}\u2605</small></h3><div class="nodes">${cells}</div></div>`;
  });
  $('gcells').innerHTML = H(`<div class="mtop"><b>\u2605 ${totalStars()}</b>${nh ? `<span class="mhat">next hat at \u2605 ${nh.at}<i style="width:${Math.min(100, Math.round(100 * (totalStars() - (HATS[HATS.indexOf(nh) - 1] || { at: 0 }).at) / (nh.at - (HATS[HATS.indexOf(nh) - 1] || { at: 0 }).at)))}%"></i></span>` : '<span class="mhat">all hats!</span>'}
    <button class="chip ${d.done ? 'done' : 'gold'}" data-n="${d.n}">${d.done ? 'DAILY DONE' : 'DAILY \u00b7 L' + d.n}</button></div>
    <div class="hats">${hatsHtml}</div>${trickRow()}${ws}<div class="wtom">${save.get('dstreak', 0) ? 'Day streak ' + save.get('dstreak', 0) + ' \u00b7 ' : ''}${tomorrowLine()}</div>`);
  gridEl.classList.remove('hidden'); wcard.classList.add('hidden');
  const nx = $('gcells').querySelector('.node.next'); if (nx) nx.scrollIntoView({ block: 'center' });
}
$('bGrid').addEventListener('pointerdown', (e) => { e.stopPropagation(); sfx.tap(); openMap(); });
$('gcells').addEventListener('pointerdown', (e) => {
  const hb = e.target.closest('[data-hat]');
  if (hb && !hb.disabled) { e.stopPropagation(); equip(hb.dataset.hat); sfx.pick(4); openMap(); return; }
  const nb = e.target.closest('[data-n]'); const n = nb && +nb.dataset.n; if (!n || nb.disabled) return;
  e.stopPropagation(); gridEl.classList.add('hidden'); wcard.classList.add('hidden'); ui.hideStart(); sfx.pick(2); B.start(); load(n);
});
$('gClose').addEventListener('pointerdown', (e) => { e.stopPropagation(); gridEl.classList.add('hidden'); if (state === 'won') wcard.classList.remove('hidden'); });
gridEl.addEventListener('pointerdown', (e) => { if (e.target.id === 'grid') { gridEl.classList.add('hidden'); if (state === 'won') wcard.classList.remove('hidden'); } });

ui.onTap((which) => { B.start();
  sfx.tap();
  if (which === 'start') load(level);
  else load(level);
});
fillStart();
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
  bot, openMap, stars: () => starsOf(), total: totalStars, load: (n) => { ui.hideStart(); ui.els.win.classList.add('hc-hidden'); wcard.classList.add('hidden'); gridEl.classList.add('hidden'); ui.els.lose.classList.add('hc-hidden'); load(n); }, levels: N,
};
