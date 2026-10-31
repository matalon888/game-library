// First-play A/B tests in the player (play.html), run by the first-play agent (~/agentpark-firstplay, BRIEF.md). Each block is
// one live test in the lab (arcade-api xplab.js): APX.on('<name>') true = arm B. It watches the game frame's window.__game
// (our kit games: state 'play' / 'won' / 'lost', score) from outside, so no game file changes. Remove a block when its test ends.
// fp-shell-ask-two (2026-10-27, Daniel: "guessing what the user wants to play is a lottery ... two questions: category, show a
// few examples, and then a few games from each category"). Replaces fp-shell-ask-kind (one screen of 4 games, ended at ~0
// players). B, before a new player's first game: (1) 4 big category cards, each a word + emoji over 4 example covers;
// (2) the 4 games of the tapped category, moving clips; a tap starts that game. The category is kept (localStorage
// ap.fp.kind, its games in order) so Next / the round card / auto-next stay in it (grow.js kindNext). Women (ap.aud = f, a
// women's ad set) get women's categories. The linked game loads and runs behind, so who becomes a player is the same in
// both arms.
(function () {
  const q = new URLSearchParams(location.search), slug = q.get('g');
  if (!window.APX || q.get('embed') === 'chat' || !slug || q.get('from') === 'kind' || true) return;   // ended 2026-10-30: losing (-35%, P 0.03), the questions cost time before the first game
  const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let pc = {}; try { pc = JSON.parse(ls('arcade.pc') || '{}') || {}; } catch (e) {}
  if (ls('ap.fp.kind') || Object.keys(pc).some(k => k !== slug) || (pc[slug] || 0) > 1) return;   // only a brand-new player
  try { if (sessionStorage.getItem('ap.fp.asked')) return; sessionStorage.setItem('ap.fp.asked', '1'); } catch (e) {}
  if (window.ApTaste && ApTaste.active && ApTaste.active()) return;   // taste.js already picks her games (another session's test)
  // first in each list = the game that group held longest Oct 24-27
  // women's ads (ap.aud = f) see women's categories, men's ads (m) men's, anyone else a mix (Daniel 2026-10-28: "women see the
  // women's category and men see the men's category")
  const MEN = [
    ['🔫', 'Shooting', ['horde-blast', 'squad-surge', 'swarm-streets', 'cover-clash', 'core-crusher']],
    ['🏁', 'Race', ['marble-dash', 'tube-rush', 'bumpy-buggy', 'stretch-dash', 'chilly-chute', 'turf-rush']],
    ['🎯', 'Aim', ['ricochet-rex', 'fort-fling', 'smash-dummy', 'fling-feud', 'flip-agent']],
    ['🧩', 'Puzzles', ['untwine', 'bolt-twist', 'slip-links', 'dust-descent', 'shelf-snap', 'ring-peel']],
  ];
  const aud = ls('ap.aud');
  const CATS = (aud === 'm' ? MEN : aud === 'f' ? [
    ['🧩', 'Puzzles', ['jelly-blocks-block-puzzle', 'peony-mahjong-relaxing-tile-solitaire', 'gemloft-block-puzzle', 'shelfie-goods-sort', 'sprinkle-sort-cute-sort-puzzle']],
    ['🍬', 'Match 3', ['garden-gather-match-3-garden', 'mochi-match-match-3-dorm-decor', 'boba-trio-triple-match-3d', 'paw-lagoon']],
    ['🍰', 'Cooking', ['dumpling-dash-kawaii-cooking-rush', 'sugarloaf-cafe-cooking-rush', 'spin-bakes-cake-decorating-game', 'pocket-pom-cozy-pet-cafe']],
    ['💅', 'Makeover', ['snip-studio-hair-salon-makeover', 'tip-top-nail-salon-makeover', 'glowfit-runway-dress-up-fashion-battle', 'swirl-tee', 'dress-diva']],
  ] : [
    ['🎯', 'Aim', ['ricochet-rex', 'fort-fling', 'flip-agent', 'horde-blast', 'fling-feud', 'smash-dummy', 'squad-surge']],
    ['🏁', 'Race', ['marble-dash', 'tube-rush', 'stretch-dash', 'tiptoe-tower', 'bumpy-buggy', 'chilly-chute', 'turf-rush']],
    ['🧩', 'Puzzles', ['untwine', 'bolt-twist', 'slip-links', 'shelf-snap', 'ring-peel', 'latte-jam', 'snip-snack']],
    ['🌸', 'Cozy', ['mochi-match-match-3-dorm-decor', 'swirl-tee', 'paw-lagoon', 'whisker-stack', 'knit-flow', 'munch-buddies']],
  ]).map(([e, w, l]) => [e, w, l.includes(slug) ? [slug].concat(l.filter(x => x !== slug)) : l]);
  const css = document.createElement('style');
  css.textContent = `.fp-ask{position:fixed;inset:0;z-index:60;background:#15171B;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;
    padding:calc(env(safe-area-inset-top) + 8px) 8px calc(env(safe-area-inset-bottom) + 8px);opacity:0;transition:opacity .2s}.fp-ask.in{opacity:1}
    .fp-ask button{position:relative;border:0;padding:0;border-radius:22px;overflow:hidden;background:#222 center/cover no-repeat;cursor:pointer;color:#fff;
    box-shadow:0 0 0 3px rgba(255,255,255,.18) inset;animation:fpIn .45s cubic-bezier(.2,1.5,.4,1) both;-webkit-tap-highlight-color:transparent}
    .fp-ask button:nth-child(2){animation-delay:.06s}.fp-ask button:nth-child(3){animation-delay:.12s}.fp-ask button:nth-child(4){animation-delay:.18s}
    .fp-ask video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .fp-ask .mo{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px}
    .fp-ask .mo i{background:#222 center/cover no-repeat}
    .fp-ask .lb{position:absolute;left:8px;right:8px;bottom:10px;display:grid;justify-items:center;gap:2px;padding:10px 4px 8px;border-radius:16px;
      background:rgba(10,10,16,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .fp-ask .lb b{font-size:40px;line-height:1}.fp-ask .lb span{font:800 22px/1.1 "Bricolage Grotesque","DM Sans",system-ui,sans-serif}
    .fp-ask .bk{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:54px;height:54px;border-radius:50%;z-index:61;font-size:26px;
      background:#15171B;box-shadow:0 0 0 3px rgba(255,255,255,.25) inset;animation:none}
    .fp-ask button:active{transform:scale(.96)}.fp-ask button.go{box-shadow:0 0 0 5px #FFC93C inset}
    @keyframes fpIn{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}`;
  document.head.appendChild(css);
  const o = document.createElement('div'); o.className = 'fp-ask';
  const note = d => { try { window.ArcadeDiag && ArcadeDiag.note('ui', d); } catch (x) {} };
  let done = false;
  const btn = (html, bg, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label);
    if (bg) b.style.backgroundImage = `url('covers/${bg}.webp')`; b.innerHTML = html; b.onclick = () => fn(b); o.appendChild(b); return b; };
  // question 1: which kind of game
  const cats = () => {
    o.innerHTML = '';
    CATS.forEach(([e, w, l], i) => btn(`<div class="mo">${l.slice(0, 4).map(g => `<i style="background-image:url('covers/${g}.webp')"></i>`).join('')}</div>` +
      `<div class="lb"><b>${e}</b><span>${w}</span></div>`, null, w, () => { note({ what: 'fp_cat', kind: i }); games(i); }));
  };
  // question 2: which game of that kind (moving clips)
  const games = i => {
    const [, w, l] = CATS[i]; o.innerHTML = '';
    l.slice(0, 4).forEach(g => btn(`<video muted playsinline loop autoplay preload="none" poster="covers/${g}.webp"></video>`, g, 'Play ' + g.replace(/-/g, ' '), b => {
      if (done) return; done = true; b.classList.add('go');
      try { localStorage.setItem('ap.fp.kind', JSON.stringify([g].concat(l.filter(x => x !== g)))); } catch (x) {}
      note({ what: 'fp_kind', kind: i, slug: g });
      if (g === slug) { setTimeout(() => { o.style.opacity = '0'; setTimeout(() => o.remove(), 200); }, 150); return; }
      try { sessionStorage.setItem('ap.auto', g); } catch (x) {}
      setTimeout(() => location.replace(`play.html?g=${encodeURIComponent(g)}&from=kind`), 150);
    }));
    const bk = btn('↩', null, 'Back', cats); bk.className = 'bk';
    o.querySelectorAll('video').forEach((v, j) => { v.src = `clips/${l[j]}.mp4`; v.play && v.play().catch(() => {}); });
  };
  cats();
  const show = () => { document.body.appendChild(o); requestAnimationFrame(() => o.classList.add('in')); };
  if (document.body) show(); else addEventListener('DOMContentLoaded', show);
})();
(function () {
  if (!window.APX || new URLSearchParams(location.search).get('embed') === 'chat') return;
  // fp-shell-win-autonext (2026-10-26): a won level waits on "CLEARED! Tap to continue"; 59 of 252 first games ended right
  // after a win by switching game (first game median 35 s). B: the first 5 wins of a visit get a burst of stars and roll
  // into the next level by themselves, so the moment after a win is momentum, not a pause next to "Next game".
  const WINGO = APX.on('fp-shell-win-autonext');
  // fp-shell-score-juice (2026-10-26): first games are short (half of the first games ended in under 10 s with 0-1 taps) and
  // a point scored is only a HUD digit changing. B: every score jump pops a big "+N" over the game (and a short buzz on
  // Android), so each early success feels loud. Games whose score ticks up on its own (distance counters) are left alone.
  const JUICE = APX.on('fp-shell-score-juice');
  // fp-shell-howto-hand (2026-10-26): the shell taps past every game's start card, so its how-to line ("Tap a raccoon to
  // fling") and hand are never seen; a third of swirl-tee runs (29/84 since Oct 24) ended with 0-1 taps. B: the first round
  // of each game in a visit shows that line with a bobbing hand at the bottom while the player hasn't touched it yet.
  const HOWTO = APX.on('fp-shell-howto-hand');
  // fp-shell-level-bar (2026-10-26): 92 of 130 new players' first sessions had one game, and nothing grows across rounds or
  // games: each round ends on its own. B: a player level (kept on the device) whose bar fills with every finished round, in
  // any game, flashes at the top after each round ("Lv 1 ▰▰▱ 2/3") and levels up loudly at 3, 6, 10, 15… rounds: a next goal
  // that spans the whole visit, and a level waiting when they come back.
  const LVL = APX.on('fp-shell-level-bar');
  if (!WINGO && !JUICE && !HOWTO && !LVL) return;

  const ss = (k, v) => { try { if (v === undefined) return +sessionStorage.getItem('ap.fp.' + k) || 0; sessionStorage.setItem('ap.fp.' + k, String(v)); } catch (e) { return 0; } };
  const css = document.createElement('style');
  css.textContent = `.fp-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:30;pointer-events:none;text-align:center;
    font:800 40px/1.05 'Space Grotesk',system-ui,sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.25),0 0 24px rgba(0,0,0,.35);opacity:0;transition:transform .22s cubic-bezier(.2,1.6,.4,1),opacity .18s}
    .fp-toast.in{opacity:1;transform:translate(-50%,-50%) scale(1)}.fp-toast small{display:block;font-size:20px;font-weight:700;margin-top:8px;opacity:.95}
    .fp-plus{position:fixed;z-index:29;pointer-events:none;top:30%;font:800 44px/1 'Space Grotesk',system-ui,sans-serif;color:#FFE45C;
    -webkit-text-stroke:2px #1E1B33;text-shadow:0 4px 0 rgba(0,0,0,.3);transform:translate(-50%,0) scale(.5);opacity:0;transition:transform .7s cubic-bezier(.2,1.4,.4,1),opacity .7s}
    .fp-plus.in{opacity:1;transform:translate(-50%,-50px) scale(1)}.fp-plus.out{opacity:0;transform:translate(-50%,-110px) scale(1)}
    .fp-howto{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 13%);transform:translate(-50%,20px);z-index:30;pointer-events:none;
    display:flex;flex-direction:column;align-items:center;gap:6px;max-width:86vw;text-align:center;opacity:0;transition:opacity .25s,transform .25s}
    .fp-howto.in{opacity:1;transform:translate(-50%,0)}.fp-howto i{font-style:normal;font-size:52px;line-height:1;animation:fpBob 1.1s ease-in-out infinite;filter:drop-shadow(0 4px 0 rgba(0,0,0,.25))}
    .fp-howto b{font:800 19px/1.2 'Space Grotesk',system-ui,sans-serif;color:#fff;background:rgba(18,22,58,.84);border:2px solid rgba(255,255,255,.4);border-radius:18px;padding:10px 16px}
    @keyframes fpBob{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(14px) scale(.9)}}
    .fp-lvl{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 58px);transform:translate(-50%,-14px);z-index:31;pointer-events:none;display:flex;align-items:center;gap:9px;
    font:800 16px/1 'Space Grotesk',system-ui,sans-serif;color:#fff;background:rgba(18,22,58,.86);border:2px solid rgba(255,255,255,.4);border-radius:999px;padding:7px 14px 7px 9px;
    white-space:nowrap;opacity:0;transition:opacity .2s,transform .25s cubic-bezier(.2,1.6,.4,1)}.fp-lvl.in{opacity:1;transform:translate(-50%,0)}
    .fp-lvl em{font-style:normal;background:#FFC93C;color:#1E1B33;border-radius:999px;padding:5px 9px}.fp-lvl s{text-decoration:none;display:block;width:96px;height:12px;border-radius:9px;background:rgba(255,255,255,.2);overflow:hidden}
    .fp-lvl s i{display:block;height:100%;background:linear-gradient(90deg,#7CF29A,#FFE45C);border-radius:9px;transition:width .6s cubic-bezier(.2,1,.4,1) .25s}
    .fp-lvl.up{background:#FFC93C;color:#1E1B33;border-color:#fff;font-size:20px;padding:10px 18px}
    .fp-star{position:fixed;z-index:29;pointer-events:none;font-size:30px;left:50%;top:42%;transition:transform 1s cubic-bezier(.15,.8,.3,1),opacity 1s ease-in}`;
  document.head.appendChild(css);
  const toast = (big, small, ms = 900) => {
    const t = document.createElement('div'); t.className = 'fp-toast'; t.innerHTML = big + (small ? `<small>${small}</small>` : '');
    document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 250); }, ms);
  };
  const burst = () => {
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('div'); s.className = 'fp-star'; s.textContent = ['⭐', '🎉', '✨', '🌟'][i % 4];
      document.body.appendChild(s);
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160;
      requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r - 60}px) rotate(${Math.random() * 360}deg)`; s.style.opacity = '0'; }));
      setTimeout(() => s.remove(), 1100);
    }
  };
  // tap the kit's visible card (the same synthetic pointerdown shell.js autostart uses) once it shows, within `wait` ms
  const tapCard = (w, wait, cb) => {
    const t0 = Date.now(), iv = setInterval(() => {
      try {
        const c = w.document.querySelector('.hc-card:not(.hc-hidden)');
        if (c) { clearInterval(iv); cb && cb(); c.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true })); return; }
      } catch (e) { clearInterval(iv); return; }
      if (Date.now() - t0 > wait) clearInterval(iv);
    }, 60);
  };

  // the score-juice test: a louder score while a round is on
  if (JUICE) {
    let pst = null, psc = 0, ticks = 0, moves = 0, owed = 0, lastPop = 0;
    const pop = n => {
      const t = document.createElement('div'); t.className = 'fp-plus'; t.textContent = '+' + n.toLocaleString();
      t.style.left = (50 + (Math.random() * 30 - 15)) + '%';
      document.body.appendChild(t); requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
      setTimeout(() => t.classList.add('out'), 450); setTimeout(() => t.remove(), 1200);
      try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    };
    setInterval(() => {
      const f = document.querySelector('.stage iframe'); if (!f) return;
      let g; try { g = f.contentWindow.__game; } catch (e) { return; }
      if (!g) return;
      const st = g.state, sc = typeof g.score === 'number' && isFinite(g.score) ? Math.round(g.score) : 0;
      if (st !== pst) { if (st === 'play') { psc = sc; owed = 0; } pst = st; }
      if (st !== 'play') return;
      const d = sc - psc; psc = sc;
      ticks++; if (d !== 0) moves++;
      // a score that moves on most ticks is a counter, not a success: no pops for that game
      const counter = ticks >= 20 && moves / ticks > 0.4;
      if (d > 0 && !counter) owed += d;
      if (owed > 0 && Date.now() - lastPop > 300) { pop(owed); owed = 0; lastPop = Date.now(); }
    }, 100);
  }

  // the how-to test: the game's own start-card line + hand, until the first real touch in that game
  if (HOWTO) {
    let doc = null, key = '', touched = false, t0 = 0, shows = 0, showT = 0, el = null;
    const seen = k => { try { const a = JSON.parse(sessionStorage.getItem('ap.fp.howto') || '[]'); if (a.includes(k)) return true; a.push(k); sessionStorage.setItem('ap.fp.howto', JSON.stringify(a.slice(-40))); } catch (e) {} return false; };
    const hide = () => { clearTimeout(showT); if (el) { const e = el; el = null; e.classList.remove('in'); setTimeout(() => e.remove(), 300); } };
    setInterval(() => {
      const f = document.querySelector('.stage iframe'); if (!f) return hide();
      let d, g; try { d = f.contentDocument; g = f.contentWindow.__game; } catch (e) { return; }
      if (!d) return;
      if (d !== doc) {   // a new game page in the frame
        hide(); doc = d; key = ''; touched = false; t0 = 0; shows = 0;
        try { d.addEventListener('pointerdown', ev => { if (ev.isTrusted) { touched = true; hide(); } }, { capture: true }); } catch (e) {}
      }
      if (touched || !g || shows >= 3) return;
      if (g.state !== 'play') { hide(); return; }
      if (!key) {   // first 'play' in this page: once per game per visit
        const h = d.querySelector('.hc-card .hint'); if (!h) { touched = true; return; }
        const c = h.cloneNode(true); c.querySelectorAll('.hand').forEach(x => x.remove());
        const txt = (c.textContent || '').trim(), hand = (h.querySelector('.hand') || {}).textContent || '👆';
        key = f.contentWindow.location.pathname;
        if (!txt || seen(key)) { touched = true; return; }
        key = JSON.stringify([hand, txt]); t0 = Date.now(); return;
      }
      // after 1.5 s without a touch (then again every 4 s idle), 5 s each, at most 3 times
      if (!el && Date.now() - t0 > (shows ? 4000 : 1500)) {
        const [hand, txt] = JSON.parse(key);
        el = document.createElement('div'); el.className = 'fp-howto';
        el.innerHTML = '<i></i><b></b>'; el.firstChild.textContent = hand; el.lastChild.textContent = txt;
        document.body.appendChild(el); requestAnimationFrame(() => el && el.classList.add('in'));
        shows++; showT = setTimeout(() => { hide(); t0 = Date.now(); }, 5000);
      }
    }, 150);
  }

  // the level-bar test: every finished round (won or lost, any game) adds one to a device-wide count; levels at 3, 6, 10, 15, +6
  if (LVL) {
    const ls = v => { try { if (v === undefined) return +localStorage.getItem('ap.fp.xp') || 0; localStorage.setItem('ap.fp.xp', String(v)); } catch (e) { return 0; } };
    const steps = [0, 3, 6, 10, 15];
    const at = l => l < steps.length ? steps[l] : 15 + (l - 4) * 6;   // rounds needed to reach level l+1
    const level = n => { let l = 0; while (n >= at(l + 1)) l++; return l; };
    let el = null, hideT = 0, pst = null, pdoc = null;
    const show = (n, up) => {
      const l = level(n), lo = at(l), hi = at(l + 1), was = up ? 0 : (n - 1 - lo) / (hi - lo), now = (n - lo) / (hi - lo);
      if (!el) { el = document.createElement('div'); el.className = 'fp-lvl'; document.body.appendChild(el); }
      el.classList.toggle('up', !!up);
      el.innerHTML = up ? `⭐ LEVEL ${l + 1}!` : `<em>Lv ${l + 1}</em><s><i style="width:${Math.max(0, was) * 100}%"></i></s>${n - lo}/${hi - lo}`;
      requestAnimationFrame(() => { if (!el) return; el.classList.add('in'); const b = el.querySelector('s i'); if (b) requestAnimationFrame(() => { b.style.width = now * 100 + '%'; }); });
      clearTimeout(hideT); hideT = setTimeout(() => { if (el) el.classList.remove('in'); }, up ? 2200 : 1800);
    };
    setInterval(() => {
      const f = document.querySelector('.stage iframe'); if (!f) return;
      let d, g; try { d = f.contentDocument; g = f.contentWindow.__game; } catch (e) { return; }
      if (!g) return;
      if (d !== pdoc) { pdoc = d; pst = null; }
      const st = g.state; if (st === pst) return;
      const prev = pst; pst = st;
      if (prev !== 'play' || (st !== 'won' && st !== 'lost')) return;
      const n = ls() + 1; ls(n);
      if (level(n) > level(n - 1)) { show(n, true); burst(); try { navigator.vibrate && navigator.vibrate([20, 40, 20]); } catch (e) {} }
      else show(n, false);
    }, 120);
  }

  if (!WINGO) return;
  let last = null;
  setInterval(() => {
    const f = document.querySelector('.stage iframe'); if (!f) return;
    let w, g, st; try { w = f.contentWindow; g = w.__game; if (!g) return; st = g.state; } catch (e) { return; }
    if (st === last) return;
    const prev = last; last = st;
    if (prev === null) return;
    if (st === 'won' && WINGO && ss('won') < 5) {
      ss('won', ss('won') + 1);
      burst();
      // let "CLEARED!" land for a beat, then the next level starts
      setTimeout(() => tapCard(w, 2500, () => toast('Next level ▶', '', 700)), 1500);
    }
  }, 150);
})();

// fp-shell-slow-swap (2026-10-31, Daniel: "why retention is so bad"): players whose games ran under 40 fps on day 1 came back
// 3% vs 12% (0 of 40 under 20 fps); on the 80 slow phones since Oct 22, paw-lagoon, gemloft, shelfie, mochi-match and peony ran
// at a median 12-26 fps while the LIGHT games below held 50-60 on the same phones. B: when the game in the frame runs under
// 28 fps for 6 s, once a visit, a card offers 3 light games ("Smoother on this phone"); a tap opens one. A: nothing.
(function () {
  const q = new URLSearchParams(location.search);
  const demo = q.get('slowdemo') === '1';   // preview link for Daniel's phone: the card right away, in any arm
  if (!demo && (!window.APX || q.get('embed') === 'chat' || !APX.on('fp-shell-slow-swap'))) return;
  const LIGHT = [['untwine', 'Untwine', 'Puzzle'], ['bolt-twist', 'Bolt Twist', 'Puzzle'], ['girder-go', 'Girder Go', 'Puzzle'],
    ['alibi-grid-daily-logic-puzzle', 'Alibi Grid', 'Puzzle'], ['bumpy-buggy', 'Bumpy Buggy', 'Racing'], ['marble-dash', 'Marble Dash', 'Racing'],
    ['fort-fling', 'Fort Fling', 'Action'], ['fling-feud', 'Fling Feud', 'Action'], ['pose-rush', 'Pose Rush', 'Action'],
    ['bellhop-boss', 'Bellhop Boss', 'Idle'], ['core-crusher', 'Core Crusher', 'Arcade']];
  const slug = q.get('g') || '';
  if (LIGHT.some(x => x[0] === slug)) return;
  try { if (!demo && sessionStorage.getItem('ap.fp.slow')) return; } catch (e) {}
  let frames = 0, t0 = 0, low = 0, done = false;
  const tick = t => {
    if (done) return;
    if (document.hidden) { t0 = 0; frames = 0; }
    else if (!t0) { t0 = t; frames = 0; }
    else if (t - t0 >= 2000) {   // a 2 s window: same-origin frames share this page's thread, so its frame rate is the game's
      const fps = frames * 1000 / (t - t0); t0 = t; frames = 0;
      low = fps < 28 ? low + 1 : 0;
      if (low >= 3) { done = true; show(); return; }
    } else frames++;
    requestAnimationFrame(tick);
  };
  if (demo) { done = true; setTimeout(() => card(''), 1500); return; }
  setTimeout(() => requestAnimationFrame(tick), 5000);   // past the load and the first-frame shader compiles
  function show() {
    try { sessionStorage.setItem('ap.fp.slow', '1'); } catch (e) {}
    fetch('games.json').then(r => r.json()).then(gs => card(((gs.find(g => g.slug === slug) || {}).category) || ''), () => card(''));
  }
  function card(cat) {
    const pick = [...LIGHT.filter(x => x[2] === cat), ...LIGHT.filter(x => x[2] !== cat)].slice(0, 3);
    const css = document.createElement('style');
    css.textContent = `.fp-slow{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);transform:translate(-50%,130%);z-index:32;width:min(92vw,420px);
      background:rgba(18,22,58,.95);border:2px solid rgba(255,255,255,.35);border-radius:22px;padding:12px 12px 10px;color:#fff;font:700 15px/1.25 'Space Grotesk',system-ui,sans-serif;
      box-shadow:0 10px 30px rgba(0,0,0,.4);transition:transform .35s cubic-bezier(.2,1.3,.4,1)}.fp-slow.in{transform:translate(-50%,0)}
      .fp-slow p{margin:0 28px 10px 4px}.fp-slow .x{position:absolute;right:8px;top:6px;background:none;border:0;color:#fff;font-size:22px;padding:4px 8px;opacity:.7}
      .fp-slow .r{display:flex;gap:8px}.fp-slow a{flex:1;color:#fff;text-decoration:none;text-align:center;font-size:13px}
      .fp-slow img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;margin-bottom:5px}`;
    document.head.appendChild(css);
    const el = document.createElement('div'); el.className = 'fp-slow';
    el.innerHTML = `<button class="x" aria-label="Close">×</button><p>🐢 Choppy on this phone? These three run smooth:</p><div class="r">`
      + pick.map(x => `<a href="play.html?g=${x[0]}&from=slow"><img src="art/${x[0]}.webp" alt="">${x[1]}</a>`).join('') + '</div>';
    el.querySelector('.x').onclick = () => el.remove();
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => el.isConnected && el.classList.remove('in'), 15000);
  }
})();
