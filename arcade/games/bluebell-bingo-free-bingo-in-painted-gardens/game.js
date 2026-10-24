// Bluebell Bingo: calm 75-ball bingo for grown-ups who like a nice garden. 1–4 very large cards (auto-daub on by
// default), a gentle caller voice, slow or normal calling, eight painted garden rooms on a map whose plants bloom with
// your stars, a stamp album, power-ups, free coins only. Fair draws from the crypto generator, odds in the Fair play
// sheet, for fun only. Style C · Storybook Garden: painted art from assets/storybook, every word and number drawn in code.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { ROOMS, ROUNDS_PER_ROOM, STAMP_NAMES, BALL, ballOf, DAB_INK, CALLS, levelDef, DAILY, POWER_DAUBS, CARD_COST, BOOST_COST, PAY, SPEEDS } from './data.js';
import { fairRng, seededRng, shuffle, pick, makeCard, makeBag, readyMasks, closeness, pickPower, oddsTable, SHAPES, LETTER, MAX_BINGOS, POWERS } from './rules.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Bluebell Bingo: Free Bingo in Painted Gardens', SLUG = 'bluebell-bingo';
const BOT = !!navigator.webdriver;
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60e3) / 864e5);
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const weekNum = (d = dayNum()) => Math.floor((d + 3) / 7);
const fmt = n => n.toLocaleString('en-US');
const A = p => './assets/' + p + '.webp';
const ICON = n => A('icons/' + n), BALLIMG = c => A('bingo/ball-' + c), STAMP = id => A('stamps/stamp-' + id);

// ---------------------------------------------------------------- saved state
const S = store(SLUG);
const st = {
  level: S.get('level', 1), stars: S.get('stars', {}), album: S.get('album', {}), sel: S.get('sel', -1), cards: S.get('cards', 2),
  welcomed: S.get('welcomed', 0), ds: S.get('ds', { last: 0, n: 0, fw: -1 }), gift: S.get('gift', 0), bingos: S.get('bingos', 0),
  wins: S.get('wins', 0), auto: S.get('auto', true), speed: S.get('speed', 'slow'), big: S.get('big', false), boost: S.get('boost', false), tipped: S.get('tipped', 0),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow(SLUG);   // recorded only: ball budgets are fixed per round and never adapt (see Fair play)
const M = money({ game: SLUG, style: 'C' });
const LAP = ROOMS.length * ROUNDS_PER_ROOM;
const progRoom = () => Math.floor((st.level - 1) / ROUNDS_PER_ROOM) % ROOMS.length;
const unlocked = r => st.level > LAP || r <= progRoom();
const roomStars = r => { let s = 0; for (let i = 1; i <= ROUNDS_PER_ROOM; i++) s += st.stars[r * ROUNDS_PER_ROOM + i] || 0; return s; };
const totalStars = () => Object.values(st.stars).reduce((a, b) => a + b, 0);
const roomStamps = r => ROOMS[r].stamps.filter(id => st.album[id] > 0).length;
const albumCount = () => ROOMS.reduce((a, _, r) => a + roomStamps(r), 0);
if (st.sel < 0 || !unlocked(st.sel)) st.sel = progRoom();
document.documentElement.classList.toggle('big', st.big);

// ---------------------------------------------------------------- background
const bgEls = [...document.querySelectorAll('#bb-bg i')]; let bgOn = 0, bgCur = '';
function setBg(name) {
  const wide = innerWidth / innerHeight > 1, url = A('bg/' + name + (wide ? '-wide' : ''));
  if (url === bgCur) return; bgCur = url;
  const next = bgEls[1 - bgOn], img = new Image();
  img.onload = img.onerror = () => { if (bgCur !== url) return; next.style.backgroundImage = `url(${url})`; next.classList.add('on'); bgEls[bgOn].classList.remove('on'); bgOn = 1 - bgOn; };
  img.src = url;
}
const veil = document.getElementById('bb-veil');

// ---------------------------------------------------------------- kit UI (start / win / lose cards)
const ui = createUI({ title: 'Bluebell Bingo', hint: 'Tap to begin', hand: '', progress: false, score: false });
const D = daily(SLUG, ui, { name: NAME });
const B = worldBoard({ game: 'bluebell-bingo', label: 'Bingos', limits: { maxRun: 14, maxPerSec: 0.8 }, mode: 'sum', corner: 'tl', accent: '#B08834' });
{
  const s = ui.els.start; s.classList.add('bb-title', 'bb');
  const h = s.querySelector('h1'), logo = $(`<div class="logo"><img class="gar" src="${A('kit/garland')}" alt=""></div>`);
  h.innerHTML = 'Bluebell Bingo<small>calm bingo in painted gardens</small>';
  h.before(logo); logo.appendChild(h);
  logo.appendChild($(`<div class="balls">${'BINGO'.split('').map((l, i) => `<span style="background-image:url(${BALLIMG(BALL[i])});animation-delay:${i * 0.3}s">${l}</span>`).join('')}</div>`));
  logo.appendChild($(`<div class="forfun">Free coins · fair draws · for fun only</div>`));
  for (const c of [ui.els.win, ui.els.lose]) {
    c.classList.add('bb-res', 'bb'); const p = $('<div class="bb-rpanel"></div>');
    while (c.firstChild) p.appendChild(c.firstChild); c.appendChild(p);
    c.querySelectorAll('.hc-btn').forEach(b => b.classList.add('bb-hidden'));   // daily.js "beat my score" button: our own share grid replaces it
  }
  ui.els.lose.classList.add('lose');
}

// ---------------------------------------------------------------- HUD
const hud = $(`<div class="bb">
  <div id="bb-top">
    <button class="bb-btn bb-ic bb-hidden" id="bb-home" aria-label="Back to the garden map"><img src="${ICON('home')}" alt=""></button>
    <button class="bb-btn bb-ic bb-hidden" id="bb-voice" aria-label="Caller voice"><img alt=""></button>
    <div class="bb-stars bb-ivory bb-hidden" id="bb-starsp"><img src="${A('kit/star-full')}" alt=""><span data-n>0</span></div>
    <div class="sp"></div>
    <button class="bb-btn bb-ic bb-hidden" id="bb-set" aria-label="Settings"><img src="${ICON('settings')}" alt=""></button>
    <button class="bb-btn bb-coins bb-ivory bb-hidden" id="bb-coins" aria-label="Coins and shop"><img src="${A('kit/coin')}" alt=""><span data-n>0</span><span class="plus">+</span></button>
  </div>
  <div id="bb-lobby" class="bb-hidden">
    <div id="bb-map"><svg></svg></div>
    <div id="bb-panel">
      <button class="bb-btn bb-navy bb-play"></button>
      <div class="bb-row">
        <button class="bb-btn bb-ivory bb-tile" data-album><img src="${A('icons/album')}" alt="">Album<span class="n"></span></button>
        <button class="bb-btn bb-ivory bb-tile" data-daily><img src="${A('icons/calendar')}" alt=""><span data-t>Daily</span><span class="n"></span></button>
        <button class="bb-btn bb-ivory bb-tile" data-shop><img src="${A('icons/shop')}" alt="">Shop</button>
        <button class="bb-btn bb-ivory bb-tile" data-fair><img src="${A('icons/check')}" alt="">Odds</button>
      </div>
      <button class="bb-btn bb-forfun" data-fair>For fun only · no cash prizes</button>
    </div>
  </div>
  <div id="bb-play" class="bb-hidden">
    <div id="bb-caller" class="bb-ivory">
      <div class="bb-bigball"><div class="wait">Eyes<br>down…</div></div>
      <div class="bb-callinfo"><div class="bb-callline">&nbsp;</div><div class="bb-recent"></div><div class="bb-left"><b>0</b> balls left</div></div>
      <button class="bb-btn bb-pat" aria-label="Pattern and odds"><div class="bb-mini"></div><small></small></button>
    </div>
    <div id="bb-cards"></div>
    <button class="bb-btn" id="bb-fair"><span>Fair draws · for fun only · odds</span></button>
    <div id="bb-bar">
      <button class="bb-btn" id="bb-power" aria-label="Power-up"><div class="in"><img src="${ICON('gift')}" alt=""></div><small>0/${POWER_DAUBS}</small></button>
      <button class="bb-btn bb-rose off" id="bb-bingo">Bingo!</button>
      <button class="bb-btn bb-ivory" id="bb-speed" aria-label="Calling speed"><i><u></u><u></u></i><span></span></button>
    </div>
  </div>
  <div id="bb-big"><b>Bingo!</b></div>
</div>`);
document.body.appendChild(hud);
const roomBox = $(`<div class="bb-roombox bb">
  <div class="bb-rt"><button class="bb-btn nav" data-prev aria-label="Previous garden">‹</button><div><b></b><small></small></div><button class="bb-btn nav" data-next aria-label="Next garden">›</button></div>
  <div class="bb-rounds"></div>
  <div class="bb-pline"></div>
  <div class="bb-cardsel"><span>Cards</span></div>
  <button class="bb-btn bb-boost bb-ivory"><i class="bx"></i><span>Bluebell Boost<small>power-up ready at the start</small></span><em><img src="${A('kit/coin')}" alt="">${BOOST_COST}</em></button>
  <button class="bb-btn bb-navy bb-start"></button>
</div>`);
const q = s => hud.querySelector(s) || roomBox.querySelector(s);
const el = {
  top: q('#bb-top'), home: q('#bb-home'), voice: q('#bb-voice'), starsP: q('#bb-starsp'), set: q('#bb-set'), coins: q('#bb-coins'), coinsN: q('#bb-coins [data-n]'),
  lobby: q('#bb-lobby'), map: q('#bb-map'), panel: q('#bb-panel'), rt: q('.bb-rt'), rounds: q('.bb-rounds'), pline: q('.bb-pline'), cardsel: q('.bb-cardsel'), boost: q('.bb-boost'), play: q('.bb-play'), start: q('.bb-start'),
  game: q('#bb-play'), caller: q('#bb-caller'), bigball: q('.bb-bigball'), callline: q('.bb-callline'), recent: q('.bb-recent'), left: q('.bb-left'), pat: q('.bb-pat'),
  cards: q('#bb-cards'), fair: q('#bb-fair'), bar: q('#bb-bar'), power: q('#bb-power'), bingo: q('#bb-bingo'), speed: q('#bb-speed'), big: q('#bb-big'),
};
const petals = document.createElement('canvas'); petals.id = 'bb-petals'; document.body.appendChild(petals);

function refreshVoice() { el.voice.querySelector('img').src = ICON(snd.voice ? 'sound' : 'sound-off'); el.voice.classList.toggle('off', !snd.voice); el.voice.setAttribute('aria-label', 'Caller voice ' + (snd.voice ? 'on' : 'off')); }
function refreshSpeed() { el.speed.classList.toggle('slow', st.speed === 'slow'); el.speed.querySelector('span').textContent = st.speed === 'slow' ? 'Slow' : 'Normal'; }
refreshVoice(); refreshSpeed();
el.voice.onclick = () => { snd.setVoice(!snd.voice); refreshVoice(); snd.tap(); toast(snd.voice ? 'sound' : 'sound-off', snd.voice ? 'Caller voice on' : 'Caller voice off', snd.voice ? 'every ball is read out' : 'balls are shown, not spoken'); };
el.speed.onclick = () => { st.speed = st.speed === 'slow' ? 'normal' : 'slow'; save(); refreshSpeed(); snd.tap(); toast(null, st.speed === 'slow' ? 'Slow calling' : 'Normal calling', `a new ball every ${SPEEDS[st.speed]} seconds`); };
el.set.onclick = () => { snd.tap(); openSettings(); };
el.coins.onclick = () => { snd.tap(); M.shop(); };
let shownCoins = M.coins();
el.coinsN.textContent = fmt(shownCoins);
M.onChange(s => { if (s.coins > shownCoins) bump(el.coins); shownCoins = s.coins; el.coinsN.textContent = fmt(s.coins); if (mode === 'lobby') refreshCardSel(); });
function bump(e) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }

// ---------------------------------------------------------------- toasts, flights, petals
let toastEl = null;
function toast(icon, title, sub = '') {
  toastEl?.remove();
  const src = !icon ? null : icon.startsWith('./') ? icon : ICON(icon);
  toastEl = $(`<div class="bb-toast bb bb-ivory${mode === 'play' ? ' low' : ''}">${src ? `<img src="${src}" alt="">` : ''}<div>${title}${sub ? `<small>${sub}</small>` : ''}</div></div>`);
  document.body.appendChild(toastEl); const t = toastEl; setTimeout(() => t.remove(), 3300);
}
function flyCoins(fromEl, n = 6) {
  const a = fromEl.getBoundingClientRect(), b = el.coins.getBoundingClientRect();
  if (el.coins.classList.contains('bb-hidden')) return;
  for (let i = 0; i < n; i++) {
    const f = $('<div class="bb-fly"></div>'); document.body.appendChild(f);
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 40, y0 = a.top + a.height / 2 + (Math.random() - 0.5) * 30, x1 = b.left + 8, y1 = b.top + 9;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 100, my = Math.min(y0, y1) - 40 - Math.random() * 60;
    f.animate([{ transform: `translate(${x0}px,${y0}px) scale(.5)` }, { transform: `translate(${mx}px,${my}px) scale(1.15)`, offset: 0.45 }, { transform: `translate(${x1}px,${y1}px) scale(.8)` }],
      { duration: 800 + i * 80, easing: 'cubic-bezier(.4,0,.5,1)', delay: i * 60, fill: 'both' }).onfinish = () => { f.remove(); snd.coin(i); if (i === n - 1) bump(el.coins); };
  }
}
// falling petals (rose, ivory, lilac, sage, gold): calm, no flashing
const PCOL = ['#e9a3ad', '#f6d5d9', '#fffaf0', '#c7b5dd', '#a9c3a1', '#e6c983'];
const P = [], pctx = petals.getContext('2d');
function sizePetals() { const d = Math.min(2, devicePixelRatio || 1); petals.width = innerWidth * d; petals.height = innerHeight * d; pctx.setTransform(d, 0, 0, d, 0, 0); }
sizePetals();
function petalBurst(x, y, n = 40, spread = 1) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) n = Math.min(n, 8);
  for (let i = 0; i < n && P.length < 260; i++) {
    const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 220) * spread;
    P.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, r: 5 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 4, ph: Math.random() * 6, c: PCOL[i % PCOL.length], life: 3.2 + Math.random() * 1.6 });
  }
}
function petalRain(n = 60) { for (let i = 0; i < n && P.length < 260; i++) P.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5, vx: 0, vy: 40 + Math.random() * 40, r: 5 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, ph: Math.random() * 6, c: PCOL[i % PCOL.length], life: 6 + Math.random() * 3 }); }
function tickPetals(dt) {
  pctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt; if (p.life <= 0 || p.y > innerHeight + 30) { P.splice(i, 1); continue; }
    p.vx *= 1 - 1.6 * dt; p.vy += (55 - p.vy) * 1.4 * dt; p.ph += dt * 2.2; p.x += (p.vx + Math.sin(p.ph) * 26) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    pctx.save(); pctx.translate(p.x, p.y); pctx.rotate(p.rot); pctx.globalAlpha = Math.min(1, p.life / 0.8) * 0.95;
    pctx.fillStyle = p.c; pctx.beginPath(); pctx.ellipse(0, 0, p.r, p.r * 0.55 * (0.6 + 0.4 * Math.abs(Math.sin(p.ph))), 0, 0, Math.PI * 2); pctx.fill();
    pctx.strokeStyle = 'rgba(176,136,52,.25)'; pctx.lineWidth = 0.8; pctx.stroke(); pctx.restore();
  }
}
function bigText(t) { el.big.querySelector('b').textContent = t; el.big.classList.remove('go'); void el.big.offsetWidth; el.big.classList.add('go'); }

// ---------------------------------------------------------------- modes + layout
let mode = 'title', state = 'ready', Rd = null, busy = false, dailyMode = !!D.seed, encore = false, pendingUnlock = null, loaded = false, pendingStart = false;
function setMode(m) {
  mode = m; const play = m === 'play', lob = m === 'lobby';
  el.lobby.classList.toggle('bb-hidden', !lob); el.game.classList.toggle('bb-hidden', !play);
  el.home.classList.toggle('bb-hidden', !play); el.voice.classList.toggle('bb-hidden', !play);
  el.starsP.classList.toggle('bb-hidden', !lob); el.set.classList.toggle('bb-hidden', m === 'title'); el.coins.classList.toggle('bb-hidden', m === 'title');
  el.coins.querySelector('.plus').classList.toggle('bb-hidden', play);
  veil.classList.toggle('on', play);
  layout();
}
const isWide = () => innerWidth / innerHeight > 1;
function layout() {
  sizePetals();
  const W = innerWidth, H = innerHeight, wide = isWide(), top = 74 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0);
  if (mode === 'lobby') layoutLobby(W, H, wide, top);
  if (mode === 'play') layoutPlay(W, H, wide, top);
}
function box(e, x, y, w, h) { Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h == null ? '' : h + 'px' }); }

function layoutLobby(W, H, wide, top) {
  let mx, my, mw, mh;
  if (!wide) {
    const pw = Math.min(W - 20, 480); box(el.panel, (W - pw) / 2, 0, pw, null);
    const ph = el.panel.offsetHeight; el.panel.style.top = (H - 10 - ph) + 'px';
    mx = 6; my = top + 4; mw = W - 12; mh = H - 10 - ph - 10 - my;
  } else {
    const pw = clamp(W * 0.3, 320, 400); box(el.panel, W - pw - 28, 0, pw, null);
    el.panel.classList.add('side');
    const ph = el.panel.offsetHeight; el.panel.style.top = Math.max(top, (H - ph) / 2 + 20) + 'px';
    mx = 30; my = top + 10; mw = W - pw - 90; mh = H - my - 24;
  }
  if (!wide) el.panel.classList.remove('side');
  box(el.map, mx, my, mw, mh);
  drawMap(mw, mh, wide);
}
function drawMap(w, h, wide) {
  const cols = wide ? 4 : 2, rows = Math.ceil(ROOMS.length / cols);
  const m = Math.round(clamp(Math.min(h / rows * (wide ? 0.6 : 0.56), w / cols * (wide ? 0.42 : 0.4)), 50, wide ? 120 : 92));
  const pts = ROOMS.map((_, i) => {
    const row = Math.floor(i / cols), k = i % cols, c = row % 2 ? cols - 1 - k : k;   // serpentine, starting bottom-left
    const x = (c + 0.5) / cols * w + (row % 2 ? -1 : 1) * w * 0.02, y = h - (row + 0.5) / rows * h - m * 0.12;
    return [x, y];
  });
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const sameRow = Math.abs(y0 - y1) < 1; d += sameRow ? ` C${x0},${y0 - m * 0.5} ${x1},${y1 + m * 0.5} ${x1},${y1}` : ` C${x0 + (x0 > w / 2 ? 1 : -1) * m * 1.1},${y0} ${x1 + (x1 > w / 2 ? 1 : -1) * m * 1.1},${y1} ${x1},${y1}`; }
  const prog = Math.min(ROOMS.length - 1, st.level > LAP ? ROOMS.length - 1 : progRoom());
  el.map.querySelector('svg').innerHTML = `<path d="${d}" fill="none" stroke="rgba(250,246,236,.9)" stroke-width="16" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#B08834" stroke-width="3.5" stroke-dasharray="2 11" stroke-linecap="round"/>`;
  el.map.querySelectorAll('.bb-stop').forEach(s => s.remove());
  ROOMS.forEach((R, i) => {
    const un = unlocked(i), s = roomStars(i), stage = s >= 12 ? 'bloom' : s >= 8 ? 'bud' : s >= 4 ? 'young' : 'seedling';
    const b = $(`<button class="bb-btn bb-stop${un ? '' : ' lock'}${i === st.sel && !dailyMode ? ' sel' : ''}" style="--m:${m}px;left:${pts[i][0]}px;top:${pts[i][1]}px" aria-label="${R.name}${un ? '' : ' (locked)'}">
      <div class="med" style="background-image:url(${A('bg/' + R.bg + '-s')})">${i === prog && !dailyMode ? `<img class="pin" src="${A('kit/rosette')}" alt="">` : ''}${un ? `<img class="plant" style="--ps:${{ seedling: 0.42, young: 0.58, bud: 0.7, bloom: 0.82 }[stage]}" src="${A('plants/' + R.plant + '-' + stage)}" alt="">` : ''}</div>
      <span class="nm">${R.short}</span>${un ? `<span class="st">★ ${s}/15</span>` : ''}</button>`);
    b.onclick = () => {
      if (dailyMode) { dailyMode = false; }
      if (!un) { snd.nope(); toast('lock', `${R.name} is still closed`, 'win the rounds before it to walk there'); return; }
      st.sel = i; save(); snd.page(); refreshLobby(); openRoom();
    };
    el.map.appendChild(b);
  });
}
function fitCards(n, W, H) {
  // cells may be up to 1.45× wider than tall, so stacked cards use the phone's full width (bigger numbers)
  let best = { cs: 0, cw: 0, c: 1, score: 0 };
  for (let c = 1; c <= Math.min(4, n); c++) {
    const rows = Math.ceil(n / c), gap = 16, colW = (W - (c - 1) * gap) / c, rowH = (H - (rows - 1) * gap) / rows;
    const ch = Math.min((rowH - 14) / 5.84, 96), cw = Math.min((colW - 14) / 5.2, ch * 1.45), cs = Math.min(ch, cw / 1);
    const h = Math.min(ch, cw * 1.05), score = Math.min(h * 0.62, cw * 0.44);
    if (score > best.score + 0.2) best = { cs: Math.floor(h), cw: Math.floor(cw), c, score };
  }
  return best;
}
function layoutPlay(W, H, wide, top) {
  const n = Rd ? Rd.cards.length : 1;
  let ax, ay, aw, ah;
  if (!wide) {
    const bs = clamp(Math.round(W * 0.26), 92, 116); el.caller.style.setProperty('--bs', bs + 'px');
    box(el.caller, 8, top, W - 16, bs + 20);
    const barH = 84, barY = H - 12 - barH; box(el.bar, 10, barY, W - 20, barH);
    const fairY = barY - 42; box(el.fair, 0, fairY, W, 36);
    ax = 8; ay = top + bs + 20 + 12; aw = W - 16; ah = fairY - 6 - ay;
  } else {
    const L = clamp(W * 0.3, 320, 420), bs = clamp(Math.round(H * 0.2), 120, 180);
    el.caller.style.setProperty('--bs', bs + 'px'); el.caller.classList.add('col');
    const ch = bs + 150; box(el.caller, 28, top + 4, L, ch);
    box(el.bar, 28, top + 4 + ch + 22, L, 84);
    box(el.fair, 28, top + 4 + ch + 22 + 84 + 18, L, 36);
    ax = L + 60; ay = top - 4; aw = W - ax - 24; ah = H - ay - 16;
  }
  if (!wide) el.caller.classList.remove('col');
  const f = fitCards(n, aw, ah), cs = f.cs;
  const nf = Math.max(20, Math.min(f.score * (st.big ? 1.14 : 0.96), cs * 0.74, f.cw * 0.6));   // never under 20 px
  Object.assign(el.cards.style, { left: ax + 'px', top: ay + 'px', width: aw + 'px', height: ah + 'px', gridTemplateColumns: `repeat(${f.c}, auto)`, gap: '16px' });
  el.cards.querySelectorAll('.bb-card').forEach(c => { c.style.setProperty('--cs', cs + 'px'); c.style.setProperty('--cw', f.cw + 'px'); c.style.setProperty('--nf', nf.toFixed(1) + 'px'); });
}
addEventListener('resize', () => { layout(); if (mode === 'lobby') setBg(lobbyBg()); else if (mode === 'play' && Rd) setBg(ROOMS[Rd.def.room].bg); else setBg('bluebell-bingo'); });

// ---------------------------------------------------------------- lobby
const freeCards = def => (def && (def.daily || (def.n && def.n <= 5))) ? 2 : 1;
const cardCost = (n, def) => Math.max(0, n - freeCards(def)) * CARD_COST;
function lobbyDef() {
  if (dailyMode) return DAILY(ymd());
  const d = levelDef(st.level);
  if (st.sel !== d.room || st.level > LAP && st.sel !== d.room) { encore = true; return { ...levelDef(st.sel * ROUNDS_PER_ROOM + 1 + (st.level % 3)), room: st.sel, encore: true }; }
  encore = false; return d;
}
const lobbyBg = () => dailyMode ? ROOMS[DAILY(ymd()).room].bg : ROOMS[st.sel].bg;
function refreshCardSel() {
  const def = lobbyDef();
  el.cardsel.querySelectorAll('button').forEach(b => b.remove());
  for (let n = 1; n <= 4; n++) {
    const cost = cardCost(n, def), sel = def.daily ? n === 2 : st.cards === n;
    const b = $(`<button class="bb-btn bb-ivory${sel ? ' sel' : ''}${cost > M.coins() ? ' poor' : ''}" aria-label="${n} card${n > 1 ? 's' : ''}"><b>${'<i></i>'.repeat(n)}</b><small>${cost ? `<img src="${A('kit/coin')}" alt="">${cost}` : 'Free'}</small></button>`);
    if (def.daily && n !== 2) b.style.opacity = 0.35;
    b.onclick = () => {
      if (def.daily) { toast('calendar', 'The daily uses 2 free cards', 'the same cards for everyone today'); return; }
      snd.tap(); if (cost > M.coins()) { toast('coins', 'Not quite enough coins', 'win a bingo or visit the shop'); return; }
      st.cards = n; save(); refreshCardSel();
    };
    el.cardsel.appendChild(b);
  }
  el.boost.classList.toggle('on', !!st.boost);
}
function refreshLobby() {
  const def = lobbyDef(), r = def.room, R = ROOMS[r];
  setBg(lobbyBg());
  el.rt.querySelector('b').textContent = dailyMode ? 'Daily Bingo' : R.name;
  el.rt.querySelector('small').textContent = dailyMode ? `${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · ${R.short}` : encore ? `Encore round · stamps & coins` : `Round ${def.round} of ${ROUNDS_PER_ROOM}${def.hard ? ' · a tricky one' : ''}`;
  el.rt.querySelector('[data-prev]').disabled = dailyMode || st.sel <= 0;
  el.rt.querySelector('[data-next]').disabled = dailyMode || st.sel >= ROOMS.length - 1 || !unlocked(st.sel + 1);
  el.rounds.innerHTML = '';
  if (dailyMode) {
    const fr = weekNum() !== st.ds.fw;
    el.rounds.innerHTML = `<div class="bb-round${st.ds.n ? ' done' : ''}" style="width:auto;padding:0 18px;border-radius:999px;font-size:19px">${st.ds.n ? `${st.ds.n}-day streak` : 'Start a streak today'}${fr ? ' · 1 freeze this week' : ''}</div>`;
  } else {
    const lap = st.level > LAP ? Math.floor((st.level - 1) / LAP) : 0, first = lap * LAP + r * ROUNDS_PER_ROOM + 1;
    for (let i = 0; i < ROUNDS_PER_ROOM; i++) {
      const n = first + i, done = n < st.level, cur = n === st.level, s = st.stars[n] || 0, hard = levelDef(n).hard;
      el.rounds.appendChild($(`<div class="bb-round${done ? ' done' : ''}${cur ? ' cur' : ''}${hard ? ' hard' : ''}">${n}${done ? `<small>${'★'.repeat(s)}${'☆'.repeat(3 - s)}</small>` : ''}</div>`));
    }
  }
  refreshCardSel();
  el.play.classList.toggle('daily', dailyMode); el.start.classList.toggle('daily', dailyMode);
  el.play.innerHTML = dailyMode ? `Play the Daily<small>same balls for everyone today</small>` : encore ? `Play an Encore<small>${R.short} · for stamps & coins</small>` : `Play<small>${R.short} · Round ${def.round} of ${ROUNDS_PER_ROOM}</small>`;
  el.start.innerHTML = dailyMode ? 'Start the Daily' : encore ? 'Start Encore' : `Start Round ${def.round}`;
  const ic = new Set(def.shapes.flatMap(s => SHAPES[s].icon));
  el.pline.innerHTML = `<div class="bb-mini">${Array.from({ length: 25 }, (_, i) => `<i class="${ic.has(i) ? 'on' : ''}"></i>`).join('')}</div><span><b>${def.shapes.map(s => SHAPES[s].name).join(' or ')}</b>${def.balls} balls · ${def.hard && !encore ? 'a tricky one' : def.n && def.n <= 5 ? 'a gentle start' : 'take your time'}</span>`;
  el.starsP.querySelector('[data-n]').textContent = totalStars();
  const an = q('[data-album] .n'); an.textContent = `${albumCount()}/24`;
  const dn = q('[data-daily] .n'); dn.textContent = st.ds.last === dayNum() ? '✓' : st.ds.n ? `${st.ds.n}` : 'New';
  q('[data-daily] [data-t]').textContent = dailyMode ? 'Rooms' : 'Daily';
  q('[data-daily] img').src = ICON(dailyMode ? 'home' : 'calendar');
  requestAnimationFrame(layout);
}
q('[data-prev]').onclick = () => { if (st.sel > 0) { st.sel--; save(); snd.page(); refreshLobby(); layout(); } };
q('[data-next]').onclick = () => { if (st.sel < ROOMS.length - 1 && unlocked(st.sel + 1)) { st.sel++; save(); snd.page(); refreshLobby(); layout(); } };
el.play.onclick = () => { snd.tap(); openRoom(); };
el.start.onclick = () => { snd.tap(); roomSheet?.close(); startRound(); };
let roomSheet = null;
function openRoom() {
  if (mode !== 'lobby') return;
  roomSheet?.close(); refreshLobby();
  roomSheet = sheet('', () => { roomBox.remove(); roomSheet = null; });
  roomSheet.w.querySelector('.bb-sheet').appendChild(roomBox); roomSheet.w.querySelector('.bb-sheet').classList.add('room');
}
el.boost.onclick = () => { snd.tap(); st.boost = !st.boost; save(); refreshCardSel(); if (st.boost) toast('gift', 'Bluebell Boost on', `${BOOST_COST} coins: your power-up starts charged`); };
q('[data-album]').onclick = () => { snd.tap(); openAlbum(); };
q('[data-daily]').onclick = () => { snd.tap(); dailyMode = !dailyMode; refreshLobby(); if (dailyMode) openRoom(); };
q('[data-shop]').onclick = () => { snd.tap(); M.shop(); };
hud.querySelectorAll('[data-fair]').forEach(b => b.onclick = () => { snd.tap(); openFair(); });
el.fair.onclick = el.pat.onclick = () => { snd.tap(); openFair(); };

// ---------------------------------------------------------------- sheets
function sheet(html, onClose) {
  const w = $(`<div class="bb-wrap bb"><div class="bb-sheet" role="dialog" aria-modal="true"><button class="bb-btn bb-ic x" aria-label="Close"><img src="${ICON('close')}" alt=""></button>${html}</div></div>`);
  document.body.appendChild(w); if (Rd) Rd.paused = true;
  const close = () => { w.remove(); if (Rd && !document.querySelector('.bb-wrap')) Rd.paused = false; onClose && onClose(); removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); }; addEventListener('keydown', esc);
  w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
  w.querySelector('.x').onclick = () => { snd.tap(); close(); };
  setTimeout(() => w.querySelector('.x').focus(), 50);
  return { w, close };
}
function openSettings() {
  const rows = [
    ['auto', 'Auto-daub', 'called numbers are marked for you'],
    ['voice', 'Caller voice', 'every ball read out, calmly'],
    ['speed', 'Calling speed', `slow: a ball every ${SPEEDS.slow} s · normal: ${SPEEDS.normal} s`],
    ['big', 'Larger text', 'bigger numbers and words (roomiest with 1–2 cards)'],
    ['music', 'Garden music', 'a soft harp waltz'],
    ['sound', 'Sounds', 'daubs, chimes and the caller'],
  ];
  const sh = sheet(`<h2>Settings</h2><div class="sub">Make it comfortable</div><div class="rows"></div><p class="fine" style="margin-top:12px">Nothing here changes your odds. <button class="bb-btn" data-f style="background:none;text-decoration:underline;font:inherit;color:var(--navy)">Fair play and odds</button></p>`);
  const box = sh.w.querySelector('.rows');
  const val = k => k === 'auto' ? st.auto : k === 'voice' ? snd.voice : k === 'big' ? st.big : k === 'music' ? snd.music : k === 'sound' ? snd.sound : st.speed;
  const draw = () => {
    box.innerHTML = '';
    for (const [k, t, s] of rows) {
      const v = val(k), r = $(`<button class="bb-btn bb-set${v === true ? ' on' : ''}"><span>${t}<small>${s}</small></span>${k === 'speed' ? `<div class="bb-seg"><b class="${v === 'slow' ? 'on' : ''}">Slow</b><b class="${v === 'normal' ? 'on' : ''}">Normal</b></div>` : '<i class="bb-sw"></i>'}</button>`);
      r.setAttribute('role', k === 'speed' ? 'button' : 'switch'); if (k !== 'speed') r.setAttribute('aria-checked', String(!!v));
      r.onclick = () => {
        if (k === 'auto') { st.auto = !st.auto; if (st.auto && Rd) autoCatchUp(); }
        if (k === 'voice') { snd.setVoice(!snd.voice); refreshVoice(); }
        if (k === 'speed') { st.speed = st.speed === 'slow' ? 'normal' : 'slow'; refreshSpeed(); }
        if (k === 'big') { st.big = !st.big; document.documentElement.classList.toggle('big', st.big); }
        if (k === 'music') snd.setMusic(!snd.music);
        if (k === 'sound') snd.setSound(!snd.sound);
        save(); snd.tap(); draw(); layout();
      };
      box.appendChild(r);
    }
  };
  draw();
  sh.w.querySelector('[data-f]').onclick = () => { sh.close(); openFair(); };
}
function openAlbum(fresh = []) {
  const n = albumCount();
  const sh = sheet(`<h2>Stamp Album</h2><div class="sub">${n} of 24 stamps · each finished page pays ${PAY.album} coins</div><div class="bb-aprog"><i style="width:${n / 24 * 100}%"></i></div><div class="body"></div>
    <p class="fine">Stamps come from stamp squares on your cards, the Stamp Gift power-up and your first bingo in each round. A second copy turns into ${PAY.dupe} coins.</p>`);
  const body = sh.w.querySelector('.body');
  ROOMS.forEach((R, r) => {
    const have = roomStamps(r);
    body.appendChild($(`<div class="bb-room-h">${R.name}<small>${have}/3${have === 3 ? ' · complete' : ''}</small></div>`));
    const g = $('<div class="bb-album"></div>');
    for (const id of R.stamps) { const k = st.album[id] || 0; g.appendChild($(`<div class="bb-stamp${k ? '' : ' miss'}${fresh.includes(id) ? ' new' : ''}"><img src="${STAMP(id)}" alt="">${k > 1 ? `<span class="ct">×${k}</span>` : ''}<span>${k ? STAMP_NAMES[id] : (unlocked(r) ? 'Not yet' : 'Locked')}</span></div>`)); }
    body.appendChild(g);
  });
}
function openFair() {
  const def = mode === 'play' && Rd ? Rd.def : lobbyDef(), balls = Math.min(75, mode === 'play' && Rd ? Rd.budget : def.balls);
  const odds = oddsTable(def.shapes, balls, 1000), tot = POWERS.reduce((a, p) => a + p.w, 0);
  sheet(`<h2>Fair play</h2><div class="sub">Bluebell Bingo is a game, played for fun only</div>
    <p><b>No real money, ever.</b> Coins are free play tokens. They can't be cashed out, sent to anyone or won as prizes. You can buy extra coins in the shop, but nothing you buy changes how the balls fall.</p>
    <p><b>Every ball is fair.</b> Each round shuffles all 75 balls with your device's secure random generator (the same one used for passwords). Your cards, power-ups and prize squares come from it too. The odds never change with your coins, purchases or how you've been doing, and every player gets the same rules. The daily round uses one shared shuffle, so everybody plays the same balls that day.</p>
    <p><b>This round:</b> ${def.shapes.map(s => SHAPES[s].name).join(' or ')}, ${balls} balls. Chance of at least one bingo, before any power-ups:</p>
    <table>${odds.map((p, i) => `<tr><td>${i + 1} card${i ? 's' : ''}</td><td>${Math.round(p * 100)}%</td></tr>`).join('')}</table>
    <p class="fine">Worked out just now by playing these exact rules 1,000 times on your device. Power-ups raise every number. The first card is always free (two in rounds 1–5 and the daily); extra cards cost ${CARD_COST} coins each.</p>
    <p><b>Power-ups</b> charge after ${POWER_DAUBS} daubs. Each one is drawn from this table:</p>
    <table>${POWERS.map(p => `<tr><td><img src="${ICON(p.icon)}" alt="">${p.name} <span class="fine">· ${p.line}</span></td><td>${Math.round(p.w / tot * 100)}%</td></tr>`).join('')}</table>
    <p class="fine">Every card also starts with 2 coin purses and 1 stamp square on random squares. Your first bingo in a round gives a stamp from that room, each one equally likely.</p>`);
}

// ---------------------------------------------------------------- the round
function buildCardEl(ci, card, dab) {
  const c = $(`<div class="bb-card" style="--ink-on:${DAB_INK[dab]}"><div class="bb-head">${'BINGO'.split('').map((l, i) => `<span style="background-image:url(${BALLIMG(BALL[i])})">${l}</span>`).join('')}</div><div class="bb-grid"></div></div>`);
  const g = c.querySelector('.bb-grid');
  card.nums.forEach((n, i) => {
    const cell = $(`<div class="bb-cell${i === 12 ? ' free on' : ''}" role="button" aria-label="${i === 12 ? 'free square' : LETTER(n) + ' ' + n}"><span class="dab" style="background-image:url(${A('bingo/dab-' + dab)})"></span><b>${n || ''}</b></div>`);
    cell.addEventListener('pointerdown', e => { e.preventDefault(); tapCell(ci, i); });
    g.appendChild(cell);
  });
  card.el = c; card.cells = [...g.children];
  return c;
}
function placePrize(card, i, kind) {
  card.prizes[i] = kind;
  const cell = card.cells[i]; cell.querySelector('.pz')?.remove();
  const pz = $(`<span class="pz ${kind}"></span>`); if (kind === 'stamp') pz.style.backgroundImage = `url(${STAMP(ROOMS[Rd.def.room].stamps[0])})`;
  cell.appendChild(pz);
}
const freeCells = card => { const a = []; for (let i = 0; i < 25; i++) if (!card.daub[i] && !card.prizes[i]) a.push(i); return a; };

function startRound() {
  if (busy || mode !== 'lobby' || !loaded) return;
  const def = lobbyDef(), want = def.daily ? 2 : st.cards, cost = cardCost(want, def);
  let cards = want;
  if (cost > 0 && !M.spend(cost, 'cards')) { cards = freeCards(def); toast('coins', `Playing ${cards} free card${cards > 1 ? 's' : ''}`, 'not enough coins for more'); }
  let boosted = false;
  if (st.boost) { if (M.spend(BOOST_COST, 'boost')) boosted = true; else { st.boost = false; save(); toast('coins', 'Boost skipped', 'not enough coins this time'); } }
  busy = true; snd.unlock(); snd.play(true);
  const rng = def.daily ? seededRng(ymd() * 7 + 11) : fairRng();
  Rd = { def, rng, cards: [], bag: makeBag(rng), idx: 0, budget: def.balls, called: new Set([0]), list: [], meter: boosted ? POWER_DAUBS : 0, double: false, pick: false,
    bingos: 0, coins: 0, stamps: [], t0: performance.now(), next: 2.2, over: false, extra: false, firstBingoBall: 0, paused: false, endAt: 0, room: def.room };
  for (let i = 0; i < cards; i++) Rd.cards.push(makeCard(rng));
  el.cards.innerHTML = '';
  const dab = ROOMS[def.room].dab;
  Rd.cards.forEach((c, i) => {
    el.cards.appendChild(buildCardEl(i, c, dab));
    const fc = shuffle(freeCells(c), rng);
    placePrize(c, fc[0], 'coin'); placePrize(c, fc[1], 'coin'); placePrize(c, fc[2], 'stamp');
  });
  el.recent.innerHTML = ''; el.callline.innerHTML = '&nbsp;';
  el.bigball.innerHTML = '<div class="wait">Eyes<br>down…</div>';
  const icon = new Set(def.shapes.flatMap(s => SHAPES[s].icon));
  el.pat.querySelector('.bb-mini').innerHTML = Array.from({ length: 25 }, (_, i) => `<i class="${icon.has(i) ? 'on' : ''}"></i>`).join('');
  el.pat.querySelector('small').textContent = def.shapes.length > 1 ? def.shapes.map(s => SHAPES[s].name.split(' ').pop()).join(' or ') : SHAPES[def.shapes[0]].name;
  el.bingo.className = 'bb-btn bb-rose off'; el.bingo.innerHTML = 'Bingo!';
  setBg(ROOMS[def.room].bg);
  updatePower(); updateBalls();
  setMode('play'); state = 'play'; busy = false;
  B.start(); M.level(def.n || st.level);
  el.callline.innerHTML = `${def.hard && !def.encore ? 'A tricky one · ' : ''}<i>${def.shapes.map(s => SHAPES[s].name).join(' or ')}</i>`;
  snd.say(def.daily ? 'Welcome to the daily game. Eyes down.' : 'Eyes down, and good luck.');
  if (!st.tipped) { st.tipped = 1; save(); setTimeout(() => toast('hint', st.auto ? 'Numbers daub themselves' : 'Tap the numbers that are called', 'tap Bingo! when a line glows rose'), 900); }
  if (boosted) setTimeout(() => toast('gift', 'Bluebell Boost', 'your power-up is ready: tap it'), 1400);
}
const interval = () => BOT ? 0.42 : SPEEDS[st.speed];
el.home.onclick = () => {
  if (mode !== 'play' || !Rd || Rd.over) return; snd.tap();
  const sh = sheet(`<h2>Back to the map?</h2><div class="sub">You keep the coins and stamps you've won so far.</div><div class="act"><button class="bb-btn bb-ivory" data-stay>Keep playing</button><button class="bb-btn bb-navy" data-leave>Leave round</button></div>`);
  sh.w.querySelector('[data-stay]').onclick = () => sh.close();
  sh.w.querySelector('[data-leave]').onclick = () => { sh.close(); if (Rd) { Rd.budget = Rd.idx; Rd.left = true; finishRound(); } };
};

// ---- calling balls
function updateBalls() { const left = Math.max(0, Rd.budget - Rd.idx); el.left.innerHTML = `<b>${left}</b> ball${left === 1 ? '' : 's'} left`; el.left.classList.toggle('low', left <= 5 && left > 0); }
function callBall() {
  const n = Rd.bag[Rd.idx++]; Rd.called.add(n); Rd.list.push(n);
  updateBalls(); snd.call();
  // the old big ball drops into the recent row, the new one rolls in
  const old = el.bigball.querySelector('.ball');
  if (old) { const on = +old.dataset.n; el.recent.prepend($(`<span style="background-image:url(${BALLIMG(ballOf(on))})">${on}</span>`)); while (el.recent.children.length > (isWide() ? 4 : 3)) el.recent.lastChild.remove(); }
  el.bigball.innerHTML = `<div class="ball in" data-n="${n}" style="background-image:url(${BALLIMG(ballOf(n))})"><small>${LETTER(n)}</small><b>${n}</b></div>`;
  const nick = CALLS[n] && !BOT && Math.random() < 0.6 ? CALLS[n] : '';
  el.callline.innerHTML = `${LETTER(n)} ${n}${nick ? ` · <i>${nick}</i>` : ''}`;
  snd.say(nick ? `${nick}. ${n}.` : `${LETTER(n)}. ${n}.`);
  // mark the called squares: auto-daub, or a soft gold glow to tap
  Rd.cards.forEach((c, ci) => { const i = c.nums.indexOf(n); if (i < 0) return; c.cells[i].classList.add('called'); if (st.auto) setTimeout(() => { if (Rd && !c.daub[i] && Rd.called.has(n)) daub(ci, i, 'call'); }, BOT ? 120 : 900); });
  if (Rd.idx === Rd.budget) setTimeout(() => { if (Rd && !Rd.over && Rd.idx === Rd.budget) toast('star', 'Last ball of the round', st.auto ? 'any bingo left is claimed for you' : 'daub what you can'); }, 1200);
}
function autoCatchUp() { Rd.cards.forEach((c, ci) => c.nums.forEach((n, i) => { if (!c.daub[i] && Rd.called.has(n)) daub(ci, i, 'call'); })); }

// ---- daubing
function tapCell(ci, i) {
  if (state !== 'play' || !Rd || Rd.over) return;
  const card = Rd.cards[ci]; if (card.daub[i]) return;
  if (Rd.pick) { Rd.pick = false; el.cards.querySelectorAll('.bb-card').forEach(c => c.classList.remove('pick')); document.getElementById('bb-banner')?.remove(); daub(ci, i, 'magic'); return; }
  if (!Rd.called.has(card.nums[i])) { const c = card.cells[i]; c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); snd.nope(); return; }
  daub(ci, i, 'call');
}
let combo = 0, lastDaub = 0;
function daub(ci, i, how) {
  const card = Rd.cards[ci], cell = card.cells[i];
  card.daub[i] = true; cell.classList.add('on'); cell.classList.remove('called');
  combo = performance.now() - lastDaub < 1200 ? combo + 1 : 0; lastDaub = performance.now();
  snd.daub(combo); buzz(6);
  if (how === 'magic') { const r = cell.getBoundingClientRect(); petalBurst(r.left + r.width / 2, r.top + r.height / 2, 10, 0.4); }
  if (how === 'call' && Rd.meter < POWER_DAUBS) { Rd.meter++; updatePower(); if (Rd.meter === POWER_DAUBS) snd.ready(); }
  const pz = card.prizes[i];
  if (pz) {
    delete card.prizes[i]; cell.querySelector('.pz')?.remove();
    if (pz === 'coin') { Rd.coins += PAY.purse; M.add(PAY.purse, 'purse'); flyCoins(cell, 3); }
    else giveStamp(cell);
  }
  checkReady();
}
function checkReady() {
  let any = false;
  Rd.cards.forEach(c => {
    const ready = readyMasks(c, Rd.def.shapes).length > 0; c.el.classList.toggle('ready', ready); if (ready) any = true;
    const cl = closeness(c, Rd.def.shapes); let bd = c.el.querySelector('.bb-badge');
    if (!ready && cl.need === 1 && c.bingos < MAX_BINGOS) { if (!bd) c.el.appendChild($('<div class="bb-badge">1 to go</div>')); } else bd?.remove();
  });
  const was = el.bingo.classList.contains('on');
  el.bingo.classList.toggle('on', any); el.bingo.classList.toggle('off', !any);
  if (any && !was) snd.ready();
}
function giveStamp(fromEl) {
  const R = ROOMS[Rd.room], id = R.stamps[pick(Rd.rng, R.stamps.length)], had = st.album[id] || 0;
  st.album[id] = had + 1; Rd.stamps.push(id); save(); snd.stamp();
  if (had) { M.add(PAY.dupe, 'stamp-dupe'); Rd.coins += PAY.dupe; toast(STAMP(id), `${STAMP_NAMES[id]} again`, `a spare stamp: +${PAY.dupe} coins`); if (fromEl) flyCoins(fromEl, 3); }
  else {
    const n = roomStamps(Rd.room); toast(STAMP(id), `New stamp: ${STAMP_NAMES[id]}`, `${R.name} page ${n}/3`);
    if (n === 3) setTimeout(() => { M.add(PAY.album, 'album'); if (Rd) Rd.coins += PAY.album; toast('album', `${R.name} page complete`, `+${PAY.album} coins`); snd.win(); }, 1800);
  }
}

// ---- bingo claims
el.bingo.onclick = () => claim(false);
function claim(auto) {
  if (!Rd || (state !== 'play' && !auto)) return 0;
  let got = 0;
  Rd.cards.forEach(c => {
    for (const m of readyMasks(c, Rd.def.shapes)) {
      c.claimed.push(m.key); c.bingos++; Rd.bingos++; got++;
      const pay = (Rd.bingos === 1 ? PAY.first : PAY.more) * (Rd.double ? 2 : 1);
      if (Rd.double) { Rd.double = false; el.bingo.querySelector('.x2')?.remove(); }
      Rd.coins += pay; M.add(pay, 'bingo');
      m.mask.forEach((i, k) => setTimeout(() => c.cells[i].classList.add('won'), k * 60));
      setTimeout(() => flyCoins(c.el, 6), 400);
      if (!Rd.firstBingoBall) Rd.firstBingoBall = Rd.idx;
      if (Rd.bingos === 1) setTimeout(() => Rd && giveStamp(c.el), 1100);
      if (c.bingos >= MAX_BINGOS) { c.el.appendChild($(`<div class="bb-full"><b>${MAX_BINGOS} bingos!</b></div>`)); c.el.querySelector('.bb-badge')?.remove(); }
    }
  });
  if (!got) { if (!auto) { snd.nope(); toast('hint', 'Not quite yet', `complete the ${Rd.def.shapes.map(s => SHAPES[s].name.toLowerCase()).join(' or ')} first`); } return 0; }
  st.bingos += got; save();
  if (!auto) {
    bigText(got > 1 ? `Bingo ×${got}` : 'Bingo!'); snd.bingo(); buzz([20, 50, 30]);
    petalBurst(innerWidth / 2, innerHeight * 0.44, 60, 1);
    snd.say(['Bingo! Well done.', 'Bingo! Lovely.', 'House! Well played.'][Math.floor(Math.random() * 3)]);
  }
  checkReady();
  if (Rd.cards.every(c => c.bingos >= MAX_BINGOS)) { Rd.budget = Rd.idx; updateBalls(); setTimeout(finishRound, 1800); }
  return got;
}

// ---- power-ups
function updatePower() {
  const full = Rd && Rd.meter >= POWER_DAUBS;
  el.power.style.setProperty('--p', Rd ? Rd.meter / POWER_DAUBS * 100 : 0); el.power.classList.toggle('full', !!full);
  el.power.querySelector('small').textContent = full ? 'Tap me' : `${Rd ? Rd.meter : 0}/${POWER_DAUBS}`;
}
el.power.onclick = () => usePower();
function usePower() {
  if (!Rd || state !== 'play' || Rd.over) return;
  if (Rd.meter < POWER_DAUBS) { snd.nope(); toast('gift', 'Your power-up is filling', `${POWER_DAUBS - Rd.meter} more daub${POWER_DAUBS - Rd.meter > 1 ? 's' : ''} to go`); return; }
  Rd.meter = 0; updatePower();
  const p = pickPower(Rd.rng); snd.power(); buzz(12);
  document.getElementById('bb-reveal')?.remove();
  const rv = $(`<div id="bb-reveal" class="bb bb-ivory"><img src="${ICON(p.icon)}" alt=""><b>${p.name}</b><small>${p.line}</small></div>`); document.body.appendChild(rv); setTimeout(() => rv.remove(), 1950);
  const live = Rd.cards.map((c, i) => i).filter(i => Rd.cards[i].bingos < MAX_BINGOS), card = () => live.length ? live[pick(Rd.rng, live.length)] : 0;
  if (p.id === 'daub') {
    const ci = card(), c = Rd.cards[ci], fc = []; for (let i = 0; i < 25; i++) if (!c.daub[i]) fc.push(i);
    if (fc.length) setTimeout(() => Rd && !Rd.over && daub(ci, fc[pick(Rd.rng, fc.length)], 'magic'), 900);
  } else if (p.id === 'pick') {
    Rd.pick = true; el.cards.querySelectorAll('.bb-card').forEach(c => c.classList.add('pick'));
    const bn = $('<div id="bb-banner" class="bb">Tap any square to daub it</div>'); bn.style.top = Math.max(70, el.cards.querySelector('.bb-card').getBoundingClientRect().top - 30) + 'px'; document.body.appendChild(bn);
  } else if (p.id === 'coins' || p.id === 'stamp') {
    const spots = []; Rd.cards.forEach((c, ci) => freeCells(c).forEach(i => spots.push([ci, i]))); shuffle(spots, Rd.rng);
    spots.slice(0, p.id === 'coins' ? 3 : 1).forEach(([ci, i], k) => setTimeout(() => { if (!Rd || Rd.over) return; placePrize(Rd.cards[ci], i, p.id === 'coins' ? 'coin' : 'stamp'); }, 700 + k * 200));
  } else if (p.id === 'balls') { Rd.budget += 3; updateBalls(); bump(el.left); }
  else if (p.id === 'double') { Rd.double = true; if (!el.bingo.querySelector('.x2')) el.bingo.appendChild($('<span class="x2">×2</span>')); }
}

// ---- end of round
async function finishRound() {
  if (!Rd || Rd.over) return; Rd.over = true;
  if (Rd.pick) { Rd.pick = false; document.getElementById('bb-banner')?.remove(); }
  await wait(500);
  const auto = claim(true);
  if (auto) { toast('check', `We found ${auto} bingo${auto > 1 ? 's' : ''} for you`, 'nicely done'); await wait(1000); }
  const won = Rd.bingos > 0, def = Rd.def, ms = performance.now() - Rd.t0;
  const best = Math.max(...Rd.cards.map(c => closeness(c, def.shapes).f));
  if (!Rd.recorded) { Rd.recorded = true; if (!def.daily) F.level(won, won ? 1 : best); B.submit(Rd.bingos, { ms }); }
  if (won) {
    state = 'won'; st.wins++;
    const stars = Math.min(3, Rd.bingos);
    let unlockedRoom = null;
    if (def.daily) dailyWon();
    else if (!def.encore) {
      st.stars[def.n] = Math.max(st.stars[def.n] || 0, stars);
      const prev = progRoom(); st.level++;
      if (def.round === ROUNDS_PER_ROOM) { M.add(PAY.room, 'room'); Rd.coins += PAY.room; if (progRoom() !== prev) { unlockedRoom = progRoom(); st.sel = unlockedRoom; } }
    }
    save(); pendingUnlock = unlockedRoom;
    snd.win(); showResult(true, stars);
  } else { state = 'lost'; snd.lose(); showResult(false, 0, best); }
}
function dailyWon() {
  const d = dayNum(), ds = st.ds;
  if (ds.last === d) return;
  if (ds.last === d - 1) ds.n++;
  else if (ds.last === d - 2 && ds.fw !== weekNum()) { ds.n++; ds.fw = weekNum(); toast('streak', 'Streak freeze used', 'one free freeze each week'); }
  else ds.n = 1;
  ds.last = d; save();
}
function shareGrid() {
  const c = Rd.cards.reduce((a, b) => (b.bingos > a.bingos ? b : a), Rd.cards[0]);
  const rows = []; for (let r = 0; r < 5; r++) rows.push(c.daub.slice(r * 5, r * 5 + 5).map((d, i) => r * 5 + i === 12 ? '🌼' : d ? '🟦' : '⬜').join(''));
  const u = new URL(location.href); u.search = '?daily=1';
  return `Bluebell Bingo daily · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\nBingo on ball ${Rd.firstBingoBall} of ${Rd.budget} · ${st.ds.n}-day streak\n${rows.join('\n')}\n${u.href}`;
}
function showResult(won, stars, best = 0) {
  const card = won ? ui.els.win : ui.els.lose, panel = card.querySelector('.bb-rpanel');
  panel.querySelector('.bb-res-body')?.remove();
  const def = Rd.def, R = ROOMS[Rd.room];
  const label = def.daily ? 'DAILY BINGO' : `${R.short.toUpperCase()} · ${def.encore ? 'ENCORE' : 'ROUND ' + def.round}`;
  panel.querySelector('p').innerHTML = label + '<span data-l hidden></span>';
  if (won) panel.querySelector('h1').textContent = Rd.bingos >= 3 ? 'Splendid!' : 'Bingo!';
  const lt = Rd.left ? 'Round left' : best >= 0.75 ? 'So close!' : 'No bingo this time';
  const body = $(`<div class="bb-res-body" style="display:contents">
    ${won ? `<div class="bb-stars3">${[0, 1, 2].map(() => `<img src="${A('kit/star-empty')}" alt="">`).join('')}</div>` : ''}
    <div class="bb-stats"><div><b>${Rd.bingos}</b><small>BINGOS</small></div><div><b><img src="${A('kit/coin')}" alt="">${Rd.coins}</b><small>COINS</small></div><div><b>${Rd.idx}</b><small>BALLS</small></div></div>
    ${Rd.stamps.length ? `<div class="bb-got">${Rd.stamps.slice(0, 4).map((id, k) => `<img src="${STAMP(id)}" alt="${STAMP_NAMES[id]}" style="animation-delay:${0.9 + k * 0.2}s">`).join('')}</div>` : ''}
    ${!won ? `<div class="bb-line">${Rd.left ? 'Your coins and stamps are safe.' : best >= 0.75 ? 'One more square would have done it. The next shuffle is a fresh start.' : 'The balls ran out. Every shuffle is a fresh start.'}</div>` : ''}
    ${won && pendingUnlock !== null ? `<div class="bb-line">A new garden opens: <b>${ROOMS[pendingUnlock].name}</b> · +${PAY.room} coins</div>` : ''}
  </div>`);
  const btns = [];
  if (won && Rd.coins > 0 && !def.daily) btns.push($(`<button class="bb-btn bb-navy bb-rbtn"><img src="${ICON('video')}" alt="">Double my coins (+${Rd.coins})</button>`));
  if (!won && !Rd.extra && !Rd.left) btns.push($(`<button class="bb-btn bb-navy bb-rbtn"><img src="${ICON('video')}" alt="">5 more balls, keep playing</button>`));
  if (def.daily && won) btns.push($(`<button class="bb-btn bb-rose bb-rbtn"><img src="${ICON('share')}" alt="">Share my card</button>`));
  btns.forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); body.appendChild(b); });
  if (!won && btns[0]) { btns[0].style.visibility = 'hidden'; setTimeout(() => { btns[0].style.visibility = ''; }, 1900); }   // no offer within 1.2 s of losing
  if (won && Rd.coins > 0 && !def.daily) btns[0].onclick = async e => { e.stopPropagation(); const amt = Rd.coins; if (await M.rewarded('double', { what: `${amt} more coins from this round` })) { M.add(amt, 'double'); Rd.coins += amt; btns[0].remove(); body.querySelector('.bb-stats div:nth-child(2) b').innerHTML = `<img src="${A('kit/coin')}" alt="">${Rd.coins}`; flyCoins(panel, 8); } };
  if (!won && !Rd.extra && !Rd.left) btns[0].onclick = async e => { e.stopPropagation(); if (await M.rewarded('moves', { title: '5 more balls', what: '5 more balls to finish this round' })) continueRound(); };
  if (def.daily && won) btns[btns.length - 1].onclick = async e => { e.stopPropagation(); const text = shareGrid(); try { if (navigator.share) { await navigator.share({ title: NAME, text }); return; } } catch (er) { return; } try { await navigator.clipboard.writeText(text); toast('share', 'Copied', 'paste it to a friend'); } catch (er) {} };
  panel.querySelector('h1').after(body);
  card.querySelector('.hint').textContent = won ? 'Tap to carry on' : 'Tap to go back';
  if (won) {
    D.won(Rd.bingos, 'got bingos ×'); ui.win(st.level - 1);
    body.querySelectorAll('.bb-stars3 img').forEach((s, k) => setTimeout(() => { if (k < stars) { s.src = A('kit/star-full'); s.classList.add('pop'); snd.star(k); } }, 1000 + k * 300));
    setTimeout(() => petalRain(70), 700);
  } else ui.lose(lt, '');
}
function continueRound() {
  ui.els.lose.classList.add('hc-hidden');
  Rd.extra = true; Rd.over = false; Rd.budget += 5; Rd.next = 1.2; Rd.endAt = 0; state = 'play'; updateBalls();
  toast('plus', 'Five more balls', 'eyes down');
}
ui.onTap(async which => {
  if (which === 'start') { snd.unlock(); snd.play(true); if (loaded) enterLobby(); else pendingStart = true; return; }
  const lvl = Rd ? (Rd.def.n || st.level) : st.level;
  Rd = null; state = 'ready'; el.cards.innerHTML = '';
  if (pendingUnlock === null && dailyMode && st.ds.last === dayNum() && !D.seed) dailyMode = false;
  enterLobby();
  await wait(400);
  if (which === 'win' || which === 'lose') await M.breakAd('level-end', { level: lvl });
  if (pendingUnlock !== null) { const r = pendingUnlock; pendingUnlock = null; toast(A('bg/' + ROOMS[r].bg + '-s'), `Welcome to ${ROOMS[r].name}`, 'a new garden on your map'); petalRain(80); snd.win(); }
});
addEventListener('ap:ad', e => { if (e.detail.phase === 'start') { snd.play(false); snd.hush(); if (Rd) Rd.paused = true; } else { snd.play(true); if (Rd && !document.querySelector('.bb-wrap')) Rd.paused = false; } });
function enterLobby() {
  setMode('lobby'); state = 'ready';
  if (dailyMode && st.ds.last === dayNum() && !D.seed) dailyMode = false;
  refreshLobby();
  if (st.gift !== dayNum()) { st.gift = dayNum(); save(); setTimeout(() => { M.add(100, 'daily-gift'); toast('gift', 'Your daily gift: +100 coins', 'come back tomorrow for another'); flyCoins(el.play, 5); }, 900); }
  if (!st.welcomed) { st.welcomed = 1; save(); setTimeout(() => { M.add(200, 'welcome'); toast('coins', 'Welcome! +200 free coins', 'for extra cards and boosts, just for fun'); }, 3600); }
}

// ---------------------------------------------------------------- boot + loop
async function boot() {
  setBg(dailyMode ? ROOMS[DAILY(ymd()).room].bg : 'bluebell-bingo');
  const pre = ['kit/coin', 'kit/star-full', 'kit/star-empty', ...BALL.map(c => 'bingo/ball-' + c), 'bingo/dab-navy', 'bingo/dab-rose', 'bingo/dab-sage', 'bingo/bluebell-posy', 'kit/cartouche', 'kit/garland'];
  await Promise.race([Promise.all(pre.map(p => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = A(p); }))), wait(2500)]);
  try { await Promise.race([document.fonts.load('700 30px "Libre Baskerville"'), wait(1200)]); } catch (e) {}
  const l = document.getElementById('bb-load'); l.style.opacity = 0; setTimeout(() => l.remove(), 650);
  loaded = true;
  if (pendingStart) enterLobby();
}
let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === 'play' && Rd && !Rd.over && !Rd.paused && state === 'play' && document.visibilityState !== 'hidden') {
    Rd.next -= dt;
    if (Rd.next <= 0) {
      if (Rd.idx < Rd.budget && Rd.idx < 75) { callBall(); Rd.next = interval(); }
      else if (!Rd.endAt) Rd.endAt = now + (BOT ? 1500 : st.auto ? 3200 : 6000);
    }
    if (Rd.endAt && Rd.idx < Rd.budget) Rd.endAt = 0;   // +3 balls landed
    if (Rd.endAt && now > Rd.endAt) { Rd.endAt = 0; finishRound(); }
  }
  if (P.length || petals.dataset.dirty) { tickPetals(dt); petals.dataset.dirty = P.length ? '1' : ''; }
}
requestAnimationFrame(frame);
setMode('title');
boot().catch(e => console.error(e));
ui.start();

// ---------------------------------------------------------------- test hooks
window.__bbqa = { st, save, startRound, openAlbum, openFair, openSettings, refreshLobby, finishRound, get Rd() { return Rd; } };
window.__game = {
  get state() { return state; },
  get level() { return st.level; },
  get score() { return Rd ? Rd.bingos : st.bingos; },
  bot() {
    if (document.querySelector('.bb-wrap')) { document.querySelector('.bb-wrap .x')?.click(); return; }
    if (mode === 'lobby' && state === 'ready' && !busy && loaded) { startRound(); return; }
    if (!Rd || state !== 'play' || Rd.over) return;
    if (Rd.pick) { let bc = 0, bi = -1, bn = 99; Rd.cards.forEach((c, ci) => { const cl = closeness(c, Rd.def.shapes); if (cl.cells && cl.need < bn) { const i = cl.cells.find(i => !c.daub[i]); if (i !== undefined) { bn = cl.need; bc = ci; bi = i; } } }); if (bi >= 0) tapCell(bc, bi); return; }
    if (el.bingo.classList.contains('on')) { claim(false); return; }
    if (Rd.meter >= POWER_DAUBS) { usePower(); return; }
    let n = 0; Rd.cards.forEach((c, ci) => { for (let i = 0; i < 25 && n < 2; i++) if (!c.daub[i] && Rd.called.has(c.nums[i])) { tapCell(ci, i); n++; } });
  },
};
