# Rack Attack: design (studio lane 20)

deep v2: in progress (started 2026-10-29, lane 20)

## What it is
Top-down 3D 8-ball. Touch the table to aim (guide line, ghost ball, first-contact preview), pull the cue in the bottom panel
for power, release. v1 = one endless 8-ball match against a rival, the rack growing from 3 to 15 balls.

## Numbers (diag_events type 'game', 2026-10-22 … 10-29, 60 visits)
- median time per visit **42 s**; 33% quit under 15 s; 43% stay 60 s+
- **32% never took a shot** (≤ 2 taps): the pull-the-cue-in-a-bar control is not discoverable
- 67% of runs end at level 1 (a full 8-ball match is too long and too hard for a first round); 53% leave via "next"
- the only meta is a level number; wins vs CPU on the board (limits maxRun 2)

## The five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | aim + pull power is real skill, but corner pockets had a ±0.3° window (cushion jaws very tight) and the pull control is hidden |
| Core loop | 1 | one match is 2-5 min with a rival that thinks 1 s per shot; the loop never changes; first round already is a full 8-ball rule set |
| Level design | 0 | "level" = the number of balls; same flat table every time |
| Meta | 0 | nothing carries over |
| Feel | 2 | pot bursts, pitch, "NICE POT!"; no streaks, no slow-mo, no near-miss, no spectacle growth |

## Verb and skill ceiling
Same verb. The ceiling is shot economy: every trick table has a par (the fewest robust shots a solver found), 3★ = par,
2★ = par+1, 1★ = within the limit (par+2). Position play (where the cue ball stops) decides whether the next pot is easy.

## The round
Trick table (20-60 s): a hand-made layout, a shot limit shown as gold/silver/bronze pips (3★/2★/1★ zones), chips for the
balls still on the table. A decision every shot (which ball, which pocket, where to leave the cue). Near miss: "SO CLOSE" /
"1 ball left". Win = stars pop one by one, progress bar to the next cue.
Duel (2-4 min, every 4th table): the v1 8-ball match against a named rival with its own accuracy, chat bubbles, and table
gimmicks. Stars: won / no fouls / rival potted 1 ball or none. First 3 tables: 1 ball and 4 spare shots; cannot lose.

## Mechanic plan (36 tables, 3 worlds × 12; tricks at 1-3,5-7,9-11; duel at 4, 8, boss duel at 12)
World 1 CORNER BAR (plain felt): one ball → two balls → side pockets → duel → cluster → angle past the 8 → posts block lines → duel → ORDER RULE (1-2-3) → order + posts → breather → boss Duke.
World 2 HARBOR CLUB: CORKED pockets (closed) → only side pockets → ICE (glide ×4) → duel on ice → ice+post → order+corks → "8 goes last" → duel → breather → cork maze → hard order on ice → boss Zoe.
World 3 SKYLINE: BUMPERS (kick back faster) → two bumpers → MUD (stops dead) → duel → bumper+mud+cork → order+bumper → breather (6 balls) → duel → everything → gauntlet → finale (1-2-3 then 8) → THE BOSS (full rack).
Each new gimmick has an introduction table (impossible to fail) before it is combined; tips show once on first sight.

## Meta
- 36-node map with 3 world sections, stars per node, next node pulsing, nodes unlock in order.
- Cue case: 12 cues unlocked by total stars (6 / 12 / 20 / … / 108), equipped cue shows in 3D and in the power bar.
- Rival collection: 9 rival portraits fill in as they are beaten.
- Hints: a lightbulb shows the solver's first shot on a fresh table (3 to start, +2 per boss beaten).

## Feel list
Streak counter (🔥), DOUBLE/TRIPLE POT, BANK SHOT, SCRATCH / order fouls explained, SO CLOSE near-miss, bumper pulse + boing,
slow-mo on the final pot, confetti, screen shake scaled by power, pot pitch rising with each ball in the shot, haptics,
rival chat bubbles, instant retry button (no card needed).

## Changes to the physics (v2 only; v1 untouched in v1.js)
Pockets are wider (cushions stop 0.8 from the corner instead of 0.44; a ball heading into a pocket is captured from slightly
further out): a straight corner shot is now a ±1° window instead of ±0.3°. Everything else (friction, restitution) is v1's.
Board score unchanged: "Wins vs CPU" (duel wins submit 1, limits maxRun 2 as before). Trick wins don't submit.

## QA
qa/solver.mjs (beam solver, robust to ±0.34° and ±7% power) sets par and the hint; qa/mkpars.sh writes pars.js;
qa/playall.cjs replays every trick table's solver path through the real game; duels are played by the bot with the rival planner.
deep v2: TEST live 2026-10-31 (real-player test, FUN_REVIEW round 2 7.7)
