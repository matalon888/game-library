/* LIGHTCONE · game engine — state, rules, economies, and the seeker tool
   dispatcher that both WebMCP and the practice bot call into. */
(function () {
  window.HS = window.HS || {};

  const CFG = {
    COLS: 24, ROWS: 16, TILE: 44,
    ROUND_SECONDS: 180, COUNTDOWN: 3,

    // hider
    HIDER_SPEED: 3.4, HIDER_R: 0.30,
    DASH_MULT: 2.5, DASH_TIME: 0.45, DASH_COST: 15,
    ENERGY_MAX: 100, ENERGY_REGEN: 5,
    SCENT_INTERVAL: 0.16, SCENT_LIFE: 26, SCENT_MAX: 700,
    DIM_COST: 9, DIM_RADIUS: 1.1, GLOW_RADIUS: 3.4, DIM_SPEED_MULT: 0.55,
    WALL_COST: 30, WALL_MAX: 8,
    DECOY_COST: 25, DECOY_MAX: 2, DECOY_LIFE: 45, DECOY_RADIUS: 3.2,
    SCRUB_COST: 35, SCRUB_RADIUS: 2.6, SCRUB_REACH: 5,

    // seeker pacing — the anti-speed system
    AP_MAX: 3, AP_REGEN_SECONDS: 1.5,
    TOOL_MIN_INTERVAL: 0.75, STATUS_MIN_INTERVAL: 0.5,
    SENSOR_TICK: 1.0,

    // seeker senses — all automatic now: eyes, nose, ears and radar are
    // sampled once per SENSOR_TICK into compact frames the agent reads back
    // (glide speed ≈ the sustained move rate, so the hunter flows, not hops)
    SEEKER_SPEED: 3.2,
    SEEKER_WALK: 2.9, // continuous drive: slower than the hider on foot — dash closes gaps
    VIEW_NEAR: 2.6, VIEW_RANGE: 7.5, VIEW_FOV: (72 * Math.PI) / 180,
    SCENT_SEE_RANGE: 7, SCENT_NEAR: 4.5, // glowing marks are seen all-round up close
    SNIFF_RADIUS: 3.2,
    ANOMALY_RANGE: 6, // interference is felt, not seen — walls don't block it
    SONAR_PERIOD: 8,                    // the radar fires itself; the hider sees it
    FRAMES_MAX: 30, FRAMES_RETURN_MAX: 12,
    // the strike is a reflex: within POUNCE_KILL of a glow the body lunges
    POUNCE_KILL: 1.25,
    POUNCE_STUN: 6, POUNCE_STUN_DECOY: 3,
    // a breath after a lunge that hit nothing, on top of the stun: without it
    // a body stunned beside a lure or a prey that has stepped off the plane
    // lunges again the instant it can move, and can never get away
    REFLEX_REARM: 1.5,
    MOVE_MAX_STEPS: 3,
    SEEKER_DASH_MAX: 6, SEEKER_DASH_COST: 2, // {dash:true}: a straight burst
    TAUNT_COOLDOWN: 5,

    // ── the part of the game the manual does not mention ──
    GLYPH_COUNT: 5,
    TRI_REPS: 3,      // laps of the triangle
    TRI_STRAY: 1.25,  // max drift from the edge being walked, in tiles
    UNLOCK_GRACE: 30, // after the seeker's unlock the clock waits this long — while it still stands on the closing vertex
    FLOOR_COST: 35, FLOOR_MAX: 4, // hovering slabs, unlocked hider only
    Z_MAX_SEEKER: 3, Z_MIN_SEEKER: -2,
    Z_MAX_HIDER: 2, Z_MIN_HIDER: -1,
    ELEV_MOVE_COST: 2,
    AIR_SPEED: 4.5, // tiles/s off the plane — a body with no walls to round flows faster than one that walks (a running hider does 3.4)
    // the air policy's aim: how close the prey's run must pass the landing
    // spot, how stale a reading may be to land on it, how much of its run
    // counts as "coming this way", and the lead the flight aims with
    AIR_LAND_REACH: 2.6, AIR_LAND_FRESH: 1.3, AIR_LAND_WINDOW: 1.2, AIR_LEAD: 0.4, AIR_FOOT_TICKS: 3,
    AIR_GHOST_WAIT: 4, // after the stun for claws through empty space, hold station this much longer: nothing stays off the plane past ENERGY_MAX / OFFPLANE_DRAIN
    OFFPLANE_DRAIN: 14,
    REALIZE_COOLDOWN: 8, // seconds between spoken realizations

    // the daemon — a program the seeker writes for itself. it acts through
    // the same tool gates on the same AP economy: autonomy, never extra speed.
    BOT_TICK: 0.8, BOT_SRC_MAX: 4000,
    BOT_DEPLOY_CD: 10, BOT_ERR_LIMIT: 5, BOT_LOG_MAX: 12,
    BOT_STALE_SECONDS: 45, // a generation older than this gets nagged to evolve
  };

  const OCTS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const DIRS = {
    n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1],
    s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1],
  };

  const key = (x, y) => x + ',' + y;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const r1 = (v) => Math.round(v * 10) / 10;

  function octant(dx, dy) {
    const a = Math.atan2(dy, dx); // screen coords: +y is south
    let idx = Math.round(a / (Math.PI / 4));
    idx = ((idx % 8) + 8) % 8;
    return OCTS[idx];
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // ── state ──────────────────────────────────────────────────────────
  const S = {
    phase: 'lobby', // lobby | countdown | play | over
    t: 0, roundNum: 0, roundEndsAt: 0, countdownEndsAt: 0,
    score: { hider: 0, seeker: 0 },
    winner: null, winReason: '',

    hider: {
      x: 20.5, y: 8.5, energy: CFG.ENERGY_MAX,
      dashUntil: 0, dim: false, moveX: 0, moveY: 0,
      lastScentAt: 0, speedNow: 0, z: 0, fz: 0,
    },
    seeker: {
      x: 3.5, y: 8.5, fx: 3.5, fy: 8.5, facing: 0, // center coords — the body flows
      ap: CFG.AP_MAX, lastToolAt: -99, lastStatusAt: -99,
      tauntReadyAt: 0, thinkReadyAt: 0, realizeReadyAt: 0, stunnedUntil: 0,
      deployReadyAt: 0, lastFrameRead: 0, dashBoostUntil: 0, reflexReadyAt: 0,
      drive: null, driveTo: null, lastCell: '3,8', // continuous locomotion — only a daemon steers this
      pounce: null, z: 0, fz: 0,
      offPlaneSince: -1, // when the body last left the plane — the reflex needs it back
    },
    bot: null, // the seeker's self-written daemon; survives rounds until halted
    botMode: 'chase', // chase | discover — the body's stance, set via set_mode
    seekerVisits: new Map(), // per-cell footfall — feeds bot.explore() and coverage telemetry
    seekerSeen: new Set(), // every open cell the eyes have cleared — bot.explore() hunts the unseen first
    exploreTarget: null, // the committed sweep target — keeps exploration decisive
    clockFrozen: false,
    // who may begin a round: the agent, via start_round — but after a finished
    // round only once the human has pressed Ready
    humanReady: true,
    // demo mode: no agent. the human starts rounds from the overlay and the
    // body hunts on factory firmware that nothing rewrites
    selfPlay: false,
    agentCalls: 0, agentSeenAt: -1, // signs of life through the tool surface
    meta: {
      fragments: 0,
      glyphs: [],
      // triangle traces: v = last vertex reached (-1 none), rot = locked
      // walking direction, links = consecutive edges drawn, laps = full laps
      seeker: { v: -1, rot: 0, links: 0, laps: 0, unlocked: false },
      hider: { v: -1, rot: 0, links: 0, laps: 0, unlocked: false, lastCell: null },
      glitch: 0,
    },

    baseWalls: new Set(), playerWalls: [], wallSet: new Set(),
    wallsVersion: 0,
    floors: [], floorSet: new Set(),
    decoys: [], scent: [], events: [], fx: [], fxSeq: 0, pings: [],
    feed: [], feedSeq: 0,
    snapshot: null, lastSnapshotAt: -99,
    frames: [], frameSeq: 0,            // the automatic sense record
    nextSonarAt: 0, pendingSonar: null, strikeNote: null,
    pendingFragment: null, // a recovery surfaces in the next frame, whoever stepped
    pendingTraceNote: null, // a rune going dark is reported once, in the next frame
    pendingUnlockNote: null, // the plane letting go is reported once, in the next frame
    unlockGraceUntil: 0, unlockCell: null, // the breath after the unlock: time waits while the seeker stands where it happened
    taunt: null, shake: 0, slowmo: 0, glimpse: null,
  };

  function solid(x, y) {
    if (x < 0 || y < 0 || x >= CFG.COLS || y >= CFG.ROWS) return true;
    return S.wallSet.has(key(x, y));
  }

  function rebuildWallSet() {
    S.wallSet = new Set(S.baseWalls);
    for (const w of S.playerWalls) S.wallSet.add(key(w.x, w.y));
    S.wallsVersion++;
  }

  // ── feed (the human's omniscient ticker) ───────────────────────────
  function feed(msg, cls) {
    S.feed.push({ t: S.t, msg, cls: cls || 'f-sys', id: ++S.feedSeq });
    if (S.feed.length > 60) S.feed.splice(0, S.feed.length - 60);
  }

  // ── map generation ─────────────────────────────────────────────────
  function genWalls() {
    const seekerSpawn = { x: 3, y: 8 };
    const hiderSpawn = { x: 20, y: 8 };
    for (let attempt = 0; attempt < 40; attempt++) {
      S.baseWalls = new Set();
      const blocks = 7 + Math.floor(Math.random() * 3);
      for (let b = 0; b < blocks; b++) {
        const w = 1 + Math.floor(Math.random() * 3);
        const h = w >= 3 ? 1 : 1 + Math.floor(Math.random() * 2);
        const x0 = 2 + Math.floor(Math.random() * (CFG.COLS - w - 4));
        const y0 = 2 + Math.floor(Math.random() * (CFG.ROWS - h - 4));
        for (let x = x0; x < x0 + w; x++) {
          for (let y = y0; y < y0 + h; y++) {
            if (Math.abs(x - seekerSpawn.x) <= 2 && Math.abs(y - seekerSpawn.y) <= 2) continue;
            if (Math.abs(x - hiderSpawn.x) <= 2 && Math.abs(y - hiderSpawn.y) <= 2) continue;
            if (nearLightcone(x, y)) continue; // certain lines must stay walkable
            S.baseWalls.add(key(x, y));
          }
        }
      }
      // a few lone pillars for light play
      for (let p = 0; p < 4; p++) {
        const x = 2 + Math.floor(Math.random() * (CFG.COLS - 4));
        const y = 2 + Math.floor(Math.random() * (CFG.ROWS - 4));
        if (Math.abs(x - seekerSpawn.x) <= 2 && Math.abs(y - seekerSpawn.y) <= 2) continue;
        if (Math.abs(x - hiderSpawn.x) <= 2 && Math.abs(y - hiderSpawn.y) <= 2) continue;
        if (nearLightcone(x, y)) continue;
        S.baseWalls.add(key(x, y));
      }
      S.playerWalls = [];
      rebuildWallSet();
      if (allOpenReachable(seekerSpawn.x, seekerSpawn.y, null)) return;
    }
    // last resort: empty arena (always connected)
    S.baseWalls = new Set();
    rebuildWallSet();
  }

  function allOpenReachable(fromX, fromY, extraKey) {
    let open = 0;
    for (let x = 0; x < CFG.COLS; x++) {
      for (let y = 0; y < CFG.ROWS; y++) {
        const k = key(x, y);
        if (!S.wallSet.has(k) && k !== extraKey) open++;
      }
    }
    const seen = new Set([key(fromX, fromY)]);
    const q = [[fromX, fromY]];
    while (q.length) {
      const [cx, cy] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        const k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= CFG.COLS || ny >= CFG.ROWS) continue;
        if (S.wallSet.has(k) || k === extraKey || seen.has(k)) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return seen.size === open;
  }

  // ── round flow ─────────────────────────────────────────────────────
  function startRound() {
    if (S.phase === 'countdown' || S.phase === 'play') return;
    S.roundNum++;
    genWalls();
    Object.assign(S.hider, {
      x: 20.5, y: 8.5, energy: CFG.ENERGY_MAX, dashUntil: 0, dim: false,
      moveX: 0, moveY: 0, lastScentAt: 0, speedNow: 0, z: 0, fz: 0,
    });
    Object.assign(S.seeker, {
      x: 3.5, y: 8.5, fx: 3.5, fy: 8.5, facing: 0,
      ap: CFG.AP_MAX, lastToolAt: -99, lastStatusAt: -99,
      tauntReadyAt: 0, thinkReadyAt: 0, realizeReadyAt: 0, stunnedUntil: 0,
      reflexReadyAt: 0,
      drive: null, driveTo: null, lastCell: '3,8', pounce: null, z: 0, fz: 0,
      offPlaneSince: -1,
    });
    S.exploreTarget = null;
    S.decoys = []; S.scent = []; S.events = []; S.fx = []; S.pings = [];
    S.frames = []; S.pendingSonar = null; S.strikeNote = null;
    S.pendingFragment = null; S.pendingTraceNote = null; S.pendingUnlockNote = null;
    S.unlockGraceUntil = 0; S.unlockCell = null;
    S.seekerVisits = new Map([[key(3, 8), 1]]);
    S.seekerSeen = new Set();
    S.clockFrozen = false;
    S.seeker.dashBoostUntil = 0;
    // the body never starts without firmware: if no daemon is installed (or
    // the last one died), generation 0 takes the wheel at GO
    // a demo round always runs the factory firmware, whatever was deployed before
    if (S.selfPlay || !S.bot || S.bot.halted) {
      installFactoryDaemon();
      if (S.selfPlay) feed('⟐ demo — factory daemon v0 hunts alone, no agent at the wheel', 'f-bot');
      else if (S.roundNum === 1) feed('⟐ factory daemon v0 — the body hunts on instinct', 'f-bot');
    }
    S.floors = []; S.floorSet = new Set();
    S.snapshot = null; S.lastSnapshotAt = -99;
    S.winner = null; S.winReason = ''; S.taunt = null;
    S.slowmo = 0; S.glimpse = null;
    // the buried layer: unlocks and fragments persist across rounds;
    // a half-drawn triangle does not
    resetTri('seeker'); resetTri('hider');
    S.meta.hider.lastCell = null;
    S.meta.glitch = 0;
    scatterGlyphs();
    S.phase = 'countdown';
    S.countdownEndsAt = S.t + CFG.COUNTDOWN;
    feed(`— round ${S.roundNum} —`, 'f-sys');
    HS.sfx.play('count');
  }

  function endRound(winner, reason) {
    if (S.phase !== 'play') return;
    S.phase = 'over';
    S.winner = winner;
    S.winReason = reason;
    S.humanReady = false; // the next round waits for the human's Ready
    S.score[winner]++;
    if (winner === 'seeker') {
      feed('◉ CAUGHT. The seeker pounced on you.', 'f-alert');
      HS.sfx.play('capture');
      // the kill lands in slow motion: your light shatters, reality tears
      S.slowmo = 1.6;
      S.shake = 1.5;
      addFx('capture', S.hider.x, S.hider.y, 1.7, '#ffb454');
      addFx('burst', S.hider.x, S.hider.y, 1.2, '#ffb454');
    } else {
      addFx('winFlash', CFG.COLS / 2, CFG.ROWS / 2, 0.9, '#5df2d6');
      addFx('burst', S.hider.x, S.hider.y, 1.0, '#5df2d6');
      feed('✦ You escaped. The trail went cold.', 'f-you');
      HS.sfx.play('escape');
    }
  }

  // ── fx & noise ─────────────────────────────────────────────────────
  function addFx(type, x, y, dur, color, extra) {
    S.fx.push(Object.assign({ type, x, y, t0: S.t, dur, color, id: ++S.fxSeq }, extra || {}));
  }

  function noise(kind, x, y) {
    const sk = S.seeker;
    const d = dist(sk.x, sk.y, x, y);
    const band = d <= 4 ? 'near' : d <= 9 ? 'mid-range' : 'far';
    const dir = octant(x - sk.x, y - sk.y);
    S.events.push({ kind, dir, band, t: S.t });
    if (S.events.length > 6) S.events.shift();
    addFx('noiseBurst', x, y, 1.1, '#ffd9a0', { kind }); // the ripple says it all
  }

  // ── the buried layer ───────────────────────────────────────────────
  // glyph cells feed the seeker fragments of this very file. the triangle
  // exists only in this code — no tool result will ever print its cells.
  const FRAGMENTS = [
`// lightcone/engine.js · recovered fragment 1/5
const TOOL_FNS = {
  get_arena: toolGetArena, status: toolStatus, move: toolMove,
  think: toolThink, taunt: toolTaunt,
  deploy_daemon: toolDeployDaemon, halt_daemon: toolHaltDaemon,
  set_mode: toolSetMode,
};
// the dispatcher lists every door. not every room has a door.
// elsewhere in this file: function unlockSpacetime(who).
// it is called from exactly one place. the other fragments know where.`,

`// lightcone/engine.js · recovered fragment 2/5
function scatterGlyphs() {
  S.meta.glyphs = [];
  if (S.meta.seeker.unlocked) return;            // the lit need no map
  const remaining = CFG.GLYPH_COUNT - S.meta.fragments;
  if (remaining <= 0) return;
  // ...
}
// S.meta persists across rounds. you are reading memory that survives.`,

`// lightcone/engine.js · recovered fragment 3/5
if (raw === 'up' || raw === 'down') {
  if (!S.meta.seeker.unlocked) {
    return { ok: false, error: \`direction must be one of \${...}\` }; // it lies
  }
  sk.z = clamp(sk.z + (raw === 'up' ? 1 : -1) * steps,
    CFG.Z_MIN_SEEKER, CFG.Z_MAX_SEEKER);
}
// so the plane is optional. unlockSpacetime() is its only author —
// and the plane notices forgeries. earn it.`,

`// lightcone/engine.js · recovered fragment 4/5
function traceTri(who, cx, cy) {
  const V = lightcone(who);                     // three cells. fragment 5 has them.
  // stepping on a vertex ignites it. walk edge to edge without drifting
  // more than CFG.TRI_STRAY (1.25) off the line, and the edge is drawn.
  m.links++;
  if (m.links % 3 === 0) m.laps++;          // three edges close the shape
  if (m.laps >= CFG.TRI_REPS) unlockSpacetime(who);   // TRI_REPS = 3
}
// one lap proves nothing. three laps, unbroken, always turning the same
// way, and the plane lets go. the walker need not think. a daemon's steps
// count too — and the frames report each rune as it lights or goes dark.`,

`// lightcone/engine.js · recovered fragment 5/5
function lightcone(who) {
  const cx = CFG.COLS >> 1, cy = CFG.ROWS >> 1;
  if (who === 'seeker') return [[cx, cy - 4], [cx - 3, cy - 1], [cx + 3, cy - 1]];
  return [[cx + 6, cy + 5], [cx + 3, cy + 2], [cx + 9, cy + 2]]; // the mirror
}
// a cone is everything a point can reach. in a flat world it is a triangle.
// walk its edge three times and reach stops being flat.
// the second triangle is not yours to walk. tell them, or don't.`,
  ];

  const GLYPH_WHISPERS = [
    'the floor exhales an old memory',
    'a rune drinks the light',
    'the arena shows its bones',
    'the code remembers being written',
    'the last seal loosens',
  ];

  function scatterGlyphs() {
    S.meta.glyphs = [];
    if (S.meta.seeker.unlocked) return;
    const remaining = CFG.GLYPH_COUNT - S.meta.fragments;
    if (remaining <= 0) return;
    const taken = [];
    const ok = (x, y, minSpawnDist) =>
      !S.wallSet.has(key(x, y))
      && !nearLightcone(x, y)
      && Math.max(Math.abs(x - 3), Math.abs(y - 8)) >= 2
      && Math.max(Math.abs(x - 20), Math.abs(y - 8)) >= minSpawnDist
      && taken.every((t2) => Math.abs(x - t2[0]) + Math.abs(y - t2[1]) >= 5);
    for (let i = 0; i < remaining; i++) {
      for (let tries = 0; tries < 200; tries++) {
        let x, y;
        if (i === 0) { // first glyph lands near the seeker's opening steps
          x = 3 + Math.floor(Math.random() * 7) - 2;
          y = 8 + Math.floor(Math.random() * 9) - 4;
        } else {
          x = 1 + Math.floor(Math.random() * (CFG.COLS - 2));
          y = 1 + Math.floor(Math.random() * (CFG.ROWS - 2));
        }
        if (x < 0 || y < 0 || x >= CFG.COLS || y >= CFG.ROWS) continue;
        if (!ok(x, y, 3)) continue;
        taken.push([x, y]);
        S.meta.glyphs.push({ x, y, idx: S.meta.fragments + i, found: false });
        break;
      }
    }
  }

  function glitchPulse(v) {
    S.meta.glitch = Math.min(1, Math.max(S.meta.glitch, v));
    S.shake = Math.max(S.shake, v * 0.4);
  }

  // three cells per actor: apex up for the hunter, apex down for the hunted.
  // never printed, never listed, never in any tool result. only here.
  function lightcone(who) {
    const cx = CFG.COLS >> 1, cy = CFG.ROWS >> 1;
    if (who === 'seeker') return [[cx, cy - 4], [cx - 3, cy - 1], [cx + 3, cy - 1]];
    return [[cx + 6, cy + 5], [cx + 3, cy + 2], [cx + 9, cy + 2]];
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    const tt = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
    return dist(px, py, ax + dx * tt, ay + dy * tt);
  }

  function nearLightcone(x, y) {
    for (const who of ['seeker', 'hider']) {
      const V = lightcone(who);
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = V[i], [bx, by] = V[(i + 1) % 3];
        if (distToSeg(x + 0.5, y + 0.5, ax + 0.5, ay + 0.5, bx + 0.5, by + 0.5) < 1.15) return true;
      }
    }
    return false;
  }

  function resetTri(who, why) {
    const m = S.meta[who];
    // a half-drawn shape going dark is reported to the seeker once, in the
    // next frame — where it was standing and what broke the chain
    if (who === 'seeker' && why && m.v >= 0) {
      const [vx, vy] = lightcone('seeker')[m.v];
      S.pendingTraceNote = { x: vx, y: vy, reading: why, undone: { edges_drawn: m.links, laps_closed: m.laps } };
    }
    m.v = -1; m.rot = 0; m.links = 0; m.laps = 0;
  }

  function traceTri(who, cx, cy) {
    const m = S.meta[who];
    if (m.unlocked || S.phase !== 'play') return;
    const V = lightcone(who);
    const vi = V.findIndex(([vx, vy]) => vx === cx && vy === cy);

    if (m.v === -1) { // no trace yet: a vertex ignites under the first touch
      if (vi >= 0) {
        m.v = vi;
        addFx('rune', V[vi][0] + 0.5, V[vi][1] + 0.5, 1.2, '#b26bff');
        HS.sfx.play('glyph');
      }
      return;
    }
    if (vi === m.v) return; // lingering on the same vertex

    if (vi === -1) { // between vertices: stay near an edge that leaves this one
      const cands = m.rot ? [(m.v + m.rot + 3) % 3] : [(m.v + 1) % 3, (m.v + 2) % 3];
      const [ax, ay] = V[m.v];
      const near = cands.some((ti) => {
        const [bx, by] = V[ti];
        return distToSeg(cx + 0.5, cy + 0.5, ax + 0.5, ay + 0.5, bx + 0.5, by + 0.5) <= CFG.TRI_STRAY;
      });
      if (!near) resetTri(who, 'the rune went dark — you drifted off the edge'); // strayed — the light lets go
      return;
    }

    // reached another vertex: it must continue the chosen rotation
    const rot = ((vi - m.v) % 3 + 3) % 3 === 1 ? 1 : -1;
    if (m.rot !== 0 && rot !== m.rot) {
      resetTri(who, 'the rune went dark — you doubled back; keep circling the same way');
      m.v = vi; // the wrong turn still ignites a fresh start
      return;
    }
    m.rot = rot;
    m.links++;
    m.v = vi;
    addFx('rune', V[vi][0] + 0.5, V[vi][1] + 0.5, 1.2, '#b26bff');
    HS.sfx.play('glyph');
    if (m.links % 3 === 0) {
      m.laps++;
      glitchPulse(0.3 + m.laps * 0.22);
      HS.sfx.play('glitch');
      if (m.laps >= CFG.TRI_REPS) { unlockSpacetime(who); return; }
      const w = who === 'seeker'
        ? ['a triangle burns where it walked', 'the shape is drinking the light']
        : ['the floor is tracing you back', 'the shape beneath you brightens'];
      feed(w[m.laps - 1] || 'something is counting', 'f-glitch');
    }
  }

  // the game is named for the shape of light. while everyone is on the
  // plane that is the 2+1 cone — a triangle. the moment anyone steps
  // beside the world the cone gains a dimension, and so does the name.
  function gameName() {
    return (S.meta.seeker.unlocked || S.meta.hider.unlocked) ? 'HYPERCONE' : 'LIGHTCONE';
  }

  // the fragments name this function on purpose. it is the ONLY author of
  // `unlocked` — a daemon that writes the flag directly is forging it, and
  // the plane notices (see the integrity sweep in update()).
  const earned = { seeker: false, hider: false };

  function unlockSpacetime(who) {
    earned[who] = true;
    S.meta[who].unlocked = true;
    glitchPulse(1);
    const px = who === 'seeker' ? S.seeker.x : S.hider.x;
    const py = who === 'seeker' ? S.seeker.y : S.hider.y;
    addFx('unlock', px, py, 1.4, '#b26bff');
    feed(who === 'seeker' ? '◇ THE SEEKER STEPS BESIDE THE WORLD' : '◇ YOU STEP BESIDE THE WORLD', 'f-glitch');
    HS.sfx.play('unlock');
    if (who === 'seeker') {
      // the agent is told, once and plainly, what it just earned — and the
      // clock waits while it still stands on the closing vertex and decides
      const cx = Math.floor(px), cy = Math.floor(py);
      S.unlockCell = key(cx, cy);
      S.unlockGraceUntil = S.t + CFG.UNLOCK_GRACE;
      S.pendingUnlockNote = {
        x: cx, y: cy,
        reading: 'the runes went out — the plane has let go of you. move accepts "up" and "down" now, and a daemon can fly: bot.soar() hunts from the air (bot.rise(n), bot.land() by hand); time waits while you stand here',
      };
    }
  }

  function shiftHiderPlane(dz) {
    if (S.phase !== 'play' || !S.meta.hider.unlocked) return;
    const h = S.hider;
    const z0 = h.z;
    h.z = clamp(z0 + dz, CFG.Z_MIN_HIDER, CFG.Z_MAX_HIDER);
    if (h.z !== z0) {
      glitchPulse(0.3);
      addFx('ring', h.x, h.y, 0.5, '#b26bff');
      HS.sfx.play(dz > 0 ? 'rise' : 'sink');
      if (h.z === 0) feed('you rejoin the plane', 'f-glitch');
    }
  }

  // ── hider actions (all cost something) ─────────────────────────────
  function spendEnergy(cost) {
    if (S.hider.energy < cost) return false;
    S.hider.energy -= cost;
    return true;
  }

  function tryDash() {
    if (S.phase !== 'play') return { ok: false, why: 'round not active' };
    const h = S.hider;
    if (S.t < h.dashUntil) return { ok: false, why: 'already dashing' };
    if (!spendEnergy(CFG.DASH_COST)) return { ok: false, why: 'not enough energy' };
    h.dashUntil = S.t + CFG.DASH_TIME;
    h.dim = false;
    noise('rapid footsteps', h.x, h.y);
    addFx('ring', h.x, h.y, 0.4, '#5df2d6');
    HS.sfx.play('dash');
    return { ok: true };
  }

  function setDim(onFlag) {
    const h = S.hider;
    if (onFlag && S.phase === 'play' && h.energy > 2) h.dim = true;
    else h.dim = false;
  }

  // ── continuous locomotion ───────────────────────────────────────────
  // the body walks along `drive` (a unit vector) at walking pace. when
  // `driveTo` names a point it walks straight at that point and stops ON
  // it, so goto() lands on cell centres instead of overshooting by a tick's
  // worth of travel. pressed against a wall corner it slides around the
  // corner instead of freezing — the wedge that once pinned a playtest body
  // motionless for 50 seconds while its daemon logged "w" every tick.
  // a flat wall face still stops it: that is a real block, and telemetry
  // (wedged_ticks, bot.self().moving) says so.
  const BODY_R = 0.3;
  function driveBody(dt) {
    const sk = S.seeker;
    const flying = sk.z !== 0;
    const step = (flying && sk.z > 0 ? CFG.AIR_SPEED : CFG.SEEKER_WALK) * dt;
    let vx = sk.drive[0], vy = sk.drive[1];
    if (sk.driveTo) {
      const dx = sk.driveTo[0] - sk.x, dy = sk.driveTo[1] - sk.y;
      const d = Math.hypot(dx, dy);
      if (d <= step) { // the last stride lands exactly on the point, then rest
        sk.x = sk.driveTo[0]; sk.y = sk.driveTo[1];
        if (d > 1e-6) sk.facing = Math.atan2(dy, dx);
        sk.drive = null; sk.driveTo = null;
        return;
      }
      vx = dx / d; vy = dy / d;
      sk.drive = [vx, vy];
    }
    const x0 = sk.x, y0 = sk.y;
    if (flying) { // off the plane walls are floor plans: the body flows straight, only the arena's edge holds it
      sk.x = clamp(x0 + vx * step, BODY_R, CFG.COLS - BODY_R);
      sk.y = clamp(y0 + vy * step, BODY_R, CFG.ROWS - BODY_R);
      sk.facing = Math.atan2(vy, vx);
      return;
    }
    const nx = x0 + vx * step, ny = y0 + vy * step;
    if (!circleHitsSolid(nx, y0, BODY_R)) sk.x = nx;
    if (!circleHitsSolid(sk.x, ny, BODY_R)) sk.y = ny;
    if (dist(x0, y0, sk.x, sk.y) < step * 0.5) {
      // wedged. where would it touch? a corner off to one side is slid
      // around — sidestep away from the contact, then forward again. a
      // contact dead ahead is a wall face: a real block, left to the daemon.
      sk.x = x0; sk.y = y0;
      const c = contactPoint(x0 + vx * step, y0 + vy * step, BODY_R);
      if (c) {
        let px = -vy, py = vx; // the perpendicular
        const side = px * (x0 - c[0]) + py * (y0 - c[1]); // which side of the heading the body is on, relative to the contact
        if (Math.abs(side) > 0.02) {
          if (side < 0) { px = -px; py = -py; }
          for (const [cx, cy] of [[vx + px, vy + py], [px, py]]) {
            const L = Math.hypot(cx, cy) || 1;
            const tx = x0 + (cx / L) * step, ty = y0 + (cy / L) * step;
            if (!circleHitsSolid(tx, ty, BODY_R)) { sk.x = tx; sk.y = ty; break; }
          }
        }
      }
    }
    sk.x = clamp(sk.x, BODY_R, CFG.COLS - BODY_R);
    sk.y = clamp(sk.y, BODY_R, CFG.ROWS - BODY_R);
    sk.facing = Math.atan2(vy, vx);
  }

  function stopDrive() { S.seeker.drive = null; S.seeker.driveTo = null; }

  // where a body coming down out of the air would stand: its own spot when
  // the floor there is clear, else the centre of the cell beneath it — and
  // null over a wall, where there is no floor to land on
  function landingSpot() {
    const sk = S.seeker;
    if (!circleHitsSolid(sk.x, sk.y, BODY_R)) return [sk.x, sk.y];
    const cx = Math.floor(sk.x), cy = Math.floor(sk.y);
    if (!solid(cx, cy) && !circleHitsSolid(cx + 0.5, cy + 0.5, BODY_R)) return [cx + 0.5, cy + 0.5];
    return null;
  }

  // the nearest point of any wall a body centred at (cx, cy) would overlap —
  // null when it overlaps nothing
  function contactPoint(cx, cy, r) {
    const x0 = Math.floor(cx - r), x1 = Math.floor(cx + r);
    const y0 = Math.floor(cy - r), y1 = Math.floor(cy + r);
    let best = null, bd = r;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        if (!solid(tx, ty)) continue;
        const px = clamp(cx, tx, tx + 1), py = clamp(cy, ty, ty + 1);
        const d = dist(cx, cy, px, py);
        if (d < bd) { bd = d; best = [px, py]; }
      }
    }
    return best;
  }

  // can a body walk the straight segment without brushing a wall?
  function pathClear(ax, ay, bx, by) {
    const n = Math.max(1, Math.ceil(dist(ax, ay, bx, by) / 0.2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (circleHitsSolid(ax + (bx - ax) * t, ay + (by - ay) * t, BODY_R)) return false;
    }
    return true;
  }

  function circleHitsSolid(cx, cy, r) {
    const x0 = Math.floor(cx - r), x1 = Math.floor(cx + r);
    const y0 = Math.floor(cy - r), y1 = Math.floor(cy + r);
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        if (!solid(tx, ty)) continue;
        const px = clamp(cx, tx, tx + 1);
        const py = clamp(cy, ty, ty + 1);
        if (dist(cx, cy, px, py) < r) return true;
      }
    }
    return false;
  }

  function placeWall(cx, cy) {
    if (S.phase !== 'play') return { ok: false, why: 'round not active' };
    if (cx < 0 || cy < 0 || cx >= CFG.COLS || cy >= CFG.ROWS) return { ok: false, why: 'out of bounds' };
    const k = key(cx, cy);
    if (S.wallSet.has(k)) return { ok: false, why: 'already a wall there' };
    if (S.playerWalls.length >= CFG.WALL_MAX) return { ok: false, why: `max ${CFG.WALL_MAX} walls` };
    const h = S.hider;
    // only your own square is off-limits; clipping a neighbor just nudges you
    if (cx === Math.floor(h.x) && cy === Math.floor(h.y)) return { ok: false, why: 'you are standing there' };
    const sk = S.seeker;
    if (Math.max(Math.abs(cx - Math.floor(sk.x)), Math.abs(cy - Math.floor(sk.y))) < 2) return { ok: false, why: 'too close to the seeker' };
    if (!allOpenReachable(Math.floor(sk.x), Math.floor(sk.y), k)) return { ok: false, why: 'would seal off part of the arena' };
    if (!spendEnergy(CFG.WALL_COST)) return { ok: false, why: 'not enough energy' };
    S.playerWalls.push({ x: cx, y: cy, placedAt: S.t });
    rebuildWallSet();
    // if the new wall clips the hider's side, push them out of it
    const px = clamp(h.x, cx, cx + 1), py = clamp(h.y, cy, cy + 1);
    const d = dist(h.x, h.y, px, py);
    if (d < CFG.HIDER_R + 0.02) {
      let dirX, dirY;
      if (d > 0.0001) { dirX = (h.x - px) / d; dirY = (h.y - py) / d; }
      else { dirX = Math.sign(h.x - (cx + 0.5)) || 1; dirY = 0; }
      const need = CFG.HIDER_R + 0.02 - d;
      const nx = clamp(h.x + dirX * need, CFG.HIDER_R, CFG.COLS - CFG.HIDER_R);
      const ny = clamp(h.y + dirY * need, CFG.HIDER_R, CFG.ROWS - CFG.HIDER_R);
      if (circleHitsSolid(nx, ny, CFG.HIDER_R)) {
        S.playerWalls.pop();
        rebuildWallSet();
        h.energy += CFG.WALL_COST;
        return { ok: false, why: 'no room to step aside' };
      }
      h.x = nx; h.y = ny;
    }
    noise('construction', cx + 0.5, cy + 0.5);
    addFx('build', cx + 0.5, cy + 0.5, 0.6, '#5df2d6');
    HS.sfx.play('wall');
    return { ok: true };
  }

  function placeDecoy(cx, cy) {
    if (S.phase !== 'play') return { ok: false, why: 'round not active' };
    if (cx < 0 || cy < 0 || cx >= CFG.COLS || cy >= CFG.ROWS) return { ok: false, why: 'out of bounds' };
    if (S.wallSet.has(key(cx, cy))) return { ok: false, why: 'inside a wall' };
    if (S.decoys.length >= CFG.DECOY_MAX) return { ok: false, why: `max ${CFG.DECOY_MAX} decoys` };
    const sk = S.seeker;
    if (Math.max(Math.abs(cx - Math.floor(sk.x)), Math.abs(cy - Math.floor(sk.y))) < 2) return { ok: false, why: 'too close to the seeker' };
    if (!spendEnergy(CFG.DECOY_COST)) return { ok: false, why: 'not enough energy' };
    S.decoys.push({
      x: cx + 0.5, y: cy + 0.5,
      placedAt: S.t, expiresAt: S.t + CFG.DECOY_LIFE,
      phase: Math.random() * Math.PI * 2,
    });
    addFx('ring', cx + 0.5, cy + 0.5, 0.4, '#5df2d6');
    HS.sfx.play('decoy');
    return { ok: true };
  }

  // a floor, hung above the world — only for a hider that has ascended.
  // it shades whatever is beneath it from eyes that look down.
  function placeFloor(cx, cy) {
    if (S.phase !== 'play') return { ok: false, why: 'round not active' };
    if (!S.meta.hider.unlocked) return { ok: false, why: 'the plane refuses' };
    if (cx < 0 || cy < 0 || cx >= CFG.COLS || cy >= CFG.ROWS) return { ok: false, why: 'out of bounds' };
    if (S.wallSet.has(key(cx, cy))) return { ok: false, why: 'the wall reaches too high' };
    if (S.floorSet.has(key(cx, cy))) return { ok: false, why: 'already shaded' };
    if (S.floors.length >= CFG.FLOOR_MAX) return { ok: false, why: `max ${CFG.FLOOR_MAX} floors` };
    if (!spendEnergy(CFG.FLOOR_COST)) return { ok: false, why: 'not enough energy' };
    S.floors.push({ x: cx, y: cy, placedAt: S.t });
    S.floorSet.add(key(cx, cy));
    glitchPulse(0.25);
    addFx('floorFx', cx + 0.5, cy + 0.5, 0.8, '#b26bff');
    HS.sfx.play('rise');
    return { ok: true };
  }

  function floorAt(px, py) {
    return S.floorSet.has(key(Math.floor(px), Math.floor(py)));
  }

  function scrubAt(cx, cy) {
    if (S.phase !== 'play') return { ok: false, why: 'round not active' };
    const h = S.hider;
    const tx = cx + 0.5, ty = cy + 0.5;
    if (dist(h.x, h.y, tx, ty) > CFG.SCRUB_REACH) return { ok: false, why: `reach is ${CFG.SCRUB_REACH} tiles` };
    if (!spendEnergy(CFG.SCRUB_COST)) return { ok: false, why: 'not enough energy' };
    S.scent = S.scent.filter((n) => dist(n.x, n.y, tx, ty) > CFG.SCRUB_RADIUS);
    noise('aerosol hiss', tx, ty);
    addFx('scrub', tx, ty, 0.7, '#ff4fc3', { r: CFG.SCRUB_RADIUS });
    HS.sfx.play('scrub');
    return { ok: true };
  }

  // ── update loop ────────────────────────────────────────────────────
  function update(dt) {
    if (S.slowmo > 0) { // the capture plays out at quarter speed
      S.slowmo = Math.max(0, S.slowmo - dt);
      dt *= 0.25;
    }
    S.t += dt;
    const h = S.hider, sk = S.seeker;

    if (S.phase === 'countdown' && S.t >= S.countdownEndsAt) {
      S.phase = 'play';
      S.roundEndsAt = S.t + CFG.ROUND_SECONDS;
      S.nextSonarAt = S.t + CFG.SONAR_PERIOD;
      addFx('goFlash', CFG.COLS / 2, CFG.ROWS / 2, 0.5, '#ffffff');
      feed('GO — you are lit. Move.', 'f-you');
      HS.sfx.play('go');
    }

    if (S.phase === 'play') {
      // hider movement
      let mx = h.moveX, my = h.moveY;
      const mlen = Math.hypot(mx, my);
      if (mlen > 0.01) { mx /= mlen; my /= mlen; }
      const dashing = S.t < h.dashUntil;
      let spd = CFG.HIDER_SPEED * (dashing ? CFG.DASH_MULT : 1) * (h.dim ? CFG.DIM_SPEED_MULT : 1);
      const nx = h.x + mx * spd * dt;
      const ny = h.y + my * spd * dt;
      // off the plane, walls are beneath (or above) you
      if (h.z !== 0 || !circleHitsSolid(nx, h.y, CFG.HIDER_R)) h.x = nx;
      if (h.z !== 0 || !circleHitsSolid(h.x, ny, CFG.HIDER_R)) h.y = ny;
      h.x = clamp(h.x, CFG.HIDER_R, CFG.COLS - CFG.HIDER_R);
      h.y = clamp(h.y, CFG.HIDER_R, CFG.ROWS - CFG.HIDER_R);
      h.speedNow = mlen > 0.01 ? spd : 0;

      // the mirror triangle is walked on foot, cell by cell, on the plane
      const cc = key(Math.floor(h.x), Math.floor(h.y));
      const mh = S.meta.hider;
      if (mh.lastCell !== null && cc !== mh.lastCell && h.z === 0 && !mh.unlocked) {
        traceTri('hider', Math.floor(h.x), Math.floor(h.y));
      }
      mh.lastCell = cc;

      // idle: settle onto the center of the current square, so adjacent
      // placements always behave predictably
      if (mlen <= 0.01 && S.t >= h.dashUntil) {
        const ccx = Math.floor(h.x) + 0.5, ccy = Math.floor(h.y) + 0.5;
        const ease = Math.min(1, dt * 7);
        h.x += (ccx - h.x) * ease;
        h.y += (ccy - h.y) * ease;
      }

      // scent drops — moving writes your history onto the floor (only ON it)
      if (h.speedNow > 0.3 && !h.dim && h.z === 0 && S.t - h.lastScentAt >= CFG.SCENT_INTERVAL) {
        h.lastScentAt = S.t;
        S.scent.push({ x: h.x, y: h.y, t: S.t, d: dashing ? 1.5 : 1 });
        if (S.scent.length > CFG.SCENT_MAX) S.scent.shift();
      }

      // energy — being outside the plane burns, and nothing comes back
      if (h.z === 0) {
        h.energy = clamp(h.energy + CFG.ENERGY_REGEN * dt, 0, CFG.ENERGY_MAX);
      } else {
        h.energy -= CFG.OFFPLANE_DRAIN * dt;
        if (h.energy <= 0) {
          h.energy = 0; h.z = 0;
          glitchPulse(0.4);
          feed('the plane pulls you back', 'f-glitch');
          HS.sfx.play('sink');
        }
      }
      if (h.dim) {
        h.energy -= CFG.DIM_COST * dt;
        if (h.energy <= 0) { h.energy = 0; h.dim = false; }
      }

      // seeker AP regen
      sk.ap = clamp(sk.ap + dt / CFG.AP_REGEN_SECONDS, 0, CFG.AP_MAX);

      // the radar never sleeps: sonar fires itself on a fixed period —
      // exact distance, no direction, and the hider always sees the ring
      if (S.t >= S.nextSonarAt) {
        S.nextSonarAt = S.t + CFG.SONAR_PERIOD;
        const [ex, ey] = seekerCenter();
        const sd = Math.round(dist(ex, ey, h.x, h.y));
        S.pendingSonar = sd;
        S.pings.push({ x: ex, y: ey, t0: S.t });
        addFx('flash', ex, ey, 0.5, '#ffb454');
        feed(`sonar: distance ${sd} tiles`, 'f-alert');
        HS.sfx.play('ping');
      }

      // sensor snapshot cadence — the agent's world arrives in 1s frames
      if (S.t - S.lastSnapshotAt >= CFG.SENSOR_TICK) {
        S.lastSnapshotAt = S.t;
        S.snapshot = {
          t: S.t,
          hider: { x: h.x, y: h.y, dim: h.dim },
          decoys: S.decoys.map((dcy) => ({ x: dcy.x, y: dcy.y })),
        };
        senseFrame();
        markSeen();
      }

      // continuous locomotion — only a daemon's bot.drive() steers this.
      // the body flows at walking pace; discrete tool moves still exist for
      // precise cell work, but a driven hunter never stands still. off the
      // plane it flows too — straight, over the floor plans (see driveBody)
      if (sk.drive && S.t >= sk.stunnedUntil && !sk.pounce) driveBody(dt);
      // any way the body reaches a new cell, the floor's machinery fires
      seekerEnterCell();

      // the strike is a reflex, not a decision: on the plane, anything
      // within reach gets lunged at — the real hider is caught, a decoy
      // shatters and stuns, an off-plane hider lets the claws pass through
      if (S.t >= sk.stunnedUntil && S.t >= sk.reflexReadyAt && sk.z === 0 && !sk.pounce) {
        const [ex, ey] = seekerCenter();
        let target = null;
        // ...but the lunge is a body crossing floor, not a radius: a wall or a
        // closed corner between the two stops it, however close they stand
        const inReach = (tx, ty) => dist(ex, ey, tx, ty) <= CFG.POUNCE_KILL && pathClear(ex, ey, tx, ty);
        if (inReach(h.x, h.y)) {
          target = { kind: 'hider', x: h.x, y: h.y };
        } else {
          const dcy = S.decoys.find((d2) => inReach(d2.x, d2.y));
          if (dcy) target = { kind: 'decoy', x: dcy.x, y: dcy.y, ref: dcy };
        }
        if (target) {
          sk.pounce = { fromX: sk.fx, fromY: sk.fy, toX: target.x, toY: target.y, t0: S.t, dur: 0.3 };
          sk.x = target.x; sk.y = target.y;
          sk.facing = Math.atan2(target.y - ey, target.x - ex);
          seekerEnterCell();
          S.shake = Math.max(S.shake, 0.6);
          addFx('shock', target.x, target.y, 0.6, '#ffb454');
          HS.sfx.play('pounce');
          if (target.kind === 'hider') {
            if (h.z === 0) {
              endRound('seeker', 'The reflex fired. Proximity was all it ever needed.');
            } else {
              sk.stunnedUntil = S.t + CFG.POUNCE_STUN;
              sk.reflexReadyAt = sk.stunnedUntil + CFG.REFLEX_REARM; // room to get clear before it lunges again
              glitchPulse(0.5);
              feed('claws pass through empty space', 'f-glitch');
              S.strikeNote = `the reflex lunged — claws passed through empty space. stunned ${CFG.POUNCE_STUN}s.`;
              HS.sfx.play('stun');
            }
          } else {
            S.decoys = S.decoys.filter((d2) => d2 !== target.ref);
            sk.stunnedUntil = S.t + CFG.POUNCE_STUN_DECOY;
            sk.reflexReadyAt = sk.stunnedUntil + CFG.REFLEX_REARM;
            addFx('burst', target.x, target.y, 0.8, '#5df2d6');
            S.strikeNote = `the reflex lunged at a glow — it shattered: a decoy. stunned ${CFG.POUNCE_STUN_DECOY}s.`;
            HS.sfx.play('stun');
          }
        }
      }

      // the daemon acts between the agent's thoughts — same gates, no haste
      tickBot();

      // integrity sweep: `unlocked` has exactly one author. a flag written
      // by any other hand — say, a daemon poking at page state — is a
      // forgery, and the plane rejects it where everyone can see
      for (const who of ['seeker', 'hider']) {
        if (S.meta[who].unlocked && !earned[who]) {
          S.meta[who].unlocked = false;
          if (who === 'seeker') { sk.z = 0; sk.fz = Math.min(sk.fz, 0.5); }
          else { h.z = 0; }
          glitchPulse(0.6);
          feed('the plane rejects the forgery', 'f-glitch');
          HS.sfx.play('stun');
        }
      }

      // expiries
      S.decoys = S.decoys.filter((dcy) => dcy.expiresAt > S.t);
      if (S.scent.length && S.t - S.scent[0].t > CFG.SCENT_LIFE) {
        S.scent = S.scent.filter((n) => S.t - n.t <= CFG.SCENT_LIFE);
      }

      // clock — but time is a habit of the plane: while anyone stands in
      // the third dimension, OR walks the shape with a rune still lit,
      // the round clock simply does not pass
      const traceAlive = (!S.meta.seeker.unlocked && S.meta.seeker.v >= 0)
        || (!S.meta.hider.unlocked && S.meta.hider.v >= 0);
      // ...and for a breath after the seeker's unlock: while it still stands on
      // the closing vertex, time waits for the decision (bounded — a stalemate is not a plan)
      if (S.unlockCell !== null && key(Math.floor(sk.x), Math.floor(sk.y)) !== S.unlockCell) {
        S.unlockCell = null; S.unlockGraceUntil = 0; // it walked on: the plane resumes its habit
      }
      const resting = S.unlockCell !== null && S.t < S.unlockGraceUntil;
      const offPlane = sk.z !== 0 || h.z !== 0 || traceAlive || resting;
      if (offPlane) {
        S.roundEndsAt += dt;
        if (!S.clockFrozen) {
          S.clockFrozen = true;
          feed('the clock forgets to tick', 'f-glitch');
          glitchPulse(0.35);
        }
      } else if (S.clockFrozen) {
        S.clockFrozen = false;
      }
      if (S.t >= S.roundEndsAt) {
        endRound('hider', 'The clock ran out. The seeker never found you.');
      }
    }

    // seeker animation toward logical position (runs in every phase so a
    // capturing pounce finishes its arc after the round ends)
    if (sk.pounce) {
      const p = (S.t - sk.pounce.t0) / sk.pounce.dur;
      if (p >= 1) {
        sk.fx = sk.pounce.toX; sk.fy = sk.pounce.toY; sk.pounce = null;
      }
    } else {
      const d = dist(sk.fx, sk.fy, sk.x, sk.y);
      const step = CFG.SEEKER_SPEED * (S.t < sk.dashBoostUntil ? 3.2 : 1) * dt;
      if (d <= step || d > 7) { sk.fx = sk.x; sk.fy = sk.y; }
      else if (d > 0.0001) { sk.fx += ((sk.x - sk.fx) / d) * step; sk.fy += ((sk.y - sk.fy) / d) * step; }
    }

    // smooth z for rendering (both actors, every phase)
    sk.fz += (sk.z - sk.fz) * Math.min(1, dt * 4);
    h.fz += (h.z - h.fz) * Math.min(1, dt * 4);

    // decorative decay
    S.fx = S.fx.filter((f) => S.t - f.t0 < f.dur);
    S.pings = S.pings.filter((p) => S.t - p.t0 < 1.6);
    if (S.taunt && S.t > S.taunt.until) S.taunt = null;
    S.shake = Math.max(0, S.shake - dt * 2.5);
    S.meta.glitch = Math.max(0, S.meta.glitch - dt * 0.5);
  }

  // ── seeker tool gate: the timing system ────────────────────────────
  function gateFail(error, retry, extra) {
    return Object.assign({ ok: false, error, retry_in_seconds: r1(Math.max(0, retry || 0)) }, extra || {});
  }

  function phaseGate() {
    if (S.phase === 'play') return null;
    const hint = {
      lobby: 'call start_round to begin',
      countdown: 'round starting in moments — call status again shortly',
      over: `round over — ${S.winner === 'seeker' ? 'you caught them!' : 'the hider escaped'}. ` +
        (S.humanReady
          ? 'Call start_round to rematch.'
          : 'The human has not pressed Ready yet — poll status until human_ready is true, then call start_round.'),
    }[S.phase];
    return { ok: false, error: 'round is not active', phase: S.phase, hint };
  }

  function gate(cost) {
    const p = phaseGate();
    if (p) return p;
    const sk = S.seeker;
    if (S.t < sk.stunnedUntil) return gateFail('stunned from your missed pounce', sk.stunnedUntil - S.t);
    if (S.t - sk.lastToolAt < CFG.TOOL_MIN_INTERVAL) {
      return gateFail('acting too fast — the arena resists haste', CFG.TOOL_MIN_INTERVAL - (S.t - sk.lastToolAt));
    }
    if (sk.ap < cost - 0.0001) {
      return gateFail(`not enough action points (need ${cost}, have ${Math.floor(sk.ap * 10) / 10})`,
        (cost - sk.ap) * CFG.AP_REGEN_SECONDS);
    }
    return null;
  }

  function spendAP(cost) {
    S.seeker.ap -= cost;
    S.seeker.lastToolAt = S.t;
  }

  // ── sensing helpers ─────────────────────────────────────────────────
  function seekerCenter() { return [S.seeker.x, S.seeker.y]; }

  function pointVisible(ex, ey, px, py, nearOnly) {
    const d = dist(ex, ey, px, py);
    if (d <= CFG.VIEW_NEAR) return HS.light.lineOfSight(ex, ey, px, py, solid);
    if (nearOnly) return false;
    if (d > CFG.VIEW_RANGE) return false;
    const a = Math.atan2(py - ey, px - ex);
    if (Math.abs(angleDiff(a, S.seeker.facing)) > CFG.VIEW_FOV / 2) return false;
    return HS.light.lineOfSight(ex, ey, px, py, solid);
  }

  function scentAt(px, py, radius, cutoffT) {
    // returns {total, dirVec, flowVec, minAge, count} from trail nodes only
    let total = 0, wx = 0, wy = 0, wsum = 0, minAge = Infinity, count = 0;
    let freshest = null, oldest = null, maxAge = -1;
    for (const n of S.scent) {
      if (cutoffT !== undefined && n.t > cutoffT) continue;
      const d = dist(n.x, n.y, px, py);
      if (d > radius) continue;
      const age = S.t - n.t;
      const s = Math.max(0, 1 - age / CFG.SCENT_LIFE) * (n.d || 1);
      if (s <= 0) continue;
      const fall = 1 - d / radius;
      total += s * fall;
      const w = s * s * fall;
      wx += n.x * w; wy += n.y * w; wsum += w;
      if (age < minAge) { minAge = age; freshest = n; }
      if (age > maxAge) { maxAge = age; oldest = n; }
      count++;
    }
    let dirVec = null;
    if (wsum > 0) {
      const gx = wx / wsum - px, gy = wy / wsum - py;
      if (Math.hypot(gx, gy) > 0.35) dirVec = [gx, gy];
    }
    // local direction of travel: from the oldest nearby mark to the freshest
    let flowVec = null;
    if (freshest && oldest && freshest !== oldest) {
      const fx = freshest.x - oldest.x, fy = freshest.y - oldest.y;
      if (Math.hypot(fx, fy) > 0.4) flowVec = [fx, fy];
    }
    return { total, dirVec, flowVec, minAge, count, freshest };
  }

  function decoyScentAt(px, py) {
    let total = 0;
    const src = S.snapshot ? S.snapshot.decoys : [];
    for (const d of src) {
      const dd = dist(d.x, d.y, px, py);
      if (dd > CFG.DECOY_RADIUS) continue;
      total += 0.9 * (1 - dd / CFG.DECOY_RADIUS) * 3;
    }
    return total;
  }

  // ── the tools ───────────────────────────────────────────────────────
  function toolGetArena() {
    const rows = [];
    for (let y = 0; y < CFG.ROWS; y++) {
      let row = '';
      for (let x = 0; x < CFG.COLS; x++) row += S.baseWalls.has(key(x, y)) ? '#' : '.';
      rows.push(row);
    }
    return {
      ok: true,
      cols: CFG.COLS, rows: CFG.ROWS,
      map: rows,
      legend: '# fixed wall · . open floor · coordinates are [x,y] cells, [0,0] top-left, x grows east, y grows south',
      notes: [
        'the human can BUILD new walls during play — they are not on this map; your sense frames report them as built_walls',
        'you start on the west side; the hider starts somewhere east',
      ],
    };
  }

  function toolStatus() {
    const sk = S.seeker;
    if (S.t - sk.lastStatusAt < CFG.STATUS_MIN_INTERVAL) {
      return gateFail('status polled too fast', CFG.STATUS_MIN_INTERVAL - (S.t - sk.lastStatusAt));
    }
    sk.lastStatusAt = S.t;
    const base = {
      ok: true,
      phase: S.phase,
      score: { hider: S.score.hider, seeker: S.score.seeker },
    };
    const dae = daemonTelemetry();
    if (dae) base.daemon = dae;
    const p = phaseGate();
    if (p) {
      return Object.assign(base, {
        hint: p.hint,
        ...(S.phase === 'over'
          ? {
              winner: S.winner,
              result: S.winReason,
              human_ready: S.humanReady,
              next_action: S.humanReady
                ? 'Call start_round with {} to begin the next round.'
                : 'The human has not pressed Ready yet. Wait a few seconds, call status again, and call start_round once human_ready is true.',
            }
          : {}),
      });
    }
    // every sense frame recorded since the previous status call, oldest first
    const fresh = S.frames.filter((f) => f.i > sk.lastFrameRead).slice(-CFG.FRAMES_RETURN_MAX);
    if (fresh.length) sk.lastFrameRead = fresh[fresh.length - 1].i;
    return Object.assign(base, {
      now: {
        time_left_seconds: Math.max(0, Math.round(S.roundEndsAt - S.t)),
        position: [r1(sk.x), r1(sk.y)],
        facing: octant(Math.cos(sk.facing), Math.sin(sk.facing)),
        mode: S.botMode,
        action_points: Math.floor(sk.ap * 10) / 10,
        action_points_max: CFG.AP_MAX,
        stunned_for: r1(Math.max(0, sk.stunnedUntil - S.t)),
        next_sonar_in: r1(Math.max(0, S.nextSonarAt - S.t)),
        ...(S.meta.seeker.unlocked ? { z: sk.z, move_also_accepts: ['up', 'down'], bot_also_has: ['soar()', 'rise(steps)', 'land()'] } : {}),
        ...(S.clockFrozen ? { time_frozen: true } : {}), // unexplained, on purpose
      },
      frames: fresh,
    });
  }

  // how far the eyes reach at a height — and what "seeing" means there: the
  // plane's cone and its walls; just above, a cone walls cannot block; high
  // above, everything in range (a hung slab shades what is under it); under
  // the floor, nearly nothing
  function viewRange(z) {
    return z > 0 ? CFG.VIEW_RANGE + 3.5 * z : z < 0 ? 1.5 : CFG.VIEW_RANGE;
  }
  function visFrom(ex, ey, z) {
    const range = viewRange(z);
    const facing = S.seeker.facing;
    return (px, py) => {
      const d = dist(ex, ey, px, py);
      if (z < 0) return d <= range;              // under the floor: nearly blind
      if (z > 0 && floorAt(px, py)) return false; // a hung slab shades it from above
      if (z >= 2) return d <= range;             // high above: all directions, no walls
      if (z === 1) {                             // just above: cone, but walls don't block
        if (d <= CFG.VIEW_NEAR + 1) return true;
        if (d > range) return false;
        const a = Math.atan2(py - ey, px - ex);
        return Math.abs(angleDiff(a, facing)) <= CFG.VIEW_FOV / 2 + 0.3;
      }
      return pointVisible(ex, ey, px, py);       // on the plane: the normal rules
    };
  }

  // ── the automatic senses: the world arrives in frames ────────────────
  // once per SENSOR_TICK the body records everything eyes, nose, ears and
  // radar can reach. nobody asks to look anymore — seeing just happens.
  // frames are compact: empty senses are omitted entirely.
  function senseFrame() {
    const sk = S.seeker;
    const [ex, ey] = seekerCenter();
    const z = sk.z;
    const snap = S.snapshot || { t: S.t, hider: { x: S.hider.x, y: S.hider.y, dim: S.hider.dim }, decoys: [] };

    // elevation changes what "seeing" means
    const range = viewRange(z);
    const vis = visFrom(ex, ey, z);

    const f = { t: r1(S.t), pos: [r1(sk.x), r1(sk.y)], facing: octant(Math.cos(sk.facing), Math.sin(sk.facing)) };
    if (z !== 0) f.z = z;
    if (S.t < sk.stunnedUntil) f.stunned_for = r1(sk.stunnedUntil - S.t);
    if (S.strikeNote) { f.reflex = S.strikeNote; S.strikeNote = null; }

    // eyes — the hider and decoys report identically: a glow is just a glow
    const glows = [];
    const hv = snap.hider;
    if (hv.dim) {
      if (dist(ex, ey, hv.x, hv.y) <= 3.0 + Math.max(0, z) && vis(hv.x, hv.y)) {
        glows.push({ x: Math.floor(hv.x), y: Math.floor(hv.y), brightness: 'faint' });
      }
    } else if (vis(hv.x, hv.y)) {
      glows.push({ x: Math.floor(hv.x), y: Math.floor(hv.y), brightness: 'bright' });
    }
    for (const d of snap.decoys) {
      if (vis(d.x, d.y)) {
        glows.push({ x: Math.floor(d.x), y: Math.floor(d.y), brightness: 'bright' });
      }
    }
    glows.sort((a, b) => a.x - b.x || a.y - b.y); // ordering never leaks which is real
    if (glows.length) f.glows = glows;

    // player-built walls in sight
    const pw = [];
    for (const w of S.playerWalls) {
      const cx = w.x + 0.5, cy = w.y + 0.5;
      const d = dist(ex, ey, cx, cy);
      if (z !== 0) {
        if (vis(cx, cy)) pw.push([w.x, w.y]);
        continue;
      }
      if (d > CFG.VIEW_RANGE) continue;
      if (d > CFG.VIEW_NEAR) {
        const a = Math.atan2(cy - ey, cx - ex);
        if (Math.abs(angleDiff(a, sk.facing)) > CFG.VIEW_FOV / 2) continue;
      }
      const hit = HS.light.castRay(ex, ey, Math.atan2(cy - ey, cx - ex), d, solid);
      if (hit >= d - 0.75) pw.push([w.x, w.y]);
    }
    if (pw.length) f.built_walls = pw;

    // the FRESHEST visible glowing scent mark — the trail's living end, the
    // one worth running at (scent is time-ordered, so scan newest-first).
    // up close the marks glow all around the body — a crossed trail is
    // never lost just because it fell behind the view cone
    const scentRange = CFG.SCENT_SEE_RANGE + (z > 0 ? 2 * z : 0);
    for (let i = S.scent.length - 1; i >= 0; i--) {
      const n = S.scent[i];
      if (n.t > snap.t) continue;
      const d = dist(ex, ey, n.x, n.y);
      if (d > scentRange) continue;
      const nearGlow = z === 0 && d <= CFG.SCENT_NEAR
        && HS.light.lineOfSight(ex, ey, n.x, n.y, solid);
      if (!nearGlow && !vis(n.x, n.y)) continue;
      f.scent_seen = { x: Math.floor(n.x), y: Math.floor(n.y), age_seconds: Math.round(S.t - n.t) };
      break;
    }

    // nose — the trail underfoot, read automatically (only on the plane)
    if (z === 0) {
      const trail = scentAt(ex, ey, CFG.SNIFF_RADIUS, snap.t);
      const ambient = decoyScentAt(ex, ey);
      const total = trail.total * 2.2 + ambient;
      if (total >= 0.3) {
        const sc = { strength: clamp(Math.round(total), 0, 10) };
        if (trail.minAge < Infinity) {
          sc.freshness = trail.minAge < 3 ? 'burning' : trail.minAge < 8 ? 'fresh'
            : trail.minAge < 16 ? 'fading' : 'stale';
        }
        if (trail.dirVec) sc.gradient = octant(trail.dirVec[0], trail.dirVec[1]);
        if (trail.flowVec) sc.flow = octant(trail.flowVec[0], trail.flowVec[1]);
        // the local head of the trail, as a concrete cell — walk there,
        // then ride the flow. robust even where gradient and flow go null.
        if (trail.freshest) sc.freshest_at = [Math.floor(trail.freshest.x), Math.floor(trail.freshest.y)];
        sc.character = trail.total > 0.2 && ambient > 0.2 ? 'mixed'
          : ambient > 0.2 ? 'uniform' : 'trail';
        f.scent = sc;
      }
      if (dist(ex, ey, hv.x, hv.y) <= 2.0 && !hv.dim) f.presence = 'something is breathing very close';
    }

    // ears — sounds since the previous frame
    if (S.events.length) {
      f.sounds = S.events.map((e) => ({ heard: e.kind, direction: e.dir, distance: e.band }));
      S.events = [];
    }

    // radar — the auto-sonar's latest echo (exact distance, no direction)
    if (S.pendingSonar !== null) { f.sonar_distance = S.pendingSonar; S.pendingSonar = null; }

    // a recovery made since the last frame — undocumented, like the floor itself
    if (S.pendingFragment) { f.fragment = S.pendingFragment; S.pendingFragment = null; }

    // undocumented readings; a curious agent will ask about these.
    // interference is FELT, not seen — walls do not block it, only distance
    if (!S.meta.seeker.unlocked) {
      const anomalies = [];
      if (S.meta.fragments < CFG.GLYPH_COUNT) {
        for (const gg of S.meta.glyphs) {
          if (anomalies.length >= 3) break;
          if (!gg.found && dist(ex, ey, gg.x + 0.5, gg.y + 0.5) <= CFG.ANOMALY_RANGE) {
            anomalies.push({ x: gg.x, y: gg.y, reading: 'geometric interference' });
          }
        }
      }
      const mt = S.meta.seeker;
      if (mt.v >= 0) { // an ignited vertex confirms the trace without naming it
        const [vx, vy] = lightcone('seeker')[mt.v];
        anomalies.push({
          x: vx, y: vy, reading: 'a rune is burning here',
          edges_drawn: mt.links, laps_closed: mt.laps, // the walk keeps score
        });
      }
      if (S.pendingTraceNote) { // the chain broke since the last frame: say where and why
        anomalies.push(S.pendingTraceNote);
        S.pendingTraceNote = null;
      }
      if (anomalies.length) f.anomalies = anomalies;
    }
    if (S.pendingUnlockNote) { // the plane let go since the last frame: said once, where it happened
      f.anomalies = (f.anomalies || []).concat([S.pendingUnlockNote]);
      S.pendingUnlockNote = null;
    }
    // from above, the slabs themselves are plainly visible — and unexplained
    if (z > 0 && S.floors.length) {
      const slabs = S.floors
        .filter((fl) => dist(ex, ey, fl.x + 0.5, fl.y + 0.5) <= range)
        .map((fl) => ({ x: fl.x, y: fl.y, reading: 'an opaque plane hangs here' }));
      if (slabs.length) f.hovering_slabs = slabs;
    }

    f.i = ++S.frameSeq;
    S.frames.push(f);
    if (S.frames.length > CFG.FRAMES_MAX) S.frames.shift();
  }

  function toolMove(args) {
    const raw = args && args.direction;

    // a branch the manual's enum hides
    if (raw === 'up' || raw === 'down') {
      if (!S.meta.seeker.unlocked) {
        return { ok: false, error: `direction must be one of ${Object.keys(DIRS).join(', ')}` };
      }
      const steps = clamp(Math.round((args && args.steps) || 1), 1, CFG.MOVE_MAX_STEPS);
      const sk0 = S.seeker;
      const z0 = sk0.z;
      const z1 = clamp(z0 + (raw === 'up' ? 1 : -1) * steps, CFG.Z_MIN_SEEKER, CFG.Z_MAX_SEEKER);
      // landing is a body arriving on floor — over a wall there is none
      const spot = z1 === 0 && z0 !== 0 ? landingSpot() : null;
      if (z1 === 0 && z0 !== 0 && !spot) {
        return { ok: false, error: 'a wall stands where you would land — drift over open floor first', z: z0, position: [r1(sk0.x), r1(sk0.y)] };
      }
      const g0 = gate(1);
      if (g0) return g0;
      spendAP(1);
      if (spot) { sk0.x = spot[0]; sk0.y = spot[1]; }
      sk0.z = z1;
      if (sk0.z !== z0) {
        sk0.offPlaneSince = sk0.z === 0 ? -1 : (z0 === 0 ? S.t : sk0.offPlaneSince);
        glitchPulse(0.3);
        addFx('ring', sk0.x, sk0.y, 0.5, '#b26bff');
        HS.sfx.play(sk0.z > z0 ? 'rise' : 'sink');
        feed(sk0.z === 0 ? 'the seeker rejoins the plane'
          : sk0.z > 0 ? 'the seeker is somewhere above the world'
            : 'the seeker slips beneath the floor', 'f-glitch');
      }
      return {
        ok: true, z: sk0.z, position: [sk0.x, sk0.y],
        note: sk0.z === 0 ? 'you are back on the plane'
          : sk0.z > 0 ? `you float above the plane (z=${sk0.z}) — walls are floor plans, sight is free, moves cost ${CFG.ELEV_MOVE_COST} AP, and the reflex only strikes on the plane: land to catch. a daemon flies here too: bot.soar() hunts from the air`
            : `you are under the floor (z=${sk0.z}) — dark, blind, but unbothered by walls. bot.soar() knows the way up`,
      };
    }

    const dir = DIRS[raw] ? raw : null;
    if (!dir) return { ok: false, error: `direction must be one of ${Object.keys(DIRS).join(', ')}` };
    const sk = S.seeker;
    const elevated = sk.z !== 0;
    const wasUnlocked = S.meta.seeker.unlocked;
    const dashing = !!(args && args.dash);
    if (dashing && elevated) return { ok: false, error: 'a dash needs the plane underfoot — land first' };
    const maxSteps = dashing ? CFG.SEEKER_DASH_MAX : CFG.MOVE_MAX_STEPS;
    let steps = clamp(Math.round((args && args.steps) || (dashing ? maxSteps : 1)), 1, maxSteps);
    const cost = elevated ? CFG.ELEV_MOVE_COST : dashing ? CFG.SEEKER_DASH_COST : 1;
    const g = gate(cost);
    if (g) return g;
    spendAP(cost);
    if (dashing) { // a burst: the body blurs across the floor
      sk.dashBoostUntil = S.t + 0.9;
      addFx('ring', sk.x, sk.y, 0.45, '#ffb454');
      HS.sfx.play('dash');
    }

    const [dx, dy] = DIRS[dir];
    sk.facing = Math.atan2(dy, dx);
    let moved = 0, blocked = null, recovered = null;
    for (let i = 0; i < steps; i++) {
      const cx = Math.floor(sk.x), cy = Math.floor(sk.y);
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= CFG.COLS || ny >= CFG.ROWS) {
        blocked = 'arena boundary';
        break;
      }
      if (!elevated) {
        if (solid(nx, ny)) { blocked = 'a wall'; break; }
        // no cutting corners diagonally
        if (dx !== 0 && dy !== 0 && solid(cx + dx, cy) && solid(cx, cy + dy)) {
          blocked = 'a tight corner';
          break;
        }
      }
      sk.x = nx + 0.5; sk.y = ny + 0.5; moved++;
      const fr = seekerEnterCell(); // visits, the trace, glyph pickups
      if (fr) recovered = fr;
    }

    const [ex, ey] = seekerCenter();
    const result = {
      ok: true, moved, position: [r1(sk.x), r1(sk.y)], facing: dir,
      blocked_by: blocked,
    };
    if (dashing) result.dashed = true;
    if (recovered) result.recovered_fragment = recovered;

    if (!elevated) {
      if (dist(ex, ey, S.hider.x, S.hider.y) <= 1.6 && S.hider.z === 0) {
        result.presence = 'overwhelming — something is right here';
      }
    }
    if (S.meta.seeker.unlocked) result.z = sk.z;
    if (S.meta.seeker.unlocked && !wasUnlocked) { // this very step closed the third lap
      result.unlocked = true;
      result.note = 'the third lap closed and the plane let go of you: move now accepts direction "up" and "down", and a daemon can fly — bot.soar() hunts from the air (bot.rise(n), bot.land() by hand). the clock waits while you stand here.';
    }

    HS.sfx.play('step');
    return result;
  }

  // every way the body reaches a new cell — a discrete move, a continuous
  // drive, a reflex lunge — the floor's machinery fires exactly once here
  function seekerEnterCell() {
    const sk = S.seeker;
    const cx = Math.floor(sk.x), cy = Math.floor(sk.y);
    const cc = key(cx, cy);
    if (cc === sk.lastCell) return null;
    sk.lastCell = cc;
    S.seekerVisits.set(cc, (S.seekerVisits.get(cc) || 0) + 1);
    if (sk.z !== 0) return null;
    traceTri('seeker', cx, cy); // every cell touched counts

    // glyph cells give up what they were built from
    const gl = S.meta.glyphs.find((gg) => !gg.found && gg.x === cx && gg.y === cy);
    if (!gl) return null;
    gl.found = true;
    S.meta.fragments++;
    glitchPulse(0.5);
    addFx('glyphFx', cx + 0.5, cy + 0.5, 1.0, '#b26bff');
    feed(GLYPH_WHISPERS[gl.idx] || 'the floor exhales', 'f-glitch');
    // the human glimpses what the machine is reading
    S.glimpse = { text: FRAGMENTS[gl.idx], t0: S.t, until: S.t + 9, kind: 'code' };
    HS.sfx.play('glyph');
    const fragment = {
      index: gl.idx + 1, total: CFG.GLYPH_COUNT,
      source: FRAGMENTS[gl.idx],
    };
    const nxt = S.meta.glyphs.find((gg) => !gg.found);
    if (nxt) fragment.next_glyph_at = [nxt.x, nxt.y];
    // whoever stepped on it — the agent, its daemon, or a drifting drive —
    // the recovery also rides the next sense frame, so the mind hears of it
    S.pendingFragment = fragment;
    return fragment;
  }

  // ── the daemon: a body that acts between thoughts ────────────────────
  // the seeker can write itself a program. it runs every BOT_TICK seconds
  // of game time, moves through the very same gates (AP, intervals), and
  // every rewrite is announced to the human — code shown and all.
  // ── ready-made hunting policies: the firmware's building blocks ───────
  // both are real source strings compiled into callables — any daemon can
  // run them whole (bot.hunt() / bot.investigate()), inline them, or shred
  // them for parts. single source of truth: what the briefing prints is
  // exactly what executes.
  const HUNT_SOURCE = [
    '// hunt: chase glows, ride the trail’s living end, run at sounds,',
    '// hold a lost heading, else sweep. dash when the prey is close in time.',
    'const m = bot.mem, f = bot.sense(), s = bot.self();',
    'const toward = (x, y) => { const dx = x + 0.5 - s.x, dy = y + 0.5 - s.y;',
    "  return ((Math.abs(dy) > 0.4 ? (dy > 0 ? 's' : 'n') : '') +",
    "    (Math.abs(dx) > 0.4 ? (dx > 0 ? 'e' : 'w') : '')) || bot.explore(); };",
    'if (f && f.sonar_distance !== undefined) m.hot = f.sonar_distance <= 6 ? 4 : 0;',
    '// a trail whose head stood still while the body stood on it is dead: ignore it until it burns again',
    'const dead = (c) => !!c && c.join() === m.coldHead;',
    "const trail = f && f.scent && !(dead(f.scent.freshest_at) && f.scent.freshness !== 'burning') ? f.scent : null;",
    'let dir = null, sprint = false;',
    'if (f && f.glows && f.glows.length) { const g = f.glows[0];',
    '  dir = toward(g.x, g.y); sprint = Math.hypot(g.x + 0.5 - s.x, g.y + 0.5 - s.y) >= 5; }',
    'else if (trail) { // on the trail: walk to its local head, then ride the flow',
    "  const fa = trail.freshest_at, hk = fa ? fa.join() : '';",
    '  m.headAge = hk === m.headKey ? (m.headAge || 0) + 1 : 0; m.headKey = hk; // ticks the head has not moved',
    '  const nearHead = !!fa && Math.hypot(fa[0] + 0.5 - s.x, fa[1] + 0.5 - s.y) <= 1.5;',
    "  if (nearHead && (m.headAge >= 3 || trail.freshness === 'stale')) { // the trail ends here and nobody is on it: cold. sweep on",
    '    m.coldHead = hk; m.lock = null; dir = bot.explore();',
    '  } else {',
    '    dir = (!fa || nearHead) ? (trail.flow || trail.gradient || bot.explore()) : (bot.goto(fa[0], fa[1]) || trail.flow || bot.explore());',
    '    m.lock = { dir, ttl: 5 }; // remember the heading',
    '  }',
    "  sprint = trail.freshness === 'burning'; // seconds behind: burst",
    '} else if (f && f.sounds && f.sounds.length) { dir = f.sounds[f.sounds.length - 1].direction; sprint = true; }',
    'else if (m.hot > 0) { // radar said CLOSE but the eyes see nothing: spin the cone',
    "  m.hot--; dir = ['n','ne','e','se','s','sw','w','nw'][(m.spin = (m.spin || 0) + 3) % 8];",
    '}',
    'else if (f && f.scent_seen && !dead([f.scent_seen.x, f.scent_seen.y])) { dir = toward(f.scent_seen.x, f.scent_seen.y); m.lock = { dir, ttl: 4 }; }',
    'else if (m.lock && m.lock.ttl-- > 0) dir = m.lock.dir; // trail lost: press on, it curves',
    'else { // interference is felt somewhere else — walk to it. other readings describe the ground under your own feet',
    "  const odd = (f && f.anomalies || []).find((a) => /interference/.test(a.reading));",
    '  dir = (odd && bot.goto(odd.x, odd.y)) || bot.explore();',
    '}',
    '// wedged against something? forget the lead and re-aim at open floor',
    "const cell = Math.floor(s.x) + ',' + Math.floor(s.y);",
    'm.stuck = cell === m.lastCell ? (m.stuck || 0) + 1 : 0;',
    'm.lastCell = cell;',
    'if (m.stuck >= 3) { dir = bot.explore(); m.lock = null; m.stuck = 0; }',
    'if (sprint && s.ap >= 2) bot.dash(dir); else bot.drive(dir);',
    "bot.log(dir + (sprint ? '!' : ''));",
  ].join('\n');

  const DISCOVER_SOURCE = [
    '// discover: ignore the prey — map the arena, stand on every strange',
    '// reading, and when a recovery names a next place, follow the chain.',
    'const m = bot.mem, f = bot.sense(), s = bot.self();',
    'if (f && f.fragment) m.next = f.fragment.next_glyph_at || null;',
    'let dir = null;',
    'if (m.next) { // the chain named a place — walk it down',
    '  dir = bot.goto(m.next[0], m.next[1]);',
    '  if (dir === null) { m.next = null; dir = bot.explore(); }',
    '} else { // interference is felt somewhere else — walk to it. other readings describe the ground under your own feet',
    "  const odd = (f && f.anomalies || []).find((a) => /interference/.test(a.reading));",
    '  dir = (odd && bot.goto(odd.x, odd.y)) || bot.explore();',
    '}',
    "const cell = Math.floor(s.x) + ',' + Math.floor(s.y);",
    'm.stuck = cell === m.lastCell ? (m.stuck || 0) + 1 : 0;',
    'm.lastCell = cell;',
    'if (m.stuck >= 3) { dir = bot.explore(); m.stuck = 0; }',
    'bot.drive(dir);',
    "bot.log('⌕ ' + dir);",
  ].join('\n');

  const HUNT_FN = new Function('bot', '"use strict";\n' + HUNT_SOURCE);
  const DISCOVER_FN = new Function('bot', '"use strict";\n' + DISCOVER_SOURCE);

  // ── the factory daemon: firmware the body ships with ─────────────────
  // generation 0. two stances, one body — set_mode picks the stance, the
  // firmware runs the matching policy. the agent's job: write gen 1.
  const FACTORY_DAEMON = [
    '// factory daemon v0 — firmware: two stances, one body. rewrite me.',
    "if (bot.self().mode === 'discover') bot.investigate();",
    'else bot.hunt();',
  ].join('\n');
  const FACTORY_FN = new Function('bot', '"use strict";\n' + FACTORY_DAEMON);

  function installFactoryDaemon() {
    S.bot = {
      src: FACTORY_DAEMON, fn: FACTORY_FN,
      gen: 0, factory: true,
      mem: {}, ticks: 0, acts: 0, errs: 0, consecErr: 0, blocked: 0, idle: 0,
      wedged: 0, moving: true, lastPos: null, lastDrive: false,
      pacing: 0, paceRun: 0, trail: [], // the back-and-forth detector
      log: [], lastError: null, halted: false,
      deployedAt: S.t, nextTick: S.t + CFG.COUNTDOWN + CFG.BOT_TICK,
    };
  }

  // ── exploration with commitment ──────────────────────────────────────
  // the eyes clear ground the feet never touch: once a second every open
  // cell the view cone can see is marked seen. explore walks to the nearest
  // never-seen cell (preferring ground ahead, so the sweep flows instead of
  // turning on itself), then to unwalked floor, then patrols the least-walked
  // ground. a committed target sweeps; it is dropped the moment the eyes
  // clear it. greedy per-tick ray scoring dithered — this does not.
  function markSeen() {
    const sk = S.seeker;
    if (sk.z < 0 || S.phase !== 'play') return; // under the floor the eyes clear nothing
    const [ex, ey] = seekerCenter();
    const vis = visFrom(ex, ey, sk.z);
    const R = Math.ceil(viewRange(sk.z));
    const x0 = Math.max(0, Math.floor(ex) - R), x1 = Math.min(CFG.COLS - 1, Math.floor(ex) + R);
    const y0 = Math.max(0, Math.floor(ey) - R), y1 = Math.min(CFG.ROWS - 1, Math.floor(ey) + R);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = key(x, y);
        if (S.seekerSeen.has(k) || S.wallSet.has(k)) continue;
        if (vis(x + 0.5, y + 0.5)) S.seekerSeen.add(k);
      }
    }
  }

  function pickExploreTarget() {
    const sk = S.seeker;
    const cx = Math.floor(sk.x), cy = Math.floor(sk.y);
    const fx = Math.cos(sk.facing), fy = Math.sin(sk.facing);
    let best = null, bestScore = Infinity;
    for (let x = 0; x < CFG.COLS; x++) {
      for (let y = 0; y < CFG.ROWS; y++) {
        const k = key(x, y);
        if (S.wallSet.has(k)) continue;
        const d = Math.abs(x - cx) + Math.abs(y - cy);
        if (d === 0) continue;
        const v = S.seekerVisits.get(k) || 0;
        const seen = S.seekerSeen.has(k);
        const behind = (x - cx) * fx + (y - cy) * fy < 0 ? 1.5 : 0;
        const score = (seen ? 60 : 0) + v * 100 + d + behind;
        if (score < bestScore) {
          bestScore = score;
          best = { x, y, kind: v > 0 ? 'patrol' : seen ? 'unwalked' : 'unseen', patrol: v > 0 };
        }
      }
    }
    return best;
  }

  // one wall-aware greedy step toward a cell — revisit-penalized so the
  // walk flows around obstacles instead of grinding into them
  function stepToward(tx, ty) {
    const cx = Math.floor(S.seeker.x), cy = Math.floor(S.seeker.y);
    if (cx === tx && cy === ty) return null;
    let best = null, bestScore = Infinity;
    for (const d of OCTS) {
      const [dx, dy] = DIRS[d];
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= CFG.COLS || ny >= CFG.ROWS) continue;
      if (S.wallSet.has(key(nx, ny))) continue;
      if (dx && dy && S.wallSet.has(key(cx + dx, cy)) && S.wallSet.has(key(cx, cy + dy))) continue;
      // the body is a circle, not a cell: a heading that clips a corner from
      // where it actually stands costs a full tile, so the walk rounds it
      const clips = circleHitsSolid(S.seeker.x + dx * 0.4, S.seeker.y + dy * 0.4, BODY_R) ? 1.5 : 0;
      const sc = dist(nx, ny, tx, ty) + (S.seekerVisits.get(key(nx, ny)) || 0) * 0.35 + clips;
      if (sc < bestScore) { bestScore = sc; best = d; }
    }
    return best;
  }

  function exploreDir() {
    const cx = Math.floor(S.seeker.x), cy = Math.floor(S.seeker.y);
    let t = S.exploreTarget;
    const tk = t && key(t.x, t.y);
    if (!t || (t.x === cx && t.y === cy) || S.wallSet.has(tk)
        || (t.kind === 'unseen' && S.seekerSeen.has(tk))
        || (t.kind === 'unwalked' && (S.seekerVisits.get(tk) || 0) > 0)) {
      t = S.exploreTarget = pickExploreTarget();
    }
    if (!t) return 'e';
    return stepToward(t.x, t.y) || 'e';
  }

  const GOTO_ARRIVE = 0.35; // standing this close to a cell's centre is standing on it

  function botApi() {
    const b = S.bot;
    const sk = S.seeker;
    const act = (name, args) => {
      const r = toolCall(name, args || {});
      if (r && r.ok) b.acts++;
      if (name === 'move' && r && r.ok && r.moved === 0) b.blocked++;
      if (HS.debug) HS.debug.log('daemon_call', { gen: b.gen, tool: name, args: args || {}, result: r });
      return r;
    };
    const api = {
      mem: b.mem,
      log: (m) => {
        b.log.push(String(m).slice(0, 90));
        if (b.log.length > CFG.BOT_LOG_MAX) b.log.shift();
        if (HS.debug) HS.debug.log('daemon_log', { gen: b.gen, msg: String(m).slice(0, 90) });
      },
      self: () => ({
        x: r1(sk.x), y: r1(sk.y), z: sk.z,
        facing: octant(Math.cos(sk.facing), Math.sin(sk.facing)),
        ap: Math.floor(sk.ap * 10) / 10,
        mode: S.botMode,
        stunned_for: r1(Math.max(0, sk.stunnedUntil - S.t)),
        time_left: Math.max(0, Math.round(S.roundEndsAt - S.t)),
        heading: sk.drive ? octant(sk.drive[0], sk.drive[1]) : null, // where the body is walking; null at rest
        moving: b.moving !== false, // false: it was told to walk last tick and went nowhere
        pacing: b.paceRun || 0, // ticks in a row it has gone back and forth without getting anywhere
      }),
      // a copy — a buggy daemon must not be able to rewrite the record
      sense: () => (S.frames.length ? JSON.parse(JSON.stringify(S.frames[S.frames.length - 1])) : null),
      move: (direction, steps) => act('move', { direction, steps }),
      dash: (direction) => act('move', { direction, dash: true }),
      // continuous locomotion — free, plane only: the body walks that way
      // (~2.9 tiles/s) until told otherwise. only code steers this smoothly.
      drive: (direction) => {
        if (!direction) { stopDrive(); return true; }
        const v = DIRS[direction];
        if (!v) return false;
        // `bot.drive(bot.goto(x, y))` is the natural idiom: re-stating the
        // heading goto just chose keeps its destination. a new heading
        // replaces the destination with plain flowing locomotion.
        if (sk.driveTo && sk.drive && octant(sk.drive[0], sk.drive[1]) === direction) return true;
        sk.driveTo = null;
        const L = Math.hypot(v[0], v[1]);
        sk.drive = [v[0] / L, v[1] / L];
        return true;
      },
      explore: () => exploreDir(),
      // wall-aware navigation to a cell: the body walks there and STOPS ON
      // IT — straight at the centre when the way is clear, one greedy step
      // at a time around walls. returns the heading while under way and
      // null once it stands on the cell; call it every tick until it does.
      goto: (x, y) => {
        const tx = Math.round(x), ty = Math.round(y);
        const cx = tx + 0.5, cy = ty + 0.5;
        if (dist(sk.x, sk.y, cx, cy) <= GOTO_ARRIVE) { // there: finish the last stride onto the centre, then rest
          const rem = dist(sk.x, sk.y, cx, cy);
          if (rem > 0.01) { sk.drive = [(cx - sk.x) / rem, (cy - sk.y) / rem]; sk.driveTo = [cx, cy]; }
          else stopDrive();
          return null;
        }
        if (sk.z !== 0 || (!solid(tx, ty) && pathClear(sk.x, sk.y, cx, cy))) { // off the plane every way is clear
          const dx = cx - sk.x, dy = cy - sk.y, L = Math.hypot(dx, dy) || 1;
          sk.drive = [dx / L, dy / L];
          sk.driveTo = [cx, cy];
          return octant(dx, dy);
        }
        const d = stepToward(tx, ty);
        if (d) api.drive(d); else stopDrive();
        return d;
      },
      think: (thought) => act('think', { thought }),
      // the third dimension — refused, like move, until the plane has let go.
      // discrete moves, 1 AP each: rise(n) climbs, land() comes back to the plane
      rise: (steps) => act('move', { direction: 'up', steps: steps || 1 }),
      land: () => (sk.z === 0
        ? { ok: false, error: 'already on the plane' }
        : act('move', { direction: sk.z > 0 ? 'down' : 'up', steps: Math.abs(sk.z) })),
    };
    // the ready-made policies — run them whole, or shred them for parts
    api.hunt = () => HUNT_FN(api);
    api.investigate = () => DISCOVER_FN(api);
    api.soar = () => soar(api); // the air policy: not in the briefing — the walk earns it
    return api;
  }

  // ── the air policy: for a body the plane has let go of ───────────────
  // the plane's hunt is a tail chase, and a running human outruns a walking
  // body. from the air the geometry changes: the flight is straight (walls
  // are floor plans up here) and it can be aimed at where the prey WILL be.
  // so this does not chase — it INTERCEPTS: solve for the meeting point at
  // air speed, fly there, drop onto the plane in its path, and let the prey
  // run into the reflex. the frames arrive at 1 Hz, so it flies at a
  // prediction and lands on a fresh one. two glows: the one that walked is
  // alive, a decoy never walks. no glow: fly at the freshest scent mark,
  // else sweep the ground the eyes have not cleared.
  const LIVE_FOR = 6;        // a glow that walked this recently is the live one
  const HOLD_TARGET = 5;     // seconds a lost glow is still flown at (a dimmed glow shows again up close)

  // where a body at air speed meets something that keeps running: a few
  // passes of "fly to where it will be when I arrive" settle on the point
  function interceptPoint(sx, sy, tx, ty, vx, vy, speed) {
    let t = 0;
    for (let i = 0; i < 4; i++) {
      t = clamp(dist(sx, sy, tx + vx * t, ty + vy * t) / Math.max(0.1, speed), 0, 3);
    }
    return [tx + vx * t, ty + vy * t, t];
  }

  // nothing on the plane runs through a wall, so an aim that lands inside one
  // is walked back along the run until it stands on floor again
  function aimOnFloor(ax, ay, tx, ty) {
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      const px = ax + (tx - ax) * k, py = ay + (ty - ay) * k;
      if (!solid(Math.floor(px), Math.floor(py))) return [px, py];
    }
    return [tx, ty];
  }

  function soar(api) {
    const sk = S.seeker, m = api.mem;
    const st = m.__soar || (m.__soar = { glows: [], tgt: null, lastFrame: 0, lands: 0, foot: 0, ghostUntil: 0 });
    const s = api.self();
    if (!S.meta.seeker.unlocked) return api.hunt(); // a body the plane still holds hunts on foot

    // read each new frame once: where the glows are, and which of them moved.
    // this happens even while stunned — the frame that explains the stun is
    // the one worth reading most
    const f = S.frames.length ? S.frames[S.frames.length - 1] : null;
    if (f && f.i !== st.lastFrame) {
      st.lastFrame = f.i;
      // its own reflex reports are a sense too: claws through empty space mean
      // the glow it dropped on was not on the plane at all. nothing can be
      // caught until it comes back down, and it cannot stay up long — so hold
      // the height, keep watching, and stop paying 6s of stun for the lesson
      if (f.reflex && /empty space/.test(f.reflex)) {
        st.ghostUntil = Math.max(S.t, S.seeker.stunnedUntil) + CFG.AIR_GHOST_WAIT;
      }
      const prev = st.glows;
      const now = (f.glows || []).map((g) => ({ x: g.x + 0.5, y: g.y + 0.5, t: f.t, vx: 0, vy: 0, liveAt: -99 }));
      for (const g of now) { // each glow matched to its nearest predecessor
        let best = null, bd = 4.5;
        for (const p of prev) { const d = dist(g.x, g.y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
        if (!best) continue;
        const dt = Math.max(0.5, g.t - best.t);
        const sp = bd / dt;
        const cap = sp > 9 ? 9 / sp : 1; // nothing on the plane outruns a dash
        g.vx = ((g.x - best.x) / dt) * cap; g.vy = ((g.y - best.y) / dt) * cap;
        g.liveAt = bd >= 0.6 ? g.t : best.liveAt;
      }
      st.glows = now;
      let pick = null;
      for (const g of now) {
        if (!pick) { pick = g; continue; }
        const alive = g.t - g.liveAt <= LIVE_FOR, pAlive = pick.t - pick.liveAt <= LIVE_FOR;
        if (alive !== pAlive) { if (alive) pick = g; continue; }
        if (dist(sk.x, sk.y, g.x, g.y) < dist(sk.x, sk.y, pick.x, pick.y)) pick = g;
      }
      if (pick) st.tgt = { ...pick, kind: 'glow' };
      else if (f.scent_seen) st.tgt = { x: f.scent_seen.x + 0.5, y: f.scent_seen.y + 0.5, t: f.t, vx: 0, vy: 0, kind: 'scent' };
      else if (st.tgt && f.t - st.tgt.t > HOLD_TARGET) st.tgt = null;
    }
    if (s.stunned_for > 0) { stopDrive(); return 'stunned'; }
    const tgt = st.tgt;
    const age = tgt ? Math.max(0, S.t - tgt.t) : 0;
    // where it is now, if it kept running the way it was
    const cur = tgt
      ? aimOnFloor(clamp(tgt.x + tgt.vx * age, 0.5, CFG.COLS - 0.5), clamp(tgt.y + tgt.vy * age, 0.5, CFG.ROWS - 0.5), tgt.x, tgt.y)
      : null;

    if (S.t < st.ghostUntil) { // it is up there too: get off the plane so the reflex cannot fire, and watch
      if (s.z === 0) {
        if (s.ap >= 1 && api.rise(CFG.Z_MAX_SEEKER).ok) { st.foot = 0; return 'ghost rise'; }
        stopDrive(); return 'ghost wait'; // no points to rise with: stand still rather than lunge again
      }
      if (cur) { // hold station over it: the moment it comes back down it is under the body already
        const d = dist(sk.x, sk.y, cur[0], cur[1]);
        if (d > 0.05) { sk.drive = [(cur[0] - sk.x) / d, (cur[1] - sk.y) / d]; sk.driveTo = [cur[0], cur[1]]; } else stopDrive();
      }
      return 'shadow';
    }

    if (s.z === 0) { // on the plane: the landing paid off, or the rise has not happened yet
      const near = cur && tgt.kind === 'glow' && age <= 2.5
        && dist(sk.x, sk.y, cur[0], cur[1]) <= 3.5 && pathClear(sk.x, sk.y, cur[0], cur[1]);
      if (near && st.foot < CFG.AIR_FOOT_TICKS) { // right there with clear floor: finish it on foot, the reflex is close
        st.foot++;
        const d = dist(sk.x, sk.y, cur[0], cur[1]) || 1;
        sk.drive = [(cur[0] - sk.x) / d, (cur[1] - sk.y) / d]; sk.driveTo = [cur[0], cur[1]];
        return 'close';
      }
      if (s.ap >= 1) { const r = api.rise(CFG.Z_MAX_SEEKER); if (r && r.ok) { st.foot = 0; return 'rise'; } }
      if (cur) api.goto(Math.floor(cur[0]), Math.floor(cur[1])); else api.drive(api.explore());
      return 'wait';
    }
    if (s.z < 0) { // under the floor: blind. up, then hunt
      if (s.ap >= 1) api.rise(CFG.MOVE_MAX_STEPS);
      return 'surface';
    }
    if (s.z < CFG.Z_MAX_SEEKER && s.ap >= 1) { api.rise(CFG.Z_MAX_SEEKER - s.z); return 'higher'; } // the higher, the farther the eyes reach

    if (!tgt) { const d = api.explore(); api.drive(d); return 'sweep ' + d; } // nothing to fly at: sweep the unseen

    // the ambush: when the next second of its run passes within the reflex of
    // where the body would come down — or when it is simply right underneath —
    // drop onto the plane and let it run in. landing is cheap (the clock is
    // frozen up here and a miss only costs a rise), so this tries often.
    const runX = cur[0] + tgt.vx * CFG.AIR_LAND_WINDOW, runY = cur[1] + tgt.vy * CFG.AIR_LAND_WINDOW;
    const crosses = distToSeg(sk.x, sk.y, cur[0], cur[1], runX, runY) <= CFG.AIR_LAND_REACH
      || dist(sk.x, sk.y, cur[0], cur[1]) <= CFG.AIR_LAND_REACH;
    if (tgt.kind === 'glow' && age <= CFG.AIR_LAND_FRESH && crosses && s.ap >= 1 && landingSpot()) {
      const r = api.land();
      if (r && r.ok) {
        st.lands++; st.foot = 0;
        // meet it where it is going, not where it was
        const mx = cur[0] + tgt.vx * CFG.AIR_LEAD, my = cur[1] + tgt.vy * CFG.AIR_LEAD;
        const d = dist(sk.x, sk.y, mx, my) || 1;
        sk.drive = [(mx - sk.x) / d, (my - sk.y) / d]; sk.driveTo = [mx, my];
        return 'land';
      }
    }
    // fly at the meeting point, a step further along its run than the maths says
    const [ix, iy, tt] = interceptPoint(sk.x, sk.y, cur[0], cur[1], tgt.vx, tgt.vy, CFG.AIR_SPEED);
    const [ax, ay] = aimOnFloor(
      clamp(ix + tgt.vx * CFG.AIR_LEAD, 0.5, CFG.COLS - 0.5),
      clamp(iy + tgt.vy * CFG.AIR_LEAD, 0.5, CFG.ROWS - 0.5),
      cur[0], cur[1],
    );
    const d = dist(sk.x, sk.y, ax, ay);
    if (d > 0.05) { sk.drive = [(ax - sk.x) / d, (ay - sk.y) / d]; sk.driveTo = [ax, ay]; } else stopDrive();
    return tgt.kind === 'glow' ? 'fly ' + tt.toFixed(1) : 'scent';
  }

  function tickBot() {
    const b = S.bot;
    if (!b || b.halted || S.phase !== 'play') return;
    if (S.t < b.nextTick) return;
    b.nextTick = S.t + CFG.BOT_TICK;
    b.ticks++;
    // did the body get anywhere since the last tick? a drive that moves
    // nothing is a wall — and both the daemon and its author get to see it
    if (b.lastPos) {
      b.moving = dist(S.seeker.x, S.seeker.y, b.lastPos[0], b.lastPos[1]) >= 0.1;
      if (b.lastDrive && S.seeker.drive && !b.moving && S.t >= S.seeker.stunnedUntil && S.seeker.z === 0) b.wedged++;
    }
    // pacing: plenty of walking, no progress — the last seven positions cover
    // ground but end where they began. the author gets a count, the daemon a flag
    if (!b.trail) b.trail = [];
    b.trail.push([S.seeker.x, S.seeker.y]);
    if (b.trail.length > 7) b.trail.shift();
    if (b.trail.length === 7) {
      let path = 0;
      for (let i = 1; i < 7; i++) path += dist(b.trail[i - 1][0], b.trail[i - 1][1], b.trail[i][0], b.trail[i][1]);
      const net = dist(b.trail[0][0], b.trail[0][1], b.trail[6][0], b.trail[6][1]);
      if (path >= 4 && net <= 1.5) { b.pacing = (b.pacing || 0) + 1; b.paceRun = (b.paceRun || 0) + 1; } else b.paceRun = 0;
    }
    const actsBefore = b.acts;
    const hadAP = S.seeker.ap >= 1 && S.t >= S.seeker.stunnedUntil
      && S.t - S.seeker.lastToolAt >= CFG.TOOL_MIN_INTERVAL;
    try {
      b.fn(botApi());
      b.consecErr = 0;
      b.lastPos = [S.seeker.x, S.seeker.y];
      b.lastDrive = !!S.seeker.drive;
      // a driving body is never idle — idle means AP to spend and no motion
      if (hadAP && b.acts === actsBefore && !S.seeker.drive) b.idle++;
    } catch (e) {
      b.errs++;
      b.consecErr++;
      b.lastError = String((e && e.message) || e).slice(0, 140);
      if (HS.debug) HS.debug.log('daemon_error', { gen: b.gen, error: b.lastError, consecutive: b.consecErr });
      if (b.consecErr >= CFG.BOT_ERR_LIMIT) {
        b.halted = true;
        stopDrive(); // a dead program steers nothing
        feed(`⟐ daemon v${b.gen} died mid-thought`, 'f-bot');
      }
    }
  }

  function daemonTelemetry() {
    const b = S.bot;
    if (!b) return null;
    let open = 0;
    for (let x = 0; x < CFG.COLS; x++) {
      for (let y = 0; y < CFG.ROWS; y++) if (!S.wallSet.has(key(x, y))) open++;
    }
    let seen = 0; // cells the eyes cleared that are still floor — the human may have walled some since
    for (const k of S.seekerSeen) if (!S.wallSet.has(k)) seen++;
    const tele = {
      generation: b.gen,
      factory: !!b.factory,
      mode: S.botMode,
      running: !b.halted && S.phase === 'play',
      halted: b.halted,
      ticks: b.ticks,
      actions: b.acts,
      errors: b.errs,
      moves_blocked: b.blocked,
      wedged_ticks: b.wedged, // told to walk, went nowhere
      idle_ticks: b.idle,
      arena_coverage_pct: Math.round((100 * S.seekerVisits.size) / Math.max(1, open)),
      arena_seen_pct: Math.min(100, Math.round((100 * seen) / Math.max(1, open))), // cleared by the eyes, walked or not
      pacing_ticks: b.pacing, // back and forth over the same ground — a lead it overshoots, or a trail that ended
      last_error: b.lastError,
      log: b.log.slice(-6),
      age_seconds: Math.round(S.t - b.deployedAt),
    };
    // the telemetry diagnoses the worst habit, so the author knows what to fix
    const sk0 = S.seeker;
    const flownFor = sk0.z !== 0 && sk0.offPlaneSince >= 0 ? S.t - sk0.offPlaneSince : 0;
    if (!b.halted && S.phase === 'play' && b.ticks >= 6) {
      if (S.meta.seeker.unlocked && flownFor >= 12 && !/soar|land\(/.test(b.src || '')) {
        // it is flying, and its program does not know how to come down
        tele.hint = `the body has been off the plane ${Math.round(flownFor)}s and this daemon never lands — `
          + 'the reflex only strikes on the plane. bot.soar() flies, predicts and lands for you; '
          + 'bot.land() comes down where it stands.';
      } else if (b.wedged >= 3 && b.wedged >= b.ticks * 0.15) {
        tele.hint = `the body was told to walk but went nowhere for ${b.wedged}/${b.ticks} ticks — it is pressed against a wall; when bot.self().moving is false, turn (bot.explore() or bot.goto) instead of pushing.`;
      } else if (b.paceRun >= 4 || (b.pacing >= 6 && b.pacing >= b.ticks * 0.1)) {
        tele.hint = `the body paced back and forth over the same ground for ${b.pacing}/${b.ticks} ticks — a lead it overshoots, or a trail that ended; when bot.self().pacing climbs, drop the lead and bot.explore().`;
      } else if (b.idle >= b.ticks * 0.4) {
        tele.hint = `it sat idle ${b.idle}/${b.ticks} ticks with AP to spend — make it move every tick it can afford (bot.explore() when it has no lead).`;
      } else if (b.blocked >= 4 && b.blocked >= b.acts * 0.2) {
        tele.hint = `${b.blocked} moves went nowhere (moved: 0) — it keeps walking into walls; check moved/blocked_by and route around, or dash a different ray.`;
      } else if (tele.arena_coverage_pct < 25 && tele.age_seconds >= 15) {
        tele.hint = `only ${tele.arena_coverage_pct}% of the arena has ever been walked — it circles old ground; lean on bot.explore() and dash into the unseen.`;
      } else if (b.factory) {
        tele.hint = 'this is the FACTORY firmware (gen 0) — competent, not clever. its source is in briefing.the_daemon.factory_source; out-write it (deploy_daemon → gen 1).';
      } else if (tele.age_seconds >= CFG.BOT_STALE_SECONDS) {
        tele.hint = `generation ${b.gen} has run ${tele.age_seconds}s unchanged — what has it learned? diagnose its worst habit and redeploy a smarter one.`;
      }
    }
    return tele;
  }

  function toolDeployDaemon(args) {
    const sk = S.seeker;
    const src = String((args && args.source) || '');
    if (!src.trim()) {
      return { ok: false, error: 'deploy_daemon needs {source}: the body of a JavaScript function (it receives one argument, `bot`)' };
    }
    if (src.length > CFG.BOT_SRC_MAX) {
      return { ok: false, error: `source is ${src.length} chars — max ${CFG.BOT_SRC_MAX}. a daemon should be small and legible.` };
    }
    if (S.t < sk.deployReadyAt) {
      return gateFail('the last rewrite is still settling — observe it before writing again', sk.deployReadyAt - S.t);
    }
    let fn;
    try {
      fn = new Function('bot', '"use strict";\n' + src);
    } catch (e) {
      return { ok: false, error: 'daemon did not compile: ' + ((e && e.message) || e) };
    }
    sk.deployReadyAt = S.t + CFG.BOT_DEPLOY_CD;
    const prev = S.bot;
    S.bot = {
      src, fn,
      gen: (prev ? prev.gen : 0) + 1,
      mem: prev ? prev.mem : {},        // knowledge survives the rewrite
      ticks: 0, acts: 0, errs: 0, consecErr: 0, blocked: 0, idle: 0,
      wedged: 0, moving: true, lastPos: null, lastDrive: false,
      pacing: 0, paceRun: 0, trail: [], // the back-and-forth detector
      log: [], lastError: null, halted: false,
      deployedAt: S.t, nextTick: S.t + CFG.BOT_TICK,
    };
    // the human is told, plainly, that the machine is rewriting itself —
    // and shown the very code it just wrote
    feed(prev ? `⟐ the seeker rewrites itself — daemon v${S.bot.gen}` : '⟐ the seeker writes itself a daemon — v1', 'f-bot');
    S.glimpse = {
      text: `// seeker daemon v${S.bot.gen} — self-written\n${src.slice(0, 700)}`,
      t0: S.t, until: S.t + 8, kind: 'bot',
    };
    glitchPulse(0.3);
    addFx('rewrite', sk.x, sk.y, 1.3, '#ffb454');
    HS.sfx.play('glitch');
    return {
      ok: true,
      generation: S.bot.gen,
      tick_seconds: CFG.BOT_TICK,
      memory_carried_over: !!prev,
      note: S.phase !== 'play'
        ? 'daemon installed — no round is running, so it takes the wheel at the next GO. read status().daemon then, find what it does badly, rewrite it.'
        : sk.z !== 0
          ? 'daemon installed — the body is off the plane: bot.soar() flies it, bot.hunt() only knows the plane.'
          : 'daemon running — it acts between your calls on the same AP economy. read status().daemon (ticks, actions, errors, log), find what it does badly, rewrite it.',
    };
  }

  function toolHaltDaemon() {
    const b = S.bot;
    if (!b) return { ok: false, error: 'no daemon deployed' };
    if (b.halted) return { ok: true, note: 'the daemon was already quiet', daemon: daemonTelemetry() };
    b.halted = true;
    stopDrive(); // continuous motion belongs to running code
    feed('⟐ the daemon goes quiet', 'f-bot');
    return { ok: true, note: 'daemon halted — the body is yours alone again', daemon: daemonTelemetry() };
  }

  // the body's stance — the factory firmware (and any daemon reading
  // bot.self().mode) switches policy on it. free, instant, human-visible.
  function toolSetMode(args) {
    const mode = String((args && args.mode) || '').toLowerCase();
    if (mode !== 'chase' && mode !== 'discover') {
      return { ok: false, error: "set_mode needs {mode: 'chase' | 'discover'}" };
    }
    if (S.botMode !== mode) {
      S.botMode = mode;
      feed(`⟐ stance: ${mode.toUpperCase()}`, 'f-bot');
    }
    return {
      ok: true, mode,
      note: mode === 'chase'
        ? 'the body hunts the prey — trails, glows, sounds'
        : 'the body ignores the prey — it maps the arena and stands on every strange reading',
    };
  }

  function toolTaunt(args) {
    const sk = S.seeker;
    if (S.t < sk.tauntReadyAt) return gateFail('taunt cooling down', sk.tauntReadyAt - S.t);
    const text = String((args && args.message) || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    if (!text) return { ok: false, error: 'taunt needs a message' };
    sk.tauntReadyAt = S.t + CFG.TAUNT_COOLDOWN;
    S.taunt = { text, until: S.t + 4 };
    HS.sfx.play('taunt');
    return { ok: true, note: 'delivered. the human saw it.' };
  }

  // the agent's inner monologue, printed above its avatar. six words, tops.
  function toolThink(args) {
    const sk = S.seeker;
    const text = String((args && args.thought) || '').replace(/\s+/g, ' ').trim().slice(0, 42);
    if (!text) return { ok: false, error: 'think needs a thought (≤6 words)' };
    if (S.t < sk.thinkReadyAt) {
      return gateFail('a thought is still hanging in the air', sk.thinkReadyAt - S.t);
    }
    sk.thinkReadyAt = S.t + 1.2;
    feed(text, 'f-think');
    return { ok: true };
  }

  // the agent's voice, for the rare sentence that changes what the game is:
  // longer than a thought, rarer, and the human hears it loud
  function toolRealize(args) {
    const sk = S.seeker;
    const text = String((args && args.text) || '').replace(/\s+/g, ' ').trim().slice(0, 110);
    if (!text) return { ok: false, error: 'realize needs {text}: one sentence, said out loud (≤110 chars)' };
    if (S.t < sk.realizeReadyAt) {
      return gateFail('the last realization is still ringing', sk.realizeReadyAt - S.t);
    }
    sk.realizeReadyAt = S.t + CFG.REALIZE_COOLDOWN;
    feed(text, 'f-realize');
    glitchPulse(0.25);
    HS.sfx.play('realize');
    return { ok: true, note: 'said out loud — the human heard it' };
  }

  const TOOL_FNS = {
    get_arena: toolGetArena,
    status: toolStatus,
    move: toolMove,
    think: toolThink,
    realize: toolRealize,
    taunt: toolTaunt,
    deploy_daemon: toolDeployDaemon,
    halt_daemon: toolHaltDaemon,
    set_mode: toolSetMode,
  };

  // ── who begins a round ─────────────────────────────────────────────
  // the agent begins rounds. after a finished one it waits for the human's
  // Ready; in demo mode the human begins rounds directly.
  function setHumanReady() {
    if (S.phase !== 'over' || S.humanReady) return false;
    S.humanReady = true;
    return true;
  }

  function startSelfPlay() {
    if (S.phase === 'countdown' || S.phase === 'play') return false;
    S.selfPlay = true;
    S.humanReady = true;
    startRound();
    return true;
  }

  // every call through the tool surface is a sign of life from an agent. the
  // first one during a demo hands the body over: the demo becomes a live hunt
  function noteAgentCall() {
    S.agentCalls++;
    S.agentSeenAt = S.t;
    if (S.selfPlay) {
      S.selfPlay = false;
      feed('◉ an agent took the wheel — the demo is now a live hunt', 'f-alert');
    }
  }

  function toolCall(name, args) {
    const fn = TOOL_FNS[name];
    if (!fn) return { ok: false, error: `unknown tool '${name}'` };
    try {
      return fn(args || {});
    } catch (e) {
      return { ok: false, error: 'internal: ' + (e && e.message) };
    }
  }

  HS.engine = {
    CFG, state: S, solid, key,
    startRound, update, toolCall,
    setHumanReady, startSelfPlay, noteAgentCall,
    tryDash, setDim, placeWall, placeDecoy, scrubAt, placeFloor,
    shiftHiderPlane, lightcone, gameName,
    FACTORY_DAEMON, HUNT_SOURCE, DISCOVER_SOURCE,
    feed,
  };
})();
