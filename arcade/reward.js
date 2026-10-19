// AGENTPARK "$1 for plugging in your AI" (2026-10-19). Two steps, paid only after we've confirmed it (arcade-api rewards.js):
//   1 CONNECT  tap ChatGPT / Claude, hit send: your AI checks in with us (verified from the AI company's own servers)
//   2 CONFIRM  tomorrow morning your AI checks in again by itself (the daily task works) → the $1 unlocks → claim to PayPal
// Pieces: RiffReward.offerCard(el) on go.html (spinning coin + the 3 steps), a progress pill on the game pages, and a confetti
// claim sheet once confirmed. Only for browsers with a prompt code (ap.u), never in ?embed=chat or on Kids games.
(function () {
  const API = 'https://mcp.riffcade.com';
  const q = new URLSearchParams(location.search);
  if (q.get('embed') === 'chat') return;
  // the AI's claim link carries the code (?apu=…&claim=1): it may open in a different browser (the AI app's own) than the first tap
  let u = null; try { u = localStorage.getItem('ap.u'); } catch (e) {}
  if (/^[a-z0-9]{10}$/.test(q.get('apu') || '') && (q.get('claim') === '1' || !u)) { u = q.get('apu'); try { localStorage.setItem('ap.u', u); } catch (e) {} }
  if (q.get('claim') === '1') { try { sessionStorage.removeItem('rw.sheetClosed'); } catch (e) {} }
  const css = `
  @keyframes rw-spin{0%,100%{transform:rotateY(-28deg) scale(1)}50%{transform:rotateY(28deg) scale(1.08)}}@keyframes rw-bob{50%{transform:translateY(-5px)}}@keyframes rw-shine{to{background-position:200% 0}}
  @keyframes rw-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}@keyframes rw-up{from{transform:translateY(110%)}}
  @keyframes rw-fall{to{transform:translateY(110vh) rotate(720deg)}}@keyframes rw-pulse{50%{box-shadow:0 6px 0 #c47f12,0 0 0 8px rgba(255,201,60,0)}}
  .rw-coin{width:54px;height:54px;flex:none;border-radius:50%;display:grid;place-items:center;font:900 22px/1 "Bricolage Grotesque","DM Sans",sans-serif;color:#7a4a10;
    background:radial-gradient(circle at 35% 30%,#fff3b0,#FFC93C 45%,#e09a1c);box-shadow:inset 0 -4px 0 #c47f12,0 6px 16px rgba(255,201,60,.35);animation:rw-spin 1.8s ease-in-out infinite}
  .rw-offer{position:relative;width:100%;box-sizing:border-box;border-radius:22px;padding:14px 14px 12px;color:#FFFDF8;text-align:left;
    background:linear-gradient(#1E1B33,#1E1B33) padding-box,linear-gradient(90deg,#FFC93C,#ff7be3,#7dffa8,#FFC93C) border-box;background-size:auto,200% 100%;
    border:3px solid transparent;animation:rw-shine 3s linear infinite,rw-pop .5s ease-out both;font:15px/1.35 "DM Sans",system-ui,sans-serif}
  .rw-offer .top{display:flex;gap:12px;align-items:center}.rw-offer h3{margin:0;font:800 21px/1.1 "Bricolage Grotesque","DM Sans",sans-serif}
  .rw-offer h3 em{font-style:normal;color:#FFC93C}.rw-offer .sm{color:#CFCBE6;font-size:13px;margin-top:3px}
  .rw-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}
  .rw-steps div{background:rgba(255,255,255,.06);border-radius:14px;padding:8px 6px;text-align:center;font-size:12.5px;line-height:1.25;color:#CFCBE6}
  .rw-steps b{display:block;font-size:20px;margin-bottom:3px;animation:rw-bob 1.6s ease-in-out infinite}.rw-steps div:nth-child(2) b{animation-delay:.25s}.rw-steps div:nth-child(3) b{animation-delay:.5s}
  .rw-steps strong{color:#FFFDF8;display:block}
  .rw-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:9998;width:min(400px,calc(100% - 24px));box-sizing:border-box;
    background:#1E1B33;color:#FFFDF8;border:2px solid #FFC93C;border-radius:20px;padding:10px 12px;font:600 14px/1.3 "DM Sans",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);
    display:flex;gap:10px;align-items:center;animation:rw-pop .45s cubic-bezier(.2,1.4,.4,1) both}
  .rw-pill .rw-coin{width:38px;height:38px;font-size:15px}.rw-pill .t{flex:1}.rw-pill b{color:#FFC93C}
  .rw-bar{height:7px;border-radius:9px;background:rgba(255,255,255,.12);margin-top:6px;overflow:hidden}.rw-bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#7dffa8,#FFC93C,#7dffa8);background-size:200% 100%;animation:rw-shine 1.5s linear infinite}
  .rw-pill button{all:unset;cursor:pointer;opacity:.6;padding:2px 4px;font-size:16px;align-self:flex-start}
  .rw-sheet{position:fixed;inset:0;z-index:9999;background:rgba(7,6,15,.75);display:grid;place-items:end center;padding:16px;overflow:hidden}
  .rw-card{color-scheme:light;position:relative;width:min(420px,100%);box-sizing:border-box;background:#FFFDF8;color:#1E1B33;border-radius:26px;padding:22px 20px calc(env(safe-area-inset-bottom) + 16px);
    font:16px/1.4 "DM Sans",system-ui,sans-serif;display:grid;gap:12px;animation:rw-up .5s cubic-bezier(.2,1.3,.4,1) both;text-align:center;margin-top:40px}
  .rw-card .rw-coin{width:76px;height:76px;font-size:28px;justify-self:center;margin-top:-60px;border:5px solid #FFFDF8}
  .rw-card h2{margin:0;font:800 27px/1.08 "Bricolage Grotesque","DM Sans",sans-serif}.rw-card h2 em{font-style:normal;color:#e09a1c}.rw-card p{margin:0;color:#4a4560}
  .rw-card input[type=email]{background:#fff;color:#1E1B33;font:16px "DM Sans",sans-serif;padding:14px;border-radius:14px;border:2px solid #d8d3e8;width:100%;box-sizing:border-box;text-align:left}
  .rw-card label{display:flex;gap:10px;align-items:center;font-size:15px;justify-content:center}.rw-card label input{width:20px;height:20px}
  .rw-card .go{all:unset;cursor:pointer;text-align:center;background:#FFC93C;color:#1E1B33;font:800 19px "Bricolage Grotesque","DM Sans",sans-serif;border-radius:999px;padding:15px;
    box-shadow:0 6px 0 #c47f12;animation:rw-pulse 1.6s ease-in-out infinite}.rw-card .go:active{transform:translateY(3px);box-shadow:0 3px 0 #c47f12}
  .rw-card .go[disabled]{opacity:.55;animation:none}.rw-card small{font-size:12px;color:#6b6680}.rw-card small a{color:inherit}.rw-card .err{color:#c0163a;font-size:14px;min-height:1em}
  .rw-card .x{all:unset;cursor:pointer;justify-self:center;color:#6b6680;font-size:14px;padding:4px}
  .rw-bit{position:fixed;top:-30px;z-index:10000;pointer-events:none;font-size:22px;animation:rw-fall linear forwards}
  @media (prefers-reduced-motion:reduce){.rw-coin,.rw-offer,.rw-steps b,.rw-bar i,.rw-card .go,.rw-pill,.rw-card{animation:none!important}.rw-bit{display:none}}`;
  const style = () => { if (document.getElementById('rw-css')) return; const s = document.createElement('style'); s.id = 'rw-css'; s.textContent = css; document.head.appendChild(s); };
  const sget = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
  const coin = a => `<span class="rw-coin" aria-hidden="true">$${a}</span>`;
  function rain(n) {   // a shower of coins and confetti
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bits = ['💸', '🪙', '🎉', '✨', '💵', '🎊'];
    for (let i = 0; i < n; i++) { const b = document.createElement('span'); b.className = 'rw-bit'; b.textContent = bits[i % bits.length];
      b.style.left = Math.random() * 100 + 'vw'; b.style.animationDuration = 1.6 + Math.random() * 1.8 + 's'; b.style.animationDelay = Math.random() * .6 + 's';
      document.body.appendChild(b); setTimeout(() => b.remove(), 4200); }
  }

  // go.html: the offer, right under the two AI buttons
  function offerCard(el, st) {
    style(); el.className = 'rw-offer'; el.hidden = false;
    el.innerHTML = `<div class="top">${coin(st.amount)}<div><h3>Plug in your AI, get <em>$${st.amount}</em> 💸</h3><div class="sm">Real money to your PayPal, paid once we've confirmed it.</div></div></div>
      <div class="rw-steps"><div><b>👆</b><strong>1. Tap & send</strong>your AI connects</div><div><b>⏰</b><strong>2. Tomorrow</strong>your AI checks in by itself</div><div><b>💸</b><strong>3. $${st.amount} is yours</strong>straight to PayPal</div></div>`;
  }
  function pill(html, pct, ms) {
    if (sget('rw.pill')) return; sset('rw.pill', '1'); style();
    const el = document.createElement('div'); el.className = 'rw-pill'; el.setAttribute('role', 'status');
    el.innerHTML = `${coin(1)}<div class="t">${html}${pct != null ? `<div class="rw-bar"><i style="width:${pct}%"></i></div>` : ''}</div><button aria-label="Close">✕</button>`;
    el.querySelector('button').onclick = () => el.remove();
    document.body.appendChild(el); setTimeout(() => el.remove(), ms);
  }
  async function fp() {   // a soft device fingerprint (hardware + settings, nothing stored), only to spot repeat claims
    try { const s = [navigator.userAgent, screen.width, screen.height, devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language,
        navigator.hardwareConcurrency, navigator.deviceMemory, navigator.maxTouchPoints].join('|');
      const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return null; }
  }
  function sheet(st) {
    if (sget('rw.sheetClosed')) return; style();
    const el = document.createElement('div'); el.className = 'rw-sheet';
    el.innerHTML = `<form class="rw-card" novalidate>${coin(st.amount)}<h2>Confirmed! ✅<br>Your <em>$${st.amount}</em> is ready</h2>
      <p>Your AI checked in by itself. It's plugged in. Where do we send your money?</p>
      <input type="email" name="email" placeholder="your PayPal email" autocomplete="email" required>
      <label><input type="checkbox" name="adult"> I'm 18 or older</label>
      <div class="err" role="alert"></div>
      <button class="go" type="submit">Send me my $${st.amount} 💸</button>
      <small>One per person. US PayPal accounts. <a href="terms.html#rewards" target="_blank">Reward rules</a> · <a href="privacy.html" target="_blank">Privacy</a></small>
      <button class="x" type="button">Later</button></form>`;
    const f = el.querySelector('form'), err = el.querySelector('.err'), go = el.querySelector('.go');
    el.querySelector('.x').onclick = () => { sset('rw.sheetClosed', '1'); el.remove(); };
    f.onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      if (!f.adult.checked) { err.textContent = 'Rewards are for adults (18+) only.'; return; }
      go.disabled = true; go.textContent = 'Sending…';
      try {
        const r = await fetch(API + '/api/reward/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ u, email: f.email.value, adult: true, fp: await fp() }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
        f.innerHTML = j.held
          ? `${coin(st.amount)}<h2>Almost there 🔎</h2><p>We're double-checking this one by hand. Your $${st.amount} lands in your PayPal within 24 hours.</p><button class="go" type="button">Keep playing ▶</button>`
          : `${coin(st.amount)}<h2>💸 Sent!</h2><p>Your $${st.amount} is on its way. PayPal emails you in a few minutes.</p><button class="go" type="button">Keep playing ▶</button>`;
        if (!j.held) rain(36);
        f.querySelector('.go').onclick = () => el.remove();
      } catch (er) { err.textContent = er.message; go.disabled = false; go.textContent = `Send me my $${st.amount} 💸`; }
    };
    document.body.appendChild(el); rain(28);
  }
  const status = () => fetch(API + '/api/reward?u=' + encodeURIComponent(u || ''), { cache: 'no-store' }).then(r => r.json()).catch(() => ({ on: false }));
  window.RiffReward = { status, offerCard };
  if (!u || /go\.html/.test(location.pathname)) return;
  const kidsGame = () => !q.get('g') ? Promise.resolve(false) : fetch('games.json').then(r => r.json()).then(L => { const g = (L || []).find(x => x.slug === q.get('g')); return !!g && (g.category === 'Kids' || (g.tags || []).includes('Kids')); }).catch(() => false);
  const onGame = /play\.html/.test(location.pathname), cameFromGo = /^go-/.test(q.get('ref') || '') || sget('ap.goTerms') === '1';
  const run = () => kidsGame().then(k => k ? { on: false } : status()).then(st => {
    if (!st.on || st.claimed) return;
    if (st.confirmed) return sheet(st);
    if (st.connected) return pill(`<b>Step 1 done!</b> Your AI is connected ✅<br>Your $${st.amount} unlocks when it checks in by itself tomorrow ⏰`, 50, onGame ? 8000 : 15000);
    if (cameFromGo) pill(`Your <b>$${st.amount}</b> is waiting 🎁<br>Hit <b>↑ send</b> in your AI to start step 1`, 8, onGame ? 8000 : 15000);
  });
  if (document.readyState === 'complete') setTimeout(run, onGame ? 2500 : 600);
  else addEventListener('load', () => setTimeout(run, onGame ? 2500 : 600));
})();
