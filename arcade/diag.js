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
  let queue = [], kids = false, sentDevice = false;
  const push = (type, data) => { if (!kids) queue.push({ type, at: Date.now(), ...data }); };

  function device() {
    const q = new URLSearchParams(location.search), n = navigator, c = n.connection || {};
    return { ua: n.userAgent, lang: n.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, sw: screen.width, sh: screen.height,
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, touch: matchMedia('(pointer: coarse)').matches, mem: n.deviceMemory || null,
      cores: n.hardwareConcurrency || null, net: c.effectiveType || null, pwa: matchMedia('(display-mode: standalone)').matches || n.standalone === true,
      src: q.get('utm_source') || q.get('ref') || (document.referrer ? new URL(document.referrer).hostname : 'direct'), camp: q.get('utm_term') || q.get('utm_campaign') || null };
  }
  function flush(beacon) {
    if (!queue.length && sentDevice) return;
    const ok = RC.state() === 'accepted';
    const body = JSON.stringify({ sid, consent: ok, page: location.pathname.split('/').pop() || 'index', device: ok && !sentDevice ? device() : null, events: queue.splice(0, 60) });
    if (ok) sentDevice = true;
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(API + '/api/diag', new Blob([body], { type: 'text/plain' }));
    else fetch(API + '/api/diag', { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body }).catch(() => {});
  }
  setInterval(() => flush(false), 15000);
  addEventListener('pagehide', () => { if (game) endRun('close'); push('page_end', { secs: Math.round((performance.now() - T0) / 1000) }); flush(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
  push('page', {});
  addEventListener('error', e => push('error', { slug: game && game.slug, where: 'page', msg: String(e.message || e).slice(0, 200), src: (e.filename || '').split('/').slice(-2).join('/') + ':' + (e.lineno || 0) }));

  // ---- one game run ----
  let game = null;
  function watch(frame, g) {
    const w = frame.contentWindow; if (!w || w.__diag) return; w.__diag = true;
    const r = game;
    w.addEventListener('error', e => r.errors.push(String(e.message || 'error').slice(0, 200) + ' @' + (e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
    w.addEventListener('unhandledrejection', e => r.errors.push(('promise: ' + String((e.reason && e.reason.message) || e.reason)).slice(0, 200)));
    w.document.addEventListener('webglcontextlost', () => r.errors.push('webgl context lost'), true);
    // frames: a gap over 2 s while the tab is visible = a freeze; also the share of slow (>50 ms) frames
    let last = 0;
    const tick = t => {
      if (game !== r) return;
      if (last && !w.document.hidden && !document.hidden) { const d = t - last; r.frames++; if (d > 50) r.slow++; if (d > 2000) r.freezes.push(Math.round(d)); }
      last = w.document.hidden || document.hidden ? 0 : t; w.requestAnimationFrame(tick);
    };
    w.requestAnimationFrame(tick);
    // taps: rage = 4+ taps within 1.2 s inside 40 px; no-progress = 25+ taps in 20 s with the score/level/state unchanged
    const taps = [];
    w.addEventListener('pointerdown', e => {
      const now = performance.now(); r.taps++; taps.push([now, e.clientX, e.clientY]);
      while (taps.length && now - taps[0][0] > 20000) taps.shift();
      const near = taps.filter(([t, x, y]) => now - t < 1200 && Math.hypot(x - e.clientX, y - e.clientY) < 40);
      if (near.length >= 4 && now - r.lastRage > 3000) { r.rage++; r.lastRage = now; r.rageAt.push([Math.round(e.clientX / w.innerWidth * 100), Math.round(e.clientY / w.innerHeight * 100)]); }
      const s = state(w);
      if (s !== r.lastState) { r.lastState = s; r.progressAt = now; }
      if (taps.length >= 25 && now - r.progressAt > 20000 && now - r.lastStuck > 20000) { r.stuck++; r.lastStuck = now; }
    }, true);
  }
  const state = w => { try { const g = w.__game; return g ? [g.state, g.score, g.level].join('|') : ''; } catch (e) { return ''; } };
  function endRun(reason) {
    const r = game; if (!r) return; game = null;
    const secs = Math.round((performance.now() - r.t0) / 1000);
    push('game', { slug: r.slug, cat: r.cat, secs, reason, load_ms: r.loadMs, fps: r.frames ? Math.round(r.frames / Math.max(1, secs)) : null,
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
      game = { slug: g.slug, cat: g.category || '', frame, t0: performance.now(), loadMs: Math.round(performance.now() - T0), errors: [], freezes: [], frames: 0, slow: 0,
        taps: 0, rage: 0, rageAt: [], stuck: 0, lastRage: 0, lastStuck: 0, lastState: '', progressAt: performance.now() };
      try { watch(frame, g); } catch (e) { game.errors.push('diag: ' + e.message); }
    },
    end(reason) { endRun(reason); },
  };
})();
