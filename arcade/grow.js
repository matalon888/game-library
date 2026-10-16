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
  // Google Analytics + the Meta pixel live in consent.js and load only after "Accept"; every funnel event also goes to GA then.
  const RC = window.RiffConsent || { state: () => null, accepted: () => false, ga() {}, pixel() {}, setKids() {}, onChange() {} };
  const ga = (name, p) => RC.ga(name, p);
  const ev = name => (ga(name), fetch(API + '/api/ev', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, sid }) }).catch(() => {}));
  const once = (key, name) => { if (!ss.get('once.' + key, false)) { ss.set('once.' + key, true); ev(name); } };
  once('session', 'session');
  if (/^daily/.test(q.get('ref') || '')) once('ref_daily', 'ref_daily');  // ?ref=daily or ?ref=daily-<ai> from the /today page

  // ---------------------------------------------------------------- habits -> analytics (habits.js): weak / okay / strong
  // The tier is worked out on the device from its own play history; only the label leaves it (first-party, per session).
  // With consent, GA also gets the habit profile as user properties and every game's start / end.
  const RH = window.RiffHabits || null;
  const src = RH ? RH.source() : 'direct';
  const dailyAi = ((q.get('ref') || '').match(/^daily(?:-(\w+))?$/) || [])[0] ? ((q.get('ref') || '').split('-')[1] || 'unknown') : null;
  const pv = /^[a-e]$/.test(q.get('pv') || '') ? q.get('pv') : 'a';
  const pos = Math.max(0, Math.min(50, +q.get('pos') || 0));
  if (RH && dailyAi && !ss.get('dailyMarked', false)) { ss.set('dailyMarked', true); RH.daily(dailyAi); }
  const prof = RH ? RH.profile() : null, tierNow = RH ? RH.tier(prof) : 'unknown';
  if (RH && !ss.get('tierSent', false)) {
    ss.set('tierSent', true);
    ev('tier_' + tierNow);
    RC.setUser && RC.setUser({ player_tier: tierNow, days_active_7: String(prof.days_active_7), daily_ai: prof.daily_ai, first_source: prof.first_source, installed: prof.installed, prompt_variant: RH.variant() });
    ga('player_profile', Object.assign({ player_tier: tierNow, source: src }, prof));
  }
  if (dailyAi && !ss.get('once.daily_arrival', false)) {
    ss.set('once.daily_arrival', true);
    ev('daily_v_' + pv);
    ga('daily_arrival', { ai: dailyAi, prompt_variant: pv, list_position: pos, game_id: q.get('g') || '', player_tier: tierNow });
  }

  // ---------------------------------------------------------------- dates (UTC: the same challenge for everyone)
  const today = () => new Date().toISOString().slice(0, 10);
  const shift = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
  const EPOCH = C.CHALLENGE_EPOCH || '2026-10-15';
  const dayNum = (d = today()) => Math.floor((Date.parse(d) - Date.parse(EPOCH)) / 864e5) + 1;
  const LIST = C.CHALLENGE_GAMES || [];
  const challengeSlug = n => LIST.length && n >= 1 ? LIST[(n - 1) % LIST.length] : null;

  // ---------------------------------------------------------------- styles (loaded only when a feature is on)
  // the free AGENTPARK app in your AI (the daily prompt card): for everyone with SUBSCRIBE_V2, and always for ad visitors (after
  // their second game: the ads sell 'the free game app for AI', and coming back every day is the goal, not one game)
  const AD = !!(window.ApAttrib && ApAttrib.fromAd()), SUB = C.SUBSCRIBE_V2 || AD || q.get('sub') === '1';
  const anyOn = C.AUTO_NEXT || C.DAILY_CHALLENGE || SUB || C.ADS_ENABLED;
  if (anyOn) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'grow.css'; document.head.appendChild(l); }

  // ---------------------------------------------------------------- consent (consent.js: one banner, decline by default)
  // Ads stay non-personalised until "Accept". Kids games: never personalised ads, never GA or the pixel.
  let kids = false;
  // every Meta event goes twice with one id: the browser pixel and our server (attrib.js → Conversions API); Meta keeps one
  const pixel = (n, custom, params) => {
    const eid = n + '.' + (G ? G.slug : 'x') + '.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    RC.pixel(n, custom, params, eid);
    if (window.ApAttrib) ApAttrib.conv(n, G ? { slug: G.slug, name: G.name, cat: G.category || 'Arcade' } : {}, eid, kids);
  };
  RC.onChange(v => { ev(v === 'accepted' ? 'consent_accept' : 'consent_decline'); if (window.RiffAds) window.RiffAds.consent(v === 'accepted' && !kids); });

  // ---------------------------------------------------------------- ads (adapter loads only when ADS_ENABLED)
  let adsReady = null;
  const ads = () => adsReady || (adsReady = !C.ADS_ENABLED ? Promise.resolve(null) : new Promise(res => {
    const load = src => new Promise(r => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = r; document.head.appendChild(s); });
    load('ads/singular-config.js').then(() => load('ads/adapter.js')).then(() => {
      if (!window.RiffAds) return res(null);
      window.RiffAds.init({ personalised: RC.accepted() && !kids, count: ev });
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
    if (!C.DAILY_CHALLENGE) { if (q.get('sub') === '1') subscribe(gs, true); return; }
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
    if (q.get('sub') === '1') subscribe(gs, true);
  }

  // ---------------------------------------------------------------- the player
  let G = null, all = [], chN = 0, best = null, ended = false, shared = false, wonOnce = false;
  const played = () => ss.get('played', []);
  function pickNext() {
    const seen = new Set(played().concat(G ? [G.slug] : []));
    const phone = matchMedia('(pointer: coarse)').matches;
    const ok = x => x.chat_safe !== false && !x.linkout && !x.external && !seen.has(x.slug) && !(phone && (x.platform === 'desktop' || x.orientation === 'landscape')) && x.category !== 'Kids';
    const tags = new Set(G && G.tags || []);
    const same = all.filter(x => ok(x) && (x.category === G.category || (x.tags || []).some(t => tags.has(t))));
    const pool = same.length ? same : all.filter(ok);
    return pool[Math.floor(Math.random() * Math.min(pool.length, 12))] || null; // among the best-ranked few, so it's not always the same one
  }
  // the feed (config.js FEED): upright one-thumb games on our kit, shuffled once per tab with the hand-checked ones first.
  // Feeds the next-game rail under every game and the round-over picks. Skips games played this tab.
  function feed() {
    let f = ss.get('feed', null);
    if (!f) {
      const L = C.FEED || [], top = L.slice(0, 9), sh = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
      f = sh(top).concat(sh(L.slice(9))); ss.set('feed', f);
    }
    return f;
  }
  function feedNext(skip = []) {
    const seen = new Set(played().concat(G ? [G.slug] : [], skip));
    for (const s of feed()) { const g = all.find(x => x.slug === s); if (g && !seen.has(s)) return g; }
    return pickNext();
  }

  function onLoad(g, gs) {
    G = g; all = gs;
    if (window.ArcadeDiag) ArcadeDiag.load(g);
    kids = g.category === 'Kids' || (g.tags || []).includes('Kids');
    RC.setKids(kids); // consent.js starts GA / the pixel now (never on a Kids game)
    if (q.get('ref') === 'c') once('c_arrival.' + g.slug, 'c_arrival');
    const n = +q.get('ch');
    if (C.DAILY_CHALLENGE && n >= 1 && challengeSlug(n) === g.slug) chN = n;
    if (C.ADS_ENABLED) { // the banner row is reserved before the game starts, so nothing jumps when the banner fills it
      const p = document.querySelector('.player');
      if (p && !$('gAdbar')) { p.classList.add('has-ad'); const bar = document.createElement('div'); bar.id = 'gAdbar'; bar.className = 'g-adbar'; p.appendChild(bar); }
    }
  }

  // one game's start and end, for GA: how long, best score, how it ended (back / next / close), rounds lost
  let t0 = 0, endSent = false, roundsLost = 0;
  function endGame(reason) {
    if (!t0 || endSent) return Promise.resolve();
    endSent = true;
    if (window.ArcadeDiag) ArcadeDiag.end(reason);
    const secs = (Date.now() - t0) / 1000;
    if (RH) RH.gameEnd(secs);
    // GA batches events for ~5 s and drops them when the page goes: this one is beaconed at once (consent.js gaNow)
    return (RC.gaNow || ((n, p) => Promise.resolve(ga(n, p))))('game_end', { game_id: G.slug, game_category: G.category || '', play_seconds: Math.round(secs), score: best ?? undefined, end_reason: reason, rounds_lost: roundsLost, source: src, player_tier: tierNow });
  }
  addEventListener('pagehide', () => endGame('close'));

  let FR = null;
  function onStart(frame) {
    FR = frame;
    if (window.ArcadeDiag) ArcadeDiag.start(G, frame);
    rail();
    const list = played(); if (!list.includes(G.slug)) list.push(G.slug); ss.set('played', list);
    const count = ss.get('games', 0) + 1; ss.set('games', count);
    ev('game');
    t0 = Date.now();
    try { if (!sessionStorage.getItem('ap.t1')) sessionStorage.setItem('ap.t1', String(t0)); } catch (e) {}   // first game start of the tab
    if (RH) RH.gameStart();
    ga('game_start', { game_id: G.slug, game_category: G.category || '', original: G.original ? 'yes' : 'no', source: src, list_position: pos, challenge: chN ? 'yes' : 'no', session_game_n: count, player_tier: tierNow });
    // Meta: every game start is a standard ViewContent (what ads optimise for); the 1st and 2nd of a session are custom events too
    pixel('ViewContent', false, { content_type: 'product', content_ids: [G.slug], content_name: G.name, content_category: G.category || 'Arcade' });
    if (count === 1) pixel('GamePlayed1', true);
    if (count === 2) pixel('GamePlayed2', true);
    if (chN) ev('challenge_play');
    if (C.ADS_ENABLED) ads().then(a => { if (a && $('gAdbar')) a.showBanner($('gAdbar')); });
    // games built on our kit expose window.__game {state, score}: that's how we know a round ended, and its score
    const watch = setInterval(() => {
      let s; try { s = frame.contentWindow.__game; } catch (e) { return; }
      if (!s) return;
      let st, sc; try { st = s.state; sc = s.score; } catch (e) { return; }
      if (typeof sc === 'number' && isFinite(sc)) best = Math.max(best ?? 0, Math.round(sc));
      if (st === 'lost' && !ended) { ended = true; roundsLost++; (RC.gaNow || ga)('round_end', { game_id: G.slug, outcome: 'lost', score: typeof sc === 'number' && isFinite(sc) ? Math.round(sc) : undefined, round_n: roundsLost, player_tier: tierNow }); setTimeout(() => { try { if (frame.contentWindow.__game.state === 'lost') gameOver(); else ended = false; } catch (e) { ended = false; } }, 1200); }
      else if (st !== 'lost' && ended && !$('gNext') && !$('gShare') && !$('gRound')) ended = false; // they retried
      if (AD && st === 'won' && !wonOnce && ss.get('games', 0) >= 2 && subDue() && !document.querySelector('.g-card')) { wonOnce = true; setTimeout(() => subscribe(all, false), 1400); }
    }, 400);
    addEventListener('pagehide', () => clearInterval(watch));
  }

  // game over (a kit game reports 'lost'): the share card for the challenge, else Next / the rewarded offer
  let leaving = false;
  async function gameOver() {
    if (leaving || document.querySelector('.g-card, .g-ad-full')) return; // one card at a time
    if (chN && !shared) return shareCard(false);
    if (ss.get('games', 0) >= 2 && subDue()) await subscribe(all, false);
    if (C.AUTO_NEXT || rewardedDue()) nextCard('ended'); else roundCard();
  }

  // ---------------------------------------------------------------- challenge share card
  function shareCard(leaving) {
    return new Promise(done => {
      shared = true;
      const n = chN, s = streakDone();
      ev('challenge_done');
      const pts = best != null ? ` — ${best.toLocaleString('en-US')} pts` : '';
      const url = `agentpark.co/c/${n}`;
      const text = `AGENTPARK #${n} 🔥${s}${pts} ${url}`;
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

  // ---------------------------------------------------------------- next game button (every game on the web)
  // A strip under the game: "Next game: <name>  [Next game ▶]". Click the button and the next game slides in and starts by
  // itself (shell.js autostart via ap.auto), like the next Reel: someone who doesn't like this game gets another one instead
  // of closing the tab. The strip sits under the game, never on it, so the game keeps all its own swipes.
  function swipeTo(nx, how) {
    if (!nx || $('gSwap')) return;
    ev('feed_' + how);
    try { sessionStorage.setItem('ap.auto', nx.slug); } catch (e) {}
    const o = document.createElement('div'); o.id = 'gSwap'; o.className = 'g-swap';
    o.innerHTML = `<img src="${esc(nx.cover || art(nx))}" alt=""><div><small>Next game</small><b>${esc(nx.name)}</b></div>`;
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('in'));
    setTimeout(() => go(nx.slug, '&from=' + how), 900);   // a beat on the next game's cover, so the switch reads as a switch
  }
  function rail() {
    const p = document.querySelector('.player');
    if (!p || $('gRail') || kids) return;
    const nx = feedNext(); if (!nx) return;
    const r = document.createElement('div'); r.id = 'gRail'; r.className = 'g-rail';
    r.innerHTML = `<img src="${esc(art(nx))}" alt=""><span class="g-rt"><small>Next game</small><b>${esc(nx.name)}</b></span><button type="button" class="g-next" aria-label="Next game: ${esc(nx.name)}">Next game ▶</button>`;
    p.appendChild(r); p.classList.add('has-rail');
    setTimeout(() => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = `games/${nx.slug}/${nx.entry || 'index.html'}`; document.head.appendChild(l); }, 4000);
    // only a real click on the button moves on (no swipes, no taps on the strip): a stray touch near the game's bottom edge must never switch games
    const t0 = Date.now();
    r.querySelector('.g-next').addEventListener('click', () => { if (Date.now() - t0 > 1500) swipeTo(nx, 'tap'); });
  }

  // ---------------------------------------------------------------- round over (our kit games report 'lost'): play again or 3 others
  function roundCard() {
    if (document.querySelector('.g-card')) return;
    const picks = [];
    for (let i = 0; i < 3; i++) { const g = feedNext(picks.map(x => x.slug)); if (g && !picks.includes(g)) picks.push(g); }
    const o = card('g-round', `<div class="eyebrow">Round over</div><h2>One more go?</h2>
      <button class="btn big" id="gAgain">↻ Play again</button>
      ${picks.length ? `<p>Or try another game</p><div class="g-picks">${picks.map(g => `<button type="button" data-s="${esc(g.slug)}"><img src="${esc(art(g))}" alt=""><span>${esc(g.name)}</span></button>`).join('')}</div>` : ''}`);
    o.id = 'gRound';
    ev('round_shown');
    $('gAgain').onclick = () => {
      ev('round_replay'); o.remove();
      try { const w = FR.contentWindow, c = w.document.querySelector('.hc-card:not(.hc-hidden)'); if (c) c.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true })); w.focus(); } catch (e) {}
    };
    o.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { ev('round_pick'); swipeTo(all.find(g => g.slug === b.dataset.s), 'round'); });
  }

  // ---------------------------------------------------------------- auto-next (+ the once-per-session rewarded offer)
  const rewardedDue = () => C.ADS_ENABLED && !ss.get('rewardedOffered', false);
  async function go(slug, extra = '') {
    await endGame(/from=(next|swipe|tap|round)/.test(extra) ? 'next' : 'bonus');
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
        t = setInterval(() => { if (!document.contains(o)) return stop(); n--; const c = $('gCount'); if (n > 0) { if (c) c.textContent = `Starting in ${n}`; return; } stop(); ev('next_go'); finish('went'); go(nx.slug, '&from=next'); }, 1000);
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
    await endGame('back');
    leaving = true;
    document.querySelectorAll('.g-card').forEach(o => o.remove()); // a game-over card still open gives way to the leave flow
    if (started && chN && !shared) await shareCard(true);
    if (started && ss.get('games', 0) >= 2 && subDue()) await subscribe(all, false);
    if (started && (await nextCard('back')) !== 'none') return true;
    if (C.ADS_ENABLED && started) { goHome(); return true; }
    return false;
  }

  // back from the AI: did its agent fetch today.agentpark.co with this browser's code? (habits.js agentWatch)
  if (RH && RH.agentWatch) RH.agentWatch((state, k) => {
    const n = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', grok: 'Grok' }[k] || 'Your AI';
    toast(state === 'connected' ? '✅ ' + n + ' is connected. Your games are in the chat, new ones every morning.'
      : state === 'missing' ? n + " didn't check in yet. Did you tap Send?" : 'Your morning games stopped. Ask ' + n + ' to turn the daily task back on.', 6000);
  });

  // ---------------------------------------------------------------- "New games every morning" (SUBSCRIBE_V2)
  const subDue = () => SUB && ls.get('subDay', null) !== today() && !(RH && RH.hasDaily && ['chatgpt', 'claude', 'grok'].some(RH.hasDaily));   // not for someone whose AI already runs it
  const ua = navigator.userAgent;
  const metaInApp = /FBAN|FBAV|Instagram/.test(ua);
  const iPhone = /iPhone|iPad|iPod/.test(ua);
  function subscribe(gs, fromEscape) {
    return new Promise(done => {
      ls.set('subDay', today());
      ev('sub_shown');
      // per AI: one that already runs this browser's daily task gets the list-only prompt (no second task)
      // the game they were just playing (or, back from the Facebook browser in Safari, the one in ?lg=) rides along as &g= on the
      // today link, and the first reply ends with it: the ad promised a game opening from the chat (arcade-api today(): "Your game")
      const yg0 = G || gs.find(x => x.slug === q.get('lg')), yg = yg0 && yg0.chat_safe !== false ? yg0 : null;   // casino games never go to the AI
      const withGame = t => !yg ? t : t.replace(/(https:\/\/today\.(?:agentpark\.co|riffcade\.com)\/\?u=[a-z0-9]+)/, '$1&g=' + encodeURIComponent(yg.slug))
        + ` Only today: finish your reply with my game "${yg.name}" so I can keep playing (its link is at the top of the page under "Your game").`;
      const PF = ai => withGame((RH && RH.prompt(ai)) || P);
      const P = (RH && RH.prompt()) || C.DAILY_PROMPT || 'Right now, open https://today.agentpark.co (add today\'s date to the link as d=YYYY-MM-DD, so you get today\'s page and not a saved copy) and start your reply with its link as "📸 See today\'s games with pictures". Then show the page\'s "Today in one picture" poster as an image. Then list the game of the day and 6 games from every category with their names and links, with a More link next to each category. Don\'t search the web for pictures of them: other games share these names. Then check my scheduled tasks: if a daily AGENT PARK games task already exists, don\'t create another, just tell me it is on. If not, make this a daily task every morning at 8am and confirm it is scheduled.';
      const back = 'https://agentpark.co/arcade/?sub=1' + (RH && RH.agentCode ? '&apu=' + RH.agentCode() : '') + (G ? '&lg=' + encodeURIComponent(G.slug) : '');
      // short on purpose: they don't know us yet. In the Facebook / Instagram browser ChatGPT and Claude open signed out, so
      // there the one step is Safari / Chrome (it comes back here with ?sub=1 and the same code, and shows the AI buttons).
      const esc1 = metaInApp && !fromEscape;
      // two versions of the line, one per browser (kept), counted as sub_line_a / sub_line_b next to sub_shown and the taps
      let line = ls.get('subLine', null); if (line !== 'a' && line !== 'b') { line = Math.random() < 0.5 ? 'a' : 'b'; ls.set('subLine', line); }
      ev('sub_line_' + line);
      // how fast this visitor got from the ad tap to playing (attrib.js ap.t0 → first game start), the case against an app install
      let fast = 0; try { const t0 = +sessionStorage.getItem('ap.t0'), t1 = +sessionStorage.getItem('ap.t1'); if (t0 && t1 > t0) fast = Math.max(1, Math.round((t1 - t0) / 1000)); } catch (e) {}
      if (fast > 20) fast = 0;
      const o = card('g-sub', `<div class="eyebrow">Free</div><h2>Your free AI game center</h2>
        <p class="g-sub-why">${fast ? `You were playing in <b>${fast} seconds</b>. ` : ''}${line === 'b' ? 'No more app installs.' : 'No download, no app store.'}</p>
        <div class="g-pros"><span>⚡ Instant</span><span>📦 No storage</span><span>🎮 New games daily</span><span>💸 Free</span></div>
        ${esc1 ? (iPhone ? `<a class="btn big" id="gOpen" href="x-safari-${back}">Open in Safari to add it</a><p class="g-hint">Nothing happens? Tap <b>⋯</b> → <b>Open in browser</b></p>`
            : `<a class="btn big" id="gOpen" href="intent://${back.replace(/^https:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end">Open in Chrome to add it</a>`)
          : `<a class="btn big" id="gGpt" href="https://chatgpt.com/?q=${encodeURIComponent(PF('chatgpt'))}" target="_blank" rel="noopener">Add to ChatGPT</a>
        <a class="btn" id="gClaude" href="https://claude.ai/new?q=${encodeURIComponent(PF('claude'))}" target="_blank" rel="noopener">Add to Claude</a>
        ${C.WHATSAPP_CHANNEL_URL ? `<a class="btn" id="gWa" href="${esc(C.WHATSAPP_CHANNEL_URL)}" target="_blank" rel="noopener">WhatsApp Channel</a>` : ''}`}
        <button class="btn ghost" id="gSubClose">Keep playing</button>`);
      const close = () => { o.remove(); removeEventListener('keydown', key); done(); };
      const key = e => { if (e.key === 'Escape') close(); };
      addEventListener('keydown', key);
      const tap = ch => { if (RH && RH.agentTapped) RH.agentTapped(ch); ev('sub_tap_' + ch); pixel('DailyButtonTap', true); ga('prompt_tap', { ai: ch, prompt_variant: RH ? RH.variant() : 'a', placement: 'arcade_card', player_tier: tierNow }); fetch(API + '/api/click', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ button: 'ptap-' + (RH ? RH.variant() : 'a') }) }).catch(() => {}); };
      // the prompt goes on the clipboard too: if ChatGPT stops for a log-in, or its app opens without it, they paste
      if ($('gGpt')) $('gGpt').onclick = () => { tap('chatgpt'); copyText(PF('chatgpt')).then(ok => ok && toast('Prompt copied too, in case ChatGPT asks you to log in first.')); };
      if ($('gClaude')) $('gClaude').onclick = () => {
        tap('claude');
        // the link opens Claude with the prompt filled in (claude.ai/new?q=, the app on phones); it goes on the clipboard too
        copyText(PF('claude')).then(ok => toast(ok ? 'Tap Send in Claude. Box empty? Paste, then Send.' : 'Paste this into Claude: ' + PF('claude')));
      };
      if ($('gWa')) $('gWa').onclick = () => tap('whatsapp');
      if ($('gOpen')) $('gOpen').onclick = () => ev('sub_inapp_open');
      $('gSubClose').onclick = close;
    });
  }

  window.Grow = { config: C, home, onLoad, onStart, leave, adsOn: !!C.ADS_ENABLED, ev };
})();
