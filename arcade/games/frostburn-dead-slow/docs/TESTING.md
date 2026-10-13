# Current release checks — 6.0.0

Version 6 adds `tests/rail-final.test.cjs` for complete control-only routes in
5-09 through 5-12 and `tests/version-six.test.cjs` for volcanic hill physics,
helper forces, ferry balance, flood boundaries and volcanic record migration.
`tests/rail-dispatch.test.cjs` checks manual departure signals, tunnel routing,
whole-passenger clearance, reused helper controls and schema 17 archives.
`tests/browser_rail.py` checks the three-lever mobile layout, stable warning space,
final-mission displays and console finale playback. The browser suite runs in CI.
Use `npm run test:ci` for concise failure excerpts instead of full assertion dumps.

Focused tests for the current release are in `tests/release-atlas.test.cjs` and
`tests/browser_release_atlas.py`. The Node tests exercise restart state transitions,
placeholder rejection and playable ordering, record archives, hazard geometry and
timing, and the three affected control-only recordings. The browser test exercises
Shift+R and immediate retry buttons, grayscale chapters, renumbered instruments,
volcano forecasts and the single-composite ghost alpha.

```sh
npm run build
node --test tests/release-atlas.test.cjs
python tests/browser_release_atlas.py
```

See [RELEASE_5_1.md](RELEASE_5_1.md) for the exact verification scope. The following
sections document earlier test passes and the wider suite; they are not claims
that every suite or every navigation recording was rerun for this release.

---

# Testing and verification

## Core suite

```sh
npm run check
npm run build
npm test
npm run verify:runs
```

Node's built-in test runner is the only core test dependency. The headless
harness runs the actual `game.js` with inert DOM/audio/render stubs; it does not
reimplement navigation, collisions or job rules.

The suite covers acceleration and astern braking, water-relative steering,
hull containment/collisions, deterministic gates/tides/current, shelter,
signed speed, records, migrations, route/circuit boundaries, retry accounting,
convex island geometry, manifests, ramps, interrupted transfer, payload mass,
unilateral rope forces, momentum transfer, winching, break/recovery,
casualty berths, gate protection and local-server/build behavior. Open-water
tests check every starting hull and coast configuration, all four exits,
casualty exits, no rebound, stopped clocks, retries, and ten revised starts.
Console tests cover argument validation, detached inspection, 0–32× fixed-step
execution, bounded frame work, replay divergence and protection of records.
Schema-4 tests cover archive preservation, idempotence and older imports.

Some tests position the ship or casualty directly to isolate **objective state
machines**. All twelve island job sequences are checked that way, including
the requirement to finish the work before final mooring. Such tests do not
prove every navigational approach or medal time is achievable.

## Control-only evidence

The following complete trajectories use actual timed player controls and the
same fixed-step state machine as the game. They do not alter positions,
velocities, physics constants or objective progress:

The twenty-five published recordings and their measured times are listed in the
[console guide](CONSOLE.md#watch-the-actual-verification-runs). Every fixture is
replayed through both the Node game harness and the production Chromium console,
and checked against its recorded completion time within one 120 Hz tick.

Coverage now includes early reverse-thrust braking, a turning approach around a
breakwater, timed booms, lock cycling, stern-first parking, a tidal crossing,
an exposed cross-current, loading/unloading, a late-stage return ferry service,
and approaching and towing the heavy work barge. The two later island recordings
start at their normal fairway/remote-tug departures, not alongside the job target.
The ferry exchange returns with the new manifest; the barge must settle in its
own berth even after the tug is parked. All published recordings finish cleanly: no contacts,
wake violations, groundings or parted lines. They are not claimed optimal.

The other twenty-four levels still lack published control-only completions.
Objective-isolation and spawn-clearance tests must not be mistaken for complete
playthroughs. Console playback is always unranked, so it cannot seed player
records. `DeadSlow.runs()` and `DeadSlow.times()` separate measured runs from
unverified design targets. New fixture tests reject unknown input fields,
non-finite values, invalid controls, unsorted timestamps and duplicate level IDs.
After changing fixture JSON, run `npm run replays:sync` before rebuilding.

## Browser checks

The release was checked locally with Node 22.16.0, Python Playwright 1.57.0 and
system Chromium on Linux, using inline mode. The execution environment blocked
file and HTTP page navigation by policy, so its browser checks did not exercise
a navigated origin. The Node HTTP-server tests did execute locally. Chromium
touch/viewport emulation is not a claim of testing a physical Android device
or iOS Safari.

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_smoke.py --inline --report reports/browser.json
```

`--inline` mounts the built HTML in memory and substitutes in-memory
localStorage, so the suite works where file navigation is restricted. Node tests
cover persistence and migrations. To test a real origin, start `npm run serve`
and use `--url http://127.0.0.1:8080/dist/` instead. With neither option, the suite
navigates to the local built file; browser/OS file policies may disallow that.

The script prefers a system `chromium`, falling back to Playwright's installed
browser. `--chromium /path/to/browser` overrides it. `--screenshots reports/shots`
produces diagnostic captures. Generated reports and diagnostic screenshots are
not source files; curated screenshots live under `docs/images/`.

Browser coverage includes keyboard and pointer input, three simultaneous touch
controls, control release/cancel, mobile layout at multiple sizes, menus,
world selection, job instruments, ferry transfer, winch operations, retry,
all-stage chart rendering, objective guards, clean records and normal launches
without a test harness. `browser_open_water.py` is called by the main browser
suite and exercises the production console without `?test`: discovery,
animated acceleration, freeze/resume, all published replays and out-of-bounds UI.
It renders the actual WebAudio horn offline and checks signal level, sustained
harmonics, attack/release, voice limiting and mute before/during a blast. This
checks the signal, not a claim of measured real-world acoustic fidelity.
`browser_audio_mix.py` additionally renders the production full-ahead/full-astern
engine with a horn, repeated horn presses, engine-order bell and impact cue at
44.1, 48 and 96 kHz. It checks a peak ceiling of 0.15 full scale, finite/unclipped
samples, a genuinely audible engine and exactly one horn. A separate lower
horn ceiling catches accidentally restoring the old envelope. Offline scheduling
is held until the synchronous batch is installed so the renderer cannot race
through seconds between JS calls. This is not a calibrated physical-speaker test.

The standalone build is checked for external assets
and for making no network requests. The page-error listeners must stay empty.

## CI and release boundaries

The included GitHub workflow runs core checks once using the Node version in
`.nvmrc` (Node 22), alongside Chromium browser checks, including an HTTP-served
build. It runs on pull requests, pushes to `main`, and manual dispatch;
feature-branch pushes do not start a duplicate run alongside their pull request.
That is configured coverage; it is not a claim that GitHub has executed it before
this repository is pushed. Pages publishing is a separate, manually triggered
workflow.

Local multiplayer, online records, physical hydrodynamic calibration, arbitrary
rope wrapping, all browser engines and every human-played medal route are not
covered. Re-run control fixtures when changing physics. A geometry fit or
state-machine test must never be reported as a complete navigational playthrough.

## Space regression coverage

`space.test.cjs` checks all starts and final-cradle sizes, no-drag coast and
rotation, opposite burns, mass, propellant accounting, moving-frame captures,
shadow geometry, fractional solar power, scanner blackout, radiation failure,
equal/opposite beams, refuelling guards, assembly handover and collision
envelope, cannon charge/flight/recoil, time history and paradox failure,
whole-hull sector exits, bonus exclusion and schema-4 record migration.

Every space mission also has a checked-in input-only fixture executed through
the actual game in both Node and the production browser console. The Century
Ship fixture executes its whole 32-minute simulation, not an accelerated
position assignment. Its acceleration/distance lower bound is checked
independently, with an intentionally generous point-sized docking allowance.
`browser_space.py` adds mission UI, keyboard/cancelled-multitouch controls,
an animated 32× flight, mobile layout and return-to-sea label restoration.

The requested development pin is `playwright==1.62.0`. This sandbox's package
index could not supply that version, so local browser checks used the existing
Playwright 1.57.0 with system Chromium. No runtime dependency was added or
older developer installation replaced. CI installs the pinned version in its
fresh environment; consult the PR's actual check result for that verification.
Pages actions are updated to `upload-pages-artifact@v5` and `deploy-pages@v5`;
deployment stays manual/opt-in and is not run by the test suite.


## Rampage: forests, pets, fire and escort

The nine-course pass adds `tests/rampage-wilds.test.cjs` and the standalone
`tests/browser_wilds.py` check. Use the three-file Node command in
[the field guide](GERBOZILLA.md#records-and-focused-checks) for the mechanics,
audio mocks and existing siege interactions. The browser check verifies the four
replacement/new recordings through the production console; keyboard and touch
fire, cancelled holds, tow-to-Rampage counters, portrait/landscape controls,
results, map rendering and a fixed-reference offline audio comparison are covered.

Isolation tests seed positions or records only to exercise individual rules;
they are not author-time claims. The four published input timelines separately
prove clean, full completions without pose or objective shortcuts. The existing
five Rampage recordings are unchanged; broad sea/space suites are left to CI.

This pass ran 40 mechanics/audio/fortress Node tests plus the one world-count
regression: **41 passing targeted Node tests**. The focused Chromium runner
passed **39 checks**, including all four affected full input recordings. The
accepted water reference rendered identically; the dry/fire mix retained
headroom and mute/release silence. These local checks used Playwright 1.57.0
with system Chromium and do not claim remote CI or the full regression suite.


## Version 5 release pass

Only the changed terrain, ten affected control recordings, circuit integration
and save migration are exercised locally for this pass:

```sh
node --test tests/v5-release.test.cjs
python tests/browser_v5_release.py
```

The browser check uses the built standalone file and system Chromium. It checks
all field charts, the river, chase playback, World 4 circuit result/log screens,
mobile layout and that switching back to marine play restores its UI. Circuit
completion isolation uses the test harness, not claimed full marathon runs.
The unchanged audio, other twenty-seven recordings and full regression suite are
left for CI. Older tests that enumerate route length now expect sixty stages.
