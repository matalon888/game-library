// sb.js — Storybook Garden (style C) helpers for the calm 50+ games: theme CSS (big serif, ≥20px body, ≥56px taps,
// "Larger text"), painted buttons and sheets, a soft harp + piano audio bed, toast, daily streak with a weekly
// freeze, the stamp album sheet and a spoiler-free share grid. Our own code, MIT. Copied (not shared) per game.
export const A = './assets/';
export const $ = (s, r = document) => r.querySelector(s);
export function h(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
export function css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); return s; }
const eat = el => { ['pointerdown', 'pointerup', 'click', 'touchstart'].forEach(t => el.addEventListener(t, e => e.stopPropagation())); return el; };
export { eat };

// ---------------------------------------------------------------- persistent settings + state
export function saved(key, def) {
  let v; try { v = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
  const o = Object.assign(structuredClone(def), v || {});
  for (const k in def) if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) o[k] = Object.assign(structuredClone(def[k]), (v && v[k]) || {});
  o.save = () => { try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) {} };
  return o;
}

// ---------------------------------------------------------------- theme
export function theme(bgPortrait, bgWide) {
  const f = document.createElement('link'); f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Libre+Baskerville:wght@400;700&display=swap';
  document.head.appendChild(f);
  css(`
:root{--navy:#1F2D54;--rose:#B04A5C;--sage:#567854;--gold:#B08834;--ivory:#FAF6EC;--cream:#F4EEE0;--ink:#1F2D54;--soft:#5b6280}
*{box-sizing:border-box}
html{font-size:20px}html.big{font-size:24px}
html,body{margin:0;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
body{font-family:'Libre Baskerville',Georgia,'Times New Roman',serif;color:var(--ink);background:#efe7d6 url(${A}${bgPortrait}) center 40%/cover no-repeat}
@media (min-aspect-ratio:1/1){body{background-image:url(${A}${bgWide})}}
.disp{font-family:'Cormorant Garamond','Libre Baskerville',Georgia,serif;font-weight:700}
button{font:inherit;color:inherit}
.sb-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:56px;padding:.55rem 1.4rem;border-radius:999px;border:2px solid var(--gold);
  background:linear-gradient(180deg,#2c3c6b,#1F2D54);color:var(--ivory);font-size:1rem;font-weight:700;cursor:pointer;letter-spacing:.2px;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.12),0 6px 16px rgba(31,45,84,.28);transition:transform .12s}
.sb-btn:active{transform:scale(.96)}
.sb-btn.ivory{background:linear-gradient(180deg,#fffdf7,#f3ead6);color:var(--navy);box-shadow:inset 0 0 0 2px rgba(176,136,52,.18),0 6px 16px rgba(31,45,84,.18)}
.sb-btn.rose{background:linear-gradient(180deg,#c25d6f,#a4404f);}
.sb-btn.sage{background:linear-gradient(180deg,#6b8d68,#4f6f4d);}
.sb-btn img{width:36px;height:36px;margin-left:-.6rem}
.sb-btn[disabled]{opacity:.45}
.sb-ic{width:56px;height:56px;border:0;padding:0;background:none;cursor:pointer;border-radius:50%;filter:drop-shadow(0 4px 8px rgba(31,45,84,.28));transition:transform .12s;flex:none}
.sb-ic img{width:100%;height:100%;display:block}
.sb-ic:active{transform:scale(.92)}
.sb-coins{display:flex;align-items:center;gap:.3rem;height:52px;padding:0 .9rem 0 .25rem;border-radius:999px;border:2px solid var(--gold);background:linear-gradient(180deg,#fffdf7,#f1e7d2);
  font-weight:700;font-size:1rem;color:var(--navy);cursor:pointer;box-shadow:0 4px 12px rgba(31,45,84,.2)}
.sb-coins img{width:42px;height:42px}
.sb-coins b{font-size:1.1em;line-height:1;color:var(--gold);margin-left:.15rem}
.sb-veil{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;background:rgba(31,45,84,.32);animation:sbfade .25s ease}
@media (min-width:700px){.sb-veil{align-items:center}}
.sb-sheet{position:relative;width:min(560px,100%);max-height:92vh;overflow:auto;touch-action:pan-y;padding:1.2rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom));
  background:var(--ivory) url(${A}ui/paper.webp) center/320px;border:2px solid var(--gold);border-radius:26px 26px 0 0;box-shadow:0 -10px 40px rgba(31,45,84,.3),inset 0 0 0 6px rgba(250,246,236,.9),inset 0 0 0 7.5px rgba(176,136,52,.55);
  animation:sbup .32s cubic-bezier(.2,.9,.3,1.05)}
@media (min-width:700px){.sb-sheet{border-radius:26px}}
.sb-sheet h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:2rem;margin:.1rem 3rem .2rem;text-align:center;line-height:1.05;color:var(--navy)}
.sb-sheet p{font-size:1rem;line-height:1.45;margin:.4rem 0}
.sb-sheet .x{position:absolute;top:.6rem;right:.6rem}
.sb-div{display:block;width:180px;height:auto;margin:.1rem auto .5rem;opacity:.9}
.sb-row{display:flex;gap:.6rem;align-items:center}
.sb-tog{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:64px;padding:.3rem .2rem;border-bottom:1px solid rgba(176,136,52,.35);font-size:1rem;cursor:pointer}
.sb-tog small{display:block;font-size:.8rem;color:var(--soft);margin-top:.15rem;line-height:1.3}
.sb-sw{flex:none;width:68px;height:40px;border-radius:999px;background:#d9d0bd;position:relative;transition:background .2s;border:2px solid rgba(176,136,52,.6)}
.sb-sw:after{content:'';position:absolute;top:3px;left:3px;width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);transition:left .2s}
.sb-tog.on .sb-sw{background:var(--sage)}.sb-tog.on .sb-sw:after{left:31px}
.sb-toast{position:fixed;left:50%;top:calc(84px + env(safe-area-inset-top));transform:translateX(-50%);z-index:70;background:var(--navy);color:var(--ivory);border:2px solid var(--gold);
  border-radius:999px;padding:.6rem 1.3rem;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 8px 24px rgba(31,45,84,.35);animation:sbtoast 2.4s ease forwards;pointer-events:none}
.sb-album{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-top:.6rem}
.sb-stamp{text-align:center;font-size:.62rem;line-height:1.2;color:var(--soft)}
.sb-stamp img{width:100%;aspect-ratio:1;object-fit:contain;display:block;filter:drop-shadow(0 3px 4px rgba(31,45,84,.2))}
.sb-stamp.no img{filter:grayscale(1) opacity(.28)}
.sb-stamp b{display:block;color:var(--navy);font-size:.66rem}
.sb-grid{font-size:1.3rem;line-height:1.15;text-align:center;letter-spacing:.1em;margin:.6rem 0}
@keyframes sbfade{from{opacity:0}}
@keyframes sbup{from{transform:translateY(60px);opacity:0}}
@keyframes sbtoast{0%{opacity:0;transform:translate(-50%,-14px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
/* the world-board button, restyled to match the painted icons */
.bd-trophy{width:56px!important;height:56px!important;background:var(--navy) url(${A}ui/i-trophy.webp) center/100% no-repeat!important;border:0!important;font-size:0!important;color:transparent!important;box-shadow:0 4px 8px rgba(31,45,84,.28)!important}
.bd-trophy.tr{top:calc(12px + env(safe-area-inset-top))!important;right:12px!important}
.bd-trophy small{font-size:11px!important;bottom:-6px!important}
`);
}

// ---------------------------------------------------------------- small widgets
export function icon(name, label, onClick) {
  const b = eat(h(`<button class="sb-ic" aria-label="${label}"><img src="${A}ui/i-${name}.webp" alt=""></button>`));
  b.addEventListener('click', e => { e.stopPropagation(); onClick && onClick(e); }); return b;
}
let toastEl = null;
export function toast(text) { if (toastEl) toastEl.remove(); toastEl = h(`<div class="sb-toast">${text}</div>`); document.body.appendChild(toastEl); setTimeout(() => toastEl && toastEl.remove(), 2500); }

/** a bottom sheet (centred dialog on desktop). Returns { el, close, done }; done resolves on close. */
let openSheets = 0;
export const sheetOpen = () => openSheets > 0;
export function sheet(inner, { close = true, onClose } = {}) {
  const veil = eat(h(`<div class="sb-veil"><div class="sb-sheet" role="dialog" aria-modal="true">${inner}</div></div>`));
  const box = veil.firstElementChild; let res; const done = new Promise(r => res = r); openSheets++;
  const shut = (v) => { if (!veil.isConnected) return; veil.remove(); openSheets--; onClose && onClose(v); res(v); removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape' && close) shut(); };
  addEventListener('keydown', key);
  if (close) { const x = icon('close', 'Close', () => { snd.tap(); shut(); }); x.classList.add('x'); box.appendChild(x); veil.addEventListener('click', e => { if (e.target === veil) shut(); }); }
  document.body.appendChild(veil);
  return { el: box, close: shut, done };
}
export function toggleRow(label, sub, on, set) {
  const r = h(`<div class="sb-tog ${on ? 'on' : ''}" role="switch" aria-checked="${on}"><div>${label}${sub ? `<small>${sub}</small>` : ''}</div><div class="sb-sw"></div></div>`);
  r.addEventListener('click', () => { on = !on; r.classList.toggle('on', on); r.setAttribute('aria-checked', on); snd.tap(); set(on); }); return r;
}

// ---------------------------------------------------------------- audio: harp plucks + a slow piano bed
let ac = null, master = null, musicGain = null, sfxOn = true, musicOn = true, musicTimer = 0, paused = false;
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master); } catch (e) { return null; } }
  if (ac.state === 'suspended' && !paused) ac.resume();
  return ac;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
/** a soft harp-like pluck */
export function pluck(midi, vol = 0.12, dur = 1.6, dest = null, when = 0) {
  const c = ctx(); if (!c) return; const t = c.currentTime + when, g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, hz(midi) * 6), t); lp.frequency.exponentialRampToValueAtTime(hz(midi) * 1.5, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [m, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.08]]) { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = hz(midi) * m; og.gain.value = v; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
  lp.connect(g); g.connect(dest || master);
}
function noiseTap(freq = 1800, vol = 0.08, dur = 0.05) {
  const c = ctx(); if (!c) return; const t = c.currentTime, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
export const snd = {
  tap: () => sfxOn && noiseTap(2400, 0.05, 0.04),
  pick: () => sfxOn && (noiseTap(1400, 0.06, 0.05), pluck(79, 0.035, 0.4)),
  place: (i = 0) => { if (!sfxOn) return; noiseTap(900, 0.11, 0.07); pluck(PENTA[(i % 7) + 2], 0.07, 1.2); },
  soft: () => sfxOn && noiseTap(700, 0.06, 0.06),
  no: () => sfxOn && (pluck(57, 0.05, 0.5), pluck(56, 0.04, 0.6, null, 0.09)),
  chime: (n = 3) => { if (!sfxOn) return; for (let i = 0; i < n; i++) pluck([72, 76, 79, 84, 88][i % 5], 0.06, 1.6, null, i * 0.09); },
  win: () => { if (!sfxOn) return; [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => pluck(m, 0.08, 2.4, null, i * 0.11)); pluck(48, 0.08, 3, null, 0); pluck(55, 0.06, 3, null, 0.4); },
  coin: () => { if (!sfxOn) return; pluck(88, 0.05, 0.6); pluck(91, 0.05, 0.8, null, 0.07); },
  set sfx(v) { sfxOn = v; }, get sfx() { return sfxOn; },
};
// slow arpeggiated progression, F major: F – Dm – B♭ – C, one note every 0.55 s, long harp decay
const PROG = [[53, 60, 65, 69, 72, 69], [50, 57, 62, 65, 69, 65], [46, 53, 58, 62, 65, 62], [48, 55, 60, 64, 67, 64]];
let step = 0;
function tickMusic() {
  if (!musicOn || paused || document.hidden || !ac) return;
  const ch = PROG[Math.floor(step / 6) % 4], m = ch[step % 6];
  pluck(m, step % 6 === 0 ? 0.05 : 0.032, step % 6 === 0 ? 3.2 : 2.2, musicGain);
  if (step % 24 === 22) pluck(ch[3] + 12, 0.02, 2.5, musicGain);
  step++;
}
export const music = {
  start() { ctx(); if (!musicTimer) musicTimer = setInterval(tickMusic, 560); },
  set on(v) { musicOn = v; if (v) this.start(); }, get on() { return musicOn; },
};
// the kit pauses every AudioContext during an ad; we also stop our own loop until it ends
addEventListener('ap:ad', e => { paused = e.detail && e.detail.phase === 'start'; if (!paused && ac && ac.state === 'suspended') ac.resume(); });
addEventListener('pointerdown', () => { ctx(); if (musicOn) music.start(); }, { once: true, capture: true });

// ---------------------------------------------------------------- dates, daily streak with a weekly freeze
export const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const fromKey = k => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
const weekKey = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };
/** streak = { n, last, freeWeek, extra }. Call streakNow(s) to read it, streakWin(s) on a daily win. */
export const freezes = s => (s.freeWeek !== weekKey() ? 1 : 0) + (s.extra || 0);
export function streakNow(s) {
  if (!s.last) return { n: 0, alive: true };
  const gap = daysBetween(s.last, dayKey());
  if (gap <= 1) return { n: s.n, alive: true, doneToday: gap === 0 };
  return gap - 1 <= freezes(s) ? { n: s.n, alive: true, needFreeze: gap - 1 } : { n: 0, alive: false, lost: s.n };
}
export function streakWin(s) {
  const today = dayKey(); if (s.last === today) return { n: s.n, used: 0 };
  let used = 0;
  if (!s.last) s.n = 1;
  else {
    const gap = daysBetween(s.last, today);
    if (gap === 1) s.n++;
    else if (gap - 1 <= freezes(s)) { used = gap - 1; for (let i = 0; i < used; i++) { if (s.freeWeek !== weekKey()) s.freeWeek = weekKey(); else s.extra = Math.max(0, (s.extra || 0) - 1); } s.n++; }
    else s.n = 1;
  }
  s.last = today; s.best = Math.max(s.best || 0, s.n); return { n: s.n, used };
}
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const prettyDay = (d = new Date()) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

// ---------------------------------------------------------------- album
export function albumSheet(stamps, got) {
  const n = stamps.filter(s => got[s.id]).length;
  const s = sheet(`<h2>Stamp Album</h2><img class="sb-div" src="${A}ui/divider.webp" alt=""><p style="text-align:center"><b>${n} of ${stamps.length}</b> stamps collected</p>
    <div class="sb-album">${stamps.map(t => `<div class="sb-stamp ${got[t.id] ? '' : 'no'}"><img src="${A}stamps/stamp-${t.img}.webp" alt=""><b>${got[t.id] ? t.name : '?'}</b>${t.how}</div>`).join('')}</div>`);
  return s;
}

/** share text: the caller builds the grid; this shares or copies it */
export async function shareText(text) {
  try { if (navigator.share) { await navigator.share({ text }); return true; } } catch (e) { return false; }
  try { await navigator.clipboard.writeText(text); toast('Copied, ready to paste'); return true; } catch (e) { toast('Could not copy'); }
  return false;
}
