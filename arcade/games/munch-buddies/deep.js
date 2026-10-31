// Munch Buddies v2 meta: saved stars, treat boxes -> stickers, daily streak, and the level map overlay.
import { store } from './kit/hc.js';
import { LEVELS, WORLDS, daily, worldOf } from './levels.js';

const S = store('munch2');
export const STICKERS = ['🍦', '🍩', '🐟', '🧁', '🍒', '🍪', '🍓', '🥐', '🍡', '🍰', '🥞', '⭐'];
export const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export const meta = {
  stars: S.get('stars', {}), got: S.get('got', []), opened: S.get('opened', 0), cur: S.get('cur', 1),
  dday: S.get('dday', ''), dstars: S.get('dstars', 0), streak: S.get('streak', 0), dlast: S.get('dlast', ''),
  total() { return Object.values(this.stars).reduce((a, b) => a + b, 0) + 0; },
  unlocked(n) { return n <= 1 || (this.stars[n - 1] || 0) > 0; },
  frontier() { let n = 1; while (this.stars[n] > 0) n++; return n; },
  save() { for (const k of ['stars', 'got', 'opened', 'cur', 'dday', 'dstars', 'streak', 'dlast']) S.set(k, this[k]); },
  /** record a clear; returns { stars, gained, box: sticker|null, newBest } */
  clear(n, stars) {
    const old = this.stars[n] || 0; this.stars[n] = Math.max(old, stars); this.cur = Math.max(this.cur, n + 1);
    const box = this.boxes();
    this.save(); return { stars, gained: this.stars[n] - old, box };
  },
  /** every 3 stars opens a treat box: a random sticker you do not own yet (a repeat gives nothing) */
  boxes() {
    let found = null;
    while (this.total() >= (this.opened + 1) * 3 && this.got.length < STICKERS.length) {
      const free = STICKERS.map((s, i) => i).filter(i => !this.got.includes(i));
      const pick = free[Math.floor(Math.random() * free.length)]; this.got.push(pick); this.opened++; found = pick;
    }
    return found;
  },
  toNextBox() { return (this.opened + 1) * 3 - this.total(); },
  dailyDone() { return this.dday === today(); },
  clearDaily(stars) {
    const t = today(); this.streak = this.dlast === t ? this.streak : this.dlast === yesterday() ? this.streak + 1 : 1;
    this.dstars = this.dday === t ? Math.max(this.dstars, stars) : stars; this.dlast = t; this.dday = t; this.save();
  },
  tomorrow() { return this.dailyDone() ? `Tomorrow: new Daily Duet · day ${this.streak + 1}` : `Daily Duet waits · streak ${this.dlast === yesterday() ? this.streak : 0}`; },
};
export const dailyDef = () => daily(today());

// ---------------------------------------------------------------- level map overlay
let css = false, root = null;
function addCss() {
  if (css) return; css = true; const s = document.createElement('style');
  s.textContent = `.mb-map{position:fixed;inset:0;z-index:50;background:linear-gradient(180deg,#fff3e2ee,#ffd9c2f2);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 24px;font-family:'Baloo 2',system-ui,sans-serif;color:#6b3f35;-webkit-overflow-scrolling:touch}
.mb-map h2{margin:6px 0 2px;font-size:20px;display:flex;justify-content:space-between;align-items:center}
.mb-x{background:#fff;border:0;border-radius:50%;width:38px;height:38px;font-size:20px;color:#ff5d8f}
.mb-w{background:rgba(255,255,255,.65);border-radius:18px;padding:8px 8px 10px;margin:10px 0}
.mb-w b{font-size:16px}.mb-g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px}
.mb-n{position:relative;aspect-ratio:1;border:0;border-radius:50%;background:#fff;color:#6b3f35;font:800 18px 'Baloo 2',system-ui;box-shadow:0 3px 0 #e8b9a6;padding:0}
.mb-n small{position:absolute;left:0;right:0;bottom:-2px;font-size:9px;color:#ffb300;letter-spacing:-1px}
.mb-n.lock{opacity:.4;box-shadow:none}.mb-n.boss{outline:3px solid #ff5d8f}.mb-n.next{animation:mbp 1s infinite;background:#ff8fae;color:#fff}
@keyframes mbp{50%{transform:scale(1.14)}}
.mb-st{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;font-size:26px;text-align:center}.mb-st i{font-style:normal;background:rgba(255,255,255,.7);border-radius:12px;padding:2px 0}.mb-st i.no{filter:grayscale(1) brightness(1.6);opacity:.35}
.mb-d{display:block;width:100%;border:0;border-radius:16px;padding:10px;background:#ffb300;color:#fff;font:800 17px 'Baloo 2',system-ui;box-shadow:0 4px 0 #d98f00}
.hc-pill{max-width:150px;font-size:13px!important;line-height:1.15;text-align:right;word-break:break-all}.mb-btn{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:20;width:46px;height:46px;border:0;border-radius:50%;background:#fff;font-size:22px;box-shadow:0 3px 0 #e8b9a6}`;
  document.head.appendChild(s);
}
export function mapButton(onClick) {
  addCss(); const b = document.createElement('button'); b.className = 'mb-btn'; b.textContent = '🗺'; b.setAttribute('aria-label', 'levels');
  b.addEventListener('pointerdown', e => { e.stopPropagation(); onClick(); }); document.body.appendChild(b); return b;
}
export function closeMap() { if (root) { root.remove(); root = null; } }
/** onPick(levelNumber) or onPick('daily') or onPick('encore') */
export function openMap(onPick) {
  addCss(); closeMap(); const front = meta.frontier(), el = document.createElement('div'); el.className = 'mb-map'; root = el;
  const total = meta.total(), done = meta.dailyDone();
  let h = `<h2><span>⭐ ${total} <small style="font-size:13px;opacity:.7">· ${meta.toNextBox()} to 🎁</small></span><button class="mb-x" data-x>✕</button></h2>`;
  h += `<button class="mb-d" data-d>${done ? '✓ Daily Duet · ' + '★'.repeat(meta.dstars) : '🎵 Daily Duet · streak ' + (meta.dlast === new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? meta.streak : 0)}</button>`;
  WORLDS.forEach((w, wi) => {
    h += `<div class="mb-w"><b>${w.icon} ${w.name}</b><div class="mb-g">`;
    for (let n = w.from; n <= w.to; n++) {
      const s = meta.stars[n] || 0, lock = !meta.unlocked(n), boss = LEVELS[n - 1].boss;
      h += `<button class="mb-n ${lock ? 'lock' : ''} ${boss ? 'boss' : ''} ${n === front ? 'next' : ''}" data-l="${n}">${lock ? '🔒' : boss && !s ? '👑' : n}${s ? `<small>${'★'.repeat(s)}</small>` : ''}</button>`;
    }
    h += `</div></div>`;
  });
  if (front > 30) h += `<button class="mb-d" data-l="${Math.max(31, meta.cur)}" style="background:#9a6bff;box-shadow:0 4px 0 #7650d1">∞ Encore · ${Math.max(31, meta.cur)}</button>`;
  h += `<div class="mb-w"><b>Stickers ${meta.got.length}/${STICKERS.length}</b><div class="mb-st">${STICKERS.map((s, i) => `<i class="${meta.got.includes(i) ? '' : 'no'}">${meta.got.includes(i) ? s : '❔'}</i>`).join('')}</div></div>`;
  el.innerHTML = h; document.body.appendChild(el);
  el.addEventListener('pointerdown', e => {
    e.stopPropagation(); const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.x !== undefined) return closeMap();
    if (t.dataset.d !== undefined) { closeMap(); return onPick('daily'); }
    const n = +t.dataset.l; if (n && meta.unlocked(n)) { closeMap(); onPick(n); }
  });
}
