// Ad-Safe Arcade shell: home screen, player, on-screen controls, fit-to-screen, ads, install prompts.
// Games run unmodified in a same-origin iframe; everything mobile-specific lives here.
(function () {
  const API = 'https://arcade-api-production-bfdf.up.railway.app';
  const EMBED = new URLSearchParams(location.search).get('embed') === 'chat'; // inside ChatGPT/Claude: no ads, no install prompts
  if (EMBED) document.documentElement.classList.add('embed');
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
  const games = () => fetch('games.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => fetch('games.json').then(r => r.json()));
  const cid = (() => { let c = store.get('cid'); if (!c) { c = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now(); store.set('cid', c); } return c; })();
  const api = (p, body) => fetch(API + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true } : {})
    .then(r => r.ok ? r.json() : null).catch(() => null);
  const getStats = () => Promise.race([api('/api/stats'), new Promise(r => setTimeout(() => r(null), 2500))]).then(s => s || {});
  const starsTxt = st => st && st.rating ? `★ ${st.rating.toFixed(1)}` : '';
  // reception elsewhere: real public numbers, always named and linked, never blended into our players' stars
  const kNum = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  const praise = g => {
    const p = g.public || {}, out = [];
    if (p.itch) out.push({ short: `★ ${p.itch.rating.toFixed(1)} on itch.io (${p.itch.count})`, long: `★ ${p.itch.rating.toFixed(1)} from ${p.itch.count} players on itch.io`, url: p.itch.url });
    if (p.hn) out.push({ short: `▲ ${p.hn.points} on Hacker News`, long: `▲ ${p.hn.points} points, ${p.hn.comments} comments on Hacker News (${p.hn.year})`, url: p.hn.url });
    if (p.reddit) out.push({ short: `▲ ${kNum(p.reddit.score)} on r/${p.reddit.sub}`, long: `▲ ${kNum(p.reddit.score)} upvotes, ${p.reddit.comments} comments on r/${p.reddit.sub} (${p.reddit.year})`, url: p.reddit.url });
    if (p.github) out.push({ short: `${kNum(p.github.stars)} GitHub stars`, long: `${kNum(p.github.stars)} stars, ${kNum(p.github.forks)} forks on GitHub`, url: p.github.url });
    return out;
  };
  const quote = g => { const q = (g.public || {}).quote; return q ? `<blockquote class="praise-quote">“${esc(q.text)}”<cite><a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.who)} on ${esc(q.where)}</a></cite></blockquote>` : ''; };
  const praiseList = g => { const l = praise(g); return (l.length ? `<ul class="praise">${l.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.long)}</a></li>`).join('')}</ul>` : '') + quote(g); };

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

  const canPrompt = () => !EMBED && !standalone && !store.get('installed', false) && browser !== 'desktop';
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
    const latest = gs.reduce((m, g) => (g.added > m ? g.added : m), '');
    const fresh = gs.filter(g => g.added === latest).length;
    const cats = [...new Set(gs.map(g => g.category || 'Arcade'))].sort();
    let cat = store.get('cat', null), stats = {};
    if (cat && !cats.includes(cat)) cat = null;
    $('count').textContent = `${gs.length} games · ${fresh} new ${latest === new Date().toISOString().slice(0, 10) ? 'today' : 'on ' + latest}`;
    $('cats').innerHTML = ['All', ...cats].map(c => `<button class="chip" data-c="${esc(c)}" aria-pressed="${(c === 'All' && !cat) || c === cat}">${esc(c)}</button>`).join('');
    $('cats').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c === 'All' ? null : b.dataset.c; store.set('cat', cat); draw(); };
    function draw() {
      $('cats').querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.c === 'All' && !cat) || b.dataset.c === cat)));
      const list = gs.filter(g => !cat || g.category === cat);
      $('grid').innerHTML = list.map(g => {
        const st = stats[g.slug];
        // the cover already carries the name and category; under it go the players' numbers
        const meta = [st && st.rating ? `<span class="star">${starsTxt(st)}</span> (${st.ratings})` : '', st && st.plays ? `${st.plays} plays` : ''].filter(Boolean).join(' · ');
        return `<a class="card" href="play.html?g=${encodeURIComponent(g.slug)}" aria-label="${esc(g.name)}, ${esc(g.category || 'Arcade')}">
        <div class="shot"><img src="${g.cover || g.thumb}" alt="" loading="lazy">${g.added === latest ? '<span class="new">NEW</span>' : ''}${g.controls ? '<span class="badge">TOUCH CONTROLS</span>' : ''}</div>
        <p class="meta">${meta || (praise(g)[0] ? `<span class="ext">${esc(praise(g)[0].short)}</span>` : 'New here, be the first to rate')}</p></a>`;
      }).join('');
    }
    draw();
    getStats().then(s => { stats = s; draw(); });
    const last = gs.find(g => g.slug === store.get('last'));
    if (last) $('cont').innerHTML = `<a class="continue" href="play.html?g=${encodeURIComponent(last.slug)}"><img src="${last.cover || last.thumb}" alt="">
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
    frame.src = g.external || `games/${g.slug}/${g.entry}`;
    frame.className = 'fit';
    stage.appendChild(frame);
    const player = document.querySelector('.player');

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="box"><div class="eyebrow">Ad-Safe Arcade</div><h2>${esc(g.name)}</h2><p>${esc(g.blurb)}</p>${praiseList(g)}
      <div class="loadbar" id="lb"><i></i></div><button class="playbtn" id="go">PLAY</button>
      <div data-install></div>
      <div class="credit"><span id="splashStats"></span>${esc(g.credit)} · ${esc(g.licence)}</div></div>`;
    stage.appendChild(ov);
    renderInstall();
    getStats().then(st => { const x = st[g.slug]; if (x && $('splashStats')) $('splashStats').textContent = [starsTxt(x) && `${starsTxt(x)} (${x.ratings})`, x.plays && `${x.plays} plays`].filter(Boolean).join(' · ') + (x.plays || x.rating ? ' · ' : ''); });

    // ---- fitting. The stage already sits inside the phone's safe area (CSS env(safe-area-inset-*)),
    // so nothing lands under the clock, notch, Dynamic Island or home bar on any model.
    // virtualH: the height the game believes it has. Starts at the real height; auto-fit raises it
    // (= zooms the game out) when part of the game's UI falls outside the screen.
    let virtualH = 0, lastSize = '';
    const MIN_SCALE = 0.5;
    function fit() {
      const W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      if (g.fit) { // fixed-size canvas game: letterbox it
        const s = Math.min(W / g.fit.w, H / g.fit.h);
        frame.style.width = g.fit.w + 'px'; frame.style.height = g.fit.h + 'px';
        frame.style.transform = `translate(${(W - g.fit.w * s) / 2}px, ${(H - g.fit.h * s) / 2}px) scale(${s})`;
        return;
      }
      const size = W + 'x' + H;
      if (size !== lastSize) { lastSize = size; virtualH = Math.max(H, g.minHeight || 0); } // rotation / new screen: start over
      const s = Math.max(MIN_SCALE, Math.min(1, H / virtualH));
      frame.style.width = (W / s) + 'px'; frame.style.height = (H / s) + 'px';
      frame.style.transform = s < 1 ? `scale(${s})` : '';
    }

    // Measures the game's own layout: any visible element that ends below (or right of) the screen and can't be
    // scrolled to means a button the player can't reach. Then zoom out just enough to bring it in.
    function autoFit() {
      if (g.fit) return;
      let doc; try { doc = frame.contentDocument; } catch (e) { return; }
      if (!doc || !doc.body) return;
      const w = frame.contentWindow, vw = w.innerWidth, vh = w.innerHeight;
      const css = el => w.getComputedStyle(el);
      const pageScrolls = !/hidden|clip/.test(css(doc.documentElement).overflowY + css(doc.body).overflowY) && doc.documentElement.scrollHeight > vh + 4;
      // an ancestor (below <body>) that scrolls or clips on that axis means the overflow is by design:
      // a swipeable toolbar, a carousel, a scroll box. Only overflow clipped by the screen itself counts.
      const handledByAncestor = (el, axis) => {
        for (let p = el.parentElement; p && p !== doc.body && p !== doc.documentElement; p = p.parentElement) {
          if (/auto|scroll|hidden|clip/.test(css(p)[axis])) return true;
        }
        return false;
      };
      let needH = vh, needW = vw;
      const els = doc.body.getElementsByTagName('*');
      for (let i = 0; i < els.length && i < 4000; i++) {
        const el = els[i];
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || r.top >= vh || r.left >= vw || r.right <= 0 || r.bottom <= 0) continue;
        const overY = r.bottom > vh + 1 || r.top < -1, overX = r.right > vw + 1;
        if (!overY && !overX) continue;
        const st = css(el);
        if (st.visibility === 'hidden' || st.opacity === '0') continue;
        if (r.height > vh * 3 || r.width > vw * 3) continue;        // a background layer, not UI
        if (overY && !(pageScrolls && st.position !== 'fixed') && !handledByAncestor(el, 'overflowY')) {
          // centred dialogs spill over the top as well as the bottom: they need their full height
          needH = Math.max(needH, vh + Math.max(0, r.bottom - vh) + Math.max(0, -r.top) + 8);
        }
        if (overX && r.left >= -2 && !handledByAncestor(el, 'overflowX')) needW = Math.max(needW, r.right + 6);
      }
      const grow = Math.max(needH / vh, needW / vw);
      if (grow > 1.01) {
        const H = stage.clientHeight;
        virtualH = Math.min(H / MIN_SCALE, virtualH * grow);
        fit();
      }
    }
    let afTimer = 0;
    const scheduleAutoFit = (ms = 350) => { clearTimeout(afTimer); afTimer = setTimeout(autoFit, ms); };

    // the strips around the safe area take the game's background colour so they read as part of the game
    function matchBackground() {
      try {
        const w = frame.contentWindow, d = w.document;
        let c = w.getComputedStyle(d.body).backgroundColor;
        if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') c = w.getComputedStyle(d.documentElement).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
          player.style.background = c;
          document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c);
        }
      } catch (e) {}
    }

    frame.addEventListener('load', () => {
      $('lb').classList.add('done');
      fit(); matchBackground();
      [300, 1200, 3000].forEach(t => setTimeout(autoFit, t));
      try { // menus and dialogs usually open on a tap: re-measure after each one
        const d = frame.contentDocument;
        d.addEventListener('click', () => scheduleAutoFit(), true);
        d.addEventListener('touchend', () => scheduleAutoFit(), true);
        new frame.contentWindow.MutationObserver(() => scheduleAutoFit(600)).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      } catch (e) {}
    });
    addEventListener('resize', () => { fit(); scheduleAutoFit(); });
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

    const goHome = () => adBreak(started, () => { location.href = './'; });
    const leave = () => {
      const rated = store.get('rated', {});
      if (started && Date.now() - started > 30000 && !rated[g.slug]) return rateSheet(g, goHome);
      goHome();
    };
    const credits = () => {
      if ($('sheet')) { $('sheet').remove(); return; }
      const sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'sheet';
      sh.innerHTML = `<h3>${esc(g.name)}</h3><p>By ${esc(g.author)}. ${esc(g.credit)}.</p>
        <p>Licensed under ${esc(g.licence)}. Played here unmodified; the original licence file ships with the game.</p>
        ${praise(g).length ? '<p>Elsewhere:</p>' + praiseList(g) : ''}<p><a href="${esc(g.source)}" target="_blank" rel="noopener">Source code</a></p><button class="btn" id="closeSheet">Close</button>`;
      stage.appendChild(sh);
      $('closeSheet').onclick = () => sh.remove();
    };

    $('go').onclick = async () => {
      const de = document.documentElement;
      if (!standalone && de.requestFullscreen) await de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      if (g.orientation !== 'any' && screen.orientation && screen.orientation.lock) screen.orientation.lock(g.orientation).catch(() => {});
      ov.remove();
      player.classList.add('playing');
      started = Date.now();
      store.set('last', g.slug);
      store.set('plays', store.get('plays', 0) + 1);
      api('/api/play', { slug: g.slug });
      try { frame.contentWindow.focus(); } catch (e) {}
      if (g.controls) controls(g.controls, frame);
      bubble(g, { leave, credits });
      setTimeout(() => { fit(); checkRotate(); autoFit(); }, 250);
    };

    $('info').onclick = credits;
    $('back').onclick = leave;
  }

  // ---------------------------------------------------------------- ratings (real players only)
  function starRow(g) {
    const mine = store.get('rated', {})[g.slug] || 0;
    return `<div class="stars" role="group" aria-label="Rate ${esc(g.name)}">${[1, 2, 3, 4, 5].map(n =>
      `<button data-n="${n}" class="${n <= mine ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>`;
  }
  function wireStars(root, g, after) {
    root.querySelectorAll('.stars button').forEach(b => b.onclick = async () => {
      const n = +b.dataset.n;
      root.querySelectorAll('.stars button').forEach(x => x.classList.toggle('on', +x.dataset.n <= n));
      const rated = store.get('rated', {}); rated[g.slug] = n; store.set('rated', rated);
      api('/api/rate', { slug: g.slug, stars: n, client: cid });
      if (after) setTimeout(after, 450);
    });
  }
  function rateSheet(g, done) {
    const m = document.createElement('div');
    m.className = 'overlay pmenu';
    m.innerHTML = `<div class="box"><div class="eyebrow">Before you go</div><h2>How was ${esc(g.name)}?</h2>${starRow(g)}
      <button class="btn ghost" id="rsSkip">Skip</button></div>`;
    $('stage').appendChild(m);
    wireStars(m, g, done);
    $('rsSkip').onclick = done;
  }

  // ---------------------------------------------------------------- pause bubble
  // One small button instead of a toolbar: drag it to any edge (remembered per game), it fades when idle,
  // and a tap opens the pause menu. Keeps the whole screen for the game on every device.
  function bubble(g, act) {
    const b = document.createElement('button');
    b.className = 'bubble'; b.id = 'bubble'; b.setAttribute('aria-label', 'Pause menu');
    b.innerHTML = '<span></span><span></span>';
    document.body.appendChild(b);
    const pos = store.get('bubble.' + g.slug, { side: 'right', y: 0.42 });
    // env(safe-area-inset-*) only resolves inside real CSS properties, so read it off an invisible probe
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
    const place = () => {
      const r = document.documentElement.getBoundingClientRect();
      const safe = n => parseFloat(getComputedStyle(probe)['padding' + n[0].toUpperCase() + n.slice(1)]) || 0;
      const top = safe('top') + 6, bottom = innerHeight - safe('bottom') - 6 - 44;
      b.style.top = Math.min(bottom, Math.max(top, pos.y * innerHeight)) + 'px';
      b.style.left = pos.side === 'left' ? (safe('left') + 4) + 'px' : (r.width - safe('right') - 4 - 44) + 'px';
    };
    place(); addEventListener('resize', place);
    let fadeT = 0;
    const wake = () => { b.classList.remove('idle'); clearTimeout(fadeT); fadeT = setTimeout(() => b.classList.add('idle'), 2500); };
    wake();
    let drag = null;
    b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false }; wake(); });
    b.addEventListener('pointermove', e => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
      if (drag.moved) { b.classList.add('dragging'); b.style.left = (e.clientX - 22) + 'px'; b.style.top = (e.clientY - 22) + 'px'; }
    });
    b.addEventListener('pointerup', e => {
      if (!drag) return;
      const moved = drag.moved; drag = null; b.classList.remove('dragging');
      if (moved) { pos.side = e.clientX < innerWidth / 2 ? 'left' : 'right'; pos.y = (e.clientY - 22) / innerHeight; store.set('bubble.' + g.slug, pos); place(); wake(); return; }
      menu();
    });
    b.addEventListener('pointercancel', () => { drag = null; b.classList.remove('dragging'); place(); });

    function menu() {
      if ($('pmenu')) { $('pmenu').remove(); return; }
      const m = document.createElement('div');
      m.className = 'overlay pmenu'; m.id = 'pmenu';
      m.innerHTML = `<div class="box"><div class="eyebrow">Paused</div><h2>${esc(g.name)}</h2>
        <button class="btn big" id="pmResume">Resume</button>
        ${EMBED ? '' : '<button class="btn" id="pmHome">Back to the Arcade</button>'}
        ${starRow(g)}
        <div data-install></div>
        <button class="btn ghost" id="pmCredits">Credits · ${esc(g.licence)}</button></div>`;
      $('stage').appendChild(m);
      renderInstall();
      $('pmResume').onclick = () => m.remove();
      if ($('pmHome')) $('pmHome').onclick = () => { m.remove(); act.leave(); };
      wireStars(m, g);
      $('pmCredits').onclick = () => { m.remove(); act.credits(); };
      m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    }
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
    if (EMBED || !started || now - started < AD_MIN_PLAY_MS || now - sget('lastAd') < AD_GAP_MS) return done();
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
