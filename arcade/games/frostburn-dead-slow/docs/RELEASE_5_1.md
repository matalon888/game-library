# 5.1.0 — Eight-world atlas and safer playtesting

Prepared against `frostburn/dead-slow` main at
`948c7d1a7ccda6e02cd5d4dc2fe446f1ec6711da`, tree
`b383cdf244050254040eae9aa22d841d805bc708`. The latest Codex fix preserving
console-selected speed across freezes is retained.

## Scope

- All in-game restart keys/buttons request confirmation. “Keep playing” receives
  focus; Escape cancels and R cannot confirm. The simulation stops while asking.
  Cancelling a running attempt retains mission state as unranked practice under
  the existing pause policy. Deliberately confirming starts a fresh attempt and
  charges the abandoned attempt once, not the completed part of the circuit.
  A restart request on a completed stage does not double its displayed time.
- The hamster ghost is drawn opaque to a reusable small canvas, then composited
  once at ghost opacity. The body occludes the hind legs before transparency.
- Eight numbered chapters, five currently playable: Coast 1, Northwatch 2,
  Archipelago 3, Gerbozilla 4, railway 5 (coming soon), Meridian 6, Pale Reach 7
  (coming soon), and megastructures 8 (coming soon). The three future chapters
  each show twelve named, disabled mission cards and reject console launching.
  They never enter progression, counts or records as playable assignments.
- The actual Grand Tour still has sixty stages, now in 1–2–3–4–6 order. The
  Century Ship remains a separate bonus. There are 61 playable assignments and
  36 unavailable placeholders, not 97 playable missions.
- Fictional display names replace named islands and vessels without rewriting
  persistent mission IDs. See FICTIONAL_NAMES.md. The two changed replay
  descriptions contain no input/timing modifications.
- Timed geothermal hazards in three field courses: a lava crossing below
  Mount Muesli, independently clocked forest fissures, and steam at the Bristle
  Brook crossings. Quiet/warning/eruption states derive from simulation time.
  The marked footprint is the exact whole-ball damage boundary. Shield duration
  and cooldown are unchanged; a long eruption outlasts one shield.
- Schema 13 archives the three pre-volcano routes, the changed Gerbozilla
  championship and the old Grand Tour order, retaining overall/clean classes,
  ghosts and splits. Other stage and world-circuit records remain active.
- README links to the intended official hosting URL. Every dialog and the
  persistent footer link to the issue tracker and welcome feature requests.
  This change does not publish or deploy the website.

## Local verification

**51 distinct targeted Node checks passed**, comprising 16 release tests and
42 selected compatibility tests, with seven tests shared between the two runs.
The compatibility subset covers chapter/circuit progression, archives, bonus
progress, console catalogs, schema-aware migration and the documented greeting.
**32 focused Chromium checks passed**, with zero page errors. Desktop and
portrait screenshots were inspected. `npm run check` parses 52 JavaScript files
and checks deterministic bundling; `npm run build` emits the self-contained HTML.

Only the three affected full navigation recordings were rerun:

| Recording | Clean time | New hazard coverage |
| --- | ---: | --- |
| `gerbo-downhill` | 115.758333 s | Furnace footprint crossed during its quiet phase |
| `gerbo-forest-slalom` | 201.758333 s | Both fissures crossed in safe windows |
| `gerbo-prickly-business` | 304.258333 s | Both steam footprints crossed safely |

These remain ordinary fixed-control recordings through the production game.
Their inputs and completion times are unchanged. A different arrival phase
can be dangerous; these runs do not prove optimality or every possible route.
The other 35 recordings and unrelated physics/audio suites were not rerun.

The sixty-stage circuit traversal test deliberately isolates completion to
check transitions and scoring. It is not a sixty-stage navigation completion.

```sh
npm run check
npm run build
node --test tests/release-atlas.test.cjs
node --test --test-name-pattern='circuit|Grand Tour|schema|world|catalog|progress|bonus|greeting|reference module|archive|sixty transitions|all 61|restart a completed' \
  tests/worlds.test.cjs tests/v5-release.test.cjs tests/sector-progress.test.cjs \
  tests/flight-copy.test.cjs tests/console.test.cjs tests/readiness.test.cjs \
  tests/release-atlas.test.cjs
python tests/browser_release_atlas.py
```

Local browser checks use available Playwright 1.57.0 with system Chromium and
inline mounting/storage shims. The repository's 1.62.0 pin is unchanged. CI now
includes the focused browser release check; it has not been run remotely for
this patch. Portrait checks are emulation rather than a physical-tablet test.
