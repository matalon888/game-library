// calm.js — small 2D helpers shared (by copy) by the calm adult puzzle originals: a 2D particle overlay,
// a dark-glass card theme for the kit's start / win / lose cards, the start-card daily-challenge button, and soft chimes.
// Our own code, MIT.
import { note, tone } from './kit/hc.js';

export function css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); return s; }

// ---------------------------------------------------------------- card theme (dark glass over any background)
export function cardTheme({ accent = '#4a5fc1', font = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif", serif = "ui-serif,'New York','Iowan Old Style',Georgia,serif" } = {}) {
  css(`
  html,body{font-family:${font}}
  body{--ui:${accent}}
  .hc-card{color:#fff;background:linear-gradient(180deg,rgba(14,16,22,.62),rgba(14,16,22,.78));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);padding-top:calc(118px + env(safe-area-inset-top))}
  .hc-card.dim{background:linear-gradient(180deg,rgba(14,16,22,.62),rgba(14,16,22,.78))}
  .hc-card h1{font-family:${serif};font-weight:600;letter-spacing:-.5px;text-shadow:0 2px 18px rgba(0,0,0,.25);font-size:clamp(40px,12vw,64px);line-height:1}
  .hc-card p{font-weight:500;font-size:17px;letter-spacing:.2px;text-shadow:none;opacity:.92}
  .hc-card .hint{font-weight:600;font-size:18px;letter-spacing:.3px;opacity:.95}
  .hc-card .hand{font-size:34px}
  .hc-btn{font-family:${font};font-weight:700;font-size:18px;padding:12px 30px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
  .hc-pop{font-family:${serif};font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.25)}
  .calm-kicker{font-size:12px!important;letter-spacing:4px!important;text-transform:uppercase;font-weight:700!important;opacity:.75!important;margin-top:-2px!important}
  .calm-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px;pointer-events:auto}
  .calm-chip{font:inherit;font-size:15px;font-weight:650;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:22px;padding:8px 16px;cursor:pointer}
  .calm-chip.on{background:#fff;color:#151a2a;border-color:#fff}
  .calm-daily{font:inherit;margin-top:18px;display:flex;align-items:center;gap:12px;color:#fff;background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.3);border-radius:18px;padding:12px 18px;cursor:pointer;text-align:left;pointer-events:auto;min-width:250px}
  .calm-daily b{display:block;font-size:17px}
  .calm-daily span{display:block;font-size:13px;opacity:.8;margin-top:1px}
  .calm-daily .cal{width:42px;height:46px;border-radius:9px;background:#fff;color:#151a2a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;line-height:1;flex:none;overflow:hidden}
  .calm-daily .cal i{font-style:normal;font-size:9px;letter-spacing:1px;background:${accent};color:#fff;width:100%;text-align:center;padding:3px 0}
  .calm-daily .cal em{font-style:normal;font-size:21px;padding-top:4px}
  .calm-link{margin-top:10px;font-size:14px;opacity:.8;text-decoration:underline;cursor:pointer;pointer-events:auto}
  `);
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const todayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const eat = (el) => { el.addEventListener('pointerdown', e => e.stopPropagation()); return el; };

/** start card: kicker line under the title, an optional chip row, and the daily-challenge button (or a way back to levels). */
export function startCard(ui, D, { kicker = '', doneLine = null, chips = null, dailySub = 'Same puzzle for everyone today' } = {}) {
  const card = ui.els.start, h1 = card.querySelector('h1');
  if (kicker) { const k = document.createElement('p'); k.className = 'calm-kicker'; k.textContent = kicker; h1.after(k); }
  const hint = card.querySelector('.hint');
  let row = null;
  if (chips) {
    row = eat(document.createElement('div')); row.className = 'calm-row';
    const draw = () => { row.innerHTML = ''; chips.items.forEach((c, i) => { const b = document.createElement('button'); b.className = 'calm-chip' + (i === chips.get() ? ' on' : ''); b.textContent = c; b.onclick = (e) => { e.stopPropagation(); chips.set(i); draw(); }; row.appendChild(b); }); };
    draw(); hint.before(row);
  }
  const d = new Date();
  if (!D.isDaily) {
    const b = eat(document.createElement('button')); b.className = 'calm-daily';
    b.innerHTML = `<div class="cal"><i>${MON[d.getMonth()]}</i><em>${d.getDate()}</em></div><div><b>Daily Challenge</b><span>${doneLine || dailySub}</span></div>`;
    b.onclick = (e) => { e.stopPropagation(); const u = new URL(location.href); u.search = '?daily=1'; location.href = u.href; };
    hint.before(b);
  } else {
    const a = eat(document.createElement('div')); a.className = 'calm-link'; a.textContent = 'Back to my levels';
    a.onclick = (e) => { e.stopPropagation(); const u = new URL(location.href); u.search = ''; location.href = u.href; };
    if (doneLine) { const p = document.createElement('p'); p.textContent = doneLine; p.style.marginTop = '14px'; hint.before(p); }
    hint.before(a);
  }
  return { row };
}

// ---------------------------------------------------------------- 2D particles overlay
export function fx2d(z = 8) {
  const c = document.createElement('canvas'); c.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
  document.body.appendChild(c); const g = c.getContext('2d'); let P = [], dpr = 1, running = false;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  addEventListener('resize', size); size();
  const tick = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P) {
      p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.decay;
      const a = Math.max(0, Math.min(1, p.life * 1.6)); g.globalAlpha = a; g.fillStyle = p.color;
      if (p.kind === 'ring') { g.strokeStyle = p.color; g.lineWidth = 3 * p.life; g.beginPath(); g.arc(p.x, p.y, p.s * (1.6 - p.life) * 1.4, 0, 7); g.stroke(); continue; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.r);
      if (p.kind === 'conf') { g.scale(1, Math.cos(p.r * 3)); g.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9); }
      else if (p.kind === 'star') { g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? p.s * 0.35 : p.s; g.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); } g.fill(); }
      else { g.beginPath(); g.arc(0, 0, p.s, 0, 7); g.fill(); }
      g.restore();
    }
    g.globalAlpha = 1; P = P.filter(p => p.life > 0);
    if (P.length) requestAnimationFrame(tick); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  };
  const go = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
  const add = (o) => { P.push({ vr: 0, r: 0, g: 0, drag: 0.97, decay: 0.02, life: 1, kind: 'dot', ...o }); };
  return {
    sparks(x, y, colors = ['#fff'], n = 12, { speed = 4, size = 3, kind = 'star', g = 0.05 } = {}) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
        add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g, s: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind, vr: (Math.random() - 0.5) * 0.3, decay: 0.022 + Math.random() * 0.012 }); }
      go();
    },
    ring(x, y, color = '#fff', s = 30) { add({ x, y, vx: 0, vy: 0, s, color, kind: 'ring', decay: 0.035 }); go(); },
    confetti(n = 110, colors = ['#f6c453', '#ef7a85', '#7cc6a4', '#7aa7ef', '#b59cf2', '#ffffff']) {
      for (let i = 0; i < n; i++) add({ x: innerWidth * (0.1 + Math.random() * 0.8), y: -20 - Math.random() * innerHeight * 0.3, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, g: 0.06, drag: 0.985,
        s: 4 + Math.random() * 4, color: colors[i % colors.length], kind: 'conf', vr: (Math.random() - 0.5) * 0.25, decay: 0.006 + Math.random() * 0.004 });
      go();
    },
  };
}

// ---------------------------------------------------------------- soft sounds
const PENTA = [0, 2, 4, 7, 9];
export const chime = (i = 0, base = 72, vol = 0.12) => note(base + PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5), 0.6, vol);
export const arp = (notes, gap = 80, vol = 0.12, dur = 0.7) => notes.forEach((n, i) => setTimeout(() => note(n, dur, vol), i * gap));
export const soft = { click: () => tone(1400, 0.03, 'sine', 0.05, 0.6), wood: () => { tone(620, 0.05, 'triangle', 0.09, 0.5); tone(1240, 0.03, 'sine', 0.03, 0.7); },
  err: () => { tone(196, 0.16, 'sine', 0.11, 0.8); setTimeout(() => tone(165, 0.22, 'sine', 0.09, 0.8), 110); }, swish: () => tone(900, 0.12, 'sine', 0.04, 0.4) };
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
