// RIFFCADE consent: one banner for everything that needs it (Google Analytics, the Meta pixel, personalised ads).
// Nothing loads until the visitor taps Accept: no gtag.js, no fbevents.js, no cookieless pings. "No thanks" or no answer = off.
// Used by the landing page and the arcade (never the chat versions, /today, privacy, terms or support).
// API (window.RiffConsent): state(), accepted(), ga(name, params), setUser(props), pixel(name, custom), setKids(bool), onChange(fn), open().
(function () {
  if (new URLSearchParams(location.search).get('embed') === 'chat') return;
  const C = window.RIFFCADE || {};
  const KEY = 'arcade.consent';
  const state = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }; // 'accepted' | 'declined' | null
  const save = v => { try { v == null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const parts = [C.GA4_ID && 'analytics (Google Analytics)', C.META_PIXEL_ID && 'ad measurement (Meta)', C.ADS_ENABLED && 'personalised ads'].filter(Boolean);
  const needed = parts.length > 0;
  const listeners = [];
  // the play page waits to learn whether the game is a Kids game (then nothing loads, whatever the choice)
  let kids = null, started = false;
  const waitForKids = /play\.html$/.test(location.pathname);
  const queue = [];

  function start() {
    if (started || state() !== 'accepted' || kids === true || (waitForKids && kids === null)) return;
    started = true;
    if (C.GA4_ID) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      gtag('js', new Date());
      gtag('config', C.GA4_ID, { ref: new URLSearchParams(location.search).get('ref') || undefined, allow_google_signals: false, allow_ad_personalization_signals: false });
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + C.GA4_ID; document.head.appendChild(s);
    }
    if (C.META_PIXEL_ID) {
      /* Meta's standard loader */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', C.META_PIXEL_ID);
      fbq('track', 'PageView');
    }
    queue.splice(0).forEach(f => f());
  }
  // withdrawn: stop sending and drop the cookies they set (the scripts already on this page can't be unloaded)
  function stop() {
    if (window.gtag) gtag('consent', 'update', { analytics_storage: 'denied' });
    if (window.fbq) fbq('consent', 'revoke');
    if (C.GA4_ID) window['ga-disable-' + C.GA4_ID] = true;
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^(_ga|_gid|_gat|_fbp|_fbc)/.test(n))
      .forEach(n => ['', '; domain=.' + location.hostname.replace(/^www\./, ''), '; domain=' + location.hostname].forEach(d => { document.cookie = n + '=; Max-Age=0; path=/' + d; }));
  }

  const css = `.rc-banner{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:2147483000;max-width:520px;margin:0 auto;background:#fff;color:#15171B;border-radius:18px;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.4);display:grid;gap:10px;font:14px/1.4 'Space Grotesk',system-ui,sans-serif}
.rc-banner p{margin:0}.rc-banner a{color:#5a46d6}.rc-banner div{display:flex;gap:8px;justify-content:flex-end}
.rc-banner button{border:0;border-radius:999px;padding:9px 16px;font:700 14px/1 inherit;cursor:pointer}.rc-yes{background:#AC9CFF;color:#0b0e1a}.rc-no{background:transparent;color:#15171B;box-shadow:inset 0 0 0 1px #c9ccd4}`;
  function open() {
    if (!needed || document.getElementById('rcBanner')) return;
    if (!document.getElementById('rcCss')) { const st = document.createElement('style'); st.id = 'rcCss'; st.textContent = css; document.head.appendChild(st); }
    const b = document.createElement('div');
    b.id = 'rcBanner'; b.className = 'rc-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Privacy choices');
    const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    b.innerHTML = `<p>Allow ${list}? They stay off unless you accept. <a href="${location.pathname.includes('/arcade/') ? '' : '/arcade/'}privacy.html">Privacy</a></p>
      <div><button class="rc-no" type="button">No thanks</button><button class="rc-yes" type="button">Accept</button></div>`;
    document.body.appendChild(b);
    const pick = v => {
      const was = state();
      save(v); b.remove();
      if (v === 'accepted') start(); else if (was === 'accepted') stop();
      listeners.forEach(f => { try { f(v); } catch (e) {} });
    };
    b.querySelector('.rc-no').onclick = () => pick('declined');
    b.querySelector('.rc-yes').onclick = () => pick('accepted');
  }

  window.RiffConsent = {
    needed, state, open,
    accepted: () => state() === 'accepted',
    onChange: f => listeners.push(f),
    setKids(v) { kids = !!v; start(); },
    ga(name, params) { if (!C.GA4_ID || state() !== 'accepted' || kids) return; const f = () => window.gtag && gtag('event', name, params || {}); started ? f() : queue.push(f); },
    // an event that must reach GA even though the page is about to change (a game's end). gtag holds events for ~5 s
    // and loses them when the page goes, so this one is sent at once as GA's own collect hit, with the same visitor
    // and session ids (the _ga cookies) via sendBeacon, which survives the page unloading. Same consent gate.
    gaNow(name, params) {
      if (!C.GA4_ID || state() !== 'accepted' || kids || !started) return Promise.resolve();
      const ck = document.cookie;
      const cid = (ck.match(/(?:^|; )_ga=GA\d\.\d\.(\d+\.\d+)/) || [])[1];
      const sid = (ck.match(new RegExp('(?:^|; )_ga_' + C.GA4_ID.slice(2) + '=GS\\d\\.\\d\\.s?(\\d+)')) || [])[1];
      if (!cid || !navigator.sendBeacon) { if (window.gtag) gtag('event', name, params || {}); return Promise.resolve(); }
      const u = new URLSearchParams({ v: '2', tid: C.GA4_ID, cid, en: name, _ee: '1', npa: '1', dl: location.href, dt: document.title, ul: (navigator.language || '').toLowerCase(), sr: screen.width + 'x' + screen.height });
      if (sid) { u.set('sid', sid); u.set('seg', '1'); }
      for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') u.set((typeof v === 'number' ? 'epn.' : 'ep.') + k, String(v));
      navigator.sendBeacon('https://region1.google-analytics.com/g/collect?' + u, '');
      return Promise.resolve();
    },
    // GA user properties (player tier, habits): same gate as events
    setUser(props) { if (!C.GA4_ID || state() !== 'accepted' || kids) return; const f = () => window.gtag && gtag('set', 'user_properties', props); started ? f() : queue.push(f); },
    pixel(name, custom) { if (!C.META_PIXEL_ID || state() !== 'accepted' || kids) return; const f = () => window.fbq && fbq(custom ? 'trackCustom' : 'track', name); started ? f() : queue.push(f); },
  };

  if (!needed) return;
  start();
  const ready = () => {
    if (!state()) open();
    // "Privacy choices" in the footer: change your mind as easily as you chose (arcade .foot, landing footer nav)
    const foot = document.querySelector('.foot, footer nav');
    if (foot && !document.getElementById('rcChoices')) {
      const a = document.createElement('a'); a.id = 'rcChoices'; a.href = '#'; a.textContent = 'Privacy choices';
      if (foot.classList.contains('foot')) { a.style.color = 'var(--accent)'; foot.append(' · '); }
      a.onclick = e => { e.preventDefault(); open(); };
      foot.append(a);
    }
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ready) : ready();
})();
