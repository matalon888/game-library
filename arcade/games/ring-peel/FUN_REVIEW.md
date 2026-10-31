# Ring Peel FUN_REVIEW (critic run, 2026-10-31)

Reviewer stance: harsh mobile critic, new player, 390x844 touch, Chrome headless, analytics blocked. About 10.5 min of real play per version
(v1 default, v2 = ?deep=1), screenshots and video taken, play logged state by state.

## MACHINE WARNING (read first)
The box was heavily loaded (load average 50-65 on 48 cores, many other headless Chrome GPU processes running software GL).
Measured requestAnimationFrame rate over 3 s: **v1 = 4 to 6 fps (5.3 in the final play run), v2 = 4 to 6 fps (5.0 in the final run). Both are UNDER 30 fps because of the machine, not because of the games.**
The kit clamps dt to 2.5 frames, so the game ran in slow motion (about 1/6 real speed). Consequences:
- I could not judge real-time feel (hit-stop, slow-mo, gap timing, FEVER pacing, sound sync) at true speed; those scores lean on what is visible and on structure.
- My blind hold/release bursts (700-2500 ms wall time, random gaps, no feedback loop) are a careless-player simulation, not a skilled one. I could not read the screen fast enough to time gaps. Crash counts below are therefore pessimistic for both versions, and the slow motion makes timing easier than real, so they are not entirely unfair either.

## What was played
- v1: 77 losses ("OOPS! Rings left: 15..20"), 1 clear (level 1 after about 7.8 min, by luck), then level 2 loss. Every loss sent me back to the full pier start. Zero progress feeling for about 7 minutes.
- v2: pier 1 clear (5 s, flawless, 3 stars), pier 2 clear with 1 crash (candy balls unlocked), pier 3 about 20 losses ("OOPS 7-23 rings left", one "SO CLOSE · 1 left"), 2 daily goals completed (toast "Goal done: Topple 6 towers +1", "Squeeze past walls 8 times +1"). Reached pier 3 (world 1) in 10 min; never reached a world change, armor, shutter or gate in this run.

## First 2 minutes of v2, beat by beat
1. 0 s: Home card over a lovely pastel 3D pier. Striped tower, trophy button, progress pips 1 > 2, "Harbor Pier · pier 1", chip "0 stars · 5 more for Candy balls", big green PLAY, small PIERS. Clear goal, a collectable already dangled.
2. 1-3 s: PLAY. The tower starts peeling by itself (demo play before first touch) with an HOLD hand hint on the cannon. Score ticks 0, 1, 2. No reading needed.
3. 5-10 s: My first hold. Balls pour, rings fly off orange and white, x5, x7 combo text over the tower, gold ring goes off, FEVER bar starts filling pink. Confetti-like debris everywhere. This is the best moment of the game.
4. ~20 s: Tower one topples, the camera moves to tower two with a spinning wall. Star chip (3 stars, 10 s par countdown) shows a clear target.
5. 30-45 s: Tower done, "PIER CLEARED! 5 s · par 10 s · no crash · Flawless! · 2 more stars -> Candy balls · 1 gold ring popped", confetti, three stars, PIERS / NEXT / AGAIN. Strong payoff plus a pull to the next unlock.
6. 45-90 s: Pier 2, first real wall. First crash: "OOPS! 10 rings left, the ball hit a wall", one big red AGAIN. Retry only restarts the tower, not the pier. 
7. ~90-150 s: Second attempt clears with "1 crash · 2 close calls", "New balls unlocked: Candy!". A reward for failing once and trying again, good.
8. 2-3 min: Pier 3, a "SO CLOSE · 1 left, 1 ring to go" loss, then the first daily goal toast (+1 star). Pull to go again is real.

## Seven fun tests (0-10, honest)
| Test | v1 | v2 | Notes |
|---|---|---|---|
| 10-second | 6 | 8 | v1 self-plays a demo and rings peel, but no fanfare. v2 demo plus combo x-numbers, gold, FEVER bar, debris in under 10 s. |
| Toy | 6 | 7 | Hold-to-pour is pleasant in both. v2 adds combo numbers, graze sparks, FEVER and a bit more weight. Still an on/off verb, no 20-taps-of-bubble-wrap feel; sound and hit-stop not judgeable at 5 fps. |
| Almost | 4 | 7 | v1 says only "Rings left: 15" and a loss throws the whole pier away; same place every time felt random with fast walls. v2 names the cause, gives the tip ("let go as the wall comes round"), shows SO CLOSE, restarts just the tower. Still, 20 crashes on pier 3 in a row with no walls getting kinder visibly is harsh (blind play, but still). |
| One-more | 7 | 8 | v1 tap-to-retry about 1 s. v2 AGAIN is one big button, instant, and each attempt is shorter (tower only). |
| Surprise | 3 | 6 | v1: the 10th minute equals the first. v2: gold rings, unlock toast, goal toasts, FEVER, new wall types promised each 5 piers; I only saw pier 1-3 so I can only credit what I saw. |
| Mastery | 3 | 7 | v1: nothing but score. v2: stars, par timer chip, close-call count, flawless label, daily goals, visible "no crash and under par for 3 stars". Could not show true skill growth in blind play. |
| Tomorrow | 2 | 7 | v1: nothing (level number only). v2: "2 more stars -> Candy balls", piers map with stars, 3 daily goals, 30 piers in 3 worlds. A missing "chest/almost done bar" at the exit. |
| **Average** | **4.4** | **7.1** | v2 beats v1 on every test; lowest v2 test = 6 (Surprise). |

## What the best app-store game in this genre does in the first 2 minutes that this one still doesn't
The genre leader (Fire Balls 3D / Stack Ball / Helix Jump class, Voodoo-style) gives, inside 2 minutes:
- A guaranteed first win in under 20 s and then a ramp where the second and third levels are not harder walls but a new toy each time (a new ring type, new gun, a boss tower with a fight bar).
- Escalating, loud spectacle: combo 5 and combo 15 look and sound clearly different (screen shake, pitch rising per hit, slow-mo on the last ring, "PERFECT" splash). Here the numbers grow but the room does not change much.
- Rewarded variability: a chest/gift/skin roulette after a pier, so even a failed run pays something.
- Failure with zero friction AND a visible near-miss (a bar showing 92% of the tower done) on the fail card itself, so the thumb is on retry.
- A mid-session "wow" (boss tower, bonus gold room, huge cascade) within the first 2 minutes. Ring Peel's first 2 minutes are one tower type with one wall type.

## 5 biggest fixes, in order
1. **Surprise (lowest, 6):** put something new in the first 2 minutes: bring the gold-ring bonus, an armored ring or a first bomb chain forward to pier 2 so minute 2 differs from minute 1, and add a per-pier random reward (chest or random skin/gold shower) even on a fail.
2. **Pier 3 wall wall:** about 20 crashes in a row for a casual player. Make the crash-kindness more visible (show "walls 10% slower" on the loss card) and add an assist (slow-mo ghost gap hint) after 3 crashes in a row.
3. **Escalating spectacle:** combo 10, 15, 20 should change the world (slow-mo on the last ring, pitch rising, screen flash, "UNSTOPPABLE"). Make FEVER visible earlier and give it a short sound/rumble on start.
4. **Exit hook:** show a near-full progress bar on the clear and loss cards ("Candy balls 3/5 stars", "chest 9/10") and tomorrow's goal preview; show the next pier's new element on the NEXT button.
5. **Re-judge at real speed:** this review ran at about 5 fps in slow motion. Re-run the critic when the box is idle (under 30 fps cannot show the real toy and almost feel). Also let v1 players who hit one crash keep partial progress, since 77 losses without a clear is a quit.

Verdict: TEST
