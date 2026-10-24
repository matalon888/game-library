// Dailies Club: Daily Puzzle Set — three quick puzzles a day (Vibe Check: 4×4 groups, Decode: emoji rebus / word
// scramble, Mini Grid: logic grid), the same for everyone, seeded by the date. Streak with a free weekly freeze,
// spoiler-free share grid, archive, sticker album, a club room you decorate with stars, and Lulu the club kitty who
// reacts to every move. Style B · Kawaii Pop (art: assets/kawaii library, copied into ./assets).
import { store } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { createScene, DECOR } from './scene.js';
import { snd } from './audio.js';
import * as P from './puzzles.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Dailies Club: Daily Puzzle Set';
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const Q = new URLSearchParams(location.search);
const TODAY = P.dayNum();
const week = n => Math.floor((P.setNo(n) + 3) / 7);           // week index (Mon–Sun)
const fmt = (n, o = { month: 'short', day: 'numeric' }) => P.fromNum(n).toLocaleDateString('en-US', o);
const thumb = id => `assets/thumbs/${id}.webp`;
const pickOf = (a, i) => a[((i % a.length) + a.length) % a.length];

// ---------------------------------------------------------------- saved state
const S = store('dailiesclub');
const sg = (k, d) => { try { return S.get(k, d); } catch (e) { return d; } };
const st = {
  days: sg('days', {}), streak: sg('streak', { n: 0, best: 0, last: 0, freeWeek: -1, extra: 0, frozen: [], broken: null, rescued: 0 }),
  stars: sg('stars', 0), earned: sg('earned', 0), decor: sg('decor', []), album: sg('album', {}), solved: sg('solved', 0), sets: sg('sets', 0),
  unlocked: sg('unlocked', []), pages: sg('pages', []), seenDecor: sg('seenDecor', 0),
};
const save = (...ks) => { for (const k of (ks.length ? ks : Object.keys(st))) try { S.set(k, st[k]); } catch (e) {} };
{ const keys = Object.keys(st.days).map(Number).sort((a, b) => b - a); for (const k of keys.slice(60)) delete st.days[k]; }
const rec = n => st.days[n] || (st.days[n] = {
  v: { found: [], guesses: [], mist: 0, done: 0, won: 0, hints: 0, hinted: [] },
  d: { slots: [], mist: 0, done: 0, won: 0, hints: 0, given: [] },
  g: { cells: {}, mist: 0, done: 0, won: 0, hints: 0, used: [] },
  stars: { v: 0, d: 0, g: 0 }, complete: 0, coins: 0,
});
const sets = {}; const setOf = n => sets[n] || (sets[n] = P.setFor(n));
const KINDS = ['v', 'd', 'g'];
const META = {
  v: { name: 'Vibe Check', rule: 'Find the 4 hidden groups of 4', icon: 'vibe' },
  d: { name: 'Decode', rule: 'Spell the emoji word', icon: 'dec' },
  g: { name: 'Mini Grid', rule: 'Who has what? Use the clues', icon: 'grid' },
};
const newbie = () => st.sets < 5;           // first 5 sets: hints are free (near-certain wins)
const HINT_COST = 15;

// stickers: 4 album pages of 12, one sticker per solved puzzle (holo for 3 stars)
const PAGES = [
  { name: 'Sweet Treats', ids: 't01 t02 t03 t05 t06 t07 t08 t09 g08 g09 g11 g12' },
  { name: 'Pet Pals', ids: 'p01 p02 p03 p04 p05 p06 c01 c02 c03 c04 c05 c06' },
  { name: 'Glow Up', ids: 'g01 g02 g03 g04 g05 g06 w01 w05 w07 w09 b01 b02' },
  { name: 'Club Life', ids: 'm01 m03 m06 m08 x01 x03 x04 x05 r04 r05 h06 j01' },
].map(p => ({ ...p, ids: p.ids.split(' ') }));
const ALL_STICKERS = PAGES.flatMap(p => p.ids);
const STICK_ORDER = (() => { const r = P.rng('stickers'); const a = ALL_STICKERS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; })();

// ---------------------------------------------------------------- kit layers
const F = flow('dailiesclub');                 // records every puzzle; no difficulty knob: the daily set is the same for everyone
const D = daily('dailiesclub', null, { name: NAME });
const B = worldBoard({ game: 'dailies-club', label: "Stars from today's set", limits: { maxRun: 3, maxPerSec: 1 }, mode: 'sum', corner: 'tr', accent: '#ff79b8' });
const M = money({ game: 'dailies-club', style: 'B', onAdStart: () => { snd.music(false); snd.pause(true); }, onAdEnd: () => { snd.pause(false); if (!snd.muted) snd.music(true); } });

// ---------------------------------------------------------------- 3D club room + Lulu
const SC = createScene();

// ---------------------------------------------------------------- DOM
const home = $(`<div id="home">
  <div class="hd"><div class="brand"><div class="wd"></div><div class="logo outline">Dailies <span>Club</span></div></div>
    <div class="right"><button class="chip" data-shop aria-label="Coins and shop"><span class="coin"></span><b data-coins>0</b><span class="plus">+</span></button></div></div>
  <div class="chips"><button class="chip" data-streak aria-label="Streak"><span class="ic">🔥</span><b>0</b></button><button class="chip" data-freeze aria-label="Streak freezes"><span class="ic">🧊</span><b>1</b></button><button class="chip" data-club aria-label="Stars"><span class="ic">⭐</span><b>0</b></button><button class="chip" data-mute aria-label="Sound"><span class="ic">🔊</span></button></div>
  <div id="sheet"></div>
</div>`);
const play = $(`<div id="play" class="hide"><div class="col">
  <div class="ph"><button class="round" data-back aria-label="Back">‹</button><div class="ttl"><b></b><span></span></div><button class="chip" data-shop aria-label="Coins"><span class="coin"></span><b data-coins>0</b></button></div>
  <div class="host"><div class="lulu"></div><div class="bub"></div><div class="lives"></div></div>
  <div class="stage"></div>
</div></div>`);
const say = $(`<div class="say off"></div>`);
document.body.append(home, play, say);
const sheet = home.querySelector('#sheet'), stage = play.querySelector('.stage'), bub = play.querySelector('.bub'), lives = play.querySelector('.lives');
const el = {
  wd: home.querySelector('.wd'), streak: home.querySelector('[data-streak] b'), freeze: home.querySelector('[data-freeze] b'), stars: home.querySelector('[data-club] b'),
  mute: home.querySelector('[data-mute] .ic'), ttl: play.querySelector('.ttl b'), ttlSub: play.querySelector('.ttl span'), lulu: play.querySelector('.lulu'),
};
const coinEls = () => document.querySelectorAll('[data-coins]');
const paintCoins = () => coinEls().forEach(e => e.textContent = M.coins().toLocaleString());
M.onChange(paintCoins);
document.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => { snd.pop(); M.shop(); });
home.querySelector('[data-mute]').onclick = () => { const m = snd.toggle(); el.mute.textContent = m ? '🔇' : '🔊'; if (!m) snd.music(true); };
el.mute.textContent = snd.muted ? '🔇' : '🔊';
home.querySelector('[data-streak]').onclick = () => streakCard();
home.querySelector('[data-freeze]').onclick = () => streakCard();
home.querySelector('[data-club]').onclick = () => clubCard();
play.querySelector('[data-back]').onclick = () => { snd.untap(); goHome(); };
// first touch starts audio (browsers need a gesture)
addEventListener('pointerdown', () => { snd.init(); if (!snd.muted) snd.music(true); }, { once: true });

// ---------------------------------------------------------------- fx: confetti, hearts, stars, coin flights, toasts
const fx = document.getElementById('fx'), fctx = fx.getContext('2d'); let parts = [];
function fxSize() { fx.width = innerWidth * Math.min(2, devicePixelRatio); fx.height = innerHeight * Math.min(2, devicePixelRatio); fx.style.width = innerWidth + 'px'; fx.style.height = innerHeight + 'px'; }
fxSize(); addEventListener('resize', fxSize);
const FXC = ['#ff79b8', '#ffd24d', '#7fe3c0', '#9fd2ff', '#c3a3ff', '#ffffff', '#ffb3d6'];
function burst(x, y, n = 30, { speed = 7, up = 4, kinds = 'heart star dot', colors = FXC, size = 1 } = {}) {
  const ks = kinds.split(' ');
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, r: (5 + Math.random() * 7) * size, k: ks[i % ks.length], c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 1, decay: 0.008 + Math.random() * 0.01 }); }
}
function rain(n = 90) { for (let i = 0; i < n; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, r: 5 + Math.random() * 7, k: ['heart', 'star', 'rect', 'dot'][i % 4], c: FXC[i % FXC.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.2, life: 1, decay: 0.004, sway: Math.random() * 6 }); }
function drawPart(p) {
  const x = fctx; x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.globalAlpha = Math.min(1, p.life * 1.6); x.fillStyle = p.c; const r = p.r;
  if (p.k === 'heart') { x.beginPath(); x.moveTo(0, r * 0.35); x.bezierCurveTo(-r, -r * 0.4, -r * 0.45, -r * 1.05, 0, -r * 0.45); x.bezierCurveTo(r * 0.45, -r * 1.05, r, -r * 0.4, 0, r * 0.35); x.fill(); }
  else if (p.k === 'star') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); }
  else if (p.k === 'rect') x.fillRect(-r * 0.6, -r * 0.3, r * 1.2, r * 0.6);
  else { x.beginPath(); x.arc(0, 0, r * 0.5, 0, 7); x.fill(); }
  x.restore();
}
function fxTick() {
  const k = fx.width / innerWidth; fctx.setTransform(k, 0, 0, k, 0, 0); fctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) { p.vy += 0.18; p.vx *= 0.985; p.x += p.vx + (p.sway ? Math.sin(p.y / 40) * 0.6 : 0); p.y += p.vy; p.rot += p.vr; p.life -= p.decay; drawPart(p); }
}
function toast(t) { const e = $(`<div class="toast"></div>`); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2300); }
function coinFly(fromEl, n = 6) {
  const to = [...coinEls()].find(e => e.offsetParent); if (!to || !fromEl) return;
  const a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
  for (let i = 0; i < n; i++) { const c = $(`<span class="coin flyc"></span>`); c.style.left = (a.left + a.width / 2 - 12) + 'px'; c.style.top = (a.top + a.height / 2 - 12) + 'px'; document.body.appendChild(c);
    setTimeout(() => { c.style.transform = `translate(${b.left - a.left - a.width / 2 + 12 + (Math.random() - .5) * 10}px,${b.top - a.top - a.height / 2 + 6}px) scale(.8)`; }, 30 + i * 70);
    setTimeout(() => { c.remove(); if (i === n - 1) { snd.coin(); paintCoins(); } }, 800 + i * 70); }
}

// ---------------------------------------------------------------- streak (with a free freeze every week)
const freezes = () => (st.streak.freeWeek !== week(TODAY) ? 1 : 0) + st.streak.extra;
function streakNow() {      // the streak as it stands today (before playing): safe if the gap can be covered by freezes
  const s = st.streak; if (!s.last) return { n: 0, safe: true };
  const gap = Math.round((P.fromNum(TODAY) - P.fromNum(s.last)) / 864e5);
  if (gap <= 1) return { n: s.n, safe: true, frozen: 0 };
  const missed = gap - 1;
  return missed <= freezes() ? { n: s.n, safe: true, frozen: missed } : { n: 0, safe: false, lost: s.n };
}
function streakOnComplete() {   // called when today's set is completed
  const s = st.streak; let used = 0, broken = 0;
  if (s.last === TODAY) return { used: 0 };
  const gap = s.last ? Math.round((P.fromNum(TODAY) - P.fromNum(s.last)) / 864e5) : 1;
  if (gap > 1) {
    const missed = gap - 1;
    if (missed <= freezes()) {
      for (let i = 1; i <= missed; i++) { s.frozen.push(P.addDays(s.last, i)); if (s.freeWeek !== week(TODAY)) s.freeWeek = week(TODAY); else s.extra--; used++; }
    } else { broken = s.n; s.broken = { n: s.n, day: TODAY }; s.n = 0; }
  }
  s.n++; s.best = Math.max(s.best, s.n); s.last = TODAY; s.frozen = s.frozen.slice(-30);
  save('streak'); return { used, broken };
}

// ---------------------------------------------------------------- views
let view = 'home', day = TODAY, kind = null, state = 'ready', t0 = 0, ov = null, ovKind = null, busy = false;
function setView(v) {
  view = v; home.classList.toggle('hide', v !== 'home'); play.classList.toggle('hide', v !== 'play'); document.body.classList.toggle('playing', v === 'play');
  say.classList.add('off');
  if (v === 'play') requestAnimationFrame(placeLulu); else SC.setMode('home');
  floaties(v === 'play');
}
const FLOAT_IDS = ['t01', 't09', 'm03', 'g13', 'x05', 't05', 'm01', 'g08'];
let floatEls = [];
function floaties(on) {
  floatEls.forEach(e => e.remove()); floatEls = [];
  if (!on) return;
  const spots = innerWidth > 700 ? [[0.12, 0.18, 120], [0.84, 0.22, 110], [0.1, 0.72, 130], [0.86, 0.7, 120], [0.22, 0.45, 80], [0.78, 0.46, 90]] : [[0.03, 0.9, 64], [0.84, 0.9, 58]];
  spots.forEach(([x, y, sz], i) => { const im = document.createElement('img'); im.className = 'floaty'; im.src = thumb(pickOf(FLOAT_IDS, setOf(day).no + i * 3));
    im.style.cssText = `left:${x * innerWidth - sz / 2}px;top:${y * innerHeight - sz / 2}px;width:${sz}px;height:${sz}px;animation-delay:${-i * 1.3}s`; document.body.appendChild(im); floatEls.push(im); });
}
function placeLulu() { if (view !== 'play') return; const r = el.lulu.getBoundingClientRect(); SC.setMode('play', { x: r.left, y: r.top, w: r.width, h: r.height }); }
addEventListener('resize', () => { placeLulu(); if (view === 'home') positionSay(); });
function closeOv() { if (ov) { ov.remove(); ov = null; ovKind = null; } }
function overlay(kindName, html, { onBackdrop = null } = {}) {
  closeOv(); ovKind = kindName;
  ov = $(`<div class="ov"><div class="card">${html}</div></div>`); document.body.appendChild(ov);
  ['pointerdown', 'touchstart'].forEach(t => ov.addEventListener(t, e => e.stopPropagation()));
  ov.addEventListener('click', e => { if (e.target.closest('button')) return; if (onBackdrop) onBackdrop(e); });
  return ov;
}
function goHome() { closeOv(); kind = null; state = 'ready'; setView('home'); paintHome(); SC.reactTo('idle'); setTimeout(greet, 400); }

// Lulu's speech bubble on the home screen
let sayT = 0;
function positionSay() { const p = SC.hostScreen(); say.style.left = Math.max(10, Math.min(innerWidth - 210, p.x - 24)) + 'px'; say.style.top = Math.max(120, p.y - say.offsetHeight - 14) + 'px'; }
function homeSay(t, ms = 4200) { if (view !== 'home' || ov) return; say.textContent = t; say.classList.remove('off'); positionSay(); clearTimeout(sayT); sayT = setTimeout(() => say.classList.add('off'), ms); }
function greet() {
  if (view !== 'home' || ov) return;
  const r = rec(day), done = KINDS.filter(k => r[k].done).length, sn = streakNow(), h = new Date().getHours();
  if (day !== TODAY) return homeSay(`Archive day: ${fmt(day, { weekday: 'long', month: 'short', day: 'numeric' })} 📼`);
  if (r.complete) return homeSay(st.streak.n > 1 ? `${st.streak.n}-day streak, iconic 🔥 new set at midnight` : `Set done! New set at midnight 💤`);
  if (sn.frozen) return homeSay(`A freeze saved your ${sn.n}-day streak 🧊`);
  if (!sn.safe && sn.lost > 1) return homeSay(`Your ${sn.lost}-day streak melted… we rebuild 🫶`);
  if (done) return homeSay(`${3 - done} to go, you got this ✨`);
  const hard = P.isHard(day), gentle = P.isGentle(day);
  homeSay(hard ? 'Saturday = hard mode. Snacks ready? 🍡' : gentle ? 'Soft Monday set, no stress 🌷' : h < 11 ? 'gm bestie ☀️ your set is ready' : h < 18 ? 'Puzzle break? 3 quick ones 🧋' : 'Cozy night set, pajamas on 🌙');
}
const BUB = {
  start: { v: ['Find 4 groups of 4. Tap 4 words, then Submit ✨', 'Four groups hiding in here 👀', 'Group the vibes, bestie 💜'], d: ['Spell the word the emojis make 🔮', 'Emoji math time ➕', 'Unscramble the club word 🧩'], g: ['Who has what? Use the clues 🔎', 'Tap once for ✗, twice for ✓', 'Detective mode: on 🕵️‍♀️'] },
  good: ['Yesss 💖', 'Slay ✨', 'Big brain energy 🧠', 'Ate that 💅', 'Main character move 🌟', 'No notes 🫶', 'Okay genius 💜'],
  bad: ['Oof, not quite 🙈', 'Hmm, plot twist 👀', 'Close, bestie 🫶', 'Not that one 😿'],
  away: ['One away… 👀', 'Sooo close, one away 🤏'],
};
let bubT = 0;
function bubble(t) { bub.textContent = t; bub.classList.add('pop'); clearTimeout(bubT); bubT = setTimeout(() => bub.classList.remove('pop'), 300); }
const rnd = a => a[Math.floor(Math.random() * a.length)];
function paintLives(n, max) { lives.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < n ? '' : 'off'}">💗</i>`).join(''); }

// ---------------------------------------------------------------- home
function stars3(n) { return [0, 1, 2].map(i => `<i class="${i < n ? '' : 'off'}">⭐</i>`).join(''); }
function iconHtml(k) {
  if (k === 'v') return `<div class="icon ic-vibe"><div class="q"><i style="background:#ffd24d"></i><i style="background:#7fe3c0"></i><i style="background:#9fd2ff"></i><i style="background:#ff9cc2"></i></div></div>`;
  if (k === 'd') { const s = setOf(day).d; return `<div class="icon ic-dec">${s.kind === 'rebus' ? s.emoji[0] : '🔤'}</div>`; }
  return `<div class="icon ic-grid"><div class="q">${'✓✗✗✗✓✗✗✗✓'.split('').map(c => `<i>${c === '✓' ? '♥' : ''}</i>`).join('')}</div></div>`;
}
function paintHome() {
  const s = setOf(day), r = rec(day), sn = streakNow();
  el.wd.textContent = day === TODAY ? fmt(day, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Archive · ' + fmt(day, { weekday: 'short', month: 'short', day: 'numeric' });
  el.streak.textContent = day === TODAY && r.complete ? st.streak.n : sn.n; el.freeze.textContent = freezes(); el.stars.textContent = st.stars;
  home.querySelector('[data-streak]').classList.toggle('dim', !sn.safe);
  const tag = s.hard ? `<span class="tag">Hard</span>` : s.gentle ? `<span class="tag easy">Gentle</span>` : P.weekday(day) === 0 ? `<span class="tag chill">Chill</span>` : `<span class="tag chill">Daily</span>`;
  const nd = DECOR.find(d => !st.decor.includes(d.id));
  const done = KINDS.filter(k => r[k].done).length;
  const sub = r.complete ? `🎉 Set complete · ${r.stars.v + r.stars.d + r.stars.g}/9 stars` : nd ? `⭐ ${Math.min(st.stars, nd.cost)}/${nd.cost} stars to unlock the ${nd.name.toLowerCase()}` : `⭐ ${done}/3 done today`;
  const desc = { v: s.hard ? 'Hard mix · 4 mistakes' : '16 words · 4 mistakes', d: s.d.kind === 'rebus' ? `Emoji rebus · ${s.d.answer.length} letters` : `Club word scramble · ${s.d.answer.length} letters`, g: `${s.g.N} friends · ${s.g.clues.length} clues` };
  sheet.innerHTML = `<h2>${day === TODAY ? "Today's set" : 'Archive set'} <span style="font:800 15px var(--sans);color:var(--ink2)">#${s.no}</span> ${tag}</h2>
    <div class="sub">${sub}</div>
    ${KINDS.map((k, i) => { const q = r[k]; return `<button class="pz ${q.done ? 'done' : ''}" data-k="${k}">${iconHtml(k)}<div class="nm"><b>${META[k].name}</b><span>${desc[k]}</span></div>${q.done ? `<div class="stars">${stars3(r.stars[k])}</div>` : `<span class="btn ${i === KINDS.findIndex(x => !r[x].done) ? 'pink' : 'soft'} go">Play</span>`}</button>`; }).join('')}
    <div class="nav"><button data-nav="archive"><img src="${thumb('r04')}" alt="">Archive</button><button data-nav="album"><img src="${thumb('t09')}" alt="">Album${albumNew() ? '<i class="dot"></i>' : ''}</button><button data-nav="club"><img src="${thumb('h02')}" alt="">Club${clubCanBuy() ? '<i class="dot"></i>' : ''}</button><button data-nav="shop"><img src="${thumb('x01')}" alt="">Shop</button></div>`;
  sheet.querySelectorAll('.pz').forEach(b => b.onclick = () => { snd.tap(); const k = b.dataset.k; if (rec(day)[k].done) reviewCard(k); else start(k); });
  sheet.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { snd.pop(); ({ archive: archiveCard, album: albumCard, club: clubCard, shop: () => M.shop() })[b.dataset.nav](); });
  if (day !== TODAY) { const back = $(`<button class="btn soft" style="width:100%;margin:2px 0 8px;padding:9px">← Back to today</button>`); back.onclick = () => { day = TODAY; paintHome(); greet(); }; sheet.querySelector('.sub').after(back); }
  SC.setCards(KINDS.map(k => r[k].done));
  paintCoins();
}
const albumNew = () => !!sg('albumNew', 0);
const clubCanBuy = () => DECOR.some(d => !st.decor.includes(d.id) && d.cost <= st.stars);

// ---------------------------------------------------------------- puzzle start
let V = null, Dd = null, Gg = null;     // live puzzle state
function start(k) {
  closeOv(); kind = k; state = 'play'; t0 = performance.now(); busy = false; setView('play');
  const s = setOf(day);
  el.ttl.textContent = META[k].name; el.ttlSub.textContent = `${day === TODAY ? 'Today' : fmt(day)} · #${s.no}${s.hard ? ' · Hard' : ''}`;
  M.level(st.solved + 1);
  bubble(pickOf(BUB.start[k], s.no + (k === 'd' && s.d.kind === 'scramble' ? 2 : 0)));
  if (k === 'd' && s.d.kind === 'rebus') bubble('Emoji math! What word do they make? 🔮');
  SC.reactTo('idle');
  ({ v: vibeStart, d: decStart, g: gridStart })[k]();
}

// ---------------------------------------------------------------- hints (free for the first 5 sets, then coins or a video)
function hintBtn() { return `<button class="btn soft" data-hint>💡 Hint ${newbie() ? '<small>free</small>' : `<span class="price"><span class="coin"></span>${HINT_COST}</span>`}</button>`; }
async function getHint() {
  if (busy) return false;
  if (newbie()) return true;
  if (M.spend(HINT_COST, 'hint')) return true;
  busy = true; const ok = await M.rewarded('hint', { what: 'one hint for this puzzle' }); busy = false;
  return ok;
}

// ---------------------------------------------------------------- Vibe Check
function vibeStart() {
  const s = setOf(day).v, r = rec(day).v;
  V = { s, sel: [], order: s.tiles.map((_, i) => i).filter(i => !r.found.includes(s.tiles[i].g)) };
  stage.innerHTML = `<div class="vwrap"><div class="solved"></div><div class="tiles"></div><div class="dots"><span>Mistakes left</span></div></div>
    <div class="tools"><button class="btn soft" data-shuf aria-label="Shuffle">🔀</button>${hintBtn()}<button class="btn soft" data-clear>Clear</button><button class="btn pink main" data-sub>Submit</button></div>`;
  stage.querySelector('[data-shuf]').onclick = () => { snd.boing(); V.order.sort(() => Math.random() - 0.5); paintVibe(true); };
  stage.querySelector('[data-clear]').onclick = () => { V.sel = []; snd.untap(); paintVibe(); };
  stage.querySelector('[data-sub]').onclick = vibeSubmit;
  stage.querySelector('[data-hint]').onclick = async () => { if (await getHint()) vibeHint(); };
  paintLives(0, 0); paintVibe();
}
function paintVibe(anim = false) {
  const { s } = V, r = rec(day).v;
  stage.querySelector('.solved').innerHTML = r.found.map(gi => { const g = s.groups[gi]; return `<div class="band ${g.color}"><b>${g.name}</b><span>${g.words.join(', ')}</span></div>`; }).join('');
  const tl = stage.querySelector('.tiles');
  tl.innerHTML = V.order.map(i => { const t = s.tiles[i]; const L = t.w.length; const fs = L > 9 ? 12 : L > 8 ? 13 : L > 7 ? 14 : 16;
    return `<button class="tile ${V.sel.includes(i) ? 'sel' : ''} ${r.hinted.includes(t.w) ? 'hinted' : ''}" data-i="${i}" style="font-size:${fs}px">${t.w}</button>`; }).join('');
  if (anim) tl.querySelectorAll('.tile').forEach((b, j) => { b.style.animation = `bandIn .35s ${j * 0.015}s both`; });
  tl.querySelectorAll('.tile').forEach(b => b.onpointerdown = e => { e.preventDefault(); vibeTap(+b.dataset.i, b); });
  const left = s.mistakes - r.mist;
  stage.querySelector('.dots').innerHTML = `<span>Mistakes left</span>${Array.from({ length: s.mistakes }, (_, i) => `<i class="${i < left ? '' : 'off'}"></i>`).join('')}`;
  stage.querySelector('[data-sub]').disabled = V.sel.length !== 4;
  stage.querySelector('[data-hint]').disabled = r.found.length >= 3;
}
function vibeTap(i, b) {
  if (state !== 'play' || busy) return;
  const k = V.sel.indexOf(i);
  if (k >= 0) { V.sel.splice(k, 1); snd.untap(); }
  else if (V.sel.length < 4) { V.sel.push(i); snd.tap(V.sel.length); }
  else return;
  paintVibe();
}
async function vibeSubmit() {
  if (V.sel.length !== 4 || busy || state !== 'play') return;
  const { s } = V, r = rec(day).v, gs = V.sel.map(i => s.tiles[i].g);
  const key = V.sel.map(i => s.tiles[i].w).sort().join();
  if (r.guesses.some(g => g.key === key)) { toast('Already tried that one 👀'); return; }
  busy = true;
  const els = V.sel.map(i => stage.querySelector(`.tile[data-i="${i}"]`));
  for (let j = 0; j < els.length; j++) { els[j].classList.remove('jump'); void els[j].offsetWidth; els[j].classList.add('jump'); await wait(90); }
  await wait(250);
  r.guesses.push({ key, g: gs });
  const counts = {}; gs.forEach(g => counts[g] = (counts[g] || 0) + 1); const top = Math.max(...Object.values(counts));
  if (top === 4) {
    const gi = gs[0]; r.found.push(gi); V.order = V.order.filter(i => s.tiles[i].g !== gi); V.sel = [];
    snd.good(r.found.length); SC.reactTo('happy'); bubble(rnd(BUB.good));
    const rc = stage.querySelector('.solved').getBoundingClientRect(); burst(innerWidth / 2, rc.bottom + 30, 26, { speed: 6 });
    save('days'); paintVibe(true);
    if (r.found.length === 4) { busy = false; return finish(true); }
  } else {
    r.mist++; snd.oops(); SC.reactTo('oops'); bubble(top === 3 ? rnd(BUB.away) : rnd(BUB.bad));
    els.forEach(e => { e.classList.remove('jump'); e.classList.add('shake'); });
    await wait(480); save('days'); paintVibe();
    if (r.mist >= s.mistakes) { busy = false; return fail(); }
  }
  busy = false;
}
function vibeHint() {
  const { s } = V, r = rec(day).v;
  const gi = s.groups.findIndex((g, i) => !r.found.includes(i));
  const g = s.groups[gi], w = g.words.find(x => !r.hinted.includes(x));
  if (!w) return;
  r.hinted.push(w); r.hints++; save('days');
  // select the hinted words of that group so the player sees the pattern
  V.sel = s.tiles.map((t, i) => i).filter(i => s.tiles[i].g === gi && r.hinted.includes(s.tiles[i].w)).slice(0, 4);
  bubble(`Psst… "${w}" belongs with ${r.hinted.filter(x => g.words.includes(x)).length > 1 ? 'these' : 'the group'} ✨`); snd.sparkle(); paintVibe();
}

// ---------------------------------------------------------------- Decode
function decStart() {
  const s = setOf(day).d, r = rec(day).d;
  Dd = { s, slots: Array(s.answer.length).fill(-1) };
  // restore given letters (hints)
  r.given.forEach(p => { const bi = s.bank.findIndex((c, i) => c === s.answer[p] && !Dd.slots.includes(i)); if (bi >= 0) Dd.slots[p] = bi; });
  const eq = s.kind === 'rebus' ? `<div class="eq"><span class="em">${s.emoji[0]}</span><span class="op">+</span><span class="em">${s.emoji[1]}</span></div>` : `<div class="eq"><span class="em">${s.emoji[0]}</span></div>`;
  stage.innerHTML = `<div class="rebus"><span class="kind">${s.kind === 'rebus' ? 'Emoji rebus' : 'Club word scramble'}</span>${eq}<span class="cat">💭 ${s.hint}</span></div>
    <div class="slots"></div><div class="bank"></div>
    <div class="tools">${hintBtn()}<button class="btn soft" data-back1>⌫</button><button class="btn soft" data-clear>Clear</button></div>`;
  stage.querySelector('[data-clear]').onclick = () => { const r = rec(day).d; Dd.slots = Dd.slots.map((b, p) => r.given.includes(p) ? b : -1); snd.untap(); paintDec(); };
  stage.querySelector('[data-back1]').onclick = () => { const r = rec(day).d; for (let p = Dd.slots.length - 1; p >= 0; p--) if (Dd.slots[p] >= 0 && !r.given.includes(p)) { Dd.slots[p] = -1; break; } snd.untap(); paintDec(); };
  stage.querySelector('[data-hint]').onclick = async () => { if (await getHint()) decHint(); };
  paintDec();
}
function paintDec(ok = false) {
  const { s } = Dd, r = rec(day).d;
  paintLives(s.hearts - r.mist, s.hearts);
  const sl = stage.querySelector('.slots'), n = s.answer.length, w = Math.min(40, Math.floor((Math.min(innerWidth, 470) - 24 - (n - 1) * 5) / n));
  sl.innerHTML = Dd.slots.map((b, p) => `<button class="slot ${b >= 0 ? 'f' : ''} ${ok ? 'ok' : ''} ${r.given.includes(p) ? 'given' : ''}" data-p="${p}" style="flex-basis:${w}px">${b >= 0 ? s.bank[b] : ''}</button>`).join('');
  sl.querySelectorAll('.slot').forEach(b => b.onclick = () => { const p = +b.dataset.p; if (state !== 'play' || r.given.includes(p) || Dd.slots[p] < 0) return; Dd.slots[p] = -1; snd.untap(); paintDec(); });
  const bk = stage.querySelector('.bank');
  bk.innerHTML = s.bank.map((c, i) => `<button class="lt c${i % 5} ${Dd.slots.includes(i) ? 'used' : ''}" data-i="${i}">${c}</button>`).join('');
  bk.querySelectorAll('.lt').forEach(b => b.onpointerdown = e => { e.preventDefault(); decTap(+b.dataset.i); });
}
function decTap(i) {
  if (state !== 'play' || busy || Dd.slots.includes(i)) return;
  const p = Dd.slots.indexOf(-1); if (p < 0) return;
  Dd.slots[p] = i; snd.tap(p); paintDec();
  if (!Dd.slots.includes(-1)) decCheck();
}
async function decCheck() {
  const { s } = Dd, r = rec(day).d, word = Dd.slots.map(b => s.bank[b]).join('');
  busy = true;
  if (word === s.answer) {
    paintDec(true); snd.good(2); SC.reactTo('happy'); bubble(`${s.answer}! ${rnd(BUB.good)}`);
    const rc = stage.querySelector('.slots').getBoundingClientRect(); burst(innerWidth / 2, rc.top + 20, 34);
    await wait(700); busy = false; return finish(true);
  }
  r.mist++; save('days'); snd.oops(); SC.reactTo('oops'); bubble(rnd(BUB.bad));
  const sl = stage.querySelector('.slots'); sl.classList.add('shake'); await wait(500);
  Dd.slots = Dd.slots.map((b, p) => r.given.includes(p) ? b : -1); paintDec(); busy = false;
  if (r.mist >= s.hearts) return fail();
}
function decHint() {
  const { s } = Dd, r = rec(day).d;
  // put the next missing (or wrong) letter in place
  const p = [...s.answer].findIndex((c, q) => !r.given.includes(q));
  if (p < 0) return;
  r.given.push(p); r.hints++; save('days');
  Dd.slots = Dd.slots.map((b, q) => r.given.includes(q) && q !== p ? b : -1);
  for (const q of r.given) { const bi = s.bank.findIndex((c, i) => c === s.answer[q] && !Dd.slots.includes(i)); Dd.slots[q] = bi; }
  snd.sparkle(); bubble(`Letter ${p + 1} is ${s.answer[p]} ✨`); paintDec();
  if (!Dd.slots.includes(-1)) decCheck();
}

// ---------------------------------------------------------------- Mini Grid
function clueHtml(c, s) {
  const [A, B] = s.items, who = p => `<b>${s.people[p].name}</b>`, it = (cat, i) => { const x = (cat === 'A' ? A : B)[i]; return `<img src="${thumb(x.id)}" alt="">${x.name}`; };
  const cat = k => s.cats[k === 'A' ? 0 : 1];
  switch (c.t) {
    case 'is': return `${who(c.p)} ${cat(c.cat).verb} ${it(c.cat, c.i)}.`;
    case 'not': return `${who(c.p)} doesn't have the ${it(c.cat, c.i)}.`;
    case 'link': return `Whoever has the ${it('A', c.i)} also has the ${it('B', c.i2)}.`;
    case 'unlink': return `The ${it('A', c.i)} and the ${it('B', c.i2)} belong to different friends.`;
    case 'neither': return `${who(c.p)} has neither the ${it(c.cat, c.i)} nor the ${it(c.cat, c.i2)}.`;
    case 'either': return `${who(c.p)} has the ${it(c.cat, c.i)} or the ${it(c.cat, c.i2)}.`;
  }
}
function gridStart() {
  const s = setOf(day).g;
  Gg = { s };
  const N = s.N, avail = Math.min(innerWidth, 500) - 24, gap = 4, whoW = 56;
  const cell = Math.max(32, Math.min(58, Math.floor((avail - whoW - 8 - gap * (2 * N + 1)) / (2 * N))));
  const cols = `${whoW}px repeat(${N}, ${cell}px) 8px repeat(${N}, ${cell}px)`;
  const ic = Math.round(cell * 1.05);
  let g = `<div class="hd2"></div>` + s.items[0].map(x => `<div class="hd2"><img src="${thumb(x.id)}" alt="${x.name}" title="${x.name}" style="width:${ic}px;height:${ic}px"></div>`).join('') + `<div></div>` + s.items[1].map(x => `<div class="hd2"><img src="${thumb(x.id)}" alt="${x.name}" title="${x.name}" style="width:${ic}px;height:${ic}px"></div>`).join('');
  s.people.forEach((pp, p) => {
    g += `<div class="who"><span class="av"><img src="${thumb(pp.id)}" alt=""></span><span class="wn">${pp.name}</span></div>`;
    for (let i = 0; i < N; i++) g += `<button class="cell" data-c="A${p}_${i}" style="width:${cell}px"></button>`;
    g += `<div></div>`;
    for (let i = 0; i < N; i++) g += `<button class="cell" data-c="B${p}_${i}" style="width:${cell}px"></button>`;
  });
  stage.innerHTML = `<div class="clues">${s.clues.map((c, i) => `<button class="clue" data-cl="${i}"><span class="n">${i + 1}</span><span>${clueHtml(c, s)}</span></button>`).join('')}</div>
    <div class="lg" style="grid-template-columns:${cols};gap:${gap}px">${g}</div>
    <div class="legend">Tap a box once for ✗, twice for 💚 · tap a clue to cross it off</div>
    <div class="tools">${hintBtn()}<button class="btn soft" data-auto>Auto ✗ <small data-autos></small></button><button class="btn soft" data-reset>Reset</button></div>`;
  stage.querySelectorAll('.clue').forEach(b => b.onclick = () => { const r = rec(day).g, i = +b.dataset.cl; r.used = r.used.includes(i) ? r.used.filter(x => x !== i) : [...r.used, i]; save('days'); snd.untap(); paintGrid(); });
  stage.querySelectorAll('.cell').forEach(b => b.onpointerdown = e => { e.preventDefault(); gridTap(b.dataset.c); });
  stage.querySelector('[data-reset]').onclick = () => { const r = rec(day).g; for (const k of Object.keys(r.cells)) if (r.cells[k] !== 3) delete r.cells[k]; save('days'); snd.boing(); paintGrid(); };
  stage.querySelector('[data-auto]').onclick = () => { autoX = !autoX; try { localStorage.setItem('dailiesclub_autox', autoX ? '1' : '0'); } catch (e) {} snd.tap(); paintGrid(); };
  stage.querySelector('[data-hint]').onclick = async () => { if (await getHint()) gridHint(); };
  paintGrid();
}
let autoX = true; try { autoX = localStorage.getItem('dailiesclub_autox') !== '0'; } catch (e) {}
// cell values: 0 empty, 1 ✗, 2 ✓ (player), 3 ✓ given by a hint
function paintGrid() {
  const { s } = Gg, r = rec(day).g;
  paintLives(s.hearts - r.mist, s.hearts);
  stage.querySelectorAll('.cell').forEach(b => { const v = r.cells[b.dataset.c] || 0; b.className = 'cell' + (v === 1 ? ' cx' : v >= 2 ? ' o' : ''); b.textContent = v === 1 ? '✗' : v >= 2 ? '💚' : ''; });
  stage.querySelectorAll('.clue').forEach(b => b.classList.toggle('used', r.used.includes(+b.dataset.cl)));
  stage.querySelector('[data-autos]').textContent = autoX ? 'on' : 'off';
}
async function gridTap(id) {
  if (state !== 'play' || busy) return;
  const { s } = Gg, r = rec(day).g, v = r.cells[id] || 0;
  if (v === 3) return;
  const nv = (v + 1) % 3;
  if (nv === 2) {     // a ✓ is checked against the solution (✗ marks are your own notes)
    const cat = id[0], [p, i] = id.slice(1).split('_').map(Number);
    if (s.sol[cat][p] !== i) {
      r.mist++; save('days'); snd.oops(); SC.reactTo('oops'); bubble(rnd(BUB.bad));
      const b = stage.querySelector(`[data-c="${id}"]`); b.classList.add('bad'); b.textContent = '💔'; busy = true; await wait(520); busy = false;
      r.cells[id] = 1; paintGrid();
      if (r.mist >= s.hearts) return fail();
      return;
    }
    r.cells[id] = 2; snd.good(0); bubble(rnd(BUB.good)); if (Math.random() < 0.5) SC.reactTo('happy');
    if (autoX) for (let k = 0; k < s.N; k++) { if (k !== i && !r.cells[`${cat}${p}_${k}`]) r.cells[`${cat}${p}_${k}`] = 1; if (k !== p && !r.cells[`${cat}${k}_${i}`]) r.cells[`${cat}${k}_${i}`] = 1; }
    const b = stage.querySelector(`[data-c="${id}"]`).getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2, 10, { speed: 4, kinds: 'heart', size: 0.7 });
  } else { r.cells[id] = nv; if (nv === 1) snd.tap(1); else snd.untap(); }
  save('days'); paintGrid();
  gridSolved();
}
function gridSolved() {
  const { s } = Gg, r = rec(day).g;
  for (const cat of ['A', 'B']) for (let p = 0; p < s.N; p++) if (!(r.cells[`${cat}${p}_${s.sol[cat][p]}`] >= 2)) return false;
  busy = true; snd.good(3); SC.reactTo('happy'); bubble('Case closed 🕵️‍♀️💖');
  setTimeout(() => { busy = false; finish(true); }, 650);
  return true;
}
function gridHint() {
  const { s } = Gg, r = rec(day).g;
  for (const cat of ['A', 'B']) for (let p = 0; p < s.N; p++) { const id = `${cat}${p}_${s.sol[cat][p]}`; if (!(r.cells[id] >= 2)) {
    r.cells[id] = 3; r.hints++;
    for (let k = 0; k < s.N; k++) { if (k !== s.sol[cat][p] && !r.cells[`${cat}${p}_${k}`]) r.cells[`${cat}${p}_${k}`] = 1; if (k !== p && !r.cells[`${cat}${k}_${s.sol[cat][p]}`]) r.cells[`${cat}${k}_${s.sol[cat][p]}`] = 1; }
    save('days'); snd.sparkle(); bubble(`${s.people[p].name} → ${(cat === 'A' ? s.items[0] : s.items[1])[s.sol[cat][p]].name} ✨`); paintGrid(); gridSolved(); return; } }
}

// ---------------------------------------------------------------- finishing a puzzle
function starsFor(k) {
  const r = rec(day)[k];
  const base = k === 'v' ? (r.mist === 0 ? 3 : r.mist <= 2 ? 2 : 1) : (r.mist === 0 ? 3 : r.mist === 1 ? 2 : 1);
  return Math.max(1, base - (newbie() ? 0 : Math.min(1, r.hints)));
}
function giveSticker(holo) {
  const s = setOf(day), start = (s.no * 3 + KINDS.indexOf(kind)) % STICK_ORDER.length;
  let id = null;
  for (let j = 0; j < STICK_ORDER.length; j++) { const c = STICK_ORDER[(start + j) % STICK_ORDER.length]; if (!st.album[c]) { id = c; break; } }
  if (!id) { // album full: upgrade one to holo
    id = STICK_ORDER.find(c => st.album[c] === 1) || STICK_ORDER[start]; }
  const was = st.album[id] || 0; st.album[id] = Math.max(was, holo ? 2 : 1); try { S.set('albumNew', 1); } catch (e) {}
  let page = null;
  for (const pg of PAGES) if (!st.pages.includes(pg.name) && pg.ids.every(x => st.album[x])) { st.pages.push(pg.name); page = pg; }
  save('album', 'pages');
  return { id, holo, isNew: !was, page };
}
let lastResult = null;
async function finish(won) {
  if (state !== 'play') return;
  const r = rec(day), q = r[kind], ms = performance.now() - t0;
  q.done = 1; q.won = won ? 1 : 0;
  const stars = won ? starsFor(kind) : 0; r.stars[kind] = stars;
  const coins = won ? 5 + stars * 5 : 2;
  st.solved += won ? 1 : 0; st.stars += stars; st.earned += stars;
  F.level(won, won ? 1 : 0.5);
  if (day === TODAY && stars) B.submit(stars, { ms });
  const sticker = won ? giveSticker(stars === 3) : null;
  M.add(coins, 'solve'); r.coins += coins;
  save();
  state = won ? 'won' : 'lost';
  lastResult = { kind, stars, coins, sticker };
  if (won) { snd.win(); SC.reactTo('cheer'); rain(70); burst(innerWidth / 2, innerHeight * 0.4, 40); }
  await wait(won ? 650 : 200);
  resultCard();
}
async function fail() {
  if (state !== 'play') return;
  state = 'lost'; SC.reactTo('oops'); snd.oops(); bubble('Oof. It happens to the best of us 🫶');
  const k = kind, r = rec(day)[k];
  overlay('fail', `<div style="font-size:64px;line-height:1">🙈</div><h3 class="outline" style="--lilacD:#e0468f">So close!</h3>
    <p>${k === 'v' ? 'Out of mistakes.' : 'Out of hearts.'} Take one more try, or see the answer.</p>
    <div class="row" data-offer style="min-height:58px"></div>
    <div class="row"><button class="btn soft" data-reveal>Show answer</button></div><div class="tapcont">Tap anywhere to see the answer</div>`, { onBackdrop: () => reveal() });
  ov.querySelector('[data-reveal]').onclick = () => reveal();
  // the one offer on this screen comes a moment later (never within 1.2 s of losing)
  setTimeout(() => {
    if (ovKind !== 'fail') return;
    const b = $(`<button class="btn pink">📺 +1 ${k === 'v' ? 'mistake' : 'heart'} <small>short video</small></button>`); ov.querySelector('[data-offer]').append(b);
    b.onclick = async () => { const ok = await M.rewarded('moves', { what: `one more ${k === 'v' ? 'mistake' : 'heart'} for this puzzle` }); if (!ok || ovKind !== 'fail') return;
      r.mist--; save('days'); closeOv(); state = 'play'; bubble('Second chance, let’s go 💪'); ({ v: paintVibe, d: paintDec, g: paintGrid })[k](); };
  }, 1300);
}
async function reveal() {
  if (ovKind !== 'fail') return;
  closeOv(); state = 'play';
  const r = rec(day);
  if (kind === 'v') { V.s.groups.forEach((g, i) => { if (!r.v.found.includes(i)) r.v.found.push(i); }); V.order = []; paintVibe(true); }
  if (kind === 'd') { Dd.slots = [...Dd.s.answer].map((c, p) => Dd.s.bank.findIndex((x, i) => x === c && !Dd.slots.slice(0, p).includes(i))); paintDec(true); }
  if (kind === 'g') { const { s } = Gg; for (const cat of ['A', 'B']) for (let p = 0; p < s.N; p++) for (let i = 0; i < s.N; i++) r.g.cells[`${cat}${p}_${i}`] = s.sol[cat][p] === i ? 3 : 1; paintGrid(); }
  bubble('Here’s the answer. Tomorrow we ate 💜');
  await wait(1100);
  finish(false);
}
function resultCard() {
  const { kind: k, stars, coins, sticker } = lastResult, r = rec(day);
  const next = KINDS.find(x => !r[x].done);
  const titles = stars === 3 ? ['Slay!', 'Iconic!', 'Perfect!'] : stars === 2 ? ['Nice!', 'So good!', 'Yay!'] : stars === 1 ? ['Solved!', 'You did it!'] : ['Next time!'];
  const title = pickOf(titles, setOf(day).no);
  const stk = sticker ? `<div class="stk ${sticker.holo ? 'holo' : ''}"><img src="${thumb(sticker.id)}" alt=""></div>` : '';
  overlay('result', `<h3 class="outline">${title}</h3>
    <div class="bigstars">${[0, 1, 2].map(i => `<i class="${i < stars ? '' : 'off'}">⭐</i>`).join('')}</div>
    <p>${META[k].name} · ${stars ? `${stars} star${stars > 1 ? 's' : ''}` : 'answer revealed'}${sticker ? ` · ${sticker.isNew ? 'new' : ''}${sticker.holo ? ' holo' : ''} sticker!` : ''}</p>
    <div class="reward"><span class="pill" data-coinsrc><span class="coin"></span>+${coins}</span>${stk}</div>
    ${sticker && sticker.page ? `<p>📒 You finished the <b>${sticker.page.name}</b> page! +100 coins</p>` : ''}
    <div class="row"><button class="btn pink" data-next>${next ? `Next: ${META[next].name} ▸` : 'See your set ▸'}</button></div>
    <div class="tapcont">Tap anywhere to continue</div>`, { onBackdrop: () => advance() });
  if (sticker && sticker.page) M.add(100, 'album page');
  setTimeout(() => coinFly(ov && ov.querySelector('[data-coinsrc]'), Math.min(8, 2 + stars * 2)), 500);
  if (sticker) setTimeout(() => snd.sticker(), 900);
  ov.querySelector('[data-next]').onclick = () => advance();
}
function advance() {
  if (ovKind !== 'result') return;
  const r = rec(day), next = KINDS.find(x => !r[x].done);
  closeOv();
  if (next) return start(next);
  setComplete();
}
// ---------------------------------------------------------------- set complete + share grid
function shareText(n) {
  const s = setOf(n), r = rec(n), sq = { butter: '🟨', mint: '🟩', sky: '🟦', lilac: '🟪', berry: '🟥' };
  const rows = r.v.guesses.map(g => g.g.map(gi => sq[s.v.groups[gi].color]).join(''));
  const st3 = k => r[k].won ? '⭐'.repeat(r.stars[k]) + '☆'.repeat(3 - r.stars[k]) : '🙈';
  return `Dailies Club #${s.no}${n === TODAY && st.streak.n > 1 ? ` 🔥${st.streak.n}` : ''}\n${rows.join('\n')}\n🔮 Decode ${st3('d')}\n🔎 Grid ${st3('g')}`;
}
async function share(n) {
  const text = shareText(n), url = location.origin + location.pathname;
  try { if (navigator.share) { await navigator.share({ title: NAME, text, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Copied! Paste it in the group chat 💌'); } catch (e) { toast('Could not copy'); }
}
async function setComplete() {
  const r = rec(day), first = !r.complete; r.complete = 1;
  let sk = null;
  if (first && day === TODAY) { sk = streakOnComplete(); st.sets++; }
  else if (first) st.sets++;
  const bonus = first ? 20 : 0; if (bonus) M.add(bonus, 'set'); r.coins += bonus;
  save();
  const total = r.stars.v + r.stars.d + r.stars.g, coinsToday = r.coins;
  state = 'won'; snd.win(); rain(110); SC.reactTo('cheer');
  overlay('set', `<h3 class="outline">Set complete!</h3>
    ${day === TODAY ? `<p>${st.streak.n > 1 ? `🔥 <b>${st.streak.n}-day streak</b>${sk && sk.used ? ' · a 🧊 freeze covered a missed day' : ''}` : '🔥 Streak started! Come back tomorrow'}</p>` : `<p>Archive set · ${fmt(day, { month: 'long', day: 'numeric' })}</p>`}
    <div class="share"><small>${total}/9 stars · spoiler-free</small>${shareText(day).split('\n').slice(1).join('\n')}</div>
    <div class="row"><button class="btn lilac" data-share>Share 💌</button><button class="btn soft" data-close>Done</button></div>
    <div class="row" data-offer></div>
    <div class="tapcont">${day === TODAY ? `New set in ${untilMidnight()}` : 'Tap anywhere to close'}</div>`, { onBackdrop: () => closeSet() });
  ov.querySelector('[data-share]').onclick = () => share(day);
  ov.querySelector('[data-close]').onclick = () => closeSet();
  if (first && coinsToday > 0) {
    const b = $(`<button class="btn pink">📺 Double today's coins <small>+${coinsToday}</small></button>`); ov.querySelector('[data-offer]').append(b);
    b.onclick = async () => { b.disabled = true; if (await M.rewarded('double', { what: `${coinsToday * 2} coins instead of ${coinsToday}` })) { M.add(coinsToday, 'double'); coinFly(b, 8); b.remove(); toast(`+${coinsToday} coins 💰`); } else b.disabled = false; };
  }
}
function untilMidnight() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); const s = Math.max(0, (m - n) / 1000 | 0); return `${s / 3600 | 0}h ${(s % 3600) / 60 | 0}m`; }
async function closeSet() {
  if (ovKind !== 'set') return;
  closeOv(); goHome();
  await M.breakAd('level-end', { level: st.sets });
  if (clubCanBuy()) setTimeout(() => homeSay('You can afford new club decor! ⭐ Tap Club'), 900);
}
function reviewCard(k) {
  const s = setOf(day), r = rec(day);
  let body = '';
  if (k === 'v') body = s.v.groups.map(g => `<div class="band ${g.color}" style="margin:6px 0"><b>${g.name}</b><span>${g.words.join(', ')}</span></div>`).join('');
  if (k === 'd') body = `<div class="rebus" style="margin:8px 0"><div class="eq">${s.d.emoji.map(e => `<span class="em">${e}</span>`).join('<span class="op">+</span>')}</div><div style="font:700 30px var(--round);margin-top:8px;letter-spacing:3px">${s.d.answer}</div></div>`;
  if (k === 'g') body = `<div class="dl" style="margin:8px 0">${s.g.people.map((p, i) => `<div class="di"><img src="${thumb(p.id)}" alt=""><div class="nm">${p.name}<small>${s.g.items[0][s.g.sol.A[i]].name} · ${s.g.items[1][s.g.sol.B[i]].name}</small></div></div>`).join('')}</div>`;
  overlay('review', `<button class="xbtn" data-x>×</button><h3>${META[k].name}</h3><div class="bigstars">${[0, 1, 2].map(i => `<i class="${i < r.stars[k] ? '' : 'off'}">⭐</i>`).join('')}</div>${body}
    ${r.complete ? `<div class="row"><button class="btn lilac" data-share>Share set 💌</button></div>` : ''}`, { onBackdrop: () => closeOv() });
  ov.querySelector('[data-x]').onclick = () => closeOv();
  const sh = ov.querySelector('[data-share]'); if (sh) sh.onclick = () => share(day);
}

// ---------------------------------------------------------------- streak card
function streakCard() {
  const s = st.streak, sn = streakNow(), fz = freezes();
  // this week Mon..Sun
  const wd = (P.weekday(TODAY) + 6) % 7, mon = P.addDays(TODAY, -wd);
  const strip = [...Array(7).keys()].map(i => { const n = P.addDays(mon, i), r = st.days[n], fzd = s.frozen.includes(n);
    return `<span><i class="${r && r.complete ? 'on' : fzd ? 'fz' : ''}">${r && r.complete ? '🔥' : fzd ? '🧊' : n === TODAY ? '·' : ''}</i>${'MTWTFSS'[i]}</span>`; }).join('');
  const canRescue = s.broken && s.broken.day === TODAY && s.broken.n > 1 && !s.rescued && rec(TODAY).complete;
  overlay('streak', `<button class="xbtn" data-x>×</button><span class="flame">🔥</span><h3 class="outline">${rec(TODAY).complete ? s.n : sn.n} day${(rec(TODAY).complete ? s.n : sn.n) === 1 ? '' : 's'}</h3>
    <p>Finish the daily set to keep it going. Best: <b>${s.best}</b></p><div class="week">${strip}</div>
    <div class="row2"><span>🧊 Freezes ready: ${fz}<small>One free every week. A freeze covers a day you miss, automatically.</small></span></div>
    <div class="row2"><span>Extra freeze<small>Keep up to 2 extra</small></span><button class="btn butter" data-buy style="padding:9px 14px;font-size:15px" ${s.extra >= 2 ? 'disabled' : ''}><span class="coin"></span> 60</button></div>
    ${canRescue ? `<div class="row2"><span>Rescue your ${s.broken.n}-day streak<small>Once, with a short video</small></span><button class="btn pink" data-rescue style="padding:9px 14px;font-size:15px">📺 Rescue</button></div>` : ''}`, { onBackdrop: () => closeOv() });
  ov.querySelector('[data-x]').onclick = () => closeOv();
  ov.querySelector('[data-buy]').onclick = () => { if (st.streak.extra < 2 && M.spend(60, 'freeze')) { st.streak.extra++; save('streak'); snd.coin(); toast('🧊 Freeze added'); streakCard(); paintHome(); } else if (st.streak.extra < 2) M.shop(); };
  const rb = ov.querySelector('[data-rescue]'); if (rb) rb.onclick = async () => { if (await M.rewarded('revive', { what: `your ${s.broken.n}-day streak back` })) { st.streak.n += s.broken.n; st.streak.best = Math.max(st.streak.best, st.streak.n); st.streak.rescued = 1; st.streak.broken = null; save('streak'); toast(`🔥 ${st.streak.n}-day streak restored`); streakCard(); paintHome(); } };
}

// ---------------------------------------------------------------- archive
const ARCH_FREE = 7, ARCH_COST = 30;
function archiveCard() {
  const days = 28, first = P.addDays(TODAY, -(days - 1)), lead = (P.weekday(first) + 6) % 7;
  let cells = [...'MTWTFSS'].map(c => `<span class="h">${c}</span>`).join('') + Array(lead).fill('<span class="empty"></span>').join('');
  for (let i = 0; i < days; i++) { const n = P.addDays(first, i), r = st.days[n], age = Math.round((P.fromNum(TODAY) - P.fromNum(n)) / 864e5);
    const lock = age > ARCH_FREE && !st.unlocked.includes(n) && !M.hasPass() && !(r && KINDS.some(k => r[k].done));
    const cls = [r && r.complete ? 'done' : r && KINDS.some(k => r[k].done) ? 'part' : st.streak.frozen.includes(n) ? 'fz' : '', n === TODAY ? 'today' : '', lock ? 'lock' : ''].join(' ');
    cells += `<button class="${cls}" data-n="${n}">${P.fromNum(n).getDate()}<small>${lock ? '🔒' : r && r.complete ? '★' + (r.stars.v + r.stars.d + r.stars.g) : ''}</small></button>`; }
  overlay('archive', `<button class="xbtn" data-x>×</button><div class="sheetc"><h3>Archive</h3><p style="text-align:center">The last ${ARCH_FREE} days are free. Older sets unlock for ${ARCH_COST} coins.</p><div class="cal">${cells}</div></div>`, { onBackdrop: () => closeOv() });
  ov.querySelector('[data-x]').onclick = () => closeOv();
  ov.querySelectorAll('.cal button').forEach(b => b.onclick = () => {
    const n = +b.dataset.n;
    if (b.classList.contains('lock')) { if (M.spend(ARCH_COST, 'archive')) { st.unlocked.push(n); save('unlocked'); snd.coin(); } else { M.shop(); return; } }
    snd.pop(); closeOv(); day = n; paintHome(); greet();
  });
}

// ---------------------------------------------------------------- album
function albumCard(page = 0) {
  try { S.set('albumNew', 0); } catch (e) {}
  const pg = PAGES[page], have = pg.ids.filter(x => st.album[x]).length, total = ALL_STICKERS.filter(x => st.album[x]).length;
  overlay('album', `<button class="xbtn" data-x>×</button><div class="sheetc"><h3>Sticker album</h3><p style="text-align:center">${total}/${ALL_STICKERS.length} stickers · one per solved puzzle, holo for ⭐⭐⭐</p>
    <div class="tabs">${PAGES.map((p, i) => `<button class="${i === page ? 'on' : ''}" data-pg="${i}">${p.name}${st.pages.includes(p.name) ? ' ✓' : ''}</button>`).join('')}</div>
    <div class="prog"><b style="width:${have / pg.ids.length * 100}%"></b></div>
    <div class="album">${pg.ids.map(x => `<div class="s ${st.album[x] ? '' : 'no'} ${st.album[x] === 2 ? 'holo' : ''}"><img src="${thumb(x)}" alt=""></div>`).join('')}</div>
    <p style="text-align:center">Fill a page: +100 coins</p></div>`, { onBackdrop: () => closeOv() });
  ov.querySelector('[data-x]').onclick = () => { closeOv(); paintHome(); };
  ov.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { snd.tap(); albumCard(+b.dataset.pg); });
}

// ---------------------------------------------------------------- club decor (meta)
function clubCard() {
  overlay('club', `<button class="xbtn" data-x>×</button><div class="sheetc"><h3>Club room</h3><p style="text-align:center">Spend stars from your sets on decor. You have <b>⭐ ${st.stars}</b></p>
    <div class="dl">${DECOR.map(d => { const own = st.decor.includes(d.id); return `<div class="di ${own ? 'own' : ''}"><img src="${thumb(d.glb)}" alt=""><div class="nm">${d.name}<small>${own ? 'In the club' : `⭐ ${d.cost} stars`}</small></div>${own ? '' : `<button class="btn ${st.stars >= d.cost ? 'pink' : 'soft'}" data-buy="${d.id}" ${st.stars >= d.cost ? '' : 'disabled'}>⭐ ${d.cost}</button>`}</div>`; }).join('')}</div></div>`, { onBackdrop: () => closeOv() });
  ov.querySelector('[data-x]').onclick = () => closeOv();
  ov.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const d = DECOR.find(x => x.id === b.dataset.buy); if (!d || st.stars < d.cost) return;
    st.stars -= d.cost; st.decor.push(d.id); save('stars', 'decor'); closeOv(); goHome();
    SC.placeDecor(d.id, true); snd.sparkle(); SC.reactTo('cheer'); setTimeout(() => homeSay(`New ${d.name.toLowerCase()}! The club is glowing ✨`), 500);
    const p = SC.hostScreen(); burst(p.x, p.y + 40, 40);
  });
}

// ---------------------------------------------------------------- boot + loop
let last = performance.now();
function tickFrame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  SC.update(dt); SC.render(); fxTick();
  requestAnimationFrame(tickFrame);
}
async function boot() {
  const bar = document.querySelector('#load b');
  if (Q.get('date') && /^\d{8}$/.test(Q.get('date'))) { const n = +Q.get('date'); if (n <= TODAY && n > P.addDays(TODAY, -60)) day = n; }
  bar.style.width = '35%';
  await Promise.race([SC.hostReady, wait(6000)]); bar.style.width = '80%';
  await Promise.all(st.decor.map(id => SC.placeDecor(id)));
  bar.style.width = '100%';
  setView("home"); paintHome(); requestAnimationFrame(tickFrame);
  const ld = document.getElementById('load'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 500);
  setTimeout(greet, 700);
  if (D.isDaily || Q.get('date')) { const k = KINDS.find(q => !rec(day)[q].done); if (k) setTimeout(() => start(k), 900); }
}
boot().catch(e => console.error(e));

// ---------------------------------------------------------------- test hooks + bot (paced like a quick human)
let botTick = 0;
window.__game = {
  get state() { return state; },
  get level() { return st.solved; },
  get score() { const r = st.days[TODAY]; return r ? r.stars.v + r.stars.d + r.stars.g : 0; },
  get view() { return { view, kind, day, ov: ovKind }; },
  bot() {
    if (ov) {
      if (ovKind === 'result' || ovKind === 'set' || ovKind === 'fail') return;   // the checker taps to continue
      return closeOv();
    }
    if (view === 'home') {
      const k = KINDS.find(q => !rec(day)[q].done);
      if (k) return start(k);
      for (let i = 0; i <= ARCH_FREE; i++) { const n = P.addDays(TODAY, -i); if (!(st.days[n] && st.days[n].complete)) { day = n; paintHome(); return; } }
      return;
    }
    if (view !== 'play' || state !== 'play' || busy || (botTick++ % (kind === 'd' ? 6 : 3))) return;
    if (kind === 'v') {
      const r = rec(day).v, gi = V.s.groups.findIndex((g, i) => !r.found.includes(i));
      const want = V.s.tiles.map((t, i) => i).filter(i => V.s.tiles[i].g === gi);
      const wrong = V.sel.find(i => !want.includes(i)); if (wrong != null) return vibeTap(wrong);
      const nx = want.find(i => !V.sel.includes(i)); if (nx != null) return vibeTap(nx);
      return vibeSubmit();
    }
    if (kind === 'd') {
      const p = Dd.slots.indexOf(-1); if (p < 0) return;
      const i = Dd.s.bank.findIndex((c, j) => c === Dd.s.answer[p] && !Dd.slots.includes(j)); if (i >= 0) decTap(i);
      return;
    }
    if (kind === 'g') {
      const { s } = Gg, r = rec(day).g;
      for (const cat of ['A', 'B']) for (let p = 0; p < s.N; p++) { const id = `${cat}${p}_${s.sol[cat][p]}`; const v = r.cells[id] || 0; if (v < 2) return gridTap(id); }
    }
  },
};
