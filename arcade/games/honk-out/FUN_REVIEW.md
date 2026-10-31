# Honk Out: FUN_REVIEW (cold critic play, 2026-10-31, second pass)

Method: phone viewport 390x844, touch taps (Playwright, Chrome, software GL), non-127.0.0.1 hosts blocked. v1 = `index.html`, v2 = `index.html?deep=1`.
Each version was played for 640 s (10.7 min) on a fresh profile, as a new player with no solver: a scripted "casual thumb" that taps cars on a grid at
about 2 taps per second and taps the win/lose card buttons (it never used `bot()`, never read levels, and never used the hop). That is a weaker player than a
person, so losses are inflated. Video and screenshots were reviewed and then deleted. Headless means no audio: sound is not scored, and anything that depends on
it is judged only from the visual feedback text.

Progress: v1 won lots 1-3, then lost lot 4 eleven times in a row (random tapping, about 6 minutes). v2 won lots 1-9, lost lot 7 once, won it on the retry, and
sat on HARD lot 10 for the last 270 s without winning or losing (no JAMMED, hop unused).

## Frame rate (requestAnimationFrame count over 5 s, single browser, 390x844)
| | fps |
|---|---|
| v1 | 18.0 |
| v2 | 20.2 |

Software-rendered (SwiftShader) server with no GPU, so this is a floor; a phone should do much better. With both browsers running at once, as in the long
play, everything ran visibly slower. Load to interactive was about 12 s on this box (also software and cold cache).

## First 2 minutes, beat by beat

### v1
- 0 s: "HONK OUT!" title over a toy town, 24 riders queued on the pavement, a pointing hand and "Tap a car to drive it out". Clear and pretty.
- 3 s: first tap drives a car out and into a spot; the start overlay does not swallow the tap (it replays it). Good.
- 4-25 s: tap, tap, riders walk to the matching car, the car honks and leaves. Satisfying but slow: lot 1 takes about 25 s with no target number except a thin progress bar.
- 28 s: "LEVEL 1 CLEARED! 24 riders home!" "Tap to continue". No stars, no best, no reward. A plain card.
- 32-84 s: lot 2, the first blocked cars. Cars with an arrow facing a neighbour just bump. Won with 42 riders. Nothing new happens.
- 88 s: lot 3 and then lot 4. At 171 s, lot 4 has 8 cars and 5 spots. First JAMMED: "No spot left for the right colour" with no hint which colour, which car, or what I could have done. I tap to retry and play the same lot again.
- Beat 2 minutes: same lot, same look, same cards. Nothing has changed since minute 0.

### v2
- 0 s: same toy town plus an instruction line, a hop button (2), a map button, and a "next: [colour]" chip above the queue. Only 12 riders. Lot 1 is three free cars.
- 3 s: first tap works, a car goes out. Riders walk and board. Lot 1 is cleared in 14 s.
- 17 s: "LOT CLEARED!" with 3 big stars, "New sticker for the town 1/30", "+1 hop", "Candy paint at 6 stars", "Tomorrow: Daily Rush #3 . day 2". One big green "2" button. The card has 4 banners, a lot to read, but it makes the win feel like a win.
- 23-36 s: lot 2, one car blocks another. Won. Three stars again. Fast.
- 41-66 s: lot 3, the first lot with decisions. A live star chip shows "perfect: park only what the line needs". This is the new idea: the line tells you what to pick next.
- 70-145 s: lot 4, vans carry 6. Won with some wasted taps. By 2 min I have 3 stickers, a hop count, a paint goal, and a reason to care about order.

## The seven tests (0-10)

| # | Test | v1 | v2 | Note |
|---|------|----|----|------|
| 1 | 10-second | 6 | 7 | Both: first tap works and a car honks out with riders pouring in. v1 takes about 25 s to finish lot 1 and shows nothing but a plain card. v2 clears lot 1 in 14 s and rewards it with stars and a sticker. Neither has a big pop in the first 10 s: the first car is an ordinary one. |
| 2 | Toy | 6 | 7 | Tapping a free car is pleasant in both (pull-out, honk, riders walk, confetti). v2 adds convoy/fever words and a golden rider that make streaks feel good. Blocked cars bump in both, but the bump is small and my screenshots could not show it clearly. Still no "one more tap" pull from the tap alone. |
| 3 | Almost | 4 | 7 | v1: "JAMMED! No spot left for the right colour" with nothing more. I lost lot 4 eleven times, and I could not tell which tap lost it, so it felt random. v2: "Waiting for [blue dot]. Nobody in the spots is blue: the line is waiting for a blue car" and the live "4 in spots . best 3" star chip, plus a hop rescue. I know what I should have done. One point off 8: the jam is only judged at the end, not shown as a near miss ("1 spot from jam") while playing. |
| 4 | One-more | 6 | 7 | v1 retries by tapping anywhere, which is fast, but a lost lot throws away 30-60 s and gives no reason, so my thumb goes to retry out of stubbornness, not pull. v2 restart took about 0.8 s after the tap and is one big red "Again" button, with the loss reason on screen. The win card is heavy (four banners) and delays "next" by a few seconds. |
| 5 | Surprise | 3 | 7 | v1: lots 1-4 are the same toy, only bigger. v2: new things arrive on a schedule (vans, stacks, buses, "next" chip, sticker, new paint at 6 stars "Neon!" on lot 6, convoy words, HARD lot 10 with a different cluster of cars, hop). I did not reach worlds 2 and 3 in 10 minutes, so I only know their promises from the design notes. |
| 6 | Mastery | 3 | 7 | v1 shows only a rider count and a progress bar; the same 3 won lots tell me nothing about skill. v2 shows live stars, "best 3", par, a hop count, and the town sticker count. I could see I was getting 3 stars on lots 1-6. After 10 minutes I still could not tell how to get better on lot 10 (no hint from the game). |
| 7 | Tomorrow | 2 | 8 | v1: nothing is unfinished except "level N". v2: "Tomorrow: Daily Rush #3 . day 2" on every card, "Candy paint at 6, town 1/30" bars, "Night paint at 27 stars" with a 16/27 bar when I stopped, stickers, and a "next: [colour]" chip. I would plausibly come back for the 27-star paint. One more point would need the streak shown at the start screen, not only on cards. |
| | **Average** | **4.3** | **7.1** | v2 beats v1 on every test; lowest v2 score is 7. |

Scoring honesty: these are a 7 and not an 8 because I played as a weak, random-ish player and heard no sound. A real player would clear lots faster and likely rate
mastery and almost higher. Scores for the long tail (worlds 2-3, the daily) are untested by me.

## What the best game of this genre does in its first 2 minutes that this one still does not
The genre leaders (Bus Craze, Parking Jam / Car Out, Traffic Escape) use these:
1. **A big, loud first 10 s.** The first tap triggers a chain: car out, bus fills, the bus leaves, the next bus slides in, all with a pitched audio ladder and camera nudge. Here the first car is just a car that honks.
2. **A near-win jam is a screen shake, not a card.** They show a "1 spot left" pulse and freeze for a second so you see the exact mistake, and offer one tap "undo / extra spot". Here the jam is judged at the end with a card, and the cause is only a sentence.
3. **Every lot is a small puzzle you can see.** In the best ones, the same screen shows what to free first: blocked cars wobble, and a free one glows after 3 s of idle. Here, an idle player stares at the lot with no nudge, and a HARD lot sat 270 s with no prompt.
4. **A big satisfying "clear" beat every 10-20 s,** with a bonus lane and a rare golden bus. Here the win card is on a 15-60 s rhythm and mostly text banners.
5. **Camera and juice per tap.** Slight zoom on the honk, bus squash and stretch, passengers jumping on. Here the riders walk slowly (partly software fps) and the cars barely squash.

## The 5 biggest fixes, in order
1. **Idle help and a visible stall state.** On HARD lot 10 I did nothing useful for 270 s and the game never said "tap the glowing car" or pulsed the hop button. After 6 s idle, wobble a free car, and after 15 s pulse the hop. A stuck-but-not-lost state must show a message.
2. **Make the first 10 s louder.** Add a first-tap chain (car, first rider boards, three more pop in, a pitched honk ladder, a slight camera push, a "+3" burst), not just a plain pull-out. Lot 1 is the only lot every player sees, so spend the juice there.
3. **Shrink the win card.** Four banners plus a stars row slows "next" by a few seconds. Show stars first, the best banner second, and let the "next" button be pressable within 1 s (tap anywhere as v1 does).
4. **Show the near miss while playing.** At 1 free spot, pulse the spot row red and show "1 spot left: free a [colour] car". Today the "jam" is only explained after losing, and the loss of 11 retries on a lot is a quit risk for a casual player.
5. **Sound and motion check on a real phone** (this server cannot judge it): the boarding walk looked slow-motion at about 20 fps, and blocked-car bumps were hard to see. Confirm on a device that boarding, bump and convoy popups hit the beat, and then tune the squash and camera nudge. Also trim the 12 s first load if it is not just this software box.

Verdict: TEST
