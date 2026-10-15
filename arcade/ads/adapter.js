// RIFFCADE ad adapter: showBanner(slot), showInterstitial(), showRewarded() -> Promise<{completed:boolean}>.
// Plugs into whatever ad tag ads/singular-config.js wires up; with no tag there, each slot shows a labelled test placeholder.
// The caps live here, outside the tag: 1 interstitial and 1 rewarded per session (sessionStorage), banners only while a
// game is on screen, never inside the chat versions (?embed=chat), and a close button visible within 5 seconds.
(function () {
  if (new URLSearchParams(location.search).get('embed') === 'chat') return;
  const T = window.SINGULAR_ADS || {};
  const CLOSE_MS = 5000;
  const cap = {
    used(k) { try { return sessionStorage.getItem('arcade.ad.' + k) === '1'; } catch (e) { return true; } }, // storage blocked: no ad
    use(k) { try { sessionStorage.setItem('arcade.ad.' + k, '1'); } catch (e) {} },
  };
  let tag = null, count = () => {}, personalised = false;

  const testBox = (label) => `<div class="g-ad-test" role="img" aria-label="Ad, test">Ad, test${label ? ' · ' + label : ''}</div>`;

  function loadTag() {
    if (!T.tagUrl) return Promise.resolve(null);
    if (tag) return tag;
    tag = new Promise(res => {
      const s = document.createElement('script');
      s.async = true; s.src = T.tagUrl;
      s.onload = () => { try { T.init && T.init({ personalised }); } catch (e) {} res(T); };
      s.onerror = () => res(null);
      document.head.appendChild(s);
    });
    return tag;
  }

  // full-screen frame with our own close button: shown (enabled) within CLOSE_MS whatever the tag does
  function fullScreen(label, withCountdown) {
    const o = document.createElement('div');
    o.className = 'g-ad-full'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Advertisement');
    o.innerHTML = `${testBox(label)}<button class="g-ad-x" disabled>${withCountdown ? 'Close in 5' : '×'}</button>`;
    document.body.appendChild(o);
    const x = o.querySelector('.g-ad-x');
    let n = 5;
    const t = setInterval(() => { n--; if (n > 0) { if (withCountdown) x.textContent = 'Close in ' + n; return; } clearInterval(t); x.disabled = false; x.textContent = '× Close'; x.focus(); }, CLOSE_MS / 5);
    return { el: o, x, done: () => { clearInterval(t); o.remove(); } };
  }

  window.RiffAds = {
    init(o) { personalised = !!o.personalised; count = o.count || count; loadTag(); },
    consent(v) { personalised = !!v; try { T.consent && T.consent(personalised); } catch (e) {} },

    // a reserved 320x50 box under the game (grow.js makes the row before the game starts)
    async showBanner(slot) {
      if (!slot) return;
      const t = await loadTag();
      slot.innerHTML = '';
      if (t && t.banner) { try { t.banner(slot, T.slots && T.slots.banner); count('ad_banner'); return; } catch (e) {} }
      slot.innerHTML = testBox('320×50');
      count('ad_banner');
    },

    // one per session, only between games (grow.js calls it when leaving a game, never during one)
    async showInterstitial() {
      if (cap.used('interstitial')) return;
      cap.use('interstitial');
      count('ad_interstitial');
      const t = await loadTag();
      if (t && t.interstitial) {
        // the tag's own ad; if it hasn't closed within 5 s, our close button appears on top of it
        let guard;
        const forced = new Promise(res => { setTimeout(() => { guard = fullScreen('', false); guard.el.firstChild.remove(); guard.el.style.background = 'transparent'; guard.x.disabled = false; guard.x.textContent = '× Close'; guard.x.onclick = res; }, CLOSE_MS); });
        try { await Promise.race([Promise.resolve(t.interstitial(T.slots && T.slots.interstitial)), forced]); } catch (e) {}
        if (guard) guard.done();
        return;
      }
      const f = fullScreen('interstitial', true);
      await new Promise(res => { f.x.onclick = res; addEventListener('keydown', function k(e) { if (e.key === 'Escape' && !f.x.disabled) { removeEventListener('keydown', k); res(); } }); });
      f.done();
    },

    // opt-in only (the player taps "Watch a short ad…"); one per session; reward only on { completed: true }; skipping always possible
    async showRewarded() {
      if (cap.used('rewarded')) return { completed: false };
      cap.use('rewarded');
      const t = await loadTag();
      if (t && t.rewarded) {
        try { const r = await t.rewarded(T.slots && T.slots.rewarded); return { completed: !!(r && r.completed) }; } catch (e) { return { completed: false }; }
      }
      // test placeholder: "Skip" any time, "Finish" (= watched to the end) after 5 s
      const f = fullScreen('rewarded video', false);
      f.x.disabled = false; f.x.textContent = 'Skip';
      const fin = document.createElement('button');
      fin.className = 'btn'; fin.textContent = 'Finish (test: watched to the end)'; fin.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 24px);left:50%;transform:translateX(-50%)';
      fin.disabled = true; setTimeout(() => { fin.disabled = false; }, CLOSE_MS);
      f.el.appendChild(fin);
      const r = await new Promise(res => { f.x.onclick = () => res(false); fin.onclick = () => res(true); });
      f.done();
      return { completed: r };
    },
  };
})();
