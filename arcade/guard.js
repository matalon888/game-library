// AGENTPARK performance guard: the first script in every hosted game (qa/perf_fixes.py adds the tag at build time), so a
// heavy game can't freeze a weak PC or phone.
//  1. Caps devicePixelRatio: WebGL games draw screen size × DPR pixels, and 4K / Retina screens at full DPR are what lock
//     up integrated GPUs. Desktop 1.5, touch 2, lower on slow devices (tiers below).
//  2. Graphics tier per DEVICE (2026-11-01, Daniel: "detect slow phone models and adjust games not to freeze"; Oct 18-31 diag:
//     1 run in 5 under 40 fps, Android 4 GB phones 23% vs 9% on 8 GB, and under-40-fps players come back 3% vs 12%).
//     0 = full, 1 = light (DPR 1.5 / 1.25 desktop, no SMAA), 2 = lightest (DPR 1, shadows redrawn every 3rd frame, no bloom).
//     Start tier = what this device needed last time (localStorage ap.perf, shared by every game on agentpark.co); a device
//     never seen: Android with ≤4 GB → 1 (≤2 GB → 2), Facebook-app iPhone 11 or older (FBDV/iPhone≤12) → 1, else 0.
//     Live: two 2-second windows in a row where 30%+ of frames take over 40 ms (or under 20 fps) → one tier down, at most
//     every 6 s. Regular 33 ms frames (iPhone Low Power Mode, 30 fps games) are a cap, not a struggle: no change.
//     three.js renderers adopt the tier mid-game (kit/three.module.min.js hands each WebGLRenderer to adopt(); kit/cine.js
//     listens with onTier); other engines get it at start through devicePixelRatio. 3 smooth minute-long runs at a tier → the
//     device starts one tier higher next time.
//  3. Still struggling at tier 2 (three windows under 22 fps): tells the play page once, which offers another game.
// Games read __apGuard.lite (tier ≥ 1) for their own LITE switch (it used to read devicePixelRatio > 2.5, which this cap hid).
(function () {
  if (window.__apGuard) return; window.__apGuard = 1;
  var real = window.devicePixelRatio || 1;
  var slug = (location.pathname.match(/\/games\/([^/]+)\//) || [])[1] || '';
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var ua = navigator.userAgent || '', mem = navigator.deviceMemory || 0;
  var P = {}; try { P = JSON.parse(localStorage.getItem('ap.perf') || '{}') || {}; } catch (e) {}
  function save() { try { localStorage.setItem('ap.perf', JSON.stringify(P)); } catch (e) {} }
  var lite = false; try { lite = localStorage.getItem('ap.lite.' + slug) === '1'; } catch (e) {}   // "Smoother graphics" tapped for this game
  function guess() {
    if (/Android/.test(ua) && mem) return mem <= 2 ? 2 : mem <= 4 ? 1 : 0;
    var m = ua.match(/FBDV\/iPhone(\d+),/); if (m && +m[1] <= 12) return 1;
    return 0;
  }
  if (typeof P.t !== 'number') { P.t = guess(); save(); }
  var t0 = P.t;
  var tier = Math.max(lite ? 2 : 0, Math.min(2, t0)), from = tier;
  function cap() { return tier >= 2 ? 1 : tier === 1 ? (touch ? 1.5 : 1.25) : touch ? 2 : 1.5; }
  try { Object.defineProperty(window, 'devicePixelRatio', { get: function () { return Math.min(real, cap()); }, configurable: true }); } catch (e) {}

  var rs = [], subs = [], frame = 0;
  // a three.js WebGLRenderer (patched kit three.module.min.js): its pixel ratio follows the tier, the game's own setPixelRatio
  // calls are capped (never raised: a 128 px thumbnail renderer at 1 stays at 1), at tier 2 shadows redraw every 3rd frame
  function adopt(r) {
    if (!r || r.__apReq) return;
    var sp = r.setPixelRatio.bind(r), rd = r.render.bind(r);
    r.__apReq = r.getPixelRatio();
    r.setPixelRatio = function (v) { r.__apReq = v; sp(Math.min(v, cap())); };
    r.render = function (s, c) { if (tier >= 2 && r.shadowMap.enabled) { r.shadowMap.autoUpdate = false; if (frame % 3 === 0) r.shadowMap.needsUpdate = true; } return rd(s, c); };
    r.__apApply = function () { sp(Math.min(r.__apReq, cap())); if (tier < 2) r.shadowMap.autoUpdate = true; };
    rs.push(r);
  }
  function setTier(n) {
    if (n === tier || n > 2) return; tier = n;
    rs.forEach(function (r) { try { r.__apApply(); } catch (e) {} });
    subs.forEach(function (f) { try { f(tier); } catch (e) {} });
    try { parent.postMessage({ agentpark: 'tier', slug: slug, tier: tier }, location.origin); } catch (e) {}
  }
  var G = window.__apGuard = { real: real, touch: touch, adopt: adopt, onTier: function (f) { subs.push(f); },
    get tier() { return tier; }, get from() { return from; }, get lite() { return tier >= 1; }, get cap() { return cap(); } };

  // frame watch: 2-second windows, visible time only, judged after the first 5 s (loading hitches)
  var n = 0, long = 0, w0 = 0, last = 0, vis = 0, bad = 0, crawl = 0, told = false, coolUntil = 0, sumF = 0, sumL = 0;
  function tick(t) {
    frame++;
    if (last && t - last < 1000) { var d = t - last; n++; vis += d; if (d > 40) long++; }
    last = t; if (!w0) w0 = t;
    if (t - w0 >= 2000) {
      var fps = n * 1000 / (t - w0), jank = n ? long / n : 0; w0 = t;
      if (!document.hidden && vis > 5000 && n > 2) {
        sumF += n; sumL += long;
        bad = jank >= 0.3 || fps < 20 ? bad + 1 : 0;
        crawl = fps < 22 ? crawl + 1 : 0;
        if (bad >= 2 && tier < 2 && t > coolUntil) {
          // only a three.js game (which really changes) or a true crawl moves the device's saved tier
          if (rs.length || fps < 20) { P.t = Math.max(P.t || 0, tier + 1); P.ok = 0; save(); }
          setTier(tier + 1); bad = 0; coolUntil = t + 6000;
        }
        if (crawl >= 3 && tier >= 2 && !told) { told = true; try { parent.postMessage({ agentpark: 'slow', slug: slug, fps: Math.round(fps), lite: true }, location.origin); } catch (e) {} }
      }
      n = 0; long = 0;
    }
    requestAnimationFrame(tick);
  }
  // a smooth minute at a lowered tier counts once per page; three of them → start one tier higher next time
  var counted = false;
  function settle() {
    if (counted || !(P.t > 0) || vis < 60000 || !sumF || sumL / sumF > 0.03 || tier > P.t) return;
    counted = true; P.ok = (P.ok || 0) + 1; if (P.ok >= 3) { P.t--; P.ok = 0; } save();
  }
  document.addEventListener('visibilitychange', function () { last = 0; bad = 0; crawl = 0; if (document.hidden) settle(); });
  addEventListener('pagehide', settle);
  requestAnimationFrame(tick);
})();
