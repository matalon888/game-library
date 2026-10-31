# SPLITSTREAM fun review (cold play, critic run 59)

Method: Playwright Chrome, 390x844 touch, SwiftShader. v1 about 10.5 min (90 s of manual drags, then `__game.bot()`
runs). v2 about 10.5 min plus two extra diagnostic runs, driven by a follower that drags toward the yellow/green target
marker on the span meter. No outside requests.

**FPS:** v1 37-44 fps (idle 37, play 39-44). v2 47-58 fps (title 47, play 52-58). v2 is above 30 fps, so the run is valid.
Re-measured 3 times each, with another browser possibly running.

## Scores (0-10)

| # | Test | v1 | v2 |
|---|------|----|----|
| 1 | 10-second | 5 | 8 |
| 2 | Toy | 6 | 7 |
| 3 | Almost | 3 | 6 |
| 4 | One-more | 6 | 8 |
| 5 | Surprise | 3 | 7 |
| 6 | Mastery | 3 | 7 |
| 7 | Tomorrow | 2 | 8 |
| | **Average** | **4.0** | **7.3** |

## First 2 minutes, v1
- 0 s: pretty sunset city, a skater on a rail, "SPLIT STREAM", a pointing hand. Clear what to do (drag).
- 2-5 s: first drag, legs spread, gems pop. Pleasant, but only a few gems and little else for the first 5 s.
- 5-10 s: first block deck. Died at about z-74 on my first manual tries ("WIPEOUT!", "3 gems this run").
- 10 s-2 min: tap to retry restarts instantly (good). My idle or random drags died at the first block (z-22) every time.
  The bot (the skilled-player stand-in) reached 83% of level 1 (z-151 of -181) and wiped out at the same spot every time
  (about 12 attempts, "SLIPPED!"). I never saw a v1 level-1 clear in 10 minutes. At the death moment the skater is not
  even on screen (camera is low behind the deck), so I could not tell what I did wrong.
- Nothing new appears in 10 minutes: same level, same gems, same death. Header shows "1 -> 2" and a trophy; nothing to
  chase.

## First 2 minutes, v2
- 0-5 s: same title card, a "tap sides to stretch" hand, a span meter at the bottom with a green marker.
- 5-10 s: a dense line of gems straight away, "GEM RUSH x5" popping, pink shards spraying off the skates. This is the
  10-second hit v1 lacks.
- 10-40 s: gem streak banner climbs ("GEM RUSH x5", "x10", "UNSTOPPABLE x60"), the marker slides left and right and I
  chase it. Reads like a rhythm game. At 42 s: arch, confetti, "PERFECT!" with 3 stars. Next level starts by itself (no
  tap).
- 45-105 s: L2 (30 s) and L3 clear with 3 stars. L3 gives a "LEVEL 3 CLEARED! 3 stars, 🎁 New skate style: Mint! Tomorrow:
  Daily Run, streak 0" card. A real reward beat.
- 105-140 s: L4 introduces "single beam". Died at z-90 three times in a row (10 s per try), then cleared at 2:40.
- 140 s onward: L5 became a wall for my follower. 25+ identical deaths at z-50/-98/-154 over 8 minutes, zero clears. The
  loss card says "SO CLOSE! 67% of the way, 76/93 gems, one more!" and "Tap to retry". Nice, but I never got the win.
- Map button: 30 levels, 3 named worlds (Sunset Strip, Neon Pier, Glass Sky), star counts per world, "8 stars to a new
  skate style (1/8)", Daily Run button, boss-looking red-ringed levels (10, 20, 28, 30).

## Notes behind the scores
- Almost (v2 = 6): the SO CLOSE % card is the right idea. But in the L5 diagnostic the pinch target jumped from ~46% to
  ~1% within about 0.2 s while the knob needs ~0.4 s to travel, so a player who only watches the marker arrives still
  wide. A human reading the track ahead may pre-squeeze, which I could not verify; there is no telegraph (arrows, a
  coloured ghost of the next gap) that teaches it. Caveat: my follower is not a human. L4 and L5 felt like a wall.
- Mastery (v2 = 7): 3-star "PERFECT" plus streak numbers show skill, but L1-3 are 30-40 s of nearly identical following of
  a cursor, and I could not see "better than 5 minutes ago".
- Surprise (v2 = 7): golden gem +5, gem rush, single beam, a reward card on L3. Nothing between 0:45 and 1:45 except
  "the same, longer".
- v1 Almost (3): deaths are consistent and a "skilled" bot still cannot finish, so the game looks unfair or unreadable.
  Camera hides the skater at the moment of failure.

## What the best app-store game in this genre (endless runner / hyper-casual runner) does in the first 2 minutes that this one still doesn't
Top runners of this kind make every level a different shape of the same verb. Within 2 minutes you meet 2-3 distinct
gates, a crowd or multiplier gate, a mini boss or a finish ramp with a visible multiplier, and a chest or skin. Failures
are always visible and legible: the camera shows the exact obstacle that took you and rewinds a second. The control
needs no follow-the-marker coaching: the player decides when to squeeze by reading the track. Here the marker does the
thinking, so the "game" reduces to tracking a cursor. The best ones also give a lot of reward every 20 s: a multiplier
that visibly multiplies at the finish, a rainbow trail, a ramp finale you bank the gems on. Splitstream's finish is a
static arch plus confetti.

## 5 biggest fixes, in order
1. Fix the L4/L5 pinch fairness: telegraph the pinch 1.5 s early (ghosted narrow beam on the rail, an arrow on the
   meter, marker pre-slides), and speed up the knob/spring so a fast follower can make it. Then confirm with a bot that
   L5 clears within 5 attempts.
2. Make the loss legible: camera stays on the skater, freeze-frame the exact obstacle and flash "too wide" or "too
   narrow", and rewind 1 s to a checkpoint on long levels (L1 is 60 s; a late death costs the whole run).
3. Kill the L1-3 sameness: give each of the first 5 levels one new thing (gem arcs that need a wide stance, a narrow
   bonus lane, a ramp jump, a moving block) so the 1-2 minute mark has a new element every 20-30 s.
4. Add a finish payoff that scales with play: a bank-your-gems finish ramp with a multiplier from the streak, bigger
   confetti and a "PERFECT x3" reveal, and stars that say what you missed ("gems 98/102").
5. v1: either retire it or fix it. A skilled bot never beats level 1, and it has no meta. If v1 stays as the A/B
   baseline, only fix the retry-at-checkpoint and the camera.

Verdict: TEST
