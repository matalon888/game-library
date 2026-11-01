// Beatbuds deep v2 — "Band Tour": 30 gigs in 3 worlds. Each gig asks the band for a crowd mood (goal chips that tick live as you
// set the buds); stars for the goals, the gold goals and the gig's hidden combo. Gig rules live in dlogic.js, gigs in levels.js.
// The drawing of the buds and the synth are v1's (same buds, same sounds).
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { css, cardTheme, fx2d, arp, soft, chime, todayKey } from './calm.js';
import { engine, STEP } from './music.js';
import { CATS, CATICON, SND, evalGig, totals, solve, genGig } from './dlogic.js';
import { LEVELS, WORLDS } from './levels.js';

const NAME = 'Beatbuds: Beat Maker Music Mix';
const S = store('beatbuds');
const F = flow('beatbuds');                 // no fail state and no difficulty knob: we only record finished gigs
const ui = createUI({ title: 'Beatbuds', hint: 'Tap to wake the band', hand: '', score: false, progress: false });
cardTheme({ accent: '#ff5fa2' });
const B = board({ game: 'beatbuds', label: 'Combos found', limits: { maxRun: 3, maxPerSec: 1 }, mode: 'sum', corner: 'tl', accent: '#ff5fa2' });
const fx = fx2d(30);

const SECRETS = [
  { n: 'Sunset Stroll', s: ['thump', 'pad', 'ooh'] }, { n: 'Robot Picnic', s: ['mouth', 'bleeps', 'doo'] }, { n: 'Rainy Window', s: ['shaker', 'bells', 'hum'] },
  { n: 'Disco Snail', s: ['floor', 'bass', 'la'] }, { n: 'Rocket Party', s: ['bap', 'riser', 'hey'] }, { n: 'Woodland Wobble', s: ['wobble', 'marimba', 'doo'] },
  { n: 'Bird Choir', s: ['claps', 'whistle', 'ooh'] }, { n: 'Night Bus', s: ['bap', 'bass', 'arp'] },
];
const HATS = ['cap', 'phones', 'beanie', 'crown', 'antenna', 'bow', 'tophat', 'visor', 'flower', 'horns'];
const HATIC = ['🧢', '🎧', '🧶', '👑', '👽', '🎀', '🎩', '🕶️', '🌼', '😈'];
const HAT_AT = i => 6 + i * 7;               // total stars needed for hat i (6, 13 … 69)
const NG = LEVELS.length;
const ART = new Image(); ART.src = 'assets/bg-art.webp';
const BOT = /[?&]bot=1/.test(location.search);

// ---------------------------------------------------------------- save
let ST = S.get('d2stars', {});               // gig index -> best stars (0-3); 'e<n>' encores; 'd<key>' daily
let hatSel = S.get('d2hat', -1);
const stars = k => ST[k] || 0;
const totalStars = () => LEVELS.reduce((a, _, i) => a + stars(i), 0);
const unlocked = i => i === 0 || stars(i - 1) >= 1;
const nextGig = () => { for (let i = 0; i < NG; i++) if (unlocked(i) && stars(i) === 0) return i; for (let i = 0; i < NG; i++) if (stars(i) < 3) return i; return NG; };
const saveStars = () => S.set('d2stars', ST);
const hatsOpen = () => HATS.filter((_, i) => totalStars() >= HAT_AT(i)).length;

// ---------------------------------------------------------------- DOM
css(`
body{background:#1b1240;color:#fff;overflow:hidden}
#stage{position:fixed;inset:0;width:100%;height:100%;z-index:1}
#hud{position:fixed;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(100vw,460px);z-index:5;padding:0 8px;display:flex;flex-direction:column;gap:5px;pointer-events:none}
#hud>*{pointer-events:auto}
.r1{display:flex;align-items:center;gap:8px;margin:0 50px 0 48px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:5px 8px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.r1 .nm{flex:1;min-width:0;line-height:1.1}.r1 .nm b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.r1 .nm small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;opacity:.75;letter-spacing:1px;text-transform:uppercase;font-weight:800}
.btn{font:inherit;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:12px;min-width:38px;height:38px;font-size:18px;cursor:pointer;display:grid;place-items:center;padding:0 8px}
.btn:active{transform:scale(.94)}
#tk{font-weight:800;font-size:15px;white-space:nowrap}#tk.low{color:#ff8a8a}
#chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center;background:rgba(20,12,48,.5);border-radius:14px;padding:6px 8px}
.grp{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.grp>i{font-style:normal;font-size:10px;margin-right:1px;letter-spacing:-2px}
.chip{font-size:12px;font-weight:800;padding:2px 7px;border-radius:12px;border:2px solid rgba(255,255,255,.4);background:rgba(255,255,255,.08);white-space:nowrap;transition:transform .2s,background .2s}
.chip.g{border-color:rgba(255,211,92,.7)}
.chip.ok{background:#2ec27e;border-color:#fff;transform:scale(1.07)}.chip.g.ok{background:#e7a914;border-color:#fff}
.sec{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-size:16px;border:2px dashed rgba(255,255,255,.45)}.sec.on{border-style:solid;border-color:#fff;box-shadow:0 0 12px #fff}
.sep{flex-basis:100%;height:0}
#stars{font-size:26px;letter-spacing:2px;text-shadow:0 2px 8px rgba(0,0,0,.4);margin-left:auto;line-height:1}
#stars b{opacity:.3;filter:grayscale(1);font-weight:400;display:inline-block;transition:transform .3s}#stars b.on{opacity:1;filter:none;transform:scale(1.25)}
#fin{position:fixed;right:max(10px,calc(50% - 215px));z-index:6;font:inherit;font-weight:800;font-size:16px;color:#18122e;background:#ffd35c;border:0;border-radius:22px;padding:10px 20px;box-shadow:0 5px 0 #b8861a;animation:pulse 1s infinite;display:none;cursor:pointer}
@keyframes pulse{50%{transform:scale(1.07)}}
#pal{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));width:min(100vw,440px);z-index:5;padding:8px 10px;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,rgba(20,12,48,0),rgba(20,12,48,.6) 14%)}
.row{display:flex;gap:6px;align-items:center}
.row em{writing-mode:vertical-rl;transform:rotate(180deg);font-style:normal;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;opacity:.75;width:12px;text-align:center}
.ic{position:relative;flex:1;aspect-ratio:1;max-height:58px;border-radius:16px;display:grid;place-items:center;font-size:clamp(22px,7vw,30px);box-shadow:0 4px 0 rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.35);cursor:grab;touch-action:none;transition:transform .12s,opacity .2s,filter .2s}
.ic:active{transform:scale(.94)}
.ic.used{opacity:.62;filter:saturate(.7);box-shadow:0 0 0 2px rgba(255,255,255,.55)}.ic.used::after{content:'';position:absolute;top:3px;right:3px;width:9px;height:9px;border-radius:50%;background:#fff}
.ic.lk{opacity:.22;filter:grayscale(1);pointer-events:none}.ic.lk::before{content:"🔒";position:absolute;font-size:16px}
.ic .pp{position:absolute;bottom:3px;left:0;right:0;display:flex;justify-content:center;gap:2px}.ic .pp s{width:6px;height:6px;border-radius:50%;background:#ffe14d;box-shadow:0 0 0 1px rgba(0,0,0,.35)}.ic .pp s.f{background:#fff}
.ic.hl{animation:pulse .7s infinite}
.ghost{position:fixed;z-index:50;width:62px;height:62px;border-radius:18px;display:grid;place-items:center;font-size:32px;pointer-events:none;transform:translate(-50%,-60%) scale(1.15);box-shadow:0 12px 24px rgba(0,0,0,.4)}
#found{position:fixed;left:0;right:0;z-index:6;text-align:center;pointer-events:none;font-family:ui-serif,Georgia,serif;font-weight:700;font-size:30px;text-shadow:0 3px 18px rgba(0,0,0,.4);opacity:0;transition:opacity .4s,transform .4s;transform:scale(.8)}
#found.on{opacity:1;transform:scale(1)}
#found small{display:block;font-family:-apple-system,system-ui,sans-serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;opacity:.85}
#hand{position:fixed;z-index:7;font-size:38px;pointer-events:none;animation:tapme 1s infinite}
@keyframes tapme{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-14px)}}
.ov{position:fixed;inset:0;z-index:20;background:rgba(14,10,36,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;flex-direction:column;align-items:center;overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 24px}
.ov h2{font-family:ui-serif,Georgia,serif;font-size:30px;margin:6px 0 2px;font-weight:700}
.ov .sub{font-size:13px;opacity:.8;margin-bottom:8px;text-align:center}
.big{font:inherit;font-weight:800;font-size:18px;color:#18122e;background:#fff;border:0;border-radius:26px;padding:13px 30px;box-shadow:0 6px 0 rgba(0,0,0,.3);cursor:pointer}
.big.alt{background:rgba(255,255,255,.16);color:#fff;box-shadow:none;border:1px solid rgba(255,255,255,.3)}
.big:active{transform:translateY(3px)}
.btns{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;justify-content:center}
.big3{font-size:62px;letter-spacing:6px;margin:8px 0 2px;line-height:1}.big3 b{opacity:.25;filter:grayscale(1);font-weight:400;display:inline-block}.big3 b.on{opacity:1;filter:none;animation:pop .5s both}
@keyframes pop{0%{transform:scale(0) rotate(-40deg)}70%{transform:scale(1.5) rotate(8deg)}100%{transform:scale(1)}}
.tabs{display:flex;gap:6px;margin:6px 0 10px}.tab{white-space:nowrap;font:inherit;font-weight:800;font-size:13px;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:7px 10px;cursor:pointer}.tab.on{background:#fff;color:#18122e}
.path{position:relative;width:min(100%,380px);display:grid;grid-template-columns:repeat(5,1fr);gap:12px 8px}
.nd{aspect-ratio:1;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:19px;position:relative;cursor:pointer;border:3px solid rgba(255,255,255,.5);background:rgba(255,255,255,.1)}
.nd small{position:absolute;bottom:-14px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:-2px}
.nd.lk{opacity:.35;cursor:default}.nd.hard{border-color:#ff5555;box-shadow:0 0 0 2px rgba(255,85,85,.4)}
.nd.done{background:#2ec27e;border-color:#fff}.nd.gold{background:#e7a914}.nd.nx{background:#fff;color:#18122e;animation:pulse 1s infinite}
.bar{width:min(100%,380px);height:14px;border-radius:7px;background:rgba(255,255,255,.14);overflow:hidden;margin:4px 0}.bar i{display:block;height:100%;background:linear-gradient(90deg,#ff8a3d,#ffd35c)}
.hats{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:6px 0;width:min(100%,380px)}.hat{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:21px;background:rgba(255,255,255,.12);border:2px solid transparent;cursor:pointer}
.hat.lk{opacity:.3;filter:grayscale(1);cursor:default;font-size:11px}.hat.on{border-color:#ffd35c}
.mchip{display:inline-block;margin:3px;padding:3px 9px}
`);
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const cv = document.createElement('canvas'); cv.id = 'stage'; document.body.prepend(cv); const g = cv.getContext('2d');
const hud = $(`<div id="hud"><div class="r1"><button class="btn" id="bmap">🗺️</button><div class="nm"><small></small><b></b></div><div id="tk"></div><button class="btn" id="brst">Redo</button></div><div id="chips"></div></div>`); document.body.appendChild(hud);
const chipsEl = hud.querySelector('#chips');
const fin = $(`<button id="fin">✓</button>`); document.body.appendChild(fin);
const pal = $(`<div id="pal"></div>`); document.body.appendChild(pal);
const found = $(`<div id="found"></div>`); document.body.appendChild(found);
for (const c of CATS) {
  const row = $(`<div class="row"><em>${c.n}</em></div>`);
  c.ids.forEach((id, i) => { const e = $(`<div class="ic" data-id="${id}">${c.ic[i]}<span class="pp"></span></div>`); e.style.background = `linear-gradient(160deg,${c.c},${shade(c.c, -0.25)})`;
    e.querySelector('.pp').innerHTML = '<s></s>'.repeat(SND[id].h) + '<s class="f"></s>'.repeat(SND[id].f); row.appendChild(e); SND[id].el = e; });
  pal.appendChild(row);
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
let W, H, dpr, SPOTS = [];
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const palTop = H - pal.getBoundingClientRect().height - 4, top = hud.getBoundingClientRect().bottom + 18, h = Math.max(160, palTop - top);
  fin.style.top = Math.max(0, palTop - 46) + 'px';
  const n = G ? G.slots : 4, cw = Math.min(W, 520), x0 = (W - cw) / 2;
  SPOTS = [];
  if (n <= 4) { const sc = Math.min(1.35, cw / (n * 92), h / 190); for (let i = 0; i < n; i++) SPOTS.push({ x: x0 + cw * (i + 0.5) / n, y: top + h * 0.58, s: sc }); }
  else {
    const a = Math.ceil(n / 2), b = n - a, sc = Math.min(1.25, cw / (a * 92), h / 300);
    for (let i = 0; i < a; i++) SPOTS.push({ x: x0 + cw * (i + 0.5) / a, y: top + h * 0.40, s: sc * 0.84 });
    for (let i = 0; i < b; i++) SPOTS.push({ x: x0 + cw * (i + 0.5) / b, y: top + h * 0.86, s: sc });
  }
  found.style.top = top + h * 0.02 + 'px';
}
addEventListener('resize', () => { layout(); });

// ---------------------------------------------------------------- state
let streak = 0, state = 'ready', G = null, GK = 0, GKIND = 'gig', slots = new Array(7).fill(null), A = null, takes = 0, shown = 0, idleT = 0, bestNow = 0, okPrev = 0;
let bud = [], stepI = 0, nextT = 0, bonusUntil = -1, show = 0, shake = 0, foundNow = [], endTimer = 0, usedTakes = 0, tries = 0;
for (let i = 0; i < 7; i++) bud.push({ mouth: 0, bounce: 0, sway: Math.random() * 6, blink: Math.random() * 4, glow: 0, hop: 0 });
const hatFor = sd => HATS[hatSel >= 0 && hatSel < HATS.length && hatSel < hatsOpen() ? hatSel : sd.k % HATS.length];

function startAudio() {
  if (A) { A.ac.resume(); return; }
  A = engine(); nextT = A.ac.currentTime + 0.1; stepI = 0;
  setInterval(sched, 25);
}
const cues = [];
function sched() {
  if (!A) return;
  const ac = A.ac;
  while (nextT < ac.currentTime + 0.14) {
    const s = stepI % 16, b = Math.floor(stepI / 16) % 4;
    slots.forEach((id, i) => {
      if (!id) return; const d = A.out(0.9, SND[id].cat >= 2 ? 0.5 : 0.15);
      const hit = A.S[id](s, b, nextT, d); if (hit) cues.push({ t: nextT, i, amt: hit, cat: SND[id].cat });
    });
    if (bonusUntil > stepI) A.bonus(s, b, nextT, A.out(0.8, 0.4));
    if (s % 4 === 0) cues.push({ t: nextT, beat: s / 4, bar: b });
    if (s === 0) cues.push({ t: nextT, bar: b, step: stepI });
    nextT += STEP; stepI++;
  }
}

// ---------------------------------------------------------------- gigs
function chipLabel(ch, cur) {
  switch (ch[0]) {
    case 'cat': return `${CATICON[ch[1]]} ${ch[2]}+`;
    case 'exact': return `${CATICON[ch[1]]} =${ch[2]}`;
    case 'id': return SND[ch[1]].ic;
    case 'bancat': return `🚫${CATICON[ch[1]]}`;
    case 'banid': return `🚫${SND[ch[1]].ic}`;
    case 'hype': return `⚡ ${Math.min(cur.hype, ch[1])}/${ch[1]}`;
    case 'feel': return `💗 ${Math.min(cur.feel, ch[1])}/${ch[1]}`;
    case 'cool': return `⚡ ≤${ch[1]} · ${cur.hype}`;
    case 'fill': return '🎪 all';
  }
  return '?';
}
function gigFor(kind, k) {
  if (kind === 'gig') return LEVELS[k];
  if (kind === 'jam') return { n: 'Free Jam', jam: true, slots: 7, star: -1, takes: 0, w: 2, chips: [], bonus: [], hidden: [], clue: 'Any sounds, any buds. Secret combos hide in here too.' };
  const g0 = kind === 'daily' ? genGig(todayKey(), 40) : genGig(7 + k * 13, 31 + k);
  return g0;
}
function startGig(kind, k) {
  window.__hideJt && window.__hideJt(); GKIND = kind; GK = k; G = gigFor(kind, k); slots = new Array(7).fill(null); takes = G.takes || 0; shown = 0; idleT = 0; bestNow = 0; okPrev = 0; streak = 0; foundNow = []; usedTakes = 0; fullDone = false; finOk = false;
  clearTimeout(endTimer); state = 'play'; closeOv(); layout(); buildHud(); refresh(); document.body.style.setProperty('--w', WORLDS[Math.min(G.w || 0, 2)].c);
  if (!totalStars() && kind === 'gig' && k === 0) showHand();
}
function buildHud() {
  const w = WORLDS[Math.min(G.w || 0, 2)];
  hud.querySelector('small').textContent = GKIND === 'jam' ? '🎧 no goals, just play' : GKIND === 'gig' ? `${w.e} ${w.n} · gig ${GK + 1}${G.hard ? ' · HARD' : ''}` : GKIND === 'daily' ? '🌟 daily gig' : `🎤 encore ${GK + 1}`;
  hud.querySelector('b').textContent = G.n;
  chipsEl.innerHTML = '';
  const grp = (label, arr, gold) => { const d = $(`<div class="grp"><i>${label}</i></div>`); arr.forEach((c, i) => { const e = $(`<span class="chip${gold ? ' g' : ''}"></span>`); e._c = c; d.appendChild(e); }); chipsEl.appendChild(d); };
  grp('⭐', G.chips, false); if (G.bonus.length) grp('⭐⭐', G.bonus, true);
  if (G.jam) { chipsEl.innerHTML = ''; const jm = $(`<div class="grp"><i style="letter-spacing:0;font-size:12px">🎶 secret combos found: ${S.get('found', []).length}/${SECRETS.length}</i></div>`); chipsEl.appendChild(jm); document.body.classList.remove('hardg'); [...pal.querySelectorAll('.ic')].forEach(e => e.classList.remove('lk')); return; }
  const sg = $(`<div class="grp"><i>⭐⭐⭐</i></div>`); G.hidden.forEach(id => sg.appendChild($(`<span class="sec">${CATICON[SND[id].cat]}</span>`))); sg.addEventListener('pointerdown', ev3 => { ev3.stopPropagation(); ui.pop('“' + G.clue + '”', '#fff', 18, 60); }); chipsEl.appendChild(sg);
  const st = $(`<div id="stars"><b>⭐</b><b>⭐</b><b>⭐</b></div>`); chipsEl.appendChild(st);
  document.body.classList.toggle('hardg', !!G.hard);
  [...pal.querySelectorAll('.ic')].forEach(e => e.classList.toggle('lk', (G.lock || []).includes(e.dataset.id)));
}
let ev = null, finOk = false, fullDone = false;
const emptyN = () => { let n = 0; for (let i = 0; i < G.slots; i++) if (!slots[i]) n++; return G.jam ? 0 : n; };
function refresh() {
  ev = evalGig(G, slots);
  for (const id in SND) SND[id].el.classList.toggle('used', !G.jam && slots.includes(id));
  const els = chipsEl.querySelectorAll('.chip'); const all = G.chips.concat(G.bonus);
  els.forEach((e, i) => { const c = e._c, ok = i < G.chips.length ? ev.ok[i] : ev.bonus[i - G.chips.length]; e.textContent = chipLabel(c, ev); e.classList.toggle('ok', ok); });
  void all;
  chipsEl.querySelectorAll('.sec').forEach((e, i) => { const id = G.hidden[i]; if (!SND[id]) { e.style.display = 'none'; return; } const on = slots.includes(id), vis = i < shown || on; e.textContent = vis ? SND[id].ic : CATICON[SND[id].cat]; e.style.background = vis ? SND[id].c : ''; e.classList.toggle('on', on); });
  chipsEl.querySelectorAll('#stars b').forEach((b, i) => b.classList.toggle('on', i < ev.stars));
  const tk = hud.querySelector('#tk'); tk.textContent = G.takes ? `🎟️ ${takes}` : ''; tk.classList.toggle('low', !!G.takes && takes <= 2);
  fin.style.display = state === 'play' && ev.stars >= 1 && ev.stars < 3 ? 'block' : 'none'; fin.textContent = emptyN() && !finOk ? 'Play it' : 'Play it'; if (finOk && emptyN()) fin.textContent = 'Play anyway';
  // feedback for progress: each newly met chip chimes higher; a new star is a bigger moment
  const okN = ev.ok.filter(Boolean).length + ev.bonus.filter(Boolean).length + ev.hid;
  if (okN > okPrev && state === 'play') {
    chime(okN, 76, 0.1); streak++;
    if (streak >= 2) {
      const cx = W / 2, cy = hud.getBoundingClientRect().bottom + 60;
      fx.sparks(cx, cy, ['#ff8a3d', '#ffd35c', '#fff'], 10 + streak * 6, { speed: 4 + streak }); show = Math.max(show, 0.25 * streak); shake = Math.max(shake, 0.12 * streak); buzz(8 * streak);
      ui.pop(streak >= 5 ? 'UNSTOPPABLE!' : streak >= 4 ? 'ON FIRE!' : streak >= 3 ? 'GROOVE ×3' : 'NICE ×2', streak >= 5 ? '#ff5fa2' : '#ffd35c', 22 + streak * 4, 40);
      if (streak >= 5) { fx.confetti(60); bonusUntil = stepI + 16; }
    }
  } else if (okN < okPrev) streak = 0;
  okPrev = okN;
  if (ev.stars > bestNow && state === 'play') { starUp(ev.stars); bestNow = ev.stars; }
  if (ev.stars < bestNow) bestNow = ev.stars;
}
function starUp(n) {
  const cx = W / 2, cy = hud.getBoundingClientRect().bottom + 20;
  fx.sparks(cx, cy, ['#ffd35c', '#fff'], 18 + n * 8, { speed: 5 + n }); fx.ring(cx, cy, '#ffd35c', 50 + n * 20);
  arp([72 + n * 2, 76 + n * 2, 79 + n * 2, 84 + n * 2].slice(0, 2 + n), 70, 0.1); buzz(n * 15);
  ui.pop('⭐'.repeat(n), '#ffd35c', 40 + n * 6, 23);
  bonusUntil = stepI + 8 * n; show = Math.max(show, 0.3 * n); shake = 0.3 * n;
  if (n === 3) { fx.confetti(140); show = 1; shake = 0.9; clearTimeout(endTimer); endTimer = setTimeout(() => endGig(), 2400); celebrate(G.n, 'Hidden combo!'); }
  if (n === 1 && G.takes === 0 && GKIND === 'gig' && GK < 3) ui.pop('Keep going: ⭐⭐', '#fff', 20, 30);
}
function celebrate(name, kicker) {
  bonusUntil = stepI + 32; show = 1;
  found.innerHTML = `<small></small><span></span>`; found.querySelector('small').textContent = kicker; found.querySelector('span').textContent = name; found.classList.add('on');
  setTimeout(() => found.classList.remove('on'), 2300);
  fx.confetti(90); arp([72, 76, 79, 84], 70, 0.08); buzz([20, 30, 20]);
  bud.forEach((b, i) => { if (slots[i]) b.hop = 1.4; });
}
const has = set => set.every(id => slots.includes(id));
function place(id, i) {
  if (state !== 'play' || !id || (G.lock || []).includes(id)) return;
  if (G.takes && takes <= 0) return;
  if (i == null) { i = slots.findIndex((x, j) => j < G.slots && !x); if (i < 0) { soft.err(); stageShake(); ui.pop('tap a bud to free it', '#fff', 18, 52); return; } }
  if (i >= G.slots) return;
  const old = G.jam ? (slots[i] === id ? i : -1) : slots.indexOf(id); if (old === i) return; if (old >= 0) slots[old] = null;
  slots[i] = id; bud[i].hop = 1; bud[i].glow = 1; idleT = 0; hideHand();
  if (G.takes && old < 0) takes--; usedTakes++;
  const sp = SPOTS[i]; fx.sparks(sp.x, sp.y - 40 * sp.s, [SND[id].c, '#fff'], 14, { speed: 4 }); fx.ring(sp.x, sp.y - 40 * sp.s, SND[id].c, 40);
  note(60 + SND[id].k % 12 + 12, 0.2, 0.06); buzz(10);
  if (i === G.star) { fx.sparks(sp.x, sp.y - 70 * sp.s, ['#ffd35c'], 10, { speed: 3 }); }
  refresh(); checkSecrets();
  if (!G.jam && !fullDone && !emptyN() && state === 'play') { fullDone = true; show = 1; shake = 0.5; bonusUntil = stepI + 32; fx.confetti(50); bud.forEach(b => { b.hop = 1.2; }); ui.pop('FULL STAGE!', '#ffd35c', 36, 30); bonusUntil = stepI + 64; setTimeout(() => { if (state === 'play') { show = 1; fx.confetti(40); } }, 1500); arp([72, 76, 79, 84], 70, 0.07); } else if (emptyN()) fullDone = false;
  if (G.jam) { const n = slots.filter(Boolean).length; if (n === 7 && old < 0) { fx.confetti(80); arp([72, 76, 79, 84, 88], 60, 0.07); shake = 0.5; bud.forEach(b => { b.hop = 1.5; }); show = 1; bonusUntil = stepI + 32; ui.pop('FULL BAND!', '#ff5fa2', 34, 30); } else if (n === 4 && old < 0) { show = Math.max(show, 0.5); ui.pop('GROOVING', '#ffd35c', 24, 40); } return; }
  if (state === 'play' && G.takes && takes <= 0 && ev.stars < 3) { clearTimeout(endTimer); endTimer = setTimeout(() => endGig(), 900); }
}
function unplace(i) { if (!slots[i] || state !== 'play') return; slots[i] = null; soft.swish(); buzz(6); refresh(); }
function stageShake() { shake = Math.max(shake, 0.4); }
function checkSecrets() {
  const fs = S.get('found', []);
  for (const c of SECRETS) if (!fs.includes(c.n) && has(c.s)) { fs.push(c.n); S.set('found', fs); foundNow.push(c.n); celebrate(c.n, 'Secret combo!'); B.submit(1, { ms: 1000 }); }
}
function resetGig() { clearTimeout(endTimer); startGig(GKIND, GK); soft.wood(); }

// ---------------------------------------------------------------- end of a gig
function key() { return GKIND === 'gig' ? GK : GKIND === 'daily' ? 'd' + todayKey() : 'e' + GK; }
function endGig() {
  if (state !== 'play') return; state = 'res'; clearTimeout(endTimer);
  const e = evalGig(G, slots), k = key(), prevTot = totalStars(), prev = stars(k);
  if (e.stars > prev) { ST[k] = e.stars; saveStars(); }
  const gained = totalStars() - prevTot, hatNew = HATS.filter((_, i) => prevTot < HAT_AT(i) && totalStars() >= HAT_AT(i));
  F.level(e.stars > 0);
  if (GKIND === 'encore' && e.stars > 0) S.set('d2enc', Math.max(S.get('d2enc', 0), GK + 1));
  if (e.stars === 3 && prev < 3) B.submit(1, { ms: 1000 });
  e.drops = usedTakes; e.par = Math.max(2, (G.hidden || []).length + 1); e.clean = e.stars === 3 && usedTakes <= e.par; e.bestDrops = 0; e.newBest = false;
  if (e.stars === 3 && GKIND !== 'jam') { const db = S.get('d2drops', {}), bd = db[k]; e.bestDrops = bd || usedTakes; if (!bd || usedTakes < bd) { db[k] = usedTakes; S.set('d2drops', db); e.bestDrops = usedTakes; e.newBest = !!bd; } if (e.clean) { const cl = S.get('d2clean', {}); if (!cl[k]) { cl[k] = 1; S.set('d2clean', cl); e.cleanNew = true; } } }
  fin.style.display = 'none';
  setTimeout(() => showResult(e, prev, gained, hatNew), e.stars ? 500 : 250);
}
function missText(e) {
  const out = []; G.chips.forEach((c, i) => { if (!e.ok[i]) out.push(c); }); return out;
}
function showResult(e, prev, gained, hatNew) {
  closeOv();
  const ov = $(`<div class="ov" id="res" style="justify-content:center"></div>`);
  const miss = missText(e);
  ov.innerHTML = `<div class="sub">${GKIND === 'gig' ? WORLDS[Math.min(G.w || 0, 2)].e + ' ' + WORLDS[Math.min(G.w || 0, 2)].n + ' · gig ' + (GK + 1) : GKIND === 'daily' ? '🌟 daily gig' : '🎤 encore ' + (GK + 1)}</div><h2>${e.stars ? (e.stars === 3 ? 'Encore!' : 'Nice gig') : miss.length === 1 ? 'So close…' : miss.length === 2 ? 'Almost…' : 'Not yet'}</h2><div class="big3"><b>⭐</b><b>⭐</b><b>⭐</b></div><div class="sub" id="rl"></div><div id="rm"></div><div class="btns" id="rb"></div>`;
  document.body.appendChild(ov);
  const rl = ov.querySelector('#rl'), rm = ov.querySelector('#rm'), rb = ov.querySelector('#rb');
  [...ov.querySelectorAll('.big3 b')].forEach((b, i) => { if (i < e.stars) setTimeout(() => { b.classList.add('on'); note(72 + i * 4, 0.4, 0.14); fx.sparks(W / 2 + (i - 1) * 62, H / 2 - 70, ['#ffd35c', '#fff'], 14, { speed: 4 }); buzz(12); }, 300 + i * 380); });
  if (e.stars === 0) {
    rl.textContent = `${G.chips.length - miss.length}/${G.chips.length} goals · ${miss.length === 1 ? '1 goal left' : miss.length + ' goals left'}`;
    miss.forEach(c => { const s = $(`<span class="chip mchip"></span>`); s.textContent = chipLabel(c, e); rm.appendChild(s); });
    soft.err();
  } else {
    const lines = []; if (e.stars < 3) lines.push(e.stars === 1 && G.bonus.length ? 'Gold goals left for ⭐⭐' : `Secret set: ${G.hidden.map(id => slots.includes(id) ? '✅' + SND[id].ic : CATICON[SND[id].cat] + '❓').join(' ')}<br><small>“${G.clue}”</small>`); else { lines.push('You found the secret set!'); lines.push(e.clean ? `🎯 CLEAN SET · ${e.drops} drops${e.newBest ? ' · NEW BEST' : ''}` : `${e.drops} drops · clean set is ${e.par} or fewer${e.bestDrops && e.bestDrops < e.drops ? ' · best ' + e.bestDrops : ''}`); if (e.clean) setTimeout(() => { note(88, 0.5, 0.14); fx.sparks(W / 2, H / 2 + 20, ['#7dffb0', '#fff'], 16, { speed: 4 }); }, 1500); }
    if (gained > 0) lines.push(`+${gained}⭐ · ${totalStars()}⭐ in total`); rl.innerHTML = lines.join('<br>');
    if (hatNew.length) { const i = HATS.indexOf(hatNew[0]); rm.innerHTML = `<div class="big3" style="font-size:44px">${HATIC[i]}</div><div class="sub">New hat for the band!</div>`; setTimeout(() => { fx.confetti(80); arp([79, 84, 88], 90, 0.1); }, 1300); }
    else { const nh = HAT_AT(hatsOpen()); if (hatsOpen() < HATS.length) rm.innerHTML = `<div class="bar"><i style="width:${Math.min(100, totalStars() / nh * 100)}%"></i></div><div class="sub">${nh - totalStars()}⭐ to the next hat</div>`; }
    if (e.stars === 3) setTimeout(() => fx.confetti(100), 800);
  }
  const bn = (t, cls, fn) => { const b = $(`<button class="big ${cls || ''}">${t}</button>`); b.addEventListener('pointerdown', ev2 => { ev2.stopPropagation(); fn(); }); rb.appendChild(b); return b; };
  bn(e.stars === 0 ? 'Try again' : 'Retry', e.stars === 0 || e.stars === 3 ? (e.stars === 0 ? '' : 'alt') : '', () => resetGig());
  if (e.stars > 0 && GKIND === 'gig' && GK + 1 < NG) bn('Next', e.stars < 3 ? '' : '', () => startGig('gig', GK + 1));
  else if (e.stars > 0 && GKIND === 'encore') bn('Next', '', () => startGig('encore', GK + 1));
  bn('🗺️', 'alt', () => openMap());
  void prev;
}

// ---------------------------------------------------------------- map
let mapW = 0;
function closeOv() { document.querySelectorAll('.ov').forEach(o => o.remove()); }
function openMap(keep) {
  closeOv(); clearTimeout(endTimer);
  window.__hideJt && window.__hideJt(); state = 'map'; fin.style.display = 'none';
  const nx = nextGig(); if (!keep && nx < NG) mapW = LEVELS[nx].w;
  const ov = $(`<div class="ov" id="map"></div>`); document.body.appendChild(ov);
  const tot = totalStars(), nh = hatsOpen() < HATS.length ? HAT_AT(hatsOpen()) : 0;
  ov.innerHTML = `<h2>Band Tour</h2><div class="sub">⭐ ${tot} / ${NG * 3} · secret sets ${LEVELS.filter((_, i) => stars(i) === 3).length}/${NG} · combos ${S.get('found', []).length}/${SECRETS.length} · 🎯 ${Object.keys(S.get('d2clean', {})).length}</div>`
    + (nh ? `<div class="bar"><i style="width:${Math.min(100, tot / nh * 100)}%"></i></div><div class="sub">${nh - tot}⭐ to a new hat ${HATIC[hatsOpen()]}</div>` : '')
    + `<div class="tabs" id="tabs"></div><div class="path" id="path"></div><div class="sub" style="margin-top:18px">Band hats</div><div class="hats" id="hats"></div><div class="btns" id="mb"></div>`;
  const tabs = ov.querySelector('#tabs'), path = ov.querySelector('#path');
  WORLDS.forEach((w, wi) => { const t = $(`<button class="tab ${wi === mapW ? 'on' : ''}">${w.e} ${w.n}</button>`); t.addEventListener('pointerdown', e => { e.stopPropagation(); mapW = wi; openMap(true); }); tabs.appendChild(t); });
  for (let j = 0; j < 10; j++) {
    const i = mapW * 10 + j, g0 = LEVELS[i], s = stars(i), un = unlocked(i);
    const n = $(`<div class="nd ${!un ? 'lk' : ''} ${g0.hard ? 'hard' : ''} ${s >= 3 ? 'done gold' : s ? 'done' : ''} ${i === nx ? 'nx' : ''}">${un ? i + 1 : '🔒'}${s ? `<small>${'⭐'.repeat(s)}</small>` : ''}</div>`);
    if (un) n.addEventListener('pointerdown', e => { e.stopPropagation(); startGig('gig', i); });
    path.appendChild(n);
  }
  const hats = ov.querySelector('#hats');
  hats.appendChild(hatBtn(-1, '🎨', true));
  HATS.forEach((_, i) => hats.appendChild(hatBtn(i, HATIC[i], tot >= HAT_AT(i))));
  const mb = ov.querySelector('#mb');
  const add = (t, cls, fn) => { const b = $(`<button class="big ${cls}">${t}</button>`); b.addEventListener('pointerdown', e => { e.stopPropagation(); fn(); }); mb.appendChild(b); };
  add('Play', '', () => { if (nx < NG) startGig('gig', nx); else startGig('encore', S.get('d2enc', 0)); });
  add('🎧 Free Jam', '', () => startGig('jam', 0));
  add('🌟 Daily' + (stars('d' + todayKey()) ? ' ' + '⭐'.repeat(stars('d' + todayKey())) : ''), 'alt', () => startGig('daily', 0));
  if (LEVELS.every((_, i) => stars(i) >= 1)) add('🎤 Encore', 'alt', () => startGig('encore', S.get('d2enc', 0)));
}
function hatBtn(i, ic, open) {
  const b = $(`<div class="hat ${open ? '' : 'lk'} ${hatSel === i ? 'on' : ''}">${open ? ic : (i >= 0 ? HAT_AT(i) + '⭐' : '')}</div>`);
  if (open) b.addEventListener('pointerdown', e => { e.stopPropagation(); hatSel = i; S.set('d2hat', i); openMap(true); });
  return b;
}

// ---------------------------------------------------------------- first-gig hand + hints
let handEl = null;
function showHand() { hideHand(); const el = SND.thump.el.getBoundingClientRect(); handEl = $(`<div id="hand">👆</div>`); handEl.style.left = el.left + el.width / 2 - 10 + 'px'; handEl.style.top = el.top + el.height * 0.5 + 'px'; document.body.appendChild(handEl); SND.thump.el.classList.add('hl'); }
function hideHand() { if (handEl) { handEl.remove(); handEl = null; SND.thump.el.classList.remove('hl'); } }
// idle for 20 s: reveal one more sound of the secret set
setInterval(() => { if (state === 'play' && G && ++idleT % 12 === 0 && shown < G.hidden.length) { shown++; refresh(); ui.pop('Hint!', '#fff', 26, 30); } }, 1000);

// ---------------------------------------------------------------- input: drag a sound onto a bud, tap a sound to add it, tap a bud to free it
let dragS = null;
pal.addEventListener('pointerdown', e => {
  e.stopPropagation(); const el = e.target.closest('.ic'); if (!el || state !== 'play') return;
  const id = el.dataset.id; if ((G.lock || []).includes(id)) return;
  const was = slots.includes(id);
  const gh = $(`<div class="ghost">${SND[id].ic}</div>`); gh.style.background = SND[id].c; gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px'; document.body.appendChild(gh);
  dragS = { id, gh, x: e.clientX, y: e.clientY, moved: false, was }; soft.click();
});
addEventListener('pointermove', e => { if (!dragS) return; dragS.gh.style.left = e.clientX + 'px'; dragS.gh.style.top = e.clientY + 'px'; if (Math.hypot(e.clientX - dragS.x, e.clientY - dragS.y) > 12) dragS.moved = true; });
addEventListener('pointerup', e => {
  if (!dragS) return; const d = dragS; dragS = null; d.gh.remove();
  if (!d.moved) return d.was ? unplace(slots.indexOf(d.id)) : place(d.id);
  const i = budAt(e.clientX, e.clientY); if (i >= 0) place(d.id, i); else soft.err();
});
function budAt(x, y) { let best = -1, bd = 1e9; SPOTS.forEach((p, i) => { const dd = Math.hypot(p.x - x, p.y - 45 * p.s - y); if (dd < 130 * p.s && dd < bd) { bd = dd; best = i; } }); return best; }
cv.addEventListener('pointerdown', e => { if (state !== 'play') return; const i = budAt(e.clientX, e.clientY); if (i >= 0 && slots[i]) unplace(i); });
for (const [el, fn] of [[hud.querySelector('#bmap'), () => openMap()], [hud.querySelector('#brst'), () => { if (state === 'play') resetGig(); }], [fin, () => { if (emptyN() && !finOk && ev.stars < 3) { finOk = true; const n = emptyN(); ui.pop(n + (n > 1 ? ' buds are' : ' bud is') + ' still silent', '#fff', 20, 50); refresh(); setTimeout(() => { finOk = false; if (state === 'play') refresh(); }, 3500); } else endGig(); }]])
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play' || el.id === 'bmap') fn(); });

ui.onTap(w => {
  startAudio();
  if (w === 'start') { const nx = nextGig(); if (nx < NG) startGig('gig', nx); else openMap(); }
});
{ const p = document.createElement('p'); const t = totalStars(); p.textContent = t ? `Band Tour · ${t}⭐` : 'Band Tour · 30 gigs'; p.style.marginTop = '6px'; ui.els.start.querySelector('h1').after(p); }

// ---------------------------------------------------------------- drawing the buds
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function ell(x, y, rx, ry, c) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); }
function hat(kind, c, t) {
  g.fillStyle = c; g.strokeStyle = c;
  switch (kind) {
    case 'cap': g.beginPath(); g.ellipse(0, -96, 34, 22, 0, Math.PI, 0); g.fill(); rr(4, -98, 44, 8, 4); g.fill(); break;
    case 'phones': g.lineWidth = 7; g.beginPath(); g.arc(0, -78, 40, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); rr(-46, -82, 14, 26, 6); g.fill(); rr(32, -82, 14, 26, 6); g.fill(); break;
    case 'beanie': g.beginPath(); g.ellipse(0, -94, 36, 24, 0, Math.PI, 0); g.fill(); rr(-37, -98, 74, 12, 6); g.fillStyle = shade(c, 0.3); g.fill(); ell(0, -122, 8, 8, shade(c, 0.4)); break;
    case 'crown': g.beginPath(); g.moveTo(-26, -96); g.lineTo(-30, -124); g.lineTo(-14, -108); g.lineTo(0, -128); g.lineTo(14, -108); g.lineTo(30, -124); g.lineTo(26, -96); g.closePath(); g.fillStyle = '#ffd35c'; g.fill(); ell(0, -112, 4, 4, c); break;
    case 'antenna': g.lineWidth = 3; g.strokeStyle = '#2b2b33'; g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(10 + Math.sin(t * 6) * 6, -120, 4, -134); g.stroke(); ell(4, -136, 8, 8, c); break;
    case 'bow': g.beginPath(); g.moveTo(14, -104); g.lineTo(-4, -116); g.lineTo(-4, -92); g.closePath(); g.fill(); g.beginPath(); g.moveTo(14, -104); g.lineTo(32, -116); g.lineTo(32, -92); g.closePath(); g.fill(); ell(14, -104, 6, 6, shade(c, -0.2)); break;
    case 'tophat': rr(-24, -140, 48, 44, 4); g.fillStyle = '#2b2b33'; g.fill(); rr(-36, -100, 72, 8, 4); g.fill(); g.fillStyle = c; g.fillRect(-24, -110, 48, 8); break;
    case 'visor': rr(-34, -82, 68, 16, 8); g.fillStyle = '#2b2b33'; g.fill(); rr(-30, -79, 60, 9, 5); g.fillStyle = c; g.globalAlpha = 0.8; g.fill(); g.globalAlpha = 1; break;
    case 'flower': for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + t; ell(22 + Math.cos(a) * 9, -104 + Math.sin(a) * 9, 7, 7, c); } ell(22, -104, 6, 6, '#ffd35c'); break;
    case 'horns': for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 18, -98); g.quadraticCurveTo(s * 36, -112, s * 30, -128); g.quadraticCurveTo(s * 26, -110, s * 8, -100); g.closePath(); g.fillStyle = '#fff4dc'; g.fill(); } break;
  }
}
function drawBud(i, t, now) {
  const p = SPOTS[i], b = bud[i], id = slots[i], sd = id && SND[id];
  g.save(); g.translate(p.x, p.y); g.scale(p.s, p.s);
  const sway = sd ? Math.sin(t * (sd.cat === 1 ? 2.6 : 1.6) + b.sway) * (sd.cat === 1 ? 0.06 : 0.03) : 0;
  const hop = b.hop > 0 ? Math.sin(b.hop * Math.PI) * 26 : 0;
  ell(0, 4, 40, 9, 'rgba(0,0,0,.28)');
  g.translate(0, -b.bounce * 8 - hop); g.rotate(sway);
  const sq = 1 + b.bounce * 0.08;
  g.scale(1 / sq, sq);
  // spotlight glow
  if (sd) { const gr = g.createRadialGradient(0, -60, 10, 0, -60, 90); gr.addColorStop(0, sd.c + '66'); gr.addColorStop(1, sd.c + '00'); g.fillStyle = gr; g.fillRect(-100, -170, 200, 200); }
  // feet
  ell(-16, -2, 14, 8, sd ? shade(sd.c, -0.35) : '#4a4560'); ell(16, -2, 14, 8, sd ? shade(sd.c, -0.35) : '#4a4560');
  // body
  const body = sd ? sd.c : '#6d6789';
  const gr = g.createLinearGradient(0, -110, 0, 0); gr.addColorStop(0, shade(body, 0.18)); gr.addColorStop(1, shade(body, -0.22));
  rr(-38, -112, 76, 110, 38); g.fillStyle = gr; g.fill();
  ell(-14, -86, 10, 16, 'rgba(255,255,255,.18)');
  ell(0, -36, 24, 20, sd ? shade(body, 0.35) : '#7d7899');
  // face
  const blink = (now / 1000 + b.blink) % 4 < 0.12;
  if (!sd) { g.strokeStyle = '#3b3655'; g.lineWidth = 3; g.lineCap = 'round'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 13, -70, 6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); } ell(0, -50, 5, 2.5, '#3b3655'); }
  else {
    const sing = sd.cat >= 2 && b.mouth > 0.2;
    for (const sx of [-1, 1]) {
      if (blink || (sd.cat === 3 && b.mouth > 0.5)) { g.strokeStyle = '#2b2b33'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(sx * 13, -72, 7, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke(); }
      else { ell(sx * 13, -72, 9, 11, '#fff'); ell(sx * 13 + 2, -70, 4.6, 5.6, '#231a2e'); ell(sx * 13 + 3.5, -73, 1.6, 1.6, '#fff'); }
    }
    const m = Math.max(0.12, b.mouth);
    if (sd.cat === 0 && !sing) { ell(0, -48, 9 + b.mouth * 4, 3 + b.mouth * 6, '#2b1830'); }
    else { ell(0, -46, 8 + m * 6, 3 + m * 13, '#2b1830'); ell(0, -42 + m * 6, 6 + m * 3, 2 + m * 4, '#ff7a9a'); }
    ell(-24, -54, 6, 3.5, 'rgba(255,120,160,.45)'); ell(24, -54, 6, 3.5, 'rgba(255,120,160,.45)');
    hat(hatFor(sd), shade(sd.c, -0.15), t);
    if (sd.cat === 0) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 50, -60, 8 + b.bounce * 10, sx > 0 ? -0.6 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.6); g.globalAlpha = b.bounce; g.stroke(); } g.globalAlpha = 1; }
    if (sd.cat >= 2 && b.mouth > 0.3) { g.font = '700 18px system-ui'; g.fillStyle = 'rgba(255,255,255,' + b.mouth + ')'; g.fillText('♪', 30 + Math.sin(t * 3 + i) * 4, -110 - b.mouth * 10); }
  }
  g.restore();
}
let lastBar = 0, beatP = 0;
function render(now) {
  const t = now / 1000;
  const ct = A ? A.ac.currentTime : 0;
  while (cues.length && cues[0].t <= ct) { const c = cues.shift(); if (c.beat != null) { if (c.beat === 0) lastBar = c.bar; beatP = c.beat === 0 ? 1 : 0.6; bud.forEach((bb, ii) => { if (slots[ii]) bb.bounce = Math.max(bb.bounce, 0.35); }); continue; } if (c.bar != null) { lastBar = c.bar; continue; } const b = bud[c.i]; if (c.cat === 0 || c.cat === 1) b.bounce = Math.max(b.bounce, Math.min(1, c.amt)); if (c.cat >= 1) b.mouth = Math.max(b.mouth, Math.min(1, c.amt)); }
  for (const b of bud) { b.bounce *= 0.86; b.mouth *= 0.9; b.hop = Math.max(0, b.hop - 0.035); }
  beatP *= 0.9; show = Math.max(0, show - 0.003); shake *= 0.9;
  g.setTransform(dpr, 0, 0, dpr, shake > 0.02 ? (Math.random() - 0.5) * shake * 10 * dpr : 0, shake > 0.02 ? (Math.random() - 0.5) * shake * 10 * dpr : 0);
  const wc = G ? (WORLDS[Math.min(G.w | 0, 2)] || WORLDS[0]).sky : ['#2a1a63', '#1b1240'];
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, wc[0]); bg.addColorStop(0.6, wc[1]); bg.addColorStop(1, '#120c2c'); g.fillStyle = bg; g.fillRect(-10, -10, W + 20, H + 20);
  if (ART.complete && ART.naturalWidth) { const k = Math.max(W / ART.naturalWidth, H / ART.naturalHeight), w = ART.naturalWidth * k, h = ART.naturalHeight * k; g.drawImage(ART, (W - w) / 2, (H - h) / 2, w, h); g.globalAlpha = 0.55; g.fillStyle = bg; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  const active = slots.filter(Boolean).length, stars3 = ev ? ev.stars : 0;
  for (let i = 0; i < 5; i++) {
    const a = Math.sin(t * (0.5 + i * 0.13) + i) * 0.5, x = W * (0.1 + i * 0.2);
    g.save(); g.translate(x, -20); g.rotate(a); const lg = g.createLinearGradient(0, 0, 0, H * 0.8);
    const col = ['#ff5fa2', '#3d8bff', '#ffd35c', '#2ec27e', '#ff8a3d'][i];
    lg.addColorStop(0, col + (show > 0.1 ? 'aa' : active ? (stars3 ? '55' : '33') : '14')); lg.addColorStop(1, col + '00'); g.fillStyle = lg;
    g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.lineTo(90, H * 0.8); g.lineTo(-90, H * 0.8); g.closePath(); g.fill(); g.restore();
  }
  if (SPOTS.length && G) {
    const ys = [...new Set(SPOTS.map(p => Math.round(p.y)))];
    ys.forEach((y, k) => { g.fillStyle = `rgba(255,255,255,${0.05 + k * 0.02})`; g.beginPath(); g.ellipse(W / 2, y + 8, W * 0.55, 26, 0, 0, Math.PI * 2); g.fill(); });
    const pulse = bud.reduce((m, b, i) => slots[i] && SND[slots[i]].cat === 0 ? Math.max(m, b.bounce) : m, 0);
    if (pulse > 0.05) { const y = Math.max(...ys); g.strokeStyle = `rgba(255,255,255,${pulse * 0.25})`; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, y + 10, W * 0.6 * (1 + (1 - pulse) * 0.1), 32, 0, 0, Math.PI * 2); g.stroke(); }
    if (G.star >= 0 && SPOTS[G.star]) { const p = SPOTS[G.star]; const gr = g.createRadialGradient(p.x, p.y - 50 * p.s, 5, p.x, p.y - 50 * p.s, 110 * p.s); gr.addColorStop(0, 'rgba(255,211,92,.35)'); gr.addColorStop(1, 'rgba(255,211,92,0)'); g.fillStyle = gr; g.fillRect(p.x - 130 * p.s, p.y - 190 * p.s, 260 * p.s, 240 * p.s);
      g.strokeStyle = '#ffd35c'; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y + 4 * p.s, 46 * p.s, 11 * p.s, 0, 0, 7); g.stroke(); }
    for (let i = 0; i < G.slots; i++) drawBud(i, t, now);
    if (G.star >= 0 && SPOTS[G.star]) { const p = SPOTS[G.star]; g.font = `800 ${Math.round(15 * p.s + 4)}px system-ui`; g.fillStyle = '#ffd35c'; g.textAlign = 'center'; g.fillText('×2', p.x + 36 * p.s, p.y - 100 * p.s); g.textAlign = 'start'; }
  }
  if (active && beatP > 0.05) { const gy = Math.max(...SPOTS.map(p => p.y)); const rg = g.createRadialGradient(W / 2, gy, 10, W / 2, gy, W * 0.7); rg.addColorStop(0, `rgba(255,220,140,${beatP * 0.22})`); rg.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  if (A && active) { for (let i = 0; i < 4; i++) { g.fillStyle = i === lastBar ? '#fff' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(W / 2 - 27 + i * 18, hud.getBoundingClientRect().bottom + 8, 3.5, 0, 7); g.fill(); } }
  requestAnimationFrame(render);
}
requestAnimationFrame(t => { layout(); render(t); });
ui.start();
{ const jt = $(`<button id="jamt">🎧 Free Jam</button>`); jt.style.cssText = 'position:fixed;left:50%;bottom:5%;transform:translateX(-50%);z-index:30;font:inherit;font-weight:800;font-size:17px;color:#18122e;background:#ffd35c;border:0;border-radius:24px;padding:12px 26px;box-shadow:0 5px 0 #b8861a;cursor:pointer';
  document.body.appendChild(jt); window.__hideJt = () => { jt.style.display = 'none'; };
  jt.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); ui.hideStart(); startGig('jam', 0); }); }

// ---------------------------------------------------------------- bot (qa): puts a best-star set on the stage
window.__game = {
  get state() { return state; }, get level() { return GK + 1; }, get score() { return totalStars(); }, get gig() { return G; }, get eval() { return ev; }, get slots() { return slots; },
  openMap, startGig, endGig, place, resetGig, solveStars: (k) => solve(gigFor('gig', k)),
  bot(want = 3) {
    if (state !== 'play') return null;
    const r = solve(G), ex = r.example[want] || r.example[1]; if (!ex) return null;
    // arrange: the spotlight bud (if any) gets each choice in turn; keep the best
    let best = null; const n = G.slots, order = G.star >= 0 && G.star < n ? ex.map((_, a) => a) : [-1];
    for (const a of order) { const s = new Array(n).fill(null); if (a >= 0) { s[G.star] = ex[a]; let j = 0; ex.forEach((x, i) => { if (i === a) return; if (j === G.star) j++; s[j++] = x; }); } else ex.forEach((x, i) => s[i] = x); const e2 = evalGig(G, s); if (!best || e2.stars > best.e.stars) best = { s, e: e2 }; }
    slots.fill(null); best.s.forEach((id, i) => { if (id) place(id, i); }); return best.e.stars;
  },
};
if (BOT) { window.__game.startGig('gig', +(new URLSearchParams(location.search).get('g') || 0)); ui.hideStart(); }
