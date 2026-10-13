/* LIGHTCONE · main — input, in-canvas HUD, on-board agent callouts, frame loop. */
(function () {
  window.HS = window.HS || {};

  document.addEventListener('DOMContentLoaded', () => {
    const eng = HS.engine;
    const S = eng.state;
    const CFG = eng.CFG;

    const $ = (id) => document.getElementById(id);
    const canvas = $('game');
    HS.render.init(canvas);

    const ui = {
      timer: $('timer'), scoreH: $('scoreH'), scoreS: $('scoreS'),
      energyFill: $('energyFill'), energyNum: $('energyNum'),
      callouts: $('callouts'), taunt: $('taunt'),
      overlay: $('overlay'), overlayCard: document.querySelector('.overlay-card'),
      overlayEyebrow: $('overlayEyebrow'), overlayTitle: $('overlayTitle'),
      overlaySub: $('overlaySub'), overlayBtn: $('overlayBtn'),
      overlayWait: $('overlayWait'), overlayWaitText: $('overlayWaitText'),
      overlayDemo: $('overlayDemo'), overlayDemoBtn: $('overlayDemoBtn'),
      countdown: $('countdown'), cast: $('cast'),
      soundBtn: $('soundBtn'),
      brand: $('brand'), brandName: $('brandName'), favicon: $('favicon'),
      abilities: [...document.querySelectorAll('.ability')],
      floorBtn: $('floorBtn'), glimpse: $('glimpse'),
      agentLine: $('agentLine'), agentLineText: $('agentLineText'),
    };

    // the one-liner you hand to your agent — built from the real page URL,
    // click to copy (dev query params stripped so the agent gets a clean link)
    const agentInstruction = (() => {
      const url = location.origin + location.pathname;
      return `Play the WebMCP game at ${url}. Read the briefing tool first, then start playing when you're ready.`;
    })();
    ui.agentLineText.textContent = agentInstruction;
    let copiedTimer = 0;
    ui.agentLine.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(agentInstruction);
      } catch (e) {
        const ta = document.createElement('textarea'); // clipboard API blocked: fall back
        ta.value = agentInstruction;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      ui.agentLine.classList.add('copied');
      ui.agentLineText.textContent = 'copied — paste it to your agent';
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        ui.agentLine.classList.remove('copied');
        ui.agentLineText.textContent = agentInstruction;
      }, 1600);
    });

    // ── input ──
    const keys = new Set();
    let mode = null; // wall | decoy | scrub
    const view = { cellX: 0, cellY: 0, inCanvas: false, get mode() { return mode; } };

    function setMode(m) {
      mode = mode === m ? null : m;
      ui.abilities.forEach((b) => b.classList.toggle('armed', b.dataset.mode === mode));
    }

    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
      if (k === ' ' && !e.repeat) { eng.setDim(true); return; }
      if (k === 'shift' && !e.repeat) {
        const r = eng.tryDash();
        if (!r.ok && S.phase === 'play') HS.sfx.play('deny');
        return;
      }
      if (k === '1') return setMode('wall');
      if (k === '2') return setMode('decoy');
      if (k === '3') return setMode('scrub');
      if (k === '4') { if (S.meta.hider.unlocked) setMode('floor'); return; }
      if ((k === 'e' || k === 'q') && !e.repeat) { eng.shiftHiderPlane(k === 'e' ? 1 : -1); return; }
      if (k === 'escape') { mode = null; ui.abilities.forEach((b) => b.classList.remove('armed')); return; }
      keys.add(k);
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') eng.setDim(false);
      keys.delete(k);
    });
    window.addEventListener('blur', () => { keys.clear(); eng.setDim(false); });

    function pollMoveInput() {
      if (HS.demo && HS.demo.drivingHider) return; // demo director owns the hider
      let x = 0, y = 0;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      S.hider.moveX = x;
      S.hider.moveY = y;
    }

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      view.cellX = Math.floor(((e.clientX - r.left) / r.width) * CFG.COLS);
      view.cellY = Math.floor(((e.clientY - r.top) / r.height) * CFG.ROWS);
      view.inCanvas = true;
    });
    canvas.addEventListener('mouseleave', () => { view.inCanvas = false; });
    canvas.addEventListener('click', () => {
      if (!mode || S.phase !== 'play') return;
      HS.sfx.init();
      const fn = { wall: eng.placeWall, decoy: eng.placeDecoy, scrub: eng.scrubAt, floor: eng.placeFloor }[mode];
      const res = fn(view.cellX, view.cellY);
      if (!res.ok) {
        eng.feed(`✗ ${mode}: ${res.why}`, 'f-sys');
        HS.sfx.play('deny');
      }
    });

    // ability buttons are pinned inside the canvas, bottom-right — clicking
    // one arms that placement mode, then click the board to place
    ui.abilities.forEach((b) => {
      b.addEventListener('click', () => { HS.sfx.init(); setMode(b.dataset.mode); });
    });

    // ── buttons ──
    // the agent begins rounds, by calling start_round over WebMCP. the human
    // has two buttons of their own: Ready after a finished round (the agent
    // may not rematch until it is pressed), and — with no agent around — a
    // demo round against the factory daemon.
    const DEMO_OFFER_AFTER_MS = 30000; // idle time before the demo is offered
    let waitingSince = performance.now(); // since the human last had nothing to do but wait
    ui.overlayBtn.addEventListener('click', () => {
      HS.sfx.init();
      if (S.phase !== 'over') return;
      if (S.selfPlay) eng.startSelfPlay();
      else if (eng.setHumanReady()) waitingSince = performance.now();
    });
    ui.overlayDemoBtn.addEventListener('click', () => { HS.sfx.init(); eng.startSelfPlay(); });
    ui.soundBtn.addEventListener('click', () => {
      const on = HS.sfx.toggle();
      const label = on ? 'Sound on' : 'Sound off';
      ui.soundBtn.setAttribute('aria-pressed', String(on));
      ui.soundBtn.setAttribute('aria-label', label);
      ui.soundBtn.title = label;
    });

    // ── on-board callouts: everything the agent does, spoken on the board ──
    const CALLOUT_CLS = {
      'f-seeker': 'c-seeker', 'f-alert': 'c-alert',
      'f-you': 'c-you', 'f-noise': 'c-noise', 'f-sys': 'c-sys',
      'f-glitch': 'c-glitch', 'f-think': 'c-think', 'f-bot': 'c-bot',
      'f-realize': 'c-realize',
    };
    // a spoken realization hangs in the air longer than a thought
    const CALLOUT_MS = { 'f-realize': 6500 };
    const liveCount = { seeker: 0, hider: 0, sys: 0 };
    let lastFeedId = 0;

    function anchorFor(cls) {
      if (cls === 'f-seeker' || cls === 'f-alert' || cls === 'f-think' || cls === 'f-bot' || cls === 'f-realize') return 'seeker';
      if (cls === 'f-you' || cls === 'f-noise') return 'hider';
      return 'sys';
    }

    function spawnCallout(entry) {
      const anchor = anchorFor(entry.cls);
      const el = document.createElement('div');
      el.className = 'callout ' + (CALLOUT_CLS[entry.cls] || 'c-sys');
      el.textContent = entry.msg;
      const stack = liveCount[anchor]++;
      if (anchor === 'sys') {
        el.style.left = '50%';
        el.style.bottom = 12 + stack * 30 + 'px';
        el.style.top = 'auto';
        el.style.transform = 'translateX(-50%)';
      } else {
        const px = anchor === 'seeker' ? S.seeker.fx / CFG.COLS : S.hider.x / CFG.COLS;
        const py = anchor === 'seeker' ? S.seeker.fy / CFG.ROWS : S.hider.y / CFG.ROWS;
        el.style.left = Math.min(88, Math.max(12, px * 100)) + '%';
        el.style.top = `calc(${Math.min(90, Math.max(10, py * 100))}% - ${16 + stack * 26}px)`;
      }
      ui.callouts.appendChild(el);
      setTimeout(() => {
        liveCount[anchor] = Math.max(0, liveCount[anchor] - 1);
        el.remove();
      }, CALLOUT_MS[entry.cls] || 3600);
    }

    function drainFeed() {
      for (const entry of S.feed) {
        if (entry.id <= lastFeedId) continue;
        lastFeedId = entry.id;
        spawnCallout(entry);
      }
    }

    // ── HUD ──
    let lastCount = -1;
    let lastPhase = '';
    let lastName = '';
    let overlayToken = 0;
    let revealedPhase = '';

    // ── the card's action ──
    // lobby: a waiting notice — the agent starts. round over: Ready, then the
    // notice again. demo: your own start button. the demo is offered when
    // this browser has no WebMCP surface, or when nobody has called a tool
    // for a while — in the lobby, or after you pressed Ready.
    let agentCallsSeen = 0;
    let actionsKey = '';

    function demoOffered() {
      const avail = HS.webmcp ? HS.webmcp.availability : 'checking';
      if (avail === 'unavailable' || avail === 'error') return true;
      return performance.now() - waitingSince > DEMO_OFFER_AFTER_MS;
    }

    function overEyebrow() {
      return `${S.selfPlay ? 'demo · ' : ''}round ${S.roundNum} · you ${S.score.hider} — agent ${S.score.seeker}`;
    }

    function renderActions() {
      if (S.agentCalls !== agentCallsSeen) {
        agentCallsSeen = S.agentCalls;
        waitingSince = performance.now(); // an agent is alive — no need to offer the demo
      }
      const over = S.phase === 'over';
      const mode = over && S.selfPlay ? 'demo-again' : over && !S.humanReady ? 'ready' : 'waiting';
      const offer = mode === 'waiting' && demoOffered();
      const key = `${mode}|${over}|${offer}`;
      if (key === actionsKey) return;
      actionsKey = key;
      ui.overlayBtn.hidden = mode === 'waiting';
      ui.overlayWait.hidden = mode !== 'waiting';
      ui.overlayDemo.hidden = !offer;
      if (mode === 'demo-again') ui.overlayBtn.textContent = 'Play another demo round';
      if (mode === 'ready') ui.overlayBtn.textContent = 'Ready';
      ui.overlayWaitText.textContent = over ? 'Waiting for agent to start next round' : 'Waiting for agent to start';
      if (over) ui.overlayEyebrow.textContent = overEyebrow(); // "demo ·" comes and goes with the mode
    }

    // the favicon is the logo in miniature: the 2+1 cone in teal, or the
    // 3+1 cone in violet once the game has become HYPERCONE
    function faviconFor(name) {
      const hyper = name === 'HYPERCONE';
      const c = hyper ? '%23b26bff' : '%235df2d6';
      const cone = hyper
        ? `<polygon points='12,12 3,3.4 21,3.4' fill='${c}'/><ellipse cx='12' cy='3.4' rx='9' ry='2.4' fill='none' stroke='white' stroke-width='1.2'/>` +
          `<polygon points='12,12 3,20.6 21,20.6' fill='${c}' fill-opacity='.35'/><ellipse cx='12' cy='20.6' rx='9' ry='2.4' fill='none' stroke='white' stroke-opacity='.55' stroke-width='1.2'/>`
        : `<polygon points='12,12 2.5,0.5 21.5,0.5' fill='${c}'/><polygon points='12,12 2.5,23.5 21.5,23.5' fill='${c}' fill-opacity='.35'/>`;
      return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${cone}<circle cx='12' cy='12' r='1.8' fill='white'/></svg>`;
    }

    // the name follows the geometry: LIGHTCONE while everyone is on the plane,
    // HYPERCONE from the moment the seeker or the hider steps beside the world
    function syncName() {
      const name = eng.gameName();
      if (name === lastName) return;
      const first = lastName === '';
      lastName = name;
      ui.brandName.textContent = name;
      document.title = `${name} · WebMCP Hide & Seek`;
      ui.favicon.href = faviconFor(name);
      ui.brand.classList.toggle('ascended', name === 'HYPERCONE');
      if (ui.overlayTitle.textContent === 'LIGHTCONE' || ui.overlayTitle.textContent === 'HYPERCONE') {
        ui.overlayTitle.textContent = name;
      }
      if (!first) {
        ui.brandName.classList.remove('renamed');
        void ui.brandName.offsetWidth; // restart the animation
        ui.brandName.classList.add('renamed');
      }
    }

    function fmtTime(s) {
      const m = Math.floor(s / 60);
      const ss = Math.max(0, Math.floor(s % 60));
      return `${m}:${String(ss).padStart(2, '0')}`;
    }

    function hud() {
      const h = S.hider, sk = S.seeker;
      syncName();

      const left = S.phase === 'play' ? Math.max(0, S.roundEndsAt - S.t) : CFG.ROUND_SECONDS;
      ui.timer.textContent = fmtTime(S.phase === 'play' ? left : CFG.ROUND_SECONDS);
      ui.timer.classList.toggle('low', S.phase === 'play' && left <= 30 && !S.clockFrozen);
      // while anyone stands beside the world, time declines to pass
      ui.timer.classList.toggle('frozen', S.phase === 'play' && S.clockFrozen);
      ui.scoreH.textContent = S.score.hider;
      ui.scoreS.textContent = S.score.seeker;

      ui.energyFill.style.width = (h.energy / CFG.ENERGY_MAX) * 100 + '%';
      ui.energyNum.textContent = Math.floor(h.energy);

      const costs = { wall: CFG.WALL_COST, decoy: CFG.DECOY_COST, scrub: CFG.SCRUB_COST, floor: CFG.FLOOR_COST };
      ui.abilities.forEach((b) => {
        b.disabled = S.phase !== 'play' || h.energy < costs[b.dataset.mode];
      });

      // the fourth ability does not exist — until, suddenly, it does
      if (S.meta.hider.unlocked && ui.floorBtn.hidden) {
        ui.floorBtn.hidden = false;
        ui.floorBtn.classList.add('reveal');
      }

      // once the round is running, the agent instruction folds down to its
      // icon (hover to unfold, click still copies)
      ui.agentLine.classList.toggle('collapsed', S.phase === 'countdown' || S.phase === 'play');

      // a glimpse of whatever code the machine just recovered — or, in
      // amber, whatever code the machine just wrote for itself
      const gl = S.glimpse;
      if (gl && S.t < gl.until) {
        ui.glimpse.hidden = false;
        const chars = Math.max(0, Math.floor((S.t - gl.t0) * 180));
        ui.glimpse.textContent = gl.text.slice(0, chars) + (chars < gl.text.length ? '▌' : '');
        ui.glimpse.classList.toggle('bot', gl.kind === 'bot');
        ui.glimpse.classList.toggle('fading', gl.until - S.t < 1.2);
        // the pane never hides the player: when your light is beneath it,
        // the terminal turns to glass until you step out
        const cr = canvas.getBoundingClientRect();
        const gr = ui.glimpse.getBoundingClientRect();
        const hx = cr.left + (S.hider.x / CFG.COLS) * cr.width;
        const hy = cr.top + (S.hider.y / CFG.ROWS) * cr.height;
        const pad = 26;
        ui.glimpse.classList.toggle('ghost',
          hx > gr.left - pad && hx < gr.right + pad && hy > gr.top - pad && hy < gr.bottom + pad);
      } else {
        ui.glimpse.hidden = true;
        ui.glimpse.classList.remove('fading', 'ghost');
      }

      drainFeed();

      // taunt bubble
      if (S.taunt) {
        ui.taunt.hidden = false;
        ui.taunt.textContent = S.taunt.text;
        const scaleX = canvas.offsetWidth / (CFG.COLS * CFG.TILE);
        const scaleY = canvas.offsetHeight / (CFG.ROWS * CFG.TILE);
        ui.taunt.style.left = sk.fx * CFG.TILE * scaleX + 'px';
        ui.taunt.style.top = sk.fy * CFG.TILE * scaleY + 'px';
      } else {
        ui.taunt.hidden = true;
      }

      // overlays
      if (S.phase !== lastPhase) {
        lastPhase = S.phase;
        overlayToken++;
        const reveal = () => {
          ui.overlay.classList.toggle('hidden', S.phase === 'play');
          ui.overlayCard.style.display = S.phase === 'countdown' ? 'none' : '';
          ui.countdown.hidden = S.phase !== 'countdown';

          if (S.phase === 'over') {
            ui.cast.hidden = true; // the legend is for first contact only
            const won = S.winner === 'hider';
            ui.overlayEyebrow.textContent = overEyebrow();
            ui.overlayTitle.textContent = won ? 'YOU ESCAPED' : 'CAUGHT';
            ui.overlayTitle.className = 'overlay-title ' + (won ? 'escaped' : 'caught');
            ui.overlaySub.textContent = S.winReason;
          }
          revealedPhase = S.phase;
          if (S.phase === 'lobby' || S.phase === 'over') renderActions();
        };
        if (S.phase === 'over' && S.winner === 'seeker') {
          // hold the verdict: the kill plays out in slow motion first
          const tok = overlayToken;
          setTimeout(() => { if (tok === overlayToken && S.phase === 'over') reveal(); }, 1700);
        } else {
          reveal();
        }
      }
      // the card's action follows Ready, the demo offer and agent presence live
      if (revealedPhase === S.phase && (S.phase === 'lobby' || S.phase === 'over')) renderActions();
      if (S.phase === 'countdown') {
        const n = Math.max(1, Math.ceil(S.countdownEndsAt - S.t));
        ui.countdown.textContent = n;
        if (n !== lastCount) { lastCount = n; HS.sfx.play('count'); }
      }
    }

    // ── frame loop ──
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pollMoveInput();
      eng.update(dt);
      HS.render.draw(view);
      hud();
      HS.sfx.score(S);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();
