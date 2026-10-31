# Bumperlark FUN_REVIEW (critic gate, round 2, 2026-10-31)

Verdict: TEST

Played cold as a new player: v1 (`index.html`) 10.5 min and v2 (`?deep=1`) 10.5 min, phone viewport 390x780, hasTouch, real touch events (left/right halves for flippers, hold-and-release on the lane). Analytics/API hosts blocked. `__game.start(n)` was used only to jump to missions 7, 12, 20 and 30 for a look at the later tables, plus `openMap()` for one map screenshot. I read `qa/FUN_REVIEW_r1.md` only after playing.

Limits: no audio heard, so "sound" is not scored on evidence. My input was rhythmic flipper mashing with random launch holds, not aimed shots, and the 10-minute runs were unattended loops that tapped NEXT/TRY AGAIN. That is a weak player. A good player will do better on stars and worse on "is it hard enough". In 10 minutes the mash-player never got past about mission 3-4 in v2, so the mid-game tables were only seen via the jumps. Another critic's headless Chrome was running on the same box, which did not visibly affect frame rate.

## Frame rate
- v1: 60 fps (60.5 at start and end). Not under 30.
- v2: 60 fps (60.5 start and end; 60.7 on missions 7, 12, 20, 30 including the busy combo table). Not under 30.
- Headless desktop Chrome on a server. A low-end phone was not measured.

## Seven fun tests (0-10)

| # | Test | v1 | v2 | Why |
|---|------|----|----|-----|
| 1 | 10-second | 6 | 8 | v1: ball waits in the lane until you hold and release; first pop only after about 3-4 s of nothing. v2: tap the title and the ball is already flying up the arc into bumpers with a goal pill showing; pops, +100s and lane lights inside 3 s. |
| 2 | Toy | 6 | 7 | Same physics. v2 adds bumper ring pulses, glow, a combo popup ("COMBO x4 +200"), a combo meter bar and brighter hits on the late tables. Ball still looks a bit light and I cannot judge hit-stop or sound from screenshots. Pleasant, not bubble wrap. |
| 3 | Almost | 5 | 7 | v1: balls drain between flippers, no "why"; ball save hides losses. v2: OUT OF BALLS screen says "SO CLOSE: 1 orbit to go" with a TRY AGAIN button, and the win card says "3rd star: 5,500 pts (you: 1,310)". A loss is readable and fixable. Slight deduction: mission 7 showed "MISSION 7 DONE!" with zero filled stars (6,850 of 11,000), which reads as a bug or a punishment. |
| 4 | One-more | 6 | 7 | v1 returns to ball 1 and plays again with no menu (about 1 s). v2 AGAIN / NEXT / MAP / TRY AGAIN are one tap and the next mission starts at once, and missions 1-3 launch the ball for you, so there is no hold ritual. Later missions still need the hold. |
| 5 | Surprise | 3 | 7 | v1: one table for 10 min, only a "TARGETS +2500" or a multiplier now and then. v2: new goals per mission, a ball skin ("NEW BALL: Rose!") on mission 2, a 500-point golden bumper, then spinner, magnet and diverter walls on mission 7+ (seen on 7, 12, 20), jackpot, "ORBIT 2000" combos. The playfield is still the same outline and the same flippers, so the 10th minute is only partly new. |
| 6 | Mastery | 3 | 6 | v1: a score and nothing else. v2: higher bars worked: the mash-player got 2 stars on mission 1 (1,310 vs 5,500 needed) instead of a free 3, and lost mission 4-ish with a clear reason. But mission 2 still gave 3 "Perfect table!" stars to a masher, and stars/goal pills (several icons, "0/1") do not explain what a better shot is. Progress to "5 stars to a new ball" is shown, which helps. |
| 7 | Tomorrow | 3 | 7 | v1: best score only. v2: map with Lark Lane, 10 tiles, BOSS at 10, two more worlds, "5 stars to a new ball" bar, a BALLS collection. Clearly unfinished when closing. The map opens as a dim modal over the game and the other two worlds are only icons. |
| | **Average** | **4.6** | **7.0** | |

v2 beats v1 on every test, no test is under 6, average 7.0 exactly: TEST, not PASS (needs 8+ and none under 7: Mastery is 6).

## v2, first 2 minutes beat by beat (as I played it)
1. 0:00 Blurred table behind a BUMPERLARK title, pointing hand, "Tap left / right to flip". Nothing to read besides that. Good.
2. 0:02 One tap. The ball launches by itself and arcs over the top toward the lane rollovers; HUD shows 0 points, ball 1, mult 1x, and a "0/6" pill at the top. Much better than a waiting ball.
3. 0:05 Ball falls into the three 100-bumpers: rings, popups, score climbing. I am just mashing both flippers; it still looks lively.
4. 0:20 MISSION 1 DONE, "First flap", 2 stars, "3rd star: 5,500 pts (you: 1,310)", a progress bar, AGAIN / NEXT / MAP. A star missing on the first card is a good hook.
5. 0:25 Mission 2 "Pop it": after about 25 s, "Perfect table!" 3 stars and "NEW BALL: Rose!" with a pink ball preview. Best beat of the session: a prize at 0:50. Slightly too easy for a masher.
6. 1:00 Mission 3: lane multiplier chasing (2x lights, "BALL SAVED!" text, +100 popups), a second goal pill appears (target plus orbit).
7. 1:30 Mission 4 and on: two pills at the top, a combo bar under them, "ORBIT 2000" in the display. I started losing balls: "OUT OF BALLS, SO CLOSE: 1 orbit to go, TRY AGAIN". I knew what I missed.
8. 2:00 Still the same table and two flippers; what changed is the goals, and I now want the orbit shot.

## What the best app-store pinball game does in its first 2 minutes that this still does not
- Every table is a new playfield: ramps, a rolling cage, a mini-table or multiball, within the first 2 min. Ours is one outline with walls added from mission 7, which most players will not reach in 2 min.
- A guaranteed spectacle early (a multiball, a slow-mo jackpot with screen flash) before any skill is asked. Ours has jackpot and combo but the first one I saw was well after minute 5, on a jumped table.
- Skill feedback: lit arrows that tell you the next shot, replays of the best shot, "perfect flip" timing feedback. Our arrows light up but nothing says "shoot here".
- Weighty hit feel: shake on big hits, flipper "thunk", a heavier ball. We have hit-stop on paper; on screen the ball still looks light and drifty.
- Stars are earned, not given: a masher should not get 3 on mission 2.
- Lives and cause: a loss always names its cause. Ours does for goals but a drained ball still just says "BALL 2".

## 5 biggest fixes, in order
1. Raise Mastery above 7: mission 2-6 3-star bars must need a real shot (orbit twice, keep all balls, a named skill star), and mission 7 must not show "DONE" with 0 stars. Tell the player which shot earns the next star.
2. Pull the new table elements forward: put a spinner or magnet on mission 3-4 and a jackpot or multiball before minute 3, so Surprise is not locked behind 6 missions.
3. Add skill cues on the board: light the next goal shot (the orbit arrow or target) and pulse it, and put readable icons and words on the pills ("ORBIT 0/1", not just a swirl icon).
4. Make hits heavier: visible screen shake and a short freeze on bumper, sling and jackpot hits, a heavier ball arc, and tuning so the ball is less floaty. Verify with audio.
5. Hold the player's hands through launch on later missions too (a pulsing hold ring or auto-launch every mission), and make the map a full screen with two more worlds visible and a daily or chest goal so Tomorrow goes from 7 toward 9.

Re-test after fixes, lowest first: Mastery (6), Toy (7), Almost (7).
