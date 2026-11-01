# Bellhop Boss FUN_REVIEW (cold critic pass, 2026-11-01)

Method: Chrome (channel chrome), 390x844 touch viewport, real touch input (taps and floating-joystick drags through CDP), a screenshot
after most moves, every non-127.0.0.1 host aborted. v1 = plain URL (game.js has READY=false, so the ab switch never fires), v2 = `?deep=1`.
Play time: roughly 7 min v1 (lost 2 runs, cleared hotel 1, lost hotel 2) and roughly 8 min v2 (cleared hotel 1 with 3 stars in 20 s,
played hotel 2 to 3/4 upgrades, opened the map). Honest note: a bit under 10 min each in wall-clock play; the rest was waiting on screenshots.
I read code only for layout and the version switch.

**FPS (requestAnimationFrame counter, software GL/SwiftShader, DPR 1; a pessimistic stand-in, not a phone):**
- v1: title ~28, play 30.5 fps.
- v2: title 30.3, play 22.5 fps (heavier as rooms, staff, guests and confetti fill the lobby).
- v2 is about 8 fps slower than v1 in play. Needs a real-device check before wide rollout.

## Scores (0-10)

| # | Test | v1 | v2 |
|---|------|----|----|
| 1 | 10-second | 5 | 8 |
| 2 | Toy | 3 | 6 |
| 3 | Almost | 3 | 6 |
| 4 | One-more | 6 | 8 |
| 5 | Surprise | 2 | 7 |
| 6 | Mastery | 2 | 7 |
| 7 | Tomorrow | 2 | 7 |
| | **Average** | **3.3** | **7.0** |

Why, short:
1. 10-second. v1: cash and a guest queue appear at once, but no cue; the first payout is just a number going up. v2: an arrow points at the next pad, room bought at 8 s ("NEW ROOM!" burst), a GOLDEN GUEST with confetti and +$ at 15 s, cash 100 at 18 s.
2. Toy. Both: walking and scooping cash is mildly pleasant (stacked bills above the head, bills flying), but there is no sound/weight that makes walking itself fun, and tap-to-walk fights a camera that keeps scrolling, so taps land off target. v2 adds the streak flame and confetti; still a 6.
3. Almost. v1: three walkouts end the run with "BAD REVIEWS" and I could not tell which choice cost me; the angry bubbles come with no warning. v2: hearts, a par timer and stars make a loss readable, but I still lost track of why guests waited (all rooms dirty, nothing flagged).
4. One-more. v1: "Tap to retry" is instant (6). v2: one big "next hotel" button, "Replay for star" and Map on the win card, 20 s hotel 1, nothing between tries (8).
5. Surprise. v1: the 10th minute is the 1st (2). v2: golden guests, mechanic toasts per hotel, new pads (housekeeper, reception), a plan of rushers, coaches, VIPs, critics. I only saw the early ones; 7.
6. Mastery. v1: nothing shows improvement. v2: streak x2..x4 climbs as I serve in a row, a par timer, 3-star scoring, best-by-hotel; 7.
7. Tomorrow. v1: a level number. v2: map of 3 worlds x 10, "3/90 stars", gift chest 4/7, 12 uniforms with 11 locked silhouettes, red "hard" hotels; 7.

## First 2 minutes, beat by beat

v1:
- 0:00 Title over a lobby: a bellhop, a desk, pink checker floor, "Tap where to walk". Tap to start.
- 0:03 A guest is checked in automatically (the bellhop stands at the desk); cash 30 appears. Nice, then nothing else tells me what to do.
- 0:15 Queue of 3-4 guests with bed bubbles; the only room is asleep. I wander, bubbles turn angry.
- 0:35 First star lost. No room is free because nobody told me to clean the room (broom bubble is small, off to the side).
- 0:60 "BAD REVIEWS! Three guests walked out." Tap to retry. My first death was my confusion, not skill.
- 1:20 Second run: pick up cash, walk onto the "Reception $25" pad, a receptionist appears (the one good moment). Clean room, buy Room 2, "LEVEL 1 CLEARED" at about 2:30. Hotel 2 is the same game in mint.

v2:
- 0:00 Title with hearts, a 1:20 par clock, a pink bellhop, "Tap where to walk". Tap.
- 0:02 Banner "1-1 Sunny Inn"; cash 30 at 0:04 from the first guest.
- 0:06 A yellow arrow bounces over the Room 2 pad. I walk in: ring fills, "NEW ROOM!" text, confetti, camera punch. Room bought at 0:08.
- 0:12 A golden guest with a star bubble walks in; "GOLDEN GUEST +$.." floats across the screen with confetti, streak flame x2 appears. Cash jumps to 100.
- 0:18 Arrow points to the Reception pad. Bought; hotel complete at 0:20.
- 0:20 "HOTEL 1 CLEARED" with three stars popping, uniform chest bar 3/7, big "SUNNY INN II" button.
- 0:25 Hotel 2: toast "Stand in a messy room to clean it", 4 pads, a 1:50 par. Two rooms, guests pile up faster. By 1:20 I am juggling dirty rooms, desk, cash and pads, streak x3.

## What the best app-store game of this genre does in its first 2 minutes that this one still doesn't

The best idle-tycoon hotel games make every second of walking itself the reward, and they never let you be confused:
- A guided, camera-locked first minute: the camera follows the player tightly and the next target always sits in view, so one tap lands where I pointed. Here the camera drifts, the tap-to-walk lands off target, and I often walked past the pad.
- A satisfying money loop with sound: coins that arc into a visible counter with rising pitch, a "cha-ching" on every pickup, haptic taps, numbers that pop at the guest. Here the bills fly but I could not rely on any audio feedback or hear escalation.
- A new thing every 20-30 seconds in minute one: the first upgrade, the first helper, the first VIP, the first unlock reveal, a map jump. v2 does the first three well and then goes quiet for the lobby juggling.
- Staff that visibly make me stronger: workers appear and I watch them take over a job (here the receptionist appears but doesn't change my job much).
- A clear "why" on every failure: a guest shows exactly which resource they lacked ("no clean room") and the screen flags the blocker. Here "all rooms dirty" is easy to miss.

## 5 biggest fixes, in order

1. Camera and input: lock the camera to the bellhop on a fixed offset (no drift) and make tap-to-walk path to the exact tapped world point; show a footprint marker. Taps landing off target is the main toy-test killer.
2. Blocker flags: when a guest cannot be served, put a big icon above the DESK ("no clean room", broom) and pulse the dirty room, plus a one-line toast the first two times.
3. Audio and haptic weight: pitch-rising coin pickup, a heavier "buy" thud and cha-ching on each pad, guest-leave sound, per-streak notes. The juice on win is great; the second-to-second walking has none.
4. Fix v2 frame rate: 22.5 fps vs 30.5 fps in v1 on the same box. Cap confetti particles, cap devicePixelRatio at 1.5, merge static meshes, and reduce shadow map. Verify on a real phone.
5. Surprise cadence in hotels 2-3: add a mini event every 30-45 s (a coach, a rusher, a tip drop) with a slow-mo or banner, so minute 3 is not minute 1. Also show the "next unlock" (new mechanic icon) on the win card so Tomorrow pulls harder.

Verdict: TEST
