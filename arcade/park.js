// AGENTPARK home: a living park around the games.
// The residents (AI-made with gpt-image-2, cut out by park/build.py into park/*.webp) walk, skate, juggle, hang off shelves and
// react when tapped. Games come in three modes (Mobile, Desktop, AI token games), each split into practical categories, and every
// game carries a Park score built from Claude's review (depth + polish, 1-10) and, once 3+ players rated it, their stars.
(function () {
  const A = 'park/';
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let K, CAST = {};

  // ---------------------------------------------------------------- the parks: one per practical category
  const ZONES = {
    'Action':          { park: 'Adventure Woods',   scene: 'z-woods',    who: 'cat-binoculars' },
    '3D':              { park: 'Adventure Woods',   scene: 'z-woods',    who: 'robot-map' },
    'Shooters':        { park: 'Adventure Woods',   scene: 'z-woods',    who: 'hedgehog-gamer' },
    'Arcade':          { park: 'Arcade Pier',       scene: 'z-pier',     who: 'octopus-juggle' },
    'Retro':           { park: 'Arcade Pier',       scene: 'z-pier',     who: 'hedgehog-gamer' },
    'Puzzle':          { park: 'Puzzle Garden',     scene: 'z-maze',     who: 'owl-icecream' },
    'Daily puzzles':   { park: 'Puzzle Garden',     scene: 'z-maze',     who: 'panda-yoga' },
    'Racing':          { park: 'Speedway',          scene: 'z-speedway', who: 'snail-race' },
    'Endless runners': { park: 'Speedway',          scene: 'z-speedway', who: 'hamster-run' },
    'Sports':          { park: 'Sports Field',      scene: 'z-sports',   who: 'raccoon-padel' },
    '2-Player':        { park: 'Sports Field',      scene: 'z-sports',   who: 'fox-kick' },
    'Strategy':        { park: 'Chess Plaza',       scene: 'z-chess',    who: 'tortoise-ref' },
    'Cards':           { park: 'Chess Plaza',       scene: 'z-chess',    who: 'owl-icecream' },
    'Hyper-casual':    { park: 'Bounce Playground', scene: 'z-bounce',   who: 'robot-dunk' },
    'Word & Math':     { park: 'Library Grove',     scene: 'z-library',  who: 'owl-icecream' },
    'Kids':            { park: 'Kids Meadow',       scene: 'z-meadow',   who: 'duck-net' },
    'Casino':          { park: 'Carnival Boardwalk', scene: 'z-carnival', who: 'hippo-cheer' },
    'Idle':            { park: 'Picnic Hill',       scene: 'z-picnic',   who: 'sloth-hang' },
    'Makeover':        { park: 'Style Studio',      scene: 'z-studio',   who: 'bunny-scooter' },
    'AI':              { park: 'Agent Lab',         scene: 'z-lab',      who: 'agent-token' },
    'Classics':        { park: 'Chess Plaza',       scene: 'z-chess',    who: 'tortoise-ref' },
    "What's Hot":      { park: 'Carnival Boardwalk', scene: 'z-carnival', who: 'dog-trophy' },
    'Epic games':      { park: 'Speedway',          scene: 'z-speedway', who: 'robot-dunk' },
    'Cozy games':      { park: 'Style Studio',      scene: 'z-studio',   who: 'bunny-scooter' },
    'Kawaii Pop':      { park: 'Style Studio',      scene: 'z-studio',   who: 'blob-frisbee' },
    'Storybook Garden': { park: 'Picnic Hill',      scene: 'z-picnic',   who: 'sloth-hang' },
  };
  const zone = c => ZONES[c] || ZONES.Arcade;
  const COLLS = ['Cozy games', 'Kawaii Pop', 'Storybook Garden', "What's Hot", 'Epic games', 'Classics', 'Hyper-casual', 'Endless runners', 'Daily puzzles', 'Shooters'];   // tag-based categories, next to the genres
  const isAI = g => (g.tags || []).includes('Connect your AI');
  const MODES = {
    mobile:  { label: 'Mobile',         who: 'axolotl-phone',  sub: 'Touch games · phone or computer', has: g => !isAI(g) && !K.isDesk(g) },
    desktop: { label: 'Desktop',        who: 'hedgehog-gamer', sub: 'Keyboard & mouse games',          has: g => !isAI(g) && K.isDesk(g) },
    ai:      { label: 'AI token games', who: 'agent-token',    sub: 'Powered by your AI agents',       has: g => isAI(g) },
  };

  // things the residents say when tapped (one random line each time)
  const LINES = {
    'fox-kick': ['Football with a padel racket is a real sport now. I checked.', 'Pass it back! PASS IT BACK!'],
    'raccoon-padel': ['Off the glass. Every. Single. Time.', 'I booked the 7 am court. Again.'],
    'robot-dunk': ['I computed the dunk. Then I just jumped.', 'Hyper-casual, hyper-me.'],
    'frog-skate': ['No brakes. Only vibes.', 'Ribbit. Kickflip. Ribbit.'],
    'bunny-scooter': ['Late for my makeover appointment!', 'Beep beep, coming through!'],
    'bear-kite': ['The kite is winning. Again.', 'Higher! HIGHER!'],
    'cat-binoculars': ['I spotted a new game behind that tree.', 'Exploring. Do not disturb.'],
    'octopus-juggle': ['Eight arms and I still need focus.', 'Don\'t talk to me, I\'m on ball three.'],
    'penguin-skates': ['I am fine. This is fine. WHOA.', 'Who put wheels on my feet?'],
    'blob-frisbee': ['Mine! MINE!', 'I am 90% jelly and 10% catch.'],
    'duck-net': ['Shh. I\'m catching high scores.', 'Hunting bugs. The game kind.'],
    'hamster-run': ['Endless runner? Story of my life.', 'One more run. One more. One more.'],
    'robot-map': ['The map says: games everywhere.', 'You are here. Fun is there.'],
    'owl-icecream': ['Puzzle solved. Ice cream earned.', 'Hoo has a daily streak? I do.'],
    'dog-trophy': ['First place! (In my heart.)', 'I\'m not crying, you\'re crying.'],
    'panda-yoga': ['Inhale. Daily puzzle. Exhale.', 'I see your score. Namaste.'],
    'sloth-hang': ['Idle games are my cardio.', 'Taking… my… time…'],
    'giraffe-peek': ['Hi! I can see every shelf from here.', 'Psst. The best one is down there.'],
    'snail-race': ['Racing season. I\'m on lap one of one.', 'Slow is smooth. Smooth is… still slow.'],
    'hedgehog-gamer': ['Keyboard warrior. Literally.', 'One sec, boss fight.'],
    'axolotl-phone': ['Just one level before bed.', 'It works great on the phone!'],
    'agent-token': ['Your agents do the work. You get the coins.', 'Every task your AI ships is a point here.'],
    'tortoise-ref': ['That was offside. Probably.', 'Strategy! Patience! Whistle!'],
    'hippo-cheer': ['Free chips, fair odds, big cheers!', 'Go go go!'],
    'kid-agent-laptop': ['It compiled! Point for us!', 'My agent shipped. Time to play.'],
  };

  // ---------------------------------------------------------------- score
  // Park score: Claude's review (depth + polish, each 1-10) averaged; with 3+ player ratings, 60/40 review/players (★ x 2).
  function score(g, st) {
    const r = g.review; let s = r ? (r.depth + r.polish) / 2 : null;
    if (st && st.ratings >= 3 && st.rating) s = s == null ? st.rating * 2 : s * 0.6 + st.rating * 2 * 0.4;
    return s == null ? null : Math.round(s * 10) / 10;
  }
  const band = s => s >= 8 ? 'hi' : s >= 6.5 ? 'mid' : 'lo';
  const scoreWhy = (g, st) => {
    const r = g.review, p = [];
    if (r) p.push(`Claude's review: depth ${r.depth}/10, polish ${r.polish}/10`);
    if (st && st.ratings) p.push(`players ★${st.rating.toFixed(1)} (${st.ratings})`);
    return p.join(' · ');
  };

  // ---------------------------------------------------------------- actors
  // One rAF loop moves every actor whose stage is on screen. Images face right; scaleX(-1) turns them around.
  const actors = new Set(), live = new WeakSet();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? live.add(e.target) : live.delete(e.target)), { rootMargin: '80px' }) : null;
  const img = n => `<img src="${A}${n}.webp" alt="" draggable="false" decoding="async">`;
  function actor(stage, name, o = {}) {
    if (!CAST[name]) return null;
    const [w, h] = CAST[name];
    const el = document.createElement('div');
    el.className = 'act ' + (o.kind || 'idle') + (o.cls ? ' ' + o.cls : '');
    let H = o.h || 110;
    if (o.maxw && H * w / h > o.maxw) H = o.maxw * h / w;
    el.style.width = (H * w / h) + 'px'; el.style.height = H + 'px';
    el.innerHTML = (o.shadow === false ? '' : '<i class="shade"></i>') + `<div class="body">${img(name)}</div>`;
    el.setAttribute('role', 'button'); el.setAttribute('aria-label', name.split('-')[0] + ', tap to say hi'); el.tabIndex = -1;
    stage.appendChild(el);
    if (!stage._seen && io) { stage._seen = 1; io.observe(stage); }
    const a = { el, body: el.querySelector('.body'), stage, name, kind: o.kind || 'idle', x: o.x ?? 0, y: o.y ?? 0, dir: o.dir || 1,
      speed: o.speed || 40, bob: o.bob ?? 6, freq: o.freq || 7, tilt: o.tilt ?? 3, t0: Math.random() * 10, pause: 0, jump: 0,
      wrap: o.wrap, flip: o.flip, H, w: H * w / h, home: o.x ?? 0, range: o.range || 0 };
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); poke(a); });
    actors.add(a); place(a, 0);
    return a;
  }
  function place(a, t) {
    const sw = a.stage.clientWidth;
    let bx = 0, by = 0, rot = 0, sx = 1, sy = 1;
    const tt = t + a.t0;
    if (a.kind === 'walk') {
      const s = Math.abs(Math.sin(tt * a.freq / 2));
      by = -s * a.bob; rot = Math.sin(tt * a.freq / 2) * a.tilt;
      if (a.pause > 0) { by = 0; rot = 0; }
    } else if (a.kind === 'glide') { rot = Math.sin(tt * 1.3) * a.tilt; by = Math.sin(tt * 2.1) * 2; }
    else if (a.kind === 'idle') { sy = 1 + Math.sin(tt * 2.2) * 0.025; sx = 1 - Math.sin(tt * 2.2) * 0.015; }
    else if (a.kind === 'hang') { rot = Math.sin(tt * 1.2) * 7; }
    else if (a.kind === 'float') { bx = Math.sin(tt * 0.7) * 10; by = Math.sin(tt * 1.1) * 9; rot = Math.sin(tt * 0.9) * 5; }
    else if (a.kind === 'peek') { const c = (Math.sin(tt * 0.6) + 1) / 2; by = (1 - Math.min(1, c * 1.6)) * a.H * 0.75; }
    if (a.jump > 0) { const j = Math.sin(a.jump * Math.PI); by -= j * a.H * 0.35; sy *= 1 + j * 0.06; sx *= 1 - j * 0.04; }
    const face = (a.flip ? -1 : 1) * (a.kind === 'walk' || a.kind === 'glide' ? a.dir : 1);
    a.el.style.transform = `translate3d(${a.x}px, ${a.y}px, 0)`;
    a.body.style.transform = `translate(${bx}px, ${by}px) rotate(${rot}deg) scale(${face * sx}, ${sy})`;
    if (a.kind === 'walk' || a.kind === 'glide') a.el.style.setProperty('--lift', Math.min(1, -by / 30).toFixed(2));
    if (sw && a.x > sw + 40 && !a.wrap) a.x = sw - a.w;   // stage shrank (rotation)
  }
  function poke(a) {
    a.jump = 0.001; a.pause = Math.max(a.pause, 2.2);
    const L = LINES[a.name]; if (!L) return;
    a.stage.querySelectorAll('.say').forEach(s => s.remove());
    const s = document.createElement('div');
    s.className = 'say'; s.textContent = L[Math.floor(Math.random() * L.length)];
    const sw = a.stage.clientWidth, cx = a.x + a.w / 2;
    s.style.left = Math.max(8, Math.min(sw - 228, cx - 110)) + 'px';
    s.style.top = Math.max(4, a.y - 64) + 'px';
    s.style.setProperty('--tail', Math.max(16, Math.min(204, cx - Math.max(8, Math.min(sw - 228, cx - 110)))) + 'px');
    a.stage.appendChild(s);
    setTimeout(() => s.classList.add('out'), 2600); setTimeout(() => s.remove(), 3000);
  }
  let last = 0;
  function loop(now) {
    const t = now / 1000, dt = Math.min(0.05, last ? t - last : 0); last = t;
    for (const a of actors) {
      if (!a.el.isConnected) { actors.delete(a); continue; }
      if (io && !live.has(a.stage)) continue;
      if (a.jump > 0) { a.jump += dt * 1.8; if (a.jump >= 1) a.jump = 0; }
      if (a.kind === 'walk' || a.kind === 'glide') {
        const sw = a.stage.clientWidth;
        if (a.pause > 0) a.pause -= dt;
        else {
          a.x += a.dir * a.speed * dt;
          if (a.range) { if (a.x > a.home + a.range) a.dir = -1; if (a.x < a.home) a.dir = 1; }
          else if (a.wrap) { if (a.dir > 0 && a.x > sw + 20) a.x = -a.w - 20; if (a.dir < 0 && a.x < -a.w - 20) a.x = sw + 20; }
          else { if (a.x > sw - a.w) { a.x = sw - a.w; a.dir = -1; } if (a.x < 0) { a.x = 0; a.dir = 1; } }
          if (Math.random() < dt * 0.06) { a.pause = 1.2 + Math.random() * 2; if (Math.random() < 0.5) a.jump = 0.001; }
        }
      } else if (a.kind === 'idle' && Math.random() < dt * 0.05) a.jump = 0.001;
      place(a, t);
    }
    for (const f of flights) f(t, dt);
    requestAnimationFrame(loop);
  }
  const flights = [];

  // fox kicks the ball, raccoon smashes it back with a padel racket: footpadel, the park's own sport
  function rally(stage, left, right, h) {
    if (!CAST['p-soccer']) return;
    const ball = document.createElement('div'); ball.className = 'ball'; ball.innerHTML = img('p-soccer');
    const bs = Math.round(h * 0.28); ball.style.width = ball.style.height = bs + 'px';
    stage.appendChild(ball);
    let p = 0, dir = 1, wait = 0;
    flights.push((t, dt) => {
      if (io && !live.has(stage)) return;
      if (wait > 0) { wait -= dt; } else { p += dt * 0.55; }
      if (p >= 1) { p = 1; wait = 0.5; dir *= -1; p = 0; (dir > 0 ? left : right).jump = 0.001; }
      const x0 = left.x + left.w * 0.85, x1 = right.x + right.w * 0.1, y0 = left.y + h * 0.62;
      const [a, b] = dir > 0 ? [x0, x1] : [x1, x0];
      const x = a + (b - a) * p, y = y0 - Math.sin(p * Math.PI) * h * 1.1;
      ball.style.transform = `translate3d(${x - bs / 2}px, ${y}px, 0) rotate(${t * 520 * dir}deg)`;
    });
  }

  // ---------------------------------------------------------------- markup helpers
  const esc = s => K.esc(s);
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
  const scoreChip = (g, st) => { const s = score(g, st); return s == null ? '' : `<span class="sc ${band(s)}" title="Park score ${s.toFixed(1)} · ${esc(scoreWhy(g, st))}"><i></i>${s.toFixed(1)}</span>`; };
  const dd = g => !K.PC && K.isDesk(g) ? ` data-desk="${esc(g.slug)}"` : '';
  let LATEST = '';
  const fresh = g => g.added === LATEST;   // only the newest batch wears the NEW sticker
  function card(g, st, big) {
    const r = st && st.rating && st.ratings ? ` · <span class="star">★ ${st.rating.toFixed(1)}</span>` : '';
    return `<a class="gc${big ? ' big' : ''}" href="${K.href(g)}"${K.tgt(g)}${dd(g)} data-slug="${esc(g.slug)}">
      <div class="art"><img src="${esc(K.art(g))}" alt="" loading="lazy">${g.clip ? `<video muted loop playsinline preload="none" data-src="${esc(g.clip)}"></video>` : ''}
        ${scoreChip(g, st)}${fresh(g) ? '<span class="tagnew">NEW</span>' : ''}<span class="go">${PLAY}</span></div>
      <b>${esc(g.name)}</b><span class="meta">${esc(g.category || 'Arcade')}${r}</span>${big ? `<p>${esc(g.blurb || '')}</p>` : ''}</a>`;
  }
  function row(g, i, st) {
    const s = score(g, st);
    return `<a class="rk" href="${K.href(g)}"${K.tgt(g)}${dd(g)}><span class="n">${i + 1}</span><img src="${esc(K.art(g))}" alt="" loading="lazy">
      <div><b>${esc(g.name)}</b><p>${esc(g.blurb || '')}</p><span class="why">${esc(scoreWhy(g, st))}</span></div>
      ${s == null ? '' : `<span class="big-sc ${band(s)}"><b>${s.toFixed(1)}</b><i style="--v:${s * 10}%"></i></span>`}</a>`;
  }

  // [data-who="a,b"] stages anywhere on the page get their residents (data-opt = actor options)
  function residents(root) {
    root.querySelectorAll('[data-who]').forEach(st => {
      const o = JSON.parse(st.dataset.opt || '{}'), names = st.dataset.who.split(',');
      names.forEach((n, i) => {
        const sw = st.clientWidth || 300, moving = o.kind === 'walk' || o.kind === 'glide';
        const a = actor(st, n, { ...o, x: 0, dir: i % 2 ? -1 : 1, speed: (o.speed || 36) * (0.8 + Math.random() * 0.5) });
        if (!a) return;
        a.x = a.home = moving ? (sw * (0.15 + i * 0.45)) % Math.max(1, sw - a.w) : names.length > 1 ? (sw / names.length) * (i + 0.5) - a.w / 2 : sw - a.w;
        a.y = o.y ?? st.clientHeight - a.H - 2;
        place(a, 0);
      });
    });
  }

  // ---------------------------------------------------------------- home
  async function home() {
    K = window.Arcade.kit;
    const [all, cast] = await Promise.all([K.games(), fetch(A + 'cast.json').then(r => r.json()).catch(() => ({}))]);
    CAST = cast;
    let stats = {};
    const byScore = l => l.slice().sort((a, b) => (score(b, stats[b.slug]) ?? 0) - (score(a, stats[a.slug]) ?? 0));
    // every shelf in this player's order (taste.js): Park score + how much they'll probably like it, learnt from every game they
    // play (stayed long: its category, collections and kind rise; left in seconds: they sink). A new visitor sees best scored first.
    const T = window.ApTaste, warm = !!(T && T.warm());
    const ordered = l => warm ? T.rank(byScore(l), g => score(g, stats[g.slug]) ?? 5) : byScore(l);
    const catLike = (l, c) => { if (!warm) return 0; const top = ordered(l.filter(g => catOf(g, c))).slice(0, 6); return top.reduce((n, g) => n + T.like(g), 0) / (top.length || 1); };
    const MORE = 24, SHELVES = 6;   // not a wall of 300 games: the best two dozen of a shelf, six shelves; more arrive as they scroll (no buttons)
    let mode = K.store.get('pmode', null); if (!MODES[mode]) mode = 'mobile';
    let cat = K.store.get('pcat', null), sort = warm ? 'for' : 'score', q = '', open = false, more = MORE;
    const inMode = m => all.filter(MODES[m].has);
    const catOf = (g, c) => COLLS.includes(c) ? (g.tags || []).includes(c) : (g.category || 'Arcade') === c;
    const catsFor = m => {
      const l = inMode(m), n = {};
      l.forEach(g => { n[g.category || 'Arcade'] = (n[g.category || 'Arcade'] || 0) + 1; (g.tags || []).forEach(t => COLLS.includes(t) && (n[t] = (n[t] || 0) + 1)); });
      const e = Object.entries(n).filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1]);
      if (!warm) return e;
      const lk = Object.fromEntries(e.map(([c]) => [c, catLike(l, c)]));
      return e.sort((a, b) => lk[b[0]] - lk[a[0]] || b[1] - a[1]);   // their favourite corners first
    };
    // Ad / share deep link: /arcade/?cat=Puzzle opens that shelf, in the first mode that has it (phones first).
    const qc = new URLSearchParams(location.search).get('cat');
    if (qc) { const m = ['mobile', ...Object.keys(MODES)].find(k => k !== 'ai' && catsFor(k).some(([c]) => c === qc)); if (m) { mode = m; cat = qc; } }
    // From an ad: straight into the best-scored phone game of that shelf (or of the whole park), once per tab. Visitors who
    // landed on a list from an ad almost never picked a game (diagnostics, Oct 16); Back from the game shows the shelf.
    // Picks: our own one-thumb, held-upright games that start on a tap (ad visitors in the Facebook app left landscape and heavy
    // 3D games at "Turn your phone", and hard puzzles without a tap, Oct 16). One at random from the shelf's list, so the
    // reports show which keeps people; shelves without a list use the best-scored upright game. play.html then starts it on its own.
    if (window.ApAttrib && ApAttrib.fromAd() && !sessionStorage.getItem('ap.jumped')) {
      // (games that wait for the first move: runners like neon-hop / squish-gate lose a life before a newcomer has tapped)
      const AD_PICK = { '': ((window.RIFFCADE || {}).OPENERS || []).length ? RIFFCADE.OPENERS : ['stretch-dash', 'swirl-tee', 'tiptoe-tower'], '3D': ['cube-trek', 'bolt-twist'],
        Action: ['stretch-dash', 'ricochet-rex', 'fort-fling'], Racing: ['tiptoe-tower', 'marble-dash'], Arcade: ['cube-trek', 'ricochet-rex', 'bolt-twist'],
        Puzzle: ['bolt-twist', 'untwine', 'swirl-tee'], Strategy: ['turf-rush'], Idle: ['viral-den', 'bellhop-boss'], 'Word & Math': ['think-twice'] };
      const ok = g => g && !g.linkout && g.orientation !== 'landscape' && g.category !== 'Kids' && !(g.tags || []).includes('Kids');
      const mob = inMode('mobile'), listed = (AD_PICK[qc || ''] || []).map(s => mob.find(g => g.slug === s)).filter(ok);
      const pool = mob.filter(g => ok(g) && (!qc || catOf(g, qc)));
      const pick = listed.length ? listed[Math.floor(Math.random() * listed.length)] : byScore(pool.length ? pool : mob.filter(ok))[0];
      if (pick) {
        try { sessionStorage.setItem('ap.jumped', '1'); sessionStorage.setItem('ap.auto', pick.slug); if (!qc) sessionStorage.setItem('ap.aiAd', '1'); } catch (e) {}
        // the store test (2026-10-19): half the ad tabs get a choice of 6 games (pick.html, this shelf first), half the one game
        const ab = (() => { let v; try { v = sessionStorage.getItem('ap.ab'); if (!v) { v = Math.random() < 0.5 ? 'pick' : 'game'; sessionStorage.setItem('ap.ab', v); } } catch (e) { v = 'game'; } return v; })();
        location.replace(ab === 'pick' ? 'pick.html' + (qc ? '?cat=' + encodeURIComponent(qc) : '') : K.href(pick)); return;
      }
    }
    const latest = LATEST = all.reduce((m, g) => (g.added > m ? g.added : m), '');
    $('count').textContent = `${all.length} games · ${all.filter(g => g.added === latest).length} new ${latest === new Date().toISOString().slice(0, 10) ? 'today' : 'on ' + latest}`;
    if ($('heroN')) $('heroN').textContent = all.length;

    world();
    const tabs = () => {
      $('modes').innerHTML = Object.entries(MODES).map(([k, m]) => `<button class="mode${k === 'ai' ? ' ai' : ''}" data-m="${k}" aria-pressed="${k === mode}">
        <span class="mimg">${CAST[m.who] ? img(m.who) : ''}</span><span class="mt"><b>${m.label}</b><small>${inMode(k).length} games · ${m.sub}</small></span></button>`).join('');
    };
    const chips = () => {
      const cs = mode === 'ai' ? [] : catsFor(mode);
      $('cats').innerHTML = cs.length ? [['All', inMode(mode).length], ...cs].map(([c, n]) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === 'All' ? !cat : c === cat}">
        ${c !== 'All' && CAST[zone(c).scene] ? `<img src="${A}${zone(c).scene}-s.webp" alt="">` : ''}${esc(c)}<small>${n}</small></button>`).join('') : '';
      $('cats').hidden = !cs.length;
    };
    tabs(); chips();

    $('modes').onclick = e => { const b = e.target.closest('.mode'); if (!b) return; mode = b.dataset.m; cat = null; K.store.set('pmode', mode); K.store.set('pcat', null); tabs(); chips(); draw(); };
    $('cats').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c === 'All' ? null : b.dataset.c; more = MORE; K.store.set('pcat', cat); chips(); draw(); $('nav').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    document.addEventListener('click', e => {
      const z = e.target.closest('[data-zone]'); if (z) { e.preventDefault(); cat = z.dataset.zone; more = MORE; K.store.set('pcat', cat); chips(); draw(); $('nav').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
      const s = e.target.closest('[data-sort]'); if (s) { sort = s.dataset.sort; draw(); }
      // a card tapped: a small vote for its kind of game, and against the few shown before it that were passed over
      const c = T && e.target.closest('.gc[data-slug]');
      if (c) { const g = all.find(x => x.slug === c.dataset.slug), box = c.parentElement;
        const before = box ? [...box.querySelectorAll('.gc[data-slug]')].slice(0, [...box.children].indexOf(c)).map(x => all.find(y => y.slug === x.dataset.slug)).filter(Boolean) : [];
        try { T.tap(g, before.slice(-6)); } catch (er) {} }
    });
    $('q').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };

    const pathStrip = whos => `<div class="path" data-who="${whos}" data-opt='{"kind":"walk","h":74,"wrap":true,"speed":46}'></div>`;
    const shelf = (title, park, list, key, who, ix) => list.length ? `<section class="shelf">
        <header><div class="sh-t">${CAST[zone(key).scene] ? `<img class="zthumb" src="${A}${zone(key).scene}-s.webp" alt="">` : ''}<div><h2>${esc(title)}</h2><span>${esc(park)} · ${list.length} games</span></div></div>
          <a href="#" data-zone="${esc(key)}">See all</a>
          <div class="perch ${who === 'sloth-hang' ? 'hang' : ''}" data-who="${who}" data-opt='${who === 'sloth-hang' ? '{"kind":"hang","h":110,"y":0,"shadow":false}' : '{"kind":"idle","h":84,"maxw":96}'}'></div></header>
        <div class="rail">${list.slice(0, warm ? 12 : 16).map(g => card(g, stats[g.slug])).join('')}</div></section>` : '';

    // 🏆 World boards: today's leaders across every game with a board (real, checked scores only: arcade-api /api/world)
    const slugOf = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const byFolder = {}; all.forEach(g => { if (g.original) byFolder[slugOf(g.name.split(':')[0])] = g; });
    const flag = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(x => 0x1F1A5 + x.charCodeAt(0))) : '🏳️';
    const boardHref = g => K.href(g) + '&board=1';
    let WB = null, wbAsked = false;
    function worldBoards() {
      const el = $('worldb'); if (!el) return;
      if (!WB) { if (!wbAsked) { wbAsked = true; fetch('https://mcp.riffcade.com/api/world').then(r => r.json()).then(v => { WB = v; worldBoards(); }).catch(() => {}); } return; }
      const boards = WB.boards.filter(b => byFolder[b.game]).slice(0, 16);
      const tryG = ['kingmoat', 'quadrop', 'silkline', 'slinko', 'sapperly', 'hoopwing', 'petalword', 'doubloom'].map(f => byFolder[f]).filter(Boolean);
      const bcard = b => { const g = byFolder[b.game]; return `<a class="wbc" href="${esc(boardHref(g))}"${K.tgt(g)}><img src="${esc(K.art(g))}" alt="" loading="lazy">
        <span class="wbt"><b>${esc(g.name.split(':')[0])}</b><small>${b.players} ${b.players === 1 ? 'player' : 'players'} today</small>
        <span class="wbl">🥇 ${flag(b.top.country)} ${esc(b.top.name)} · ${b.top.score.toLocaleString()}</span></span></a>`; };
      el.innerHTML = `<header><h2>🏆 World boards</h2><span>Every game has one: today, this week, all time, by country. Unrigged: the same rules for everyone.</span></header>
        ${WB.players ? `<div class="wbstats"><span><b>${WB.players.toLocaleString()}</b> players today</span><span><b>${WB.games}</b> boards in play</span></div>
          <div class="wbrow">${WB.countries.length ? `<div class="wbbox"><h3>Countries</h3><small>by #1 spots today</small><ol>${WB.countries.slice(0, 5).map(c => `<li><span>${flag(c.country)} ${esc(c.country)}</span><b>${c.firsts} 🥇</b><em>${c.players} playing</em></li>`).join('')}</ol></div>` : ''}
            ${WB.champs.length ? `<div class="wbbox"><h3>Champions</h3><small>most #1 spots today</small><ol>${WB.champs.slice(0, 5).map(c => `<li><span>${flag(c.country)} ${esc(c.name)}</span><b>${c.firsts} 🥇</b><em>${c.games} ${c.games === 1 ? 'game' : 'games'}</em></li>`).join('')}</ol></div>` : ''}</div>
          <div class="rail">${boards.map(bcard).join('')}</div>`
        : `<p class="wbempty">Nobody is on today's boards yet. Play any game and you're #1 in the world until someone beats you.</p>
          <div class="rail">${tryG.map(g => `<a class="wbc" href="${esc(boardHref(g))}"${K.tgt(g)}><img src="${esc(K.art(g))}" alt="" loading="lazy"><span class="wbt"><b>${esc(g.name.split(':')[0])}</b><small>Empty board: be first</small></span></a>`).join('')}</div>`}`;
      el.hidden = false;
    }

    function draw() {
      document.querySelectorAll('.say').forEach(s => s.remove());
      const pool = inMode(mode);
      let html = '';
      if (q) {
        const hits = byScore(all.filter(g => (g.name + ' ' + (g.blurb || '') + ' ' + (g.category || '')).toLowerCase().includes(q)));
        html = `<section class="cat-head small"><h2>${hits.length ? `${hits.length} games for “${esc(q)}”` : `Nothing called “${esc(q)}” in the park yet`}</h2></section>
          <div class="grid">${hits.map(g => card(g, stats[g.slug])).join('')}</div>`;
      } else if (mode === 'ai' || cat) {
        const key = mode === 'ai' ? 'AI' : cat, z = zone(key);
        let list = mode === 'ai' ? pool : pool.filter(g => catOf(g, cat));
        list = sort === 'new' ? list.slice().sort((a, b) => ((b.made || b.added) > (a.made || a.added) ? 1 : -1)) : sort === 'played' ? list.slice().sort((a, b) => ((stats[b.slug] || {}).plays || 0) - ((stats[a.slug] || {}).plays || 0)) : sort === 'for' ? ordered(list) : byScore(list);
        const shown = list.slice(0, more);
        const who = mode === 'ai' ? 'kid-agent-laptop,agent-token' : z.who + ',' + (key === 'Sports' ? 'fox-kick' : key === 'Racing' ? 'hamster-run' : 'robot-map');
        html = `<section class="cat-head" style="--scene:url('${A}${z.scene}.webp')">
            <div class="ch-txt"><span class="eyebrow">${esc(z.park)}</span><h2>${mode === 'ai' ? 'AI token games' : esc(cat)}</h2>
            <p>${mode === 'ai' ? '<b>Your AI agents power these games.</b> Connect Claude Code or Codex: every task your agents finish is a pass, a shot or a launch. Results count, tokens don\'t: it counts the work they finish and never spends tokens. World leaderboards with country flags, unrigged.' : `${list.length} ${MODES[mode].label.toLowerCase()} games, ${sort === 'for' ? 'the ones you\'ll like most first' : 'best scored first'}.`}</p></div>
            <div class="stagebox" data-who="${who}" data-opt='{"kind":"walk","h":92,"speed":34}'></div></section>
          <div class="sorts" role="group" aria-label="Sort">${[...(warm ? [['for', 'For you']] : []), ['score', 'Top scored'], ['new', 'Newest'], ['played', 'Most played']].map(([k, l]) => `<button data-sort="${k}" aria-pressed="${k === sort}">${l}</button>`).join('')}</div>
          <div class="grid">${shown.map(g => card(g, stats[g.slug], false)).join('')}</div>
          ${list.length > shown.length ? '<div class="more" data-more="games"></div>' : ''}`;
      } else {
        // a player we know: "For you" (her order, games she left in seconds out); a new one: the best scored with a gameplay clip
        const picks = warm ? ordered(pool).filter(g => T.like(g) > -1).slice(0, 8) : byScore(pool.filter(g => g.clip)).slice(0, 6);
        const all_cs = catsFor(mode), cs = warm && !open ? all_cs.slice(0, SHELVES) : all_cs;
        const W = ['robot-dunk,penguin-skates', 'hamster-run,duck-net', 'bunny-scooter,snail-race', 'frog-skate,robot-map', 'blob-frisbee,cat-binoculars'];
        html = `<section class="picks"><header><h2>${warm ? 'For you' : 'Park picks'}</h2><span>${warm ? 'Picked from what you play, and how long you stay' : `Highest scored ${MODES[mode].label.toLowerCase()} games right now`}</span></header>
            <div class="rail big">${picks.map(g => card(g, stats[g.slug], true)).join('')}</div></section>
          <section class="worldb" id="worldb" hidden></section>
          <section class="zones"><header><h2>Explore the park</h2><span>Every category has its own corner</span></header>
            <div class="rail">${all_cs.map(([c, n]) => `<a class="zc" href="#" data-zone="${esc(c)}"><img src="${A}${zone(c).scene}-s.webp" alt="" loading="lazy">
              <span class="zres">${CAST[zone(c).who] ? img(zone(c).who) : ''}</span><b>${esc(c)}</b><small>${esc(zone(c).park)} · ${n}</small></a>`).join('')}</div></section>
          ${pathStrip(W[0])}
          ${cs.slice(0, 9).map(([c], i) => shelf(c, zone(c).park, ordered(pool.filter(g => catOf(g, c))), c, zone(c).who, i) + (i % 3 === 2 ? pathStrip(W[(i / 3 + 1) % W.length | 0]) : '')).join('')}
          <section class="chart"><header><div class="peek" data-who="giraffe-peek" data-opt='{"kind":"peek","h":150,"shadow":false}'></div><h2>Top scored</h2><span>Park score = Claude's review of depth + polish; players' stars count once 3+ have rated</span></header>
            ${byScore(pool).slice(0, 12).map((g, i) => row(g, i, stats[g.slug])).join('')}</section>
          ${cs.slice(9).map(([c], i) => shelf(c, zone(c).park, ordered(pool.filter(g => catOf(g, c))), c, zone(c).who, i)).join('')}
          ${cs.length < all_cs.length ? '<div class="more" data-more="shelves"></div>' : ''}`;
      }
      const y = scrollY;
      $('shelves').innerHTML = html;
      if (y) scrollTo(0, y);
      // scrolled near the end: the next games (or the rest of the shelves) come in by themselves
      const sent = $('shelves').querySelector('[data-more]');
      if (sent && 'IntersectionObserver' in window) {
        const ob = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; ob.disconnect(); if (sent.dataset.more === 'shelves') open = true; else more += 48; draw(); }, { rootMargin: '900px' });
        ob.observe(sent);
      } else if (sent) { open = true; more = 1e9; setTimeout(draw); }
      worldBoards();
      residents($('shelves'));
      wireClips($('shelves'));
    }
    draw();
    K.getStats().then(s => { stats = s || {}; draw(); });

    const lastG = all.find(g => g.slug === K.store.get('last'));
    if (lastG) $('cont').innerHTML = `<a class="continue" href="${K.href(lastG)}"${K.tgt(lastG)}><img src="${esc(K.art(lastG))}" alt="">
      <div><span class="eyebrow">Back to the park</span><b>${esc(lastG.name)}</b></div><span class="go">${PLAY} Play</span></a>`;
    residents(document.querySelector('.gate'));
    K.renderInstall(); K.autoPrompt();
    if (window.Grow && !K.EMBED) window.Grow.home(all);
    if (!reduce) requestAnimationFrame(loop);
  }

  // hover a card on a computer: its gameplay clip plays inside the frame
  function wireClips(root) {
    if (!matchMedia('(hover: hover)').matches || reduce) return;
    root.querySelectorAll('.gc').forEach(c => {
      const v = c.querySelector('video'); if (!v) return;
      c.addEventListener('mouseenter', () => { if (!v.src) v.src = v.dataset.src; v.play().then(() => c.classList.add('playing')).catch(() => {}); });
      c.addEventListener('mouseleave', () => { v.pause(); c.classList.remove('playing'); });
    });
  }

  // the big park at the top: everyone out playing
  function world() {
    const st = $('actors'); if (!st) return;
    const W = st.clientWidth, H = st.clientHeight, s = Math.max(0.62, Math.min(1.15, W / 1100));
    const g = f => H * f;                                       // ground lines (fractions of the stage height)
    const add = (n, o) => { const a = actor(st, n, { ...o, h: (o.h || 110) * s }); if (a) a.y = g(o.ground) - a.H; return a; };
    const ph = W < 700;                                         // phones: copy sits on top, fewer residents below it
    const fox = add('fox-kick', { kind: 'idle', ground: 0.97, x: W * (ph ? 0.02 : 0.06), h: 128 });
    const rac = add('raccoon-padel', { kind: 'idle', ground: 0.97, x: W * (ph ? 0.5 : 0.34), h: 128, flip: true });
    if (fox && rac) rally(st, fox, rac, 128 * s);
    add('bear-kite', { kind: 'idle', ground: ph ? 0.78 : 0.80, x: W * (ph ? 0.6 : 0.62), h: 100 });
    add('p-kite', { kind: 'float', ground: ph ? 0.62 : 0.30, x: W * (ph ? 0.74 : 0.70), h: ph ? 70 : 92, shadow: false });
    if (!ph) add('p-balloons', { kind: 'float', ground: 0.34, x: W * 0.9, h: 120, shadow: false });
    add('frog-skate', { kind: 'glide', ground: ph ? 0.85 : 0.86, x: W * 0.5, h: 104, speed: ph ? 55 : 90, wrap: true, tilt: 4 });
    add('penguin-skates', { kind: 'walk', ground: 0.93, x: W * 0.75, h: 98, speed: 42, tilt: 10, freq: 9, bob: 4, dir: -1 });
    if (!ph) add('hamster-run', { kind: 'walk', ground: 0.76, x: W * 0.2, h: 64, speed: 70, freq: 14, bob: 5, wrap: true });
    add('snail-race', { kind: 'walk', ground: 0.995, x: W * 0.52, h: 58, speed: 7, bob: 0, tilt: 1, wrap: true });
    add('octopus-juggle', { kind: 'idle', ground: ph ? 0.74 : 0.83, x: W * (ph ? 0.06 : 0.84), h: 100 });
    if (!ph) add('cat-binoculars', { kind: 'walk', ground: 0.74, x: W * 0.4, h: 70, speed: 20, range: W * 0.18 });
  }

  window.Park = { home, score };
})();
