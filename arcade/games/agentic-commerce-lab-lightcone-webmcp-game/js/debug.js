/* LIGHTCONE · debug capture (?debug=1) — records the whole match into one
   downloadable JSON log: every tool call the agent makes (with the exact
   result it saw), every daemon action, log line and error, every sense frame
   the body records, all feed callouts, the human's actions, round starts and
   ends with the generated arena, and a once-per-second ground-truth snapshot
   of the board. Dev-only: fully inert without the query param, and never
   mentioned on any agent-facing surface. Console API: window.HSDEBUG. */
(function () {
  window.HS = window.HS || {};
  if (typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search || '');
  const flag = params.get('debug');
  if (flag === null || flag === '0' || flag === 'false') return;

  const eng = HS.engine;
  const S = eng.state;
  const CFG = eng.CFG;

  const startedAt = new Date();
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const t0 = clock();
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const OCTS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const octant = (a) => OCTS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];

  const MAX_EVENTS = 250000; // ~hours of play; the pill warns when saturated
  const events = [];
  let seq = 0;
  let dropped = 0;

  function clone(v) {
    if (v === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      return { unserializable: String((e && e.message) || e) };
    }
  }

  function log(type, data) {
    if (events.length >= MAX_EVENTS) { dropped++; return; }
    events.push({
      i: ++seq,
      rt: r2((clock() - t0) / 1000), // real seconds since page load
      t: r2(S.t),                    // engine time
      phase: S.phase,
      round: S.roundNum,
      type,
      data: clone(data),
    });
  }

  // the hook the engine and the tool surface report into
  HS.debug = { log };

  // ── ground truth: the whole board, as only the human sees it ─────────
  function triState(who) {
    const m = S.meta[who];
    return { v: m.v, links: m.links, laps: m.laps, unlocked: m.unlocked };
  }

  function truth() {
    const h = S.hider, sk = S.seeker;
    return {
      time_left: S.phase === 'play' ? Math.max(0, Math.round(S.roundEndsAt - S.t)) : null,
      clock_frozen: S.clockFrozen,
      unlock_grace: S.unlockCell !== null && S.unlockGraceUntil > S.t ? r1(S.unlockGraceUntil - S.t) : 0,
      hider: {
        x: r2(h.x), y: r2(h.y), z: h.z,
        energy: Math.round(h.energy), dim: h.dim, dashing: S.t < h.dashUntil,
      },
      seeker: {
        x: r2(sk.x), y: r2(sk.y), z: sk.z,
        ap: r1(sk.ap), facing: octant(sk.facing), mode: S.botMode,
        stunned_for: r1(Math.max(0, sk.stunnedUntil - S.t)),
        drive: sk.drive ? octant(Math.atan2(sk.drive[1], sk.drive[0])) : null,
        drive_to: sk.driveTo ? [r1(sk.driveTo[0]), r1(sk.driveTo[1])] : null,
        cells_visited: S.seekerVisits.size, cells_seen: S.seekerSeen ? S.seekerSeen.size : 0,
      },
      decoys: S.decoys.map((d) => [r1(d.x), r1(d.y)]),
      built_walls: S.playerWalls.map((w) => [w.x, w.y]),
      floors: S.floors.map((f) => [f.x, f.y]),
      scent_marks: S.scent.length,
      daemon: S.bot ? {
        gen: S.bot.gen, factory: !!S.bot.factory, halted: S.bot.halted,
        ticks: S.bot.ticks, acts: S.bot.acts, errs: S.bot.errs,
        blocked: S.bot.blocked, idle: S.bot.idle, wedged: S.bot.wedged, pacing: S.bot.pacing || 0,
      } : null,
      meta: {
        fragments: S.meta.fragments,
        glyphs_left: S.meta.glyphs.filter((g) => !g.found).length,
        seeker_tri: triState('seeker'),
        hider_tri: triState('hider'),
      },
    };
  }

  function arenaRows() {
    const rows = [];
    for (let y = 0; y < CFG.ROWS; y++) {
      let row = '';
      for (let x = 0; x < CFG.COLS; x++) row += S.baseWalls.has(eng.key(x, y)) ? '#' : '.';
      rows.push(row);
    }
    return rows;
  }

  // ── the frame-loop tap: transitions, feed, frames, 1 Hz snapshots ─────
  let lastPhase = S.phase;
  let lastFeedId = 0;
  let lastFrameI = 0;
  let lastSnapT = -99;
  let lastDim = S.hider.dim;
  let regLogged = false;

  const origUpdate = eng.update;
  eng.update = function (dt) {
    origUpdate(dt);

    if (S.phase !== lastPhase) {
      const from = lastPhase;
      lastPhase = S.phase;
      if (S.phase === 'countdown') {
        log('round_start', {
          round: S.roundNum,
          cols: CFG.COLS, rows: CFG.ROWS,
          arena: arenaRows(),
          glyphs: S.meta.glyphs.map((g) => ({ x: g.x, y: g.y, idx: g.idx })),
          score: S.score,
        });
      } else if (S.phase === 'play') {
        log('go', { round: S.roundNum, round_seconds: CFG.ROUND_SECONDS });
      } else if (S.phase === 'over') {
        log('round_end', {
          round: S.roundNum, winner: S.winner, reason: S.winReason,
          score: S.score, final: truth(),
        });
      } else {
        log('phase', { from, to: S.phase });
      }
    }

    // every callout the human saw, verbatim
    for (const entry of S.feed) {
      if (entry.id <= lastFeedId) continue;
      lastFeedId = entry.id;
      log('feed', { msg: entry.msg, cls: entry.cls, at: r2(entry.t) });
    }

    // every sense frame the body recorded — exactly what the agent can read
    for (const f of S.frames) {
      if (f.i <= lastFrameI) continue;
      lastFrameI = f.i;
      log('sense_frame', f);
    }

    // ground truth, once per second of play
    if (S.phase === 'play' && S.t - lastSnapT >= 1.0) {
      lastSnapT = S.t;
      log('state', truth());
    }

    // hold-breath is a held key, not a call — log the transitions
    if (S.hider.dim !== lastDim) {
      lastDim = S.hider.dim;
      log('hider_action', { action: 'hold_breath', on: lastDim });
    }

    if (!regLogged && HS.webmcp && HS.webmcp.registered) {
      regLogged = true;
      log('webmcp_registered', HS.webmcp.diagnostics ? HS.webmcp.diagnostics() : {});
    }

    refreshPill();
  };

  // ── the hider's actions (clicks and keys from main.js / the demo) ─────
  function wrapAction(name, action) {
    const orig = eng[name];
    eng[name] = function (...args) {
      const res = orig.apply(this, args);
      if (!res || res.why !== 'round not active') {
        log('hider_action', {
          action,
          ...(args.length ? { args } : {}),
          ok: !res || res.ok !== false,
          ...(res && res.why ? { why: res.why } : {}),
        });
      }
      return res;
    };
  }
  wrapAction('tryDash', 'dash');
  wrapAction('placeWall', 'wall');
  wrapAction('placeDecoy', 'decoy');
  wrapAction('scrubAt', 'scrub');
  wrapAction('placeFloor', 'floor');

  const origShift = eng.shiftHiderPlane;
  eng.shiftHiderPlane = function (dz) {
    const z0 = S.hider.z;
    origShift(dz);
    if (S.hider.z !== z0) log('hider_action', { action: 'plane_shift', dz, z: S.hider.z });
  };

  const origReady = eng.setHumanReady;
  eng.setHumanReady = function () {
    const did = origReady();
    if (did) log('hider_action', { action: 'ready' });
    return did;
  };

  const origSelfPlay = eng.startSelfPlay;
  eng.startSelfPlay = function () {
    const did = origSelfPlay();
    if (did) log('self_play_start', {});
    return did;
  };

  // ── export ────────────────────────────────────────────────────────────
  function payload() {
    return {
      game: 'LIGHTCONE debug log',
      captured_at: startedAt.toISOString(),
      exported_at: new Date().toISOString(),
      url: location.href,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      rounds_played: S.roundNum,
      score: clone(S.score),
      config: clone(CFG),
      event_count: events.length,
      dropped_events: dropped,
      events,
    };
  }

  function download() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([JSON.stringify(payload(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lightcone-debug-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  window.HSDEBUG = {
    events,
    payload,
    download,
    note: (text) => log('note', { text: String(text) }),
    clear: () => { events.length = 0; dropped = 0; },
  };

  log('boot', {
    url: location.href,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    secure_context: typeof window.isSecureContext === 'boolean' ? window.isSecureContext : null,
  });

  // ── the REC pill (browser only; bottom-right, clear of the other chrome) ─
  let pillCount = null;
  let shownCount = -1;

  function refreshPill() {
    if (!pillCount || events.length === shownCount) return;
    shownCount = events.length;
    pillCount.textContent = events.length.toLocaleString()
      + (dropped ? ` (+${dropped} dropped)` : '');
  }

  function buildPill() {
    if (pillCount || typeof document === 'undefined' || !document.body) return;
    const css = document.createElement('style');
    css.textContent = `
      #debugPill { position: fixed; bottom: 12px; right: 12px; z-index: 60;
        display: flex; align-items: center; gap: 9px;
        background: rgba(10, 6, 20, 0.88); border: 1px solid rgba(93, 242, 214, 0.4);
        border-radius: 8px; padding: 6px 10px; backdrop-filter: blur(5px);
        box-shadow: 0 0 18px rgba(93, 242, 214, 0.18);
        font-family: var(--mono, monospace); font-size: 11px; color: var(--text, #c8d2e8); }
      #debugPill .dbg-dot { width: 7px; height: 7px; border-radius: 50%; flex: none;
        background: #ff4f6b; box-shadow: 0 0 8px #ff4f6b; animation: dbgBlink 1.6s infinite; }
      @keyframes dbgBlink { 50% { opacity: 0.25; } }
      #debugPill .dbg-badge { font-family: var(--display, monospace); font-size: 9px;
        letter-spacing: 0.28em; color: #5df2d6; border: 1px solid rgba(93, 242, 214, 0.5);
        border-radius: 4px; padding: 2px 7px; white-space: nowrap; }
      #debugPill .dbg-count { min-width: 4ch; text-align: right; }
      #debugPill button { background: none; border: 1px solid var(--line, #1b2138);
        color: var(--text, #c8d2e8); border-radius: 5px; font-size: 11px;
        padding: 3px 9px; cursor: pointer; font-family: inherit; }
      #debugPill button:hover { border-color: #5df2d6; color: #9ff5e6; }`;
    document.head.appendChild(css);
    const pill = document.createElement('div');
    pill.id = 'debugPill';
    pill.title = 'Debug capture is on (?debug=1): every tool call, daemon action, '
      + 'sense frame and board change is being recorded. Console: HSDEBUG';
    const dot = document.createElement('span');
    dot.className = 'dbg-dot';
    const badge = document.createElement('span');
    badge.className = 'dbg-badge';
    badge.textContent = 'DEBUG';
    pillCount = document.createElement('span');
    pillCount.className = 'dbg-count';
    const btn = document.createElement('button');
    btn.textContent = '⬇ log';
    btn.title = 'Download the full debug log as JSON';
    btn.addEventListener('click', download);
    pill.appendChild(dot);
    pill.appendChild(badge);
    pill.appendChild(pillCount);
    pill.appendChild(btn);
    document.body.appendChild(pill);
    refreshPill();
  }
  buildPill();
})();
