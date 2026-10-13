# BUILD SPEC v3 — "Boplicity"
### An improv game: the app gives you the harmony, you play the language.
*Hand this spec to Codex phase by phase (§8 = build order). Single static web app, no backend.*

---

## 0. Concept (context paragraph for Codex)

A browser game for jazz improvisation practice. The app plays a looping swing
backing groove over a chord progression (ii–V–I in F). The player improvises
freely on a connected MIDI keyboard. A real-time harmonic analysis engine
scores the improvisation the way a jazz teacher would: chord tones on strong
beats score points (3rds and 7ths score highest), detected vocabulary —
arpeggios and enclosures — earns bonuses, and unresolved "wrong" notes score
nothing (Normal mode) or lose points (Hard mode). Live feedback popups name
what the player just did ("Enclosure! +250"). Built solo with Codex for
OpenAI Build Week. Deployable on GitHub Pages with zero setup.

## 1. Tech constraints (non-negotiable)

- Single-page static app: `index.html` + `app.js` + `style.css` + `theory.js`
  (the scoring engine, kept separate and unit-testable). Vanilla JS. No
  build step, no framework, no backend, no accounts.
- Audio: **Tone.js** (CDN) — swing ride pattern, bass roots, piano comp stabs,
  and (QWERTY mode only) synthesized player notes. In MIDI mode the player
  hears their own instrument; the app does NOT re-synthesize their notes.
- Input: **Web MIDI API** (Chrome), auto-detected, with QWERTY fallback
  (A–K = white keys C4–C5, W/E/T/Y/U = black keys). Show active input mode.
- **Demo Mode**: a bundled pre-recorded MIDI solo (a few bars of clean bebop
  with deliberate "wrong" notes included) plays through the live scoring
  engine so judges see scoring work without playing a note.
- Canvas for the play screen visuals; DOM for menus/HUD.

## 2. Screens

1. **Title** — name, tagline ("The app gives you the harmony. You bring the
   language."), [Play] [Hard Mode] [Demo] [How scoring works]. Input status
   line ("MIDI: Nord Stage 4 connected" / "Keyboard mode"). BPM select
   (80/100/120, default 100).
2. **Play** — see §3.
3. **Results** — total score; a **Vocabulary Report**: count of guide tones
   hit (3rds/7ths on strong beats), other chord tones on strong beats,
   arpeggios, enclosures, passing tones used, unresolved notes; longest
   combo; one rule-based coaching line chosen from the weakest stat (e.g.
   "You landed 2 guide tones in 16 bars — aim for the 3rd of each chord on
   beat one."). [Play again] [Title].

## 3. Play screen

- Bottom: 2-octave piano graphic (C3–C5) lighting up with played notes.
- Center: a horizontal **measure strip** — the heart of the readability
  design. A row of bar boxes like a lead sheet: each box = one bar, its
  chord symbol inside. The CURRENT bar is enlarged, gold-bordered, and
  fills left-to-right with a translucent gold progress sweep synced to the
  transport, so the player can SEE exactly how much of the chord remains.
  At least THREE upcoming bars are always fully visible to the right
  (upcoming chords must never appear last-minute — players read ahead like
  a chart). Bars slide left smoothly at each barline. Inside the current
  bar: 4 beat ticks, strong beats (1 & 3) heavier, the active beat pulsing.
  Past bars dim to the left. Chord symbols in upcoming bars are large
  enough to read at a glance from a piano bench (~arm's length + music
  stand distance).
- Above: floating **event popups** at the moment they're earned:
  "3rd on the downbeat +150" · "Arpeggio +200" · "Enclosure! +250" ·
  "Passing tone ✓" (no points, small/neutral) · Hard mode: "Unresolved −100"
  in red. Popups drift up and fade. Combo meter builds on consecutive scoring
  events; a session runs 16 bars (4 loops of the 4-bar progression), then
  auto-advances to Results.
- Progression (v1): | Gm7 | C7 | Fmaj7 | Fmaj7 | looping. Chord data drives
  everything — engine must read it from `progression.json` so more
  progressions can be added later without code changes.

## 4. The scoring engine (`theory.js`) — the heart of the game

All analysis references the CURRENT CHORD at the moment a note sounds, and
the beat clock from Tone.js Transport. Definitions:

- **Chord tones**: for each chord, root, 3rd, 5th, 7th (any octave).
  Gm7 = G,Bb,D,F · C7 = C,E,G,Bb · Fmaj7 = F,A,C,E.
- **Guide tones**: the 3rd and 7th of the current chord.
- **Strong beats**: beats 1 and 3 of each 4/4 bar. A note is "on" a beat if
  it sounds within ±90ms of it.

Scoring rules (evaluate on each note-on, some retroactively):

1. **Guide tone on a strong beat: +150.** Other chord tone (root/5th) on a
   strong beat: +50.
2. **Arpeggio: +200 bonus** — 3+ consecutive chord tones of the current chord
   moving in one direction, completed within one bar. Award once per run at
   the moment the 3rd note confirms it.
3. **Enclosure: +250 bonus** — a chord tone whose two immediately preceding
   notes surround it (one above, one below, either order), each within a
   whole step (chromatic or diatonic neighbors). Award at the resolution note.
   The resolution note ALSO earns its rule-1 points if on a strong beat —
   stacking is intentional and feels great.
4. **Passing tone (legal non-chord tone): +25, never a penalty** — a
   non-chord tone that resolves by half or whole step to any chord tone
   within 1 beat. Popup: "Chromatic ✓ +25". True chromaticism is rewarded
   as connective tissue — kept small so the big points stay on where lines
   LAND (guide tones, enclosures), not on wiggling.
5. **Unresolved note** — a non-chord tone that does NOT resolve stepwise
   within 1 beat (player leapt away, or it dangled): Normal mode = 0 points,
   no popup pile-on (single subtle gray popup). **Hard mode = −100** with red
   popup. Evaluate retroactively 1 beat after the note.
6. **Rests are always free.** Silence is musical; never penalize not playing.
7. **Triplet: +100** — three notes evenly subdividing one beat (each within
   ±12% of perfect triplet spacing). Max ONE triplet award per bar (no
   machine-gun farming). Popup: "Triplet +100".
8. **Upbeat entry: +75** — the first note of a phrase (a note preceded by at
   least 1 full beat of rest) landing on an offbeat ("and" of any beat,
   ±90ms). Classic bebop phrasing — entering ON the upbeat is the language.
   Popup: "Upbeat entry +75".
9. **Combo**: consecutive positive-scoring events build x2/x3/x4 at 5/10/15;
   an unresolved note breaks combo in both modes.

**Rule weights are reference-derived.** Point values above are tunable
constants in one config object at the top of theory.js (`WEIGHTS`). They are
being calibrated from analysis of real bebop repertoire (Parker et al.) —
analysis only: statistical tendencies inform the WEIGHTS and detector
definitions; NO transcribed lines, melodies, or copyrighted material may be
included in this repository or the app's content. All bundled demo material
must be original.

Engine must be pure functions on (noteEvent, chordContext, recentNotes) →
scoringEvents, with a small unit test file (`theory.test.html`) that runs in
the browser and asserts ~15 canonical cases (enclosure detected, passing tone
not penalized, leap away = unresolved, etc.). Codex writes tests FIRST for
this file.

## 5. Backing groove

Tone.js: swing ride cymbal pattern (swing ratio 0.62), bass playing roots on
1 and 5th on 3, sparse piano comp stabs on the and-of-2/and-of-4 (simple
voicings, low velocity — must not mask the player). All synthesized; no
samples required. Count-in: 1 bar of clicks before scoring starts.

## 6. Visual style

Dark charcoal (#141414), ivory text, ONE accent: gold #B98B4B for positive
popups, current chord, combo. Red only for hard-mode penalties. Lato font
(Google Fonts CDN). Premium and minimal, not arcade-neon. Event popups are
the visual star — typographic, quick, satisfying.

## 7. Modes

- **Normal**: no penalties; unresolved notes just score nothing.
- **Hard**: −100 per unresolved note. Everything else identical.
(One toggle, one constant in the engine — do not over-engineer.)

## 8. Build order for Codex (one phase per session, checkpoint each)

1. **Scaffold + input**: title screen, piano graphic, QWERTY + Web MIDI input
   lighting keys, Tone.js transport + count-in + ride/bass groove looping the
   progression from `progression.json`, chord timeline + beat pulse.
   CHECKPOINT: play along freely, chords change, keys light up.
2. **Engine**: `theory.js` pure functions + browser test page written FIRST,
   then implementation until all tests pass. No UI wiring yet.
   CHECKPOINT: all engine tests green.
3. **Wire-up**: connect engine to live input, event popups, score, combo,
   16-bar session flow, Results screen with Vocabulary Report + coaching line.
   CHECKPOINT: full loop playable.
4. **Polish + judge-proofing**: Demo Mode (bundled MIDI solo through the real
   engine), Hard mode toggle, BPM select, comp stabs, responsive sizing,
   README, deploy to GitHub Pages.
   CHECKPOINT: someone with no MIDI keyboard can open the link and get it.

## 9. README must include

What it is (3 sentences) · screenshot · live GitHub Pages link · how scoring
works (the §4 rules in plain English — this doubles as the pedagogy pitch) ·
input modes + Demo Mode · honest "how Codex built this" notes per phase ·
roadmap (more progressions, blues level, mic input for acoustic pianos,
teacher dashboard, lick challenges).

## 10. Out of scope for v1 — do NOT build

Accounts, leaderboards, more than one progression, microphone/audio input,
mobile/touch, difficulty beyond the Hard toggle and BPM, MIDI velocity
dynamics scoring, any backend, any analytics, level editor.
