# Glow Keys: fun review (critic run, 2026-10-31)

Method, honestly stated: phone viewport 390x844, Chrome via Playwright, video + screenshots (deleted afterwards), all non-local hosts and POSTs blocked.
~10.5 min of play each for v1 (plain URL) and v2 (`?deep=1`), as a new player starting from the start card.
I could not hear the audio, and I did not use a real thumb: taps were synthetic pointer events from an in-page player modelled on a mediocre human
(timing jitter about 55 ms, about 2% of tiles skipped by "slip"). So the Toy score rests on visuals plus code, and difficulty/loss rates are for that player.
Screenshots show tofu boxes where the star glyph should be (win card, lose card, Map button): likely missing headless font, not verified on a real phone.

## Measurements (machine was heavily loaded: `uptime` load average 27 -> 67 -> 91-105 on 48 cores while other agents ran jobs)
| | start card | in play (requestAnimationFrame over 5 s) |
|---|---|---|
| v1 | 39.5 fps | 32.8 fps |
| v2 | 33.5 fps | 28.7 fps |
Software WebGL under heavy load, so absolute numbers are pessimistic. v2 costs roughly 12% more frame time than v1. Neither was measured on a real phone.

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second test | 7 | 8 |
| 2. Toy test | 6 | 7 |
| 3. Almost test | 4 | 8 |
| 4. One-more test | 7 | 8 |
| 5. Surprise test | 3 | 7 |
| 6. Mastery test | 3 | 7 |
| 7. Tomorrow test | 1 | 6 |
| **Average** | **4.4** | **7.3** |

v2 beats v1 on all 7 tests, narrowly on One-more: both restart in about 1 s, but v2's "SO CLOSE 94%" bar plus hearts give a reason to retry, while v1 gives only a percentage after a sudden death (8 deaths in 150 s on Canon with nothing to show for it).

## First 2 minutes, beat by beat
**v1**
1. 0 s: start card over a live lane preview. Title, song name, "Tap the dark tiles", hand icon. A preview tile sits behind the title text. No menu, one tap starts. Good.
2. 5 s: first tap. A piano note, a lane beam, a ring and particles, then PERFECT. Instantly pleasant.
3. 5-17 s: "Twinkle Twinkle", 11 tiles, hard to lose. Level 1 CLEARED, tap to continue.
4. 18-36 s: level 2 "Ode to Joy", 30 tiles, a longer hold tile. Cleared.
5. 38-49 s: level 3 "Minuet": MISSED at 48% (31 points). The screen turns red, "Tap to retry". Instant retry, about 1.2 s.
6. 51-77 s: retry. Cleared on the 2nd try. Same look, new song title.
7. 78-103 s: level 4 "Saints": lost at about 50 points. Retry. Cleared at 132 s.
8. 134-170 s: level 5 "Canon": 8 deaths in about 150 s with no sense of progress. Nothing changed between tries except the song getting longer.

**v2**
1. 0 s: same start card plus "Lantern Lane · level 1", 3 hearts, a Map button. First beats play themselves (demo), so music starts at once. Good.
2. 5-16 s: level 1, 11 tiles, cannot be lost. PERFECT card: 3 stars, "PERFECT RUN", "Tomorrow: a new daily melody · 1-day streak". Next ▶ is a big gold button.
3. 17-37 s: level 2: combo labels get bigger, "FEVER x2" appears in the top bar, the score jumps (4930). There is feedback on every tap.
4. 38-62 s: level 3, fever again. Background palette changes per level.
5. 62-86 s: level 4: first heart lost ("2 hearts"). The run survives, so a mistake is not the end. Win with 2 stars and a "need 80% and at most 1 lost" hint.
6. 87-113 s: level 5 and a new song. Level 6 "Für Elise": all hearts gone at 94%, "MISSED IT · SO CLOSE · 94%" with a pink bar and big Retry. Retry, then win with 3 hearts.
Over the whole 10 min the bot reached level 20: boss at 10 ("BOSS LEVEL", 2 hearts, "HELD!"), fever and UNSTOPPABLE words, gold gems 31, 4 skins seen.

## What the best game in the genre does in its first 2 minutes that this still doesn't
Magic Tiles 3 / Piano Tiles style leaders (and Beat Fever-type rhythm games) do these:
- You get to PLAY a recognisable pop hit in 5 seconds, not a nursery rhyme. The song library is the product. Here: Twinkle, Ode, Minuet, Saints, and 6 more.
- The player visibly chooses what to play next: a song shelf with covers, a daily/featured song, and a "play this exact song, retry this exact song" loop. Here the song order is forced and the map is small text numbers.
- Every success pays out in a tangible way: star-burst, coins/gems flying into a counter, an unlock bar filling, a chest opening. Here gold gems are a small counter and skins are a thin row on the map.
- The long game (collection of songs, skins, rank) is shown on screen from minute 1. Here the "tomorrow" hook is one line of grey text on the win card.
- Controlled rhythm variety inside a song (speed-up, off-beat double taps, swipes) so minute 2 differs from minute 1 within one song. Here v2 changes by level, not within a song.
- Audio: real instruments plus a backing track/drums that react to your hits, so a good run sounds like the record. Here: a synth piano.

## 5 biggest fixes, in order
1. Add a real song shelf (play any unlocked song, choose a song after level 3), and add 3 to 5 recognisable-style tunes (original arrangements of public-domain pop-friendly tunes such as Jingle Bells, Greensleeves, Habanera, Blue Danube). New-player retention depends on wanting to hear the next song.
2. Make the meta pay out loudly: after each win, stars and gems fly to a bar ("3 more stars for the Rose skin"), and show the next unlock and the daily-melody streak on the card as a large, tappable thing, not 10 px grey text. Tomorrow test only reaches 6 today.
3. Add surprise inside a song: a rare golden "jackpot" tile worth a lot, a speed-up moment, a swipe or double tile in world 1, a bonus room every few levels. In 10 minutes the first 9 levels played the same way.
4. HUD polish: "FEVER x2" overlaps the level pill and the progress bar; "BOSS LEVEL" overlaps the hearts; the preview tile sits behind the title text. Verify the star glyph (shown as a box in my Chrome) uses an image/SVG or a font that exists on phones. Also performance: 29-33 fps in play under load; trim particles and sprite counts and keep 60 fps on a mid phone.
5. Mastery feedback: show PERFECT/GREAT/COOL totals and an early/late bar on every card, a "personal best %" per level on the map, and a "replay for 3 stars" prompt when a level ended with 2 stars. Right now stars are visible, but how to get better is not.
Also for v1, if it stays live: one miss ends the song and a win is always 3 stars, so it needs hearts and real grades. Those are exactly what v2 adds.

## Verdict
v2 averages 7.3 (v1 4.4), lowest test 6 (Tomorrow), and beats v1 on all 7 tests. It meets the TEST bar and not the PASS bar (avg 8, none under 7). Ship as an A/B while fixing 1-3 and re-review.

Verdict: TEST
