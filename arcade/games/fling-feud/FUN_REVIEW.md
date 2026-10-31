# Fling Feud: fun review (cold critic play, v1 vs v2)

**FPS: v1 60.1 fps, v2 60.2 fps (requestAnimationFrame count over 5 s, solo run; 15-20 further 5 s samples during play all 60.1-60.2). Both are over 30, so the run is valid.**
Caveats: desktop Chrome headless, 390x844 touch viewport, DPR 1, software WebGL, so this is not a phone number (recheck on a mid-range phone at DPR 2-3). No audio judged. Emoji glyphs render as boxes on this box and were ignored. All non-127.0.0.1 hosts were aborted.

Method: Playwright, real pointer drags from a fixed thumb spot (backwards drag), a "new player" that does nothing for 4 s, then throws, keeps its aim when a throw damaged the rival and jitters angle/power when it missed. Video and ~90 screenshots (deleted afterwards). Each version got one 10.5 min session. v1: 23 round cycles, reached level 7 (won 1-6, then 12 straight losses on level 7 with the rival at 94-163 HP). v2: reached level 9 (cleared 1-8, 2 losses on HARD level 9, plus single losses on levels 4 and 6). A first v2 run was wasted by my own script tapping the map button on the lose card; it was discarded and redone, not counted.

## Scores (0-10)

| Test | v1 | v2 | Why |
|---|---|---|---|
| 1. 10-second | 4 | 8 | v1: title over a lone lumberjack, the rival is off-screen, nothing to hit; a hand icon says "tap to throw". v2: both fighters, cacti and a flag on screen, aim demo plays itself, first "CLEARED!" after ~10 s of play (16 s from load) with a K.O. spin. |
| 2. Toy | 5 | 7 | Both: tap-to-throw is auto-aimed, drag-back gives arc dots and a power bubble, ragdoll spins and star bursts feel decent. v1 gets stale because every throw is the same axe into a blank hill. v2 adds weapons (pan, trident...), props and balloons so 20 throws are not 20 copies. Tap-aim is a bit too forgiving, so the drag is almost optional early. |
| 3. Almost | 3 | 6 | v1: losses are mostly the AI killing you in 2-3 throws while the rival sits at 100+ HP (level 7: rival HP 155 after 8 losses in a row); it feels like HP scaling, not my miss. v2 prints "SO CLOSE: X had only N HP left" and shows the star target ("3 stars: 2 throws or fewer"), but level 9 still ended with 183 HP left on the foe, which reads as unfair. |
| 4. One-more | 5 | 8 | v1: lose card, tap anywhere, new round in about 2 s; fine but plain. v2: big TRY AGAIN button, ~2 s to the next throw, and a NEXT/replay/map row; replay for stars is built in. The map button sits just under TRY AGAIN, easy to mis-tap. |
| 5. Surprise | 3 | 7 | v1 levels 1-7 play the same: same arena, same chef, bigger HP number. v2: walls, balloons, hard-tagged levels, new weapons at star thresholds, a chest ("OPEN"), COMBO x2 +25%, walking rival, new foes. The 10th minute is visibly different from the 1st. Not yet a huge spectacle moment (no fever, no golden target seen). |
| 6. Mastery | 3 | 7 | v1 shows "2 hits" and nothing else; a 12-loss streak shows no improvement signal. v2 shows stars per level, throw limits for 3 stars, total stars, combo percent. My bot improved visibly from 3 stars on L1 to 19 stars by L8. Still no trick-shot callouts or personal-best line. |
| 7. Tomorrow | 2 | 8 | v1 has nothing unfinished except "level N". v2 has a DAILY DUEL #1 banner, "8 more stars for the next weapon" bar, locked worlds 2-3 (108 stars total), shirt medals, a map with 12 nodes per world, and star-incomplete levels. |

**v1 average: 3.57** (25/7)   **v2 average: 7.29** (51/7)

## The first 2 minutes, beat by beat

**v1**
1. 0 s: a lumberjack on a red hill, "FLING FEUD", pointing hand, "Tap to throw that way". Rival is off-screen, so there is no target.
2. 4-6 s: the title fades, HP bars show Jack vs Chef Rosa, but still no Rosa on screen.
3. ~6-18 s: I throw; the axe flies out of frame; the camera pans, stars burst; the hit lands off to the side. The rival takes damage but the "toy" feels remote.
4. 18 s: I LOSE level 1 (the AI chef hits back for 100 HP total). A new player loses the very first level.
5. 20-30 s: retry, win level 1 ("CHEF ROSA is down, 2 hits"). The KO spin plus stars is the first real payoff, 30 s in.
6. 32-95 s: levels 2-3 won, level 4 lost; each round 15-25 s, identical look. By 2:00 I have lost 4 times on level 4 and nothing in the game has changed except the number on the HP bar.

**v2**
1. 0 s: both fighters visible, cacti, a flag, pointing hand, "World 1 - Level 1 - star 0". Clear what to do.
2. 4-6 s: the aim is demoed for you (dots and power bubble sweeping); tap throws auto-aimed.
3. ~10 s: first hit; Rosa is KO'd in 2 throws. 16 s: "LEVEL 1 CLEARED!" with a spin, 3 empty star boxes filling, "New: Pan", an OPEN chest button.
4. 18-33 s: level 2 in 14 s (4 stars total so far), balloon and props appear.
5. 33-64 s: level 3, "1 - Warm-up throw 2/2" HUD, throw limits introduced. Cleared with 8 stars.
6. 66-120 s: level 4 "Shuffle": Rosa walks, a cactus line in the way, "throw 5/3" shows I am past the 3-star limit. This is the first real tension (and my first loss at 3:37 shows "SO CLOSE" language). By 2:00 I have a weapon unlock, 8 stars, and a daily-duel promise.

## What the best app-store game in this genre does that this one still doesn't

The reference is Bowmasters (and its cousin Mr Bullet / Angry Birds style one-more loops). In the first 2 minutes it:
- Plays a fully voiced, character-based hit in the first second: slow-mo headshot cam with a bone-crack and a "HEADSHOT!" stinger, so every hit is a mini-reward and not only the KO.
- Gives the rival a personality: taunts, a face reaction, funny deaths that differ every time (variable reward), plus a different arena/opponent every 1-2 duels.
- Offers coins and a chest after almost every duel and drives a visible collection (a new bow/character shortly after minute one), with a spin wheel or random pick.
- Has a mid-duel physical surprise (wind, moving target, boss with a shield, "fatality" shot) so the aim has to be re-learned.
- Pays the player sooner: the second duel already has a reward screen with a progress bar to the next unlock.
Fling Feud v2 now has the star/weapon/daily loop, but its hit moments are not yet escalated (no slow-mo or headshot callout seen on normal hits, no taunts, no fever), the foe always looks the same (Chef Rosa through level 9), and there is no random-pick reward the player can see by minute two (the "OPEN" button exists but I never saw what is inside).

## The 5 biggest fixes, in order

1. **Make every hit a moment (Almost + Surprise).** Slow-mo plus a camera push on headshots and on the killing blow, a different callout per hit tier ("HEADSHOT", "BANK SHOT", "CHEF SALAD"), and variable KO animations. Right now only the KO is special.
2. **Fix unfair-feeling losses on HARD levels.** Level 9 showed the foe at 183 HP after two losses while the AI kills me in 2-3 throws. Cap the rival's HP relative to a 2-3 throw win, or give a player-HP bonus; show "N shots to win" so a loss reads as "I was 1 throw late".
3. **Vary foes and arenas inside world 1.** Rosa is still the opponent at level 9. A new face and taunt every 2 levels, a boss every 6, and per-foe tricks (shield, dodge, healing) so level 7 does not play like level 1.
4. **Show the chest reward and add a fever.** The OPEN button needs a visible random pick (golden weapon 1-in-20), and a 3-hit streak should trigger a short fever with double damage, louder FX and a screen flash, as the playbook asks.
5. **Fix the lose-card tap layout and v1 first-throw framing.** The map button sits 40 px below TRY AGAIN and I mis-tapped it; put it in a corner. v1's rival is off-screen on the first screen: if v1 stays live at all, frame both fighters (v2 already does).

Verdict: TEST
