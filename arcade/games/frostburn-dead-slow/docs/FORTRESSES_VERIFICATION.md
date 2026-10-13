# Fortified-cities change set

Based on `frostburn/dead-slow` main at `b02e099a0d98e94056d08b3ded2cb0c6ca6a0c04`.
The recovered baseline tree matched GitHub's `b983ec99110a401b4c534e814eef02d6fb195cd0`.

## Focused local checks

- 45 passing tests in `rampage.test.cjs`, `rampage-audio.test.cjs` and
  `rampage-fortresses.test.cjs`; includes all six complete reference recordings.
- Two selected console tests: detached inspection/current stage count and
  reproducible replay data. No other console recordings were executed locally.
- 42 passing focused browser/audio checks in `browser_rampage.py`, zero page
  errors, including all six production-console replays, mode switching,
  keyboard/touch controls, counters, new course screens, water/dry audio graphs
  and finite warning reticles. Additional final screenshots exercise the
  descending-strike renderer at desktop and mobile sizes without page errors.
- Dry full-speed wheel peak approximately 0.0401 full scale in the offline render;
  wet peak approximately 0.0153. Silent gaps verified; this is not an acoustic
  calibration or a promise about speaker hardware.
- All edited JavaScript parses, the offline HTML builds without external assets,
  and the patch reapplies to the clean baseline and reproduces the same build.

Tests are narrowly scoped to this iteration. No broad sea/space suite, remote
CI, or remote publication is claimed. The old marine and space simulations,
reference fixtures and saved circuit routes are not modified.

## Reference routes

The offline authoring controller produces bounded directional/shield inputs
through the real game. These are generated references, not human-recorded or
optimal runs, and do not write coordinates, velocities, health or objectives.

| ID | Clean time, seconds |
| --- | ---: |
| gerbo-first-outing | 100.258333 |
| gerbo-banking | 95.008333 |
| gerbo-lake-skipping | 172.758333 |
| gerbo-downhill | 71.758333 |
| gerbo-hairpin | 189.258333 |
| gerbo-fort-pillow | 169.508333 |

Course 3 evades all nine retaliatory strikes. Fort Pillow evades five and
shields one. Completion waits for queued salvos to finish; none are silently
canceled when the city or course objectives are cleared.
