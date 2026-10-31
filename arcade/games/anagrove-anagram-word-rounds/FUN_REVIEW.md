# Anagrove: FUN_REVIEW (cold critic play, 2026-10-31)

Method: Playwright, real Chrome, 390x780 touch viewport, video + screenshots, all non-127.0.0.1 requests aborted, no window.__game.
About 11 minutes of play per version (v1 = `index.html`, v2 = `?deep=1`): tile taps for the first 6 words of each run, then
keyboard typing + Enter, plus shuffle, hint, delete, a swipe attempt, deliberate typos, and one run left to time out.
Caveat: my player finds words faster than a human (about 2 s a word), so rounds clear in 30-60 s and I covered more levels than a
person would in 11 min. Audio can't be heard in headless, so "sound" is not scored from evidence. In my Linux Chrome the star glyph
renders as an empty box (missing font); I did not score that, but check it on real phones.

## Scores (0-10)

| # | Test | v1 | v2 |
|---|---|---|---|
| 1 | 10-second | 6 | 8 |
| 2 | Toy | 5 | 7 |
| 3 | Almost | 5 | 6 |
| 4 | One-more | 7 | 7 |
| 5 | Surprise | 2 | 7 |
| 6 | Mastery | 3 | 7 |
| 7 | Tomorrow | 4 | 7 |
| | **Average** | **4.6** | **7.0** |

Beats v1 on: 10s, toy, almost, surprise, mastery, tomorrow. **Ties v1 on one-more (7 vs 7). It does not beat v1 on every test.**

FPS (rAF counter): v1 avg 60.0 (min 59.0, 655 samples, with another browser running at once), v2 avg 60.0 (min 59.3, 656 samples).
Solo during the toy-tap test: v1 59.8, v2 59.7. No jank seen in either, including confetti and combo bursts.

## First 2 minutes, beat by beat

**v1**
- 0 s: dark forest card, "Anagrove", a daily-challenge calendar button, "Tap to play". Nothing moves, nothing to touch but text.
- 1 s: tap. Six round letter tiles in a flat row, a wall of empty grey slots with no hints. The 2:30 clock starts at once.
- 3-8 s: my first word flies tiles into the tray, then into a slot. +160 and a tick up. Fine, but quiet and small.
- 10-25 s: every word is the same animation. Slot, +90, slot, +160. A wrong word just says "Not in our word list".
- 29 s: "Round cleared!  10/10 words" plain card, "Tap to continue".
- 32-100 s: round 2 and 3 are identical in shape (same screen, new letters, same 2:30 clock). I cleared round 3 at 102 s.
  Nothing new has happened in two minutes. By round 16 it was still the same screen.

**v2**
- 0 s: same title card plus a "Grove map 0/90" chip.
- 1 s: tap. Tiles sit in a ring, first letters of every slot are pre-filled, a goal pill says "Find 5 words". There is no clock on level 1
  (no pressure for a new player). If I idle, it offers a hint ("Try SECT").
- 3-10 s: 160, 273, 408 points; combo counter appears (x5). Each word pops its slot and gets a floating +number.
- 13 s: the six-letter word (SECRET) gets a big payoff, score jumps from 408 to 2,018, confetti, yellow row.
- 16-28 s: bonus words (+30) keep scoring after the goal is met. The NEXT button turns gold.
- 29 s: "Perfect grove!", three stars, a seed bar "3/6 · daily is ready", buttons Map / Again / Next.
- 32-120 s: level 2 has a 3:00 clock and x5/x10 chain meter with confetti. Level 3 goal changes to "Reach a x3 chain". Level 4 to "3 words of 5+ letters". By 127 s a
  seed chest opened and unlocked a "Sky" tile colour. By level 10-12 the world changes to Whisper Woods and tile colours change.

## Notes from the 11 minutes

- v2 goals rotate: plain count, 5+ letters, chain, words starting with S, "golden word", six-in-N-seconds. That is real variety in what I do.
- v2 rewards: seed chests every other level (tile skins: Rose gold, Sky, Mint, Berry, Night, Plum), new worlds, map, daily.
- v2 never made me lose. I earned 3 stars on every round (my player is fast, but still: stars at 5/5 words are cheap). On a timed-out round
  after 5/10 words it still says "Round cleared!" with 2 stars and "3 more words for 3 stars". That is a decent near-miss line, but there is
  no failure, so no tension. Level 1 has no timer at all.
- v2 letter sets feel repetitive: the same E/R/S/T families (STREET, ENTERS, RESENT, TREES) came back many times in a row, and the walls
  are mostly short 3-4 letter words. The 10th minute plays like the 3rd with different goal text.
- v1: 18 rounds in 11 min, zero change in pace, goal, look or reward. Score is a bare number (41,000 by round 16) that means nothing.
  Loss ("Time's up! The six-letter word was RESUME") is fair and restarts in one tap, but there is no "you were 2 words short".
- Both: toy feel is okay. Tile press is a soft squash, tray fill is smooth. A swipe across tiles did not enter letters in my test
  (tap only), which a phone player of this genre expects.

## What the best app-store word-anagram game does in its first 2 minutes that this one still doesn't

1. Swipe-to-spell: drag a finger across the ring, tiles light, the word forms live, release to submit. Faster and more tactile than tapping.
2. Every level is a different board and a different promise: a picture, a themed word set, a bonus-word chest you are visibly filling, so level 3 does not look like level 2.
3. Shuffle and hint are tied to a soft economy (coins you earn mid-round), so mid-round decisions exist. Here they are free and decisions are absent.
4. Stakes: the board can truly beat you ("2 words short") and a streak of days is shown on the first screen. Here nothing is ever lost.
5. Big audiovisual escalation on a combo (screen-filling effect, rising pitch). v2 has x5/x10 and confetti but it is small and only the number grows.

## Five biggest fixes, in order

1. Make failing possible and loud in v2: a timed-out round with the goal unmet shows "SO CLOSE: 2 words short" and retry is the big button; do not show
   "Round cleared!" when 5 of 10 words are found. Raise the 3-star bar so a quick player doesn't get 3 stars on every round.
2. Fix letter variety: stop serving the same E/R/S/T families; vary letter sets, allow long (5-6 letter) targets on walls, and hand-design one standout rack per world.
3. Add swipe-to-spell (drag across the ring) and a visible word preview while dragging.
4. Escalate the spectacle: at chain x5 and x10 add slow-mo, screen flash, a "UNSTOPPABLE" word and a fever state (double points for 10 s). Right now x10 looks like x5.
5. Make the tomorrow-hook visible on the title screen: streak days, the chest at "3/6", and a "daily is ready" badge, not only on the result card. Also give v1/v2 seeds
   a collection screen showing the empty slots (tile skins you don't own yet).

Verdict: TEST

Post-review change (lane 20): 3-star win now auto-advances after 2.6 s unless Map/Again is tapped (One-more tie fix).
