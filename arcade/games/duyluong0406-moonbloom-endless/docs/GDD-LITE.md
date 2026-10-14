# GDD-lite

## Prototype hypothesis

- We believe: constant downward pressure turns a familiar bubble-shooter action into a tense, replayable endless survival loop.
- It succeeds when: players can read shots quickly, enjoy matches and cluster drops, and voluntarily retry to improve their score.
- It fails when: spawning feels unfair, aiming is ambiguous, colors are inaccessible, or the field becomes visually noisy on mobile.

## Rules and mechanics

| ID | Trigger/input | State change | Observable feedback | Edge cases |
| --- | --- | --- | --- | --- |
| MEC-001 | Drag/pointer aim, release/click | Launch current orb along the previewed ray with one wall bounce | Elastic launcher motion, luminous trail, impact squash | Ignore input while a shot resolves |
| MEC-002 | Shot touches field/ceiling | Snap to nearest valid hex cell | Soft magnetic snap and impact pulse | Search outward if preferred cell is occupied |
| MEC-003 | Connected group reaches 3+ | Remove group; remove clusters no longer ceiling-connected | Burst particles, score float, combo pulse | Resolve all removals before descent resumes |
| MEC-004 | Time interval elapses | Descend field and spawn a staggered row | Canopy warning ripple and rising tension cue | Delay row spawn while a projectile resolves |
| MEC-005 | Orb crosses danger line | End run and compare score with local best | Garden dims, result card, retry action | Pausing never advances the descent timer |

## Player flow

| Step | Entry state | Action | Result | Acceptance ID |
| --- | --- | --- | --- | --- |
| 1 | Start screen | Tap Play | A seeded playable field appears | ACC-001 |
| 2 | Active run | Aim and fire | Orb attaches or causes a match | ACC-001 |
| 3 | Match resolved | Continue firing | Combo and score build while pressure increases | ACC-001 |
| 4 | Danger line crossed | Tap Try Again | New run starts and best score persists | ACC-002 |

## Features and data

| Feature | Required? | Owned state | Dependencies | Save/version notes |
| --- | --- | --- | --- | --- |
| Core gameplay | yes | run-local grid/projectile state | none | Deterministic seed supported for QA |
| Best score | yes | localStorage | browser storage | Versioned key; safe fallback if unavailable |
| Art pack | yes | static files | original generated and code-native assets | Source/prompts recorded in asset manifest |

## UI, art, audio, and accessibility

- Visual direction: painterly 2D moonlit greenhouse, deep indigo and teal foliage, luminous candy-like spirit orbs, warm gold accents, soft storybook shapes.
- Screens/HUD: start overlay, gameplay HUD, next-orb preview, combo label, danger line, pause, and game-over card.
- Feedback/audio/VFX: elastic launcher, glowing shot trail, squash on impact, petal-and-star pop particles, falling cluster streaks, subtle screen shake, synthesized chimes and thumps.
- Input/accessibility/localization: mouse/touch aim; keyboard alternative; reduced-motion and mute controls; orb symbols prevent color-only identification; Vietnamese-first UI with short strings.

## Levels and balance

- Difficulty/tuning variables: descent speed, row interval, active color count, match score, cluster bonus, combo window, danger buffer.
- Fixed test scenarios/seeds: guaranteed opening match, wall-bank shot, detached-cluster drop, spawn-during-flight lock, danger-line loss.
- Level/content plan: no discrete levels; difficulty ramps in survival phases and introduces more colors over time.

## Acceptance

- ACC-001: A complete endless run supports aim, fire, bounce, hex snap, match, cluster drop, continuous spawn/descent, scoring, loss, and retry.
- ACC-002: invalid/failure/retry behavior is explicit.
- ACC-003: target platform performance and input are acceptable.
