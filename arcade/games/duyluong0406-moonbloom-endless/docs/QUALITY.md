# Quality policy

- Independent QA owner: quality-controller.
- Prototype evidence is lightweight but runnable.
- Production player-visible work requires repeatable scenario/build evidence.
- Game-feel and balance require owner playtest plus fixed scenarios when possible.
- Critical/high findings block Release Candidate approval.
- QA reports findings; the producer owns fixes.
- Final handoff records version/artifact identity, smoke test, known limitations, and external asset/reference rights.

## Prototype evidence — 2026-08-12

### Automated logic

- Command: `npm.cmd test`
- Result: **6/6 passed**.
- Coverage: hex adjacency, cross-row color clusters, detached clusters, endless difficulty ramp, combo/drop scoring, and deterministic RNG.

### Build and smoke test

- Command: `npm.cmd run build`
- Result: **passed**; self-contained static build produced in `dist/`.
- Browser console during tested flows: **0 errors, 0 warnings**.
- Desktop viewport: 1200×900.
- Mobile viewport: 390×844; a 360 px minimum layout check remains part of production compatibility QA.

### Player-visible scenarios

| Scenario | Result | Evidence |
| --- | --- | --- |
| Start → aim → fire → attach | Pass | Pointer and touch-style canvas click both resolved a shot |
| Guaranteed opening match | Pass | First centered shot produced `NỞ RỘ!` and 100+ points |
| Detached-cluster reward | Pass | Falling sprites, particles, `THẢ RƠI +4`, and 440 score observed |
| Endless descent and spawn | Pass | New row appeared after about 11.5 seconds; danger meter advanced to 14% |
| Pause → resume | Pass | Simulation stopped behind `TẠM DỪNG`; resume restored play |
| Loss → retry | Pass | `?qa=loss` produced game-over flow; `THỬ LẠI` started a clean run |
| Accessibility controls | Pass | Keyboard aim/fire/pause, mute, reduced-motion toggle, and symbol-coded colors are present |

Screenshots: `evidence/prototype-desktop.png` and `evidence/prototype-mobile.png`.

### Remaining risks

- Game feel and balance still need the owner's hands-on playtest before Prototype Gate approval.
- A physical low/mid-range mobile device, Safari, and sustained 60 fps profiling have not yet been tested.
- PNG assets are intentionally high quality for the prototype; production should add WebP/AVIF variants and an asset-size budget.
- Synthesized audio is functional but still needs a final mix and broader device audio testing.

## Release candidate evidence — 2026-08-12

- Candidate: **Moonbloom Endless 1.0.0-rc.6**.
- Automated logic: `npm.cmd test` — **8/8 passed**, adding hex-radius blast and skill-charge coverage.
- Build: `npm.cmd run build` — passed; standalone `dist/` smoke test has **0 console errors/warnings**.
- Runtime package: **1,322,044 bytes**, reduced from 17,851,501 bytes of source/reference assets by WebP conversion and selective packaging.
- Responsive QA: desktop default viewport and mobile 390×844; no horizontal overflow, all controls remain visible.
- Regression: start/fire, Trăng Nở, Sương Ngưng, score update, pause/resume, forced loss, retry, persistence fallback and reduced-motion control pass.
- Focused RC.2 QA: straight and wall-bank aiming guides visually reach the collision target; actual bank shot completed with no browser warning/error.
- Focused RC.3 QA: click/tap swaps current/next labels, `R` swaps back, the button locks during flight and restores afterward; mobile hit target measured 55×55 px with no browser warning/error.
- Focused RC.4 QA: predicted and attached hex cells matched for straight (`6:4`) and bank (`6:5`) shots; swap callout remained hidden; no browser warning/error.
- Focused RC.5 QA: score-sensitive descent is monotonic and capped at 9.8 px/s; browser smoke measured 4.21 px/s at 0 points and 6.41 px/s at 10,000 points at run start, with no browser warning/error.
- Focused RC.6 QA: idle, 70 ms recoil/muzzle-flash and 490 ms recovery frames captured successfully; gameplay continued through the animation, reduced-motion path remains bounded, and browser console stayed clean.

### Known limitations

- Physical iOS Safari and low-end Android sustained-performance profiling remain external device checks.
- Audio is synthesized Web Audio and can begin only after the first user gesture, per browser policy.
- No cloud leaderboard/account sync; scores and preferences are local to the browser.
