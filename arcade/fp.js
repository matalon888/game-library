// First-play A/B tests in the player (play.html), run by the first-play agent (~/agentpark-firstplay, BRIEF.md). Each block is
// one live test in the lab (arcade-api xplab.js): APX.on('<name>') true = arm B. It watches the game frame's window.__game
// (our kit games: state 'play' / 'won' / 'lost', score) from outside, so no game file changes. Remove a block when its test ends.
(function () {
  if (!window.APX || new URLSearchParams(location.search).get('embed') === 'chat') return;
  // fp-shell-instant-retry (2026-10-26): a lost round shows the kit's "OOPS! Tap to retry" and 1.2 s later the shell's
  // "Round over / One more go?" card with three other games over it. 44 of 252 new players' first games ended "lost, then
  // another game", and 23% of first sessions lost someone during a game switch. B: the first 3 losses of a visit restart at
  // once (a near-miss line instead of a card), so a new player keeps learning the game they started.
  const RETRY = APX.on('fp-shell-instant-retry');
  // fp-shell-win-autonext (2026-10-26): a won level waits on "CLEARED! Tap to continue"; 59 of 252 first games ended right
  // after a win by switching game (first game median 35 s). B: the first 5 wins of a visit get a burst of stars and roll
  // into the next level by themselves, so the moment after a win is momentum, not a pause next to "Next game".
  const WINGO = APX.on('fp-shell-win-autonext');
  // fp-shell-best-chip (2026-10-26): 92 of 130 new players' first sessions had one game and nothing on screen says what to
  // beat. B: from the second round of a game, a small "🏆 beat N" chip (their best in that game) sits at the top while they
  // play, and flips to a gold "NEW BEST!" the moment they pass it: the next goal is always on screen.
  const BEST = APX.on('fp-shell-best-chip');
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
  if (!RETRY && !WINGO && !BEST && !JUICE && !HOWTO && !LVL) return;

  const ss = (k, v) => { try { if (v === undefined) return +sessionStorage.getItem('ap.fp.' + k) || 0; sessionStorage.setItem('ap.fp.' + k, String(v)); } catch (e) { return 0; } };
  const css = document.createElement('style');
  css.textContent = `.fp-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:30;pointer-events:none;text-align:center;
    font:800 40px/1.05 'Space Grotesk',system-ui,sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.25),0 0 24px rgba(0,0,0,.35);opacity:0;transition:transform .22s cubic-bezier(.2,1.6,.4,1),opacity .18s}
    .fp-toast.in{opacity:1;transform:translate(-50%,-50%) scale(1)}.fp-toast small{display:block;font-size:20px;font-weight:700;margin-top:8px;opacity:.95}
    .fp-chip{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 112px);transform:translateX(-50%);z-index:28;pointer-events:none;
    font:800 15px/1 'Space Grotesk',system-ui,sans-serif;color:#fff;background:rgba(18,22,58,.72);border:2px solid rgba(255,255,255,.35);border-radius:999px;padding:7px 13px;
    white-space:nowrap;opacity:0;transition:opacity .2s}.fp-chip.in{opacity:1}
    .fp-chip.beat{background:#FFC93C;color:#1E1B33;border-color:#fff;animation:fpPop .5s cubic-bezier(.2,1.6,.4,1)}
    @keyframes fpPop{0%{transform:translateX(-50%) scale(.6)}100%{transform:translateX(-50%) scale(1)}}
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

  // the best-chip and score-juice tests: a quicker look at the score while a round is on
  if (BEST || JUICE) {
    const slug = new URLSearchParams(location.search).get('g') || '';
    const lsBest = v => { try { if (v === undefined) return +localStorage.getItem('ap.fp.best.' + slug) || 0; localStorage.setItem('ap.fp.best.' + slug, String(v)); } catch (e) { return 0; } };
    let chip = null, target = 0, beaten = false, pst = null, psc = 0, ticks = 0, moves = 0, owed = 0, lastPop = 0;
    // a flash, not a fixture: it sits where games keep their own HUD, so it shows for a moment and goes
    let chipT = 0;
    const chipShow = (html, cls, ms) => {
      if (!chip) { chip = document.createElement('div'); chip.className = 'fp-chip'; document.body.appendChild(chip); }
      chip.innerHTML = html; chip.classList.toggle('beat', cls === 'beat'); requestAnimationFrame(() => chip && chip.classList.add('in'));
      clearTimeout(chipT); chipT = setTimeout(() => chipHide(), ms);
    };
    const chipHide = () => { if (chip) chip.classList.remove('in'); };
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
      if (st !== pst) {
        if ((pst === 'play') && (st === 'lost' || st === 'won')) { if (sc > lsBest()) lsBest(sc); }
        if (st === 'play') { target = lsBest(); beaten = false; psc = sc; owed = 0; if (BEST && target > 0) chipShow(`🏆 beat ${target.toLocaleString()}`, '', 2500); }
        else chipHide();
        pst = st;
      }
      if (st !== 'play') return;
      const d = sc - psc; psc = sc;
      if (JUICE) {
        ticks++; if (d !== 0) moves++;
        // a score that moves on most ticks is a counter, not a success: no pops for that game
        const counter = ticks >= 20 && moves / ticks > 0.4;
        if (d > 0 && !counter) owed += d;
        if (owed > 0 && Date.now() - lastPop > 300) { pop(owed); owed = 0; lastPop = Date.now(); }
      }
      if (BEST && target > 0 && !beaten && sc > target) { beaten = true; chipShow(`NEW BEST! ${sc.toLocaleString()}`, 'beat', 2000); }
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

  if (!RETRY && !WINGO) return;
  let last = null, best = 0;
  setInterval(() => {
    const f = document.querySelector('.stage iframe'); if (!f) return;
    let w, g, st, sc; try { w = f.contentWindow; g = w.__game; if (!g) return; st = g.state; sc = g.score; } catch (e) { return; }
    const score = typeof sc === 'number' && isFinite(sc) ? Math.round(sc) : 0;
    if (st === last) return;
    const prev = last; last = st;
    if (prev === null) return;
    if (st === 'lost' && RETRY && ss('lost') < 3 && !document.querySelector('.g-card')) {
      ss('lost', ss('lost') + 1);
      // best = the best earlier round of this visit
      const near = score > 0 && best > 0 ? (score > best ? `New best ${score.toLocaleString()}!` : `${score.toLocaleString()} · best ${best.toLocaleString()}`) : 'So close!';
      // the kit shows its lose card 650 ms after the loss; restart on it, before the shell's round card (1.2 s) comes up
      tapCard(w, 1000, () => toast('↻ Again!', near, 1000));
    } else if (st === 'won' && WINGO && ss('won') < 5) {
      ss('won', ss('won') + 1);
      burst();
      // let "CLEARED!" land for a beat, then the next level starts
      setTimeout(() => tapCard(w, 2500, () => toast('Next level ▶', '', 700)), 1500);
    }
    if (st === 'lost' || st === 'won') best = Math.max(best, score);
  }, 150);
})();
