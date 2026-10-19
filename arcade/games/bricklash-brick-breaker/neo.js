// neo.js — small 2D helpers shared by this game: crisp DPR canvas, particles + floating text + shake,
// a top HUD, big on-screen touch buttons with hold-to-repeat, swipe gestures and keyboard repeat. Our own code.

export function css(t) { const s = document.createElement('style'); s.textContent = t; document.head.appendChild(s); return s; }

export const BASE_CSS = `
html,body{background:var(--bgA,#0d0b24)}
body{background:radial-gradient(120% 80% at 50% 0%,var(--bgB,#2a1f63) 0%,var(--bgA,#0d0b24) 62%,var(--bgC,#07061a) 100%)!important;color:#fff}
.neo-cv{position:fixed;inset:0;display:block;z-index:1;touch-action:none}
.neo-hud{position:fixed;top:calc(8px + env(safe-area-inset-top));left:0;right:0;height:52px;z-index:5;pointer-events:none;display:flex;align-items:center;justify-content:center;font-family:'Baloo 2',system-ui,sans-serif}
.neo-hud .sc{display:flex;flex-direction:column;align-items:center;line-height:1}
.neo-hud .sc small{font-size:11px;font-weight:800;letter-spacing:.18em;opacity:.6}
.neo-hud .sc b{font-size:32px;font-weight:800;text-shadow:0 0 14px var(--acc,#ff4fd8),0 2px 0 rgba(0,0,0,.4);font-variant-numeric:tabular-nums}
.neo-hud .rt{position:absolute;right:12px;top:4px;display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:12px;font-weight:800;letter-spacing:.08em}
.neo-hud .rt span{opacity:.75}.neo-hud .rt span i{font-style:normal;color:var(--acc2,#5ef2ff);opacity:1}
.neo-pad{position:fixed;left:0;right:0;bottom:calc(10px + env(safe-area-inset-bottom));z-index:7;display:flex;justify-content:center;gap:8px;padding:0 12px;pointer-events:none}
.neo-pad.hide{display:none}
.neo-btn{pointer-events:auto;flex:1 1 0;max-width:86px;height:62px;border-radius:20px;border:1.5px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.04));color:#fff;display:grid;place-items:center;font:800 12px 'Baloo 2',system-ui,sans-serif;letter-spacing:.06em;box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.18);touch-action:none;-webkit-user-select:none;user-select:none;transition:transform .06s,background .1s,box-shadow .1s;padding:0}
.neo-btn svg{width:28px;height:28px;display:block;filter:drop-shadow(0 0 6px var(--acc2,#5ef2ff))}
.neo-btn.on{transform:translateY(2px) scale(.95);background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.1));box-shadow:0 0 22px var(--acc,#ff4fd8),inset 0 1px 0 rgba(255,255,255,.3)}
.neo-btn.big{max-width:112px}
.neo-btn .lb{display:flex;flex-direction:column;align-items:center;gap:0;line-height:1}
.neo-btn .lb small{font-size:10px;opacity:.75;margin-top:2px}
.neo-keys{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));z-index:4;text-align:center;font:700 13px 'Baloo 2',system-ui,sans-serif;opacity:.55;letter-spacing:.04em;pointer-events:none}
.neo-keys kbd{font:inherit;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:0 6px;margin:0 2px}
.hc-card{background:linear-gradient(180deg,rgba(10,8,30,.62),rgba(10,8,30,.82));-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.hc-card.dim{background:linear-gradient(180deg,rgba(10,8,30,.66),rgba(10,8,30,.86))}
.hc-card h1{color:#fff;text-shadow:0 0 22px var(--acc,#ff4fd8),0 0 46px var(--acc,#ff4fd8),0 5px 0 rgba(0,0,0,.35)!important;letter-spacing:.01em}
.hc-card p{text-shadow:0 2px 0 rgba(0,0,0,.35)!important}
.hc-card .hint{font-size:20px;color:#fff}
.neo-kick{font:800 13px 'Baloo 2',system-ui,sans-serif!important;letter-spacing:.24em;color:var(--acc2,#5ef2ff);margin-bottom:-4px!important}
.neo-line{font-size:16px!important;font-weight:600!important;opacity:.88;max-width:330px;line-height:1.3}
.neo-chips{display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap}
.neo-chip{font:800 15px 'Baloo 2',system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.22);border-radius:30px;padding:7px 16px;cursor:pointer}
.neo-chip.on{background:var(--acc,#ff4fd8);border-color:transparent;box-shadow:0 0 18px var(--acc,#ff4fd8)}
.neo-best{font-size:15px!important;opacity:.75}
.bd-toast{bottom:auto!important;top:calc(66px + env(safe-area-inset-top))!important}
`;

export const ICON = {
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5l6 6 6-6M6 11l6 6 6-6M5 21h14"/></svg>',
  rot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3v5h-5"/></svg>',
  hold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10h6M9 14h6"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M7 10l5-5 5 5"/></svg>',
};

/** fullscreen canvas sized for the device pixel ratio; S.onResize(w, h) is called on every resize */
export function stage2d() {
  const cv = document.createElement('canvas'); cv.className = 'neo-cv'; document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const S = { cv, ctx, w: innerWidth, h: innerHeight, dpr: 1, onResize: null };
  S.fit = () => {
    S.dpr = Math.min(3, window.devicePixelRatio || 1); S.w = innerWidth; S.h = innerHeight;
    cv.width = Math.round(S.w * S.dpr); cv.height = Math.round(S.h * S.dpr);
    cv.style.width = S.w + 'px'; cv.style.height = S.h + 'px';
    S.onResize && S.onResize(S.w, S.h);
  };
  S.begin = () => { ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.clearRect(0, 0, S.w, S.h); };
  addEventListener('resize', S.fit);
  return S;
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** offscreen sprite cache: draw(ctx, w, h) runs once per key at the current dpr; returns { c, pad } */
const SPR = new Map();
export function sprite(key, w, h, dpr, pad, draw) {
  const k = key + '|' + w + '|' + h + '|' + dpr;
  let s = SPR.get(k);
  if (!s) {
    const c = document.createElement('canvas'); c.width = Math.ceil((w + pad * 2) * dpr); c.height = Math.ceil((h + pad * 2) * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr); x.translate(pad, pad); draw(x, w, h);
    s = { c, pad }; SPR.set(k, s); if (SPR.size > 600) SPR.delete(SPR.keys().next().value);
  }
  return s;
}
export function blit(ctx, s, x, y, w, h) { ctx.drawImage(s.c, x - s.pad, y - s.pad, w + s.pad * 2, h + s.pad * 2); }

/** particles, rings, floating text, screen shake, flash */
export function fx() {
  const P = [], R = [], T = []; let shake = 0, flashA = 0, flashC = '#fff';
  return {
    burst(x, y, color, n = 14, { speed = 180, life = 0.7, size = 3, grav = 300, spread = Math.PI * 2, dir = -Math.PI / 2, drag = 2.2 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread, s = speed * (0.35 + Math.random() * 0.8);
        P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), c: Array.isArray(color) ? color[i % color.length] : color, grav, drag });
      }
    },
    ring(x, y, color, r0 = 4, r1 = 50, life = 0.45, w = 3) { R.push({ x, y, c: color, r0, r1, t: 0, life, w }); },
    text(x, y, str, color = '#fff', size = 22, life = 0.9) { T.push({ x, y, s: str, c: color, size, t: 0, life }); },
    shake(a) { shake = Math.max(shake, a); },
    flash(c = '#fff', a = 0.35) { flashC = c; flashA = Math.max(flashA, a); },
    get count() { return P.length; },
    update(dt) {
      for (const p of P) { p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      for (let i = P.length - 1; i >= 0; i--) if (P[i].life <= 0) P.splice(i, 1);
      for (const r of R) r.t += dt; for (let i = R.length - 1; i >= 0; i--) if (R[i].t >= R[i].life) R.splice(i, 1);
      for (const t of T) t.t += dt; for (let i = T.length - 1; i >= 0; i--) if (T[i].t >= T[i].life) T.splice(i, 1);
      shake = Math.max(0, shake - dt * 30); flashA = Math.max(0, flashA - dt * 2.2);
      if (P.length > 900) P.splice(0, P.length - 900);
    },
    offset() { return shake > 0 ? [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake] : [0, 0]; },
    draw(ctx) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of P) { const a = Math.max(0, p.life / p.max); ctx.globalAlpha = a; ctx.fillStyle = p.c; const s = p.size * (0.5 + a * 0.5); ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
      for (const r of R) { const k = r.t / r.life, e = 1 - Math.pow(1 - k, 3); ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.c; ctx.lineWidth = r.w * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const t of T) {
        const k = t.t / t.life, sc = k < 0.15 ? 0.6 + k / 0.15 * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `800 ${Math.round(t.size * sc)}px 'Baloo 2',system-ui,sans-serif`;
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round';
        const y = t.y - k * 46; ctx.strokeText(t.s, t.x, y); ctx.shadowColor = t.c; ctx.shadowBlur = 12; ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, y); ctx.shadowBlur = 0;
      }
      ctx.restore();
    },
    drawFlash(ctx, w, h) { if (flashA > 0.01) { ctx.save(); ctx.globalAlpha = flashA; ctx.fillStyle = flashC; ctx.fillRect(0, 0, w, h); ctx.restore(); } },
  };
}

/** HUD: centred score, right column of small stats */
export function hud(label = 'SCORE') {
  const d = document.createElement('div'); d.className = 'neo-hud';
  d.innerHTML = `<div class="sc"><small>${label}</small><b>0</b></div><div class="rt"></div>`;
  document.body.appendChild(d);
  const b = d.querySelector('b'), rt = d.querySelector('.rt'); let last = -1;
  return {
    el: d,
    score(n) { if (n !== last) { last = n; b.textContent = n.toLocaleString('en-US'); } },
    stats(pairs) { const html = pairs.map(([k, v]) => `<span>${k} <i>${v}</i></span>`).join(''); if (rt._h !== html) { rt._h = html; rt.innerHTML = html; } },
    show(v) { d.style.visibility = v ? 'visible' : 'hidden'; },
  };
}

/** big touch buttons. defs: [{ icon|label, sub, press(), release(), repeat: [delayMs, rateMs], big }] */
export function pad(defs) {
  const row = document.createElement('div'); row.className = 'neo-pad';
  const btns = defs.map(d => {
    const b = document.createElement('button'); b.className = 'neo-btn' + (d.big ? ' big' : '');
    b.innerHTML = d.icon ? (d.sub ? `<span class="lb">${ICON[d.icon]}<small>${d.sub}</small></span>` : ICON[d.icon]) : `<span class="lb">${d.label}${d.sub ? `<small>${d.sub}</small>` : ''}</span>`;
    b.setAttribute('aria-label', d.aria || d.sub || d.icon || d.label);
    let t1 = 0, t2 = 0, down = false;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    const up = (e) => { if (!down) return; down = false; b.classList.remove('on'); stop(); d.release && d.release(); };
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (er) {}
      down = true; b.classList.add('on'); d.press && d.press();
      if (d.repeat) { stop(); t1 = setTimeout(() => { t2 = setInterval(() => down && d.press(), d.repeat[1]); }, d.repeat[0]); }
    });
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    row.appendChild(b); return b;
  });
  document.body.appendChild(row);
  return { el: row, btns, show(v) { row.classList.toggle('hide', !v); } };
}

/** keyboard: map key -> { press, release, repeat:[delay,rate] }. Keys may be listed as 'ArrowLeft|a|A'. */
export function keys(map) {
  const M = {}; for (const k in map) for (const kk of k.split('|')) M[kk] = map[k];
  const T = {};
  addEventListener('keydown', e => {
    const d = M[e.key]; if (!d) return; e.preventDefault();
    if (e.repeat) return;
    d.press && d.press();
    if (d.repeat) { clearTimeout(T[e.key]?.a); clearInterval(T[e.key]?.b); const o = T[e.key] = {}; o.a = setTimeout(() => { o.b = setInterval(() => d.press(), d.repeat[1]); }, d.repeat[0]); }
  });
  addEventListener('keyup', e => { const d = M[e.key]; if (!d) return; const o = T[e.key]; if (o) { clearTimeout(o.a); clearInterval(o.b); delete T[e.key]; } d.release && d.release(); });
  addEventListener('blur', () => { for (const k in T) { clearTimeout(T[k].a); clearInterval(T[k].b); delete T[k]; } });
}

/** continuous swipe: fires onDir('left'|'right'|'up'|'down') each time the finger travels `step` px; onTap on a short tap */
export function swiper(target, { step = 22, onDir, onTap, onDown } = {}) {
  let st = null;
  target.addEventListener('pointerdown', e => { st = { ax: e.clientX, ay: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; onDown && onDown(e); });
  addEventListener('pointermove', e => {
    if (!st) return; const dx = e.clientX - st.ax, dy = e.clientY - st.ay;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= step) { st.moved = true; onDir && onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); st.ax = e.clientX; st.ay = e.clientY; }
  });
  const end = e => { if (!st) return; const far = Math.hypot(e.clientX - st.x0, e.clientY - st.y0); if (!st.moved && far < 14 && performance.now() - st.t < 350) onTap && onTap(e); st = null; };
  addEventListener('pointerup', end); addEventListener('pointercancel', () => st = null);
}

export const touchy = () => (matchMedia && matchMedia('(pointer:coarse)').matches) || innerWidth < 760;

/** start-card dressing: kicker above the title, a one-line pitch, a desktop keys line, optional chips */
export function dressStart(ui, { kicker = '', line = '', best = 0, chips = null } = {}) {
  const st = ui.els.start, h1 = st.querySelector('h1');
  if (kicker) { const k = document.createElement('p'); k.className = 'neo-kick'; k.textContent = kicker; h1.before(k); }
  const after = [];
  if (line) { const p = document.createElement('p'); p.className = 'neo-line'; p.innerHTML = line; after.push(p); }
  const bp = document.createElement('p'); bp.className = 'neo-best'; bp.textContent = best ? `Best ${best.toLocaleString('en-US')}` : ''; after.push(bp);
  let row = null;
  if (chips) {
    row = document.createElement('div'); row.className = 'neo-chips';
    row.addEventListener('pointerdown', e => e.stopPropagation());
    const paint = () => [...row.children].forEach((b, i) => b.classList.toggle('on', i === chips.get()));
    chips.items.forEach((t, i) => { const b = document.createElement('button'); b.className = 'neo-chip'; b.innerHTML = t; b.onclick = e => { e.stopPropagation(); chips.set(i); paint(); }; row.appendChild(b); });
    paint(); after.push(row);
  }
  let anchor = h1; while (anchor.nextElementSibling && anchor.nextElementSibling.tagName === 'P' && !anchor.nextElementSibling.classList.contains('hint')) anchor = anchor.nextElementSibling;
  for (const el of after.reverse()) anchor.after(el);
  return { setBest(n) { bp.textContent = n ? `Best ${n.toLocaleString('en-US')}` : ''; }, row };
}

/** true while the world-board sheet is open or the tab is hidden: games freeze their clock */
export const paused = () => { if (document.hidden) return true; const w = document.querySelector('.bd-wrap'); return !!(w && !w.hidden); };
