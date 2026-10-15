// RIFFCADE growth features for riffcade.com (web only): auto-next, daily challenge + streak + share card, the "New games
// every morning" card, the consent banner, the Meta pixel and the ad placements. Each sits behind its flag in config.js.
// Never runs in the chat versions (?embed=chat): shell.js only calls window.Grow outside them, and this file returns early there.
(function () {
  const C = window.RIFFCADE || {};
  if (new URLSearchParams(location.search).get('embed') === 'chat') return;
  const API = 'https://mcp.riffcade.com';
  const q = new URLSearchParams(location.search);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = id => document.getElementById(id);
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('arcade.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('arcade.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const ss = {
    get(k, d) { try { const v = sessionStorage.getItem('arcade.s.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem('arcade.s.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---------------------------------------------------------------- counting (/stats-internal)
  // A random id for this tab's session only (sessionStorage): sessions and games per session, nothing that lasts.
  const sid = ss.get('sid', null) || (() => { const s = ((crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now()).replace(/[^\w-]/g, '').slice(0, 36); ss.set('sid', s); return s; })();
  const ev = name => fetch(API + '/api/ev', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, sid }) }).catch(() => {});
  const once = (key, name) => { if (!ss.get('once.' + key, false)) { ss.set('once.' + key, true); ev(name); } };
  once('session', 'session');
  if (/^daily/.test(q.get('ref') || '')) once('ref_daily', 'ref_daily');  // ?ref=daily or ?ref=daily-<ai> from the /today page

  // ---------------------------------------------------------------- dates (UTC: the same challenge for everyone)
  const today = () => new Date().toISOString().slice(0, 10);
  const shift = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
  const EPOCH = C.CHALLENGE_EPOCH || '2026-10-15';
  const dayNum = (d = today()) => Math.floor((Date.parse(d) - Date.parse(EPOCH)) / 864e5) + 1;
  const LIST = C.CHALLENGE_GAMES || [];
  const challengeSlug = n => LIST.length && n >= 1 ? LIST[(n - 1) % LIST.length] : null;

  // ---------------------------------------------------------------- styles (loaded only when a feature is on)
  const anyOn = C.AUTO_NEXT || C.DAILY_CHALLENGE || C.SUBSCRIBE_V2 || C.ADS_ENABLED || C.META_PIXEL_ID;
  if (anyOn) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'grow.css'; document.head.appendChild(l); }

  // ---------------------------------------------------------------- consent (decline by default) + Meta pixel
  // Ads personalisation and the pixel wait for "Accept". Until then (and after "No thanks") ads run non-personalised.
  const consent = () => ls.get('consent', null); // 'accepted' | 'declined' | null (= declined until they choose)
  const needsConsent = !!(C.ADS_ENABLED || C.META_PIXEL_ID);
  let pixelOn = false, kids = false; // Kids games: never personalised ads, never the pixel
  function pixel(evName, custom) {
    if (!C.META_PIXEL_ID || consent() !== 'accepted' || kids) return;
    if (!pixelOn) {
      pixelOn = true;
      /* Meta's standard loader */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', C.META_PIXEL_ID);
      window.fbq('track', 'PageView');
    }
    if (evName) window.fbq(custom ? 'trackCustom' : 'track', evName);
  }
  function consentBanner() {
    if (!needsConsent || consent() || $('gConsent')) return;
    const b = document.createElement('div');
    b.id = 'gConsent'; b.className = 'g-consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Privacy choices');
    b.innerHTML = `<p>RIFFCADE is free thanks to ads. Allow personalised ads and ad measurement? Off unless you accept. <a href="privacy.html">Privacy</a></p>
      <div><button class="btn ghost" id="gNo">No thanks</button><button class="btn" id="gYes">Accept</button></div>`;
    document.body.appendChild(b);
    const pick = v => { ls.set('consent', v); ev(v === 'accepted' ? 'consent_accept' : 'consent_decline'); b.remove(); if (v === 'accepted') pixel(); if (window.RiffAds) window.RiffAds.consent(v === 'accepted' && !kids); };
    $('gNo').onclick = () => pick('declined');
    $('gYes').onclick = () => pick('accepted');
  }
  consentBanner();
  // "Privacy choices" at the bottom of the arcade: withdraw or give consent again, as easily as it was given
  if (needsConsent) document.addEventListener('DOMContentLoaded', () => {
    const foot = document.querySelector('.foot'); if (!foot) return;
    const a = document.createElement('a'); a.href = '#'; a.textContent = 'Privacy choices'; a.style.color = 'var(--accent)';
    a.onclick = e => { e.preventDefault(); ls.set('consent', null); consentBanner(); };
    foot.append(' · ', a);
  });
  const onPlayPage = /play\.html$/.test(location.pathname);
  if (!onPlayPage) pixel(); // on the play page: from onLoad, once we know whether it's a Kids game

  // ---------------------------------------------------------------- ads (adapter loads only when ADS_ENABLED)
  let adsReady = null;
  const ads = () => adsReady || (adsReady = !C.ADS_ENABLED ? Promise.resolve(null) : new Promise(res => {
    const load = src => new Promise(r => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = r; document.head.appendChild(s); });
    load('ads/singular-config.js').then(() => load('ads/adapter.js')).then(() => {
      if (!window.RiffAds) return res(null);
      window.RiffAds.init({ personalised: consent() === 'accepted' && !kids, count: ev });
      res(window.RiffAds);
    });
  }));

  // ---------------------------------------------------------------- small UI helpers
  function card(cls, html) {
    const o = document.createElement('div');
    o.className = 'overlay g-card ' + cls; o.setAttribute('role', 'dialog');
    o.innerHTML = `<div class="box">${html}</div>`;
    ($('stage') || document.body).appendChild(o);
    return o;
  }
  const copyText = t => navigator.clipboard && isSecureContext ? navigator.clipboard.writeText(t).then(() => true, () => false) : Promise.resolve(false);
  const toast = t => { const el = document.createElement('div'); el.className = 'g-toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); };
  const art = g => g.icon || g.cover || g.thumb;

  // ---------------------------------------------------------------- streak (localStorage, never nags)
  function streak() {
    const s = ls.get('streak', null);
    return s && (s.last === today() || s.last === shift(today(), -1)) ? s.n : 0; // missing a day resets it
  }
  function streakDone() {
    const s = ls.get('streak', null), t = today();
    if (s && s.last === t) return s.n;
    const n = s && s.last === shift(t, -1) ? s.n + 1 : 1;
    ls.set('streak', { last: t, n });
    return n;
  }

  // ---------------------------------------------------------------- home: today's challenge at the top
  function home(gs) {
    if (!C.DAILY_CHALLENGE) { if (q.get('sub') === '1' && C.SUBSCRIBE_V2) subscribe(gs, true); return; }
    const n = dayNum(), g = gs.find(x => x.slug === challengeSlug(n));
    if (g) {
      const s = streak(), done = (ls.get('streak', null) || {}).last === today();
      const el = document.createElement('a');
      el.className = 'g-challenge'; el.href = `play.html?g=${encodeURIComponent(g.slug)}&ch=${n}`;
      el.innerHTML = `<img src="${esc(art(g))}" alt=""><div><div class="eyebrow">Today's challenge · #${n}</div><b>${esc(g.name)}</b>
        <span>${done ? 'Played today ✓' : esc(g.blurb || '')}</span></div>${s ? `<span class="g-streak" aria-label="Streak: day ${s}">Day ${s} 🔥</span>` : '<span class="go">Play</span>'}`;
      const main = document.querySelector('main.home'), brand = main && main.querySelector('.brand');
      if (brand) brand.after(el);
    }
    if (q.get('sub') === '1' && C.SUBSCRIBE_V2) subscribe(gs, true);
  }

  // ---------------------------------------------------------------- the player
  let G = null, all = [], chN = 0, best = null, ended = false, shared = false;
  const played = () => ss.get('played', []);
  function pickNext() {
    const seen = new Set(played().concat(G ? [G.slug] : []));
    const phone = matchMedia('(pointer: coarse)').matches;
    const ok = x => x.chat_safe !== false && !x.linkout && !x.external && !seen.has(x.slug) && !(phone && x.platform === 'desktop');
    const tags = new Set(G && G.tags || []);
    const same = all.filter(x => ok(x) && (x.category === G.category || (x.tags || []).some(t => tags.has(t))));
    const pool = same.length ? same : all.filter(ok);
    return pool[Math.floor(Math.random() * Math.min(pool.length, 12))] || null; // among the best-ranked few, so it's not always the same one
  }

  function onLoad(g, gs) {
    G = g; all = gs;
    kids = g.category === 'Kids' || (g.tags || []).includes('Kids');
    pixel();
    if (q.get('ref') === 'c') once('c_arrival.' + g.slug, 'c_arrival');
    const n = +q.get('ch');
    if (C.DAILY_CHALLENGE && n >= 1 && challengeSlug(n) === g.slug) chN = n;
    if (C.ADS_ENABLED) { // the banner row is reserved before the game starts, so nothing jumps when the banner fills it
      const p = document.querySelector('.player');
      if (p && !$('gAdbar')) { p.classList.add('has-ad'); const bar = document.createElement('div'); bar.id = 'gAdbar'; bar.className = 'g-adbar'; p.appendChild(bar); }
    }
  }

  function onStart(frame) {
    const list = played(); if (!list.includes(G.slug)) list.push(G.slug); ss.set('played', list);
    const count = ss.get('games', 0) + 1; ss.set('games', count);
    ev('game');
    if (count === 2) pixel('GamePlayed2', true);
    if (chN) ev('challenge_play');
    if (C.ADS_ENABLED) ads().then(a => { if (a && $('gAdbar')) a.showBanner($('gAdbar')); });
    // games built on our kit expose window.__game {state, score}: that's how we know a round ended, and its score
    const watch = setInterval(() => {
      let s; try { s = frame.contentWindow.__game; } catch (e) { return; }
      if (!s) return;
      let st, sc; try { st = s.state; sc = s.score; } catch (e) { return; }
      if (typeof sc === 'number' && isFinite(sc)) best = Math.max(best ?? 0, Math.round(sc));
      if (st === 'lost' && !ended) { ended = true; setTimeout(() => { try { if (frame.contentWindow.__game.state === 'lost') gameOver(); else ended = false; } catch (e) { ended = false; } }, 1200); }
      else if (st !== 'lost' && ended && !$('gNext') && !$('gShare')) ended = false; // they retried
    }, 400);
    addEventListener('pagehide', () => clearInterval(watch));
  }

  // game over (a kit game reports 'lost'): the share card for the challenge, else Next / the rewarded offer
  async function gameOver() {
    if (chN && !shared) return shareCard(false);
    if (ss.get('games', 0) >= 2 && subDue()) await subscribe(all, false);
    if (C.AUTO_NEXT || rewardedDue()) nextCard('ended');
  }

  // ---------------------------------------------------------------- challenge share card
  function shareCard(leaving) {
    return new Promise(done => {
      shared = true;
      const n = chN, s = streakDone();
      ev('challenge_done');
      const pts = best != null ? ` — ${best.toLocaleString('en-US')} pts` : '';
      const url = `riffcade.com/c/${n}`;
      const text = `RIFFCADE #${n} 🔥${s}${pts} ${url}`;
      const o = card('g-share', `<div class="eyebrow">Today's challenge · #${n}</div><h2>Day ${s} 🔥</h2>
        ${best != null ? `<p class="g-pts">${best.toLocaleString('en-US')} pts</p>` : ''}<p class="g-sharetext">${esc(text)}</p>
        <button class="btn big" id="gShareGo">Share</button><button class="btn ghost" id="gShareClose">${leaving ? 'Continue' : 'Keep playing'}</button>`);
      o.id = 'gShare';
      const close = () => { o.remove(); done(); };
      $('gShareGo').onclick = async () => {
        ev('share');
        if (navigator.share) { try { await navigator.share({ text }); return close(); } catch (e) { if (e && e.name === 'AbortError') return; } }
        const ok = await copyText(text);
        toast(ok ? 'Copied. Paste it anywhere.' : text);
      };
      $('gShareClose').onclick = close;
      addEventListener('keydown', function k(e) { if (e.key === 'Escape' && document.contains(o)) { removeEventListener('keydown', k); close(); } });
    });
  }

  // ---------------------------------------------------------------- auto-next (+ the once-per-session rewarded offer)
  const rewardedDue = () => C.ADS_ENABLED && !ss.get('rewardedOffered', false);
  function go(slug, extra = '') {
    const to = `play.html?g=${encodeURIComponent(slug)}${extra}`;
    // between games: the session's one interstitial, never mid-game
    if (C.ADS_ENABLED) ads().then(a => (a ? a.showInterstitial() : null)).then(() => { location.href = to; }, () => { location.href = to; });
    else location.href = to;
  }
  function goHome() {
    if (C.ADS_ENABLED) ads().then(a => (a ? a.showInterstitial() : null)).then(() => { location.href = './'; }, () => { location.href = './'; });
    else location.href = './';
  }

  // reason: 'ended' (round over: Cancel keeps them here) or 'back' (they tapped back: Cancel goes home).
  // Resolves 'none' (nothing to show), 'went' (navigating) or 'cancelled'.
  function nextCard(reason) {
    return new Promise(resolve => {
      const nx = C.AUTO_NEXT ? pickNext() : null;
      const offer = rewardedDue();
      if (!nx && !offer) return resolve('none');
      const bonus = challengeSlug(dayNum() + 1) || (nx && nx.slug);
      const o = card('g-next', `${nx ? `<div class="eyebrow">Next</div><img class="g-cover" src="${esc(art(nx))}" alt="">
        <h2>Next: ${esc(nx.name)}</h2><p id="gCount" aria-live="polite">Starting in 3</p>
        <button class="btn big" id="gGo">Play now</button>
        <div class="g-row"><button class="btn ghost" id="gCancel">Cancel</button><button class="btn ghost" id="gPick">Pick another</button></div>` :
        `<div class="eyebrow">Bonus</div><h2>Unlock a bonus level</h2><div class="g-row"><button class="btn ghost" id="gCancel">No thanks</button></div>`}
        ${offer ? '<button class="btn g-reward" id="gReward">▶ Watch a short ad to unlock a bonus level</button>' : ''}`);
      o.id = 'gNext';
      if (nx) ev('next_shown');
      if (offer) { ss.set('rewardedOffered', true); ev('ad_rewarded_offer'); }
      let n = 3, t = 0;
      const stop = () => { clearInterval(t); t = 0; const c = $('gCount'); if (c) c.textContent = ''; };
      const finish = v => { stop(); removeEventListener('keydown', key); o.remove(); resolve(v); };
      const cancel = () => { if (nx) ev('next_cancel'); finish('cancelled'); if (reason === 'back') goHome(); };
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
      addEventListener('keydown', key);
      if (nx) {
        t = setInterval(() => { n--; const c = $('gCount'); if (n > 0) { if (c) c.textContent = `Starting in ${n}`; return; } stop(); ev('next_go'); finish('went'); go(nx.slug, '&from=next'); }, 1000);
        $('gGo').onclick = () => { ev('next_go'); finish('went'); go(nx.slug, '&from=next'); };
        $('gPick').onclick = () => { ev('next_pick'); finish('went'); goHome(); };
        $('gGo').focus({ preventScroll: true });
      }
      $('gCancel').onclick = cancel;
      // stop the countdown as soon as they touch the card, so nothing happens behind their back
      o.addEventListener('pointerdown', e => { if (e.target.id !== 'gGo') stop(); }, true);
      if (offer) $('gReward').onclick = async () => {
        stop();
        const a = await ads();
        if (!a) return;
        ev('ad_rewarded_start');
        const r = await a.showRewarded();
        if (r && r.completed && bonus) { ev('ad_rewarded_done'); finish('went'); location.href = `play.html?g=${encodeURIComponent(bonus)}&bonus=1`; }
        else $('gReward').remove(); // skipped: no reward, nothing else changes
      };
    });
  }

  // shell.js asks before leaving a game (back / Back to RIFFCADE). Resolves true when Grow took over the navigation.
  async function leave(started) {
    if (started && chN && !shared) await shareCard(true);
    if (started && ss.get('games', 0) >= 2 && subDue()) await subscribe(all, false);
    if (started && (await nextCard('back')) !== 'none') return true;
    if (C.ADS_ENABLED && started) { goHome(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- "New games every morning" (SUBSCRIBE_V2)
  const subDue = () => C.SUBSCRIBE_V2 && ls.get('subDay', null) !== today();
  const ua = navigator.userAgent;
  const metaInApp = /FBAN|FBAV|Instagram/.test(ua);
  const iPhone = /iPhone|iPad|iPod/.test(ua);
  function subscribe(gs, fromEscape) {
    return new Promise(done => {
      ls.set('subDay', today());
      ev('sub_shown');
      // tomorrow's additions aren't known ahead (the pipeline picks them each morning), so: today's newest
      const fresh = gs.filter(g => g.chat_safe !== false && !g.external && !g.linkout).sort((a, b) => (b.added || '') > (a.added || '') ? 1 : -1).slice(0, 3);
      const P = C.DAILY_PROMPT || 'Every morning, check https://riffcade.com/today and send me the 5 newest games with their links.';
      const back = 'https://riffcade.com/arcade/?sub=1';
      const escapeHtml = metaInApp && !fromEscape ? `<div class="g-escape"><b>1. Open in your browser</b>
        ${iPhone ? `<a class="btn big" id="gOpen" href="x-safari-${back}">Open in Safari</a><p>Nothing happens? Tap <b>⋯</b> → <b>Open in browser</b>, or copy the link.</p><button class="btn ghost" id="gCopyLink">Copy link</button>`
          : `<a class="btn big" id="gOpen" href="intent://riffcade.com/arcade/?sub=1#Intent;scheme=https;package=com.android.chrome;end">Open in Chrome</a>`}
        <b>2. Then pick your AI</b></div>` : '';
      const o = card('g-sub', `<div class="eyebrow">New games every morning</div><h2>Get tomorrow's games in your AI</h2>
        <div class="g-fresh">${fresh.map(g => `<figure><img src="${esc(art(g))}" alt=""><figcaption>${esc(g.name)}</figcaption></figure>`).join('')}</div>
        ${escapeHtml}
        <a class="btn big" id="gGpt" href="https://chatgpt.com/?q=${encodeURIComponent(P)}" target="_blank" rel="noopener">ChatGPT: tap Send, then confirm the daily task</a>
        <button class="btn" id="gClaude">Claude (Pro/Max)</button>
        ${C.WHATSAPP_CHANNEL_URL ? `<a class="btn" id="gWa" href="${esc(C.WHATSAPP_CHANNEL_URL)}" target="_blank" rel="noopener">WhatsApp Channel</a>` : ''}
        <button class="btn ghost" id="gSubClose">Not now</button>`);
      const close = () => { o.remove(); removeEventListener('keydown', key); done(); };
      const key = e => { if (e.key === 'Escape') close(); };
      addEventListener('keydown', key);
      const tap = ch => { ev('sub_tap_' + ch); pixel('DailyButtonTap', true); };
      $('gGpt').onclick = () => tap('chatgpt');
      $('gClaude').onclick = () => {
        tap('claude');
        const copied = copyText(P); // starts while this page still has focus
        window.open('https://claude.ai/new', '_blank', 'noopener');
        copied.then(ok => toast(ok ? 'Prompt copied: paste it into Claude and send.' : 'Paste this into Claude: ' + P));
      };
      if ($('gWa')) $('gWa').onclick = () => tap('whatsapp');
      if ($('gOpen')) $('gOpen').onclick = () => ev('sub_inapp_open');
      if ($('gCopyLink')) $('gCopyLink').onclick = () => copyText(back).then(ok => toast(ok ? 'Link copied. Paste it in Safari.' : back));
      $('gSubClose').onclick = close;
    });
  }

  window.Grow = { config: C, home, onLoad, onStart, leave, adsOn: !!C.ADS_ENABLED, ev };
})();
