// AGENTPARK performance guard: the first script in every hosted game (qa/perf_fixes.py adds the tag at build time), so a
// heavy game can't freeze a weak PC or phone.
//  1. Caps devicePixelRatio: WebGL games draw screen size × DPR pixels, and 4K / Retina screens at full DPR are what lock
//     up integrated GPUs. Desktop 1.5, touch 2, "lighter graphics" 1 (chosen per game, kept on the device).
//  2. Watches the frame rate: after 8 s, three 2-second windows in a row under 22 fps (page visible) tell the play page once,
//     which offers lighter graphics or another game.
(function () {
  if (window.__apGuard) return; window.__apGuard = 1;
  var real = window.devicePixelRatio || 1;
  var slug = (location.pathname.match(/\/games\/([^/]+)\//) || [])[1] || '';
  var lite = false; try { lite = localStorage.getItem('ap.lite.' + slug) === '1'; } catch (e) {}
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var cap = lite ? 1 : touch ? 2 : 1.5;
  if (real > cap) try { Object.defineProperty(window, 'devicePixelRatio', { get: function () { return cap; }, configurable: true }); } catch (e) {}
  window.__apGuard = { cap: cap, real: real, lite: lite };
  var n = 0, t0 = 0, start = 0, slow = 0, told = false;
  function tick(t) {
    if (!start) start = t;
    n++; if (!t0) t0 = t;
    if (t - t0 >= 2000) {
      var fps = n * 1000 / (t - t0); n = 0; t0 = t;
      if (!document.hidden && t - start > 8000) {
        slow = fps < 22 ? slow + 1 : 0;
        if (slow >= 3 && !told) { told = true; try { parent.postMessage({ agentpark: 'slow', slug: slug, fps: Math.round(fps), lite: lite }, location.origin); } catch (e) {} }
      }
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', function () { t0 = 0; n = 0; slow = 0; });
  requestAnimationFrame(tick);
})();
