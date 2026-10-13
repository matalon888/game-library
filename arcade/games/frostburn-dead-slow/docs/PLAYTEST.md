# Accelerated full-run playtest — 5.1.0

From the browser console:

```js
DeadSlow.tour(8)          // Manually play all 60 campaign stages at 8×.
DeadSlow.circuit(3, 8)    // Or start just World 3's twelve-stage circuit.
DeadSlow.progress()      // Small detached report: mission, clock, retries, splits.
```

`tour` and `circuit` start a new playtest. They do not drive the vehicle or resume
an earlier run. The Century Ship remains outside the Grand Tour. World 4 is a
full twelve-stage championship. The active route is worlds 1, 2, 3, 4 and 6;
5, 7 and 8 contain disabled coming-soon plans, not playable stages.

After starting, a PRACTICE time selector and Freeze button appear on the chart.
The `[` / `]` keys step between 1, 2, 4, 8, 16 and 32×; backslash freezes/resumes.
The normal helm keys retain their meanings. Use the selector or console for a
fractional rate. A native selector commits the selection and releases focus so
arrow-key piloting works again. Ordinary ranked play has no speed panel until a
console time command unlocks it.

Use 8× for long coasts and 1–2× for berths, beam work and shield timings. These
are playtest choices, not part of the mission mechanics. The simulation keeps
its 120 Hz steps at every rate. A slow device can run below the requested rate;
it does not lengthen physics steps or fast-forward through collisions.

Shift+R and every restart button immediately abandon the current attempt and
start a fresh one; there is no confirmation dialog. Completed circuit stages
remain, and holding Shift+R does not trigger repeated restarts.

The selected rate survives immediate restarts, next-stage menus and world
changes. Menus do not advance the clock. Frozen time is distinct from the pause
menu: the latter still needs Resume after focus loss. The overlay continues to
block the helm.

Every playtest stage and circuit remains unranked, including subsequent stages
after switching back to 1×. These runs do not write PBs, ghosts, best splits,
ranked departures or circuit records. Completed playtest splits remain available
through `DeadSlow.progress()` for feedback. This report is not a save-state;
reloading the page discards an in-progress circuit.

```js
DeadSlow.watch('backwater', 8)
DeadSlow.watch('island-exchange', 8) // Run one watch at a time.
DeadSlow.normal()                  // Leave the circuit; fresh ranked solo trial.
```

## Design review

All sixty campaign entries were reviewed by their geometry and task definition.
The two clearly redundant later approaches were rebuilt rather than adding
random hazards to every straight reach. Difficulty is a design judgment; the
review does not establish optimal solutions or prove that every challenge is
immune to shortcuts. The intended easy exceptions are the opening handling
lessons and the Archipelago's ferry/tow introductions.

World 1 keeps its progressive, often straight teaching reaches. For the later
worlds, the table below records why a straight section is useful, or what forces
an actual route/manoeuvre rather than just accelerating and braking.

| Northwatch | Reason for the route |
| --- | --- |
| No Lee Shore | Exposed two-second hold against a substantial cross-set. |
| Loaded Against the Set | Intermediate stop, mass change and exposed final hold. |
| The Exposed Berth | Pilot clearance, boom, traffic, north-facing final approach. |
| Between Two Greens | Independently timed booms, mandatory slow pocket between. |
| The Sluice | Spatially pulsing jet followed by an offset terminal. |
| Night Convoy | Clearance stop and three staggered crossing tracks. |
| The Dogwatch Lock | Narrow chamber, lock cycle, cross-set and offset exit. |
| **Backwater — revised** | Offset southern start, old mole, two-part reverse dogleg, narrow fingers. |
| The Sounding Line | Two whole-width shoals; stop for soundings between tidal crossings. |
| Deadweight | Longer/heavier hull, no-wake approach and north-facing pocket. |
| The Switchback | Opposite breakwater heads force an S-shaped course. |
| Last Light | Clearance, tide, inspection boom, ferry, outfall and final turn. |

| Archipelago | Reason for the route |
| --- | --- |
| The First Crossing | **Ferry tutorial**: deliberately simple automatic ramp/manifest lesson. |
| A Bigger Boat | **Tow tutorial**: teaches unilateral line, independent inertia and two moorings. |
| The Milk Run | Empty fairway departure, partial unload, second island north of first. |
| The Floating Sauna | Remote hookup, wide pontoon, long corner around granite. |
| Market Day | Full load, no-wake reach, two crossing boats; straight water serves traffic timing. |
| The Granite Needle | Broadside heavy-barge pickup and narrow granite passage; preserved. |
| The Last Bus | Bridge timing plus a north-facing unloading ramp. |
| Slackwater Salvage | Remote casualty and a pulsing cross-race that reaches tug and tow at different times. |
| **Island Exchange — revised** | Perpendicular ramps around Longfin Isle, partial exchange and a heavier return load. |
| One Line, Two Calls | Separate recoveries and delivery basins, not one inline tow. |
| Cars and a Casualty | Ferry duty then a northern rescue using the ferry's towing point. |
| Midsummer Dispatch | Two island stops, bridge, clearance, traffic and final rescue. |

| Black Meridian | Reason for the route |
| --- | --- |
| Nothing to Push Against | Vacuum introduction, offset port and outbound rocks; already redesigned. |
| A Stone with a Schedule | Must match an asteroid-mounted moving cradle. |
| The Last Fill Before Dark | Collinearity isolates a real fuel/catch-up constraint; not distance padding. |
| Some Assembly Required | Separate upper/lower captures and helm transfers, then the heavier assembly. |
| Newton's Broadside | Introduction to firing-box position, rotation, stillness and recoil. |
| A Moving Argument | Lead a moving target and recover the physical recoil before returning. |
| Equal and Opposite | Introduction to beam momentum exchange; secure both independent craft. |
| The Safe Side of a Stone | Moving-cover survey and capture under continuous radiation. |
| Borrowed Sunlight | Solar-only jets: prepare a terminal coast before losing power. |
| Yesterday Has Right of Way | Two chronogates, physical station maze, two recurring recorded selves. |
| Cold Transit | Straight ballistic corridor is intentional: no thrust inside, timed crossing drones. |
| Perihelion Dispatch | Refuelling, rescue and moving shadow windows in one assignment. |

The twelve Gerbozilla courses already vary between run-ups, fortified bowls,
moats/retaliation, downhill demolition, forest orienteering, an invulnerable
pursuer, combat, fire breathing and escorts. Their released layouts, including
the stronger three-shield chase and the moved menagerie lake, are unchanged.
The separate Century Ship keeps its planetary detour and physical travel-time
bound.

## What was actually tested

Focused tests load every selectable assignment and traverse the sixty-stage
circuit state machine, with retries and a return to 1×. The traversal deliberately
isolates `finish()` to test menus, clocks, practice propagation and world
transitions: it is **not sixty control-only navigation completions**.

Both revised levels have complete clean input-only reference recordings through
the live game: Backwater **330.150 s**, Island Exchange **850.358333 s**. The
reference approaches are conservative and stop to align; these are not optimal
speedruns. The other 36 recordings remain unchanged. The console regression suite also
replayed all 38 published recordings cleanly at their expected times. The other
23 selectable missions have no published control-only recording; neither the
structural audit nor the circuit traversal fills that evidence gap.

Run only the affected checks locally:

```sh
npm run build
node --test tests/readiness.test.cjs tests/storage.test.cjs tests/replay-data.test.cjs
python tests/browser_readiness.py
```

GitHub Actions can run the broader suite after application. Audio, physics
coefficients, other missions and workflow versions are unchanged.

## Records

Schema 13 archives the three pre-volcano field courses and earlier Gerbozilla
championship, plus the earlier Grand Tour order. Display renumbering leaves
other mission IDs and their records intact.

Schema 12 archives only the earlier Backwater/Island Exchange stage records and
the affected Northwatch, Archipelago and Grand Tour circuits. Clean and overall
classes remain separate, as do older archive generations. The latest merged
Codex archive-display fix is preserved; schema 13 additionally archives the
changed field circuit, without resetting the sea/space circuit boards. Earlier logbooks are still importable.
