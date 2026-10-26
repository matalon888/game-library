// Bunchwise — original word-groups puzzle. Sixteen words hide four sets; pick four, check them, and the group locks in
// with its colour (gold easiest → plum trickiest). Four mistakes allowed; a near miss tells you three of them belong.
// All 125 boards are hand-written for this game (puzzles.js). ?daily=1 = today's board for everyone.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { PUZZLES } from './puzzles.js';
import * as kitBoard from './kit/board.js';   // `board` is a local name here
import { demo } from './kit/demo.js';
const LB = kitBoard.board({ game: 'bunchwise', label: 'Puzzles solved', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Bunchwise: Word Groups Puzzle';
const S = store('bunchwise');
const F = flow('bunchwise');
const ui = createUI({ title: 'Bunchwise', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#7a5cc8' });
const D = daily('bunchwise', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily word groups' : 'four hidden sets', doneLine: doneToday ? (doneToday.w ? `Solved today · ${doneToday.m} mistake${doneToday.m === 1 ? '' : 's'}` : 'Played today') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily board<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Sorted!';
ui.els.lose.querySelector('.hint').textContent = 'Tap for the next board';

const COLORS = [{ bg: '#f5cd57', fg: '#4a3a08', emo: '🟨' }, { bg: '#93d6a9', fg: '#163f27', emo: '🟩' }, { bg: '#a3c6f3', fg: '#14335a', emo: '🟦' }, { bg: '#c8a6ec', fg: '#38195e', emo: '🟪' }];
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffled(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const ORDER = shuffled(PUZZLES.map((_, i) => i), rngf(90210));   // fixed play order for practice boards

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#2f2a3d}
body{background:radial-gradient(120% 80% at 50% 0%,#fffaf2 0%,#f6f0ff 60%,#ece4fb 100%)}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#7a5cc8;box-shadow:0 2px 6px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:#fff;color:#7a5cc8}.hc-top .hc-bar{background:rgba(60,40,100,.1);height:8px}.hc-top .hc-bar i{background:#7a5cc8}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;color:#8a7fa3;text-shadow:none;opacity:1}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(46,30,82,.8),rgba(30,20,56,.88))}
#lead{position:fixed;left:0;right:0;text-align:center;z-index:2;transition:opacity .2s;font-size:15px;font-weight:600;color:#5f5776}
#board{position:fixed;z-index:2}
.tile{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:12px;background:#efe8da;color:#2f2a3d;font-weight:800;letter-spacing:.3px;cursor:pointer;user-select:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.06);transition:left .42s cubic-bezier(.4,1.3,.5,1),top .42s cubic-bezier(.4,1.3,.5,1),background .15s,color .15s,transform .15s;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif;padding:0 3px;line-height:1.05;white-space:nowrap;overflow:hidden}
.tile:active{transform:scale(.95)}
.tile.on{background:#5b5374;color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}
.tile.hop{animation:hop .32s ease}
.tile.shake{animation:shake .4s}
@keyframes hop{40%{transform:translateY(-12px)}}
@keyframes shake{15%{transform:translateX(-7px)}30%{transform:translateX(6px)}45%{transform:translateX(-5px)}60%{transform:translateX(4px)}75%{transform:translateX(-2px)}}
.bar{position:absolute;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;animation:barIn .45s cubic-bezier(.3,1.5,.5,1);box-shadow:inset 0 -3px 0 rgba(0,0,0,.08)}
.bar b{font-size:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
.bar span{font-size:14px;font-weight:600;margin-top:2px;opacity:.9}
@keyframes barIn{0%{transform:scale(.85);opacity:.3}100%{transform:scale(1);opacity:1}}
#mist{position:fixed;left:0;right:0;z-index:2;display:flex;justify-content:center;align-items:center;gap:8px;font-size:15px;font-weight:600;color:#5f5776}
#mist i{width:13px;height:13px;border-radius:50%;background:#5b5374;display:inline-block;transition:transform .3s,background .3s}
#mist i.gone{background:transparent;box-shadow:inset 0 0 0 2px #cfc6e0;transform:scale(.7)}
#btns{position:fixed;left:0;right:0;z-index:2;display:flex;justify-content:center;gap:10px}
#btns button{font:inherit;font-weight:800;font-size:15px;height:46px;padding:0 18px;border-radius:23px;border:2px solid #2f2a3d;background:#fff;color:#2f2a3d;cursor:pointer;transition:opacity .2s,transform .1s}
#btns button:active{transform:scale(.95)}
#btns button.go{background:#2f2a3d;color:#fff}
#btns button[disabled]{opacity:.35;pointer-events:none}
#toast{position:fixed;left:50%;z-index:9;transform:translateX(-50%) translateY(-6px);background:#2f2a3d;color:#fff;font-weight:700;font-size:15px;padding:9px 16px;border-radius:12px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.2)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#pts{position:fixed;z-index:6;right:12px;top:calc(46px + env(safe-area-inset-top));height:30px;border-radius:16px;font-weight:800;font-size:13px;padding:0 12px;display:flex;align-items:center;background:#fff;color:#7a5cc8;box-shadow:0 2px 8px rgba(60,40,100,.12)}
`);
const lead = document.createElement('div'); lead.id = 'lead'; lead.textContent = 'Find the four hidden sets'; document.body.appendChild(lead);
const board = document.createElement('div'); board.id = 'board'; document.body.appendChild(board);
const mist = document.createElement('div'); mist.id = 'mist'; document.body.appendChild(mist);
const btns = document.createElement('div'); btns.id = 'btns'; btns.innerHTML = '<button data-a="shuffle">Mix</button><button data-a="clear">Clear</button><button data-a="submit" class="go">Check</button>'; document.body.appendChild(btns);
const toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast);
const ptsEl = document.createElement('div'); ptsEl.id = 'pts'; document.body.appendChild(ptsEl);
const B = Object.fromEntries([...btns.children].map(b => [b.dataset.a, b]));
let toastT = 0;
function say(t, ms = 1500) { toast.textContent = t; toast.classList.add('show'); lead.style.opacity = 0; clearTimeout(toastT); toastT = setTimeout(() => { toast.classList.remove('show'); lead.style.opacity = 1; }, ms); }

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), points = S.get('points', 0), P, puzzleNo = 1, order = [], tiles = {}, picked = new Set(), solved = [], tries = [], guesses = new Set(), mistakesMax = 4, mistakes = 0, busy = false, recorded = false, beatenShown = false, geo = {};
const dayNo = () => Math.floor(Date.UTC(Math.floor(D.seed / 10000), Math.floor(D.seed / 100) % 100 - 1, D.seed % 100) / 864e5);
function build() {
  const idx = D.isDaily ? ORDER[(dayNo() * 7 + 3) % ORDER.length] : ORDER[(level - 1) % ORDER.length];
  puzzleNo = idx + 1; P = PUZZLES[idx].map((g, i) => ({ ...g, i }));
  // flow: steady solvers get one fewer mistake, players who keep missing get one more (3..5, 4 is the norm)
  mistakesMax = D.isDaily ? 4 : Math.max(3, Math.min(5, Math.round(4 / F.k())));
  const r = rngf((D.seed || level * 977) + 5);
  order = shuffled(P.flatMap(g => g.words), r);
  picked = new Set(); solved = []; tries = []; guesses = new Set(); mistakes = 0; busy = false; recorded = false; beatenShown = false;
  board.innerHTML = ''; tiles = {};
  for (const w of order) {
    const t = document.createElement('div'); t.className = 'tile'; t.textContent = w; t.dataset.w = w;
    t.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggle(w); });
    board.appendChild(t); tiles[w] = t;
  }
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const d = new Date();
  ui.sub(D.isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `Board #${level}`);
  layout(); hud();
}
function layout() {
  const W = innerWidth, H = innerHeight, bw = Math.min(W - 24, 480), gap = 8;
  const tw = (bw - gap * 3) / 4, th = Math.min(90, Math.max(58, (H - 320) / 4 - gap));
  const bh = th * 4 + gap * 3;
  const top = Math.max(118, (H - bh - 132) / 2 + 34);
  Object.assign(board.style, { left: (W - bw) / 2 + 'px', top: top + 'px', width: bw + 'px', height: bh + 'px' });
  geo = { tw, th, gap, bw };
  lead.style.top = top - 34 + 'px';
  mist.style.top = top + bh + 18 + 'px';
  btns.style.top = top + bh + 52 + 'px';
  toast.style.top = top - 44 + 'px';
  board.querySelectorAll('.bar').forEach((b, i) => Object.assign(b.style, { left: 0, top: i * (th + gap) + 'px', width: bw + 'px', height: th + 'px' }));
  order.forEach((w, k) => {
    const t = tiles[w]; if (!t) return; const slot = solved.length * 4 + k, row = Math.floor(slot / 4), col = slot % 4;
    const fs = fit(w, tw - 12);
    Object.assign(t.style, { left: col * (tw + gap) + 'px', top: row * (th + gap) + 'px', width: tw + 'px', height: th + 'px', fontSize: fs + 'px' });
  });
}
addEventListener('resize', () => P && layout());
const mctx = document.createElement('canvas').getContext('2d');
function fit(w, room) { mctx.font = "800 16px ui-rounded,'SF Pro Rounded',system-ui,sans-serif"; const m = mctx.measureText(w).width + w.length * 0.3; return Math.max(9, Math.min(17, 16 * room / m)); }
function hud() {
  mist.innerHTML = 'Slips left: ' + Array.from({ length: mistakesMax }, (_, i) => `<i class="${i < mistakesMax - mistakes ? '' : 'gone'}"></i>`).join('');
  B.submit.disabled = picked.size !== 4 || busy; B.clear.disabled = !picked.size || busy;
  ptsEl.textContent = `★ ${points.toLocaleString()}`;
  ui.progress(solved.length / 4);
}
function toggle(w) {
  if (state !== 'play' || busy) return;
  const t = tiles[w];
  if (picked.has(w)) { picked.delete(w); t.classList.remove('on'); soft.click(); }
  else if (picked.size < 4) { picked.add(w); t.classList.add('on'); soft.wood(); buzz(4); }
  hud();
}
btns.addEventListener('pointerdown', (e) => {
  e.stopPropagation(); const a = e.target.closest('button')?.dataset.a; if (!a || state !== 'play' || busy) return;
  if (a === 'shuffle') { order = shuffled(order, Math.random); layout(); soft.swish(); }
  if (a === 'clear') { for (const w of picked) tiles[w].classList.remove('on'); picked.clear(); soft.click(); hud(); }
  if (a === 'submit') submit();
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on puzzle 1, until the first real touch,
// two random words light up as if tapped and then let go (no guess is sent, nothing is given away), so the grid shows it is tappable
const demoPick = [];
demo((n) => {
  if (n === 3) { for (const w of demoPick) if (picked.has(w)) toggle(w); return; }
  const free = order.filter(w => tiles[w] && !picked.has(w) && !solved.some(g => g.words.includes(w))); if (!free.length) return false;
  const w = free[Math.floor(Math.random() * free.length)]; demoPick.push(w); toggle(w);
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !busy && !solved.length, wait: 1800, every: 900, max: 3 });

function submit() {
  if (picked.size !== 4 || busy) return;
  const sel = [...picked], key = sel.slice().sort().join('|');
  if (guesses.has(key)) { say('You tried that set already'); soft.err(); return; }
  guesses.add(key); busy = true; hud();
  // hop the picked tiles in board order
  const inOrder = order.filter(w => picked.has(w));
  inOrder.forEach((w, i) => setTimeout(() => { const t = tiles[w]; t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop'); chime(i + 1, 67, 0.07); }, i * 110));
  const hit = P.find(g => !solved.includes(g) && g.words.every(w => picked.has(w)));
  tries.push(sel.map(w => P.find(g => g.words.includes(w)).i));
  setTimeout(() => {
    if (hit) return solve(hit, true);
    const best = Math.max(...P.filter(g => !solved.includes(g)).map(g => g.words.filter(w => picked.has(w)).length));
    mistakes++; soft.err(); buzz([30, 40, 30]);
    sel.forEach(w => { const t = tiles[w]; t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); });
    if (best === 3) say('So close — three of those belong');
    hud(); busy = false; hud();
    if (mistakes >= mistakesMax) lose();
  }, inOrder.length * 110 + 260);
}
function solve(g, byPlayer) {
  // slide the group's tiles into the next free row, then fuse them into a coloured bar
  order = [...g.words.filter(w => tiles[w]), ...order.filter(w => !g.words.includes(w))];
  for (const w of g.words) tiles[w].classList.remove('on');
  picked.clear(); layout();
  setTimeout(() => {
    for (const w of g.words) { tiles[w].remove(); delete tiles[w]; }
    order = order.filter(w => !g.words.includes(w));
    solved.push(g);
    const c = COLORS[g.i], bar = document.createElement('div'); bar.className = 'bar';
    bar.style.background = c.bg; bar.style.color = c.fg; bar.innerHTML = `<b></b><span></span>`;
    bar.querySelector('b').textContent = g.name; bar.querySelector('span').textContent = g.words.join(', ');
    board.appendChild(bar); layout();
    if (byPlayer) {
      const r = bar.getBoundingClientRect(); fx.sparks(r.left + r.width / 2, r.top + r.height / 2, ['#fff', c.bg], 16, { speed: 4, size: 3 });
      arp([67 + g.i * 2, 71 + g.i * 2, 74 + g.i * 2], 70, 0.1); buzz(14);
      const pts = (g.i + 1) * 10; points += pts; S.set('points', points);
      if (g.i === 3 && solved.length < 4) ui.pop('Sharp!', '#7a5cc8', 30, 9);
      checkBeat();
    }
    busy = false; hud();
    if (byPlayer && solved.length === 4) setTimeout(win, 350);
  }, 480);
}
function checkBeat() { if (!beatenShown && D.beaten(points)) { beatenShown = true; ui.pop('BEATEN!', '#c0573f', 40, 14); fx.confetti(60); } }
function shareGrid() { return tries.map(t => t.map(i => COLORS[i].emo).join('')).join('\n'); }
function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); LB.submit(1); }
  const bonus = (mistakesMax - mistakes) * 10; points += bonus; S.set('points', points); hud();
  arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const d = new Date(), tag = D.isDaily ? `the ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()} daily board` : `board #${level}`;
  D.won(points, `sorted ${tag} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}\n${shareGrid()}\nand scored`);
  if (D.isDaily) S.set('daily_' + todayKey(), { w: 1, m: mistakes });
  else { level++; S.set('level', level); }
  ui.win(D.isDaily ? '' : level - 1, `${mistakes ? mistakes + ' mistake' + (mistakes === 1 ? '' : 's') : 'Perfect — no mistakes'} · ★ ${points.toLocaleString()}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; busy = true;
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, solved.length / 4); }
  if (D.isDaily && !S.get('daily_' + todayKey(), null)) S.set('daily_' + todayKey(), { w: 0, m: mistakes });
  const rest = P.filter(g => !solved.includes(g));
  rest.forEach((g, i) => setTimeout(() => solve(g, false), 300 + i * 700));
  if (!D.isDaily) { level++; S.set('level', level); }   // the answers are shown, so the next board is a fresh one
  setTimeout(() => ui.lose('Next time!', 'Here are the groups you missed'), 300 + rest.length * 700 + 400);
}
ui.onTap((which) => {
  LB.start();
  if (which === 'start') { state = 'play'; return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot picks a group tile by tile, then submits
let botPlan = null;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return points; },
  bot() {
    if (state !== 'play' || busy) return;
    if (!botPlan) {
      const open = P.filter(g => !solved.includes(g));
      if (!open.length) return;
      let words = open[0].words.slice();
      // now and then try a near miss first, the way people do
      if (!mistakes && open.length > 1 && Math.random() < 0.35) words = [...words.slice(0, 3), open[1].words[0]];
      botPlan = words;
      for (const w of [...picked]) toggle(w);
    }
    const next = botPlan.find(w => !picked.has(w));
    if (next) toggle(next); else { botPlan = null; submit(); }
  },
};
