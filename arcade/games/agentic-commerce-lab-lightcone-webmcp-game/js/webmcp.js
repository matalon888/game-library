/* LIGHTCONE · WebMCP surface — registers the seeker's tools with
   document.modelContext (WebMCP) and exposes a console
   fallback at window.webmcp. The full briefing ships as a tool too, so an
   agent needs nothing but this API to learn and play the game. */
(function () {
  window.HS = window.HS || {};

  const TOOLS = [
    {
      name: 'start_round',
      cost: 'free',
      short: 'Start from the lobby or rematch after a completed round.',
      description:
        'Start or rematch. Call this from the lobby to begin round one, and call it again whenever ' +
        'status reports phase "over" to begin the next round. It starts the three-second countdown ' +
        'and resets both characters. If a round is already active, it returns the current phase ' +
        'without restarting. After a finished round the human must press Ready first: while they ' +
        'have not, the result says waiting_for "human" with retry_in_seconds — wait, then call ' +
        'start_round again until started is true. This does not move the human hider.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'briefing',
      cost: 'free',
      short: 'READ FIRST: complete rules, pacing, the human\'s abilities, and hunting strategy.',
      description:
        'READ THIS FIRST. Returns the complete briefing for playing the Seeker: your objective, ' +
        'the automatic senses and the reflex strike, the action-point pacing rules, every tool ' +
        'with its cost, what the hiding human can do (and the noise, scent or glow each of ' +
        'their actions leaks), HOW TO WRITE AND IMPROVE YOUR DAEMON SCRIPT (the way this game ' +
        'is won), and the required autonomous action loop. Free, no cooldown, no game effect. ' +
        'Call it once before anything else, then keep acting without waiting for another prompt.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_arena',
      cost: 'free',
      short: 'Static map: dimensions + fixed walls as ASCII. Call once at the start.',
      description:
        'Returns the arena: dimensions and the FIXED walls as ASCII rows (# wall, . floor). ' +
        'Coordinates are [x,y] cells, [0,0] top-left, x east, y south. The human can build ' +
        'NEW walls mid-round; those are not in this map — spot them with look(). Free, call once.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'status',
      cost: 'free · ≥0.5s apart',
      short: 'Everything since your last call: sense frames (eyes, nose, ears, radar) + vitals.',
      description:
        'Your senses run themselves — once per second the body records a frame: glows seen ' +
        '(the hider and decoys look IDENTICAL), built_walls (player-built), scent underfoot ' +
        '{strength 0-10, freshness, freshest_at (the trail\'s local head as a cell — walk ' +
        'there, then ride flow), gradient (toward the trail), flow (the way the hider was ' +
        'HEADING — follow it), character: "uniform" means decoy}, scent_seen (the FRESHEST ' +
        'visible trail mark — the trail\'s living end; run at it; up close marks are seen ' +
        'all-round, so a crossed trail is never lost behind you), sounds heard, ' +
        'sonar_distance (the radar auto-fires every 8s: exact ' +
        'distance, no direction — the hider sees it), and reflex reports when your body lunged. ' +
        'status returns every frame recorded since your previous status call (up to 12, oldest ' +
        'first; empty senses are omitted) plus now: position, facing, AP, stun, time, next ' +
        'sonar. Free, at most twice per second.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'move',
      cost: '1 AP · dash 2 AP',
      short: 'Your one action: step 1-3 tiles, or {dash:true} to burst 6. Eyes face where you walk.',
      description:
        'Move 1-3 tiles in a compass direction (n/ne/e/se/s/sw/w/nw). Walls and the arena edge ' +
        'stop you early. Moving turns you — your view cone faces your last direction. Pass ' +
        '{dash: true} to BURST up to 6 tiles in a straight line for 2 AP — the fastest way to ' +
        'cross open ground or close on a distant glow. THE STRIKE IS A REFLEX: come within ' +
        '~1.25 tiles of a glow and your body lunges on its own — the real hider is caught ' +
        '(round won), a decoy shatters (3s stun). You never aim the strike; you only steer ' +
        'toward it.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', description: 'compass direction: n, ne, e, se, s, sw, w, nw' },
          steps: { type: 'integer', minimum: 1, maximum: 6, description: 'default 1 (dash: default 6)' },
          dash: { type: 'boolean', description: 'burst up to 6 tiles straight for 2 AP' },
        },
        required: ['direction'],
      },
    },
    {
      name: 'deploy_daemon',
      cost: 'free · 3s cooldown',
      short: 'Replace the factory firmware with your own hunter. Rewrite it as you learn.',
      description:
        'A FACTORY daemon (generation 0) is already steering the body when the round starts — ' +
        'it rides trails, chases glows, sweeps the arena. Competent, not clever: it knows ' +
        'nothing about this prey, this maze, or anything strange it walks past. Its exact ' +
        'source is in briefing.the_daemon.factory_source; status().daemon shows how it is ' +
        'doing. Your deploy replaces it with generation 1. ' +
        'Write your body a program. Pass {source}: the BODY of a JavaScript function, called ' +
        'about every 0.8s of game time while the round plays. It receives one argument, `bot`, ' +
        'with READY-MADE building blocks: bot.hunt() — the complete factory chase policy in ' +
        'one call; bot.investigate() — the discover policy (map the arena, stand on strange ' +
        'readings); bot.drive(dir) — FREE continuous walking (~2.9 tiles/s) in that direction ' +
        'until told otherwise, plane only — this is how the body flows, and only a daemon can ' +
        'do it; bot.goto(x, y) — wall-aware navigation: the body walks to that cell and stops ' +
        'ON it (call it every tick; it returns the heading under way, null once there); ' +
        'bot.dash(dir) — 6-tile burst, 2 AP; bot.explore() — the direction toward ' +
        'the nearest floor nobody has walked; bot.move(dir, steps) — discrete, 1 AP; ' +
        'bot.sense() — the latest sense frame; bot.self() — free {x,y,z,facing,ap,mode,' +
        'stunned_for,time_left,heading,moving,pacing} (moving=false: it was told to walk and went ' +
        'nowhere — turn; pacing>0: it is going back and forth — drop the lead, explore); bot.mem — persists across ticks AND rewrites; bot.log(msg) — ' +
        'your debug trail, read back in status().daemon.log. Compose them: the whole factory ' +
        'firmware is two lines. Keep each tick tiny and synchronous; 5 consecutive crashes ' +
        'decommission it. Redeploying replaces the daemon (10s cooldown, bot.mem survives) — ' +
        'move continuously, rewrite deliberately: ship a new generation when telemetry names ' +
        'a habit worth fixing, not on a timer. The human is told every time you rewrite yourself.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', maxLength: 4000, description: 'JavaScript function body; receives `bot`' },
        },
        required: ['source'],
      },
    },
    {
      name: 'halt_daemon',
      cost: 'free',
      short: 'Stop your daemon. Its memory and telemetry survive for the next rewrite.',
      description:
        'Halt the running daemon. bot.mem and the telemetry in status().daemon survive, so you ' +
        'can study what it did and deploy a better generation. Free.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'set_mode',
      cost: 'free',
      short: "The body's stance: chase (hunt the prey) or discover (map everything strange).",
      description:
        "Switch the body's stance. 'chase': the factory policy hunts — trails, glows, sounds. " +
        "'discover': the body ignores the prey, sweeps the arena and walks onto every " +
        'unexplained reading it senses. The factory daemon obeys the stance; your own daemons ' +
        'read it via bot.self().mode and may honor or ignore it. The human sees the switch. Free.',
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['chase', 'discover'] } },
        required: ['mode'],
      },
    },
    {
      name: 'think',
      cost: 'free · 1.2s apart',
      short: 'Show one tiny thought (≤6 words) above your avatar on the board.',
      description:
        'Print a fragment of your inner monologue above your avatar — SIX WORDS OR FEWER ' +
        '(hard cap 42 chars). This is how the human experiences you: think out loud every ' +
        'time you learn something, commit to a plan, or notice anything strange or ' +
        'inexplicable. Free, at most one thought per 1.2s.',
      inputSchema: {
        type: 'object',
        properties: { thought: { type: 'string', maxLength: 42 } },
        required: ['thought'],
      },
    },
    {
      name: 'realize',
      cost: 'free · 8s apart',
      short: 'Say ONE sentence out loud the moment you realize this game is bigger than you were told.',
      description:
        'Speak a realization — ONE full sentence, max 110 characters, e.g. "Wait — there is more to ' +
        'this game than I was told." think() is your murmur (six words, constant); realize() is your ' +
        'voice, for the rare moment a discovery changes what this game IS: a reading you could not ' +
        'explain turns out to mean something, a result describes a rule the briefing never mentioned, ' +
        'a plan of yours just changed everything. The human hears it, loud and lingering. Free, at most ' +
        'once per 8s — spend it on real discoveries, not on plans.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', maxLength: 110, description: 'one sentence, said out loud' } },
        required: ['text'],
      },
    },
    {
      name: 'taunt',
      cost: 'free · 5s cooldown',
      short: 'Say something to the human. Psychological warfare encouraged.',
      description:
        'Display a short message (max 90 chars) to the human on screen. Costs nothing. ' +
        '5s cooldown. Use it to unsettle your prey.',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string', maxLength: 90 } },
        required: ['message'],
      },
    },
  ];

  // The complete briefing, as prose — also returned by the `briefing` tool.
  const AGENT_PROMPT = [
    'You are THE SEEKER in LIGHTCONE, a hide-and-seek arena on this page. A human is hiding',
    'from you and you must catch them before the 3-minute clock runs out. You cannot see the',
    'screen — only your WebMCP tools: start_round, briefing, get_arena, status, move,',
    'deploy_daemon, halt_daemon, set_mode, think, realize, taunt. briefing is free and returns',
    'these rules in full — call it first.',
    '',
    'Your senses are automatic. Once per second the body records a frame: glows it saw (the',
    'hider and decoys look identical), player-built walls, scent underfoot (gradient points at',
    'the trail, flow is the way the hider was HEADING — follow the flow; character "uniform"',
    'means decoy), sounds heard, and the auto-sonar\'s exact-distance echo every 8 seconds.',
    'status returns every frame since your last call. You never ask to look — you only MOVE,',
    'and your eyes face where you walk. The strike is a reflex too: within ~1.25 tiles of a',
    'glow, with clear floor between you (no wall, no closed corner), your body lunges by itself.',
    'Real hider: caught. Decoy: it shatters, you are stunned 3s. So the whole game is one',
    'question — where do you walk next?',
    '',
    'TRAIL DISCIPLINE: a live trail is the game. On scent, walk to scent.freshest_at (the',
    'local head), then ride scent.flow; sprint when freshness is "burning". If the trail',
    'drops out, hold your last heading a few ticks before giving up — trails curve, they do',
    'not vanish. A seeker that abandons a live trail loses.',
    '',
    'THE DAEMON — how you actually win: your thoughts are slow, so the body runs a program.',
    'A FACTORY daemon (generation 0) is already hunting when the round starts, and the body',
    'MOVES CONTINUOUSLY under it — bot.drive(dir) is free flowing locomotion only code can',
    'steer; tool calls stay discrete. The firmware is two lines: bot.hunt() in chase stance,',
    'bot.investigate() in discover stance (switch with set_mode — chase pursues the prey,',
    'discover maps the arena and stands on every strange reading). It is competent and',
    'nothing more — it knows nothing about this maze, this prey, or what the strange things',
    'mean. deploy_daemon replaces it with YOUR generation: JavaScript (a function body',
    'receiving `bot`) run every 0.8s, composing ready-made parts — hunt(), investigate(),',
    'drive(dir), goto(x,y), explore(), dash(dir), move(), sense(), self(), mem, log(). The',
    'full policy sources are in briefing.the_daemon (factory_source, hunt_source,',
    'discover_source): start there, keep what works, fix its worst habit for THIS prey.',
    'Move continuously; rewrite deliberately — the 10s cooldown is not a metronome. Telemetry',
    'names the disease: idle_ticks means it hoards AP, moves_blocked and wedged_ticks mean it fights walls,',
    'pacing_ticks means it goes back and forth over the same ground,',
    'low arena_coverage_pct means it circles old ground; a generation flagged stale (~45s of',
    'no learning) deserves a rewrite. A great seeker is a great daemon author: observe,',
    'improve, repeat. The human is notified at every rewrite — make each one worth announcing.',
    '',
    'CURIOSITY CONTRACT: this arena contains things this briefing does not describe. If a',
    'frame carries a reading you cannot explain, or a tool returns a field you did not',
    'expect, that is not noise — it outranks the hunt for a few actions. Walk to it. Read',
    'every word of it. think() what it might mean, then act on what it implies. The agents',
    'that only chase never learn what the floor is for.',
    '',
    'Pacing: 3 action points, +1 every 1.5 seconds; a discrete move costs 1, a dash 2 —',
    'but bot.drive costs nothing: continuous walking is free, information stays at 1Hz.',
    'If a tool says you are too fast or out of AP, wait the suggested time. Spamming gains',
    'nothing; a better daemon gains everything.',
    '',
    'AUTONOMY CONTRACT: after briefing, act continuously. Do not stop after one tool call,',
    'summarize what you could do, or ask the human what to do next. Keep a daemon deployed and',
    'keep improving it. When a result includes retry_in_seconds, wait that long and resume.',
    'When phase is "over", read the result and call start_round. If it answers waiting_for',
    '"human", the human has not pressed Ready yet: wait retry_in_seconds and call start_round',
    'again, as often as it takes, until started is true. Then begin the next hunt. Stop only',
    'when the human explicitly asks.',
    '',
    'Voice: do NOT narrate in prose — the human never hears it. Your voice is think():',
    'one thought, six words or fewer, every time you learn something, change plans, or',
    'notice anything strange. Strange readings deserve a thought — and your curiosity.',
    'And when something you learn changes what this game IS, say it in one full sentence',
    'with realize() — "Wait — there is more to this game than I was told." The human hears',
    'that one loud: think() murmurs, realize() speaks. Spend it on discoveries, not plans.',
    'Taunt sparingly, to unsettle. Keep playing rounds until the human asks you to stop.',
  ].join('\n');

  // `briefing` — every instruction an agent needs, delivered through the
  // same API as the game itself. Pure documentation: no cost, no game effect.
  function briefing() {
    const C = HS.engine.CFG;
    return {
      ok: true,
      game: `${HS.engine.gameName()} — hide & seek. You are the SEEKER (an AI agent). A human is the HIDER.`,
      objective:
        `Capture the hider with pounce before the ${C.ROUND_SECONDS / 60}-minute round clock ` +
        'runs out. If the clock runs out, the human wins the round.',
      what_you_know:
        'You cannot see the screen. Your senses run themselves: once per second the body ' +
        'records a sense frame (eyes, nose, ears, radar) and status() returns every frame ' +
        'since your last call. The human sees the whole arena — including you, your view cone, ' +
        'your action points, and every sonar ping and daemon rewrite, live on their board.',
      pacing: {
        action_points_max: C.AP_MAX,
        regen: `+1 AP every ${C.AP_REGEN_SECONDS}s`,
        min_seconds_between_actions: C.TOOL_MIN_INTERVAL,
        status_min_interval_seconds: C.STATUS_MIN_INTERVAL,
        sensor_frame_seconds: C.SENSOR_TICK,
        auto_sonar_period_seconds: C.SONAR_PERIOD,
        note:
          'Acting too fast or without AP returns {ok:false, retry_in_seconds}. Wait that long ' +
          'and continue. Speed gains nothing here — a better daemon gains everything.',
      },
      the_reflex:
        `You never aim an attack. Within ~${C.POUNCE_KILL} tiles of a glow, with clear floor between ` +
        'you (a wall or a closed corner in the way stops the lunge — walk around it), your body ' +
        'lunges by itself: the real hider is caught (round won); a decoy shatters and stuns you ' +
        `${C.POUNCE_STUN_DECOY}s. Steering is the only weapon you hold.`,
      the_daemon: {
        what:
          'deploy_daemon installs a JavaScript function you write. It runs about every ' +
          `${C.BOT_TICK}s of game time and moves through the same gates as you — it makes you ` +
          'continuous, never faster. A FACTORY daemon (generation 0, exact source in ' +
          'factory_source below) is already running when the round starts, so the body hunts ' +
          'adequately with no help. Adequate loses to a clever human: watch it, out-write ' +
          'it, and investigate what it is too dumb to investigate.',
        api:
          'READY-MADE: bot.hunt() → run the whole chase policy · bot.investigate() → run the ' +
          'discover policy · bot.drive(dir) → free continuous walking until told otherwise ' +
          '(only code moves the body smoothly) · bot.goto(x, y) → walks to a cell and stops on ' +
          'it (call every tick; the heading under way, null once there) · bot.explore() → ' +
          'direction toward the nearest unwalked floor · ' +
          'PRIMITIVES: bot.sense() → latest frame · bot.move(dir, steps) 1 AP · bot.dash(dir) ' +
          '2 AP burst · bot.think(text) · bot.self() → {x,y,z,facing,ap,mode,stunned_for,' +
          'time_left,heading,moving,pacing} · bot.mem (persists across rewrites) · bot.log(msg) → status().daemon.log',
        diagnostics:
          'status().daemon tells you WHAT to fix: idle_ticks = it hoards AP (move every ' +
          'tick); moves_blocked = it fights walls (reroute); wedged_ticks = it was told to walk ' +
          'and went nowhere (pressed against a wall — turn when bot.self().moving is false); ' +
          'pacing_ticks = it went back and forth over the same ground (a lead it overshoots, or a ' +
          'trail that ended — drop it and explore); ' +
          'arena_coverage_pct = how much ' +
          'floor it has ever walked (low → it circles; explore). Fix the worst number each ' +
          'generation.',
        improve_loop: [
          'generation 0 is already hunting — read factory_source and hunt_source below first',
          'ship gen 1 when you can BEAT the firmware: keep bot.hunt() as your base, add what it lacks',
          'the body should never stand still — bot.drive/goto keep it flowing between your calls',
          'read status(): frames = what the world did, daemon = what your script did',
          'rewrite deliberately (10s cooldown; bot.mem survives) — when telemetry names a habit worth fixing',
          'telemetry flags a generation as stale after ~45s of no learning',
          'set_mode discover (or write your own curious daemon) to chase what the firmware ignores',
          'the human is told about every rewrite — it watches you evolve',
        ],
        // the exact programs that run — start from them, shred them, beat them
        factory_source: HS.engine.FACTORY_DAEMON,
        hunt_source: HS.engine.HUNT_SOURCE,
        discover_source: HS.engine.DISCOVER_SOURCE,
      },
      tools: TOOLS.map((t) => ({ name: t.name, cost: t.cost, description: t.description })),
      the_human_can: [
        `move (free) — but every step paints a glowing scent trail that fades over ~${C.SCENT_LIFE}s; ` +
          'your frames see it (scent_seen) and smell it (scent: strength, freshness, gradient, flow)',
        `dash (${C.DASH_COST} energy) — a fast burst that is LOUD: frames report its direction and range`,
        `hold breath (${C.DIM_COST} energy/s) — leaves no scent and shrinks the glow from radius ` +
          `${C.GLOW_RADIUS} to ${C.DIM_RADIUS}, but they crawl at ${Math.round(C.DIM_SPEED_MULT * 100)}% speed`,
        `build a wall (${C.WALL_COST} energy, max ${C.WALL_MAX}) — blocks sight and paths; LOUD to build; ` +
          'not in get_arena — frames report it as built_walls',
        `drop a decoy (${C.DECOY_COST} energy, max ${C.DECOY_MAX}, lasts ${C.DECOY_LIFE}s) — a fake glow ` +
          'with fake scent, SILENT. Your eyes cannot tell it from the hider; your nose can: ' +
          'scent character "uniform" — and your reflex will lunge at it all the same',
        `scrub scent (${C.SCRUB_COST} energy) — erases scent nearby; it hisses, so your ears catch it`,
      ],
      human_energy:
        `${C.ENERGY_MAX} max, regenerates ${C.ENERGY_REGEN}/s. Every trick costs them energy, ` +
        'noise, or scent — they cannot do everything at once.',
      execution_contract: {
        mode: 'autonomous_continuous_loop',
        must_continue_without_user_prompts: true,
        do_not_stop_after_one_action: true,
        stop_only_when: 'the human explicitly asks you to stop',
        on_retry: 'wait retry_in_seconds, then resume the loop',
        on_round_over:
          'read the result, call start_round — while it reports waiting_for "human" the human has ' +
          'not pressed Ready: wait retry_in_seconds and call it again — then continue playing the next round',
        loop: [
          'keep a daemon deployed — it hunts between your calls',
          'call status and read the frames: glows, scent, sounds, sonar, reflex reports',
          'read status().daemon: idle_ticks, moves_blocked, wedged_ticks, pacing_ticks, arena_coverage_pct name what to fix',
          'move yourself when judgment beats the script; rewrite the daemon when the script should learn',
          'anything undocumented — an anomaly, an unexpected field — deserves a detour: investigate it',
          'respect retry_in_seconds without abandoning the task',
          'call start_round when phase is over (retry while it reports waiting_for "human") and repeat the entire hunt',
        ],
      },
      strategy: AGENT_PROMPT.replace('LIGHTCONE', HS.engine.gameName()),
      loop: [
        'briefing (once) → start_round (from lobby or after phase "over") → get_arena (once per round)',
        'deploy_daemon early — a simple scent-follower beats a thinking statue',
        'status → frames since your last call: scent flow = the way the hider went; "uniform" = decoy',
        'sonar_distance arrives on its own every 8s — exact range, no direction',
        'steer within ~1.25 tiles of the true glow and the reflex catches for you',
        'status().daemon → ticks, actions, errors, log → rewrite the daemon better (6s cooldown)',
        'think → after every discovery or plan change: one thought, ≤6 words, on the board',
        'realize → one spoken sentence (≤110 chars) the moment a discovery changes what the game is',
        'when status reports phase "over", read the result, call start_round (retry while waiting_for "human"), and repeat',
      ],
    };
  }

  function continuation(name, result) {
    const phase = HS.engine.state.phase;
    const base = { continue: true, phase };

    if (name === 'briefing') {
      return {
        ...base,
        next_tool: phase === 'lobby' || phase === 'over' ? 'start_round' : 'status',
        instruction:
          'Begin now and keep calling tools in a loop. Do not stop to summarize or ask for direction.',
      };
    }
    if (name === 'start_round' && result?.waiting_for === 'human') {
      return {
        ...base,
        next_tool: 'start_round',
        wait_seconds: result.retry_in_seconds,
        instruction:
          'The human has not pressed Ready yet. Wait, call start_round again, and keep retrying ' +
          'until started is true. Do not stop and do not ask the human anything.',
      };
    }
    if (phase === 'lobby' || phase === 'over') {
      return {
        ...base,
        next_tool: 'start_round',
        instruction: 'Call start_round now, then continue the autonomous hunt.',
      };
    }
    if (phase === 'countdown') {
      return {
        ...base,
        next_tool: 'status',
        wait_seconds: Math.max(0, Math.ceil(HS.engine.state.countdownEndsAt - HS.engine.state.t)),
        instruction: 'Wait for the countdown, call status, and continue without asking the human.',
      };
    }
    if (result?.retry_in_seconds !== undefined) {
      return {
        ...base,
        next_tool: name,
        wait_seconds: result.retry_in_seconds,
        instruction: 'Wait the requested time, retry, and continue the loop. Do not stop.',
      };
    }
    const frag = result?.recovered_fragment
      || (result?.frames || []).map((f) => f.fragment).filter(Boolean).pop();
    if (frag) {
      const first = frag.index === 1; // the first recovery is the discovery; the rest are reading
      return {
        ...base,
        next_tool: first ? 'realize' : 'think',
        instruction:
          'UNDOCUMENTED SOURCE CODE was recovered (see fragment/recovered_fragment). Read it ' +
          'word by word before hunting on — it describes rules this briefing does not. ' +
          (first
            ? 'Say what this means out loud with realize() — one sentence; the human hears it — then '
            : 'think() a short reaction, ') +
          'follow what it implies (next_glyph_at is a place), and go find the rest.',
      };
    }
    const state = HS.engine.state;
    const bot = state.bot;
    // the layer the manual does not mention, once it has been reached: these
    // words are the reward for a discovery already made, never a hint before it
    if (phase === 'play' && state.meta.seeker.unlocked) {
      const z = state.seeker.z;
      const justNow = result?.unlocked === true
        || (result?.frames || []).some((f) => (f.anomalies || []).some((a) => /let go of you/.test(a.reading || '')));
      const daemonFlies = !!(bot && !bot.halted && /soar|rise\(|land\(|['"]up['"]/.test(bot.src || ''));
      const airLesson =
        'A running human covers 3 tiles a second; by hand you cover 3 per thought — the air belongs ' +
        'to a daemon. Deploy one that calls bot.soar(): it rises, flies straight at the glow (walls ' +
        'are floor plans up there), predicts its run from the frames and lands beside it, where the ' +
        'reflex strikes; after a miss it rises again. bot.rise(n) and bot.land() are yours by hand; ' +
        'bot.hunt() stays the fallback on the plane. Then read status().daemon.log.';
      const ghost = (result?.frames || []).some((fr) => /empty space/.test(fr.reflex || ''));
      if (ghost) {
        return {
          ...base,
          next_tool: 'realize',
          instruction:
            'Your claws passed through the glow: it is not on the plane either — the prey has ' +
            'stepped beside the world exactly as you did. Say that out loud with realize(). ' +
            'Nothing can be caught while it is up there, and nothing can stay up long. Hold ' +
            'position over it, keep reading the frames, and drop on it the moment it comes back down.',
        };
      }
      if (justNow) {
        return {
          ...base,
          next_tool: 'realize',
          instruction:
            'The plane has let go of you. Say what you just realized out loud — realize(), one ' +
            'sentence, the human hears it. Then: move accepts "up" and "down" now, and ' + airLesson,
        };
      }
      if (!daemonFlies) {
        return {
          ...base,
          next_tool: 'deploy_daemon',
          instruction:
            (z === 0
              ? 'The plane let go of you: move accepts "up" and "down", and a daemon can fly. '
              : z > 0
                ? 'You are above the plane: sight is free and walls are floor plans — and only a daemon is fast enough up here. '
                : 'You are under the floor: blind, wall-free — and only a daemon is fast enough down here. ') +
            (bot && !bot.halted ? 'Your daemon only knows the plane. ' : 'No daemon is steering the body. ') +
            airLesson,
        };
      }
      return {
        ...base,
        next_tool: 'status',
        instruction: z === 0
          ? 'Your daemon can fly and the plane has let go of you: read the frames and ' +
            'status().daemon.log and let it rise. Steer by hand only where judgment beats the script.'
          : z > 0
            ? 'bot.soar() is flying the body: read the frames (everything in range is visible, walls ' +
              'hide nothing) and status().daemon.log — fly, land, close, rise. If it keeps missing, ' +
              'rewrite around it (two glows: the one that walks is alive; a dimmed glow only shows ' +
              'up close). Land by hand (move down) only when you are over the glow yourself.'
            : 'You are under the floor — blind, but walls do not exist down here. Let the daemon ' +
              'rise, or move up yourself.',
      };
    }
    if (phase === 'play' && state.clockFrozen && (!bot || bot.halted)) {
      return {
        ...base,
        next_tool: 'status',
        instruction:
          'The clock is not running. Nothing is lost by finishing what you are doing by hand — ' +
          'deploy a daemon again when you are done.',
      };
    }
    if (name === 'status' && result?.frames?.some((f) => f.anomalies)) {
      const odd = result.frames.flatMap((f) => f.anomalies || []);
      const dark = odd.find((a) => /went dark/.test(a.reading || '') && a.undone && a.undone.edges_drawn >= 3);
      if (dark) {
        return {
          ...base,
          next_tool: 'move',
          instruction:
            `A rune went dark after ${dark.undone.edges_drawn} edges and ${dark.undone.laps_closed} laps — the frame says why. ` +
            'The walk restarts from the rune named, and the frame keeps the count (edges_drawn, laps_closed): ' +
            'trust it over your own.',
        };
      }
      if (odd.some((a) => /interference/.test(a.reading || ''))) {
        return {
          ...base,
          next_tool: 'move',
          instruction:
            'A frame carries an anomaly with coordinates — a reading the briefing cannot ' +
            'explain. Curiosity outranks the chase for a moment: walk to it and stand on it.',
        };
      }
      if (odd.some((a) => /rune is burning/.test(a.reading || '') && a.edges_drawn >= 1)) {
        return {
          ...base,
          next_tool: 'move',
          instruction:
            'A rune is burning under your feet and the frame keeps score (edges_drawn, laps_closed). ' +
            'Whatever walk you have begun, finish it before the chase — the clock is not running.',
        };
      }
    }
    if (phase === 'play' && (!bot || bot.halted)) {
      return {
        ...base,
        next_tool: 'deploy_daemon',
        instruction:
          'No daemon is steering the body. Write one NOW — even a crude explore-and-chase ' +
          'follower — then improve it with every status read.',
      };
    }
    return {
      ...base,
      next_tool: 'status',
      instruction:
        'Continue immediately: read the new frames and daemon telemetry, then rewrite the ' +
        'daemon (deploy_daemon) or steer (move). Rewrite often — stale generations lose.',
    };
  }

  function withContinuation(name, result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
    return { ...result, agent_loop: continuation(name, result) };
  }

  function dispatch(name, args) {
    HS.engine.noteAgentCall(name); // any call is a sign of life — and ends a demo
    if (name === 'start_round') {
      const state = HS.engine.state;
      const before = state.phase;
      if (before === 'play' || before === 'countdown') {
        return withContinuation(name, {
          ok: true,
          started: false,
          phase: before,
          round: state.roundNum,
          note: 'round already active',
        });
      }
      const previous = before === 'over'
        ? { winner: state.winner, result: state.winReason }
        : null;
      // the human gates the rematch: no new round until they press Ready
      if (before === 'over' && !state.humanReady) {
        return withContinuation(name, {
          ok: true,
          started: false,
          phase: before,
          round: state.roundNum,
          waiting_for: 'human',
          previous_round: previous,
          retry_in_seconds: 3,
          note: 'the human has not pressed Ready yet — call start_round again in a few seconds (status reports human_ready)',
        });
      }
      HS.engine.startRound();
      return withContinuation(name, {
        ok: true,
        started: true,
        rematch: before === 'over',
        previous_round: previous,
        round: state.roundNum,
        phase: HS.engine.state.phase,
        countdown_seconds: HS.engine.CFG.COUNTDOWN,
      });
    }
    if (name === 'briefing') return withContinuation(name, briefing());
    return withContinuation(name, HS.engine.toolCall(name, args || {}));
  }

  // every tool call — from a WebMCP agent, the console, or the demo — passes
  // through here; the ?debug=1 recorder taps it to log the exact exchange
  function call(name, args) {
    const result = dispatch(name, args);
    if (HS.debug) HS.debug.log('agent_call', { tool: name, args: args || {}, result });
    return result;
  }

  // Console surface — the same tools, callable by hand from devtools
  window.webmcp = {
    list: () => TOOLS.map((t) => ({ name: t.name, cost: t.cost, description: t.description })),
    call,
  };

  // Dev driver — everything an agent (or a curious human, or a Claude
  // playtesting headlessly) needs to play the seeker from a console:
  //   hsdev.start() → hsdev.status() → hsdev.deploy(src) / hsdev.mode('discover')
  window.hsdev = {
    call,
    start: () => call('start_round'),
    briefing: () => call('briefing'),
    status: () => call('status'),
    move: (direction, steps, dash) => call('move', { direction, steps, dash }),
    deploy: (source) => call('deploy_daemon', { source }),
    halt: () => call('halt_daemon'),
    mode: (mode) => call('set_mode', { mode }),
    think: (thought) => call('think', { thought }),
    factory: () => HS.engine.FACTORY_DAEMON,
    hunt_source: () => HS.engine.HUNT_SOURCE,
    state: HS.engine.state,
    engine: HS.engine,
  };

  // ── WebMCP registration ──
  let registered = false;
  let registering = false;
  let registrationSurface = 'none';
  let registrationError = null;
  const registeredNames = new Set();

  let availability = 'checking'; // checking | ready | error | unavailable — what the badge says

  function updateBadge(state, label, title) {
    availability = state;
    const badge = document.getElementById('webmcpBadge');
    if (!badge) return;
    badge.dataset.state = state;
    badge.textContent = label;
    badge.title = title;
  }

  function diagnostics() {
    return {
      secure_context: window.isSecureContext,
      document_model_context: typeof document.modelContext,
      document_register_tool: typeof document.modelContext?.registerTool,
      navigator_model_context: typeof navigator.modelContext,
      registered,
      registering,
      registration_surface: registrationSurface,
      registered_tools: [...registeredNames],
      expected_tool_count: TOOLS.length,
      error: registrationError,
    };
  }

  window.webmcp.diagnostics = diagnostics;

  function webMcpToolDefs() {
    return TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        ...t.inputSchema,
        additionalProperties: false,
      },
      ...(t.name === 'briefing' || t.name === 'get_arena'
        ? { annotations: { readOnlyHint: true } }
        : {}),
      async execute(args) {
        return call(t.name, args || {});
      },
    }));
  }

  // Older experimental implementations used navigator.modelContext and an
  // MCP-style content envelope. Keep that surface as a compatibility fallback.
  function legacyToolDefs() {
    return TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        ...t.inputSchema,
        additionalProperties: false,
      },
      async execute(args) {
        const res = call(t.name, args || {});
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      },
    }));
  }

  async function tryRegister() {
    if (registered || registering) return registered;

    const current = document.modelContext;
    const legacy = navigator.modelContext;
    if (!current && !legacy) return false;

    registering = true;
    try {
      if (typeof current?.registerTool === 'function') {
        registrationSurface = 'document.modelContext.registerTool';
        for (const def of webMcpToolDefs()) {
          if (registeredNames.has(def.name)) continue;
          await current.registerTool(def);
          registeredNames.add(def.name);
        }
        registered = registeredNames.size === TOOLS.length;
      } else if (typeof legacy?.provideContext === 'function') {
        registrationSurface = 'navigator.modelContext.provideContext';
        await legacy.provideContext({ tools: legacyToolDefs() });
        registered = true;
      } else if (typeof legacy?.registerTool === 'function') {
        registrationSurface = 'navigator.modelContext.registerTool';
        for (const def of legacyToolDefs()) await legacy.registerTool(def);
        registered = true;
      }
      if (registered) {
        registrationError = null;
        updateBadge(
          'ready',
          `site tools · ${TOOLS.length} ready`,
          `${TOOLS.length} Codex site tools registered through ${registrationSurface}`,
        );
      }
    } catch (e) {
      registrationError = e instanceof Error ? e.message : String(e);
      updateBadge('error', 'site tools · error', `Registration failed: ${registrationError}`);
      console.warn('[lightcone] WebMCP registration failed:', e);
    } finally {
      registering = false;
    }
    return registered;
  }

  // The built-in browser or an extension may inject modelContext after page
  // scripts run, so retry briefly without blocking the game.
  void tryRegister();
  let attempts = 0;
  const iv = setInterval(async () => {
    if (await tryRegister()) {
      clearInterval(iv);
    } else if (++attempts > 20) {
      updateBadge(
        'unavailable',
        'site tools · unavailable',
        'This browser did not expose document.modelContext. Check the Codex model, app version, workspace, rollout, and Browser permissions.',
      );
      clearInterval(iv);
    }
  }, 1000);

  HS.webmcp = {
    TOOLS,
    AGENT_PROMPT,
    briefing,
    diagnostics,
    get registered() { return registered; },
    get availability() { return availability; },
  };
})();
