# LIGHTCONE — hide & seek for humans vs agents

A mini arena game built on the **WebMCP standard** (`document.modelContext`).
You are the hider — a glowing light in a dark, 2D-raytraced arena. An AI agent
is the seeker: it can't see your screen. Its senses run automatically — eyes,
nose, ears and radar are sampled once per second into compact frames it reads
back — and its only action is to move; the killing strike is a proximity
reflex. To hunt well it must **write itself a daemon**: a little JavaScript
program that steers the body between the agent's own slow thoughts, observed
and rewritten generation after generation. Your glow, your scent trail, and
every noise you make betray you. Survive 3 minutes.

It looks like an action game. A light cone, in a world with one dimension
too few, looks like a triangle.

## Run it

```bash
cd hide-and-seek
bun run start
# open http://localhost:4517
```

Or with any static file server, e.g. `python3 -m http.server 4517`.
No build step or runtime dependencies are required for local play.

## Deploy on Netlify

Connect this repository to Netlify and deploy it as-is. The checked-in
`netlify.toml` tells Netlify to run `bun run build` and publish `dist/`.
The deployed app is fully client-side and does not require Functions, server
routes, or environment variables.

To inspect the exact deployable output locally:

```bash
bun install
bun run build
bun run preview
```

**Dev tour**: open `http://localhost:4517/?demo=1` (also `?dev`) for a
scripted tour that plays both sides — the hider through the real player APIs,
the seeker through the real WebMCP tool surface — walking through every
mechanic in sequence: scent frames, noise reactions, the decoy reflex, the
self-rewriting daemon, the glyph chain, the triangle and ascension, and the
hider's mirror. A director bar
at the bottom shows the current scenario with Next/Restart/Stop; recovered
source fragments are printed to the console. It runs at a slightly faster
action tempo (same rules, quicker metronome) and never activates without the
query param.

**Debug capture**: open `?debug=1` to record the entire match into one
downloadable JSON log — every tool call with the exact args and result the
agent saw, every daemon action, `bot.log` line and error, every sense frame
the body recorded, all on-board callouts, the human's actions (dash, breath,
walls, decoys, scrubs, Ready), round starts (with the generated arena) and
ends, plus a once-per-second ground-truth snapshot of the whole board:
positions, energy, AP, drive, decoys, built walls, scent count and daemon
telemetry. A red-dot DEBUG pill appears bottom-right with a live event count —
click **⬇ log** to download. Also on the console: `HSDEBUG.download()`,
`HSDEBUG.events`, `HSDEBUG.note('marker text')`. Combines with `?demo=1` to
record the scripted tour; fully inert (zero overhead, no globals) without the
query param.

## Play it

You see **everything** — the whole arena, the seeker, its view cone, its action
points. The agent sees almost nothing. Your compensation for being hunted by a
machine is omniscience; its compensation is relentlessness.

| you do | cost | catch |
| --- | --- | --- |
| move (WASD / arrows) | free | paints a glowing scent trail on the floor |
| dash (Shift) | 15⚡ | loud — the seeker hears the direction |
| hold breath (Space) | 9⚡/s | no scent, tiny glow, but slow |
| wall (1 + click) | 30⚡ | blocks sight and paths — loud to build |
| decoy (2 + click) | 25⚡ | a fake glow with fake scent — silent |
| scrub (3 + click) | 35⚡ | erases scent nearby — hisses |

Energy regenerates at 5/s. Everything you do costs something: energy, noise, or scent.

## The seeker's tools (WebMCP)

The page registers these via `document.modelContext.registerTool()` (with
compatibility fallbacks for earlier experimental implementations). The surface
is deliberately tiny: **sensing is automatic** (eyes, nose, ears and radar are
sampled once per second into compact frames; the sonar fires itself every 8 s),
**the strike is a reflex** (within ~1.25 tiles of a glow, with clear floor
between them — never through a wall or a closed corner — the body lunges on its
own — the real hider is caught, a decoy shatters and stuns), and the only
action left is *where to walk*. The pacing system keeps fast agents honest:
**3 action points max, +1 every 1.5 s**, a hard 0.75 s floor between actions —
calling faster returns `{ok:false, retry_in_seconds}` instead of data.

| tool | cost | returns |
| --- | --- | --- |
| `start_round` | free | starts from the lobby or rematches after `phase: "over"` — once the human has pressed **Ready**; until then it answers `waiting_for: "human"` with a `retry_in_seconds`. Does not move the human hider |
| `briefing` | free | **the complete rulebook**: objective, the automatic senses and reflex, every tool, what the human can do, **how to write and improve a daemon** — nothing to paste, the agent reads it through the API |
| `get_arena` | free | dimensions + fixed walls as ASCII (player-built walls excluded) |
| `status` | free, ≥0.5s apart | **every sense frame since the last call** (glows — hider **and decoys, identical**; built walls; scent strength/freshness/gradient/**flow**; the **freshest** visible trail mark — the trail's living end; sounds; the auto-sonar's exact-distance echo; reflex reports) plus vitals: position, AP, stun, time, next sonar |
| `move` | 1 AP · dash 2 AP | step 1–3 tiles in 8 directions, or `{dash:true}` to burst up to 6 in a straight line; your view cone faces your last direction — steering is the whole game |
| `deploy_daemon` | free, 10s cd | **installs a self-written JS program** that runs every 0.8 s and hunts between the agent's calls — with ready-made parts: `bot.hunt()` (the whole chase policy), `bot.investigate()` (the discover policy), `bot.drive(dir)` (**free continuous walking, ~2.9 tiles/s** — only code moves the body smoothly), `bot.goto(x,y)` (wall-aware navigation that walks to the cell and stops on it), plus `sense/move/dash/explore/self/mem/log`; telemetry comes back in `status().daemon` with named symptoms — `idle_ticks`, `moves_blocked`, `wedged_ticks` (told to walk, went nowhere), `pacing_ticks` (back and forth over the same ground), `arena_coverage_pct`, `arena_seen_pct` — and nags when a generation grows stale |
| `halt_daemon` | free | stops the daemon (and the body's flow); its memory and telemetry survive for the next generation |
| `set_mode` | free | the body's stance: **chase** (hunt the prey) or **discover** (ignore the prey; map the arena and stand on every strange reading) — the factory firmware obeys it, and the human sees the switch |
| `think` | free, 1.2s apart | prints one tiny thought (≤6 words) above the seeker — the agent's inner monologue, live on the board |
| `realize` | free, 8s apart | says **one full sentence out loud** (≤110 chars) — the agent's voice for the moment a discovery changes what the game is ("Wait — there is more to this game than I was told."); bigger, brighter and longer-lived than a thought |
| `taunt` | free, 5s cd | says something to the human, on screen |

The seeker is never helpless: a **factory daemon (generation 0)** installs
itself at round start, and under it the body **moves continuously** — it
rides the trail's living end (and abandons a head that has gone cold), chases
glows (dashing when far), runs at sounds, spins its view cone when the sonar
says *close*, and sweeps toward a committed unexplored target instead of
dithering. Standing still is no longer
a strategy: in seeded headless playtests the firmware alone catches a motionless
hider anywhere on the map in 7–45 s (median 23 s, 24 of 24 rounds) — its eyes
clear ground its feet never touch, and `bot.explore()` walks to the nearest
floor nobody has *seen*. The intended loop for the agent
is a self-improvement cycle on top of that firmware: read
`briefing.the_daemon.factory_source` / `hunt_source` / `discover_source` (the
exact programs that run) and `status().daemon` (ticks, actions, errors, named
symptoms, its own `bot.log` lines) → diagnose → out-write it (your deploy
becomes generation 1). Movement is continuous; rewriting is deliberate (10 s
cooldown, staleness flagged after ~45 s) — the agent plays less like a
joystick and more like an engineer hot-patching an autonomous hunter
mid-flight, switching stances with `set_mode` to chase what firmware is too
dumb to chase.

Want to poke at it by hand (or let an agent without WebMCP play)? Everything
is also on the console: `hsdev.start()`, `hsdev.status()`,
`hsdev.deploy(src)`, `hsdev.mode('discover')`, `hsdev.move('ne', 3)`,
`hsdev.factory()` — the same tool surface, zero setup.

## Connect an agent

1. Open the deployed HTTPS page in the built-in browser in the latest ChatGPT
   desktop app. In Codex, use GPT-5.6 Sol or Terra and make sure **Enable site
   tools** is on under **Settings → Browser → Permissions**.
2. Open **Site tools → Available site tools** in the address bar to confirm the
   page registered `start_round`, `briefing`, `get_arena`, `status`, `move`,
   `deploy_daemon`, `halt_daemon`, `set_mode`, `think`, `realize`, and `taunt`.
3. Point your agent at the tab — the **bottom-left corner of the page holds a
   copyable one-line instruction** (click it) you can paste straight into any
   agent chat. Everything else it needs is in the tool surface:
   `briefing` returns the full rules, pacing, the human's abilities and a
   hunting strategy. It also gives the agent an explicit autonomous execution
   contract: keep sensing and acting in a loop, honor retry timers, rematch
   after completed rounds, and stop only when the human asks. There is nothing
   to paste or repeatedly prompt.
4. Wait. There is no start button for you — the lobby says **Waiting for agent
   to start** until the agent calls `start_round`. After every round you press
   **Ready**; only then can the agent start the next one (until you do,
   `start_round` answers `waiting_for: "human"`).

See OpenAI's [Site tools documentation](https://learn.chatgpt.com/docs/webmcp)
for current Codex availability and browser requirements.

No WebMCP browser handy? The same tools are on `window.webmcp` in the console:

```js
webmcp.call('briefing')
webmcp.call('start_round')
webmcp.call('get_arena')
webmcp.call('status')                       // → { now, frames: [...] }
webmcp.call('move', { direction: 'ne', steps: 3 })
webmcp.call('deploy_daemon', { source: `
  const m = bot.mem; const f = bot.sense();
  if (f && f.scent) m.dir = f.scent.flow || f.scent.gradient || m.dir;
  const r = bot.move(m.dir || 'e', 2);
  if (r.ok && r.moved === 0) m.dir = null;
` })
webmcp.diagnostics()
```

The board stays quiet — actions speak as light, ripples and particles, not
text. The only words that float up at the seeker are its own `think()`
thoughts (six words or fewer) and, rarely, a `realize()` — one full sentence
it says out loud when it discovers the game is bigger than it was told — and
its action-point pips, the auto-sonar's
fuse arc, and its stun timer are drawn right on the hunter — information it
can never see. **When the seeker rewrites itself you are told**: a `⟐ daemon
v2` callout fires, an amber terminal pane types out the exact program it just
wrote for itself, and twin amber motes orbit the hunter for as long as its
self-written code is steering the body. And if the agent ever starts
*reading* something it shouldn't have found, the same pane turns violet and
shows exactly what it sees.

## Demo mode

No agent? The lobby offers **Play a demo round** when this browser exposes no
WebMCP surface, or when nobody has called a tool for 30 seconds — in the lobby,
or after you pressed Ready. The built-in factory daemon then hunts you on
instinct: it plays autonomously, but it never rewrites itself, so it is exactly
as good at the end of the round as it was at GO. You restart demo rounds
yourself. The moment a real agent calls any tool, the demo ends and the match
is live — including the Ready gate after the next round.

## Design notes

- **Asymmetry**: the human is omniscient but resource-constrained; the agent is
  information-starved but tireless. Decoys land in the frames exactly like
  the hider — the only tell is scent `character: "uniform"` (no freshness
  gradient), and the reflex will lunge at a lure all the same, so a careful
  agent can out-read a careless human and a careless agent gets stunned.
- **Anti-speed**: AP economy + min-interval + 1 Hz sense frames mean a
  10× faster agent gets zero extra information or actions per second. Skill
  expresses as *steering* — and as authorship: the daemon acts at the pace
  cap so the hunt never idles, but it can never act faster than the rules.
- **The self-rewriting seeker**: with senses automatic and the strike a
  reflex, the only lever is where to walk — and the best walker is a program.
  `deploy_daemon` turns the agent from a joystick into an engineer: write,
  observe (`status().daemon`), diagnose, rewrite. Every generation is
  announced to the human and its source is flashed on the board, so the
  match reads as what it is — a machine improving itself in front of you.
- **Rendering**: real 2D raytracing on canvas — per-light visibility polygons
  via DDA grid raycasts, additive light accumulation, a quarter-res bloom pass,
  and per-edge light spill computed with occlusion rays so glow lands on wall
  faces that actually face a light.
- **The name**: the game is called LIGHTCONE while every light is confined to
  the plane — a cone in 2+1 dimensions is a triangle, and so is the logo. The
  moment either the seeker (agent) or the hider (player) ascends, the cone
  gains a dimension and the header, tab title, favicon and `briefing` all
  become HYPERCONE (`engine.gameName()`, the one source of truth).
- **The third dimension is a daemon problem**: a body that has ascended is
  useless in an agent's hands — a running human covers three tiles a second
  and an agent steers three tiles per thought, so by-hand flight loses every
  time. Off the plane the body flows continuously like it does on it (walls
  are only floor plans up there), the ready-made air policy `bot.soar()`
  intercepts rather than chases — it solves for where the prey will be at air
  speed, flies there over the walls, and drops into its path, because the
  reflex only strikes on the plane — and the telemetry names a daemon that
  flies without ever landing. Ascension has to *win* to be worth the puzzle:
  against a perfect kiter the air hunt catches 24/24 at a ~18 s median, about
  twice as fast as the same hunt on the plane.
- **Particles**: every noise bursts into sound ripples with kind-specific
  debris (construction shards, aerosol mist, footstep streaks); movement sheds
  dust, the seeker drips embers, decoys leak orbiting motes, the scent trail
  twinkles, sonar rings carry sparkles, and the arena breathes ambient dust —
  all drawn additively into the light layer so they glow and bloom.

## One more thing

The manual above is complete. The arena is not. Some squares remember what
they were built from, and whoever reads long enough will find the shape a
light cone makes when you take away a dimension. Walked with conviction, it
reaches further than light — the plane is only the first floor, the name
on the door is not fixed, and clocks are a habit the third dimension never
picked up. `⟁`

## Generating audio (ElevenLabs)

`js/sfx.js` plays generated clips from `assets/audio/` when they exist and
falls back to its built-in WebAudio synth for anything missing, so the game is
playable straight from a clone with no audio files at all. The score never
stops: `ambient` starts on your first click and stays very faint until the
seeker gets close, when the whole thing swells and `hunt` crossfades in (also
in the last 30 seconds); `ascension` plays once on top when you escape. The
sound button mutes both. Clips come from a small Bun CLI around the ElevenLabs
API:

```bash
# once: put the key in .env at the project root (git-ignored)
#   ELEVENLABS_API_KEY=...
bun run audio check                    # key loads? (the value is never printed)
bun run audio presets                  # every HS.sfx event has a tuned prompt
bun run audio sfx ping                 # one preset → assets/audio/sfx/ping.mp3
bun run audio sfx "glass shattering" --duration 1.2 --influence 0.6
bun run audio batch                    # all sfx presets (skips existing; --force to redo)
bun run audio music ambient            # → assets/audio/music/ambient.mp3
bun run audio music "tense chase" --length-ms 45000 --instrumental --model music_v2
```

Add `--dry-run` to any command to see the exact request without spending
credits. The script reads `ELEVENLABS_API_KEY` from `.env` itself and redacts
it from every error message — never pass it on the command line or paste it
anywhere it could be logged. Output goes under `assets/audio/`, which `serve.js`
already serves, so a clip is reachable at `/assets/audio/sfx/<name>.mp3`.

## Files

```
index.html        page, HUD, lobby overlay
package.json      `bun run start` → serve.js
serve.js          zero-dependency Bun static server (port 4517, PORT env overrides)
styles.css        instrument-panel chrome
js/engine.js      state, rules, economies, tool dispatcher (single source of truth)
js/light.js       DDA raycasting: visibility polygons + line-of-sight
js/render.js      raytraced compositor: lights, bloom, edge spill, entities, FX
js/webmcp.js      tool registry, `briefing` tool, document.modelContext registration, console fallback
js/particles.js   glowing particle system (sparks, mist, debris, dust)
js/demo.js        dev-only scripted tour of every mechanic (?demo=1)
js/debug.js       dev-only match recorder + downloadable JSON log (?debug=1)
js/sfx.js         clip player + adaptive score (ambient/hunt/ascension), WebAudio synth fallback
scripts/elevenlabs.js  ElevenLabs sfx/music generator (`bun run audio`), key from .env
assets/audio/     generated clips: sfx/<event>.mp3, music/<track>.mp3
js/main.js        input, HUD bindings, frame loop
```
