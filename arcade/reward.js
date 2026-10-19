// AGENTPARK player reward (2026-10-19): $1 on PayPal once a player's AI has brought them back on N different mornings
// (server: arcade-api rewards.js, GET /api/reward?u=code). Shown only to browsers that have a prompt code (ap.u) and only while
// rewards are on. Day 1..N-1: a small progress pill. Day N: a claim sheet (PayPal email + "I'm 18 or older"). Never in the
// chat versions (?embed=chat) or on Kids games. go.html shows the offer itself (RiffReward.offer).
(function () {
  const API = 'https://mcp.riffcade.com';
  const q = new URLSearchParams(location.search);
  if (q.get('embed') === 'chat') return;
  let u = null; try { u = localStorage.getItem('ap.u'); } catch (e) {}
  const css = `.rw-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:9998;display:flex;gap:10px;align-items:center;
    background:#1E1B33;color:#FFFDF8;border:2px solid #FFC93C;border-radius:999px;padding:9px 10px 9px 16px;font:600 14px/1.2 "DM Sans",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:calc(100% - 24px)}
  .rw-pill b{color:#FFC93C}.rw-pill button{all:unset;cursor:pointer;opacity:.7;padding:2px 6px;font-size:16px}
  .rw-sheet{position:fixed;inset:0;z-index:9999;background:rgba(7,6,15,.72);display:grid;place-items:end center;padding:16px}
  .rw-card{color-scheme:light;width:min(420px,100%);background:#FFFDF8;color:#1E1B33;border-radius:24px;padding:22px 20px calc(env(safe-area-inset-bottom) + 18px);font:16px/1.4 "DM Sans",system-ui,sans-serif;display:grid;gap:12px}
  .rw-card h2{margin:0;font:800 26px/1.1 "Bricolage Grotesque","DM Sans",sans-serif}.rw-card p{margin:0;color:#4a4560}
  .rw-card input[type=email]{background:#fff;color:#1E1B33;font:16px "DM Sans",sans-serif;padding:14px;border-radius:14px;border:2px solid #d8d3e8;width:100%;box-sizing:border-box}
  .rw-card label{display:flex;gap:10px;align-items:center;font-size:15px}.rw-card label input{width:20px;height:20px}
  .rw-card .go{all:unset;cursor:pointer;text-align:center;background:#FFC93C;color:#1E1B33;font:800 18px "Bricolage Grotesque","DM Sans",sans-serif;border-radius:999px;padding:15px}
  .rw-card .go[disabled]{opacity:.5}.rw-card small{font-size:12px;color:#6b6680}.rw-card small a{color:inherit}.rw-card .err{color:#c0163a;font-size:14px;min-height:1em}
  .rw-card .x{all:unset;cursor:pointer;justify-self:center;color:#6b6680;font-size:14px;padding:4px}`;
  const style = () => { if (document.getElementById('rw-css')) return; const s = document.createElement('style'); s.id = 'rw-css'; s.textContent = css; document.head.appendChild(s); };
  const sget = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

  function pill(st) {
    if (sget('rw.pill')) return; sset('rw.pill', '1'); style();
    const left = st.need - st.days, el = document.createElement('div'); el.className = 'rw-pill'; el.setAttribute('role', 'status');
    el.innerHTML = `<span>🎁 Day <b>${st.days}</b> of ${st.need}. ${left === 1 ? 'Come back tomorrow' : 'Come back ' + left + ' more mornings'} from your AI: <b>$${st.amount} on PayPal</b></span><button aria-label="Close">✕</button>`;
    el.querySelector('button').onclick = () => el.remove();
    document.body.appendChild(el); setTimeout(() => el.remove(), /play\.html/.test(location.pathname) ? 7000 : 15000);
  }
  function sheet(st) {
    if (sget('rw.sheetClosed')) return; style();
    const el = document.createElement('div'); el.className = 'rw-sheet';
    el.innerHTML = `<form class="rw-card" novalidate><h2>🎉 You came back ${st.need} mornings.<br>Here's $${st.amount}.</h2>
      <p>We send it to your PayPal. Type the email of your PayPal account.</p>
      <input type="email" name="email" placeholder="your PayPal email" autocomplete="email" required>
      <label><input type="checkbox" name="adult"> I'm 18 or older</label>
      <div class="err" role="alert"></div>
      <button class="go" type="submit">Send my $${st.amount} ▶</button>
      <small>One per person. US PayPal accounts. <a href="terms.html#rewards" target="_blank">Reward rules</a> · <a href="privacy.html" target="_blank">Privacy</a></small>
      <button class="x" type="button">Later</button></form>`;
    const f = el.querySelector('form'), err = el.querySelector('.err'), go = el.querySelector('.go');
    el.querySelector('.x').onclick = () => { sset('rw.sheetClosed', '1'); el.remove(); };
    f.onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      if (!f.adult.checked) { err.textContent = 'Rewards are for adults (18+) only.'; return; }
      go.disabled = true; go.textContent = 'Sending…';
      try {
        const r = await fetch(API + '/api/reward/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ u, email: f.email.value, adult: true }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
        f.innerHTML = `<h2>✅ Sent!</h2><p>Your $${st.amount} is on its way. PayPal emails you in a few minutes.</p><button class="go" type="button">Keep playing ▶</button>`;
        f.querySelector('.go').onclick = () => el.remove();
      } catch (er) { err.textContent = er.message; go.disabled = false; go.textContent = `Send my $${st.amount} ▶`; }
    };
    document.body.appendChild(el);
  }
  function status() {
    return fetch(API + '/api/reward?u=' + encodeURIComponent(u || ''), { cache: 'no-store' }).then(r => r.json()).catch(() => ({ on: false }));
  }
  window.RiffReward = { status, offer: () => status() };
  if (!u) return;
  // never over a Kids game
  const kidsGame = () => !q.get('g') ? Promise.resolve(false) : fetch('games.json').then(r => r.json()).then(L => { const g = (L || []).find(x => x.slug === q.get('g')); return !!g && (g.category === 'Kids' || (g.tags || []).includes('Kids')); }).catch(() => false);
  const run = () => kidsGame().then(k => k ? { on: false } : status()).then(st => { if (!st.on || st.claimed) return; if (st.eligible) sheet(st); else if (st.days >= 1) pill(st); });
  // on a game page, wait for the game to settle in first
  if (document.readyState === 'complete') setTimeout(run, /play\.html/.test(location.pathname) ? 2500 : 600);
  else addEventListener('load', () => setTimeout(run, /play\.html/.test(location.pathname) ? 2500 : 600));
})();
