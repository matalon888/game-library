// Splitstream v2 meta: level map (3 worlds, stars), skate styles from star chests, Daily Run streak.
import { WORLDS, LEVELS } from './levels.js';
export const SKINS = [
  { name: 'Classic', suit: '#3a86ff', top: '#ff4fa3', boot: '#ff4fa3', rain: ['#ff3b5c', '#ff9f1c', '#ffe03b', '#3ddc84', '#2fb7ff', '#8a5cff'] },
  { name: 'Mint', suit: '#1f8f7a', top: '#b9ffe3', boot: '#2ee6c3', rain: ['#b9ffe3', '#7cf5c9', '#2ee6c3', '#19b8c9', '#2f8fff', '#5a6cff'] },
  { name: 'Sunset', suit: '#7b2ff7', top: '#ff9a3c', boot: '#ffd23f', rain: ['#ffd23f', '#ff9a3c', '#ff5d6c', '#e0389a', '#a03cf0', '#7b2ff7'] },
  { name: 'Candy', suit: '#ff6fd8', top: '#fff3a0', boot: '#6fe0ff', rain: ['#ff6fd8', '#ffa3e8', '#fff3a0', '#b8f5c8', '#6fe0ff', '#a08cff'] },
  { name: 'Night', suit: '#1c2340', top: '#5a6cff', boot: '#2ee6c3', rain: ['#2ee6c3', '#2fb7ff', '#5a6cff', '#8a5cff', '#e0389a', '#ff5d6c'] },
  { name: 'Fire', suit: '#7a1020', top: '#ff5d2c', boot: '#ffd23f', rain: ['#fff3a0', '#ffd23f', '#ff9a3c', '#ff5d2c', '#e0261c', '#7a1020'] },
  { name: 'Gold', suit: '#8a6a10', top: '#ffd23f', boot: '#fff3a0', rain: ['#fff3a0', '#ffe066', '#ffd23f', '#f0b020', '#e09010', '#c07010'] },
  { name: 'Aurora', suit: '#2b1b5e', top: '#8cffd2', boot: '#ff7ad9', rain: ['#8cffd2', '#4fe0ff', '#7a8cff', '#c07aff', '#ff7ad9', '#ffd2f0'] },
];
export const PER_CHEST = 8;
export const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const CSS = `.ss-map{position:fixed;inset:0;z-index:60;background:linear-gradient(180deg,#ff8a3c,#7b2ff7);color:#fff;font-family:"Baloo 2",system-ui,sans-serif;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)}
.ss-head{display:flex;align-items:center;gap:10px;padding:10px 14px 6px}.ss-head b{font-size:22px;letter-spacing:1px;flex:1}
.ss-x{background:rgba(255,255,255,.22);border:0;color:#fff;font:inherit;font-weight:800;font-size:20px;border-radius:50%;width:40px;height:40px}
.ss-bar{margin:0 14px 6px;height:14px;border-radius:9px;background:rgba(0,0,0,.3);overflow:hidden}.ss-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff5d6c)}
.ss-sub{margin:0 14px 6px;font-size:14px;opacity:.9;display:flex;justify-content:space-between}
.ss-scroll{flex:1;overflow:auto;padding:0 14px 30px;-webkit-overflow-scrolling:touch}
.ss-daily{width:100%;margin:6px 0 4px;padding:10px;border:0;border-radius:16px;font:inherit;font-weight:800;font-size:19px;color:#fff;background:linear-gradient(90deg,#2ee66b,#2fb7ff);box-shadow:0 4px 0 rgba(0,0,0,.25)}
.ss-daily.done{background:rgba(255,255,255,.18);box-shadow:none}
.ss-w{margin:14px 0 6px;font-size:17px;font-weight:800;display:flex;justify-content:space-between}.ss-w small{font-weight:600;opacity:.8;font-size:13px}
.ss-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.ss-n{position:relative;aspect-ratio:1;border:0;border-radius:14px;background:rgba(255,255,255,.2);color:#fff;font:inherit;font-weight:800;font-size:19px;padding:0}
.ss-n em{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:11px;letter-spacing:-1px}
.ss-n.lock{opacity:.4}.ss-n.hard{outline:3px solid #ff3b5c}.ss-n.next{background:#2ee66b;animation:ssp 1.1s ease-in-out infinite}
@keyframes ssp{50%{transform:scale(1.1)}}
.ss-sk{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.ss-sk button{width:44px;height:44px;border-radius:50%;border:3px solid transparent;padding:0}.ss-sk button.on{border-color:#fff}.ss-sk button.lock{opacity:.25}
.ss-card{margin:10px 0 2px;font-size:15px;text-align:center}
.ss-mapbtn{position:fixed;right:12px;top:calc(92px + env(safe-area-inset-top));z-index:55;background:rgba(0,0,0,.2);border:0;border-radius:20px;color:#fff;font:800 15px "Baloo 2",system-ui;padding:3px 12px}`;
export function createMeta({ save, getFrontier, onPlay, onDaily, onSkin }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'ss-map hc-hidden'; document.body.appendChild(root);
  const btn = document.createElement('button'); btn.className = 'ss-mapbtn'; btn.textContent = '🗺'; document.body.appendChild(btn);
  const S = () => save.get('st', {});
  const total = () => Object.values(S()).reduce((a, b) => a + b, 0) + save.get('bonus', 0);
  const chests = () => Math.floor(total() / PER_CHEST), unlocked = () => Math.min(SKINS.length - 1, chests());
  const yday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayNum(d); };
  const streak = () => { const l = save.get('dday', 0); return l === dayNum() || l === yday() ? save.get('streak', 0) : 0; };
  const dailyDone = () => save.get('dday', 0) === dayNum();
  const stars = (n) => '⭐'.repeat(n);
  function render() {
    const s = S(), front = getFrontier(), t = total(), into = t % PER_CHEST;
    root.innerHTML = '';
    const head = document.createElement('div'); head.className = 'ss-head'; head.innerHTML = `<b>SPLITSTREAM</b><span>⭐ ${t}</span>`;
    const x = document.createElement('button'); x.className = 'ss-x'; x.textContent = 'X'; x.onclick = close; head.appendChild(x);
    const bar = document.createElement('div'); bar.className = 'ss-bar'; bar.innerHTML = `<i style="width:${into / PER_CHEST * 100}%"></i>`;
    const sub = document.createElement('div'); sub.className = 'ss-sub'; sub.innerHTML = `<span>${PER_CHEST - into} ⭐ to a new skate style 🎁</span><span>Level ${Math.min(front, LEVELS.length)} / ${LEVELS.length}</span>`;
    const sc = document.createElement('div'); sc.className = 'ss-scroll';
    const d = document.createElement('button'); d.className = 'ss-daily' + (dailyDone() ? ' done' : ''); const sk = streak();
    d.textContent = dailyDone() ? `Daily Run ✓  🔥${sk} · new run tomorrow` : `Daily Run · new today${sk ? ' · 🔥' + sk : ''}`; d.onclick = () => { close(); onDaily(); }; sc.appendChild(d);
    WORLDS.forEach((w, wi) => {
      let got = 0; for (let n = w.from; n <= w.to; n++) got += s[n] || 0;
      const h = document.createElement('div'); h.className = 'ss-w'; h.innerHTML = `<span>World ${wi + 1} · ${w.name}</span><small>⭐ ${got}/${(w.to - w.from + 1) * 3}</small>`; sc.appendChild(h);
      const g = document.createElement('div'); g.className = 'ss-grid';
      for (let n = w.from; n <= w.to; n++) {
        const b = document.createElement('button'), lock = n > front;
        b.className = 'ss-n' + (lock ? ' lock' : '') + (n === front ? ' next' : '') + (LEVELS[n - 1].hard ? ' hard' : '');
        b.innerHTML = `${n}${s[n] ? `<em>${stars(s[n])}</em>` : ''}`; if (!lock) b.onclick = () => { close(); onPlay(n); }; g.appendChild(b);
      }
      sc.appendChild(g);
    });
    const c = document.createElement('div'); c.className = 'ss-card'; c.textContent = `Skate styles: a new one every ${PER_CHEST} ⭐ (${unlocked() + 1}/${SKINS.length})`; sc.appendChild(c);
    const row = document.createElement('div'); row.className = 'ss-sk';
    SKINS.forEach((k, i) => { const b = document.createElement('button'); b.style.background = `linear-gradient(135deg,${k.top},${k.rain[3]})`; b.title = k.name; b.className = (i > unlocked() ? 'lock ' : '') + (i === save.get('skin', 0) ? 'on' : ''); b.onclick = () => { if (i <= unlocked()) { save.set('skin', i); onSkin(i); render(); } }; row.appendChild(b); });
    sc.appendChild(row); root.append(head, bar, sub, sc);
  }
  function open() { render(); root.classList.remove('hc-hidden'); api.paused = true; const nx = root.querySelector('.next'); nx && nx.scrollIntoView({ block: 'center' }); }
  function close() { root.classList.add('hc-hidden'); api.paused = false; }
  btn.onclick = (e) => { e.stopPropagation(); open(); }; btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const api = {
    open, close, paused: false, total, chests, streak, dailyDone, btn,
    addStars(n, s) { const m = S(), old = m[n] || 0, c0 = chests(); if (s > old) { m[n] = s; save.set('st', m); } return { chest: chests() > c0 }; },
    finishDaily(stars) { if (dailyDone()) return false; save.set('streak', (save.get('dday', 0) === yday() ? save.get('streak', 0) : 0) + 1); save.set('dday', dayNum()); save.set('bonus', save.get('bonus', 0) + (stars >= 3 ? 3 : 2)); return true; },
  };
  return api;
}
