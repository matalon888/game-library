# Flip Agent: cold fun review (critic run 4, 2026-10-31)

Played in Chrome (channel chrome, headless, software GL / SwiftShader), phone viewport 390x844 touch, fresh profile, every non-127.0.0.1
host blocked, video + a screenshot every 3 s (about 205 per version, viewed as contact sheets and single frames).
v1 = `index.html`, v2 = `index.html?deep=1`. 10.5 minutes of real time each. PLAYBOOK section 0 read.

How it was played, honestly:
- All screen taps are real touchscreen events (`page.touchscreen.tap`), including START, NEXT, RETRY and mash taps.
- For the first 2.5 minutes I played as a naive human: about 18% of polls tapped at a random spot during a flip (178 to 183 such
  taps per version) and the rest of the flip used the game's own look-ahead helper (`__game.bot()`) so rounds could finish.
  After 2.5 minutes the helper did all the aiming. So these runs show how the game looks, not how a human would score. A human
  would lose more; v2 mission 6 ("Under the Bridge") ate many attempts as soon as my random taps cost bullets.
- No audible audio in headless Chrome: sound was not judged. Toy and surprise scores come from motion and visuals only.
- Star glyphs, the retry arrow and map icons render as empty boxes in this font set. Probably an environment artifact, but it
  makes the win card read worse in these captures.
- The machine was heavily loaded by other jobs (load average 50 to 68, about 100 Chrome processes), so fps is pessimistic.

## FPS (requestAnimationFrame counter, 20 s windows)

| | range | note |
|---|---|---|
| v1 | 17.9 to 21.8 for the first 9 min, then 35.6 to 41 | **UNDER 30 FPS for most of the run** (the jump came when machine load dropped, not from the game) |
| v2 | 16.8 to 23 for the first 5.5 min, 26 to 29.6 for the last 4 min; 45 fps in the very first run, before the load rose | **UNDER 30 FPS for the whole run** |

Both are under 30 fps in my measurement and I say so plainly. Software rendering plus screenshots plus a loaded host explain a lot,
and a real phone GPU is likely better, but I could not confirm it. v2 was never above 30 in the loaded run, and v1 at similar load
was about 20, so I cannot say v2 is slower than v1; treat 30+ fps on a mid phone as unproven for both.

## The seven fun tests

| Test | v1 | v2 | Why |
|---|---|---|---|
| 1. 10-second | 6 | 8 | v1: first kill with confetti and a quiet "ALL CLEAR" at about 5 s, then a plain CLEARED line. v2: same kill, then at once a PERFECT card with chips, DAILY, a sticker pull and a suit unlock. The first reward lands before 10 s. |
| 2. Toy | 5 | 6 | The flip, slow-mo, green laser ring and hit puffs are nice to watch. But the verb is "wait, tap once". A wasted tap does nothing (mission 1-2) or costs a bullet and shows MISS. No bubble-wrap feel in either version. |
| 3. Almost | 4 | 6 | v1 loss: "SPOTTED!" and nothing about why or how close. v2 shows "MISS!", "NO AMMO", ammo pips, chips and the survivor on screen, so a loss is clearer, but I never saw "1 left" or a fixable hint. A new player on mission 6 loses to a tight window and cannot tell which. |
| 4. One-more | 6 | 7 | v1: tap anywhere to continue, a level is 10 to 12 s. v2: big NEXT / RETRY, a mission is 5 to 12 s. But every v2 win is a full card, which is the slow path. |
| 5. Surprise | 4 | 7 | v1 recolours the sky and adds hostages, barrels, swinging platforms, yet level 45 plays like level 5. v2 has named missions (Two Roofs, Light the Fuse, Bounce It, Crate Escort, Hard: The Big Boss, Mr. Big's Penthouse), shields, a ricochet mission and a boss, plus a sticker pull. A rare golden target, fever or bonus room never showed. |
| 6. Mastery | 3 | 7 | v1: score and BEST only. v2: a chip per mission (headshots, goons in one flip, ricochet kills, bullets to spare), 3 stars, a suit bar ("1 star to the Gold suit"). I always knew what better meant. |
| 7. Tomorrow | 2 | 6 | v1: nothing unfinished. v2: DAILY 3/3, stickers 4/12, "12 stars to the Jungle suit", then CONTRACTS after mission 30. Real pulls, but the daily is a counter, not a chest or room. |
| **Average** | **4.3** | **6.7** | |

v2 beats v1 on every test. But the average is 6.7 and Toy, Almost, Tomorrow sit at 6.

Also seen: my driver sat on the mission-30 card for about 2.5 minutes because it did not recognise the "CONTRACTS" button text.
That is my driver, not a game bug, but it shows the end-of-world card has one big button and no other pull.

## v2, the first 2 minutes beat by beat

1. 0 s: sky, agent on a roof with crates, big FLIP AGENT, hand icon and "Tap when the laser turns green", a map button. Calm, readable.
2. 2 s: tap. The agent runs, hops the gap, flips in slow motion; chips "no miss", "3 bullets to spare" sit under the score.
3. 5 s: the laser turns green on the goon, tap, he drops, confetti, "ALL CLEAR". The first satisfying moment.
4. 6 to 9 s: card "MISSION 1 First Flip: PERFECT!", stars, ticked chips, DAILY, NEW STICKER, NEW SUIT, a suit bar and a big NEXT. The best beat in the game, but cluttered: chips overlap the title, the sticker bar covers the agent.
5. 10 to 20 s: mission 2 "Two Roofs", a headshot chip; mission 3 adds a pink hostage who stands next to the goon.
6. 20 to 50 s: mission 4 "Eyes Up" (2 goons in one flip, hanging platform), mission 5 "Light the Fuse" (red barrel), sky colour changes. Each mission is 5 to 10 s and introduces one idea. This is the strongest stretch.
7. 50 to 90 s: mission 6 "Under the Bridge": two headshots and tight ammo; my random taps burn the pips and I fall to NO AMMO and retry a few times. RETRY is quick. "MISS!" is loud, but nothing says how close I was.
8. 90 to 120 s: missions 7 to 9 ("Bounce It", "Crate Escort", the red "HARD: Rooftop Rush" banner). By 2 minutes about 9 missions cleared, 1 suit, a sticker. Steady and varied, but no true peak (no fever, no golden goon, no slow-mo kill-cam) yet.

## v1, the first 2 minutes (short)

Same opening and first kill at 5 s, then "CLEARED! Level 2" and tap to go on. Levels are 10 to 12 s each. By 2 minutes level 11 to 12, sky
colours rotating, a hostage then barrels then hanging platforms. After that the same flip repeats; by level 47 at 10 minutes nothing
new has happened. Nothing to collect, nothing left unfinished.

## What the best app-store game in this genre does that this one still doesn't

The benchmark is a Johnny-Trigger-style one-shot shooter.
- The player makes a choice. They pick the shot, the bank, the order. Here the green ring picks, so the whole skill is one timing window and a helper beats it.
- A kill is an event: hit-stop, kill-cam on the last goon, a combo ladder with a climbing sound and bigger words. Here a clear is confetti plus a word; "GREAT x3" is small and barely escalates.
- A guaranteed spike inside 2 minutes: a boss, a chest or a bonus room. Here the first 2 minutes are a flat ramp; the boss is at mission 20 and the penthouse at 30.
- Instant flow: auto-advance with a one-second strip. Here every win is a full card with a button.
- A loss that teaches in one glance ("1 goon left behind the barrel", the survivor highlighted). Here the loss word is generic.

## 5 biggest fixes, in order

1. Make every tap feel good, even with no target: a pop, ping or prop spark, so mashing is bubble wrap and not a waste (Toy 6; it lifts 10-second too).
2. Add a visible peak inside 2 minutes: a guaranteed golden goon or lucky kill in mission 3 to 4, a combo ladder (x2, x3, UNSTOPPABLE with slow-mo and a flash) and a fever state.
3. Make a loss say how close it was ("ONE GOON LEFT", survivor ring) and give a rescue (extra bullet or longer green window) after 2 losses in a row on one mission (Almost 6; mission 6 is the cliff).
4. Shrink the win card to a strip that auto-advances in about 1 s (tap to skip); fix the overlaps (chips over title, sticker over agent) and replace font glyphs for stars and retry with sprites.
5. Make tomorrow tangible: turn DAILY into a chest or room at 3/3 and show a "come back tomorrow" teaser on the last card. And hold 30+ fps: both versions measured under 30 here, v2 the whole run.

Verdict: TEST
(Studio note 2026-10-31: critic 3 scored v2 7.1 avg, none under 6, beats v1 on every test; critic 4 6.7 was run under 17-30 fps load and is not fair. Many fixes since. Shipped as a real-player test; keep improving toward 8+.)
