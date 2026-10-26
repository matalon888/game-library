// Game saves by player id. Every game keeps its levels, stars, coins and albums in localStorage; this keeps a copy on our
// server (arcade-api save.js, /api/save) under the player's random prompt code: habits.js ap.u, or the ?apu= that their
// AI's daily links carry. So progress survives Safari clearing site storage, and a player who opens their AI's link on
// another phone or computer continues at the same level. The code is the only identifier; nothing about the person is sent.
// Loaded by the arcade pages and, through build_arcade (qa/perf_fixes.py), by every hosted game page.
// - Same code as last time: a key changed here since the last sync wins; otherwise the server's newer value comes in.
// - A new code on this device (arriving from someone's AI link): the server's copy wins, keys only here are added to it.
// - A level, best score or star count (by key name), or the level inside a saved bundle, never goes backwards.
// - ap.lv = { slug: highest level reached } from window.__game.level, for the "Level N" line on the arcade's game tiles.
// window.ApSave: { code(), sync(), level(slug) }
(function () {
  if (window.ApSave) return;
  const q = new URLSearchParams(location.search);
  // QA only: ?saveapi=http://127.0.0.1:<port> sends saves to a local server (robots never write to the real one)
  const API = (/^http:\/\/127\.0\.0\.1:\d+$/.test(q.get('saveapi') || '') ? q.get('saveapi') : 'https://mcp.riffcade.com') + '/api/save';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const META = 'ap.save', LV = 'ap.lv', OK = /^[a-z0-9]{10}$/;
  // device and visit details stay on the device: ad click ids, consent, first source, prompt test arm, the code itself
  const SKIP = /^(ap\.(save|u|fbc|ad|src|tap|set|cpaplay|aud|app|tune|lite\.)|arcade\.(consent|pv|cid)|riffcade_link_code|board_client)/;
  const MAX_VALUE = 60 * 1024;

  function code() {
    let u = q.get('apu');
    if (OK.test(u || '')) { ss.set('ap.u', u); if (!OK.test(ls.get('ap.u') || '')) ls.set('ap.u', u); return u; }
    u = ss.get('ap.u'); if (OK.test(u || '')) return u;
    u = ls.get('ap.u'); if (OK.test(u || '')) return u;
    u = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
    ls.set('ap.u', u);
    return u;
  }
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); };
  function snapshot() {
    const o = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !SKIP.test(k) && k.length <= 120 && /^[\w.:\-\/ ]+$/.test(k)) { const v = localStorage.getItem(k); if (v != null && v.length <= MAX_VALUE) o[k] = v; } } } catch (e) {}
    return o;
  }
  const meta = () => { try { return JSON.parse(ls.get(META)) || {}; } catch (e) { return {}; } };
  const PROGRESS = /level|lvl|best|high|score|stars?$|chapter|stage|max/i;   // numbers that only go up (not mute 0/1, volume…)
  // how far a saved value got: a progress number, or the level inside a saved bundle ({ level: 7, stars: … })
  function reach(k, v) {
    if (v == null) return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return PROGRESS.test(k) ? +v : null;
    if (v[0] !== '{') return null;
    try { const o = JSON.parse(v), n = o && (o.level ?? o.lvl ?? o.stage ?? o.chapter); return Number.isFinite(+n) && n !== '' && n !== null ? +n : null; } catch (e) { return null; }
  }

  let busy = null, pulledAny = 0;
  async function sync(opts = {}) {
    if (busy) return busy;
    return busy = (async () => {
      const u = code(), m = meta(), same = m.u === u, h = same ? (m.h || {}) : {};
      if (opts.pushOnly && !same) return false;   // a new code is pulled first, never overwritten from here
      const L = snapshot(), changed = new Set(Object.keys(L).filter(k => h[k] !== hash(L[k])));
      const gone = same ? Object.keys(h).filter(k => !(k in L) && ls.get(k) == null) : [];
      let srv = { t: m.last || 0, keys: {} };
      if (!opts.pushOnly) {
        try { srv = await (await fetch(API + '?u=' + u + '&since=' + (same ? m.last || 0 : 0), { cache: 'no-store' })).json(); } catch (e) { return false; }
        if (!srv || !srv.keys) return false;
      }
      const now = Date.now(), set = {}, del = {};
      for (const [k, [v, t]] of Object.entries(srv.keys)) {
        if (SKIP.test(k)) continue;
        const mine = L[k];
        if (v == null) { if (mine != null && !changed.has(k)) { ls.del(k); delete L[k]; pulledAny++; } continue; }
        if (k === LV) {   // highest level per game: merge both devices' lists
          let x = {}, y = {}; try { x = JSON.parse(mine || '{}'); y = JSON.parse(v); } catch (e) {}
          for (const s in y) if (+y[s] > (+x[s] || 0)) x[s] = +y[s];
          const mv = JSON.stringify(x); if (mv !== mine) { ls.set(k, mv); L[k] = mv; }
          if (mv === v) changed.delete(k); else changed.add(k);
          continue;
        }
        if (mine === v) { changed.delete(k); continue; }
        const a = reach(k, mine), b = reach(k, v);
        if (a != null && b != null && a !== b) {   // levels and best scores never go backwards
          if (b > a) { ls.set(k, v); L[k] = v; changed.delete(k); pulledAny++; } else changed.add(k);
          continue;
        }
        if (mine != null && same && changed.has(k)) continue;   // played here since the last sync: this device wins
        if (ls.set(k, v)) { L[k] = v; changed.delete(k); pulledAny++; }
      }
      for (const k of changed) set[k] = [L[k], now];
      for (const k of gone) del[k] = now;
      if (Object.keys(set).length || Object.keys(del).length) {
        const body = JSON.stringify({ u, set, del });
        let ok = false;
        if (opts.beacon && navigator.sendBeacon && body.length < 60000) ok = navigator.sendBeacon(API, new Blob([body], { type: 'text/plain' }));
        else try {
          const r = await fetch(API, { method: 'POST', keepalive: body.length < 60000, headers: { 'content-type': 'text/plain' }, body });
          ok = r.ok;
          const j = ok ? await r.json() : {};
          for (const [k, v] of Object.entries(j.fix || {})) if (typeof v === 'string' && ls.set(k, v)) { L[k] = v; pulledAny++; }   // a lower level was refused
        } catch (e) {}
        if (!ok) return false;
      }
      const nh = {}; for (const k in L) nh[k] = hash(L[k]);
      ls.set(META, JSON.stringify({ u, last: srv.t || m.last || 0, h: nh }));
      return true;
    })().finally(() => { busy = null; });
  }

  // the highest level reached in this game (hosted game pages: /arcade/games/<slug>/)
  const slug = (location.pathname.match(/\/arcade\/games\/([^/]+)\//) || [])[1] || null;
  const levels = () => { try { return JSON.parse(ls.get(LV)) || {}; } catch (e) { return {}; } };
  function watchLevel() {
    if (!slug) return;
    setInterval(() => {
      let n; try { n = window.__game && +window.__game.level; } catch (e) {}
      if (!Number.isFinite(n) || n < 1 || n > 1e5) return;
      const o = levels(); if ((o[slug] || 0) >= n) return;
      o[slug] = Math.floor(n); ls.set(LV, JSON.stringify(o));
    }, 3000);
  }

  window.ApSave = { code, sync, level: s => levels()[s] || 0 };
  if (q.get('embed') === 'chat' || navigator.webdriver && !q.get('saveapi')) return;   // chat widgets and QA robots never write player saves
  const t0 = Date.now();
  // ApSave.ready: the first pull. The play page waits for it (up to ~1.2 s) before opening the game frame, so the game reads
  // the save on its first load and the reload below is only a fallback (Oct 26: an iPhone came back blank after it)
  (window.ApSave.ready = sync()).then(() => {
    // a game page that started before its save arrived (first visit on this device): reload once so it reads it
    if (slug && pulledAny && Date.now() - t0 < 6000 && !ss.get('ap.save.r.' + slug)) { ss.set('ap.save.r.' + slug, '1'); location.reload(); }
  });
  watchLevel();
  setInterval(() => { if (document.visibilityState === 'visible') sync({ pushOnly: true }); }, 45000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync({ pushOnly: true, beacon: true }); });
  addEventListener('pagehide', () => sync({ pushOnly: true, beacon: true }));
})();
