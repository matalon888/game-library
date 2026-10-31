# Sticky Nook - FUN REVIEW (cold critic run #6, 2026-10-31)

Method: Playwright + Chrome (headless), 390x844 @2x, touch (CDP touchStart/Move/End drags, sprite dropped 70 px above the finger like the game expects), video + screenshots (every 5 s for 2 min, then every 30 s, plus every card). All non-127.0.0.1 hosts aborted, `lbapi=http://127.0.0.1:1`. 10.5 min each for v1 (default) and v2 (`?deep=1`), run in parallel, with human-like "thinking" pauses (0.7-1.5 s early, 0.25-0.6 s later) and 3 deliberate wrong drops each.
Honest limits: drag targets came from a spot() lookup (v2 `__game.spot()`; for v1 a hook injected into a *served copy* of v1.js via Playwright route, no game file edited), so I never missed a spot by eye. Headless Chrome has no audio: I read sound/feel from the code and screenshots, not by ear, so "toy" scores are the least certain. My bot also retried 3-star rooms at random and never lost a real round except in a separate 3-wrong-drops test, so "almost" is judged from the cards, not from many real losses. Not seen in 10 min: locked/taped stickers, dust sheets, rush rooms (I only reached room ~12).

## Measured fps
| | avg fps | min 10 s sample |
|---|---|---|
| v1 | 59.9 | 59.3 |
| v2 | 59.2 | 58.2 |
Both are a steady ~60 fps (headless, no GPU throttling; not under 30). No console errors in either run.

## The 10 minutes, in numbers
- v1: 24 rooms cleared in 10.5 min (~26 s each). Rooms cycle 4 themes (bedroom/kitchen/bath/lounge): room 15 is room 3 with 11 stickers instead of 5. Never a hint of failure; my 3 deliberate wrong drops cost one heart each time and nothing else.
- v2: ~35 plays (20 clears + retries) in 10.5 min across rooms 1-10 (boss reached at ~9 min). Chain grew x3 (room 1) -> x5 (room 3, first fever) -> x12 (boss). Best times crept down ~11 s -> 9 s on repeated rooms. One real loss test (3 wrong spots): OOPS card in 1.5 s, Again -> playing again in 0.43 s.

## First 2 minutes, beat by beat
### v1
1. 0 s: cute isometric room, paw wallpaper, big STICKY NOOK title, a bobbing hand + "Tap a sticker, then tap its spot - or drag". 3 stickers in a tray, 3 dim silhouettes in the room. Nothing to press: you just start.
2. 3-4 s: first drag, sticker follows finger, snaps on the silhouette with a pop and sparkle, room gets more colour. Pleasant, small.
3. 5-20 s: 6 stickers, one drag each. No decisions (spots are shown, all stickers go anywhere in any order). Praise word every 2nd placement.
4. 20 s: "LEVEL 1 CLEARED, tap to continue". 
5. 20-120 s: rooms 2-5 are the same act with 7-9 stickers and a new wallpaper tint. By 100 s I had seen all four themes; by 2 min I know everything the game will ever do.

### v2
1. 0 s: same room with the cat sitting in it, a big green PLAY button, a wand counter "2". One extra tap before play (v1 has none).
2. 1-4 s: first drag, "x1", the sticker lands, "PERFECT" + sparkles + a chain bar appears at the top ("chain x2" with a draining orange bar). The first reward arrives in about 4 s and it is bigger than v1's.
3. 5-12 s: three stickers, chain x2, x3, result card: PERFECT HOME, 3 stars popping in one by one, time vs par, teddy GOLD sticker for the album, "3 stars to the next chest", "Tomorrow: Daily Room #2 - day 2". Lots of hooks in the first 12 s.
4. 12-45 s: rooms 2-3 with 4-5 stickers (a "Quick fingers" par timer), stars 2 vs 3 now depend on time: "So close! 2s over for 3 stars". First chest (+1 wand) at ~25 s. In room 3, chain x5 triggers a FEVER burst.
5. 45-120 s: rooms 3-6; I retried room 3 four times for the 3rd star (each retry 0.4 s away), then new album stickers/new room themes kept arriving. At 2 min the game still had something to chase.

## The seven fun tests (0-10)
| # | Test | v1 | v2 | Why |
|---|---|---|---|---|
| 1 | 10-second | 6 | 8 | v1: a pop and sparkle at ~4 s, calm. v2: PERFECT + x2 chain popup + progress bar within ~4 s, a result card with stars inside 12 s. Extra PLAY tap costs a little. |
| 2 | Toy | 6 | 7 | The same sticker snap/pop in both (nice, small, no weight). v2 adds PERFECT/chain text and rising feedback so repeated drags feel like a rhythm; but PERFECT is nearly automatic because the spot is drawn, so it is not a skill toy yet. (Sound not audible in this run.) |
| 3 | Almost | 3 | 7 | v1: practically unlosable, hearts never mattered; a loss feels random-free but there is no almost. v2: "So close! 2s over for 3 stars" is an honest, fixable, close near-miss, wrong spots are my fault. Dings: OOPS card says "SO CLOSE: 3 left!" when 0 of 3 are placed (a lie), and boss/slow-heart drain is unforgiving when I pause to look. |
| 4 | One-more | 5 | 8 | v1: tap card, next room, no reason to repeat anything. v2: retry button on every card under 3 stars, restart 0.43 s, a visible gap ("2s over") to close. I retried one room 4 times without deciding to. |
| 5 | Surprise | 2 | 7 | v1: room 15 = room 3. v2: PERFECT at start, fever burst at chain 5, chest at ~25 s, new album stickers, boss at room 10 with 12 stickers, new sticker types (tinted twins) arrive; clear escalation by minute 9. Nothing "rare golden" yet, the fever is not loud enough to count as a spectacle. |
| 6 | Mastery | 1 | 7 | v1 has no score at all. v2 shows time vs par, best chain x3 -> x12, stars; I was visibly faster on repeated rooms (11 s -> 9 s). Weak spot: the skill is "drag faster", not trick shots. |
| 7 | Tomorrow | 2 | 7 | v1: only the level number. v2: "3 stars to the next chest", album with `?` slots, daily room #2, streak flame, wand count. All real hooks, but it never made me panic about losing the streak. |
| | **Average** | **3.6** | **7.3** | v2 beats v1 on every test; lowest v2 score 7. |

## What the best app-store game of this genre does that this one still doesn't
(Closest benchmarks: Triple Match 3D / Goods Sort / Tidy Master / Match Factory style "put it where it goes" games, and decorate-a-room games like Love & Pies / Design Home.)
- A **real decision and a real clock inside every round**: Goods Sort / Triple Match give you 6 slots and a timer where picking the wrong item costs you; here the spots are painted on the room, the answer is always visible, so there is no thinking, only dragging.
- **Loud, layered juice**: those games punch the screen, vibrate, shower coins and make a rising chime at every combo step with a screen shake, a freeze frame and a giant "AMAZING"; here PERFECT and chain are small text and the fever text overlaps (see fixes).
- **A reveal at the end of the round**: the decorating games finish with a camera sweep, the cat reacting and a "before/after" of the room. Here the finish is a menu card.
- **Currency you can feel moving**: coins/hearts/boosters fly across the screen into a counter. Here wands/stars just change a number.
- **A daily/limited reason to open it** with a visible countdown or friend leaderboard; here the daily room is only a text line.

## 5 biggest fixes, in order
1. **Add skill/risk to the core drag** (the main reason tests 2 and 6 stay at 7): hide the target outline until you hold a sticker, or let two stickers fit the same spot with different bonuses, or drop some spots so you must read the room. Right now PERFECT x12 is a free gift.
2. **Make FEVER and combo milestones huge** (screen flash, 0.3 s slow-mo, bigger particles, rising notes, "UNSTOPPABLE" at chain 8, 12). In room 10 the "COMBO x5 FEVER!" and "PERFECT" popups overlap into unreadable "COX5 FEVER!" at the same spot.
3. **Add a rare golden item / mystery sticker** (1 in ~15 stickers: tap it for a jackpot, golden sparkle + bonus chest) for variable reward; a boss that is not just "12 stickers" (e.g. the cat knocks stickers off; a moving spot).
4. **Fix the card copy and clutter**: the OOPS card says "SO CLOSE: 3 left!" when 0 are placed; the boss card shows two identical gift icons (new sticker vs chest); level-1 card dumps 7 items. Make the loss card show what you did and the best retry hint, make wrong spots read as "close" (e.g. bounce back + 1 heart) for rooms 1-3.
5. **Give the end-of-room and tomorrow a payoff**: show the finished room with the cat reacting for 1.5 s before the card; put a real countdown "Daily room in 7h 12m" plus a streak-at-risk line, and a chest progress bar on the map that is almost full, not a text line. Also ensure the 3-star time is reachable on the first retry (rooms 5-9 asked me for 2-3 s I had to find by luck: Sofa time took 12 retries at human pace), or show a ghost target time.

Verdict: TEST
