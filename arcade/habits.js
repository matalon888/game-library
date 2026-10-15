// RIFFCADE player habits, kept on the device (localStorage), never with an id: which days they played, how many games and
// minutes, whether they came from their AI's daily task. From that: a tier (weak / okay / strong) for analytics, and the
// daily-prompt variant this browser is shown (the A/B test in config.js PROMPTS, when PROMPT_TEST is on).
// API (window.RiffHabits): profile(), tier(), gameStart(), gameEnd(seconds), daily(ai), source(), variant(), prompt().
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
  function prompt() {
    const v = variant();
    const text = (C.PROMPT_TEST && PROMPTS[v]) || C.DAILY_PROMPT || PROMPTS.a || '';
    return C.PROMPT_TEST ? text.replace(/https:\/\/today\.riffcade\.com\/?(?![?\w])/, 'https://today.riffcade.com/?v=' + v) : text;
  }

  window.RiffHabits = {
    profile, tier, source, variant, prompt,
    gameStart() { today().g++; save(h); },
    gameEnd(seconds) { if (seconds > 0 && seconds < 6 * 3600) { today().s += Math.round(seconds); save(h); } },
    daily(ai) { const t = today(); t.d = 1; if (ai) h.ai = ai; save(h); },
  };
})();
