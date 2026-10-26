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
  if (!RETRY && !WINGO) return;

  const ss = (k, v) => { try { if (v === undefined) return +sessionStorage.getItem('ap.fp.' + k) || 0; sessionStorage.setItem('ap.fp.' + k, String(v)); } catch (e) { return 0; } };
  const css = document.createElement('style');
  css.textContent = `.fp-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:30;pointer-events:none;text-align:center;
    font:800 40px/1.05 'Space Grotesk',system-ui,sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.25),0 0 24px rgba(0,0,0,.35);opacity:0;transition:transform .22s cubic-bezier(.2,1.6,.4,1),opacity .18s}
    .fp-toast.in{opacity:1;transform:translate(-50%,-50%) scale(1)}.fp-toast small{display:block;font-size:20px;font-weight:700;margin-top:8px;opacity:.95}
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
