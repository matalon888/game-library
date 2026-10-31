# Rack Attack FUN_REVIEW (critic gate, PLAYBOOK section 0), second pass

Method: Chrome headless, 390x844 touch (CDP touch events: tap the table to aim, drag the bottom bar to pull), video + screenshots, all non-127.0.0.1 requests aborted.
v2 (?deep=1): about 20 min over several runs: L1-L9 cleared in one run (L4 Rex duel won, lost once, L8 Mia duel won), map opened and a level picked from it, retry button/card used about 60 times, Slalom L10 (limit now 7 shots) tried 14 times in a row and not cleared, L11 Happy Hour tried 7 times, L12 Duke boss duel won first try.
v1: about 6 min, 80 shots, 2 matches lost, 1 won (after a FOUL), a 4th started.
Caveats: headless, no audio (not scored). My player is a script (ghost-ball aim in screen coordinates plus about 0.1 ball of jitter, no spin, no banks), so it is worse than a human on Slalom and the order levels; failures there are partly mine. Screenshots could not reliably catch the 0.3 s pot slow-mo, so I saw ring/particle bursts at pockets but cannot vouch for the slow-mo or the escalating callouts beyond what is written below.

## Scores (0-10)

| # | Test | v1 | v2 |
|---|------|----|----|
| 1 | 10-second test | 5 | 8 |
| 2 | Toy test | 5 | 7 |
| 3 | Almost test | 4 | 7 |
| 4 | One-more test | 4 | 9 |
| 5 | Surprise test | 2 | 8 |
| 6 | Mastery test | 2 | 7 |
| 7 | Tomorrow test | 1 | 8 |
| | **Average** | **3.3** | **7.7** |

Why, short:
1. v1 opens on a 15-ball rack with RACK ATTACK in huge letters over it; the first real pot is 20+ s away and Rex then takes his turns. v2 has no logo on the table now: one ball, one pocket, a cue demo sweeping, tap + pull, pot at about 4 s with a burst at the pocket and a 3-star card at 6 s. Gap to 9-10: the first pot is still a quiet particle puff, not a thunderclap.
2. Pull-to-shoot is the same physics in both. v2 adds a ghost-ball ring and guide line, a bursting pocket and the retrying cue; it is pleasant and clean, not addictive. Single pots on easy tables are still small; the cue ball trail/ball-in-pocket weight is modest.
3. v1 losses (foul, "Potted the 8 too early") arrive after a long wait and feel random. v2 gives "OUT OF SHOTS / SO CLOSE: 1 ball left! / par 2 limit 4" and the 8-ball line now reads "The 8 goes LAST: clear your balls first". Fair and close. Minus: "2 balls left" and "3 balls left" cards give no pointer to what went wrong, and the ordered-ball levels (9, 10) punish a wrong first contact silently.
4. v2 retry is a button on screen plus a card with a big RETRY, 5-15 s per trick attempt, rival turns now fast (a whole Rex match took 20-45 s, Duke boss about 2.5 min with retries). Instant. v1 loses a match after 60-80 s with no quick path.
5. v1 is the same screen forever. v2 changes every few minutes: two-ball tables (L2), side pockets (L3), first duel with a face and name (L4), a golden-cue chest popping at L5 clear (it rewarded "+2 hints" the second time: variable), posts with "POSTS BOUNCE BALLS" (L7), Mia (L8), ordered pot with 1-2-3 chips (L9), Slalom with two posts (L10), boss crown (L12). Good cadence; the visual set (same teal felt, same bar) does not change in 12 levels.
6. v1 shows nothing. v2 shows stars per level, "par" vs shots, a streak flame banner on the card (STREAK 3), cue-unlock progress bar, 14/108 stars on the map. Missing: no per-shot grade (perfect/bank), no best shot, no sense a shot was skilled.
7. v1: nothing pending. v2: "3 more stars -> CHERRY cue" bar on every card, "chest in N clears", daily table with streak, rival faces greyed on the map, the pulsing next node. Strong Zeigarnik; the cue and chest rewards are tiny (cosmetic or 2 hints), so wanting them is soft.

## v2, first 2 minutes beat by beat (bot timeline)

- 0:00 Table with ONE yellow ball and one cue ball, gold pocket rings; a big grey 8-ball emoji sits oddly under the table; tip "Touch to aim - pull the cue to shoot". No logo over the table any more. Top bar: trophy, menu, level name, retry, hint (3).
- 0:01 Cue sweeps by itself as a demo; I tap the table: guide line + ghost ring appear and aim snaps onto a clean line.
- 0:04 Drag the bar, release: cue strikes, ball runs to the corner, a burst of particles at the pocket. Pot (par 1).
- 0:06 Card: PERFECT! three stars fly in, "1 shot par 1", "chest in 4 clears", cue bar "3 more stars -> CHERRY cue". NEXT button is big and gold.
- 0:12-0:27 L2 two balls (3 shots, 3 stars), L3 side pockets: "NEW CUE: CHERRY!" lands at the end of L3. Streak banner starts.
- 0:30 L4: the table fills with a rack, VS header with faces (YOU vs REX), "YOUR TURN". First duel surprise. Rex shoots within seconds, much faster than before.
- 0:47 "MATCH WON!  Rex potted 1 or none", "chest in 1 clears".
- 1:17 L5 clear: CHEST card with a random reward (golden cue, or +2 hints on another run).
- 1:30-2:20 L6 (a 4-ball table, first fail: "OUT OF SHOTS 2 balls left", retry in one tap, clear second go), then L7 The Post with the yellow tip "POSTS BOUNCE BALLS".

## What the best app-store cue game still does better in its first 2 minutes

(8 Ball Pool / Pool Billiards Pro style)
1. Spin and a power meter you can read: a cue-ball spin dot, a coloured line that shows exactly where the ball goes after contact. Ours has pull length only, no skill read, so there is no "I nailed that" beyond stars.
2. A punchier first pot: a loud thunk, coin shower, a "NICE!" voice, camera pull-in. Ours is a quiet puff and a card.
3. A thicker reward cadence: coins fly to a counter on every pot, a spin wheel or box within 90 s, a visible next-cue preview. Ours pays only on card screens.
4. Opponent that reacts: emote bubbles, a timer ring around the avatar, taunts. Ours has faces and a name but they never speak.
5. A changing world: new felt, cue, table frame and sound at each tier, visible by minute 2. Ours keeps one felt and one room.

## The 5 biggest remaining fixes

1. Per-shot grade and callouts on every pot, escalating by streak (NICE / GREAT / PERFECT, +stars-fly-to-HUD, banks and kisses named), with a ball-in-pocket thunk; make the first pot of a session noticeably big (tests 1, 2, 6).
2. Add one skill read before and after the shot: show the cue-ball path after contact (as a longer second guide line) and a power "sweet spot" mark on the bar; add a tiny spin dot for banks (tests 2, 3, 6).
3. Loss cards that explain themselves: on "N balls left", replay or ghost the last shot, say what failed (hit wrong ball first / scratch / out of order), and offer a free hint on the 3rd retry. Slalom (L10) and Ladder (L9) took my player 14 tries with no help (tests 3, 4).
4. Make rewards matter: chests should give visible stuff (felt colours, table themes, ball sets, new sounds) with a "next reward" preview on the card and map; add a second felt/room by L6 and a third by L9 so the 12th level does not look like the 1st (tests 5, 7).
5. Make rivals alive: per-rival emote bubbles during a duel (taunt on a miss, cheer on a run), shot clock ring, and a small rival-specific trick (Mia banks, Duke breaks hard) shown in a pre-match card (tests 5, 7).

Verdict: TEST
(Round 2 avg 7.7, no test under 7, beats v1 on every test: meets the real-player-test bar; keep improving toward PASS 8+ while live. Open items: sweet-spot mark on the pull bar, rival emotes/shot clock ring, visible chest themes, thunk.)
