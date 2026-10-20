// AGENTPARK diagnostics: finds games that crash, freeze, never load, run slowly or leave players tapping at nothing.
// Per tab session (the same random sessionStorage id as the usage counts) it sends, in small batches, to mcp.riffcade.com/api/diag:
//   always: the problem events (error, freeze, load_fail, slow, rage taps, no-progress tapping, quick quit) with the game slug;
//   only after Accept in the consent popup: the device summary (model/OS/browser from the user agent, screen, language,
//   where the visit came from). The server turns the IP into a country (only with Accept) and never stores the IP.
// Never runs in the chat versions (?embed=chat) or on Kids games. API: window.ArcadeDiag.{load, start, end}(…) called by grow.js.
(function () {
  if (new URLSearchParams(location.search).get('embed') === 'chat') return;
  const API = 'https://mcp.riffcade.com';
  const RC = window.RiffConsent || { state: () => null };
  const sid = (() => { try { return JSON.parse(sessionStorage.getItem('arcade.s.sid')); } catch (e) { return null; } })() ||
    ((crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now()).replace(/[^\w-]/g, '').slice(0, 36);
  try { sessionStorage.setItem('arcade.s.sid', JSON.stringify(sid)); } catch (e) {}
  const T0 = performance.now();
  // the channel this tab came in on (meta / daily-ai / a referrer / direct): a label, not about the person, sent with every batch
  const SRC = (() => {
    let s; try { s = sessionStorage.getItem('arcade.s.src0'); } catch (e) {}
    if (s) return s;
    const q = new URLSearchParams(location.search), u = (q.get('utm_source') || '').toLowerCase();
    s = q.get('fbclid') || /^(meta|facebook|instagram|fb|ig)$/.test(u) ? 'meta' : /^daily/.test(q.get('ref') || '') ? 'ai-daily' : u ? u.replace(/[^\w.-]/g, '').slice(0, 30)
      : document.referrer && !/agentpark\.co|riffcade\.com/.test(document.referrer) ? new URL(document.referrer).hostname.slice(0, 40) : 'direct';
    try { sessionStorage.setItem('arcade.s.src0', s); } catch (e) {}
    return s;
  })();
  let queue = [], kids = false, sentDevice = false;
  const push = (type, data) => { if (!kids) queue.push({ type, at: Date.now(), ...data }); };

  function device() {
    const q = new URLSearchParams(location.search), n = navigator, c = n.connection || {};
    return { ua: n.userAgent, lang: n.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, sw: screen.width, sh: screen.height,
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, touch: matchMedia('(pointer: coarse)').matches, mem: n.deviceMemory || null,
      cores: n.hardwareConcurrency || null, net: c.effectiveType || null, pwa: matchMedia('(display-mode: standalone)').matches || n.standalone === true,
      src: SRC, camp: q.get('utm_term') || q.get('utm_campaign') || null };
  }
  function flush(beacon) {
    if (!queue.length && sentDevice) return;
    const ok = RC.state() === 'accepted';
    // pid: this browser's own prompt code (habits.js, kept on the device), only with Accept: lets the store report count one
    // player's visits across days. ab: which first screen this tab got from an ad / AI (pick = 6 games, game = one game)
    let pid = null, ab = null; try { pid = ok ? localStorage.getItem('ap.u') : null; ab = sessionStorage.getItem('ap.ab'); } catch (e) {}
    const body = JSON.stringify({ sid, src: SRC, consent: ok, pid, ab, page: location.pathname.split('/').pop() || 'index', device: ok && !sentDevice ? device() : null, events: queue.splice(0, 60) });
    if (ok) sentDevice = true;
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(API + '/api/diag', new Blob([body], { type: 'text/plain' }));
    else fetch(API + '/api/diag', { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body }).catch(() => {});
  }
  setInterval(() => flush(false), 15000);
  setTimeout(() => flush(false), 3000);   // early first batch: most visitors who leave do it within seconds
  addEventListener('pagehide', () => { if (game) endRun('close'); push('page_end', { secs: Math.round((performance.now() - T0) / 1000), taps, scroll: maxScroll, kinds: byKind }); flush(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
  push('page', { page: location.pathname.split('/').pop() || 'index', bot: navigator.webdriver === true || /HeadlessChrome|Playwright|puppeteer/i.test(navigator.userAgent) ? 1 : 0 });

  // ---- what happened on the page before (or instead of) a game: why visitors leave without playing
  // perf: how long the page took to show (time to first byte, DOM ready, load, largest paint) and how much it downloaded.
  // ui: the consent card / install sheet appearing and being answered, the first tap and what it hit, taps by kind,
  // how far they scrolled, when they switched away. Labels only (card / chip / play / button text), never typed text.
  const ms = () => Math.round(performance.now() - T0);
  let lcp = 0; try { new PerformanceObserver(l => { const e = l.getEntries().pop(); if (e) lcp = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  addEventListener('load', () => setTimeout(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const kb = Math.round(performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), n.transferSize || 0) / 1024);
    push('perf', { ttfb: Math.round(n.responseStart || 0), dom: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || performance.now()), lcp, kb });
  }, 300));
  const seen = new Set();
  const ui = (what, data) => push('ui', Object.assign({ what, ms: ms() }, data || {}));
  new MutationObserver(() => {
    if (document.getElementById('rcBanner') && !seen.has('consent')) { seen.add('consent'); ui('consent_shown'); }
    if (document.querySelector('.isheet') && !seen.has('install')) { seen.add('install'); ui('install_shown'); }
    if (document.querySelector('.slowbar') && !seen.has('slow')) { seen.add('slow'); ui('slow_shown'); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (RC.onChange) RC.onChange(v => ui('consent_' + (v === 'accepted' ? 'yes' : 'no')));
  const kind = t => {
    const el = t && t.closest ? t : null; if (!el) return 'other';
    if (el.closest('#rcBanner')) return 'consent';
    if (el.closest('.isheet')) return 'install';
    if (el.closest('#go')) return 'play';
    if (el.closest('[data-slug]')) return 'game_card';
    if (el.closest('.chip')) return 'category';
    if (el.closest('.mode')) return 'mode';
    if (el.closest('.ai, [data-k]')) return 'ai_button';
    const b = el.closest('a, button'); if (b) return (b.tagName === 'A' ? 'link:' : 'btn:') + (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return 'blank';
  };
  let taps = 0, firstTap = false, maxScroll = 0; const byKind = {};
  addEventListener('pointerdown', e => {
    const k = kind(e.target); taps++; byKind[k] = (byKind[k] || 0) + 1;
    if (!firstTap) { firstTap = true; ui('first_tap', { on: k, x: Math.round(e.clientX / innerWidth * 100), y: Math.round(e.clientY / innerHeight * 100) }); }
  }, true);
  addEventListener('scroll', () => { const h = document.documentElement.scrollHeight - innerHeight; if (h > 0) maxScroll = Math.max(maxScroll, Math.round(100 * scrollY / h)); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !seen.has('hidden')) { seen.add('hidden'); ui('left', { taps, scroll: maxScroll, kinds: byKind }); } });
  addEventListener('error', e => push('error', { slug: game && game.slug, where: 'page', msg: String(e.message || e).slice(0, 200), src: (e.filename || '').split('/').slice(-2).join('/') + ':' + (e.lineno || 0) }));

  // ---- one game run ----
  let game = null;
  function watch(frame, g) {
    const w = frame.contentWindow; if (!w || w.__diag) return; w.__diag = true;
    const r = game;
    w.addEventListener('error', e => r.errors.push(String(e.message || 'error').slice(0, 200) + ' @' + (e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
    w.addEventListener('unhandledrejection', e => r.errors.push(('promise: ' + String((e.reason && e.reason.message) || e.reason)).slice(0, 200)));
    w.document.addEventListener('webglcontextlost', () => r.errors.push('webgl context lost'), true);
    // frames: a gap over 2 s while the tab is visible = a freeze; also the share of slow (>50 ms) frames. fps is over the time the
    // frames were counted (visible), not the whole run: the in-app browsers report the page hidden for long stretches
    let last = 0;
    const tick = t => {
      if (game !== r) return;
      if (last && !w.document.hidden && !document.hidden) { const d = t - last; r.frames++; r.visMs += d; if (d > 50) r.slow++; if (d > 2000) r.freezes.push(Math.round(d)); }
      last = w.document.hidden || document.hidden ? 0 : t; w.requestAnimationFrame(tick);
    };
    w.requestAnimationFrame(tick);
    // taps: rage = 4+ taps within 1.2 s inside 40 px; no-progress = 25+ taps in 20 s with the score/level/state unchanged
    const taps = [];
    w.addEventListener('pointerdown', e => {
      const now = performance.now(); r.taps++; taps.push([now, e.clientX, e.clientY]);
      if (r.visMs >= 20000 && r.taps >= 5) cpaPlay(r);
      while (taps.length && now - taps[0][0] > 20000) taps.shift();
      const near = taps.filter(([t, x, y]) => now - t < 1200 && Math.hypot(x - e.clientX, y - e.clientY) < 40);
      if (near.length >= 4 && now - r.lastRage > 3000) { r.rage++; r.lastRage = now; r.rageAt.push([Math.round(e.clientX / w.innerWidth * 100), Math.round(e.clientY / w.innerHeight * 100)]); }
      const s = state(w);
      if (s !== r.lastState) { r.lastState = s; r.progressAt = now; }
      if (taps.length >= 25 && now - r.progressAt > 20000 && now - r.lastStuck > 20000) { r.stuck++; r.lastStuck = now; }
    }, true);
  }
  // a CPAlead offerwall conversion needs a real play (20 s on screen, 5 taps), not just the AI step: told once per device, with
  // the visitor's own prompt code only (the server ignores codes that didn't come from CPAlead)
  function cpaPlay(r) {
    let u = null; try { if (localStorage.getItem('ap.cpaplay')) return; u = localStorage.getItem('ap.u'); if (!/^[a-z0-9]{8,16}$/.test(u || '')) return; localStorage.setItem('ap.cpaplay', '1'); } catch (e) { return; }
    fetch(API + '/api/cpa-play', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ u, slug: r.slug, vis_s: Math.round(r.visMs / 1000), taps: r.taps }) }).catch(() => {});
  }
  const state = w => { try { const g = w.__game; return g ? [g.state, g.score, g.level].join('|') : ''; } catch (e) { return ''; } };
  function endRun(reason) {
    const r = game; if (!r) return; game = null;
    const secs = Math.round((performance.now() - r.t0) / 1000);
    push('game', { slug: r.slug, cat: r.cat, secs, reason, load_ms: r.loadMs, fps: r.frames && r.visMs > 500 ? Math.round(r.frames * 1000 / r.visMs) : null, vis_s: Math.round(r.visMs / 1000),
      slow_pct: r.frames ? Math.round(100 * r.slow / r.frames) : null, freezes: r.freezes.slice(0, 5), errors: [...new Set(r.errors)].slice(0, 5),
      taps: r.taps, rage: r.rage, rage_at: r.rageAt.slice(0, 5), stuck: r.stuck, quick_quit: secs < 15, final: (() => { try { return state(r.frame.contentWindow); } catch (e) { return ''; } })() });
    flush(false);
  }
  window.ArcadeDiag = {
    load(g) {
      kids = g.category === 'Kids' || (g.tags || []).includes('Kids'); if (kids) queue = [];
      const f = document.querySelector('.player iframe, iframe');
      const t = performance.now(); let loaded = false;
      if (f) f.addEventListener('load', () => { loaded = true; push('loaded', { slug: g.slug, ms: Math.round(performance.now() - t) }); }, { once: true });
      setTimeout(() => { if (!loaded && !document.hidden) push('load_fail', { slug: g.slug, ms: 20000 }); }, 20000);
    },
    start(g, frame) {
      if (game) endRun('next');
      game = { slug: g.slug, cat: g.category || '', frame, t0: performance.now(), loadMs: Math.round(performance.now() - T0), errors: [], freezes: [], frames: 0, visMs: 0, slow: 0,
        taps: 0, rage: 0, rageAt: [], stuck: 0, lastRage: 0, lastStuck: 0, lastState: '', progressAt: performance.now() };
      try { watch(frame, g); } catch (e) { game.errors.push('diag: ' + e.message); }
      push('start', { slug: g.slug, cat: g.category || '' }); flush(false);   // counted even if the in-app browser is closed mid-game
    },
    end(reason) { endRun(reason); },
  };
})();
