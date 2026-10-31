// Slab Up v2 — meta layer: saved stars, 12 slab palettes (a collection), the tower map, win / lose cards, daily tower + streak.
import { LEVELS, WORLDS, dayNum } from './levels.js';
export const SKINS = [
  { name: 'Candy', need: 0, rain: true },
  { name: 'Mint', need: 2, h: 150, step: 2.5, s: 0.62, l: 0.62 },
  { name: 'Sunset', need: 6, h: 8, step: 3.2, s: 0.8, l: 0.62 },
  { name: 'Ocean', need: 10, h: 195, step: 3, s: 0.7, l: 0.58 },
  { name: 'Grape', need: 15, h: 268, step: 3.4, s: 0.6, l: 0.62 },
  { name: 'Honey', need: 21, h: 42, step: 1.4, s: 0.9, l: 0.58 },
  { name: 'Lava', need: 28, h: 4, step: -2.2, s: 0.85, l: 0.55 },
  { name: 'Slate', need: 35, h: 220, step: 1, s: 0.12, l: 0.6 },
  { name: 'Neon', need: 43, h: 300, step: 14, s: 0.95, l: 0.6 },
  { name: 'Galaxy', need: 52, h: 255, step: 4.5, s: 0.7, l: 0.5 },
  { name: 'Aurora', need: 62, h: 140, step: 6, s: 0.75, l: 0.58 },
  { name: 'Crown', need: 74, h: 30, step: 12, s: 0.9, l: 0.62 },
];
export const MAXSTARS = LEVELS.length * 3;

export function createMeta(S) {
  const M = {
    stars: () => S.get('d_stars', {}),
    total() { return Object.values(M.stars()).reduce((a, b) => a + b, 0) + Object.values(S.get('d_daily', {})).reduce((a, b) => a + b, 0); },
    unlocked() { return Math.min(LEVELS.length + 1, S.get('d_unl', 1)); },
    skin() { const i = S.get('d_skin', 0); return SKINS[i] && SKINS[i].need <= M.total() ? i : 0; },
    setSkin(i) { S.set('d_skin', i); },
    // record a clear: returns { gained, newSkin }
    clear(n, st) {
      const before = M.total(), all = M.stars(), old = all[n] || 0;
      if (st > old) { all[n] = st; S.set('d_stars', all); }
      if (n >= M.unlocked() && n <= LEVELS.length) S.set('d_unl', n + 1);
      const now = M.total(), ns = SKINS.findIndex(k => k.need > before && k.need <= now);
      return { gained: Math.max(0, st - old), newSkin: ns };
    },
    nextSkin() { const t = M.total(); return SKINS.find(k => k.need > t) || null; },
    daily() { return S.get('d_daily', {}); },
    dailyDone() { return !!M.daily()[dayNum()]; },
    dailyClear(st) { const d = M.daily(), k = dayNum(); if (!d[k] || st > d[k]) { const had = d[k] || 0; d[k] = st; S.set('d_daily', d); return st - had; } return 0; },
    // streak = consecutive days opened (any drop counts), bumped once per day
    streak() { return S.get('d_streak', 0); },
    touchDay() {
      const t = dayNum(); if (S.get('d_last', 0) === t) return M.streak();
      const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
      const s = S.get('d_last', 0) === dayNum(y) ? M.streak() + 1 : 1; S.set('d_last', t); S.set('d_streak', s); return s;
    },
  };
  return M;
}

const CSS = `
.sm{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;padding:calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));background:rgba(30,18,50,.82);backdrop-filter:blur(6px);gap:10px;overflow:auto}
.sm *{box-sizing:border-box}
.sm h2{margin:0;font-size:26px;font-weight:800}
.sm .row{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.sm .tab{font:inherit;font-weight:800;font-size:15px;color:#fff;background:rgba(255,255,255,.14);border:0;border-radius:18px;padding:6px 12px}
.sm .tab.on{background:var(--ui,#ff5d8f)}
.sm .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(380px,100%)}
.sm .node{font:inherit;font-weight:800;font-size:20px;color:#fff;border:0;border-radius:16px;background:rgba(255,255,255,.18);padding:8px 0 4px;display:flex;flex-direction:column;align-items:center;line-height:1.1}
.sm .node small{font-size:12px;letter-spacing:1px;color:#ffd23f;min-height:14px}
.sm .node.lock{opacity:.35}
.sm .node.hard{box-shadow:inset 0 0 0 3px #ff6a5c}
.sm .node.cur{background:var(--ui,#ff5d8f);animation:smp 1.1s ease-in-out infinite}
@keyframes smp{50%{transform:scale(1.1)}}
.sm .big{font:inherit;font-weight:800;font-size:19px;color:#fff;background:#3cc46a;box-shadow:0 5px 0 #2a9a50;border:0;border-radius:30px;padding:12px 26px}
.sm .big.alt{background:#7b5cff;box-shadow:0 5px 0 #5a3fd0}
.sm .big.mute{background:rgba(255,255,255,.2);box-shadow:none}
.sm .sw{width:46px;height:46px;border-radius:12px;border:3px solid transparent;display:flex;align-items:flex-end;justify-content:center;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);padding-bottom:2px}
.sm .sw.on{border-color:#fff}.sm .sw.lock{filter:grayscale(1) brightness(.5)}
.sm .note{font-size:14px;font-weight:600;opacity:.85;text-align:center}
.sm .stars{font-size:54px;letter-spacing:6px;color:#ffd23f;text-shadow:0 4px 0 rgba(0,0,0,.25);min-height:64px}
.sm .stars i{font-style:normal;opacity:.25;display:inline-block}.sm .stars i.on{opacity:1;animation:smpop .5s ease-out}
@keyframes smpop{0%{transform:scale(.2) rotate(-40deg)}70%{transform:scale(1.35)}100%{transform:scale(1)}}
.sm.card{justify-content:center;background:rgba(30,18,50,.55)}
.sm.card.lose{background:linear-gradient(0deg,rgba(20,10,30,.7),rgba(20,10,30,0) 60%);justify-content:flex-end;padding-bottom:calc(70px + env(safe-area-inset-bottom))}
.sm.card.lose h2{font-size:34px!important}
.sm .rt{display:inline-block;width:20px;height:20px;border:4px solid #fff;border-right-color:transparent;border-radius:50%;vertical-align:-4px;margin-right:8px}
.sm .stars i{width:.9em;height:.9em;background:currentColor;clip-path:polygon(50% 0,62% 36%,98% 36%,69% 58%,80% 94%,50% 72%,20% 94%,31% 58%,2% 36%,38% 36%);color:inherit;font-size:0}
.sm .stars{font-size:54px;display:flex;gap:8px;justify-content:center}
.smb{position:fixed;top:calc(14px + env(safe-area-inset-top));left:12px;z-index:7;font:inherit;font-weight:800;font-size:18px;color:#fff;background:rgba(0,0,0,.2);border:0;border-radius:16px;padding:2px 11px}
`;
const E = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const starsHTML = (n) => [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('');
const skinCss = (k) => k.rain ? 'linear-gradient(90deg,#ff6f91,#ffc75f,#6fe3a4,#6fb8ff,#c58bff)' : `linear-gradient(180deg,hsl(${k.h},${k.s * 100}%,${k.l * 100 + 8}%),hsl(${(k.h + k.step * 8 + 360) % 360},${k.s * 100}%,${k.l * 100 - 6}%))`;

// UI: the map, the cards and the small map button. api: play(n), endless(), daily(), skinChanged()
export function createScreens(M, api) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = E(`<button class="smb hc-hidden" type="button">🗺</button>`); document.body.appendChild(btn);
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); api.openMap(); });
  let cur = null;
  const close = () => { if (cur) { cur.remove(); cur = null; } };
  const mount = (el) => { close(); cur = el; el.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(el); return el; };
  const tomorrow = () => { const ns = M.nextSkin(); return `Tomorrow: Daily Tower${M.dailyDone() ? ' #' + (M.streak() + 1) : ''} · ${M.streak()}-day streak${ns ? ` · ${ns.need - M.total()}★ to ${ns.name}` : ''}`; };
  const S = {
    btn, close, get open() { return !!cur; },
    map(world) {
      const unl = M.unlocked(), stars = M.stars();
      if (world === undefined) world = Math.min(2, Math.floor((Math.min(unl, LEVELS.length) - 1) / 10));
      const ns = M.nextSkin(), sk = M.skin();
      const el = mount(E(`<div class="sm"><h2>★ ${M.total()}${ns ? ` <span style="font-size:14px;font-weight:600;opacity:.85">· ${ns.need - M.total()}★ → ${ns.name}</span>` : ''}</h2>
        <div class="row">${WORLDS.map((w, i) => `<button class="tab ${i === world ? 'on' : ''}" data-w="${i}">${w.icon} ${w.name}</button>`).join('')}</div>
        <div class="grid">${LEVELS.filter(l => l.world === world).map(l => `<button class="node ${l.n > unl ? 'lock' : ''} ${l.hard ? 'hard' : ''} ${l.n === unl ? 'cur' : ''}" data-n="${l.n}">${l.n > unl ? '🔒' : l.n}<small>${l.n > unl ? '' : '★'.repeat(stars[l.n] || 0) + '☆'.repeat(3 - (stars[l.n] || 0))}</small></button>`).join('')}</div>
        <div class="row"><button class="big alt" data-d>Daily Tower ${M.dailyDone() ? '✓' : '●'}</button><button class="big mute" data-e>∞ Endless</button></div>
        <div class="note">🔥 ${M.streak()}-day streak</div>
        <div class="row" style="max-width:360px">${SKINS.map((k, i) => `<div class="sw ${i === sk ? 'on' : ''} ${k.need > M.total() ? 'lock' : ''}" data-s="${i}" style="background:${skinCss(k)}">${k.need > M.total() ? k.need + '★' : ''}</div>`).join('')}</div>
        <button class="big" data-x>Play</button></div>`));
      el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => S.map(+b.dataset.w));
      el.querySelectorAll('.node').forEach(b => b.onclick = () => { const n = +b.dataset.n; if (n <= unl) { close(); api.play(n); } });
      el.querySelector('[data-d]').onclick = () => { close(); api.daily(); };
      el.querySelector('[data-e]').onclick = () => { close(); api.endless(); };
      el.querySelector('[data-x]').onclick = () => { close(); api.play(Math.min(unl, LEVELS.length)); };
      el.querySelectorAll('.sw').forEach(b => b.onclick = () => { const i = +b.dataset.s; if (SKINS[i].need <= M.total()) { M.setSkin(i); api.skinChanged(); S.map(world); } });
    },
    win(lv, r) {   // r: { stars, perfects, gained, newSkin, best, hasNext }
      const ns = M.nextSkin();
      const el = mount(E(`<div class="sm card"><h2>${lv.daily ? 'DAILY TOWER' : 'TOWER ' + lv.n} DONE</h2><div class="stars">${starsHTML(0)}</div>
        <div class="note">${r.perfects} perfect${r.perfects === 1 ? '' : 's'}${r.stars < 3 ? ` · ${lv.par[r.stars - 1]} → ${'★'.repeat(r.stars + 1)}` : ' · flawless'}</div>
        ${r.newSkin >= 0 ? `<div class="note" style="font-size:18px;color:#ffd23f">NEW PALETTE: ${SKINS[r.newSkin].name}!</div>` : ns ? `<div class="note">${ns.need - M.total()}★ to unlock ${ns.name}</div>` : ''}
        <div class="row"><button class="big" data-n>${r.hasNext ? 'Next ▶' : 'Endless ∞'}</button></div>
        <div class="row">${r.stars < 3 ? '<button class="big mute" data-r>↻ Again</button>' : ''}<button class="big mute" data-m>🗺</button></div>
        <div class="note" style="margin-top:8px">${tomorrow()}</div></div>`));
      const bx = el.querySelector('.stars'); [...bx.children].forEach((c, i) => { if (i < r.stars) setTimeout(() => { c.classList.add('on'); api.starSfx(i); }, 350 + i * 380); });
      el.querySelector('[data-n]').onclick = () => { close(); r.hasNext ? api.next() : api.endless(); };
      const rb = el.querySelector('[data-r]'); if (rb) rb.onclick = () => { close(); api.retry(); };
      el.querySelector('[data-m]').onclick = () => api.openMap();
    },
    lose(lv, line, hint) {
      const el = mount(E(`<div class="sm card lose"><h2 style="font-size:40px">${line}</h2><div class="note" style="font-size:17px">${hint}</div>
        <div class="row" style="margin-top:14px"><button class="big" data-r><span class="rt"></span>Retry</button><button class="big mute" data-m>Map</button></div></div>`));
      const go = () => { close(); api.retry(); };
      el.addEventListener('pointerdown', go); el.querySelector('[data-m]').addEventListener('pointerdown', e => { e.stopPropagation(); api.openMap(); });
      el.querySelector('[data-m]').onclick = null;
    },
  };
  return S;
}
