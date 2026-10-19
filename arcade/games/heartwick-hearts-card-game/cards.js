// cards.js — card table helpers shared (by copy) by our card games: the card face / back look and tap-drag feel from
// Patience Pine, a felt background, a stats line, a bottom toolbar and a toast. Our own code, MIT.
import { css } from './calm.js';

export const SUITS = ['♠', '♥', '♦', '♣'], RN = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const isRed = (s) => s === 1 || s === 2;

/** theme: { felt: [inner, mid, outer], back: [c1, c2], trim, motif (clip-path polygon for the back emblem), accent } */
export function tableCSS(t) {
  css(`
body{background:${t.felt[2]}}
#felt{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 120% 80% at 50% 28%,${t.felt[0]} 0%,${t.felt[1]} 50%,${t.felt[2]} 100%)}
#felt:after{content:'';position:absolute;inset:0;opacity:.18;background:repeating-radial-gradient(circle at 30% 20%,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}
#deco{position:fixed;left:0;right:0;bottom:0;height:34vh;z-index:0;pointer-events:none}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#1d1d26;background:${t.trim}}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.16);height:8px}.hc-top .hc-bar i{background:${t.trim}}
#table{position:fixed;inset:0;z-index:2}
#stats{position:fixed;left:0;right:0;z-index:5;display:flex;justify-content:center;gap:18px;color:#fff;pointer-events:none;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700}
#stats span{opacity:.62}#stats b{font-size:15px;letter-spacing:.3px;opacity:1;margin-left:5px;font-variant-numeric:tabular-nums}
.slot{position:absolute;width:var(--cw);height:var(--ch);border-radius:calc(var(--cw) * .12);border:1.5px solid rgba(255,255,255,.22);background:rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.28);font-size:calc(var(--cw) * .5);z-index:1}
.cd{position:absolute;left:0;top:0;width:var(--cw);height:var(--ch);transition:transform .26s cubic-bezier(.25,.9,.3,1.04),opacity .3s;perspective:600px;cursor:pointer;touch-action:none}
.cd.drag{transition:none}
.cd .in{position:absolute;inset:0;transition:transform .3s ease;transform-style:preserve-3d}
.cd.down .in{transform:rotateY(180deg)}
.cd .f{position:absolute;inset:0;border-radius:calc(var(--cw) * .12);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.cd .fr{background:linear-gradient(160deg,#fffefb,#f3eee4);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 2px 6px rgba(0,0,0,.3);border:1px solid rgba(0,0,0,.1)}
.cd.drag .fr{box-shadow:0 10px 22px rgba(0,0,0,.35)}
.cd .bk{transform:rotateY(180deg);background:linear-gradient(150deg,${t.back[0]},${t.back[1]});box-shadow:0 2px 4px rgba(0,0,0,.28);border:1.5px solid rgba(255,255,255,.85)}
.cd .bk:after{content:'';position:absolute;inset:3px;border-radius:calc(var(--cw) * .08);border:1px solid ${t.trim}80;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 3px,transparent 3px 7px)}
.cd .bk:before{content:'';position:absolute;left:50%;top:50%;width:46%;height:46%;transform:translate(-50%,-50%);background:${t.trim};opacity:.9;clip-path:${t.motif}}
.rk{position:absolute;left:6%;top:2%;font-weight:760;font-size:calc(var(--cw) * .36);line-height:1.05;letter-spacing:-1px;font-family:-apple-system,'SF Pro Display',system-ui,sans-serif}
.s1{position:absolute;right:7%;top:3%;font-size:calc(var(--cw) * .3);line-height:1.1;font-style:normal}
.s2{position:absolute;left:0;right:0;bottom:7%;text-align:center;font-size:calc(var(--cw) * .62);line-height:1;font-style:normal}
.ct{position:absolute;left:50%;bottom:9%;transform:translateX(-50%);width:68%;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:ui-serif,'New York',Georgia,serif;font-weight:700;font-size:calc(var(--cw) * .42)}
.red .ct{background:rgba(208,58,76,.12)}.blk .ct{background:rgba(31,36,51,.1)}
.ct small{font-size:.55em;margin-left:1px}
.red{color:#d03a4c}.blk{color:#1f2433}
.lefty .s1{left:7%;right:auto;top:calc(var(--cw) * .4)}
.cd.shake{animation:shk .32s}
@keyframes shk{20%{margin-left:-5px}40%{margin-left:5px}60%{margin-left:-3px}80%{margin-left:2px}}
.cd.glow .fr{box-shadow:0 0 0 3px ${t.trim},0 0 16px ${t.trim}e6}
.cd.sel .fr{box-shadow:0 0 0 3px ${t.trim},0 0 18px ${t.trim}}
.cd.home .fr{animation:hm .45s}
.cd.dim .fr:after{content:'';position:absolute;inset:0;background:rgba(20,22,30,.38)}
@keyframes hm{30%{filter:brightness(1.15);box-shadow:0 0 0 3px #fff,0 0 22px rgba(255,255,255,.9)}}
#bar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;justify-content:center;gap:10px;padding:8px 12px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(0,0,0,.4),rgba(0,0,0,0))}
#bar button{font:inherit;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:16px;min-width:76px;padding:6px 10px 5px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700}
#bar button i{font-style:normal;font-size:21px;line-height:1.1;letter-spacing:0}
#bar button:active{transform:translateY(1px);background:rgba(255,255,255,.2)}
#bar button[disabled]{opacity:.35}
#toast{position:fixed;left:50%;transform:translateX(-50%);z-index:35;background:rgba(10,14,24,.84);color:#fff;font-weight:700;padding:8px 16px;border-radius:20px;font-size:15px;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap}
`);
}

/** a card element: front (rank, corner suit, big pip or court medallion) + back. */
export function cardEl(parent, suit, rank, { lefty = false } = {}) {
  const d = document.createElement('div');
  d.className = 'cd down';
  const face = rank > 10 ? `<div class="ct">${RN[rank]}<small>${SUITS[suit]}</small></div>` : `<i class="s2">${SUITS[suit]}</i>`;
  d.innerHTML = `<div class="in"><div class="f fr ${isRed(suit) ? 'red' : 'blk'}${lefty ? ' lefty' : ''}"><b class="rk">${RN[rank]}</b><i class="s1">${SUITS[suit]}</i>${face}</div><div class="f bk"></div></div>`;
  parent.appendChild(d); return d;
}

/** felt + decoration canvas + table + stats + bottom bar + toast */
export function tableDOM({ stats = [], buttons = [] }) {
  const felt = document.createElement('div'); felt.id = 'felt'; document.body.prepend(felt);
  const deco = document.createElement('canvas'); deco.id = 'deco'; felt.after(deco);
  const table = document.createElement('div'); table.id = 'table'; document.body.appendChild(table);
  const st = document.createElement('div'); st.id = 'stats'; st.innerHTML = stats.map(([k, lab]) => `<div><span>${lab}</span><b data-${k}>0</b></div>`).join(''); document.body.appendChild(st);
  const bar = document.createElement('div'); bar.id = 'bar';
  bar.innerHTML = buttons.map(([k, ic, lab]) => `<button data-${k}><i>${ic}</i>${lab}</button>`).join('');
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  document.body.appendChild(bar);
  const toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl);
  let tt = 0; const toast = (t, ms = 1400) => { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(tt); tt = setTimeout(() => toastEl.style.opacity = 0, ms); };
  const stat = (k, v) => { const e = st.querySelector(`[data-${k}]`); if (e) e.textContent = v; };
  const btn = (k) => bar.querySelector(`[data-${k}]`);
  return { felt, deco, table, stats: st, bar, toastEl, toast, stat, btn };
}

export function shakeEl(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
export function homeEl(el) { el.classList.remove('home'); void el.offsetWidth; el.classList.add('home'); }

/** a small card face on a canvas (for the end-of-game card cascade) */
export function faceCanvas(suit, rank, w, h) {
  const c = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2); c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
  const r = w * 0.12; g.fillStyle = '#fffdf8'; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
  g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, r); g.fill(); g.stroke();
  g.fillStyle = isRed(suit) ? '#d03a4c' : '#1f2433'; g.font = `700 ${w * 0.36}px -apple-system,system-ui,sans-serif`; g.textBaseline = 'top';
  g.fillText(RN[rank], w * 0.07, h * 0.04); g.font = `${w * 0.6}px system-ui`; g.textAlign = 'center'; g.fillText(SUITS[suit], w / 2, h * 0.42);
  return c;
}

/** classic bouncing-card cascade. cards: [{suit, rank, x, y}] launched in order; onDone after ~3.5 s */
export function cascade(cards, w, h, floor, onDone, onLaunch, frames = 200) {
  const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9;pointer-events:none;transition:opacity .6s';
  document.body.appendChild(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const faces = new Map(), flying = []; let launched = 0, frame = 0;
  const tick = () => {
    frame++;
    if (frame % 3 === 0 && launched < cards.length) {
      const c = cards[launched++], k = c.suit * 13 + c.rank; if (!faces.has(k)) faces.set(k, faceCanvas(c.suit, c.rank, w, h));
      flying.push({ k, x: c.x, y: c.y, vx: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3.5), vy: -Math.random() * 5 });
      onLaunch && onLaunch(launched - 1);
    }
    for (const f of flying) {
      f.vy += 0.42; f.x += f.vx; f.y += f.vy;
      if (f.y + h > floor) { f.y = floor - h; f.vy *= -0.74; }
      if (f.x > -w - 10 && f.x < innerWidth + 10) g.drawImage(faces.get(f.k), f.x, f.y, w, h);
    }
    if (frame < frames) requestAnimationFrame(tick); else { cv.style.opacity = 0; setTimeout(() => cv.remove(), 700); onDone && onDone(); }
  };
  requestAnimationFrame(tick);
  return cv;
}
