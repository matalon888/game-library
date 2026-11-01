# Pose Rush — deep v2 design (lane 4, 2026-11-01)

Game: a fighter sprints down a street; when a thug steps up, time crawls and you pose (tap = auto strike, or drag a hand/foot/
chest ring) to knock him out or dodge his bullet. v1 = endless-ish levels of 2-7 thugs, one hit loses, no stars, nothing carries
over. Data (7 d): 17 sessions (small sample).

## Five layers v1 -> v2
| layer | v1 | v2 |
|---|---|---|
| verb | 2 (tap or drag, no reason to drag) | 3: tap = safe auto strike, drag = STYLE (counts for 3 stars); sway targets need timing; lean vs hop dodges |
| loop | 1 (5-7 thugs, random) | 3: authored 5-9 beat gauntlets, perfect-chain combo, FEVER, close-shave dodge bonus, kill-cam on the last thug |
| level design | 1 (seeded random) | 3: 36 hand-made levels, purpose line each, 3 worlds, boss every 12, breathers |
| meta | 0 | 2: star map (3 worlds), outfits from stars, daily gauntlet + streak |
| feel | 2 | 3: hit-stop, rising pitch with chain, kill-cam, close-shave, speed lines, outfit cape |

## Mechanic plan (token -> element)
kM/kH/kL/kS static kick/punch targets at chest/head/belly/shin; kW swaying target (time the tap or drag to track);
gH high bullet (lean back); gL low bullet (hop: feet up); bL rolling barrel (hop); sXYZ multi-hit shielded thug (guard break,
then the next target), `+` = close to the previous beat (cluster, slow-mo chains). Boss = 4-hit shield thug.
W1 Sunny Street 1-12: kicks, first bullet L3, cluster L5, hop L6, shield L8, boss L12.
W2 Rooftop Dusk 13-24: sway, bullet pairs (lean then hop), shields; boss L24.
W3 Neon Night 25-36: faster bullets, shorter windows, all mixed; boss L36.

## Stars
1 = cleared. 2 = at least 70% of beats PERFECT (quick: struck within ~1.7 s of slow-mo start). 3 = all perfect AND at least half the
strikes by hand (drag) = STYLE. Levels 1-3 cannot be lost the first time (thug never reaches in L1).

## Meta
Level map (3 worlds), outfits at star totals (cape/headband), daily gauntlet (seeded by date) + day streak, "tomorrow" line on cards.
Board score keeps meaning: levels cleared (WB.submit(1) per first clear of a level run, limits unchanged).
deep v2: shipped 2026-11-01 (TEST)
