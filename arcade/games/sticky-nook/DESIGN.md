# Sticky Nook — DESIGN (deep v2 plan, lane 37, 2026-10-31)

**What it is:** peel cute stickers off a tray, press them on their outlined spots in an isometric dollhouse room; the room's
colour comes back with every sticker. Same name, same art (canvas-drawn items), same drag/tap verb.

## Data (7 days, 19 visits)
Median visit ~35 s; 5 of 19 visits ended under 10 s on level 1 (1 tap); the runs that finish L1 go on (L7-11 reached by the keen).
A level is "place N stickers", hearts almost never matter, rooms are random per level: nothing to master, nothing to come back for.

## Five layers today (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 1 | drag to a visible outline: pleasant, zero skill (spot is shown, snap is generous) |
| Core loop | 1 | place everything; no pressure, no decision, no near-miss |
| Level design | 0 | random items per level, 4 themes cycling; level 20 = level 4 with more stickers |
| Meta | 0 | level counter only |
| Feel | 2 | nice pop, sparkles, pentatonic notes; no chain, no escalation |

## v2 plan
**Verb with skill:** press the sticker near the spot centre = PERFECT (✨), place quickly after the last = CHAIN (x2, x3 …).
Chain 5 = COZY FEVER (a few seconds: room glows, every press worth double chain, rising notes). A heart is lost on a wrong spot;
a wrong-spot also breaks the chain.
**Round (25-60 s):** read the room → choose which sticker next (tray shows 3) → press → chain builds. Stars: 1 = done, 2 = done with
all 3 hearts, 3 = done under the par time with a chain of N (par per level).
**Mechanics, in order (each introduced alone in a gentle level):**
1. L1-3 core press, perfect, chain.  2. Twins (L4+): the same item twice in different colours; the outline is faintly tinted, read it.
3. Locks (L7+): a taped sticker needs its base first (rug → table, sofa → cushions): order matters; tray shows the lock.
4. Dust sheets (W2): some spots are hidden under a sheet; tap peeks for 1.5 s, then it drops back (memory + elimination); each peek costs the 3rd star.
5. Conveyor (W3): the tray slides every 3.5 s, front sticker goes to the back (timing).
6. Rush (W3): a countdown ring, "guests arrive in 40 s"; running out = lose with "SO CLOSE: 2 left".
7. Bosses L10 / L20 / L30: biggest rooms, mixes.
**Worlds:** 1 Cosy Flat (core, twins, locks) · 2 Hush Hush (sheets + twins + locks) · 3 Party House (conveyor, rush, everything).
**Meta:** level map with stars and a pulsing next node; Sticker Album (a sticker per level, gold at 3 stars; every 6 stars a
chest with a helper wand = auto-place one sticker); Daily Room (seeded generated room from unlocked mechanics) + streak.
**Tomorrow hook:** result card and map say "Tomorrow: Daily Room #N · day D streak"; the daily room is really there tomorrow.
**Feel list:** pick-up squash and lift, tick when entering snap range, perfect ring, rising chain notes, hit-stop on boss last
sticker, shake on wrong spot, confetti + rolling star counter, fever glow, haptics.
**Board score:** unchanged meaning, "Levels cleared" today (first-time clears and the daily room only).
**Fairness:** no difficulty tied to device/money; flow.k() used as in v1 (snap tolerance only); no ads/money text.

## Build status (2026-10-31, cycle 1)
Built, READY false (`?deep=1` forces v2 for QA only): `v1.js` (untouched old game), `levels.js` (30 authored rooms + purpose lines, solver
`deadlockFree`, seeded `gen` for daily/endless), `deep.js` (twins, locks, dust sheets, turning tray, rush, chain/perfect/fever, stars,
map, album, wand + chest every 6 stars, daily room + streak, tomorrow line). QA in `qa/`: `playall37.mjs` (bot solves all 30: pass),
`touch37.mjs` (real drags, wrong spots → lose card, lock, peek: pass). Not done yet: fresh-replay by a human-like run, critic gate
(FUN_REVIEW.md), 4x CPU fps check, desktop shots review, ticket. deep v2: in progress
