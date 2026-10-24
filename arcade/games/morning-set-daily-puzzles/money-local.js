// Stand-in for kit/money.js (BATCH12 interface), used ONLY when the shared kit file can't be loaded. Test mode: no real
// ads or payments. Rewarded videos are simulated with a short countdown; coins persist on this device.
const css = `.ml-wrap{position:fixed;inset:0;z-index:70;background:rgba(40,22,18,.5);display:grid;place-items:center;font-family:Nunito,system-ui,sans-serif}
.ml{width:min(360px,calc(100% - 32px));background:#fffaf2;border-radius:24px;padding:20px;color:#3b2a26;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.ml h3{margin:0 0 6px;font:700 24px Fraunces,Georgia,serif}.ml p{margin:0 0 14px;font-size:16px;line-height:1.35;color:#6b5a52}
.ml button{font:800 17px Nunito,system-ui,sans-serif;border:0;border-radius:16px;padding:12px 16px;width:100%;margin-top:8px;cursor:pointer;background:#f2e6d6;color:#3b2a26}
.ml button.go{background:linear-gradient(180deg,#ffcf5a,#f5a623);color:#4a2b05;box-shadow:0 4px 0 #c97f10}
.ml .bar{height:8px;border-radius:6px;background:#efe2cf;overflow:hidden;margin:10px 0}.ml .bar i{display:block;height:100%;width:0;background:#f5a623;transition:width 2.4s linear}
.ml .row{display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-top:1px solid #f0e3d2;font-weight:800}.ml .row button{width:auto;margin:0;padding:8px 14px}`;
const LABEL = { hint: 'a free hint', moves: 'one extra guess', revive: 'your streak back', double: 'double coins', lives: 'a full refill' };
export function money({ game, style = 'A' } = {}) {
  if (!document.getElementById('ml-css')) { const s = document.createElement('style'); s.id = 'ml-css'; s.textContent = css; document.head.appendChild(s); }
  const K = 'money_' + game + '_', get = (k, d) => { try { const v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  let coins = get('coins', 100), lastBreak = 0, levelEnds = 0; const subs = new Set();
  const emit = () => { put('coins', coins); subs.forEach(f => { try { f(coins); } catch (e) {} }); };
  const embed = new URLSearchParams(location.search).get('embed') === 'chat';
  function modal(html, wire) {
    return new Promise(res => {
      const w = document.createElement('div'); w.className = 'ml-wrap'; w.innerHTML = `<div class="ml">${html}</div>`; document.body.appendChild(w);
      ['pointerdown', 'touchstart', 'mousedown'].forEach(t => w.addEventListener(t, e => e.stopPropagation()));
      const done = v => { w.remove(); res(v); }; wire(w, done);
    });
  }
  const M = {
    coins: () => coins,
    add(n, why) { coins += Math.max(0, n | 0); emit(); },
    spend(n, why) { if (coins < n) return false; coins -= n; emit(); return true; },
    onChange(f) { subs.add(f); return () => subs.delete(f); },
    rewarded(kind) {
      return modal(`<h3>Watch a short video?</h3><p>Get ${LABEL[kind] || 'a reward'} after a short video. (Test mode: no real ad.)</p><button class="go" data-y>▶ Watch</button><button data-n>No thanks</button>`, (w, done) => {
        w.querySelector('[data-n]').onclick = () => done(false);
        w.querySelector('[data-y]').onclick = () => { w.querySelector('.ml').innerHTML = '<h3>Video playing…</h3><p>Test mode</p><div class="bar"><i></i></div>'; requestAnimationFrame(() => requestAnimationFrame(() => { const b = w.querySelector('.bar i'); if (b) b.style.width = '100%'; })); setTimeout(() => done(true), 2500); };
      });
    },
    async breakAd(where) { levelEnds++; if (embed || get('adfree', false) || levelEnds < 4 || Date.now() - lastBreak < 180e3) return false; lastBreak = Date.now(); return false; },
    shop() {
      const packs = [['coins_s', '500 coins', '$1.99'], ['coins_m', '1,500 coins', '$4.99'], ['adfree', 'Remove ads', '$3.99'], ['pass', 'Season pass · archive + hints', '$4.99/mo']];
      return modal(`<h3>Shop</h3><p>You have <b>${coins}</b> coins. Test mode: nothing is charged.</p>${packs.map(([s, n, p]) => `<div class="row"><span>${n}</span><button class="go" data-s="${s}">${p}</button></div>`).join('')}<button data-n>Close</button>`, (w, done) => {
        w.querySelector('[data-n]').onclick = () => done(false);
        w.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { await M.buy(b.dataset.s); done(true); });
      });
    },
    async buy(sku) { if (sku === 'coins_s') M.add(500, 'buy'); else if (sku === 'coins_m') M.add(1500, 'buy'); else if (sku === 'adfree') put('adfree', true); else if (sku === 'pass') put('pass', true); return true; },
    adFree: () => get('adfree', false), hasPass: () => get('pass', false),
    lives: () => ({ n: 5, max: 5, nextAt: 0 }), useLife: () => true, refillLives() {},
    test: true,
  };
  return M;
}
