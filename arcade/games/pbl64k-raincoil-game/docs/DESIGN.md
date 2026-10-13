# RAINCOIL — first candidate

## Intent
A tactile, legible arcade game about turning an increasingly unwieldy body into a pigment collector. Three minutes inside an electrical rain chamber. Catching everything is tempting but paints over useful patterns; dodging everything builds a mineral floor. Matching is spatial and opportunistic rather than a stopped planning puzzle.

## Original rules
- 22 × 24 bounded grid; snake moves automatically with buffered cardinal turns, no direct reversal.
- Rain falls in telegraphed columns. A droplet paints the struck body segment and its next tailward neighbor. Three or more consecutive matching colored segments clear. Pigments remain in body order while the physical tail retracts, so the snake stays connected.
- Every few seconds the body grows. Missed droplets become solid debris, stacking upward.
- Color clears destroy debris near the matched body positions, score points and build a timed combo.
- SHED (Space) spends four tail segments, requires length >= 9, clears nearby debris and briefly shields the head. Cooldown prevents spamming. This converts growth into an emergency resource.
- Three integrity points. Collisions damage and grant a short recovery window; walls turn the head inward. Storm completion at 180 seconds. Endless mode is an alternative from the start.
- Three pigments with redundant shapes. Audio is synthesized locally. Reduced motion and independent music/sound controls. Keyboard and on-screen controls.

## Presentation
Ink navy, warm ivory, acid yellow, hot coral, glacier blue. Bold compact typography, slightly imperfect industrial markings, soft luminous drops and chunky mineral slag. A restrained grain/scan texture, expressive eyes, ring bursts and a procedural rhythmic score. Feedback must preserve board readability. No borrowed art or music.

## Status
These are authorial decisions for the first candidate, open to tuning during implementation. Current 2026 context checked against the official IGF finalist listing (https://igf.com/finalists-and-winners/); it is context for an individually authored identity, not a template or a claim that a single indie aesthetic exists.
