// RIFFCADE player habits, kept on the device (localStorage), never with an id: which days they played, how many games and
// minutes, whether they came from their AI's daily task. From that: a tier (weak / okay / strong) for analytics, and the
// daily-prompt variant this browser is shown (the A/B test in config.js PROMPTS, when PROMPT_TEST is on).
// The prompt also carries this browser's random agent code (?u=, no id beyond it), so the page can ask whether its own AI
// agent ran: right after the tap (connected / missing) and on later visits (stopped). See agentTapped() and agentWatch().
// API (window.RiffHabits): profile(), tier(), gameStart(), gameEnd(seconds), daily(ai), source(), variant(), prompt(ai), hasDaily(ai),
// agentCode(), agentTapped(ai), agentWatch(cb), ob(step, ai) (the onboarding log).
(function () {
  if (new URLSearchParams(location.search).get('embed') === 'chat') return;
  const C = window.RIFFCADE || {};
  const q = new URLSearchParams(location.search);
  const KEY = 'arcade.hist';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const save = h => { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) {} };
  // the visitor's own calendar day: "played on 4 of the last 7 days" means their days, not UTC
  const day = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const ago = n => day(new Date(Date.now() - n * 864e5));
  const KEEP = 35;

  // where this visit came from: the AI's daily task, a challenge link, a share, an ad, a search, or straight in
  function source() {
    const ref = q.get('ref') || '', utm = q.get('utm_source') || '';
    if (/^daily/.test(ref)) return ref;                       // daily, daily-chatgpt, daily-claude…
    if (ref === 'c') return 'challenge_link';
    if (q.get('fbclid') || /facebook|instagram|meta/i.test(utm)) return 'meta';
    if (q.get('gclid') || /google/i.test(utm)) return 'google_ads';
    if (utm) return 'utm_' + utm.toLowerCase().replace(/[^\w-]/g, '').slice(0, 20);
    if (/embed=chat/.test(document.referrer)) return 'chat';
    try { const r = document.referrer && new URL(document.referrer).hostname; if (r && !/riffcade\.com$/.test(r)) return /google|bing|duckduckgo/.test(r) ? 'search' : /chatgpt|openai|claude|anthropic|perplexity|gemini/.test(r) ? 'ai_referral' : 'referral'; } catch (e) {}
    return 'direct';
  }

  const h = load() || { first: day(), src: source(), days: {} };
  // keep the last KEEP days only
  for (const d of Object.keys(h.days)) if (d < ago(KEEP)) delete h.days[d];
  save(h);
  const today = () => (h.days[day()] ||= { g: 0, s: 0 });

  function profile() {
    const in7 = Object.entries(h.days).filter(([d]) => d > ago(7)), in28 = Object.entries(h.days).filter(([d]) => d > ago(28));
    const played = e => e.filter(([, v]) => v.g > 0);
    const games7 = in7.reduce((n, [, v]) => n + v.g, 0), secs7 = in7.reduce((n, [, v]) => n + v.s, 0);
    const t = h.days[day()] || { g: 0, s: 0 };
    return {
      days_active_7: played(in7).length,
      days_active_28: played(in28).length,
      daily_days_7: in7.filter(([, v]) => v.d).length,      // days they arrived from their AI's daily task
      games_7: games7,
      minutes_7: Math.round(secs7 / 60),
      avg_game_seconds: games7 ? Math.round(secs7 / games7) : 0,
      games_today: t.g,
      days_since_first: Math.max(0, Math.round((Date.parse(day()) - Date.parse(h.first)) / 864e5)),
      first_source: h.src,
      daily_ai: h.ai || 'none',
      installed: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone ? 'yes' : 'no',
    };
  }

  // weak / okay / strong: thresholds in config.js TIERS. The habit, not one good session, makes a strong player.
  function tier(p = profile()) {
    const T = Object.assign({ strong_days_7: 4, strong_daily_days_7: 3, okay_days_7: 2, okay_games_today: 3, okay_minutes_7: 10 }, C.TIERS || {});
    if (p.days_active_7 >= T.strong_days_7 || p.daily_days_7 >= T.strong_daily_days_7 || (p.installed === 'yes' && p.days_active_7 >= T.strong_days_7 - 1)) return 'strong';
    if (p.days_active_7 >= T.okay_days_7 || p.games_today >= T.okay_games_today || p.minutes_7 >= T.okay_minutes_7) return 'okay';
    return 'weak';
  }

  // ---- the daily prompt: one variant per browser while the test runs, carried in the page URL so every step is credited
  const PROMPTS = C.PROMPTS || {};
  function variant() {
    if (!C.PROMPT_TEST || !Object.keys(PROMPTS).length) return 'a';
    let v; try { v = localStorage.getItem('arcade.pv'); } catch (e) {}
    if (!v || !PROMPTS[v]) { const ks = Object.keys(PROMPTS); v = ks[Math.floor(Math.random() * ks.length)]; try { localStorage.setItem('arcade.pv', v); } catch (e) {} }
    return v;
  }
  // prompt(ai): when that AI already runs this browser's daily task (hasDaily), the list-only SHOW_PROMPT, so a second tap
  // doesn't make the AI create a second task (each one spends the user's messages every morning)
  function prompt(ai) {
    const v = variant();
    const text = (ai && hasDaily(ai) && C.SHOW_PROMPT) || (C.PROMPT_TEST && PROMPTS[v]) || C.DAILY_PROMPT || PROMPTS.a || '';
    return text.replace(/(https:\/\/today\.(?:agentpark\.co|riffcade\.com))\/?(?![?\w])/, (m, base) => base + '/?u=' + agentCode() + (C.PROMPT_TEST ? '&v=' + v : ''));
  }

  // ---- did this browser's daily agent run? today.agentpark.co/?u=<code> fetches are logged by code (arcade-api /api/agent)
  const AGENT_API = 'https://mcp.riffcade.com/api/agent?u=';
  function agentCode() {
    let u; try { u = localStorage.getItem('ap.u'); } catch (e) {}
    // arriving from the "open in Safari / Chrome" step of an in-app browser: keep that visitor's code (?apu=)
    if (!/^[a-z0-9]{10}$/.test(u || '') && /^[a-z0-9]{10}$/.test(q.get('apu') || '')) { u = q.get('apu'); try { localStorage.setItem('ap.u', u); } catch (e) {} }
    if (!/^[a-z0-9]{10}$/.test(u || '')) {
      u = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
      try { localStorage.setItem('ap.u', u); } catch (e) {}
    }
    return u;
  }
  const tapGet = () => { try { return JSON.parse(localStorage.getItem('ap.tap')) || null; } catch (e) { return null; } };
  const tapSet = t => { try { localStorage.setItem('ap.tap', JSON.stringify(t)); } catch (e) {} };
  function agentTapped(ai) { tapSet({ ai, at: Date.now(), ok: 0 }); ob('tap', ai); }
  // which AIs have this browser's daily task: set when its agent checks in after a tap (agentWatch); it counts while the
  // agent fetched today's page in the last 48 hours (a task that stopped gets the full prompt again)
  const setGet = () => { try { return JSON.parse(localStorage.getItem('ap.set')) || {}; } catch (e) { return {}; } };
  const setPut = o => { try { localStorage.setItem('ap.set', JSON.stringify(o)); } catch (e) {} };
  function hasDaily(ai) { const o = setGet(), t = tapGet(); return !!((o[ai] || (t && t.ok && t.ai === ai)) && o.seen && Date.now() - o.seen < 48 * 3600e3); }

  // ---- onboarding log: each step with this code, the AI, phone/desktop, in-app browser and where they came from
  // (arcade-api /api/ob; the report is /api/ob-report). Anonymous: the random code is the only identifier.
  const UA = navigator.userAgent;
  const PLAT = /iPhone|iPad|iPod/.test(UA) ? 'ios' : /Android/.test(UA) ? 'android' : 'desktop';
  const INAPP = /Instagram/.test(UA) ? 'instagram' : /FBAN|FBAV|FB_IAB|Messenger/.test(UA) ? 'facebook' : /musical_ly|BytedanceWebview|TikTok/i.test(UA) ? 'tiktok'
    : /Snapchat/.test(UA) ? 'snapchat' : /LinkedInApp/.test(UA) ? 'linkedin' : /Twitter/.test(UA) ? 'x' : /; wv\)/.test(UA) ? 'webview' : null;
  const SRC = (() => {   // first touch wins, kept on the device
    let v; try { v = localStorage.getItem('ap.src'); } catch (e) {}
    if (v) return v;
    const r = (document.referrer.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1];
    v = q.get('utm_source') || (q.get('fbclid') ? 'meta' : q.get('gclid') ? 'google' : q.get('ttclid') ? 'tiktok' : r && !/agentpark\.co|riffcade\.com/.test(r) ? r : 'direct');
    v = String(v).toLowerCase().replace(/[^\w.-]/g, '').slice(0, 24) || 'direct';
    try { localStorage.setItem('ap.src', v); } catch (e) {}
    return v;
  })();
  const PLACE = /connect/.test(location.pathname) ? 'connect' : /\/(landing\.html)?$/.test(location.pathname) && !/\/arcade\/$/.test(location.pathname) ? 'landing' : 'arcade';
  function ob(step, ai) {
    try {
      fetch(AGENT_API.replace('/api/agent?u=', '/api/ob'), { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ u: agentCode(), step, ai: ai || null, plat: PLAT, inapp: INAPP, src: SRC, place: window.AP_PLACE || PLACE }) }).catch(() => {});
    } catch (e) {}
  }
  // cb(state, ai): 'connected' once, at the first fetch after the latest tap; 'missing' when 3 minutes pass with none;
  // 'stopped' when it ran before but not in the last 48 hours. Polls only while the page is visible.
  function agentWatch(cb) {
    let timer = null;
    const check = async () => {
      clearTimeout(timer);
      const t = tapGet(); if (!t || document.hidden) return;
      let st; try { st = await (await fetch(AGENT_API + agentCode(), { cache: 'no-store' })).json(); } catch (e) { return; }
      const last = st.last ? Date.parse(st.last) : 0;
      if (last) { const o = setGet(); if (last > (o.seen || 0)) { o.seen = last; setPut(o); dispatchEvent(new Event('ap:daily')); } }   // pages re-pick their prompts
      if (!t.back && Date.now() - t.at > 3000 && Date.now() - t.at < 30 * 60e3) { t.back = 1; tapSet(t); ob('back', t.ai); }   // returned from the AI
      if (last > t.at - 5000) {
        if (!t.ok) { t.ok = 1; tapSet(t); const o = setGet(); o[t.ai] = Date.now(); setPut(o); dispatchEvent(new Event('ap:daily')); ob('connected', t.ai); cb('connected', t.ai); }
        else if (Date.now() - last > 48 * 3600e3) { if (!t.stopLog || Date.now() - t.stopLog > 86400e3) { t.stopLog = Date.now(); tapSet(t); ob('stopped', t.ai); } cb('stopped', t.ai); }
      } else if (Date.now() - t.at < 3 * 60e3) timer = setTimeout(check, 4000);
      else if (!t.ok && !t.told) { t.told = 1; tapSet(t); ob('missing', t.ai); cb('missing', t.ai); }
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    addEventListener('pageshow', check);
    check();
    return check;
  }

  window.RiffHabits = {
    profile, tier, source, variant, prompt, hasDaily, agentCode, agentTapped, agentWatch, ob, inapp: INAPP, plat: PLAT,
    gameStart() { today().g++; save(h); },
    gameEnd(seconds) { if (seconds > 0 && seconds < 6 * 3600) { today().s += Math.round(seconds); save(h); } },
    daily(ai) { const t = today(); t.d = 1; if (ai) h.ai = ai; save(h); },
  };
})();
