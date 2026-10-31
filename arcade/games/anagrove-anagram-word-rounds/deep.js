// Anagrove v2 — 30 hand-picked rounds in 3 groves (levels.js), goals, stars, tricks (wilted tile, thorns, wind, fog, gold word),
// word chains + bloom time, a grove map with a tree for every round and seed chests that unlock tile looks. Rules live in
// engine.js (node-testable). Plan: DESIGN.md. Our own code, MIT.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { LEVELS, WORLDS } from './levels.js';
import { buildRound, seededBase, goalProgress, goalText, starsOf, wordPts, counts, fits, ALL } from './engine.js';

const NAME = 'Anagrove: Anagram Word Rounds';
const S = store('anagrove');
const F = flow('anagrove');
const ui = createUI({ title: 'Anagrove', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#e0a63c' });
const D = daily('anagrove', ui, { name: NAME });
const B = board({ game: 'anagrove', label: 'Words found', limits: { maxRun: 40, maxPerSec: 1 }, mode: 'sum' });
const fx = fx2d(11);
const Q = new URLSearchParams(location.search);
const doneToday = S.get('daily_' + todayKey(), null);
const N = LEVELS.length;

// ---------------------------------------------------------------- meta: stars per round, seed chests, tile looks
const SKINS = [
  { id: 'honey', n: 'Honey', a: '#ffe9b8', b: '#f0c27a', c: '#d99f52', sh: '#9c6a2f', ink: '#4a2f14' },
  { id: 'mint', n: 'Mint', a: '#e6fff1', b: '#9fe0b4', c: '#5fae7c', sh: '#3b7d57', ink: '#10392a' },
  { id: 'sky', n: 'Sky', a: '#e4f4ff', b: '#9ccdf2', c: '#5b9bd0', sh: '#35688f', ink: '#10304a' },
  { id: 'berry', n: 'Berry', a: '#ffd9e8', b: '#ee7fae', c: '#c24d82', sh: '#8a2f5a', ink: '#4a0f2a' },
  { id: 'plum', n: 'Plum', a: '#eadcff', b: '#b295e8', c: '#7f60c0', sh: '#523a8c', ink: '#24134a' },
  { id: 'night', n: 'Night', a: '#6b7a99', b: '#3e4a68', c: '#2a3350', sh: '#161c30', ink: '#f0e6c8' },
  { id: 'rose', n: 'Rose gold', a: '#ffe3d6', b: '#f0a98e', c: '#d27c60', sh: '#965238', ink: '#4a2214' },
  { id: 'gold', n: 'Gold leaf', a: '#fff6c4', b: '#f6d34a', c: '#d6a516', sh: '#8a6a08', ink: '#4a3600' },
];
let stars = S.get('st', []);            // stars per authored round
let skinOwned = S.get('skins', ['honey']), skinOn = S.get('skin', 'honey'), chestsOpened = S.get('chests', 0);
const totalStars = () => stars.reduce((a, b) => a + (b || 0), 0);
const chestsReady = () => Math.floor(totalStars() / 6) - chestsOpened;
const unlocked = (i) => i === 0 || (stars[i - 1] || 0) > 0;
const firstOpen = () => { for (let i = 0; i < N; i++) if (!(stars[i] > 0)) return i; return N; };
function applySkin() {
  const k = SKINS.find(s => s.id === skinOn) || SKINS[0];
  document.body.style.setProperty('--t1', k.a); document.body.style.setProperty('--t2', k.b); document.body.style.setProperty('--t3', k.c);
  document.body.style.setProperty('--tb', k.sh); document.body.style.setProperty('--ti', k.ink);
}

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#f4efe2}
body{--t1:#ffe9b8;--t2:#f0c27a;--t3:#d99f52;--tb:#9c6a2f;--ti:#4a2f14;background:radial-gradient(130% 80% at 50% 0%,#2f7a63 0%,#1d5547 45%,#143d36 100%)}
body.bloom{background:radial-gradient(130% 80% at 50% 0%,#4aa57a 0%,#2a6b54 45%,#173f37 100%)}
#leaf{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#1d3b33;background:#f3c45e;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#f3c45e}.hc-top .hc-bar{background:rgba(255,255,255,.14);height:8px}.hc-top .hc-bar i{background:#f3c45e}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#bfe3cf;text-shadow:none;opacity:1}
.pill{position:fixed;z-index:6;height:30px;display:flex;align-items:center;gap:6px;border-radius:16px;font-weight:800;font-size:15px;padding:0 12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);color:#fff}
#pts{left:12px;top:calc(60px + env(safe-area-inset-top))}#clock{right:12px;top:calc(60px + env(safe-area-inset-top))}
#clock.hot{background:#d9534a;border-color:#d9534a;animation:tick 1s infinite}
@keyframes tick{50%{transform:scale(1.08)}}
#goal{position:fixed;z-index:6;left:50%;transform:translateX(-50%);top:calc(98px + env(safe-area-inset-top));display:flex;align-items:center;gap:8px;height:30px;padding:0 14px;border-radius:16px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.16);font-weight:800;font-size:12px;white-space:nowrap;max-width:96vw;padding:0 10px;gap:6px;overflow:hidden}
#goal .st{letter-spacing:1px;color:rgba(255,255,255,.3)}#goal .st b{color:#f3c45e;font-weight:800}
#goal.done{background:#2f8a52;border-color:#9fe0b4}
#goal.pulse{animation:gpulse .6s}
@keyframes gpulse{40%{transform:translateX(-50%) scale(1.18)}}
#chain{position:fixed;z-index:6;right:14px;top:calc(136px + env(safe-area-inset-top));font-weight:900;font-size:20px;color:#f3c45e;text-shadow:0 2px 8px rgba(0,0,0,.35);opacity:0;transition:opacity .2s}
#chain.on{opacity:1}#chain.bump{animation:gpulse2 .3s}
@keyframes gpulse2{40%{transform:scale(1.4)}}
#chain i{display:block;height:3px;border-radius:2px;background:#f3c45e;margin-top:2px;transform-origin:right}
#chain.bloom{color:#ff9bd0}#chain.bloom i{background:#ff9bd0}
#wall{position:fixed;z-index:2;left:0;right:0;pointer-events:none}
#wall .w{position:absolute;display:flex;gap:2px}
#wall .c{width:var(--cs);height:var(--cs);border-radius:5px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:calc(var(--cs) * .62);text-transform:uppercase;color:#1d3b33}
#wall .c.h{color:rgba(255,255,255,.3)}
#wall .w.got .c{background:#f6ecd2;border-color:#f6ecd2;box-shadow:0 2px 0 #cdb98a;animation:flip .45s cubic-bezier(.3,1.5,.5,1) both;color:#1d3b33}
#wall .w.six .c{background:#f3c45e;border-color:#f3c45e;box-shadow:0 2px 0 #c39432}
#wall .w.gold:not(.got) .c{border-color:#f3c45e;background:rgba(243,196,94,.22);box-shadow:0 0 8px rgba(243,196,94,.55);animation:gl 1.4s infinite}
#wall .w.gold.got .c{background:#ffd34a;border-color:#ffd34a;box-shadow:0 2px 0 #c39432,0 0 10px #ffd34a}
#wall .w.miss .c{background:rgba(255,255,255,.08);color:#ffb3a8;border-color:rgba(255,179,168,.35)}
#wall .w.flash .c{animation:glow .6s ease}
#wall.fog .w:not(.got):not(.miss) .c{opacity:0}
@keyframes gl{50%{box-shadow:0 0 14px rgba(243,196,94,.95)}}
@keyframes flip{0%{transform:scale(.3) rotate(-12deg)}100%{transform:scale(1)}}
@keyframes glow{40%{transform:scale(1.25);filter:brightness(1.2)}}
#mist{position:fixed;z-index:2;left:0;right:0;text-align:center;pointer-events:none;font-weight:800;color:rgba(255,255,255,.6);display:none;font-size:15px;line-height:1.9}
#mist b{font-size:32px;display:block;color:#fff;letter-spacing:1px}
#tray{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;gap:8px;pointer-events:none}
#tray .t{width:var(--ts);height:var(--ts);border-radius:12px;border:2px dashed rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:calc(var(--ts) * .56);color:#1d3b33;text-transform:uppercase}
#tray .t.on{border:0;background:#fff7e6;box-shadow:0 4px 0 #d7c39a,0 6px 14px rgba(0,0,0,.2);animation:drop .2s ease-out}
body.bloom #tray .t.on{background:#ffe3f1;box-shadow:0 4px 0 #e6a7c9,0 0 16px rgba(255,155,208,.7)}
#tray.bad{animation:shake .4s}#tray.good .t.on{background:#9fe0b4;box-shadow:0 4px 0 #5fae7c;transform:translateY(-6px)}#tray.old .t.on{background:#d9d4c6}#tray.bonus .t.on{background:#ffd98a}
@keyframes drop{0%{transform:translateY(40px) scale(.6)}100%{transform:none}}
@keyframes shake{20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
#tiles{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;gap:10px}
#tiles{touch-action:none}#tiles button{touch-action:none;width:var(--ls);height:var(--ls);border-radius:50%;border:0;padding:0;cursor:pointer;font-weight:800;font-size:calc(var(--ls) * .5);color:var(--ti);text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;
  background:radial-gradient(circle at 38% 30%,var(--t1),var(--t2) 55%,var(--t3));box-shadow:inset 0 -5px 0 rgba(0,0,0,.18),0 6px 0 var(--tb),0 10px 18px rgba(0,0,0,.3);transition:transform .15s,opacity .15s,filter .3s}
#tiles button:active{transform:translateY(3px)}
#tiles button.used{opacity:.14;transform:scale(.8);pointer-events:none}
#tiles button.spin{animation:spin .4s ease-out}
#tiles button.wilt{filter:grayscale(1) brightness(.7);transform:rotate(14deg) translateY(6px)}
#tiles button.wake{animation:wake .7s ease-out}
#tiles.sway button{animation:sway .35s infinite alternate}
#tiles button.hintt{animation:hintp .5s infinite alternate}
@keyframes hintp{to{transform:scale(1.18);filter:brightness(1.25)}}
@keyframes wake{0%{transform:scale(.6) rotate(-30deg)}60%{transform:scale(1.3)}100%{transform:none}}
@keyframes sway{to{transform:translateX(5px) rotate(6deg)}}
@keyframes spin{0%{transform:rotate(-200deg) scale(.5)}100%{transform:none}}
#ctl{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:10px}
#ctl button{height:52px;border:0;border-radius:26px;cursor:pointer;font:inherit;font-weight:800;font-size:17px;letter-spacing:.5px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 18px}
#ctl .round{width:46px;padding:0;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.2)}
#ctl .round svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ctl .go{background:#f6ecd2;color:#1d3b33;box-shadow:0 4px 0 #cdb98a;min-width:112px}
#ctl .next{background:#f3c45e;color:#3a2a08;box-shadow:0 4px 0 #c39432;animation:pulse 1.1s infinite}
#ctl .next.off{display:none}
#ctl button:active{transform:translateY(2px)}
@keyframes pulse{50%{transform:scale(1.06)}}
#toast{position:fixed;left:50%;z-index:9;transform:translateX(-50%);background:#f6ecd2;color:#1d3b33;font-weight:800;font-size:15px;padding:8px 16px;border-radius:12px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}
#toast.show{opacity:1}
body.shake{animation:bshake .3s}
@keyframes bshake{25%{transform:translate(-4px,2px)}50%{transform:translate(4px,-2px)}75%{transform:translate(-2px,1px)}}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(12,36,30,.72),rgba(10,28,24,.88))}
/* result card + grove map */
#res{position:fixed;inset:0;z-index:15;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,rgba(12,36,30,.78),rgba(10,28,24,.92));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);text-align:center;padding:20px}
#res.on{display:flex}
#res h1{font-family:ui-serif,'New York',Georgia,serif;font-size:clamp(36px,10vw,54px);margin:0;line-height:1}
#res .stars{font-size:54px;letter-spacing:6px;color:rgba(255,255,255,.2)}#res .stars b{color:#f3c45e;font-weight:400;display:inline-block;animation:starin .5s cubic-bezier(.3,1.8,.5,1) both}
@keyframes starin{0%{transform:scale(0) rotate(-90deg)}100%{transform:none}}
#res p{margin:0;font-weight:600;font-size:17px;opacity:.92}#res p.near{color:#f3c45e;font-weight:800;opacity:1}
#res .row{display:flex;gap:10px;margin-top:12px}
#res button,#map button.pri{white-space:nowrap;font:inherit;font-weight:800;font-size:18px;border:0;border-radius:26px;height:52px;padding:0 26px;cursor:pointer}
#res .pri,#map button.pri{background:#f3c45e;color:#3a2a08;box-shadow:0 4px 0 #c39432}#res .sec{background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25)}
#res .pri.pul{animation:pulse 1.1s infinite}
#res .tree{height:84px}
#map{position:fixed;inset:0;z-index:16;display:none;background:linear-gradient(180deg,#1d5547,#143d36);overflow-y:auto;-webkit-overflow-scrolling:touch}
#map.on{display:block}
#map .bar{position:sticky;top:0;z-index:2;background:rgba(16,48,41,.94);padding:calc(10px + env(safe-area-inset-top)) 14px 10px;display:flex;flex-direction:column;gap:8px}
#map .top{padding-left:54px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:18px}
#map .x{font:inherit;width:38px;height:38px;border-radius:19px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);color:#fff;font-size:18px;cursor:pointer}
#map .chest{display:flex;align-items:center;gap:10px;font-weight:700;font-size:13px}
#map .cb{flex:1;height:9px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden}#map .cb i{display:block;height:100%;background:#f3c45e}
#map .opench{font:inherit;font-weight:800;border:0;border-radius:16px;background:#f3c45e;color:#3a2a08;height:32px;padding:0 14px;animation:pulse 1s infinite;cursor:pointer}
#map .skins{display:flex;gap:8px;flex-wrap:wrap}
#map .sk{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}#map .sk.on{border-color:#fff;transform:scale(1.15)}#map .sk.lock{opacity:.25;cursor:default}
#map .wh{padding:18px 16px 6px;font-weight:800;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#bfe3cf}
#map .wh span{display:block;font-weight:600;letter-spacing:.5px;text-transform:none;opacity:.7;font-size:13px}
#map .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:8px 14px 8px}
#map .nd{aspect-ratio:1/1.15;border-radius:14px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.14);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:4px 2px 3px;font-weight:800;font-size:12px;cursor:pointer;color:#fff;font-family:inherit}
#map .nd svg{width:70%;height:auto}#map .nd.lock{opacity:.4;cursor:default}#map .nd.hard{border-color:#e0675a}
#map .nd.next{border-color:#f3c45e;background:rgba(243,196,94,.2);animation:pulse 1.2s infinite}
#map .nd .s{font-size:9px;letter-spacing:1px;color:#f3c45e;height:11px}
#map .end{padding:14px;text-align:center;opacity:.8;font-weight:700}
`);
const leaf = document.createElement('canvas'); leaf.id = 'leaf'; document.body.prepend(leaf);
const wall = document.createElement('div'); wall.id = 'wall'; document.body.appendChild(wall);
const mist = document.createElement('div'); mist.id = 'mist'; document.body.appendChild(mist);
const tray = document.createElement('div'); tray.id = 'tray'; document.body.appendChild(tray);
const tilesEl = document.createElement('div'); tilesEl.id = 'tiles'; document.body.appendChild(tilesEl);
const ctl = document.createElement('div'); ctl.id = 'ctl'; document.body.appendChild(ctl);
const clockEl = document.createElement('div'); clockEl.className = 'pill'; clockEl.id = 'clock'; document.body.appendChild(clockEl);
const ptsEl = document.createElement('div'); ptsEl.className = 'pill'; ptsEl.id = 'pts'; document.body.appendChild(ptsEl);
const goalEl = document.createElement('div'); goalEl.id = 'goal'; document.body.appendChild(goalEl);
const chainEl = document.createElement('div'); chainEl.id = 'chain'; document.body.appendChild(chainEl);
const toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast);
const res = document.createElement('div'); res.id = 'res'; document.body.appendChild(res);
const mapEl = document.createElement('div'); mapEl.id = 'map'; document.body.appendChild(mapEl);
for (const e of [res, mapEl]) e.addEventListener('pointerdown', ev => ev.stopPropagation());
let toastT = 0;
function say(t, ms = 1300) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), ms); }
const mk = (cls, html, fn) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = html; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); ctl.appendChild(b); return b; };
const shuffleBtn = mk('round', '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>', () => shuffle());
const backBtn = mk('round', '<svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6"/></svg>', () => back());
let hintReadyAt = 0;
const hintBtn = mk('round', '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>', () => useHint());
hintBtn.setAttribute('aria-label', 'Hint');
const goBtn = mk('go', 'ENTER', () => enter());
const nextBtn = mk('next off', 'NEXT ▸', () => endRound('next'));
shuffleBtn.setAttribute('aria-label', 'Shuffle'); backBtn.setAttribute('aria-label', 'Delete');
const rngL = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
function paintLeaves() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight; leaf.width = W * dpr; leaf.height = H * dpr;
  const g = leaf.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const r = rngL(17);
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, s = 10 + r() * 22, a = r() * 7;
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 0.05 + r() * 0.07; g.fillStyle = r() < 0.5 ? '#9fe0b4' : '#f3c45e';
    g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.7, 0, 0, s); g.quadraticCurveTo(-s * 0.7, 0, 0, -s); g.fill(); g.restore();
  }
}

// ---------------------------------------------------------------- trees (one per round, grows with stars)
const WCOL = ['#4fae6e', '#3b9aa4', '#e0813a'];
function treeSvg(n, world, locked) {
  const c = WCOL[world] || WCOL[0];
  if (locked) return '<svg viewBox="0 0 40 40"><circle cx="20" cy="30" r="3.5" fill="rgba(255,255,255,.3)"/></svg>';
  if (!n) return '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="32" rx="9" ry="3" fill="rgba(0,0,0,.2)"/><path d="M20 32v-4" stroke="#bfe3cf" stroke-width="2"/><circle cx="20" cy="26" r="2" fill="#bfe3cf" opacity=".8"/></svg>';
  const r = n === 1 ? 6 : n === 2 ? 9 : 12, ty = 32 - (n === 1 ? 7 : n === 2 ? 11 : 15);
  return `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="33" rx="10" ry="3" fill="rgba(0,0,0,.22)"/><rect x="18.4" y="${ty + r - 2}" width="3.2" height="${33 - ty - r + 2}" rx="1.4" fill="#8a5a2c"/><circle cx="20" cy="${ty}" r="${r}" fill="${c}"/><circle cx="${20 - r * .35}" cy="${ty - r * .35}" r="${r * .45}" fill="#fff" opacity=".18"/>${n === 3 ? `<circle cx="${20 + r * .5}" cy="${ty + r * .1}" r="1.8" fill="#f3c45e"/><circle cx="${20 - r * .45}" cy="${ty + r * .35}" r="1.8" fill="#f3c45e"/>` : ''}</svg>`;
}

// ---------------------------------------------------------------- state
let state = 'ready', cur = Math.min(Q.get('lv') ? Math.max(0, +Q.get('lv') - 1) : firstOpen(), 999), tries = S.get('tries', 0), points = S.get('points', 0);
let R = null, spec = null, found = new Set(), bonus = new Set(), pick = [], qualified = false, timeLeft = 150, roundLen = 150, recorded = false, beatenShown = false, roundPts = 0;
let wordEls = new Map(), tileBtns = [], trayEls = [], lastTick = 0;
let chain = 0, chainMax = 0, lastFoundAt = 0, bloomUntil = 0, goldFound = false, sixAt = null, elapsed = 0, goalDone = false, lastStarCount = 0, woke = true, swayed = false, lastAct = 0;
const CHAIN_MS = 7000;
const isDaily = D.isDaily;

function genSpec(i) {   // after the 30 authored rounds: endless groves with a rotating trick
  const L = i + 1, tricks = [{}, { wilt: 2 }, { thorn: 3 }, { wind: 30 }, { fog: 1 }, { wilt: 2, thorn: 3 }];
  return { b: seededBase(L * 9973 + 17), t: 170, g: ['words', 9], s3: 0.7, tw: tricks[L % tricks.length], gold: L % 3 === 0 ? 1 : 0, p: 'endless' };
}
const worldOf = (i) => Math.min(2, Math.floor(i / 10));
function build() {
  spec = isDaily ? { b: seededBase(D.seed * 7 + 3), t: 150, g: ['words', 1], s3: 0.85 } : cur < N ? LEVELS[cur] : genSpec(cur);
  R = buildRound(spec, isDaily || cur >= N ? 1 + tries : 1);
  const tw = spec.tw || {};
  // flow (honest difficulty): the round clock. With the world board on, F.k() is 1 for everyone.
  roundLen = Math.round(spec.t / (isDaily ? 1 : F.k())); timeLeft = roundLen;
  found = new Set(); bonus = new Set(); pick = []; qualified = false; recorded = false; beatenShown = false; roundPts = 0;
  chain = chainMax = 0; lastFoundAt = 0; bloomUntil = 0; goldFound = false; sixAt = null; elapsed = 0; goalDone = false; lastStarCount = 0; swayed = false; lastAct = performance.now();
  woke = !R.wiltCh; document.body.classList.remove('bloom');
  wall.innerHTML = ''; wordEls = new Map(); wall.classList.toggle('fog', !!tw.fog); mist.style.display = tw.fog ? 'block' : 'none';
  const hint = spec.hint || 0;
  for (const w of R.words) {
    const d = document.createElement('div'); d.className = 'w' + (w === R.gold ? ' gold' : '');
    for (let i = 0; i < w.length; i++) {
      const c = document.createElement('div'); c.className = 'c';
      if (i === 0 && (hint === 2 || (hint === 1 && w.length >= 5))) { c.textContent = w[0]; c.classList.add('h'); }
      d.appendChild(c);
    }
    wall.appendChild(d); wordEls.set(w, d);
  }
  tilesEl.innerHTML = ''; tilesEl.classList.remove('sway');
  tileBtns = R.letters.map((ch, i) => {
    const b = document.createElement('button'); b.textContent = ch;
    if (!woke && ch === R.wiltCh) b.classList.add('wilt');
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); drag = { n: 0 }; const had = pick.length; tap(i); if (pick.length > had) drag.n = 1; });
    tilesEl.appendChild(b); return b;
  });
  tray.innerHTML = ''; trayEls = R.letters.map(() => { const t = document.createElement('div'); t.className = 't'; tray.appendChild(t); return t; });
  nextBtn.classList.add('off'); res.classList.remove('on'); chainEl.classList.remove('on');
  ui.levels(isDaily ? 1 : cur + 1); ui.progress(0);
  const d = new Date();
  ui.sub(isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `${WORLDS[worldOf(cur)].name} · ${cur + 1}`);
  hud(); layout(); paintTray(); fogText();
}
const need3 = () => Math.ceil(R.words.length * (spec.s3 || 0.85));
const stNow = () => ({ found, bonus, pts: roundPts, chainMax, goldFound, sixAt, fracLeft: noClock() || isDaily ? null : timeLeft / roundLen });
function hud() {
  ptsEl.textContent = `★ ${points.toLocaleString()}`;
  clockEl.style.display = noClock() ? 'none' : '';
  clockEl.textContent = '⏱ ' + fmtTime(Math.max(0, Math.ceil(timeLeft)));
  clockEl.classList.toggle('hot', timeLeft <= 10 && state === 'play' && !noClock());
  ui.progress(Math.min(1, found.size / need3()));
  // goal chip: stars so far + the goal with its count
  const gp = goalProgress(R, stNow()), s = isDaily ? 0 : starsOf(R, stNow());
  goalEl.className = gp.have >= gp.need && qualified ? 'done' : '';
  if (isDaily) { const bt = doneToday ? doneToday.f : 0; goalEl.innerHTML = `<span class="st"><b>★</b></span><span>Daily · ${found.size}/${R.words.length} words${bt ? ' · best ' + bt : ''}</span>`; } else
  goalEl.innerHTML = `<span class="st"><b>${'★'.repeat(s)}</b>${'★'.repeat(3 - s)}</span><span>${goalText(R)}${gp.need > 1 ? ` · ${Math.min(gp.have, gp.need)}/${gp.need}` : ''}${qualified ? '' : ' · find the six'}</span>`;
  if (!isDaily && s > lastStarCount && s > 0) { lastStarCount = s; goalEl.classList.add('pulse'); setTimeout(() => goalEl.classList.remove('pulse'), 650); if (s >= 2) { ui.pop(s === 3 ? '★★★' : 'GOAL!', '#f3c45e', 34, 26); fx.confetti(30); chime(4, 79, 0.12); } }
  fogText();
}
function fogText() {
  if (!(spec && spec.tw && spec.tw.fog)) return;
  const left = {}; for (const w of R.words) if (!found.has(w)) left[w.length] = (left[w.length] || 0) + 1;
  const tot = R.words.length - found.size;
  mist.innerHTML = `<b>${tot} hidden</b>` + Object.keys(left).map(k => `${left[k]} × ${k}`).join(' · ');
}
const noClock = () => !isDaily && cur === 0 && !qualified && spec && spec.t >= 240;   // round 1 cannot be lost
function layout() {
  const W = innerWidth, H = innerHeight;
  paintLeaves();
  const pad = Math.max(18, H * 0.03), ctlY = H - pad - 52;
  ctl.style.top = ctlY + 'px';
  const ls = Math.min(58, Math.floor((Math.min(W, 460) - 32 - 50) / 6)); tilesEl.style.setProperty('--ls', ls + 'px');
  const WR = Math.min(84, Math.floor((Math.min(W, 460) - ls - 40) / 2)), box = 2 * WR + ls, tilesY = ctlY - 12 - box;
  tilesEl.style.cssText += `;top:${tilesY}px;left:${(W - box) / 2}px;right:auto;width:${box}px;height:${box}px;display:block`;
  tileBtns.forEach((b, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / tileBtns.length; b.style.position = 'absolute'; b.style.left = (WR + Math.cos(a) * WR) + 'px'; b.style.top = (WR + Math.sin(a) * WR) + 'px'; });
  const ts = Math.min(48, Math.floor((Math.min(W, 460) - 40 - 40) / 6)); tray.style.setProperty('--ts', ts + 'px');
  const trayY = tilesY - 22 - ts; tray.style.top = trayY + 'px';
  toast.style.top = trayY - 44 + 'px';
  const top = 138, bottom = trayY - 54, areaH = bottom - top, areaW = W - 28;
  mist.style.top = top + areaH * 0.62 + 'px';
  const words = R.words;
  let best = null;
  for (let nc = 1; nc <= 5; nc++) {
    const rows = Math.ceil(words.length / nc), cols = [];
    for (let i = 0; i < words.length; i += rows) cols.push(words.slice(i, i + rows));
    const lens = cols.map(c => Math.max(...c.map(w => w.length))), L = lens.reduce((a, b) => a + b, 0);
    const cs = Math.floor(Math.min(34, (areaH + 6) / rows - 6, (areaW + 2 * L) / (L + 0.7 * (cols.length - 1)) - 2));
    const colGap = Math.max(10, cs * 0.7), widths = lens.map(l => l * (cs + 2));
    const tw = widths.reduce((a, b) => a + b, 0) + colGap * (cols.length - 1);
    const score = cs - 1.5 * Math.max(0, rows - 8) - (cols.length - 1) * 0.5;
    if (cs >= 12 && (!best || score > best.score)) best = { cs, rowH: cs + 6, rows, cols, widths, colGap, tw, score };
  }
  if (!best) best = { cs: 12, rowH: 18, rows: Math.ceil(words.length / 3), cols: [], widths: [], colGap: 8, tw: areaW };
  wall.style.setProperty('--cs', best.cs + 'px');
  const usedRows = Math.min(best.rows, words.length), totalH = usedRows * best.rowH - 6;
  let x = (W - best.tw) / 2; const y0 = top + Math.max(0, (areaH - totalH) / 2);
  best.cols.forEach((col, ci) => {
    col.forEach((w, ri) => { const el = wordEls.get(w); el.style.left = x + 'px'; el.style.top = y0 + ri * best.rowH + 'px'; });
    x += best.widths[ci] + best.colGap;
  });
}
addEventListener('resize', () => R && layout());
function paintTray() {
  trayEls.forEach((t, i) => { const k = pick[i]; const ch = k === undefined ? '' : R.letters[k]; if (t.textContent !== ch) { t.textContent = ch; t.classList.toggle('on', !!ch); } });
  tileBtns.forEach((b, i) => b.classList.toggle('used', pick.includes(i)));
}

// ---------------------------------------------------------------- input
const wilted = (i) => !woke && R.letters[i] === R.wiltCh;
function tap(i) {
  if (state !== 'play' || pick.includes(i) || tray.className) return;
  lastAct = performance.now(); clearHint();
  if (wilted(i)) { say(`Wilted · find ${Math.max(1, (spec.tw.wilt) - found.size)} more word${spec.tw.wilt - found.size > 1 ? 's' : ''} to wake it`); soft.err(); buzz(15); return; }
  pick.push(i); chime(pick.length - 1, 67, 0.09); buzz(5); paintTray();
  const b = tileBtns[i]; b.animate([{ transform: 'scale(.7)' }, { transform: 'scale(.8)' }], { duration: 120 });
}
let drag = null;
const trail = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
trail.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:5;pointer-events:none';
trail.innerHTML = '<polyline fill="none" stroke="#f3c45e" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>';
document.body.appendChild(trail);
function drawTrail(x, y) {
  const pts = pick.map(k => { const r = tileBtns[k].getBoundingClientRect(); return (r.left + r.width / 2) + ',' + (r.top + r.height / 2); });
  if (x !== undefined && drag && pts.length) pts.push(x + ',' + y);
  trail.firstChild.setAttribute('points', drag && pts.length > 1 ? pts.join(' ') : '');
}
addEventListener('pointermove', (e) => {
  if (!drag || state !== 'play') return;
  drawTrail(e.clientX, e.clientY);
  const el = document.elementFromPoint(e.clientX, e.clientY), i = el ? tileBtns.indexOf(el.closest('button')) : -1;
  if (i >= 0 && !pick.includes(i) && !wilted(i)) { const had = pick.length; tap(i); if (pick.length > had) drag.n++; }
});
const endDrag = () => { const d = drag; drag = null; trail.firstChild.setAttribute('points', ''); if (d && d.n >= 2 && state === 'play' && !tray.className) { if (pick.length >= 3) enter(); else if (pick.length) { pick = []; paintTray(); } } };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', () => { drag = null; trail.firstChild.setAttribute('points', ''); });
function useHint() {   // reveals the first letter of a word still hidden (a stuck player's move besides waiting)
  const now = performance.now();
  if (state !== 'play' || isDaily) return;
  if (now < hintReadyAt) { say('Hint is recharging', 900); return; }
  const open = R.words.filter(w => !found.has(w) && !wordEls.get(w).firstChild.classList.contains('h'));
  const w = (found.size >= 2 ? open.find(x => x.length === 6) : null) || open.sort((a, b) => b.length - a.length)[0];
  if (!w) { say('Every first letter is showing', 1200); return; }
  const c = wordEls.get(w).firstChild; c.textContent = w[0]; c.classList.add('h'); c.style.opacity = 1; c.animate([{ transform: 'scale(1.8)' }, { transform: 'none' }], { duration: 300 });
  hintReadyAt = now + 15000; hintBtn.style.opacity = .45; setTimeout(() => hintBtn.style.opacity = '', 15000);
  soft.click(); say(`A ${w.length}-letter word starts with ${w[0].toUpperCase()}`, 1800);
}
function back() { if (state !== 'play' || !pick.length || tray.className) return; pick.pop(); soft.click(); paintTray(); }
function shuffle(forced) {
  if (state !== 'play') return;
  const word = pick.map(i => R.letters[i]);
  const idx = R.letters.map((_, i) => i); for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  R.letters = idx.map(i => R.letters[i]);
  const free = R.letters.map((_, i) => i); pick = word.map(ch => { const k = free.findIndex(i => R.letters[i] === ch); return free.splice(k, 1)[0]; });
  tileBtns.forEach((b, i) => { b.textContent = R.letters[i]; b.classList.toggle('wilt', wilted(i)); b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); });
  soft.swish(); paintTray(); clearHint();
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || state !== 'play') return;
  if (e.key === 'Enter') enter(); else if (e.key === 'Backspace') back(); else if (e.key === ' ') shuffle();
  else if (/^[a-zA-Z]$/.test(e.key)) { const ch = e.key.toLowerCase(), i = R.letters.findIndex((c, k) => c === ch && !pick.includes(k) && !wilted(k)); if (i >= 0) tap(i); }
});
function settle(cls, ms) { tray.className = cls; setTimeout(() => { tray.className = ''; pick = []; paintTray(); }, ms); }
function shakeBody() { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
function breakChain() { chain = 0; chainEl.classList.remove('on'); }
function bumpChain() {
  const now = performance.now();
  chain = lastFoundAt && now - lastFoundAt <= CHAIN_MS && chain > 0 ? chain + 1 : 1; lastFoundAt = now; chainMax = Math.max(chainMax, chain);
  if (chain >= 2) {
    chainEl.firstChild && chainEl.firstChild.remove?.();
    chainEl.innerHTML = `x${chain}<i></i>`; chainEl.classList.add('on'); chainEl.classList.remove('bump'); void chainEl.offsetWidth; chainEl.classList.add('bump');
    if (chain >= 3) ui.pop(chain >= 6 ? `CHAIN x${chain}!` : `x${chain} CHAIN`, '#f3c45e', 24 + Math.min(chain, 8) * 2, 33);
  } else chainEl.classList.remove('on');
  if (chain === 5 || chain === 8) { ui.pop(chain === 5 ? 'UNSTOPPABLE' : 'LEGENDARY', '#fff3b0', 40, 40); fx.confetti(90, ['#fff3b0', '#ff9bd0', '#9fe0b4', '#f3c45e']); ui.flash(0.5); shakeBody(); arp([79, 84, 88, 91, 96], 60, 0.12); }
  if (chain === 4 && bloomUntil < now) { bloomUntil = now + 8000; document.body.classList.add('bloom'); ui.pop('BLOOM · double points', '#ff9bd0', 32, 26); fx.confetti(40, ['#ff9bd0', '#ffe3f1', '#f3c45e']); arp([72, 76, 79, 84, 88], 70, 0.1); }
}
function enter() {
  if (state !== 'play' || tray.className) return;
  lastAct = performance.now();
  const w = pick.map(i => R.letters[i]).join('');
  if (w.length < 3) { if (w.length) { say('Three letters or more'); settle('bad', 380); soft.err(); } return; }
  const el = wordEls.get(w);
  if (el && !found.has(w)) {
    found.add(w); bumpChain();
    const mult = (1 + 0.25 * Math.min(chain - 1, 4)) * (performance.now() < bloomUntil ? 2 : 1);
    const pts = Math.round(wordPts(w) * mult); points += pts; roundPts += pts; S.set('points', points);
    { const tb = tray.getBoundingClientRect(), eb0 = el.getBoundingClientRect(), fl = document.createElement('div');
      fl.textContent = w; fl.style.cssText = `position:fixed;z-index:6;left:${tb.left + tb.width / 2}px;top:${tb.top}px;transform:translate(-50%,0);font:800 26px ui-rounded,system-ui,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#fff7e6;text-shadow:0 2px 8px rgba(0,0,0,.5);pointer-events:none;transition:all .32s cubic-bezier(.5,0,.8,.4)`;
      document.body.appendChild(fl); requestAnimationFrame(() => { fl.style.left = eb0.left + eb0.width / 2 + 'px'; fl.style.top = eb0.top + 'px'; fl.style.fontSize = '12px'; fl.style.opacity = '.3'; }); setTimeout(() => fl.remove(), 380); }
    el.classList.add('got'); if (w.length === 6) el.classList.add('six');
    [...el.children].forEach((c, i) => { c.textContent = w[i]; c.classList.remove('h'); c.style.animationDelay = i * 50 + 'ms'; });
    const b = el.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', '#f3c45e', '#9fe0b4'], 8 + w.length * 3, { speed: 2.6 + w.length * 0.3, size: 2.8 });
    fx.ring(b.left + b.width / 2, b.top + b.height / 2, '#f3c45e', 18 + w.length * 4);
    arp([67, 71, 74, 79].slice(0, Math.min(4, w.length - 2)), 60, 0.1); buzz(12);
    ui.pop(`+${pts}`, '#fff', 20, 44);
    settle('good', 330);
    if (w === R.gold) { goldFound = true; timeLeft += 10; points += 150; roundPts += 150; S.set('points', points); ui.pop('GOLDEN JACKPOT · +10s +150', '#ffd34a', 32, 30); ui.flash(0.5); fx.confetti(120, ['#ffd34a', '#fff3b0', '#f3c45e']); arp([72, 79, 84, 91], 70, 0.12); shakeBody(); }
    if (!woke && found.size >= (spec.tw.wilt || 0)) {
      woke = true; tileBtns.forEach((t, i) => { if (t.classList.contains('wilt')) { t.classList.remove('wilt'); t.classList.add('wake'); } }); ui.pop('The tile wakes up!', '#9fe0b4', 28, 30); arp([60, 67, 72], 80, 0.1);
    }
    if (w.length === 6 && !qualified) {
      qualified = true; sixAt = elapsed; nextBtn.classList.remove('off'); ui.pop('SIX! Next round unlocked', '#f3c45e', 28, 22); fx.confetti(70); shakeBody(); ui.flash(0.35); arp([67, 72, 76, 79, 84], 70, 0.12);
    } else if (w.length >= 5 && !(w === R.gold)) ui.pop('Great word!', '#fff', 28, 38);
    hud(); checkBeat();
    if (found.size === R.words.length) setTimeout(() => endRound('all'), 600);
    return;
  }
  if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); say('Already found'); settle('old', 380); soft.click(); return; }
  if (ALL.has(w) && fits(w, R.pc)) {
    if (bonus.has(w)) { say('Already found'); settle('old', 380); return; }
    bonus.add(w); bumpChain(); const pts = w.length * 5; points += pts; roundPts += pts; S.set('points', points); hud(); checkBeat();
    say(`Bonus word +${pts}`); arp([79, 84], 60, 0.08); settle('bonus', 420); return;
  }
  breakChain();
  const th = (spec.tw && spec.tw.thorn) || 0;
  if (th) { timeLeft = Math.max(1, timeLeft - th); say(`Thorn! −${th}s`); ui.flash(0.4); shakeBody(); hud(); } else say('Not in our word list');
  settle('bad', 380); soft.err(); buzz(20);
}
function checkBeat() { if (isDaily && !beatenShown && D.beaten(roundPts)) { beatenShown = true; ui.pop('BEATEN!', '#f3c45e', 40, 30); fx.confetti(60); } }

// hint for the first rounds: if the player stalls, the tiles of an easy word glow in order
let hintT = 0, hintWord = null;
function clearHint() { tileBtns.forEach(b => b.classList.remove('hintt')); hintWord = null; }
function idleHint() {
  if (isDaily || state !== 'play' || pick.length || performance.now() - lastAct < (cur > 1 ? 14000 : cur === 0 ? (found.size ? 5000 : 3000) : 8000) || hintWord) return;
  const open = R.words.filter(w => !found.has(w) && !(w.length === 6 && found.size < 2) && w.length <= 4);
  const w = open[0] || R.words.find(x => !found.has(x)); if (!w) return;
  hintWord = w; const used = new Set(); const idx = [...w].map(ch => { const i = R.letters.findIndex((c, k) => c === ch && !used.has(k)); used.add(i); return i; });
  say(`Try "${w.toUpperCase()}"`, 2600); idx.forEach((i, k) => setTimeout(() => tileBtns[i] && tileBtns[i].classList.add('hintt'), k * 220));
}

// ---------------------------------------------------------------- round end
function revealMissing() {
  for (const w of R.words) if (!found.has(w)) { const el = wordEls.get(w); el.classList.add('miss'); [...el.children].forEach((c, i) => { c.textContent = w[i]; c.classList.remove('h'); }); }
  wall.classList.remove('fog'); mist.style.display = 'none';
}
let bestNote = '';
function endRound(why) {
  if (state !== 'play') return;
  const won = qualified;
  state = won ? 'won' : 'lost';
  clearHint(); nextBtn.classList.add('off'); clockEl.classList.remove('hot'); breakChain(); document.body.classList.remove('bloom');
  if (!recorded) { recorded = true; B.submit(found.size); if (!isDaily) { if (won) F.level(true); else F.level(false, found.size / R.words.length); } }
  if (isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || found.size > prev.f) S.set(k, { f: found.size }); }
  revealMissing();
  if (won && why === 'all') { const b = 250; points += b; roundPts += b; S.set('points', points); ui.pop('Every word! +250', '#f3c45e', 30, 40); }
  hud();
  const line = `${found.size}/${R.words.length} words${bonus.size ? ` · ${bonus.size} bonus` : ''} · +${roundPts.toLocaleString()} ★`;
  if (won) { arp([67, 72, 76, 79, 84], 90, 0.12, 0.8); fx.confetti(); buzz([20, 40, 20]); } else { soft.err(); buzz([40, 60, 40]); }
  if (isDaily) {
    if (won) { D.won(roundPts, `found ${found.size} words in today's six letters and scored`); setTimeout(() => ui.win('', line), 900); }
    else setTimeout(() => ui.lose("Time's up!", `The six-letter word was ${R.words.filter(w => w.length === 6).map(w => w.toUpperCase()).join(' / ')} · ${found.size} words found`), 1400);
    return;
  }
  const s = won ? starsOf(R, stNow()) : 0, before = cur < N ? (stars[cur] || 0) : 0, chestsBefore = chestsReady();
  if (cur < N && s > before) { stars[cur] = s; S.set('st', stars); }
  bestNote = '';
  if (won && cur < N) { const bt = S.get('bt', {}), t = Math.round(elapsed); if (!bt[cur] || t < bt[cur]) { bestNote = bt[cur] ? `New best time ${fmtTime(t)} (was ${fmtTime(bt[cur])})` : `Time ${fmtTime(t)}`; bt[cur] = t; S.set('bt', bt); } else bestNote = `Time ${fmtTime(t)} · best ${fmtTime(bt[cur])}`; }
  if (won) { tries = 0; S.set('tries', 0); } else { tries++; S.set('tries', tries); }
  setTimeout(() => resultCard(won, s, before, line, chestsReady() > chestsBefore), won ? 550 : 1400);
}
function resultCard(won, s, before, line, newChest) {
  state = 'done';
  const gp = goalProgress(R, stNow()), n3 = need3();
  const six = R.words.filter(w => w.length === 6).map(w => w.toUpperCase()).join(' / ');
  let near = '';
  if (!won) {
    const gap = Math.max(0, n3 - found.size), hasSix = [...found].some(w => w.length === 6);
    near = !hasSix ? `No six-letter word yet: it was ${six}` : gp.have < gp.need ? `SO CLOSE: ${goalText(R).toLowerCase()} (${gp.have}/${gp.need})` : `SO CLOSE: ${gap} word${gap > 1 ? 's' : ''} short`;
  }
  else if (s < 3) near = gp.have >= gp.need && found.size >= n3 ? 'For ★★★ finish with a fifth of the clock left' : gp.have < gp.need ? `Goal: ${goalText(R).toLowerCase()} (${gp.have}/${gp.need})` : `${n3 - found.size} more word${n3 - found.size > 1 ? 's' : ''} for ★★★`;
  let chestLine = '';
  if (newChest) {
    const locked = SKINS.filter(k => !skinOwned.includes(k.id)); chestsOpened++; S.set('chests', chestsOpened);
    if (locked.length) { const k = locked[Math.floor(Math.random() * locked.length)]; skinOwned.push(k.id); skinOn = k.id; S.set('skins', skinOwned); S.set('skin', k.id); applySkin();
      chestLine = `<p class="near">🌰 Seed chest opened! New tiles: <span style="display:inline-block;width:22px;height:22px;border-radius:50%;vertical-align:middle;background:radial-gradient(circle at 38% 30%,${k.a},${k.b} 55%,${k.c})"></span> ${k.n}</p>`; }
    else { points += 500; S.set('points', points); chestLine = '<p class="near">🌰 Seed chest opened! +500 ★</p>'; }
    setTimeout(() => { fx.confetti(80); arp([72, 76, 79, 84], 80, 0.12); }, 500);
  }
  res.innerHTML = `<div class="tree">${treeSvg(s, worldOf(cur), false)}</div>
    <h1>${won ? (s === 3 ? 'Perfect grove!' : 'Round cleared!') : "Time's up!"}</h1>
    <div class="stars">${[1, 2, 3].map(k => k <= s ? `<b style="animation-delay:${k * 220}ms">★</b>` : '★').join('')}</div>
    <p>${line}</p>${bestNote ? `<p class="near">${bestNote}</p>` : ''}${near ? `<p class="near">${near}</p>` : ''}
    ${won && s > before && before === 0 ? `<p>A new tree is growing on your map</p>` : ''}
    ${!newChest && cur < N ? `<p class="near">🌰 <span style="display:inline-block;width:90px;height:8px;border-radius:4px;background:rgba(255,255,255,.2);vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:${(totalStars() % 6) / 6 * 100}%;background:#f3c45e"></i></span> ${totalStars() % 6}/6 ★ · daily is ready</p>` : ''}
    ${chestLine}
    <div class="row"><button class="sec" data-a="map">Map</button><button class="${won && s === 3 ? 'sec' : 'pri'}" data-a="retry">${won ? '↻ Again' : '↻ Try again'}</button>${won ? `<button class="pri${s === 3 ? ' pul' : ''}" data-a="next">Next ▸</button>` : ''}</div>`;
  res.classList.add('on');
  if (won) { for (let k = 1; k <= s; k++) setTimeout(() => chime(k * 2, 79, 0.12), k * 220); if (s === 3) fx.confetti(90); }
  clearTimeout(autoT);
  if (won && s === 3) { const nb = res.querySelector('[data-a=next]'); if (nb) nb.style.background = 'linear-gradient(90deg,#fff3b0 0,#fff3b0 0,#f3c45e 0)', nb.animate([{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }], { duration: 2600 }); autoT = setTimeout(() => { if (state === 'done') { cur = Math.min(cur + 1, 9999); startRound(); } }, 2600); }
  res.onclick = won ? (e) => { if (!e.target.closest('button')) { cur = Math.min(cur + 1, 9999); startRound(); } } : null;
  res.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); const a = b.dataset.a;
    clearTimeout(autoT);
    if (a === 'map') openMap();
    else { if (a === 'next') cur = Math.min(cur + 1, 9999); startRound(); }
  }));
}
let autoT = 0;
function startRound() { clearTimeout(autoT); res.classList.remove('on'); mapEl.classList.remove('on'); build(); state = 'play'; lastT = performance.now(); lastAct = performance.now(); }

// ---------------------------------------------------------------- grove map
function openMap() {
  state = 'map'; res.classList.remove('on');
  const tot = totalStars(), ready = chestsReady(), toNext = 6 - (tot % 6);
  let h = `<div class="bar"><div class="top"><span>Grove map · ★ ${tot}/${N * 3}</span><button class="x" data-a="close">✕</button></div>
    <div class="chest"><span>🌰</span><div class="cb"><i style="width:${(tot % 6) / 6 * 100}%"></i></div>${ready > 0 ? `<button class="opench" data-a="chest">Open chest${ready > 1 ? ' ×' + ready : ''}</button>` : `<span>${toNext} ★ to a seed chest</span>`}</div>
    <div class="skins">${SKINS.map(k => { const own = skinOwned.includes(k.id); return `<button class="sk${k.id === skinOn ? ' on' : ''}${own ? '' : ' lock'}" data-a="skin" data-k="${k.id}" title="${own ? k.n : 'locked'}" style="background:radial-gradient(circle at 38% 30%,${k.a},${k.b} 55%,${k.c})"></button>`; }).join('')}</div></div>`;
  const nxt = firstOpen();
  WORLDS.forEach((W, wi) => {
    const got = LEVELS.slice(wi * 10, wi * 10 + 10).reduce((a, _, j) => a + (stars[wi * 10 + j] || 0), 0);
    h += `<div class="wh" style="color:${W.c2}">${W.name} · ${got}/30 ★<span>${W.sub}</span></div><div class="grid">`;
    for (let j = 0; j < 10; j++) {
      const i = wi * 10 + j, L = LEVELS[i], lock = !unlocked(i), s = stars[i] || 0;
      h += `<button class="nd${lock ? ' lock' : ''}${L.hard ? ' hard' : ''}${i === nxt ? ' next' : ''}" data-a="lv" data-i="${i}">${treeSvg(s, wi, lock)}<span>${i + 1}</span><span class="s">${'★'.repeat(s)}</span></button>`;
    }
    h += '</div>';
  });
  h += `<div class="end">${nxt >= N ? 'Every grove is green. Endless groves wait ▸' : 'Clear a round with the six-letter word to open the next'}</div>${nxt >= N ? `<div style="text-align:center;padding-bottom:30px"><button class="pri" data-a="endless">Endless ▸</button></div>` : '<div style="height:30px"></div>'}`;
  mapEl.innerHTML = h; mapEl.classList.add('on');
  mapEl.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); const a = b.dataset.a;
    if (a === 'close') { mapEl.classList.remove('on'); if (state === 'map') { cur = Math.min(cur, N); startRound(); } }
    else if (a === 'lv') { const i = +b.dataset.i; if (unlocked(i)) { cur = i; tries = 0; startRound(); } else say('Clear the round before it first'); }
    else if (a === 'endless') { cur = N; startRound(); }
    else if (a === 'skin') { const k = b.dataset.k; if (skinOwned.includes(k)) { skinOn = k; S.set('skin', k); applySkin(); openMap(); } }
    else if (a === 'chest') {
      const locked = SKINS.filter(k => !skinOwned.includes(k.id));
      chestsOpened++; S.set('chests', chestsOpened);
      if (locked.length) { const k = locked[Math.floor(Math.random() * locked.length)]; skinOwned.push(k.id); skinOn = k.id; S.set('skins', skinOwned); S.set('skin', k.id); applySkin(); fx.confetti(80); arp([72, 76, 79, 84], 80, 0.12); openMap(); say(`New tiles: ${k.n}`, 2200); }
      else { points += 500; S.set('points', points); openMap(); say('+500 ★', 1800); }
    }
  }));
}

let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000); lastT = t;
  if (state === 'play') {
    if (!noClock()) timeLeft -= dt;
    elapsed += dt;
    const now = performance.now();
    if (chain > 0) { if (now - lastFoundAt > CHAIN_MS) breakChain(); else { const i = chainEl.querySelector('i'); if (i) i.style.transform = `scaleX(${Math.max(0, 1 - (now - lastFoundAt) / CHAIN_MS)})`; } }
    if (bloomUntil && now > bloomUntil) { bloomUntil = 0; document.body.classList.remove('bloom'); }
    chainEl.classList.toggle('bloom', now < bloomUntil);
    const wind = spec.tw && spec.tw.wind;
    if (wind) {   // a leaf warns three seconds before the tiles are blown around
      const phase = elapsed % wind;
      if (phase > wind - 3 && !swayed) { swayed = true; tilesEl.classList.add('sway'); say('Wind is coming!', 2400); }
      if (phase < 1 && swayed) { swayed = false; tilesEl.classList.remove('sway'); shuffle(true); ui.flash(0.2); }
    }
    idleHint();
    const s = Math.ceil(timeLeft); if (s !== lastTick) { lastTick = s; hud(); if (s <= 10 && s > 0 && !noClock()) tone(s <= 5 ? 1200 : 900, 0.04, 'sine', 0.05, 1); }
    if (timeLeft <= 0) { timeLeft = 0; hud(); endRound('time'); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- start card: Play goes straight into the next round
applySkin();
startCard(ui, D, {
  kicker: isDaily ? 'Daily six letters' : firstOpen() === 0 ? 'six letters · find every word' : `${WORLDS[worldOf(Math.min(firstOpen(), N - 1))].name} · round ${Math.min(firstOpen(), N) + 1}`,
  doneLine: doneToday ? `Played today · ${doneToday.f} words` : null,
});
if (!isDaily) {
  const mb = document.createElement('button'); mb.className = 'calm-chip'; mb.style.cssText = 'margin-top:12px;pointer-events:auto';
  mb.textContent = `Grove map · ★ ${totalStars()}/${N * 3}`; mb.addEventListener('pointerdown', e => e.stopPropagation());
  mb.addEventListener('click', (e) => { e.stopPropagation(); ui.hideStart(); B.start(); openMap(); });
  ui.els.start.querySelector('.hint').before(mb);
}
{ const p = document.createElement('p'); p.textContent = 'Find a six-letter word to unlock the next round'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily round<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Round cleared!';
ui.els.lose.querySelector('.hint').textContent = 'Tap for new letters';
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; lastT = performance.now(); lastAct = performance.now(); return; }
  if (isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
});
build();

// ---------------------------------------------------------------- test hooks (qa/playall.cjs plays every round through these)
window.__game = {
  get state() { return state; }, get level() { return cur + 1; }, get score() { return points; }, get stars() { return stars.slice(); },
  get words() { return R.words.slice(); }, get wilt() { return R.wiltCh; }, get gold() { return R.gold; }, get found() { return found.size; },
  get tilesLeft() { return tileBtns.length; }, get qualified() { return qualified; },
  /** type a word with real taps (respecting wilted tiles) and press ENTER; returns true if it filled a slot */
  play(w) {
    if (state !== 'play') return false;
    pick = []; tray.className = ''; const used = new Set(), before = found.size;
    for (const ch of w) { const i = R.letters.findIndex((c, k) => c === ch && !used.has(k) && !wilted(k)); if (i < 0) { pick = []; paintTray(); return false; } used.add(i); tap(i); }
    enter(); return found.size > before;
  },
  finish() { endRound('next'); }, resultStars() { return stars[cur] || 0; },
  bot() {
    if (state !== 'play' || tray.className) return;
    const open = R.words.filter(w => !found.has(w));
    if (qualified && found.size >= 5) return endRound('next');
    const w = (found.size >= 2 ? open.find(x => x.length === 6) : null) || open.find(x => !R.wiltCh || !x.includes(R.wiltCh)) || open[0];
    if (w) this.play(w);
  },
};
