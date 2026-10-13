# AGENTS.md

This file is the working guide for coding agents. `README.md` explains the game to players and contributors; this file explains how the project fits together, what its design is trying to protect, and how to change it without rediscovering everything first.

## Start here

SolaDroid is a dependency-free browser action game inspired by *Paradroid*. It is plain HTML, CSS and JavaScript: no package manager, framework, bundler or build step.

At the beginning of a session:

```bash
ant foundation
ant recent --limit 5
ait ready
git status --short
node --check game.js
```

If `ant` is available, its foundation is the authoritative product intent. Useful detailed records include:

- `ant show soladroid-XKtxA` — project vision.
- `ant show soladroid-sYVTv` — newcomer onboarding.
- `ant show soladroid-mjBCN` — readable, skill-driven transfer design.
- `ant show soladroid-Ed6UZ` — twenty-deck red-to-blue descent.
- `ant show soladroid-VYQvH` — dependency-free, laptop-quiet performance decisions.
- `ant show soladroid-sXVTv` — July 2026 difficulty, chassis identity and transfer-discoverability pass.

Respect existing worktree changes. Do not discard or overwrite unrelated edits.

## Product north star

The pleasure at the centre of SolaDroid is stealing a machine body, feeling how it changes the way you play, and deciding when to abandon it for another.

The intended audience includes people who remember *Paradroid* and friends who have no 1980s context. Nostalgia is welcome, assumed knowledge is not.

The campaign descends through twenty decks of RMS Ceres in five movements:

1. frantic red emergency decks;
2. amber containment;
3. pale administration;
4. cyan systems territory;
5. the still, cold-blue order of Central Command.

Central Command develops from a system label into a bureaucratic antagonist. It may lie about events and navigation, but the game must not lie about controls, physical danger warnings or transfer outcomes.

This is not intended to be:

- a pixel-perfect C64 recreation;
- a generic shooter with only more enemies and higher numbers;
- brutally difficult for its own sake;
- a framework-heavy web application;
- a conventional boss-fight game—the climax is a transfer into Central Command.

## Working principles

- Follow YAGNI. Prefer tuning or clarifying an existing system over adding a new progression layer, upgrade tree, difficulty mode or enemy taxonomy.
- Keep the runtime dependency-free unless a change genuinely cannot be delivered otherwise.
- Preserve keyboard and gamepad as first-class controls.
- Base balance changes on observed play problems. Do not add tutorial UI speculatively.
- Difficulty should grow through coordination, environmental pressure, chassis decisions and declining information quality. Accuracy and enemy count may contribute, but should not be the whole answer.
- Transfer strength must use visible resources and constraints, never hidden success odds.
- Preserve trustworthy red aim lines and hazard warnings even when radar or terminal information is corrupted.
- Treat sustained fan noise or high CPU/GPU use as a regression.
- Keep changes compact and data-driven where possible.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Static cabinet structure, HUD, canvases and every modal/overlay. |
| `styles.css` | Complete visual system, responsive cabinet layout, HUD, dossier, terminal and transfer presentation. |
| `game.js` | All game data, state, input, simulation, audio, rendering, campaign, tutorial and debug helpers. |
| `README.md` | Public overview, controls, local serving instructions and contribution notes. |
| `screenshot.png` | Public project screenshot. |
| `.ait/ait.db` | Local issue history when `ait` is in use. |
| `.ant/ant.db` | Local durable design rationale when `ant` is in use. |

There are deliberately very few files. Do not split `game.js` merely to make it look like a larger application; split only when a concrete maintenance problem justifies it.

## Runtime architecture

`index.html` loads `game.js` as an ES module. The module collects required DOM nodes into the `ui` map near the top. If an element ID changes or a new HUD element is added, update both the HTML and that map.

The game uses three canvases:

- `gameCanvas` — the 1280×720 world view;
- `radarCanvas` — navigation and misinformation;
- `transferCanvas` — the nine-core circuit-routing contest.

Important state modes are:

- `start`
- `playing`
- `dossier`
- `terminal`
- `transfer`
- `paused`
- `end`

`frame()` caps active play at 30 FPS. Only `playing` and `transfer` are continuously rendered; inactive overlays redraw when their mode changes. Static deck backgrounds, lights and vignettes are cached. Preserve this shape unless measurement proves another approach worthwhile.

The main play flow is:

```text
startGame()
  → loadDeck()
  → update() / render()
  → clear hostiles by combat and/or transfer
  → enter lift
  → next deck
  → clear deck 20
  → transfer into Central Command
  → endGame(true)
```

## `game.js` map

Start with symbols rather than line numbers; line numbers move frequently.

### Data and progression

- `DROID_TYPES` — chassis stats, weapon feel, AI range, dossier copy and transfer summary.
- `RATING_LABELS` — ordering used by dossier comparisons.
- `TRANSFER_ROUTES`, `TRANSFER_CORE_LABELS`, `TRANSFER_LINKS`, `CENTRAL_LINK` — transfer-game topology and explicit resources.
- `WORLD` — 2240×1400 playfield with a collision border.
- `MOVEMENT_STYLES` — five atmospheric movements.
- `DECK_LAYOUTS` — five reusable wall/spawn/light/hazard geometries.
- `CAMPAIGN` — twenty deck rosters, hazards, terminal claims and narrative logs.
- `buildCampaignDeck()` — mirrors reused layouts and combines layout, campaign and movement data.
- `getCombatTuning()` — smooth campaign pressure curve.
- `getAttackerCap()` — simultaneous attacker milestones.
- `HAZARD_TYPES` — physical hazard cycle, warning, radius, damage and push.

`CAMPAIGN` rosters consume spawn points in order from the selected `DECK_LAYOUTS` entry. Layouts currently provide ten spawn points; do not exceed that without adding valid positions. The first entry of deck 1 is also the tutorial transfer target, so roster order there is behaviour, not cosmetic data.

### State and simulation

- `state` — authoritative runtime state.
- `makeDroid()` — constructs player and enemy instances from `DROID_TYPES`.
- `loadDeck()` — resets deck-local state, positions the player and applies service restoration.
- `getInput()` / `updatePlayer()` — keyboard and gamepad movement, aim, fire and interaction.
- `shoot()` / `updateBullets()` — projectile construction, collision and damage.
- `updateEnemies()` — attacker selection, warning, tracking, preferred range, flanking and patrol movement.
- `updatePickups()` / `updateHazards()` — sustain and environmental pressure.
- `destroyEnemy()` / `destroyPlayer()` — scoring, ejection back into 001, and game-over behaviour.
- `getNearbyInteractable()` / `interact()` — droid, terminal and lift interactions.

### Transfer

- `openDossier()` — visible current-versus-target comparison.
- `startTransfer()` — creates a contest using the two chassis’ explicit link resources.
- `getTransferTarget()` — determines the next core on a selected route.
- `chooseEnemyIntent()` — deterministic, visible opponent intent.
- `updateTransfer()` — input, pulse travel, collision, ownership and timer.
- `finishTransfer()` — five-of-nine result.
- `completeTransferSuccess()` — enters the target chassis; abandoning a non-001 body leaves the old shell hostile.
- `completeTransferFail()` — feedback damage and separation from the target.
- `startCentralTransfer()` / `completeCentralTransfer()` — final confrontation.

The transfer game must stay readable. A player should be able to explain which input sent which pulse, why ownership changed and why the result was reached.

### Rendering and information

- `buildDeckBackground()` — cached static deck art.
- `drawEmergencyLighting()` — movement-specific light and atmosphere.
- `drawHazards()` — truthful warning and active phases.
- `drawDroid()` — distinct chassis silhouettes, aim warnings and tutorial target.
- `drawBulletsAndParticles()` — chassis-specific projectile weight and effects.
- `getRadarMode()` / `renderRadar()` — reliable opening guidance, then degradation, ghosts and outages.
- `renderTransfer()` — complete transfer contest presentation.

## Chassis identity

Keep raw stats, ratings, prose, projectile feel and AI behaviour coherent. If one changes, review the others.

| ID | Role | HP | Speed | Fire cycle | Damage | Intended feel |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 001 | Influence / infiltrator | 66 | 238 | 0.22s | 12 | Agile and stable, but very fragile. |
| 123 | Scout / recon | 58 | 270 | 0.18s | 7 | Fastest; rapid light repeater; prefers range. |
| 247 | Engineer / heavy utility | 112 | 148 | 0.72s | 24 | Slow; armoured; large heavy cutter shot. |
| 420 | Security / deck enforcer | 142 | 172 | 0.42s | 16 | Balanced armoured middle ground. |
| 711 | Battle / rapid assault | 188 | 225 | 0.16s | 8 | Fast close assault; rapid low-impact fire; unstable. |
| 999 | Command / siege | 290 | 122 | 0.65s | 32 | Slowest; largest siege shot; maximum armour; catastrophically unstable. |

Projectile behaviour comes from `projectileSpeed`, `shotSize` and `shotTrail`. Enemy positioning comes from `combatRange`. The `profile`, `strength`, `weakness` and `ratings` fields appear in player-facing guidance.

The first guided transfer deliberately targets 247 so the player immediately feels a large mobility-versus-impact trade. Do not casually replace it with a subtle sidegrade.

## Current difficulty curve

`getCombatTuning()` applies a smoothstep pressure value so the first movement changes gently and later movements diverge strongly.

Approximate milestones:

| Deck | Attackers | Spread | Warning | Damage | Tracking | Pickup chance | Kill heal |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 22.9° | 0.76s | 0.32× | 0.20 | 58% | 8.0% |
| 10 | 2 | 15.3° | 0.58s | 0.52× | 1.54 | 40% | 5.2% |
| 15 | 3 | 9.1° | 0.45s | 0.68× | 2.60 | 25% | 3.0% |
| 20 | 4 | 6.3° | 0.38s | 0.76× | 3.10 | 18% | 2.0% |

Attacker caps are:

- decks 1–5: one;
- decks 6–10: two;
- decks 11–15: three;
- decks 16–20: four.

Attackers are staggered into engagement slots to create sustained pressure instead of one simultaneous volley. Late attackers track during the visible warning and strafe on opposite sides. Decks 15–20 have eight hostiles. Hazards also accelerate and strengthen while pickup, kill and between-deck healing decline.

The owner is actively evaluating this curve. Treat these values as a coherent first balance pass, not sacred constants and not proof that the full campaign is balanced.

## First-run onboarding

The tutorial state is stored under `localStorage['soladroid-tutorial']`.

The intended first-run sequence is:

1. move;
2. fire once;
3. notice the objective, toast, radar and world marker all identify the 247 Engineer;
4. approach and open the dossier with `E`;
5. complete the guided transfer;
6. begin normal combat in a body whose trade-offs are obvious.

Combat remains dormant during guided transfer discovery. It activates after a successful transfer or immediately when the player dismisses the guide with `T`. This safe opening is intentional. Do not “fix” it into an ambush without new playtest evidence.

The marker currently follows `state.enemies[0]`. If that droid is destroyed, the next enemy becomes marked. Reordering deck 1 changes which chassis the tutorial teaches.

For a true first-run retest, clear the key and reload:

```js
localStorage.removeItem('soladroid-tutorial')
location.reload()
```

## Local development and checks

Serve the directory; do not open `index.html` directly:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Minimum checks after JavaScript changes:

```bash
node --check game.js
git diff --check
```

There is no automated gameplay suite. Match verification to risk and describe browser smoke tests honestly; never call an automated jump a complete human playthrough.

Use Microsoft’s `playwright-cli` for browser automation. Useful console helpers are exposed as `window.__SOLADROID__`:

```js
window.__SOLADROID__.getState()
window.__SOLADROID__.start()
window.__SOLADROID__.jumpToDeck(15)
window.__SOLADROID__.clearDeck()
window.__SOLADROID__.teleport(x, y)
window.__SOLADROID__.teleportToNearest()
window.__SOLADROID__.showEnding()
window.__SOLADROID__.setMode('playing')
```

`jumpToDeck()` preserves an existing player chassis; use a fresh page/start when the starting body matters. Interaction is edge-triggered through the `pressed` set, so very fast synthetic key taps can land between 30 FPS updates; hold `E` for a frame during automation.

Recommended smoke coverage for gameplay changes:

- fresh first-run tutorial with local storage cleared;
- dossier and guided transfer into 247;
- one early combat encounter;
- the relevant milestone deck, especially 6, 11, 15 or 16;
- deck 20 and Central Command if campaign/transfer code changed;
- browser console errors;
- 1024×768 layout if HUD or overlays changed.

Close every Playwright session and local server when finished. Orphan Playwright/Chrome processes previously looked like a game performance regression. For performance investigations, verify the process table rather than trusting the session list alone.

## Persistent browser state

These local-storage keys affect tests:

- `soladroid-tutorial`
- `soladroid-sound`
- `soladroid-high-score`

Unexpected tutorial or sound behaviour is often stale browser state, not a code defect. ES-module caching can also make a simple reload appear stale during rapid local edits; use a fresh browser context when behaviour contradicts the served source.

## Narrative and UI guardrails

- Terminal copy progresses from operational logs to denial, contradiction and direct acknowledgement. Keep Central Command restrained and bureaucratic rather than chatty or melodramatic.
- Radar degradation is thematic and mechanical. It may create ghosts or go offline, but the physical lift beacon, aim lines and hazards remain reliable.
- The dossier should explain a decision, not bury it in flavour.
- The HUD objective has more authority than ambient prose. If the intended player action changes, update the objective as well as tutorial copy.
- Maintain the established industrial CRT/cabinet visual language. New UI should look like part of the machine, not a generic web card.
- Responsive rules exist near the end of `styles.css`; inspect the small layouts before adding fixed dimensions.

## Tracking future work

The original campaign initiative and its children are closed. The owner is doing more full runs after the July balance pass.

When new repeated evidence appears:

1. search `ant` for the affected area;
2. create a focused `ait` issue with observable acceptance criteria;
3. make the smallest coherent change;
4. verify it at the affected deck and at one neighbouring milestone;
5. record durable rationale in `ant` only when the why would be hard to reconstruct from code.

Do not reopen the entire completed campaign initiative for one tuning value. Create a narrow follow-up task.
