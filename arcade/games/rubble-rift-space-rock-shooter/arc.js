// arc.js — small 2D arcade helpers shared (by copy) by our canvas arcade classics: a crisp full-screen canvas,
// an arcade card theme for the kit's start / win / lose cards (chips + daily button), 2D particles, screen shake,
// keyboard state and a few drawing helpers. Our own code, MIT.

export function css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); return s; }

// ---------------------------------------------------------------- card theme
export function arcadeCards({ accent = '#ff5d8f', glass = 'rgba(16,14,34,.66)', glass2 = 'rgba(16,14,34,.84)' } = {}) {
  css(`
  body{--ui:${accent}}
  .hc-card,.hc-card.dim{background:linear-gradient(180deg,${glass},${glass2});-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding-top:calc(120px + env(safe-area-inset-top))}
  .hc-card h1{font-size:clamp(46px,14vw,78px);letter-spacing:-1px}
  .hc-card .hint{font-size:21px}
  .arc-kicker{font-size:13px!important;letter-spacing:4px!important;text-transform:uppercase;font-weight:800!important;opacity:.8;margin-top:2px!important}
  .arc-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px;pointer-events:auto}
  .arc-chip{font:inherit;font-size:17px;font-weight:800;color:#fff;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25);border-radius:24px;padding:7px 18px;cursor:pointer;min-width:84px}
  .arc-chip.on{background:#fff;color:#1b1830;border-color:#fff}
  .arc-daily{font:inherit;margin-top:16px;display:flex;align-items:center;gap:12px;color:#fff;background:linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,.07));border:2px solid rgba(255,255,255,.28);border-radius:18px;padding:10px 18px;cursor:pointer;text-align:left;pointer-events:auto;min-width:250px}
  .arc-daily b{display:block;font-size:18px;line-height:1.1}
  .arc-daily span{display:block;font-size:13px;opacity:.8;font-weight:600}
  .arc-daily .cal{width:42px;height:46px;border-radius:9px;background:#fff;color:#1b1830;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;line-height:1;flex:none;overflow:hidden}
  .arc-daily .cal i{font-style:normal;font-size:9px;letter-spacing:1px;background:${accent};color:#fff;width:100%;text-align:center;padding:3px 0}
  .arc-daily .cal em{font-style:normal;font-size:21px;padding-top:4px}
  .arc-link{margin-top:10px;font-size:15px;opacity:.85;text-decoration:underline;cursor:pointer;pointer-events:auto}
  .arc-keys{font-size:13px!important;opacity:.6!important;margin-top:6px!important}
  @media (hover:none){.arc-keys{display:none}}
  `);
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const eat = (el) => { el.addEventListener('pointerdown', e => e.stopPropagation()); return el; };

/** start card extras: kicker under the title, optional chip row, optional daily button, desktop key line */
export function startCard(ui, D, { kicker = '', chips = null, dailyBtn = true, keys = '' } = {}) {
  const card = ui.els.start, h1 = card.querySelector('h1'), hint = card.querySelector('.hint');
  if (kicker) { const k = document.createElement('p'); k.className = 'arc-kicker'; k.textContent = kicker; h1.after(k); }
  if (chips) {
    const row = eat(document.createElement('div')); row.className = 'arc-row';
    const draw = () => { row.innerHTML = ''; chips.items.forEach((c, i) => { const b = document.createElement('button'); b.className = 'arc-chip' + (i === chips.get() ? ' on' : ''); b.textContent = c; b.onclick = (e) => { e.stopPropagation(); chips.set(i); draw(); }; row.appendChild(b); }); };
    draw(); hint.before(row);
  }
  if (dailyBtn) {
    const d = new Date();
    if (!D.isDaily) {
      const b = eat(document.createElement('button')); b.className = 'arc-daily';
      b.innerHTML = `<div class="cal"><i>${MON[d.getMonth()]}</i><em>${d.getDate()}</em></div><div><b>Daily Challenge</b><span>Same run for everyone today</span></div>`;
      b.onclick = (e) => { e.stopPropagation(); const u = new URL(location.href); u.search = '?daily=1'; location.href = u.href; };
      hint.before(b);
    } else {
      const a = eat(document.createElement('div')); a.className = 'arc-link'; a.textContent = 'Back to free play';
      a.onclick = (e) => { e.stopPropagation(); const u = new URL(location.href); u.search = ''; location.href = u.href; };
      hint.before(a);
    }
  }
  if (keys) { const k = document.createElement('p'); k.className = 'arc-keys'; k.textContent = keys; hint.after(k); }
}
/** make the kit's win card read "<line>" / "<title>" instead of "LEVEL n" / "CLEARED!" */
export function winCardText(ui, title) { const w = ui.els.win; w.querySelector('p').firstChild.textContent = ''; w.querySelector('h1').textContent = title; }

// ---------------------------------------------------------------- canvas
export function canvas2d() {
  const c = document.createElement('canvas'); c.className = 'hc-canvas'; document.body.prepend(c);
  const g = c.getContext('2d');
  const S = { c, g, W: 0, H: 0, dpr: 1, onResize: null };
  const size = () => {
    S.dpr = Math.min(devicePixelRatio || 1, 2); S.W = innerWidth; S.H = innerHeight;
    c.width = Math.round(S.W * S.dpr); c.height = Math.round(S.H * S.dpr);
    S.onResize && S.onResize(S.W, S.H);
  };
  addEventListener('resize', size); size();
  S.begin = () => g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  return S;
}

// ---------------------------------------------------------------- particles (world space; draw inside your transform)
export function particles() {
  let P = [];
  return {
    get list() { return P; },
    burst(x, y, colors = ['#fff'], n = 12, { speed = 160, size = 3, g = 0, drag = 0.985, life = 0.8, kind = 'dot', vx = 0, vy = 0, spread = Math.PI * 2, dir = 0 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread, s = speed * (0.35 + Math.random() * 0.8);
        P.push({ x, y, vx: vx + Math.cos(a) * s, vy: vy + Math.sin(a) * s, g, drag, s: size * (0.6 + Math.random() * 0.8), c: colors[i % colors.length], kind, life: life * (0.7 + Math.random() * 0.5), max: life, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
      }
    },
    ring(x, y, color = '#fff', s = 30, life = 0.45) { P.push({ x, y, vx: 0, vy: 0, g: 0, drag: 1, s, c: color, kind: 'ring', life, max: life, r: 0, vr: 0 }); },
    update(dt) {
      for (const p of P) { p.vy += p.g * dt; const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt; }
      P = P.filter(p => p.life > 0);
    },
    draw(g) {
      for (const p of P) {
        const a = Math.max(0, Math.min(1, p.life / p.max * 1.5)); g.globalAlpha = a;
        if (p.kind === 'ring') { g.strokeStyle = p.c; g.lineWidth = 3 * a; g.beginPath(); g.arc(p.x, p.y, p.s * (1.4 - p.life / p.max), 0, 7); g.stroke(); continue; }
        g.fillStyle = p.c;
        if (p.kind === 'conf') { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.r * 2)); g.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9); g.restore(); }
        else if (p.kind === 'spark') { g.strokeStyle = p.c; g.lineWidth = p.s * 0.6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke(); }
        else if (p.kind === 'square') { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); g.restore(); }
        else { g.beginPath(); g.arc(p.x, p.y, p.s * (0.4 + 0.6 * a), 0, 7); g.fill(); }
      }
      g.globalAlpha = 1;
    },
    clear() { P = []; },
  };
}

// ---------------------------------------------------------------- shake, keys, helpers
export function shaker() {
  let amt = 0;
  return { kick(a) { amt = Math.max(amt, a); }, update(dt) { amt = Math.max(0, amt - dt * 40); }, get x() { return (Math.random() - 0.5) * amt; }, get y() { return (Math.random() - 0.5) * amt; }, get amt() { return amt; } };
}
export function keys() {
  const K = new Set();
  addEventListener('keydown', e => { K.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', e => K.delete(e.code));
  addEventListener('blur', () => K.clear());
  return K;
}
export function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export const lerpc = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
