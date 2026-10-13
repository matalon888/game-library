# The secret chart room

Open the browser's developer console and look for **AHOY, CAPTAIN!** The menu
is deliberately absent from the helm and player-facing menus. No developer
URL, extension, account or network connection is required.

```js
DeadSlow.help()
```

The welcome is logged at startup, not triggered by trying to detect whether
DevTools is open. The game does not poll your browser or resize itself to detect
console users. If the browser filters informational messages, enter the command
above directly. Opening DevTools can cause the game's usual focus-loss pause;
`DeadSlow.level(...)` or `DeadSlow.watch(...)` starts a new practice attempt.

## Pick an assignment and speed up

```js
DeadSlow.levels()                // List IDs and one-based world / assignment numbers.
DeadSlow.level(3, 4)             // The Floating Sauna, unranked.
DeadSlow.speed(8)                // Eight times the wall-clock pace.
DeadSlow.speed(0)                // Freeze, without opening a pause dialog.
DeadSlow.step(30)                // Advance exactly 30 simulated seconds.
DeadSlow.speed(1)                // Restore speed; THIS attempt stays unranked.
DeadSlow.normal()                // Fresh, ranked individual attempt at normal time.
```

An ID also works: `DeadSlow.level("floating-sauna")`. Speed accepts finite
numbers from 0 through 32, including slow motion. `DeadSlow.speed()` reads the
current rate without changing anything. Manual stepping accepts 0–600 seconds,
rounded to the nearest simulation tick. `DeadSlow.step()` with no argument
advances one tick. Stepping and helm overrides require a running trial; use
speed zero, rather than a pause dialog, when inspecting a frozen scene.

Acceleration schedules more **1/120-second steps**; it does not enlarge the
physics timestep or multiply thrust. Tides, traffic, jobs, tow forces and clocks
all advance together. Animated playback processes at most 480 ticks per frame
and carries leftover work forward. A slow computer can therefore fall short of
32× without silently skipping physics. Rendering and sound remain presentation,
not timing inputs. Existing long-frame and focus-loss pauses still apply.

## Spare keys to the bridge

```js
DeadSlow.controls({throttle: -1, rudder: 0, thruster: 0, winch: 0})
DeadSlow.line()                  // Real make-fast / cast-off action, not auto-hook.
DeadSlow.warp(150, 200, 0)       // Player x/y in metres, heading in degrees.
DeadSlow.repair()                // Restore hull integrity, not contacts or progress.
const snapshot = DeadSlow.state()
```

Throttle is a whole notch from −3 to 4. Rudder, thruster and winch accept −1 to
1. Unspecified controls retain their values; normal keyboard/touch input can
replace them. Positive rudder/thruster is starboard; positive winch pays out.
`line()` still checks the active target, 44-metre attachment range, relative
speed and obstructions. Casualties are not teleported by `warp`; only the player
is repositioned and stopped. Existing tasks remain. Warping outside the chart
still fails on the next tick. Repair cannot resurrect a failed attempt.

`state()` is a detached JSON snapshot, not a reference to the live game. Editing
it does not move the ship. It includes ship motion, local water, job/line state,
splits and counters. Space snapshots additionally include fuel, local sunlight,
heat, beam state, docked tenders, cannon shots and the recorded timeline. Invalid arguments throw before any partial command runs.

### Rampage controls

In World 4, `rudder` is an east/west push and `thruster` a south/north push.
`DeadSlow.line()` activates the normal temporary shield. On the pepper course,
`winch: 1` holds fire and `winch: 0` releases it; the actual pepper, breath, range,
water and cover rules still apply. `throttle` does not drive the ball.

```js
DeadSlow.watch("gerbo-cavy-clash", 8)
DeadSlow.watch("gerbo-whiskerdoom", 8)
```

Rampage snapshots include forests, monsters, breath, the escort's independent
health and breadcrumbs. See [the field guide](GERBOZILLA.md). The Reservoir Hairpin
is retired: use `gerbo-forest-slalom` for its replacement, not its old recording.

## Watch the actual verification runs

```js
DeadSlow.runs()                  // Available recordings, measured times, source files.
DeadSlow.times()                 // All 58: verified author times OR null; medal targets separately.
DeadSlow.timeline("bigger-boat")  // Timestamped helm and line actions.
DeadSlow.watch("bigger-boat", 8)  // Animate those inputs in the normal game at 8×.
DeadSlow.speed(0)                // Freeze the recording.
DeadSlow.step(10)                // Continue ten seconds along that same input timeline.
DeadSlow.speed(8)                // Resume animated playback.
DeadSlow.report()                // Last recording's measured result, or null before finishing.
DeadSlow.verify("all")           // Execute all published recordings now and return measured reports.
DeadSlow.verify("first-crossing")
```

| Recording ID | Stage | Control-only author time |
| --- | --- | --- |
| `dead-slow` | World 1 · Dead Slow | 78.591667 s |
| `dogleg` | World 1 · The Long Way Round | 96.766667 s |
| `signal` | World 1 · Catch the Green | 80.850000 s |
| `lock` | World 1 · The Lockkeeper | 128.766667 s |
| `astern` | World 1 · Stern First | 80.241667 s |
| `tidal` | World 1 · Water Under the Keel | 81.225000 s |
| `crosscurrent` | World 2 · No Lee Shore | 78.641667 s |
| `two-greens` | World 2 · Between Two Greens | 138.625000 s |
| `first-crossing` | World 3 · The First Crossing | 123.950000 s |
| `bigger-boat` | World 3 · A Bigger Boat | 187.900000 s |
| `granite-needle` | World 3 · The Granite Needle | 373.575000 s |
| `island-exchange` | World 3 · Island Exchange | 850.358333 s |
| `backwater` | World 2 · Backwater | 330.150000 s |

World 6 adds thirteen more recordings, including the Century Ship bonus: see
the [space mission table](SPACE.md#verified-flight-library). Every spacecraft
mission can be watched. `runs()`, `levels()` and `times()` flag bonus stages;
`report().space` exposes measured fuel, burn, capture, shot and jump counters.

These are full clean completions, not optimal times. They use the actual live
state machine and ordinary throttle, rudder, thruster and line commands. Their input streams
never assign coordinates, complete objectives directly or relax physics. The chronogate itself deliberately changes the player's position as part of the time-travel mission; the recording does not bypass it.
A report is verified only when the run finishes cleanly within one simulation
tick of its checked-in time. Divergence is reported, not silently accepted;
a recording still running at its declared end freezes for inspection.
Leave the helm alone while watching a reference run.

`verify` intentionally replaces the current attempt with each recording. It
finishes on the last result, at frozen practice speed. `normal()` returns to a
fresh ranked attempt. Reading a timeline or report alone does not replace a run.
There are **thirty-seven published author recordings**, including twelve Rampage courses. The other twenty-four sea
stages do not yet have published control-only completions. A `null` author time is
honest missing coverage, not an impossible stage. Gold/silver/bronze targets are
level-design goals; their existence is not proof of a successful control run.

The JSON files named by `runs()` are the source of truth. Add new recordings
as `tests/fixtures/<level-id>-controls.json`; the synchronizer discovers them
in deterministic filename order after the three established reference runs. After editing them,
run `npm run replays:sync`, then `npm test`, `npm run verify:runs` and the browser
suite. This regenerates the committed `src/verification.js` used by source play
and the single-file build. No runtime fetch is needed.

## Keep the logbook honest

Reading help, stage lists, state, timelines, times or reports does not mark an
attempt as practice. Using any assist does. Accelerated retries stay unranked;
assisted circuits cannot become ranked merely by returning to 1×. The visible
clock displays the speed and **UNRANKED** status. Assisted completions never
replace PBs, ghosts, splits or circuit records. A console-launched practice
attempt also does not inflate the ranked departure counter.

This is a convenience guard against accidental record pollution, not security.
A local browser game and its storage are inspectable and editable. Cheats are
welcome aboard; keep a separate logbook export when experimenting with imports.

## Manual circuit playtests

`DeadSlow.tour(8)` starts a fresh, unranked 60-stage Grand Tour.
`DeadSlow.circuit(3, 8)` starts World 3 (playable world numbers 1, 2, 3, 4 and 6 or campaign IDs work).
Worlds 5, 7 and 8 are inspectable coming-soon chapters and reject launch commands.
These do not autoplay or overwrite ranked departures, PBs, ghosts or circuit times.
`DeadSlow.progress()` returns a compact detached clock/retry/split summary.
The new speed controls remain available through retries and mode changes, including
World 4. See [PLAYTEST.md](PLAYTEST.md) for key bindings and limitations.

## Railway commands and recording compatibility

```js
DeadSlow.rail("brake", 1)
DeadSlow.rail("power", 0)
DeadSlow.rail("uncouple", {after: "engine", before: "Q1"})
DeadSlow.rail("switch", "throat")
```

Use the actual vehicle and junction IDs from `DeadSlow.state()`. These commands
use the same eligibility checks as the controls, and mark the attempt as practice.
`DeadSlow.controls()` is for the non-railway helm; it rejects railway attempts.

Author recordings carry a course/rules signature. `watch` checks compatibility
before changing the current run, so an obsolete recording cannot silently play
on a redesigned course. Synchronization adds baseline metadata to legacy inputs;
it does not rewrite the recorded commands or their expected completion times.
