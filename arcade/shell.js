// Ad-Safe Arcade shell: home screen, player, on-screen controls, fit-to-screen, ads, install prompts.
// Games run unmodified in a same-origin iframe; everything mobile-specific lives here.
(function () {
  const AD_MIN_PLAY_MS = 45 * 1000;   // no ad unless they played at least this long
  const AD_GAP_MS = 2 * 60 * 1000;    // and at most one ad per 2 minutes

  const store = {
    get(k, d) { try { const v = localStorage.getItem('arcade.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('arcade.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const sget = k => { try { return +sessionStorage.getItem('arcade.' + k) || 0; } catch (e) { return 0; } };
  const sset = (k, v) => { try { sessionStorage.setItem('arcade.' + k, v); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = id => document.getElementById(id);
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const games = () => fetch('games.json').then(r => r.json());

  // ---------------------------------------------------------------- install prompt
  // Android Chrome: real one-tap install. iPhone: Apple allows no install button, so we point at the exact
  // Share button of the browser they're in and walk them through Add to Home Screen (opens with no browser bars).
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const browser = iOS
    ? (/FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|TikTok|musical_ly/.test(ua) ? 'inapp' : /CriOS/.test(ua) ? 'chrome-ios'
      : /FxiOS|EdgiOS|OPiOS/.test(ua) ? 'other-ios' : 'safari')
    : android ? (/FBAN|FBAV|Instagram|; wv\)/.test(ua) ? 'inapp' : /SamsungBrowser/.test(ua) ? 'samsung' : 'chrome-android') : 'desktop';
  const SHARE = '<svg class="gl" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ADD = '<svg class="gl" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const DOTS = '<b class="glt">⋮</b>';
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; renderInstall(); });
  window.addEventListener('appinstalled', () => { store.set('installed', true); closeSheet(); renderInstall(); });

  const canPrompt = () => !standalone && !store.get('installed', false) && browser !== 'desktop';
  const snoozed = () => Date.now() - store.get('installSnooze', 0) < 3 * 864e5;

  function guide() {
    const step = (n, html) => `<li><span class="n">${n}</span><span>${html}</span></li>`;
    switch (browser) {
      case 'chrome-android':
        if (deferredInstall) return { arrow: null, one: true, steps: '' };
        return { arrow: 'top-right', steps: step(1, `Tap ${DOTS} at the top right`) + step(2, `Tap <b>Add to Home screen</b> or <b>Install app</b>`) };
      case 'samsung':
        return { arrow: 'bottom-right', steps: step(1, 'Tap the menu ≡ at the bottom right') + step(2, 'Tap <b>Add page to</b> → <b>Home screen</b>') };
      case 'chrome-ios':
        return { arrow: 'top-right', steps: step(1, `Tap ${SHARE} <b>Share</b> at the right end of the address bar`) +
          step(2, `Scroll down and tap ${ADD} <b>Add to Home Screen</b>`) + step(3, 'Tap <b>Add</b>, then open <b>Arcade</b> from your home screen') };
      case 'safari':
        return { arrow: 'bottom', steps: step(1, `Tap ${SHARE} <b>Share</b> in the toolbar (on iOS 26 tap <b>⋯</b> first)`) +
          step(2, `Tap ${ADD} <b>Add to Home Screen</b>`) + step(3, 'Keep <b>Open as Web App</b> on and tap <b>Add</b>') };
      case 'other-ios':
        return { arrow: null, steps: step(1, `Open the browser menu and tap ${SHARE} <b>Share</b>`) + step(2, `Tap ${ADD} <b>Add to Home Screen</b>`) };
      default: // in-app browsers (Instagram, Facebook, TikTok…) can't add to the home screen
        return { arrow: 'top-right', inapp: true, steps: step(1, `Tap <b>⋯</b> and choose <b>Open in browser</b>`) + step(2, 'Then come back to this screen to add the Arcade') };
    }
  }

  function closeSheet() { $('installSheet')?.remove(); $('installArrow')?.remove(); }

  function openSheet() {
    closeSheet();
    const gd = guide();
    const sh = document.createElement('div');
    sh.id = 'installSheet'; sh.className = 'isheet' + (gd.arrow === 'bottom' || gd.arrow === 'bottom-right' ? ' top' : '');
    sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Add the Arcade to your home screen');
    sh.innerHTML = `<div class="icard">
      <div class="ihead"><img src="icons/icon-192.png" alt=""><div><b>Play fullscreen</b><p>Add the Arcade to your home screen. It opens like an app: no browser bars, works offline.</p></div></div>
      ${gd.one ? '<button class="btn big" id="doInstall">Install the Arcade</button>' : `<ol class="steps">${gd.steps}</ol>`}
      ${gd.inapp ? '<button class="btn ghost" id="copyLink">Copy link</button>' : ''}
      <button class="btn ghost" id="notNow">Not now</button></div>`;
    document.body.appendChild(sh);
    if (gd.arrow) {
      const a = document.createElement('div');
      a.id = 'installArrow'; a.className = 'iarrow ' + gd.arrow; a.setAttribute('aria-hidden', 'true');
      a.textContent = gd.arrow.startsWith('bottom') ? '↓' : '↑';
      document.body.appendChild(a);
    }
    $('notNow').onclick = () => { store.set('installSnooze', Date.now()); closeSheet(); renderInstall(); };
    if (gd.one) $('doInstall').onclick = async () => {
      deferredInstall.prompt();
      const r = await deferredInstall.userChoice.catch(() => ({}));
      deferredInstall = null; closeSheet();
      if (r.outcome === 'accepted') store.set('installed', true);
      renderInstall();
    };
    if (gd.inapp) $('copyLink').onclick = e => {
      navigator.clipboard?.writeText(location.href).then(() => { e.target.textContent = 'Link copied'; }).catch(() => {});
    };
  }

  // compact entry point on the home screen and the Play screen; full guide opens on first visit
  function renderInstall() {
    document.querySelectorAll('[data-install]').forEach(el => {
      el.innerHTML = canPrompt() ? `<button class="ibtn" data-open-install>${ADD}<span><b>Play fullscreen</b> · add to Home Screen</span></button>` : '';
    });
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-open-install]')) openSheet(); });
  function autoPrompt() { if (canPrompt() && !snoozed() && !store.get('promptedOnce', false)) { store.set('promptedOnce', true); setTimeout(openSheet, 900); } }

  async function home() {
    const gs = await games();
    $('grid').innerHTML = gs.map(g => `<a class="card" href="play.html?g=${encodeURIComponent(g.slug)}">
      <div class="shot"><img src="${g.thumb}" alt="" loading="lazy">${g.controls ? '<span class="badge">TOUCH CONTROLS ADDED</span>' : ''}</div>
      <b>${esc(g.name)}</b><p>${esc(g.blurb)}</p></a>`).join('');
    const last = gs.find(g => g.slug === store.get('last'));
    if (last) $('cont').innerHTML = `<a class="continue" href="play.html?g=${encodeURIComponent(last.slug)}"><img src="${last.thumb}" alt="">
      <div><div class="eyebrow">Continue</div><b>${esc(last.name)}</b></div><span class="go">Play</span></a>`;
    renderInstall();
    autoPrompt();
  }

  // ---------------------------------------------------------------- player
  const KEYS = {
    left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39], up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40],
    ' ': [' ', 'Space', 32], enter: ['Enter', 'Enter', 13], p: ['p', 'KeyP', 80], z: ['z', 'KeyZ', 90], x: ['x', 'KeyX', 88], m: ['m', 'KeyM', 77],
  };

  async function play() {
    const slug = new URLSearchParams(location.search).get('g');
    const g = (await games()).find(x => x.slug === slug);
    if (!g) { location.replace('./'); return; }
    document.title = g.name + ' · Ad-Safe Arcade';
    $('title').textContent = g.name;
    const stage = $('stage');
    let started = 0;

    // game loads behind the tap-to-play screen
    const frame = document.createElement('iframe');
    frame.title = g.name;
    frame.allow = 'autoplay; fullscreen; gamepad';
    frame.src = `games/${g.slug}/${g.entry}`;
    if (g.fit || g.minHeight) frame.className = 'fit';
    if (g.fit) { frame.style.width = g.fit.w + 'px'; frame.style.height = g.fit.h + 'px'; }
    stage.appendChild(frame);

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="box"><div class="eyebrow">Ad-Safe Arcade</div><h2>${esc(g.name)}</h2><p>${esc(g.blurb)}</p>
      <div class="loadbar" id="lb"><i></i></div><button class="playbtn" id="go">PLAY</button>
      <div data-install></div>
      <div class="credit">${esc(g.credit)} · ${esc(g.licence)}</div></div>`;
    stage.appendChild(ov);
    renderInstall();
    frame.addEventListener('load', () => { $('lb').classList.add('done'); fit(); });

    function fit() {
      const W = stage.clientWidth, H = stage.clientHeight;
      if (g.minHeight && !g.fit) {
        // the game was laid out for a taller phone than what's left under the browser bars:
        // give it that height and zoom the whole thing out, so every menu button stays on screen
        const s = Math.min(1, H / g.minHeight);
        frame.style.width = (W / s) + 'px'; frame.style.height = (H / s) + 'px';
        frame.style.transform = `scale(${s})`;
        return;
      }
      if (!g.fit) return;
      const s = Math.min(W / g.fit.w, H / g.fit.h);
      const x = (W - g.fit.w * s) / 2, y = (H - g.fit.h * s) / 2;
      frame.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }
    addEventListener('resize', fit);
    fit();

    function checkRotate() {
      const want = g.orientation, portrait = innerHeight > innerWidth;
      let r = $('rot');
      const wrong = started && ((want === 'landscape' && portrait) || (want === 'portrait' && !portrait && innerWidth > 0 && matchMedia('(pointer: coarse)').matches));
      if (wrong && !r) {
        r = document.createElement('div'); r.className = 'overlay'; r.id = 'rot';
        r.innerHTML = `<div class="box"><div class="rotate" aria-hidden="true">📱</div><h2>Turn your phone</h2><p>${esc(g.name)} plays best in ${want}.</p><button class="btn ghost" id="anyway">Play anyway</button></div>`;
        stage.appendChild(r);
        $('anyway').onclick = () => { g.orientation = 'any'; r.remove(); };
      } else if (!wrong && r) r.remove();
    }
    addEventListener('resize', checkRotate);

    $('go').onclick = async () => {
      const de = document.documentElement;
      if (!standalone && de.requestFullscreen) await de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      if (g.orientation !== 'any' && screen.orientation && screen.orientation.lock) screen.orientation.lock(g.orientation).catch(() => {});
      ov.remove();
      document.querySelector('.player').classList.add('playing');
      started = Date.now();
      store.set('last', g.slug);
      store.set('plays', store.get('plays', 0) + 1);
      try { frame.contentWindow.focus(); } catch (e) {}
      if (g.controls) controls(g.controls, frame);
      setTimeout(() => { fit(); checkRotate(); }, 250);
    };

    // credits sheet
    $('info').onclick = () => {
      if ($('sheet')) { $('sheet').remove(); return; }
      const sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'sheet';
      sh.innerHTML = `<h3>${esc(g.name)}</h3><p>By ${esc(g.author)}. ${esc(g.credit)}.</p>
        <p>Licensed under ${esc(g.licence)}. Played here unmodified; the original licence file ships with the game.</p>
        <p><a href="${esc(g.source)}" target="_blank" rel="noopener">Source code</a></p><button class="btn" id="closeSheet">Close</button>`;
      stage.appendChild(sh);
      $('closeSheet').onclick = () => sh.remove();
    };

    $('back').onclick = () => adBreak(started, () => { location.href = './'; });
  }

  // ---------------------------------------------------------------- on-screen controls
  function controls(cfg, frame) {
    const pad = $('pad');
    const dirs = cfg.dpad || [];
    const label = d => (cfg.labels && cfg.labels[d]) || { left: '◀', right: '▶', up: '▲', down: '▼' }[d];
    pad.innerHTML = `<div class="dpad" id="dpad">${dirs.map(d => `<div class="key k-${d}" data-dir="${d}">${esc(label(d))}</div>`).join('')}</div>
      <div class="ab">${cfg.b ? `<div class="key b" data-key="${esc(cfg.b.key)}">${esc(cfg.b.label)}</div>` : ''}${cfg.a ? `<div class="key a" data-key="${esc(cfg.a.key)}">${esc(cfg.a.label)}</div>` : ''}</div>`;
    pad.classList.add('on');
    dispatchEvent(new Event('resize'));

    // games that poll key state once per frame miss a 20 ms tap, so every press is held at least MIN_HOLD
    const MIN_HOLD = 120, downAt = {};
    const send = (type, name) => {
      if (type === 'keydown') downAt[name] = Date.now();
      else { const left = MIN_HOLD - (Date.now() - (downAt[name] || 0)); if (left > 0) { setTimeout(() => fire(type, name), left); return; } }
      fire(type, name);
    };
    const fire = (type, name) => {
      const k = KEYS[name]; if (!k) return;
      try {
        const w = frame.contentWindow, doc = w.document;
        const ev = new w.KeyboardEvent(type, { key: k[0], code: k[1], bubbles: true, cancelable: true });
        // old games read keyCode/which, which the constructor won't set
        Object.defineProperty(ev, 'keyCode', { get: () => k[2] });
        Object.defineProperty(ev, 'which', { get: () => k[2] });
        (doc.activeElement || doc.body || doc).dispatchEvent(ev);
      } catch (e) {}
      if (type === 'keydown' && navigator.vibrate) navigator.vibrate(8);
    };

    // D-pad: one finger, direction from the angle to the pad centre, so diagonals (turn + thrust) work
    const dp = $('dpad'), held = new Set();
    const setHeld = next => {
      for (const d of held) if (!next.has(d)) { send('keyup', d); dp.querySelector(`[data-dir="${d}"]`).classList.remove('down'); }
      for (const d of next) if (!held.has(d)) { send('keydown', d); dp.querySelector(`[data-dir="${d}"]`).classList.add('down'); }
      held.clear(); next.forEach(d => held.add(d));
    };
    const fromPoint = e => {
      const r = dp.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const out = new Set();
      if (Math.hypot(dx, dy) < 14) return out;
      const a = Math.atan2(dy, dx) * 180 / Math.PI; // 0 = right, 90 = down
      if (a > -67.5 && a < 67.5) out.add('right');
      if (a > 112.5 || a < -112.5) out.add('left');
      if (a < -22.5 && a > -157.5) out.add('up');
      if (a > 22.5 && a < 157.5) out.add('down');
      return new Set([...out].filter(d => dirs.includes(d)));
    };
    dp.addEventListener('pointerdown', e => { e.preventDefault(); dp.setPointerCapture(e.pointerId); setHeld(fromPoint(e)); });
    dp.addEventListener('pointermove', e => { if (dp.hasPointerCapture(e.pointerId)) setHeld(fromPoint(e)); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => dp.addEventListener(t, () => setHeld(new Set())));

    // A / B: own finger each
    pad.querySelectorAll('.ab .key').forEach(b => {
      const down = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (!b.classList.contains('down')) { b.classList.add('down'); send('keydown', b.dataset.key); } };
      const up = () => { if (b.classList.contains('down')) { b.classList.remove('down'); send('keyup', b.dataset.key); } };
      b.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
    });
    pad.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ---------------------------------------------------------------- ads
  // Uses Google's H5 Games Ads (window.adBreak) when the site has it; otherwise shows a labelled placeholder.
  function adBreak(started, done) {
    const now = Date.now();
    if (!started || now - started < AD_MIN_PLAY_MS || now - sget('lastAd') < AD_GAP_MS) return done();
    sset('lastAd', now);
    if (typeof window.adBreak === 'function') {
      window.adBreak({ type: 'next', name: 'exit-game', adBreakDone: done });
      return;
    }
    const ov = document.createElement('div');
    ov.className = 'overlay';
    let n = 5;
    ov.innerHTML = `<div class="ad"><div class="tag">ADVERTISEMENT · PLACEHOLDER</div><div class="creative">Interstitial ad slot</div>
      <button class="btn" id="skip" disabled>Continue in ${n}</button></div>`;
    $('stage').appendChild(ov);
    const t = setInterval(() => {
      n--;
      const b = $('skip');
      if (n > 0) { b.textContent = `Continue in ${n}`; return; }
      clearInterval(t); b.disabled = false; b.textContent = 'Continue'; b.onclick = done;
    }, 1000);
  }

  window.Arcade = { home, play };
})();
