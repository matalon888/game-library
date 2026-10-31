# Horde Blast: cold critic review #4 (v1 vs v2)

Played as a new player on a 390x844 touch viewport (Chrome, CDP touch events: press, drag with a wobbling thumb, lift, tap cards; no bot, no `fast`). Both versions ran 11 min of wall clock, in parallel, with non-127.0.0.1 requests blocked (the only console error is that blocked load). Video and screenshots were kept in /tmp/critic12 and deleted afterwards.

- v1 (default): levels 1-7, 5 wins, 3 losses (L3, L6, L7), L6 won on the second try.
- v2 (`?deep=1`): sieges 1-3, wins on 1 and 2, siege 3 lost twice (fort 66% down and 55% down).

**Rig note, fps.** Measured fps was far under 30 in both: v1 median 6 (p10 3, min 2, peak 14), v2 median 7 (p10 2, min 2, peak 15). The machine load average was 54-69 on 48 cores, two software-GL Chromes were running side by side, and the sim is clamped, so play ran at about 0.2-0.5x speed. That is the rig, not proof the phone build is slow, and I cannot confirm 30 fps on a real phone. Stars and the map glyph render properly now (CSS/SVG), no empty boxes. Because the clock was slow, v2 got through only 3 sieges, so surprise and mastery lean on what I saw plus the earlier reviewer notes in this file's history (map, bomb, crusher, boss, squad chest); those I did not re-see this run.

## Scores (0-10, honest)

| Test | v1 | v2 | Why |
|---|---|---|---|
| 10-second | 5 | 6 | Both: swarm through x2/x3 gates is the first hit, but there is no hit sound or fort impact I could feel on screen. v2 adds a big fort number (427), golden troops that stand out, and a 3-star bar from the first frame. v1 is a 71 fort that falls fast and flat. |
| Toy | 6 | 7 | Holding a thumb and watching a stream multiply is pleasant in both. v2 adds the recharging bomb button, golden units and the "x3" floaters; still no recoil or per-shot weight, so tap 20 times and it is the same 20 taps. |
| Almost | 5 | 7 | v1 "OVERRUN: the red mob reached your cannon" (L6 with a 418 fort, I had 17 troops left) feels random. v2 shows "Fort 66% down" with a bar, and my second siege-3 loss was "55% down", so I could see I was close. v2's "OUT OF TROOPS" card also shows "NO TROOPS" under the cannon, a bit contradictory, and v1's "CLEARED" card shows "NO TROOPS" over 319 troops. |
| One-more | 7 | 8 | v1: "Tap to retry", anywhere. v2: big green RETRY, instant, and the near-miss bar next to it. The RETRY button crowds the MAP button. |
| Surprise | 5 | 7 | v1: red gates at L3, crusher and a boss at L4, then more of the same (L5-L7 is red mob plus gates). v2 gets a new element every 1-2 sieges (red gates and bomb at 3, plus the other items listed above), plus the squad colour change: my troops went green after siege 2. It fades without a big spike like a golden jackpot. |
| Mastery | 4 | 6 | v1 has no skill read-out. v2 gives stars by troops used ("needs 120, you used 151") which is a real target, but holding the thumb down all the time is the default and gives 2 stars at best, and nothing teaches that letting go earns the third. Siege 3 loses did not tell me what to change beyond "aim through the biggest blue gates". |
| Tomorrow | 3 | 6 | v1 has nothing. v2 has the map, a "2/5 squad chest" bar (a good unfinished thing at the end of siege 1), and the next siege name on the card. The chest only gives a colour, and the daily goals are shallow. |
| **Average** | **5.0** | **6.7** | |

## The first 2 minutes of v2, beat by beat (play ran slow; I judge it at normal speed)

1. 0:00 Title over a red fort with a number (427), a hand hint, and the blue road with 3 gates. Clear, readable.
2. 0:02 I touch and drag. Cannon follows the thumb, blue troops stream out. Fort number is the goal.
3. 0:10 The stream passes x2/x3 gates and turns into a swarm of about 180; a gold soldier runs in the middle. This is the first hit and a good one.
4. 0:20 Swarm reaches the fort, the number drains, "FORT DOWN!" with a 3-star bar. No loud sound or shake I could see.
5. 0:25 Card: "SIEGE 1 First Blood", 2 stars, "needs 120 troops, you used 151", "2/5 squad chest", "Next: Pick the Bigger", big green NEXT. Fast, nothing to read twice.
6. 0:30 Siege 2: wider gates, a gold x4 gate, fort 1694. The swarm of 500 hits it; this is "more of the same, bigger".
7. 0:50 Squad chest: troops turn green. Small, pleasant, not a surprise worth talking about.
8. 1:10 Siege 3: red divide gates and the bomb button appear, with a hint. Reds run at the cannon. I ran out of troops at 66% fort down. First real stakes of the session.
9. 1:40 Retry, with the bar showing 66%. Close again (55%). The thumb wants a third try. That is the hook, and it works.

## What the best app-store game of this genre does in its first 2 minutes that this one still doesn't

(Mob Control / Count Masters / Archero-style crowd games.)

- **Every touch feels heavy.** Each shot or gate pass has sound, a number that pops and a camera nudge; the fort takes a hit that shakes the screen. Here the swarm is nice to look at but silent on screen: no hit-stop, no number counting up, no fort wobble.
- **A real choice at every gate.** In the best games a risk/reward pair sits at every gate (x2 safe vs. +50 behind a hazard), so two thumbs on the same road play differently. Here one lane is nearly always the best, so a wobbling thumb wins sieges 1 and 2 with troops to spare.
- **An enemy that fights back with a face.** A boss with a health bar you have to beat, not scenery.
- **A loud finish.** The crowd count adds up on screen, a chest opens in front of you with a random pick, confetti. Here it is a card and a colour.
- **A first goal you cannot finish in one session.** Here siege 1 hands out a 2/5 bar after 25 s, which is good, but the daily goals are cheap.

## The 5 biggest fixes, in order

1. **Mastery: make the star goal teachable.** Show a live "troops used / needed" meter during the siege and tell the player to lift the thumb (a banner on siege 1-2), so holding down is no longer the only way to play, and the third star is visible and earned.
2. **Weight on every action.** Hit sound plus damage number plus fort shake on each volley, a gate pop that counts up the swarm number, and a hit-stop on big hits. This is the biggest gap in the 10-second and toy tests.
3. **Make gate choice matter.** From siege 2 on, add risk/reward pairs at the last gate (a safe x2 vs. a x4 behind a crusher or a red lane) so the best lane changes and the thumb has to decide.
4. **Make the boss a fight and the finish loud.** Bosses must be killed to win; the end card counts troops up, and the chest opens with a tap and a random pick (a rare golden skin on 1 in 20).
5. **Tomorrow hook and card polish.** Daily goals that take more than one session, a chest at 4/5 on close, a next-world preview on the map. Fix card text ("NO TROOPS" under a won card), and keep RETRY and MAP apart.

Verdict: FAIL
