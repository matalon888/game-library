// Hunch — original five-letter word guessing game. Six tries; tiles turn green (right spot), gold (in the word) or slate (not in it).
// Daily word for everyone (?daily=1) plus endless practice. Answers come from our common-word list (words.js, SCOWL licence inside).
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { WORDS } from './words.js';

const NAME = 'Hunch: Five Letter Word Guess';
const S = store('hunch');
const F = flow('hunch');
let hard = S.get('hard', false);
const ui = createUI({ title: 'Hunch', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#3f8f63' });
const D = daily('hunch', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily five-letter word' : 'five-letter word guess',
  doneLine: doneToday ? (doneToday.g ? `Solved today in ${doneToday.g}/6` : 'Played today') : null,
  chips: { items: ['Normal', 'Hard mode'], get: () => (hard ? 1 : 0), set: (i) => { hard = !!i; S.set('hard', hard); hardBtn && paintHard(); } },
});
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily word<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Got it!';
ui.els.lose.querySelector('.hint').textContent = 'Tap for a new word';

// ---------------------------------------------------------------- words
const BLOCK = new Set('drunk idiot moron bigot booze devil sexes sexed rapes sluts pussy kills death dying curse damns enema opium vomit lynch naked bosom booty kinky lager cocks butts tipsy demon witch gonna dunno kinda lemme sorta gimme sades color honor humor labor favor valor rumor tumor vapor savor armor ardor odors lorry maths datum ditto leach flied halon nuder muter coyer rifer apter direr dimer sizer liker lamer haler octal infix aping axing acing awing cuing ruing eking hippy sissy ninny pokey'.split(' '));
// fine to guess, but never the answer (grown-up themes, or spelled differently in the US and the UK)
const NOT_ANSWER = new Set('arson bawdy booby buxom cigar drown lover belch bowel bible deity vicar roman sigma colic meter pence fiver crime flesh blood skull abyss bully brawl bribe'.split(' '));
const FIVE = WORDS.filter(w => w.length === 5 && /^[a-z]+$/.test(w) && !BLOCK.has(w));
const VALID = new Set(FIVE);
const ALL = new Set(WORDS);
// answers: no plain plurals or past tenses, most common first
const ANSWERS = FIVE.filter(w => !(w.endsWith('s') && ALL.has(w.slice(0, -1))) && !(w.endsWith('ed') && (ALL.has(w.slice(0, -2)) || ALL.has(w.slice(0, -1)))) && !w.endsWith('es') && !NOT_ANSWER.has(w));

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** 2 = right spot, 1 = in the word, 0 = not in it (duplicates handled like the real thing) */
function score(guess, ans) {
  const r = [0, 0, 0, 0, 0], left = {};
  for (let i = 0; i < 5; i++) { if (guess[i] === ans[i]) r[i] = 2; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (!r[i] && left[guess[i]]) { r[i] = 1; left[guess[i]]--; }
  return r;
}

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#2b2a33}
body{background:radial-gradient(120% 70% at 50% 0%,#fffaf1 0%,#f5efe4 55%,#ece4d4 100%)}
body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(120,100,70,.07) 1px,transparent 1.2px);background-size:14px 14px;pointer-events:none}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#3f8f63;box-shadow:0 2px 6px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:#fff;color:#3f8f63}.hc-top .hc-bar{background:rgba(60,50,30,.1);height:8px}.hc-top .hc-bar i{background:#3f8f63}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;color:#8a7f6c;text-shadow:none;opacity:1}
#board{position:fixed;left:0;right:0;z-index:2;display:grid;justify-content:center}
.row{display:grid;grid-template-columns:repeat(5,var(--ts));gap:var(--tg);margin-bottom:var(--tg)}
.row.shake{animation:shake .42s}
.row.jump .tl{animation:jump .5s cubic-bezier(.3,1.6,.5,1) both}
.tl{width:var(--ts);height:var(--ts);perspective:500px}
.tl .in{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.45,.05,.4,1)}
.tl.flip .in{transform:rotateX(180deg)}
.tl .fa{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:12px;backface-visibility:hidden;-webkit-backface-visibility:hidden;font-weight:800;font-size:calc(var(--ts) * .52);text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
.tl .fr{background:#fffdf8;border:2px solid #e2d9c8;box-shadow:inset 0 -3px 0 rgba(0,0,0,.04);color:#2b2a33;transition:border-color .12s,transform .12s}
.tl.typed .fr{border-color:#9c917c;animation:pop .14s ease-out}
.tl .bk{transform:rotateX(180deg);color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.18);box-shadow:inset 0 -4px 0 rgba(0,0,0,.14),0 4px 10px rgba(0,0,0,.1)}
.c2{background:#4c9a6a}.c1{background:#e0ad3a}.c0{background:#7f8291}
@keyframes pop{50%{transform:scale(1.1)}}
@keyframes jump{0%{transform:translateY(0)}40%{transform:translateY(-26px)}70%{transform:translateY(4px)}100%{transform:translateY(0)}}
@keyframes shake{15%{transform:translateX(-9px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
#kb{position:fixed;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 6px}
#kb .kr{display:flex;gap:5px;width:100%;max-width:500px;justify-content:center}
#kb button{flex:1;max-width:46px;height:var(--kh);border:0;border-radius:9px;background:#fffdf8;color:#2b2a33;font:inherit;font-weight:800;font-size:17px;text-transform:uppercase;box-shadow:0 3px 0 #d6ccb9,0 4px 10px rgba(80,60,30,.08);cursor:pointer;transition:background .25s,color .25s,transform .08s;padding:0;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
#kb button.wide{max-width:66px;flex:1.5;font-size:13px;letter-spacing:.5px}
#kb button:active{transform:translateY(2px);box-shadow:0 1px 0 #d6ccb9}
#kb button.k2{background:#4c9a6a;color:#fff;box-shadow:0 3px 0 #387552}#kb button.k1{background:#e0ad3a;color:#fff;box-shadow:0 3px 0 #b88a24}#kb button.k0{background:#a7a9b4;color:#fff;box-shadow:0 3px 0 #85879a}
#kb svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle}
#toast{position:fixed;left:50%;z-index:9;transform:translateX(-50%) translateY(-6px);background:#2b2a33;color:#fff;font-weight:700;font-size:15px;padding:9px 16px;border-radius:12px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.2)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.pillbtn{position:fixed;z-index:6;top:calc(46px + env(safe-area-inset-top));height:30px;border-radius:16px;border:0;font:inherit;font-weight:800;font-size:12px;letter-spacing:1px;padding:0 12px;cursor:pointer;background:#fffdf8;color:#8a7f6c;box-shadow:0 2px 8px rgba(80,60,30,.12)}
#hardBtn{left:12px}#hardBtn.on{background:#c0573f;color:#fff}#hardBtn.lock{opacity:.55}
#pts{right:12px;pointer-events:none;color:#3f8f63}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(24,58,42,.78),rgba(20,40,32,.86))}
`);
const board = document.createElement('div'); board.id = 'board'; document.body.appendChild(board);
const kb = document.createElement('div'); kb.id = 'kb'; document.body.appendChild(kb);
const toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast);
const hardBtn = document.createElement('button'); hardBtn.className = 'pillbtn'; hardBtn.id = 'hardBtn'; document.body.appendChild(hardBtn);
const ptsEl = document.createElement('div'); ptsEl.className = 'pillbtn'; ptsEl.id = 'pts'; ptsEl.style.display = 'flex'; ptsEl.style.alignItems = 'center'; document.body.appendChild(ptsEl);
function paintHard() { hardBtn.textContent = hard ? 'HARD ●' : 'HARD ○'; hardBtn.classList.toggle('on', hard); hardBtn.classList.toggle('lock', row > 0 && state === 'play'); }
hardBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state !== 'play') return; if (row > 0) { say('Hard mode can only change before your first guess'); return; } hard = !hard; S.set('hard', hard); paintHard(); soft.click(); say(hard ? 'Hard mode: every clue must be reused' : 'Normal mode'); });

let toastT = 0;
function say(t, ms = 1400) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), ms); }

const KEYS = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'];
const keyEl = {};
for (const r of KEYS) {
  const d = document.createElement('div'); d.className = 'kr';
  for (const ch of r) {
    const b = document.createElement('button');
    if (ch === '>') { b.textContent = 'ENTER'; b.className = 'wide'; b.dataset.k = 'enter'; }
    else if (ch === '<') { b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6"/></svg>'; b.className = 'wide'; b.dataset.k = 'back'; }
    else { b.textContent = ch; b.dataset.k = ch; keyEl[ch] = b; }
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); press(b.dataset.k); });
    d.appendChild(b);
  }
  kb.appendChild(d);
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Enter') press('enter'); else if (e.key === 'Backspace') press('back'); else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
});

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), points = S.get('points', 0), answer = '', row = 0, cur = '', rows = [], marks = [], keyState = {}, busy = false, recorded = false, beatenShown = false;
let tiles = [];

function pickAnswer() {
  if (D.isDaily) { const pool = ANSWERS.slice(0, 900); return pool[Math.floor(rngf(D.seed * 31 + 7)() * pool.length)]; }
  // flow: a steady player gets rarer words (a deeper slice of the common-first list); a struggling one gets commoner words
  const depth = Math.max(420, Math.min(1100, Math.round(700 * F.k())));
  const pool = ANSWERS.slice(0, depth), r = rngf(level * 7919 + 13);
  r(); return pool[Math.floor(r() * pool.length)];
}
function build() {
  answer = pickAnswer(); row = 0; cur = ''; rows = []; marks = []; keyState = {}; busy = false; recorded = false; beatenShown = false;
  board.innerHTML = ''; tiles = [];
  for (let r = 0; r < 6; r++) {
    const rd = document.createElement('div'); rd.className = 'row'; const rt = [];
    for (let c = 0; c < 5; c++) { const t = document.createElement('div'); t.className = 'tl'; t.innerHTML = '<div class="in"><div class="fa fr"></div><div class="fa bk"></div></div>'; rd.appendChild(t); rt.push(t); }
    board.appendChild(rd); tiles.push(rt);
  }
  for (const k in keyEl) keyEl[k].className = '';
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const d = new Date();
  ui.sub(D.isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `Practice word #${level}`);
  paintHard(); hud(); layout();
}
function hud() { ptsEl.textContent = `★ ${points.toLocaleString()}`; }
function layout() {
  const W = innerWidth, H = innerHeight;
  const kh = Math.max(46, Math.min(58, H * 0.068)); kb.style.setProperty('--kh', kh + 'px');
  const kbH = kh * 3 + 16, bottomPad = Math.max(16, H * 0.025);
  kb.style.bottom = `calc(${bottomPad}px + env(safe-area-inset-bottom))`;
  const top = 84, availH = H - kbH - bottomPad - top - 22, tg = 7;
  const ts = Math.floor(Math.min(66, (Math.min(W, 460) - 56 - tg * 4) / 5, (availH - tg * 6) / 6));
  board.style.setProperty('--ts', ts + 'px'); board.style.setProperty('--tg', tg + 'px');
  const bh = ts * 6 + tg * 6; board.style.top = top + Math.max(0, (availH - bh) / 2) + 'px';
  toast.style.top = (top - 4) + 'px';
}
addEventListener('resize', () => tiles.length && layout());

function paintRow() {
  for (let c = 0; c < 5; c++) {
    const t = tiles[row][c], ch = cur[c] || '', fr = t.querySelector('.fr');
    if (fr.textContent !== ch) { fr.textContent = ch; t.classList.toggle('typed', !!ch); if (ch) { t.classList.remove('typed'); void t.offsetWidth; t.classList.add('typed'); } }
  }
}
function press(k) {
  if (state !== 'play' || busy) return;
  if (k === 'enter') return submit();
  if (k === 'back') { if (cur.length) { cur = cur.slice(0, -1); paintRow(); soft.click(); } return; }
  if (cur.length >= 5) return;
  cur += k; paintRow(); soft.wood(); buzz(4);
}
function hardCheck(g) {
  for (let r = 0; r < rows.length; r++) {
    const m = marks[r], w = rows[r];
    for (let i = 0; i < 5; i++) if (m[i] === 2 && g[i] !== w[i]) return `Keep ${w[i].toUpperCase()} in spot ${i + 1}`;
    const need = {}; for (let i = 0; i < 5; i++) if (m[i]) need[w[i]] = (need[w[i]] || 0) + 1;
    for (const ch in need) { const have = [...g].filter(x => x === ch).length; if (have < need[ch]) return `Use the ${ch.toUpperCase()} you found`; }
  }
  return null;
}
const ord = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
function bad(msg) { const rd = board.children[row]; rd.classList.remove('shake'); void rd.offsetWidth; rd.classList.add('shake'); say(msg); soft.err(); buzz(30); }
function submit() {
  if (cur.length < 5) return bad('Five letters, please');
  if (!VALID.has(cur)) return bad('We don\'t know that word');
  if (hard) { const m = hardCheck(cur); if (m) return bad(m); }
  const g = cur, m = score(g, answer); rows.push(g); marks.push(m); busy = true;
  const rt = tiles[row];
  rt.forEach((t, i) => setTimeout(() => {
    t.querySelector('.bk').textContent = g[i]; t.querySelector('.bk').className = 'fa bk c' + m[i]; t.classList.add('flip');
    if (m[i] === 2) chime(i + 3, 69, 0.1); else if (m[i] === 1) chime(i + 1, 64, 0.08); else soft.click();
    if (m[i] === 2) { const b = t.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', '#bfe8cc', '#4c9a6a'], 5, { speed: 2, size: 2.4 }); }
  }, i * 260));
  const done = 5 * 260 + 260;
  setTimeout(() => {
    for (let i = 0; i < 5; i++) { const ch = g[i]; keyState[ch] = Math.max(keyState[ch] ?? -1, m[i]); }
    for (const ch in keyState) keyEl[ch].className = 'k' + keyState[ch];
    row++; cur = ''; busy = false; ui.progress(row / 6); paintHard();
    const win = m.every(x => x === 2);
    if (win) return finish(true);
    if (row >= 6) return finish(false);
    const greens = m.filter(x => x === 2).length;
    if (greens >= 3) ui.pop(greens === 4 ? 'So close!' : 'Warmer!', '#3f8f63', 26, 9);
  }, done);
}
const WORDS_OF_PRAISE = ['Mind reader!', 'Brilliant!', 'Sharp!', 'Nicely done!', 'Got there!', 'Just in time!'];
function grid() { return marks.map(m => m.map(x => (x === 2 ? '🟩' : x === 1 ? '🟨' : '⬛')).join('')).join('\n'); }
function finish(won) {
  if (state !== 'play') return;
  const g = row;
  if (!recorded) { recorded = true; if (!D.isDaily) { if (won) F.level(true); else F.level(false, Math.max(...marks.map(m => m.filter(x => x === 2).length)) / 5); } }
  if (won) {
    state = 'won';
    const pts = (7 - g) * 10 + (hard ? 10 : 0); points += pts; S.set('points', points); hud();
    const rd = board.children[g - 1]; rd.classList.add('jump'); [...rd.children].forEach((t, i) => (t.style.animationDelay = i * 90 + 'ms'));
    ui.pop(WORDS_OF_PRAISE[g - 1], '#3f8f63', 38, 9); arp([67, 71, 74, 79, 83], 90, 0.12, 0.8); fx.confetti(); buzz([20, 40, 20]);
    if (!beatenShown && D.beaten(pts)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', '#c0573f', 40, 14), 500); }
    const d = new Date(), tag = D.isDaily ? `the ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()} daily word` : `word #${level}`;
    D.won(pts, `cracked ${tag} in ${g}/6${hard ? ' (hard mode)' : ''}\n${grid()}\nand scored`);
    if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || !prev.g || g < prev.g) S.set(k, { g }); }
    else { level++; S.set('level', level); }
    setTimeout(() => ui.win(D.isDaily ? '' : level - 1, `${answer.toUpperCase()} · ${g}/6 · +${pts} ★`), 500);
  } else {
    state = 'lost'; soft.err(); buzz([40, 60, 40]);
    if (D.isDaily) { const k = 'daily_' + todayKey(); if (!S.get(k, null)) S.set(k, { g: 0 }); }
    else { level++; S.set('level', level); }   // a missed word still moves on to a new one (the answer is revealed)
    ui.lose('The word was', `${answer.toUpperCase()} — new word next`);
  }
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot plays a consistent guess, one key per call
let botWord = null;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return points; },
  bot() {
    if (state !== 'play' || busy) return;
    if (!botWord) {
      const ok = (w) => rows.every((g, r) => score(g, w).join() === marks[r].join());
      const cand = ANSWERS.slice(0, 1100).filter(ok);
      const pool = cand.length ? cand : FIVE.filter(ok);
      botWord = rows.length ? pool[Math.floor(Math.random() * pool.length)] : ['crane', 'slate', 'trace', 'stare', 'arise'][Math.floor(Math.random() * 5)];
      if (!botWord) botWord = answer;
      while (cur.length) press('back');
    }
    if (cur.length < 5) press(botWord[cur.length]); else { botWord = null; press('enter'); }
  },
};
