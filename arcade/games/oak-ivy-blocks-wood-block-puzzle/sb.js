// sb.js: the Storybook Garden (style C) shell shared by our calm 2D games. DOM + one particle canvas.
// Paper-and-gold UI, sheets, toasts, floating words, petal particles, fly-to animations, harp/piano audio composed in
// code, settings (Larger text, sound, music), a forgiving daily streak (one freeze a week), the stamp album and the
// spoiler-free share. Our own code. Each game folder ships its own copy (publish ships only the game folder).

export const PAL = { navy: '#1F2D54', rose: '#B04A5C', sage: '#567854', gold: '#B08834', ivory: '#FAF6EC', cream: '#F4EEE0' };
export const A = p => `assets/${p}.webp`;
export const $ = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
export const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const weekOf = dn => Math.floor((dn + 3) / 7);
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
export function store(key) {
  return {
    get(k, d) { try { const v = localStorage.getItem(key + '_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(key + '_' + k, JSON.stringify(v)); } catch (e) {} },
  };
}

// ---------------------------------------------------------------- CSS
const CSS = `
:root{--navy:#1F2D54;--rose:#B04A5C;--sage:#567854;--gold:#B08834;--gold2:#d6b46a;--ivory:#FAF6EC;--cream:#F4EEE0;--ink:#1F2D54;--fs:1;
  --serif:'Libre Baskerville',Baskerville,Georgia,'Times New Roman',serif;--disp:'Cormorant Garamond','Libre Baskerville',Georgia,serif}
html.sb-big{--fs:1.18}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#f4eee0;color:var(--ink);font-family:var(--serif);
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
button{font:inherit;color:inherit}
.sb-bg{position:fixed;inset:0;background-size:cover;background-position:center 40%;background-repeat:no-repeat;z-index:0;transition:opacity .5s}
.sb-hidden{display:none!important}
.sb-btn{pointer-events:auto;position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:56px;min-width:56px;
  padding:8px 22px;border-radius:18px;cursor:pointer;font:700 calc(21px*var(--fs))/1.1 var(--serif);color:var(--navy);letter-spacing:.2px;
  background:linear-gradient(180deg,#fffdf6,#f3e8d0);border:2px solid #c6a35a;
  box-shadow:inset 0 0 0 3px #fffaf0,inset 0 0 0 4.5px rgba(176,136,52,.55),0 4px 0 #b99a5c,0 8px 18px rgba(31,45,84,.22);transition:transform .12s,box-shadow .12s}
.sb-btn:active{transform:translateY(3px);box-shadow:inset 0 0 0 3px #fffaf0,inset 0 0 0 4.5px rgba(176,136,52,.55),0 1px 0 #b99a5c,0 3px 8px rgba(31,45,84,.2)}
.sb-btn img{width:44px;height:44px;margin-left:-10px;flex:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.18))}
.sb-btn small{display:block;font:400 calc(17px*var(--fs))/1.2 var(--serif);opacity:.85;margin-top:3px}
.sb-btn.navy{background:linear-gradient(180deg,#2c3d6b,#1b2749);color:#fbf3df;border-color:#d6b46a;box-shadow:inset 0 0 0 3px #22305a,inset 0 0 0 4.5px rgba(214,180,106,.7),0 4px 0 #0f1730,0 8px 18px rgba(31,45,84,.35)}
.sb-btn.rose{background:linear-gradient(180deg,#c35e70,#9c3e50);color:#fff7ee;border-color:#e2c27c;box-shadow:inset 0 0 0 3px #b04a5c,inset 0 0 0 4.5px rgba(240,210,140,.7),0 4px 0 #74283a,0 8px 18px rgba(120,40,60,.3)}
.sb-btn.sage{background:linear-gradient(180deg,#6d9068,#4b6b49);color:#fbf6e6;border-color:#dcc07c;box-shadow:inset 0 0 0 3px #567854,inset 0 0 0 4.5px rgba(240,215,150,.7),0 4px 0 #34502f,0 8px 18px rgba(40,70,40,.3)}
.sb-btn.big{font-size:calc(26px*var(--fs));min-height:68px;padding:10px 30px;border-radius:22px}
.sb-btn[disabled]{opacity:.5;pointer-events:none}
.sb-round{width:58px;height:58px;padding:0;border:0;background:none;box-shadow:none;min-width:0;border-radius:50%;cursor:pointer;position:relative;pointer-events:auto;filter:drop-shadow(0 4px 6px rgba(31,45,84,.28))}
.sb-round img{width:100%;height:100%;display:block}
.sb-round:active{transform:scale(.92)}
.sb-round b{position:absolute;right:-4px;top:-4px;min-width:26px;height:26px;border-radius:13px;background:var(--rose);color:#fff;font:700 15px/26px var(--serif);text-align:center;padding:0 6px;box-shadow:0 0 0 2px #fff8ea}
.sb-pill{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;height:50px;padding:0 8px 0 4px;border-radius:25px;cursor:pointer;
  background:linear-gradient(180deg,#fffdf6,#f2e7cf);border:2px solid #c6a35a;box-shadow:inset 0 0 0 2px #fffaf0,0 4px 10px rgba(31,45,84,.2);font:700 calc(21px*var(--fs))/1 var(--serif);color:var(--navy)}
.sb-pill>img{width:40px;height:40px}
.sb-pill .plus{width:30px;height:30px;border-radius:50%;background:var(--navy);color:#f7e7bf;display:grid;place-items:center;font:700 22px/1 var(--serif);box-shadow:0 0 0 2px #d6b46a}
.sb-pill.bump{animation:sbbump .35s}
@keyframes sbbump{40%{transform:scale(1.14)}}
.sb-ribbon{position:relative;display:grid;place-items:center;min-width:240px;height:72px;padding:0 54px 12px;background:url(${A('kit/ribbon-rose')}) center/100% 100% no-repeat;
  color:#fff6e8;font:700 calc(22px*var(--fs))/1.05 var(--serif);text-align:center;text-shadow:0 1px 2px rgba(80,20,30,.45);letter-spacing:.6px}
.sb-ribbon.navy{background-image:url(${A('kit/ribbon-navy')})} .sb-ribbon.sage{background-image:url(${A('kit/ribbon-sage')})}
.sb-ribbon small{display:block;font-size:.72em;letter-spacing:1.6px;text-transform:uppercase;opacity:.92}
/* sheets */
.sb-veil{position:fixed;inset:0;z-index:80;background:rgba(31,45,84,.38);display:flex;align-items:center;justify-content:center;padding:16px;animation:sbfade .25s}
.sb-veil.out{animation:sbfadeout .2s forwards}
@keyframes sbfade{from{opacity:0}} @keyframes sbfadeout{to{opacity:0}}
.sb-sheet{position:relative;width:min(470px,100%);max-height:calc(100% - 16px);overflow:auto;border-radius:22px;padding:26px 22px 34px;text-align:center;color:var(--navy);
  background:#fbf6ea url(${A('kit/paper')}) center/360px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 5px #fbf6ea,inset 0 0 0 6.5px rgba(176,136,52,.6),0 24px 60px rgba(20,28,55,.45);
  animation:sbpop .38s cubic-bezier(.2,1.4,.4,1);font-size:calc(20px*var(--fs));line-height:1.4;scrollbar-width:none}
.sb-sheet::-webkit-scrollbar{display:none}
.sb-sheet .corner{position:absolute;width:88px;pointer-events:none;opacity:.95}
.sb-sheet .corner.tl{left:-6px;top:-6px} .sb-sheet .corner.br{right:-6px;bottom:-6px;transform:rotate(180deg)}
.sb-sheet h2{margin:2px 0 8px;font:700 calc(34px*var(--fs))/1.05 var(--disp);color:var(--navy)}
.sb-sheet p{margin:8px 0;font-size:calc(20px*var(--fs))}
.sb-sheet .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:14px}
.sb-sheet .divider{display:block;width:62%;margin:6px auto 4px;opacity:.9}
.sb-x{position:absolute;right:10px;top:10px;width:56px;height:56px;border:0;background:none;padding:6px;cursor:pointer;z-index:2}
.sb-x img{width:100%;height:100%}
@keyframes sbpop{from{opacity:0;transform:translateY(24px) scale(.94)}}
.sb-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 6px;border-top:1px solid rgba(176,136,52,.35);font-size:calc(21px*var(--fs));text-align:left}
.sb-toggle button{width:80px;height:46px;border-radius:23px;border:2px solid #c6a35a;background:#e9e0cc;position:relative;cursor:pointer;flex:none}
.sb-toggle button::after{content:'';position:absolute;left:4px;top:4px;width:34px;height:34px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:left .2s}
.sb-toggle button[aria-pressed=true]{background:var(--sage)} .sb-toggle button[aria-pressed=true]::after{left:38px}
/* toast + floating words */
.sb-toast{position:fixed;left:50%;top:calc(84px + env(safe-area-inset-top));transform:translateX(-50%);z-index:90;max-width:calc(100% - 32px);width:max-content;
  background:#fbf6ea;border:2px solid #c6a35a;border-radius:16px;padding:10px 18px;font:700 calc(20px*var(--fs))/1.3 var(--serif);color:var(--navy);text-align:center;
  box-shadow:0 10px 24px rgba(31,45,84,.28);animation:sbtoast 3s forwards;pointer-events:none}
@keyframes sbtoast{0%{opacity:0;transform:translate(-50%,-12px)}8%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-8px)}}
.sb-word{position:fixed;z-index:60;pointer-events:none;white-space:nowrap;transform:translate(-50%,-50%);font:italic 700 44px/1 var(--disp);color:#fff7e2;
  -webkit-text-stroke:1.5px rgba(31,45,84,.85);paint-order:stroke fill;text-shadow:0 3px 0 rgba(31,45,84,.55),0 6px 16px rgba(31,45,84,.35);animation:sbword 1.25s ease-out forwards}
@keyframes sbword{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}30%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-110%) scale(1)}}
.sb-fx{position:fixed;inset:0;pointer-events:none;z-index:70}
.sb-fly{position:fixed;z-index:75;pointer-events:none;left:0;top:0;will-change:transform}
/* album */
.sb-album{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
.sb-album div{aspect-ratio:1/1.08;border-radius:8px;display:grid;place-items:center;background:rgba(176,136,52,.08);border:1.5px dashed rgba(176,136,52,.45);position:relative}
.sb-album img{width:100%;height:100%;object-fit:contain}
.sb-album .miss img{filter:grayscale(1) sepia(.3);opacity:.16}
.sb-album .new::after{content:'new';position:absolute;top:-6px;right:-6px;background:var(--rose);color:#fff;font:700 15px/1 var(--serif);padding:4px 7px;border-radius:10px}
.sb-pager{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sb-pager b{font:700 calc(22px*var(--fs))/1.2 var(--disp)}
.sb-stamp-big{width:min(230px,60vw);margin:6px auto;display:block;animation:sbstamp .7s cubic-bezier(.2,1.5,.4,1);filter:drop-shadow(0 8px 12px rgba(31,45,84,.3))}
@keyframes sbstamp{from{opacity:0;transform:scale(1.6) rotate(-14deg)}}
.sb-stars{display:flex;justify-content:center;gap:6px;margin:6px 0}
.sb-stars img{width:66px;height:66px;filter:drop-shadow(0 4px 4px rgba(120,90,20,.3))}
.sb-stars img.on{animation:sbstar .5s cubic-bezier(.2,1.6,.4,1) both}
.sb-stars img:nth-child(2){width:80px;height:80px;margin-top:-12px}
@keyframes sbstar{from{transform:scale(0) rotate(-40deg);opacity:0}}
/* kit trophy (board.js) restyled for style C: bigger, navy + gold */
.bd-trophy{width:56px!important;height:56px!important;background:radial-gradient(circle at 50% 40%,#2f4274,#1b2749)!important;border:2.5px solid #d6b46a!important;font-size:24px!important;box-shadow:0 4px 10px rgba(31,45,84,.3)!important}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;
export function injectCSS(extra = '') {
  const s = document.createElement('style'); s.textContent = CSS + extra; document.head.appendChild(s);
}

// ---------------------------------------------------------------- preferences (Larger text, sound, music)
export function prefs(key) {
  const S = store(key + '_pref');
  const P = { big: S.get('big', false), sound: S.get('sound', true), music: S.get('music', true) };
  const apply = () => document.documentElement.classList.toggle('sb-big', !!P.big);
  apply();
  return { get: k => P[k], set(k, v) { P[k] = v; S.set(k, v); apply(); audio.setSound(P.sound); audio.setMusic(P.music); }, init() { audio.setSound(P.sound); audio.setMusic(P.music, false); } };
}

// ---------------------------------------------------------------- background (portrait or painted wide, never cropped badly)
export function background(el) {
  let cur = '';
  const set = (name) => {
    const wide = innerWidth / innerHeight >= 1, lo = Math.min(devicePixelRatio || 1, 2) * Math.max(innerWidth, innerHeight) < 1100;
    const f = A(`bg/${name}${wide ? '-wide' : ''}${lo ? '-s' : ''}`);
    if (f === cur) return; cur = f;
    // half-size first (fast), then the full painting
    el.style.backgroundImage = `url(${f})`;
    if (lo) { const im = new Image(); im.onload = () => { if (cur === f) el.style.backgroundImage = `url(${A(`bg/${name}${wide ? '-wide' : ''}`)})`; }; im.src = A(`bg/${name}${wide ? '-wide' : ''}`); }
  };
  let name = '';
  addEventListener('resize', () => name && set(name));
  return { show(n) { name = n; cur = ''; set(n); }, get name() { return name; } };
}

// ---------------------------------------------------------------- sheets + toasts
let openSheets = 0;
export const sheetOpen = () => openSheets > 0;
export function sheet({ html, closable = true, onClose = null, cls = '' }) {
  const veil = $(`<div class="sb-veil"><div class="sb-sheet ${cls}" role="dialog" aria-modal="true">
    <img class="corner tl" src="${A('kit/corner-roses')}" alt=""><img class="corner br" src="${A('kit/corner-roses')}" alt="">
    ${closable ? `<button class="sb-x" aria-label="Close"><img src="${A('icons/close')}" alt=""></button>` : ''}${html}</div></div>`);
  openSheets++;
  ['pointerdown', 'pointerup', 'pointermove', 'touchstart'].forEach(t => veil.addEventListener(t, e => e.stopPropagation()));
  let done = false;
  const close = () => { if (done) return; done = true; openSheets--; veil.classList.add('out'); setTimeout(() => veil.remove(), 200); onClose && onClose(); };
  if (closable) { veil.querySelector('.sb-x').onclick = () => { audio.tap(); close(); }; veil.addEventListener('click', e => { if (e.target === veil) close(); }); }
  const onKey = e => { if (e.key === 'Escape' && closable && !done) { close(); removeEventListener('keydown', onKey); } };
  addEventListener('keydown', onKey);
  document.body.appendChild(veil);
  const s = veil.firstElementChild;
  return { root: s, close, q: sel => s.querySelector(sel) };
}
export function toast(text, ms = 3000) {
  document.querySelectorAll('.sb-toast').forEach(t => t.remove());
  const t = $(`<div class="sb-toast">${text}</div>`); t.style.animationDuration = ms + 'ms'; document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
export function word(text, x, y, size = 44, color = null) {
  const d = $(`<div class="sb-word">${text}</div>`); d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.fontSize = size + 'px'; if (color) d.style.color = color;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
}

// ---------------------------------------------------------------- particles: petals, leaves, gold sparkles
const fxC = document.createElement('canvas'); fxC.className = 'sb-fx';
const fxX = fxC.getContext('2d'); const parts = []; let fxOn = false;
function fxSize() { const d = Math.min(devicePixelRatio || 1, 2); fxC.width = innerWidth * d; fxC.height = innerHeight * d; fxX.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', fxSize);
export function fxMount() { document.body.appendChild(fxC); fxSize(); }
const PETAL = ['#f2b8c0', '#e8909f', '#f7d6db', '#fff3e6', '#b04a5c'], LEAF = ['#8fae7f', '#6f9466', '#a9c39a'], GOLD = ['#e8c873', '#d6b46a', '#fff1c4'];
export const fx = {
  burst(x, y, n = 16, { kind = 'mix', speed = 4, colors = null, up = 2.5 } = {}) {
    if (reduced) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const k = kind === 'mix' ? (i % 3 === 0 ? 'leaf' : i % 3 === 1 ? 'petal' : 'spark') : kind;
      const pal = colors || (k === 'leaf' ? LEAF : k === 'spark' ? GOLD : PETAL);
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      parts.push({ k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, r: Math.random() * 6, vr: (Math.random() - .5) * .25, s: (k === 'spark' ? 5 : 7) + Math.random() * 6,
        c: pal[(Math.random() * pal.length) | 0], life: 1, dl: 0.012 + Math.random() * 0.01, sway: Math.random() * 6 });
    }
    if (!fxOn) { fxOn = true; requestAnimationFrame(fxTick); }
  },
  rain(n = 40) { for (let i = 0; i < n; i++) setTimeout(() => fx.burst(Math.random() * innerWidth, -10, 1, { kind: i % 2 ? 'petal' : 'leaf', speed: 1, up: -1.5 }), i * 40); },
};
function fxTick() {
  fxX.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.vy += p.k === 'spark' ? 0.12 : 0.07; p.vx *= 0.985; p.vy = Math.min(p.vy, p.k === 'spark' ? 6 : 2.6);
    p.x += p.vx + (p.k === 'spark' ? 0 : Math.sin((p.life + p.sway) * 9) * 0.6); p.y += p.vy; p.r += p.vr; p.life -= p.dl;
    if (p.life <= 0 || p.y > innerHeight + 30) { parts.splice(i, 1); continue; }
    fxX.save(); fxX.globalAlpha = Math.min(1, p.life * 1.6); fxX.translate(p.x, p.y); fxX.rotate(p.r); fxX.fillStyle = p.c;
    if (p.k === 'spark') { const s = p.s; fxX.beginPath(); for (let j = 0; j < 8; j++) { const rr = j % 2 ? s * 0.28 : s; const aa = j * Math.PI / 4; fxX.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } fxX.fill(); }
    else if (p.k === 'leaf') { fxX.beginPath(); fxX.ellipse(0, 0, p.s * 1.1, p.s * 0.48, 0, 0, 7); fxX.fill(); fxX.strokeStyle = 'rgba(40,70,40,.45)'; fxX.lineWidth = 1; fxX.beginPath(); fxX.moveTo(-p.s, 0); fxX.lineTo(p.s, 0); fxX.stroke(); }
    else { fxX.beginPath(); fxX.moveTo(0, -p.s * .7); fxX.bezierCurveTo(p.s * .9, -p.s * .6, p.s * .7, p.s * .7, 0, p.s * .8); fxX.bezierCurveTo(-p.s * .7, p.s * .7, -p.s * .9, -p.s * .6, 0, -p.s * .7); fxX.fill(); }
    fxX.restore();
  }
  if (parts.length) requestAnimationFrame(fxTick); else { fxOn = false; fxX.clearRect(0, 0, innerWidth, innerHeight); }
}

/** fly a sprite from a screen point to an element (coins, stars, collected items). Resolves on arrival. */
export function flyTo(src, from, toEl, { size = 44, dur = 650, arc = -90, delay = 0 } = {}) {
  return new Promise(res => setTimeout(() => {
    const r = toEl.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const im = document.createElement('img'); im.src = src; im.className = 'sb-fly'; im.style.width = size + 'px'; document.body.appendChild(im);
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = from.x + (tx - from.x) * e, y = from.y + (ty - from.y) * e + arc * Math.sin(Math.PI * e);
      const sc = 1 + 0.25 * Math.sin(Math.PI * k) - 0.35 * k;
      im.style.transform = `translate(${x - size / 2}px,${y - size / 2}px) scale(${sc})`;
      if (k < 1) requestAnimationFrame(step); else { im.remove(); res(); }
    };
    requestAnimationFrame(step);
  }, delay));
}
export function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
export const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ---------------------------------------------------------------- audio: harp plucks, soft wood, a quiet piano loop
export const audio = (() => {
  let ctx = null, master, sfxG, musG, soundOn = true, musicOn = true, musTimer = 0, musStep = 0, paused = false, wantMusic = false;
  const ensure = () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.connect(master);
        sfxG = ctx.createGain(); sfxG.gain.value = soundOn ? 1 : 0; sfxG.connect(lp);
        musG = ctx.createGain(); musG.gain.value = 0; musG.connect(lp);
      } catch (e) { return null; }
    }
    if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {});
    return ctx;
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function pluck(midi, { t = 0, vol = 0.16, dur = 1.4, bus = null, bright = 1 } = {}) {
    if (!ensure()) return; const n = ctx.currentTime + t, f = hz(midi), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, n + dur);
    for (const [m, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.42 * bright], [3, 'sine', 0.16 * bright], [4.01, 'sine', 0.06 * bright]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v;
      if (m > 1) { og.gain.setValueAtTime(v, n); og.gain.exponentialRampToValueAtTime(0.0005, n + dur * 0.45); }
      o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
    }
    g.connect(bus || sfxG);
  }
  function wood({ t = 0, vol = 0.22, f = 900 } = {}) {
    if (!ensure()) return; const n = ctx.currentTime + t;
    const len = Math.floor(ctx.sampleRate * 0.06), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource(); src.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.value = vol; src.connect(bp); bp.connect(g); g.connect(sfxG); src.start(n);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.24, n); o.frequency.exponentialRampToValueAtTime(f * 0.15, n + 0.09);
    og.gain.setValueAtTime(vol * 0.9, n); og.gain.exponentialRampToValueAtTime(0.001, n + 0.12); o.connect(og); og.connect(sfxG); o.start(n); o.stop(n + 0.14);
  }
  const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88];
  // music: slow arpeggiated piano chords, I–vi–IV–V in F, 66 bpm, very quiet
  const CH = [[53, 60, 65, 69, 72], [50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67]];
  const MEL = [77, null, 76, null, 72, null, 74, null, 74, null, 72, 69, 70, null, 72, null];
  function tickMusic() {
    if (!ctx || !musicOn || paused || document.hidden) return;
    const beat = 60 / 66 / 2; // eighths
    const bar = Math.floor(musStep / 8) % 4, i = musStep % 8, ch = CH[bar];
    if (i === 0) pluck(ch[0] - 12, { vol: 0.07, dur: 3.2, bus: musG, bright: 0.5 });
    if (i % 2 === 0 || i === 3) pluck(ch[1 + (i % 4)], { vol: 0.04, dur: 2.2, bus: musG, bright: 0.6 });
    const m = MEL[(musStep % 16)]; if (m && (Math.floor(musStep / 32) % 2 === 1)) pluck(m, { vol: 0.045, dur: 2, bus: musG, bright: 0.7 });
    musStep++; musTimer = setTimeout(tickMusic, beat * 1000);
  }
  function startMusic() {
    if (!musicOn || musTimer || paused) return; if (!ensure()) return;
    musG.gain.cancelScheduledValues(ctx.currentTime); musG.gain.setTargetAtTime(1, ctx.currentTime, 0.8); tickMusic();
  }
  function stopMusic() { clearTimeout(musTimer); musTimer = 0; if (ctx) musG.gain.setTargetAtTime(0, ctx.currentTime, 0.2); }
  addEventListener('ap:ad', e => { if (e.detail && e.detail.phase === 'start') { paused = true; stopMusic(); } else { paused = false; if (wantMusic) setTimeout(startMusic, 300); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else if (wantMusic) startMusic(); });
  return {
    unlock() { ensure(); if (wantMusic) startMusic(); },
    setSound(on) { soundOn = on; if (sfxG) sfxG.gain.value = on ? 1 : 0; },
    setMusic(on, start = true) { musicOn = on; if (!on) stopMusic(); else if (start && wantMusic) startMusic(); },
    music(on) { wantMusic = on; if (on) startMusic(); else stopMusic(); },
    pluck, wood,
    tap: () => pluck(79, { vol: 0.07, dur: 0.35, bright: 0.4 }),
    pick: () => { wood({ vol: 0.12, f: 1300 }); },
    place: (i = 0) => { wood({ vol: 0.24, f: 820 }); pluck(PENTA[Math.min(PENTA.length - 1, 2 + i)], { t: 0.02, vol: 0.06, dur: 0.8, bright: 0.5 }); },
    bad: () => { wood({ vol: 0.1, f: 500 }); },
    clear: (groups = 1, combo = 1) => { const base = Math.min(5, combo - 1); const n = 3 + groups * 2; for (let k = 0; k < n; k++) pluck(PENTA[Math.min(PENTA.length - 1, base + k)], { t: k * 0.055, vol: 0.12, dur: 1.6 }); },
    chime: () => { pluck(88, { vol: 0.08, dur: 1 }); pluck(93, { t: 0.08, vol: 0.07, dur: 1.2 }); },
    coin: () => { pluck(84, { vol: 0.06, dur: 0.5 }); pluck(91, { t: 0.06, vol: 0.06, dur: 0.7 }); },
    star: (i = 0) => pluck([76, 79, 84][i] || 84, { vol: 0.13, dur: 1.4 }),
    win: () => [65, 69, 72, 77, 81, 84].forEach((m, k) => pluck(m, { t: k * 0.09, vol: 0.13, dur: 2 })),
    lose: () => { pluck(69, { vol: 0.1, dur: 1.4 }); pluck(65, { t: 0.32, vol: 0.1, dur: 1.8 }); },
    gliss: () => { for (let k = 0; k < 9; k++) pluck(PENTA[k + 2], { t: k * 0.04, vol: 0.08, dur: 1.2 }); },
  };
})();

// ---------------------------------------------------------------- daily streak with one freeze a week (never wiped by a missed day if a freeze is left)
export function streak(S) {
  let st = S.get('streak', { last: 0, n: 0, frz: -1 });
  const today = dayNum();
  const alive = () => st.last === today || st.last === today - 1 || (st.last === today - 2 && st.frz !== weekOf(today));
  return {
    get n() { return alive() ? st.n : 0; },
    get doneToday() { return st.last === today; },
    get freezeLeft() { return st.frz !== weekOf(today); },
    win() {
      if (st.last === today) return { n: st.n, froze: false };
      let froze = false;
      if (st.last === today - 1) st.n++;
      else if (st.last === today - 2 && st.frz !== weekOf(today)) { st.n++; st.frz = weekOf(today); froze = true; }
      else st.n = 1;
      st.last = today; S.set('streak', st); return { n: st.n, froze };
    },
  };
}

export async function share(text, { onCopied } = {}) {
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ text }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text); toast('Copied. Paste it to a friend ✿'); onCopied && onCopied(); } catch (e) { toast('Could not copy this time'); }
}

// ---------------------------------------------------------------- stamp album (24 painted stamps, 4 pages of 6)
export const STAMPS = ['robin', 'rose', 'teapot', 'cottage', 'bluebells', 'butterfly', 'peony', 'hedgehog', 'lighthouse', 'cat', 'sunflower', 'bluetit',
  'hydrangea', 'swan', 'beehive', 'teacup', 'fox', 'lavender', 'owl', 'strawberry', 'sailboat', 'squirrel', 'tulip', 'kingfisher'];
export const PAGES = ['Garden Friends', 'Blooms & Tea', 'Seaside Days', 'Woodland Walk'];
export function album(S, { M = null, pageBonus = 150, onChange = null } = {}) {
  let got = S.get('stamps', []), fresh = S.get('stampsNew', []), paid = S.get('pagesPaid', []);
  const save = () => { S.set('stamps', got); S.set('stampsNew', fresh); S.set('pagesPaid', paid); onChange && onChange(); };
  const api = {
    get count() { return got.length; }, get fresh() { return fresh.length; }, has: id => got.includes(id),
    /** a new stamp (random among the missing ones), or null when the album is full */
    award(rnd = Math.random) {
      const miss = STAMPS.filter(s => !got.includes(s)); if (!miss.length) return null;
      // fill page by page so pages complete (completion is the hook): pick from the first page that has gaps
      const page = Math.floor(STAMPS.indexOf(miss[0]) / 6), pool = miss.filter(s => Math.floor(STAMPS.indexOf(s) / 6) === page);
      const id = pool[(rnd() * pool.length) | 0]; got.push(id); fresh.push(id);
      let bonus = 0; const pg = Math.floor(STAMPS.indexOf(id) / 6);
      if (STAMPS.slice(pg * 6, pg * 6 + 6).every(s => got.includes(s)) && !paid.includes(pg)) { paid.push(pg); bonus = pageBonus; M && M.add(bonus, 'album-page'); }
      save(); return { id, page: pg, pageName: PAGES[pg], bonus };
    },
    open() {
      let pg = Math.max(0, Math.min(3, fresh.length ? Math.floor(STAMPS.indexOf(fresh[0]) / 6) : Math.floor(Math.max(0, got.length - 1) / 6)));
      const sh = sheet({ html: `<h2>Stamp Album</h2><p style="margin-top:0"><span data-c></span> of 24 collected</p><img class="divider" src="${A('kit/divider')}" alt=""><div class="sb-pager"><button class="sb-round" data-prev aria-label="Previous page" style="width:56px;height:56px"><img src="${A('icons/undo')}" alt=""></button><b data-t></b><button class="sb-round" data-next aria-label="Next page" style="width:56px;height:56px;transform:scaleX(-1)"><img src="${A('icons/undo')}" alt=""></button></div><div class="sb-album"></div><p data-f style="font-size:calc(19px*var(--fs))"></p>`, onClose: () => { fresh = []; save(); } });
      const draw = () => {
        sh.q('[data-c]').textContent = got.length; sh.q('[data-t]').textContent = PAGES[pg];
        sh.q('.sb-album').innerHTML = STAMPS.slice(pg * 6, pg * 6 + 6).map(s => `<div class="${got.includes(s) ? '' : 'miss'} ${fresh.includes(s) ? 'new' : ''}"><img src="${A('stamps/stamp-' + s)}" alt="${s}"></div>`).join('');
        const have = STAMPS.slice(pg * 6, pg * 6 + 6).filter(s => got.includes(s)).length;
        sh.q('[data-f]').textContent = have === 6 ? `Page complete ✿ (+${pageBonus} coins paid)` : `Fill this page for ${pageBonus} coins. Stamps come from wins and daily puzzles.`;
      };
      sh.q('[data-prev]').onclick = () => { pg = (pg + 3) % 4; audio.tap(); draw(); };
      sh.q('[data-next]').onclick = () => { pg = (pg + 1) % 4; audio.tap(); draw(); };
      draw();
    },
  };
  return api;
}

/** settings sheet: Larger text, sound, music, how to play, and the shop */
export function settingsSheet(P, { howTo = '', M = null, extra = '' } = {}) {
  const t = (k, label) => `<div class="sb-toggle"><span>${label}</span><button aria-pressed="${!!P.get(k)}" data-k="${k}" aria-label="${label}"></button></div>`;
  const sh = sheet({ html: `<h2>Settings</h2><img class="divider" src="${A('kit/divider')}" alt="">${t('big', 'Larger text')}${t('sound', 'Sound effects')}${t('music', 'Gentle music')}
    ${howTo ? `<div class="sb-toggle" style="display:block"><b>How to play</b><p style="margin:6px 0 0;font-size:calc(19px*var(--fs))">${howTo}</p></div>` : ''}${extra}
    <div class="row"><button class="sb-btn" data-shop><img src="${A('icons/shop')}" alt="">The Shop</button></div>` });
  sh.root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k, v = !P.get(k); P.set(k, v); b.setAttribute('aria-pressed', v); audio.tap(); });
  sh.q('[data-shop]').onclick = () => { sh.close(); M && M.shop(); };
  return sh;
}

export function preload(srcs, onProgress) {
  let n = 0; return Promise.all(srcs.map(s => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => { n++; onProgress && onProgress(n / srcs.length); r(); }; i.src = s; })));
}
