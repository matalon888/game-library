# Think Twice! — deep v2 plan (studio lane 4, started 2026-11-01)

deep v2: shipped 2026-11-01 (Verdict TEST, 7.3 vs 4.6; ticket written).

## What it is
One-screen lateral-thinking puzzles (Brain-Test style): a question on notebook paper, an SVG scene, 3 tries; the sneaky
answer is in the question, the page or the physics. 30 authored levels already existed, free hint, free skip, a plain
level grid, no progress meaning.

## Five layers today (0-3)
- Core verb 2: tap/drag anything, including the question words. Skill ceiling is lateral thinking (+ a timing level now).
- Core loop 1: every level 10-60 s, but a win only opens the next level; nothing is earned, skip is free.
- Level design 2: 30 hand-made, each one trick, but no teaching order/sawtooth, no new-world feeling.
- Meta 0: none (level grid only).
- Feel 1: win tick + confetti; wrong gives a shake; nothing escalates.
Data: db has few sessions for this game; read the lab for deep-think-twice once live.

## Plan (built this cycle)
- 40 levels in 4 worlds of 10 (Desk Doodles, Kitchen Table, Rainy Town, Plot Twist); levels 10/20/30/40 are BOSS levels (+2 stars first win).
  World 4 (levels2.js, 31-40) adds new mechanics: patience (31), pull-not-push (32), initials pattern (33), delete-a-word-then-use (34), timing (35),
  breather tickle (36), one-line equation (37), count-the-letters (38), bait + follow (39), BOSS multi-step escape (40). Purposes: levels2.js PURPOSE[].
- Stars: 3 = clean (no lost try, no hint, no earlier failed run), minus one per slip, min 1. Replay for 3 from the win card.
- Meta: map screen (worlds, stars per node, next level pulsing, locked nodes), Pip's hat collection (12 hats unlocked at star totals
  3..112, equip from the map, worn in every scene), star bonuses (boss +2, world clear +3, clean streak x5 +1, daily +2).
- Tomorrow hook: Daily Trick (one not-yet-3-starred level per day, +2 stars, day streak); win card + map say what waits tomorrow.
- Juice: 3 stars drop in with rising pitch, streak chips (SHARP/SNEAKY/GENIUS), bigger confetti with the streak, screen flash on new hat/streak 3+,
  new-hat reveal in the win card, boss header in red, hint bulb glows after 14 s.

## Left / ideas (next cycles)
fun gate critic; per-world scenery tint; more feedback on wrong answers; SO-CLOSE card on lose; check phone + desktop shots; fps.

## Board
Score meaning unchanged: board counts levels cleared (B.submit(1) per win).
