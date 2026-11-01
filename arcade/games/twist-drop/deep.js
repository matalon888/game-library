// Twist Drop v2 meta: saved stars, chests -> ball skins, Daily Tower streak, and the level map overlay.
import { store } from './kit/hc.js';
import { LEVELS, WORLDS } from './levels.js';

const S = store('twist2');
export const SKINS = [
  { n: 'Sunny', c: '#ffd23f' }, { n: 'Berry', c: '#ff4d6d' }, { n: 'Mint', c: '#3ddc97' }, { n: 'Sky', c: '#3a86ff' },
  { n: 'Grape', c: '#9b5de5' }, { n: 'Peach', c: '#ff9f80' }, { n: 'Coal', c: '#2b2d42', e: '#4a4e8a' }, { n: 'Snow', c: '#ffffff', e: '#9ad' },
  { n: 'Gold', c: '#ffc300', e: '#aa7a00' }, { n: 'Lime', c: '#b5e61d' }, { n: 'Rose', c: '#ff8fab' }, { n: 'Rainbow', c: '#ffffff', rainbow: true },
];
export const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
export const meta = {
  stars: S.get('stars', {}), got: S.get('got', [0]), skin: S.get('skin', 0), opened: S.get('opened', 0), cur: S.get('cur', 1),
  dday: S.get('dday', ''), dstars: S.get('dstars', 0), streak: S.get('streak', 0), dlast: S.get('dlast', ''),
  total() { return Object.values(this.stars).reduce((a, b) => a + b, 0); },
  unlocked(n) { return n <= 1 || (this.stars[n - 1] || 0) > 0; },
  frontier() { let n = 1; while (this.stars[n] > 0) n++; return n; },
  save() { for (const k of ['stars', 'got', 'skin', 'opened', 'cur', 'dday', 'dstars', 'streak', 'dlast']) S.set(k, this[k]); },
  /** record a clear; returns { stars, gained, box: skin index | null } */
  clear(n, stars) {
    const old = this.stars[n] || 0; this.stars[n] = Math.max(old, stars); this.cur = Math.max(this.cur, n + 1);
    const box = this.boxes(); this.save(); return { stars, gained: this.stars[n] - old, box };
  },
  /** every 6 stars opens a chest: a random skin you do not own yet */
  boxes() {
    let found = null;
    while (this.total() >= (this.opened + 1) * 6 && this.got.length < SKINS.length) {
      const free = SKINS.map((_, i) => i).filter(i => !this.got.includes(i));
      found = free[Math.floor(Math.random() * free.length)]; this.got.push(found); this.opened++;
    }
    return found;
  },
  toNextBox() { return Math.max(1, (this.opened + 1) * 6 - this.total()); },
  dailyDone() { return this.dday === today(); },
  clearDaily(stars) {
    const t = today(); this.streak = this.dlast === t ? this.streak : this.dlast === yesterday() ? this.streak + 1 : 1;
    this.dstars = this.dday === t ? Math.max(this.dstars, stars) : stars; this.dlast = t; this.dday = t; this.save();
  },
  tomorrow() { return this.dailyDone() ? `Tomorrow: new Daily Tower · day ${this.streak + 1}` : `Daily Tower waits · streak ${this.dlast === yesterday() ? this.streak : 0}`; },
};

let css = false, root = null;
function addCss() {
  if (css) return; css = true; const s = document.createElement('style');
  s.textContent = `.td-map{position:fixed;inset:0;z-index:50;background:linear-gradient(180deg,#fff3f6ee,#ffe2c8f2);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 24px;font-family:'Baloo 2',system-ui,sans-serif;color:#4b3a55;-webkit-overflow-scrolling:touch;touch-action:pan-y}
.td-map h2{margin:6px 0 2px;font-size:20px;display:flex;justify-content:space-between;align-items:center}
.td-x{background:#fff;border:0;border-radius:50%;width:38px;height:38px;font-size:20px;color:#ff5d8f}
.td-w{background:rgba(255,255,255,.65);border-radius:18px;padding:8px 8px 10px;margin:10px 0}
.td-w b{font-size:16px}.td-g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px}
.td-n{position:relative;aspect-ratio:1;border:0;border-radius:50%;background:#fff;color:#4b3a55;font:800 18px 'Baloo 2',system-ui;box-shadow:0 3px 0 #e0bfd0;padding:0}
.td-n small{position:absolute;left:0;right:0;bottom:-2px;font-size:9px;color:#ffb300;letter-spacing:-1px}
.td-n.lock{opacity:.4;box-shadow:none}.td-n.boss{outline:3px solid #ff5d8f}.td-n.next{animation:tdp 1s infinite;background:#ff8fae;color:#fff}
@keyframes tdp{50%{transform:scale(1.14)}}
.td-sk{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:6px}.td-sk i{aspect-ratio:1;border-radius:50%;border:3px solid transparent;display:block}.td-sk i.no{filter:grayscale(1) brightness(1.5);opacity:.35}.td-sk i.on{border-color:#ff5d8f}
.td-d{display:block;width:100%;border:0;border-radius:16px;padding:10px;background:#ffb300;color:#fff;font:800 17px 'Baloo 2',system-ui;box-shadow:0 4px 0 #d98f00}
.td-btn{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:20;width:46px;height:46px;border:0;border-radius:50%;background:#fff;font-size:22px;box-shadow:0 3px 0 #e0bfd0}`;
  document.head.appendChild(s);
}
export function mapButton(onClick) {
  addCss(); const b = document.createElement('button'); b.className = 'td-btn'; b.textContent = '🗺'; b.setAttribute('aria-label', 'levels');
  b.addEventListener('pointerdown', e => { e.stopPropagation(); onClick(); }); document.body.appendChild(b); return b;
}
export function closeMap() { if (root) { root.remove(); root = null; } }
export const skinCss = (i) => { const k = SKINS[i]; return k.rainbow ? 'conic-gradient(#f66,#fd4,#6d8,#4af,#c6f,#f66)' : k.c; };
/** onPick(levelNumber | 'daily'); onSkin(i) */
export function openMap(onPick, onSkin) {
  addCss(); closeMap(); const front = meta.frontier(), el = document.createElement('div'); el.className = 'td-map'; root = el;
  const render = () => {
    let h = `<h2><span>⭐ ${meta.total()} <small style="font-size:13px;opacity:.7">· ${meta.toNextBox()} to 🎁</small></span><button class="td-x" data-x>✕</button></h2>`;
    h += `<button class="td-d" data-d>${meta.dailyDone() ? '✓ Daily Tower · ' + '★'.repeat(meta.dstars) : '🌅 Daily Tower · streak ' + (meta.dlast === yesterday() ? meta.streak : 0)}</button>`;
    WORLDS.forEach((w) => {
      h += `<div class="td-w"><b>${w.icon} ${w.name}</b><div class="td-g">`;
      for (let n = w.from; n <= w.to; n++) {
        const s = meta.stars[n] || 0, lock = !meta.unlocked(n), boss = LEVELS[n - 1].boss;
        h += `<button class="td-n ${lock ? 'lock' : ''} ${boss ? 'boss' : ''} ${n === front ? 'next' : ''}" data-l="${n}">${lock ? '🔒' : boss && !s ? '👑' : n}${s ? `<small>${'★'.repeat(s)}</small>` : ''}</button>`;
      }
      h += `</div></div>`;
    });
    h += `<div class="td-w"><b>Balls ${meta.got.length}/${SKINS.length}</b><div class="td-sk">${SKINS.map((k, i) => `<i data-s="${i}" class="${meta.got.includes(i) ? '' : 'no'} ${meta.skin === i ? 'on' : ''}" style="background:${meta.got.includes(i) ? skinCss(i) : '#bbb'}"></i>`).join('')}</div></div>`;
    el.innerHTML = h;
  };
  render(); document.body.appendChild(el);
  el.addEventListener('pointerdown', e => {
    e.stopPropagation(); const sk = e.target.closest('[data-s]');
    if (sk && meta.got.includes(+sk.dataset.s)) { meta.skin = +sk.dataset.s; meta.save(); onSkin && onSkin(meta.skin); const y = el.scrollTop; render(); el.scrollTop = y; return; }
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.x !== undefined) return closeMap();
    if (t.dataset.d !== undefined) { closeMap(); return onPick('daily'); }
    const n = +t.dataset.l; if (n && meta.unlocked(n)) { closeMap(); onPick(n); }
  });
}
