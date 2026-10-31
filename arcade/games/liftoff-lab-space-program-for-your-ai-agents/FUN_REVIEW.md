# FUN_REVIEW: agent-rockets (Liftoff Lab) v1 vs v2 (deep=1)

Critic run 2026-10-31. Phone viewport 390x844 (touch, Chrome via Playwright), video + screenshots recorded, all non-127.0.0.1 hosts blocked (nothing posted).
Play length: v1 11.2 min in the demo team (19 launches flown); v2 10.5 min (all 30 missions cleared, 43 mission results incl. replays).

## Measurement caveats (read first)
- **fps.** v2 (2D canvas): 60 fps, measured 4 times mid-flight. **v1 (three.js scene): 9 to 19 fps (measured 11.8, 18.7, 9.7, 9.0) in headless Chrome on a software-GL machine with load average ~76, so the v1 run is INVALID under the 30 fps rule.** I think this is mostly the environment (v1 renders a full 3D pad scene), but it is real data: v1 is heavy, and a mid-range phone without a GPU-friendly path could see the same thing. v1 feel scores below are therefore judged from what the frames showed, not smoothness.
- **My v2 player was a scripted bot with human-like wobble, not a human thumb.** It cleared 30/30 missions in ~10 min and mostly got 3 stars, which a real new player will not. I never saw a real "lose and retry" in v2 (closest: Debris Alley finished with 1 of 3 hull, Cold Snap 1 of 3). The Almost and Mastery scores are capped for that reason. A human run should be done before shipping.
- v1 was played in "Just watch a demo team" mode (no agents linked), the only way a no-agent player can play it.

## Seven fun tests (0-10)

| # | Test | v1 | v2 |
|---|------|----|----|
| 1 | 10-second | 3 | 8 |
| 2 | Toy | 4 | 7 |
| 3 | Almost | 3 | 6 |
| 4 | One-more | 3 | 8 |
| 5 | Surprise | 4 | 7 |
| 6 | Mastery | 3 | 7 |
| 7 | Tomorrow | 4 | 7 |
| **Avg** | | **3.4** | **7.1** |

Why:
1. **10-second.** v1: opens on a full-screen modal of terminal install text ("paste this curl line"). Nothing satisfying happens until you find the small "Just watch a demo team" link, then you watch workers bolt parts on for ~35 s before a launch. v2: you are flying a rocket within 2 s of load, a gate pops with confetti and "PERFECT x1" in the first 5 s.
2. **Toy.** v1: steering is a faint nudge on a pre-flown corridor; 20 taps on the screen do almost nothing, only the stage ring TAP is a verb. The launch smoke is nice. v2: drag to steer has weight, the boost burst (flame bloom, lightning button with 3 charges) is pleasant to spam, climbing PERFECT xN chime. Still a bit floaty and every world uses the same rain-streak lane backdrop.
3. **Almost.** v1: there is no fail state at all. "SLOPPY" separations and "on course 41%" mean nothing and I could not tell what I did wrong or how to be at 70%. v2: hull pips, "SO CLOSE" style stars ("every ring = 3 stars", "no hits = 2 stars", "finish with a boost charge left = 3 stars") give a clear, fixable target. Capped at 6 because I never saw an actual loss/retry moment.
4. **One-more.** v1: launches arrive on the agents' timer (~25 s apart), you wait; "Back to the pads" then idle. No retry. v2: result card has Next / Go for N stars / Map on one screen, countdown is ~1 s, a mission is ~15-20 s. Thumb stays on the button. The end card appears a beat late and the first mission end card text was empty for a frame.
5. **Surprise.** v1: by minute 10 it is the same Rust Rock / Halo result card repeated (18 launches, ~8 reached Halo, 0 new elements). v2: new hazards per world (debris, satellites, magnets, flares), HARD missions every 7th, world-clear banners, a patch chest roughly every 3 stars. The visual treatment barely changes between worlds, so the surprise is in rules, not in the eye.
6. **Mastery.** v1: no way to see improvement. My steering "got better" nowhere. v2: stars per mission, par-fuel star, combos x14, "Go for 3 stars" replays. Reasonable, but no best-time/ghost, and combo is the only skill readout.
7. **Tomorrow.** v1: map of planets and a shop ("reach 98" for the next world) but a no-agent player has no daily, no streak. v2: Daily mission + streak, chest bar always almost full ("1 stars to next chest"), patch collection 9/24 with empty slots, a world one mission from done. Daily and streak untested by me.

## First 2 minutes, beat by beat

### v1 (demo mode)
- 0:00 Full-screen wall of text: "Link your Claude Code + Codex", a curl command, Copy button. No toy, no rocket visible behind a dark modal.
- 0:03 Notice the small "Just watch a demo team" link, tap it.
- 0:05 Pretty 3D launch pads, little agent workers bolting parts. A ticker says "api: part 4/9 bolted on". I am a spectator.
- 0:30 Countdown "3 2 1", launch, good smoke and shake. Hint at the bottom: "Tap or hold a side to steer".
- 0:36-0:50 Rocket flies up a cyan corridor by itself; I steer with little effect; a yellow ring says TAP. A MAX-Q / OFF COURSE badge flashes.
- 0:56 Result: "REACHED THE RED PLANET, +25 science, 58% on course, 57 reach, Separations: SLOPPY". Nothing tells me how to do better except "bigger stacks".
- 1:20 Back on the pads, wait for the next "waiting for you" bubble. Second flight ~80 s. At 2:00 I have done two flights and still feel like I did nothing.

### v2
- 0:00 Straight into mission 1 "First Light": sky, rocket, two gate posts with a dashed line, hint "drag to steer", orange boost button. No menu.
- 0:03 Drag: rocket follows, first gate pass gives sparkle + "PERFECT x1". The pitch of the chime climbs on each gate.
- 0:08-0:15 Nine big gates in a row, combo reaches x9, planet and checkered finish line rise into view, confetti.
- 0:17 "LIFTOFF!" card, 3 stars, "Perfect run!", "3 stars to next chest", big Next: Crosswind button.
- 0:19 Tap Next, 1 s countdown, mission 2 with sideways wind. Perfect again.
- 0:35 First chest: "New patch! 1/24 collected" (spiral).
- 0:40-1:20 Missions 3 and 4 (Pebble Patch with rocks, Fuel Stop with fuel cans): rocks and boost appear, the first real decision.
- 1:20-2:00 Missions 5-6, "Cloud Canyon" misses one ring ("every ring = 3 stars"), a free replay suggestion. By 2:00 I have 6 missions, 2 patches and a streak of tiny goals.

## What the best app-store game in this genre does that this one still doesn't
Genre: one-thumb arcade flyer/runner (Jetpack Joyride, Alto, Stack, Crossy Road, Smash Hit, Doodle Jump).
- **Failure is the lesson, and retry is one tap on the same screen.** Smash Hit/Jetpack Joyride put you right back in <1 s with "you died 300 m from your best". v2 has the card but I did not see the near-miss "SO CLOSE: 1 gate" moment fire live; v1 has no fail at all.
- **A rare, loud surprise inside the run itself** (Jetpack's vehicle pickups, Crossy Road's mystery chest, Subway Surfers' hoverboard). v2 has chests only after the run; nothing in the run changes the toy (no boost-fever state where all gates are worth double, no golden gate that bends the lane).
- **Distinct look and sound per stage** (Alto changes weather and palette, Smash Hit changes the glass world). v2 keeps the same rain-streak lane and rocket from world 1 to 3; only the obstacles change.
- **Ghost / best-run chase**: every top runner shows your best marker on the track. Here the only mastery readouts are star icons.
- **No required setup.** The best games never put an install wall (v1's terminal modal) in front of the toy.

## Five biggest fixes, in order
1. **Fix v1's front door (or retire it as the default).** The modal wall hides the game; a no-agent player must find a small link, then wait ~35 s for the first launch and cannot fail or improve. If v2 ships to everyone it must open directly into mission 1 as it does now. Get v1 off 3D software-render slowness too (9-19 fps in my run).
2. **Make losing a visible, authored moment and test it with a real human.** Surface "SO CLOSE: N gate(s)" and show where hull was lost; make sure retry is on the first button (it is "Next" after a win, check it is "Retry" and instant after a loss). Lowest-evidence score (Almost = 6).
3. **Add a fever/frenzy state to the run itself.** After combo 5, speed + brighten + double science for a few seconds with screen flash and "UNSTOPPABLE"; combo 12 should be a different event than combo 5 (currently the x9 and x12 look the same on the HUD).
4. **Give each world its own look and sound.** World 2 "Rocks" and world 3 "Deep" should not share the same rain-streak backdrop; add palette shift, parallax, a unique gate chime per world, a boss intro.
5. **Mastery readout and tomorrow hook on the end card.** Show "best x14 / par fuel / vs last try" with a ghost marker or a time; show the Daily and streak on the first end card (currently the first thing seen is the chest bar only), and give the chest bar a visible reward preview so the "1 star to chest" pull is stronger.

Also noticed: in the first 2 minutes the game is nearly too easy (my bot got 3 stars on 20 of 30 missions), so difficulty/sawtooth for real humans is unverified.

Verdict: TEST
