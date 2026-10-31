# Swirl Tee: design (deep v2)

deep v2: shipped 2026-10-31 (Verdict: TEST, critic v2 7.4 vs v1 4.4; keep improving: thin-ring highlight, NEED note, orders 1-2 stars)

## What it is
Tie-dye a white tee to match a customer's target: pick the fold (the shape of the pattern), the shirt binds into a bundle
with strings, squirt dye into each section, then unfold for the reveal. The reveal is the moment the game is about.

## Numbers (diag_events type 'game', 2026-10-22..29, 208 visits)
- Median time per visit 32 s (p75 144 s); 19% reach 3 min; quick quit (<15 s) 33%.
- Runs end: 113 close, 90 next game, 5 back. Final state: 131 mid-round, 39 just won, 23 just lost.
- Level reached: 81 of 208 never left level 1 (34 of them in the fold / folding / first dye step), 37 ended at 3, 25 at 4,
  15 at 5, under 20 past level 6. Nobody got deep; there is nothing to get deep into (levels 3+ are random reshuffles).
- Back on another day: not measurable from diag (no device id in these rows).

## Five layers today (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 1 | Drag a bottle over the bundle. Coloured dots say which colour goes where, so it is colouring by numbers: no decision, no skill beyond "cover it". |
| Core loop | 1 | Pick the fold (one real decision), fill sections, reveal. Pressure: a match % needed at the end, nothing during the round. The loss is a number, not a "why". |
| Level design | 0 | Levels 1-2 authored, 3+ generated with a seed; only more sections and finer brush. Same thing every round. |
| Meta | 0 | A level number. Nothing carries over, no stars that mean anything, nothing to collect. |
| Feel | 2 | Good: fold spin, strings snapping, the unfold reveal, confetti. Weak: the squirt itself (a blot appears instantly), no build-up on the reveal, no combo. |

## Verb and skill ceiling (v2)
Same verb (drag the bottle over the bundle). Skill comes from:
1. **Reading the target**: which fold makes it (6 folds by the end, two that look alike: spiral vs burst, stripes vs diagonal).
2. **Colour mixing** (world 2): the stall only has red, yellow, blue. Green = blue + yellow, orange = red + yellow, purple =
   red + blue. A third colour on top turns the section to mud. Early markers show the two drops; later only the result.
3. **Wet fabric** (world 3): dye near a string bleeds into the next section. Clean strokes away from the lines.
4. **Speed**: each order has a par time (customer's patience). 3 stars = 90%+ match inside par.

## Round loop
Customer + target appear (picture, no text) → pick the fold → bundle → choose bottles and dye each section (a decision
every few seconds: which colour, which order for mixes, where to stroke) → ✓ → reveal: match % rolls up, stars thunk in,
customer reacts (😍 / 😊 / 🙂 / 😢). Loss line names the section that was off ("SO CLOSE: 3% short").

## Mechanic plan (in order)
1. Stripes, rings, spiral (W1, from v1).
2. Burst fold: straight sunburst wedges; looks like spiral, reads differently (W1 L7).
3. Free-dye bonus shirt: no target, anything goes, always a keeper for the wall (L6, L18, L30).
4. Colour mixing: primaries only, secondary targets (W2 L13).
5. Diagonal fold: stripes on a slant (W2 L16).
6. Mud: a third colour ruins a section (W2, taught by L15, tested L20).
7. Mix markers lose their hint drops ("read it yourself", W2 L19).
8. Heart fold: the surprise reveal (W3 L25).
9. Wet fabric / bleed near strings (W3 L27).
10. Combined finales (L24 rainbow burst, L36 rainbow heart, wet + mixes).

## Worlds
- W1 Beach Stall (1-12): read the target, four folds, first decoy bottles. Hard: 10. Bonus: 6.
- W2 Night Market (13-24): mixing, diagonal fold, mud. Hard: 20. Bonus: 18. Finale 24.
- W3 Festival (25-36): heart, wet fabric, everything together. Hard: 32, 36. Bonus: 30.
- After 36: generated orders from all unlocked folds/mechanics (seeded per level), same rules.

## Meta
- **Tee Wall** (level map + collection in one): each world is a row of 12 hangers; a cleared level hangs the shirt the
  player actually made, with its stars. Empty hangers are dashed. Tap a cleared tee to replay it for stars.
- **Stars → dye crate**: every 8 stars opens a crate with a random pick: 2 Splash drops (booster: fill one section in one
  squirt), a new table colour, or (rare) glitter finish for every reveal.
- Progress saved (kit store, 'd_' keys). A v1 player keeps their place: v2 starts at their v1 level (max 12).

## Feel list (v2)
- Dye soaks in (each drop blooms over 250 ms), a squelch on every squirt with pitch by section, drip on the table.
- Section done: pop + rising note; sections done fast in a row climb a "FLOW" chain (bigger text, higher notes).
- Reveal: slow spin, strings snap one by one, unfold, the match % counts up with ticks, stars thunk one at a time,
  the customer reacts, glitter if unlocked.
- Near-miss loss line with how far off and which section.

## Fairness / board
Board stays "Levels cleared" (sum, +1 per cleared order, replays included as in v1); bonus free-dye shirts don't post.
flow.k() and adapt.js knobs are used exactly as v1 uses them (brush, match target); no numbers changed.

## What changed (v2, behind `DEEP`; v1 untouched)
- `levels.js`: 36 hand-made orders (purpose line each), 3 worlds, generator after 36 from every fold/mechanic.
- Three new folds (burst, slant = diagonal stripes, heart) on the same bundle geometry; fold row shows 1-4 buttons.
- Paint model: dye lives in a 96×96 cell grid drawn onto the bundle (soaks in over 250 ms), so mixes and mud are exact.
- Colour mixing + mud (W2), wet-fabric bleed (W3; bleed reach ≤ 30% of a section's width so a clean stroke always exists).
- Mix markers with their two drops orbiting (hint levels), "MUD!" / "BLEED!" pops.
- Customer emoji per order (reacts 😍/😊/🙂/😢), HARD / FREE DYE target frames, par timer chip (⏱) for the 3rd star.
- Reveal: match % rolls up with ticks, stars land one by one; FLOW chain for sections finished fast in a row.
- Dye stream from the nozzle while squeezing.
- Tee Wall (start + win card): 12 hangers per world with the player's own shirts and stars, tap to replay.
- Dye crate every 8★: new table colour, glitter finish (rare), or +3 Splash; Splash booster (fills one section exactly).
- New-mechanic chip at the first level of each idea (NEW FOLD + icon, the mix recipes, 💧 WET).
- QA: `window.__game.bot()` solves v2 (mix order, wet-clean drop points); all 36 + generated 37 solved 3★ (2026-10-29).
