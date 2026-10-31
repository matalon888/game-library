// Alibi Grid v2 — the deep version. Same game (a grid of suspects, one true clue each, deduce who is innocent and who is a
// criminal, no guessing), with 30 hand-drawn cases in 3 worlds, stars, evidence stickers, ranks, a case map, hints earned by
// clean solves, a daily case and cold cases after 30. World 3 changes how you read: criminals lie.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { generate, consFor, deducible, forced, effective, LETTER, dims, FAMILIES } from './dlogic.js';
import { LEVELS, WORLDS } from './levels.js';

const B = board({ game: 'alibi-grid', label: 'Cases solved', limits: { maxRun: 2, maxPerSec: 0.05 }, mode: 'sum' });   // same scale as v1 (RULES.md part C)
const NAME = 'Alibi Grid: Daily Logic Puzzle';
const S = store('alibigrid2');
const ui = createUI({ title: 'Alibi Grid', hint: '', hand: '', score: false });
ui.els.start.classList.add('hc-hidden'); ui.els.win.remove(); ui.els.lose.remove(); ui.els.start.remove();
const D = daily('alibigrid', null, { name: NAME });
const fx = fx2d(31);
const Q = new URLSearchParams(location.search);
const ACCENT = '#c8553d';
const EVIDENCE = ['🔑', '🕯️', '📜', '🧤', '🔍', '🗝️', '💎', '🎩', '📎', '🧣', '⚓', '🐟', '🧭', '🔦', '🪝', '🎣', '🛟', '📻', '🪙', '🧲', '🥂', '🛎️', '🎻', '🖼️', '🪞', '🕰️', '🧳', '👑', '🍸', '🏆'];
const RANKS = [[0, 'Rookie'], [5, 'Constable'], [12, 'Sleuth'], [24, 'Detective'], [40, 'Inspector'], [58, 'Chief'], [76, 'Legend']];
const TOTAL = LEVELS.length;

// ---------------------------------------------------------------- style
css(`
body{background:#efe5d3;overscroll-behavior:none}
#paper{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 110% 70% at 50% 30%,#fbf5ea,#efe4cf 70%,#e2d3b8)}
#paper:after{content:'';position:absolute;inset:0;opacity:.35;background:repeating-linear-gradient(0deg,rgba(120,90,50,.05) 0 1px,transparent 1px 4px)}
body.w1 #paper{background:radial-gradient(ellipse 110% 70% at 50% 30%,#eef8fa,#d9ecef 70%,#bcd7de)}
body.w2 #paper{background:radial-gradient(ellipse 110% 70% at 50% 30%,#f6f0fb,#e6dcf1 70%,#cdbfe0)}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:var(--wc,#c8553d);box-shadow:0 2px 0 rgba(0,0,0,.15)}
.hc-top .hc-lvl.next{background:rgba(42,37,34,.12);color:#6e5f52}
.hc-top .hc-bar{background:rgba(42,37,34,.12);height:8px}.hc-top .hc-bar i{background:var(--wc,#c8553d)}
#h1{position:fixed;left:62px;right:12px;top:52px;z-index:6;display:flex;align-items:center;gap:8px;color:#2a2522;font-weight:800;font-size:13px}
#h1 button{font:inherit;font-weight:800;color:#2a2522;background:#fff;border:1px solid #e0d2bb;border-radius:14px;padding:4px 11px;box-shadow:0 2px 0 #e0d2bb;cursor:pointer;touch-action:manipulation;white-space:nowrap}
#h1 .ttl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;letter-spacing:.3px}
#h1 .ttl em{font-style:normal;opacity:.55;font-weight:700;margin-right:5px}
#h1 .tag{display:inline-block;font-size:9.5px;letter-spacing:1.2px;font-weight:900;color:#fff;border-radius:6px;padding:2px 5px;margin-left:6px;vertical-align:1px}
#h2{position:fixed;left:12px;right:12px;top:82px;z-index:5;display:flex;align-items:center;justify-content:space-between;color:#2a2522;font-weight:700;font-size:12px;letter-spacing:.5px}
#h2 .mx{display:flex;gap:5px;align-items:center;opacity:.85}#h2 .mx i{width:13px;height:13px;border-radius:50%;border:2px solid var(--wc,#c8553d);display:inline-block;transition:transform .2s}#h2 .mx i.on{background:var(--wc,#c8553d);transform:scale(.8)}
#h2 .tm{font-variant-numeric:tabular-nums;opacity:.65}
#h2 .cb{font-weight:900;color:var(--wc,#c8553d);min-width:70px;text-align:right;transition:transform .15s}
#grid{position:fixed;z-index:3;display:grid;gap:7px}
.pc{position:relative;border-radius:14px;background:#fffbf3;border:1.5px solid #e6d9c4;box-shadow:0 3px 0 #e2d3bb,0 6px 12px rgba(80,60,30,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;transition:transform .18s,background .3s,border-color .3s,box-shadow .2s;color:#2a2522;overflow:hidden;touch-action:manipulation}
.pc .av{font-size:30px;line-height:1.1;width:44px;height:44px;border-radius:50%;background:#f3e8d6;display:flex;align-items:center;justify-content:center;transition:background .3s}
.pc.sm .av{font-size:24px;width:34px;height:34px}.pc.sm .jb{display:none}
.pc .nm{font-weight:800;font-size:15px;line-height:1.1;margin-top:3px}
.pc .jb{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.55;font-weight:700}
.pc .co{position:absolute;left:6px;top:4px;font-size:10px;font-weight:800;opacity:.35}
.pc .bd{position:absolute;left:0;right:0;bottom:0;font-size:9.5px;font-weight:900;letter-spacing:1.5px;text-align:center;padding:2px 0;color:#fff;transform:translateY(100%);transition:transform .3s}
.pc .cf{position:absolute;right:3px;top:0;font-size:22px;opacity:0;transform:scale(2.4) rotate(-30deg);transition:all .25s cubic-bezier(.3,1.6,.5,1);pointer-events:none}
.pc.cuffed .cf{opacity:1;transform:none}
.pc.inn{background:#e3f4e7;border-color:#7cc394;box-shadow:0 3px 0 #a9d8b8}.pc.inn .av{background:#c6ead0}.pc.inn .bd{background:#3f9a62;transform:none}
.pc.crim{background:#fbe2dd;border-color:#e08a7b;box-shadow:0 3px 0 #efb5aa}.pc.crim .av{background:#f6c4ba}.pc.crim .bd{background:#c8553d;transform:none}
.pc.inn,.pc.crim{padding-bottom:17px}
.pc.sel{transform:translateY(-3px) scale(1.04);box-shadow:0 0 0 3px #2a2522,0 10px 18px rgba(80,60,30,.2);z-index:2}
.pc.ref{box-shadow:0 0 0 3px #f0b13c,0 6px 12px rgba(80,60,30,.15)}
.pc.flip{animation:flp .5s}
@keyframes flp{0%{transform:rotateY(0)}50%{transform:rotateY(90deg) scale(1.05)}100%{transform:rotateY(0)}}
.pc.shake{animation:shk .36s}
@keyframes shk{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
.pc.wob{animation:wob .45s}
@keyframes wob{30%{transform:rotate(-3deg)}60%{transform:rotate(3deg)}}
.pc.hint{animation:hnt 1s ease-in-out 4}
@keyframes hnt{50%{box-shadow:0 0 0 4px #f0b13c,0 0 22px rgba(240,177,60,.9);transform:scale(1.05)}}
#hand{position:fixed;z-index:9;font-size:34px;pointer-events:none;display:none;animation:hnd .9s ease-in-out infinite}
@keyframes hnd{50%{transform:translate(6px,-8px)}}
#panel{position:fixed;z-index:3;background:#fffbf3;border:1.5px solid #e6d9c4;border-radius:18px;box-shadow:0 4px 0 #e2d3bb;display:flex;flex-direction:column;overflow:hidden;color:#2a2522}
#panel h3{margin:0;padding:8px 14px 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.55;display:flex;justify-content:space-between}
#clues{overflow-y:auto;padding:0 10px 10px;display:flex;flex-direction:column;gap:6px;touch-action:pan-y}
.cl{display:flex;gap:9px;align-items:flex-start;padding:7px 9px;border-radius:12px;background:#f6eedf;font-size:14.5px;line-height:1.35;cursor:pointer;animation:clin .4s}
.cl.new{background:#fff1cf;box-shadow:0 0 0 2px #f0b13c inset}
.cl.liar{background:#f3e6f6}.cl.liar.new{background:#f0dcf7;box-shadow:0 0 0 2px #b07bd0 inset}
.cl .a{font-size:20px;line-height:1;flex:none;margin-top:1px}
.cl .lt{display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:1px;color:#fff;background:#7b4fa3;border-radius:6px;padding:1px 5px;margin-left:6px;vertical-align:1px}
.cl b{font-weight:800}.cl i{font-style:normal;font-weight:800}.cl i.c{color:#c8553d}.cl i.n{color:#3f9a62}
@keyframes clin{from{opacity:0;transform:translateY(-8px)}}
#ask{position:fixed;left:10px;right:10px;z-index:20;background:#2a2522;color:#fff;border-radius:20px;padding:14px;display:none;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);animation:clin .25s}
#ask .q{text-align:center;font-weight:700;font-size:16px}
#ask .r{display:flex;gap:10px}
#ask button{flex:1;font:inherit;font-weight:800;font-size:18px;border:0;border-radius:14px;padding:13px 0;cursor:pointer;color:#fff;touch-action:manipulation}
#ask .bi{background:#3f9a62;box-shadow:0 4px 0 #2b7146}#ask .bc{background:#c8553d;box-shadow:0 4px 0 #94392a}
#ask .x{background:none;color:#fff;opacity:.6;font-size:14px;padding:2px;flex:none}
#toast{position:fixed;left:50%;transform:translateX(-50%);z-index:30;background:#2a2522;color:#fff;font-weight:700;font-size:15px;padding:9px 16px;border-radius:18px;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis}
#title{position:fixed;left:0;right:0;top:34%;z-index:25;text-align:center;pointer-events:none;color:#2a2522;opacity:0}
#title.go{animation:ttl 1.9s ease-out forwards}
#title b{display:block;font-family:ui-serif,'New York',Georgia,serif;font-size:34px;letter-spacing:-.3px;text-shadow:0 2px 0 #fff8}
#title small{display:none}
#title i{font-style:normal;display:block;font-size:11px;letter-spacing:3px;font-weight:800;opacity:.6;margin-bottom:4px}
@keyframes ttl{0%{opacity:0;transform:scale(.8)}12%{opacity:1;transform:none}75%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}
.sheet{position:fixed;inset:0;z-index:35;background:linear-gradient(#f6eddc,#ecdfc6);overflow-y:auto;color:#2a2522;display:none;padding:0 0 40px;-webkit-overflow-scrolling:touch}
.sheet.on{display:block;animation:clin .25s}
.mp-top{position:sticky;top:0;z-index:2;background:linear-gradient(#f6eddc 78%,#f6eddc00);padding:62px 16px 10px}
.mp-rank{display:flex;align-items:center;gap:10px}
.mp-rank .bg{width:44px;height:44px;border-radius:50%;background:#2a2522;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;flex:none}
.mp-rank .rt{flex:1}.mp-rank .rt b{font-family:ui-serif,'New York',Georgia,serif;font-size:20px}
.mp-rank .rb{height:8px;background:rgba(42,37,34,.12);border-radius:5px;margin-top:5px;overflow:hidden}.mp-rank .rb i{display:block;height:100%;background:${ACCENT};border-radius:5px;transition:width .6s}
.mp-rank small{font-size:11.5px;font-weight:700;opacity:.65}
.mp-hint{font-weight:800;font-size:14px;background:#fff;border:1px solid #e0d2bb;border-radius:14px;padding:6px 10px;box-shadow:0 2px 0 #e0d2bb;white-space:nowrap}
.mp-daily{margin:10px 16px 0;display:flex;align-items:center;gap:12px;background:#2a2522;color:#fff;border-radius:16px;padding:10px 14px;cursor:pointer;touch-action:manipulation;border:0;font:inherit;width:calc(100% - 32px);text-align:left}
.mp-daily .cal{width:40px;height:44px;border-radius:9px;background:#fff;color:#2a2522;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;line-height:1;overflow:hidden;flex:none}
.mp-daily .cal i{font-style:normal;font-size:9px;letter-spacing:1px;background:${ACCENT};color:#fff;width:100%;text-align:center;padding:3px 0}.mp-daily .cal em{font-style:normal;font-size:20px;padding-top:4px}
.mp-daily b{display:block;font-size:16px}.mp-daily span{display:block;font-size:12.5px;opacity:.75;margin-top:1px}
.mp-daily.done{background:#3a4a3e}
.wd{margin:18px 16px 0}
.wd h2{margin:0;font-family:ui-serif,'New York',Georgia,serif;font-size:22px;color:var(--c)}
.wd p{margin:2px 0 8px;font-size:12.5px;font-weight:600;opacity:.65}
.wd .cnt{float:right;font-size:12px;font-weight:800;opacity:.7;margin-top:6px}
.nodes{display:grid;grid-template-columns:repeat(5,1fr);gap:10px 6px}
.nd{position:relative;aspect-ratio:1;border-radius:50%;background:#fffbf3;border:2px solid #e0d2bb;box-shadow:0 3px 0 #e0d2bb;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:900;font-size:17px;color:#6e5f52;cursor:pointer;touch-action:manipulation;margin:0 6%}
.nd.lock{background:#e7dcc7;color:#a89a85;cursor:default;box-shadow:none;border-color:#d8c9ae}
.nd.done{background:#fff;border-color:var(--c);color:#2a2522;font-size:24px}
.nd.next{background:var(--c);border-color:var(--c);color:#fff;animation:npl 1.3s ease-in-out infinite}
@keyframes npl{50%{transform:scale(1.12);box-shadow:0 0 0 6px color-mix(in srgb,var(--c) 25%,transparent)}}
.nd .st{position:absolute;bottom:-10px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:-1px;color:#e9a31c;text-shadow:0 1px 0 #fff}
.nd .st.g{color:#d79a12}
.nd.hard{box-shadow:0 0 0 3px #d9443a,0 3px 0 #e0d2bb}.nd.boss::after{content:'👑';position:absolute;top:-10px;right:-4px;font-size:15px}
.nd.hard::before{content:'HARD';position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:8px;letter-spacing:1px;background:#d9443a;color:#fff;padding:1px 5px;border-radius:6px}
.nd.lie::after{content:'🤥';position:absolute;top:-8px;left:-4px;font-size:13px}
.nd.boss.lie::after{content:'👑';left:auto;right:-4px;top:-10px}
.mp-cold{margin:22px 16px 0;padding:12px 14px;background:#fffbf3;border:1.5px dashed #c8b99b;border-radius:16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-weight:800;touch-action:manipulation}
.mp-cold span{font-size:12px;opacity:.65;font-weight:600;display:block}
.mp-close{position:fixed;right:12px;top:14px;z-index:36;font:inherit;font-weight:800;background:#2a2522;color:#fff;border:0;border-radius:18px;padding:8px 16px;cursor:pointer;display:none;touch-action:manipulation}
.mp-close.on{display:block}
.card{position:fixed;inset:0;z-index:34;background:rgba(24,20,18,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px}
.card.on{display:flex}
.card .in{background:#fffbf3;border-radius:24px;padding:20px 20px 16px;width:100%;max-width:360px;text-align:center;color:#2a2522;box-shadow:0 20px 60px rgba(0,0,0,.4);animation:cin .4s cubic-bezier(.3,1.5,.5,1)}
@keyframes cin{from{opacity:0;transform:scale(.8) translateY(20px)}}
.card h1{margin:0;font-family:ui-serif,'New York',Georgia,serif;font-size:32px;letter-spacing:-.5px}
.card .sub{font-size:13px;font-weight:700;opacity:.6;margin-top:2px;letter-spacing:.3px}
.card .stars{font-size:46px;letter-spacing:6px;margin:8px 0 2px;height:56px}
.card .stars span{display:inline-block;opacity:.18;transform:scale(.4);filter:grayscale(1)}
.card .stars span.on{opacity:1;filter:none;animation:sdrop .5s cubic-bezier(.3,1.7,.5,1) forwards}
@keyframes sdrop{from{opacity:0;transform:scale(2.5) rotate(-25deg)}to{opacity:1;transform:none}}
.card .stk{display:inline-flex;align-items:center;gap:8px;background:#f6eedf;border-radius:14px;padding:8px 14px;margin:6px 0;font-weight:800;font-size:14px}
.card .stk em{font-style:normal;font-size:30px;display:inline-block;animation:stamp .5s .4s cubic-bezier(.3,1.7,.5,1) both}
@keyframes stamp{from{opacity:0;transform:scale(3) rotate(20deg)}}
.card .row{font-size:13.5px;font-weight:700;opacity:.8;margin:5px 0;line-height:1.4}
.card .bar{height:8px;background:rgba(42,37,34,.12);border-radius:5px;overflow:hidden;margin:4px 20px}.card .bar i{display:block;height:100%;background:${ACCENT};border-radius:5px;transition:width .8s}
.card .btns{display:flex;gap:8px;margin-top:12px}
.card button{font:inherit;font-weight:800;border:0;border-radius:16px;padding:13px 10px;cursor:pointer;touch-action:manipulation;flex:1;font-size:16px;background:#efe3cf;color:#2a2522}
.card button.pri{background:var(--wc,#c8553d);color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.2);flex:2;font-size:19px}
.card button.pri:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}
.card.lose h1{color:#6e5f52}
#tip{position:fixed;left:14px;right:14px;z-index:12;background:#2a2522;color:#fff;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;text-align:center;line-height:1.35;display:none;animation:clin .3s}
`);
const ce = (tag, id, html = '') => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; return e; };
const paper = ce('div', 'paper'); document.body.prepend(paper);
const h1 = ce('div', 'h1', '<button class="mapb">🗺 Cases</button><div class="ttl"></div><button class="hintb">💡 3</button>');
const h2 = ce('div', 'h2', '<div class="mx"><i></i><i></i><i></i></div><div class="tm">0:00</div><div class="cb"></div>');
const grid = ce('div', 'grid'), panel = ce('div', 'panel', '<h3><span>Clues</span><span class="cn"></span></h3><div id="clues"></div>');
const cluesEl = panel.querySelector('#clues'), hand = ce('div', 'hand', '👆'), tipEl = ce('div', 'tip');
const ask = ce('div', 'ask', '<div class="q"></div><div class="r"><button class="bi">😇 Innocent</button><button class="bc">🦹 Criminal</button></div><button class="x">cancel</button>');
const toastEl = ce('div', 'toast'), titleEl = ce('div', 'title');
const mapEl = ce('div', 'map'); mapEl.className = 'sheet';
const mapClose = ce('button'); mapClose.className = 'mp-close'; mapClose.textContent = 'Back to case';
const card = ce('div', 'card'); card.className = 'card';
document.body.append(h1, h2, grid, panel, hand, tipEl, ask, toastEl, titleEl, mapEl, mapClose, card);
for (const el of [h1, h2, grid, panel, ask, mapEl, mapClose, card]) el.addEventListener('pointerdown', e => e.stopPropagation());
let toastT = 0; const toast = (t, ms = 1600) => { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => toastEl.style.opacity = 0, ms); };

// ---------------------------------------------------------------- progress (saved)
const prog = () => S.get('p', {});            // { levelId: stars }
const stars = (id) => prog()[id] || 0;
const totalStars = () => Object.values(prog()).reduce((a, b) => a + b, 0);
const solvedCount = () => Object.keys(prog()).length;
const rankOf = (st) => { let r = 0; RANKS.forEach((x, i) => { if (st >= x[0]) r = i; }); return r; };
const unlocked = (id) => id <= 1 || stars(id - 1) > 0 || stars(id) > 0;
const nextOpen = () => { for (const L of LEVELS) if (!stars(L.id)) return L.id; return TOTAL + 1 + (S.get('cold', 0)); };
const hintsLeft = () => S.get('hints', 3);
const addHints = (n) => S.set('hints', Math.min(4, hintsLeft() + n));

// ---------------------------------------------------------------- case state
let state = 'ready', C = null, known = [], mistakes = 0, hintsUsed = 0, sel = -1, t0 = 0, cards = [], combo = 0, bestCombo = 0, marks = 0, lastAct = 0, mode = 'level', dim = null, tipShown = false, lieShown = false;
const MAXM = 3, MAXSTEP = 12;
const worldOf = (c) => c.world != null ? c.world : 0;

/** a Case object from a baked level */
function fromLevel(L) {
  return { id: L.id, world: L.world, title: L.title, purpose: L.purpose, tip: L.tip, cols: L.cols, rows: L.rows, lie: !!L.lie, hard: !!L.hard, boss: !!L.boss, safe: !!L.safe, start: L.start,
    truth: [...L.truth].map(Number), people: L.people.map(p => ({ name: p[0], job: p[1], e: p[2] })), clues: L.clues };
}
const COLD_FAMS = FAMILIES.filter(f => f !== 'direct' || true);
/** cold case n (31+): generated, same unlocked families, liars on every other block of 5 */
function coldCase(n) {
  const lie = Math.floor((n - 31) / 5) % 2 === 0, k = n - 31;
  const g = generate(9000 + n * 17, { cols: 4, rows: 5, fams: COLD_FAMS, focus: [], lie, minSteps: 8 + (k % 5), maxSteps: 15 });
  return { id: n, world: 3, title: 'Cold Case ' + (n - 30), purpose: lie ? 'Generated: the hotel again, criminals lie.' : 'Generated: every kind of statement.', tip: '', cols: 4, rows: 5, lie, hard: k % 5 === 4, boss: false, safe: false, start: g.start, truth: g.truth, people: g.people, clues: g.clues };
}
function dailyCase() {
  const d = new Date(), lie = d.getDate() % 2 === 0, seed = todayKey();
  const g = generate(seed, { cols: 4, rows: 5, fams: COLD_FAMS, focus: [], lie, minSteps: 7, maxSteps: 14 });
  return { id: 'daily', world: lie ? 2 : 1, title: 'Case of the Day', purpose: lie ? 'Today the criminals lie.' : 'Everyone tells the truth today.', tip: '', cols: 4, rows: 5, lie, hard: false, boss: false, safe: false, start: g.start, truth: g.truth, people: g.people, clues: g.clues };
}
const cons = () => consFor(C.clues, known, C.lie);
const rcOf = (i) => [Math.floor(i / C.cols), i % C.cols];

function layout() {
  if (!C) return;
  const W = innerWidth, H = innerHeight, gw = Math.min(W - 20, 470), top = 112, rows = C.rows;
  const ch = Math.min(108, Math.max(58, (H - top - 190) / rows - 7));
  Object.assign(grid.style, { left: (W - gw) / 2 + 'px', width: gw + 'px', top: top + 'px', gridTemplateColumns: `repeat(${C.cols},1fr)`, gridAutoRows: ch + 'px' });
  const side = (W - gw) / 2; Object.assign(h1.style, { left: Math.max(62, side) + 'px', right: Math.max(12, side) + 'px' }); Object.assign(h2.style, { left: Math.max(12, side) + 'px', right: Math.max(12, side) + 'px' });
  cards.forEach(c => c.classList.toggle('sm', ch < 84 || gw / C.cols < 84));
  const gb = top + rows * (ch + 7);
  Object.assign(panel.style, { top: gb + 6 + 'px', bottom: '12px', left: (W - gw) / 2 + 'px', right: (W - gw) / 2 + 'px' });
  Object.assign(ask.style, { bottom: '18px', left: (W - gw) / 2 + 6 + 'px', right: (W - gw) / 2 + 6 + 'px' });
  toastEl.style.top = gb - 40 + 'px'; tipEl.style.top = gb + 14 + 'px';
  placeHand();
}
addEventListener('resize', layout);

function setWorld(w) {
  document.body.classList.remove('w1', 'w2'); if (w === 1) document.body.classList.add('w1'); if (w === 2) document.body.classList.add('w2');
  document.body.style.setProperty('--wc', WORLDS[Math.min(w, 2)].color);
}
function paintHead() {
  const tag = C.boss ? '<span class="tag" style="background:#2a2522">BOSS</span>' : C.hard ? '<span class="tag" style="background:#d9443a">HARD</span>' : '';
  const lie = C.lie ? '<span class="tag" style="background:#7b4fa3">LIARS</span>' : '';
  h1.querySelector('.ttl').innerHTML = `${tag || lie ? '' : `<em>${C.id === 'daily' ? 'DAILY' : 'CASE ' + C.id}</em>`}${tag}${lie}${C.title}`;
  h1.querySelector('.hintb').textContent = '💡 ' + hintsLeft();
}
function build(c) {
  C = c; mode = c.id === 'daily' ? 'daily' : c.id > TOTAL ? 'cold' : 'level';
  setWorld(c.world);
  known = new Array(c.truth.length).fill(-1); known[c.start] = c.truth[c.start];
  mistakes = 0; hintsUsed = 0; sel = -1; t0 = 0; combo = 0; bestCombo = 0; marks = 0; lastAct = performance.now(); recorded = false;
  grid.innerHTML = ''; cluesEl.innerHTML = ''; cards = [];
  c.people.forEach((p, i) => {
    const [r, cc] = rcOf(i), d = ce('div'); d.className = 'pc';
    d.innerHTML = `<span class="co">${LETTER[cc]}${r + 1}</span><span class="cf">⛓️</span><div class="av">${p.e}</div><div class="nm">${p.name}</div><div class="jb">${p.job}</div><div class="bd"></div>`;
    d.addEventListener('pointerdown', (e) => { e.preventDefault(); tapCard(i); });
    grid.appendChild(d); cards.push(d);
  });
  reveal(c.start, true);
  paintHead(); refresh(); closeAsk(); layout();
  ui.levels(typeof c.id === 'number' ? c.id : 1);
  if (c.id === 'daily') { ui.els.top.querySelector('[data-a]').textContent = '⭐'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  cards.forEach((e, i) => { e.style.opacity = 0; e.style.transform = 'translateY(14px)'; setTimeout(() => { e.style.opacity = 1; e.style.transform = ''; }, 40 + i * 24); });
  titleEl.innerHTML = `<i>${c.id === 'daily' ? 'DAILY CASE' : c.id > TOTAL ? 'COLD CASE' : 'CASE ' + c.id}</i><b>${c.title}</b><small>${c.id > TOTAL || c.id === 'daily' ? c.purpose : c.purpose.replace(/\s*Cannot be lost[^.]*\./i, '').replace(/^(Introduce|Practise|Twist|Test|Breather|HARD test|HARD twist|HARD|BOSS)[:\s]*/i, '')}</small>`;
  titleEl.classList.remove('go'); void titleEl.offsetWidth; titleEl.classList.add('go');
  state = 'play'; card.classList.remove('on'); mapEl.classList.remove('on'); mapClose.classList.remove('on');
  showTip(c);
  setTimeout(placeHand, 120);
}
let recorded = false;
function showTip(c) {
  tipEl.style.display = 'none'; tipShown = false;
  const seen = S.get('tips', {}); const key = 't' + c.id;
  let text = '';
  if (c.tip && !seen[key]) text = c.tip;
  if (c.lie && !seen.lie) text = 'Criminals LIE. A criminal saying "X is innocent" means X is guilty. Flip their clues.';
  if (!text) return;
  setTimeout(() => { if (C !== c) return; tipEl.textContent = text; tipEl.style.display = 'block'; tipShown = true; seen[key] = 1; if (c.lie) seen.lie = 1; S.set('tips', seen); setTimeout(() => { if (C === c) tipEl.style.display = 'none'; }, 6500); }, 1500);
}
function refresh() {
  h2.querySelectorAll('.mx i').forEach((e, i) => e.classList.toggle('on', i < mistakes));
  panel.querySelector('.cn').textContent = known.filter(v => v >= 0).length + ' / ' + known.length;
  ui.progress(known.filter(v => v >= 0).length / known.length);
}
setInterval(() => {
  if (state !== 'play' || !C) return;
  if (t0) h2.querySelector('.tm').textContent = fmtTime((performance.now() - t0) / 1000);
  // an idle player gets a nudge: on the first cases a free hand, later the hint button wiggles
  const idle = performance.now() - lastAct;
  if (C.safe || (typeof C.id === 'number' && C.id <= 2)) { if (idle > 5000) placeHand(true); }
  else if (idle > 25000 && hintsLeft() > 0) h1.querySelector('.hintb').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], 700);
}, 500);

// a hand shows the first moves of the first cases
function placeHand(force) {
  hand.style.display = 'none';
  if (!C || state !== 'play' || sel >= 0) return;
  const early = C.safe || (typeof C.id === 'number' && C.id <= 2 && marks < 4);
  if (!early && !force) return;
  const d = deducible(cons(), known); if (!d.length) return;
  const b = cards[d[0][0]].getBoundingClientRect();
  hand.style.left = b.left + b.width / 2 - 8 + 'px'; hand.style.top = b.top + b.height / 2 + 6 + 'px'; hand.style.display = 'block';
}

function reveal(i, silent = false) {
  const v = C.truth[i]; known[i] = v;
  const c = cards[i]; c.classList.add(v ? 'crim' : 'inn', 'flip'); c.querySelector('.bd').textContent = v ? 'CRIMINAL' : 'INNOCENT';
  setTimeout(() => c.classList.remove('flip'), 520);
  cluesEl.querySelectorAll('.new').forEach(e => e.classList.remove('new'));
  const liar = C.lie && v === 1, cl = ce('div'); cl.className = 'cl new' + (liar ? ' liar' : ''); cl.dataset.i = i;
  cl.innerHTML = `<span class="a">${C.people[i].e}</span><span><b>${C.people[i].name}:</b> ${C.clues[i].text}${liar ? '<span class="lt">LIES</span>' : ''}</span>`;
  cl.addEventListener('pointerdown', () => showRefs(i));
  cluesEl.prepend(cl); cluesEl.scrollTop = 0;
  if (liar && !silent) { tone(180, 0.22, 'sawtooth', 0.05, 0.5); }
  if (!silent) {
    const b = c.getBoundingClientRect(), n = 10 + Math.min(combo, 8) * 3;
    fx.sparks(b.left + b.width / 2, b.top + b.height / 2, v ? ['#c8553d', '#f0b13c', '#fff'] : ['#3f9a62', '#f0b13c', '#fff'], n, { speed: 3 + Math.min(combo, 8) * 0.25, size: 3.5 });
    if (combo >= 3) fx.ring(b.left + b.width / 2, b.top + b.height / 2, v ? '#c8553d' : '#3f9a62', 26 + combo * 2);
  }
}
let refT = 0;
function showRefs(i) {
  clearTimeout(refT); cards.forEach(c => c.classList.remove('ref'));
  for (const k of C.clues[i].cells) cards[k].classList.add('ref');
  soft.click(); refT = setTimeout(() => cards.forEach(c => c.classList.remove('ref')), 1600);
}

// ---------------------------------------------------------------- input
function tapCard(i) {
  if (state !== 'play') return;
  lastAct = performance.now(); hand.style.display = 'none';
  if (known[i] >= 0) { const cl = cluesEl.querySelector(`[data-i="${i}"]`); if (cl) { cl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); cl.animate([{ background: '#fff1cf' }, { background: '' }], 900); } showRefs(i); return; }
  cards.forEach(c => c.classList.remove('sel')); sel = i; cards[i].classList.add('sel'); soft.click();
  ask.querySelector('.q').innerHTML = `Is <b>${C.people[i].name}</b> the ${C.people[i].job} innocent or a criminal?`;
  ask.style.display = 'flex';
}
function closeAsk() { ask.style.display = 'none'; cards.forEach(c => c.classList.remove('sel')); sel = -1; }
ask.querySelector('.bi').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (sel >= 0) mark(sel, 0); });
ask.querySelector('.bc').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (sel >= 0) mark(sel, 1); });
ask.querySelector('.x').addEventListener('pointerdown', (e) => { e.stopPropagation(); closeAsk(); setTimeout(placeHand, 50); });
h1.querySelector('.hintb').addEventListener('pointerdown', (e) => { e.stopPropagation(); hint(); });
h1.querySelector('.mapb').addEventListener('pointerdown', (e) => { e.stopPropagation(); openMap(true); });

const COMBO_POP = { 3: ['SHARP ×3', '#c8553d', 34], 5: ['ON FIRE ×5', '#e0782c', 38], 8: ['UNSTOPPABLE ×8', '#7b4fa3', 40], 12: ['LEGEND ×12', '#d79a12', 44] };
function mark(i, v) {
  if (state !== 'play' || known[i] >= 0) return;
  lastAct = performance.now(); if (!t0) t0 = performance.now();
  const c = cards[i]; closeAsk();
  if (C.truth[i] !== v) {   // wrong: a mistake
    combo = 0; h2.querySelector('.cb').textContent = '';
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); soft.err(); buzz([30, 40, 30]);
    if (C.safe && C.id <= 2) { toast('Not that one yet. Re-read the clues 🔎', 2200); return; }
    mistakes++; refresh(); ui.flash(0.25);
    const left = MAXM - mistakes;
    toast(left <= 0 ? 'Three mistakes — the trail goes cold' : `Wrong call! ${left} left`);
    if (left <= 0) { const mine = C; state = 'closing'; setTimeout(() => { if (C === mine && state === 'closing') { state = 'play'; lose(); } }, 700); }
    return;
  }
  if (forced(cons(), known, i) !== v) {   // right, but not provable yet: no guessing allowed
    c.classList.remove('wob'); void c.offsetWidth; c.classList.add('wob'); soft.wood(); toast('Right, maybe — but not proven yet 🤔'); return;
  }
  combo++; bestCombo = Math.max(bestCombo, combo); marks++;
  reveal(i);
  const n = known.filter(x => x >= 0).length; chime(combo - 1, 67, 0.12); buzz(8);
  h2.querySelector('.cb').textContent = combo >= 2 ? `🔥 ×${combo}` : '';
  h2.querySelector('.cb').animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], 220);
  const cp = COMBO_POP[combo]; if (cp) { ui.pop(cp[0], cp[1], cp[2], 24); if (combo >= 5) fx.confetti(30 + combo * 4, [cp[1], '#f0b13c', '#fff']); }
  if (v === 0 && mode === 'level' && marks >= 3 && n < known.length && !hintsUsed && Math.random() < 0.1) { addHints(1); paintHead(); ui.pop('GOLDEN ALIBI +💡', '#d79a12', 36, 24); fx.confetti(50, ['#f0b13c', '#fff']); arp([79, 83, 86], 90, 0.1, 0.8); }
  refresh();
  if (n === known.length) { const mine = C; state = 'closing'; setTimeout(() => { if (C === mine && state === 'closing') { state = 'play'; win(); } }, 420); } else setTimeout(placeHand, 80);
}
function hint() {
  if (state !== 'play') return;
  lastAct = performance.now();
  if (hintsLeft() <= 0) { toast('Out of hints: clean 3⭐ cases earn more'); return; }
  const d = deducible(cons(), known); if (!d.length) return;
  const [i] = d[Math.floor(Math.random() * d.length)]; hintsUsed++; combo = 0; h2.querySelector('.cb').textContent = ''; S.set('hints', hintsLeft() - 1);
  cards[i].classList.remove('hint'); void cards[i].offsetWidth; cards[i].classList.add('hint');
  toast(`Look closely at ${C.people[i].name}`); soft.click(); paintHead();
}

// ---------------------------------------------------------------- end states
const starsFor = () => { const p = mistakes + hintsUsed; return p === 0 ? 3 : p <= 2 ? 2 : 1; };
function win() {
  if (state !== 'play') return;
  state = 'won'; hand.style.display = 'none';
  const st = starsFor(), secs = t0 ? (performance.now() - t0) / 1000 : 0, id = C.id;
  const oldRank = rankOf(totalStars());
  let first = false, gain = 0;
  if (mode === 'level') { const p = prog(); first = !p[id]; gain = Math.max(0, st - (p[id] || 0)); if (st > (p[id] || 0)) { p[id] = st; S.set('p', p); } }
  if (mode === 'cold') { const p = S.get('cp', {}); first = !p[id]; if (st > (p[id] || 0)) { p[id] = st; S.set('cp', p); } if (first) S.set('cold', S.get('cold', 0) + 1); }
  let earned = 0;
  if (st === 3 && (first || gain)) { earned = 1; addHints(1); }
  if (mode === 'daily') { const k = 'daily_' + todayKey(), prev = S.get(k, null); first = !prev; if (!prev || st > prev.s) S.set(k, { s: st }); }
  if (!recorded) { recorded = true; if (first || mode === 'level') { if (first) B.submit(1); } }
  const newRank = rankOf(totalStars()), ranked = newRank > oldRank; if (ranked) addHints(2);
  // a whole world cleared
  const wDone = mode === 'level' && first && id % 10 === 0;
  if (wDone) addHints(3);
  fx.confetti(140, ['#c8553d', '#3f9a62', '#f0b13c', '#2a2522', '#fff']); arp([67, 71, 74, 79, 83], 100, 0.12, 0.9); buzz([20, 60, 20]);
  // the culprits are cuffed one by one
  const crim = C.truth.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const mineC = C;
  crim.forEach((i, k) => setTimeout(() => { if (C !== mineC) return; cards[i].classList.add('cuffed'); tone(300 + k * 70, 0.08, 'square', 0.05, 0.7); const b = cards[i].getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#2a2522', '#f0b13c'], 8, { speed: 2.5 }); }, 120 + k * 110));
  const delay = (mode === 'level' && id <= 4 ? 450 : 700) + crim.length * 110;
  const mineW = C; setTimeout(() => C === mineW && showWin({ st, secs, first, earned, ranked, newRank, wDone, crim: crim.length }), delay);
}
function showWin(r) {
  const id = C.id, sticker = typeof id === 'number' && id <= TOTAL ? EVIDENCE[id - 1] : '🔎';
  const ts = totalStars(), cur = RANKS[rankOf(ts)], nxt = RANKS[rankOf(ts) + 1];
  const isDaily = mode === 'daily', hasNext = !isDaily;
  const nextId = mode === 'level' ? (id < TOTAL ? id + 1 : TOTAL + 1 + S.get('cold', 0)) : mode === 'cold' ? id + 1 : null;
  card.className = 'card on';
  card.innerHTML = `<div class="in"><div class="sub">${isDaily ? 'DAILY CASE' : id > TOTAL ? 'COLD CASE' : 'CASE ' + id} · ${C.title.toUpperCase()}</div><h1>Case closed!</h1>
  <div class="stars"><span>⭐</span><span>⭐</span><span>⭐</span></div>
  <div class="stk"><em>${sticker}</em>${r.first ? 'New evidence' : 'Evidence'}${r.st === 3 ? ' · gold' : ''}</div>
  <div class="row">${r.crim} criminals caught · ${mistakes} mistake${mistakes === 1 ? '' : 's'} · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} · ${fmtTime(r.secs)}${bestCombo >= 3 ? ` · best streak ×${bestCombo}` : ''}</div>
  ${r.earned ? '<div class="row" style="color:#3f9a62">💡 +1 hint for a clean solve</div>' : r.st < 3 && mode === 'level' ? '<div class="row" style="opacity:.6">Clean solve (no mistakes, no hints) = ⭐⭐⭐ and a free hint</div>' : ''}
  ${r.ranked ? `<div class="row" style="color:${ACCENT};font-size:16px">🎖 New rank: ${RANKS[r.newRank][1]}! +2 hints</div>` : ''}
  ${r.wDone ? `<div class="row" style="color:#7b4fa3;font-size:16px">🏙 ${WORLDS[Math.min(2, Math.floor((id - 1) / 10))].name} cleared! +3 hints</div>` : ''}
  <div class="row" style="margin-top:8px">${cur[1]}${nxt ? ` · ${nxt[0] - ts}⭐ to ${nxt[1]}` : ' · top rank'}</div>
  <div class="bar"><i style="width:${nxt ? Math.round(((ts - cur[0]) / (nxt[0] - cur[0])) * 100) : 100}%"></i></div>
  <div class="btns"><button class="mp">🗺</button>${isDaily ? '<button class="sh">Share</button><button class="pri nx">Cases ▶</button>' : '<button class="rp">🔁</button><button class="pri nx">Next case ▶</button>'}</div></div>`;
  const sp = card.querySelectorAll('.stars span');
  sp.forEach((s, k) => { if (k < r.st) setTimeout(() => { s.classList.add('on'); tone(520 + k * 160, 0.18, 'triangle', 0.1, 1.2); }, 350 + k * 330); });
  card.querySelector('.mp').addEventListener('pointerdown', () => openMap());
  const rp = card.querySelector('.rp'); if (rp) rp.addEventListener('pointerdown', () => start(C.id));
  const sh = card.querySelector('.sh'); if (sh) sh.addEventListener('pointerdown', () => shareIt(r.st));
  card.querySelector('.nx').addEventListener('pointerdown', () => { if (isDaily) openMap(); else start(nextId); });
  const bar = card.querySelector('.bar i'); const w = bar.style.width; bar.style.width = '0'; setTimeout(() => bar.style.width = w, 300);
}
function shareIt(st) {
  const u = new URL(location.href); u.search = '';
  const text = `I closed today's case with ${'⭐'.repeat(st)} in ${NAME}. Can you?`;
  try { if (navigator.share) { navigator.share({ title: NAME, text, url: u.href }); return; } navigator.clipboard.writeText(`${text} ${u.href}`); toast('Link copied'); } catch (e) {}
}
function stuckLine() {
  const dd = deducible(cons(), known); if (!dd.length) return '';
  const [i] = dd[0], cl = C.clues[i], src = known.findIndex((v, k) => v >= 0 && C.clues[k] && C.clues[k].cells.includes(i));
  return `<div class="row" style="color:#7b4fa3">You could have proven <b>${C.people[i].name}</b>${src >= 0 ? ' from ' + C.people[src].name + '\'s clue' : ''}.</div>`;
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; hand.style.display = 'none';
  const have = known.filter(x => x >= 0).length, all = known.length, left = all - have;
  card.className = 'card on lose';
  card.innerHTML = `<div class="in"><div class="sub">${C.id === 'daily' ? 'DAILY CASE' : 'CASE ' + C.id} · ${C.title.toUpperCase()}</div><h1>The trail went cold</h1>
  <div class="row" style="font-size:16px;margin:10px 0">${left <= 4 ? `SO CLOSE: ${left} left!` : `${have} of ${all} people cleared`}</div>
  ${stuckLine()}
  <div class="row" style="opacity:.6">${C.lie ? 'Remember: a criminal\'s clue is false. Flip it.' : 'Tap a clue to light up the people it talks about.'}</div>
  <div class="btns"><button class="mp">🗺</button><button class="pri rt">Try again 🔁</button></div></div>`;
  card.querySelector('.mp').addEventListener('pointerdown', () => openMap());
  card.querySelector('.rt').addEventListener('pointerdown', () => start(C.id));
}

// ---------------------------------------------------------------- the case map
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function openMap(fromGame) {
  const ts = totalStars(), ri = rankOf(ts), cur = RANKS[ri], nxt = RANKS[ri + 1], doneToday = S.get('daily_' + todayKey(), null), nid = nextOpen();
  const d = new Date();
  let html = `<div class="mp-top"><div class="mp-rank"><div class="bg">🎖</div><div class="rt"><b>${cur[1]}</b> <small>${ts}⭐ · ${solvedCount()}/${TOTAL} cases</small><div class="rb"><i style="width:${nxt ? Math.round(((ts - cur[0]) / (nxt[0] - cur[0])) * 100) : 100}%"></i></div><small>${nxt ? nxt[0] - ts + '⭐ to ' + nxt[1] : 'top rank'}</small></div><div class="mp-hint">💡 ${hintsLeft()}</div></div></div>
  <button class="mp-daily ${doneToday ? 'done' : ''}"><div class="cal"><i>${MON[d.getMonth()]}</i><em>${d.getDate()}</em></div><div><b>Case of the Day${D.streak > 1 ? ' · 🔥' + D.streak : ''}</b><span>${doneToday ? 'Solved today ' + '⭐'.repeat(doneToday.s) + ' · same case for everyone' : 'Same case for everyone today'}</span></div></button>`;
  WORLDS.forEach((w, wi) => {
    const ls = LEVELS.filter(L => L.world === wi), done = ls.filter(L => stars(L.id)).length;
    html += `<div class="wd" style="--c:${w.color}"><span class="cnt">${done}/10</span><h2>${w.name}</h2><p>${w.sub}</p><div class="nodes">`;
    for (const L of ls) {
      const s = stars(L.id), open = unlocked(L.id), cls = ['nd', s ? 'done' : open ? (L.id === nid ? 'next' : '') : 'lock', L.hard ? 'hard' : '', L.boss ? 'boss' : '', L.lie ? 'lie' : ''].join(' ');
      html += `<div class="${cls}" data-id="${L.id}">${s ? EVIDENCE[L.id - 1] : open ? L.id : '🔒'}${s ? `<span class="st ${s === 3 ? 'g' : ''}">${'⭐'.repeat(s)}</span>` : ''}</div>`;
    }
    html += '</div></div>';
  });
  const cold = S.get('cold', 0);
  html += `<div class="mp-cold" data-cold="1"><div>Cold Cases<span>${solvedCount() >= TOTAL ? 'Endless new cases from the files' : 'Opens when the 30 cases are solved'} · ${cold} solved</span></div><div style="font-size:22px">${solvedCount() >= TOTAL ? '▶' : '🔒'}</div></div>`;
  mapEl.innerHTML = html; mapEl.classList.add('on'); card.classList.remove('on');
  mapClose.textContent = (fromGame && state === 'play') ? 'Back to case' : 'Play next case ▶'; mapClose.classList.add('on'); mapClose.dataset.go = (fromGame && state === 'play') ? '' : '1';
  mapEl.querySelectorAll('.nd').forEach(n => n.addEventListener('pointerdown', () => { const id = +n.dataset.id; if (n.classList.contains('lock')) { toast('Solve case ' + (id - 1) + ' first'); soft.wood(); return; } start(id); }));
  mapEl.querySelector('.mp-daily').addEventListener('pointerdown', () => start('daily'));
  mapEl.querySelector('.mp-cold').addEventListener('pointerdown', () => { if (solvedCount() >= TOTAL) start(TOTAL + 1 + cold); else { toast('Solve all 30 cases to open the cold files'); soft.wood(); } });
  const nx = mapEl.querySelector('.nd.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
}
mapClose.addEventListener('pointerdown', () => { mapEl.classList.remove('on'); mapClose.classList.remove('on'); if (mapClose.dataset.go === '1') start(Math.min(nextOpen(), TOTAL + S.get('cold', 0) + 1)); });
addEventListener('keydown', e => { if (e.key === 'Escape') { mapEl.classList.remove('on'); mapClose.classList.remove('on'); } });

function start(id) {
  B.start();
  if (id === 'daily') build(dailyCase());
  else if (id > TOTAL) build(coldCase(id));
  else build(fromLevel(LEVELS[id - 1]));
}

// first open: straight into the next case (no menu); a returning player lands in the next unsolved case too
{ const nid = nextOpen(); if (Q.get('daily') === '1') start('daily'); else if (Q.get('case')) start(Math.max(1, Math.min(TOTAL, +Q.get('case')))); else start(Math.min(nid, TOTAL + S.get('cold', 0) + 1)); }

// ---------------------------------------------------------------- test hook: the bot marks one provable person per call
window.__game = {
  get state() { return state; }, get level() { return C ? C.id : 0; }, get stars() { return totalStars(); }, get mistakes() { return mistakes; }, get hints() { return hintsUsed; },
  start, openMap, get case() { return C; },
  bot() { if (state !== 'play') return false; const d = deducible(cons(), known); if (!d.length) return false; const [i, v] = d[0]; mark(i, v); return true; },
  wrong() { if (state !== 'play') return; const i = known.findIndex(v => v < 0); if (i >= 0) mark(i, 1 - C.truth[i]); },
};
