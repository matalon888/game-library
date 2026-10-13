/* LIGHTCONE · demo director (dev only, ?demo query param).
   Plays BOTH sides on rails: the hider via the real player APIs, the seeker
   via the real webmcp tool surface — so every mechanic fires exactly as it
   would in a live match. Never active without the query param. */
(function () {
  window.HS = window.HS || {};

  const ABORT = { demo: 'aborted' };
  let gen = 0;
  let idx = 0;
  let driverTimer = null;
  let hiderPlan = [];
  let savedCfg = null;
  let bar = null, barTitle = null, barStep = null;

  const eng = () => HS.engine;
  const S = () => HS.engine.state;
  const CFG = () => HS.engine.CFG;

  const api = {
    active: false,
    drivingHider: false,
    _speed: 1, // waits multiply by this; tests shrink it
    start, stop, next, startFrom,
  };
  HS.demo = api;

  // ── plumbing ─────────────────────────────────────────────────────────
  function wait(ms) {
    const g = gen;
    return new Promise((res, rej) => setTimeout(() => (g === gen ? res() : rej(ABORT)), ms * api._speed));
  }

  async function act(name, args) {
    for (let i = 0; i < 60; i++) {
      if (!api.active) throw ABORT;
      const r = window.webmcp.call(name, args);
      if (r.ok) return r;
      if (r.phase) { await ensurePlay(); await wait(300); continue; }
      await wait(Math.min(3000, ((r.retry_in_seconds || 0.4) * 1000) + 80));
    }
    return { ok: false, error: 'demo act timeout' };
  }

  async function ensurePlay() {
    if (S().phase === 'play') return;
    eng().startRound();
    S().countdownEndsAt = S().t; // dev shortcut: skip the countdown
    await wait(200);
  }

  // narration lives in the demo bar only — the board is the agent's stage
  function say(step) {
    if (barStep) barStep.textContent = step;
  }

  // a thought through the real tool — ignore cooldown refusals
  async function think(thought) {
    try { await act('think', { thought }); } catch (e) { if (e === ABORT) throw e; }
  }
  // a realization, said out loud — the agent's voice for a discovery
  async function realize(text) {
    try { await act('realize', { text }); } catch (e) { if (e === ABORT) throw e; }
  }

  function title(text) {
    if (barTitle) barTitle.textContent = text;
  }

  // ── stage management (dev-only privileged access to state) ──────────
  function arena(wallCells) {
    const st = S();
    st.baseWalls = new Set(wallCells.map(([x, y]) => x + ',' + y));
    st.playerWalls = [];
    st.wallSet = new Set(st.baseWalls);
    st.wallsVersion++;
  }

  function cleanStage() {
    const st = S();
    st.scent = []; st.decoys = []; st.events = []; st.pings = [];
    st.hider.energy = CFG().ENERGY_MAX;
    st.hider.dim = false; st.hider.z = 0; st.hider.fz = 0;
    st.seeker.stunnedUntil = 0; st.seeker.z = 0; st.seeker.fz = 0;
    st.bot = null; st.seeker.deployReadyAt = 0; st.strikeNote = null;
    st.seeker.drive = null; st.seeker.driveTo = null;
    hiderPlan = [];
    st.hider.moveX = 0; st.hider.moveY = 0;
  }

  // newest frame carrying a given sense, from a status result
  function lastWith(frames, key2) {
    for (let i = frames.length - 1; i >= 0; i--) if (frames[i][key2]) return frames[i];
    return null;
  }

  async function untilBotActs(n, timeoutMs) {
    const t0 = Date.now();
    const base = S().bot ? S().bot.acts : 0;
    while (S().phase === 'play' && (S().bot ? S().bot.acts : 0) < base + n) {
      if (Date.now() - t0 > timeoutMs * api._speed) break;
      await wait(250);
    }
  }

  function setSeeker(x, y) {
    const sk = S().seeker;
    sk.x = x + 0.5; sk.y = y + 0.5; sk.fx = x + 0.5; sk.fy = y + 0.5;
    sk.lastCell = x + ',' + y; sk.drive = null; sk.driveTo = null; sk.pounce = null;
  }

  function setHider(x, y) {
    S().hider.x = x; S().hider.y = y;
    S().meta.hider.lastCell = Math.floor(x) + ',' + Math.floor(y);
  }

  function resetSeekerMeta(fragments) {
    const m = S().meta;
    m.fragments = fragments;
    m.seeker = { v: -1, rot: 0, links: 0, laps: 0, unlocked: false };
    m.glitch = 0;
  }

  function walkHider(waypoints) { hiderPlan = waypoints.slice(); }

  function hiderArrived() { return hiderPlan.length === 0; }

  async function untilHiderArrives(timeoutMs) {
    const t0 = Date.now();
    while (!hiderArrived()) {
      if (Date.now() - t0 > timeoutMs * api._speed) break;
      await wait(120);
    }
  }

  function driverTick() {
    if (!api.active) return;
    const h = S().hider;
    if (S().phase !== 'play' || !hiderPlan.length) { h.moveX = 0; h.moveY = 0; return; }
    const [wx, wy] = hiderPlan[0];
    const dx = wx - h.x, dy = wy - h.y;
    if (Math.hypot(dx, dy) < 0.22) {
      hiderPlan.shift();
      h.moveX = 0; h.moveY = 0;
      return;
    }
    h.moveX = Math.abs(dx) > 0.08 ? Math.sign(dx) : 0;
    h.moveY = Math.abs(dy) > 0.08 ? Math.sign(dy) : 0;
  }

  // ── the scenarios ────────────────────────────────────────────────────
  const SCENARIOS = [
    {
      name: '1 · The hunt — frames, scent flow, auto-sonar',
      async run() {
        await ensurePlay();
        cleanStage();
        arena([[8, 4], [8, 11], [15, 4], [15, 11]]);
        setHider(18.5, 8.5);
        setSeeker(4, 8);
        say('the hider walks — magenta scent accumulates behind it');
        walkHider([[18.5, 4.5], [12.5, 4.5], [12.5, 12.5], [17.5, 12.5]]);
        await wait(4000);
        say('the seeker never asks to look — its senses record a frame every second');
        let lastDir = null;
        for (let i = 0; i < 9 && S().phase === 'play'; i++) {
          const st = await act('status');
          const fs = st.frames || [];
          const fSon = lastWith(fs, 'sonar_distance');
          if (fSon) say(`auto-sonar: exactly ${fSon.sonar_distance} tiles — the radar fires itself, and the hider saw the ring`);
          const fSc = lastWith(fs, 'scent');
          const dir = fSc && (fSc.scent.flow || fSc.scent.gradient);
          if (dir) say(`frames: scent ${fSc.scent.strength}/10, ${fSc.scent.flow ? 'flowing ' + dir : 'gradient ' + dir}`);
          if (dir && dir !== lastDir) { lastDir = dir; await think(`trail. it flows ${dir}.`); }
          if (fSc && fSc.scent.strength >= 7) {
            say('the scent is burning — one more step and the reflex would end it. the demo moves on');
            await think('close. so close.');
            break;
          }
          await act('move', { direction: dir || 'e', steps: 3 });
          await wait(500);
        }
        await wait(1500);
      },
    },
    {
      name: '2 · Noise betrays — every action is loud',
      async run() {
        await ensurePlay();
        cleanStage();
        arena([]);
        setHider(19.5, 12.5);
        setSeeker(5, 4);
        say('the hider builds a wall — construction ripples outward');
        eng().placeWall(17, 12);
        await wait(1800);
        let st = await act('status');
        let fSnd = lastWith(st.frames || [], 'sounds');
        if (fSnd) {
          const snd = fSnd.sounds[fSnd.sounds.length - 1];
          say(`a frame caught it: ${snd.heard} to the ${snd.direction} (${snd.distance})`);
          await think(`${snd.heard}? going ${snd.direction}.`);
          await act('move', { direction: snd.direction, steps: 3 });
          await act('move', { direction: snd.direction, steps: 3 });
        }
        say('the hider panics: a dash — rapid footsteps ring out');
        S().hider.moveX = -1;
        eng().tryDash();
        await wait(900);
        S().hider.moveX = 0;
        say('…then tries to scrub the trail — the hiss gives that away too');
        eng().scrubAt(Math.floor(S().hider.x), Math.floor(S().hider.y));
        await wait(1500);
        st = await act('status');
        fSnd = lastWith(st.frames || [], 'sounds');
        if (fSnd) {
          const snd = fSnd.sounds[fSnd.sounds.length - 1];
          say(`heard again: ${snd.heard}, ${snd.direction} — the seeker closes in`);
          await think('so loud. so careless.');
          await act('move', { direction: snd.direction, steps: 3 });
        }
        await wait(1500);
      },
    },
    {
      name: '3 · The decoy — the reflex lunges at a lie',
      async run() {
        await ensurePlay();
        cleanStage();
        arena([]);
        setHider(19.5, 4.5);
        setSeeker(7, 10);
        say('the hider plants a decoy and slips away holding its breath');
        eng().placeDecoy(14, 10);
        eng().setDim(true);
        walkHider([[20.5, 2.5]]);
        await act('move', { direction: 'e', steps: 1 }); // eyes face where you walk
        let glow = null;
        for (let i = 0; i < 8 && !glow; i++) { // frames land ~1/s — read again
          await wait(700);
          const st = await act('status');
          const fg = lastWith(st.frames || [], 'glows');
          glow = fg && fg.glows[0];
        }
        if (glow) {
          say(`a glow in the frames at [${glow.x},${glow.y}] — hider or lure? it cannot tell`);
          await think('a glow. or a lie?');
          await wait(1200);
          say('it steers closer — the strike is a reflex, nobody aims it…');
          for (let i = 0; i < 8; i++) {
            if (S().seeker.stunnedUntil > S().t || S().phase !== 'play') break;
            const dx = glow.x - S().seeker.x;
            await act('move', { direction: dx > 0 ? 'e' : 'w', steps: 2 });
            await wait(300);
          }
          if (S().seeker.stunnedUntil > S().t) {
            say('SHATTER — the reflex lunged at a lure. the seeker is stunned');
            await think('a decoy. clever prey.');
          }
        }
        eng().setDim(false);
        await wait(3000);
      },
    },
    {
      name: '4 · The daemon — the seeker rewrites itself',
      async run() {
        await ensurePlay();
        cleanStage();
        arena([]);
        setHider(19.5, 11.5);
        setSeeker(4, 4);
        say('the agent is slow between thoughts — so it writes itself a body');
        walkHider([
          [19.5, 3.5], [12.5, 3.5], [12.5, 11.5], [19.5, 11.5],
          [19.5, 3.5], [12.5, 3.5], [12.5, 11.5], [19.5, 11.5],
        ]);
        await think('too slow. writing a body.');
        const v1 = [
          '// daemon v1 — nose first; with no lead, explore the unseen',
          'const m = bot.mem; m.n = (m.n || 0) + 1;',
          'const f = bot.sense();',
          'if (f && f.scent) m.dir = f.scent.flow || f.scent.gradient || m.dir;',
          'else m.dir = bot.explore();',
          'const mv = bot.move(m.dir || bot.explore(), 3);',
          'if (mv.ok && mv.moved === 0) m.dir = null; // wall — explore around it',
          "bot.log('t' + m.n + ' ' + (m.dir || '?'));",
        ].join('\n');
        await act('deploy_daemon', { source: v1 });
        say('⟐ DAEMON v1 DEPLOYED — the amber pane is code the machine wrote for itself');
        await untilBotActs(6, 45000);
        const st = await act('status');
        const d = st.daemon || {};
        say(`it reads its own telemetry: ${d.ticks} ticks, ${d.actions} actions, ${d.errors} errors — log "${(d.log || []).slice(-1)[0] || ''}"`);
        await think('v1 wanders. needs eyes.');
        await wait(1800);
        const v2 = [
          '// daemon v2 — the body FLOWS now: continuous drive, dash when far.',
          'const m = bot.mem; m.n = (m.n || 0) + 1;',
          'const f = bot.sense(); const s = bot.self();',
          'let far = 0;',
          'if (f && f.glows && f.glows.length) {',
          '  const g = f.glows[0];',
          "  m.dir = (g.y + 0.5 > s.y ? 's' : g.y + 0.5 < s.y ? 'n' : '') +",
          "          (g.x + 0.5 > s.x ? 'e' : g.x + 0.5 < s.x ? 'w' : '');",
          '  far = Math.hypot(g.x + 0.5 - s.x, g.y + 0.5 - s.y);',
          "  if (m.dir && m.n % 4 === 0) bot.think('daemon: glow ' + m.dir);",
          '} else if (f && f.scent) {',
          '  m.dir = f.scent.flow || f.scent.gradient || m.dir;',
          '} else { m.dir = bot.explore(); }',
          "if (far >= 5 && s.ap >= 2) bot.dash(m.dir || 'e');",
          "else bot.drive(m.dir || bot.explore());",
          "bot.log('t' + m.n + ' ' + (m.dir || '?'));",
        ].join('\n');
        await act('deploy_daemon', { source: v2 });
        say('⟐ REWRITE — daemon v2 flows: continuous drive, dash bursts; the human is told every time');
        await wait(6000); // watch the body glide on its own
        if (S().phase !== 'play') {
          say('…the daemon body walked into its prey — the reflex ended the round');
        } else {
          say("the daemon hunts while the mind thinks — and v2 kept v1's memory");
        }
        await think('the body hunts. I decide.');
        await act('halt_daemon');
        say('halt_daemon — the body is quiet again');
        await wait(2000);
      },
    },
    {
      name: '5 · Glyphs — the floor remembers its source',
      async run() {
        await ensurePlay();
        cleanStage();
        arena([]);
        resetSeekerMeta(0);
        S().meta.glyphs = [[6, 8], [10, 8], [14, 8], [18, 8], [18, 12]]
          .map(([x, y], i) => ({ x, y, idx: i, found: false }));
        setSeeker(4, 8);
        say('faint violet runes flicker on the floor — the seeker steps onto one');
        const hops = [['e', 2], ['e', 3], ['e', 1], ['e', 3], ['e', 1], ['e', 3], ['e', 1], ['s', 3], ['s', 1]];
        for (const [d, n] of hops) {
          const mv = await act('move', { direction: d, steps: n });
          if (mv.recovered_fragment) {
            const fr = mv.recovered_fragment;
            say(`fragment ${fr.index}/${fr.total} recovered — real engine source, next glyph at [${fr.next_glyph_at || 'none'}]`);
            await think(`fragment ${fr.index}/${fr.total}. reading…`);
            console.log(`%c[demo] recovered fragment ${fr.index}/${fr.total}:\n%c${fr.source}`,
              'color:#b26bff;font-weight:bold', 'color:#8a8fa8');
            await wait(2200);
          }
        }
        say('all five fragments read — the code describes a triangle of three cells');
        await think('the code hides a shape.');
        await wait(2500);
      },
    },
    {
      name: '6 · The lightcone — three corners, three laps, then rise',
      async run() {
        await ensurePlay();
        cleanStage();
        resetSeekerMeta(CFG().GLYPH_COUNT);
        S().meta.glyphs = [];
        // a wall line between hunter and prey, to be risen over
        const wall = [];
        for (let y = 3; y <= 13; y++) wall.push([17, y]);
        arena(wall);
        const V = eng().lightcone('seeker'); // apex, base-left, base-right
        setSeeker(V[0][0], V[0][1] - 1);
        setHider(20.5, 8.5);
        say('it read the source: three cells form a lightcone. it steps onto the apex—');
        await think('the code named three cells.');
        await act('move', { direction: 's', steps: 1 }); // onto the apex: a rune ignites
        say('a rune ignites underfoot — now edge to edge, without straying');
        await wait(900);
        for (let lap = 1; lap <= CFG().TRI_REPS; lap++) {
          await act('move', { direction: 'sw', steps: 3 });
          await act('move', { direction: 'e', steps: 3 });
          await act('move', { direction: 'e', steps: 3 });
          await act('move', { direction: 'nw', steps: 3 });
          if (lap < CFG().TRI_REPS) {
            say(`lap ${lap}/3 — the lines between the vertices burn brighter`);
            await think(lap === 1 ? 'the lines are forming.' : 'brighter. once more.');
            await wait(700);
          }
        }
        say('ASCENSION — the seeker steps beside the world');
        await realize('Wait — there is a hidden dimension to this game.');
        await wait(2600);
        const up = await act('move', { direction: 'up', steps: 2 });
        say(`risen to z=${up.z} — its light lifts off the floor and becomes a real cone`);
        await wait(1800);
        const st = await act('status');
        const fG = lastWith(st.frames || [], 'glows');
        say(`elevated frames: ${fG ? fG.glows.length : 0} glow(s) visible THROUGH the wall line`);
        await think('I see over the walls.');
        await wait(1800);
        // the air belongs to a daemon: soar() flies straight at the glow, leads its run, lands beside it
        say('a daemon can fly now — bot.soar() takes the wheel: straight over the wall, then down beside the glow');
        const dep = await act('deploy_daemon', { source: "bot.log('✈ ' + bot.soar());" });
        if (dep.ok) {
          await think('the air is mine now.');
          const t0 = Date.now();
          while (S().phase === 'play' && Date.now() - t0 < 14000 * api._speed) await wait(250);
        }
        if (S().phase === 'play') { // the slow way, by hand — what an agent without a flying daemon is left with
          await act('halt_daemon');
          await act('move', { direction: 'se', steps: 3 });
          await act('move', { direction: 'se', steps: 1 });
          await act('move', { direction: 'e', steps: 3 });
          say('it glides over the wall — but the reflex only strikes on the plane');
          await wait(1200);
          await act('move', { direction: 'down', steps: 3 });
          say('landed. closing in — nobody aims the strike');
          for (let i = 0; i < 6 && S().phase === 'play'; i++) {
            const dx = S().hider.x - S().seeker.x;
            await act('move', { direction: dx > 0 ? 'e' : 'w', steps: 2 });
            await wait(300);
          }
        }
        say(S().phase === 'over' ? 'CAPTURE — proximity was all it ever needed' : 'the hunt goes on…');
        await wait(3500);
      },
    },
    {
      name: '7 · The mirror — the hider has a lightcone too',
      async run() {
        await ensurePlay();
        cleanStage();
        arena([]);
        S().meta.hider = { v: -1, rot: 0, links: 0, laps: 0, unlocked: false, lastCell: null };
        setSeeker(4, 4);
        setHider(13.5, 10.5);
        await wait(500);
        say('the hider walks its own triangle — apex down, three laps, on foot');
        const V = eng().lightcone('hider'); // apex-down, base-left, base-right
        const c = ([x, y]) => [x + 0.5, y + 0.5];
        const path = [c(V[1])];
        for (let lap = 0; lap < CFG().TRI_REPS; lap++) path.push(c(V[2]), c(V[0]), c(V[1]));
        walkHider(path);
        await untilHiderArrives(60000);
        if (S().meta.hider.unlocked) {
          say('YOU STEP BESIDE THE WORLD — the hider rises (E/Q in a real game)');
          eng().shiftHiderPlane(1);
          await wait(1500);
          say('off-plane: no scent — and the reflex passes straight through…');
          const hx = Math.floor(S().hider.x), hy = Math.floor(S().hider.y);
          setSeeker(hx + 2, hy);
          await act('move', { direction: 'w', steps: 1 }); // within reach: the reflex lunges
          await wait(600);
          say('claws pass through empty space — the seeker is stunned');
          await think('nothing there. impossible.');
          await wait(2000);
          say('…but the plane charges rent: energy burns until it pulls you back');
          walkHider([[Math.min(CFG().COLS - 2, hx + 4) + 0.5, hy + 0.5]]); // drift while aloft
          await untilHiderArrives(20000);
          S().hider.energy = 12;
          for (let i = 0; i < 40 && S().hider.z !== 0; i++) await wait(300);
          if (S().hider.z === 0) say('the plane reclaimed the hider — rent came due');
          await wait(1500);
          // the last gift: the ascended can hang floors above the world
          say('one more gift: the hider hangs a FLOOR over its head');
          S().hider.energy = 100;
          const fx0 = Math.floor(S().hider.x), fy0 = Math.floor(S().hider.y);
          eng().placeFloor(fx0, fy0);
          await wait(1200);
          say('the seeker rises to look straight down — the slab shades the glow');
          S().seeker.stunnedUntil = 0; // dev shortcut: shake off the stun for the finale
          await act('status'); // drain the frame buffer; only elevated frames follow
          await act('move', { direction: 'up', steps: 2 });
          await wait(1500); // let elevated frames land
          const st7 = await act('status');
          const fT = lastWith(st7.frames || [], 'glows');
          const seen = fT && fT.glows.some((g) => g.x === fx0 && g.y === fy0);
          say(seen
            ? 'the glow still shows — the slab failed?'
            : 'from above: no glow in the frames. the light stops at the hovering floor');
          await think('the light… stops there.');
          await wait(1800);
          await act('move', { direction: 'down', steps: 2 });
        } else {
          say('mirror triangle demo did not complete — skipping');
        }
        await wait(2000);
      },
    },
  ];

  // ── runner & controls ────────────────────────────────────────────────
  async function runFrom(startIdx, opts) {
    const g = ++gen;
    idx = startIdx;
    for (;;) {
      for (; idx < SCENARIOS.length; idx++) {
        if (g !== gen) return;
        const sc = SCENARIOS[idx];
        title(sc.name);
        try {
          await sc.run();
        } catch (e) {
          if (e === ABORT || g !== gen) return;
          console.error('[demo] scenario error:', e);
        }
      }
      if (opts && opts.once) { title('demo complete'); say('all scenarios shown'); return; }
      title('demo complete — looping');
      say('restarting the tour in a moment');
      try { await wait(4000); } catch (e) { return; }
      idx = 0;
    }
  }

  function applyTempo() {
    savedCfg = { ap: CFG().AP_REGEN_SECONDS, floor: CFG().TOOL_MIN_INTERVAL };
    CFG().AP_REGEN_SECONDS = 0.9;   // demo tempo: same rules, faster metronome
    CFG().TOOL_MIN_INTERVAL = 0.35;
  }

  function restoreTempo() {
    if (!savedCfg) return;
    CFG().AP_REGEN_SECONDS = savedCfg.ap;
    CFG().TOOL_MIN_INTERVAL = savedCfg.floor;
    savedCfg = null;
  }

  function start(opts) {
    if (api.active) return Promise.resolve();
    api.active = true;
    api.drivingHider = true;
    applyTempo();
    if (!driverTimer) driverTimer = setInterval(driverTick, Math.max(16, 80 * api._speed));
    buildBar();
    return runFrom(0, opts);
  }

  function startFrom(i, opts) {
    if (!api.active) return start(opts);
    return runFrom(Math.max(0, Math.min(SCENARIOS.length - 1, i)), opts);
  }

  function next() { startFrom(idx + 1); }

  function stop() {
    gen++;
    api.active = false;
    api.drivingHider = false;
    hiderPlan = [];
    S().hider.moveX = 0; S().hider.moveY = 0;
    if (driverTimer) { clearInterval(driverTimer); driverTimer = null; }
    restoreTempo();
    title('demo stopped');
    say('press restart to run the tour again');
  }

  // ── dev bar (browser only) ───────────────────────────────────────────
  function buildBar() {
    if (bar || typeof document === 'undefined' || !document.body) return;
    const css = document.createElement('style');
    css.textContent = `
      #demoBar { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
        z-index: 60; display: flex; align-items: center; gap: 12px;
        background: rgba(10, 6, 20, 0.88); border: 1px solid rgba(178, 107, 255, 0.5);
        border-radius: 8px; padding: 8px 14px; backdrop-filter: blur(5px);
        box-shadow: 0 0 24px rgba(178, 107, 255, 0.25); max-width: 92vw; }
      #demoBar .db-badge { font-family: var(--display, monospace); font-size: 9px;
        letter-spacing: 0.3em; color: #b26bff; border: 1px solid rgba(178,107,255,.5);
        border-radius: 4px; padding: 2px 7px; white-space: nowrap; }
      #demoBar .db-text { min-width: 0; }
      #demoBar .db-title { font-family: var(--mono, monospace); font-size: 11px; color: #d2aaff; }
      #demoBar .db-step { font-size: 11px; color: var(--text, #c8d2e8); opacity: .85;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46vw; }
      #demoBar button { background: none; border: 1px solid var(--line, #1b2138);
        color: var(--text, #c8d2e8); border-radius: 5px; font-size: 11px;
        padding: 3px 9px; cursor: pointer; }
      #demoBar button:hover { border-color: #b26bff; color: #d2aaff; }`;
    document.head.appendChild(css);
    bar = document.createElement('div');
    bar.id = 'demoBar';
    const badge = document.createElement('span');
    badge.className = 'db-badge';
    badge.textContent = 'DEMO';
    const text = document.createElement('div');
    text.className = 'db-text';
    barTitle = document.createElement('div');
    barTitle.className = 'db-title';
    barStep = document.createElement('div');
    barStep.className = 'db-step';
    text.appendChild(barTitle);
    text.appendChild(barStep);
    const btnNext = document.createElement('button');
    btnNext.textContent = 'Next ⏭';
    btnNext.addEventListener('click', next);
    const btnRestart = document.createElement('button');
    btnRestart.textContent = 'Restart ⟳';
    btnRestart.addEventListener('click', () => (api.active ? startFrom(0) : start()));
    const btnStop = document.createElement('button');
    btnStop.textContent = 'Stop ✕';
    btnStop.addEventListener('click', stop);
    bar.appendChild(badge);
    bar.appendChild(text);
    bar.appendChild(btnNext);
    bar.appendChild(btnRestart);
    bar.appendChild(btnStop);
    document.body.appendChild(bar);
  }

  // auto-start only in a browser with the dev query param
  if (typeof document !== 'undefined' && typeof location !== 'undefined') {
    const params = new URLSearchParams(location.search || '');
    if (params.has('demo') || params.has('dev')) {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => start(), 600);
      });
    }
  }
})();
