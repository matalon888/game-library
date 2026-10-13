# Current release verification

The 5.1.0 UX, atlas and volcanic-crossing pass is documented in
[RELEASE_5_1.md](RELEASE_5_1.md). The following notes are retained historical
verification of the earlier space-mission redesign, not a new full-suite run.

---

# Verification — Moving cover and recurring histories

Baseline: `frostburn/dead-slow` main at
`3ec7f5f89b75f716a69fdd8fb9cc63ea78d54040`, tree
`e932ca07c341b1063b2955a1d1b7596bec1c8cd7`. The restored console greeting,
spaceflight audio/radar, vocabulary and rotating-contact fixes remain present.
No dependencies or workflow configuration changed.

## Targeted local checks

| Check | Result |
| --- | --- |
| New mission, temporal, planet and migration tests | 14 passed, including five control-only completions |
| Existing affected space tests selected by name | 5 passed |
| Storage regression suite | 9 passed |
| Focused Chromium layout/instrument checks | 12 passed; no page errors |
| Build | Self-contained HTML generated successfully |
| Visual review | Desktop Janara with two histories, moving shadow forecast, Erebune limb and portrait layout |

Only relevant tests were run locally. These counts are **not** a claim that the
full Node/browser suites, all 25 recordings or remote CI were rerun. The existing
full browser entry point includes the new focused mission checks for CI.

```sh
npm run build
node --test tests/space-mission-design.test.cjs
node --test --test-name-pattern='time insertion|time history|century 30|v4 logbooks|unshielded' tests/space.test.cjs
node --test tests/storage.test.cjs
python tests/browser_mission_design.py --screenshots reports/missions --report reports/missions.json
```

The five affected recordings complete cleanly through the normal 120 Hz game:

| ID | Seconds | Notes |
| --- | ---: | --- |
| `vacuum` | 148.358333 | Offset approach around two outbound flybys |
| `umbra` | 398.508333 | Survey, wait in cover, capture as the shadow arrives |
| `perihelion-dispatch` | 393.258333 | Fuel and beam rescue inside overlapping migrating shadows |
| `yesterday` | 1250.008333 | Both chronogates; final leg with two solid recurring histories |
| `century-ship` | 1922.333333 | Eight main/lateral commands; clear the planet and return to the arrival line |

These are conservative reference completions, not optimal speedruns. The maze
reference stops at its turns and takes deliberately offset passing lines. Input
JSON and the generated offline replay library agree. The other twenty recordings
are retained unchanged, not claimed freshly reverified here.

Some unit tests position ships to isolate gate capture, collisions or record
migration. Those are not author-run evidence. The five complete recordings use
only normal controls; the chronogates' in-game relocations occur normally. Planet
surface overlap fails without adding an impulse, preserving the successful-flight
acceleration bound documented in [SPACE.md](SPACE.md).

The focused browser checks use system Chromium and available Playwright 1.57.0,
with inline mounting and a localStorage shim. The repository pin remains 1.62.0;
CI handles that environment. Portrait checks are emulation, not a physical-device
test. The Erebune close-up is a geometry inspection at a positioned spacecraft,
not a screenshot claimed to prove a recorded voyage.
