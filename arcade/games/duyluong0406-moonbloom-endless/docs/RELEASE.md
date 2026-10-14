# Moonbloom Endless 1.0.0-rc.6

## Release candidate summary

Moonbloom Endless is a responsive HTML5 endless bubble shooter with an original moonlit-garden identity. The field descends continuously, rows spawn forever, difficulty adds colors and speed over time, and the run ends at the danger line.

## Production additions

- **Trăng Nở:** successful matches and detached drops charge a radial blast for the next shot.
- **Sương Ngưng:** the same skill rewards charge an eight-second field freeze with a small upward reprieve.
- Power states are readable through progress, labels, animation, sound, keyboard shortcuts (`Q`, `E`) and touch buttons.
- Best score, best combo, run count, mute and reduced-motion settings persist locally.
- Runtime art is compressed to WebP and the build copies only shipping assets, fonts and code.
- The aiming guide now reaches the real collision point, uses a high-contrast glowing path and arrowhead, and previews wall-bank trajectories.
- Tap the `TIẾP` bubble (or press `R`) to swap the loaded and queued bubbles; the control locks while a shot is resolving.
- The guide renders a translucent preview bubble on the exact snapped hex cell, and projectile movement uses the same sub-step collision simulation; swapping no longer shows a text callout.
- Canopy descent now accelerates gently with score through a logarithmic curve, while a 9.8 px/s hard cap keeps late runs playable.
- Lyra now breathes and sways at idle, leans with aim direction, switches to a dedicated hands/body recoil pose on fire, and drives launcher kick, muzzle flash and recovery animation.

## Verification

- `npm.cmd test`: 8/8 passed.
- `npm.cmd run build`: passed.
- Standalone `dist/` smoke test: passed with zero browser warnings/errors.
- Fixed scenarios: start/fire/match/drop, endless spawn, both powers, pause/resume, loss/retry, desktop and 390×844 mobile.

## Package and rollback

- Release archive: `release/moonbloom-endless-1.0.0-rc.6.zip`.
- Integrity file: `release/moonbloom-endless-1.0.0-rc.6.sha256`.
- Rollback: retain the previous static directory and atomically switch the host root back to it; the candidate has no schema migration or backend dependency.

## Known limitations

- A physical iOS Safari and low-end Android sustained test is still recommended before public launch.
- Audio starts only after a user gesture.
- Scores are browser-local; no account or cloud leaderboard is in scope.

## Gate recommendation

Approve **Release Candidate** for owner playtest. Launch remains locked until the owner approves this gate and chooses a host.
