// Beatbuds — a beat mixer. Drag sounds onto a line-up of seven singing buds to build a loop: beats, effects,
// melodies and voices, all composed in code. Find each level's hidden combo (and secret ones) for a bonus show.
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, arp, soft } from './calm.js';
import { engine, STEP, STEPS } from './music.js';

const NAME = 'Beatbuds: Beat Maker Music Mix';
const S = store('beatbuds');
const F = flow('beatbuds');                 // no fail state and no difficulty knob: we only record finished levels
const ui = createUI({ title: 'Beatbuds', hint: 'Tap to wake the band', hand: '', score: false, progress: false });
cardTheme({ accent: '#ff5fa2' });
const D = daily('beatbuds', ui, { name: NAME });
const B = board({ game: 'beatbuds', label: 'Combos found', limits: { maxRun: 3, maxPerSec: 1 }, mode: 'sum', corner: 'tl', accent: '#ff5fa2' });
const fx = fx2d(30);
startCard(ui, D, { kicker: D.isDaily ? 'Daily combo · same for everyone' : 'Beat maker', dailySub: 'Same hidden combo for everyone' });
{ const p = document.createElement('p'); const n = S.get('found', []).length; p.textContent = n ? `${n} secret combo${n > 1 ? 's' : ''} found so far` : 'Drag sounds onto the buds. Find the hidden combo.'; p.style.marginTop = '6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
ui.els.win.querySelector('p').innerHTML = 'COMBO <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Found it!';
ui.els.win.querySelector('.hint').textContent = 'Tap for the next hidden combo';

// ---------------------------------------------------------------- sounds + combos
const CATS = [
  { n: 'Beats', c: '#ff8a3d', ids: ['thump', 'bap', 'floor', 'shaker', 'mouth'], ic: ['🥁', '👟', '💥', '🫧', '👄'] },
  { n: 'Effects', c: '#2ec27e', ids: ['bass', 'wobble', 'claps', 'riser', 'bleeps'], ic: ['🎸', '🌀', '👏', '🚀', '📡'] },
  { n: 'Melodies', c: '#3d8bff', ids: ['arp', 'bells', 'pad', 'whistle', 'marimba'], ic: ['🎹', '🔔', '☁️', '🐦', '🪵'] },
  { n: 'Voices', c: '#ff5fa2', ids: ['ooh', 'doo', 'la', 'hey', 'hum'], ic: ['😮', '🎩', '🎤', '🙌', '🎵'] },
];
const SND = {}; CATS.forEach((c, ci) => c.ids.forEach((id, i) => SND[id] = { id, cat: ci, ic: c.ic[i], c: c.c, k: ci * 5 + i }));
const SECRETS = [
  { n: 'Sunset Stroll', s: ['thump', 'pad', 'ooh'] }, { n: 'Robot Picnic', s: ['mouth', 'bleeps', 'doo'] }, { n: 'Rainy Window', s: ['shaker', 'bells', 'hum'] },
  { n: 'Disco Snail', s: ['floor', 'bass', 'la'] }, { n: 'Rocket Party', s: ['bap', 'riser', 'hey'] }, { n: 'Woodland Wobble', s: ['wobble', 'marimba', 'doo'] },
  { n: 'Bird Choir', s: ['claps', 'whistle', 'ooh'] }, { n: 'Night Bus', s: ['bap', 'bass', 'arp'] },
];
const ADJ = ['Midnight', 'Bubble', 'Velvet', 'Cosmic', 'Sleepy', 'Neon', 'Puddle', 'Marsh', 'Pocket', 'Honey', 'Tin', 'Moss'];
const NOUN = ['Bounce', 'Shuffle', 'Parade', 'Lullaby', 'Strut', 'Jam', 'Waltz', 'Hop', 'Groove', 'Shimmy', 'Ripple', 'Sway'];
let R = Math.random;
function makeTarget(level) {
  let s = ((D.seed || S.get('seed', 0) || 1) * 31 + level * 977) % 2147483647 || 1; R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5; i++) R();
  const cats = [0, 1, 2, 3]; cats.splice(Math.floor(R() * 4), 1);
  const ids = cats.map(c => CATS[c].ids[Math.floor(R() * 5)]);
  return { n: `${ADJ[Math.floor(R() * ADJ.length)]} ${NOUN[Math.floor(R() * NOUN.length)]}`, s: ids, shown: 1 };
}
if (!S.get('seed', 0)) S.set('seed', 1 + Math.floor(Math.random() * 1e6));

// ---------------------------------------------------------------- DOM + layout
css(`
body{background:#1b1240;color:#fff}
#stage{position:fixed;inset:0;width:100%;height:100%;z-index:1}
#goal{position:fixed;top:calc(10px + env(safe-area-inset-top));left:max(62px,calc(50% - 220px));right:max(10px,calc(50% - 220px));z-index:5;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:6px 10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#goal .lab{flex:1;min-width:0;line-height:1.1}#goal .lab b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#goal .lab span{font-size:11px;opacity:.75;letter-spacing:1px;text-transform:uppercase;font-weight:700}
.gs{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:19px;border:2px dashed rgba(255,255,255,.5);transition:transform .2s}
.gs.on{border-style:solid;border-color:#fff;transform:scale(1.08);box-shadow:0 0 14px rgba(255,255,255,.5)}
#pal{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom));width:min(100vw,440px);z-index:5;padding:8px 10px;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,rgba(20,12,48,0),rgba(20,12,48,.6) 14%)}
.row{display:flex;gap:6px;align-items:center}
.row em{writing-mode:vertical-rl;transform:rotate(180deg);font-style:normal;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;opacity:.75;width:12px;text-align:center}
.ic{flex:1;aspect-ratio:1;max-height:62px;border-radius:16px;display:grid;place-items:center;font-size:clamp(22px,7vw,30px);box-shadow:0 4px 0 rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.35);cursor:grab;touch-action:none;transition:transform .12s,opacity .2s,filter .2s}
.ic:active{transform:scale(.94)}
.ic.used{opacity:.28;filter:grayscale(.7);box-shadow:none}
.ghost{position:fixed;z-index:50;width:62px;height:62px;border-radius:18px;display:grid;place-items:center;font-size:32px;pointer-events:none;transform:translate(-50%,-60%) scale(1.15);box-shadow:0 12px 24px rgba(0,0,0,.4)}
#found{position:fixed;left:0;right:0;z-index:6;text-align:center;pointer-events:none;font-family:ui-serif,Georgia,serif;font-weight:700;font-size:30px;text-shadow:0 3px 18px rgba(0,0,0,.4);opacity:0;transition:opacity .4s,transform .4s;transform:scale(.8)}
#found.on{opacity:1;transform:scale(1)}
#found small{display:block;font-family:-apple-system,system-ui,sans-serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;opacity:.85}
`);
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const cv = document.createElement('canvas'); cv.id = 'stage'; document.body.prepend(cv); const g = cv.getContext('2d');
const goal = $(`<div id="goal"><div class="lab"><span>Hidden combo</span><b>???</b></div><div class="gs"></div><div class="gs"></div><div class="gs"></div></div>`); document.body.appendChild(goal);
const pal = $(`<div id="pal"></div>`); document.body.appendChild(pal);
const found = $(`<div id="found"></div>`); document.body.appendChild(found);
for (const c of CATS) {
  const row = $(`<div class="row"><em>${c.n}</em></div>`);
  c.ids.forEach((id, i) => { const e = $(`<div class="ic" data-id="${id}">${c.ic[i]}</div>`); e.style.background = `linear-gradient(160deg,${c.c},${shade(c.c, -0.25)})`; row.appendChild(e); SND[id].el = e; });
  pal.appendChild(row);
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
let W, H, dpr, SPOTS = [];
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const palTop = H - pal.getBoundingClientRect().height - 4, top = 70, h = palTop - top;
  const cw = Math.min(W, 520), x0 = (W - cw) / 2, sc = Math.min(1.25, cw / 400, h / 380);
  SPOTS = [];
  for (let i = 0; i < 4; i++) SPOTS.push({ x: x0 + cw * (0.14 + i * 0.24), y: top + h * 0.42, s: sc * 0.82 });
  for (let i = 0; i < 3; i++) SPOTS.push({ x: x0 + cw * (0.26 + i * 0.24), y: top + h * 0.86, s: sc });
  found.style.top = top + h * 0.02 + 'px';
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), target = null, slots = new Array(7).fill(null), A = null;
let bud = [], stepI = 0, nextT = 0, bonusUntil = -1, show = 0, winPending = false, foundNow = [], runT0 = 0, clearedLevel = false;
const HATS = ['cap', 'phones', 'beanie', 'crown', 'antenna', 'bow', 'tophat', 'visor', 'flower', 'horns'];
for (let i = 0; i < 7; i++) bud.push({ mouth: 0, bounce: 0, sway: Math.random() * 6, blink: Math.random() * 4, glow: 0, hop: 0 });

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
    if (s === 0) cues.push({ t: nextT, bar: b, step: stepI });
    nextT += STEP; stepI++;
  }
}
function setTarget() { target = makeTarget(level); winPending = false; clearedLevel = false; foundNow = []; drawGoal(); }
function drawGoal() {
  goal.querySelector('b').textContent = `“${target.n}”`;
  goal.querySelector('span').textContent = D.isDaily ? 'Daily hidden combo' : `Hidden combo ${level}`;
  goal.querySelectorAll('.gs').forEach((e, i) => {
    const id = target.s[i], sd = SND[id], on = slots.includes(id), vis = i < target.shown || on;
    e.textContent = vis ? sd.ic : '?'; e.style.background = sd.c + (vis ? '' : '55'); e.classList.toggle('on', on);
  });
}
const has = set => set.every(id => slots.includes(id));
function place(id, i) {
  if (state !== 'play' || !id) return;
  if (i == null) i = slots.findIndex(x => !x); if (i < 0) i = slots.findIndex(x => SND[x].cat === SND[id].cat); if (i < 0) i = 6;
  const old = slots.indexOf(id); if (old >= 0) slots[old] = null;
  slots[i] = id; bud[i].hop = 1; bud[i].glow = 1;
  const sp = SPOTS[i]; fx.sparks(sp.x, sp.y - 40 * sp.s, [SND[id].c, '#fff'], 14, { speed: 4 }); fx.ring(sp.x, sp.y - 40 * sp.s, SND[id].c, 40);
  note(60 + SND[id].k % 12 + 12, 0.2, 0.06); buzz(10);
  refresh(); check();
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on combo 1, until the first real touch,
// up to two of the combo's already-shown sounds hop onto buds (never the hidden ones, never the whole combo), so the line-up comes alive
demo(() => {
  const id = target.s.slice(0, target.shown).find(x => !slots.includes(x)); if (!id || target.s.filter(x => !slots.includes(x)).length <= 1) return false;
  place(id, slots.findIndex(x => !x));
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !!target && !winPending && slots.some(x => !x), wait: 1800, every: 1300, max: 2 });
function unplace(i) { if (!slots[i] || state !== 'play') return; slots[i] = null; soft.swish(); buzz(6); refresh(); }
function refresh() { for (const id in SND) SND[id].el.classList.toggle('used', slots.includes(id)); drawGoal(); }
function check() {
  // secret combos (once ever), then this level's hidden combo
  const fs = S.get('found', []);
  for (const c of SECRETS) if (!fs.includes(c.n) && has(c.s)) { fs.push(c.n); S.set('found', fs); foundNow.push(c.n); celebrate(c.n, 'Secret combo!'); B.submit(1, { ms: performance.now() - runT0 }); runT0 = performance.now(); }
  if (!winPending && has(target.s)) { winPending = true; celebrate(target.n, 'Hidden combo!'); setTimeout(levelWon, 2600); }
}
function celebrate(name, kicker) {
  bonusUntil = stepI + 32; show = 1;
  found.innerHTML = `<small></small><span></span>`; found.querySelector('small').textContent = kicker; found.querySelector('span').textContent = name; found.classList.add('on');
  setTimeout(() => found.classList.remove('on'), 2400);
  fx.confetti(120); arp([72, 76, 79, 84], 70, 0.08); buzz([20, 30, 20]);
  bud.forEach((b, i) => { if (slots[i]) b.hop = 1.4; });
}
function levelWon() {
  if (state !== 'play') return;
  clearedLevel = true;
  B.submit(1, { ms: performance.now() - runT0 }); runT0 = performance.now(); F.level(true);
  const done = S.get('done', 0) + 1; S.set('done', done);
  D.won(done, 'found');
  if (D.beaten(done)) { ui.pop('BEATEN!', '#ffd35c', 44, 30); }
  state = 'won'; ui.win(level, `“${target.n}” · ${foundNow.length ? foundNow.length + ' secret' + (foundNow.length > 1 ? 's' : '') + ' too · ' : ''}${S.get('found', []).length}/${SECRETS.length} secrets found`);
}
ui.onTap(w => {
  startAudio();
  if (w === 'start') { state = 'play'; runT0 = performance.now(); setTarget(); }
  else if (w === 'win') { if (!D.isDaily) { level++; S.set('level', level); } state = 'play'; setTarget(); check(); }
});

// hint: after 20 s on a combo, reveal one more of its sounds
setInterval(() => { if (state === 'play' && target && target.shown < 3 && (target.t = (target.t || 0) + 1) % 20 === 0) { target.shown++; drawGoal(); ui.pop('Hint!', '#fff', 26, 14); } }, 1000);

// ---------------------------------------------------------------- input: drag a sound onto a bud, tap a sound to add it, tap a bud to free it
let dragS = null;
pal.addEventListener('pointerdown', e => {
  e.stopPropagation(); const el = e.target.closest('.ic'); if (!el || state !== 'play') return;
  const id = el.dataset.id; if (slots.includes(id)) { unplace(slots.indexOf(id)); return; }
  const gh = $(`<div class="ghost">${SND[id].ic}</div>`); gh.style.background = SND[id].c; gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px'; document.body.appendChild(gh);
  dragS = { id, gh, x: e.clientX, y: e.clientY, moved: false }; soft.click();
});
addEventListener('pointermove', e => { if (!dragS) return; dragS.gh.style.left = e.clientX + 'px'; dragS.gh.style.top = e.clientY + 'px'; if (Math.hypot(e.clientX - dragS.x, e.clientY - dragS.y) > 12) dragS.moved = true; });
addEventListener('pointerup', e => {
  if (!dragS) return; const d = dragS; dragS = null; d.gh.remove();
  if (!d.moved) return place(d.id);
  const i = budAt(e.clientX, e.clientY); if (i >= 0) place(d.id, i); else soft.err();
});
function budAt(x, y) { let best = -1, bd = 1e9; SPOTS.forEach((p, i) => { const dd = Math.hypot(p.x - x, p.y - 45 * p.s - y); if (dd < 70 * p.s && dd < bd) { bd = dd; best = i; } }); return best; }
cv.addEventListener('pointerdown', e => { if (state !== 'play') return; const i = budAt(e.clientX, e.clientY); if (i >= 0 && slots[i]) unplace(i); });

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
    hat(HATS[sd.k % HATS.length], shade(sd.c, -0.15), t);
    if (sd.cat === 0) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 50, -60, 8 + b.bounce * 10, sx > 0 ? -0.6 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.6); g.globalAlpha = b.bounce; g.stroke(); } g.globalAlpha = 1; }
    if (sd.cat >= 2 && b.mouth > 0.3) { g.font = '700 18px system-ui'; g.fillStyle = 'rgba(255,255,255,' + b.mouth + ')'; g.fillText('♪', 30 + Math.sin(t * 3 + i) * 4, -110 - b.mouth * 10); }
  }
  g.restore();
}
let lastBar = 0;
function render(now) {
  const t = now / 1000;
  const ct = A ? A.ac.currentTime : 0;
  while (cues.length && cues[0].t <= ct) { const c = cues.shift(); if (c.bar != null) { lastBar = c.bar; continue; } const b = bud[c.i]; if (c.cat === 0 || c.cat === 1) b.bounce = Math.max(b.bounce, Math.min(1, c.amt)); if (c.cat >= 1) b.mouth = Math.max(b.mouth, Math.min(1, c.amt)); }
  for (const b of bud) { b.bounce *= 0.86; b.mouth *= 0.9; b.hop = Math.max(0, b.hop - 0.035); }
  show = Math.max(0, show - 0.003);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a1a63'); bg.addColorStop(0.6, '#1b1240'); bg.addColorStop(1, '#120c2c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // light beams (stronger during a combo show)
  const active = slots.filter(Boolean).length;
  for (let i = 0; i < 5; i++) {
    const a = Math.sin(t * (0.5 + i * 0.13) + i) * 0.5, x = W * (0.1 + i * 0.2);
    g.save(); g.translate(x, -20); g.rotate(a); const lg = g.createLinearGradient(0, 0, 0, H * 0.8);
    const col = ['#ff5fa2', '#3d8bff', '#ffd35c', '#2ec27e', '#ff8a3d'][i];
    lg.addColorStop(0, col + (show > 0.1 ? 'aa' : active ? '33' : '14')); lg.addColorStop(1, col + '00'); g.fillStyle = lg;
    g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.lineTo(90, H * 0.8); g.lineTo(-90, H * 0.8); g.closePath(); g.fill(); g.restore();
  }
  // stage floor
  if (SPOTS.length) {
    const fy = SPOTS[0].y - 6; g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.ellipse(W / 2, fy + 8, W * 0.55, 26, 0, 0, Math.PI * 2); g.fill();
    const fy2 = SPOTS[4].y - 6; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.ellipse(W / 2, fy2 + 10, W * 0.6, 32, 0, 0, Math.PI * 2); g.fill();
    // beat pulse on the floor
    const pulse = bud.reduce((m, b, i) => slots[i] && SND[slots[i]].cat === 0 ? Math.max(m, b.bounce) : m, 0);
    if (pulse > 0.05) { g.strokeStyle = `rgba(255,255,255,${pulse * 0.25})`; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, fy2 + 10, W * 0.6 * (1 + (1 - pulse) * 0.1), 32, 0, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 7; i++) drawBud(i, t, now);
  }
  // bar dots (4-bar loop position)
  if (A && active) { for (let i = 0; i < 4; i++) { g.fillStyle = i === lastBar ? '#fff' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(W / 2 - 27 + i * 18, 66 + (innerHeight > 700 ? 6 : 0), 4, 0, 7); g.fill(); } }
  requestAnimationFrame(render);
}
requestAnimationFrame(t => { layout(); render(t); });
ui.start();

// ---------------------------------------------------------------- bot
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return S.get('done', 0); },
  bot() {
    if (state !== 'play' || winPending) return;
    const miss = target.s.filter(id => !slots.includes(id));
    if (!miss.length) return;
    const id = miss[0], free = slots.findIndex(x => !x);
    if (free >= 0) return place(id, free);
    const drop = slots.findIndex(x => !target.s.includes(x)); place(id, drop);
  },
};
